import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GameOverModal } from '../GameOverModal';
import { formatEloWithDelta } from '@/core/elo/eloService';
import { GameOverModalConfigError, type GameOverModalConfig } from '../gameOverConfig';
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
    winner: 'blue',
    winReason: 'resignation',
    blueScore: {
      goalScore: 0,
      outsideGoalHighPiecesScore: 12,
      rankDistanceScore: 0,
      totalScore: 12,
    },
    greenScore: {
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
          bluePlayer: { elo: 1200, gamesPlayed: 20 },
          greenPlayer: { elo: 1200, gamesPlayed: 20 },
          onHome: vi.fn(),
        })
      );

      // Blue won against equally rated player (K=20): delta = +10, new = 1210
      // Green lost: delta = -10, new = 1190
      expect(html).toContain('1210');
      expect(html).toContain('(+10)');
      expect(html).toContain('1190');
      expect(html).toContain('(-10)');
      expect(html).toContain('Blue');
      expect(html).toContain('Green');
    });

    it('renders exact requested format ELO (GAIN/LOSS) when provided directly', () => {
      const html = renderToStaticMarkup(
        React.createElement(GameOverModal, {
          result: mockResult,
          isRanked: true,
          blueElo: { newElo: 1256, delta: 12 },
          greenElo: { newElo: 1142, delta: -11 },
          onHome: vi.fn(),
        })
      );

      expect(html).toContain('1256');
      expect(html).toContain('(+12)');
      expect(html).toContain('1142');
      expect(html).toContain('(-11)');
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
          bluePlayer: { elo: 1200, gamesPlayed: 20 },
          greenPlayer: { elo: 1200, gamesPlayed: 20 },
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
          bluePlayer: { elo: 1200, gamesPlayed: 20 },
          greenPlayer: { elo: 1200, gamesPlayed: 20 },
          onHome: vi.fn(),
        })
      );

      expect(html).not.toContain('(+10)');
      expect(html).not.toContain('(-10)');
      expect(html).toContain('Blue');
      expect(html).toContain('Green');
    });

    it('does NOT render Elo when isRanked is undefined (default false)', () => {
      const html = renderToStaticMarkup(
        React.createElement(GameOverModal, {
          result: mockResult,
          bluePlayer: { elo: 1200, gamesPlayed: 20 },
          greenPlayer: { elo: 1200, gamesPlayed: 20 },
          onHome: vi.fn(),
        })
      );

      expect(html).not.toContain('(+10)');
      expect(html).not.toContain('(-10)');
      expect(html).toContain('Blue');
      expect(html).toContain('Green');
    });

    it('uses theme tokens supporting both light and dark mode', () => {
      const html = renderToStaticMarkup(
        React.createElement(GameOverModal, {
          result: mockResult,
          isRanked: true,
          blueElo: { newElo: 1256, delta: 12 },
          greenElo: { newElo: 1142, delta: -11 },
          onHome: vi.fn(),
        })
      );

      // Verify semantic CSS variables are applied
      expect(html).toContain('var(--piece-blue)');
      expect(html).toContain('var(--piece-green)');
      expect(html).toContain('var(--accent-green)');
      expect(html).toContain('var(--accent-red)');
      expect(html).toContain('var(--text-primary)');
      expect(html).toContain('var(--font-mono)');
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
  });
});
