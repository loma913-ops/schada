import { describe, it, expect } from 'vitest';
import {
  GAME_PREFERENCES_CONFIG,
  GamePreferencesConfigError,
  validateGamePreferencesConfig,
  type GamePreferencesConfig,
} from '../gamePreferencesConfig';

describe('gamePreferencesConfig', () => {
  it('has valid default configuration', () => {
    expect(GAME_PREFERENCES_CONFIG.storageKeys.showThreatIndicators).toBe('schada_show_threat_indicators');
    expect(GAME_PREFERENCES_CONFIG.storageKeys.theme).toBe('schada_theme');
    expect(GAME_PREFERENCES_CONFIG.mediaQueries.prefersDark).toBe('(prefers-color-scheme: dark)');
    expect(GAME_PREFERENCES_CONFIG.defaults.showThreatIndicators).toBe(true);
    expect(GAME_PREFERENCES_CONFIG.defaults.fallbackTheme).toBe('dark');
  });

  it('throws GamePreferencesConfigError for null or undefined config', () => {
    expect(() => validateGamePreferencesConfig(null as any)).toThrow(GamePreferencesConfigError);
    expect(() => validateGamePreferencesConfig(undefined as any)).toThrow(GamePreferencesConfigError);
  });

  it('throws GamePreferencesConfigError for invalid storageKeys', () => {
    const invalidThreatConfig: GamePreferencesConfig = {
      storageKeys: { showThreatIndicators: '', theme: 'schada_theme' },
      mediaQueries: { prefersDark: '(prefers-color-scheme: dark)' },
      defaults: { showThreatIndicators: true, fallbackTheme: 'dark' },
    };
    expect(() => validateGamePreferencesConfig(invalidThreatConfig)).toThrow(GamePreferencesConfigError);

    const invalidThemeConfig: GamePreferencesConfig = {
      storageKeys: { showThreatIndicators: 'key', theme: '   ' },
      mediaQueries: { prefersDark: '(prefers-color-scheme: dark)' },
      defaults: { showThreatIndicators: true, fallbackTheme: 'dark' },
    };
    expect(() => validateGamePreferencesConfig(invalidThemeConfig)).toThrow(GamePreferencesConfigError);
  });

  it('throws GamePreferencesConfigError for invalid mediaQueries', () => {
    const invalidConfig: GamePreferencesConfig = {
      storageKeys: { showThreatIndicators: 'key', theme: 'theme_key' },
      mediaQueries: { prefersDark: '' },
      defaults: { showThreatIndicators: true, fallbackTheme: 'dark' },
    };
    expect(() => validateGamePreferencesConfig(invalidConfig)).toThrow(GamePreferencesConfigError);
  });

  it('throws GamePreferencesConfigError for invalid defaults', () => {
    const invalidThreatDefault: GamePreferencesConfig = {
      storageKeys: { showThreatIndicators: 'key', theme: 'theme_key' },
      mediaQueries: { prefersDark: '(prefers-color-scheme: dark)' },
      defaults: { showThreatIndicators: 'invalid' as any, fallbackTheme: 'dark' },
    };
    expect(() => validateGamePreferencesConfig(invalidThreatDefault)).toThrow(GamePreferencesConfigError);

    const invalidFallbackTheme: GamePreferencesConfig = {
      storageKeys: { showThreatIndicators: 'key', theme: 'theme_key' },
      mediaQueries: { prefersDark: '(prefers-color-scheme: dark)' },
      defaults: { showThreatIndicators: true, fallbackTheme: 'invalid_theme' as any },
    };
    expect(() => validateGamePreferencesConfig(invalidFallbackTheme)).toThrow(GamePreferencesConfigError);
  });
});
