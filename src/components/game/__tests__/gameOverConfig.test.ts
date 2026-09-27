import { describe, it, expect } from 'vitest';
import {
  GAME_OVER_MODAL_CONFIG,
  validateGameOverModalConfig,
  GameOverModalConfigError,
  type GameOverModalConfig,
} from '../gameOverConfig';

describe('GAME_OVER_MODAL_CONFIG validation and configuration', () => {
  it('canonical GAME_OVER_MODAL_CONFIG passes validation', () => {
    expect(() => validateGameOverModalConfig(GAME_OVER_MODAL_CONFIG)).not.toThrow();
  });

  it('throws GameOverModalConfigError if config object is missing or null', () => {
    expect(() => validateGameOverModalConfig(null as unknown as GameOverModalConfig)).toThrowError(
      GameOverModalConfigError
    );
    expect(() => validateGameOverModalConfig(null as unknown as GameOverModalConfig)).toThrowError(
      'GameOverModalConfigError: Configuration object is missing or null.'
    );
  });

  it('throws GameOverModalConfigError if layout gridColumns is empty or missing', () => {
    const invalidConfig: GameOverModalConfig = {
      ...GAME_OVER_MODAL_CONFIG,
      layout: {
        gridColumnsRanked: '',
        gridColumnsUnranked: '2fr 1fr 1fr',
      },
    };
    expect(() => validateGameOverModalConfig(invalidConfig)).toThrowError(
      'GameOverModalConfigError: Invalid layout.gridColumnsRanked: expected non-empty string.'
    );
  });

  it('throws GameOverModalConfigError if copy section is missing', () => {
    const invalidConfig = {
      ...GAME_OVER_MODAL_CONFIG,
      copy: null as unknown as GameOverModalConfig['copy'],
    };
    expect(() => validateGameOverModalConfig(invalidConfig)).toThrowError(
      'GameOverModalConfigError: Copy configuration section is missing.'
    );
  });

  it('throws GameOverModalConfigError if a winReason is missing or empty', () => {
    const invalidConfig: GameOverModalConfig = {
      ...GAME_OVER_MODAL_CONFIG,
      copy: {
        ...GAME_OVER_MODAL_CONFIG.copy,
        winReasons: {
          ...GAME_OVER_MODAL_CONFIG.copy.winReasons,
          resignation: '',
        },
      },
    };
    expect(() => validateGameOverModalConfig(invalidConfig)).toThrowError(
      'GameOverModalConfigError: Invalid copy.winReasons.resignation: expected non-empty string.'
    );
  });
});
