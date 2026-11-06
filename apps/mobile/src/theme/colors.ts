/**
 * Haiku Messenger Mobile Design Tokens
 * Conforming to Appllama App Design & Baseline UI specifications.
 */
export const colors = {
  // Brand & Radiant Lime Velvet
  mint: '#A3E635',             // Primary Lime Accent
  mintDark: '#65A30D',         // Deep Olive/Lime
  mintAccent: '#BEF264',       // Luminous Focus / Highlight
  mintContrast: '#07120A',     // Obsidian ink on Lime surfaces (AAA Contrast)
  mintGlow: 'rgba(163, 230, 53, 0.28)',
  mintPale: 'rgba(20, 34, 25, 0.85)',
  mintWash: 'rgba(14, 24, 18, 0.65)',

  // Deep Velvet Obsidian Surfaces (Level 0 - Level 3)
  canvas: '#070D0A',           // Level 0: Deep Obsidian Canvas
  panel: 'rgba(14, 22, 17, 0.92)', // Level 1: Sheet & Nav Rails
  card: 'rgba(20, 32, 25, 0.82)',  // Level 2: Interactive Container Card
  cardHover: 'rgba(28, 44, 34, 0.92)',
  white: '#132119',            // Elevated glass card replacement
  inputBg: 'rgba(10, 16, 12, 0.90)',

  // High-Legibility Accessible Typography
  ink: '#F4FBF7',              // Primary White Ink (High contrast)
  body: '#A8C2B5',             // Secondary Muted Body Text
  muted: '#6E8B7E',            // Tertiary Caption & Timestamp

  // Tactile Seams & Stitches (1px structural frames)
  line: 'rgba(163, 230, 53, 0.16)',
  stitch: 'rgba(163, 230, 53, 0.18)',
  stitchGlow: 'rgba(163, 230, 53, 0.35)',
  borderLight: 'rgba(255, 255, 255, 0.09)',
  borderFocus: '#A3E635',

  // Semantic Status & Wellbeing Indicators
  online: '#A3E635',
  offline: '#6E8B7E',
  amber: '#FACC15',
  red: '#F87171',
  redWash: 'rgba(248, 113, 113, 0.16)',
  blue: '#38BDF8',
  quietMode: '#2F6F5E',        // School Hours Campus Bell Mode
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
