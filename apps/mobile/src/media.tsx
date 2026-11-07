import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { api } from './api/client';
import { useTheme } from './theme/ThemeContext';

export interface MediaCacheItem {
  url: string;
}

// Global in-memory cache and in-flight request deduping map
export const mediaCache = new Map<string, MediaCacheItem>();
export const inFlightRequests = new Map<string, Promise<string | null>>();

export async function fetchMediaUrl(id: string, force = false): Promise<string | null> {
  if (!id) return null;
  if (!force && mediaCache.has(id)) {
    return mediaCache.get(id)!.url;
  }
  if (inFlightRequests.has(id)) {
    return inFlightRequests.get(id)!;
  }

  const promise = (async () => {
    try {
      const result = await api<{ url: string }>(`/media/${id}`);
      if (result?.url) {
        mediaCache.set(id, { url: result.url });
        return result.url;
      }
      return null;
    } catch {
      return null;
    } finally {
      inFlightRequests.delete(id);
    }
  })();

  inFlightRequests.set(id, promise);
  return promise;
}

export function useMediaUrl(id: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(() => {
    if (!id) return null;
    return mediaCache.get(id)?.url ?? null;
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (!id) return false;
    return !mediaCache.has(id);
  });
  const [error, setError] = useState(false);

  const load = useCallback(
    async (force = false) => {
      if (!id) {
        setUrl(null);
        setLoading(false);
        return;
      }
      if (!force && mediaCache.has(id)) {
        setUrl(mediaCache.get(id)!.url);
        setLoading(false);
        setError(false);
        return;
      }
      setLoading(true);
      setError(false);
      const fetched = await fetchMediaUrl(id, force);
      if (fetched) {
        setUrl(fetched);
        setError(false);
      } else {
        setError(true);
      }
      setLoading(false);
    },
    [id]
  );

  useEffect(() => {
    if (!id) {
      setUrl(null);
      setLoading(false);
      return;
    }
    if (!mediaCache.has(id)) {
      void load(false);
    } else {
      setUrl(mediaCache.get(id)!.url);
      setLoading(false);
    }
  }, [id, load]);

  const reload = useCallback(() => {
    if (id) {
      mediaCache.delete(id);
      void load(true);
    }
  }, [id, load]);

  return { url, loading, error, reload };
}

interface MediaImageProps {
  attachmentId: string;
  onPress?: () => void;
  width?: number;
  height?: number;
  aspectRatio?: number;
}

export const MediaImage = memo(function MediaImage({
  attachmentId,
  onPress,
  width = 240,
  height,
  aspectRatio = 4 / 3,
}: MediaImageProps) {
  const { colors, radii } = useTheme();
  const { url, loading, error, reload } = useMediaUrl(attachmentId);

  const finalHeight = height ?? Math.round(width / aspectRatio);

  const imageSource = useMemo(() => {
    if (!url) return undefined;
    return { uri: url, cacheKey: attachmentId };
  }, [url, attachmentId]);

  return (
    <Pressable
      onPress={onPress}
      disabled={!url || !onPress}
      accessibilityRole="imagebutton"
      accessibilityLabel="View photo attachment"
      style={[
        styles.mediaWrapper,
        {
          width,
          height: finalHeight,
          borderRadius: radii.md,
          backgroundColor: colors.card,
        },
      ]}
    >
      {/* Skeleton placeholder with fixed aspect ratio */}
      {(!url || loading) && (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.centered,
            {
              backgroundColor: colors.card,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.line,
            },
          ]}
        >
          <Text style={[styles.statusText, { color: colors.muted }]}>
            {error ? 'Failed to load photo' : 'Loading…'}
          </Text>
        </View>
      )}

      {url && (
        <ExpoImage
          source={imageSource}
          style={[StyleSheet.absoluteFill, { borderRadius: radii.md }]}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={150}
          onError={() => {
            reload();
          }}
        />
      )}
    </Pressable>
  );
});

interface ExpiryCaptionProps {
  expiresAt: string | null | undefined;
  mine?: boolean;
}

export const ExpiryCaption = memo(function ExpiryCaption({
  expiresAt,
  mine = false,
}: ExpiryCaptionProps) {
  const { colors } = useTheme();
  const [timeLeft, setTimeLeft] = useState<string | null>(() => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'expired';
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${Math.max(1, mins)}m left`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h left`;
    const days = Math.floor(hours / 24);
    return `${days}d left`;
  });

  useEffect(() => {
    if (!expiresAt) {
      setTimeLeft(null);
      return;
    }
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('expired');
        return;
      }
      const mins = Math.floor(diff / 60000);
      if (mins < 60) {
        setTimeLeft(`${Math.max(1, mins)}m left`);
      } else {
        const hours = Math.floor(mins / 60);
        if (hours < 24) {
          setTimeLeft(`${hours}h left`);
        } else {
          const days = Math.floor(hours / 24);
          setTimeLeft(`${days}d left`);
        }
      }
    };

    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!timeLeft) return null;

  return (
    <Text
      style={{
        fontSize: 10,
        fontWeight: '600',
        color: mine ? 'rgba(255, 255, 255, 0.75)' : colors.muted,
        marginTop: 2,
      }}
    >
      ⏱ {timeLeft}
    </Text>
  );
});

interface ExpiringBubbleProps {
  isExpiring?: boolean;
  onExpired?: () => void;
  children: React.ReactNode;
}

export const ExpiringBubble = memo(function ExpiringBubble({
  isExpiring = false,
  onExpired,
  children,
}: ExpiringBubbleProps) {
  const anim = useRef(new Animated.Value(1)).current;
  const heightAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isExpiring) {
      Animated.parallel([
        Animated.timing(anim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(heightAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start(() => {
        onExpired?.();
      });
    }
  }, [isExpiring, anim, heightAnim, onExpired]);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ scale: anim }],
        overflow: 'hidden',
      }}
    >
      {children}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  mediaWrapper: {
    overflow: 'hidden',
    position: 'relative',
    marginVertical: 4,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
