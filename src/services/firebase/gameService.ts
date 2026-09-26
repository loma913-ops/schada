import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  runTransaction,
  limit,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import { MULTIPLAYER_SCALE_CONFIG } from './multiplayerConfig';
import type { BoardState, Move, PieceColor } from '@/core/schada/types';
import { createInitialGameState, executeMove, resignGame, timeoutGame } from '@/core/schada/engine';
import type { ArenaPlayer } from '@/components/game/Arena';

export interface GamePlayer extends ArenaPlayer {
  sessionToken: string;
}

export interface GameRoom {
  id: string;
  isPrivate: boolean;
  status: 'waiting' | 'in_progress' | 'completed' | 'abandoned';
  createdAt: number;
  timeControlMinutes: number;
  incrementSeconds: number;
  isRanked: boolean;
  creatorColorPref: PieceColor | 'random';
  bluePlayer: GamePlayer | null;
  greenPlayer: GamePlayer | null;
  boardState: BoardState;
  currentTurn: PieceColor;
  blueTimeMs: number;
  greenTimeMs: number;
  lastTurnStartTimeMs: number | null;
  winner?: PieceColor | 'draw' | null;
  winReason?: string | null;
  abandonedAt?: number;
}

export interface GameTimeoutResult {
  readonly timedOut: boolean;
  readonly timedOutColor?: PieceColor;
}

export const ABANDONED_GAME_EXPIRY_MS = MULTIPLAYER_SCALE_CONFIG.matchmaking.abandonedGameExpiryMs;

/**
 * Evaluates whether an in-progress game has expired based on Fischer/standard clock limits.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time, consisting of atomic numeric comparisons and arithmetic.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - Bounded strictly at O(1) independent of total game history, room size, or global data volume.
 *
 * @param game The target GameRoom to inspect.
 * @returns GameTimeoutResult indicating whether the game has timed out and which player's clock expired.
 */
export function isGameTimedOut(game: GameRoom | null | undefined): GameTimeoutResult {
  if (!game || typeof game !== 'object') {
    return { timedOut: false };
  }
  if (game.status !== 'in_progress' || typeof game.timeControlMinutes !== 'number' || game.timeControlMinutes <= 0) {
    return { timedOut: false };
  }
  if (game.currentTurn !== 'blue' && game.currentTurn !== 'green') {
    return { timedOut: false };
  }
  const now = Date.now();
  const elapsed = typeof game.lastTurnStartTimeMs === 'number' && !isNaN(game.lastTurnStartTimeMs)
    ? Math.max(0, now - game.lastTurnStartTimeMs)
    : 0;
  const currentTurn = game.currentTurn;
  const currentClockMs = currentTurn === 'blue' ? game.blueTimeMs : game.greenTimeMs;
  if (typeof currentClockMs !== 'number' || isNaN(currentClockMs)) {
    return { timedOut: false };
  }
  const remainingTime = currentClockMs - elapsed;
  if (remainingTime <= 0) {
    return { timedOut: true, timedOutColor: currentTurn };
  }
  return { timedOut: false };
}

const SESSION_STORAGE_PREFIX = 'schada_player_token_';
const MOCK_GAMES_STORAGE_KEY = 'schada_mock_games';

// Helper to remove any undefined values for Firestore serialization
function sanitize<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function getLocalSessionToken(gameId: string): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(SESSION_STORAGE_PREFIX + gameId);
}

export function setLocalSessionToken(gameId: string, token: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(SESSION_STORAGE_PREFIX + gameId, token);
}

