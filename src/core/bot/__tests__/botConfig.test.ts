import { describe, it, expect } from 'vitest';
import {
  BOT_ENGINE_CONFIG,
  BotConfigError,
  validateBotConfig,
  type BotEngineConfig,
} from '../botConfig';
import { getBotTier } from '../botTiers';

describe('Bot Configuration Validator & Error Handling', () => {
  it('validates canonical BOT_ENGINE_CONFIG successfully', () => {
    expect(() => validateBotConfig(BOT_ENGINE_CONFIG)).not.toThrow();
  });

  it('throws BotConfigError if configuration is null or missing', () => {
    expect(() => validateBotConfig(null as any)).toThrow(BotConfigError);
    expect(() => validateBotConfig(undefined as any)).toThrow(BotConfigError);
  });

  it('throws BotConfigError if a required section is missing', () => {
    const invalidConfig = { ...BOT_ENGINE_CONFIG, evaluationWeights: undefined } as any;
    expect(() => validateBotConfig(invalidConfig)).toThrow(BotConfigError);
    expect(() => validateBotConfig(invalidConfig)).toThrow(/evaluationWeights section is missing/);
  });

  it('throws BotConfigError if piece material weights are non-positive', () => {
    const invalidConfig: BotEngineConfig = {
      ...BOT_ENGINE_CONFIG,
      evaluationWeights: {
        ...BOT_ENGINE_CONFIG.evaluationWeights,
        fieldOfficerMaterial: -10,
      },
    };
    expect(() => validateBotConfig(invalidConfig)).toThrow(BotConfigError);
    expect(() => validateBotConfig(invalidConfig)).toThrow(/Piece material weights must be strictly positive/);
  });

  it('throws BotConfigError if goal security does not exceed outside material value', () => {
    const invalidConfig: BotEngineConfig = {
      ...BOT_ENGINE_CONFIG,
      evaluationWeights: {
        ...BOT_ENGINE_CONFIG.evaluationWeights,
        fieldOfficerGoalSecurity: 100, // less than fieldOfficerMaterial (200)
      },
    };
    expect(() => validateBotConfig(invalidConfig)).toThrow(BotConfigError);
    expect(() => validateBotConfig(invalidConfig)).toThrow(/Goal security scores must exceed outside piece material scores/);
  });

  it('throws BotConfigError if transposition table size is not a power of 2', () => {
    const invalidConfig: BotEngineConfig = {
      ...BOT_ENGINE_CONFIG,
      searchParameters: {
        ...BOT_ENGINE_CONFIG.searchParameters,
        transpositionTableSize: 1000, // not power of 2
      },
    };
    expect(() => validateBotConfig(invalidConfig)).toThrow(BotConfigError);
    expect(() => validateBotConfig(invalidConfig)).toThrow(/transpositionTableSize must be a positive power of 2/);
  });

  it('throws BotConfigError if tier Elo ratings are not strictly monotonic', () => {
    const invalidConfig: BotEngineConfig = {
      ...BOT_ENGINE_CONFIG,
      tiers: {
        ...BOT_ENGINE_CONFIG.tiers,
        3: {
          ...BOT_ENGINE_CONFIG.tiers[3],
          elo: 300, // lower than Level 2 (400)
        },
      },
    };
    expect(() => validateBotConfig(invalidConfig)).toThrow(BotConfigError);
    expect(() => validateBotConfig(invalidConfig)).toThrow(/must strictly exceed/);
  });

  it('throws BotConfigError if blunder rate is outside [0, 1]', () => {
    const invalidConfig: BotEngineConfig = {
      ...BOT_ENGINE_CONFIG,
      tiers: {
        ...BOT_ENGINE_CONFIG.tiers,
        1: {
          ...BOT_ENGINE_CONFIG.tiers[1],
          blunderRate: 1.5,
        },
      },
    };
    expect(() => validateBotConfig(invalidConfig)).toThrow(BotConfigError);
    expect(() => validateBotConfig(invalidConfig)).toThrow(/blunderRate.*must be between 0 and 1/);
  });

  it('throws BotConfigError on invalid bot difficulty level inputs in getBotTier', () => {
    expect(() => getBotTier(0)).toThrow(BotConfigError);
    expect(() => getBotTier(-1)).toThrow(BotConfigError);
    expect(() => getBotTier(9)).toThrow(BotConfigError);
    expect(() => getBotTier(NaN)).toThrow(BotConfigError);
    expect(() => getBotTier(2.5)).toThrow(BotConfigError);
  });
});
