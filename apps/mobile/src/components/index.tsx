import React from 'react';
import {
  Text,
  TouchableOpacity,
  TextInput,
  View,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacityProps,
  TextInputProps
} from 'react-native';
import { palette, spacing } from '../theme';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  loading?: boolean;
}

export function Button({ title, variant = 'primary', loading, style, disabled, ...props }: ButtonProps) {
  const buttonStyle = [
    styles.button,
    variant === 'primary' && styles.buttonPrimary,
    variant === 'secondary' && styles.buttonSecondary,
    variant === 'outline' && styles.buttonOutline,
    variant === 'danger' && styles.buttonDanger,
    (disabled || loading) && styles.buttonDisabled,
    style
  ];

  const textStyle = [
    styles.buttonText,
    variant === 'primary' && styles.textWhite,
    variant === 'secondary' && styles.textTeal,
    variant === 'outline' && styles.textTeal,
    variant === 'danger' && styles.textWhite
  ];

  return (
    <TouchableOpacity style={buttonStyle} disabled={disabled || loading} {...props}>
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' || variant === 'outline' ? palette.teal : palette.white} />
      ) : (
        <Text style={textStyle}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, ...props }: InputProps) {
  return (
    <View style={styles.inputContainer}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[styles.input, error ? styles.inputError : null, style]}
        placeholderTextColor={palette.muted}
        {...props}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.xs
  },
  buttonPrimary: {
    backgroundColor: palette.teal
  },
  buttonSecondary: {
    backgroundColor: palette.mint
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: palette.teal
  },
  buttonDanger: {
    backgroundColor: palette.danger
  },
  buttonDisabled: {
    opacity: 0.6
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600'
  },
  textWhite: {
    color: palette.white
  },
  textTeal: {
    color: palette.tealDark
  },
  inputContainer: {
    marginVertical: spacing.xs,
    width: '100%'
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.tealDark,
    marginBottom: 4
  },
  input: {
    backgroundColor: palette.soft,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: palette.ink,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  inputError: {
    borderColor: palette.danger
  },
  errorText: {
    color: palette.danger,
    fontSize: 12,
    marginTop: 2
  },
  card: {
    backgroundColor: palette.cardBg,
    borderRadius: 16,
    padding: spacing.md,
    marginVertical: spacing.xs,
    borderWidth: 1,
    borderColor: palette.soft
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.tealDark,
    marginBottom: spacing.xs
  },
  emptyDescription: {
    fontSize: 15,
    color: palette.muted,
    textAlign: 'center',
    lineHeight: 22
  }
});
