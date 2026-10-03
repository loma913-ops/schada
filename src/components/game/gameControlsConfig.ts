/**
 * Game Controls Configuration and Validator.
 *
 * Centralizes button copy, titles, ARIA labels, and confirmation dialog copy
 * for GameControls actions (Resign, Draw, Flip, Sound, Results, Lobby).
 * Validates configuration to eliminate hard-coded fallback values.
 *
 * Algorithmic Complexity:
 * - Validation: O(1) time, O(1) space
 */

export class GameControlsConfigError extends Error {
  constructor(message: string) {
    super(`GameControlsConfigError: ${message}`);
    this.name = 'GameControlsConfigError';
  }
}

export interface GameControlsConfig {
  readonly copy: {
    readonly resignConfirmTitle: string;
    readonly resignButtonText: string;
    readonly cancelButtonText: string;
    readonly resultsButtonText: string;
    readonly resultsButtonAriaLabel: string;
    readonly resultsButtonTitle: string;
    readonly lobbyButtonText: string;
    readonly lobbyButtonAriaLabel: string;
    readonly lobbyButtonTitle: string;
    readonly resignButtonAriaLabel: string;
    readonly resignButtonTitle: string;
    readonly drawButtonText: string;
    readonly drawButtonAriaLabel: string;
    readonly drawButtonTitle: string;
    readonly flipButtonText: string;
    readonly flipButtonAriaLabel: string;
    readonly flipButtonTitle: string;
    readonly muteButtonAriaLabel: string;
    readonly unmuteButtonAriaLabel: string;
    readonly muteButtonTitle: string;
    readonly unmuteButtonTitle: string;
  };
}

/**
 * Validates the GameControls configuration.
 * Throws GameControlsConfigError if configuration is missing, null, or has empty/invalid values.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time, checking static object properties.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant.
 */
export function validateGameControlsConfig(config: GameControlsConfig): void {
  if (!config) {
    throw new GameControlsConfigError('Configuration object is missing or null.');
  }

  if (!config.copy) {
    throw new GameControlsConfigError('Configuration missing copy specification.');
  }

  const requiredCopyKeys: (keyof GameControlsConfig['copy'])[] = [
    'resignConfirmTitle',
    'resignButtonText',
    'cancelButtonText',
    'resultsButtonText',
    'resultsButtonAriaLabel',
    'resultsButtonTitle',
    'lobbyButtonText',
    'lobbyButtonAriaLabel',
    'lobbyButtonTitle',
    'resignButtonAriaLabel',
    'resignButtonTitle',
    'drawButtonText',
    'drawButtonAriaLabel',
    'drawButtonTitle',
    'flipButtonText',
    'flipButtonAriaLabel',
    'flipButtonTitle',
    'muteButtonAriaLabel',
    'unmuteButtonAriaLabel',
    'muteButtonTitle',
    'unmuteButtonTitle',
  ];

  for (const key of requiredCopyKeys) {
    if (typeof config.copy[key] !== 'string' || config.copy[key].trim().length === 0) {
      throw new GameControlsConfigError(`Invalid copy.${key}: expected non-empty string.`);
    }
  }
}

/**
 * Canonical, immutable Game Controls configuration.
 */
export const GAME_CONTROLS_CONFIG: GameControlsConfig = Object.freeze({
  copy: Object.freeze({
    resignConfirmTitle: 'Are you sure you want to resign?',
    resignButtonText: 'Resign',
    cancelButtonText: 'Cancel',
    resultsButtonText: 'Results',
    resultsButtonAriaLabel: 'Results',
    resultsButtonTitle: 'View Match Results',
    lobbyButtonText: 'Lobby',
    lobbyButtonAriaLabel: 'Lobby',
    lobbyButtonTitle: 'Exit to Lobby',
    resignButtonAriaLabel: 'Resign',
    resignButtonTitle: 'Resign Game',
    drawButtonText: 'Draw',
    drawButtonAriaLabel: 'Draw',
    drawButtonTitle: 'Offer Draw',
    flipButtonText: 'Flip',
    flipButtonAriaLabel: 'Flip',
    flipButtonTitle: 'Flip Board Orientation',
    muteButtonAriaLabel: 'Mute Sound',
    unmuteButtonAriaLabel: 'Unmute Sound',
    muteButtonTitle: 'Mute Sound',
    unmuteButtonTitle: 'Unmute Sound',
  }),
});
