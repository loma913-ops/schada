/**
 * Multiplayer and Presence Scaling Configuration.
 *
 * Centralizes all timing, limits, and scaling parameters for
 * presence heartbeats, lobby stats aggregation, and matchmaking queries.
 * Validates configuration to eliminate hard-coded fallback values.
 */

export interface PresenceStorageKeys {
  readonly sessionStorageId: string;
  readonly activeSessions: string;
  readonly authCachedUid: string;
  readonly authCachedProfile: string;
  readonly cachedLobbyStats: string;
  readonly localGames: string;
  readonly guestId: string;
  readonly guestName: string;
  readonly guestConfirmed: string;
  readonly guestIsPatron: string;
  readonly playerTokenPrefix: string;
}

export interface PresenceConfig {
  readonly idleTimeoutMs: number;
  readonly hiddenGracePeriodMs: number;
  readonly sessionTtlMs: number;
  readonly heartbeatIntervalMs: number;
  readonly activityThrottleMs: number;
  readonly statsPollIntervalMs: number;
  readonly statsPollJitterMs: number;
  readonly statsInitialFallbackDelayMs: number;
  readonly statsFallbackPollIntervalMs: number;
  readonly friendFreshnessThresholdMs: number;
  readonly staleGuestPruneIntervalMs: number;
  readonly staleGuestCutoffMs: number;
  readonly storageKeys: PresenceStorageKeys;
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
  readonly liveRoomsPollIntervalMs: number;
  readonly friendBatchLookupSize: number;
  readonly leaderboardLimit: number;
  readonly leaderboardCacheTtlMs: number;
  readonly clockSyncJitterThresholdMs: number;
}

export interface MultiplayerCollectionsConfig {
  readonly users: string;
  readonly usernames: string;
  readonly games: string;
  readonly guestSessions: string;
  readonly lobbyStats: string;
  readonly lobbyStatsDocId: string;
  readonly friendRequests: string;
  readonly userFriends: string;
}

export interface StorageLimitsConfig {
  readonly maxLocalGames: number;
  readonly maxPlayerTokens: number;
  readonly maxSessionAgeMs: number;
  readonly emergencyRetainedTokens: number;
  readonly testStorageKey: string;
  readonly firestoreKeyPrefix: string;
  readonly legacyActiveSessions: string;
}

export interface MultiplayerScaleConfig {
  readonly presence: PresenceConfig;
  readonly matchmaking: MatchmakingConfig;
  readonly collections: MultiplayerCollectionsConfig;
  readonly storageLimits: StorageLimitsConfig;
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

  if (typeof presence.statsFallbackPollIntervalMs !== 'number' || presence.statsFallbackPollIntervalMs <= 0) {
    throw new MultiplayerConfigError(
      `Invalid presence.statsFallbackPollIntervalMs: expected positive number, received ${presence.statsFallbackPollIntervalMs}.`
    );
  }

  if (typeof presence.friendFreshnessThresholdMs !== 'number' || presence.friendFreshnessThresholdMs <= 0) {
    throw new MultiplayerConfigError(
      `Invalid presence.friendFreshnessThresholdMs: expected positive number, received ${presence.friendFreshnessThresholdMs}.`
    );
  }

  if (typeof presence.staleGuestPruneIntervalMs !== 'number' || presence.staleGuestPruneIntervalMs <= 0) {
    throw new MultiplayerConfigError(
      `Invalid presence.staleGuestPruneIntervalMs: expected positive number, received ${presence.staleGuestPruneIntervalMs}.`
    );
  }

  if (typeof presence.staleGuestCutoffMs !== 'number' || presence.staleGuestCutoffMs <= 0) {
    throw new MultiplayerConfigError(
      `Invalid presence.staleGuestCutoffMs: expected positive number, received ${presence.staleGuestCutoffMs}.`
    );
  }

