/**
 * Google Analytics Telemetry Service for Firebase.
 *
 * Fail-soft, non-blocking telemetry dispatch. Never throws into callers:
 * offline, unsupported, non-browser, and mock (unconfigured) environments resolve to `false`.
 */

import { logEvent } from 'firebase/analytics';
import { initAnalytics } from './config';
import { ANALYTICS_CONFIG } from './analyticsConfig';

export type AnalyticsEventParams = Readonly<Record<string, string | number | boolean>>;

// Last logged route path; dedupes React StrictMode double-invoked effects and same-path re-renders.
let lastLoggedPagePath: string | null = null;

/**
 * Truncates string values to the GA4 parameter limit and drops non-primitive values.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(P) where P = number of parameters (small, caller-defined).
 * - Auxiliary Space Complexity: O(P) for the sanitized copy.
 */
export function sanitizeEventParams(params?: AnalyticsEventParams): Record<string, string | number | boolean> {
  const sanitized: Record<string, string | number | boolean> = {};
  if (!params) return sanitized;

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      sanitized[key] = value.slice(0, ANALYTICS_CONFIG.maxParamValueLength);
    } else if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Logs an analytics event. Resolves `true` when dispatched, `false` otherwise.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(P) for parameter sanitization; analytics instance lookup is a memoized O(1) promise.
 * - Auxiliary Space Complexity: O(P).
 */
export async function logAnalyticsEvent(eventName: string, eventParams?: AnalyticsEventParams): Promise<boolean> {
  if (!ANALYTICS_CONFIG.enabled) return false;
  if (typeof eventName !== 'string' || eventName.trim().length === 0) return false;

  try {
    const analytics = await initAnalytics();
    if (!analytics) return false;

    logEvent(analytics, eventName, sanitizeEventParams(eventParams));
    return true;
  } catch (err) {
    // Fail soft: telemetry must never interrupt gameplay or navigation
    console.debug('Analytics logEvent failed:', err);
    return false;
  }
}

/**
 * Logs a SPA page view for a route path. Consecutive duplicate paths are skipped in O(1).
 */
export async function logPageView(pagePath: string): Promise<boolean> {
  if (pagePath === lastLoggedPagePath) return false;
  lastLoggedPagePath = pagePath;
  return logAnalyticsEvent(ANALYTICS_CONFIG.events.pageView, { page_path: pagePath });
}
