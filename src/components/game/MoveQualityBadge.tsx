import React from 'react';
import type { MoveQuality } from '@/core/analysis/analysisConfig';
import { CANONICAL_ANALYSIS_CONFIG } from '@/core/analysis/analysisConfig';
import {
  CANONICAL_ANALYSIS_DISPLAY_CONFIG,
  type AnalysisDisplayConfig,
  validateAnalysisDisplayConfig,
  AnalysisDisplayConfigError,
} from './analysisDisplayConfig';

export interface MoveQualityBadgeProps {
  readonly quality: MoveQuality;
  readonly size?: number;
  readonly config?: AnalysisDisplayConfig;
  readonly className?: string;
  readonly forceRender?: boolean;
}

/**
 * Renders the graphical vector move quality badge matching the chess platform specification.
 * Solid colored circle with centered white glyph, native HTML tooltip title, and fixed dimensions.
 *
 * Excludes categories not in displayedQualities (such as excellent, good, book) unless forceRender is true.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time rendering.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant rendering cost per ply move badge.
 */
export const MoveQualityBadge: React.FC<MoveQualityBadgeProps> = ({
  quality,
  size,
  config = CANONICAL_ANALYSIS_DISPLAY_CONFIG,
  className = '',
  forceRender = false,
}) => {
  validateAnalysisDisplayConfig(config);

  if (size !== undefined && (typeof size !== 'number' || !Number.isFinite(size) || size <= 0)) {
    throw new AnalysisDisplayConfigError(
      `Invalid badge size ${size}: must be a positive finite number.`
    );
  }

  if (!forceRender && !config.displayedQualities.includes(quality)) {
    return null;
  }

  const badgeInfo = CANONICAL_ANALYSIS_CONFIG.badges[quality];
  if (!badgeInfo) {
    return null;
  }

  const badgeSize = size ?? config.badgeSizePx;

  const renderGlyph = () => {
    switch (quality) {
      case 'best':
        return (
          <polygon
            points="10,4.2 11.8,7.9 15.8,8.4 12.8,11.2 13.7,15.2 10,13.1 6.3,15.2 7.2,11.2 4.2,8.4 8.2,7.9"
            fill="#ffffff"
          />
        );
      case 'miss':
        return (
          <path
            d="M6.5 6.5 L13.5 13.5 M13.5 6.5 L6.5 13.5"
            stroke="#ffffff"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        );
      case 'great':
        return (
          <text
            x="10"
            y="14.2"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="12"
            fontWeight="900"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            !
          </text>
        );
      case 'brilliant':
        return (
          <text
            x="10"
            y="13.8"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="10.5"
            fontWeight="900"
            fontFamily="system-ui, -apple-system, sans-serif"
            letterSpacing="-0.5"
          >
            !!
          </text>
        );
      case 'mistake':
        return (
          <text
            x="10"
            y="14"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="12"
            fontWeight="900"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            ?
          </text>
        );
      case 'inaccuracy':
        return (
          <text
            x="10"
            y="13.8"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="10"
            fontWeight="900"
            fontFamily="system-ui, -apple-system, sans-serif"
            letterSpacing="-0.5"
          >
            ?!
          </text>
        );
      case 'blunder':
        return (
          <text
            x="10"
            y="13.8"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="9.5"
            fontWeight="900"
            fontFamily="system-ui, -apple-system, sans-serif"
            letterSpacing="-0.8"
          >
            ??
          </text>
        );
      case 'good':
        return (
          <path
            d="M5.5 10.5 L8.5 13.5 L14.5 7.5"
            stroke="#ffffff"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      case 'excellent':
        return (
          <path
            d="M6.5 9.5v5m2 0h3.5a1.2 1.2 0 0 0 1.2-1l.7-3a1.2 1.2 0 0 0-1.2-1.3H11V6.2a1.3 1.3 0 0 0-1.3-1.3l-.9 1.6L6.5 9.5"
            stroke="#ffffff"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        );
      case 'book':
        return (
          <path
            d="M5 6.5 C6.5 5.5 8.5 5.5 10 7 C11.5 5.5 13.5 5.5 15 6.5 V14.5 C13.5 13.5 11.5 13.5 10 15 C8.5 13.5 6.5 13.5 5 14.5 Z M10 7 V15"
            stroke="#ffffff"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        );
      default:
        return null;
    }
  };

  return (
    <span
      className={`move-quality-badge ${className}`.trim()}
      title={badgeInfo.label}
      aria-label={badgeInfo.label}
      data-quality={quality}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        verticalAlign: 'middle',
        flexShrink: 0,
        width: badgeSize,
        height: badgeSize,
      }}
    >
      <svg
        width={badgeSize}
        height={badgeSize}
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        <circle cx="10" cy="10" r="9.5" fill={badgeInfo.hexColor} />
        {renderGlyph()}
      </svg>
    </span>
  );
};
