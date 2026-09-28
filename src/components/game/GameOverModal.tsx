import React, { useEffect, useMemo, useRef } from 'react';
import type { GameResult, PieceColor } from '@/core/schada/types';
import confetti from 'canvas-confetti';
import { soundService } from '@/services/audio/soundService';
import { haptics } from '@/services/device/haptics';
import { Trophy, Award, RefreshCw, Home, X, Eye } from 'lucide-react';
import { calculateEloUpdate } from '@/core/elo/eloService';
import { ELO_CONFIG } from '@/core/elo/eloConfig';
import {
  GAME_OVER_MODAL_CONFIG,
  validateGameOverModalConfig,
  type GameOverModalConfig,
} from './gameOverConfig';

export interface GameOverPlayerInfo {
  readonly elo: number;
  readonly gamesPlayed?: number;
}

export interface PlayerEloUpdate {
  readonly newElo: number;
  readonly delta: number;
}

export interface GameOverModalProps {
  readonly result: GameResult;
  readonly userColor?: PieceColor;
  readonly isRanked?: boolean;
  readonly bluePlayer?: GameOverPlayerInfo;
  readonly greenPlayer?: GameOverPlayerInfo;
  readonly blueElo?: PlayerEloUpdate;
  readonly greenElo?: PlayerEloUpdate;
  readonly eloDelta?: number;
  readonly config?: GameOverModalConfig;
  readonly triggerEffects?: boolean;
  readonly onEffectsPlayed?: () => void;
  readonly onRematch?: () => void;
  readonly onHome: () => void;
  readonly onClose?: () => void;
}

/**
 * Game Over Modal Component.
 *
 * Displays match outcome, win reason, and scoring breakdown.
 * For rated matches, calculates and displays both players' updated Elo ratings
 * and delta changes formatted as ELO (GAIN/LOSS) directly underneath their respective colors.
 * Allows dismissing modal via close button, review action, backdrop click, or Escape key to inspect the board.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time, rendering static elements and running O(1) Elo calculation.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant time and space complexity.
 */