  if (!presence.storageKeys || typeof presence.storageKeys !== 'object') {
    throw new MultiplayerConfigError('Presence storageKeys configuration section is missing or invalid.');
  }

  const {
    sessionStorageId,
    activeSessions,
    authCachedUid,
    authCachedProfile,
    cachedLobbyStats,
    localGames,
    guestId,
    guestName,
    guestConfirmed,
    guestIsPatron,
    playerTokenPrefix,
  } = presence.storageKeys;
  const storageKeyEntries = {
    sessionStorageId,
    activeSessions,
    authCachedUid,
    authCachedProfile,
    cachedLobbyStats,
    localGames,
    guestId,
    guestName,
    guestConfirmed,
    guestIsPatron,
    playerTokenPrefix,
  };
  for (const [keyName, val] of Object.entries(storageKeyEntries)) {
    if (typeof val !== 'string' || val.trim().length === 0) {
      throw new MultiplayerConfigError(`Invalid presence.storageKeys.${keyName}: expected non-empty string.`);
    }
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

  if (typeof matchmaking.liveRoomsPollIntervalMs !== 'number' || matchmaking.liveRoomsPollIntervalMs <= 0) {
    throw new MultiplayerConfigError(
      `Invalid matchmaking.liveRoomsPollIntervalMs: expected positive number, received ${matchmaking.liveRoomsPollIntervalMs}.`
    );
  }

  if (
    typeof matchmaking.friendBatchLookupSize !== 'number' ||
    matchmaking.friendBatchLookupSize <= 0 ||
    matchmaking.friendBatchLookupSize > 30
  ) {
    throw new MultiplayerConfigError(
      `Invalid matchmaking.friendBatchLookupSize: expected number between 1 and 30, received ${matchmaking.friendBatchLookupSize}.`
    );
  }

  if (
    typeof matchmaking.leaderboardLimit !== 'number' ||
    matchmaking.leaderboardLimit <= 0 ||
    matchmaking.leaderboardLimit > 500
  ) {
    throw new MultiplayerConfigError(
      `Invalid matchmaking.leaderboardLimit: expected number between 1 and 500, received ${matchmaking.leaderboardLimit}.`
    );
  }

  if (typeof matchmaking.leaderboardCacheTtlMs !== 'number' || matchmaking.leaderboardCacheTtlMs <= 0) {
    throw new MultiplayerConfigError(
      `Invalid matchmaking.leaderboardCacheTtlMs: expected positive number, received ${matchmaking.leaderboardCacheTtlMs}.`
    );
  }

  if (typeof matchmaking.clockSyncJitterThresholdMs !== 'number' || matchmaking.clockSyncJitterThresholdMs <= 0) {
    throw new MultiplayerConfigError(
      `Invalid matchmaking.clockSyncJitterThresholdMs: expected positive number, received ${matchmaking.clockSyncJitterThresholdMs}.`
    );
  }

  const { collections } = config;
  if (!collections || typeof collections !== 'object') {
    throw new MultiplayerConfigError('Collections configuration section is missing or invalid.');
  }

  const { users, usernames, games, guestSessions, lobbyStats, lobbyStatsDocId, friendRequests, userFriends } = collections;
  const collectionEntries = { users, usernames, games, guestSessions, lobbyStats, lobbyStatsDocId, friendRequests, userFriends };
  for (const [colName, val] of Object.entries(collectionEntries)) {
    if (typeof val !== 'string' || val.trim().length === 0) {
      throw new MultiplayerConfigError(`Invalid collections.${colName}: expected non-empty string.`);
    }
  }

  const { storageLimits } = config;
  if (!storageLimits || typeof storageLimits !== 'object') {
    throw new MultiplayerConfigError('Storage limits configuration section is missing or invalid.');
  }

  if (typeof storageLimits.maxLocalGames !== 'number' || storageLimits.maxLocalGames <= 0) {
    throw new MultiplayerConfigError(
      `Invalid storageLimits.maxLocalGames: expected positive number, received ${storageLimits.maxLocalGames}.`
    );
  }

  if (typeof storageLimits.maxPlayerTokens !== 'number' || storageLimits.maxPlayerTokens <= 0) {
    throw new MultiplayerConfigError(
      `Invalid storageLimits.maxPlayerTokens: expected positive number, received ${storageLimits.maxPlayerTokens}.`
    );
  }

  if (typeof storageLimits.maxSessionAgeMs !== 'number' || storageLimits.maxSessionAgeMs <= 0) {
    throw new MultiplayerConfigError(
      `Invalid storageLimits.maxSessionAgeMs: expected positive number, received ${storageLimits.maxSessionAgeMs}.`
    );
  }

  if (typeof storageLimits.emergencyRetainedTokens !== 'number' || storageLimits.emergencyRetainedTokens < 0) {
    throw new MultiplayerConfigError(
      `Invalid storageLimits.emergencyRetainedTokens: expected non-negative number, received ${storageLimits.emergencyRetainedTokens}.`
    );
  }

  if (typeof storageLimits.testStorageKey !== 'string' || storageLimits.testStorageKey.trim().length === 0) {
    throw new MultiplayerConfigError('Invalid storageLimits.testStorageKey: expected non-empty string.');
  }

  if (typeof storageLimits.firestoreKeyPrefix !== 'string' || storageLimits.firestoreKeyPrefix.trim().length === 0) {
    throw new MultiplayerConfigError('Invalid storageLimits.firestoreKeyPrefix: expected non-empty string.');
  }

  if (typeof storageLimits.legacyActiveSessions !== 'string' || storageLimits.legacyActiveSessions.trim().length === 0) {
    throw new MultiplayerConfigError('Invalid storageLimits.legacyActiveSessions: expected non-empty string.');
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
    statsInitialFallbackDelayMs: 2_000,
    statsFallbackPollIntervalMs: 60_000,
    friendFreshnessThresholdMs: 45_000,
    staleGuestPruneIntervalMs: 5 * 60 * 1000,
    staleGuestCutoffMs: 15 * 60 * 1000,
    storageKeys: Object.freeze({
      sessionStorageId: 'schada_client_session_id',
      activeSessions: 'schada_active_sessions_v2',
      authCachedUid: 'schada_auth_cached_uid',
      authCachedProfile: 'schada_auth_cached_profile',
      cachedLobbyStats: 'schada_cached_lobby_stats',
      localGames: 'schada_local_games',
      guestId: 'schada_guest_id',
      guestName: 'schada_guest_name',
      guestConfirmed: 'schada_guest_confirmed',
      guestIsPatron: 'schada_guest_is_patron',
      playerTokenPrefix: 'schada_player_token_',
    }),
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
    liveRoomsPollIntervalMs: 60_000,
    friendBatchLookupSize: 30,
    leaderboardLimit: 50,
    leaderboardCacheTtlMs: 5 * 60 * 1000,
    clockSyncJitterThresholdMs: 1500,
  }),
  collections: Object.freeze({
    users: 'users',
    usernames: 'usernames',
    games: 'games',
    guestSessions: 'guest_sessions',
    lobbyStats: 'stats',
    lobbyStatsDocId: 'lobby',
    friendRequests: 'friendRequests',
    userFriends: 'userFriends',
  }),
  storageLimits: Object.freeze({
    maxLocalGames: 5,
    maxPlayerTokens: 100,
    maxSessionAgeMs: 60 * 1000,
    emergencyRetainedTokens: 5,
    testStorageKey: '__schada_storage_test__',
    firestoreKeyPrefix: 'firestore_',
    legacyActiveSessions: 'schada_active_sessions',
  }),
});

// Immediately validate the canonical scale configuration upon initialization
validateMultiplayerScaleConfig(MULTIPLAYER_SCALE_CONFIG);
