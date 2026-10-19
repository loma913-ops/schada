/**
 * Game Analysis Configuration.
 *
 * Centralizes all search budgets, 10-tier move quality thresholds,
 * badge formatting (hex & ANSI colors), and accuracy formulas.
 * Enforces strict configuration validation per AGENTS.md guidelines.
 */

export class AnalysisConfigError extends Error {
  constructor(message: string) {
    super(`AnalysisConfigError: ${message}`);
    this.name = 'AnalysisConfigError';
  }
}

export type MoveQuality =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'book'
  | 'inaccuracy'
  | 'mistake'
  | 'miss'
  | 'blunder';

export interface MoveQualityBadgeConfig {
  readonly symbol: string;
  readonly label: string;
  readonly hexColor: string;
  readonly ansiColor: string;
  readonly description: string;
}

export interface MoveQualityThresholdsConfig {
  readonly bestMoveDelta: number;
  readonly excellentDelta: number;
  readonly goodDelta: number;
  readonly inaccuracyDelta: number;
  readonly mistakeDelta: number;
  readonly blunderDelta: number;
  readonly missMinOpportunityAdvantage: number;
  readonly missMinDelta: number;
  readonly greatMoveSecondBestGap: number;
  readonly brilliantMinAdvantage: number;
}

export interface AnalysisSearchConfig {
  readonly defaultDepth: number;
  readonly postGameDepth: number;
  readonly minDepth: number;
  readonly maxDepth: number;
  readonly defaultTimeLimitMs: number;
  readonly postGameTimeLimitMs: number;
  readonly minTimeLimitMs: number;
  readonly maxTimeLimitMs: number;
  readonly masterTierLevel: number;
  readonly topCandidateMovesLimit: number;
}

export interface AnalysisAccuracyConfig {
  readonly winProbMultiplier: number;
  readonly evalCeiling: number;
  readonly modelCoefficients: {
    readonly a: number;
    readonly k: number;
    readonly b: number;
    readonly uncertaintyBonus: number;
  };
  readonly volatility: {
    readonly windowSizeDivisor: number;
    readonly minWindowSize: number;
    readonly maxWindowSize: number;
    readonly minWeight: number;
    readonly maxWeight: number;
  };
  readonly minAccuracy: number;
  readonly maxAccuracy: number;
  readonly perfectAccuracy: number;
  readonly accuracyDecimals: number;
}

export interface AnalysisCliFormattingConfig {
  readonly maxNotationDisplayWidth: number;
  readonly centipointsPerPoint: number;
  readonly evalDecimals: number;
  readonly lossDecimals: number;
  readonly tableColumnWidths: {
    readonly ply: number;
    readonly turn: number;
    readonly move: number;
    readonly badge: number;
    readonly eval: number;
    readonly loss: number;
    readonly altBest: number;
    readonly distributionCol: number;
    readonly countCol: number;
  };
}

export interface AnalysisConfig {
  readonly search: AnalysisSearchConfig;
  readonly thresholds: MoveQualityThresholdsConfig;
  readonly badges: Readonly<Record<MoveQuality, MoveQualityBadgeConfig>>;
  readonly accuracy: AnalysisAccuracyConfig;
  readonly formatting: AnalysisCliFormattingConfig;
}

