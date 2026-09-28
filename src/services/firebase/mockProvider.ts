/**
 * Mock Backend Provider for Offline and Development Testing.
 *
 * Simulates Firebase Firestore authentication, user profiles, presence tracking,
 * and friend request management using browser localStorage.
 */

import { MULTIPLAYER_SCALE_CONFIG } from './multiplayerConfig';
import { ACTIVE_SESSIONS_STORAGE_KEY } from './presenceService';
import { MOCK_CONFIG } from './mockConfig';

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  usernameLower: string;
  usernameChangeCount: number; // 0 initially; max 1 edit allowed
  eloRating: number;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  gamesDrawn: number;
  status: 'online' | 'in-game' | 'offline';
  lastSeen?: string;
  createdAt: string;
}

export interface MockFriendRequest {
  id: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  toUsername: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

class MockBackend {
  private usersKey = MOCK_CONFIG.storageKeys.users;
  private currentUserIdKey = MOCK_CONFIG.storageKeys.currentUserId;
  private requestsKey = MOCK_CONFIG.storageKeys.friendRequests;
  private friendsKey = MOCK_CONFIG.storageKeys.friends;

  constructor() {
    this.seedDefaultUsers();
  }

  /**
   * Initializes default mock user accounts if not present in localStorage.
   *
   * Algorithmic Complexity:
   * - Time Complexity: O(U) where U is the count of default mock users.
   * - Auxiliary Space Complexity: O(U) serialized user JSON.
   *
   * Growth Rate:
   * - O(U) linear with respect to default user count.
   */
  private seedDefaultUsers(): void {
    if (typeof localStorage === 'undefined') return;
    const existing = localStorage.getItem(this.usersKey);
    if (!existing) {
      localStorage.setItem(this.usersKey, JSON.stringify(MOCK_CONFIG.defaultUsers));
    } else {
      // Sanitize existing cached users so inactive/offline accounts are not erroneously marked online
      try {
        const users: Record<string, UserProfile> = JSON.parse(existing);
        let changed = false;
        const activeIds = this.getActiveRegisteredUserIds();
        for (const [uid, u] of Object.entries(users)) {
          const active = activeIds.has(uid);
          if (!active && u.status !== 'offline') {
            u.status = 'offline';
            changed = true;
          }
        }
        if (changed) {
          localStorage.setItem(this.usersKey, JSON.stringify(users));
        }
      } catch {
        // Ignore parse error
      }
    }
  }

  /**
   * Safely retrieves and deserializes data from localStorage with a fallback value.
   *
   * Algorithmic Complexity:
   * - Time Complexity: O(S) where S is the serialized string length.
   * - Auxiliary Space Complexity: O(S) parsed memory representation.
   *
   * Growth Rate:
   * - O(S) linear with respect to stored payload size.
   */
  private safeGetStorage<T>(key: string, defaultValue: T): T {
    if (typeof localStorage === 'undefined') return defaultValue;
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  /**
   * Retrieves the map of all stored user profiles.
   *
   * Algorithmic Complexity:
   * - Time Complexity: O(U) where U is the number of stored users.
   * - Auxiliary Space Complexity: O(U) parsed users map.
   *
   * Growth Rate:
   * - O(U) linear.
   */
  private getUsers(): Record<string, UserProfile> {
    return this.safeGetStorage<Record<string, UserProfile>>(this.usersKey, {});
  }

  /**
   * Serializes and writes user profiles to localStorage.
   *
   * Algorithmic Complexity:
   * - Time Complexity: O(U) where U is the number of users to serialize.
   * - Auxiliary Space Complexity: O(U) serialized string.
   *
   * Growth Rate:
   * - O(U) linear.
   */
  private saveUsers(users: Record<string, UserProfile>): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(this.usersKey, JSON.stringify(users));
  }

  /**
   * Retrieves all user IDs currently active across any client tab.
   * Prioritizes algorithmic growth rate O(N) by reading storage and deserializing
   * exactly once instead of repeating disk reads per caller.
   *
   * Algorithmic Complexity:
   * - Time Complexity: O(N) where N is the number of active tab sessions in localStorage.
   * - Auxiliary Space Complexity: O(N) auxiliary set to store active registered user IDs.
   *
   * Growth Rate:
   * - O(N) linear with respect to active tab session count.
   */
  private getActiveRegisteredUserIds(): Set<string> {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(ACTIVE_SESSIONS_STORAGE_KEY) : null;
    if (!raw) return new Set();
    try {
      const map: Record<string, { lastSeen: number; isRegistered: boolean; userId: string | null; isActive: boolean }> = JSON.parse(raw);
      const now = Date.now();
      const ttl = MULTIPLAYER_SCALE_CONFIG.presence.sessionTtlMs;
      const activeIds = new Set<string>();
      for (const s of Object.values(map)) {
        if (s.userId && s.isRegistered && s.isActive && now - s.lastSeen <= ttl) {
          activeIds.add(s.userId);
        }
      }
      return activeIds;
    } catch {
      return new Set();
    }
  }

