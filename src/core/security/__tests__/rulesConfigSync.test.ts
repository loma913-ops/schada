import { describe, it, expect } from 'vitest';
import rulesContent from '../../../../firestore.rules?raw';
import indexesConfig from '../../../../firestore.indexes.json';
import { ELO_CONFIG } from '@/core/elo/eloConfig';
import { AUTH_CONFIG } from '@/services/firebase/authConfig';
import { MULTIPLAYER_SCALE_CONFIG } from '@/services/firebase/multiplayerConfig';
import { SECURITY_CONFIG } from '../securityConfig';

interface FirestoreFieldOverrideIndex {
  readonly order?: string;
  readonly queryScope?: string;
}

interface FirestoreFieldOverride {
  readonly collectionGroup?: string;
  readonly fieldPath?: string;
  readonly ttl?: boolean;
  readonly indexes?: readonly FirestoreFieldOverrideIndex[];
}

describe('Firestore Rules ↔ TypeScript Configuration Synchronization', () => {
  it('synchronizes starting Elo rating between rules and SECURITY_CONFIG / ELO_CONFIG', () => {
    const expectedStartingElo = SECURITY_CONFIG.startingEloRating;
    expect(rulesContent).toContain(`stats.elo == ${expectedStartingElo}`);
    expect(expectedStartingElo).toBe(ELO_CONFIG.defaultStartingRating);
    expect(expectedStartingElo).toBe(MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultStartingRating);
  });

  it('synchronizes username length constraints between rules, AUTH_CONFIG, and SECURITY_CONFIG', () => {
    expect(rulesContent).toContain(`usernameLower.size() >= ${SECURITY_CONFIG.minUsernameLength}`);
    expect(rulesContent).toContain(`usernameLower.size() <= ${SECURITY_CONFIG.maxUsernameLength}`);
    expect(SECURITY_CONFIG.minUsernameLength).toBe(AUTH_CONFIG.minUsernameLength);
    expect(SECURITY_CONFIG.maxUsernameLength).toBe(AUTH_CONFIG.maxUsernameLength);
  });

  it('guarantees maximum single-game Elo delta in rules matches SECURITY_CONFIG and exceeds provisional K-factor', () => {
    expect(rulesContent).toContain(`request.resource.data.perModeStats[mode].elo <= resource.data.perModeStats[mode].elo + ${SECURITY_CONFIG.maxSingleGameEloDelta}`);
    expect(rulesContent).toContain(`request.resource.data.perModeStats[mode].elo >= resource.data.perModeStats[mode].elo - ${SECURITY_CONFIG.maxSingleGameEloDelta}`);
    expect(SECURITY_CONFIG.maxSingleGameEloDelta).toBeGreaterThanOrEqual(ELO_CONFIG.provisionalKFactor);
  });

  it('synchronizes maximum lifetime username changes permitted', () => {
    expect(rulesContent).toContain(`request.resource.data.usernameChangeCount == ${SECURITY_CONFIG.maxUsernameChanges}`);
  });

  it('restricts platform-wide aggregate stats write operations to false', () => {
    expect(rulesContent).toMatch(/match \/stats\/\{statId\}\s*\{\s*allow read: if true;\s*allow write: if false;\s*\}/);
  });

  it('enforces schema key bounds and size limit on guest_sessions collection matching SECURITY_CONFIG', () => {
    const expectedKeysString = `['${SECURITY_CONFIG.guestSessionAllowedKeys.join("', '")}']`;
    expect(rulesContent).toContain(`request.resource.data.keys().hasOnly(${expectedKeysString})`);
    expect(rulesContent).toContain(`sessionId.size() <= ${SECURITY_CONFIG.maxGuestSessionIdLength}`);
  });

  it('strictly protects immutable match parameters on game updates matching SECURITY_CONFIG', () => {
    SECURITY_CONFIG.immutableGameKeys.forEach((key) => {
      expect(rulesContent).toContain(`request.resource.data.${key} == resource.data.${key}`);
    });
  });

  it('ensures all mutable user profile keys in rules are documented in SECURITY_CONFIG', () => {
    SECURITY_CONFIG.mutableUserKeys.forEach((key) => {
      expect(rulesContent).toContain(`'${key}'`);
    });
  });

  it('enforces canonical game ID length, regex, and immutable ID binding matching SECURITY_CONFIG', () => {
    expect(rulesContent).toContain(`gameId.size() == ${SECURITY_CONFIG.gameIdLength}`);
    expect(rulesContent).toContain(`gameId.matches('${SECURITY_CONFIG.gameIdRegexPattern}')`);
    expect(rulesContent).toContain('request.resource.data.id == gameId');
  });

  it('strictly excludes legacy overall stats fields from allowed user mutations and creation', () => {
    const legacyKeys = ['eloRating', 'gamesPlayed', 'gamesWon', 'gamesLost', 'gamesDrawn'];
    expect(rulesContent).toContain(
      "!request.resource.data.keys().hasAny(['eloRating', 'gamesPlayed', 'gamesWon', 'gamesLost', 'gamesDrawn'])"
    );

    const updateBlockMatch = rulesContent.match(/allow update:[\s\S]*?affectedKeys\(\)\.hasOnly\(\[([\s\S]*?)\]\)/);
    expect(updateBlockMatch).not.toBeNull();
    const updateAllowedKeys = updateBlockMatch ? updateBlockMatch[1] : '';

    legacyKeys.forEach((key) => {
      expect(SECURITY_CONFIG.mutableUserKeys).not.toContain(key);
      expect(updateAllowedKeys).not.toContain(`'${key}'`);
    });
  });

  it('permits user profile deletion strictly to authenticated account owners', () => {
    expect(rulesContent).toContain('allow delete: if isOwner(userId);');
  });

  it('guarantees guest_sessions.lastSeen retains single-field indexes for inequality queries and aggregation', () => {
    const fieldOverrides: readonly FirestoreFieldOverride[] = indexesConfig.fieldOverrides;
    const guestOverride = fieldOverrides.find(
      (override) =>
        override.collectionGroup === MULTIPLAYER_SCALE_CONFIG.collections.guestSessions &&
        override.fieldPath === SECURITY_CONFIG.guestSessionAllowedKeys[0]
    );
    expect(guestOverride).toBeDefined();
    expect(guestOverride?.indexes).toBeDefined();
    expect(guestOverride?.indexes?.length).toBeGreaterThanOrEqual(2);
    expect(guestOverride?.indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ order: 'ASCENDING', queryScope: 'COLLECTION' }),
        expect.objectContaining({ order: 'DESCENDING', queryScope: 'COLLECTION' }),
      ])
    );
  });
});
