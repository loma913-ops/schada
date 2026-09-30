import type { Move, PieceColor } from '@/core/schada/types';
import { executeMove, resignGame, timeoutGame } from '@/core/schada/engine';
import type { GameRoom } from './gameTypes';
import { calculateMoveClocks } from './gameClock';
import { computeRankedGameEloResult } from './gameElo';

export interface ResignTransitionResult {
  updatePayload: Partial<GameRoom>;
  resigningPlayerId: string | null;
  resigningDelta: number;
  winningPlayerId: string | null;
  winningDelta: number;
  isRanked: boolean;
}

export interface TimeoutTransitionResult {
  updatePayload: Partial<GameRoom>;
  timedOutPlayerId: string | null;
  timedOutDelta: number;
  timeoutWinnerPlayerId: string | null;
  timeoutWinnerDelta: number;
  isRanked: boolean;
}

/**
 * Calculates updated game state upon making a board move.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time board transformation and Elo calculation.
 * - Auxiliary Space Complexity: O(1) constant payload allocation.
 */
export function computeMoveTransition(
  game: GameRoom,
  move: Move,
  playerColor: PieceColor,
  now: number = Date.now()
): Partial<GameRoom> {
  if (game.status !== 'in_progress') {
    throw new Error('Game is not in progress.');
  }
  if (game.currentTurn !== playerColor) {
    throw new Error('It is not your turn.');
  }

  const { nextBlueTime, nextGreenTime } = calculateMoveClocks(game, playerColor, now);
  const nextBoardState = executeMove(game.boardState, move);
  const nextTurn: PieceColor = playerColor === 'blue' ? 'green' : 'blue';

  const updatePayload: Partial<GameRoom> = {
    boardState: nextBoardState,
    currentTurn: nextTurn,
    blueTimeMs: nextBlueTime,
    greenTimeMs: nextGreenTime,
    lastTurnStartTimeMs: nextBoardState.isGameOver ? null : now,
  };

  if (nextBoardState.isGameOver) {
    updatePayload.status = 'completed';
    const winner = nextBoardState.result?.winner;
    updatePayload.winner = winner;
    updatePayload.winReason = nextBoardState.result?.winReason;

    if (winner && game.isRanked && game.bluePlayer && game.greenPlayer) {
      const eloCalc = computeRankedGameEloResult(game, winner);
      if (eloCalc) {
        updatePayload.eloResult = eloCalc;
        updatePayload.bluePlayer = {
          ...game.bluePlayer,
          elo: eloCalc.newBlueElo,
        };
        updatePayload.greenPlayer = {
          ...game.greenPlayer,
          elo: eloCalc.newGreenElo,
        };
      }
    }
  }

  return updatePayload;
}

/**
 * Calculates updated game state upon player resignation.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time resignation and Elo calculation.
 * - Auxiliary Space Complexity: O(1) constant payload allocation.
 */
