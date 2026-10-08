import { describe, it, expect } from 'vitest';
import {
  evaluationToWinProbability,
  calculateMoveAccuracy,
  calculatePlayerAccuracy,
  createEmptyQualityBreakdown,
  createEmptyAnalysisReport,
} from '../accuracyCalculator';
import type { EvaluatedMove } from '../analysisTypes';
import type { Move, Square } from '../../schada/types';

function createMockMove(from: Square, to: Square, notation: string): Move {
  return {
    from,
    to,
    piece: {
      id: `piece_${from}`,
      type: 'field_officer',
      color: 'blue',
      hasLeftBase: false,
      hasReachedGoal: false,
    },
    intermediateSquares: [],
    notation,
  };
}

describe('Accuracy Calculator', () => {
  it('converts evaluation scores monotonically to win probability [0, 1]', () => {
    const probEven = evaluationToWinProbability(0);
    const probAhead = evaluationToWinProbability(300);
    const probBehind = evaluationToWinProbability(-300);

    expect(probEven).toBeCloseTo(0.5, 2);
    expect(probAhead).toBeGreaterThan(0.5);
    expect(probBehind).toBeLessThan(0.5);
    expect(probAhead).toBeCloseTo(1 - probBehind, 4);
  });

  it('awards 100% accuracy when played move matches best move score', () => {
    const acc = calculateMoveAccuracy(150, 150);
    expect(acc).toBe(100);
  });

  it('penalizes severe blunders heavily', () => {
    // Best move is winning (+400), but played move blunders to losing (-400)
    const acc = calculateMoveAccuracy(400, -400);
    expect(acc).toBeLessThan(25);
  });

  it('calculates aggregate player accuracy and move quality breakdown correctly', () => {
    const move1 = createMockMove('e1', 'e3', 'Fe1-e3');
    const move2 = createMockMove('c7', 'e5', 'Pc7-e5');
    const move3 = createMockMove('c1', 'c3', 'Fc1-c3');

    const dummyMoves: EvaluatedMove[] = [
      {
        ply: 1,
        turn: 'blue',
        moveNumber: 1,
        playedMove: move1,
        playedNotation: 'Fe1-e3',
        bestMove: move1,
        bestNotation: 'Fe1-e3',
        evalBefore: 10,
        evalAfter: 10,
        evalDelta: 0,
        quality: 'book',
      },
      {
        ply: 2,
        turn: 'green',
        moveNumber: 1,
        playedMove: move2,
        playedNotation: 'Pc7-e5',
        bestMove: move2,
        bestNotation: 'Pc7-e5',
        evalBefore: -10,
        evalAfter: -10,
        evalDelta: 0,
        quality: 'book',
      },
      {
        ply: 3,
        turn: 'blue',
        moveNumber: 2,
        playedMove: move3,
        playedNotation: 'Fc1-c3',
        bestMove: move3,
        bestNotation: 'Fc1-c3',
        evalBefore: 15,
        evalAfter: 15,
        evalDelta: 0,
        quality: 'best',
      },
    ];

    const blueStats = calculatePlayerAccuracy(dummyMoves, 'blue');
    expect(blueStats.moveCount).toBe(2);
    expect(blueStats.accuracy).toBe(100);
    expect(blueStats.breakdown.book).toBe(1);
    expect(blueStats.breakdown.best).toBe(1);

    const greenStats = calculatePlayerAccuracy(dummyMoves, 'green');
    expect(greenStats.moveCount).toBe(1);
    expect(greenStats.accuracy).toBe(100);
    expect(greenStats.breakdown.book).toBe(1);
  });

  it('throws AnalysisConfigError if a move ply references an invalid weight index', () => {
    const move1 = createMockMove('e1', 'e3', 'Fe1-e3');
    const corruptMoves: EvaluatedMove[] = [
      {
        ply: 999, // Out of bounds ply
        turn: 'blue',
        moveNumber: 1,
        playedMove: move1,
        playedNotation: 'Fe1-e3',
        bestMove: move1,
        bestNotation: 'Fe1-e3',
        evalBefore: 10,
        evalAfter: 0,
        evalDelta: 10,
        quality: 'good',
      },
    ];

    expect(() => calculatePlayerAccuracy(corruptMoves, 'blue')).toThrow(
      /Missing volatility weight at ply 999/
    );
  });

  it('returns perfectAccuracy when player has zero moves', () => {
    const stats = calculatePlayerAccuracy([], 'blue');
    expect(stats.accuracy).toBe(100);
    expect(stats.moveCount).toBe(0);
  });

  it('creates empty quality breakdown with all 10 tiers initialized to 0', () => {
    const breakdown = createEmptyQualityBreakdown();
    expect(breakdown.brilliant).toBe(0);
    expect(breakdown.great).toBe(0);
    expect(breakdown.best).toBe(0);
    expect(breakdown.excellent).toBe(0);
    expect(breakdown.good).toBe(0);
    expect(breakdown.book).toBe(0);
    expect(breakdown.inaccuracy).toBe(0);
    expect(breakdown.mistake).toBe(0);
    expect(breakdown.miss).toBe(0);
    expect(breakdown.blunder).toBe(0);
    expect(Object.keys(breakdown)).toHaveLength(10);
  });

  it('creates empty analysis report adhering to canonical config accuracy defaults', () => {
    const report = createEmptyAnalysisReport();
    expect(report.moves).toHaveLength(0);
    expect(report.totalPlies).toBe(0);
    expect(report.blueAccuracy).toBe(100);
    expect(report.greenAccuracy).toBe(100);
    expect(report.blueBreakdown.best).toBe(0);
    expect(report.greenBreakdown.blunder).toBe(0);
    expect(report.isComplete).toBe(true);
  });
});
