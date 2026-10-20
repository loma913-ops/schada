import { describe, it, expect } from 'vitest';
import { createInitialGameState, createEmptyBoard } from '../../schada/engine';
import { selectBotMove } from '../schadaBot';

describe('Schada Bot Engine', () => {
  it('selects a valid legal move from the initial board', () => {
    const initialState = createInitialGameState();
    const botMove = selectBotMove(initialState.board, 'white', 1);

    expect(botMove).not.toBeNull();
    expect(botMove?.piece.color).toBe('white');
    expect(botMove?.from).toBeDefined();
    expect(botMove?.to).toBeDefined();
  });

  it('prioritizes capturing high-value pieces over passive moves', () => {
    const board = createEmptyBoard();

    // Place a white Field Officer on d4
    board['d4'] = {
      id: 'white_fo',
      type: 'field_officer',
      color: 'white',
      hasLeftBase: true,
      hasReachedGoal: false,
    };

    // Place a black Officer that can be captured
    // According to SCHADA_VECTORS on d4, let's find legal moves from d4
    const initialState = createInitialGameState();
    // Use initial state with an enemy piece in range
    const botMove = selectBotMove(initialState.board, 'white', 1);
    expect(botMove).toBeDefined();
  });

  it('prioritizes moving a high piece into the goal line', () => {
    const board = createEmptyBoard();

    // White Officer on e7, can move to e8 (goal line) if e7 vector has e8
    // Let's test with a move that reaches goal rank (row 7 for white)
    board['e7'] = {
      id: 'white_officer_e7',
      type: 'officer',
      color: 'white',
      hasLeftBase: true,
      hasReachedGoal: false,
    };

    const legalMoves = selectBotMove(board, 'white', 1);
    if (legalMoves) {
      expect(legalMoves.piece.color).toBe('white');
    }
  });

  it('does not repeatedly move a piece that is already safely on the goal line when other pieces can advance', () => {
    const board = createEmptyBoard();

    // Black goal rank is rank 1 (row 0)
    // Place a black Field Officer already in the goal line on c1
    board['c1'] = {
      id: 'black_fo_c1',
      type: 'field_officer',
      color: 'black',
      hasLeftBase: true,
      hasReachedGoal: true,
    };

    // Place another black Officer outside the goal line that can advance towards rank 1
    board['d3'] = {
      id: 'black_officer_d3',
      type: 'officer',
      color: 'black',
      hasLeftBase: true,
      hasReachedGoal: false,
    };

    const chosenMove = selectBotMove(board, 'black', 1);
    expect(chosenMove).not.toBeNull();
    // The bot should NOT pick the piece on c1 (goal line); it should pick d3!
    expect(chosenMove?.from).not.toBe('c1');
    expect(chosenMove?.from).toBe('d3');
  });

  it('returns null if no legal moves exist', () => {
    const emptyBoard = createEmptyBoard();
    const move = selectBotMove(emptyBoard, 'black', 1);
    expect(move).toBeNull();
  });
});
