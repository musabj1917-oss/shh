import { Hono } from 'hono';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getLatestApkRelease, setLatestApkRelease, uploadApkToVercelBlob } from '../services/vercel-blob.js';
import { jsonError } from '../http.js';
import { requireUser } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import type { ApiEnv } from '../types.js';

export const releaseRoutes = new Hono<ApiEnv>();

// Public endpoint for latest APK release info
releaseRoutes.get('/latest-apk', async (c) => {
  const release = await getLatestApkRelease();
  return c.json({ release });
});

// Local download endpoint if fallback mode is used
releaseRoutes.get('/download/:fileName', async (c) => {
  const fileName = c.req.param('fileName');
  if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) {
    return jsonError(c, 400, 'INVALID_FILENAME', 'Invalid file name.');
  }
  const localReleasesDir = path.resolve(process.cwd(), '../../.haiku-releases');
  const filePath = path.join(localReleasesDir, fileName);
  try {
    const bytes = await readFile(filePath);
    return c.body(bytes, 200, {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });
  } catch {
    return jsonError(c, 404, 'RELEASE_NOT_FOUND', 'APK release file not found.');
  }
});

// Admin-only endpoints for managing APK releases
releaseRoutes.post('/admin/apk', requireUser, requireAdmin, async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body['file'];
    const version = (body['version'] as string) || '1.0.0';
    const versionCode = Number(body['versionCode'] || 1);
    const releaseNotes = (body['releaseNotes'] as string) || '';

    if (file && typeof file === 'object' && 'arrayBuffer' in file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const fileName = (file as any).name || `haiku-messenger-v${version}.apk`;
      const release = await uploadApkToVercelBlob(fileName, buffer, {
        version,
        versionCode,
        releaseNotes,
      });
      return c.json({ release, message: 'APK uploaded to Vercel Blob successfully.' }, 201);
    }

    return jsonError(c, 400, 'FILE_MISSING', 'APK file must be provided.');
  } catch (err) {
    console.error('[Releases] Upload failed:', err);
    return jsonError(c, 500, 'UPLOAD_FAILED', err instanceof Error ? err.message : 'Upload failed.');
  }
});

releaseRoutes.put('/admin/config', requireUser, requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || !body.downloadUrl) {
    return jsonError(c, 400, 'INVALID_CONFIG', 'A valid downloadUrl is required.');
  }
  const current = await getLatestApkRelease();
  const updated = await setLatestApkRelease({
    ...current,
    version: body.version || current.version,
    versionCode: Number(body.versionCode || current.versionCode),
    downloadUrl: String(body.downloadUrl).trim(),
    releaseNotes: body.releaseNotes !== undefined ? String(body.releaseNotes) : current.releaseNotes,
    uploadedAt: new Date().toISOString(),
  });
  return c.json({ release: updated, message: 'APK release configuration updated.' });
});
