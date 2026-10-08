import { describe, it, expect } from 'vitest';
import { analyzeGame, classifyMoveQuality } from '../analysisEngine';
import type { CandidateMoveEvaluation } from '../../bot/search';

function createMockCandidate(from: number, to: number, score: number): CandidateMoveEvaluation {
  return {
    move: {
      from,
      to,
      piece: 1,
      captured: 0,
      intermediate: [],
    },
    score,
  };
}

describe('Analysis Engine', () => {
  const userGameSnippet = `
  1. Fe1-e3       Pc7-e5
  2. Fc1-c3       Fb8-b6
  3. Fa1-a3       Fh8-h6
  4. Pe2-e1       Fb6-a6
  5. Fg1-g3       Ff8-f6
  6. Fg3-h3       Ff6-e6
  7. Fc3-d3       Fe6-g6
  8. Fe3-f4       Oc8-c7
  9. Fd3-f5       Pf7-f8
 10. Ff5-h5       Pd7-e6
 11. Fh3xe6       Fh6-f6
 12. Fh5xg6       Ff6xe6
 13. Fg6-f7       Oa8-b8
 14. Ff7xf8       Fe6-g6
 15. Ff8xe8       Fd8-c8
 16. Fe8-d8       Pb7-d5
 17. Fa3-d6       Ob8-b6
 18. Fd8xc8       Og8-h8
 19. Oh1-g1       Ph7-g8
 20. Ff4-g4
`;

  it('classifies all 10 move quality tiers accurately based on configured criteria', () => {
    // 1. Book
    expect(classifyMoveQuality(0, 10, [], false, true)).toBe('book');

    // 2. Brilliant
    expect(classifyMoveQuality(0, 150, [createMockCandidate(4, 20, 150)], true, false)).toBe('brilliant');

    // 3. Great Move (large gap to second best)
    expect(
      classifyMoveQuality(
        0,
        150,
        [
          createMockCandidate(4, 20, 150),
          createMockCandidate(2, 18, 10), // 140 gap >= greatMoveSecondBestGap (120)
        ],
        false,
        false
      )
    ).toBe('great');

    // 4. Best Move
    expect(classifyMoveQuality(0, 50, [createMockCandidate(4, 20, 50)], false, false)).toBe('best');

    // 5. Excellent
    expect(classifyMoveQuality(15, 50, [createMockCandidate(4, 20, 50)], false, false)).toBe('excellent');

    // 6. Good
    expect(classifyMoveQuality(35, 50, [createMockCandidate(4, 20, 50)], false, false)).toBe('good');

    // 7. Inaccuracy
    expect(classifyMoveQuality(75, 50, [createMockCandidate(4, 20, 50)], false, false)).toBe('inaccuracy');

    // 8. Mistake
    expect(classifyMoveQuality(180, 50, [createMockCandidate(4, 20, 50)], false, false)).toBe('mistake');

    // 9. Miss (squandering a >= 200 advantage with >= 150 drop)
    expect(classifyMoveQuality(180, 250, [createMockCandidate(4, 20, 250)], false, false)).toBe('miss');

    // 10. Blunder
    expect(classifyMoveQuality(350, 50, [createMockCandidate(4, 20, 50)], false, false)).toBe('blunder');
  });

  it('analyzes the user 20-move sample with Tier 8 Master engine and predicts next continuation move', () => {
    const report = analyzeGame(userGameSnippet, {
      depth: 2, // Fast depth for test runner
      timeLimitMs: 20,
    });

    expect(report.totalPlies).toBe(39);
    expect(report.moves.length).toBe(39);

    // Verify move 1 (Fe1-e3) is Book
    expect(report.moves[0].playedNotation).toBe('Fe1-e3');
    expect(report.moves[0].quality).toBe('book');

    // Verify move 1 response (Pc7-e5) is Book
    expect(report.moves[1].playedNotation).toBe('Pc7-e5');
    expect(report.moves[1].quality).toBe('book');

    // Verify player accuracy is computed
    expect(report.blueAccuracy).toBeGreaterThanOrEqual(0);
    expect(report.blueAccuracy).toBeLessThanOrEqual(100);
    expect(report.greenAccuracy).toBeGreaterThanOrEqual(0);
    expect(report.greenAccuracy).toBeLessThanOrEqual(100);

    // Verify next best move prediction for Move 20 Green's turn
    expect(report.isComplete).toBe(false);
    expect(report.nextMove).toBeDefined();
    expect(report.nextMove?.turn).toBe('green');
    expect(report.nextMove?.bestMove).toBeDefined();
    expect(report.nextMove?.notation).toBeDefined();
    expect(report.nextMove?.candidateMoves.length).toBeGreaterThan(0);
  });

  it('reliably analyzes games at deep search (depth >= 7) with strictly finite evaluations and valid accuracy', () => {
    const shortGame = '1. Pd2-b4 Pe7-g5 2. Fa1-a3 Fb8-b6 3. Pa2-c4 Pf7-e6';
    const report = analyzeGame(shortGame, {
      depth: 8,
      timeLimitMs: 50,
    });

    expect(report.totalPlies).toBe(6);
    expect(Number.isFinite(report.blueAccuracy)).toBe(true);
    expect(Number.isFinite(report.greenAccuracy)).toBe(true);
    expect(report.blueAccuracy).not.toBeNaN();
    expect(report.greenAccuracy).not.toBeNaN();

    for (const move of report.moves) {
      expect(Number.isFinite(move.evalBefore)).toBe(true);
      expect(Number.isFinite(move.evalAfter)).toBe(true);
      expect(Number.isFinite(move.evalDelta)).toBe(true);
      expect(move.evalDelta).toBeGreaterThanOrEqual(0);
      expect(move.evalDelta).not.toBeNaN();
    }
  });
});
