import { describe, it, expect } from 'vitest';
import { createEmptyBoard } from '../../schada/engine';
import { selectBotMove } from '../schadaBot';
import { getBotTier } from '../botTiers';

describe('Strategic Pacing Paradox Heuristics', () => {
  it('Level 5+ bot delays moving final high piece to goal when behind on points', () => {
    const board = createEmptyBoard();

    // Black opponent already scored 2 Field Officers in goal line (Rank 1: row 0)
    // 2 FO in goal = 4 points
    board['a1'] = {
      id: 'black_fo_1',
      type: 'field_officer',
      color: 'black',
      hasLeftBase: true,
      hasReachedGoal: true,
    };
    board['c1'] = {
      id: 'black_fo_2',
      type: 'field_officer',
      color: 'black',
      hasLeftBase: true,
      hasReachedGoal: true,
    };

    // White bot has only 1 uncaptured Officer remaining, located on e7 (can step to e8 or move laterally)
    // If White steps into e8, match terminates immediately!
    // Result: White = 1 point (1 Officer in goal) vs Black = 4 points. White LOSES instantly!
    board['e7'] = {
      id: 'white_officer_e7',
      type: 'officer',
      color: 'white',
      hasLeftBase: true,
      hasReachedGoal: false,
    };

    // White also has a pawn on b2 that can move
    board['b2'] = {
      id: 'white_pawn_b2',
      type: 'pawn',
      color: 'white',
      hasLeftBase: false,
      hasReachedGoal: false,
    };

    // Level 5 bot has pacing paradox awareness
    const tier5 = getBotTier(5);
    expect(tier5.usePacingAwareness).toBe(true);

    const chosenMove = selectBotMove(board, 'white', 5);
    expect(chosenMove).not.toBeNull();

    // The bot should NOT pick e7 -> e8 (which causes instant suicide)
    // It should choose a different move (such as pawn b2 or delaying)
    const isImmediateSuicide = chosenMove?.from === 'e7' && chosenMove?.to === 'e8';
    expect(isImmediateSuicide).toBe(false);
  });

  it('Level 5+ bot prioritizes closing the match when ahead on points', () => {
    const board = createEmptyBoard();

    // White bot already scored 3 Field Officers in goal (row 7: a8, c8, e8) = 6 points!
    board['a8'] = {
      id: 'white_fo_1',
      type: 'field_officer',
      color: 'white',
      hasLeftBase: true,
      hasReachedGoal: true,
    };
    board['c8'] = {
      id: 'white_fo_2',
      type: 'field_officer',
      color: 'white',
      hasLeftBase: true,
      hasReachedGoal: true,
    };
    board['e8'] = {
      id: 'white_fo_3',
      type: 'field_officer',
      color: 'white',
      hasLeftBase: true,
      hasReachedGoal: true,
    };

    // White has one final uncaptured Officer on d7 which can enter d8 (goal)
    board['d7'] = {
      id: 'white_officer_d7',
      type: 'officer',
      color: 'white',
      hasLeftBase: true,
      hasReachedGoal: false,
    };

    // Black opponent has 0 pieces in goal, only 1 officer on d4
    board['d4'] = {
      id: 'black_officer_d4',
      type: 'officer',
      color: 'black',
      hasLeftBase: true,
      hasReachedGoal: false,
    };

    // Also give White a pawn on a2 to test choice
    board['a2'] = {
      id: 'white_pawn_a2',
      type: 'pawn',
      color: 'white',
      hasLeftBase: false,
      hasReachedGoal: false,
    };

    // Since White is leading 6-0 and moving d7 to d8 wins the game immediately,
    // the bot should convert the win!
    const chosenMove = selectBotMove(board, 'white', 5);
    expect(chosenMove).not.toBeNull();
    // d7 vector to d8 exists or advances to goal
    expect(chosenMove?.from).toBe('d7');
  });
});
