/**
 * Mobile Orientation Lock Configuration and Validator.
 *
 * Centralizes all orientation lock settings, thresholds, query strings,
 * device detection regexes, gesture triggers, and UI copy.
 * Validates configuration to eliminate hard-coded fallback values.
 */

export class OrientationConfigError extends Error {
  constructor(message: string) {
    super(`OrientationConfigError: ${message}`);
    this.name = 'OrientationConfigError';
  }
}

export interface OrientationConfig {
  readonly targetOrientation: 'portrait' | 'portrait-primary';
  readonly maxPhoneDimensionPx: number;
  readonly mediaQueries: {
    readonly landscape: string;
    readonly coarsePointer: string;
  };
  readonly gestures: {
    readonly lockTriggerEvents: readonly ('touchstart' | 'pointerdown' | 'click')[];
  };
  readonly userAgentPatterns: {
    readonly mobileRegex: RegExp;
    readonly desktopClassMacPlatformToken: string;
  };
  readonly copy: {
    readonly badgeText: string;
    readonly title: string;
    readonly description: string;
    readonly blockedPillText: string;
    readonly targetPillText: string;
    readonly ariaLabel: string;
  };
}

/**
 * Validates the orientation configuration.
 * Throws OrientationConfigError if config is missing, null, or contains invalid parameters.
 */
export function validateOrientationConfig(config: OrientationConfig): void {
  if (!config) {
    throw new OrientationConfigError('Configuration object is missing or null.');
  }

  if (config.targetOrientation !== 'portrait' && config.targetOrientation !== 'portrait-primary') {
    throw new OrientationConfigError(
      `Invalid targetOrientation: expected "portrait" or "portrait-primary", received "${String(
        config.targetOrientation
      )}".`
    );
  }

  if (
    typeof config.maxPhoneDimensionPx !== 'number' ||
    config.maxPhoneDimensionPx <= 0 ||
    !Number.isFinite(config.maxPhoneDimensionPx)
  ) {
    throw new OrientationConfigError(
      `Invalid maxPhoneDimensionPx: expected positive finite number, received ${String(
        config.maxPhoneDimensionPx
      )}.`
    );
  }

  if (
    !config.mediaQueries ||
    typeof config.mediaQueries.landscape !== 'string' ||
    config.mediaQueries.landscape.trim().length === 0
  ) {
    throw new OrientationConfigError('Invalid mediaQueries.landscape: expected non-empty string.');
  }

  if (
    typeof config.mediaQueries.coarsePointer !== 'string' ||
    config.mediaQueries.coarsePointer.trim().length === 0
  ) {
    throw new OrientationConfigError(
      'Invalid mediaQueries.coarsePointer: expected non-empty string.'
    );
  }

  if (
    !config.gestures ||
    !Array.isArray(config.gestures.lockTriggerEvents) ||
    config.gestures.lockTriggerEvents.length === 0
  ) {
    throw new OrientationConfigError(
      'Invalid gestures.lockTriggerEvents: expected non-empty array of event strings.'
    );
  }

  if (!config.userAgentPatterns || !(config.userAgentPatterns.mobileRegex instanceof RegExp)) {
    throw new OrientationConfigError('Invalid userAgentPatterns.mobileRegex: expected RegExp instance.');
  }

  if (
    typeof config.userAgentPatterns.desktopClassMacPlatformToken !== 'string' ||
    config.userAgentPatterns.desktopClassMacPlatformToken.trim().length === 0
  ) {
    throw new OrientationConfigError(
      'Invalid userAgentPatterns.desktopClassMacPlatformToken: expected non-empty string.'
    );
  }

  if (!config.copy) {
    throw new OrientationConfigError('Invalid copy: expected configuration copy object.');
  }

  const requiredCopyKeys: (keyof OrientationConfig['copy'])[] = [
    'badgeText',
    'title',
    'description',
    'blockedPillText',
    'targetPillText',
    'ariaLabel',
  ];

  for (const key of requiredCopyKeys) {
    if (typeof config.copy[key] !== 'string' || config.copy[key].trim().length === 0) {
      throw new OrientationConfigError(`Invalid copy.${key}: expected non-empty string.`);
    }
  }
}

/**
 * Canonical, immutable Orientation Configuration for Schada.
 */
export const ORIENTATION_CONFIG: OrientationConfig = Object.freeze({
  targetOrientation: 'portrait',
  maxPhoneDimensionPx: 600,
  mediaQueries: {
    landscape: '(orientation: landscape)',
    coarsePointer: '(pointer: coarse)',
  },
  gestures: {
    lockTriggerEvents: Object.freeze(['touchstart', 'pointerdown', 'click'] as const),
  },
  userAgentPatterns: {
    mobileRegex: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i,
    desktopClassMacPlatformToken: 'Macintosh',
  },
  copy: Object.freeze({
    badgeText: 'Portrait Mode Required',
    title: 'Please Rotate Your Device',
    description:
      'Schada is locked in portrait orientation on mobile devices to preserve the 8×8 board layout, player clocks, and move controls. Landscape orientation is not permitted. Please turn your device upright to continue playing.',
    blockedPillText: 'Landscape (Blocked)',
    targetPillText: 'Portrait (Required)',
    ariaLabel: 'Orientation Status',
  }),
});

// Assert configuration validity at module evaluation
validateOrientationConfig(ORIENTATION_CONFIG);
