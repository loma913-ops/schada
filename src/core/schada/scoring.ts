import type { BoardMatrix, PieceColor, ScoreBreakdown, GameResult, WinReason } from './types';
import { squareToColRow } from './vectors';

export function calculateScoreBreakdown(board: BoardMatrix, color: PieceColor): ScoreBreakdown {
  const goalRank = color === 'blue' ? 7 : 0; // 0-indexed: blue goal is rank 8 (row 7), green goal is rank 1 (row 0)
  const baseRank = color === 'blue' ? 0 : 7;

  let goalScore = 0;
  let outsideGoalHighPiecesScore = 0;
  let rankDistanceScore = 0;

  for (const [sq, piece] of Object.entries(board)) {
    if (!piece || piece.color !== color) continue;

    const [, row] = squareToColRow(sq as any);

    if (piece.type === 'field_officer') {
      if (row === goalRank) {
        goalScore += 2;
      } else {
        outsideGoalHighPiecesScore += 2;
        const distanceFromBase = Math.abs(row - baseRank);
        rankDistanceScore += (distanceFromBase * 2) / 7;
      }
    } else if (piece.type === 'officer') {
      if (row === goalRank) {
        goalScore += 1;
      } else {
        outsideGoalHighPiecesScore += 1;
        const distanceFromBase = Math.abs(row - baseRank);
        rankDistanceScore += (distanceFromBase * 1) / 7;
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
