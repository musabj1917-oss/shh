import React, { useRef, useState } from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark, Button } from './UI';
import {
  ChatsIcon,
  MomentsIcon,
  RadarIcon,
  ShieldCheckIcon,
} from './Icons';
import { useTheme } from '../theme/ThemeContext';

export const ONBOARDING_COMPLETED_KEY = 'haiku.onboarding.completed';

interface OnboardingSliderProps {
  onComplete: () => void;
}

export function OnboardingSlider({ onComplete }: OnboardingSliderProps) {
  const { colors, radii } = useTheme();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const windowWidth = Dimensions.get('window').width;

  const slides = [
    {
      id: 'welcome',
      title: 'Welcome to Haiku',
      subtitle: 'A calm, weightless messenger designed for authentic human connection without noise, metrics, or permanent trails.',
      icon: <BrandMark size={72} />,
      badge: 'Calm & Ephemeral',
    },
    {
      id: 'features',
      title: 'Built for Moments',
      subtitle: 'Everything disappears when it should. No permanent archives, no surveillance.',
      badge: 'Chats • Moments • Radar',
      items: [
        {
          icon: <ChatsIcon size={20} color={colors.mint} />,
          title: 'Ephemeral Chats',
          desc: 'Direct & group messaging with self-destructing media and real voice notes.',
        },
        {
          icon: <MomentsIcon size={20} color={colors.mint} />,
          title: '24-Hour Stories',
          desc: 'Share disappearing photos and video loops with zero permanent traces.',
        },
        {
          icon: <RadarIcon size={20} color={colors.mint} />,
          title: 'Local Radar',
          desc: 'Foreground-only proximity pins to discover nearby friends spontaneously.',
        },
      ],
    },
    {
      id: 'privacy',
      title: 'Privacy & Control',
      subtitle: 'You are always in total control. Haiku only prompts for permissions when you actively use a feature.',
      badge: 'Zero Tracking',
      icon: <ShieldCheckIcon size={64} color={colors.mint} />,
      items: [
        {
          title: 'Camera & Microphone',
          desc: 'Only used when you tap to capture a moment or record a voice note.',
        },
        {
          title: 'Location & Alerts',
          desc: 'Foreground location for pin sharing, and notifications for incoming whispers.',
        },
      ],
    },
  ];

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / windowWidth);
    if (index !== currentIndex && index >= 0 && index < slides.length) {
      setCurrentIndex(index);
    }
  };

  const goToNext = () => {
    if (currentIndex < slides.length - 1) {
      scrollRef.current?.scrollTo({
        x: (currentIndex + 1) * windowWidth,
        animated: true,
      });
      setCurrentIndex(currentIndex + 1);
    } else {
      onComplete();
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      scrollRef.current?.scrollTo({
        x: (currentIndex - 1) * windowWidth,
        animated: true,
      });
      setCurrentIndex(currentIndex - 1);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.canvas }]}>
      {/* Top Header with Skip */}
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top + 8, 24),
            paddingHorizontal: 20,
          },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <BrandMark size={28} />
          <Text style={[styles.brandText, { color: colors.ink }]}>haiku</Text>
        </View>

        <Pressable
          onPress={onComplete}
          hitSlop={12}
          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[styles.skipText, { color: colors.muted }]}>Skip</Text>
        </Pressable>
      </View>

      {/* Swipeable Carousel */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        style={styles.carousel}
        contentContainerStyle={{ alignItems: 'center' }}
      >
        {slides.map((slide) => (
          <View
            key={slide.id}
            style={[
              styles.slide,
              {
                width: windowWidth,
                paddingHorizontal: 28,
              },
            ]}
          >
            {/* Slide Badge */}
            <View
              style={[
                styles.badgeWrap,
                {
                  backgroundColor: colors.mintWash,
                  borderColor: colors.stitchGlow,
                  borderRadius: radii.pill,
                },
              ]}
            >
              <Text style={[styles.badgeText, { color: colors.mint }]}>
                {slide.badge}
              </Text>
            </View>

            {/* Slide Graphic */}
            <View style={styles.graphicWrap}>
              {slide.icon ? (
                <View
                  style={[
                    styles.iconBox,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.line,
                      borderRadius: radii.xxl,
                    },
                  ]}
                >
                  {slide.icon}
                </View>
              ) : null}
            </View>

            {/* Title & Description */}
            <Text style={[styles.title, { color: colors.ink }]}>
              {slide.title}
            </Text>
            <Text style={[styles.subtitle, { color: colors.body }]}>
              {slide.subtitle}
            </Text>

            {/* Feature List (Slides 2 & 3) */}
            {slide.items ? (
              <View style={styles.itemsWrap}>
                {slide.items.map((it, i) => (
                  <View
                    key={i}
                    style={[
                      styles.itemRow,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.line,
                        borderRadius: radii.xl,
                      },
                    ]}
                  >
                    {it.icon ? (
                      <View style={styles.itemIcon}>{it.icon}</View>
                    ) : (
                      <View
                        style={[
                          styles.dotBullet,
                          { backgroundColor: colors.mint },
                        ]}
                      />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemTitle, { color: colors.ink }]}>
                        {it.title}
                      </Text>
                      <Text style={[styles.itemDesc, { color: colors.muted }]}>
                        {it.desc}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>

      {/* Bottom Footer with Progress Dots and Controls */}
      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom + 16, 32),
            paddingHorizontal: 24,
          },
        ]}
      >
        {/* Progress Indicator Dots */}
        <View style={styles.dotsWrap}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    i === currentIndex ? colors.mint : colors.line,
                  width: i === currentIndex ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        {/* Buttons Row */}
        <View style={styles.buttonsRow}>
          {currentIndex > 0 ? (
            <Button
              title="Back"
              kind="secondary"
              onPress={goToPrev}
              style={{ flex: 1, marginRight: 10 }}
            />
          ) : null}

          <Button
            title={currentIndex === slides.length - 1 ? 'Get Started' : 'Next'}
            kind="primary"
            onPress={goToNext}
            style={{ flex: currentIndex > 0 ? 2 : 1 }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  brandText: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  skipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  carousel: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  badgeWrap: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    marginBottom: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  graphicWrap: {
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBox: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 340,
    marginBottom: 20,
  },
  itemsWrap: {
    width: '100%',
    maxWidth: 380,
    gap: 10,
    marginTop: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderWidth: 1,
    gap: 12,
  },
  itemIcon: {
    marginTop: 2,
  },
  dotBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  itemDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  footer: {
    alignItems: 'center',
  },
  dotsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 24,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
});
