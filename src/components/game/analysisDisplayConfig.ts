import type { MoveQuality } from '@/core/analysis/analysisConfig';

/**
 * Move Quality Badges and Analysis Display Configuration.
 *
 * Centralizes the list of qualities authorized to be rendered as symbols
 * next to move notations, badge sizing, spacing, and header action copy.
 * Enforces strict configuration validation per AGENTS.md guidelines.
 */

export class AnalysisDisplayConfigError extends Error {
  constructor(message: string) {
    super(`AnalysisDisplayConfigError: ${message}`);
    this.name = 'AnalysisDisplayConfigError';
  }
}

export interface AnalysisDisplayCopyConfig {
  readonly analyzingPrefix: string;
  readonly reanalyzeButtonText: string;
  readonly cancelButtonText: string;
  readonly cancelAriaLabel: string;
}

export interface AnalysisDisplayConfig {
  /**
   * Strictly permits only the 6 authorized quality categories
   * to display symbols next to move notations (excluding best, excellent, good, book).
   */
  readonly displayedQualities: readonly MoveQuality[];
  readonly badgeSizePx: number;
  readonly badgeGapPx: number;
  readonly copy: AnalysisDisplayCopyConfig;
}

export const CANONICAL_ANALYSIS_DISPLAY_CONFIG: AnalysisDisplayConfig = Object.freeze({
  displayedQualities: Object.freeze([
    'brilliant',
    'great',
    'inaccuracy',
    'mistake',
    'miss',
    'blunder',
  ] as const),
  badgeSizePx: 18,
  badgeGapPx: 6,
  copy: Object.freeze({
    analyzingPrefix: 'Analyzing',
    reanalyzeButtonText: 'Re-analyze',
    cancelButtonText: 'Cancel',
    cancelAriaLabel: 'Cancel active analysis',
  }),
});

/**
 * Validates the Analysis Display configuration.
 * Throws AnalysisDisplayConfigError if any required sections or values are invalid.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(Q) where Q is the number of displayedQualities (bounded by constant 10).
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) strictly bounded validation time.
 */
export function validateAnalysisDisplayConfig(config: AnalysisDisplayConfig): void {
  if (!config || typeof config !== 'object') {
    throw new AnalysisDisplayConfigError('Configuration object is missing or null.');
  }

  if (!Array.isArray(config.displayedQualities) || config.displayedQualities.length === 0) {
    throw new AnalysisDisplayConfigError('displayedQualities must be a non-empty array.');
  }

  const validQualities = new Set<MoveQuality>([
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
  ]);

  for (const q of config.displayedQualities) {
    if (!validQualities.has(q)) {
      throw new AnalysisDisplayConfigError(`Unknown move quality "${q}" in displayedQualities.`);
    }
  }

  if (typeof config.badgeSizePx !== 'number' || config.badgeSizePx <= 0) {
    throw new AnalysisDisplayConfigError('badgeSizePx must be a positive number.');
  }

  if (typeof config.badgeGapPx !== 'number' || config.badgeGapPx < 0) {
    throw new AnalysisDisplayConfigError('badgeGapPx must be a non-negative number.');
  }

  const c = config.copy;
  if (!c || typeof c !== 'object') {
    throw new AnalysisDisplayConfigError('Copy configuration section is missing.');
  }

  const copyKeys: (keyof AnalysisDisplayCopyConfig)[] = [
    'analyzingPrefix',
    'reanalyzeButtonText',
    'cancelButtonText',
    'cancelAriaLabel',
  ];

  for (const key of copyKeys) {
    if (typeof c[key] !== 'string' || c[key].trim().length === 0) {
      throw new AnalysisDisplayConfigError(`Invalid copy.${key}: expected non-empty string.`);
    }
  }
}

validateAnalysisDisplayConfig(CANONICAL_ANALYSIS_DISPLAY_CONFIG);
