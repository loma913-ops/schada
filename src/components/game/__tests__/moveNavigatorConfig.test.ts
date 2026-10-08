import { describe, it, expect } from 'vitest';
import {
  CANONICAL_MOVE_NAVIGATOR_CONFIG,
  validateMoveNavigatorConfig,
  MoveNavigatorConfigError,
  calculateMoveNavigationState,
  type MoveNavigatorConfig,
} from '../moveNavigatorConfig';

describe('MoveNavigatorConfig validation and state calculation', () => {
  it('canonical CANONICAL_MOVE_NAVIGATOR_CONFIG passes validation', () => {
    expect(() => validateMoveNavigatorConfig(CANONICAL_MOVE_NAVIGATOR_CONFIG)).not.toThrow();
  });

  it('throws MoveNavigatorConfigError if config object is missing or null', () => {
    expect(() => validateMoveNavigatorConfig(null as unknown as MoveNavigatorConfig)).toThrowError(
      MoveNavigatorConfigError
    );
    expect(() => validateMoveNavigatorConfig(null as unknown as MoveNavigatorConfig)).toThrowError(
      'MoveNavigatorConfigError: Configuration object is missing or null.'
    );
  });

  it('throws MoveNavigatorConfigError if startMoveIndex is not a valid number', () => {
    const invalidConfig = {
      ...CANONICAL_MOVE_NAVIGATOR_CONFIG,
      startMoveIndex: NaN,
    };
    expect(() => validateMoveNavigatorConfig(invalidConfig)).toThrowError(
      MoveNavigatorConfigError
    );
  });

  it('throws MoveNavigatorConfigError if historyCopy is missing or has empty strings', () => {
    const missingCopyConfig = {
      ...CANONICAL_MOVE_NAVIGATOR_CONFIG,
      historyCopy: null as unknown as MoveNavigatorConfig['historyCopy'],
    };
    expect(() => validateMoveNavigatorConfig(missingCopyConfig)).toThrowError(
      'MoveNavigatorConfigError: Invalid historyCopy: expected configuration object.'
    );

    const emptyTitleConfig = {
      ...CANONICAL_MOVE_NAVIGATOR_CONFIG,
      historyCopy: {
        headerTitle: '   ',
        emptyHistoryMessage: 'No moves',
        analyzeButtonText: 'Analyze',
        analyzeButtonAriaLabel: 'Analyze game moves',
      },
    };
    expect(() => validateMoveNavigatorConfig(emptyTitleConfig)).toThrowError(
      'MoveNavigatorConfigError: Invalid historyCopy.headerTitle: expected non-empty string.'
    );

    const emptyAnalyzeTextConfig = {
      ...CANONICAL_MOVE_NAVIGATOR_CONFIG,
      historyCopy: {
        ...CANONICAL_MOVE_NAVIGATOR_CONFIG.historyCopy,
        analyzeButtonText: '   ',
      },
    };
    expect(() => validateMoveNavigatorConfig(emptyAnalyzeTextConfig)).toThrowError(
      'MoveNavigatorConfigError: Invalid historyCopy.analyzeButtonText: expected non-empty string.'
    );

    const emptyAnalyzeAriaLabelConfig = {
      ...CANONICAL_MOVE_NAVIGATOR_CONFIG,
      historyCopy: {
        ...CANONICAL_MOVE_NAVIGATOR_CONFIG.historyCopy,
        analyzeButtonAriaLabel: '',
      },
    };
    expect(() => validateMoveNavigatorConfig(emptyAnalyzeAriaLabelConfig)).toThrowError(
      'MoveNavigatorConfigError: Invalid historyCopy.analyzeButtonAriaLabel: expected non-empty string.'
    );
  });

  it('throws MoveNavigatorConfigError if ariaLabels or toolbar is missing/empty', () => {
    const invalidToolbar = {
      ...CANONICAL_MOVE_NAVIGATOR_CONFIG,
      ariaLabels: {
        ...CANONICAL_MOVE_NAVIGATOR_CONFIG.ariaLabels,
        toolbar: '  ',
      },
    };
    expect(() => validateMoveNavigatorConfig(invalidToolbar)).toThrowError(
      'MoveNavigatorConfigError: Invalid ariaLabels.toolbar: expected non-empty string.'
    );
  });

  it('throws MoveNavigatorConfigError if a button aria-label or tooltip is empty', () => {
    const invalidButtonLabel = {
      ...CANONICAL_MOVE_NAVIGATOR_CONFIG,
      ariaLabels: {
        ...CANONICAL_MOVE_NAVIGATOR_CONFIG.ariaLabels,
        buttons: {
          ...CANONICAL_MOVE_NAVIGATOR_CONFIG.ariaLabels.buttons,
          startOfGame: '',
        },
      },
    };
    expect(() => validateMoveNavigatorConfig(invalidButtonLabel)).toThrowError(
      'MoveNavigatorConfigError: Invalid ariaLabels.buttons.startOfGame: expected non-empty string.'
    );

    const invalidTooltip = {
      ...CANONICAL_MOVE_NAVIGATOR_CONFIG,
      tooltips: {
        ...CANONICAL_MOVE_NAVIGATOR_CONFIG.tooltips,
        nextMove: '   ',
      },
    };
    expect(() => validateMoveNavigatorConfig(invalidTooltip)).toThrowError(
      'MoveNavigatorConfigError: Invalid tooltips.nextMove: expected non-empty string.'
    );
  });

  it('throws MoveNavigatorConfigError if keyboard shortcuts are empty or missing', () => {
    const emptyShortcuts = {
      ...CANONICAL_MOVE_NAVIGATOR_CONFIG,
      keyboardShortcuts: {
        ...CANONICAL_MOVE_NAVIGATOR_CONFIG.keyboardShortcuts,
        previous: [],
      },
    };
    expect(() => validateMoveNavigatorConfig(emptyShortcuts)).toThrowError(
      'MoveNavigatorConfigError: Invalid keyboardShortcuts.previous: expected non-empty array of key names.'
    );
  });

  it('calculates disabled states and targets when history is empty', () => {
    const state = calculateMoveNavigationState(-1, 0);
    expect(state.canGoBack).toBe(false);
    expect(state.canGoForward).toBe(false);
    expect(state.startTarget).toBe(-1);
    expect(state.prevTarget).toBe(-1);
    expect(state.nextTarget).toBe(-1);
    expect(state.endTarget).toBe(-1);
  });

  it('calculates navigation state at start of game with moves', () => {
    const state = calculateMoveNavigationState(-1, 6);
    expect(state.canGoBack).toBe(false);
    expect(state.canGoForward).toBe(true);
    expect(state.nextTarget).toBe(0);
    expect(state.endTarget).toBe(5);
  });

  it('calculates navigation state at final move of game', () => {
    const state = calculateMoveNavigationState(5, 6);
    expect(state.canGoBack).toBe(true);
    expect(state.canGoForward).toBe(false);
    expect(state.prevTarget).toBe(4);
    expect(state.startTarget).toBe(-1);
  });

  it('calculates navigation state for intermediate moves', () => {
    const state = calculateMoveNavigationState(3, 6);
    expect(state.canGoBack).toBe(true);
    expect(state.canGoForward).toBe(true);
    expect(state.startTarget).toBe(-1);
    expect(state.prevTarget).toBe(2);
    expect(state.nextTarget).toBe(4);
    expect(state.endTarget).toBe(5);
  });
});
