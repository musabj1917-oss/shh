import React, { useCallback, useState } from 'react';
import { FlatList, Linking, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getFriendsLocations, stopLiveLocation, updateLiveLocation } from '../api/client';
import { Avatar, Button, ConfirmModal, EmptyState, Notice, Surface } from '../components/UI';
import { useTheme } from '../theme/ThemeContext';

type FriendLocation = {
  user_id: string;
  latitude: number;
  longitude: number;
  display_name: string;
  username: string;
  avatar_object_key: string | null;
  updated_at: string;
};

interface ModalDialogState {
  title: string;
  message?: string;
  buttons: Array<{
    text: string;
    style?: 'default' | 'cancel' | 'destructive' | 'primary';
    onPress?: () => void;
  }>;
}

export function MapScreen() {
  const { colors, radii, typography, controls } = useTheme();
  const [friends, setFriends] = useState<FriendLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<ModalDialogState | null>(null);

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
        setDialog({
          title: 'Location Sharing Stopped',
          message: 'Your location is no longer visible to mutual friends.',
          buttons: [{ text: 'OK', style: 'primary' }],
        });
      } catch {
        setError('Could not stop sharing location.');
      }
    } else {
      const geo = (
        globalThis as unknown as {
          navigator?: { geolocation?: { getCurrentPosition: (s: (pos: any) => void, e: () => void, opt?: any) => void } };
        }
      )?.navigator?.geolocation;

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
              setDialog({
                title: 'Live Sharing Active',
                message: 'Your location is now shared with mutual friends for 1 hour.',
                buttons: [{ text: 'OK', style: 'primary' }],
              });
              void load();
            } catch {
              setError('Could not activate location sharing.');
            }
          },
          () => {
            setDialog({
              title: 'Permission Denied',
              message: 'Enable location permission to share live location with friends.',
              buttons: [{ text: 'OK', style: 'primary' }],
            });
          },
          { enableHighAccuracy: true }
        );
      } else {
        // Fallback coordinates
        try {
          await updateLiveLocation({
            latitude: 9.03,
            longitude: 38.74,
            sharingMode: 'friends',
            durationMinutes: 60,
          });
          setSharing(true);
          setDialog({
            title: 'Live Sharing Active',
            message: 'Sharing live location with friends for 1 hour.',
            buttons: [{ text: 'OK', style: 'primary' }],
          });
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
      <Surface
        style={{
          marginBottom: 10,
          padding: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          borderRadius: radii.xl,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.line,
        }}
      >
        <Avatar name={item.display_name} color={colors.mint} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: typography.sizes.body, fontWeight: '800', color: colors.ink }}>
            {item.display_name}
          </Text>
          <Text style={{ fontSize: typography.sizes.micro, color: colors.muted }}>@{item.username}</Text>
          <Text style={{ fontSize: typography.sizes.micro, color: colors.mint, marginTop: 4 }}>
            ⌖ {lat}, {lng} · {time}
          </Text>
        </View>
        <Pressable
          onPress={() => Linking.openURL(`https://www.google.com/maps?q=${item.latitude},${item.longitude}`)}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: radii.md,
            backgroundColor: colors.mintPale,
            minHeight: controls.heights.sm,
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: typography.sizes.micro, color: colors.mint, fontWeight: '700' }}>View ↗</Text>
        </Pressable>
      </Surface>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas, padding: 14 }}>
      <Surface style={{ marginBottom: 14, padding: 16, borderRadius: radii.xl }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ fontSize: typography.sizes.bodyLarge, fontWeight: '800', color: colors.ink }}>
              Friend Radar
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
              {sharing ? (
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.mint }} />
              ) : null}
              <Text style={{ fontSize: typography.sizes.micro, color: colors.muted }}>
                {sharing ? 'Sharing with mutual friends (1h)' : 'Location is private'}
              </Text>
            </View>
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
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        ListEmptyComponent={
          <EmptyState
            title="Radar is quiet."
            detail="Friends who choose to share their location for 1 hour will appear here."
          />
        }
      />

      {/* Themed Dialog Modal */}
      {dialog ? (
        <ConfirmModal
          visible={Boolean(dialog)}
          title={dialog.title}
          message={dialog.message}
          buttons={dialog.buttons.map((b) => ({
            ...b,
            onPress: () => {
              setDialog(null);
              b.onPress?.();
            },
          }))}
          onDismiss={() => setDialog(null)}
        />
      ) : null}
    </View>
  );
}
