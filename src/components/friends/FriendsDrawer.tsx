import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { UserProfile, LocalFriendRequest } from '@/services/firebase/localProvider';
import {
  sendFriendRequest,
  respondToFriendRequest,
  getFriendsList,
  removeFriend,
  getPendingIncomingRequests,
} from '@/services/firebase/friendService';
import { X, UserPlus, Check, Swords, Trash2 } from 'lucide-react';
import { PatronBadge, isPatronUser } from '@/components/common/PatronBadge';

interface FriendsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onChallengeFriend?: (friend: UserProfile) => void;
}

export const FriendsDrawer: React.FC<FriendsDrawerProps> = ({
  isOpen,
  onClose,
  onChallengeFriend,
}) => {
  const { user } = useAuth();
  const [tab, setTab] = useState<'friends' | 'requests'>('friends');
  const [searchUsername, setSearchUsername] = useState('');
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [requests, setRequests] = useState<LocalFriendRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshData = async () => {
    if (!user) return;
    try {
      const fList = await getFriendsList(user.id);
      setFriends(fList);
      const reqList = await getPendingIncomingRequests(user.id);
      setRequests(reqList);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (!isOpen || !user) return;
    refreshData();

    // Live presence polling & event synchronization
    const interval = setInterval(refreshData, 3000);
    const handleStatusOrStorage = () => refreshData();

    window.addEventListener('storage', handleStatusOrStorage);
    window.addEventListener('schada_user_status_changed', handleStatusOrStorage);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStatusOrStorage);
      window.removeEventListener('schada_user_status_changed', handleStatusOrStorage);
    };
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      await sendFriendRequest(user, searchUsername);
      setSuccess(`Friend request sent to "${searchUsername}".`);
      setSearchUsername('');
      refreshData();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to send friend request.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (requestId: string, accept: boolean) => {
    try {
      await respondToFriendRequest(requestId, accept);
      refreshData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (!user) return;
    try {
      await removeFriend(user.id, friendId);
      refreshData();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer-content">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Friends</h2>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSendRequest}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search exact username..."
              value={searchUsername}
              onChange={(e) => setSearchUsername(e.target.value)}
              required
              disabled={loading || !user}
            />
            <button
              type="submit"
              className="action-btn"
              style={{
                position: 'absolute',
                right: '4px',
                top: '4px',
                bottom: '4px',
                padding: '0 0.6rem',
                backgroundColor: 'var(--accent-gold)',
                color: 'var(--accent-gold-text)',
                border: 'none',
              }}
              disabled={loading || !user}
              title="Send Friend Request"
            >
              <UserPlus size={15} />
            </button>
          </div>
          {error && (
            <div style={{ color: 'var(--accent-red)', fontSize: '0.8rem', marginTop: '0.35rem' }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ color: 'var(--accent-green)', fontSize: '0.8rem', marginTop: '0.35rem' }}>
              {success}
            </div>
          )}
        </form>

        {/* Sub-tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
          <button
            className={`action-btn ${tab === 'friends' ? 'active' : ''}`}
            style={{
              flex: 1,
              backgroundColor: tab === 'friends' ? 'var(--bg-tertiary)' : 'transparent',
              borderColor: tab === 'friends' ? 'var(--border-strong)' : 'transparent',
            }}
            onClick={() => setTab('friends')}
          >
            Friends ({friends.length})
          </button>
          <button
            className={`action-btn ${tab === 'requests' ? 'active' : ''}`}
            style={{
              flex: 1,
              backgroundColor: tab === 'requests' ? 'var(--bg-tertiary)' : 'transparent',
              borderColor: tab === 'requests' ? 'var(--border-strong)' : 'transparent',
              position: 'relative',
            }}
            onClick={() => setTab('requests')}
          >
            Requests ({requests.length})
          </button>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!user ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
              Sign in to add friends and play private matches!
            </div>
          ) : tab === 'friends' ? (
            friends.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                No friends added yet. Enter a friend's exact username above to send an invite!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {friends.map((f) => (
                  <div
                    key={f.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.65rem 0.8rem',
                      backgroundColor: 'var(--bg-tertiary)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      {/* Presence indicator dot */}
                      <span
                        style={{
                          width: '9px',
                          height: '9px',
                          borderRadius: '50%',
                          backgroundColor:
                            f.status === 'online'
                              ? 'var(--accent-green)'
                              : f.status === 'in-game'
                              ? 'var(--accent-gold)'
                              : 'var(--text-muted)',
                        }}
                        title={f.status}
                      />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span>{f.username}</span>
                          {isPatronUser(f) && <PatronBadge size={13} />}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', fontFamily: 'var(--font-mono)' }}>
                          {f.eloRating} Elo
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      {onChallengeFriend && (
                        <button
                          className="action-btn"
                          style={{ padding: '0.35rem 0.6rem', color: 'var(--accent-gold)' }}
                          onClick={() => onChallengeFriend(f)}
                          title="Challenge to Schada"
                        >
                          <Swords size={15} />
                        </button>
                      )}
                      <button
                        className="action-btn danger"
                        style={{ padding: '0.35rem 0.5rem' }}
                        onClick={() => handleRemoveFriend(f.id)}
                        title="Remove Friend"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            // Requests Tab
            requests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                No pending incoming requests.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {requests.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.65rem 0.8rem',
                      backgroundColor: 'var(--bg-tertiary)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span>{r.fromUsername}</span>
                        {isPatronUser(r) && <PatronBadge size={13} />}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Sent you a friend request
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button
                        className="action-btn"
                        style={{ padding: '0.35rem 0.6rem', backgroundColor: 'var(--accent-green)', color: 'white' }}
                        onClick={() => handleRespond(r.id, true)}
                        title="Accept"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        className="action-btn danger"
                        style={{ padding: '0.35rem 0.6rem' }}
                        onClick={() => handleRespond(r.id, false)}
                        title="Decline"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </>
  );
};
