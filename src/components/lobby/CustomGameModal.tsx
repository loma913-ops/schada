import React, { useState } from 'react';
import { X, Play } from 'lucide-react';
import type { PieceColor } from '@/core/schada/types';
import { useAuth } from '@/context/AuthContext';
import { FORMAT_CONFIG } from '@/core/schada/formatConfig';

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
  const { user } = useAuth();
  const isGuest = !user;

  const [minutes, setMinutes] = useState(FORMAT_CONFIG.defaultMatchMinutes);
  const [increment, setIncrement] = useState(FORMAT_CONFIG.defaultIncrementSeconds);

  const [isRanked, setIsRanked] = useState(!isGuest);
  const [colorPref, setColorPref] = useState<'random' | 'blue' | 'green'>('random');
  const [loading, setLoading] = useState(false);

  const effectiveIsRanked = !isGuest && isRanked;

  if (!isOpen) return null;

  const handleStart = async () => {
    setLoading(true);
    try {
      const chosenColor = colorPref === 'random' ? undefined : colorPref;
      await onCreateGame(minutes, minutes === 0 ? 0 : increment, effectiveIsRanked, chosenColor);
      onClose();
    } finally {
      setLoading(false);
    }
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
            {FORMAT_CONFIG.modalSelectableMinutes.map((m) => (
              <button
                key={m}
                type="button"
                className={`action-btn ${minutes === m ? 'active' : ''}`}
                style={{ padding: '0.5rem' }}
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
              {FORMAT_CONFIG.modalSelectableIncrements.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  className={`action-btn ${increment === sec ? 'active' : ''}`}
                  style={{ padding: '0.5rem' }}
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
              className={`action-btn ${effectiveIsRanked ? 'active' : ''}`}
              style={{
                flex: 1,
                opacity: isGuest ? 0.55 : 1,
                cursor: isGuest ? 'not-allowed' : 'pointer',
              }}
              disabled={isGuest}
              title={isGuest ? 'Sign in to play Ranked matches' : undefined}
              onClick={() => !isGuest && setIsRanked(true)}
            >
              Ranked (Elo) {isGuest && <span className="auth-required-badge">(Account required)</span>}
            </button>
            <button
              type="button"
              className={`action-btn ${!effectiveIsRanked ? 'active' : ''}`}
              style={{ flex: 1 }}
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
              style={{ flex: 1 }}
              onClick={() => setColorPref('random')}
            >
              Random
            </button>
            <button
              type="button"
              className={`action-btn ${colorPref === 'blue' ? 'active' : ''} pref-blue`}
              style={{ flex: 1 }}
              onClick={() => setColorPref('blue')}
            >
              Blue
            </button>
            <button
              type="button"
              className={`action-btn ${colorPref === 'green' ? 'active' : ''} pref-green`}
              style={{ flex: 1 }}
              onClick={() => setColorPref('green')}
            >
              Green
            </button>
          </div>
        </div>

        <button
          className="btn-primary"
          onClick={handleStart}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
            width: '100%',
            marginTop: '1.25rem',
            padding: '0.8rem 1.25rem',
            fontSize: '1rem',
            fontWeight: 600,
          }}
        >
          <Play size={16} />
          <span>{loading ? 'Creating Match...' : 'Create Match & Add to Lobby'}</span>
        </button>
      </div>
    </div>
  );
};
