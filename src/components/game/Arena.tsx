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
import { calculateEloUpdate } from '@/core/elo/eloService';
import { ELO_CONFIG } from '@/core/elo/eloConfig';
import { SCHADA_RULES_CONFIG } from '@/core/schada/rulesConfig';
import { isPatronUser, type PatronTier, type PatronSubscriptionStatus } from '@/components/common/PatronBadge';
import { LOBBY_CONFIG } from '@/components/lobby/lobbyConfig';

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
  bluePlayer: ArenaPlayer;
  greenPlayer: ArenaPlayer;
  blueElo?: PlayerEloUpdate;
  greenElo?: PlayerEloUpdate;
  timeControlMinutes?: number; // 0 for unlimited
  incrementSeconds?: number; // Fischer increment
  isRanked?: boolean;
  userColor?: PieceColor; // undefined for pass & play / spectator
  isComputer?: boolean;
  botLevel?: number;
  isSpectator?: boolean;
  isWaiting?: boolean;
  syncedGameState?: BoardState;
  syncedBlueTimeMs?: number;
  syncedGreenTimeMs?: number;
  onMakeMove?: (move: Move) => Promise<void> | void;
  onResign?: () => void;
  onTimeout?: (timedOutColor: PieceColor) => void;
  onGameComplete?: (finalState: BoardState) => void;
  onExit: () => void;
  blueDisconnected?: boolean;
  greenDisconnected?: boolean;
  abandonCountdownSeconds?: number | null;
}

