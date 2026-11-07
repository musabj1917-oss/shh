import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Ably from 'ably';
import {
  FlatList,
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
import { Image as ExpoImage } from 'expo-image';
import type { RootStackParamList } from '../navigation/types';
import { api, apiUrl, getSessionToken, messageForError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Avatar, ConfirmModal, ConfirmModalButton, EmptyState } from '../components/UI';
import { BackIcon, MapPinIcon, PaperclipIcon, SendIcon } from '../components/Icons';
import { useTheme } from '../theme/ThemeContext';
import { useImmersive } from '../system/immersive';
import { ExpiringBubble, ExpiryCaption, fetchMediaUrl, MediaImage } from '../media';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

export type Message = {
  id: string;
  sender_id: string | null;
  message_type: 'text' | 'image' | 'video' | 'voice' | 'location';
  body: string | null;
  attachment_id: string | null;
  reply_to_id: string | null;
  created_at: string;
  edited_at: string | null;
  expires_at?: string | null;
  receipt_status?: 'sent' | 'delivered' | 'read' | null;
  sender?: { username: string; displayName: string } | null;
  width?: number;
  height?: number;
  duration?: number;
};

type ChannelSet = { realtime: Ably.Realtime; events: Ably.RealtimeChannel; ephemeral: Ably.RealtimeChannel };

const timeLabel = (value: string) => new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const expiryOptions: { value: 1 | 24 | 168 | null; label: string }[] = [
  { value: null, label: 'Off' },
  { value: 1, label: '1h' },
  { value: 24, label: '24h' },
  { value: 168, label: '7d' },
];

interface MessageRowProps {
  item: Message;
  mine: boolean;
  isExpiring: boolean;
  kind: 'direct' | 'group';
  colors: ReturnType<typeof useTheme>['colors'];
  radii: ReturnType<typeof useTheme>['radii'];
  onLongPress: (item: Message) => void;
  onImagePress: (attachmentId: string) => void;
  onVideoPress: (attachmentId: string) => void;
  onExpired: (id: string) => void;
}

const MessageRow = memo(function MessageRow({
  item,
  mine,
  isExpiring,
  kind,
  colors,
  radii,
  onLongPress,
  onImagePress,
  onVideoPress,
  onExpired,
}: MessageRowProps) {
  const isMedia = Boolean(item.attachment_id) && item.message_type !== 'text';
  const bubbleBg = mine ? colors.bubbleMe : colors.bubbleOther;
  const bubbleTextColor = mine ? colors.bubbleMeText : colors.bubbleOtherText;

  return (
    <ExpiringBubble isExpiring={isExpiring} onExpired={() => onExpired(item.id)}>
      <View style={{ width: '100%', alignItems: mine ? 'flex-end' : 'flex-start', paddingHorizontal: 14, marginBottom: 10 }}>
        {kind === 'group' && !mine && item.sender?.displayName ? (
          <Text style={{ fontSize: 11, color: colors.body, marginLeft: 8, marginBottom: 3 }}>
            {item.sender.displayName}
          </Text>
        ) : null}

        <Pressable
          onLongPress={() => onLongPress(item)}
          style={{
            maxWidth: '84%',
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: radii.xl,
            borderBottomRightRadius: mine ? 4 : radii.xl,
            borderBottomLeftRadius: mine ? radii.xl : 4,
            borderCurve: 'continuous',
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

          {isMedia && item.message_type === 'image' && item.attachment_id ? (
            <MediaImage
              attachmentId={item.attachment_id}
              width={240}
              height={item.height}
              aspectRatio={item.width && item.height ? item.width / item.height : 4 / 3}
              onPress={() => onImagePress(item.attachment_id!)}
            />
          ) : null}

          {isMedia && item.message_type === 'video' && item.attachment_id ? (
            <Pressable
              onPress={() => onVideoPress(item.attachment_id!)}
              style={{
                width: 240,
                height: 140,
                backgroundColor: colors.card,
                borderRadius: radii.md,
                overflow: 'hidden',
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: colors.line,
                marginVertical: 4,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: 'rgba(0,0,0,0.65)',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: radii.pill,
                }}
              >
                <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 13 }}>▶ Video</Text>
                {item.duration ? (
                  <View
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: radii.sm,
                    }}
                  >
                    <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '600' }}>
                      {Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, '0')}
                    </Text>
                  </View>
                ) : null}
              </View>
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
                        <MapPinIcon size={18} color={colors.mint} />
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
                        Open in Maps
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

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 4 }}>
            <ExpiryCaption expiresAt={item.expires_at} mine={mine} />
            <Text
              style={{
                fontSize: 11,
                fontWeight: '600',
                color: mine ? 'rgba(244, 250, 247, 0.7)' : colors.muted,
              }}
            >
              {timeLabel(item.created_at)}
              {item.edited_at ? ' · edited' : ''}
              {mine && item.receipt_status ? ` · ${item.receipt_status}` : ''}
            </Text>
          </View>
        </Pressable>
      </View>
    </ExpiringBubble>
  );
});

