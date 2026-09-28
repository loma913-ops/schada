import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.hoisted(() => {
  if (typeof (globalThis as any).window === 'undefined') {
    (globalThis as any).window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
      location: { reload: () => {} },
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
} from '../deploymentRecoveryService';

describe('deploymentRecoveryConfig', () => {
  it('validates canonical configuration successfully', () => {
    expect(() => validateDeploymentRecoveryConfig(DEPLOYMENT_RECOVERY_CONFIG)).not.toThrow();
    expect(DEPLOYMENT_RECOVERY_CONFIG.debounceCooldownMs).toBeGreaterThan(0);
    expect(DEPLOYMENT_RECOVERY_CONFIG.storageKey.length).toBeGreaterThan(0);
    expect(DEPLOYMENT_RECOVERY_CONFIG.chunkErrorPatterns.length).toBeGreaterThan(0);
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
});

describe('deploymentRecoveryService', () => {
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
        location: { reload: reloadMock },
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
