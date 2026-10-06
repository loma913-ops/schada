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

  it('validates correspondence and real-time sequences', () => {
    expect(FORMAT_CONFIG.realTimeMinutesSequence[0]).toBe(0.5);
    expect(FORMAT_CONFIG.realTimeMinutesSequence[1]).toBe(1);
    expect(FORMAT_CONFIG.realTimeMinutesSequence[2]).toBe(1.5);
    expect(FORMAT_CONFIG.realTimeMinutesSequence[3]).toBe(2);
    expect(FORMAT_CONFIG.realTimeMinutesSequence[FORMAT_CONFIG.realTimeMinutesSequence.length - 1]).toBe(180);

    expect(FORMAT_CONFIG.realTimeIncrementSequence[0]).toBe(0);
    expect(FORMAT_CONFIG.realTimeIncrementSequence[FORMAT_CONFIG.realTimeIncrementSequence.length - 1]).toBe(180);

    expect(FORMAT_CONFIG.correspondenceDaysSequence[0]).toBe(1);
    expect(FORMAT_CONFIG.correspondenceDaysSequence[FORMAT_CONFIG.correspondenceDaysSequence.length - 1]).toBe(14);
    expect(FORMAT_CONFIG.defaultCorrespondenceDays).toBe(2);
    expect(FORMAT_CONFIG.minutesPerDay).toBe(1440);
  });

  it('throws on invalid correspondenceDaysSequence or defaultCorrespondenceDays', () => {
    const invalidDays = {
      ...FORMAT_CONFIG,
      correspondenceDaysSequence: [0, 1, 2],
    };
    expect(() => validateFormatConfig(invalidDays)).toThrow('Invalid correspondenceDaysSequence');

    const invalidDefault = {
      ...FORMAT_CONFIG,
      defaultCorrespondenceDays: 99,
    };
    expect(() => validateFormatConfig(invalidDefault)).toThrow('Invalid defaultCorrespondenceDays');

    const invalidMatchMinutes = {
      ...FORMAT_CONFIG,
      defaultMatchMinutes: 999,
    };
    expect(() => validateFormatConfig(invalidMatchMinutes)).toThrow('Invalid defaultMatchMinutes');

    const invalidIncrementSeconds = {
      ...FORMAT_CONFIG,
      defaultIncrementSeconds: 999,
    };
    expect(() => validateFormatConfig(invalidIncrementSeconds)).toThrow('Invalid defaultIncrementSeconds');
  });
});
