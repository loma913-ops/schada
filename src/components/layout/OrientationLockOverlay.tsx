import React, { useEffect } from 'react';
import { Smartphone, Lock, ArrowRight } from 'lucide-react';
import { useMobileOrientation } from '@/hooks/useMobileOrientation';
import { ORIENTATION_CONFIG } from '@/services/orientation/orientationConfig';

/**
 * Fullscreen orientation lock overlay component.
 * Blocks application interaction on mobile devices whenever in landscape orientation.
 *
 * Algorithmic Complexity:
 * - Rendering: O(1) time, O(1) space
 */
export const OrientationLockOverlay: React.FC = () => {
  const { isBlocked } = useMobileOrientation();
  const { copy } = ORIENTATION_CONFIG;

  // Prevent background scroll when orientation lock overlay is visible
  useEffect(() => {
    if (isBlocked) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isBlocked]);

  return (
    <div
      className={`orientation-lock-overlay ${isBlocked ? 'is-active' : ''}`}
      role="alertdialog"
      aria-modal={isBlocked}
      aria-hidden={!isBlocked}
      aria-labelledby="orientation-title"
      aria-describedby="orientation-desc"
      tabIndex={-1}
      onTouchMove={(e) => {
        if (isBlocked) {
          e.stopPropagation();
        }
      }}
    >
      <div className="orientation-card">
        {/* Animated Phone Rotation Visual */}
        <div className="orientation-device-visual" aria-hidden="true">
          <div className="orientation-pulse-ring" />
          <Smartphone className="orientation-phone-icon" strokeWidth={1.5} />
        </div>

        {/* Mode Requirement Badge */}
        <div className="orientation-badge">
          <Lock size={12} strokeWidth={2.5} />
          <span>{copy.badgeText}</span>
        </div>

        {/* Title & Explanatory Instructions */}
        <h2 id="orientation-title" className="orientation-title">
          {copy.title}
        </h2>
        <p id="orientation-desc" className="orientation-desc">
          {copy.description}
        </p>

        {/* Real-time Status Indicator */}
        <div className="orientation-status-bar" aria-label={copy.ariaLabel}>
          <span className="orientation-pill current">{copy.blockedPillText}</span>
          <ArrowRight className="orientation-status-arrow" size={14} />
          <span className="orientation-pill target">{copy.targetPillText}</span>
        </div>
      </div>
    </div>
  );
};
