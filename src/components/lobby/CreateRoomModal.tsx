import React, { useState } from 'react';
import { X, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { createGame } from '@/services/firebase/gameService';
import { MULTIPLAYER_SCALE_CONFIG } from '@/services/firebase/multiplayerConfig';
import { getOrCreateGuestId } from '@/services/firebase/authService';
import { ELO_CONFIG } from '@/core/elo/eloConfig';
import { FORMAT_CONFIG } from '@/core/schada/formatConfig';
import { useNavigate } from 'react-router-dom';
import { isPatronUser } from '@/components/common/PatronBadge';
import { isGuestUser } from '@/services/firebase/gameTypes';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isGuest = isGuestUser(user);

  const [timeControl, setTimeControl] = useState<number>(FORMAT_CONFIG.defaultMatchMinutes);
  const [increment, setIncrement] = useState<number>(FORMAT_CONFIG.defaultIncrementSeconds);
  const [colorPref, setColorPref] = useState<'random' | 'blue' | 'green'>('random');
  const [isPrivate, setIsPrivate] = useState<boolean>(false);
  const [isRanked, setIsRanked] = useState<boolean>(!isGuest);
  const [loading, setLoading] = useState(false);

  const effectiveIsRanked = !isGuest && isRanked;

  if (!isOpen) return null;

  const handleCreate = async () => {
    setLoading(true);
    try {
      const guestId = getOrCreateGuestId();
      const { guestName: guestNameKey } =
        MULTIPLAYER_SCALE_CONFIG.presence.storageKeys;
      const storedGuestName = localStorage.getItem(guestNameKey);
      const guestName =
        storedGuestName && storedGuestName.trim().length > 0
          ? storedGuestName
          : MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultGuestHostName;

      const isDonor = isPatronUser(user);

      const creator = user
        ? {
            id: user.id,
            username: user.username,
            elo: user.eloRating,
            gamesPlayed: user.gamesPlayed ?? ELO_CONFIG.defaultAssumedGamesPlayed,
            isPatron: isDonor,
            hasDonated: isDonor,
            patronTier: user.patronTier,
            patronExpiresAt: user.patronExpiresAt,
            patronSubscriptionStatus: user.patronSubscriptionStatus,
          }
        : {
            id: guestId,
            username: guestName,
            elo: MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultGuestRating,
            gamesPlayed: ELO_CONFIG.defaultAssumedGamesPlayed,
            isPatron: false,
            hasDonated: false,
          };

      const result = await createGame({

        timeControlMinutes: timeControl,
        incrementSeconds: increment,
        isRanked: effectiveIsRanked,
        colorPref,
        isPrivate,
        creator,
      });

      onClose();
      navigate(`/game/${result.gameId}`);
    } catch (err: unknown) {
      console.error('Failed to create room:', err);
      const message = err instanceof Error ? err.message : String(err);
      alert(`Failed to create room: ${message}`);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Create Multiplayer Room</h2>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div>
            {/* Room Visibility */}
            <div className="form-group">
              <label className="form-label">Room Access</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className={`action-btn ${isPrivate ? 'active' : ''}`}
                  style={{ flex: 1 }}
                  onClick={() => setIsPrivate(true)}
                >
                  Private Link
                </button>
                <button
                  type="button"
                  className={`action-btn ${!isPrivate ? 'active' : ''}`}
                  style={{ flex: 1 }}
                  onClick={() => setIsPrivate(false)}
                >
                  Open in Lobby
                </button>
              </div>
            </div>

            {/* Time Control Selector */}
            <div className="form-group">
              <label className="form-label">Time Control (Minutes per player)</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.4rem' }}>
                {FORMAT_CONFIG.modalSelectableMinutes.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`action-btn ${timeControl === m ? 'active' : ''}`}
                    style={{ padding: '0.5rem' }}
                    onClick={() => setTimeControl(m)}
                  >
                    {m === 0 ? 'Unlimited' : `${m} min`}
                  </button>
                ))}
              </div>
            </div>

            {/* Increment */}
            {timeControl > 0 && (
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

            {/* Preferred Army Color */}
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

            {/* Launch / Create Button */}
            <button
              type="button"
              className="btn-primary"
              onClick={handleCreate}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                width: '100%',
                marginTop: '1.25rem',
              }}
            >
              <Users size={16} />
              <span>{loading ? 'Creating Room...' : 'Create & Generate Link'}</span>
            </button>
          </div>
      </div>
    </div>
  );
};
