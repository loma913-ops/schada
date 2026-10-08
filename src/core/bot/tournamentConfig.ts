/**
 * Tournament Simulation Configuration for Standalone Bot Championships.
 *
 * Centralizes all simulation defaults, limits, scoring thresholds,
 * file paths, bracket parameters, and numerical constants.
 * Validates configuration to eliminate hard-coded fallback values.
 */

export class TournamentConfigError extends Error {
  constructor(message: string) {
    super(`TournamentConfigError: ${message}`);
    this.name = 'TournamentConfigError';
  }
}

export interface TournamentSubdirectoriesConfig {
  readonly games: string;
  readonly tournaments: string;
}

export interface TournamentFilenamesConfig {
  readonly summaryJson: string;
  readonly summaryMd: string;
}

export interface TournamentMathConstantsConfig {
  readonly msPerSecond: number;
  readonly secondsPerMinute: number;
  readonly percentageMultiplier: number;
}

export interface TournamentStageNamesConfig {
  readonly champion: string;
  readonly finalist: string;
  readonly semifinalist: string;
  readonly quarterfinalist: string;
}

export interface TournamentSimulationConfig {
  readonly defaultTournaments: number;
  readonly minTournaments: number;
  readonly maxTournaments: number;
  readonly defaultTimeLimitMs: number;
  readonly minTimeLimitMs: number;
  readonly maxTimeLimitMs: number;
  readonly initialBotElo: number;
  readonly minBotElo: number;
  readonly defaultMaxMovesPerGame: number;
  readonly minMaxMovesPerGame: number;
  readonly maxMaxMovesPerGame: number;
  readonly defaultOutputDir: string;
  readonly defaultWorkers: number;
  readonly minWorkers: number;
  readonly maxWorkers: number;
  readonly botTierCount: number;
  readonly bracketRounds: readonly string[];
  readonly stageNames: TournamentStageNamesConfig;
  readonly maxDrawRematches: number;
  readonly minDrawRematches: number;
  readonly maxPossibleDrawRematches: number;
  readonly defaultIdPaddingDigits: number;
  readonly minIdPaddingDigits: number;
  readonly maxIdPaddingDigits: number;
  readonly subdirectories: TournamentSubdirectoriesConfig;
  readonly filenames: TournamentFilenamesConfig;
  readonly mathConstants: TournamentMathConstantsConfig;
  readonly progressLogInterval: number;
}

/**
 * Validates the TournamentSimulationConfig at startup.
 * Throws TournamentConfigError if configuration is missing, null, or contains invalid parameters.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time, checking a fixed set of numeric thresholds.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant, invariant with respect to system load.
 */
