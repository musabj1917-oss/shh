import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api, messageForError } from '../api/client';
import { useTheme } from '../theme/ThemeContext';
import { useEscapeKey } from '../theme/webStyles';
import { Avatar } from './UI';
import { SearchIcon } from './Icons';

export interface NewChatModalProps {
  visible: boolean;
  onDismiss: () => void;
  onConversationSelected: (conversationId: string, title: string) => void;
}

interface UserSearchResult {
  id: string;
  username: string;
  displayName: string;
  avatar_object_key?: string | null;
}

export function NewChatModal({
  visible,
  onDismiss,
  onConversationSelected,
}: NewChatModalProps) {
  const { colors, radii, controls } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [startingChatId, setStartingChatId] = useState<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEscapeKey(onDismiss, visible);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
      setError('');
      setStartingChatId(null);
    }
  }, [visible]);

  const searchUsers = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await api<UserSearchResult[] | { users: UserSearchResult[] }>(
        `/profile/search?q=${encodeURIComponent(q.trim())}`
      );
      const list = Array.isArray(res) ? res : res.users || [];
      setResults(list);
    } catch (e) {
      setError(messageForError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      void searchUsers(text);
    }, 280);
  };

  const handleStartChat = async (user: UserSearchResult) => {
    setStartingChatId(user.id);
    try {
      const res = await api<{ conversationId: string }>(`/conversations/direct/${user.id}`, {
        method: 'POST',
      });
      onDismiss();
      onConversationSelected(res.conversationId, user.displayName || user.username);
    } catch (e) {
      setError(messageForError(e));
      setStartingChatId(null);
    }
  };

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onDismiss}>
      <View style={[styles.overlay, { backgroundColor: colors.scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.panelSolid,
              borderColor: colors.line,
              borderRadius: radii.xxl,
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.line }]}>
            <Text style={[styles.title, { color: colors.ink }]}>New Conversation</Text>
            <Pressable
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              style={({ pressed }) => [
                styles.closeButton,
                { backgroundColor: colors.card, borderColor: colors.line, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Text style={{ fontSize: 13, color: colors.muted, fontWeight: '700' }}>✕</Text>
            </Pressable>
          </View>

          {/* Body */}
          <View style={styles.body}>
            {/* Search Input Box */}
            <View
              style={[
                styles.searchBox,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.line,
                  borderRadius: radii.xl,
                  height: controls.heights.md,
                },
              ]}
            >
              <SearchIcon size={18} color={colors.muted} />
              <TextInput
                value={query}
                onChangeText={handleQueryChange}
                placeholder="Search users by name or @username..."
                placeholderTextColor={colors.muted}
                autoFocus
                returnKeyType="search"
                style={[styles.searchInput, { color: colors.ink }]}
              />
              {query.length > 0 ? (
                <Pressable onPress={() => handleQueryChange('')} hitSlop={8}>
                  <Text style={{ fontSize: 12, color: colors.muted, fontWeight: '700' }}>Clear</Text>
                </Pressable>
              ) : null}
            </View>

            {error ? (
              <Text style={[styles.errorText, { color: colors.red }]}>{error}</Text>
            ) : null}

            {/* Results Stream */}
            <ScrollView
              style={styles.resultsContainer}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingVertical: 8, gap: 8 }}
            >
              {loading ? (
                <View style={styles.centeredMessage}>
                  <ActivityIndicator size="small" color={colors.mint} />
                  <Text style={[styles.messageText, { color: colors.muted }]}>Searching users…</Text>
                </View>
              ) : query.trim().length < 2 ? (
                <View style={styles.centeredMessage}>
                  <Text style={[styles.messageText, { color: colors.muted }]}>
                    Type at least 2 characters to search users
                  </Text>
                </View>
              ) : results.length === 0 ? (
                <View style={styles.centeredMessage}>
                  <Text style={[styles.messageText, { color: colors.muted }]}>
                    No matching users found
                  </Text>
                </View>
              ) : (
                results.map((u) => {
                  const isStarting = startingChatId === u.id;
                  return (
                    <View
                      key={u.id}
                      style={[
                        styles.contactCard,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.line,
                          borderRadius: radii.lg,
                        },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                        <Avatar name={u.displayName || u.username} size={38} />
                        <View style={{ flex: 1 }}>
                          <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: colors.ink }}>
                            {u.displayName || u.username}
                          </Text>
                          <Text numberOfLines={1} style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                            @{u.username}
                          </Text>
                        </View>
                      </View>

                      <Pressable
                        onPress={() => void handleStartChat(u)}
                        disabled={isStarting}
                        accessibilityRole="button"
                        style={({ pressed }) => [
                          styles.messageButton,
                          {
                            backgroundColor: colors.mint,
                            borderRadius: radii.pill,
                            opacity: pressed || isStarting ? 0.75 : 1,
                          },
                        ]}
                      >
                        {isStarting ? (
                          <ActivityIndicator size="small" color={colors.mintContrast} />
                        ) : (
                          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.mintContrast }}>
                            Message
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '85%',
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.6,
    shadowRadius: 32,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 14,
    gap: 10,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  errorText: {
    fontSize: 12,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  resultsContainer: {
    maxHeight: 280,
  },
  centeredMessage: {
    paddingVertical: 32,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  messageText: {
    fontSize: 13,
    textAlign: 'center',
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 1,
  },
  messageButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