  /**
   * Checks whether a specific user is currently active across client tabs.
   *
   * Algorithmic Complexity:
   * - Time Complexity: O(N) to build active session set + O(1) set lookup.
   * - Auxiliary Space Complexity: O(N) auxiliary set.
   *
   * Growth Rate:
   * - O(N) linear.
   */
  public isUserActive(userId: string): boolean {
    return this.getActiveRegisteredUserIds().has(userId);
  }

  /**
   * Updates a user's status and dispatches a notification event.
   *
   * Algorithmic Complexity:
   * - Time Complexity: O(U) where U is total user count.
   * - Auxiliary Space Complexity: O(U) serialization.
   *
   * Growth Rate:
   * - O(U) linear.
   */
  public setUserStatus(userId: string, status: 'online' | 'in-game' | 'offline'): void {
    const users = this.getUsers();
    if (users[userId]) {
      if (users[userId].status !== status) {
        users[userId].status = status;
        users[userId].lastSeen = new Date().toISOString();
        this.saveUsers(users);
        try {
          window.dispatchEvent(
            new CustomEvent(MOCK_CONFIG.events.userStatusChanged, { detail: { userId, status } })
          );
        } catch {
          // Ignore in non-browser environments
        }
      }
    }
  }

  /**
   * Retrieves the currently authenticated mock user profile.
   *
   * Algorithmic Complexity:
   * - Time Complexity: O(1) hash map lookup after O(U) user store load.
   * - Auxiliary Space Complexity: O(1) profile reference.
   *
   * Growth Rate:
   * - O(U) linear.
   */
  public getCurrentUser(): UserProfile | null {
    if (typeof localStorage === 'undefined') return null;
    const uid = localStorage.getItem(this.currentUserIdKey);
    if (!uid) return null;
    const users = this.getUsers();
    const u = users[uid] || null;
    if (u) {
      const active = this.isUserActive(u.id);
      return {
        ...u,
        status: (active ? (u.status === 'in-game' ? 'in-game' : 'online') : 'offline') as 'online' | 'in-game' | 'offline',
      };
    }
    return null;
  }

