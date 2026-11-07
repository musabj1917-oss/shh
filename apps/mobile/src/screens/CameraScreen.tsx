import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { launchImageLibrary } from 'react-native-image-picker';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeContext';
import { useImmersive } from '../system/immersive';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export function CameraScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { colors, radii } = useTheme();
  const isFocused = useIsFocused();
  const { setImmersive } = useImmersive();

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('off');
  const [grid, setGrid] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);

  const cameraRef = useRef<any>(null);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const focusAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isFocused) {
      void setImmersive(true);
    } else {
      void setImmersive(false);
    }
  }, [isFocused, setImmersive]);

  useEffect(() => {
    return () => {
      if (recordTimer.current) clearInterval(recordTimer.current);
    };
  }, []);

  const flipCamera = useCallback(() => {
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  }, []);

  const cycleFlash = useCallback(() => {
    setFlash((prev) => (prev === 'off' ? 'on' : prev === 'on' ? 'auto' : 'off'));
  }, []);

  const toggleGrid = useCallback(() => {
    setGrid((prev) => !prev);
  }, []);

  const handleTapToFocus = useCallback(
    (event: any) => {
      const { locationX, locationY } = event.nativeEvent;
      setFocusPoint({ x: locationX, y: locationY });
      focusAnim.setValue(1);
      Animated.timing(focusAnim, {
        toValue: 0,
        duration: 1200,
        useNativeDriver: Platform.OS !== 'web',
      }).start(() => {
        setFocusPoint(null);
      });
    },
    [focusAnim]
  );

  const takePhoto = useCallback(async () => {
    if (!cameraRef.current || isRecording) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });
      if (photo?.uri) {
        navigation.navigate('CameraPreview', {
          uri: photo.uri,
          mediaType: 'photo',
        });
      }
    } catch (e) {
      console.warn('Take photo failed', e);
    }
  }, [isRecording, navigation]);

  const startRecording = useCallback(async () => {
    if (!cameraRef.current || isRecording) return;
    try {
      setIsRecording(true);
      setRecordingSeconds(0);
      recordTimer.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 29) {
            stopRecording();
            return 30;
          }
          return prev + 1;
        });
      }, 1000);

      const video = await cameraRef.current.recordAsync({
        maxDuration: 30,
      });
      if (video?.uri) {
        navigation.navigate('CameraPreview', {
          uri: video.uri,
          mediaType: 'video',
        });
      }
    } catch (e) {
      console.warn('Record video failed', e);
    } finally {
      setIsRecording(false);
      if (recordTimer.current) {
        clearInterval(recordTimer.current);
        recordTimer.current = null;
      }
    }
  }, [isRecording, navigation]);

  const stopRecording = useCallback(() => {
    if (cameraRef.current && isRecording) {
      cameraRef.current.stopRecording();
      setIsRecording(false);
      if (recordTimer.current) {
        clearInterval(recordTimer.current);
        recordTimer.current = null;
      }
    }
  }, [isRecording]);

  const pickFromGallery = useCallback(async () => {
    const res = await launchImageLibrary({
      mediaType: 'mixed',
      selectionLimit: 1,
      quality: 0.8,
    });
    const asset = res.assets?.[0];
    if (res.didCancel || !asset?.uri) return;
    const uri = asset.uri;
    const isVideo = asset.type?.startsWith('video') || uri.endsWith('.mp4') || uri.endsWith('.mov');
    navigation.navigate('CameraPreview', {
      uri,
      mediaType: isVideo ? 'video' : 'photo',
    });
  }, [navigation]);

  // Permission not granted state
  const hasCameraPerm = cameraPermission?.granted;
  const hasMicPerm = micPermission?.granted;

  if (!hasCameraPerm || !hasMicPerm) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: '#0A0E0D',
            paddingTop: insets.top + 40,
            paddingBottom: insets.bottom + 20,
            paddingHorizontal: 24,
            justifyContent: 'center',
            alignItems: 'center',
          },
        ]}
      >
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: 'rgba(255,255,255,0.06)',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
          }}
        >
          <Text style={{ fontSize: 36 }}>📷</Text>
        </View>

        <Text style={{ fontSize: 22, fontWeight: '800', color: '#F4FAF7', textAlign: 'center', marginBottom: 10 }}>
          Camera & Audio Access
        </Text>
        <Text
          style={{
            fontSize: 14,
            lineHeight: 22,
            color: '#8E9C96',
            textAlign: 'center',
            marginBottom: 32,
            maxWidth: 300,
          }}
        >
          Haiku Messenger captures ephemeral photos and videos. Allow camera and microphone permissions to begin.
        </Text>

        <Pressable
          onPress={async () => {
            const camRes = await requestCameraPermission();
            const micRes = await requestMicPermission();
            if (!camRes.granted || !micRes.granted) {
              await Linking.openSettings();
            }
          }}
          style={({ pressed }) => [
            {
              width: '100%',
              maxWidth: 320,
              paddingVertical: 14,
              borderRadius: radii.xl,
              backgroundColor: colors.mint,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.8 : 1,
              marginBottom: 12,
            },
          ]}
        >
          <Text style={{ color: colors.mintContrast, fontWeight: '700', fontSize: 16 }}>Grant Permissions</Text>
        </Pressable>

        <Pressable
          onPress={() => Linking.openSettings()}
          style={({ pressed }) => [
            {
              width: '100%',
              maxWidth: 320,
              paddingVertical: 14,
              borderRadius: radii.xl,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.15)',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <Text style={{ color: '#F4FAF7', fontWeight: '600', fontSize: 15 }}>Open Settings</Text>
        </Pressable>

        <Pressable
          onPress={pickFromGallery}
          style={{ marginTop: 24, paddingVertical: 8 }}
        >
          <Text style={{ color: colors.mint, fontSize: 14, fontWeight: '600' }}>Pick from photo gallery instead</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isFocused ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          flash={flash}
          zoom={zoom}
          mode="video"
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleTapToFocus}
          >
            {/* Rule-of-thirds Grid Overlay */}
            {grid ? (
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <View style={[styles.gridLineHorizontal, { top: '33.33%' }]} />
                <View style={[styles.gridLineHorizontal, { top: '66.66%' }]} />
                <View style={[styles.gridLineVertical, { left: '33.33%' }]} />
                <View style={[styles.gridLineVertical, { left: '66.66%' }]} />
              </View>
            ) : null}

            {/* Tap to Focus Indicator */}
            {focusPoint ? (
              <Animated.View
                style={[
                  styles.focusBox,
                  {
                    left: focusPoint.x - 30,
                    top: focusPoint.y - 30,
                    opacity: focusAnim,
                    transform: [{ scale: focusAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.1] }) }],
                  },
                ]}
              />
            ) : null}
          </Pressable>
        </CameraView>
      ) : null}

      {/* Top Controls Bar */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: Math.max(insets.top, 16),
            paddingLeft: Math.max(insets.left, 16),
            paddingRight: Math.max(insets.right, 16),
          },
        ]}
      >
        <Pressable
          onPress={cycleFlash}
          style={styles.iconButton}
          accessibilityLabel={`Flash ${flash}`}
        >
          <Text style={styles.iconButtonText}>
            {flash === 'on' ? '⚡ On' : flash === 'auto' ? '⚡ Auto' : '⚡ Off'}
          </Text>
        </Pressable>

        <Pressable
          onPress={toggleGrid}
          style={styles.iconButton}
          accessibilityLabel="Toggle grid"
        >
          <Text style={styles.iconButtonText}>{grid ? 'Grid On' : 'Grid Off'}</Text>
        </Pressable>

        <Pressable
          onPress={flipCamera}
          style={styles.iconButton}
          accessibilityLabel="Flip camera"
        >
          <Text style={styles.iconButtonText}>🔄 Flip</Text>
        </Pressable>
      </View>

      {/* Zoom Selector */}
      <View style={styles.zoomContainer}>
        {[0, 0.5, 1].map((level) => (
          <Pressable
            key={level}
            onPress={() => setZoom(level)}
            style={[styles.zoomPill, zoom === level && styles.zoomPillActive]}
          >
            <Text style={[styles.zoomText, zoom === level && styles.zoomTextActive]}>
              {level === 0 ? '1x' : level === 0.5 ? '2x' : '3x'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Recording Duration Indicator */}
      {isRecording ? (
        <View style={styles.recordingBadge}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>0:{recordingSeconds.toString().padStart(2, '0')} / 0:30</Text>
        </View>
      ) : null}

      {/* Bottom Shutter & Gallery Bar */}
      <View
        style={[
          styles.bottomBar,
          {
            paddingBottom: Math.max(insets.bottom, 24),
            paddingLeft: Math.max(insets.left, 24),
            paddingRight: Math.max(insets.right, 24),
          },
        ]}
      >
        {/* Gallery Button */}
        <Pressable
          onPress={pickFromGallery}
          style={styles.galleryButton}
          accessibilityLabel="Choose from gallery"
        >
          <Text style={{ fontSize: 24 }}>🖼️</Text>
        </Pressable>

        {/* Shutter Button (Tap = Photo, Long Press = Video up to 30s) */}
        <View style={styles.shutterContainer}>
          {isRecording ? (
            <View
              style={[
                styles.recordingRing,
                {
                  transform: [{ scale: 1.15 }],
                  borderColor: '#EF4444',
                },
              ]}
            />
          ) : null}

          <Pressable
            onPress={takePhoto}
            onLongPress={startRecording}
            onPressOut={stopRecording}
            delayLongPress={250}
            style={({ pressed }) => [
              styles.shutterButton,
              isRecording && styles.shutterRecording,
              pressed && !isRecording && styles.shutterPressed,
            ]}
            accessibilityLabel="Capture photo or hold for video"
          >
            <View
              style={[
                styles.shutterInner,
                isRecording && styles.shutterInnerRecording,
              ]}
            />
          </Pressable>
        </View>

        {/* Placeholder spacer */}
        <View style={{ width: 48, height: 48 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  iconButton: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  iconButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  zoomContainer: {
    position: 'absolute',
    bottom: 140,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    zIndex: 10,
  },
  zoomPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  zoomPillActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  zoomText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '700',
  },
  zoomTextActive: {
    color: '#ffffff',
  },
  recordingBadge: {
    position: 'absolute',
    top: 90,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
    zIndex: 10,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffffff',
  },
  recordingText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    zIndex: 10,
  },
  galleryButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterContainer: {
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  recordingRing: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
  },
  shutterButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  shutterPressed: {
    transform: [{ scale: 0.95 }],
  },
  shutterRecording: {
    borderColor: '#EF4444',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ffffff',
  },
  shutterInnerRecording: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EF4444',
  },
  gridLineHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  gridLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  focusBox: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderWidth: 1.5,
    borderColor: '#FDE047',
    borderRadius: 8,
  },
});
