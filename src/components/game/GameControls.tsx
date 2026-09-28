import React, { useState } from 'react';
import { Flag, Handshake, RotateCcw, Volume2, VolumeX, Trophy, Home } from 'lucide-react';
import { soundService } from '@/services/audio/soundService';

export interface GameControlsProps {
  onResign: () => void;
  onOfferDraw?: () => void;
  onFlipBoard: () => void;
  disabled?: boolean;
  isGameOver?: boolean;
  onShowResult?: () => void;
  onExit?: () => void;
}

export const GameControls: React.FC<GameControlsProps> = ({
  onResign,
  onOfferDraw,
  onFlipBoard,
  disabled = false,
  isGameOver = false,
  onShowResult,
  onExit,
}) => {
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [isMuted, setIsMuted] = useState(soundService.getMuted());

  const handleToggleSound = () => {
    const updated = soundService.toggleMute();
    setIsMuted(updated);
  };

  const confirmResign = () => {
    setShowResignConfirm(false);
    onResign();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {showResignConfirm && (
        <div
          style={{
            padding: '0.75rem',
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--accent-red)',
            borderRadius: 'var(--radius-sm)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: 600 }}>
            Are you sure you want to resign?
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            <button
              className="action-btn danger"
              style={{ padding: '0.3rem 0.8rem' }}
              onClick={confirmResign}
            >
              Resign
            </button>
            <button
              className="action-btn"
              style={{ padding: '0.3rem 0.8rem' }}
              onClick={() => setShowResignConfirm(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="game-controls-bar">
        {isGameOver ? (
          <>
            {onShowResult && (
              <button
                type="button"
                className="action-btn"
                onClick={onShowResult}
                title="View Match Results"
              >
                <Trophy size={16} />
                <span>Results</span>
              </button>
            )}
            {onExit && (
              <button
                type="button"
                className="action-btn"
                onClick={onExit}
                title="Exit to Lobby"
              >
                <Home size={16} />
                <span>Lobby</span>
              </button>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              className="action-btn danger"
              onClick={() => setShowResignConfirm(true)}
              disabled={disabled || showResignConfirm}
              title="Resign Game"
            >
              <Flag size={16} />
              <span>Resign</span>
            </button>

            {onOfferDraw && (
              <button
                type="button"
                className="action-btn"
                onClick={onOfferDraw}
                disabled={disabled}
                title="Offer Draw"
              >
                <Handshake size={16} />
                <span>Draw</span>
              </button>
            )}
          </>
        )}

        <button className="action-btn" onClick={onFlipBoard} title="Flip Board Orientation">
          <RotateCcw size={16} />
          <span>Flip</span>
        </button>

        <button className="action-btn" onClick={handleToggleSound} title="Toggle Sound">
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      </div>
    </div>
  );
};
