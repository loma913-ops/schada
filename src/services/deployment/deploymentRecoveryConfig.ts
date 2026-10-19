/**
 * Deployment Recovery Configuration and Error Handlers.
 *
 * Centralizes configuration for detecting chunk load failures after
 * new client deployments, debouncing auto-reload loops, tracking
 * recovery storage keys, service worker update polling, version
 * manifest verification, and active gameplay reload deferral timers.
 * Validates configuration to eliminate hard-coded fallback values.
 */

export class DeploymentRecoveryConfigError extends Error {
  constructor(message: string) {
    super(`DeploymentRecoveryConfigError: ${message}`);
    this.name = 'DeploymentRecoveryConfigError';
  }
}

export interface DeploymentRecoveryConfig {
  readonly storageKey: string;
  readonly debounceCooldownMs: number;
  readonly chunkErrorPatterns: readonly string[];
  readonly swRegistrationUrl: string;
  readonly swScope: string;
  readonly swUpdateCheckIntervalMs: number;
  readonly versionCheckEndpoint: string;
  readonly versionCheckIntervalMs: number;
  readonly activeGamePathPrefix: string;
  readonly nonActiveMatchReloadDelayMs: number;
  readonly initialBuildTimeFallback: number;
  readonly enableInDevMode: boolean;
}

/**
 * Validates the DeploymentRecoveryConfig.
 * Throws DeploymentRecoveryConfigError if configuration is missing, null, or contains invalid parameters.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(P) where P is the number of error patterns to validate.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(P) linear with respect to pattern array size (constant O(1) for static configs).
 */
export function validateDeploymentRecoveryConfig(config: DeploymentRecoveryConfig): void {
  if (!config) {
    throw new DeploymentRecoveryConfigError('Configuration object is missing or null.');
  }

  if (typeof config.storageKey !== 'string' || config.storageKey.trim().length === 0) {
    throw new DeploymentRecoveryConfigError(
      `Invalid storageKey: expected non-empty string, received "${config.storageKey}".`
    );
  }

  if (
    typeof config.debounceCooldownMs !== 'number' ||
    isNaN(config.debounceCooldownMs) ||
    config.debounceCooldownMs <= 0
  ) {
    throw new DeploymentRecoveryConfigError(
      `Invalid debounceCooldownMs: expected positive number, received ${config.debounceCooldownMs}.`
    );
  }

  if (!Array.isArray(config.chunkErrorPatterns) || config.chunkErrorPatterns.length === 0) {
    throw new DeploymentRecoveryConfigError(
      'Invalid chunkErrorPatterns: expected non-empty array of strings.'
    );
  }

  for (let i = 0; i < config.chunkErrorPatterns.length; i++) {
    const pattern = config.chunkErrorPatterns[i];
    if (typeof pattern !== 'string' || pattern.trim().length === 0) {
      throw new DeploymentRecoveryConfigError(
        `Invalid chunkErrorPatterns[${i}]: expected non-empty string, received "${pattern}".`
      );
    }
  }

  if (
    typeof config.swRegistrationUrl !== 'string' ||
    config.swRegistrationUrl.trim().length === 0 ||
    !config.swRegistrationUrl.startsWith('/')
  ) {
    throw new DeploymentRecoveryConfigError(
      `Invalid swRegistrationUrl: expected path starting with "/", received "${config.swRegistrationUrl}".`
    );
  }

  if (
    typeof config.swScope !== 'string' ||
    config.swScope.trim().length === 0 ||
    !config.swScope.startsWith('/')
  ) {
    throw new DeploymentRecoveryConfigError(
      `Invalid swScope: expected path starting with "/", received "${config.swScope}".`
    );
  }

  if (
    typeof config.swUpdateCheckIntervalMs !== 'number' ||
    isNaN(config.swUpdateCheckIntervalMs) ||
    config.swUpdateCheckIntervalMs <= 0
  ) {
    throw new DeploymentRecoveryConfigError(
      `Invalid swUpdateCheckIntervalMs: expected positive number, received ${config.swUpdateCheckIntervalMs}.`
    );
  }

  if (
    typeof config.versionCheckEndpoint !== 'string' ||
    config.versionCheckEndpoint.trim().length === 0 ||
    !config.versionCheckEndpoint.startsWith('/')
  ) {
    throw new DeploymentRecoveryConfigError(
      `Invalid versionCheckEndpoint: expected path starting with "/", received "${config.versionCheckEndpoint}".`
    );
  }

  if (
    typeof config.versionCheckIntervalMs !== 'number' ||
    isNaN(config.versionCheckIntervalMs) ||
    config.versionCheckIntervalMs <= 0
  ) {
    throw new DeploymentRecoveryConfigError(
      `Invalid versionCheckIntervalMs: expected positive number, received ${config.versionCheckIntervalMs}.`
    );
  }

  if (
    typeof config.activeGamePathPrefix !== 'string' ||
    config.activeGamePathPrefix.trim().length === 0 ||
    !config.activeGamePathPrefix.startsWith('/')
  ) {
    throw new DeploymentRecoveryConfigError(
      `Invalid activeGamePathPrefix: expected path starting with "/", received "${config.activeGamePathPrefix}".`
    );
  }

  if (
    typeof config.nonActiveMatchReloadDelayMs !== 'number' ||
    isNaN(config.nonActiveMatchReloadDelayMs) ||
    config.nonActiveMatchReloadDelayMs < 0
  ) {
    throw new DeploymentRecoveryConfigError(
      `Invalid nonActiveMatchReloadDelayMs: expected non-negative number, received ${config.nonActiveMatchReloadDelayMs}.`
    );
  }

  if (
    typeof config.initialBuildTimeFallback !== 'number' ||
    isNaN(config.initialBuildTimeFallback) ||
    config.initialBuildTimeFallback < 0
  ) {
    throw new DeploymentRecoveryConfigError(
      `Invalid initialBuildTimeFallback: expected non-negative number, received ${config.initialBuildTimeFallback}.`
    );
  }

  if (typeof config.enableInDevMode !== 'boolean') {
    throw new DeploymentRecoveryConfigError(
      `Invalid enableInDevMode: expected boolean, received ${String(config.enableInDevMode)}.`
    );
  }
}

export const DEPLOYMENT_RECOVERY_CONFIG: DeploymentRecoveryConfig = Object.freeze({
  storageKey: 'schada_chunk_reload_timestamp',
  debounceCooldownMs: 10000,
  chunkErrorPatterns: Object.freeze([
    'Failed to fetch dynamically imported module',
    'error loading dynamically imported module',
    'Importing a module script failed',
    'error loading dynamically imported module script',
    'Unable to preload CSS',
    'failed to load module script',
    'Loading chunk',
    'Load failed',
  ]),
  swRegistrationUrl: '/sw.js',
  swScope: '/',
  swUpdateCheckIntervalMs: 120000, // 2 minutes
  versionCheckEndpoint: '/version.json',
  versionCheckIntervalMs: 120000, // 2 minutes
  activeGamePathPrefix: '/game/',
  nonActiveMatchReloadDelayMs: 500,
  initialBuildTimeFallback: 0,
  enableInDevMode: false,
});

// Immediately validate deployment recovery configuration at module load time
validateDeploymentRecoveryConfig(DEPLOYMENT_RECOVERY_CONFIG);
