import React from 'react';
import { Crown, Trophy, BookOpen, Users, History } from 'lucide-react';

interface BottomNavProps {
  currentTab: 'play' | 'leaderboard' | 'learn' | 'history';
  onSelectTab: (tab: 'play' | 'leaderboard' | 'learn' | 'history') => void;
  onOpenFriends: () => void;
  pendingRequestsCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onSelectTab,
  onOpenFriends,
  pendingRequestsCount = 0,
}) => {
  return (
    <nav className="bottom-nav" aria-label="Mobile Navigation">
      <button
        className={`bottom-nav-item ${currentTab === 'play' ? 'active' : ''}`}
        onClick={() => onSelectTab('play')}
      >
        <div className="bottom-nav-icon">
          <Crown size={20} />
        </div>
        <span className="bottom-nav-label">Play</span>
      </button>

      <button
        className={`bottom-nav-item ${currentTab === 'leaderboard' ? 'active' : ''}`}
        onClick={() => onSelectTab('leaderboard')}
      >
        <div className="bottom-nav-icon">
          <Trophy size={20} />
        </div>
        <span className="bottom-nav-label">Leaderboard</span>
      </button>

      <button
        className={`bottom-nav-item ${currentTab === 'learn' ? 'active' : ''}`}
        onClick={() => onSelectTab('learn')}
      >
        <div className="bottom-nav-icon">
          <BookOpen size={20} />
        </div>
        <span className="bottom-nav-label">Rules</span>
      </button>

      <button
        className={`bottom-nav-item ${currentTab === 'history' ? 'active' : ''}`}
        onClick={() => onSelectTab('history')}
      >
        <div className="bottom-nav-icon">
          <History size={20} />
        </div>
        <span className="bottom-nav-label">History</span>
      </button>

      <button
        className="bottom-nav-item"
        onClick={onOpenFriends}
      >
        <div className="bottom-nav-icon" style={{ position: 'relative' }}>
          <Users size={20} />
          {pendingRequestsCount > 0 && (
            <span className="bottom-nav-badge">
              {pendingRequestsCount}
            </span>
          )}
        </div>
        <span className="bottom-nav-label">Friends</span>
      </button>
    </nav>
  );
};
