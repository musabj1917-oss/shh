import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as DynamicAppIcon from 'expo-dynamic-app-icon';
import {
  ThemeColors,
  ThemeDefinition,
  ThemePreference,
  defaultThemeId,
  resolveTheme,
  themeControls,
  themeRadii,
  themeTypography,
  themes,
} from '@haiku/contracts';

const THEME_STORAGE_KEY = 'haiku_mobile_theme_preference';

export interface ThemeContextValue {
  theme: ThemeDefinition;
  preference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => Promise<void>;
  isDark: boolean;
  colors: ThemeColors;
  radii: typeof themeRadii;
  typography: typeof themeTypography;
  controls: typeof themeControls;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>('haiku');

  useEffect(() => {
    async function loadSavedTheme() {
      try {
        let saved: string | null = null;
        if (Platform.OS !== 'web') {
          try {
            saved = await SecureStore.getItemAsync(THEME_STORAGE_KEY);
          } catch {}
        }
        if (!saved) {
          saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        }
        if (saved && (saved in themes || saved === 'system')) {
          setPreference(saved as ThemePreference);
        }
      } catch (err) {
        console.warn('Could not load stored theme preference:', err);
      }
    }
    void loadSavedTheme();
  }, []);

  const handleSetPreference = async (newPref: ThemePreference) => {
    setPreference(newPref);
    try {
      if (Platform.OS !== 'web') {
        try {
          await SecureStore.setItemAsync(THEME_STORAGE_KEY, newPref);
        } catch {}
      }
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newPref);

      // Attempt to change native launcher icon (dev/prod native builds only, skip in Expo Go)
      if (Platform.OS !== 'web' && newPref !== 'system') {
        const isExpoGo =
          Constants?.appOwnership === 'expo' ||
          Constants?.executionEnvironment === ExecutionEnvironment?.StoreClient;
        if (!isExpoGo && typeof DynamicAppIcon?.setAppIcon === 'function') {
          try {
            DynamicAppIcon.setAppIcon(newPref);
          } catch (iconErr) {
            console.warn('Could not update launcher icon:', iconErr);
          }
        }
      }
    } catch (err) {
      console.warn('Could not persist theme preference:', err);
    }
  };

  const activeTheme = useMemo(() => {
    return resolveTheme(preference, systemScheme === 'light' ? 'light' : 'dark');
  }, [preference, systemScheme]);

  const value = useMemo<ThemeContextValue>(() => {
    return {
      theme: activeTheme,
      preference,
      setThemePreference: handleSetPreference,
      isDark: activeTheme.scheme === 'dark',
      colors: activeTheme.colors,
      radii: themeRadii,
      typography: themeTypography,
      controls: themeControls,
    };
  }, [activeTheme, preference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    // Fallback for isolated components or tests outside provider
    const fallbackTheme = themes[defaultThemeId];
    return {
      theme: fallbackTheme,
      preference: 'sumi',
      setThemePreference: async () => {},
      isDark: true,
      colors: fallbackTheme.colors,
      radii: themeRadii,
      typography: themeTypography,
      controls: themeControls,
    };
  }
  return context;
}

/**
 * Creates memoized theme-aware styles.
 */
export function useThemedStyles<T>(styleFactory: (theme: ThemeDefinition, colors: ThemeColors) => T): T {
  const { theme, colors } = useTheme();
  return useMemo(() => styleFactory(theme, colors), [theme, colors, styleFactory]);
}

export const ThemeConsumer = ThemeContext.Consumer;
