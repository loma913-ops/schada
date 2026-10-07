import type { AnalysisConfig } from './analysisConfig';
import { CANONICAL_ANALYSIS_CONFIG, validateAnalysisConfig } from './analysisConfig';
import type { EvaluatedMove, MoveQuality, PlayerQualityBreakdown } from './analysisTypes';
import type { PieceColor } from '../schada/types';

/**
 * Converts a raw centipoint evaluation score into a winning probability [0, 1]
 * using a calibrated logistic sigmoid model bounded by the configured saturation threshold.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time mathematical operation.
 * - Auxiliary Space Complexity: O(1) constant memory.
 *
 * Growth Rate:
 * - O(1) strictly constant, unaffected by game length or evaluation magnitude.
 */
export function evaluationToWinProbability(
  evalScore: number,
  config: AnalysisConfig = CANONICAL_ANALYSIS_CONFIG
): number {
  validateAnalysisConfig(config);
  const threshold = config.accuracy.evaluationSaturationThreshold;
  if (evalScore >= threshold) return 1.0;
  if (evalScore <= -threshold) return 0.0;
  return 1 / (1 + Math.pow(10, -evalScore / config.accuracy.winProbScale));
}

/**
 * Calculates accuracy percentage [0, 100] for an individual move based on
 * win probability lost relative to the best engine move.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time arithmetic calculation.
 * - Auxiliary Space Complexity: O(1) constant memory.
 *
 * Growth Rate:
 * - O(1) strictly constant.
 */
export function calculateMoveAccuracy(
  bestScore: number,
  playedScore: number,
  config: AnalysisConfig = CANONICAL_ANALYSIS_CONFIG
): number {
  validateAnalysisConfig(config);
  const bestWinProb = evaluationToWinProbability(bestScore, config);
  const playedWinProb = evaluationToWinProbability(playedScore, config);

  const winProbLoss = Math.max(0, bestWinProb - playedWinProb);

  // Configurable exponent dampening: Small errors penalize gently, blunders drop sharply
  const accuracy = config.accuracy.maxAccuracy * Math.pow(1 - winProbLoss, config.accuracy.quadraticExponent);

  return Math.min(config.accuracy.maxAccuracy, Math.max(config.accuracy.minAccuracy, accuracy));
}

/**
 * Computes overall accuracy and move classification breakdown for a specific player color.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(N) where N is the number of evaluated moves for that player.
 * - Auxiliary Space Complexity: O(1) fixed accumulator and dictionary.
 *
 * Growth Rate:
 * - Linear O(N) relative to moves played; scales sustainably over hundreds of plies.
 */
export function calculatePlayerAccuracy(
  evaluatedMoves: readonly EvaluatedMove[],
  color: PieceColor,
  config: AnalysisConfig = CANONICAL_ANALYSIS_CONFIG
): PlayerQualityBreakdown {
  validateAnalysisConfig(config);
  const playerMoves = evaluatedMoves.filter((m) => m.turn === color);
  const breakdown: Record<MoveQuality, number> = {
    brilliant: 0,
    great: 0,
    best: 0,
    excellent: 0,
    good: 0,
    book: 0,
    inaccuracy: 0,
    mistake: 0,
    miss: 0,
    blunder: 0,
  };

  if (playerMoves.length === 0) {
    return {
      accuracy: config.accuracy.perfectAccuracy,
      moveCount: 0,
      breakdown,
    };
  }

  let totalAccuracy = 0;

  for (const m of playerMoves) {
    breakdown[m.quality]++;

    // Book moves receive 100% accuracy automatically
    if (m.quality === 'book') {
      totalAccuracy += config.accuracy.perfectAccuracy;
    } else {
      const bestScore = m.evalBefore + m.evalDelta;
      const playedScore = m.evalBefore;
      const acc = calculateMoveAccuracy(bestScore, playedScore, config);
      totalAccuracy += acc;
    }
  }

  const rawAverage = totalAccuracy / playerMoves.length;
  const factor = Math.pow(10, config.accuracy.accuracyDecimals);
  const roundedAccuracy = Math.round(rawAverage * factor) / factor;

  return {
    accuracy: Math.min(config.accuracy.maxAccuracy, Math.max(config.accuracy.minAccuracy, roundedAccuracy)),
    moveCount: playerMoves.length,
    breakdown,
  };
}
