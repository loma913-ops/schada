import React from 'react';
import type { Piece } from '@/core/schada/types';

interface PieceIconProps {
  piece: Piece;
}

export const PieceIcon: React.FC<PieceIconProps> = ({ piece }) => {
  const isBlue = piece.color === 'blue';
  const primaryColor = isBlue ? '#2563eb' : '#16a34a';
  const secondaryColor = isBlue ? '#1d4ed8' : '#15803d';
  const highlightColor = isBlue ? '#60a5fa' : '#4ade80';

  if (piece.type === 'field_officer') {
    return (
      <svg viewBox="0 0 100 100" className="piece-icon" width="100%" height="100%">
        <defs>
          <filter id={`shadow-${piece.id}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="3" floodOpacity="0.4" />
          </filter>
        </defs>
        {/* Outer Ring */}
        <circle
          cx="50"
          cy="50"
          r="42"
          fill={primaryColor}
          stroke={secondaryColor}
          strokeWidth="4"
          filter={`url(#shadow-${piece.id})`}
        />
        {/* Inner Ring */}
        <circle cx="50" cy="50" r="32" fill="none" stroke={highlightColor} strokeWidth="3.5" />
        {/* Central Crown / Star */}
        <path
          d="M 50 26 L 56 42 L 72 44 L 60 56 L 63 72 L 50 64 L 37 72 L 40 56 L 28 44 L 44 42 Z"
          fill="#ffffff"
          stroke={secondaryColor}
          strokeWidth="1.5"
        />
        <circle cx="50" cy="50" r="5" fill={primaryColor} />
      </svg>
    );
  }

  if (piece.type === 'officer') {
    return (
      <svg viewBox="0 0 100 100" className="piece-icon" width="100%" height="100%">
        <defs>
          <filter id={`shadow-${piece.id}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="3" floodOpacity="0.4" />
          </filter>
        </defs>
        {/* Outer Circle */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill={primaryColor}
          stroke={secondaryColor}
          strokeWidth="4"
          filter={`url(#shadow-${piece.id})`}
        />
        {/* Central Crest / Diamond */}
        <path
          d="M 50 25 L 75 50 L 50 75 L 25 50 Z"
          fill={highlightColor}
          stroke="#ffffff"
          strokeWidth="3"
        />
        <circle cx="50" cy="50" r="8" fill="#ffffff" />
      </svg>
    );
  }

  // Pawn
  return (
    <svg viewBox="0 0 100 100" className="piece-icon" width="100%" height="100%">
      <defs>
        <filter id={`shadow-${piece.id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodOpacity="0.35" />
        </filter>
      </defs>
      {/* Compact Circular Shield */}
      <circle
        cx="50"
        cy="50"
        r="34"
        fill={primaryColor}
        stroke={secondaryColor}
        strokeWidth="3.5"
        filter={`url(#shadow-${piece.id})`}
      />
      {/* Central Ring */}
      <circle cx="50" cy="50" r="20" fill="none" stroke="#ffffff" strokeWidth="3" opacity="0.9" />
      <circle cx="50" cy="50" r="7" fill="#ffffff" />
    </svg>
  );
};
