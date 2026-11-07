import React, { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api, messageForError } from '../api/client';
import type { RootStackParamList } from '../navigation/types';
import { Button, ConfirmModal, LoadingState, Notice, RemoteAvatar, Surface } from '../components/UI';
import { useTheme } from '../theme/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'PublicProfile'>;
type Profile = {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  location: string | null;
  avatar_object_key: string | null;
  created_at: string;
};

interface ModalDialogState {
  title: string;
  message?: string;
  buttons: Array<{
    text: string;
    style?: 'default' | 'cancel' | 'destructive' | 'primary';
    onPress?: () => void;
  }>;
}

export function PublicProfileScreen({ route, navigation }: Props) {
  const { userId } = route.params;
  const { colors, radii, typography } = useTheme();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [isFriend, setIsFriend] = useState(false);
  const [requestState, setRequestState] = useState<'none' | 'incoming' | 'outgoing'>('none');
  const [requestId, setRequestId] = useState('');
  const [avatar, setAvatar] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialog, setDialog] = useState<ModalDialogState | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const [result, outgoing, incoming] = await Promise.all([
        api<{ profile: Profile; isFriend: boolean }>(`/profile/id/${userId}`),
        api<{ requests: { id: string; user_id: string }[] }>('/friends/requests?direction=outgoing'),
        api<{ requests: { id: string; user_id: string }[] }>('/friends/requests?direction=incoming'),
      ]);
      setProfile(result.profile);
      setIsFriend(result.isFriend);
      const sent = outgoing.requests.find((item) => item.user_id === userId);
      const received = incoming.requests.find((item) => item.user_id === userId);
      if (result.isFriend) {
        setRequestState('none');
        setRequestId('');
      } else if (received) {
        setRequestState('incoming');
        setRequestId(received.id);
      } else if (sent) {
        setRequestState('outgoing');
        setRequestId(sent.id);
      } else {
        setRequestState('none');
        setRequestId('');
      }
      try {
        const image = await api<{ url: string }>(`/media/avatars/${userId}`);
        setAvatar(image.url);
      } catch {
        setAvatar('');
      }
    } catch (e) {
      setError(messageForError(e));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const updateFriendRequest = async () => {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      if (requestState === 'incoming') {
        await api(`/friends/requests/${requestId}/accept`, { method: 'POST' });
        setIsFriend(true);
        setRequestState('none');
        setSuccess('Friend request accepted. You can now start a private chat.');
      } else if (requestState === 'outgoing') {
        await api(`/friends/requests/${requestId}`, { method: 'DELETE' });
        setRequestState('none');
        setSuccess('Friend request canceled.');
      } else {
        await api(`/friends/requests/${userId}`, { method: 'POST' });
        setRequestState('outgoing');
        setSuccess('Friend request sent. They need to accept before you can start a private chat.');
      }
    } catch (e) {
      setError(messageForError(e));
    } finally {
      setBusy(false);
    }
  };

  const startChat = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await api<{ conversationId: string }>(`/conversations/direct/${userId}`, {
        method: 'POST',
      });
      navigation.navigate('Chat', {
        conversationId: result.conversationId,
        title: profile?.display_name || 'Conversation',
        kind: 'direct',
      });
    } catch (e) {
      setError(messageForError(e));
    } finally {
      setBusy(false);
    }
  };

  const accountActions = () => {
    const buttons: ModalDialogState['buttons'] = [];
    if (isFriend) {
      buttons.push({
        text: 'Remove friend',
        style: 'destructive',
        onPress: () => {
          setDialog({
            title: 'Remove friend?',
            message: 'This removes the friendship and disables direct messaging.',
            buttons: [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Remove',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await api(`/friends/${userId}`, { method: 'DELETE' });
                    setIsFriend(false);
                    setSuccess('Friend removed.');
                  } catch (e) {
                    setError(messageForError(e));
                  }
                },
              },
            ],
          });
        },
      });
    }
    buttons.push({
      text: 'Report account',
      onPress: async () => {
        try {
          await api('/reports', {
            method: 'POST',
            body: JSON.stringify({ targetUserId: userId, category: 'other' }),
          });
          setSuccess('Report submitted for review.');
        } catch (e) {
          setError(messageForError(e));
        }
      },
    });
    buttons.push({
      text: 'Block account',
      style: 'destructive',
      onPress: () => {
        setDialog({
          title: 'Block account?',
          message: 'You will no longer see or message each other. This removes any friendship.',
          buttons: [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Block',
              style: 'destructive',
              onPress: async () => {
                setBusy(true);
                try {
                  await api(`/friends/blocks/${userId}`, { method: 'POST' });
                  navigation.goBack();
                } catch (e) {
                  setError(messageForError(e));
                } finally {
                  setBusy(false);
                }
              },
            },
          ],
        });
      },
    });
    buttons.push({ text: 'Cancel', style: 'cancel' });

    setDialog({
      title: profile?.display_name || 'Account',
      message: 'Choose an action.',
      buttons,
    });
  };

  if (loading) return <LoadingState message="Opening profile…" />;
  if (!profile) {
    return (
      <View style={{ flex: 1, padding: 20, justifyContent: 'center', backgroundColor: colors.canvas }}>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button title="Go back" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      contentContainerStyle={{ padding: 18, paddingTop: 25, paddingBottom: 34 }}
    >
      {error ? <Notice tone="error">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}

      <Surface style={{ alignItems: 'center', padding: 24, borderRadius: radii.xxl }}>
        <RemoteAvatar name={profile.display_name} uri={avatar} large />
        <Text
          style={{
            fontSize: typography.sizes.titleLg,
            fontWeight: '800',
            letterSpacing: -0.6,
            color: colors.ink,
            marginTop: 13,
          }}
        >
          {profile.display_name}
        </Text>
        <Text style={{ fontSize: typography.sizes.micro, color: colors.muted, marginTop: 4 }}>
          @{profile.username}
        </Text>
        {profile.location ? (
          <Text style={{ fontSize: typography.sizes.micro, color: colors.body, marginTop: 11 }}>
            ⌖ {profile.location}
          </Text>
        ) : null}
        {profile.bio ? (
          <Text
            style={{
              fontSize: typography.sizes.sub,
              lineHeight: 20,
              color: colors.body,
              textAlign: 'center',
              marginTop: 15,
            }}
          >
            {profile.bio}
          </Text>
        ) : (
          <Text style={{ fontSize: typography.sizes.micro, color: colors.muted, marginTop: 12 }}>
            A little mystery, in a good way.
          </Text>
        )}

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 20, width: '100%' }}>
          {isFriend ? (
            <Button title="Message" onPress={startChat} loading={busy} style={{ flex: 1 }} />
          ) : (
            <Button
              title={
                requestState === 'incoming'
                  ? 'Accept request'
                  : requestState === 'outgoing'
                  ? 'Cancel request'
                  : 'Add friend'
              }
              onPress={updateFriendRequest}
              loading={busy}
              style={{ flex: 1 }}
            />
          )}
          <Button title="···" kind="secondary" onPress={accountActions} style={{ width: 52 }} />
        </View>
      </Surface>

      <Surface style={{ marginTop: 12, padding: 14, borderRadius: radii.lg }}>
        <Text style={{ fontSize: typography.sizes.caption, fontWeight: '800', color: colors.ink }}>
          A note about privacy
        </Text>
        <Text style={{ fontSize: typography.sizes.micro, lineHeight: 16, color: colors.muted, marginTop: 5 }}>
          Private conversations are available only after a friend request is accepted. Haiku Messenger does not claim
          end-to-end encryption.
        </Text>
      </Surface>

      {/* Themed Dialog Modal */}
      {dialog ? (
        <ConfirmModal
          visible={Boolean(dialog)}
          title={dialog.title}
          message={dialog.message}
          buttons={dialog.buttons.map((b) => ({
            ...b,
            onPress: () => {
              setDialog(null);
              b.onPress?.();
            },
          }))}
          onDismiss={() => setDialog(null)}
        />
      ) : null}
    </ScrollView>
  );
}