export const Arena: React.FC<ArenaProps> = ({
  initialState,
  bluePlayer,
  greenPlayer,
  blueElo,
  greenElo,
  timeControlMinutes = BOT_ENGINE_CONFIG.timeManagement.defaultMatchMinutes,
  incrementSeconds = BOT_ENGINE_CONFIG.timeManagement.defaultIncrementMs / 1000,
  isRanked = false,
  userColor,
  isComputer = false,
  botLevel = BOT_ENGINE_CONFIG.defaultLevel,
  isSpectator = false,
  isWaiting = false,
  syncedGameState,
  syncedBlueTimeMs,
  syncedGreenTimeMs,
  onMakeMove: customMakeMove,
  onResign: customResign,
  onTimeout: customTimeout,
  onGameComplete,
  onExit,
  blueDisconnected,
  greenDisconnected,
  abandonCountdownSeconds,
}) => {
  const [gameState, setGameState] = useState<BoardState>(syncedGameState || initialState);
  const [viewMoveIndex, setViewMoveIndex] = useState<number>(() => {
    const historyLen = (syncedGameState || initialState).moveHistory.length;
    return historyLen > 0 ? historyLen - 1 : CANONICAL_MOVE_NAVIGATOR_CONFIG.startMoveIndex;
  });
  const [isBotThinking, setIsBotThinking] = useState(false);

  const [orientation, setOrientation] = useState<'blue' | 'green'>(() => {
    if (userColor) return userColor;
    if (!isSpectator) return (syncedGameState || initialState).currentTurn;
    return 'blue';
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
  const [showGameOverModal, setShowGameOverModal] = useState(true);
  const [gameOverEffectsPlayed, setGameOverEffectsPlayed] = useState(false);
  const handleGameOverEffectsPlayed = useCallback(() => {
    setGameOverEffectsPlayed(true);
  }, []);

  const prevIsGameOverRef = useRef(gameState.isGameOver);
  useEffect(() => {
    if (!prevIsGameOverRef.current && gameState.isGameOver) {
      setShowGameOverModal(true);
      setGameOverEffectsPlayed(false);
      onGameComplete?.(gameState);
    }
    prevIsGameOverRef.current = gameState.isGameOver;
  }, [gameState.isGameOver, onGameComplete, gameState]);

  const gameStateRef = useRef<BoardState>(gameState);
  gameStateRef.current = gameState;

  const prevMoveCountRef = useRef<number>(gameState.moveHistory.length);
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
          const goalRow = latestMove.piece.color === 'blue' ? 7 : 0;
          if (destRow === goalRow) {
            soundService.playGoal();
          }
        }
      }

      lastAudibleMoveIndexRef.current = Math.max(lastAudibleMoveIndexRef.current, incomingLen - 1);
      prevMoveCountRef.current = incomingLen;

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
    }
  }, [syncedGameState]);

  const prevHistoryLenRef = useRef<number>(gameState.moveHistory.length);
  useEffect(() => {
    const currentLen = gameState.moveHistory.length;
    const prevLen = prevHistoryLenRef.current;
    if (currentLen > prevLen) {
      setViewMoveIndex((prev) => (prev === prevLen - 1 ? currentLen - 1 : prev));
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
    isComputer && userColor ? (userColor === 'blue' ? 'green' : 'blue') : undefined;

  const initialMs = timeControlMinutes > 0 ? timeControlMinutes * 60 * 1000 : 0;
  const [blueTime, setBlueTime] = useState<number>(syncedBlueTimeMs ?? initialMs);
  const [greenTime, setGreenTime] = useState<number>(syncedGreenTimeMs ?? initialMs);

  const blueTimeRef = useRef<number>(blueTime);
  const greenTimeRef = useRef<number>(greenTime);
  useEffect(() => {
    blueTimeRef.current = blueTime;
  }, [blueTime]);
  useEffect(() => {
    greenTimeRef.current = greenTime;
  }, [greenTime]);

  useEffect(() => {
    if (typeof syncedBlueTimeMs === 'number') {
      const threshold = MULTIPLAYER_SCALE_CONFIG.matchmaking.clockSyncJitterThresholdMs;
      setBlueTime((prev) => (Math.abs(prev - syncedBlueTimeMs) > threshold ? syncedBlueTimeMs : prev));
    }
  }, [syncedBlueTimeMs]);

  useEffect(() => {
    if (typeof syncedGreenTimeMs === 'number') {
      const threshold = MULTIPLAYER_SCALE_CONFIG.matchmaking.clockSyncJitterThresholdMs;
      setGreenTime((prev) => (Math.abs(prev - syncedGreenTimeMs) > threshold ? syncedGreenTimeMs : prev));
    }
  }, [syncedGreenTimeMs]);

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
    if (gameState.currentTurn === 'blue' && blueTime <= 0) {
      handleTimeout('blue');
    } else if (gameState.currentTurn === 'green' && greenTime <= 0) {
      handleTimeout('green');
    }
  }, [isWaiting, gameState.isGameOver, timeControlMinutes, gameState.currentTurn, blueTime, greenTime, handleTimeout]);

  // Clock countdown timer
  useEffect(() => {
    if (isWaiting || gameState.isGameOver || timeControlMinutes <= 0) return;

    lastTickRef.current = Date.now();

    const interval = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;

      if (gameState.currentTurn === 'blue') {
        setBlueTime((prev) => {
          if (prev <= 0) return 0;
          const next = Math.max(0, prev - delta);
          if (next === 0) {
            handleTimeout('blue');
          }
          return next;
        });
      } else {
        setGreenTime((prev) => {
          if (prev <= 0) return 0;
          const next = Math.max(0, prev - delta);
          if (next === 0) {
            handleTimeout('green');
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

  const handleMakeMove = useCallback((move: Move) => {
    const currentState = gameStateRef.current;
    if (currentState.isGameOver) return;

    if (customMakeMove) {
      if (move.captured) {
        soundService.playCapture();
      } else {
        soundService.playMove();
      }

      if (move.piece.type !== 'pawn') {
        const destRow = parseInt(move.to[1], 10) - 1;
        const goalRow = move.piece.color === 'blue' ? 7 : 0;
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
      setGameState(nextState);
      customMakeMove(move);
      return;
    }

    // Play appropriate sound effect
    if (move.captured) {
      soundService.playCapture();
    } else {
      soundService.playMove();
    }

    const nextState = executeMove(currentState, move);
    gameStateRef.current = nextState;
    const newMoveIndex = nextState.moveHistory.length - 1;
    lastAudibleMoveIndexRef.current = newMoveIndex;
    prevMoveCountRef.current = nextState.moveHistory.length;
    prevHistoryLenRef.current = nextState.moveHistory.length;
    setViewMoveIndex(newMoveIndex);

    // If a high piece reached goal, chime!
    if (move.piece.type !== 'pawn') {
      const destRow = parseInt(move.to[1], 10) - 1;
      const goalRow = move.piece.color === 'blue' ? 7 : 0;
      if (destRow === goalRow) {
        soundService.playGoal();
      }
    }

    // Apply Fischer increment to player who just moved
    if (incrementSeconds > 0 && timeControlMinutes > 0) {
      const addMs = incrementSeconds * 1000;
      if (currentState.currentTurn === 'blue') {
        setBlueTime((prev) => prev + addMs);
      } else {
        setGreenTime((prev) => prev + addMs);
      }
    }

    setGameState(nextState);

    if (nextState.isGameOver && onGameComplete) {
      onGameComplete(nextState);
    }
  }, [customMakeMove, incrementSeconds, timeControlMinutes, onGameComplete]);

  // Bot Turn Automation (via Web Worker with sync fallback)
  useEffect(() => {
    if (!isComputer || !computerColor || gameState.isGameOver) return;
    if (gameState.currentTurn !== computerColor) return;

    let isSubscribed = true;
    setIsBotThinking(true);
    const delay = getBotThinkingDelayMs(botLevel, gameStateRef.current.moveHistory);
    const timer = setTimeout(async () => {
      const remainingTimeMs = computerColor === 'blue' ? blueTimeRef.current : greenTimeRef.current;
      const botMove = await botWorkerClient.requestBotMove(
        gameStateRef.current.board,
        computerColor,
        botLevel,
        gameStateRef.current.moveHistory,
        remainingTimeMs,
        incrementSeconds * 1000
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
    setOrientation((prev) => (prev === 'blue' ? 'green' : 'blue'));
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
    if (blueElo && greenElo) {
      return { blue: blueElo, green: greenElo };
    }
    if (isRanked && bluePlayer && greenPlayer && gameState.result?.winner) {
      const outcome = gameState.result.winner;
      const calc = calculateEloUpdate(
        {
          rating: bluePlayer.elo,
          gamesPlayed: bluePlayer.gamesPlayed ?? ELO_CONFIG.defaultAssumedGamesPlayed,
        },
        {
          rating: greenPlayer.elo,
          gamesPlayed: greenPlayer.gamesPlayed ?? ELO_CONFIG.defaultAssumedGamesPlayed,
        },
        outcome
      );
      return {
        blue: { newElo: calc.newBlueRating, delta: calc.blueDelta },
        green: { newElo: calc.newGreenRating, delta: calc.greenDelta },
      };
    }
    return null;
  }, [blueElo, greenElo, isRanked, bluePlayer, greenPlayer, gameState.result?.winner]);

  const topColor: PieceColor = orientation === 'blue' ? 'green' : 'blue';
  const bottomColor: PieceColor = orientation === 'blue' ? 'blue' : 'green';

  const topPlayer = topColor === 'blue' ? bluePlayer : greenPlayer;
  const bottomPlayer = bottomColor === 'blue' ? bluePlayer : greenPlayer;

  const topElo = (gameState.isGameOver && computedElo)
    ? (topColor === 'blue' ? computedElo.blue.newElo : computedElo.green.newElo)
    : topPlayer.elo;
  const bottomElo = (gameState.isGameOver && computedElo)
    ? (bottomColor === 'blue' ? computedElo.blue.newElo : computedElo.green.newElo)
    : bottomPlayer.elo;

  const topTime = topColor === 'blue' ? blueTime : greenTime;
  const bottomTime = bottomColor === 'blue' ? blueTime : greenTime;
  // Algorithmic Complexity: O(1) constant time, verifying whether game has unlimited time controls.
  // Growth Rate: O(1) flat.
  const isUnlimited = timeControlMinutes <= 0;
  const isCorrespondence =
    typeof timeControlMinutes === 'number' &&
    timeControlMinutes >= LOBBY_CONFIG.correspondenceCutoffMinutes;

  const topCaptured = displayedGameState.capturedPieces[topColor === 'blue' ? 'green' : 'blue'];
  const bottomCaptured = displayedGameState.capturedPieces[bottomColor === 'blue' ? 'green' : 'blue'];

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
          isDisconnected={!isCorrespondence && (topColor === 'blue' ? blueDisconnected : greenDisconnected)}
          abandonCountdownSeconds={!isCorrespondence && (topColor === 'blue' ? blueDisconnected : greenDisconnected) ? abandonCountdownSeconds : undefined}
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
          isDisconnected={!isCorrespondence && (bottomColor === 'blue' ? blueDisconnected : greenDisconnected)}
          abandonCountdownSeconds={!isCorrespondence && (bottomColor === 'blue' ? blueDisconnected : greenDisconnected) ? abandonCountdownSeconds : undefined}
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
            {timeControlMinutes > 0 ? `${timeControlMinutes}+${incrementSeconds}` : 'Unlimited'} •{' '}
            <span style={{ color: isRanked ? 'var(--accent-gold)' : 'var(--text-secondary)' }}>
              {isSpectator ? 'Spectating' : isComputer ? `${getBotTier(botLevel).name} (Lvl ${botLevel})` : isRanked ? 'Ranked' : 'Casual'}
            </span>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {gameState.isGameOver ? (
              <span style={{ color: 'var(--accent-gold)', fontWeight: 700 }}>GAME OVER</span>
            ) : (
              <>Turn: <strong style={{ color: displayedGameState.currentTurn === 'blue' ? 'var(--piece-blue)' : 'var(--piece-green)' }}>{displayedGameState.currentTurn.toUpperCase()}</strong></>
            )}
          </div>
        </div>

        {/* Move History Table */}
        <MoveHistory
          history={gameState.moveHistory}
          currentMoveIndex={viewMoveIndex}
          onNavigateMove={setViewMoveIndex}
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
                {timeControlMinutes > 0 ? `${timeControlMinutes}+${incrementSeconds}` : 'Unlimited'} •{' '}
                <span style={{ color: isRanked ? 'var(--accent-gold)' : 'var(--text-secondary)' }}>
                  {isSpectator ? 'Spectating' : isComputer ? `${getBotTier(botLevel).name} (Lvl ${botLevel})` : isRanked ? 'Ranked' : 'Casual'}
                </span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {gameState.isGameOver ? (
                  <span style={{ color: 'var(--accent-gold)', fontWeight: 700 }}>GAME OVER</span>
                ) : (
                  <>Turn: <strong style={{ color: displayedGameState.currentTurn === 'blue' ? 'var(--piece-blue)' : 'var(--piece-green)' }}>{displayedGameState.currentTurn.toUpperCase()}</strong></>
                )}
              </div>
            </div>
            <div className="mobile-sheet-body">
              <MoveHistory
                history={gameState.moveHistory}
                currentMoveIndex={viewMoveIndex}
                onNavigateMove={setViewMoveIndex}
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
          bluePlayer={bluePlayer}
          greenPlayer={greenPlayer}
          blueElo={computedElo?.blue || blueElo}
          greenElo={computedElo?.green || greenElo}
          triggerEffects={!gameOverEffectsPlayed}
          onEffectsPlayed={handleGameOverEffectsPlayed}
          onHome={onExit}
          onClose={() => {
            setShowGameOverModal(false);
            setGameOverEffectsPlayed(true);
          }}
        />
      )}
    </div>
  );
};
