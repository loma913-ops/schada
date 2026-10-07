/**
 * Bot Engine and Tier Configuration for Schada AI.
 *
 * Centralizes all search depths, heuristic evaluation weights,
 * Zobrist transposition table dimensions, time budgets, and the 8-tier Elo hierarchy.
 * Validates configuration to eliminate hard-coded fallback values.
 */

export class BotConfigError extends Error {
  constructor(message: string) {
    super(`BotConfigError: ${message}`);
    this.name = 'BotConfigError';
  }
}

export interface EvaluationWeightsConfig {
  readonly fieldOfficerMaterial: number;
  readonly officerMaterial: number;
  readonly pawnMaterial: number;
  readonly fieldOfficerGoalSecurity: number;
  readonly officerGoalSecurity: number;
  readonly fieldOfficerDistanceWeight: number;
  readonly officerDistanceWeight: number;
  readonly trappedDistancePenalty: number;
  readonly centralityMultiplier: number;
  readonly outDegreeMultiplier: number;
  readonly turretSentinelBonus: number;
  readonly pacingTrailingPenalty: number;
  readonly pacingLeadingBonus: number;
  readonly fractionalTiebreakMultiplier: number;
  readonly terminalWinScore: number;
  readonly terminalLossScore: number;
}

export interface SearchParametersConfig {
  readonly transpositionTableSize: number;
  readonly maxSearchPly: number;
  readonly quiescenceMaxPly: number;
  readonly quiescenceDefaultDepth: number;
  readonly nullMoveReduction: number;
  readonly nullMoveMinDepth: number;
  readonly openingVariancePlies: number;
  readonly openingVarianceScoreWindow: number;
  readonly pvMoveBonus: number;
  readonly captureBaseBonus: number;
  readonly goalEntryBonus: number;
  readonly primaryKillerBonus: number;
  readonly secondaryKillerBonus: number;
  readonly maxHistoryBonus: number;
  readonly distanceGainMultiplier: number;
  readonly terminalNearWinCutoff: number;
  readonly timeoutCheckIntervalMask: number;
  readonly mvvLvaVictimMultiplier: number;
  readonly blunderPoolMaxCandidates: number;
  readonly zobristSeed: number;
  readonly distanceHeuristicsMinTier: number;
  readonly pacingLeadingMarginThreshold: number;
  readonly fractionalTiebreakMinTier: number;
  readonly blunderProneMinTier: number;
}

export interface TimeManagementConfig {
  readonly clockDivisor: number;
  readonly minThinkingTimeMs: number;
  readonly workerSafetyTimeoutMs: number;
  readonly baseThinkingDelayMs: number;
  readonly thinkingDelayStepPerLevelMs: number;
  readonly randomDelayJitterMaxMs: number;
  readonly defaultIncrementMs: number;
  readonly defaultMatchMinutes: number;
}

export interface OpeningBookConfig {
  readonly enabled: boolean;
  readonly maxPlies: number;
  readonly tier2BookProbability: number;
  readonly minTier: number;
  readonly tier2DeviateLevel: number;
  readonly bookThinkingDelayMs: number;
}


export interface BotTierConfig {
  readonly level: number;
  readonly name: string;
  readonly elo: number;
  readonly maxDepth: number;
  readonly description: string;
  readonly blunderRate: number;
  readonly useMoveOrdering: boolean;
  readonly useIterativeDeepening: boolean;
  readonly usePacingAwareness: boolean;
  readonly useTranspositionTable: boolean;
  readonly useQuiescence: boolean;
  readonly useNullMovePruning: boolean;
  readonly useCentralityHeuristics: boolean;
  readonly usePawnScreening: boolean;
  readonly useSpringboards: boolean;
  readonly timeLimitMs: number;
}