function generateGameId(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateToken(): string {
  return 'tok_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

// ----------------- Mock Local Channel for Offline / Development -----------------
class MockGameStore {
  private channel: BroadcastChannel | null = null;
  private listeners: Map<string, Set<(game: GameRoom | null) => void>> = new Map();
  private globalListeners: Set<() => void> = new Set();
  private memoryStore: Record<string, GameRoom> = {};

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel('schada_game_sync_channel');
      this.channel.onmessage = (event) => {
        const { type, gameId, game } = event.data || {};
        if (type === 'GAME_UPDATED' && gameId) {
          const subs = this.listeners.get(gameId);
          if (subs) {
            subs.forEach((cb) => cb(game));
          }
        } else if (type === 'GAME_DELETED' && gameId) {
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
        if (e.key === MOCK_GAMES_STORAGE_KEY) {
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

  public getAll(): Record<string, GameRoom> {
    if (typeof localStorage === 'undefined') {
      return this.memoryStore;
    }
    try {
      return JSON.parse(localStorage.getItem(MOCK_GAMES_STORAGE_KEY) || '{}');
    } catch {
      return this.memoryStore;
    }
  }

  private resolvingTimeout = new Set<string>();

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
      if (timeoutCheck.timedOut && timeoutCheck.timedOutColor) {
        this.resolvingTimeout.add(id);
        timeoutGameAction(id, timeoutCheck.timedOutColor)
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

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MOCK_GAMES_STORAGE_KEY, JSON.stringify(games));
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

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MOCK_GAMES_STORAGE_KEY, JSON.stringify(games));
    }

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
      localStorage.removeItem(MOCK_GAMES_STORAGE_KEY);
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
}

const mockStore = new MockGameStore();

// ----------------- Exported Service API -----------------

export interface CreateGameParams {
  timeControlMinutes: number;
  incrementSeconds?: number;
  isRanked?: boolean;
  colorPref?: PieceColor | 'random';
  isPrivate?: boolean;
  creator: {
    id: string;
    username: string;
    elo: number;
  };
}

export async function createGame(params: CreateGameParams): Promise<{ gameId: string; sessionToken: string; color: PieceColor }> {
  const gameId = generateGameId();
  const sessionToken = generateToken();
  const initialTimeMs = params.timeControlMinutes > 0 ? params.timeControlMinutes * 60 * 1000 : 0;

  // Determine initial color assignment
  const colorPref = params.colorPref || 'random';
  let creatorColor: PieceColor;
  if (colorPref === 'random') {
    creatorColor = Math.random() < 0.5 ? 'blue' : 'green';
  } else {
    creatorColor = colorPref;
  }

  const creatorPlayer: GamePlayer = {
    id: params.creator.id,
    username: params.creator.username,
    elo: params.creator.elo,
    sessionToken,
  };

  const initialBoard = createInitialGameState();

  const newGame: GameRoom = {
    id: gameId,
    isPrivate: Boolean(params.isPrivate),
    status: 'waiting',
    createdAt: Date.now(),
    timeControlMinutes: params.timeControlMinutes,
    incrementSeconds: params.incrementSeconds || 0,
    isRanked: Boolean(params.isRanked),
    creatorColorPref: colorPref,
    bluePlayer: creatorColor === 'blue' ? creatorPlayer : null,
    greenPlayer: creatorColor === 'green' ? creatorPlayer : null,
    boardState: initialBoard,
    currentTurn: 'blue',
    blueTimeMs: initialTimeMs,
    greenTimeMs: initialTimeMs,
    lastTurnStartTimeMs: null,
  };

  setLocalSessionToken(gameId, sessionToken);

  if (isFirebaseConfigured() && db) {
    const docRef = doc(db, 'games', gameId);
    await setDoc(docRef, sanitize(newGame));
  } else {
    mockStore.set(newGame);
  }

  return { gameId, sessionToken, color: creatorColor };
}

export interface JoinGameResult {
  success: boolean;
  role: 'player' | 'spectator';
  color?: PieceColor;
  sessionToken?: string;
  error?: string;
}

export async function joinGame(
  gameId: string,
  user: { id: string; username: string; elo: number }
): Promise<JoinGameResult> {
  const existingToken = getLocalSessionToken(gameId);

  // If live Firebase is configured, execute atomic transaction to prevent race conditions
  if (isFirebaseConfigured() && db) {
    const docRef = doc(db, 'games', gameId);
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists()) {
        return { success: false, role: 'spectator', error: 'Game not found.' };
      }
      const game = snap.data() as GameRoom;

      // Check if existing token matches already assigned player
      if (existingToken) {
        if (game.bluePlayer && game.bluePlayer.sessionToken === existingToken) {
          return { success: true, role: 'player', color: 'blue', sessionToken: existingToken };
        }
        if (game.greenPlayer && game.greenPlayer.sessionToken === existingToken) {
          return { success: true, role: 'player', color: 'green', sessionToken: existingToken };
        }
      }

      // Check if user ID matches one of the seated players (e.g. re-login on another browser)
      if (game.bluePlayer && game.bluePlayer.id === user.id) {
        const token = game.bluePlayer.sessionToken || generateToken();
        setLocalSessionToken(gameId, token);
        return { success: true, role: 'player', color: 'blue', sessionToken: token };
      }
      if (game.greenPlayer && game.greenPlayer.id === user.id) {
        const token = game.greenPlayer.sessionToken || generateToken();
        setLocalSessionToken(gameId, token);
        return { success: true, role: 'player', color: 'green', sessionToken: token };
      }

      // If game is waiting for an opponent, atomically claim the empty seat!
      if (game.status === 'waiting') {
        const newToken = generateToken();
        setLocalSessionToken(gameId, newToken);

        const joiningPlayer: GamePlayer = {
          id: user.id,
          username: user.username,
          elo: user.elo,
          sessionToken: newToken,
        };

        let assignedColor: PieceColor;
        const updatePayload: Partial<GameRoom> = {
          status: 'in_progress',
          lastTurnStartTimeMs: Date.now(),
        };

        if (!game.bluePlayer) {
          assignedColor = 'blue';
          updatePayload.bluePlayer = joiningPlayer;
        } else {
          assignedColor = 'green';
          updatePayload.greenPlayer = joiningPlayer;
        }

        tx.update(docRef, sanitize(updatePayload));
        return { success: true, role: 'player', color: assignedColor, sessionToken: newToken };
      }

      // Otherwise, game is full or in progress with two players -> join as Spectator
      return { success: true, role: 'spectator' };
    });
  }

  // Local / Mock store implementation for offline and tests
  const game = mockStore.get(gameId);
  if (!game) {
    return { success: false, role: 'spectator', error: 'Game not found.' };
  }

  if (existingToken) {
    if (game.bluePlayer && game.bluePlayer.sessionToken === existingToken) {
      return { success: true, role: 'player', color: 'blue', sessionToken: existingToken };
    }
    if (game.greenPlayer && game.greenPlayer.sessionToken === existingToken) {
      return { success: true, role: 'player', color: 'green', sessionToken: existingToken };
    }
  }

  if (game.bluePlayer && game.bluePlayer.id === user.id) {
    const token = game.bluePlayer.sessionToken || generateToken();
    setLocalSessionToken(gameId, token);
    return { success: true, role: 'player', color: 'blue', sessionToken: token };
  }
  if (game.greenPlayer && game.greenPlayer.id === user.id) {
    const token = game.greenPlayer.sessionToken || generateToken();
    setLocalSessionToken(gameId, token);
    return { success: true, role: 'player', color: 'green', sessionToken: token };
  }

  if (game.status === 'waiting') {
    const newToken = generateToken();
    setLocalSessionToken(gameId, newToken);

    const joiningPlayer: GamePlayer = {
      id: user.id,
      username: user.username,
      elo: user.elo,
      sessionToken: newToken,
    };

    let assignedColor: PieceColor;
    if (!game.bluePlayer) {
      assignedColor = 'blue';
      game.bluePlayer = joiningPlayer;
    } else {
      assignedColor = 'green';
      game.greenPlayer = joiningPlayer;
    }

    game.status = 'in_progress';
    game.lastTurnStartTimeMs = Date.now();
    mockStore.set(game);

    return { success: true, role: 'player', color: assignedColor, sessionToken: newToken };
  }

  return { success: true, role: 'spectator' };
}

