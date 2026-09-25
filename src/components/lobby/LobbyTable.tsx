import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Settings,
  Rocket,
  Flame,
  Rabbit,
  Turtle,
  Check,
  RotateCcw,
  Plus,
  Users,
  ArrowLeft,
} from 'lucide-react';
import { subscribeToOpenRooms, type GameRoom } from '@/services/firebase/gameService';

export interface LobbyFilterState {
  timeControls: {
    bullet: boolean;
    blitz: boolean;
    rapid: boolean;
    classical: boolean;
  };
  increment: {
    yes: boolean;
    no: boolean;
  };
  modes: {
    casual: boolean;
    ranked: boolean;
  };
}

const DEFAULT_FILTERS: LobbyFilterState = {
  timeControls: {
    bullet: true,
    blitz: true,
    rapid: true,
    classical: true,
  },
  increment: {
    yes: true,
    no: true,
  },
  modes: {
    casual: true,
    ranked: true,
  },
};

const STORAGE_KEY = 'schada_lobby_filters';

function loadStoredFilters(): LobbyFilterState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_FILTERS, ...JSON.parse(saved) };
    }
  } catch {
    // fallback to default
  }
  return DEFAULT_FILTERS;
}

export function getTimeCategory(minutes: number, increment: number): 'bullet' | 'blitz' | 'rapid' | 'classical' {
  if (minutes === 0) return 'classical';
  const estimated = minutes + (increment * 40) / 60;
  if (estimated < 3) return 'bullet';
  if (estimated < 8) return 'blitz';
  if (estimated < 25) return 'rapid';
  return 'classical';
}

export function formatTimeControl(minutes: number, increment: number): string {
  if (minutes === 0) return '∞';
  if (minutes === 0.5) return `½+${increment}`;
  if (minutes === 1.5) return `1.5+${increment}`;
  return `${minutes}+${increment}`;
}

interface LobbyTableProps {
  onOpenCreateRoomModal?: () => void;
}

