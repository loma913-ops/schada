import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Clock, RefreshCw, Play } from 'lucide-react';
import { getOpenRooms, type GameRoom } from '@/services/firebase/gameService';

export const OpenRoomsList: React.FC = () => {
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const loadRooms = async () => {
    setLoading(true);
    try {
      const open = await getOpenRooms();
      setRooms(open);
    } catch (err) {
      console.error('Failed to load open rooms:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
    const interval = setInterval(loadRooms, 5000);
    return () => clearInterval(interval);
  }, []);

  if (rooms.length === 0 && !loading) {
    return null;
  }

  return (
    <div
      style={{
        marginTop: '1.5rem',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '1.25rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Users size={18} color="var(--accent-blue)" />
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>Open Game Rooms</h3>
          <span
            style={{
              fontSize: '0.75rem',
              background: 'rgba(56, 189, 248, 0.15)',
              color: 'var(--accent-blue)',
              padding: '0.15rem 0.5rem',
              borderRadius: '999px',
              fontWeight: 600,
            }}
          >
            {rooms.length} available
          </span>
        </div>
        <button
          type="button"
          onClick={loadRooms}
          className="icon-btn"
          title="Refresh rooms"
          style={{ padding: '0.4rem' }}
        >
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {rooms.map((room) => {
          const host = room.bluePlayer || room.greenPlayer;
          const hostName = host ? host.username : 'Unknown Host';
          const hostElo = host ? host.elo : 1200;

          return (
            <div
              key={room.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-green))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    color: '#fff',
                  }}
                >
                  {hostName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                    {hostName}{' '}
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>({hostElo})</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Clock size={12} />
                    {room.timeControlMinutes > 0 ? `${room.timeControlMinutes}+${room.incrementSeconds}` : 'Unlimited'} •{' '}
                    <span>{room.isRanked ? 'Ranked' : 'Casual'}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate(`/game/${room.id}`)}
                style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Play size={14} fill="currentColor" />
                Join
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
