import React, { useState, useEffect, useCallback } from 'react';
import type { UserProfile } from '@/services/firebase/localProvider';
import { localBackend, getUserModeElo, isHumanLeaderboardEligible } from '@/services/firebase/localProvider';
import { db, isFirebaseConfigured } from '@/services/firebase/config';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { Trophy, Medal, RefreshCw } from 'lucide-react';
import { MULTIPLAYER_SCALE_CONFIG } from '@/services/firebase/multiplayerConfig';
import { PatronBadge, isPatronUser } from '@/components/common/PatronBadge';
import { safeGetItem, safeSetItem } from '@/services/storage/storageCleanup';
import { TIME_CONTROL_CATEGORIES, type TimeControlCategory } from '@/components/lobby/lobbyConfig';

const CACHE_TTL_MS = MULTIPLAYER_SCALE_CONFIG.matchmaking.leaderboardCacheTtlMs;
const LEADERBOARD_LIMIT = MULTIPLAYER_SCALE_CONFIG.matchmaking.leaderboardLimit;
const CACHE_KEY = MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.cachedLeaderboard;
const CACHE_TIME_KEY = MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.cachedLeaderboardTime;

const CATEGORY_TABS: { category: TimeControlCategory; label: string; icon: string }[] = [
  { category: 'bullet', label: 'Bullet', icon: '⚡' },
  { category: 'blitz', label: 'Blitz', icon: '🔥' },
  { category: 'rapid', label: 'Rapid', icon: '⏱️' },
  { category: 'classical', label: 'Classical', icon: '♟️' },
  { category: 'correspondence', label: 'Correspondence', icon: '✉️' },
];

function readLocalCache(category: TimeControlCategory): { players: UserProfile[]; time: number } | null {
  try {
    const raw = safeGetItem(`${CACHE_KEY}_${category}`);
    const rawTime = safeGetItem(`${CACHE_TIME_KEY}_${category}`);
    if (!raw || !rawTime) return null;
    const players = JSON.parse(raw) as UserProfile[];
    const time = parseInt(rawTime, 10);
    if (!Array.isArray(players) || isNaN(time)) return null;
    return { players, time };
  } catch {
    return null;
  }
}

function writeLocalCache(category: TimeControlCategory, players: UserProfile[]): void {
  const now = Date.now();
  safeSetItem(`${CACHE_KEY}_${category}`, JSON.stringify(players));
  safeSetItem(`${CACHE_TIME_KEY}_${category}`, String(now));
}

function evictLocalCache(): void {
  try {
    TIME_CONTROL_CATEGORIES.forEach((cat) => {
      localStorage.removeItem(`${CACHE_KEY}_${cat}`);
      localStorage.removeItem(`${CACHE_TIME_KEY}_${cat}`);
    });
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIME_KEY);
  } catch {
    // ignore
  }
}

function formatLastUpdated(timestamp: number | null): string {
  if (!timestamp) return '';
  const elapsedSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (elapsedSec < 60) return 'Updated just now';
  const elapsedMin = Math.floor(elapsedSec / 60);
  if (elapsedMin < 60) return `Updated ${elapsedMin}m ago`;
  const elapsedHours = Math.floor(elapsedMin / 60);
  return `Updated ${elapsedHours}h ago`;
}

/**
 * Global Leaderboard Table displaying top-ranked human players by mode-specific Elo.
 *
 * Algorithmic Complexity (Big O):
 * - Cache Hit Time Complexity: O(1) instant localStorage retrieval with zero database read cost.
 * - Cache Miss / Revalidation Time Complexity: O(log N + L) Firestore indexed range query where N is total users
 *   and L = MULTIPLAYER_SCALE_CONFIG.matchmaking.leaderboardLimit (L <= 50).
 * - Filter Complexity: O(L) to ensure only authentic human accounts with qualifying matches appear.
 * - Auxiliary Space Complexity: O(L) for cached player profiles.
 * - Growth Rate: Strictly sub-linear ceiling O(L) independent of total global user accounts.
 * - Cache Invalidation: Stale-While-Revalidate with immediate eviction on profileUpdated event or Elo updates.
 */
