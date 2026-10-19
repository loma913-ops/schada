import React, { memo } from 'react';
import type { Piece } from '@/core/schada/types';

interface PieceIconProps {
  piece: Piece;
}

export const PieceIcon: React.FC<PieceIconProps> = memo(({ piece }) => {
  const isWhite = piece.color === 'white' || (piece.color as string) === 'blue';
  const primaryColor = isWhite ? '#F1EFE7' : '#18181B';
  const secondaryColor = isWhite ? '#27272a' : '#09090b';
  const highlightColor = isWhite ? '#71717a' : '#a1a1aa';
  const centerColor = isWhite ? '#18181B' : '#F1EFE7';

  // Internal element colors with high visibility on both ivory and charcoal bases
  const starFill = isWhite ? highlightColor : '#64646e';
  const starStroke = isWhite ? secondaryColor : '#a1a1aa';
  const diamondFill = isWhite ? highlightColor : '#64646e';
  const diamondStroke = isWhite ? secondaryColor : '#a1a1aa';

  if (piece.type === 'field_officer') {
    return (
      <svg viewBox="0 0 100 100" className="piece-icon" width="100%" height="100%">
        {/* Outer Hexagon */}
        <polygon
          points="50,6 88.11,28 88.11,72 50,94 11.89,72 11.89,28"
          fill={primaryColor}
          stroke={secondaryColor}
          strokeWidth="4"
          strokeLinejoin="round"
        />
        {/* Inner Hexagon Ring */}
        <polygon
          points="50,16 79.44,33 79.44,67 50,84 20.56,67 20.56,33"
          fill="none"
          stroke={highlightColor}
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        {/* Central Crown / Star */}
        <path
          d="M 50 26 L 56 42 L 72 44 L 60 56 L 63 72 L 50 64 L 37 72 L 40 56 L 28 44 L 44 42 Z"
          fill={starFill}
          stroke={starStroke}
          strokeWidth="3"
        />
        <circle cx="50" cy="50" r="5" fill={centerColor} />
      </svg>
    );
  }

  if (piece.type === 'officer') {
    return (
      <svg viewBox="0 0 100 100" className="piece-icon" width="100%" height="100%">
        {/* Outer Hexagon */}
        <polygon
          points="50,8 86.37,29 86.37,71 50,92 13.63,71 13.63,29"
          fill={primaryColor}
          stroke={secondaryColor}
          strokeWidth="4"
          strokeLinejoin="round"
        />
        {/* Central Crest / Diamond */}
        <path
          d="M 50 25 L 75 50 L 50 75 L 25 50 Z"
          fill={diamondFill}
          stroke={diamondStroke}
          strokeWidth="3"
        />
        <circle cx="50" cy="50" r="8" fill={centerColor} />
      </svg>
    );
  }

  // Pawn
  return (
    <svg viewBox="0 0 100 100" className="piece-icon" width="100%" height="100%">
      {/* Compact Circular Shield */}
      <circle
        cx="50"
        cy="50"
        r="31"
        fill={primaryColor}
        stroke={secondaryColor}
        strokeWidth="3.5"
      />
      {/* Central Ring */}
      <circle cx="50" cy="50" r="20" fill="none" stroke={highlightColor} strokeWidth="3" />
      <circle cx="50" cy="50" r="7" fill={centerColor} />
    </svg>
  );
});

PieceIcon.displayName = 'PieceIcon';

