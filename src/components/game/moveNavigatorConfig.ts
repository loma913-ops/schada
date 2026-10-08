/**
 * Move Navigator Configuration and State Validator.
 *
 * Centralizes accessibility aria-labels, tooltips, keyboard shortcuts,
 * notation copy, and navigation index boundaries.
 * Validates configuration to eliminate hard-coded fallback values.
 */

export class MoveNavigatorConfigError extends Error {
  constructor(message: string) {
    super(`MoveNavigatorConfigError: ${message}`);
    this.name = 'MoveNavigatorConfigError';
  }
}

export interface MoveNavigatorButtonCopy {
  readonly startOfGame: string;
  readonly previousMove: string;
  readonly nextMove: string;
  readonly endOfGame: string;
}

export interface MoveNavigatorHistoryCopy {
  readonly headerTitle: string;
  readonly emptyHistoryMessage: string;
  readonly analyzeButtonText: string;
  readonly analyzeButtonAriaLabel: string;
}

export interface MoveNavigatorConfig {
  readonly startMoveIndex: number;
  readonly historyCopy: MoveNavigatorHistoryCopy;
  readonly ariaLabels: {
    readonly toolbar: string;
    readonly buttons: MoveNavigatorButtonCopy;
  };
  readonly tooltips: MoveNavigatorButtonCopy;
  readonly keyboardShortcuts: {
    readonly previous: readonly string[];
    readonly next: readonly string[];
    readonly start: readonly string[];
    readonly end: readonly string[];
  };
}

/**
 * Validates the MoveNavigator configuration.
 * Throws MoveNavigatorConfigError if config is missing, null, or contains invalid parameters.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time, verifying static object properties.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant.
 */
export function validateMoveNavigatorConfig(config: MoveNavigatorConfig): void {
  if (!config) {
    throw new MoveNavigatorConfigError('Configuration object is missing or null.');
  }

  if (typeof config.startMoveIndex !== 'number' || isNaN(config.startMoveIndex)) {
    throw new MoveNavigatorConfigError(
      `Invalid startMoveIndex: expected number, received ${config.startMoveIndex}.`
    );
  }

  if (!config.historyCopy || typeof config.historyCopy !== 'object') {
    throw new MoveNavigatorConfigError('Invalid historyCopy: expected configuration object.');
  }

  if (
    typeof config.historyCopy.headerTitle !== 'string' ||
    config.historyCopy.headerTitle.trim().length === 0
  ) {
    throw new MoveNavigatorConfigError('Invalid historyCopy.headerTitle: expected non-empty string.');
  }

  if (
    typeof config.historyCopy.emptyHistoryMessage !== 'string' ||
    config.historyCopy.emptyHistoryMessage.trim().length === 0
  ) {
    throw new MoveNavigatorConfigError(
      'Invalid historyCopy.emptyHistoryMessage: expected non-empty string.'
    );
  }

  if (
    typeof config.historyCopy.analyzeButtonText !== 'string' ||
    config.historyCopy.analyzeButtonText.trim().length === 0
  ) {
    throw new MoveNavigatorConfigError(
      'Invalid historyCopy.analyzeButtonText: expected non-empty string.'
    );
  }

  if (
    typeof config.historyCopy.analyzeButtonAriaLabel !== 'string' ||
    config.historyCopy.analyzeButtonAriaLabel.trim().length === 0
  ) {
    throw new MoveNavigatorConfigError(
      'Invalid historyCopy.analyzeButtonAriaLabel: expected non-empty string.'
    );
  }

  if (!config.ariaLabels || typeof config.ariaLabels !== 'object') {
    throw new MoveNavigatorConfigError('Invalid ariaLabels: expected object.');
  }

  if (typeof config.ariaLabels.toolbar !== 'string' || config.ariaLabels.toolbar.trim().length === 0) {
    throw new MoveNavigatorConfigError('Invalid ariaLabels.toolbar: expected non-empty string.');
  }

  const requiredButtonKeys: (keyof MoveNavigatorButtonCopy)[] = [
    'startOfGame',
    'previousMove',
    'nextMove',
    'endOfGame',
  ];

  for (const key of requiredButtonKeys) {
    if (
      !config.ariaLabels.buttons ||
      typeof config.ariaLabels.buttons[key] !== 'string' ||
      config.ariaLabels.buttons[key].trim().length === 0
    ) {
      throw new MoveNavigatorConfigError(
        `Invalid ariaLabels.buttons.${key}: expected non-empty string.`
      );
    }

    if (
      !config.tooltips ||
      typeof config.tooltips[key] !== 'string' ||
      config.tooltips[key].trim().length === 0
    ) {
      throw new MoveNavigatorConfigError(
        `Invalid tooltips.${key}: expected non-empty string.`
      );
    }
  }

  if (!config.keyboardShortcuts || typeof config.keyboardShortcuts !== 'object') {
    throw new MoveNavigatorConfigError('Invalid keyboardShortcuts: expected object.');
  }

  const shortcutKeys: (keyof MoveNavigatorConfig['keyboardShortcuts'])[] = [
    'previous',
    'next',
    'start',
    'end',
  ];

  for (const key of shortcutKeys) {
    const list = config.keyboardShortcuts[key];
    if (!Array.isArray(list) || list.length === 0) {
      throw new MoveNavigatorConfigError(
        `Invalid keyboardShortcuts.${key}: expected non-empty array of key names.`
      );
    }
    for (const k of list) {
      if (typeof k !== 'string' || k.trim().length === 0) {
        throw new MoveNavigatorConfigError(
          `Invalid key name in keyboardShortcuts.${key}: expected non-empty string.`
        );
      }
    }
  }
}

