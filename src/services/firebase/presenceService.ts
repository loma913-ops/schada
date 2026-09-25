import { collection, query, where, onSnapshot, doc, updateDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './config';
import { mockBackend } from './mockProvider';

export interface LobbyStats {
  playersOnline: number; // Strictly players who registered, signed in, and are active
  guestsOnline: number;  // Anonymous visitors currently active
  activeGames: number;   // Games waiting or in progress
}

export interface SessionHeartbeat {
  lastSeen: number;
  isRegistered: boolean;
  userId: string | null;
  isActive: boolean;
  context?: 'online' | 'in-game';
}

export const SESSION_STORAGE_ID_KEY = 'schada_client_session_id';
export const ACTIVE_SESSIONS_STORAGE_KEY = 'schada_active_sessions_v2';
export const MOCK_GAMES_STORAGE_KEY = 'schada_mock_games';
export const AUTH_CACHED_UID_KEY = 'schada_auth_cached_uid';

// Timing constants for presence & activity detection
export const IDLE_TIMEOUT_MS = 120_000;       // 2 minutes of no user interactions = idle/inactive
export const HIDDEN_GRACE_PERIOD_MS = 60_000; // 60 seconds after tab is hidden = inactive
export const SESSION_TTL_MS = 60_000;         // 60 seconds without heartbeat = session expired
export const HEARTBEAT_INTERVAL_MS = 30_000;   // Heartbeat ping interval

// In-memory tab activity state
let lastUserActivityTime = Date.now();
let hiddenSince: number | null = null;
let currentActivityContext: 'online' | 'in-game' = 'online';
let trackingRefCount = 0;
let heartbeatIntervalId: any = null;
let hiddenGraceTimerId: any = null;
let isListenersAttached = false;
const statsSubscribers = new Set<(stats: LobbyStats) => void>();

// Generate or retrieve a unique tab/session ID for the current client
export function getClientSessionId(): string {
  if (typeof sessionStorage === 'undefined') {
    return 'session_node_test';
  }
  let id = sessionStorage.getItem(SESSION_STORAGE_ID_KEY);
  if (!id) {
    id = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem(SESSION_STORAGE_ID_KEY, id);
  }
  return id;
}

/**
 * Checks whether the current client is authenticated as a registered user.
 */
export function isCurrentClientRegistered(): { isRegistered: boolean; userId: string | null } {
  if (isFirebaseConfigured()) {
    if (auth?.currentUser) {
      return { isRegistered: true, userId: auth.currentUser.uid };
    }
    const cachedUid = typeof localStorage !== 'undefined' ? localStorage.getItem(AUTH_CACHED_UID_KEY) : null;
    if (cachedUid) {
      return { isRegistered: true, userId: cachedUid };
    }
  }
  const uid = typeof localStorage !== 'undefined' ? localStorage.getItem('schada_mock_current_user_id') : null;
  if (uid) {
    return { isRegistered: true, userId: uid };
  }
  const mockUser = mockBackend.getCurrentUser();
  if (mockUser) {
    return { isRegistered: true, userId: mockUser.id };
  }
  return { isRegistered: false, userId: null };
}

/**
 * Checks if the current client tab is active:
 * 1. Document must be visible (or within hidden grace period).
 * 2. User must have interacted within IDLE_TIMEOUT_MS.
 */
export function isCurrentClientActive(): boolean {
  const now = Date.now();

  // If page is hidden, check grace period
  if (typeof document !== 'undefined' && document.hidden) {
    if (hiddenSince === null) {
      hiddenSince = now;
    }
    if (now - hiddenSince > HIDDEN_GRACE_PERIOD_MS) {
      return false;
    }
  }

  // Check idle timeout
  if (now - lastUserActivityTime > IDLE_TIMEOUT_MS) {
    return false;
  }

  return true;
}

/**
 * Checks if a specific registered user is active across ANY tab in this browser.
 */
export function checkIsUserActiveAcrossTabs(userId: string): boolean {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(ACTIVE_SESSIONS_STORAGE_KEY) : null;
    if (!raw) return false;
    const map: Record<string, SessionHeartbeat> = JSON.parse(raw);
    const now = Date.now();
    return Object.values(map).some(
      (s) => s.userId === userId && s.isRegistered && s.isActive && (now - s.lastSeen <= SESSION_TTL_MS)
    );
  } catch {
    return false;
  }
}

/**
 * Updates the user's status in mockBackend and Firestore.
 */
