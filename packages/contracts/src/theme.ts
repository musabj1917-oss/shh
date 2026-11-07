/**
 * Unified Theme Tokens for Haiku Messenger
 * Single source of truth for Mobile and Web.
 */

export type ThemeId = 'haiku' | 'sakura' | 'matcha' | 'ocean' | 'ember' | 'paper' | 'noir' | 'sumi' | 'komorebi' | 'washi';
export type ThemePreference = ThemeId | 'system';

export interface ThemeColors {
  // Surface Hierarchy
  canvas: string;
  panel: string;
  panelSolid: string;
  card: string;
  cardHover: string;
  inputBg: string;

  // Structural Seams
  line: string;
  stitch: string;
  stitchGlow: string;

  // Typography Ink
  ink: string;
  body: string;
  muted: string;

  // Accent Palette (Themed per visual sanctuary)
  accent: string;
  accentContrast: string;
  accentGlow: string;
  mint: string;
  mintDark: string;
  mintAccent: string;
  mintContrast: string;
  mintGlow: string;
  mintPale: string;
  mintWash: string;

  // Semantic Colors
  red: string;
  redWash: string;
  amber: string;
  amberWash: string;
  blue: string;
  blueWash: string;

  // Overlays & Scrims
  overlay: string;
  scrim: string;

  // Chat Bubbles (unified between mobile and web)
  bubbleMe: string;
  bubbleMeText: string;
  bubbleOther: string;
  bubbleOtherText: string;
  bubbleOtherBorder: string;
}

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  description: string;
  scheme: 'dark' | 'light';
  colors: ThemeColors;
}

export const themeRadii = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 9999,
} as const;

export const themeTypography = {
  sizes: {
    micro: 11,
    caption: 12,
    sub: 13,
    body: 14,
    bodyLarge: 15,
    headline: 16,
    titleSm: 18,
    title: 20,
    titleLg: 24,
    display: 28,
  },
  lineHeights: {
    micro: 15,
    caption: 16,
    sub: 18,
    body: 20,
    bodyLarge: 22,
    headline: 22,
    titleSm: 24,
    title: 26,
    titleLg: 30,
    display: 34,
  },
  fonts: {
    sans: 'Instrument Sans',
    serif: 'Newsreader',
    mono: 'JetBrains Mono',
  },
} as const;

export const themeControls = {
  heights: {
    sm: 36,
    md: 44, // Benchmark: minimum 44pt tap target
    lg: 50,
  },
} as const;

