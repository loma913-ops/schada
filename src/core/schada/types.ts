export type PieceColor = 'blue' | 'green';

export type PieceType = 'field_officer' | 'officer' | 'pawn';

export type FileLetter = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h';
export type RankNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type Square = `${FileLetter}${RankNumber}`;

export interface Piece {
  id: string;
  type: PieceType;
  color: PieceColor;
  /** True once a high piece has moved out of its base rank */
  hasLeftBase: boolean;
  /** True once a high piece has entered its goal rank */
  hasReachedGoal: boolean;
}

export interface MoveVector {
  /** Delta [deltaCol, deltaRow] relative to the square */
  target: [number, number];
  /** Intermediate squares visited before landing */
  path: [number, number][];
}

export interface Move {
  from: Square;
  to: Square;
  piece: Piece;
  captured?: Piece;
  intermediateSquares: Square[];
  notation: string;
}

export type GameStatus = 'waiting' | 'in_progress' | 'completed' | 'abandoned';

export type WinReason =
  | 'goal_reached'
  | 'timeout'
  | 'resignation'
  | 'repetition'
  | 'blocked'
  | 'mutual_shuffle'
  | 'agreement';

export interface ScoreBreakdown {
  goalScore: number;
  outsideGoalHighPiecesScore: number;
  rankDistanceScore: number;
  totalScore: number;
}

export interface GameResult {
  winner: PieceColor | 'draw' | null;
  winReason: WinReason | null;
  blueScore: ScoreBreakdown;
  greenScore: ScoreBreakdown;
}

export type BoardMatrix = Record<Square, Piece | null>;

export interface BoardState {
  board: BoardMatrix;
  currentTurn: PieceColor;
  moveHistory: Move[];
  capturedPieces: {
    blue: Piece[];
    green: Piece[];
  };
  positionHistory: string[]; // FEN-like or position hashes for 3-fold repetition
  isGameOver: boolean;
  result: GameResult | null;
}
