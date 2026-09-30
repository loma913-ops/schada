import type { PieceColor } from '../schada/types';
import { SCHADA_RULES_CONFIG } from '../schada/rulesConfig';
import {
  FastBoard,
  EMPTY,
  BLUE_FO,
  BLUE_O,
  BLUE_PAWN,
  GREEN_FO,
  GREEN_O,
  GREEN_PAWN,
  FLAG_REACHED_GOAL,
} from './fastBoard';
import { DISTANCE_TABLES, UNREACHABLE_DISTANCE } from './distanceTables';
import { BOT_ENGINE_CONFIG, type BotTierConfig } from './botConfig';

export const TERMINAL_WIN = BOT_ENGINE_CONFIG.evaluationWeights.terminalWinScore;
export const TERMINAL_LOSS = BOT_ENGINE_CONFIG.evaluationWeights.terminalLossScore;

export interface ScoreBreakdownFast {
  readonly goalScore: number;
  readonly outsideHighScore: number;
  readonly rankDistanceScore: number;
  readonly totalScore: number;
}

/**
 * Calculates exact Schada score for terminal evaluation matching official rules.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(N) where N = 64 squares = O(1) constant time.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 */
export function calculateFastScore(board: FastBoard, color: PieceColor): ScoreBreakdownFast {
  const isBlue = color === 'blue';
  const goalRank = isBlue ? SCHADA_RULES_CONFIG.board.blueGoalRankIndex : SCHADA_RULES_CONFIG.board.greenGoalRankIndex;
  const baseRank = isBlue ? SCHADA_RULES_CONFIG.board.blueBaseRankIndex : SCHADA_RULES_CONFIG.board.greenBaseRankIndex;
  const scoring = SCHADA_RULES_CONFIG.scoring;

  let goalScore = 0;
  let outsideHighScore = 0;
  let rankDistanceScore = 0;

  for (let idx = 0; idx < 64; idx++) {
    const piece = board.squares[idx];
    if (piece === EMPTY) continue;
    if ((piece <= 3) !== isBlue) continue;

    const row = Math.floor(idx / 8);
    const isFO = piece === BLUE_FO || piece === GREEN_FO;
    const isO = piece === BLUE_O || piece === GREEN_O;

    if (isFO) {
      if (row === goalRank) {
        goalScore += scoring.fieldOfficerGoalPoints;
      } else {
        outsideHighScore += scoring.fieldOfficerSurvivingPoints;
        const distFromBase = Math.abs(row - baseRank);
        rankDistanceScore += (distFromBase * scoring.fieldOfficerRankDistanceNumerator) / scoring.rankDistanceDenominator;
      }
    } else if (isO) {
      if (row === goalRank) {
        goalScore += scoring.officerGoalPoints;
      } else {
        outsideHighScore += scoring.officerSurvivingPoints;
        const distFromBase = Math.abs(row - baseRank);
        rankDistanceScore += (distFromBase * scoring.officerRankDistanceNumerator) / scoring.rankDistanceDenominator;
      }
    }
  }

  const totalScore = goalScore + outsideHighScore + rankDistanceScore;
  return {
    goalScore,
    outsideHighScore,
    rankDistanceScore,
    totalScore,
  };
}

/**
 * Evaluates whether a terminal position yields a win (+), loss (-), or draw (0) for `evalColor`.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(N) where N = 64 squares = O(1).
 * - Auxiliary Space Complexity: O(1).
 */
export function evaluateTerminalWin(board: FastBoard, evalColor: PieceColor, ply: number): number {
  const blueScore = calculateFastScore(board, 'blue');
  const greenScore = calculateFastScore(board, 'green');

  let winner: PieceColor | 'draw' = 'draw';
  if (blueScore.goalScore > greenScore.goalScore) {
    winner = 'blue';
  } else if (greenScore.goalScore > blueScore.goalScore) {
    winner = 'green';
  } else if (blueScore.outsideHighScore > greenScore.outsideHighScore) {
    winner = 'blue';
  } else if (greenScore.outsideHighScore > blueScore.outsideHighScore) {
    winner = 'green';
  } else if (blueScore.rankDistanceScore > greenScore.rankDistanceScore + 0.001) {
    winner = 'blue';
  } else if (greenScore.rankDistanceScore > blueScore.rankDistanceScore + 0.001) {
    winner = 'green';
  } else {
    winner = 'draw';
  }

  if (winner === evalColor) {
    return TERMINAL_WIN - ply;
  } else if (winner === 'draw') {
    return 0;
  } else {
    return TERMINAL_LOSS + ply;
  }
}

/**
 * Static evaluation function scored relative to `evalColor`.
 *
 * Formula: E(s) = (w_m * M) + (w_g * G) + (w_d * D) + (w_c * C) + (w_t * T)
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(N) where N = 64 squares = O(1) constant time.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant independent of search tree size or game length.
 */
