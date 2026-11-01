import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { mapErrorToUserFriendly, UserFriendlyError } from '@haiku/contracts';

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
  const [showDetails, setShowDetails] = useState(false);

  if (!visible) return null;

  const data = friendlyError || mapErrorToUserFriendly(error);

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onDismiss} />

        <View style={styles.card}>
          {/* Custom Weightless Illustration */}
          <View style={styles.illustrationContainer}>
            <View style={styles.illustrationOrb}>
              <View style={styles.illustrationPlanet}>
                <Text style={styles.illustrationEmoji}>🪐</Text>
              </View>
              <View style={styles.illustrationSignal}>
                <Text style={styles.illustrationSignalEmoji}>⚡</Text>
              </View>
            </View>
          </View>

          {/* Typography */}
          <Text style={styles.title}>{data.title}</Text>
          <Text style={styles.message}>{data.message}</Text>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={onDismiss}
            >
              <Text style={styles.secondaryButtonText}>{dismissLabel}</Text>
            </Pressable>

            {onRetry ? (
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => {
                  onRetry();
                  onDismiss();
                }}
              >
                <Text style={styles.primaryButtonText}>{retryLabel}</Text>
              </Pressable>
            ) : null}
          </View>

          {/* Technical Details Accordion */}
          {data.technicalDetails ? (
            <View style={styles.accordionContainer}>
              <Pressable
                style={styles.accordionToggle}
                onPress={() => setShowDetails(!showDetails)}
              >
                <Text style={styles.accordionToggleText}>
                  {showDetails ? 'Hide technical details ▲' : 'Technical details ▼'}
                </Text>
              </Pressable>

              {showDetails ? (
                <View style={styles.accordionContent}>
                  <Text style={styles.detailsText} selectable>
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: 'rgba(23, 23, 23, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.6,
    shadowRadius: 50,
    elevation: 16,
  },
  illustrationContainer: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  illustrationOrb: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(153, 227, 36, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(153, 227, 36, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  illustrationPlanet: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationEmoji: {
    fontSize: 34,
  },
  illustrationSignal: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#99e324',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#99e324',
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 3,
  },
  illustrationSignalEmoji: {
    fontSize: 10,
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  message: {
    color: '#d4d4d4',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  primaryButton: {
    flex: 1,
    height: 48,
    backgroundColor: '#99e324',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#99e324',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#0d140e',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    height: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  accordionContainer: {
    width: '100%',
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 12,
    alignItems: 'center',
  },
  accordionToggle: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  accordionToggleText: {
    color: '#737373',
    fontSize: 12,
    fontWeight: '500',
  },
  accordionContent: {
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  detailsText: {
    color: '#a3a3a3',
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
});
