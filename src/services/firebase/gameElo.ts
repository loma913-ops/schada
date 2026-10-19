import {
  doc,
  updateDoc,
  arrayUnion,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import { MULTIPLAYER_SCALE_CONFIG } from './multiplayerConfig';
import { calculateEloUpdate } from '@/core/elo/eloService';
import { updateUserStats } from './authService';
import type { UserProfile } from './localProvider';
import type { PieceColor } from '@/core/schada/types';
import { type GameRoom, type GameEloResult, isGuestUser } from './gameTypes';
import { localGameStore } from './localGameStore';
import { determineTimeCategory } from '@/components/lobby/lobbyConfig';
import { ELO_CONFIG, validateEloConfig } from '@/core/elo/eloConfig';

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
  outcome: PieceColor | 'draw'
): GameEloResult | null {
  const whitePlayer = game.whitePlayer;
  const blackPlayer = game.blackPlayer;
  if (!game.isRanked || !whitePlayer || !blackPlayer) {
    return null;
  }
  if (isGuestUser(whitePlayer) || isGuestUser(blackPlayer)) {
    return null;
  }
  validateEloConfig(ELO_CONFIG);
  const whiteGames = typeof whitePlayer.gamesPlayed === 'number'
    ? whitePlayer.gamesPlayed
    : ELO_CONFIG.defaultAssumedGamesPlayed;
  const blackGames = typeof blackPlayer.gamesPlayed === 'number'
    ? blackPlayer.gamesPlayed
    : ELO_CONFIG.defaultAssumedGamesPlayed;

  const initialWhiteElo = whitePlayer.elo;
  const initialBlackElo = blackPlayer.elo;

  const calc = calculateEloUpdate(
    {
      rating: initialWhiteElo,
      gamesPlayed: whiteGames,
    },
    {
      rating: initialBlackElo,
      gamesPlayed: blackGames,
    },
    outcome
  );
  return {
    initialWhiteElo,
    initialBlackElo,
    whiteDelta: calc.whiteDelta,
    blackDelta: calc.blackDelta,
    newWhiteElo: calc.newWhiteRating,
    newBlackElo: calc.newBlackRating,
  };
}

const RECONCILE_LAST_RUN_PREFIX = MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.reconcileLastRunPrefix;
const RECONCILE_COOLDOWN_MS = MULTIPLAYER_SCALE_CONFIG.matchmaking.reconcileCooldownMs;

/**
 * Clears the reconciliation cooldown timestamp so the next reconcile runs immediately.
 *
 * Algorithmic Complexity (Big O):
 * - Time Complexity: O(1) for specific userId removal; O(S) where S is the small number of keys in sessionStorage when clearing all.
 * - Auxiliary Space Complexity: O(1) scalar memory.
 * - Growth Rate: O(1) constant in-memory session cleanup with zero database interactions.
 *
 * @param userId Optional user identifier to clear. If omitted, clears all reconcile cooldown keys.
 */
export function clearReconcileCooldown(userId?: string): void {
  if (typeof sessionStorage !== 'undefined') {
    if (userId) {
      sessionStorage.removeItem(RECONCILE_LAST_RUN_PREFIX + userId);
    } else {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith(RECONCILE_LAST_RUN_PREFIX)) {
          sessionStorage.removeItem(key);
        }
      }
    }
  }
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
  clearReconcileCooldown(userId);
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
    const game = localGameStore.get(gameId);
    if (game) {
      const currentProcessed = Array.isArray(game.processedEloUserIds) ? game.processedEloUserIds : [];
      if (!currentProcessed.includes(userId)) {
        localGameStore.set({ ...game, processedEloUserIds: [...currentProcessed, userId] });
      }
    }
  }
}

/**
 * Scans recently completed ranked games for the authenticated user where Elo has not yet been processed.
 * Guarantees that ratings are never lost if a user exits early, closes the browser tab, or experiences network interruptions.
 * Cooldown-gated to at most once per reconcileCooldownMs (10 mins) per session to eliminate redundant Firestore queries.
 *
 * Algorithmic Complexity (Big O):
 * - Time Complexity: O(K) where K <= reconcileEloBatchLimit recent completed games examined.
 * - Auxiliary Space Complexity: O(1) constant scalar memory.
 * - Database Reads/Writes: Optimized to read at most reconcileEloBatchLimit candidate games and update only when pending.
 * - In-flight deduplication: Concurrent calls coalesce into a single execution, preventing race conditions.
 * - Self-healing query: Attempts ordered index query; falls back silently if composite index is still building.
 */
let inFlightReconcilePromise: Promise<UserProfile | null> | null = null;

