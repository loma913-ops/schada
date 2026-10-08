import { describe, it, expect } from 'vitest';
import { createInitialGameState, executeMove, getLegalMovesForSquare } from '../../schada/engine';
import type { Square } from '../../schada/types';
import {
  getOpeningBookMove,
  shouldTierUseOpeningBook,
  buildMoveSequenceKey,
  validateOpeningBook,
  OPENING_BOOK,
} from '../openingBook';
import { BotConfigError } from '../botConfig';
import { getBotThinkingDelayMs } from '../schadaBot';

describe('Schada Opening Book & Rapid Turn Transitions', () => {
  it('provides legal opening moves from the initial starting board for Blue', () => {
    const state = createInitialGameState();
    const bookMove = getOpeningBookMove(state.board, 'blue', 3, []);

    expect(bookMove).not.toBeNull();
    expect(bookMove?.piece.color).toBe('blue');
    expect([
      'a1', 'c1', 'e1', 'g1',
      'a2', 'b2', 'c2', 'd2', 'e2', 'f2', 'g2', 'h2'
    ]).toContain(bookMove?.from);
  });

  it('provides legal responses for Green on ply 1', () => {
    const state = createInitialGameState();
    const blueMove = getOpeningBookMove(state.board, 'blue', 3, []);
    expect(blueMove).not.toBeNull();

    const stateAfterBlue = executeMove(state, blueMove!);
    const greenResponse = getOpeningBookMove(
      stateAfterBlue.board,
      'green',
      3,
      stateAfterBlue.moveHistory
    );

    expect(greenResponse).not.toBeNull();
    expect(greenResponse?.piece.color).toBe('green');
  });

  it('Level 1 (Novice 100 Elo) completely bypasses the opening book', () => {
    const state = createInitialGameState();
    expect(shouldTierUseOpeningBook(1, [])).toBe(false);

    const bookMove = getOpeningBookMove(state.board, 'blue', 1, []);
    expect(bookMove).toBeNull();
  });

  it('Levels 3 to 8 use the opening book on plies within maxPlies', () => {
    for (let lvl = 3; lvl <= 8; lvl++) {
      expect(shouldTierUseOpeningBook(lvl, [])).toBe(true);
    }
  });

  it('returns null on uncatalogued / off-book positions for seamless engine search fallback', () => {
    const state = createInitialGameState();
    const offBookMoves = [
      {
        from: 'a1' as Square,
        to: 'a3' as Square,
        piece: state.board['a1']!,
        intermediateSquares: ['a2' as Square],
        notation: 'Fa1-a3',
      },
      {
        from: 'a7' as Square,
        to: 'c5' as Square,
        piece: state.board['a7']!,
        intermediateSquares: [],
        notation: 'Pa7-c5',
      },
    ];
    const offBookKey = buildMoveSequenceKey(offBookMoves);
    expect(OPENING_BOOK[offBookKey]).toBeUndefined();

    const bookMove = getOpeningBookMove(state.board, 'blue', 3, offBookMoves);
    expect(bookMove).toBeNull();
  });

  it('yields instantaneous 0ms thinking delay when an opening book move is available', () => {
    // Level 3 on ply 0 has book moves available
    const delay = getBotThinkingDelayMs(3, []);
    expect(delay).toBe(0);

    // Level 1 bypasses book, so it still has a human thinking delay (> 0ms)
    const delayLvl1 = getBotThinkingDelayMs(1, []);
    expect(delayLvl1).toBeGreaterThanOrEqual(250);
  });

  it('verifies that all moves across every opening line in OPENING_BOOK are strictly legal', () => {
    for (const [key, candidates] of Object.entries(OPENING_BOOK)) {
      let state = createInitialGameState();

      if (key !== '') {
        const moveStrings = key.split(' ');
        for (const moveStr of moveStrings) {
          const [from, to] = moveStr.split('-') as [Square, Square];
          const legalMoves = getLegalMovesForSquare(state.board, from);
          const move = legalMoves.find((m) => m.to === to);
          expect(move, `Move ${moveStr} in key "${key}" must be legal`).toBeDefined();
          state = executeMove(state, move!);
        }
      }

      for (const candidate of candidates) {
        const legalCandidates = getLegalMovesForSquare(state.board, candidate.from);
        const matches = legalCandidates.some((m) => m.to === candidate.to);
        expect(
          matches,
          `Candidate move ${candidate.from}-${candidate.to} ("${candidate.lineName}") under position "${key}" must be legal`
        ).toBe(true);
      }
    }
  });

  it('verifies that OPENING_BOOK is tree-closed and complete for both Blue and Green up to ply 4', () => {
    for (const [key, candidates] of Object.entries(OPENING_BOOK)) {
      const currentPly = key === '' ? 0 : key.split(' ').length;
      if (currentPly < 3) {
        for (const candidate of candidates) {
          const nextKey = key === '' ? `${candidate.from}-${candidate.to}` : `${key} ${candidate.from}-${candidate.to}`;
          const nextCandidates = OPENING_BOOK[nextKey];
          expect(
            nextCandidates,
            `Expected OPENING_BOOK to have response entries for "${nextKey}" from parent "${key}"`
          ).toBeDefined();
          expect(
            nextCandidates.length,
            `Expected at least one response for position "${nextKey}"`
          ).toBeGreaterThan(0);
        }
      }
    }
  });

  it('validates OPENING_BOOK with validateOpeningBook without error', () => {
    expect(() => validateOpeningBook(OPENING_BOOK)).not.toThrow();
  });

  it('validateOpeningBook throws BotConfigError on invalid catalogs', () => {
    expect(() => validateOpeningBook(null as any)).toThrow(BotConfigError);
    expect(() => validateOpeningBook({ "": [] } as any)).toThrow(BotConfigError);
    expect(() =>
      validateOpeningBook({
        "": [{ from: 'invalid' as any, to: 'c3', weight: 10, lineName: 'Test' }],
      })
    ).toThrow(BotConfigError);
    expect(() =>
      validateOpeningBook({
        "": [{ from: 'c1', to: 'c3', weight: -5, lineName: 'Test' }],
      })
    ).toThrow(BotConfigError);
    expect(() =>
      validateOpeningBook({
        "": [{ from: 'c1', to: 'c3', weight: 10, lineName: '   ' }],
      })
    ).toThrow(BotConfigError);
  });

  it('getOpeningBookMove defaults to BOT_ENGINE_CONFIG.defaultLevel if level is omitted', () => {
    const state = createInitialGameState();
    const move = getOpeningBookMove(state.board, 'blue');
    // Level 1 is defaultLevel and bypasses book, returning null
    expect(move).toBeNull();
  });

  it('verifies that candidate weights sum to 100 for all positions in OPENING_BOOK', () => {
    for (const [key, candidates] of Object.entries(OPENING_BOOK)) {
      const sum = candidates.reduce((acc, c) => acc + c.weight, 0);
      expect(sum, `Weights in position "${key}" must sum to 100`).toBe(100);
      for (const c of candidates) {
        expect(c.weight, `Weight for candidate ${c.from}-${c.to} in "${key}" must be >= 1`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('verifies that no candidate move falls into vector hanging traps', () => {
    // Specifically verify known vector traps are eliminated:
    // 1. After 1. a1-a3 (which attacks d6 via [3,3] beam), Green must not play d8-d6
    const a1a3Candidates = OPENING_BOOK['a1-a3'];
    expect(a1a3Candidates.some((c) => c.from === 'd8' && c.to === 'd6')).toBe(false);

    // 2. After 1. ... h8-h6 (which attacks e3 via [-3,-3] beam), Blue must not play e1-e3
    const h8h6Responses = Object.entries(OPENING_BOOK).filter(([k]) => k.includes('h8-h6'));
    for (const [key, cands] of h8h6Responses) {
      if (key.endsWith('h8-h6')) {
        expect(cands.some((c) => c.from === 'e1' && c.to === 'e3')).toBe(false);
      }
    }
  });

  it('verifies that all 14 legal Blue opening moves are included in OPENING_BOOK[""]', () => {
    const rootCandidates = OPENING_BOOK[''];
    expect(rootCandidates).toBeDefined();
    expect(rootCandidates.length).toBe(14);

    const rootMoves = rootCandidates.map((c) => `${c.from}-${c.to}`);
    const expected14Moves = [
      'a1-a3', 'a2-c4', 'b2-c3', 'c1-c3', 'c2-d3', 'c2-a4', 'd2-b4',
      'e1-e3', 'e2-d3', 'e2-g4', 'f2-d4', 'g1-g3', 'g2-e4', 'h2-h4',
    ];

    for (const expected of expected14Moves) {
      expect(rootMoves, `Expected opening move "${expected}" to be in root book`).toContain(expected);
    }
  });
});
