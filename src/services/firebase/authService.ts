import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './config';
import { localBackend, type UserProfile } from './localProvider';
import {
  isCurrentClientActive,
  syncPresenceHeartbeat,
  cleanupCurrentTabSession,
} from './presenceService';
import { MULTIPLAYER_SCALE_CONFIG } from './multiplayerConfig';
import { LOCAL_CONFIG } from './localConfig';
import { ELO_CONFIG } from '@/core/elo/eloConfig';
import { safeSetItem } from '../storage/storageCleanup';

export function validateUsernameFormat(username: string): { valid: boolean; error?: string } {
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 20) {
    return { valid: false, error: 'Username must be between 3 and 20 characters.' };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    return { valid: false, error: 'Username can only contain letters, numbers, and underscores.' };
  }
  return { valid: true };
}

export async function setUserOnlineStatus(
  status: 'online' | 'in-game' | 'offline'
): Promise<void> {
  if (isFirebaseConfigured() && auth?.currentUser && db) {
    try {
      await updateDoc(doc(db, MULTIPLAYER_SCALE_CONFIG.collections.users, auth.currentUser.uid), {
        status,
        lastSeen: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Could not update Firestore user status:', e);
    }
  }

  // Also update cached profile status if stored
  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.authCachedProfile);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          parsed.status = status;
          safeSetItem(
            MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.authCachedProfile,
            JSON.stringify(parsed)
          );
        }
      } catch {
        // ignore
      }
    }
  }

  const currentUid = typeof localStorage !== 'undefined'
    ? localStorage.getItem('schada_mock_current_user_id')
    : null;
  if (currentUid) {
    localBackend.setUserStatus(currentUid, status);
  }
}

/**
 * Updates a user's Elo rating and match statistics across Firestore (if authenticated owner)
 * and the local provider. Clamps ratings using the central ELO_CONFIG.minimumRating.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) Firestore document transaction / localStorage key-value update.
 * - Auxiliary Space Complexity: O(1) scalar allocations.
 *
 * Growth Rate:
 * - O(1) constant: independent of total database size or user base growth rate.
 */
export async function updateUserStats(
  userId: string,
  won: boolean,
  isDraw: boolean,
  eloDelta: number
): Promise<UserProfile | null> {
  // 1. Update local provider store
  localBackend.updateStats(userId, won, isDraw, eloDelta);

  // 2. If Firebase is active and the authenticated user owns this profile record
  if (isFirebaseConfigured() && db && auth?.currentUser?.uid === userId) {
    try {
      const userDocRef = doc(db, MULTIPLAYER_SCALE_CONFIG.collections.users, userId);
      const updatedProfile = await runTransaction(db, async (tx) => {
        const snap = await tx.get(userDocRef);
        if (!snap.exists()) return null;

        const data = snap.data() as UserProfile;
        const currentGamesPlayed = data.gamesPlayed || 0;
        const currentGamesWon = data.gamesWon || 0;
        const currentGamesLost = data.gamesLost || 0;
        const currentGamesDrawn = data.gamesDrawn || 0;
        const currentElo = typeof data.eloRating === 'number'
          ? data.eloRating
          : ELO_CONFIG.defaultStartingRating;

        const newElo = Math.max(ELO_CONFIG.minimumRating, currentElo + eloDelta);
        const newGamesPlayed = currentGamesPlayed + 1;
        const newGamesWon = isDraw ? currentGamesWon : won ? currentGamesWon + 1 : currentGamesWon;
        const newGamesLost = isDraw ? currentGamesLost : !won ? currentGamesLost + 1 : currentGamesLost;
        const newGamesDrawn = isDraw ? currentGamesDrawn + 1 : currentGamesDrawn;

        tx.update(userDocRef, {
          eloRating: newElo,
          gamesPlayed: newGamesPlayed,
          gamesWon: newGamesWon,
          gamesLost: newGamesLost,
          gamesDrawn: newGamesDrawn,
          updatedAt: serverTimestamp(),
        });

        return {
          ...data,
          eloRating: newElo,
          gamesPlayed: newGamesPlayed,
          gamesWon: newGamesWon,
          gamesLost: newGamesLost,
          gamesDrawn: newGamesDrawn,
        } as UserProfile;
      });

      if (updatedProfile) {
        persistCachedProfile(updatedProfile);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent(LOCAL_CONFIG.events.profileUpdated, { detail: updatedProfile })
          );
        }
        return updatedProfile;
      }
    } catch (e) {
      console.warn('Could not update Firestore user stats:', e);
    }
  }

  const cached = localBackend.getUserById(userId);
  if (cached && typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.authCachedProfile);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.id === userId) {
          persistCachedProfile(cached);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent(LOCAL_CONFIG.events.profileUpdated, { detail: cached })
            );
          }
        }
      } catch {
        // ignore
      }
    }
  }
  return cached;
}