export function subscribeToGame(
  gameId: string,
  onUpdate: (game: GameRoom | null) => void,
  onError?: (err: Error) => void
): () => void {
  if (isFirebaseConfigured() && db) {
    const docRef = doc(db, 'games', gameId);
    return onSnapshot(
      docRef,
      async (snap) => {
        if (!snap.exists()) {
          onUpdate(null);
        } else {
          const game = snap.data() as GameRoom;
          if (
            game.status === 'abandoned' &&
            Date.now() - (game.abandonedAt || game.createdAt) >= ABANDONED_GAME_EXPIRY_MS
          ) {
            try {
              await deleteDoc(docRef);
              if (typeof localStorage !== 'undefined') {
                localStorage.removeItem(SESSION_STORAGE_PREFIX + gameId);
              }
            } catch (err) {
              console.warn('Error deleting expired abandoned game in subscription:', err);
            }
            onUpdate(null);
            return;
          }
          if (game.status === 'in_progress') {
            const timeoutCheck = isGameTimedOut(game);
            if (timeoutCheck.timedOut && timeoutCheck.timedOutColor) {
              timeoutGameAction(gameId, timeoutCheck.timedOutColor).catch((err) => {
                console.warn('Error auto-timing out game in subscription:', err);
              });
            }
          }
          onUpdate(game);
        }
      },
      (err) => {
        if (onError) onError(err);
      }
    );
  }

  return mockStore.subscribe(gameId, onUpdate);
}

