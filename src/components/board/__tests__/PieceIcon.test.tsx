import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { PieceIcon } from '../PieceIcon';
import type { Piece } from '@/core/schada/types';

describe('PieceIcon component', () => {
  it('renders Field Officer as a hexagon with inner hexagon ring and preserves central star and dot', () => {
    const blueFieldOfficer: Piece = {
      id: 'blue_fo_a1',
      color: 'blue',
      type: 'field_officer',
      hasLeftBase: false,
      hasReachedGoal: false,
    };

    const html = renderToString(<PieceIcon piece={blueFieldOfficer} />);

    // Outer Hexagon
    expect(html).toContain('<polygon');
    expect(html).toContain('50,6 88.11,28 88.11,72 50,94 11.89,72 11.89,28');
    expect(html).toContain('fill="#2563eb"');
    expect(html).toContain('stroke="#1d4ed8"');

    // Inner Hexagon Ring
    expect(html).toContain('50,16 79.44,33 79.44,67 50,84 20.56,67 20.56,33');
    expect(html).toContain('stroke="#60a5fa"');

    // Central Star & dot
    expect(html).toContain('M 50 26 L 56 42 L 72 44 L 60 56 L 63 72 L 50 64 L 37 72 L 40 56 L 28 44 L 44 42 Z');
    expect(html).toContain('<circle cx="50" cy="50" r="5" fill="#2563eb"');
  });

  it('renders Green Field Officer with green palette', () => {
    const greenFieldOfficer: Piece = {
      id: 'green_fo_a8',
      color: 'green',
      type: 'field_officer',
      hasLeftBase: false,
      hasReachedGoal: false,
    };

    const html = renderToString(<PieceIcon piece={greenFieldOfficer} />);

    expect(html).toContain('fill="#16a34a"');
    expect(html).toContain('stroke="#15803d"');
    expect(html).toContain('stroke="#4ade80"');
    expect(html).toContain('<circle cx="50" cy="50" r="5" fill="#16a34a"');
  });

  it('renders Officer as a hexagon and preserves central diamond and dot', () => {
    const blueOfficer: Piece = {
      id: 'blue_officer_b1',
      color: 'blue',
      type: 'officer',
      hasLeftBase: false,
      hasReachedGoal: false,
    };

    const html = renderToString(<PieceIcon piece={blueOfficer} />);

    // Outer Hexagon
    expect(html).toContain('<polygon');
    expect(html).toContain('50,8 86.37,29 86.37,71 50,92 13.63,71 13.63,29');
    expect(html).toContain('fill="#2563eb"');
    expect(html).toContain('stroke="#1d4ed8"');

    // Central Diamond Crest & dot
    expect(html).toContain('M 50 25 L 75 50 L 50 75 L 25 50 Z');
    expect(html).toContain('fill="#60a5fa"');
    expect(html).toContain('stroke="#ffffff"');
    expect(html).toContain('<circle cx="50" cy="50" r="8" fill="#ffffff"');
  });

  it('renders Green Officer with green palette', () => {
    const greenOfficer: Piece = {
      id: 'green_officer_b8',
      color: 'green',
      type: 'officer',
      hasLeftBase: false,
      hasReachedGoal: false,
    };

    const html = renderToString(<PieceIcon piece={greenOfficer} />);

    expect(html).toContain('fill="#16a34a"');
    expect(html).toContain('stroke="#15803d"');
    expect(html).toContain('fill="#4ade80"');
  });

  it('renders Pawn as a circle and preserves circular shield and rings', () => {
    const bluePawn: Piece = {
      id: 'blue_pawn_a2',
      color: 'blue',
      type: 'pawn',
      hasLeftBase: false,
      hasReachedGoal: false,
    };

    const html = renderToString(<PieceIcon piece={bluePawn} />);

    expect(html).not.toContain('<polygon');
    expect(html).toContain('<circle cx="50" cy="50" r="31"');
    expect(html).toContain('<circle cx="50" cy="50" r="20"');
    expect(html).toContain('<circle cx="50" cy="50" r="7"');
  });
});

