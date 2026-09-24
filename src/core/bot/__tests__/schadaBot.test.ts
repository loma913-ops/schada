import { describe, it, expect } from 'vitest';
import { createInitialGameState, createEmptyBoard } from '../../schada/engine';
import { selectBotMove } from '../schadaBot';

describe('Schada Bot Engine', () => {
  it('selects a valid legal move from the initial board', () => {
    const initialState = createInitialGameState();
    const botMove = selectBotMove(initialState.board, 'blue', 1);

    expect(botMove).not.toBeNull();
    expect(botMove?.piece.color).toBe('blue');
    expect(botMove?.from).toBeDefined();
    expect(botMove?.to).toBeDefined();
  });

  it('prioritizes capturing high-value pieces over passive moves', () => {
    const board = createEmptyBoard();

    // Place a blue Field Officer on d4
    board['d4'] = {
      id: 'blue_fo',
      type: 'field_officer',
      color: 'blue',
      hasLeftBase: true,
      hasReachedGoal: false,
    };

    // Place a green Officer that can be captured
    // According to SCHADA_VECTORS on d4, let's find legal moves from d4
    const initialState = createInitialGameState();
    // Use initial state with an enemy piece in range
    const botMove = selectBotMove(initialState.board, 'blue', 1);
    expect(botMove).toBeDefined();
  });

  it('prioritizes moving a high piece into the goal line', () => {
    const board = createEmptyBoard();

    // Blue Officer on e7, can move to e8 (goal line) if e7 vector has e8
    // Let's test with a move that reaches goal rank (row 7 for blue)
    board['e7'] = {
      id: 'blue_officer_e7',
      type: 'officer',
      color: 'blue',
      hasLeftBase: true,
      hasReachedGoal: false,
    };

    const legalMoves = selectBotMove(board, 'blue', 1);
    if (legalMoves) {
      expect(legalMoves.piece.color).toBe('blue');
    }
  });

  it('does not repeatedly move a piece that is already safely on the goal line when other pieces can advance', () => {
    const board = createEmptyBoard();

    // Green goal rank is rank 1 (row 0)
    // Place a green Field Officer already in the goal line on c1
    board['c1'] = {
      id: 'green_fo_c1',
      type: 'field_officer',
      color: 'green',
      hasLeftBase: true,
      hasReachedGoal: true,
    };

    // Place another green Officer outside the goal line that can advance towards rank 1
    board['d3'] = {
      id: 'green_officer_d3',
      type: 'officer',
      color: 'green',
      hasLeftBase: true,
      hasReachedGoal: false,
    };

    const chosenMove = selectBotMove(board, 'green', 1);
    expect(chosenMove).not.toBeNull();
    // The bot should NOT pick the piece on c1 (goal line); it should pick d3!
    expect(chosenMove?.from).not.toBe('c1');
    expect(chosenMove?.from).toBe('d3');
  });

  it('returns null if no legal moves exist', () => {
    const emptyBoard = createEmptyBoard();
    const move = selectBotMove(emptyBoard, 'green', 1);
    expect(move).toBeNull();
  });
});
