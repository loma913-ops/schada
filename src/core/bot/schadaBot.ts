import type { BoardMatrix, Move, PieceColor } from '../schada/types';
import { FastBoard } from './fastBoard';
import { getBotTier, BOT_ENGINE_CONFIG } from './botTiers';
import { searchBestMove } from './search';
import { evaluateBoard } from './evaluator';
import {
  getOpeningBookMove,
  shouldTierUseOpeningBook,
  buildMoveSequenceKey,
  OPENING_BOOK,
} from './openingBook';

export * from './botConfig';
export * from './botTiers';
export * from './distanceTables';
export * from './fastBoard';
export * from './evaluator';
export * from './search';
export * from './openingBook';
export * from './botWorkerClient';

/**
 * Evaluates the utility of a single candidate move (legacy compatibility).
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(N) where N = 64 squares = O(1) constant time.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 */
export function scoreMove(
  board: BoardMatrix,
  move: Move,
  botColor: PieceColor,
  _recentMoves?: Move[]
): number {
  const fastBoard = FastBoard.fromBoardMatrix(board, botColor);
  const tier = getBotTier(BOT_ENGINE_CONFIG.defaultLevel);
  const legalFastMoves = fastBoard.generateLegalMoves(botColor);
  const matching = legalFastMoves.find(
    (m) => fastBoard.toStandardMove(m).from === move.from && fastBoard.toStandardMove(m).to === move.to
  );
  if (!matching) return -Infinity;

  fastBoard.makeMove(matching);
  const score = -evaluateBoard(fastBoard, fastBoard.currentTurn, tier, 1);
  fastBoard.unmakeMove();
  return score;
}

/**
 * Selects the optimal move for the bot using the opening book or 8-tier Schada AI engine.
 *
 * Algorithmic Complexity:
 * - Time Complexity:
 *   Opening Book hit: O(1) instantaneous lookup (0ms).
 *   Tree Search: Bounded by level's maximum depth and dynamic timeLimitMs budget:
 *     Level 1-2: O(1) / O(M) where M <= 64 candidate moves.
 *     Level 3-4: O(b^d) where b <= 18, d <= 3.
 *     Level 5-8: O(b^(d/2)) iterative deepening with alpha-beta, quiescence, and PVS.
 * - Auxiliary Space Complexity: O(d + TT_SIZE) = O(1) fixed preallocated tables.
 *
 * Growth Rate:
 * - Exponential in depth d; pruned via alpha-beta cutoffs, transposition table hits,
 *   and null-move pruning to maintain steady interactive response times.
 */
export function selectBotMove(
  board: BoardMatrix,
  color: PieceColor,
  level: number = BOT_ENGINE_CONFIG.defaultLevel,
  recentMoves?: Move[],
  timeLeftMs?: number,
  incrementMs?: number
): Move | null {
  // 1. Check precomputed opening book first (0ms)
  const bookMove = getOpeningBookMove(board, color, level, recentMoves);
  if (bookMove) {
    return bookMove;
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
  if (!fastMove) return null;

  return fastBoard.toStandardMove(fastMove);
}

/**
 * Returns a thinking delay in milliseconds based on level and opening book availability.
 * If an opening book move is available for the active tier, returns 0ms for instant play.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1).
 * - Auxiliary Space Complexity: O(1).
 */
export function getBotThinkingDelayMs(level: number = BOT_ENGINE_CONFIG.defaultLevel, recentMoves?: Move[]): number {
  if (shouldTierUseOpeningBook(level, recentMoves)) {
    const key = buildMoveSequenceKey(recentMoves);
    if (OPENING_BOOK[key] && OPENING_BOOK[key].length > 0) {
      return BOT_ENGINE_CONFIG.openingBook.bookThinkingDelayMs;
    }
  }

  const tier = getBotTier(level);
  const tm = BOT_ENGINE_CONFIG.timeManagement;
  const base = tm.baseThinkingDelayMs + tier.level * tm.thinkingDelayStepPerLevelMs;
  return base + Math.floor(Math.random() * tm.randomDelayJitterMaxMs);
}
