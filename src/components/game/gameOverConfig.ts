import type { WinReason } from '@/core/schada/types';
import type { MoveQuality } from '@/core/analysis/analysisConfig';

/**
 * Game Over Modal Configuration and Validator.
 *
 * Centralizes layout specifications, typography, score table column fractions,
 * move quality distribution tiers, and user-facing copy strings for victory, draw,
 * reason descriptions, and accuracy metrics.
 * Validates configuration to eliminate hard-coded fallback values.
 */

export class GameOverModalConfigError extends Error {
  constructor(message: string) {
    super(`GameOverModalConfigError: ${message}`);
    this.name = 'GameOverModalConfigError';
  }
}

export interface GameOverModalConfig {
  readonly layout: {
    readonly gridColumnsRanked: string;
    readonly gridColumnsUnranked: string;
    readonly distributionQualities: readonly MoveQuality[];
    readonly badgeSizePx: number;
    readonly maxModalHeightVh: number;
  };
  readonly copy: {
    readonly victoryTitle: string;
    readonly drawTitle: string;
    readonly defaultGameOverTitle: string;
    readonly ratingChangeLabel: string;
    readonly defaultGameCompletedText: string;
    readonly rematchButtonText: string;
    readonly lobbyButtonText: string;
    readonly reviewButtonText: string;
    readonly closeButtonAriaLabel: string;
    readonly distributionTitle: string;
    readonly classificationHeader: string;
    readonly accuracyLabel: string;
    readonly analyzingLabel: string;
    readonly categoryHeader: string;
    readonly goalScoreLabel: string;
    readonly outsideHighPiecesLabel: string;
    readonly rankDistanceLabel: string;
    readonly defaultWhitePlayerName: string;
    readonly defaultBlackPlayerName: string;
    readonly winnerTitleSuffix: string;
    readonly winReasons: Record<WinReason, string>;
  };
}

/**
 * Validates the Game Over modal configuration.
 * Throws GameOverModalConfigError if config is missing, null, or has empty/invalid values.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(Q) where Q is the number of distribution qualities (bounded by constant 10).
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant.
 */
