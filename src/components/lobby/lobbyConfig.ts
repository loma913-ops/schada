/**
 * Lobby Configuration and Filter State Validation.
 *
 * Centralizes all lobby filtering parameters, time-category cutoffs,
 * storage keys, and default state definitions.
 * Validates configuration to eliminate hard-coded fallback values.
 */

import type { GameRoom } from '@/services/firebase/gameTypes';

export class LobbyConfigError extends Error {
  constructor(message: string) {
    super(`LobbyConfigError: ${message}`);
    this.name = 'LobbyConfigError';
  }
}

export type TimeControlCategory =
  | 'bullet'
  | 'blitz'
  | 'rapid'
  | 'classical'
  | 'correspondence';

export interface LobbyFilterState {
  readonly timeControls: {
    readonly bullet: boolean;
    readonly blitz: boolean;
    readonly rapid: boolean;
    readonly classical: boolean;
    readonly correspondence: boolean;
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
  readonly correspondenceCutoffMinutes: number;
  readonly estimatedMovesPerGame: number;
  readonly secondsPerMinute: number;
  readonly defaultFilters: LobbyFilterState;
  readonly sectionTitles: {
    readonly myGames: string;
    readonly availableGames: string;
  };
  readonly emptyAvailableGamesMessage: string;
  readonly emptyAvailableFilteredMessage: string;
  readonly emptyLobbyTitle: string;
  readonly emptyFilterTitle: string;
  readonly emptyLobbyDescription: string;
  readonly emptyFilterDescription: string;
  readonly modeLabels: {
    readonly casual: string;
    readonly ranked: string;
  };
  readonly modalTitles: {
    readonly createMatch: string;
    readonly challengePrefix: string;
  };
}

/**
 * Validates canonical lobby configuration at startup.
 * Throws LobbyConfigError if configuration is missing, null, or contains invalid parameters.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time, checking static numeric cutoffs.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant, perfectly stable across application lifetime.
 */
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

