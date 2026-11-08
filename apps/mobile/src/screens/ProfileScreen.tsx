import React, { useCallback, useEffect, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  Share,
  Switch,
  Text,
  View,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { api, messageForError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import {
  Avatar,
  Button,
  ConfirmModal,
  ConfirmModalButton,
  Field,
  LoadingState,
  Notice,
  RemoteAvatar,
  Surface,
} from '../components/UI';
import { MapPinIcon, PlusIcon } from '../components/Icons';
import { useTheme } from '../theme/ThemeContext';
import { useImmersive } from '../system/immersive';
import { checkAllPermissions, requestPermission, PermissionKind, PermissionState } from '../permissions';
import { ThemePreference } from '@haiku/contracts';
import { MEDIA_LIMITS, validateMediaSize } from '../constants/mediaLimits';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type Profile = {
  email: string;
  username: string;
  display_name: string;
  bio: string | null;
  location: string | null;
  avatar_object_key: string | null;
  username_changed_at: string | null;
};

type Settings = {
  quietMode: boolean;
  notificationsEnabled: boolean;
  senderPreviews: boolean;
  presenceVisible: boolean;
  readReceiptsEnabled: boolean;
  typingIndicatorsEnabled: boolean;
};

type RawSettings = {
  quiet_mode: boolean;
  notifications_enabled: boolean;
  sender_previews: boolean;
  presence_visible: boolean;
  read_receipts_enabled: boolean;
  typing_indicators_enabled: boolean;
};

type Session = {
  id: string;
  user_agent: string | null;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
};

type Blocked = {
  id: string;
  username: string;
  display_name: string;
};

type Report = {
  id: string;
  category: string;
  status: string;
  created_at: string;
};

type Deletion = {
  id: string;
  scheduled_for: string;
};

type SettingsTab = 'profile' | 'privacy' | 'security' | 'permissions' | 'cloud';

const defaultSettings: Settings = {
  quietMode: true,
  notificationsEnabled: true,
  senderPreviews: true,
  presenceVisible: true,
  readReceiptsEnabled: true,
  typingIndicatorsEnabled: true,
};

const mapSettings = (value: RawSettings): Settings => ({
  quietMode: value.quiet_mode,
  notificationsEnabled: value.notifications_enabled,
  senderPreviews: value.sender_previews,
  presenceVisible: value.presence_visible,
  readReceiptsEnabled: value.read_receipts_enabled,
  typingIndicatorsEnabled: value.typing_indicators_enabled,
});

export function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, signOut, refresh } = useAuth();
  const { colors, preference, setThemePreference, radii, controls } = useTheme();
  const { immersive, updatePersisted } = useImmersive();

  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [permStatuses, setPermStatuses] = useState<Record<PermissionKind, PermissionState>>({
    camera: 'denied',
    microphone: 'denied',
    photos: 'denied',
    location: 'denied',
    notifications: 'denied',
  });

  const refreshPerms = useCallback(async () => {
    const res = await checkAllPermissions();
    setPermStatuses(res);
  }, []);

  useEffect(() => {
    if (activeTab === 'permissions') {
      void refreshPerms();
    }
  }, [activeTab, refreshPerms]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [blocked, setBlocked] = useState<Blocked[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [deletion, setDeletion] = useState<Deletion | null>(null);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [serverHealth, setServerHealth] = useState<{
    status: string;
    databaseConnected: boolean;
    databaseConfigured: boolean;
  } | null>(null);

  // Form states
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  // Themed Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean;
    title: string;
    message?: string;
    buttons: ConfirmModalButton[];
  }>({ visible: false, title: '', buttons: [] });

  // Status flags
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setError('');
    try {
      const [p, s, ss, b, r, d, h] = await Promise.all([
        api<{ profile: Profile }>('/profile/me'),
        api<{ settings: RawSettings }>('/profile/settings'),
        api<{ sessions: Session[] }>('/account/sessions'),
        api<{ blockedUsers: Blocked[] }>('/friends/blocks'),
        api<{ reports: Report[] }>('/reports/mine'),
        api<{ request: Deletion | null }>('/account/deletion'),
        api<{ status: string; databaseConnected: boolean; databaseConfigured: boolean }>('/health', {
          anonymous: true,
        }).catch(() => null),
      ]);

      setProfile(p.profile);
      setDisplayName(p.profile?.display_name || user.displayName);
      setUsername(p.profile?.username || user.username);
      setBio(p.profile?.bio || '');
      setLocation(p.profile?.location || '');
      setSettings(mapSettings(s.settings));
      setSessions(ss.sessions || []);
      setBlocked(b.blockedUsers || []);
      setReports(r.reports || []);
      setDeletion(d.request || null);
      if (h) setServerHealth(h);

      if (user.id) {
        try {
          const avatar = await api<{ url: string }>(`/media/avatars/${user.id}`);
          setAvatarUrl(avatar.url);
        } catch {
          setAvatarUrl('');
        }
      }
    } catch (e) {
      setError(messageForError(e));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const saveProfile = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const patch: { displayName: string; bio: string | null; location: string | null; username?: string } = {
        displayName: displayName.trim(),
        bio: bio.trim() || null,
        location: location.trim() || null,
      };
      if (username.trim() !== profile?.username) patch.username = username.trim();
      await api('/profile/me', { method: 'PATCH', body: JSON.stringify(patch) });
      setSuccess('Profile details successfully saved.');
      await refresh();
      await load();
    } catch (e) {
      setError(messageForError(e));
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async () => {
    setError('');
    setSuccess('');
    if (newPassword.length < 12) {
      setError('Use at least 12 characters for your new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }
    setPasswordBusy(true);
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
      setSuccess('Password updated. Other active sessions have been signed out.');
      await load();
    } catch (e) {
      setError(messageForError(e));
    } finally {
      setPasswordBusy(false);
    }
  };

  const updateSetting = async (key: keyof Settings, value: boolean) => {
    const previous = settings;
    const next = { ...settings, [key]: value };
    setSettings(next);
    setError('');
    const apiKey: Record<keyof Settings, string> = {
      quietMode: 'quietMode',
      notificationsEnabled: 'notificationsEnabled',
      senderPreviews: 'senderPreviews',
      presenceVisible: 'presenceVisible',
      readReceiptsEnabled: 'readReceiptsEnabled',
      typingIndicatorsEnabled: 'typingIndicatorsEnabled',
    };
    try {
      await api('/profile/settings', {
        method: 'PATCH',
        body: JSON.stringify({ [apiKey[key]]: value }),
      });
    } catch (e) {
      setSettings(previous);
      setError(messageForError(e));
    }
  };

  const changeAvatar = async () => {
    setError('');
    const picked = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      quality: MEDIA_LIMITS.AVATAR.COMPRESSION_QUALITY,
      maxWidth: MEDIA_LIMITS.AVATAR.MAX_WIDTH,
      maxHeight: MEDIA_LIMITS.AVATAR.MAX_HEIGHT,
    });
    if (picked.didCancel) return;
    if (picked.errorCode) {
      setError(picked.errorMessage || 'Could not open your photo library.');
      return;
    }
    const asset = picked.assets?.[0];
    if (!asset?.uri) {
      setError('The selected image could not be opened.');
      return;
    }
    const mimeType = (asset.type || 'image/jpeg').toLowerCase();
    let byteSize = asset.fileSize || 0;
    if (!byteSize) {
      try {
        const resp = await fetch(asset.uri);
        const blob = await resp.blob();
        byteSize = blob.size;
      } catch {
        byteSize = 1024 * 1024;
      }
    }

    const check = validateMediaSize('avatar', byteSize);
    if (!check.valid && check.error) {
      setError(check.error);
      return;
    }

    setUploading(true);
    try {
      const intent = await api<{
        attachmentId: string;
        upload: { url: string; method: 'PUT'; headers: Record<string, string>; mode: 'proxy' | 'signed' };
      }>('/media/upload-intents', {
        method: 'POST',
        body: JSON.stringify({ purpose: 'avatar', mediaType: 'image', mimeType, byteSize }),
      });
      const blob = await (await fetch(asset.uri)).blob();
      const result = await fetch(intent.upload.url, {
        method: intent.upload.method,
        headers: intent.upload.headers,
        body: blob,
      });
      if (!result.ok) throw new Error(`Upload failed (${result.status}).`);
      if (intent.upload.mode === 'signed') {
        await api(`/media/${intent.attachmentId}/complete`, { method: 'POST' });
      }
      await api('/profile/me', { method: 'PATCH', body: JSON.stringify({ avatarAttachmentId: intent.attachmentId }) });
      setSuccess('Profile photo updated.');
      await load();
    } catch (e) {
      setError(messageForError(e));
    } finally {
      setUploading(false);
    }
  };

  const revokeSession = (id: string) => {
    setConfirmDialog({
      visible: true,
      title: 'Sign out this device?',
      message: 'This session will no longer be able to access your Haiku account.',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            try {
              await api(`/account/sessions/${id}`, { method: 'DELETE' });
              await load();
            } catch (e) {
              setError(messageForError(e));
            }
          },
        },
      ],
    });
  };

  const revokeOthers = () => {
    setConfirmDialog({
      visible: true,
      title: 'Sign out other devices?',
      message: 'Your current device stays signed in. All other active sessions will be revoked.',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out others',
          style: 'destructive',
          onPress: async () => {
            try {
              await api('/account/sessions', { method: 'DELETE' });
              await load();
            } catch (e) {
              setError(messageForError(e));
            }
          },
        },
      ],
    });
  };

  const toggleBlock = async (item: Blocked) => {
    try {
      await api(`/friends/blocks/${item.id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(messageForError(e));
    }
  };

  const exportData = async () => {
    try {
      const result = await api('/account/export');
      await Share.share({
        title: 'Haiku Messenger data export',
        message: JSON.stringify(result, null, 2),
      });
    } catch (e) {
      setError(messageForError(e));
    }
  };

  const scheduleDeletion = () => {
    setConfirmDialog({
      visible: true,
      title: 'Schedule account deletion?',
      message: 'Your account is scheduled for deletion after a grace period. You can cancel before it completes.',
      buttons: [
        { text: 'Keep account', style: 'cancel' },
        {
          text: 'Schedule deletion',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await api<{ request: Deletion }>('/account/deletion', { method: 'POST' });
              setDeletion(result.request);
              setSuccess(`Account deletion scheduled for ${new Date(result.request.scheduled_for).toLocaleDateString()}.`);
            } catch (e) {
              setError(messageForError(e));
            }
          },
        },
      ],
    });
  };

  const cancelDeletion = () => {
    setConfirmDialog({
      visible: true,
      title: 'Cancel account deletion?',
      message: 'Your account will remain active and protected.',
      buttons: [
        { text: 'Keep scheduled', style: 'cancel' },
        {
          text: 'Cancel deletion',
          onPress: async () => {
            try {
              await api('/account/deletion', { method: 'DELETE' });
              setDeletion(null);
              setSuccess('Account deletion cancelled.');
            } catch (e) {
              setError(messageForError(e));
            }
          },
        },
      ],
    });
  };

  const doSignOut = () => {
    setConfirmDialog({
      visible: true,
      title: 'Sign out of Haiku?',
      message: 'You can sign back in anytime with your credentials.',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
      ],
    });
  };

  if (loading) return <LoadingState message="Opening your settings…" />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      contentContainerStyle={{ padding: 16, paddingTop: 16, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Hero Profile Overview Card */}
      <Surface style={{ padding: 18, borderRadius: radii.xxl, marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Pressable
            onPress={changeAvatar}
            disabled={uploading}
            accessibilityRole="button"
            accessibilityLabel="Change profile picture"
            style={{ position: 'relative' }}
          >
            <RemoteAvatar name={displayName || user?.displayName || 'Haiku'} uri={avatarUrl} large />
            <View
              style={{
                position: 'absolute',
                bottom: -2,
                right: -2,
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: colors.mint,
                borderWidth: 2,
                borderColor: colors.canvas,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {uploading ? (
                <Text style={{ fontSize: 13, color: colors.mintContrast, fontWeight: '800' }}>…</Text>
              ) : (
                <PlusIcon size={12} color={colors.mintContrast} />
              )}
            </View>
          </Pressable>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', letterSpacing: -0.4, color: colors.ink }}>
                {displayName || user?.displayName}
              </Text>
            </View>

            <Text style={{ fontSize: 13, color: colors.body, marginTop: 2 }}>
              @{username || user?.username}
            </Text>
            <Text style={{ fontSize: 10, color: colors.muted, marginTop: 1 }}>
              Tap avatar to change (max {MEDIA_LIMITS.AVATAR.MAX_LABEL})
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: radii.sm,
                  backgroundColor: user?.emailVerified ? colors.mintWash : colors.amberWash,
                  borderWidth: 1,
                  borderColor: user?.emailVerified ? colors.stitchGlow : 'rgba(212, 130, 89, 0.3)',
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: user?.emailVerified ? colors.mint : colors.amber,
                  }}
                >
                  {user?.emailVerified ? 'Verified Account' : 'Unverified Email'}
                </Text>
              </View>

              {profile?.location ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <MapPinIcon size={12} color={colors.muted} />
                  <Text style={{ fontSize: 11, color: colors.muted }}>
                    {profile.location}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {user?.id ? (
          <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.line }}>
            <Button
              title="Preview Public Profile"
              kind="secondary"
              small
              onPress={() => navigation.navigate('PublicProfile', { userId: user.id })}
            />
          </View>
        ) : null}
      </Surface>

      {/* Segmented Category Navigation */}
      <View
        style={{
          flexDirection: 'row',
          gap: 6,
          backgroundColor: colors.card,
          padding: 4,
          borderRadius: radii.lg,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: colors.line,
        }}
      >
        {(
          [
            ['profile', 'Profile'],
            ['privacy', 'Privacy'],
            ['security', 'Security'],
            ['permissions', 'Perms'],
            ['cloud', 'System'],
          ] as [SettingsTab, string][]
        ).map(([tabKey, label]) => {
          const isActive = activeTab === tabKey;
          return (
            <Pressable
              key={tabKey}
              onPress={() => setActiveTab(tabKey)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              style={{
                flex: 1,
                minHeight: controls.heights.sm,
                borderRadius: radii.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isActive ? colors.mint : 'transparent',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: isActive ? colors.mintContrast : colors.body,
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Global Alerts */}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}

      {/* TAB 1: PROFILE DETAILS */}
      {activeTab === 'profile' && (
        <>
          {user && !user.emailVerified ? (
            <Surface style={{ marginBottom: 14, padding: 14, borderRadius: radii.xl }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: colors.ink }}>
                Verify your email address
              </Text>
              <Text style={{ fontSize: 12, color: colors.body, marginTop: 4, lineHeight: 18 }}>
                A verified email secures your account and ensures reliable recovery.
              </Text>
              <Button
                title="Resend verification email"
                kind="secondary"
                small
                style={{ marginTop: 10 }}
                onPress={async () => {
                  try {
                    await api('/auth/resend-verification', {
                      method: 'POST',
                      anonymous: true,
                      body: JSON.stringify(user.email),
                    });
                    setSuccess('Verification instructions have been dispatched.');
                  } catch (e) {
                    setError(messageForError(e));
                  }
                }}
              />
            </Surface>
          ) : null}

          <Surface style={{ marginBottom: 14, padding: 18, borderRadius: radii.xl }}>
            <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: colors.mint, marginBottom: 12 }}>
              PROFILE DETAILS
            </Text>

            <Field
              label="Display Name"
              value={displayName}
              onChangeText={setDisplayName}
              maxLength={60}
              autoCapitalize="words"
              placeholder="Your name"
            />

            <Field
              label="Username"
              value={username}
              onChangeText={setUsername}
              maxLength={24}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="handle"
            />

            <Field
              label="About You (Bio)"
              value={bio}
              onChangeText={setBio}
              maxLength={280}
              multiline
              style={{ minHeight: 80 }}
              placeholder="A few words of quiet reflection…"
            />

            <Field
              label="Location"
              value={location}
              onChangeText={setLocation}
              maxLength={80}
              placeholder="e.g. Kyoto, Japan or Remote"
            />

            <Button
              title="Save Changes"
              onPress={saveProfile}
              loading={saving}
              style={{ marginTop: 6 }}
            />
          </Surface>
        </>
      )}

      {/* TAB 2: PRIVACY & NOTIFICATIONS */}
      {activeTab === 'privacy' && (
        <>
          <Surface style={{ marginBottom: 14, padding: 18, borderRadius: radii.xl }}>
            <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: colors.mint, marginBottom: 6 }}>
              REAL-TIME INTERACTION SIGNALS
            </Text>
            <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 12 }}>
              Control real-time presence indicators visible to your friends and peers.
            </Text>

            {(
              [
                ['presenceVisible', 'Live Presence Indicator', 'Share active online presence in supported chats.'],
                ['readReceiptsEnabled', 'Read Receipts', 'Notify friends when you have read their messages.'],
                ['typingIndicatorsEnabled', 'Composing State', 'Show when you are actively drafting a response.'],
              ] as [keyof Settings, string, string][]
            ).map(([key, label, detail], index) => (
              <View
                key={key}
                style={{
                  minHeight: 52,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  borderTopWidth: index ? 1 : 0,
                  borderTopColor: colors.line,
                  paddingVertical: 10,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>{label}</Text>
                  <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>{detail}</Text>
                </View>
                <Switch
                  value={settings[key]}
                  onValueChange={(val) => updateSetting(key, val)}
                  trackColor={{ false: colors.line, true: colors.mint }}
                  thumbColor={settings[key] ? colors.mintContrast : colors.muted}
                  accessibilityLabel={label}
                />
              </View>
            ))}
          </Surface>

          <Surface style={{ marginBottom: 14, padding: 18, borderRadius: radii.xl }}>
            <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: colors.mint, marginBottom: 6 }}>
              NOTIFICATIONS & QUIET HOURS
            </Text>
            <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 12 }}>
              Manage notification deliverability and screen previews.
            </Text>

            {(
              [
                ['quietMode', 'Quiet Sanctuary Mode', 'Mute non-essential rings during mindfulness periods.'],
                ['notificationsEnabled', 'Push Notifications', 'Receive notifications when new messages arrive.'],
                ['senderPreviews', 'Message Previews', 'Include sender name in notification previews.'],
              ] as [keyof Settings, string, string][]
            ).map(([key, label, detail], index) => (
              <View
                key={key}
                style={{
                  minHeight: 52,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  borderTopWidth: index ? 1 : 0,
                  borderTopColor: colors.line,
                  paddingVertical: 10,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>{label}</Text>
                  <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>{detail}</Text>
                </View>
                <Switch
                  value={settings[key]}
                  onValueChange={(val) => updateSetting(key, val)}
                  trackColor={{ false: colors.line, true: colors.mint }}
                  thumbColor={settings[key] ? colors.mintContrast : colors.muted}
                  accessibilityLabel={label}
                />
              </View>
            ))}
          </Surface>
        </>
      )}

      {/* TAB 3: SECURITY & DEVICES */}
      {activeTab === 'security' && (
        <>
          {/* Password Section */}
          <Surface style={{ marginBottom: 14, padding: 18, borderRadius: radii.xl }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: colors.ink }}>
                  Password & Credentials
                </Text>
                <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
                  Updating password revokes all other active sessions.
                </Text>
              </View>
              <Button
                title={showPasswordForm ? 'Close' : 'Change'}
                kind="secondary"
                small
                onPress={() => setShowPasswordForm(!showPasswordForm)}
              />
            </View>

            {showPasswordForm ? (
              <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.line }}>
                <Field
                  label="Current Password"
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry
                  autoComplete="current-password"
                />
                <Field
                  label="New Password (12+ characters)"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  autoComplete="new-password"
                />
                <Field
                  label="Confirm New Password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoComplete="new-password"
                />
                <Button
                  title="Update Password"
                  kind="primary"
                  onPress={savePassword}
                  loading={passwordBusy}
                  style={{ marginTop: 6 }}
                />
              </View>
            ) : null}
          </Surface>

          {/* Active Devices / Sessions */}
          <Surface style={{ marginBottom: 14, padding: 18, borderRadius: radii.xl }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: colors.mint }}>
                ACTIVE SESSIONS ({sessions.length})
              </Text>
              {sessions.length > 1 ? (
                <Pressable onPress={revokeOthers} accessibilityRole="button">
                  <Text style={{ fontSize: 12, color: colors.red, fontWeight: '700' }}>
                    Sign Out Others
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 10 }}>
              Authorized devices currently connected to your account.
            </Text>

            {sessions.length === 0 ? (
              <Text style={{ fontSize: 12, color: colors.muted, paddingVertical: 8 }}>
                Only this device is currently connected.
              </Text>
            ) : (
              sessions.map((item, index) => (
                <View
                  key={item.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 10,
                    borderTopWidth: index ? 1 : 0,
                    borderTopColor: colors.line,
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: radii.md,
                      backgroundColor: colors.mintWash,
                      borderWidth: 1,
                      borderColor: colors.line,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 14, color: colors.mint }}>⛭</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>
                      {item.user_agent || 'Haiku Messenger Session'}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
                      Last active {new Date(item.last_seen_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => revokeSession(item.id)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: radii.sm,
                      backgroundColor: colors.redWash,
                      borderWidth: 1,
                      borderColor: 'rgba(224, 108, 117, 0.25)',
                    }}
                  >
                    <Text style={{ fontSize: 11, color: colors.red, fontWeight: '700' }}>
                      Revoke
                    </Text>
                  </Pressable>
                </View>
              ))
            )}
          </Surface>

          {/* Blocked Accounts */}
          <Surface style={{ marginBottom: 14, padding: 18, borderRadius: radii.xl }}>
            <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: colors.mint, marginBottom: 8 }}>
              BLOCKED ACCOUNTS ({blocked.length})
            </Text>
            {blocked.length === 0 ? (
              <Text style={{ fontSize: 12, color: colors.muted, paddingVertical: 8 }}>
                You have not blocked any accounts.
              </Text>
            ) : (
              blocked.map((item, index) => (
                <View
                  key={item.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 10,
                    borderTopWidth: index ? 1 : 0,
                    borderTopColor: colors.line,
                    gap: 10,
                  }}
                >
                  <Avatar name={item.display_name} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>
                      {item.display_name}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.muted }}>@{item.username}</Text>
                  </View>
                  <Button title="Unblock" kind="secondary" small onPress={() => toggleBlock(item)} />
                </View>
              ))
            )}
          </Surface>
        </>
      )}

      {/* TAB: PERMISSIONS */}
      {activeTab === 'permissions' && (
        <>
          <Surface style={{ marginBottom: 14, padding: 18, borderRadius: radii.xl }}>
            <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: colors.mint, marginBottom: 4 }}>
              SYSTEM PERMISSIONS
            </Text>
            <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 18, marginBottom: 16 }}>
              Review device permissions granted to Haiku Messenger. Denying a permission never locks you out; each feature prompts contextually.
            </Text>

            <View style={{ gap: 12 }}>
              {(
                [
                  ['camera', 'Camera', 'Capture photos and record videos for chats and stories.', '📷'],
                  ['microphone', 'Microphone', 'Audio recording for videos and voice notes.', '🎙️'],
                  ['photos', 'Photos & Media Library', 'Save received media and share gallery pictures.', '🖼️'],
                  ['location', 'Location (Foreground)', 'Share location pins with peers on demand.', '📍'],
                  ['notifications', 'Notifications', 'Real-time alerts for incoming messages and mentions.', '🔔'],
                ] as const
              ).map(([kind, title, desc, icon]) => {
                const state = permStatuses[kind];
                const isGranted = state === 'granted';
                const isBlocked = state === 'blocked';

                return (
                  <View
                    key={kind}
                    style={{
                      padding: 12,
                      borderRadius: radii.lg,
                      borderWidth: 1,
                      borderColor: isGranted ? colors.mint : colors.line,
                      backgroundColor: colors.card,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                        <Text style={{ fontSize: 20 }}>{icon}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.ink }}>
                            {title}
                          </Text>
                          <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
                            {desc}
                          </Text>
                        </View>
                      </View>

                      <View style={{ alignItems: 'flex-end', marginLeft: 10 }}>
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '700',
                            color: isGranted ? colors.mint : isBlocked ? colors.red : colors.muted,
                            textTransform: 'capitalize',
                            marginBottom: 4,
                          }}
                        >
                          {state}
                        </Text>
                        <Pressable
                          onPress={async () => {
                            if (isBlocked) {
                              await Linking.openSettings();
                            } else {
                              const next = await requestPermission(kind);
                              setPermStatuses((prev) => ({ ...prev, [kind]: next }));
                            }
                          }}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: radii.sm,
                            borderWidth: 1,
                            borderColor: isBlocked ? colors.line : colors.mint,
                            backgroundColor: isBlocked ? colors.panel : colors.mintWash,
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '700', color: isBlocked ? colors.ink : colors.mint }}>
                            {isBlocked ? 'Settings' : isGranted ? 'Re-check' : 'Enable'}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </Surface>
        </>
      )}

      {/* TAB 4: CLOUD & SYSTEM */}
      {activeTab === 'cloud' && (
        <>
          {/* Appearance & Theme Selector */}
          <Surface style={{ marginBottom: 14, padding: 18, borderRadius: radii.xl }}>
            <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: colors.mint, marginBottom: 4 }}>
              APPEARANCE & APP THEME
            </Text>
            <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 12 }}>
              Choose your visual sanctuary. Changes live across all screens and updates your launcher icon.
            </Text>

            <View style={{ gap: 8 }}>
              {(
                [
                  ['noir', 'Noir & Red Glow (Default)', 'Pitch obsidian canvas with radiant crimson primary accents and volumetric glow', '#FF2A3B'],
                  ['sumi', 'Sumi & Rain', 'Basalt charcoal canvas with calm celadon accents and cool rain depths', '#4E9F86'],
                  ['komorebi', 'Komorebi', 'Cedar moss canvas with sunlight dappled amber accents', '#58A379'],
                  ['washi', 'Washi Paper', 'Warm daylight linen washi canvas with deep evergreen contrast', '#377561'],
                  ['system', 'Match System', 'Follows device system light and dark mode appearance', colors.ink],
                  ['sakura', 'Sakura (Extra)', 'Deep plum obsidian with radiant sakura petal pink', '#FF8FB8'],
                  ['matcha', 'Matcha (Extra)', 'Basalt forest canvas with energetic matcha lime green', '#8FD16A'],
                  ['ocean', 'Ocean (Extra)', 'Deep abyss navy with luminous ocean cyan blue', '#4DB8FF'],
                  ['ember', 'Ember (Extra)', 'Charred charcoal canvas with incandescent terracotta ember', '#FF6B3D'],
                ] as [ThemePreference, string, string, string][]
              ).map(([themeKey, name, desc, accentColor]) => {
                const isSelected = preference === themeKey;
                return (
                  <Pressable
                    key={themeKey}
                    onPress={() => setThemePreference(themeKey)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 12,
                      borderRadius: radii.md,
                      backgroundColor: isSelected ? colors.mintWash : colors.inputBg,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.mint : colors.line,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: accentColor,
                          borderWidth: 2,
                          borderColor: isSelected ? colors.mint : colors.line,
                        }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>{name}</Text>
                        <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>{desc}</Text>
                      </View>
                    </View>
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: radii.sm,
                        backgroundColor: isSelected ? colors.mint : 'transparent',
                        borderWidth: isSelected ? 0 : 1,
                        borderColor: colors.line,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '800',
                          color: isSelected ? colors.mintContrast : colors.muted,
                        }}
                      >
                        {isSelected ? 'ACTIVE' : 'SELECT'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* System Bars / Immersive Mode Switch */}
            <View style={{ marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.line }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>Hide system bars</Text>
                  <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
                    Draw edge-to-edge. Status and navigation bars hide until swiped from the edge.
                  </Text>
                </View>
                <Switch
                  value={immersive}
                  onValueChange={(val) => void updatePersisted(val)}
                  trackColor={{ false: colors.inputBg, true: colors.mint }}
                  thumbColor={colors.ink}
                />
              </View>
            </View>
          </Surface>

          {/* Cloud & Server Status */}
          <Surface style={{ marginBottom: 14, padding: 18, borderRadius: radii.xl }}>
            <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: colors.mint, marginBottom: 4 }}>
              INFRASTRUCTURE & DATABASE STATUS
            </Text>
            <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 12 }}>
              Real-time health monitoring of connected backend services.
            </Text>

            <View
              style={{
                backgroundColor: colors.inputBg,
                padding: 14,
                borderRadius: radii.md,
                borderWidth: 1,
                borderColor: colors.line,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: serverHealth?.databaseConnected ? colors.mint : colors.red,
                    }}
                  />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>
                    Neon Postgres (Lakebase)
                  </Text>
                </View>
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 6,
                    backgroundColor: serverHealth?.databaseConnected ? colors.mintWash : colors.redWash,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '800',
                      color: serverHealth?.databaseConnected ? colors.mint : colors.red,
                    }}
                  >
                    {serverHealth?.databaseConnected ? 'ONLINE' : 'OFFLINE'}
                  </Text>
                </View>
              </View>

              <Text style={{ fontSize: 11, color: colors.muted, lineHeight: 16 }}>
                Status: {serverHealth?.status?.toUpperCase() || 'HEALTHY'} · Direct connection pool active with instantaneous branch isolation.
              </Text>
            </View>
          </Surface>

          {/* Data Export & Reports */}
          <Surface style={{ marginBottom: 14, padding: 18, borderRadius: radii.xl }}>
            <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: colors.mint, marginBottom: 4 }}>
              ACCOUNT DATA & REPORTS
            </Text>
            <Text style={{ fontSize: 11, color: colors.muted, lineHeight: 16, marginBottom: 12 }}>
              Export a complete snapshot of your profile, active contacts, and settings.
            </Text>

            <Button title="Export Account Data (JSON)" kind="secondary" onPress={exportData} />

            {reports.length > 0 ? (
              <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.line }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.body, marginBottom: 8 }}>
                  Submitted Reports ({reports.length})
                </Text>
                {reports.slice(0, 5).map((report) => (
                  <View
                    key={report.id}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      paddingVertical: 6,
                    }}
                  >
                    <Text style={{ fontSize: 11, color: colors.body }}>
                      {report.category} · {new Date(report.created_at).toLocaleDateString()}
                    </Text>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.mint }}>
                      {report.status}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Surface>

          {/* Danger Zone */}
          <Surface style={{ marginBottom: 14, padding: 18, borderRadius: radii.xl, borderColor: 'rgba(224, 108, 117, 0.25)' }}>
            <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: colors.red, marginBottom: 4 }}>
              ACCOUNT ACTIONS
            </Text>
            <Text style={{ fontSize: 11, color: colors.muted, lineHeight: 16, marginBottom: 12 }}>
              Irreversible account actions and session termination.
            </Text>

            <View style={{ gap: 10 }}>
              {deletion ? (
                <>
                  <Notice tone="error">
                    Account deletion scheduled for {new Date(deletion.scheduled_for).toLocaleString()}.
                  </Notice>
                  <Button title="Cancel Scheduled Deletion" kind="secondary" onPress={cancelDeletion} />
                </>
              ) : (
                <Button title="Schedule Account Deletion" kind="danger" onPress={scheduleDeletion} />
              )}
              <Button title="Sign Out of Haiku" kind="ghost" onPress={doSignOut} />
            </View>
          </Surface>
        </>
      )}

      {/* Footer Disclaimer */}
      <Text
        style={{
          fontSize: 11,
          color: colors.muted,
          lineHeight: 16,
          textAlign: 'center',
          paddingHorizontal: 16,
          marginTop: 8,
        }}
      >
        Haiku Messenger enforces ephemeral retention and zero tracker telemetry. Peer backups and local device screenshots cannot be guaranteed erased.
      </Text>

      {/* Themed Confirmation Modal */}
      <ConfirmModal
        visible={confirmDialog.visible}
        title={confirmDialog.title}
        message={confirmDialog.message}
        buttons={confirmDialog.buttons}
        onDismiss={() => setConfirmDialog((d) => ({ ...d, visible: false }))}
      />
    </ScrollView>
  );
}
