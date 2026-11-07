import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import NetInfo from '@react-native-community/netinfo';
import { api, messageForError } from '../api/client';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { Avatar, Button, EmptyState, Notice, Screen, SkeletonRow } from '../components/UI';
import { BellIcon, PlusIcon, SearchIcon, PeopleIcon } from '../components/Icons';
import { useTheme } from '../theme/ThemeContext';

type Conversation = {
  id: string;
  kind: 'direct' | 'group';
  title: string;
  last_message_id?: string | null;
  last_message_text: string | null;
  last_message_type: string | null;
  last_message_at: string | null;
  unread_count: number;
  member_count: number;
  avatar_object_key?: string | null;
};

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return '';
  const d = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function InboxScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const tabs = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const { colors, radii, controls } = useTheme();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [online, setOnline] = useState(true);

  const load = useCallback(async () => {
    setError('');
    try {
      const result = await api<{ conversations: Conversation[] }>('/conversations');
      setConversations(result.conversations || []);
    } catch (e) {
      setError(messageForError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      const unsubscribe = NetInfo.addEventListener((state) => setOnline(Boolean(state.isConnected)));
      return () => unsubscribe();
    }, [load])
  );

  const unreadCount = useMemo(() => conversations.filter((c) => c.unread_count > 0).length, [conversations]);

  const filtered = useMemo(
    () =>
      conversations.filter(
        (item) =>
          (!unreadOnly || item.unread_count > 0) &&
          (!query.trim() ||
            item.title?.toLowerCase().includes(query.trim().toLowerCase()) ||
            item.last_message_text?.toLowerCase().includes(query.trim().toLowerCase()))
      ),
    [conversations, query, unreadOnly]
  );

  const open = (item: Conversation) =>
    navigation.navigate('Chat', {
      conversationId: item.id,
      title: item.title || 'Conversation',
      kind: item.kind,
    });

  return (
    <Screen style={{ paddingHorizontal: 20, paddingTop: 14, backgroundColor: colors.canvas }}>
      {/* Top App Bar */}
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
              fontSize: 28,
              lineHeight: 34,
              letterSpacing: -0.7,
              fontWeight: '800',
              color: colors.ink,
            }}
          >
            Chats
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: colors.muted,
              marginTop: 2,
              letterSpacing: 0.2,
            }}
          >
            {online ? 'Connected' : 'Waiting for network…'}
          </Text>
        </View>

        {/* Quick Header Actions */}
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <Pressable
            onPress={() => navigation.navigate('Notifications')}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            style={({ pressed }) => [
              {
                width: 44,
                height: 44,
                borderRadius: radii.xl,
                borderCurve: 'continuous',
                backgroundColor: colors.panel,
                borderWidth: 1,
                borderColor: colors.line,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <BellIcon size={20} color={colors.ink} />
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('Groups')}
            accessibilityRole="button"
            accessibilityLabel="Groups"
            style={({ pressed }) => [
              {
                width: 44,
                height: 44,
                borderRadius: radii.xl,
                borderCurve: 'continuous',
                backgroundColor: colors.panel,
                borderWidth: 1,
                borderColor: colors.line,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <PeopleIcon size={20} color={colors.ink} />
          </Pressable>
        </View>
      </View>

      {!online ? (
        <Notice tone="error">You’re offline. Messages will update when reconnected.</Notice>
      ) : null}
      {error ? (
        <Notice tone="error">
          {error}{' '}
          <Text onPress={load} style={{ fontWeight: '800', color: colors.mint }}>
            Retry
          </Text>
        </Notice>
      ) : null}

      {/* Modern Inset Search Bar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.inputBg,
          borderRadius: radii.xl,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: colors.line,
          paddingHorizontal: 14,
          height: 46,
          marginBottom: 14,
          gap: 10,
        }}
      >
        <SearchIcon size={18} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search conversations…"
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          style={{
            flex: 1,
            color: colors.ink,
            fontSize: 14,
            paddingVertical: 0,
          }}
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Text style={{ fontSize: 13, color: colors.muted, fontWeight: '700' }}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Filters Segment */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={() => setUnreadOnly(false)}
            style={({ pressed }) => [
              {
                paddingVertical: 7,
                paddingHorizontal: 14,
                borderRadius: radii.pill,
                borderCurve: 'continuous',
                backgroundColor: !unreadOnly ? colors.mint : colors.panel,
                borderWidth: 1,
                borderColor: !unreadOnly ? colors.mint : colors.line,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: !unreadOnly ? colors.mintContrast : colors.body,
              }}
            >
              All
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setUnreadOnly(true)}
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingVertical: 7,
                paddingHorizontal: 14,
                borderRadius: radii.pill,
                borderCurve: 'continuous',
                backgroundColor: unreadOnly ? colors.mint : colors.panel,
                borderWidth: 1,
                borderColor: unreadOnly ? colors.mint : colors.line,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: unreadOnly ? colors.mintContrast : colors.body,
              }}
            >
              Unread
            </Text>
            {unreadCount > 0 ? (
              <View
                style={{
                  minWidth: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: unreadOnly ? colors.mintContrast : colors.mint,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 4,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '800',
                    color: unreadOnly ? colors.mint : colors.mintContrast,
                  }}
                >
                  {unreadCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <Pressable
          onPress={() => tabs.navigate('People')}
          accessibilityRole="button"
          style={({ pressed }) => [
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingVertical: 7,
              paddingHorizontal: 13,
              borderRadius: radii.pill,
              borderCurve: 'continuous',
              backgroundColor: colors.mintPale,
              borderWidth: 1,
              borderColor: colors.stitchGlow,
              minHeight: controls.heights.sm,
              justifyContent: 'center',
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <PlusIcon size={14} color={colors.mint} />
          <Text style={{ color: colors.mint, fontWeight: '800', fontSize: 12 }}>New Chat</Text>
        </Pressable>
      </View>

      {/* Main Conversation Feed */}
      {loading ? (
        <View style={{ paddingTop: 8 }}>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 32, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
              tintColor={colors.mint}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title={unreadOnly ? 'All caught up.' : 'No conversations yet'}
              detail={
                unreadOnly
                  ? 'You have answered all new messages.'
                  : 'Start a calm conversation with a friend or group.'
              }
              action={
                !unreadOnly ? (
                  <Button
                    title="Find Friends"
                    onPress={() => tabs.navigate('People')}
                    small
                  />
                ) : undefined
              }
            />
          }
          renderItem={({ item }) => {
            const hasUnread = item.unread_count > 0;
            return (
              <Pressable
                onPress={() => open(item)}
                accessibilityRole="button"
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 14,
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderRadius: radii.xxl,
                    borderCurve: 'continuous',
                    marginBottom: 10,
                    backgroundColor: pressed ? colors.cardHover : colors.card,
                    borderWidth: 1,
                    borderColor: hasUnread ? colors.stitchGlow : colors.line,
                    shadowColor: '#000',
                    shadowOpacity: 0.1,
                    shadowRadius: 8,
                    elevation: 2,
                  },
                ]}
              >
                <View style={{ position: 'relative' }}>
                  <Avatar
                    name={item.title || 'Haiku'}
                    color={item.kind === 'group' ? colors.blue : colors.mint}
                  />
                  <View
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: colors.mint,
                      borderWidth: 2,
                      borderColor: colors.card,
                    }}
                  />
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 16,
                        fontWeight: hasUnread ? '800' : '700',
                        color: colors.ink,
                        flex: 1,
                        letterSpacing: -0.3,
                      }}
                    >
                      {item.title || 'Conversation'}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: hasUnread ? colors.mint : colors.muted,
                        fontWeight: hasUnread ? '700' : '500',
                      }}
                    >
                      {formatRelativeTime(item.last_message_at)}
                    </Text>
                  </View>

                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      marginTop: 4,
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        flex: 1,
                        fontSize: 13,
                        color: hasUnread ? colors.ink : colors.body,
                        fontWeight: hasUnread ? '600' : '400',
                      }}
                    >
                      {item.last_message_type && item.last_message_type !== 'text'
                        ? 'Shared media'
                        : item.last_message_text || 'Tap to begin chat'}
                    </Text>

                    {hasUnread ? (
                      <View
                        style={{
                          minWidth: 20,
                          height: 20,
                          borderRadius: 10,
                          backgroundColor: colors.mint,
                          alignItems: 'center',
                          justifyContent: 'center',
                          paddingHorizontal: 6,
                          shadowColor: colors.mint,
                          shadowOpacity: 0.35,
                          shadowRadius: 6,
                          elevation: 3,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            color: colors.mintContrast,
                            fontWeight: '800',
                          }}
                        >
                          {item.unread_count}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {item.kind === 'group' ? (
                    <Text style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>
                      {item.member_count} members
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}
