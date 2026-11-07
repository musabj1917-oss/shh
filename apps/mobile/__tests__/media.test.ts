import { mediaCache, fetchMediaUrl } from '../src/media';

describe('media cache and deduping', () => {
  beforeEach(() => {
    mediaCache.clear();
  });

  it('synchronously reads from cache if present', () => {
    mediaCache.set('media-1', { url: 'https://cdn.haiku.internal/photo.jpg' });
    expect(mediaCache.get('media-1')?.url).toBe('https://cdn.haiku.internal/photo.jpg');
  });

  it('fetchMediaUrl returns cached url without refetching', async () => {
    mediaCache.set('media-2', { url: 'https://cdn.haiku.internal/cached.jpg' });
    const url = await fetchMediaUrl('media-2');
    expect(url).toBe('https://cdn.haiku.internal/cached.jpg');
  });

  it('returns null for empty id', async () => {
    const url = await fetchMediaUrl('');
    expect(url).toBeNull();
  });
});
