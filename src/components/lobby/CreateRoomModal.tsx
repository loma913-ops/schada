import React, { useState } from 'react';
import { X, Copy, Check, Users, Globe, Lock, Share2 } from 'lucide-react';
import type { PieceColor } from '@/core/schada/types';
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
  const [colorPref, setColorPref] = useState<PieceColor | 'random'>('random');
  const [isPrivate, setIsPrivate] = useState<boolean>(true);
  const [isRanked, setIsRanked] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);

  // Once created, display share screen
  const [createdGameId, setCreatedGameId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

      setCreatedGameId(result.gameId);
    } catch (err) {
      console.error('Failed to create room:', err);
      alert('Failed to create room. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const shareableUrl = createdGameId
    ? `${window.location.origin}/game/${createdGameId}`
    : '';

  const handleCopyLink = () => {
    if (!shareableUrl) return;
    navigator.clipboard.writeText(shareableUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleEnterRoom = () => {
    if (!createdGameId) return;
    onClose();
    navigate(`/game/${createdGameId}`);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '520px', width: '92%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Share2 size={20} color="var(--accent-gold)" />
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
              {createdGameId ? 'Game Room Created' : 'Create Multiplayer Game'}
            </h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {createdGameId ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1rem 0' }}>
            <div
              style={{
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '8px',
                padding: '1.25rem',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                Share this link with your opponent to play:
              </div>
              <div
                style={{
                  background: 'var(--bg-card)',
                  padding: '0.75rem 1rem',
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  fontSize: '0.95rem',
                  wordBreak: 'break-all',
                  userSelect: 'all',
                  border: '1px solid var(--border-color)',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                }}
              >
                <span>{shareableUrl}</span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="btn btn-secondary"
                  style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  {copied ? <Check size={16} color="var(--accent-green)" /> : <Copy size={16} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {isPrivate
                  ? '🔒 Private room: Only people with this link can join.'
                  : '🌐 Open room: Visible in the public lobby as well.'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleEnterRoom}
                style={{ width: '100%', padding: '0.8rem' }}
              >
                Enter Waiting Room
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0' }}>
            {/* Room Visibility */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                Room Visibility
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsPrivate(true)}
                  className={`btn ${isPrivate ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.6rem' }}
                >
                  <Lock size={16} /> Private Invite
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrivate(false)}
                  className={`btn ${!isPrivate ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.6rem' }}
                >
                  <Globe size={16} /> Open Lobby
                </button>
              </div>
            </div>

            {/* Time Control */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                Time Control (Minutes)
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[1, 3, 5, 10, 0].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setTimeControl(mins)}
                    className={`btn ${timeControl === mins ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: '0.55rem' }}
                  >
                    {mins === 0 ? '∞' : `${mins}m`}
                  </button>
                ))}
              </div>
            </div>

            {/* Increment */}
            {timeControl > 0 && (
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  Fischer Increment
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {[0, 1, 2, 5].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setIncrement(sec)}
                      className={`btn ${increment === sec ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1, padding: '0.55rem' }}
                    >
                      {sec === 0 ? 'None' : `+${sec}s`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Color Preference */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                Your Side
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setColorPref('blue')}
                  className={`btn ${colorPref === 'blue' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '0.6rem' }}
                >
                  🔵 Blue
                </button>
                <button
                  type="button"
                  onClick={() => setColorPref('random')}
                  className={`btn ${colorPref === 'random' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '0.6rem' }}
                >
                  🎲 Random
                </button>
                <button
                  type="button"
                  onClick={() => setColorPref('green')}
                  className={`btn ${colorPref === 'green' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '0.6rem' }}
                >
                  🟢 Green
                </button>
              </div>
            </div>

            {/* Rated toggle if logged in */}
            {user && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                <label htmlFor="ranked-checkbox" style={{ fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}>
                  Ranked Match (Elo rating changes)
                </label>
                <input
                  id="ranked-checkbox"
                  type="checkbox"
                  checked={isRanked}
                  onChange={(e) => setIsRanked(e.target.checked)}
                  style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                />
              </div>
            )}

            {/* Create Button */}
            <div style={{ marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={loading}
                style={{ width: '100%', padding: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                <Users size={18} />
                {loading ? 'Creating Room...' : 'Create Room & Get Link'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
