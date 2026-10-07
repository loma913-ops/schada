import { describe, it, expect } from 'vitest';
import {
  CANONICAL_ANALYSIS_CONFIG,
  validateAnalysisConfig,
  AnalysisConfigError,
  type AnalysisConfig,
} from '../analysisConfig';

describe('Analysis Configuration', () => {
  it('validates canonical configuration without errors', () => {
    expect(() => validateAnalysisConfig(CANONICAL_ANALYSIS_CONFIG)).not.toThrow();
  });

  it('contains all 10 canonical move quality badges with valid colors and symbols', () => {
    const required = [
      'brilliant',
      'great',
      'best',
      'excellent',
      'good',
      'book',
      'inaccuracy',
      'mistake',
      'miss',
      'blunder',
    ] as const;

    for (const q of required) {
      const badge = CANONICAL_ANALYSIS_CONFIG.badges[q];
      expect(badge).toBeDefined();
      expect(badge.symbol.length).toBeGreaterThan(0);
      expect(badge.label.length).toBeGreaterThan(0);
      expect(badge.hexColor.startsWith('#')).toBe(true);
      expect(badge.ansiColor.length).toBeGreaterThan(0);
    }
  });

  it('throws AnalysisConfigError if configuration object is missing', () => {
    expect(() => validateAnalysisConfig(null as unknown as AnalysisConfig)).toThrow(AnalysisConfigError);
  });

  it('throws AnalysisConfigError on invalid search depths or candidate limits', () => {
    const badConfig: AnalysisConfig = {
      ...CANONICAL_ANALYSIS_CONFIG,
      search: {
        ...CANONICAL_ANALYSIS_CONFIG.search,
        defaultDepth: 999,
      },
    };
    expect(() => validateAnalysisConfig(badConfig)).toThrow(AnalysisConfigError);

    const badCandLimit: AnalysisConfig = {
      ...CANONICAL_ANALYSIS_CONFIG,
      search: {
        ...CANONICAL_ANALYSIS_CONFIG.search,
        topCandidateMovesLimit: -1,
      },
    };
    expect(() => validateAnalysisConfig(badCandLimit)).toThrow(AnalysisConfigError);
  });

  it('throws AnalysisConfigError on non-monotonic thresholds', () => {
    const badConfig: AnalysisConfig = {
      ...CANONICAL_ANALYSIS_CONFIG,
      thresholds: {
        ...CANONICAL_ANALYSIS_CONFIG.thresholds,
        bestMoveDelta: 50,
        excellentDelta: 20, // Lower than bestMoveDelta!
      },
    };
    expect(() => validateAnalysisConfig(badConfig)).toThrow(AnalysisConfigError);
  });

  it('throws AnalysisConfigError on missing badge entries', () => {
    const badBadges = { ...CANONICAL_ANALYSIS_CONFIG.badges } as Record<string, unknown>;
    delete badBadges.blunder;
    const badConfig = {
      ...CANONICAL_ANALYSIS_CONFIG,
      badges: badBadges,
    } as unknown as AnalysisConfig;

    expect(() => validateAnalysisConfig(badConfig)).toThrow(AnalysisConfigError);
  });

  it('throws AnalysisConfigError on invalid accuracy or formatting parameters', () => {
    const badCeiling: AnalysisConfig = {
      ...CANONICAL_ANALYSIS_CONFIG,
      accuracy: {
        ...CANONICAL_ANALYSIS_CONFIG.accuracy,
        evalCeiling: -10,
      },
    };
    expect(() => validateAnalysisConfig(badCeiling)).toThrow(AnalysisConfigError);

    const badCentipoints: AnalysisConfig = {
      ...CANONICAL_ANALYSIS_CONFIG,
      formatting: {
        ...CANONICAL_ANALYSIS_CONFIG.formatting,
        centipointsPerPoint: 0,
      },
    };
    expect(() => validateAnalysisConfig(badCentipoints)).toThrow(AnalysisConfigError);
  });
});
