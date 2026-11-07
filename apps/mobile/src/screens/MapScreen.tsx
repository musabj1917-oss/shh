import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getFriendsLocations, stopLiveLocation, updateLiveLocation } from '../api/client';
import { Avatar, Button, EmptyState, Notice, Surface } from '../components/UI';
import { colors } from '../theme/colors';

type FriendLocation = {
  user_id: string;
  latitude: number;
  longitude: number;
  display_name: string;
  username: string;
  avatar_object_key: string | null;
  updated_at: string;
};

export function MapScreen() {
  const [friends, setFriends] = useState<FriendLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await getFriendsLocations();
      setFriends(res.friends || []);
    } catch {
      setError('Could not load friend locations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const toggleSharing = async () => {
    if (sharing) {
      try {
        await stopLiveLocation();
        setSharing(false);
        Alert.alert('Location Sharing Stopped', 'Your location is no longer visible to mutual friends.');
      } catch {
        setError('Could not stop sharing location.');
      }
    } else {
      const geo = (globalThis as unknown as { navigator?: { geolocation?: { getCurrentPosition: (s: (pos: any) => void, e: () => void, opt?: any) => void } } })?.navigator?.geolocation;
      if (geo) {
        geo.getCurrentPosition(
          async (pos: { coords: { latitude: number; longitude: number; accuracy?: number } }) => {
            try {
              await updateLiveLocation({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
                sharingMode: 'friends',
                durationMinutes: 60,
              });
              setSharing(true);
              Alert.alert('Live Sharing Active', 'Your location is now shared with mutual friends for 1 hour.');
              void load();
            } catch {
              setError('Could not activate location sharing.');
            }
          },
          () => {
            Alert.alert('Permission Denied', 'Enable location permission to share live location with friends.');
          },
          { enableHighAccuracy: true }
        );
      } else {
        // Fallback demo/mock coordinates
        try {
          await updateLiveLocation({
            latitude: 9.03,
            longitude: 38.74,
            sharingMode: 'friends',
            durationMinutes: 60,
          });
          setSharing(true);
          Alert.alert('Live Sharing Active', 'Sharing live location with friends for 1 hour.');
          void load();
        } catch {
          setError('Could not start live sharing.');
        }
      }
    }
  };

  const renderFriend = ({ item }: { item: FriendLocation }) => {
    const lat = Number(item.latitude).toFixed(4);
    const lng = Number(item.longitude).toFixed(4);
    const time = new Date(item.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <Surface style={{ marginBottom: 10, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar name={item.display_name} color={colors.mint} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: colors.ink }}>{item.display_name}</Text>
          <Text style={{ fontSize: 11, color: colors.muted }}>@{item.username}</Text>
          <Text style={{ fontSize: 10, color: colors.mint, marginTop: 4 }}>
            📍 {lat}, {lng} · {time}
          </Text>
        </View>
        <Pressable
          onPress={() => Linking.openURL(`https://www.google.com/maps?q=${item.latitude},${item.longitude}`)}
          style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: colors.mintPale }}
        >
          <Text style={{ fontSize: 11, color: colors.mint, fontWeight: '700' }}>View ↗</Text>
        </Pressable>
      </Surface>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas, padding: 14 }}>
      <Surface style={{ marginBottom: 14, padding: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ fontSize: 15, fontWeight: '800', color: colors.ink }}>Friend Radar</Text>
            <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
              {sharing ? '🟢 Sharing with mutual friends (1h)' : 'Location is private'}
            </Text>
          </View>
          <Button
            title={sharing ? 'Stop' : 'Share (1h)'}
            onPress={toggleSharing}
            kind={sharing ? 'danger' : 'primary'}
          />
        </View>
      </Surface>

      {error ? (
        <View style={{ marginBottom: 10 }}>
          <Notice tone="error">{error}</Notice>
        </View>
      ) : null}

      <FlatList
        data={friends}
        keyExtractor={(item) => item.user_id}
        renderItem={renderFriend}
        refreshing={loading}
        onRefresh={load}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              title="No friends nearby."
              detail="Mutual friends sharing their live location will appear here."
            />
          ) : undefined
        }
      />
    </View>
  );
}
