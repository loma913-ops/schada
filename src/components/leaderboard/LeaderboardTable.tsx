import React, { useState, useEffect } from 'react';
import type { UserProfile } from '@/services/firebase/mockProvider';
import { mockBackend } from '@/services/firebase/mockProvider';
import { db, isFirebaseConfigured } from '@/services/firebase/config';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { Trophy, Medal } from 'lucide-react';

export const LeaderboardTable: React.FC = () => {
  const [players, setPlayers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true);
      try {
        if (isFirebaseConfigured() && db) {
          const q = query(
            collection(db, 'users'),
            orderBy('eloRating', 'desc'),
            limit(50)
          );
          const snap = await getDocs(q);
          const list = snap.docs.map((d) => d.data() as UserProfile);
          setPlayers(list);
        } else {
          setPlayers(mockBackend.getLeaderboard());
        }
      } catch (e) {
        console.error('Failed to fetch leaderboard:', e);
        setPlayers(mockBackend.getLeaderboard());
      } finally {
        setLoading(false);
      }
    }
    fetchLeaderboard();
  }, []);

  return (
    <div style={{ maxWidth: '800px', margin: '2rem auto', padding: '0 1rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <Trophy size={40} color="var(--accent-gold)" style={{ margin: '0 auto 0.5rem' }} />
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Global Leaderboard</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Top rated Schada players ranked by Elo
        </p>
      </div>

      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '60px 2fr 100px 100px 90px',
            padding: '0.8rem 1.25rem',
            backgroundColor: 'var(--bg-tertiary)',
            borderBottom: '1px solid var(--border-subtle)',
            fontSize: '0.8rem',
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          <span>Rank</span>
          <span>Player</span>
          <span style={{ textAlign: 'right' }}>Rating</span>
          <span style={{ textAlign: 'right' }}>Played</span>
          <span style={{ textAlign: 'right' }}>Win %</span>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading leaderboard...
          </div>
        ) : (
          players.map((p, idx) => {
            const winRate =
              p.gamesPlayed > 0 ? Math.round((p.gamesWon / p.gamesPlayed) * 100) : 0;
            const isTop3 = idx < 3;
            const medalColor =
              idx === 0 ? 'var(--accent-gold)' : idx === 1 ? '#c0c0c0' : '#cd7f32';

            return (
              <div
                key={p.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '60px 2fr 100px 100px 90px',
                  padding: '0.85rem 1.25rem',
                  borderBottom: '1px solid var(--border-subtle)',
                  alignItems: 'center',
                  backgroundColor:
                    idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)',
                }}
              >
                {/* Rank */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  {isTop3 ? (
                    <Medal size={18} color={medalColor} />
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600, marginLeft: '0.25rem' }}>
                      {idx + 1}
                    </span>
                  )}
                </div>

                {/* Player info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    className="player-avatar blue"
                    style={{ width: '28px', height: '28px', fontSize: '0.8rem' }}
                  >
                    {p.username.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{p.username}</span>
                </div>

                {/* Elo */}
                <span
                  style={{
                    textAlign: 'right',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    color: 'var(--accent-gold)',
                  }}
                >
                  {p.eloRating}
                </span>

                {/* Games */}
                <span style={{ textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  {p.gamesPlayed}
                </span>

                {/* Win rate */}
                <span
                  style={{
                    textAlign: 'right',
                    color: winRate >= 50 ? 'var(--accent-green)' : 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                  }}
                >
                  {winRate}%
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
