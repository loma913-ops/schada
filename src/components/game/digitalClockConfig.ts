/**
 * Digital Clock Configuration and Validator.
 *
 * Centralizes clock display thresholds, time conversions, aria labels,
 * and canonical infinity symbol representation.
 * Validates configuration to eliminate hard-coded fallback values.
 */

export class DigitalClockConfigError extends Error {
  constructor(message: string) {
    super(`DigitalClockConfigError: ${message}`);
    this.name = 'DigitalClockConfigError';
  }
}

export interface DigitalClockConfig {
  readonly infinitySymbol: string;
  readonly ariaLabels: {
    readonly unlimited: string;
    readonly remainingTime: string;
  };
  readonly thresholds: {
    readonly lowTimeSeconds: number;
    readonly showTenthsSeconds: number;
  };
  readonly timeUnits: {
    readonly msPerSecond: number;
    readonly secondsPerMinute: number;
    readonly msPerTenth: number;
  };
  readonly display: {
    readonly zeroPadLength: number;
  };
}

/**
 * Validates the Digital Clock configuration.
 * Throws DigitalClockConfigError if config is missing, null, or contains invalid parameters.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time, verifying static object properties.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant.
 */
export function validateDigitalClockConfig(config: DigitalClockConfig): void {
  if (!config) {
    throw new DigitalClockConfigError('Configuration object is missing or null.');
  }

  if (typeof config.infinitySymbol !== 'string' || config.infinitySymbol.trim().length === 0) {
    throw new DigitalClockConfigError('Invalid infinitySymbol: expected non-empty string.');
  }

  if (
    !config.ariaLabels ||
    typeof config.ariaLabels.unlimited !== 'string' ||
    config.ariaLabels.unlimited.trim().length === 0 ||
    typeof config.ariaLabels.remainingTime !== 'string' ||
    config.ariaLabels.remainingTime.trim().length === 0
  ) {
    throw new DigitalClockConfigError(
      'Invalid ariaLabels: expected non-empty strings for unlimited and remainingTime.'
    );
  }

  if (
    !config.thresholds ||
    typeof config.thresholds.lowTimeSeconds !== 'number' ||
    isNaN(config.thresholds.lowTimeSeconds) ||
    config.thresholds.lowTimeSeconds < 0 ||
    typeof config.thresholds.showTenthsSeconds !== 'number' ||
    isNaN(config.thresholds.showTenthsSeconds) ||
    config.thresholds.showTenthsSeconds < 0
  ) {
    throw new DigitalClockConfigError(
      'Invalid thresholds: expected non-negative numbers for lowTimeSeconds and showTenthsSeconds.'
    );
  }

  if (
    !config.timeUnits ||
    typeof config.timeUnits.msPerSecond !== 'number' ||
    config.timeUnits.msPerSecond <= 0 ||
    typeof config.timeUnits.secondsPerMinute !== 'number' ||
    config.timeUnits.secondsPerMinute <= 0 ||
    typeof config.timeUnits.msPerTenth !== 'number' ||
    config.timeUnits.msPerTenth <= 0
  ) {
    throw new DigitalClockConfigError(
      'Invalid timeUnits: expected positive numbers for msPerSecond, secondsPerMinute, and msPerTenth.'
    );
  }

  if (
    !config.display ||
    typeof config.display.zeroPadLength !== 'number' ||
    config.display.zeroPadLength <= 0
  ) {
    throw new DigitalClockConfigError('Invalid display: expected positive number for zeroPadLength.');
  }
}

export const CANONICAL_DIGITAL_CLOCK_CONFIG: DigitalClockConfig = Object.freeze({
  infinitySymbol: '∞',
  ariaLabels: Object.freeze({
    unlimited: 'Remaining time: unlimited',
    remainingTime: 'Remaining time',
  }),
  thresholds: Object.freeze({
    lowTimeSeconds: 30,
    showTenthsSeconds: 10,
  }),
  timeUnits: Object.freeze({
    msPerSecond: 1000,
    secondsPerMinute: 60,
    msPerTenth: 100,
  }),
  display: Object.freeze({
    zeroPadLength: 2,
  }),
});

validateDigitalClockConfig(CANONICAL_DIGITAL_CLOCK_CONFIG);
