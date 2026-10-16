/**
 * Schada Game Format and Time Control Configuration.
 *
 * Centralizes standard match presets, custom pairing options,
 * and friend challenge defaults.
 * Validates configuration to eliminate hard-coded fallback values.
 */

export class FormatConfigError extends Error {
  constructor(message: string) {
    super(`FormatConfigError: ${message}`);
    this.name = 'FormatConfigError';
  }
}

export type TimeControlCategory = 'bullet' | 'blitz' | 'rapid' | 'classical';

const VALID_TIME_CONTROL_CATEGORIES: ReadonlySet<string> = new Set([
  'bullet',
  'blitz',
  'rapid',
  'classical',
]);

export interface TimeControlPreset {
  readonly display: string;
  readonly name: string;
  readonly minutes: number;
  readonly increment: number;
  readonly type: TimeControlCategory;
}

export interface FormatConfig {
  readonly presets: readonly TimeControlPreset[];
  readonly modalSelectableMinutes: readonly number[];
  readonly modalSelectableIncrements: readonly number[];
  readonly defaultMatchMinutes: number;
  readonly defaultIncrementSeconds: number;
  readonly defaultFriendChallenge: {
    readonly minutes: number;
    readonly increment: number;
  };
  readonly realTimeMinutesSequence: readonly number[];
  readonly realTimeIncrementSequence: readonly number[];
  readonly correspondenceDaysSequence: readonly number[];
  readonly defaultCorrespondenceDays: number;
  readonly minutesPerDay: number;
}

/**
 * Validates the FormatConfig at initialization.
 * Throws FormatConfigError if configuration is missing, null, or contains invalid parameters.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(P + M + I + R + C) where P = presets, M = modal minutes, I = modal increments,
 *   R = real-time sequence steps, C = correspondence sequence steps. Strictly bounded O(1) constant time.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space with zero dynamic allocations during validation.
 *
 * Growth Rate:
 * - O(1) constant, perfectly stable regardless of application uptime or match frequency.
 */
