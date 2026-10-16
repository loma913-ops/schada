import {
  collection,
  query,
  where,
  limit,
  orderBy,
  getDocs,
  onSnapshot,
  type QueryConstraint,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import { MULTIPLAYER_SCALE_CONFIG } from './multiplayerConfig';
import { isGameTimedOut } from './gameClock';
import { localGameStore } from './localGameStore';
import { type GameRoom, isGuestUser } from './gameTypes';
import type { PieceColor } from '@/core/schada/types';

let lobbyTimeoutHandler: ((id: string, color: PieceColor) => Promise<unknown>) | null = null;

export function setLobbyTimeoutHandler(handler: ((id: string, color: PieceColor) => Promise<unknown>) | null): void {
  lobbyTimeoutHandler = handler;
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
        if (timeoutCheck.timedOutColor && lobbyTimeoutHandler) {
          lobbyTimeoutHandler(room.id, timeoutCheck.timedOutColor).catch(() => {});
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
 * Retrieves open waiting and/or in-progress rooms from Firestore or local storage.
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
    const statusConstraint: QueryConstraint = includeInProgress
      ? where('status', 'in', ['waiting', 'in_progress'])
      : where('status', '==', 'waiting');
    const q = query(
      collection(db, MULTIPLAYER_SCALE_CONFIG.collections.games),
      where('isPrivate', '==', false),
      statusConstraint,
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    const rooms = snap.docs.map((docSnap) => docSnap.data() as GameRoom);
    return sortLobbyRooms(rooms);
  }

  const all = localGameStore.getAll();
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
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    const rooms = snap.docs.map((docSnap) => docSnap.data() as GameRoom);
    return sortLobbyRooms(rooms);
  }

  const all = localGameStore.getAll();
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
    const statusConstraint: QueryConstraint = includeInProgress
      ? where('status', 'in', ['waiting', 'in_progress'])
      : where('status', '==', 'waiting');
    const q = query(
      collection(db, MULTIPLAYER_SCALE_CONFIG.collections.games),
      where('isPrivate', '==', false),
      statusConstraint,
      orderBy('createdAt', 'desc'),
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
    const all = localGameStore.getAll();
    const rooms = Object.values(all)
      .filter((g) => !g.isPrivate && (includeInProgress ? (g.status === 'waiting' || g.status === 'in_progress') : g.status === 'waiting'));
    callback(sortLobbyRooms(rooms).slice(0, maxRooms));
  };

  update();
  return localGameStore.subscribeToAnyChange(update);
}

/**
 * High-performance matchmaking lookup:
 * Direct targeted query for an available open room with matching time control.
 * Avoids full-database scans, returning O(1) document reads.
 *
 * @param timeControlMinutes Match duration in minutes.
 * @param incrementSeconds Time increment per move in seconds.
 * @param excludeUserId Seeker identifier (authenticated user ID or CSPRNG guest ID) to prevent self-pairing.
 * @param candidateLimit Maximum candidate rooms to inspect.
 * @param isRanked Whether the game is ranked.
 */
export async function findOpenWaitingGame(
  timeControlMinutes: number,
  incrementSeconds: number,
  excludeUserId?: string,
  candidateLimit: number = MULTIPLAYER_SCALE_CONFIG.matchmaking.targetedMatchCandidateLimit,
  isRanked?: boolean
): Promise<GameRoom | null> {
  if (excludeUserId !== undefined && typeof excludeUserId !== 'string') {
    throw new TypeError('findOpenWaitingGame: excludeUserId must be a string or undefined.');
  }

  const isGuestSeeker = isGuestUser({ id: excludeUserId });

  // Guests are strictly forbidden from participating in ranked games
  if (isGuestSeeker && isRanked === true) {
    return null;
  }

  // Force casual games only for guest matchmaking
  const effectiveIsRanked = isGuestSeeker ? false : isRanked;

  if (isFirebaseConfigured() && db) {
    const constraints: QueryConstraint[] = [
      where('isPrivate', '==', false),
      where('status', '==', 'waiting'),
      where('timeControlMinutes', '==', timeControlMinutes),
      where('incrementSeconds', '==', incrementSeconds),
    ];
    if (typeof effectiveIsRanked === 'boolean') {
      constraints.push(where('isRanked', '==', effectiveIsRanked));
    }
    constraints.push(orderBy('createdAt', 'asc'));
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

  const all = localGameStore.getAll();
  const match = Object.values(all).find((r) => {
    if (r.isPrivate || r.status !== 'waiting') return false;
    if (r.timeControlMinutes !== timeControlMinutes || (r.incrementSeconds || 0) !== incrementSeconds) return false;
    if (typeof effectiveIsRanked === 'boolean' && r.isRanked !== effectiveIsRanked) return false;
    const isHost =
      (r.bluePlayer && r.bluePlayer.id === excludeUserId) ||
      (r.greenPlayer && r.greenPlayer.id === excludeUserId);
    return !isHost;
  });
  return match || null;
}