export function validateTournamentSimulationConfig(config: TournamentSimulationConfig): void {
  if (!config) {
    throw new TournamentConfigError('Configuration object is missing or null.');
  }

  if (
    typeof config.defaultTournaments !== 'number' ||
    !Number.isInteger(config.defaultTournaments) ||
    config.defaultTournaments < config.minTournaments ||
    config.defaultTournaments > config.maxTournaments
  ) {
    throw new TournamentConfigError(
      `defaultTournaments (${config.defaultTournaments}) must be an integer between ${config.minTournaments} and ${config.maxTournaments}.`
    );
  }

  if (
    typeof config.minTournaments !== 'number' ||
    config.minTournaments <= 0 ||
    typeof config.maxTournaments !== 'number' ||
    config.maxTournaments < config.minTournaments
  ) {
    throw new TournamentConfigError('Invalid minTournaments or maxTournaments bounds.');
  }

  if (
    typeof config.defaultTimeLimitMs !== 'number' ||
    config.defaultTimeLimitMs < config.minTimeLimitMs ||
    config.defaultTimeLimitMs > config.maxTimeLimitMs
  ) {
    throw new TournamentConfigError(
      `defaultTimeLimitMs (${config.defaultTimeLimitMs}) must be between ${config.minTimeLimitMs} and ${config.maxTimeLimitMs}.`
    );
  }

  if (
    typeof config.initialBotElo !== 'number' ||
    config.initialBotElo < config.minBotElo
  ) {
    throw new TournamentConfigError(
      `initialBotElo (${config.initialBotElo}) must be >= minBotElo (${config.minBotElo}).`
    );
  }

  if (
    typeof config.defaultMaxMovesPerGame !== 'number' ||
    config.defaultMaxMovesPerGame < config.minMaxMovesPerGame ||
    config.defaultMaxMovesPerGame > config.maxMaxMovesPerGame
  ) {
    throw new TournamentConfigError(
      `defaultMaxMovesPerGame (${config.defaultMaxMovesPerGame}) must be between ${config.minMaxMovesPerGame} and ${config.maxMaxMovesPerGame}.`
    );
  }

  if (
    typeof config.defaultOutputDir !== 'string' ||
    config.defaultOutputDir.trim().length === 0
  ) {
    throw new TournamentConfigError('defaultOutputDir must be a non-empty string.');
  }

  if (
    typeof config.defaultWorkers !== 'number' ||
    config.defaultWorkers < config.minWorkers ||
    config.defaultWorkers > config.maxWorkers
  ) {
    throw new TournamentConfigError(
      `defaultWorkers (${config.defaultWorkers}) must be between ${config.minWorkers} and ${config.maxWorkers}.`
    );
  }

  if (
    typeof config.botTierCount !== 'number' ||
    config.botTierCount !== 8
  ) {
    throw new TournamentConfigError(
      `botTierCount must be exactly 8, received ${config.botTierCount}.`
    );
  }

  if (
    !Array.isArray(config.bracketRounds) ||
    config.bracketRounds.length !== 3
  ) {
    throw new TournamentConfigError('bracketRounds must contain exactly 3 rounds (Quarterfinals, Semifinals, Finals).');
  }

  for (let r = 0; r < config.bracketRounds.length; r++) {
    if (typeof config.bracketRounds[r] !== 'string' || config.bracketRounds[r].trim().length === 0) {
      throw new TournamentConfigError(`bracketRounds[${r}] must be a non-empty string.`);
    }
  }

  if (
    !config.stageNames ||
    typeof config.stageNames.champion !== 'string' ||
    typeof config.stageNames.finalist !== 'string' ||
    typeof config.stageNames.semifinalist !== 'string' ||
    typeof config.stageNames.quarterfinalist !== 'string' ||
    config.stageNames.champion.trim().length === 0 ||
    config.stageNames.finalist.trim().length === 0 ||
    config.stageNames.semifinalist.trim().length === 0 ||
    config.stageNames.quarterfinalist.trim().length === 0
  ) {
    throw new TournamentConfigError('stageNames must define non-empty champion, finalist, semifinalist, and quarterfinalist labels.');
  }

  if (
    typeof config.maxDrawRematches !== 'number' ||
    config.maxDrawRematches < config.minDrawRematches ||
    config.maxDrawRematches > config.maxPossibleDrawRematches
  ) {
    throw new TournamentConfigError(
      `maxDrawRematches (${config.maxDrawRematches}) must be between ${config.minDrawRematches} and ${config.maxPossibleDrawRematches}.`
    );
  }

  if (
    typeof config.defaultIdPaddingDigits !== 'number' ||
    config.defaultIdPaddingDigits < config.minIdPaddingDigits ||
    config.defaultIdPaddingDigits > config.maxIdPaddingDigits
  ) {
    throw new TournamentConfigError(
      `defaultIdPaddingDigits (${config.defaultIdPaddingDigits}) must be between ${config.minIdPaddingDigits} and ${config.maxIdPaddingDigits}.`
    );
  }

  if (
    !config.subdirectories ||
    typeof config.subdirectories.games !== 'string' ||
    typeof config.subdirectories.tournaments !== 'string' ||
    config.subdirectories.games.trim().length === 0 ||
    config.subdirectories.tournaments.trim().length === 0
  ) {
    throw new TournamentConfigError('subdirectories config must define non-empty games and tournaments folder names.');
  }

  if (
    !config.filenames ||
    typeof config.filenames.summaryJson !== 'string' ||
    typeof config.filenames.summaryMd !== 'string' ||
    config.filenames.summaryJson.trim().length === 0 ||
    config.filenames.summaryMd.trim().length === 0
  ) {
    throw new TournamentConfigError('filenames config must define non-empty summaryJson and summaryMd file names.');
  }

  if (
    !config.mathConstants ||
    typeof config.mathConstants.msPerSecond !== 'number' ||
    config.mathConstants.msPerSecond <= 0 ||
    typeof config.mathConstants.secondsPerMinute !== 'number' ||
    config.mathConstants.secondsPerMinute <= 0 ||
    typeof config.mathConstants.percentageMultiplier !== 'number' ||
    config.mathConstants.percentageMultiplier <= 0
  ) {
    throw new TournamentConfigError('mathConstants must define positive msPerSecond, secondsPerMinute, and percentageMultiplier.');
  }

  if (
    typeof config.progressLogInterval !== 'number' ||
    config.progressLogInterval <= 0
  ) {
    throw new TournamentConfigError('progressLogInterval must be a positive number.');
  }
}

export const TOURNAMENT_SIMULATION_CONFIG: TournamentSimulationConfig = Object.freeze({
  defaultTournaments: 1000,
  minTournaments: 1,
  maxTournaments: 100_000,
  defaultTimeLimitMs: 50,
  minTimeLimitMs: 5,
  maxTimeLimitMs: 10_000,
  initialBotElo: 1200,
  minBotElo: 100,
  defaultMaxMovesPerGame: 300,
  minMaxMovesPerGame: 20,
  maxMaxMovesPerGame: 2000,
  defaultOutputDir: './tournament_output',
  defaultWorkers: 1,
  minWorkers: 1,
  maxWorkers: 64,
  botTierCount: 8,
  bracketRounds: Object.freeze(['Quarterfinals', 'Semifinals', 'Finals']),
  stageNames: Object.freeze({
    champion: 'Champion',
    finalist: 'Finalist',
    semifinalist: 'Semifinalist',
    quarterfinalist: 'Quarterfinalist',
  }),
  maxDrawRematches: 3,
  minDrawRematches: 1,
  maxPossibleDrawRematches: 10,
  defaultIdPaddingDigits: 4,
  minIdPaddingDigits: 1,
  maxIdPaddingDigits: 10,
  subdirectories: Object.freeze({
    games: 'games',
    tournaments: 'tournaments',
  }),
  filenames: Object.freeze({
    summaryJson: 'bot_summary.json',
    summaryMd: 'bot_summary.md',
  }),
  mathConstants: Object.freeze({
    msPerSecond: 1000,
    secondsPerMinute: 60,
    percentageMultiplier: 100,
  }),
  progressLogInterval: 10,
});

validateTournamentSimulationConfig(TOURNAMENT_SIMULATION_CONFIG);
