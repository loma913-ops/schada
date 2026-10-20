import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { BoardSquare } from '../BoardSquare';
import type { Piece, Move } from '@/core/schada/types';

describe('BoardSquare piece under attack badge', () => {
  it('renders red exclamation badge when a piece is under attack', () => {
    const piece: Piece = {
      id: 'white_pawn_a3',
      color: 'white',
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
      id: 'white_pawn_a3',
      color: 'white',
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
      id: 'white_fo_a8',
      color: 'white',
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

  it('renders gold shield badge for Officer reaching Black goal line (rank 1)', () => {
    const blackOfficer: Piece = {
      id: 'black_officer_d1',
      color: 'black',
      type: 'officer',
      hasLeftBase: true,
      hasReachedGoal: true,
    };

    const html = renderToString(
      <BoardSquare
        square="d1"
        piece={blackOfficer}
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
    const whitePawnInGoal: Piece = {
      id: 'white_pawn_a8',
      color: 'white',
      type: 'pawn',
      hasLeftBase: true,
      hasReachedGoal: false,
    };

    const html = renderToString(
      <BoardSquare
        square="a8"
        piece={whitePawnInGoal}
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
    const whiteOfficerMidfield: Piece = {
      id: 'white_officer_e4',
      color: 'white',
      type: 'officer',
      hasLeftBase: true,
      hasReachedGoal: false,
    };

    const html = renderToString(
      <BoardSquare
        square="e4"
        piece={whiteOfficerMidfield}
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
      id: 'white_pawn_b3',
      color: 'white',
      type: 'pawn',
      hasLeftBase: true,
      hasReachedGoal: false,
    };

    const captureMove: Move = {
      from: 'b1',
      to: 'b3',
      piece: {
        id: 'black_pawn_b1',
        color: 'black',
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

  it('renders board-square with light class when (col + row) is odd (e.g. a2, b1)', () => {
    const htmlA2 = renderToString(
      <BoardSquare
        square="a2"
        piece={null}
        isSelected={false}
        isLastMove={false}
        legalMoveTarget={undefined}
        onClick={() => { }}
        isUnderAttack={false}
      />
    );
    expect(htmlA2).toContain('board-square light');

    const htmlB1 = renderToString(
      <BoardSquare
        square="b1"
        piece={null}
        isSelected={false}
        isLastMove={false}
        legalMoveTarget={undefined}
        onClick={() => { }}
        isUnderAttack={false}
      />
    );
    expect(htmlB1).toContain('board-square light');
  });

  it('renders board-square with dark class when (col + row) is even (e.g. a1, b2)', () => {
    const htmlA1 = renderToString(
      <BoardSquare
        square="a1"
        piece={null}
        isSelected={false}
        isLastMove={false}
        legalMoveTarget={undefined}
        onClick={() => { }}
        isUnderAttack={false}
      />
    );
    expect(htmlA1).toContain('board-square dark');

    const htmlB2 = renderToString(
      <BoardSquare
        square="b2"
        piece={null}
        isSelected={false}
        isLastMove={false}
        legalMoveTarget={undefined}
        onClick={() => { }}
        isUnderAttack={false}
      />
    );
    expect(htmlB2).toContain('board-square dark');
  });
});
