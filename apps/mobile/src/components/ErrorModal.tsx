import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { mapErrorToUserFriendly, UserFriendlyError } from '@haiku/contracts';
import { useTheme } from '../theme/ThemeContext';
import { useEscapeKey } from '../theme/webStyles';

export interface ErrorModalProps {
  visible: boolean;
  error?: unknown;
  friendlyError?: UserFriendlyError;
  onRetry?: () => void;
  onDismiss: () => void;
  retryLabel?: string;
  dismissLabel?: string;
}

export function ErrorModal({
  visible,
  error,
  friendlyError,
  onRetry,
  onDismiss,
  retryLabel = 'Try Again',
  dismissLabel = 'Dismiss',
}: ErrorModalProps) {
  const { colors, typography, radii, controls } = useTheme();
  const [showDetails, setShowDetails] = useState(false);

  useEscapeKey(onDismiss, visible);

  if (!visible) return null;

  const data = friendlyError || mapErrorToUserFriendly(error);

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onDismiss}
    >
      <View style={[styles.overlay, { backgroundColor: colors.scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.line,
              borderRadius: radii.xxl,
            },
          ]}
        >
          {/* Signal Indicator Badge (Zero Emojis) */}
          <View
            style={[
              styles.illustrationOrb,
              {
                backgroundColor: colors.mintWash,
                borderColor: colors.stitchGlow,
              },
            ]}
          >
            <Text style={{ fontSize: 24, color: colors.mint, fontWeight: '800' }}>!</Text>
          </View>

          {/* Typography */}
          <Text style={[styles.title, { color: colors.ink }]}>{data.title}</Text>
          <Text style={[styles.message, { color: colors.body }]}>{data.message}</Text>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: colors.inputBg,
                  borderWidth: 1,
                  borderColor: colors.line,
                  borderRadius: radii.md,
                  height: controls.heights.md,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              onPress={onDismiss}
              accessibilityRole="button"
            >
              <Text style={[styles.buttonText, { color: colors.ink }]}>{dismissLabel}</Text>
            </Pressable>

            {onRetry ? (
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  {
                    backgroundColor: colors.mint,
                    borderRadius: radii.md,
                    height: controls.heights.md,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                onPress={() => {
                  onRetry();
                  onDismiss();
                }}
                accessibilityRole="button"
              >
                <Text style={[styles.buttonText, { color: colors.mintContrast }]}>{retryLabel}</Text>
              </Pressable>
            ) : null}
          </View>

          {/* Technical Details Accordion */}
          {data.technicalDetails ? (
            <View style={[styles.accordionContainer, { borderTopColor: colors.line }]}>
              <Pressable
                style={styles.accordionToggle}
                onPress={() => setShowDetails(!showDetails)}
                accessibilityRole="button"
              >
                <Text style={[styles.accordionToggleText, { color: colors.muted }]}>
                  {showDetails ? 'Hide technical details ▲' : 'Technical details ▼'}
                </Text>
              </Pressable>

              {showDetails ? (
                <View
                  style={[
                    styles.accordionContent,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.line,
                      borderRadius: radii.sm,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.detailsText,
                      {
                        color: colors.body,
                        fontFamily: typography.fonts.mono,
                      },
                    ]}
                    selectable
                  >
                    {data.technicalDetails}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    elevation: 12,
  },
  illustrationOrb: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  accordionContainer: {
    width: '100%',
    marginTop: 16,
    borderTopWidth: 1,
    paddingTop: 12,
    alignItems: 'center',
  },
  accordionToggle: {
    paddingVertical: 4,
  },
  accordionToggleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  accordionContent: {
    width: '100%',
    borderWidth: 1,
    padding: 10,
    marginTop: 8,
  },
  detailsText: {
    fontSize: 11,
    lineHeight: 16,
  },
});
