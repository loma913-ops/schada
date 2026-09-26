/**
 * Lobby Configuration and Filter State Validation.
 *
 * Centralizes all lobby filtering parameters, time-category cutoffs,
 * storage keys, and default state definitions.
 * Validates configuration to eliminate hard-coded fallback values.
 */

export class LobbyConfigError extends Error {
  constructor(message: string) {
    super(`LobbyConfigError: ${message}`);
    this.name = 'LobbyConfigError';
  }
}

export interface LobbyFilterState {
  readonly timeControls: {
    readonly bullet: boolean;
    readonly blitz: boolean;
    readonly rapid: boolean;
    readonly classical: boolean;
  };
  readonly increment: {
    readonly yes: boolean;
    readonly no: boolean;
  };
  readonly modes: {
    readonly casual: boolean;
    readonly ranked: boolean;
  };
  readonly statuses: {
    readonly open: boolean;
    readonly inProgress: boolean;
  };
}

export interface LobbyConfig {
  readonly storageKey: string;
  readonly bulletCutoffMinutes: number;
  readonly blitzCutoffMinutes: number;
  readonly rapidCutoffMinutes: number;
  readonly estimatedMovesPerGame: number;
  readonly secondsPerMinute: number;
  readonly defaultFilters: LobbyFilterState;
}

export function validateLobbyConfig(config: LobbyConfig): void {
  if (!config) {
    throw new LobbyConfigError('Configuration object is missing or null.');
  }

  if (typeof config.storageKey !== 'string' || config.storageKey.trim().length === 0) {
    throw new LobbyConfigError(
      `Invalid storageKey: expected non-empty string, received "${config.storageKey}".`
    );
  }

  if (typeof config.bulletCutoffMinutes !== 'number' || config.bulletCutoffMinutes <= 0) {
    throw new LobbyConfigError(
      `Invalid bulletCutoffMinutes: expected positive number, received ${config.bulletCutoffMinutes}.`
    );
  }

  if (
    typeof config.blitzCutoffMinutes !== 'number' ||
    config.blitzCutoffMinutes <= config.bulletCutoffMinutes
  ) {
    throw new LobbyConfigError(
      `Invalid blitzCutoffMinutes: expected number strictly greater than bulletCutoffMinutes (${config.bulletCutoffMinutes}), received ${config.blitzCutoffMinutes}.`
    );
  }

  if (
    typeof config.rapidCutoffMinutes !== 'number' ||
    config.rapidCutoffMinutes <= config.blitzCutoffMinutes
  ) {
    throw new LobbyConfigError(
      `Invalid rapidCutoffMinutes: expected number strictly greater than blitzCutoffMinutes (${config.blitzCutoffMinutes}), received ${config.rapidCutoffMinutes}.`
    );
  }

  if (typeof config.estimatedMovesPerGame !== 'number' || config.estimatedMovesPerGame <= 0) {
    throw new LobbyConfigError(
      `Invalid estimatedMovesPerGame: expected positive number, received ${config.estimatedMovesPerGame}.`
    );
  }

  if (typeof config.secondsPerMinute !== 'number' || config.secondsPerMinute !== 60) {
    throw new LobbyConfigError(
      `Invalid secondsPerMinute: expected 60, received ${config.secondsPerMinute}.`
    );
  }

  const { defaultFilters } = config;
  if (!defaultFilters) {
    throw new LobbyConfigError('defaultFilters configuration section is missing.');
  }

  const { timeControls, increment, modes, statuses } = defaultFilters;
  if (
    !timeControls ||
    typeof timeControls.bullet !== 'boolean' ||
    typeof timeControls.blitz !== 'boolean' ||
    typeof timeControls.rapid !== 'boolean' ||
    typeof timeControls.classical !== 'boolean'
  ) {
    throw new LobbyConfigError('Invalid timeControls section in defaultFilters.');
  }

  if (!increment || typeof increment.yes !== 'boolean' || typeof increment.no !== 'boolean') {
    throw new LobbyConfigError('Invalid increment section in defaultFilters.');
  }

  if (!modes || typeof modes.casual !== 'boolean' || typeof modes.ranked !== 'boolean') {
    throw new LobbyConfigError('Invalid modes section in defaultFilters.');
  }

  if (!statuses || typeof statuses.open !== 'boolean' || typeof statuses.inProgress !== 'boolean') {
    throw new LobbyConfigError('Invalid statuses section in defaultFilters.');
  }
}