export const GameOverModal: React.FC<GameOverModalProps> = ({
  result,
  userColor,
  isRanked = false,
  bluePlayer,
  greenPlayer,
  blueElo,
  greenElo,
  eloDelta,
  config = GAME_OVER_MODAL_CONFIG,
  triggerEffects = true,
  onEffectsPlayed,
  onRematch,
  onHome,
  onClose,
}) => {
  validateGameOverModalConfig(config);

  const isWinner = userColor && result.winner === userColor;
  const isDraw = result.winner === 'draw';

  const eloInfo = useMemo(() => {
    if (!isRanked) return null;
    if (blueElo && greenElo) {
      return { blue: blueElo, green: greenElo };
    }
    if (bluePlayer && greenPlayer && result.winner) {
      const outcome = result.winner;
      const calculation = calculateEloUpdate(
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
        blue: { newElo: calculation.newBlueRating, delta: calculation.blueDelta },
        green: { newElo: calculation.newGreenRating, delta: calculation.greenDelta },
      };
    }
    return null;
  }, [isRanked, blueElo, greenElo, bluePlayer, greenPlayer, result.winner]);

  const effectsFiredRef = useRef(false);

  useEffect(() => {
    if (!triggerEffects || effectsFiredRef.current) return;
    effectsFiredRef.current = true;
    haptics.gameOver();
    if (isWinner) {
      soundService.playVictory();
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
    onEffectsPlayed?.();
  }, [isWinner, triggerEffects, onEffectsPlayed]);

  useEffect(() => {
    if (!onClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const getReasonText = (): string => {
    if (result.winReason && config.copy.winReasons[result.winReason]) {
      return config.copy.winReasons[result.winReason];
    }
    return config.copy.defaultGameCompletedText;
  };

  const modalTitle = isWinner
    ? config.copy.victoryTitle
    : isDraw
      ? config.copy.drawTitle
      : result.winner
        ? `${result.winner.toUpperCase()} Won`
        : config.copy.defaultGameOverTitle;

  const gridColumns =
    isRanked && eloInfo
      ? config.layout.gridColumnsRanked
      : config.layout.gridColumnsUnranked;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-over-title"
    >
      <div
        className="modal-content"
        style={{ textAlign: 'center', position: 'relative' }}
        onClick={(e) => e.stopPropagation()}
      >
        {onClose && (
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label={config.copy.closeButtonAriaLabel}
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        )}

        <div style={{ marginBottom: '1rem' }}>
          {isWinner ? (
            <Trophy size={48} color="var(--accent-gold)" style={{ margin: '0 auto' }} />
          ) : isDraw ? (
            <Award size={48} color="var(--accent-blue)" style={{ margin: '0 auto' }} />
          ) : (
            <div style={{ fontSize: '2.5rem' }}>⚔️</div>
          )}
        </div>

        <h2 id="game-over-title" style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.25rem' }}>
          {modalTitle}
        </h2>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.25rem' }}>
          {getReasonText()}
        </p>

        {/* Score Breakdown Table */}
        <div
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.8rem',
            marginBottom: '1.25rem',
            fontSize: '0.85rem',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: gridColumns,
              fontWeight: 700,
              paddingBottom: '0.4rem',
              borderBottom: '1px solid var(--border-subtle)',
              alignItems: 'center',
            }}
          >
            <span>Category</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ color: 'var(--piece-blue)' }}>Blue</span>
              {isRanked && eloInfo && (
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    marginTop: '0.15rem',
                  }}
                >
                  <span style={{ color: 'var(--text-primary)' }}>{eloInfo.blue.newElo}</span>{' '}
                  <span
                    style={{
                      color:
                        eloInfo.blue.delta > 0
                          ? 'var(--accent-green)'
                          : eloInfo.blue.delta < 0
                            ? 'var(--accent-red)'
                            : 'var(--text-muted)',
                      fontWeight: 700,
                    }}
                  >
                    ({eloInfo.blue.delta >= 0 ? `+${eloInfo.blue.delta}` : eloInfo.blue.delta})
                  </span>
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ color: 'var(--piece-green)' }}>Green</span>
              {isRanked && eloInfo && (
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    marginTop: '0.15rem',
                  }}
                >
                  <span style={{ color: 'var(--text-primary)' }}>{eloInfo.green.newElo}</span>{' '}
                  <span
                    style={{
                      color:
                        eloInfo.green.delta > 0
                          ? 'var(--accent-green)'
                          : eloInfo.green.delta < 0
                            ? 'var(--accent-red)'
                            : 'var(--text-muted)',
                      fontWeight: 700,
                    }}
                  >
                    ({eloInfo.green.delta >= 0 ? `+${eloInfo.green.delta}` : eloInfo.green.delta})
                  </span>
                </span>
              )}
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: gridColumns,
              padding: '0.3rem 0',
              alignItems: 'center',
            }}
          >
            <span style={{ color: 'var(--text-secondary)' }}>Goal Line Points</span>
            <span>{result.blueScore.goalScore}</span>
            <span>{result.greenScore.goalScore}</span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: gridColumns,
              padding: '0.3rem 0',
              alignItems: 'center',
            }}
          >
            <span style={{ color: 'var(--text-secondary)' }}>Outside High Pieces</span>
            <span>{result.blueScore.outsideGoalHighPiecesScore}</span>
            <span>{result.greenScore.outsideGoalHighPiecesScore}</span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: gridColumns,
              padding: '0.3rem 0',
              alignItems: 'center',
            }}
          >
            <span style={{ color: 'var(--text-secondary)' }}>Rank Distance</span>
            <span>{result.blueScore.rankDistanceScore}</span>
            <span>{result.greenScore.rankDistanceScore}</span>
          </div>
        </div>

        {/* Elo Delta Badge (fallback when eloInfo is not available) */}
        {!eloInfo && eloDelta !== undefined && (
          <div style={{ marginBottom: '1.5rem', fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginRight: '0.5rem' }}>
              {config.copy.ratingChangeLabel}
            </span>
            <span
              style={{
                fontWeight: 700,
                fontSize: '1.1rem',
                color: eloDelta >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
              }}
            >
              {eloDelta >= 0 ? `+${eloDelta}` : `${eloDelta}`}
            </span>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {onRematch && (
            <button
              type="button"
              className="btn-primary"
              onClick={onRematch}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.75rem' }}
            >
              <RefreshCw size={16} />
              <span>{config.copy.rematchButtonText}</span>
            </button>
          )}
          {onClose && (
            <button
              type="button"
              className="action-btn"
              style={{ flex: 1, padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
              onClick={onClose}
            >
              <Eye size={16} />
              <span>{config.copy.reviewButtonText}</span>
            </button>
          )}
          <button
            type="button"
            className="action-btn"
            style={{ flex: 1, padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
            onClick={onHome}
          >
            <Home size={16} />
            <span>{config.copy.lobbyButtonText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
