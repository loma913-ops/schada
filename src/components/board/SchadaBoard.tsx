import React, { useState, useMemo, useCallback, memo } from 'react';
import type { BoardMatrix, Move, PieceColor, Square } from '@/core/schada/types';
import { colRowToSquare } from '@/core/schada/vectors';
import { getLegalMovesForSquare, getPiecesUnderAttack } from '@/core/schada/engine';
import { BoardSquare } from './BoardSquare';
import { haptics } from '@/services/device/haptics';
import { SCHADA_RULES_CONFIG } from '@/core/schada/rulesConfig';
import { useGamePreferences } from '@/context/GamePreferencesContext';

interface SchadaBoardProps {
  board: BoardMatrix;
  currentTurn: PieceColor;
  playerColor?: PieceColor; // User's assigned color (or undefined if local/spectator)
  orientation?: PieceColor | 'blue' | 'green';
  lastMove?: Move | null;
  onMakeMove: (move: Move) => void;
  disabled?: boolean;
}

export function getBoardSquaresForOrientation(
  orientation: PieceColor = SCHADA_RULES_CONFIG.board.defaultOrientation
): Square[] {
  const result: Square[] = [];
  const isWhite = orientation === 'white' || (orientation as string) === 'blue';
  const rows = isWhite ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const cols = isWhite ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];

  for (const r of rows) {
    for (const c of cols) {
      result.push(colRowToSquare(c, r)!);
    }
  }
  return result;
}

export const SchadaBoard: React.FC<SchadaBoardProps> = memo(({
  board,
  currentTurn,
  playerColor,
  orientation: propOrientation,
  lastMove,
  onMakeMove,
  disabled = false,
}) => {
  // Ensure board orientation defaults to player's pieces at bottom
  const resolvedPropOrientation: PieceColor | undefined =
    propOrientation === 'blue'
      ? 'white'
      : propOrientation === 'green'
      ? 'black'
      : (propOrientation as PieceColor | undefined);
  const orientation: PieceColor = resolvedPropOrientation ?? playerColor ?? SCHADA_RULES_CONFIG.board.defaultOrientation;
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);

  // Compute legal moves for currently selected square
  const legalMovesForSelected: Move[] = useMemo(() => {
    return selectedSquare ? getLegalMovesForSquare(board, selectedSquare) : [];
  }, [board, selectedSquare]);

  // Index legal moves by destination square for O(1) lookups across all 64 tiles
  const legalMoveMap = useMemo(() => {
    const map = new Map<Square, Move>();
    for (const m of legalMovesForSelected) {
      map.set(m.to, m);
    }
    return map;
  }, [legalMovesForSelected]);

  const handleSquareClick = useCallback(
    (square: Square) => {
      if (disabled) return;

      // If playerColor is set, only allow moving on your turn
      if (playerColor && playerColor !== currentTurn) {
        return;
      }

      const clickedPiece = board[square];

      // If clicking on an active legal move destination
      const matchingMove = legalMoveMap.get(square);
      if (matchingMove) {
        if (matchingMove.captured) {
          haptics.capturePiece();
        } else {
          haptics.movePiece();
        }
        onMakeMove(matchingMove);
        setSelectedSquare(null);
        return;
      }

      // If clicking a friendly piece on the current turn
      if (clickedPiece && clickedPiece.color === currentTurn) {
        if (selectedSquare === square) {
          setSelectedSquare(null); // toggle off
        } else {
          haptics.selectPiece();
          setSelectedSquare(square);
        }
        return;
      }

      // Deselect otherwise
      setSelectedSquare(null);
    },
    [disabled, playerColor, currentTurn, board, legalMoveMap, selectedSquare, onMakeMove]
  );

  const { showThreatIndicators } = useGamePreferences();

  // Generate 64 squares in display order (cached by orientation)
  const squares: Square[] = useMemo(() => {
    return getBoardSquaresForOrientation(orientation);
  }, [orientation]);

  // Compute threatened pieces on board updates (cached by board matrix & preference)
  const attackedSquares = useMemo(() => {
    if (!showThreatIndicators) return new Set<Square>();
    return getPiecesUnderAttack(board);
  }, [board, showThreatIndicators]);

  return (
    <div className="schada-board-wrapper">
      <div className="schada-board-grid">
        {squares.map((sq) => {
          const piece = board[sq];
          const isSelected = selectedSquare === sq;
          const isLastMove = lastMove?.from === sq || lastMove?.to === sq;
          const legalMoveTarget = legalMoveMap.get(sq);
          const isUnderAttack = attackedSquares.has(sq);

          return (
            <BoardSquare
              key={sq}
              square={sq}
              piece={piece}
              isSelected={isSelected}
              isLastMove={isLastMove}
              legalMoveTarget={legalMoveTarget}
              onClick={handleSquareClick}
              orientation={orientation}
              isUnderAttack={isUnderAttack}
            />
          );
        })}
      </div>
    </div>
  );
});

SchadaBoard.displayName = 'SchadaBoard';

