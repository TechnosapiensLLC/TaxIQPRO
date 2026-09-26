import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  darkPalette,
  darkTheme,
  lightPalette,
  lightTheme,
  type Palette,
  type Theme,
} from '../theme';

export type ThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'taxiq_theme_mode';

interface ThemeContextValue {
  theme: Theme;
  colors: Palette;
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setModeState(stored);
        }
      })
      .catch(() => {});
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const isDark = mode === 'system' ? systemScheme === 'dark' : mode === 'dark';

  const toggle = useCallback(() => {
    setMode(isDark ? 'light' : 'dark');
  }, [isDark, setMode]);

  // Sync during render so module-scope consumers of `C` never read a stale
  // palette on the first paint after a theme switch.
  syncLivePalette(isDark ? darkPalette : lightPalette);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: isDark ? darkTheme : lightTheme,
      colors: isDark ? darkPalette : lightPalette,
      mode,
      isDark,
      setMode,
      toggle,
    }),
    [isDark, mode, setMode, toggle]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: darkTheme,
      colors: darkPalette,
      mode: 'dark',
      isDark: true,
      setMode: () => {},
      toggle: () => {},
    };
  }
  return ctx;
}

/** Flat palette for screens: `const c = useColors();` */
export function useColors(): Palette {
  return useTheme().colors;
}

/**
 * Live palette for module-scope constants (decorative accent colors declared
 * outside a component). Mutated in place whenever the active theme changes.
 */
export const C: Palette = { ...darkPalette };

export function syncLivePalette(palette: Palette) {
  Object.assign(C, palette);
}
