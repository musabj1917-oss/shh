import {
  checkAllPermissions,
  hasCompletedPermissionsFlow,
  markPermissionsFlowCompleted,
  PERMISSIONS_STORAGE_KEY,
} from '../src/permissions';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('permissions module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('checks if permissions flow has completed', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    expect(await hasCompletedPermissionsFlow()).toBe(false);

    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('true');
    expect(await hasCompletedPermissionsFlow()).toBe(true);
  });

  it('marks permissions flow as completed', async () => {
    await markPermissionsFlowCompleted();
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(PERMISSIONS_STORAGE_KEY, 'true');
  });

  it('checks all permission statuses without throwing', async () => {
    const statuses = await checkAllPermissions();
    expect(statuses).toHaveProperty('camera');
    expect(statuses).toHaveProperty('microphone');
    expect(statuses).toHaveProperty('photos');
    expect(statuses).toHaveProperty('location');
    expect(statuses).toHaveProperty('notifications');
  });
});