export function computeResignTransition(
  game: GameRoom,
  resigningColor: PieceColor
): ResignTransitionResult {
  const isRankedGame = Boolean(game.isRanked);
  const nextBoardState = resignGame(game.boardState, resigningColor);
  const winner = nextBoardState.result?.winner;

  const updatePayload: Partial<GameRoom> = {
    boardState: nextBoardState,
    status: 'completed',
    winner,
    winReason: nextBoardState.result?.winReason,
    lastTurnStartTimeMs: null,
  };

  let resigningPlayerId: string | null = null;
  let resigningDelta = 0;
  let winningPlayerId: string | null = null;
  let winningDelta = 0;

  const resigningPlayer = resigningColor === 'blue' ? game.bluePlayer : game.greenPlayer;
  if (resigningPlayer?.id) {
    resigningPlayerId = resigningPlayer.id;
  }
  const winningPlayer = resigningColor === 'blue' ? game.greenPlayer : game.bluePlayer;
  if (winningPlayer?.id) {
    winningPlayerId = winningPlayer.id;
  }

  if (winner && game.isRanked && game.bluePlayer && game.greenPlayer) {
    const eloCalc = computeRankedGameEloResult(game, winner);
    if (eloCalc) {
      updatePayload.eloResult = eloCalc;
      updatePayload.bluePlayer = {
        ...game.bluePlayer,
        elo: eloCalc.newBlueElo,
      };
      updatePayload.greenPlayer = {
        ...game.greenPlayer,
        elo: eloCalc.newGreenElo,
      };

      resigningDelta = resigningColor === 'blue' ? eloCalc.blueDelta : eloCalc.greenDelta;
      winningDelta = resigningColor === 'blue' ? eloCalc.greenDelta : eloCalc.blueDelta;
    }
  }

  const currentProcessed = Array.isArray(game.processedEloUserIds) ? game.processedEloUserIds : [];
  if (resigningPlayerId && !currentProcessed.includes(resigningPlayerId)) {
    updatePayload.processedEloUserIds = [...currentProcessed, resigningPlayerId];
  }

  return {
    updatePayload,
    resigningPlayerId,
    resigningDelta,
    winningPlayerId,
    winningDelta,
    isRanked: isRankedGame,
  };
}

/**
 * Calculates updated game state upon game clock expiration.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time timeout and Elo calculation.
 * - Auxiliary Space Complexity: O(1) constant payload allocation.
 */
export function computeTimeoutTransition(
  game: GameRoom,
  timedOutColor: PieceColor,
  callerId?: string | null
): TimeoutTransitionResult {
  const isRankedGame = Boolean(game.isRanked);
  const nextBoardState = timeoutGame(game.boardState, timedOutColor);
  const winner = nextBoardState.result?.winner;

  const updatePayload: Partial<GameRoom> = {
    boardState: nextBoardState,
    status: 'completed',
    winner,
    winReason: nextBoardState.result?.winReason,
    lastTurnStartTimeMs: null,
  };

  let timedOutPlayerId: string | null = null;
  let timedOutDelta = 0;
  let timeoutWinnerPlayerId: string | null = null;
  let timeoutWinnerDelta = 0;

  const timedOutPlayer = timedOutColor === 'blue' ? game.bluePlayer : game.greenPlayer;
  if (timedOutPlayer?.id) {
    timedOutPlayerId = timedOutPlayer.id;
  }
  const timeoutWinnerPlayer = timedOutColor === 'blue' ? game.greenPlayer : game.bluePlayer;
  if (timeoutWinnerPlayer?.id) {
    timeoutWinnerPlayerId = timeoutWinnerPlayer.id;
  }

  if (winner && game.isRanked && game.bluePlayer && game.greenPlayer) {
    const eloCalc = computeRankedGameEloResult(game, winner);
    if (eloCalc) {
      updatePayload.eloResult = eloCalc;
      updatePayload.bluePlayer = {
        ...game.bluePlayer,
        elo: eloCalc.newBlueElo,
      };
      updatePayload.greenPlayer = {
        ...game.greenPlayer,
        elo: eloCalc.newGreenElo,
      };

      timedOutDelta = timedOutColor === 'blue' ? eloCalc.blueDelta : eloCalc.greenDelta;
      timeoutWinnerDelta = timedOutColor === 'blue' ? eloCalc.greenDelta : eloCalc.blueDelta;
    }
  }

  const currentProcessed = Array.isArray(game.processedEloUserIds) ? game.processedEloUserIds : [];
  if (callerId && (callerId === timedOutPlayerId || callerId === timeoutWinnerPlayerId) && !currentProcessed.includes(callerId)) {
    updatePayload.processedEloUserIds = [...currentProcessed, callerId];
  }

  return {
    updatePayload,
    timedOutPlayerId,
    timedOutDelta,
    timeoutWinnerPlayerId,
    timeoutWinnerDelta,
    isRanked: isRankedGame,
  };
}
