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
import { MULTIPLAYER_SCALE_CONFIG } from '@/services/firebase/multiplayerConfig';
import {
  LOBBY_CONFIG,
  parseStoredLobbyFilters,
  determineTimeCategory,
  formatTimeControlDisplay,
  type LobbyFilterState,
} from './lobbyConfig';

export type { LobbyFilterState };

interface LobbyTableProps {
  onOpenCreateRoomModal?: () => void;
}

export const LobbyTable: React.FC<LobbyTableProps> = ({ onOpenCreateRoomModal }) => {
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<LobbyFilterState>(() => {
    if (typeof localStorage === 'undefined') {
      return LOBBY_CONFIG.defaultFilters;
    }
    return parseStoredLobbyFilters(localStorage.getItem(LOBBY_CONFIG.storageKey));
  });
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
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(LOBBY_CONFIG.storageKey, JSON.stringify(next));
        }
      } catch {
        // ignore storage quota / access issues
      }
      return next;
    });
  };

  const handleResetFilters = () => {
    setFilters(LOBBY_CONFIG.defaultFilters);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LOBBY_CONFIG.storageKey, JSON.stringify(LOBBY_CONFIG.defaultFilters));
      }
    } catch {
      // ignore
    }
  };

  // Check if non-default filters are active
  const isCustomFilterActive = useMemo(() => {
    const { timeControls, increment, modes, statuses } = filters;
    return (
      !timeControls.bullet ||
      !timeControls.blitz ||
      !timeControls.rapid ||
      !timeControls.classical ||
      !increment.yes ||
      !increment.no ||
      !modes.casual ||
      !modes.ranked ||
      !statuses.open ||
      !statuses.inProgress
    );
  }, [filters]);

  // Filtered rooms: rooms is already stably ordered by sortLobbyRooms (waiting rooms first, newest first).
  // Array.prototype.filter preserves relative order with optimal O(N) linear time.
  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      // 1. Status filter (Open vs In-Progress)
      if (room.status === 'waiting' && !filters.statuses.open) return false;
      if (room.status === 'in_progress' && !filters.statuses.inProgress) return false;
      if (room.status !== 'waiting' && room.status !== 'in_progress') return false;

      // 2. Time category filter
      const category = determineTimeCategory(room.timeControlMinutes, room.incrementSeconds || 0);
      if (!filters.timeControls[category]) return false;

      // 3. Increment filter
      const hasIncrement = (room.incrementSeconds || 0) > 0;
      if (hasIncrement && !filters.increment.yes) return false;
      if (!hasIncrement && !filters.increment.no) return false;

      // 4. Mode filter (Ranked vs Casual)
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
                    <strong>Bullet</strong> - Very fast games: less than 3 minutes
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
                    <strong>Blitz</strong> - Fast games: 3 to 8 minutes
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
                    <strong>Rapid</strong> - Rapid games: 8 to 25 minutes
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
                    <strong>Classical</strong> - Classical games: 25 minutes and more
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

            {/* Game Status Section (Open Rooms / In-Progress Games) */}
            <div className="filter-group">
              <div className="filter-group-label">Game status</div>
              <div className="filter-options-inline">
                <label className="filter-checkbox-item">
                  <input
                    type="checkbox"
                    checked={filters.statuses.open}
                    onChange={(e) =>
                      handleUpdateFilters((prev) => ({
                        ...prev,
                        statuses: { ...prev.statuses, open: e.target.checked },
                      }))
                    }
                  />
                  <span className="custom-checkbox">
                    {filters.statuses.open && <Check size={12} />}
                  </span>
                  <span className="filter-label-text">Open Rooms</span>
                </label>

                <label className="filter-checkbox-item">
                  <input
                    type="checkbox"
                    checked={filters.statuses.inProgress}
                    onChange={(e) =>
                      handleUpdateFilters((prev) => ({
                        ...prev,
                        statuses: { ...prev.statuses, inProgress: e.target.checked },
                      }))
                    }
                  />
                  <span className="custom-checkbox">
                    {filters.statuses.inProgress && <Check size={12} />}
                  </span>
                  <span className="filter-label-text">In-Progress</span>
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

                  const defaultHostName = MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultGuestHostName;
                  const defaultOpponentName = MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultGuestName;
                  const hostName = host?.username?.trim() || defaultHostName;
                  const oppName = opponent?.username?.trim() || (isWaiting ? null : defaultOpponentName);

                  const category = determineTimeCategory(room.timeControlMinutes, room.incrementSeconds || 0);
                  const timeFormatted = formatTimeControlDisplay(room.timeControlMinutes, room.incrementSeconds || 0);

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
