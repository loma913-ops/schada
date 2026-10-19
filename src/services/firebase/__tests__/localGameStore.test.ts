import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { GameRoom } from '../gameTypes';

class StorageMock {
  private store: Record<string, string> = {};

  get length() {
    return Object.keys(this.store).length;
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }

  getItem(key: string) {
    return this.store[key] ?? null;
  }

  setItem(key: string, val: string) {
    this.store[key] = String(val);
  }

  removeItem(key: string) {
    delete this.store[key];
  }

  clear() {
    this.store = {};
  }
}

if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as unknown as { localStorage: StorageMock }).localStorage = new StorageMock();
}

// Mock BroadcastChannel for node environment
class MockBroadcastChannel {
  public name: string;
  public onmessage: ((event: { data: unknown }) => void) | null = null;
  private static channels: Map<string, Set<MockBroadcastChannel>> = new Map();

  constructor(name: string) {
    this.name = name;
    let set = MockBroadcastChannel.channels.get(name);
    if (!set) {
      set = new Set();
      MockBroadcastChannel.channels.set(name, set);
    }
    set.add(this);
  }

  postMessage(data: unknown) {
    const set = MockBroadcastChannel.channels.get(this.name);
    if (set) {
      set.forEach((ch) => {
        if (ch !== this && ch.onmessage) {
          ch.onmessage({ data });
        }
      });
    }
  }

  close() {
    const set = MockBroadcastChannel.channels.get(this.name);
    if (set) {
      set.delete(this);
    }
  }

  static reset() {
    MockBroadcastChannel.channels.clear();
  }
}

(globalThis as unknown as { BroadcastChannel: typeof MockBroadcastChannel }).BroadcastChannel = MockBroadcastChannel;
if (typeof window === 'undefined') {
  const eventListeners = new Map<string, Set<(e: unknown) => void>>();
  (globalThis as unknown as { window: unknown }).window = {
    addEventListener: (type: string, listener: (e: unknown) => void) => {
      if (!eventListeners.has(type)) eventListeners.set(type, new Set());
      eventListeners.get(type)?.add(listener);
    },
    removeEventListener: (type: string, listener: (e: unknown) => void) => {
      eventListeners.get(type)?.delete(listener);
    },
    dispatchEvent: (type: string, event: unknown) => {
      eventListeners.get(type)?.forEach((cb) => cb(event));
    },
    localStorage: (globalThis as unknown as { localStorage: unknown }).localStorage,
    BroadcastChannel: MockBroadcastChannel,
  };
}

import { LocalGameStore } from '../localGameStore';
import { createInitialGameState } from '@/core/schada/engine';

describe('LocalGameStore multi-tab synchronization and memory storage', () => {
  let storeA: LocalGameStore;
  let storeB: LocalGameStore;

  const initialBoardState = createInitialGameState();

  const mockGameRoom: GameRoom = {
    id: 'game_tab_123',
    isPrivate: false,
    status: 'in_progress',
    createdAt: Date.now(),
    timeControlMinutes: 5,
    incrementSeconds: 0,
    isRanked: false,
    creatorColorPref: 'white',
    whitePlayer: { id: 'u_white', username: 'whitePlayer', elo: 1500, sessionToken: 'token_white' },
    blackPlayer: { id: 'u_black', username: 'blackPlayer', elo: 1500, sessionToken: 'token_black' },
    boardState: initialBoardState,
    currentTurn: 'white',
    whiteTimeMs: 300000,
    blackTimeMs: 300000,
    blueTimeMs: 300000,
    greenTimeMs: 300000,
    lastTurnStartTimeMs: Date.now(),
  };

  beforeEach(() => {
    localStorage.clear();
    MockBroadcastChannel.reset();
    storeA = new LocalGameStore();
    storeB = new LocalGameStore();
  });

  afterEach(() => {
    storeA.clear();
    storeB.clear();
    vi.restoreAllMocks();
  });

  it('stores and retrieves games in localStorage and memoryStore', () => {
    storeA.set(mockGameRoom);

    const retrievedA = storeA.get('game_tab_123');
    expect(retrievedA).not.toBeNull();
    expect(retrievedA?.id).toBe('game_tab_123');
    expect(retrievedA?.currentTurn).toBe('white');

    const rawAll = storeA.getAll();
    expect(rawAll['game_tab_123']).toBeDefined();
  });

  it('synchronizes GAME_UPDATED across tabs and updates memoryStore in peer store', () => {
    let peerReceivedGame: GameRoom | null = null;
    const subscriberMock = vi.fn((game: GameRoom | null) => {
      peerReceivedGame = game;
    });

    // Subscribe storeB (peer tab) to the gameId
    const unsubscribe = (storeB as unknown as { listeners: Map<string, Set<(g: GameRoom | null) => void>> })
      .listeners;
    if (!unsubscribe.has('game_tab_123')) {
      unsubscribe.set('game_tab_123', new Set());
    }
    unsubscribe.get('game_tab_123')?.add(subscriberMock);

    // Update from storeA
    const updatedGame: GameRoom = {
      ...mockGameRoom,
      boardState: {
        ...mockGameRoom.boardState,
        moveHistory: [
          {
            from: 'b2',
            to: 'b3',
            piece: { id: 'w_p1', type: 'pawn', color: 'white', hasLeftBase: false, hasReachedGoal: false },
            intermediateSquares: [],
            notation: 'b2-b3',
          },
        ],
        currentTurn: 'black',
      },
      currentTurn: 'black',
    };

    storeA.set(updatedGame);

    // Subscriber in storeB should be called immediately
    expect(subscriberMock).toHaveBeenCalledTimes(1);
    expect(peerReceivedGame).not.toBeNull();
    expect((peerReceivedGame as unknown as GameRoom)?.currentTurn).toBe('black');

    // storeB's memoryStore must contain the updated game
    const storeBMemory = (storeB as unknown as { memoryStore: Record<string, GameRoom> }).memoryStore;
    expect(storeBMemory['game_tab_123']).toBeDefined();
    expect(storeBMemory['game_tab_123'].currentTurn).toBe('black');
  });

  it('synchronizes GAME_DELETED across tabs and cleans memoryStore in peer store', () => {
    // First set game so both stores have it in localStorage
    storeA.set(mockGameRoom);

    // Prime storeB memoryStore
    (storeB as unknown as { memoryStore: Record<string, GameRoom> }).memoryStore['game_tab_123'] = mockGameRoom;

    let peerDeleted = false;
    const subscriberMock = vi.fn((game: GameRoom | null) => {
      if (game === null) {
        peerDeleted = true;
      }
    });

    const listenersB = (storeB as unknown as { listeners: Map<string, Set<(g: GameRoom | null) => void>> })
      .listeners;
    if (!listenersB.has('game_tab_123')) {
      listenersB.set('game_tab_123', new Set());
    }
    listenersB.get('game_tab_123')?.add(subscriberMock);

    // Delete in storeA
    storeA.delete('game_tab_123');

    expect(subscriberMock).toHaveBeenCalledWith(null);
    expect(peerDeleted).toBe(true);

    // Verify memoryStore in storeB was cleaned
    const storeBMemory = (storeB as unknown as { memoryStore: Record<string, GameRoom> }).memoryStore;
    expect(storeBMemory['game_tab_123']).toBeUndefined();
  });
});
