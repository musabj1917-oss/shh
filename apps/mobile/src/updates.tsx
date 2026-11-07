import React, { useCallback, useEffect, useState } from 'react';
import {
  AppState,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from './api/client';
import { useTheme } from './theme/ThemeContext';
import { BrandMark, Button } from './components/UI';

const DISMISSED_VERSION_KEY = 'haiku.dismissed_update_version';
const LAST_CHECK_KEY = 'haiku.last_update_check_time';
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export interface AppVersionInfo {
  updateAvailable: boolean;
  forceUpdate: boolean;
  latestVersion: string;
  minSupportedVersion: string;
  downloadUrl: string;
  releaseNotes: string | null;
}

export async function checkAppUpdate(force = false): Promise<AppVersionInfo | null> {
  try {
    const now = Date.now();
    if (!force) {
      const lastCheck = await AsyncStorage.getItem(LAST_CHECK_KEY);
      if (lastCheck && now - Number(lastCheck) < SIX_HOURS_MS) {
        return null;
      }
    }

    const currentVersion = Constants.expoConfig?.version || '0.1.0';
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';

    const info = await api<AppVersionInfo>(
      `/app/version?platform=${platform}&version=${encodeURIComponent(currentVersion)}`,
      { anonymous: true }
    );

    await AsyncStorage.setItem(LAST_CHECK_KEY, String(now));

    if (!info?.updateAvailable && !info?.forceUpdate) {
      return null;
    }

    if (!info.forceUpdate) {
      const dismissed = await AsyncStorage.getItem(DISMISSED_VERSION_KEY);
      if (dismissed === info.latestVersion) {
        return null;
      }
    }

    return info;
  } catch {
    // Fail silently when offline or server unreachable
    return null;
  }
}

export async function dismissUpdateVersion(version: string): Promise<void> {
  try {
    await AsyncStorage.setItem(DISMISSED_VERSION_KEY, version);
  } catch {}
}

export function UpdateGate({ children }: { children?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { colors, radii } = useTheme();

  const [updateInfo, setUpdateInfo] = useState<AppVersionInfo | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const performCheck = useCallback(async (forced = false) => {
    const res = await checkAppUpdate(forced);
    if (res && (res.updateAvailable || res.forceUpdate)) {
      setUpdateInfo(res);
      setModalVisible(true);
    }
  }, []);

  useEffect(() => {
    void performCheck();

    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void performCheck();
      }
    });

    return () => sub.remove();
  }, [performCheck]);

  const handleUpdate = useCallback(() => {
    if (updateInfo?.downloadUrl) {
      void Linking.openURL(updateInfo.downloadUrl);
    }
  }, [updateInfo]);

  const handleLater = useCallback(async () => {
    if (updateInfo?.latestVersion) {
      await dismissUpdateVersion(updateInfo.latestVersion);
    }
    setModalVisible(false);
  }, [updateInfo]);

  const isForced = Boolean(updateInfo?.forceUpdate);

  return (
    <>
      {children}

      {/* Forced Update Blocking Modal */}
      {isForced && modalVisible && updateInfo ? (
        <Modal
          visible={true}
          transparent={false}
          animationType="fade"
          onRequestClose={() => {}}
        >
          <View
            style={[
              styles.forcedContainer,
              {
                backgroundColor: colors.canvas,
                paddingTop: Math.max(insets.top, 24) + 20,
                paddingBottom: Math.max(insets.bottom, 24) + 16,
                paddingHorizontal: 24,
              },
            ]}
          >
            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              <BrandMark size={64} />
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: '900',
                  color: colors.ink,
                  marginTop: 20,
                  textAlign: 'center',
                }}
              >
                Update Required
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: colors.muted,
                  textAlign: 'center',
                  marginTop: 8,
                  lineHeight: 20,
                }}
              >
                A vital security and protocol update is required to continue using Haiku Messenger.
              </Text>
            </View>

            <View
              style={[
                styles.notesCard,
                {
                  backgroundColor: colors.panel,
                  borderColor: colors.line,
                  borderRadius: radii.xl,
                },
              ]}
            >
              <Text style={{ fontSize: 13, fontWeight: '800', color: colors.mint, marginBottom: 6 }}>
                Version {updateInfo.latestVersion}
              </Text>
              <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false}>
                <Text style={{ fontSize: 13, color: colors.body, lineHeight: 19 }}>
                  {updateInfo.releaseNotes || 'Important stability and security enhancements.'}
                </Text>
              </ScrollView>
            </View>

            <View style={{ marginTop: 'auto', width: '100%' }}>
              <Button
                title={`Update to ${updateInfo.latestVersion}`}
                kind="primary"
                onPress={handleUpdate}
              />
            </View>
          </View>
        </Modal>
      ) : null}

      {/* Optional Update Dismissible Bottom Sheet */}
      {!isForced && modalVisible && updateInfo ? (
        <Modal
          visible={true}
          transparent={true}
          animationType="slide"
          onRequestClose={handleLater}
        >
          <View style={styles.sheetBackdrop}>
            <View
              style={[
                styles.sheetContent,
                {
                  backgroundColor: colors.panelSolid,
                  borderTopColor: colors.line,
                  paddingBottom: Math.max(insets.bottom, 20) + 10,
                  paddingHorizontal: 20,
                },
              ]}
            >
              <View style={styles.sheetHandle} />

              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: colors.ink }}>
                  New Update Available
                </Text>
                <Text style={{ fontSize: 13, color: colors.mint, fontWeight: '700', marginTop: 4 }}>
                  Haiku Messenger {updateInfo.latestVersion}
                </Text>
              </View>

              {updateInfo.releaseNotes ? (
                <View
                  style={[
                    styles.notesCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.line,
                      borderRadius: radii.lg,
                      marginBottom: 20,
                    },
                  ]}
                >
                  <ScrollView style={{ maxHeight: 140 }} showsVerticalScrollIndicator={false}>
                    <Text style={{ fontSize: 13, color: colors.body, lineHeight: 19 }}>
                      {updateInfo.releaseNotes}
                    </Text>
                  </ScrollView>
                </View>
              ) : null}

              <View style={{ gap: 10 }}>
                <Button title="Update Now" kind="primary" onPress={handleUpdate} />
                <Button title="Later" kind="ghost" onPress={handleLater} />
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  forcedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notesCard: {
    width: '100%',
    padding: 16,
    borderWidth: 1,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheetContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignSelf: 'center',
    marginBottom: 16,
  },
});
