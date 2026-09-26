/**
 * Multiplayer and Presence Scaling Configuration.
 *
 * Centralizes all timing, limits, and scaling parameters for
 * presence heartbeats, lobby stats aggregation, and matchmaking queries.
 * Validates configuration to eliminate hard-coded fallback values.
 */

export interface PresenceConfig {
  readonly idleTimeoutMs: number;
  readonly hiddenGracePeriodMs: number;
  readonly sessionTtlMs: number;
  readonly heartbeatIntervalMs: number;
  readonly activityThrottleMs: number;
  readonly statsPollIntervalMs: number;
  readonly statsPollJitterMs: number;
  readonly statsInitialFallbackDelayMs: number;
}

export interface MatchmakingConfig {
  readonly maxOpenRoomsLobbyLimit: number;
  readonly targetedMatchCandidateLimit: number;
  readonly abandonedGameExpiryMs: number;
  readonly defaultStartingRating: number;
  readonly defaultGuestRating: number;
  readonly defaultGuestName: string;
  readonly defaultGuestHostName: string;
  readonly passAndPlayBlueName: string;
  readonly passAndPlayGreenName: string;
  readonly botBaseElo: number;
  readonly botEloStepPerLevel: number;
  readonly defaultCleanupIntervalMs: number;
  readonly maxCleanupBatchSize: number;
  readonly clockTickIntervalMs: number;
}

export interface MultiplayerScaleConfig {
  readonly presence: PresenceConfig;
  readonly matchmaking: MatchmakingConfig;
}

export class MultiplayerConfigError extends Error {
  constructor(message: string) {
    super(`MultiplayerConfigError: ${message}`);
    this.name = 'MultiplayerConfigError';
  }
}

