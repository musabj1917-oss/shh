/**
 * Haiku Split Storage Architecture:
 * - Part 1: Neon Object Storage (S3-compatible) handles user messaging media,
 *   attachments, voice notes, stories, and avatars.
 * - Part 2: Vercel Blob Storage (see `services/vercel-blob.ts`) handles Android APK
 *   application releases configured via the Admin Console.
 */
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { isProduction } from '../config.js';

export type UploadPlan = { mode: 'proxy' | 'signed'; url: string; method: 'PUT'; headers: Record<string,string>; expiresInSeconds: number };
export type StorageAdapter = {
  mode: 'local' | 'neon-s3' | 'b2';
  uploadPlan(objectKey: string, mimeType: string, byteSize: number, baseUrl: string, attachmentId: string): Promise<UploadPlan>;
  downloadUrl(objectKey: string, baseUrl: string, opts?: { fileName?: string; contentType?: string }): Promise<{ mode: 'proxy' | 'signed'; url: string; expiresInSeconds: number }>;
  putLocal?(objectKey: string, bytes: Uint8Array): Promise<void>;
  readLocal?(objectKey: string): Promise<Buffer>;
  checkObject?(objectKey: string, expectedMimeType?: string): Promise<{ byteSize: number; mimeType: string; prefix: Uint8Array }>;
  deleteObject(objectKey: string): Promise<void>;
  copyObject?(sourceKey: string, destinationKey: string): Promise<void>;
  healthCheck?(): Promise<{ ok: boolean; mode: string; latencyMs: number; bucket?: string; details?: Record<string, any> }>;
};

const localRoot = existsSync(path.resolve(process.cwd(), '.haiku-media'))
  ? path.resolve(process.cwd(), '.haiku-media')
  : path.resolve(process.cwd(), '../../.haiku-media');
function safePath(objectKey: string) {
  if (!/^[a-f0-9-]{36}$/.test(objectKey)) throw new Error('MEDIA_KEY_INVALID');
  const result = path.join(localRoot, objectKey);
  if (!result.startsWith(localRoot + path.sep)) throw new Error('MEDIA_KEY_INVALID');
  return result;
}

export function formatCopySource(bucket: string, key: string): string {
  // CopySource must be `${Bucket}/${key}` with only the key URI-encoded (do not encode the slash)
  const cleanKey = key.startsWith('/') ? key.slice(1) : key;
  return `${bucket}/${cleanKey.split('/').map(encodeURIComponent).join('/')}`;
}

function localStorage(): StorageAdapter {
  if (isProduction() || process.env.VERCEL) throw new Error('CONFIG_LOCAL_MEDIA_NOT_ALLOWED');
  return {
    mode: 'local',
    async uploadPlan(_key, mimeType, _size, baseUrl, attachmentId) {
      return { mode: 'proxy', url: `${baseUrl.replace(/\/$/, '')}/v1/media/${attachmentId}/content`, method: 'PUT', headers: { 'Content-Type': mimeType }, expiresInSeconds: 300 };
    },
    async downloadUrl(objectKey, baseUrl) {
      return { mode: 'proxy', url: `${baseUrl.replace(/\/$/, '')}/v1/media/object/${objectKey}`, expiresInSeconds: 60 };
    },
    async putLocal(key, bytes) { await mkdir(localRoot, { recursive: true }); await writeFile(safePath(key), bytes, { flag: 'wx' }); },
    async readLocal(key) { return readFile(safePath(key)); },
    async checkObject(key, expectedMimeType) {
      const bytes = await readFile(safePath(key));
      return { byteSize: bytes.byteLength, mimeType: expectedMimeType || 'application/octet-stream', prefix: bytes.subarray(0, 32) };
    },
    async deleteObject(key) { try { await unlink(safePath(key)); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; } },
    async copyObject(sourceKey, destinationKey) {
      const bytes = await readFile(safePath(sourceKey));
      await mkdir(localRoot, { recursive: true });
      await writeFile(safePath(destinationKey), bytes);
    },
    async healthCheck() {
      const probeKey = randomUUID();
      const probeData = Buffer.from('haiku-storage-health-check');
      const start = Date.now();
      await mkdir(localRoot, { recursive: true });
      await writeFile(safePath(probeKey), probeData);
      await readFile(safePath(probeKey));
      await unlink(safePath(probeKey));
      return { ok: true, mode: 'local', latencyMs: Date.now() - start };
    },
  };
}