export function validateGameOverModalConfig(config: GameOverModalConfig): void {
  if (!config) {
    throw new GameOverModalConfigError('Configuration object is missing or null.');
  }

  if (
    !config.layout ||
    typeof config.layout.gridColumnsRanked !== 'string' ||
    config.layout.gridColumnsRanked.trim().length === 0
  ) {
    throw new GameOverModalConfigError('Invalid layout.gridColumnsRanked: expected non-empty string.');
  }

  if (
    typeof config.layout.gridColumnsUnranked !== 'string' ||
    config.layout.gridColumnsUnranked.trim().length === 0
  ) {
    throw new GameOverModalConfigError('Invalid layout.gridColumnsUnranked: expected non-empty string.');
  }

  if (
    !Array.isArray(config.layout.distributionQualities) ||
    config.layout.distributionQualities.length === 0
  ) {
    throw new GameOverModalConfigError('Invalid layout.distributionQualities: expected non-empty array.');
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

  for (const q of config.layout.distributionQualities) {
    if (!validQualities.has(q)) {
      throw new GameOverModalConfigError(`Unknown move quality "${q}" in layout.distributionQualities.`);
    }
  }

  if (typeof config.layout.badgeSizePx !== 'number' || config.layout.badgeSizePx <= 0) {
    throw new GameOverModalConfigError('Invalid layout.badgeSizePx: must be a positive number.');
  }

  if (typeof config.layout.maxModalHeightVh !== 'number' || config.layout.maxModalHeightVh <= 0) {
    throw new GameOverModalConfigError('Invalid layout.maxModalHeightVh: must be a positive number.');
  }

  if (!config.copy) {
    throw new GameOverModalConfigError('Copy configuration section is missing.');
  }

  const requiredCopyKeys: (keyof GameOverModalConfig['copy'])[] = [
    'victoryTitle',
    'drawTitle',
    'defaultGameOverTitle',
    'ratingChangeLabel',
    'defaultGameCompletedText',
    'rematchButtonText',
    'lobbyButtonText',
    'reviewButtonText',
    'closeButtonAriaLabel',
    'distributionTitle',
    'classificationHeader',
    'accuracyLabel',
    'analyzingLabel',
    'categoryHeader',
    'goalScoreLabel',
    'outsideHighPiecesLabel',
    'rankDistanceLabel',
    'winnerTitleSuffix',
  ];

  for (const key of requiredCopyKeys) {
    const val = config.copy[key];
    if (typeof val !== 'string' || val.trim().length === 0) {
      throw new GameOverModalConfigError(`Invalid copy.${key}: expected non-empty string.`);
    }
  }

  if (
    typeof config.copy.defaultWhitePlayerName !== 'string' ||
    config.copy.defaultWhitePlayerName.trim().length === 0
  ) {
    throw new GameOverModalConfigError('Invalid copy.defaultWhitePlayerName: expected non-empty string.');
  }

  if (
    typeof config.copy.defaultBlackPlayerName !== 'string' ||
    config.copy.defaultBlackPlayerName.trim().length === 0
  ) {
    throw new GameOverModalConfigError('Invalid copy.defaultBlackPlayerName: expected non-empty string.');
  }

  if (!config.copy.winReasons || typeof config.copy.winReasons !== 'object') {
    throw new GameOverModalConfigError('Invalid copy.winReasons: expected object.');
  }

  const requiredWinReasons: WinReason[] = [
    'goal_reached',
    'elimination',
    'timeout',
    'resignation',
    'repetition',
    'blocked',
    'mutual_shuffle',
    'agreement',
    'abandonment',
  ];

  for (const reason of requiredWinReasons) {
    const text = config.copy.winReasons[reason];
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new GameOverModalConfigError(`Invalid copy.winReasons.${reason}: expected non-empty string.`);
    }
  }
}

/**
 * Canonical Game Over modal configuration.
 */
export const GAME_OVER_MODAL_CONFIG: GameOverModalConfig = {
  layout: {
    gridColumnsRanked: '1.4fr 1.3fr 1.3fr',
    gridColumnsUnranked: '2fr 1fr 1fr',
    distributionQualities: [
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
    ],
    badgeSizePx: 16,
    maxModalHeightVh: 90,
  },
  copy: {
    victoryTitle: 'Victory!',
    drawTitle: 'Draw Game',
    defaultGameOverTitle: 'Game Over',
    ratingChangeLabel: 'Rating change:',
    defaultGameCompletedText: 'Game completed',
    rematchButtonText: 'Rematch',
    lobbyButtonText: 'Lobby',
    reviewButtonText: 'Review',
    closeButtonAriaLabel: 'Close game over modal',
    distributionTitle: 'Move Quality Distribution',
    classificationHeader: 'Classification',
    accuracyLabel: 'Accuracy',
    analyzingLabel: 'Analyzing match...',
    categoryHeader: 'Category',
    goalScoreLabel: 'Goal Line Points',
    outsideHighPiecesLabel: 'Outside High Pieces',
    rankDistanceLabel: 'Rank Distance',
    defaultWhitePlayerName: 'White',
    defaultBlackPlayerName: 'Black',
    winnerTitleSuffix: 'Won',
    winReasons: {
      goal_reached: 'All remaining high pieces reached the goal line',
      elimination: 'Opponent has no legal moves remaining (eliminated / immobilized)',
      timeout: 'Victory on time',
      resignation: 'Opponent resigned',
      repetition: 'Draw by 3-fold repetition',
      blocked: 'Game ended: High pieces blocked by opponent',
      mutual_shuffle: 'Game ended: Mutual consecutive shuffling',
      agreement: 'Draw agreed',
      abandonment: 'Opponent abandoned the game',
    },
  },
};

// Validate canonical configuration at module initialization
validateGameOverModalConfig(GAME_OVER_MODAL_CONFIG);
