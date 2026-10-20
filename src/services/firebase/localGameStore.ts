import { MULTIPLAYER_SCALE_CONFIG } from './multiplayerConfig';
import { LOCAL_CONFIG } from './localConfig';
import { STORAGE_LIMITS, safeSetItem } from '../storage/storageCleanup';
import { isGameTimedOut } from './gameClock';
import { ABANDONED_GAME_EXPIRY_MS, type GameRoom } from './gameTypes';
import type { PieceColor } from '@/core/schada/types';
import { determineTimeCategory, type TimeControlCategory } from '@/components/lobby/lobbyConfig';

export const LOCAL_GAMES_STORAGE_KEY = MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.localGames;

export type TimeoutHandler = (gameId: string, timedOutColor: PieceColor) => Promise<unknown>;

/**
 * Local Game Store — offline, guest, and multi-tab synchronization provider.
 *
 * Uses BroadcastChannel and window storage events to synchronize game state
 * across browser tabs and localStorage without requiring a live Firestore connection.
 */
export class LocalGameStore {
  private channel: BroadcastChannel | null = null;
  private listeners: Map<string, Set<(game: GameRoom | null) => void>> = new Map();
  private globalListeners: Set<() => void> = new Set();
  private memoryStore: Record<string, GameRoom> = {};
  private resolvingTimeout = new Set<string>();
  private timeoutHandler: TimeoutHandler | null = null;

