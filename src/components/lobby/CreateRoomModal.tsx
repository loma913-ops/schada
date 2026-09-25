import React, { useState } from 'react';
import { X, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { createGame } from '@/services/firebase/gameService';
import { useNavigate } from 'react-router-dom';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [timeControl, setTimeControl] = useState<number>(5);
  const [increment, setIncrement] = useState<number>(0);
  const [colorPref, setColorPref] = useState<'random' | 'blue' | 'green'>('random');
  const [isPrivate, setIsPrivate] = useState<boolean>(true);
  const [isRanked, setIsRanked] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);


  if (!isOpen) return null;

  const handleCreate = async () => {
    setLoading(true);
    try {
      const creator = user
        ? { id: user.id, username: user.username, elo: user.eloRating }
        : {
          id: 'guest_' + Math.random().toString(36).substring(2, 7),
          username: localStorage.getItem('schada_guest_name') || 'Guest Host',
          elo: 1200,
        };

      const result = await createGame({
        timeControlMinutes: timeControl,
        incrementSeconds: increment,
        isRanked: isRanked && Boolean(user),
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
                  style={{
                    flex: 1,
                    backgroundColor: isPrivate ? 'var(--accent-gold)' : 'var(--bg-tertiary)',
                    color: isPrivate ? '#1a1a1a' : 'var(--text-primary)',
                    fontWeight: 700,
                  }}
                  onClick={() => setIsPrivate(true)}
                >
                  Private Link
                </button>
                <button
                  type="button"
                  className={`action-btn ${!isPrivate ? 'active' : ''}`}
                  style={{
                    flex: 1,
                    backgroundColor: !isPrivate ? 'var(--accent-gold)' : 'var(--bg-tertiary)',
                    color: !isPrivate ? '#1a1a1a' : 'var(--text-primary)',
                    fontWeight: 700,
                  }}
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
                {[1, 3, 5, 10, 0].map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`action-btn ${timeControl === m ? 'active' : ''}`}
                    style={{
                      backgroundColor: timeControl === m ? 'var(--accent-gold)' : 'var(--bg-tertiary)',
                      color: timeControl === m ? '#1a1a1a' : 'var(--text-primary)',
                      fontWeight: 700,
                      padding: '0.5rem',
                    }}
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

            {/* Preferred Army Color */}
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