export const CANONICAL_ANALYSIS_CONFIG: AnalysisConfig = Object.freeze({
  search: Object.freeze({
    defaultDepth: 6,
    postGameDepth: 2,
    minDepth: 1,
    maxDepth: 20,
    defaultTimeLimitMs: 250,
    postGameTimeLimitMs: 100,
    minTimeLimitMs: 10,
    maxTimeLimitMs: 15000,
    masterTierLevel: 8,
    topCandidateMovesLimit: 5,
  }),
  thresholds: Object.freeze({
    bestMoveDelta: 5,
    excellentDelta: 20,
    goodDelta: 50,
    inaccuracyDelta: 100,
    mistakeDelta: 250,
    blunderDelta: 250,
    missMinOpportunityAdvantage: 200,
    missMinDelta: 150,
    greatMoveSecondBestGap: 120,
    brilliantMinAdvantage: 80,
  }),
  badges: Object.freeze({
    brilliant: Object.freeze({
      symbol: '!!',
      label: 'Brilliant',
      hexColor: '#1bb5d8',
      ansiColor: '\x1b[36;1m',
      description: 'Exceptional top move with tactical brilliance or strategic sacrifice.',
    }),
    great: Object.freeze({
      symbol: '!',
      label: 'Great Move',
      hexColor: '#4b9ee8',
      ansiColor: '\x1b[34;1m',
      description: 'The sole saving or decisive move in a critical position.',
    }),
    best: Object.freeze({
      symbol: '★',
      label: 'Best Move',
      hexColor: '#85bf3b',
      ansiColor: '\x1b[32;1m',
      description: 'Optimal move according to deep engine analysis.',
    }),
    excellent: Object.freeze({
      symbol: '👍',
      label: 'Excellent',
      hexColor: '#9ecc56',
      ansiColor: '\x1b[92m',
      description: 'Nearly optimal play maintaining virtually all advantage.',
    }),
    good: Object.freeze({
      symbol: '✔',
      label: 'Good',
      hexColor: '#7fa650',
      ansiColor: '\x1b[32m',
      description: 'Solid practical move with modest evaluation concession.',
    }),
    book: Object.freeze({
      symbol: '📖',
      label: 'Book',
      hexColor: '#d4a373',
      ansiColor: '\x1b[33m',
      description: 'Recognized canonical opening variation from standard literature.',
    }),
    inaccuracy: Object.freeze({
      symbol: '?!',
      label: 'Inaccuracy',
      hexColor: '#f0c239',
      ansiColor: '\x1b[93m',
      description: 'Suboptimal move that weakens positional grip.',
    }),
    mistake: Object.freeze({
      symbol: '?',
      label: 'Mistake',
      hexColor: '#e58f2a',
      ansiColor: '\x1b[38;5;208m',
      description: 'Noticeable error substantially reducing winning prospects.',
    }),
    miss: Object.freeze({
      symbol: '✖',
      label: 'Miss',
      hexColor: '#e85d56',
      ansiColor: '\x1b[38;5;203;1m',
      description: 'Overlooked a winning tactical strike or breakthrough.',
    }),
    blunder: Object.freeze({
      symbol: '??',
      label: 'Blunder',
      hexColor: '#db3236',
      ansiColor: '\x1b[31;1m',
      description: 'Catastrophic move severely compromising or losing the match.',
    }),
  }),
  accuracy: Object.freeze({
    winProbMultiplier: -0.00368208,
    evalCeiling: 1000,
    modelCoefficients: Object.freeze({
      a: 103.1668100711649,
      k: 0.04354415386753951,
      b: -3.166924740191411,
      uncertaintyBonus: 1.0,
    }),
    volatility: Object.freeze({
      windowSizeDivisor: 10,
      minWindowSize: 2,
      maxWindowSize: 8,
      minWeight: 0.5,
      maxWeight: 12,
    }),
    minAccuracy: 0,
    maxAccuracy: 100,
    perfectAccuracy: 100,
    accuracyDecimals: 1,
  }),
  formatting: Object.freeze({
    maxNotationDisplayWidth: 10,
    centipointsPerPoint: 100,
    evalDecimals: 2,
    lossDecimals: 2,
    tableColumnWidths: Object.freeze({
      ply: 6,
      turn: 6,
      move: 10,
      badge: 25,
      eval: 8,
      loss: 8,
      altBest: 30,
      distributionCol: 20,
      countCol: 6,
    }),
  }),
});

/**
 * Validates the complete Analysis Configuration.
 * Throws AnalysisConfigError if any values are missing, invalid, or out of bounds.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time across fixed config fields.
 * - Auxiliary Space Complexity: O(1) constant memory.
 *
 * Growth Rate:
 * - O(1) strictly bounded, executing instantaneously with zero allocations.
 */
