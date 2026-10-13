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
    creatorColorPref: 'blue',
    bluePlayer: { id: 'p_blue', username: 'BluePlayer', elo: 1500, sessionToken: 'tok1' },
    greenPlayer: { id: 'p_green', username: 'GreenPlayer', elo: 1500, sessionToken: 'tok2' },
    boardState: initialBoard,
    currentTurn: 'blue',
    blueTimeMs: twoDaysMs,
    greenTimeMs: twoDaysMs,
    lastTurnStartTimeMs: Date.now() - msPerHour,
    ...overrides,
  });

  describe('calculateMoveClocks for Correspondence Games', () => {
    it('resets clock to full per-move duration (2 days) after blue completes a move', () => {
      const game = createMockGame({
        timeControlMinutes: twoDaysMinutes,
        blueTimeMs: twoDaysMs,
        greenTimeMs: twoDaysMs,
        lastTurnStartTimeMs: Date.now() - 5 * msPerHour,
      });

      const now = Date.now();
      const result = calculateMoveClocks(game, 'blue', now);

      // Blue completes move -> resets to 2 days (Days per move)
      expect(result.nextBlueTime).toBe(twoDaysMs);
      // Green's upcoming move is allocated full 2 days
      expect(result.nextGreenTime).toBe(twoDaysMs);
    });

    it('resets clock to full per-move duration (2 days) after green completes a move', () => {
      const game = createMockGame({
        timeControlMinutes: twoDaysMinutes,
        currentTurn: 'green',
        blueTimeMs: twoDaysMs,
        greenTimeMs: twoDaysMs,
        lastTurnStartTimeMs: Date.now() - 20 * msPerHour,
      });

      const now = Date.now();
      const result = calculateMoveClocks(game, 'green', now);

      // Green completes move -> resets to 2 days
      expect(result.nextGreenTime).toBe(twoDaysMs);
      // Blue's upcoming move is allocated full 2 days
      expect(result.nextBlueTime).toBe(twoDaysMs);
    });

    it('resets clock to 1 day per move for 1-day correspondence games (1440 min cutoff)', () => {
      const oneDayMs = msPerDay;
      const game = createMockGame({
        timeControlMinutes: LOBBY_CONFIG.correspondenceCutoffMinutes,
        blueTimeMs: oneDayMs,
        greenTimeMs: oneDayMs,
        lastTurnStartTimeMs: Date.now() - 10 * msPerHour,
      });

      const now = Date.now();
      const result = calculateMoveClocks(game, 'blue', now);

      expect(result.nextBlueTime).toBe(oneDayMs);
      expect(result.nextGreenTime).toBe(oneDayMs);
    });

    it('resets clock to 7 days per move for 7-day correspondence games', () => {
      const sevenDaysMinutes = 7 * LOBBY_CONFIG.correspondenceCutoffMinutes;
      const sevenDaysMs = 7 * msPerDay;
      const game = createMockGame({
        timeControlMinutes: sevenDaysMinutes,
        blueTimeMs: sevenDaysMs,
        greenTimeMs: sevenDaysMs,
        lastTurnStartTimeMs: Date.now() - 3 * msPerDay,
      });

      const now = Date.now();
      const result = calculateMoveClocks(game, 'blue', now);

      expect(result.nextBlueTime).toBe(sevenDaysMs);
      expect(result.nextGreenTime).toBe(sevenDaysMs);
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
        blueTimeMs: initialMs,
        greenTimeMs: initialMs,
        lastTurnStartTimeMs: turnStart,
      });

      const now = Date.now();
      const result = calculateMoveClocks(game, 'blue', now);

      // Must decrement elapsed time, strictly not resetting
      expect(result.nextBlueTime).toBeLessThan(initialMs);
      expect(result.nextBlueTime).toBe(initialMs - (now - turnStart));
      expect(result.nextGreenTime).toBe(initialMs);
    });

    it('correctly applies Fischer increment and decrements elapsed time in real-time games', () => {
      const initialMs = 3 * msPerMinute;
      const elapsedMs = 10 * msPerSecond;
      const incrementSec = 2;
      const turnStart = Date.now() - elapsedMs;

      const game = createMockGame({
        timeControlMinutes: 3,
        incrementSeconds: incrementSec,
        blueTimeMs: initialMs,
        greenTimeMs: initialMs,
        lastTurnStartTimeMs: turnStart,
      });

      const now = Date.now();
      const result = calculateMoveClocks(game, 'blue', now);

      const expectedBlue = initialMs - (now - turnStart) + (incrementSec * msPerSecond);
      expect(result.nextBlueTime).toBe(expectedBlue);
      expect(result.nextGreenTime).toBe(initialMs);
    });

    it('maintains clock values unchanged for unlimited games (0 min)', () => {
      const game = createMockGame({
        timeControlMinutes: 0,
        incrementSeconds: 0,
        blueTimeMs: 0,
        greenTimeMs: 0,
        lastTurnStartTimeMs: Date.now() - msPerMinute,
      });

      const result = calculateMoveClocks(game, 'blue', Date.now());
      expect(result.nextBlueTime).toBe(0);
      expect(result.nextGreenTime).toBe(0);
    });
  });

  describe('computeMoveTransition Integration with Correspondence Clocks', () => {
    it('integrates correspondence clock reset into computeMoveTransition payload', () => {
      const game = createMockGame({
        timeControlMinutes: twoDaysMinutes,
        blueTimeMs: twoDaysMs,
        greenTimeMs: twoDaysMs,
        lastTurnStartTimeMs: Date.now() - 12 * msPerHour,
      });

      const legalMoves = getLegalMovesForSquare(game.boardState.board, 'a1');
      const testMove = legalMoves[0];
      expect(testMove).toBeDefined();

      const now = Date.now();
      const updatePayload = computeMoveTransition(game, testMove, 'blue', now);

      expect(updatePayload.blueTimeMs).toBe(twoDaysMs);
      expect(updatePayload.greenTimeMs).toBe(twoDaysMs);
      expect(updatePayload.currentTurn).toBe('green');
      expect(updatePayload.lastTurnStartTimeMs).toBe(now);
    });
  });

  describe('isGameTimedOut in Correspondence vs Real-Time', () => {
    it('evaluates correspondence game as timed out when move exceeds allotted days', () => {
      const game = createMockGame({
        timeControlMinutes: twoDaysMinutes,
        currentTurn: 'blue',
        blueTimeMs: twoDaysMs,
        // Turn started 3 days ago (exceeds 2-day limit)
        lastTurnStartTimeMs: Date.now() - 3 * msPerDay,
      });

      const result = isGameTimedOut(game);
      expect(result.timedOut).toBe(true);
      expect(result.timedOutColor).toBe('blue');
    });

    it('evaluates correspondence game as not timed out when within allotted days', () => {
      const game = createMockGame({
        timeControlMinutes: twoDaysMinutes,
        currentTurn: 'blue',
        blueTimeMs: twoDaysMs,
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
