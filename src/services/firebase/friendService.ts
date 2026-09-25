import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import { mockBackend, type UserProfile, type MockFriendRequest } from './mockProvider';

export async function searchUserByExactUsername(
  username: string
): Promise<UserProfile | null> {
  const clean = username.trim().toLowerCase();
  if (!clean) return null;

  if (isFirebaseConfigured() && db) {
    const q = query(collection(db, 'users'), where('usernameLower', '==', clean));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].data() as UserProfile;
    }
    return null;
  }

  return mockBackend.findUserByExactUsername(clean);
}

export async function sendFriendRequest(
  currentUser: UserProfile,
  targetUsername: string
): Promise<MockFriendRequest> {
  const targetUser = await searchUserByExactUsername(targetUsername);
  if (!targetUser) {
    throw new Error(`User "${targetUsername}" not found. Verify the exact username.`);
  }

  if (targetUser.id === currentUser.id) {
    throw new Error('You cannot send a friend request to yourself.');
  }

  if (isFirebaseConfigured() && db) {
    // Check if request already exists
    const q = query(
      collection(db, 'friendRequests'),
      where('fromUserId', '==', currentUser.id),
      where('toUserId', '==', targetUser.id),
      where('status', '==', 'pending')
    );
    const existingSnap = await getDocs(q);
    if (!existingSnap.empty) {
      throw new Error('Friend request already sent.');
    }

    const docRef = await addDoc(collection(db, 'friendRequests'), {
      fromUserId: currentUser.id,
      fromUsername: currentUser.username,
      toUserId: targetUser.id,
      toUsername: targetUser.username,
      status: 'pending',
      createdAt: serverTimestamp(),
    });

    return {
      id: docRef.id,
      fromUserId: currentUser.id,
      fromUsername: currentUser.username,
      toUserId: targetUser.id,
      toUsername: targetUser.username,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
  }

  return mockBackend.sendFriendRequest(currentUser, targetUsername);
}

export async function respondToFriendRequest(
  requestId: string,
  accept: boolean
): Promise<void> {
  if (isFirebaseConfigured() && db) {
    const reqRef = doc(db, 'friendRequests', requestId);
    const reqSnap = await getDoc(reqRef);
    if (!reqSnap.exists()) return;
    const reqData = reqSnap.data();

    if (accept) {
      await updateDoc(reqRef, {
        status: 'accepted',
        respondedAt: serverTimestamp(),
      });
      // Write both sides of the friendship so getFriendsList can find them
      const { fromUserId, toUserId } = reqData;
      await Promise.all([
        setDoc(doc(db, 'users', fromUserId, 'userFriends', toUserId), { since: serverTimestamp() }),
        setDoc(doc(db, 'users', toUserId, 'userFriends', fromUserId), { since: serverTimestamp() }),
      ]);
    } else {
      await updateDoc(reqRef, {
        status: 'declined',
        respondedAt: serverTimestamp(),
      });
    }
    return;
  }

  mockBackend.respondToFriendRequest(requestId, accept);
}

export async function getFriendsList(userId: string): Promise<UserProfile[]> {
  if (isFirebaseConfigured() && db) {
    // Primary: read the userFriends subcollection (fast path)
    const friendsSnap = await getDocs(collection(db!, 'users', userId, 'userFriends'));
    const knownFriendIds = new Set(friendsSnap.docs.map((d) => d.id));

    // Migration fallback: find accepted requests whose userFriends docs were never written
    // (affects friendships accepted before the backfill fix was deployed)
    const [sentSnap, receivedSnap] = await Promise.all([
      getDocs(query(collection(db!, 'friendRequests'), where('fromUserId', '==', userId), where('status', '==', 'accepted'))),
      getDocs(query(collection(db!, 'friendRequests'), where('toUserId',   '==', userId), where('status', '==', 'accepted'))),
    ]);

    const backfills: Promise<unknown>[] = [];
    for (const reqDoc of [...sentSnap.docs, ...receivedSnap.docs]) {
      const data = reqDoc.data();
      const friendId = data.fromUserId === userId ? data.toUserId : data.fromUserId;
      if (!knownFriendIds.has(friendId)) {
        knownFriendIds.add(friendId);
        // Lazy-backfill both sides so subsequent loads skip this branch
        backfills.push(
          setDoc(doc(db!, 'users', userId,    'userFriends', friendId), { since: serverTimestamp() }),
          setDoc(doc(db!, 'users', friendId,  'userFriends', userId),   { since: serverTimestamp() }),
        );
      }
    }
    if (backfills.length > 0) Promise.all(backfills).catch(console.error);

    if (knownFriendIds.size === 0) return [];

    // Fetch all friend profiles in parallel by document ID
    const now = Date.now();
    const profileSnaps = await Promise.all(
      [...knownFriendIds].map((fid) => getDoc(doc(db!, 'users', fid)))
    );

    return profileSnaps
      .filter((snap) => snap.exists())
      .map((snap) => {
        const data = snap.data() as UserProfile;
        const lastSeenMs = (data.lastSeen as any)?.toMillis
          ? (data.lastSeen as any).toMillis()
          : (data.lastSeen ? new Date(data.lastSeen as string).getTime() : 0);
        const isFresh = now - lastSeenMs <= 45000;
        const effectiveStatus = (data.status !== 'offline' && isFresh) ? data.status : 'offline';
        return { ...data, status: effectiveStatus };
      });
  }

  return mockBackend.getFriends(userId);
}


export async function removeFriend(userId: string, friendId: string): Promise<void> {
  if (isFirebaseConfigured() && db) {
    await deleteDoc(doc(db, 'users', userId, 'userFriends', friendId));
    await deleteDoc(doc(db, 'users', friendId, 'userFriends', userId));
    return;
  }

  mockBackend.removeFriend(userId, friendId);
}

export async function getPendingIncomingRequests(
  userId: string
): Promise<MockFriendRequest[]> {
  if (isFirebaseConfigured() && db) {
    const q = query(
      collection(db, 'friendRequests'),
      where('toUserId', '==', userId),
      where('status', '==', 'pending')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MockFriendRequest));
  }

  return mockBackend.getPendingIncomingRequests(userId);
}
