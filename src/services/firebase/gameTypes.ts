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
  blueDisconnectedAt?: number | null;
  greenDisconnectedAt?: number | null;
  targetOpponent?: ArenaPlayer | null;
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
  targetOpponent?: ArenaPlayer | null;
}

export interface JoinGameResult {
  success: boolean;
  role: 'player' | 'spectator';
  color?: PieceColor;
  sessionToken?: string;
  error?: string;
}

export const ABANDONED_GAME_EXPIRY_MS = MULTIPLAYER_SCALE_CONFIG.matchmaking.abandonedGameExpiryMs;

/**
 * Robustly determines if an arena player or user identity corresponds to a guest account.
 * Guests have no ID, an empty ID, an ID starting with 'guest_', or an explicit 'guest' ID.
 * Case-insensitive and whitespace-tolerant.
 *
 * Algorithmic Complexity (Big O):
 * - Time Complexity: O(1) constant scalar string operation.
 * - Auxiliary Space Complexity: O(1) constant scalar allocation.
 * - Growth Rate: O(1) constant, invariant to system scale or player counts.
 */
export function isGuestUser(
  user?: ArenaPlayer | { id?: string | null; isGuest?: boolean } | null
): boolean {
  if (!user || !user.id) return true;
  if ('isGuest' in user && user.isGuest === true) return true;
  const normalizedId = user.id.trim().toLowerCase();
  return normalizedId.length === 0 || normalizedId.startsWith('guest_') || normalizedId === 'guest';
}
