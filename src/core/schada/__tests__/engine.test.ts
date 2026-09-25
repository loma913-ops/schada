import { describe, it, expect } from 'vitest';
import {
  createInitialGameState,
  getAllLegalMoves,
  getLegalMovesForSquare,
  executeMove,
  createEmptyBoard,
} from '../engine';
import { calculateScoreBreakdown, evaluateGameResult } from '../scoring';
import { SCHADA_VECTORS, squareToColRow, colRowToSquare } from '../vectors';
import type { Square } from '../types';

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

  it('ensures pieces must complete their full designated paths and cannot stop early', () => {
    const board = createEmptyBoard();

    // 1. Piece on a5 has bent path: 2 right, 2 down -> c3.
    // Must NOT be able to stop early on b5 ([1, 0]) or c5 ([2, 0]).
    board['a5'] = {
      id: 'p_a5',
      type: 'pawn',
      color: 'blue',
      hasLeftBase: true,
      hasReachedGoal: false,
    };
    const a5Moves = getLegalMovesForSquare(board, 'a5');
    const a5Destinations = a5Moves.map((m) => m.to);
    expect(a5Destinations).toContain('c3'); // Full completed path
    expect(a5Destinations).not.toContain('b5'); // Cannot stop early on intermediate step
    expect(a5Destinations).not.toContain('c5'); // Cannot stop early at the corner bend

    // 2. Piece on h4 has bent path: 2 left, 2 up -> f6.
    // Must NOT be able to stop early on g4 ([-1, 0]) or f4 ([-2, 0]).
    board['h4'] = {
      id: 'p_h4',
      type: 'pawn',
      color: 'blue',
      hasLeftBase: true,
      hasReachedGoal: false,
    };
    const h4Moves = getLegalMovesForSquare(board, 'h4');
    const h4Destinations = h4Moves.map((m) => m.to);
    expect(h4Destinations).toContain('f6'); // Full completed path
    expect(h4Destinations).not.toContain('g4'); // Cannot stop early on intermediate step
    expect(h4Destinations).not.toContain('f4'); // Cannot stop early at the corner bend

    // 3. Piece on h3 has 3-square diagonal: -> e6.
    // Must NOT be able to stop early on g4 ([-1, 1]) or f5 ([-2, 2]).
    board['h3'] = {
      id: 'p_h3',
      type: 'pawn',
      color: 'blue',
      hasLeftBase: true,
      hasReachedGoal: false,
    };
    const h3Moves = getLegalMovesForSquare(board, 'h3');
    const h3Destinations = h3Moves.map((m) => m.to);
    expect(h3Destinations).toContain('e6'); // Full completed diagonal
    expect(h3Destinations).not.toContain('g4'); // Cannot stop after 1 step
    expect(h3Destinations).not.toContain('f5'); // Cannot stop after 2 steps

    // 4. Piece on a6 has 3-square diagonal: -> d3.
    // Must NOT be able to stop early on b5 ([1, -1]) or c4 ([2, -2]).
    board['a6'] = {
      id: 'p_a6',
      type: 'pawn',
      color: 'blue',
      hasLeftBase: true,
      hasReachedGoal: false,
    };
    const a6Moves = getLegalMovesForSquare(board, 'a6');
    const a6Destinations = a6Moves.map((m) => m.to);
    expect(a6Destinations).toContain('d3'); // Full completed diagonal
    expect(a6Destinations).not.toContain('b5'); // Cannot stop after 1 step
    expect(a6Destinations).not.toContain('c4'); // Cannot stop after 2 steps

    // 5. Piece on f2 has bent path: 2 right, 1 down -> h1.
    // Must NOT be able to stop early on g2 ([1, 0]) or h2 ([2, 0]).
    board['f2'] = {
      id: 'p_f2',
      type: 'pawn',
      color: 'blue',
      hasLeftBase: false,
      hasReachedGoal: false,
    };
    const f2Moves = getLegalMovesForSquare(board, 'f2');
    const f2Destinations = f2Moves.map((m) => m.to);
    expect(f2Destinations).toContain('h1');
    expect(f2Destinations).not.toContain('g2');
    expect(f2Destinations).not.toContain('h2');
  });

  it('enforces board-wide that no piece can ever land on intermediate path squares across all 64 squares', () => {
    const squares = Object.keys(SCHADA_VECTORS) as Square[];
    for (const sq of squares) {
      const board = createEmptyBoard();
      // Place a piece with hasLeftBase=true, hasReachedGoal=false
      board[sq] = {
        id: `test_pawn_${sq}`,
        type: 'pawn',
        color: 'blue',
        hasLeftBase: true,
        hasReachedGoal: false,
      };

      const legalMoves = getLegalMovesForSquare(board, sq);
      const destinations = new Set(legalMoves.map((m) => m.to));

      const [col, row] = squareToColRow(sq);
      for (const vector of SCHADA_VECTORS[sq]) {
        for (const [stepDc, stepDr] of vector.path) {
          const stepCol = col + stepDc;
          const stepRow = row + stepDr;
          if (stepCol >= 0 && stepCol <= 7 && stepRow >= 0 && stepRow <= 7) {
            const intermediateSquare = colRowToSquare(stepCol, stepRow)!;
            expect(destinations.has(intermediateSquare)).toBe(false);
          }
        }
      }
    }
  });

  it('prohibits moving or capturing when an enemy piece occupies an intermediate square', () => {
    const board = createEmptyBoard();

    // Blue piece on f2 with vector targeting h1 via path [g2, h2]
    board['f2'] = {
      id: 'p_f2',
      type: 'pawn',
      color: 'blue',
      hasLeftBase: false,
      hasReachedGoal: false,
    };

    // Enemy piece on intermediate square g2
    board['g2'] = {
      id: 'ep_g2',
      type: 'pawn',
      color: 'green',
      hasLeftBase: true,
      hasReachedGoal: false,
    };

    const movesWithEnemyOnG2 = getLegalMovesForSquare(board, 'f2');
    // Cannot reach h1, cannot land on g2 (no early capture on intermediate square), cannot land on h2
    expect(movesWithEnemyOnG2.some((m) => m.to === 'h1')).toBe(false);
    expect(movesWithEnemyOnG2.some((m) => m.to === 'g2')).toBe(false);
    expect(movesWithEnemyOnG2.some((m) => m.to === 'h2')).toBe(false);

    // Now clear g2 and place enemy on h2 instead
    board['g2'] = null;
    board['h2'] = {
      id: 'ep_h2',
      type: 'pawn',
      color: 'green',
      hasLeftBase: true,
      hasReachedGoal: false,
    };

    const movesWithEnemyOnH2 = getLegalMovesForSquare(board, 'f2');
    expect(movesWithEnemyOnH2.some((m) => m.to === 'h1')).toBe(false);
    expect(movesWithEnemyOnH2.some((m) => m.to === 'h2')).toBe(false);
  });

  it('allows Field Officers to leap friendly pieces to complete full path without stopping on them', () => {
    const board = createEmptyBoard();

    // Blue Field Officer on f2 targeting h1 via path [g2, h2]
    board['f2'] = {
      id: 'fo_f2',
      type: 'field_officer',
      color: 'blue',
      hasLeftBase: false,
      hasReachedGoal: false,
    };

    // Friendly piece on intermediate square h2
    board['h2'] = {
      id: 'p_h2',
      type: 'pawn',
      color: 'blue',
      hasLeftBase: false,
      hasReachedGoal: false,
    };

    const foMoves = getLegalMovesForSquare(board, 'f2');
    // Field Officer can complete the full leap to h1
    expect(foMoves.some((m) => m.to === 'h1')).toBe(true);
    // But cannot stop on friendly h2 or g2
    expect(foMoves.some((m) => m.to === 'h2')).toBe(false);
    expect(foMoves.some((m) => m.to === 'g2')).toBe(false);
  });
});

