import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const themes = ['haiku', 'sakura', 'matcha', 'ocean', 'ember', 'paper'];
const sourceDir = path.resolve(__dirname, '../apps/mobile/src/assets/haiku-icons');
const outputBaseDir = path.resolve(__dirname, '../apps/mobile/assets/icons');

function renderSvgToPng(svgPath, outPath, width = 1024, height = 1024) {
  const svg = readFileSync(svgPath, 'utf8');
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: width,
    },
  });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();
  writeFileSync(outPath, pngBuffer);
  console.log(`Exported ${path.relative(process.cwd(), outPath)} (${pngBuffer.length} bytes)`);
}

mkdirSync(outputBaseDir, { recursive: true });

// Export monochrome.png
const monoSvgPath = path.join(sourceDir, 'monochrome.svg');
if (existsSync(monoSvgPath)) {
  renderSvgToPng(monoSvgPath, path.join(outputBaseDir, 'monochrome.png'), 1024, 1024);
}

for (const theme of themes) {
  const themeDir = path.join(outputBaseDir, theme);
  mkdirSync(themeDir, { recursive: true });

  // 1. icon-*.png (1024px)
  const iconSvgPath = path.join(sourceDir, `icon-${theme}.svg`);
  if (existsSync(iconSvgPath)) {
    renderSvgToPng(iconSvgPath, path.join(themeDir, `icon-${theme}.png`), 1024, 1024);
    // Also save as icon.png in theme directory for easy reference
    renderSvgToPng(iconSvgPath, path.join(themeDir, `icon.png`), 1024, 1024);
  }

  // 2. adaptive-foreground-*.png (1024px)
  const adaptiveSvgPath = path.join(sourceDir, `adaptive-foreground-${theme}.svg`);
  if (existsSync(adaptiveSvgPath)) {
    renderSvgToPng(adaptiveSvgPath, path.join(themeDir, `adaptive-foreground-${theme}.png`), 1024, 1024);
    renderSvgToPng(adaptiveSvgPath, path.join(themeDir, `adaptive-foreground.png`), 1024, 1024);
  }

  // 3. background text
  const bgTxtPath = path.join(sourceDir, `adaptive-background-${theme}.txt`);
  if (existsSync(bgTxtPath)) {
    const bgHex = readFileSync(bgTxtPath, 'utf8').trim();
    writeFileSync(path.join(themeDir, 'adaptive-background.txt'), bgHex);
    writeFileSync(path.join(themeDir, `adaptive-background-${theme}.txt`), bgHex);
  }

  // Also copy monochrome to theme dir
  if (existsSync(monoSvgPath)) {
    renderSvgToPng(monoSvgPath, path.join(themeDir, 'monochrome.png'), 1024, 1024);
  }
}

// Ensure default root icons exist in mobile/assets:
// icon.png, adaptive-icon.png, splash.png
const defaultThemeDir = path.join(outputBaseDir, 'haiku');
const assetsDir = path.resolve(__dirname, '../apps/mobile/assets');
mkdirSync(assetsDir, { recursive: true });

if (existsSync(path.join(defaultThemeDir, 'icon-haiku.png'))) {
  writeFileSync(path.join(assetsDir, 'icon.png'), readFileSync(path.join(defaultThemeDir, 'icon-haiku.png')));
}
if (existsSync(path.join(defaultThemeDir, 'adaptive-foreground-haiku.png'))) {
  writeFileSync(path.join(assetsDir, 'adaptive-icon.png'), readFileSync(path.join(defaultThemeDir, 'adaptive-foreground-haiku.png')));
}
if (existsSync(path.join(outputBaseDir, 'monochrome.png'))) {
  writeFileSync(path.join(assetsDir, 'monochrome-icon.png'), readFileSync(path.join(outputBaseDir, 'monochrome.png')));
}
// Splash: 1024x1024 icon-haiku.png or dedicated splash
if (existsSync(path.join(defaultThemeDir, 'icon-haiku.png'))) {
  writeFileSync(path.join(assetsDir, 'splash.png'), readFileSync(path.join(defaultThemeDir, 'icon-haiku.png')));
}

console.log('Icon export completed successfully.');
