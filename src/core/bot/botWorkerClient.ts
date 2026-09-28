import type { BoardMatrix, Move, PieceColor } from '../schada/types';
import type { BotWorkerRequest, BotWorkerResponse } from './botWorker';
import { selectBotMove } from './schadaBot';
import { BOT_ENGINE_CONFIG } from './botConfig';

interface PendingRequest {
  readonly resolve: (move: Move | null) => void;
  readonly reject: (error: Error) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

/**
 * Manages background Web Worker execution for bot move calculations
 * with an automatic fallback to synchronous execution for environments
 * without Web Worker support (e.g. Node.js, Vitest, locked webviews).
 */
class BotWorkerClient {
  private worker: Worker | null = null;
  private workerSupported: boolean = true;
  private readonly pendingRequests = new Map<string, PendingRequest>();
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
      this.worker = new Worker(new URL('./botWorker.ts', import.meta.url), {
        type: 'module',
      });

      this.worker.onmessage = (event: MessageEvent<BotWorkerResponse>) => {
        const { id, move } = event.data;
        const pending = this.pendingRequests.get(id);
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingRequests.delete(id);
          pending.resolve(move);
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

  /**
   * Requests a bot move asynchronously.
   * If Web Workers are unavailable or the worker execution times out,
   * falls back to synchronous computation.
   *
   * Algorithmic Complexity:
   * - Time Complexity: Bounded by max search time / worker timeout.
   * - Auxiliary Space Complexity: O(1) per request record.
   */
  async requestBotMove(
    board: BoardMatrix,
    color: PieceColor,
    level: number = 1,
    recentMoves?: Move[],
    timeLeftMs?: number,
    incrementMs?: number
  ): Promise<Move | null> {
    if (!this.workerSupported || !this.worker) {
      return selectBotMove(board, color, level, recentMoves, timeLeftMs, incrementMs);
    }

    const id = `req_${++this.requestIdCounter}_${Date.now()}`;
    const request: BotWorkerRequest = {
      id,
      board,
      color,
      level,
      recentMoves,
      timeLeftMs,
      incrementMs,
    };

    const safetyTimeout = BOT_ENGINE_CONFIG.timeManagement.workerSafetyTimeoutMs;

    return new Promise<Move | null>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        try {
          const fallbackMove = selectBotMove(board, color, level, recentMoves, timeLeftMs, incrementMs);
          resolve(fallbackMove);
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      }, safetyTimeout);

      this.pendingRequests.set(id, { resolve, reject, timer });
      this.worker!.postMessage(request);
    });
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    for (const [, req] of this.pendingRequests) {
      clearTimeout(req.timer);
    }
    this.pendingRequests.clear();
  }
}

export const botWorkerClient = new BotWorkerClient();
