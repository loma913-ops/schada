import type { BoardMatrix, Move, PieceColor, PieceType, Square } from '../schada/types';
import { SCHADA_VECTORS, squareToColRow } from '../schada/vectors';
import { formatMoveNotation } from '../schada/notation';
import { indexToSquare } from './distanceTables';

// Piece numeric constants
export const EMPTY = 0;
export const BLUE_FO = 1;
export const BLUE_O = 2;
export const BLUE_PAWN = 3;
export const GREEN_FO = 4;
export const GREEN_O = 5;
export const GREEN_PAWN = 6;

// Bitflags for squares
export const FLAG_LEFT_BASE = 1;
export const FLAG_REACHED_GOAL = 2;

export interface CompiledVector {
  readonly destIndex: number;
  readonly destRow: number;
  readonly pathIndices: readonly number[];
}

/**
 * Precompiled numeric vectors for 0..63 squares
 * Eliminates string coordinate conversions in hot move generation loop.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(|V| * |V_edges|) = O(1) at startup.
 * - Auxiliary Space Complexity: O(1) static lookup table.
 */
export const COMPILED_VECTORS: readonly (readonly CompiledVector[])[] = Object.freeze(
  (() => {
    const result: CompiledVector[][] = [];
    for (let idx = 0; idx < 64; idx++) {
      const sq = indexToSquare(idx);
      const [c, r] = squareToColRow(sq);
      const vectors = SCHADA_VECTORS[sq] || [];
      const compiled: CompiledVector[] = [];

      for (const v of vectors) {
        const destCol = c + v.target[0];
        const destRow = r + v.target[1];
        if (destCol < 0 || destCol > 7 || destRow < 0 || destRow > 7) {
          continue;
        }

        let validPath = true;
        const pathIndices: number[] = [];
        for (const [stepDc, stepDr] of v.path) {
          const sc = c + stepDc;
          const sr = r + stepDr;
          if (sc < 0 || sc > 7 || sr < 0 || sr > 7) {
            validPath = false;
            break;
          }
          pathIndices.push(sc + sr * 8);
        }
        if (!validPath) continue;

        compiled.push({
          destIndex: destCol + destRow * 8,
          destRow,
          pathIndices,
        });
      }
      result[idx] = compiled;
    }
    return result;
  })()
);

export interface FastMove {
  readonly from: number;
  readonly to: number;
  readonly piece: number;
  readonly captured: number;
  readonly intermediate: readonly number[];
}

export interface UndoRecord {
  readonly from: number;
  readonly to: number;
  readonly piece: number;
  readonly captured: number;
  readonly prevFromFlags: number;
  readonly prevToFlags: number;
  readonly blueHighTotal: number;
  readonly blueHighInGoal: number;
  readonly greenHighTotal: number;
  readonly greenHighInGoal: number;
}

/**
 * FastBoard represents the Schada board state using raw TypedArrays with zero
 * heap allocations during minimax search traversal.
 */
export class FastBoard {
  readonly squares: Int8Array;
  readonly flags: Uint8Array;
  currentTurn: PieceColor;
  blueHighTotal: number = 0;
  blueHighInGoal: number = 0;
  greenHighTotal: number = 0;
  greenHighInGoal: number = 0;

  private readonly undoStack: UndoRecord[] = [];

  constructor() {
    this.squares = new Int8Array(64);
    this.flags = new Uint8Array(64);
    this.currentTurn = 'blue';
  }