export interface BotEngineConfig {
  readonly defaultLevel: number;
  readonly evaluationWeights: EvaluationWeightsConfig;
  readonly searchParameters: SearchParametersConfig;
  readonly timeManagement: TimeManagementConfig;
  readonly openingBook: OpeningBookConfig;
  readonly tiers: Readonly<Record<number, BotTierConfig>>;
}

/**
 * Validates the bot engine and tier configuration.
 * Throws BotConfigError if the config object is missing, null, or contains invalid parameters.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time, verifying static numeric boundaries.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant independent of system load.
 */
export function validateBotConfig(config: BotEngineConfig): void {
  if (!config) {
    throw new BotConfigError('Configuration object is missing or null.');
  }

  const { evaluationWeights, searchParameters, timeManagement, tiers } = config;

  if (typeof config.defaultLevel !== 'number' || !Number.isInteger(config.defaultLevel) || config.defaultLevel < 1 || config.defaultLevel > 8) {
    throw new BotConfigError(`defaultLevel must be an integer between 1 and 8, received ${String(config.defaultLevel)}.`);
  }

  if (!evaluationWeights) {
    throw new BotConfigError('evaluationWeights section is missing.');
  }
  if (!searchParameters) {
    throw new BotConfigError('searchParameters section is missing.');
  }
  if (!timeManagement) {
    throw new BotConfigError('timeManagement section is missing.');
  }
  if (!tiers) {
    throw new BotConfigError('tiers section is missing.');
  }

  // Validate Evaluation Weights
  if (
    evaluationWeights.fieldOfficerMaterial <= 0 ||
    evaluationWeights.officerMaterial <= 0 ||
    evaluationWeights.pawnMaterial <= 0
  ) {
    throw new BotConfigError('Piece material weights must be strictly positive.');
  }

  if (
    evaluationWeights.fieldOfficerGoalSecurity <= evaluationWeights.fieldOfficerMaterial ||
    evaluationWeights.officerGoalSecurity <= evaluationWeights.officerMaterial
  ) {
    throw new BotConfigError('Goal security scores must exceed outside piece material scores.');
  }

  if (evaluationWeights.terminalWinScore <= 0 || evaluationWeights.terminalLossScore >= 0) {
    throw new BotConfigError('terminalWinScore must be positive and terminalLossScore must be negative.');
  }

  // Validate Search Parameters
  if (
    searchParameters.transpositionTableSize <= 0 ||
    (searchParameters.transpositionTableSize & (searchParameters.transpositionTableSize - 1)) !== 0
  ) {
    throw new BotConfigError('transpositionTableSize must be a positive power of 2.');
  }

  if (searchParameters.maxSearchPly <= 0 || searchParameters.maxSearchPly > 64) {
    throw new BotConfigError('maxSearchPly must be between 1 and 64.');
  }

  if (searchParameters.nullMoveReduction <= 0) {
    throw new BotConfigError('nullMoveReduction must be a positive integer.');
  }

  if (
    searchParameters.pvMoveBonus <= 0 ||
    searchParameters.captureBaseBonus <= 0 ||
    searchParameters.goalEntryBonus <= 0 ||
    searchParameters.primaryKillerBonus <= 0 ||
    searchParameters.secondaryKillerBonus <= 0 ||
    searchParameters.maxHistoryBonus <= 0 ||
    searchParameters.distanceGainMultiplier <= 0 ||
    searchParameters.terminalNearWinCutoff <= 0 ||
    searchParameters.timeoutCheckIntervalMask <= 0 ||
    searchParameters.mvvLvaVictimMultiplier <= 0
  ) {
    throw new BotConfigError('Search move ordering and heuristic bonuses must be strictly positive.');
  }

  if (searchParameters.blunderPoolMaxCandidates < 2) {
    throw new BotConfigError('searchParameters.blunderPoolMaxCandidates must be at least 2.');
  }

  if (typeof searchParameters.zobristSeed !== 'number' || !Number.isFinite(searchParameters.zobristSeed)) {
    throw new BotConfigError('searchParameters.zobristSeed must be a valid number.');
  }

  if (
    !Number.isInteger(searchParameters.distanceHeuristicsMinTier) ||
    searchParameters.distanceHeuristicsMinTier < 1 ||
    searchParameters.distanceHeuristicsMinTier > 8 ||
    !Number.isInteger(searchParameters.fractionalTiebreakMinTier) ||
    searchParameters.fractionalTiebreakMinTier < 1 ||
    searchParameters.fractionalTiebreakMinTier > 8 ||
    !Number.isInteger(searchParameters.blunderProneMinTier) ||
    searchParameters.blunderProneMinTier < 1 ||
    searchParameters.blunderProneMinTier > 8
  ) {
    throw new BotConfigError('Search tier thresholds must be integers between 1 and 8.');
  }

  if (searchParameters.pacingLeadingMarginThreshold <= 0) {
    throw new BotConfigError('searchParameters.pacingLeadingMarginThreshold must be positive.');
  }

  // Validate Time Management
  if (timeManagement.clockDivisor <= 0) {
    throw new BotConfigError('clockDivisor must be positive.');
  }

  if (timeManagement.minThinkingTimeMs <= 0 || timeManagement.workerSafetyTimeoutMs <= timeManagement.minThinkingTimeMs) {
    throw new BotConfigError('workerSafetyTimeoutMs must strictly exceed minThinkingTimeMs.');
  }

  if (timeManagement.defaultIncrementMs < 0) {
    throw new BotConfigError('timeManagement.defaultIncrementMs must be non-negative.');
  }

  if (timeManagement.defaultMatchMinutes <= 0) {
    throw new BotConfigError('timeManagement.defaultMatchMinutes must be strictly positive.');
  }

  // Validate Opening Book
  const { openingBook } = config;
  if (!openingBook) {
    throw new BotConfigError('openingBook section is missing.');
  }

  if (openingBook.maxPlies <= 0) {
    throw new BotConfigError('openingBook.maxPlies must be positive.');
  }

  if (openingBook.tier2BookProbability < 0 || openingBook.tier2BookProbability > 1) {
    throw new BotConfigError('openingBook.tier2BookProbability must be between 0 and 1.');
  }

  if (openingBook.minTier < 1 || openingBook.minTier > 8) {
    throw new BotConfigError('openingBook.minTier must be between 1 and 8.');
  }

  if (
    !Number.isInteger(openingBook.tier2DeviateLevel) ||
    openingBook.tier2DeviateLevel < 1 ||
    openingBook.tier2DeviateLevel > 8
  ) {
    throw new BotConfigError('openingBook.tier2DeviateLevel must be an integer between 1 and 8.');
  }

  if (openingBook.bookThinkingDelayMs < 0) {
    throw new BotConfigError('openingBook.bookThinkingDelayMs must be non-negative.');
  }

  // Validate All 8 Tiers
  for (let level = 1; level <= 8; level++) {
    const tier = tiers[level];
    if (!tier) {
      throw new BotConfigError(`Missing tier definition for level ${level}.`);
    }

    if (tier.level !== level) {
      throw new BotConfigError(`Tier level mismatch: expected ${level}, received ${tier.level}.`);
    }

    if (!tier.name || tier.name.trim().length === 0) {
      throw new BotConfigError(`Tier ${level} must have a non-empty name.`);
    }

    if (tier.elo < 100 || tier.elo > 3000) {
      throw new BotConfigError(`Tier ${level} Elo (${tier.elo}) is outside valid range [100, 3000].`);
    }

    if (tier.blunderRate < 0 || tier.blunderRate > 1) {
      throw new BotConfigError(`Tier ${level} blunderRate (${tier.blunderRate}) must be between 0 and 1.`);
    }

    if (tier.maxDepth < 1) {
      throw new BotConfigError(`Tier ${level} maxDepth must be at least 1.`);
    }

    if (tier.timeLimitMs <= 0) {
      throw new BotConfigError(`Tier ${level} timeLimitMs must be positive.`);
    }

    // Monotonic Elo check
    if (level > 1 && tier.elo <= tiers[level - 1].elo) {
      throw new BotConfigError(
        `Tier ${level} Elo (${tier.elo}) must strictly exceed Tier ${level - 1} Elo (${tiers[level - 1].elo}).`
      );
    }
  }
}

