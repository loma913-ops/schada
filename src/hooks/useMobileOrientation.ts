import { useState, useEffect, useCallback } from 'react';
import {
  isMobileDevice,
  isLandscapeOrientation,
  shouldBlockMobileLandscape,
  lockOrientationToPortrait,
  registerOrientationLockGestures,
  type OrientationCheckResult,
} from '@/services/orientation/orientationService';
import {
  ORIENTATION_CONFIG,
  validateOrientationConfig,
  type OrientationConfig,
} from '@/services/orientation/orientationConfig';

export interface UseMobileOrientationReturn extends OrientationCheckResult {
  readonly requestLock: () => Promise<boolean>;
}

/**
 * Hook to monitor mobile orientation and lock state.
 *
 * Algorithmic Complexity:
 * - State reconciliation: O(1) time, O(1) space
 * - Event subscription: O(1) time, O(1) space
 */
export function useMobileOrientation(
  config: OrientationConfig = ORIENTATION_CONFIG
): UseMobileOrientationReturn {
  validateOrientationConfig(config);

  const [orientationState, setOrientationState] = useState<OrientationCheckResult>(() => ({
    isMobile: isMobileDevice(undefined, undefined, config),
    isLandscape: isLandscapeOrientation(undefined, config),
    isBlocked: shouldBlockMobileLandscape(undefined, undefined, config),
  }));

  const updateState = useCallback(() => {
    const isMobile = isMobileDevice(undefined, undefined, config);
    const isLandscape = isLandscapeOrientation(undefined, config);
    const isBlocked = shouldBlockMobileLandscape(undefined, undefined, config);

    setOrientationState((prev) => {
      if (
        prev.isMobile === isMobile &&
        prev.isLandscape === isLandscape &&
        prev.isBlocked === isBlocked
      ) {
        return prev;
      }
      return { isMobile, isLandscape, isBlocked };
    });
  }, [config]);

  const requestLock = useCallback(async () => {
    const success = await lockOrientationToPortrait(config);
    updateState();
    return success;
  }, [config, updateState]);

  useEffect(() => {
    // 1. Initial attempt to lock orientation
    void lockOrientationToPortrait(config);

    // 2. Register user gesture listeners to trigger orientation lock on first interaction
    const cleanupGestures = registerOrientationLockGestures(config);

    // 3. Listen to orientation changes and window resize
    const handleOrientationChange = () => {
      updateState();
      void lockOrientationToPortrait(config);
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', updateState);

    // Screen Orientation API event
    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener('change', handleOrientationChange);
    }

    // Media query listener
    let mq: MediaQueryList | null = null;
    let handleMqChange: (() => void) | null = null;

    if (typeof window.matchMedia === 'function') {
      mq = window.matchMedia(config.mediaQueries.landscape);
      handleMqChange = () => updateState();
      if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', handleMqChange);
      } else if (typeof (mq as any).addListener === 'function') {
        (mq as any).addListener(handleMqChange);
      }
    }

    // Visibility change listener (re-lock and re-check when returning from background)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateState();
        void lockOrientationToPortrait(config);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cleanupGestures();
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', updateState);
      if (window.screen?.orientation) {
        window.screen.orientation.removeEventListener('change', handleOrientationChange);
      }
      if (mq && handleMqChange) {
        if (typeof mq.removeEventListener === 'function') {
          mq.removeEventListener('change', handleMqChange);
        } else if (typeof (mq as any).removeListener === 'function') {
          (mq as any).removeListener(handleMqChange);
        }
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [config, updateState]);

  return {
    ...orientationState,
    requestLock,
  };
}
