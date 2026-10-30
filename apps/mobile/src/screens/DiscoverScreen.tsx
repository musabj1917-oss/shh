import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View, FlatList, Alert } from 'react-native';
import { palette, spacing } from '../theme';
import { Button, Card, Input } from '../components';

interface DiscoverUser {
  id: string;
  name: string;
  username: string;
  bio: string;
  requestSent?: boolean;
}

export function DiscoverScreen() {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<DiscoverUser[]>([
    { id: 'd1', name: 'Elena Rostova', username: 'elena_r', bio: 'Poet & mobile app developer' },
    { id: 'd2', name: 'Chris Evans', username: 'chrise', bio: 'Exploring teal design' }
  ]);

  const handleSendRequest = (user: DiscoverUser) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, requestSent: true } : u))
    );
    Alert.alert('Friend Request Sent', `Request sent to @${user.username}. Private messaging will unlock once accepted.`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Discover People</Text>
      </View>

      <View style={styles.content}>
        <Input
          placeholder="Search by username or name..."
          value={search}
          onChangeText={setSearch}
        />

        <FlatList
          data={users.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.username.includes(search.toLowerCase()))}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Card>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.username}>@{item.username}</Text>
              <Text style={styles.bio}>{item.bio}</Text>
              <Button
                title={item.requestSent ? 'Request Sent' : 'Add Friend'}
                variant={item.requestSent ? 'outline' : 'primary'}
                disabled={item.requestSent}
                onPress={() => handleSendRequest(item)}
                style={{ marginTop: spacing.xs }}
              />
            </Card>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.white },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  title: { fontSize: 28, fontWeight: '700', color: palette.tealDark },
  content: { flex: 1, paddingHorizontal: spacing.xl },
  name: { fontSize: 16, fontWeight: '700', color: palette.ink },
  username: { fontSize: 14, color: palette.teal, fontWeight: '600' },
  bio: { fontSize: 14, color: palette.muted, marginTop: 4 }
});
