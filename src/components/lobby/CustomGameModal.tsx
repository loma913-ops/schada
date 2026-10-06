import React, { useState, useEffect } from 'react';
import { X, Play, Clock, Mail } from 'lucide-react';
import type { PieceColor } from '@/core/schada/types';
import { useAuth } from '@/context/AuthContext';
import { FORMAT_CONFIG } from '@/core/schada/formatConfig';
import { MULTIPLAYER_SCALE_CONFIG } from '@/services/firebase/multiplayerConfig';
import { isGuestUser } from '@/services/firebase/gameTypes';

export type CustomGameTab = 'realtime' | 'correspondence';

interface CustomGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateGame: (minutes: number, increment: number, isRanked: boolean, colorPref?: PieceColor) => void;
  initialTab?: CustomGameTab;
}

export const CustomGameModal: React.FC<CustomGameModalProps> = ({
  isOpen,
  onClose,
  onCreateGame,
  initialTab = 'realtime',
}) => {
  const { user } = useAuth();
  const isGuest = isGuestUser(user);

  const [activeTab, setActiveTab] = useState<CustomGameTab>(initialTab);

  const defaultMinutesIndex = FORMAT_CONFIG.realTimeMinutesSequence.indexOf(FORMAT_CONFIG.defaultMatchMinutes);
  if (defaultMinutesIndex < 0) {
    throw new Error(
      `CustomGameModal: defaultMatchMinutes (${FORMAT_CONFIG.defaultMatchMinutes}) not found in realTimeMinutesSequence.`
    );
  }
  const [minutesIndex, setMinutesIndex] = useState(defaultMinutesIndex);
  const [increment, setIncrement] = useState(FORMAT_CONFIG.defaultIncrementSeconds);

  const defaultDaysIndex = FORMAT_CONFIG.correspondenceDaysSequence.indexOf(FORMAT_CONFIG.defaultCorrespondenceDays);
  if (defaultDaysIndex < 0) {
    throw new Error(
      `CustomGameModal: defaultCorrespondenceDays (${FORMAT_CONFIG.defaultCorrespondenceDays}) not found in correspondenceDaysSequence.`
    );
  }
  const [daysIndex, setDaysIndex] = useState(defaultDaysIndex);

  const [isRanked, setIsRanked] = useState(!isGuest);
  const [colorPref, setColorPref] = useState<'random' | 'blue' | 'green'>('random');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const effectiveIsRanked = !isGuest && isRanked;

  if (!isOpen) return null;

  const selectedMinutes = FORMAT_CONFIG.realTimeMinutesSequence[minutesIndex];
  if (typeof selectedMinutes !== 'number' || isNaN(selectedMinutes)) {
    throw new Error(`CustomGameModal: Invalid selected minutes at index ${minutesIndex}.`);
  }

  const selectedDays = FORMAT_CONFIG.correspondenceDaysSequence[daysIndex];
  if (typeof selectedDays !== 'number' || isNaN(selectedDays)) {
    throw new Error(`CustomGameModal: Invalid selected days at index ${daysIndex}.`);
  }

  const handleStart = async () => {
    setLoading(true);
    try {
      const chosenColor = colorPref === 'random' ? undefined : colorPref;
      if (activeTab === 'realtime') {
        await onCreateGame(selectedMinutes, increment, effectiveIsRanked, chosenColor);
      } else {
        const correspondenceMinutes = selectedDays * FORMAT_CONFIG.minutesPerDay;
        await onCreateGame(correspondenceMinutes, 0, effectiveIsRanked, chosenColor);
      }
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const formatMinutesLabel = (mins: number): string => {
    if (mins < 1) return `${mins} min (30s)`;
    if (mins >= 60) {
      const hrs = mins / 60;
      return `${mins} min (${Number.isInteger(hrs) ? hrs : hrs.toFixed(1)} hrs)`;
    }
    return `${mins} min`;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Create Match</h2>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="modal-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'realtime'}
            className={`modal-tab-btn ${activeTab === 'realtime' ? 'active' : ''}`}
            onClick={() => setActiveTab('realtime')}
          >
            <Clock size={16} />
            <span>Real Time</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'correspondence'}
            className={`modal-tab-btn ${activeTab === 'correspondence' ? 'active' : ''}`}
            onClick={() => setActiveTab('correspondence')}
          >
            <Mail size={16} />
            <span>Correspondence</span>
          </button>
        </div>

        {/* Real Time Options */}
        {activeTab === 'realtime' && (
          <>
            <div className="form-group modal-slider-wrap">
              <div className="modal-slider-header">
                <label className="form-label" htmlFor="minutes-slider" style={{ marginBottom: 0 }}>
                  Minutes per player
                </label>
                <span className="modal-slider-val">{formatMinutesLabel(selectedMinutes)}</span>
              </div>
              <input
                id="minutes-slider"
                type="range"
                className="modal-slider"
                min={0}
                max={FORMAT_CONFIG.realTimeMinutesSequence.length - 1}
                step={1}
                value={minutesIndex}
                onChange={(e) => setMinutesIndex(Number(e.target.value))}
                aria-label="Minutes per player"
              />
            </div>

            <div className="form-group modal-slider-wrap">
              <div className="modal-slider-header">
                <label className="form-label" htmlFor="increment-slider" style={{ marginBottom: 0 }}>
                  Increment in seconds
                </label>
                <span className="modal-slider-val">
                  {increment === 0 ? '0s (None)' : `+${increment}s`}
                </span>
              </div>
              <input
                id="increment-slider"
                type="range"
                className="modal-slider"
                min={0}
                max={FORMAT_CONFIG.realTimeIncrementSequence.length - 1}
                step={1}
                value={increment}
                onChange={(e) => setIncrement(Number(e.target.value))}
                aria-label="Increment in seconds"
              />
            </div>
          </>
        )}

        {/* Correspondence Options */}
        {activeTab === 'correspondence' && (
          <div className="form-group modal-slider-wrap">
            <div className="modal-slider-header">
              <label className="form-label" htmlFor="days-slider" style={{ marginBottom: 0 }}>
                Days per player
              </label>
              <span className="modal-slider-val">
                {selectedDays} {selectedDays === 1 ? 'day' : 'days'}
              </span>
            </div>
            <input
              id="days-slider"
              type="range"
              className="modal-slider"
              min={0}
              max={FORMAT_CONFIG.correspondenceDaysSequence.length - 1}
              step={1}
              value={daysIndex}
              onChange={(e) => setDaysIndex(Number(e.target.value))}
              aria-label="Days per player"
            />
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
              Ranked (Elo) {isGuest && <span className="auth-required-badge">{MULTIPLAYER_SCALE_CONFIG.matchmaking.guestRankedBadgeText}</span>}
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
