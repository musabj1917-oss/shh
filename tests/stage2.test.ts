import { describe, expect, it } from 'vitest';
import { validateMediaUpload } from '../apps/api/src/services/storage.js';
import { getDecoyConversations } from '../apps/api/src/services/decoy.js';

describe('Stage 2 Messaging and Safety Boundaries', () => {
  it('validates valid photo media uploads', () => {
    const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(() => validateMediaUpload('image', 'image/jpeg', validJpeg)).not.toThrow();
  });

  it('rejects oversized media uploads exceeding $0 cost limit constraints', () => {
    const hugeBuffer = Buffer.alloc(20 * 1024 * 1024); // 20MB
    expect(() => validateMediaUpload('image', 'image/jpeg', hugeBuffer)).toThrow('exceeds maximum allowed limit');
  });

  it('isolates synthetic conversations in Decoy environment', () => {
    const decoyChats = getDecoyConversations();
    expect(decoyChats.length).toBeGreaterThan(0);
    expect(decoyChats[0].id).toContain('decoy');
  });
});