export async function makeGameMove(
  gameId: string,
  move: Move,
  playerColor: PieceColor
): Promise<void> {
  if (isFirebaseConfigured() && db) {
    const docRef = doc(db, 'games', gameId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists()) {
        throw new Error('Game not found.');
      }
      const game = snap.data() as GameRoom;
      if (game.status !== 'in_progress') {
        throw new Error('Game is not in progress.');
      }
      if (game.currentTurn !== playerColor) {
        throw new Error('It is not your turn.');
      }

      // Calculate clock consumption
      const now = Date.now();
      let nextBlueTime = game.blueTimeMs;
      let nextGreenTime = game.greenTimeMs;

      if (game.timeControlMinutes > 0 && game.lastTurnStartTimeMs) {
        const elapsed = Math.max(0, now - game.lastTurnStartTimeMs);
        const incrementMs = game.incrementSeconds * 1000;

        if (playerColor === 'blue') {
          nextBlueTime = Math.max(0, game.blueTimeMs - elapsed + incrementMs);
        } else {
          nextGreenTime = Math.max(0, game.greenTimeMs - elapsed + incrementMs);
        }
      }

      // Execute move via engine
      const nextBoardState = executeMove(game.boardState, move);
      const nextTurn: PieceColor = playerColor === 'blue' ? 'green' : 'blue';

      const updatePayload: Partial<GameRoom> = {
        boardState: nextBoardState,
        currentTurn: nextTurn,
        blueTimeMs: nextBlueTime,
        greenTimeMs: nextGreenTime,
        lastTurnStartTimeMs: nextBoardState.isGameOver ? null : now,
      };

      if (nextBoardState.isGameOver) {
        updatePayload.status = 'completed';
        updatePayload.winner = nextBoardState.result?.winner;
        updatePayload.winReason = nextBoardState.result?.winReason;
      }

      tx.update(docRef, sanitize(updatePayload));
    });
    return;
  }

  // Local / Mock store implementation for tests and offline
  const game = mockStore.get(gameId);
  if (!game || game.status !== 'in_progress') {
    throw new Error('Game is not in progress.');
  }

  if (game.currentTurn !== playerColor) {
    throw new Error('It is not your turn.');
  }

  const now = Date.now();
  let nextBlueTime = game.blueTimeMs;
  let nextGreenTime = game.greenTimeMs;

  if (game.timeControlMinutes > 0 && game.lastTurnStartTimeMs) {
    const elapsed = Math.max(0, now - game.lastTurnStartTimeMs);
    const incrementMs = game.incrementSeconds * 1000;

    if (playerColor === 'blue') {
      nextBlueTime = Math.max(0, game.blueTimeMs - elapsed + incrementMs);
    } else {
      nextGreenTime = Math.max(0, game.greenTimeMs - elapsed + incrementMs);
    }
  }

  const nextBoardState = executeMove(game.boardState, move);
  const nextTurn: PieceColor = playerColor === 'blue' ? 'green' : 'blue';

  const updatePayload: Partial<GameRoom> = {
    boardState: nextBoardState,
    currentTurn: nextTurn,
    blueTimeMs: nextBlueTime,
    greenTimeMs: nextGreenTime,
    lastTurnStartTimeMs: nextBoardState.isGameOver ? null : now,
  };

  if (nextBoardState.isGameOver) {
    updatePayload.status = 'completed';
    updatePayload.winner = nextBoardState.result?.winner;
    updatePayload.winReason = nextBoardState.result?.winReason;
  }

  mockStore.set({ ...game, ...updatePayload });
}

