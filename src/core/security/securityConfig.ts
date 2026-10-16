/**
 * Security and Authorization Boundaries Configuration.
 *
 * Centralizes all security bounds, rate limits, mutable field whitelists,
 * immutable match keys, session length limits, and Elo protection parameters
 * enforced at the database boundary and application runtime.
 *
 * Validates configuration at startup to strictly eliminate hard-coded fallback values.
 */

export class SecurityConfigError extends Error {
  constructor(message: string) {
    super(`SecurityConfigError: ${message}`);
    this.name = 'SecurityConfigError';
  }
}

export interface SecurityConfig {
  /** Maximum allowable username length enforced in rules and UI */
  readonly maxUsernameLength: number;
  /** Minimum allowable username length enforced in rules and UI */
  readonly minUsernameLength: number;
  /** Maximum number of lifetime username changes permitted per account */
  readonly maxUsernameChanges: number;
  /** Maximum absolute Elo delta permitted in a single match update to prevent rating injection */
  readonly maxSingleGameEloDelta: number;
  /** Authoritative starting Elo rating enforced on new profile creation */
  readonly startingEloRating: number;
  /** Maximum permitted character length for guest session identifiers */
  readonly maxGuestSessionIdLength: number;
  /** Allowed property keys for guest presence session documents */
  readonly guestSessionAllowedKeys: readonly string[];
  /** Allowed mutable property keys for user profile document updates */
  readonly mutableUserKeys: readonly string[];
  /** Strict immutable property keys for game documents */
  readonly immutableGameKeys: readonly string[];
  /** Standard empty string fallback for email hydration when unauthenticated */
  readonly emptyEmailFallback: string;
  /** Exact character length of canonical game identifiers */
  readonly gameIdLength: number;
  /** Allowed characters for game identifier generation (Base62 alphanumeric case-sensitive) */
  readonly gameIdCharset: string;
  /** Regular expression pattern for strict game identifier validation */
  readonly gameIdRegexPattern: string;
  /** Maximum transaction retry attempts for duplicate game ID collision resolution */
  readonly maxGameIdCreationRetries: number;
  /** Canonical notification message displayed when navigating to an invalid game identifier */
  readonly invalidGameIdErrorMessage: string;
  /** Duration in milliseconds that application toast notifications remain visible */
  readonly toastNotificationDurationMs: number;
  /** Character length of random suffix for guest identifiers */
  readonly guestIdRandomLength: number;
  /** Prefix for guest identifiers */
  readonly guestIdPrefix: string;
  /** Character length of random suffix for client session identifiers */
  readonly sessionIdRandomLength: number;
  /** Prefix for client session identifiers */
  readonly sessionIdPrefix: string;
  /** Character length of cryptographically secure player session tokens */
  readonly sessionTokenRandomLength: number;
  /** Prefix for player session tokens */
  readonly sessionTokenPrefix: string;
  /** Character length of random suffix for local user identifiers */
  readonly userIdRandomLength: number;
  /** Prefix for local user identifiers */
  readonly userIdPrefix: string;
  /** Character length of random suffix for local friend request identifiers */
  readonly friendRequestIdRandomLength: number;
  /** Prefix for local friend request identifiers */
  readonly friendRequestIdPrefix: string;
}

/**
 * Validates the SecurityConfig at module initialization.
 * Throws SecurityConfigError if configuration is missing, null, or contains invalid parameters.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time, static range comparisons and array boundary checks.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant, fully scalable with zero dynamic allocations as data volume increases.
 */
