import { CANONICAL_ANALYSIS_CONFIG } from '@/core/analysis/analysisConfig';

/**
 * Analysis Settings Modal Configuration and Validator.
 *
 * Centralizes slider ranges, default depths, time limits,
 * copy strings, and the estimated duration calculation model.
 * Enforces strict configuration validation per AGENTS.md guidelines.
 */

export class AnalysisModalConfigError extends Error {
  constructor(message: string) {
    super(`AnalysisModalConfigError: ${message}`);
    this.name = 'AnalysisModalConfigError';
  }
}

export interface AnalysisModalSliderConfig {
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly default: number;
}

export interface AnalysisModalCopyConfig {
  readonly title: string;
  readonly subtitle: string;
  readonly depthLabel: string;
  readonly timeLimitLabel: string;
  readonly estimatedTimeLabel: string;
  readonly movesCountPrefix: string;
  readonly movesCountSuffix: string;
  readonly startButtonText: string;
  readonly cancelButtonText: string;
  readonly closeButtonAriaLabel: string;
}

export interface AnalysisEstimationConfig {
  readonly baseMs: number;
  readonly branchingFactor: number;
  readonly minMsPerPosition: number;
  readonly lessThanOneSecondText: string;
  readonly secondUnitSingular: string;
  readonly secondUnitPlural: string;
  readonly minuteUnitSingular: string;
  readonly minuteUnitPlural: string;
  readonly minuteAbbr: string;
  readonly secondAbbr: string;
  readonly approxPrefix: string;
}

export interface AnalysisModalConfig {
  readonly depthSlider: AnalysisModalSliderConfig;
  readonly timeLimitSlider: AnalysisModalSliderConfig;
  readonly copy: AnalysisModalCopyConfig;
  readonly estimation: AnalysisEstimationConfig;
}

export interface AnalysisModalSliderDefaultsConfig {
  readonly minTimeLimitSeconds: number;
  readonly timeLimitStepSeconds: number;
  readonly depthStep: number;
}

export const CANONICAL_ANALYSIS_MODAL_SLIDER_DEFAULTS: AnalysisModalSliderDefaultsConfig = Object.freeze({
  minTimeLimitSeconds: 1.0,
  timeLimitStepSeconds: 0.5,
  depthStep: 1,
});

/**
 * Dynamically resolves the default time limit in seconds clamped to the slider bounds
 * and rounded to the nearest step.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time arithmetic calculation.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) strictly bounded calculation.
 */
export function resolveDefaultTimeLimitSeconds(
  timeLimitMs: number = CANONICAL_ANALYSIS_CONFIG.search.defaultTimeLimitMs,
  sliderMin: number = CANONICAL_ANALYSIS_MODAL_SLIDER_DEFAULTS.minTimeLimitSeconds,
  sliderMax: number = CANONICAL_ANALYSIS_CONFIG.search.maxTimeLimitMs / 1000,
  sliderStep: number = CANONICAL_ANALYSIS_MODAL_SLIDER_DEFAULTS.timeLimitStepSeconds
): number {
  if (typeof timeLimitMs !== 'number' || !Number.isFinite(timeLimitMs) || timeLimitMs <= 0) {
    throw new AnalysisModalConfigError(
      `Invalid timeLimitMs: expected positive finite number but received ${timeLimitMs}`
    );
  }
  if (typeof sliderMin !== 'number' || !Number.isFinite(sliderMin) || sliderMin <= 0) {
    throw new AnalysisModalConfigError(
      `Invalid sliderMin: expected positive finite number but received ${sliderMin}`
    );
  }
  if (typeof sliderMax !== 'number' || !Number.isFinite(sliderMax) || sliderMax <= sliderMin) {
    throw new AnalysisModalConfigError(
      `Invalid sliderMax: must be greater than sliderMin (${sliderMin}) but received ${sliderMax}`
    );
  }
  if (typeof sliderStep !== 'number' || !Number.isFinite(sliderStep) || sliderStep <= 0) {
    throw new AnalysisModalConfigError(
      `Invalid sliderStep: expected positive finite number but received ${sliderStep}`
    );
  }

  const inSeconds = timeLimitMs / 1000;
  const clamped = Math.min(sliderMax, Math.max(sliderMin, inSeconds));
  const stepped = Math.round((clamped - sliderMin) / sliderStep) * sliderStep + sliderMin;
  return Number(stepped.toFixed(1));
}

