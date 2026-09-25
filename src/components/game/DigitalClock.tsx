import React, { memo } from 'react';

interface DigitalClockProps {
  remainingMs: number;
  isActive: boolean;
  isLowTime?: boolean;
}

export const DigitalClock: React.FC<DigitalClockProps> = memo(function DigitalClock({
  remainingMs,
  isActive,
  isLowTime,
}) {
  // If unlimited time
  if (remainingMs <= 0 && !isActive) {
    return <div className="digital-clock">∞</div>;
  }

  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  // Show tenths of a second if under 10 seconds and active
  const showTenths = totalSeconds < 10 && remainingMs > 0;
  const tenths = Math.floor((remainingMs % 1000) / 100);

  const formattedTime = showTenths
    ? `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const lowTimeAlert = totalSeconds <= 30 && remainingMs > 0;

  return (
    <div
      className={`digital-clock ${isActive ? 'active' : ''} ${
        lowTimeAlert || isLowTime ? 'low-time' : ''
      }`}
      aria-label="Remaining time"
    >
      {formattedTime}
    </div>
  );
});
