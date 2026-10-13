import { describe, it, expect } from 'vitest';
import {
  SECURITY_CONFIG,
  SecurityConfigError,
  validateSecurityConfig,
  type SecurityConfig,
} from '../securityConfig';

describe('Security Configuration and Validator', () => {
  it('validates canonical SECURITY_CONFIG successfully', () => {
    expect(() => validateSecurityConfig(SECURITY_CONFIG)).not.toThrow();
  });

  it('verifies canonical parameters meet security baselines', () => {
    expect(SECURITY_CONFIG.minUsernameLength).toBe(3);
    expect(SECURITY_CONFIG.maxUsernameLength).toBe(20);
    expect(SECURITY_CONFIG.maxUsernameChanges).toBe(1);
    expect(SECURITY_CONFIG.maxSingleGameEloDelta).toBe(64);
    expect(SECURITY_CONFIG.startingEloRating).toBe(1200);
    expect(SECURITY_CONFIG.maxGuestSessionIdLength).toBe(64);
    expect(SECURITY_CONFIG.guestSessionAllowedKeys).toContain('lastSeen');
    expect(SECURITY_CONFIG.guestSessionAllowedKeys).toContain('updatedAt');
    expect(SECURITY_CONFIG.mutableUserKeys).toContain('username');
    expect(SECURITY_CONFIG.mutableUserKeys).toContain('eloRating');
    expect(SECURITY_CONFIG.mutableUserKeys).toContain('email');
    expect(SECURITY_CONFIG.immutableGameKeys).toContain('id');
    expect(SECURITY_CONFIG.immutableGameKeys).toContain('createdAt');
    expect(SECURITY_CONFIG.immutableGameKeys).toContain('isRanked');
  });

  it('throws SecurityConfigError if configuration object is null or undefined', () => {
    expect(() => validateSecurityConfig(null as unknown as SecurityConfig)).toThrow(SecurityConfigError);
    expect(() => validateSecurityConfig(undefined as unknown as SecurityConfig)).toThrow(SecurityConfigError);
  });

  it('throws SecurityConfigError for invalid minUsernameLength', () => {
    const invalid = { ...SECURITY_CONFIG, minUsernameLength: 0 };
    expect(() => validateSecurityConfig(invalid)).toThrow(SecurityConfigError);
  });

  it('throws SecurityConfigError if maxUsernameLength is less than minUsernameLength', () => {
    const invalid = { ...SECURITY_CONFIG, maxUsernameLength: 2 };
    expect(() => validateSecurityConfig(invalid)).toThrow(SecurityConfigError);
  });

  it('throws SecurityConfigError for invalid maxUsernameChanges', () => {
    const invalid = { ...SECURITY_CONFIG, maxUsernameChanges: -1 };
    expect(() => validateSecurityConfig(invalid)).toThrow(SecurityConfigError);
  });

  it('throws SecurityConfigError for invalid maxSingleGameEloDelta', () => {
    const invalid = { ...SECURITY_CONFIG, maxSingleGameEloDelta: 0 };
    expect(() => validateSecurityConfig(invalid)).toThrow(SecurityConfigError);
  });

  it('throws SecurityConfigError for invalid startingEloRating', () => {
    const invalid = { ...SECURITY_CONFIG, startingEloRating: -100 };
    expect(() => validateSecurityConfig(invalid)).toThrow(SecurityConfigError);
  });

  it('throws SecurityConfigError for invalid maxGuestSessionIdLength', () => {
    const invalid = { ...SECURITY_CONFIG, maxGuestSessionIdLength: 0 };
    expect(() => validateSecurityConfig(invalid)).toThrow(SecurityConfigError);
  });

  it('throws SecurityConfigError for invalid array whitelists', () => {
    const invalidGuest = { ...SECURITY_CONFIG, guestSessionAllowedKeys: [] };
    expect(() => validateSecurityConfig(invalidGuest)).toThrow(SecurityConfigError);

    const invalidUser = { ...SECURITY_CONFIG, mutableUserKeys: [] };
    expect(() => validateSecurityConfig(invalidUser)).toThrow(SecurityConfigError);

    const invalidGame = { ...SECURITY_CONFIG, immutableGameKeys: [] };
    expect(() => validateSecurityConfig(invalidGame)).toThrow(SecurityConfigError);
  });

  it('throws SecurityConfigError for invalid gameIdLength', () => {
    const invalidZero = { ...SECURITY_CONFIG, gameIdLength: 0 };
    expect(() => validateSecurityConfig(invalidZero)).toThrow(SecurityConfigError);

    const invalidNegative = { ...SECURITY_CONFIG, gameIdLength: -5 };
    expect(() => validateSecurityConfig(invalidNegative)).toThrow(SecurityConfigError);

    const invalidFloat = { ...SECURITY_CONFIG, gameIdLength: 9.5 };
    expect(() => validateSecurityConfig(invalidFloat)).toThrow(SecurityConfigError);
  });

  it('throws SecurityConfigError for invalid gameIdCharset', () => {
    const invalidEmpty = { ...SECURITY_CONFIG, gameIdCharset: '' };
    expect(() => validateSecurityConfig(invalidEmpty)).toThrow(SecurityConfigError);

    const invalidDuplicateChars = { ...SECURITY_CONFIG, gameIdCharset: 'aab' };
    expect(() => validateSecurityConfig(invalidDuplicateChars)).toThrow(SecurityConfigError);
  });

  it('throws SecurityConfigError for invalid gameIdRegexPattern', () => {
    const invalidEmpty = { ...SECURITY_CONFIG, gameIdRegexPattern: '' };
    expect(() => validateSecurityConfig(invalidEmpty)).toThrow(SecurityConfigError);

    const invalidRegex = { ...SECURITY_CONFIG, gameIdRegexPattern: '[a-z' };
    expect(() => validateSecurityConfig(invalidRegex)).toThrow(SecurityConfigError);
  });

  it('throws SecurityConfigError for invalid maxGameIdCreationRetries', () => {
    const invalidZero = { ...SECURITY_CONFIG, maxGameIdCreationRetries: 0 };
    expect(() => validateSecurityConfig(invalidZero)).toThrow(SecurityConfigError);

    const invalidNegative = { ...SECURITY_CONFIG, maxGameIdCreationRetries: -1 };
    expect(() => validateSecurityConfig(invalidNegative)).toThrow(SecurityConfigError);
  });

  it('throws SecurityConfigError for invalid invalidGameIdErrorMessage', () => {
    const invalidEmpty = { ...SECURITY_CONFIG, invalidGameIdErrorMessage: '' };
    expect(() => validateSecurityConfig(invalidEmpty)).toThrow(SecurityConfigError);

    const invalidWhitespace = { ...SECURITY_CONFIG, invalidGameIdErrorMessage: '   ' };
    expect(() => validateSecurityConfig(invalidWhitespace)).toThrow(SecurityConfigError);
  });

  it('throws SecurityConfigError for invalid toastNotificationDurationMs', () => {
    const invalidZero = { ...SECURITY_CONFIG, toastNotificationDurationMs: 0 };
    expect(() => validateSecurityConfig(invalidZero)).toThrow(SecurityConfigError);

    const invalidNegative = { ...SECURITY_CONFIG, toastNotificationDurationMs: -100 };
    expect(() => validateSecurityConfig(invalidNegative)).toThrow(SecurityConfigError);

    const invalidFloat = { ...SECURITY_CONFIG, toastNotificationDurationMs: 4000.5 };
    expect(() => validateSecurityConfig(invalidFloat)).toThrow(SecurityConfigError);
  });
});