  /**
   * Constructs a FastBoard from a high-level BoardMatrix.
   *
   * Algorithmic Complexity:
   * - Time Complexity: O(N) where N = 64 squares = O(1).
   * - Auxiliary Space Complexity: O(1).
   */
  static fromBoardMatrix(matrix: BoardMatrix, currentTurn: PieceColor): FastBoard {
    const fb = new FastBoard();
    fb.currentTurn = currentTurn;

    for (let idx = 0; idx < 64; idx++) {
      const sq = indexToSquare(idx);
      const piece = matrix[sq];
      if (!piece) {
        fb.squares[idx] = EMPTY;
        fb.flags[idx] = 0;
        continue;
      }

      let val = EMPTY;
      if (piece.color === 'blue') {
        if (piece.type === 'field_officer') val = BLUE_FO;
        else if (piece.type === 'officer') val = BLUE_O;
        else val = BLUE_PAWN;
      } else {
        if (piece.type === 'field_officer') val = GREEN_FO;
        else if (piece.type === 'officer') val = GREEN_O;
        else val = GREEN_PAWN;
      }
      fb.squares[idx] = val;

      let flag = 0;
      if (piece.hasLeftBase) flag |= FLAG_LEFT_BASE;
      if (piece.hasReachedGoal) flag |= FLAG_REACHED_GOAL;
      fb.flags[idx] = flag;

      // Incrementally track high pieces
      if (val === BLUE_FO || val === BLUE_O) {
        fb.blueHighTotal++;
        if (flag & FLAG_REACHED_GOAL) fb.blueHighInGoal++;
      } else if (val === GREEN_FO || val === GREEN_O) {
        fb.greenHighTotal++;
        if (flag & FLAG_REACHED_GOAL) fb.greenHighInGoal++;
      }
    }

    return fb;
  }

  /**
   * Converts the internal FastBoard state back to a canonical BoardMatrix.
   *
   * Algorithmic Complexity:
   * - Time Complexity: O(N) where N = 64 squares = O(1).
   * - Auxiliary Space Complexity: O(N) for the returned dictionary.
   */
  toBoardMatrix(): BoardMatrix {
    const matrix: Partial<BoardMatrix> = {};
    for (let idx = 0; idx < 64; idx++) {
      const sq = indexToSquare(idx);
      const val = this.squares[idx];
      if (val === EMPTY) {
        matrix[sq] = null;
        continue;
      }

      const color: PieceColor = val <= 3 ? 'blue' : 'green';
      let type: PieceType = 'pawn';
      if (val === BLUE_FO || val === GREEN_FO) type = 'field_officer';
      else if (val === BLUE_O || val === GREEN_O) type = 'officer';

      const flag = this.flags[idx];
      matrix[sq] = {
        id: `${color}_${type}_${sq}`,
        type,
        color,
        hasLeftBase: (flag & FLAG_LEFT_BASE) !== 0,
        hasReachedGoal: (flag & FLAG_REACHED_GOAL) !== 0,
      };
    }
    return matrix as BoardMatrix;
  }

  /**
   * Converts a numeric FastMove back to standard Move interface.
   *
   * Algorithmic Complexity:
   * - Time Complexity: O(1) constant time.
   * - Auxiliary Space Complexity: O(1).
   */
  toStandardMove(fastMove: FastMove): Move {
    const fromSq = indexToSquare(fastMove.from);
    const toSq = indexToSquare(fastMove.to);
    const color: PieceColor = fastMove.piece <= 3 ? 'blue' : 'green';
    let type: PieceType = 'pawn';
    if (fastMove.piece === BLUE_FO || fastMove.piece === GREEN_FO) type = 'field_officer';
    else if (fastMove.piece === BLUE_O || fastMove.piece === GREEN_O) type = 'officer';

    const piece = {
      id: `${color}_${type}_${fromSq}`,
      type,
      color,
      hasLeftBase: (this.flags[fastMove.from] & FLAG_LEFT_BASE) !== 0,
      hasReachedGoal: (this.flags[fastMove.from] & FLAG_REACHED_GOAL) !== 0,
    };

    let capturedPiece = undefined;
    if (fastMove.captured !== EMPTY) {
      const capColor: PieceColor = fastMove.captured <= 3 ? 'blue' : 'green';
      let capType: PieceType = 'pawn';
      if (fastMove.captured === BLUE_FO || fastMove.captured === GREEN_FO) capType = 'field_officer';
      else if (fastMove.captured === BLUE_O || fastMove.captured === GREEN_O) capType = 'officer';
      capturedPiece = {
        id: `${capColor}_${capType}_${toSq}`,
        type: capType,
        color: capColor,
        hasLeftBase: (this.flags[fastMove.to] & FLAG_LEFT_BASE) !== 0,
        hasReachedGoal: (this.flags[fastMove.to] & FLAG_REACHED_GOAL) !== 0,
      };
    }

    const intermediateSquares: Square[] = fastMove.intermediate.map(indexToSquare);

    return {
      from: fromSq,
      to: toSq,
      piece,
      captured: capturedPiece,
      intermediateSquares,
      notation: formatMoveNotation(fromSq, toSq, piece, capturedPiece),
    };
  }

