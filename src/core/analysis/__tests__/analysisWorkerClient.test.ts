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
        piece: { id: 'w_p4', type: 'pawn', color: 'white', hasLeftBase: false, hasReachedGoal: false },
        intermediateSquares: [],
        notation: 'Pd2-b4',
      },
      {
        from: 'e7',
        to: 'g5',
        piece: { id: 'b_p4', type: 'pawn', color: 'black', hasLeftBase: false, hasReachedGoal: false },
        intermediateSquares: [],
        notation: 'Pe7-g5',
      },
    ];

    const plyResults: Array<{ ply: number; quality: string }> = [];

    let completedReport: any = null;

    await new Promise<void>((resolve, reject) => {
      client.startAnalysis(sampleMoves, 1, 50, {
        onPlyEvaluated: (plyIndex, evaluatedMove) => {
          plyResults.push({ ply: plyIndex, quality: evaluatedMove.quality });
        },
        onComplete: (report) => {
          completedReport = report;
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
    expect(completedReport).not.toBeNull();
    expect(completedReport.moves).toHaveLength(2);
    expect(typeof completedReport.whiteAccuracy).toBe('number');
    expect(typeof completedReport.blackAccuracy).toBe('number');
    expect(client.isRunning()).toBe(false);
  });

  it('handles empty move list cleanly and immediately completes', async () => {
    const client = new AnalysisWorkerClient();
    let emptyReport: any = null;

    await new Promise<void>((resolve) => {
      client.startAnalysis([], 1, 50, {
        onPlyEvaluated: vi.fn(),
        onComplete: (report) => {
          emptyReport = report;
          resolve();
        },
      });
    });

    expect(emptyReport).not.toBeNull();
    expect(emptyReport.moves).toHaveLength(0);
    expect(emptyReport.whiteAccuracy).toBe(100);
    expect(emptyReport.blackAccuracy).toBe(100);
    expect(client.isRunning()).toBe(false);
  });

  it('cancels analysis when cancelAnalysis is invoked', async () => {
    const client = new AnalysisWorkerClient();

    const sampleMoves: Move[] = [
      {
        from: 'd2',
        to: 'b4',
        piece: { id: 'w_p4', type: 'pawn', color: 'white', hasLeftBase: false, hasReachedGoal: false },
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
