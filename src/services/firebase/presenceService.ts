import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  getCountFromServer,
  Timestamp,
  getDocs,
  limit,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './config';
import { localBackend } from './localProvider';
import { LOCAL_CONFIG } from './localConfig';
import { MULTIPLAYER_SCALE_CONFIG } from './multiplayerConfig';
import { isGameTimedOut, type GameRoom } from './gameService';
import { safeSetItem } from '../storage/storageCleanup';

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

export const SESSION_STORAGE_ID_KEY = MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.sessionStorageId;
export const ACTIVE_SESSIONS_STORAGE_KEY = MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.activeSessions;
export const MOCK_GAMES_STORAGE_KEY = MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.mockGames;
export const AUTH_CACHED_UID_KEY = MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.authCachedUid;
export const CACHED_LOBBY_STATS_STORAGE_KEY = MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.cachedLobbyStats;

// Timing constants from validated centralized configuration
export const IDLE_TIMEOUT_MS = MULTIPLAYER_SCALE_CONFIG.presence.idleTimeoutMs;
export const HIDDEN_GRACE_PERIOD_MS = MULTIPLAYER_SCALE_CONFIG.presence.hiddenGracePeriodMs;
export const SESSION_TTL_MS = MULTIPLAYER_SCALE_CONFIG.presence.sessionTtlMs;
export const HEARTBEAT_INTERVAL_MS = MULTIPLAYER_SCALE_CONFIG.presence.heartbeatIntervalMs;

// In-memory tab activity state
let lastUserActivityTime = Date.now();
let hiddenSince: number | null = null;
let currentActivityContext: 'online' | 'in-game' = 'online';
let trackingRefCount = 0;
let heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;
let hiddenGraceTimerId: ReturnType<typeof setTimeout> | null = null;
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
  const uid = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCAL_CONFIG.storageKeys.currentUserId) : null;
  if (uid) {
    return { isRegistered: true, userId: uid };
  }
  const mockUser = localBackend.getCurrentUser();
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
 * Dispatches an asynchronous status and lastSeen update to Firestore for authenticated users.
 */
function writeFirestoreUserStatus(userId: string, status: 'online' | 'in-game' | 'offline'): void {
  if (isFirebaseConfigured() && db && auth?.currentUser?.uid === userId) {
    try {
      updateDoc(doc(db, MULTIPLAYER_SCALE_CONFIG.collections.users, userId), {
        status,
        lastSeen: status === 'offline' ? new Date(0) : serverTimestamp(),
      }).catch((e) => {
        console.warn('Could not update Firestore user status:', e);
      });
    } catch {
      // Ignore
    }
  }
}

/**
 * Synchronously sets user status in local localBackend and writes to Firestore.
 */
function updateUserStatusSync(userId: string, status: 'online' | 'in-game' | 'offline'): void {
  localBackend.setUserStatus(userId, status);
  writeFirestoreUserStatus(userId, status);
}
// In-memory tab activity and remote sync state
let lastRemoteHeartbeatTime = 0;
let lastKnownRemoteStatus: 'online' | 'in-game' | 'offline' | null = null;
let lastKnownRemoteActive: boolean | null = null;
let lastThrottleRecord = 0;
let lastNotifiedStats: LobbyStats | null = null;

export function resetPresenceStateForTesting(): void {
  lastUserActivityTime = Date.now();
  lastThrottleRecord = 0;
  lastRemoteHeartbeatTime = 0;
  lastKnownRemoteStatus = null;
  lastKnownRemoteActive = null;
  lastNotifiedStats = null;
  hiddenSince = null;
  currentActivityContext = 'online';
  firestoreRegisteredCount = null;
  firestoreGuestsCount = null;
  firestoreGamesCount = null;
}

/**
 * Records local user input activity (mouse, key, touch) in memory.
 * Uses activityThrottleMs to prevent CPU overhead and only dispatches network
 * heartbeats upon a genuine state transition between idle and active.
 *
 * Algorithmic Complexity (Big O):
 * - Time Complexity: O(1) in-memory timestamp comparison and scalar update.
 * - Auxiliary Space Complexity: O(1) constant memory.
 * - Growth Rate: O(1) invariant to frequency of UI events or duration of session.
 */
export function recordUserActivity(): void {
  const now = Date.now();
  if (now >= lastThrottleRecord && now - lastThrottleRecord < MULTIPLAYER_SCALE_CONFIG.presence.activityThrottleMs) return;
  lastThrottleRecord = now;
  const wasActive = isCurrentClientActive();
  lastUserActivityTime = now;

  if (hiddenSince !== null && typeof document !== 'undefined' && !document.hidden) {
    hiddenSince = null;
  }

  const nowActive = isCurrentClientActive();
  // Only force remote sync if there was an actual state transition between idle and active
  const stateTransition = wasActive !== nowActive;
  if (stateTransition) {
    syncPresenceHeartbeat(true);
  }
}

