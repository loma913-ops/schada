import { SECURITY_CONFIG } from './securityConfig';

/**
 * Authoritative Cryptographic Pseudo-Random Utilities.
 *
 * Implements cryptographically secure pseudo-random number generation (CSPRNG)
 * backed by the Web Crypto API (crypto.getRandomValues). Eliminates insecure
 * randomness (Math.random) across all sensitive security vectors (session tokens,
 * client presence sessions, guest IDs, local user accounts, and friend requests).
 *
 * Features:
 * 1. Web Crypto API Integration: Authoritative cross-platform PRNG for web, mobile (Capacitor iOS/Android), and Node/Vitest.
 * 2. Unbiased Rejection Sampling: Mathematical uniform distribution across arbitrary charsets with zero modulo bias.
 * 3. Configuration Over Hardcoding: All lengths, prefixes, and charsets bound directly to SECURITY_CONFIG.
 */

/**
 * Accesses the authoritative Web Crypto API provider.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant runtime environment check.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * @returns Crypto provider instance.
 * @throws Error if Web Crypto API is unavailable.
 */
export function getCryptoProvider(): Crypto {
  const cryptoObj =
    typeof globalThis !== 'undefined' && globalThis.crypto
      ? globalThis.crypto
      : typeof crypto !== 'undefined'
        ? crypto
        : undefined;

  if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') {
    throw new Error('Cryptographically secure PRNG (crypto.getRandomValues) is required but not available.');
  }

  return cryptoObj;
}

/**
 * Generates cryptographically secure random bytes using Web Crypto API.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(B) where B = byteLength.
 * - Auxiliary Space Complexity: O(B) for allocated Uint8Array.
 *
 * @param byteLength Number of random bytes to generate.
 * @returns Uint8Array populated with cryptographically strong pseudo-random bytes.
 * @throws RangeError if byteLength is not a positive integer.
 */
export function getSecureRandomBytes(byteLength: number): Uint8Array {
  if (typeof byteLength !== 'number' || !Number.isInteger(byteLength) || byteLength <= 0) {
    throw new RangeError(`getSecureRandomBytes: expected positive integer byteLength, received ${String(byteLength)}.`);
  }

  const cryptoObj = getCryptoProvider();
  const bytes = new Uint8Array(byteLength);
  cryptoObj.getRandomValues(bytes);
  return bytes;
}

/**
 * Generates an unbiased cryptographically secure random string of specified length
 * using rejection sampling over the given charset to eliminate modulo bias.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(L) expected time where L = length.
 *   With rejection threshold = 256 - (256 % charsetLength), rejection probability is at most (charsetLength - 1) / 256 < 24.3%.
 *   Expected iterations to collect L unbiased characters is strictly bounded and linear O(L).
 * - Auxiliary Space Complexity: O(L) auxiliary space for typed byte buffer.
 *
 * @param length Desired string length.
 * @param charset Character set to draw from (defaults to SECURITY_CONFIG.gameIdCharset).
 * @returns Cryptographically secure random string of requested length.
 * @throws RangeError if length is not a positive integer or charset is empty.
 */
export function getSecureRandomString(
  length: number,
  charset: string = SECURITY_CONFIG.gameIdCharset
): string {
  if (typeof length !== 'number' || !Number.isInteger(length) || length <= 0) {
    throw new RangeError(`getSecureRandomString: expected positive integer length, received ${String(length)}.`);
  }
  if (typeof charset !== 'string' || charset.length === 0) {
    throw new RangeError('getSecureRandomString: charset must be a non-empty string.');
  }

  const charsetLength = charset.length;
  if (charsetLength > 256) {
    throw new RangeError(`getSecureRandomString: charset length must not exceed 256 (received ${charsetLength}).`);
  }
  if (new Set(charset).size !== charsetLength) {
    throw new RangeError('getSecureRandomString: charset characters must be unique to ensure uniform distribution.');
  }

  // Discard bytes beyond largest multiple of charsetLength to eliminate modulo bias
  const maxValidByte = 256 - (256 % charsetLength);
  const cryptoObj = getCryptoProvider();

  let result = '';
  const bufferSize = Math.max(length * 2, 32);
  const randomBytes = new Uint8Array(bufferSize);

  while (result.length < length) {
    cryptoObj.getRandomValues(randomBytes);
    for (let i = 0; i < randomBytes.length && result.length < length; i++) {
      const byte = randomBytes[i];
      if (byte < maxValidByte) {
        result += charset[byte % charsetLength];
      }
    }
  }

  return result;
}

/**
 * Cryptographically secure uniform random element selection from an array.
 * Eliminates modulo bias using rejection sampling.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) expected constant time.
 * - Auxiliary Space Complexity: O(1) auxiliary space for 16-byte buffer.
 *
 * @param items Non-empty array of items to choose from.
 * @returns Uniformly selected element.
 * @throws RangeError if items array is empty.
 */
export function getSecureRandomChoice<T>(items: readonly T[]): T {
  if (!Array.isArray(items) || items.length === 0) {
    throw new RangeError('getSecureRandomChoice: items array must not be empty.');
  }
  if (items.length === 1) {
    return items[0];
  }

  const length = items.length;
  if (length > 256) {
    throw new RangeError(`getSecureRandomChoice: items array length must not exceed 256 (received ${length}).`);
  }
  const maxValidByte = 256 - (256 % length);
  const cryptoObj = getCryptoProvider();
  const buffer = new Uint8Array(16);

  while (true) {
    cryptoObj.getRandomValues(buffer);
    for (let i = 0; i < buffer.length; i++) {
      const byte = buffer[i];
      if (byte < maxValidByte) {
        return items[byte % length];
      }
    }
  }
}

/**
 * Generates an authoritative cryptographically secure player session token.
 *
 * Algorithmic Complexity: O(1) constant time.
 */
export function generateSecureToken(): string {
  return `${SECURITY_CONFIG.sessionTokenPrefix}${getSecureRandomString(SECURITY_CONFIG.sessionTokenRandomLength)}`;
}

/**
 * Generates an authoritative cryptographically secure tab/client session ID.
 *
 * Algorithmic Complexity: O(1) constant time.
 */
export function generateClientSessionId(): string {
  return `${SECURITY_CONFIG.sessionIdPrefix}${Date.now()}_${getSecureRandomString(SECURITY_CONFIG.sessionIdRandomLength)}`;
}

/**
 * Generates an authoritative cryptographically secure guest identifier.
 *
 * Algorithmic Complexity: O(1) constant time.
 */
export function generateGuestId(): string {
  return `${SECURITY_CONFIG.guestIdPrefix}${getSecureRandomString(SECURITY_CONFIG.guestIdRandomLength)}`;
}

/**
 * Generates an authoritative cryptographically secure local user account identifier.
 *
 * Algorithmic Complexity: O(1) constant time.
 */
export function generateLocalUserId(): string {
  return `${SECURITY_CONFIG.userIdPrefix}${Date.now()}_${getSecureRandomString(SECURITY_CONFIG.userIdRandomLength)}`;
}

/**
 * Generates an authoritative cryptographically secure friend request identifier.
 *
 * Algorithmic Complexity: O(1) constant time.
 */
export function generateFriendRequestId(): string {
  return `${SECURITY_CONFIG.friendRequestIdPrefix}${Date.now()}_${getSecureRandomString(SECURITY_CONFIG.friendRequestIdRandomLength)}`;
}
