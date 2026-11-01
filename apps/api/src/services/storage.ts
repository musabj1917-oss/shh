/**
 * Haiku Split Storage Architecture:
 * - Part 1: Neon Object Storage (S3-compatible) handles user messaging media,
 *   attachments, voice notes, stories, and avatars.
 * - Part 2: Vercel Blob Storage (see `services/vercel-blob.ts`) handles Android APK
 *   application releases configured via the Admin Console.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { isProduction } from '../config.js';

export type UploadPlan = { mode: 'proxy' | 'signed'; url: string; method: 'PUT'; headers: Record<string,string>; expiresInSeconds: number };
export type StorageAdapter = {
  mode: 'local' | 'neon-s3';
  uploadPlan(objectKey: string, mimeType: string, byteSize: number, baseUrl: string, attachmentId: string): Promise<UploadPlan>;
  downloadUrl(objectKey: string, baseUrl: string, opts?: { fileName?: string; contentType?: string }): Promise<{ mode: 'proxy' | 'signed'; url: string; expiresInSeconds: number }>;
  putLocal?(objectKey: string, bytes: Uint8Array): Promise<void>;
  readLocal?(objectKey: string): Promise<Buffer>;
  checkObject?(objectKey: string, expectedMimeType?: string): Promise<{ byteSize: number; mimeType: string; prefix: Uint8Array }>;
  deleteObject(objectKey: string): Promise<void>;
};

const localRoot = path.resolve(process.cwd(), '../../.haiku-media');
function safePath(objectKey: string) {
  if (!/^[a-f0-9-]{36}$/.test(objectKey)) throw new Error('MEDIA_KEY_INVALID');
  const result = path.join(localRoot, objectKey);
  if (!result.startsWith(localRoot + path.sep)) throw new Error('MEDIA_KEY_INVALID');
  return result;
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
  };
}

function neonS3Storage(): StorageAdapter {
  const endpoint = process.env.AWS_ENDPOINT_URL_S3;
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const bucket = process.env.MEDIA_BUCKET;
  if (!endpoint || !region || !accessKeyId || !secretAccessKey || !bucket) throw new Error('CONFIG_NEON_OBJECT_STORAGE_MISSING');
  const s3 = new S3Client({ region, endpoint, forcePathStyle: true, credentials: { accessKeyId, secretAccessKey } });
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
  };
}

let cached: StorageAdapter | undefined;
export function getStorage(): StorageAdapter {
  if (cached) return cached;
  const mode = process.env.MEDIA_STORAGE || 'local';
  if (mode === 'local') cached = localStorage();
  else if (mode === 'neon-s3') cached = neonS3Storage();
  else throw new Error('CONFIG_MEDIA_STORAGE_INVALID');
  return cached;
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
  }
  if (mediaType === 'video' && mime === 'video/mp4' && String.fromCharCode(...b.slice(4,8)) === 'ftyp') return true;
  if (mediaType === 'voice') {
    if (mime === 'audio/mp4' && String.fromCharCode(...b.slice(4,8)) === 'ftyp') return true;
    if (mime === 'audio/ogg' && String.fromCharCode(...b.slice(0,4)) === 'OggS') return true;
    if ((mime === 'audio/webm' || mime === 'audio/matroska') && starts(0x1a,0x45,0xdf,0xa3)) return true;
    if (mime === 'audio/mpeg' && (starts(0x49,0x44,0x33) || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0))) return true;
  }
  return false;
}
