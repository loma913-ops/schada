import { describe, it, expect } from 'vitest';
import {
  getCryptoProvider,
  getSecureRandomBytes,
  getSecureRandomString,
  getSecureRandomChoice,
  generateSecureToken,
  generateClientSessionId,
  generateGuestId,
  generateLocalUserId,
  generateFriendRequestId,
} from '../cryptoUtils';
import { SECURITY_CONFIG } from '../securityConfig';

describe('Cryptographic Pseudo-Random Utilities (CSPRNG)', () => {
  it('accesses authoritative Web Crypto API provider', () => {
    const provider = getCryptoProvider();
    expect(provider).toBeDefined();
    expect(typeof provider.getRandomValues).toBe('function');
  });

  describe('getSecureRandomBytes', () => {
    it('generates a Uint8Array of the requested byte length', () => {
      const bytes = getSecureRandomBytes(16);
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBe(16);
    });

    it('generates non-identical byte buffers across invocations', () => {
      const b1 = getSecureRandomBytes(32);
      const b2 = getSecureRandomBytes(32);
      expect(b1).not.toEqual(b2);
    });

    it('throws RangeError for invalid byte lengths', () => {
      expect(() => getSecureRandomBytes(0)).toThrow(RangeError);
      expect(() => getSecureRandomBytes(-5)).toThrow(RangeError);
      expect(() => getSecureRandomBytes(4.5)).toThrow(RangeError);
      expect(() => getSecureRandomBytes(null as unknown as number)).toThrow(RangeError);
    });
  });

  describe('getSecureRandomString', () => {
    it('generates strings matching requested length and default charset', () => {
      const str = getSecureRandomString(24);
      expect(str.length).toBe(24);
      for (const char of str) {
        expect(SECURITY_CONFIG.gameIdCharset).toContain(char);
      }
    });

    it('generates strings matching custom charset strictly', () => {
      const customCharset = 'ABC123';
      const str = getSecureRandomString(30, customCharset);
      expect(str.length).toBe(30);
      for (const char of str) {
        expect(customCharset).toContain(char);
      }
    });

    it('throws RangeError for invalid length, empty charset, duplicate characters, or oversized charset', () => {
      expect(() => getSecureRandomString(0)).toThrow(RangeError);
      expect(() => getSecureRandomString(-10)).toThrow(RangeError);
      expect(() => getSecureRandomString(10, '')).toThrow(RangeError);
      expect(() => getSecureRandomString(10, 'AAB')).toThrow(RangeError);
      const oversized = Array.from({ length: 257 }, (_, i) => String.fromCharCode(i)).join('');
      expect(() => getSecureRandomString(10, oversized)).toThrow(RangeError);
    });
  });

  describe('getSecureRandomChoice', () => {
    it('returns the sole element for single-element array', () => {
      expect(getSecureRandomChoice(['only'])).toBe('only');
    });

    it('selects uniformly among multiple elements without out-of-bounds error', () => {
      const pool = ['blue', 'green'] as const;
      const counts: Record<string, number> = { blue: 0, green: 0 };
      for (let i = 0; i < 100; i++) {
        const choice = getSecureRandomChoice(pool);
        counts[choice]++;
      }
      expect(counts.blue).toBeGreaterThan(0);
      expect(counts.green).toBeGreaterThan(0);
    });

    it('throws RangeError for empty array or oversized array', () => {
      expect(() => getSecureRandomChoice([])).toThrow(RangeError);
      const oversized = Array.from({ length: 257 }, (_, i) => i);
      expect(() => getSecureRandomChoice(oversized)).toThrow(RangeError);
    });
  });

  describe('Domain Identifiers and Tokens', () => {
    it('generates player session token conforming to SECURITY_CONFIG prefix and length', () => {
      const token = generateSecureToken();
      expect(token.startsWith(SECURITY_CONFIG.sessionTokenPrefix)).toBe(true);
      expect(token.length).toBe(
        SECURITY_CONFIG.sessionTokenPrefix.length + SECURITY_CONFIG.sessionTokenRandomLength
      );
    });

    it('generates client session ID conforming to prefix, timestamp, and length', () => {
      const sessionId = generateClientSessionId();
      expect(sessionId.startsWith(SECURITY_CONFIG.sessionIdPrefix)).toBe(true);
      const parts = sessionId.replace(SECURITY_CONFIG.sessionIdPrefix, '').split('_');
      expect(parts.length).toBe(2);
      expect(Number(parts[0])).toBeGreaterThan(0);
      expect(parts[1].length).toBe(SECURITY_CONFIG.sessionIdRandomLength);
    });

    it('generates guest identifier conforming to SECURITY_CONFIG prefix and length', () => {
      const guestId = generateGuestId();
      expect(guestId.startsWith(SECURITY_CONFIG.guestIdPrefix)).toBe(true);
      expect(guestId.length).toBe(
        SECURITY_CONFIG.guestIdPrefix.length + SECURITY_CONFIG.guestIdRandomLength
      );
    });

    it('generates local user identifier conforming to SECURITY_CONFIG prefix and length', () => {
      const userId = generateLocalUserId();
      expect(userId.startsWith(SECURITY_CONFIG.userIdPrefix)).toBe(true);
      const parts = userId.replace(SECURITY_CONFIG.userIdPrefix, '').split('_');
      expect(parts.length).toBe(2);
      expect(Number(parts[0])).toBeGreaterThan(0);
      expect(parts[1].length).toBe(SECURITY_CONFIG.userIdRandomLength);
    });

    it('generates friend request identifier conforming to SECURITY_CONFIG prefix and length', () => {
      const reqId = generateFriendRequestId();
      expect(reqId.startsWith(SECURITY_CONFIG.friendRequestIdPrefix)).toBe(true);
      const parts = reqId.replace(SECURITY_CONFIG.friendRequestIdPrefix, '').split('_');
      expect(parts.length).toBe(2);
      expect(Number(parts[0])).toBeGreaterThan(0);
      expect(parts[1].length).toBe(SECURITY_CONFIG.friendRequestIdRandomLength);
    });
  });
});