/**
 * Reloads the current user profile from Firestore or local provider, updates cache, and dispatches change events.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) single document fetch / localStorage lookup.
 * - Auxiliary Space Complexity: O(1) profile object allocation.
 *
 * Growth Rate:
 * - O(1) constant: invariant to system scale and user count.
 */
export async function reloadUserProfile(): Promise<UserProfile | null> {
  if (isFirebaseConfigured() && auth?.currentUser && db) {
    try {
      const snap = await getDoc(doc(db, MULTIPLAYER_SCALE_CONFIG.collections.users, auth.currentUser.uid));
      if (snap.exists()) {
        const active = isCurrentClientActive();
        const status = active ? 'online' : 'offline';
        const profile: UserProfile = { ...(snap.data() as UserProfile), status };
        persistCachedProfile(profile);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent(LOCAL_CONFIG.events.profileUpdated, { detail: profile })
          );
        }
        return profile;
      }
    } catch (e) {
      console.warn('Could not reload Firestore user profile:', e);
    }
  }

  const mockUser = localBackend.getCurrentUser();
  if (mockUser) {
    persistCachedProfile(mockUser);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(LOCAL_CONFIG.events.profileUpdated, { detail: mockUser })
      );
    }
    return mockUser;
  }
  return null;
}

function persistCachedProfile(profile: UserProfile | null): void {
  const { authCachedUid, authCachedProfile } = MULTIPLAYER_SCALE_CONFIG.presence.storageKeys;
  if (profile) {
    safeSetItem(authCachedUid, profile.id);
    safeSetItem(authCachedProfile, JSON.stringify(profile));
  } else {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(authCachedUid);
      localStorage.removeItem(authCachedProfile);
    }
  }
}

export function getCachedAuthProfile(): UserProfile | null {
  if (!isFirebaseConfigured() || !auth || !db) {
    return localBackend.getCurrentUser();
  }
  if (typeof localStorage === 'undefined') return null;
  const { authCachedProfile } = MULTIPLAYER_SCALE_CONFIG.presence.storageKeys;
  const raw = localStorage.getItem(authCachedProfile);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as UserProfile;
    if (parsed && typeof parsed.id === 'string' && typeof parsed.username === 'string') {
      return parsed;
    }
  } catch (e) {
    console.warn('Failed to parse cached auth profile:', e);
  }
  return null;
}

export function getInitialAuthState(): { initialUser: UserProfile | null; initialLoading: boolean } {
  if (!isFirebaseConfigured() || !auth || !db) {
    return {
      initialUser: localBackend.getCurrentUser(),
      initialLoading: false,
    };
  }

  const cachedProfile = getCachedAuthProfile();
  if (cachedProfile) {
    return {
      initialUser: cachedProfile,
      initialLoading: false,
    };
  }

  const { authCachedUid } = MULTIPLAYER_SCALE_CONFIG.presence.storageKeys;
  const hasCachedUid = typeof localStorage !== 'undefined' && Boolean(localStorage.getItem(authCachedUid));

  return {
    initialUser: null,
    initialLoading: hasCachedUid,
  };
}

