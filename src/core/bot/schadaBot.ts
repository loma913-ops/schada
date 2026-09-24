import type { BoardMatrix, Move, PieceColor } from '../schada/types';
import { getAllLegalMoves, executeMove, haveAllRemainingHighPiecesReachedGoal } from '../schada/engine';
import { squareToColRow } from '../schada/vectors';

/**
 * Material and strategic weights for Schada piece evaluation
 */
const PIECE_VALUES = {
  field_officer: 60,
  officer: 40,
  pawn: 15,
};

/**
 * Evaluates the utility of a single candidate move for Level 1 bot.
 */
export function scoreMove(
  board: BoardMatrix,
  move: Move,
  botColor: PieceColor,
  recentMoves?: Move[]
): number {
  let score = 0;
  const opponentColor: PieceColor = botColor === 'blue' ? 'green' : 'blue';
  const goalRank = botColor === 'blue' ? 7 : 0;
  const [, toRow] = squareToColRow(move.to);
  const [, fromRow] = squareToColRow(move.from);

  // 1. Goal Line Entering Priority
  // Only reward reaching the goal line when entering from the playing field!
  const isEnteringGoal = move.piece.type !== 'pawn' && fromRow !== goalRank && toRow === goalRank;
  if (isEnteringGoal) {
    if (move.piece.type === 'field_officer') {
      score += 250; // Field Officer is worth 2 goal points and becomes immune
    } else {
      score += 180; // Officer is worth 1 goal point and becomes immune
    }
  }

  // 2. High piece ALREADY on the goal line
  // Once a high piece is in the goal line, its scoring mission is complete and it is immune.
  // Heavily discourage unnecessary shuffling inside the goal line so the bot advances its other pieces!
  if (move.piece.type !== 'pawn' && fromRow === goalRank) {
    if (!move.captured) {
      score -= 120;
    }
  }

  // 3. Material Captures
  if (move.captured) {
    const victimValue = PIECE_VALUES[move.captured.type] || 10;
    score += victimValue * 2;
  }

  // 4. Advancing High Pieces towards Goal Line
  if (move.piece.type !== 'pawn' && fromRow !== goalRank) {
    const previousDist = Math.abs(fromRow - goalRank);
    const newDist = Math.abs(toRow - goalRank);
    const distanceGain = previousDist - newDist;
    score += distanceGain * 12; // High priority on advancing remaining high pieces
  } else if (move.piece.type === 'pawn') {
    // Pawns pushing forward to control space and open paths
    const previousDist = Math.abs(fromRow - goalRank);
    const newDist = Math.abs(toRow - goalRank);
    const distanceGain = previousDist - newDist;
    score += distanceGain * 3;
  }

  // 5. Lookahead / Threat Avoidance (1-ply defensive check)
  // Simulate the move on a scratch board
  const nextState = executeMove(
    {
      board,
      currentTurn: botColor,
      moveHistory: [],
      capturedPieces: { blue: [], green: [] },
      positionHistory: [],
      isGameOver: false,
      result: null,
    },
    move
  );

  // Did this move immediately win the game?
  if (haveAllRemainingHighPiecesReachedGoal(nextState.board, botColor)) {
    return 10000;
  }

  // Check if destination square is immediately attacked by opponent
  const opponentResponses = getAllLegalMoves(nextState.board, opponentColor);
  const isDirectlyAttacked = opponentResponses.some((oppMove) => oppMove.to === move.to);

  if (isDirectlyAttacked && toRow !== goalRank) {
    // If piece is in goal rank, it is immune to capture!
    // Otherwise penalize blundering the moving piece
    const movingPieceValue = PIECE_VALUES[move.piece.type] || 15;
    score -= movingPieceValue * 1.5;
  }

  // 6. Friendly leap bonuses for Field Officer (only outside the goal line)
  if (move.piece.type === 'field_officer' && move.intermediateSquares.length > 0 && fromRow !== goalRank) {
    score += 10; // Rewards dynamic tactical leaping
  }

  // 7. Repetition & Oscillation Avoidance using recent move history
  if (recentMoves && recentMoves.length > 0) {
    const lastBotMove = [...recentMoves].reverse().find((m) => m.piece.color === botColor);
    if (lastBotMove) {
      // Reversing the previous move (going back to previous square)
      if (move.from === lastBotMove.to && move.to === lastBotMove.from && !move.captured) {
        score -= 150;
      }
      // Moving the same piece again when it's already in the goal line
      if (lastBotMove.to === move.from && fromRow === goalRank && !move.captured) {
        score -= 200;
      }
    }
  }

  // 8. Add small subtle jitter (0-3 pts) for natural human-like variation among equal moves
  score += (Math.random() * 3) - 1.5;

  return score;
}

/**
 * Selects the best move for the bot based on the selected difficulty level and move history.
 */
export function selectBotMove(
  board: BoardMatrix,
  color: PieceColor,
  _level: number = 1,
  recentMoves?: Move[]
): Move | null {
  const legalMoves = getAllLegalMoves(board, color);
  if (legalMoves.length === 0) return null;

  // Level 1: Evaluate each candidate move and choose the top-scoring one
  let bestMove: Move = legalMoves[0];
  let highestScore = -Infinity;

  for (const move of legalMoves) {
    const score = scoreMove(board, move, color, recentMoves);
    if (score > highestScore) {
      highestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

/**
 * Returns a human-like thinking delay in milliseconds based on level.
 */
export function getBotThinkingDelayMs(_level: number = 1): number {
  return 400 + Math.floor(Math.random() * 350);
}
