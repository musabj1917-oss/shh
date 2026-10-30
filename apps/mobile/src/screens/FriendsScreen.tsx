import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View, FlatList, Alert } from 'react-native';
import { palette, spacing } from '../theme';
import { Button, Card, EmptyState } from '../components';

interface FriendRequest {
  id: string;
  name: string;
  username: string;
}

interface Friend {
  id: string;
  name: string;
  username: string;
}

export function FriendsScreen({ navigation }: { navigation: any }) {
  const [requests, setRequests] = useState<FriendRequest[]>([
    { id: 'r1', name: 'Maya Lin', username: 'mayalin' }
  ]);

  const [friends, setFriends] = useState<Friend[]>([
    { id: 'f1', name: 'Sam Rivera', username: 'srivera' }
  ]);

  const handleAccept = (req: FriendRequest) => {
    setRequests((prev) => prev.filter((r) => r.id !== req.id));
    setFriends((prev) => [...prev, { id: req.id, name: req.name, username: req.username }]);
    Alert.alert('Friend Added', `You are now friends with ${req.name}. Private messaging is unlocked!`);
  };

  const handleDecline = (id: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Friends & Requests</Text>
      </View>

      <View style={styles.content}>
        {requests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Requests ({requests.length})</Text>
            {requests.map((req) => (
              <Card key={req.id}>
                <Text style={styles.name}>{req.name}</Text>
                <Text style={styles.username}>@{req.username}</Text>
                <View style={styles.btnRow}>
                  <Button title="Accept" onPress={() => handleAccept(req)} style={styles.btn} />
                  <Button title="Decline" variant="outline" onPress={() => handleDecline(req.id)} style={styles.btn} />
                </View>
              </Card>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>Your Friends ({friends.length})</Text>
        {friends.length === 0 ? (
          <EmptyState
            title="No Friends Yet"
            description="Find people in Discover or search by username to send friend requests."
          />
        ) : (
          <FlatList
            data={friends}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Card>
                <View style={styles.friendRow}>
                  <View>
                    <Text style={styles.name}>{item.name}</Text>
                    <Text style={styles.username}>@{item.username}</Text>
                  </View>
                  <Button
                    title="Chat"
                    onPress={() => navigation.navigate('ChatDetail', { friendName: item.name, isFriendAccepted: true })}
                  />
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
  section: { marginBottom: spacing.lg },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: palette.tealDark, marginBottom: spacing.xs, marginTop: spacing.sm },
  name: { fontSize: 16, fontWeight: '700', color: palette.ink },
  username: { fontSize: 14, color: palette.muted, marginBottom: spacing.xs },
  btnRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  btn: { flex: 1 },
  friendRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }
});
