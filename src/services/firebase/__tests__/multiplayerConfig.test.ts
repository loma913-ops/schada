import { describe, it, expect } from 'vitest';
import {
  MULTIPLAYER_SCALE_CONFIG,
  validateMultiplayerScaleConfig,
  MultiplayerConfigError,
  type MultiplayerScaleConfig,
} from '../multiplayerConfig';

describe('MultiplayerScaleConfig validation', () => {
  it('canonical MULTIPLAYER_SCALE_CONFIG passes validation', () => {
    expect(() => validateMultiplayerScaleConfig(MULTIPLAYER_SCALE_CONFIG)).not.toThrow();
  });

  it('throws MultiplayerConfigError if config object is missing or null', () => {
    expect(() => validateMultiplayerScaleConfig(null as any)).toThrowError(MultiplayerConfigError);
    expect(() => validateMultiplayerScaleConfig(null as any)).toThrowError(
      'MultiplayerConfigError: Configuration object is missing or null.'
    );
  });

  it('throws if presence section is missing', () => {
    const invalidConfig = { ...MULTIPLAYER_SCALE_CONFIG, presence: null as any };
    expect(() => validateMultiplayerScaleConfig(invalidConfig)).toThrowError(
      'MultiplayerConfigError: Presence configuration section is missing.'
    );
  });

  it('throws if session TTL does not exceed heartbeat interval', () => {
    const invalidConfig: MultiplayerScaleConfig = {
      ...MULTIPLAYER_SCALE_CONFIG,
      presence: {
        ...MULTIPLAYER_SCALE_CONFIG.presence,
        sessionTtlMs: 20_000,
        heartbeatIntervalMs: 30_000,
      },
    };
    expect(() => validateMultiplayerScaleConfig(invalidConfig)).toThrowError(
      /session TTL .* must strictly exceed heartbeatIntervalMs/
    );
  });

  it('throws if matchmaking maxOpenRoomsLobbyLimit is non-positive or too large', () => {
    const zeroLimit: MultiplayerScaleConfig = {
      ...MULTIPLAYER_SCALE_CONFIG,
      matchmaking: {
        ...MULTIPLAYER_SCALE_CONFIG.matchmaking,
        maxOpenRoomsLobbyLimit: 0,
      },
    };
    expect(() => validateMultiplayerScaleConfig(zeroLimit)).toThrowError(
      /Invalid matchmaking.maxOpenRoomsLobbyLimit/
    );

    const excessiveLimit: MultiplayerScaleConfig = {
      ...MULTIPLAYER_SCALE_CONFIG,
      matchmaking: {
        ...MULTIPLAYER_SCALE_CONFIG.matchmaking,
        maxOpenRoomsLobbyLimit: 1000,
      },
    };
    expect(() => validateMultiplayerScaleConfig(excessiveLimit)).toThrowError(
      /Invalid matchmaking.maxOpenRoomsLobbyLimit/
    );
  });

  it('throws if guest name is empty string', () => {
    const emptyGuestName: MultiplayerScaleConfig = {
      ...MULTIPLAYER_SCALE_CONFIG,
      matchmaking: {
        ...MULTIPLAYER_SCALE_CONFIG.matchmaking,
        defaultGuestName: '   ',
      },
    };
    expect(() => validateMultiplayerScaleConfig(emptyGuestName)).toThrowError(
      /Invalid matchmaking.defaultGuestName/
    );
  });

  it('throws if defaultGuestHostName is empty string', () => {
    const emptyHostName: MultiplayerScaleConfig = {
      ...MULTIPLAYER_SCALE_CONFIG,
      matchmaking: {
        ...MULTIPLAYER_SCALE_CONFIG.matchmaking,
        defaultGuestHostName: '',
      },
    };
    expect(() => validateMultiplayerScaleConfig(emptyHostName)).toThrowError(
      /Invalid matchmaking.defaultGuestHostName/
    );
  });

  it('throws if defaultStartingRating or bot parameters are non-positive', () => {
    const invalidRating: MultiplayerScaleConfig = {
      ...MULTIPLAYER_SCALE_CONFIG,
      matchmaking: {
        ...MULTIPLAYER_SCALE_CONFIG.matchmaking,
        defaultStartingRating: 0,
      },
    };
    expect(() => validateMultiplayerScaleConfig(invalidRating)).toThrowError(
      /Invalid matchmaking.defaultStartingRating/
    );

    const invalidBotElo: MultiplayerScaleConfig = {
      ...MULTIPLAYER_SCALE_CONFIG,
      matchmaking: {
        ...MULTIPLAYER_SCALE_CONFIG.matchmaking,
        botBaseElo: -100,
      },
    };
    expect(() => validateMultiplayerScaleConfig(invalidBotElo)).toThrowError(
      /Invalid matchmaking.botBaseElo/
    );

    const invalidBatchSize: MultiplayerScaleConfig = {
      ...MULTIPLAYER_SCALE_CONFIG,
      matchmaking: {
        ...MULTIPLAYER_SCALE_CONFIG.matchmaking,
        maxCleanupBatchSize: 0,
      },
    };
    expect(() => validateMultiplayerScaleConfig(invalidBatchSize)).toThrowError(
      /Invalid matchmaking.maxCleanupBatchSize/
    );

    const invalidTickInterval: MultiplayerScaleConfig = {
      ...MULTIPLAYER_SCALE_CONFIG,
      matchmaking: {
        ...MULTIPLAYER_SCALE_CONFIG.matchmaking,
        clockTickIntervalMs: 5,
      },
    };
    expect(() => validateMultiplayerScaleConfig(invalidTickInterval)).toThrowError(
      /Invalid matchmaking.clockTickIntervalMs/
    );

    const invalidFallbackPoll: MultiplayerScaleConfig = {
      ...MULTIPLAYER_SCALE_CONFIG,
      presence: {
        ...MULTIPLAYER_SCALE_CONFIG.presence,
        statsFallbackPollIntervalMs: 0,
      },
    };
    expect(() => validateMultiplayerScaleConfig(invalidFallbackPoll)).toThrowError(
      /Invalid presence.statsFallbackPollIntervalMs/
    );

    const invalidFriendFreshness: MultiplayerScaleConfig = {
      ...MULTIPLAYER_SCALE_CONFIG,
      presence: {
        ...MULTIPLAYER_SCALE_CONFIG.presence,
        friendFreshnessThresholdMs: -10,
      },
    };
    expect(() => validateMultiplayerScaleConfig(invalidFriendFreshness)).toThrowError(
      /Invalid presence.friendFreshnessThresholdMs/
    );

    const invalidFriendBatchSize: MultiplayerScaleConfig = {
      ...MULTIPLAYER_SCALE_CONFIG,
      matchmaking: {
        ...MULTIPLAYER_SCALE_CONFIG.matchmaking,
        friendBatchLookupSize: 50,
      },
    };
    expect(() => validateMultiplayerScaleConfig(invalidFriendBatchSize)).toThrowError(
      /Invalid matchmaking.friendBatchLookupSize/
    );

    const invalidLeaderboardLimit: MultiplayerScaleConfig = {
      ...MULTIPLAYER_SCALE_CONFIG,
      matchmaking: {
        ...MULTIPLAYER_SCALE_CONFIG.matchmaking,
        leaderboardLimit: 0,
      },
    };
    expect(() => validateMultiplayerScaleConfig(invalidLeaderboardLimit)).toThrowError(
      /Invalid matchmaking.leaderboardLimit/
    );

    const invalidLeaderboardCacheTtl: MultiplayerScaleConfig = {
      ...MULTIPLAYER_SCALE_CONFIG,
      matchmaking: {
        ...MULTIPLAYER_SCALE_CONFIG.matchmaking,
        leaderboardCacheTtlMs: -500,
      },
    };
    expect(() => validateMultiplayerScaleConfig(invalidLeaderboardCacheTtl)).toThrowError(
      /Invalid matchmaking.leaderboardCacheTtlMs/
    );

    const invalidBotExcludedPrefixes: MultiplayerScaleConfig = {
      ...MULTIPLAYER_SCALE_CONFIG,
      matchmaking: {
        ...MULTIPLAYER_SCALE_CONFIG.matchmaking,
        botExcludedPrefixes: [] as any,
      },
    };
    expect(() => validateMultiplayerScaleConfig(invalidBotExcludedPrefixes)).toThrowError(
      /Invalid matchmaking.botExcludedPrefixes/
    );

    const invalidMinGames: MultiplayerScaleConfig = {
      ...MULTIPLAYER_SCALE_CONFIG,
      matchmaking: {
        ...MULTIPLAYER_SCALE_CONFIG.matchmaking,
        minGamesPlayedForLeaderboard: -1,
      },
    };
    expect(() => validateMultiplayerScaleConfig(invalidMinGames)).toThrowError(
      /Invalid matchmaking.minGamesPlayedForLeaderboard/
    );

    const missingStorageKeys = {
      ...MULTIPLAYER_SCALE_CONFIG,
      presence: {
        ...MULTIPLAYER_SCALE_CONFIG.presence,
        storageKeys: null as any,
      },
    };
    expect(() => validateMultiplayerScaleConfig(missingStorageKeys as MultiplayerScaleConfig)).toThrowError(
      /Presence storageKeys configuration section is missing or invalid/
    );

    const emptyStorageKey = {
      ...MULTIPLAYER_SCALE_CONFIG,
      presence: {
        ...MULTIPLAYER_SCALE_CONFIG.presence,
        storageKeys: {
          ...MULTIPLAYER_SCALE_CONFIG.presence.storageKeys,
          sessionStorageId: '  ',
        },
      },
    };
    expect(() => validateMultiplayerScaleConfig(emptyStorageKey as MultiplayerScaleConfig)).toThrowError(
      /Invalid presence.storageKeys.sessionStorageId/
    );

    const missingCollections = {
      ...MULTIPLAYER_SCALE_CONFIG,
      collections: null as any,
    };
    expect(() => validateMultiplayerScaleConfig(missingCollections as MultiplayerScaleConfig)).toThrowError(
      /Collections configuration section is missing or invalid/
    );

    const emptyCollection = {
      ...MULTIPLAYER_SCALE_CONFIG,
      collections: {
        ...MULTIPLAYER_SCALE_CONFIG.collections,
        users: '',
      },
    };
    expect(() => validateMultiplayerScaleConfig(emptyCollection as MultiplayerScaleConfig)).toThrowError(
      /Invalid collections.users/
    );

    const emptyUsernamesCollection = {
      ...MULTIPLAYER_SCALE_CONFIG,
      collections: {
        ...MULTIPLAYER_SCALE_CONFIG.collections,
        usernames: '   ',
      },
    };
    expect(() => validateMultiplayerScaleConfig(emptyUsernamesCollection as MultiplayerScaleConfig)).toThrowError(
      /Invalid collections.usernames/
    );

    const emptyTokenPrefix = {
      ...MULTIPLAYER_SCALE_CONFIG,
      presence: {
        ...MULTIPLAYER_SCALE_CONFIG.presence,
        storageKeys: {
          ...MULTIPLAYER_SCALE_CONFIG.presence.storageKeys,
          playerTokenPrefix: '',
        },
      },
    };
    expect(() => validateMultiplayerScaleConfig(emptyTokenPrefix as MultiplayerScaleConfig)).toThrowError(
      /Invalid presence.storageKeys.playerTokenPrefix/
    );

    const emptyGuestIsPatron = {
      ...MULTIPLAYER_SCALE_CONFIG,
      presence: {
        ...MULTIPLAYER_SCALE_CONFIG.presence,
        storageKeys: {
          ...MULTIPLAYER_SCALE_CONFIG.presence.storageKeys,
          guestIsPatron: '   ',
        },
      },
    };
    expect(() => validateMultiplayerScaleConfig(emptyGuestIsPatron as MultiplayerScaleConfig)).toThrowError(
      /Invalid presence.storageKeys.guestIsPatron/
    );

    const missingStorageLimits = {
      ...MULTIPLAYER_SCALE_CONFIG,
      storageLimits: null as any,
    };
    expect(() => validateMultiplayerScaleConfig(missingStorageLimits as MultiplayerScaleConfig)).toThrowError(
      /Storage limits configuration section is missing or invalid/
    );

    const invalidMaxTokens = {
      ...MULTIPLAYER_SCALE_CONFIG,
      storageLimits: {
        ...MULTIPLAYER_SCALE_CONFIG.storageLimits,
        maxPlayerTokens: 0,
      },
    };
    expect(() => validateMultiplayerScaleConfig(invalidMaxTokens as MultiplayerScaleConfig)).toThrowError(
      /Invalid storageLimits.maxPlayerTokens/
    );

    const invalidEmergencyTokens = {
      ...MULTIPLAYER_SCALE_CONFIG,
      storageLimits: {
        ...MULTIPLAYER_SCALE_CONFIG.storageLimits,
        emergencyRetainedTokens: -1,
      },
    };
    expect(() => validateMultiplayerScaleConfig(invalidEmergencyTokens as MultiplayerScaleConfig)).toThrowError(
      /Invalid storageLimits.emergencyRetainedTokens/
    );

    const emptyTestStorageKey = {
      ...MULTIPLAYER_SCALE_CONFIG,
      storageLimits: {
        ...MULTIPLAYER_SCALE_CONFIG.storageLimits,
        testStorageKey: '  ',
      },
    };
    expect(() => validateMultiplayerScaleConfig(emptyTestStorageKey as MultiplayerScaleConfig)).toThrowError(
      /Invalid storageLimits.testStorageKey/
    );

    const invalidClockSync = {
      ...MULTIPLAYER_SCALE_CONFIG,
      matchmaking: {
        ...MULTIPLAYER_SCALE_CONFIG.matchmaking,
        clockSyncJitterThresholdMs: 0,
      },
    };
    expect(() => validateMultiplayerScaleConfig(invalidClockSync as MultiplayerScaleConfig)).toThrowError(
      /Invalid matchmaking.clockSyncJitterThresholdMs/
    );

    const emptyLobbyStatsDocId = {
      ...MULTIPLAYER_SCALE_CONFIG,
      collections: {
        ...MULTIPLAYER_SCALE_CONFIG.collections,
        lobbyStatsDocId: '   ',
      },
    };
    expect(() => validateMultiplayerScaleConfig(emptyLobbyStatsDocId as MultiplayerScaleConfig)).toThrowError(
      /Invalid collections.lobbyStatsDocId/
    );

    const emptyLegacySessions = {
      ...MULTIPLAYER_SCALE_CONFIG,
      storageLimits: {
        ...MULTIPLAYER_SCALE_CONFIG.storageLimits,
        legacyActiveSessions: '',
      },
    };
    expect(() => validateMultiplayerScaleConfig(emptyLegacySessions as MultiplayerScaleConfig)).toThrowError(
      /Invalid storageLimits.legacyActiveSessions/
    );

    const emptyGuestRankedErrorMessage = {
      ...MULTIPLAYER_SCALE_CONFIG,
      matchmaking: {
        ...MULTIPLAYER_SCALE_CONFIG.matchmaking,
        guestRankedErrorMessage: '   ',
      },
    };
    expect(() => validateMultiplayerScaleConfig(emptyGuestRankedErrorMessage as MultiplayerScaleConfig)).toThrowError(
      /Invalid matchmaking.guestRankedErrorMessage/
    );

    const emptyGuestRankedNoticeTitle = {
      ...MULTIPLAYER_SCALE_CONFIG,
      matchmaking: {
        ...MULTIPLAYER_SCALE_CONFIG.matchmaking,
        guestRankedNoticeTitle: '',
      },
    };
    expect(() => validateMultiplayerScaleConfig(emptyGuestRankedNoticeTitle as MultiplayerScaleConfig)).toThrowError(
      /Invalid matchmaking.guestRankedNoticeTitle/
    );

    const emptyGuestRankedNoticeMessage = {
      ...MULTIPLAYER_SCALE_CONFIG,
      matchmaking: {
        ...MULTIPLAYER_SCALE_CONFIG.matchmaking,
        guestRankedNoticeMessage: '   ',
      },
    };
    expect(() => validateMultiplayerScaleConfig(emptyGuestRankedNoticeMessage as MultiplayerScaleConfig)).toThrowError(
      /Invalid matchmaking.guestRankedNoticeMessage/
    );

    const emptyGuestRankedBadgeText = {
      ...MULTIPLAYER_SCALE_CONFIG,
      matchmaking: {
        ...MULTIPLAYER_SCALE_CONFIG.matchmaking,
        guestRankedBadgeText: '',
      },
    };
    expect(() => validateMultiplayerScaleConfig(emptyGuestRankedBadgeText as MultiplayerScaleConfig)).toThrowError(
      /Invalid matchmaking.guestRankedBadgeText/
    );

    const emptyGuestRankedTooltipText = {
      ...MULTIPLAYER_SCALE_CONFIG,
      matchmaking: {
        ...MULTIPLAYER_SCALE_CONFIG.matchmaking,
        guestRankedTooltipText: '   ',
      },
    };
    expect(() => validateMultiplayerScaleConfig(emptyGuestRankedTooltipText as MultiplayerScaleConfig)).toThrowError(
      /Invalid matchmaking.guestRankedTooltipText/
    );

    const invalidDisconnectGrace = {
      ...MULTIPLAYER_SCALE_CONFIG,
      matchmaking: {
        ...MULTIPLAYER_SCALE_CONFIG.matchmaking,
        disconnectGracePeriodMs: -1,
      },
    };
    expect(() => validateMultiplayerScaleConfig(invalidDisconnectGrace as MultiplayerScaleConfig)).toThrowError(
      /Invalid matchmaking.disconnectGracePeriodMs/
    );

    const emptyDisconnectionBadge = {
      ...MULTIPLAYER_SCALE_CONFIG,
      matchmaking: {
        ...MULTIPLAYER_SCALE_CONFIG.matchmaking,
        disconnectionBadgeText: '   ',
      },
    };
    expect(() => validateMultiplayerScaleConfig(emptyDisconnectionBadge as MultiplayerScaleConfig)).toThrowError(
      /Invalid matchmaking.disconnectionBadgeText/
    );

    const emptyDisconnectionCountdown = {
      ...MULTIPLAYER_SCALE_CONFIG,
      matchmaking: {
        ...MULTIPLAYER_SCALE_CONFIG.matchmaking,
        disconnectionCountdownPrefix: '',
      },
    };
    expect(() => validateMultiplayerScaleConfig(emptyDisconnectionCountdown as MultiplayerScaleConfig)).toThrowError(
      /Invalid matchmaking.disconnectionCountdownPrefix/
    );

    const emptyDisconnectionTooltip = {
      ...MULTIPLAYER_SCALE_CONFIG,
      matchmaking: {
        ...MULTIPLAYER_SCALE_CONFIG.matchmaking,
        disconnectionTooltipText: '',
      },
    };
    expect(() => validateMultiplayerScaleConfig(emptyDisconnectionTooltip as MultiplayerScaleConfig)).toThrowError(
      /Invalid matchmaking.disconnectionTooltipText/
    );

    const emptyDisconnectionTooltipCountdown = {
      ...MULTIPLAYER_SCALE_CONFIG,
      matchmaking: {
        ...MULTIPLAYER_SCALE_CONFIG.matchmaking,
        disconnectionTooltipCountdownPrefix: '  ',
      },
    };
    expect(() =>
      validateMultiplayerScaleConfig(emptyDisconnectionTooltipCountdown as MultiplayerScaleConfig)
    ).toThrowError(/Invalid matchmaking.disconnectionTooltipCountdownPrefix/);

    const emptyChallengeReservedErrorMessage = {
      ...MULTIPLAYER_SCALE_CONFIG,
      matchmaking: {
        ...MULTIPLAYER_SCALE_CONFIG.matchmaking,
        challengeReservedErrorMessage: '   ',
      },
    };
    expect(() =>
      validateMultiplayerScaleConfig(emptyChallengeReservedErrorMessage as MultiplayerScaleConfig)
    ).toThrowError(/Invalid matchmaking.challengeReservedErrorMessage/);

    const emptyReconcilePrefix = {
      ...MULTIPLAYER_SCALE_CONFIG,
      presence: {
        ...MULTIPLAYER_SCALE_CONFIG.presence,
        storageKeys: {
          ...MULTIPLAYER_SCALE_CONFIG.presence.storageKeys,
          reconcileLastRunPrefix: '  ',
        },
      },
    };
    expect(() => validateMultiplayerScaleConfig(emptyReconcilePrefix as MultiplayerScaleConfig)).toThrowError(
      /Invalid presence.storageKeys.reconcileLastRunPrefix/
    );

    const invalidReconcileCooldown = {
      ...MULTIPLAYER_SCALE_CONFIG,
      matchmaking: {
        ...MULTIPLAYER_SCALE_CONFIG.matchmaking,
        reconcileCooldownMs: 0,
      },
    };
    expect(() => validateMultiplayerScaleConfig(invalidReconcileCooldown as MultiplayerScaleConfig)).toThrowError(
      /Invalid matchmaking.reconcileCooldownMs/
    );

    const invertedFriendCache = {
      ...MULTIPLAYER_SCALE_CONFIG,
      presence: {
        ...MULTIPLAYER_SCALE_CONFIG.presence,
        friendsPollIntervalMs: 20_000,
        friendsCacheTtlMs: 25_000,
      },
    };
    expect(() => validateMultiplayerScaleConfig(invertedFriendCache as MultiplayerScaleConfig)).toThrowError(
      /friendsCacheTtlMs .* must be strictly less than friendsPollIntervalMs/
    );

    const excessiveFriendPoll = {
      ...MULTIPLAYER_SCALE_CONFIG,
      presence: {
        ...MULTIPLAYER_SCALE_CONFIG.presence,
        friendFreshnessThresholdMs: 40_000,
        friendsPollIntervalMs: 50_000,
        friendsCacheTtlMs: 30_000,
      },
    };
    expect(() => validateMultiplayerScaleConfig(excessiveFriendPoll as MultiplayerScaleConfig)).toThrowError(
      /friendsPollIntervalMs .* cannot exceed friendFreshnessThresholdMs/
    );
  });
});
