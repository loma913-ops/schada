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
  arrayUnion,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './config';
import { MULTIPLAYER_SCALE_CONFIG } from './multiplayerConfig';
import type { BoardState, Move, PieceColor } from '@/core/schada/types';
import { createInitialGameState, executeMove, resignGame, timeoutGame } from '@/core/schada/engine';
import type { ArenaPlayer } from '@/components/game/Arena';
import { calculateEloUpdate } from '@/core/elo/eloService';
import { updateUserStats } from './authService';
import type { UserProfile } from './localProvider';
import { safeSetItem, STORAGE_LIMITS } from '../storage/storageCleanup';

export interface GamePlayer extends ArenaPlayer {
  sessionToken: string;
}

export interface GameEloResult {
  blueDelta: number;
  greenDelta: number;
  newBlueElo: number;
  newGreenElo: number;
  initialBlueElo?: number;
  initialGreenElo?: number;
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
  eloResult?: GameEloResult | null;
  processedEloUserIds?: string[];
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

const SESSION_STORAGE_PREFIX = MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.playerTokenPrefix;
const MOCK_GAMES_STORAGE_KEY = MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.mockGames;

// In-memory set tracking active game resolution transactions (resignation or timeout)
// to prevent duplicate concurrent network transactions on the same client session.
const pendingResolutionGameIds = new Set<string>();

// Helper to remove any undefined values for Firestore serialization
function sanitize<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function getLocalSessionToken(gameId: string): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(SESSION_STORAGE_PREFIX + gameId);
}

