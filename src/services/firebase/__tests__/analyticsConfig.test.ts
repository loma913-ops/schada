import { describe, it, expect } from 'vitest';
import {
  ANALYTICS_CONFIG,
  validateAnalyticsConfig,
  validateMeasurementId,
  AnalyticsConfigError,
} from '../analyticsConfig';

describe('analyticsConfig', () => {
  it('validates canonical ANALYTICS_CONFIG without throwing', () => {
    expect(() => validateAnalyticsConfig(ANALYTICS_CONFIG)).not.toThrow();
    expect(ANALYTICS_CONFIG.events.pageView).toBe('page_view');
  });

  it('disables automatic page views and advertising signals by default', () => {
    expect(ANALYTICS_CONFIG.privacy.sendDefaultPageView).toBe(false);
    expect(ANALYTICS_CONFIG.privacy.allowGoogleSignals).toBe(false);
    expect(ANALYTICS_CONFIG.privacy.allowAdPersonalizationSignals).toBe(false);
  });

  it('throws on null or undefined config', () => {
    expect(() => validateAnalyticsConfig(null as any)).toThrow(AnalyticsConfigError);
    expect(() => validateAnalyticsConfig(undefined as any)).toThrow('Configuration object is missing or null.');
  });

  it('throws on non-boolean enabled', () => {
    expect(() => validateAnalyticsConfig({ ...ANALYTICS_CONFIG, enabled: 'true' as any })).toThrow(
      'Invalid enabled: expected boolean.'
    );
  });

  it('throws on invalid maxParamValueLength', () => {
    expect(() => validateAnalyticsConfig({ ...ANALYTICS_CONFIG, maxParamValueLength: 0 })).toThrow(
      'Invalid maxParamValueLength'
    );
    expect(() => validateAnalyticsConfig({ ...ANALYTICS_CONFIG, maxParamValueLength: 1.5 })).toThrow(
      'Invalid maxParamValueLength'
    );
  });

  it('throws on missing or empty event names', () => {
    const invalid = { ...ANALYTICS_CONFIG, events: { pageView: '' } };
    expect(() => validateAnalyticsConfig(invalid)).toThrow('Invalid events.pageView');
  });

  it('throws on non-RegExp measurementIdPattern', () => {
    expect(() => validateAnalyticsConfig({ ...ANALYTICS_CONFIG, measurementIdPattern: 'G-' as any })).toThrow(
      'Invalid measurementIdPattern'
    );
  });

  it('throws on non-boolean privacy settings', () => {
    const invalid = {
      ...ANALYTICS_CONFIG,
      privacy: { ...ANALYTICS_CONFIG.privacy, allowGoogleSignals: undefined as any },
    };
    expect(() => validateAnalyticsConfig(invalid)).toThrow('Invalid privacy.allowGoogleSignals');
  });

  describe('validateMeasurementId', () => {
    it('accepts a valid GA4 measurement ID', () => {
      expect(() => validateMeasurementId('G-EQVZT5ZPMJ')).not.toThrow();
    });

    it('throws a meaningful error when missing or blank', () => {
      expect(() => validateMeasurementId(undefined)).toThrow('VITE_FIREBASE_MEASUREMENT_ID is missing');
      expect(() => validateMeasurementId('   ')).toThrow('VITE_FIREBASE_MEASUREMENT_ID is missing');
    });

    it('throws when the format is invalid', () => {
      expect(() => validateMeasurementId('UA-12345-1')).toThrow('does not match expected format');
    });
  });
});
