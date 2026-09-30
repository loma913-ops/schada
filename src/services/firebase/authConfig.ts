/**
 * User Profile and Authentication Configuration.
 *
 * Centralizes username validation boundaries, allowable character regex patterns,
 * and user format rules.
 * Validates configuration to eliminate hard-coded fallback values.
 */

export class AuthConfigError extends Error {
  constructor(message: string) {
    super(`AuthConfigError: ${message}`);
    this.name = 'AuthConfigError';
  }
}

export interface AuthConfig {
  readonly minUsernameLength: number;
  readonly maxUsernameLength: number;
  readonly usernameRegex: RegExp;
  readonly usernameRegexDescription: string;
}

/**
 * Validates the AuthConfig at startup.
 * Throws AuthConfigError if configuration is missing, null, or contains invalid parameters.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time, static range comparisons.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant, fully scalable with zero dynamic allocations.
 */
export function validateAuthConfig(config: AuthConfig): void {
  if (!config) {
    throw new AuthConfigError('Configuration object is missing or null.');
  }

  if (
    typeof config.minUsernameLength !== 'number' ||
    isNaN(config.minUsernameLength) ||
    config.minUsernameLength <= 0
  ) {
    throw new AuthConfigError(
      `Invalid minUsernameLength: expected positive number, received ${config.minUsernameLength}.`
    );
  }

  if (
    typeof config.maxUsernameLength !== 'number' ||
    isNaN(config.maxUsernameLength) ||
    config.maxUsernameLength <= config.minUsernameLength
  ) {
    throw new AuthConfigError(
      `Invalid maxUsernameLength: expected number > minUsernameLength (${config.minUsernameLength}), received ${config.maxUsernameLength}.`
    );
  }

  if (!(config.usernameRegex instanceof RegExp)) {
    throw new AuthConfigError('Invalid usernameRegex: expected RegExp instance.');
  }

  if (
    typeof config.usernameRegexDescription !== 'string' ||
    config.usernameRegexDescription.trim().length === 0
  ) {
    throw new AuthConfigError('Invalid usernameRegexDescription: expected non-empty string.');
  }
}

export const AUTH_CONFIG: AuthConfig = Object.freeze({
  minUsernameLength: 3,
  maxUsernameLength: 20,
  usernameRegex: /^[a-zA-Z0-9_]+$/,
  usernameRegexDescription: 'letters, numbers, and underscores',
});

// Self-validate canonical auth configuration upon module load
validateAuthConfig(AUTH_CONFIG);
