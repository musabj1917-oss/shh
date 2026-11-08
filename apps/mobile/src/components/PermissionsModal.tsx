import React, { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { BrandMark } from './UI';
import {
  hasCompletedPermissionsFlow,
  markPermissionsFlowCompleted,
  requestAllCorePermissions,
} from '../permissions';

export function PermissionsModal() {
  const [visible, setVisible] = useState(false);
  const { colors, radii } = useTheme();

  useEffect(() => {
    let isMounted = true;
    async function checkInitialPermissions() {
      if (Platform.OS === 'web') return;
      try {
        const completed = await hasCompletedPermissionsFlow();
        if (!completed && isMounted) {
          setVisible(true);
        }
      } catch (err) {
        console.warn('Could not check permissions flow status:', err);
      }
    }
    void checkInitialPermissions();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleGrant = async () => {
    try {
      await requestAllCorePermissions();
    } finally {
      setVisible(false);
    }
  };

  const handleDismiss = async () => {
    try {
      await markPermissionsFlowCompleted();
    } finally {
      setVisible(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={handleDismiss}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.panelSolid,
              borderColor: colors.line,
              borderRadius: radii.xl,
            },
          ]}
        >
          <View style={styles.header}>
            <BrandMark size={48} />
            <Text style={[styles.title, { color: colors.ink }]}>
              Permissions
            </Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              Haiku needs a few permissions to help you capture photos, send voice notes, and receive instant message alerts.
            </Text>
          </View>

          <View style={styles.list}>
            <View style={styles.item}>
              <Text style={styles.icon}>📷</Text>
              <View style={styles.itemText}>
                <Text style={[styles.itemTitle, { color: colors.ink }]}>
                  Camera & Microphone
                </Text>
                <Text style={[styles.itemDesc, { color: colors.muted }]}>
                  For ephemeral photo and video moments.
                </Text>
              </View>
            </View>

            <View style={styles.item}>
              <Text style={styles.icon}>🖼️</Text>
              <View style={styles.itemText}>
                <Text style={[styles.itemTitle, { color: colors.ink }]}>
                  Photos & Media
                </Text>
                <Text style={[styles.itemDesc, { color: colors.muted }]}>
                  To choose and share photos from your device.
                </Text>
              </View>
            </View>

            <View style={styles.item}>
              <Text style={styles.icon}>🔔</Text>
              <View style={styles.itemText}>
                <Text style={[styles.itemTitle, { color: colors.ink }]}>
                  Notifications
                </Text>
                <Text style={[styles.itemDesc, { color: colors.muted }]}>
                  To alert you when friends reach out.
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={handleGrant}
              style={({ pressed }) => [
                styles.primaryButton,
                {
                  backgroundColor: colors.mint,
                  borderRadius: radii.md,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.primaryButtonText,
                  { color: colors.mintContrast },
                ]}
              >
                Grant Permissions
              </Text>
            </Pressable>

            <Pressable
              onPress={handleDismiss}
              style={({ pressed }) => [
                styles.secondaryButton,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Text
                style={[
                  styles.secondaryButtonText,
                  { color: colors.muted },
                ]}
              >
                Maybe Later
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  list: {
    gap: 14,
    marginBottom: 24,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: 24,
    width: 36,
  },
  itemText: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  itemDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  actions: {
    gap: 8,
  },
  primaryButton: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
