import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  documentId,
  limit,
  writeBatch,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import { localBackend, type UserProfile, type LocalFriendRequest } from './localProvider';
import { MULTIPLAYER_SCALE_CONFIG } from './multiplayerConfig';
import { isPatronUser } from '@/components/common/PatronBadge';

export async function searchUserByExactUsername(
  username: string
): Promise<UserProfile | null> {
  const clean = username.trim().toLowerCase();
  if (!clean) return null;

  if (isFirebaseConfigured() && db) {
    const q = query(
      collection(db, MULTIPLAYER_SCALE_CONFIG.collections.users),
      where('usernameLower', '==', clean),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].data() as UserProfile;
    }
    return null;
  }

  return localBackend.findUserByExactUsername(clean);
}

export async function sendFriendRequest(
  currentUser: UserProfile,
  targetUsername: string
): Promise<LocalFriendRequest> {
  const targetUser = await searchUserByExactUsername(targetUsername);
  if (!targetUser) {
    throw new Error(`User "${targetUsername}" not found. Verify the exact username.`);
  }

  if (targetUser.id === currentUser.id) {
    throw new Error('You cannot send a friend request to yourself.');
  }

  if (isFirebaseConfigured() && db) {
    // Check if request already exists (bounded to 1 read)
    const q = query(
      collection(db, MULTIPLAYER_SCALE_CONFIG.collections.friendRequests),
      where('fromUserId', '==', currentUser.id),
      where('toUserId', '==', targetUser.id),
      where('status', '==', 'pending'),
      limit(1)
    );
    const existingSnap = await getDocs(q);
    if (!existingSnap.empty) {
      throw new Error('Friend request already sent.');
    }

    const isDonor = isPatronUser(currentUser);
    const docRef = await addDoc(collection(db, MULTIPLAYER_SCALE_CONFIG.collections.friendRequests), {
      fromUserId: currentUser.id,
      fromUsername: currentUser.username,
      fromUserIsPatron: isDonor,
      fromUserPatronTier: currentUser.patronTier ?? null,
      fromUserPatronExpiresAt: currentUser.patronExpiresAt ?? null,
      fromUserPatronSubscriptionStatus: currentUser.patronSubscriptionStatus ?? null,
      toUserId: targetUser.id,
      toUsername: targetUser.username,
      status: 'pending',
      createdAt: serverTimestamp(),
    });

    return {
      id: docRef.id,
      fromUserId: currentUser.id,
      fromUsername: currentUser.username,
      fromUserIsPatron: isDonor,
      fromUserPatronTier: currentUser.patronTier,
      fromUserPatronExpiresAt: currentUser.patronExpiresAt,
      fromUserPatronSubscriptionStatus: currentUser.patronSubscriptionStatus,
      toUserId: targetUser.id,
      toUsername: targetUser.username,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
  }

  return localBackend.sendFriendRequest(currentUser, targetUsername);
}

export async function respondToFriendRequest(
  requestId: string,
  accept: boolean
): Promise<void> {
  if (isFirebaseConfigured() && db) {
    const reqRef = doc(db, MULTIPLAYER_SCALE_CONFIG.collections.friendRequests, requestId);
    const reqSnap = await getDoc(reqRef);
    if (!reqSnap.exists()) return;
    const reqData = reqSnap.data();

    if (accept) {
      const batch = writeBatch(db);
      batch.update(reqRef, {
        status: 'accepted',
        respondedAt: serverTimestamp(),
      });
      // Atomically write both reciprocal friendship documents in a single round-trip commit
      const { fromUserId, toUserId } = reqData;
      batch.set(
        doc(db, MULTIPLAYER_SCALE_CONFIG.collections.users, fromUserId, MULTIPLAYER_SCALE_CONFIG.collections.userFriends, toUserId),
        { since: serverTimestamp() }
      );
      batch.set(
        doc(db, MULTIPLAYER_SCALE_CONFIG.collections.users, toUserId, MULTIPLAYER_SCALE_CONFIG.collections.userFriends, fromUserId),
        { since: serverTimestamp() }
      );
      await batch.commit();
    } else {
      await updateDoc(reqRef, {
        status: 'declined',
        respondedAt: serverTimestamp(),
      });
    }
    return;
  }

  localBackend.respondToFriendRequest(requestId, accept);
}

/**
 * Retrieves the authenticated user's friends list with current online/in-game status.
 *
 * Algorithmic Complexity (Big O):
 * - Subcollection Query: O(log M + K) where M is total users and K is the count of friends.
 * - Profile Batching: O(ceil(K / B)) network queries where B = MULTIPLAYER_SCALE_CONFIG.matchmaking.friendBatchLookupSize (B = 30).
 *   Reduces network round-trips by up to 30x compared to unbatched O(K) getDoc calls.
 * - Auxiliary Space Complexity: O(K) for in-memory profiles array.
 * - Growth Rate: Sub-linear batch scaling O(ceil(K / 30)) ensuring sustainable reads even for users with hundreds of friends.
 *
 * @param userId Unique user ID whose friends list is requested.
 * @returns Array of UserProfile objects with dynamic online status.
 */
export async function getFriendsList(userId: string): Promise<UserProfile[]> {
  if (isFirebaseConfigured() && db) {
    // Primary: read the userFriends subcollection (fast path)
    const friendsSnap = await getDocs(collection(db!, MULTIPLAYER_SCALE_CONFIG.collections.users, userId, MULTIPLAYER_SCALE_CONFIG.collections.userFriends));
    const knownFriendIds = new Set(friendsSnap.docs.map((d) => d.id));

    // Migration fallback: only check legacy friendRequests if no friends were found in subcollection
    if (knownFriendIds.size === 0) {
      const [sentSnap, receivedSnap] = await Promise.all([
        getDocs(query(collection(db!, MULTIPLAYER_SCALE_CONFIG.collections.friendRequests), where('fromUserId', '==', userId), where('status', '==', 'accepted'))),
        getDocs(query(collection(db!, MULTIPLAYER_SCALE_CONFIG.collections.friendRequests), where('toUserId',   '==', userId), where('status', '==', 'accepted'))),
      ]);

      const backfillBatch = writeBatch(db!);
      let backfillCount = 0;
      for (const reqDoc of [...sentSnap.docs, ...receivedSnap.docs]) {
        const data = reqDoc.data();
        const friendId = data.fromUserId === userId ? data.toUserId : data.fromUserId;
        if (!knownFriendIds.has(friendId)) {
          knownFriendIds.add(friendId);
          backfillBatch.set(
            doc(db!, MULTIPLAYER_SCALE_CONFIG.collections.users, userId, MULTIPLAYER_SCALE_CONFIG.collections.userFriends, friendId),
            { since: serverTimestamp() }
          );
          backfillBatch.set(
            doc(db!, MULTIPLAYER_SCALE_CONFIG.collections.users, friendId, MULTIPLAYER_SCALE_CONFIG.collections.userFriends, userId),
            { since: serverTimestamp() }
          );
          backfillCount += 2;
        }
      }
      if (backfillCount > 0) {
        backfillBatch.commit().catch(console.error);
      }
    }

    if (knownFriendIds.size === 0) return [];

    // Fetch friend profiles in batched queries of up to friendBatchLookupSize IDs instead of N individual getDoc calls
    const friendIdList = [...knownFriendIds];
    const BATCH_SIZE = MULTIPLAYER_SCALE_CONFIG.matchmaking.friendBatchLookupSize;
    const profileBatches: Promise<import('firebase/firestore').QuerySnapshot>[] = [];

    for (let i = 0; i < friendIdList.length; i += BATCH_SIZE) {
      const chunk = friendIdList.slice(i, i + BATCH_SIZE);
      const batchQuery = query(collection(db!, MULTIPLAYER_SCALE_CONFIG.collections.users), where(documentId(), 'in', chunk));
      profileBatches.push(getDocs(batchQuery));
    }

    const batchSnaps = await Promise.all(profileBatches);
    const now = Date.now();
    const freshnessThresholdMs = MULTIPLAYER_SCALE_CONFIG.presence.friendFreshnessThresholdMs;
    const profiles: UserProfile[] = [];

    for (const snap of batchSnaps) {
      for (const docSnap of snap.docs) {
        const data = docSnap.data() as UserProfile;
        const lastSeenMs = (data.lastSeen as any)?.toMillis
          ? (data.lastSeen as any).toMillis()
          : (data.lastSeen ? new Date(data.lastSeen as string).getTime() : 0);
        const isFresh = now - lastSeenMs <= freshnessThresholdMs;
        const effectiveStatus = (data.status !== 'offline' && isFresh) ? data.status : 'offline';
        profiles.push({ ...data, status: effectiveStatus });
      }
    }

    return profiles;
  }

  return localBackend.getFriends(userId);
}


export async function removeFriend(userId: string, friendId: string): Promise<void> {
  if (isFirebaseConfigured() && db) {
    const batch = writeBatch(db);
    batch.delete(doc(db, MULTIPLAYER_SCALE_CONFIG.collections.users, userId, MULTIPLAYER_SCALE_CONFIG.collections.userFriends, friendId));
    batch.delete(doc(db, MULTIPLAYER_SCALE_CONFIG.collections.users, friendId, MULTIPLAYER_SCALE_CONFIG.collections.userFriends, userId));
    await batch.commit();
    return;
  }

  localBackend.removeFriend(userId, friendId);
}

export async function getPendingIncomingRequests(
  userId: string
): Promise<LocalFriendRequest[]> {
  if (isFirebaseConfigured() && db) {
    const q = query(
      collection(db, MULTIPLAYER_SCALE_CONFIG.collections.friendRequests),
      where('toUserId', '==', userId),
      where('status', '==', 'pending'),
      limit(MULTIPLAYER_SCALE_CONFIG.matchmaking.leaderboardLimit)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as LocalFriendRequest));
  }

  return localBackend.getPendingIncomingRequests(userId);
}
