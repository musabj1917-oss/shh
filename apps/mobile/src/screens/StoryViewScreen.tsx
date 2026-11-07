import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image as ExpoImage } from 'expo-image';
import type { RootStackParamList } from '../navigation/types';
import { api, messageForError } from '../api/client';
import { fetchMediaUrl } from '../media';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { Avatar, ConfirmModal, Notice } from '../components/UI';
import { useImmersive } from '../system/immersive';
import { useEscapeKey } from '../theme/webStyles';

type Props = NativeStackScreenProps<RootStackParamList, 'StoryView'>;

export interface StoryItem {
  id: string;
  user_id: string;
  media_type: 'image' | 'video';
  caption: string | null;
  created_at: string;
  expires_at: string;
  attachment_id: string;
  username: string;
  display_name: string;
  view_count?: number;
  viewed?: boolean;
}

interface Viewer {
  id: string;
  username: string;
  display_name: string;
  viewed_at: string;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const STORY_DURATION = 5000; // 5 seconds per story

export function StoryViewScreen({ route, navigation }: Props) {
  const { storyId, userId, initialIndex = 0, stories: passedStories } = route.params || {};
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { colors, radii } = useTheme();
  const { setImmersive } = useImmersive();

  const [stories, setStories] = useState<StoryItem[]>(passedStories || []);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(!passedStories || passedStories.length === 0);
  const [error, setError] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [showViewersSheet, setShowViewersSheet] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEscapeKey(
    useCallback(() => {
      if (showViewersSheet) {
        setShowViewersSheet(false);
      } else if (confirmDelete) {
        setConfirmDelete(false);
      } else {
        navigation.goBack();
      }
    }, [showViewersSheet, confirmDelete, navigation])
  );

  useEffect(() => {
    void setImmersive(true);
    return () => {
      void setImmersive(false);
    };
  }, [setImmersive]);

  // Load stories if not passed
  useEffect(() => {
    if (stories.length > 0) return;
    void (async () => {
      setLoading(true);
      try {
        if (userId) {
          const res = await api<{ stories: StoryItem[] }>('/stories');
          const userStories = (res.stories || []).filter((s) => s.user_id === userId);
          setStories(userStories);
        } else if (storyId) {
          const res = await api<{ story: StoryItem }>(`/stories/${storyId}`);
          setStories([res.story]);
        }
      } catch (e) {
        setError(messageForError(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, storyId, stories.length]);

  const currentStory = stories[currentIndex] as StoryItem | undefined;
  const isMine = currentStory?.user_id === user?.id;

  // Preload and fetch media URL for active story
  useEffect(() => {
    if (!currentStory?.attachment_id) return;
    const attachId = currentStory.attachment_id;
    if (mediaUrls[attachId]) return;

    void (async () => {
      const url = await fetchMediaUrl(attachId);
      if (url) {
        setMediaUrls((prev) => ({ ...prev, [attachId]: url }));
      }
    })();
  }, [currentStory?.attachment_id, mediaUrls]);

  // Mark story as viewed
  useEffect(() => {
    if (!currentStory?.id) return;
    const id = currentStory.id;
    if (currentStory.user_id !== user?.id) {
      void api(`/stories/${id}/view`, { method: 'POST' }).catch(() => {});
    } else {
      // Load viewers list for own story
      void api<{ viewers: Viewer[] }>(`/stories/${id}/viewers`)
        .then((res) => setViewers(res.viewers || []))
        .catch(() => {});
    }
  }, [currentStory?.id, currentStory?.user_id, user?.id]);

  // Handle segmented progress animation
  const nextStory = useCallback(() => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      navigation.goBack();
    }
  }, [currentIndex, stories.length, navigation]);

  const prevStory = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    } else {
      progressAnim.setValue(0);
    }
  }, [currentIndex, progressAnim]);

  useEffect(() => {
    if (loading || !currentStory || isPaused || showViewersSheet || confirmDelete) {
      animRef.current?.stop();
      return;
    }

    progressAnim.setValue(0);
    animRef.current = Animated.timing(progressAnim, {
      toValue: 1,
      duration: STORY_DURATION,
      useNativeDriver: false,
    });

    animRef.current.start(({ finished }) => {
      if (finished) {
        nextStory();
      }
    });

    return () => {
      animRef.current?.stop();
    };
  }, [currentIndex, currentStory, loading, isPaused, showViewersSheet, confirmDelete, nextStory, progressAnim]);

  // PanResponder to handle Swipe Down to close
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 20 && Math.abs(gestureState.dx) < 30;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 120) {
          navigation.goBack();
        }
      },
    })
  ).current;

  const deleteStory = useCallback(async () => {
    if (!currentStory?.id) return;
    setBusy(true);
    try {
      await api(`/stories/${currentStory.id}`, { method: 'DELETE' });
      setConfirmDelete(false);
      const remaining = stories.filter((_, idx) => idx !== currentIndex);
      if (remaining.length === 0) {
        navigation.goBack();
      } else {
        setStories(remaining);
        setCurrentIndex((prev) => Math.min(prev, remaining.length - 1));
      }
    } catch (e) {
      setError(messageForError(e));
    } finally {
      setBusy(false);
    }
  }, [currentStory?.id, stories, currentIndex, navigation]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.mint} />
      </View>
    );
  }

  if (error || !currentStory) {
    return (
      <View style={[styles.container, styles.centered, { padding: 24 }]}>
        <Text style={{ color: '#ffffff', fontSize: 16, textAlign: 'center', marginBottom: 16 }}>
          {error || 'Story no longer available.'}
        </Text>
        <Pressable onPress={() => navigation.goBack()} style={styles.closeButton}>
          <Text style={{ color: '#ffffff', fontWeight: '700' }}>Close</Text>
        </Pressable>
      </View>
    );
  }

  const activeMediaUrl = mediaUrls[currentStory.attachment_id];

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {/* Background Media */}
      {activeMediaUrl ? (
        currentStory.media_type === 'video' ? (
          <View style={[StyleSheet.absoluteFill, styles.centered, { backgroundColor: '#0B0F19' }]}>
            <Text style={{ fontSize: 56 }}>▶</Text>
            <Text style={{ color: '#ffffff', marginTop: 12, fontWeight: '700' }}>Video Story</Text>
          </View>
        ) : (
          <ExpoImage
            source={{ uri: activeMediaUrl, cacheKey: currentStory.attachment_id }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        )
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.centered]}>
          <ActivityIndicator color={colors.mint} />
        </View>
      )}

      {/* Top Header Overlay */}
      <View
        style={[
          styles.headerOverlay,
          {
            paddingTop: Math.max(insets.top, 14),
            paddingLeft: Math.max(insets.left, 16),
            paddingRight: Math.max(insets.right, 16),
          },
        ]}
      >
        {/* Segmented Progress Bars */}
        <View style={styles.progressRow}>
          {stories.map((s, idx) => {
            let widthInterpolate: any = '0%';
            if (idx < currentIndex) {
              widthInterpolate = '100%';
            } else if (idx === currentIndex) {
              widthInterpolate = progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              });
            }

            return (
              <View key={s.id || idx} style={styles.progressTrack}>
                <Animated.View
                  style={[
                    styles.progressBar,
                    {
                      width: widthInterpolate,
                      backgroundColor: '#ffffff',
                    },
                  ]}
                />
              </View>
            );
          })}
        </View>

        {/* User Info & Close */}
        <View style={styles.userRow}>
          <Avatar name={currentStory.display_name} size={36} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 14 }}>
              {currentStory.display_name}
            </Text>
            <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 11 }}>
              @{currentStory.username}
            </Text>
          </View>

          {isMine ? (
            <Pressable
              onPress={() => setConfirmDelete(true)}
              style={styles.headerActionBtn}
              accessibilityLabel="Delete story"
            >
              <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 13 }}>Delete</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.closeHeaderBtn}
            accessibilityLabel="Close story"
          >
            <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700' }}>✕</Text>
          </Pressable>
        </View>
      </View>

      {/* Caption if present */}
      {currentStory.caption ? (
        <View
          style={[
            styles.captionOverlay,
            {
              paddingBottom: Math.max(insets.bottom, 24) + (isMine ? 50 : 16),
              paddingHorizontal: 20,
            },
          ]}
        >
          <Text style={styles.captionText}>{currentStory.caption}</Text>
        </View>
      ) : null}

      {/* Touch Targets: Tap Left (Prev), Tap Right (Next), Hold (Pause) */}
      <View style={styles.touchContainer} pointerEvents="box-none">
        <Pressable
          style={styles.touchSide}
          onPress={prevStory}
          onPressIn={() => setIsPaused(true)}
          onPressOut={() => setIsPaused(false)}
        />
        <Pressable
          style={styles.touchSide}
          onPress={nextStory}
          onPressIn={() => setIsPaused(true)}
          onPressOut={() => setIsPaused(false)}
        />
      </View>

      {/* Bottom Viewers Bar for own story */}
      {isMine ? (
        <View
          style={[
            styles.viewersBar,
            {
              paddingBottom: Math.max(insets.bottom, 14),
            },
          ]}
        >
          <Pressable
            onPress={() => setShowViewersSheet(true)}
            style={styles.viewersPill}
          >
            <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 13 }}>
              👁️ {viewers.length} viewer{viewers.length === 1 ? '' : 's'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Viewers Sheet Modal */}
      <Modal
        visible={showViewersSheet}
        animationType="slide"
        transparent
        onRequestClose={() => setShowViewersSheet(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.viewersSheet,
              {
                paddingBottom: Math.max(insets.bottom, 20),
                backgroundColor: colors.panelSolid,
              },
            ]}
          >
            <View style={styles.viewersHeader}>
              <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 17 }}>
                Story Viewers ({viewers.length})
              </Text>
              <Pressable onPress={() => setShowViewersSheet(false)} hitSlop={12}>
                <Text style={{ color: colors.muted, fontSize: 16, fontWeight: '700' }}>Done</Text>
              </Pressable>
            </View>

            {viewers.length === 0 ? (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <Text style={{ color: colors.muted, fontSize: 14 }}>No views yet.</Text>
              </View>
            ) : (
              <FlatList
                data={viewers}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={[styles.viewerItem, { borderBottomColor: colors.line }]}>
                    <Avatar name={item.display_name} size={36} />
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={{ color: colors.ink, fontWeight: '700', fontSize: 14 }}>
                        {item.display_name}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>@{item.username}</Text>
                    </View>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      {new Date(item.viewed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        visible={confirmDelete}
        title="Delete this story?"
        message="This will remove your story permanently for all viewers."
        buttons={[
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: deleteStory,
          },
        ]}
        onDismiss={() => setConfirmDelete(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingBottom: 12,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 10,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    marginRight: 8,
  },
  closeHeaderBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  closeButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 18,
  },
  captionOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 5,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingTop: 16,
  },
  captionText: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
  touchContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    zIndex: 4,
  },
  touchSide: {
    flex: 1,
  },
  viewersBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  viewersPill: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  viewersSheet: {
    maxHeight: '60%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
  },
  viewersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  viewerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