export async function resignGameAction(
  gameId: string,
  resigningColor: PieceColor
): Promise<void> {
  let game: GameRoom | null = null;
  if (isFirebaseConfigured() && db) {
    const snap = await getDoc(doc(db, 'games', gameId));
    if (snap.exists()) {
      game = snap.data() as GameRoom;
    }
  } else {
    game = mockStore.get(gameId);
  }

  if (!game || game.status !== 'in_progress') return;

  const nextBoardState = resignGame(game.boardState, resigningColor);
  const updatePayload: Partial<GameRoom> = {
    boardState: nextBoardState,
    status: 'completed',
    winner: nextBoardState.result?.winner,
    winReason: nextBoardState.result?.winReason,
    lastTurnStartTimeMs: null,
  };

  if (isFirebaseConfigured() && db) {
    await updateDoc(doc(db, 'games', gameId), sanitize(updatePayload));
  } else {
    mockStore.set({ ...game, ...updatePayload });
  }
}

export async function timeoutGameAction(
  gameId: string,
  timedOutColor: PieceColor
): Promise<void> {
  let game: GameRoom | null = null;
  if (isFirebaseConfigured() && db) {
    const snap = await getDoc(doc(db, 'games', gameId));
    if (snap.exists()) {
      game = snap.data() as GameRoom;
    }
  } else {
    game = mockStore.getRaw(gameId);
  }

  if (!game || game.status !== 'in_progress') return;

  const nextBoardState = timeoutGame(game.boardState, timedOutColor);
  const updatePayload: Partial<GameRoom> = {
    boardState: nextBoardState,
    status: 'completed',
    winner: nextBoardState.result?.winner,
    winReason: nextBoardState.result?.winReason,
    lastTurnStartTimeMs: null,
  };

  if (isFirebaseConfigured() && db) {
    await updateDoc(doc(db, 'games', gameId), sanitize(updatePayload));
  } else {
    mockStore.set({ ...game, ...updatePayload });
  }
}

export async function abandonGame(gameId: string): Promise<void> {
  let game: GameRoom | null = null;
  if (isFirebaseConfigured() && db) {
    const snap = await getDoc(doc(db, 'games', gameId));
    if (snap.exists()) {
      game = snap.data() as GameRoom;
    }
  } else {
    game = mockStore.get(gameId);
  }

  if (!game) return;

  const now = Date.now();
  const updatePayload: Partial<GameRoom> = {
    status: 'abandoned',
    abandonedAt: now,
    lastTurnStartTimeMs: null,
  };

  if (isFirebaseConfigured() && db) {
    await updateDoc(doc(db, 'games', gameId), sanitize(updatePayload));
  } else {
    mockStore.set({ ...game, ...updatePayload });
  }
}

export async function deleteGame(gameId: string): Promise<void> {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(SESSION_STORAGE_PREFIX + gameId);
  }

  if (isFirebaseConfigured() && db) {
    await deleteDoc(doc(db, 'games', gameId));
  } else {
    mockStore.delete(gameId);
  }
}

/**
 * Removes abandoned games and auto-resolves timed-out in-progress games.
 * Bounded by maxCleanupBatchSize to ensure sustainable O(K) query scaling.
 *
 * Algorithmic Complexity (Big O):
 * - Firestore Mode:
 *   - Query Time Complexity: O(log N + K) where N is total matching documents in the Firestore index
 *     and K = MULTIPLAYER_SCALE_CONFIG.matchmaking.maxCleanupBatchSize (K <= 50).
 *   - Processing Time Complexity: O(K) bounded iterations per batch.
 *   - Auxiliary Space Complexity: O(K) memory for the fetched document snapshots.
 *   - Growth Rate: Strictly sub-linear / constant per cycle O(K) as overall database volume N scales to millions of matches.
 * - Local / Mock Mode:
 *   - Iteration Time Complexity: O(min(M, K)) where M is total mock games in localStorage and K is maxCleanupBatchSize.
 *   - Auxiliary Space Complexity: O(K) for tracking removed identifiers.
 *
 * @param maxAgeMs Maximum inactivity age in milliseconds before an abandoned game is deleted.
 * @returns Array of document IDs removed.
 * @throws RangeError if maxAgeMs is invalid or negative.
 */
