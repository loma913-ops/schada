import React, { useState } from 'react';
import { X, Play, Copy, Check } from 'lucide-react';
import type { PieceColor } from '@/core/schada/types';

interface CustomGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateGame: (minutes: number, increment: number, isRanked: boolean, colorPref?: PieceColor) => void;
}

export const CustomGameModal: React.FC<CustomGameModalProps> = ({
  isOpen,
  onClose,
  onCreateGame,
}) => {
  const [minutes, setMinutes] = useState(5);
  const [increment, setIncrement] = useState(0);
  const [isRanked, setIsRanked] = useState(true);
  const [colorPref, setColorPref] = useState<'random' | 'blue' | 'green'>('random');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setGeneratedCode(code);
  };

  const handleCopyLink = () => {
    if (generatedCode) {
      navigator.clipboard.writeText(`${window.location.origin}/?room=${generatedCode}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStart = () => {
    const chosenColor = colorPref === 'random' ? undefined : colorPref;
    onCreateGame(minutes, minutes === 0 ? 0 : increment, isRanked, chosenColor);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Create Match</h2>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Time Control Selector */}
        <div className="form-group">
          <label className="form-label">Time Control (Minutes per player)</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.4rem' }}>
            {[1, 3, 5, 10, 0].map((m) => (
              <button
                key={m}
                type="button"
                className={`action-btn ${minutes === m ? 'active' : ''}`}
                style={{
                  backgroundColor: minutes === m ? 'var(--accent-gold)' : 'var(--bg-tertiary)',
                  color: minutes === m ? '#1a1a1a' : 'var(--text-primary)',
                  fontWeight: 700,
                  padding: '0.5rem',
                }}
                onClick={() => setMinutes(m)}
              >
                {m === 0 ? 'Unlimited' : `${m} min`}
              </button>
            ))}
          </div>
        </div>

        {/* Increment per move */}
        {minutes > 0 && (
          <div className="form-group">
            <label className="form-label">Increment per move</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.4rem' }}>
              {[0, 1, 2, 3, 5].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  className={`action-btn ${increment === sec ? 'active' : ''}`}
                  style={{
                    backgroundColor: increment === sec ? 'var(--accent-gold)' : 'var(--bg-tertiary)',
                    color: increment === sec ? '#1a1a1a' : 'var(--text-primary)',
                    fontWeight: 700,
                    padding: '0.5rem',
                  }}
                  onClick={() => setIncrement(sec)}
                >
                  {sec === 0 ? 'None' : `+${sec}s`}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Match Type (Ranked vs Casual) */}
        <div className="form-group">
          <label className="form-label">Match Grading</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className={`action-btn ${isRanked ? 'active' : ''}`}
              style={{
                flex: 1,
                backgroundColor: isRanked ? 'var(--accent-gold)' : 'var(--bg-tertiary)',
                color: isRanked ? '#1a1a1a' : 'var(--text-primary)',
                fontWeight: 700,
              }}
              onClick={() => setIsRanked(true)}
            >
              Ranked (Elo)
            </button>
            <button
              type="button"
              className={`action-btn ${!isRanked ? 'active' : ''}`}
              style={{
                flex: 1,
                backgroundColor: !isRanked ? 'var(--accent-gold)' : 'var(--bg-tertiary)',
                color: !isRanked ? '#1a1a1a' : 'var(--text-primary)',
                fontWeight: 700,
              }}
              onClick={() => setIsRanked(false)}
            >
              Casual / Friendly
            </button>
          </div>
        </div>

        {/* Color Choice */}
        <div className="form-group">
          <label className="form-label">Preferred Army Color</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className={`action-btn ${colorPref === 'random' ? 'active' : ''}`}
              style={{
                flex: 1,
                backgroundColor: colorPref === 'random' ? 'var(--accent-gold)' : 'var(--bg-tertiary)',
                color: colorPref === 'random' ? '#1a1a1a' : 'var(--text-primary)',
                fontWeight: 700,
              }}
              onClick={() => setColorPref('random')}
            >
              Random
            </button>
            <button
              type="button"
              className={`action-btn ${colorPref === 'blue' ? 'active' : ''}`}
              style={{
                flex: 1,
                backgroundColor: colorPref === 'blue' ? 'var(--accent-gold)' : 'var(--bg-tertiary)',
                color: colorPref === 'blue' ? '#1a1a1a' : 'var(--piece-blue)',
                fontWeight: 700,
              }}
              onClick={() => setColorPref('blue')}
            >
              Blue
            </button>
            <button
              type="button"
              className={`action-btn ${colorPref === 'green' ? 'active' : ''}`}
              style={{
                flex: 1,
                backgroundColor: colorPref === 'green' ? 'var(--accent-gold)' : 'var(--bg-tertiary)',
                color: colorPref === 'green' ? '#1a1a1a' : 'var(--piece-green)',
                fontWeight: 700,
              }}
              onClick={() => setColorPref('green')}
            >
              Green
            </button>
          </div>
        </div>

        {/* Room Code / Invite Link Generator */}
        <div style={{ marginBottom: '1.25rem' }}>
          {!generatedCode ? (
            <button
              type="button"
              className="action-btn"
              style={{ width: '100%', padding: '0.5rem' }}
              onClick={handleGenerate}
            >
              Generate Shareable Room Code
            </button>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.5rem 0.8rem',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Room Code: </span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-gold)' }}>
                  {generatedCode}
                </strong>
              </div>
              <button
                type="button"
                className="action-btn"
                style={{ padding: '0.25rem 0.6rem' }}
                onClick={handleCopyLink}
              >
                {copied ? <Check size={14} color="var(--accent-green)" /> : <Copy size={14} />}
                <span>{copied ? 'Copied' : 'Copy Link'}</span>
              </button>
            </div>
          )}
        </div>

        <button className="btn-primary" onClick={handleStart} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
          <Play size={16} />
          <span>Launch Match</span>
        </button>
      </div>
    </div>
  );
};
