/**
 * Deployment Recovery Configuration and Error Handlers.
 *
 * Centralizes configuration for detecting chunk load failures after
 * new client deployments, debouncing auto-reload loops, and tracking
 * recovery storage keys.
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
}

export const DEPLOYMENT_RECOVERY_CONFIG: DeploymentRecoveryConfig = Object.freeze({
  storageKey: 'schada_chunk_reload_timestamp',
  debounceCooldownMs: 10000,
  chunkErrorPatterns: Object.freeze([
    'Failed to fetch dynamically imported module',
    'error loading dynamically imported module',
    'Importing a module script failed',
    'error loading dynamically imported module script',
  ]),
});

// Immediately validate deployment recovery configuration at module load time
validateDeploymentRecoveryConfig(DEPLOYMENT_RECOVERY_CONFIG);
