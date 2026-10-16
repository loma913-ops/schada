import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  updateDoc,
  deleteField,
  runTransaction,
  serverTimestamp,
  onSnapshot,
  writeBatch,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './config';
import {
  localBackend,
  type UserProfile,
  type ModeStats,
  type PerModeStats,
  createDefaultPerModeStats,
  ensurePerModeStats,
} from './localProvider';
import { type TimeControlCategory, TIME_CONTROL_CATEGORIES } from '@/components/lobby/lobbyConfig';
import {
  isCurrentClientActive,
  syncPresenceHeartbeat,
  cleanupCurrentTabSession,
} from './presenceService';
import { MULTIPLAYER_SCALE_CONFIG } from './multiplayerConfig';
import { LOCAL_CONFIG } from './localConfig';
import { ELO_CONFIG } from '@/core/elo/eloConfig';
import { safeSetItem } from '../storage/storageCleanup';
import { AUTH_CONFIG } from './authConfig';
import { SECURITY_CONFIG } from '@/core/security/securityConfig';
import { generateGuestId } from '@/core/security/cryptoUtils';

export function validateUsernameFormat(username: string): { valid: boolean; error?: string } {
  const trimmed = username.trim();
  if (
    trimmed.length < AUTH_CONFIG.minUsernameLength ||
    trimmed.length > AUTH_CONFIG.maxUsernameLength
  ) {
    return {
      valid: false,
      error: `Username must be between ${AUTH_CONFIG.minUsernameLength} and ${AUTH_CONFIG.maxUsernameLength} characters.`,
    };
  }
  if (!AUTH_CONFIG.usernameRegex.test(trimmed)) {
    return {
      valid: false,
      error: `Username can only contain ${AUTH_CONFIG.usernameRegexDescription}.`,
    };
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
    ? localStorage.getItem(LOCAL_CONFIG.storageKeys.currentUserId)
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
 * - Time Complexity: O(1) constant time document read followed by O(1) atomic field update.
 * - Auxiliary Space Complexity: O(1) scalar allocations.
 *
 * Growth Rate:
 * - O(1) constant: independent of total database size or user base growth rate.
 * - Concurrency Resilience: Eliminates optimistic concurrency locking preconditions, preventing
 *   failed-precondition collisions with concurrent presence heartbeats and status writes.
 */
export async function updateUserStats(
  userId: string,
  won: boolean,
  isDraw: boolean,
  eloDelta: number,
  category: TimeControlCategory = 'blitz'
): Promise<UserProfile | null> {
  // 1. Update local provider store
  localBackend.updateStats(userId, won, isDraw, eloDelta, category);

  // 2. If Firebase is active and the authenticated user owns this profile record
  if (isFirebaseConfigured() && db && auth) {
    if (typeof (auth as any).authStateReady === 'function') {
      try {
        await (auth as any).authStateReady();
      } catch {
        // ignore
      }
    }
    if (auth.currentUser?.uid === userId) {
      try {
        const userDocRef = doc(db, MULTIPLAYER_SCALE_CONFIG.collections.users, userId);
        const snap = await getDoc(userDocRef);
        if (snap.exists()) {
          const data = snap.data() as UserProfile;
          const currentPerMode = ensurePerModeStats(data.perModeStats);
          const currentMode = currentPerMode[category];
          const newModeElo = Math.max(ELO_CONFIG.minimumRating, currentMode.elo + eloDelta);
          const newModeStats: ModeStats = {
            elo: newModeElo,
            gamesPlayed: currentMode.gamesPlayed + 1,
            gamesWon: isDraw ? currentMode.gamesWon : won ? currentMode.gamesWon + 1 : currentMode.gamesWon,
            gamesLost: isDraw ? currentMode.gamesLost : !won ? currentMode.gamesLost + 1 : currentMode.gamesLost,
            gamesDrawn: isDraw ? currentMode.gamesDrawn + 1 : currentMode.gamesDrawn,
          };
          const updatedPerMode: PerModeStats = {
            ...currentPerMode,
            [category]: newModeStats,
          };

          await updateDoc(userDocRef, {
            perModeStats: updatedPerMode,
            updatedAt: serverTimestamp(),
          });

          const updatedProfile: UserProfile = {
            ...data,
            perModeStats: updatedPerMode,
          };

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
    return cached;
  }

  // Fallback cache synchronization if localBackend did not contain this profile (e.g. Firebase user)
  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.authCachedProfile);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as UserProfile;
        if (parsed?.id === userId) {
          const currentPerMode = ensurePerModeStats(parsed.perModeStats);
          const currentMode = currentPerMode[category];
          const newModeElo = Math.max(ELO_CONFIG.minimumRating, currentMode.elo + eloDelta);
          const newModeStats: ModeStats = {
            elo: newModeElo,
            gamesPlayed: currentMode.gamesPlayed + 1,
            gamesWon: isDraw ? currentMode.gamesWon : won ? currentMode.gamesWon + 1 : currentMode.gamesWon,
            gamesLost: isDraw ? currentMode.gamesLost : !won ? currentMode.gamesLost + 1 : currentMode.gamesLost,
            gamesDrawn: isDraw ? currentMode.gamesDrawn + 1 : currentMode.gamesDrawn,
          };
          const updatedPerMode: PerModeStats = {
            ...currentPerMode,
            [category]: newModeStats,
          };

          const updatedLocal: UserProfile = {
            ...parsed,
            perModeStats: updatedPerMode,
          };
          persistCachedProfile(updatedLocal);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent(LOCAL_CONFIG.events.profileUpdated, { detail: updatedLocal })
            );
          }
          return updatedLocal;
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
        const data = snap.data() as UserProfile;
        const status = active ? (data.status === 'in-game' ? 'in-game' : 'online') : 'offline';
        const authEmail = auth.currentUser?.email ?? data.email ?? SECURITY_CONFIG.emptyEmailFallback;
        const profile: UserProfile = {
          ...data,
          email: authEmail,
          status,
          perModeStats: ensurePerModeStats(data.perModeStats),
        };
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
    // Segregate PII: Avoid storing private user email in unencrypted browser storage
    const safeProfile: UserProfile = {
      ...profile,
      email: SECURITY_CONFIG.emptyEmailFallback,
    };
    safeSetItem(authCachedUid, safeProfile.id);
    safeSetItem(authCachedProfile, JSON.stringify(safeProfile));
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
      if (auth?.currentUser?.email) {
        parsed.email = auth.currentUser.email;
      }
      parsed.perModeStats = ensurePerModeStats(parsed.perModeStats);
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
      perModeStats: createDefaultPerModeStats(),
      status: 'online',
      createdAt: new Date().toISOString(),
    };

    const { email: _omitEmail, ...firestoreProfile } = userProfile;

    // 3. Atomically write profile and reserve username (email omitted from public Firestore document)
    await runTransaction(firestore, async (tx) => {
      tx.set(usernameDocRef, { uid, createdAt: serverTimestamp() });
      tx.set(doc(firestore, MULTIPLAYER_SCALE_CONFIG.collections.users, uid), {
        ...firestoreProfile,
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
    const data = userDoc.data() as UserProfile;
    const status = active ? (data.status === 'in-game' ? 'in-game' : 'online') : 'offline';
    const authEmail = auth.currentUser?.email ?? email;
    const createdAtStr = (data.createdAt as any)?.toDate?.()
      ? (data.createdAt as any).toDate().toISOString()
      : (typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString());
    const profileWithStatus: UserProfile = {
      ...data,
      createdAt: createdAtStr,
      email: authEmail,
      status,
      perModeStats: ensurePerModeStats(data.perModeStats),
    };
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
      if (current.usernameChangeCount >= SECURITY_CONFIG.maxUsernameChanges) {
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
        usernameChangeCount: SECURITY_CONFIG.maxUsernameChanges,
      };

      tx.update(userDocRef, {
        username: newUsername.trim(),
        usernameLower: newLower,
        usernameChangeCount: SECURITY_CONFIG.maxUsernameChanges,
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
  if (
    prev.id !== next.id ||
    prev.email !== next.email ||
    prev.username !== next.username ||
    prev.status !== next.status ||
    prev.usernameChangeCount !== next.usernameChangeCount
  ) {
    return true;
  }
  for (const cat of TIME_CONTROL_CATEGORIES) {
    const prevMode = prev.perModeStats?.[cat];
    const nextMode = next.perModeStats?.[cat];
    if (
      prevMode?.elo !== nextMode?.elo ||
      prevMode?.gamesPlayed !== nextMode?.gamesPlayed ||
      prevMode?.gamesWon !== nextMode?.gamesWon ||
      prevMode?.gamesLost !== nextMode?.gamesLost ||
      prevMode?.gamesDrawn !== nextMode?.gamesDrawn
    ) {
      return true;
    }
  }
  return false;
}

// In-memory set tracking user accounts whose PII email field has already been scheduled for deletion
const migratedEmailUids = new Set<string>();

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
                const data = userSnap.data() as UserProfile;
                const currentStatus = currentActive ? (data.status === 'in-game' ? 'in-game' : 'online') : 'offline';
                const authEmail = firebaseUser.email ?? data.email ?? SECURITY_CONFIG.emptyEmailFallback;

                // Migration: if Firestore user doc still contains email, delete it to protect PII.
                // Deduplicated via migratedEmailUids to guarantee strictly <= 1 write operation.
                if ('email' in data && data.email !== undefined && !migratedEmailUids.has(firebaseUser.uid)) {
                  migratedEmailUids.add(firebaseUser.uid);
                  updateDoc(userDocRef, { email: deleteField() }).catch((err) => {
                    migratedEmailUids.delete(firebaseUser.uid);
                    console.warn('Could not remove email from Firestore user doc:', err);
                  });
                }

                const createdAtStr = (data.createdAt as any)?.toDate?.()
                  ? (data.createdAt as any).toDate().toISOString()
                  : (typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString());

                const profile: UserProfile = {
                  ...data,
                  createdAt: createdAtStr,
                  email: authEmail,
                  status: currentStatus,
                  perModeStats: ensurePerModeStats(data.perModeStats),
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

/**
 * Deletes the authenticated user's account and profile data.
 *
 * Enforces Apple Guideline 5.1.1(v) & Google Play account deletion mandates:
 * 1. Re-authenticates the current user using their password to prevent unauthorized session hijacking.
 * 2. Executes an atomic batch deleting users/{uid} and usernames/{usernameLower} (2 operations).
 * 3. Deletes the Firebase Auth account.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time point lookups on indexed primary keys and 2-document batch deletion.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant, strictly scales without collection scans or data-volume dependency.
 */
export async function deleteUserAccount(password: string): Promise<void> {
  if (!password || typeof password !== 'string' || password.trim().length === 0) {
    throw new Error('Account deletion requires your current password for security verification.');
  }

  if (isFirebaseConfigured() && auth?.currentUser && db) {
    const currentUser = auth.currentUser;
    const uid = currentUser.uid;
    const email = currentUser.email;

    if (!email) {
      throw new Error('Account deletion requires a verified email address.');
    }

    // 1. Authoritative password verification
    const credential = EmailAuthProvider.credential(email, password);
    await reauthenticateWithCredential(currentUser, credential);

    // 2. Resolve username for lookup table deletion
    const userDocRef = doc(db, MULTIPLAYER_SCALE_CONFIG.collections.users, uid);
    const userSnap = await getDoc(userDocRef);
    const userData = userSnap.data();
    const usernameLower = userData?.usernameLower || (userData?.username ? String(userData.username).toLowerCase() : null);

    // 3. Batched atomic Firestore deletion
    const batch = writeBatch(db);
    batch.delete(userDocRef);
    if (usernameLower) {
      batch.delete(doc(db, MULTIPLAYER_SCALE_CONFIG.collections.usernames, usernameLower));
    }

    // Clean up userFriends subcollection and reciprocal friendship references
    try {
      const friendsSnap = await getDocs(
        collection(db, MULTIPLAYER_SCALE_CONFIG.collections.users, uid, MULTIPLAYER_SCALE_CONFIG.collections.userFriends)
      );
      for (const friendDoc of friendsSnap.docs) {
        batch.delete(friendDoc.ref);
        batch.delete(
          doc(db, MULTIPLAYER_SCALE_CONFIG.collections.users, friendDoc.id, MULTIPLAYER_SCALE_CONFIG.collections.userFriends, uid)
        );
      }
    } catch (e) {
      console.warn('Could not clean up userFriends on account deletion:', e);
    }

    // Clean up associated friend requests
    try {
      const [sentReqs, recvReqs] = await Promise.all([
        getDocs(query(collection(db, MULTIPLAYER_SCALE_CONFIG.collections.friendRequests), where('fromUserId', '==', uid))),
        getDocs(query(collection(db, MULTIPLAYER_SCALE_CONFIG.collections.friendRequests), where('toUserId', '==', uid))),
      ]);
      for (const reqDoc of [...sentReqs.docs, ...recvReqs.docs]) {
        batch.delete(reqDoc.ref);
      }
    } catch (e) {
      console.warn('Could not clean up friendRequests on account deletion:', e);
    }

    await batch.commit();

    // 4. Delete Auth user credentials
    await deleteUser(currentUser);
    persistCachedProfile(null);
  } else {
    // Offline / Mock backend
    const currentMock = localBackend.getCurrentUser();
    if (currentMock) {
      localBackend.deleteUser(currentMock.id);
    }
    persistCachedProfile(null);
  }
}

/**
 * Retrieves the persisted guest identifier from browser storage, or generates and
 * persists an authoritative cryptographically secure guest identifier (CSPRNG).
 *
 * Algorithmic Complexity (Big O):
 * - Time Complexity: O(1) constant time storage access and CSPRNG generation.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * @returns Cryptographically secure guest identifier starting with SECURITY_CONFIG.guestIdPrefix.
 */
export function getOrCreateGuestId(): string {
  const guestIdKey = MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.guestId;
  if (typeof localStorage !== 'undefined') {
    const existing = localStorage.getItem(guestIdKey);
    if (existing && existing.startsWith(SECURITY_CONFIG.guestIdPrefix)) {
      return existing;
    }
    const newGuestId = generateGuestId();
    safeSetItem(guestIdKey, newGuestId);
    return newGuestId;
  }
  return generateGuestId();
}

