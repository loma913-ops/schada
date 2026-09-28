/**
 * Mock Backend Configuration and Validator.
 *
 * Centralizes all storage keys, default mock user profiles, and event names
 * for the offline/mock Firebase provider.
 * Validates configuration to eliminate hard-coded fallback values.
 */

import type { UserProfile } from './localProvider';

export class MockConfigError extends Error {
  constructor(message: string) {
    super(`MockConfigError: ${message}`);
    this.name = 'MockConfigError';
  }
}

export interface MockStorageKeys {
  readonly users: string;
  readonly currentUserId: string;
  readonly friendRequests: string;
  readonly friends: string;
}

export interface MockEvents {
  readonly userStatusChanged: string;
}

export interface MockConfig {
  readonly storageKeys: MockStorageKeys;
  readonly events: MockEvents;
  readonly defaultUsers: Record<string, UserProfile>;
}

/**
 * Validates the MockConfig.
 * Throws MockConfigError if configuration is missing, null, or contains invalid parameters.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(U) where U is the number of default mock users.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(U) linear with respect to default user count.
 */
export function validateMockConfig(config: MockConfig): void {
  if (!config) {
    throw new MockConfigError('Configuration object is missing or null.');
  }

  if (!config.storageKeys || typeof config.storageKeys !== 'object') {
    throw new MockConfigError('Invalid storageKeys: expected configuration object.');
  }

  const { users, currentUserId, friendRequests, friends } = config.storageKeys;
  for (const [keyName, val] of Object.entries({ users, currentUserId, friendRequests, friends })) {
    if (typeof val !== 'string' || val.trim().length === 0) {
      throw new MockConfigError(`Invalid storageKeys.${keyName}: expected non-empty string.`);
    }
  }

  if (!config.events || typeof config.events !== 'object') {
    throw new MockConfigError('Invalid events: expected configuration object.');
  }

  if (typeof config.events.userStatusChanged !== 'string' || config.events.userStatusChanged.trim().length === 0) {
    throw new MockConfigError('Invalid events.userStatusChanged: expected non-empty string.');
  }

  if (!config.defaultUsers || typeof config.defaultUsers !== 'object') {
    throw new MockConfigError('Invalid defaultUsers: expected configuration object.');
  }

  for (const [id, user] of Object.entries(config.defaultUsers)) {
    if (!user || user.id !== id || typeof user.username !== 'string' || typeof user.eloRating !== 'number') {
      throw new MockConfigError(`Invalid defaultUsers entry for "${id}": malformed UserProfile.`);
    }
  }
}

export const MOCK_CONFIG: MockConfig = Object.freeze({
  storageKeys: Object.freeze({
    users: 'schada_mock_users',
    currentUserId: 'schada_mock_current_user_id',
    friendRequests: 'schada_mock_friend_requests',
    friends: 'schada_mock_friends',
  }),
  events: Object.freeze({
    userStatusChanged: 'schada_user_status_changed',
  }),
  defaultUsers: Object.freeze({
    'mock-grandmaster': Object.freeze({
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
      status: 'offline' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
    }),
    'mock-tactician': Object.freeze({
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
      status: 'offline' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
    }),
    'mock-learner': Object.freeze({
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
      status: 'offline' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
    }),
  }),
});

// Immediately validate mock configuration at module load time
validateMockConfig(MOCK_CONFIG);
