import { describe, it, expect } from 'vitest';
import { calculateEloUpdate, getKFactor, calculateExpectedScore } from '../eloService';

describe('Elo Rating Engine', () => {
  it('assigns K=40 for provisional players (<15 games) and K=20 for established players', () => {
    expect(getKFactor(0)).toBe(40);
    expect(getKFactor(14)).toBe(40);
    expect(getKFactor(15)).toBe(20);
    expect(getKFactor(100)).toBe(20);
  });

  it('computes 50% expected score for evenly rated players', () => {
    const expected = calculateExpectedScore(1200, 1200);
    expect(expected).toBeCloseTo(0.5, 3);
  });

  it('calculates fair Elo updates for equally rated players', () => {
    const result = calculateEloUpdate(
      { rating: 1200, gamesPlayed: 5 },
      { rating: 1200, gamesPlayed: 5 },
      'blue'
    );
    expect(result.blueDelta).toBe(20);
    expect(result.greenDelta).toBe(-20);
    expect(result.newBlueRating).toBe(1220);
    expect(result.newGreenRating).toBe(1180);
  });

  it('handles upset victories with higher point rewards', () => {
    const result = calculateEloUpdate(
      { rating: 1000, gamesPlayed: 20 },
      { rating: 1400, gamesPlayed: 20 },
      'blue'
    );
    // Lower rated player beating higher rated player should gain significant points
    expect(result.blueDelta).toBeGreaterThan(15);
    expect(result.greenDelta).toBeLessThan(-15);
  });

  it('awards 0 delta for equal rating draws', () => {
    const result = calculateEloUpdate(
      { rating: 1200, gamesPlayed: 20 },
      { rating: 1200, gamesPlayed: 20 },
      'draw'
    );
    expect(result.blueDelta).toBe(0);
    expect(result.greenDelta).toBe(0);
  });
});
