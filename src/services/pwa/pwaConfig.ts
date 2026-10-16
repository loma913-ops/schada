/**
 * Progressive Web Application (PWA) Configuration and Validator.
 *
 * Centralizes storage keys, auto-prompt delays, dismiss state values,
 * media queries, path prefixes, user-agent patterns, and UI copy.
 * Validates configuration to eliminate hard-coded fallback values.
 *
 * Algorithmic Complexity:
 * - Validation: O(1) time, O(1) space
 */

export class PwaConfigError extends Error {
  constructor(message: string) {
    super(`PwaConfigError: ${message}`);
    this.name = 'PwaConfigError';
  }
}

export interface PwaConfig {
  readonly storageKey: string;
  readonly dismissedValue: string;
  readonly delays: {
    readonly androidPromptDelayMs: number;
    readonly iosPromptDelayMs: number;
    readonly installedSuccessDismissDelayMs: number;
  };
  readonly activeGamePathPrefix: string;
  readonly mediaQueries: {
    readonly standalone: string;
  };
  readonly referrerProtocols: {
    readonly androidApp: string;
  };
  readonly userAgentPatterns: {
    readonly appleDeviceRegex: RegExp;
  };
  readonly copy: {
    readonly installAppButtonText: string;
    readonly installAppAriaLabel: string;
    readonly installAppTitle: string;
    readonly installSectionTitle: string;
    readonly installSectionDescription: string;
  };
}

/**
 * Validates the PWA configuration.
 * Throws PwaConfigError if configuration is missing, null, or contains invalid parameters.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time, verifying static configuration keys.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant growth rate as inputs are bounded configuration objects.
 */
export function validatePwaConfig(config: PwaConfig): void {
  if (!config) {
    throw new PwaConfigError('Configuration object is missing or null.');
  }

  if (typeof config.storageKey !== 'string' || config.storageKey.trim().length === 0) {
    throw new PwaConfigError(
      `Invalid storageKey: expected non-empty string, received "${String(config.storageKey)}".`
    );
  }

  if (typeof config.dismissedValue !== 'string' || config.dismissedValue.trim().length === 0) {
    throw new PwaConfigError(
      `Invalid dismissedValue: expected non-empty string, received "${String(config.dismissedValue)}".`
    );
  }

  if (!config.delays) {
    throw new PwaConfigError('Configuration missing delays specification.');
  }

  const { androidPromptDelayMs, iosPromptDelayMs, installedSuccessDismissDelayMs } = config.delays;

  if (
    typeof androidPromptDelayMs !== 'number' ||
    !Number.isFinite(androidPromptDelayMs) ||
    androidPromptDelayMs <= 0
  ) {
    throw new PwaConfigError(
      `Invalid delays.androidPromptDelayMs: expected positive finite number, received ${String(
        androidPromptDelayMs
      )}.`
    );
  }

  if (
    typeof iosPromptDelayMs !== 'number' ||
    !Number.isFinite(iosPromptDelayMs) ||
    iosPromptDelayMs <= 0
  ) {
    throw new PwaConfigError(
      `Invalid delays.iosPromptDelayMs: expected positive finite number, received ${String(
        iosPromptDelayMs
      )}.`
    );
  }

  if (
    typeof installedSuccessDismissDelayMs !== 'number' ||
    !Number.isFinite(installedSuccessDismissDelayMs) ||
    installedSuccessDismissDelayMs <= 0
  ) {
    throw new PwaConfigError(
      `Invalid delays.installedSuccessDismissDelayMs: expected positive finite number, received ${String(
        installedSuccessDismissDelayMs
      )}.`
    );
  }

  if (
    typeof config.activeGamePathPrefix !== 'string' ||
    !config.activeGamePathPrefix.startsWith('/')
  ) {
    throw new PwaConfigError(
      `Invalid activeGamePathPrefix: expected non-empty path starting with "/", received "${String(
        config.activeGamePathPrefix
      )}".`
    );
  }

  if (
    !config.mediaQueries ||
    typeof config.mediaQueries.standalone !== 'string' ||
    config.mediaQueries.standalone.trim().length === 0
  ) {
    throw new PwaConfigError('Invalid mediaQueries.standalone: expected non-empty string.');
  }

  if (
    !config.referrerProtocols ||
    typeof config.referrerProtocols.androidApp !== 'string' ||
    config.referrerProtocols.androidApp.trim().length === 0
  ) {
    throw new PwaConfigError('Invalid referrerProtocols.androidApp: expected non-empty string.');
  }

  if (
    !config.userAgentPatterns ||
    !(config.userAgentPatterns.appleDeviceRegex instanceof RegExp)
  ) {
    throw new PwaConfigError(
      'Invalid userAgentPatterns.appleDeviceRegex: expected RegExp instance.'
    );
  }

  if (!config.copy) {
    throw new PwaConfigError('Invalid copy: expected configuration copy object.');
  }

  const requiredCopyKeys: (keyof PwaConfig['copy'])[] = [
    'installAppButtonText',
    'installAppAriaLabel',
    'installAppTitle',
    'installSectionTitle',
    'installSectionDescription',
  ];

  for (const key of requiredCopyKeys) {
    if (typeof config.copy[key] !== 'string' || config.copy[key].trim().length === 0) {
      throw new PwaConfigError(`Invalid copy.${key}: expected non-empty string.`);
    }
  }
}

/**
 * Canonical, immutable PWA configuration for Schada.
 */
export const PWA_CONFIG: PwaConfig = Object.freeze({
  storageKey: 'schada_pwa_dismissed',
  dismissedValue: 'true',
  delays: Object.freeze({
    androidPromptDelayMs: 1500,
    iosPromptDelayMs: 2000,
    installedSuccessDismissDelayMs: 1600,
  }),
  activeGamePathPrefix: '/game/',
  mediaQueries: Object.freeze({
    standalone: '(display-mode: standalone)',
  }),
  referrerProtocols: Object.freeze({
    androidApp: 'android-app://',
  }),
  userAgentPatterns: Object.freeze({
    appleDeviceRegex: /iphone|ipad|ipod/i,
  }),
  copy: Object.freeze({
    installAppButtonText: 'Install App',
    installAppAriaLabel: 'Install Schada App',
    installAppTitle: 'Install Schada App',
    installSectionTitle: 'Install Application',
    installSectionDescription:
      'Install Schada on your device for fast home screen access, full-screen play, and offline support.',
  }),
});
