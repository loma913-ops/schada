import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.hoisted(() => {
  if (typeof (globalThis as any).window === 'undefined') {
    (globalThis as any).window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
      location: { reload: () => {}, pathname: '/' },
    };
  }
  if (typeof (globalThis as any).Event === 'undefined') {
    (globalThis as any).Event = class Event {
      type: string;
      cancelable: boolean;
      defaultPrevented = false;
      constructor(type: string, options?: { cancelable?: boolean }) {
        this.type = type;
        this.cancelable = options?.cancelable ?? false;
      }
      preventDefault() {
        this.defaultPrevented = true;
      }
    };
  }
});

import {
  DEPLOYMENT_RECOVERY_CONFIG,
  DeploymentRecoveryConfigError,
  validateDeploymentRecoveryConfig,
  type DeploymentRecoveryConfig,
} from '../deploymentRecoveryConfig';
import {
  isDynamicChunkLoadError,
  shouldTriggerChunkReload,
  executeDebouncedReload,
  initDeploymentRecovery,
  isUserInActiveGame,
  checkVersionManifest,
  isUpdateAvailable,
  setUpdateAvailable,
  onUpdateAvailable,
  triggerUpdateReload,
  getClientBuildTime,
} from '../deploymentRecoveryService';

describe('deploymentRecoveryConfig', () => {
  it('validates canonical configuration successfully', () => {
    expect(() => validateDeploymentRecoveryConfig(DEPLOYMENT_RECOVERY_CONFIG)).not.toThrow();
    expect(DEPLOYMENT_RECOVERY_CONFIG.debounceCooldownMs).toBeGreaterThan(0);
    expect(DEPLOYMENT_RECOVERY_CONFIG.storageKey.length).toBeGreaterThan(0);
    expect(DEPLOYMENT_RECOVERY_CONFIG.chunkErrorPatterns.length).toBeGreaterThan(0);
    expect(DEPLOYMENT_RECOVERY_CONFIG.swRegistrationUrl.startsWith('/')).toBe(true);
    expect(DEPLOYMENT_RECOVERY_CONFIG.swScope.startsWith('/')).toBe(true);
    expect(DEPLOYMENT_RECOVERY_CONFIG.swUpdateCheckIntervalMs).toBeGreaterThan(0);
    expect(DEPLOYMENT_RECOVERY_CONFIG.versionCheckEndpoint.startsWith('/')).toBe(true);
    expect(DEPLOYMENT_RECOVERY_CONFIG.versionCheckIntervalMs).toBeGreaterThan(0);
    expect(DEPLOYMENT_RECOVERY_CONFIG.activeGamePathPrefix.startsWith('/')).toBe(true);
    expect(DEPLOYMENT_RECOVERY_CONFIG.nonActiveMatchReloadDelayMs).toBeGreaterThanOrEqual(0);
    expect(DEPLOYMENT_RECOVERY_CONFIG.initialBuildTimeFallback).toBeGreaterThanOrEqual(0);
    expect(typeof DEPLOYMENT_RECOVERY_CONFIG.enableInDevMode).toBe('boolean');
  });

  it('throws when config is null or undefined', () => {
    expect(() => validateDeploymentRecoveryConfig(null as unknown as DeploymentRecoveryConfig)).toThrow(
      DeploymentRecoveryConfigError
    );
    expect(() => validateDeploymentRecoveryConfig(undefined as unknown as DeploymentRecoveryConfig)).toThrow(
      'Configuration object is missing or null.'
    );
  });

  it('throws on invalid storageKey', () => {
    expect(() =>
      validateDeploymentRecoveryConfig({
        ...DEPLOYMENT_RECOVERY_CONFIG,
        storageKey: '',
      })
    ).toThrow('Invalid storageKey: expected non-empty string');

    expect(() =>
      validateDeploymentRecoveryConfig({
        ...DEPLOYMENT_RECOVERY_CONFIG,
        storageKey: '   ',
      })
    ).toThrow('Invalid storageKey: expected non-empty string');
  });

  it('throws on invalid debounceCooldownMs', () => {
    expect(() =>
      validateDeploymentRecoveryConfig({
        ...DEPLOYMENT_RECOVERY_CONFIG,
        debounceCooldownMs: 0,
      })
    ).toThrow('Invalid debounceCooldownMs: expected positive number');

    expect(() =>
      validateDeploymentRecoveryConfig({
        ...DEPLOYMENT_RECOVERY_CONFIG,
        debounceCooldownMs: -100,
      })
    ).toThrow('Invalid debounceCooldownMs: expected positive number');

    expect(() =>
      validateDeploymentRecoveryConfig({
        ...DEPLOYMENT_RECOVERY_CONFIG,
        debounceCooldownMs: NaN,
      })
    ).toThrow('Invalid debounceCooldownMs: expected positive number');
  });

  it('throws on invalid chunkErrorPatterns', () => {
    expect(() =>
      validateDeploymentRecoveryConfig({
        ...DEPLOYMENT_RECOVERY_CONFIG,
        chunkErrorPatterns: [] as unknown as string[],
      })
    ).toThrow('Invalid chunkErrorPatterns: expected non-empty array of strings.');

    expect(() =>
      validateDeploymentRecoveryConfig({
        ...DEPLOYMENT_RECOVERY_CONFIG,
        chunkErrorPatterns: ['valid', ''] as unknown as string[],
      })
    ).toThrow('Invalid chunkErrorPatterns[1]: expected non-empty string');
  });

  it('throws on invalid swRegistrationUrl and swScope', () => {
    expect(() =>
      validateDeploymentRecoveryConfig({
        ...DEPLOYMENT_RECOVERY_CONFIG,
        swRegistrationUrl: 'sw.js',
      })
    ).toThrow('Invalid swRegistrationUrl: expected path starting with "/"');

    expect(() =>
      validateDeploymentRecoveryConfig({
        ...DEPLOYMENT_RECOVERY_CONFIG,
        swScope: 'game',
      })
    ).toThrow('Invalid swScope: expected path starting with "/"');
  });

  it('throws on invalid intervals or endpoints', () => {
    expect(() =>
      validateDeploymentRecoveryConfig({
        ...DEPLOYMENT_RECOVERY_CONFIG,
        swUpdateCheckIntervalMs: -10,
      })
    ).toThrow('Invalid swUpdateCheckIntervalMs: expected positive number');

    expect(() =>
      validateDeploymentRecoveryConfig({
        ...DEPLOYMENT_RECOVERY_CONFIG,
        versionCheckEndpoint: 'version.json',
      })
    ).toThrow('Invalid versionCheckEndpoint: expected path starting with "/"');

    expect(() =>
      validateDeploymentRecoveryConfig({
        ...DEPLOYMENT_RECOVERY_CONFIG,
        versionCheckIntervalMs: 0,
      })
    ).toThrow('Invalid versionCheckIntervalMs: expected positive number');

    expect(() =>
      validateDeploymentRecoveryConfig({
        ...DEPLOYMENT_RECOVERY_CONFIG,
        activeGamePathPrefix: 'game',
      })
    ).toThrow('Invalid activeGamePathPrefix: expected path starting with "/"');

    expect(() =>
      validateDeploymentRecoveryConfig({
        ...DEPLOYMENT_RECOVERY_CONFIG,
        nonActiveMatchReloadDelayMs: -1,
      })
    ).toThrow('Invalid nonActiveMatchReloadDelayMs: expected non-negative number');

    expect(() =>
      validateDeploymentRecoveryConfig({
        ...DEPLOYMENT_RECOVERY_CONFIG,
        initialBuildTimeFallback: -5,
      })
    ).toThrow('Invalid initialBuildTimeFallback: expected non-negative number');

    expect(() =>
      validateDeploymentRecoveryConfig({
        ...DEPLOYMENT_RECOVERY_CONFIG,
        enableInDevMode: 'false' as unknown as boolean,
      })
    ).toThrow('Invalid enableInDevMode: expected boolean');
  });
});

