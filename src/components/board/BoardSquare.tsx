import React, { memo } from 'react';
import { Shield } from 'lucide-react';
import type { Square, Piece, Move } from '@/core/schada/types';
import { squareToColRow } from '@/core/schada/vectors';
import { SCHADA_RULES_CONFIG } from '@/core/schada/rulesConfig';
import { VectorOverlay } from './VectorOverlay';
import { PieceIcon } from './PieceIcon';

interface BoardSquareProps {
  square: Square;
  piece: Piece | null;
  isSelected: boolean;
  isLastMove: boolean;
  legalMoveTarget: Move | undefined;
  onClick: (square: Square) => void;
  orientation?: 'blue' | 'green';
  isUnderAttack?: boolean;
}

/**
 * BoardSquare renders an individual tile on the 8x8 Schada board.
 * Displays movement vector glyphs, pieces, attack warnings, legal move targets,
 * coordinate indices, and gold shield invulnerability badges.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time coordinate resolution and render.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) invariant; operations do not scale with game move count or historical turns.
 */
export const BoardSquare: React.FC<BoardSquareProps> = memo(({
  square,
  piece,
  isSelected,
  isLastMove,
  legalMoveTarget,
  onClick,
  orientation = SCHADA_RULES_CONFIG.board.defaultOrientation,
  isUnderAttack = false,
}) => {
  const [col, row] = squareToColRow(square);
  const isLight = (col + row) % 2 === 1;

  // Determine if coordinate labels should show on this square based on perspective
  const isBlueOrientation = orientation === 'blue';
  const showFile = isBlueOrientation
    ? row === SCHADA_RULES_CONFIG.board.blueBaseRankIndex
    : row === SCHADA_RULES_CONFIG.board.blueGoalRankIndex;
  const showRank = isBlueOrientation
    ? col === 0
    : col === SCHADA_RULES_CONFIG.board.fileCount - 1;

  // Check if high piece is in goal line (immune to capture)
  const isHighPiece = piece && (piece.type === 'field_officer' || piece.type === 'officer');
  const goalRank = piece?.color === 'blue'
    ? SCHADA_RULES_CONFIG.board.blueGoalRankIndex
    : SCHADA_RULES_CONFIG.board.greenGoalRankIndex;
  const isInvulnerableInGoal = isHighPiece && row === goalRank;

  const handleClick = React.useCallback(() => {
    onClick(square);
  }, [onClick, square]);

  return (
    <div
      className={`board-square ${isLight ? 'light' : 'dark'} ${isSelected ? 'selected' : ''} ${
        isLastMove ? 'last-move' : ''
      }`}
      onClick={handleClick}
      data-square={square}
    >
      {/* Background vector indicators */}
      <VectorOverlay square={square} isSelected={isSelected} orientation={orientation} />

      {/* Coordinate labels */}
      {showRank && <span className="coord-rank">{square[1]}</span>}
      {showFile && <span className="coord-file">{square[0]}</span>}

      {/* Legal Move Indicators */}
      {legalMoveTarget && (
        <>
          {legalMoveTarget.captured ? (
            <div className="move-capture-ring" title={`Capture on ${square}`} />
          ) : (
            <div className="move-dest-dot" title={`Move to ${square}`} />
          )}
        </>
      )}

      {/* Piece */}
      {piece && (
        <div className="piece-container">
          <PieceIcon piece={piece} />
          {isInvulnerableInGoal ? (
            <div
              className="goal-invulnerable-badge"
              title="Safe in Goal Line (Immune to capture)"
              aria-label="Safe in Goal Line (Immune to capture)"
            >
              <Shield
                className="goal-shield-icon"
                size={14}
                fill="var(--accent-gold)"
                stroke="#ffffff"
                strokeWidth={2.2}
                aria-hidden="true"
              />
            </div>
          ) : isUnderAttack ? (
            <div
              className="piece-under-attack-badge"
              title="Under attack (vulnerable to capture)"
              aria-label="Under attack"
            >
              !
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
});

BoardSquare.displayName = 'BoardSquare';

