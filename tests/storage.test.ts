import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { formatCopySource, copyObject, getStorage, checkStorageHealth } from '../src/services/storage.ts';
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
