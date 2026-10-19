import type { BoardState, Move, PieceColor } from '../schada/types';
import { createInitialGameState, executeMove } from '../schada/engine';
import { FastBoard, type FastMove, WHITE_PAWN, BLACK_PAWN } from '../bot/fastBoard';
import { getBotTier } from '../bot/botTiers';
import { OPENING_BOOK, buildMoveSequenceKey } from '../bot/openingBook';
import { searchMoveCandidates, type CandidateMoveEvaluation } from '../bot/search';
import { evaluateBoard } from '../bot/evaluator';
import {
  type AnalysisConfig,
  type MoveQuality,
  CANONICAL_ANALYSIS_CONFIG,
  validateAnalysisConfig,
  AnalysisConfigError,
} from './analysisConfig';
import {
  type AnalysisOptions,
  type EvaluatedMove,
  type GameAnalysisReport,
  type NextMovePrediction,
  type ParsedGameData,
} from './analysisTypes';
import { parseGameInput } from './gameParser';
import { calculatePlayerAccuracy } from './accuracyCalculator';

/**
 * Finds the corresponding FastMove index for a canonical Move.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(M) where M is the legal candidate move count (M <= 35).
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) bounded by the finite degree of freedom on the 64-square Schada board.
 */
function findMatchingFastMove(fastBoard: FastBoard, legalFastMoves: readonly FastMove[], move: Move): FastMove | null {
  for (const fm of legalFastMoves) {
    const std = fastBoard.toStandardMove(fm);
    if (std.from === move.from && std.to === move.to) {
      return fm;
    }
  }
  return null;
}

/**
 * Classifies a played move into one of the 10 quality categories.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) comparison against configured thresholds.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) strictly constant, executing instantaneously without heap allocation.
 */
export function classifyMoveQuality(
  evalDelta: number,
  bestScore: number,
  candidateScores: readonly CandidateMoveEvaluation[],
  isSacrifice: boolean,
  isBook: boolean,
  config: AnalysisConfig = CANONICAL_ANALYSIS_CONFIG
): MoveQuality {
  validateAnalysisConfig(config);

  if (isBook) {
    return 'book';
  }

  const t = config.thresholds;

  // 1. Brilliant: Best move with tactical piece sacrifice and retaining strong advantage
  if (evalDelta <= t.bestMoveDelta && isSacrifice && bestScore >= t.brilliantMinAdvantage) {
    return 'brilliant';
  }

  // 2. Great Move: Best move in a position where 2nd best move drops significantly
  if (
    evalDelta <= t.bestMoveDelta &&
    candidateScores.length > 1 &&
    bestScore - candidateScores[1].score >= t.greatMoveSecondBestGap
  ) {
    return 'great';
  }

  // 3. Best Move: Matches top engine move within bestMoveDelta
  if (evalDelta <= t.bestMoveDelta) {
    return 'best';
  }

  // 4. Miss: Squandered a winning tactical opportunity (>= missMinOpportunityAdvantage)
  if (bestScore >= t.missMinOpportunityAdvantage && evalDelta >= t.missMinDelta) {
    return 'miss';
  }

  // 5. Blunder: Massive evaluation drop
  if (evalDelta > t.blunderDelta) {
    return 'blunder';
  }

  // 6. Mistake: Significant evaluation drop
  if (evalDelta > t.inaccuracyDelta) {
    return 'mistake';
  }

  // 7. Inaccuracy: Suboptimal move
  if (evalDelta > t.goodDelta) {
    return 'inaccuracy';
  }

  // 8. Good: Practical move with modest concession
  if (evalDelta > t.excellentDelta) {
    return 'good';
  }

  // 9. Excellent: Very close to top engine choice
  return 'excellent';
}

/**
 * Analyzes a game record turn-by-turn against the Tier 8 Master engine.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(N * (b^(d/2))) where N is ply count, b <= 18 branching factor,
 *   and d is iterative deepening tree depth.
 * - Auxiliary Space Complexity: O(N) for stored move evaluations and game states.
 *
 * Growth Rate:
 * - Linear in plies N; polynomial in tree depth bounded by timeLimitMs and alpha-beta cutoffs.
 *   Scales predictably on games exceeding hundreds of plies.
 */
