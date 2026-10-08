import { describe, it, expect } from 'vitest';
import {
  CANONICAL_ANALYSIS_DISPLAY_CONFIG,
  validateAnalysisDisplayConfig,
  AnalysisDisplayConfigError,
  type AnalysisDisplayConfig,
} from '../analysisDisplayConfig';
import type { MoveQuality } from '@/core/analysis/analysisConfig';

describe('analysisDisplayConfig', () => {
  describe('CANONICAL_ANALYSIS_DISPLAY_CONFIG', () => {
    it('strictly includes only the 6 authorized move quality categories for notation display', () => {
      const qualities = CANONICAL_ANALYSIS_DISPLAY_CONFIG.displayedQualities;
      expect(qualities).toEqual([
        'brilliant',
        'great',
        'inaccuracy',
        'mistake',
        'miss',
        'blunder',
      ]);
      expect(qualities).not.toContain('best');
      expect(qualities).not.toContain('excellent');
      expect(qualities).not.toContain('good');
      expect(qualities).not.toContain('book');
    });

    it('defines valid positive badge size and non-negative gap', () => {
      expect(CANONICAL_ANALYSIS_DISPLAY_CONFIG.badgeSizePx).toBe(18);
      expect(CANONICAL_ANALYSIS_DISPLAY_CONFIG.badgeGapPx).toBeGreaterThanOrEqual(0);
    });

    it('contains all required copy strings', () => {
      const c = CANONICAL_ANALYSIS_DISPLAY_CONFIG.copy;
      expect(c.analyzingPrefix).toBe('Analyzing');
      expect(c.reanalyzeButtonText).toBe('Re-analyze');
      expect(c.cancelButtonText).toBe('Cancel');
      expect(c.cancelAriaLabel).toBeTruthy();
    });
  });

  describe('validateAnalysisDisplayConfig', () => {
    it('validates canonical configuration without throwing', () => {
      expect(() => validateAnalysisDisplayConfig(CANONICAL_ANALYSIS_DISPLAY_CONFIG)).not.toThrow();
    });

    it('throws when config is null or undefined', () => {
      expect(() => validateAnalysisDisplayConfig(null as unknown as AnalysisDisplayConfig)).toThrow(
        AnalysisDisplayConfigError
      );
    });

    it('throws when displayedQualities contains an unknown quality', () => {
      const invalid = {
        ...CANONICAL_ANALYSIS_DISPLAY_CONFIG,
        displayedQualities: ['unknown_quality' as MoveQuality],
      };
      expect(() => validateAnalysisDisplayConfig(invalid)).toThrow(AnalysisDisplayConfigError);
    });

    it('throws when badgeSizePx is non-positive', () => {
      const invalid = {
        ...CANONICAL_ANALYSIS_DISPLAY_CONFIG,
        badgeSizePx: 0,
      };
      expect(() => validateAnalysisDisplayConfig(invalid)).toThrow(AnalysisDisplayConfigError);
    });

    it('throws when copy fields are missing or empty', () => {
      const invalid = {
        ...CANONICAL_ANALYSIS_DISPLAY_CONFIG,
        copy: { ...CANONICAL_ANALYSIS_DISPLAY_CONFIG.copy, reanalyzeButtonText: '' },
      };
      expect(() => validateAnalysisDisplayConfig(invalid)).toThrow(AnalysisDisplayConfigError);
    });
  });
});
