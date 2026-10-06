/**
 * Game Preferences Configuration
 * Centralizes storage keys and default values for gameplay visual assistance preferences.
 */

export class GamePreferencesConfigError extends Error {
  constructor(message: string) {
    super(`GamePreferencesConfigError: ${message}`);
    this.name = 'GamePreferencesConfigError';
  }
}

export interface GamePreferencesConfig {
  readonly storageKeys: {
    readonly showThreatIndicators: string;
  };
  readonly defaults: {
    readonly showThreatIndicators: boolean;
  };
}

export function validateGamePreferencesConfig(config: GamePreferencesConfig): void {
  if (!config) {
    throw new GamePreferencesConfigError('Game preferences config must be defined');
  }
  if (
    !config.storageKeys ||
    typeof config.storageKeys.showThreatIndicators !== 'string' ||
    !config.storageKeys.showThreatIndicators.trim()
  ) {
    throw new GamePreferencesConfigError('Invalid storageKeys.showThreatIndicators: must be non-empty string');
  }
  if (!config.defaults || typeof config.defaults.showThreatIndicators !== 'boolean') {
    throw new GamePreferencesConfigError('Invalid defaults.showThreatIndicators: must be boolean');
  }
}

export const GAME_PREFERENCES_CONFIG: GamePreferencesConfig = Object.freeze({
  storageKeys: Object.freeze({
    showThreatIndicators: 'schada_show_threat_indicators',
  }),
  defaults: Object.freeze({
    showThreatIndicators: true,
  }),
});

validateGamePreferencesConfig(GAME_PREFERENCES_CONFIG);
