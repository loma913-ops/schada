/**
 * Mobile Native Integration Service for Capacitor 8.
 *
 * Provides a clean abstraction layer for Capacitor plugins:
 * - Haptic feedback for moves, captures, goals, and victories
 * - Native hardware back button handling with game-loss prevention
 * - System bar styling synchronized to light/dark themes
 * - Canonical share base URL resolution
 * - Universal safe clipboard copying across Web, Android, and iOS
 */

import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { App as CapApp } from '@capacitor/app';
import {
  NATIVE_CONFIG,
  validateNativeConfig,
  type NativeConfig,
  type NativeImpactStyleName,
  type NativeNotificationTypeName,
} from './nativeConfig';

/**
 * Checks whether the current runtime is inside an authentic native container (Android / iOS).
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time property check.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant.
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Returns the active platform identifier ('android' | 'ios' | 'web').
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time platform resolution.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant.
 */
export function getPlatform(): 'android' | 'ios' | 'web' {
  return Capacitor.getPlatform() as 'android' | 'ios' | 'web';
}

/**
 * Resolves the canonical base URL for game sharing links.
 * Returns the public HTTPS web origin on native mobile containers to avoid file:// or capacitor:// schemes,
 * and current window origin on web browsers.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time URL string resolution.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant.
 */
export function getShareBaseUrl(config: NativeConfig = NATIVE_CONFIG): string {
  validateNativeConfig(config);
  if (isNativePlatform()) {
    return config.publicWebOrigin;
  }
  return typeof window !== 'undefined' ? window.location.origin : config.publicWebOrigin;
}

/**
 * Universal clipboard writer that operates seamlessly across desktop browsers,
 * mobile browsers, Android WebViews, and iOS WKWebViews with legacy fallback.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(L) where L is text length.
 * - Auxiliary Space Complexity: O(L) for temporary textarea string representation.
 *
 * Growth Rate:
 * - O(L) linear with respect to text length.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof text !== 'string') {
    return false;
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to legacy DOM copy fallback
    }
  }
  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Synchronizes native mobile status bar and system bar style with the active theme.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time native bridge invocation.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant.
 */
export async function applyNativeSystemBarStyle(
  theme: 'dark' | 'light',
  config: NativeConfig = NATIVE_CONFIG
): Promise<void> {
  validateNativeConfig(config);
  if (!isNativePlatform()) return;
  try {
    const targetStyle =
      theme === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light;
    await SystemBars.setStyle({
      style: targetStyle,
    });
  } catch (err) {
    console.warn('SystemBars setStyle warning:', err);
  }
}

export interface BackButtonContext {
  hasOpenModal: () => boolean;
  closeActiveModal: () => void;
  isInGameMatch: () => boolean;
  navigateBack: () => void;
  isAtRootPlayTab: () => boolean;
}

/**
 * Registers hardware back-button listener on native Android devices.
 * Prevents accidental match forfeits and handles modal dismissals gracefully.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) event listener registration.
 * - Auxiliary Space Complexity: O(1) constant listener handle.
 *
 * Growth Rate:
 * - O(1) constant.
 */
export function initNativeMobileServices(
  context: BackButtonContext,
  config: NativeConfig = NATIVE_CONFIG
): () => void {
  validateNativeConfig(config);
  if (!isNativePlatform()) return () => {};

  // Register Android Hardware Back Button listener
  const backListenerPromise = CapApp.addListener('backButton', () => {
    // 1. If any modal is active, dismiss it first
    if (context.hasOpenModal()) {
      context.closeActiveModal();
      return;
    }

    // 2. If inside an active game match, minimize app to prevent accidental forfeit writes
    if (context.isInGameMatch()) {
      if (config.backButton.inGameBehavior === 'minimize') {
        void CapApp.minimizeApp();
      }
      return;
    }

    // 3. If on home play tab at root, exit app
    if (context.isAtRootPlayTab()) {
      void CapApp.exitApp();
      return;
    }

    // 4. Otherwise navigate back in router history
    context.navigateBack();
  });

  return () => {
    void backListenerPromise.then((handle) => handle.remove());
  };
}

const IMPACT_STYLE_MAP: Readonly<Record<NativeImpactStyleName, ImpactStyle>> = Object.freeze({
  light: ImpactStyle.Light,
  medium: ImpactStyle.Medium,
  heavy: ImpactStyle.Heavy,
});

const NOTIFICATION_TYPE_MAP: Readonly<Record<NativeNotificationTypeName, NotificationType>> = Object.freeze({
  success: NotificationType.Success,
  warning: NotificationType.Warning,
  error: NotificationType.Error,
});

/**
 * Native hardware haptic feedback triggers with graceful non-blocking web no-ops.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time IPC/JNI bridge call.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant.
 */
export const mobileHaptics = {
  move: async (config: NativeConfig = NATIVE_CONFIG): Promise<void> => {
    validateNativeConfig(config);
    if (!isNativePlatform()) return;
    const style = IMPACT_STYLE_MAP[config.haptics.move];
    await Haptics.impact({ style }).catch(() => {});
  },
  capture: async (config: NativeConfig = NATIVE_CONFIG): Promise<void> => {
    validateNativeConfig(config);
    if (!isNativePlatform()) return;
    const style = IMPACT_STYLE_MAP[config.haptics.capture];
    await Haptics.impact({ style }).catch(() => {});
  },
  goal: async (config: NativeConfig = NATIVE_CONFIG): Promise<void> => {
    validateNativeConfig(config);
    if (!isNativePlatform()) return;
    const style = IMPACT_STYLE_MAP[config.haptics.goal];
    await Haptics.impact({ style }).catch(() => {});
  },
  victory: async (config: NativeConfig = NATIVE_CONFIG): Promise<void> => {
    validateNativeConfig(config);
    if (!isNativePlatform()) return;
    const type = NOTIFICATION_TYPE_MAP[config.haptics.victory];
    await Haptics.notification({ type }).catch(() => {});
  },
};
