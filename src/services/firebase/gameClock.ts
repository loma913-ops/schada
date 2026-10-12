import type { PieceColor } from '@/core/schada/types';
import type { GameRoom, GameTimeoutResult } from './gameTypes';
import { LOBBY_CONFIG } from '@/components/lobby/lobbyConfig';
import { CANONICAL_DIGITAL_CLOCK_CONFIG } from '@/components/game/digitalClockConfig';

/**
 * Validates canonical configuration dependencies required for accurate clock computations.
 * Throws an explicit, descriptive Error if required configuration is missing or invalid.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant scalar property checks.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) strictly flat, invariant to matchmaking scale or room volume.
 */
export function validateClockDependencies(): void {
  if (
    !LOBBY_CONFIG ||
    typeof LOBBY_CONFIG.correspondenceCutoffMinutes !== 'number' ||
    typeof LOBBY_CONFIG.secondsPerMinute !== 'number'
  ) {
    throw new Error('GameClock: Lobby configuration is missing or invalid.');
  }
  if (
    !CANONICAL_DIGITAL_CLOCK_CONFIG ||
    typeof CANONICAL_DIGITAL_CLOCK_CONFIG.timeUnits?.msPerSecond !== 'number'
  ) {
    throw new Error('GameClock: Digital clock configuration is missing or invalid.');
  }
}

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
 * Calculates updated clock times for players after executing a turn.
 * In correspondence games (timeControlMinutes >= correspondenceCutoffMinutes), the clock resets
 * to the full allocation per move for the player who completed the move (and provides full time for the incoming player).
 * In real-time games, decrements elapsed time and applies Fischer increment.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant arithmetic calculation.
 * - Auxiliary Space Complexity: O(1) constant scalar allocation.
 *
 * Growth Rate:
 * - O(1) flat, perfectly scalable invariant to move history length, turn counts, or active player volume.
 */
export function calculateMoveClocks(
  game: GameRoom,
  playerColor: PieceColor,
  now: number
): { nextBlueTime: number; nextGreenTime: number } {
  validateClockDependencies();

  let nextBlueTime = game.blueTimeMs;
  let nextGreenTime = game.greenTimeMs;

  const isCorrespondence =
    typeof game.timeControlMinutes === 'number' &&
    game.timeControlMinutes >= LOBBY_CONFIG.correspondenceCutoffMinutes;

  const msPerSecond = CANONICAL_DIGITAL_CLOCK_CONFIG.timeUnits.msPerSecond;
  const msPerMinute = LOBBY_CONFIG.secondsPerMinute * msPerSecond;

  if (isCorrespondence) {
    const moveLimitMs = game.timeControlMinutes * msPerMinute;
    return { nextBlueTime: moveLimitMs, nextGreenTime: moveLimitMs };
  }

  if (game.timeControlMinutes > 0 && game.lastTurnStartTimeMs) {
    const elapsed = Math.max(0, now - game.lastTurnStartTimeMs);
    const incrementMs = (game.incrementSeconds || 0) * msPerSecond;

    if (playerColor === 'blue') {
      nextBlueTime = Math.max(0, game.blueTimeMs - elapsed + incrementMs);
    } else {
      nextGreenTime = Math.max(0, game.greenTimeMs - elapsed + incrementMs);
    }
  }

  return { nextBlueTime, nextGreenTime };
}
