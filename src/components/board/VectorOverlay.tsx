import React from 'react';
import type { Square, MoveVector } from '@/core/schada/types';
import { SCHADA_VECTORS } from '@/core/schada/vectors';

interface VectorOverlayProps {
  square: Square;
  isSelected?: boolean;
}

export const VectorOverlay: React.FC<VectorOverlayProps> = ({ square, isSelected }) => {
  const vectors: MoveVector[] = SCHADA_VECTORS[square] || [];

  // Square coordinate system: 0 to 100 with center at (50, 50)
  const cx = 50;
  const cy = 50;
  // A 1-step move in board coordinates scales to ~38 units in tile SVG space
  const STEP = 38;

  const lineColor = isSelected ? '#10b981' : 'var(--sq-vector-line)';
  const dotColor = isSelected ? '#059669' : 'var(--sq-vector-dot)';
  const strokeW = isSelected ? 2.8 : 1.8;

  return (
    <svg viewBox="0 0 100 100" className="square-vector-svg">
      {/* Center hole circle */}
      <circle cx={cx} cy={cy} r="6" fill="none" stroke={lineColor} strokeWidth="1.5" />

      {vectors.map((vec, vIdx) => {
        // Build SVG path points
        // In SVG coordinates, Y increases DOWNWARDS, but in board rank coordinates Y increases UPWARDS.
        // So board deltaRow > 0 means SVG deltaY < 0!
        const points: [number, number][] = [[cx, cy]];

        // Intermediate waypoints
        for (const [pCol, pRow] of vec.path) {
          points.push([cx + pCol * STEP, cy - pRow * STEP]);
        }

        // Final target
        const [tCol, tRow] = vec.target;
        points.push([cx + tCol * STEP, cy - tRow * STEP]);

        const pathD = points.reduce((acc, [px, py], idx) => {
          return `${acc} ${idx === 0 ? 'M' : 'L'} ${px.toFixed(1)} ${py.toFixed(1)}`;
        }, '');

        return (
          <g key={vIdx}>
            {/* Vector Line */}
            <path
              d={pathD}
              fill="none"
              stroke={lineColor}
              strokeWidth={strokeW}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={isSelected ? 1 : 0.75}
            />

            {/* Dots along path (including target) */}
            {points.slice(1).map(([dotX, dotY], dIdx) => (
              <circle
                key={dIdx}
                cx={dotX}
                cy={dotY}
                r={isSelected ? 4 : 3}
                fill={dotColor}
                stroke={isSelected ? '#ffffff' : 'none'}
                strokeWidth="1"
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
};
