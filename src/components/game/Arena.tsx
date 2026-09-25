import React, { useState, useEffect, useRef } from 'react';
import type { BoardState, Move, Piece, PieceColor } from '@/core/schada/types';
import { executeMove, resignGame, timeoutGame } from '@/core/schada/engine';
import { selectBotMove, getBotThinkingDelayMs } from '@/core/bot/schadaBot';
import { soundService } from '@/services/audio/soundService';
import { RotateCcw, Flag, ListOrdered, X, ArrowLeft } from 'lucide-react';
import { SchadaBoard } from '../board/SchadaBoard';
import { PlayerCard } from './PlayerCard';
import { MoveHistory } from './MoveHistory';
import { GameControls } from './GameControls';
import { GameOverModal } from './GameOverModal';

export interface ArenaPlayer {
  id: string;
  username: string;
  elo: number;
}

interface ArenaProps {
  initialState: BoardState;
  bluePlayer: ArenaPlayer;
  greenPlayer: ArenaPlayer;
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
}

export const Arena: React.FC<ArenaProps> = ({
  initialState,
  bluePlayer,
  greenPlayer,
  timeControlMinutes = 5,
  incrementSeconds = 0,
  isRanked = false,
  userColor,
  isComputer = false,
  botLevel = 1,
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
}) => {
  const [gameState, setGameState] = useState<BoardState>(syncedGameState || initialState);
  const [orientation, setOrientation] = useState<'blue' | 'green'>(userColor || 'blue');
  const [isBotThinking, setIsBotThinking] = useState(false);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);

  const gameStateRef = useRef<BoardState>(gameState);
  gameStateRef.current = gameState;

  const prevMoveCountRef = useRef<number>(gameState.moveHistory.length);

  // Sync external state from Firestore/multiplayer if provided
  useEffect(() => {
    if (syncedGameState) {
      if (syncedGameState.moveHistory.length > prevMoveCountRef.current) {
        const latestMove = syncedGameState.moveHistory[syncedGameState.moveHistory.length - 1];
        if (latestMove.captured) {
          soundService.playCapture();
        } else {
          soundService.playMove();
        }
      }
      prevMoveCountRef.current = syncedGameState.moveHistory.length;
      setGameState(syncedGameState);
    }
  }, [syncedGameState]);

  const computerColor: PieceColor | undefined =
    isComputer && userColor ? (userColor === 'blue' ? 'green' : 'blue') : undefined;

  const initialMs = timeControlMinutes > 0 ? timeControlMinutes * 60 * 1000 : 0;
  const [blueTime, setBlueTime] = useState<number>(syncedBlueTimeMs ?? initialMs);
  const [greenTime, setGreenTime] = useState<number>(syncedGreenTimeMs ?? initialMs);

  useEffect(() => {
    if (syncedBlueTimeMs !== undefined) setBlueTime(syncedBlueTimeMs);
  }, [syncedBlueTimeMs]);

  useEffect(() => {
    if (syncedGreenTimeMs !== undefined) setGreenTime(syncedGreenTimeMs);
  }, [syncedGreenTimeMs]);

  const lastTickRef = useRef<number>(Date.now());

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
          const next = Math.max(0, prev - delta);
          if (next === 0 && prev > 0) {
            handleTimeout('blue');
          }
          return next;
        });
      } else {
        setGreenTime((prev) => {
          const next = Math.max(0, prev - delta);
          if (next === 0 && prev > 0) {
            handleTimeout('green');
          }
          return next;
        });
      }
    }, 100);

    return () => clearInterval(interval);
  }, [gameState.currentTurn, gameState.isGameOver, timeControlMinutes]);

  const handleTimeout = (timedOutColor: PieceColor) => {
    if (customTimeout) {
      customTimeout(timedOutColor);
    }
    setGameState((prev) => {
      const ended = timeoutGame(prev, timedOutColor);
      if (onGameComplete) onGameComplete(ended);
      return ended;
    });
  };

  const handleMakeMove = (move: Move) => {
    const currentState = gameStateRef.current;
    if (currentState.isGameOver) return;

    if (customMakeMove) {
      if (move.captured) {
        soundService.playCapture();
      } else {
        soundService.playMove();
      }
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
  };

  // Bot Turn Automation
  useEffect(() => {
    if (!isComputer || !computerColor || gameState.isGameOver) return;
    if (gameState.currentTurn !== computerColor) return;

    setIsBotThinking(true);
    const delay = getBotThinkingDelayMs(botLevel);
    const timer = setTimeout(() => {
      const botMove = selectBotMove(
        gameStateRef.current.board,
        computerColor,
        botLevel,
        gameStateRef.current.moveHistory
      );
      setIsBotThinking(false);
      if (botMove) {
        handleMakeMove(botMove);
      }
    }, delay);

    return () => {
      clearTimeout(timer);
      setIsBotThinking(false);
    };
  }, [gameState.currentTurn, gameState.isGameOver, isComputer, computerColor, botLevel]);

  const handleResign = () => {
    if (gameState.isGameOver) return;
    if (customResign) {
      customResign();
      return;
    }
    const resigningColor = isComputer && userColor ? userColor : gameState.currentTurn;
    const nextState = resignGame(gameState, resigningColor);
    setGameState(nextState);
    if (onGameComplete) onGameComplete(nextState);
  };

  const handleFlipBoard = () => {
    setOrientation((prev) => (prev === 'blue' ? 'green' : 'blue'));
  };

  const lastMove = gameState.moveHistory[gameState.moveHistory.length - 1] || null;

  const topColor: PieceColor = orientation === 'blue' ? 'green' : 'blue';
  const bottomColor: PieceColor = orientation === 'blue' ? 'blue' : 'green';

  const topPlayer = topColor === 'blue' ? bluePlayer : greenPlayer;
  const bottomPlayer = bottomColor === 'blue' ? bluePlayer : greenPlayer;

  const topTime = topColor === 'blue' ? blueTime : greenTime;
  const bottomTime = bottomColor === 'blue' ? blueTime : greenTime;

  const topCaptured = gameState.capturedPieces[topColor === 'blue' ? 'green' : 'blue'];
  const bottomCaptured = gameState.capturedPieces[bottomColor === 'blue' ? 'green' : 'blue'];

  const getMaterialValue = (pieces: Piece[]) =>
    pieces.reduce(
      (sum, p) => sum + (p.type === 'field_officer' ? 3 : p.type === 'officer' ? 2 : 1),
      0
    );

  const topMaterialScore = getMaterialValue(topCaptured);
  const bottomMaterialScore = getMaterialValue(bottomCaptured);
  const topAdvantage = topMaterialScore - bottomMaterialScore;
  const bottomAdvantage = bottomMaterialScore - topMaterialScore;

  return (
    <div className="arena-layout">
      {/* Left/Center Column: Board Arena */}
      <div className="arena-board-col">
        {/* Top Player Card */}
        <PlayerCard
          username={topPlayer.username}
          elo={topPlayer.elo}
          color={topColor}
          isTurn={gameState.currentTurn === topColor && !gameState.isGameOver}
          remainingMs={topTime}
          capturedPieces={topCaptured}
          materialAdvantage={topAdvantage > 0 ? topAdvantage : undefined}
          isUser={userColor === topColor}
          isThinking={isBotThinking && gameState.currentTurn === topColor}
        />

        {/* Board Component */}
        <SchadaBoard
          board={gameState.board}
          currentTurn={gameState.currentTurn}
          playerColor={userColor}
          orientation={orientation}
          lastMove={lastMove}
          onMakeMove={handleMakeMove}
          disabled={
            gameState.isGameOver ||
            isSpectator ||
            (isComputer && gameState.currentTurn === computerColor) ||
            (Boolean(userColor) && gameState.currentTurn !== userColor)
          }
        />

        {/* Bottom Player Card */}
        <PlayerCard
          username={bottomPlayer.username}
          elo={bottomPlayer.elo}
          color={bottomColor}
          isTurn={gameState.currentTurn === bottomColor && !gameState.isGameOver}
          remainingMs={bottomTime}
          capturedPieces={bottomCaptured}
          materialAdvantage={bottomAdvantage > 0 ? bottomAdvantage : undefined}
          isUser={userColor === bottomColor}
          isThinking={isBotThinking && gameState.currentTurn === bottomColor}
        />

        {/* Mobile In-Game Action Bar */}
        <div className="mobile-arena-actions">
          <button
            className="mobile-action-btn"
            onClick={handleFlipBoard}
            title="Flip Board"
            aria-label="Flip Board"
          >
            <RotateCcw size={17} />
            <span>Flip</span>
          </button>

          <button
            className={`mobile-action-btn ${mobileHistoryOpen ? 'active' : ''}`}
            onClick={() => setMobileHistoryOpen(true)}
            title="Move Notation"
            aria-label="Move Notation"
          >
            <ListOrdered size={17} />
            <span>Moves ({gameState.moveHistory.length})</span>
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
      </div>

      {/* Right Column: Game Controls, Move History, Status (Desktop) */}
      <div className="arena-panel-col">
        {/* Match Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {timeControlMinutes > 0 ? `${timeControlMinutes}+${incrementSeconds}` : 'Unlimited'} •{' '}
            <span style={{ color: isRanked ? 'var(--accent-gold)' : 'var(--text-secondary)' }}>
              {isSpectator ? 'Spectating' : isComputer ? `Level ${botLevel} Bot` : isRanked ? 'Ranked' : 'Casual'}
            </span>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Turn: <strong style={{ color: gameState.currentTurn === 'blue' ? 'var(--piece-blue)' : 'var(--piece-green)' }}>{gameState.currentTurn.toUpperCase()}</strong>
          </div>
        </div>

        {/* Move History Table */}
        <MoveHistory history={gameState.moveHistory} />

        {/* Action Controls */}
        <GameControls
          onResign={handleResign}
          onFlipBoard={handleFlipBoard}
          disabled={gameState.isGameOver || isSpectator}
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
            <div className="mobile-sheet-body">
              <MoveHistory history={gameState.moveHistory} />
            </div>
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {gameState.isGameOver && gameState.result && (
        <GameOverModal
          result={gameState.result}
          userColor={userColor}
          onHome={onExit}
        />
      )}
    </div>
  );
};