export async function cleanupAbandonedGames(maxAgeMs: number = ABANDONED_GAME_EXPIRY_MS): Promise<string[]> {
  if (typeof maxAgeMs !== 'number' || isNaN(maxAgeMs) || maxAgeMs < 0) {
    throw new RangeError(
      `cleanupAbandonedGames: Invalid maxAgeMs. Expected non-negative number, received ${maxAgeMs}.`
    );
  }

  const now = Date.now();
  const removedIds: string[] = [];
  const batchLimit = MULTIPLAYER_SCALE_CONFIG.matchmaking.maxCleanupBatchSize;

  if (isFirebaseConfigured() && db) {
    try {
      // 1. Remove games explicitly marked as 'abandoned' for maxAgeMs (bounded to batchLimit)
      const qAbandoned = query(
        collection(db, 'games'),
        where('status', '==', 'abandoned'),
        limit(batchLimit)
      );
      const snapAbandoned = await getDocs(qAbandoned);
      for (const docSnap of snapAbandoned.docs) {
        const game = docSnap.data() as GameRoom;
        const abandonedTime = game.abandonedAt || game.createdAt;
        if (abandonedTime && now - abandonedTime >= maxAgeMs) {
          await deleteDoc(doc(db, 'games', docSnap.id));
          removedIds.push(docSnap.id);
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(SESSION_STORAGE_PREFIX + docSnap.id);
          }
        }
      }

      // 2. Auto-resolve in-progress games that have timed out (bounded to batchLimit)
      const qInProgress = query(
        collection(db, 'games'),
        where('status', '==', 'in_progress'),
        limit(batchLimit)
      );
      const snapInProgress = await getDocs(qInProgress);
      for (const docSnap of snapInProgress.docs) {
        const game = docSnap.data() as GameRoom;
        const timeoutCheck = isGameTimedOut(game);
        if (timeoutCheck.timedOut && timeoutCheck.timedOutColor) {
          await timeoutGameAction(docSnap.id, timeoutCheck.timedOutColor).catch((err) => {
            console.warn('Failed to timeout in-progress game in cleanup:', docSnap.id, err);
          });
        }
      }

      // 3. Mark stale waiting games as abandoned if older than maxAgeMs (when maxAgeMs > 0, bounded to batchLimit)
      if (maxAgeMs > 0) {
        const qWaiting = query(
          collection(db, 'games'),
          where('status', '==', 'waiting'),
          limit(batchLimit)
        );
        const snapWaiting = await getDocs(qWaiting);
        for (const docSnap of snapWaiting.docs) {
          const game = docSnap.data() as GameRoom;
          if (game.createdAt && now - game.createdAt >= maxAgeMs) {
            await abandonGame(docSnap.id).catch((err) => {
              console.warn('Failed to abandon stale waiting game in cleanup:', docSnap.id, err);
            });
          }
        }
      }
    } catch (err) {
      console.warn('Failed to cleanup abandoned games from Firestore:', err);
    }
  } else {
    const all = mockStore.getAll();
    let processedCount = 0;
    for (const [id, game] of Object.entries(all)) {
      if (processedCount >= batchLimit) break;
      if (game.status === 'abandoned') {
        const abandonedTime = game.abandonedAt || game.createdAt;
        if (abandonedTime && now - abandonedTime >= maxAgeMs) {
          mockStore.delete(id);
          removedIds.push(id);
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(SESSION_STORAGE_PREFIX + id);
          }
          processedCount++;
        }
      } else if (game.status === 'in_progress') {
        const timeoutCheck = isGameTimedOut(game);
        if (timeoutCheck.timedOut && timeoutCheck.timedOutColor) {
          timeoutGameAction(id, timeoutCheck.timedOutColor).catch(() => {});
          processedCount++;
        }
      } else if (game.status === 'waiting' && maxAgeMs > 0) {
        if (game.createdAt && now - game.createdAt >= maxAgeMs) {
          abandonGame(id).catch(() => {});
          processedCount++;
        }
      }
    }
  }

  return removedIds;
}

