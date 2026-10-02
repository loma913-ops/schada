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
    expect(GAME_PREFERENCES_CONFIG.defaults.showThreatIndicators).toBe(true);
  });

  it('throws GamePreferencesConfigError for null or undefined config', () => {
    expect(() => validateGamePreferencesConfig(null as any)).toThrow(GamePreferencesConfigError);
    expect(() => validateGamePreferencesConfig(undefined as any)).toThrow(GamePreferencesConfigError);
  });

  it('throws GamePreferencesConfigError for invalid storageKeys', () => {
    const invalidConfig: GamePreferencesConfig = {
      storageKeys: { showThreatIndicators: '' },
      defaults: { showThreatIndicators: true },
    };
    expect(() => validateGamePreferencesConfig(invalidConfig)).toThrow(GamePreferencesConfigError);
  });

  it('throws GamePreferencesConfigError for invalid defaults', () => {
    const invalidConfig: GamePreferencesConfig = {
      storageKeys: { showThreatIndicators: 'key' },
      defaults: { showThreatIndicators: 'invalid' as any },
    };
    expect(() => validateGamePreferencesConfig(invalidConfig)).toThrow(GamePreferencesConfigError);
  });
});
