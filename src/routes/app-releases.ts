import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { z } from 'zod';
import { dbReady, getDb } from '../db.js';
import { jsonError, parseJson } from '../http.js';
import { hasAdminPermission } from '../middleware/admin.js';
import { auditAdmin } from '../services/audit.js';
import { getStorage } from '../services/storage.js';
import type { ApiEnv } from '../types.js';

const APK_MIME = 'application/vnd.android.package-archive';
const MAX_APK_BYTES = Math.min(1024 * 1024 * 1024, Math.max(1024 * 1024, Number.parseInt(process.env.APK_MAX_BYTES || '', 10) || 300 * 1024 * 1024));

type ReleaseRow = {
  id: string; platform: string; version: string; file_name: string; object_key?: string;
  byte_size: string | number; notes: string | null; status: string; is_active: boolean;
  download_count: number; created_at: string; activated_at: string | null;
};

let tableReady: Promise<void> | undefined;
// Mirrors database/migrations/005_app_releases.sql so the feature works even before `npm run migrate` is run.
export function ensureReleaseTable(): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      await getDb()`CREATE TABLE IF NOT EXISTS app_releases (
        id uuid PRIMARY KEY,
        platform text NOT NULL DEFAULT 'android',
        version text NOT NULL,
        file_name text NOT NULL,
        object_key text NOT NULL UNIQUE,
        byte_size bigint NOT NULL,
        mime_type text NOT NULL DEFAULT 'application/vnd.android.package-archive',
        notes text,
        status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready')),
        is_active boolean NOT NULL DEFAULT false,
        download_count integer NOT NULL DEFAULT 0,
        uploaded_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        activated_at timestamptz
      )`;
    })().catch((error) => { tableReady = undefined; throw error; });
  }
  return tableReady;
}

const publicRow = (row: ReleaseRow) => ({
  id: row.id, platform: row.platform, version: row.version, file_name: row.file_name,
  byte_size: Number(row.byte_size), notes: row.notes, status: row.status, is_active: row.is_active,
  download_count: row.download_count, created_at: row.created_at, activated_at: row.activated_at,
});

async function purgeStalePending() {
  try {
    const stale = await getDb()`SELECT id,object_key FROM app_releases WHERE status='pending' AND created_at < now() - interval '1 day'` as unknown as { id: string; object_key: string }[];
    for (const item of stale) {
      try { await getStorage().deleteObject(item.object_key); } catch { /* object may never have been uploaded */ }
      await getDb()`DELETE FROM app_releases WHERE id=${item.id}::uuid`;
    }
  } catch { /* best effort */ }
}

async function activateRelease(id: string) {
  const rows = await getDb()`WITH off AS (UPDATE app_releases SET is_active=false WHERE platform='android' AND is_active AND id<>${id}::uuid)
    UPDATE app_releases SET is_active=true, activated_at=now() WHERE id=${id}::uuid AND status='ready' RETURNING id` as unknown as { id: string }[];
  return rows.length > 0;
}

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

// ------------------------------------------------------------------ admin (mounted at /v1/admin/app-releases)
export const releaseAdminRoutes = new Hono<ApiEnv>();

releaseAdminRoutes.use('*', async (c, next) => {
  if (!hasAdminPermission(c, 'releases.manage')) return jsonError(c, 403, 'PERMISSION_DENIED', 'You do not have app release permission.');
  try { await ensureReleaseTable(); }
  catch { return jsonError(c, 503, 'DATABASE_UNAVAILABLE', 'The release database is not ready.'); }
  await next();
});

releaseAdminRoutes.get('/', async (c) => {
  await purgeStalePending();
  const rows = await getDb()`SELECT id,platform,version,file_name,byte_size,notes,status,is_active,download_count,created_at,activated_at
    FROM app_releases ORDER BY created_at DESC LIMIT 50` as unknown as ReleaseRow[];
  return c.json({ releases: rows.map(publicRow), storageReady: process.env.MEDIA_STORAGE === 'neon-s3', maxBytes: MAX_APK_BYTES });
});

const planSchema = z.object({
  version: z.string().trim().min(1).max(32).regex(/^[0-9A-Za-z][0-9A-Za-z._+-]*$/, 'Use letters, numbers, dots and dashes only.'),
  fileName: z.string().trim().min(5).max(120).regex(/\.apk$/i, 'The file must be an .apk.'),
  byteSize: z.number().int().min(100 * 1024).max(MAX_APK_BYTES),
  notes: z.string().trim().max(1000).optional(),
});

releaseAdminRoutes.post('/upload-plan', async (c) => {
  const parsed = await parseJson(c, planSchema);
  if ('response' in parsed) return parsed.response;
  const { version, fileName, byteSize, notes } = parsed.data;
  let storage: ReturnType<typeof getStorage>;
  try { storage = getStorage(); }
  catch { return jsonError(c, 503, 'STORAGE_NOT_CONFIGURED', 'Object storage is not configured for this API.'); }
  if (storage.mode !== 'neon-s3') return jsonError(c, 409, 'STORAGE_NOT_CONFIGURED', 'APK uploads need object storage (set MEDIA_STORAGE=neon-s3).');
  const id = randomUUID();
  const objectKey = `releases/${id}.apk`;
  const plan = await storage.uploadPlan(objectKey, APK_MIME, byteSize, new URL(c.req.url).origin, id);
  await getDb()`INSERT INTO app_releases (id,version,file_name,object_key,byte_size,notes,uploaded_by)
    VALUES (${id}::uuid,${version},${fileName},${objectKey},${byteSize},${notes || null},${c.get('user').id}::uuid)`;
  await auditAdmin(c.get('user').id, 'app_release.upload_started', 'app_release', id, undefined, { version, byteSize });
  return c.json({ release: { id }, upload: { url: plan.url, method: plan.method, headers: plan.headers, expiresInSeconds: plan.expiresInSeconds } }, 201);
});

