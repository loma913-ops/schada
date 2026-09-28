import { describe, it, expect } from 'vitest';
import { DISTANCE_TABLES, squareToIndex, indexToSquare } from '../distanceTables';

describe('Distance Tables & Graph Topology', () => {
  it('correctly maps coordinates between square strings and 0..63 indices', () => {
    expect(squareToIndex('a1')).toBe(0);
    expect(squareToIndex('h1')).toBe(7);
    expect(squareToIndex('a8')).toBe(56);
    expect(squareToIndex('h8')).toBe(63);

    expect(indexToSquare(0)).toBe('a1');
    expect(indexToSquare(7)).toBe('h1');
    expect(indexToSquare(56)).toBe('a8');
    expect(indexToSquare(63)).toBe('h8');
  });

  it('guarantees distance to goal row is 0 for goal squares', () => {
    // Blue goal is row 7 (a8..h8, indices 56..63)
    for (let idx = 56; idx <= 63; idx++) {
      expect(DISTANCE_TABLES.blueSliding[idx]).toBe(0);
      expect(DISTANCE_TABLES.blueLeaping[idx]).toBe(0);
    }

    // Green goal is row 0 (a1..h1, indices 0..7)
    for (let idx = 0; idx <= 7; idx++) {
      expect(DISTANCE_TABLES.greenSliding[idx]).toBe(0);
      expect(DISTANCE_TABLES.greenLeaping[idx]).toBe(0);
    }
  });

  it('computes positive, finite distances for standard starting squares', () => {
    // Blue army starting rank (rank 1 and 2, rows 0 and 1)
    for (let idx = 0; idx < 16; idx++) {
      expect(DISTANCE_TABLES.blueSliding[idx]).toBeGreaterThan(0);
      expect(DISTANCE_TABLES.blueSliding[idx]).toBeLessThan(99);
    }

    // Green army starting rank (rank 7 and 8, rows 6 and 7)
    for (let idx = 48; idx < 64; idx++) {
      expect(DISTANCE_TABLES.greenSliding[idx]).toBeGreaterThan(0);
      expect(DISTANCE_TABLES.greenSliding[idx]).toBeLessThan(99);
    }
  });

  it('verifies centrality metrics are highest near board center', () => {
    const centerIndices = [
      squareToIndex('d4'),
      squareToIndex('e4'),
      squareToIndex('d5'),
      squareToIndex('e5'),
    ];
    const cornerIndices = [
      squareToIndex('a1'),
      squareToIndex('h1'),
      squareToIndex('a8'),
      squareToIndex('h8'),
    ];

    for (const c of centerIndices) {
      expect(DISTANCE_TABLES.centrality[c]).toBeGreaterThan(0.7);
    }
    for (const corner of cornerIndices) {
      expect(DISTANCE_TABLES.centrality[corner]).toBeLessThan(0.3);
    }
  });
});
