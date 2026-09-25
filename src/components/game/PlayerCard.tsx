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
  materialAdvantage?: number;
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
  materialAdvantage,
  isUser,
  isThinking,
}) => {
  const pawns = capturedPieces.filter((p) => p.type === 'pawn');
  const fieldOfficers = capturedPieces.filter((p) => p.type === 'field_officer');
  const officers = capturedPieces.filter((p) => p.type === 'officer');
  const hasCapturedPieces = capturedPieces.length > 0;

  return (
    <div className={`player-bar ${isTurn ? 'turn-active' : ''}`}>
      <div className="player-info">
        <div className={`player-avatar ${color}`}>
          {username.charAt(0).toUpperCase()}
        </div>
        <div className="player-meta">
          <div className="player-name">
            <span>{username}</span>
            {isUser && <span style={{ fontSize: '0.75rem', opacity: 0.7 }}> (You)</span>}
          </div>
          <div className="player-sub">
            <span className="player-elo">{elo}</span>
            {isThinking && (
              <span className="player-thinking">
                • Thinking...
              </span>
            )}
          </div>
        </div>

        {/* Captured enemy pieces rack: 2 rows (top = pawns, bottom = high pieces) */}
        {hasCapturedPieces && (
          <div style={{ display: 'flex', alignItems: 'center', marginLeft: '0.5rem' }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: '2px',
                minHeight: '34px',
              }}
            >
              {/* Top row: pawns */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: '16px',
                  minHeight: '16px',
                }}
              >
                {pawns.map((p, idx) => (
                  <div
                    key={p.id || idx}
                    style={{
                      width: '16px',
                      height: '16px',
                      marginLeft: idx > 0 ? '-4px' : '0',
                      zIndex: idx + 1,
                    }}
                    title="Captured Pawn"
                  >
                    <PieceIcon piece={p} />
                  </div>
                ))}
              </div>

              {/* Bottom row: high pieces (Field Officers first, gap, then Officers) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: '16px',
                  minHeight: '16px',
                }}
              >
                {/* Field Officers */}
                {fieldOfficers.map((p, idx) => (
                  <div
                    key={p.id || idx}
                    style={{
                      width: '16px',
                      height: '16px',
                      marginLeft: idx > 0 ? '-4px' : '0',
                      zIndex: idx + 1,
                    }}
                    title="Captured Field Officer"
                  >
                    <PieceIcon piece={p} />
                  </div>
                ))}

                {/* Visible space between Field Officers and Officers if both are present */}
                {fieldOfficers.length > 0 && officers.length > 0 && (
                  <div style={{ width: '6px' }} />
                )}

                {/* Officers */}
                {officers.map((p, idx) => (
                  <div
                    key={p.id || idx}
                    style={{
                      width: '16px',
                      height: '16px',
                      marginLeft: idx > 0 ? '-4px' : '0',
                      zIndex: fieldOfficers.length + idx + 1,
                    }}
                    title="Captured Officer"
                  >
                    <PieceIcon piece={p} />
                  </div>
                ))}
              </div>
            </div>

            {/* Material Advantage Score */}
            {materialAdvantage !== undefined && materialAdvantage > 0 && (
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  marginLeft: '0.45rem',
                  letterSpacing: '0.2px',
                  userSelect: 'none',
                }}
              >
                +{materialAdvantage}
              </span>
            )}
          </div>
        )}
      </div>

      <DigitalClock remainingMs={remainingMs} isActive={isTurn} />
    </div>
  );
};
