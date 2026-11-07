import React, { useCallback, useEffect, useState } from 'react';
import {
  AppState,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeContext';
import {
  checkAllPermissions,
  markPermissionsFlowCompleted,
  PermissionKind,
  PermissionState,
  requestPermission,
} from '../permissions';

interface PermCardDef {
  kind: PermissionKind;
  icon: string;
  title: string;
  reason: string;
}

const PERMISSION_CARDS: PermCardDef[] = [
  {
    kind: 'camera',
    icon: '📷',
    title: 'Camera',
    reason: 'Take ephemeral photos and record 30-second videos for chats and stories.',
  },
  {
    kind: 'microphone',
    icon: '🎙️',
    title: 'Microphone',
    reason: 'Record clear audio with your video captures and send voice notes.',
  },
  {
    kind: 'photos',
    icon: '🖼️',
    title: 'Photos & Media Library',
    reason: 'Save photos you receive and attach images from your device gallery.',
  },
  {
    kind: 'location',
    icon: '📍',
    title: 'Location (Foreground)',
    reason: 'Share current location pins in conversation. Background tracking is never used.',
  },
  {
    kind: 'notifications',
    icon: '🔔',
    title: 'Notifications',
    reason: 'Stay in the loop with instant alerts when friends message you or reply.',
  },
];

export function PermissionsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { colors, radii } = useTheme();

  const [statuses, setStatuses] = useState<Record<PermissionKind, PermissionState>>({
    camera: 'denied',
    microphone: 'denied',
    photos: 'denied',
    location: 'denied',
    notifications: 'denied',
  });
  const [requesting, setRequesting] = useState(false);

  const refreshStatuses = useCallback(async () => {
    const res = await checkAllPermissions();
    setStatuses(res);
  }, []);

  useEffect(() => {
    void refreshStatuses();
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void refreshStatuses();
      }
    });
    return () => sub.remove();
  }, [refreshStatuses]);

  const requestAllSequence = useCallback(async () => {
    setRequesting(true);
    try {
      for (const card of PERMISSION_CARDS) {
        if (statuses[card.kind] !== 'granted') {
          const newState = await requestPermission(card.kind);
          setStatuses((prev) => ({ ...prev, [card.kind]: newState }));
        }
      }
    } finally {
      setRequesting(false);
      await markPermissionsFlowCompleted();
      navigation.replace('Main');
    }
  }, [statuses, navigation]);

  const dismissAndContinue = useCallback(async () => {
    await markPermissionsFlowCompleted();
    navigation.replace('Main');
  }, [navigation]);

  const requestSingle = useCallback(async (kind: PermissionKind) => {
    const newState = await requestPermission(kind);
    setStatuses((prev) => ({ ...prev, [kind]: newState }));
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.canvas }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: Math.max(insets.top, 20) + 10,
          paddingBottom: Math.max(insets.bottom, 24) + 90,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 26, fontWeight: '900', color: colors.ink, letterSpacing: -0.5 }}>
            Welcome to Haiku
          </Text>
          <Text style={{ fontSize: 14, color: colors.muted, lineHeight: 21, marginTop: 6 }}>
            To give you a weightless, private messaging experience, Haiku Messenger requests access to the following device features.
          </Text>
        </View>

        {/* Permission Cards */}
        <View style={{ gap: 12 }}>
          {PERMISSION_CARDS.map((card) => {
            const state = statuses[card.kind];
            const isGranted = state === 'granted';
            const isBlocked = state === 'blocked';

            return (
              <View
                key={card.kind}
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.panel,
                    borderColor: isGranted ? colors.mint : colors.line,
                    borderRadius: radii.xl,
                  },
                ]}
              >
                <View style={styles.cardHeader}>
                  <Text style={{ fontSize: 26, marginRight: 12 }}>{card.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.ink }}>
                      {card.title}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 17 }}>
                      {card.reason}
                    </Text>
                  </View>
                </View>

                {/* Status Indicator & Individual Action */}
                <View style={[styles.cardFooter, { borderTopColor: colors.line }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor: isGranted ? colors.mint : isBlocked ? colors.red : colors.muted,
                        },
                      ]}
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: isGranted ? colors.mint : isBlocked ? colors.red : colors.muted,
                        textTransform: 'capitalize',
                      }}
                    >
                      {state}
                    </Text>
                  </View>

                  {isBlocked ? (
                    <Pressable
                      onPress={() => Linking.openSettings()}
                      style={[styles.smallBtn, { backgroundColor: colors.card, borderColor: colors.line }]}
                    >
                      <Text style={{ color: colors.ink, fontSize: 12, fontWeight: '600' }}>Open Settings</Text>
                    </Pressable>
                  ) : !isGranted ? (
                    <Pressable
                      onPress={() => requestSingle(card.kind)}
                      style={[styles.smallBtn, { backgroundColor: colors.mintWash, borderColor: colors.mint }]}
                    >
                      <Text style={{ color: colors.mint, fontSize: 12, fontWeight: '700' }}>Enable</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Sticky Bottom Actions */}
      <View
        style={[
          styles.bottomBar,
          {
            paddingBottom: Math.max(insets.bottom, 16),
            backgroundColor: colors.panelSolid,
            borderTopColor: colors.line,
          },
        ]}
      >
        <Pressable
          onPress={requestAllSequence}
          disabled={requesting}
          style={({ pressed }) => [
            styles.allowAllBtn,
            { backgroundColor: colors.mint },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={{ color: colors.mintContrast, fontWeight: '800', fontSize: 16 }}>
            {requesting ? 'Requesting…' : 'Allow All'}
          </Text>
        </Pressable>

        <Pressable
          onPress={dismissAndContinue}
          style={{ paddingVertical: 10, alignItems: 'center' }}
        >
          <Text style={{ color: colors.muted, fontWeight: '600', fontSize: 14 }}>Not now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  smallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 4,
  },
  allowAllBtn: {
    paddingVertical: 15,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
