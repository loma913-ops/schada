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
import { safeGetItem, safeSetItem } from '@/services/storage/storageCleanup';

// ---------------------------------------------------------------------------
// In-memory friends profile cache
// ---------------------------------------------------------------------------
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  inflight?: Promise<T>;
}
const friendsCache = new Map<string, CacheEntry<UserProfile[]>>();
const friendsInflight = new Map<string, Promise<UserProfile[]>>();

/** Evicts the cached friends list for a specific user. Call after any friendship mutation. */
export function invalidateFriendsCache(userId: string): void {
  friendsCache.delete(userId);
}

// ---------------------------------------------------------------------------
// Username search LRU cache (in-memory, 60s TTL)
// ---------------------------------------------------------------------------
const searchCache = new Map<string, { result: UserProfile | null; expiresAt: number }>();


export async function searchUserByExactUsername(
  username: string
): Promise<UserProfile | null> {
  const clean = username.trim().toLowerCase();
  if (!clean) return null;

  // Username search LRU cache: avoid re-querying the same term within TTL
  const cached = searchCache.get(clean);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.result;
  }

  let result: UserProfile | null = null;
  if (isFirebaseConfigured() && db) {
    const q = query(
      collection(db, MULTIPLAYER_SCALE_CONFIG.collections.users),
      where('usernameLower', '==', clean),
      limit(1)
    );
    const snap = await getDocs(q);
    result = snap.empty ? null : (snap.docs[0].data() as UserProfile);
  } else {
    result = localBackend.findUserByExactUsername(clean);
  }

  searchCache.set(clean, {
    result,
    expiresAt: Date.now() + MULTIPLAYER_SCALE_CONFIG.presence.usernameSearchCacheTtlMs,
  });
  return result;
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

    // Invalidate cached friends list for both parties since a request was sent
    invalidateFriendsCache(currentUser.id);
    invalidateFriendsCache(targetUser.id);
    // Also evict the search cache entry so a fresh profile is read on next lookup
    searchCache.delete(targetUser.username.trim().toLowerCase());

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
      invalidateFriendsCache(fromUserId);
      invalidateFriendsCache(toUserId);
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
    // In-memory cache: return immediately if within TTL
    const now = Date.now();
    const cacheHit = friendsCache.get(userId);
    if (cacheHit && now < cacheHit.expiresAt) return cacheHit.value;

    // In-flight deduplication: coalesce concurrent calls for the same userId
    const existing = friendsInflight.get(userId);
    if (existing) return existing;

    const fetchPromise = _fetchFriendsList(userId).then((profiles) => {
      friendsCache.set(userId, {
        value: profiles,
        expiresAt: Date.now() + MULTIPLAYER_SCALE_CONFIG.presence.friendsCacheTtlMs,
      });
      friendsInflight.delete(userId);
      return profiles;
    }).catch((err) => {
      friendsInflight.delete(userId);
      throw err;
    });
    friendsInflight.set(userId, fetchPromise);
    return fetchPromise;
  }

  return localBackend.getFriends(userId);
}

async function _fetchFriendsList(userId: string): Promise<UserProfile[]> {
  if (!db) return [];

  const MIGRATION_KEY = MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.legacyFriendsMigratedPrefix + userId;
  const alreadyMigrated = safeGetItem(MIGRATION_KEY) === '1';

  // Primary: read the userFriends subcollection (fast path)
  const friendsSnap = await getDocs(collection(db!, MULTIPLAYER_SCALE_CONFIG.collections.users, userId, MULTIPLAYER_SCALE_CONFIG.collections.userFriends));
  const knownFriendIds = new Set(friendsSnap.docs.map((d) => d.id));

  // Migration fallback: only check legacy friendRequests if no friends found AND not yet migrated
  if (knownFriendIds.size === 0 && !alreadyMigrated) {
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
    // Record migration as complete so subsequent polls skip the two legacy queries
    safeSetItem(MIGRATION_KEY, '1');
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



export async function removeFriend(userId: string, friendId: string): Promise<void> {
  if (isFirebaseConfigured() && db) {
    const batch = writeBatch(db);
    batch.delete(doc(db, MULTIPLAYER_SCALE_CONFIG.collections.users, userId, MULTIPLAYER_SCALE_CONFIG.collections.userFriends, friendId));
    batch.delete(doc(db, MULTIPLAYER_SCALE_CONFIG.collections.users, friendId, MULTIPLAYER_SCALE_CONFIG.collections.userFriends, userId));
    await batch.commit();
    invalidateFriendsCache(userId);
    invalidateFriendsCache(friendId);
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