export const CANONICAL_MOVE_NAVIGATOR_CONFIG: MoveNavigatorConfig = Object.freeze({
  startMoveIndex: -1,
  historyCopy: Object.freeze({
    headerTitle: 'Moves Notation',
    emptyHistoryMessage: 'No moves made yet',
    analyzeButtonText: 'Analyze',
    analyzeButtonAriaLabel: 'Analyze game moves',
  }),
  ariaLabels: Object.freeze({
    toolbar: 'Game moves navigation',
    buttons: Object.freeze({
      startOfGame: 'Start of game',
      previousMove: 'Previous move',
      nextMove: 'Next move',
      endOfGame: 'End of game',
    }),
  }),
  tooltips: Object.freeze({
    startOfGame: 'Start of game',
    previousMove: 'Previous move',
    nextMove: 'Next move',
    endOfGame: 'End of game',
  }),
  keyboardShortcuts: Object.freeze({
    previous: Object.freeze(['ArrowLeft']),
    next: Object.freeze(['ArrowRight']),
    start: Object.freeze(['Home']),
    end: Object.freeze(['End']),
  }),
});

validateMoveNavigatorConfig(CANONICAL_MOVE_NAVIGATOR_CONFIG);

export interface MoveNavigationState {
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
  readonly startTarget: number;
  readonly prevTarget: number;
  readonly nextTarget: number;
  readonly endTarget: number;
}

/**
 * Calculates navigation target indices and enablement boundaries.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time basic arithmetic comparisons.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant: Execution cost never increases regardless of the number of moves.
 */
export function calculateMoveNavigationState(
  currentIndex: number,
  totalMoves: number,
  config: MoveNavigatorConfig = CANONICAL_MOVE_NAVIGATOR_CONFIG
): MoveNavigationState {
  validateMoveNavigatorConfig(config);

  const startIdx = config.startMoveIndex;
  const lastIdx = totalMoves - 1;

  const canGoBack = totalMoves > 0 && currentIndex > startIdx;
  const canGoForward = totalMoves > 0 && currentIndex < lastIdx;

  return {
    canGoBack,
    canGoForward,
    startTarget: canGoBack ? startIdx : currentIndex,
    prevTarget: canGoBack ? Math.max(startIdx, currentIndex - 1) : currentIndex,
    nextTarget: canGoForward ? Math.min(lastIdx, currentIndex + 1) : currentIndex,
    endTarget: canGoForward ? lastIdx : currentIndex,
  };
}
