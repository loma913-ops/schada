import { describe, it, expect } from 'vitest';
import { parseGameInput, tokenizeGameMoves, extractHeadersAndBody } from '../gameParser';
import { AnalysisConfigError } from '../analysisConfig';

describe('Game Parser', () => {
  const sampleNotationSnippet = `
  1. Fe1-e3       Pc7-e5
  2. Fc1-c3       Fb8-b6
  3. Fa1-a3       Fh8-h6
  4. Pe2-e1       Fb6-a6
  5. Fg1-g3       Ff8-f6
  6. Fg3-h3       Ff6-e6
  7. Fc3-d3       Fe6-g6
  8. Fe3-f4       Oc8-c7
  9. Fd3-f5       Pf7-f8
 10. Ff5-h5       Pd7-e6
 11. Fh3xe6       Fh6-f6
 12. Fh5xg6       Ff6xe6
 13. Fg6-f7       Oa8-b8
 14. Ff7xf8       Fe6-g6
 15. Ff8xe8       Fd8-c8
 16. Fe8-d8       Pb7-d5
 17. Fa3-d6       Ob8-b6
 18. Fd8xc8       Og8-h8
 19. Oh1-g1       Ph7-g8
 20. Ff4-g4
`;

  it('correctly tokenizes bare move notations and strips prefixes', () => {
    const tokens = tokenizeGameMoves(sampleNotationSnippet);
    expect(tokens.length).toBe(39); // 19 full moves (38 plies) + 1 half move = 39 plies
    expect(tokens[0]).toBe('Fe1-e3');
    expect(tokens[1]).toBe('Pc7-e5');
    expect(tokens[38]).toBe('Ff4-g4');
  });

  it('correctly parses PGN metadata headers and separates the body', () => {
    const fullPgn = `
[Event "Schada Championship Tournament #1"]
[Round "Quarterfinals Match 1"]
[White "Advanced (Tier 6)"]
[Black "Intermediate (Tier 5)"]
[Result "1-0"]

1. Fe1-e3 Pc7-e5
2. Fc1-c3 Fb8-b6
`;
    const { metadata, bodyText } = extractHeadersAndBody(fullPgn);
    expect(metadata.Event).toBe('Schada Championship Tournament #1');
    expect(metadata.White).toBe('Advanced (Tier 6)');
    expect(metadata.Black).toBe('Intermediate (Tier 5)');
    expect(metadata.Result).toBe('1-0');
    expect(bodyText.includes('1. Fe1-e3 Pc7-e5')).toBe(true);
  });

  it('successfully parses the user 20-move sample into legal Move objects', () => {
    const parsed = parseGameInput(sampleNotationSnippet);
    expect(parsed.moves.length).toBe(39);
    expect(parsed.notations.length).toBe(39);
    expect(parsed.moves[0].from).toBe('e1');
    expect(parsed.moves[0].to).toBe('e3');
    expect(parsed.moves[0].piece.type).toBe('field_officer');
    expect(parsed.moves[0].piece.color).toBe('white');

    expect(parsed.moves[1].from).toBe('c7');
    expect(parsed.moves[1].to).toBe('e5');
    expect(parsed.moves[1].piece.color).toBe('black');
  });

  it('supports JSON game match objects', () => {
    const jsonObj = {
      Event: 'Test Match',
      White: 'Master',
      Black: 'Expert',
      gameNotation: '1. Fe1-e3 Pc7-e5 2. Fc1-c3 Fb8-b6',
    };

    const parsed = parseGameInput(jsonObj);
    expect(parsed.metadata.Event).toBe('Test Match');
    expect(parsed.moves.length).toBe(4);
  });

  it('throws AnalysisConfigError on illegal moves', () => {
    const illegalGame = '1. Fe1-h8'; // Impossible move on move 1
    expect(() => parseGameInput(illegalGame)).toThrow(AnalysisConfigError);
  });

  it('throws AnalysisConfigError when moving opponent piece or from empty square', () => {
    // White on turn 1 tries to move Black's officer on b8
    expect(() => parseGameInput('1. Fb8-b6')).toThrow(/does not contain an active player piece/);
    // Square e4 is initially empty
    expect(() => parseGameInput('1. e4-e5')).toThrow(/does not contain an active player piece/);
  });

  it('throws AnalysisConfigError on empty move data', () => {
    expect(() => parseGameInput('   ')).toThrow(AnalysisConfigError);
  });
});
