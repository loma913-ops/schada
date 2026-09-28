import {
  FastBoard,
  type FastMove,
  EMPTY,
  BLUE_FO,
  BLUE_O,
  BLUE_PAWN,
  GREEN_FO,
  GREEN_O,
  GREEN_PAWN,
} from './fastBoard';
import { evaluateBoard, evaluateTerminalWin, TERMINAL_WIN, TERMINAL_LOSS } from './evaluator';
import { BOT_ENGINE_CONFIG, type BotTierConfig } from './botConfig';
import { DISTANCE_TABLES } from './distanceTables';

const TT_SIZE = BOT_ENGINE_CONFIG.searchParameters.transpositionTableSize;
const TT_MASK = TT_SIZE - 1;

const FLAG_EXACT = 0;
const FLAG_LOWER = 1;
const FLAG_UPPER = 2;

// Zobrist pseudo-random constants
const ZOBRIST_PIECES = new Uint32Array(64 * 7);
const ZOBRIST_FLAGS = new Uint32Array(64 * 4);
let ZOBRIST_TURN = 0;

(() => {
  let seed = 0x853c49e6;
  function rand(): number {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed;
  }
  for (let i = 0; i < ZOBRIST_PIECES.length; i++) {
    ZOBRIST_PIECES[i] = rand();
  }
  for (let i = 0; i < ZOBRIST_FLAGS.length; i++) {
    ZOBRIST_FLAGS[i] = rand();
  }
  ZOBRIST_TURN = rand();
})();

/**
 * Computes 32-bit unsigned Zobrist hash key for the current board state.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(N) where N = 64 squares = O(1).
 * - Auxiliary Space Complexity: O(1).
 */
export function computeZobristHash(board: FastBoard): number {
  let hash = 0;
  for (let i = 0; i < 64; i++) {
    const p = board.squares[i];
    if (p !== EMPTY) {
      hash ^= ZOBRIST_PIECES[i * 7 + p];
    }
    const f = board.flags[i] & 3;
    if (f !== 0) {
      hash ^= ZOBRIST_FLAGS[i * 4 + f];
    }
  }
  if (board.currentTurn === 'green') {
    hash ^= ZOBRIST_TURN;
  }
  return hash >>> 0;
}

export interface SearchContext {
  readonly tier: BotTierConfig;
  readonly startTime: number;
  readonly timeLimitMs: number;
  nodesVisited: number;
  timedOut: boolean;
  readonly killerMoves: FastMove[][];
  readonly historyTable: Int32Array;
  readonly ttKeys: Uint32Array;
  readonly ttDepths: Uint8Array;
  readonly ttFlags: Uint8Array;
  readonly ttScores: Int32Array;
  readonly ttBestFrom: Uint8Array;
  readonly ttBestTo: Uint8Array;
}

export function createSearchContext(tier: BotTierConfig, timeLimitMs: number): SearchContext {
  const maxPly = BOT_ENGINE_CONFIG.searchParameters.maxSearchPly;
  const killerMoves: FastMove[][] = [];
  for (let i = 0; i < maxPly; i++) {
    killerMoves.push([
      { from: 0, to: 0, piece: 0, captured: 0, intermediate: [] },
      { from: 0, to: 0, piece: 0, captured: 0, intermediate: [] },
    ]);
  }

  return {
    tier,
    startTime: performance.now(),
    timeLimitMs,
    nodesVisited: 0,
    timedOut: false,
    killerMoves,
    historyTable: new Int32Array(64 * 64),
    ttKeys: new Uint32Array(TT_SIZE),
    ttDepths: new Uint8Array(TT_SIZE),
    ttFlags: new Uint8Array(TT_SIZE),
    ttScores: new Int32Array(TT_SIZE),
    ttBestFrom: new Uint8Array(TT_SIZE),
    ttBestTo: new Uint8Array(TT_SIZE),
  };
}

function getPieceMaterialScore(piece: number): number {
  const w = BOT_ENGINE_CONFIG.evaluationWeights;
  switch (piece) {
    case BLUE_FO:
    case GREEN_FO:
      return w.fieldOfficerMaterial;
    case BLUE_O:
    case GREEN_O:
      return w.officerMaterial;
    case BLUE_PAWN:
    case GREEN_PAWN:
      return w.pawnMaterial;
    default:
      return 0;
  }
}

/**
 * Assigns ordering score to candidate moves.
 * Priority: PV Move -> MVV-LVA Captures -> Goal Line Entries -> Killers -> History -> Distance Gain.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time per move.
 * - Auxiliary Space Complexity: O(1).
 */
