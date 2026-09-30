/**
 * Mobile Haptics Configuration and Validator.
 *
 * Centralizes vibration pulses, patterns, and durations for mobile feedback.
 * Validates configuration to eliminate hard-coded fallback values.
 */

export class HapticsConfigError extends Error {
  constructor(message: string) {
    super(`HapticsConfigError: ${message}`);
    this.name = 'HapticsConfigError';
  }
}

export interface HapticsConfig {
  readonly selectPieceMs: number;
  readonly movePieceMs: number;
  readonly capturePiecePattern: readonly number[];
  readonly gameOverPattern: readonly number[];
}

/**
 * Validates the HapticsConfig at startup.
 * Throws HapticsConfigError if configuration is missing, null, or contains invalid parameters.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(P) where P is total pattern elements (P=8), strictly O(1) constant time.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant, perfectly stable across runtime.
 */
export function validateHapticsConfig(config: HapticsConfig): void {
  if (!config) {
    throw new HapticsConfigError('Configuration object is missing or null.');
  }

  if (typeof config.selectPieceMs !== 'number' || isNaN(config.selectPieceMs) || config.selectPieceMs <= 0) {
    throw new HapticsConfigError(`Invalid selectPieceMs: expected positive number, received ${config.selectPieceMs}.`);
  }

  if (typeof config.movePieceMs !== 'number' || isNaN(config.movePieceMs) || config.movePieceMs <= 0) {
    throw new HapticsConfigError(`Invalid movePieceMs: expected positive number, received ${config.movePieceMs}.`);
  }

  if (!Array.isArray(config.capturePiecePattern) || config.capturePiecePattern.length === 0) {
    throw new HapticsConfigError('Invalid capturePiecePattern: expected non-empty array of positive durations.');
  }

  for (let i = 0; i < config.capturePiecePattern.length; i++) {
    const val = config.capturePiecePattern[i];
    if (typeof val !== 'number' || isNaN(val) || val <= 0) {
      throw new HapticsConfigError(`Invalid capturePiecePattern[${i}]: expected positive number, received ${val}.`);
    }
  }

  if (!Array.isArray(config.gameOverPattern) || config.gameOverPattern.length === 0) {
    throw new HapticsConfigError('Invalid gameOverPattern: expected non-empty array of positive durations.');
  }

  for (let i = 0; i < config.gameOverPattern.length; i++) {
    const val = config.gameOverPattern[i];
    if (typeof val !== 'number' || isNaN(val) || val <= 0) {
      throw new HapticsConfigError(`Invalid gameOverPattern[${i}]: expected positive number, received ${val}.`);
    }
  }
}

export const HAPTICS_CONFIG: HapticsConfig = Object.freeze({
  selectPieceMs: 12,
  movePieceMs: 20,
  capturePiecePattern: Object.freeze([25, 40, 30]),
  gameOverPattern: Object.freeze([40, 50, 40, 50, 80]),
});

// Self-validate canonical haptics configuration at module initialization
validateHapticsConfig(HAPTICS_CONFIG);