export const LeaderboardTable: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<TimeControlCategory>('blitz');
  const initialCache = readLocalCache(selectedCategory);
  const [players, setPlayers] = useState<UserProfile[]>(() => initialCache?.players ?? []);
  const [cacheTime, setCacheTime] = useState<number | null>(() => initialCache?.time ?? null);
  const [loading, setLoading] = useState(() => !initialCache);
  const [isRevalidating, setIsRevalidating] = useState(false);

  const fetchLeaderboard = useCallback(async (category: TimeControlCategory, forceRefresh = false) => {
    const hit = readLocalCache(category);
    const hasData = hit && hit.players.length > 0;

    if (!forceRefresh && hit && Date.now() - hit.time < CACHE_TTL_MS) {
      setPlayers(hit.players);
      setCacheTime(hit.time);
      setLoading(false);
      setIsRevalidating(false);
      return;
    }

    if (hasData) {
      // Stale-While-Revalidate: render current cache, revalidate in background
      setPlayers(hit.players);
      setCacheTime(hit.time);
      setLoading(false);
      setIsRevalidating(true);
    } else {
      setLoading(true);
      setIsRevalidating(true);
    }

    try {
      if (isFirebaseConfigured() && db) {
        const q = query(
          collection(db, MULTIPLAYER_SCALE_CONFIG.collections.users),
          orderBy(`perModeStats.${category}.elo`, 'desc'),
          orderBy(`perModeStats.${category}.gamesPlayed`, 'desc'),
          limit(LEADERBOARD_LIMIT)
        );
        const snap = await getDocs(q);
        const list = snap.docs
          .map((d) => d.data() as UserProfile)
          .filter((u) => isHumanLeaderboardEligible(u, category));
        writeLocalCache(category, list);
        setPlayers(list);
        setCacheTime(Date.now());
      } else {
        const mockList = localBackend.getLeaderboard(category);
        writeLocalCache(category, mockList);
        setPlayers(mockList);
        setCacheTime(Date.now());
      }
    } catch (e) {
      console.error('Failed to fetch leaderboard:', e);
      if (!hasData) {
        const fallback = localBackend.getLeaderboard(category);
        setPlayers(fallback);
      }
    } finally {
      setLoading(false);
      setIsRevalidating(false);
    }
  }, []);

  const handleCategorySelect = (category: TimeControlCategory) => {
    if (category === selectedCategory) return;
    setSelectedCategory(category);
    const hit = readLocalCache(category);
    if (hit) {
      setPlayers(hit.players);
      setCacheTime(hit.time);
      setLoading(false);
      if (Date.now() - hit.time >= CACHE_TTL_MS) {
        fetchLeaderboard(category, false);
      }
    } else {
      setPlayers([]);
      setCacheTime(null);
      setLoading(true);
      fetchLeaderboard(category, true);
    }
  };

  const handleManualRefresh = () => {
    fetchLeaderboard(selectedCategory, true);
  };

  useEffect(() => {
    fetchLeaderboard(selectedCategory);
  }, [selectedCategory, fetchLeaderboard]);

  useEffect(() => {
    // Immediate invalidation when the authenticated user's profile updates
    const handleProfileUpdated = () => {
      evictLocalCache();
      fetchLeaderboard(selectedCategory, true);
    };

    window.addEventListener('schada_profile_updated', handleProfileUpdated);
    return () => {
      window.removeEventListener('schada_profile_updated', handleProfileUpdated);
    };
  }, [selectedCategory, fetchLeaderboard]);

  return (
    <div className="leaderboard-container">
      <div className="leaderboard-header">
        <Trophy size={38} color="var(--accent-gold)" className="leaderboard-trophy-icon" />
        <h1 className="leaderboard-title">Global Leaderboard</h1>
        <p className="leaderboard-subtitle">
          Top rated Schada players ranked by Elo
        </p>
      </div>

      <div className="leaderboard-tabs" role="tablist" aria-label="Game Mode Leaderboards">
        {CATEGORY_TABS.map((tab) => {
          const isActive = selectedCategory === tab.category;
          return (
            <button
              key={tab.category}
              role="tab"
              aria-selected={isActive}
              className={`leaderboard-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => handleCategorySelect(tab.category)}
            >
              <span aria-hidden="true">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Meta Bar: Last Updated Timestamp & Manual Refresh Button */}
      <div className="leaderboard-meta-bar">
        {cacheTime && (
          <span className="leaderboard-last-updated">
            {formatLastUpdated(cacheTime)}
          </span>
        )}
        <button
          className="leaderboard-refresh-btn"
          onClick={handleManualRefresh}
          disabled={isRevalidating}
          aria-label="Refresh leaderboard rankings"
          title="Refresh leaderboard rankings"
        >
          <RefreshCw
            size={13}
            className={`leaderboard-refresh-icon ${isRevalidating ? 'spin' : ''}`}
          />
          <span>{isRevalidating ? 'Refreshing...' : 'Refresh'}</span>
        </button>
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
                  {getUserModeElo(p, selectedCategory)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
