import React, { useState } from 'react';
import { Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { emailSchema } from '@haiku/contracts';
import type { RootStackParamList } from '../navigation/types';
import { api, messageForError } from '../api/client';
import { Button, Field, Notice, Screen } from '../components/UI';
import { useTheme } from '../theme/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
  const { colors, typography } = useTheme();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError('');
    const parsed = emailSchema.safeParse(email.trim().toLowerCase());
    if (!parsed.success) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    try {
      await api('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
        anonymous: true,
      });
      setSent(true);
    } catch (e) {
      setError(messageForError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll style={{ backgroundColor: colors.canvas }}>
      <View style={{ padding: 20, paddingTop: 34 }}>
        <Text
          style={{
            fontSize: typography.sizes.display,
            fontWeight: '800',
            letterSpacing: -0.8,
            color: colors.ink,
          }}
        >
          Let’s get you back in.
        </Text>
        <Text
          style={{
            color: colors.muted,
            fontSize: typography.sizes.sub,
            lineHeight: 20,
            marginTop: 7,
            marginBottom: 24,
          }}
        >
          Enter the email on your account. We’ll send a secure reset link if it matches an eligible account.
        </Text>
        {error ? <Notice tone="error">{error}</Notice> : null}
        {sent ? (
          <Notice tone="success">
            If an eligible account exists, recovery instructions are on the way. The link opens Haiku’s secure password
            reset page.
          </Notice>
        ) : (
          <>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Button title="Send recovery link" onPress={submit} loading={busy} />
          </>
        )}
        <View style={{ marginTop: 14 }}>
          <Button title="Back to sign in" kind="ghost" onPress={() => navigation.goBack()} />
        </View>
      </View>
    </Screen>
  );
}
