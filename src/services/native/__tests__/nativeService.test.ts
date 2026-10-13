import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  NATIVE_CONFIG,
  validateNativeConfig,
  NativeConfigError,
  type NativeConfig,
} from '../nativeConfig';
import {
  isNativePlatform,
  getPlatform,
  getShareBaseUrl,
  copyToClipboard,
  applyNativeSystemBarStyle,
  initNativeMobileServices,
  mobileHaptics,
} from '../mobileService';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { App as CapApp } from '@capacitor/app';

vi.mock('@capacitor/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@capacitor/core')>();
  return {
    ...actual,
    SystemBars: {
      setStyle: vi.fn().mockResolvedValue(undefined),
    },
    SystemBarsStyle: {
      Dark: 'DARK',
      Light: 'LIGHT',
      Default: 'DEFAULT',
    },
  };
});

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn().mockReturnValue(Promise.resolve({ remove: vi.fn() })),
    minimizeApp: vi.fn().mockResolvedValue(undefined),
    exitApp: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@capacitor/haptics', () => ({
  Haptics: {
    impact: vi.fn().mockResolvedValue(undefined),
    notification: vi.fn().mockResolvedValue(undefined),
  },
  ImpactStyle: {
    Light: 'LIGHT',
    Medium: 'MEDIUM',
    Heavy: 'HEAVY',
  },
  NotificationType: {
    Success: 'SUCCESS',
    Warning: 'WARNING',
    Error: 'ERROR',
  },
}));

describe('Native Configuration Validation', () => {
  it('validates canonical NATIVE_CONFIG successfully without error', () => {
    expect(() => validateNativeConfig(NATIVE_CONFIG)).not.toThrow();
  });

  it('throws NativeConfigError when config is null or undefined', () => {
    expect(() => validateNativeConfig(null as unknown as NativeConfig)).toThrow(NativeConfigError);
  });

  it('throws NativeConfigError when publicWebOrigin is invalid or insecure', () => {
    const invalidConfig = {
      ...NATIVE_CONFIG,
      publicWebOrigin: 'http://insecure-domain.org',
    };
    expect(() => validateNativeConfig(invalidConfig)).toThrow(NativeConfigError);
  });

  it('throws NativeConfigError when clipboardFeedbackDurationMs is invalid', () => {
    const invalidConfig = {
      ...NATIVE_CONFIG,
      clipboardFeedbackDurationMs: -10,
    };
    expect(() => validateNativeConfig(invalidConfig)).toThrow(NativeConfigError);
  });

  it('throws NativeConfigError when haptics impact or notification styles are invalid', () => {
    const invalidImpact = {
      ...NATIVE_CONFIG,
      haptics: { ...NATIVE_CONFIG.haptics, move: 'super-hard' },
    } as unknown as NativeConfig;
    expect(() => validateNativeConfig(invalidImpact)).toThrow(NativeConfigError);

    const invalidVictory = {
      ...NATIVE_CONFIG,
      haptics: { ...NATIVE_CONFIG.haptics, victory: 'invalid' },
    } as unknown as NativeConfig;
    expect(() => validateNativeConfig(invalidVictory)).toThrow(NativeConfigError);
  });

  it('throws NativeConfigError when backButton behavior is invalid', () => {
    const invalidConfig = {
      ...NATIVE_CONFIG,
      backButton: { inGameBehavior: 'crash' },
    } as unknown as NativeConfig;
    expect(() => validateNativeConfig(invalidConfig)).toThrow(NativeConfigError);
  });

  it('throws NativeConfigError when systemBars styles are invalid', () => {
    const invalidDark = {
      ...NATIVE_CONFIG,
      systemBars: { ...NATIVE_CONFIG.systemBars, dark: 'INVALID' },
    } as unknown as NativeConfig;
    expect(() => validateNativeConfig(invalidDark)).toThrow(NativeConfigError);
  });

  it('throws NativeConfigError when forceUpdate is enabled with invalid semver or store URLs', () => {
    const invalidSemver: NativeConfig = {
      ...NATIVE_CONFIG,
      forceUpdate: {
        ...NATIVE_CONFIG.forceUpdate,
        enabled: true,
        minSupportedVersion: 'invalid-semver',
      },
    };
    expect(() => validateNativeConfig(invalidSemver)).toThrow(NativeConfigError);

    const invalidStoreUrl: NativeConfig = {
      ...NATIVE_CONFIG,
      forceUpdate: {
        ...NATIVE_CONFIG.forceUpdate,
        enabled: true,
        storeUrls: {
          android: 'insecure://store',
          ios: 'https://apple.com',
        },
      },
    };
    expect(() => validateNativeConfig(invalidStoreUrl)).toThrow(NativeConfigError);
  });
});

