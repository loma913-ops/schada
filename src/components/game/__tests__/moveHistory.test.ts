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

  it('does not render Analyze button during live gameplay when isReview is false or undefined', () => {
    const html = renderToStaticMarkup(
      React.createElement(MoveHistory, {
        history: [],
        isReview: false,
      })
    );

    expect(html).not.toContain('move-history-analyze-btn');
    expect(html).not.toContain('Analyze');
  });

  it('renders Analyze button with accessible attributes and label when isReview is true', () => {
    const onAnalyze = vi.fn();
    const html = renderToStaticMarkup(
      React.createElement(MoveHistory, {
        history: [],
        isReview: true,
        onAnalyze,
      })
    );

    expect(html).toContain('move-history-analyze-btn');
    expect(html).toContain('Analyze');
    expect(html).toContain('aria-label="Analyze game moves"');
    expect(html).toContain('title="Analyze game moves"');
  });

  it('renders move quality badges in rows when analyzedQualities are provided', () => {
    const sampleHistory: Move[] = [
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

    const html = renderToStaticMarkup(
      React.createElement(MoveHistory, {
        history: sampleHistory,
        isReview: true,
        analyzedQualities: {
          0: 'great',
          1: 'blunder',
        },
      })
    );

    expect(html).toContain('data-quality="great"');
    expect(html).toContain('title="Great Move"');
    expect(html).toContain('data-quality="blunder"');
    expect(html).toContain('title="Blunder"');
  });

  it('suppresses badges for excluded qualities in move history list', () => {
    const sampleHistory: Move[] = [
      {
        from: 'b2',
        to: 'b3',
        piece: { id: 'b_p1', type: 'pawn', color: 'blue', hasLeftBase: false, hasReachedGoal: false },
        intermediateSquares: [],
        notation: 'b2-b3',
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(MoveHistory, {
        history: sampleHistory,
        isReview: true,
        analyzedQualities: {
          0: 'best',
        },
      })
    );

    expect(html).not.toContain('data-quality');
  });

  it('renders active analyzing button with spinner and progress counter when isAnalyzing is true', () => {
    const html = renderToStaticMarkup(
      React.createElement(MoveHistory, {
        history: [],
        isReview: true,
        isAnalyzing: true,
        analysisProgress: { current: 5, total: 14 },
      })
    );

    expect(html).toContain('move-history-analyze-btn analyzing');
    expect(html).toContain('Analyzing 5/14...');
    expect(html).toContain('title="Cancel active analysis"');
  });

  it('renders Re-analyze button once analysis is finished and analyzedQualities exist', () => {
    const html = renderToStaticMarkup(
      React.createElement(MoveHistory, {
        history: [],
        isReview: true,
        isAnalyzing: false,
        analyzedQualities: { 0: 'great' },
      })
    );

    expect(html).toContain('Re-analyze');
  });
});
