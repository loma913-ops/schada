import { describe, it, expect } from 'vitest';
import { calculateMoveClocks, isGameTimedOut, validateClockDependencies } from '../gameClock';
import { computeMoveTransition } from '../gameTransitions';
import type { GameRoom } from '../gameTypes';
import { createInitialGameState, getLegalMovesForSquare } from '@/core/schada/engine';
import { LOBBY_CONFIG } from '@/components/lobby/lobbyConfig';
import { CANONICAL_DIGITAL_CLOCK_CONFIG } from '@/components/game/digitalClockConfig';

describe('Game Clock & Correspondence Time Control', () => {
  const initialBoard = createInitialGameState();
  const msPerSecond = CANONICAL_DIGITAL_CLOCK_CONFIG.timeUnits.msPerSecond;
  const msPerMinute = LOBBY_CONFIG.secondsPerMinute * msPerSecond;
  const msPerHour = CANONICAL_DIGITAL_CLOCK_CONFIG.timeUnits.minutesPerHour * msPerMinute;
  const msPerDay = CANONICAL_DIGITAL_CLOCK_CONFIG.timeUnits.hoursPerDay * msPerHour;
  const twoDaysMinutes = 2 * LOBBY_CONFIG.correspondenceCutoffMinutes;
  const twoDaysMs = 2 * msPerDay;

  const createMockGame = (overrides: Partial<GameRoom> = {}): GameRoom => ({
    id: 'test_game_1',
    isPrivate: false,
    status: 'in_progress',
    createdAt: Date.now() - 100000,
    timeControlMinutes: twoDaysMinutes,
    incrementSeconds: 0,
    isRanked: false,
    creatorColorPref: 'white',
    whitePlayer: { id: 'p_white', username: 'whitePlayer', elo: 1500, sessionToken: 'tok1' },
    blackPlayer: { id: 'p_black', username: 'blackPlayer', elo: 1500, sessionToken: 'tok2' },
    boardState: initialBoard,
    currentTurn: 'white',
    whiteTimeMs: twoDaysMs,
    blackTimeMs: twoDaysMs,
    lastTurnStartTimeMs: Date.now() - msPerHour,
    ...overrides,
  });

  describe('calculateMoveClocks for Correspondence Games', () => {
    it('resets clock to full per-move duration (2 days) after white completes a move', () => {
      const game = createMockGame({
        timeControlMinutes: twoDaysMinutes,
        whiteTimeMs: twoDaysMs,
        blackTimeMs: twoDaysMs,
        lastTurnStartTimeMs: Date.now() - 5 * msPerHour,
      });

      const now = Date.now();
      const result = calculateMoveClocks(game, 'white', now);

      // White completes move -> resets to 2 days (Days per move)
      expect(result.nextWhiteTime).toBe(twoDaysMs);
      // Black's upcoming move is allocated full 2 days
      expect(result.nextBlackTime).toBe(twoDaysMs);
    });

    it('resets clock to full per-move duration (2 days) after black completes a move', () => {
      const game = createMockGame({
        timeControlMinutes: twoDaysMinutes,
        currentTurn: 'black',
        whiteTimeMs: twoDaysMs,
        blackTimeMs: twoDaysMs,
        lastTurnStartTimeMs: Date.now() - 20 * msPerHour,
      });

      const now = Date.now();
      const result = calculateMoveClocks(game, 'black', now);

      // Black completes move -> resets to 2 days
      expect(result.nextBlackTime).toBe(twoDaysMs);
      // White's upcoming move is allocated full 2 days
      expect(result.nextWhiteTime).toBe(twoDaysMs);
    });

    it('resets clock to 1 day per move for 1-day correspondence games (1440 min cutoff)', () => {
      const oneDayMs = msPerDay;
      const game = createMockGame({
        timeControlMinutes: LOBBY_CONFIG.correspondenceCutoffMinutes,
        whiteTimeMs: oneDayMs,
        blackTimeMs: oneDayMs,
        lastTurnStartTimeMs: Date.now() - 10 * msPerHour,
      });

      const now = Date.now();
      const result = calculateMoveClocks(game, 'white', now);

      expect(result.nextWhiteTime).toBe(oneDayMs);
      expect(result.nextBlackTime).toBe(oneDayMs);
    });

    it('resets clock to 7 days per move for 7-day correspondence games', () => {
      const sevenDaysMinutes = 7 * LOBBY_CONFIG.correspondenceCutoffMinutes;
      const sevenDaysMs = 7 * msPerDay;
      const game = createMockGame({
        timeControlMinutes: sevenDaysMinutes,
        whiteTimeMs: sevenDaysMs,
        blackTimeMs: sevenDaysMs,
        lastTurnStartTimeMs: Date.now() - 3 * msPerDay,
      });

      const now = Date.now();
      const result = calculateMoveClocks(game, 'white', now);

      expect(result.nextWhiteTime).toBe(sevenDaysMs);
      expect(result.nextBlackTime).toBe(sevenDaysMs);
    });
  });

  describe('calculateMoveClocks for Real-Time & Classical Games (Strict Non-Impact)', () => {
    it('does NOT reset clocks for standard real-time games (5 min)', () => {
      const initialMs = 5 * msPerMinute;
      const elapsedMs = 15 * msPerSecond;
      const turnStart = Date.now() - elapsedMs;

      const game = createMockGame({
        timeControlMinutes: 5,
        incrementSeconds: 0,
        whiteTimeMs: initialMs,
        blackTimeMs: initialMs,
        lastTurnStartTimeMs: turnStart,
      });

      const now = Date.now();
      const result = calculateMoveClocks(game, 'white', now);

      // Must decrement elapsed time, strictly not resetting
      expect(result.nextWhiteTime).toBeLessThan(initialMs);
      expect(result.nextWhiteTime).toBe(initialMs - (now - turnStart));
      expect(result.nextBlackTime).toBe(initialMs);
    });

    it('correctly applies Fischer increment and decrements elapsed time in real-time games', () => {
      const initialMs = 3 * msPerMinute;
      const elapsedMs = 10 * msPerSecond;
      const incrementSec = 2;
      const turnStart = Date.now() - elapsedMs;

      const game = createMockGame({
        timeControlMinutes: 3,
        incrementSeconds: incrementSec,
        whiteTimeMs: initialMs,
        blackTimeMs: initialMs,
        lastTurnStartTimeMs: turnStart,
      });

      const now = Date.now();
      const result = calculateMoveClocks(game, 'white', now);

      const expectedWhite = initialMs - (now - turnStart) + (incrementSec * msPerSecond);
      expect(result.nextWhiteTime).toBe(expectedWhite);
      expect(result.nextBlackTime).toBe(initialMs);
    });

    it('maintains clock values unchanged for unlimited games (0 min)', () => {
      const game = createMockGame({
        timeControlMinutes: 0,
        incrementSeconds: 0,
        whiteTimeMs: 0,
        blackTimeMs: 0,
        lastTurnStartTimeMs: Date.now() - msPerMinute,
      });

      const result = calculateMoveClocks(game, 'white', Date.now());
      expect(result.nextWhiteTime).toBe(0);
      expect(result.nextBlackTime).toBe(0);
    });
  });

  describe('computeMoveTransition Integration with Correspondence Clocks', () => {
    it('integrates correspondence clock reset into computeMoveTransition payload', () => {
      const game = createMockGame({
        timeControlMinutes: twoDaysMinutes,
        whiteTimeMs: twoDaysMs,
        blackTimeMs: twoDaysMs,
        lastTurnStartTimeMs: Date.now() - 12 * msPerHour,
      });

      const legalMoves = getLegalMovesForSquare(game.boardState.board, 'a1');
      const testMove = legalMoves[0];
      expect(testMove).toBeDefined();

      const now = Date.now();
      const updatePayload = computeMoveTransition(game, testMove, 'white', now);

      expect(updatePayload.whiteTimeMs).toBe(twoDaysMs);
      expect(updatePayload.blackTimeMs).toBe(twoDaysMs);
      expect(updatePayload.currentTurn).toBe('black');
      expect(updatePayload.lastTurnStartTimeMs).toBe(now);
    });
  });

  describe('isGameTimedOut in Correspondence vs Real-Time', () => {
    it('evaluates correspondence game as timed out when move exceeds allotted days', () => {
      const game = createMockGame({
        timeControlMinutes: twoDaysMinutes,
        currentTurn: 'white',
        whiteTimeMs: twoDaysMs,
        // Turn started 3 days ago (exceeds 2-day limit)
        lastTurnStartTimeMs: Date.now() - 3 * msPerDay,
      });

      const result = isGameTimedOut(game);
      expect(result.timedOut).toBe(true);
      expect(result.timedOutColor).toBe('white');
    });

    it('evaluates correspondence game as not timed out when within allotted days', () => {
      const game = createMockGame({
        timeControlMinutes: twoDaysMinutes,
        currentTurn: 'white',
        whiteTimeMs: twoDaysMs,
        // Turn started 1 day ago (within 2-day limit)
        lastTurnStartTimeMs: Date.now() - 1 * msPerDay,
      });

      const result = isGameTimedOut(game);
      expect(result.timedOut).toBe(false);
    });
  });

  describe('validateClockDependencies', () => {
    it('validates canonical lobby and clock configs without error', () => {
      expect(() => validateClockDependencies()).not.toThrow();
    });
  });
});