export const LOBBY_CONFIG: LobbyConfig = Object.freeze({
  storageKey: 'schada_lobby_filters',
  bulletCutoffMinutes: 3,
  blitzCutoffMinutes: 8,
  rapidCutoffMinutes: 25,
  estimatedMovesPerGame: 40,
  secondsPerMinute: 60,
  defaultFilters: Object.freeze({
    timeControls: Object.freeze({
      bullet: true,
      blitz: true,
      rapid: true,
      classical: true,
    }),
    increment: Object.freeze({
      yes: true,
      no: true,
    }),
    modes: Object.freeze({
      casual: true,
      ranked: true,
    }),
    statuses: Object.freeze({
      open: true,
      inProgress: true,
    }),
  }),
});

// Immediately validate canonical lobby configuration at module load time
validateLobbyConfig(LOBBY_CONFIG);

/**
 * Safely parses serialized filter preferences from local storage.
 * Performs deep field-by-field validation, preventing corrupted state
 * from breaking the UI.
 */
export function parseStoredLobbyFilters(
  savedJson: string | null,
  config: LobbyConfig = LOBBY_CONFIG
): LobbyFilterState {
  if (!savedJson) {
    return config.defaultFilters;
  }

  try {
    const parsed = JSON.parse(savedJson);
    if (!parsed || typeof parsed !== 'object') {
      return config.defaultFilters;
    }

    const tc = parsed.timeControls || {};
    const inc = parsed.increment || {};
    const md = parsed.modes || {};
    const st = parsed.statuses || {};

    const defaults = config.defaultFilters;

    return {
      timeControls: {
        bullet: typeof tc.bullet === 'boolean' ? tc.bullet : defaults.timeControls.bullet,
        blitz: typeof tc.blitz === 'boolean' ? tc.blitz : defaults.timeControls.blitz,
        rapid: typeof tc.rapid === 'boolean' ? tc.rapid : defaults.timeControls.rapid,
        classical: typeof tc.classical === 'boolean' ? tc.classical : defaults.timeControls.classical,
      },
      increment: {
        yes: typeof inc.yes === 'boolean' ? inc.yes : defaults.increment.yes,
        no: typeof inc.no === 'boolean' ? inc.no : defaults.increment.no,
      },
      modes: {
        casual: typeof md.casual === 'boolean' ? md.casual : defaults.modes.casual,
        ranked: typeof md.ranked === 'boolean' ? md.ranked : defaults.modes.ranked,
      },
      statuses: {
        open: typeof st.open === 'boolean' ? st.open : defaults.statuses.open,
        inProgress: typeof st.inProgress === 'boolean' ? st.inProgress : defaults.statuses.inProgress,
      },
    };
  } catch {
    return config.defaultFilters;
  }
}

/**
 * Categorizes a time control into bullet, blitz, rapid, or classical.
 * Uses the standard estimated game duration formula:
 * Estimated = minutes + (increment * estimatedMovesPerGame) / secondsPerMinute.
 */
export function determineTimeCategory(
  minutes: number,
  increment: number,
  config: LobbyConfig = LOBBY_CONFIG
): 'bullet' | 'blitz' | 'rapid' | 'classical' {
  if (typeof minutes !== 'number' || minutes < 0 || isNaN(minutes)) {
    throw new TypeError(`Invalid minutes: expected non-negative number, received ${minutes}.`);
  }
  const inc = typeof increment === 'number' && !isNaN(increment) && increment >= 0 ? increment : 0;

  if (minutes === 0) return 'classical';

  const estimated = minutes + (inc * config.estimatedMovesPerGame) / config.secondsPerMinute;
  if (estimated < config.bulletCutoffMinutes) return 'bullet';
  if (estimated < config.blitzCutoffMinutes) return 'blitz';
  if (estimated < config.rapidCutoffMinutes) return 'rapid';
  return 'classical';
}

/**
 * Formats a time control pair into a human-readable display string.
 */
export function formatTimeControlDisplay(minutes: number, increment: number): string {
  if (typeof minutes !== 'number' || isNaN(minutes) || minutes < 0) {
    throw new TypeError(`Invalid minutes: expected non-negative number, received ${minutes}.`);
  }
  const inc = typeof increment === 'number' && !isNaN(increment) && increment >= 0 ? increment : 0;

  if (minutes === 0) return '∞';
  if (minutes === 0.5) return `½+${inc}`;
  if (minutes === 1.5) return `1.5+${inc}`;
  return `${minutes}+${inc}`;
}
