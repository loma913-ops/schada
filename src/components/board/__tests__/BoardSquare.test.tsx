import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { BoardSquare } from '../BoardSquare';
import type { Piece } from '@/core/schada/types';

describe('BoardSquare piece under attack badge', () => {
  it('renders red exclamation badge when a piece is under attack', () => {
    const piece: Piece = {
      id: 'blue_pawn_a3',
      color: 'blue',
      type: 'pawn',
      hasLeftBase: true,
      hasReachedGoal: false,
    };

    const html = renderToString(
      <BoardSquare
        square="a3"
        piece={piece}
        isSelected={false}
        isLastMove={false}
        legalMoveTarget={undefined}
        onClick={() => {}}
        isUnderAttack={true}
      />
    );

    expect(html).toContain('piece-under-attack-badge');
    expect(html).toContain('!');
    expect(html).toContain('Under attack (vulnerable to capture)');
  });

  it('does not render red exclamation badge when isUnderAttack is false', () => {
    const piece: Piece = {
      id: 'blue_pawn_a3',
      color: 'blue',
      type: 'pawn',
      hasLeftBase: true,
      hasReachedGoal: false,
    };

    const html = renderToString(
      <BoardSquare
        square="a3"
        piece={piece}
        isSelected={false}
        isLastMove={false}
        legalMoveTarget={undefined}
        onClick={() => {}}
        isUnderAttack={false}
      />
    );

    expect(html).not.toContain('piece-under-attack-badge');
  });

  it('renders goal-invulnerable-badge and never piece-under-attack-badge for high pieces in goal rank', () => {
    const goalPiece: Piece = {
      id: 'blue_fo_a8',
      color: 'blue',
      type: 'field_officer',
      hasLeftBase: true,
      hasReachedGoal: true,
    };

    const html = renderToString(
      <BoardSquare
        square="a8"
        piece={goalPiece}
        isSelected={false}
        isLastMove={false}
        legalMoveTarget={undefined}
        onClick={() => {}}
        isUnderAttack={true}
      />
    );

    expect(html).toContain('goal-invulnerable-badge');
    expect(html).not.toContain('piece-under-attack-badge');
  });
});