releaseAdminRoutes.post('/:id/complete', async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return jsonError(c, 404, 'NOT_FOUND', 'Release not found.');
  const body = await c.req.json().catch(() => ({})) as { activate?: unknown };
  const activate = body.activate !== false;
  const rows = await getDb()`SELECT id,object_key,byte_size,version FROM app_releases WHERE id=${id}::uuid AND status='pending' LIMIT 1` as unknown as { id: string; object_key: string; byte_size: string | number; version: string }[];
  const row = rows[0];
  if (!row) return jsonError(c, 404, 'NOT_FOUND', 'No pending upload with that id.');
  const storage = getStorage();
  let check: { byteSize: number; prefix: Uint8Array } | undefined;
  try { check = await storage.checkObject?.(row.object_key); } catch { check = undefined; }
  const zipMagic = !!check && check.prefix[0] === 0x50 && check.prefix[1] === 0x4b && check.prefix[2] === 0x03 && check.prefix[3] === 0x04;
  if (!check || check.byteSize !== Number(row.byte_size) || !zipMagic) {
    try { await storage.deleteObject(row.object_key); } catch { /* ignore */ }
    await getDb()`DELETE FROM app_releases WHERE id=${id}::uuid`;
    return jsonError(c, 422, 'APK_INVALID', 'The uploaded file was missing, the wrong size, or is not a valid APK. Please upload it again.');
  }
  await getDb()`UPDATE app_releases SET status='ready' WHERE id=${id}::uuid`;
  if (activate) await activateRelease(id);
  await auditAdmin(c.get('user').id, 'app_release.uploaded', 'app_release', id, undefined, { version: row.version, published: activate });
  return c.json({ status: 'ready', active: activate });
});

releaseAdminRoutes.post('/:id/activate', async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return jsonError(c, 404, 'NOT_FOUND', 'Release not found.');
  if (!(await activateRelease(id))) return jsonError(c, 404, 'NOT_FOUND', 'Only fully uploaded releases can be published.');
  await auditAdmin(c.get('user').id, 'app_release.published', 'app_release', id);
  return c.json({ status: 'active' });
});

releaseAdminRoutes.post('/:id/deactivate', async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return jsonError(c, 404, 'NOT_FOUND', 'Release not found.');
  await getDb()`UPDATE app_releases SET is_active=false WHERE id=${id}::uuid`;
  await auditAdmin(c.get('user').id, 'app_release.unpublished', 'app_release', id);
  return c.json({ status: 'inactive' });
});

releaseAdminRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return jsonError(c, 404, 'NOT_FOUND', 'Release not found.');
  const rows = await getDb()`SELECT object_key,version FROM app_releases WHERE id=${id}::uuid LIMIT 1` as unknown as { object_key: string; version: string }[];
  const row = rows[0];
  if (!row) return jsonError(c, 404, 'NOT_FOUND', 'Release not found.');
  try { await getStorage().deleteObject(row.object_key); } catch { /* object may already be gone */ }
  await getDb()`DELETE FROM app_releases WHERE id=${id}::uuid`;
  await auditAdmin(c.get('user').id, 'app_release.deleted', 'app_release', id, undefined, { version: row.version });
  return c.json({ status: 'deleted' });
});

// ------------------------------------------------------------------ public (mounted at /v1/app)
export const appPublicRoutes = new Hono<ApiEnv>();

async function activeRelease() {
  if (!dbReady()) return null;
  await ensureReleaseTable();
  const rows = await getDb()`SELECT id,version,file_name,object_key,byte_size,notes,activated_at FROM app_releases
    WHERE platform='android' AND is_active AND status='ready' ORDER BY activated_at DESC NULLS LAST LIMIT 1` as unknown as { id: string; version: string; file_name: string; object_key: string; byte_size: string | number; notes: string | null; activated_at: string | null }[];
  return rows[0] ?? null;
}

appPublicRoutes.get('/latest', async (c) => {
  try {
    const release = await activeRelease();
    if (!release) return c.json({ available: false });
    c.header('Cache-Control', 'public, max-age=60');
    return c.json({ available: true, platform: 'android', version: release.version, fileName: release.file_name, byteSize: Number(release.byte_size), notes: release.notes, publishedAt: release.activated_at, downloadPath: '/v1/app/download' });
  } catch {
    return c.json({ available: false });
  }
});

appPublicRoutes.get('/download', async (c) => {
  try {
    const release = await activeRelease();
    if (!release) return jsonError(c, 404, 'APP_NOT_AVAILABLE', 'The Android app is not available for download yet.');
    const link = await getStorage().downloadUrl(release.object_key, new URL(c.req.url).origin, { fileName: `HaikuMessenger-${release.version}.apk`, contentType: APK_MIME });
    try { await getDb()`UPDATE app_releases SET download_count=download_count+1 WHERE id=${release.id}::uuid`; } catch { /* counter is best effort */ }
    c.header('Cache-Control', 'no-store');
    return c.redirect(link.url, 302);
  } catch {
    return jsonError(c, 503, 'DOWNLOAD_UNAVAILABLE', 'The download is temporarily unavailable.');
  }
});