/**
 * Starts a recurring background watcher that cleans up abandoned and timed-out games.
 *
 * Algorithmic Complexity (Big O):
 * - Invocations: Scheduled at O(1) interval rate (intervalMs).
 * - Per execution: Bounded by cleanupAbandonedGames' O(K) batch ceiling (K <= 50).
 *
 * @param intervalMs Milliseconds between cleanup runs.
 * @returns Cleanup unregister callback.
 * @throws RangeError if intervalMs is non-positive or invalid.
 */
export function startAbandonedGamesCleanupWatcher(
  intervalMs: number = MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultCleanupIntervalMs
): () => void {
  if (typeof intervalMs !== 'number' || isNaN(intervalMs) || intervalMs <= 0) {
    throw new RangeError(
      `startAbandonedGamesCleanupWatcher: Invalid intervalMs. Expected positive number, received ${intervalMs}.`
    );
  }

  cleanupAbandonedGames().catch(() => {});

  if (typeof window === 'undefined') {
    return () => {};
  }

  const intervalId = setInterval(() => {
    cleanupAbandonedGames().catch(() => {});
  }, intervalMs);

  return () => {
    clearInterval(intervalId);
  };
}

/**
 * Orders lobby rooms with optimal algorithmic efficiency:
 * 1. Waiting rooms first (so prospective players immediately discover open rooms to join).
 * 2. In-progress games second (allowing spectators to watch live matches).
 * 3. Chronological sorting (newest first) within each status partition.
 *
 * Algorithmic analysis (Big O):
 * - Partitioning & Timeout Verification: O(N) linear time and space, where N <= maxOpenRoomsLobbyLimit (N <= 50).
 * - Sort per partition: O(N_wait * log N_wait) + O(N_live * log N_live) <= O(N log N).
 * - Memory / Auxiliary Space: O(N) auxiliary space for partitions and result array.
 * - Growth Rate: Strictly bounded since N is capped by maxOpenRoomsLobbyLimit in callers.
 * - Immutability: Returns a newly constructed array without mutating the parameter.
 *
 * @param rooms Array of GameRoom objects to filter and sort.
 * @returns Sorted array of active open rooms.
 * @throws TypeError if rooms is not an array.
 */
export function sortLobbyRooms(rooms: GameRoom[]): GameRoom[] {
  if (!Array.isArray(rooms)) {
    throw new TypeError('sortLobbyRooms: expected an array of GameRoom objects.');
  }

  const waitingRooms: GameRoom[] = [];
  const inProgressRooms: GameRoom[] = [];

  for (let i = 0; i < rooms.length; i++) {
    const room = rooms[i];
    if (room.status === 'waiting') {
      waitingRooms.push(room);
    } else if (room.status === 'in_progress') {
      const timeoutCheck = isGameTimedOut(room);
      if (timeoutCheck.timedOut) {
        if (timeoutCheck.timedOutColor) {
          timeoutGameAction(room.id, timeoutCheck.timedOutColor).catch(() => {});
        }
        continue;
      }
      inProgressRooms.push(room);
    }
  }

  waitingRooms.sort((a, b) => {
    const aTime = typeof a.createdAt === 'number' && !isNaN(a.createdAt) ? a.createdAt : 0;
    const bTime = typeof b.createdAt === 'number' && !isNaN(b.createdAt) ? b.createdAt : 0;
    return bTime - aTime;
  });

  inProgressRooms.sort((a, b) => {
    const aTime = typeof a.createdAt === 'number' && !isNaN(a.createdAt) ? a.createdAt : 0;
    const bTime = typeof b.createdAt === 'number' && !isNaN(b.createdAt) ? b.createdAt : 0;
    return bTime - aTime;
  });

  return [...waitingRooms, ...inProgressRooms];
}

