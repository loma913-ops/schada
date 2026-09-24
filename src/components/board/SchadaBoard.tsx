import React, { useState } from 'react';
import type { BoardMatrix, Move, PieceColor, Square } from '@/core/schada/types';
import { colRowToSquare } from '@/core/schada/vectors';
import { getLegalMovesForSquare } from '@/core/schada/engine';
import { BoardSquare } from './BoardSquare';

interface SchadaBoardProps {
  board: BoardMatrix;
  currentTurn: PieceColor;
  playerColor?: PieceColor; // User's assigned color (or undefined if local/spectator)
  orientation?: 'blue' | 'green';
  lastMove?: Move | null;
  onMakeMove: (move: Move) => void;
  disabled?: boolean;
}

export const SchadaBoard: React.FC<SchadaBoardProps> = ({
  board,
  currentTurn,
  playerColor,
  orientation = 'blue',
  lastMove,
  onMakeMove,
  disabled = false,
}) => {
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);

  // Compute legal moves for currently selected square
  const legalMovesForSelected: Move[] = selectedSquare
    ? getLegalMovesForSquare(board, selectedSquare)
    : [];

  const handleSquareClick = (square: Square) => {
    if (disabled) return;

    // If playerColor is set, only allow moving on your turn
    if (playerColor && playerColor !== currentTurn) {
      return;
    }

    const clickedPiece = board[square];

    // If clicking on an active legal move destination
    const matchingMove = legalMovesForSelected.find((m) => m.to === square);
    if (matchingMove) {
      onMakeMove(matchingMove);
      setSelectedSquare(null);
      return;
    }

    // If clicking a friendly piece on the current turn
    if (clickedPiece && clickedPiece.color === currentTurn) {
      if (selectedSquare === square) {
        setSelectedSquare(null); // toggle off
      } else {
        setSelectedSquare(square);
      }
      return;
    }

    // Deselect otherwise
    setSelectedSquare(null);
  };

  // Generate 64 squares in display order
  const squares: Square[] = [];
  const rows = orientation === 'blue' ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const cols = orientation === 'blue' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];

  for (const r of rows) {
    for (const c of cols) {
      squares.push(colRowToSquare(c, r)!);
    }
  }

  return (
    <div className="schada-board-wrapper">
      <div className="schada-board-grid">
        {squares.map((sq) => {
          const piece = board[sq];
          const isSelected = selectedSquare === sq;
          const isLastMove = lastMove?.from === sq || lastMove?.to === sq;
          const legalMoveTarget = legalMovesForSelected.find((m) => m.to === sq);

          return (
            <BoardSquare
              key={sq}
              square={sq}
              piece={piece}
              isSelected={isSelected}
              isLastMove={isLastMove}
              legalMoveTarget={legalMoveTarget}
              onClick={() => handleSquareClick(sq)}
              orientation={orientation}
            />
          );
        })}
      </div>
    </div>
  );
};
