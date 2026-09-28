import {
  BOT_ENGINE_CONFIG,
  BotConfigError,
  type BotTierConfig,
} from './botConfig';

export * from './botConfig';

export const BOT_TIERS: Readonly<Record<number, BotTierConfig>> = BOT_ENGINE_CONFIG.tiers;

/**
 * Retrieves the configuration for a specific bot difficulty level (1 to 8).
 * Throws BotConfigError if the level is not an integer between 1 and 8,
 * eliminating hard-coded fallback defaults.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time, direct array/record key lookup.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant independent of system load.
 */
export function getBotTier(level: number): BotTierConfig {
  if (typeof level !== 'number' || !Number.isFinite(level) || !Number.isInteger(level) || level < 1 || level > 8) {
    throw new BotConfigError(
      `Invalid bot difficulty level: expected integer between 1 and 8, received ${String(level)}.`
    );
  }

  const tier = BOT_TIERS[level];
  if (!tier) {
    throw new BotConfigError(`Configuration for bot difficulty level ${level} is undefined.`);
  }

  return tier;
}
