/**
 * Audio Engine Configuration and Validator.
 *
 * Centralizes asset paths, storage keys, synthesis frequencies, ADSR envelopes,
 * and audio debounce thresholds for zero-latency Web Audio playback.
 * Validates configuration to eliminate hard-coded fallback values.
 */

export class AudioConfigError extends Error {
  constructor(message: string) {
    super(`AudioConfigError: ${message}`);
    this.name = 'AudioConfigError';
  }
}

export interface AudioAssetPaths {
  readonly move: string;
  readonly capture: string;
}

export interface AudioStorageKeys {
  readonly soundMuted: string;
}

export interface AudioDebounceConfig {
  readonly moveDebounceMs: number;
  readonly captureDebounceMs: number;
  readonly victoryDebounceMs: number;
}

export interface SynthToneConfig {
  readonly startFreq: number;
  readonly endFreq: number;
  readonly startGain: number;
  readonly duration: number;
  readonly stopDelay: number;
}

export interface AudioSynthesisConfig {
  readonly moveTransient: SynthToneConfig;
  readonly moveBody: SynthToneConfig;
  readonly captureImpact1: SynthToneConfig;
  readonly captureImpact2: SynthToneConfig & { readonly startDelay: number };
  readonly goalChime: {
    readonly triadFrequencies: readonly number[];
    readonly staggerStep: number;
    readonly duration: number;
    readonly gain: number;
  };
  readonly clockTick: {
    readonly freq: number;
    readonly gain: number;
    readonly duration: number;
    readonly stopDelay: number;
  };
  readonly victoryFanfare: {
    readonly noteFrequencies: readonly number[];
    readonly staggerStep: number;
    readonly duration: number;
    readonly gain: number;
  };
}

export interface AudioConfig {
  readonly assets: AudioAssetPaths;
  readonly storageKeys: AudioStorageKeys;
  readonly debounce: AudioDebounceConfig;
  readonly synthesis: AudioSynthesisConfig;
  readonly userActivationEvents: readonly string[];
}

/**
 * Validates a single synthetic tone specification.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 */
function validateTone(tone: SynthToneConfig, label: string): void {
  if (!tone || typeof tone !== 'object') {
    throw new AudioConfigError(`Invalid ${label}: expected tone configuration object.`);
  }
  if (typeof tone.startFreq !== 'number' || tone.startFreq <= 0) {
    throw new AudioConfigError(`Invalid ${label}.startFreq: expected positive number.`);
  }
  if (typeof tone.endFreq !== 'number' || tone.endFreq <= 0) {
    throw new AudioConfigError(`Invalid ${label}.endFreq: expected positive number.`);
  }
  if (typeof tone.startGain !== 'number' || tone.startGain <= 0 || tone.startGain > 1) {
    throw new AudioConfigError(`Invalid ${label}.startGain: expected number in range (0, 1].`);
  }
  if (typeof tone.duration !== 'number' || tone.duration <= 0) {
    throw new AudioConfigError(`Invalid ${label}.duration: expected positive number.`);
  }
  if (typeof tone.stopDelay !== 'number' || tone.stopDelay < tone.duration) {
    throw new AudioConfigError(`Invalid ${label}.stopDelay: must be >= duration.`);
  }
}

/**
 * Validates canonical AudioConfig at startup.
 * Throws AudioConfigError if configuration is missing, null, or contains invalid parameters.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time, static field validations.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant, perfectly stable across runtime.
 */