export function validateMultiplayerScaleConfig(config: MultiplayerScaleConfig): void {
  if (!config) {
    throw new MultiplayerConfigError('Configuration object is missing or null.');
  }

  const { presence, matchmaking } = config;

  if (!presence) {
    throw new MultiplayerConfigError('Presence configuration section is missing.');
  }

  if (typeof presence.idleTimeoutMs !== 'number' || presence.idleTimeoutMs <= 0) {
    throw new MultiplayerConfigError(
      `Invalid presence.idleTimeoutMs: expected positive number, received ${presence.idleTimeoutMs}.`
    );
  }

  if (typeof presence.hiddenGracePeriodMs !== 'number' || presence.hiddenGracePeriodMs <= 0) {
    throw new MultiplayerConfigError(
      `Invalid presence.hiddenGracePeriodMs: expected positive number, received ${presence.hiddenGracePeriodMs}.`
    );
  }

  if (typeof presence.heartbeatIntervalMs !== 'number' || presence.heartbeatIntervalMs <= 0) {
    throw new MultiplayerConfigError(
      `Invalid presence.heartbeatIntervalMs: expected positive number, received ${presence.heartbeatIntervalMs}.`
    );
  }

  if (typeof presence.sessionTtlMs !== 'number' || presence.sessionTtlMs <= presence.heartbeatIntervalMs) {
    throw new MultiplayerConfigError(
      `Invalid presence.sessionTtlMs: session TTL (${presence.sessionTtlMs}ms) must strictly exceed heartbeatIntervalMs (${presence.heartbeatIntervalMs}ms).`
    );
  }

  if (typeof presence.activityThrottleMs !== 'number' || presence.activityThrottleMs <= 0) {
    throw new MultiplayerConfigError(
      `Invalid presence.activityThrottleMs: expected positive number, received ${presence.activityThrottleMs}.`
    );
  }

  if (typeof presence.statsPollIntervalMs !== 'number' || presence.statsPollIntervalMs <= 0) {
    throw new MultiplayerConfigError(
      `Invalid presence.statsPollIntervalMs: expected positive number, received ${presence.statsPollIntervalMs}.`
    );
  }

  if (typeof presence.statsPollJitterMs !== 'number' || presence.statsPollJitterMs < 0) {
    throw new MultiplayerConfigError(
      `Invalid presence.statsPollJitterMs: expected non-negative number, received ${presence.statsPollJitterMs}.`
    );
  }

  if (typeof presence.statsInitialFallbackDelayMs !== 'number' || presence.statsInitialFallbackDelayMs < 0) {
    throw new MultiplayerConfigError(
      `Invalid presence.statsInitialFallbackDelayMs: expected non-negative number, received ${presence.statsInitialFallbackDelayMs}.`
    );
  }

  if (!matchmaking) {
    throw new MultiplayerConfigError('Matchmaking configuration section is missing.');
  }

  if (
    typeof matchmaking.maxOpenRoomsLobbyLimit !== 'number' ||
    matchmaking.maxOpenRoomsLobbyLimit <= 0 ||
    matchmaking.maxOpenRoomsLobbyLimit > 500
  ) {
    throw new MultiplayerConfigError(
      `Invalid matchmaking.maxOpenRoomsLobbyLimit: expected number between 1 and 500, received ${matchmaking.maxOpenRoomsLobbyLimit}.`
    );
  }

  if (
    typeof matchmaking.targetedMatchCandidateLimit !== 'number' ||
    matchmaking.targetedMatchCandidateLimit <= 0 ||
    matchmaking.targetedMatchCandidateLimit > 50
  ) {
    throw new MultiplayerConfigError(
      `Invalid matchmaking.targetedMatchCandidateLimit: expected number between 1 and 50, received ${matchmaking.targetedMatchCandidateLimit}.`
    );
  }

  if (typeof matchmaking.abandonedGameExpiryMs !== 'number' || matchmaking.abandonedGameExpiryMs <= 0) {
    throw new MultiplayerConfigError(
      `Invalid matchmaking.abandonedGameExpiryMs: expected positive number, received ${matchmaking.abandonedGameExpiryMs}.`
    );
  }

  if (typeof matchmaking.defaultStartingRating !== 'number' || matchmaking.defaultStartingRating <= 0) {
    throw new MultiplayerConfigError(
      `Invalid matchmaking.defaultStartingRating: expected positive rating, received ${matchmaking.defaultStartingRating}.`
    );
  }

  if (typeof matchmaking.defaultGuestRating !== 'number' || matchmaking.defaultGuestRating <= 0) {
    throw new MultiplayerConfigError(
      `Invalid matchmaking.defaultGuestRating: expected positive rating, received ${matchmaking.defaultGuestRating}.`
    );
  }

  if (typeof matchmaking.defaultGuestName !== 'string' || matchmaking.defaultGuestName.trim().length === 0) {
    throw new MultiplayerConfigError(
      `Invalid matchmaking.defaultGuestName: expected non-empty string, received "${matchmaking.defaultGuestName}".`
    );
  }

  if (typeof matchmaking.defaultGuestHostName !== 'string' || matchmaking.defaultGuestHostName.trim().length === 0) {
    throw new MultiplayerConfigError(
      `Invalid matchmaking.defaultGuestHostName: expected non-empty string, received "${matchmaking.defaultGuestHostName}".`
    );
  }

  if (typeof matchmaking.passAndPlayBlueName !== 'string' || matchmaking.passAndPlayBlueName.trim().length === 0) {
    throw new MultiplayerConfigError(
      `Invalid matchmaking.passAndPlayBlueName: expected non-empty string, received "${matchmaking.passAndPlayBlueName}".`
    );
  }

  if (typeof matchmaking.passAndPlayGreenName !== 'string' || matchmaking.passAndPlayGreenName.trim().length === 0) {
    throw new MultiplayerConfigError(
      `Invalid matchmaking.passAndPlayGreenName: expected non-empty string, received "${matchmaking.passAndPlayGreenName}".`
    );
  }

  if (typeof matchmaking.botBaseElo !== 'number' || matchmaking.botBaseElo <= 0) {
    throw new MultiplayerConfigError(
      `Invalid matchmaking.botBaseElo: expected positive number, received ${matchmaking.botBaseElo}.`
    );
  }

  if (typeof matchmaking.botEloStepPerLevel !== 'number' || matchmaking.botEloStepPerLevel <= 0) {
    throw new MultiplayerConfigError(
      `Invalid matchmaking.botEloStepPerLevel: expected positive number, received ${matchmaking.botEloStepPerLevel}.`
    );
  }

  if (typeof matchmaking.defaultCleanupIntervalMs !== 'number' || matchmaking.defaultCleanupIntervalMs <= 0) {
    throw new MultiplayerConfigError(
      `Invalid matchmaking.defaultCleanupIntervalMs: expected positive number, received ${matchmaking.defaultCleanupIntervalMs}.`
    );
  }

  if (
    typeof matchmaking.maxCleanupBatchSize !== 'number' ||
    matchmaking.maxCleanupBatchSize <= 0 ||
    matchmaking.maxCleanupBatchSize > 500
  ) {
    throw new MultiplayerConfigError(
      `Invalid matchmaking.maxCleanupBatchSize: expected number between 1 and 500, received ${matchmaking.maxCleanupBatchSize}.`
    );
  }

  if (
    typeof matchmaking.clockTickIntervalMs !== 'number' ||
    matchmaking.clockTickIntervalMs < 10 ||
    matchmaking.clockTickIntervalMs > 5000
  ) {
    throw new MultiplayerConfigError(
      `Invalid matchmaking.clockTickIntervalMs: expected number between 10 and 5000, received ${matchmaking.clockTickIntervalMs}.`
    );
  }
}

export const MULTIPLAYER_SCALE_CONFIG: MultiplayerScaleConfig = Object.freeze({
  presence: Object.freeze({
    idleTimeoutMs: 120_000,
    hiddenGracePeriodMs: 60_000,
    sessionTtlMs: 60_000,
    heartbeatIntervalMs: 30_000,
    activityThrottleMs: 1_000,
    statsPollIntervalMs: 12_000,
    statsPollJitterMs: 3_000,
    statsInitialFallbackDelayMs: 0,
  }),
  matchmaking: Object.freeze({
    maxOpenRoomsLobbyLimit: 50,
    targetedMatchCandidateLimit: 5,
    abandonedGameExpiryMs: 10 * 60 * 1000, // 10 minutes
    defaultStartingRating: 1200,
    defaultGuestRating: 1200,
    defaultGuestName: 'Guest',
    defaultGuestHostName: 'Guest Host',
    passAndPlayBlueName: 'Player 1 (Blue)',
    passAndPlayGreenName: 'Player 2 (Green)',
    botBaseElo: 1000,
    botEloStepPerLevel: 80,
    defaultCleanupIntervalMs: 60_000,
    maxCleanupBatchSize: 50,
    clockTickIntervalMs: 100,
  }),
});

// Immediately validate the canonical scale configuration upon initialization
validateMultiplayerScaleConfig(MULTIPLAYER_SCALE_CONFIG);
