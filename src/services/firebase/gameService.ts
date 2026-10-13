import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  runTransaction,
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './config';
import { MULTIPLAYER_SCALE_CONFIG } from './multiplayerConfig';
import type { Move, PieceColor } from '@/core/schada/types';
import { createInitialGameState } from '@/core/schada/engine';
import { updateUserStats } from './authService';
import type { UserProfile } from './localProvider';
import { safeSetItem } from '../storage/storageCleanup';
import { ELO_CONFIG } from '@/core/elo/eloConfig';
import { isPatronUser } from '@/components/common/PatronBadge';
import { LOBBY_CONFIG } from '@/components/lobby/lobbyConfig';
import { SECURITY_CONFIG } from '@/core/security/securityConfig';
import {
  getSecureRandomString,
  generateSecureToken,
  getSecureRandomChoice,
} from '@/core/security/cryptoUtils';
import type { ArenaPlayer } from './gameTypes';

// Re-exported modular domain services
export * from './gameTypes';
export * from './gameClock';
export * from './gameElo';
export * from './gameTransitions';
export * from './localGameStore';
export * from './lobbyService';
export * from './gameCleanupService';

import {
  ABANDONED_GAME_EXPIRY_MS,
  isGuestUser,
  type GamePlayer,
  type GameRoom,
  type CreateGameParams,
  type JoinGameResult,
} from './gameTypes';
import { isGameTimedOut } from './gameClock';
import { markGameEloProcessed } from './gameElo';
import {
  computeMoveTransition,
  computeResignTransition,
  computeTimeoutTransition,
  computeAbandonmentTransition,
} from './gameTransitions';
import { localGameStore } from './localGameStore';
import { setLobbyTimeoutHandler } from './lobbyService';
import { setCleanupHandlers } from './gameCleanupService';

const SESSION_STORAGE_PREFIX = MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.playerTokenPrefix;

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

/**
 * Generates an authoritative 9-digit case-sensitive alphanumeric game identifier (Base62).
 * Utilizes cryptographically secure pseudo-random values (crypto.getRandomValues)
 * and rejection sampling to achieve an exact uniform distribution without modulo bias.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(L) expected time where L = SECURITY_CONFIG.gameIdLength (L = 9).
 *   With rejection threshold 248 on byte domain [0..255], rejection probability is 8 / 256 = 3.125%.
 *   The expected iterations to collect 9 unbiased characters is 9 / (1 - 0.03125) ≈ 9.29 steps, strictly O(L).
 * - Auxiliary Space Complexity: O(L) auxiliary space for typed byte buffer (size 2 * L).
 *
 * Growth Rate:
 * - O(L) linear with identifier length. As platform data scales to millions of matches,
 *   generation overhead is O(1) constant with respect to total database volume.
 */
export function generateGameId(): string {
  return getSecureRandomString(
    SECURITY_CONFIG.gameIdLength,
    SECURITY_CONFIG.gameIdCharset
  );
}

function generateToken(): string {
  return generateSecureToken();
}

/**
 * Creates a new multiplayer game room with an authoritative 9-digit alphanumeric ID.
 * Employs atomic Firestore transactions with an existence check to authoritatively
 * prevent duplicate game IDs and room collisions.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(R * (T_tx + T_gen)) where R <= SECURITY_CONFIG.maxGameIdCreationRetries.
 *   Given an address space of 62^9 ≈ 1.35 * 10^16, the collision probability is asymptotically zero,
 *   so R = 1 with probability > 99.9999999999%. The transaction executes exactly 1 document read
 *   and 1 document write.
 * - Auxiliary Space Complexity: O(1) auxiliary space, writing the sanitized GameRoom payload.
 *
 * Growth Rate:
 * - O(1) constant amortized transaction and space complexity, scaling sustainably as game volume
 *   scales to millions of matches without unindexed scans or table locks.
 */
