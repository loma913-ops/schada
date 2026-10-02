import React, { memo } from 'react';
import type { Square, Piece, Move } from '@/core/schada/types';
import { squareToColRow } from '@/core/schada/vectors';
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

export const BoardSquare: React.FC<BoardSquareProps> = memo(({
  square,
  piece,
  isSelected,
  isLastMove,
  legalMoveTarget,
  onClick,
  orientation = 'blue',
  isUnderAttack = false,
}) => {
  const [col, row] = squareToColRow(square);
  const isLight = (col + row) % 2 === 1;

  // Determine if coordinate labels should show on this square
  const showFile = orientation === 'blue' ? row === 0 : row === 7;
  const showRank = orientation === 'blue' ? col === 0 : col === 7;

  // Check if high piece is in goal line (immune to capture)
  const isHighPiece = piece && (piece.type === 'field_officer' || piece.type === 'officer');
  const goalRank = piece?.color === 'blue' ? 7 : 0;
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

      {/* Piece */}
      {piece && (
        <div className="piece-container">
          <PieceIcon piece={piece} />
          {isInvulnerableInGoal ? (
            <div className="goal-invulnerable-badge" title="Safe in Goal Line (Immune to capture)" />
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
    </div>
  );
});

BoardSquare.displayName = 'BoardSquare';

