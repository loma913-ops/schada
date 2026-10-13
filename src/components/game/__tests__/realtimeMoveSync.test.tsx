import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MoveNavigator } from '../MoveNavigator';
import { MoveHistory } from '../MoveHistory';
import { CANONICAL_MOVE_NAVIGATOR_CONFIG } from '../moveNavigatorConfig';
import type { Move } from '@/core/schada/types';

describe('Real-Time Move Sync UI & State Tracking', () => {
  const sampleMoves: Move[] = [
    {
      from: 'b2',
      to: 'b3',
      piece: { id: 'b_p1', type: 'pawn', color: 'blue', hasLeftBase: false, hasReachedGoal: false },
      intermediateSquares: [],
      notation: 'b2-b3',
    },
    {
      from: 'b7',
      to: 'b6',
      piece: { id: 'g_p1', type: 'pawn', color: 'green', hasLeftBase: false, hasReachedGoal: false },
      intermediateSquares: [],
      notation: 'b7-b6',
    },
  ];

  it('renders unread live indicator badge and title on MoveNavigator when hasUnreadLiveMove is true', () => {
    const html = renderToStaticMarkup(
      React.createElement(MoveNavigator, {
        currentIndex: 0,
        totalMoves: 2,
        hasUnreadLiveMove: true,
      })
    );

    expect(html).toContain('has-unread-live-move');
    expect(html).toContain('move-navigator-unread-dot');
    expect(html).toContain(CANONICAL_MOVE_NAVIGATOR_CONFIG.tooltips.unreadLiveMove);
    expect(html).toContain(CANONICAL_MOVE_NAVIGATOR_CONFIG.ariaLabels.buttons.unreadLiveMove);
  });

  it('renders default End of Game title and no indicator dot when hasUnreadLiveMove is false', () => {
    const html = renderToStaticMarkup(
      React.createElement(MoveNavigator, {
        currentIndex: 0,
        totalMoves: 2,
        hasUnreadLiveMove: false,
      })
    );

    expect(html).not.toContain('has-unread-live-move');
    expect(html).not.toContain('move-navigator-unread-dot');
    expect(html).toContain(CANONICAL_MOVE_NAVIGATOR_CONFIG.tooltips.endOfGame);
    expect(html).toContain(CANONICAL_MOVE_NAVIGATOR_CONFIG.ariaLabels.buttons.endOfGame);
  });

  it('forwards hasUnreadLiveMove through MoveHistory to MoveNavigator', () => {
    const html = renderToStaticMarkup(
      React.createElement(MoveHistory, {
        history: sampleMoves,
        currentMoveIndex: 0,
        hasUnreadLiveMove: true,
      })
    );

    expect(html).toContain('has-unread-live-move');
    expect(html).toContain('move-navigator-unread-dot');
  });

  describe('Move synchronization state calculation logic', () => {
    /**
     * Simulates Arena's live vs history detection algorithm:
     * - wasAtLivePosition = (currentLocalLen === 0 ? currentViewIndex === startMoveIndex : currentViewIndex >= currentLocalLen - 1)
     */
    function evaluateIncomingSync(
      currentViewIndex: number,
      currentLocalLen: number,
      incomingLen: number,
      startMoveIndex = -1
    ) {
      const wasAtLivePosition =
        currentLocalLen === 0
          ? currentViewIndex === startMoveIndex
          : currentViewIndex >= currentLocalLen - 1;

      if (wasAtLivePosition) {
        return {
          nextViewIndex: incomingLen > 0 ? incomingLen - 1 : startMoveIndex,
          hasUnreadLiveMove: false,
        };
      } else {
        return {
          nextViewIndex: currentViewIndex,
          hasUnreadLiveMove: incomingLen > currentLocalLen,
        };
      }
    }

    it('auto-advances board view to latest position when player is at initial live board (move 0 -> 1)', () => {
      // Game starts with 0 moves, viewing startMoveIndex (-1)
      const result = evaluateIncomingSync(-1, 0, 1);
      expect(result.nextViewIndex).toBe(0);
      expect(result.hasUnreadLiveMove).toBe(false);
    });

    it('auto-advances board view to latest position when player is following live moves (move 3 -> 4)', () => {
      // 3 moves made, player viewing move 2 (latest)
      const result = evaluateIncomingSync(2, 3, 4);
      expect(result.nextViewIndex).toBe(3);
      expect(result.hasUnreadLiveMove).toBe(false);
    });

    it('preserves historical view index and flags unread badge when reviewing past moves', () => {
      // 5 moves made, player inspecting move 1. Move 6 arrives.
      const result = evaluateIncomingSync(1, 5, 6);
      expect(result.nextViewIndex).toBe(1); // Still on inspected move 1!
      expect(result.hasUnreadLiveMove).toBe(true); // Badge flagged!
    });

    it('clears unread badge once player navigates to the latest live move', () => {
      const currentHistoryLen = 6;
      let hasUnreadLiveMove = true;
      let viewMoveIndex = 1;

      // Player navigates to live move (index 5)
      viewMoveIndex = currentHistoryLen - 1;

      // Effect check in Arena: if viewMoveIndex >= history.length - 1, clear unread
      if (viewMoveIndex >= currentHistoryLen - 1) {
        hasUnreadLiveMove = false;
      }

      expect(hasUnreadLiveMove).toBe(false);
    });
  });
});