export function validateAudioConfig(config: AudioConfig): void {
  if (!config) {
    throw new AudioConfigError('Configuration object is missing or null.');
  }

  if (!config.assets || typeof config.assets !== 'object') {
    throw new AudioConfigError('Invalid assets: expected configuration object.');
  }
  if (typeof config.assets.move !== 'string' || config.assets.move.trim().length === 0) {
    throw new AudioConfigError('Invalid assets.move: expected non-empty file path.');
  }
  if (typeof config.assets.capture !== 'string' || config.assets.capture.trim().length === 0) {
    throw new AudioConfigError('Invalid assets.capture: expected non-empty file path.');
  }

  if (!config.storageKeys || typeof config.storageKeys !== 'object') {
    throw new AudioConfigError('Invalid storageKeys: expected configuration object.');
  }
  if (typeof config.storageKeys.soundMuted !== 'string' || config.storageKeys.soundMuted.trim().length === 0) {
    throw new AudioConfigError('Invalid storageKeys.soundMuted: expected non-empty string.');
  }

  if (!config.debounce || typeof config.debounce !== 'object') {
    throw new AudioConfigError('Invalid debounce: expected configuration object.');
  }
  if (typeof config.debounce.moveDebounceMs !== 'number' || config.debounce.moveDebounceMs < 0) {
    throw new AudioConfigError('Invalid debounce.moveDebounceMs: expected non-negative number.');
  }
  if (typeof config.debounce.captureDebounceMs !== 'number' || config.debounce.captureDebounceMs < 0) {
    throw new AudioConfigError('Invalid debounce.captureDebounceMs: expected non-negative number.');
  }
  if (typeof config.debounce.victoryDebounceMs !== 'number' || config.debounce.victoryDebounceMs < 0) {
    throw new AudioConfigError('Invalid debounce.victoryDebounceMs: expected non-negative number.');
  }

  const syn = config.synthesis;
  if (!syn || typeof syn !== 'object') {
    throw new AudioConfigError('Invalid synthesis: expected configuration object.');
  }

  validateTone(syn.moveTransient, 'synthesis.moveTransient');
  validateTone(syn.moveBody, 'synthesis.moveBody');
  validateTone(syn.captureImpact1, 'synthesis.captureImpact1');
  validateTone(syn.captureImpact2, 'synthesis.captureImpact2');

  if (typeof syn.captureImpact2.startDelay !== 'number' || syn.captureImpact2.startDelay <= 0) {
    throw new AudioConfigError('Invalid synthesis.captureImpact2.startDelay: expected positive number.');
  }

  if (!syn.goalChime || !Array.isArray(syn.goalChime.triadFrequencies) || syn.goalChime.triadFrequencies.length === 0) {
    throw new AudioConfigError('Invalid synthesis.goalChime: expected non-empty array of triad frequencies.');
  }

  if (!syn.clockTick || typeof syn.clockTick.freq !== 'number' || syn.clockTick.freq <= 0) {
    throw new AudioConfigError('Invalid synthesis.clockTick: expected positive frequency.');
  }

  if (!syn.victoryFanfare || !Array.isArray(syn.victoryFanfare.noteFrequencies) || syn.victoryFanfare.noteFrequencies.length === 0) {
    throw new AudioConfigError('Invalid synthesis.victoryFanfare: expected non-empty array of note frequencies.');
  }

  if (!Array.isArray(config.userActivationEvents) || config.userActivationEvents.length === 0) {
    throw new AudioConfigError('Invalid userActivationEvents: expected non-empty array of event names.');
  }
}

export const AUDIO_CONFIG: AudioConfig = Object.freeze({
  assets: Object.freeze({
    move: '/sounds/move.mp3',
    capture: '/sounds/capture.mp3',
  }),
  storageKeys: Object.freeze({
    soundMuted: 'schada_sound_muted',
  }),
  debounce: Object.freeze({
    moveDebounceMs: 40,
    captureDebounceMs: 40,
    victoryDebounceMs: 2000,
  }),
  synthesis: Object.freeze({
    moveTransient: Object.freeze({
      startFreq: 450,
      endFreq: 110,
      startGain: 0.35,
      duration: 0.04,
      stopDelay: 0.045,
    }),
    moveBody: Object.freeze({
      startFreq: 160,
      endFreq: 55,
      startGain: 0.4,
      duration: 0.06,
      stopDelay: 0.065,
    }),
    captureImpact1: Object.freeze({
      startFreq: 620,
      endFreq: 180,
      startGain: 0.4,
      duration: 0.035,
      stopDelay: 0.04,
    }),
    captureImpact2: Object.freeze({
      startDelay: 0.022,
      startFreq: 200,
      endFreq: 65,
      startGain: 0.45,
      duration: 0.055,
      stopDelay: 0.06,
    }),
    goalChime: Object.freeze({
      triadFrequencies: Object.freeze([523.25, 659.25, 783.99]),
      staggerStep: 0.06,
      duration: 0.38,
      gain: 0.2,
    }),
    clockTick: Object.freeze({
      freq: 800,
      gain: 0.1,
      duration: 0.03,
      stopDelay: 0.035,
    }),
    victoryFanfare: Object.freeze({
      noteFrequencies: Object.freeze([440, 554.37, 659.25, 880]),
      staggerStep: 0.1,
      duration: 0.35,
      gain: 0.2,
    }),
  }),
  userActivationEvents: Object.freeze([
    'pointerdown',
    'mousedown',
    'touchstart',
    'touchend',
    'keydown',
    'click',
  ]),
});

// Self-validate canonical audio configuration upon module load
validateAudioConfig(AUDIO_CONFIG);
