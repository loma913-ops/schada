import { ELO_CONFIG, validateEloConfig, type EloConfig } from './eloConfig';

export interface PlayerEloData {
  readonly rating: number;
  readonly gamesPlayed: number;
}

export interface EloCalculationResult {
  readonly whiteDelta: number;
  readonly blackDelta: number;
  readonly newWhiteRating: number;
  readonly newBlackRating: number;
}

/**
 * Computes the K-factor multiplier based on the player's match history.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time boundary check.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) independent of rating or history volume.
 */
export function getKFactor(gamesPlayed: number, config: EloConfig = ELO_CONFIG): number {
  validateEloConfig(config);
  return gamesPlayed < config.provisionalThresholdGames
    ? config.provisionalKFactor
    : config.standardKFactor;
}

/**
 * Calculates the expected score using the standard logistic distribution formula:
 * E = 1 / (1 + 10^((R_opponent - R_player) / scaleFactor))
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time floating-point exponentiation and arithmetic.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant scaling.
 */
export function calculateExpectedScore(
  playerRating: number,
  opponentRating: number,
  config: EloConfig = ELO_CONFIG
): number {
  validateEloConfig(config);
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / config.scaleFactor));
}

/**
 * Calculates Elo rating updates and deltas for both players after match completion.
 * Clamps output ratings to config.minimumRating to prevent negative or zero ratings.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time execution across all branches.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant, perfectly sustainable as match data volume scales infinitely.
 */
export function calculateEloUpdate(
  white: PlayerEloData,
  black: PlayerEloData,
  outcome: 'white' | 'black' | 'draw',
  config: EloConfig = ELO_CONFIG
): EloCalculationResult {
  validateEloConfig(config);

  const expectedWhite = calculateExpectedScore(white.rating, black.rating, config);
  const expectedBlack = calculateExpectedScore(black.rating, white.rating, config);

  let actualWhite = 0.5;
  let actualBlack = 0.5;

  if (outcome === 'white') {
    actualWhite = 1.0;
    actualBlack = 0.0;
  } else if (outcome === 'black') {
    actualWhite = 0.0;
    actualBlack = 1.0;
  }

  const kWhite = getKFactor(white.gamesPlayed, config);
  const kBlack = getKFactor(black.gamesPlayed, config);

  const whiteDelta = Math.round(kWhite * (actualWhite - expectedWhite));
  const blackDelta = Math.round(kBlack * (actualBlack - expectedBlack));

  const newWhiteRating = Math.max(config.minimumRating, white.rating + whiteDelta);
  const newBlackRating = Math.max(config.minimumRating, black.rating + blackDelta);

  return {
    whiteDelta,
    blackDelta,
    newWhiteRating,
    newBlackRating,
  };
}

/**
 * Formats a player's new rating and gain/loss into the standardized display string:
 * ELO (GAIN/LOSS) (e.g., "1256 (+12)", "1142 (-11)", "1200 (+0)").
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time template string interpolation.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant.
 */
export function formatEloWithDelta(newElo: number, delta: number): string {
  const deltaStr = delta >= 0 ? `+${delta}` : `${delta}`;
  return `${newElo} (${deltaStr})`;
}
