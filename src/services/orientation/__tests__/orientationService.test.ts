import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  if (typeof (globalThis as any).window === 'undefined') {
    (globalThis as any).window = {
      navigator: { userAgent: '', maxTouchPoints: 0 },
      screen: {
        orientation: {
          type: 'portrait-primary',
          lock: () => Promise.resolve(),
        },
      },
      addEventListener: () => {},
      removeEventListener: () => {},
      matchMedia: () => ({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
      innerWidth: 1024,
      innerHeight: 768,
    };
  }
});

import {
  isMobileDevice,
  isLandscapeOrientation,
  shouldBlockMobileLandscape,
  lockOrientationToPortrait,
  registerOrientationLockGestures,
} from '../orientationService';

describe('orientationService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('isMobileDevice', () => {
    it('identifies iPhone as mobile device with touch', () => {
      const iphoneUA =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
      const mockWin = {
        navigator: { userAgent: iphoneUA, maxTouchPoints: 5 },
        matchMedia: vi.fn().mockReturnValue({ matches: true }),
        innerWidth: 390,
        innerHeight: 844,
      } as unknown as Window;

      expect(isMobileDevice(iphoneUA, mockWin)).toBe(true);
    });

    it('identifies Android Mobile as mobile device with touch', () => {
      const androidUA =
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36';
      const mockWin = {
        navigator: { userAgent: androidUA, maxTouchPoints: 5 },
        matchMedia: vi.fn().mockReturnValue({ matches: true }),
        innerWidth: 412,
        innerHeight: 892,
      } as unknown as Window;

      expect(isMobileDevice(androidUA, mockWin)).toBe(true);
    });

    it('identifies iPad with desktop UA spoofing (Macintosh + touch points > 1)', () => {
      const ipadUA =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
      const mockWin = {
        navigator: { userAgent: ipadUA, maxTouchPoints: 5 },
        matchMedia: vi.fn().mockReturnValue({ matches: true }),
        innerWidth: 820,
        innerHeight: 1180,
      } as unknown as Window;

      expect(isMobileDevice(ipadUA, mockWin)).toBe(true);
    });

    it('identifies standard Windows Desktop as NOT mobile', () => {
      const windowsUA =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
      const mockWin = {
        navigator: { userAgent: windowsUA, maxTouchPoints: 0 },
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
        innerWidth: 1920,
        innerHeight: 1080,
      } as unknown as Window;

      expect(isMobileDevice(windowsUA, mockWin)).toBe(false);
    });

    it('identifies macOS Desktop with mouse as NOT mobile', () => {
      const macUA =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
      const mockWin = {
        navigator: { userAgent: macUA, maxTouchPoints: 0 },
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
        innerWidth: 1440,
        innerHeight: 900,
      } as unknown as Window;

      expect(isMobileDevice(macUA, mockWin)).toBe(false);
    });

    it('identifies touch device with small phone dimensions (min <= 600) as mobile', () => {
      const genericUA = 'Mozilla/5.0 SomeBrowser';
      const mockWin = {
        navigator: { userAgent: genericUA, maxTouchPoints: 2 },
        matchMedia: vi.fn((query: string) => ({
          matches: query.includes('pointer: coarse'),
        })),
        innerWidth: 400,
        innerHeight: 800,
      } as unknown as Window;

      expect(isMobileDevice(genericUA, mockWin)).toBe(true);
    });
  });

  describe('isLandscapeOrientation', () => {
    it('detects landscape from screen.orientation.type', () => {
      const mockWin = {
        screen: {
          orientation: { type: 'landscape-primary' },
        },
        matchMedia: vi.fn().mockReturnValue({ matches: true }),
        innerWidth: 844,
        innerHeight: 390,
      } as unknown as Window;

      expect(isLandscapeOrientation(mockWin)).toBe(true);
    });

    it('detects portrait from screen.orientation.type', () => {
      const mockWin = {
        screen: {
          orientation: { type: 'portrait-primary' },
        },
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
        innerWidth: 390,
        innerHeight: 844,
      } as unknown as Window;

      expect(isLandscapeOrientation(mockWin)).toBe(false);
    });

    it('falls back to matchMedia when screen.orientation is absent', () => {
      const mockWin = {
        screen: {},
        matchMedia: vi.fn((query: string) => ({
          matches: query.includes('landscape'),
        })),
        innerWidth: 800,
        innerHeight: 400,
      } as unknown as Window;

      expect(isLandscapeOrientation(mockWin)).toBe(true);
    });

    it('falls back to window dimensions when matchMedia is absent', () => {
      const mockWin = {
        screen: {},
        innerWidth: 800,
        innerHeight: 400,
      } as unknown as Window;

      expect(isLandscapeOrientation(mockWin)).toBe(true);

      const portraitWin = {
        screen: {},
        innerWidth: 400,
        innerHeight: 800,
      } as unknown as Window;

      expect(isLandscapeOrientation(portraitWin)).toBe(false);
    });
  });

  describe('shouldBlockMobileLandscape', () => {
    const iphoneUA =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    const desktopUA =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

    it('BLOCKS iPhone when in landscape orientation', () => {
      const mockWin = {
        navigator: { userAgent: iphoneUA, maxTouchPoints: 5 },
        matchMedia: vi.fn((query: string) => ({
          matches: query.includes('landscape') || query.includes('pointer: coarse'),
        })),
        screen: { orientation: { type: 'landscape-primary' } },
        innerWidth: 844,
        innerHeight: 390,
      } as unknown as Window;

      expect(shouldBlockMobileLandscape(iphoneUA, mockWin)).toBe(true);
    });

    it('DOES NOT BLOCK iPhone when in portrait orientation', () => {
      const mockWin = {
        navigator: { userAgent: iphoneUA, maxTouchPoints: 5 },
        matchMedia: vi.fn((query: string) => ({
          matches: query.includes('pointer: coarse'),
        })),
        screen: { orientation: { type: 'portrait-primary' } },
        innerWidth: 390,
        innerHeight: 844,
      } as unknown as Window;

      expect(shouldBlockMobileLandscape(iphoneUA, mockWin)).toBe(false);
    });

    it('DOES NOT BLOCK Desktop even in landscape orientation', () => {
      const mockWin = {
        navigator: { userAgent: desktopUA, maxTouchPoints: 0 },
        matchMedia: vi.fn((query: string) => ({
          matches: query.includes('landscape'),
        })),
        screen: { orientation: { type: 'landscape-primary' } },
        innerWidth: 1920,
        innerHeight: 1080,
      } as unknown as Window;

      expect(shouldBlockMobileLandscape(desktopUA, mockWin)).toBe(false);
    });
  });

  describe('lockOrientationToPortrait', () => {
    it('calls screen.orientation.lock with "portrait" when supported', async () => {
      const lockMock = vi.fn().mockResolvedValue(undefined);
      const originalScreen = window.screen;

      Object.defineProperty(window, 'screen', {
        value: {
          orientation: { lock: lockMock },
        },
        configurable: true,
        writable: true,
      });

      const result = await lockOrientationToPortrait();
      expect(lockMock).toHaveBeenCalledWith('portrait');
      expect(result).toBe(true);

      Object.defineProperty(window, 'screen', {
        value: originalScreen,
        configurable: true,
        writable: true,
      });
    });

    it('catches and handles lock rejection gracefully without throwing', async () => {
      const lockMock = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
      const originalScreen = window.screen;

      Object.defineProperty(window, 'screen', {
        value: {
          orientation: { lock: lockMock },
        },
        configurable: true,
        writable: true,
      });

      const result = await lockOrientationToPortrait();
      expect(result).toBe(false);

      Object.defineProperty(window, 'screen', {
        value: originalScreen,
        configurable: true,
        writable: true,
      });
    });
  });

  describe('registerOrientationLockGestures', () => {
    it('adds and removes event listeners cleanly', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      const removeSpy = vi.spyOn(window, 'removeEventListener');

      const cleanup = registerOrientationLockGestures();

      expect(addSpy).toHaveBeenCalledWith('touchstart', expect.any(Function), expect.any(Object));
      expect(addSpy).toHaveBeenCalledWith('pointerdown', expect.any(Function), expect.any(Object));
      expect(addSpy).toHaveBeenCalledWith('click', expect.any(Function), expect.any(Object));

      cleanup();

      expect(removeSpy).toHaveBeenCalledWith('touchstart', expect.any(Function), expect.any(Object));
      expect(removeSpy).toHaveBeenCalledWith('pointerdown', expect.any(Function), expect.any(Object));
      expect(removeSpy).toHaveBeenCalledWith('click', expect.any(Function), expect.any(Object));
    });
  });

  describe('configuration error handling', () => {
    it('throws OrientationConfigError if invalid config is passed to orientation methods', async () => {
      const invalidConfig = null as any;

      expect(() => isMobileDevice(undefined, undefined, invalidConfig)).toThrowError(
        /OrientationConfigError/
      );
      expect(() => isLandscapeOrientation(undefined, invalidConfig)).toThrowError(
        /OrientationConfigError/
      );
      expect(() => shouldBlockMobileLandscape(undefined, undefined, invalidConfig)).toThrowError(
        /OrientationConfigError/
      );
      await expect(lockOrientationToPortrait(invalidConfig)).rejects.toThrowError(
        /OrientationConfigError/
      );
      expect(() => registerOrientationLockGestures(invalidConfig)).toThrowError(
        /OrientationConfigError/
      );
    });
  });
});
