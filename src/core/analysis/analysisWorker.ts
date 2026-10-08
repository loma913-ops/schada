/// <reference lib="webworker" />
import type { Move } from '../schada/types';
import { createInitialGameState } from '../schada/engine';
import { evaluateSinglePly } from './analysisEngine';
import { CANONICAL_ANALYSIS_CONFIG } from './analysisConfig';
import type { EvaluatedMove, GameAnalysisReport } from './analysisTypes';
import { calculatePlayerAccuracy } from './accuracyCalculator';

export interface StartAnalysisWorkerMessage {
  readonly type: 'START_ANALYSIS';
  readonly id: string;
  readonly moves: readonly Move[];
  readonly depth: number;
  readonly timeLimitMs: number;
}

export interface CancelAnalysisWorkerMessage {
  readonly type: 'CANCEL_ANALYSIS';
  readonly id: string;
}

export type AnalysisWorkerInboundMessage =
  | StartAnalysisWorkerMessage
  | CancelAnalysisWorkerMessage;

export interface PlyEvaluatedWorkerMessage {
  readonly type: 'PLY_EVALUATED';
  readonly id: string;
  readonly plyIndex: number;
  readonly evaluatedMove: EvaluatedMove;
  readonly progress: {
    readonly current: number;
    readonly total: number;
  };
}

export interface AnalysisCompletedWorkerMessage {
  readonly type: 'ANALYSIS_COMPLETED';
  readonly id: string;
  readonly report?: GameAnalysisReport;
}

export interface AnalysisErrorWorkerMessage {
  readonly type: 'ANALYSIS_ERROR';
  readonly id: string;
  readonly error: string;
}

export type AnalysisWorkerOutboundMessage =
  | PlyEvaluatedWorkerMessage
  | AnalysisCompletedWorkerMessage
  | AnalysisErrorWorkerMessage;

let currentAnalysisId: string | null = null;

self.onmessage = (event: MessageEvent<AnalysisWorkerInboundMessage>) => {
  const data = event.data;
  if (!data || !data.type) return;

  if (data.type === 'CANCEL_ANALYSIS') {
    if (currentAnalysisId === data.id) {
      currentAnalysisId = null;
    }
    return;
  }

  if (data.type === 'START_ANALYSIS') {
    const { id, moves, depth, timeLimitMs } = data;
    currentAnalysisId = id;
    const startTime = performance.now();

    try {
      let currentState = createInitialGameState();
      const moveHistory: Move[] = [];
      const evaluatedMoves: EvaluatedMove[] = [];

      for (let ply = 0; ply < moves.length; ply++) {
        // Stop immediately if cancelled mid-analysis
        if (currentAnalysisId !== id) {
          return;
        }

        const playedMove = moves[ply];
        const { evaluatedMove, nextState } = evaluateSinglePly(
          currentState,
          moveHistory,
          playedMove,
          ply,
          depth,
          timeLimitMs,
          CANONICAL_ANALYSIS_CONFIG
        );

        if (currentAnalysisId !== id) {
          return;
        }

        evaluatedMoves.push(evaluatedMove);

        const response: PlyEvaluatedWorkerMessage = {
          type: 'PLY_EVALUATED',
          id,
          plyIndex: ply,
          evaluatedMove,
          progress: {
            current: ply + 1,
            total: moves.length,
          },
        };
        self.postMessage(response);

        currentState = nextState;
        moveHistory.push(playedMove);
      }

      if (currentAnalysisId === id) {
        const blueStats = calculatePlayerAccuracy(evaluatedMoves, 'blue', CANONICAL_ANALYSIS_CONFIG);
        const greenStats = calculatePlayerAccuracy(evaluatedMoves, 'green', CANONICAL_ANALYSIS_CONFIG);

        const report: GameAnalysisReport = {
          metadata: {},
          moves: evaluatedMoves,
          blueAccuracy: blueStats.accuracy,
          greenAccuracy: greenStats.accuracy,
          blueBreakdown: blueStats.breakdown,
          greenBreakdown: greenStats.breakdown,
          isComplete: currentState.isGameOver,
          totalPlies: evaluatedMoves.length,
          analyzedAt: new Date().toISOString(),
          durationMs: Math.round(performance.now() - startTime),
        };

        const completeResponse: AnalysisCompletedWorkerMessage = {
          type: 'ANALYSIS_COMPLETED',
          id,
          report,
        };
        self.postMessage(completeResponse);
        currentAnalysisId = null;
      }
    } catch (err) {
      if (currentAnalysisId === id) {
        const errorResponse: AnalysisErrorWorkerMessage = {
          type: 'ANALYSIS_ERROR',
          id,
          error: err instanceof Error ? err.message : String(err),
        };
        self.postMessage(errorResponse);
        currentAnalysisId = null;
      }
    }
  }
};
