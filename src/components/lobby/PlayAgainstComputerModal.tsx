import React, { useState } from 'react';
import { X, Play } from 'lucide-react';
import type { PieceColor } from '@/core/schada/types';

interface PlayAgainstComputerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartGame: (params: {
    timeControlMinutes: number; // 0 for unlimited
    incrementSeconds: number;
    difficultyLevel: number;
    userColor: PieceColor;
  }) => void;
  initialTimeControlMinutes?: number;
  initialIncrementSeconds?: number;
  initialColorPref?: 'random' | 'blue' | 'green';
}

export const PlayAgainstComputerModal: React.FC<PlayAgainstComputerModalProps> = ({
  isOpen,
  onClose,
  onStartGame,
  initialTimeControlMinutes,
  initialIncrementSeconds,
  initialColorPref,
}) => {
  const [minutes, setMinutes] = useState(initialTimeControlMinutes ?? 5);
  const [increment, setIncrement] = useState(initialIncrementSeconds ?? 0);
  const [strength, setStrength] = useState<number>(1);
  const [colorPref, setColorPref] = useState<'random' | 'blue' | 'green'>(initialColorPref ?? 'random');

  React.useEffect(() => {
    if (isOpen) {
      if (initialTimeControlMinutes !== undefined) {
        setMinutes(initialTimeControlMinutes);
      }
      if (initialIncrementSeconds !== undefined) {
        setIncrement(initialIncrementSeconds);
      }
      if (initialColorPref !== undefined) {
        setColorPref(initialColorPref);
      }
    }
  }, [isOpen, initialTimeControlMinutes, initialIncrementSeconds, initialColorPref]);

  if (!isOpen) return null;

  const handlePlay = () => {
    // Resolve random side
    const resolvedColor: PieceColor =
      colorPref === 'random'
        ? Math.random() < 0.5
          ? 'blue'
          : 'green'
        : colorPref;

    onStartGame({
      timeControlMinutes: minutes,
      incrementSeconds: minutes === 0 ? 0 : increment,
      difficultyLevel: strength,
      userColor: resolvedColor,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Play Against Computer</h2>
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
              {[0, 1, 2, 3, 5].map((sec) => (
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

        {/* Bot Strength / Difficulty Level */}
        <div className="form-group">
          <label className="form-label">Difficulty Level</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '0.4rem' }}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((lvl) => (
              <button
                key={lvl}
                type="button"
                className={`action-btn ${strength === lvl ? 'active' : ''}`}
                style={{ padding: '0.5rem 0' }}
                onClick={() => setStrength(lvl)}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        {/* Preferred Army Color */}
        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
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
          onClick={handlePlay}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
        >
          <Play size={16} />
          <span>Launch Match</span>
        </button>
      </div>
    </div>
  );
};
