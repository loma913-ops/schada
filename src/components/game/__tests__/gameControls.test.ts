import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GameControls } from '../GameControls';

describe('GameControls Component', () => {
  it('renders Resign and Draw buttons during an active game', () => {
    const html = renderToStaticMarkup(
      React.createElement(GameControls, {
        onResign: vi.fn(),
        onOfferDraw: vi.fn(),
        onFlipBoard: vi.fn(),
        isGameOver: false,
      })
    );

    expect(html).toContain('Resign');
    expect(html).toContain('Draw');
    expect(html).toContain('Flip');
    expect(html).not.toContain('Results');
    expect(html).not.toContain('Lobby');
  });

  it('renders Results and Lobby buttons during game over state', () => {
    const html = renderToStaticMarkup(
      React.createElement(GameControls, {
        onResign: vi.fn(),
        onFlipBoard: vi.fn(),
        isGameOver: true,
        onShowResult: vi.fn(),
        onExit: vi.fn(),
      })
    );

    expect(html).toContain('Results');
    expect(html).toContain('Lobby');
    expect(html).toContain('Flip');
    expect(html).not.toContain('Resign');
    expect(html).not.toContain('Draw');
  });
});
