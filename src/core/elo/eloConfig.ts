/**
 * Elo Rating System Configuration and Validator.
 *
 * Centralizes all mathematical constants, K-factors, provisional thresholds,
 * minimum rating clamps, and default parameters for the Schada Elo calculation engine.
 * Validates configuration to eliminate hard-coded fallback values.
 */

export class EloConfigError extends Error {
  constructor(message: string) {
    super(`EloConfigError: ${message}`);
    this.name = 'EloConfigError';
  }
}

export interface EloConfig {
  readonly provisionalThresholdGames: number;
  readonly provisionalKFactor: number;
  readonly standardKFactor: number;
  readonly defaultAssumedGamesPlayed: number;
  readonly minimumRating: number;
  readonly scaleFactor: number;
  readonly defaultStartingRating: number;
}

/**
 * Validates the Elo system configuration.
 * Throws EloConfigError if the config object is missing, null, or contains invalid parameters.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time, verifying static numeric boundaries.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant independent of system load.
 */
export function validateEloConfig(config: EloConfig): void {
  if (!config) {
    throw new EloConfigError('Configuration object is missing or null.');
  }

  if (
    typeof config.provisionalThresholdGames !== 'number' ||
    config.provisionalThresholdGames <= 0 ||
    !Number.isFinite(config.provisionalThresholdGames)
  ) {
    throw new EloConfigError(
      `Invalid provisionalThresholdGames: expected positive finite number, received ${String(
        config.provisionalThresholdGames
      )}.`
    );
  }

  if (
    typeof config.provisionalKFactor !== 'number' ||
    config.provisionalKFactor <= 0 ||
    !Number.isFinite(config.provisionalKFactor)
  ) {
    throw new EloConfigError(
      `Invalid provisionalKFactor: expected positive finite number, received ${String(
        config.provisionalKFactor
      )}.`
    );
  }

  if (
    typeof config.standardKFactor !== 'number' ||
    config.standardKFactor <= 0 ||
    !Number.isFinite(config.standardKFactor)
  ) {
    throw new EloConfigError(
      `Invalid standardKFactor: expected positive finite number, received ${String(
        config.standardKFactor
      )}.`
    );
  }

  if (config.provisionalKFactor <= config.standardKFactor) {
    throw new EloConfigError(
      `Invalid K-factor hierarchy: provisionalKFactor (${config.provisionalKFactor}) must strictly exceed standardKFactor (${config.standardKFactor}).`
    );
  }

  if (
    typeof config.defaultAssumedGamesPlayed !== 'number' ||
    config.defaultAssumedGamesPlayed < 0 ||
    !Number.isFinite(config.defaultAssumedGamesPlayed)
  ) {
    throw new EloConfigError(
      `Invalid defaultAssumedGamesPlayed: expected non-negative finite number, received ${String(
        config.defaultAssumedGamesPlayed
      )}.`
    );
  }

  if (
    typeof config.minimumRating !== 'number' ||
    config.minimumRating <= 0 ||
    !Number.isFinite(config.minimumRating)
  ) {
    throw new EloConfigError(
      `Invalid minimumRating: expected positive finite number, received ${String(
        config.minimumRating
      )}.`
    );
  }

  if (
    typeof config.scaleFactor !== 'number' ||
    config.scaleFactor <= 0 ||
    !Number.isFinite(config.scaleFactor)
  ) {
    throw new EloConfigError(
      `Invalid scaleFactor: expected positive finite number, received ${String(
        config.scaleFactor
      )}.`
    );
  }

  if (
    typeof config.defaultStartingRating !== 'number' ||
    config.defaultStartingRating < config.minimumRating ||
    !Number.isFinite(config.defaultStartingRating)
  ) {
    throw new EloConfigError(
      `Invalid defaultStartingRating: expected finite number >= minimumRating (${config.minimumRating}), received ${String(
        config.defaultStartingRating
      )}.`
    );
  }
}

/**
 * Canonical Elo system configuration for Schada.
 */
export const ELO_CONFIG: EloConfig = {
  provisionalThresholdGames: 15,
  provisionalKFactor: 40,
  standardKFactor: 20,
  defaultAssumedGamesPlayed: 20,
  minimumRating: 100,
  scaleFactor: 400,
  defaultStartingRating: 1200,
};

// Validate canonical configuration at module initialization
validateEloConfig(ELO_CONFIG);
