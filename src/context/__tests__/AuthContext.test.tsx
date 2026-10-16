import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.hoisted(() => {
  class StorageMock {
    private store: Record<string, string> = {};

    get length() {
      return Object.keys(this.store).length;
    }

    key(index: number): string | null {
      return Object.keys(this.store)[index] || null;
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
  if (typeof globalThis.sessionStorage === 'undefined') {
    (globalThis as any).sessionStorage = new StorageMock();
  }

  if (typeof (globalThis as any).window === 'undefined') {
    const target = new EventTarget();
    (globalThis as any).window = {
      addEventListener: target.addEventListener.bind(target),
      removeEventListener: target.removeEventListener.bind(target),
      dispatchEvent: target.dispatchEvent.bind(target),
    };
  }
});

vi.mock('@/services/firebase/config', () => ({
  isFirebaseConfigured: () => false,
  db: null,
  auth: null,
  app: null,
}));

import { AuthProvider, useAuth } from '../AuthContext';
import { LOCAL_CONFIG } from '@/services/firebase/localConfig';
import { localBackend } from '@/services/firebase/localProvider';
import {
  setActivityContext,
  getCurrentActivityContext,
  recordUserActivity,
  syncPresenceHeartbeat,
  resetPresenceStateForTesting,
} from '@/services/firebase/presenceService';
import { MULTIPLAYER_SCALE_CONFIG } from '@/services/firebase/multiplayerConfig';
import { registerUser } from '@/services/firebase/authService';

function StatusConsumer() {
  const { user } = useAuth();
  return (
    <div id="test-consumer">
      <span id="user-username">{user?.username || 'none'}</span>
      <span id="user-status">{user?.status || 'none'}</span>
    </div>
  );
}

describe('AuthContext - Presence and Status Synchronization', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.useFakeTimers();
    resetPresenceStateForTesting();
    localBackend.logout();
    setActivityContext('online');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders child components with authenticated user initial state', async () => {
    await registerUser('player@test.com', 'pass123', 'StatusTester');
    recordUserActivity();
    syncPresenceHeartbeat();

    const html = renderToStaticMarkup(
      <AuthProvider>
        <StatusConsumer />
      </AuthProvider>
    );

    expect(html).toContain('StatusTester');
    expect(html).toContain('online');
  });

  it('synchronizes presence status when setActivityContext is toggled and forced', async () => {
    await registerUser('player2@test.com', 'pass123', 'PresenceTester');
    recordUserActivity();
    syncPresenceHeartbeat();
    expect(localBackend.getCurrentUser()?.status).toBe('online');

    // Simulate joining an active game
    setActivityContext('in-game');
    expect(getCurrentActivityContext()).toBe('in-game');
    expect(localBackend.getCurrentUser()?.status).toBe('in-game');

    // Verify authCachedProfile is synchronized with in-game status
    const rawInGame = localStorage.getItem(MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.authCachedProfile);
    expect(rawInGame).not.toBeNull();
    const parsedInGame = JSON.parse(rawInGame!);
    expect(parsedInGame.status).toBe('in-game');

    // Simulate leaving game and returning to lobby with forced sync
    setActivityContext('online', true);
    expect(getCurrentActivityContext()).toBe('online');
    expect(localBackend.getCurrentUser()?.status).toBe('online');

    // Verify authCachedProfile is synchronized with online status
    const rawOnline = localStorage.getItem(MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.authCachedProfile);
    expect(rawOnline).not.toBeNull();
    const parsedOnline = JSON.parse(rawOnline!);
    expect(parsedOnline.status).toBe('online');
  });

  it('dispatches LOCAL_CONFIG.events.userStatusChanged with updated status', async () => {
    const registered = await registerUser('player3@test.com', 'pass123', 'EventTester');
    recordUserActivity();
    syncPresenceHeartbeat();

    let dispatchedEvent: CustomEvent<{ userId: string; status: string }> | null = null;
    const listener = (e: Event) => {
      dispatchedEvent = e as CustomEvent<{ userId: string; status: string }>;
    };

    window.addEventListener(LOCAL_CONFIG.events.userStatusChanged, listener);

    try {
      setActivityContext('in-game');
      expect(dispatchedEvent).not.toBeNull();
      expect(dispatchedEvent!.detail.status).toBe('in-game');
      expect(dispatchedEvent!.detail.userId).toBe(registered.id);

      dispatchedEvent = null;
      setActivityContext('online', true);
      expect(dispatchedEvent).not.toBeNull();
      expect(dispatchedEvent!.detail.status).toBe('online');
      expect(dispatchedEvent!.detail.userId).toBe(registered.id);
    } finally {
      window.removeEventListener(LOCAL_CONFIG.events.userStatusChanged, listener);
    }
  });
});