  if (
    typeof config.correspondenceCutoffMinutes !== 'number' ||
    config.correspondenceCutoffMinutes <= config.rapidCutoffMinutes
  ) {
    throw new LobbyConfigError(
      `Invalid correspondenceCutoffMinutes: expected number strictly greater than rapidCutoffMinutes (${config.rapidCutoffMinutes}), received ${config.correspondenceCutoffMinutes}.`
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
    typeof timeControls.classical !== 'boolean' ||
    typeof timeControls.correspondence !== 'boolean'
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

  if (
    !config.sectionTitles ||
    typeof config.sectionTitles.myGames !== 'string' ||
    config.sectionTitles.myGames.trim().length === 0 ||
    typeof config.sectionTitles.availableGames !== 'string' ||
    config.sectionTitles.availableGames.trim().length === 0
  ) {
    throw new LobbyConfigError('Invalid sectionTitles configuration in LobbyConfig.');
  }

  if (
    typeof config.emptyAvailableGamesMessage !== 'string' ||
    config.emptyAvailableGamesMessage.trim().length === 0
  ) {
    throw new LobbyConfigError('Invalid emptyAvailableGamesMessage in LobbyConfig.');
  }

  if (
    typeof config.emptyAvailableFilteredMessage !== 'string' ||
    config.emptyAvailableFilteredMessage.trim().length === 0
  ) {
    throw new LobbyConfigError('Invalid emptyAvailableFilteredMessage in LobbyConfig.');
  }

  if (
    typeof config.emptyLobbyTitle !== 'string' ||
    config.emptyLobbyTitle.trim().length === 0
  ) {
    throw new LobbyConfigError('Invalid emptyLobbyTitle in LobbyConfig.');
  }

  if (
    typeof config.emptyFilterTitle !== 'string' ||
    config.emptyFilterTitle.trim().length === 0
  ) {
    throw new LobbyConfigError('Invalid emptyFilterTitle in LobbyConfig.');
  }

  if (
    typeof config.emptyLobbyDescription !== 'string' ||
    config.emptyLobbyDescription.trim().length === 0
  ) {
    throw new LobbyConfigError('Invalid emptyLobbyDescription in LobbyConfig.');
  }

  if (
    typeof config.emptyFilterDescription !== 'string' ||
    config.emptyFilterDescription.trim().length === 0
  ) {
    throw new LobbyConfigError('Invalid emptyFilterDescription in LobbyConfig.');
  }

  if (
    !config.modeLabels ||
    typeof config.modeLabels.casual !== 'string' ||
    config.modeLabels.casual.trim().length === 0 ||
    typeof config.modeLabels.ranked !== 'string' ||
    config.modeLabels.ranked.trim().length === 0
  ) {
    throw new LobbyConfigError('Invalid modeLabels configuration in LobbyConfig.');
  }

  if (
    !config.modalTitles ||
    typeof config.modalTitles.createMatch !== 'string' ||
    config.modalTitles.createMatch.trim().length === 0 ||
    typeof config.modalTitles.challengePrefix !== 'string' ||
    config.modalTitles.challengePrefix.trim().length === 0
  ) {
    throw new LobbyConfigError('Invalid modalTitles configuration in LobbyConfig.');
  }
}

export const LOBBY_CONFIG: LobbyConfig = Object.freeze({
  storageKey: 'schada_lobby_filters',
  bulletCutoffMinutes: 3,
  blitzCutoffMinutes: 8,
  rapidCutoffMinutes: 25,
  correspondenceCutoffMinutes: 1440,
  estimatedMovesPerGame: 40,
  secondsPerMinute: 60,
  defaultFilters: Object.freeze({
    timeControls: Object.freeze({
      bullet: true,
      blitz: true,
      rapid: true,
      classical: true,
      correspondence: true,
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
  sectionTitles: Object.freeze({
    myGames: 'My Games',
    availableGames: 'Available Games',
  }),
  emptyAvailableGamesMessage: 'No other games available in lobby',
  emptyAvailableFilteredMessage: 'No other games match your filters',
  emptyLobbyTitle: 'No active games in lobby',
  emptyFilterTitle: 'No games match your filters',
  emptyLobbyDescription: 'Create an open room to challenge players or invite friends.',
  emptyFilterDescription: 'Try relaxing your filter settings to see more games.',
  modeLabels: Object.freeze({
    casual: 'Casual',
    ranked: 'Rated',
  }),
  modalTitles: Object.freeze({
    createMatch: 'Create Match',
    challengePrefix: 'Challenge',
  }),
});

// Immediately validate canonical lobby configuration at module load time
validateLobbyConfig(LOBBY_CONFIG);

/**
 * Safely parses serialized filter preferences from local storage.
 * Performs deep field-by-field validation, preventing corrupted state
 * from breaking the UI.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time, bounded JSON parse of fixed schema filter properties.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant, independent of lobby activity.
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
        correspondence: typeof tc.correspondence === 'boolean' ? tc.correspondence : defaults.timeControls.correspondence,
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
 * Categorizes a time control into bullet, blitz, rapid, classical, or correspondence.
 * Uses the standard estimated game duration formula:
 * Estimated = minutes + (increment * estimatedMovesPerGame) / secondsPerMinute.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time arithmetic calculation.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant, fully scalable with zero heap allocation.
 */
export function determineTimeCategory(
  minutes: number,
  increment: number,
  config: LobbyConfig = LOBBY_CONFIG
): TimeControlCategory {
  if (typeof minutes !== 'number' || minutes < 0 || isNaN(minutes)) {
    throw new TypeError(`Invalid minutes: expected non-negative number, received ${minutes}.`);
  }
  if (typeof increment !== 'number' || increment < 0 || isNaN(increment)) {
    throw new TypeError(`Invalid increment: expected non-negative number, received ${increment}.`);
  }

  if (minutes >= config.correspondenceCutoffMinutes) return 'correspondence';
  if (minutes === 0) return 'classical';

  const estimated = minutes + (increment * config.estimatedMovesPerGame) / config.secondsPerMinute;
  if (estimated < config.bulletCutoffMinutes) return 'bullet';
  if (estimated < config.blitzCutoffMinutes) return 'blitz';
  if (estimated < config.rapidCutoffMinutes) return 'rapid';
  if (estimated < config.correspondenceCutoffMinutes) return 'classical';
  return 'correspondence';
}

/**
 * Formats a time control pair into a human-readable display string.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time string formatting.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant, zero non-trivial allocation overhead.
 */
export function formatTimeControlDisplay(
  minutes: number,
  increment: number,
  config: LobbyConfig = LOBBY_CONFIG
): string {
  if (typeof minutes !== 'number' || isNaN(minutes) || minutes < 0) {
    throw new TypeError(`Invalid minutes: expected non-negative number, received ${minutes}.`);
  }
  if (typeof increment !== 'number' || isNaN(increment) || increment < 0) {
    throw new TypeError(`Invalid increment: expected non-negative number, received ${increment}.`);
  }

  if (minutes === 0) return '∞';
  const cutoff = config.correspondenceCutoffMinutes;
  if (minutes >= cutoff && minutes % cutoff === 0) {
    const days = minutes / cutoff;
    return increment > 0 ? `${days}d+${increment}` : `${days}d`;
  }
  if (minutes === 0.5) return `½+${increment}`;
  if (minutes === 1.5) return `1.5+${increment}`;
  return `${minutes}+${increment}`;
}

/**
 * Determines whether a game room belongs to the active player.
 * Checks for authenticated user id, local guest id, and session token ownership.
 *
 * Algorithmic Complexity (Big O):
 * - Time Complexity: O(1) constant scalar string comparisons.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 * - Growth Rate: O(1) constant time, invariant to lobby size or match counts.
 *
 * @param room The game room object.
 * @param userId Signed-in user ID (if authenticated).
 * @param guestId Current guest player ID (if active in browser session).
 * @param sessionToken Active local session token for the game room (if available).
 * @returns true if the game belongs to the current user.
 */
export function isUserGameRoom(
  room: GameRoom,
  userId?: string | null,
  guestId?: string | null,
  sessionToken?: string | null
): boolean {
  if (!room) return false;

  if (userId) {
    if (
      room.bluePlayer?.id === userId ||
      room.greenPlayer?.id === userId ||
      room.targetOpponent?.id === userId
    ) {
      return true;
    }
  }

  if (guestId) {
    if (
      room.bluePlayer?.id === guestId ||
      room.greenPlayer?.id === guestId ||
      room.targetOpponent?.id === guestId
    ) {
      return true;
    }
  }

  if (sessionToken) {
    if (
      (room.bluePlayer?.sessionToken && room.bluePlayer.sessionToken === sessionToken) ||
      (room.greenPlayer?.sessionToken && room.greenPlayer.sessionToken === sessionToken)
    ) {
      return true;
    }
  }

  return false;
}

