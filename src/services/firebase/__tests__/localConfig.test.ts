import { describe, it, expect } from 'vitest';
import {
  LOCAL_CONFIG,
  LocalConfigError,
  validateLocalConfig,
  type LocalConfig,
} from '../localConfig';

describe('localConfig', () => {
  it('validates canonical configuration successfully', () => {
    expect(() => validateLocalConfig(LOCAL_CONFIG)).not.toThrow();
    expect(LOCAL_CONFIG.storageKeys.users).toBe('schada_mock_users');
    expect(LOCAL_CONFIG.events.userStatusChanged).toBe('schada_user_status_changed');
    expect(LOCAL_CONFIG.events.profileUpdated).toBe('schada_profile_updated');
    expect(LOCAL_CONFIG.events.gameSyncChannel).toBe('schada_game_sync_channel');
    expect(Object.keys(LOCAL_CONFIG.defaultUsers).length).toBe(4);
  });

  it('throws when config is null or undefined', () => {
    expect(() => validateLocalConfig(null as unknown as LocalConfig)).toThrow(LocalConfigError);
    expect(() => validateLocalConfig(undefined as unknown as LocalConfig)).toThrow(
      'Configuration object is missing or null.'
    );
  });

  it('throws on invalid storageKeys', () => {
    expect(() =>
      validateLocalConfig({
        ...LOCAL_CONFIG,
        storageKeys: null as unknown as LocalConfig['storageKeys'],
      })
    ).toThrow('Invalid storageKeys: expected configuration object.');

    expect(() =>
      validateLocalConfig({
        ...LOCAL_CONFIG,
        storageKeys: {
          ...LOCAL_CONFIG.storageKeys,
          users: '',
        },
      })
    ).toThrow('Invalid storageKeys.users: expected non-empty string.');
  });

  it('throws on invalid events', () => {
    expect(() =>
      validateLocalConfig({
        ...LOCAL_CONFIG,
        events: null as unknown as LocalConfig['events'],
      })
    ).toThrow('Invalid events: expected configuration object.');

    expect(() =>
      validateLocalConfig({
        ...LOCAL_CONFIG,
        events: {
          ...LOCAL_CONFIG.events,
          userStatusChanged: '   ',
        },
      })
    ).toThrow('Invalid events.userStatusChanged: expected non-empty string.');

    expect(() =>
      validateLocalConfig({
        ...LOCAL_CONFIG,
        events: {
          ...LOCAL_CONFIG.events,
          profileUpdated: '',
        },
      })
    ).toThrow('Invalid events.profileUpdated: expected non-empty string.');

    expect(() =>
      validateLocalConfig({
        ...LOCAL_CONFIG,
        events: {
          ...LOCAL_CONFIG.events,
          gameSyncChannel: '   ',
        },
      })
    ).toThrow('Invalid events.gameSyncChannel: expected non-empty string.');
  });

  it('throws on invalid defaultUsers', () => {
    expect(() =>
      validateLocalConfig({
        ...LOCAL_CONFIG,
        defaultUsers: null as unknown as LocalConfig['defaultUsers'],
      })
    ).toThrow('Invalid defaultUsers: expected configuration object.');

    expect(() =>
      validateLocalConfig({
        ...LOCAL_CONFIG,
        defaultUsers: {
          'mock-invalid': {
            id: 'mismatched-id',
            username: 'Test',
            eloRating: 1000,
          } as unknown as LocalConfig['defaultUsers'][string],
        },
      })
    ).toThrow('Invalid defaultUsers entry for "mock-invalid": malformed UserProfile.');
  });

  it('correctly configures default patron user mock-grandmaster', () => {
    const gm = LOCAL_CONFIG.defaultUsers['mock-grandmaster'];
    expect(gm.isPatron).toBe(true);
    expect(gm.hasDonated).toBe(true);
  });
});

