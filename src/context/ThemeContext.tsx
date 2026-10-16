import React, { createContext, useContext, useState, useEffect } from 'react';
import { safeSetItem } from '@/services/storage/storageCleanup';
import { initDeviceSystemBarSync } from '@/services/native/mobileService';
import {
  GAME_PREFERENCES_CONFIG,
  validateGamePreferencesConfig,
  type GamePreferencesConfig,
  type AppTheme,
} from '@/services/preferences/gamePreferencesConfig';

export type Theme = AppTheme;

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Resolves initial theme on application launch:
 * 1. Validates configuration strictly; throws GamePreferencesConfigError if invalid.
 * 2. Returns stored user preference ('dark' | 'light') if previously chosen.
 * 3. On first launch, initializes theme from the device's OS preference via prefers-color-scheme media query.
 * 4. Falls back strictly to configuration-defined fallbackTheme if window.matchMedia is unavailable or throws.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time lookups in localStorage and media query test.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space with zero heap overhead.
 *
 * Growth Rate:
 * - O(1) flat growth rate, maintaining invariant execution time regardless of application state or user count.
 */
export function resolveInitialTheme(
  config: GamePreferencesConfig = GAME_PREFERENCES_CONFIG
): Theme {
  validateGamePreferencesConfig(config);

  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(config.storageKeys.theme);
      if (stored === 'dark' || stored === 'light') {
        return stored;
      }
    }
  } catch {
    // Fall through on restricted storage environments
  }

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      return window.matchMedia(config.mediaQueries.prefersDark).matches ? 'dark' : 'light';
    } catch {
      return config.defaults.fallbackTheme;
    }
  }

  return config.defaults.fallbackTheme;
}

/**
 * ThemeProvider manages application-level UI theme state, localStorage persistence,
 * document dataset attributes, and initiates OS-anchored native status bar synchronization.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) state updates, DOM attribute set, and localStorage write.
 * - Auxiliary Space Complexity: O(1) React state hook and memoized context value.
 *
 * Growth Rate:
 * - O(1) flat growth rate, perfectly sustainable regardless of component tree depth or render cycles.
 */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => resolveInitialTheme());

  // Synchronize native system status bars strictly with the device OS theme on startup and OS changes
  useEffect(() => {
    return initDeviceSystemBarSync();
  }, []);

  // Update in-app document theme attributes and persistent storage without altering the phone's status bar
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    safeSetItem(GAME_PREFERENCES_CONFIG.storageKeys.theme, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * Hook to access current theme and theme toggle callback.
 * Throws explicit Error if used outside ThemeProvider.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) context lookup.
 * - Auxiliary Space Complexity: O(1) reference return.
 *
 * Growth Rate:
 * - O(1) flat growth rate.
 */
export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
};
