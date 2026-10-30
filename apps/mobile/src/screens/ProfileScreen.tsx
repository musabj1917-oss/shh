import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View, Alert, ScrollView } from 'react-native';
import { palette, spacing } from '../theme';
import { Button, Card, Input } from '../components';

export function ProfileScreen({ navigation }: { navigation: any }) {
  const [username, setUsername] = useState('jules_haiku');
  const [bio, setBio] = useState('Software engineer building Haiku Messenger.');
  const [pronouns, setPronouns] = useState('they/them');
  const [location, setLocation] = useState('San Francisco, CA');
  const [decoyPassword, setDecoyPassword] = useState('');

  const handleSaveProfile = () => {
    Alert.alert('Profile Saved', 'Your public profile details have been updated.');
  };

  const handleConfigureDecoy = () => {
    if (!decoyPassword) {
      Alert.alert('Error', 'Please enter a decoy password.');
      return;
    }
    Alert.alert('Decoy Mode Configured', 'Decoy password set. Logging in with this password will open an isolated decoy environment.');
    setDecoyPassword('');
  };

  const handleLogout = () => {
    navigation.navigate('Auth');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Profile & Settings</Text>

        <Card>
          <Text style={styles.sectionHeader}>Public Profile</Text>
          <Input label="Username (30-day limit)" value={username} onChangeText={setUsername} />
          <Input label="Bio" value={bio} onChangeText={setBio} />
          <Input label="Pronouns" value={pronouns} onChangeText={setPronouns} />
          <Input label="Location (Optional)" value={location} onChangeText={setLocation} />
          <Text style={styles.subtext}>Birthday public view: May 15 (year obscured for COPPA/privacy).</Text>
          <Button title="Save Profile" onPress={handleSaveProfile} style={{ marginTop: spacing.xs }} />
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <Text style={styles.sectionHeader}>Privacy & Security</Text>
          <Text style={styles.body}>Set an alternate decoy password for your account.</Text>
          <Input
            label="Decoy Password"
            placeholder="••••••••"
            secureTextEntry
            value={decoyPassword}
            onChangeText={setDecoyPassword}
          />
          <Button title="Set Decoy Credential" variant="secondary" onPress={handleConfigureDecoy} />
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <Text style={styles.sectionHeader}>Account Deletion</Text>
          <Text style={styles.body}>Request full removal of your account and all associated data.</Text>
          <Button
            title="Request Account Deletion"
            variant="danger"
            onPress={() => Alert.alert('Request Submitted', 'Your account is scheduled for deletion in 30 days.')}
            style={{ marginTop: spacing.xs }}
          />
        </Card>

        <Button title="Log Out" variant="outline" onPress={handleLogout} style={{ marginVertical: spacing.lg }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.white },
  content: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  title: { fontSize: 28, fontWeight: '700', color: palette.tealDark, marginBottom: spacing.md },
  sectionHeader: { fontSize: 18, fontWeight: '700', color: palette.tealDark, marginBottom: spacing.xs },
  body: { fontSize: 14, color: palette.muted, marginBottom: spacing.xs },
  subtext: { fontSize: 12, color: palette.teal, marginTop: spacing.xs }
});
