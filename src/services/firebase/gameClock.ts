import type { PieceColor } from '@/core/schada/types';
import type { GameRoom, GameTimeoutResult } from './gameTypes';

/**
 * Evaluates whether an in-progress game has expired based on Fischer/standard clock limits.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time, consisting of atomic numeric comparisons and arithmetic.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - Bounded strictly at O(1) independent of total game history, room size, or global data volume.
 *
 * @param game The target GameRoom to inspect.
 * @returns GameTimeoutResult indicating whether the game has timed out and which player's clock expired.
 */
export function isGameTimedOut(game: GameRoom | null | undefined): GameTimeoutResult {
  if (!game || typeof game !== 'object') {
    return { timedOut: false };
  }
  if (game.status !== 'in_progress' || typeof game.timeControlMinutes !== 'number' || game.timeControlMinutes <= 0) {
    return { timedOut: false };
  }
  if (game.currentTurn !== 'blue' && game.currentTurn !== 'green') {
    return { timedOut: false };
  }
  const now = Date.now();
  const elapsed = typeof game.lastTurnStartTimeMs === 'number' && !isNaN(game.lastTurnStartTimeMs)
    ? Math.max(0, now - game.lastTurnStartTimeMs)
    : 0;
  const currentTurn = game.currentTurn;
  const currentClockMs = currentTurn === 'blue' ? game.blueTimeMs : game.greenTimeMs;
  if (typeof currentClockMs !== 'number' || isNaN(currentClockMs)) {
    return { timedOut: false };
  }
  const remainingTime = currentClockMs - elapsed;
  if (remainingTime <= 0) {
    return { timedOut: true, timedOutColor: currentTurn };
  }
  return { timedOut: false };
}

/**
 * Calculates updated clock times for players after executing a turn, factoring in elapsed time and Fischer increment.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant arithmetic calculation.
 * - Auxiliary Space Complexity: O(1) constant scalar allocation.
 */
export function calculateMoveClocks(
  game: GameRoom,
  playerColor: PieceColor,
  now: number
): { nextBlueTime: number; nextGreenTime: number } {
  let nextBlueTime = game.blueTimeMs;
  let nextGreenTime = game.greenTimeMs;

  if (game.timeControlMinutes > 0 && game.lastTurnStartTimeMs) {
    const elapsed = Math.max(0, now - game.lastTurnStartTimeMs);
    const incrementMs = (game.incrementSeconds || 0) * 1000;

    if (playerColor === 'blue') {
      nextBlueTime = Math.max(0, game.blueTimeMs - elapsed + incrementMs);
    } else {
      nextGreenTime = Math.max(0, game.greenTimeMs - elapsed + incrementMs);
    }
  }

  return { nextBlueTime, nextGreenTime };
}
