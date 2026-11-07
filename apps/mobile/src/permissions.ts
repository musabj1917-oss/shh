import { PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Camera } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
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
        const res = await Camera.getCameraPermissionsAsync();
        if (res.granted) return 'granted';
        if (!res.canAskAgain) return 'blocked';
        return 'denied';
      }
      case 'microphone': {
        const res = await Camera.getMicrophonePermissionsAsync();
        if (res.granted) return 'granted';
        if (!res.canAskAgain) return 'blocked';
        return 'denied';
      }
      case 'photos': {
        const res = await MediaLibrary.getPermissionsAsync();
        if (res.granted) return 'granted';
        if (!res.canAskAgain) return 'blocked';
        return 'denied';
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
          if (Platform.Version >= 33) {
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
        const res = await Camera.requestCameraPermissionsAsync();
        if (res.granted) return 'granted';
        return res.canAskAgain ? 'denied' : 'blocked';
      }
      case 'microphone': {
        const res = await Camera.requestMicrophonePermissionsAsync();
        if (res.granted) return 'granted';
        return res.canAskAgain ? 'denied' : 'blocked';
      }
      case 'photos': {
        const res = await MediaLibrary.requestPermissionsAsync();
        if (res.granted) return 'granted';
        return res.canAskAgain ? 'denied' : 'blocked';
      }
      case 'location': {
        if (Platform.OS === 'android') {
          // Foreground location only - DO NOT request background location!
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
          if (Platform.Version >= 33) {
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
