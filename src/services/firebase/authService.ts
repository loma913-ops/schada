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
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './config';
import { mockBackend, type UserProfile } from './mockProvider';
import {
  isCurrentClientActive,
  syncPresenceHeartbeat,
  cleanupCurrentTabSession,
} from './presenceService';
import { MULTIPLAYER_SCALE_CONFIG } from './multiplayerConfig';

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
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        status,
        lastSeen: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Could not update Firestore user status:', e);
    }
  }

  const currentUid = typeof localStorage !== 'undefined'
    ? localStorage.getItem('schada_mock_current_user_id')
    : null;
  if (currentUid) {
    mockBackend.setUserStatus(currentUid, status);
  }
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
    const usernameDocRef = doc(firestore, 'usernames', usernameLower);
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
      tx.set(doc(firestore, 'users', uid), {
        ...userProfile,
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp(),
      });
    });

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('schada_auth_cached_uid', uid);
    }
    syncPresenceHeartbeat();
    return userProfile;
  }

  // Fallback to local mock provider
  const registered = mockBackend.register(email, pass, username);
  syncPresenceHeartbeat();
  return registered;
}

export async function loginUser(email: string, pass: string): Promise<UserProfile> {
  if (isFirebaseConfigured() && auth && db) {
    const userCredential = await signInWithEmailAndPassword(auth, email, pass);
    const uid = userCredential.user.uid;
    const userDocRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      throw new Error('User profile record not found in Firestore.');
    }

    const active = isCurrentClientActive();
    const status = active ? 'online' : 'offline';

    try {
      await updateDoc(userDocRef, {
        status,
        lastSeen: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Could not update status to online:', e);
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('schada_auth_cached_uid', uid);
    }
    syncPresenceHeartbeat();
    const data = userDoc.data() as UserProfile;
    return { ...data, status };
  }

  const user = mockBackend.login(email, pass);
  syncPresenceHeartbeat();
  return user;
}

export async function logoutUser(): Promise<void> {
  cleanupCurrentTabSession();
  if (isFirebaseConfigured() && auth && db) {
    const uid = auth.currentUser?.uid;
    if (uid) {
      try {
        await updateDoc(doc(db, 'users', uid), {
          status: 'offline',
          lastSeen: serverTimestamp(),
        });
      } catch (e) {
        console.warn('Could not update status to offline on logout:', e);
      }
    }
    await signOut(auth);
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('schada_auth_cached_uid');
  }
  mockBackend.logout();
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
    const userDocRef = doc(firestore, 'users', uid);

    return await runTransaction(firestore, async (tx) => {
      const userSnap = await tx.get(userDocRef);
      if (!userSnap.exists()) throw new Error('User does not exist.');

      const current = userSnap.data() as UserProfile;
      if (current.usernameChangeCount >= 1) {
        throw new Error('You have already changed your username once. No further changes are allowed.');
      }

      const newUsernameDocRef = doc(firestore, 'usernames', newLower);
      const newUsernameSnap = await tx.get(newUsernameDocRef);
      if (newUsernameSnap.exists()) {
        throw new Error(`Username "${newUsername}" is already taken.`);
      }

      // Delete old username reservation
      const oldUsernameDocRef = doc(firestore, 'usernames', current.usernameLower);
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

      return updatedProfile;
    });
  }

  return mockBackend.changeUsername(newUsername);
}

export function subscribeToAuthState(callback: (user: UserProfile | null) => void): () => void {
  if (isFirebaseConfigured() && auth && db) {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('schada_auth_cached_uid', firebaseUser.uid);
        }
        try {
          const userDocRef = doc(db!, 'users', firebaseUser.uid);
          const active = isCurrentClientActive();
          const status = active ? 'online' : 'offline';
          await updateDoc(userDocRef, {
            status,
            lastSeen: serverTimestamp(),
          });
          syncPresenceHeartbeat();
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            callback({ ...(userDoc.data() as UserProfile), status });
            return;
          }
        } catch (e) {
          console.error('Error fetching user profile:', e);
        }
      } else {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('schada_auth_cached_uid');
        }
      }
      callback(null);
    });
  }

  // Initial mock state
  callback(mockBackend.getCurrentUser());
  return () => {};
}
