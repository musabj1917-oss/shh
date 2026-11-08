import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Standard CRC32 table for PNG writing
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c;
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function decodePng(buf) {
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  const bitDepth = buf[24];
  const colorType = buf[25];
  if (bitDepth !== 8 || colorType !== 6) {
    throw new Error(`Only 8-bit RGBA PNG supported. Got depth=${bitDepth}, type=${colorType}`);
  }

  let pos = 8;
  const idats = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    if (type === 'IDAT') idats.push(buf.subarray(pos + 8, pos + 8 + len));
    pos += 12 + len;
  }
  const decompressed = zlib.inflateSync(Buffer.concat(idats));

  // Remove PNG scanline filter (assuming filter 0 or reconstruct)
  const rgba = Buffer.alloc(w * h * 4);
  const stride = w * 4;
  let inPos = 0;
  let prevRow = null;

  for (let y = 0; y < h; y++) {
    const filter = decompressed[inPos++];
    const row = Buffer.alloc(stride);

    for (let x = 0; x < stride; x++) {
      const xByte = decompressed[inPos++];
      const a = x >= 4 ? row[x - 4] : 0;
      const b = prevRow ? prevRow[x] : 0;
      const c = (prevRow && x >= 4) ? prevRow[x - 4] : 0;

      let val = xByte;
      if (filter === 1) { // Sub
        val = (xByte + a) & 0xff;
      } else if (filter === 2) { // Up
        val = (xByte + b) & 0xff;
      } else if (filter === 3) { // Average
        val = (xByte + Math.floor((a + b) / 2)) & 0xff;
      } else if (filter === 4) { // Paeth
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        let pr;
        if (pa <= pb && pa <= pc) pr = a;
        else if (pb <= pc) pr = b;
        else pr = c;
        val = (xByte + pr) & 0xff;
      }
      row[x] = val;
    }
    row.copy(rgba, y * stride);
    prevRow = row;
  }

  return { width: w, height: h, data: rgba };
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // Filter None
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });

  const chunks = [];
  chunks.push(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  chunks.push(makeChunk('IHDR', ihdr));

  // IDAT
  chunks.push(makeChunk('IDAT', compressed));

  // IEND
  chunks.push(makeChunk('IEND', Buffer.alloc(0)));

  return Buffer.concat(chunks);
}

function makeChunk(type, data) {
  const len = data.length;
  const header = Buffer.alloc(8);
  header.writeUInt32BE(len, 0);
  header.write(type, 4, 4, 'ascii');
  const crcPayload = Buffer.concat([header.subarray(4, 8), data]);
  const crcVal = crc32(crcPayload);
  const footer = Buffer.alloc(4);
  footer.writeUInt32BE(crcVal, 0);
  return Buffer.concat([header, data, footer]);
}

function resample(src, dstWidth, dstHeight, roundMask = false) {
  const dst = Buffer.alloc(dstWidth * dstHeight * 4);
  const scaleX = src.width / dstWidth;
  const scaleY = src.height / dstHeight;
  const radius = roundMask ? dstWidth / 2 : 0;
  const centerX = dstWidth / 2;
  const centerY = dstHeight / 2;

  for (let dy = 0; dy < dstHeight; dy++) {
    const sy = Math.min(src.height - 1, Math.floor(dy * scaleY));
    for (let dx = 0; dx < dstWidth; dx++) {
      const dstIdx = (dy * dstWidth + dx) * 4;

      if (roundMask) {
        const dist = Math.hypot(dx + 0.5 - centerX, dy + 0.5 - centerY);
        if (dist > radius) {
          // Transparent outside circle
          dst[dstIdx + 3] = 0;
          continue;
        }
      }

      // Box sampling over the source region
      const startX = Math.floor(dx * scaleX);
      const endX = Math.min(src.width, Math.ceil((dx + 1) * scaleX));
      const startY = Math.floor(dy * scaleY);
      const endY = Math.min(src.height, Math.ceil((dy + 1) * scaleY));

      let rSum = 0, gSum = 0, bSum = 0, aSum = 0, count = 0;
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * src.width + x) * 4;
          const a = src.data[idx + 3] / 255;
          rSum += src.data[idx] * a;
          gSum += src.data[idx + 1] * a;
          bSum += src.data[idx + 2] * a;
          aSum += src.data[idx + 3];
          count++;
        }
      }

      if (count > 0 && aSum > 0) {
        const alpha = aSum / count;
        dst[dstIdx] = Math.round(rSum / (aSum / 255));
        dst[dstIdx + 1] = Math.round(gSum / (aSum / 255));
        dst[dstIdx + 2] = Math.round(bSum / (aSum / 255));
        dst[dstIdx + 3] = Math.round(alpha);
      } else {
        dst[dstIdx + 3] = 0;
      }
    }
  }

  return { width: dstWidth, height: dstHeight, data: dst };
}

