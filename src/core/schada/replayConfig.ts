/**
 * Game Move Replay Engine Configuration and Validator.
 *
 * Centralizes bounds, initial state index constants, and scaling parameters.
 * Validates configuration to eliminate hard-coded fallback values.
 */

export class ReplayConfigError extends Error {
  constructor(message: string) {
    super(`ReplayConfigError: ${message}`);
    this.name = 'ReplayConfigError';
  }
}

export interface ReplayConfig {
  readonly initialMoveIndex: number;
  readonly maxMoveHistoryLimit: number;
}

/**
 * Validates the Replay configuration.
 * Throws ReplayConfigError if configuration object is missing, null, or has invalid values.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant.
 */
export function validateReplayConfig(config: ReplayConfig): void {
  if (!config) {
    throw new ReplayConfigError('Configuration object is missing or null.');
  }

  if (typeof config.initialMoveIndex !== 'number' || isNaN(config.initialMoveIndex)) {
    throw new ReplayConfigError(
      `Invalid initialMoveIndex: expected number, received ${config.initialMoveIndex}.`
    );
  }

  if (
    typeof config.maxMoveHistoryLimit !== 'number' ||
    config.maxMoveHistoryLimit <= 0 ||
    !Number.isInteger(config.maxMoveHistoryLimit)
  ) {
    throw new ReplayConfigError(
      `Invalid maxMoveHistoryLimit: expected positive integer, received ${config.maxMoveHistoryLimit}.`
    );
  }
}

export const CANONICAL_REPLAY_CONFIG: ReplayConfig = Object.freeze({
  initialMoveIndex: -1,
  maxMoveHistoryLimit: 10000,
});

validateReplayConfig(CANONICAL_REPLAY_CONFIG);
