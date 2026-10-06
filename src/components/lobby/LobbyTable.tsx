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
  Mail,
} from 'lucide-react';
import {
  subscribeToOpenRooms,
  getInProgressRooms,
  sortLobbyRooms,
  getLocalSessionToken,
  type GameRoom,
} from '@/services/firebase/gameService';
import { MULTIPLAYER_SCALE_CONFIG } from '@/services/firebase/multiplayerConfig';
import { PatronBadge, isPatronUser } from '@/components/common/PatronBadge';
import { isGuestUser } from '@/services/firebase/gameTypes';
import { useAuth } from '@/context/AuthContext';
import {
  LOBBY_CONFIG,
  parseStoredLobbyFilters,
  determineTimeCategory,
  formatTimeControlDisplay,
  isUserGameRoom,
  type LobbyFilterState,
  type TimeControlCategory,
} from './lobbyConfig';

export type { LobbyFilterState };

interface LobbyTableProps {
  onOpenCreateRoomModal?: () => void;
  initialWaitingRooms?: GameRoom[];
  initialInProgressRooms?: GameRoom[];
}

/**
 * Real-time Lobby Table with partitioned room streams and dynamic filter controls.
 *
 * Algorithmic Complexity (Big O):
 * - Waiting Room Subscription: O(1) listener invocation on open challenge changes.
 * - Live Rooms Polling: O(1) scheduled rate (liveRoomsPollIntervalMs), avoiding move-by-move stream traffic.
 * - Merging & Partition Sorting: O(K log K) where K <= maxOpenRoomsLobbyLimit (K <= 50).
 * - Room Partitioning (My Games vs Available Games): O(K) linear pass resolving ownership.
 * - Filter Evaluation: O(K) linear pass preserving relative order.
 * - Auxiliary Space Complexity: O(K) for partitioned and filtered room arrays.
 * - Growth Rate: Sub-linear ceiling O(K log K), scaling stably with thousands of active players.
 */
