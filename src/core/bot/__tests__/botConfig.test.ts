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

  it('throws BotConfigError if defaultLevel is not an integer between 1 and 8', () => {
    const invalidZero = { ...BOT_ENGINE_CONFIG, defaultLevel: 0 };
    expect(() => validateBotConfig(invalidZero)).toThrow(BotConfigError);
    expect(() => validateBotConfig(invalidZero)).toThrow(/defaultLevel must be an integer between 1 and 8/);

    const invalidNine = { ...BOT_ENGINE_CONFIG, defaultLevel: 9 };
    expect(() => validateBotConfig(invalidNine)).toThrow(BotConfigError);

    const invalidFloat = { ...BOT_ENGINE_CONFIG, defaultLevel: 1.5 };
    expect(() => validateBotConfig(invalidFloat)).toThrow(BotConfigError);

    const invalidType = { ...BOT_ENGINE_CONFIG, defaultLevel: '1' as any };
    expect(() => validateBotConfig(invalidType)).toThrow(BotConfigError);
  });

  it('throws BotConfigError if search ordering bonuses or multipliers are non-positive', () => {
    const invalidPvBonus: BotEngineConfig = {
      ...BOT_ENGINE_CONFIG,
      searchParameters: {
        ...BOT_ENGINE_CONFIG.searchParameters,
        pvMoveBonus: 0,
      },
    };
    expect(() => validateBotConfig(invalidPvBonus)).toThrow(BotConfigError);
    expect(() => validateBotConfig(invalidPvBonus)).toThrow(/Search move ordering and heuristic bonuses must be strictly positive/);

    const invalidMvvLva: BotEngineConfig = {
      ...BOT_ENGINE_CONFIG,
      searchParameters: {
        ...BOT_ENGINE_CONFIG.searchParameters,
        mvvLvaVictimMultiplier: -1,
      },
    };
    expect(() => validateBotConfig(invalidMvvLva)).toThrow(BotConfigError);
  });

  it('throws BotConfigError if blunderPoolMaxCandidates is less than 2', () => {
    const invalidBlunderPool: BotEngineConfig = {
      ...BOT_ENGINE_CONFIG,
      searchParameters: {
        ...BOT_ENGINE_CONFIG.searchParameters,
        blunderPoolMaxCandidates: 1,
      },
    };
    expect(() => validateBotConfig(invalidBlunderPool)).toThrow(BotConfigError);
    expect(() => validateBotConfig(invalidBlunderPool)).toThrow(/blunderPoolMaxCandidates must be at least 2/);
  });

  it('throws BotConfigError if defaultIncrementMs is negative or defaultMatchMinutes is non-positive', () => {
    const invalidIncrement: BotEngineConfig = {
      ...BOT_ENGINE_CONFIG,
      timeManagement: {
        ...BOT_ENGINE_CONFIG.timeManagement,
        defaultIncrementMs: -1,
      },
    };
    expect(() => validateBotConfig(invalidIncrement)).toThrow(BotConfigError);
    expect(() => validateBotConfig(invalidIncrement)).toThrow(/defaultIncrementMs must be non-negative/);

    const invalidMinutes: BotEngineConfig = {
      ...BOT_ENGINE_CONFIG,
      timeManagement: {
        ...BOT_ENGINE_CONFIG.timeManagement,
        defaultMatchMinutes: 0,
      },
    };
    expect(() => validateBotConfig(invalidMinutes)).toThrow(BotConfigError);
    expect(() => validateBotConfig(invalidMinutes)).toThrow(/defaultMatchMinutes must be strictly positive/);
  });

  it('throws BotConfigError if opening book configuration is invalid', () => {
    const missingBook = { ...BOT_ENGINE_CONFIG, openingBook: undefined as any };
    expect(() => validateBotConfig(missingBook)).toThrow(BotConfigError);

    const invalidPlies: BotEngineConfig = {
      ...BOT_ENGINE_CONFIG,
      openingBook: { ...BOT_ENGINE_CONFIG.openingBook, maxPlies: 0 },
    };
    expect(() => validateBotConfig(invalidPlies)).toThrow(BotConfigError);

    const invalidProb: BotEngineConfig = {
      ...BOT_ENGINE_CONFIG,
      openingBook: { ...BOT_ENGINE_CONFIG.openingBook, tier2BookProbability: 1.5 },
    };
    expect(() => validateBotConfig(invalidProb)).toThrow(BotConfigError);

    const invalidMinTier: BotEngineConfig = {
      ...BOT_ENGINE_CONFIG,
      openingBook: { ...BOT_ENGINE_CONFIG.openingBook, minTier: 0 },
    };
    expect(() => validateBotConfig(invalidMinTier)).toThrow(BotConfigError);

    const invalidDelay: BotEngineConfig = {
      ...BOT_ENGINE_CONFIG,
      openingBook: { ...BOT_ENGINE_CONFIG.openingBook, bookThinkingDelayMs: -10 },
    };
    expect(() => validateBotConfig(invalidDelay)).toThrow(BotConfigError);

    const invalidDeviateLevel: BotEngineConfig = {
      ...BOT_ENGINE_CONFIG,
      openingBook: { ...BOT_ENGINE_CONFIG.openingBook, tier2DeviateLevel: 9 },
    };
    expect(() => validateBotConfig(invalidDeviateLevel)).toThrow(BotConfigError);
    expect(() => validateBotConfig(invalidDeviateLevel)).toThrow(/openingBook.tier2DeviateLevel must be an integer between 1 and 8/);
  });

  it('throws BotConfigError if zobristSeed, tier thresholds, or pacing margin are invalid', () => {
    const invalidZobrist: BotEngineConfig = {
      ...BOT_ENGINE_CONFIG,
      searchParameters: {
        ...BOT_ENGINE_CONFIG.searchParameters,
        zobristSeed: NaN,
      },
    };
    expect(() => validateBotConfig(invalidZobrist)).toThrow(BotConfigError);
    expect(() => validateBotConfig(invalidZobrist)).toThrow(/zobristSeed must be a valid number/);

    const invalidTierThreshold: BotEngineConfig = {
      ...BOT_ENGINE_CONFIG,
      searchParameters: {
        ...BOT_ENGINE_CONFIG.searchParameters,
        distanceHeuristicsMinTier: 0,
      },
    };
    expect(() => validateBotConfig(invalidTierThreshold)).toThrow(BotConfigError);
    expect(() => validateBotConfig(invalidTierThreshold)).toThrow(/Search tier thresholds must be integers between 1 and 8/);

    const invalidFloatThreshold: BotEngineConfig = {
      ...BOT_ENGINE_CONFIG,
      searchParameters: {
        ...BOT_ENGINE_CONFIG.searchParameters,
        distanceHeuristicsMinTier: 2.5,
      },
    };
    expect(() => validateBotConfig(invalidFloatThreshold)).toThrow(BotConfigError);
    expect(() => validateBotConfig(invalidFloatThreshold)).toThrow(/Search tier thresholds must be integers between 1 and 8/);

    const invalidFloatDeviate: BotEngineConfig = {
      ...BOT_ENGINE_CONFIG,
      openingBook: {
        ...BOT_ENGINE_CONFIG.openingBook,
        tier2DeviateLevel: 2.5,
      },
    };
    expect(() => validateBotConfig(invalidFloatDeviate)).toThrow(BotConfigError);
    expect(() => validateBotConfig(invalidFloatDeviate)).toThrow(/openingBook.tier2DeviateLevel must be an integer between 1 and 8/);
  });
});

