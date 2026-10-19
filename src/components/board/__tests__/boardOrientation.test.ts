import { describe, it, expect } from 'vitest';
import { createInitialBoard } from '@/core/schada/engine';
import { getBoardSquaresForOrientation } from '../SchadaBoard';
import { squareToColRow } from '@/core/schada/vectors';

describe('Board Orientation - Player at bottom, Opponent at top', () => {
  const initialBoard = createInitialBoard();

  it('generates 64 unique valid squares for both orientations', () => {
    const whiteSquares = getBoardSquaresForOrientation('white');
    const blackSquares = getBoardSquaresForOrientation('black');

    expect(whiteSquares).toHaveLength(64);
    expect(blackSquares).toHaveLength(64);

    expect(new Set(whiteSquares).size).toBe(64);
    expect(new Set(blackSquares).size).toBe(64);
  });

  it('positions Player pieces at the bottom and Opponent at the top for White orientation', () => {
    const squares = getBoardSquaresForOrientation('white');

    // In an 8x8 grid (indices 0..63):
    // Top 2 rows (indices 0..15): ranks 8 and 7 (Black army base)
    // Bottom 2 rows (indices 48..63): ranks 2 and 1 (White army base)

    const topTwoRows = squares.slice(0, 16);
    const bottomTwoRows = squares.slice(48, 64);

    // Verify all pieces in top rows are Black (opponent)
    topTwoRows.forEach((sq) => {
      const piece = initialBoard[sq];
      expect(piece).not.toBeNull();
      expect(piece?.color).toBe('black');
    });

    // Verify all pieces in bottom rows are White (player)
    bottomTwoRows.forEach((sq) => {
      const piece = initialBoard[sq];
      expect(piece).not.toBeNull();
      expect(piece?.color).toBe('white');
    });

    // Middle rows (ranks 3-6) must be empty initially
    const middleRows = squares.slice(16, 48);
    middleRows.forEach((sq) => {
      expect(initialBoard[sq]).toBeNull();
    });

    // Check corner positions for standard white orientation:
    // Top-left is a8, top-right is h8, bottom-left is a1, bottom-right is h1
    expect(squares[0]).toBe('a8');
    expect(squares[7]).toBe('h8');
    expect(squares[56]).toBe('a1');
    expect(squares[63]).toBe('h1');
  });

  it('positions Player pieces at the bottom and Opponent at the top for Black orientation', () => {
    const squares = getBoardSquaresForOrientation('black');

    // In an 8x8 grid (indices 0..63) flipped for Black:
    // Top 2 rows (indices 0..15): ranks 1 and 2 (White army base)
    // Bottom 2 rows (indices 48..63): ranks 7 and 8 (Black army base)

    const topTwoRows = squares.slice(0, 16);
    const bottomTwoRows = squares.slice(48, 64);

    // Verify all pieces in top rows are White (opponent)
    topTwoRows.forEach((sq) => {
      const piece = initialBoard[sq];
      expect(piece).not.toBeNull();
      expect(piece?.color).toBe('white');
    });

    // Verify all pieces in bottom rows are Black (player)
    bottomTwoRows.forEach((sq) => {
      const piece = initialBoard[sq];
      expect(piece).not.toBeNull();
      expect(piece?.color).toBe('black');
    });

    // Middle rows (ranks 3-6) must be empty initially
    const middleRows = squares.slice(16, 48);
    middleRows.forEach((sq) => {
      expect(initialBoard[sq]).toBeNull();
    });

    // Check corner positions for flipped black orientation:
    // Top-left is h1, top-right is a1, bottom-left is h8, bottom-right is a8
    expect(squares[0]).toBe('h1');
    expect(squares[7]).toBe('a1');
    expect(squares[56]).toBe('h8');
    expect(squares[63]).toBe('a8');
  });

  it('correctly maps coordinate edge squares for rank and file indicators', () => {
    const whiteSquares = getBoardSquaresForOrientation('white');
    const blackSquares = getBoardSquaresForOrientation('black');

    // For white orientation:
    // Bottom row (indices 56..63) has row === 0 (Rank 1)
    for (let i = 56; i <= 63; i++) {
      const [, row] = squareToColRow(whiteSquares[i]);
      expect(row).toBe(0);
    }
    // Left column (indices 0, 8, 16, 24, 32, 40, 48, 56) has col === 0 (File a)
    for (let r = 0; r < 8; r++) {
      const [col] = squareToColRow(whiteSquares[r * 8]);
      expect(col).toBe(0);
    }

    // For black orientation:
    // Bottom row (indices 56..63) has row === 7 (Rank 8)
    for (let i = 56; i <= 63; i++) {
      const [, row] = squareToColRow(blackSquares[i]);
      expect(row).toBe(7);
    }
    // Left column (indices 0, 8, 16, 24, 32, 40, 48, 56) has col === 7 (File h)
    for (let r = 0; r < 8; r++) {
      const [col] = squareToColRow(blackSquares[r * 8]);
      expect(col).toBe(7);
    }
  });

  it('guarantees advancing forward moves upward on screen towards enemy goal for both orientations', () => {
    // White pieces start on Rank 1-2 and advance towards Rank 8 (goal line at top)
    const whiteSquares = getBoardSquaresForOrientation('white');
    const whiteRank1Index = whiteSquares.indexOf('d1');
    const whiteGoalRank8Index = whiteSquares.indexOf('d8');
    // On screen (grid items 0 to 63), a lower index is higher up on the screen:
    expect(whiteGoalRank8Index).toBeLessThan(whiteRank1Index);

    // Black pieces start on Rank 8-7 and advance towards Rank 1 (goal line at top)
    const blackSquares = getBoardSquaresForOrientation('black');
    const blackRank8Index = blackSquares.indexOf('d8');
    const blackGoalRank1Index = blackSquares.indexOf('d1');
    // For black orientation, Rank 1 (goal) is higher up on screen (lower index) than Rank 8 (base):
    expect(blackGoalRank1Index).toBeLessThan(blackRank8Index);
  });
});
