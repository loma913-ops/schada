import React from 'react';
import type { Piece, PieceColor } from '@/core/schada/types';
import { DigitalClock } from './DigitalClock';
import { PieceIcon } from '../board/PieceIcon';

interface PlayerCardProps {
  username: string;
  elo: number;
  color: PieceColor;
  isTurn: boolean;
  remainingMs: number;
  capturedPieces: Piece[];
  isUser?: boolean;
  isThinking?: boolean;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({
  username,
  elo,
  color,
  isTurn,
  remainingMs,
  capturedPieces,
  isUser,
  isThinking,
}) => {
  return (
    <div className={`player-bar ${isTurn ? 'turn-active' : ''}`}>
      <div className="player-info">
        <div className={`player-avatar ${color}`}>
          {username.charAt(0).toUpperCase()}
        </div>
        <div className="player-meta">
          <span className="player-name">
            {username}
            {isUser && <span style={{ fontSize: '0.75rem', opacity: 0.7 }}> (You)</span>}
            {isThinking && (
              <span style={{ fontSize: '0.75rem', color: 'var(--accent-gold, #f59e0b)', marginLeft: '0.35rem', fontStyle: 'italic' }}>
                Thinking...
              </span>
            )}
          </span>
          <span className="player-elo">{elo}</span>
        </div>

        {/* Captured enemy pieces rack */}
        {capturedPieces.length > 0 && (
          <div style={{ display: 'flex', gap: '2px', marginLeft: '0.5rem', opacity: 0.85 }}>
            {capturedPieces.map((p, idx) => (
              <div key={idx} style={{ width: '18px', height: '18px' }} title={`Captured ${p.type}`}>
                <PieceIcon piece={p} />
              </div>
            ))}
          </div>
        )}
      </div>

      <DigitalClock remainingMs={remainingMs} isActive={isTurn} />
    </div>
  );
};
