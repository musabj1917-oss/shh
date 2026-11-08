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

jest.mock('react-native-camera-kit', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Camera: React.forwardRef((props, ref) => {
      React.useImperativeHandle(ref, () => ({
        capture: jest.fn().mockResolvedValue({ uri: 'file://mock-photo.jpg' }),
        setFlashMode: jest.fn(),
      }));
      return React.createElement(View, props);
    }),
    CameraType: {
      Front: 'front',
      Back: 'back',
    },
  };
});

