import { describe, it, expect } from 'vitest';
import {
  CANONICAL_DIGITAL_CLOCK_CONFIG,
  validateDigitalClockConfig,
  DigitalClockConfigError,
  type DigitalClockConfig,
} from '../digitalClockConfig';

describe('CANONICAL_DIGITAL_CLOCK_CONFIG validation and configuration', () => {
  it('canonical CANONICAL_DIGITAL_CLOCK_CONFIG passes validation', () => {
    expect(() => validateDigitalClockConfig(CANONICAL_DIGITAL_CLOCK_CONFIG)).not.toThrow();
  });

  it('throws DigitalClockConfigError if config object is missing or null', () => {
    expect(() => validateDigitalClockConfig(null as unknown as DigitalClockConfig)).toThrowError(
      DigitalClockConfigError
    );
    expect(() => validateDigitalClockConfig(null as unknown as DigitalClockConfig)).toThrowError(
      'DigitalClockConfigError: Configuration object is missing or null.'
    );
  });

  it('throws DigitalClockConfigError if infinitySymbol is empty or missing', () => {
    const invalidConfig: DigitalClockConfig = {
      ...CANONICAL_DIGITAL_CLOCK_CONFIG,
      infinitySymbol: '',
    };
    expect(() => validateDigitalClockConfig(invalidConfig)).toThrowError(
      'DigitalClockConfigError: Invalid infinitySymbol: expected non-empty string.'
    );
  });

  it('throws DigitalClockConfigError if ariaLabels are missing or empty', () => {
    const invalidConfig: DigitalClockConfig = {
      ...CANONICAL_DIGITAL_CLOCK_CONFIG,
      ariaLabels: {
        unlimited: '',
        remainingTime: 'Remaining time',
      },
    };
    expect(() => validateDigitalClockConfig(invalidConfig)).toThrowError(
      'DigitalClockConfigError: Invalid ariaLabels: expected non-empty strings for unlimited and remainingTime.'
    );
  });

  it('throws DigitalClockConfigError if thresholds are invalid or negative', () => {
    const invalidConfig: DigitalClockConfig = {
      ...CANONICAL_DIGITAL_CLOCK_CONFIG,
      thresholds: {
        lowTimeSeconds: -1,
        showTenthsSeconds: 10,
      },
    };
    expect(() => validateDigitalClockConfig(invalidConfig)).toThrowError(
      'DigitalClockConfigError: Invalid thresholds: expected non-negative numbers for lowTimeSeconds and showTenthsSeconds.'
    );
  });

  it('throws DigitalClockConfigError if timeUnits are invalid or non-positive', () => {
    const invalidConfig: DigitalClockConfig = {
      ...CANONICAL_DIGITAL_CLOCK_CONFIG,
      timeUnits: {
        msPerSecond: 0,
        secondsPerMinute: 60,
        msPerTenth: 100,
      },
    };
    expect(() => validateDigitalClockConfig(invalidConfig)).toThrowError(
      'DigitalClockConfigError: Invalid timeUnits: expected positive numbers for msPerSecond, secondsPerMinute, and msPerTenth.'
    );
  });

  it('throws DigitalClockConfigError if display zeroPadLength is non-positive', () => {
    const invalidConfig: DigitalClockConfig = {
      ...CANONICAL_DIGITAL_CLOCK_CONFIG,
      display: {
        zeroPadLength: 0,
      },
    };
    expect(() => validateDigitalClockConfig(invalidConfig)).toThrowError(
      'DigitalClockConfigError: Invalid display: expected positive number for zeroPadLength.'
    );
  });
});
