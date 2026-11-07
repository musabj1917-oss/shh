import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, Share, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api, messageForError } from '../api/client';
import type { RootStackParamList } from '../navigation/types';
import { Avatar, Button, ConfirmModal, EmptyState, LoadingState, Notice, Surface } from '../components/UI';
import { useTheme } from '../theme/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupDetail'>;
type Member = { id: string; username: string; display_name: string; role: 'owner' | 'admin' | 'member'; joined_at: string };
type Friend = { id: string; username: string; display_name: string };
type JoinRequest = { id: string; user_id: string; username: string; display_name: string; created_at: string };
type Invite = { id: string; created_at: string; expires_at: string; max_uses: number; uses: number; approval_required: boolean };

interface ModalDialogState {
  title: string;
  message?: string;
  buttons: Array<{
    text: string;
    style?: 'default' | 'cancel' | 'destructive' | 'primary';
    onPress?: () => void;
  }>;
}

export function GroupDetailScreen({ route }: Props) {
  const { groupId, name } = route.params;
  const { colors, radii, typography, controls } = useTheme();

  const [members, setMembers] = useState<Member[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [role, setRole] = useState(route.params.role);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [dialog, setDialog] = useState<ModalDialogState | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const [m, f, g] = await Promise.all([
        api<{ members: Member[] }>(`/groups/${groupId}/members`),
        api<{ friends: Friend[] }>('/friends'),
        api<{ role: string }>(`/groups/${groupId}`),
      ]);
      setMembers(m.members || []);
      setFriends(f.friends || []);
      setRole(g.role);
      if (g.role === 'owner' || g.role === 'admin') {
        const [requests, activeInvites] = await Promise.all([
          api<{ requests: JoinRequest[] }>(`/groups/${groupId}/join-requests`),
          api<{ invites: Invite[] }>(`/groups/${groupId}/invites`),
        ]);
        setJoinRequests(requests.requests || []);
        setInvites(activeInvites.invites || []);
      } else {
        setJoinRequests([]);
        setInvites([]);
      }
    } catch (e) {
      setError(messageForError(e));
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const isOwner = role === 'owner';
  const isAdmin = isOwner || role === 'admin';

  const remove = (member: Member) => {
    setDialog({
      title: 'Remove group member?',
      message: `${member.display_name} will no longer see this group’s messages.`,
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setBusy(member.id);
            try {
              await api(`/groups/${groupId}/members/${member.id}`, { method: 'DELETE' });
              await load();
            } catch (e) {
              setError(messageForError(e));
            } finally {
              setBusy('');
            }
          },
        },
      ],
    });
  };

  const promote = async (member: Member) => {
    setBusy(member.id);
    try {
      await api(`/groups/${groupId}/admins/${member.id}`, { method: 'PUT' });
      await load();
    } catch (e) {
      setError(messageForError(e));
    } finally {
      setBusy('');
    }
  };

  const transfer = (member: Member) => {
    setDialog({
      title: 'Transfer ownership?',
      message: `${member.display_name} will become the group owner.`,
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          style: 'destructive',
          onPress: async () => {
            setBusy(member.id);
            try {
              await api(`/groups/${groupId}/owner/${member.id}`, { method: 'PUT' });
              setDialog({
                title: 'Ownership transferred',
                message: 'Reopen group details to refresh your role.',
                buttons: [{ text: 'OK', style: 'primary' }],
              });
              await load();
            } catch (e) {
              setError(messageForError(e));
            } finally {
              setBusy('');
            }
          },
        },
      ],
    });
  };

  const invite = async () => {
    setBusy('invite');
    setError('');
    try {
      const result = await api<{
        invite: {
          id: string;
          token: string;
          url: string;
          expiresInHours: number;
          maxUses: number;
          approvalRequired: boolean;
        };
      }>(`/groups/${groupId}/invites`, {
        method: 'POST',
        body: JSON.stringify({ expiresInHours: 168, maxUses: 25, approvalRequired: true }),
      });
      let dismissed = false;
      try {
        const link = result.invite.url || `haikumessenger://join/${result.invite.token}`;
        const shared = await Share.share({
          message: `Join ${name} on Haiku Messenger.\n\n${link}\n\nExpires in 7 days; up to 25 people can request to join, subject to admin approval.`,
        });
        if (shared.action === Share.dismissedAction) {
          await api(`/groups/${groupId}/invites/${result.invite.id}`, { method: 'DELETE' });
          dismissed = true;
        }
      } catch (shareError) {
        try {
          await api(`/groups/${groupId}/invites/${result.invite.id}`, { method: 'DELETE' });
        } catch {}
        await load();
        throw shareError;
      }
      await load();
      if (dismissed) {
        setError('Invite was not shared, so the token was revoked. You can create a fresh link when ready.');
      }
    } catch (e) {
      setError(messageForError(e));
    } finally {
      setBusy('');
    }
  };

  const revokeInvite = (inviteItem: Invite) => {
    setDialog({
      title: 'Revoke invitation?',
      message: 'Anyone holding this link will no longer be able to use it.',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            setBusy(inviteItem.id);
            setError('');
            try {
              await api(`/groups/${groupId}/invites/${inviteItem.id}`, { method: 'DELETE' });
              await load();
            } catch (e) {
              setError(messageForError(e));
            } finally {
              setBusy('');
            }
          },
        },
      ],
    });
  };

  const addFriend = async (friend: Friend) => {
    setBusy(friend.id);
    setError('');
    try {
      await api(`/groups/${groupId}/members`, { method: 'POST', body: JSON.stringify({ userIds: [friend.id] }) });
      await load();
    } catch (e) {
      setError(messageForError(e));
    } finally {
      setBusy('');
    }
  };

  const addable = friends.filter((friend) => !members.some((member) => member.id === friend.id));

  const reportGroup = () => {
    setDialog({
      title: 'Report group?',
      message: 'The group will be sent to Haiku moderators for review.',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: async () => {
            try {
              await api('/reports', { method: 'POST', body: JSON.stringify({ groupId, category: 'other' }) });
              setDialog({
                title: 'Report submitted',
                message: 'Thank you for helping keep Haiku Messenger safer.',
                buttons: [{ text: 'OK', style: 'primary' }],
              });
            } catch (e) {
              setError(messageForError(e));
            }
          },
        },
      ],
    });
  };

  const resolveJoinRequest = async (request: JoinRequest, decision: 'accept' | 'reject') => {
    setBusy(request.id);
    setError('');
    try {
      await api(`/groups/${groupId}/join-requests/${request.id}/${decision}`, { method: 'POST' });
      await load();
    } catch (e) {
      setError(messageForError(e));
    } finally {
      setBusy('');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas, padding: 18 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <View>
          <Text
            style={{
              fontSize: typography.sizes.micro,
              fontWeight: '800',
              letterSpacing: 1.3,
              color: colors.mint,
            }}
          >
            GROUP INFO
          </Text>
          <Text
            style={{
              fontSize: typography.sizes.titleLg,
              fontWeight: '800',
              letterSpacing: -0.7,
              color: colors.ink,
              marginTop: 3,
            }}
          >
            {name}
          </Text>
          <Text style={{ fontSize: typography.sizes.micro, color: colors.muted, marginTop: 3 }}>
            {members.length} members · your role: {role}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {isAdmin ? <Button title="Invite link" onPress={invite} loading={busy === 'invite'} small /> : null}
          <Pressable
            onPress={reportGroup}
            style={{ padding: 6, minHeight: controls.heights.sm, justifyContent: 'center' }}
          >
            <Text style={{ fontSize: typography.sizes.micro, color: colors.muted, fontWeight: '700' }}>
              Report group
            </Text>
          </Pressable>
        </View>
      </View>

      {error ? <Notice tone="error">{error}</Notice> : null}

      {isAdmin && addable.length ? (
        <View style={{ marginBottom: 11 }}>
          <Text
            style={{
              fontSize: typography.sizes.micro,
              fontWeight: '800',
              color: colors.muted,
              marginBottom: 7,
            }}
          >
            ADD A FRIEND
          </Text>
          <FlatList
            horizontal
            data={addable}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => addFriend(item)}
                disabled={Boolean(busy)}
                style={{ alignItems: 'center', marginRight: 13, width: 62 }}
              >
                <Avatar name={item.display_name} />
                <Text numberOfLines={1} style={{ fontSize: typography.sizes.micro, color: colors.body, marginTop: 4 }}>
                  {item.display_name}
                </Text>
                {busy === item.id ? (
                  <Text style={{ fontSize: typography.sizes.micro, color: colors.mint }}>Adding…</Text>
                ) : null}
              </Pressable>
            )}
          />
        </View>
      ) : null}

      {isAdmin ? (
        <Surface style={{ marginBottom: 10, padding: 12, borderRadius: radii.lg }}>
          <Text style={{ fontSize: typography.sizes.caption, fontWeight: '800', color: colors.ink }}>
            Active invitation links · {invites.length}
          </Text>
          <Text
            style={{
              fontSize: typography.sizes.micro,
              lineHeight: 16,
              color: colors.muted,
              marginTop: 4,
              marginBottom: 5,
            }}
          >
            Links are shown only once when created. You can revoke any active link here.
          </Text>
          {invites.length ? (
            invites.map((inv) => (
              <View
                key={inv.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingVertical: 8,
                  borderTopWidth: 1,
                  borderTopColor: colors.line,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: typography.sizes.micro, fontWeight: '700', color: colors.ink }}>
                    {inv.uses}/{inv.max_uses} requests used · {inv.approval_required ? 'approval required' : 'instant join'}
                  </Text>
                  <Text style={{ fontSize: typography.sizes.micro, color: colors.muted, marginTop: 3 }}>
                    Expires {new Date(inv.expires_at).toLocaleString()}
                  </Text>
                </View>
                <Pressable
                  onPress={() => revokeInvite(inv)}
                  disabled={Boolean(busy)}
                  style={{ padding: 7, minHeight: controls.heights.sm, justifyContent: 'center' }}
                >
                  <Text style={{ fontSize: typography.sizes.micro, color: colors.red, fontWeight: '800' }}>
                    {busy === inv.id ? 'Revoking…' : 'Revoke'}
                  </Text>
                </Pressable>
              </View>
            ))
          ) : (
            <Text style={{ fontSize: typography.sizes.micro, color: colors.muted, marginTop: 8 }}>
              No active invite links. Create one using Invite link above.
            </Text>
          )}
        </Surface>
      ) : null}

      {isAdmin && joinRequests.length ? (
        <Surface style={{ marginBottom: 10, padding: 12, borderRadius: radii.lg }}>
          <Text style={{ fontSize: typography.sizes.caption, fontWeight: '800', color: colors.ink, marginBottom: 5 }}>
            Join requests · {joinRequests.length}
          </Text>
          {joinRequests.slice(0, 5).map((request) => (
            <View
              key={request.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 7,
                paddingVertical: 7,
                borderTopWidth: 1,
                borderTopColor: colors.line,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: typography.sizes.micro, fontWeight: '700', color: colors.ink }}>
                  {request.display_name}
                </Text>
                <Text style={{ fontSize: typography.sizes.micro, color: colors.muted }}>@{request.username}</Text>
              </View>
              <Pressable
                onPress={() => resolveJoinRequest(request, 'accept')}
                disabled={Boolean(busy)}
                style={{ padding: 6, minHeight: controls.heights.sm, justifyContent: 'center' }}
              >
                <Text style={{ fontSize: typography.sizes.micro, color: colors.mint, fontWeight: '800' }}>Accept</Text>
              </Pressable>
              <Pressable
                onPress={() => resolveJoinRequest(request, 'reject')}
                disabled={Boolean(busy)}
                style={{ padding: 6, minHeight: controls.heights.sm, justifyContent: 'center' }}
              >
                <Text style={{ fontSize: typography.sizes.micro, color: colors.red, fontWeight: '800' }}>Decline</Text>
              </Pressable>
            </View>
          ))}
        </Surface>
      ) : null}

      {loading ? (
        <LoadingState message="Loading members…" />
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 30, flexGrow: 1 }}
          ListEmptyComponent={
            <EmptyState title="No members yet." detail="Group membership will appear here." />
          }
          renderItem={({ item }) => (
            <Surface
              style={{
                padding: 12,
                marginBottom: 8,
                borderRadius: radii.lg,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.line,
              }}
            >
              <Avatar name={item.display_name} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: typography.sizes.caption, fontWeight: '700', color: colors.ink }}>
                  {item.display_name}
                </Text>
                <Text style={{ fontSize: typography.sizes.micro, color: colors.muted, marginTop: 3 }}>
                  @{item.username} · {item.role}
                </Text>
              </View>
              {isOwner && item.role === 'member' ? (
                <Pressable
                  onPress={() => promote(item)}
                  disabled={Boolean(busy)}
                  style={{ padding: 7, minHeight: controls.heights.sm, justifyContent: 'center' }}
                >
                  <Text style={{ fontSize: typography.sizes.micro, color: colors.mint, fontWeight: '800' }}>
                    Make admin
                  </Text>
                </Pressable>
              ) : null}
              {isOwner && item.role !== 'owner' ? (
                <Pressable
                  onPress={() => transfer(item)}
                  disabled={Boolean(busy)}
                  style={{ padding: 7, minHeight: controls.heights.sm, justifyContent: 'center' }}
                >
                  <Text style={{ fontSize: typography.sizes.micro, color: colors.blue, fontWeight: '800' }}>
                    Transfer
                  </Text>
                </Pressable>
              ) : null}
              {isOwner && item.role !== 'owner' ? (
                <Pressable
                  onPress={() => remove(item)}
                  disabled={Boolean(busy)}
                  style={{ padding: 7, minHeight: controls.heights.sm, justifyContent: 'center' }}
                >
                  <Text style={{ fontSize: typography.sizes.micro, color: colors.red, fontWeight: '800' }}>
                    Remove
                  </Text>
                </Pressable>
              ) : null}
            </Surface>
          )}
        />
      )}

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
    </View>
  );
}
