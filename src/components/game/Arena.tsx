import React, { useState, useEffect, useRef } from 'react';
import type { BoardState, Move, PieceColor } from '@/core/schada/types';
import { executeMove, resignGame, timeoutGame } from '@/core/schada/engine';
import { soundService } from '@/services/audio/soundService';
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
  isRanked?: boolean;
  userColor?: PieceColor; // undefined for pass & play / spectator
  onGameComplete?: (finalState: BoardState) => void;
  onExit: () => void;
}

export const Arena: React.FC<ArenaProps> = ({
  initialState,
  bluePlayer,
  greenPlayer,
  timeControlMinutes = 5,
  isRanked = false,
  userColor,
  onGameComplete,
  onExit,
}) => {
  const [gameState, setGameState] = useState<BoardState>(initialState);
  const [orientation, setOrientation] = useState<'blue' | 'green'>(userColor || 'blue');

  const initialMs = timeControlMinutes > 0 ? timeControlMinutes * 60 * 1000 : 0;
  const [blueTime, setBlueTime] = useState<number>(initialMs);
  const [greenTime, setGreenTime] = useState<number>(initialMs);

  const lastTickRef = useRef<number>(Date.now());

  // Clock countdown timer
  useEffect(() => {
    if (gameState.isGameOver || timeControlMinutes <= 0) return;

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
    setGameState((prev) => {
      const ended = timeoutGame(prev, timedOutColor);
      if (onGameComplete) onGameComplete(ended);
      return ended;
    });
  };

  const handleMakeMove = (move: Move) => {
    if (gameState.isGameOver) return;

    // Play appropriate sound effect
    if (move.captured) {
      soundService.playCapture();
    } else {
      soundService.playMove();
    }

    const nextState = executeMove(gameState, move);

    // If a high piece reached goal, chime!
    if (move.piece.type !== 'pawn') {
      const destRow = parseInt(move.to[1], 10) - 1;
      const goalRow = move.piece.color === 'blue' ? 7 : 0;
      if (destRow === goalRow) {
        soundService.playGoal();
      }
    }

    setGameState(nextState);

    if (nextState.isGameOver && onGameComplete) {
      onGameComplete(nextState);
    }
  };

  const handleResign = () => {
    if (gameState.isGameOver) return;
    const resigningColor = userColor || gameState.currentTurn;
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
          capturedPieces={gameState.capturedPieces[topColor === 'blue' ? 'green' : 'blue']}
          isUser={userColor === topColor}
        />

        {/* Board Component */}
        <SchadaBoard
          board={gameState.board}
          currentTurn={gameState.currentTurn}
          playerColor={userColor}
          orientation={orientation}
          lastMove={lastMove}
          onMakeMove={handleMakeMove}
          disabled={gameState.isGameOver}
        />

        {/* Bottom Player Card */}
        <PlayerCard
          username={bottomPlayer.username}
          elo={bottomPlayer.elo}
          color={bottomColor}
          isTurn={gameState.currentTurn === bottomColor && !gameState.isGameOver}
          remainingMs={bottomTime}
          capturedPieces={gameState.capturedPieces[bottomColor === 'blue' ? 'green' : 'blue']}
          isUser={userColor === bottomColor}
        />
      </div>

      {/* Right Column: Game Controls, Move History, Status */}
      <div className="arena-panel-col">
        {/* Match Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {timeControlMinutes > 0 ? `${timeControlMinutes} min` : 'Casual'} •{' '}
            <span style={{ color: isRanked ? 'var(--accent-gold)' : 'var(--text-secondary)' }}>
              {isRanked ? 'Ranked' : 'Unrated'}
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
          disabled={gameState.isGameOver}
        />
      </div>

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
