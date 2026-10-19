import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { BoardState, Move, Piece, PieceColor } from '@/core/schada/types';
import { executeMove, resignGame, timeoutGame } from '@/core/schada/engine';
import { computeCumulativeGameStates } from '@/core/schada/replay';
import { CANONICAL_MOVE_NAVIGATOR_CONFIG } from './moveNavigatorConfig';
import { getBotThinkingDelayMs, getBotTier, botWorkerClient, BOT_ENGINE_CONFIG } from '@/core/bot/schadaBot';
import { soundService } from '@/services/audio/soundService';
import { MULTIPLAYER_SCALE_CONFIG } from '@/services/firebase/multiplayerConfig';
import { RotateCcw, Flag, ListOrdered, X, ArrowLeft, Trophy } from 'lucide-react';
import { SchadaBoard } from '../board/SchadaBoard';
import { PlayerCard } from './PlayerCard';
import { MoveHistory } from './MoveHistory';
import { MoveNavigator } from './MoveNavigator';
import { GameControls } from './GameControls';
import { GameOverModal, type PlayerEloUpdate } from './GameOverModal';
import { AnalysisModal } from './AnalysisModal';
import { analysisWorkerClient } from '@/core/analysis/analysisWorkerClient';
import type { MoveQuality } from '@/core/analysis/analysisConfig';
import { CANONICAL_ANALYSIS_CONFIG } from '@/core/analysis/analysisConfig';
import type { GameAnalysisReport } from '@/core/analysis/analysisTypes';
import { createEmptyAnalysisReport } from '@/core/analysis/accuracyCalculator';
import { calculateEloUpdate } from '@/core/elo/eloService';
import { ELO_CONFIG } from '@/core/elo/eloConfig';
import { SCHADA_RULES_CONFIG } from '@/core/schada/rulesConfig';
import { isPatronUser, type PatronTier, type PatronSubscriptionStatus } from '@/components/common/PatronBadge';
import { LOBBY_CONFIG, formatTimeControlDisplay } from '@/components/lobby/lobbyConfig';
import { CANONICAL_DIGITAL_CLOCK_CONFIG } from './digitalClockConfig';

/** Pure helper - defined at module scope so it is never re-created on render. */
function getMaterialValue(pieces: Piece[]): number {
  const weights = SCHADA_RULES_CONFIG.army.materialDisplayWeights;
  return pieces.reduce(
    (sum, p) =>
      sum +
      (p.type === 'field_officer'
        ? weights.fieldOfficer
        : p.type === 'officer'
          ? weights.officer
          : weights.pawn),
    0
  );
}

export interface ArenaPlayer {
  id: string;
  username: string;
  elo: number;
  gamesPlayed?: number;
  isPatron?: boolean;
  hasDonated?: boolean;
  patronTier?: PatronTier;
  patronExpiresAt?: string | null;
  patronSubscriptionStatus?: PatronSubscriptionStatus;
}

interface ArenaProps {
  initialState: BoardState;
  whitePlayer: ArenaPlayer;
  blackPlayer: ArenaPlayer;
  whiteElo?: PlayerEloUpdate;
  blackElo?: PlayerEloUpdate;
  timeControlMinutes?: number; // 0 for unlimited
  incrementSeconds?: number; // Fischer increment
  isRanked?: boolean;
  userColor?: PieceColor; // undefined for pass & play / spectator
  isComputer?: boolean;
  botLevel?: number;
  isSpectator?: boolean;
  isWaiting?: boolean;
  syncedGameState?: BoardState;
  syncedWhiteTimeMs?: number;
  syncedBlackTimeMs?: number;
  onMakeMove?: (move: Move) => Promise<void> | void;
  onResign?: () => void;
  onTimeout?: (timedOutColor: PieceColor) => void;
  onGameComplete?: (finalState: BoardState) => void;
  onAnalyze?: () => void;
  onStartAnalysis?: (params: {
    readonly depth: number;
    readonly timeLimitSeconds: number;
    readonly timeLimitMs: number;
  }) => void;
  onExit: () => void;
  whiteDisconnected?: boolean;
  blackDisconnected?: boolean;
  abandonCountdownSeconds?: number | null;
  initialReviewMode?: boolean;
}

