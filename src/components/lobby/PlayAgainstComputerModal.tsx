import React, { useState } from 'react';
import { X, Cpu } from 'lucide-react';
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
}

export const PlayAgainstComputerModal: React.FC<PlayAgainstComputerModalProps> = ({
  isOpen,
  onClose,
  onStartGame,
}) => {
  const [timeMode, setTimeMode] = useState<'realtime' | 'unlimited'>('unlimited');
  const [minutes, setMinutes] = useState(5);
  const [increment, setIncrement] = useState(3);
  const [strength, setStrength] = useState<number>(1);
  const [sidePref, setSidePref] = useState<'blue' | 'random' | 'green'>('random');

  if (!isOpen) return null;

  const handlePlay = () => {
    // Resolve random side
    const resolvedColor: PieceColor =
      sidePref === 'random'
        ? Math.random() < 0.5
          ? 'blue'
          : 'green'
        : sidePref;

    onStartGame({
      timeControlMinutes: timeMode === 'unlimited' ? 0 : minutes,
      incrementSeconds: timeMode === 'unlimited' ? 0 : increment,
      difficultyLevel: strength,
      userColor: resolvedColor,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content lichess-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '440px', padding: '1.5rem', borderRadius: '8px' }}
      >
        {/* Modal Close Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-0.5rem' }}>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Top Tabs: Real time vs Unlimited */}
        <div className="lichess-tabs-nav">
          <button
            type="button"
            className={`lichess-tab-btn ${timeMode === 'realtime' ? 'active' : ''}`}
            onClick={() => setTimeMode('realtime')}
          >
            Real time
          </button>
          <button
            type="button"
            className={`lichess-tab-btn ${timeMode === 'unlimited' ? 'active' : ''}`}
            onClick={() => setTimeMode('unlimited')}
          >
            Unlimited
          </button>
        </div>

        {/* Time Settings Content */}
        <div style={{ minHeight: '68px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {timeMode === 'unlimited' ? (
            <p className="lichess-unlimited-text">Take all the time you need</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Minutes per side:</span>
                  <span style={{ fontWeight: 700 }}>{minutes} min</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="60"
                  step="1"
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-green, #629924)' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Increment in seconds:</span>
                  <span style={{ fontWeight: 700 }}>+{increment}s</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="1"
                  value={increment}
                  onChange={(e) => setIncrement(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-green, #629924)' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Strength Section */}
        <div style={{ marginTop: '1.25rem' }}>
          <div className="lichess-field-label">Strength</div>
          <div className="lichess-segmented-strength">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((lvl) => (
              <button
                key={lvl}
                type="button"
                className={`lichess-strength-btn ${strength === lvl ? 'active' : ''}`}
                onClick={() => setStrength(lvl)}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        {/* Side Section */}
        <div style={{ marginTop: '1.25rem' }}>
          <div className="lichess-field-label">Side</div>
          <div className="lichess-segmented-side">
            {/* Blue Side */}
            <button
              type="button"
              className={`lichess-side-btn ${sidePref === 'blue' ? 'active' : ''}`}
              onClick={() => setSidePref('blue')}
            >
              <svg width="28" height="28" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="38" fill="#2563eb" stroke="#ffffff" strokeWidth="4" />
                <circle cx="50" cy="50" r="14" fill="#ffffff" />
              </svg>
              <span>Blue</span>
            </button>

            {/* Random Side */}
            <button
              type="button"
              className={`lichess-side-btn ${sidePref === 'random' ? 'active' : ''}`}
              onClick={() => setSidePref('random')}
            >
              <svg width="28" height="28" viewBox="0 0 100 100">
                <defs>
                  <clipPath id="split-clip">
                    <rect x="0" y="0" width="50" height="100" />
                  </clipPath>
                </defs>
                <circle cx="50" cy="50" r="38" fill="#16a34a" stroke="#ffffff" strokeWidth="4" />
                <circle cx="50" cy="50" r="38" fill="#2563eb" clipPath="url(#split-clip)" />
                <circle cx="50" cy="50" r="14" fill="#ffffff" />
              </svg>
              <span>Random side</span>
            </button>

            {/* Green Side */}
            <button
              type="button"
              className={`lichess-side-btn ${sidePref === 'green' ? 'active' : ''}`}
              onClick={() => setSidePref('green')}
            >
              <svg width="28" height="28" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="38" fill="#16a34a" stroke="#ffffff" strokeWidth="4" />
                <circle cx="50" cy="50" r="14" fill="#ffffff" />
              </svg>
              <span>Green</span>
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <div style={{ marginTop: '1.75rem' }}>
          <button
            type="button"
            className="lichess-cta-btn"
            onClick={handlePlay}
          >
            <Cpu size={22} className="lichess-cta-icon" />
            <span>Play against computer</span>
          </button>
        </div>
      </div>
    </div>
  );
};
