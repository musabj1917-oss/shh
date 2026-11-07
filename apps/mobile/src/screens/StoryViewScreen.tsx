import React, { useCallback, useState } from 'react';
import { Image, Linking, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api, messageForError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { RootStackParamList } from '../navigation/types';
import { Button, ConfirmModal, LoadingState, Notice } from '../components/UI';
import { useTheme } from '../theme/ThemeContext';
import { useImmersive } from '../system/immersive';

type Props = NativeStackScreenProps<RootStackParamList, 'StoryView'>;
type Story = {
  id: string;
  user_id: string;
  media_type: 'image' | 'video';
  caption: string | null;
  expires_at: string;
  attachment_id: string;
  display_name: string;
  username: string;
};
type Viewer = { id: string; username: string; display_name: string; viewed_at: string };

interface ModalDialogState {
  title: string;
  message?: string;
  buttons: Array<{
    text: string;
    style?: 'default' | 'cancel' | 'destructive' | 'primary';
    onPress?: () => void;
  }>;
}

export function StoryViewScreen({ route, navigation }: Props) {
  const { storyId } = route.params;
  const { user } = useAuth();
  const { colors, radii, typography, controls } = useTheme();
  const insets = useSafeAreaInsets();
  const { setImmersive } = useImmersive();

  const [story, setStory] = useState<Story | null>(null);
  const [url, setUrl] = useState('');
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [dialog, setDialog] = useState<ModalDialogState | null>(null);
  const [showControls, setShowControls] = useState(true);

  const load = useCallback(async () => {
    setError('');
    try {
      const result = await api<{ story: Story }>(`/stories/${storyId}`);
      setStory(result.story);
      const media = await api<{ url: string }>(`/media/${result.story.attachment_id}`);
      setUrl(media.url);
      if (result.story.user_id === user?.id) {
        const v = await api<{ viewers: Viewer[] }>(`/stories/${storyId}/viewers`);
        setViewers(v.viewers || []);
      }
    } catch (e) {
      setError(messageForError(e));
    } finally {
      setLoading(false);
    }
  }, [storyId, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const reply = async () => {
    if (!text.trim() || !story) return;
    setBusy(true);
    setError('');
    try {
      await api(`/stories/${storyId}/replies`, { method: 'POST', body: JSON.stringify({ text: text.trim() }) });
      setText('');
      setSent(true);
    } catch (e) {
      setError(messageForError(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    setDialog({
      title: 'Delete this story?',
      message: 'It will no longer be visible in Haiku Messenger.',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await api(`/stories/${storyId}`, { method: 'DELETE' });
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
  };

  const authorActions = () => {
    setDialog({
      title: story?.display_name || 'Story account',
      message: 'Choose an action.',
      buttons: [
        {
          text: 'Report account',
          onPress: async () => {
            try {
              await api('/reports', {
                method: 'POST',
                body: JSON.stringify({
                  targetUserId: story?.user_id,
                  category: 'other',
                  reason: 'Reported from a story.',
                }),
              });
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
        {
          text: 'Block account',
          style: 'destructive',
          onPress: () => {
            setDialog({
              title: 'Block this account?',
              message: 'You will no longer see each other’s content or messages.',
              buttons: [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Block',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await api(`/friends/blocks/${story?.user_id}`, { method: 'POST' });
                      navigation.goBack();
                    } catch (e) {
                      setError(messageForError(e));
                    }
                  },
                },
              ],
            });
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    });
  };

  if (loading) return <LoadingState message="Opening story…" />;
  if (!story) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: colors.canvas }}>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button title="Close" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  const own = story.user_id === user?.id;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.canvas,
        paddingTop: Math.max(insets.top, 16),
        paddingBottom: Math.max(insets.bottom, 16),
        paddingLeft: Math.max(insets.left, 16),
        paddingRight: Math.max(insets.right, 16),
      }}
    >
      {showControls ? (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <View>
            <Text style={{ fontSize: typography.sizes.headline, fontWeight: '800', color: colors.ink }}>
              {story.display_name}
            </Text>
            <Text style={{ fontSize: typography.sizes.micro, color: colors.muted, marginTop: 3 }}>
              @{story.username} · expires {new Date(story.expires_at).toLocaleString()}
            </Text>
          </View>
          {own ? (
            <Pressable
              onPress={remove}
              style={{ padding: 8, minHeight: controls.heights.sm, justifyContent: 'center' }}
            >
              <Text style={{ fontSize: typography.sizes.micro, color: colors.red, fontWeight: '700' }}>Delete</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={authorActions}
              style={{ padding: 8, minHeight: controls.heights.sm, justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 18, color: colors.muted, fontWeight: '700' }}>···</Text>
            </Pressable>
          )}
        </View>
      ) : null}

      {error ? <Notice tone="error">{error}</Notice> : null}

      <Pressable
        onPress={() => {
          setShowControls((prev) => {
            const next = !prev;
            void setImmersive(!next);
            return next;
          });
        }}
        style={{
          flex: 1,
          backgroundColor: colors.card,
          borderRadius: radii.xxl,
          borderWidth: 1,
          borderColor: colors.line,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {story.media_type === 'image' && url ? (
          <Image source={{ uri: url }} resizeMode="contain" style={{ width: '100%', height: '100%' }} />
        ) : story.media_type === 'video' ? (
          <Button
            title="▶  Play video"
            onPress={() => (url ? Linking.openURL(url) : setError('Video is not available.'))}
            kind="secondary"
          />
        ) : (
          <Text style={{ fontSize: typography.sizes.caption, color: colors.muted }}>Loading media…</Text>
        )}
        {story.caption ? (
          <View
            style={{
              position: 'absolute',
              bottom: 12,
              left: 12,
              right: 12,
              padding: 12,
              borderRadius: radii.md,
              backgroundColor: colors.scrim,
              borderWidth: 1,
              borderColor: colors.line,
            }}
          >
            <Text style={{ color: colors.ink, fontSize: typography.sizes.sub, lineHeight: 19 }}>
              {story.caption}
            </Text>
          </View>
        ) : null}
      </Pressable>

      {showControls ? (
        own ? (
          <View style={{ marginTop: 12 }}>
            <Text
              style={{
                fontSize: typography.sizes.micro,
                fontWeight: '800',
                color: colors.mint,
                marginBottom: 7,
              }}
            >
              VIEWED BY {viewers.length}
            </Text>
            <Text numberOfLines={1} style={{ fontSize: typography.sizes.micro, color: colors.muted }}>
              {viewers.slice(0, 6).map((item) => item.display_name).join(' · ') || 'No views yet'}
            </Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 12 }}>
            {sent ? (
              <Text style={{ flex: 1, color: colors.mint, fontSize: typography.sizes.micro }}>Reply sent.</Text>
            ) : (
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Reply to this story…"
                placeholderTextColor={colors.muted}
                style={{
                  flex: 1,
                  minHeight: controls.heights.md,
                  borderRadius: radii.lg,
                  backgroundColor: colors.inputBg,
                  borderWidth: 1,
                  borderColor: colors.line,
                  paddingHorizontal: 13,
                  color: colors.ink,
                  fontSize: typography.sizes.caption,
                }}
              />
            )}
            <Button title="Send" onPress={reply} loading={busy} disabled={!text.trim()} small />
          </View>
        )
      ) : null}

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