describe('Mobile Service Abstraction & Fallbacks', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports web platform when running outside native container', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('web');

    expect(isNativePlatform()).toBe(false);
    expect(getPlatform()).toBe('web');
  });

  it('returns canonical public web origin when running on native container', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);

    const shareUrl = getShareBaseUrl(NATIVE_CONFIG);
    expect(shareUrl).toBe('https://schada.org');
  });

  it('returns window origin when running on web browser', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);
    const originalWindow = (globalThis as any).window;
    (globalThis as any).window = {
      location: { origin: 'https://custom-domain.org' },
    };

    try {
      const shareUrl = getShareBaseUrl(NATIVE_CONFIG);
      expect(shareUrl).toBe('https://custom-domain.org');
    } finally {
      (globalThis as any).window = originalWindow;
    }
  });

  it('safely no-ops all haptics on non-native web platform', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);
    const impactSpy = vi.spyOn(Haptics, 'impact');
    const notifSpy = vi.spyOn(Haptics, 'notification');

    await mobileHaptics.move();
    await mobileHaptics.capture();
    await mobileHaptics.goal();
    await mobileHaptics.victory();

    expect(impactSpy).not.toHaveBeenCalled();
    expect(notifSpy).not.toHaveBeenCalled();
  });

  it('invokes Capacitor Haptics with mapped styles when running on native platform', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    const impactSpy = vi.spyOn(Haptics, 'impact').mockResolvedValue(undefined);
    const notifSpy = vi.spyOn(Haptics, 'notification').mockResolvedValue(undefined);

    await mobileHaptics.move();
    expect(impactSpy).toHaveBeenCalledWith({ style: ImpactStyle.Light });

    await mobileHaptics.capture();
    expect(impactSpy).toHaveBeenCalledWith({ style: ImpactStyle.Heavy });

    await mobileHaptics.goal();
    expect(impactSpy).toHaveBeenCalledWith({ style: ImpactStyle.Medium });

    await mobileHaptics.victory();
    expect(notifSpy).toHaveBeenCalledWith({ type: NotificationType.Success });
  });

  it('applies SystemBars style on native platform and ignores on web', async () => {
    const setStyleSpy = vi.spyOn(SystemBars, 'setStyle').mockResolvedValue(undefined);

    // Non-native (web)
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);
    await applyNativeSystemBarStyle('dark');
    expect(setStyleSpy).not.toHaveBeenCalled();

    // Native container
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    await applyNativeSystemBarStyle('dark');
    expect(setStyleSpy).toHaveBeenCalledWith({ style: SystemBarsStyle.Dark });

    await applyNativeSystemBarStyle('light');
    expect(setStyleSpy).toHaveBeenCalledWith({ style: SystemBarsStyle.Light });
  });

  it('returns empty cleanup function without adding listeners on web platform', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);
    const addListenerSpy = vi.spyOn(CapApp, 'addListener');

    const cleanup = initNativeMobileServices({
      hasOpenModal: () => false,
      closeActiveModal: vi.fn(),
      isInGameMatch: () => false,
      navigateBack: vi.fn(),
      isAtRootPlayTab: () => false,
    });

    expect(addListenerSpy).not.toHaveBeenCalled();
    expect(typeof cleanup).toBe('function');
    cleanup();
  });

  it('adds backButton listener on native platform and minimizes in active game', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    let registeredCallback: ((data: { canGoBack: boolean }) => void) | undefined;
    vi.spyOn(CapApp, 'addListener').mockImplementation((_event, cb) => {
      registeredCallback = cb as (data: { canGoBack: boolean }) => void;
      return Promise.resolve({ remove: vi.fn() });
    });

    initNativeMobileServices({
      hasOpenModal: () => false,
      closeActiveModal: vi.fn(),
      isInGameMatch: () => true,
      navigateBack: vi.fn(),
      isAtRootPlayTab: () => false,
    });

    expect(CapApp.addListener).toHaveBeenCalledWith('backButton', expect.any(Function));
    registeredCallback?.({ canGoBack: false });
    expect(CapApp.minimizeApp).toHaveBeenCalled();
  });

  it('copies text via clipboard when available and returns false for invalid input', async () => {
    // Non-string input
    expect(await copyToClipboard(null as unknown as string)).toBe(false);

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    const origClipboard = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    });

    try {
      const success = await copyToClipboard('https://schada.org/game/abc123456');
      expect(success).toBe(true);
      expect(writeTextMock).toHaveBeenCalledWith('https://schada.org/game/abc123456');
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        value: origClipboard,
        configurable: true,
        writable: true,
      });
    }
  });
});