export const Arena: React.FC<ArenaProps> = ({
  initialState,
  whitePlayer,
  blackPlayer,
  whiteElo,
  blackElo,
  timeControlMinutes = BOT_ENGINE_CONFIG.timeManagement.defaultMatchMinutes,
  incrementSeconds =
    BOT_ENGINE_CONFIG.timeManagement.defaultIncrementMs /
    CANONICAL_DIGITAL_CLOCK_CONFIG.timeUnits.msPerSecond,
  isRanked = false,
  userColor,
  isComputer = false,
  botLevel = BOT_ENGINE_CONFIG.defaultLevel,
  isSpectator = false,
  isWaiting = false,
  syncedGameState,
  syncedWhiteTimeMs,
  syncedBlackTimeMs,
  onMakeMove: customMakeMove,
  onResign: customResign,
  onTimeout: customTimeout,
  onGameComplete,
  onAnalyze,
  onStartAnalysis,
  onExit,
  whiteDisconnected,
  blackDisconnected,
  abandonCountdownSeconds,
  initialReviewMode = false,
}) => {
  const [gameState, setGameState] = useState<BoardState>(syncedGameState || initialState);
  const [viewMoveIndex, setViewMoveIndex] = useState<number>(() => {
    const historyLen = (syncedGameState || initialState).moveHistory.length;
    return historyLen > 0 ? historyLen - 1 : CANONICAL_MOVE_NAVIGATOR_CONFIG.startMoveIndex;
  });
  const [isBotThinking, setIsBotThinking] = useState(false);
  const [hasUnreadLiveMove, setHasUnreadLiveMove] = useState(false);

  const [orientation, setOrientation] = useState<PieceColor>(() => {
    if (userColor) return userColor;
    if (!isSpectator) return (syncedGameState || initialState).currentTurn;
    return SCHADA_RULES_CONFIG.board.defaultOrientation;
  });

  // Ensure board is oriented so that the Player's pieces are at the bottom and their opponents are at the top
  useEffect(() => {
    if (userColor) {
      setOrientation((prev) => (prev !== userColor ? userColor : prev));
    } else if (!isSpectator) {
      setOrientation((prev) => (prev !== gameState.currentTurn ? gameState.currentTurn : prev));
    }
  }, [userColor, isSpectator, gameState.currentTurn]);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const [showGameOverModal, setShowGameOverModal] = useState(() => !initialReviewMode);
  const [gameOverEffectsPlayed, setGameOverEffectsPlayed] = useState(() => Boolean(initialReviewMode));
  const [isReviewMode, setIsReviewMode] = useState(() => Boolean(initialReviewMode));
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analyzedQualities, setAnalyzedQualities] = useState<Record<number, MoveQuality>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<{ current: number; total: number } | null>(null);
  const [postGameAnalysis, setPostGameAnalysis] = useState<GameAnalysisReport | null>(null);
  const [isPostGameAnalyzing, setIsPostGameAnalyzing] = useState(false);

  const handleGameOverEffectsPlayed = useCallback(() => {
    setGameOverEffectsPlayed(true);
  }, []);

  const handleCancelAnalysis = useCallback(() => {
    analysisWorkerClient.cancelAnalysis();
    setIsAnalyzing(false);
    setAnalysisProgress(null);
  }, []);

  const handleStartAnalysis = useCallback(
    (params: {
      readonly depth: number;
      readonly timeLimitSeconds: number;
      readonly timeLimitMs: number;
    }) => {
      setAnalyzedQualities({});
      setIsAnalyzing(true);
      setAnalysisProgress({ current: 0, total: gameState.moveHistory.length });

      analysisWorkerClient.startAnalysis(
        gameState.moveHistory,
        params.depth,
        params.timeLimitMs,
        {
          onPlyEvaluated: (plyIndex, evaluatedMove, progress) => {
            setAnalyzedQualities((prev) => ({
              ...prev,
              [plyIndex]: evaluatedMove.quality,
            }));
            setAnalysisProgress(progress);
          },
          onComplete: () => {
            setIsAnalyzing(false);
            setAnalysisProgress(null);
          },
          onError: (err) => {
            console.error('Game analysis failed:', err);
            setIsAnalyzing(false);
            setAnalysisProgress(null);
          },
        }
      );

      onStartAnalysis?.(params);
    },
    [gameState.moveHistory, onStartAnalysis]
  );

  useEffect(() => {
    if (!gameState.isGameOver) {
      setIsReviewMode(false);
      analysisWorkerClient.cancelAnalysis();
      setIsAnalyzing(false);
      setAnalysisProgress(null);
      setAnalyzedQualities({});
      setPostGameAnalysis(null);
      setIsPostGameAnalyzing(false);
    }
  }, [gameState.isGameOver]);

  useEffect(() => {
    return () => {
      analysisWorkerClient.cancelAnalysis();
    };
  }, []);

  const isReview = Boolean(gameState.isGameOver && (isReviewMode || !showGameOverModal));

  const handleAnalyze = useCallback(() => {
    setShowAnalysisModal(true);
    onAnalyze?.();
  }, [onAnalyze]);

  const prevIsGameOverRef = useRef(gameState.isGameOver);
  useEffect(() => {
    if (!prevIsGameOverRef.current && gameState.isGameOver) {
      setShowGameOverModal(true);
      setGameOverEffectsPlayed(false);
      onGameComplete?.(gameState);

      // Trigger automatic background analysis for GameOverModal
      if (gameState.moveHistory.length === 0) {
        setPostGameAnalysis(createEmptyAnalysisReport());
        setIsPostGameAnalyzing(false);
      } else {
        setIsPostGameAnalyzing(true);
        setPostGameAnalysis(null);
        analysisWorkerClient.startAnalysis(
          gameState.moveHistory,
          CANONICAL_ANALYSIS_CONFIG.search.postGameDepth,
          CANONICAL_ANALYSIS_CONFIG.search.postGameTimeLimitMs,
          {
            onPlyEvaluated: () => {},
            onComplete: (report) => {
              if (report) {
                setPostGameAnalysis(report);
              }
              setIsPostGameAnalyzing(false);
            },
            onError: (err) => {
              console.error('Post-game background analysis error:', err);
              setIsPostGameAnalyzing(false);
            },
          }
        );
      }
    }
    prevIsGameOverRef.current = gameState.isGameOver;
  }, [gameState.isGameOver, onGameComplete, gameState]);

  const gameStateRef = useRef<BoardState>(gameState);
  gameStateRef.current = gameState;

  const viewMoveIndexRef = useRef<number>(viewMoveIndex);
  viewMoveIndexRef.current = viewMoveIndex;

  const prevMoveCountRef = useRef<number>(gameState.moveHistory.length);
  const prevHistoryLenRef = useRef<number>(gameState.moveHistory.length);
  const lastAudibleMoveIndexRef = useRef<number>(
    (syncedGameState || initialState).moveHistory.length - 1
  );

  // Sync external state from Firestore/multiplayer if provided
  useEffect(() => {
    if (syncedGameState) {
      const incomingLen = syncedGameState.moveHistory.length;
      const currentLocalLen = gameStateRef.current.moveHistory.length;

      // If incoming synced state is older than our local optimistic state, ignore it (awaiting server ack)
      if (incomingLen < currentLocalLen) {
        return;
      }

      // If incoming state contains new opponent moves beyond what we have already played/heard
      if (incomingLen > lastAudibleMoveIndexRef.current + 1) {
        const latestMove = syncedGameState.moveHistory[incomingLen - 1];
        if (latestMove.captured) {
          soundService.playCapture();
        } else {
          soundService.playMove();
        }
        if (latestMove.piece.type !== 'pawn') {
          const destRow = parseInt(latestMove.to[1], 10) - 1;
          const goalRow =
            latestMove.piece.color === 'white'
              ? SCHADA_RULES_CONFIG.board.whiteGoalRankIndex
              : SCHADA_RULES_CONFIG.board.blackGoalRankIndex;
          if (destRow === goalRow) {
            soundService.playGoal();
          }
        }
      }

      lastAudibleMoveIndexRef.current = Math.max(lastAudibleMoveIndexRef.current, incomingLen - 1);
      prevMoveCountRef.current = incomingLen;

      // Determine if the user was actively following the live game before this incoming state
      const currentViewIndex = viewMoveIndexRef.current;
      const wasAtLivePosition =
        currentLocalLen === 0
          ? currentViewIndex === CANONICAL_MOVE_NAVIGATOR_CONFIG.startMoveIndex
          : currentViewIndex >= currentLocalLen - 1;

      // If incoming synced state matches our local optimistic state move count and game over status,
      // it is a server echo of our own move - skip redundant re-rendering
      if (
        incomingLen === currentLocalLen &&
        syncedGameState.isGameOver === gameStateRef.current.isGameOver
      ) {
        return;
      }

      gameStateRef.current = syncedGameState;
      setGameState(syncedGameState);

      if (incomingLen > currentLocalLen) {
        if (wasAtLivePosition) {
          setViewMoveIndex(incomingLen - 1);
          setHasUnreadLiveMove(false);
        } else {
          setHasUnreadLiveMove(true);
        }
      }
      prevHistoryLenRef.current = incomingLen;
    }
  }, [syncedGameState]);

  // Clear unread live move indicator once user navigates back to latest move
  /**
   * Clears the unread live move indicator when viewMoveIndex reaches or exceeds the latest move.
   *
   * Algorithmic Complexity:
   * - Time Complexity: O(1) constant time integer comparison.
   * - Auxiliary Space Complexity: O(1) constant auxiliary space.
   *
   * Growth Rate:
   * - O(1) flat growth rate.
   */
  useEffect(() => {
    if (viewMoveIndex >= gameState.moveHistory.length - 1) {
      setHasUnreadLiveMove(false);
    }
  }, [viewMoveIndex, gameState.moveHistory.length]);

  /**
   * Synchronizes viewMoveIndex when local gameState.moveHistory length changes externally.
   *
   * Algorithmic Complexity:
   * - Time Complexity: O(1) constant time integer boundary comparison.
   * - Auxiliary Space Complexity: O(1) constant auxiliary space.
   *
   * Growth Rate:
   * - O(1) flat growth rate, invariant to match history length.
   */
  useEffect(() => {
    const currentLen = gameState.moveHistory.length;
    const prevLen = prevHistoryLenRef.current;
    if (currentLen > prevLen) {
      const wasAtLive =
        prevLen === 0
          ? viewMoveIndexRef.current === CANONICAL_MOVE_NAVIGATOR_CONFIG.startMoveIndex
          : viewMoveIndexRef.current >= prevLen - 1;
      if (wasAtLive) {
        setViewMoveIndex(currentLen - 1);
      }
    } else if (currentLen < prevLen) {
      setViewMoveIndex(
        currentLen > 0 ? currentLen - 1 : CANONICAL_MOVE_NAVIGATOR_CONFIG.startMoveIndex
      );
    }
    prevHistoryLenRef.current = currentLen;
  }, [gameState.moveHistory.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      const { keyboardShortcuts, startMoveIndex } = CANONICAL_MOVE_NAVIGATOR_CONFIG;

      if (keyboardShortcuts.previous.includes(e.key)) {
        e.preventDefault();
        setViewMoveIndex((prev) => Math.max(startMoveIndex, prev - 1));
      } else if (keyboardShortcuts.next.includes(e.key)) {
        e.preventDefault();
        setViewMoveIndex((prev) => Math.min(gameState.moveHistory.length - 1, prev + 1));
      } else if (keyboardShortcuts.start.includes(e.key)) {
        e.preventDefault();
        setViewMoveIndex(startMoveIndex);
      } else if (keyboardShortcuts.end.includes(e.key)) {
        e.preventDefault();
        setViewMoveIndex(gameState.moveHistory.length - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState.moveHistory.length]);

  const computerColor: PieceColor | undefined =
    isComputer && userColor
      ? userColor === 'white'
        ? 'black'
        : 'white'
      : undefined;
 
  if (!LOBBY_CONFIG || typeof LOBBY_CONFIG.correspondenceCutoffMinutes !== 'number' || typeof LOBBY_CONFIG.secondsPerMinute !== 'number') {
    throw new Error('Arena: Lobby configuration is missing or invalid.');
  }
  if (!CANONICAL_DIGITAL_CLOCK_CONFIG || typeof CANONICAL_DIGITAL_CLOCK_CONFIG.timeUnits?.msPerSecond !== 'number') {
    throw new Error('Arena: Digital clock configuration is missing or invalid.');
  }

  const msPerMinute =
    LOBBY_CONFIG.secondsPerMinute * CANONICAL_DIGITAL_CLOCK_CONFIG.timeUnits.msPerSecond;
  const initialMs = timeControlMinutes > 0 ? timeControlMinutes * msPerMinute : 0;
  const isCorrespondence =
    typeof timeControlMinutes === 'number' &&
    timeControlMinutes >= LOBBY_CONFIG.correspondenceCutoffMinutes;

  const [whiteTime, setWhiteTime] = useState<number>(syncedWhiteTimeMs ?? initialMs);
  const [blackTime, setBlackTime] = useState<number>(syncedBlackTimeMs ?? initialMs);

  const whiteTimeRef = useRef<number>(whiteTime);
  const blackTimeRef = useRef<number>(blackTime);
  useEffect(() => {
    whiteTimeRef.current = whiteTime;
  }, [whiteTime]);
  useEffect(() => {
    blackTimeRef.current = blackTime;
  }, [blackTime]);

  useEffect(() => {
    if (typeof syncedWhiteTimeMs === 'number') {
      const threshold = MULTIPLAYER_SCALE_CONFIG.matchmaking.clockSyncJitterThresholdMs;
      setWhiteTime((prev) => (Math.abs(prev - syncedWhiteTimeMs) > threshold ? syncedWhiteTimeMs : prev));
    }
  }, [syncedWhiteTimeMs]);

  useEffect(() => {
    if (typeof syncedBlackTimeMs === 'number') {
      const threshold = MULTIPLAYER_SCALE_CONFIG.matchmaking.clockSyncJitterThresholdMs;
      setBlackTime((prev) => (Math.abs(prev - syncedBlackTimeMs) > threshold ? syncedBlackTimeMs : prev));
    }
  }, [syncedBlackTimeMs]);

  const lastTickRef = useRef<number>(Date.now());

  const handleTimeout = useCallback((timedOutColor: PieceColor) => {
    if (customTimeout) {
      customTimeout(timedOutColor);
    }
    setGameState((prev) => {
      const ended = timeoutGame(prev, timedOutColor);
      if (onGameComplete) onGameComplete(ended);
      return ended;
    });
  }, [customTimeout, onGameComplete]);

  // Immediate timeout check if time has already run out
  useEffect(() => {
    if (isWaiting || gameState.isGameOver || timeControlMinutes <= 0) return;
    const isWhiteTurn = gameState.currentTurn === 'white';
    const isBlackTurn = gameState.currentTurn === 'black';
    if (isWhiteTurn && whiteTime <= 0) {
      handleTimeout('white');
    } else if (isBlackTurn && blackTime <= 0) {
      handleTimeout('black');
    }
  }, [isWaiting, gameState.isGameOver, timeControlMinutes, gameState.currentTurn, whiteTime, blackTime, handleTimeout]);

  // Clock countdown timer
  useEffect(() => {
    if (isWaiting || gameState.isGameOver || timeControlMinutes <= 0) return;

    lastTickRef.current = Date.now();

    const interval = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;

      const isWhiteTurn = gameState.currentTurn === 'white';
      if (isWhiteTurn) {
        setWhiteTime((prev) => {
          if (prev <= 0) return 0;
          const next = Math.max(0, prev - delta);
          if (next === 0) {
            handleTimeout('white');
          }
          return next;
        });
      } else {
        setBlackTime((prev) => {
          if (prev <= 0) return 0;
          const next = Math.max(0, prev - delta);
          if (next === 0) {
            handleTimeout('black');
          }
          return next;
        });
      }
    }, MULTIPLAYER_SCALE_CONFIG.matchmaking.clockTickIntervalMs);

    return () => clearInterval(interval);
  }, [
    isWaiting,
    gameState.currentTurn,
    gameState.isGameOver,
    timeControlMinutes,
    handleTimeout,
  ]);

  /**
   * Handles move execution from user interaction or bot automation.
   *
   * Algorithmic Complexity:
   * - Time Complexity: O(1) constant time board move execution and clock arithmetic.
   * - Auxiliary Space Complexity: O(1) constant state allocation.
   *
   * Growth Rate:
   * - O(1) flat growth rate, invariant to move history length or match volume.
   */
  const handleMakeMove = useCallback((move: Move) => {
    const currentState = gameStateRef.current;
    if (currentState.isGameOver) return;

    // Play appropriate sound effect
    if (move.captured) {
      soundService.playCapture();
    } else {
      soundService.playMove();
    }

    if (move.piece.type !== 'pawn') {
      const destRow = parseInt(move.to[1], 10) - 1;
      const goalRow =
        move.piece.color === 'white'
          ? SCHADA_RULES_CONFIG.board.whiteGoalRankIndex
          : SCHADA_RULES_CONFIG.board.blackGoalRankIndex;
      if (destRow === goalRow) {
        soundService.playGoal();
      }
    }

    const nextState = executeMove(currentState, move);
    gameStateRef.current = nextState;
    const newMoveIndex = nextState.moveHistory.length - 1;
    lastAudibleMoveIndexRef.current = newMoveIndex;
    prevMoveCountRef.current = nextState.moveHistory.length;
    prevHistoryLenRef.current = nextState.moveHistory.length;
    setViewMoveIndex(newMoveIndex);
    setHasUnreadLiveMove(false);

    if (isCorrespondence) {
      setWhiteTime(initialMs);
      setBlackTime(initialMs);
    } else if (!customMakeMove && incrementSeconds > 0 && timeControlMinutes > 0) {
      const addMs = incrementSeconds * CANONICAL_DIGITAL_CLOCK_CONFIG.timeUnits.msPerSecond;
      const isWhiteTurn = currentState.currentTurn === 'white';
      if (isWhiteTurn) {
        setWhiteTime((prev) => prev + addMs);
      } else {
        setBlackTime((prev) => prev + addMs);
      }
    }

    setGameState(nextState);

    if (customMakeMove) {
      customMakeMove(move);
    } else if (nextState.isGameOver && onGameComplete) {
      onGameComplete(nextState);
    }
  }, [customMakeMove, incrementSeconds, timeControlMinutes, initialMs, isCorrespondence, onGameComplete]);

  // Bot Turn Automation (via Web Worker with sync fallback)
  useEffect(() => {
    if (!isComputer || !computerColor || gameState.isGameOver) return;
    if (gameState.currentTurn !== computerColor) return;

    let isSubscribed = true;
    setIsBotThinking(true);
    const delay = getBotThinkingDelayMs(botLevel, gameStateRef.current.moveHistory);
    const timer = setTimeout(async () => {
      const remainingTimeMs =
        computerColor === 'white'
          ? whiteTimeRef.current
          : blackTimeRef.current;
      const botMove = await botWorkerClient.requestBotMove(
        gameStateRef.current.board,
        computerColor,
        botLevel,
        gameStateRef.current.moveHistory,
        remainingTimeMs,
        incrementSeconds * CANONICAL_DIGITAL_CLOCK_CONFIG.timeUnits.msPerSecond
      );
      if (!isSubscribed) return;
      setIsBotThinking(false);
      if (botMove) {
        handleMakeMove(botMove);
      }
    }, delay);

    return () => {
      isSubscribed = false;
      clearTimeout(timer);
      setIsBotThinking(false);
    };
  }, [
    gameState.currentTurn,
    gameState.isGameOver,
    isComputer,
    computerColor,
    botLevel,
    handleMakeMove,
    incrementSeconds,
  ]);

  const handleResign = () => {
    if (gameState.isGameOver) return;
    const resigningColor = isComputer && userColor ? userColor : (userColor || gameState.currentTurn);
    if (customResign) {
      customResign();
      return;
    }
    const nextState = resignGame(gameState, resigningColor);
    setGameState(nextState);
    if (onGameComplete) onGameComplete(nextState);
  };

  const handleFlipBoard = () => {
    setOrientation((prev) => (prev === 'white' ? 'black' : 'white'));
  };

  // Algorithmic Complexity:
  // - Cumulative states computed once per move addition: O(N) linear time with game move count.
  // - Random-access history scrubbing for UI renders: O(1) constant time array lookup.
  const cumulativeGameStates = useMemo(() => {
    return computeCumulativeGameStates(gameState.moveHistory, gameState);
  }, [gameState.moveHistory, gameState.isGameOver]);

  const isViewingHistory =
    gameState.moveHistory.length > 0 && viewMoveIndex < gameState.moveHistory.length - 1;

  const displayedGameState = useMemo(() => {
    if (!isViewingHistory) return gameState;
    const stateOffset = viewMoveIndex - CANONICAL_MOVE_NAVIGATOR_CONFIG.startMoveIndex;
    return cumulativeGameStates[stateOffset] ?? gameState;
  }, [isViewingHistory, gameState, viewMoveIndex, cumulativeGameStates]);

  const displayedLastMove = useMemo(() => {
    if (viewMoveIndex < 0) return null;
    return gameState.moveHistory[viewMoveIndex] || null;
  }, [gameState.moveHistory, viewMoveIndex]);

  const computedElo = useMemo(() => {
    if (whiteElo && blackElo) {
      return {
        white: whiteElo,
        black: blackElo,
      };
    }
    if (isRanked && whitePlayer && blackPlayer && gameState.result?.winner) {
      const outcome = gameState.result.winner;
      const calc = calculateEloUpdate(
        {
          rating: whitePlayer.elo,
          gamesPlayed: whitePlayer.gamesPlayed ?? ELO_CONFIG.defaultAssumedGamesPlayed,
        },
        {
          rating: blackPlayer.elo,
          gamesPlayed: blackPlayer.gamesPlayed ?? ELO_CONFIG.defaultAssumedGamesPlayed,
        },
        outcome
      );
      const wUpdate = { newElo: calc.newWhiteRating, delta: calc.whiteDelta };
      const bUpdate = { newElo: calc.newBlackRating, delta: calc.blackDelta };
      return {
        white: wUpdate,
        black: bUpdate,
      };
    }
    return null;
  }, [whiteElo, blackElo, isRanked, whitePlayer, blackPlayer, gameState.result?.winner]);

  const isWhiteOrientation = orientation === 'white';
  const topColor: PieceColor = isWhiteOrientation ? 'black' : 'white';
  const bottomColor: PieceColor = isWhiteOrientation ? 'white' : 'black';

  const topPlayer = topColor === 'white' ? whitePlayer : blackPlayer;
  const bottomPlayer = bottomColor === 'white' ? whitePlayer : blackPlayer;

  const topElo = (gameState.isGameOver && computedElo)
    ? (topColor === 'white' ? computedElo.white.newElo : computedElo.black.newElo)
    : topPlayer.elo;
  const bottomElo = (gameState.isGameOver && computedElo)
    ? (bottomColor === 'white' ? computedElo.white.newElo : computedElo.black.newElo)
    : bottomPlayer.elo;

  const topTime = topColor === 'white' ? whiteTime : blackTime;
  const bottomTime = bottomColor === 'white' ? whiteTime : blackTime;
  // Algorithmic Complexity: O(1) constant time, verifying whether game has unlimited time controls.
  // Growth Rate: O(1) flat.
  const isUnlimited = timeControlMinutes <= 0;

  const formattedTimeControl = useMemo(
    () =>
      formatTimeControlDisplay(
        Math.max(0, timeControlMinutes),
        Math.max(0, incrementSeconds),
        LOBBY_CONFIG
      ),
    [timeControlMinutes, incrementSeconds]
  );

  const topCaptured = displayedGameState.capturedPieces[topColor === 'white' ? 'black' : 'white'];
  const bottomCaptured = displayedGameState.capturedPieces[bottomColor === 'white' ? 'black' : 'white'];

  const materialScores = useMemo(() => {
    const topScore = getMaterialValue(topCaptured);
    const bottomScore = getMaterialValue(bottomCaptured);
    return {
      topAdvantage: topScore - bottomScore,
      bottomAdvantage: bottomScore - topScore,
    };
  }, [topCaptured, bottomCaptured]);

  return (
    <div className="arena-layout">
      {/* Left/Center Column: Board Arena */}
      <div className="arena-board-col">
        {/* Top Player Card */}
        <PlayerCard
          username={topPlayer.username}
          elo={topElo}
          color={topColor}
          isTurn={displayedGameState.currentTurn === topColor && !gameState.isGameOver}
          remainingMs={topTime}
          isUnlimited={isUnlimited}
          capturedPieces={topCaptured}
          materialAdvantage={materialScores.topAdvantage > 0 ? materialScores.topAdvantage : undefined}
          isUser={userColor === topColor}
          isThinking={isBotThinking && displayedGameState.currentTurn === topColor}
          isPatron={isPatronUser(topPlayer)}
          isDisconnected={!isCorrespondence && (topColor === 'white' ? whiteDisconnected : blackDisconnected)}
          abandonCountdownSeconds={!isCorrespondence && (topColor === 'white' ? whiteDisconnected : blackDisconnected) ? abandonCountdownSeconds : undefined}
        />

        {/* Board Component */}
        <SchadaBoard
          board={displayedGameState.board}
          currentTurn={displayedGameState.currentTurn}
          playerColor={userColor}
          orientation={orientation}
          lastMove={displayedLastMove}
          onMakeMove={handleMakeMove}
          disabled={
            isViewingHistory ||
            gameState.isGameOver ||
            isSpectator ||
            (isComputer && gameState.currentTurn === computerColor) ||
            (Boolean(userColor) && gameState.currentTurn !== userColor)
          }
        />

        {/* Bottom Player Card */}
        <PlayerCard
          username={bottomPlayer.username}
          elo={bottomElo}
          color={bottomColor}
          isTurn={displayedGameState.currentTurn === bottomColor && !gameState.isGameOver}
          remainingMs={bottomTime}
          isUnlimited={isUnlimited}
          capturedPieces={bottomCaptured}
          materialAdvantage={materialScores.bottomAdvantage > 0 ? materialScores.bottomAdvantage : undefined}
          isUser={userColor === bottomColor}
          isThinking={isBotThinking && displayedGameState.currentTurn === bottomColor}
          isPatron={isPatronUser(bottomPlayer)}
          isDisconnected={!isCorrespondence && (bottomColor === 'white' ? whiteDisconnected : blackDisconnected)}
          abandonCountdownSeconds={!isCorrespondence && (bottomColor === 'white' ? whiteDisconnected : blackDisconnected) ? abandonCountdownSeconds : undefined}
        />

        {/* Mobile In-Game Action Bar */}
        <div className="mobile-arena-actions">
          <div className="mobile-arena-actions-row">
            <button
              className="mobile-action-btn"
              onClick={handleFlipBoard}
              title="Flip Board"
              aria-label="Flip Board"
            >
              <RotateCcw size={17} />
              <span>Flip</span>
            </button>

            {!isSpectator && !gameState.isGameOver && (
              <button
                className="mobile-action-btn danger"
                onClick={handleResign}
                title="Resign"
                aria-label="Resign"
              >
                <Flag size={17} />
                <span>Resign</span>
              </button>
            )}

            {gameState.isGameOver && (
              <button
                className="mobile-action-btn"
                onClick={() => setShowGameOverModal(true)}
                title="View Match Results"
                aria-label="Results"
              >
                <Trophy size={17} />
                <span>Results</span>
              </button>
            )}

            <button
              className="mobile-action-btn"
              onClick={onExit}
              title="Exit to Lobby"
              aria-label="Exit"
            >
              <ArrowLeft size={17} />
              <span>Exit</span>
            </button>
          </div>

          {/* Mobile Move Navigation Controls */}
          <div className="mobile-move-navigator">
            <MoveNavigator
              currentIndex={viewMoveIndex}
              totalMoves={gameState.moveHistory.length}
              onNavigate={setViewMoveIndex}
              hasUnreadLiveMove={hasUnreadLiveMove}
            />
          </div>

          <button
            className={`mobile-action-btn mobile-action-btn-moves ${mobileHistoryOpen ? 'active' : ''}`}
            onClick={() => setMobileHistoryOpen(true)}
            title="Move Notation"
            aria-label="Move Notation"
          >
            <ListOrdered size={17} />
            <span>Moves ({gameState.moveHistory.length})</span>
          </button>
        </div>
      </div>

      {/* Right Column: Game Controls, Move History, Status (Desktop) */}
      <div className="arena-panel-col">
        {/* Match Header */}
        <div className="arena-match-header">
          <div style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {formattedTimeControl} •{' '}
            <span style={{ color: isRanked ? 'var(--accent-gold)' : 'var(--text-secondary)' }}>
              {isSpectator ? 'Spectating' : isComputer ? `${getBotTier(botLevel).name} (Lvl ${botLevel})` : isRanked ? 'Ranked' : 'Casual'}
            </span>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {gameState.isGameOver ? (
              <span style={{ color: 'var(--accent-gold)', fontWeight: 700 }}>GAME OVER</span>
            ) : (
              <>Turn: <strong style={{ color: displayedGameState.currentTurn === 'white' ? 'var(--piece-white)' : 'var(--piece-black)' }}>{displayedGameState.currentTurn === 'white' ? 'WHITE' : 'BLACK'}</strong></>
            )}
          </div>
        </div>

        {/* Move History Table */}
        <MoveHistory
          history={gameState.moveHistory}
          currentMoveIndex={viewMoveIndex}
          onNavigateMove={setViewMoveIndex}
          isReview={isReview}
          onAnalyze={handleAnalyze}
          isAnalyzing={isAnalyzing}
          analysisProgress={analysisProgress}
          analyzedQualities={analyzedQualities}
          onCancelAnalysis={handleCancelAnalysis}
          hasUnreadLiveMove={hasUnreadLiveMove}
        />

        {/* Action Controls */}
        <GameControls
          onResign={handleResign}
          onFlipBoard={handleFlipBoard}
          disabled={gameState.isGameOver || isSpectator}
          isGameOver={gameState.isGameOver}
          onShowResult={() => setShowGameOverModal(true)}
          onExit={onExit}
        />
      </div>

      {/* Mobile Move History Slide-up Sheet */}
      {mobileHistoryOpen && (
        <div className="mobile-sheet-backdrop" onClick={() => setMobileHistoryOpen(false)}>
          <div className="mobile-sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-sheet-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                <ListOrdered size={18} color="var(--accent-gold)" />
                <span>Move Notation ({gameState.moveHistory.length})</span>
              </div>
              <button
                className="action-btn"
                style={{ padding: '0.35rem' }}
                onClick={() => setMobileHistoryOpen(false)}
                aria-label="Close Move Notation"
              >
                <X size={18} />
              </button>
            </div>
            {/* Match Header in Mobile Sheet */}
            <div className="arena-match-header mobile">
              <div style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {formattedTimeControl} •{' '}
                <span style={{ color: isRanked ? 'var(--accent-gold)' : 'var(--text-secondary)' }}>
                  {isSpectator ? 'Spectating' : isComputer ? `${getBotTier(botLevel).name} (Lvl ${botLevel})` : isRanked ? 'Ranked' : 'Casual'}
                </span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {gameState.isGameOver ? (
                  <span style={{ color: 'var(--accent-gold)', fontWeight: 700 }}>GAME OVER</span>
                ) : (
                  <>Turn: <strong style={{ color: displayedGameState.currentTurn === 'white' ? 'var(--piece-white)' : 'var(--piece-black)' }}>{displayedGameState.currentTurn === 'white' ? 'WHITE' : 'BLACK'}</strong></>
                )}
              </div>
            </div>
            <div className="mobile-sheet-body">
              <MoveHistory
                history={gameState.moveHistory}
                currentMoveIndex={viewMoveIndex}
                onNavigateMove={setViewMoveIndex}
                isReview={isReview}
                onAnalyze={handleAnalyze}
                isAnalyzing={isAnalyzing}
                analysisProgress={analysisProgress}
                analyzedQualities={analyzedQualities}
                onCancelAnalysis={handleCancelAnalysis}
                hasUnreadLiveMove={hasUnreadLiveMove}
              />
            </div>
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {gameState.isGameOver && gameState.result && showGameOverModal && (
        <GameOverModal
          result={gameState.result}
          userColor={userColor}
          isRanked={isRanked}
          whitePlayer={whitePlayer}
          blackPlayer={blackPlayer}
          whiteElo={computedElo?.white || whiteElo}
          blackElo={computedElo?.black || blackElo}
          triggerEffects={!gameOverEffectsPlayed}
          onEffectsPlayed={handleGameOverEffectsPlayed}
          onHome={onExit}
          onClose={() => {
            setShowGameOverModal(false);
            setGameOverEffectsPlayed(true);
            setIsReviewMode(true);
          }}
          analysisReport={postGameAnalysis}
          isAnalyzing={isPostGameAnalyzing}
          moveHistory={gameState.moveHistory}
        />
      )}

      {/* Analysis Settings Modal */}
      <AnalysisModal
        isOpen={showAnalysisModal}
        totalMoves={gameState.moveHistory.length}
        onClose={() => setShowAnalysisModal(false)}
        onStartAnalysis={(params) => {
          setShowAnalysisModal(false);
          handleStartAnalysis(params);
        }}
      />
    </div>
  );
};
