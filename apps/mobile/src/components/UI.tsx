import React from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput as NativeTextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';

export { ErrorModal } from './ErrorModal';
export { ErrorBoundary } from './ErrorBoundary';
export { ConfirmModal } from './ConfirmModal';
export { NewChatModal } from './NewChatModal';
export type { ConfirmModalButton, ConfirmModalProps } from './ConfirmModal';

export function Screen({
  children,
  scroll = false,
  style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  return (
    <SafeAreaView
      style={[{ flex: 1, backgroundColor: colors.canvas }, style]}
      edges={['top', 'left', 'right']}
    >
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 18, paddingBottom: 36 }}
        >
          {children}
        </ScrollView>
      ) : (
        children
      )}
    </SafeAreaView>
  );
}

export function BrandMark({ size = 38, style }: { size?: number; style?: ViewStyle }) {
  const { colors } = useTheme();
  const lineHeight = Math.max(2, Math.round(size * 0.08));
  const lineGap = Math.max(2, Math.round(size * 0.06));
  const lineRadius = Math.round(lineHeight / 2);
  const strokeColor = colors.mintContrast;

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.28),
          backgroundColor: colors.mint,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: colors.mint,
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 4,
          paddingHorizontal: Math.round(size * 0.18),
        },
        style,
      ]}
    >
      {/* 5-7-5 Haiku poetic speech bubble lines */}
      <View
        style={{
          width: '56%',
          height: lineHeight,
          borderRadius: lineRadius,
          backgroundColor: strokeColor,
          marginBottom: lineGap,
          alignSelf: 'flex-start',
        }}
      />
      <View
        style={{
          width: '85%',
          height: lineHeight,
          borderRadius: lineRadius,
          backgroundColor: strokeColor,
          marginBottom: lineGap,
          alignSelf: 'flex-start',
        }}
      />
      <View
        style={{
          width: '56%',
          height: lineHeight,
          borderRadius: lineRadius,
          backgroundColor: strokeColor,
          alignSelf: 'flex-start',
        }}
      />
    </View>
  );
}

export function PageHeading({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 }}>
      <View style={{ flex: 1 }}>
        {eyebrow ? (
          <Text
            style={{
              fontSize: 11,
              letterSpacing: 1.4,
              fontWeight: '800',
              color: colors.mint,
              marginBottom: 4,
            }}
          >
            {eyebrow}
          </Text>
        ) : null}
        <Text
          style={{
            fontSize: 26,
            lineHeight: 32,
            letterSpacing: -0.6,
            fontWeight: '800',
            color: colors.ink,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ marginTop: 4, fontSize: 13, lineHeight: 18, color: colors.body }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled = false,
  loading = false,
  small = false,
  style,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  style?: ViewStyle;
}) {
  const { colors, radii, controls } = useTheme();

  let bg = colors.mint;
  let fg = colors.mintContrast;
  let border = 'transparent';

  if (kind === 'secondary') {
    bg = colors.mintPale;
    fg = colors.mint;
    border = colors.line;
  } else if (kind === 'ghost') {
    bg = 'transparent';
    fg = colors.mint;
    border = 'transparent';
  } else if (kind === 'danger') {
    bg = colors.redWash;
    fg = colors.red;
    border = 'rgba(224, 108, 117, 0.3)';
  }

  const height = small ? controls.heights.sm : controls.heights.md;
  const radius = small ? radii.md : radii.lg;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [
        {
          minHeight: height,
          borderRadius: radius,
          borderCurve: 'continuous',
          backgroundColor: bg,
          borderWidth: border !== 'transparent' ? 1 : 0,
          borderColor: border,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: small ? 14 : 18,
          flexDirection: 'row',
          opacity: disabled ? 0.45 : pressed ? 0.82 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <Text style={{ fontSize: small ? 12 : 14, fontWeight: '700', color: fg }}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  error,
  style,
  ...props
}: Omit<TextInputProps, 'style'> & { label?: string; error?: string; style?: ViewStyle }) {
  const { colors, radii } = useTheme();
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      {label ? (
        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.body, marginBottom: 6 }}>
          {label}
        </Text>
      ) : null}
      <NativeTextInput
        placeholderTextColor={colors.muted}
        style={{
          minHeight: 48,
          borderWidth: 1,
          borderColor: error ? colors.red : colors.line,
          borderRadius: radii.md,
          borderCurve: 'continuous',
          backgroundColor: colors.inputBg,
          paddingHorizontal: 14,
          color: colors.ink,
          fontSize: 14,
        }}
        accessibilityLabel={label}
        {...props}
      />
      {error ? (
        <Text style={{ color: colors.red, fontSize: 11, marginTop: 4 }}>{error}</Text>
      ) : null}
    </View>
  );
}

