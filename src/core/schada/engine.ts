import type {
  BoardMatrix,
  BoardState,
  FileLetter,
  GameResult,
  Move,
  PieceColor,
  Square,
} from './types';
import { colRowToSquare, SCHADA_VECTORS, squareToColRow } from './vectors';
import { evaluateGameResult } from './scoring';
import { formatMoveNotation } from './notation';

export function createEmptyBoard(): BoardMatrix {
  const matrix: Partial<BoardMatrix> = {};
  for (let c = 0; c < 8; c++) {
    for (let r = 0; r < 8; r++) {
      const sq = colRowToSquare(c, r)!;
      matrix[sq] = null;
    }
  }
  return matrix as BoardMatrix;
}

export function createInitialBoard(): BoardMatrix {
  const board = createEmptyBoard();

  // Blue armies (Rank 1 & 2)
  for (let c = 0; c < 8; c++) {
    const file = String.fromCharCode('a'.charCodeAt(0) + c) as FileLetter;

    // Rank 1: Alternating FO and O (a1=FO, b1=O, c1=FO, ...)
    const pieceType = c % 2 === 0 ? 'field_officer' : 'officer';
    const sq1 = `${file}1` as Square;
    board[sq1] = {
      id: `blue_${pieceType}_${sq1}`,
      type: pieceType,
      color: 'blue',
      hasLeftBase: false,
      hasReachedGoal: false,
    };

    // Rank 2: 8 Pawns
    const sq2 = `${file}2` as Square;
    board[sq2] = {
      id: `blue_pawn_${sq2}`,
      type: 'pawn',
      color: 'blue',
      hasLeftBase: false,
      hasReachedGoal: false,
    };
  }

  // Green armies (Rank 8 & 7)
  for (let c = 0; c < 8; c++) {
    const file = String.fromCharCode('a'.charCodeAt(0) + c) as FileLetter;

    // Rank 8: Alternating O and FO (a8=O, b8=FO, c8=O, ...)
    // High pieces face enemy high pieces: FO faces O, O faces FO
    const pieceType = c % 2 === 0 ? 'officer' : 'field_officer';
    const sq8 = `${file}8` as Square;
    board[sq8] = {
      id: `green_${pieceType}_${sq8}`,
      type: pieceType,
      color: 'green',
      hasLeftBase: false,
      hasReachedGoal: false,
    };

    // Rank 7: 8 Pawns
    const sq7 = `${file}7` as Square;
    board[sq7] = {
      id: `green_pawn_${sq7}`,
      type: 'pawn',
      color: 'green',
      hasLeftBase: false,
      hasReachedGoal: false,
    };
  }

  return board;
}

export function createInitialGameState(): BoardState {
  const board = createInitialBoard();
  return {
    board,
    currentTurn: 'blue',
    moveHistory: [],
    capturedPieces: {
      blue: [],
      green: [],
    },
    positionHistory: [generatePositionHash(board, 'blue')],
    isGameOver: false,
    result: null,
  };
}

export function generatePositionHash(board: BoardMatrix, currentTurn: PieceColor): string {
  const parts: string[] = [currentTurn];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = colRowToSquare(c, r)!;
      const piece = board[sq];
      if (piece) {
        parts.push(`${sq}:${piece.color[0]}${piece.type[0]}`);
      }
    }
  }
  return parts.join('|');
}