export const CANONICAL_ANALYSIS_MODAL_CONFIG: AnalysisModalConfig = Object.freeze({
  depthSlider: Object.freeze({
    min: CANONICAL_ANALYSIS_CONFIG.search.minDepth,
    max: CANONICAL_ANALYSIS_CONFIG.search.maxDepth,
    step: CANONICAL_ANALYSIS_MODAL_SLIDER_DEFAULTS.depthStep,
    default: CANONICAL_ANALYSIS_CONFIG.search.defaultDepth,
  }),
  timeLimitSlider: Object.freeze({
    min: CANONICAL_ANALYSIS_MODAL_SLIDER_DEFAULTS.minTimeLimitSeconds,
    max: CANONICAL_ANALYSIS_CONFIG.search.maxTimeLimitMs / 1000,
    step: CANONICAL_ANALYSIS_MODAL_SLIDER_DEFAULTS.timeLimitStepSeconds,
    default: resolveDefaultTimeLimitSeconds(
      CANONICAL_ANALYSIS_CONFIG.search.defaultTimeLimitMs,
      CANONICAL_ANALYSIS_MODAL_SLIDER_DEFAULTS.minTimeLimitSeconds,
      CANONICAL_ANALYSIS_CONFIG.search.maxTimeLimitMs / 1000,
      CANONICAL_ANALYSIS_MODAL_SLIDER_DEFAULTS.timeLimitStepSeconds
    ),
  }),
  copy: Object.freeze({
    title: 'Game Analysis',
    subtitle: 'Configure engine search depth and time limits for full match review.',
    depthLabel: 'Depth',
    timeLimitLabel: 'Time Limit (seconds)',
    estimatedTimeLabel: 'Estimated Time',
    movesCountPrefix: 'based on',
    movesCountSuffix: 'moves',
    startButtonText: 'Analyze',
    cancelButtonText: 'Cancel',
    closeButtonAriaLabel: 'Close analysis settings',
  }),
  estimation: Object.freeze({
    baseMs: 15,
    branchingFactor: 1.6,
    minMsPerPosition: 25,
    lessThanOneSecondText: '< 1 second',
    secondUnitSingular: 'second',
    secondUnitPlural: 'seconds',
    minuteUnitSingular: 'minute',
    minuteUnitPlural: 'minutes',
    minuteAbbr: 'min',
    secondAbbr: 'sec',
    approxPrefix: '~',
  }),
});

/**
 * Validates the Analysis Modal configuration.
 * Throws AnalysisModalConfigError if any required sections or values are invalid.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time checks across static object attributes.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 */
export function validateAnalysisModalConfig(config: AnalysisModalConfig): void {
  if (!config || typeof config !== 'object') {
    throw new AnalysisModalConfigError('Configuration object is missing or null.');
  }

  // Validate depth slider
  const d = config.depthSlider;
  if (!d || typeof d !== 'object') {
    throw new AnalysisModalConfigError('depthSlider section is missing.');
  }
  if (
    typeof d.min !== 'number' ||
    typeof d.max !== 'number' ||
    typeof d.step !== 'number' ||
    typeof d.default !== 'number' ||
    d.min <= 0 ||
    d.max <= d.min ||
    d.step <= 0 ||
    d.default < d.min ||
    d.default > d.max
  ) {
    throw new AnalysisModalConfigError('Invalid depthSlider bounds, step, or default value.');
  }

  // Validate time limit slider
  const tl = config.timeLimitSlider;
  if (!tl || typeof tl !== 'object') {
    throw new AnalysisModalConfigError('timeLimitSlider section is missing.');
  }
  if (
    typeof tl.min !== 'number' ||
    typeof tl.max !== 'number' ||
    typeof tl.step !== 'number' ||
    typeof tl.default !== 'number' ||
    tl.min <= 0 ||
    tl.max <= tl.min ||
    tl.step <= 0 ||
    tl.default < tl.min ||
    tl.default > tl.max
  ) {
    throw new AnalysisModalConfigError('Invalid timeLimitSlider bounds, step, or default value.');
  }

  // Validate copy
  const c = config.copy;
  if (!c || typeof c !== 'object') {
    throw new AnalysisModalConfigError('Copy configuration section is missing.');
  }
  const copyKeys: (keyof AnalysisModalCopyConfig)[] = [
    'title',
    'subtitle',
    'depthLabel',
    'timeLimitLabel',
    'estimatedTimeLabel',
    'movesCountPrefix',
    'movesCountSuffix',
    'startButtonText',
    'cancelButtonText',
    'closeButtonAriaLabel',
  ];
  for (const key of copyKeys) {
    if (typeof c[key] !== 'string' || c[key].trim().length === 0) {
      throw new AnalysisModalConfigError(`Invalid copy.${key}: expected non-empty string.`);
    }
  }

  // Validate estimation
  const est = config.estimation;
  if (!est || typeof est !== 'object') {
    throw new AnalysisModalConfigError('Estimation configuration section is missing.');
  }
  if (
    typeof est.baseMs !== 'number' ||
    est.baseMs <= 0 ||
    typeof est.branchingFactor !== 'number' ||
    est.branchingFactor <= 1 ||
    typeof est.minMsPerPosition !== 'number' ||
    est.minMsPerPosition <= 0
  ) {
    throw new AnalysisModalConfigError('Invalid estimation numerical parameters.');
  }

  const estStringKeys: (keyof AnalysisEstimationConfig)[] = [
    'lessThanOneSecondText',
    'secondUnitSingular',
    'secondUnitPlural',
    'minuteUnitSingular',
    'minuteUnitPlural',
    'minuteAbbr',
    'secondAbbr',
    'approxPrefix',
  ];
  for (const key of estStringKeys) {
    if (typeof est[key] !== 'string' || est[key].trim().length === 0) {
      throw new AnalysisModalConfigError(`Invalid estimation.${key}: expected non-empty string.`);
    }
  }
}

