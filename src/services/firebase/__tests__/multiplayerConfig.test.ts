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
  });
});