export function validateSecurityConfig(config: SecurityConfig): void {
  if (!config) {
    throw new SecurityConfigError('Configuration object is missing or null.');
  }

  if (
    typeof config.minUsernameLength !== 'number' ||
    !Number.isFinite(config.minUsernameLength) ||
    config.minUsernameLength <= 0
  ) {
    throw new SecurityConfigError(
      `Invalid minUsernameLength: expected positive finite number, received ${String(
        config.minUsernameLength
      )}.`
    );
  }

  if (
    typeof config.maxUsernameLength !== 'number' ||
    !Number.isFinite(config.maxUsernameLength) ||
    config.maxUsernameLength <= config.minUsernameLength
  ) {
    throw new SecurityConfigError(
      `Invalid maxUsernameLength: expected number > minUsernameLength (${config.minUsernameLength}), received ${String(
        config.maxUsernameLength
      )}.`
    );
  }

  if (
    typeof config.maxUsernameChanges !== 'number' ||
    !Number.isFinite(config.maxUsernameChanges) ||
    config.maxUsernameChanges < 0
  ) {
    throw new SecurityConfigError(
      `Invalid maxUsernameChanges: expected non-negative number, received ${String(
        config.maxUsernameChanges
      )}.`
    );
  }

  if (
    typeof config.maxSingleGameEloDelta !== 'number' ||
    !Number.isFinite(config.maxSingleGameEloDelta) ||
    config.maxSingleGameEloDelta <= 0
  ) {
    throw new SecurityConfigError(
      `Invalid maxSingleGameEloDelta: expected positive finite number, received ${String(
        config.maxSingleGameEloDelta
      )}.`
    );
  }

  if (
    typeof config.startingEloRating !== 'number' ||
    !Number.isFinite(config.startingEloRating) ||
    config.startingEloRating <= 0
  ) {
    throw new SecurityConfigError(
      `Invalid startingEloRating: expected positive finite number, received ${String(
        config.startingEloRating
      )}.`
    );
  }

  if (
    typeof config.maxGuestSessionIdLength !== 'number' ||
    !Number.isFinite(config.maxGuestSessionIdLength) ||
    config.maxGuestSessionIdLength <= 0
  ) {
    throw new SecurityConfigError(
      `Invalid maxGuestSessionIdLength: expected positive finite number, received ${String(
        config.maxGuestSessionIdLength
      )}.`
    );
  }

  if (!Array.isArray(config.guestSessionAllowedKeys) || config.guestSessionAllowedKeys.length === 0) {
    throw new SecurityConfigError('Invalid guestSessionAllowedKeys: expected non-empty array of strings.');
  }

  if (!Array.isArray(config.mutableUserKeys) || config.mutableUserKeys.length === 0) {
    throw new SecurityConfigError('Invalid mutableUserKeys: expected non-empty array of strings.');
  }

  if (!Array.isArray(config.immutableGameKeys) || config.immutableGameKeys.length === 0) {
    throw new SecurityConfigError('Invalid immutableGameKeys: expected non-empty array of strings.');
  }

  if (typeof config.emptyEmailFallback !== 'string') {
    throw new SecurityConfigError('Invalid emptyEmailFallback: expected string value.');
  }

  if (
    typeof config.gameIdLength !== 'number' ||
    !Number.isFinite(config.gameIdLength) ||
    config.gameIdLength <= 0 ||
    !Number.isInteger(config.gameIdLength)
  ) {
    throw new SecurityConfigError(
      `Invalid gameIdLength: expected positive integer, received ${String(config.gameIdLength)}.`
    );
  }

  if (
    typeof config.gameIdCharset !== 'string' ||
    config.gameIdCharset.length === 0 ||
    new Set(config.gameIdCharset).size !== config.gameIdCharset.length
  ) {
    throw new SecurityConfigError('Invalid gameIdCharset: expected non-empty string with unique characters.');
  }

  if (
    typeof config.gameIdRegexPattern !== 'string' ||
    config.gameIdRegexPattern.length === 0
  ) {
    throw new SecurityConfigError('Invalid gameIdRegexPattern: expected non-empty string.');
  }

  try {
    new RegExp(config.gameIdRegexPattern);
  } catch {
    throw new SecurityConfigError('Invalid gameIdRegexPattern: pattern is not a valid regular expression.');
  }

  if (
    typeof config.maxGameIdCreationRetries !== 'number' ||
    !Number.isFinite(config.maxGameIdCreationRetries) ||
    config.maxGameIdCreationRetries < 1 ||
    !Number.isInteger(config.maxGameIdCreationRetries)
  ) {
    throw new SecurityConfigError(
      `Invalid maxGameIdCreationRetries: expected positive integer >= 1, received ${String(
        config.maxGameIdCreationRetries
      )}.`
    );
  }

  if (
    typeof config.invalidGameIdErrorMessage !== 'string' ||
    config.invalidGameIdErrorMessage.trim().length === 0
  ) {
    throw new SecurityConfigError('Invalid invalidGameIdErrorMessage: expected non-empty string.');
  }

  if (
    typeof config.toastNotificationDurationMs !== 'number' ||
    !Number.isFinite(config.toastNotificationDurationMs) ||
    config.toastNotificationDurationMs <= 0 ||
    !Number.isInteger(config.toastNotificationDurationMs)
  ) {
    throw new SecurityConfigError(
      `Invalid toastNotificationDurationMs: expected positive integer, received ${String(
        config.toastNotificationDurationMs
      )}.`
    );
  }

  if (
    typeof config.guestIdRandomLength !== 'number' ||
    !Number.isFinite(config.guestIdRandomLength) ||
    config.guestIdRandomLength < 4 ||
    !Number.isInteger(config.guestIdRandomLength)
  ) {
    throw new SecurityConfigError(
      `Invalid guestIdRandomLength: expected positive integer >= 4, received ${String(
        config.guestIdRandomLength
      )}.`
    );
  }

  if (typeof config.guestIdPrefix !== 'string' || config.guestIdPrefix.trim().length === 0) {
    throw new SecurityConfigError('Invalid guestIdPrefix: expected non-empty string.');
  }

  if (
    typeof config.sessionIdRandomLength !== 'number' ||
    !Number.isFinite(config.sessionIdRandomLength) ||
    config.sessionIdRandomLength < 4 ||
    !Number.isInteger(config.sessionIdRandomLength)
  ) {
    throw new SecurityConfigError(
      `Invalid sessionIdRandomLength: expected positive integer >= 4, received ${String(
        config.sessionIdRandomLength
      )}.`
    );
  }

  if (typeof config.sessionIdPrefix !== 'string' || config.sessionIdPrefix.trim().length === 0) {
    throw new SecurityConfigError('Invalid sessionIdPrefix: expected non-empty string.');
  }

  if (
    typeof config.sessionTokenRandomLength !== 'number' ||
    !Number.isFinite(config.sessionTokenRandomLength) ||
    config.sessionTokenRandomLength < 8 ||
    !Number.isInteger(config.sessionTokenRandomLength)
  ) {
    throw new SecurityConfigError(
      `Invalid sessionTokenRandomLength: expected positive integer >= 8, received ${String(
        config.sessionTokenRandomLength
      )}.`
    );
  }

  if (typeof config.sessionTokenPrefix !== 'string' || config.sessionTokenPrefix.trim().length === 0) {
    throw new SecurityConfigError('Invalid sessionTokenPrefix: expected non-empty string.');
  }

  if (
    typeof config.userIdRandomLength !== 'number' ||
    !Number.isFinite(config.userIdRandomLength) ||
    config.userIdRandomLength < 4 ||
    !Number.isInteger(config.userIdRandomLength)
  ) {
    throw new SecurityConfigError(
      `Invalid userIdRandomLength: expected positive integer >= 4, received ${String(
        config.userIdRandomLength
      )}.`
    );
  }

  if (typeof config.userIdPrefix !== 'string' || config.userIdPrefix.trim().length === 0) {
    throw new SecurityConfigError('Invalid userIdPrefix: expected non-empty string.');
  }

  if (
    typeof config.friendRequestIdRandomLength !== 'number' ||
    !Number.isFinite(config.friendRequestIdRandomLength) ||
    config.friendRequestIdRandomLength < 4 ||
    !Number.isInteger(config.friendRequestIdRandomLength)
  ) {
    throw new SecurityConfigError(
      `Invalid friendRequestIdRandomLength: expected positive integer >= 4, received ${String(
        config.friendRequestIdRandomLength
      )}.`
    );
  }

  if (typeof config.friendRequestIdPrefix !== 'string' || config.friendRequestIdPrefix.trim().length === 0) {
    throw new SecurityConfigError('Invalid friendRequestIdPrefix: expected non-empty string.');
  }
}

