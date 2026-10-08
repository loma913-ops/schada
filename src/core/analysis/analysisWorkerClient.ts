import type { Move } from '../schada/types';
import type { EvaluatedMove, GameAnalysisReport } from './analysisTypes';
import type {
  AnalysisWorkerInboundMessage,
  AnalysisWorkerOutboundMessage,
} from './analysisWorker';
import { createInitialGameState } from '../schada/engine';
import { evaluateSinglePly } from './analysisEngine';
import { CANONICAL_ANALYSIS_CONFIG } from './analysisConfig';
import { calculatePlayerAccuracy, createEmptyAnalysisReport } from './accuracyCalculator';

export interface AnalysisProgress {
  readonly current: number;
  readonly total: number;
}

export interface AnalysisCallbacks {
  readonly onPlyEvaluated: (
    plyIndex: number,
    evaluatedMove: EvaluatedMove,
    progress: AnalysisProgress
  ) => void;
  readonly onComplete: (report?: GameAnalysisReport) => void;
  readonly onError?: (error: Error) => void;
}

/**
 * Manages background Web Worker execution for real-time progressive game analysis
 * with an automatic fallback to chunked yielding execution in environments without Web Worker support.
 *
 * Algorithmic Complexity:
 * - Time Complexity: Bounded by Worker execution speed; main thread dispatch is O(1).
 * - Auxiliary Space Complexity: O(1) tracking callbacks and active ID.
 */
export class AnalysisWorkerClient {
  private worker: Worker | null = null;
  private workerSupported: boolean = true;
  private activeId: string | null = null;
  private activeCallbacks: AnalysisCallbacks | null = null;
  private fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private requestIdCounter = 0;

  constructor() {
    this.initWorker();
  }

  private initWorker(): void {
    if (typeof window === 'undefined' || typeof Worker === 'undefined') {
      this.workerSupported = false;
      return;
    }

    try {
      this.worker = new Worker(new URL('./analysisWorker.ts', import.meta.url), {
        type: 'module',
      });

      this.worker.onmessage = (event: MessageEvent<AnalysisWorkerOutboundMessage>) => {
        const msg = event.data;
        if (!msg || msg.id !== this.activeId) return;

        if (msg.type === 'PLY_EVALUATED') {
          this.activeCallbacks?.onPlyEvaluated(msg.plyIndex, msg.evaluatedMove, msg.progress);
        } else if (msg.type === 'ANALYSIS_COMPLETED') {
          const cb = this.activeCallbacks;
          this.activeId = null;
          this.activeCallbacks = null;
          cb?.onComplete(msg.report);
        } else if (msg.type === 'ANALYSIS_ERROR') {
          const cb = this.activeCallbacks;
          this.activeId = null;
          this.activeCallbacks = null;
          cb?.onError?.(new Error(msg.error));
        }
      };

      this.worker.onerror = () => {
        this.workerSupported = false;
        this.worker?.terminate();
        this.worker = null;
      };
    } catch {
      this.workerSupported = false;
      this.worker = null;
    }
  }

  public startAnalysis(
    moves: readonly Move[],
    depth: number,
    timeLimitMs: number,
    callbacks: AnalysisCallbacks
  ): string {
    this.cancelAnalysis();

    const id = `analysis_${Date.now()}_${++this.requestIdCounter}`;
    this.activeId = id;
    this.activeCallbacks = callbacks;

    if (moves.length === 0) {
      setTimeout(() => {
        if (this.activeId === id) {
          this.activeId = null;
          this.activeCallbacks = null;
          callbacks.onComplete(createEmptyAnalysisReport());
        }
      }, 0);
      return id;
    }

    if (this.workerSupported && this.worker) {
      const msg: AnalysisWorkerInboundMessage = {
        type: 'START_ANALYSIS',
        id,
        moves,
        depth,
        timeLimitMs,
      };
      this.worker.postMessage(msg);
    } else {
      this.runFallbackAnalysis(id, moves, depth, timeLimitMs, callbacks);
    }

    return id;
  }

  public cancelAnalysis(): void {
    if (this.activeId) {
      if (this.workerSupported && this.worker) {
        const msg: AnalysisWorkerInboundMessage = {
          type: 'CANCEL_ANALYSIS',
          id: this.activeId,
        };
        this.worker.postMessage(msg);
      }
      if (this.fallbackTimer) {
        clearTimeout(this.fallbackTimer);
        this.fallbackTimer = null;
      }
      this.activeId = null;
      this.activeCallbacks = null;
    }
  }

  public isRunning(): boolean {
    return this.activeId !== null;
  }

  private runFallbackAnalysis(
    id: string,
    moves: readonly Move[],
    depth: number,
    timeLimitMs: number,
    callbacks: AnalysisCallbacks
  ): void {
    const startTime = performance.now();
    let currentState = createInitialGameState();
    const moveHistory: Move[] = [];
    const evaluatedMoves: EvaluatedMove[] = [];
    let ply = 0;

    const step = () => {
      if (this.activeId !== id) return;
      if (ply >= moves.length) {
        this.activeId = null;
        this.activeCallbacks = null;
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
        callbacks.onComplete(report);
        return;
      }

      try {
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

        if (this.activeId !== id) return;

        evaluatedMoves.push(evaluatedMove);

        callbacks.onPlyEvaluated(ply, evaluatedMove, {
          current: ply + 1,
          total: moves.length,
        });

        currentState = nextState;
        moveHistory.push(playedMove);
        ply++;

        this.fallbackTimer = setTimeout(step, 0);
      } catch (err) {
        this.activeId = null;
        this.activeCallbacks = null;
        callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    };

    this.fallbackTimer = setTimeout(step, 0);
  }

  public terminate(): void {
    this.cancelAnalysis();
    this.worker?.terminate();
    this.worker = null;
  }
}

export const analysisWorkerClient = new AnalysisWorkerClient();
