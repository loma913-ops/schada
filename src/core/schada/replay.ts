import type { BoardState, Move } from './types';
import { createInitialGameState, executeMove } from './engine';
import {
  type ReplayConfig,
  CANONICAL_REPLAY_CONFIG,
  validateReplayConfig,
  ReplayConfigError,
} from './replayConfig';

/**
 * Computes an array of cumulative game states for the entire move history.
 * - Element 0: Initial starting position before any moves were played (index -1).
 * - Element k + 1: Board state after executing move k (index k).
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(N) where N is moveHistory.length. Each move is executed once in sequence.
 * - Auxiliary Space Complexity: O(N) to store references to the board states.
 *
 * Growth Rate:
 * - O(N) linear time for complete computation.
 * - Once computed, arbitrary historical state lookups by index are O(1) constant time.
 */
export function computeCumulativeGameStates(
  moveHistory: Move[],
  finalGameState?: BoardState,
  config: ReplayConfig = CANONICAL_REPLAY_CONFIG
): BoardState[] {
  validateReplayConfig(config);

  if (moveHistory.length > config.maxMoveHistoryLimit) {
    throw new ReplayConfigError(
      `Move history length (${moveHistory.length}) exceeds configured maxMoveHistoryLimit (${config.maxMoveHistoryLimit}).`
    );
  }

  const initial = createInitialGameState();
  const states: BoardState[] = [initial];

  let current = initial;
  const historyLen = moveHistory.length;

  for (let i = 0; i < historyLen; i++) {
    if (i === historyLen - 1 && finalGameState) {
      states.push(finalGameState);
    } else {
      current = executeMove(current, moveHistory[i]);
      states.push(current);
    }
  }

  return states;
}

/**
 * Computes the game state at a specific historical move index.
 * - targetIndex <= initialMoveIndex: Returns starting game state.
 * - 0 <= targetIndex < moveHistory.length - 1: Replayed board state up to targetIndex.
 * - targetIndex >= moveHistory.length - 1: Final/live game state.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(K) where K = min(targetIndex + 1, moveHistory.length).
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(K) sub-linear relative to total game history when inspecting early moves.
 */
export function computeGameStateAtMove(
  moveHistory: Move[],
  targetIndex: number,
  finalGameState?: BoardState,
  config: ReplayConfig = CANONICAL_REPLAY_CONFIG
): BoardState {
  validateReplayConfig(config);

  if (moveHistory.length === 0 || targetIndex <= config.initialMoveIndex) {
    return createInitialGameState();
  }

  if (finalGameState && targetIndex >= moveHistory.length - 1) {
    return finalGameState;
  }

  let state = createInitialGameState();
  const maxMoves = Math.min(targetIndex + 1, moveHistory.length);
  for (let i = 0; i < maxMoves; i++) {
    state = executeMove(state, moveHistory[i]);
  }

  return state;
}