  /**
   * Authenticates a user with email and password in the mock provider.
   *
   * Algorithmic Complexity:
   * - Time Complexity: O(U) search through registered user accounts.
   * - Auxiliary Space Complexity: O(1) scalar allocations.
   *
   * Growth Rate:
   * - O(U) linear.
   */
  public login(email: string, _password: string): UserProfile {
    const users = this.getUsers();
    const emailLower = email.toLowerCase().trim();
    const user = Object.values(users).find((u) => u.email.toLowerCase() === emailLower);
    if (!user) {
      throw new Error('No user found with this email. Please check your credentials or register.');
    }
    user.status = 'online';
    user.lastSeen = new Date().toISOString();
    users[user.id] = user;
    this.saveUsers(users);

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.currentUserIdKey, user.id);
    }
    return user;
  }

  /**
   * Registers a new user account in the mock provider.
   *
   * Algorithmic Complexity:
   * - Time Complexity: O(U) uniqueness checks.
   * - Auxiliary Space Complexity: O(1) new user object.
   *
   * Growth Rate:
   * - O(U) linear.
   */
  public register(email: string, _password: string, username: string): UserProfile {
    const users = this.getUsers();
    const usernameLower = username.toLowerCase().trim();

    if (Object.values(users).some((u) => u.usernameLower === usernameLower)) {
      throw new Error(`Username "${username}" is already taken.`);
    }

    const uid = `user_${Date.now()}`;
    const newUser: UserProfile = {
      id: uid,
      email: email.trim(),
      username: username.trim(),
      usernameLower,
      usernameChangeCount: 0,
      eloRating: MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultStartingRating,
      gamesPlayed: 0,
      gamesWon: 0,
      gamesLost: 0,
      gamesDrawn: 0,
      status: 'online',
      lastSeen: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    users[uid] = newUser;
    this.saveUsers(users);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.currentUserIdKey, uid);
    }
    return newUser;
  }

  /**
   * Logs out the current mock user and updates status to offline.
   *
   * Algorithmic Complexity:
   * - Time Complexity: O(U) user store update.
   * - Auxiliary Space Complexity: O(1) scalar allocations.
   *
   * Growth Rate:
   * - O(U) linear.
   */
  public logout(): void {
    if (typeof localStorage === 'undefined') return;
    const currentId = localStorage.getItem(this.currentUserIdKey);
    if (currentId) {
      const users = this.getUsers();
      if (users[currentId]) {
        users[currentId].status = 'offline';
        users[currentId].lastSeen = new Date().toISOString();
        this.saveUsers(users);
      }
    }
    localStorage.removeItem(this.currentUserIdKey);
    try {
      window.dispatchEvent(
        new CustomEvent(MOCK_CONFIG.events.userStatusChanged, { detail: { status: 'offline' } })
      );
    } catch {
      // Ignore
    }
  }

  /**
   * Computes the number of unique registered users currently active.
   *
   * Algorithmic Complexity:
   * - Time Complexity: O(N) to iterate session heartbeats.
   * - Auxiliary Space Complexity: O(N) active IDs set.
   *
   * Growth Rate:
   * - O(N) linear.
   */
  public getOnlineRegisteredUsersCount(): number {
    const activeIds = this.getActiveRegisteredUserIds();
    if (activeIds.size > 0) {
      return activeIds.size;
    }
    const currentUid = typeof localStorage !== 'undefined' ? localStorage.getItem(this.currentUserIdKey) : null;
    return currentUid && this.isUserActive(currentUid) ? 1 : 0;
  }

  /**
   * Updates username for the authenticated user, enforcing the 1-time change limit.
   *
   * Algorithmic Complexity:
   * - Time Complexity: O(U) uniqueness check across existing users.
   * - Auxiliary Space Complexity: O(1) scalar allocations.
   *
   * Growth Rate:
   * - O(U) linear.
   */
  public changeUsername(newUsername: string): UserProfile {
    const current = this.getCurrentUser();
    if (!current) throw new Error('Not authenticated');

    if (current.usernameChangeCount >= 1) {
      throw new Error('You have already used your 1 permitted username change.');
    }

    const usernameLower = newUsername.toLowerCase().trim();
    const users = this.getUsers();

    const exists = Object.values(users).some(
      (u) => u.id !== current.id && u.usernameLower === usernameLower
    );
    if (exists) {
      throw new Error(`Username "${newUsername}" is already taken.`);
    }

    current.username = newUsername.trim();
    current.usernameLower = usernameLower;
    current.usernameChangeCount = 1;

    users[current.id] = current;
    this.saveUsers(users);
    return current;
  }

  /**
   * Updates game results and Elo rating for a user.
   *
   * Algorithmic Complexity:
   * - Time Complexity: O(U) to load and save users.
   * - Auxiliary Space Complexity: O(1) rating update.
   *
   * Growth Rate:
   * - O(U) linear.
   */
  public updateStats(userId: string, won: boolean, isDraw: boolean, eloDelta: number): void {
    const users = this.getUsers();
    const u = users[userId];
    if (!u) return;

    u.gamesPlayed += 1;
    if (isDraw) {
      u.gamesDrawn += 1;
    } else if (won) {
      u.gamesWon += 1;
    } else {
      u.gamesLost += 1;
    }
    u.eloRating = Math.max(100, u.eloRating + eloDelta);

    users[userId] = u;
    this.saveUsers(users);
  }

  /**
   * Finds a user by their exact normalized username.
   *
   * Algorithmic Complexity:
   * - Time Complexity: O(U) linear search.
   * - Auxiliary Space Complexity: O(1) reference.
   *
   * Growth Rate:
   * - O(U) linear.
   */
  public findUserByExactUsername(username: string): UserProfile | null {
    const users = this.getUsers();
    const target = username.toLowerCase().trim();
    return Object.values(users).find((u) => u.usernameLower === target) || null;
  }

  /**
   * Returns a leaderboard sorted by Elo rating in descending order.
   *
   * Algorithmic Complexity:
   * - Time Complexity: O(U log U) comparison sort where U is user count.
   * - Auxiliary Space Complexity: O(U) array allocation.
   *
   * Growth Rate:
   * - O(U log U) log-linear with respect to user count.
   */
  public getLeaderboard(): UserProfile[] {
    const users = this.getUsers();
    return Object.values(users).sort((a, b) => b.eloRating - a.eloRating);
  }

  // Friend Requests

  /**
   * Retrieves pending and historic friend requests.
   *
   * Algorithmic Complexity:
   * - Time Complexity: O(R) where R is total stored requests.
   * - Auxiliary Space Complexity: O(R) parsed requests array.
   *
   * Growth Rate:
   * - O(R) linear.
   */
  private getRequests(): MockFriendRequest[] {
    return this.safeGetStorage<MockFriendRequest[]>(this.requestsKey, []);
  }

  private saveRequests(reqs: MockFriendRequest[]): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(this.requestsKey, JSON.stringify(reqs));
  }

  /**
   * Creates and dispatches a new friend request.
   *
   * Algorithmic Complexity:
   * - Time Complexity: O(U + R) where U is user lookup and R is existing requests scan.
   * - Auxiliary Space Complexity: O(1) request object allocation.
   *
   * Growth Rate:
   * - O(U + R) linear.
   */
  public sendFriendRequest(fromUser: UserProfile, toUsername: string): MockFriendRequest {
    const target = this.findUserByExactUsername(toUsername);
    if (!target) {
      throw new Error(`User "${toUsername}" not found. Please verify the exact username.`);
    }
    if (target.id === fromUser.id) {
      throw new Error('You cannot add yourself as a friend.');
    }

    const reqs = this.getRequests();
    const existing = reqs.find(
      (r) =>
        r.status === 'pending' &&
        r.fromUserId === fromUser.id &&
        r.toUserId === target.id
    );
    if (existing) {
      throw new Error('Friend request already sent.');
    }

    const newReq: MockFriendRequest = {
      id: `freq_${Date.now()}`,
      fromUserId: fromUser.id,
      fromUsername: fromUser.username,
      toUserId: target.id,
      toUsername: target.username,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    reqs.push(newReq);
    this.saveRequests(reqs);
    return newReq;
  }

  /**
   * Responds to an incoming friend request (accept or decline).
   *
   * Algorithmic Complexity:
   * - Time Complexity: O(R + F) where R is requests search and F is friend list update.
   * - Auxiliary Space Complexity: O(F) friends data map.
   *
   * Growth Rate:
   * - O(R + F) linear.
   */
  public respondToFriendRequest(requestId: string, accept: boolean): void {
    const reqs = this.getRequests();
    const req = reqs.find((r) => r.id === requestId);
    if (!req) return;

    req.status = accept ? 'accepted' : 'declined';
    this.saveRequests(reqs);

    if (accept) {
      // Add each other as friends
      const friendsData = this.safeGetStorage<Record<string, string[]>>(this.friendsKey, {});
      if (!friendsData[req.fromUserId]) friendsData[req.fromUserId] = [];
      if (!friendsData[req.toUserId]) friendsData[req.toUserId] = [];

      if (!friendsData[req.fromUserId].includes(req.toUserId)) {
        friendsData[req.fromUserId].push(req.toUserId);
      }
      if (!friendsData[req.toUserId].includes(req.fromUserId)) {
        friendsData[req.toUserId].push(req.fromUserId);
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.friendsKey, JSON.stringify(friendsData));
      }
    }
  }

  /**
   * Retrieves friends for a user with real-time active status computed in linear O(N + F) time.
   * Pre-computes active session IDs in a hash set to eliminate O(F * N) repetitive disk reads.
   *
   * Algorithmic Complexity:
   * - Time Complexity: O(N + F + U) where N is active tab count, F is friend count, U is total users.
   * - Auxiliary Space Complexity: O(N + F) for the active IDs set and friends array.
   *
   * Growth Rate:
   * - O(N + F + U) linear, significantly outperforming legacy O(F * N) per-friend disk lookups.
   */
  public getFriends(userId: string): UserProfile[] {
    const friendsData = this.safeGetStorage<Record<string, string[]>>(this.friendsKey, {});
    const friendIds = friendsData[userId] || [];
    const users = this.getUsers();
    const activeUserIds = this.getActiveRegisteredUserIds();

    return friendIds
      .map((fid) => {
        const u = users[fid];
        if (!u) return null;
        const active = activeUserIds.has(u.id);
        return {
          ...u,
          status: (active ? (u.status === 'in-game' ? 'in-game' : 'online') : 'offline') as 'online' | 'in-game' | 'offline',
        };
      })
      .filter(Boolean) as UserProfile[];
  }

  /**
   * Removes a friendship between two users.
   *
   * Algorithmic Complexity:
   * - Time Complexity: O(F) where F is friend list length.
   * - Auxiliary Space Complexity: O(F) filtered arrays.
   *
   * Growth Rate:
   * - O(F) linear.
   */
  public removeFriend(userId: string, friendId: string): void {
    const friendsData = this.safeGetStorage<Record<string, string[]>>(this.friendsKey, {});
    if (friendsData[userId]) {
      friendsData[userId] = friendsData[userId].filter((id) => id !== friendId);
    }
    if (friendsData[friendId]) {
      friendsData[friendId] = friendsData[friendId].filter((id) => id !== userId);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.friendsKey, JSON.stringify(friendsData));
    }
  }

  /**
   * Retrieves pending incoming friend requests for a specific user.
   *
   * Algorithmic Complexity:
   * - Time Complexity: O(R) where R is total stored requests.
   * - Auxiliary Space Complexity: O(R) filtered array.
   *
   * Growth Rate:
   * - O(R) linear.
   */
  public getPendingIncomingRequests(userId: string): MockFriendRequest[] {
    const reqs = this.getRequests();
    return reqs.filter((r) => r.toUserId === userId && r.status === 'pending');
  }
}

export const mockBackend = new MockBackend();