function neonS3Storage(): StorageAdapter {
  const endpoint = process.env.S3_ENDPOINT || process.env.AWS_ENDPOINT_URL_S3;
  const region = process.env.S3_REGION || process.env.AWS_REGION || 'auto';
  const accessKeyId = process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  const bucket = process.env.S3_BUCKET || process.env.MEDIA_BUCKET;
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) throw new Error('CONFIG_NEON_OBJECT_STORAGE_MISSING');
  const s3 = new S3Client({
    region,
    endpoint,
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    credentials: { accessKeyId, secretAccessKey },
  });
  return {
    mode: 'neon-s3',
    async uploadPlan(objectKey, mimeType, byteSize) {
      const command = new PutObjectCommand({ Bucket: bucket, Key: objectKey, ContentType: mimeType, ContentLength: byteSize });
      const url = await getSignedUrl(s3, command, { expiresIn: 300 });
      return { mode: 'signed', url, method: 'PUT', headers: { 'Content-Type': mimeType }, expiresInSeconds: 300 };
    },
    async downloadUrl(objectKey, _baseUrl, opts) {
      const safeName = opts?.fileName ? opts.fileName.replace(/[^A-Za-z0-9._-]/g, '_') : undefined;
      const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: objectKey, ...(safeName ? { ResponseContentDisposition: `attachment; filename="${safeName}"` } : {}), ...(opts?.contentType ? { ResponseContentType: opts.contentType } : {}) }), { expiresIn: 60 });
      return { mode: 'signed', url, expiresInSeconds: 60 };
    },
    async checkObject(objectKey) {
      const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }));
      const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey, Range: 'bytes=0-31' }));
      const prefix = object.Body ? await object.Body.transformToByteArray() : new Uint8Array();
      return { byteSize: Number(head.ContentLength || 0), mimeType: String(head.ContentType || 'application/octet-stream'), prefix };
    },
    async deleteObject(objectKey) { await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey })); },
    async copyObject(sourceKey, destinationKey) {
      const copySource = formatCopySource(bucket, sourceKey);
      await s3.send(new CopyObjectCommand({
        Bucket: bucket,
        Key: destinationKey,
        CopySource: copySource,
      }));
    },
    async healthCheck() {
      const probeKey = `_probe_${Date.now()}_${randomUUID().slice(0, 8)}.txt`;
      const probeData = Buffer.from('haiku-storage-health-check');
      const start = Date.now();
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: probeKey,
        Body: probeData,
        ContentType: 'text/plain',
      }));
      await s3.send(new HeadObjectCommand({
        Bucket: bucket,
        Key: probeKey,
      }));
      await s3.send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: probeKey,
      }));
      return {
        ok: true,
        mode: 'neon-s3',
        bucket,
        latencyMs: Date.now() - start,
      };
    },
  };
}

function b2Storage(): StorageAdapter {
  const region = process.env.B2_REGION || process.env.S3_REGION || 'us-west-004';
  const endpoint =
    process.env.B2_ENDPOINT ||
    process.env.B2_S3_ENDPOINT ||
    process.env.S3_ENDPOINT ||
    `https://s3.${region}.backblazeb2.com`;
  const accessKeyId =
    process.env.B2_KEY_ID ||
    process.env.B2_APPLICATION_KEY_ID ||
    process.env.B2_ACCESS_KEY_ID ||
    process.env.S3_ACCESS_KEY_ID ||
    process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.B2_APPLICATION_KEY ||
    process.env.B2_SECRET_ACCESS_KEY ||
    process.env.S3_SECRET_ACCESS_KEY ||
    process.env.AWS_SECRET_ACCESS_KEY;
  const bucket =
    process.env.B2_BUCKET ||
    process.env.B2_BUCKET_NAME ||
    process.env.S3_BUCKET ||
    process.env.MEDIA_BUCKET;
  const cdnUrl = process.env.B2_CDN_URL || process.env.B2_DOWNLOAD_URL || process.env.B2_PUBLIC_URL;

  if (!accessKeyId || !secretAccessKey || !bucket) {
    throw new Error('CONFIG_B2_STORAGE_MISSING');
  }

  const s3 = new S3Client({
    region,
    endpoint,
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    credentials: { accessKeyId, secretAccessKey },
  });

  return {
    mode: 'b2',
    async uploadPlan(objectKey, mimeType, byteSize) {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        ContentType: mimeType,
        ContentLength: byteSize,
      });
      const url = await getSignedUrl(s3, command, { expiresIn: 300 });
      return {
        mode: 'signed',
        url,
        method: 'PUT',
        headers: { 'Content-Type': mimeType },
        expiresInSeconds: 300,
      };
    },
    async downloadUrl(objectKey, _baseUrl, opts) {
      if (cdnUrl) {
        const cleanBase = cdnUrl.replace(/\/$/, '');
        const safeName = opts?.fileName ? opts.fileName.replace(/[^A-Za-z0-9._-]/g, '_') : undefined;
        const query = safeName ? `?filename=${encodeURIComponent(safeName)}` : '';
        return { mode: 'signed', url: `${cleanBase}/${objectKey}${query}`, expiresInSeconds: 86400 };
      }
      const safeName = opts?.fileName ? opts.fileName.replace(/[^A-Za-z0-9._-]/g, '_') : undefined;
      const url = await getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket: bucket,
          Key: objectKey,
          ...(safeName ? { ResponseContentDisposition: `attachment; filename="${safeName}"` } : {}),
          ...(opts?.contentType ? { ResponseContentType: opts.contentType } : {})
        }),
        { expiresIn: 300 }
      );
      return { mode: 'signed', url, expiresInSeconds: 300 };
    },
    async checkObject(objectKey) {
      const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }));
      const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey, Range: 'bytes=0-31' }));
      const prefix = object.Body ? await object.Body.transformToByteArray() : new Uint8Array();
      return {
        byteSize: Number(head.ContentLength || 0),
        mimeType: String(head.ContentType || 'application/octet-stream'),
        prefix,
      };
    },
    async deleteObject(objectKey) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
    },
    async copyObject(sourceKey, destinationKey) {
      const copySource = formatCopySource(bucket, sourceKey);
      await s3.send(
        new CopyObjectCommand({
          Bucket: bucket,
          Key: destinationKey,
          CopySource: copySource,
        })
      );
    },
    async healthCheck() {
      const probeKey = `_probe_${Date.now()}_${randomUUID().slice(0, 8)}.txt`;
      const probeData = Buffer.from('haiku-b2-storage-health-check');
      const start = Date.now();
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: probeKey,
          Body: probeData,
          ContentType: 'text/plain',
        })
      );
      await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: probeKey }));
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: probeKey }));
      return {
        ok: true,
        mode: 'b2',
        bucket,
        latencyMs: Date.now() - start,
      };
    },
  };
}

