export const MEDIA_LIMITS = {
  IMAGE: {
    MAX_BYTES: 10 * 1024 * 1024, // 10 MB (Matches server media.ts line 29)
    MAX_LABEL: '10 MB',
    MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
    MAX_WIDTH: 2048,
    MAX_HEIGHT: 2048,
    COMPRESSION_QUALITY: 0.85,
  },
  AVATAR: {
    MAX_BYTES: 5 * 1024 * 1024, // 5 MB
    MAX_LABEL: '5 MB',
    MAX_WIDTH: 1024,
    MAX_HEIGHT: 1024,
    COMPRESSION_QUALITY: 0.85,
  },
  VIDEO: {
    MAX_BYTES: 50 * 1024 * 1024, // 50 MB (Matches server media.ts line 28)
    MAX_LABEL: '50 MB',
    MAX_DURATION_SECONDS: 60,
    MAX_DURATION_LABEL: '60s',
    MIME_TYPES: ['video/mp4', 'video/quicktime', 'video/webm'],
  },
  VOICE: {
    MAX_BYTES: 10 * 1024 * 1024, // 10 MB (Matches server media.ts line 30)
    MAX_LABEL: '10 MB',
    MAX_DURATION_SECONDS: 120,
    MAX_DURATION_LABEL: '2m',
    MIME_TYPES: ['audio/mp4', 'audio/webm', 'audio/ogg', 'audio/wav', 'audio/mpeg'],
  },
} as const;

export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateMediaSize(
  type: 'image' | 'video' | 'voice' | 'avatar',
  bytes: number
): { valid: boolean; error?: string } {
  const limit =
    type === 'avatar'
      ? MEDIA_LIMITS.AVATAR
      : type === 'image'
      ? MEDIA_LIMITS.IMAGE
      : type === 'video'
      ? MEDIA_LIMITS.VIDEO
      : MEDIA_LIMITS.VOICE;

  if (bytes > limit.MAX_BYTES) {
    const formattedActual = formatByteSize(bytes);
    const label =
      type === 'avatar'
        ? 'Profile picture'
        : type === 'image'
        ? 'Photo'
        : type === 'video'
        ? 'Video'
        : 'Voice note';
    return {
      valid: false,
      error: `${label} (${formattedActual}) exceeds the allowed limit of ${limit.MAX_LABEL}. Please choose a smaller file.`,
    };
  }
  return { valid: true };
}
