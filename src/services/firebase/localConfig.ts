/**
 * Local Backend Configuration and Validator.
 *
 * Centralizes all storage keys, default mock user profiles, and event names
 * for the offline/guest local Firebase provider.
 * Validates configuration to eliminate hard-coded fallback values.
 */

import type { UserProfile } from './localProvider';

export class LocalConfigError extends Error {
  constructor(message: string) {
    super(`LocalConfigError: ${message}`);
    this.name = 'LocalConfigError';
  }
}


export interface LocalStorageKeys {
  readonly users: string;
  readonly currentUserId: string;
  readonly friendRequests: string;
  readonly friends: string;
}


export interface LocalEvents {
  readonly userStatusChanged: string;
  readonly profileUpdated: string;
  readonly gameSyncChannel: string;
}


export interface LocalConfig {
  readonly storageKeys: LocalStorageKeys;
  readonly events: LocalEvents;
  readonly defaultUsers: Record<string, UserProfile>;
}


/**
 * Validates the LocalConfig.
 * Throws LocalConfigError if configuration is missing, null, or contains invalid parameters.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(U) where U is the number of default mock users.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(U) linear with respect to default user count.
 */
export function validateLocalConfig(config: LocalConfig): void {
  if (!config) {
    throw new LocalConfigError('Configuration object is missing or null.');
  }

  if (!config.storageKeys || typeof config.storageKeys !== 'object') {
    throw new LocalConfigError('Invalid storageKeys: expected configuration object.');
  }

  const { users, currentUserId, friendRequests, friends } = config.storageKeys;
  for (const [keyName, val] of Object.entries({ users, currentUserId, friendRequests, friends })) {
    if (typeof val !== 'string' || val.trim().length === 0) {
      throw new LocalConfigError(`Invalid storageKeys.${keyName}: expected non-empty string.`);
    }
  }

  if (!config.events || typeof config.events !== 'object') {
    throw new LocalConfigError('Invalid events: expected configuration object.');
  }

  if (typeof config.events.userStatusChanged !== 'string' || config.events.userStatusChanged.trim().length === 0) {
    throw new LocalConfigError('Invalid events.userStatusChanged: expected non-empty string.');
  }

  if (typeof config.events.profileUpdated !== 'string' || config.events.profileUpdated.trim().length === 0) {
    throw new LocalConfigError('Invalid events.profileUpdated: expected non-empty string.');
  }

  if (typeof config.events.gameSyncChannel !== 'string' || config.events.gameSyncChannel.trim().length === 0) {
    throw new LocalConfigError('Invalid events.gameSyncChannel: expected non-empty string.');
  }

  if (!config.defaultUsers || typeof config.defaultUsers !== 'object') {
    throw new LocalConfigError('Invalid defaultUsers: expected configuration object.');
  }

  for (const [id, user] of Object.entries(config.defaultUsers)) {
    if (!user || user.id !== id || typeof user.username !== 'string' || !user.perModeStats || typeof user.perModeStats !== 'object') {
      throw new LocalConfigError(`Invalid defaultUsers entry for "${id}": malformed UserProfile.`);
    }
    for (const mode of ['bullet', 'blitz', 'rapid', 'classical', 'correspondence'] as const) {
      const ms = user.perModeStats[mode];
      if (!ms || typeof ms.elo !== 'number' || typeof ms.gamesPlayed !== 'number') {
        throw new LocalConfigError(`Invalid defaultUsers entry for "${id}": malformed perModeStats.${mode}.`);
      }
    }
  }
}


