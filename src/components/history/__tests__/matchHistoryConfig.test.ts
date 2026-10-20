import { describe, it, expect } from 'vitest';
import {
  MatchHistoryConfigError,
  validateMatchHistoryConfig,
  CANONICAL_MATCH_HISTORY_CONFIG,
  type MatchHistoryConfig,
} from '../matchHistoryConfig';

describe('Match History Configuration Validator', () => {
  it('validates canonical configuration without errors', () => {
    expect(() => validateMatchHistoryConfig(CANONICAL_MATCH_HISTORY_CONFIG)).not.toThrow();
  });

  it('throws on null or undefined config', () => {
    expect(() => validateMatchHistoryConfig(null as unknown as MatchHistoryConfig)).toThrow(
      MatchHistoryConfigError
    );
  });

  it('throws on empty tabs array', () => {
    const invalid = {
      ...CANONICAL_MATCH_HISTORY_CONFIG,
      tabs: [],
    };
    expect(() => validateMatchHistoryConfig(invalid)).toThrow(MatchHistoryConfigError);
  });

  it('throws on invalid tab category id', () => {
    const invalid = {
      ...CANONICAL_MATCH_HISTORY_CONFIG,
      tabs: [{ id: 'invalid_category' as any, label: 'Invalid', icon: '❓' }],
    };
    expect(() => validateMatchHistoryConfig(invalid)).toThrow(MatchHistoryConfigError);
  });

  it('throws on missing copy fields', () => {
    const invalid = {
      ...CANONICAL_MATCH_HISTORY_CONFIG,
      copy: {
        ...CANONICAL_MATCH_HISTORY_CONFIG.copy,
        defaultPageTitle: '',
      },
    };
    expect(() => validateMatchHistoryConfig(invalid)).toThrow(MatchHistoryConfigError);
  });

  it('throws on missing win reasons', () => {
    const invalid = {
      ...CANONICAL_MATCH_HISTORY_CONFIG,
      copy: {
        ...CANONICAL_MATCH_HISTORY_CONFIG.copy,
        winReasons: {
          ...CANONICAL_MATCH_HISTORY_CONFIG.copy.winReasons,
          goal_reached: '',
        },
      },
    };
    expect(() => validateMatchHistoryConfig(invalid)).toThrow(MatchHistoryConfigError);
  });
});

