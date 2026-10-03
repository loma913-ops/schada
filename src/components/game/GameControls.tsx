import React, { useState } from 'react';
import { Flag, Handshake, RotateCcw, Volume2, VolumeX, Trophy, Home } from 'lucide-react';
import { soundService } from '@/services/audio/soundService';
import {
  GAME_CONTROLS_CONFIG,
  validateGameControlsConfig,
  type GameControlsConfig,
} from './gameControlsConfig';

export interface GameControlsProps {
  onResign: () => void;
  onOfferDraw?: () => void;
  onFlipBoard: () => void;
  disabled?: boolean;
  isGameOver?: boolean;
  onShowResult?: () => void;
  onExit?: () => void;
  config?: GameControlsConfig;
}

/**
 * GameControls Component.
 *
 * Algorithmic Complexity:
 * - Render & Event Handlers: O(1) time, O(1) space.
 * - Configuration Validation: O(1) time, O(1) auxiliary space.
 */
export const GameControls: React.FC<GameControlsProps> = ({
  onResign,
  onOfferDraw,
  onFlipBoard,
  disabled = false,
  isGameOver = false,
  onShowResult,
  onExit,
  config = GAME_CONTROLS_CONFIG,
}) => {
  validateGameControlsConfig(config);
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flexShrink: 0 }}>
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
            {config.copy.resignConfirmTitle}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            <button
              type="button"
              className="action-btn danger"
              style={{ padding: '0.3rem 0.8rem' }}
              onClick={confirmResign}
            >
              {config.copy.resignButtonText}
            </button>
            <button
              type="button"
              className="action-btn"
              style={{ padding: '0.3rem 0.8rem' }}
              onClick={() => setShowResignConfirm(false)}
            >
              {config.copy.cancelButtonText}
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
                title={config.copy.resultsButtonTitle}
                aria-label={config.copy.resultsButtonAriaLabel}
              >
                <Trophy size={16} />
                <span className="btn-text">{config.copy.resultsButtonText}</span>
              </button>
            )}
            {onExit && (
              <button
                type="button"
                className="action-btn"
                onClick={onExit}
                title={config.copy.lobbyButtonTitle}
                aria-label={config.copy.lobbyButtonAriaLabel}
              >
                <Home size={16} />
                <span className="btn-text">{config.copy.lobbyButtonText}</span>
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
              title={config.copy.resignButtonTitle}
              aria-label={config.copy.resignButtonAriaLabel}
            >
              <Flag size={16} />
              <span className="btn-text">{config.copy.resignButtonText}</span>
            </button>

            {onOfferDraw && (
              <button
                type="button"
                className="action-btn"
                onClick={onOfferDraw}
                disabled={disabled}
                title={config.copy.drawButtonTitle}
                aria-label={config.copy.drawButtonAriaLabel}
              >
                <Handshake size={16} />
                <span className="btn-text">{config.copy.drawButtonText}</span>
              </button>
            )}
          </>
        )}

        <button
          type="button"
          className="action-btn"
          onClick={onFlipBoard}
          title={config.copy.flipButtonTitle}
          aria-label={config.copy.flipButtonAriaLabel}
        >
          <RotateCcw size={16} />
          <span className="btn-text">{config.copy.flipButtonText}</span>
        </button>

        <button
          type="button"
          className="action-btn mute-btn"
          onClick={handleToggleSound}
          title={isMuted ? config.copy.unmuteButtonTitle : config.copy.muteButtonTitle}
          aria-label={isMuted ? config.copy.unmuteButtonAriaLabel : config.copy.muteButtonAriaLabel}
        >
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      </div>
    </div>
  );
};
