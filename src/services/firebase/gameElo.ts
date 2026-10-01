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
import type { GameRoom, GameEloResult } from './gameTypes';
import { localGameStore } from './localGameStore';

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
 *
 * Algorithmic Complexity (Big O):
 * - Time Complexity: O(K) where K <= reconcileEloBatchLimit recent completed games examined.
 * - Auxiliary Space Complexity: O(1) constant scalar memory.
 * - Database Reads/Writes: Optimized to read at most reconcileEloBatchLimit candidate games and update only when pending.
 * - In-flight deduplication: Concurrent calls coalesce into a single execution, preventing race conditions.
 * - Self-healing query: Attempts ordered index query; falls back silently if composite index is still building.
 */
let inFlightReconcilePromise: Promise<UserProfile | null> | null = null;

export async function reconcilePendingElo(userId: string): Promise<UserProfile | null> {
  if (!userId || userId.startsWith('guest_') || userId === 'guest') return null;

  // In-flight deduplication: reuse existing promise if one is already running for this call stack
  if (inFlightReconcilePromise) return inFlightReconcilePromise;

  inFlightReconcilePromise = _runReconcilePendingElo(userId).finally(() => {
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
      async function runQuery(field: 'bluePlayer.id' | 'greenPlayer.id') {
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

      const [blueSnap, greenSnap] = await Promise.all([
        runQuery('bluePlayer.id'),
        runQuery('greenPlayer.id'),
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
    // Local store reconciliation
    const all = localGameStore.getAll();
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
        console.warn('[gameService] local reconcilePendingElo failed for game:', game.id, err);
      }
    }
  }

  return latestProfile;
}