export interface SinglePlyEvaluationResult {
  readonly evaluatedMove: EvaluatedMove;
  readonly nextState: BoardState;
}

/**
 * Evaluates a single played move ply against the engine candidates and opening book.
 *
 * Algorithmic Complexity:
 * - Time Complexity: Bounded by the search depth / timeLimitMs.
 * - Auxiliary Space Complexity: O(1) heap allocations.
 */
export function evaluateSinglePly(
  currentState: BoardState,
  moveHistory: readonly Move[],
  playedMove: Move,
  ply: number,
  depth: number,
  timeLimitMs: number,
  config: AnalysisConfig = CANONICAL_ANALYSIS_CONFIG
): SinglePlyEvaluationResult {
  validateAnalysisConfig(config);
  const tier = getBotTier(config.search.masterTierLevel);
  const turn = currentState.currentTurn;
  const moveNumber = Math.floor(ply / 2) + 1;
  const fastBoard = FastBoard.fromBoardMatrix(currentState.board, turn);

  // 1. Check Opening Book
  const bookKey = buildMoveSequenceKey(moveHistory);
  const bookCandidates = OPENING_BOOK[bookKey];
  let isBook = false;
  let bookLineName: string | undefined = undefined;

  if (bookCandidates && bookCandidates.length > 0) {
    const matchBook = bookCandidates.find((c) => c.from === playedMove.from && c.to === playedMove.to);
    if (matchBook) {
      isBook = true;
      bookLineName = matchBook.lineName;
    }
  }

  // 2. Engine Candidate Search
  const candidateScores = searchMoveCandidates(fastBoard, tier, depth, timeLimitMs);
  const legalFastMoves = fastBoard.generateLegalMoves(turn);

  if (candidateScores.length === 0) {
    throw new AnalysisConfigError(`No legal candidate moves found at ply ${ply + 1}.`);
  }

  const bestCandidate = candidateScores[0];
  const bestScore = bestCandidate.score;
  const bestMove = fastBoard.toStandardMove(bestCandidate.move);

  // 3. Score the played move
  const playedFastMove = findMatchingFastMove(fastBoard, legalFastMoves, playedMove);
  let playedScore = -Infinity;

  if (playedFastMove) {
    const candidateMatch = candidateScores.find(
      (c) => c.move.from === playedFastMove.from && c.move.to === playedFastMove.to
    );
    if (candidateMatch) {
      playedScore = candidateMatch.score;
    } else {
      fastBoard.makeMove(playedFastMove);
      playedScore = -evaluateBoard(fastBoard, fastBoard.currentTurn, tier, 1);
      fastBoard.unmakeMove();
    }
  } else {
    playedScore = -Infinity;
  }

  const evalDelta = isBook
    ? 0
    : Number.isFinite(bestScore) && Number.isFinite(playedScore)
      ? Math.max(0, bestScore - playedScore)
      : 0;

  // 4. Sacrifice Detection for Brilliant Moves
  let isSacrifice = false;
  if (playedFastMove) {
    const opponentColor: PieceColor = turn === 'white' ? 'black' : 'white';
    const isAttacked = fastBoard.isSquareAttacked(playedFastMove.to, opponentColor);
    const isHighPiece = playedFastMove.piece !== WHITE_PAWN && playedFastMove.piece !== BLACK_PAWN;
    if (isAttacked && (isHighPiece || playedFastMove.captured === 0)) {
      isSacrifice = true;
    }
  }

  // 5. Classify Move Quality
  const quality = classifyMoveQuality(evalDelta, bestScore, candidateScores, isSacrifice, isBook, config);

  // Normalize eval score to point of view (positive = White advantage)
  const safeBestScore = Number.isFinite(bestScore) ? bestScore : 0;
  const safePlayedScore = Number.isFinite(playedScore) ? playedScore : safeBestScore;
  const normalizedBefore = turn === 'white' ? safeBestScore : -safeBestScore;
  const normalizedAfter = turn === 'white' ? safePlayedScore : -safePlayedScore;

  const evaluatedMove: EvaluatedMove = {
    ply: ply + 1,
    turn,
    moveNumber,
    playedMove,
    playedNotation: playedMove.notation,
    bestMove,
    bestNotation: bestMove.notation,
    evalBefore: normalizedBefore,
    evalAfter: normalizedAfter,
    evalDelta,
    quality,
    bookLineName,
  };

  const nextState = executeMove(currentState, playedMove);

  return {
    evaluatedMove,
    nextState,
  };
}