export const themes: Record<ThemeId, ThemeDefinition> = {
  haiku: {
    id: 'haiku',
    name: 'Haiku (Default)',
    description: 'Pitch obsidian black with signature warm gold accent',
    scheme: 'dark',
    colors: {
      canvas: '#0A0A0A',
      panel: 'rgba(18, 18, 18, 0.96)',
      panelSolid: '#121212',
      card: 'rgba(26, 26, 26, 0.90)',
      cardHover: 'rgba(38, 38, 38, 0.98)',
      inputBg: 'rgba(14, 14, 14, 0.94)',

      line: 'rgba(255, 255, 255, 0.09)',
      stitch: 'rgba(255, 214, 10, 0.28)',
      stitchGlow: 'rgba(255, 214, 10, 0.35)',

      ink: '#FFFFFF',
      body: '#A3A3A3',
      muted: '#666666',

      accent: '#FFD60A',
      accentContrast: '#0A0A0A',
      accentGlow: 'rgba(255, 214, 10, 0.35)',

      mint: '#FFD60A',
      mintDark: '#D4B000',
      mintAccent: '#FFE14D',
      mintContrast: '#0A0A0A',
      mintGlow: 'rgba(255, 214, 10, 0.35)',
      mintPale: 'rgba(255, 214, 10, 0.12)',
      mintWash: 'rgba(255, 214, 10, 0.16)',

      red: '#FF453A',
      redWash: 'rgba(255, 69, 58, 0.16)',
      amber: '#FF9F0A',
      amberWash: 'rgba(255, 159, 10, 0.16)',
      blue: '#0A84FF',
      blueWash: 'rgba(10, 132, 255, 0.16)',

      overlay: 'rgba(0, 0, 0, 0.88)',
      scrim: 'rgba(0, 0, 0, 0.75)',

      bubbleMe: '#FFD60A',
      bubbleMeText: '#0A0A0A',
      bubbleOther: 'rgba(26, 26, 26, 0.92)',
      bubbleOtherText: '#FFFFFF',
      bubbleOtherBorder: 'rgba(255, 255, 255, 0.08)',
    },
  },

  sakura: {
    id: 'sakura',
    name: 'Sakura',
    description: 'Deep plum obsidian with radiant sakura petal pink',
    scheme: 'dark',
    colors: {
      canvas: '#1A0B12',
      panel: 'rgba(36, 16, 26, 0.96)',
      panelSolid: '#24101A',
      card: 'rgba(46, 22, 34, 0.90)',
      cardHover: 'rgba(60, 30, 46, 0.98)',
      inputBg: 'rgba(22, 10, 16, 0.94)',

      line: 'rgba(255, 255, 255, 0.09)',
      stitch: 'rgba(255, 143, 184, 0.28)',
      stitchGlow: 'rgba(255, 143, 184, 0.35)',

      ink: '#FFF0F5',
      body: '#B899A6',
      muted: '#7A5B69',

      accent: '#FF8FB8',
      accentContrast: '#1A0B12',
      accentGlow: 'rgba(255, 143, 184, 0.35)',

      mint: '#FF8FB8',
      mintDark: '#D96E96',
      mintAccent: '#FFAECB',
      mintContrast: '#1A0B12',
      mintGlow: 'rgba(255, 143, 184, 0.35)',
      mintPale: 'rgba(255, 143, 184, 0.12)',
      mintWash: 'rgba(255, 143, 184, 0.16)',

      red: '#FF453A',
      redWash: 'rgba(255, 69, 58, 0.16)',
      amber: '#FF9F0A',
      amberWash: 'rgba(255, 159, 10, 0.16)',
      blue: '#BF5AF2',
      blueWash: 'rgba(191, 90, 242, 0.16)',

      overlay: 'rgba(26, 11, 18, 0.88)',
      scrim: 'rgba(0, 0, 0, 0.75)',

      bubbleMe: '#FF8FB8',
      bubbleMeText: '#1A0B12',
      bubbleOther: 'rgba(46, 22, 34, 0.92)',
      bubbleOtherText: '#FFF0F5',
      bubbleOtherBorder: 'rgba(255, 255, 255, 0.08)',
    },
  },

  matcha: {
    id: 'matcha',
    name: 'Matcha',
    description: 'Basalt forest canvas with energetic matcha lime green',
    scheme: 'dark',
    colors: {
      canvas: '#0B1A10',
      panel: 'rgba(16, 36, 23, 0.96)',
      panelSolid: '#102417',
      card: 'rgba(23, 48, 32, 0.90)',
      cardHover: 'rgba(32, 64, 43, 0.98)',
      inputBg: 'rgba(10, 22, 14, 0.94)',

      line: 'rgba(255, 255, 255, 0.09)',
      stitch: 'rgba(143, 209, 106, 0.28)',
      stitchGlow: 'rgba(143, 209, 106, 0.35)',

      ink: '#F0FAF2',
      body: '#96B29E',
      muted: '#587360',

      accent: '#8FD16A',
      accentContrast: '#0B1A10',
      accentGlow: 'rgba(143, 209, 106, 0.35)',

      mint: '#8FD16A',
      mintDark: '#70A850',
      mintAccent: '#A8E386',
      mintContrast: '#0B1A10',
      mintGlow: 'rgba(143, 209, 106, 0.35)',
      mintPale: 'rgba(143, 209, 106, 0.12)',
      mintWash: 'rgba(143, 209, 106, 0.16)',

      red: '#FF453A',
      redWash: 'rgba(255, 69, 58, 0.16)',
      amber: '#FF9F0A',
      amberWash: 'rgba(255, 159, 10, 0.16)',
      blue: '#32D74B',
      blueWash: 'rgba(50, 215, 75, 0.16)',

      overlay: 'rgba(11, 26, 16, 0.88)',
      scrim: 'rgba(0, 0, 0, 0.75)',

      bubbleMe: '#8FD16A',
      bubbleMeText: '#0B1A10',
      bubbleOther: 'rgba(23, 48, 32, 0.92)',
      bubbleOtherText: '#F0FAF2',
      bubbleOtherBorder: 'rgba(255, 255, 255, 0.08)',
    },
  },

  ocean: {
    id: 'ocean',
    name: 'Ocean',
    description: 'Deep abyss navy with luminous ocean cyan blue',
    scheme: 'dark',
    colors: {
      canvas: '#08121F',
      panel: 'rgba(13, 28, 46, 0.96)',
      panelSolid: '#0D1C2E',
      card: 'rgba(18, 37, 61, 0.90)',
      cardHover: 'rgba(25, 49, 80, 0.98)',
      inputBg: 'rgba(7, 16, 28, 0.94)',

      line: 'rgba(255, 255, 255, 0.09)',
      stitch: 'rgba(77, 184, 255, 0.28)',
      stitchGlow: 'rgba(77, 184, 255, 0.35)',

      ink: '#F0F7FF',
      body: '#8FA7C2',
      muted: '#526D8A',

      accent: '#4DB8FF',
      accentContrast: '#08121F',
      accentGlow: 'rgba(77, 184, 255, 0.35)',

      mint: '#4DB8FF',
      mintDark: '#2B96DE',
      mintAccent: '#7ACCFF',
      mintContrast: '#08121F',
      mintGlow: 'rgba(77, 184, 255, 0.35)',
      mintPale: 'rgba(77, 184, 255, 0.12)',
      mintWash: 'rgba(77, 184, 255, 0.16)',

      red: '#FF453A',
      redWash: 'rgba(255, 69, 58, 0.16)',
      amber: '#FF9F0A',
      amberWash: 'rgba(255, 159, 10, 0.16)',
      blue: '#64D2FF',
      blueWash: 'rgba(100, 210, 255, 0.16)',

      overlay: 'rgba(8, 18, 31, 0.88)',
      scrim: 'rgba(0, 0, 0, 0.75)',

      bubbleMe: '#4DB8FF',
      bubbleMeText: '#08121F',
      bubbleOther: 'rgba(18, 37, 61, 0.92)',
      bubbleOtherText: '#F0F7FF',
      bubbleOtherBorder: 'rgba(255, 255, 255, 0.08)',
    },
  },

  ember: {
    id: 'ember',
    name: 'Ember',
    description: 'Charred charcoal canvas with incandescent terracotta ember',
    scheme: 'dark',
    colors: {
      canvas: '#1C0C08',
      panel: 'rgba(39, 19, 12, 0.96)',
      panelSolid: '#27130C',
      card: 'rgba(52, 27, 18, 0.90)',
      cardHover: 'rgba(68, 36, 25, 0.98)',
      inputBg: 'rgba(22, 10, 6, 0.94)',

      line: 'rgba(255, 255, 255, 0.09)',
      stitch: 'rgba(255, 107, 61, 0.28)',
      stitchGlow: 'rgba(255, 107, 61, 0.35)',

      ink: '#FFF3F0',
      body: '#BA9C94',
      muted: '#7A5E57',

      accent: '#FF6B3D',
      accentContrast: '#1C0C08',
      accentGlow: 'rgba(255, 107, 61, 0.35)',

      mint: '#FF6B3D',
      mintDark: '#D64E22',
      mintAccent: '#FF8A63',
      mintContrast: '#1C0C08',
      mintGlow: 'rgba(255, 107, 61, 0.35)',
      mintPale: 'rgba(255, 107, 61, 0.12)',
      mintWash: 'rgba(255, 107, 61, 0.16)',

      red: '#FF453A',
      redWash: 'rgba(255, 69, 58, 0.16)',
      amber: '#FF9F0A',
      amberWash: 'rgba(255, 159, 10, 0.16)',
      blue: '#FF6B3D',
      blueWash: 'rgba(255, 107, 61, 0.16)',

      overlay: 'rgba(28, 12, 8, 0.88)',
      scrim: 'rgba(0, 0, 0, 0.75)',

      bubbleMe: '#FF6B3D',
      bubbleMeText: '#1C0C08',
      bubbleOther: 'rgba(52, 27, 18, 0.92)',
      bubbleOtherText: '#FFF3F0',
      bubbleOtherBorder: 'rgba(255, 255, 255, 0.08)',
    },
  },

  paper: {
    id: 'paper',
    name: 'Paper',
    description: 'Natural textured washi paper with deep contrast ink black',
    scheme: 'light',
    colors: {
      canvas: '#F5F1E8',
      panel: 'rgba(237, 232, 220, 0.96)',
      panelSolid: '#EDE8DC',
      card: 'rgba(255, 255, 255, 0.95)',
      cardHover: '#E4DEC8',
      inputBg: '#FFFFFF',

      line: 'rgba(0, 0, 0, 0.08)',
      stitch: 'rgba(10, 10, 10, 0.20)',
      stitchGlow: 'rgba(10, 10, 10, 0.15)',

      ink: '#0A0A0A',
      body: '#4A4A4A',
      muted: '#7A7A7A',

      accent: '#0A0A0A',
      accentContrast: '#F5F1E8',
      accentGlow: 'rgba(10, 10, 10, 0.20)',

      mint: '#0A0A0A',
      mintDark: '#000000',
      mintAccent: '#262626',
      mintContrast: '#F5F1E8',
      mintGlow: 'rgba(10, 10, 10, 0.18)',
      mintPale: 'rgba(10, 10, 10, 0.08)',
      mintWash: 'rgba(10, 10, 10, 0.06)',

      red: '#C94A53',
      redWash: 'rgba(201, 74, 83, 0.12)',
      amber: '#BD683E',
      amberWash: 'rgba(189, 104, 62, 0.12)',
      blue: '#0A84FF',
      blueWash: 'rgba(10, 132, 255, 0.12)',

      overlay: 'rgba(245, 241, 232, 0.88)',
      scrim: 'rgba(0, 0, 0, 0.40)',

      bubbleMe: '#0A0A0A',
      bubbleMeText: '#F5F1E8',
      bubbleOther: '#E5DFD0',
      bubbleOtherText: '#0A0A0A',
      bubbleOtherBorder: 'rgba(0, 0, 0, 0.08)',
    },
  },

  // Legacy mappings for backwards compatibility
  noir: null as any,
  sumi: null as any,
  komorebi: null as any,
  washi: null as any,
};

// Map legacy IDs to new theme tokens
themes.noir = themes.haiku;
themes.sumi = themes.matcha;
themes.komorebi = themes.ember;
themes.washi = themes.paper;

export const defaultThemeId: ThemeId = 'haiku';

export function resolveTheme(preference: ThemePreference, systemScheme: 'dark' | 'light' | null = 'dark'): ThemeDefinition {
  if (preference === 'system') {
    return systemScheme === 'light' ? themes.paper : themes.haiku;
  }
  return themes[preference] || themes.haiku;
}
