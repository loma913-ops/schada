import { describe, it, expect } from 'vitest';
import {
  PWA_CONFIG,
  PwaConfigError,
  validatePwaConfig,
  type PwaConfig,
} from '../pwaConfig';

describe('PWA Configuration and Validator', () => {
  it('validates canonical PWA_CONFIG without throwing', () => {
    expect(() => validatePwaConfig(PWA_CONFIG)).not.toThrow();
  });

  it('throws PwaConfigError when configuration is null or undefined', () => {
    expect(() => validatePwaConfig(null as unknown as PwaConfig)).toThrow(PwaConfigError);
    expect(() => validatePwaConfig(undefined as unknown as PwaConfig)).toThrow(
      'Configuration object is missing or null.'
    );
  });

  it('validates storageKey constraints', () => {
    expect(() =>
      validatePwaConfig({
        ...PWA_CONFIG,
        storageKey: '',
      })
    ).toThrow(PwaConfigError);

    expect(() =>
      validatePwaConfig({
        ...PWA_CONFIG,
        storageKey: '   ',
      })
    ).toThrow('Invalid storageKey: expected non-empty string');
  });

  it('validates dismissedValue constraints', () => {
    expect(() =>
      validatePwaConfig({
        ...PWA_CONFIG,
        dismissedValue: '',
      })
    ).toThrow('Invalid dismissedValue: expected non-empty string');
  });

  it('validates delays and enforces positive finite numbers', () => {
    expect(() =>
      validatePwaConfig({
        ...PWA_CONFIG,
        delays: null as unknown as PwaConfig['delays'],
      })
    ).toThrow('Configuration missing delays specification.');

    expect(() =>
      validatePwaConfig({
        ...PWA_CONFIG,
        delays: { ...PWA_CONFIG.delays, androidPromptDelayMs: -1 },
      })
    ).toThrow('Invalid delays.androidPromptDelayMs');

    expect(() =>
      validatePwaConfig({
        ...PWA_CONFIG,
        delays: { ...PWA_CONFIG.delays, iosPromptDelayMs: 0 },
      })
    ).toThrow('Invalid delays.iosPromptDelayMs');

    expect(() =>
      validatePwaConfig({
        ...PWA_CONFIG,
        delays: { ...PWA_CONFIG.delays, installedSuccessDismissDelayMs: NaN },
      })
    ).toThrow('Invalid delays.installedSuccessDismissDelayMs');
  });

  it('validates activeGamePathPrefix must start with /', () => {
    expect(() =>
      validatePwaConfig({
        ...PWA_CONFIG,
        activeGamePathPrefix: 'game/',
      })
    ).toThrow('Invalid activeGamePathPrefix: expected non-empty path starting with "/"');
  });

  it('validates mediaQueries and referrerProtocols', () => {
    expect(() =>
      validatePwaConfig({
        ...PWA_CONFIG,
        mediaQueries: { standalone: '' },
      })
    ).toThrow('Invalid mediaQueries.standalone');

    expect(() =>
      validatePwaConfig({
        ...PWA_CONFIG,
        referrerProtocols: { androidApp: '' },
      })
    ).toThrow('Invalid referrerProtocols.androidApp');
  });

  it('validates userAgentPatterns.appleDeviceRegex must be RegExp', () => {
    expect(() =>
      validatePwaConfig({
        ...PWA_CONFIG,
        userAgentPatterns: { appleDeviceRegex: 'iphone' as unknown as RegExp },
      })
    ).toThrow('Invalid userAgentPatterns.appleDeviceRegex');
  });

  it('validates copy labels must be non-empty strings', () => {
    expect(() =>
      validatePwaConfig({
        ...PWA_CONFIG,
        copy: null as unknown as PwaConfig['copy'],
      })
    ).toThrow('Invalid copy: expected configuration copy object.');

    expect(() =>
      validatePwaConfig({
        ...PWA_CONFIG,
        copy: { ...PWA_CONFIG.copy, installAppButtonText: '' },
      })
    ).toThrow('Invalid copy.installAppButtonText: expected non-empty string.');
  });
});
