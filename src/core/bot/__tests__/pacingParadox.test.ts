import { describe, it, expect } from 'vitest';
import { createEmptyBoard } from '../../schada/engine';
import { selectBotMove } from '../schadaBot';
import { getBotTier } from '../botTiers';

describe('Strategic Pacing Paradox Heuristics', () => {
  it('Level 5+ bot delays moving final high piece to goal when behind on points', () => {
    const board = createEmptyBoard();

    // Green opponent already scored 2 Field Officers in goal line (Rank 1: row 0)
    // 2 FO in goal = 4 points
    board['a1'] = {
      id: 'green_fo_1',
      type: 'field_officer',
      color: 'green',
      hasLeftBase: true,
      hasReachedGoal: true,
    };
    board['c1'] = {
      id: 'green_fo_2',
      type: 'field_officer',
      color: 'green',
      hasLeftBase: true,
      hasReachedGoal: true,
    };

    // Blue bot has only 1 uncaptured Officer remaining, located on e7 (can step to e8 or move laterally)
    // If Blue steps into e8, match terminates immediately!
    // Result: Blue = 1 point (1 Officer in goal) vs Green = 4 points. Blue LOSES instantly!
    board['e7'] = {
      id: 'blue_officer_e7',
      type: 'officer',
      color: 'blue',
      hasLeftBase: true,
      hasReachedGoal: false,
    };

    // Blue also has a pawn on b2 that can move
    board['b2'] = {
      id: 'blue_pawn_b2',
      type: 'pawn',
      color: 'blue',
      hasLeftBase: false,
      hasReachedGoal: false,
    };

    // Level 5 bot has pacing paradox awareness
    const tier5 = getBotTier(5);
    expect(tier5.usePacingAwareness).toBe(true);

    const chosenMove = selectBotMove(board, 'blue', 5);
    expect(chosenMove).not.toBeNull();

    // The bot should NOT pick e7 -> e8 (which causes instant suicide)
    // It should choose a different move (such as pawn b2 or delaying)
    const isImmediateSuicide = chosenMove?.from === 'e7' && chosenMove?.to === 'e8';
    expect(isImmediateSuicide).toBe(false);
  });

  it('Level 5+ bot prioritizes closing the match when ahead on points', () => {
    const board = createEmptyBoard();

    // Blue bot already scored 3 Field Officers in goal (row 7: a8, c8, e8) = 6 points!
    board['a8'] = {
      id: 'blue_fo_1',
      type: 'field_officer',
      color: 'blue',
      hasLeftBase: true,
      hasReachedGoal: true,
    };
    board['c8'] = {
      id: 'blue_fo_2',
      type: 'field_officer',
      color: 'blue',
      hasLeftBase: true,
      hasReachedGoal: true,
    };
    board['e8'] = {
      id: 'blue_fo_3',
      type: 'field_officer',
      color: 'blue',
      hasLeftBase: true,
      hasReachedGoal: true,
    };

    // Blue has one final uncaptured Officer on d7 which can enter d8 (goal)
    board['d7'] = {
      id: 'blue_officer_d7',
      type: 'officer',
      color: 'blue',
      hasLeftBase: true,
      hasReachedGoal: false,
    };

    // Green opponent has 0 pieces in goal, only 1 officer on d4
    board['d4'] = {
      id: 'green_officer_d4',
      type: 'officer',
      color: 'green',
      hasLeftBase: true,
      hasReachedGoal: false,
    };

    // Also give Blue a pawn on a2 to test choice
    board['a2'] = {
      id: 'blue_pawn_a2',
      type: 'pawn',
      color: 'blue',
      hasLeftBase: false,
      hasReachedGoal: false,
    };

    // Since Blue is leading 6-0 and moving d7 to d8 wins the game immediately,
    // the bot should convert the win!
    const chosenMove = selectBotMove(board, 'blue', 5);
    expect(chosenMove).not.toBeNull();
    // d7 vector to d8 exists or advances to goal
    expect(chosenMove?.from).toBe('d7');
  });
});