export const LobbyTable: React.FC<LobbyTableProps> = ({
  onOpenCreateRoomModal,
  initialWaitingRooms = [],
  initialInProgressRooms = [],
}) => {
  const { user } = useAuth();
  const isGuest = isGuestUser(user);
  const [waitingRooms, setWaitingRooms] = useState<GameRoom[]>(initialWaitingRooms);
  const [inProgressRooms, setInProgressRooms] = useState<GameRoom[]>(initialInProgressRooms);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<LobbyFilterState>(() => {
    if (typeof localStorage === 'undefined') {
      return LOBBY_CONFIG.defaultFilters;
    }
    return parseStoredLobbyFilters(localStorage.getItem(LOBBY_CONFIG.storageKey));
  });
  const navigate = useNavigate();

  // 1. Real-time subscription to waiting rooms (includeInProgress: false to eliminate move noise)
  useEffect(() => {
    const unsubscribe = subscribeToOpenRooms(
      (openWaitingRooms) => {
        setWaitingRooms(openWaitingRooms);
      },
      MULTIPLAYER_SCALE_CONFIG.matchmaking.maxOpenRoomsLobbyLimit,
      false
    );
    return () => unsubscribe();
  }, []);

  // 2. Load in-progress games on mount / relaxed interval without move streaming
  useEffect(() => {
    if (!filters.statuses.inProgress) {
      setInProgressRooms([]);
      return;
    }

    let isMounted = true;
    const loadLiveRooms = () => {
      getInProgressRooms(MULTIPLAYER_SCALE_CONFIG.matchmaking.maxOpenRoomsLobbyLimit)
        .then((live) => {
          if (isMounted) setInProgressRooms(live);
        })
        .catch(() => {});
    };

    loadLiveRooms();
    const intervalId = setInterval(
      loadLiveRooms,
      MULTIPLAYER_SCALE_CONFIG.matchmaking.liveRoomsPollIntervalMs
    );
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [filters.statuses.inProgress]);

  const rooms = useMemo(() => {
    return sortLobbyRooms([...waitingRooms, ...inProgressRooms]);
  }, [waitingRooms, inProgressRooms]);

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

  // Partition rooms: My Games (immune to filters, pinned at top) and Other Rooms
  const { myGames, otherRooms } = useMemo(() => {
    const guestIdKey = MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.guestId;
    const currentGuestId =
      typeof localStorage !== 'undefined' ? localStorage.getItem(guestIdKey) : null;
    const my: GameRoom[] = [];
    const other: GameRoom[] = [];
    for (const room of rooms) {
      const localToken = getLocalSessionToken(room.id);
      if (isUserGameRoom(room, user?.id, currentGuestId, localToken)) {
        my.push(room);
      } else {
        other.push(room);
      }
    }
    return { myGames: my, otherRooms: other };
  }, [rooms, user?.id]);

  // Filtered available games: applies active filters to other rooms in linear time O(N)
  const filteredAvailableGames = useMemo(() => {
    return otherRooms.filter((room) => {
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
  }, [otherRooms, filters]);

  const isLobbyEmpty = myGames.length === 0 && filteredAvailableGames.length === 0;

  const renderSpeedIcon = (category: TimeControlCategory) => {
    switch (category) {
      case 'bullet':
        return <Rocket size={14} className="lobby-speed-icon bullet" />;
      case 'blitz':
        return <Flame size={14} className="lobby-speed-icon blitz" />;
      case 'rapid':
        return <Rabbit size={14} className="lobby-speed-icon rapid" />;
      case 'classical':
        return <Turtle size={14} className="lobby-speed-icon classical" />;
      case 'correspondence':
        return <Mail size={14} className="lobby-speed-icon correspondence" />;
    }
  };

  const renderGameRow = (room: GameRoom) => {
    const isWaiting = room.status === 'waiting';
    const isRankedGuestDisabled = isWaiting && isGuest && room.isRanked;
    const host = room.bluePlayer || room.greenPlayer;
    const opponent =
      room.bluePlayer && room.greenPlayer
        ? room.bluePlayer === host
          ? room.greenPlayer
          : room.bluePlayer
        : null;

    const defaultHostName = MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultGuestHostName;
    const defaultOpponentName = MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultGuestName;
    const hostName = host?.username?.trim() || defaultHostName;
    const oppName = opponent?.username?.trim() || (isWaiting ? null : defaultOpponentName);

    const category = determineTimeCategory(room.timeControlMinutes, room.incrementSeconds || 0);
    const timeFormatted = formatTimeControlDisplay(
      room.timeControlMinutes,
      room.incrementSeconds || 0
    );

    return (
      <div
        key={room.id}
        className={`lobby-game-row ${isWaiting ? 'row-waiting' : 'row-live'}${
          isRankedGuestDisabled ? ' row-disabled' : ''
        }`}
        onClick={isRankedGuestDisabled ? undefined : () => navigate(`/game/${room.id}`)}
        role={isRankedGuestDisabled ? 'row' : 'button'}
        aria-disabled={isRankedGuestDisabled ? 'true' : undefined}
        tabIndex={isRankedGuestDisabled ? -1 : 0}
        title={
          isRankedGuestDisabled
            ? MULTIPLAYER_SCALE_CONFIG.matchmaking.guestRankedTooltipText
            : undefined
        }
        onKeyDown={(e) => {
          if (!isRankedGuestDisabled && (e.key === 'Enter' || e.key === ' ')) {
            navigate(`/game/${room.id}`);
          }
        }}
      >
        {/* Players Column */}
        <div className="lobby-col col-activity row-player-cell">
          <span
            className="player-indicator-dot"
            title={isWaiting ? 'Waiting for opponent' : 'Game in progress'}
          />
          <span
            className="player-names-text"
            title={isWaiting ? `${hostName} vs ?` : `${hostName} vs ${oppName}`}
          >
            <strong className="host-name">{hostName}</strong>
            {isPatronUser(host) && (
              <PatronBadge size={11} style={{ marginLeft: '0.25rem', verticalAlign: 'middle' }} />
            )}
            <span className="vs-sep"> vs </span>
            <span className={isWaiting ? 'waiting-placeholder' : 'opponent-name'}>
              {oppName || '?'}
            </span>
            {!isWaiting && isPatronUser(opponent) && (
              <PatronBadge size={11} style={{ marginLeft: '0.25rem', verticalAlign: 'middle' }} />
            )}
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
            <span className="mode-label">
              {room.isRanked ? LOBBY_CONFIG.modeLabels.ranked : LOBBY_CONFIG.modeLabels.casual}
            </span>
          </div>
        </div>

        {/* Spacer to align with header gear icon */}
        <div className="lobby-col col-gear" aria-hidden="true" />
      </div>
    );
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

                <label className="filter-checkbox-item">
                  <input
                    type="checkbox"
                    checked={filters.timeControls.correspondence}
                    onChange={(e) =>
                      handleUpdateFilters((prev) => ({
                        ...prev,
                        timeControls: { ...prev.timeControls, correspondence: e.target.checked },
                      }))
                    }
                  />
                  <span className="custom-checkbox">
                    {filters.timeControls.correspondence && <Check size={12} />}
                  </span>
                  <span className="filter-label-text">
                    <strong>Correspondence</strong> - Turn-based games: 1 day and more
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
          <div className="lobby-table-wrapper">
            {isLobbyEmpty ? (
              <div className="lobby-empty-state">
                <div className="empty-icon-wrap">
                  <Users size={28} />
                </div>
                <div className="empty-title">
                  {rooms.length === 0
                    ? LOBBY_CONFIG.emptyLobbyTitle
                    : LOBBY_CONFIG.emptyFilterTitle}
                </div>
                <p className="empty-description">
                  {rooms.length === 0
                    ? LOBBY_CONFIG.emptyLobbyDescription
                    : LOBBY_CONFIG.emptyFilterDescription}
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
                {/* 1. My Games section (pinned at top when active/waiting games exist) */}
                {myGames.length > 0 && (
                  <div className="lobby-section lobby-section-my-games">
                    <div className="lobby-section-header">
                      <div className="lobby-section-title-wrap">
                        <span className="lobby-section-title">
                          {LOBBY_CONFIG.sectionTitles.myGames}
                        </span>
                      </div>
                      <span className="lobby-section-badge my-games-badge">
                        {myGames.length}
                      </span>
                    </div>
                    <div className="lobby-section-items">
                      {myGames.map(renderGameRow)}
                    </div>
                  </div>
                )}

                {/* 2. Available Games section (always shown for clear section identity) */}
                <div className="lobby-section lobby-section-available">
                  <div className="lobby-section-header">
                    <div className="lobby-section-title-wrap">
                      <span className="lobby-section-title">
                        {LOBBY_CONFIG.sectionTitles.availableGames}
                      </span>
                    </div>
                    <span className="lobby-section-badge available-games-badge">
                      {filteredAvailableGames.length}
                    </span>
                  </div>
                  {filteredAvailableGames.length === 0 ? (
                    <div className="lobby-section-empty-note">
                      {otherRooms.length === 0
                        ? LOBBY_CONFIG.emptyAvailableGamesMessage
                        : LOBBY_CONFIG.emptyAvailableFilteredMessage}
                    </div>
                  ) : (
                    <div className="lobby-section-items">
                      {filteredAvailableGames.map(renderGameRow)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
