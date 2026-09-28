import { describe, it, expect } from 'vitest';
import { createInitialGameState } from '../../schada/engine';
import { selectBotMove, getBotThinkingDelayMs } from '../schadaBot';
import { botWorkerClient } from '../botWorkerClient';

describe('8-Tier Search Engine Validation', () => {
  it('successfully calculates legal moves for all 8 tiers from initial board', () => {
    const state = createInitialGameState();

    for (let level = 1; level <= 8; level++) {
      const move = selectBotMove(state.board, 'blue', level, []);
      expect(move).not.toBeNull();
      expect(move?.piece.color).toBe('blue');
      expect(move?.from).toBeDefined();
      expect(move?.to).toBeDefined();
    }
  });

  it('provides appropriately scaled thinking delays per difficulty level during middlegame search', () => {
    const dummyHistory = new Array(5).fill({
      from: 'a1',
      to: 'a2',
      piece: { id: 'p', type: 'pawn', color: 'blue', hasLeftBase: true, hasReachedGoal: false },
      intermediateSquares: [],
      notation: 'a1-a2',
    });
    const delayL1 = getBotThinkingDelayMs(1, dummyHistory);
    const delayL8 = getBotThinkingDelayMs(8, dummyHistory);

    expect(delayL1).toBeGreaterThanOrEqual(250);
    expect(delayL8).toBeGreaterThan(delayL1);
  });

  it('operates seamlessly through botWorkerClient asynchronous interface', async () => {
    const state = createInitialGameState();
    const move = await botWorkerClient.requestBotMove(
      state.board,
      'blue',
      3,
      [],
      5000,
      0
    );

    expect(move).not.toBeNull();
    expect(move?.piece.color).toBe('blue');
  });
});
