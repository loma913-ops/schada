import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.hoisted(() => {
  class StorageMock {
    private store: Record<string, string> = {};
    getItem(key: string) {
      return this.store[key] || null;
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
  if (typeof globalThis.sessionStorage === 'undefined') {
    (globalThis as any).sessionStorage = new StorageMock();
  }
});

vi.mock('../config', () => ({
  isFirebaseConfigured: () => false,
  db: null,
  auth: null,
  app: null,
}));

import {
  getCachedAuthProfile,
  getInitialAuthState,
  loginUser,
  logoutUser,
  registerUser,
  setUserOnlineStatus,
} from '../authService';
import { MULTIPLAYER_SCALE_CONFIG } from '../multiplayerConfig';
import { mockBackend } from '../mockProvider';

describe('authService caching and hydration', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    mockBackend.logout();
  });

  it('provides synchronous initial state when no user is logged in', () => {
    const state = getInitialAuthState();
    expect(state.initialUser).toBeNull();
    expect(state.initialLoading).toBe(false);
  });

  it('hydrates user synchronously after registration without sign-in flicker', async () => {
    const user = await registerUser('test@example.com', 'password123', 'chess_master');
    expect(user.username).toBe('chess_master');

    const state = getInitialAuthState();
    expect(state.initialUser).not.toBeNull();
    expect(state.initialUser?.username).toBe('chess_master');
    expect(state.initialLoading).toBe(false);
  });

  it('hydrates user synchronously after login', async () => {
    await registerUser('test2@example.com', 'password123', 'knight_rider');
    await logoutUser();

    // Logged out state
    expect(getInitialAuthState().initialUser).toBeNull();

    await loginUser('test2@example.com', 'password123');
    const state = getInitialAuthState();
    expect(state.initialUser?.username).toBe('knight_rider');
    expect(state.initialLoading).toBe(false);
  });

  it('clears cached state cleanly upon logout', async () => {
    await registerUser('test3@example.com', 'password123', 'pawn_storm');
    expect(getInitialAuthState().initialUser).not.toBeNull();

    await logoutUser();
    const state = getInitialAuthState();
    expect(state.initialUser).toBeNull();
    expect(state.initialLoading).toBe(false);

    const uidKey = MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.authCachedUid;
    const profileKey = MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.authCachedProfile;
    expect(localStorage.getItem(uidKey)).toBeNull();
    expect(localStorage.getItem(profileKey)).toBeNull();
  });

  it('synchronizes online status updates into cached profile', async () => {
    await registerUser('test4@example.com', 'password123', 'rook_lifter');
    await setUserOnlineStatus('in-game');

    const profileKey = MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.authCachedProfile;
    const raw = localStorage.getItem(profileKey);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.status).toBe('in-game');
  });

  it('retrieves cached auth profile safely with getCachedAuthProfile', async () => {
    await registerUser('test5@example.com', 'password123', 'bishop_boss');
    const profile = getCachedAuthProfile();
    expect(profile).not.toBeNull();
    expect(profile?.username).toBe('bishop_boss');
  });
});
