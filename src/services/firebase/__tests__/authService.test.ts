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
  updateUserStats,
  reloadUserProfile,
  deleteUserAccount,
} from '../authService';
import { MULTIPLAYER_SCALE_CONFIG } from '../multiplayerConfig';
import { localBackend } from '../localProvider';
import { ELO_CONFIG } from '@/core/elo/eloConfig';

describe('authService caching and hydration', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    localBackend.logout();
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

  it('updates user stats and Elo correctly with updateUserStats', async () => {
    const user = await registerUser('elo_test@example.com', 'password123', 'elo_player');
    const initialElo = user.eloRating;

    // Simulate winning a match with +16 delta
    const updated = await updateUserStats(user.id, true, false, 16);
    expect(updated).not.toBeNull();
    expect(updated?.eloRating).toBe(initialElo + 16);
    expect(updated?.gamesPlayed).toBe(1);
    expect(updated?.gamesWon).toBe(1);
    expect(updated?.gamesLost).toBe(0);

    // Verify cached profile is updated
    const cached = getCachedAuthProfile();
    expect(cached?.eloRating).toBe(initialElo + 16);
    expect(cached?.gamesWon).toBe(1);

    // Simulate losing a match with -12 delta
    const afterLoss = await updateUserStats(user.id, false, false, -12);
    expect(afterLoss?.eloRating).toBe(initialElo + 4);
    expect(afterLoss?.gamesPlayed).toBe(2);
    expect(afterLoss?.gamesWon).toBe(1);
    expect(afterLoss?.gamesLost).toBe(1);

    // Verify rating never drops below central ELO_CONFIG.minimumRating
    const massiveLoss = await updateUserStats(user.id, false, false, -5000);
    expect(massiveLoss?.eloRating).toBe(ELO_CONFIG.minimumRating);
  });

  it('reloads user profile and syncs cached credentials', async () => {
    const user = await registerUser('reload_test@example.com', 'password123', 'reload_user');
    await updateUserStats(user.id, true, false, 25);

    const reloaded = await reloadUserProfile();
    expect(reloaded).not.toBeNull();
    expect(reloaded?.id).toBe(user.id);
    expect(reloaded?.eloRating).toBe(user.eloRating + 25);
  });

  it('rejects account deletion when password is empty or blank', async () => {
    await expect(deleteUserAccount('')).rejects.toThrow(
      'Account deletion requires your current password for security verification.'
    );
    await expect(deleteUserAccount('   ')).rejects.toThrow(
      'Account deletion requires your current password for security verification.'
    );
  });

  it('deletes user account and clears cached profile', async () => {
    await registerUser('delete_target@example.com', 'password123', 'delete_user');
    expect(getCachedAuthProfile()).not.toBeNull();

    await deleteUserAccount('password123');
    expect(getCachedAuthProfile()).toBeNull();
    expect(getInitialAuthState().initialUser).toBeNull();
  });
});
