import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { formatCopySource, copyObject, getStorage, checkStorageHealth, resetStorageCache, verifyMediaSignature } from '../src/services/storage.ts';
import { purgeExpiredMediaAndMessages } from '../src/services/retention.ts';
import app from '../src/app.ts';

test('formatCopySource properly formats Bucket/key with URI-encoded key and unencoded slashes', () => {
  // Test basic key without slashes
  const source1 = formatCopySource('black-bricks-r2', '00000000-0000-4000-8000-000000000001');
  assert.equal(source1, 'black-bricks-r2/00000000-0000-4000-8000-000000000001');

  // Test key with spaces
  const source2 = formatCopySource('black-bricks-r2', 'vacation photo 1.jpg');
  assert.equal(source2, 'black-bricks-r2/vacation%20photo%201.jpg');

  // Test key with subfolder path - slash must not be encoded
  const source3 = formatCopySource('black-bricks-r2', 'u/uploads/my video 2026.mp4');
  assert.equal(source3, 'black-bricks-r2/u/uploads/my%20video%202026.mp4');

  // Ensure bucket name is not encoded and slash separating bucket and key is literal /
  assert.ok(!source3.startsWith('black-bricks-r2%2F'));
  assert.ok(source3.includes('/u/uploads/'));
});

test('localStorage copyObject successfully copies files between object keys', async () => {
  const storage = getStorage();
  if (storage.mode !== 'local' || !storage.putLocal || !storage.readLocal) return;

  const sourceKey = randomUUID();
  const destKey = randomUUID();
  const content = Buffer.from('hello-haiku-copy-storage');

  await storage.putLocal(sourceKey, content);
  await copyObject(sourceKey, destKey);

  const copiedBytes = await storage.readLocal(destKey);
  assert.equal(copiedBytes.toString(), 'hello-haiku-copy-storage');

  await storage.deleteObject(sourceKey);
  await storage.deleteObject(destKey);
});

test('checkStorageHealth performs put/head/delete probe successfully in local mode', async () => {
  const result = await checkStorageHealth();
  assert.equal(result.ok, true);
  assert.equal(typeof result.latencyMs, 'number');
  assert.ok(result.latencyMs >= 0);
});

test('/health/storage endpoints reject unauthenticated access', async () => {
  const res1 = await app.request('/health/storage');
  assert.equal(res1.status, 401);

  const res2 = await app.request('/v1/health/storage');
  assert.equal(res2.status, 401);

  const res3 = await app.request('/v1/admin/health/storage');
  assert.equal(res3.status, 401);
});

test('Backblaze B2 storage adapter initializes and handles upload plan', async () => {
  const origStorage = process.env.MEDIA_STORAGE;
  const origKey = process.env.B2_KEY_ID;
  const origAppKey = process.env.B2_APPLICATION_KEY;
  const origBucket = process.env.B2_BUCKET;
  const origRegion = process.env.B2_REGION;

  try {
    resetStorageCache();
    process.env.MEDIA_STORAGE = 'b2';
    delete process.env.B2_KEY_ID;
    delete process.env.B2_APPLICATION_KEY;
    delete process.env.B2_BUCKET;

    assert.throws(() => getStorage(), /CONFIG_B2_STORAGE_MISSING/);

    process.env.B2_KEY_ID = 'test-b2-key-id-0123456789';
    process.env.B2_APPLICATION_KEY = 'test-b2-app-key-abcdefghijklmnopqrstuvwxyz';
    process.env.B2_BUCKET = 'haiku-test-bucket';
    process.env.B2_REGION = 'us-west-004';
    resetStorageCache();

    const b2 = getStorage();
    assert.equal(b2.mode, 'b2');

    const plan = await b2.uploadPlan('test-key.jpg', 'image/jpeg', 1024, 'http://localhost:3001', 'att-1');
    assert.equal(plan.mode, 'signed');
    assert.equal(plan.method, 'PUT');
    assert.ok(plan.url.includes('backblazeb2.com') || plan.url.includes('haiku-test-bucket'));
    assert.equal(plan.headers['Content-Type'], 'image/jpeg');
  } finally {
    process.env.MEDIA_STORAGE = origStorage;
    process.env.B2_KEY_ID = origKey;
    process.env.B2_APPLICATION_KEY = origAppKey;
    process.env.B2_BUCKET = origBucket;
    process.env.B2_REGION = origRegion;
    resetStorageCache();
  }
});

test('verifyMediaSignature supports WebM video and WAV audio signatures', () => {
  // WebM / EBML header: 0x1A, 0x45, 0xDF, 0xA3
  const webmBytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81]);
  assert.equal(verifyMediaSignature('video', 'video/webm', webmBytes), true);

  // WAV header: 'RIFF' + 4 bytes + 'WAVE'
  const wavBytes = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, // RIFF
    0x24, 0x00, 0x00, 0x00,
    0x57, 0x41, 0x56, 0x45, // WAVE
  ]);
  assert.equal(verifyMediaSignature('voice', 'audio/wav', wavBytes), true);
});

test('purgeExpiredMediaAndMessages runs safely without exceptions', async () => {
  const result = await purgeExpiredMediaAndMessages();
  assert.equal(typeof result.deletedObjects, 'number');
  assert.equal(typeof result.deletedMessages, 'number');
});
