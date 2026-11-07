import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api, messageForError } from '../api/client';
import type { RootStackParamList } from '../navigation/types';
import { Avatar, Button, EmptyState, LoadingState, Notice, Screen, Surface } from '../components/UI';
import { PlusIcon } from '../components/Icons';
import { useTheme } from '../theme/ThemeContext';

type Story = {
  id: string;
  user_id: string;
  media_type: 'image' | 'video';
  caption: string | null;
  created_at: string;
  expires_at: string;
  attachment_id: string;
  username: string;
  display_name: string;
  view_count: number;
  viewed: boolean;
};

export function StoriesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors, radii, typography, controls } = useTheme();

  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const result = await api<{ stories: Story[] }>('/stories');
      setStories(result.stories || []);
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
    setError('');
    const picked = await launchImageLibrary({ mediaType: 'mixed', selectionLimit: 1, quality: 0.8 });
    if (picked.didCancel) return;
    if (picked.errorCode) {
      setError(picked.errorMessage || 'Photo library could not be opened.');
      return;
    }
    const asset = picked.assets?.[0];
    if (!asset?.uri) {
      setError('The selected file could not be opened.');
      return;
    }
    const mimeType = (asset.type || 'image/jpeg').toLowerCase();
    const mediaType = mimeType.startsWith('video/') ? 'video' : 'image';
    const byteSize = asset.fileSize || 0;
    if (!byteSize) {
      setError('Could not determine this file’s size. Choose another file.');
      return;
    }
    setBusy(true);
    try {
      const intent = await api<{
        attachmentId: string;
        upload: { url: string; method: 'PUT'; headers: Record<string, string>; mode: 'proxy' | 'signed' };
      }>('/media/upload-intents', {
        method: 'POST',
        body: JSON.stringify({ purpose: 'story', mediaType, mimeType, byteSize }),
      });
      const blob = await (await fetch(asset.uri)).blob();
      const upload = await fetch(intent.upload.url, {
        method: intent.upload.method,
        headers: intent.upload.headers,
        body: blob,
      });
      if (!upload.ok) throw new Error(`Upload failed (${upload.status}).`);
      if (intent.upload.mode === 'signed') await api(`/media/${intent.attachmentId}/complete`, { method: 'POST' });
      await api('/stories', { method: 'POST', body: JSON.stringify({ attachmentId: intent.attachmentId, mediaType }) });
      await load();
    } catch (e) {
      setError(messageForError(e));
    } finally {
      setBusy(false);
    }
  };

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
            MOMENTS
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
            Stories
          </Text>
          <Text style={{ fontSize: typography.sizes.sub, color: colors.muted, marginTop: 4 }}>
            Disappear after 24 hours. No permanent trail.
          </Text>
        </View>

        <Pressable
          onPress={create}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Post a story"
          style={({ pressed }) => [
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingVertical: 9,
              paddingHorizontal: 14,
              borderRadius: radii.pill,
              borderCurve: 'continuous',
              backgroundColor: colors.mint,
              minHeight: controls.heights.sm,
            },
            pressed && { opacity: 0.85 },
          ]}
        >
          <PlusIcon size={16} color={colors.mintContrast} />
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.mintContrast }}>
            {busy ? 'Posting…' : 'Post'}
          </Text>
        </Pressable>
      </View>

      {error ? <Notice tone="error">{error}</Notice> : null}

      {loading ? (
        <LoadingState message="Checking for new stories…" />
      ) : (
        <FlatList
          data={stories}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 36 }}
          ListEmptyComponent={
            <EmptyState
              title="Your feed is quiet."
              detail="Share a photo or video that your Haiku friends can see for the next 24 hours."
              action={
                <Button
                  title="Share a moment"
                  onPress={create}
                  small
                  style={{ minHeight: controls.heights.sm }}
                />
              }
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                navigation.navigate('StoryView', {
                  storyId: item.id,
                  title: item.display_name,
                  mediaType: item.media_type,
                })
              }
              accessibilityRole="button"
              style={({ pressed }) => [{ marginBottom: 10 }, pressed && { opacity: 0.88 }]}
            >
              <Surface
                style={{
                  padding: 14,
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
                <View
                  style={{
                    padding: 3,
                    borderWidth: 2,
                    borderColor: item.viewed ? colors.line : colors.mint,
                    borderRadius: radii.xl,
                    borderCurve: 'continuous',
                  }}
                >
                  <Avatar name={item.display_name} color={colors.mint} />
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontSize: typography.sizes.body, fontWeight: '800', color: colors.ink }}>
                    {item.display_name}
                  </Text>
                  <Text style={{ fontSize: typography.sizes.micro, color: colors.muted, marginTop: 3 }}>
                    @{item.username} ·{' '}
                    {new Date(item.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </Text>
                  {item.caption ? (
                    <Text numberOfLines={1} style={{ fontSize: typography.sizes.micro, color: colors.body, marginTop: 4 }}>
                      {item.caption}
                    </Text>
                  ) : null}
                </View>

                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: radii.pill,
                      borderCurve: 'continuous',
                      backgroundColor: colors.mintWash,
                      borderWidth: 1,
                      borderColor: colors.stitchGlow,
                    }}
                  >
                    <Text style={{ fontSize: 11, color: colors.mint, fontWeight: '800', textTransform: 'capitalize' }}>
                      {item.media_type}
                    </Text>
                  </View>
                  <Text style={{ fontSize: typography.sizes.micro, color: colors.muted }}>
                    {item.view_count} {item.view_count === 1 ? 'view' : 'views'}
                  </Text>
                </View>
              </Surface>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}
