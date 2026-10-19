import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../config', () => ({
  isFirebaseConfigured: () => false,
  db: null,
  auth: null,
  app: null,
}));

import {
  sortLobbyRooms,
  getOpenRooms,
  getInProgressRooms,
  subscribeToOpenRooms,
  findOpenWaitingGame,
} from '../lobbyService';
import { localGameStore } from '../localGameStore';
import type { GameRoom } from '../gameTypes';
import { createInitialGameState } from '@/core/schada/engine';

function createMockRoom(overrides: Partial<GameRoom> = {}): GameRoom {
  return {
    id: `room_${Math.random().toString(36).substring(2, 9)}`,
    status: 'waiting',
    isPrivate: false,
    isRanked: true,
    timeControlMinutes: 5,
    incrementSeconds: 0,
    createdAt: Date.now(),
    boardState: createInitialGameState(),
    creatorColorPref: 'random',
    currentTurn: 'white',
    whitePlayer: null,
    blackPlayer: null,
    whiteTimeMs: 300000,
    blackTimeMs: 300000,
    blueTimeMs: 300000,
    greenTimeMs: 300000,
    lastTurnStartTimeMs: null,
    ...overrides,
  };
}

describe('lobbyService', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    const all = localGameStore.getAll();
    for (const key of Object.keys(all)) {
      localGameStore.delete(key);
    }
  });

  it('validates arguments and throws on invalid inputs', async () => {
    expect(() => sortLobbyRooms(null as any)).toThrow(TypeError);
    await expect(getOpenRooms(-1)).rejects.toThrow(RangeError);
    await expect(getInProgressRooms(-5)).rejects.toThrow(RangeError);
    expect(() => subscribeToOpenRooms(null as any)).toThrow(TypeError);
    expect(() => subscribeToOpenRooms(() => {}, -1)).toThrow(RangeError);
  });

  it('sorts lobby rooms prioritizing waiting before in-progress and newer before older', () => {
    const olderWaiting = createMockRoom({
      id: 'w_old',
      status: 'waiting',
      createdAt: 1000,
    });
    const newerWaiting = createMockRoom({
      id: 'w_new',
      status: 'waiting',
      createdAt: 2000,
    });
    const liveMatch = createMockRoom({
      id: 'live',
      status: 'in_progress',
      createdAt: 3000,
      whitePlayer: { id: 'p1', username: 'P1', elo: 1200, sessionToken: 't1' },
      blackPlayer: { id: 'p2', username: 'P2', elo: 1200, sessionToken: 't2' },
    });

    const sorted = sortLobbyRooms([olderWaiting, liveMatch, newerWaiting]);
    expect(sorted.map((r) => r.id)).toEqual(['w_new', 'w_old', 'live']);
  });

  it('getOpenRooms filters private games and respects includeInProgress flag', async () => {
    const publicWaiting = createMockRoom({ id: 'pub_wait', status: 'waiting', isPrivate: false });
    const privateWaiting = createMockRoom({ id: 'priv_wait', status: 'waiting', isPrivate: true });
    const publicLive = createMockRoom({
      id: 'pub_live',
      status: 'in_progress',
      isPrivate: false,
      whitePlayer: { id: 'p1', username: 'P1', elo: 1200, sessionToken: 't1' },
      blackPlayer: { id: 'p2', username: 'P2', elo: 1200, sessionToken: 't2' },
    });

    localGameStore.set(publicWaiting);
    localGameStore.set(privateWaiting);
    localGameStore.set(publicLive);

    const waitingOnly = await getOpenRooms(10, false);
    expect(waitingOnly.map((r) => r.id)).toEqual(['pub_wait']);

    const allOpen = await getOpenRooms(10, true);
    expect(allOpen.map((r) => r.id)).toEqual(['pub_wait', 'pub_live']);
  });

  it('getInProgressRooms returns only non-private in-progress rooms', async () => {
    const publicWaiting = createMockRoom({ id: 'w1', status: 'waiting', isPrivate: false });
    const publicLive = createMockRoom({
      id: 'live1',
      status: 'in_progress',
      isPrivate: false,
      whitePlayer: { id: 'p1', username: 'P1', elo: 1200, sessionToken: 't1' },
      blackPlayer: { id: 'p2', username: 'P2', elo: 1200, sessionToken: 't2' },
    });

    localGameStore.set(publicWaiting);
    localGameStore.set(publicLive);

    const liveRooms = await getInProgressRooms();
    expect(liveRooms.map((r) => r.id)).toEqual(['live1']);
  });

  it('subscribes to open rooms and emits updates on store change', () => {
    const emitted: GameRoom[][] = [];
    const unsub = subscribeToOpenRooms((rooms) => {
      emitted.push(rooms);
    }, 10, true);

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toHaveLength(0);

    const newRoom = createMockRoom({ id: 'r1', status: 'waiting', isPrivate: false });
    localGameStore.set(newRoom);

    expect(emitted.length).toBeGreaterThanOrEqual(2);
    expect(emitted[emitted.length - 1][0].id).toBe('r1');

    unsub();
  });

  it('findOpenWaitingGame finds eligible matching rooms and excludes self-pairing', async () => {
    const hostUser = 'user_host_123';
    const room1 = createMockRoom({
      id: 'match_1',
      status: 'waiting',
      isPrivate: false,
      isRanked: true,
      timeControlMinutes: 5,
      incrementSeconds: 0,
      whitePlayer: { id: hostUser, username: 'HostUser', elo: 1200, sessionToken: 'host_token' },
    });
    localGameStore.set(room1);

    // Self-exclusion test
    const selfFound = await findOpenWaitingGame(5, 0, hostUser, 5, true);
    expect(selfFound).toBeNull();

    // Other player discovery test
    const otherFound = await findOpenWaitingGame(5, 0, 'user_challenger', 5, true);
    expect(otherFound).not.toBeNull();
    expect(otherFound?.id).toBe('match_1');
  });
});
