/* global jest */
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve(null)),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve(null)),
  clear: jest.fn(() => Promise.resolve(null)),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve(null)),
  multiRemove: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Image: (props) => React.createElement(View, props),
  };
});

jest.mock('expo-constants', () => ({
  expoConfig: {
    version: '0.1.0',
    slug: 'haiku-messenger',
    name: 'HaikuMessenger',
  },
}));

jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn(() => Promise.resolve({ exists: true, size: 1024 })),
  uploadAsync: jest.fn(() => Promise.resolve({ status: 200 })),
  FileSystemUploadType: {
    BINARY_CONTENT: 1,
    MULTIPART: 2,
  },
}));

jest.mock('expo-camera', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    CameraView: (props) => React.createElement(View, props),
    useCameraPermissions: jest.fn(() => [{ granted: true, canAskAgain: true }, jest.fn()]),
    useMicrophonePermissions: jest.fn(() => [{ granted: true, canAskAgain: true }, jest.fn()]),
    Camera: {
      getCameraPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true, canAskAgain: true, status: 'granted' })),
      requestCameraPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true, canAskAgain: true, status: 'granted' })),
      getMicrophonePermissionsAsync: jest.fn(() => Promise.resolve({ granted: true, canAskAgain: true, status: 'granted' })),
      requestMicrophonePermissionsAsync: jest.fn(() => Promise.resolve({ granted: true, canAskAgain: true, status: 'granted' })),
    },
  };
});

jest.mock('expo-media-library', () => ({
  usePermissions: jest.fn(() => [{ granted: true, canAskAgain: true }, jest.fn()]),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true, status: 'granted' })),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true, status: 'granted' })),
  saveToLibraryAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    getItemAsync: jest.fn((key) => Promise.resolve(store.get(key) ?? null)),
    setItemAsync: jest.fn((key, value) => {
      store.set(key, String(value));
      return Promise.resolve();
    }),
    deleteItemAsync: jest.fn((key) => {
      store.delete(key);
      return Promise.resolve();
    }),
    isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  };
});

jest.mock('expo-dynamic-app-icon', () => ({
  setAppIcon: jest.fn(() => Promise.resolve('haiku')),
  getAppIcon: jest.fn(() => Promise.resolve('haiku')),
  supportsDynamicAppIcon: jest.fn(() => true),
}));

