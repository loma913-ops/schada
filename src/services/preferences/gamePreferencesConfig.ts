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

export type AppTheme = 'dark' | 'light';

export interface GamePreferencesConfig {
  readonly storageKeys: {
    readonly showThreatIndicators: string;
    readonly theme: string;
  };
  readonly mediaQueries: {
    readonly prefersDark: string;
  };
  readonly defaults: {
    readonly showThreatIndicators: boolean;
    readonly fallbackTheme: AppTheme;
  };
}

/**
 * Validates the GamePreferencesConfig object at module initialization or runtime.
 * Throws GamePreferencesConfigError if the configuration object is missing, null, or contains invalid values.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time, fixed structural property checks and string validations.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space with zero heap allocations.
 *
 * Growth Rate:
 * - O(1) flat growth rate, ensuring invariant scalability and zero performance overhead regardless of call volume.
 */
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
  if (
    typeof config.storageKeys.theme !== 'string' ||
    !config.storageKeys.theme.trim()
  ) {
    throw new GamePreferencesConfigError('Invalid storageKeys.theme: must be non-empty string');
  }
  if (
    !config.mediaQueries ||
    typeof config.mediaQueries.prefersDark !== 'string' ||
    !config.mediaQueries.prefersDark.trim()
  ) {
    throw new GamePreferencesConfigError('Invalid mediaQueries.prefersDark: must be non-empty string');
  }
  if (!config.defaults || typeof config.defaults.showThreatIndicators !== 'boolean') {
    throw new GamePreferencesConfigError('Invalid defaults.showThreatIndicators: must be boolean');
  }
  if (config.defaults.fallbackTheme !== 'dark' && config.defaults.fallbackTheme !== 'light') {
    throw new GamePreferencesConfigError('Invalid defaults.fallbackTheme: must be "dark" or "light"');
  }
}

export const GAME_PREFERENCES_CONFIG: GamePreferencesConfig = Object.freeze({
  storageKeys: Object.freeze({
    showThreatIndicators: 'schada_show_threat_indicators',
    theme: 'schada_theme',
  }),
  mediaQueries: Object.freeze({
    prefersDark: '(prefers-color-scheme: dark)',
  }),
  defaults: Object.freeze({
    showThreatIndicators: true,
    fallbackTheme: 'dark' as const,
  }),
});

validateGamePreferencesConfig(GAME_PREFERENCES_CONFIG);