function scoreMoveForOrdering(
  move: FastMove,
  hashFrom: number,
  hashTo: number,
  ply: number,
  ctx: SearchContext
): number {
  if (move.from === hashFrom && move.to === hashTo) {
    return 1_000_000;
  }

  if (move.captured !== EMPTY) {
    const victim = getPieceMaterialScore(move.captured);
    const attacker = getPieceMaterialScore(move.piece);
    return 100_000 + victim * 10 - attacker;
  }

  const isHigh = move.piece === BLUE_FO || move.piece === BLUE_O || move.piece === GREEN_FO || move.piece === GREEN_O;
  const destRow = Math.floor(move.to / 8);
  const isBlue = move.piece <= 3;
  const goalRow = isBlue ? 7 : 0;
  if (isHigh && destRow === goalRow) {
    return 50_000;
  }

  if (ply < ctx.killerMoves.length) {
    const km = ctx.killerMoves[ply];
    if (km[0].from === move.from && km[0].to === move.to) return 9000;
    if (km[1].from === move.from && km[1].to === move.to) return 8000;
  }

  const hist = ctx.historyTable[move.from * 64 + move.to];
  if (hist > 0) {
    return Math.min(7000, hist);
  }

  if (isHigh) {
    const fromDist = isBlue ? DISTANCE_TABLES.blueSliding[move.from] : DISTANCE_TABLES.greenSliding[move.from];
    const toDist = isBlue ? DISTANCE_TABLES.blueSliding[move.to] : DISTANCE_TABLES.greenSliding[move.to];
    const gain = fromDist - toDist;
    return gain * 20;
  }

  return 0;
}

function sortMoves(moves: FastMove[], hashFrom: number, hashTo: number, ply: number, ctx: SearchContext): void {
  moves.sort((a, b) => {
    const scoreA = scoreMoveForOrdering(a, hashFrom, hashTo, ply, ctx);
    const scoreB = scoreMoveForOrdering(b, hashFrom, hashTo, ply, ctx);
    return scoreB - scoreA;
  });
}

/**
 * Quiescence search to resolve volatile capture sequences and goal-line infiltrations (Levels 6–8).
 * Eliminates the horizon effect by continuing search until tactical quiescence.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(b_tactical ^ d_q) where b_tactical <= 4 and d_q <= 3.
 * - Auxiliary Space Complexity: O(d_q) call stack frames.
 */
function quiescence(
  board: FastBoard,
  alpha: number,
  beta: number,
  ply: number,
  qDepth: number,
  ctx: SearchContext
): number {
  ctx.nodesVisited++;
  if ((ctx.nodesVisited & 1023) === 0 && performance.now() - ctx.startTime > ctx.timeLimitMs) {
    ctx.timedOut = true;
    return alpha;
  }

  if (board.haveAllRemainingHighPiecesReachedGoal('blue') || board.haveAllRemainingHighPiecesReachedGoal('green')) {
    return evaluateTerminalWin(board, board.currentTurn, ply);
  }

  const standPat = evaluateBoard(board, board.currentTurn, ctx.tier, ply);
  if (standPat >= beta) return beta;
  if (standPat > alpha) alpha = standPat;

  if (qDepth <= 0 || ply >= BOT_ENGINE_CONFIG.searchParameters.quiescenceMaxPly) {
    return alpha;
  }

  const allMoves = board.generateLegalMoves(board.currentTurn);
  const tacticalMoves = allMoves.filter((m) => {
    if (m.captured !== EMPTY) return true;
    const isHigh = m.piece === BLUE_FO || m.piece === BLUE_O || m.piece === GREEN_FO || m.piece === GREEN_O;
    const destRow = Math.floor(m.to / 8);
    const goalRow = m.piece <= 3 ? 7 : 0;
    return isHigh && destRow === goalRow;
  });

  if (tacticalMoves.length === 0) return alpha;

  sortMoves(tacticalMoves, 0, 0, ply, ctx);

  for (const move of tacticalMoves) {
    board.makeMove(move);
    const score = -quiescence(board, -beta, -alpha, ply + 1, qDepth - 1, ctx);
    board.unmakeMove();

    if (ctx.timedOut) return alpha;
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }

  return alpha;
}

/**
 * Principal Variation Search (PVS) with Alpha-Beta Pruning, Transposition Table, and Null-Move.
 *
 * Algorithmic Complexity:
 * - Time Complexity: Best case O(b^(d/2)), Worst case O(b^d) where b is branching factor ~15-20.
 *   Move ordering (PV, MVV-LVA, killers) brings practical growth close to O(b^(d/2)), doubling search depth.
 * - Auxiliary Space Complexity: O(d) recursion stack depth + O(1) in-place board state mutations.
 *
 * Growth Rate:
 * - Exponential in tree depth d; controlled via dynamic iterative deepening cutoff and alpha-beta bounds.
 */