export const SECURITY_CONFIG: SecurityConfig = Object.freeze({
  minUsernameLength: 3,
  maxUsernameLength: 20,
  maxUsernameChanges: 1,
  maxSingleGameEloDelta: 64,
  startingEloRating: 1200,
  maxGuestSessionIdLength: 64,
  guestSessionAllowedKeys: Object.freeze(['lastSeen', 'updatedAt']),
  mutableUserKeys: Object.freeze([
    'status',
    'lastSeen',
    'eloRating',
    'perModeStats',
    'gamesPlayed',
    'gamesWon',
    'gamesLost',
    'gamesDrawn',
    'username',
    'usernameLower',
    'usernameChangeCount',
    'updatedAt',
    'email',
  ]),
  immutableGameKeys: Object.freeze([
    'id',
    'createdAt',
    'isRanked',
    'timeControlMinutes',
    'incrementSeconds',
    'creatorColorPref',
  ]),
  emptyEmailFallback: '',
  gameIdLength: 9,
  gameIdCharset: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  gameIdRegexPattern: '^[0-9a-zA-Z]{9}$',
  maxGameIdCreationRetries: 3,
  invalidGameIdErrorMessage: 'Invalid game ID',
  toastNotificationDurationMs: 4000,
  guestIdRandomLength: 10,
  guestIdPrefix: 'guest_',
  sessionIdRandomLength: 12,
  sessionIdPrefix: 'session_',
  sessionTokenRandomLength: 16,
  sessionTokenPrefix: 'tok_',
  userIdRandomLength: 12,
  userIdPrefix: 'user_',
  friendRequestIdRandomLength: 12,
  friendRequestIdPrefix: 'freq_',
});

// Self-validate security configuration upon module initialization
validateSecurityConfig(SECURITY_CONFIG);
