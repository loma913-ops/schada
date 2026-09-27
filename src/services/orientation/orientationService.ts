/**
 * Service to manage mobile orientation lock and landscape blocking.
 *
 * Requirements:
 * - Mobile orientation must be locked in portrait.
 * - Landscape mode is not permitted on mobile devices.
 * - Desktop browsers (mouse/keyboard, wide screens) must remain unaffected.
 * - All parameters, thresholds, and strings driven by validated configuration.
 *
 * Algorithmic Complexity:
 * - isMobileDevice: O(1) time (bounded UA evaluation), O(1) space
 * - isLandscapeOrientation: O(1) time (dimension / media query check), O(1) space
 * - shouldBlockMobileLandscape: O(1) time, O(1) space
 * - lockOrientationToPortrait: O(1) time, O(1) space
 * - registerOrientationLockGestures: O(K) where K = number of gesture events (constant), O(1) space
 */

import {
  ORIENTATION_CONFIG,
  validateOrientationConfig,
  type OrientationConfig,
} from './orientationConfig';

export interface OrientationCheckResult {
  readonly isMobile: boolean;
  readonly isLandscape: boolean;
  readonly isBlocked: boolean;
}

/**
 * Detects whether the current client is a mobile device (phone, phablet, or tablet).
 * Distinguishes mobile devices from desktop computers with mice/touchpads.
 *
 * Time Complexity: O(1)
 * Space Complexity: O(1)
 */
export function isMobileDevice(
  customUserAgent?: string,
  customWindow?: Window,
  config: OrientationConfig = ORIENTATION_CONFIG
): boolean {
  validateOrientationConfig(config);

  const win = customWindow ?? (typeof window !== 'undefined' ? window : undefined);
  if (!win) return false;

  const nav = win.navigator;
  const ua = customUserAgent ?? (nav ? nav.userAgent : '');

  // 1. Mobile & tablet user agent patterns
  const isMobileUA = config.userAgentPatterns.mobileRegex.test(ua);

  // 2. iPadOS Safari desktop-class UA spoofing detection (Macintosh + touch points)
  const isIPadMac =
    ua.includes(config.userAgentPatterns.desktopClassMacPlatformToken) &&
    Boolean(nav && nav.maxTouchPoints > 1);

  // 3. Touch capabilities
  const hasTouch = Boolean(
    'ontouchstart' in win || (nav && nav.maxTouchPoints > 0)
  );

  // 4. Primary pointer is coarse (finger) rather than fine (mouse)
  const isCoarsePointer =
    typeof win.matchMedia === 'function'
      ? win.matchMedia(config.mediaQueries.coarsePointer).matches
      : false;

  // 5. If it's a known mobile user agent with touch, it's definitely a mobile device
  if ((isMobileUA || isIPadMac) && hasTouch) {
    return true;
  }

  // 6. Coarse touch device whose shortest screen dimension is mobile-sized (<= maxPhoneDimensionPx)
  if (hasTouch && isCoarsePointer) {
    const minDimension = Math.min(win.innerWidth, win.innerHeight);
    if (minDimension > 0 && minDimension <= config.maxPhoneDimensionPx) {
      return true;
    }
  }

  return false;
}

/**
 * Detects if the current viewport is in landscape orientation.
 *
 * Time Complexity: O(1)
 * Space Complexity: O(1)
 */
export function isLandscapeOrientation(
  customWindow?: Window,
  config: OrientationConfig = ORIENTATION_CONFIG
): boolean {
  validateOrientationConfig(config);

  const win = customWindow ?? (typeof window !== 'undefined' ? window : undefined);
  if (!win) return false;

  // Check screen.orientation API if available
  const screenOrientation = win.screen?.orientation?.type;
  if (screenOrientation) {
    return screenOrientation.startsWith('landscape');
  }

  // Check CSS media query
  if (typeof win.matchMedia === 'function') {
    const mq = win.matchMedia(config.mediaQueries.landscape);
    if (mq.matches) return true;
  }

  // Fallback to viewport dimension comparison
  return win.innerWidth > win.innerHeight;
}

/**
 * Determines whether landscape orientation should be blocked.
 * Returns true ONLY for mobile devices that are in landscape orientation.
 *
 * Time Complexity: O(1)
 * Space Complexity: O(1)
 */
export function shouldBlockMobileLandscape(
  customUserAgent?: string,
  customWindow?: Window,
  config: OrientationConfig = ORIENTATION_CONFIG
): boolean {
  validateOrientationConfig(config);
  const isMobile = isMobileDevice(customUserAgent, customWindow, config);
  const isLandscape = isLandscapeOrientation(customWindow, config);
  return isMobile && isLandscape;
}

/**
 * Attempts to programmatically lock orientation to portrait using the Screen Orientation API.
 * Supported on Chrome for Android, modern Android browsers, and installed PWAs.
 * Safely catches exceptions on unsupported platforms (like iOS Safari) without crashing.
 *
 * Time Complexity: O(1)
 * Space Complexity: O(1)
 */
export async function lockOrientationToPortrait(
  config: OrientationConfig = ORIENTATION_CONFIG
): Promise<boolean> {
  validateOrientationConfig(config);
  if (typeof window === 'undefined') return false;

  try {
    const screenObj = window.screen as Screen & {
      orientation?: ScreenOrientation & {
        lock?: (orientation: string) => Promise<void>;
      };
      lockOrientation?: (orientation: string) => boolean;
      mozLockOrientation?: (orientation: string) => boolean;
      msLockOrientation?: (orientation: string) => boolean;
    };

    // Modern standard Screen Orientation API
    if (screenObj.orientation && typeof screenObj.orientation.lock === 'function') {
      await screenObj.orientation.lock(config.targetOrientation);
      return true;
    }

    // Legacy vendor-prefixed APIs
    if (screenObj.lockOrientation) {
      return screenObj.lockOrientation(config.targetOrientation);
    }
    if (screenObj.mozLockOrientation) {
      return screenObj.mozLockOrientation(config.targetOrientation);
    }
    if (screenObj.msLockOrientation) {
      return screenObj.msLockOrientation(config.targetOrientation);
    }
  } catch {
    // Ignore: browser denied lock (e.g. requires fullscreen or not supported on iOS)
  }

  return false;
}

/**
 * Registers listeners for user gestures to attempt orientation lock as soon as user interacts.
 * Modern browsers often require a user gesture before allowing screen.orientation.lock().
 *
 * Time Complexity: O(K) where K = lockTriggerEvents.length
 * Space Complexity: O(1)
 */
export function registerOrientationLockGestures(
  config: OrientationConfig = ORIENTATION_CONFIG
): () => void {
  validateOrientationConfig(config);
  if (typeof window === 'undefined') return () => {};

  const handleInteraction = () => {
    void lockOrientationToPortrait(config);
  };

  const options: AddEventListenerOptions = { capture: true, passive: true };
  const eventNames = config.gestures.lockTriggerEvents;

  for (const eventName of eventNames) {
    window.addEventListener(eventName, handleInteraction, options);
  }

  return () => {
    for (const eventName of eventNames) {
      window.removeEventListener(eventName, handleInteraction, options);
    }
  };
}
