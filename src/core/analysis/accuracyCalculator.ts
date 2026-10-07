import type { AnalysisConfig } from './analysisConfig';
import { CANONICAL_ANALYSIS_CONFIG, validateAnalysisConfig } from './analysisConfig';
import type { EvaluatedMove, MoveQuality, PlayerQualityBreakdown } from './analysisTypes';
import type { PieceColor } from '../schada/types';

/**
 * Computes subjective winning chances [-1, +1] from centipoint evaluation.
 * Clamped to configured evalCeiling with empirical multiplier (Lichess model).
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time mathematical operation.
 * - Auxiliary Space Complexity: O(1) constant memory.
 *
 * Growth Rate:
 * - O(1) strictly constant.
 */
export function winningChances(
  evalScore: number,
  config: AnalysisConfig = CANONICAL_ANALYSIS_CONFIG
): number {
  validateAnalysisConfig(config);
  const ceiling = config.accuracy.evalCeiling;
  const clamped = Math.max(-ceiling, Math.min(ceiling, evalScore));
  const raw = 2 / (1 + Math.exp(config.accuracy.winProbMultiplier * clamped)) - 1;
  return Math.max(-1, Math.min(1, raw));
}

/**
 * Converts a raw centipoint evaluation score into a winning probability [0, 1]
 * from the active player's point of view.
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
  return 0.5 + 0.5 * winningChances(evalScore, config);
}

/**
 * Converts a raw centipoint evaluation score into a winning percentage [0, 100]
 * from the active player's point of view.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time mathematical operation.
 * - Auxiliary Space Complexity: O(1) constant memory.
 *
 * Growth Rate:
 * - O(1) strictly constant.
 */
export function evaluationToWinPercent(
  evalScore: number,
  config: AnalysisConfig = CANONICAL_ANALYSIS_CONFIG
): number {
  return 50 + 50 * winningChances(evalScore, config);
}

/**
 * Calculates accuracy percentage [0, 100] for an individual move based on
 * win percentage lost relative to the best engine move, using Lichess's
 * calibrated exponential model:
 * Accuracy% = a * exp(-k * winDiff) + b + uncertaintyBonus
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
  if (playedScore >= bestScore) {
    return config.accuracy.perfectAccuracy;
  }
  const beforeWin = evaluationToWinPercent(bestScore, config);
  const afterWin = evaluationToWinPercent(playedScore, config);
  const winDiff = Math.max(0, beforeWin - afterWin);

  const raw =
    config.accuracy.modelCoefficients.a *
      Math.exp(-config.accuracy.modelCoefficients.k * winDiff) +
    config.accuracy.modelCoefficients.b;

  const withBonus = raw + config.accuracy.modelCoefficients.uncertaintyBonus;
  return Math.min(config.accuracy.maxAccuracy, Math.max(config.accuracy.minAccuracy, withBonus));
}

/**
 * Computes population standard deviation of numerical values.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(W) where W is array length.
 * - Auxiliary Space Complexity: O(1) accumulator variables.
 *
 * Growth Rate:
 * - Linear O(W) in sample window size.
 */
function calculateStandardDeviation(values: readonly number[]): number {
  if (values.length <= 1) return 0;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
  }
  const mean = sum / values.length;
  let varianceSum = 0;
  for (let i = 0; i < values.length; i++) {
    const diff = values[i] - mean;
    varianceSum += diff * diff;
  }
  return Math.sqrt(varianceSum / values.length);
}

/**
 * Computes overall accuracy and move classification breakdown for a specific player color
 * using Lichess's game accuracy algorithm:
 * 1. Compute sliding-window volatility weights from position Win% values.
 * 2. Calculate the volatility-weighted mean of per-move accuracies.
 * 3. Calculate the harmonic mean of per-move accuracies to penalize blunders appropriately.
 * 4. Yield final game accuracy as the average of the volatility-weighted mean and harmonic mean.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(N * W) where N is plies and W <= 8 is maximum sliding window size.
 *   Since W <= 8 is constant, this is strictly O(N) linear time.
 * - Auxiliary Space Complexity: O(N) for win percentage buffers and move weights.
 *
 * Growth Rate:
 * - Linear O(N) relative to moves played; scales stably over hundreds of plies.
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

  // Count breakdowns
  for (const m of playerMoves) {
    breakdown[m.quality]++;
  }

  // 1. Build all-ply Win% timeline (from Blue POV), starting with initial board (0 cp)
  const allWinPercents: number[] = [evaluationToWinPercent(0, config)];
  for (let i = 0; i < evaluatedMoves.length; i++) {
    allWinPercents.push(evaluationToWinPercent(evaluatedMoves[i].evalAfter, config));
  }

  // 2. Sliding window volatility weights
  const totalPlies = evaluatedMoves.length;
  const vol = config.accuracy.volatility;
  const windowSize = Math.max(
    vol.minWindowSize,
    Math.min(vol.maxWindowSize, Math.floor(totalPlies / vol.windowSizeDivisor))
  );

  const weights: number[] = [];
  for (let i = 0; i < totalPlies; i++) {
    const start = Math.max(0, Math.min(allWinPercents.length - windowSize, i - Math.floor(windowSize / 2)));
    const windowSlice = allWinPercents.slice(start, start + windowSize);
    const sd = calculateStandardDeviation(windowSlice);
    weights.push(Math.max(vol.minWeight, Math.min(vol.maxWeight, sd)));
  }

  // 3. Compute per-move accuracies and collect weights for target player
  const moveAccuracies: number[] = [];
  const playerWeights: number[] = [];

  for (const m of playerMoves) {
    let acc: number;
    if (m.quality === 'book') {
      acc = config.accuracy.perfectAccuracy;
    } else {
      // Perspective-corrected scores:
      // In evaluatedMoves, evalBefore and evalAfter are normalized to Blue POV.
      // Active player's POV before the move:
      const beforeCp = color === 'blue' ? m.evalBefore : -m.evalBefore;
      // Active player's POV after playing the move:
      const afterCp = beforeCp - m.evalDelta;
      acc = calculateMoveAccuracy(beforeCp, afterCp, config);
    }
    moveAccuracies.push(acc);
    playerWeights.push(weights[m.ply - 1] ?? 1.0);
  }

  // 4. Volatility-weighted mean
  let sumWeighted = 0;
  let sumWeight = 0;
  for (let i = 0; i < moveAccuracies.length; i++) {
    sumWeighted += moveAccuracies[i] * playerWeights[i];
    sumWeight += playerWeights[i];
  }
  const weightedMean = sumWeight > 0 ? sumWeighted / sumWeight : config.accuracy.perfectAccuracy;

  // 5. Harmonic mean
  let sumHarmonic = 0;
  for (let i = 0; i < moveAccuracies.length; i++) {
    sumHarmonic += 1 / Math.max(1, moveAccuracies[i]);
  }
  const harmonicMean = moveAccuracies.length / sumHarmonic;

  // 6. Final combined game accuracy
  const combined = (weightedMean + harmonicMean) / 2;
  const factor = Math.pow(10, config.accuracy.accuracyDecimals);
  const roundedAccuracy = Math.round(combined * factor) / factor;

  return {
    accuracy: Math.min(config.accuracy.maxAccuracy, Math.max(config.accuracy.minAccuracy, roundedAccuracy)),
    moveCount: playerMoves.length,
    breakdown,
  };
}
