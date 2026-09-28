/**
 * Deployment Recovery Service.
 *
 * Automatically recovers user sessions when a new deployment renders
 * old chunk hashes obsolete on the hosting server.
 * Handles Vite preload errors and unhandled module import rejections,
 * applying debounced page reloads to prevent infinite reload loops.
 */

import {
  DEPLOYMENT_RECOVERY_CONFIG,
  validateDeploymentRecoveryConfig,
  type DeploymentRecoveryConfig,
} from './deploymentRecoveryConfig';

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
 * - Time Complexity: O(1) constant storage read/write and browser reload call.
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
    // Storage access restricted (e.g. strict privacy mode)
  }

  return false;
}

/**
 * Registers global event listeners to detect chunk load failures and trigger recovery.
 * Returns an unregister cleanup function.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) event listener registration.
 * - Auxiliary Space Complexity: O(1) closure allocations.
 *
 * Growth Rate:
 * - O(1) constant.
 */
export function initDeploymentRecovery(
  config: DeploymentRecoveryConfig = DEPLOYMENT_RECOVERY_CONFIG
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

  return () => {
    window.removeEventListener('vite:preloadError', handleVitePreloadError);
    window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  };
}