export const LobbyTable: React.FC<LobbyTableProps> = ({ onOpenCreateRoomModal }) => {
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<LobbyFilterState>(loadStoredFilters);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = subscribeToOpenRooms((openRooms) => {
      setRooms(openRooms);
    });
    return () => unsubscribe();
  }, []);

  const handleUpdateFilters = (updater: (prev: LobbyFilterState) => LobbyFilterState) => {
    setFilters((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_FILTERS));
    } catch {
      // ignore
    }
  };

  // Check if non-default filters are active
  const isCustomFilterActive = useMemo(() => {
    const { timeControls, increment, modes } = filters;
    return (
      !timeControls.bullet ||
      !timeControls.blitz ||
      !timeControls.rapid ||
      !timeControls.classical ||
      !increment.yes ||
      !increment.no ||
      !modes.casual ||
      !modes.ranked
    );
  }, [filters]);

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const category = getTimeCategory(room.timeControlMinutes, room.incrementSeconds || 0);
      if (!filters.timeControls[category]) return false;

      const hasIncrement = (room.incrementSeconds || 0) > 0;
      if (hasIncrement && !filters.increment.yes) return false;
      if (!hasIncrement && !filters.increment.no) return false;

      if (room.isRanked && !filters.modes.ranked) return false;
      if (!room.isRanked && !filters.modes.casual) return false;

      return true;
    });
  }, [rooms, filters]);

  const renderSpeedIcon = (category: 'bullet' | 'blitz' | 'rapid' | 'classical') => {
    switch (category) {
      case 'bullet':
        return <Rocket size={14} className="lobby-speed-icon bullet" />;
      case 'blitz':
        return <Flame size={14} className="lobby-speed-icon blitz" />;
      case 'rapid':
        return <Rabbit size={14} className="lobby-speed-icon rapid" />;
      case 'classical':
        return <Turtle size={14} className="lobby-speed-icon classical" />;
    }
  };

  return (
    <div className="lobby-card-container">
      {/* Lobby Header */}
      <div className="lobby-card-header">
        {showFilters ? (
          <div className="lobby-header-filter-bar">
            <button
              type="button"
              className="lobby-back-btn"
              onClick={() => setShowFilters(false)}
              aria-label="Back to Lobby Games"
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
            <span className="lobby-filter-title">Filter Settings</span>
            <button
              type="button"
              className="lobby-done-btn"
              onClick={() => setShowFilters(false)}
            >
              <Check size={14} />
              <span>Done</span>
            </button>
          </div>
        ) : (
          <div className="lobby-header-table-bar">
            <div className="lobby-col col-activity">
              <Activity size={18} className="activity-icon" />
              <span className="col-label">Players</span>
            </div>
            <div className="lobby-col col-time">
              <span>Time</span>
            </div>
            <div className="lobby-col col-mode">
              <span>Mode</span>
            </div>
            <div className="lobby-col col-gear">
              <button
                type="button"
                className={`lobby-gear-btn ${isCustomFilterActive ? 'active' : ''}`}
                onClick={() => setShowFilters(true)}
                title="Lobby Filter Settings"
                aria-label="Lobby Filter Settings"
              >
                <Settings size={17} />
                {isCustomFilterActive && <span className="filter-active-dot" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="lobby-card-body">
        {showFilters ? (
          /* ================= FILTER SETTINGS VIEW ================= */
          <div className="lobby-filter-panel">
            {/* Time Control Section */}
            <div className="filter-group">
              <div className="filter-group-label">Time control</div>
              <div className="filter-options-list">
                <label className="filter-checkbox-item">
                  <input
                    type="checkbox"
                    checked={filters.timeControls.bullet}
                    onChange={(e) =>
                      handleUpdateFilters((prev) => ({
                        ...prev,
                        timeControls: { ...prev.timeControls, bullet: e.target.checked },
                      }))
                    }
                  />
                  <span className="custom-checkbox">
                    {filters.timeControls.bullet && <Check size={12} />}
                  </span>
                  <span className="filter-label-text">
                    <strong>Bullet</strong> — Very fast games: less than 3 minutes
                  </span>
                </label>

                <label className="filter-checkbox-item">
                  <input
                    type="checkbox"
                    checked={filters.timeControls.blitz}
                    onChange={(e) =>
                      handleUpdateFilters((prev) => ({
                        ...prev,
                        timeControls: { ...prev.timeControls, blitz: e.target.checked },
                      }))
                    }
                  />
                  <span className="custom-checkbox">
                    {filters.timeControls.blitz && <Check size={12} />}
                  </span>
                  <span className="filter-label-text">
                    <strong>Blitz</strong> — Fast games: 3 to 8 minutes
                  </span>
                </label>

                <label className="filter-checkbox-item">
                  <input
                    type="checkbox"
                    checked={filters.timeControls.rapid}
                    onChange={(e) =>
                      handleUpdateFilters((prev) => ({
                        ...prev,
                        timeControls: { ...prev.timeControls, rapid: e.target.checked },
                      }))
                    }
                  />
                  <span className="custom-checkbox">
                    {filters.timeControls.rapid && <Check size={12} />}
                  </span>
                  <span className="filter-label-text">
                    <strong>Rapid</strong> — Rapid games: 8 to 25 minutes
                  </span>
                </label>

                <label className="filter-checkbox-item">
                  <input
                    type="checkbox"
                    checked={filters.timeControls.classical}
                    onChange={(e) =>
                      handleUpdateFilters((prev) => ({
                        ...prev,
                        timeControls: { ...prev.timeControls, classical: e.target.checked },
                      }))
                    }
                  />
                  <span className="custom-checkbox">
                    {filters.timeControls.classical && <Check size={12} />}
                  </span>
                  <span className="filter-label-text">
                    <strong>Classical</strong> — Classical games: 25 minutes and more
                  </span>
                </label>
              </div>
            </div>

            {/* Increment Section */}
            <div className="filter-group">
              <div className="filter-group-label">Increment</div>
              <div className="filter-options-inline">
                <label className="filter-checkbox-item">
                  <input
                    type="checkbox"
                    checked={filters.increment.yes}
                    onChange={(e) =>
                      handleUpdateFilters((prev) => ({
                        ...prev,
                        increment: { ...prev.increment, yes: e.target.checked },
                      }))
                    }
                  />
                  <span className="custom-checkbox">
                    {filters.increment.yes && <Check size={12} />}
                  </span>
                  <span className="filter-label-text">Yes</span>
                </label>

                <label className="filter-checkbox-item">
                  <input
                    type="checkbox"
                    checked={filters.increment.no}
                    onChange={(e) =>
                      handleUpdateFilters((prev) => ({
                        ...prev,
                        increment: { ...prev.increment, no: e.target.checked },
                      }))
                    }
                  />
                  <span className="custom-checkbox">
                    {filters.increment.no && <Check size={12} />}
                  </span>
                  <span className="filter-label-text">No</span>
                </label>
              </div>
            </div>

            {/* Mode Section (Casual / Rated) */}
            <div className="filter-group">
              <div className="filter-group-label">Mode</div>
              <div className="filter-options-inline">
                <label className="filter-checkbox-item">
                  <input
                    type="checkbox"
                    checked={filters.modes.casual}
                    onChange={(e) =>
                      handleUpdateFilters((prev) => ({
                        ...prev,
                        modes: { ...prev.modes, casual: e.target.checked },
                      }))
                    }
                  />
                  <span className="custom-checkbox">
                    {filters.modes.casual && <Check size={12} />}
                  </span>
                  <span className="filter-label-text">Casual</span>
                </label>

                <label className="filter-checkbox-item">
                  <input
                    type="checkbox"
                    checked={filters.modes.ranked}
                    onChange={(e) =>
                      handleUpdateFilters((prev) => ({
                        ...prev,
                        modes: { ...prev.modes, ranked: e.target.checked },
                      }))
                    }
                  />
                  <span className="custom-checkbox">
                    {filters.modes.ranked && <Check size={12} />}
                  </span>
                  <span className="filter-label-text">Rated</span>
                </label>
              </div>
            </div>

            {/* Reset Actions */}
            <div className="filter-footer-actions">
              <button
                type="button"
                className="action-btn"
                onClick={handleResetFilters}
                style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem', gap: '0.35rem' }}
              >
                <RotateCcw size={13} />
                <span>Reset to Default</span>
              </button>
            </div>
          </div>
        ) : (
          /* ================= LOBBY GAMES TABLE ================= */
          <div className="lobby-table-wrapper">
            {filteredRooms.length === 0 ? (
              <div className="lobby-empty-state">
                <div className="empty-icon-wrap">
                  <Users size={28} />
                </div>
                <div className="empty-title">
                  {rooms.length === 0 ? 'No active games in lobby' : 'No games match your filters'}
                </div>
                <p className="empty-description">
                  {rooms.length === 0
                    ? 'Create an open room to challenge players or invite friends.'
                    : 'Try relaxing your filter settings to see more games.'}
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                  {rooms.length > 0 && isCustomFilterActive && (
                    <button
                      type="button"
                      className="action-btn"
                      onClick={handleResetFilters}
                      style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
                    >
                      Reset Filters
                    </button>
                  )}
                  {onOpenCreateRoomModal && (
                    <button
                      type="button"
                      className="action-btn active"
                      onClick={onOpenCreateRoomModal}
                      style={{
                        fontSize: '0.85rem',
                        padding: '0.4rem 0.85rem',
                        backgroundColor: 'var(--accent-gold)',
                        color: '#1a1a1a',
                        fontWeight: 700,
                      }}
                    >
                      <Plus size={14} />
                      <span>Create a Room</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="lobby-table-list">
                {filteredRooms.map((room) => {
                  const isWaiting = room.status === 'waiting';
                  const host = room.bluePlayer || room.greenPlayer;
                  const opponent = room.bluePlayer && room.greenPlayer ? (room.bluePlayer === host ? room.greenPlayer : room.bluePlayer) : null;

                  const hostName = host ? host.username : 'Anonymous';
                  const oppName = opponent ? opponent.username : null;

                  const category = getTimeCategory(room.timeControlMinutes, room.incrementSeconds || 0);
                  const timeFormatted = formatTimeControl(room.timeControlMinutes, room.incrementSeconds || 0);

                  return (
                    <div
                      key={room.id}
                      className={`lobby-game-row ${isWaiting ? 'row-waiting' : 'row-live'}`}
                      onClick={() => navigate(`/game/${room.id}`)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          navigate(`/game/${room.id}`);
                        }
                      }}
                    >
                      {/* Players Column */}
                      <div className="lobby-col col-activity row-player-cell">
                        <span className="player-indicator-dot" title={isWaiting ? 'Waiting for opponent' : 'Game in progress'} />
                        <span className="player-names-text" title={isWaiting ? `${hostName} vs ?` : `${hostName} vs ${oppName}`}>
                          <strong className="host-name">{hostName}</strong>
                          <span className="vs-sep"> vs </span>
                          <span className={isWaiting ? 'waiting-placeholder' : 'opponent-name'}>
                            {oppName || '?'}
                          </span>
                        </span>
                      </div>

                      {/* Time Column */}
                      <div className="lobby-col col-time row-time-cell">
                        <span className="time-badge">{timeFormatted}</span>
                      </div>

                      {/* Mode Column */}
                      <div className="lobby-col col-mode row-mode-cell">
                        <div className="mode-with-icon">
                          {renderSpeedIcon(category)}
                          <span className="mode-label">{room.isRanked ? 'Rated' : 'Casual'}</span>
                        </div>
                      </div>

                      {/* Spacer to align with header gear icon */}
                      <div className="lobby-col col-gear" aria-hidden="true" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
