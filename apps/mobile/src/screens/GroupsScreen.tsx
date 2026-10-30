import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View, FlatList, Alert } from 'react-native';
import { palette, spacing } from '../theme';
import { Button, Card, Input } from '../components';

interface GroupItem {
  id: string;
  name: string;
  description: string;
  role: 'owner' | 'admin' | 'member';
  membersCount: number;
}

export function GroupsScreen() {
  const [groups, setGroups] = useState<GroupItem[]>([
    { id: 'g1', name: 'Design Guild', description: 'Mint & teal UI enthusiasts', role: 'owner', membersCount: 5 }
  ]);
  const [newGroupName, setNewGroupName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    const newGroup: GroupItem = {
      id: `g_${Date.now()}`,
      name: newGroupName,
      description: 'Group created in Haiku',
      role: 'owner',
      membersCount: 1
    };
    setGroups((prev) => [...prev, newGroup]);
    setNewGroupName('');
    setIsCreating(false);
    Alert.alert('Group Created', 'You are the group owner.');
  };

  const handleShareInviteLink = (groupName: string) => {
    const code = Math.random().toString(36).substring(2, 10);
    Alert.alert(
      'Invite Link Generated',
      `Link: https://haiku.app/g/${code}\n\nInvitees submit a join request which an admin must approve.`,
      [{ text: 'Copy Link' }]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Groups</Text>
        <Button
          title={isCreating ? 'Cancel' : '+ New Group'}
          variant={isCreating ? 'outline' : 'primary'}
          onPress={() => setIsCreating(!isCreating)}
        />
      </View>

      <View style={styles.content}>
        {isCreating && (
          <Card style={{ marginBottom: spacing.md }}>
            <Text style={styles.cardTitle}>Create New Group</Text>
            <Input
              label="Group Name"
              placeholder="e.g. Haiku Poets"
              value={newGroupName}
              onChangeText={setNewGroupName}
            />
            <Button title="Create Group" onPress={handleCreateGroup} />
          </Card>
        )}

        <FlatList
          data={groups}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Card>
              <Text style={styles.groupName}>{item.name}</Text>
              <Text style={styles.description}>{item.description}</Text>
              <Text style={styles.roleText}>Role: {item.role} • {item.membersCount} members</Text>
              <Button
                title="Share Invite Link"
                variant="secondary"
                onPress={() => handleShareInviteLink(item.name)}
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
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  title: { fontSize: 28, fontWeight: '700', color: palette.tealDark },
  content: { flex: 1, paddingHorizontal: spacing.xl },
  cardTitle: { fontSize: 18, fontWeight: '700', color: palette.tealDark, marginBottom: spacing.xs },
  groupName: { fontSize: 18, fontWeight: '700', color: palette.ink },
  description: { fontSize: 14, color: palette.muted, marginTop: 2 },
  roleText: { fontSize: 13, fontWeight: '600', color: palette.teal, marginTop: 6 }
});
