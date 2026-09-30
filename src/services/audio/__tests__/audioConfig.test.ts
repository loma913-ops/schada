import { describe, it, expect } from 'vitest';
import { AUDIO_CONFIG, validateAudioConfig, AudioConfigError } from '../audioConfig';

describe('audioConfig', () => {
  it('validates canonical AUDIO_CONFIG without throwing', () => {
    expect(() => validateAudioConfig(AUDIO_CONFIG)).not.toThrow();
    expect(AUDIO_CONFIG.assets.move).toBe('/sounds/move.mp3');
    expect(AUDIO_CONFIG.assets.capture).toBe('/sounds/capture.mp3');
    expect(AUDIO_CONFIG.debounce.moveDebounceMs).toBe(40);
  });

  it('throws on null or undefined config', () => {
    expect(() => validateAudioConfig(null as any)).toThrow(AudioConfigError);
    expect(() => validateAudioConfig(undefined as any)).toThrow('Configuration object is missing or null.');
  });

  it('throws on missing or invalid asset paths', () => {
    const invalid = {
      ...AUDIO_CONFIG,
      assets: { move: '', capture: '/sounds/capture.mp3' },
    };
    expect(() => validateAudioConfig(invalid)).toThrow('Invalid assets.move');
  });

  it('throws on invalid synthesis tone config', () => {
    const invalidTone = {
      ...AUDIO_CONFIG,
      synthesis: {
        ...AUDIO_CONFIG.synthesis,
        moveTransient: {
          ...AUDIO_CONFIG.synthesis.moveTransient,
          startFreq: -10,
        },
      },
    };
    expect(() => validateAudioConfig(invalidTone)).toThrow('Invalid synthesis.moveTransient.startFreq');
  });

  it('throws on invalid debounce config', () => {
    const invalidDebounce = {
      ...AUDIO_CONFIG,
      debounce: {
        ...AUDIO_CONFIG.debounce,
        moveDebounceMs: -5,
      },
    };
    expect(() => validateAudioConfig(invalidDebounce)).toThrow('Invalid debounce.moveDebounceMs');
  });
});