export function ChatScreen({ route, navigation }: Props) {
  const { conversationId, title, kind } = route.params;
  const { user } = useAuth();
  const { colors, radii } = useTheme();
  const insets = useSafeAreaInsets();
  const { setImmersive } = useImmersive();

  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const [viewerControls, setViewerControls] = useState(true);

  const [messages, setMessages] = useState<Message[]>([]);
  const [expiringIds, setExpiringIds] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [, setError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState('Connecting…');
  const [, setTyping] = useState(false);
  const [, setTypingEnabled] = useState(false);
  const [, setPresenceEnabled] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [expiresInHours, setExpiresInHours] = useState<1 | 24 | 168 | null>(null);

  const [modalDialog, setModalDialog] = useState<{
    visible: boolean;
    title: string;
    message?: string;
    buttons: ConfirmModalButton[];
  }>({ visible: false, title: '', buttons: [] });

  const ephemeralRef = useRef<Ably.RealtimeChannel | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flatListRef = useRef<FlatList<Message>>(null);

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
        events.subscribe('message.expired', (msg) => {
          if (!mounted) return;
          const data = msg.data as { conversationId?: string; messageIds?: string[] } | undefined;
          if (!data || data.conversationId !== conversationId) return;
          const ids = data.messageIds || [];
          if (ids.length) {
            setExpiringIds((prev) => {
              const next = new Set(prev);
              for (const id of ids) next.add(id);
              return next;
            });
          }
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

  const handleMessageExpired = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    setExpiringIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const handleImagePress = useCallback(async (attachmentId: string) => {
    const cachedUrl = await fetchMediaUrl(attachmentId);
    if (cachedUrl) {
      setViewerImage(cachedUrl);
      setViewerControls(true);
    }
  }, []);

  const handleVideoPress = useCallback(async (attachmentId: string) => {
    try {
      const cachedUrl = await fetchMediaUrl(attachmentId);
      if (cachedUrl) {
        await Linking.openURL(cachedUrl);
      }
    } catch (e) {
      setError(messageForError(e));
    }
  }, []);

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

  const messageActions = useCallback((item: Message) => {
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
  }, [conversationId, load, user?.id]);

  const renderItem = useCallback(
    ({ item }: { item: Message }) => {
      return (
        <MessageRow
          item={item}
          mine={item.sender_id === user?.id}
          isExpiring={expiringIds.has(item.id)}
          kind={kind}
          colors={colors}
          radii={radii}
          onLongPress={messageActions}
          onImagePress={handleImagePress}
          onVideoPress={handleVideoPress}
          onExpired={handleMessageExpired}
        />
      );
    },
    [user?.id, expiringIds, kind, colors, radii, messageActions, handleImagePress, handleVideoPress, handleMessageExpired]
  );

  const keyExtractor = useCallback((item: Message) => item.id, []);

  const flatListData = useMemo(() => {
    return Platform.OS === 'web' ? messages : [...messages].reverse();
  }, [messages]);

  useEffect(() => {
    if (Platform.OS === 'web' && messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: false });
    }
  }, [messages.length]);

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
          style={({ pressed }) => [
            {
              width: 44,
              height: 44,
              borderRadius: radii.xl,
              borderCurve: 'continuous',
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.line,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <BackIcon size={18} color={colors.ink} />
        </Pressable>
        <View style={{ position: 'relative' }}>
          <Avatar name={title} color={kind === 'group' ? colors.blue : colors.mint} />
          <View
            style={{
              position: 'absolute',
              bottom: -1,
              right: -1,
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: realtimeStatus === 'Live' ? colors.mint : colors.muted,
              borderWidth: 2,
              borderColor: colors.panel,
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
          accessibilityLabel="Refresh"
          style={({ pressed }) => [
            {
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: radii.sm,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.line,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.mint }}>Refresh</Text>
        </Pressable>
      </View>

      {/* Message List */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>Loading conversation…</Text>
          </View>
        ) : messages.length === 0 ? (
          <EmptyState title="A fresh beginning." detail="Send a message to start this conversation." />
        ) : (
          <FlatList
            ref={flatListRef}
            inverted={Platform.OS !== 'web'}
            bounces={Platform.OS !== 'web'}
            overScrollMode="never"
            data={flatListData}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 12 }}
            keyboardShouldPersistTaps="handled"
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            refreshing={refreshing}
            onEndReached={loadOlder}
            onEndReachedThreshold={0.2}
          />
        )}

        {/* Input Bar */}
        <View
          style={{
            paddingBottom: Math.max(insets.bottom, 10),
            paddingHorizontal: 14,
            paddingTop: 8,
            backgroundColor: colors.panel,
            borderTopWidth: 1,
            borderTopColor: colors.line,
          }}
        >
          {replyingTo ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 12,
                paddingVertical: 6,
                marginBottom: 6,
                backgroundColor: colors.mintWash,
                borderRadius: radii.sm,
              }}
            >
              <Text numberOfLines={1} style={{ fontSize: 12, color: colors.mint, flex: 1 }}>
                Replying to: {replyingTo.body || 'Media'}
              </Text>
              <Pressable onPress={() => setReplyingTo(null)} hitSlop={8}>
                <Text style={{ fontSize: 13, color: colors.mint, fontWeight: '700', marginLeft: 8 }}>✕</Text>
              </Pressable>
            </View>
          ) : null}

          {/* Ephemeral Expiry Selector */}
          {!editingId ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                marginBottom: 8,
                paddingHorizontal: 2,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.muted }}>Self-destruct:</Text>
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
              style={({ pressed }) => [
                {
                  width: 44,
                  height: 44,
                  borderRadius: radii.xl,
                  borderCurve: 'continuous',
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.line,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <PaperclipIcon size={18} color={uploading ? colors.muted : colors.mint} />
            </Pressable>

            <Pressable
              onPress={sendLocation}
              accessibilityRole="button"
              accessibilityLabel="Share location pin"
              style={({ pressed }) => [
                {
                  width: 44,
                  height: 44,
                  borderRadius: radii.xl,
                  borderCurve: 'continuous',
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.line,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <MapPinIcon size={18} color={colors.mint} />
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
              style={({ pressed }) => [
                {
                  width: 44,
                  height: 44,
                  borderRadius: radii.xl,
                  borderCurve: 'continuous',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: text.trim() ? colors.mint : colors.mintWash,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <SendIcon size={16} color={text.trim() ? colors.mintContrast : colors.muted} />
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

      {/* Fullscreen Media Viewer */}
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
            <ExpoImage
              source={{ uri: viewerImage }}
              style={{ width: '100%', height: '100%' }}
              contentFit="contain"
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
