import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { loginSchema, mapErrorToUserFriendly, meetsMinimumAge, registerSchema } from '@haiku/contracts';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../auth/AuthContext';
import { api, messageForError } from '../api/client';
import { BrandMark, Button, Field, Notice, Screen, Surface } from '../components/UI';
import { useTheme } from '../theme/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Auth'>;

export function AuthScreen({ navigation }: Props) {
  const { signIn, register } = useAuth();
  const { colors, radii, controls } = useTheme();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';

  const submit = async () => {
    setError('');
    setInfo('');
    const emailValue = email.trim().toLowerCase();
    if (isRegister) {
      const normalizedDob = dateOfBirth.trim().replace(/[/.\s]/g, '-');
      const input = {
        email: emailValue,
        password,
        username: username.trim().toLowerCase(),
        displayName: displayName.trim(),
        dateOfBirth: normalizedDob,
      };
      const parsed = registerSchema.safeParse(input);
      if (!parsed.success) {
        setError(mapErrorToUserFriendly(parsed.error.issues[0]?.message).message);
        return;
      }
      if (!meetsMinimumAge(input.dateOfBirth)) {
        setError('You need to be at least 13 to create an account.');
        return;
      }
      setBusy(true);
      try {
        const result = await register(parsed.data);
        setInfo(result.message + ' Check your inbox for the verification link.');
        setMode('login');
      } catch (e) {
        setError(mapErrorToUserFriendly(e).message);
      } finally {
        setBusy(false);
      }
      return;
    }
    const parsed = loginSchema.safeParse({ email: emailValue, password });
    if (!parsed.success) {
      setError(mapErrorToUserFriendly(parsed.error.issues[0]?.message).message);
      return;
    }
    setBusy(true);
    try {
      await signIn(parsed.data.email, parsed.data.password);
    } catch (e) {
      setError(mapErrorToUserFriendly(e).message);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError('');
    setInfo('');
    setBusy(true);
    try {
      const result = await api<{ message: string }>('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify(email.trim().toLowerCase()),
        anonymous: true,
      });
      setInfo(result.message);
    } catch (e) {
      setError(messageForError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll style={{ backgroundColor: colors.canvas }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ paddingHorizontal: 22, paddingTop: 32, paddingBottom: 36, maxWidth: 520, width: '100%', alignSelf: 'center' }}>
          
          {/* Hero Header */}
          <View style={{ alignItems: 'center', marginBottom: 28 }}>
            <View
              style={{
                shadowColor: colors.mint,
                shadowOpacity: 0.25,
                shadowRadius: 18,
                elevation: 6,
                marginBottom: 16,
              }}
            >
              <BrandMark size={56} />
            </View>
            <Text
              style={{
                color: colors.ink,
                fontWeight: '800',
                fontSize: 28,
                letterSpacing: -0.7,
                textAlign: 'center',
              }}
            >
              haiku
            </Text>
            <Text
              style={{
                color: colors.mint,
                fontSize: 11,
                fontWeight: '800',
                letterSpacing: 2,
                marginTop: 2,
                textTransform: 'uppercase',
              }}
            >
              Calm &bull; Ephemeral &bull; Connected
            </Text>
          </View>

          {/* Segmented Auth Selector */}
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: colors.panel,
              padding: 4,
              borderRadius: radii.xl,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: colors.line,
              marginBottom: 20,
            }}
          >
            <Pressable
              onPress={() => {
                setError('');
                setInfo('');
                setMode('login');
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: !isRegister }}
              style={({ pressed }) => [
                {
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: radii.lg,
                  borderCurve: 'continuous',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: controls.heights.sm,
                  backgroundColor: !isRegister ? colors.mint : 'transparent',
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: !isRegister ? colors.mintContrast : colors.muted,
                }}
              >
                Sign In
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setError('');
                setInfo('');
                setMode('register');
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: isRegister }}
              style={({ pressed }) => [
                {
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: radii.lg,
                  borderCurve: 'continuous',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: controls.heights.sm,
                  backgroundColor: isRegister ? colors.mint : 'transparent',
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: isRegister ? colors.mintContrast : colors.muted,
                }}
              >
                Create Account
              </Text>
            </Pressable>
          </View>

          {error ? <Notice tone="error">{error}</Notice> : null}
          {info ? <Notice tone="success">{info}</Notice> : null}

          {/* Form Card */}
          <Surface
            style={{
              padding: 22,
              borderRadius: radii.xxl,
              borderCurve: 'continuous',
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.line,
            }}
          >
            {isRegister ? (
              <>
                <Field
                  label="Display name"
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="Your full or display name"
                  maxLength={60}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
                <Field
                  label="Username"
                  value={username}
                  onChangeText={setUsername}
                  placeholder="your_handle"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={24}
                  returnKeyType="next"
                />
                <Field
                  label="Date of birth (YYYY-MM-DD)"
                  value={dateOfBirth}
                  onChangeText={setDateOfBirth}
                  placeholder="2005-06-15"
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                  returnKeyType="next"
                />
              </>
            ) : null}

            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="name@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              returnKeyType="next"
            />

            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder={isRegister ? 'At least 12 characters' : 'Enter password'}
              secureTextEntry
              textContentType={isRegister ? 'newPassword' : 'password'}
              returnKeyType="done"
              onSubmitEditing={submit}
            />

            <Button
              title={isRegister ? 'Create Account' : 'Sign In'}
              onPress={submit}
              loading={busy}
              style={{ marginTop: 8 }}
            />

            {!isRegister ? (
              <Pressable
                onPress={() => navigation.navigate('ForgotPassword')}
                style={({ pressed }) => [
                  {
                    alignSelf: 'center',
                    paddingVertical: 14,
                    minHeight: controls.heights.sm,
                    justifyContent: 'center',
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={{ color: colors.mint, fontSize: 13, fontWeight: '700' }}>
                  Forgot your password?
                </Text>
              </Pressable>
            ) : (
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 11,
                  lineHeight: 16,
                  textAlign: 'center',
                  marginTop: 14,
                }}
              >
                By creating an account, you confirm you are at least 13. Your birth date is kept private.
              </Text>
            )}
          </Surface>

          {error.includes('EMAIL_UNVERIFIED') || error.toLowerCase().includes('verify your email') ? (
            <Button
              title="Resend verification email"
              kind="secondary"
              onPress={resend}
              loading={busy}
              style={{ marginTop: 14 }}
            />
          ) : null}

          {/* Footer toggle */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 6,
              marginTop: 24,
            }}
          >
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              {isRegister ? 'Already have an account?' : 'Need an account?'}
            </Text>
            <Pressable
              onPress={() => {
                setError('');
                setInfo('');
                setMode(isRegister ? 'login' : 'register');
              }}
              style={({ pressed }) => [{ minHeight: 44, justifyContent: 'center', opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={{ color: colors.mint, fontSize: 13, fontWeight: '800' }}>
                {isRegister ? 'Sign in' : 'Create one'}
              </Text>
            </Pressable>
          </View>

          <View style={{ alignItems: 'center', marginTop: 20 }}>
            <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 0.3 }}>
              Quiet, weightless, authentic conversation.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