export function getLegalMovesForSquare(board: BoardMatrix, square: Square): Move[] {
  const piece = board[square];
  if (!piece) return [];

  const [col, row] = squareToColRow(square);
  const color = piece.color;
  const isHighPiece = piece.type === 'field_officer' || piece.type === 'officer';
  const baseRank = color === 'blue' ? 0 : 7;
  const goalRank = color === 'blue' ? 7 : 0;

  const vectors = SCHADA_VECTORS[square] || [];
  const legalMoves: Move[] = [];

  for (const vector of vectors) {
    const [dc, dr] = vector.target;
    const destCol = col + dc;
    const destRow = row + dr;

    // 1. Boundary check
    if (destCol < 0 || destCol > 7 || destRow < 0 || destRow > 7) {
      continue;
    }

    const destSquare = colRowToSquare(destCol, destRow)!;
    const destPiece = board[destSquare];

    // 2. Cannot land on a square occupied by a friendly piece
    if (destPiece && destPiece.color === color) {
      continue;
    }

    // 3. High pieces in their goal line are IMMUNE to capture!
    if (destPiece && (destPiece.type === 'field_officer' || destPiece.type === 'officer')) {
      const enemyGoalRank = destPiece.color === 'blue' ? 7 : 0;
      if (destRow === enemyGoalRank) {
        continue; // Cannot capture high piece residing in its goal line
      }
    }

    // 4. Base Line Restriction:
    // Once a high piece leaves its base line, it cannot return to it.
    if (isHighPiece && piece.hasLeftBase && destRow === baseRank) {
      continue;
    }

    // 5. Goal Line Restriction:
    // Once a high piece reaches its goal line, it cannot leave its goal line.
    if (isHighPiece && piece.hasReachedGoal && destRow !== goalRank) {
      continue;
    }

    // 6. Intermediate path clearance:
    // All squares along the path must be empty of pieces, except that
    // Field Officers can leap over friendly pieces along intermediate squares.
    let pathBlocked = false;
    const intermediateSquares: Square[] = [];

    for (const [stepDc, stepDr] of vector.path) {
      const stepCol = col + stepDc;
      const stepRow = row + stepDr;
      if (stepCol < 0 || stepCol > 7 || stepRow < 0 || stepRow > 7) {
        pathBlocked = true;
        break;
      }
      const stepSquare = colRowToSquare(stepCol, stepRow)!;
      intermediateSquares.push(stepSquare);

      const occupant = board[stepSquare];
      if (occupant) {
        // Field Officer can leap over friendly pieces
        if (piece.type === 'field_officer' && occupant.color === color) {
          continue; // Friendly leap allowed
        } else {
          pathBlocked = true;
          break;
        }
      }
    }

    if (pathBlocked) {
      continue;
    }

    legalMoves.push({
      from: square,
      to: destSquare,
      piece: { ...piece },
      captured: destPiece ? { ...destPiece } : undefined,
      intermediateSquares,
      notation: formatMoveNotation(square, destSquare, piece, destPiece ?? undefined),
    });
  }

  return legalMoves;
}

export function getAllLegalMoves(board: BoardMatrix, color: PieceColor): Move[] {
  const allMoves: Move[] = [];
  for (let c = 0; c < 8; c++) {
    for (let r = 0; r < 8; r++) {
      const sq = colRowToSquare(c, r)!;
      const piece = board[sq];
      if (piece && piece.color === color) {
        const moves = getLegalMovesForSquare(board, sq);
        allMoves.push(...moves);
      }
    }
  }
  return allMoves;
}

/**
 * Checks if targetSquare is attacked by any piece of attackerColor.
 * Highly optimized for engine/bot lookaheads: exits immediately on first valid attack line,
 * avoiding object allocations and notation formatting.
 */
