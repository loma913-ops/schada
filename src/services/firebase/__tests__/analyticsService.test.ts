import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockLogEvent, mockInitAnalytics } = vi.hoisted(() => ({
  mockLogEvent: vi.fn(),
  mockInitAnalytics: vi.fn(),
}));

vi.mock('firebase/analytics', () => ({
  logEvent: mockLogEvent,
}));

vi.mock('../config', () => ({
  initAnalytics: mockInitAnalytics,
}));

import { logAnalyticsEvent, logPageView, sanitizeEventParams } from '../analyticsService';
import { ANALYTICS_CONFIG } from '../analyticsConfig';

const fakeAnalytics = { app: {} };

describe('analyticsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInitAnalytics.mockResolvedValue(fakeAnalytics);
  });

  it('rejects empty or whitespace-only event names without dispatching', async () => {
    expect(await logAnalyticsEvent('')).toBe(false);
    expect(await logAnalyticsEvent('   ')).toBe(false);
    expect(mockLogEvent).not.toHaveBeenCalled();
  });

  it('resolves false when analytics is unavailable (mock mode / unsupported)', async () => {
    mockInitAnalytics.mockResolvedValue(null);
    expect(await logAnalyticsEvent('test_event')).toBe(false);
    expect(mockLogEvent).not.toHaveBeenCalled();
  });

  it('fails soft when the SDK throws', async () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    mockLogEvent.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    expect(await logAnalyticsEvent('test_event')).toBe(false);
    debugSpy.mockRestore();
  });

  it('truncates long strings and drops non-finite numbers', () => {
    const longString = 'a'.repeat(ANALYTICS_CONFIG.maxParamValueLength + 50);
    const sanitized = sanitizeEventParams({ str: longString, num: 42, bool: true, nan: NaN });
    expect((sanitized.str as string).length).toBe(ANALYTICS_CONFIG.maxParamValueLength);
    expect(sanitized.num).toBe(42);
    expect(sanitized.bool).toBe(true);
    expect('nan' in sanitized).toBe(false);
  });

  it('dispatches sanitized events', async () => {
    expect(await logAnalyticsEvent('test_event', { numParam: 7 })).toBe(true);
    expect(mockLogEvent).toHaveBeenCalledWith(fakeAnalytics, 'test_event', { numParam: 7 });
  });

  it('logs page views and skips consecutive duplicate paths', async () => {
    expect(await logPageView('/donate')).toBe(true);
    expect(await logPageView('/donate')).toBe(false);
    expect(await logPageView('/')).toBe(true);

    expect(mockLogEvent).toHaveBeenCalledTimes(2);
    expect(mockLogEvent).toHaveBeenNthCalledWith(1, fakeAnalytics, ANALYTICS_CONFIG.events.pageView, {
      page_path: '/donate',
    });
  });
});
