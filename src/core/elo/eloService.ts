import { ELO_CONFIG, validateEloConfig, type EloConfig } from './eloConfig';

export interface PlayerEloData {
  readonly rating: number;
  readonly gamesPlayed: number;
}

export interface EloCalculationResult {
  readonly blueDelta: number;
  readonly greenDelta: number;
  readonly newBlueRating: number;
  readonly newGreenRating: number;
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
  blue: PlayerEloData,
  green: PlayerEloData,
  outcome: 'blue' | 'green' | 'draw',
  config: EloConfig = ELO_CONFIG
): EloCalculationResult {
  validateEloConfig(config);

  const expectedBlue = calculateExpectedScore(blue.rating, green.rating, config);
  const expectedGreen = calculateExpectedScore(green.rating, blue.rating, config);

  let actualBlue = 0.5;
  let actualGreen = 0.5;

  if (outcome === 'blue') {
    actualBlue = 1.0;
    actualGreen = 0.0;
  } else if (outcome === 'green') {
    actualBlue = 0.0;
    actualGreen = 1.0;
  }

  const kBlue = getKFactor(blue.gamesPlayed, config);
  const kGreen = getKFactor(green.gamesPlayed, config);

  const blueDelta = Math.round(kBlue * (actualBlue - expectedBlue));
  const greenDelta = Math.round(kGreen * (actualGreen - expectedGreen));

  return {
    blueDelta,
    greenDelta,
    newBlueRating: Math.max(config.minimumRating, blue.rating + blueDelta),
    newGreenRating: Math.max(config.minimumRating, green.rating + greenDelta),
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
