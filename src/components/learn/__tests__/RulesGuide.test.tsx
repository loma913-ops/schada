import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RulesGuide } from '../RulesGuide';
import { SCHADA_RULES_CONFIG } from '@/core/schada/rulesConfig';

describe('RulesGuide Component', () => {
  it('renders clean header with title and inventor attribution', () => {
    const html = renderToStaticMarkup(<RulesGuide />);
    const { gameMetadata } = SCHADA_RULES_CONFIG;

    expect(html).toContain(`Rules of ${gameMetadata.title}`);
    expect(html).toContain(`Invented by <strong>${gameMetadata.inventor}</strong> (${gameMetadata.cityOfOrigin}, ${gameMetadata.yearInvented})`);
    expect(html).toContain(`<em>&quot;${gameMetadata.tagline}&quot;</em>`);
    expect(html).toContain('rules-hero-icon');
  });

  it('renders all 5 key sections in the updated sequence', () => {
    const html = renderToStaticMarkup(<RulesGuide />);

    expect(html).toContain('1. Objective &amp; Scoring');
    expect(html).toContain('2. The Armies &amp; Pieces');
    expect(html).toContain('3. How Movement Works');
    expect(html).toContain('4. Board Zones &amp; Movement Restrictions');
    expect(html).toContain('5. Game End &amp; Tiebreakers');

    // Section 6 is removed entirely
    expect(html).not.toContain('6. Opening Moves');
    expect(html).not.toContain('Practice Board');
    expect(html).not.toContain('rules-mini-board-grid');

    // Verify sequential ordering in markup
    const pos1 = html.indexOf('1. Objective &amp; Scoring');
    const pos2 = html.indexOf('2. The Armies &amp; Pieces');
    const pos3 = html.indexOf('3. How Movement Works');
    const pos4 = html.indexOf('4. Board Zones &amp; Movement Restrictions');
    const pos5 = html.indexOf('5. Game End &amp; Tiebreakers');

    expect(pos1).toBeLessThan(pos2);
    expect(pos2).toBeLessThan(pos3);
    expect(pos3).toBeLessThan(pos4);
    expect(pos4).toBeLessThan(pos5);
  });

  it('renders accurate scoring values dynamically configured in SCHADA_RULES_CONFIG', () => {
    const html = renderToStaticMarkup(<RulesGuide />);
    const { scoring, army } = SCHADA_RULES_CONFIG;

    expect(html).toContain(`${scoring.fieldOfficerGoalPoints} Points`);
    expect(html).toContain(`${scoring.officerGoalPoints} Point`);
    expect(html).toContain(`${scoring.pawnGoalPoints} Points`);
    expect(html).toContain(`${army.totalPiecesPerPlayer} pieces`);
    expect(html).toContain(`${army.fieldOfficersCount} Field Officers`);
  });

  it('renders interactive Vector Inspector with board grid on right and vector square on left, and does not render removed widgets', () => {
    const html = renderToStaticMarkup(<RulesGuide />);

    // Vector Inspector remains embedded in Section 3
    expect(html).toContain('Vector Inspector');
    expect(html).toContain('rules-square-picker-grid');
    expect(html).toContain('square-zoom-panel');
    expect(html).toContain('Square <code>f2</code>');

    // Vector square component appears before (to the left of) board grid in markup
    const zoomPos = html.indexOf('square-zoom-panel');
    const gridPos = html.indexOf('rules-square-picker-grid');
    expect(zoomPos).toBeLessThan(gridPos);

    // Removed elements per user request are absent
    expect(html).not.toContain('Browse All 64 Squares');
    expect(html).not.toContain('Hide Board Grid');
    expect(html).not.toContain('Bent Path (f2)');
    expect(html).not.toContain('Legal Destinations from');

    // Removed widgets from prior requests are absent
    expect(html).not.toContain('Friendly Leap Demonstration');
    expect(html).not.toContain('rules-mini-board-grid');
    expect(html).not.toContain('Reset Sandbox Board');
  });

  it('does not contain breathless AI buzzwords or tacky badges', () => {
    const html = renderToStaticMarkup(<RulesGuide />);

    expect(html).not.toContain('Golden Strategic Dos');
    expect(html).not.toContain('Critical Rookie Mistakes');
    expect(html).not.toContain('Crash Course');
    expect(html).not.toContain('Superpower: Friendly Leap');
    expect(html).not.toContain('Golden Shield Invulnerability');
    expect(html).not.toContain('Golden Tactical Tip');
    expect(html).not.toContain('Hoofd-Officier (Dutch)');
  });

  it('renders alternating light and dark square picker cells and styled zoom box in the Vector Inspector', () => {
    const html = renderToStaticMarkup(<RulesGuide />);

    // 32 light squares and 32 dark squares in 64-square picker grid
    const lightMatches = html.match(/rules-picker-cell light/g) || [];
    const darkMatches = html.match(/rules-picker-cell dark/g) || [];
    expect(lightMatches.length).toBe(32);
    expect(darkMatches.length).toBe(32);

    // Initial selected square f2 is dark
    expect(html).toContain('square-zoom-box dark');
  });
});
