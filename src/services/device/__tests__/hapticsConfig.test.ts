import { describe, it, expect } from 'vitest';
import { HAPTICS_CONFIG, validateHapticsConfig, HapticsConfigError } from '../hapticsConfig';

describe('hapticsConfig', () => {
  it('validates canonical HAPTICS_CONFIG without throwing', () => {
    expect(() => validateHapticsConfig(HAPTICS_CONFIG)).not.toThrow();
    expect(HAPTICS_CONFIG.selectPieceMs).toBe(12);
    expect(HAPTICS_CONFIG.movePieceMs).toBe(20);
    expect(HAPTICS_CONFIG.capturePiecePattern).toEqual([25, 40, 30]);
    expect(HAPTICS_CONFIG.gameOverPattern).toEqual([40, 50, 40, 50, 80]);
  });

  it('throws on null or undefined config', () => {
    expect(() => validateHapticsConfig(null as any)).toThrow(HapticsConfigError);
    expect(() => validateHapticsConfig(undefined as any)).toThrow('Configuration object is missing or null.');
  });

  it('throws on non-positive selectPieceMs or movePieceMs', () => {
    const invalidSelect = { ...HAPTICS_CONFIG, selectPieceMs: -5 };
    expect(() => validateHapticsConfig(invalidSelect)).toThrow('Invalid selectPieceMs');

    const invalidMove = { ...HAPTICS_CONFIG, movePieceMs: 0 };
    expect(() => validateHapticsConfig(invalidMove)).toThrow('Invalid movePieceMs');
  });

  it('throws on invalid pattern arrays', () => {
    const invalidCapture = { ...HAPTICS_CONFIG, capturePiecePattern: [20, -10] };
    expect(() => validateHapticsConfig(invalidCapture)).toThrow('Invalid capturePiecePattern[1]');

    const emptyGameOver = { ...HAPTICS_CONFIG, gameOverPattern: [] };
    expect(() => validateHapticsConfig(emptyGameOver)).toThrow('Invalid gameOverPattern');
  });
});
