import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image as ExpoImage } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import type { RootStackParamList } from '../navigation/types';
import { api, messageForError } from '../api/client';
import { uploadMedia } from '../api';
import { useTheme } from '../theme/ThemeContext';
import { Avatar, Button, Notice } from '../components/UI';
import { BackIcon, CheckIcon } from '../components/Icons';

type Props = NativeStackScreenProps<RootStackParamList, 'CameraPreview'>;

interface Friend {
  id: string;
  username: string;
  display_name: string;
  avatar_object_key?: string | null;
}

interface RecipientStatus {
  status: 'pending' | 'uploading' | 'sending' | 'sent' | 'failed';
  error?: string;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export function CameraPreviewScreen({ route, navigation }: Props) {
  const { uri, mediaType } = route.params;
  const insets = useSafeAreaInsets();
  const { colors, radii } = useTheme();

  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendsModal, setFriendsModal] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [recipientStatuses, setRecipientStatuses] = useState<Record<string, RecipientStatus>>({});
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    // Load friends for the "Send to..." sheet
    void (async () => {
      try {
        const res = await api<{ friends: Friend[] }>('/friends');
        setFriends(res.friends || []);
      } catch {}
    })();
  }, []);

  const saveToDevice = useCallback(async () => {
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Denied', 'Please allow photo library access in Settings to save media.');
        return;
      }
      await MediaLibrary.saveToLibraryAsync(uri);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      Alert.alert('Save Failed', 'Could not save media to device library.');
    }
  }, [uri]);

  const postToStory = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      // 1. Upload media with purpose 'story'
      const { attachmentId } = await uploadMedia({
        uri,
        purpose: 'story',
        mediaType: mediaType === 'video' ? 'video' : 'image',
        onProgress: (p) => setUploadProgress(p),
      });

      // 2. Post story
      await api('/stories', {
        method: 'POST',
        body: JSON.stringify({
          mediaId: attachmentId,
          caption: caption.trim() || undefined,
        }),
      });

      Alert.alert('Posted!', 'Your story is now live for 24 hours.', [
        {
          text: 'OK',
          onPress: () => {
            navigation.navigate('Main', { screen: 'Inbox' });
          },
        },
      ]);
    } catch (e) {
      setError(messageForError(e));
    } finally {
      setBusy(false);
    }
  }, [busy, uri, mediaType, caption, navigation]);

  const toggleSelectFriend = useCallback((id: string) => {
    setSelectedFriends((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const sendToRecipients = useCallback(async () => {
    if (selectedFriends.size === 0 || busy) return;
    setBusy(true);
    setError('');

    const initialStatuses: Record<string, RecipientStatus> = {};
    for (const friendId of selectedFriends) {
      initialStatuses[friendId] = { status: 'uploading' };
    }
    setRecipientStatuses(initialStatuses);

    try {
      // Upload media once
      const { attachmentId } = await uploadMedia({
        uri,
        purpose: 'message',
        mediaType: mediaType === 'video' ? 'video' : 'image',
        onProgress: (p) => setUploadProgress(p),
      });

      for (const friendId of selectedFriends) {
        setRecipientStatuses((prev) => ({
          ...prev,
          [friendId]: { status: 'sending' },
        }));

        try {
          // 1. Create or get direct conversation
          const convRes = await api<{ conversationId: string }>('/conversations', {
            method: 'POST',
            body: JSON.stringify({ kind: 'direct', userId: friendId }),
          });

          // 2. Send message
          await api(`/conversations/${convRes.conversationId}/messages`, {
            method: 'POST',
            body: JSON.stringify({
              attachmentId,
              text: caption.trim() || undefined,
            }),
          });

          setRecipientStatuses((prev) => ({
            ...prev,
            [friendId]: { status: 'sent' },
          }));
        } catch (e) {
          setRecipientStatuses((prev) => ({
            ...prev,
            [friendId]: { status: 'failed', error: messageForError(e) },
          }));
        }
      }
    } catch (e) {
      setError(messageForError(e));
    } finally {
      setBusy(false);
    }
  }, [selectedFriends, busy, uri, mediaType, caption]);

  const retryRecipient = useCallback(
    async (friendId: string) => {
      setRecipientStatuses((prev) => ({ ...prev, [friendId]: { status: 'sending' } }));
      try {
        const { attachmentId } = await uploadMedia({
          uri,
          purpose: 'message',
          mediaType: mediaType === 'video' ? 'video' : 'image',
        });
        const convRes = await api<{ conversationId: string }>('/conversations', {
          method: 'POST',
          body: JSON.stringify({ kind: 'direct', userId: friendId }),
        });
        await api(`/conversations/${convRes.conversationId}/messages`, {
          method: 'POST',
          body: JSON.stringify({
            attachmentId,
            text: caption.trim() || undefined,
          }),
        });
        setRecipientStatuses((prev) => ({ ...prev, [friendId]: { status: 'sent' } }));
      } catch (e) {
        setRecipientStatuses((prev) => ({
          ...prev,
          [friendId]: { status: 'failed', error: messageForError(e) },
        }));
      }
    },
    [uri, mediaType, caption]
  );

  return (
    <View style={styles.container}>
      {/* Fullscreen Photo or Video Placeholder Preview */}
      {mediaType === 'photo' ? (
        <ExpoImage
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#111827', justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={{ fontSize: 64 }}>🎬</Text>
          <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700', marginTop: 12 }}>Video Ready</Text>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 4 }}>Length capped under 30s</Text>
        </View>
      )}

      {/* Top Header Actions (Retake, Save) */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: Math.max(insets.top, 16),
            paddingLeft: Math.max(insets.left, 16),
            paddingRight: Math.max(insets.right, 16),
          },
        ]}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.pillButton}
          accessibilityLabel="Retake media"
        >
          <Text style={styles.pillButtonText}>← Retake</Text>
        </Pressable>

        <Pressable
          onPress={saveToDevice}
          style={styles.pillButton}
          accessibilityLabel="Save to device"
        >
          <Text style={styles.pillButtonText}>{saved ? '✓ Saved!' : '💾 Save'}</Text>
        </Pressable>
      </View>

      {/* Error Notice */}
      {error ? (
        <View style={{ position: 'absolute', top: 90, left: 16, right: 16, zIndex: 10 }}>
          <Notice tone="error">{error}</Notice>
        </View>
      ) : null}

      {/* Bottom Controls (Caption input + Action buttons) */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[
          styles.bottomControls,
          {
            paddingBottom: Math.max(insets.bottom, 24),
            paddingLeft: Math.max(insets.left, 16),
            paddingRight: Math.max(insets.right, 16),
          },
        ]}
      >
        {/* Caption Input */}
        <View style={styles.captionContainer}>
          <TextInput
            value={caption}
            onChangeText={(t) => setCaption(t.slice(0, 200))}
            placeholder="Add a thoughtful caption… (max 200)"
            placeholderTextColor="rgba(255, 255, 255, 0.6)"
            style={styles.captionInput}
            maxLength={200}
            multiline
          />
          <Text style={styles.charCount}>{caption.length}/200</Text>
        </View>

        {/* Upload Progress Bar */}
        {busy ? (
          <View style={{ width: '100%', marginBottom: 12 }}>
            <View style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden' }}>
              <View
                style={{
                  height: '100%',
                  width: `${Math.round(uploadProgress * 100)}%`,
                  backgroundColor: colors.mint,
                }}
              />
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, textAlign: 'center', marginTop: 4 }}>
              Uploading media… {Math.round(uploadProgress * 100)}%
            </Text>
          </View>
        ) : null}

        {/* Primary Action Buttons */}
        <View style={styles.actionRow}>
          <Pressable
            onPress={postToStory}
            disabled={busy}
            style={({ pressed }) => [
              styles.actionButton,
              { backgroundColor: 'rgba(0,0,0,0.65)', borderColor: 'rgba(255,255,255,0.3)', borderWidth: 1 },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15 }}>✨ Post to Story</Text>
          </Pressable>

          <Pressable
            onPress={() => setFriendsModal(true)}
            disabled={busy}
            style={({ pressed }) => [
              styles.actionButton,
              { backgroundColor: colors.mint },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={{ color: colors.mintContrast, fontWeight: '800', fontSize: 15 }}>Send to… →</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* "Send to..." Friend Picker Modal Sheet */}
      <Modal
        visible={friendsModal}
        animationType="slide"
        transparent
        onRequestClose={() => setFriendsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalSheet,
              {
                paddingBottom: Math.max(insets.bottom, 20),
                backgroundColor: colors.panelSolid,
                borderTopColor: colors.line,
              },
            ]}
          >
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.ink }]}>Send to Friends</Text>
              <Pressable onPress={() => setFriendsModal(false)} hitSlop={12}>
                <Text style={{ color: colors.muted, fontSize: 16, fontWeight: '700' }}>Done</Text>
              </Pressable>
            </View>

            {friends.length === 0 ? (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <Text style={{ color: colors.muted, fontSize: 14 }}>No friends added yet.</Text>
              </View>
            ) : (
              <FlatList
                data={friends}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8 }}
                renderItem={({ item }) => {
                  const isSelected = selectedFriends.has(item.id);
                  const status = recipientStatuses[item.id];

                  return (
                    <Pressable
                      onPress={() => toggleSelectFriend(item.id)}
                      style={[
                        styles.friendRow,
                        {
                          borderBottomColor: colors.line,
                          backgroundColor: isSelected ? colors.mintWash : 'transparent',
                        },
                      ]}
                    >
                      <Avatar name={item.display_name} size={40} />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={{ color: colors.ink, fontWeight: '700', fontSize: 15 }}>
                          {item.display_name}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 12 }}>@{item.username}</Text>
                      </View>

                      {status?.status === 'uploading' || status?.status === 'sending' ? (
                        <ActivityIndicator size="small" color={colors.mint} />
                      ) : status?.status === 'sent' ? (
                        <Text style={{ color: colors.mint, fontWeight: '700', fontSize: 13 }}>✓ Sent</Text>
                      ) : status?.status === 'failed' ? (
                        <Pressable onPress={() => retryRecipient(item.id)}>
                          <Text style={{ color: colors.red, fontWeight: '700', fontSize: 13 }}>Retry ↺</Text>
                        </Pressable>
                      ) : (
                        <View
                          style={[
                            styles.checkbox,
                            {
                              borderColor: isSelected ? colors.mint : colors.line,
                              backgroundColor: isSelected ? colors.mint : 'transparent',
                            },
                          ]}
                        >
                          {isSelected ? <Text style={{ color: colors.mintContrast, fontSize: 12 }}>✓</Text> : null}
                        </View>
                      )}
                    </Pressable>
                  );
                }}
              />
            )}

            <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
              <Button
                title={
                  selectedFriends.size === 0
                    ? 'Select recipients'
                    : `Send to ${selectedFriends.size} friend${selectedFriends.size === 1 ? '' : 's'}`
                }
                disabled={selectedFriends.size === 0 || busy}
                loading={busy}
                onPress={sendToRecipients}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  pillButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  pillButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  captionContainer: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  captionInput: {
    color: '#ffffff',
    fontSize: 15,
    minHeight: 38,
    maxHeight: 90,
  },
  charCount: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '75%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingTop: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
