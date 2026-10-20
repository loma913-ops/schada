import type { BoardMatrix, PieceColor, ScoreBreakdown, GameResult, WinReason } from './types';
import { squareToColRow } from './vectors';
import { SCHADA_RULES_CONFIG } from './rulesConfig';

/**
 * Calculates score breakdown for a player color.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(N) where N is the fixed number of squares on the board (N = 64).
 *   Since the board size is invariant, this executes in O(1) constant time.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant, prioritizing stable bounded scaling over unbounded resource consumption.
 */
export function calculateScoreBreakdown(board: BoardMatrix, color: PieceColor): ScoreBreakdown {
  const goalRank =
    color === 'white'
      ? SCHADA_RULES_CONFIG.board.whiteGoalRankIndex
      : SCHADA_RULES_CONFIG.board.blackGoalRankIndex;
  const baseRank =
    color === 'white'
      ? SCHADA_RULES_CONFIG.board.whiteBaseRankIndex
      : SCHADA_RULES_CONFIG.board.blackBaseRankIndex;

  let goalScore = 0;
  let outsideGoalHighPiecesScore = 0;
  let rankDistanceScore = 0;

  const scoringConfig = SCHADA_RULES_CONFIG.scoring;

  for (const [sq, piece] of Object.entries(board)) {
    if (!piece || piece.color !== color) continue;

    const [, row] = squareToColRow(sq as any);

    if (piece.type === 'field_officer') {
      if (row === goalRank) {
        goalScore += scoringConfig.fieldOfficerGoalPoints;
      } else {
        outsideGoalHighPiecesScore += scoringConfig.fieldOfficerSurvivingPoints;
        const distanceFromBase = Math.abs(row - baseRank);
        rankDistanceScore +=
          (distanceFromBase * scoringConfig.fieldOfficerRankDistanceNumerator) /
          scoringConfig.rankDistanceDenominator;
      }
    } else if (piece.type === 'officer') {
      if (row === goalRank) {
        goalScore += scoringConfig.officerGoalPoints;
      } else {
        outsideGoalHighPiecesScore += scoringConfig.officerSurvivingPoints;
        const distanceFromBase = Math.abs(row - baseRank);
        rankDistanceScore +=
          (distanceFromBase * scoringConfig.officerRankDistanceNumerator) /
          scoringConfig.rankDistanceDenominator;
      }
    }
  }

  const totalScore = goalScore + outsideGoalHighPiecesScore + rankDistanceScore;

  return {
    goalScore,
    outsideGoalHighPiecesScore,
    rankDistanceScore: Number(rankDistanceScore.toFixed(4)),
    totalScore: Number(totalScore.toFixed(4)),
  };
}

export function evaluateGameResult(
  board: BoardMatrix,
  winReason: WinReason
): GameResult {
  const whiteScore = calculateScoreBreakdown(board, 'white');
  const blackScore = calculateScoreBreakdown(board, 'black');

  let winner: PieceColor | 'draw' | null = null;

  // 1. Primary: Compare goal line scores
  if (whiteScore.goalScore > blackScore.goalScore) {
    winner = 'white';
  } else if (blackScore.goalScore > whiteScore.goalScore) {
    winner = 'black';
  } else {
    // 2. Tiebreaker 1: Surviving high pieces outside goal line
    if (whiteScore.outsideGoalHighPiecesScore > blackScore.outsideGoalHighPiecesScore) {
      winner = 'white';
    } else if (blackScore.outsideGoalHighPiecesScore > whiteScore.outsideGoalHighPiecesScore) {
      winner = 'black';
    } else {
      // 3. Tiebreaker 2: Distance from base line (2/7 for FO, 1/7 for O per rank)
      if (whiteScore.rankDistanceScore > blackScore.rankDistanceScore) {
        winner = 'white';
      } else if (blackScore.rankDistanceScore > whiteScore.rankDistanceScore) {
        winner = 'black';
      } else {
        // True draw
        winner = 'draw';
      }
    }
  }

  return {
    winner,
    winReason,
    whiteScore,
    blackScore,
  };
}