const resDir = path.resolve(__dirname, '../apps/mobile/android/app/src/main/res');
const assetsDir = path.resolve(__dirname, '../apps/mobile/assets');

const mainIconPng = fs.readFileSync(path.join(assetsDir, 'icon.png'));
const adaptiveFgPng = fs.readFileSync(path.join(assetsDir, 'adaptive-icon.png'));
const monochromePng = fs.readFileSync(path.join(assetsDir, 'monochrome-icon.png'));

const srcMain = decodePng(mainIconPng);
const srcAdaptive = decodePng(adaptiveFgPng);
const srcMono = decodePng(monochromePng);

const mipmapSizes = [
  { name: 'mipmap-mdpi', size: 48 },
  { name: 'mipmap-hdpi', size: 72 },
  { name: 'mipmap-xhdpi', size: 96 },
  { name: 'mipmap-xxhdpi', size: 144 },
  { name: 'mipmap-xxxhdpi', size: 192 },
];

const drawableSizes = [
  { name: 'drawable-mdpi', size: 108 },
  { name: 'drawable-hdpi', size: 162 },
  { name: 'drawable-xhdpi', size: 216 },
  { name: 'drawable-xxhdpi', size: 324 },
  { name: 'drawable-xxxhdpi', size: 432 },
];

// Write mipmaps
for (const { name, size } of mipmapSizes) {
  const dir = path.join(resDir, name);
  fs.mkdirSync(dir, { recursive: true });

  const square = resample(srcMain, size, size, false);
  fs.writeFileSync(path.join(dir, 'ic_launcher.png'), encodePng(size, size, square.data));

  const round = resample(srcMain, size, size, true);
  fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), encodePng(size, size, round.data));
  console.log(`Wrote ${name} ic_launcher and ic_launcher_round (${size}x${size})`);
}

// Write drawables for adaptive and monochrome
for (const { name, size } of drawableSizes) {
  const dir = path.join(resDir, name);
  fs.mkdirSync(dir, { recursive: true });

  const fg = resample(srcAdaptive, size, size, false);
  fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), encodePng(size, size, fg.data));

  const mono = resample(srcMono, size, size, false);
  fs.writeFileSync(path.join(dir, 'ic_launcher_monochrome.png'), encodePng(size, size, mono.data));
  console.log(`Wrote ${name} adaptive foreground and monochrome (${size}x${size})`);
}

// Write XML adaptive icon config
const anydpiDir = path.join(resDir, 'mipmap-anydpi-v26');
fs.mkdirSync(anydpiDir, { recursive: true });

const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
    <monochrome android:drawable="@drawable/ic_launcher_monochrome" />
</adaptive-icon>
`;

fs.writeFileSync(path.join(anydpiDir, 'ic_launcher.xml'), adaptiveXml);
fs.writeFileSync(path.join(anydpiDir, 'ic_launcher_round.xml'), adaptiveXml);

// Write colors.xml background
const valuesDir = path.join(resDir, 'values');
fs.mkdirSync(valuesDir, { recursive: true });
const colorsXmlPath = path.join(valuesDir, 'colors.xml');
const colorsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#0A0A0A</color>
</resources>
`;
fs.writeFileSync(colorsXmlPath, colorsXml);

console.log('Successfully generated all Android launcher icons, adaptive icons, and monochrome themed icons!');
