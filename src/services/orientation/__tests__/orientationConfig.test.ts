import { describe, it, expect } from 'vitest';
import {
  ORIENTATION_CONFIG,
  validateOrientationConfig,
  OrientationConfigError,
  type OrientationConfig,
} from '../orientationConfig';

describe('OrientationConfig validation and defaults', () => {
  it('canonical ORIENTATION_CONFIG passes validation', () => {
    expect(() => validateOrientationConfig(ORIENTATION_CONFIG)).not.toThrow();
  });

  it('throws OrientationConfigError if config object is missing or null', () => {
    expect(() => validateOrientationConfig(null as any)).toThrowError(OrientationConfigError);
    expect(() => validateOrientationConfig(null as any)).toThrowError(
      'OrientationConfigError: Configuration object is missing or null.'
    );
  });

  it('throws if targetOrientation is not "portrait" or "portrait-primary"', () => {
    const invalidConfig: OrientationConfig = {
      ...ORIENTATION_CONFIG,
      targetOrientation: 'landscape' as any,
    };
    expect(() => validateOrientationConfig(invalidConfig)).toThrowError(
      /Invalid targetOrientation/
    );
  });

  it('throws if maxPhoneDimensionPx is non-positive or not finite', () => {
    const nonPositiveConfig: OrientationConfig = {
      ...ORIENTATION_CONFIG,
      maxPhoneDimensionPx: 0,
    };
    expect(() => validateOrientationConfig(nonPositiveConfig)).toThrowError(
      /Invalid maxPhoneDimensionPx/
    );

    const negativeConfig: OrientationConfig = {
      ...ORIENTATION_CONFIG,
      maxPhoneDimensionPx: -50,
    };
    expect(() => validateOrientationConfig(negativeConfig)).toThrowError(
      /Invalid maxPhoneDimensionPx/
    );

    const nanConfig: OrientationConfig = {
      ...ORIENTATION_CONFIG,
      maxPhoneDimensionPx: NaN,
    };
    expect(() => validateOrientationConfig(nanConfig)).toThrowError(
      /Invalid maxPhoneDimensionPx/
    );
  });

  it('throws if mediaQueries fields are missing or empty', () => {
    const emptyLandscape: OrientationConfig = {
      ...ORIENTATION_CONFIG,
      mediaQueries: {
        ...ORIENTATION_CONFIG.mediaQueries,
        landscape: '   ',
      },
    };
    expect(() => validateOrientationConfig(emptyLandscape)).toThrowError(
      /Invalid mediaQueries\.landscape/
    );

    const emptyCoarse: OrientationConfig = {
      ...ORIENTATION_CONFIG,
      mediaQueries: {
        ...ORIENTATION_CONFIG.mediaQueries,
        coarsePointer: '',
      },
    };
    expect(() => validateOrientationConfig(emptyCoarse)).toThrowError(
      /Invalid mediaQueries\.coarsePointer/
    );
  });

  it('throws if gestures.lockTriggerEvents is empty or missing', () => {
    const emptyEvents: OrientationConfig = {
      ...ORIENTATION_CONFIG,
      gestures: {
        lockTriggerEvents: [] as any,
      },
    };
    expect(() => validateOrientationConfig(emptyEvents)).toThrowError(
      /Invalid gestures\.lockTriggerEvents/
    );
  });

  it('throws if userAgentPatterns is invalid', () => {
    const invalidRegex: OrientationConfig = {
      ...ORIENTATION_CONFIG,
      userAgentPatterns: {
        ...ORIENTATION_CONFIG.userAgentPatterns,
        mobileRegex: 'not-a-regex' as any,
      },
    };
    expect(() => validateOrientationConfig(invalidRegex)).toThrowError(
      /Invalid userAgentPatterns\.mobileRegex/
    );

    const emptyToken: OrientationConfig = {
      ...ORIENTATION_CONFIG,
      userAgentPatterns: {
        ...ORIENTATION_CONFIG.userAgentPatterns,
        desktopClassMacPlatformToken: '   ',
      },
    };
    expect(() => validateOrientationConfig(emptyToken)).toThrowError(
      /Invalid userAgentPatterns\.desktopClassMacPlatformToken/
    );
  });

  it('throws if copy object or any required text field is missing or empty', () => {
    const missingCopy: OrientationConfig = {
      ...ORIENTATION_CONFIG,
      copy: null as any,
    };
    expect(() => validateOrientationConfig(missingCopy)).toThrowError(/Invalid copy/);

    const emptyTitle: OrientationConfig = {
      ...ORIENTATION_CONFIG,
      copy: {
        ...ORIENTATION_CONFIG.copy,
        title: '   ',
      },
    };
    expect(() => validateOrientationConfig(emptyTitle)).toThrowError(/Invalid copy\.title/);

    const emptyBadge: OrientationConfig = {
      ...ORIENTATION_CONFIG,
      copy: {
        ...ORIENTATION_CONFIG.copy,
        badgeText: '',
      },
    };
    expect(() => validateOrientationConfig(emptyBadge)).toThrowError(/Invalid copy\.badgeText/);
  });
});
