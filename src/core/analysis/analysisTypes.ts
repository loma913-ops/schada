import type { Move, PieceColor } from '../schada/types';
import type { MoveQuality, AnalysisConfig } from './analysisConfig';

export type { MoveQuality };

export interface ParsedGameData {
  readonly metadata: Readonly<Record<string, string>>;
  readonly notations: readonly string[];
  readonly moves: readonly Move[];
  readonly rawText: string;
  readonly isComplete: boolean;
}

export interface MoveCandidateScore {
  readonly move: Move;
  readonly notation: string;
  readonly score: number;
}

export interface EvaluatedMove {
  readonly ply: number;
  readonly turn: PieceColor;
  readonly moveNumber: number;
  readonly playedMove: Move;
  readonly playedNotation: string;
  readonly bestMove: Move;
  readonly bestNotation: string;
  readonly evalBefore: number;
  readonly evalAfter: number;
  readonly evalDelta: number;
  readonly quality: MoveQuality;
  readonly bookLineName?: string;
  readonly comment?: string;
}

export interface NextMovePrediction {
  readonly turn: PieceColor;
  readonly bestMove: Move;
  readonly notation: string;
  readonly evaluation: number;
  readonly candidateMoves: readonly MoveCandidateScore[];
}

export interface PlayerQualityBreakdown {
  readonly accuracy: number;
  readonly moveCount: number;
  readonly breakdown: Readonly<Record<MoveQuality, number>>;
}

export interface GameAnalysisReport {
  readonly metadata: Readonly<Record<string, string>>;
  readonly moves: readonly EvaluatedMove[];
  readonly blueAccuracy: number;
  readonly greenAccuracy: number;
  readonly blueBreakdown: Readonly<Record<MoveQuality, number>>;
  readonly greenBreakdown: Readonly<Record<MoveQuality, number>>;
  readonly nextMove?: NextMovePrediction;
  readonly isComplete: boolean;
  readonly totalPlies: number;
  readonly analyzedAt: string;
  readonly durationMs: number;
}

export interface AnalysisOptions {
  readonly depth?: number;
  readonly timeLimitMs?: number;
  readonly config?: AnalysisConfig;
}
