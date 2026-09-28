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
    expect(['c1', 'e1', 'c2', 'e2', 'a1', 'g1']).toContain(bookMove?.from);
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
    // Simulate an unusual opening move that is not in the theoretical book
    const offBookKey = buildMoveSequenceKey([
      {
        from: 'h2',
        to: 'h4',
        piece: state.board['h2']!,
        intermediateSquares: ['h3'],
        notation: 'h2-h4',
      },
    ]);

    expect(OPENING_BOOK[offBookKey]).toBeUndefined();
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
});
