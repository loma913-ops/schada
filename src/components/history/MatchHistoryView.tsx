import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  getPlayerMatchHistory,
  type GameRoom,
} from '@/services/firebase/gameService';
import { fetchAndHydrateUserProfile } from '@/services/firebase/authService';
import type { UserProfile } from '@/services/firebase/localProvider';
import type { WinReason } from '@/core/schada/types';
import {
  CANONICAL_MATCH_HISTORY_CONFIG,
  type MatchHistoryTabCategory,
} from './matchHistoryConfig';
import { MULTIPLAYER_SCALE_CONFIG } from '@/services/firebase/multiplayerConfig';
import { BOT_ENGINE_CONFIG } from '@/core/bot/botConfig';
import {
  Calendar,
  Clock,
  Loader2,
  Trophy,
  Bot,
  Swords,
  Flame,
  Zap,
  Timer,
  Hourglass,
  Mail,
} from 'lucide-react';
import { PatronBadge, isPatronUser } from '@/components/common/PatronBadge';

/** Format a match timestamp (number, Firestore Timestamp, or Date) into a localized readable string. */
function formatMatchDate(rawTimestamp: unknown): string {
  if (!rawTimestamp) return '';
  let date: Date;
  if (typeof rawTimestamp === 'number') {
    date = new Date(rawTimestamp);
  } else if (
    typeof rawTimestamp === 'object' &&
    rawTimestamp !== null &&
    'toMillis' in rawTimestamp &&
    typeof (rawTimestamp as { toMillis: () => number }).toMillis === 'function'
  ) {
    date = new Date((rawTimestamp as { toMillis: () => number }).toMillis());
  } else if (
    typeof rawTimestamp === 'object' &&
    rawTimestamp !== null &&
    'seconds' in rawTimestamp &&
    typeof (rawTimestamp as { seconds: number }).seconds === 'number'
  ) {
    date = new Date((rawTimestamp as { seconds: number }).seconds * 1000);
  } else if (rawTimestamp instanceof Date) {
    date = rawTimestamp;
  } else {
    date = new Date(String(rawTimestamp));
  }
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getModeIcon(mode?: string) {
  switch (mode) {
    case 'bullet':
      return <Zap size={14} color="var(--accent-gold)" />;
    case 'blitz':
      return <Flame size={14} color="var(--accent-orange)" />;
    case 'rapid':
      return <Timer size={14} color="var(--accent-blue)" />;
    case 'classical':
      return <Hourglass size={14} color="var(--accent-amber)" />;
    case 'correspondence':
      return <Mail size={14} color="var(--accent-green)" />;
    default:
      return <Clock size={14} color="var(--text-muted)" />;
  }
}

interface MatchHistoryViewProps {
  initialMatches?: GameRoom[];
  initialLoading?: boolean;
}

export const MatchHistoryView: React.FC<MatchHistoryViewProps> = ({
  initialMatches,
  initialLoading,
}) => {
  const { targetUserId } = useParams<{ targetUserId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const isSelf = !targetUserId || (Boolean(user) && targetUserId === user?.id);
  const effectiveUserId = targetUserId || user?.id;

  const [targetProfile, setTargetProfile] = useState<UserProfile | null>(() => {
    const passedProfile = (location.state as { targetProfile?: UserProfile })?.targetProfile;
    if (passedProfile && passedProfile.id === effectiveUserId) return passedProfile;
    if (isSelf && user) return user;
    return null;
  });

  const [activeTab, setActiveTab] = useState<MatchHistoryTabCategory>('all');
  const [matches, setMatches] = useState<GameRoom[]>(() => initialMatches || []);
  const [cursor, setCursor] = useState<unknown | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState<boolean>(() =>
    initialLoading !== undefined
      ? initialLoading
      : initialMatches !== undefined
      ? false
      : Boolean(effectiveUserId)
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydrate target profile if viewing another user and not passed via state
  useEffect(() => {
    if (isSelf) {
      if (user) setTargetProfile(user);
      return;
    }

    if (!targetProfile && targetUserId) {
      fetchAndHydrateUserProfile(targetUserId)
        .then((profile) => {
          if (profile) setTargetProfile(profile);
        })
        .catch((err) => {
          console.warn('Could not fetch target user profile for match history:', err);
        });
    }
  }, [targetUserId, isSelf, user, targetProfile]);

  // Load matches whenever effectiveUserId or activeTab changes
  const loadInitialMatches = useCallback(async () => {
    if (!effectiveUserId) {
      setLoading(false);
      setMatches([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await getPlayerMatchHistory({
        userId: effectiveUserId,
        mode: activeTab,
        limitCount: MULTIPLAYER_SCALE_CONFIG.matchmaking.matchHistoryPageLimit,
      });
      setMatches(result.games);
      setCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch (err) {
      console.error('Failed to load player match history:', err);
      setError('Unable to load match history. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId, activeTab]);

  useEffect(() => {
    if (initialMatches !== undefined && activeTab === 'all') {
      return;
    }
    loadInitialMatches();
  }, [loadInitialMatches, initialMatches, activeTab]);

  // Load more matches handler (pagination)
  const handleLoadMore = async () => {
    if (!effectiveUserId || !cursor || loadingMore) return;

    setLoadingMore(true);
    try {
      const result = await getPlayerMatchHistory({
        userId: effectiveUserId,
        mode: activeTab,
        limitCount: MULTIPLAYER_SCALE_CONFIG.matchmaking.matchHistoryPageLimit,
        cursor,
      });
      setMatches((prev) => [...prev, ...result.games]);
      setCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch (err) {
      console.error('Failed to load more match history:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleAnalyzeMatch = (match: GameRoom) => {
    // Navigate with game object in router location.state to avoid any additional database reads
    navigate(CANONICAL_MATCH_HISTORY_CONFIG.routes.analysis(match.id), {
      state: { game: match },
    });
  };

  const pageTitle = isSelf
    ? CANONICAL_MATCH_HISTORY_CONFIG.copy.defaultPageTitle
    : targetProfile?.username
    ? `${targetProfile.username}${CANONICAL_MATCH_HISTORY_CONFIG.copy.userPageTitleSuffix}`
    : CANONICAL_MATCH_HISTORY_CONFIG.copy.defaultPageTitle;

  return (
    <main className="match-history-container">
      {/* Header */}
      <div className="match-history-header">
        {targetProfile && isPatronUser(targetProfile) && <PatronBadge size={18} />}
        <h1 className="match-history-title">{pageTitle}</h1>
        {matches.length > 0 && (
          <span className="match-history-count-badge">
            {matches.length} {matches.length === 1 ? 'game' : 'games'}
          </span>
        )}
      </div>

      {/* Mode Filter Tabs */}
      <div
        role="tablist"
        aria-label="Filter games by mode"
        className="match-history-tabs"
      >
          {CANONICAL_MATCH_HISTORY_CONFIG.tabs.map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isSelected}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 0.9rem',
                  borderRadius: '20px',
                  fontSize: '0.82rem',
                  fontWeight: isSelected ? 700 : 500,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  border: isSelected
                    ? '1px solid var(--accent-gold)'
                    : '1px solid var(--border-subtle)',
                  backgroundColor: isSelected
                    ? 'var(--accent-gold-subtle)'
                    : 'var(--bg-tertiary)',
                  color: isSelected ? 'var(--accent-gold)' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

      {/* Not Logged In State */}
      {!effectiveUserId && (
        <div className="match-history-empty-card">
          <h2 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>
            Sign In to View Matches
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
            Sign in with your Schada account to record and inspect all of your rated and casual matches.
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate('/')}
          >
            {CANONICAL_MATCH_HISTORY_CONFIG.copy.returnToLobbyText}
          </button>
        </div>
      )}

      {/* Loading Spinner */}
      {loading && (
        <div
          style={{
            padding: '3rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            color: 'var(--text-muted)',
          }}
        >
          <Loader2 size={32} className="spin" color="var(--accent-gold)" />
          <span style={{ fontSize: '0.9rem' }}>
            {CANONICAL_MATCH_HISTORY_CONFIG.copy.loadingMatchesText}
          </span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div
          style={{
            padding: '1.25rem',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--accent-red)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--accent-red)',
            fontSize: '0.9rem',
            marginBottom: '1rem',
            textAlign: 'center',
            width: '100%',
            maxWidth: '520px',
            margin: '0 auto 1rem auto',
            boxSizing: 'border-box',
          }}
        >
          {error}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && effectiveUserId && matches.length === 0 && (
        <div className="match-history-empty-card">
          <div className="match-history-empty-icon">
            <Swords size={28} />
          </div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.4rem' }}>
            {CANONICAL_MATCH_HISTORY_CONFIG.copy.emptyTitle}
          </h2>
          <p
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.88rem',
              maxWidth: '420px',
              margin: '0 auto 1.5rem auto',
              lineHeight: 1.45,
            }}
          >
            {activeTab === 'all'
              ? CANONICAL_MATCH_HISTORY_CONFIG.copy.emptyDescription
              : CANONICAL_MATCH_HISTORY_CONFIG.copy.emptyFilteredDescription}
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate('/')}
          >
            {CANONICAL_MATCH_HISTORY_CONFIG.copy.returnToLobbyText}
          </button>
        </div>
      )}

      {/* Match Cards List */}
      {!loading && matches.length > 0 && (
        <div className="match-history-card-list">
          {matches.map((game) => {
              const isWhite = game.whitePlayer?.id === effectiveUserId;
              const opponentPlayer = isWhite ? game.blackPlayer : game.whitePlayer;
              const myColor = isWhite ? 'white' : 'black';

              const isDraw = game.winner === 'draw';
              const isWinner = game.winner === myColor;

              const resultBadgeText = isDraw
                ? CANONICAL_MATCH_HISTORY_CONFIG.copy.drawBadge
                : isWinner
                ? CANONICAL_MATCH_HISTORY_CONFIG.copy.victoryBadge
                : CANONICAL_MATCH_HISTORY_CONFIG.copy.defeatBadge;

              const resultColor = isDraw
                ? 'var(--text-muted)'
                : isWinner
                ? 'var(--accent-green)'
                : 'var(--accent-red)';

              const resultBg = isDraw
                ? 'rgba(156, 163, 175, 0.12)'
                : isWinner
                ? 'rgba(34, 197, 94, 0.12)'
                : 'rgba(239, 68, 68, 0.12)';

              const eloDelta = isWhite
                ? game.whiteElo?.delta ?? game.eloResult?.whiteDelta
                : game.blackElo?.delta ?? game.eloResult?.blackDelta;

              const reasonLabel =
                game.winReason &&
                Object.prototype.hasOwnProperty.call(
                  CANONICAL_MATCH_HISTORY_CONFIG.copy.winReasons,
                  game.winReason
                )
                  ? CANONICAL_MATCH_HISTORY_CONFIG.copy.winReasons[game.winReason as WinReason]
                  : game.winReason || '';

              const moveCount = game.boardState?.moveHistory?.length || 0;
              const fullMoves = Math.ceil(moveCount / 2);
              const formattedDate = formatMatchDate(game.createdAt);

              const opponentName =
                opponentPlayer?.username ||
                (game.isComputer ? `Bot Level ${game.botLevel ?? BOT_ENGINE_CONFIG.defaultLevel}` : 'Opponent');

              return (
                <div
                  key={game.id}
                  role="button"
                  tabIndex={0}
                  className="match-history-card"
                  onClick={() => handleAnalyzeMatch(game)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleAnalyzeMatch(game);
                    }
                  }}
                  aria-label={`Match vs ${opponentName}, result ${resultBadgeText}. Click to view move-by-move analysis.`}
                >
                  {/* Top Bar: Mode badge, Color, Ranked/Casual/Bot, Date */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                      fontSize: '0.76rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      {/* Mode Badge */}
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          backgroundColor: 'var(--bg-secondary)',
                          fontWeight: 700,
                          textTransform: 'capitalize',
                        }}
                      >
                        {getModeIcon(game.mode)}
                        <span>{game.mode || 'Standard'}</span>
                      </span>

                      {/* Ranked / Casual / Bot */}
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '10px',
                          backgroundColor: 'var(--bg-secondary)',
                          color: game.isComputer
                            ? 'var(--accent-blue)'
                            : game.isRanked
                            ? 'var(--accent-gold)'
                            : 'var(--text-muted)',
                          fontWeight: 600,
                        }}
                      >
                        {game.isComputer
                          ? CANONICAL_MATCH_HISTORY_CONFIG.copy.botBadge
                          : game.isRanked
                          ? CANONICAL_MATCH_HISTORY_CONFIG.copy.ratedBadge
                          : CANONICAL_MATCH_HISTORY_CONFIG.copy.casualBadge}
                      </span>

                      {/* Target Player Color */}
                      <span
                        style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-secondary)',
                          fontWeight: 600,
                        }}
                      >
                        {isWhite
                          ? CANONICAL_MATCH_HISTORY_CONFIG.copy.whiteColorBadge
                          : CANONICAL_MATCH_HISTORY_CONFIG.copy.blackColorBadge}
                      </span>
                    </div>

                    {/* Date */}
                    {formattedDate && (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        <Calendar size={12} />
                        <span>{formattedDate}</span>
                      </div>
                    )}
                  </div>

                  {/* Middle Row: Opponent, Outcome, Elo Change */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                    }}
                  >
                    {/* Opponent Info */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--bg-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          flexShrink: 0,
                        }}
                      >
                        {game.isComputer ? (
                          <Bot size={16} color="var(--accent-blue)" />
                        ) : (
                          opponentPlayer?.username?.charAt(0).toUpperCase() || '?'
                        )}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: '0.95rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}
                        >
                          <span
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {game.isComputer
                              ? `Bot Level ${game.botLevel ?? BOT_ENGINE_CONFIG.defaultLevel}`
                              : opponentPlayer?.username || 'Unknown Opponent'}
                          </span>
                          {!game.isComputer && opponentPlayer && isPatronUser(opponentPlayer) && (
                            <PatronBadge size={13} />
                          )}
                        </div>

                        {!game.isComputer && opponentPlayer?.elo && (
                          <div
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--text-muted)',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            Elo: {opponentPlayer.elo}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Result Badge & Delta */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.65rem',
                      }}
                    >
                      <span
                        style={{
                          padding: '3px 10px',
                          borderRadius: '12px',
                          backgroundColor: resultBg,
                          color: resultColor,
                          fontWeight: 800,
                          fontSize: '0.8rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                      >
                        {isWinner && <Trophy size={13} />}
                        <span>{resultBadgeText}</span>
                      </span>

                      {typeof eloDelta === 'number' && eloDelta !== 0 && (
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            color: eloDelta > 0 ? 'var(--accent-green)' : 'var(--accent-red)',
                          }}
                        >
                          {eloDelta > 0 ? `+${eloDelta}` : eloDelta}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom Row: Move count and Win Reason */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                      borderTop: '1px solid var(--border-subtle)',
                      paddingTop: '0.5rem',
                      fontSize: '0.76rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <span>
                        {fullMoves} {CANONICAL_MATCH_HISTORY_CONFIG.copy.movesSuffix}
                      </span>
                      {reasonLabel && (
                        <>
                          <span>•</span>
                          <span>{reasonLabel}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Load More Button */}
            {hasMore && (
              <button
                type="button"
                className="action-btn"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  marginTop: '0.5rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  fontWeight: 600,
                }}
                disabled={loadingMore}
                onClick={handleLoadMore}
              >
                {loadingMore ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    <span>{CANONICAL_MATCH_HISTORY_CONFIG.copy.loadingMatchesText}</span>
                  </>
                ) : (
                  <span>{CANONICAL_MATCH_HISTORY_CONFIG.copy.loadMoreButtonText}</span>
                )}
              </button>
            )}
          </div>
        )}
    </main>
  );
};