function pvs(
  board: FastBoard,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
  ctx: SearchContext,
  allowNull: boolean = true
): number {
  ctx.nodesVisited++;
  if ((ctx.nodesVisited & 1023) === 0 && performance.now() - ctx.startTime > ctx.timeLimitMs) {
    ctx.timedOut = true;
    return alpha;
  }

  if (board.haveAllRemainingHighPiecesReachedGoal('blue') || board.haveAllRemainingHighPiecesReachedGoal('green')) {
    return evaluateTerminalWin(board, board.currentTurn, ply);
  }

  if (depth <= 0) {
    if (ctx.tier.useQuiescence) {
      return quiescence(board, alpha, beta, ply, BOT_ENGINE_CONFIG.searchParameters.quiescenceDefaultDepth, ctx);
    }
    return evaluateBoard(board, board.currentTurn, ctx.tier, ply);
  }

  const hash = computeZobristHash(board);
  const ttIndex = hash & TT_MASK;
  let hashFrom = -1;
  let hashTo = -1;

  if (ctx.tier.useTranspositionTable && ctx.ttKeys[ttIndex] === hash) {
    const ttDepth = ctx.ttDepths[ttIndex];
    const ttScore = ctx.ttScores[ttIndex];
    const ttFlag = ctx.ttFlags[ttIndex];

    hashFrom = ctx.ttBestFrom[ttIndex];
    hashTo = ctx.ttBestTo[ttIndex];

    if (ttDepth >= depth) {
      if (ttFlag === FLAG_EXACT) return ttScore;
      if (ttFlag === FLAG_LOWER && ttScore >= beta) return beta;
      if (ttFlag === FLAG_UPPER && ttScore <= alpha) return alpha;
    }
  }

  // Null-Move Pruning (Levels 7-8)
  const searchParams = BOT_ENGINE_CONFIG.searchParameters;
  if (ctx.tier.useNullMovePruning && allowNull && depth >= searchParams.nullMoveMinDepth && ply > 0) {
    const isBlue = board.currentTurn === 'blue';
    const highRemain = isBlue
      ? board.blueHighTotal - board.blueHighInGoal
      : board.greenHighTotal - board.greenHighInGoal;

    if (highRemain > 1) {
      board.currentTurn = isBlue ? 'green' : 'blue';
      const nullScore = -pvs(board, depth - 1 - searchParams.nullMoveReduction, -beta, -beta + 1, ply + 1, ctx, false);
      board.currentTurn = isBlue ? 'blue' : 'green';

      if (ctx.timedOut) return alpha;
      if (nullScore >= beta) return beta;
    }
  }

  const legalMoves = board.generateLegalMoves(board.currentTurn);
  if (legalMoves.length === 0) {
    return TERMINAL_LOSS + ply;
  }

  if (ctx.tier.useMoveOrdering) {
    sortMoves(legalMoves, hashFrom, hashTo, ply, ctx);
  }

  let bestScore = -Infinity;
  let bestMove: FastMove | null = null;
  const initialAlpha = alpha;

  for (let i = 0; i < legalMoves.length; i++) {
    const move = legalMoves[i];
    board.makeMove(move);

    let score: number;
    if (i === 0) {
      score = -pvs(board, depth - 1, -beta, -alpha, ply + 1, ctx, true);
    } else {
      score = -pvs(board, depth - 1, -alpha - 1, -alpha, ply + 1, ctx, true);
      if (score > alpha && score < beta) {
        score = -pvs(board, depth - 1, -beta, -alpha, ply + 1, ctx, true);
      }
    }

    board.unmakeMove();

    if (ctx.timedOut) return alpha;

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }

    if (score > alpha) {
      alpha = score;
    }

    if (alpha >= beta) {
      if (move.captured === EMPTY && ply < ctx.killerMoves.length) {
        ctx.killerMoves[ply][1] = ctx.killerMoves[ply][0];
        ctx.killerMoves[ply][0] = move;
        ctx.historyTable[move.from * 64 + move.to] += depth * depth;
      }
      break;
    }
  }

  if (ctx.tier.useTranspositionTable && !ctx.timedOut) {
    let flag = FLAG_EXACT;
    if (bestScore <= initialAlpha) flag = FLAG_UPPER;
    else if (bestScore >= beta) flag = FLAG_LOWER;

    ctx.ttKeys[ttIndex] = hash;
    ctx.ttDepths[ttIndex] = depth;
    ctx.ttFlags[ttIndex] = flag;
    ctx.ttScores[ttIndex] = bestScore;
    if (bestMove) {
      ctx.ttBestFrom[ttIndex] = bestMove.from;
      ctx.ttBestTo[ttIndex] = bestMove.to;
    }
  }

  return bestScore;
}

