import { query } from '../db.js';

export interface StorageAdapter {
  uploadMedia(
    ownerId: string,
    kind: 'image' | 'video' | 'audio',
    mimeType: string,
    buffer: Buffer
  ): Promise<{ mediaId: string; storageRef: string }>;
  getMediaUrl(storageRef: string): Promise<string>;
}

export const ALLOWED_MIME_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  video: ['video/mp4', 'video/webm'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/m4a']
};

export const MAX_FILE_SIZE_BYTES = {
  image: 5 * 1024 * 1024, // 5MB
  video: 15 * 1024 * 1024, // 15MB
  audio: 10 * 1024 * 1024 // 10MB
};

export function validateMediaUpload(
  kind: 'image' | 'video' | 'audio',
  mimeType: string,
  buffer: Buffer
) {
  const allowed = ALLOWED_MIME_TYPES[kind];
  if (!allowed || !allowed.includes(mimeType)) {
    throw new Error(`Invalid MIME type '${mimeType}' for media kind '${kind}'.`);
  }

  const maxSize = MAX_FILE_SIZE_BYTES[kind];
  if (buffer.length > maxSize) {
    throw new Error(`File size ${buffer.length} bytes exceeds maximum allowed limit of ${maxSize} bytes.`);
  }

  // Basic Magic Number Verification
  if (kind === 'image') {
    if (mimeType === 'image/jpeg' && (buffer[0] !== 0xff || buffer[1] !== 0xd8)) {
      throw new Error('Invalid JPEG file header.');
    }
    if (mimeType === 'image/png' && (buffer[0] !== 0x89 || buffer[1] !== 0x50)) {
      throw new Error('Invalid PNG file header.');
    }
  }
}

export class PrototypeNeonStorageAdapter implements StorageAdapter {
  async uploadMedia(
    ownerId: string,
    kind: 'image' | 'video' | 'audio',
    mimeType: string,
    buffer: Buffer
  ) {
    validateMediaUpload(kind, mimeType, buffer);

    const storageRef = `prototype_media_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const rows = await query<{ id: string }>(
      `INSERT INTO media_assets (owner_id, kind, mime_type, storage_ref, bytes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [ownerId, kind, mimeType, storageRef, buffer.length]
    );

    return { mediaId: rows[0].id, storageRef };
  }

  async getMediaUrl(storageRef: string): Promise<string> {
    const token = Math.random().toString(36).substring(2, 10);
    return `https://haiku-prototype-storage.internal/media/${storageRef}?token=${token}&expires=${Date.now() + 600000}`;
  }
}

export const mediaStorage = new PrototypeNeonStorageAdapter();