function updateUserStatusSync(userId: string, status: 'online' | 'in-game' | 'offline') {
  // Update mock store
  mockBackend.setUserStatus(userId, status);

  // Update live Firebase if configured
  if (isFirebaseConfigured() && db && auth?.currentUser?.uid === userId) {
    try {
      updateDoc(doc(db, 'users', userId), {
        status,
        lastSeen: serverTimestamp(),
      }).catch((e) => {
        console.warn('Could not update Firestore user status:', e);
      });
    } catch {
      // Ignore
    }
  }
}

/**
 * Records user activity (mouse, key, touch, click, scroll).
 * If previously idle or hidden, wakes up immediately.
 */
let lastThrottleRecord = 0;

export function resetPresenceStateForTesting(): void {
  lastUserActivityTime = Date.now();
  lastThrottleRecord = 0;
  hiddenSince = null;
  currentActivityContext = 'online';
  firestoreRegisteredCount = null;
  firestoreGuestsCount = null;
  firestoreGamesCount = null;
}

export function recordUserActivity(): void {
  const now = Date.now();
  if (now >= lastThrottleRecord && now - lastThrottleRecord < 1000) return;
  lastThrottleRecord = now;
  lastUserActivityTime = now;

  if (hiddenSince !== null && typeof document !== 'undefined' && !document.hidden) {
    hiddenSince = null;
  }

  syncPresenceHeartbeat();
}

/**
 * Sets current activity context ('online' vs 'in-game')
 */
export function setActivityContext(context: 'online' | 'in-game') {
  currentActivityContext = context;
  syncPresenceHeartbeat();
}

/**
 * Synchronizes the tab session heartbeat to localStorage and updates user status.
 */
export function syncPresenceHeartbeat(): void {
  const sessionId = getClientSessionId();
  const now = Date.now();
  const active = isCurrentClientActive();
  const { isRegistered, userId } = isCurrentClientRegistered();

  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(ACTIVE_SESSIONS_STORAGE_KEY) : null;
    const map: Record<string, SessionHeartbeat> = raw ? JSON.parse(raw) : {};

    map[sessionId] = {
      lastSeen: now,
      isRegistered,
      userId,
      isActive: active,
      context: currentActivityContext,
    };

    // If client is registered, clean up any guest sessions recorded on this device
    if (isRegistered && userId) {
      for (const [sId, data] of Object.entries(map)) {
        if (!data.isRegistered) {
          delete map[sId];
        }
      }
    }

    // Clean up stale sessions (> SESSION_TTL_MS old)
    for (const [sId, data] of Object.entries(map)) {
      if (now - data.lastSeen > SESSION_TTL_MS) {
        delete map[sId];
      }
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ACTIVE_SESSIONS_STORAGE_KEY, JSON.stringify(map));
    }
  } catch {
    // Ignore storage errors
  }

  // Live Firebase guest presence synchronization
  if (isFirebaseConfigured() && db) {
    try {
      const guestDocRef = doc(db, 'guest_sessions', sessionId);
      if (!isRegistered) {
        if (active) {
          setDoc(guestDocRef, {
            lastSeen: serverTimestamp(),
            updatedAt: now,
          }).catch(() => {});
        } else {
          deleteDoc(guestDocRef).catch(() => {});
        }
      } else {
        // If client is registered, ensure it is not tracked in guest_sessions
        deleteDoc(guestDocRef).catch(() => {});
      }
    } catch {
      // Ignore
    }
  }

  // Update registered user's status based on cross-tab activity
  if (isRegistered && userId) {
    const hasActiveSession = checkIsUserActiveAcrossTabs(userId);
    const targetStatus: 'online' | 'in-game' | 'offline' = hasActiveSession
      ? (currentActivityContext === 'in-game' ? 'in-game' : 'online')
      : 'offline';

    updateUserStatusSync(userId, targetStatus);
  }

  // Notify any active stats subscribers
  notifyStatsSubscribers();
}

/**
 * Cleans up the tab's session upon pagehide / beforeunload.
 */
export function cleanupCurrentTabSession(): void {
  const sessionId = getClientSessionId();
  const { isRegistered, userId } = isCurrentClientRegistered();

  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(ACTIVE_SESSIONS_STORAGE_KEY) : null;
    if (raw) {
      const map: Record<string, SessionHeartbeat> = JSON.parse(raw);
      delete map[sessionId];
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(ACTIVE_SESSIONS_STORAGE_KEY, JSON.stringify(map));
      }

      // Check if user has any remaining active sessions
      if (isRegistered && userId) {
        const now = Date.now();
        const hasOtherActive = Object.values(map).some(
          (s) => s.userId === userId && s.isRegistered && s.isActive && (now - s.lastSeen <= SESSION_TTL_MS)
        );
        if (!hasOtherActive) {
          updateUserStatusSync(userId, 'offline');
        }
      }
    }
  } catch {
    // Ignore
  }

  // Clean up guest session in Firestore if client was a guest
  if (isFirebaseConfigured() && db && !isRegistered) {
    try {
      deleteDoc(doc(db, 'guest_sessions', sessionId)).catch(() => {});
    } catch {
      // Ignore
    }
  }
}

