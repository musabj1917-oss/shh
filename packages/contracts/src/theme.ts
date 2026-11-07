/**
 * Unified Theme Tokens for Haiku Messenger
 * Single source of truth for Mobile and Web.
 */

export type ThemeId = 'sumi' | 'komorebi' | 'noir' | 'washi';
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

  // Celadon / Accent Palette
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
  sumi: {
    id: 'sumi',
    name: 'Sumi & Rain',
    description: 'Basalt ink canvas with calm celadon jade accents (Default)',
    scheme: 'dark',
    colors: {
      canvas: '#0C1015',
      panel: 'rgba(18, 24, 32, 0.94)',
      panelSolid: '#121820',
      card: 'rgba(24, 33, 44, 0.85)',
      cardHover: 'rgba(33, 45, 60, 0.95)',
      inputBg: 'rgba(14, 19, 26, 0.92)',

      line: 'rgba(255, 255, 255, 0.08)',
      stitch: 'rgba(78, 159, 134, 0.20)',
      stitchGlow: 'rgba(78, 159, 134, 0.25)',

      ink: '#EDF2F7',
      body: '#8C9DAE',
      muted: '#556778',

      mint: '#4E9F86',
      mintDark: '#377561',
      mintAccent: '#62B89D',
      mintContrast: '#071712',
      mintGlow: 'rgba(78, 159, 134, 0.22)',
      mintPale: 'rgba(24, 33, 44, 0.85)',
      mintWash: 'rgba(18, 24, 32, 0.65)',

      red: '#E06C75',
      redWash: 'rgba(224, 108, 117, 0.16)',
      amber: '#D48259',
      amberWash: 'rgba(212, 130, 89, 0.16)',
      blue: '#61AFEF',
      blueWash: 'rgba(97, 175, 239, 0.16)',

      overlay: 'rgba(12, 16, 21, 0.82)',
      scrim: 'rgba(0, 0, 0, 0.65)',

      bubbleMe: '#377561',
      bubbleMeText: '#F4FAF7',
      bubbleOther: 'rgba(24, 33, 44, 0.90)',
      bubbleOtherText: '#EDF2F7',
      bubbleOtherBorder: 'rgba(255, 255, 255, 0.06)',
    },
  },

  komorebi: {
    id: 'komorebi',
    name: 'Komorebi',
    description: 'Cedar moss green and warm terracotta amber',
    scheme: 'dark',
    colors: {
      canvas: '#0B120E',
      panel: 'rgba(16, 26, 20, 0.94)',
      panelSolid: '#101A14',
      card: 'rgba(22, 36, 28, 0.85)',
      cardHover: 'rgba(30, 48, 38, 0.95)',
      inputBg: 'rgba(12, 20, 15, 0.92)',

      line: 'rgba(255, 255, 255, 0.08)',
      stitch: 'rgba(88, 163, 121, 0.20)',
      stitchGlow: 'rgba(88, 163, 121, 0.25)',

      ink: '#EDF6F0',
      body: '#8CAE99',
      muted: '#50705E',

      mint: '#58A379',
      mintDark: '#3F7B58',
      mintAccent: '#6FC293',
      mintContrast: '#07150D',
      mintGlow: 'rgba(88, 163, 121, 0.22)',
      mintPale: 'rgba(22, 36, 28, 0.85)',
      mintWash: 'rgba(16, 26, 20, 0.65)',

      red: '#E06C75',
      redWash: 'rgba(224, 108, 117, 0.16)',
      amber: '#D48259',
      amberWash: 'rgba(212, 130, 89, 0.16)',
      blue: '#61AFEF',
      blueWash: 'rgba(97, 175, 239, 0.16)',

      overlay: 'rgba(11, 18, 14, 0.82)',
      scrim: 'rgba(0, 0, 0, 0.65)',

      bubbleMe: '#386F50',
      bubbleMeText: '#F0FAF4',
      bubbleOther: 'rgba(23, 37, 29, 0.90)',
      bubbleOtherText: '#EDF6F0',
      bubbleOtherBorder: 'rgba(255, 255, 255, 0.06)',
    },
  },

  noir: {
    id: 'noir',
    name: 'Sumi Noir',
    description: 'Pure obsidian monochrome with cool slate ink',
    scheme: 'dark',
    colors: {
      canvas: '#080A0D',
      panel: 'rgba(14, 18, 23, 0.94)',
      panelSolid: '#0E1217',
      card: 'rgba(20, 26, 33, 0.85)',
      cardHover: 'rgba(28, 36, 46, 0.95)',
      inputBg: 'rgba(11, 14, 18, 0.92)',

      line: 'rgba(255, 255, 255, 0.07)',
      stitch: 'rgba(155, 174, 193, 0.20)',
      stitchGlow: 'rgba(155, 174, 193, 0.25)',

      ink: '#F5F8FB',
      body: '#8F9CA8',
      muted: '#57626E',

      mint: '#9BAEC1',
      mintDark: '#708498',
      mintAccent: '#B4C6D8',
      mintContrast: '#0A0E12',
      mintGlow: 'rgba(155, 174, 193, 0.20)',
      mintPale: 'rgba(20, 26, 33, 0.85)',
      mintWash: 'rgba(14, 18, 23, 0.65)',

      red: '#E06C75',
      redWash: 'rgba(224, 108, 117, 0.16)',
      amber: '#D48259',
      amberWash: 'rgba(212, 130, 89, 0.16)',
      blue: '#61AFEF',
      blueWash: 'rgba(97, 175, 239, 0.16)',

      overlay: 'rgba(8, 10, 13, 0.85)',
      scrim: 'rgba(0, 0, 0, 0.70)',

      bubbleMe: '#323E4D',
      bubbleMeText: '#F5F8FB',
      bubbleOther: 'rgba(20, 26, 33, 0.90)',
      bubbleOtherText: '#F5F8FB',
      bubbleOtherBorder: 'rgba(255, 255, 255, 0.05)',
    },
  },

  washi: {
    id: 'washi',
    name: 'Washi Paper',
    description: 'Natural textured daylight paper with deep celadon ink',
    scheme: 'light',
    colors: {
      canvas: '#F6F7F5',
      panel: 'rgba(255, 255, 255, 0.96)',
      panelSolid: '#FFFFFF',
      card: '#FFFFFF',
      cardHover: '#F0F2EE',
      inputBg: '#FFFFFF',

      line: 'rgba(0, 0, 0, 0.08)',
      stitch: 'rgba(55, 117, 97, 0.20)',
      stitchGlow: 'rgba(55, 117, 97, 0.15)',

      ink: '#1A2220',
      body: '#4B5A54',
      muted: '#7D8B84',

      mint: '#377561',
      mintDark: '#265345',
      mintAccent: '#4E9F86',
      mintContrast: '#FFFFFF',
      mintGlow: 'rgba(55, 117, 97, 0.18)',
      mintPale: 'rgba(55, 117, 97, 0.10)',
      mintWash: 'rgba(55, 117, 97, 0.06)',

      red: '#C94A53',
      redWash: 'rgba(201, 74, 83, 0.12)',
      amber: '#BD683E',
      amberWash: 'rgba(189, 104, 62, 0.12)',
      blue: '#3884C7',
      blueWash: 'rgba(56, 132, 199, 0.12)',

      overlay: 'rgba(246, 247, 245, 0.88)',
      scrim: 'rgba(0, 0, 0, 0.40)',

      bubbleMe: '#377561',
      bubbleMeText: '#FFFFFF',
      bubbleOther: '#EBEFEB',
      bubbleOtherText: '#1A2220',
      bubbleOtherBorder: 'rgba(0, 0, 0, 0.06)',
    },
  },
};

export const defaultThemeId: ThemeId = 'sumi';

export function resolveTheme(preference: ThemePreference, systemScheme: 'dark' | 'light' | null = 'dark'): ThemeDefinition {
  if (preference === 'system') {
    return systemScheme === 'light' ? themes.washi : themes.sumi;
  }
  return themes[preference] || themes.sumi;
}
