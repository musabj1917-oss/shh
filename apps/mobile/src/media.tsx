import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from './api/client';
import { useTheme } from './theme/ThemeContext';
import { PauseIcon, PlayIcon } from './components/Icons';

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

      {url && imageSource && (
        <Image
          source={imageSource}
          style={[StyleSheet.absoluteFill, { borderRadius: radii.md }]}
          resizeMode="cover"
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

export interface VoiceNoteBubbleProps {
  attachmentId: string;
  mine: boolean;
  duration?: number | null;
  expiresAt?: string | null;
}

const WAVE_BARS = [6, 12, 18, 22, 14, 8, 16, 24, 20, 12, 16, 22, 18, 10, 14, 8];

export const VoiceNoteBubble = memo(function VoiceNoteBubble({
  attachmentId,
  mine,
  duration = 0,
  expiresAt,
}: VoiceNoteBubbleProps) {
  const { colors } = useTheme();
  const { url, loading, error } = useMediaUrl(attachmentId);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const audioRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current && typeof audioRef.current.pause === 'function') {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const togglePlay = useCallback(async () => {
    if (!url) return;

    if (Platform.OS === 'web' && typeof (globalThis as any).Audio !== 'undefined') {
      if (!audioRef.current) {
        const audio = new (globalThis as any).Audio(url);
        audioRef.current = audio;

        audio.onloadedmetadata = () => {
          if (audio.duration && !Number.isNaN(audio.duration)) {
            setAudioDuration(Math.round(audio.duration));
          }
        };

        audio.ontimeupdate = () => {
          setCurrentTime(Math.round(audio.currentTime));
        };

        audio.onended = () => {
          setIsPlaying(false);
          setCurrentTime(0);
        };

        audio.onerror = () => {
          setIsPlaying(false);
        };
      }

      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        try {
          await audioRef.current.play();
          setIsPlaying(true);
        } catch {
          setIsPlaying(false);
        }
      }
    } else {
      try {
        await Linking.openURL(url);
      } catch (err) {
        console.warn('Could not open audio file', err);
      }
    }
  }, [url, isPlaying]);

  const effectiveDuration = audioDuration || duration || 0;
  const progressRatio = effectiveDuration > 0 ? Math.min(1, currentTime / effectiveDuration) : 0;
  const activeBars = Math.floor(progressRatio * WAVE_BARS.length);

  const formatSecs = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const iconColor = mine ? colors.mintContrast : '#ffffff';
  const btnBg = mine ? colors.mint : colors.mint;

  return (
    <View style={{ minWidth: 200, maxWidth: 280, paddingVertical: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable
          onPress={togglePlay}
          disabled={loading || Boolean(error)}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Pause voice message' : 'Play voice message'}
          style={({ pressed }) => [
            {
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: btnBg,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.8 : loading ? 0.5 : 1,
            },
          ]}
        >
          {isPlaying ? (
            <PauseIcon size={16} color={iconColor} />
          ) : (
            <PlayIcon size={16} color={iconColor} />
          )}
        </Pressable>

        <View style={{ flex: 1, justifyContent: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', height: 26, gap: 3 }}>
            {WAVE_BARS.map((h, i) => {
              const active = i <= activeBars && isPlaying;
              return (
                <View
                  key={i}
                  style={{
                    width: 3,
                    height: h,
                    borderRadius: 2,
                    backgroundColor: active
                      ? (mine ? '#ffffff' : colors.mint)
                      : (mine ? 'rgba(255,255,255,0.35)' : colors.line),
                  }}
                />
              );
            })}
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
            <Text
              style={{
                fontSize: 10,
                fontWeight: '600',
                color: mine ? 'rgba(255,255,255,0.85)' : colors.muted,
              }}
            >
              {isPlaying ? formatSecs(currentTime) : (effectiveDuration > 0 ? formatSecs(effectiveDuration) : 'Voice note')}
            </Text>
            <Text
              style={{
                fontSize: 10,
                fontWeight: '600',
                color: mine ? 'rgba(255,255,255,0.6)' : colors.muted,
              }}
            >
              ⏱ 10m auto-delete
            </Text>
          </View>
        </View>
      </View>
    </View>
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
