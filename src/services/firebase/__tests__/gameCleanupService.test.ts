import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockDeleteDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockCommit = vi.fn().mockResolvedValue(undefined);
const mockBatch = {
  delete: mockDeleteDoc,
  update: mockUpdateDoc,
  commit: mockCommit,
};

const mockGetDocs = vi.fn();
const mockQuery = vi.fn((...args: any[]) => args);
const mockWhere = vi.fn((field: string, op: string, val: any) => ({ field, op, val }));
const mockOrderBy = vi.fn((field: string, dir: string) => ({ field, dir }));
const mockLimit = vi.fn((num: number) => ({ limit: num }));
const mockCollection = vi.fn((_db: any, name: string) => name);

vi.mock('../config', () => ({
  isFirebaseConfigured: () => true,
  db: { type: 'mockDb' },
  auth: null,
  app: null,
}));

vi.mock('firebase/firestore', () => ({
  collection: (db: any, name: string) => mockCollection(db, name),
  query: (...args: any[]) => mockQuery(...args),
  where: (field: string, op: string, val: any) => mockWhere(field, op, val),
  orderBy: (field: string, dir: string) => mockOrderBy(field, dir),
  limit: (num: number) => mockLimit(num),
  getDocs: (q: any) => mockGetDocs(q),
  writeBatch: () => mockBatch,
}));

const mockPruneStaleGuestSessions = vi.fn().mockResolvedValue(undefined);
vi.mock('../presenceService', () => ({
  pruneStaleGuestSessions: () => mockPruneStaleGuestSessions(),
}));

import { cleanupAbandonedGames } from '../gameCleanupService';

describe('gameCleanupService with Firestore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queries abandoned and waiting games with numeric timestamps rather than Firestore Timestamps', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });

    await cleanupAbandonedGames(600_000);

    // Verify where calls
    const whereCalls = mockWhere.mock.calls;
    expect(whereCalls.length).toBeGreaterThanOrEqual(2);

    // Abandoned query
    const abandonedStatusWhere = whereCalls.find(
      (c) => c[0] === 'status' && c[2] === 'abandoned'
    );
    expect(abandonedStatusWhere).toBeDefined();

    const abandonedTimeWhere = whereCalls.find(
      (c) => c[0] === 'createdAt' && c[1] === '<='
    );
    expect(abandonedTimeWhere).toBeDefined();
    // Verify the cutoff is a number (primitive numeric timestamp)
    expect(typeof abandonedTimeWhere![2]).toBe('number');
    expect(isNaN(abandonedTimeWhere![2])).toBe(false);

    // Waiting query
    const waitingStatusWhere = whereCalls.find(
      (c) => c[0] === 'status' && c[2] === 'waiting'
    );
    expect(waitingStatusWhere).toBeDefined();

    // Verify pruneStaleGuestSessions was invoked
    expect(mockPruneStaleGuestSessions).toHaveBeenCalledTimes(1);
  });

  it('deletes stale abandoned games and updates waiting games in Firestore batch', async () => {
    const mockAbandonedDoc = {
      id: 'stale_abandoned_game',
      ref: { id: 'stale_abandoned_game' },
      data: () => ({
        id: 'stale_abandoned_game',
        status: 'abandoned',
        createdAt: Date.now() - 1_000_000,
        abandonedAt: Date.now() - 800_000,
      }),
    };

    const mockWaitingDoc = {
      id: 'stale_waiting_game',
      ref: { id: 'stale_waiting_game' },
      data: () => ({
        id: 'stale_waiting_game',
        status: 'waiting',
        timeControlMinutes: 5,
        createdAt: Date.now() - 1_000_000,
      }),
    };

    // Return abandonedDoc for 1st getDocs, empty for inProgress (2nd), waitingDoc for 3rd
    mockGetDocs
      .mockResolvedValueOnce({ docs: [mockAbandonedDoc] })
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({ docs: [mockWaitingDoc] });

    const removed = await cleanupAbandonedGames(600_000);

    expect(removed).toContain('stale_abandoned_game');
    expect(mockDeleteDoc).toHaveBeenCalledWith(mockAbandonedDoc.ref);
    expect(mockUpdateDoc).toHaveBeenCalledWith(mockWaitingDoc.ref, expect.objectContaining({
      status: 'abandoned',
      lastTurnStartTimeMs: null,
    }));
    expect(mockCommit).toHaveBeenCalled();
  });
});
