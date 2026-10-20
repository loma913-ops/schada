/**
 * Official Schada Rules Configuration
 * Based on Jan Boogerd's 1939 Handleiding (Royal Library in The Hague)
 * and Fred Horn's archival research published on AbstractGames.org.
 */

export class SchadaRulesConfigError extends Error {
  constructor(message: string) {
    super(`SchadaRulesConfigError: ${message}`);
    this.name = 'SchadaRulesConfigError';
  }
}

export interface SchadaRulesConfig {
  readonly gameMetadata: {
    readonly title: string;
    readonly inventor: string;
    readonly yearInvented: number;
    readonly cityOfOrigin: string;
    readonly patentNumber: string;
    readonly tagline: string;
  };
  readonly army: {
    readonly fieldOfficersCount: number;
    readonly officersCount: number;
    readonly pawnsCount: number;
    readonly totalPiecesPerPlayer: number;
    readonly materialDisplayWeights: {
      readonly fieldOfficer: number;
      readonly officer: number;
      readonly pawn: number;
    };
  };
  readonly scoring: {
    readonly fieldOfficerGoalPoints: number;
    readonly officerGoalPoints: number;
    readonly pawnGoalPoints: number;
    readonly fieldOfficerSurvivingPoints: number;
    readonly officerSurvivingPoints: number;
    readonly rankDistanceDenominator: number;
    readonly fieldOfficerRankDistanceNumerator: number;
    readonly officerRankDistanceNumerator: number;
  };
  readonly board: {
    readonly rankCount: number;
    readonly fileCount: number;
    readonly totalSquares: number;
    readonly whiteBaseRankIndex: number;
    readonly whiteGoalRankIndex: number;
    readonly blackBaseRankIndex: number;
    readonly blackGoalRankIndex: number;
    readonly openingLegalMoveCount: number;
    readonly defaultOrientation: 'white' | 'black';
  };
  readonly endConditions: {
    readonly threefoldRepetitionThreshold: number;
    readonly mutualShuffleHalfMovesThreshold: number;
  };
}

/**
 * Validates the Schada rules configuration at startup.
 * Throws SchadaRulesConfigError if config is null or has invalid values.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time, checking a fixed set of numeric thresholds.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant, perfectly stable regardless of application lifespan.
 */
export function validateRulesConfig(config: SchadaRulesConfig): void {
  if (!config) {
    throw new SchadaRulesConfigError('Rules configuration is missing or null.');
  }

  const { army, scoring, board, endConditions } = config;

  if (!army || army.fieldOfficersCount !== 4 || army.officersCount !== 4 || army.pawnsCount !== 8) {
    throw new SchadaRulesConfigError(
      `Invalid army composition. Expected 4 Field Officers, 4 Officers, 8 Pawns. Received FO: ${army?.fieldOfficersCount}, O: ${army?.officersCount}, P: ${army?.pawnsCount}.`
    );
  }

  if (army.fieldOfficersCount + army.officersCount + army.pawnsCount !== army.totalPiecesPerPlayer) {
    throw new SchadaRulesConfigError(
      `totalPiecesPerPlayer (${army.totalPiecesPerPlayer}) does not match sum of pieces.`
    );
  }

  if (
    !army.materialDisplayWeights ||
    typeof army.materialDisplayWeights.fieldOfficer !== 'number' ||
    army.materialDisplayWeights.fieldOfficer <= 0 ||
    typeof army.materialDisplayWeights.officer !== 'number' ||
    army.materialDisplayWeights.officer <= 0 ||
    typeof army.materialDisplayWeights.pawn !== 'number' ||
    army.materialDisplayWeights.pawn <= 0
  ) {
    throw new SchadaRulesConfigError('Invalid army materialDisplayWeights: must have positive numeric weights.');
  }

  if (!scoring || scoring.fieldOfficerGoalPoints !== 2 || scoring.officerGoalPoints !== 1 || scoring.pawnGoalPoints !== 0) {
    throw new SchadaRulesConfigError(
      'Invalid scoring points. Expected Field Officer=2, Officer=1, Pawn=0.'
    );
  }

  if (!board || board.totalSquares !== board.rankCount * board.fileCount || board.totalSquares !== 64) {
    throw new SchadaRulesConfigError(
      `Invalid board dimensions. Expected 8x8 = 64 squares, received ${board?.rankCount}x${board?.fileCount} = ${board?.totalSquares}.`
    );
  }

  if (board.defaultOrientation !== 'white' && board.defaultOrientation !== 'black') {
    throw new SchadaRulesConfigError(
      `Invalid board defaultOrientation: expected "white" or "black", received ${String(board?.defaultOrientation)}.`
    );
  }

  if (board.openingLegalMoveCount !== 14) {
    throw new SchadaRulesConfigError(
      'Opening legal moves must be 14 (4 FO leaps + 10 pawn moves).'
    );
  }

  if (
    typeof board.whiteBaseRankIndex !== 'number' ||
    typeof board.whiteGoalRankIndex !== 'number' ||
    typeof board.blackBaseRankIndex !== 'number' ||
    typeof board.blackGoalRankIndex !== 'number' ||
    board.whiteBaseRankIndex !== 0 ||
    board.whiteGoalRankIndex !== 7 ||
    board.blackBaseRankIndex !== 7 ||
    board.blackGoalRankIndex !== 0
  ) {
    throw new SchadaRulesConfigError(
      'Invalid board base/goal rank indices: expected White base=0/goal=7 and Black base=7/goal=0.'
    );
  }

  if (
    !endConditions ||
    endConditions.threefoldRepetitionThreshold !== 3 ||
    endConditions.mutualShuffleHalfMovesThreshold !== 6
  ) {
    throw new SchadaRulesConfigError(
      'Invalid end conditions. Expected threefoldRepetitionThreshold=3, mutualShuffleHalfMovesThreshold=6.'
    );
  }
}

export const SCHADA_RULES_CONFIG: SchadaRulesConfig = Object.freeze({
  gameMetadata: {
    title: 'Schada',
    inventor: 'Jan Boogerd',
    yearInvented: 1936,
    cityOfOrigin: 'Rotterdam, Netherlands',
    patentNumber: '42.613 (April 16, 1936)',
    tagline: 'The Greatest Measure of Thought in the World',
  },
  army: {
    fieldOfficersCount: 4,
    officersCount: 4,
    pawnsCount: 8,
    totalPiecesPerPlayer: 16,
    materialDisplayWeights: {
      fieldOfficer: 3,
      officer: 2,
      pawn: 1,
    },
  },
  scoring: {
    fieldOfficerGoalPoints: 2,
    officerGoalPoints: 1,
    pawnGoalPoints: 0,
    fieldOfficerSurvivingPoints: 2,
    officerSurvivingPoints: 1,
    rankDistanceDenominator: 7,
    fieldOfficerRankDistanceNumerator: 2,
    officerRankDistanceNumerator: 1,
  },
  board: {
    rankCount: 8,
    fileCount: 8,
    totalSquares: 64,
    whiteBaseRankIndex: 0, // Rank 1
    whiteGoalRankIndex: 7, // Rank 8
    blackBaseRankIndex: 7, // Rank 8
    blackGoalRankIndex: 0, // Rank 1
    openingLegalMoveCount: 14,
    defaultOrientation: 'white' as const,
  },
  endConditions: {
    threefoldRepetitionThreshold: 3,
    mutualShuffleHalfMovesThreshold: 6,
  },
});

// Run immediate startup validation to guarantee config integrity
validateRulesConfig(SCHADA_RULES_CONFIG);
