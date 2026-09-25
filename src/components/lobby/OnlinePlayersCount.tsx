import React, { useEffect, useState } from 'react';
import { subscribeToLobbyStats, type LobbyStats } from '@/services/firebase/presenceService';

export const OnlinePlayersCount: React.FC = () => {
  const [stats, setStats] = useState<LobbyStats>({
    playersOnline: 0,
    guestsOnline: 1,
    activeGames: 0,
  });

  useEffect(() => {
    const unsubscribe = subscribeToLobbyStats((newStats) => {
      setStats(newStats);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="online-players-bar" aria-live="polite">
      <div className="online-players-badge">
        {/* Players Online (Strictly registered & signed in) */}
        <div className="online-stats-item" title="Registered players currently signed in">
          <span className="online-pulse-dot" aria-hidden="true" />
          <span className="online-stat-count">{stats.playersOnline.toLocaleString()}</span>
          <span className="online-stat-label">
            {stats.playersOnline === 1 ? 'player online' : 'players online'}
          </span>
        </div>

        {/* Separator Pipe */}
        <span className="online-stats-divider" aria-hidden="true">|</span>

        {/* Guests Online (Anonymous visitors) */}
        <div className="online-stats-item" title="Anonymous visitors currently online">
          <span className="online-stat-count">{stats.guestsOnline.toLocaleString()}</span>
          <span className="online-stat-label">
            {stats.guestsOnline === 1 ? 'guest online' : 'guests online'}
          </span>
        </div>

        {/* Separator Pipe */}
        <span className="online-stats-divider" aria-hidden="true">|</span>

        {/* Active Games (Waiting or in progress) */}
        <div className="online-stats-item" title="Games currently waiting or in progress">
          <span className="online-stat-count">{stats.activeGames.toLocaleString()}</span>
          <span className="online-stat-label">
            {stats.activeGames === 1 ? 'active game' : 'active games'}
          </span>
        </div>
      </div>
    </div>
  );
};
