/**
 * Browser Storage Sanitation & Quota Management Service.
 *
 * Prevents QuotaExceededError crashes by:
 * 1. Purging orphaned Firebase tab synchronization keys (firestore_*) leaked by persistentMultipleTabManager.
 * 2. Pruning bounded local games, active sessions, and player session tokens.
 * 3. Providing safe storage operations with automatic emergency quota eviction and error suppression.
 */

import { MULTIPLAYER_SCALE_CONFIG } from '../firebase/multiplayerConfig';

export const STORAGE_LIMITS = MULTIPLAYER_SCALE_CONFIG.storageLimits;

/**
 * Checks if window.localStorage is accessible.
 *
 * Algorithmic Complexity (Big O):
 * - Time Complexity: O(1) constant write/delete operation.
 * - Auxiliary Space Complexity: O(1) constant memory.
 */
export function isLocalStorageAvailable(): boolean {
  try {
    const storage =
      typeof window !== 'undefined' && window.localStorage
        ? window.localStorage
        : typeof localStorage !== 'undefined'
          ? localStorage
          : null;
    if (!storage) return false;
    const testKey = STORAGE_LIMITS.testStorageKey;
    storage.setItem(testKey, '1');
    storage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Cleans up orphaned or excessive data stored in localStorage.
 *
 * Algorithmic Complexity (Big O):
 * - Time Complexity: O(K + G log G) where K is the number of keys in localStorage and G is local games count (G <= 10).
 *   Prioritizes linear O(K) growth rate to scale sustainably as browser usage increases.
 * - Auxiliary Space Complexity: O(K) for key collection arrays.
 *
 * @param emergency If true, aggressively removes all local games and non-critical tokens while preserving active match tokens.
 */
export function cleanupBrowserStorage(emergency: boolean = false): void {
  try {
    if (typeof localStorage === 'undefined') return;

    const keysToRemove: string[] = [];
    const playerTokenKeys: string[] = [];
    const playerTokenPrefix = MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.playerTokenPrefix;
    const firestorePrefix = STORAGE_LIMITS.firestoreKeyPrefix;

    // Inspect all keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      // 1. Purge all orphaned Firebase multi-tab synchronization keys
      // (firestore_clients_*, firestore_targets_*, firestore_zombie_targets_*, etc.)
      if (key.startsWith(firestorePrefix)) {
        keysToRemove.push(key);
      } else if (key.startsWith(playerTokenPrefix)) {
        playerTokenKeys.push(key);
      }
    }

    // Remove orphaned firestore tab coordination keys
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }

    // 2. Prune player session tokens
    if (emergency) {
      // In emergency, retain the last emergencyRetainedTokens to protect active games if possible
      const toRemove = playerTokenKeys.slice(
        0,
        Math.max(0, playerTokenKeys.length - STORAGE_LIMITS.emergencyRetainedTokens)
      );
      for (const key of toRemove) {
        localStorage.removeItem(key);
      }
    } else if (playerTokenKeys.length > STORAGE_LIMITS.maxPlayerTokens) {
      // Remove excess tokens beyond limit
      const excess = playerTokenKeys.slice(0, playerTokenKeys.length - STORAGE_LIMITS.maxPlayerTokens);
      for (const key of excess) {
        localStorage.removeItem(key);
      }
    }

    // 3. Prune or purge local games
    const localGamesKey = MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.localGames;
    const rawGames = localStorage.getItem(localGamesKey);
    if (rawGames) {
      if (emergency) {
        localStorage.removeItem(localGamesKey);
        // Also evict leaderboard cache in emergencies to reclaim space
        localStorage.removeItem(MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.cachedLeaderboard);
        localStorage.removeItem(MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.cachedLeaderboardTime);
      } else {
        try {
          const games = JSON.parse(rawGames);
          if (games && typeof games === 'object') {
            const gameEntries = Object.entries(games);
            if (gameEntries.length > STORAGE_LIMITS.maxLocalGames) {
              // Keep only the most recent games
              const sorted = gameEntries.sort((a: any, b: any) => {
                const timeA = a[1]?.updatedAt || a[1]?.createdAt || 0;
                const timeB = b[1]?.updatedAt || b[1]?.createdAt || 0;
                return timeB - timeA;
              });
              const pruned = Object.fromEntries(sorted.slice(0, STORAGE_LIMITS.maxLocalGames));
              localStorage.setItem(localGamesKey, JSON.stringify(pruned));
            }
          }
        } catch {
          localStorage.removeItem(localGamesKey);
        }
      }
    }

    // 4. Prune stale active presence sessions
    const sessionKeys = [
      MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.activeSessions,
      MULTIPLAYER_SCALE_CONFIG.storageLimits.legacyActiveSessions,
    ];
    for (const activeSessionsKey of sessionKeys) {
      const rawSessions = localStorage.getItem(activeSessionsKey);
      if (rawSessions) {
        try {
          const sessions = JSON.parse(rawSessions);
          const now = Date.now();
          let changed = false;
          if (sessions && typeof sessions === 'object') {
            for (const [id, s] of Object.entries(sessions as Record<string, any>)) {
              if (!s || typeof s.lastSeen !== 'number' || now - s.lastSeen > STORAGE_LIMITS.maxSessionAgeMs) {
                delete sessions[id];
                changed = true;
              }
            }
            if (changed) {
              localStorage.setItem(activeSessionsKey, JSON.stringify(sessions));
            }
          }
        } catch {
          localStorage.removeItem(activeSessionsKey);
        }
      }
    }
  } catch (err) {
    console.warn('Storage cleanup encountered an error:', err);
  }
}

/**
 * Safely writes to localStorage with automatic QuotaExceededError handling.
 * If quota is exceeded, performs emergency eviction of non-essential keys and retries once.
 *
 * Algorithmic Complexity (Big O):
 * - Time Complexity: O(1) amortized normal execution; O(K) in rare emergency purge scenario where K is key count.
 * - Auxiliary Space Complexity: O(1) in steady state; O(K) temporary array allocations during emergency purge.
 */
export function safeSetItem(key: string, value: string): boolean {
  if (typeof localStorage === 'undefined') return false;

  try {
    // codeql[js/clear-text-storage-of-sensitive-data]
    localStorage.setItem(key, value);
    return true;
  } catch (e: any) {
    const isQuotaError =
      e instanceof DOMException &&
      (e.name === 'QuotaExceededError' ||
        e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        e.code === 22 ||
        e.code === 1014);

    if (isQuotaError) {
      console.warn('LocalStorage quota exceeded. Initiating emergency purge for key:', key);
      cleanupBrowserStorage(true);
      try {
        // codeql[js/clear-text-storage-of-sensitive-data]
        localStorage.setItem(key, value);
        return true;
      } catch (retryErr) {
        console.error('Failed to write to localStorage after emergency purge:', key, retryErr);
        return false;
      }
    }

    console.warn('Could not set localStorage key:', key, e);
    return false;
  }
}

/**
 * Safely reads from localStorage.
 *
 * Algorithmic Complexity (Big O):
 * - Time Complexity: O(1) constant time hash lookup.
 * - Auxiliary Space Complexity: O(1) scalar reference.
 */
export function safeGetItem(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Safely removes a key from localStorage.
 *
 * Algorithmic Complexity (Big O):
 * - Time Complexity: O(1) constant time deletion.
 * - Auxiliary Space Complexity: O(1) constant memory.
 */
export function safeRemoveItem(key: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  } catch {
    // Ignore error
  }
}
