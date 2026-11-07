import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Ably from 'ably';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { api, apiUrl, getSessionToken, messageForError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Avatar, ConfirmModal, ConfirmModalButton, EmptyState, Notice } from '../components/UI';
import { useTheme } from '../theme/ThemeContext';
import { useImmersive } from '../system/immersive';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;
type Message = {
  id: string;
  sender_id: string | null;
  message_type: 'text' | 'image' | 'video' | 'voice' | 'location';
  body: string | null;
  attachment_id: string | null;
  reply_to_id: string | null;
  created_at: string;
  edited_at: string | null;
  receipt_status?: 'sent' | 'delivered' | 'read' | null;
  sender?: { username: string; displayName: string } | null;
};
type ChannelSet = { realtime: Ably.Realtime; events: Ably.RealtimeChannel; ephemeral: Ably.RealtimeChannel };

const timeLabel = (value: string) => new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const expiryOptions: { value: 1 | 24 | 168 | null; label: string }[] = [
  { value: null, label: 'Off' },
  { value: 1, label: '1h' },
  { value: 24, label: '24h' },
  { value: 168, label: '7d' },
];

export function ChatScreen({ route, navigation }: Props) {
  const { conversationId, title, kind } = route.params;
  const { user } = useAuth();
  const { colors, radii, controls } = useTheme();
  const insets = useSafeAreaInsets();
  const { setImmersive } = useImmersive();

  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const [viewerControls, setViewerControls] = useState(true);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState('Connecting…');
  const [typing, setTyping] = useState(false);
  const [, setTypingEnabled] = useState(false);
  const [, setPresenceEnabled] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [expiresInHours, setExpiresInHours] = useState<1 | 24 | 168 | null>(null);

  // Themed modal dialog state
  const [modalDialog, setModalDialog] = useState<{
    visible: boolean;
    title: string;
    message?: string;
    buttons: ConfirmModalButton[];
  }>({ visible: false, title: '', buttons: [] });

  const ephemeralRef = useRef<Ably.RealtimeChannel | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const result = await api<{ messages: Message[]; hasMore: boolean }>(
        `/conversations/${conversationId}/messages?limit=50`
      );
      setMessages(result.messages || []);
      setHasMore(result.hasMore);
      await api(`/conversations/${conversationId}/read`, { method: 'POST' });
    } catch (e) {
      setError(messageForError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [conversationId]);

  const loadOlder = useCallback(async () => {
    if (!hasMore || loadingOlder || !messages.length) return;
    setLoadingOlder(true);
    try {
      const before = encodeURIComponent(messages[0].created_at);
      const result = await api<{ messages: Message[]; hasMore: boolean }>(
        `/conversations/${conversationId}/messages?limit=50&before=${before}`
      );
      setMessages((current) => [...(result.messages || []), ...current]);
      setHasMore(result.hasMore);
    } catch (e) {
      setError(messageForError(e));
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, hasMore, loadingOlder, messages]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      let channelSet: ChannelSet | undefined;
      void load();
      const connect = async () => {
        const token = await getSessionToken();
        if (!token) {
          setRealtimeStatus('Sign in to connect');
          return;
        }
        let preferences = { presenceVisible: false, typingIndicatorsEnabled: false };
        try {
          const result = await api<{ settings: { presence_visible: boolean; typing_indicators_enabled: boolean } }>(
            '/profile/settings'
          );
          preferences = {
            presenceVisible: result.settings.presence_visible !== false,
            typingIndicatorsEnabled: result.settings.typing_indicators_enabled !== false,
          };
        } catch {}
        if (!mounted) return;
        setPresenceEnabled(preferences.presenceVisible);
        setTypingEnabled(preferences.typingIndicatorsEnabled);
        const realtime = new Ably.Realtime({
          authUrl: `${apiUrl()}/conversations/realtime/token-request`,
          authMethod: 'POST',
          authHeaders: { Authorization: `Bearer ${token}` },
          autoConnect: true,
        });
        const events = realtime.channels.get(`haiku:conversation:${conversationId}:events`);
        const ephemeral = realtime.channels.get(`haiku:conversation:${conversationId}:ephemeral`);
        channelSet = { realtime, events, ephemeral };
        realtime.connection.on((change) => {
          if (!mounted) return;
          setRealtimeStatus(
            change.current === 'connected' ? 'Live' : change.current === 'failed' ? 'Offline · retrying' : change.current
          );
        });
        events.subscribe('message.created', () => {
          if (mounted) void load();
        });
        ephemeral.subscribe('typing', (message) => {
          if (message.clientId === user?.id) return;
          if (mounted) {
            setTyping(Boolean((message.data as { active?: boolean } | undefined)?.active));
            if (remoteTypingTimer.current) clearTimeout(remoteTypingTimer.current);
            remoteTypingTimer.current = setTimeout(() => setTyping(false), 1600);
          }
        });
        ephemeral.presence.subscribe();
        if (preferences.presenceVisible) {
          try {
            await ephemeral.presence.enter({ displayName: user?.displayName || 'Haiku member' });
          } catch {
            setRealtimeStatus('Realtime unavailable');
          }
        }
        ephemeralRef.current = ephemeral;
      };
      void connect().catch(() => setRealtimeStatus('Realtime not configured'));
      return () => {
        mounted = false;
        ephemeralRef.current = null;
        if (typingTimer.current) clearTimeout(typingTimer.current);
        if (remoteTypingTimer.current) clearTimeout(remoteTypingTimer.current);
        if (channelSet) {
          channelSet.ephemeral.presence.leave().catch(() => undefined);
          channelSet.events.unsubscribe();
          channelSet.ephemeral.unsubscribe();
          channelSet.realtime.close();
        }
      };
    }, [conversationId, load, user?.id, user?.displayName])
  );

  useEffect(() => {
    let active = true;
    const missing = messages.filter(
      (item) => item.attachment_id && !mediaUrls[item.attachment_id] && item.message_type !== 'voice'
    );
    if (missing.length) {
      Promise.all(
        missing.map(async (item) => {
          try {
            const result = await api<{ url: string }>(`/media/${item.attachment_id}`);
            return [item.attachment_id!, result.url] as const;
          } catch {
            return null;
          }
        })
      ).then((results) => {
        if (!active) return;
        setMediaUrls((prev) => {
          const next = { ...prev };
          for (const pair of results) if (pair) next[pair[0]] = pair[1];
          return next;
        });
      });
    }
    return () => {
      active = false;
    };
  }, [messages, mediaUrls]);

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError('');
    try {
      if (editingId) {
        await api(`/conversations/${conversationId}/messages/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify({ text: trimmed }),
        });
        setEditingId('');
      } else {
        await api(`/conversations/${conversationId}/messages`, {
          method: 'POST',
          body: JSON.stringify({
            text: trimmed,
            replyToId: replyingTo?.id || undefined,
            expiresInHours: expiresInHours || undefined,
          }),
        });
        setReplyingTo(null);
      }
      setText('');
      await load();
    } catch (e) {
      setError(messageForError(e));
    } finally {
      setSending(false);
    }
  };

  const uploadMedia = async () => {
    setError('');
    const picked = await launchImageLibrary({ mediaType: 'mixed', selectionLimit: 1, quality: 0.8 });
    if (picked.didCancel) return;
    if (picked.errorCode) {
      setError(picked.errorMessage || 'Could not open media library.');
      return;
    }
    const asset = picked.assets?.[0];
    if (!asset?.uri) {
      setError('Media could not be read.');
      return;
    }
    const rawType = (asset.type || 'image/jpeg').toLowerCase();
    const mediaType: 'image' | 'video' = rawType.startsWith('video') ? 'video' : 'image';
    const mimeType = rawType;
    const byteSize = asset.fileSize || 0;
    if (!byteSize) {
      setError('Could not read media size.');
      return;
    }
    setUploading(true);
    try {
      const intent = await api<{
        attachmentId: string;
        upload: { url: string; method: 'PUT'; headers: Record<string, string>; mode: 'proxy' | 'signed' };
      }>('/media/upload-intents', {
        method: 'POST',
        body: JSON.stringify({ purpose: 'message', mediaType, mimeType, byteSize }),
      });
      const blob = await (await fetch(asset.uri)).blob();
      const result = await fetch(intent.upload.url, {
        method: intent.upload.method,
        headers: intent.upload.headers,
        body: blob,
      });
      if (!result.ok) throw new Error(`Upload failed (${result.status}).`);
      if (intent.upload.mode === 'signed') await api(`/media/${intent.attachmentId}/complete`, { method: 'POST' });
      await api(`/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ attachmentId: intent.attachmentId }),
      });
      await load();
    } catch (e) {
      setError(messageForError(e));
    } finally {
      setUploading(false);
    }
  };

  const sendLocation = async () => {
    setModalDialog({
      visible: true,
      title: 'Share Location Pin',
      message: 'Would you like to share your location pin in this chat?',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Share Current Pin',
          style: 'primary',
          onPress: async () => {
            try {
              const geo = (globalThis as unknown as { navigator?: { geolocation?: { getCurrentPosition: (s: (pos: any) => void, e: () => void) => void } } })
                ?.navigator?.geolocation;
              if (geo) {
                geo.getCurrentPosition(
                  async (pos: { coords: { latitude: number; longitude: number; accuracy?: number } }) => {
                    try {
                      await api('/location/pin', {
                        method: 'POST',
                        body: JSON.stringify({
                          conversationId,
                          latitude: pos.coords.latitude,
                          longitude: pos.coords.longitude,
                          accuracy: pos.coords.accuracy,
                          title: 'Current Location',
                        }),
                      });
                      await load();
                    } catch (e) {
                      setError(messageForError(e));
                    }
                  },
                  () => setError('Location access was denied.')
                );
              } else {
                await api('/location/pin', {
                  method: 'POST',
                  body: JSON.stringify({
                    conversationId,
                    latitude: 9.03,
                    longitude: 38.74,
                    title: 'Pinned Location',
                  }),
                });
                await load();
              }
            } catch (e) {
              setError(messageForError(e));
            }
          },
        },
      ],
    });
  };

  const messageActions = (item: Message) => {
    const own = item.sender_id === user?.id;
    const buttons: ConfirmModalButton[] = [
      {
        text: 'Reply',
        style: 'primary',
        onPress: () => {
          setReplyingTo(item);
          setEditingId('');
        },
      },
    ];

    if (own && item.message_type === 'text' && Date.now() - new Date(item.created_at).getTime() < 15 * 60 * 1000) {
      buttons.push({
        text: 'Edit',
        onPress: () => {
          setEditingId(item.id);
          setReplyingTo(null);
          setText(item.body || '');
        },
      });
    }

    if (!own) {
      buttons.push({
        text: 'Report Message',
        style: 'destructive',
        onPress: () => {
          setModalDialog({
            visible: true,
            title: 'Report this message?',
            message: 'The message and its context will be reviewed by a moderator. Expired content cannot be recovered.',
            buttons: [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Report',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await api('/reports', {
                      method: 'POST',
                      body: JSON.stringify({ messageId: item.id, category: 'other' }),
                    });
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
      text: 'Delete for me',
      onPress: async () => {
        try {
          await api(`/conversations/${conversationId}/messages/${item.id}?mode=me`, { method: 'DELETE' });
          await load();
        } catch (e) {
          setError(messageForError(e));
        }
      },
    });

    if (own) {
      buttons.push({
        text: 'Delete for everyone',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/conversations/${conversationId}/messages/${item.id}?mode=everyone`, { method: 'DELETE' });
            await load();
          } catch (e) {
            setError(messageForError(e));
          }
        },
      });
    }

    buttons.push({ text: 'Cancel', style: 'cancel' });

    setModalDialog({
      visible: true,
      title: 'Message Options',
      message: own ? 'Manage this message.' : 'Reply or remove this message from your view.',
      buttons,
    });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const mine = item.sender_id === user?.id;
    const isMedia = Boolean(item.attachment_id) && item.message_type !== 'text';
    const bubbleBg = mine ? colors.bubbleMe : colors.bubbleOther;
    const bubbleTextColor = mine ? colors.bubbleMeText : colors.bubbleOtherText;

    return (
      <View style={{ width: '100%', alignItems: mine ? 'flex-end' : 'flex-start', paddingHorizontal: 14, marginBottom: 10 }}>
        {kind === 'group' && !mine && item.sender?.displayName ? (
          <Text style={{ fontSize: 11, color: colors.body, marginLeft: 8, marginBottom: 3 }}>
            {item.sender.displayName}
          </Text>
        ) : null}
        <Pressable
          onLongPress={() => messageActions(item)}
          style={{
            maxWidth: '84%',
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: radii.xl,
            borderBottomRightRadius: mine ? 4 : radii.xl,
            borderBottomLeftRadius: mine ? radii.xl : 4,
            backgroundColor: bubbleBg,
            borderWidth: mine ? 0 : 1,
            borderColor: colors.bubbleOtherBorder,
            elevation: 2,
          }}
        >
          {item.reply_to_id ? (
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: mine ? colors.mintPale : colors.mintAccent,
                marginBottom: 4,
              }}
            >
              Quoted reply
            </Text>
          ) : null}

          {isMedia && item.message_type === 'image' ? (
            mediaUrls[item.attachment_id!] ? (
              <Pressable
                onPress={() => {
                  setViewerImage(mediaUrls[item.attachment_id!]);
                  setViewerControls(true);
                }}
              >
                <Image
                  source={{ uri: mediaUrls[item.attachment_id!] }}
                  style={{ width: 220, height: 190, borderRadius: radii.md, backgroundColor: colors.mintPale }}
                  resizeMode="cover"
                />
              </Pressable>
            ) : (
              <View
                style={{
                  width: 210,
                  height: 110,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.mintPale,
                  borderRadius: radii.md,
                }}
              >
                <Text style={{ color: colors.mint, fontSize: 12 }}>Loading photo…</Text>
              </View>
            )
          ) : null}

          {isMedia && item.message_type === 'video' ? (
            <Pressable
              onPress={async () => {
                try {
                  const result = await api<{ url: string }>(`/media/${item.attachment_id}`);
                  await Linking.openURL(result.url);
                } catch (e) {
                  setError(messageForError(e));
                }
              }}
              style={{ padding: 13, backgroundColor: colors.mintPale, borderRadius: radii.md }}
            >
              <Text style={{ color: colors.mint, fontWeight: '700' }}>Open video</Text>
            </Pressable>
          ) : null}

          {item.message_type === 'location' && item.body
            ? (() => {
                try {
                  const loc = JSON.parse(item.body);
                  const lat = Number(loc.latitude);
                  const lng = Number(loc.longitude);
                  return (
                    <Pressable
                      onPress={() => Linking.openURL(`https://www.google.com/maps?q=${lat},${lng}`)}
                      style={{ padding: 10, backgroundColor: colors.mintPale, borderRadius: radii.md, marginVertical: 2 }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 18, color: colors.mint }}>⌖</Text>
                        <View>
                          <Text style={{ fontWeight: '700', fontSize: 13, color: colors.ink }}>
                            {loc.title || 'Shared Location'}
                          </Text>
                          <Text style={{ fontSize: 11, color: colors.muted }}>
                            {lat.toFixed(4)}, {lng.toFixed(4)}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 11, color: colors.mint, fontWeight: '700', marginTop: 5 }}>
                        Open in Maps ↗
                      </Text>
                    </Pressable>
                  );
                } catch {
                  return <Text style={{ color: bubbleTextColor }}>{item.body}</Text>;
                }
              })()
            : null}

          {item.message_type !== 'location' && item.body ? (
            <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: '400', color: bubbleTextColor }}>
              {item.body}
            </Text>
          ) : null}

          <Text
            style={{
              textAlign: 'right',
              fontSize: 11,
              fontWeight: '600',
              color: mine ? 'rgba(244, 250, 247, 0.7)' : colors.muted,
              marginTop: 5,
            }}
          >
            {timeLabel(item.created_at)}
            {item.edited_at ? ' · edited' : ''}
            {mine && item.receipt_status ? ` · ${item.receipt_status}` : ''}
          </Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      {/* Chat Header */}
      <View
        style={{
          paddingTop: insets.top,
          paddingLeft: Math.max(insets.left, 14),
          paddingRight: Math.max(insets.right, 14),
          height: 64 + insets.top,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
          backgroundColor: colors.panel,
        }}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={{
            width: controls.heights.md,
            height: controls.heights.md,
            borderRadius: radii.md,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.line,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 20, color: colors.mint, marginTop: -2 }}>‹</Text>
        </Pressable>
        <View style={{ position: 'relative' }}>
          <Avatar name={title} color={kind === 'group' ? colors.blue : colors.mint} />
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: realtimeStatus === 'Live' ? colors.mint : colors.muted,
              borderWidth: 1.5,
              borderColor: colors.canvas,
            }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontWeight: '800', fontSize: 16, color: colors.ink }}>
            {title}
          </Text>
          <Text style={{ fontSize: 11, color: realtimeStatus === 'Live' ? colors.mint : colors.muted, marginTop: 2 }}>
            {realtimeStatus === 'Live' ? 'Active now' : kind === 'group' ? 'Group conversation' : realtimeStatus}
          </Text>
        </View>
        <Pressable
          onPress={() => void load()}
          accessibilityRole="button"
          accessibilityLabel="Refresh messages"
          style={{
            width: controls.heights.md,
            height: controls.heights.md,
            borderRadius: radii.md,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.line,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 16, color: colors.mint }}>↻</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
          <Notice tone="error">{error}</Notice>
        </View>
      ) : null}

      {typing ? (
        <Text style={{ fontSize: 11, color: colors.muted, paddingHorizontal: 18, paddingTop: 7 }}>
          {title} is composing…
        </Text>
      ) : null}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 6 : 0}
      >
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>Loading conversation…</Text>
          </View>
        ) : messages.length === 0 ? (
          <EmptyState title="A fresh beginning." detail="Send a message to start this conversation." />
        ) : (
          <FlatList
            inverted
            data={[...messages].reverse()}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 12 }}
            keyboardShouldPersistTaps="handled"
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            refreshing={refreshing}
            onEndReached={() => {
              void loadOlder();
            }}
            onEndReachedThreshold={0.35}
            ListFooterComponent={
              loadingOlder ? (
                <Text style={{ textAlign: 'center', fontSize: 11, color: colors.muted, padding: 12 }}>
                  Loading older messages…
                </Text>
              ) : undefined
            }
          />
        )}

        {editingId ? (
          <View style={{ paddingHorizontal: 14, paddingTop: 7, flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 11, color: colors.mint, fontWeight: '700' }}>Editing message</Text>
            <Pressable
              onPress={() => {
                setEditingId('');
                setText('');
              }}
            >
              <Text style={{ fontSize: 11, color: colors.red, fontWeight: '700' }}>Cancel</Text>
            </Pressable>
          </View>
        ) : replyingTo ? (
          <View style={{ paddingHorizontal: 14, paddingTop: 7, flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text numberOfLines={1} style={{ fontSize: 11, color: colors.mint, fontWeight: '700', flex: 1 }}>
              Replying to {replyingTo.sender_id === user?.id ? 'yourself' : replyingTo.sender?.displayName || title}
            </Text>
            <Pressable onPress={() => setReplyingTo(null)}>
              <Text style={{ fontSize: 11, color: colors.red, fontWeight: '700' }}>Cancel</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Composer Container */}
        <View
          style={{
            paddingTop: 8,
            paddingLeft: Math.max(insets.left, 10),
            paddingRight: Math.max(insets.right, 10),
            paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 14 : 10),
            backgroundColor: colors.canvas,
          }}
        >
          {!editingId ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 5, paddingBottom: 7 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.7, color: colors.muted }}>
                DISAPPEARS
              </Text>
              {expiryOptions.map((option) => (
                <Pressable
                  key={option.label}
                  onPress={() => setExpiresInHours(option.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: expiresInHours === option.value }}
                  accessibilityLabel={option.value === null ? 'Messages do not expire' : `Messages expire after ${option.label}`}
                  style={{
                    paddingVertical: 5,
                    paddingHorizontal: 10,
                    borderRadius: radii.sm,
                    borderWidth: 1,
                    borderColor: expiresInHours === option.value ? colors.mint : colors.line,
                    backgroundColor: expiresInHours === option.value ? colors.mint : colors.card,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: expiresInHours === option.value ? colors.mintContrast : colors.muted,
                    }}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
              <Text numberOfLines={1} style={{ fontSize: 11, color: colors.muted, marginLeft: 2, flexShrink: 1 }}>
                {expiresInHours === null
                  ? 'Persistent chat'
                  : `Expires in ${expiresInHours === 168 ? '7d' : `${expiresInHours}h`}`}
              </Text>
            </View>
          ) : null}

          <View
            style={{
              minHeight: 52,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: radii.xl,
              backgroundColor: colors.panel,
            }}
          >
            <Pressable
              onPress={uploading ? undefined : uploadMedia}
              accessibilityRole="button"
              accessibilityLabel="Attach photo or video"
              style={{
                width: controls.heights.md,
                height: controls.heights.md,
                borderRadius: radii.md,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.line,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 20, color: colors.mint }}>{uploading ? '…' : '+'}</Text>
            </Pressable>

            <Pressable
              onPress={sendLocation}
              accessibilityRole="button"
              accessibilityLabel="Share location pin"
              style={{
                width: controls.heights.md,
                height: controls.heights.md,
                borderRadius: radii.md,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.line,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 16, color: colors.mint }}>⌖</Text>
            </Pressable>

            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={editingId ? 'Edit your message…' : 'Write a thoughtful message…'}
              placeholderTextColor={colors.muted}
              multiline
              style={{
                flex: 1,
                maxHeight: 110,
                minHeight: 36,
                paddingVertical: 8,
                color: colors.ink,
                fontSize: 14,
              }}
              editable={!uploading}
            />

            <Pressable
              onPress={send}
              disabled={!text.trim() || sending || uploading}
              accessibilityRole="button"
              accessibilityLabel={editingId ? 'Save edit' : 'Send message'}
              style={{
                width: controls.heights.md,
                height: controls.heights.md,
                borderRadius: radii.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: text.trim() ? colors.mint : colors.mintWash,
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '800',
                  color: text.trim() ? colors.mintContrast : colors.muted,
                }}
              >
                ↑
              </Text>
            </Pressable>
          </View>
          {uploading ? (
            <Text style={{ fontSize: 11, color: colors.muted, marginLeft: 9, marginTop: 5 }}>
              Uploading securely…
            </Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>

      {/* Themed Confirmation Modal */}
      <ConfirmModal
        visible={modalDialog.visible}
        title={modalDialog.title}
        message={modalDialog.message}
        buttons={modalDialog.buttons}
        onDismiss={() => setModalDialog((d) => ({ ...d, visible: false }))}
      />

      {/* Fullscreen Media Viewer with Immersive Tap-to-Toggle */}
      {viewerImage ? (
        <Modal
          visible={Boolean(viewerImage)}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setViewerImage(null);
            void setImmersive(true);
          }}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' }}
            onPress={() => {
              setViewerControls((prev) => {
                const next = !prev;
                void setImmersive(!next);
                return next;
              });
            }}
          >
            <Image
              source={{ uri: viewerImage }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="contain"
            />
            {viewerControls ? (
              <View
                style={{
                  position: 'absolute',
                  top: Math.max(insets.top, 16),
                  right: Math.max(insets.right, 16),
                }}
              >
                <Pressable
                  onPress={() => {
                    setViewerImage(null);
                    void setImmersive(true);
                  }}
                  style={{
                    padding: 10,
                    borderRadius: 20,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                  }}
                >
                  <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700' }}>✕</Text>
                </Pressable>
              </View>
            ) : null}
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}
