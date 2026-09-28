import { describe, it, expect, beforeEach, vi } from 'vitest';

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

vi.mock('../config', () => ({
  isFirebaseConfigured: () => false,
  db: null,
  auth: null,
  app: null,
}));

import {
  searchUserByExactUsername,
  sendFriendRequest,
  respondToFriendRequest,
  getFriendsList,
  removeFriend,
  getPendingIncomingRequests,
} from '../friendService';
import { localBackend } from '../localProvider';

describe('friendService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('searches for users by exact username case-insensitively and returns null for non-existent users', async () => {
    const user = localBackend.register('alice@example.com', 'secret123', 'Alice');

    const found = await searchUserByExactUsername('alice');
    expect(found).not.toBeNull();
    expect(found?.username).toBe('Alice');
    expect(found?.id).toBe(user.id);

    const notFound = await searchUserByExactUsername('nonexistent');
    expect(notFound).toBeNull();

    const empty = await searchUserByExactUsername('   ');
    expect(empty).toBeNull();
  });

  it('sends friend request and prevents self-requests and duplicates', async () => {
    const alice = localBackend.register('alice@example.com', 'secret123', 'Alice');
    const bob = localBackend.register('bob@example.com', 'secret123', 'Bob');

    // Self request rejection
    await expect(sendFriendRequest(alice, 'Alice')).rejects.toThrow();

    // Valid send
    const req = await sendFriendRequest(alice, 'Bob');
    expect(req).toBeDefined();
    expect(req.fromUserId).toBe(alice.id);
    expect(req.toUserId).toBe(bob.id);
    expect(req.status).toBe('pending');

    // Duplicate rejection
    await expect(sendFriendRequest(alice, 'Bob')).rejects.toThrow();
  });

  it('allows accepting friend requests and lists mutual friends', async () => {
    const alice = localBackend.register('alice@example.com', 'secret123', 'Alice');
    const bob = localBackend.register('bob@example.com', 'secret123', 'Bob');

    const req = await sendFriendRequest(alice, 'Bob');

    const pendingBob = await getPendingIncomingRequests(bob.id);
    expect(pendingBob).toHaveLength(1);
    expect(pendingBob[0].id).toBe(req.id);

    await respondToFriendRequest(req.id, true);

    const aliceFriends = await getFriendsList(alice.id);
    expect(aliceFriends.some((f) => f.id === bob.id)).toBe(true);

    const bobFriends = await getFriendsList(bob.id);
    expect(bobFriends.some((f) => f.id === alice.id)).toBe(true);
  });

  it('allows declining friend requests without adding to friends list', async () => {
    const alice = localBackend.register('alice@example.com', 'secret123', 'Alice');
    const charlie = localBackend.register('charlie@example.com', 'secret123', 'Charlie');

    const req = await sendFriendRequest(alice, 'Charlie');
    await respondToFriendRequest(req.id, false);

    const charlieFriends = await getFriendsList(charlie.id);
    expect(charlieFriends).toHaveLength(0);

    const pending = await getPendingIncomingRequests(charlie.id);
    expect(pending).toHaveLength(0);
  });

  it('removes friends reciprocally', async () => {
    const alice = localBackend.register('alice@example.com', 'secret123', 'Alice');
    const bob = localBackend.register('bob@example.com', 'secret123', 'Bob');

    const req = await sendFriendRequest(alice, 'Bob');
    await respondToFriendRequest(req.id, true);

    expect((await getFriendsList(alice.id)).length).toBe(1);
    expect((await getFriendsList(bob.id)).length).toBe(1);

    await removeFriend(alice.id, bob.id);

    expect(await getFriendsList(alice.id)).toHaveLength(0);
    expect(await getFriendsList(bob.id)).toHaveLength(0);
  });
});
