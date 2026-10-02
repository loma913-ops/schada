import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { X, LogOut, Edit2, CheckCircle2, AlertTriangle, Sliders, AlertCircle } from 'lucide-react';
import { PatronBadge, isPatronUser } from '@/components/common/PatronBadge';
import { SchadaStar } from '@/components/common/SchadaStar';
import { getPatronStatusDescription } from '@/core/donate/patronService';
import { useGamePreferences } from '@/context/GamePreferencesContext';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, updateUsername, logout } = useAuth();
  const { showThreatIndicators, setShowThreatIndicators } = useGamePreferences();
  const [newUsername, setNewUsername] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen || !user) return null;

  const winRate =
    user.gamesPlayed > 0 ? Math.round((user.gamesWon / user.gamesPlayed) * 100) : 0;

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      await updateUsername(newUsername);
      setSuccess(`Username successfully changed to "${newUsername}".`);
      setIsEditing(false);
      setNewUsername('');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to update username.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ width: 'min(92vw, 520px)' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Player Profile</h2>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* User Card */}
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.25rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
              <div
                className="player-avatar blue"
                style={{ width: '48px', height: '48px', fontSize: '1.25rem', flexShrink: 0 }}
              >
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.35rem', maxWidth: '100%' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.username}</span>
                  {isPatronUser(user) && <PatronBadge size={16} />}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.email}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  Rating: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-gold)' }}>{user.eloRating}</span>
                </div>
              </div>
            </div>
            <div style={{ flexShrink: 0, alignSelf: 'flex-start' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor:
                    user.status === 'online'
                      ? 'rgba(98, 153, 36, 0.15)'
                      : user.status === 'in-game'
                      ? 'var(--accent-gold-subtle)'
                      : 'rgba(117, 114, 109, 0.15)',
                  color:
                    user.status === 'online'
                      ? 'var(--accent-green)'
                      : user.status === 'in-game'
                      ? 'var(--accent-gold)'
                      : 'var(--text-muted)',
                  border: `1px solid ${
                    user.status === 'online'
                      ? 'rgba(98, 153, 36, 0.3)'
                      : user.status === 'in-game'
                      ? 'var(--accent-gold-border)'
                      : 'rgba(117, 114, 109, 0.3)'
                  }`,
                  whiteSpace: 'nowrap',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: 'currentColor',
                  }}
                />
                {user.status === 'online' ? 'Online' : user.status === 'in-game' ? 'In Game' : 'Offline'}
              </span>
            </div>
          </div>

          {isPatronUser(user) && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                marginTop: '0.75rem',
                paddingTop: '0.65rem',
                borderTop: '1px solid var(--border-subtle)',
                fontSize: '0.78rem',
                color: 'var(--accent-gold)',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              <SchadaStar size={13} />
              <span>{getPatronStatusDescription(user)}</span>
            </div>
          )}
        </div>

        {/* Statistics Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '0.5rem',
            textAlign: 'center',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ background: 'var(--bg-tertiary)', padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{user.gamesPlayed}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>PLAYED</div>
          </div>
          <div style={{ background: 'var(--bg-tertiary)', padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-green)' }}>
              {user.gamesWon}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>WON</div>
          </div>
          <div style={{ background: 'var(--bg-tertiary)', padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-red)' }}>
              {user.gamesLost}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>LOST</div>
          </div>
          <div style={{ background: 'var(--bg-tertiary)', padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-blue)' }}>
              {winRate}%
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>WIN %</div>
          </div>
        </div>

        {/* Game Controls / Board Preferences Section */}
        <div
          style={{
            padding: '1rem',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '1rem',
            backgroundColor: 'var(--bg-tertiary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Sliders size={16} color="var(--accent-gold)" />
              <span>Game Controls</span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Preferences</span>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              cursor: 'pointer',
              userSelect: 'none',
              padding: '0.35rem 0',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.9rem', fontWeight: 600 }}>
                <AlertCircle size={15} color="var(--accent-red)" />
                <span>Show Pieces Under Attack</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Display red exclamation badges on threatened pieces vulnerable to capture
              </div>
            </div>

            <input
              type="checkbox"
              role="switch"
              aria-label="Show Pieces Under Attack"
              checked={showThreatIndicators}
              onChange={(e) => setShowThreatIndicators(e.target.checked)}
              style={{
                width: '18px',
                height: '18px',
                accentColor: 'var(--accent-gold)',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            />
          </label>
        </div>

        {/* Username Change Management Section */}
        <div
          style={{
            padding: '1rem',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '1.5rem',
            backgroundColor: 'var(--bg-tertiary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Username Settings</div>
            {user.usernameChangeCount === 0 ? (
              <span style={{ fontSize: '0.75rem', color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <CheckCircle2 size={13} /> 1 change remaining
              </span>
            ) : (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <AlertTriangle size={13} /> Change limit reached
              </span>
            )}
          </div>

          {error && (
            <div style={{ color: 'var(--accent-red)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ color: 'var(--accent-green)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
              {success}
            </div>
          )}

          {user.usernameChangeCount === 0 ? (
            !isEditing ? (
              <button
                className="action-btn"
                style={{ width: '100%', marginTop: '0.25rem' }}
                onClick={() => setIsEditing(true)}
              >
                <Edit2 size={15} />
                <span>Change Username (Allowed Once)</span>
              </button>
            ) : (
              <form onSubmit={handleUpdateUsername} style={{ marginTop: '0.5rem' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter new username"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  required
                  minLength={3}
                  maxLength={20}
                  style={{ marginBottom: '0.5rem' }}
                />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="submit" className="btn-primary" disabled={loading} style={{ padding: '0.5rem' }}>
                    {loading ? 'Saving...' : 'Confirm Change'}
                  </button>
                  <button
                    type="button"
                    className="action-btn"
                    onClick={() => {
                      setIsEditing(false);
                      setError(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )
          ) : (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Per Schada rules, your username has already been changed once and is now permanently locked to <strong>{user.username}</strong>
              {isPatronUser(user) && (
                <PatronBadge size={12} style={{ marginLeft: '0.25rem', verticalAlign: 'middle' }} />
              )}.
            </p>
          )}
        </div>

        {/* Sign Out Button */}
        <button
          className="action-btn danger"
          style={{ width: '100%', padding: '0.65rem' }}
          onClick={handleLogout}
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};
