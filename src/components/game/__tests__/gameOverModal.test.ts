import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GameOverModal } from '../GameOverModal';
import { formatEloWithDelta } from '@/core/elo/eloService';
import {
  GAME_OVER_MODAL_CONFIG,
  GameOverModalConfigError,
  type GameOverModalConfig,
} from '../gameOverConfig';
import type { GameResult } from '@/core/schada/types';

// Mock dependencies that rely on browser/DOM audio or canvas
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

vi.mock('@/services/audio/soundService', () => ({
  soundService: {
    playVictory: vi.fn(),
  },
}));

vi.mock('@/services/device/haptics', () => ({
  haptics: {
    gameOver: vi.fn(),
  },
}));

describe('GameOverModal - Rated Games Elo Display', () => {
  const mockResult: GameResult = {
    winner: 'white',
    winReason: 'resignation',
    whiteScore: {
      goalScore: 0,
      outsideGoalHighPiecesScore: 12,
      rankDistanceScore: 0,
      totalScore: 12,
    },
    blackScore: {
      goalScore: 0,
      outsideGoalHighPiecesScore: 12,
      rankDistanceScore: 0.5714,
      totalScore: 12.5714,
    },
  };

  describe('formatEloWithDelta', () => {
    it('formats positive Elo gain with explicit + sign', () => {
      expect(formatEloWithDelta(1256, 12)).toBe('1256 (+12)');
      expect(formatEloWithDelta(1500, 1)).toBe('1500 (+1)');
    });

    it('formats negative Elo loss with - sign', () => {
      expect(formatEloWithDelta(1142, -11)).toBe('1142 (-11)');
      expect(formatEloWithDelta(990, -25)).toBe('990 (-25)');
    });

    it('formats zero change with +0', () => {
      expect(formatEloWithDelta(1200, 0)).toBe('1200 (+0)');
    });
  });

  describe('Component Rendering', () => {
    it('renders new Elo and gain/loss under respective colors when isRanked is true', () => {
      const html = renderToStaticMarkup(
        React.createElement(GameOverModal, {
          result: mockResult,
          isRanked: true,
          whitePlayer: { elo: 1200, gamesPlayed: 20 },
          blackPlayer: { elo: 1200, gamesPlayed: 20 },
          onHome: vi.fn(),
        })
      );

      // White won against equally rated player (K=20): delta = +10, new = 1210
      // Black lost: delta = -10, new = 1190
      expect(html).toContain('1210');
      expect(html).toContain('(+10)');
      expect(html).toContain('1190');
      expect(html).toContain('(-10)');
      expect(html).toContain('White');
      expect(html).toContain('Black');
    });

    it('renders exact requested format ELO (GAIN/LOSS) when provided directly', () => {
      const html = renderToStaticMarkup(
        React.createElement(GameOverModal, {
          result: mockResult,
          isRanked: true,
          whiteElo: { newElo: 1256, delta: 12 },
          blackElo: { newElo: 1142, delta: -11 },
          onHome: vi.fn(),
        })
      );

      expect(html).toContain('1256');
      expect(html).toContain('(+12)');
      expect(html).toContain('1142');
      expect(html).toContain('(-11)');
    });

    it('prioritizes authoritative whiteElo and blackElo without recalculating from player cards', () => {
      // Even if whitePlayer and blackPlayer reflect already-updated ratings or differing provisional games,
      // whiteElo and blackElo must be rendered directly and authoritatively.
      const html = renderToStaticMarkup(
        React.createElement(GameOverModal, {
          result: mockResult,
          isRanked: true,
          whitePlayer: { elo: 1230, gamesPlayed: 0 },
          blackPlayer: { elo: 1170, gamesPlayed: 20 },
          whiteElo: { newElo: 1216, delta: 16 },
          blackElo: { newElo: 1184, delta: -16 },
          onHome: vi.fn(),
        })
      );

      expect(html).toContain('1216');
      expect(html).toContain('(+16)');
      expect(html).toContain('1184');
      expect(html).toContain('(-16)');
      // Must NOT contain recalculated values
      expect(html).not.toContain('1230');
      expect(html).not.toContain('1170');
    });

    it('renders correctly for draw outcomes in rated games', () => {
      const drawResult: GameResult = {
        ...mockResult,
        winner: 'draw',
        winReason: 'agreement',
      };

      const html = renderToStaticMarkup(
        React.createElement(GameOverModal, {
          result: drawResult,
          isRanked: true,
          whitePlayer: { elo: 1200, gamesPlayed: 20 },
          blackPlayer: { elo: 1200, gamesPlayed: 20 },
          onHome: vi.fn(),
        })
      );

      // Equal players drawing -> 0 delta -> 1200 (+0)
      expect(html).toContain('1200');
      expect(html).toContain('(+0)');
      expect(html).toContain('Draw agreed');
    });

    it('does NOT render Elo for casual games (isRanked = false)', () => {
      const html = renderToStaticMarkup(
        React.createElement(GameOverModal, {
          result: mockResult,
          isRanked: false,
          whitePlayer: { elo: 1200, gamesPlayed: 20 },
          blackPlayer: { elo: 1200, gamesPlayed: 20 },
          onHome: vi.fn(),
        })
      );

      expect(html).not.toContain('(+10)');
      expect(html).not.toContain('(-10)');
      expect(html).toContain('White');
      expect(html).toContain('Black');
    });

    it('does NOT render Elo when isRanked is undefined (default false)', () => {
      const html = renderToStaticMarkup(
        React.createElement(GameOverModal, {
          result: mockResult,
          whitePlayer: { elo: 1200, gamesPlayed: 20 },
          blackPlayer: { elo: 1200, gamesPlayed: 20 },
          onHome: vi.fn(),
        })
      );

      expect(html).not.toContain('(+10)');
      expect(html).not.toContain('(-10)');
      expect(html).toContain('White');
      expect(html).toContain('Black');
    });

    it('uses theme tokens supporting both light and dark mode', () => {
      const html = renderToStaticMarkup(
        React.createElement(GameOverModal, {
          result: mockResult,
          isRanked: true,
          whiteElo: { newElo: 1256, delta: 12 },
          blackElo: { newElo: 1142, delta: -11 },
          onHome: vi.fn(),
        })
      );

      // Verify semantic CSS variables are applied for theme-adaptive light and dark mode support
      expect(html).toContain('var(--text-primary)');
      expect(html).toContain('var(--accent-green)');
      expect(html).toContain('var(--accent-red)');
      expect(html).toContain('var(--font-mono)');
    });

    it('renders close button and Review button when onClose is provided', () => {
      const html = renderToStaticMarkup(
        React.createElement(GameOverModal, {
          result: mockResult,
          onHome: vi.fn(),
          onClose: vi.fn(),
        })
      );

      expect(html).toContain('modal-close-btn');
      expect(html).toContain('aria-label="Close game over modal"');
      expect(html).toContain('Review');
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('id="game-over-title"');
    });

    it('does not render close button or Review button when onClose is omitted', () => {
      const html = renderToStaticMarkup(
        React.createElement(GameOverModal, {
          result: mockResult,
          onHome: vi.fn(),
        })
      );

      expect(html).not.toContain('modal-close-btn');
      expect(html).not.toContain('aria-label="Close game over modal"');
      expect(html).not.toContain('Review');
      expect(html).toContain('Lobby');
    });

    it('throws GameOverModalConfigError if invalid config is provided', () => {
      expect(() => {
        renderToStaticMarkup(
          React.createElement(GameOverModal, {
            result: mockResult,
            isRanked: true,
            config: null as unknown as GameOverModalConfig,
            onHome: vi.fn(),
          })
        );
      }).toThrowError(GameOverModalConfigError);
    });

    it('renders Move Quality Distribution and Accuracy sections with provided analysisReport', () => {
      const mockReport = {
        metadata: {},
        moves: [],
        whiteAccuracy: 77.7,
        blackAccuracy: 85.8,
        whiteBreakdown: {
          brilliant: 0,
          great: 0,
          best: 7,
          excellent: 2,
          good: 1,
          book: 2,
          inaccuracy: 1,
          mistake: 0,
          miss: 2,
          blunder: 0,
        },
        blackBreakdown: {
          brilliant: 0,
          great: 0,
          best: 5,
          excellent: 2,
          good: 1,
          book: 2,
          inaccuracy: 1,
          mistake: 3,
          miss: 0,
          blunder: 0,
        },
        isComplete: true,
        totalPlies: 29,
        analyzedAt: new Date().toISOString(),
        durationMs: 350,
      };

      const html = renderToStaticMarkup(
        React.createElement(GameOverModal, {
          result: mockResult,
          whitePlayer: { elo: 1200, username: 'SchadaBot' },
          blackPlayer: { elo: 1200, username: 'Guest' },
          analysisReport: mockReport,
          onHome: vi.fn(),
          onClose: vi.fn(),
        })
      );

      // Verify sections are present
      expect(html).toContain('data-testid="move-quality-distribution-section"');
      expect(html).toContain('data-testid="accuracy-section"');

      // Verify headers
      expect(html).toContain('Classification');
      expect(html).toContain('Accuracy');
      expect(html).toContain('SchadaBot');
      expect(html).toContain('Guest');

      // Verify all 10 tiers are rendered with labels
      expect(html).toContain('Brilliant');
      expect(html).toContain('Great Move');
      expect(html).toContain('Best Move');
      expect(html).toContain('Excellent');
      expect(html).toContain('Good');
      expect(html).toContain('Book');
      expect(html).toContain('Inaccuracy');
      expect(html).toContain('Mistake');
      expect(html).toContain('Miss');
      expect(html).toContain('Blunder');

      // Verify counts from mock report
      expect(html).toContain('7'); // White best moves
      expect(html).toContain('5'); // Black best moves
      expect(html).toContain('3'); // Black mistakes

      // Verify accuracy values
      expect(html).toContain('77.7%');
      expect(html).toContain('85.8%');

      // Verify positioned above review and lobby buttons
      const distIndex = html.indexOf('data-testid="move-quality-distribution-section"');
      const accIndex = html.indexOf('data-testid="accuracy-section"');
      const reviewIndex = html.indexOf('Review');
      const lobbyIndex = html.indexOf('Lobby');

      expect(distIndex).toBeLessThan(accIndex);
      expect(accIndex).toBeLessThan(reviewIndex);
      expect(reviewIndex).toBeLessThan(lobbyIndex);
    });

    it('renders skeleton loading placeholders when isAnalyzing is true', () => {
      const html = renderToStaticMarkup(
        React.createElement(GameOverModal, {
          result: mockResult,
          isAnalyzing: true,
          onHome: vi.fn(),
          onClose: vi.fn(),
        })
      );

      expect(html).toContain('data-testid="analysis-loading-skeleton"');
      expect(html).toContain('modal-skeleton');
    });

    it('maintains frozen header, scrollable body, and frozen footer layout in modal DOM structure', () => {
      const html = renderToStaticMarkup(
        React.createElement(GameOverModal, {
          result: mockResult,
          onHome: vi.fn(),
          onClose: vi.fn(),
          onRematch: vi.fn(),
        })
      );

      // Verify structural containers exist
      expect(html).toContain('game-over-modal-content');
      expect(html).toContain('game-over-modal-header');
      expect(html).toContain('game-over-modal-body');
      expect(html).toContain('game-over-modal-footer');

      // Verify DOM ordering: header -> body -> footer
      const headerIdx = html.indexOf('game-over-modal-header');
      const bodyIdx = html.indexOf('game-over-modal-body');
      const footerIdx = html.indexOf('game-over-modal-footer');

      expect(headerIdx).toBeGreaterThan(-1);
      expect(bodyIdx).toBeGreaterThan(headerIdx);
      expect(footerIdx).toBeGreaterThan(bodyIdx);

      // Verify header contains title & close button
      const closeBtnIdx = html.indexOf('modal-close-btn');
      const titleIdx = html.indexOf('id="game-over-title"');
      expect(closeBtnIdx).toBeGreaterThan(headerIdx);
      expect(closeBtnIdx).toBeLessThan(bodyIdx);
      expect(titleIdx).toBeGreaterThan(headerIdx);
      expect(titleIdx).toBeLessThan(bodyIdx);

      // Verify footer contains action buttons
      const rematchIdx = html.indexOf('Rematch');
      const reviewIdx = html.indexOf('Review');
      const lobbyIdx = html.indexOf('Lobby');
      expect(rematchIdx).toBeGreaterThan(footerIdx);
      expect(reviewIdx).toBeGreaterThan(footerIdx);
      expect(lobbyIdx).toBeGreaterThan(footerIdx);
    });

    it('uses configured copy labels for score breakdown and winner title', () => {
      const customConfig: GameOverModalConfig = {
        ...GAME_OVER_MODAL_CONFIG,
        copy: {
          ...GAME_OVER_MODAL_CONFIG.copy,
          categoryHeader: 'Custom Category',
          goalScoreLabel: 'Custom Goal Points',
          outsideHighPiecesLabel: 'Custom High Pieces',
          rankDistanceLabel: 'Custom Rank Distance',
          winnerTitleSuffix: 'Victorious!',
        },
      };

      const html = renderToStaticMarkup(
        React.createElement(GameOverModal, {
          result: mockResult,
          config: customConfig,
          onHome: vi.fn(),
        })
      );

      expect(html).toContain('Custom Category');
      expect(html).toContain('Custom Goal Points');
      expect(html).toContain('Custom High Pieces');
      expect(html).toContain('Custom Rank Distance');
      expect(html).toContain('Victorious!');
    });
  });
});
