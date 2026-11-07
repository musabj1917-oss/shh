/**
 * Haiku Messenger Mobile Design Tokens
 * Conforming to Sumi & Rain Design System (Restraint, Wabi-Sabi, and Natural Tactility).
 */
export const colors = {
  // Brand & Celadon Jade (Sumi & Rain)
  mint: '#4E9F86',             // Celadon Jade Accent
  mintDark: '#377561',         // Deep Celadon Pine
  mintAccent: '#62B89D',       // Luminous Focus / Highlight
  mintContrast: '#071712',     // Dark ink on Celadon surfaces (AAA Contrast)
  mintGlow: 'rgba(78, 159, 134, 0.22)',
  mintPale: 'rgba(24, 33, 44, 0.85)',
  mintWash: 'rgba(18, 24, 32, 0.65)',

  // Deep Sumi & River Basalt Surfaces (Level 0 - Level 3)
  canvas: '#0C1015',           // Level 0: Deep Sumi Canvas
  panel: 'rgba(18, 24, 32, 0.94)', // Level 1: Sheet & Nav Rails
  card: 'rgba(24, 33, 44, 0.85)',  // Level 2: Interactive Container Card
  cardHover: 'rgba(33, 45, 60, 0.95)',
  white: '#1A222C',            // Elevated card replacement
  inputBg: 'rgba(14, 19, 26, 0.92)',

  // High-Legibility Accessible Typography
  ink: '#EDF2F7',              // Primary Rice Paper Ink (High contrast)
  body: '#8C9DAE',             // Secondary Muted Mist Grey
  muted: '#556778',            // Tertiary Caption & Timestamp

  // Tactile Micro-Seams (1px structural frames)
  line: 'rgba(255, 255, 255, 0.08)',
  stitch: 'rgba(78, 159, 134, 0.20)',
  stitchGlow: 'rgba(78, 159, 134, 0.25)',
  borderLight: 'rgba(255, 255, 255, 0.05)',
  borderFocus: '#4E9F86',

  // Semantic Status & Wellbeing Indicators
  online: '#4E9F86',
  offline: '#556778',
  amber: '#D48259',            // Terracotta Seal Accent
  red: '#E06C75',
  redWash: 'rgba(224, 108, 117, 0.16)',
  blue: '#61AFEF',
  quietMode: '#2A5447',        // Mindful Quiet Mode
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 44, // Minimum accessible touch target per Appllama & HIG
};

export const radius = {
  pill: 9999,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
};
