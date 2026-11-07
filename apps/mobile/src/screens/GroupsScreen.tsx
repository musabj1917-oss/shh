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
  Screen,
  Surface,
} from '../components/UI';
import { MoreHorizontalIcon, PlusIcon } from '../components/Icons';
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
  const [_busy, setBusy] = useState(false);
  const [_joining, setJoining] = useState(false);
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
    <Screen style={{ paddingHorizontal: 18, paddingTop: 18, backgroundColor: colors.canvas }}>
      {/* Editorial Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 18,
        }}
      >
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text
            style={{
              fontSize: typography.sizes.micro,
              fontWeight: '800',
              letterSpacing: 1.6,
              color: colors.mint,
              textTransform: 'uppercase',
            }}
          >
            TOGETHER
          </Text>
          <Text
            style={{
              fontSize: typography.sizes.display,
              fontWeight: '800',
              letterSpacing: -0.9,
              color: colors.ink,
              marginTop: 4,
            }}
          >
            Groups
          </Text>
          <Text style={{ fontSize: typography.sizes.sub, color: colors.muted, marginTop: 4 }}>
            Shared spaces for conversations and teams.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Pressable
            onPress={() => {
              setJoinModal(true);
              setError('');
            }}
            accessibilityRole="button"
            accessibilityLabel="Join group"
            style={({ pressed }) => [
              {
                paddingVertical: 9,
                paddingHorizontal: 13,
                borderRadius: radii.pill,
                borderCurve: 'continuous',
                backgroundColor: colors.panel,
                borderWidth: 1,
                borderColor: colors.line,
                minHeight: controls.heights.sm,
                justifyContent: 'center',
              },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>Join</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setModal(true);
              setError('');
            }}
            accessibilityRole="button"
            accessibilityLabel="Create group"
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                paddingVertical: 9,
                paddingHorizontal: 13,
                borderRadius: radii.pill,
                borderCurve: 'continuous',
                backgroundColor: colors.mint,
                minHeight: controls.heights.sm,
                justifyContent: 'center',
              },
              pressed && { opacity: 0.85 },
            ]}
          >
            <PlusIcon size={15} color={colors.mintContrast} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.mintContrast }}>New</Text>
          </Pressable>
        </View>
      </View>

      {error ? <Notice tone="error">{error}</Notice> : null}

      {loading ? (
        <LoadingState message="Loading groups…" />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 36 }}
          ListEmptyComponent={
            <EmptyState
              title="Better together."
              detail="Create a group to bring your friends into one conversation."
              action={
                <Button
                  title="Create a group"
                  onPress={() => setModal(true)}
                  small
                  style={{ minHeight: controls.heights.sm }}
                />
              }
            />
          }
          renderItem={({ item }) => (
            <Surface
              style={{
                padding: 14,
                marginBottom: 10,
                borderRadius: radii.xl,
                borderCurve: 'continuous',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
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
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                <Avatar name={item.name} color={colors.blue} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontSize: typography.sizes.body, fontWeight: '800', color: colors.ink }}>
                    {item.name}
                  </Text>
                  <Text style={{ fontSize: typography.sizes.micro, color: colors.muted, marginTop: 3 }}>
                    {item.member_count} {item.member_count === 1 ? 'member' : 'members'} · {item.role}
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
                style={({ pressed }) => [
                  {
                    width: 44,
                    height: 44,
                    borderRadius: radii.pill,
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                  pressed && { backgroundColor: colors.stitch },
                ]}
              >
                <MoreHorizontalIcon size={18} color={colors.muted} />
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
        <View style={{ marginTop: 8 }}>
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
        <View style={{ marginTop: 8 }}>
          {error ? <Notice tone="error">{error}</Notice> : null}
          <Field
            label="Group name"
            value={name}
            onChangeText={setName}
            placeholder="e.g., Mountain Climbers, Project Apex"
          />

          <Text
            style={{
              fontSize: typography.sizes.micro,
              fontWeight: '800',
              color: colors.muted,
              letterSpacing: 1.2,
              marginTop: 10,
              marginBottom: 8,
              textTransform: 'uppercase',
            }}
          >
            ADD FRIENDS ({selected.length})
          </Text>

          {friends.length === 0 ? (
            <Text style={{ fontSize: typography.sizes.micro, color: colors.muted, fontStyle: 'italic', marginBottom: 10 }}>
              No friends to invite yet. You can invite members after creating the group.
            </Text>
          ) : (
            <View style={{ maxHeight: 200, marginBottom: 8 }}>
              <FlatList
                data={friends}
                keyExtractor={(item) => item.id}
                nestedScrollEnabled
                renderItem={({ item }) => {
                  const isChecked = selected.includes(item.id);
                  return (
                    <Pressable
                      onPress={() => toggle(item.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isChecked }}
                      style={({ pressed }) => [
                        {
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          borderRadius: radii.md,
                          borderCurve: 'continuous',
                          backgroundColor: isChecked ? colors.mintWash : colors.inputBg,
                          borderWidth: 1,
                          borderColor: isChecked ? colors.mint : colors.line,
                          marginBottom: 6,
                        },
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Avatar name={item.display_name} size={30} />
                        <Text style={{ fontSize: typography.sizes.sub, fontWeight: '700', color: colors.ink }}>
                          {item.display_name}
                        </Text>
                      </View>
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 6,
                          borderCurve: 'continuous',
                          borderWidth: 2,
                          borderColor: isChecked ? colors.mint : colors.line,
                          backgroundColor: isChecked ? colors.mint : 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {isChecked ? (
                          <Text style={{ fontSize: 11, fontWeight: '900', color: colors.mintContrast }}>✓</Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                }}
              />
            </View>
          )}
        </View>
      </ConfirmModal>

      {/* Action / Result dialog */}
      {dialog ? (
        <ConfirmModal
          visible={true}
          title={dialog.title}
          message={dialog.message}
          onDismiss={() => setDialog(null)}
          buttons={dialog.buttons.map((b) => ({
            ...b,
            onPress: () => {
              setDialog(null);
              b.onPress?.();
            },
          }))}
        />
      ) : null}
    </Screen>
  );
}