export const LOCAL_CONFIG: LocalConfig = Object.freeze({
  storageKeys: Object.freeze({
    users: 'schada_mock_users',
    currentUserId: 'schada_mock_current_user_id',
    friendRequests: 'schada_mock_friend_requests',
    friends: 'schada_mock_friends',
  }),
  events: Object.freeze({
    userStatusChanged: 'schada_user_status_changed',
    profileUpdated: 'schada_profile_updated',
    gameSyncChannel: 'schada_game_sync_channel',
  }),
  defaultUsers: Object.freeze({
    'mock-grandmaster': Object.freeze({
      id: 'mock-grandmaster',
      email: 'gm@schada.org',
      username: 'SchadaGrandmaster',
      usernameLower: 'schadagrandmaster',
      usernameChangeCount: 0,
      perModeStats: Object.freeze({
        bullet: Object.freeze({ elo: 1620, gamesPlayed: 10, gamesWon: 7, gamesLost: 2, gamesDrawn: 1 }),
        blitz: Object.freeze({ elo: 1650, gamesPlayed: 20, gamesWon: 16, gamesLost: 3, gamesDrawn: 1 }),
        rapid: Object.freeze({ elo: 1680, gamesPlayed: 12, gamesWon: 9, gamesLost: 2, gamesDrawn: 1 }),
        classical: Object.freeze({ elo: 1700, gamesPlayed: 4, gamesWon: 3, gamesLost: 0, gamesDrawn: 1 }),
        correspondence: Object.freeze({ elo: 1600, gamesPlayed: 2, gamesWon: 1, gamesLost: 1, gamesDrawn: 0 }),
      }),
      status: 'offline' as const,
      isPatron: true,
      hasDonated: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    }),
    'mock-tactician': Object.freeze({
      id: 'mock-tactician',
      email: 'tactics@schada.org',
      username: 'Boogerd1936',
      usernameLower: 'boogerd1936',
      usernameChangeCount: 0,
      perModeStats: Object.freeze({
        bullet: Object.freeze({ elo: 1400, gamesPlayed: 5, gamesWon: 3, gamesLost: 2, gamesDrawn: 0 }),
        blitz: Object.freeze({ elo: 1420, gamesPlayed: 12, gamesWon: 8, gamesLost: 3, gamesDrawn: 1 }),
        rapid: Object.freeze({ elo: 1450, gamesPlayed: 6, gamesWon: 4, gamesLost: 1, gamesDrawn: 1 }),
        classical: Object.freeze({ elo: 1460, gamesPlayed: 2, gamesWon: 1, gamesLost: 1, gamesDrawn: 0 }),
        correspondence: Object.freeze({ elo: 1400, gamesPlayed: 0, gamesWon: 0, gamesLost: 0, gamesDrawn: 0 }),
      }),
      status: 'offline' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
    }),
    'mock-learner': Object.freeze({
      id: 'mock-learner',
      email: 'novice@schada.org',
      username: 'BoardMaster',
      usernameLower: 'boardmaster',
      usernameChangeCount: 1,
      perModeStats: Object.freeze({
        bullet: Object.freeze({ elo: 1200, gamesPlayed: 2, gamesWon: 1, gamesLost: 1, gamesDrawn: 0 }),
        blitz: Object.freeze({ elo: 1220, gamesPlayed: 5, gamesWon: 3, gamesLost: 2, gamesDrawn: 0 }),
        rapid: Object.freeze({ elo: 1240, gamesPlayed: 2, gamesWon: 1, gamesLost: 1, gamesDrawn: 0 }),
        classical: Object.freeze({ elo: 1200, gamesPlayed: 1, gamesWon: 0, gamesLost: 0, gamesDrawn: 1 }),
        correspondence: Object.freeze({ elo: 1200, gamesPlayed: 0, gamesWon: 0, gamesLost: 0, gamesDrawn: 0 }),
      }),
      status: 'offline' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
    }),
    'mock-owner': Object.freeze({
      id: 'mock-owner',
      email: 'loma913@gmail.com',
      username: 'mutagenicpixels',
      usernameLower: 'mutagenicpixels',
      usernameChangeCount: 0,
      perModeStats: Object.freeze({
        bullet: Object.freeze({ elo: 1200, gamesPlayed: 0, gamesWon: 0, gamesLost: 0, gamesDrawn: 0 }),
        blitz: Object.freeze({ elo: 1200, gamesPlayed: 0, gamesWon: 0, gamesLost: 0, gamesDrawn: 0 }),
        rapid: Object.freeze({ elo: 1200, gamesPlayed: 0, gamesWon: 0, gamesLost: 0, gamesDrawn: 0 }),
        classical: Object.freeze({ elo: 1200, gamesPlayed: 0, gamesWon: 0, gamesLost: 0, gamesDrawn: 0 }),
        correspondence: Object.freeze({ elo: 1200, gamesPlayed: 0, gamesWon: 0, gamesLost: 0, gamesDrawn: 0 }),
      }),
      status: 'offline' as const,
      isPatron: true,
      hasDonated: true,
      patronTier: 'lifetime' as const,
      patronExpiresAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    }),
  }),
});

// Immediately validate local configuration at module load time
validateLocalConfig(LOCAL_CONFIG);
