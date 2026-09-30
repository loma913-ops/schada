import { describe, it, expect } from 'vitest';
import {
  FIREBASE_RUNTIME_CONFIG,
  validateFirebaseRuntimeConfig,
  validateFirebaseClientOptions,
  FirebaseRuntimeConfigError,
} from '../firebaseRuntimeConfig';

describe('firebaseRuntimeConfig', () => {
  it('validates canonical FIREBASE_RUNTIME_CONFIG without errors', () => {
    expect(() => validateFirebaseRuntimeConfig(FIREBASE_RUNTIME_CONFIG)).not.toThrow();
    expect(FIREBASE_RUNTIME_CONFIG.emulators.firestoreEmulatorPort).toBe(8080);
    expect(FIREBASE_RUNTIME_CONFIG.emulators.authEmulatorUrl).toContain('9099');
  });

  it('throws on null or undefined config', () => {
    expect(() => validateFirebaseRuntimeConfig(null as any)).toThrow(FirebaseRuntimeConfigError);
    expect(() => validateFirebaseRuntimeConfig(undefined as any)).toThrow('Configuration object is missing or null.');
  });

  it('throws on invalid emulator port', () => {
    const invalidPort = {
      ...FIREBASE_RUNTIME_CONFIG,
      emulators: {
        ...FIREBASE_RUNTIME_CONFIG.emulators,
        firestoreEmulatorPort: 70000,
      },
    };
    expect(() => validateFirebaseRuntimeConfig(invalidPort)).toThrow('Invalid emulators.firestoreEmulatorPort');
  });

  it('validates client options and throws on missing required production fields', () => {
    const valid = {
      apiKey: 'test-api-key',
      authDomain: 'test.firebaseapp.com',
      projectId: 'test-project',
      storageBucket: 'test.appspot.com',
      messagingSenderId: '12345',
      appId: '1:12345:web:67890',
    };
    expect(() => validateFirebaseClientOptions(valid)).not.toThrow();

    const missingKey = {
      ...valid,
      apiKey: '  ',
    };
    expect(() => validateFirebaseClientOptions(missingKey)).toThrow('required field "apiKey" is missing or empty');
  });
});
