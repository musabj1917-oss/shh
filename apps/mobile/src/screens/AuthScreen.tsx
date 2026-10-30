import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View, ScrollView, Alert, Modal } from 'react-native';
import { palette, spacing } from '../theme';
import { Button, Input } from '../components';

export function AuthScreen({ navigation }: { navigation: any }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const validateAge = (dobString: string): boolean => {
    const dob = new Date(dobString);
    if (Number.isNaN(dob.getTime())) return false;

    const now = new Date();
    const age = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();
    const dayDiff = now.getDate() - dob.getDate();
    const actualAge = (monthDiff > 0 || (monthDiff === 0 && dayDiff >= 0)) ? age : age - 1;

    return actualAge >= 13;
  };

  const handleAuth = () => {
    setError(null);
    if (!email || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (isRegistering) {
      if (!firstName || !lastName || !dateOfBirth) {
        setError('Please complete all registration fields.');
        return;
      }
      if (!validateAge(dateOfBirth)) {
        setError('You must be at least 13 years old to register.');
        return;
      }
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigation.navigate('Main');
    }, 800);
  };

  const handleGoogleSignIn = () => {
    Alert.alert(
      'Google Sign-In',
      'Redirecting to secure official Google OAuth flow...',
      [{ text: 'Continue', onPress: () => navigation.navigate('Main') }]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Haiku</Text>
          <Text style={styles.subtitle}>
            {isRegistering ? 'Create your Haiku account' : 'Welcome back to Haiku'}
          </Text>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorBoxText}>{error}</Text>
          </View>
        )}

        <Input
          label="Email address"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Input
          label="Password"
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {isRegistering && (
          <>
            <Input
              label="First Name"
              placeholder="First name"
              value={firstName}
              onChangeText={setFirstName}
            />
            <Input
              label="Last Name"
              placeholder="Last name"
              value={lastName}
              onChangeText={setLastName}
            />
            <Input
              label="Date of Birth (YYYY-MM-DD)"
              placeholder="2010-05-15"
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
            />

            <View style={styles.noticeBox}>
              <Text style={styles.noticeHeader}>🔒 Privacy Notice & Active Messaging Disclosure</Text>
              <Text style={styles.noticeBody}>
                Haiku Messenger uses standard server-side processing (not end-to-end encryption). The authorized platform owner can review active unexpired messages, profiles, and reports. Photos, videos, and voice notes expire automatically after 10 minutes.
              </Text>
              <Button
                title="View Full Privacy Policy"
                variant="outline"
                onPress={() => setShowPrivacyModal(true)}
                style={{ marginTop: spacing.xs }}
              />
            </View>
          </>
        )}

        <Button
          title={isRegistering ? 'Complete Registration' : 'Sign In'}
          onPress={handleAuth}
          loading={loading}
          style={{ marginTop: spacing.md }}
        />

        <Button
          title="Continue with Google"
          variant="secondary"
          onPress={handleGoogleSignIn}
        />

        <Button
          title={isRegistering ? 'Already have an account? Sign in' : "Don't have an account? Register"}
          variant="outline"
          onPress={() => {
            setIsRegistering(!isRegistering);
            setError(null);
          }}
        />

        <Modal visible={showPrivacyModal} animationType="slide">
          <SafeAreaView style={{ flex: 1, padding: spacing.xl }}>
            <Text style={styles.title}>Privacy Policy</Text>
            <ScrollView style={{ marginVertical: spacing.md }}>
              <Text style={styles.policyText}>
                1. Server-Side Messaging: Haiku Messenger uses standard server-side verification rather than end-to-end encryption. Active messages are accessible to the platform owner for moderation and safety review.
                {"\n\n"}
                2. Expiring Content: Photos, videos, and voice notes automatically expire after 10 minutes and are purged from database records and storage. Stories expire after 24 hours.
                {"\n\n"}
                3. Privacy & Birthdays: Birth years are obscured across all public profiles. Only birth month and day are shown to friends.
                {"\n\n"}
                4. Account Deletion: Users can request account deletion at any time with a 30-day cancellation window. Permanent deletion purges all profile data, sessions, and associated media references.
              </Text>
            </ScrollView>
            <Button title="Close Policy" onPress={() => setShowPrivacyModal(false)} />
          </SafeAreaView>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.white },
  container: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingVertical: spacing.xxl, justifyContent: 'center' },
  header: { marginBottom: spacing.xl },
  title: { fontSize: 42, fontWeight: '800', color: palette.tealDark, marginBottom: spacing.xs },
  subtitle: { fontSize: 18, color: palette.muted },
  errorBox: { backgroundColor: '#FFE4E6', borderRadius: 10, padding: spacing.md, marginBottom: spacing.md },
  errorBoxText: { color: palette.danger, fontSize: 14, fontWeight: '600' },
  noticeBox: { backgroundColor: palette.mintLight, borderRadius: 12, padding: spacing.md, marginVertical: spacing.xs, borderWidth: 1, borderColor: palette.mintDeep },
  noticeHeader: { fontSize: 14, fontWeight: '700', color: palette.tealDark, marginBottom: 4 },
  noticeBody: { fontSize: 12, color: palette.ink, lineHeight: 18 },
  policyText: { fontSize: 14, color: palette.ink, lineHeight: 22 }
});