validateAnalysisModalConfig(CANONICAL_ANALYSIS_MODAL_CONFIG);

export interface EstimatedAnalysisTimeResult {
  readonly estimatedSeconds: number;
  readonly humanReadable: string;
}

/**
 * Calculates estimated analysis time in human readable terms based on move count,
 * search depth, and time limit per move.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time arithmetic calculation.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) execution time independent of game move history length.
 */
export function calculateEstimatedAnalysisTime(
  totalMoves: number,
  depth: number,
  timeLimitSeconds: number,
  config: AnalysisModalConfig = CANONICAL_ANALYSIS_MODAL_CONFIG
): EstimatedAnalysisTimeResult {
  validateAnalysisModalConfig(config);

  if (typeof totalMoves !== 'number' || !Number.isFinite(totalMoves) || totalMoves < 0) {
    throw new AnalysisModalConfigError(
      `Invalid totalMoves: expected non-negative finite number, got ${totalMoves}`
    );
  }
  if (typeof depth !== 'number' || !Number.isFinite(depth) || depth <= 0) {
    throw new AnalysisModalConfigError(
      `Invalid depth: expected positive finite number, got ${depth}`
    );
  }
  if (typeof timeLimitSeconds !== 'number' || !Number.isFinite(timeLimitSeconds) || timeLimitSeconds <= 0) {
    throw new AnalysisModalConfigError(
      `Invalid timeLimitSeconds: expected positive finite number, got ${timeLimitSeconds}`
    );
  }

  const totalPositions = Math.max(1, totalMoves + 1);
  const est = config.estimation;

  // Search cost model: min(timeLimitMs, max(minMs, baseMs * branchingFactor^depth))
  const theoreticalMs = est.baseMs * Math.pow(est.branchingFactor, depth);
  const positionMs = Math.min(timeLimitSeconds * 1000, Math.max(est.minMsPerPosition, theoreticalMs));
  const totalSeconds = (totalPositions * positionMs) / 1000;

  let humanReadable: string;
  if (totalSeconds < 1) {
    humanReadable = est.lessThanOneSecondText;
  } else if (totalSeconds < 60) {
    const sec = Math.max(1, Math.round(totalSeconds));
    humanReadable = `${est.approxPrefix}${sec} ${sec === 1 ? est.secondUnitSingular : est.secondUnitPlural}`;
  } else {
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.round(totalSeconds % 60);
    if (secs === 0) {
      humanReadable = `${est.approxPrefix}${mins} ${mins === 1 ? est.minuteUnitSingular : est.minuteUnitPlural}`;
    } else {
      humanReadable = `${est.approxPrefix}${mins} ${est.minuteAbbr} ${secs} ${est.secondAbbr}`;
    }
  }

  return {
    estimatedSeconds: Number(totalSeconds.toFixed(1)),
    humanReadable,
  };
}
