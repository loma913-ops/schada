import React, { useState, useEffect } from 'react';
import type { UserProfile } from '@/services/firebase/mockProvider';
import { mockBackend } from '@/services/firebase/mockProvider';
import { db, isFirebaseConfigured } from '@/services/firebase/config';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { Trophy, Medal } from 'lucide-react';
import { MULTIPLAYER_SCALE_CONFIG } from '@/services/firebase/multiplayerConfig';

const LEADERBOARD_CACHE_TTL_MS = MULTIPLAYER_SCALE_CONFIG.matchmaking.leaderboardCacheTtlMs;
const LEADERBOARD_LIMIT = MULTIPLAYER_SCALE_CONFIG.matchmaking.leaderboardLimit;
let cachedLeaderboard: UserProfile[] | null = null;
let cachedLeaderboardTime = 0;

/**
 * Global Leaderboard Table displaying top-ranked players by Elo.
 *
 * Algorithmic Complexity (Big O):
 * - Cache Hit Time Complexity: O(1) instant in-memory retrieval with zero database read cost.
 * - Cache Miss Time Complexity: O(log N + L) Firestore indexed range query where N is total users
 *   and L = MULTIPLAYER_SCALE_CONFIG.matchmaking.leaderboardLimit (L <= 50).
 * - Auxiliary Space Complexity: O(L) for cached player profiles.
 * - Growth Rate: Strictly sub-linear ceiling O(L) independent of total global user accounts.
 */
export const LeaderboardTable: React.FC = () => {
  const [players, setPlayers] = useState<UserProfile[]>(() => cachedLeaderboard || []);
  const [loading, setLoading] = useState(() => !cachedLeaderboard || Date.now() - cachedLeaderboardTime >= LEADERBOARD_CACHE_TTL_MS);

  useEffect(() => {
    const now = Date.now();
    if (cachedLeaderboard && now - cachedLeaderboardTime < LEADERBOARD_CACHE_TTL_MS) {
      setPlayers(cachedLeaderboard);
      setLoading(false);
      return;
    }

    async function fetchLeaderboard() {
      setLoading(true);
      try {
        if (isFirebaseConfigured() && db) {
          const q = query(
            collection(db, MULTIPLAYER_SCALE_CONFIG.collections.users),
            orderBy('eloRating', 'desc'),
            limit(LEADERBOARD_LIMIT)
          );
          const snap = await getDocs(q);
          const list = snap.docs.map((d) => d.data() as UserProfile);
          cachedLeaderboard = list;
          cachedLeaderboardTime = Date.now();
          setPlayers(list);
        } else {
          const mockList = mockBackend.getLeaderboard();
          cachedLeaderboard = mockList;
          cachedLeaderboardTime = Date.now();
          setPlayers(mockList);
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
    <div className="leaderboard-container">
      <div className="leaderboard-header">
        <Trophy size={38} color="var(--accent-gold)" className="leaderboard-trophy-icon" />
        <h1 className="leaderboard-title">Global Leaderboard</h1>
        <p className="leaderboard-subtitle">
          Top rated Schada players ranked by Elo
        </p>
      </div>

      <div className="leaderboard-card">
        <div className="leaderboard-grid leaderboard-head">
          <span className="leaderboard-col-rank">Rank</span>
          <span className="leaderboard-col-player">Player</span>
          <span className="leaderboard-col-rating">Rating</span>
        </div>

        {loading ? (
          <div className="leaderboard-loading-state">
            Loading leaderboard...
          </div>
        ) : players.length === 0 ? (
          <div className="leaderboard-empty-state">
            No players ranked yet. Play a rated match to appear on the leaderboard!
          </div>
        ) : (
          players.map((p, idx) => {
            const isTop3 = idx < 3;
            const medalColor =
              idx === 0 ? 'var(--accent-gold)' : idx === 1 ? '#94a3b8' : '#cd7f32';

            return (
              <div key={p.id} className="leaderboard-grid leaderboard-row">
                {/* Rank */}
                <div className="leaderboard-col-rank">
                  <span className="leaderboard-rank-badge">
                    {isTop3 ? (
                      <Medal size={18} color={medalColor} />
                    ) : (
                      <span className="leaderboard-rank-number">
                        {idx + 1}
                      </span>
                    )}
                  </span>
                </div>

                {/* Player info */}
                <div className="leaderboard-col-player">
                  <div className="leaderboard-player-avatar player-avatar blue">
                    {p.username.charAt(0).toUpperCase()}
                  </div>
                  <span className="leaderboard-player-name" title={p.username}>
                    {p.username}
                  </span>
                </div>

                {/* Rating */}
                <div className="leaderboard-col-rating">
                  {p.eloRating}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