export async function registerUser(
  email: string,
  pass: string,
  username: string
): Promise<UserProfile> {
  const validation = validateUsernameFormat(username);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const usernameLower = username.toLowerCase().trim();

  // If live Firebase is configured
  if (isFirebaseConfigured() && auth && db) {
    const firestore = db;
    // 1. Check uniqueness via transaction on `usernames/{usernameLower}`
    const usernameDocRef = doc(firestore, MULTIPLAYER_SCALE_CONFIG.collections.usernames, usernameLower);
    const existing = await getDoc(usernameDocRef);
    if (existing.exists()) {
      throw new Error(`Username "${username}" is already taken.`);
    }

    // 2. Create Auth User
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const uid = userCredential.user.uid;

    const userProfile: UserProfile = {
      id: uid,
      email,
      username: username.trim(),
      usernameLower,
      usernameChangeCount: 0,
      eloRating: MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultStartingRating,
      gamesPlayed: 0,
      gamesWon: 0,
      gamesLost: 0,
      gamesDrawn: 0,
      status: 'online',
      createdAt: new Date().toISOString(),
    };

    // 3. Atomically write profile and reserve username
    await runTransaction(firestore, async (tx) => {
      tx.set(usernameDocRef, { uid, createdAt: serverTimestamp() });
      tx.set(doc(firestore, MULTIPLAYER_SCALE_CONFIG.collections.users, uid), {
        ...userProfile,
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp(),
      });
    });

    persistCachedProfile(userProfile);
    syncPresenceHeartbeat();
    return userProfile;
  }

  // Fallback to local mock provider
  const registered = localBackend.register(email, pass, username);
  persistCachedProfile(registered);
  syncPresenceHeartbeat();
  return registered;
}

export async function loginUser(email: string, pass: string): Promise<UserProfile> {
  if (isFirebaseConfigured() && auth && db) {
    const userCredential = await signInWithEmailAndPassword(auth, email, pass);
    const uid = userCredential.user.uid;
    const userDocRef = doc(db, MULTIPLAYER_SCALE_CONFIG.collections.users, uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      throw new Error('User profile record not found in Firestore.');
    }

    const active = isCurrentClientActive();
    const status = active ? 'online' : 'offline';
    const data = userDoc.data() as UserProfile;
    const profileWithStatus: UserProfile = { ...data, status };
    persistCachedProfile(profileWithStatus);
    syncPresenceHeartbeat();
    return profileWithStatus;
  }

  const user = localBackend.login(email, pass);
  persistCachedProfile(user);
  syncPresenceHeartbeat();
  return user;
}

export async function logoutUser(): Promise<void> {
  cleanupCurrentTabSession();
  if (isFirebaseConfigured() && auth && db) {
    const uid = auth.currentUser?.uid;
    if (uid) {
      try {
        await updateDoc(doc(db, MULTIPLAYER_SCALE_CONFIG.collections.users, uid), {
          status: 'offline',
          lastSeen: new Date(0),
        });
      } catch (e) {
        console.warn('Could not update status to offline on logout:', e);
      }
    }
    await signOut(auth);
  }
  persistCachedProfile(null);
  localBackend.logout();
  syncPresenceHeartbeat();
}