describe('deploymentRecoveryService', () => {
  describe('getClientBuildTime', () => {
    it('returns valid fallback when global __APP_BUILD_TIME__ is undefined', () => {
      const buildTime = getClientBuildTime(DEPLOYMENT_RECOVERY_CONFIG);
      expect(typeof buildTime).toBe('number');
      expect(buildTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('isUserInActiveGame', () => {
    it('accurately identifies active game routes based on prefix', () => {
      expect(isUserInActiveGame('/game/room-123')).toBe(true);
      expect(isUserInActiveGame('/game/')).toBe(true);
      expect(isUserInActiveGame('/')).toBe(false);
      expect(isUserInActiveGame('/learn')).toBe(false);
      expect(isUserInActiveGame('/terms')).toBe(false);
    });
  });

  describe('isDynamicChunkLoadError', () => {
    it('returns true for known Vite chunk import errors', () => {
      expect(
        isDynamicChunkLoadError(new Error('Failed to fetch dynamically imported module: /assets/GameRoom.js'))
      ).toBe(true);

      expect(
        isDynamicChunkLoadError(new Error('TypeError: error loading dynamically imported module'))
      ).toBe(true);

      expect(
        isDynamicChunkLoadError(new Error('Importing a module script failed.'))
      ).toBe(true);

      expect(
        isDynamicChunkLoadError('Failed to fetch dynamically imported module')
      ).toBe(true);

      expect(
        isDynamicChunkLoadError({ reason: { message: 'Failed to fetch dynamically imported module' } })
      ).toBe(true);

      expect(
        isDynamicChunkLoadError(new Error('Unable to preload CSS for /assets/index.css'))
      ).toBe(true);
    });

    it('returns false for unrelated errors', () => {
      expect(isDynamicChunkLoadError(new Error('Network connection lost'))).toBe(false);
      expect(isDynamicChunkLoadError(null)).toBe(false);
      expect(isDynamicChunkLoadError(undefined)).toBe(false);
      expect(isDynamicChunkLoadError({})).toBe(false);
      expect(isDynamicChunkLoadError(new Error('TypeError: Cannot read properties of undefined'))).toBe(false);
    });
  });

  describe('shouldTriggerChunkReload', () => {
    it('allows reload if no prior reload recorded', () => {
      expect(shouldTriggerChunkReload(Date.now(), null)).toBe(true);
      expect(shouldTriggerChunkReload(Date.now(), NaN)).toBe(true);
    });

    it('blocks reload within debounce window', () => {
      const now = 20000;
      const lastReload = 15000; // 5s ago < 10s cooldown
      expect(shouldTriggerChunkReload(now, lastReload)).toBe(false);
    });

    it('permits reload after debounce window has elapsed', () => {
      const now = 25000;
      const lastReload = 10000; // 15s ago > 10s cooldown
      expect(shouldTriggerChunkReload(now, lastReload)).toBe(true);
    });
  });

  describe('checkVersionManifest', () => {
    it('returns true when remote buildTime is newer than currentBuildTime', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ version: '1.1.2', buildTime: 200000 }),
      }) as any;

      const result = await checkVersionManifest(100000);
      expect(result).toBe(true);

      globalThis.fetch = originalFetch;
    });

    it('returns false when remote buildTime is older or equal', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ version: '1.1.1', buildTime: 100000 }),
      }) as any;

      const result = await checkVersionManifest(100000);
      expect(result).toBe(false);

      globalThis.fetch = originalFetch;
    });

    it('handles fetch network errors gracefully', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as any;

      const result = await checkVersionManifest(100000);
      expect(result).toBe(false);

      globalThis.fetch = originalFetch;
    });
  });

  describe('update available event bus', () => {
    it('notifies listeners when update is available and unsubscribes cleanly', () => {
      setUpdateAvailable(false);
      expect(isUpdateAvailable()).toBe(false);

      const listenerA = vi.fn();
      const unsubscribe = onUpdateAvailable(listenerA);

      setUpdateAvailable(true);
      expect(isUpdateAvailable()).toBe(true);
      expect(listenerA).toHaveBeenCalledTimes(1);

      unsubscribe();
      setUpdateAvailable(false);
      setUpdateAvailable(true);
      expect(listenerA).toHaveBeenCalledTimes(1); // not called again
    });
  });

  describe('executeDebouncedReload and initDeploymentRecovery', () => {
    const originalSessionStorage = globalThis.sessionStorage;
    let mockSessionStorage: Record<string, string> = {};
    let reloadMock: ReturnType<typeof vi.fn>;
    const listeners: Record<string, Function[]> = {};

    beforeEach(() => {
      mockSessionStorage = {};
      reloadMock = vi.fn();

      Object.defineProperty(globalThis, 'sessionStorage', {
        value: {
          getItem: (key: string) => mockSessionStorage[key] || null,
          setItem: (key: string, val: string) => {
            mockSessionStorage[key] = val;
          },
          removeItem: (key: string) => {
            delete mockSessionStorage[key];
          },
          clear: () => {
            mockSessionStorage = {};
          },
        },
        writable: true,
        configurable: true,
      });

      (globalThis as any).window = {
        location: { reload: reloadMock, pathname: '/' },
        addEventListener: (event: string, handler: Function) => {
          if (!listeners[event]) listeners[event] = [];
          listeners[event].push(handler);
        },
        removeEventListener: (event: string, handler: Function) => {
          if (listeners[event]) {
            listeners[event] = listeners[event].filter((h) => h !== handler);
          }
        },
        dispatchEvent: (event: any) => {
          if (listeners[event.type]) {
            listeners[event.type].forEach((h) => h(event));
          }
          return true;
        },
      };
    });

    afterEach(() => {
      Object.defineProperty(globalThis, 'sessionStorage', {
        value: originalSessionStorage,
        writable: true,
        configurable: true,
      });
      vi.restoreAllMocks();
    });

    it('executes reload and sets timestamp when eligible', () => {
      const result = executeDebouncedReload();
      expect(result).toBe(true);
      expect(reloadMock).toHaveBeenCalledTimes(1);
      expect(mockSessionStorage[DEPLOYMENT_RECOVERY_CONFIG.storageKey]).toBeDefined();

      // Second immediate attempt should be debounced
      const secondResult = executeDebouncedReload();
      expect(secondResult).toBe(false);
      expect(reloadMock).toHaveBeenCalledTimes(1);
    });

    it('triggerUpdateReload calls executeDebouncedReload', () => {
      const result = triggerUpdateReload();
      expect(result).toBe(true);
      expect(reloadMock).toHaveBeenCalledTimes(1);
    });

    it('attaches and detaches event listeners cleanly via initDeploymentRecovery', () => {
      const addSpy = vi.spyOn((globalThis as any).window, 'addEventListener');
      const removeSpy = vi.spyOn((globalThis as any).window, 'removeEventListener');

      const cleanup = initDeploymentRecovery();
      expect(addSpy).toHaveBeenCalledWith('vite:preloadError', expect.any(Function));
      expect(addSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));

      cleanup();
      expect(removeSpy).toHaveBeenCalledWith('vite:preloadError', expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    });

    it('handles vite:preloadError event when dispatched', () => {
      const cleanup = initDeploymentRecovery();

      const event = new (globalThis as any).Event('vite:preloadError', { cancelable: true });
      (globalThis as any).window.dispatchEvent(event);

      expect(reloadMock).toHaveBeenCalledTimes(1);
      cleanup();
    });

    it('handles unhandledrejection event for chunk failure when dispatched', () => {
      const cleanup = initDeploymentRecovery();

      const event = {
        type: 'unhandledrejection',
        reason: new Error('Failed to fetch dynamically imported module'),
        preventDefault: vi.fn(),
      };
      (globalThis as any).window.dispatchEvent(event);

      expect(reloadMock).toHaveBeenCalledTimes(1);
      expect(event.preventDefault).toHaveBeenCalled();
      cleanup();
    });
  });
});
