import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { BoardSquare } from '../BoardSquare';
import type { Piece, Move } from '@/core/schada/types';

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
        onClick={() => { }}
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
        onClick={() => { }}
        isUnderAttack={false}
      />
    );

    expect(html).not.toContain('piece-under-attack-badge');
  });

  it('renders goal-invulnerable-badge with gold shield icon and never piece-under-attack-badge for high pieces in goal rank', () => {
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
        onClick={() => { }}
        isUnderAttack={true}
      />
    );

    expect(html).toContain('goal-invulnerable-badge');
    expect(html).toContain('goal-shield-icon');
    expect(html).toContain('Safe in Goal Line (Immune to capture)');
    expect(html).not.toContain('piece-under-attack-badge');
  });

  it('renders gold shield badge for Officer reaching Green goal line (rank 1)', () => {
    const greenOfficer: Piece = {
      id: 'green_officer_d1',
      color: 'green',
      type: 'officer',
      hasLeftBase: true,
      hasReachedGoal: true,
    };

    const html = renderToString(
      <BoardSquare
        square="d1"
        piece={greenOfficer}
        isSelected={false}
        isLastMove={false}
        legalMoveTarget={undefined}
        onClick={() => { }}
        isUnderAttack={false}
      />
    );

    expect(html).toContain('goal-invulnerable-badge');
    expect(html).toContain('goal-shield-icon');
  });

  it('does NOT render goal-invulnerable-badge for pawns in goal rank', () => {
    const bluePawnInGoal: Piece = {
      id: 'blue_pawn_a8',
      color: 'blue',
      type: 'pawn',
      hasLeftBase: true,
      hasReachedGoal: false,
    };

    const html = renderToString(
      <BoardSquare
        square="a8"
        piece={bluePawnInGoal}
        isSelected={false}
        isLastMove={false}
        legalMoveTarget={undefined}
        onClick={() => { }}
        isUnderAttack={false}
      />
    );

    expect(html).not.toContain('goal-invulnerable-badge');
    expect(html).not.toContain('goal-shield-icon');
  });

  it('does NOT render goal-invulnerable-badge for high pieces outside goal rank', () => {
    const blueOfficerMidfield: Piece = {
      id: 'blue_officer_e4',
      color: 'blue',
      type: 'officer',
      hasLeftBase: true,
      hasReachedGoal: false,
    };

    const html = renderToString(
      <BoardSquare
        square="e4"
        piece={blueOfficerMidfield}
        isSelected={false}
        isLastMove={false}
        legalMoveTarget={undefined}
        onClick={() => { }}
        isUnderAttack={false}
      />
    );

    expect(html).not.toContain('goal-invulnerable-badge');
    expect(html).not.toContain('goal-shield-icon');
  });

  it('renders threat exclamation above the red capture indicator in DOM hierarchy', () => {
    const targetPiece: Piece = {
      id: 'blue_pawn_b3',
      color: 'blue',
      type: 'pawn',
      hasLeftBase: true,
      hasReachedGoal: false,
    };

    const captureMove: Move = {
      from: 'b1',
      to: 'b3',
      piece: {
        id: 'green_pawn_b1',
        color: 'green',
        type: 'pawn',
        hasLeftBase: true,
        hasReachedGoal: false,
      },
      captured: targetPiece,
      intermediateSquares: [],
      notation: 'b1xb3',
    };

    const html = renderToString(
      <BoardSquare
        square="b3"
        piece={targetPiece}
        isSelected={false}
        isLastMove={false}
        legalMoveTarget={captureMove}
        onClick={() => { }}
        isUnderAttack={true}
      />
    );

    expect(html).toContain('move-capture-ring');
    expect(html).toContain('piece-under-attack-badge');

    // Verify DOM order: move-capture-ring is rendered before piece-under-attack-badge
    const captureRingIndex = html.indexOf('move-capture-ring');
    const attackBadgeIndex = html.indexOf('piece-under-attack-badge');
    expect(captureRingIndex).toBeGreaterThan(-1);
    expect(attackBadgeIndex).toBeGreaterThan(-1);
    expect(captureRingIndex).toBeLessThan(attackBadgeIndex);
  });
});