let cached: StorageAdapter | undefined;
export function getStorage(): StorageAdapter {
  if (cached) return cached;
  const mode = process.env.MEDIA_STORAGE || 'local';
  if (mode === 'local') cached = localStorage();
  else if (mode === 'neon-s3' || mode === 's3') cached = neonS3Storage();
  else if (mode === 'b2' || mode === 'backblaze' || mode === 'backblaze-b2') cached = b2Storage();
  else throw new Error('CONFIG_MEDIA_STORAGE_INVALID');
  return cached;
}

export function resetStorageCache(): void {
  cached = undefined;
}

export async function copyObject(sourceKey: string, destinationKey: string): Promise<void> {
  const storage = getStorage();
  if (storage.copyObject) {
    await storage.copyObject(sourceKey, destinationKey);
  }
}

export async function checkStorageHealth(): Promise<{ ok: boolean; mode: string; latencyMs: number; bucket?: string; error?: string }> {
  try {
    const storage = getStorage();
    if (storage.healthCheck) {
      return await storage.healthCheck();
    }
    return { ok: true, mode: storage.mode, latencyMs: 0 };
  } catch (err: any) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    // Sanitize error string so secrets or credentials are never leaked
    const safeMsg = rawMsg.replace(/([A-Za-z0-9+/=]{20,})/g, '***');
    return { ok: false, mode: process.env.MEDIA_STORAGE || 'local', latencyMs: 0, error: safeMsg };
  }
}

export function newObjectKey() { return randomUUID(); }

export function verifyMediaSignature(mediaType: string, mimeType: string, bytes: Uint8Array) {
  const b = bytes;
  const starts = (...signature: number[]) => signature.every((value, index) => b[index] === value);
  const mime = mimeType.toLowerCase().split(';')[0].trim();
  if (mediaType === 'image') {
    if (mime === 'image/jpeg' && starts(0xff,0xd8,0xff)) return true;
    if (mime === 'image/png' && starts(0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a)) return true;
    if (mime === 'image/webp' && String.fromCharCode(...b.slice(0,4)) === 'RIFF' && String.fromCharCode(...b.slice(8,12)) === 'WEBP') return true;
    if ((mime === 'image/heic' || mime === 'image/heif') && String.fromCharCode(...b.slice(4,8)) === 'ftyp') return true;
  }
  if (mediaType === 'video') {
    if ((mime === 'video/mp4' || mime === 'video/quicktime') && (String.fromCharCode(...b.slice(4,8)) === 'ftyp' || String.fromCharCode(...b.slice(4,8)) === 'moov' || String.fromCharCode(...b.slice(4,8)) === 'wide' || String.fromCharCode(...b.slice(4,8)) === 'mdat')) return true;
    if ((mime === 'video/webm' || mime === 'video/x-matroska') && starts(0x1a,0x45,0xdf,0xa3)) return true;
  }
  if (mediaType === 'voice') {
    if (mime === 'audio/mp4' && String.fromCharCode(...b.slice(4,8)) === 'ftyp') return true;
    if (mime === 'audio/ogg' && String.fromCharCode(...b.slice(0,4)) === 'OggS') return true;
    if ((mime === 'audio/webm' || mime === 'audio/matroska') && starts(0x1a,0x45,0xdf,0xa3)) return true;
    if (mime === 'audio/mpeg' && (starts(0x49,0x44,0x33) || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0))) return true;
    if (mime === 'audio/wav' && String.fromCharCode(...b.slice(0,4)) === 'RIFF' && String.fromCharCode(...b.slice(8,12)) === 'WAVE') return true;
  }
  return false;
}