  /**
   * Checks if all remaining high pieces of a player have reached their goal line.
   *
   * Algorithmic Complexity:
   * - Time Complexity: O(1) constant time via incremental count tracking.
   * - Auxiliary Space Complexity: O(1).
   */
  haveAllRemainingHighPiecesReachedGoal(color: PieceColor): boolean {
    if (color === 'blue') {
      return this.blueHighTotal > 0 && this.blueHighTotal === this.blueHighInGoal;
    } else {
      return this.greenHighTotal > 0 && this.greenHighTotal === this.greenHighInGoal;
    }
  }

  /**
   * Executes a move in-place on the board state.
   *
   * Algorithmic Complexity:
   * - Time Complexity: O(1) constant time, direct array mutations.
   * - Auxiliary Space Complexity: O(1) for the pushed undo stack record.
   */
  makeMove(move: FastMove): void {
    const { from, to, piece, captured } = move;
    const prevFromFlags = this.flags[from];
    const prevToFlags = this.flags[to];

    this.undoStack.push({
      from,
      to,
      piece,
      captured,
      prevFromFlags,
      prevToFlags,
      blueHighTotal: this.blueHighTotal,
      blueHighInGoal: this.blueHighInGoal,
      greenHighTotal: this.greenHighTotal,
      greenHighInGoal: this.greenHighInGoal,
    });

    if (captured === BLUE_FO || captured === BLUE_O) {
      this.blueHighTotal--;
      if (prevToFlags & FLAG_REACHED_GOAL) this.blueHighInGoal--;
    } else if (captured === GREEN_FO || captured === GREEN_O) {
      this.greenHighTotal--;
      if (prevToFlags & FLAG_REACHED_GOAL) this.greenHighInGoal--;
    }

    this.squares[from] = EMPTY;
    this.flags[from] = 0;

    this.squares[to] = piece;

    const isBlue = piece <= 3;
    const baseRank = isBlue ? 0 : 7;
    const goalRank = isBlue ? 7 : 0;
    const destRow = Math.floor(to / 8);

    let nextFlags = prevFromFlags;
    if (destRow !== baseRank) {
      nextFlags |= FLAG_LEFT_BASE;
    }

    const isHighPiece = piece === BLUE_FO || piece === BLUE_O || piece === GREEN_FO || piece === GREEN_O;
    if (isHighPiece) {
      const wasInGoal = (prevFromFlags & FLAG_REACHED_GOAL) !== 0;
      const nowInGoal = destRow === goalRank;
      if (nowInGoal) {
        nextFlags |= FLAG_REACHED_GOAL;
        if (!wasInGoal) {
          if (isBlue) this.blueHighInGoal++;
          else this.greenHighInGoal++;
        }
      }
    }

    this.flags[to] = nextFlags;
    this.currentTurn = this.currentTurn === 'blue' ? 'green' : 'blue';
  }

  /**
   * Reverts the most recent move using the undo stack.
   *
   * Algorithmic Complexity:
   * - Time Complexity: O(1) constant time array pops.
   * - Auxiliary Space Complexity: O(1).
   */
  unmakeMove(): void {
    const record = this.undoStack.pop();
    if (!record) return;

    const { from, to, piece, captured, prevFromFlags, prevToFlags } = record;

    this.squares[from] = piece;
    this.flags[from] = prevFromFlags;

    this.squares[to] = captured;
    this.flags[to] = prevToFlags;

    this.blueHighTotal = record.blueHighTotal;
    this.blueHighInGoal = record.blueHighInGoal;
    this.greenHighTotal = record.greenHighTotal;
    this.greenHighInGoal = record.greenHighInGoal;

    this.currentTurn = this.currentTurn === 'blue' ? 'green' : 'blue';
  }