export function setLocalSessionToken(gameId: string, token: string): void {
  safeSetItem(SESSION_STORAGE_PREFIX + gameId, token);
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

/**
 * Computes ranked Elo update for both players upon game completion.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant arithmetic calculation via logistic distribution curve.
 * - Auxiliary Space Complexity: O(1) constant scalar allocation.
 *
 * Growth Rate:
 * - O(1) constant: computational cost does not scale with game length, move count, or player ratings.
 */
export function computeRankedGameEloResult(
  game: GameRoom,
  outcome: 'blue' | 'green' | 'draw'
): GameEloResult | null {
  if (!game.isRanked || !game.bluePlayer || !game.greenPlayer) {
    return null;
  }
  const blueGames = typeof game.bluePlayer.gamesPlayed === 'number'
    ? game.bluePlayer.gamesPlayed
    : 0;
  const greenGames = typeof game.greenPlayer.gamesPlayed === 'number'
    ? game.greenPlayer.gamesPlayed
    : 0;

  const initialBlueElo = game.bluePlayer.elo;
  const initialGreenElo = game.greenPlayer.elo;

  const calc = calculateEloUpdate(
    {
      rating: initialBlueElo,
      gamesPlayed: blueGames,
    },
    {
      rating: initialGreenElo,
      gamesPlayed: greenGames,
    },
    outcome
  );
  return {
    initialBlueElo,
    initialGreenElo,
    blueDelta: calc.blueDelta,
    greenDelta: calc.greenDelta,
    newBlueElo: calc.newBlueRating,
    newGreenElo: calc.newGreenRating,
  };
}

/**
 * Appends a user ID to a completed game's processedEloUserIds array to prevent duplicate rating updates.
 * Utilizes atomic arrayUnion to eliminate getDoc reads and guarantee race-condition-free updates.
 *
 * Algorithmic Complexity (Big O):
 * - Time Complexity: O(1) direct single write with zero read operations.
 * - Auxiliary Space Complexity: O(1) constant scalar memory.
 * - Growth Rate: O(1) constant, invariant to room size or active player count.
 */
export async function markGameEloProcessed(gameId: string, userId: string): Promise<void> {
  if (isFirebaseConfigured() && db) {
    try {
      const gameRef = doc(db, MULTIPLAYER_SCALE_CONFIG.collections.games, gameId);
      await updateDoc(gameRef, {
        processedEloUserIds: arrayUnion(userId),
      });
    } catch (e) {
      console.warn('Could not mark game Elo processed in Firestore:', e);
    }
  } else {
    const game = mockStore.get(gameId);
    if (game) {
      const currentProcessed = Array.isArray(game.processedEloUserIds) ? game.processedEloUserIds : [];
      if (!currentProcessed.includes(userId)) {
        mockStore.set({ ...game, processedEloUserIds: [...currentProcessed, userId] });
      }
    }
  }
}

/**
 * Scans recently completed ranked games for the authenticated user where Elo has not yet been processed.
 * Guarantees that ratings are never lost if a user exits early, closes the browser tab, or experiences network interruptions.
 *
 * Algorithmic Complexity (Big O):
 * - Time Complexity: O(K) where K <= 10 recent completed games examined.
 * - Auxiliary Space Complexity: O(1) constant scalar memory.
 * - Database Reads/Writes: Optimized to read at most 10 candidate games and update only when pending.
 */
export async function reconcilePendingElo(userId: string): Promise<UserProfile | null> {
  if (!userId || userId.startsWith('guest_') || userId === 'guest') return null;

  let latestProfile: UserProfile | null = null;

  if (isFirebaseConfigured() && db) {
    try {
      const gamesCol = collection(db, MULTIPLAYER_SCALE_CONFIG.collections.games);
      const blueQuery = query(
        gamesCol,
        where('status', '==', 'completed'),
        where('isRanked', '==', true),
        where('bluePlayer.id', '==', userId),
        limit(5)
      );
      const greenQuery = query(
        gamesCol,
        where('status', '==', 'completed'),
        where('isRanked', '==', true),
        where('greenPlayer.id', '==', userId),
        limit(5)
      );

      const [blueSnap, greenSnap] = await Promise.all([
        getDocs(blueQuery),
        getDocs(greenQuery),
      ]);

      const candidateGames: GameRoom[] = [];
      const seenIds = new Set<string>();

      [...blueSnap.docs, ...greenSnap.docs].forEach((docSnap) => {
        if (!seenIds.has(docSnap.id)) {
          seenIds.add(docSnap.id);
          candidateGames.push(docSnap.data() as GameRoom);
        }
      });

      for (const game of candidateGames) {
        if (!game.processedEloUserIds?.includes(userId) && game.winner) {
          const winner = game.winner;
          const isBlue = game.bluePlayer?.id === userId;
          const isGreen = game.greenPlayer?.id === userId;
          if (!isBlue && !isGreen) continue;

          const myColor: PieceColor = isBlue ? 'blue' : 'green';
          const won = winner === myColor;
          const isDraw = winner === 'draw';

          const eloRes = game.eloResult || computeRankedGameEloResult(game, winner);
          const delta = eloRes ? (myColor === 'blue' ? eloRes.blueDelta : eloRes.greenDelta) : 0;

          try {
            const updated = await updateUserStats(userId, won, isDraw, delta);
            if (updated) {
              latestProfile = updated;
            }
            await markGameEloProcessed(game.id, userId);
          } catch (err) {
            console.warn('[gameService] reconcilePendingElo failed for game:', game.id, err);
          }
        }
      }
    } catch (e) {
      console.warn('[gameService] reconcilePendingElo error:', e);
    }
  } else {
    // Mock store reconciliation
    const all = mockStore.getAll();
    const candidateGames = Object.values(all).filter(
      (g) =>
        g.status === 'completed' &&
        g.isRanked &&
        (g.bluePlayer?.id === userId || g.greenPlayer?.id === userId) &&
        !g.processedEloUserIds?.includes(userId) &&
        g.winner
    );

    for (const game of candidateGames) {
      const winner = game.winner;
      if (!winner) continue;
      const isBlue = game.bluePlayer?.id === userId;
      const myColor: PieceColor = isBlue ? 'blue' : 'green';
      const won = winner === myColor;
      const isDraw = winner === 'draw';

      const eloRes = game.eloResult || computeRankedGameEloResult(game, winner);
      const delta = eloRes ? (myColor === 'blue' ? eloRes.blueDelta : eloRes.greenDelta) : 0;

      try {
        const updated = await updateUserStats(userId, won, isDraw, delta);
        if (updated) {
          latestProfile = updated;
        }
        await markGameEloProcessed(game.id, userId);
      } catch (err) {
        console.warn('[gameService] mock reconcilePendingElo failed for game:', game.id, err);
      }
    }
  }

  return latestProfile;
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

    // Prune oldest mock games if exceeding storage limit
    const entries = Object.entries(games);
    if (entries.length > STORAGE_LIMITS.maxMockGames) {
      const sorted = entries.sort((a, b) => (b[1]?.createdAt || 0) - (a[1]?.createdAt || 0));
      const pruned = Object.fromEntries(sorted.slice(0, STORAGE_LIMITS.maxMockGames));
      safeSetItem(MOCK_GAMES_STORAGE_KEY, JSON.stringify(pruned));
    } else {
      safeSetItem(MOCK_GAMES_STORAGE_KEY, JSON.stringify(games));
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

    safeSetItem(MOCK_GAMES_STORAGE_KEY, JSON.stringify(games));

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

export const mockStore = new MockGameStore();

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
    gamesPlayed?: number;
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
    gamesPlayed: typeof params.creator.gamesPlayed === 'number' ? params.creator.gamesPlayed : 0,
    sessionToken,
  };

  const isGuest =
    !params.creator?.id ||
    params.creator.id.startsWith('guest_') ||
    params.creator.id === 'guest';
  const isRanked = isGuest ? false : Boolean(params.isRanked);

  const initialBoard = createInitialGameState();

  const newGame: GameRoom = {
    id: gameId,
    isPrivate: Boolean(params.isPrivate),
    status: 'waiting',
    createdAt: Date.now(),
    timeControlMinutes: params.timeControlMinutes,
    incrementSeconds: params.incrementSeconds || 0,
    isRanked,
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
    const docRef = doc(db, MULTIPLAYER_SCALE_CONFIG.collections.games, gameId);
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
  user: { id: string; username: string; elo: number; gamesPlayed?: number }
): Promise<JoinGameResult> {
  const existingToken = getLocalSessionToken(gameId);

  // If live Firebase is configured, execute atomic transaction to prevent race conditions
  if (isFirebaseConfigured() && db) {
    const docRef = doc(db, MULTIPLAYER_SCALE_CONFIG.collections.games, gameId);
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
          gamesPlayed: typeof user.gamesPlayed === 'number' ? user.gamesPlayed : 0,
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
      gamesPlayed: typeof user.gamesPlayed === 'number' ? user.gamesPlayed : 0,
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
    const docRef = doc(db, MULTIPLAYER_SCALE_CONFIG.collections.games, gameId);
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
    const docRef = doc(db, MULTIPLAYER_SCALE_CONFIG.collections.games, gameId);
    const snap = await getDoc(docRef);
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
      const winner = nextBoardState.result?.winner;
      updatePayload.winner = winner;
      updatePayload.winReason = nextBoardState.result?.winReason;

      if (winner && game.isRanked && game.bluePlayer && game.greenPlayer) {
        const eloCalc = computeRankedGameEloResult(game, winner);
        if (eloCalc) {
          updatePayload.eloResult = eloCalc;
          updatePayload.bluePlayer = {
            ...game.bluePlayer,
            elo: eloCalc.newBlueElo,
          };
          updatePayload.greenPlayer = {
            ...game.greenPlayer,
            elo: eloCalc.newGreenElo,
          };
        }
      }
    }

    await updateDoc(docRef, sanitize(updatePayload));
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
    const winner = nextBoardState.result?.winner;
    updatePayload.winner = winner;
    updatePayload.winReason = nextBoardState.result?.winReason;

    if (winner && game.isRanked && game.bluePlayer && game.greenPlayer) {
      const eloCalc = computeRankedGameEloResult(game, winner);
      if (eloCalc) {
        updatePayload.eloResult = eloCalc;
        updatePayload.bluePlayer = {
          ...game.bluePlayer,
          elo: eloCalc.newBlueElo,
        };
        updatePayload.greenPlayer = {
          ...game.greenPlayer,
          elo: eloCalc.newGreenElo,
        };
      }
    }
  }

  mockStore.set({ ...game, ...updatePayload });
}

/**
 * Executes player resignation atomically, updating game room status, winner,
 * and ranked Elo ratings within a single Firestore transaction.
 * Losing player stats are offloaded to background execution to prevent network blocking.
 *
 * Algorithmic Complexity (Big O):
 * - Time Complexity: O(1) constant time point read and point write in transaction.
 *   Elo calculation and game state update run in O(1) constant time.
 * - Auxiliary Space Complexity: O(1) constant scalar and payload memory.
 * - Growth Rate: O(1) invariant to total games played or database volume.
 */
export async function resignGameAction(
  gameId: string,
  resigningColor: PieceColor
): Promise<UserProfile | null> {
  if (pendingResolutionGameIds.has(gameId)) return null;
  pendingResolutionGameIds.add(gameId);

  try {
    if (isFirebaseConfigured() && db) {
      const docRef = doc(db, MULTIPLAYER_SCALE_CONFIG.collections.games, gameId);
      let resigningPlayerId: string | null = null;
      let resigningDelta = 0;
      let isRankedGame = false;

      await runTransaction(db, async (tx) => {
        const snap = await tx.get(docRef);
        if (!snap.exists()) return;

        const game = snap.data() as GameRoom;
        if (game.status !== 'in_progress') return;

        isRankedGame = Boolean(game.isRanked);
        const nextBoardState = resignGame(game.boardState, resigningColor);
        const winner = nextBoardState.result?.winner;
        const updatePayload: Partial<GameRoom> = {
          boardState: nextBoardState,
          status: 'completed',
          winner,
          winReason: nextBoardState.result?.winReason,
          lastTurnStartTimeMs: null,
        };

        const resigningPlayer = resigningColor === 'blue' ? game.bluePlayer : game.greenPlayer;
        if (resigningPlayer?.id) {
          resigningPlayerId = resigningPlayer.id;
        }

        if (winner && game.isRanked && game.bluePlayer && game.greenPlayer) {
          const eloCalc = computeRankedGameEloResult(game, winner);
          if (eloCalc) {
            updatePayload.eloResult = eloCalc;
            updatePayload.bluePlayer = {
              ...game.bluePlayer,
              elo: eloCalc.newBlueElo,
            };
            updatePayload.greenPlayer = {
              ...game.greenPlayer,
              elo: eloCalc.newGreenElo,
            };

            const delta = resigningColor === 'blue' ? eloCalc.blueDelta : eloCalc.greenDelta;
            resigningDelta = delta;
          }
        }

        const currentProcessed = Array.isArray(game.processedEloUserIds) ? game.processedEloUserIds : [];
        if (resigningPlayerId && !currentProcessed.includes(resigningPlayerId)) {
          updatePayload.processedEloUserIds = [...currentProcessed, resigningPlayerId];
        }

        tx.update(docRef, sanitize(updatePayload));
      });

      if (resigningPlayerId && (!auth?.currentUser || auth.currentUser.uid === resigningPlayerId)) {
        try {
          const updated = await updateUserStats(
            resigningPlayerId,
            false,
            false,
            isRankedGame ? resigningDelta : 0
          );
          await markGameEloProcessed(gameId, resigningPlayerId);
          return updated;
        } catch (e) {
          console.warn('Failed to update stats for resigning player:', e);
        }
      }
      return null;
    }

    const game = mockStore.getRaw(gameId);
    if (!game || game.status !== 'in_progress') return null;

    const isRankedGame = Boolean(game.isRanked);
    const nextBoardState = resignGame(game.boardState, resigningColor);
    const winner = nextBoardState.result?.winner;
    const updatePayload: Partial<GameRoom> = {
      boardState: nextBoardState,
      status: 'completed',
      winner,
      winReason: nextBoardState.result?.winReason,
      lastTurnStartTimeMs: null,
    };

    let resigningPlayerId: string | null = null;
    let resigningDelta = 0;
    let winningPlayerId: string | null = null;
    let winningDelta = 0;

    const resigningPlayer = resigningColor === 'blue' ? game.bluePlayer : game.greenPlayer;
    if (resigningPlayer?.id) {
      resigningPlayerId = resigningPlayer.id;
    }
    const winningPlayer = resigningColor === 'blue' ? game.greenPlayer : game.bluePlayer;
    if (winningPlayer?.id) {
      winningPlayerId = winningPlayer.id;
    }

    if (winner && game.isRanked && game.bluePlayer && game.greenPlayer) {
      const eloCalc = computeRankedGameEloResult(game, winner);
      if (eloCalc) {
        updatePayload.eloResult = eloCalc;
        updatePayload.bluePlayer = {
          ...game.bluePlayer,
          elo: eloCalc.newBlueElo,
        };
        updatePayload.greenPlayer = {
          ...game.greenPlayer,
          elo: eloCalc.newGreenElo,
        };

        const delta = resigningColor === 'blue' ? eloCalc.blueDelta : eloCalc.greenDelta;
        resigningDelta = delta;
        winningDelta = resigningColor === 'blue' ? eloCalc.greenDelta : eloCalc.blueDelta;
      }
    }

    mockStore.set({ ...game, ...updatePayload });

    if (winningPlayerId && (!winningPlayerId.startsWith('guest_') && winningPlayerId !== 'guest')) {
      try {
        await updateUserStats(
          winningPlayerId,
          true,
          false,
          isRankedGame ? winningDelta : 0
        );
        await markGameEloProcessed(gameId, winningPlayerId);
      } catch (e) {
        console.warn('Failed to update stats for winning player:', e);
      }
    }

    if (resigningPlayerId) {
      try {
        const updated = await updateUserStats(
          resigningPlayerId,
          false,
          false,
          isRankedGame ? resigningDelta : 0
        );
        await markGameEloProcessed(gameId, resigningPlayerId);
        return updated;
      } catch (e) {
        console.warn('Failed to update stats for resigning player:', e);
      }
    }
    return null;
  } finally {
    pendingResolutionGameIds.delete(gameId);
  }
}

/**
 * Resolves game clock expiration atomically, updating game room status, winner,
 * and ranked Elo ratings within a single Firestore transaction.
 *
 * Algorithmic Complexity (Big O):
 * - Time Complexity: O(1) constant time point read and point write in transaction.
 *   Clock computation and Elo calculation run in O(1) constant time.
 * - Auxiliary Space Complexity: O(1) constant payload allocations.
 * - Growth Rate: O(1) invariant to active concurrent games or database size.
 */
export async function timeoutGameAction(
  gameId: string,
  timedOutColor: PieceColor
): Promise<UserProfile | null> {
  if (pendingResolutionGameIds.has(gameId)) return null;
  pendingResolutionGameIds.add(gameId);

  try {
    if (isFirebaseConfigured() && db) {
      const docRef = doc(db, MULTIPLAYER_SCALE_CONFIG.collections.games, gameId);
      let timedOutPlayerId: string | null = null;
      let timedOutDelta = 0;
      let timeoutWinnerPlayerId: string | null = null;
      let timeoutWinnerDelta = 0;
      let isRankedGame = false;

      await runTransaction(db, async (tx) => {
        const snap = await tx.get(docRef);
        if (!snap.exists()) return;

        const game = snap.data() as GameRoom;
        if (game.status !== 'in_progress') return;

        isRankedGame = Boolean(game.isRanked);
        const nextBoardState = timeoutGame(game.boardState, timedOutColor);
        const winner = nextBoardState.result?.winner;
        const updatePayload: Partial<GameRoom> = {
          boardState: nextBoardState,
          status: 'completed',
          winner,
          winReason: nextBoardState.result?.winReason,
          lastTurnStartTimeMs: null,
        };

        const timedOutPlayer = timedOutColor === 'blue' ? game.bluePlayer : game.greenPlayer;
        if (timedOutPlayer?.id) {
          timedOutPlayerId = timedOutPlayer.id;
        }

        const timeoutWinnerPlayer = timedOutColor === 'blue' ? game.greenPlayer : game.bluePlayer;
        if (timeoutWinnerPlayer?.id) {
          timeoutWinnerPlayerId = timeoutWinnerPlayer.id;
        }

        if (winner && game.isRanked && game.bluePlayer && game.greenPlayer) {
          const eloCalc = computeRankedGameEloResult(game, winner);
          if (eloCalc) {
            updatePayload.eloResult = eloCalc;
            updatePayload.bluePlayer = {
              ...game.bluePlayer,
              elo: eloCalc.newBlueElo,
            };
            updatePayload.greenPlayer = {
              ...game.greenPlayer,
              elo: eloCalc.newGreenElo,
            };

            timedOutDelta = timedOutColor === 'blue' ? eloCalc.blueDelta : eloCalc.greenDelta;
            timeoutWinnerDelta = timedOutColor === 'blue' ? eloCalc.greenDelta : eloCalc.blueDelta;
          }
        }

        const currentProcessed = Array.isArray(game.processedEloUserIds) ? game.processedEloUserIds : [];
        const callerId = auth?.currentUser?.uid;
        if (callerId && (callerId === timedOutPlayerId || callerId === timeoutWinnerPlayerId) && !currentProcessed.includes(callerId)) {
          updatePayload.processedEloUserIds = [...currentProcessed, callerId];
        }

        tx.update(docRef, sanitize(updatePayload));
      });

      if (timeoutWinnerPlayerId && (!auth?.currentUser || auth.currentUser.uid === timeoutWinnerPlayerId)) {
        try {
          const updated = await updateUserStats(
            timeoutWinnerPlayerId,
            true,
            false,
            isRankedGame ? timeoutWinnerDelta : 0
          );
          await markGameEloProcessed(gameId, timeoutWinnerPlayerId);
          return updated;
        } catch (e) {
          console.warn('Failed to update stats for winning player on timeout:', e);
        }
      }

      if (timedOutPlayerId && (!auth?.currentUser || auth.currentUser.uid === timedOutPlayerId)) {
        try {
          const updated = await updateUserStats(
            timedOutPlayerId,
            false,
            false,
            isRankedGame ? timedOutDelta : 0
          );
          await markGameEloProcessed(gameId, timedOutPlayerId);
          return updated;
        } catch (e) {
          console.warn('Failed to update stats for timed-out player:', e);
        }
      }
      return null;
    }

    const game = mockStore.getRaw(gameId);
    if (!game || game.status !== 'in_progress') return null;

    const isRankedGame = Boolean(game.isRanked);
    const nextBoardState = timeoutGame(game.boardState, timedOutColor);
    const winner = nextBoardState.result?.winner;
    const updatePayload: Partial<GameRoom> = {
      boardState: nextBoardState,
      status: 'completed',
      winner,
      winReason: nextBoardState.result?.winReason,
      lastTurnStartTimeMs: null,
    };

    let timedOutPlayerId: string | null = null;
    let timedOutDelta = 0;
    let timeoutWinnerPlayerId: string | null = null;
    let timeoutWinnerDelta = 0;

    const timedOutPlayer = timedOutColor === 'blue' ? game.bluePlayer : game.greenPlayer;
    if (timedOutPlayer?.id) {
      timedOutPlayerId = timedOutPlayer.id;
    }
    const timeoutWinnerPlayer = timedOutColor === 'blue' ? game.greenPlayer : game.bluePlayer;
    if (timeoutWinnerPlayer?.id) {
      timeoutWinnerPlayerId = timeoutWinnerPlayer.id;
    }

    if (winner && game.isRanked && game.bluePlayer && game.greenPlayer) {
      const eloCalc = computeRankedGameEloResult(game, winner);
      if (eloCalc) {
        updatePayload.eloResult = eloCalc;
        updatePayload.bluePlayer = {
          ...game.bluePlayer,
          elo: eloCalc.newBlueElo,
        };
        updatePayload.greenPlayer = {
          ...game.greenPlayer,
          elo: eloCalc.newGreenElo,
        };

        const delta = timedOutColor === 'blue' ? eloCalc.blueDelta : eloCalc.greenDelta;
        timedOutDelta = delta;
        timeoutWinnerDelta = timedOutColor === 'blue' ? eloCalc.greenDelta : eloCalc.blueDelta;
      }
    }

    mockStore.set({ ...game, ...updatePayload });

    if (timeoutWinnerPlayerId && (!timeoutWinnerPlayerId.startsWith('guest_') && timeoutWinnerPlayerId !== 'guest')) {
      try {
        await updateUserStats(
          timeoutWinnerPlayerId,
          true,
          false,
          isRankedGame ? timeoutWinnerDelta : 0
        );
        await markGameEloProcessed(gameId, timeoutWinnerPlayerId);
      } catch (e) {
        console.warn('Failed to update stats for winning player:', e);
      }
    }

    if (timedOutPlayerId) {
      try {
        const updated = await updateUserStats(
          timedOutPlayerId,
          false,
          false,
          isRankedGame ? timedOutDelta : 0
        );
        await markGameEloProcessed(gameId, timedOutPlayerId);
        return updated;
      } catch (e) {
        console.warn('Failed to update stats for timed-out player:', e);
      }
    }
    return null;
  } finally {
    pendingResolutionGameIds.delete(gameId);
  }
}

/**
 * Marks a game as abandoned. Directly executes a single document update without
 * an unnecessary getDoc read round-trip.
 *
 * Algorithmic Complexity (Big O):
 * - Time Complexity: O(1) single direct write operation with 0 reads.
 * - Auxiliary Space Complexity: O(1) constant payload.
 */
export async function abandonGame(gameId: string): Promise<void> {
  const now = Date.now();
  const updatePayload: Partial<GameRoom> = {
    status: 'abandoned',
    abandonedAt: now,
    lastTurnStartTimeMs: null,
  };

  if (isFirebaseConfigured() && db) {
    try {
      const docRef = doc(db, MULTIPLAYER_SCALE_CONFIG.collections.games, gameId);
      await updateDoc(docRef, sanitize(updatePayload));
    } catch (err) {
      console.warn('Could not mark game abandoned in Firestore:', err);
    }
  } else {
    const game = mockStore.get(gameId);
    if (game) {
      mockStore.set({ ...game, ...updatePayload });
    }
  }
}

export async function deleteGame(gameId: string): Promise<void> {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(SESSION_STORAGE_PREFIX + gameId);
  }

  if (isFirebaseConfigured() && db) {
    await deleteDoc(doc(db, MULTIPLAYER_SCALE_CONFIG.collections.games, gameId));
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
      // 1. Remove games explicitly marked as 'abandoned' for maxAgeMs in a single atomic batch
      const qAbandoned = query(
        collection(db, MULTIPLAYER_SCALE_CONFIG.collections.games),
        where('status', '==', 'abandoned'),
        limit(batchLimit)
      );
      const snapAbandoned = await getDocs(qAbandoned);
      const batchAbandoned = writeBatch(db);
      let abandonedDeleteCount = 0;

      for (const docSnap of snapAbandoned.docs) {
        const game = docSnap.data() as GameRoom;
        const abandonedTime = game.abandonedAt || game.createdAt;
        if (abandonedTime && now - abandonedTime >= maxAgeMs) {
          batchAbandoned.delete(docSnap.ref);
          abandonedDeleteCount++;
          removedIds.push(docSnap.id);
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(SESSION_STORAGE_PREFIX + docSnap.id);
          }
        }
      }

      if (abandonedDeleteCount > 0) {
        await batchAbandoned.commit();
      }

      // 2. Auto-resolve in-progress games that have timed out (bounded to batchLimit)
      const qInProgress = query(
        collection(db, MULTIPLAYER_SCALE_CONFIG.collections.games),
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

      // 3. Mark stale waiting games as abandoned if older than maxAgeMs in a single atomic batch
      if (maxAgeMs > 0) {
        const qWaiting = query(
          collection(db, MULTIPLAYER_SCALE_CONFIG.collections.games),
          where('status', '==', 'waiting'),
          limit(batchLimit)
        );
        const snapWaiting = await getDocs(qWaiting);
        const batchWaiting = writeBatch(db);
        let waitingUpdateCount = 0;

        for (const docSnap of snapWaiting.docs) {
          const game = docSnap.data() as GameRoom;
          if (game.createdAt && now - game.createdAt >= maxAgeMs) {
            batchWaiting.update(docSnap.ref, {
              status: 'abandoned',
              abandonedAt: now,
              lastTurnStartTimeMs: null,
            });
            waitingUpdateCount++;
          }
        }

        if (waitingUpdateCount > 0) {
          await batchWaiting.commit();
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

/**
 * Retrieves open waiting and/or in-progress rooms from Firestore or mock storage.
 *
 * Algorithmic Complexity (Big O):
 * - Firestore Query Time Complexity: O(log N + K) where N is global games and K <= limitCount (K <= 50).
 * - Sort Time Complexity: O(K log K) via sortLobbyRooms partition sorting.
 * - Auxiliary Space Complexity: O(K) memory for the retrieved document snapshots.
 * - Growth Rate: Strictly bounded at O(K log K) constant ceiling independent of database size N.
 *
 * @param limitCount Maximum number of open rooms to fetch.
 * @param includeInProgress Whether to retrieve in-progress matches alongside waiting rooms.
 * @returns Sorted array of open GameRoom objects.
 */
export async function getOpenRooms(
  limitCount: number = MULTIPLAYER_SCALE_CONFIG.matchmaking.maxOpenRoomsLobbyLimit,
  includeInProgress: boolean = true
): Promise<GameRoom[]> {
  if (typeof limitCount !== 'number' || limitCount <= 0 || isNaN(limitCount)) {
    throw new RangeError(
      `getOpenRooms: Invalid limitCount. Expected positive number, received ${limitCount}.`
    );
  }

  if (isFirebaseConfigured() && db) {
    const q = query(
      collection(db, MULTIPLAYER_SCALE_CONFIG.collections.games),
      where('isPrivate', '==', false),
      where('status', 'in', includeInProgress ? ['waiting', 'in_progress'] : ['waiting']),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    const rooms = snap.docs.map((docSnap) => docSnap.data() as GameRoom);
    return sortLobbyRooms(rooms);
  }

  const all = mockStore.getAll();
  const rooms = Object.values(all)
    .filter((g) => !g.isPrivate && (includeInProgress ? (g.status === 'waiting' || g.status === 'in_progress') : g.status === 'waiting'));
  return sortLobbyRooms(rooms).slice(0, limitCount);
}

/**
 * Retrieves in-progress games available for spectating.
 *
 * Algorithmic Complexity (Big O):
 * - Query Time Complexity: O(log N + K) index lookup, bounded by limitCount K <= 50.
 * - Sort Time Complexity: O(K log K) chronological sort.
 * - Auxiliary Space Complexity: O(K) memory allocation.
 * - Growth Rate: Constant-time ceiling O(K log K) scaling sustainably as platform matches scale.
 *
 * @param limitCount Maximum number of live rooms to fetch.
 * @returns Sorted array of active in-progress GameRoom objects.
 */
export async function getInProgressRooms(
  limitCount: number = MULTIPLAYER_SCALE_CONFIG.matchmaking.maxOpenRoomsLobbyLimit
): Promise<GameRoom[]> {
  if (typeof limitCount !== 'number' || limitCount <= 0 || isNaN(limitCount)) {
    throw new RangeError(
      `getInProgressRooms: Invalid limitCount. Expected positive number, received ${limitCount}.`
    );
  }

  if (isFirebaseConfigured() && db) {
    const q = query(
      collection(db, MULTIPLAYER_SCALE_CONFIG.collections.games),
      where('isPrivate', '==', false),
      where('status', '==', 'in_progress'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    const rooms = snap.docs.map((docSnap) => docSnap.data() as GameRoom);
    return sortLobbyRooms(rooms);
  }

  const all = mockStore.getAll();
  const rooms = Object.values(all)
    .filter((g) => !g.isPrivate && g.status === 'in_progress');
  return sortLobbyRooms(rooms).slice(0, limitCount);
}

/**
 * Subscribes to real-time open rooms. When includeInProgress is false, the subscription
 * isolates waiting rooms strictly, preventing active match moves from triggering snapshot reads.
 *
 * Algorithmic Complexity (Big O):
 * - Notification Time Complexity: O(K log K) sort execution upon document changes (K <= maxRooms <= 50).
 * - Auxiliary Space Complexity: O(K) for active room array state.
 * - Network / Database Complexity: O(K) listener bandwidth. With includeInProgress=false,
 *   update frequency drops from O(moves) to O(creations + joins), ensuring sustainable sub-linear scaling.
 *
 * @param callback Observer callback invoked on room list changes.
 * @param maxRooms Maximum room limit constraint.
 * @param includeInProgress Whether to include live matches in the real-time stream.
 * @returns Unsubscribe teardown callback.
 */
export function subscribeToOpenRooms(
  callback: (rooms: GameRoom[]) => void,
  maxRooms: number = MULTIPLAYER_SCALE_CONFIG.matchmaking.maxOpenRoomsLobbyLimit,
  includeInProgress: boolean = true
): () => void {
  if (typeof callback !== 'function') {
    throw new TypeError('subscribeToOpenRooms: callback parameter must be a function.');
  }
  if (typeof maxRooms !== 'number' || maxRooms <= 0 || isNaN(maxRooms)) {
    throw new RangeError(
      `subscribeToOpenRooms: Invalid maxRooms. Expected positive number, received ${maxRooms}.`
    );
  }

  if (isFirebaseConfigured() && db) {
    const statuses = includeInProgress ? ['waiting', 'in_progress'] : ['waiting'];
    const q = query(
      collection(db, MULTIPLAYER_SCALE_CONFIG.collections.games),
      where('isPrivate', '==', false),
      where('status', 'in', statuses),
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
      .filter((g) => !g.isPrivate && (includeInProgress ? (g.status === 'waiting' || g.status === 'in_progress') : g.status === 'waiting'));
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
  candidateLimit: number = MULTIPLAYER_SCALE_CONFIG.matchmaking.targetedMatchCandidateLimit,
  isRanked?: boolean
): Promise<GameRoom | null> {
  if (isFirebaseConfigured() && db) {
    const constraints: import('firebase/firestore').QueryConstraint[] = [
      where('isPrivate', '==', false),
      where('status', '==', 'waiting'),
      where('timeControlMinutes', '==', timeControlMinutes),
      where('incrementSeconds', '==', incrementSeconds),
    ];
    if (typeof isRanked === 'boolean') {
      constraints.push(where('isRanked', '==', isRanked));
    }
    constraints.push(limit(candidateLimit));
    const q = query(
      collection(db, MULTIPLAYER_SCALE_CONFIG.collections.games),
      ...constraints
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
    if (typeof isRanked === 'boolean' && r.isRanked !== isRanked) return false;
    const isHost =
      (r.bluePlayer && r.bluePlayer.id === excludeUserId) ||
      (r.greenPlayer && r.greenPlayer.id === excludeUserId);
    return !isHost;
  });
  return match || null;
}
