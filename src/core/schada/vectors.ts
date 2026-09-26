import type { MoveVector, Square, FileLetter, RankNumber } from './types';

// Convert file and rank to/from index
export function squareToColRow(square: Square): [number, number] {
  const col = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const row = parseInt(square[1], 10) - 1;
  return [col, row];
}

export function colRowToSquare(col: number, row: number): Square | null {
  if (col < 0 || col > 7 || row < 0 || row > 7) {
    return null;
  }
  const file = String.fromCharCode('a'.charCodeAt(0) + col) as FileLetter;
  const rank = (row + 1) as RankNumber;
  return `${file}${rank}`;
}

// 64-square movement definitions derived from the original 1936 Boogerd patent & official board
export const SCHADA_VECTORS: Record<Square, MoveVector[]> = {
  "a1": [{ "target": [1, 0], "path": [] }, { "target": [0, 2], "path": [[0, 1]] }],
  "b1": [{ "target": [-1, 0], "path": [] }, { "target": [1, 0], "path": [] }, { "target": [0, 1], "path": [] }],
  "c1": [{ "target": [-1, 0], "path": [] }, { "target": [1, 0], "path": [] }, { "target": [0, 2], "path": [[0, 1]] }],
  "d1": [{ "target": [-1, 0], "path": [] }, { "target": [1, 0], "path": [] }, { "target": [0, 1], "path": [] }],
  "e1": [{ "target": [-1, 0], "path": [] }, { "target": [1, 0], "path": [] }, { "target": [0, 2], "path": [[0, 1]] }],
  "f1": [{ "target": [-1, 0], "path": [] }, { "target": [1, 0], "path": [] }, { "target": [0, 1], "path": [] }],
  "g1": [{ "target": [-1, 0], "path": [] }, { "target": [1, 0], "path": [] }, { "target": [0, 2], "path": [[0, 1]] }],
  "h1": [{ "target": [-1, 0], "path": [] }, { "target": [0, 1], "path": [] }],

  "a2": [{ "target": [1, -1], "path": [] }, { "target": [2, 2], "path": [[1, 1]] }],
  "b2": [{ "target": [2, 0], "path": [[1, 0]] }, { "target": [1, 1], "path": [] }],
  "c2": [{ "target": [0, -1], "path": [] }, { "target": [1, 1], "path": [] }, { "target": [-2, 2], "path": [[-1, 1]] }],
  "d2": [{ "target": [1, -1], "path": [] }, { "target": [-2, 2], "path": [[-1, 1]] }],
  "e2": [{ "target": [0, -1], "path": [] }, { "target": [-1, 1], "path": [] }, { "target": [2, 2], "path": [[1, 1]] }],
  "f2": [{ "target": [-2, 2], "path": [[-1, 1]] }, { "target": [2, -1], "path": [[1, 0], [2, 0]] }],
  "g2": [{ "target": [-2, 0], "path": [[-1, 0]] }, { "target": [1, 0], "path": [] }, { "target": [-2, 2], "path": [[0, 1], [0, 2], [-1, 2]] }],
  "h2": [{ "target": [-1, -1], "path": [] }, { "target": [-2, 0], "path": [[-1, 0]] }, { "target": [0, 2], "path": [[0, 1]] }],

  "a3": [{ "target": [2, 0], "path": [[1, 0]] }, { "target": [3, 3], "path": [[1, 1], [2, 2]] }],
  "b3": [{ "target": [-1, 0], "path": [] }, { "target": [1, -1], "path": [] }, { "target": [2, 2], "path": [[1, 1]] }],
  "c3": [{ "target": [-1, -1], "path": [] }, { "target": [1, 0], "path": [] }],
  "d3": [{ "target": [0, -2], "path": [[0, -1]] }, { "target": [-2, 0], "path": [[-1, 0]] }, { "target": [2, 2], "path": [[1, 1]] }],
  "e3": [{ "target": [2, -2], "path": [[1, -1]] }, { "target": [1, 1], "path": [] }, { "target": [-2, 2], "path": [[-1, 1]] }],
  "f3": [{ "target": [0, -2], "path": [[0, -1]] }, { "target": [-1, 1], "path": [] }, { "target": [2, 2], "path": [[1, 1]] }],
  "g3": [{ "target": [-1, 0], "path": [] }, { "target": [1, 0], "path": [] }],
  "h3": [{ "target": [-1, -1], "path": [] }, { "target": [-3, 3], "path": [[-1, 1], [-2, 2]] }],

  "a4": [{ "target": [0, -2], "path": [[0, -1]] }, { "target": [1, -1], "path": [] }, { "target": [1, 1], "path": [] }],
  "b4": [{ "target": [-1, 1], "path": [] }, { "target": [2, -2], "path": [[1, -1]] }, { "target": [2, 2], "path": [[1, 1]] }],
  "c4": [{ "target": [-2, 0], "path": [[-1, 0]] }, { "target": [1, -1], "path": [] }, { "target": [0, 2], "path": [[0, 1]] }],
  "d4": [{ "target": [2, 0], "path": [[1, 0]] }, { "target": [0, 1], "path": [] }, { "target": [-3, -3], "path": [[-1, -1], [-2, -2]] }],
  "e4": [{ "target": [-1, 0], "path": [] }, { "target": [0, 2], "path": [[0, 1]] }, { "target": [3, -3], "path": [[1, -1], [2, -2]] }],
  "f4": [{ "target": [-1, 0], "path": [] }, { "target": [1, 0], "path": [] }, { "target": [1, 1], "path": [[0, 1], [0, 1]] }, { "target": [-1, -1], "path": [[0, -1], [0, -1]] }],
  "g4": [{ "target": [0, -1], "path": [] }, { "target": [-2, 2], "path": [[-1, 1]] }, { "target": [1, 1], "path": [] }],
  "h4": [{ "target": [0, -1], "path": [] }, { "target": [-2, 1], "path": [[-1, 0], [-2, 0]] }],

  // Ranks 5-8: Exact 180° rotation of ranks 1-4
  "a5": [{ "target": [0, 1], "path": [] }, { "target": [2, -1], "path": [[1, 0], [2, 0]] }],
  "b5": [{ "target": [0, 1], "path": [] }, { "target": [2, -2], "path": [[1, -1]] }, { "target": [-1, -1], "path": [] }],
  "c5": [{ "target": [1, 0], "path": [] }, { "target": [-1, 0], "path": [] }, { "target": [-1, -1], "path": [[0, -1], [0, -1]] }, { "target": [1, 1], "path": [[0, 1], [0, 1]] }],
  "d5": [{ "target": [1, 0], "path": [] }, { "target": [0, -2], "path": [[0, -1]] }, { "target": [-3, 3], "path": [[-1, 1], [-2, 2]] }],
  "e5": [{ "target": [-2, 0], "path": [[-1, 0]] }, { "target": [0, -1], "path": [] }, { "target": [3, 3], "path": [[1, 1], [2, 2]] }],
  "f5": [{ "target": [2, 0], "path": [[1, 0]] }, { "target": [-1, 1], "path": [] }, { "target": [0, -2], "path": [[0, -1]] }],
  "g5": [{ "target": [1, -1], "path": [] }, { "target": [-2, 2], "path": [[-1, 1]] }, { "target": [-2, -2], "path": [[-1, -1]] }],
  "h5": [{ "target": [0, 2], "path": [[0, 1]] }, { "target": [-1, 1], "path": [] }, { "target": [-1, -1], "path": [] }],

  "a6": [{ "target": [1, 1], "path": [] }, { "target": [3, -3], "path": [[1, -1], [2, -2]] }],
  "b6": [{ "target": [1, 0], "path": [] }, { "target": [-1, 0], "path": [] }],
  "c6": [{ "target": [0, 2], "path": [[0, 1]] }, { "target": [1, -1], "path": [] }, { "target": [-2, -2], "path": [[-1, -1]] }],
  "d6": [{ "target": [-2, 2], "path": [[-1, 1]] }, { "target": [-1, -1], "path": [] }, { "target": [2, -2], "path": [[1, -1]] }],
  "e6": [{ "target": [0, 2], "path": [[0, 1]] }, { "target": [2, 0], "path": [[1, 0]] }, { "target": [-2, -2], "path": [[-1, -1]] }],
  "f6": [{ "target": [1, 1], "path": [] }, { "target": [-1, 0], "path": [] }],
  "g6": [{ "target": [1, 0], "path": [] }, { "target": [-1, 1], "path": [] }, { "target": [-2, -2], "path": [[-1, -1]] }],
  "h6": [{ "target": [-2, 0], "path": [[-1, 0]] }, { "target": [-3, -3], "path": [[-1, -1], [-2, -2]] }],

  "a7": [{ "target": [1, 1], "path": [] }, { "target": [2, 0], "path": [[1, 0]] }, { "target": [0, -2], "path": [[0, -1]] }],
  "b7": [{ "target": [2, 0], "path": [[1, 0]] }, { "target": [-1, 0], "path": [] }, { "target": [2, -2], "path": [[0, -1], [0, -2], [1, -2]] }],
  "c7": [{ "target": [2, -2], "path": [[1, -1]] }, { "target": [-2, 1], "path": [[-1, 0], [-2, 0]] }],
  "d7": [{ "target": [0, 1], "path": [] }, { "target": [1, -1], "path": [] }, { "target": [-2, -2], "path": [[-1, -1]] }],
  "e7": [{ "target": [-1, 1], "path": [] }, { "target": [2, -2], "path": [[1, -1]] }],
  "f7": [{ "target": [0, 1], "path": [] }, { "target": [-1, -1], "path": [] }, { "target": [2, -2], "path": [[1, -1]] }],
  "g7": [{ "target": [-2, 0], "path": [[-1, 0]] }, { "target": [-1, -1], "path": [] }],
  "h7": [{ "target": [-1, 1], "path": [] }, { "target": [-2, -2], "path": [[-1, -1]] }],

  "a8": [{ "target": [1, 0], "path": [] }, { "target": [0, -1], "path": [] }],
  "b8": [{ "target": [1, 0], "path": [] }, { "target": [-1, 0], "path": [] }, { "target": [0, -2], "path": [[0, -1]] }],
  "c8": [{ "target": [1, 0], "path": [] }, { "target": [-1, 0], "path": [] }, { "target": [0, -1], "path": [] }],
  "d8": [{ "target": [1, 0], "path": [] }, { "target": [-1, 0], "path": [] }, { "target": [0, -2], "path": [[0, -1]] }],
  "e8": [{ "target": [1, 0], "path": [] }, { "target": [-1, 0], "path": [] }, { "target": [0, -1], "path": [] }],
  "f8": [{ "target": [1, 0], "path": [] }, { "target": [-1, 0], "path": [] }, { "target": [0, -2], "path": [[0, -1]] }],
  "g8": [{ "target": [1, 0], "path": [] }, { "target": [-1, 0], "path": [] }, { "target": [0, -1], "path": [] }],
  "h8": [{ "target": [-1, 0], "path": [] }, { "target": [0, -2], "path": [[0, -1]] }]
};
