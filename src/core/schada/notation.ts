import type { Piece } from './types';

export function getPieceShortSymbol(piece: Piece): string {
  switch (piece.type) {
    case 'field_officer':
      return 'F';
    case 'officer':
      return 'O';
    case 'pawn':
      return 'P';
  }
}

export function formatMoveNotation(from: string, to: string, piece: Piece, captured?: Piece): string {
  const symbol = getPieceShortSymbol(piece);
  const sep = captured ? 'x' : '-';
  return `${symbol}${from}${sep}${to}`;
}