/**
 * Searches and selects the best move for the specified tier.
 *
 * Algorithmic Complexity:
 * - Time Complexity: Bounded by timeLimitMs; worst case O(b^d), average case O(b^(d/2)).
 * - Auxiliary Space Complexity: O(d + TT_SIZE) = O(1) fixed allocation.
 */
export function searchBestMove(
  board: FastBoard,
  tier: BotTierConfig,
  timeLimitMs: number,
  moveCount: number = 0
): FastMove | null {
  const legalMoves = board.generateLegalMoves(board.currentTurn);
  if (legalMoves.length === 0) return null;

  // Level 1: Opportunistic greedy captures, else pick random non-goal-shuffling moves
  if (tier.level === 1) {
    const captures = legalMoves.filter((m) => m.captured !== EMPTY);
    if (captures.length > 0 && Math.random() > tier.blunderRate) {
      captures.sort((a, b) => getPieceMaterialScore(b.captured) - getPieceMaterialScore(a.captured));
      return captures[0];
    }

    const nonGoalShuffle = legalMoves.filter((m) => {
      const isHigh = m.piece === BLUE_FO || m.piece === BLUE_O || m.piece === GREEN_FO || m.piece === GREEN_O;
      const fromRow = Math.floor(m.from / 8);
      const goalRow = m.piece <= 3 ? 7 : 0;
      return !(isHigh && fromRow === goalRow);
    });
    const pool = nonGoalShuffle.length > 0 ? nonGoalShuffle : legalMoves;
    const randIdx = Math.floor(Math.random() * pool.length);
    return pool[randIdx];
  }

  // Level 2: 1-ply Minimax with blunder noise
  if (tier.level === 2) {
    const scoredMoves = legalMoves.map((m) => {
      board.makeMove(m);
      const evalScore = -evaluateBoard(board, board.currentTurn, tier, 1);
      board.unmakeMove();
      return { move: m, score: evalScore };
    });

    scoredMoves.sort((a, b) => b.score - a.score);

    if (Math.random() < tier.blunderRate && scoredMoves.length > 1) {
      const blunderPool = scoredMoves.slice(1, Math.min(5, scoredMoves.length));
      return blunderPool[Math.floor(Math.random() * blunderPool.length)].move;
    }
    return scoredMoves[0].move;
  }

  // Levels 3–8: Tree Search
  const ctx = createSearchContext(tier, timeLimitMs);
  let bestMove: FastMove = legalMoves[0];
  const maxDepth = tier.maxDepth;

  if (!tier.useIterativeDeepening) {
    let bestScore = -Infinity;
    for (const move of legalMoves) {
      board.makeMove(move);
      const score = -pvs(board, maxDepth - 1, -Infinity, Infinity, 1, ctx, true);
      board.unmakeMove();

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
    return bestMove;
  }

  // Iterative Deepening (Levels 5–8)
  const candidateScores: Array<{ move: FastMove; score: number }> = [];

  for (let d = 1; d <= maxDepth; d++) {
    candidateScores.length = 0;
    let iterationBestScore = -Infinity;
    let iterationBestMove = bestMove;

    if (tier.useMoveOrdering) {
      sortMoves(legalMoves, bestMove.from, bestMove.to, 0, ctx);
    }

    for (const move of legalMoves) {
      board.makeMove(move);
      const score = -pvs(board, d - 1, -Infinity, Infinity, 1, ctx, true);
      board.unmakeMove();

      if (ctx.timedOut) break;

      candidateScores.push({ move, score });
      if (score > iterationBestScore) {
        iterationBestScore = score;
        iterationBestMove = move;
      }
    }

    if (ctx.timedOut) {
      break;
    }

    bestMove = iterationBestMove;

    if (iterationBestScore >= TERMINAL_WIN - 50) {
      break;
    }
  }

  // Controlled Opening Variety: If within first openingVariancePlies, pick among top score window
  const searchParams = BOT_ENGINE_CONFIG.searchParameters;
  if (moveCount <= searchParams.openingVariancePlies && candidateScores.length > 1) {
    candidateScores.sort((a, b) => b.score - a.score);
    const topScore = candidateScores[0].score;
    const viableOpeningMoves = candidateScores.filter(
      (c) => c.score >= topScore - searchParams.openingVarianceScoreWindow
    );
    if (viableOpeningMoves.length > 1) {
      const picked = viableOpeningMoves[Math.floor(Math.random() * viableOpeningMoves.length)];
      return picked.move;
    }
  }

  return bestMove;
}
