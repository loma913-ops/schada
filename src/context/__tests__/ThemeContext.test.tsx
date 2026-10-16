import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  ThemeProvider,
  useTheme,
  resolveInitialTheme,
} from '../ThemeContext';
import {
  GAME_PREFERENCES_CONFIG,
  GamePreferencesConfigError,
} from '@/services/preferences/gamePreferencesConfig';

class StorageMock {
  private store: Record<string, string> = {};

  get length() {
    return Object.keys(this.store).length;
  }

  key(index: number): string | null {
    return Object.keys(this.store)[index] || null;
  }

  getItem(key: string) {
    return this.store[key] ?? null;
  }

  setItem(key: string, val: string) {
    this.store[key] = String(val);
  }

  removeItem(key: string) {
    delete this.store[key];
  }

  clear() {
    this.store = {};
  }
}

if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = new StorageMock();
}

describe('ThemeContext - Decoupled Status Bar and Theme Management', () => {
  const origWindow = (globalThis as any).window;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    (globalThis as any).window = origWindow;
    vi.restoreAllMocks();
  });

  describe('resolveInitialTheme', () => {
    it('returns stored theme if valid preference exists in localStorage', () => {
      localStorage.setItem(GAME_PREFERENCES_CONFIG.storageKeys.theme, 'light');
      expect(resolveInitialTheme()).toBe('light');

      localStorage.setItem(GAME_PREFERENCES_CONFIG.storageKeys.theme, 'dark');
      expect(resolveInitialTheme()).toBe('dark');
    });

    it('initializes from device OS setting on first install when no preference stored', () => {
      (globalThis as any).window = {
        matchMedia: vi.fn().mockImplementation((query: string) => ({
          matches: query.includes('dark'),
          media: query,
        })),
      };

      expect(resolveInitialTheme()).toBe('dark');

      (globalThis as any).window = {
        matchMedia: vi.fn().mockImplementation((query: string) => ({
          matches: false,
          media: query,
        })),
      };

      expect(resolveInitialTheme()).toBe('light');
    });

    it('falls back to canonical fallbackTheme if matchMedia throws or is unavailable', () => {
      (globalThis as any).window = {
        matchMedia: vi.fn().mockImplementation(() => {
          throw new Error('matchMedia error');
        }),
      };

      expect(resolveInitialTheme()).toBe(GAME_PREFERENCES_CONFIG.defaults.fallbackTheme);
    });

    it('throws GamePreferencesConfigError if configuration is invalid or missing', () => {
      expect(() => resolveInitialTheme(null as any)).toThrow(GamePreferencesConfigError);
      expect(() =>
        resolveInitialTheme({
          ...GAME_PREFERENCES_CONFIG,
          defaults: { ...GAME_PREFERENCES_CONFIG.defaults, fallbackTheme: 'invalid' as any },
        })
      ).toThrow(GamePreferencesConfigError);
    });
  });

  describe('ThemeProvider and Status Bar Isolation', () => {
    it('renders children and initializes theme context', () => {
      let capturedTheme: string | undefined;
      function TestConsumer() {
        const { theme } = useTheme();
        capturedTheme = theme;
        return <div data-testid="theme">{theme}</div>;
      }

      const html = renderToString(
        <ThemeProvider>
          <TestConsumer />
        </ThemeProvider>
      );

      expect(html).toContain('dark');
      expect(capturedTheme).toBe('dark');
    });

    it('throws meaningful error when useTheme is called outside ThemeProvider', () => {
      function OrphanConsumer() {
        useTheme();
        return null;
      }

      expect(() => renderToString(<OrphanConsumer />)).toThrow(
        'useTheme must be used within a ThemeProvider'
      );
    });
  });
});