  /**
   * Generates all legal moves for a given player color.
   *
   * Algorithmic Complexity:
   * - Time Complexity: O(P * V_max) where P <= 16 pieces and V_max <= 4 vectors = O(1) bounded.
   * - Auxiliary Space Complexity: O(M) where M <= 64 candidate moves.
   */
  generateLegalMoves(color: PieceColor = this.currentTurn): FastMove[] {
    const moves: FastMove[] = [];
    const isBlue = color === 'blue';
    const baseRank = isBlue ? 0 : 7;
    const goalRank = isBlue ? 7 : 0;
    const enemyGoalRank = isBlue ? 0 : 7;

    for (let from = 0; from < 64; from++) {
      const piece = this.squares[from];
      if (piece === EMPTY) continue;

      const pieceIsBlue = piece <= 3;
      if (pieceIsBlue !== isBlue) continue;

      const isHighPiece = piece === BLUE_FO || piece === BLUE_O || piece === GREEN_FO || piece === GREEN_O;
      const isFO = piece === BLUE_FO || piece === GREEN_FO;
      const fromFlags = this.flags[from];
      const hasLeftBase = (fromFlags & FLAG_LEFT_BASE) !== 0;
      const hasReachedGoal = (fromFlags & FLAG_REACHED_GOAL) !== 0;

      const vectors = COMPILED_VECTORS[from];
      for (let v = 0; v < vectors.length; v++) {
        const vec = vectors[v];
        const dest = vec.destIndex;
        const destRow = vec.destRow;
        const occupant = this.squares[dest];

        // 1. Friendly occupant collision
        if (occupant !== EMPTY) {
          const occupantIsBlue = occupant <= 3;
          if (occupantIsBlue === isBlue) continue;

          // 2. High pieces in their goal line are IMMUNE to capture
          const occupantIsHigh = occupant === BLUE_FO || occupant === BLUE_O || occupant === GREEN_FO || occupant === GREEN_O;
          if (occupantIsHigh && destRow === enemyGoalRank) {
            continue;
          }
        }

        // 3. Base line restriction: cannot return to base line once left
        if (isHighPiece && hasLeftBase && destRow === baseRank) {
          continue;
        }

        // 4. Goal line restriction: cannot leave goal line once reached
        if (isHighPiece && hasReachedGoal && destRow !== goalRank) {
          continue;
        }

        // 5. Intermediate path clearance
        let blocked = false;
        const path = vec.pathIndices;
        for (let p = 0; p < path.length; p++) {
          const stepIdx = path[p];
          const stepOcc = this.squares[stepIdx];
          if (stepOcc !== EMPTY) {
            // Field Officer can leap over friendly pieces
            if (isFO && (stepOcc <= 3) === isBlue) {
              continue;
            }
            blocked = true;
            break;
          }
        }
        if (blocked) continue;

        moves.push({
          from,
          to: dest,
          piece,
          captured: occupant,
          intermediate: path,
        });
      }
    }

    return moves;
  }

  /**
   * Checks if a target square is under attack by any piece of attackerColor.
   *
   * Algorithmic Complexity:
   * - Time Complexity: O(P * V_max) = O(1) bounded.
   * - Auxiliary Space Complexity: O(1).
   */
  isSquareAttacked(targetIndex: number, attackerColor: PieceColor): boolean {
    const isAttackerBlue = attackerColor === 'blue';
    const baseRank = isAttackerBlue ? 0 : 7;
    const goalRank = isAttackerBlue ? 7 : 0;
    const targetRow = Math.floor(targetIndex / 8);

    for (let from = 0; from < 64; from++) {
      const piece = this.squares[from];
      if (piece === EMPTY) continue;
      if ((piece <= 3) !== isAttackerBlue) continue;

      const isHighPiece = piece === BLUE_FO || piece === BLUE_O || piece === GREEN_FO || piece === GREEN_O;
      const isFO = piece === BLUE_FO || piece === GREEN_FO;
      const fromFlags = this.flags[from];

      if (isHighPiece && (fromFlags & FLAG_LEFT_BASE) && targetRow === baseRank) continue;
      if (isHighPiece && (fromFlags & FLAG_REACHED_GOAL) && targetRow !== goalRank) continue;

      const vectors = COMPILED_VECTORS[from];
      for (let v = 0; v < vectors.length; v++) {
        const vec = vectors[v];
        if (vec.destIndex !== targetIndex) continue;

        let blocked = false;
        for (let p = 0; p < vec.pathIndices.length; p++) {
          const stepIdx = vec.pathIndices[p];
          const stepOcc = this.squares[stepIdx];
          if (stepOcc !== EMPTY) {
            if (isFO && (stepOcc <= 3) === isAttackerBlue) {
              continue;
            }
            blocked = true;
            break;
          }
        }
        if (!blocked) return true;
      }
    }

    return false;
  }
}