export async function createGame(params: CreateGameParams): Promise<{ gameId: string; sessionToken: string; color: PieceColor }> {
  const sessionToken = generateToken();
  const initialTimeMs = params.timeControlMinutes > 0 ? params.timeControlMinutes * 60 * 1000 : 0;

  // Determine initial color assignment
  const colorPref = params.colorPref || 'random';
  let creatorColor: PieceColor;
  if (colorPref === 'random') {
    creatorColor = getSecureRandomChoice(['blue', 'green'] as const);
  } else {
    creatorColor = colorPref;
  }

  const creatorPlayer: GamePlayer = {
    id: params.creator.id,
    username: params.creator.username,
    elo: params.creator.elo,
    gamesPlayed:
      typeof params.creator.gamesPlayed === 'number'
        ? params.creator.gamesPlayed
        : ELO_CONFIG.defaultAssumedGamesPlayed,
    sessionToken,
    isPatron: isPatronUser(params.creator),
    hasDonated: Boolean(params.creator.hasDonated || params.creator.isPatron),
    patronTier: params.creator.patronTier,
    patronExpiresAt: params.creator.patronExpiresAt,
    patronSubscriptionStatus: params.creator.patronSubscriptionStatus,
  };

  const isGuest = isGuestUser(params.creator);
  const isRanked = isGuest ? false : Boolean(params.isRanked);

  const initialBoard = createInitialGameState();
  const maxRetries = SECURITY_CONFIG.maxGameIdCreationRetries;
  let finalGameId: string | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const candidateId = generateGameId();

    const newGame: GameRoom = {
      id: candidateId,
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

    if (isFirebaseConfigured() && db) {
      const docRef = doc(db, MULTIPLAYER_SCALE_CONFIG.collections.games, candidateId);
      const isCommitted = await runTransaction(db, async (tx) => {
        const snap = await tx.get(docRef);
        if (snap.exists()) {
          return false;
        }
        tx.set(docRef, sanitize(newGame));
        return true;
      });

      if (isCommitted) {
        finalGameId = candidateId;
        break;
      }
    } else {
      if (!localGameStore.get(candidateId)) {
        localGameStore.set(newGame);
        finalGameId = candidateId;
        break;
      }
    }
  }

  if (!finalGameId) {
    throw new Error(`Failed to generate a unique game ID after ${maxRetries} retry attempts.`);
  }

  setLocalSessionToken(finalGameId, sessionToken);

  return { gameId: finalGameId, sessionToken, color: creatorColor };
}

