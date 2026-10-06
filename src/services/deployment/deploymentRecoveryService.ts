/**
 * Deployment Recovery Service.
 *
 * Automatically recovers user sessions when a new deployment renders
 * old chunk hashes obsolete on the hosting server.
 * Handles Vite preload errors, unhandled dynamic import rejections,
 * service worker auto-update lifecycle claiming (`clientsClaim`),
 * and version manifest polling with safe deferred reload during active games.
 */

import {
  DEPLOYMENT_RECOVERY_CONFIG,
  validateDeploymentRecoveryConfig,
  type DeploymentRecoveryConfig,
} from './deploymentRecoveryConfig';

// Event bus listeners for update availability
type UpdateListener = () => void;
const updateListeners = new Set<UpdateListener>();
let updateAvailableState = false;

/**
 * Returns whether a newer deployment is available and pending reload.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time boolean property lookup.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant.
 */
export function isUpdateAvailable(): boolean {
  return updateAvailableState;
}

/**
 * Sets the update availability state and notifies all registered subscribers.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(L) where L is the number of active subscribers.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(L) strictly linear with respect to subscriber count.
 */
export function setUpdateAvailable(available: boolean): void {
  updateAvailableState = available;
  if (available) {
    updateListeners.forEach((listener) => {
      try {
        listener();
      } catch {
        // Prevent an isolated subscriber failure from breaking notification loop
      }
    });
  }
}

/**
 * Subscribes a listener to update available notifications.
 * Returns an unsubscribe cleanup function.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) Set insertion.
 * - Auxiliary Space Complexity: O(1) closure allocation.
 *
 * Growth Rate:
 * - O(1) constant.
 */
export function onUpdateAvailable(listener: UpdateListener): () => void {
  updateListeners.add(listener);
  if (updateAvailableState) {
    try {
      listener();
    } catch {
      // Prevent an isolated subscriber failure from crashing subscription
    }
  }
  return () => {
    updateListeners.delete(listener);
  };
}

/**
 * Retrieves the compiled client build timestamp, using configuration fallback if untracked.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time property check.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant.
 */
export function getClientBuildTime(
  config: DeploymentRecoveryConfig = DEPLOYMENT_RECOVERY_CONFIG
): number {
  validateDeploymentRecoveryConfig(config);
  if (typeof __APP_BUILD_TIME__ === 'number' && !isNaN(__APP_BUILD_TIME__)) {
    return __APP_BUILD_TIME__;
  }
  return config.initialBuildTimeFallback;
}

/**
 * Determines whether the current path indicates an active gameplay session.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(K) where K is length of activeGamePathPrefix string.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(K) linear with respect to prefix length; constant O(1) in practical execution.
 */
export function isUserInActiveGame(
  pathname: string,
  config: DeploymentRecoveryConfig = DEPLOYMENT_RECOVERY_CONFIG
): boolean {
  validateDeploymentRecoveryConfig(config);
  return typeof pathname === 'string' && pathname.startsWith(config.activeGamePathPrefix);
}

/**
 * Determines whether an error message or rejection corresponds to a dynamic chunk import failure.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(P * M) where P is the number of error patterns and M is message length.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(P * M) linear with respect to pattern count and message length.
 */
export function isDynamicChunkLoadError(
  error: unknown,
  config: DeploymentRecoveryConfig = DEPLOYMENT_RECOVERY_CONFIG
): boolean {
  validateDeploymentRecoveryConfig(config);

  if (!error) return false;

  let message = '';
  if (typeof error === 'string') {
    message = error;
  } else if (typeof error === 'object' && error !== null) {
    const errObj = error as { message?: string; reason?: { message?: string } };
    message = errObj.message || errObj.reason?.message || '';
  }

  if (!message) return false;

  const lower = message.toLowerCase();
  return config.chunkErrorPatterns.some((pattern) => lower.includes(pattern.toLowerCase()));
}

/**
 * Checks whether sufficient time has elapsed since the last reload to permit another reload.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time arithmetic comparison.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant.
 */
export function shouldTriggerChunkReload(
  currentTimeMs: number,
  lastReloadTimeMs: number | null,
  config: DeploymentRecoveryConfig = DEPLOYMENT_RECOVERY_CONFIG
): boolean {
  validateDeploymentRecoveryConfig(config);

  if (lastReloadTimeMs === null || isNaN(lastReloadTimeMs)) {
    return true;
  }

  return currentTimeMs - lastReloadTimeMs > config.debounceCooldownMs;
}

/**
 * Executes a debounced page reload using sessionStorage for persistence.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant storage read/write and browser reload invocation.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant.
 */
export function executeDebouncedReload(
  config: DeploymentRecoveryConfig = DEPLOYMENT_RECOVERY_CONFIG
): boolean {
  validateDeploymentRecoveryConfig(config);

  try {
    if (typeof sessionStorage === 'undefined') {
      return false;
    }

    const raw = sessionStorage.getItem(config.storageKey);
    const lastReload = raw ? parseInt(raw, 10) : null;
    const now = Date.now();

    if (shouldTriggerChunkReload(now, lastReload, config)) {
      sessionStorage.setItem(config.storageKey, now.toString());
      if (typeof window !== 'undefined' && window.location) {
        window.location.reload();
        return true;
      }
    }
  } catch {
    // Storage access restricted (e.g. strict private browsing sandbox)
  }

  return false;
}

