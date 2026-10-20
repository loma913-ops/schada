import { describe, it, expect } from 'vitest';
import { createInitialGameState } from '../../schada/engine';
import { selectBotMove, getBotThinkingDelayMs } from '../schadaBot';
import { botWorkerClient } from '../botWorkerClient';
import { FastBoard } from '../fastBoard';
import { getBotTier } from '../botTiers';
import { searchMoveCandidates } from '../search';

describe('8-Tier Search Engine Validation', () => {
  it('successfully calculates legal moves for all 8 tiers from initial board', () => {
    const state = createInitialGameState();

    for (let level = 1; level <= 8; level++) {
      const move = selectBotMove(state.board, 'white', level, []);
      expect(move).not.toBeNull();
      expect(move?.piece.color).toBe('white');
      expect(move?.from).toBeDefined();
      expect(move?.to).toBeDefined();
    }
  });

  it('provides appropriately scaled thinking delays per difficulty level during middlegame search', () => {
    const dummyHistory = new Array(5).fill({
      from: 'a1',
      to: 'a2',
      piece: { id: 'p', type: 'pawn', color: 'white', hasLeftBase: true, hasReachedGoal: false },
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
      'white',
      3,
      [],
      5000,
      0
    );

    expect(move).not.toBeNull();
    expect(move?.piece.color).toBe('white');
  });

  it('produces finite, non-NaN candidate evaluations during deep searches (depths 7 through 20)', () => {
    const state = createInitialGameState();
    const fastBoard = FastBoard.fromBoardMatrix(state.board, 'white');
    const tier = getBotTier(8);

    for (const testDepth of [7, 8, 10, 16, 20]) {
      const candidates = searchMoveCandidates(fastBoard, tier, testDepth, 150);
      expect(candidates.length).toBeGreaterThan(0);
      for (const cand of candidates) {
        expect(Number.isFinite(cand.score)).toBe(true);
        expect(cand.score).not.toBeNaN();
        expect(cand.score).not.toBe(-Infinity);
        expect(cand.score).not.toBe(Infinity);
      }
      // Candidates must be sorted descending
      for (let i = 1; i < candidates.length; i++) {
        expect(candidates[i - 1].score).toBeGreaterThanOrEqual(candidates[i].score);
      }
    }
  });
});