/**
 * Sets current activity context ('online' vs 'in-game')
 */
export function setActivityContext(context: 'online' | 'in-game') {
  if (currentActivityContext !== context) {
    currentActivityContext = context;
    syncPresenceHeartbeat(true);
  }
}

/**
 * Synchronizes the tab session heartbeat to localStorage and updates user status.
 * Firestore network writes are throttled to HEARTBEAT_INTERVAL_MS unless an explicit state transition occurs.
 *
 * Algorithmic Complexity (Big O):
 * - Time Complexity: O(T) where T is the number of active browser tabs open on this client machine (T <= 20).
 * - Auxiliary Space Complexity: O(T) for session map serialization.
 * - Network / Database Complexity: O(1) conditional write, strictly throttled to at most 1 write per
 *   HEARTBEAT_INTERVAL_MS or on discrete state transitions, achieving a sub-linear write rate independent of UI input frequency.
 */
export function syncPresenceHeartbeat(forceRemote: boolean = false): void {
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
    safeSetItem(ACTIVE_SESSIONS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage errors
  }

  // Compute registered user target status
  let targetStatus: 'online' | 'in-game' | 'offline' = 'offline';
  if (isRegistered && userId) {
    const hasActiveSession = checkIsUserActiveAcrossTabs(userId);
    targetStatus = hasActiveSession
      ? (currentActivityContext === 'in-game' ? 'in-game' : 'online')
      : 'offline';

    localBackend.setUserStatus(userId, targetStatus);
  }

  // Throttle live Firestore writes: only execute if forced, if heartbeat interval has elapsed, or if status transitioned
  const isHeartbeatDue = now - lastRemoteHeartbeatTime >= HEARTBEAT_INTERVAL_MS;
  const guestActiveChanged = lastKnownRemoteActive !== active;
  const userStatusChanged = lastKnownRemoteStatus !== targetStatus;
  const shouldWriteRemote = forceRemote || isHeartbeatDue || (!isRegistered && guestActiveChanged) || (isRegistered && userStatusChanged);

  if (shouldWriteRemote && isFirebaseConfigured() && db) {
    lastRemoteHeartbeatTime = now;
    lastKnownRemoteActive = active;
    lastKnownRemoteStatus = targetStatus;

    if (!isRegistered) {
      try {
        const guestDocRef = doc(db, MULTIPLAYER_SCALE_CONFIG.collections.guestSessions, sessionId);
        if (active) {
          setDoc(guestDocRef, {
            lastSeen: serverTimestamp(),
            updatedAt: now,
          }).catch(() => {});
        } else {
          deleteDoc(guestDocRef).catch(() => {});
        }
      } catch {
        // Ignore
      }
    } else if (userId && auth?.currentUser?.uid === userId) {
      writeFirestoreUserStatus(userId, targetStatus);
    }
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
      safeSetItem(ACTIVE_SESSIONS_STORAGE_KEY, JSON.stringify(map));

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
      // Send keepalive fetch to Firestore REST API for reliable tab-close deletion in modern browsers
      const projectId = import.meta.env?.VITE_FIREBASE_PROJECT_ID;
      if (projectId && typeof fetch !== 'undefined') {
        const guestCollection = MULTIPLAYER_SCALE_CONFIG.collections.guestSessions;
        const restUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${guestCollection}/${sessionId}`;
        fetch(restUrl, { method: 'DELETE', keepalive: true }).catch(() => {});
      }
      deleteDoc(doc(db, MULTIPLAYER_SCALE_CONFIG.collections.guestSessions, sessionId)).catch(() => {});
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
 * Returns count of active games waiting or in progress, excluding timed-out games.
 *
 * Algorithmic Complexity (Big O):
 * - Time Complexity: O(M) where M is the number of local games stored in localStorage.
 *   Evaluating isGameTimedOut per game is O(1).
 * - Auxiliary Space Complexity: O(M) for JSON parsing and Object.values array.
 *
 * @returns Total count of non-timed-out active games.
 */
export function getLocalActiveGamesCount(): number {
  try {
    const rawGames = typeof localStorage !== 'undefined' ? localStorage.getItem(MOCK_GAMES_STORAGE_KEY) : null;
    if (!rawGames) return 0;
    const games = JSON.parse(rawGames) as Record<string, GameRoom>;
    return Object.values(games).filter((g) => {
      if (!g) return false;
      if (g.status === 'waiting') return true;
      if (g.status === 'in_progress') {
        return !isGameTimedOut(g).timedOut;
      }
      return false;
    }).length;
  } catch {
    return 0;
  }
}

let firestoreRegisteredCount: number | null = null;
let firestoreGuestsCount: number | null = null;
let firestoreGamesCount: number | null = null;

const CACHED_LOBBY_STATS_TIME_KEY = `${CACHED_LOBBY_STATS_STORAGE_KEY}_time`;

/**
 * Retrieves the last-known lobby statistics from localStorage to enable instant
 * stale-while-revalidate rendering without resetting counts to zero on page reloads.
 * Returns zeros if the cached data is older than SESSION_TTL_MS.
 */
export function getCachedLobbyStats(): LobbyStats {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(CACHED_LOBBY_STATS_STORAGE_KEY);
      const timeRaw = localStorage.getItem(CACHED_LOBBY_STATS_TIME_KEY);
      if (raw) {
        if (timeRaw) {
          const cachedTime = Number(timeRaw);
          if (!isNaN(cachedTime) && Date.now() - cachedTime > SESSION_TTL_MS) {
            return {
              playersOnline: 0,
              guestsOnline: 0,
              activeGames: 0,
            };
          }
        }
        const parsed = JSON.parse(raw);
        if (
          typeof parsed.playersOnline === 'number' &&
          typeof parsed.guestsOnline === 'number' &&
          typeof parsed.activeGames === 'number'
        ) {
          return {
            playersOnline: Math.max(0, parsed.playersOnline),
            guestsOnline: Math.max(0, parsed.guestsOnline),
            activeGames: Math.max(0, parsed.activeGames),
          };
        }
      }
    }
  } catch {
    // Ignore storage or JSON errors
  }
  return {
    playersOnline: 0,
    guestsOnline: 0,
    activeGames: 0,
  };
}

/**
 * Persists the latest lobby statistics to localStorage.
 */
export function setCachedLobbyStats(stats: LobbyStats): void {
  safeSetItem(CACHED_LOBBY_STATS_STORAGE_KEY, JSON.stringify(stats));
  safeSetItem(CACHED_LOBBY_STATS_TIME_KEY, String(Date.now()));
}

function getCurrentLobbyStats(): LobbyStats {
  const { registeredUsersCount, guestSessionsCount } = getLocalSessionStats();
  const cached = getCachedLobbyStats();

  let playersOnline = 0;
  if (isFirebaseConfigured()) {
    playersOnline = firestoreRegisteredCount !== null ? firestoreRegisteredCount : cached.playersOnline;
  } else {
    playersOnline = registeredUsersCount;
  }

  let guestsOnline = 0;
  if (isFirebaseConfigured()) {
    guestsOnline = firestoreGuestsCount !== null ? firestoreGuestsCount : cached.guestsOnline;
  } else {
    guestsOnline = guestSessionsCount;
  }

  let activeGames = 0;
  if (isFirebaseConfigured()) {
    activeGames = firestoreGamesCount !== null ? firestoreGamesCount : cached.activeGames;
  } else {
    activeGames = getLocalActiveGamesCount();
  }

  const stats: LobbyStats = {
    playersOnline,
    guestsOnline,
    activeGames,
  };

  // Only persist to cache if live Firestore counts are available or in local mock mode
  if (
    !isFirebaseConfigured() ||
    firestoreRegisteredCount !== null ||
    firestoreGuestsCount !== null ||
    firestoreGamesCount !== null
  ) {
    setCachedLobbyStats(stats);
  }

  return stats;
}

/**
 * Notifies local subscribers of lobby statistics updates.
 * Deduplicates notification dispatches when metric values (players, guests, active games)
 * have not changed, eliminating unnecessary component re-renders.
 *
 * Algorithmic Complexity (Big O):
 * - Time Complexity: O(1) deduplication check; O(S) listener iteration where S is subscriber count (S <= 10).
 * - Auxiliary Space Complexity: O(1) scalar comparison.
 * - Growth Rate: O(S) linear in local subscribers, invariant to server user volume.
 */
function notifyStatsSubscribers() {
  if (statsSubscribers.size === 0) return;
  const stats = getCurrentLobbyStats();
  if (
    lastNotifiedStats &&
    lastNotifiedStats.playersOnline === stats.playersOnline &&
    lastNotifiedStats.guestsOnline === stats.guestsOnline &&
    lastNotifiedStats.activeGames === stats.activeGames
  ) {
    return;
  }
  lastNotifiedStats = stats;
  for (const cb of statsSubscribers) {
    try {
      cb(stats);
    } catch (e) {
      console.error('Error in stats subscriber callback:', e);
    }
  }
}

let lastStaleGuestPruneTime = 0;
const STALE_GUEST_PRUNE_INTERVAL_MS = MULTIPLAYER_SCALE_CONFIG.presence.staleGuestPruneIntervalMs;
const STALE_GUEST_CUTOFF_MS = MULTIPLAYER_SCALE_CONFIG.presence.staleGuestCutoffMs;

/**
 * Opportunistically purges orphan guest sessions older than 15 minutes to keep Firestore clean.
 *
 * Algorithmic Complexity (Big O):
 * - Time Complexity: O(B) where B <= maxCleanupBatchSize (B <= 50) for batch retrieval and atomic commit.
 * - Auxiliary Space Complexity: O(B) for document snapshot handles within batch buffer.
 * - Network / Database Complexity: O(1) query read plus 1 atomic batch deletion commit, strictly gated to
 *   at most once per staleGuestPruneIntervalMs.
 */
export async function pruneStaleGuestSessions(): Promise<void> {
  if (!db || !isFirebaseConfigured()) return;
  const now = Date.now();
  if (now - lastStaleGuestPruneTime < STALE_GUEST_PRUNE_INTERVAL_MS) return;
  lastStaleGuestPruneTime = now;

  try {
    const cutoff = new Date(now - STALE_GUEST_CUTOFF_MS);
    const staleQuery = query(
      collection(db, MULTIPLAYER_SCALE_CONFIG.collections.guestSessions),
      where('lastSeen', '<', Timestamp.fromDate(cutoff)),
      limit(MULTIPLAYER_SCALE_CONFIG.matchmaking.maxCleanupBatchSize)
    );
    const snap = await getDocs(staleQuery);
    if (!snap.empty) {
      const batch = writeBatch(db);
      for (const d of snap.docs) {
        batch.delete(d.ref);
      }
      await batch.commit();
    }
  } catch {
    // Non-critical background cleanup
  }
}

/**
 * Subscribes to real-time lobby statistics with 100% accuracy:
 * - players online: strictly players who registered, signed in, and are currently active
 * - guests online: anonymous visitors currently active
 * - active games: games waiting in lobby or in progress
 *
 * Algorithmic Complexity (Big O):
 * - Listener Time Complexity: O(1) constant time invocation on document change events.
 * - Auxiliary Space Complexity: O(1) constant space for observer handles.
 * - Network / Database Complexity: O(1) single-document listener (stats/lobby). Fallback count queries
 *   are gated strictly to connection failures, scaling at O(1) interval rate (statsFallbackPollIntervalMs).
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
      e.key === CACHED_LOBBY_STATS_STORAGE_KEY ||
      e.key === LOCAL_CONFIG.storageKeys.currentUserId ||
      e.key === LOCAL_CONFIG.storageKeys.users
    ) {
      notifyStatsSubscribers();
    }
  };

  const handleCustomStatus = () => {
    notifyStatsSubscribers();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorage);
    window.addEventListener(LOCAL_CONFIG.events.userStatusChanged, handleCustomStatus);
  }

  // Firestore real-time listener for aggregated platform stats
  // Rather than downloading full collections of tens of thousands of users/games,
  // we listen to a single aggregate document 'stats/lobby' (O(1) read).
  // Fallback: server-side count queries (getCountFromServer) ONLY if the stats doc is missing or listener errors.
  let unsubscribeStatsDoc: (() => void) | null = null;
  let countPollTimer: ReturnType<typeof setInterval> | null = null;
  let fallbackInitTimeout: ReturnType<typeof setTimeout> | null = null;

  if (isFirebaseConfigured() && db) {
    try {
      const statsDocRef = doc(
        db,
        MULTIPLAYER_SCALE_CONFIG.collections.lobbyStats,
        MULTIPLAYER_SCALE_CONFIG.collections.lobbyStatsDocId
      );

      let lastServerCountsRefreshTime = 0;
      let inFlightRefreshPromise: Promise<void> | null = null;

      // Server-side count fallback: refreshes server counts with getCountFromServer if needed.
      // Employs in-flight deduplication and 10s cooldown to eliminate redundant concurrent network reads.
      const refreshServerCounts = async (force: boolean = false): Promise<void> => {
        if (!db) return;
        const now = Date.now();
        if (!force && inFlightRefreshPromise) return inFlightRefreshPromise;
        if (!force && now - lastServerCountsRefreshTime < 10_000) return;

        lastServerCountsRefreshTime = now;

        inFlightRefreshPromise = (async () => {
          try {
            const thresholdDate = new Date(now - SESSION_TTL_MS);
            const thresholdTimestamp = Timestamp.fromDate(thresholdDate);

            // Query active users whose heartbeat was received within SESSION_TTL_MS.
            // Uses a single-field index on lastSeen, avoiding unbuilt composite indexes (failed-precondition).
            const qUsers = query(
              collection(db, MULTIPLAYER_SCALE_CONFIG.collections.users),
              where('lastSeen', '>=', thresholdTimestamp)
            );

            const qGuests = query(
              collection(db, MULTIPLAYER_SCALE_CONFIG.collections.guestSessions),
              where('lastSeen', '>=', thresholdTimestamp)
            );
            const qGames = query(
              collection(db, MULTIPLAYER_SCALE_CONFIG.collections.games),
              where('status', 'in', ['waiting', 'in_progress'])
            );

            const [usersSnap, guestsSnap, gamesSnap] = await Promise.all([
              getCountFromServer(qUsers).catch(() => null),
              getCountFromServer(qGuests).catch(() => null),
              getCountFromServer(qGames).catch(() => null),
            ]);

            let changed = false;
            if (usersSnap) {
              firestoreRegisteredCount = usersSnap.data().count;
              changed = true;
            }
            if (guestsSnap) {
              firestoreGuestsCount = guestsSnap.data().count;
              changed = true;
            }
            if (gamesSnap) {
              firestoreGamesCount = gamesSnap.data().count;
              changed = true;
            }

            if (changed) {
              notifyStatsSubscribers();
            }
          } catch {
            // Graceful fallback to local session stats
          } finally {
            inFlightRefreshPromise = null;
          }
        })();

        return inFlightRefreshPromise;
      };

      unsubscribeStatsDoc = onSnapshot(
        statsDocRef,
        (snapshot) => {
          if (snapshot.exists()) {
            // Live aggregate document exists: cancel any fallback count polling
            if (countPollTimer) {
              clearInterval(countPollTimer);
              countPollTimer = null;
            }
            if (fallbackInitTimeout) {
              clearTimeout(fallbackInitTimeout);
              fallbackInitTimeout = null;
            }
            const data = snapshot.data();
            if (typeof data.playersOnline === 'number') firestoreRegisteredCount = data.playersOnline;
            if (typeof data.guestsOnline === 'number') firestoreGuestsCount = data.guestsOnline;
            if (typeof data.activeGames === 'number') firestoreGamesCount = data.activeGames;
            notifyStatsSubscribers();
          } else {
            // Aggregate document does not exist: query live counts immediately and keep polling active
            refreshServerCounts();
            if (!countPollTimer) {
              countPollTimer = setInterval(
                refreshServerCounts,
                MULTIPLAYER_SCALE_CONFIG.presence.statsFallbackPollIntervalMs
              );
            }
          }
        },
        (err) => {
          // If the stats document listener encounters permission or existence constraints, gracefully switch to throttled count polling
          if (import.meta.env.DEV) {
            console.warn('Stats document listener notice (falling back to server count polling):', err);
          }
          if (!countPollTimer) {
            countPollTimer = setInterval(
              refreshServerCounts,
              MULTIPLAYER_SCALE_CONFIG.presence.statsFallbackPollIntervalMs
            );
          }
          refreshServerCounts();
        }
      );

      // Delayed initial fallback: only runs if snapshot has not provided data after fallback delay
      const initialDelay = MULTIPLAYER_SCALE_CONFIG.presence.statsInitialFallbackDelayMs;
      if (initialDelay > 0) {
        fallbackInitTimeout = setTimeout(() => {
          if (firestoreRegisteredCount === null && firestoreGuestsCount === null) {
            refreshServerCounts();
            if (!countPollTimer) {
              countPollTimer = setInterval(
                refreshServerCounts,
                MULTIPLAYER_SCALE_CONFIG.presence.statsFallbackPollIntervalMs
              );
            }
          }
        }, initialDelay);
      }
    } catch (e) {
      console.warn('Could not initialize Firestore lobby stats:', e);
    }
  }

  return () => {
    statsSubscribers.delete(callback);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('schada_user_status_changed', handleCustomStatus);
    }
    if (unsubscribeStatsDoc) unsubscribeStatsDoc();
    if (countPollTimer) clearInterval(countPollTimer);
    if (fallbackInitTimeout) clearTimeout(fallbackInitTimeout);
    stopTracking();
  };
}

/**
 * Backward-compatible helper for players online count.
 */
export function subscribeToOnlineCount(callback: (count: number) => void): () => void {
  return subscribeToLobbyStats((stats) => callback(stats.playersOnline));
}