export function evaluateBoard(
  board: FastBoard,
  evalColor: PieceColor,
  tier: BotTierConfig,
  ply: number = 0
): number {
  const isEvalBlue = evalColor === 'blue';
  const weights = BOT_ENGINE_CONFIG.evaluationWeights;

  // 1. Terminal evaluation if all remaining high pieces of either army reached goal
  if (board.haveAllRemainingHighPiecesReachedGoal('blue') || board.haveAllRemainingHighPiecesReachedGoal('green')) {
    return evaluateTerminalWin(board, evalColor, ply);
  }

  let myMaterial = 0;
  let oppMaterial = 0;

  let myGoalSecurity = 0;
  let oppGoalSecurity = 0;

  let myDistanceScore = 0;
  let oppDistanceScore = 0;

  let myMobility = 0;
  let oppMobility = 0;

  let myTurrets = 0;
  let oppTurrets = 0;

  for (let idx = 0; idx < 64; idx++) {
    const piece = board.squares[idx];
    if (piece === EMPTY) continue;

    const isPieceBlue = piece <= 3;
    const isFriendly = isPieceBlue === isEvalBlue;
    const flags = board.flags[idx];
    const inGoal = (flags & FLAG_REACHED_GOAL) !== 0;

    const isFO = piece === BLUE_FO || piece === GREEN_FO;
    const isO = piece === BLUE_O || piece === GREEN_O;
    const isP = piece === BLUE_PAWN || piece === GREEN_PAWN;

    // Material & Goal Security
    if (isFO) {
      if (inGoal) {
        if (isFriendly) myGoalSecurity += weights.fieldOfficerGoalSecurity;
        else oppGoalSecurity += weights.fieldOfficerGoalSecurity;
      } else {
        if (isFriendly) myMaterial += weights.fieldOfficerMaterial;
        else oppMaterial += weights.fieldOfficerMaterial;
      }
    } else if (isO) {
      if (inGoal) {
        if (isFriendly) myGoalSecurity += weights.officerGoalSecurity;
        else oppGoalSecurity += weights.officerGoalSecurity;
      } else {
        if (isFriendly) myMaterial += weights.officerMaterial;
        else oppMaterial += weights.officerMaterial;
      }
    } else if (isP) {
      if (isFriendly) myMaterial += weights.pawnMaterial;
      else oppMaterial += weights.pawnMaterial;
    }

    // Distance to Goal for high pieces outside goal (Levels 3+)
    if (tier.level >= BOT_ENGINE_CONFIG.searchParameters.distanceHeuristicsMinTier && (isFO || isO) && !inGoal) {
      let dist = 0;
      if (isPieceBlue) {
        dist = isFO ? DISTANCE_TABLES.blueLeaping[idx] : DISTANCE_TABLES.blueSliding[idx];
      } else {
        dist = isFO ? DISTANCE_TABLES.greenLeaping[idx] : DISTANCE_TABLES.greenSliding[idx];
      }

      const distWeight = isFO ? weights.fieldOfficerDistanceWeight : weights.officerDistanceWeight;
      if (dist >= UNREACHABLE_DISTANCE) {
        if (isFriendly) myDistanceScore -= weights.trappedDistancePenalty;
        else oppDistanceScore -= weights.trappedDistancePenalty;
      } else {
        const progress = (SCHADA_RULES_CONFIG.board.rankCount - dist) * distWeight;
        if (isFriendly) myDistanceScore += progress;
        else oppDistanceScore += progress;
      }
    }

    // Graph Connectivity & Mobility (Levels 7+)
    if (tier.useCentralityHeuristics) {
      const outDeg = DISTANCE_TABLES.outDegrees[idx];
      const cent = DISTANCE_TABLES.centrality[idx] * weights.centralityMultiplier;
      const mob = outDeg * weights.outDegreeMultiplier + cent;
      if (isFriendly) myMobility += mob;
      else oppMobility += mob;

      // Goal-line turret sentinel: Field Officer planted on goal rank acting as sentinel
      if (isFO && inGoal) {
        if (isFriendly) myTurrets += weights.turretSentinelBonus;
        else oppTurrets += weights.turretSentinelBonus;
      }
    }
  }

  // Base score differential
  let score =
    (myMaterial - oppMaterial) +
    (myGoalSecurity - oppGoalSecurity) +
    (myDistanceScore - oppDistanceScore) +
    (myMobility - oppMobility) +
    (myTurrets - oppTurrets);

  // Pacing Paradox Awareness (Levels 5–8):
  if (tier.usePacingAwareness) {
    const myScore = calculateFastScore(board, evalColor);
    const oppColor = isEvalBlue ? 'green' : 'blue';
    const oppScore = calculateFastScore(board, oppColor);
    const pointMargin = myScore.totalScore - oppScore.totalScore;

    const myHighRemaining = isEvalBlue
      ? board.blueHighTotal - board.blueHighInGoal
      : board.greenHighTotal - board.greenHighInGoal;

    if (myHighRemaining === 1 && pointMargin < 0) {
      score -= weights.pacingTrailingPenalty;
    } else if (myHighRemaining === 1 && pointMargin > BOT_ENGINE_CONFIG.searchParameters.pacingLeadingMarginThreshold) {
      score += weights.pacingLeadingBonus;
    }
  }

  // Fractional tiebreaker bonus for Expert/Master (Levels 7-8)
  if (tier.level >= BOT_ENGINE_CONFIG.searchParameters.fractionalTiebreakMinTier) {
    const myScore = calculateFastScore(board, evalColor);
    const oppColor = isEvalBlue ? 'green' : 'blue';
    const oppScore = calculateFastScore(board, oppColor);
    score += (myScore.rankDistanceScore - oppScore.rankDistanceScore) * weights.fractionalTiebreakMultiplier;
  }

  return score;
}
