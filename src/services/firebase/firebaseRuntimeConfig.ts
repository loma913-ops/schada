/**
 * Firebase Runtime and Emulator Configuration.
 *
 * Centralizes environment variable extraction, emulator host/port settings,
 * transport configuration, and startup parameter validation for Firebase client services.
 * Validates configuration to eliminate hard-coded fallback values.
 */

export class FirebaseRuntimeConfigError extends Error {
  constructor(message: string) {
    super(`FirebaseRuntimeConfigError: ${message}`);
    this.name = 'FirebaseRuntimeConfigError';
  }
}

export interface FirebaseEmulatorSettings {
  readonly authEmulatorUrl: string;
  readonly firestoreEmulatorHost: string;
  readonly firestoreEmulatorPort: number;
}

export interface FirestoreTransportSettings {
  readonly forceLongPolling: boolean;
  readonly longPollingTimeoutSeconds: number;
}

export interface FirebaseClientOptions {
  readonly apiKey: string;
  readonly authDomain: string;
  readonly projectId: string;
  readonly storageBucket: string;
  readonly messagingSenderId: string;
  readonly appId: string;
  readonly measurementId?: string;
}

export interface FirebaseRuntimeConfig {
  readonly emulators: FirebaseEmulatorSettings;
  readonly transport: FirestoreTransportSettings;
  readonly requiredProductionFields: readonly (keyof FirebaseClientOptions)[];
}

export const FIREBASE_RUNTIME_CONFIG: FirebaseRuntimeConfig = Object.freeze({
  emulators: Object.freeze({
    authEmulatorUrl: 'http://localhost:9099',
    firestoreEmulatorHost: 'localhost',
    firestoreEmulatorPort: 8080,
  }),
  transport: Object.freeze({
    forceLongPolling: true,
    longPollingTimeoutSeconds: 30,
  }),
  requiredProductionFields: Object.freeze(['apiKey', 'projectId'] as const),
});

/**
 * Validates the static FirebaseRuntimeConfig at startup.
 * Throws FirebaseRuntimeConfigError if configuration is missing, null, or contains invalid parameters.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant, stable across runtime.
 */
export function validateFirebaseRuntimeConfig(config: FirebaseRuntimeConfig): void {
  if (!config) {
    throw new FirebaseRuntimeConfigError('Configuration object is missing or null.');
  }

  if (!config.emulators || typeof config.emulators !== 'object') {
    throw new FirebaseRuntimeConfigError('Invalid emulators: expected configuration object.');
  }

  const { authEmulatorUrl, firestoreEmulatorHost, firestoreEmulatorPort } = config.emulators;

  if (typeof authEmulatorUrl !== 'string' || authEmulatorUrl.trim().length === 0) {
    throw new FirebaseRuntimeConfigError('Invalid emulators.authEmulatorUrl: expected non-empty string.');
  }

  if (typeof firestoreEmulatorHost !== 'string' || firestoreEmulatorHost.trim().length === 0) {
    throw new FirebaseRuntimeConfigError('Invalid emulators.firestoreEmulatorHost: expected non-empty string.');
  }

  if (
    typeof firestoreEmulatorPort !== 'number' ||
    isNaN(firestoreEmulatorPort) ||
    firestoreEmulatorPort <= 0 ||
    firestoreEmulatorPort > 65535
  ) {
    throw new FirebaseRuntimeConfigError(
      `Invalid emulators.firestoreEmulatorPort: expected valid port [1, 65535], received ${firestoreEmulatorPort}.`
    );
  }

  if (!config.transport || typeof config.transport !== 'object') {
    throw new FirebaseRuntimeConfigError('Invalid transport: expected configuration object.');
  }

  const { forceLongPolling, longPollingTimeoutSeconds } = config.transport;

  if (typeof forceLongPolling !== 'boolean') {
    throw new FirebaseRuntimeConfigError('Invalid transport.forceLongPolling: expected boolean.');
  }

  if (
    typeof longPollingTimeoutSeconds !== 'number' ||
    isNaN(longPollingTimeoutSeconds) ||
    longPollingTimeoutSeconds < 5 ||
    longPollingTimeoutSeconds > 30
  ) {
    throw new FirebaseRuntimeConfigError(
      `Invalid transport.longPollingTimeoutSeconds: expected integer [5, 30], received ${longPollingTimeoutSeconds}.`
    );
  }

  if (!Array.isArray(config.requiredProductionFields) || config.requiredProductionFields.length === 0) {
    throw new FirebaseRuntimeConfigError('Invalid requiredProductionFields: expected non-empty array of field keys.');
  }
}

// Self-validate canonical runtime config at module load time
validateFirebaseRuntimeConfig(FIREBASE_RUNTIME_CONFIG);

/**
 * Validates extracted Firebase client options.
 * Throws FirebaseRuntimeConfigError if any required fields are missing or empty when Firebase is active.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(F) where F = requiredProductionFields.length (F=2), strictly O(1) constant time.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant, perfectly stable across runtime.
 */
export function validateFirebaseClientOptions(
  options: FirebaseClientOptions,
  config: FirebaseRuntimeConfig = FIREBASE_RUNTIME_CONFIG
): void {
  validateFirebaseRuntimeConfig(config);

  for (const field of config.requiredProductionFields) {
    const val = options[field];
    if (typeof val !== 'string' || val.trim().length === 0) {
      throw new FirebaseRuntimeConfigError(
        `Firebase client configuration is invalid: required field "${field}" is missing or empty.`
      );
    }
  }
}
