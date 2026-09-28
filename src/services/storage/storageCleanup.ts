/**
 * Browser Storage Sanitation & Quota Management Service.
 *
 * Prevents QuotaExceededError crashes by:
 * 1. Purging orphaned Firebase tab synchronization keys (firestore_*) leaked by persistentMultipleTabManager.
 * 2. Pruning bounded local mock games, active sessions, and player session tokens.
 * 3. Providing safe storage operations with automatic emergency quota eviction and error suppression.
 */

export const STORAGE_LIMITS = {
  maxMockGames: 5,
  maxPlayerTokens: 20,
  maxSessionAgeMs: 60 * 1000, // 60 seconds
} as const;

/**
 * Checks if window.localStorage is accessible.
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
    const testKey = '__schada_storage_test__';
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
 * Algorithmic Complexity:
 * - Time Complexity: O(K) where K is the number of keys in localStorage.
 * - Auxiliary Space Complexity: O(K) for key collection.
 *
 * @param emergency If true, aggressively removes all mock games and non-critical tokens.
 */
export function cleanupBrowserStorage(emergency: boolean = false): void {
  try {
    if (typeof localStorage === 'undefined') return;

    const keysToRemove: string[] = [];
    const playerTokenKeys: string[] = [];

    // Inspect all keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      // 1. Purge all orphaned Firebase multi-tab synchronization keys
      // (firestore_clients_*, firestore_targets_*, firestore_zombie_targets_*, etc.)
      if (key.startsWith('firestore_')) {
        keysToRemove.push(key);
      } else if (key.startsWith('schada_player_token_')) {
        playerTokenKeys.push(key);
      }
    }

    // Remove orphaned firestore tab coordination keys
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }

    // 2. Prune player session tokens
    if (emergency) {
      for (const key of playerTokenKeys) {
        localStorage.removeItem(key);
      }
    } else if (playerTokenKeys.length > STORAGE_LIMITS.maxPlayerTokens) {
      // Remove oldest tokens in excess of limit
      const excess = playerTokenKeys.slice(0, playerTokenKeys.length - STORAGE_LIMITS.maxPlayerTokens);
      for (const key of excess) {
        localStorage.removeItem(key);
      }
    }

    // 3. Prune or purge mock games
    const mockGamesKey = 'schada_mock_games';
    const rawGames = localStorage.getItem(mockGamesKey);
    if (rawGames) {
      if (emergency) {
        localStorage.removeItem(mockGamesKey);
      } else {
        try {
          const games = JSON.parse(rawGames);
          if (games && typeof games === 'object') {
            const gameEntries = Object.entries(games);
            if (gameEntries.length > STORAGE_LIMITS.maxMockGames) {
              // Keep only the most recent games
              const sorted = gameEntries.sort((a: any, b: any) => {
                const timeA = a[1]?.updatedAt || a[1]?.createdAt || 0;
                const timeB = b[1]?.updatedAt || b[1]?.createdAt || 0;
                return timeB - timeA;
              });
              const pruned = Object.fromEntries(sorted.slice(0, STORAGE_LIMITS.maxMockGames));
              localStorage.setItem(mockGamesKey, JSON.stringify(pruned));
            }
          }
        } catch {
          localStorage.removeItem(mockGamesKey);
        }
      }
    }

    // 4. Prune stale active presence sessions
    const activeSessionsKey = 'schada_active_sessions';
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
  } catch (err) {
    console.warn('Storage cleanup encountered an error:', err);
  }
}

/**
 * Safely writes to localStorage with automatic QuotaExceededError handling.
 * If quota is exceeded, performs emergency eviction of non-essential keys and retries once.
 */
export function safeSetItem(key: string, value: string): boolean {
  if (typeof localStorage === 'undefined') return false;

  try {
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
      console.warn(`LocalStorage quota exceeded writing "${key}". Initiating emergency purge...`);
      cleanupBrowserStorage(true);
      try {
        localStorage.setItem(key, value);
        return true;
      } catch (retryErr) {
        console.error(`Failed to write "${key}" to localStorage after emergency purge:`, retryErr);
        return false;
      }
    }

    console.warn(`Could not set localStorage key "${key}":`, e);
    return false;
  }
}

/**
 * Safely reads from localStorage.
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
 */
export function safeRemoveItem(key: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  } catch {
    // Ignore error
  }
}
