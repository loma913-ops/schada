import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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

import {
  syncPresenceHeartbeat,
  isCurrentClientActive,
  isCurrentClientRegistered,
  subscribeToLobbyStats,
  setActivityContext,
  cleanupCurrentTabSession,
  recordUserActivity,
  checkIsUserActiveAcrossTabs,
  resetPresenceStateForTesting,
  ACTIVE_SESSIONS_STORAGE_KEY,
  AUTH_CACHED_UID_KEY,
  IDLE_TIMEOUT_MS,
  type SessionHeartbeat,
  type LobbyStats,
} from '../presenceService';
import { mockBackend } from '../mockProvider';

vi.mock('../config', () => ({
  isFirebaseConfigured: () => false,
  db: null,
  auth: null,
  app: null,
}));

describe('User Online & Active Presence Service', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.useFakeTimers();
    resetPresenceStateForTesting();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('unauthenticated / guest users are never marked with user status of online', () => {
    // Current user is null (guest)
    expect(mockBackend.getCurrentUser()).toBeNull();
    const reg = isCurrentClientRegistered();
    expect(reg.isRegistered).toBe(false);
    expect(reg.userId).toBeNull();

    // Run heartbeat
    syncPresenceHeartbeat();

    // Verify stats: 0 players online, 1 guest online
    let emittedStats: LobbyStats | null = null;
    const unsub = subscribeToLobbyStats((stats) => {
      emittedStats = stats;
    });

    const receivedStats = emittedStats as unknown as LobbyStats;
    expect(receivedStats.playersOnline).toBe(0);
    expect(receivedStats.guestsOnline).toBe(1);

    unsub();
  });

  it('logged in user has status of online when active', () => {
    // Register / login user
    const user = mockBackend.register('player1@test.com', 'pass', 'ActiveGamer');
    expect(user.id).toBeDefined();

    // Active client sync
    recordUserActivity();
    syncPresenceHeartbeat();

    // User status must be 'online'
    const currentUser = mockBackend.getCurrentUser();
    expect(currentUser).not.toBeNull();
    expect(currentUser?.status).toBe('online');

    // Stats reflect 1 player online
    let emittedStats: LobbyStats | null = null;
    const unsub = subscribeToLobbyStats((stats) => {
      emittedStats = stats;
    });

    const receivedStats = emittedStats as unknown as LobbyStats;
    expect(receivedStats.playersOnline).toBe(1);
    expect(receivedStats.guestsOnline).toBe(0);

    unsub();
  });

  it('user status transitions to offline when idle for > 2 minutes', () => {
    mockBackend.register('idle@test.com', 'pass', 'IdlePlayer');
    recordUserActivity();
    syncPresenceHeartbeat();

    expect(mockBackend.getCurrentUser()?.status).toBe('online');

    // Advance clock past idle timeout (2 minutes)
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS + 1000);
    expect(isCurrentClientActive()).toBe(false);

    // Heartbeat fires while idle
    syncPresenceHeartbeat();

    // User status MUST now be offline
    const user = mockBackend.getCurrentUser();
    expect(user?.status).toBe('offline');

    // Players online count drops to 0
    let emittedStats: LobbyStats | null = null;
    const unsub = subscribeToLobbyStats((stats) => {
      emittedStats = stats;
    });
    const receivedStats = emittedStats as unknown as LobbyStats;
    expect(receivedStats.playersOnline).toBe(0);
    unsub();
  });

  it('user status transitions back to online immediately upon user interaction', () => {
    mockBackend.register('reactive@test.com', 'pass', 'ReactivePlayer');
    recordUserActivity();
    syncPresenceHeartbeat();

    // Go idle
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS + 5000);
    syncPresenceHeartbeat();
    expect(mockBackend.getCurrentUser()?.status).toBe('offline');

    // Advance 2 seconds and simulate user interaction (activity recorded)
    vi.advanceTimersByTime(2000);
    recordUserActivity();

    expect(isCurrentClientActive()).toBe(true);
    expect(mockBackend.getCurrentUser()?.status).toBe('online');

    let emittedStats: LobbyStats | null = null;
    const unsub = subscribeToLobbyStats((stats) => {
      emittedStats = stats;
    });
    const receivedStats = emittedStats as unknown as LobbyStats;
    expect(receivedStats.playersOnline).toBe(1);
    unsub();
  });

  it('closing tab or navigating away transitions user status to offline', () => {
    const user = mockBackend.register('leaving@test.com', 'pass', 'LeavingPlayer');
    recordUserActivity();
    syncPresenceHeartbeat();
    expect(mockBackend.getCurrentUser()?.status).toBe('online');

    // Simulate tab close / pagehide
    cleanupCurrentTabSession();

    // Active session removed and status set to offline
    expect(checkIsUserActiveAcrossTabs(user.id)).toBe(false);
    expect(mockBackend.getCurrentUser()?.status).toBe('offline');
  });

  it('multi-tab behavior: user remains online if at least one tab is active', () => {
    const user = mockBackend.register('multitab@test.com', 'pass', 'MultiTabUser');

    // Simulate Tab 1: Active
    const tab1Sessions: Record<string, SessionHeartbeat> = {
      session_tab_1: {
        lastSeen: Date.now(),
        isRegistered: true,
        userId: user.id,
        isActive: true,
      },
      session_tab_2: {
        lastSeen: Date.now(),
        isRegistered: true,
        userId: user.id,
        isActive: false, // Tab 2 is in background / idle
      },
    };
    localStorage.setItem(ACTIVE_SESSIONS_STORAGE_KEY, JSON.stringify(tab1Sessions));

    expect(checkIsUserActiveAcrossTabs(user.id)).toBe(true);
    expect(mockBackend.getCurrentUser()?.status).toBe('online');

    // Tab 1 closes or becomes inactive
    tab1Sessions.session_tab_1.isActive = false;
    localStorage.setItem(ACTIVE_SESSIONS_STORAGE_KEY, JSON.stringify(tab1Sessions));

    expect(checkIsUserActiveAcrossTabs(user.id)).toBe(false);
    expect(mockBackend.getCurrentUser()?.status).toBe('offline');
  });

  it('friends list only displays friends as online if they are logged in and active', () => {
    const userA = mockBackend.register('usera@test.com', 'pass', 'UserA');
    const userB = mockBackend.register('userb@test.com', 'pass', 'UserB');

    // Add UserB to UserA's friends list
    localStorage.setItem('schada_mock_friends', JSON.stringify({
      [userA.id]: [userB.id],
    }));

    // Before UserB has an active session, UserB must be displayed as offline
    let friends = mockBackend.getFriends(userA.id);
    expect(friends.length).toBe(1);
    expect(friends[0].username).toBe('UserB');
    expect(friends[0].status).toBe('offline');

    // Now simulate UserB logging in and active in a session
    const sessions: Record<string, SessionHeartbeat> = {
      session_b: {
        lastSeen: Date.now(),
        isRegistered: true,
        userId: userB.id,
        isActive: true,
      },
    };
    localStorage.setItem(ACTIVE_SESSIONS_STORAGE_KEY, JSON.stringify(sessions));

    // UserB should now show as online
    friends = mockBackend.getFriends(userA.id);
    expect(friends[0].status).toBe('online');

    // UserB becomes inactive
    sessions.session_b.isActive = false;
    localStorage.setItem(ACTIVE_SESSIONS_STORAGE_KEY, JSON.stringify(sessions));

    // UserB should now show as offline
    friends = mockBackend.getFriends(userA.id);
    expect(friends[0].status).toBe('offline');
  });

  it('updates activity context to in-game when active in match and offline when idle', () => {
    mockBackend.register('gamer@test.com', 'pass', 'ProGamer');
    recordUserActivity();
    setActivityContext('in-game');

    expect(mockBackend.getCurrentUser()?.status).toBe('in-game');

    // If player goes idle for > 2 min, even in-game they become offline
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS + 2000);
    syncPresenceHeartbeat();
    expect(mockBackend.getCurrentUser()?.status).toBe('offline');

    // Player returns and interacts, restores in-game status
    vi.advanceTimersByTime(2000);
    recordUserActivity();
    expect(mockBackend.getCurrentUser()?.status).toBe('in-game');

    // Revert context back to online
    setActivityContext('online');
    expect(mockBackend.getCurrentUser()?.status).toBe('online');
  });

  it('cleans up pre-existing guest sessions on this device when user signs in', () => {
    // Simulate user previously had a guest session in localStorage
    const guestSessions: Record<string, SessionHeartbeat> = {
      session_guest_old: {
        lastSeen: Date.now(),
        isRegistered: false,
        userId: null,
        isActive: true,
      },
    };
    localStorage.setItem(ACTIVE_SESSIONS_STORAGE_KEY, JSON.stringify(guestSessions));

    // Register/login user
    mockBackend.register('newuser@test.com', 'pass', 'NewUser');
    recordUserActivity();
    syncPresenceHeartbeat();

    // Verify stats: guest session was purged, exactly 1 player and 0 guests
    let emittedStats: LobbyStats | null = null;
    const unsub = subscribeToLobbyStats((stats) => {
      emittedStats = stats;
    });

    const receivedStats = emittedStats as unknown as LobbyStats;
    expect(receivedStats.playersOnline).toBe(1);
    expect(receivedStats.guestsOnline).toBe(0);

    unsub();
  });

  it('respects cached auth UID to prevent misidentifying client as a guest', () => {
    localStorage.setItem(AUTH_CACHED_UID_KEY, 'user_cached_123');
    localStorage.setItem('schada_mock_current_user_id', 'user_cached_123');
    const reg = isCurrentClientRegistered();
    expect(reg.isRegistered).toBe(true);
    expect(reg.userId).toBe('user_cached_123');
  });
});
