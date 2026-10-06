import { describe, it, expect } from 'vitest';
import {
  GAME_CONTROLS_CONFIG,
  GameControlsConfigError,
  validateGameControlsConfig,
  type GameControlsConfig,
} from '../gameControlsConfig';

describe('GameControls Configuration and Validator', () => {
  it('validates canonical GAME_CONTROLS_CONFIG without throwing', () => {
    expect(() => validateGameControlsConfig(GAME_CONTROLS_CONFIG)).not.toThrow();
  });

  it('throws GameControlsConfigError when configuration is null or undefined', () => {
    expect(() => validateGameControlsConfig(null as unknown as GameControlsConfig)).toThrow(
      GameControlsConfigError
    );
    expect(() => validateGameControlsConfig(undefined as unknown as GameControlsConfig)).toThrow(
      'Configuration object is missing or null.'
    );
  });

  it('validates copy object existence', () => {
    expect(() =>
      validateGameControlsConfig({ copy: null as unknown as GameControlsConfig['copy'] })
    ).toThrow('Configuration missing copy specification.');
  });

  it('validates that copy keys must be non-empty strings', () => {
    expect(() =>
      validateGameControlsConfig({
        copy: {
          ...GAME_CONTROLS_CONFIG.copy,
          resignButtonText: '',
        },
      })
    ).toThrow('Invalid copy.resignButtonText: expected non-empty string.');

    expect(() =>
      validateGameControlsConfig({
        copy: {
          ...GAME_CONTROLS_CONFIG.copy,
          flipButtonText: '   ',
        },
      })
    ).toThrow('Invalid copy.flipButtonText: expected non-empty string.');
  });
});