export function analyzeGame(
  gameInput: string | object | ParsedGameData,
  options: AnalysisOptions = {}
): GameAnalysisReport {
  const startTime = performance.now();
  const config = options.config ?? CANONICAL_ANALYSIS_CONFIG;
  validateAnalysisConfig(config);

  const depth = options.depth ?? config.search.defaultDepth;
  const timeLimitMs = options.timeLimitMs ?? config.search.defaultTimeLimitMs;

  if (depth < config.search.minDepth || depth > config.search.maxDepth) {
    throw new AnalysisConfigError(
      `Analysis depth ${depth} is outside allowed range [${config.search.minDepth}, ${config.search.maxDepth}].`
    );
  }
  if (timeLimitMs < config.search.minTimeLimitMs || timeLimitMs > config.search.maxTimeLimitMs) {
    throw new AnalysisConfigError(
      `Analysis time limit ${timeLimitMs}ms is outside allowed range [${config.search.minTimeLimitMs}, ${config.search.maxTimeLimitMs}].`
    );
  }

  const parsedData: ParsedGameData =
    typeof gameInput === 'object' && 'moves' in gameInput && 'notations' in gameInput
      ? (gameInput as ParsedGameData)
      : parseGameInput(gameInput);

  const tier = getBotTier(config.search.masterTierLevel);
  let currentState = createInitialGameState();
  const moveHistory: Move[] = [];
  const evaluatedMoves: EvaluatedMove[] = [];

  for (let ply = 0; ply < parsedData.moves.length; ply++) {
    const playedMove = parsedData.moves[ply];
    const { evaluatedMove, nextState } = evaluateSinglePly(
      currentState,
      moveHistory,
      playedMove,
      ply,
      depth,
      timeLimitMs,
      config
    );

    evaluatedMoves.push(evaluatedMove);
    currentState = nextState;
    moveHistory.push(playedMove);
  }

  // 6. Predict Next Best Move Continuation (if game is unfinished)
  let nextMove: NextMovePrediction | undefined = undefined;
  if (!currentState.isGameOver) {
    const finalFastBoard = FastBoard.fromBoardMatrix(currentState.board, currentState.currentTurn);
    const finalCandidates = searchMoveCandidates(finalFastBoard, tier, depth, timeLimitMs);

    if (finalCandidates.length > 0) {
      const topNextCandidate = finalCandidates[0];
      const topNextMove = finalFastBoard.toStandardMove(topNextCandidate.move);

      nextMove = {
        turn: currentState.currentTurn,
        bestMove: topNextMove,
        notation: topNextMove.notation,
        evaluation: topNextCandidate.score,
        candidateMoves: finalCandidates.slice(0, config.search.topCandidateMovesLimit).map((c) => {
          const stdMove = finalFastBoard.toStandardMove(c.move);
          return {
            move: stdMove,
            notation: stdMove.notation,
            score: c.score,
          };
        }),
      };
    }
  }

  // 7. Calculate Accuracy Breakdowns
  const whiteStats = calculatePlayerAccuracy(evaluatedMoves, 'white', config);
  const blackStats = calculatePlayerAccuracy(evaluatedMoves, 'black', config);

  const durationMs = Math.round(performance.now() - startTime);

  return {
    metadata: parsedData.metadata,
    moves: evaluatedMoves,
    whiteAccuracy: whiteStats.accuracy,
    blackAccuracy: blackStats.accuracy,
    whiteBreakdown: whiteStats.breakdown,
    blackBreakdown: blackStats.breakdown,
    blueAccuracy: whiteStats.accuracy,
    greenAccuracy: blackStats.accuracy,
    blueBreakdown: whiteStats.breakdown,
    greenBreakdown: blackStats.breakdown,
    nextMove,
    isComplete: currentState.isGameOver,
    totalPlies: evaluatedMoves.length,
    analyzedAt: new Date().toISOString(),
    durationMs,
  };
}
