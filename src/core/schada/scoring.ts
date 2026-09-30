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
    color === 'blue'
      ? SCHADA_RULES_CONFIG.board.blueGoalRankIndex
      : SCHADA_RULES_CONFIG.board.greenGoalRankIndex;
  const baseRank =
    color === 'blue'
      ? SCHADA_RULES_CONFIG.board.blueBaseRankIndex
      : SCHADA_RULES_CONFIG.board.greenBaseRankIndex;

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
  const blueScore = calculateScoreBreakdown(board, 'blue');
  const greenScore = calculateScoreBreakdown(board, 'green');

  let winner: PieceColor | 'draw' | null = null;

  // 1. Primary: Compare goal line scores
  if (blueScore.goalScore > greenScore.goalScore) {
    winner = 'blue';
  } else if (greenScore.goalScore > blueScore.goalScore) {
    winner = 'green';
  } else {
    // 2. Tiebreaker 1: Surviving high pieces outside goal line
    if (blueScore.outsideGoalHighPiecesScore > greenScore.outsideGoalHighPiecesScore) {
      winner = 'blue';
    } else if (greenScore.outsideGoalHighPiecesScore > blueScore.outsideGoalHighPiecesScore) {
      winner = 'green';
    } else {
      // 3. Tiebreaker 2: Distance from base line (2/7 for FO, 1/7 for O per rank)
      if (blueScore.rankDistanceScore > greenScore.rankDistanceScore) {
        winner = 'blue';
      } else if (greenScore.rankDistanceScore > blueScore.rankDistanceScore) {
        winner = 'green';
      } else {
        // True draw
        winner = 'draw';
      }
    }
  }

  return {
    winner,
    winReason,
    blueScore,
    greenScore,
  };
}