  /**
   * Initializes BroadcastChannel and storage listeners for multi-tab synchronization.
   *
   * Algorithmic Complexity:
   * - Time Complexity: O(S) where S is the number of active subscribers for the updated game ID.
   * - Auxiliary Space Complexity: O(1) constant auxiliary space.
   *
   * Growth Rate:
   * - O(1) in typical operation as subscriber sets contain at most 1–2 component callbacks.
   */
  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(LOCAL_CONFIG.events.gameSyncChannel);
      this.channel.onmessage = (event) => {
        const { type, gameId, game } = event.data || {};
        if (type === 'GAME_UPDATED' && gameId) {
          if (game) {
            this.memoryStore[gameId] = game;
          }
          const subs = this.listeners.get(gameId);
          if (subs) {
            subs.forEach((cb) => cb(game));
          }
        } else if (type === 'GAME_DELETED' && gameId) {
          delete this.memoryStore[gameId];
          const subs = this.listeners.get(gameId);
          if (subs) {
            subs.forEach((cb) => cb(null));
            this.listeners.delete(gameId);
          }
        }
        this.globalListeners.forEach((cb) => cb());
      };
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === LOCAL_GAMES_STORAGE_KEY) {
          const games = this.getAll();
          this.listeners.forEach((subs, gameId) => {
            const game = games[gameId] || null;
            subs.forEach((cb) => cb(game));
          });
          this.globalListeners.forEach((cb) => cb());
        }
      });
    }
  }

  public setTimeoutHandler(handler: TimeoutHandler | null): void {
    this.timeoutHandler = handler;
  }

  public getAll(): Record<string, GameRoom> {
    if (typeof localStorage === 'undefined') {
      return this.memoryStore;
    }
    try {
      return JSON.parse(localStorage.getItem(LOCAL_GAMES_STORAGE_KEY) || '{}');
    } catch {
      return this.memoryStore;
    }
  }

  public getRaw(id: string): GameRoom | null {
    return this.getAll()[id] || null;
  }

  public get(id: string): GameRoom | null {
    const game = this.getRaw(id);
    if (
      game &&
      game.status === 'abandoned' &&
      Date.now() - (game.abandonedAt || game.createdAt) >= ABANDONED_GAME_EXPIRY_MS
    ) {
      this.delete(id);
      return null;
    }
    if (game && game.status === 'in_progress' && !this.resolvingTimeout.has(id)) {
      const timeoutCheck = isGameTimedOut(game);
      if (timeoutCheck.timedOut && timeoutCheck.timedOutColor && this.timeoutHandler) {
        this.resolvingTimeout.add(id);
        this.timeoutHandler(id, timeoutCheck.timedOutColor)
          .catch(() => {})
          .finally(() => {
            this.resolvingTimeout.delete(id);
          });
        return this.getRaw(id);
      }
    }
    return game;
  }

  public set(game: GameRoom): void {
    const games = this.getAll();
    games[game.id] = game;
    this.memoryStore[game.id] = game;

    // Prune oldest local games if exceeding storage limit
    const entries = Object.entries(games);
    if (entries.length > STORAGE_LIMITS.maxLocalGames) {
      const sorted = entries.sort((a, b) => (b[1]?.createdAt || 0) - (a[1]?.createdAt || 0));
      const pruned = Object.fromEntries(sorted.slice(0, STORAGE_LIMITS.maxLocalGames));
      safeSetItem(LOCAL_GAMES_STORAGE_KEY, JSON.stringify(pruned));
    } else {
      safeSetItem(LOCAL_GAMES_STORAGE_KEY, JSON.stringify(games));
    }

    // Notify local callbacks
    const subs = this.listeners.get(game.id);
    if (subs) {
      subs.forEach((cb) => cb(game));
    }
    this.globalListeners.forEach((cb) => cb());

    // Broadcast to other tabs
    if (this.channel) {
      this.channel.postMessage({ type: 'GAME_UPDATED', gameId: game.id, game });
    }
  }

  public delete(id: string): void {
    const games = this.getAll();
    delete games[id];
    delete this.memoryStore[id];

    safeSetItem(LOCAL_GAMES_STORAGE_KEY, JSON.stringify(games));

    // Notify local callbacks
    const subs = this.listeners.get(id);
    if (subs) {
      subs.forEach((cb) => cb(null));
      this.listeners.delete(id);
    }
    this.globalListeners.forEach((cb) => cb());

    // Broadcast to other tabs
    if (this.channel) {
      this.channel.postMessage({ type: 'GAME_DELETED', gameId: id });
    }
  }

  public clear(): void {
    this.memoryStore = {};
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(LOCAL_GAMES_STORAGE_KEY);
    }
  }

  public subscribe(gameId: string, callback: (game: GameRoom | null) => void): () => void {
    if (!this.listeners.has(gameId)) {
      this.listeners.set(gameId, new Set());
    }
    this.listeners.get(gameId)!.add(callback);
    callback(this.get(gameId));

    return () => {
      const subs = this.listeners.get(gameId);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.listeners.delete(gameId);
        }
      }
    };
  }

  public subscribeToAnyChange(callback: () => void): () => void {
    this.globalListeners.add(callback);
    return () => {
      this.globalListeners.delete(callback);
    };
  }

  /**
   * Retrieves paginated completed match records for a player, optionally filtered by mode.
   *
   * Algorithmic Complexity:
   * - Time Complexity: O(M log M) where M is total local completed games for sorting.
   * - Auxiliary Space Complexity: O(K) where K = limitCount.
   *
   * @param userId Player identifier to filter matches.
   * @param mode Optional time control category filter ('all' or specific mode).
   * @param limitCount Maximum records to return.
   * @param offset Slicing offset for client-side pagination.
   */
  public getPlayerMatchHistory(
    userId: string,
    mode?: TimeControlCategory | 'all',
    limitCount: number = MULTIPLAYER_SCALE_CONFIG.matchmaking.matchHistoryPageLimit,
    offset: number = 0
  ): { games: GameRoom[]; hasMore: boolean } {
    if (!userId) return { games: [], hasMore: false };
    const all = this.getAll();
    const candidateGames = Object.values(all).filter((g) => {
      if (g.status !== 'completed') return false;
      if (!g.boardState?.moveHistory || g.boardState.moveHistory.length === 0) return false;
      const isPlayer =
        (Array.isArray(g.playerIds) && g.playerIds.includes(userId)) ||
        g.whitePlayer?.id === userId ||
        g.blackPlayer?.id === userId;
      if (!isPlayer) return false;
      if (mode && mode !== 'all') {
        const gameMode = g.mode ?? determineTimeCategory(g.timeControlMinutes, g.incrementSeconds || 0);
        if (gameMode !== mode) return false;
      }
      return true;
    });

    candidateGames.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const sliced = candidateGames.slice(offset, offset + limitCount);
    const hasMore = offset + limitCount < candidateGames.length;
    return { games: sliced, hasMore };
  }
}

export const localGameStore = new LocalGameStore();