export function validateAnalysisConfig(config: AnalysisConfig): void {
  if (!config || typeof config !== 'object') {
    throw new AnalysisConfigError('Analysis configuration is missing or null.');
  }

  // Validate Search Config
  const s = config.search;
  if (!s || typeof s !== 'object') {
    throw new AnalysisConfigError('Search configuration section is missing.');
  }
  if (!Number.isInteger(s.defaultDepth) || s.defaultDepth < s.minDepth || s.defaultDepth > s.maxDepth) {
    throw new AnalysisConfigError(
      `Invalid defaultDepth ${s.defaultDepth}: must be an integer between ${s.minDepth} and ${s.maxDepth}.`
    );
  }
  if (!Number.isInteger(s.postGameDepth) || s.postGameDepth < s.minDepth || s.postGameDepth > s.maxDepth) {
    throw new AnalysisConfigError(
      `Invalid postGameDepth ${s.postGameDepth}: must be an integer between ${s.minDepth} and ${s.maxDepth}.`
    );
  }
  if (
    typeof s.defaultTimeLimitMs !== 'number' ||
    s.defaultTimeLimitMs < s.minTimeLimitMs ||
    s.defaultTimeLimitMs > s.maxTimeLimitMs
  ) {
    throw new AnalysisConfigError(
      `Invalid defaultTimeLimitMs ${s.defaultTimeLimitMs}: must be between ${s.minTimeLimitMs} and ${s.maxTimeLimitMs}.`
    );
  }
  if (
    typeof s.postGameTimeLimitMs !== 'number' ||
    s.postGameTimeLimitMs < s.minTimeLimitMs ||
    s.postGameTimeLimitMs > s.maxTimeLimitMs
  ) {
    throw new AnalysisConfigError(
      `Invalid postGameTimeLimitMs ${s.postGameTimeLimitMs}: must be between ${s.minTimeLimitMs} and ${s.maxTimeLimitMs}.`
    );
  }
  if (!Number.isInteger(s.masterTierLevel) || s.masterTierLevel <= 0) {
    throw new AnalysisConfigError(`Invalid masterTierLevel ${s.masterTierLevel}: must be a positive integer.`);
  }
  if (!Number.isInteger(s.topCandidateMovesLimit) || s.topCandidateMovesLimit <= 0) {
    throw new AnalysisConfigError(
      `Invalid topCandidateMovesLimit ${s.topCandidateMovesLimit}: must be a positive integer.`
    );
  }

  // Validate Thresholds
  const t = config.thresholds;
  if (!t || typeof t !== 'object') {
    throw new AnalysisConfigError('Thresholds configuration section is missing.');
  }
  if (t.bestMoveDelta < 0 || t.excellentDelta <= t.bestMoveDelta || t.goodDelta <= t.excellentDelta) {
    throw new AnalysisConfigError('Threshold deltas must be strictly monotonically increasing (best < excellent < good).');
  }
  if (t.inaccuracyDelta <= t.goodDelta || t.mistakeDelta <= t.inaccuracyDelta) {
    throw new AnalysisConfigError(
      'Threshold deltas must be strictly monotonically increasing (good < inaccuracy < mistake).'
    );
  }
  if (t.blunderDelta < t.mistakeDelta) {
    throw new AnalysisConfigError('blunderDelta must be greater than or equal to mistakeDelta.');
  }
  if (t.missMinDelta <= 0 || t.missMinOpportunityAdvantage <= 0) {
    throw new AnalysisConfigError('Miss thresholds must be positive values.');
  }
  if (t.greatMoveSecondBestGap <= 0 || t.brilliantMinAdvantage <= 0) {
    throw new AnalysisConfigError('Great move and brilliant thresholds must be positive values.');
  }

  // Validate Badges
  const requiredQualities: MoveQuality[] = [
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
  ];
  if (!config.badges || typeof config.badges !== 'object') {
    throw new AnalysisConfigError('Badges configuration dictionary is missing.');
  }
  for (const q of requiredQualities) {
    const badge = config.badges[q];
    if (!badge || typeof badge !== 'object') {
      throw new AnalysisConfigError(`Badge configuration missing for quality "${q}".`);
    }
    if (!badge.symbol || typeof badge.symbol !== 'string') {
      throw new AnalysisConfigError(`Badge "${q}" has missing or invalid symbol.`);
    }
    if (!badge.label || typeof badge.label !== 'string') {
      throw new AnalysisConfigError(`Badge "${q}" has missing or invalid label.`);
    }
    if (!badge.hexColor || !badge.hexColor.startsWith('#')) {
      throw new AnalysisConfigError(`Badge "${q}" has invalid hexColor "${badge.hexColor}".`);
    }
    if (typeof badge.ansiColor !== 'string') {
      throw new AnalysisConfigError(`Badge "${q}" has invalid ansiColor.`);
    }
  }

  // Validate Accuracy Config (Schada empirical model)
  const a = config.accuracy;
  if (!a || typeof a !== 'object') {
    throw new AnalysisConfigError('Accuracy configuration section is missing.');
  }
  if (typeof a.winProbMultiplier !== 'number' || a.winProbMultiplier >= 0) {
    throw new AnalysisConfigError('Invalid winProbMultiplier: must be a negative number.');
  }
  if (!Number.isInteger(a.evalCeiling) || a.evalCeiling <= 0) {
    throw new AnalysisConfigError('Invalid evalCeiling: must be a positive integer.');
  }
  if (!a.modelCoefficients || typeof a.modelCoefficients !== 'object') {
    throw new AnalysisConfigError('Accuracy modelCoefficients section is missing.');
  }
  const mc = a.modelCoefficients;
  if (mc.a <= 0 || mc.k <= 0 || typeof mc.b !== 'number' || mc.uncertaintyBonus < 0) {
    throw new AnalysisConfigError('Invalid modelCoefficients parameters in accuracy configuration.');
  }
  if (!a.volatility || typeof a.volatility !== 'object') {
    throw new AnalysisConfigError('Accuracy volatility section is missing.');
  }
  const vol = a.volatility;
  if (
    vol.windowSizeDivisor <= 0 ||
    vol.minWindowSize <= 0 ||
    vol.maxWindowSize < vol.minWindowSize ||
    vol.minWeight <= 0 ||
    vol.maxWeight < vol.minWeight
  ) {
    throw new AnalysisConfigError('Invalid volatility sliding window parameters in accuracy configuration.');
  }
  if (a.minAccuracy < 0 || a.maxAccuracy <= a.minAccuracy || a.perfectAccuracy > a.maxAccuracy) {
    throw new AnalysisConfigError('Invalid accuracy scaling bounds.');
  }
  if (!Number.isInteger(a.accuracyDecimals) || a.accuracyDecimals < 0) {
    throw new AnalysisConfigError('Invalid accuracyDecimals: must be a non-negative integer.');
  }

  // Validate Formatting Config
  const f = config.formatting;
  if (!f || typeof f !== 'object') {
    throw new AnalysisConfigError('Formatting configuration section is missing.');
  }
  if (!Number.isInteger(f.maxNotationDisplayWidth) || f.maxNotationDisplayWidth <= 0) {
    throw new AnalysisConfigError('Invalid maxNotationDisplayWidth: must be a positive integer.');
  }
  if (f.centipointsPerPoint <= 0 || f.evalDecimals < 0 || f.lossDecimals < 0) {
    throw new AnalysisConfigError('Invalid numerical formatting parameters in config.');
  }
  const widths = f.tableColumnWidths;
  if (
    !widths ||
    widths.ply <= 0 ||
    widths.turn <= 0 ||
    widths.move <= 0 ||
    widths.badge <= 0 ||
    widths.eval <= 0 ||
    widths.loss <= 0 ||
    widths.altBest <= 0 ||
    widths.distributionCol <= 0 ||
    widths.countCol <= 0
  ) {
    throw new AnalysisConfigError('Invalid table column widths in formatting configuration.');
  }
}

// Initial self-validation of the canonical configuration
validateAnalysisConfig(CANONICAL_ANALYSIS_CONFIG);
