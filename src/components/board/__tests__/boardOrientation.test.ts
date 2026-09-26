import { describe, it, expect } from 'vitest';
import { createInitialBoard } from '@/core/schada/engine';
import { getBoardSquaresForOrientation } from '../SchadaBoard';
import { squareToColRow } from '@/core/schada/vectors';

describe('Board Orientation - Player at bottom, Opponent at top', () => {
  const initialBoard = createInitialBoard();

  it('generates 64 unique valid squares for both orientations', () => {
    const blueSquares = getBoardSquaresForOrientation('blue');
    const greenSquares = getBoardSquaresForOrientation('green');

    expect(blueSquares).toHaveLength(64);
    expect(greenSquares).toHaveLength(64);

    expect(new Set(blueSquares).size).toBe(64);
    expect(new Set(greenSquares).size).toBe(64);
  });

  it('positions Player pieces at the bottom and Opponent at the top for Blue orientation', () => {
    const squares = getBoardSquaresForOrientation('blue');

    // In an 8x8 grid (indices 0..63):
    // Top 2 rows (indices 0..15): ranks 8 and 7 (Green army base)
    // Bottom 2 rows (indices 48..63): ranks 2 and 1 (Blue army base)

    const topTwoRows = squares.slice(0, 16);
    const bottomTwoRows = squares.slice(48, 64);

    // Verify all pieces in top rows are Green (opponent)
    topTwoRows.forEach((sq) => {
      const piece = initialBoard[sq];
      expect(piece).not.toBeNull();
      expect(piece?.color).toBe('green');
    });

    // Verify all pieces in bottom rows are Blue (player)
    bottomTwoRows.forEach((sq) => {
      const piece = initialBoard[sq];
      expect(piece).not.toBeNull();
      expect(piece?.color).toBe('blue');
    });

    // Middle rows (ranks 3-6) must be empty initially
    const middleRows = squares.slice(16, 48);
    middleRows.forEach((sq) => {
      expect(initialBoard[sq]).toBeNull();
    });

    // Check corner positions for standard blue orientation:
    // Top-left is a8, top-right is h8, bottom-left is a1, bottom-right is h1
    expect(squares[0]).toBe('a8');
    expect(squares[7]).toBe('h8');
    expect(squares[56]).toBe('a1');
    expect(squares[63]).toBe('h1');
  });

  it('positions Player pieces at the bottom and Opponent at the top for Green orientation', () => {
    const squares = getBoardSquaresForOrientation('green');

    // In an 8x8 grid (indices 0..63) flipped for Green:
    // Top 2 rows (indices 0..15): ranks 1 and 2 (Blue army base)
    // Bottom 2 rows (indices 48..63): ranks 7 and 8 (Green army base)

    const topTwoRows = squares.slice(0, 16);
    const bottomTwoRows = squares.slice(48, 64);

    // Verify all pieces in top rows are Blue (opponent)
    topTwoRows.forEach((sq) => {
      const piece = initialBoard[sq];
      expect(piece).not.toBeNull();
      expect(piece?.color).toBe('blue');
    });

    // Verify all pieces in bottom rows are Green (player)
    bottomTwoRows.forEach((sq) => {
      const piece = initialBoard[sq];
      expect(piece).not.toBeNull();
      expect(piece?.color).toBe('green');
    });

    // Middle rows (ranks 3-6) must be empty initially
    const middleRows = squares.slice(16, 48);
    middleRows.forEach((sq) => {
      expect(initialBoard[sq]).toBeNull();
    });

    // Check corner positions for flipped green orientation:
    // Top-left is h1, top-right is a1, bottom-left is h8, bottom-right is a8
    expect(squares[0]).toBe('h1');
    expect(squares[7]).toBe('a1');
    expect(squares[56]).toBe('h8');
    expect(squares[63]).toBe('a8');
  });

  it('correctly maps coordinate edge squares for rank and file indicators', () => {
    const blueSquares = getBoardSquaresForOrientation('blue');
    const greenSquares = getBoardSquaresForOrientation('green');

    // For blue orientation:
    // Bottom row (indices 56..63) has row === 0 (Rank 1)
    for (let i = 56; i <= 63; i++) {
      const [, row] = squareToColRow(blueSquares[i]);
      expect(row).toBe(0);
    }
    // Left column (indices 0, 8, 16, 24, 32, 40, 48, 56) has col === 0 (File a)
    for (let r = 0; r < 8; r++) {
      const [col] = squareToColRow(blueSquares[r * 8]);
      expect(col).toBe(0);
    }

    // For green orientation:
    // Bottom row (indices 56..63) has row === 7 (Rank 8)
    for (let i = 56; i <= 63; i++) {
      const [, row] = squareToColRow(greenSquares[i]);
      expect(row).toBe(7);
    }
    // Left column (indices 0, 8, 16, 24, 32, 40, 48, 56) has col === 7 (File h)
    for (let r = 0; r < 8; r++) {
      const [col] = squareToColRow(greenSquares[r * 8]);
      expect(col).toBe(7);
    }
  });

  it('guarantees advancing forward moves upward on screen towards enemy goal for both orientations', () => {
    // Blue pieces start on Rank 1-2 and advance towards Rank 8 (goal line at top)
    const blueSquares = getBoardSquaresForOrientation('blue');
    const blueRank1Index = blueSquares.indexOf('d1');
    const blueGoalRank8Index = blueSquares.indexOf('d8');
    // On screen (grid items 0 to 63), a lower index is higher up on the screen:
    expect(blueGoalRank8Index).toBeLessThan(blueRank1Index);

    // Green pieces start on Rank 8-7 and advance towards Rank 1 (goal line at top)
    const greenSquares = getBoardSquaresForOrientation('green');
    const greenRank8Index = greenSquares.indexOf('d8');
    const greenGoalRank1Index = greenSquares.indexOf('d1');
    // For green orientation, Rank 1 (goal) is higher up on screen (lower index) than Rank 8 (base):
    expect(greenGoalRank1Index).toBeLessThan(greenRank8Index);
  });
});
