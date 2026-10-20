import type { Move, PieceColor } from '@/core/schada/types';
import { executeMove, resignGame, timeoutGame } from '@/core/schada/engine';
import type { GameRoom } from './gameTypes';
import { calculateMoveClocks } from './gameClock';
import { computeRankedGameEloResult } from './gameElo';
import { MULTIPLAYER_SCALE_CONFIG } from './multiplayerConfig';
import { LOBBY_CONFIG } from '@/components/lobby/lobbyConfig';

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
  const isWhiteTurn = game.currentTurn === 'white';
  const isWhitePlayer = playerColor === 'white';
  if (isWhiteTurn !== isWhitePlayer) {
    throw new Error('It is not your turn.');
  }

  const { nextWhiteTime, nextBlackTime } = calculateMoveClocks(game, playerColor, now);
  const nextBoardState = executeMove(game.boardState, move);
  const isWhite = isWhitePlayer;
  const nextTurn: PieceColor = isWhite ? 'black' : 'white';

  const updatePayload: Partial<GameRoom> = {
    boardState: nextBoardState,
    currentTurn: nextTurn,
    whiteTimeMs: nextWhiteTime,
    blackTimeMs: nextBlackTime,
    lastTurnStartTimeMs: nextBoardState.isGameOver ? null : now,
  };

  if (nextBoardState.isGameOver) {
    updatePayload.status = 'completed';
    const winner = nextBoardState.result?.winner;
    updatePayload.winner = winner;
    updatePayload.winReason = nextBoardState.result?.winReason;

    const { whitePlayer, blackPlayer } = game;

    if (winner && game.isRanked && whitePlayer && blackPlayer) {
      const eloCalc = computeRankedGameEloResult(game, winner);
      if (eloCalc) {
        updatePayload.eloResult = eloCalc;
        updatePayload.whitePlayer = {
          ...whitePlayer,
          elo: eloCalc.newWhiteElo,
        };
        updatePayload.blackPlayer = {
          ...blackPlayer,
          elo: eloCalc.newBlackElo,
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

  const { whitePlayer, blackPlayer } = game;

  const isWhiteResigning = resigningColor === 'white';
  const resigningPlayer = isWhiteResigning ? whitePlayer : blackPlayer;
  if (resigningPlayer?.id) {
    resigningPlayerId = resigningPlayer.id;
  }
  const winningPlayer = isWhiteResigning ? blackPlayer : whitePlayer;
  if (winningPlayer?.id) {
    winningPlayerId = winningPlayer.id;
  }

  if (winner && game.isRanked && whitePlayer && blackPlayer) {
    const eloCalc = computeRankedGameEloResult(game, winner);
    if (eloCalc) {
      updatePayload.eloResult = eloCalc;
      updatePayload.whitePlayer = {
        ...whitePlayer,
        elo: eloCalc.newWhiteElo,
      };
      updatePayload.blackPlayer = {
        ...blackPlayer,
        elo: eloCalc.newBlackElo,
      };

      resigningDelta = isWhiteResigning ? eloCalc.whiteDelta : eloCalc.blackDelta;
      winningDelta = isWhiteResigning ? eloCalc.blackDelta : eloCalc.whiteDelta;
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

  const { whitePlayer, blackPlayer } = game;

  const isWhiteTimeout = timedOutColor === 'white';
  const timedOutPlayer = isWhiteTimeout ? whitePlayer : blackPlayer;
  if (timedOutPlayer?.id) {
    timedOutPlayerId = timedOutPlayer.id;
  }
  const timeoutWinnerPlayer = isWhiteTimeout ? blackPlayer : whitePlayer;
  if (timeoutWinnerPlayer?.id) {
    timeoutWinnerPlayerId = timeoutWinnerPlayer.id;
  }

  if (winner && game.isRanked && whitePlayer && blackPlayer) {
    const eloCalc = computeRankedGameEloResult(game, winner);
    if (eloCalc) {
      updatePayload.eloResult = eloCalc;
      updatePayload.whitePlayer = {
        ...whitePlayer,
        elo: eloCalc.newWhiteElo,
      };
      updatePayload.blackPlayer = {
        ...blackPlayer,
        elo: eloCalc.newBlackElo,
      };

      timedOutDelta = isWhiteTimeout ? eloCalc.whiteDelta : eloCalc.blackDelta;
      timeoutWinnerDelta = isWhiteTimeout ? eloCalc.blackDelta : eloCalc.whiteDelta;
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

export interface AbandonmentTransitionResult {
  updatePayload: Partial<GameRoom>;
  abandonedPlayerId: string | null;
  abandonedDelta: number;
  winnerPlayerId: string | null;
  winnerDelta: number;
  isRanked: boolean;
}

/**
 * Calculates updated game state upon game abandonment.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time abandonment resolution and Elo calculation.
 * - Auxiliary Space Complexity: O(1) constant payload allocation.
 * - Growth Rate: O(1) flat asymptotic execution cost independent of total moves or player rating history.
 *
 * @param game Active game room snapshot.
 * @param abandonedColor The piece color of the player who abandoned.
 * @param callerId Optional caller user ID for Elo processing idempotency.
 * @throws TypeError if game is invalid or null.
 * @throws RangeError if abandonedColor is not 'white' or 'black'.
 */
export function computeAbandonmentTransition(
  game: GameRoom,
  abandonedColor: PieceColor,
  callerId?: string | null
): AbandonmentTransitionResult {
  if (!game || typeof game !== 'object') {
    throw new TypeError('Invalid game: GameRoom object is required.');
  }
  if (abandonedColor !== 'white' && abandonedColor !== 'black') {
    throw new RangeError(`Invalid abandonedColor: expected "white" or "black", received "${abandonedColor}".`);
  }
  if (
    typeof game.timeControlMinutes === 'number' &&
    game.timeControlMinutes >= LOBBY_CONFIG.correspondenceCutoffMinutes
  ) {
    throw new Error(
      `Correspondence games (${game.timeControlMinutes} min >= cutoff ${LOBBY_CONFIG.correspondenceCutoffMinutes} min) are exempt from abandonment rules and only conclude upon clock expiration or resignation.`
    );
  }

  const isRankedGame = Boolean(game.isRanked);
  const isWhiteAbandoned = abandonedColor === 'white';
  const winner: PieceColor = isWhiteAbandoned ? 'black' : 'white';

  const updatePayload: Partial<GameRoom> = {
    status: 'completed',
    winner,
    winReason: 'abandonment',
    lastTurnStartTimeMs: null,
    whiteDisconnectedAt: null,
    blackDisconnectedAt: null,
  };

  let abandonedPlayerId: string | null = null;
  let abandonedDelta = 0;
  let winnerPlayerId: string | null = null;
  let winnerDelta = 0;

  const { whitePlayer, blackPlayer } = game;

  const abandonedPlayer = isWhiteAbandoned ? whitePlayer : blackPlayer;
  if (abandonedPlayer?.id) {
    abandonedPlayerId = abandonedPlayer.id;
  }
  const winningPlayer = isWhiteAbandoned ? blackPlayer : whitePlayer;
  if (winningPlayer?.id) {
    winnerPlayerId = winningPlayer.id;
  }

  if (winner && game.isRanked && whitePlayer && blackPlayer) {
    const eloCalc = computeRankedGameEloResult(game, winner);
    if (eloCalc) {
      updatePayload.eloResult = eloCalc;
      updatePayload.whitePlayer = {
        ...whitePlayer,
        elo: eloCalc.newWhiteElo,
      };
      updatePayload.blackPlayer = {
        ...blackPlayer,
        elo: eloCalc.newBlackElo,
      };

      abandonedDelta = isWhiteAbandoned ? eloCalc.whiteDelta : eloCalc.blackDelta;
      winnerDelta = isWhiteAbandoned ? eloCalc.blackDelta : eloCalc.whiteDelta;
    }
  }

  const currentProcessed = Array.isArray(game.processedEloUserIds) ? game.processedEloUserIds : [];
  if (callerId && (callerId === abandonedPlayerId || callerId === winnerPlayerId) && !currentProcessed.includes(callerId)) {
    updatePayload.processedEloUserIds = [...currentProcessed, callerId];
  }

  return {
    updatePayload,
    abandonedPlayerId,
    abandonedDelta,
    winnerPlayerId,
    winnerDelta,
    isRanked: isRankedGame,
  };
}

export interface AbandonmentEvaluation {
  readonly isDisconnected: boolean;
  readonly disconnectedColor?: PieceColor;
  readonly shouldAbandon: boolean;
  readonly remainingGraceSeconds?: number;
}

/**
 * Evaluates whether an in-progress real-time game has an absent player eligible for abandonment.
 *
 * Rules:
 * - Real-time games only (timeControlMinutes > 0 and timeControlMinutes < correspondenceCutoffMinutes).
 * - Game must be 'in_progress'.
 * - Abandonment countdown ONLY ticks down when it is the disconnected player's turn.
 * - If remaining clock on the turn player is <= disconnectGracePeriodMs (60s), the player loses on time instead.
 * - If remaining clock is > 60s and the player has been absent on their turn for >= 60s, game must be abandoned.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time mathematical arithmetic and conditional state checks.
 * - Auxiliary Space Complexity: O(1) fixed result object allocation.
 * - Growth Rate: O(1) flat asymptotic scaling ensuring negligible overhead at 100ms clock tick intervals.
 *
 * @param game Active game room snapshot or null/undefined.
 * @param now Current timestamp in milliseconds (defaults to Date.now()).
 * @param gracePeriodMs Disconnect grace period threshold (defaults to config value).
 * @throws RangeError if now or gracePeriodMs is invalid, NaN, or non-positive.
 */
export function evaluateGameAbandonment(
  game: GameRoom | null | undefined,
  now: number = Date.now(),
  gracePeriodMs: number = MULTIPLAYER_SCALE_CONFIG.matchmaking.disconnectGracePeriodMs
): AbandonmentEvaluation {
  if (typeof now !== 'number' || Number.isNaN(now)) {
    throw new RangeError(`Invalid now timestamp: expected number, received ${now}.`);
  }
  if (typeof gracePeriodMs !== 'number' || Number.isNaN(gracePeriodMs) || gracePeriodMs <= 0) {
    throw new RangeError(`Invalid gracePeriodMs: expected positive number, received ${gracePeriodMs}.`);
  }

  if (!game || game.status !== 'in_progress') {
    return { isDisconnected: false, shouldAbandon: false };
  }
  if (
    typeof game.timeControlMinutes !== 'number' ||
    game.timeControlMinutes <= 0 ||
    game.timeControlMinutes >= LOBBY_CONFIG.correspondenceCutoffMinutes
  ) {
    return { isDisconnected: false, shouldAbandon: false };
  }

  const currentTurn = game.currentTurn;
  const isWhiteTurn = currentTurn === 'white';
  const whiteDc = typeof game.whiteDisconnectedAt === 'number' && game.whiteDisconnectedAt > 0;
  const blackDc = typeof game.blackDisconnectedAt === 'number' && game.blackDisconnectedAt > 0;

  if (!whiteDc && !blackDc) {
    return { isDisconnected: false, shouldAbandon: false };
  }

  const turnPlayerDc = isWhiteTurn ? whiteDc : blackDc;
  const turnPlayerDcTime = isWhiteTurn
    ? game.whiteDisconnectedAt!
    : game.blackDisconnectedAt!;

  // If the player currently on turn is NOT disconnected, but the other player is disconnected
  if (!turnPlayerDc) {
    const opponentColor: PieceColor = isWhiteTurn ? 'black' : 'white';
    return {
      isDisconnected: true,
      disconnectedColor: opponentColor,
      shouldAbandon: false,
    };
  }

  // Turn player is disconnected.
  // Evaluate their remaining clock.
  const elapsedSinceTurnStart = typeof game.lastTurnStartTimeMs === 'number' && game.lastTurnStartTimeMs > 0
    ? Math.max(0, now - game.lastTurnStartTimeMs)
    : 0;
  const currentClockMs = isWhiteTurn
    ? (game.whiteTimeMs ?? 0)
    : (game.blackTimeMs ?? 0);
  const remainingClockMs = currentClockMs - elapsedSinceTurnStart;

  // If clock <= gracePeriodMs (60s), player loses on time instead of abandoning
  const canonicalTurnColor: PieceColor = isWhiteTurn ? 'white' : 'black';

  if (remainingClockMs <= gracePeriodMs) {
    return {
      isDisconnected: true,
      disconnectedColor: canonicalTurnColor,
      shouldAbandon: false,
    };
  }

  // Clock is > 60s. Countdown runs from when their absence on their turn began.
  const turnAbsenceStart = Math.max(turnPlayerDcTime, game.lastTurnStartTimeMs || 0);
  const absenceElapsedMs = Math.max(0, now - turnAbsenceStart);
  const remainingGraceMs = gracePeriodMs - absenceElapsedMs;

  if (remainingGraceMs <= 0) {
    return {
      isDisconnected: true,
      disconnectedColor: canonicalTurnColor,
      shouldAbandon: true,
      remainingGraceSeconds: 0,
    };
  }

  return {
    isDisconnected: true,
    disconnectedColor: canonicalTurnColor,
    shouldAbandon: false,
    remainingGraceSeconds: Math.ceil(remainingGraceMs / 1000),
  };
}
