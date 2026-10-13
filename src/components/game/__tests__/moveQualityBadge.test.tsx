import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MoveQualityBadge } from '../MoveQualityBadge';
import { CANONICAL_ANALYSIS_DISPLAY_CONFIG } from '../analysisDisplayConfig';

describe('MoveQualityBadge Component', () => {
  it('renders brilliant badge with !! symbol and cyan circle', () => {
    const html = renderToStaticMarkup(<MoveQualityBadge quality="brilliant" />);
    expect(html).toContain('data-quality="brilliant"');
    expect(html).toContain('title="Brilliant"');
    expect(html).toContain('fill="#1bb5d8"');
    expect(html).toContain('!!');
  });

  it('renders great move badge with ! symbol and blue circle', () => {
    const html = renderToStaticMarkup(<MoveQualityBadge quality="great" />);
    expect(html).toContain('data-quality="great"');
    expect(html).toContain('title="Great Move"');
    expect(html).toContain('fill="#4b9ee8"');
    expect(html).toContain('!');
  });

  it('renders best move badge with star polygon and green circle when authorized by config', () => {
    const customConfig = {
      ...CANONICAL_ANALYSIS_DISPLAY_CONFIG,
      displayedQualities: ['best' as const],
    };
    const html = renderToStaticMarkup(<MoveQualityBadge quality="best" config={customConfig} />);
    expect(html).toContain('data-quality="best"');
    expect(html).toContain('title="Best Move"');
    expect(html).toContain('fill="#85bf3b"');
    expect(html).toContain('<polygon');
  });

  it('renders inaccuracy badge with ?! symbol and yellow circle', () => {
    const html = renderToStaticMarkup(<MoveQualityBadge quality="inaccuracy" />);
    expect(html).toContain('data-quality="inaccuracy"');
    expect(html).toContain('title="Inaccuracy"');
    expect(html).toContain('fill="#f0c239"');
    expect(html).toContain('?!');
  });

  it('renders mistake badge with ? symbol and orange circle', () => {
    const html = renderToStaticMarkup(<MoveQualityBadge quality="mistake" />);
    expect(html).toContain('data-quality="mistake"');
    expect(html).toContain('title="Mistake"');
    expect(html).toContain('fill="#e58f2a"');
    expect(html).toContain('?');
  });

  it('renders miss badge with ✖ cross path and coral circle', () => {
    const html = renderToStaticMarkup(<MoveQualityBadge quality="miss" />);
    expect(html).toContain('data-quality="miss"');
    expect(html).toContain('title="Miss"');
    expect(html).toContain('fill="#e85d56"');
    expect(html).toContain('<path');
  });

  it('renders blunder badge with ?? symbol and red circle', () => {
    const html = renderToStaticMarkup(<MoveQualityBadge quality="blunder" />);
    expect(html).toContain('data-quality="blunder"');
    expect(html).toContain('title="Blunder"');
    expect(html).toContain('fill="#db3236"');
    expect(html).toContain('??');
  });

  it('returns null and does not render for excluded categories: best, excellent, good, book', () => {
    expect(renderToStaticMarkup(<MoveQualityBadge quality="best" />)).toBe('');
    expect(renderToStaticMarkup(<MoveQualityBadge quality="excellent" />)).toBe('');
    expect(renderToStaticMarkup(<MoveQualityBadge quality="good" />)).toBe('');
    expect(renderToStaticMarkup(<MoveQualityBadge quality="book" />)).toBe('');
  });

  it('supports custom size override', () => {
    const html = renderToStaticMarkup(<MoveQualityBadge quality="great" size={24} />);
    expect(html).toContain('width="24"');
    expect(html).toContain('height="24"');
  });

  it('defaults to canonical badge size', () => {
    const html = renderToStaticMarkup(<MoveQualityBadge quality="great" />);
    expect(html).toContain(`width="${CANONICAL_ANALYSIS_DISPLAY_CONFIG.badgeSizePx}"`);
    expect(html).toContain(`height="${CANONICAL_ANALYSIS_DISPLAY_CONFIG.badgeSizePx}"`);
  });

  it('throws AnalysisDisplayConfigError if size is invalid or non-positive', () => {
    expect(() => renderToStaticMarkup(<MoveQualityBadge quality="great" size={-5} />)).toThrow(
      'AnalysisDisplayConfigError'
    );
    expect(() => renderToStaticMarkup(<MoveQualityBadge quality="great" size={NaN} />)).toThrow(
      'AnalysisDisplayConfigError'
    );
  });

  it('renders all 10 qualities when forceRender is true', () => {
    const qualities = [
      'brilliant',
      'great',
      'best',
      'excellent',
      'good',
      'book',
      'inaccuracy',
      'mistake',
      'miss',
      'blunder',
    ] as const;

    for (const q of qualities) {
      const html = renderToStaticMarkup(<MoveQualityBadge quality={q} forceRender />);
      expect(html).toContain(`data-quality="${q}"`);
      expect(html).toContain('<svg');
    }
  });
});
