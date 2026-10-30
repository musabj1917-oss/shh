import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View, FlatList, Alert } from 'react-native';
import { palette, spacing } from '../theme';
import { Button, Input, Card } from '../components';

interface ChatMessage {
  id: string;
  senderName: string;
  isMe: boolean;
  body: string | null;
  kind: 'text' | 'image' | 'video' | 'audio';
  createdAt: string;
  status: 'delivered' | 'read';
  expiresInMinutes?: number;
}

export function ChatDetailScreen({ route, navigation }: { route: any; navigation: any }) {
  const friendName = route.params?.friendName || 'Friend';
  const isFriendAccepted = route.params?.isFriendAccepted ?? true;

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm1',
      senderName: friendName,
      isMe: false,
      body: 'Hey! Are you free to catch up later today?',
      kind: 'text',
      createdAt: '10:14 AM',
      status: 'read'
    },
    {
      id: 'm2',
      senderName: 'You',
      isMe: true,
      body: 'Definitely! Send me a voice note or message when you get off work.',
      kind: 'text',
      createdAt: '10:16 AM',
      status: 'read'
    },
    {
      id: 'm3',
      senderName: friendName,
      isMe: false,
      body: null,
      kind: 'audio',
      createdAt: '10:18 AM',
      status: 'read',
      expiresInMinutes: 8
    }
  ]);

  const [inputBody, setInputBody] = useState('');

  const handleSendMessage = () => {
    if (!inputBody.trim()) return;

    const newMsg: ChatMessage = {
      id: `m_${Date.now()}`,
      senderName: 'You',
      isMe: true,
      body: inputBody,
      kind: 'text',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'delivered'
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputBody('');
  };

  const handleSendVoiceNote = () => {
    Alert.alert('Voice Note', 'Voice notes expire automatically 10 minutes after sending.', [
      {
        text: 'Record & Send',
        onPress: () => {
          const newMsg: ChatMessage = {
            id: `m_vn_${Date.now()}`,
            senderName: 'You',
            isMe: true,
            body: null,
            kind: 'audio',
            createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: 'delivered',
            expiresInMinutes: 10
          };
          setMessages((prev) => [...prev, newMsg]);
        }
      },
      { text: 'Cancel', style: 'cancel' }
    ]);
  };

  if (!isFriendAccepted) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{friendName}</Text>
        </View>
        <View style={styles.gatedContainer}>
          <Card>
            <Text style={styles.gatedTitle}>Private Messaging Locked</Text>
            <Text style={styles.gatedBody}>
              Private messaging with {friendName} is unavailable until they accept your friend request.
            </Text>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{friendName}</Text>
        <Text style={styles.presenceText}>Online • Private chat</Text>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        renderItem={({ item }) => (
          <View style={[styles.bubbleContainer, item.isMe ? styles.myBubbleContainer : styles.theirBubbleContainer]}>
            <View style={[styles.bubble, item.isMe ? styles.myBubble : styles.theirBubble]}>
              {item.kind === 'text' && <Text style={[styles.messageText, item.isMe && styles.myText]}>{item.body}</Text>}
              {item.kind === 'audio' && (
                <Text style={[styles.mediaPlaceholderText, item.isMe && styles.myText]}>
                  🎤 Voice Note ({item.expiresInMinutes ? `Expires in ${item.expiresInMinutes}m` : '10m auto-expiry'})
                </Text>
              )}
              <View style={styles.footerRow}>
                <Text style={[styles.timeText, item.isMe && styles.myTimeText]}>{item.createdAt}</Text>
                {item.isMe && <Text style={styles.statusText}>{item.status === 'read' ? ' ✓✓' : ' ✓'}</Text>}
              </View>
            </View>
          </View>
        )}
      />

      <View style={styles.inputBar}>
        <Input
          placeholder="Type a haiku or message..."
          value={inputBody}
          onChangeText={setInputBody}
          style={styles.textInputStyle}
        />
        <Button title="Send" onPress={handleSendMessage} style={styles.sendButton} />
        <Button title="🎤" variant="secondary" onPress={handleSendVoiceNote} style={styles.iconButton} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.white },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderColor: palette.soft
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: palette.tealDark },
  presenceText: { fontSize: 13, color: palette.teal, marginTop: 2 },
  gatedContainer: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  gatedTitle: { fontSize: 18, fontWeight: '700', color: palette.tealDark, marginBottom: spacing.xs },
  gatedBody: { fontSize: 15, color: palette.muted, lineHeight: 22 },
  messageList: { paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  bubbleContainer: { marginVertical: 4, width: '100%', flexDirection: 'row' },
  myBubbleContainer: { justifyContent: 'flex-end' },
  theirBubbleContainer: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '78%',
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  myBubble: { backgroundColor: palette.teal, borderBottomRightRadius: 2 },
  theirBubble: { backgroundColor: palette.soft, borderBottomLeftRadius: 2 },
  messageText: { fontSize: 16, color: palette.ink, lineHeight: 22 },
  myText: { color: palette.white },
  mediaPlaceholderText: { fontSize: 14, fontWeight: '600', color: palette.tealDark },
  footerRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4 },
  timeText: { fontSize: 11, color: palette.muted },
  myTimeText: { color: 'rgba(255,255,255,0.8)' },
  statusText: { fontSize: 11, color: palette.mint },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderColor: palette.soft
  },
  textInputStyle: { flex: 1, marginRight: spacing.xs },
  sendButton: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginRight: spacing.xs },
  iconButton: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm }
});
