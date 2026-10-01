import type { BoardState, PieceColor } from '@/core/schada/types';
import type { ArenaPlayer } from '@/components/game/Arena';
import { MULTIPLAYER_SCALE_CONFIG } from './multiplayerConfig';

export interface GamePlayer extends ArenaPlayer {
  sessionToken: string;
}

export interface GameEloResult {
  blueDelta: number;
  greenDelta: number;
  newBlueElo: number;
  newGreenElo: number;
  initialBlueElo?: number;
  initialGreenElo?: number;
}

export interface GameRoom {
  id: string;
  isPrivate: boolean;
  status: 'waiting' | 'in_progress' | 'completed' | 'abandoned';
  createdAt: number;
  timeControlMinutes: number;
  incrementSeconds: number;
  isRanked: boolean;
  creatorColorPref: PieceColor | 'random';
  bluePlayer: GamePlayer | null;
  greenPlayer: GamePlayer | null;
  boardState: BoardState;
  currentTurn: PieceColor;
  blueTimeMs: number;
  greenTimeMs: number;
  lastTurnStartTimeMs: number | null;
  winner?: PieceColor | 'draw' | null;
  winReason?: string | null;
  eloResult?: GameEloResult | null;
  processedEloUserIds?: string[];
  abandonedAt?: number;
}

export interface GameTimeoutResult {
  readonly timedOut: boolean;
  readonly timedOutColor?: PieceColor;
}

export type { ArenaPlayer };

export interface CreateGameParams {
  timeControlMinutes: number;
  incrementSeconds?: number;
  isRanked?: boolean;
  colorPref?: PieceColor | 'random';
  isPrivate?: boolean;
  creator: ArenaPlayer;
}

export interface JoinGameResult {
  success: boolean;
  role: 'player' | 'spectator';
  color?: PieceColor;
  sessionToken?: string;
  error?: string;
}

export const ABANDONED_GAME_EXPIRY_MS = MULTIPLAYER_SCALE_CONFIG.matchmaking.abandonedGameExpiryMs;
