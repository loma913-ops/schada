import { describe, it, expect } from 'vitest';
import {
  ELO_CONFIG,
  validateEloConfig,
  EloConfigError,
  type EloConfig,
} from '../eloConfig';

describe('ELO_CONFIG validation and configuration', () => {
  it('canonical ELO_CONFIG passes validation', () => {
    expect(() => validateEloConfig(ELO_CONFIG)).not.toThrow();
  });

  it('throws EloConfigError if config object is missing or null', () => {
    expect(() => validateEloConfig(null as unknown as EloConfig)).toThrowError(EloConfigError);
    expect(() => validateEloConfig(null as unknown as EloConfig)).toThrowError(
      'EloConfigError: Configuration object is missing or null.'
    );
  });

  it('throws EloConfigError for invalid provisionalThresholdGames', () => {
    const invalidConfig: EloConfig = {
      ...ELO_CONFIG,
      provisionalThresholdGames: 0,
    };
    expect(() => validateEloConfig(invalidConfig)).toThrowError(EloConfigError);
  });

  it('throws EloConfigError if provisionalKFactor <= standardKFactor', () => {
    const invalidConfig: EloConfig = {
      ...ELO_CONFIG,
      provisionalKFactor: 20,
      standardKFactor: 20,
    };
    expect(() => validateEloConfig(invalidConfig)).toThrowError(
      /provisionalKFactor \(20\) must strictly exceed standardKFactor \(20\)/
    );
  });

  it('throws EloConfigError for negative minimumRating or scaleFactor', () => {
    expect(() => validateEloConfig({ ...ELO_CONFIG, minimumRating: -1 })).toThrowError(EloConfigError);
    expect(() => validateEloConfig({ ...ELO_CONFIG, scaleFactor: 0 })).toThrowError(EloConfigError);
  });

  it('throws EloConfigError if defaultStartingRating < minimumRating', () => {
    expect(() =>
      validateEloConfig({ ...ELO_CONFIG, defaultStartingRating: 50, minimumRating: 100 })
    ).toThrowError(EloConfigError);
  });
});
