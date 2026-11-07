/**
 * Haiku Messenger Mobile Design Tokens
 * Conforming to Sumi & Rain Design System (Restraint, Wabi-Sabi, and Natural Tactility).
 * Backwards-compatible static tokens fallback + re-export of unified contracts.
 */
import { themes, defaultThemeId } from '@haiku/contracts';

export const colors = themes[defaultThemeId].colors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 44,
};

export const radii = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};

export * from './ThemeContext';
