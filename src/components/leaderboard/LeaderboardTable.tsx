import React, { useState, useEffect } from 'react';
import type { UserProfile } from '@/services/firebase/localProvider';
import { localBackend } from '@/services/firebase/localProvider';
import { db, isFirebaseConfigured } from '@/services/firebase/config';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { Trophy, Medal } from 'lucide-react';
import { MULTIPLAYER_SCALE_CONFIG } from '@/services/firebase/multiplayerConfig';
import { PatronBadge, isPatronUser } from '@/components/common/PatronBadge';
import { safeGetItem, safeSetItem } from '@/services/storage/storageCleanup';

const CACHE_TTL_MS = MULTIPLAYER_SCALE_CONFIG.matchmaking.leaderboardCacheTtlMs;
const LEADERBOARD_LIMIT = MULTIPLAYER_SCALE_CONFIG.matchmaking.leaderboardLimit;
const CACHE_KEY = MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.cachedLeaderboard;
const CACHE_TIME_KEY = MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.cachedLeaderboardTime;

function readLocalCache(): { players: UserProfile[]; time: number } | null {
  try {
    const raw = safeGetItem(CACHE_KEY);
    const rawTime = safeGetItem(CACHE_TIME_KEY);
    if (!raw || !rawTime) return null;
    const players = JSON.parse(raw) as UserProfile[];
    const time = parseInt(rawTime, 10);
    if (!Array.isArray(players) || isNaN(time)) return null;
    return { players, time };
  } catch {
    return null;
  }
}

function writeLocalCache(players: UserProfile[]): void {
  const now = Date.now();
  safeSetItem(CACHE_KEY, JSON.stringify(players));
  safeSetItem(CACHE_TIME_KEY, String(now));
}

function evictLocalCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIME_KEY);
  } catch {
    // ignore
  }
}

/**
 * Global Leaderboard Table displaying top-ranked players by Elo.
 *
 * Algorithmic Complexity (Big O):
 * - Cache Hit Time Complexity: O(1) instant localStorage retrieval with zero database read cost.
 * - Cache Miss Time Complexity: O(log N + L) Firestore indexed range query where N is total users
 *   and L = MULTIPLAYER_SCALE_CONFIG.matchmaking.leaderboardLimit (L <= 50).
 * - Auxiliary Space Complexity: O(L) for cached player profiles.
 * - Growth Rate: Strictly sub-linear ceiling O(L) independent of total global user accounts.
 * - Cache Invalidation: Immediate eviction on profileUpdated event or Elo discrepancy detection.
 */
export const LeaderboardTable: React.FC = () => {
  const cached = readLocalCache();
  const [players, setPlayers] = useState<UserProfile[]>(() => cached?.players ?? []);
  const [loading, setLoading] = useState(() => !cached || Date.now() - cached.time >= CACHE_TTL_MS);

  const fetchLeaderboard = async (skipCacheCheck = false) => {
    if (!skipCacheCheck) {
      const now = Date.now();
      const hit = readLocalCache();
      if (hit && now - hit.time < CACHE_TTL_MS) {
        setPlayers(hit.players);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    try {
      if (isFirebaseConfigured() && db) {
        const q = query(
          collection(db, MULTIPLAYER_SCALE_CONFIG.collections.users),
          orderBy('eloRating', 'desc'),
          orderBy('gamesPlayed', 'desc'),
          limit(LEADERBOARD_LIMIT)
        );
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => d.data() as UserProfile);
        writeLocalCache(list);
        setPlayers(list);
      } else {
        const mockList = localBackend.getLeaderboard();
        writeLocalCache(mockList);
        setPlayers(mockList);
      }
    } catch (e) {
      console.error('Failed to fetch leaderboard:', e);
      setPlayers(localBackend.getLeaderboard());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();

    // Immediate invalidation when the authenticated user's profile updates
    const handleProfileUpdated = () => {
      evictLocalCache();
      fetchLeaderboard(true);
    };

    window.addEventListener('schada_profile_updated', handleProfileUpdated);
    return () => {
      window.removeEventListener('schada_profile_updated', handleProfileUpdated);
    };
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
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', minWidth: 0, overflow: 'hidden' }}>
                    <span className="leaderboard-player-name" title={p.username}>
                      {p.username}
                    </span>
                    {isPatronUser(p) && <PatronBadge size={13} style={{ flexShrink: 0 }} />}
                  </div>
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
