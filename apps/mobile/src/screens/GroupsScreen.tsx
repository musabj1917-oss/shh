import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api, messageForError } from '../api/client';
import { inviteTokenFromUrl } from '../invites';
import type { RootStackParamList } from '../navigation/types';
import {
  Avatar,
  Button,
  ConfirmModal,
  EmptyState,
  Field,
  LoadingState,
  Notice,
  Surface,
} from '../components/UI';
import { useTheme } from '../theme/ThemeContext';

type Group = {
  id: string;
  conversation_id: string;
  name: string;
  role: string;
  member_count: number;
  last_message?: string | null;
};
type Friend = { id: string; username: string; display_name: string };

interface ModalDialogState {
  title: string;
  message?: string;
  buttons: Array<{
    text: string;
    style?: 'default' | 'cancel' | 'destructive' | 'primary';
    onPress?: () => void;
  }>;
}

export function GroupsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors, radii, typography, controls } = useTheme();

  const [groups, setGroups] = useState<Group[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [joinToken, setJoinToken] = useState('');
  const [modal, setModal] = useState(false);
  const [joinModal, setJoinModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<ModalDialogState | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const [g, f] = await Promise.all([
        api<{ groups: Group[] }>('/groups'),
        api<{ friends: Friend[] }>('/friends'),
      ]);
      setGroups(g.groups || []);
      setFriends(f.friends || []);
    } catch (e) {
      setError(messageForError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const create = async () => {
    if (!name.trim()) {
      setError('Add a group name.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api('/groups', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), memberIds: selected }),
      });
      setModal(false);
      setName('');
      setSelected([]);
      await load();
    } catch (e) {
      setError(messageForError(e));
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    const raw = joinToken.trim();
    const token = inviteTokenFromUrl(raw) || raw;
    if (!token) {
      setError('Enter an invitation link or token.');
      return;
    }
    setJoining(true);
    setError('');
    try {
      const result = await api<{
        status: 'joined' | 'approval_required';
        groupId?: string;
        groupName?: string;
      }>('/groups/join/' + encodeURIComponent(token), { method: 'POST' });
      setJoinModal(false);
      setJoinToken('');
      if (result.status === 'approval_required') {
        setDialog({
          title: 'Request sent',
          message: 'A group admin will review your request.',
          buttons: [{ text: 'OK', style: 'primary' }],
        });
      } else {
        setDialog({
          title: 'You’re in',
          message: 'You joined the group.',
          buttons: [{ text: 'OK', style: 'primary' }],
        });
      }
      await load();
    } catch (e) {
      setError(messageForError(e));
    } finally {
      setJoining(false);
    }
  };

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas, padding: 18, paddingTop: 20 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <View>
          <Text
            style={{
              fontSize: typography.sizes.micro,
              fontWeight: '800',
              letterSpacing: 1.4,
              color: colors.mint,
            }}
          >
            TOGETHER
          </Text>
          <Text
            style={{
              fontSize: typography.sizes.display,
              fontWeight: '800',
              letterSpacing: -0.8,
              color: colors.ink,
              marginTop: 3,
            }}
          >
            Your groups
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 7 }}>
          <Button
            title="Join"
            kind="secondary"
            onPress={() => {
              setJoinModal(true);
              setError('');
            }}
            small
          />
          <Button
            title="＋ New"
            onPress={() => {
              setModal(true);
              setError('');
            }}
            small
          />
        </View>
      </View>

      {error ? <Notice tone="error">{error}</Notice> : null}

      {loading ? (
        <LoadingState message="Loading groups…" />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 30 }}
          ListEmptyComponent={
            <EmptyState
              title="Better together."
              detail="Create a group to bring your friends into one conversation."
              action={<Button title="Create a group" onPress={() => setModal(true)} small />}
            />
          }
          renderItem={({ item }) => (
            <Surface
              style={{
                padding: 13,
                marginBottom: 9,
                borderRadius: radii.xl,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 11,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.line,
              }}
            >
              <Pressable
                onPress={() =>
                  navigation.navigate('Chat', {
                    conversationId: item.conversation_id,
                    title: item.name,
                    kind: 'group',
                  })
                }
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}
              >
                <Avatar name={item.name} color={colors.blue} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontSize: typography.sizes.sub, fontWeight: '800', color: colors.ink }}>
                    {item.name}
                  </Text>
                  <Text style={{ fontSize: typography.sizes.micro, color: colors.muted, marginTop: 3 }}>
                    {item.member_count} members · {item.role}
                  </Text>
                  <Text numberOfLines={1} style={{ fontSize: typography.sizes.micro, color: colors.body, marginTop: 4 }}>
                    {item.last_message || 'Start your group conversation'}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                onPress={() =>
                  navigation.navigate('GroupDetail', {
                    groupId: item.id,
                    name: item.name,
                    role: item.role,
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`Manage ${item.name}`}
                style={{ padding: 8, minHeight: controls.heights.sm, justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 19, color: colors.mint }}>···</Text>
              </Pressable>
            </Surface>
          )}
        />
      )}

      {/* Themed Join Group Modal */}
      <ConfirmModal
        visible={joinModal}
        title="Join a group"
        message="Paste the invitation link or token shared by a group member."
        onDismiss={() => setJoinModal(false)}
        buttons={[
          { text: 'Cancel', style: 'cancel', onPress: () => setJoinModal(false) },
          { text: 'Continue', style: 'primary', onPress: join },
        ]}
      >
        <View style={{ marginTop: 6 }}>
          {error ? <Notice tone="error">{error}</Notice> : null}
          <Field
            label="Invitation link or token"
            value={joinToken}
            onChangeText={setJoinToken}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </ConfirmModal>

      {/* Themed Create Group Modal */}
      <ConfirmModal
        visible={modal}
        title="Create a group"
        message="You’ll be the owner. Choose friends to add now or later."
        onDismiss={() => setModal(false)}
        buttons={[
          { text: 'Cancel', style: 'cancel', onPress: () => setModal(false) },
          { text: 'Create group', style: 'primary', onPress: create },
        ]}
      >
        <View style={{ marginTop: 6, maxHeight: 320 }}>
          {error ? <Notice tone="error">{error}</Notice> : null}
          <Field label="Group name" value={name} onChangeText={setName} placeholder="Weekend plans" maxLength={80} />
          <Text
            style={{
              fontSize: typography.sizes.micro,
              fontWeight: '700',
              color: colors.body,
              marginBottom: 7,
              marginTop: 4,
            }}
          >
            Add friends · {selected.length} selected
          </Text>
          <FlatList
            data={friends}
            keyExtractor={(item) => item.id}
            style={{ maxHeight: 180 }}
            ListEmptyComponent={
              <Text style={{ fontSize: typography.sizes.micro, color: colors.muted, padding: 12 }}>
                Add friends first, or create an empty group.
              </Text>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => toggle(item.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 9,
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.line,
                }}
              >
                <Avatar name={item.display_name} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: typography.sizes.caption, fontWeight: '700', color: colors.ink }}>
                    {item.display_name}
                  </Text>
                  <Text style={{ fontSize: typography.sizes.micro, color: colors.muted }}>@{item.username}</Text>
                </View>
                <Text
                  style={{
                    fontSize: 16,
                    color: selected.includes(item.id) ? colors.mint : colors.muted,
                  }}
                >
                  {selected.includes(item.id) ? '●' : '○'}
                </Text>
              </Pressable>
            )}
          />
        </View>
      </ConfirmModal>

      {/* Themed Alerts/Dialogs */}
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
    </View>
  );
}
