import { describe, it, expect, vi } from 'vitest';
import { AnalysisWorkerClient } from '../analysisWorkerClient';
import type { Move } from '@/core/schada/types';

describe('AnalysisWorkerClient', () => {
  it('streams plies sequentially and completes via fallback execution', async () => {
    const client = new AnalysisWorkerClient();

    const sampleMoves: Move[] = [
      {
        from: 'd2',
        to: 'b4',
        piece: { id: 'b_p4', type: 'pawn', color: 'blue', hasLeftBase: false, hasReachedGoal: false },
        intermediateSquares: [],
        notation: 'Pd2-b4',
      },
      {
        from: 'e7',
        to: 'g5',
        piece: { id: 'g_p4', type: 'pawn', color: 'green', hasLeftBase: false, hasReachedGoal: false },
        intermediateSquares: [],
        notation: 'Pe7-g5',
      },
    ];

    const plyResults: Array<{ ply: number; quality: string }> = [];

    await new Promise<void>((resolve, reject) => {
      client.startAnalysis(sampleMoves, 1, 50, {
        onPlyEvaluated: (plyIndex, evaluatedMove) => {
          plyResults.push({ ply: plyIndex, quality: evaluatedMove.quality });
        },
        onComplete: () => {
          resolve();
        },
        onError: (err) => {
          reject(err);
        },
      });
    });

    expect(plyResults.length).toBe(2);
    expect(plyResults[0].ply).toBe(0);
    expect(plyResults[1].ply).toBe(1);
    expect(client.isRunning()).toBe(false);
  });

  it('handles empty move list cleanly and immediately completes', async () => {
    const client = new AnalysisWorkerClient();

    await new Promise<void>((resolve) => {
      client.startAnalysis([], 1, 50, {
        onPlyEvaluated: vi.fn(),
        onComplete: () => {
          resolve();
        },
      });
    });

    expect(client.isRunning()).toBe(false);
  });

  it('cancels analysis when cancelAnalysis is invoked', async () => {
    const client = new AnalysisWorkerClient();

    const sampleMoves: Move[] = [
      {
        from: 'd2',
        to: 'b4',
        piece: { id: 'b_p4', type: 'pawn', color: 'blue', hasLeftBase: false, hasReachedGoal: false },
        intermediateSquares: [],
        notation: 'Pd2-b4',
      },
    ];

    client.startAnalysis(sampleMoves, 5, 500, {
      onPlyEvaluated: vi.fn(),
      onComplete: vi.fn(),
    });

    expect(client.isRunning()).toBe(true);
    client.cancelAnalysis();
    expect(client.isRunning()).toBe(false);
  });
});