/**
 * Checks the remote version manifest against the current client build timestamp.
 * Returns true if a newer deployment is detected on the hosting server.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) network fetch and JSON parsing of ~50-byte manifest payload.
 * - Auxiliary Space Complexity: O(1) constant memory.
 *
 * Growth Rate:
 * - O(1) constant regardless of database size or app state.
 */
export async function checkVersionManifest(
  currentBuildTime: number,
  config: DeploymentRecoveryConfig = DEPLOYMENT_RECOVERY_CONFIG
): Promise<boolean> {
  validateDeploymentRecoveryConfig(config);

  if (typeof fetch === 'undefined') return false;

  try {
    const response = await fetch(`${config.versionCheckEndpoint}?t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });

    if (!response.ok) return false;

    const data = await response.json();
    if (data && typeof data.buildTime === 'number' && data.buildTime > currentBuildTime) {
      return true;
    }
  } catch {
    // Network unreachable or offline
  }

  return false;
}

/**
 * Forces an update reload, bypassing deferred gameplay state.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time storage check and reload call.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant.
 */
export function triggerUpdateReload(
  config: DeploymentRecoveryConfig = DEPLOYMENT_RECOVERY_CONFIG
): boolean {
  validateDeploymentRecoveryConfig(config);
  return executeDebouncedReload(config);
}

/**
 * Registers global event listeners, Service Worker lifecycle watchers, and version manifest polling
 * to guarantee that deployed updates take effect immediately without requiring hard reloads or manual cache clearing.
 * Returns an unregister cleanup function.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) registration of browser and service worker listeners and interval setups.
 * - Auxiliary Space Complexity: O(1) closure allocations.
 *
 * Growth Rate:
 * - O(1) constant.
 */
export function initDeploymentRecovery(
  config: DeploymentRecoveryConfig = DEPLOYMENT_RECOVERY_CONFIG,
  options?: { isInActiveMatch?: () => boolean }
): () => void {
  validateDeploymentRecoveryConfig(config);

  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleVitePreloadError = (event: Event) => {
    event.preventDefault();
    executeDebouncedReload(config);
  };

  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    if (isDynamicChunkLoadError(event.reason, config)) {
      event.preventDefault();
      executeDebouncedReload(config);
    }
  };

  window.addEventListener('vite:preloadError', handleVitePreloadError);
  window.addEventListener('unhandledrejection', handleUnhandledRejection);

  // Helper to determine if the client is currently in an active game
  const isInMatch = (): boolean => {
    if (options?.isInActiveMatch) {
      return options.isInActiveMatch();
    }
    return isUserInActiveGame(window.location.pathname, config);
  };

  let swIntervalId: ReturnType<typeof setInterval> | null = null;
  let versionIntervalId: ReturnType<typeof setInterval> | null = null;
  let activeRegistration: ServiceWorkerRegistration | null = null;
  let cleanSwListeners: (() => void) | null = null;

  // 1. Service Worker Update Detection & Controller Takeover
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    const hadPriorController = Boolean(navigator.serviceWorker.controller);

    const handleControllerChange = () => {
      // A new service worker has activated and claimed this client.
      // If a previous controller existed, this is an update deployment:
      if (hadPriorController) {
        if (isInMatch()) {
          setUpdateAvailable(true);
        } else {
          executeDebouncedReload(config);
        }
      }
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    const triggerSwUpdate = async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      if (activeRegistration) {
        try {
          await activeRegistration.update();
        } catch {
          // Offline or network error
        }
      }
    };

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        triggerSwUpdate();
      }
    };

    const handleWindowFocus = () => {
      triggerSwUpdate();
    };

    const handleOnline = () => {
      triggerSwUpdate();
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('online', handleOnline);

    navigator.serviceWorker
      .register(config.swRegistrationUrl, { scope: config.swScope })
      .then((registration) => {
        activeRegistration = registration;
        triggerSwUpdate();
      })
      .catch(() => {
        // Non-HTTPS or restricted context
      });

    swIntervalId = setInterval(triggerSwUpdate, config.swUpdateCheckIntervalMs);

    cleanSwListeners = () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('online', handleOnline);
    };
  }

  // 2. Periodic Remote Version Manifest Polling (Resilient fallback)
  const clientBuildTime = getClientBuildTime(config);
  const triggerVersionCheck = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (clientBuildTime <= config.initialBuildTimeFallback) return; // Untracked or dev build

    const isNewDeployment = await checkVersionManifest(clientBuildTime, config);
    if (isNewDeployment) {
      if (activeRegistration) {
        try {
          await activeRegistration.update();
        } catch {
          // Ignore
        }
      }
      if (isInMatch()) {
        setUpdateAvailable(true);
      } else {
        executeDebouncedReload(config);
      }
    }
  };

  versionIntervalId = setInterval(triggerVersionCheck, config.versionCheckIntervalMs);

  return () => {
    window.removeEventListener('vite:preloadError', handleVitePreloadError);
    window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    if (cleanSwListeners) {
      cleanSwListeners();
    }
    if (swIntervalId !== null) {
      clearInterval(swIntervalId);
    }
    if (versionIntervalId !== null) {
      clearInterval(versionIntervalId);
    }
  };
}