export function validateFormatConfig(config: FormatConfig): void {
  if (!config) {
    throw new FormatConfigError('Configuration object is missing or null.');
  }

  if (!Array.isArray(config.presets) || config.presets.length === 0) {
    throw new FormatConfigError('Invalid presets: expected non-empty array of TimeControlPreset.');
  }

  for (let i = 0; i < config.presets.length; i++) {
    const preset = config.presets[i];
    if (!preset || typeof preset !== 'object') {
      throw new FormatConfigError(`Invalid presets[${i}]: expected preset object.`);
    }
    if (typeof preset.display !== 'string' || preset.display.trim().length === 0) {
      throw new FormatConfigError(`Invalid presets[${i}].display: expected non-empty string.`);
    }
    if (typeof preset.name !== 'string' || preset.name.trim().length === 0) {
      throw new FormatConfigError(`Invalid presets[${i}].name: expected non-empty string.`);
    }
    if (typeof preset.minutes !== 'number' || isNaN(preset.minutes) || preset.minutes < 0) {
      throw new FormatConfigError(`Invalid presets[${i}].minutes: expected non-negative number.`);
    }
    if (typeof preset.increment !== 'number' || isNaN(preset.increment) || preset.increment < 0) {
      throw new FormatConfigError(`Invalid presets[${i}].increment: expected non-negative number.`);
    }
    if (!VALID_TIME_CONTROL_CATEGORIES.has(preset.type)) {
      throw new FormatConfigError(
        `Invalid presets[${i}].type: expected one of ${Array.from(VALID_TIME_CONTROL_CATEGORIES).join(', ')}, received "${String(preset.type)}".`
      );
    }
  }

  if (!Array.isArray(config.modalSelectableMinutes) || config.modalSelectableMinutes.length === 0) {
    throw new FormatConfigError('Invalid modalSelectableMinutes: expected non-empty array of numbers.');
  }

  for (const m of config.modalSelectableMinutes) {
    if (typeof m !== 'number' || isNaN(m) || m < 0) {
      throw new FormatConfigError(`Invalid modalSelectableMinutes entry "${m}": expected non-negative number.`);
    }
  }

  if (!Array.isArray(config.modalSelectableIncrements) || config.modalSelectableIncrements.length === 0) {
    throw new FormatConfigError('Invalid modalSelectableIncrements: expected non-empty array of numbers.');
  }

  for (const inc of config.modalSelectableIncrements) {
    if (typeof inc !== 'number' || isNaN(inc) || inc < 0) {
      throw new FormatConfigError(`Invalid modalSelectableIncrements entry "${inc}": expected non-negative number.`);
    }
  }

  if (typeof config.defaultMatchMinutes !== 'number' || isNaN(config.defaultMatchMinutes) || config.defaultMatchMinutes < 0) {
    throw new FormatConfigError('Invalid defaultMatchMinutes: expected non-negative number.');
  }

  if (typeof config.defaultIncrementSeconds !== 'number' || isNaN(config.defaultIncrementSeconds) || config.defaultIncrementSeconds < 0) {
    throw new FormatConfigError('Invalid defaultIncrementSeconds: expected non-negative number.');
  }

  if (!config.defaultFriendChallenge || typeof config.defaultFriendChallenge !== 'object') {
    throw new FormatConfigError('Invalid defaultFriendChallenge: expected configuration object.');
  }

  if (
    typeof config.defaultFriendChallenge.minutes !== 'number' ||
    isNaN(config.defaultFriendChallenge.minutes) ||
    config.defaultFriendChallenge.minutes < 0
  ) {
    throw new FormatConfigError('Invalid defaultFriendChallenge.minutes: expected non-negative number.');
  }

  if (
    typeof config.defaultFriendChallenge.increment !== 'number' ||
    isNaN(config.defaultFriendChallenge.increment) ||
    config.defaultFriendChallenge.increment < 0
  ) {
    throw new FormatConfigError('Invalid defaultFriendChallenge.increment: expected non-negative number.');
  }

  // Correspondence & Slider validations
  if (!Array.isArray(config.realTimeMinutesSequence) || config.realTimeMinutesSequence.length === 0) {
    throw new FormatConfigError('Invalid realTimeMinutesSequence: expected non-empty array of numbers.');
  }
  for (const m of config.realTimeMinutesSequence) {
    if (typeof m !== 'number' || isNaN(m) || m <= 0) {
      throw new FormatConfigError(`Invalid realTimeMinutesSequence entry "${m}": expected positive number.`);
    }
  }

  if (!Array.isArray(config.realTimeIncrementSequence) || config.realTimeIncrementSequence.length === 0) {
    throw new FormatConfigError('Invalid realTimeIncrementSequence: expected non-empty array of numbers.');
  }
  for (const inc of config.realTimeIncrementSequence) {
    if (typeof inc !== 'number' || isNaN(inc) || inc < 0) {
      throw new FormatConfigError(`Invalid realTimeIncrementSequence entry "${inc}": expected non-negative number.`);
    }
  }

  if (!Array.isArray(config.correspondenceDaysSequence) || config.correspondenceDaysSequence.length === 0) {
    throw new FormatConfigError('Invalid correspondenceDaysSequence: expected non-empty array of numbers.');
  }
  for (const d of config.correspondenceDaysSequence) {
    if (typeof d !== 'number' || isNaN(d) || d <= 0) {
      throw new FormatConfigError(`Invalid correspondenceDaysSequence entry "${d}": expected positive number.`);
    }
  }

  if (
    typeof config.defaultCorrespondenceDays !== 'number' ||
    isNaN(config.defaultCorrespondenceDays) ||
    !config.correspondenceDaysSequence.includes(config.defaultCorrespondenceDays)
  ) {
    throw new FormatConfigError('Invalid defaultCorrespondenceDays: expected entry from correspondenceDaysSequence.');
  }

  if (!config.realTimeMinutesSequence.includes(config.defaultMatchMinutes)) {
    throw new FormatConfigError(
      `Invalid defaultMatchMinutes: "${config.defaultMatchMinutes}" not found in realTimeMinutesSequence.`
    );
  }

  if (!config.realTimeIncrementSequence.includes(config.defaultIncrementSeconds)) {
    throw new FormatConfigError(
      `Invalid defaultIncrementSeconds: "${config.defaultIncrementSeconds}" not found in realTimeIncrementSequence.`
    );
  }

  if (!config.realTimeMinutesSequence.includes(config.defaultFriendChallenge.minutes)) {
    throw new FormatConfigError(
      `Invalid defaultFriendChallenge.minutes: "${config.defaultFriendChallenge.minutes}" not found in realTimeMinutesSequence.`
    );
  }

  if (!config.realTimeIncrementSequence.includes(config.defaultFriendChallenge.increment)) {
    throw new FormatConfigError(
      `Invalid defaultFriendChallenge.increment: "${config.defaultFriendChallenge.increment}" not found in realTimeIncrementSequence.`
    );
  }

  if (typeof config.minutesPerDay !== 'number' || config.minutesPerDay !== 1440) {
    throw new FormatConfigError('Invalid minutesPerDay: expected 1440.');
  }
}

