import { describe, it, expect } from 'vitest';
import { SCHADA_RULES_CONFIG, validateRulesConfig, type SchadaRulesConfig } from '../rulesConfig';

describe('SCHADA_RULES_CONFIG', () => {
  it('validates the official rules configuration successfully', () => {
    expect(() => validateRulesConfig(SCHADA_RULES_CONFIG)).not.toThrow();
    expect(SCHADA_RULES_CONFIG.army.totalPiecesPerPlayer).toBe(16);
    expect(SCHADA_RULES_CONFIG.army.fieldOfficersCount).toBe(4);
    expect(SCHADA_RULES_CONFIG.army.officersCount).toBe(4);
    expect(SCHADA_RULES_CONFIG.army.pawnsCount).toBe(8);
    expect(SCHADA_RULES_CONFIG.board.totalSquares).toBe(64);
    expect(SCHADA_RULES_CONFIG.board.openingLegalMoveCount).toBe(14);
    expect(SCHADA_RULES_CONFIG.scoring.fieldOfficerGoalPoints).toBe(2);
    expect(SCHADA_RULES_CONFIG.scoring.officerGoalPoints).toBe(1);
  });

  it('throws descriptive error if configuration is null or missing', () => {
    expect(() => validateRulesConfig(null as any)).toThrowError(
      'SchadaRulesConfigError: Rules configuration is missing or null.'
    );
  });

  it('throws descriptive error if army composition is invalid', () => {
    const invalidArmyConfig: SchadaRulesConfig = {
      ...SCHADA_RULES_CONFIG,
      army: {
        ...SCHADA_RULES_CONFIG.army,
        fieldOfficersCount: 5, // invalid
        officersCount: 4,
        pawnsCount: 8,
        totalPiecesPerPlayer: 17,
      },
    };
    expect(() => validateRulesConfig(invalidArmyConfig)).toThrowError(
      /Invalid army composition/
    );
  });

  it('throws descriptive error if scoring values are altered', () => {
    const invalidScoringConfig: SchadaRulesConfig = {
      ...SCHADA_RULES_CONFIG,
      scoring: {
        ...SCHADA_RULES_CONFIG.scoring,
        fieldOfficerGoalPoints: 3, // invalid
      },
    };
    expect(() => validateRulesConfig(invalidScoringConfig)).toThrowError(
      /Invalid scoring points/
    );
  });

  it('throws descriptive error if board dimensions are incorrect', () => {
    const invalidBoardConfig: SchadaRulesConfig = {
      ...SCHADA_RULES_CONFIG,
      board: {
        ...SCHADA_RULES_CONFIG.board,
        totalSquares: 63, // invalid
      },
    };
    expect(() => validateRulesConfig(invalidBoardConfig)).toThrowError(
      /Invalid board dimensions/
    );
  });

  it('throws descriptive error if end conditions are invalid or missing', () => {
    const invalidEndConfig: SchadaRulesConfig = {
      ...SCHADA_RULES_CONFIG,
      endConditions: {
        threefoldRepetitionThreshold: 2, // invalid
        mutualShuffleHalfMovesThreshold: 6,
      },
    };
    expect(() => validateRulesConfig(invalidEndConfig)).toThrowError(
      /Invalid end conditions/
    );
  });

  it('throws descriptive error if material display weights are non-positive or missing', () => {
    const invalidWeightsConfig: SchadaRulesConfig = {
      ...SCHADA_RULES_CONFIG,
      army: {
        ...SCHADA_RULES_CONFIG.army,
        materialDisplayWeights: {
          fieldOfficer: 0,
          officer: 2,
          pawn: 1,
        },
      },
    };
    expect(() => validateRulesConfig(invalidWeightsConfig)).toThrowError(
      /Invalid army materialDisplayWeights/
    );
  });

  it('throws descriptive error if defaultOrientation is invalid', () => {
    const invalidOrientationConfig: SchadaRulesConfig = {
      ...SCHADA_RULES_CONFIG,
      board: {
        ...SCHADA_RULES_CONFIG.board,
        defaultOrientation: 'red' as any,
      },
    };
    expect(() => validateRulesConfig(invalidOrientationConfig)).toThrowError(
      /Invalid board defaultOrientation/
    );
  });

  it('throws descriptive error if board base/goal rank indices are invalid or altered', () => {
    const invalidRankIndicesConfig: SchadaRulesConfig = {
      ...SCHADA_RULES_CONFIG,
      board: {
        ...SCHADA_RULES_CONFIG.board,
        whiteGoalRankIndex: 6, // invalid
      },
    };
    expect(() => validateRulesConfig(invalidRankIndicesConfig)).toThrowError(
      /Invalid board base\/goal rank indices/
    );
  });
});
