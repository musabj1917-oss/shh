import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export interface ConfirmModalButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive' | 'primary';
  onPress?: () => void;
}

export interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message?: string;
  buttons?: ConfirmModalButton[];
  children?: React.ReactNode;
  onDismiss: () => void;
  style?: ViewStyle;
}

export function ConfirmModal({
  visible,
  title,
  message,
  buttons = [{ text: 'OK', style: 'primary' }],
  children,
  onDismiss,
  style,
}: ConfirmModalProps) {
  const { colors, radii, controls } = useTheme();

  if (!visible) return null;

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
            style,
          ]}
        >
          <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
          {message ? (
            <Text style={[styles.message, { color: colors.body }]}>{message}</Text>
          ) : null}

          {children ? <View style={styles.content}>{children}</View> : null}

          <View style={styles.buttonContainer}>
            {buttons.map((btn, idx) => {
              const isCancel = btn.style === 'cancel';
              const isDestructive = btn.style === 'destructive';
              const isPrimary = btn.style === 'primary' || (!isCancel && !isDestructive && idx === buttons.length - 1);

              let bgColor = colors.inputBg;
              let textColor = colors.ink;
              let borderColor = colors.line;

              if (isDestructive) {
                bgColor = colors.redWash;
                textColor = colors.red;
                borderColor = 'rgba(224, 108, 117, 0.3)';
              } else if (isPrimary) {
                bgColor = colors.mint;
                textColor = colors.mintContrast;
                borderColor = colors.mint;
              }

              return (
                <Pressable
                  key={`${btn.text}-${idx}`}
                  style={({ pressed }) => [
                    styles.button,
                    {
                      backgroundColor: bgColor,
                      borderColor,
                      borderWidth: 1,
                      borderRadius: radii.md,
                      minHeight: controls.heights.md,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                  onPress={() => {
                    onDismiss();
                    btn.onPress?.();
                  }}
                  accessibilityRole="button"
                >
                  <Text style={[styles.buttonText, { color: textColor }]}>
                    {btn.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
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
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    padding: 20,
    elevation: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  message: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  content: {
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
  button: {
    flexGrow: 1,
    flexBasis: 100,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
