import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GameControls } from '../GameControls';
import {
  GAME_CONTROLS_CONFIG,
  GameControlsConfigError,
  type GameControlsConfig,
} from '../gameControlsConfig';

describe('GameControls Component', () => {
  it('renders Resign and Draw buttons during an active game with explicit type="button"', () => {
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
    expect(html).toContain('type="button"');
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

  it('accepts and renders custom configuration copy', () => {
    const customConfig: GameControlsConfig = {
      copy: {
        ...GAME_CONTROLS_CONFIG.copy,
        flipButtonText: 'Rotate',
        flipButtonAriaLabel: 'Rotate Board',
      },
    };

    const html = renderToStaticMarkup(
      React.createElement(GameControls, {
        onResign: vi.fn(),
        onFlipBoard: vi.fn(),
        config: customConfig,
      })
    );

    expect(html).toContain('Rotate');
    expect(html).toContain('aria-label="Rotate Board"');
  });

  it('throws GameControlsConfigError when given invalid configuration', () => {
    expect(() =>
      renderToStaticMarkup(
        React.createElement(GameControls, {
          onResign: vi.fn(),
          onFlipBoard: vi.fn(),
          config: null as unknown as GameControlsConfig,
        })
      )
    ).toThrow(GameControlsConfigError);
  });
});
