import { describe, it, expect } from 'vitest';
import { FORMAT_CONFIG, validateFormatConfig, FormatConfigError } from '../formatConfig';

describe('formatConfig', () => {
  it('validates canonical FORMAT_CONFIG without errors', () => {
    expect(() => validateFormatConfig(FORMAT_CONFIG)).not.toThrow();
    expect(FORMAT_CONFIG.presets.length).toBeGreaterThan(0);
    expect(FORMAT_CONFIG.modalSelectableMinutes).toContain(5);
    expect(FORMAT_CONFIG.modalSelectableIncrements).toContain(0);
  });

  it('throws FormatConfigError when config is null or undefined', () => {
    expect(() => validateFormatConfig(null as any)).toThrow(FormatConfigError);
    expect(() => validateFormatConfig(undefined as any)).toThrow('Configuration object is missing or null.');
  });

  it('throws on invalid presets or invalid category types', () => {
    const invalidConfig = {
      ...FORMAT_CONFIG,
      presets: [
        { display: '10+0', name: 'Rapid', minutes: 10, increment: 0, type: 'invalid_type' as any },
      ],
    };
    expect(() => validateFormatConfig(invalidConfig)).toThrow('Invalid presets[0].type');
  });

  it('throws on negative modalSelectableMinutes or increments', () => {
    const invalidMinutes = {
      ...FORMAT_CONFIG,
      modalSelectableMinutes: [-1, 5],
    };
    expect(() => validateFormatConfig(invalidMinutes)).toThrow('Invalid modalSelectableMinutes');

    const invalidIncrements = {
      ...FORMAT_CONFIG,
      modalSelectableIncrements: [-2],
    };
    expect(() => validateFormatConfig(invalidIncrements)).toThrow('Invalid modalSelectableIncrements');
  });

  it('throws on invalid defaultFriendChallenge', () => {
    const invalidFriend = {
      ...FORMAT_CONFIG,
      defaultFriendChallenge: { minutes: -1, increment: 0 },
    };
    expect(() => validateFormatConfig(invalidFriend)).toThrow('Invalid defaultFriendChallenge.minutes');
  });
});
