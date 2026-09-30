import { describe, it, expect } from 'vitest';
import {
  LOBBY_CONFIG,
  validateLobbyConfig,
  LobbyConfigError,
  parseStoredLobbyFilters,
  determineTimeCategory,
  formatTimeControlDisplay,
} from '../lobbyConfig';

describe('LobbyConfig validation and helpers', () => {
  it('canonical LOBBY_CONFIG passes validation', () => {
    expect(() => validateLobbyConfig(LOBBY_CONFIG)).not.toThrow();
  });

  it('throws LobbyConfigError if config object is missing or null', () => {
    expect(() => validateLobbyConfig(null as any)).toThrowError(LobbyConfigError);
    expect(() => validateLobbyConfig(null as any)).toThrowError(
      'LobbyConfigError: Configuration object is missing or null.'
    );
  });

  it('throws if storageKey is empty or not a string', () => {
    const invalidConfig = { ...LOBBY_CONFIG, storageKey: '  ' };
    expect(() => validateLobbyConfig(invalidConfig)).toThrowError(
      /Invalid storageKey/
    );
  });

  it('throws if time category cutoffs are out of order or non-positive', () => {
    const negativeBullet = { ...LOBBY_CONFIG, bulletCutoffMinutes: 0 };
    expect(() => validateLobbyConfig(negativeBullet)).toThrowError(
      /Invalid bulletCutoffMinutes/
    );

    const invertedBlitz = { ...LOBBY_CONFIG, blitzCutoffMinutes: 2 };
    expect(() => validateLobbyConfig(invertedBlitz)).toThrowError(
      /Invalid blitzCutoffMinutes/
    );

    const invertedRapid = { ...LOBBY_CONFIG, rapidCutoffMinutes: 7 };
    expect(() => validateLobbyConfig(invertedRapid)).toThrowError(
      /Invalid rapidCutoffMinutes/
    );
  });

  it('throws if secondsPerMinute is not 60 or estimatedMovesPerGame is non-positive', () => {
    const invalidSeconds = { ...LOBBY_CONFIG, secondsPerMinute: 59 };
    expect(() => validateLobbyConfig(invalidSeconds)).toThrowError(
      /Invalid secondsPerMinute/
    );

    const invalidMoves = { ...LOBBY_CONFIG, estimatedMovesPerGame: -5 };
    expect(() => validateLobbyConfig(invalidMoves)).toThrowError(
      /Invalid estimatedMovesPerGame/
    );
  });

  it('throws if defaultFilters is missing or contains invalid fields', () => {
    const missingFilters = { ...LOBBY_CONFIG, defaultFilters: null as any };
    expect(() => validateLobbyConfig(missingFilters)).toThrowError(
      /defaultFilters configuration section is missing/
    );

    const invalidTimeControls = {
      ...LOBBY_CONFIG,
      defaultFilters: {
        ...LOBBY_CONFIG.defaultFilters,
        timeControls: { bullet: true, blitz: true, rapid: true, classical: 'not-a-bool' as any },
      },
    };
    expect(() => validateLobbyConfig(invalidTimeControls)).toThrowError(
      /Invalid timeControls section/
    );
  });

  describe('parseStoredLobbyFilters', () => {
    it('returns default filters when input is null or invalid json', () => {
      expect(parseStoredLobbyFilters(null)).toEqual(LOBBY_CONFIG.defaultFilters);
      expect(parseStoredLobbyFilters('')).toEqual(LOBBY_CONFIG.defaultFilters);
      expect(parseStoredLobbyFilters('invalid-json')).toEqual(LOBBY_CONFIG.defaultFilters);
      expect(parseStoredLobbyFilters('12345')).toEqual(LOBBY_CONFIG.defaultFilters);
    });

    it('correctly parses valid stored json preferences', () => {
      const customPreferences = {
        timeControls: { bullet: false, blitz: true, rapid: false, classical: true },
        increment: { yes: false, no: true },
        modes: { casual: true, ranked: false },
        statuses: { open: true, inProgress: false },
      };
      const result = parseStoredLobbyFilters(JSON.stringify(customPreferences));
      expect(result).toEqual(customPreferences);
    });

    it('sanitizes partial or corrupt stored json with safe defaults', () => {
      const partialPreferences = {
        timeControls: { bullet: false },
        increment: { yes: 'corrupt' },
      };
      const result = parseStoredLobbyFilters(JSON.stringify(partialPreferences));
      expect(result.timeControls.bullet).toBe(false);
      expect(result.timeControls.blitz).toBe(true);
      expect(result.increment.yes).toBe(true);
      expect(result.statuses.open).toBe(true);
      expect(result.statuses.inProgress).toBe(true);
    });
  });

  describe('determineTimeCategory', () => {
    it('correctly maps various time control durations', () => {
      // 1+0 = 1 min -> bullet
      expect(determineTimeCategory(1, 0)).toBe('bullet');
      // 2+1 = 2 + (1 * 40)/60 = 2.67 min -> bullet
      expect(determineTimeCategory(2, 1)).toBe('bullet');
      // 3+0 = 3 min -> blitz (3 <= estimated < 8)
      expect(determineTimeCategory(3, 0)).toBe('blitz');
      // 5+3 = 5 + (3 * 40)/60 = 7 min -> blitz
      expect(determineTimeCategory(5, 3)).toBe('blitz');
      // 10+0 = 10 min -> rapid (8 <= estimated < 25)
      expect(determineTimeCategory(10, 0)).toBe('rapid');
      // 15+10 = 15 + (10 * 40)/60 = 21.67 min -> rapid
      expect(determineTimeCategory(15, 10)).toBe('rapid');
      // 30+0 = 30 min -> classical (>= 25)
      expect(determineTimeCategory(30, 0)).toBe('classical');
      // 0 minutes = unlimited -> classical
      expect(determineTimeCategory(0, 0)).toBe('classical');
    });

    it('throws on negative or invalid minutes input', () => {
      expect(() => determineTimeCategory(-1, 0)).toThrowError(TypeError);
      expect(() => determineTimeCategory(NaN, 0)).toThrowError(TypeError);
    });

    it('throws on negative or invalid increment input', () => {
      expect(() => determineTimeCategory(5, -1)).toThrowError(TypeError);
      expect(() => determineTimeCategory(5, NaN)).toThrowError(TypeError);
      expect(() => determineTimeCategory(5, 'invalid' as any)).toThrowError(TypeError);
    });
  });

  describe('formatTimeControlDisplay', () => {
    it('formats standard, fractional, and unlimited controls properly', () => {
      expect(formatTimeControlDisplay(0, 0)).toBe('∞');
      expect(formatTimeControlDisplay(0.5, 1)).toBe('½+1');
      expect(formatTimeControlDisplay(1.5, 2)).toBe('1.5+2');
      expect(formatTimeControlDisplay(3, 2)).toBe('3+2');
      expect(formatTimeControlDisplay(10, 0)).toBe('10+0');
    });

    it('throws on negative or invalid minutes input', () => {
      expect(() => formatTimeControlDisplay(-5, 0)).toThrowError(TypeError);
      expect(() => formatTimeControlDisplay(NaN, 0)).toThrowError(TypeError);
    });

    it('throws on negative or invalid increment input', () => {
      expect(() => formatTimeControlDisplay(5, -1)).toThrowError(TypeError);
      expect(() => formatTimeControlDisplay(5, NaN)).toThrowError(TypeError);
      expect(() => formatTimeControlDisplay(5, 'invalid' as any)).toThrowError(TypeError);
    });
  });
});

