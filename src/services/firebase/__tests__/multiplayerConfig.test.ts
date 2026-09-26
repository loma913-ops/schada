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
  });
});
