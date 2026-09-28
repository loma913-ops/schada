import { describe, it, expect } from 'vitest';
import {
  MOCK_CONFIG,
  MockConfigError,
  validateMockConfig,
  type MockConfig,
} from '../mockConfig';

describe('mockConfig', () => {
  it('validates canonical configuration successfully', () => {
    expect(() => validateMockConfig(MOCK_CONFIG)).not.toThrow();
    expect(MOCK_CONFIG.storageKeys.users).toBe('schada_mock_users');
    expect(MOCK_CONFIG.events.userStatusChanged).toBe('schada_user_status_changed');
    expect(Object.keys(MOCK_CONFIG.defaultUsers).length).toBe(3);
  });

  it('throws when config is null or undefined', () => {
    expect(() => validateMockConfig(null as unknown as MockConfig)).toThrow(MockConfigError);
    expect(() => validateMockConfig(undefined as unknown as MockConfig)).toThrow(
      'Configuration object is missing or null.'
    );
  });

  it('throws on invalid storageKeys', () => {
    expect(() =>
      validateMockConfig({
        ...MOCK_CONFIG,
        storageKeys: null as unknown as MockConfig['storageKeys'],
      })
    ).toThrow('Invalid storageKeys: expected configuration object.');

    expect(() =>
      validateMockConfig({
        ...MOCK_CONFIG,
        storageKeys: {
          ...MOCK_CONFIG.storageKeys,
          users: '',
        },
      })
    ).toThrow('Invalid storageKeys.users: expected non-empty string.');
  });

  it('throws on invalid events', () => {
    expect(() =>
      validateMockConfig({
        ...MOCK_CONFIG,
        events: null as unknown as MockConfig['events'],
      })
    ).toThrow('Invalid events: expected configuration object.');

    expect(() =>
      validateMockConfig({
        ...MOCK_CONFIG,
        events: {
          userStatusChanged: '   ',
        },
      })
    ).toThrow('Invalid events.userStatusChanged: expected non-empty string.');
  });

  it('throws on invalid defaultUsers', () => {
    expect(() =>
      validateMockConfig({
        ...MOCK_CONFIG,
        defaultUsers: null as unknown as MockConfig['defaultUsers'],
      })
    ).toThrow('Invalid defaultUsers: expected configuration object.');

    expect(() =>
      validateMockConfig({
        ...MOCK_CONFIG,
        defaultUsers: {
          'mock-invalid': {
            id: 'mismatched-id',
            username: 'Test',
            eloRating: 1000,
          } as unknown as MockConfig['defaultUsers'][string],
        },
      })
    ).toThrow('Invalid defaultUsers entry for "mock-invalid": malformed UserProfile.');
  });
});
