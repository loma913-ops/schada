import React, { useEffect } from 'react';
import type { GameResult, PieceColor } from '@/core/schada/types';
import confetti from 'canvas-confetti';
import { soundService } from '@/services/audio/soundService';
import { haptics } from '@/services/device/haptics';
import { Trophy, Award, RefreshCw, Home } from 'lucide-react';

interface GameOverModalProps {
  result: GameResult;
  userColor?: PieceColor;
  eloDelta?: number;
  onRematch?: () => void;
  onHome: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  result,
  userColor,
  eloDelta,
  onRematch,
  onHome,
}) => {
  const isWinner = userColor && result.winner === userColor;
  const isDraw = result.winner === 'draw';

  useEffect(() => {
    haptics.gameOver();
    if (isWinner) {
      soundService.playVictory();
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [isWinner]);

  const getReasonText = () => {
    switch (result.winReason) {
      case 'goal_reached':
        return 'All remaining high pieces reached the goal line';
      case 'timeout':
        return 'Victory on time';
      case 'resignation':
        return 'Opponent resigned';
      case 'repetition':
        return 'Draw by 3-fold repetition';
      case 'blocked':
        return 'Game ended: High pieces blocked by opponent';
      case 'mutual_shuffle':
        return 'Game ended: Mutual consecutive shuffling';
      case 'agreement':
        return 'Draw agreed';
      default:
        return 'Game completed';
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: '1rem' }}>
          {isWinner ? (
            <Trophy size={48} color="var(--accent-gold)" style={{ margin: '0 auto' }} />
          ) : isDraw ? (
            <Award size={48} color="var(--accent-blue)" style={{ margin: '0 auto' }} />
          ) : (
            <div style={{ fontSize: '2.5rem' }}>⚔️</div>
          )}
        </div>

        <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.25rem' }}>
          {isWinner ? 'Victory!' : isDraw ? 'Draw Game' : result.winner ? `${result.winner.toUpperCase()} Won` : 'Game Over'}
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
              gridTemplateColumns: '2fr 1fr 1fr',
              fontWeight: 700,
              paddingBottom: '0.4rem',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <span>Category</span>
            <span style={{ color: 'var(--piece-blue)' }}>Blue</span>
            <span style={{ color: 'var(--piece-green)' }}>Green</span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr',
              padding: '0.3rem 0',
            }}
          >
            <span style={{ color: 'var(--text-secondary)' }}>Goal Line Points</span>
            <span>{result.blueScore.goalScore}</span>
            <span>{result.greenScore.goalScore}</span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr',
              padding: '0.3rem 0',
            }}
          >
            <span style={{ color: 'var(--text-secondary)' }}>Outside High Pieces</span>
            <span>{result.blueScore.outsideGoalHighPiecesScore}</span>
            <span>{result.greenScore.outsideGoalHighPiecesScore}</span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr',
              padding: '0.3rem 0',
            }}
          >
            <span style={{ color: 'var(--text-secondary)' }}>Rank Distance</span>
            <span>{result.blueScore.rankDistanceScore}</span>
            <span>{result.greenScore.rankDistanceScore}</span>
          </div>
        </div>

        {/* Elo Delta Badge */}
        {eloDelta !== undefined && (
          <div style={{ marginBottom: '1.5rem', fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginRight: '0.5rem' }}>
              Rating change:
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
            <button className="btn-primary" onClick={onRematch} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
              <RefreshCw size={16} />
              <span>Rematch</span>
            </button>
          )}
          <button
            className="action-btn"
            style={{ flex: 1, padding: '0.75rem' }}
            onClick={onHome}
          >
            <Home size={16} />
            <span>Lobby</span>
          </button>
        </div>
      </div>
    </div>
  );
};
