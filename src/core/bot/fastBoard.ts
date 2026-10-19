import type { BoardMatrix, Move, PieceColor, PieceType, Square } from '../schada/types';
import { SCHADA_VECTORS, squareToColRow } from '../schada/vectors';
import { formatMoveNotation } from '../schada/notation';
import { indexToSquare } from './distanceTables';
import { SCHADA_RULES_CONFIG } from '../schada/rulesConfig';

// Piece numeric constants
export const EMPTY = 0;
export const WHITE_FO = 1;
export const WHITE_O = 2;
export const WHITE_PAWN = 3;
export const BLACK_FO = 4;
export const BLACK_O = 5;
export const BLACK_PAWN = 6;

// Backward-compatibility aliases
export const BLUE_FO = WHITE_FO;
export const BLUE_O = WHITE_O;
export const BLUE_PAWN = WHITE_PAWN;
export const GREEN_FO = BLACK_FO;
export const GREEN_O = BLACK_O;
export const GREEN_PAWN = BLACK_PAWN;

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
  readonly whiteHighTotal: number;
  readonly whiteHighInGoal: number;
  readonly blackHighTotal: number;
  readonly blackHighInGoal: number;
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
  whiteHighTotal: number = 0;
  whiteHighInGoal: number = 0;
  blackHighTotal: number = 0;
  blackHighInGoal: number = 0;

  get blueHighTotal(): number { return this.whiteHighTotal; }
  set blueHighTotal(v: number) { this.whiteHighTotal = v; }
  get blueHighInGoal(): number { return this.whiteHighInGoal; }
  set blueHighInGoal(v: number) { this.whiteHighInGoal = v; }
  get greenHighTotal(): number { return this.blackHighTotal; }
  set greenHighTotal(v: number) { this.blackHighTotal = v; }
  get greenHighInGoal(): number { return this.blackHighInGoal; }
  set greenHighInGoal(v: number) { this.blackHighInGoal = v; }

  private readonly undoStack: UndoRecord[] = [];

  constructor() {
    this.squares = new Int8Array(64);
    this.flags = new Uint8Array(64);
    this.currentTurn = 'white';
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
      if (piece.color === 'white') {
        if (piece.type === 'field_officer') val = WHITE_FO;
        else if (piece.type === 'officer') val = WHITE_O;
        else val = WHITE_PAWN;
      } else {
        if (piece.type === 'field_officer') val = BLACK_FO;
        else if (piece.type === 'officer') val = BLACK_O;
        else val = BLACK_PAWN;
      }
      fb.squares[idx] = val;

      let flag = 0;
      if (piece.hasLeftBase) flag |= FLAG_LEFT_BASE;
      if (piece.hasReachedGoal) flag |= FLAG_REACHED_GOAL;
      fb.flags[idx] = flag;

      // Incrementally track high pieces
      if (val === WHITE_FO || val === WHITE_O) {
        fb.whiteHighTotal++;
        if (flag & FLAG_REACHED_GOAL) fb.whiteHighInGoal++;
      } else if (val === BLACK_FO || val === BLACK_O) {
        fb.blackHighTotal++;
        if (flag & FLAG_REACHED_GOAL) fb.blackHighInGoal++;
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

      const color: PieceColor = val <= 3 ? 'white' : 'black';
      let type: PieceType = 'pawn';
      if (val === WHITE_FO || val === BLACK_FO) type = 'field_officer';
      else if (val === WHITE_O || val === BLACK_O) type = 'officer';

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
    const color: PieceColor = fastMove.piece <= 3 ? 'white' : 'black';
    let type: PieceType = 'pawn';
    if (fastMove.piece === WHITE_FO || fastMove.piece === BLACK_FO) type = 'field_officer';
    else if (fastMove.piece === WHITE_O || fastMove.piece === BLACK_O) type = 'officer';

    const piece = {
      id: `${color}_${type}_${fromSq}`,
      type,
      color,
      hasLeftBase: (this.flags[fastMove.from] & FLAG_LEFT_BASE) !== 0,
      hasReachedGoal: (this.flags[fastMove.from] & FLAG_REACHED_GOAL) !== 0,
    };

    let capturedPiece = undefined;
    if (fastMove.captured !== EMPTY) {
      const capColor: PieceColor = fastMove.captured <= 3 ? 'white' : 'black';
      let capType: PieceType = 'pawn';
      if (fastMove.captured === WHITE_FO || fastMove.captured === BLACK_FO) capType = 'field_officer';
      else if (fastMove.captured === WHITE_O || fastMove.captured === BLACK_O) capType = 'officer';
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
    if (color === 'white') {
      return this.whiteHighTotal > 0 && this.whiteHighTotal === this.whiteHighInGoal;
    } else {
      return this.blackHighTotal > 0 && this.blackHighTotal === this.blackHighInGoal;
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
      whiteHighTotal: this.whiteHighTotal,
      whiteHighInGoal: this.whiteHighInGoal,
      blackHighTotal: this.blackHighTotal,
      blackHighInGoal: this.blackHighInGoal,
      blueHighTotal: this.whiteHighTotal,
      blueHighInGoal: this.whiteHighInGoal,
      greenHighTotal: this.blackHighTotal,
      greenHighInGoal: this.blackHighInGoal,
    });

    if (captured === WHITE_FO || captured === WHITE_O) {
      this.whiteHighTotal--;
      if (prevToFlags & FLAG_REACHED_GOAL) this.whiteHighInGoal--;
    } else if (captured === BLACK_FO || captured === BLACK_O) {
      this.blackHighTotal--;
      if (prevToFlags & FLAG_REACHED_GOAL) this.blackHighInGoal--;
    }

    this.squares[from] = EMPTY;
    this.flags[from] = 0;

    this.squares[to] = piece;

    const isWhite = piece <= 3;
    const baseRank = isWhite
      ? SCHADA_RULES_CONFIG.board.whiteBaseRankIndex
      : SCHADA_RULES_CONFIG.board.blackBaseRankIndex;
    const goalRank = isWhite
      ? SCHADA_RULES_CONFIG.board.whiteGoalRankIndex
      : SCHADA_RULES_CONFIG.board.blackGoalRankIndex;
    const destRow = Math.floor(to / 8);

    let nextFlags = prevFromFlags;
    if (destRow !== baseRank) {
      nextFlags |= FLAG_LEFT_BASE;
    }

    const isHighPiece = piece === WHITE_FO || piece === WHITE_O || piece === BLACK_FO || piece === BLACK_O;
    if (isHighPiece) {
      const wasInGoal = (prevFromFlags & FLAG_REACHED_GOAL) !== 0;
      const nowInGoal = destRow === goalRank;
      if (nowInGoal) {
        nextFlags |= FLAG_REACHED_GOAL;
        if (!wasInGoal) {
          if (isWhite) this.whiteHighInGoal++;
          else this.blackHighInGoal++;
        }
      }
    }

    this.flags[to] = nextFlags;
    this.currentTurn = this.currentTurn === 'white' ? 'black' : 'white';
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

    this.whiteHighTotal = record.whiteHighTotal;
    this.whiteHighInGoal = record.whiteHighInGoal;
    this.blackHighTotal = record.blackHighTotal;
    this.blackHighInGoal = record.blackHighInGoal;

    this.currentTurn = this.currentTurn === 'white' ? 'black' : 'white';
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
    const isWhite = color === 'white';
    const baseRank = isWhite
      ? SCHADA_RULES_CONFIG.board.whiteBaseRankIndex
      : SCHADA_RULES_CONFIG.board.blackBaseRankIndex;
    const goalRank = isWhite
      ? SCHADA_RULES_CONFIG.board.whiteGoalRankIndex
      : SCHADA_RULES_CONFIG.board.blackGoalRankIndex;
    const enemyGoalRank = isWhite
      ? SCHADA_RULES_CONFIG.board.blackGoalRankIndex
      : SCHADA_RULES_CONFIG.board.whiteGoalRankIndex;

    for (let from = 0; from < 64; from++) {
      const piece = this.squares[from];
      if (piece === EMPTY) continue;

      const pieceIsWhite = piece <= 3;
      if (pieceIsWhite !== isWhite) continue;

      const isHighPiece = piece === WHITE_FO || piece === WHITE_O || piece === BLACK_FO || piece === BLACK_O;
      const isFO = piece === WHITE_FO || piece === BLACK_FO;
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
          const occupantIsWhite = occupant <= 3;
          if (occupantIsWhite === isWhite) continue;

          // 2. High pieces in their goal line are IMMUNE to capture
          const occupantIsHigh = occupant === WHITE_FO || occupant === WHITE_O || occupant === BLACK_FO || occupant === BLACK_O;
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
            if (isFO && (stepOcc <= 3) === isWhite) {
              continue;
            }
            blocked = true;
            break;
          }
        }
        if (!blocked) {
          moves.push({
            from,
            to: dest,
            piece,
            captured: occupant,
            intermediate: path,
          });
        }
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
    const isAttackerWhite = attackerColor === 'white';
    const baseRank = isAttackerWhite
      ? SCHADA_RULES_CONFIG.board.whiteBaseRankIndex
      : SCHADA_RULES_CONFIG.board.blackBaseRankIndex;
    const goalRank = isAttackerWhite
      ? SCHADA_RULES_CONFIG.board.whiteGoalRankIndex
      : SCHADA_RULES_CONFIG.board.blackGoalRankIndex;
    const targetRow = Math.floor(targetIndex / 8);

    for (let from = 0; from < 64; from++) {
      const piece = this.squares[from];
      if (piece === EMPTY) continue;
      if ((piece <= 3) !== isAttackerWhite) continue;

      const isHighPiece = piece === WHITE_FO || piece === WHITE_O || piece === BLACK_FO || piece === BLACK_O;
      const isFO = piece === WHITE_FO || piece === BLACK_FO;
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
            if (isFO && (stepOcc <= 3) === isAttackerWhite) {
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
