/**
 * Native Mobile Configuration for Capacitor 8.
 *
 * Centralizes all native device settings, origin URLs, haptic mappings,
 * hardware back-button behaviors, and store URLs.
 * Eliminates hard-coded fallback values with strict startup validation.
 */

export class NativeConfigError extends Error {
  constructor(message: string) {
    super(`NativeConfigError: ${message}`);
    this.name = 'NativeConfigError';
  }
}

export type NativeImpactStyleName = 'light' | 'medium' | 'heavy';
export type NativeNotificationTypeName = 'success' | 'warning' | 'error';
export type NativeInGameBackBehavior = 'minimize' | 'ignore';

export interface NativeHapticConfig {
  readonly move: NativeImpactStyleName;
  readonly capture: NativeImpactStyleName;
  readonly goal: NativeImpactStyleName;
  readonly victory: NativeNotificationTypeName;
}

export interface NativeSystemBarsConfig {
  readonly dark: 'DARK';
  readonly light: 'LIGHT';
}

export interface NativeForceUpdateConfig {
  readonly enabled: boolean;
  readonly versionManifestUrl: string;
  readonly checkThrottleMs: number;
  readonly minSupportedVersion: string;
  readonly storeUrls: {
    readonly android: string;
    readonly ios: string;
  };
}

export interface NativeConfig {
  readonly publicWebOrigin: string;
  readonly clipboardFeedbackDurationMs: number;
  readonly haptics: NativeHapticConfig;
  readonly backButton: {
    readonly inGameBehavior: NativeInGameBackBehavior;
  };
  readonly systemBars: NativeSystemBarsConfig;
  readonly forceUpdate: NativeForceUpdateConfig;
}

export const NATIVE_CONFIG: NativeConfig = Object.freeze({
  publicWebOrigin: 'https://schada.org',
  clipboardFeedbackDurationMs: 2500,
  haptics: Object.freeze({
    move: 'light' as const,
    capture: 'heavy' as const,
    goal: 'medium' as const,
    victory: 'success' as const,
  }),
  backButton: Object.freeze({
    inGameBehavior: 'minimize' as const,
  }),
  systemBars: Object.freeze({
    dark: 'DARK' as const,
    light: 'LIGHT' as const,
  }),
  forceUpdate: Object.freeze({
    enabled: false,
    versionManifestUrl: 'https://schada.org/version.json',
    checkThrottleMs: 6 * 60 * 60 * 1000, // 6 hours
    minSupportedVersion: '1.4.0',
    storeUrls: Object.freeze({
      android: 'https://play.google.com/store/apps/details?id=org.schada.app',
      ios: 'https://apps.apple.com/app/id000000000',
    }),
  }),
});

/**
 * Validates the NativeConfig at startup.
 * Throws NativeConfigError if configuration is missing, null, or contains invalid parameters.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time, static range comparisons.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant, fully scalable with zero dynamic allocations.
 */
export function validateNativeConfig(config: NativeConfig = NATIVE_CONFIG): void {
  if (!config) {
    throw new NativeConfigError('Configuration object is missing or null.');
  }

  if (typeof config.publicWebOrigin !== 'string' || !config.publicWebOrigin.startsWith('https://')) {
    throw new NativeConfigError('Invalid publicWebOrigin: expected secure HTTPS origin string.');
  }

  if (
    typeof config.clipboardFeedbackDurationMs !== 'number' ||
    isNaN(config.clipboardFeedbackDurationMs) ||
    config.clipboardFeedbackDurationMs <= 0
  ) {
    throw new NativeConfigError(
      `Invalid clipboardFeedbackDurationMs: expected positive number, received ${config.clipboardFeedbackDurationMs}.`
    );
  }

  if (!config.haptics || typeof config.haptics !== 'object') {
    throw new NativeConfigError('Invalid haptics: expected configuration object.');
  }

  const validImpactStyles: Set<string> = new Set(['light', 'medium', 'heavy']);
  if (!validImpactStyles.has(config.haptics.move)) {
    throw new NativeConfigError(
      `Invalid haptics.move: expected 'light', 'medium', or 'heavy', received '${config.haptics.move}'.`
    );
  }
  if (!validImpactStyles.has(config.haptics.capture)) {
    throw new NativeConfigError(
      `Invalid haptics.capture: expected 'light', 'medium', or 'heavy', received '${config.haptics.capture}'.`
    );
  }
  if (!validImpactStyles.has(config.haptics.goal)) {
    throw new NativeConfigError(
      `Invalid haptics.goal: expected 'light', 'medium', or 'heavy', received '${config.haptics.goal}'.`
    );
  }
  if (!['success', 'warning', 'error'].includes(config.haptics.victory)) {
    throw new NativeConfigError(
      `Invalid haptics.victory: expected 'success', 'warning', or 'error', received '${config.haptics.victory}'.`
    );
  }

  if (!config.backButton || typeof config.backButton !== 'object') {
    throw new NativeConfigError('Invalid backButton: expected configuration object.');
  }
  if (!['minimize', 'ignore'].includes(config.backButton.inGameBehavior)) {
    throw new NativeConfigError(
      `Invalid backButton.inGameBehavior: expected 'minimize' or 'ignore', received '${config.backButton.inGameBehavior}'.`
    );
  }

  if (!config.systemBars || typeof config.systemBars !== 'object') {
    throw new NativeConfigError('Invalid systemBars: expected configuration object.');
  }
  if (config.systemBars.dark !== 'DARK') {
    throw new NativeConfigError(`Invalid systemBars.dark: expected 'DARK', received '${config.systemBars.dark}'.`);
  }
  if (config.systemBars.light !== 'LIGHT') {
    throw new NativeConfigError(`Invalid systemBars.light: expected 'LIGHT', received '${config.systemBars.light}'.`);
  }

  if (!config.forceUpdate || typeof config.forceUpdate !== 'object') {
    throw new NativeConfigError('Invalid forceUpdate: expected configuration object.');
  }
  if (config.forceUpdate.enabled) {
    if (!config.forceUpdate.versionManifestUrl.startsWith('https://')) {
      throw new NativeConfigError('Invalid forceUpdate.versionManifestUrl: expected secure HTTPS URL.');
    }
    if (
      typeof config.forceUpdate.checkThrottleMs !== 'number' ||
      isNaN(config.forceUpdate.checkThrottleMs) ||
      config.forceUpdate.checkThrottleMs <= 0
    ) {
      throw new NativeConfigError('Invalid forceUpdate.checkThrottleMs: expected positive number.');
    }
    if (!config.forceUpdate.minSupportedVersion || !/^\d+\.\d+\.\d+$/.test(config.forceUpdate.minSupportedVersion)) {
      throw new NativeConfigError('Invalid forceUpdate.minSupportedVersion: expected valid semver string.');
    }
    if (!config.forceUpdate.storeUrls || typeof config.forceUpdate.storeUrls !== 'object') {
      throw new NativeConfigError('Invalid forceUpdate.storeUrls: expected configuration object.');
    }
    if (!config.forceUpdate.storeUrls.android.startsWith('https://')) {
      throw new NativeConfigError('Invalid forceUpdate.storeUrls.android: expected valid store URL.');
    }
    if (!config.forceUpdate.storeUrls.ios.startsWith('https://')) {
      throw new NativeConfigError('Invalid forceUpdate.storeUrls.ios: expected valid store URL.');
    }
  }
}

// Self-validate canonical configuration upon module initialization
validateNativeConfig(NATIVE_CONFIG);
