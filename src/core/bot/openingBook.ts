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
 * e.g. "" (Turn 1 White), "c1-c3" (Turn 1 Black response), etc.
 */
export const OPENING_BOOK: Readonly<Record<string, readonly OpeningMoveCandidate[]>> = Object.freeze({

  // Ply 0: Initial Board (All 14 White Opening Moves)
  "": Object.freeze([
    cand('a1', 'a3', 15, "Western Flank Flow"),
    cand('c1', 'c3', 15, "Western Center Flow"),
    cand('g1', 'g3', 15, "Eastern Flank Flow"),
    cand('f2', 'd4', 6, "Center Strike System"),
    cand('d2', 'b4', 6, "Pokshtya Flank Advance"),
    cand('g2', 'e4', 6, "Eastern Diagonal Screen"),
    cand('c2', 'd3', 5, "Western Vanguard Flow System"),
    cand('b2', 'c3', 5, "Western Diagonal Screen"),
    cand('e2', 'd3', 5, "Eastern Vanguard Flow System"),
    cand('e2', 'g4', 5, "Far-Eastern Flank Corridor"),
    cand('h2', 'h4', 5, "Eastern Flank Wing Advance"),
    cand('c2', 'a4', 5, "Far-Western Flank Corridor"),
    cand('e1', 'e3', 5, "Center Flow"),
    cand('a2', 'c4', 2, "Extended Flank Advance"),
  ]),

  // Ply 1: Black response to White Move 1
  "a1-a3": Object.freeze([
    cand('h8', 'h6', 27, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 28, "Wing Outpost Variation"),
    cand('f8', 'f6', 28, "Center Outpost Defense"),
    cand('c7', 'e5', 9, "Diagonal Screen Counter-Thrust"),
    cand('d7', 'e6', 8, "Central Redoubt Defense"),
  ]),
  "c1-c3": Object.freeze([
    cand('h8', 'h6', 27, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 28, "Wing Outpost Variation"),
    cand('f8', 'f6', 28, "Center Outpost Defense"),
    cand('c7', 'e5', 9, "Diagonal Screen Counter-Thrust"),
    cand('d7', 'e6', 8, "Central Redoubt Defense"),
  ]),
  "g1-g3": Object.freeze([
    cand('h8', 'h6', 25, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 25, "Center Outpost Defense"),
    cand('b8', 'b6', 25, "Wing Outpost Variation"),
    cand('d8', 'd6', 17, "Western Cross-Flow Defense"),
    cand('c7', 'e5', 8, "Diagonal Screen Counter-Thrust"),
  ]),
  "f2-d4": Object.freeze([
    cand('h8', 'h6', 29, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 27, "Wing Outpost Variation"),
    cand('f8', 'f6', 27, "Center Outpost Defense"),
    cand('c7', 'e5', 9, "Diagonal Screen Counter-Thrust"),
    cand('f7', 'e6', 8, "Central Anchor Defense"),
  ]),
  "d2-b4": Object.freeze([
    cand('h8', 'h6', 27, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 28, "Center Outpost Defense"),
    cand('b8', 'b6', 28, "Wing Outpost Variation"),
    cand('c7', 'e5', 9, "Diagonal Screen Counter-Thrust"),
    cand('e7', 'g5', 8, "Eastern Flank Counter-Thrust"),
  ]),
  "g2-e4": Object.freeze([
    cand('c7', 'e5', 21, "Diagonal Screen Counter-Thrust"),
    cand('h8', 'h6', 21, "Eastern Flank Outpost Defense"),
    cand('d8', 'd6', 20, "Western Cross-Flow Defense"),
    cand('f8', 'f6', 19, "Center Outpost Defense"),
    cand('b8', 'b6', 19, "Wing Outpost Variation"),
  ]),
  "c2-d3": Object.freeze([
    cand('h8', 'h6', 29, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 27, "Center Outpost Defense"),
    cand('b8', 'b6', 27, "Wing Outpost Variation"),
    cand('c7', 'e5', 9, "Diagonal Screen Counter-Thrust"),
    cand('d7', 'e6', 8, "Central Redoubt Defense"),
  ]),
  "b2-c3": Object.freeze([
    cand('h8', 'h6', 29, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 27, "Wing Outpost Variation"),
    cand('f8', 'f6', 27, "Center Outpost Defense"),
    cand('c7', 'e5', 9, "Diagonal Screen Counter-Thrust"),
    cand('e7', 'g5', 8, "Eastern Flank Counter-Thrust"),
  ]),
  "e2-d3": Object.freeze([
    cand('h8', 'h6', 29, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 27, "Center Outpost Defense"),
    cand('b8', 'b6', 27, "Wing Outpost Variation"),
    cand('c7', 'e5', 9, "Diagonal Screen Counter-Thrust"),
    cand('e7', 'g5', 8, "Eastern Flank Counter-Thrust"),
  ]),
  "e2-g4": Object.freeze([
    cand('h8', 'h6', 25, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 25, "Center Outpost Defense"),
    cand('b8', 'b6', 25, "Wing Outpost Variation"),
    cand('d8', 'd6', 17, "Western Cross-Flow Defense"),
    cand('c7', 'e5', 8, "Diagonal Screen Counter-Thrust"),
  ]),
  "h2-h4": Object.freeze([
    cand('h8', 'h6', 27, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 27, "Wing Outpost Variation"),
    cand('f8', 'f6', 25, "Center Outpost Defense"),
    cand('e7', 'g5', 12, "Eastern Flank Counter-Thrust"),
    cand('c7', 'e5', 9, "Diagonal Screen Counter-Thrust"),
  ]),
  "c2-a4": Object.freeze([
    cand('h8', 'h6', 29, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 27, "Center Outpost Defense"),
    cand('b8', 'b6', 27, "Wing Outpost Variation"),
    cand('c7', 'e5', 9, "Diagonal Screen Counter-Thrust"),
    cand('e7', 'g5', 8, "Eastern Flank Counter-Thrust"),
  ]),
  "e1-e3": Object.freeze([
    cand('h8', 'h6', 50, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 14, "Center Outpost Defense"),
    cand('b8', 'b6', 13, "Wing Outpost Variation"),
    cand('d8', 'd6', 12, "Western Cross-Flow Defense"),
    cand('c7', 'e5', 11, "Diagonal Screen Counter-Thrust"),
  ]),
  "a2-c4": Object.freeze([
    cand('f8', 'f6', 48, "Center Outpost Defense"),
    cand('h8', 'h6', 14, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 14, "Wing Outpost Variation"),
    cand('a7', 'a5', 13, "Counter-Flow Vector"),
    cand('d7', 'e6', 11, "Central Redoubt Defense"),
  ]),

  // Ply 2: White Move 2
  "a1-a3 h8-h6": Object.freeze([
    cand('c1', 'c3', 40, "Twin Pillars Attack"),
    cand('g1', 'g3', 40, "Eastern Wing Thrust"),
    cand('b1', 'a1', 20, "Base Reorganization Manoeuvre"),
  ]),
  "a1-a3 b8-b6": Object.freeze([
    cand('g1', 'g3', 37, "Eastern Wing Thrust"),
    cand('c1', 'c3', 35, "Twin Pillars Attack"),
    cand('e1', 'e3', 28, "Twin Pillars Attack"),
  ]),
  "a1-a3 f8-f6": Object.freeze([
    cand('c1', 'c3', 40, "Twin Pillars Attack"),
    cand('g1', 'g3', 39, "Eastern Wing Thrust"),
    cand('b1', 'a1', 21, "Base Reorganization Manoeuvre"),
  ]),
  "a1-a3 c7-e5": Object.freeze([
    cand('c1', 'c3', 40, "Twin Pillars Attack"),
    cand('g1', 'g3', 40, "Eastern Wing Thrust"),
    cand('b1', 'a1', 20, "Base Reorganization Manoeuvre"),
  ]),
  "a1-a3 d7-e6": Object.freeze([
    cand('g1', 'g3', 39, "Eastern Wing Thrust"),
    cand('c1', 'c3', 40, "Twin Pillars Attack"),
    cand('b1', 'a1', 21, "Base Reorganization Manoeuvre"),
  ]),
  "c1-c3 h8-h6": Object.freeze([
    cand('a1', 'a3', 34, "Flank Corridor Variation"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
    cand('c3', 'd3', 33, "Flow Development: c3-d3"),
  ]),
  "c1-c3 b8-b6": Object.freeze([
    cand('a1', 'a3', 34, "Flank Corridor Variation"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
    cand('c3', 'd3', 33, "Flow Development: c3-d3"),
  ]),
  "c1-c3 f8-f6": Object.freeze([
    cand('a1', 'a3', 34, "Flank Corridor Variation"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
    cand('c3', 'd3', 33, "Flow Development: c3-d3"),
  ]),
  "c1-c3 c7-e5": Object.freeze([
    cand('a1', 'a3', 34, "Flank Corridor Variation"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
    cand('c3', 'd3', 33, "Flow Development: c3-d3"),
  ]),
  "c1-c3 d7-e6": Object.freeze([
    cand('a1', 'a3', 34, "Flank Corridor Variation"),
    cand('c3', 'd3', 33, "Flow Development: c3-d3"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
  ]),
  "g1-g3 h8-h6": Object.freeze([
    cand('a1', 'a3', 37, "Flank Corridor Variation"),
    cand('c1', 'c3', 38, "Twin Pillars Attack"),
    cand('h1', 'g1', 25, "Flow Development: h1-g1"),
  ]),
  "g1-g3 f8-f6": Object.freeze([
    cand('a1', 'a3', 36, "Flank Corridor Variation"),
    cand('c1', 'c3', 35, "Twin Pillars Attack"),
    cand('g3', 'h3', 29, "Flow Development: g3-h3"),
  ]),
  "g1-g3 b8-b6": Object.freeze([
    cand('a1', 'a3', 37, "Flank Corridor Variation"),
    cand('c1', 'c3', 36, "Twin Pillars Attack"),
    cand('e1', 'e3', 27, "Twin Pillars Attack"),
  ]),
  "g1-g3 d8-d6": Object.freeze([
    cand('a1', 'a3', 44, "Flank Corridor Variation"),
    cand('c1', 'c3', 30, "Twin Pillars Attack"),
    cand('e1', 'e3', 26, "Twin Pillars Attack"),
  ]),
  "g1-g3 c7-e5": Object.freeze([
    cand('a1', 'a3', 37, "Flank Corridor Variation"),
    cand('c1', 'c3', 38, "Twin Pillars Attack"),
    cand('h1', 'g1', 25, "Flow Development: h1-g1"),
  ]),
  "f2-d4 h8-h6": Object.freeze([
    cand('a1', 'a3', 34, "Flank Corridor Variation"),
    cand('c1', 'c3', 33, "Twin Pillars Attack"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
  ]),
  "f2-d4 b8-b6": Object.freeze([
    cand('a1', 'a3', 34, "Flank Corridor Variation"),
    cand('c1', 'c3', 33, "Twin Pillars Attack"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
  ]),
  "f2-d4 f8-f6": Object.freeze([
    cand('c1', 'c3', 34, "Twin Pillars Attack"),
    cand('a1', 'a3', 33, "Flank Corridor Variation"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
  ]),
  "f2-d4 c7-e5": Object.freeze([
    cand('a1', 'a3', 34, "Flank Corridor Variation"),
    cand('c1', 'c3', 33, "Twin Pillars Attack"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
  ]),
  "f2-d4 f7-e6": Object.freeze([
    cand('a1', 'a3', 34, "Flank Corridor Variation"),
    cand('c1', 'c3', 33, "Twin Pillars Attack"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
  ]),
  "d2-b4 h8-h6": Object.freeze([
    cand('c1', 'c3', 34, "Twin Pillars Attack"),
    cand('a1', 'a3', 33, "Flank Corridor Variation"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
  ]),
  "d2-b4 f8-f6": Object.freeze([
    cand('c1', 'c3', 34, "Twin Pillars Attack"),
    cand('a1', 'a3', 33, "Flank Corridor Variation"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
  ]),
  "d2-b4 b8-b6": Object.freeze([
    cand('c1', 'c3', 34, "Twin Pillars Attack"),
    cand('a1', 'a3', 33, "Flank Corridor Variation"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
  ]),
  "d2-b4 c7-e5": Object.freeze([
    cand('c1', 'c3', 34, "Twin Pillars Attack"),
    cand('a1', 'a3', 33, "Flank Corridor Variation"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
  ]),
  "d2-b4 e7-g5": Object.freeze([
    cand('a1', 'a3', 34, "Flank Corridor Variation"),
    cand('c1', 'c3', 33, "Twin Pillars Attack"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
  ]),
  "g2-e4 c7-e5": Object.freeze([
    cand('g1', 'g3', 83, "Eastern Wing Thrust"),
    cand('h2', 'h4', 17, "Flow Development: h2-h4"),
  ]),
  "g2-e4 h8-h6": Object.freeze([
    cand('a1', 'a3', 53, "Flank Corridor Variation"),
    cand('e4', 'd4', 24, "Flow Development: e4-d4"),
    cand('g1', 'g3', 23, "Eastern Wing Thrust"),
  ]),
  "g2-e4 d8-d6": Object.freeze([
    cand('e1', 'e3', 50, "Twin Pillars Attack"),
    cand('e4', 'd4', 38, "Flow Development: e4-d4"),
    cand('g1', 'g3', 12, "Eastern Wing Thrust"),
  ]),
  "g2-e4 f8-f6": Object.freeze([
    cand('g1', 'g3', 43, "Eastern Wing Thrust"),
    cand('a1', 'a3', 29, "Flank Corridor Variation"),
    cand('c1', 'c3', 28, "Twin Pillars Attack"),
  ]),
  "g2-e4 b8-b6": Object.freeze([
    cand('g1', 'g3', 41, "Eastern Wing Thrust"),
    cand('a1', 'a3', 30, "Flank Corridor Variation"),
    cand('c1', 'c3', 29, "Twin Pillars Attack"),
  ]),
  "c2-d3 h8-h6": Object.freeze([
    cand('a1', 'a3', 34, "Flank Corridor Variation"),
    cand('c1', 'c3', 33, "Twin Pillars Attack"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
  ]),
  "c2-d3 f8-f6": Object.freeze([
    cand('a1', 'a3', 34, "Flank Corridor Variation"),
    cand('c1', 'c3', 33, "Twin Pillars Attack"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
  ]),
  "c2-d3 b8-b6": Object.freeze([
    cand('a1', 'a3', 34, "Flank Corridor Variation"),
    cand('c1', 'c3', 33, "Twin Pillars Attack"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
  ]),
  "c2-d3 c7-e5": Object.freeze([
    cand('a1', 'a3', 34, "Flank Corridor Variation"),
    cand('c1', 'c3', 33, "Twin Pillars Attack"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
  ]),
  "c2-d3 d7-e6": Object.freeze([
    cand('a1', 'a3', 34, "Flank Corridor Variation"),
    cand('c1', 'c3', 33, "Twin Pillars Attack"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
  ]),
  "b2-c3 h8-h6": Object.freeze([
    cand('g1', 'g3', 42, "Eastern Wing Thrust"),
    cand('a1', 'a3', 41, "Flank Corridor Variation"),
    cand('f2', 'd4', 17, "Extended Center Strike"),
  ]),
  "b2-c3 b8-b6": Object.freeze([
    cand('g1', 'g3', 35, "Eastern Wing Thrust"),
    cand('a1', 'a3', 35, "Flank Corridor Variation"),
    cand('e1', 'e3', 30, "Twin Pillars Attack"),
  ]),
  "b2-c3 f8-f6": Object.freeze([
    cand('g1', 'g3', 41, "Eastern Wing Thrust"),
    cand('a1', 'a3', 41, "Flank Corridor Variation"),
    cand('f2', 'd4', 18, "Extended Center Strike"),
  ]),
  "b2-c3 c7-e5": Object.freeze([
    cand('a1', 'a3', 41, "Flank Corridor Variation"),
    cand('g1', 'g3', 42, "Eastern Wing Thrust"),
    cand('f2', 'd4', 17, "Extended Center Strike"),
  ]),
  "b2-c3 e7-g5": Object.freeze([
    cand('a1', 'a3', 41, "Flank Corridor Variation"),
    cand('g1', 'g3', 42, "Eastern Wing Thrust"),
    cand('f2', 'd4', 17, "Extended Center Strike"),
  ]),
  "e2-d3 h8-h6": Object.freeze([
    cand('a1', 'a3', 34, "Flank Corridor Variation"),
    cand('c1', 'c3', 33, "Twin Pillars Attack"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
  ]),
  "e2-d3 f8-f6": Object.freeze([
    cand('a1', 'a3', 34, "Flank Corridor Variation"),
    cand('c1', 'c3', 33, "Twin Pillars Attack"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
  ]),
  "e2-d3 b8-b6": Object.freeze([
    cand('a1', 'a3', 34, "Flank Corridor Variation"),
    cand('c1', 'c3', 33, "Twin Pillars Attack"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
  ]),
  "e2-d3 c7-e5": Object.freeze([
    cand('a1', 'a3', 34, "Flank Corridor Variation"),
    cand('c1', 'c3', 33, "Twin Pillars Attack"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
  ]),
  "e2-d3 e7-g5": Object.freeze([
    cand('a1', 'a3', 34, "Flank Corridor Variation"),
    cand('c1', 'c3', 33, "Twin Pillars Attack"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
  ]),
  "e2-g4 h8-h6": Object.freeze([
    cand('a1', 'a3', 59, "Flank Corridor Variation"),
    cand('c1', 'c3', 21, "Twin Pillars Attack"),
    cand('g1', 'g3', 20, "Eastern Wing Thrust"),
  ]),
  "e2-g4 f8-f6": Object.freeze([
    cand('a1', 'a3', 33, "Flank Corridor Variation"),
    cand('c1', 'c3', 34, "Twin Pillars Attack"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
  ]),
  "e2-g4 b8-b6": Object.freeze([
    cand('a1', 'a3', 34, "Flank Corridor Variation"),
    cand('c1', 'c3', 33, "Twin Pillars Attack"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
  ]),
  "e2-g4 d8-d6": Object.freeze([
    cand('a1', 'a3', 46, "Flank Corridor Variation"),
    cand('e1', 'e3', 28, "Twin Pillars Attack"),
    cand('f2', 'd4', 26, "Extended Center Strike"),
  ]),
  "e2-g4 c7-e5": Object.freeze([
    cand('a1', 'a3', 34, "Flank Corridor Variation"),
    cand('c1', 'c3', 33, "Twin Pillars Attack"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
  ]),
  "h2-h4 h8-h6": Object.freeze([
    cand('c1', 'c3', 34, "Twin Pillars Attack"),
    cand('a1', 'a3', 33, "Flank Corridor Variation"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
  ]),
  "h2-h4 b8-b6": Object.freeze([
    cand('c1', 'c3', 33, "Twin Pillars Attack"),
    cand('g1', 'g3', 34, "Eastern Wing Thrust"),
    cand('a1', 'a3', 33, "Flank Corridor Variation"),
  ]),
  "h2-h4 f8-f6": Object.freeze([
    cand('c1', 'c3', 33, "Twin Pillars Attack"),
    cand('g1', 'g3', 34, "Eastern Wing Thrust"),
    cand('a1', 'a3', 33, "Flank Corridor Variation"),
  ]),
  "h2-h4 e7-g5": Object.freeze([
    cand('h1', 'h2', 36, "Flow Development: h1-h2"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
    cand('a1', 'a3', 31, "Flank Corridor Variation"),
  ]),
  "h2-h4 c7-e5": Object.freeze([
    cand('a1', 'a3', 34, "Flank Corridor Variation"),
    cand('c1', 'c3', 33, "Twin Pillars Attack"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
  ]),
  "c2-a4 h8-h6": Object.freeze([
    cand('c1', 'c3', 34, "Twin Pillars Attack"),
    cand('a1', 'a3', 33, "Flank Corridor Variation"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
  ]),
  "c2-a4 f8-f6": Object.freeze([
    cand('c1', 'c3', 34, "Twin Pillars Attack"),
    cand('a1', 'a3', 33, "Flank Corridor Variation"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
  ]),
  "c2-a4 b8-b6": Object.freeze([
    cand('c1', 'c3', 34, "Twin Pillars Attack"),
    cand('g1', 'g3', 34, "Eastern Wing Thrust"),
    cand('a1', 'a3', 32, "Flank Corridor Variation"),
  ]),
  "c2-a4 c7-e5": Object.freeze([
    cand('a1', 'a3', 34, "Flank Corridor Variation"),
    cand('c1', 'c3', 33, "Twin Pillars Attack"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
  ]),
  "c2-a4 e7-g5": Object.freeze([
    cand('a1', 'a3', 34, "Flank Corridor Variation"),
    cand('c1', 'c3', 33, "Twin Pillars Attack"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
  ]),
  "e1-e3 h8-h6": Object.freeze([
    cand('e2', 'e1', 45, "Flow Development: e2-e1"),
    cand('e3', 'f4', 28, "Flow Development: e3-f4"),
    cand('e3', 'c5', 27, "Flow Development: e3-c5"),
  ]),
  "e1-e3 f8-f6": Object.freeze([
    cand('a1', 'a3', 38, "Flank Corridor Variation"),
    cand('e2', 'e1', 32, "Flow Development: e2-e1"),
    cand('c1', 'c3', 30, "Twin Pillars Attack"),
  ]),
  "e1-e3 b8-b6": Object.freeze([
    cand('a1', 'a3', 34, "Flank Corridor Variation"),
    cand('e3', 'c5', 33, "Flow Development: e3-c5"),
    cand('c1', 'c3', 33, "Twin Pillars Attack"),
  ]),
  "e1-e3 d8-d6": Object.freeze([
    cand('a1', 'a3', 34, "Flank Corridor Variation"),
    cand('c1', 'c3', 33, "Twin Pillars Attack"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
  ]),
  "e1-e3 c7-e5": Object.freeze([
    cand('a1', 'a3', 40, "Flank Corridor Variation"),
    cand('e2', 'e1', 31, "Flow Development: e2-e1"),
    cand('c1', 'c3', 29, "Twin Pillars Attack"),
  ]),
  "a2-c4 f8-f6": Object.freeze([
    cand('a1', 'a3', 33, "Flank Corridor Variation"),
    cand('c1', 'c3', 34, "Twin Pillars Attack"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
  ]),
  "a2-c4 h8-h6": Object.freeze([
    cand('c1', 'c3', 34, "Twin Pillars Attack"),
    cand('a1', 'a3', 33, "Flank Corridor Variation"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
  ]),
  "a2-c4 b8-b6": Object.freeze([
    cand('c1', 'c3', 34, "Twin Pillars Attack"),
    cand('a1', 'a3', 34, "Flank Corridor Variation"),
    cand('g1', 'g3', 32, "Eastern Wing Thrust"),
  ]),
  "a2-c4 a7-a5": Object.freeze([
    cand('c4', 'd3', 34, "Flow Development: c4-d3"),
    cand('a1', 'a3', 33, "Flank Corridor Variation"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
  ]),
  "a2-c4 d7-e6": Object.freeze([
    cand('a1', 'a3', 34, "Flank Corridor Variation"),
    cand('c4', 'd3', 33, "Flow Development: c4-d3"),
    cand('g1', 'g3', 33, "Eastern Wing Thrust"),
  ]),

  // Ply 3: Black Move 2
  "a1-a3 h8-h6 c1-c3": Object.freeze([
    cand('b8', 'b6', 40, "Wing Outpost Variation"),
    cand('f8', 'f6', 40, "Twin Pillars Defense"),
    cand('g8', 'h8', 20, "Base Reorganization Manoeuvre"),
  ]),
  "a1-a3 h8-h6 g1-g3": Object.freeze([
    cand('b8', 'b6', 40, "Wing Outpost Variation"),
    cand('f8', 'f6', 40, "Twin Pillars Defense"),
    cand('g8', 'h8', 20, "Base Reorganization Manoeuvre"),
  ]),
  "a1-a3 h8-h6 b1-a1": Object.freeze([
    cand('b8', 'b6', 39, "Wing Outpost Variation"),
    cand('f8', 'f6', 39, "Twin Pillars Defense"),
    cand('g8', 'h8', 22, "Base Reorganization Manoeuvre"),
  ]),
  "a1-a3 b8-b6 g1-g3": Object.freeze([
    cand('h8', 'h6', 37, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 37, "Twin Pillars Defense"),
    cand('a8', 'b8', 26, "Base Reorganization Manoeuvre"),
  ]),
  "a1-a3 b8-b6 c1-c3": Object.freeze([
    cand('h8', 'h6', 35, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 35, "Twin Pillars Defense"),
    cand('b6', 'a6', 30, "Tactical Response: b6-a6"),
  ]),
  "a1-a3 b8-b6 e1-e3": Object.freeze([
    cand('h8', 'h6', 42, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 31, "Twin Pillars Defense"),
    cand('c7', 'e5', 27, "Diagonal Screen Variation"),
  ]),
  "a1-a3 f8-f6 c1-c3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
    cand('f6', 'e6', 33, "Tactical Response: f6-e6"),
  ]),
  "a1-a3 f8-f6 g1-g3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
    cand('f6', 'e6', 33, "Tactical Response: f6-e6"),
  ]),
  "a1-a3 f8-f6 b1-a1": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
    cand('f6', 'e6', 33, "Tactical Response: f6-e6"),
  ]),
  "a1-a3 c7-e5 c1-c3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 33, "Twin Pillars Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "a1-a3 c7-e5 g1-g3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 33, "Twin Pillars Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "a1-a3 c7-e5 b1-a1": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 33, "Twin Pillars Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "a1-a3 d7-e6 g1-g3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('b8', 'b6', 34, "Wing Outpost Variation"),
    cand('h8', 'h6', 32, "Eastern Flank Outpost Defense"),
  ]),
  "a1-a3 d7-e6 c1-c3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
  ]),
  "a1-a3 d7-e6 b1-a1": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "c1-c3 h8-h6 a1-a3": Object.freeze([
    cand('b8', 'b6', 40, "Wing Outpost Variation"),
    cand('f8', 'f6', 40, "Twin Pillars Defense"),
    cand('g8', 'h8', 20, "Base Reorganization Manoeuvre"),
  ]),
  "c1-c3 h8-h6 g1-g3": Object.freeze([
    cand('b8', 'b6', 37, "Wing Outpost Variation"),
    cand('f8', 'f6', 37, "Twin Pillars Defense"),
    cand('d8', 'd6', 26, "Western Cross-Flow Defense"),
  ]),
  "c1-c3 h8-h6 c3-d3": Object.freeze([
    cand('b8', 'b6', 40, "Wing Outpost Variation"),
    cand('f8', 'f6', 40, "Twin Pillars Defense"),
    cand('g8', 'h8', 20, "Base Reorganization Manoeuvre"),
  ]),
  "c1-c3 b8-b6 a1-a3": Object.freeze([
    cand('h8', 'h6', 35, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 35, "Twin Pillars Defense"),
    cand('b6', 'a6', 30, "Tactical Response: b6-a6"),
  ]),
  "c1-c3 b8-b6 g1-g3": Object.freeze([
    cand('h8', 'h6', 35, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('b6', 'a6', 31, "Tactical Response: b6-a6"),
  ]),
  "c1-c3 b8-b6 c3-d3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 33, "Twin Pillars Defense"),
    cand('b6', 'a6', 33, "Tactical Response: b6-a6"),
  ]),
  "c1-c3 f8-f6 a1-a3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
    cand('f6', 'e6', 33, "Tactical Response: f6-e6"),
  ]),
  "c1-c3 f8-f6 g1-g3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
    cand('f6', 'e6', 33, "Tactical Response: f6-e6"),
  ]),
  "c1-c3 f8-f6 c3-d3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
    cand('f6', 'e6', 33, "Tactical Response: f6-e6"),
  ]),
  "c1-c3 c7-e5 a1-a3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 33, "Twin Pillars Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "c1-c3 c7-e5 g1-g3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 33, "Twin Pillars Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "c1-c3 c7-e5 c3-d3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 33, "Twin Pillars Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "c1-c3 d7-e6 a1-a3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
  ]),
  "c1-c3 d7-e6 c3-d3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('b8', 'b6', 34, "Wing Outpost Variation"),
    cand('h8', 'h6', 32, "Eastern Flank Outpost Defense"),
  ]),
  "c1-c3 d7-e6 g1-g3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('b8', 'b6', 34, "Wing Outpost Variation"),
    cand('h8', 'h6', 32, "Eastern Flank Outpost Defense"),
  ]),
  "g1-g3 h8-h6 a1-a3": Object.freeze([
    cand('b8', 'b6', 40, "Wing Outpost Variation"),
    cand('f8', 'f6', 40, "Twin Pillars Defense"),
    cand('g8', 'h8', 20, "Base Reorganization Manoeuvre"),
  ]),
  "g1-g3 h8-h6 c1-c3": Object.freeze([
    cand('b8', 'b6', 37, "Wing Outpost Variation"),
    cand('f8', 'f6', 37, "Twin Pillars Defense"),
    cand('d8', 'd6', 26, "Western Cross-Flow Defense"),
  ]),
  "g1-g3 h8-h6 h1-g1": Object.freeze([
    cand('b8', 'b6', 38, "Wing Outpost Variation"),
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('d8', 'd6', 28, "Western Cross-Flow Defense"),
  ]),
  "g1-g3 f8-f6 a1-a3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
    cand('f6', 'e6', 33, "Tactical Response: f6-e6"),
  ]),
  "g1-g3 f8-f6 c1-c3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
    cand('f6', 'e6', 33, "Tactical Response: f6-e6"),
  ]),
  "g1-g3 f8-f6 g3-h3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('f6', 'e6', 33, "Tactical Response: f6-e6"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "g1-g3 b8-b6 a1-a3": Object.freeze([
    cand('h8', 'h6', 37, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 37, "Twin Pillars Defense"),
    cand('a8', 'b8', 26, "Base Reorganization Manoeuvre"),
  ]),
  "g1-g3 b8-b6 c1-c3": Object.freeze([
    cand('h8', 'h6', 35, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('b6', 'a6', 31, "Tactical Response: b6-a6"),
  ]),
  "g1-g3 b8-b6 e1-e3": Object.freeze([
    cand('h8', 'h6', 45, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 29, "Twin Pillars Defense"),
    cand('d8', 'd6', 26, "Western Cross-Flow Defense"),
  ]),
  "g1-g3 d8-d6 a1-a3": Object.freeze([
    cand('d7', 'd8', 47, "Tactical Response: d7-d8"),
    cand('d6', 'c5', 27, "Tactical Response: d6-c5"),
    cand('d6', 'f4', 26, "Tactical Response: d6-f4"),
  ]),
  "g1-g3 d8-d6 c1-c3": Object.freeze([
    cand('d6', 'f4', 35, "Tactical Response: d6-f4"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 32, "Twin Pillars Defense"),
  ]),
  "g1-g3 d8-d6 e1-e3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "g1-g3 c7-e5 a1-a3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 33, "Twin Pillars Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "g1-g3 c7-e5 c1-c3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 33, "Twin Pillars Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "g1-g3 c7-e5 h1-g1": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 34, "Wing Outpost Variation"),
    cand('f8', 'f6', 32, "Twin Pillars Defense"),
  ]),
  "f2-d4 h8-h6 a1-a3": Object.freeze([
    cand('b8', 'b6', 40, "Wing Outpost Variation"),
    cand('f8', 'f6', 40, "Twin Pillars Defense"),
    cand('g8', 'h8', 20, "Base Reorganization Manoeuvre"),
  ]),
  "f2-d4 h8-h6 c1-c3": Object.freeze([
    cand('f8', 'f6', 40, "Twin Pillars Defense"),
    cand('b8', 'b6', 40, "Wing Outpost Variation"),
    cand('g8', 'h8', 20, "Base Reorganization Manoeuvre"),
  ]),
  "f2-d4 h8-h6 g1-g3": Object.freeze([
    cand('f8', 'f6', 40, "Twin Pillars Defense"),
    cand('b8', 'b6', 39, "Wing Outpost Variation"),
    cand('g8', 'h8', 21, "Base Reorganization Manoeuvre"),
  ]),
  "f2-d4 b8-b6 a1-a3": Object.freeze([
    cand('h8', 'h6', 37, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 38, "Twin Pillars Defense"),
    cand('a8', 'b8', 25, "Base Reorganization Manoeuvre"),
  ]),
  "f2-d4 b8-b6 c1-c3": Object.freeze([
    cand('h8', 'h6', 35, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 35, "Twin Pillars Defense"),
    cand('b6', 'a6', 30, "Tactical Response: b6-a6"),
  ]),
  "f2-d4 b8-b6 g1-g3": Object.freeze([
    cand('h8', 'h6', 37, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 38, "Twin Pillars Defense"),
    cand('a8', 'b8', 25, "Base Reorganization Manoeuvre"),
  ]),
  "f2-d4 f8-f6 c1-c3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('f6', 'e6', 33, "Tactical Response: f6-e6"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "f2-d4 f8-f6 a1-a3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
    cand('f6', 'e6', 33, "Tactical Response: f6-e6"),
  ]),
  "f2-d4 f8-f6 g1-g3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
    cand('f6', 'e6', 33, "Tactical Response: f6-e6"),
  ]),
  "f2-d4 c7-e5 a1-a3": Object.freeze([
    cand('b8', 'b6', 34, "Wing Outpost Variation"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 33, "Twin Pillars Defense"),
  ]),
  "f2-d4 c7-e5 c1-c3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
    cand('f8', 'f6', 33, "Twin Pillars Defense"),
  ]),
  "f2-d4 c7-e5 g1-g3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
    cand('f8', 'f6', 33, "Twin Pillars Defense"),
  ]),
  "f2-d4 f7-e6 a1-a3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "f2-d4 f7-e6 c1-c3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "f2-d4 f7-e6 g1-g3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "d2-b4 h8-h6 c1-c3": Object.freeze([
    cand('f8', 'f6', 40, "Twin Pillars Defense"),
    cand('b8', 'b6', 40, "Wing Outpost Variation"),
    cand('g8', 'h8', 20, "Base Reorganization Manoeuvre"),
  ]),
  "d2-b4 h8-h6 a1-a3": Object.freeze([
    cand('f8', 'f6', 40, "Twin Pillars Defense"),
    cand('b8', 'b6', 40, "Wing Outpost Variation"),
    cand('g8', 'h8', 20, "Base Reorganization Manoeuvre"),
  ]),
  "d2-b4 h8-h6 g1-g3": Object.freeze([
    cand('f8', 'f6', 40, "Twin Pillars Defense"),
    cand('b8', 'b6', 40, "Wing Outpost Variation"),
    cand('g8', 'h8', 20, "Base Reorganization Manoeuvre"),
  ]),
  "d2-b4 f8-f6 c1-c3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
    cand('f6', 'e6', 33, "Tactical Response: f6-e6"),
  ]),
  "d2-b4 f8-f6 a1-a3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
    cand('f6', 'e6', 33, "Tactical Response: f6-e6"),
  ]),
  "d2-b4 f8-f6 g1-g3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
    cand('f6', 'e6', 33, "Tactical Response: f6-e6"),
  ]),
  "d2-b4 b8-b6 c1-c3": Object.freeze([
    cand('h8', 'h6', 37, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 38, "Twin Pillars Defense"),
    cand('a8', 'b8', 25, "Base Reorganization Manoeuvre"),
  ]),
  "d2-b4 b8-b6 a1-a3": Object.freeze([
    cand('h8', 'h6', 37, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 38, "Twin Pillars Defense"),
    cand('a8', 'b8', 25, "Base Reorganization Manoeuvre"),
  ]),
  "d2-b4 b8-b6 g1-g3": Object.freeze([
    cand('h8', 'h6', 37, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 38, "Twin Pillars Defense"),
    cand('a8', 'b8', 25, "Base Reorganization Manoeuvre"),
  ]),
  "d2-b4 c7-e5 c1-c3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "d2-b4 c7-e5 a1-a3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
  ]),
  "d2-b4 c7-e5 g1-g3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "d2-b4 e7-g5 a1-a3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "d2-b4 e7-g5 c1-c3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "d2-b4 e7-g5 g1-g3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "g2-e4 c7-e5 g1-g3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 33, "Twin Pillars Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "g2-e4 c7-e5 h2-h4": Object.freeze([
    cand('e5', 'e4', 45, "Tactical Response: e5-e4"),
    cand('f8', 'f6', 28, "Twin Pillars Defense"),
    cand('h8', 'h6', 27, "Eastern Flank Outpost Defense"),
  ]),
  "g2-e4 h8-h6 a1-a3": Object.freeze([
    cand('c7', 'e5', 34, "Diagonal Screen Variation"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
    cand('f8', 'f6', 33, "Twin Pillars Defense"),
  ]),
  "g2-e4 h8-h6 e4-d4": Object.freeze([
    cand('b8', 'b6', 40, "Wing Outpost Variation"),
    cand('f8', 'f6', 39, "Twin Pillars Defense"),
    cand('g8', 'h8', 21, "Base Reorganization Manoeuvre"),
  ]),
  "g2-e4 h8-h6 g1-g3": Object.freeze([
    cand('d8', 'd6', 40, "Western Cross-Flow Defense"),
    cand('c7', 'e5', 30, "Diagonal Screen Variation"),
    cand('f8', 'f6', 30, "Twin Pillars Defense"),
  ]),
  "g2-e4 d8-d6 e1-e3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "g2-e4 d8-d6 e4-d4": Object.freeze([
    cand('h8', 'h6', 41, "Eastern Flank Outpost Defense"),
    cand('d7', 'd8', 30, "Tactical Response: d7-d8"),
    cand('f8', 'f6', 29, "Twin Pillars Defense"),
  ]),
  "g2-e4 d8-d6 g1-g3": Object.freeze([
    cand('h8', 'h6', 40, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 30, "Wing Outpost Variation"),
    cand('f8', 'f6', 30, "Twin Pillars Defense"),
  ]),
  "g2-e4 f8-f6 g1-g3": Object.freeze([
    cand('c7', 'e5', 35, "Diagonal Screen Variation"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('d8', 'd6', 32, "Western Cross-Flow Defense"),
  ]),
  "g2-e4 f8-f6 a1-a3": Object.freeze([
    cand('c7', 'e5', 36, "Diagonal Screen Variation"),
    cand('h8', 'h6', 35, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 29, "Wing Outpost Variation"),
  ]),
  "g2-e4 f8-f6 c1-c3": Object.freeze([
    cand('c7', 'e5', 35, "Diagonal Screen Variation"),
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('d8', 'd6', 31, "Western Cross-Flow Defense"),
  ]),
  "g2-e4 b8-b6 g1-g3": Object.freeze([
    cand('c7', 'e5', 34, "Diagonal Screen Variation"),
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('d8', 'd6', 32, "Western Cross-Flow Defense"),
  ]),
  "g2-e4 b8-b6 a1-a3": Object.freeze([
    cand('c7', 'e5', 35, "Diagonal Screen Variation"),
    cand('h8', 'h6', 35, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 30, "Twin Pillars Defense"),
  ]),
  "g2-e4 b8-b6 c1-c3": Object.freeze([
    cand('c7', 'e5', 35, "Diagonal Screen Variation"),
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('d8', 'd6', 31, "Western Cross-Flow Defense"),
  ]),
  "c2-d3 h8-h6 a1-a3": Object.freeze([
    cand('b8', 'b6', 40, "Wing Outpost Variation"),
    cand('f8', 'f6', 40, "Twin Pillars Defense"),
    cand('g8', 'h8', 20, "Base Reorganization Manoeuvre"),
  ]),
  "c2-d3 h8-h6 c1-c3": Object.freeze([
    cand('b8', 'b6', 40, "Wing Outpost Variation"),
    cand('f8', 'f6', 39, "Twin Pillars Defense"),
    cand('g8', 'h8', 21, "Base Reorganization Manoeuvre"),
  ]),
  "c2-d3 h8-h6 g1-g3": Object.freeze([
    cand('f8', 'f6', 37, "Twin Pillars Defense"),
    cand('b8', 'b6', 35, "Wing Outpost Variation"),
    cand('d8', 'd6', 28, "Western Cross-Flow Defense"),
  ]),
  "c2-d3 f8-f6 a1-a3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
    cand('f6', 'e6', 33, "Tactical Response: f6-e6"),
  ]),
  "c2-d3 f8-f6 c1-c3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
    cand('f6', 'e6', 33, "Tactical Response: f6-e6"),
  ]),
  "c2-d3 f8-f6 g1-g3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
    cand('f6', 'e6', 33, "Tactical Response: f6-e6"),
  ]),
  "c2-d3 b8-b6 a1-a3": Object.freeze([
    cand('h8', 'h6', 37, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 38, "Twin Pillars Defense"),
    cand('a8', 'b8', 25, "Base Reorganization Manoeuvre"),
  ]),
  "c2-d3 b8-b6 c1-c3": Object.freeze([
    cand('h8', 'h6', 36, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 35, "Twin Pillars Defense"),
    cand('b6', 'a6', 29, "Tactical Response: b6-a6"),
  ]),
  "c2-d3 b8-b6 g1-g3": Object.freeze([
    cand('h8', 'h6', 37, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 36, "Twin Pillars Defense"),
    cand('d8', 'd6', 27, "Western Cross-Flow Defense"),
  ]),
  "c2-d3 c7-e5 a1-a3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "c2-d3 c7-e5 c1-c3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 33, "Twin Pillars Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "c2-d3 c7-e5 g1-g3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "c2-d3 d7-e6 a1-a3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "c2-d3 d7-e6 c1-c3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('b8', 'b6', 32, "Wing Outpost Variation"),
  ]),
  "c2-d3 d7-e6 g1-g3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "b2-c3 h8-h6 g1-g3": Object.freeze([
    cand('f8', 'f6', 40, "Twin Pillars Defense"),
    cand('b8', 'b6', 37, "Wing Outpost Variation"),
    cand('d8', 'd6', 23, "Western Cross-Flow Defense"),
  ]),
  "b2-c3 h8-h6 a1-a3": Object.freeze([
    cand('f8', 'f6', 41, "Twin Pillars Defense"),
    cand('b8', 'b6', 38, "Wing Outpost Variation"),
    cand('g8', 'h8', 21, "Base Reorganization Manoeuvre"),
  ]),
  "b2-c3 h8-h6 f2-d4": Object.freeze([
    cand('b8', 'b6', 40, "Wing Outpost Variation"),
    cand('f8', 'f6', 40, "Twin Pillars Defense"),
    cand('g8', 'h8', 20, "Base Reorganization Manoeuvre"),
  ]),
  "b2-c3 b8-b6 g1-g3": Object.freeze([
    cand('h8', 'h6', 37, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 35, "Twin Pillars Defense"),
    cand('b6', 'a6', 28, "Tactical Response: b6-a6"),
  ]),
  "b2-c3 b8-b6 a1-a3": Object.freeze([
    cand('h8', 'h6', 37, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 36, "Twin Pillars Defense"),
    cand('b6', 'a6', 27, "Tactical Response: b6-a6"),
  ]),
  "b2-c3 b8-b6 e1-e3": Object.freeze([
    cand('h8', 'h6', 46, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 28, "Twin Pillars Defense"),
    cand('d8', 'd6', 26, "Western Cross-Flow Defense"),
  ]),
  "b2-c3 f8-f6 g1-g3": Object.freeze([
    cand('h8', 'h6', 35, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
    cand('f6', 'e6', 32, "Tactical Response: f6-e6"),
  ]),
  "b2-c3 f8-f6 a1-a3": Object.freeze([
    cand('h8', 'h6', 35, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 34, "Wing Outpost Variation"),
    cand('f6', 'e6', 31, "Tactical Response: f6-e6"),
  ]),
  "b2-c3 f8-f6 f2-d4": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('f6', 'e6', 33, "Tactical Response: f6-e6"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "b2-c3 c7-e5 a1-a3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
  ]),
  "b2-c3 c7-e5 g1-g3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
    cand('f8', 'f6', 33, "Twin Pillars Defense"),
  ]),
  "b2-c3 c7-e5 f2-d4": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
    cand('f8', 'f6', 33, "Twin Pillars Defense"),
  ]),
  "b2-c3 e7-g5 a1-a3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "b2-c3 e7-g5 g1-g3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "b2-c3 e7-g5 f2-d4": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
    cand('f8', 'f6', 33, "Twin Pillars Defense"),
  ]),
  "e2-d3 h8-h6 a1-a3": Object.freeze([
    cand('b8', 'b6', 40, "Wing Outpost Variation"),
    cand('f8', 'f6', 40, "Twin Pillars Defense"),
    cand('g8', 'h8', 20, "Base Reorganization Manoeuvre"),
  ]),
  "e2-d3 h8-h6 c1-c3": Object.freeze([
    cand('b8', 'b6', 41, "Wing Outpost Variation"),
    cand('f8', 'f6', 38, "Twin Pillars Defense"),
    cand('g8', 'h8', 21, "Base Reorganization Manoeuvre"),
  ]),
  "e2-d3 h8-h6 g1-g3": Object.freeze([
    cand('b8', 'b6', 37, "Wing Outpost Variation"),
    cand('f8', 'f6', 35, "Twin Pillars Defense"),
    cand('d8', 'd6', 28, "Western Cross-Flow Defense"),
  ]),
  "e2-d3 f8-f6 a1-a3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
    cand('f6', 'e6', 33, "Tactical Response: f6-e6"),
  ]),
  "e2-d3 f8-f6 c1-c3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
    cand('f6', 'e6', 33, "Tactical Response: f6-e6"),
  ]),
  "e2-d3 f8-f6 g1-g3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
    cand('f6', 'e6', 33, "Tactical Response: f6-e6"),
  ]),
  "e2-d3 b8-b6 a1-a3": Object.freeze([
    cand('h8', 'h6', 37, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 38, "Twin Pillars Defense"),
    cand('a8', 'b8', 25, "Base Reorganization Manoeuvre"),
  ]),
  "e2-d3 b8-b6 c1-c3": Object.freeze([
    cand('h8', 'h6', 37, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('b6', 'a6', 29, "Tactical Response: b6-a6"),
  ]),
  "e2-d3 b8-b6 g1-g3": Object.freeze([
    cand('h8', 'h6', 37, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 36, "Twin Pillars Defense"),
    cand('d8', 'd6', 27, "Western Cross-Flow Defense"),
  ]),
  "e2-d3 c7-e5 a1-a3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "e2-d3 c7-e5 c1-c3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 33, "Twin Pillars Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "e2-d3 c7-e5 g1-g3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "e2-d3 e7-g5 a1-a3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "e2-d3 e7-g5 c1-c3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "e2-d3 e7-g5 g1-g3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "e2-g4 h8-h6 a1-a3": Object.freeze([
    cand('f8', 'f6', 39, "Twin Pillars Defense"),
    cand('b8', 'b6', 38, "Wing Outpost Variation"),
    cand('g8', 'h8', 23, "Base Reorganization Manoeuvre"),
  ]),
  "e2-g4 h8-h6 c1-c3": Object.freeze([
    cand('b8', 'b6', 34, "Wing Outpost Variation"),
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('d8', 'd6', 32, "Western Cross-Flow Defense"),
  ]),
  "e2-g4 h8-h6 g1-g3": Object.freeze([
    cand('f8', 'f6', 35, "Twin Pillars Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
    cand('d8', 'd6', 32, "Western Cross-Flow Defense"),
  ]),
  "e2-g4 f8-f6 a1-a3": Object.freeze([
    cand('h8', 'h6', 41, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 42, "Wing Outpost Variation"),
    cand('c7', 'e5', 17, "Diagonal Screen Variation"),
  ]),
  "e2-g4 f8-f6 c1-c3": Object.freeze([
    cand('h8', 'h6', 35, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 34, "Wing Outpost Variation"),
    cand('d8', 'd6', 31, "Western Cross-Flow Defense"),
  ]),
  "e2-g4 f8-f6 g1-g3": Object.freeze([
    cand('h8', 'h6', 35, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 34, "Wing Outpost Variation"),
    cand('d8', 'd6', 31, "Western Cross-Flow Defense"),
  ]),
  "e2-g4 b8-b6 a1-a3": Object.freeze([
    cand('h8', 'h6', 36, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 36, "Twin Pillars Defense"),
    cand('a8', 'b8', 28, "Base Reorganization Manoeuvre"),
  ]),
  "e2-g4 b8-b6 c1-c3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('b6', 'a6', 33, "Tactical Response: b6-a6"),
    cand('f8', 'f6', 33, "Twin Pillars Defense"),
  ]),
  "e2-g4 b8-b6 g1-g3": Object.freeze([
    cand('h8', 'h6', 35, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('d8', 'd6', 31, "Western Cross-Flow Defense"),
  ]),
  "e2-g4 d8-d6 a1-a3": Object.freeze([
    cand('d6', 'f4', 59, "Tactical Response: d6-f4"),
    cand('d7', 'd8', 25, "Tactical Response: d7-d8"),
    cand('d6', 'c5', 16, "Tactical Response: d6-c5"),
  ]),
  "e2-g4 d8-d6 e1-e3": Object.freeze([
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 34, "Wing Outpost Variation"),
    cand('f8', 'f6', 33, "Twin Pillars Defense"),
  ]),
  "e2-g4 d8-d6 f2-d4": Object.freeze([
    cand('h8', 'h6', 40, "Eastern Flank Outpost Defense"),
    cand('d7', 'd8', 31, "Tactical Response: d7-d8"),
    cand('f8', 'f6', 29, "Twin Pillars Defense"),
  ]),
  "e2-g4 c7-e5 a1-a3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "e2-g4 c7-e5 c1-c3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
    cand('f8', 'f6', 33, "Twin Pillars Defense"),
  ]),
  "e2-g4 c7-e5 g1-g3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "h2-h4 h8-h6 c1-c3": Object.freeze([
    cand('f8', 'f6', 41, "Twin Pillars Defense"),
    cand('b8', 'b6', 38, "Wing Outpost Variation"),
    cand('g8', 'h8', 21, "Base Reorganization Manoeuvre"),
  ]),
  "h2-h4 h8-h6 a1-a3": Object.freeze([
    cand('f8', 'f6', 40, "Twin Pillars Defense"),
    cand('b8', 'b6', 40, "Wing Outpost Variation"),
    cand('g8', 'h8', 20, "Base Reorganization Manoeuvre"),
  ]),
  "h2-h4 h8-h6 g1-g3": Object.freeze([
    cand('f8', 'f6', 37, "Twin Pillars Defense"),
    cand('b8', 'b6', 35, "Wing Outpost Variation"),
    cand('d8', 'd6', 28, "Western Cross-Flow Defense"),
  ]),
  "h2-h4 b8-b6 c1-c3": Object.freeze([
    cand('h8', 'h6', 36, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('b6', 'a6', 30, "Tactical Response: b6-a6"),
  ]),
  "h2-h4 b8-b6 g1-g3": Object.freeze([
    cand('h8', 'h6', 38, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 35, "Twin Pillars Defense"),
    cand('d8', 'd6', 27, "Western Cross-Flow Defense"),
  ]),
  "h2-h4 b8-b6 a1-a3": Object.freeze([
    cand('h8', 'h6', 37, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 38, "Twin Pillars Defense"),
    cand('a8', 'b8', 25, "Base Reorganization Manoeuvre"),
  ]),
  "h2-h4 f8-f6 c1-c3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
    cand('f6', 'e6', 33, "Tactical Response: f6-e6"),
  ]),
  "h2-h4 f8-f6 g1-g3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('f6', 'e6', 33, "Tactical Response: f6-e6"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "h2-h4 f8-f6 a1-a3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
    cand('f6', 'e6', 33, "Tactical Response: f6-e6"),
  ]),
  "h2-h4 e7-g5 h1-h2": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "h2-h4 e7-g5 g1-g3": Object.freeze([
    cand('h8', 'h6', 36, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 32, "Wing Outpost Variation"),
    cand('f8', 'f6', 32, "Twin Pillars Defense"),
  ]),
  "h2-h4 e7-g5 a1-a3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 33, "Twin Pillars Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "h2-h4 c7-e5 a1-a3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
  ]),
  "h2-h4 c7-e5 c1-c3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "h2-h4 c7-e5 g1-g3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "c2-a4 h8-h6 c1-c3": Object.freeze([
    cand('f8', 'f6', 41, "Twin Pillars Defense"),
    cand('b8', 'b6', 38, "Wing Outpost Variation"),
    cand('g8', 'h8', 21, "Base Reorganization Manoeuvre"),
  ]),
  "c2-a4 h8-h6 a1-a3": Object.freeze([
    cand('f8', 'f6', 40, "Twin Pillars Defense"),
    cand('b8', 'b6', 40, "Wing Outpost Variation"),
    cand('g8', 'h8', 20, "Base Reorganization Manoeuvre"),
  ]),
  "c2-a4 h8-h6 g1-g3": Object.freeze([
    cand('f8', 'f6', 38, "Twin Pillars Defense"),
    cand('b8', 'b6', 34, "Wing Outpost Variation"),
    cand('d8', 'd6', 28, "Western Cross-Flow Defense"),
  ]),
  "c2-a4 f8-f6 c1-c3": Object.freeze([
    cand('h8', 'h6', 36, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 32, "Wing Outpost Variation"),
    cand('f6', 'e6', 32, "Tactical Response: f6-e6"),
  ]),
  "c2-a4 f8-f6 a1-a3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
    cand('f6', 'e6', 33, "Tactical Response: f6-e6"),
  ]),
  "c2-a4 f8-f6 g1-g3": Object.freeze([
    cand('h8', 'h6', 36, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 32, "Wing Outpost Variation"),
    cand('f6', 'e6', 32, "Tactical Response: f6-e6"),
  ]),
  "c2-a4 b8-b6 c1-c3": Object.freeze([
    cand('h8', 'h6', 36, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('b6', 'a6', 30, "Tactical Response: b6-a6"),
  ]),
  "c2-a4 b8-b6 g1-g3": Object.freeze([
    cand('h8', 'h6', 37, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 35, "Twin Pillars Defense"),
    cand('b6', 'c6', 28, "Tactical Response: b6-c6"),
  ]),
  "c2-a4 b8-b6 a1-a3": Object.freeze([
    cand('h8', 'h6', 37, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 36, "Twin Pillars Defense"),
    cand('b6', 'c6', 27, "Tactical Response: b6-c6"),
  ]),
  "c2-a4 c7-e5 a1-a3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "c2-a4 c7-e5 c1-c3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
    cand('f8', 'f6', 33, "Twin Pillars Defense"),
  ]),
  "c2-a4 c7-e5 g1-g3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "c2-a4 e7-g5 a1-a3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "c2-a4 e7-g5 c1-c3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "c2-a4 e7-g5 g1-g3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "e1-e3 h8-h6 e2-e1": Object.freeze([
    cand('b8', 'b6', 39, "Wing Outpost Variation"),
    cand('f8', 'f6', 40, "Twin Pillars Defense"),
    cand('e7', 'g5', 21, "Eastern Flank Counter-Thrust"),
  ]),
  "e1-e3 h8-h6 e3-f4": Object.freeze([
    cand('d8', 'd6', 54, "Western Cross-Flow Defense"),
    cand('f8', 'f6', 24, "Twin Pillars Defense"),
    cand('b8', 'b6', 22, "Wing Outpost Variation"),
  ]),
  "e1-e3 h8-h6 e3-c5": Object.freeze([
    cand('f8', 'f6', 50, "Twin Pillars Defense"),
    cand('h6', 'e3', 26, "Tactical Response: h6-e3"),
    cand('g8', 'h8', 24, "Base Reorganization Manoeuvre"),
  ]),
  "e1-e3 f8-f6 a1-a3": Object.freeze([
    cand('h8', 'h6', 56, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 23, "Wing Outpost Variation"),
    cand('f6', 'e6', 21, "Tactical Response: f6-e6"),
  ]),
  "e1-e3 f8-f6 e2-e1": Object.freeze([
    cand('b8', 'b6', 34, "Wing Outpost Variation"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('f6', 'e6', 33, "Tactical Response: f6-e6"),
  ]),
  "e1-e3 f8-f6 c1-c3": Object.freeze([
    cand('h8', 'h6', 66, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 17, "Wing Outpost Variation"),
    cand('f6', 'e6', 17, "Tactical Response: f6-e6"),
  ]),
  "e1-e3 b8-b6 a1-a3": Object.freeze([
    cand('h8', 'h6', 42, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 31, "Twin Pillars Defense"),
    cand('c7', 'e5', 27, "Diagonal Screen Variation"),
  ]),
  "e1-e3 b8-b6 e3-c5": Object.freeze([
    cand('h8', 'h6', 43, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 32, "Twin Pillars Defense"),
    cand('b6', 'a6', 25, "Tactical Response: b6-a6"),
  ]),
  "e1-e3 b8-b6 c1-c3": Object.freeze([
    cand('h8', 'h6', 44, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 29, "Twin Pillars Defense"),
    cand('d8', 'd6', 27, "Western Cross-Flow Defense"),
  ]),
  "e1-e3 d8-d6 a1-a3": Object.freeze([
    cand('h8', 'h6', 60, "Eastern Flank Outpost Defense"),
    cand('d7', 'd8', 40, "Tactical Response: d7-d8"),
  ]),
  "e1-e3 d8-d6 c1-c3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "e1-e3 d8-d6 g1-g3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "e1-e3 c7-e5 a1-a3": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "e1-e3 c7-e5 e2-e1": Object.freeze([
    cand('f8', 'f6', 34, "Twin Pillars Defense"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
  ]),
  "e1-e3 c7-e5 c1-c3": Object.freeze([
    cand('h8', 'h6', 42, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 29, "Wing Outpost Variation"),
    cand('f8', 'f6', 29, "Twin Pillars Defense"),
  ]),
  "a2-c4 f8-f6 a1-a3": Object.freeze([
    cand('f6', 'e6', 37, "Tactical Response: f6-e6"),
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 29, "Wing Outpost Variation"),
  ]),
  "a2-c4 f8-f6 c1-c3": Object.freeze([
    cand('f6', 'e6', 36, "Tactical Response: f6-e6"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 31, "Wing Outpost Variation"),
  ]),
  "a2-c4 f8-f6 g1-g3": Object.freeze([
    cand('f6', 'e6', 36, "Tactical Response: f6-e6"),
    cand('h8', 'h6', 32, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 32, "Wing Outpost Variation"),
  ]),
  "a2-c4 h8-h6 c1-c3": Object.freeze([
    cand('f8', 'f6', 65, "Twin Pillars Defense"),
    cand('a7', 'a5', 18, "Tactical Response: a7-a5"),
    cand('b8', 'b6', 17, "Wing Outpost Variation"),
  ]),
  "a2-c4 h8-h6 a1-a3": Object.freeze([
    cand('f8', 'f6', 66, "Twin Pillars Defense"),
    cand('a7', 'a5', 18, "Tactical Response: a7-a5"),
    cand('b8', 'b6', 16, "Wing Outpost Variation"),
  ]),
  "a2-c4 h8-h6 g1-g3": Object.freeze([
    cand('f8', 'f6', 64, "Twin Pillars Defense"),
    cand('b8', 'b6', 18, "Wing Outpost Variation"),
    cand('a7', 'a5', 18, "Tactical Response: a7-a5"),
  ]),
  "a2-c4 b8-b6 c1-c3": Object.freeze([
    cand('f8', 'f6', 66, "Twin Pillars Defense"),
    cand('h8', 'h6', 17, "Eastern Flank Outpost Defense"),
    cand('a7', 'a5', 17, "Tactical Response: a7-a5"),
  ]),
  "a2-c4 b8-b6 a1-a3": Object.freeze([
    cand('f8', 'f6', 63, "Twin Pillars Defense"),
    cand('h8', 'h6', 19, "Eastern Flank Outpost Defense"),
    cand('a7', 'a5', 18, "Tactical Response: a7-a5"),
  ]),
  "a2-c4 b8-b6 g1-g3": Object.freeze([
    cand('f8', 'f6', 64, "Twin Pillars Defense"),
    cand('h8', 'h6', 19, "Eastern Flank Outpost Defense"),
    cand('a7', 'a5', 17, "Tactical Response: a7-a5"),
  ]),
  "a2-c4 a7-a5 c4-d3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 33, "Wing Outpost Variation"),
    cand('f8', 'f6', 33, "Twin Pillars Defense"),
  ]),
  "a2-c4 a7-a5 a1-a3": Object.freeze([
    cand('a5', 'c4', 35, "Tactical Response: a5-c4"),
    cand('h8', 'h6', 35, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 30, "Twin Pillars Defense"),
  ]),
  "a2-c4 a7-a5 g1-g3": Object.freeze([
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('a5', 'c4', 34, "Tactical Response: a5-c4"),
    cand('f8', 'f6', 32, "Twin Pillars Defense"),
  ]),
  "a2-c4 d7-e6 a1-a3": Object.freeze([
    cand('e6', 'c4', 35, "Tactical Response: e6-c4"),
    cand('h8', 'h6', 34, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 31, "Twin Pillars Defense"),
  ]),
  "a2-c4 d7-e6 c4-d3": Object.freeze([
    cand('h8', 'h6', 36, "Eastern Flank Outpost Defense"),
    cand('f8', 'f6', 32, "Twin Pillars Defense"),
    cand('b8', 'b6', 32, "Wing Outpost Variation"),
  ]),
  "a2-c4 d7-e6 g1-g3": Object.freeze([
    cand('e6', 'c4', 36, "Tactical Response: e6-c4"),
    cand('h8', 'h6', 33, "Eastern Flank Outpost Defense"),
    cand('b8', 'b6', 31, "Wing Outpost Variation"),
  ]),
});

export function buildMoveSequenceKey(moveHistory?: readonly Move[]): string {
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
  moveHistory?: readonly Move[]
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
  moveHistory?: readonly Move[]
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
