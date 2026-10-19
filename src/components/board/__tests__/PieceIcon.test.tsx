import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { PieceIcon } from '../PieceIcon';
import type { Piece } from '@/core/schada/types';

describe('PieceIcon component', () => {
  it('renders White Field Officer as a hexagon with inner hexagon ring and preserves central star and charcoal center', () => {
    const whiteFieldOfficer: Piece = {
      id: 'white_fo_a1',
      color: 'white',
      type: 'field_officer',
      hasLeftBase: false,
      hasReachedGoal: false,
    };

    const html = renderToString(<PieceIcon piece={whiteFieldOfficer} />);

    // Outer Hexagon
    expect(html).toContain('<polygon');
    expect(html).toContain('50,6 88.11,28 88.11,72 50,94 11.89,72 11.89,28');
    expect(html).toContain('fill="#F1EFE7"');
    expect(html).toContain('stroke="#27272a"');

    // Inner Hexagon Ring
    expect(html).toContain('50,16 79.44,33 79.44,67 50,84 20.56,67 20.56,33');
    expect(html).toContain('stroke="#71717a"');

    // Central Star & charcoal center dot (18181B)
    expect(html).toContain('M 50 26 L 56 42 L 72 44 L 60 56 L 63 72 L 50 64 L 37 72 L 40 56 L 28 44 L 44 42 Z');
    expect(html).toContain('fill="#71717a"');
    expect(html).toContain('stroke-width="3"');
    expect(html).toContain('<circle cx="50" cy="50" r="5" fill="#18181B"');
  });

  it('renders Black Field Officer with charcoal palette, lightened grey elements, and ivory center', () => {
    const blackFieldOfficer: Piece = {
      id: 'black_fo_a8',
      color: 'black',
      type: 'field_officer',
      hasLeftBase: false,
      hasReachedGoal: false,
    };

    const html = renderToString(<PieceIcon piece={blackFieldOfficer} />);

    expect(html).toContain('fill="#18181B"');
    expect(html).toContain('stroke="#09090b"');
    expect(html).toContain('stroke="#a1a1aa"');
    expect(html).toContain('fill="#64646e"');
    expect(html).toContain('stroke-width="3"');
    expect(html).toContain('<circle cx="50" cy="50" r="5" fill="#F1EFE7"');
  });

  it('renders White Officer as a hexagon and preserves central diamond and charcoal center', () => {
    const whiteOfficer: Piece = {
      id: 'white_officer_b1',
      color: 'white',
      type: 'officer',
      hasLeftBase: false,
      hasReachedGoal: false,
    };

    const html = renderToString(<PieceIcon piece={whiteOfficer} />);

    // Outer Hexagon
    expect(html).toContain('<polygon');
    expect(html).toContain('50,8 86.37,29 86.37,71 50,92 13.63,71 13.63,29');
    expect(html).toContain('fill="#F1EFE7"');
    expect(html).toContain('stroke="#27272a"');

    // Central Diamond Crest & charcoal center dot (18181B)
    expect(html).toContain('M 50 25 L 75 50 L 50 75 L 25 50 Z');
    expect(html).toContain('fill="#71717a"');
    expect(html).toContain('stroke="#27272a"');
    expect(html).toContain('stroke-width="3"');
    expect(html).toContain('<circle cx="50" cy="50" r="8" fill="#18181B"');
  });

  it('renders Black Officer with charcoal palette, lightened grey elements, and ivory center', () => {
    const blackOfficer: Piece = {
      id: 'black_officer_b8',
      color: 'black',
      type: 'officer',
      hasLeftBase: false,
      hasReachedGoal: false,
    };

    const html = renderToString(<PieceIcon piece={blackOfficer} />);

    expect(html).toContain('fill="#18181B"');
    expect(html).toContain('stroke="#09090b"');
    expect(html).toContain('fill="#64646e"');
    expect(html).toContain('stroke="#a1a1aa"');
    expect(html).toContain('stroke-width="3"');
    expect(html).toContain('<circle cx="50" cy="50" r="8" fill="#F1EFE7"');
  });

  it('renders Pawn as a circle and preserves circular shield and contrasting center', () => {
    const whitePawn: Piece = {
      id: 'white_pawn_a2',
      color: 'white',
      type: 'pawn',
      hasLeftBase: false,
      hasReachedGoal: false,
    };

    const blackPawn: Piece = {
      id: 'black_pawn_a7',
      color: 'black',
      type: 'pawn',
      hasLeftBase: false,
      hasReachedGoal: false,
    };

    const whiteHtml = renderToString(<PieceIcon piece={whitePawn} />);
    expect(whiteHtml).not.toContain('<polygon');
    expect(whiteHtml).toContain('<circle cx="50" cy="50" r="31" fill="#F1EFE7"');
    expect(whiteHtml).toContain('<circle cx="50" cy="50" r="20" fill="none" stroke="#71717a"');
    expect(whiteHtml).toContain('<circle cx="50" cy="50" r="7" fill="#18181B"');

    const blackHtml = renderToString(<PieceIcon piece={blackPawn} />);
    expect(blackHtml).not.toContain('<polygon');
    expect(blackHtml).toContain('<circle cx="50" cy="50" r="31" fill="#18181B"');
    expect(blackHtml).toContain('<circle cx="50" cy="50" r="20" fill="none" stroke="#a1a1aa"');
    expect(blackHtml).toContain('<circle cx="50" cy="50" r="7" fill="#F1EFE7"');
  });
});