export const BOT_ENGINE_CONFIG: BotEngineConfig = Object.freeze({
  defaultLevel: 1,
  evaluationWeights: Object.freeze({
    fieldOfficerMaterial: 200,
    officerMaterial: 100,
    pawnMaterial: 25,
    fieldOfficerGoalSecurity: 600,
    officerGoalSecurity: 350,
    fieldOfficerDistanceWeight: 14,
    officerDistanceWeight: 9,
    trappedDistancePenalty: 120,
    centralityMultiplier: 4,
    outDegreeMultiplier: 1,
    turretSentinelBonus: 20,
    pacingTrailingPenalty: 250,
    pacingLeadingBonus: 200,
    fractionalTiebreakMultiplier: 4,
    terminalWinScore: 100_000,
    terminalLossScore: -100_000,
  }),
  searchParameters: Object.freeze({
    transpositionTableSize: 262_144, // 2^18
    maxSearchPly: 32,
    quiescenceMaxPly: 24,
    quiescenceDefaultDepth: 2,
    nullMoveReduction: 1,
    nullMoveMinDepth: 6,
    openingVariancePlies: 0,
    openingVarianceScoreWindow: 0,
    pvMoveBonus: 1_000_000,
    captureBaseBonus: 100_000,
    goalEntryBonus: 50_000,
    primaryKillerBonus: 9_000,
    secondaryKillerBonus: 8_000,
    maxHistoryBonus: 7_000,
    distanceGainMultiplier: 20,
    terminalNearWinCutoff: 50,
    timeoutCheckIntervalMask: 1023,
    mvvLvaVictimMultiplier: 10,
    blunderPoolMaxCandidates: 5,
    zobristSeed: 0x853c49e6,
    distanceHeuristicsMinTier: 3,
    pacingLeadingMarginThreshold: 1.0,
    fractionalTiebreakMinTier: 7,
    blunderProneMinTier: 2,
  }),
  timeManagement: Object.freeze({
    clockDivisor: 25,
    minThinkingTimeMs: 150,
    workerSafetyTimeoutMs: 10_000,
    baseThinkingDelayMs: 250,
    thinkingDelayStepPerLevelMs: 60,
    randomDelayJitterMaxMs: 200,
    defaultIncrementMs: 0,
    defaultMatchMinutes: 5,
  }),
  openingBook: Object.freeze({
    enabled: true,
    maxPlies: 4,
    tier2BookProbability: 0.70,
    minTier: 2,
    tier2DeviateLevel: 2,
    bookThinkingDelayMs: 0,
  }),
  tiers: Object.freeze({
    1: Object.freeze({
      level: 1,
      name: 'Novice',
      elo: 100,
      maxDepth: 1,
      description: 'Opportunistic attacker that snatches free pieces but makes random moves and is blind to vector traps.',
      blunderRate: 0.85,
      useMoveOrdering: false,
      useIterativeDeepening: false,
      usePacingAwareness: false,
      useTranspositionTable: false,
      useQuiescence: false,
      useNullMovePruning: false,
      useCentralityHeuristics: false,
      usePawnScreening: false,
      useSpringboards: false,
      timeLimitMs: 250,
    }),
    2: Object.freeze({
      level: 2,
      name: 'Beginner',
      elo: 400,
      maxDepth: 1,
      description: 'Basic material defender that avoids obvious hanging pieces when paying attention.',
      blunderRate: 0.45,
      useMoveOrdering: false,
      useIterativeDeepening: false,
      usePacingAwareness: false,
      useTranspositionTable: false,
      useQuiescence: false,
      useNullMovePruning: false,
      useCentralityHeuristics: false,
      usePawnScreening: false,
      useSpringboards: false,
      timeLimitMs: 400,
    }),
    3: Object.freeze({
      level: 3,
      name: 'Casual',
      elo: 800,
      maxDepth: 2,
      description: 'Avoids direct self-captures and advances along shortest paths to the goal.',
      blunderRate: 0.20,
      useMoveOrdering: false,
      useIterativeDeepening: false,
      usePacingAwareness: false,
      useTranspositionTable: false,
      useQuiescence: false,
      useNullMovePruning: false,
      useCentralityHeuristics: false,
      usePawnScreening: false,
      useSpringboards: false,
      timeLimitMs: 600,
    }),
    4: Object.freeze({
      level: 4,
      name: 'Competent',
      elo: 1150,
      maxDepth: 3,
      description: 'Solid tactician that screens friendly officers with pawns, sorts captures first, and avoids traps.',
      blunderRate: 0.05,
      useMoveOrdering: true,
      useIterativeDeepening: false,
      usePacingAwareness: false,
      useTranspositionTable: false,
      useQuiescence: false,
      useNullMovePruning: false,
      useCentralityHeuristics: false,
      usePawnScreening: true,
      useSpringboards: false,
      timeLimitMs: 900,
    }),
    5: Object.freeze({
      level: 5,
      name: 'Intermediate',
      elo: 1500,
      maxDepth: 4,
      description: 'Pacing-conscious engine that checks terminal point totals and delays ending the match if trailing.',
      blunderRate: 0.0,
      useMoveOrdering: true,
      useIterativeDeepening: true,
      usePacingAwareness: true,
      useTranspositionTable: false,
      useQuiescence: false,
      useNullMovePruning: false,
      useCentralityHeuristics: false,
      usePawnScreening: true,
      useSpringboards: false,
      timeLimitMs: 1400,
    }),
    6: Object.freeze({
      level: 6,
      name: 'Advanced',
      elo: 1800,
      maxDepth: 5,
      description: 'Deep tactical search resolving capture chains, using pawn springboards for leaping Field Officers.',
      blunderRate: 0.0,
      useMoveOrdering: true,
      useIterativeDeepening: true,
      usePacingAwareness: true,
      useTranspositionTable: true,
      useQuiescence: true,
      useNullMovePruning: false,
      useCentralityHeuristics: false,
      usePawnScreening: true,
      useSpringboards: true,
      timeLimitMs: 2000,
    }),
    7: Object.freeze({
      level: 7,
      name: 'Expert',
      elo: 2100,
      maxDepth: 6,
      description: 'Commands goal-line turret sentinels, controls key vector hubs, and optimizes fractional tiebreakers.',
      blunderRate: 0.0,
      useMoveOrdering: true,
      useIterativeDeepening: true,
      usePacingAwareness: true,
      useTranspositionTable: true,
      useQuiescence: true,
      useNullMovePruning: true,
      useCentralityHeuristics: true,
      usePawnScreening: true,
      useSpringboards: true,
      timeLimitMs: 2500,
    }),
    8: Object.freeze({
      level: 8,
      name: 'Master',
      elo: 2400,
      maxDepth: 8,
      description: 'Full graph flow mastery; coordinates multi-piece pawn walls, suffocating blockades, and endgame conversion.',
      blunderRate: 0.0,
      useMoveOrdering: true,
      useIterativeDeepening: true,
      usePacingAwareness: true,
      useTranspositionTable: true,
      useQuiescence: true,
      useNullMovePruning: true,
      useCentralityHeuristics: true,
      usePawnScreening: true,
      useSpringboards: true,
      timeLimitMs: 3200,
    }),
  }),
});

// Validate canonical configuration immediately at startup
validateBotConfig(BOT_ENGINE_CONFIG);
