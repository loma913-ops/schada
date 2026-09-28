import type { BoardMatrix, Move, PieceColor, Square } from '../schada/types';
import { getLegalMovesForSquare } from '../schada/engine';
import { BOT_ENGINE_CONFIG, BotConfigError } from './botConfig';

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
    cand('c1', 'c3', 30, "The Center Flow Opening: Western Vector"),
    cand('e1', 'e3', 30, "The Center Flow Opening: Eastern Vector"),
    cand('c2', 'd3', 10, "The Vanguard Flow System: Western Advance"),
    cand('e2', 'd3', 10, "The Vanguard Flow System: Eastern Screen"),
    cand('a1', 'a3', 10, "The Flank Flow Opening: Western Wing"),
    cand('g1', 'g3', 10, "The Flank Flow Opening: Eastern Wing"),
  ]),

  // Ply 1: Green response to Blue Move 1
  "c1-c3": Object.freeze([
    cand('d8', 'd6', 35, "The Symmetric Flow Defense: Center Outpost"),
    cand('f8', 'f6', 35, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('c7', 'e5', 15, "The Diagonal Screen Variation"),
    cand('f7', 'e6', 15, "The Central Anchor Defense"),
  ]),
  "e1-e3": Object.freeze([
    cand('f8', 'f6', 35, "The Symmetric Flow Defense: Center Outpost"),
    cand('d8', 'd6', 35, "The Cross-Flow Defense: Western Sentinel"),
    cand('c7', 'e5', 15, "The Diagonal Screen Variation"),
    cand('d7', 'e6', 15, "The Central Anchor Defense"),
  ]),
  "c2-d3": Object.freeze([
    cand('d8', 'd6', 40, "The Center Outpost Defense: Direct Control"),
    cand('f8', 'f6', 40, "The Flank Outpost Defense: Sentinel Variation"),
    cand('c7', 'e5', 20, "The Diagonal Screen Variation"),
  ]),
  "e2-d3": Object.freeze([
    cand('f8', 'f6', 40, "The Center Outpost Defense: Direct Control"),
    cand('d8', 'd6', 40, "The Flank Outpost Defense: Sentinel Variation"),
    cand('c7', 'e5', 20, "The Diagonal Screen Variation"),
  ]),
  "a1-a3": Object.freeze([
    cand('d8', 'd6', 40, "The Center Outpost Defense: Direct Control"),
    cand('f8', 'f6', 35, "The Flank Outpost Defense: Sentinel Variation"),
    cand('h8', 'h6', 25, "The Symmetric Wing Defense"),
  ]),
  "g1-g3": Object.freeze([
    cand('f8', 'f6', 40, "The Center Outpost Defense: Direct Control"),
    cand('d8', 'd6', 35, "The Cross-Flow Defense: Western Sentinel"),
    cand('b8', 'b6', 25, "The Symmetric Wing Defense"),
  ]),

  // Ply 2: Blue Move 2
  // Responses to c1-c3 lines:
  "c1-c3 d8-d6": Object.freeze([
    cand('e1', 'e3', 50, "The Twin Pillars Attack: Full Center Control"),
    cand('e2', 'd3', 25, "The Central Redoubt Formation"),
    cand('f2', 'd4', 25, "The Extended Flow Vector"),
  ]),
  "c1-c3 f8-f6": Object.freeze([
    cand('e1', 'e3', 50, "The Twin Pillars Attack: Full Center Control"),
    cand('e2', 'd3', 25, "The Central Redoubt Formation"),
    cand('f2', 'd4', 25, "The Extended Flow Vector"),
  ]),
  "c1-c3 c7-e5": Object.freeze([
    cand('e1', 'e3', 50, "The Twin Pillars Attack: Full Center Control"),
    cand('a1', 'a3', 25, "The Flank Corridor Variation"),
    cand('g1', 'g3', 25, "The Eastern Wing Thrust"),
  ]),
  "c1-c3 f7-e6": Object.freeze([
    cand('e1', 'e3', 50, "The Twin Pillars Attack: Full Center Control"),
    cand('a1', 'a3', 25, "The Flank Corridor Variation"),
    cand('g1', 'g3', 25, "The Eastern Wing Thrust"),
  ]),

  // Responses to e1-e3 lines:
  "e1-e3 f8-f6": Object.freeze([
    cand('c1', 'c3', 50, "The Twin Pillars Attack: Full Center Control"),
    cand('c2', 'd3', 25, "The Central Redoubt Formation"),
    cand('a1', 'a3', 25, "The Flank Corridor Variation"),
  ]),
  "e1-e3 d8-d6": Object.freeze([
    cand('c1', 'c3', 50, "The Twin Pillars Attack: Full Center Control"),
    cand('c2', 'd3', 25, "The Central Redoubt Formation"),
    cand('a1', 'a3', 25, "The Flank Corridor Variation"),
  ]),
  "e1-e3 c7-e5": Object.freeze([
    cand('c1', 'c3', 50, "The Twin Pillars Attack: Full Center Control"),
    cand('a1', 'a3', 25, "The Flank Corridor Variation"),
    cand('e3', 'c5', 25, "The Forward Incursion Vector"),
  ]),
  "e1-e3 d7-e6": Object.freeze([
    cand('c1', 'c3', 50, "The Twin Pillars Attack: Full Center Control"),
    cand('a1', 'a3', 25, "The Flank Corridor Variation"),
    cand('e3', 'c5', 25, "The Forward Incursion Vector"),
  ]),

  // Responses to c2-d3 lines:
  "c2-d3 d8-d6": Object.freeze([
    cand('e1', 'e3', 50, "The Twin Pillars Attack: Full Center Control"),
    cand('c1', 'c3', 30, "The Center Flow Opening: Western Vector"),
    cand('a1', 'a3', 20, "The Flank Corridor Variation"),
  ]),
  "c2-d3 f8-f6": Object.freeze([
    cand('e1', 'e3', 50, "The Twin Pillars Attack: Full Center Control"),
    cand('c1', 'c3', 30, "The Center Flow Opening: Western Vector"),
    cand('a1', 'a3', 20, "The Flank Corridor Variation"),
  ]),
  "c2-d3 c7-e5": Object.freeze([
    cand('e1', 'e3', 50, "The Twin Pillars Attack: Full Center Control"),
    cand('c1', 'c3', 30, "The Center Flow Opening: Western Vector"),
    cand('a1', 'a3', 20, "The Flank Corridor Variation"),
  ]),

  // Responses to e2-d3 lines:
  "e2-d3 f8-f6": Object.freeze([
    cand('e1', 'e3', 40, "The Center Flow Opening: Eastern Vector"),
    cand('c1', 'c3', 40, "The Twin Pillars Attack: Full Center Control"),
    cand('a1', 'a3', 20, "The Flank Corridor Variation"),
  ]),
  "e2-d3 d8-d6": Object.freeze([
    cand('e1', 'e3', 40, "The Center Flow Opening: Eastern Vector"),
    cand('c1', 'c3', 40, "The Twin Pillars Attack: Full Center Control"),
    cand('a1', 'a3', 20, "The Flank Corridor Variation"),
  ]),
  "e2-d3 c7-e5": Object.freeze([
    cand('e1', 'e3', 40, "The Center Flow Opening: Eastern Vector"),
    cand('c1', 'c3', 40, "The Twin Pillars Attack: Full Center Control"),
    cand('a1', 'a3', 20, "The Flank Corridor Variation"),
  ]),

  // Responses to a1-a3 lines:
  "a1-a3 d8-d6": Object.freeze([
    cand('c1', 'c3', 50, "The Center Flow Opening: Western Vector"),
    cand('e1', 'e3', 30, "The Center Flow Opening: Eastern Vector"),
    cand('c2', 'd3', 20, "The Vanguard Flow System: Western Advance"),
  ]),
  "a1-a3 f8-f6": Object.freeze([
    cand('c1', 'c3', 50, "The Center Flow Opening: Western Vector"),
    cand('e1', 'e3', 30, "The Center Flow Opening: Eastern Vector"),
    cand('e2', 'd3', 20, "The Vanguard Flow System: Eastern Screen"),
  ]),
  "a1-a3 h8-h6": Object.freeze([
    cand('c1', 'c3', 50, "The Center Flow Opening: Western Vector"),
    cand('e1', 'e3', 50, "The Center Flow Opening: Eastern Vector"),
  ]),

  // Responses to g1-g3 lines:
  "g1-g3 f8-f6": Object.freeze([
    cand('e1', 'e3', 50, "The Center Flow Opening: Eastern Vector"),
    cand('c1', 'c3', 30, "The Center Flow Opening: Western Vector"),
    cand('e2', 'd3', 20, "The Vanguard Flow System: Eastern Screen"),
  ]),
  "g1-g3 d8-d6": Object.freeze([
    cand('e1', 'e3', 50, "The Center Flow Opening: Eastern Vector"),
    cand('c1', 'c3', 30, "The Center Flow Opening: Western Vector"),
    cand('c2', 'd3', 20, "The Vanguard Flow System: Western Advance"),
  ]),
  "g1-g3 b8-b6": Object.freeze([
    cand('c1', 'c3', 50, "The Center Flow Opening: Western Vector"),
    cand('e1', 'e3', 50, "The Center Flow Opening: Eastern Vector"),
  ]),

  // Ply 3: Green Move 2
  // Responses to c1-c3 d8-d6 ...
  "c1-c3 d8-d6 e1-e3": Object.freeze([
    cand('f8', 'f6', 50, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 25, "The Wing Outpost Variation"),
    cand('f7', 'e6', 25, "The Redoubt Screen Formation"),
  ]),
  "c1-c3 d8-d6 e2-d3": Object.freeze([
    cand('f8', 'f6', 50, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 30, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('d6', 'f4', 20, "The Central Pivot Vector"),
  ]),
  "c1-c3 d8-d6 f2-d4": Object.freeze([
    cand('f8', 'f6', 50, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 30, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('d6', 'f4', 20, "The Central Pivot Vector"),
  ]),

  // Responses to c1-c3 f8-f6 ...
  "c1-c3 f8-f6 e1-e3": Object.freeze([
    cand('d8', 'd6', 50, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 25, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 25, "The Wing Outpost Variation"),
  ]),
  "c1-c3 f8-f6 e2-d3": Object.freeze([
    cand('d8', 'd6', 50, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 30, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 20, "The Wing Outpost Variation"),
  ]),
  "c1-c3 f8-f6 f2-d4": Object.freeze([
    cand('d8', 'd6', 50, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 30, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 20, "The Wing Outpost Variation"),
  ]),

  // Responses to c1-c3 c7-e5 ...
  "c1-c3 c7-e5 e1-e3": Object.freeze([
    cand('f8', 'f6', 50, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('d8', 'd6', 30, "The Cross-Flow Defense: Western Sentinel"),
    cand('b8', 'b6', 20, "The Wing Outpost Variation"),
  ]),
  "c1-c3 c7-e5 a1-a3": Object.freeze([
    cand('d8', 'd6', 50, "The Center Outpost Defense: Direct Control"),
    cand('f8', 'f6', 30, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('h8', 'h6', 20, "The Symmetric Wing Defense"),
  ]),
  "c1-c3 c7-e5 g1-g3": Object.freeze([
    cand('f8', 'f6', 50, "The Center Outpost Defense: Direct Control"),
    cand('d8', 'd6', 30, "The Cross-Flow Defense: Western Sentinel"),
    cand('b8', 'b6', 20, "The Symmetric Wing Defense"),
  ]),

  // Responses to c1-c3 f7-e6 ...
  "c1-c3 f7-e6 e1-e3": Object.freeze([
    cand('d8', 'd6', 50, "The Center Outpost Defense: Direct Control"),
    cand('f8', 'f6', 30, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 20, "The Wing Outpost Variation"),
  ]),
  "c1-c3 f7-e6 a1-a3": Object.freeze([
    cand('d8', 'd6', 50, "The Center Outpost Defense: Direct Control"),
    cand('f8', 'f6', 30, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('h8', 'h6', 20, "The Symmetric Wing Defense"),
  ]),
  "c1-c3 f7-e6 g1-g3": Object.freeze([
    cand('f8', 'f6', 50, "The Center Outpost Defense: Direct Control"),
    cand('d8', 'd6', 30, "The Cross-Flow Defense: Western Sentinel"),
    cand('b8', 'b6', 20, "The Symmetric Wing Defense"),
  ]),

  // Responses to e1-e3 f8-f6 ...
  "e1-e3 f8-f6 c1-c3": Object.freeze([
    cand('d8', 'd6', 50, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 25, "The Wing Outpost Variation"),
    cand('c7', 'e5', 25, "The Diagonal Screen Counter-Thrust"),
  ]),
  "e1-e3 f8-f6 c2-d3": Object.freeze([
    cand('d8', 'd6', 50, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 30, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 20, "The Wing Outpost Variation"),
  ]),
  "e1-e3 f8-f6 a1-a3": Object.freeze([
    cand('d8', 'd6', 50, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 30, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 20, "The Wing Outpost Variation"),
  ]),

  // Responses to e1-e3 d8-d6 ...
  "e1-e3 d8-d6 c1-c3": Object.freeze([
    cand('f8', 'f6', 50, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 30, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('d6', 'f4', 20, "The Central Pivot Vector"),
  ]),
  "e1-e3 d8-d6 c2-d3": Object.freeze([
    cand('f8', 'f6', 50, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 30, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('d6', 'f4', 20, "The Central Pivot Vector"),
  ]),
  "e1-e3 d8-d6 a1-a3": Object.freeze([
    cand('f8', 'f6', 50, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 30, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('d6', 'f4', 20, "The Central Pivot Vector"),
  ]),

  // Responses to e1-e3 c7-e5 ...
  "e1-e3 c7-e5 c1-c3": Object.freeze([
    cand('d8', 'd6', 50, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('f8', 'f6', 30, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 20, "The Wing Outpost Variation"),
  ]),
  "e1-e3 c7-e5 a1-a3": Object.freeze([
    cand('d8', 'd6', 50, "The Center Outpost Defense: Direct Control"),
    cand('f8', 'f6', 30, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('h8', 'h6', 20, "The Symmetric Wing Defense"),
  ]),
  "e1-e3 c7-e5 e3-c5": Object.freeze([
    cand('d8', 'd6', 50, "The Center Outpost Defense: Direct Control"),
    cand('f8', 'f6', 30, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 20, "The Wing Outpost Variation"),
  ]),

  // Responses to e1-e3 d7-e6 ...
  "e1-e3 d7-e6 c1-c3": Object.freeze([
    cand('f8', 'f6', 50, "The Center Outpost Defense: Direct Control"),
    cand('d8', 'd6', 30, "The Cross-Flow Defense: Western Sentinel"),
    cand('h8', 'h6', 20, "The Symmetric Wing Defense"),
  ]),
  "e1-e3 d7-e6 a1-a3": Object.freeze([
    cand('f8', 'f6', 50, "The Center Outpost Defense: Direct Control"),
    cand('d8', 'd6', 30, "The Cross-Flow Defense: Western Sentinel"),
    cand('h8', 'h6', 20, "The Symmetric Wing Defense"),
  ]),
  "e1-e3 d7-e6 e3-c5": Object.freeze([
    cand('f8', 'f6', 50, "The Center Outpost Defense: Direct Control"),
    cand('d8', 'd6', 30, "The Cross-Flow Defense: Western Sentinel"),
    cand('h8', 'h6', 20, "The Symmetric Wing Defense"),
  ]),

  // Responses to c2-d3 d8-d6 ...
  "c2-d3 d8-d6 e1-e3": Object.freeze([
    cand('f8', 'f6', 50, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 25, "The Wing Outpost Variation"),
    cand('f7', 'e6', 25, "The Redoubt Screen Formation"),
  ]),
  "c2-d3 d8-d6 c1-c3": Object.freeze([
    cand('f8', 'f6', 50, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 30, "The Wing Outpost Variation"),
    cand('h8', 'h6', 20, "The Flank Outpost Defense: Eastern Sentinel"),
  ]),
  "c2-d3 d8-d6 a1-a3": Object.freeze([
    cand('f8', 'f6', 50, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 30, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 20, "The Wing Outpost Variation"),
  ]),

  // Responses to c2-d3 f8-f6 ...
  "c2-d3 f8-f6 e1-e3": Object.freeze([
    cand('d8', 'd6', 50, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 25, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 25, "The Wing Outpost Variation"),
  ]),
  "c2-d3 f8-f6 c1-c3": Object.freeze([
    cand('d8', 'd6', 50, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 30, "The Wing Outpost Variation"),
    cand('h8', 'h6', 20, "The Flank Outpost Defense: Eastern Sentinel"),
  ]),
  "c2-d3 f8-f6 a1-a3": Object.freeze([
    cand('d8', 'd6', 50, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 30, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 20, "The Wing Outpost Variation"),
  ]),

  // Responses to c2-d3 c7-e5 ...
  "c2-d3 c7-e5 e1-e3": Object.freeze([
    cand('f8', 'f6', 50, "The Center Outpost Defense: Direct Control"),
    cand('d8', 'd6', 30, "The Cross-Flow Defense: Western Sentinel"),
    cand('b8', 'b6', 20, "The Wing Outpost Variation"),
  ]),
  "c2-d3 c7-e5 c1-c3": Object.freeze([
    cand('d8', 'd6', 50, "The Center Outpost Defense: Direct Control"),
    cand('f8', 'f6', 30, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('h8', 'h6', 20, "The Symmetric Wing Defense"),
  ]),
  "c2-d3 c7-e5 a1-a3": Object.freeze([
    cand('d8', 'd6', 50, "The Center Outpost Defense: Direct Control"),
    cand('f8', 'f6', 30, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('h8', 'h6', 20, "The Symmetric Wing Defense"),
  ]),

  // Responses to e2-d3 f8-f6 ...
  "e2-d3 f8-f6 e1-e3": Object.freeze([
    cand('d8', 'd6', 50, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 30, "The Wing Outpost Variation"),
    cand('h8', 'h6', 20, "The Flank Outpost Defense: Eastern Sentinel"),
  ]),
  "e2-d3 f8-f6 c1-c3": Object.freeze([
    cand('d8', 'd6', 50, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 30, "The Wing Outpost Variation"),
    cand('h8', 'h6', 20, "The Flank Outpost Defense: Eastern Sentinel"),
  ]),
  "e2-d3 f8-f6 a1-a3": Object.freeze([
    cand('d8', 'd6', 50, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 30, "The Wing Outpost Variation"),
    cand('h8', 'h6', 20, "The Flank Outpost Defense: Eastern Sentinel"),
  ]),

  // Responses to e2-d3 d8-d6 ...
  "e2-d3 d8-d6 e1-e3": Object.freeze([
    cand('f8', 'f6', 50, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 30, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 20, "The Wing Outpost Variation"),
  ]),
  "e2-d3 d8-d6 c1-c3": Object.freeze([
    cand('f8', 'f6', 50, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 30, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 20, "The Wing Outpost Variation"),
  ]),
  "e2-d3 d8-d6 a1-a3": Object.freeze([
    cand('f8', 'f6', 50, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 30, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 20, "The Wing Outpost Variation"),
  ]),

  // Responses to e2-d3 c7-e5 ...
  "e2-d3 c7-e5 e1-e3": Object.freeze([
    cand('f8', 'f6', 50, "The Center Outpost Defense: Direct Control"),
    cand('d8', 'd6', 30, "The Cross-Flow Defense: Western Sentinel"),
    cand('b8', 'b6', 20, "The Wing Outpost Variation"),
  ]),
  "e2-d3 c7-e5 c1-c3": Object.freeze([
    cand('d8', 'd6', 50, "The Center Outpost Defense: Direct Control"),
    cand('f8', 'f6', 30, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('h8', 'h6', 20, "The Symmetric Wing Defense"),
  ]),
  "e2-d3 c7-e5 a1-a3": Object.freeze([
    cand('d8', 'd6', 50, "The Center Outpost Defense: Direct Control"),
    cand('f8', 'f6', 30, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('h8', 'h6', 20, "The Symmetric Wing Defense"),
  ]),

  // Responses to a1-a3 d8-d6 ...
  "a1-a3 d8-d6 c1-c3": Object.freeze([
    cand('f8', 'f6', 50, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 30, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 20, "The Wing Outpost Variation"),
  ]),
  "a1-a3 d8-d6 e1-e3": Object.freeze([
    cand('f8', 'f6', 50, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 30, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 20, "The Wing Outpost Variation"),
  ]),
  "a1-a3 d8-d6 c2-d3": Object.freeze([
    cand('f8', 'f6', 50, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 30, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 20, "The Wing Outpost Variation"),
  ]),

  // Responses to a1-a3 f8-f6 ...
  "a1-a3 f8-f6 c1-c3": Object.freeze([
    cand('d8', 'd6', 50, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 30, "The Wing Outpost Variation"),
    cand('h8', 'h6', 20, "The Flank Outpost Defense: Eastern Sentinel"),
  ]),
  "a1-a3 f8-f6 e1-e3": Object.freeze([
    cand('d8', 'd6', 50, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 30, "The Wing Outpost Variation"),
    cand('h8', 'h6', 20, "The Flank Outpost Defense: Eastern Sentinel"),
  ]),
  "a1-a3 f8-f6 e2-d3": Object.freeze([
    cand('d8', 'd6', 50, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 30, "The Wing Outpost Variation"),
    cand('h8', 'h6', 20, "The Flank Outpost Defense: Eastern Sentinel"),
  ]),

  // Responses to a1-a3 h8-h6 ...
  "a1-a3 h8-h6 c1-c3": Object.freeze([
    cand('d8', 'd6', 50, "The Center Outpost Defense: Direct Control"),
    cand('f8', 'f6', 30, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 20, "The Wing Outpost Variation"),
  ]),
  "a1-a3 h8-h6 e1-e3": Object.freeze([
    cand('f8', 'f6', 50, "The Center Outpost Defense: Direct Control"),
    cand('d8', 'd6', 30, "The Cross-Flow Defense: Western Sentinel"),
    cand('b8', 'b6', 20, "The Wing Outpost Variation"),
  ]),

  // Responses to g1-g3 f8-f6 ...
  "g1-g3 f8-f6 e1-e3": Object.freeze([
    cand('d8', 'd6', 50, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 30, "The Wing Outpost Variation"),
    cand('h8', 'h6', 20, "The Flank Outpost Defense: Eastern Sentinel"),
  ]),
  "g1-g3 f8-f6 c1-c3": Object.freeze([
    cand('d8', 'd6', 50, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 30, "The Wing Outpost Variation"),
    cand('h8', 'h6', 20, "The Flank Outpost Defense: Eastern Sentinel"),
  ]),
  "g1-g3 f8-f6 e2-d3": Object.freeze([
    cand('d8', 'd6', 50, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 30, "The Wing Outpost Variation"),
    cand('h8', 'h6', 20, "The Flank Outpost Defense: Eastern Sentinel"),
  ]),

  // Responses to g1-g3 d8-d6 ...
  "g1-g3 d8-d6 e1-e3": Object.freeze([
    cand('f8', 'f6', 50, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 30, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 20, "The Wing Outpost Variation"),
  ]),
  "g1-g3 d8-d6 c1-c3": Object.freeze([
    cand('f8', 'f6', 50, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 30, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 20, "The Wing Outpost Variation"),
  ]),
  "g1-g3 d8-d6 c2-d3": Object.freeze([
    cand('f8', 'f6', 50, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 30, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 20, "The Wing Outpost Variation"),
  ]),

  // Responses to g1-g3 b8-b6 ...
  "g1-g3 b8-b6 c1-c3": Object.freeze([
    cand('d8', 'd6', 50, "The Center Outpost Defense: Direct Control"),
    cand('f8', 'f6', 30, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('h8', 'h6', 20, "The Symmetric Wing Defense"),
  ]),
  "g1-g3 b8-b6 e1-e3": Object.freeze([
    cand('f8', 'f6', 50, "The Center Outpost Defense: Direct Control"),
    cand('d8', 'd6', 30, "The Cross-Flow Defense: Western Sentinel"),
    cand('h8', 'h6', 20, "The Symmetric Wing Defense"),
  ]),
});

export function buildMoveSequenceKey(moveHistory?: Move[]): string {
  if (!moveHistory || moveHistory.length === 0) return "";
  return moveHistory.map((m) => `${m.from}-${m.to}`).join(' ');
}

/**
 * Validates the Opening Book catalog.
 * Throws BotConfigError if the catalog is null, contains invalid moves, or malformed entries.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(K * C) where K is number of positions and C is candidates per position = O(1) static catalog.
 * - Auxiliary Space Complexity: O(1).
 *
 * Growth Rate:
 * - O(K) linear with book catalog size.
 */
export function validateOpeningBook(book: Record<string, readonly OpeningMoveCandidate[]>): void {
  if (!book || typeof book !== 'object') {
    throw new BotConfigError('Opening book catalog is missing or null.');
  }

  for (const [key, candidates] of Object.entries(book)) {
    if (!Array.isArray(candidates) || candidates.length === 0) {
      throw new BotConfigError(`Opening book position "${key}" contains no move candidates.`);
    }

    for (const candidate of candidates) {
      if (!candidate.from || typeof candidate.from !== 'string' || candidate.from.length !== 2) {
        throw new BotConfigError(`Candidate in position "${key}" has invalid from square: ${String(candidate.from)}.`);
      }
      if (!candidate.to || typeof candidate.to !== 'string' || candidate.to.length !== 2) {
        throw new BotConfigError(`Candidate in position "${key}" has invalid to square: ${String(candidate.to)}.`);
      }
      if (typeof candidate.weight !== 'number' || !Number.isFinite(candidate.weight) || candidate.weight <= 0) {
        throw new BotConfigError(
          `Candidate ${candidate.from}-${candidate.to} in position "${key}" must have a strictly positive weight, received ${String(candidate.weight)}.`
        );
      }
      if (!candidate.lineName || typeof candidate.lineName !== 'string' || candidate.lineName.trim().length === 0) {
        throw new BotConfigError(
          `Candidate ${candidate.from}-${candidate.to} in position "${key}" must have a non-empty lineName.`
        );
      }
    }
  }
}

// Self-validate canonical OPENING_BOOK catalog at module initialization
validateOpeningBook(OPENING_BOOK);

/**
 * Checks if the specified tier should consult the opening book.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1).
 * - Auxiliary Space Complexity: O(1).
 */
export function shouldTierUseOpeningBook(
  level: number = BOT_ENGINE_CONFIG.defaultLevel,
  moveHistory?: Move[]
): boolean {
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
  level: number = BOT_ENGINE_CONFIG.defaultLevel,
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
  if (totalWeight <= 0) {
    return null;
  }

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
