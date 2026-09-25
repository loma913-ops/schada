import React, { memo } from 'react';
import type { Square } from '@/core/schada/types';
import { BOARD_VISUALS } from '@/core/schada/board_visual_data';

interface VectorOverlayProps {
  square: Square;
  isSelected?: boolean;
  orientation?: 'blue' | 'green';
}

export const VectorOverlay: React.FC<VectorOverlayProps> = memo(({
  square,
  isSelected,
  orientation = 'blue',
}) => {
  const visual = BOARD_VISUALS[square];
  if (!visual) return null;

  const lineColor = isSelected ? '#10b981' : 'var(--sq-vector-line)';
  const dotColor = isSelected ? '#059669' : 'var(--sq-vector-dot)';
  const centerFill = isSelected ? '#10b981' : 'var(--sq-vector-dot)';
  const strokeW = isSelected ? 2.4 : 1.8;

  const isFlipped = orientation === 'green';

  return (
    <svg viewBox="0 0 100 100" className="square-vector-svg">
      <g transform={isFlipped ? 'rotate(180 50 50)' : undefined}>
        {/* Central anchor circle (hole/peg) */}
        <circle cx={50} cy={50} r={7.0} fill={centerFill} />

      {/* Vector lines strictly inside the square */}
      {visual.lines.map(([p1, p2], idx) => (
        <line
          key={`line-${idx}`}
          x1={p1[0]}
          y1={p1[1]}
          x2={p2[0]}
          y2={p2[1]}
          stroke={lineColor}
          strokeWidth={strokeW}
          strokeLinecap="butt"
          strokeLinejoin="round"
          opacity={isSelected ? 1 : 0.85}
        />
      ))}

      {/* Movement dots along vectors */}
      {visual.dots.map(([dx, dy], idx) => (
        <circle
          key={`dot-${idx}`}
          cx={dx}
          cy={dy}
          r={isSelected ? 4.2 : 3.4}
          fill={dotColor}
          stroke={isSelected ? '#ffffff' : 'none'}
          strokeWidth="1"
        />
      ))}
      </g>
    </svg>
  );
});

VectorOverlay.displayName = 'VectorOverlay';

