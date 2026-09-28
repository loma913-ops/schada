import React, { memo } from 'react';
import {
  CANONICAL_DIGITAL_CLOCK_CONFIG,
  validateDigitalClockConfig,
  type DigitalClockConfig,
} from './digitalClockConfig';

interface DigitalClockProps {
  remainingMs: number;
  isActive: boolean;
  isLowTime?: boolean;
  isUnlimited?: boolean;
  config?: DigitalClockConfig;
}

/**
 * DigitalClock displays live countdown time for timed games or the infinity symbol (∞) for unlimited games.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time mathematical operations and string formatting.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space for formatted string output.
 *
 * Growth Rate:
 * - O(1) flat.
 */
export const DigitalClock: React.FC<DigitalClockProps> = memo(function DigitalClock({
  remainingMs,
  isActive,
  isLowTime,
  isUnlimited,
  config = CANONICAL_DIGITAL_CLOCK_CONFIG,
}) {
  if (config !== CANONICAL_DIGITAL_CLOCK_CONFIG) {
    validateDigitalClockConfig(config);
  }

  // If unlimited time, both active and inactive clocks show the infinity symbol
  if (isUnlimited || (isUnlimited === undefined && remainingMs <= 0)) {
    return (
      <div
        className={`digital-clock ${isActive ? 'active' : ''}`}
        aria-label={config.ariaLabels.unlimited}
      >
        {config.infinitySymbol}
      </div>
    );
  }

  const totalSeconds = Math.max(0, Math.floor(remainingMs / config.timeUnits.msPerSecond));
  const minutes = Math.floor(totalSeconds / config.timeUnits.secondsPerMinute);
  const seconds = totalSeconds % config.timeUnits.secondsPerMinute;

  // Show tenths of a second if under threshold and active
  const showTenths = totalSeconds < config.thresholds.showTenthsSeconds && remainingMs > 0;
  const tenths = Math.floor((remainingMs % config.timeUnits.msPerSecond) / config.timeUnits.msPerTenth);

  const formattedMinutes = String(minutes).padStart(config.display.zeroPadLength, '0');
  const formattedSeconds = String(seconds).padStart(config.display.zeroPadLength, '0');

  const formattedTime = showTenths
    ? `${formattedMinutes}:${formattedSeconds}.${tenths}`
    : `${formattedMinutes}:${formattedSeconds}`;

  const lowTimeAlert = totalSeconds <= config.thresholds.lowTimeSeconds && remainingMs > 0;

  return (
    <div
      className={`digital-clock ${isActive ? 'active' : ''} ${
        lowTimeAlert || isLowTime ? 'low-time' : ''
      }`}
      aria-label={config.ariaLabels.remainingTime}
    >
      {formattedTime}
    </div>
  );
});