export async function getOpenRooms(
  limitCount: number = MULTIPLAYER_SCALE_CONFIG.matchmaking.maxOpenRoomsLobbyLimit
): Promise<GameRoom[]> {
  if (typeof limitCount !== 'number' || limitCount <= 0 || isNaN(limitCount)) {
    throw new RangeError(
      `getOpenRooms: Invalid limitCount. Expected positive number, received ${limitCount}.`
    );
  }

  cleanupAbandonedGames().catch(() => {});

  if (isFirebaseConfigured() && db) {
    const q = query(
      collection(db, 'games'),
      where('isPrivate', '==', false),
      where('status', 'in', ['waiting', 'in_progress']),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    const rooms = snap.docs.map((docSnap) => docSnap.data() as GameRoom);
    return sortLobbyRooms(rooms);
  }

  const all = mockStore.getAll();
  const rooms = Object.values(all)
    .filter((g) => !g.isPrivate && (g.status === 'waiting' || g.status === 'in_progress'));
  return sortLobbyRooms(rooms).slice(0, limitCount);
}

export function subscribeToOpenRooms(
  callback: (rooms: GameRoom[]) => void,
  maxRooms: number = MULTIPLAYER_SCALE_CONFIG.matchmaking.maxOpenRoomsLobbyLimit
): () => void {
  if (typeof callback !== 'function') {
    throw new TypeError('subscribeToOpenRooms: callback parameter must be a function.');
  }
  if (typeof maxRooms !== 'number' || maxRooms <= 0 || isNaN(maxRooms)) {
    throw new RangeError(
      `subscribeToOpenRooms: Invalid maxRooms. Expected positive number, received ${maxRooms}.`
    );
  }

  cleanupAbandonedGames().catch(() => {});

  if (isFirebaseConfigured() && db) {
    const q = query(
      collection(db, 'games'),
      where('isPrivate', '==', false),
      where('status', 'in', ['waiting', 'in_progress']),
      limit(maxRooms)
    );
    return onSnapshot(
      q,
      (snap) => {
        const rooms = snap.docs.map((docSnap) => docSnap.data() as GameRoom);
        callback(sortLobbyRooms(rooms));
      },
      (err) => {
        console.error('Error listening to open rooms:', err);
        callback([]);
      }
    );
  }

  const update = () => {
    const all = mockStore.getAll();
    const rooms = Object.values(all)
      .filter((g) => !g.isPrivate && (g.status === 'waiting' || g.status === 'in_progress'));
    callback(sortLobbyRooms(rooms).slice(0, maxRooms));
  };

  update();
  return mockStore.subscribeToAnyChange(update);
}

/**
 * High-performance matchmaking lookup:
 * Direct targeted query for an available open room with matching time control.
 * Avoids full-database scans, returning O(1) document reads.
 */
export async function findOpenWaitingGame(
  timeControlMinutes: number,
  incrementSeconds: number,
  excludeUserId?: string,
  candidateLimit: number = MULTIPLAYER_SCALE_CONFIG.matchmaking.targetedMatchCandidateLimit
): Promise<GameRoom | null> {
  if (isFirebaseConfigured() && db) {
    const q = query(
      collection(db, 'games'),
      where('isPrivate', '==', false),
      where('status', '==', 'waiting'),
      where('timeControlMinutes', '==', timeControlMinutes),
      where('incrementSeconds', '==', incrementSeconds),
      limit(candidateLimit)
    );
    const snap = await getDocs(q);
    for (const docSnap of snap.docs) {
      const game = docSnap.data() as GameRoom;
      const isHost =
        (game.bluePlayer && game.bluePlayer.id === excludeUserId) ||
        (game.greenPlayer && game.greenPlayer.id === excludeUserId);
      if (!isHost) {
        return game;
      }
    }
    return null;
  }

  const all = mockStore.getAll();
  const match = Object.values(all).find((r) => {
    if (r.isPrivate || r.status !== 'waiting') return false;
    if (r.timeControlMinutes !== timeControlMinutes || (r.incrementSeconds || 0) !== incrementSeconds) return false;
    const isHost =
      (r.bluePlayer && r.bluePlayer.id === excludeUserId) ||
      (r.greenPlayer && r.greenPlayer.id === excludeUserId);
    return !isHost;
  });
  return match || null;
}
