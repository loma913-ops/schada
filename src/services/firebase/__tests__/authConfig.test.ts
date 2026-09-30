import { describe, it, expect } from 'vitest';
import { AUTH_CONFIG, validateAuthConfig, AuthConfigError } from '../authConfig';

describe('authConfig', () => {
  it('validates canonical AUTH_CONFIG without throwing', () => {
    expect(() => validateAuthConfig(AUTH_CONFIG)).not.toThrow();
    expect(AUTH_CONFIG.minUsernameLength).toBe(3);
    expect(AUTH_CONFIG.maxUsernameLength).toBe(20);
    expect(AUTH_CONFIG.usernameRegex.test('valid_User1')).toBe(true);
    expect(AUTH_CONFIG.usernameRegex.test('invalid user!')).toBe(false);
  });

  it('throws on null or undefined config', () => {
    expect(() => validateAuthConfig(null as any)).toThrow(AuthConfigError);
    expect(() => validateAuthConfig(undefined as any)).toThrow('Configuration object is missing or null.');
  });

  it('throws on invalid min or max username length', () => {
    const invalidMin = { ...AUTH_CONFIG, minUsernameLength: 0 };
    expect(() => validateAuthConfig(invalidMin)).toThrow('Invalid minUsernameLength');

    const invalidMax = { ...AUTH_CONFIG, minUsernameLength: 10, maxUsernameLength: 5 };
    expect(() => validateAuthConfig(invalidMax)).toThrow('Invalid maxUsernameLength');
  });

  it('throws on invalid regex pattern', () => {
    const invalidRegex = { ...AUTH_CONFIG, usernameRegex: 'not-a-regex' as any };
    expect(() => validateAuthConfig(invalidRegex)).toThrow('Invalid usernameRegex');
  });
});