export async function reconcilePendingElo(userId: string, force: boolean = false): Promise<UserProfile | null> {
  if (!userId || userId.startsWith('guest_') || userId === 'guest') return null;

  if (!force && typeof sessionStorage !== 'undefined') {
    const lastRunRaw = sessionStorage.getItem(RECONCILE_LAST_RUN_PREFIX + userId);
    if (lastRunRaw) {
      const lastRun = Number(lastRunRaw);
      if (!isNaN(lastRun) && Date.now() - lastRun < RECONCILE_COOLDOWN_MS) {
        return null;
      }
    }
  }

  // In-flight deduplication: reuse existing promise if one is already running for this call stack
  if (inFlightReconcilePromise) return inFlightReconcilePromise;

  inFlightReconcilePromise = _runReconcilePendingElo(userId)
    .then((profile) => {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(RECONCILE_LAST_RUN_PREFIX + userId, String(Date.now()));
      }
      return profile;
    })
    .finally(() => {
      inFlightReconcilePromise = null;
    });
  return inFlightReconcilePromise;
}

async function _runReconcilePendingElo(userId: string): Promise<UserProfile | null> {

  let latestProfile: UserProfile | null = null;

  if (isFirebaseConfigured() && db) {
    try {
      const gamesCol = collection(db, MULTIPLAYER_SCALE_CONFIG.collections.games);
      const batchLimit = MULTIPLAYER_SCALE_CONFIG.matchmaking.reconcileEloBatchLimit;

      // Attempt ordered query (most recent games first) for efficient reconciliation.
      // Falls back to unordered query if the composite index is not yet built.
      async function runQuery(field: 'whitePlayer.id' | 'blackPlayer.id') {
        try {
          return await getDocs(query(
            gamesCol,
            where('status', '==', 'completed'),
            where('isRanked', '==', true),
            where(field, '==', userId),
            orderBy('createdAt', 'desc'),
            limit(batchLimit)
          ));
        } catch (err: any) {
          if (err?.code === 'failed-precondition') {
            // Composite index not yet built — fall back to unordered query
            return await getDocs(query(
              gamesCol,
              where('status', '==', 'completed'),
              where('isRanked', '==', true),
              where(field, '==', userId),
              limit(batchLimit)
            ));
          }
          throw err;
        }
      }

      const [whiteSnap, blackSnap] = await Promise.all([
        runQuery('whitePlayer.id'),
        runQuery('blackPlayer.id'),
      ]);

      const candidateGames: GameRoom[] = [];
      const seenIds = new Set<string>();

      [...whiteSnap.docs, ...blackSnap.docs].forEach((docSnap) => {
        if (!seenIds.has(docSnap.id)) {
          seenIds.add(docSnap.id);
          candidateGames.push(docSnap.data() as GameRoom);
        }
      });

      for (const game of candidateGames) {
        if (!game.processedEloUserIds?.includes(userId) && game.winner) {
          const winner: PieceColor | 'draw' = game.winner as PieceColor | 'draw';
          const isWhite = game.whitePlayer?.id === userId;
          const isBlack = game.blackPlayer?.id === userId;
          if (!isWhite && !isBlack) continue;

          const myColor: PieceColor = isWhite ? 'white' : 'black';
          const won = winner === myColor;
          const isDraw = winner === 'draw';

          const eloRes = game.eloResult || computeRankedGameEloResult(game, winner);
          const delta = eloRes
            ? myColor === 'white'
              ? (eloRes.whiteDelta ?? 0)
              : (eloRes.blackDelta ?? 0)
            : 0;
          const category = determineTimeCategory(game.timeControlMinutes, game.incrementSeconds || 0);

          try {
            const updated = await updateUserStats(userId, won, isDraw, delta, category);
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
    // Local store reconciliation
    const all = localGameStore.getAll();
    const candidateGames = Object.values(all).filter(
      (g) =>
        g.status === 'completed' &&
        g.isRanked &&
        (g.whitePlayer?.id === userId || g.blackPlayer?.id === userId) &&
        !g.processedEloUserIds?.includes(userId) &&
        g.winner
    );

    for (const game of candidateGames) {
      const rawWinner = game.winner as string;
      if (!rawWinner) continue;
      const winner: PieceColor | 'draw' = game.winner as PieceColor | 'draw';
      const isWhite = game.whitePlayer?.id === userId;
      const myColor: PieceColor = isWhite ? 'white' : 'black';
      const won = winner === myColor;
      const isDraw = winner === 'draw';

      const eloRes = game.eloResult || computeRankedGameEloResult(game, winner);
      const delta = eloRes
        ? myColor === 'white'
          ? (eloRes.whiteDelta ?? 0)
          : (eloRes.blackDelta ?? 0)
        : 0;
      const category = determineTimeCategory(game.timeControlMinutes, game.incrementSeconds || 0);

      try {
        const updated = await updateUserStats(userId, won, isDraw, delta, category);
        if (updated) {
          latestProfile = updated;
        }
        await markGameEloProcessed(game.id, userId);
      } catch (err) {
        console.warn('[gameService] local reconcilePendingElo failed for game:', game.id, err);
      }
    }
  }

  return latestProfile;
}
