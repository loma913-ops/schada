import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import { MULTIPLAYER_SCALE_CONFIG } from './multiplayerConfig';
import { isGameTimedOut } from './gameClock';
import { evaluateGameAbandonment } from './gameTransitions';
import { localGameStore } from './localGameStore';
import { pruneStaleGuestSessions } from './presenceService';
import { ABANDONED_GAME_EXPIRY_MS, type GameRoom } from './gameTypes';
import { LOBBY_CONFIG } from '@/components/lobby/lobbyConfig';
import type { PieceColor } from '@/core/schada/types';

const SESSION_STORAGE_PREFIX = MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.playerTokenPrefix;

let cleanupTimeoutHandler: ((id: string, color: PieceColor) => Promise<unknown>) | null = null;
let cleanupAbandonHandler: ((id: string) => Promise<unknown>) | null = null;
let cleanupAbandonDueToDisconnectHandler: ((id: string, color: PieceColor) => Promise<unknown>) | null = null;

export function setCleanupHandlers(handlers: {
  timeoutHandler?: ((id: string, color: PieceColor) => Promise<unknown>) | null;
  abandonHandler?: ((id: string) => Promise<unknown>) | null;
  abandonDueToDisconnectHandler?: ((id: string, color: PieceColor) => Promise<unknown>) | null;
}): void {
  if (handlers.timeoutHandler !== undefined) cleanupTimeoutHandler = handlers.timeoutHandler;
  if (handlers.abandonHandler !== undefined) cleanupAbandonHandler = handlers.abandonHandler;
  if (handlers.abandonDueToDisconnectHandler !== undefined) {
    cleanupAbandonDueToDisconnectHandler = handlers.abandonDueToDisconnectHandler;
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
 * - Local Mode:
 *   - Iteration Time Complexity: O(min(M, K)) where M is total local games in localStorage and K is maxCleanupBatchSize.
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
      // 1. Remove games explicitly marked as 'abandoned' and older than maxAgeMs in a single atomic batch.
      //    The where + orderBy clause uses the (status, createdAt ASC) composite index, returning
      //    only genuinely-eligible documents and reading 0 docs when there are no stale games.
      const abandonedCutoff = now - maxAgeMs;
      const qAbandoned = query(
        collection(db, MULTIPLAYER_SCALE_CONFIG.collections.games),
        where('status', '==', 'abandoned'),
        where('createdAt', '<=', abandonedCutoff),
        orderBy('createdAt', 'asc'),
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
        if (timeoutCheck.timedOut && timeoutCheck.timedOutColor && cleanupTimeoutHandler) {
          await cleanupTimeoutHandler(docSnap.id, timeoutCheck.timedOutColor).catch((err) => {
            console.warn('Failed to timeout in-progress game in cleanup:', docSnap.id, err);
          });
        } else {
          const abandonCheck = evaluateGameAbandonment(game, now);
          if (abandonCheck.shouldAbandon && abandonCheck.disconnectedColor && cleanupAbandonDueToDisconnectHandler) {
            await cleanupAbandonDueToDisconnectHandler(docSnap.id, abandonCheck.disconnectedColor).catch((err) => {
              console.warn('Failed to auto-abandon in-progress game in cleanup:', docSnap.id, err);
            });
          }
        }
      }

      // 3. Mark stale waiting games as abandoned if older than maxAgeMs in a single atomic batch
      if (maxAgeMs > 0) {
        // 3. Mark stale waiting games as abandoned if older than maxAgeMs in a single atomic batch.
        //    The where + orderBy clause eliminates documents created within maxAgeMs, reading 0 docs
        //    when no rooms have been waiting long enough.
        const waitingCutoff = now - maxAgeMs;
        const qWaiting = query(
          collection(db, MULTIPLAYER_SCALE_CONFIG.collections.games),
          where('status', '==', 'waiting'),
          where('createdAt', '<=', waitingCutoff),
          orderBy('createdAt', 'asc'),
          limit(batchLimit)
        );
        const snapWaiting = await getDocs(qWaiting);
        const batchWaiting = writeBatch(db);
        let waitingUpdateCount = 0;

        for (const docSnap of snapWaiting.docs) {
          const game = docSnap.data() as GameRoom;
          // Protect correspondence games from being marked abandoned while waiting for opponents
          if (
            typeof game.timeControlMinutes === 'number' &&
            game.timeControlMinutes >= LOBBY_CONFIG.correspondenceCutoffMinutes
          ) {
            continue;
          }

          batchWaiting.update(docSnap.ref, {
            status: 'abandoned',
            abandonedAt: now,
            lastTurnStartTimeMs: null,
          });
          waitingUpdateCount++;
        }

        if (waitingUpdateCount > 0) {
          await batchWaiting.commit();
        }
      }

      // 4. Opportunistically prune stale guest sessions older than 15 minutes
      await pruneStaleGuestSessions().catch((err) => {
        console.warn('Failed to prune stale guest sessions in cleanup:', err);
      });
    } catch (err) {
      console.warn('Failed to cleanup abandoned games from Firestore:', err);
    }
  } else {
    const all = localGameStore.getAll();
    let processedCount = 0;
    for (const [id, game] of Object.entries(all)) {
      if (processedCount >= batchLimit) break;
      if (game.status === 'abandoned') {
        if (
          typeof game.timeControlMinutes === 'number' &&
          game.timeControlMinutes >= LOBBY_CONFIG.correspondenceCutoffMinutes
        ) {
          continue;
        }
        const abandonedTime = game.abandonedAt || game.createdAt;
        if (abandonedTime && now - abandonedTime >= maxAgeMs) {
          localGameStore.delete(id);
          removedIds.push(id);
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(SESSION_STORAGE_PREFIX + id);
          }
          processedCount++;
        }
      } else if (game.status === 'in_progress') {
        const timeoutCheck = isGameTimedOut(game);
        if (timeoutCheck.timedOut && timeoutCheck.timedOutColor && cleanupTimeoutHandler) {
          cleanupTimeoutHandler(id, timeoutCheck.timedOutColor).catch(() => {});
          processedCount++;
        } else {
          const abandonCheck = evaluateGameAbandonment(game, now);
          if (abandonCheck.shouldAbandon && abandonCheck.disconnectedColor && cleanupAbandonDueToDisconnectHandler) {
            cleanupAbandonDueToDisconnectHandler(id, abandonCheck.disconnectedColor).catch(() => {});
            processedCount++;
          }
        }
      } else if (game.status === 'waiting' && maxAgeMs > 0) {
        if (
          typeof game.timeControlMinutes === 'number' &&
          game.timeControlMinutes >= LOBBY_CONFIG.correspondenceCutoffMinutes
        ) {
          continue;
        }
        if (game.createdAt && now - game.createdAt >= maxAgeMs) {
          if (cleanupAbandonHandler) {
            cleanupAbandonHandler(id).catch(() => {});
          } else {
            const nowTime = Date.now();
            localGameStore.set({
              ...game,
              status: 'abandoned',
              abandonedAt: nowTime,
              lastTurnStartTimeMs: null,
            });
          }
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
