/**
 * Official Schada Rules Configuration
 * Based on Jan Boogerd's 1939 Handleiding (Royal Library in The Hague)
 * and Fred Horn's archival research published on AbstractGames.org.
 */

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
    readonly blueBaseRankIndex: number;
    readonly blueGoalRankIndex: number;
    readonly greenBaseRankIndex: number;
    readonly greenGoalRankIndex: number;
    readonly openingLegalMoveCount: number;
  };
}

export function validateRulesConfig(config: SchadaRulesConfig): void {
  if (!config) {
    throw new Error('SchadaRulesConfigError: Rules configuration is missing or null.');
  }

  const { army, scoring, board } = config;

  if (army.fieldOfficersCount !== 4 || army.officersCount !== 4 || army.pawnsCount !== 8) {
    throw new Error(
      `SchadaRulesConfigError: Invalid army composition. Expected 4 Field Officers, 4 Officers, 8 Pawns. Received FO: ${army.fieldOfficersCount}, O: ${army.officersCount}, P: ${army.pawnsCount}.`
    );
  }

  if (army.fieldOfficersCount + army.officersCount + army.pawnsCount !== army.totalPiecesPerPlayer) {
    throw new Error(
      `SchadaRulesConfigError: totalPiecesPerPlayer (${army.totalPiecesPerPlayer}) does not match sum of pieces.`
    );
  }

  if (scoring.fieldOfficerGoalPoints !== 2 || scoring.officerGoalPoints !== 1 || scoring.pawnGoalPoints !== 0) {
    throw new Error(
      `SchadaRulesConfigError: Invalid scoring points. Expected Field Officer=2, Officer=1, Pawn=0.`
    );
  }

  if (board.totalSquares !== board.rankCount * board.fileCount || board.totalSquares !== 64) {
    throw new Error(
      `SchadaRulesConfigError: Invalid board dimensions. Expected 8x8 = 64 squares, received ${board.rankCount}x${board.fileCount} = ${board.totalSquares}.`
    );
  }

  if (board.openingLegalMoveCount !== 14) {
    throw new Error(
      `SchadaRulesConfigError: Opening legal moves must be 14 (4 FO leaps + 10 pawn moves).`
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
    blueBaseRankIndex: 0, // Rank 1
    blueGoalRankIndex: 7, // Rank 8
    greenBaseRankIndex: 7, // Rank 8
    greenGoalRankIndex: 0, // Rank 1
    openingLegalMoveCount: 14,
  },
});

// Run immediate startup validation to guarantee config integrity
validateRulesConfig(SCHADA_RULES_CONFIG);
