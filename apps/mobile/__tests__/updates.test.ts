import { checkAppUpdate, dismissUpdateVersion } from '../src/updates';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('updates module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('remembers dismissed version in AsyncStorage', async () => {
    await dismissUpdateVersion('0.10.0');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'haiku.dismissed_update_version',
      '0.10.0'
    );
  });

  it('fails silently and returns null when offline', async () => {
    // When fetch fails, checkAppUpdate should return null without throwing
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockRejectedValue(new Error('Offline'));
    try {
      const result = await checkAppUpdate(true);
      expect(result).toBeNull();
    } finally {
      global.fetch = originalFetch;
    }
  });
});
