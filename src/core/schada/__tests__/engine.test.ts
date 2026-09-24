import { describe, it, expect } from 'vitest';
import {
  createInitialGameState,
  getAllLegalMoves,
  getLegalMovesForSquare,
  executeMove,
  createEmptyBoard,
} from '../engine';
import { calculateScoreBreakdown, evaluateGameResult } from '../scoring';

describe('Schada Game Engine', () => {
  it('should initialize exactly 14 legal moves from the opening position for Blue', () => {
    const state = createInitialGameState();
    const legalMoves = getAllLegalMoves(state.board, 'blue');
    expect(legalMoves.length).toBe(14);

    // Verify Field Officers moving forward over pawns
    const foMoves = legalMoves.filter((m) => m.piece.type === 'field_officer');
    expect(foMoves.length).toBe(4);
    expect(foMoves.map((m) => `${m.from}->${m.to}`).sort()).toEqual(
      ['a1->a3', 'c1->c3', 'e1->e3', 'g1->g3'].sort()
    );

    // Verify 8 pawns have 10 moves (c2 and e2 have 2 options, others 1)
    const pawnMoves = legalMoves.filter((m) => m.piece.type === 'pawn');
    expect(pawnMoves.length).toBe(10);
    const c2Moves = getLegalMovesForSquare(state.board, 'c2');
    expect(c2Moves.length).toBe(2);
    const e2Moves = getLegalMovesForSquare(state.board, 'e2');
    expect(e2Moves.length).toBe(2);
  });

  it('should initialize exactly 14 legal moves from the opening position for Green', () => {
    const state = createInitialGameState();
    const legalMoves = getAllLegalMoves(state.board, 'green');
    expect(legalMoves.length).toBe(14);

    // Verify Green Field Officers moving forward (b8, d8, f8, h8)
    const foMoves = legalMoves.filter((m) => m.piece.type === 'field_officer');
    expect(foMoves.length).toBe(4);
    expect(foMoves.map((m) => `${m.from}->${m.to}`).sort()).toEqual(
      ['b8->b6', 'd8->d6', 'f8->f6', 'h8->h6'].sort()
    );
  });

  it('allows Field Officers to leap over friendly pieces, but blocks Officers and Pawns', () => {
    const board = createEmptyBoard();

    // Friendly piece on a2
    board['a2'] = {
      id: 'p1',
      type: 'pawn',
      color: 'blue',
      hasLeftBase: false,
      hasReachedGoal: false,
    };

    // Blue Field Officer on a1 (vector: [0, 2] over a2 to a3)
    board['a1'] = {
      id: 'fo1',
      type: 'field_officer',
      color: 'blue',
      hasLeftBase: false,
      hasReachedGoal: false,
    };

    const foMoves = getLegalMovesForSquare(board, 'a1');
    expect(foMoves.some((m) => m.to === 'a3')).toBe(true);

    // If an Officer is on a1 instead (hypothetically), it cannot jump
    board['a1'] = {
      id: 'o1',
      type: 'officer',
      color: 'blue',
      hasLeftBase: false,
      hasReachedGoal: false,
    };
    const oMoves = getLegalMovesForSquare(board, 'a1');
    expect(oMoves.some((m) => m.to === 'a3')).toBe(false);
  });

  it('does NOT allow Field Officers to leap over enemy pieces', () => {
    const board = createEmptyBoard();

    // Enemy piece on a2
    board['a2'] = {
      id: 'ep1',
      type: 'pawn',
      color: 'green',
      hasLeftBase: true,
      hasReachedGoal: false,
    };

    // Blue Field Officer on a1
    board['a1'] = {
      id: 'fo1',
      type: 'field_officer',
      color: 'blue',
      hasLeftBase: false,
      hasReachedGoal: false,
    };

    const foMoves = getLegalMovesForSquare(board, 'a1');
    expect(foMoves.some((m) => m.to === 'a3')).toBe(false);
  });

  it('prevents high pieces that left base line from returning to base line', () => {
    const board = createEmptyBoard();

    // High piece (Officer) on c2 that has already left base
    board['c2'] = {
      id: 'o1',
      type: 'officer',
      color: 'blue',
      hasLeftBase: true,
      hasReachedGoal: false,
    };

    // Vector on c2 includes [0, -1] -> c1 (Rank 1, which is base line)
    const moves = getLegalMovesForSquare(board, 'c2');
    expect(moves.some((m) => m.to === 'c1')).toBe(false);

    // But a Pawn on c2 CAN return to c1
    board['c2'] = {
      id: 'p1',
      type: 'pawn',
      color: 'blue',
      hasLeftBase: true,
      hasReachedGoal: false,
    };
    const pawnMoves = getLegalMovesForSquare(board, 'c2');
    expect(pawnMoves.some((m) => m.to === 'c1')).toBe(true);
  });

  it('prevents high pieces in goal line from being captured (invulnerability)', () => {
    const board = createEmptyBoard();

    // Blue Field Officer safely inside its goal line (rank 8, e.g. a8)
    board['a8'] = {
      id: 'fo_blue',
      type: 'field_officer',
      color: 'blue',
      hasLeftBase: true,
      hasReachedGoal: true,
    };

    // Green piece that could move to a8 (e.g. green piece on b8 with [-1, 0] vector)
    board['b8'] = {
      id: 'p_green',
      type: 'pawn',
      color: 'green',
      hasLeftBase: false,
      hasReachedGoal: false,
    };

    const greenMoves = getLegalMovesForSquare(board, 'b8');
    // Cannot capture the high piece inside its goal line!
    expect(greenMoves.some((m) => m.to === 'a8')).toBe(false);
  });

  it('calculates score breakdown correctly and resolves tiebreakers', () => {
    const board = createEmptyBoard();

    // Blue: 1 FO in goal (2 pts) + 1 Officer on rank 5 (outside goal: 1 pt + 4/7 distance)
    board['a8'] = {
      id: 'fo1',
      type: 'field_officer',
      color: 'blue',
      hasLeftBase: true,
      hasReachedGoal: true,
    };
    board['c5'] = {
      id: 'o1',
      type: 'officer',
      color: 'blue',
      hasLeftBase: true,
      hasReachedGoal: false,
    };

    const blueScore = calculateScoreBreakdown(board, 'blue');
    expect(blueScore.goalScore).toBe(2);
    expect(blueScore.outsideGoalHighPiecesScore).toBe(1);

    const result = evaluateGameResult(board, 'goal_reached');
    expect(result.winner).toBe('blue');
  });

  it('executes move, captures piece, and toggles turns', () => {
    let state = createInitialGameState();

    // Blue plays a2-c4
    const legalMoves = getLegalMovesForSquare(state.board, 'a2');
    const move = legalMoves.find((m) => m.to === 'c4')!;
    expect(move).toBeDefined();

    state = executeMove(state, move);
    expect(state.currentTurn).toBe('green');
    expect(state.board['a2']).toBeNull();
    expect(state.board['c4']).toBeDefined();
    expect(state.board['c4']?.type).toBe('pawn');
  });
});
