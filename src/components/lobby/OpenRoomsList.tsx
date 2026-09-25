import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Clock, Play } from 'lucide-react';
import { subscribeToOpenRooms, type GameRoom } from '@/services/firebase/gameService';

export const OpenRoomsList: React.FC = () => {
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    // Real-time listener: updates automatically when rooms are created/joined/closed
    const unsubscribe = subscribeToOpenRooms((openRooms) => {
      setRooms(openRooms);
    });
    return () => unsubscribe();
  }, []);

  // When there are no open rooms, do not render anything.
  // This completely eliminates any periodic layout flash.
  if (rooms.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        marginTop: '1.25rem',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
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
              padding: '0.15rem 0.55rem',
              borderRadius: '999px',
              fontWeight: 700,
            }}
          >
            {rooms.length} {rooms.length === 1 ? 'room' : 'rooms'}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {rooms.map((room) => {
          const host = room.bluePlayer || room.greenPlayer;
          const hostName = host ? host.username : 'Host';
          const hostElo = host ? host.elo : 1200;

          return (
            <div
              key={room.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--piece-blue), var(--piece-green))',
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
                className="action-btn active"
                onClick={() => navigate(`/game/${room.id}`)}
                style={{
                  padding: '0.45rem 0.9rem',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  backgroundColor: 'var(--accent-gold)',
                  color: '#1a1a1a',
                  fontWeight: 700,
                }}
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