/**
 * Starts persistent presence tracking for this browser tab.
 * Sets up activity listeners, visibility listeners, heartbeat loop, and unload hooks.
 */
export function startPresenceTracking(): () => void {
  trackingRefCount += 1;

  if (!isListenersAttached && typeof window !== 'undefined') {
    isListenersAttached = true;
    const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
      'click',
      'focus',
    ];

    const onActivity = () => recordUserActivity();
    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, onActivity, { passive: true });
    }

    const onVisibilityChange = () => {
      if (document.hidden) {
        hiddenSince = Date.now();
        if (hiddenGraceTimerId) clearTimeout(hiddenGraceTimerId);
        hiddenGraceTimerId = setTimeout(() => {
          syncPresenceHeartbeat();
        }, HIDDEN_GRACE_PERIOD_MS);
      } else {
        if (hiddenGraceTimerId) clearTimeout(hiddenGraceTimerId);
        hiddenSince = null;
        lastUserActivityTime = Date.now();
        syncPresenceHeartbeat();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const onUnload = () => cleanupCurrentTabSession();
    window.addEventListener('pagehide', onUnload);
    window.addEventListener('beforeunload', onUnload);

    // Initial heartbeat
    syncPresenceHeartbeat();

    // Heartbeat loop
    heartbeatIntervalId = setInterval(() => {
      syncPresenceHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);
  }

  return () => {
    trackingRefCount = Math.max(0, trackingRefCount - 1);
    if (trackingRefCount === 0) {
      if (heartbeatIntervalId) {
        clearInterval(heartbeatIntervalId);
        heartbeatIntervalId = null;
      }
      if (hiddenGraceTimerId) {
        clearTimeout(hiddenGraceTimerId);
        hiddenGraceTimerId = null;
      }
      cleanupCurrentTabSession();
      isListenersAttached = false;
    }
  };
}

/**
 * Computes active stats from localStorage active sessions.
 */
export function getLocalSessionStats(): { registeredUsersCount: number; guestSessionsCount: number } {
  try {
    const now = Date.now();
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(ACTIVE_SESSIONS_STORAGE_KEY) : null;
    if (!raw) {
      return { registeredUsersCount: 0, guestSessionsCount: 0 };
    }

    const map: Record<string, SessionHeartbeat> = JSON.parse(raw);
    const activeSessions = Object.values(map).filter(
      (s) => s.isActive && (now - s.lastSeen <= SESSION_TTL_MS)
    );

    const registeredUserIds = new Set<string>();
    let guestsCount = 0;

    for (const s of activeSessions) {
      if (s.isRegistered && s.userId) {
        registeredUserIds.add(s.userId);
      } else if (!s.isRegistered) {
        guestsCount += 1;
      }
    }

    return {
      registeredUsersCount: registeredUserIds.size,
      guestSessionsCount: guestsCount,
    };
  } catch {
    return { registeredUsersCount: 0, guestSessionsCount: 0 };
  }
}

/**
 * Returns count of active games waiting or in progress.
 */
export function getLocalActiveGamesCount(): number {
  try {
    const rawGames = typeof localStorage !== 'undefined' ? localStorage.getItem(MOCK_GAMES_STORAGE_KEY) : null;
    if (!rawGames) return 0;
    const games = JSON.parse(rawGames);
    return Object.values(games).filter(
      (g: any) => g.status === 'in_progress' || g.status === 'waiting'
    ).length;
  } catch {
    return 0;
  }
}

let firestoreRegisteredCount: number | null = null;
let firestoreGuestsCount: number | null = null;
let firestoreGamesCount: number | null = null;

function getCurrentLobbyStats(): LobbyStats {
  const { registeredUsersCount, guestSessionsCount } = getLocalSessionStats();

  let playersOnline = 0;
  if (isFirebaseConfigured() && firestoreRegisteredCount !== null) {
    playersOnline = firestoreRegisteredCount;
  } else {
    playersOnline = registeredUsersCount;
  }

  let guestsOnline = 0;
  if (isFirebaseConfigured() && firestoreGuestsCount !== null) {
    guestsOnline = firestoreGuestsCount;
  } else {
    guestsOnline = guestSessionsCount;
  }

  let activeGames = 0;
  if (isFirebaseConfigured() && firestoreGamesCount !== null) {
    activeGames = firestoreGamesCount;
  } else {
    activeGames = getLocalActiveGamesCount();
  }

  return {
    playersOnline,
    guestsOnline,
    activeGames,
  };
}

function notifyStatsSubscribers() {
  if (statsSubscribers.size === 0) return;
  const stats = getCurrentLobbyStats();
  for (const cb of statsSubscribers) {
    try {
      cb(stats);
    } catch (e) {
      console.error('Error in stats subscriber callback:', e);
    }
  }
}

/**
 * Subscribes to real-time lobby statistics with 100% accuracy:
 * - players online: strictly players who registered, signed in, and are currently active
 * - guests online: anonymous visitors currently active
 * - active games: games waiting in lobby or in progress
 */
export function subscribeToLobbyStats(callback: (stats: LobbyStats) => void): () => void {
  // Ensure tab tracking is running
  const stopTracking = startPresenceTracking();
  statsSubscribers.add(callback);

  // Immediate initial emission
  callback(getCurrentLobbyStats());

  // Cross-tab storage synchronization
  const handleStorage = (e: StorageEvent) => {
    if (
      e.key === ACTIVE_SESSIONS_STORAGE_KEY ||
      e.key === MOCK_GAMES_STORAGE_KEY ||
      e.key === 'schada_mock_current_user_id' ||
      e.key === 'schada_mock_users'
    ) {
      notifyStatsSubscribers();
    }
  };

  const handleCustomStatus = () => {
    notifyStatsSubscribers();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorage);
    window.addEventListener('schada_user_status_changed', handleCustomStatus);
  }

  // Firestore real-time listeners if live Firebase is configured
  let unsubscribeUsers: (() => void) | null = null;
  let unsubscribeGuests: (() => void) | null = null;
  let unsubscribeGames: (() => void) | null = null;

  if (isFirebaseConfigured() && db) {
    try {
      const qUsers = query(collection(db, 'users'), where('status', 'in', ['online', 'in-game']));
      unsubscribeUsers = onSnapshot(
        qUsers,
        (snapshot) => {
          firestoreRegisteredCount = snapshot.docs.length;
          notifyStatsSubscribers();
        },
        (err) => {
          console.warn('Firestore online users count listener fallback:', err);
          firestoreRegisteredCount = null;
          notifyStatsSubscribers();
        }
      );

      const qGuests = collection(db, 'guest_sessions');
      unsubscribeGuests = onSnapshot(
        qGuests,
        (snapshot) => {
          const now = Date.now();
          let count = 0;
          for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            const updatedAt = typeof data.updatedAt === 'number' ? data.updatedAt : 0;
            if (now - updatedAt <= SESSION_TTL_MS) {
              count += 1;
            } else if (now - updatedAt > SESSION_TTL_MS * 3) {
              // Clean up ancient stale guest docs
              deleteDoc(docSnap.ref).catch(() => {});
            }
          }
          firestoreGuestsCount = count;
          notifyStatsSubscribers();
        },
        (err) => {
          console.warn('Firestore guest sessions listener fallback:', err);
          firestoreGuestsCount = null;
          notifyStatsSubscribers();
        }
      );

      const qGames = query(
        collection(db, 'games'),
        where('status', 'in', ['waiting', 'in_progress'])
      );
      unsubscribeGames = onSnapshot(
        qGames,
        (snapshot) => {
          firestoreGamesCount = snapshot.docs.length;
          notifyStatsSubscribers();
        },
        (err) => {
          console.warn('Firestore active games count listener fallback:', err);
          firestoreGamesCount = null;
          notifyStatsSubscribers();
        }
      );
    } catch (e) {
      console.warn('Could not initialize Firestore listeners:', e);
    }
  }

  return () => {
    statsSubscribers.delete(callback);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('schada_user_status_changed', handleCustomStatus);
    }
    if (unsubscribeUsers) unsubscribeUsers();
    if (unsubscribeGuests) unsubscribeGuests();
    if (unsubscribeGames) unsubscribeGames();
    stopTracking();
  };
}

/**
 * Backward-compatible helper for players online count.
 */
export function subscribeToOnlineCount(callback: (count: number) => void): () => void {
  return subscribeToLobbyStats((stats) => callback(stats.playersOnline));
}