export async function joinGame(
  gameId: string,
  user: ArenaPlayer
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

      // Guests are strictly forbidden from playing in ranked games
      if (game.isRanked && isGuestUser(user)) {
        return {
          success: false,
          role: 'spectator',
          error: MULTIPLAYER_SCALE_CONFIG.matchmaking.guestRankedErrorMessage,
        };
      }

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
          gamesPlayed:
            typeof user.gamesPlayed === 'number'
              ? user.gamesPlayed
              : ELO_CONFIG.defaultAssumedGamesPlayed,
          sessionToken: newToken,
          isPatron: isPatronUser(user),
          hasDonated: Boolean(user.hasDonated || user.isPatron),
          patronTier: user.patronTier,
          patronExpiresAt: user.patronExpiresAt,
          patronSubscriptionStatus: user.patronSubscriptionStatus,
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

  // Local store implementation for offline and tests
  const game = localGameStore.get(gameId);
  if (!game) {
    return { success: false, role: 'spectator', error: 'Game not found.' };
  }

  // Guests are strictly forbidden from playing in ranked games
  if (game.isRanked && isGuestUser(user)) {
    return {
      success: false,
      role: 'spectator',
      error: MULTIPLAYER_SCALE_CONFIG.matchmaking.guestRankedErrorMessage,
    };
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
      gamesPlayed:
        typeof user.gamesPlayed === 'number'
          ? user.gamesPlayed
          : ELO_CONFIG.defaultAssumedGamesPlayed,
      sessionToken: newToken,
      isPatron: isPatronUser(user),
      hasDonated: Boolean(user.hasDonated || user.isPatron),
      patronTier: user.patronTier,
      patronExpiresAt: user.patronExpiresAt,
      patronSubscriptionStatus: user.patronSubscriptionStatus,
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
    localGameStore.set(game);

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

  return localGameStore.subscribe(gameId, onUpdate);
}

export async function makeGameMove(
  gameId: string,
  move: Move,
  playerColor: PieceColor,
  currentGame?: GameRoom
): Promise<void> {
  const now = Date.now();

  if (isFirebaseConfigured() && db) {
    const docRef = doc(db, MULTIPLAYER_SCALE_CONFIG.collections.games, gameId);
    let game = currentGame;
    if (!game) {
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        throw new Error('Game not found.');
      }
      game = snap.data() as GameRoom;
    }
    const updatePayload = computeMoveTransition(game, move, playerColor, now);
    await updateDoc(docRef, sanitize(updatePayload));
    return;
  }

  const game = currentGame || localGameStore.get(gameId);
  if (!game) {
    throw new Error('Game is not in progress.');
  }

  const updatePayload = computeMoveTransition(game, move, playerColor, now);
  localGameStore.set({ ...game, ...updatePayload });
}

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

        const transition = computeResignTransition(game, resigningColor);
        resigningPlayerId = transition.resigningPlayerId;
        resigningDelta = transition.resigningDelta;
        isRankedGame = transition.isRanked;

        tx.update(docRef, sanitize(transition.updatePayload));
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

    const game = localGameStore.getRaw(gameId);
    if (!game || game.status !== 'in_progress') return null;

    const transition = computeResignTransition(game, resigningColor);
    localGameStore.set({ ...game, ...transition.updatePayload });

    if (transition.winningPlayerId && (!transition.winningPlayerId.startsWith('guest_') && transition.winningPlayerId !== 'guest')) {
      try {
        await updateUserStats(
          transition.winningPlayerId,
          true,
          false,
          transition.isRanked ? transition.winningDelta : 0
        );
        await markGameEloProcessed(gameId, transition.winningPlayerId);
      } catch (e) {
        console.warn('Failed to update stats for winning player:', e);
      }
    }

    if (transition.resigningPlayerId) {
      try {
        const updated = await updateUserStats(
          transition.resigningPlayerId,
          false,
          false,
          transition.isRanked ? transition.resigningDelta : 0
        );
        await markGameEloProcessed(gameId, transition.resigningPlayerId);
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

        const callerId = auth?.currentUser?.uid;
        const transition = computeTimeoutTransition(game, timedOutColor, callerId);
        timedOutPlayerId = transition.timedOutPlayerId;
        timedOutDelta = transition.timedOutDelta;
        timeoutWinnerPlayerId = transition.timeoutWinnerPlayerId;
        timeoutWinnerDelta = transition.timeoutWinnerDelta;
        isRankedGame = transition.isRanked;

        tx.update(docRef, sanitize(transition.updatePayload));
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

    const game = localGameStore.getRaw(gameId);
    if (!game || game.status !== 'in_progress') return null;

    const transition = computeTimeoutTransition(game, timedOutColor);
    localGameStore.set({ ...game, ...transition.updatePayload });

    if (transition.timeoutWinnerPlayerId && (!transition.timeoutWinnerPlayerId.startsWith('guest_') && transition.timeoutWinnerPlayerId !== 'guest')) {
      try {
        await updateUserStats(
          transition.timeoutWinnerPlayerId,
          true,
          false,
          transition.isRanked ? transition.timeoutWinnerDelta : 0
        );
        await markGameEloProcessed(gameId, transition.timeoutWinnerPlayerId);
      } catch (e) {
        console.warn('Failed to update stats for winning player:', e);
      }
    }

    if (transition.timedOutPlayerId) {
      try {
        const updated = await updateUserStats(
          transition.timedOutPlayerId,
          false,
          false,
          transition.isRanked ? transition.timedOutDelta : 0
        );
        await markGameEloProcessed(gameId, transition.timedOutPlayerId);
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
 * Updates a player's disconnected status timestamp in real time.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) single-document write/update.
 * - Auxiliary Space Complexity: O(1) constant-size payload allocation.
 * - Growth Rate: O(1) flat execution cost minimizing Firestore CRUD operations.
 *
 * @param gameId Unique identifier of the game room.
 * @param color Color of the player ('blue' or 'green').
 * @param disconnected Whether the player is currently disconnected.
 * @throws TypeError if gameId is not a non-empty string.
 * @throws RangeError if color is neither 'blue' nor 'green'.
 */
export async function setPlayerDisconnectedAction(
  gameId: string,
  color: PieceColor,
  disconnected: boolean
): Promise<void> {
  if (typeof gameId !== 'string' || gameId.trim().length === 0) {
    throw new TypeError(`Invalid gameId: expected non-empty string, received "${gameId}".`);
  }
  if (color !== 'blue' && color !== 'green') {
    throw new RangeError(`Invalid color: expected "blue" or "green", received "${color}".`);
  }

  const updatePayload: Partial<GameRoom> = {
    [color === 'blue' ? 'blueDisconnectedAt' : 'greenDisconnectedAt']: disconnected ? Date.now() : null,
  };

  if (isFirebaseConfigured() && db) {
    try {
      const docRef = doc(db, MULTIPLAYER_SCALE_CONFIG.collections.games, gameId);
      await updateDoc(docRef, sanitize(updatePayload));
    } catch (err) {
      console.warn('Could not update player disconnect status in Firestore:', err);
    }
  } else {
    const game = localGameStore.get(gameId);
    if (
      game &&
      game.status === 'in_progress' &&
      !(typeof game.timeControlMinutes === 'number' &&
        game.timeControlMinutes >= LOBBY_CONFIG.correspondenceCutoffMinutes)
    ) {
      localGameStore.set({ ...game, ...updatePayload });
    }
  }
}

/**
 * Resolves an abandoned game due to disconnected grace period expiration.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) atomic transactional update and user stats modification.
 * - Auxiliary Space Complexity: O(1) memory overhead.
 * - Growth Rate: O(1) flat growth rate ensuring stable scaling across concurrent games.
 *
 * @param gameId Unique identifier of the game room.
 * @param abandonedColor Color of the player who abandoned ('blue' or 'green').
 * @returns Updated user profile if current user's rating was affected, or null.
 * @throws TypeError if gameId is not a non-empty string.
 * @throws RangeError if abandonedColor is neither 'blue' nor 'green'.
 */
export async function abandonGameDueToDisconnectAction(
  gameId: string,
  abandonedColor: PieceColor
): Promise<UserProfile | null> {
  if (typeof gameId !== 'string' || gameId.trim().length === 0) {
    throw new TypeError(`Invalid gameId: expected non-empty string, received "${gameId}".`);
  }
  if (abandonedColor !== 'blue' && abandonedColor !== 'green') {
    throw new RangeError(`Invalid abandonedColor: expected "blue" or "green", received "${abandonedColor}".`);
  }

  if (pendingResolutionGameIds.has(gameId)) return null;
  pendingResolutionGameIds.add(gameId);

  try {
    if (isFirebaseConfigured() && db) {
      const docRef = doc(db, MULTIPLAYER_SCALE_CONFIG.collections.games, gameId);
      let abandonedPlayerId: string | null = null;
      let abandonedDelta = 0;
      let winnerPlayerId: string | null = null;
      let winnerDelta = 0;
      let isRankedGame = false;

      await runTransaction(db, async (tx) => {
        const snap = await tx.get(docRef);
        if (!snap.exists()) return;

        const game = snap.data() as GameRoom;
        if (
          game.status !== 'in_progress' ||
          (typeof game.timeControlMinutes === 'number' &&
            game.timeControlMinutes >= LOBBY_CONFIG.correspondenceCutoffMinutes)
        ) {
          return;
        }

        const callerId = auth?.currentUser?.uid;
        const transition = computeAbandonmentTransition(game, abandonedColor, callerId);
        abandonedPlayerId = transition.abandonedPlayerId;
        abandonedDelta = transition.abandonedDelta;
        winnerPlayerId = transition.winnerPlayerId;
        winnerDelta = transition.winnerDelta;
        isRankedGame = transition.isRanked;

        tx.update(docRef, sanitize(transition.updatePayload));
      });

      if (winnerPlayerId && (!auth?.currentUser || auth.currentUser.uid === winnerPlayerId)) {
        try {
          const updated = await updateUserStats(
            winnerPlayerId,
            true,
            false,
            isRankedGame ? winnerDelta : 0
          );
          await markGameEloProcessed(gameId, winnerPlayerId);
          return updated;
        } catch (e) {
          console.warn('Failed to update stats for winning player on abandonment:', e);
        }
      }

      if (abandonedPlayerId && (!auth?.currentUser || auth.currentUser.uid === abandonedPlayerId)) {
        try {
          const updated = await updateUserStats(
            abandonedPlayerId,
            false,
            false,
            isRankedGame ? abandonedDelta : 0
          );
          await markGameEloProcessed(gameId, abandonedPlayerId);
          return updated;
        } catch (e) {
          console.warn('Failed to update stats for abandoning player:', e);
        }
      }
      return null;
    }

    const game = localGameStore.getRaw(gameId);
    if (
      !game ||
      game.status !== 'in_progress' ||
      (typeof game.timeControlMinutes === 'number' &&
        game.timeControlMinutes >= LOBBY_CONFIG.correspondenceCutoffMinutes)
    ) {
      return null;
    }

    const transition = computeAbandonmentTransition(game, abandonedColor);
    localGameStore.set({ ...game, ...transition.updatePayload });

    if (transition.winnerPlayerId && (!transition.winnerPlayerId.startsWith('guest_') && transition.winnerPlayerId !== 'guest')) {
      try {
        await updateUserStats(
          transition.winnerPlayerId,
          true,
          false,
          transition.isRanked ? transition.winnerDelta : 0
        );
        await markGameEloProcessed(gameId, transition.winnerPlayerId);
      } catch (e) {
        console.warn('Failed to update stats for winning player on abandonment:', e);
      }
    }

    if (transition.abandonedPlayerId) {
      try {
        const updated = await updateUserStats(
          transition.abandonedPlayerId,
          false,
          false,
          transition.isRanked ? transition.abandonedDelta : 0
        );
        await markGameEloProcessed(gameId, transition.abandonedPlayerId);
        return updated;
      } catch (e) {
        console.warn('Failed to update stats for abandoning player:', e);
      }
    }
    return null;
  } finally {
    pendingResolutionGameIds.delete(gameId);
  }
}

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
    const game = localGameStore.get(gameId);
    if (game) {
      localGameStore.set({ ...game, ...updatePayload });
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
    localGameStore.delete(gameId);
  }
}

// Wire up timeout handlers to avoid circular module dependencies
localGameStore.setTimeoutHandler(timeoutGameAction);
setLobbyTimeoutHandler(timeoutGameAction);
setCleanupHandlers({
  timeoutHandler: timeoutGameAction,
  abandonHandler: abandonGame,
  abandonDueToDisconnectHandler: abandonGameDueToDisconnectAction,
});
