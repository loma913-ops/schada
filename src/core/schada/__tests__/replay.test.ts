import { describe, it, expect } from 'vitest';
import { computeCumulativeGameStates, computeGameStateAtMove } from '../replay';
import {
  CANONICAL_REPLAY_CONFIG,
  validateReplayConfig,
  ReplayConfigError,
  type ReplayConfig,
} from '../replayConfig';
import { createInitialGameState, executeMove, getLegalMovesForSquare, resignGame } from '../engine';
import type { Move } from '../types';

describe('Replay configuration validation', () => {
  it('canonical CANONICAL_REPLAY_CONFIG passes validation', () => {
    expect(() => validateReplayConfig(CANONICAL_REPLAY_CONFIG)).not.toThrow();
  });

  it('throws ReplayConfigError if configuration object is missing or null', () => {
    expect(() => validateReplayConfig(null as unknown as ReplayConfig)).toThrowError(
      ReplayConfigError
    );
    expect(() => validateReplayConfig(null as unknown as ReplayConfig)).toThrowError(
      'ReplayConfigError: Configuration object is missing or null.'
    );
  });

  it('throws ReplayConfigError if initialMoveIndex is invalid', () => {
    const invalidConfig = {
      ...CANONICAL_REPLAY_CONFIG,
      initialMoveIndex: NaN,
    };
    expect(() => validateReplayConfig(invalidConfig)).toThrowError(
      'ReplayConfigError: Invalid initialMoveIndex: expected number, received NaN.'
    );
  });

  it('throws ReplayConfigError if maxMoveHistoryLimit is non-positive or not an integer', () => {
    const invalidLimit = {
      ...CANONICAL_REPLAY_CONFIG,
      maxMoveHistoryLimit: -1,
    };
    expect(() => validateReplayConfig(invalidLimit)).toThrowError(
      'ReplayConfigError: Invalid maxMoveHistoryLimit: expected positive integer, received -1.'
    );
  });
});

describe('computeCumulativeGameStates and computeGameStateAtMove', () => {
  it('computes cumulative game states with O(1) lookup index mapping', () => {
    const initialState = createInitialGameState();
    const legalBlueMoves = getLegalMovesForSquare(initialState.board, 'c1');
    expect(legalBlueMoves.length).toBeGreaterThan(0);
    const move1 = legalBlueMoves[0];

    const stateAfterMove1 = executeMove(initialState, move1);
    const legalGreenMoves = getLegalMovesForSquare(stateAfterMove1.board, 'd8');
    expect(legalGreenMoves.length).toBeGreaterThan(0);
    const move2 = legalGreenMoves[0];

    const history = [move1, move2];
    const states = computeCumulativeGameStates(history);

    // states[0] corresponds to index -1 (start of game)
    expect(states).toHaveLength(3);
    expect(states[0].board).toEqual(initialState.board);
    expect(states[0].currentTurn).toBe('blue');

    // states[1] corresponds to index 0 (after move 1)
    expect(states[1].board[move1.to]).toBeDefined();
    expect(states[1].board[move1.from]).toBeNull();
    expect(states[1].currentTurn).toBe('green');

    // states[2] corresponds to index 1 (after move 2)
    expect(states[2].board[move2.to]).toBeDefined();
    expect(states[2].board[move2.from]).toBeNull();
    expect(states[2].currentTurn).toBe('blue');
  });

  it('returns initial game state when history is empty or targetIndex is -1', () => {
    const initialState = createInitialGameState();
    expect(computeGameStateAtMove([], -1)).toEqual(initialState);
    expect(computeGameStateAtMove([], 5)).toEqual(initialState);

    const dummyMove: Move = {
      from: 'a2',
      to: 'a3',
      piece: { id: 'blue_pawn_a2', color: 'blue', type: 'pawn', hasLeftBase: false, hasReachedGoal: false },
      intermediateSquares: [],
      notation: 'Pa2-a3',
    };

    const stateAtStart = computeGameStateAtMove([dummyMove], -1);
    expect(stateAtStart.board).toEqual(initialState.board);
    expect(stateAtStart.currentTurn).toBe('blue');
    expect(stateAtStart.moveHistory).toHaveLength(0);
  });

  it('returns finalGameState when targetIndex is at or beyond the latest move', () => {
    const initialState = createInitialGameState();
    const move: Move = {
      from: 'a2',
      to: 'a3',
      piece: { id: 'blue_pawn_a2', color: 'blue', type: 'pawn', hasLeftBase: false, hasReachedGoal: false },
      intermediateSquares: [],
      notation: 'Pa2-a3',
    };
    const finalState = resignGame(initialState, 'green');

    const result = computeGameStateAtMove([move], 0, finalState);
    expect(result).toBe(finalState);
    expect(result.isGameOver).toBe(true);
    expect(result.result?.winReason).toBe('resignation');
  });

  it('throws ReplayConfigError if move history exceeds configured max limit', () => {
    const tightConfig: ReplayConfig = {
      initialMoveIndex: -1,
      maxMoveHistoryLimit: 1,
    };

    const dummyMove: Move = {
      from: 'a2',
      to: 'a3',
      piece: { id: 'blue_pawn_a2', color: 'blue', type: 'pawn', hasLeftBase: false, hasReachedGoal: false },
      intermediateSquares: [],
      notation: 'Pa2-a3',
    };

    expect(() => computeCumulativeGameStates([dummyMove, dummyMove], undefined, tightConfig)).toThrowError(
      ReplayConfigError
    );
  });
});
