import React, { memo } from 'react';
import {
  type MoveNavigatorConfig,
  CANONICAL_MOVE_NAVIGATOR_CONFIG,
  calculateMoveNavigationState,
  validateMoveNavigatorConfig,
} from './moveNavigatorConfig';

export interface MoveNavigatorProps {
  readonly currentIndex: number;
  readonly totalMoves: number;
  readonly onNavigate?: (index: number) => void;
  readonly hasUnreadLiveMove?: boolean;
  readonly config?: MoveNavigatorConfig;
}

/**
 * Interactive Move Navigation Toolbar.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time target evaluation and rendering.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) invariant to totalMoves length.
 */
export const MoveNavigator: React.FC<MoveNavigatorProps> = memo(function MoveNavigator({
  currentIndex,
  totalMoves,
  onNavigate,
  hasUnreadLiveMove = false,
  config = CANONICAL_MOVE_NAVIGATOR_CONFIG,
}) {
  validateMoveNavigatorConfig(config);

  const {
    canGoBack,
    canGoForward,
    startTarget,
    prevTarget,
    nextTarget,
    endTarget,
  } = calculateMoveNavigationState(currentIndex, totalMoves, config);

  const handleStart = () => {
    if (canGoBack && onNavigate) onNavigate(startTarget);
  };

  const handlePrevious = () => {
    if (canGoBack && onNavigate) onNavigate(prevTarget);
  };

  const handleNext = () => {
    if (canGoForward && onNavigate) onNavigate(nextTarget);
  };

  const handleEnd = () => {
    if (canGoForward && onNavigate) onNavigate(endTarget);
  };

  const { ariaLabels, tooltips } = config;

  return (
    <div
      className="move-navigator-bar"
      role="toolbar"
      aria-label={ariaLabels.toolbar}
    >
      <button
        type="button"
        className="move-navigator-btn"
        disabled={!canGoBack}
        onClick={handleStart}
        title={tooltips.startOfGame}
        aria-label={ariaLabels.buttons.startOfGame}
      >
        <svg
          className="move-navigator-icon"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <rect x="3.5" y="4.5" width="2.2" height="15" rx="0.5" />
          <path d="M12.5 5.5 L5.5 12 L12.5 18.5 Z" />
          <path d="M20 5.5 L13 12 L20 18.5 Z" />
        </svg>
      </button>

      <button
        type="button"
        className="move-navigator-btn"
        disabled={!canGoBack}
        onClick={handlePrevious}
        title={tooltips.previousMove}
        aria-label={ariaLabels.buttons.previousMove}
      >
        <svg
          className="move-navigator-icon"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <rect x="6.5" y="4.5" width="2.2" height="15" rx="0.5" />
          <path d="M17.5 5.5 L9.5 12 L17.5 18.5 Z" />
        </svg>
      </button>

      <button
        type="button"
        className="move-navigator-btn"
        disabled={!canGoForward}
        onClick={handleNext}
        title={tooltips.nextMove}
        aria-label={ariaLabels.buttons.nextMove}
      >
        <svg
          className="move-navigator-icon"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M6.5 5.5 L14.5 12 L6.5 18.5 Z" />
          <rect x="15.5" y="4.5" width="2.2" height="15" rx="0.5" />
        </svg>
      </button>

      <button
        type="button"
        className={`move-navigator-btn ${hasUnreadLiveMove ? 'has-unread-live-move' : ''}`}
        disabled={!canGoForward}
        onClick={handleEnd}
        title={hasUnreadLiveMove ? tooltips.unreadLiveMove : tooltips.endOfGame}
        aria-label={hasUnreadLiveMove ? ariaLabels.buttons.unreadLiveMove : ariaLabels.buttons.endOfGame}
      >
        <span className="move-navigator-btn-content">
          <svg
            className="move-navigator-icon"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M4 5.5 L11 12 L4 18.5 Z" />
            <path d="M11.5 5.5 L18.5 12 L11.5 18.5 Z" />
            <rect x="18.5" y="4.5" width="2.2" height="15" rx="0.5" />
          </svg>
          {hasUnreadLiveMove && <span className="move-navigator-unread-dot" aria-hidden="true" />}
        </span>
      </button>
    </div>
  );
});