export async function changeUsername(
  uid: string,
  newUsername: string
): Promise<UserProfile> {
  const validation = validateUsernameFormat(newUsername);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const newLower = newUsername.toLowerCase().trim();

  if (isFirebaseConfigured() && db) {
    const firestore = db;
    const userDocRef = doc(firestore, MULTIPLAYER_SCALE_CONFIG.collections.users, uid);

    return await runTransaction(firestore, async (tx) => {
      const userSnap = await tx.get(userDocRef);
      if (!userSnap.exists()) throw new Error('User does not exist.');

      const current = userSnap.data() as UserProfile;
      if (current.usernameChangeCount >= 1) {
        throw new Error('You have already changed your username once. No further changes are allowed.');
      }

      const newUsernameDocRef = doc(firestore, MULTIPLAYER_SCALE_CONFIG.collections.usernames, newLower);
      const newUsernameSnap = await tx.get(newUsernameDocRef);
      if (newUsernameSnap.exists()) {
        throw new Error(`Username "${newUsername}" is already taken.`);
      }

      // Delete old username reservation
      const oldUsernameDocRef = doc(firestore, MULTIPLAYER_SCALE_CONFIG.collections.usernames, current.usernameLower);
      tx.delete(oldUsernameDocRef);

      // Reserve new username
      tx.set(newUsernameDocRef, { uid, createdAt: serverTimestamp() });

      // Update user profile
      const updatedProfile: UserProfile = {
        ...current,
        username: newUsername.trim(),
        usernameLower: newLower,
        usernameChangeCount: 1,
      };

      tx.update(userDocRef, {
        username: newUsername.trim(),
        usernameLower: newLower,
        usernameChangeCount: 1,
        updatedAt: serverTimestamp(),
      });

      persistCachedProfile(updatedProfile);
      return updatedProfile;
    });
  }

  const changed = localBackend.changeUsername(newUsername);
  persistCachedProfile(changed);
  return changed;
}

/**
 * Compares two user profiles for meaningful field changes, explicitly ignoring
 * volatile server timestamp heartbeats (`lastSeen`).
 *
 * This prevents cyclical ping-pong render loops and unbounded network write/read storms
 * when presence heartbeats touch the user document.
 *
 * Algorithmic Complexity (Big O):
 * - Time Complexity: O(1) constant scalar field equality comparisons.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 */
function hasMeaningfulProfileChanged(
  prev: UserProfile | null,
  next: UserProfile | null
): boolean {
  if (!prev && !next) return false;
  if (!prev || !next) return true;
  return (
    prev.id !== next.id ||
    prev.email !== next.email ||
    prev.username !== next.username ||
    prev.eloRating !== next.eloRating ||
    prev.gamesPlayed !== next.gamesPlayed ||
    prev.gamesWon !== next.gamesWon ||
    prev.gamesLost !== next.gamesLost ||
    prev.gamesDrawn !== next.gamesDrawn ||
    prev.status !== next.status ||
    prev.usernameChangeCount !== next.usernameChangeCount
  );
}

export function subscribeToAuthState(callback: (user: UserProfile | null) => void): () => void {
  if (isFirebaseConfigured() && auth && db) {
    let unsubscribeDoc: (() => void) | null = null;
    let lastProfileSnapshot: UserProfile | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
        lastProfileSnapshot = null;
      }

      if (firebaseUser) {
        try {
          const userDocRef = doc(db!, MULTIPLAYER_SCALE_CONFIG.collections.users, firebaseUser.uid);
          const active = isCurrentClientActive();
          const status = active ? 'online' : 'offline';
          await updateDoc(userDocRef, {
            status,
            lastSeen: active ? serverTimestamp() : new Date(0),
          });
          syncPresenceHeartbeat();

          unsubscribeDoc = onSnapshot(
            userDocRef,
            (userSnap) => {
              if (userSnap.exists()) {
                const currentActive = isCurrentClientActive();
                const currentStatus = currentActive ? 'online' : 'offline';
                const data = userSnap.data() as UserProfile;
                const profile: UserProfile = {
                  ...data,
                  status: currentStatus,
                };
                // Only dispatch callback when meaningful profile fields change (avoids lastSeen ping-pong loops)
                if (hasMeaningfulProfileChanged(lastProfileSnapshot, profile)) {
                  lastProfileSnapshot = profile;
                  persistCachedProfile(profile);
                  callback(profile);
                }
              }
            },
            (e) => {
              console.error('Error listening to user profile changes:', e);
            }
          );
        } catch (e) {
          console.error('Error initializing user profile listener:', e);
          callback(null);
        }
      } else {
        lastProfileSnapshot = null;
        persistCachedProfile(null);
        callback(null);
      }
    });

    return () => {
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }
      unsubscribeAuth();
    };
  }

  // Initial mock state
  const mockUser = localBackend.getCurrentUser();
  if (mockUser) {
    persistCachedProfile(mockUser);
  }
  callback(mockUser);
  return () => {};
}
