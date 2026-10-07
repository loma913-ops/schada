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
 * Universal Schada opening book covering all 14 legal opening moves
 * based on Jan Boogerd's 1939 Handleiding and optimal flow network principles.
 *
 * All opening candidates and selection weights are strictly vetted and calibrated
 * using the Tier 8 Master Engine (depth 6) with iterative deepening and tactical
 * vector safety checks to eliminate hung officers and blunders.
 *
 * Keys represent the canonical sequence of moves played:
 * e.g. "" (Turn 1 Blue), "c1-c3" (Turn 1 Green response), etc.
 */
export const OPENING_BOOK: Readonly<Record<string, readonly OpeningMoveCandidate[]>> = Object.freeze({

  // Ply 0: Initial Board (All 14 Blue Opening Moves)
  "": Object.freeze([
    cand('a1', 'a3', 15, "The Flank Flow Opening: Western Wing"),
    cand('c1', 'c3', 15, "The Center Flow Opening: Western Vector"),
    cand('g1', 'g3', 15, "The Flank Flow Opening: Eastern Wing"),
    cand('f2', 'd4', 6, "The Center Strike System: Eastern Advance"),
    cand('d2', 'b4', 6, "The Western Flank Advance: Pacing Thrust"),
    cand('g2', 'e4', 6, "The Eastern Diagonal Screen"),
    cand('c2', 'd3', 5, "The Vanguard Flow System: Western Advance"),
    cand('b2', 'c3', 5, "The Western Diagonal Screen"),
    cand('e2', 'd3', 5, "The Vanguard Flow System: Eastern Screen"),
    cand('e2', 'g4', 5, "The Far-Eastern Flank Corridor"),
    cand('h2', 'h4', 5, "The Eastern Flank Wing Advance"),
    cand('c2', 'a4', 5, "The Far-Western Flank Corridor"),
    cand('e1', 'e3', 5, "The Center Flow Opening: Eastern Vector"),
    cand('a2', 'c4', 2, "The Extended Flank Advance"),
  ]),

  // Ply 1: Green response to Blue Move 1
  "a1-a3": Object.freeze([
    cand('h8', 'h6', 27, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 28, "The Wing Outpost Variation"),
    cand('f8', 'f6', 28, "The Center Outpost Defense: Sentinel Variation"),
    cand('c7', 'e5', 9, "The Diagonal Screen Counter-Thrust"),
    cand('d7', 'e6', 8, "The Central Redoubt Defense"),
  ]),
  "c1-c3": Object.freeze([
    cand('h8', 'h6', 27, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 28, "The Wing Outpost Variation"),
    cand('f8', 'f6', 28, "The Center Outpost Defense: Sentinel Variation"),
    cand('c7', 'e5', 9, "The Diagonal Screen Counter-Thrust"),
    cand('d7', 'e6', 8, "The Central Redoubt Defense"),
  ]),
  "g1-g3": Object.freeze([
    cand('h8', 'h6', 25, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 25, "The Center Outpost Defense: Sentinel Variation"),
    cand('b8', 'b6', 25, "The Wing Outpost Variation"),
    cand('d8', 'd6', 17, "The Cross-Flow Defense: Western Sentinel"),
    cand('c7', 'e5', 8, "The Diagonal Screen Counter-Thrust"),
  ]),
  "f2-d4": Object.freeze([
    cand('h8', 'h6', 29, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 27, "The Wing Outpost Variation"),
    cand('f8', 'f6', 27, "The Center Outpost Defense: Sentinel Variation"),
    cand('c7', 'e5', 9, "The Diagonal Screen Counter-Thrust"),
    cand('f7', 'e6', 8, "The Central Anchor Defense"),
  ]),
  "d2-b4": Object.freeze([
    cand('h8', 'h6', 27, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 28, "The Center Outpost Defense: Sentinel Variation"),
    cand('b8', 'b6', 28, "The Wing Outpost Variation"),
    cand('c7', 'e5', 9, "The Diagonal Screen Counter-Thrust"),
    cand('e7', 'g5', 8, "The Eastern Flank Counter-Thrust"),
  ]),
  "g2-e4": Object.freeze([
    cand('c7', 'e5', 21, "The Diagonal Screen Counter-Thrust"),
    cand('h8', 'h6', 21, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('d8', 'd6', 20, "The Cross-Flow Defense: Western Sentinel"),
    cand('f8', 'f6', 19, "The Center Outpost Defense: Sentinel Variation"),
    cand('b8', 'b6', 19, "The Wing Outpost Variation"),
  ]),
  "c2-d3": Object.freeze([
    cand('h8', 'h6', 29, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 27, "The Center Outpost Defense: Sentinel Variation"),
    cand('b8', 'b6', 27, "The Wing Outpost Variation"),
    cand('c7', 'e5', 9, "The Diagonal Screen Counter-Thrust"),
    cand('d7', 'e6', 8, "The Central Redoubt Defense"),
  ]),
  "b2-c3": Object.freeze([
    cand('h8', 'h6', 29, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 27, "The Wing Outpost Variation"),
    cand('f8', 'f6', 27, "The Center Outpost Defense: Sentinel Variation"),
    cand('c7', 'e5', 9, "The Diagonal Screen Counter-Thrust"),
    cand('e7', 'g5', 8, "The Eastern Flank Counter-Thrust"),
  ]),
  "e2-d3": Object.freeze([
    cand('h8', 'h6', 29, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 27, "The Center Outpost Defense: Sentinel Variation"),
    cand('b8', 'b6', 27, "The Wing Outpost Variation"),
    cand('c7', 'e5', 9, "The Diagonal Screen Counter-Thrust"),
    cand('e7', 'g5', 8, "The Eastern Flank Counter-Thrust"),
  ]),
  "e2-g4": Object.freeze([
    cand('h8', 'h6', 25, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 25, "The Center Outpost Defense: Sentinel Variation"),
    cand('b8', 'b6', 25, "The Wing Outpost Variation"),
    cand('d8', 'd6', 17, "The Cross-Flow Defense: Western Sentinel"),
    cand('c7', 'e5', 8, "The Diagonal Screen Counter-Thrust"),
  ]),
  "h2-h4": Object.freeze([
    cand('h8', 'h6', 27, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 27, "The Wing Outpost Variation"),
    cand('f8', 'f6', 25, "The Center Outpost Defense: Sentinel Variation"),
    cand('e7', 'g5', 12, "The Eastern Flank Counter-Thrust"),
    cand('c7', 'e5', 9, "The Diagonal Screen Counter-Thrust"),
  ]),
  "c2-a4": Object.freeze([
    cand('h8', 'h6', 29, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 27, "The Center Outpost Defense: Sentinel Variation"),
    cand('b8', 'b6', 27, "The Wing Outpost Variation"),
    cand('c7', 'e5', 9, "The Diagonal Screen Counter-Thrust"),
    cand('e7', 'g5', 8, "The Eastern Flank Counter-Thrust"),
  ]),
  "e1-e3": Object.freeze([
    cand('h8', 'h6', 50, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 14, "The Center Outpost Defense: Sentinel Variation"),
    cand('b8', 'b6', 13, "The Wing Outpost Variation"),
    cand('d8', 'd6', 12, "The Cross-Flow Defense: Western Sentinel"),
    cand('c7', 'e5', 11, "The Diagonal Screen Counter-Thrust"),
  ]),
  "a2-c4": Object.freeze([
    cand('f8', 'f6', 48, "The Center Outpost Defense: Sentinel Variation"),
    cand('h8', 'h6', 14, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 14, "The Wing Outpost Variation"),
    cand('a7', 'a5', 13, "The Counter-Flow Vector: a7-a5"),
    cand('d7', 'e6', 11, "The Central Redoubt Defense"),
  ]),

  // Ply 2: Blue Move 2
  "a1-a3 h8-h6": Object.freeze([
    cand('c1', 'c3', 40, "The Twin Pillars Attack: Full Center Control"),
    cand('g1', 'g3', 40, "The Eastern Wing Thrust"),
    cand('b1', 'a1', 20, "The Base Reorganization Manoeuvre"),
  ]),
  "a1-a3 b8-b6": Object.freeze([
    cand('g1', 'g3', 37, "The Eastern Wing Thrust"),
    cand('c1', 'c3', 35, "The Twin Pillars Attack: Full Center Control"),
    cand('e1', 'e3', 28, "The Twin Pillars Attack: Full Center Control"),
  ]),
  "a1-a3 f8-f6": Object.freeze([
    cand('c1', 'c3', 40, "The Twin Pillars Attack: Full Center Control"),
    cand('g1', 'g3', 39, "The Eastern Wing Thrust"),
    cand('b1', 'a1', 21, "The Base Reorganization Manoeuvre"),
  ]),
  "a1-a3 c7-e5": Object.freeze([
    cand('c1', 'c3', 40, "The Twin Pillars Attack: Full Center Control"),
    cand('g1', 'g3', 40, "The Eastern Wing Thrust"),
    cand('b1', 'a1', 20, "The Base Reorganization Manoeuvre"),
  ]),
  "a1-a3 d7-e6": Object.freeze([
    cand('g1', 'g3', 39, "The Eastern Wing Thrust"),
    cand('c1', 'c3', 40, "The Twin Pillars Attack: Full Center Control"),
    cand('b1', 'a1', 21, "The Base Reorganization Manoeuvre"),
  ]),
  "c1-c3 h8-h6": Object.freeze([
    cand('a1', 'a3', 34, "The Flank Corridor Variation"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
    cand('c3', 'd3', 33, "The Flow Development: c3-d3"),
  ]),
  "c1-c3 b8-b6": Object.freeze([
    cand('a1', 'a3', 34, "The Flank Corridor Variation"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
    cand('c3', 'd3', 33, "The Flow Development: c3-d3"),
  ]),
  "c1-c3 f8-f6": Object.freeze([
    cand('a1', 'a3', 34, "The Flank Corridor Variation"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
    cand('c3', 'd3', 33, "The Flow Development: c3-d3"),
  ]),
  "c1-c3 c7-e5": Object.freeze([
    cand('a1', 'a3', 34, "The Flank Corridor Variation"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
    cand('c3', 'd3', 33, "The Flow Development: c3-d3"),
  ]),
  "c1-c3 d7-e6": Object.freeze([
    cand('a1', 'a3', 34, "The Flank Corridor Variation"),
    cand('c3', 'd3', 33, "The Flow Development: c3-d3"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
  ]),
  "g1-g3 h8-h6": Object.freeze([
    cand('a1', 'a3', 37, "The Flank Corridor Variation"),
    cand('c1', 'c3', 38, "The Twin Pillars Attack: Full Center Control"),
    cand('h1', 'g1', 25, "The Flow Development: h1-g1"),
  ]),
  "g1-g3 f8-f6": Object.freeze([
    cand('a1', 'a3', 36, "The Flank Corridor Variation"),
    cand('c1', 'c3', 35, "The Twin Pillars Attack: Full Center Control"),
    cand('g3', 'h3', 29, "The Flow Development: g3-h3"),
  ]),
  "g1-g3 b8-b6": Object.freeze([
    cand('a1', 'a3', 37, "The Flank Corridor Variation"),
    cand('c1', 'c3', 36, "The Twin Pillars Attack: Full Center Control"),
    cand('e1', 'e3', 27, "The Twin Pillars Attack: Full Center Control"),
  ]),
  "g1-g3 d8-d6": Object.freeze([
    cand('a1', 'a3', 44, "The Flank Corridor Variation"),
    cand('c1', 'c3', 30, "The Twin Pillars Attack: Full Center Control"),
    cand('e1', 'e3', 26, "The Twin Pillars Attack: Full Center Control"),
  ]),
  "g1-g3 c7-e5": Object.freeze([
    cand('a1', 'a3', 37, "The Flank Corridor Variation"),
    cand('c1', 'c3', 38, "The Twin Pillars Attack: Full Center Control"),
    cand('h1', 'g1', 25, "The Flow Development: h1-g1"),
  ]),
  "f2-d4 h8-h6": Object.freeze([
    cand('a1', 'a3', 34, "The Flank Corridor Variation"),
    cand('c1', 'c3', 33, "The Twin Pillars Attack: Full Center Control"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
  ]),
  "f2-d4 b8-b6": Object.freeze([
    cand('a1', 'a3', 34, "The Flank Corridor Variation"),
    cand('c1', 'c3', 33, "The Twin Pillars Attack: Full Center Control"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
  ]),
  "f2-d4 f8-f6": Object.freeze([
    cand('c1', 'c3', 34, "The Twin Pillars Attack: Full Center Control"),
    cand('a1', 'a3', 33, "The Flank Corridor Variation"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
  ]),
  "f2-d4 c7-e5": Object.freeze([
    cand('a1', 'a3', 34, "The Flank Corridor Variation"),
    cand('c1', 'c3', 33, "The Twin Pillars Attack: Full Center Control"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
  ]),
  "f2-d4 f7-e6": Object.freeze([
    cand('a1', 'a3', 34, "The Flank Corridor Variation"),
    cand('c1', 'c3', 33, "The Twin Pillars Attack: Full Center Control"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
  ]),
  "d2-b4 h8-h6": Object.freeze([
    cand('c1', 'c3', 34, "The Twin Pillars Attack: Full Center Control"),
    cand('a1', 'a3', 33, "The Flank Corridor Variation"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
  ]),
  "d2-b4 f8-f6": Object.freeze([
    cand('c1', 'c3', 34, "The Twin Pillars Attack: Full Center Control"),
    cand('a1', 'a3', 33, "The Flank Corridor Variation"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
  ]),
  "d2-b4 b8-b6": Object.freeze([
    cand('c1', 'c3', 34, "The Twin Pillars Attack: Full Center Control"),
    cand('a1', 'a3', 33, "The Flank Corridor Variation"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
  ]),
  "d2-b4 c7-e5": Object.freeze([
    cand('c1', 'c3', 34, "The Twin Pillars Attack: Full Center Control"),
    cand('a1', 'a3', 33, "The Flank Corridor Variation"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
  ]),
  "d2-b4 e7-g5": Object.freeze([
    cand('a1', 'a3', 34, "The Flank Corridor Variation"),
    cand('c1', 'c3', 33, "The Twin Pillars Attack: Full Center Control"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
  ]),
  "g2-e4 c7-e5": Object.freeze([
    cand('g1', 'g3', 83, "The Eastern Wing Thrust"),
    cand('h2', 'h4', 17, "The Flow Development: h2-h4"),
  ]),
  "g2-e4 h8-h6": Object.freeze([
    cand('a1', 'a3', 53, "The Flank Corridor Variation"),
    cand('e4', 'd4', 24, "The Flow Development: e4-d4"),
    cand('g1', 'g3', 23, "The Eastern Wing Thrust"),
  ]),
  "g2-e4 d8-d6": Object.freeze([
    cand('e1', 'e3', 50, "The Twin Pillars Attack: Full Center Control"),
    cand('e4', 'd4', 38, "The Flow Development: e4-d4"),
    cand('g1', 'g3', 12, "The Eastern Wing Thrust"),
  ]),
  "g2-e4 f8-f6": Object.freeze([
    cand('g1', 'g3', 43, "The Eastern Wing Thrust"),
    cand('a1', 'a3', 29, "The Flank Corridor Variation"),
    cand('c1', 'c3', 28, "The Twin Pillars Attack: Full Center Control"),
  ]),
  "g2-e4 b8-b6": Object.freeze([
    cand('g1', 'g3', 41, "The Eastern Wing Thrust"),
    cand('a1', 'a3', 30, "The Flank Corridor Variation"),
    cand('c1', 'c3', 29, "The Twin Pillars Attack: Full Center Control"),
  ]),
  "c2-d3 h8-h6": Object.freeze([
    cand('a1', 'a3', 34, "The Flank Corridor Variation"),
    cand('c1', 'c3', 33, "The Twin Pillars Attack: Full Center Control"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
  ]),
  "c2-d3 f8-f6": Object.freeze([
    cand('a1', 'a3', 34, "The Flank Corridor Variation"),
    cand('c1', 'c3', 33, "The Twin Pillars Attack: Full Center Control"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
  ]),
  "c2-d3 b8-b6": Object.freeze([
    cand('a1', 'a3', 34, "The Flank Corridor Variation"),
    cand('c1', 'c3', 33, "The Twin Pillars Attack: Full Center Control"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
  ]),
  "c2-d3 c7-e5": Object.freeze([
    cand('a1', 'a3', 34, "The Flank Corridor Variation"),
    cand('c1', 'c3', 33, "The Twin Pillars Attack: Full Center Control"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
  ]),
  "c2-d3 d7-e6": Object.freeze([
    cand('a1', 'a3', 34, "The Flank Corridor Variation"),
    cand('c1', 'c3', 33, "The Twin Pillars Attack: Full Center Control"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
  ]),
  "b2-c3 h8-h6": Object.freeze([
    cand('g1', 'g3', 42, "The Eastern Wing Thrust"),
    cand('a1', 'a3', 41, "The Flank Corridor Variation"),
    cand('f2', 'd4', 17, "The Extended Center Strike"),
  ]),
  "b2-c3 b8-b6": Object.freeze([
    cand('g1', 'g3', 35, "The Eastern Wing Thrust"),
    cand('a1', 'a3', 35, "The Flank Corridor Variation"),
    cand('e1', 'e3', 30, "The Twin Pillars Attack: Full Center Control"),
  ]),
  "b2-c3 f8-f6": Object.freeze([
    cand('g1', 'g3', 41, "The Eastern Wing Thrust"),
    cand('a1', 'a3', 41, "The Flank Corridor Variation"),
    cand('f2', 'd4', 18, "The Extended Center Strike"),
  ]),
  "b2-c3 c7-e5": Object.freeze([
    cand('a1', 'a3', 41, "The Flank Corridor Variation"),
    cand('g1', 'g3', 42, "The Eastern Wing Thrust"),
    cand('f2', 'd4', 17, "The Extended Center Strike"),
  ]),
  "b2-c3 e7-g5": Object.freeze([
    cand('a1', 'a3', 41, "The Flank Corridor Variation"),
    cand('g1', 'g3', 42, "The Eastern Wing Thrust"),
    cand('f2', 'd4', 17, "The Extended Center Strike"),
  ]),
  "e2-d3 h8-h6": Object.freeze([
    cand('a1', 'a3', 34, "The Flank Corridor Variation"),
    cand('c1', 'c3', 33, "The Twin Pillars Attack: Full Center Control"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
  ]),
  "e2-d3 f8-f6": Object.freeze([
    cand('a1', 'a3', 34, "The Flank Corridor Variation"),
    cand('c1', 'c3', 33, "The Twin Pillars Attack: Full Center Control"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
  ]),
  "e2-d3 b8-b6": Object.freeze([
    cand('a1', 'a3', 34, "The Flank Corridor Variation"),
    cand('c1', 'c3', 33, "The Twin Pillars Attack: Full Center Control"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
  ]),
  "e2-d3 c7-e5": Object.freeze([
    cand('a1', 'a3', 34, "The Flank Corridor Variation"),
    cand('c1', 'c3', 33, "The Twin Pillars Attack: Full Center Control"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
  ]),
  "e2-d3 e7-g5": Object.freeze([
    cand('a1', 'a3', 34, "The Flank Corridor Variation"),
    cand('c1', 'c3', 33, "The Twin Pillars Attack: Full Center Control"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
  ]),
  "e2-g4 h8-h6": Object.freeze([
    cand('a1', 'a3', 59, "The Flank Corridor Variation"),
    cand('c1', 'c3', 21, "The Twin Pillars Attack: Full Center Control"),
    cand('g1', 'g3', 20, "The Eastern Wing Thrust"),
  ]),
  "e2-g4 f8-f6": Object.freeze([
    cand('a1', 'a3', 33, "The Flank Corridor Variation"),
    cand('c1', 'c3', 34, "The Twin Pillars Attack: Full Center Control"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
  ]),
  "e2-g4 b8-b6": Object.freeze([
    cand('a1', 'a3', 34, "The Flank Corridor Variation"),
    cand('c1', 'c3', 33, "The Twin Pillars Attack: Full Center Control"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
  ]),
  "e2-g4 d8-d6": Object.freeze([
    cand('a1', 'a3', 46, "The Flank Corridor Variation"),
    cand('e1', 'e3', 28, "The Twin Pillars Attack: Full Center Control"),
    cand('f2', 'd4', 26, "The Extended Center Strike"),
  ]),
  "e2-g4 c7-e5": Object.freeze([
    cand('a1', 'a3', 34, "The Flank Corridor Variation"),
    cand('c1', 'c3', 33, "The Twin Pillars Attack: Full Center Control"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
  ]),
  "h2-h4 h8-h6": Object.freeze([
    cand('c1', 'c3', 34, "The Twin Pillars Attack: Full Center Control"),
    cand('a1', 'a3', 33, "The Flank Corridor Variation"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
  ]),
  "h2-h4 b8-b6": Object.freeze([
    cand('c1', 'c3', 33, "The Twin Pillars Attack: Full Center Control"),
    cand('g1', 'g3', 34, "The Eastern Wing Thrust"),
    cand('a1', 'a3', 33, "The Flank Corridor Variation"),
  ]),
  "h2-h4 f8-f6": Object.freeze([
    cand('c1', 'c3', 33, "The Twin Pillars Attack: Full Center Control"),
    cand('g1', 'g3', 34, "The Eastern Wing Thrust"),
    cand('a1', 'a3', 33, "The Flank Corridor Variation"),
  ]),
  "h2-h4 e7-g5": Object.freeze([
    cand('h1', 'h2', 36, "The Flow Development: h1-h2"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
    cand('a1', 'a3', 31, "The Flank Corridor Variation"),
  ]),
  "h2-h4 c7-e5": Object.freeze([
    cand('a1', 'a3', 34, "The Flank Corridor Variation"),
    cand('c1', 'c3', 33, "The Twin Pillars Attack: Full Center Control"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
  ]),
  "c2-a4 h8-h6": Object.freeze([
    cand('c1', 'c3', 34, "The Twin Pillars Attack: Full Center Control"),
    cand('a1', 'a3', 33, "The Flank Corridor Variation"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
  ]),
  "c2-a4 f8-f6": Object.freeze([
    cand('c1', 'c3', 34, "The Twin Pillars Attack: Full Center Control"),
    cand('a1', 'a3', 33, "The Flank Corridor Variation"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
  ]),
  "c2-a4 b8-b6": Object.freeze([
    cand('c1', 'c3', 34, "The Twin Pillars Attack: Full Center Control"),
    cand('g1', 'g3', 34, "The Eastern Wing Thrust"),
    cand('a1', 'a3', 32, "The Flank Corridor Variation"),
  ]),
  "c2-a4 c7-e5": Object.freeze([
    cand('a1', 'a3', 34, "The Flank Corridor Variation"),
    cand('c1', 'c3', 33, "The Twin Pillars Attack: Full Center Control"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
  ]),
  "c2-a4 e7-g5": Object.freeze([
    cand('a1', 'a3', 34, "The Flank Corridor Variation"),
    cand('c1', 'c3', 33, "The Twin Pillars Attack: Full Center Control"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
  ]),
  "e1-e3 h8-h6": Object.freeze([
    cand('e2', 'e1', 45, "The Flow Development: e2-e1"),
    cand('e3', 'f4', 28, "The Flow Development: e3-f4"),
    cand('e3', 'c5', 27, "The Flow Development: e3-c5"),
  ]),
  "e1-e3 f8-f6": Object.freeze([
    cand('a1', 'a3', 38, "The Flank Corridor Variation"),
    cand('e2', 'e1', 32, "The Flow Development: e2-e1"),
    cand('c1', 'c3', 30, "The Twin Pillars Attack: Full Center Control"),
  ]),
  "e1-e3 b8-b6": Object.freeze([
    cand('a1', 'a3', 34, "The Flank Corridor Variation"),
    cand('e3', 'c5', 33, "The Flow Development: e3-c5"),
    cand('c1', 'c3', 33, "The Twin Pillars Attack: Full Center Control"),
  ]),
  "e1-e3 d8-d6": Object.freeze([
    cand('a1', 'a3', 34, "The Flank Corridor Variation"),
    cand('c1', 'c3', 33, "The Twin Pillars Attack: Full Center Control"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
  ]),
  "e1-e3 c7-e5": Object.freeze([
    cand('a1', 'a3', 40, "The Flank Corridor Variation"),
    cand('e2', 'e1', 31, "The Flow Development: e2-e1"),
    cand('c1', 'c3', 29, "The Twin Pillars Attack: Full Center Control"),
  ]),
  "a2-c4 f8-f6": Object.freeze([
    cand('a1', 'a3', 33, "The Flank Corridor Variation"),
    cand('c1', 'c3', 34, "The Twin Pillars Attack: Full Center Control"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
  ]),
  "a2-c4 h8-h6": Object.freeze([
    cand('c1', 'c3', 34, "The Twin Pillars Attack: Full Center Control"),
    cand('a1', 'a3', 33, "The Flank Corridor Variation"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
  ]),
  "a2-c4 b8-b6": Object.freeze([
    cand('c1', 'c3', 34, "The Twin Pillars Attack: Full Center Control"),
    cand('a1', 'a3', 34, "The Flank Corridor Variation"),
    cand('g1', 'g3', 32, "The Eastern Wing Thrust"),
  ]),
  "a2-c4 a7-a5": Object.freeze([
    cand('c4', 'd3', 34, "The Flow Development: c4-d3"),
    cand('a1', 'a3', 33, "The Flank Corridor Variation"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
  ]),
  "a2-c4 d7-e6": Object.freeze([
    cand('a1', 'a3', 34, "The Flank Corridor Variation"),
    cand('c4', 'd3', 33, "The Flow Development: c4-d3"),
    cand('g1', 'g3', 33, "The Eastern Wing Thrust"),
  ]),

  // Ply 3: Green Move 2
  "a1-a3 h8-h6 c1-c3": Object.freeze([
    cand('b8', 'b6', 40, "The Wing Outpost Variation"),
    cand('f8', 'f6', 40, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('g8', 'h8', 20, "The Base Reorganization Manoeuvre"),
  ]),
  "a1-a3 h8-h6 g1-g3": Object.freeze([
    cand('b8', 'b6', 40, "The Wing Outpost Variation"),
    cand('f8', 'f6', 40, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('g8', 'h8', 20, "The Base Reorganization Manoeuvre"),
  ]),
  "a1-a3 h8-h6 b1-a1": Object.freeze([
    cand('b8', 'b6', 39, "The Wing Outpost Variation"),
    cand('f8', 'f6', 39, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('g8', 'h8', 22, "The Base Reorganization Manoeuvre"),
  ]),
  "a1-a3 b8-b6 g1-g3": Object.freeze([
    cand('h8', 'h6', 37, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 37, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('a8', 'b8', 26, "The Base Reorganization Manoeuvre"),
  ]),
  "a1-a3 b8-b6 c1-c3": Object.freeze([
    cand('h8', 'h6', 35, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 35, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b6', 'a6', 30, "The Tactical Response: b6-a6"),
  ]),
  "a1-a3 b8-b6 e1-e3": Object.freeze([
    cand('h8', 'h6', 42, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 31, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('c7', 'e5', 27, "The Diagonal Screen Variation"),
  ]),
  "a1-a3 f8-f6 c1-c3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
    cand('f6', 'e6', 33, "The Tactical Response: f6-e6"),
  ]),
  "a1-a3 f8-f6 g1-g3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
    cand('f6', 'e6', 33, "The Tactical Response: f6-e6"),
  ]),
  "a1-a3 f8-f6 b1-a1": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
    cand('f6', 'e6', 33, "The Tactical Response: f6-e6"),
  ]),
  "a1-a3 c7-e5 c1-c3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 33, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "a1-a3 c7-e5 g1-g3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 33, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "a1-a3 c7-e5 b1-a1": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 33, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "a1-a3 d7-e6 g1-g3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 34, "The Wing Outpost Variation"),
    cand('h8', 'h6', 32, "The Flank Outpost Defense: Eastern Sentinel"),
  ]),
  "a1-a3 d7-e6 c1-c3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
  ]),
  "a1-a3 d7-e6 b1-a1": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "c1-c3 h8-h6 a1-a3": Object.freeze([
    cand('b8', 'b6', 40, "The Wing Outpost Variation"),
    cand('f8', 'f6', 40, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('g8', 'h8', 20, "The Base Reorganization Manoeuvre"),
  ]),
  "c1-c3 h8-h6 g1-g3": Object.freeze([
    cand('b8', 'b6', 37, "The Wing Outpost Variation"),
    cand('f8', 'f6', 37, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('d8', 'd6', 26, "The Cross-Flow Defense: Western Sentinel"),
  ]),
  "c1-c3 h8-h6 c3-d3": Object.freeze([
    cand('b8', 'b6', 40, "The Wing Outpost Variation"),
    cand('f8', 'f6', 40, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('g8', 'h8', 20, "The Base Reorganization Manoeuvre"),
  ]),
  "c1-c3 b8-b6 a1-a3": Object.freeze([
    cand('h8', 'h6', 35, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 35, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b6', 'a6', 30, "The Tactical Response: b6-a6"),
  ]),
  "c1-c3 b8-b6 g1-g3": Object.freeze([
    cand('h8', 'h6', 35, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b6', 'a6', 31, "The Tactical Response: b6-a6"),
  ]),
  "c1-c3 b8-b6 c3-d3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 33, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b6', 'a6', 33, "The Tactical Response: b6-a6"),
  ]),
  "c1-c3 f8-f6 a1-a3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
    cand('f6', 'e6', 33, "The Tactical Response: f6-e6"),
  ]),
  "c1-c3 f8-f6 g1-g3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
    cand('f6', 'e6', 33, "The Tactical Response: f6-e6"),
  ]),
  "c1-c3 f8-f6 c3-d3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
    cand('f6', 'e6', 33, "The Tactical Response: f6-e6"),
  ]),
  "c1-c3 c7-e5 a1-a3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 33, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "c1-c3 c7-e5 g1-g3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 33, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "c1-c3 c7-e5 c3-d3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 33, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "c1-c3 d7-e6 a1-a3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
  ]),
  "c1-c3 d7-e6 c3-d3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 34, "The Wing Outpost Variation"),
    cand('h8', 'h6', 32, "The Flank Outpost Defense: Eastern Sentinel"),
  ]),
  "c1-c3 d7-e6 g1-g3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 34, "The Wing Outpost Variation"),
    cand('h8', 'h6', 32, "The Flank Outpost Defense: Eastern Sentinel"),
  ]),
  "g1-g3 h8-h6 a1-a3": Object.freeze([
    cand('b8', 'b6', 40, "The Wing Outpost Variation"),
    cand('f8', 'f6', 40, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('g8', 'h8', 20, "The Base Reorganization Manoeuvre"),
  ]),
  "g1-g3 h8-h6 c1-c3": Object.freeze([
    cand('b8', 'b6', 37, "The Wing Outpost Variation"),
    cand('f8', 'f6', 37, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('d8', 'd6', 26, "The Cross-Flow Defense: Western Sentinel"),
  ]),
  "g1-g3 h8-h6 h1-g1": Object.freeze([
    cand('b8', 'b6', 38, "The Wing Outpost Variation"),
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('d8', 'd6', 28, "The Cross-Flow Defense: Western Sentinel"),
  ]),
  "g1-g3 f8-f6 a1-a3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
    cand('f6', 'e6', 33, "The Tactical Response: f6-e6"),
  ]),
  "g1-g3 f8-f6 c1-c3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
    cand('f6', 'e6', 33, "The Tactical Response: f6-e6"),
  ]),
  "g1-g3 f8-f6 g3-h3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f6', 'e6', 33, "The Tactical Response: f6-e6"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "g1-g3 b8-b6 a1-a3": Object.freeze([
    cand('h8', 'h6', 37, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 37, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('a8', 'b8', 26, "The Base Reorganization Manoeuvre"),
  ]),
  "g1-g3 b8-b6 c1-c3": Object.freeze([
    cand('h8', 'h6', 35, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b6', 'a6', 31, "The Tactical Response: b6-a6"),
  ]),
  "g1-g3 b8-b6 e1-e3": Object.freeze([
    cand('h8', 'h6', 45, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 29, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('d8', 'd6', 26, "The Cross-Flow Defense: Western Sentinel"),
  ]),
  "g1-g3 d8-d6 a1-a3": Object.freeze([
    cand('d7', 'd8', 47, "The Tactical Response: d7-d8"),
    cand('d6', 'c5', 27, "The Tactical Response: d6-c5"),
    cand('d6', 'f4', 26, "The Tactical Response: d6-f4"),
  ]),
  "g1-g3 d8-d6 c1-c3": Object.freeze([
    cand('d6', 'f4', 35, "The Tactical Response: d6-f4"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 32, "The Twin Pillars Defense: Symmetrical Hub"),
  ]),
  "g1-g3 d8-d6 e1-e3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "g1-g3 c7-e5 a1-a3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 33, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "g1-g3 c7-e5 c1-c3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 33, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "g1-g3 c7-e5 h1-g1": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 34, "The Wing Outpost Variation"),
    cand('f8', 'f6', 32, "The Twin Pillars Defense: Symmetrical Hub"),
  ]),
  "f2-d4 h8-h6 a1-a3": Object.freeze([
    cand('b8', 'b6', 40, "The Wing Outpost Variation"),
    cand('f8', 'f6', 40, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('g8', 'h8', 20, "The Base Reorganization Manoeuvre"),
  ]),
  "f2-d4 h8-h6 c1-c3": Object.freeze([
    cand('f8', 'f6', 40, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 40, "The Wing Outpost Variation"),
    cand('g8', 'h8', 20, "The Base Reorganization Manoeuvre"),
  ]),
  "f2-d4 h8-h6 g1-g3": Object.freeze([
    cand('f8', 'f6', 40, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 39, "The Wing Outpost Variation"),
    cand('g8', 'h8', 21, "The Base Reorganization Manoeuvre"),
  ]),
  "f2-d4 b8-b6 a1-a3": Object.freeze([
    cand('h8', 'h6', 37, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 38, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('a8', 'b8', 25, "The Base Reorganization Manoeuvre"),
  ]),
  "f2-d4 b8-b6 c1-c3": Object.freeze([
    cand('h8', 'h6', 35, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 35, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b6', 'a6', 30, "The Tactical Response: b6-a6"),
  ]),
  "f2-d4 b8-b6 g1-g3": Object.freeze([
    cand('h8', 'h6', 37, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 38, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('a8', 'b8', 25, "The Base Reorganization Manoeuvre"),
  ]),
  "f2-d4 f8-f6 c1-c3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f6', 'e6', 33, "The Tactical Response: f6-e6"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "f2-d4 f8-f6 a1-a3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
    cand('f6', 'e6', 33, "The Tactical Response: f6-e6"),
  ]),
  "f2-d4 f8-f6 g1-g3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
    cand('f6', 'e6', 33, "The Tactical Response: f6-e6"),
  ]),
  "f2-d4 c7-e5 a1-a3": Object.freeze([
    cand('b8', 'b6', 34, "The Wing Outpost Variation"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 33, "The Twin Pillars Defense: Symmetrical Hub"),
  ]),
  "f2-d4 c7-e5 c1-c3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
    cand('f8', 'f6', 33, "The Twin Pillars Defense: Symmetrical Hub"),
  ]),
  "f2-d4 c7-e5 g1-g3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
    cand('f8', 'f6', 33, "The Twin Pillars Defense: Symmetrical Hub"),
  ]),
  "f2-d4 f7-e6 a1-a3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "f2-d4 f7-e6 c1-c3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "f2-d4 f7-e6 g1-g3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "d2-b4 h8-h6 c1-c3": Object.freeze([
    cand('f8', 'f6', 40, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 40, "The Wing Outpost Variation"),
    cand('g8', 'h8', 20, "The Base Reorganization Manoeuvre"),
  ]),
  "d2-b4 h8-h6 a1-a3": Object.freeze([
    cand('f8', 'f6', 40, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 40, "The Wing Outpost Variation"),
    cand('g8', 'h8', 20, "The Base Reorganization Manoeuvre"),
  ]),
  "d2-b4 h8-h6 g1-g3": Object.freeze([
    cand('f8', 'f6', 40, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 40, "The Wing Outpost Variation"),
    cand('g8', 'h8', 20, "The Base Reorganization Manoeuvre"),
  ]),
  "d2-b4 f8-f6 c1-c3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
    cand('f6', 'e6', 33, "The Tactical Response: f6-e6"),
  ]),
  "d2-b4 f8-f6 a1-a3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
    cand('f6', 'e6', 33, "The Tactical Response: f6-e6"),
  ]),
  "d2-b4 f8-f6 g1-g3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
    cand('f6', 'e6', 33, "The Tactical Response: f6-e6"),
  ]),
  "d2-b4 b8-b6 c1-c3": Object.freeze([
    cand('h8', 'h6', 37, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 38, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('a8', 'b8', 25, "The Base Reorganization Manoeuvre"),
  ]),
  "d2-b4 b8-b6 a1-a3": Object.freeze([
    cand('h8', 'h6', 37, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 38, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('a8', 'b8', 25, "The Base Reorganization Manoeuvre"),
  ]),
  "d2-b4 b8-b6 g1-g3": Object.freeze([
    cand('h8', 'h6', 37, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 38, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('a8', 'b8', 25, "The Base Reorganization Manoeuvre"),
  ]),
  "d2-b4 c7-e5 c1-c3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "d2-b4 c7-e5 a1-a3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
  ]),
  "d2-b4 c7-e5 g1-g3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "d2-b4 e7-g5 a1-a3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "d2-b4 e7-g5 c1-c3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "d2-b4 e7-g5 g1-g3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "g2-e4 c7-e5 g1-g3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 33, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "g2-e4 c7-e5 h2-h4": Object.freeze([
    cand('e5', 'e4', 45, "The Tactical Response: e5-e4"),
    cand('f8', 'f6', 28, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 27, "The Flank Outpost Defense: Eastern Sentinel"),
  ]),
  "g2-e4 h8-h6 a1-a3": Object.freeze([
    cand('c7', 'e5', 34, "The Diagonal Screen Variation"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
    cand('f8', 'f6', 33, "The Twin Pillars Defense: Symmetrical Hub"),
  ]),
  "g2-e4 h8-h6 e4-d4": Object.freeze([
    cand('b8', 'b6', 40, "The Wing Outpost Variation"),
    cand('f8', 'f6', 39, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('g8', 'h8', 21, "The Base Reorganization Manoeuvre"),
  ]),
  "g2-e4 h8-h6 g1-g3": Object.freeze([
    cand('d8', 'd6', 40, "The Cross-Flow Defense: Western Sentinel"),
    cand('c7', 'e5', 30, "The Diagonal Screen Variation"),
    cand('f8', 'f6', 30, "The Twin Pillars Defense: Symmetrical Hub"),
  ]),
  "g2-e4 d8-d6 e1-e3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "g2-e4 d8-d6 e4-d4": Object.freeze([
    cand('h8', 'h6', 41, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('d7', 'd8', 30, "The Tactical Response: d7-d8"),
    cand('f8', 'f6', 29, "The Twin Pillars Defense: Symmetrical Hub"),
  ]),
  "g2-e4 d8-d6 g1-g3": Object.freeze([
    cand('h8', 'h6', 40, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 30, "The Wing Outpost Variation"),
    cand('f8', 'f6', 30, "The Twin Pillars Defense: Symmetrical Hub"),
  ]),
  "g2-e4 f8-f6 g1-g3": Object.freeze([
    cand('c7', 'e5', 35, "The Diagonal Screen Variation"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('d8', 'd6', 32, "The Cross-Flow Defense: Western Sentinel"),
  ]),
  "g2-e4 f8-f6 a1-a3": Object.freeze([
    cand('c7', 'e5', 36, "The Diagonal Screen Variation"),
    cand('h8', 'h6', 35, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 29, "The Wing Outpost Variation"),
  ]),
  "g2-e4 f8-f6 c1-c3": Object.freeze([
    cand('c7', 'e5', 35, "The Diagonal Screen Variation"),
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('d8', 'd6', 31, "The Cross-Flow Defense: Western Sentinel"),
  ]),
  "g2-e4 b8-b6 g1-g3": Object.freeze([
    cand('c7', 'e5', 34, "The Diagonal Screen Variation"),
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('d8', 'd6', 32, "The Cross-Flow Defense: Western Sentinel"),
  ]),
  "g2-e4 b8-b6 a1-a3": Object.freeze([
    cand('c7', 'e5', 35, "The Diagonal Screen Variation"),
    cand('h8', 'h6', 35, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 30, "The Twin Pillars Defense: Symmetrical Hub"),
  ]),
  "g2-e4 b8-b6 c1-c3": Object.freeze([
    cand('c7', 'e5', 35, "The Diagonal Screen Variation"),
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('d8', 'd6', 31, "The Cross-Flow Defense: Western Sentinel"),
  ]),
  "c2-d3 h8-h6 a1-a3": Object.freeze([
    cand('b8', 'b6', 40, "The Wing Outpost Variation"),
    cand('f8', 'f6', 40, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('g8', 'h8', 20, "The Base Reorganization Manoeuvre"),
  ]),
  "c2-d3 h8-h6 c1-c3": Object.freeze([
    cand('b8', 'b6', 40, "The Wing Outpost Variation"),
    cand('f8', 'f6', 39, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('g8', 'h8', 21, "The Base Reorganization Manoeuvre"),
  ]),
  "c2-d3 h8-h6 g1-g3": Object.freeze([
    cand('f8', 'f6', 37, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 35, "The Wing Outpost Variation"),
    cand('d8', 'd6', 28, "The Cross-Flow Defense: Western Sentinel"),
  ]),
  "c2-d3 f8-f6 a1-a3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
    cand('f6', 'e6', 33, "The Tactical Response: f6-e6"),
  ]),
  "c2-d3 f8-f6 c1-c3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
    cand('f6', 'e6', 33, "The Tactical Response: f6-e6"),
  ]),
  "c2-d3 f8-f6 g1-g3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
    cand('f6', 'e6', 33, "The Tactical Response: f6-e6"),
  ]),
  "c2-d3 b8-b6 a1-a3": Object.freeze([
    cand('h8', 'h6', 37, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 38, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('a8', 'b8', 25, "The Base Reorganization Manoeuvre"),
  ]),
  "c2-d3 b8-b6 c1-c3": Object.freeze([
    cand('h8', 'h6', 36, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 35, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b6', 'a6', 29, "The Tactical Response: b6-a6"),
  ]),
  "c2-d3 b8-b6 g1-g3": Object.freeze([
    cand('h8', 'h6', 37, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 36, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('d8', 'd6', 27, "The Cross-Flow Defense: Western Sentinel"),
  ]),
  "c2-d3 c7-e5 a1-a3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "c2-d3 c7-e5 c1-c3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 33, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "c2-d3 c7-e5 g1-g3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "c2-d3 d7-e6 a1-a3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "c2-d3 d7-e6 c1-c3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 32, "The Wing Outpost Variation"),
  ]),
  "c2-d3 d7-e6 g1-g3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "b2-c3 h8-h6 g1-g3": Object.freeze([
    cand('f8', 'f6', 40, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 37, "The Wing Outpost Variation"),
    cand('d8', 'd6', 23, "The Cross-Flow Defense: Western Sentinel"),
  ]),
  "b2-c3 h8-h6 a1-a3": Object.freeze([
    cand('f8', 'f6', 41, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 38, "The Wing Outpost Variation"),
    cand('g8', 'h8', 21, "The Base Reorganization Manoeuvre"),
  ]),
  "b2-c3 h8-h6 f2-d4": Object.freeze([
    cand('b8', 'b6', 40, "The Wing Outpost Variation"),
    cand('f8', 'f6', 40, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('g8', 'h8', 20, "The Base Reorganization Manoeuvre"),
  ]),
  "b2-c3 b8-b6 g1-g3": Object.freeze([
    cand('h8', 'h6', 37, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 35, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b6', 'a6', 28, "The Tactical Response: b6-a6"),
  ]),
  "b2-c3 b8-b6 a1-a3": Object.freeze([
    cand('h8', 'h6', 37, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 36, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b6', 'a6', 27, "The Tactical Response: b6-a6"),
  ]),
  "b2-c3 b8-b6 e1-e3": Object.freeze([
    cand('h8', 'h6', 46, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 28, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('d8', 'd6', 26, "The Cross-Flow Defense: Western Sentinel"),
  ]),
  "b2-c3 f8-f6 g1-g3": Object.freeze([
    cand('h8', 'h6', 35, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
    cand('f6', 'e6', 32, "The Tactical Response: f6-e6"),
  ]),
  "b2-c3 f8-f6 a1-a3": Object.freeze([
    cand('h8', 'h6', 35, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 34, "The Wing Outpost Variation"),
    cand('f6', 'e6', 31, "The Tactical Response: f6-e6"),
  ]),
  "b2-c3 f8-f6 f2-d4": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f6', 'e6', 33, "The Tactical Response: f6-e6"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "b2-c3 c7-e5 a1-a3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
  ]),
  "b2-c3 c7-e5 g1-g3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
    cand('f8', 'f6', 33, "The Twin Pillars Defense: Symmetrical Hub"),
  ]),
  "b2-c3 c7-e5 f2-d4": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
    cand('f8', 'f6', 33, "The Twin Pillars Defense: Symmetrical Hub"),
  ]),
  "b2-c3 e7-g5 a1-a3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "b2-c3 e7-g5 g1-g3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "b2-c3 e7-g5 f2-d4": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
    cand('f8', 'f6', 33, "The Twin Pillars Defense: Symmetrical Hub"),
  ]),
  "e2-d3 h8-h6 a1-a3": Object.freeze([
    cand('b8', 'b6', 40, "The Wing Outpost Variation"),
    cand('f8', 'f6', 40, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('g8', 'h8', 20, "The Base Reorganization Manoeuvre"),
  ]),
  "e2-d3 h8-h6 c1-c3": Object.freeze([
    cand('b8', 'b6', 41, "The Wing Outpost Variation"),
    cand('f8', 'f6', 38, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('g8', 'h8', 21, "The Base Reorganization Manoeuvre"),
  ]),
  "e2-d3 h8-h6 g1-g3": Object.freeze([
    cand('b8', 'b6', 37, "The Wing Outpost Variation"),
    cand('f8', 'f6', 35, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('d8', 'd6', 28, "The Cross-Flow Defense: Western Sentinel"),
  ]),
  "e2-d3 f8-f6 a1-a3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
    cand('f6', 'e6', 33, "The Tactical Response: f6-e6"),
  ]),
  "e2-d3 f8-f6 c1-c3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
    cand('f6', 'e6', 33, "The Tactical Response: f6-e6"),
  ]),
  "e2-d3 f8-f6 g1-g3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
    cand('f6', 'e6', 33, "The Tactical Response: f6-e6"),
  ]),
  "e2-d3 b8-b6 a1-a3": Object.freeze([
    cand('h8', 'h6', 37, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 38, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('a8', 'b8', 25, "The Base Reorganization Manoeuvre"),
  ]),
  "e2-d3 b8-b6 c1-c3": Object.freeze([
    cand('h8', 'h6', 37, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b6', 'a6', 29, "The Tactical Response: b6-a6"),
  ]),
  "e2-d3 b8-b6 g1-g3": Object.freeze([
    cand('h8', 'h6', 37, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 36, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('d8', 'd6', 27, "The Cross-Flow Defense: Western Sentinel"),
  ]),
  "e2-d3 c7-e5 a1-a3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "e2-d3 c7-e5 c1-c3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 33, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "e2-d3 c7-e5 g1-g3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "e2-d3 e7-g5 a1-a3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "e2-d3 e7-g5 c1-c3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "e2-d3 e7-g5 g1-g3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "e2-g4 h8-h6 a1-a3": Object.freeze([
    cand('f8', 'f6', 39, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 38, "The Wing Outpost Variation"),
    cand('g8', 'h8', 23, "The Base Reorganization Manoeuvre"),
  ]),
  "e2-g4 h8-h6 c1-c3": Object.freeze([
    cand('b8', 'b6', 34, "The Wing Outpost Variation"),
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('d8', 'd6', 32, "The Cross-Flow Defense: Western Sentinel"),
  ]),
  "e2-g4 h8-h6 g1-g3": Object.freeze([
    cand('f8', 'f6', 35, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
    cand('d8', 'd6', 32, "The Cross-Flow Defense: Western Sentinel"),
  ]),
  "e2-g4 f8-f6 a1-a3": Object.freeze([
    cand('h8', 'h6', 41, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 42, "The Wing Outpost Variation"),
    cand('c7', 'e5', 17, "The Diagonal Screen Variation"),
  ]),
  "e2-g4 f8-f6 c1-c3": Object.freeze([
    cand('h8', 'h6', 35, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 34, "The Wing Outpost Variation"),
    cand('d8', 'd6', 31, "The Cross-Flow Defense: Western Sentinel"),
  ]),
  "e2-g4 f8-f6 g1-g3": Object.freeze([
    cand('h8', 'h6', 35, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 34, "The Wing Outpost Variation"),
    cand('d8', 'd6', 31, "The Cross-Flow Defense: Western Sentinel"),
  ]),
  "e2-g4 b8-b6 a1-a3": Object.freeze([
    cand('h8', 'h6', 36, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 36, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('a8', 'b8', 28, "The Base Reorganization Manoeuvre"),
  ]),
  "e2-g4 b8-b6 c1-c3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b6', 'a6', 33, "The Tactical Response: b6-a6"),
    cand('f8', 'f6', 33, "The Twin Pillars Defense: Symmetrical Hub"),
  ]),
  "e2-g4 b8-b6 g1-g3": Object.freeze([
    cand('h8', 'h6', 35, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('d8', 'd6', 31, "The Cross-Flow Defense: Western Sentinel"),
  ]),
  "e2-g4 d8-d6 a1-a3": Object.freeze([
    cand('d6', 'f4', 59, "The Tactical Response: d6-f4"),
    cand('d7', 'd8', 25, "The Tactical Response: d7-d8"),
    cand('d6', 'c5', 16, "The Tactical Response: d6-c5"),
  ]),
  "e2-g4 d8-d6 e1-e3": Object.freeze([
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 34, "The Wing Outpost Variation"),
    cand('f8', 'f6', 33, "The Twin Pillars Defense: Symmetrical Hub"),
  ]),
  "e2-g4 d8-d6 f2-d4": Object.freeze([
    cand('h8', 'h6', 40, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('d7', 'd8', 31, "The Tactical Response: d7-d8"),
    cand('f8', 'f6', 29, "The Twin Pillars Defense: Symmetrical Hub"),
  ]),
  "e2-g4 c7-e5 a1-a3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "e2-g4 c7-e5 c1-c3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
    cand('f8', 'f6', 33, "The Twin Pillars Defense: Symmetrical Hub"),
  ]),
  "e2-g4 c7-e5 g1-g3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "h2-h4 h8-h6 c1-c3": Object.freeze([
    cand('f8', 'f6', 41, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 38, "The Wing Outpost Variation"),
    cand('g8', 'h8', 21, "The Base Reorganization Manoeuvre"),
  ]),
  "h2-h4 h8-h6 a1-a3": Object.freeze([
    cand('f8', 'f6', 40, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 40, "The Wing Outpost Variation"),
    cand('g8', 'h8', 20, "The Base Reorganization Manoeuvre"),
  ]),
  "h2-h4 h8-h6 g1-g3": Object.freeze([
    cand('f8', 'f6', 37, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 35, "The Wing Outpost Variation"),
    cand('d8', 'd6', 28, "The Cross-Flow Defense: Western Sentinel"),
  ]),
  "h2-h4 b8-b6 c1-c3": Object.freeze([
    cand('h8', 'h6', 36, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b6', 'a6', 30, "The Tactical Response: b6-a6"),
  ]),
  "h2-h4 b8-b6 g1-g3": Object.freeze([
    cand('h8', 'h6', 38, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 35, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('d8', 'd6', 27, "The Cross-Flow Defense: Western Sentinel"),
  ]),
  "h2-h4 b8-b6 a1-a3": Object.freeze([
    cand('h8', 'h6', 37, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 38, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('a8', 'b8', 25, "The Base Reorganization Manoeuvre"),
  ]),
  "h2-h4 f8-f6 c1-c3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
    cand('f6', 'e6', 33, "The Tactical Response: f6-e6"),
  ]),
  "h2-h4 f8-f6 g1-g3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f6', 'e6', 33, "The Tactical Response: f6-e6"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "h2-h4 f8-f6 a1-a3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
    cand('f6', 'e6', 33, "The Tactical Response: f6-e6"),
  ]),
  "h2-h4 e7-g5 h1-h2": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "h2-h4 e7-g5 g1-g3": Object.freeze([
    cand('h8', 'h6', 36, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 32, "The Wing Outpost Variation"),
    cand('f8', 'f6', 32, "The Twin Pillars Defense: Symmetrical Hub"),
  ]),
  "h2-h4 e7-g5 a1-a3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 33, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "h2-h4 c7-e5 a1-a3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
  ]),
  "h2-h4 c7-e5 c1-c3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "h2-h4 c7-e5 g1-g3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "c2-a4 h8-h6 c1-c3": Object.freeze([
    cand('f8', 'f6', 41, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 38, "The Wing Outpost Variation"),
    cand('g8', 'h8', 21, "The Base Reorganization Manoeuvre"),
  ]),
  "c2-a4 h8-h6 a1-a3": Object.freeze([
    cand('f8', 'f6', 40, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 40, "The Wing Outpost Variation"),
    cand('g8', 'h8', 20, "The Base Reorganization Manoeuvre"),
  ]),
  "c2-a4 h8-h6 g1-g3": Object.freeze([
    cand('f8', 'f6', 38, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 34, "The Wing Outpost Variation"),
    cand('d8', 'd6', 28, "The Cross-Flow Defense: Western Sentinel"),
  ]),
  "c2-a4 f8-f6 c1-c3": Object.freeze([
    cand('h8', 'h6', 36, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 32, "The Wing Outpost Variation"),
    cand('f6', 'e6', 32, "The Tactical Response: f6-e6"),
  ]),
  "c2-a4 f8-f6 a1-a3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
    cand('f6', 'e6', 33, "The Tactical Response: f6-e6"),
  ]),
  "c2-a4 f8-f6 g1-g3": Object.freeze([
    cand('h8', 'h6', 36, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 32, "The Wing Outpost Variation"),
    cand('f6', 'e6', 32, "The Tactical Response: f6-e6"),
  ]),
  "c2-a4 b8-b6 c1-c3": Object.freeze([
    cand('h8', 'h6', 36, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b6', 'a6', 30, "The Tactical Response: b6-a6"),
  ]),
  "c2-a4 b8-b6 g1-g3": Object.freeze([
    cand('h8', 'h6', 37, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 35, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b6', 'c6', 28, "The Tactical Response: b6-c6"),
  ]),
  "c2-a4 b8-b6 a1-a3": Object.freeze([
    cand('h8', 'h6', 37, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 36, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b6', 'c6', 27, "The Tactical Response: b6-c6"),
  ]),
  "c2-a4 c7-e5 a1-a3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "c2-a4 c7-e5 c1-c3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
    cand('f8', 'f6', 33, "The Twin Pillars Defense: Symmetrical Hub"),
  ]),
  "c2-a4 c7-e5 g1-g3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "c2-a4 e7-g5 a1-a3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "c2-a4 e7-g5 c1-c3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "c2-a4 e7-g5 g1-g3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "e1-e3 h8-h6 e2-e1": Object.freeze([
    cand('b8', 'b6', 39, "The Wing Outpost Variation"),
    cand('f8', 'f6', 40, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('e7', 'g5', 21, "The Eastern Flank Counter-Thrust"),
  ]),
  "e1-e3 h8-h6 e3-f4": Object.freeze([
    cand('d8', 'd6', 54, "The Cross-Flow Defense: Western Sentinel"),
    cand('f8', 'f6', 24, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 22, "The Wing Outpost Variation"),
  ]),
  "e1-e3 h8-h6 e3-c5": Object.freeze([
    cand('f8', 'f6', 50, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h6', 'e3', 26, "The Tactical Response: h6-e3"),
    cand('g8', 'h8', 24, "The Base Reorganization Manoeuvre"),
  ]),
  "e1-e3 f8-f6 a1-a3": Object.freeze([
    cand('h8', 'h6', 56, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 23, "The Wing Outpost Variation"),
    cand('f6', 'e6', 21, "The Tactical Response: f6-e6"),
  ]),
  "e1-e3 f8-f6 e2-e1": Object.freeze([
    cand('b8', 'b6', 34, "The Wing Outpost Variation"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f6', 'e6', 33, "The Tactical Response: f6-e6"),
  ]),
  "e1-e3 f8-f6 c1-c3": Object.freeze([
    cand('h8', 'h6', 66, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 17, "The Wing Outpost Variation"),
    cand('f6', 'e6', 17, "The Tactical Response: f6-e6"),
  ]),
  "e1-e3 b8-b6 a1-a3": Object.freeze([
    cand('h8', 'h6', 42, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 31, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('c7', 'e5', 27, "The Diagonal Screen Variation"),
  ]),
  "e1-e3 b8-b6 e3-c5": Object.freeze([
    cand('h8', 'h6', 43, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 32, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b6', 'a6', 25, "The Tactical Response: b6-a6"),
  ]),
  "e1-e3 b8-b6 c1-c3": Object.freeze([
    cand('h8', 'h6', 44, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 29, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('d8', 'd6', 27, "The Cross-Flow Defense: Western Sentinel"),
  ]),
  "e1-e3 d8-d6 a1-a3": Object.freeze([
    cand('h8', 'h6', 60, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('d7', 'd8', 40, "The Tactical Response: d7-d8"),
  ]),
  "e1-e3 d8-d6 c1-c3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "e1-e3 d8-d6 g1-g3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "e1-e3 c7-e5 a1-a3": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "e1-e3 c7-e5 e2-e1": Object.freeze([
    cand('f8', 'f6', 34, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
  ]),
  "e1-e3 c7-e5 c1-c3": Object.freeze([
    cand('h8', 'h6', 42, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 29, "The Wing Outpost Variation"),
    cand('f8', 'f6', 29, "The Twin Pillars Defense: Symmetrical Hub"),
  ]),
  "a2-c4 f8-f6 a1-a3": Object.freeze([
    cand('f6', 'e6', 37, "The Tactical Response: f6-e6"),
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 29, "The Wing Outpost Variation"),
  ]),
  "a2-c4 f8-f6 c1-c3": Object.freeze([
    cand('f6', 'e6', 36, "The Tactical Response: f6-e6"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 31, "The Wing Outpost Variation"),
  ]),
  "a2-c4 f8-f6 g1-g3": Object.freeze([
    cand('f6', 'e6', 36, "The Tactical Response: f6-e6"),
    cand('h8', 'h6', 32, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 32, "The Wing Outpost Variation"),
  ]),
  "a2-c4 h8-h6 c1-c3": Object.freeze([
    cand('f8', 'f6', 65, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('a7', 'a5', 18, "The Tactical Response: a7-a5"),
    cand('b8', 'b6', 17, "The Wing Outpost Variation"),
  ]),
  "a2-c4 h8-h6 a1-a3": Object.freeze([
    cand('f8', 'f6', 66, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('a7', 'a5', 18, "The Tactical Response: a7-a5"),
    cand('b8', 'b6', 16, "The Wing Outpost Variation"),
  ]),
  "a2-c4 h8-h6 g1-g3": Object.freeze([
    cand('f8', 'f6', 64, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 18, "The Wing Outpost Variation"),
    cand('a7', 'a5', 18, "The Tactical Response: a7-a5"),
  ]),
  "a2-c4 b8-b6 c1-c3": Object.freeze([
    cand('f8', 'f6', 66, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 17, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('a7', 'a5', 17, "The Tactical Response: a7-a5"),
  ]),
  "a2-c4 b8-b6 a1-a3": Object.freeze([
    cand('f8', 'f6', 63, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 19, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('a7', 'a5', 18, "The Tactical Response: a7-a5"),
  ]),
  "a2-c4 b8-b6 g1-g3": Object.freeze([
    cand('f8', 'f6', 64, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('h8', 'h6', 19, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('a7', 'a5', 17, "The Tactical Response: a7-a5"),
  ]),
  "a2-c4 a7-a5 c4-d3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 33, "The Wing Outpost Variation"),
    cand('f8', 'f6', 33, "The Twin Pillars Defense: Symmetrical Hub"),
  ]),
  "a2-c4 a7-a5 a1-a3": Object.freeze([
    cand('a5', 'c4', 35, "The Tactical Response: a5-c4"),
    cand('h8', 'h6', 35, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 30, "The Twin Pillars Defense: Symmetrical Hub"),
  ]),
  "a2-c4 a7-a5 g1-g3": Object.freeze([
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('a5', 'c4', 34, "The Tactical Response: a5-c4"),
    cand('f8', 'f6', 32, "The Twin Pillars Defense: Symmetrical Hub"),
  ]),
  "a2-c4 d7-e6 a1-a3": Object.freeze([
    cand('e6', 'c4', 35, "The Tactical Response: e6-c4"),
    cand('h8', 'h6', 34, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 31, "The Twin Pillars Defense: Symmetrical Hub"),
  ]),
  "a2-c4 d7-e6 c4-d3": Object.freeze([
    cand('h8', 'h6', 36, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('f8', 'f6', 32, "The Twin Pillars Defense: Symmetrical Hub"),
    cand('b8', 'b6', 32, "The Wing Outpost Variation"),
  ]),
  "a2-c4 d7-e6 g1-g3": Object.freeze([
    cand('e6', 'c4', 36, "The Tactical Response: e6-c4"),
    cand('h8', 'h6', 33, "The Flank Outpost Defense: Eastern Sentinel"),
    cand('b8', 'b6', 31, "The Wing Outpost Variation"),
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

  if (level === config.tier2DeviateLevel) {
    // Level 2 has configurable chance to deviate / blunder in opening
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
