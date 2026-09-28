import { describe, it, expect, beforeEach, vi } from 'vitest';

class StorageMock {
  private store: Record<string, string> = {};

  get length() {
    return Object.keys(this.store).length;
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }

  getItem(key: string) {
    return this.store[key] ?? null;
  }

  setItem(key: string, val: string) {
    this.store[key] = String(val);
  }

  removeItem(key: string) {
    delete this.store[key];
  }

  clear() {
    this.store = {};
  }
}

if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = new StorageMock();
}

import {
  cleanupBrowserStorage,
  safeSetItem,
  safeGetItem,
  safeRemoveItem,
  isLocalStorageAvailable,
  STORAGE_LIMITS,
} from '../storageCleanup';

describe('Storage Sanitation & Quota Management Service', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('detects if localStorage is available', () => {
    expect(isLocalStorageAvailable()).toBe(true);
  });

  it('purges orphaned firestore_ keys leaked by persistentMultipleTabManager', () => {
    localStorage.setItem('firestore_clients_firestore/[DEFAULT]/schada-online/_tab1', 'metadata');
    localStorage.setItem('firestore_targets_firestore/[DEFAULT]/schada-online/query1', 'targets');
    localStorage.setItem('firestore_zombie_targets', 'zombies');
    localStorage.setItem('schada_theme', 'dark');

    cleanupBrowserStorage();

    expect(localStorage.getItem('firestore_clients_firestore/[DEFAULT]/schada-online/_tab1')).toBeNull();
    expect(localStorage.getItem('firestore_targets_firestore/[DEFAULT]/schada-online/query1')).toBeNull();
    expect(localStorage.getItem('firestore_zombie_targets')).toBeNull();
    // Non-firestore keys are preserved
    expect(localStorage.getItem('schada_theme')).toBe('dark');
  });

  it('prunes player session tokens beyond maxPlayerTokens limit', () => {
    for (let i = 0; i < 30; i++) {
      localStorage.setItem(`schada_player_token_game${i}`, `tok_${i}`);
    }

    expect(localStorage.length).toBe(30);

    cleanupBrowserStorage();

    let tokenCount = 0;
    for (let i = 0; i < localStorage.length; i++) {
      if (localStorage.key(i)?.startsWith('schada_player_token_')) {
        tokenCount++;
      }
    }

    expect(tokenCount).toBeLessThanOrEqual(STORAGE_LIMITS.maxPlayerTokens);
  });

  it('prunes mock games to maxMockGames limit keeping newest games', () => {
    const mockGames: Record<string, any> = {};
    for (let i = 1; i <= 10; i++) {
      mockGames[`game_${i}`] = {
        id: `game_${i}`,
        createdAt: i * 1000,
        updatedAt: i * 1000,
      };
    }

    localStorage.setItem('schada_mock_games', JSON.stringify(mockGames));

    cleanupBrowserStorage();

    const stored = JSON.parse(localStorage.getItem('schada_mock_games') || '{}');
    const keys = Object.keys(stored);
    expect(keys.length).toBe(STORAGE_LIMITS.maxMockGames);
    // Should preserve games 6 to 10
    expect(stored['game_10']).toBeDefined();
    expect(stored['game_1']).toBeUndefined();
  });

  it('prunes stale presence sessions older than maxSessionAgeMs', () => {
    const now = Date.now();
    const sessions = {
      activeTab: { lastSeen: now - 5000 },
      staleTab: { lastSeen: now - 120000 },
    };

    localStorage.setItem('schada_active_sessions', JSON.stringify(sessions));

    cleanupBrowserStorage();

    const stored = JSON.parse(localStorage.getItem('schada_active_sessions') || '{}');
    expect(stored['activeTab']).toBeDefined();
    expect(stored['staleTab']).toBeUndefined();
  });

  it('safely gets and sets items via safeSetItem and safeGetItem', () => {
    expect(safeSetItem('test_key', 'test_value')).toBe(true);
    expect(safeGetItem('test_key')).toBe('test_value');
    safeRemoveItem('test_key');
    expect(safeGetItem('test_key')).toBeNull();
  });

  it('handles QuotaExceededError by performing emergency purge and retrying', () => {
    localStorage.setItem('firestore_clients_test', 'junk');
    localStorage.setItem('schada_mock_games', JSON.stringify({ g1: { id: 'g1' } }));

    let callCount = 0;
    const originalSetItem = localStorage.setItem.bind(localStorage);

    vi.spyOn(localStorage, 'setItem').mockImplementation((key, val) => {
      callCount++;
      if (callCount === 1) {
        const error = new DOMException('Quota exceeded', 'QuotaExceededError');
        throw error;
      }
      return originalSetItem(key, val);
    });

    const success = safeSetItem('new_key', 'new_value');
    expect(success).toBe(true);
    expect(callCount).toBe(2);
    expect(localStorage.getItem('new_key')).toBe('new_value');
    // Emergency purge should have wiped firestore keys and mock games
    expect(localStorage.getItem('firestore_clients_test')).toBeNull();
    expect(localStorage.getItem('schada_mock_games')).toBeNull();
  });
});
