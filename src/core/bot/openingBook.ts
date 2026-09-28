import type { BoardMatrix, Move, PieceColor, Square } from '../schada/types';
import { getLegalMovesForSquare } from '../schada/engine';
import { BOT_ENGINE_CONFIG } from './botConfig';

export interface OpeningMoveCandidate {
  readonly from: Square;
  readonly to: Square;
  readonly weight: number;
  readonly lineName: string;
}

const cand = (from: Square, to: Square, weight: number, lineName: string): OpeningMoveCandidate => ({
  from,
  to,
  weight,
  lineName,
});

/**
 * Precomputed Schada opening book based on Jan Boogerd's 1939 Handleiding
 * and optimal central flow network principles.
 *
 * Keys represent the canonical sequence of moves played:
 * e.g. "" (Turn 1 Blue), "c1-c3" (Turn 1 Green response), etc.
 */
export const OPENING_BOOK: Readonly<Record<string, readonly OpeningMoveCandidate[]>> = Object.freeze({
  // Ply 0: Initial Board (Blue Move 1)
  "": Object.freeze([
    cand('c1', 'c3', 35, "Boogerd Central Thrust (c1 FO Leap)"),
    cand('e1', 'e3', 35, "Boogerd Central Thrust (e1 FO Leap)"),
    cand('c2', 'd3', 15, "Central Pawn Vanguard"),
    cand('e2', 'd3', 15, "King's Pawn Shield"),
  ]),

  // Ply 1: Green response to Blue c1-c3
  "c1-c3": Object.freeze([
    cand('d8', 'd6', 35, "Central Counter-Leap (d8 FO Leap)"),
    cand('f8', 'f6', 35, "Flank Counter-Leap (f8 FO Leap)"),
    cand('c7', 'e5', 15, "Diagonal Springboard Advance"),
    cand('f7', 'e6', 15, "Central Pawn Anchor"),
  ]),

  // Ply 1: Green response to Blue e1-e3
  "e1-e3": Object.freeze([
    cand('f8', 'f6', 35, "Symmetric Counter-Leap (f8 FO Leap)"),
    cand('d8', 'd6', 35, "Cross-Center Counter-Leap (d8 FO Leap)"),
    cand('c7', 'e5', 15, "Diagonal Springboard Advance"),
    cand('d7', 'e6', 15, "Central Pawn Anchor"),
  ]),

  // Ply 1: Green response to Blue c2-d3
  "c2-d3": Object.freeze([
    cand('d8', 'd6', 40, "Immediate Center Occupation"),
    cand('f8', 'f6', 40, "Flank Sentinel Leap"),
    cand('c7', 'e5', 20, "Diagonal Springboard Advance"),
  ]),

  // Ply 1: Green response to Blue e2-d3
  "e2-d3": Object.freeze([
    cand('f8', 'f6', 40, "Immediate Center Occupation"),
    cand('d8', 'd6', 40, "Flank Sentinel Leap"),
    cand('c7', 'e5', 20, "Diagonal Springboard Advance"),
  ]),

  // Ply 2: Blue Move 2 after c1-c3 d8-d6
  "c1-c3 d8-d6": Object.freeze([
    cand('e1', 'e3', 50, "Twin Field Officer Center"),
    cand('e2', 'd3', 25, "Central Pawn Blockade"),
    cand('f2', 'd4', 25, "Extended Flow Advance"),
  ]),

  // Ply 2: Blue Move 2 after c1-c3 f8-f6
  "c1-c3 f8-f6": Object.freeze([
    cand('e1', 'e3', 50, "Twin Field Officer Center"),
    cand('e2', 'd3', 25, "Central Pawn Blockade"),
    cand('f2', 'd4', 25, "Extended Flow Advance"),
  ]),

  // Ply 2: Blue Move 2 after e1-e3 f8-f6
  "e1-e3 f8-f6": Object.freeze([
    cand('c1', 'c3', 50, "Twin Field Officer Center"),
    cand('c2', 'd3', 25, "Central Pawn Blockade"),
    cand('a1', 'a3', 25, "Flank Wing Leap"),
  ]),

  // Ply 2: Blue Move 2 after e1-e3 d8-d6
  "e1-e3 d8-d6": Object.freeze([
    cand('c1', 'c3', 50, "Twin Field Officer Center"),
    cand('c2', 'd3', 25, "Central Pawn Blockade"),
    cand('a1', 'a3', 25, "Flank Wing Leap"),
  ]),

  // Ply 3: Green Move 2 after c1-c3 d8-d6 e1-e3
  "c1-c3 d8-d6 e1-e3": Object.freeze([
    cand('f8', 'f6', 50, "Twin Field Officer Center"),
    cand('b8', 'b6', 25, "Wing Flank Leap"),
    cand('f7', 'e6', 25, "Central Defense Screen"),
  ]),

  // Ply 3: Green Move 2 after e1-e3 f8-f6 c1-c3
  "e1-e3 f8-f6 c1-c3": Object.freeze([
    cand('d8', 'd6', 50, "Twin Field Officer Center"),
    cand('b8', 'b6', 25, "Wing Flank Leap"),
    cand('c7', 'e5', 25, "Diagonal Springboard Advance"),
  ]),
});

export function buildMoveSequenceKey(moveHistory?: Move[]): string {
  if (!moveHistory || moveHistory.length === 0) return "";
  return moveHistory.map((m) => `${m.from}-${m.to}`).join(' ');
}

/**
 * Checks if the specified tier should consult the opening book.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1).
 * - Auxiliary Space Complexity: O(1).
 */
export function shouldTierUseOpeningBook(level: number, moveHistory?: Move[]): boolean {
  const config = BOT_ENGINE_CONFIG.openingBook;
  if (!config.enabled) return false;

  const currentPly = moveHistory ? moveHistory.length : 0;
  if (currentPly >= config.maxPlies) return false;

  if (level < config.minTier) {
    // Level 1 bypasses opening book
    return false;
  }

  if (level === 2) {
    // Level 2 has 30% chance to deviate / blunder in opening
    return Math.random() < config.tier2BookProbability;
  }

  // Levels 3–8 use opening book
  return true;
}

/**
 * Retrieves a vetted opening book candidate for the current board position.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) dictionary key lookup + O(1) legal move validation.
 * - Auxiliary Space Complexity: O(1).
 *
 * Growth Rate:
 * - O(1) constant time, eliminating search tree overhead during opening plies.
 */
export function getOpeningBookMove(
  board: BoardMatrix,
  color: PieceColor,
  level: number,
  moveHistory?: Move[]
): Move | null {
  if (!shouldTierUseOpeningBook(level, moveHistory)) {
    return null;
  }

  const key = buildMoveSequenceKey(moveHistory);
  const candidates = OPENING_BOOK[key];
  if (!candidates || candidates.length === 0) {
    return null;
  }

  // Weighted random selection among candidates
  const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
  let randomChoice = Math.random() * totalWeight;
  let selectedCandidate = candidates[0];

  for (const candidate of candidates) {
    if (randomChoice < candidate.weight) {
      selectedCandidate = candidate;
      break;
    }
    randomChoice -= candidate.weight;
  }

  // Validate legality on current board state
  const legalMovesFromSquare = getLegalMovesForSquare(board, selectedCandidate.from);
  const matchingMove = legalMovesFromSquare.find(
    (m) => m.to === selectedCandidate.to && m.piece.color === color
  );

  return matchingMove || null;
}