const REAL_TIME_MINUTES: readonly number[] = Object.freeze([
  0.5,
  1,
  1.5,
  ...Array.from({ length: 179 }, (_, i) => i + 2),
]);

const REAL_TIME_INCREMENTS: readonly number[] = Object.freeze(
  Array.from({ length: 181 }, (_, i) => i)
);

const CORRESPONDENCE_DAYS: readonly number[] = Object.freeze(
  Array.from({ length: 14 }, (_, i) => i + 1)
);

export const FORMAT_CONFIG: FormatConfig = Object.freeze({
  presets: Object.freeze([
    Object.freeze({ display: '1+0', name: 'Bullet', minutes: 1, increment: 0, type: 'bullet' as const }),
    Object.freeze({ display: '2+1', name: 'Bullet', minutes: 2, increment: 1, type: 'bullet' as const }),
    Object.freeze({ display: '3+0', name: 'Blitz', minutes: 3, increment: 0, type: 'blitz' as const }),
    Object.freeze({ display: '3+2', name: 'Blitz', minutes: 3, increment: 2, type: 'blitz' as const }),
    Object.freeze({ display: '5+0', name: 'Blitz', minutes: 5, increment: 0, type: 'blitz' as const }),
    Object.freeze({ display: '5+3', name: 'Blitz', minutes: 5, increment: 3, type: 'blitz' as const }),
    Object.freeze({ display: '10+0', name: 'Rapid', minutes: 10, increment: 0, type: 'rapid' as const }),
    Object.freeze({ display: '10+5', name: 'Rapid', minutes: 10, increment: 5, type: 'rapid' as const }),
    Object.freeze({ display: '15+10', name: 'Rapid', minutes: 15, increment: 10, type: 'rapid' as const }),
    Object.freeze({ display: '30+0', name: 'Classical', minutes: 30, increment: 0, type: 'classical' as const }),
    Object.freeze({ display: '30+20', name: 'Classical', minutes: 30, increment: 20, type: 'classical' as const }),
  ]),
  modalSelectableMinutes: Object.freeze([1, 3, 5, 10, 0]),
  modalSelectableIncrements: Object.freeze([0, 1, 2, 3, 5]),
  defaultMatchMinutes: 5,
  defaultIncrementSeconds: 0,
  defaultFriendChallenge: Object.freeze({
    minutes: 5,
    increment: 0,
  }),
  realTimeMinutesSequence: REAL_TIME_MINUTES,
  realTimeIncrementSequence: REAL_TIME_INCREMENTS,
  correspondenceDaysSequence: CORRESPONDENCE_DAYS,
  defaultCorrespondenceDays: 2,
  minutesPerDay: 1440,
});

// Validate canonical format configuration at module load time
validateFormatConfig(FORMAT_CONFIG);
