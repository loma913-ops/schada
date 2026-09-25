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
  private usersKey = 'schada_mock_users';
  private currentUserIdKey = 'schada_mock_current_user_id';
  private requestsKey = 'schada_mock_friend_requests';
  private friendsKey = 'schada_mock_friends'; // map of userId -> friendIds[]

  constructor() {
    this.seedDefaultUsers();
  }

  private seedDefaultUsers() {
    const existing = localStorage.getItem(this.usersKey);
    if (!existing) {
      const defaultUsers: Record<string, UserProfile> = {
        'mock-grandmaster': {
          id: 'mock-grandmaster',
          email: 'gm@schada.org',
          username: 'SchadaGrandmaster',
          usernameLower: 'schadagrandmaster',
          usernameChangeCount: 0,
          eloRating: 1650,
          gamesPlayed: 48,
          gamesWon: 36,
          gamesLost: 8,
          gamesDrawn: 4,
          status: 'offline',
          createdAt: new Date().toISOString(),
        },
        'mock-tactician': {
          id: 'mock-tactician',
          email: 'tactics@schada.org',
          username: 'Boogerd1936',
          usernameLower: 'boogerd1936',
          usernameChangeCount: 0,
          eloRating: 1420,
          gamesPlayed: 25,
          gamesWon: 16,
          gamesLost: 7,
          gamesDrawn: 2,
          status: 'offline',
          createdAt: new Date().toISOString(),
        },
        'mock-learner': {
          id: 'mock-learner',
          email: 'novice@schada.org',
          username: 'BoardMaster',
          usernameLower: 'boardmaster',
          usernameChangeCount: 1,
          eloRating: 1220,
          gamesPlayed: 10,
          gamesWon: 5,
          gamesLost: 4,
          gamesDrawn: 1,
          status: 'offline',
          createdAt: new Date().toISOString(),
        },
      };
      localStorage.setItem(this.usersKey, JSON.stringify(defaultUsers));
    } else {
      // Sanitize existing cached users so offline accounts are not erroneously marked online
      try {
        const users: Record<string, UserProfile> = JSON.parse(existing);
        const currentUid = localStorage.getItem(this.currentUserIdKey);
        let changed = false;
        for (const [uid, u] of Object.entries(users)) {
          if ((!currentUid || uid !== currentUid) && u.status === 'online') {
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

  private getUsers(): Record<string, UserProfile> {
    return JSON.parse(localStorage.getItem(this.usersKey) || '{}');
  }

  private saveUsers(users: Record<string, UserProfile>) {
    localStorage.setItem(this.usersKey, JSON.stringify(users));
  }

  public getCurrentUser(): UserProfile | null {
    const uid = localStorage.getItem(this.currentUserIdKey);
    if (!uid) return null;
    const users = this.getUsers();
    return users[uid] || null;
  }

  public register(email: string, _password: string, username: string): UserProfile {
    const users = this.getUsers();
    const usernameLower = username.toLowerCase().trim();

    // Check if username already taken
    const exists = Object.values(users).some((u) => u.usernameLower === usernameLower);
    if (exists) {
      throw new Error(`Username "${username}" is already taken.`);
    }

    const uid = `user_${Date.now()}`;
    const newUser: UserProfile = {
      id: uid,
      email,
      username: username.trim(),
      usernameLower,
      usernameChangeCount: 0,
      eloRating: 1200,
      gamesPlayed: 0,
      gamesWon: 0,
      gamesLost: 0,
      gamesDrawn: 0,
      status: 'online',
      createdAt: new Date().toISOString(),
    };

    users[uid] = newUser;
    this.saveUsers(users);
    localStorage.setItem(this.currentUserIdKey, uid);
    return newUser;
  }

  public login(email: string, _password: string): UserProfile {
    const users = this.getUsers();
    const user = Object.values(users).find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      throw new Error('No user found with this email. Please check your credentials or register.');
    }

    user.status = 'online';
    users[user.id] = user;
    this.saveUsers(users);

    localStorage.setItem(this.currentUserIdKey, user.id);
    return user;
  }

  public logout() {
    const currentId = localStorage.getItem(this.currentUserIdKey);
    if (currentId) {
      const users = this.getUsers();
      if (users[currentId]) {
        users[currentId].status = 'offline';
        this.saveUsers(users);
      }
    }
    localStorage.removeItem(this.currentUserIdKey);
  }

  public getOnlineRegisteredUsersCount(): number {
    const currentUid = localStorage.getItem(this.currentUserIdKey);
    if (!currentUid) {
      return 0;
    }
    const users = this.getUsers();
    const user = users[currentUid];
    return user && (user.status === 'online' || user.status === 'in-game') ? 1 : 0;
  }

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

  public updateStats(userId: string, won: boolean, isDraw: boolean, eloDelta: number) {
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

  public findUserByExactUsername(username: string): UserProfile | null {
    const users = this.getUsers();
    const target = username.toLowerCase().trim();
    return Object.values(users).find((u) => u.usernameLower === target) || null;
  }

  public getLeaderboard(): UserProfile[] {
    const users = this.getUsers();
    return Object.values(users).sort((a, b) => b.eloRating - a.eloRating);
  }

  // Friend Requests
  private getRequests(): MockFriendRequest[] {
    return JSON.parse(localStorage.getItem(this.requestsKey) || '[]');
  }

  private saveRequests(reqs: MockFriendRequest[]) {
    localStorage.setItem(this.requestsKey, JSON.stringify(reqs));
  }

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

  public respondToFriendRequest(requestId: string, accept: boolean) {
    const reqs = this.getRequests();
    const req = reqs.find((r) => r.id === requestId);
    if (!req) return;

    req.status = accept ? 'accepted' : 'declined';
    this.saveRequests(reqs);

    if (accept) {
      // Add each other as friends
      const friendsData: Record<string, string[]> = JSON.parse(
        localStorage.getItem(this.friendsKey) || '{}'
      );
      if (!friendsData[req.fromUserId]) friendsData[req.fromUserId] = [];
      if (!friendsData[req.toUserId]) friendsData[req.toUserId] = [];

      if (!friendsData[req.fromUserId].includes(req.toUserId)) {
        friendsData[req.fromUserId].push(req.toUserId);
      }
      if (!friendsData[req.toUserId].includes(req.fromUserId)) {
        friendsData[req.toUserId].push(req.fromUserId);
      }
      localStorage.setItem(this.friendsKey, JSON.stringify(friendsData));
    }
  }

  public getFriends(userId: string): UserProfile[] {
    const friendsData: Record<string, string[]> = JSON.parse(
      localStorage.getItem(this.friendsKey) || '{}'
    );
    const friendIds = friendsData[userId] || [];
    const users = this.getUsers();
    return friendIds.map((fid) => users[fid]).filter(Boolean);
  }

  public removeFriend(userId: string, friendId: string) {
    const friendsData: Record<string, string[]> = JSON.parse(
      localStorage.getItem(this.friendsKey) || '{}'
    );
    if (friendsData[userId]) {
      friendsData[userId] = friendsData[userId].filter((id) => id !== friendId);
    }
    if (friendsData[friendId]) {
      friendsData[friendId] = friendsData[friendId].filter((id) => id !== userId);
    }
    localStorage.setItem(this.friendsKey, JSON.stringify(friendsData));
  }

  public getPendingIncomingRequests(userId: string): MockFriendRequest[] {
    const reqs = this.getRequests();
    return reqs.filter((r) => r.toUserId === userId && r.status === 'pending');
  }
}

export const mockBackend = new MockBackend();
