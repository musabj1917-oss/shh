import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View, FlatList, Alert } from 'react-native';
import { palette, spacing } from '../theme';
import { Button, Card, Input, EmptyState } from '../components';

interface StoryItem {
  id: string;
  author: string;
  caption: string;
  expiresInHours: number;
}

export function StoriesScreen() {
  const [stories, setStories] = useState<StoryItem[]>([
    { id: 's1', author: 'Elena Rostova', caption: 'Sunrise over mountain crest 🌅', expiresInHours: 18 }
  ]);
  const [newCaption, setNewCaption] = useState('');
  const [replyText, setReplyText] = useState('');

  const handleCreateStory = () => {
    if (!newCaption.trim()) return;
    const newStory: StoryItem = {
      id: `s_${Date.now()}`,
      author: 'You',
      caption: newCaption,
      expiresInHours: 24
    };
    setStories((prev) => [newStory, ...prev]);
    setNewCaption('');
    Alert.alert('Story Published', 'Visible to everyone for 24 hours.');
  };

  const handleReplyToStory = (author: string) => {
    if (!replyText.trim()) return;
    Alert.alert('Reply Sent', `Your reply was sent to ${author}.`);
    setReplyText('');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Stories (24h)</Text>
      </View>

      <View style={styles.content}>
        <Card style={{ marginBottom: spacing.md }}>
          <Text style={styles.cardTitle}>Share a Story</Text>
          <Input
            placeholder="Write a caption for your story..."
            value={newCaption}
            onChangeText={setNewCaption}
          />
          <Button title="Post Story" onPress={handleCreateStory} />
        </Card>

        {stories.length === 0 ? (
          <EmptyState title="No Stories Yet" description="Be the first to share a 24-hour story!" />
        ) : (
          <FlatList
            data={stories}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Card>
                <View style={styles.storyHeader}>
                  <Text style={styles.author}>{item.author}</Text>
                  <Text style={styles.timer}>Expires in {item.expiresInHours}h</Text>
                </View>
                <Text style={styles.caption}>{item.caption}</Text>

                <View style={styles.replyRow}>
                  <Input
                    placeholder="Reply to story..."
                    value={replyText}
                    onChangeText={setReplyText}
                    style={{ flex: 1, marginRight: spacing.xs }}
                  />
                  <Button title="Reply" onPress={() => handleReplyToStory(item.author)} />
                </View>
              </Card>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.white },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  title: { fontSize: 28, fontWeight: '700', color: palette.tealDark },
  content: { flex: 1, paddingHorizontal: spacing.xl },
  cardTitle: { fontSize: 18, fontWeight: '700', color: palette.tealDark, marginBottom: spacing.xs },
  storyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  author: { fontSize: 16, fontWeight: '700', color: palette.ink },
  timer: { fontSize: 12, color: palette.teal, fontWeight: '600' },
  caption: { fontSize: 16, color: palette.ink, marginVertical: spacing.xs },
  replyRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs }
});
