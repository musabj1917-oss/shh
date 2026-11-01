import { put } from '@vercel/blob';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface ApkRelease {
  version: string;
  versionCode: number;
  downloadUrl: string;
  fileName: string;
  fileSize: number;
  releaseNotes: string;
  uploadedAt: string;
}

const localReleasesDir = path.resolve(process.cwd(), '../../.haiku-releases');
const latestConfigPath = path.join(localReleasesDir, 'latest.json');

// Default initial release configuration
let inMemoryLatest: ApkRelease = {
  version: '1.0.0',
  versionCode: 1,
  downloadUrl: 'https://github.com/musabj1917-oss/shh/releases/latest',
  fileName: 'haiku-messenger.apk',
  fileSize: 28500000,
  releaseNotes: 'Initial production build with Stitch UI, Left Rail navigation, and Neon Lakebase storage.',
  uploadedAt: new Date().toISOString(),
};

export async function getLatestApkRelease(): Promise<ApkRelease> {
  try {
    const raw = await readFile(latestConfigPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && parsed.downloadUrl) {
      inMemoryLatest = parsed;
      return parsed;
    }
  } catch {
    // Return in-memory fallback
  }
  return inMemoryLatest;
}

export async function setLatestApkRelease(release: ApkRelease): Promise<ApkRelease> {
  inMemoryLatest = release;
  try {
    await mkdir(localReleasesDir, { recursive: true });
    await writeFile(latestConfigPath, JSON.stringify(release, null, 2), 'utf8');
  } catch (err) {
    console.warn('[VercelBlob] Could not persist latest.json locally:', err);
  }
  return inMemoryLatest;
}

export async function uploadApkToVercelBlob(
  fileName: string,
  buffer: Buffer,
  metadata: { version: string; versionCode: number; releaseNotes?: string }
): Promise<ApkRelease> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  let downloadUrl = '';

  if (token) {
    // Official Vercel Blob upload
    const blob = await put(`apks/${fileName}`, buffer, {
      access: 'public',
      token,
      contentType: 'application/vnd.android.package-archive',
    });
    downloadUrl = blob.url;
  } else {
    // Local / fallback mode
    await mkdir(localReleasesDir, { recursive: true });
    const localFilePath = path.join(localReleasesDir, fileName);
    await writeFile(localFilePath, buffer);
    downloadUrl = `/v1/releases/download/${encodeURIComponent(fileName)}`;
  }

  const release: ApkRelease = {
    version: metadata.version || '1.0.0',
    versionCode: metadata.versionCode || 1,
    downloadUrl,
    fileName,
    fileSize: buffer.byteLength,
    releaseNotes: metadata.releaseNotes || 'New Haiku Messenger Android Release.',
    uploadedAt: new Date().toISOString(),
  };

  await setLatestApkRelease(release);
  return release;
}