export function isSquareAttacked(
  board: BoardMatrix,
  targetSquare: Square,
  attackerColor: PieceColor
): boolean {
  const [targetCol, targetRow] = squareToColRow(targetSquare);
  const baseRank = attackerColor === 'blue' ? 0 : 7;
  const goalRank = attackerColor === 'blue' ? 7 : 0;

  for (let c = 0; c < 8; c++) {
    for (let r = 0; r < 8; r++) {
      const sq = colRowToSquare(c, r)!;
      const piece = board[sq];
      if (!piece || piece.color !== attackerColor) continue;

      const vectors = SCHADA_VECTORS[sq];
      if (!vectors) continue;

      const isHighPiece = piece.type === 'field_officer' || piece.type === 'officer';

      // High piece movement constraints
      if (isHighPiece && piece.hasLeftBase && targetRow === baseRank) continue;
      if (isHighPiece && piece.hasReachedGoal && targetRow !== goalRank) continue;

      for (const vector of vectors) {
        const destCol = c + vector.target[0];
        const destRow = r + vector.target[1];

        if (destCol === targetCol && destRow === targetRow) {
          // Validate intermediate path
          let blocked = false;
          for (const [stepDc, stepDr] of vector.path) {
            const stepCol = c + stepDc;
            const stepRow = r + stepDr;
            const stepSq = colRowToSquare(stepCol, stepRow)!;
            const occupant = board[stepSq];
            if (occupant) {
              if (piece.type === 'field_officer' && occupant.color === attackerColor) {
                continue; // Field officer friendly leap allowed
              }
              blocked = true;
              break;
            }
          }
          if (!blocked) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Checks if all remaining high pieces of a player have reached their goal line.
 */
export function haveAllRemainingHighPiecesReachedGoal(board: BoardMatrix, color: PieceColor): boolean {
  const goalRank = color === 'blue' ? 7 : 0;
  let remainingHighPiecesCount = 0;

  for (const [sq, piece] of Object.entries(board)) {
    if (piece && piece.color === color && (piece.type === 'field_officer' || piece.type === 'officer')) {
      remainingHighPiecesCount++;
      const [, row] = squareToColRow(sq as Square);
      if (row !== goalRank) {
        return false;
      }
    }
  }

  return remainingHighPiecesCount > 0;
}

/**
 * Checks if a player has any non-goal high pieces that can move, or if they are blocked by enemy pieces.
 */
export function areNonGoalHighPiecesBlocked(board: BoardMatrix, color: PieceColor): boolean {
  const goalRank = color === 'blue' ? 7 : 0;
  let nonGoalHighPiecesCount = 0;
  let hasAnyLegalHighPieceMove = false;

  for (const [sq, piece] of Object.entries(board)) {
    if (piece && piece.color === color && (piece.type === 'field_officer' || piece.type === 'officer')) {
      const [, row] = squareToColRow(sq as Square);
      if (row !== goalRank) {
        nonGoalHighPiecesCount++;
        const moves = getLegalMovesForSquare(board, sq as Square);
        if (moves.length > 0) {
          hasAnyLegalHighPieceMove = true;
          break;
        }
      }
    }
  }

  // If there are high pieces outside the goal, but NONE of them can make a move, they are blocked.
  return nonGoalHighPiecesCount > 0 && !hasAnyLegalHighPieceMove;
}

export function executeMove(state: BoardState, move: Move): BoardState {
  if (state.isGameOver) return state;

  const newBoard: BoardMatrix = { ...state.board };
  const currentPiece = { ...newBoard[move.from]! };

  // Remove moving piece from source
  newBoard[move.from] = null;

  // Handle capture
  const captured = newBoard[move.to];
  const newCaptured = {
    blue: [...state.capturedPieces.blue],
    green: [...state.capturedPieces.green],
  };
  if (captured) {
    if (captured.color === 'blue') {
      newCaptured.blue.push(captured);
    } else {
      newCaptured.green.push(captured);
    }
  }

  // Update piece attributes
  const [, destRow] = squareToColRow(move.to);
  const baseRank = currentPiece.color === 'blue' ? 0 : 7;
  const goalRank = currentPiece.color === 'blue' ? 7 : 0;

  if (destRow !== baseRank) {
    currentPiece.hasLeftBase = true;
  }
  if (destRow === goalRank) {
    currentPiece.hasReachedGoal = true;
  }

  // Place piece on destination
  newBoard[move.to] = currentPiece;

  const nextTurn: PieceColor = state.currentTurn === 'blue' ? 'green' : 'blue';
  const newPositionHash = generatePositionHash(newBoard, nextTurn);
  const newPositionHistory = [...state.positionHistory, newPositionHash];

  // Check end conditions:
  let isGameOver = false;
  let result: GameResult | null = null;

  // 1. Goal reached: If all remaining high pieces of current mover are in goal line
  if (haveAllRemainingHighPiecesReachedGoal(newBoard, state.currentTurn)) {
    isGameOver = true;
    result = evaluateGameResult(newBoard, 'goal_reached');
  }

  // 2. Repetition: 3-fold repetition of the same board position
  if (!isGameOver) {
    const occurrences = newPositionHistory.filter((h) => h === newPositionHash).length;
    if (occurrences >= 3) {
      isGameOver = true;
      result = evaluateGameResult(newBoard, 'repetition');
    }
  }

  // 3. Blocked: Next player's high pieces outside goal cannot move
  if (!isGameOver && areNonGoalHighPiecesBlocked(newBoard, nextTurn)) {
    isGameOver = true;
    result = evaluateGameResult(newBoard, 'blocked');
  }

  return {
    board: newBoard,
    currentTurn: nextTurn,
    moveHistory: [...state.moveHistory, move],
    capturedPieces: newCaptured,
    positionHistory: newPositionHistory,
    isGameOver,
    result,
  };
}

export function resignGame(state: BoardState, resigningColor: PieceColor): BoardState {
  if (state.isGameOver) return state;
  const winner = resigningColor === 'blue' ? 'green' : 'blue';
  const blueScore = evaluateGameResult(state.board, 'resignation').blueScore;
  const greenScore = evaluateGameResult(state.board, 'resignation').greenScore;

  return {
    ...state,
    isGameOver: true,
    result: {
      winner,
      winReason: 'resignation',
      blueScore,
      greenScore,
    },
  };
}

export function timeoutGame(state: BoardState, timedOutColor: PieceColor): BoardState {
  if (state.isGameOver) return state;
  const winner = timedOutColor === 'blue' ? 'green' : 'blue';
  const blueScore = evaluateGameResult(state.board, 'timeout').blueScore;
  const greenScore = evaluateGameResult(state.board, 'timeout').greenScore;

  return {
    ...state,
    isGameOver: true,
    result: {
      winner,
      winReason: 'timeout',
      blueScore,
      greenScore,
    },
  };
}
