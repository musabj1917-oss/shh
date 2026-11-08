import { PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerPushToken } from './api/client';

export const PERMISSIONS_STORAGE_KEY = 'haiku.permissions.v1';

export type PermissionKind = 'camera' | 'microphone' | 'photos' | 'location' | 'notifications';
export type PermissionState = 'granted' | 'denied' | 'blocked';

export interface PermissionItem {
  key: PermissionKind;
  title: string;
  icon: string;
  description: string;
  state: PermissionState;
}

export async function hasCompletedPermissionsFlow(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(PERMISSIONS_STORAGE_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

export async function markPermissionsFlowCompleted(): Promise<void> {
  try {
    await AsyncStorage.setItem(PERMISSIONS_STORAGE_KEY, 'true');
  } catch {}
}

export async function checkPermission(kind: PermissionKind): Promise<PermissionState> {
  if (Platform.OS === 'web') {
    return 'granted';
  }

  try {
    switch (kind) {
      case 'camera': {
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
          return granted ? 'granted' : 'denied';
        }
        return 'granted';
      }
      case 'microphone': {
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
          return granted ? 'granted' : 'denied';
        }
        return 'granted';
      }
      case 'photos': {
        if (Platform.OS === 'android') {
          const perm =
            (Platform.Version as number) >= 33
              ? ('android.permission.READ_MEDIA_IMAGES' as any)
              : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
          const granted = await PermissionsAndroid.check(perm);
          return granted ? 'granted' : 'denied';
        }
        return 'granted';
      }
      case 'location': {
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          );
          return granted ? 'granted' : 'denied';
        }
        return 'granted';
      }
      case 'notifications': {
        if (Platform.OS === 'android') {
          if ((Platform.Version as number) >= 33) {
            const granted = await PermissionsAndroid.check(
              'android.permission.POST_NOTIFICATIONS' as any
            );
            return granted ? 'granted' : 'denied';
          }
          return 'granted';
        }
        return 'granted';
      }
    }
  } catch {
    return 'denied';
  }
}

export async function requestPermission(kind: PermissionKind): Promise<PermissionState> {
  if (Platform.OS === 'web') {
    return 'granted';
  }

  try {
    switch (kind) {
      case 'camera': {
        if (Platform.OS === 'android') {
          const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
            title: 'Camera Permission',
            message: 'Haiku Messenger captures ephemeral photos and videos.',
            buttonPositive: 'Allow',
            buttonNegative: 'Not now',
          });
          if (result === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
          if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'blocked';
          return 'denied';
        }
        return 'granted';
      }
      case 'microphone': {
        if (Platform.OS === 'android') {
          const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
            title: 'Microphone Permission',
            message: 'Allow Haiku Messenger to record audio with your video messages.',
            buttonPositive: 'Allow',
            buttonNegative: 'Not now',
          });
          if (result === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
          if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'blocked';
          return 'denied';
        }
        return 'granted';
      }
      case 'photos': {
        if (Platform.OS === 'android') {
          const perm =
            (Platform.Version as number) >= 33
              ? ('android.permission.READ_MEDIA_IMAGES' as any)
              : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
          const result = await PermissionsAndroid.request(perm, {
            title: 'Photo Library Permission',
            message: 'Allow Haiku Messenger to access your photos to share media.',
            buttonPositive: 'Allow',
            buttonNegative: 'Not now',
          });
          if (result === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
          if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'blocked';
          return 'denied';
        }
        return 'granted';
      }
      case 'location': {
        if (Platform.OS === 'android') {
          const result = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: 'Location Permission',
              message: 'Haiku Messenger needs foreground location to share your location pin with friends.',
              buttonPositive: 'Allow',
              buttonNegative: 'Not now',
            }
          );
          if (result === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
          if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'blocked';
          return 'denied';
        }
        return 'granted';
      }
      case 'notifications': {
        if (Platform.OS === 'android') {
          if ((Platform.Version as number) >= 33) {
            const result = await PermissionsAndroid.request(
              'android.permission.POST_NOTIFICATIONS' as any,
              {
                title: 'Notifications Permission',
                message: 'Allow Haiku Messenger to send you alerts for new direct messages and moments.',
                buttonPositive: 'Allow',
                buttonNegative: 'Not now',
              }
            );
            if (result === PermissionsAndroid.RESULTS.GRANTED) {
              void registerPushToken('fcm_android_token_registered', 'android').catch(() => {});
              return 'granted';
            }
            if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'blocked';
            return 'denied';
          }
          void registerPushToken('fcm_android_token_registered', 'android').catch(() => {});
          return 'granted';
        }
        return 'granted';
      }
    }
  } catch {
    return 'denied';
  }
}

export async function checkAllPermissions(): Promise<Record<PermissionKind, PermissionState>> {
  const [camera, microphone, photos, location, notifications] = await Promise.all([
    checkPermission('camera'),
    checkPermission('microphone'),
    checkPermission('photos'),
    checkPermission('location'),
    checkPermission('notifications'),
  ]);

  return { camera, microphone, photos, location, notifications };
}
