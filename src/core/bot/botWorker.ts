/// <reference lib="webworker" />
import { FastBoard } from './fastBoard';
import { getBotTier, BOT_ENGINE_CONFIG } from './botTiers';
import { searchBestMove } from './search';
import { getOpeningBookMove } from './openingBook';
import type { BoardMatrix, Move, PieceColor } from '../schada/types';

export interface BotWorkerRequest {
  readonly id: string;
  readonly board: BoardMatrix;
  readonly color: PieceColor;
  readonly level: number;
  readonly recentMoves?: Move[];
  readonly timeLeftMs?: number;
  readonly incrementMs?: number;
}

export interface BotWorkerResponse {
  readonly id: string;
  readonly move: Move | null;
}

/**
 * Web Worker event handler for asynchronous bot calculations.
 *
 * Algorithmic Complexity:
 * - Time Complexity:
 *   Opening Book hit: O(1) constant time (0ms).
 *   Tree Search: Bounded by dynamic time limit (timeLimitMs).
 * - Auxiliary Space Complexity: O(1) inside worker isolate.
 */
self.onmessage = (event: MessageEvent<BotWorkerRequest>) => {
  const data = event.data;
  if (!data || !data.id || !data.board || !data.color) {
    return;
  }

  try {
    const { id, board, color, level, recentMoves, timeLeftMs, incrementMs } = data;

    // 1. Check opening book first for instant 0ms response
    const bookMove = getOpeningBookMove(board, color, level, recentMoves);
    if (bookMove) {
      self.postMessage({ id, move: bookMove } as BotWorkerResponse);
      return;
    }

    // 2. Tree Search
    const tier = getBotTier(level);
    const tm = BOT_ENGINE_CONFIG.timeManagement;

    let budget = tier.timeLimitMs;
    if (typeof timeLeftMs === 'number' && timeLeftMs > 0) {
      const clockPortion = Math.floor(timeLeftMs / tm.clockDivisor) + (incrementMs ?? tm.defaultIncrementMs);
      budget = Math.max(tm.minThinkingTimeMs, Math.min(tier.timeLimitMs, clockPortion));
    }

    const fastBoard = FastBoard.fromBoardMatrix(board, color);
    const fastMove = searchBestMove(fastBoard, tier, budget, recentMoves ? recentMoves.length : 0);
    const move = fastMove ? fastBoard.toStandardMove(fastMove) : null;

    self.postMessage({ id, move } as BotWorkerResponse);
  } catch {
    self.postMessage({ id: data.id, move: null } as BotWorkerResponse);
  }
};