export function Surface({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { colors, radii } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radii.xl,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: colors.line,
          padding: 16,
          elevation: 2,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Avatar({
  name,
  color,
  large = false,
  size: customSize,
}: {
  name: string;
  color?: string;
  large?: boolean;
  size?: number;
}) {
  const { colors, radii } = useTheme();
  const c = color || colors.mint;
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || '')
    .join('')
    .toUpperCase();
  const size = customSize || (large ? 72 : 44);
  const rad = customSize ? Math.round(customSize * 0.35) : large ? radii.xl : radii.lg;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: rad,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.stitchGlow,
        backgroundColor: colors.mintWash,
      }}
    >
      <Text style={{ fontWeight: '800', fontSize: customSize ? Math.round(customSize * 0.4) : large ? 18 : 13, color: c }}>
        {initials || 'H'}
      </Text>
    </View>
  );
}

export function RemoteAvatar({
  name,
  uri,
  color,
  large = false,
  size: customSize,
}: {
  name: string;
  uri?: string | null;
  color?: string;
  large?: boolean;
  size?: number;
}) {
  const { colors, radii } = useTheme();
  const size = customSize || (large ? 72 : 44);
  const rad = customSize ? Math.round(customSize * 0.35) : large ? radii.xl : radii.lg;

  if (!uri) return <Avatar name={name} color={color} large={large} size={customSize} />;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: rad,
        borderCurve: 'continuous',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.stitchGlow,
        backgroundColor: colors.mintWash,
      }}
    >
      <Image
        source={{ uri }}
        resizeMode="cover"
        style={{ width: size, height: size }}
        accessibilityLabel={`${name} profile picture`}
      />
    </View>
  );
}

export function Skeleton({
  width,
  height,
  borderRadius = 8,
  style,
}: {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: colors.mintWash,
          overflow: 'hidden',
          opacity: 0.8,
          borderWidth: 1,
          borderColor: colors.line,
        },
        style,
      ]}
    />
  );
}

export function SkeletonRow() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
      <Skeleton width={44} height={44} borderRadius={16} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="60%" height={14} borderRadius={6} />
        <Skeleton width="85%" height={12} borderRadius={6} />
      </View>
    </View>
  );
}

export function LoadingState({ message = 'Loading…' }: { message?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <ActivityIndicator size="large" color={colors.mint} />
      <Text style={{ fontSize: 13, color: colors.muted }}>{message}</Text>
    </View>
  );
}

export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  const { colors, radii } = useTheme();
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 40 }}>
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: radii.lg,
          backgroundColor: colors.mintPale,
          borderWidth: 1,
          borderColor: colors.line,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 14,
        }}
      >
        <Text style={{ fontSize: 20, color: colors.mint, fontWeight: '800' }}>✦</Text>
      </View>
      <Text style={{ fontWeight: '800', fontSize: 16, color: colors.ink }}>{title}</Text>
      <Text style={{ fontSize: 13, color: colors.body, textAlign: 'center', lineHeight: 19, marginTop: 6, maxWidth: 280 }}>
        {detail}
      </Text>
      {action ? <View style={{ marginTop: 16 }}>{action}</View> : null}
    </View>
  );
}

export function Notice({
  children,
  tone = 'info',
}: {
  children: React.ReactNode;
  tone?: 'info' | 'error' | 'success';
}) {
  const { colors, radii } = useTheme();
  const bg = tone === 'error' ? colors.redWash : tone === 'success' ? colors.mintWash : colors.card;
  const fg = tone === 'error' ? colors.red : tone === 'success' ? colors.mint : colors.body;
  const border =
    tone === 'error'
      ? 'rgba(224, 108, 117, 0.28)'
      : tone === 'success'
      ? colors.stitchGlow
      : colors.line;

  return (
    <View
      style={{
        padding: 12,
        borderRadius: radii.md,
        borderCurve: 'continuous',
        marginBottom: 12,
        backgroundColor: bg,
        borderColor: border,
        borderWidth: 1,
      }}
    >
      <Text style={{ fontSize: 12, lineHeight: 18, fontWeight: '600', color: fg }}>{children}</Text>
    </View>
  );
}

export function FilterPill({
  label,
  active,
  count,
  onPress,
}: {
  label: string;
  active: boolean;
  count?: number;
  onPress: () => void;
}) {
  const { colors, radii } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: radii.md,
        borderCurve: 'continuous',
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: active ? colors.mint : colors.card,
        borderColor: active ? colors.mint : colors.line,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: '700',
          color: active ? colors.mintContrast : colors.body,
        }}
      >
        {label}
        {typeof count === 'number' && count > 0 ? ` · ${count}` : ''}
      </Text>
    </Pressable>
  );
}
