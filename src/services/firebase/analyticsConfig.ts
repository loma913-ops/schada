/**
 * Firebase Google Analytics Configuration.
 *
 * Centralizes analytics event names, parameter limits, measurement ID format,
 * and privacy-related gtag settings.
 * Validates configuration to eliminate hard-coded fallback values.
 */

export class AnalyticsConfigError extends Error {
  constructor(message: string) {
    super(`AnalyticsConfigError: ${message}`);
    this.name = 'AnalyticsConfigError';
  }
}

export interface AnalyticsEventNames {
  readonly pageView: string;
}

export interface AnalyticsPrivacySettings {
  /** Disables the automatic initial page_view; SPA route changes are logged manually. */
  readonly sendDefaultPageView: boolean;
  /** Google Signals cross-device / demographic tracking. */
  readonly allowGoogleSignals: boolean;
  /** Use of collected data for ad personalization. */
  readonly allowAdPersonalizationSignals: boolean;
}

export interface AnalyticsConfig {
  readonly enabled: boolean;
  readonly events: AnalyticsEventNames;
  /** GA4 limit for event parameter string values. */
  readonly maxParamValueLength: number;
  readonly measurementIdPattern: RegExp;
  readonly privacy: AnalyticsPrivacySettings;
}

const REQUIRED_EVENT_KEYS: readonly (keyof AnalyticsEventNames)[] = ['pageView'];
const REQUIRED_PRIVACY_KEYS: readonly (keyof AnalyticsPrivacySettings)[] = [
  'sendDefaultPageView',
  'allowGoogleSignals',
  'allowAdPersonalizationSignals',
];

/**
 * Validates the AnalyticsConfig at startup.
 * Throws AnalyticsConfigError if configuration is missing, null, or contains invalid parameters.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(E + P) where E = event keys and P = privacy keys (both fixed), strictly O(1).
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 */
export function validateAnalyticsConfig(config: AnalyticsConfig): void {
  if (!config) {
    throw new AnalyticsConfigError('Configuration object is missing or null.');
  }

  if (typeof config.enabled !== 'boolean') {
    throw new AnalyticsConfigError('Invalid enabled: expected boolean.');
  }

  if (
    typeof config.maxParamValueLength !== 'number' ||
    !Number.isInteger(config.maxParamValueLength) ||
    config.maxParamValueLength <= 0
  ) {
    throw new AnalyticsConfigError(
      `Invalid maxParamValueLength: expected positive integer, received ${config.maxParamValueLength}.`
    );
  }

  if (!(config.measurementIdPattern instanceof RegExp)) {
    throw new AnalyticsConfigError('Invalid measurementIdPattern: expected RegExp instance.');
  }

  if (!config.events || typeof config.events !== 'object') {
    throw new AnalyticsConfigError('Invalid events: expected event name map object.');
  }

  for (const eventKey of REQUIRED_EVENT_KEYS) {
    const eventName = config.events[eventKey];
    if (typeof eventName !== 'string' || eventName.trim().length === 0) {
      throw new AnalyticsConfigError(`Invalid events.${eventKey}: expected non-empty event name string.`);
    }
  }

  if (!config.privacy || typeof config.privacy !== 'object') {
    throw new AnalyticsConfigError('Invalid privacy: expected privacy settings object.');
  }

  for (const privacyKey of REQUIRED_PRIVACY_KEYS) {
    if (typeof config.privacy[privacyKey] !== 'boolean') {
      throw new AnalyticsConfigError(`Invalid privacy.${privacyKey}: expected boolean.`);
    }
  }
}

/**
 * Validates the GA4 measurement ID supplied via VITE_FIREBASE_MEASUREMENT_ID.
 * Required whenever analytics is enabled and Firebase is configured.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(L) where L = measurement ID length (bounded, ~12 chars), effectively O(1).
 * - Auxiliary Space Complexity: O(1).
 */
export function validateMeasurementId(
  measurementId: string | undefined,
  config: AnalyticsConfig = ANALYTICS_CONFIG
): asserts measurementId is string {
  if (typeof measurementId !== 'string' || measurementId.trim().length === 0) {
    throw new AnalyticsConfigError(
      'VITE_FIREBASE_MEASUREMENT_ID is missing. Set it in .env or disable analytics via ANALYTICS_CONFIG.enabled.'
    );
  }
  if (!config.measurementIdPattern.test(measurementId)) {
    throw new AnalyticsConfigError(
      `VITE_FIREBASE_MEASUREMENT_ID "${measurementId}" does not match expected format ${config.measurementIdPattern}.`
    );
  }
}

export const ANALYTICS_CONFIG: AnalyticsConfig = Object.freeze({
  enabled: true,
  maxParamValueLength: 100,
  measurementIdPattern: /^G-[A-Z0-9]+$/,
  events: Object.freeze({
    pageView: 'page_view',
  }),
  privacy: Object.freeze({
    sendDefaultPageView: false,
    allowGoogleSignals: false,
    allowAdPersonalizationSignals: false,
  }),
});

// Self-validate canonical analytics configuration upon module load
validateAnalyticsConfig(ANALYTICS_CONFIG);
