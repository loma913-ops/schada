import { describe, it, expect } from 'vitest';
import { BOT_TIERS, getBotTier } from '../botTiers';

describe('Bot Tiers Configuration', () => {
  it('defines all 8 distinct difficulty tiers with appropriate names and ratings', () => {
    for (let level = 1; level <= 8; level++) {
      const tier = BOT_TIERS[level];
      expect(tier).toBeDefined();
      expect(tier.level).toBe(level);
      expect(tier.name).toBeTruthy();
      expect(tier.description).toBeTruthy();
    }
  });

  it('verifies Elo scale starts at 100 for Level 1 and reaches 2400 for Level 8', () => {
    expect(BOT_TIERS[1].elo).toBe(100);
    expect(BOT_TIERS[2].elo).toBe(400);
    expect(BOT_TIERS[3].elo).toBe(800);
    expect(BOT_TIERS[4].elo).toBe(1150);
    expect(BOT_TIERS[5].elo).toBe(1500);
    expect(BOT_TIERS[6].elo).toBe(1800);
    expect(BOT_TIERS[7].elo).toBe(2100);
    expect(BOT_TIERS[8].elo).toBe(2400);

    // Strictly monotonic Elo increase
    for (let i = 1; i < 8; i++) {
      expect(BOT_TIERS[i + 1].elo).toBeGreaterThan(BOT_TIERS[i].elo);
    }
  });

  it('strictly validates bot difficulty levels and throws BotConfigError on out-of-range inputs', () => {
    expect(() => getBotTier(0)).toThrow();
    expect(() => getBotTier(-5)).toThrow();
    expect(() => getBotTier(99)).toThrow();
    expect(getBotTier(5).level).toBe(5);
  });

  it('scales search capabilities progressively across the tiers', () => {
    expect(BOT_TIERS[1].useMoveOrdering).toBe(false);
    expect(BOT_TIERS[4].useMoveOrdering).toBe(true);

    expect(BOT_TIERS[4].usePacingAwareness).toBe(false);
    expect(BOT_TIERS[5].usePacingAwareness).toBe(true);

    expect(BOT_TIERS[5].useQuiescence).toBe(false);
    expect(BOT_TIERS[6].useQuiescence).toBe(true);

    expect(BOT_TIERS[6].useNullMovePruning).toBe(false);
    expect(BOT_TIERS[7].useNullMovePruning).toBe(true);

    expect(BOT_TIERS[7].useCentralityHeuristics).toBe(true);
    expect(BOT_TIERS[8].maxDepth).toBeGreaterThanOrEqual(8);
  });
});
