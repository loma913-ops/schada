import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MoveHistory } from '../MoveHistory';
import type { Move } from '@/core/schada/types';

describe('MoveHistory Component', () => {
  it('renders sticky top container with MoveNavigator and header', () => {
    const html = renderToStaticMarkup(
      React.createElement(MoveHistory, {
        history: [],
      })
    );

    expect(html).toContain('move-history-sticky-top');
    expect(html).toContain('move-navigator-bar');
    expect(html).toContain('move-history-header');
    expect(html).toContain('move-history-list');
  });

  it('renders move pairs inside the list while keeping sticky top structure', () => {
    const sampleHistory: Move[] = [
      {
        from: 'b2',
        to: 'b3',
        piece: { id: 'b_p1', type: 'pawn', color: 'blue', hasLeftBase: false, hasReachedGoal: false },
        intermediateSquares: [],
        notation: 'b2',
      },
      {
        from: 'b7',
        to: 'b6',
        piece: { id: 'g_p1', type: 'pawn', color: 'green', hasLeftBase: false, hasReachedGoal: false },
        intermediateSquares: [],
        notation: 'b7',
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(MoveHistory, {
        history: sampleHistory,
        currentMoveIndex: 1,
        onNavigateMove: vi.fn(),
      })
    );

    expect(html).toContain('move-history-sticky-top');
    expect(html).toContain('b2');
    expect(html).toContain('b7');
    expect(html).toContain('move-row');
  });
});
