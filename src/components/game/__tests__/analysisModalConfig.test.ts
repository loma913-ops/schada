import { describe, it, expect } from 'vitest';
import {
  CANONICAL_ANALYSIS_MODAL_CONFIG,
  CANONICAL_ANALYSIS_MODAL_SLIDER_DEFAULTS,
  validateAnalysisModalConfig,
  resolveDefaultTimeLimitSeconds,
  calculateEstimatedAnalysisTime,
  AnalysisModalConfigError,
  type AnalysisModalConfig,
} from '../analysisModalConfig';
import { CANONICAL_ANALYSIS_CONFIG } from '@/core/analysis/analysisConfig';

describe('AnalysisModalConfig', () => {
  describe('CANONICAL_ANALYSIS_MODAL_SLIDER_DEFAULTS', () => {
    it('defines valid positive defaults', () => {
      expect(CANONICAL_ANALYSIS_MODAL_SLIDER_DEFAULTS.minTimeLimitSeconds).toBe(1.0);
      expect(CANONICAL_ANALYSIS_MODAL_SLIDER_DEFAULTS.timeLimitStepSeconds).toBe(0.5);
      expect(CANONICAL_ANALYSIS_MODAL_SLIDER_DEFAULTS.depthStep).toBe(1);
    });
  });

  describe('CANONICAL_ANALYSIS_MODAL_CONFIG', () => {
    it('defines depth slider conforming to specifications: 1 to 20, step 1, defaultDepth', () => {
      const d = CANONICAL_ANALYSIS_MODAL_CONFIG.depthSlider;
      expect(d.min).toBe(1);
      expect(d.max).toBe(20);
      expect(d.step).toBe(1);
      expect(d.default).toBe(CANONICAL_ANALYSIS_CONFIG.search.defaultDepth);
      expect(d.default).toBeGreaterThanOrEqual(d.min);
      expect(d.default).toBeLessThanOrEqual(d.max);
    });

    it('defines time limit slider conforming to specifications: 1.0 to maxTimeLimitMs, step 0.5, defaultTimeLimitMs', () => {
      const tl = CANONICAL_ANALYSIS_MODAL_CONFIG.timeLimitSlider;
      expect(tl.min).toBe(1.0);
      expect(tl.max).toBe(CANONICAL_ANALYSIS_CONFIG.search.maxTimeLimitMs / 1000);
      expect(tl.step).toBe(0.5);
      expect(tl.default).toBeGreaterThanOrEqual(tl.min);
      expect(tl.default).toBeLessThanOrEqual(tl.max);
    });

    it('contains all required copy strings', () => {
      const c = CANONICAL_ANALYSIS_MODAL_CONFIG.copy;
      expect(c.title).toBeTruthy();
      expect(c.subtitle).toBeTruthy();
      expect(c.depthLabel).toBe('Depth');
      expect(c.timeLimitLabel).toBe('Time Limit (seconds)');
      expect(c.estimatedTimeLabel).toBe('Estimated Time');
      expect(c.startButtonText).toBe('Analyze');
      expect(c.cancelButtonText).toBe('Cancel');
    });

    it('contains estimation mathematical configuration', () => {
      const est = CANONICAL_ANALYSIS_MODAL_CONFIG.estimation;
      expect(est.baseMs).toBeGreaterThan(0);
      expect(est.branchingFactor).toBeGreaterThan(1);
      expect(est.minMsPerPosition).toBeGreaterThan(0);
      expect(est.lessThanOneSecondText).toBeTruthy();
    });
  });

  describe('resolveDefaultTimeLimitSeconds', () => {
    it('clamps millisecond inputs below slider min to 1.0s', () => {
      expect(resolveDefaultTimeLimitSeconds(250, 1.0, 5.0, 0.5)).toBe(1.0);
      expect(resolveDefaultTimeLimitSeconds(500, 1.0, 5.0, 0.5)).toBe(1.0);
    });

    it('steps values appropriately between min and max', () => {
      expect(resolveDefaultTimeLimitSeconds(1400, 1.0, 5.0, 0.5)).toBe(1.5);
      expect(resolveDefaultTimeLimitSeconds(1800, 1.0, 5.0, 0.5)).toBe(2.0);
      expect(resolveDefaultTimeLimitSeconds(2500, 1.0, 5.0, 0.5)).toBe(2.5);
      expect(resolveDefaultTimeLimitSeconds(4200, 1.0, 5.0, 0.5)).toBe(4.0);
    });

    it('clamps millisecond inputs above slider max', () => {
      expect(resolveDefaultTimeLimitSeconds(6000, 1.0, 5.0, 0.5)).toBe(5.0);
      expect(resolveDefaultTimeLimitSeconds(999999)).toBe(
        CANONICAL_ANALYSIS_CONFIG.search.maxTimeLimitMs / 1000
      );
    });

    it('throws AnalysisModalConfigError on invalid parameters', () => {
      expect(() => resolveDefaultTimeLimitSeconds(-10)).toThrow(AnalysisModalConfigError);
      expect(() => resolveDefaultTimeLimitSeconds(500, -1, 5, 0.5)).toThrow(AnalysisModalConfigError);
      expect(() => resolveDefaultTimeLimitSeconds(500, 5, 2, 0.5)).toThrow(AnalysisModalConfigError);
      expect(() => resolveDefaultTimeLimitSeconds(500, 1, 5, -0.5)).toThrow(AnalysisModalConfigError);
    });
  });

  describe('validateAnalysisModalConfig', () => {
    it('successfully validates CANONICAL_ANALYSIS_MODAL_CONFIG without throwing', () => {
      expect(() => validateAnalysisModalConfig(CANONICAL_ANALYSIS_MODAL_CONFIG)).not.toThrow();
    });

    it('throws when config is null or undefined', () => {
      expect(() => validateAnalysisModalConfig(null as unknown as AnalysisModalConfig)).toThrow(
        AnalysisModalConfigError
      );
    });

    it('throws when depthSlider bounds or defaults are invalid', () => {
      const invalidDepthConfig = {
        ...CANONICAL_ANALYSIS_MODAL_CONFIG,
        depthSlider: { min: 20, max: 10, step: 1, default: 15 },
      };
      expect(() => validateAnalysisModalConfig(invalidDepthConfig as AnalysisModalConfig)).toThrow(
        AnalysisModalConfigError
      );
    });

    it('throws when timeLimitSlider step is invalid', () => {
      const invalidTimeConfig = {
        ...CANONICAL_ANALYSIS_MODAL_CONFIG,
        timeLimitSlider: { min: 1.0, max: 5.0, step: -0.5, default: 2.0 },
      };
      expect(() => validateAnalysisModalConfig(invalidTimeConfig as AnalysisModalConfig)).toThrow(
        AnalysisModalConfigError
      );
    });

    it('throws when copy attributes are missing or empty', () => {
      const invalidCopyConfig = {
        ...CANONICAL_ANALYSIS_MODAL_CONFIG,
        copy: { ...CANONICAL_ANALYSIS_MODAL_CONFIG.copy, title: '' },
      };
      expect(() => validateAnalysisModalConfig(invalidCopyConfig as AnalysisModalConfig)).toThrow(
        AnalysisModalConfigError
      );
    });

    it('throws when estimation numeric parameters are invalid', () => {
      const invalidEstConfig = {
        ...CANONICAL_ANALYSIS_MODAL_CONFIG,
        estimation: { ...CANONICAL_ANALYSIS_MODAL_CONFIG.estimation, branchingFactor: 0.5 },
      };
      expect(() => validateAnalysisModalConfig(invalidEstConfig as AnalysisModalConfig)).toThrow(
        AnalysisModalConfigError
      );
    });
  });

  describe('calculateEstimatedAnalysisTime', () => {
    it('returns less than one second when positions and depth are very small', () => {
      // 0 moves = 1 position, depth 1
      const res = calculateEstimatedAnalysisTime(0, 1, 1.0);
      expect(res.humanReadable).toBe('< 1 second');
      expect(res.estimatedSeconds).toBeLessThan(1);
    });

    it('formats seconds correctly for intermediate game length', () => {
      // 20 moves = 21 positions, depth 6
      const res = calculateEstimatedAnalysisTime(20, 6, 1.0);
      expect(res.estimatedSeconds).toBeGreaterThan(0);
      expect(res.humanReadable).toMatch(/^~\d+ seconds?$/);
    });

    it('formats minutes and seconds correctly for larger search depth and moves', () => {
      // 60 moves = 61 positions, depth 16, time limit 2.5s (will saturate time limit)
      const res = calculateEstimatedAnalysisTime(60, 16, 2.5);
      expect(res.estimatedSeconds).toBeGreaterThanOrEqual(60);
      expect(res.humanReadable).toMatch(/^~\d+ min \d+ sec$|^~\d+ minutes?$/);
    });

    it('respects time limit ceiling per position', () => {
      // When depth is huge (e.g. 20), position time is capped by timeLimitSeconds
      const res1 = calculateEstimatedAnalysisTime(30, 20, 1.0);
      const res2 = calculateEstimatedAnalysisTime(30, 20, 5.0);
      expect(res2.estimatedSeconds).toBeGreaterThan(res1.estimatedSeconds);
      // For 31 positions, 1.0s limit = ~31s, 5.0s limit = ~155s
      expect(res1.estimatedSeconds).toBeCloseTo(31.0, 0);
      expect(res2.estimatedSeconds).toBeCloseTo(155.0, 0);
    });

    it('throws AnalysisModalConfigError on invalid estimation input arguments', () => {
      expect(() => calculateEstimatedAnalysisTime(-1, 6, 1.0)).toThrow(AnalysisModalConfigError);
      expect(() => calculateEstimatedAnalysisTime(10, 0, 1.0)).toThrow(AnalysisModalConfigError);
      expect(() => calculateEstimatedAnalysisTime(10, 6, -1.0)).toThrow(AnalysisModalConfigError);
      expect(() => calculateEstimatedAnalysisTime(10, 6, NaN)).toThrow(AnalysisModalConfigError);
    });
  });
});
