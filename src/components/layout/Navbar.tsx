import React from 'react';
import { Crown, Users, Trophy, BookOpen, Sun, Moon, LogIn, User } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

interface NavbarProps {
  currentTab: 'play' | 'leaderboard' | 'learn';
  onSelectTab: (tab: 'play' | 'leaderboard' | 'learn') => void;
  onOpenAuth: () => void;
  onOpenProfile: () => void;
  onOpenFriends: () => void;
  friendsCount?: number;
  pendingRequestsCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onOpenAuth,
  onOpenProfile,
  onOpenFriends,
  pendingRequestsCount = 0,
}) => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <nav className="navbar">
      {/* Brand */}
      <div className="nav-brand" onClick={() => onSelectTab('play')}>
        <Crown size={24} />
        <span>SCHADA</span>
      </div>

      {/* Navigation Tabs */}
      <div className="nav-links">
        <button
          className={`nav-tab ${currentTab === 'play' ? 'active' : ''}`}
          onClick={() => onSelectTab('play')}
        >
          <Crown size={16} />
          <span>Play</span>
        </button>
        <button
          className={`nav-tab ${currentTab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => onSelectTab('leaderboard')}
        >
          <Trophy size={16} />
          <span>Leaderboard</span>
        </button>
        <button
          className={`nav-tab ${currentTab === 'learn' ? 'active' : ''}`}
          onClick={() => onSelectTab('learn')}
        >
          <BookOpen size={16} />
          <span>Rules</span>
        </button>
      </div>

      {/* Right Cluster */}
      <div className="nav-actions">
        {/* Friends Drawer Button */}
        <button
          className="action-btn"
          style={{ position: 'relative', padding: '0.45rem 0.75rem' }}
          onClick={onOpenFriends}
          title="Friends & Challenges"
        >
          <Users size={16} />
          <span>Friends</span>
          {pendingRequestsCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                background: 'var(--accent-red)',
                color: 'white',
                fontSize: '10px',
                fontWeight: 700,
                borderRadius: '50%',
                width: '16px',
                height: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {pendingRequestsCount}
            </span>
          )}
        </button>

        {/* Theme Toggle */}
        <button
          className="action-btn"
          style={{ padding: '0.45rem' }}
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {/* User Account / Profile */}
        {user ? (
          <button
            className="action-btn"
            style={{
              padding: '0.4rem 0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              borderColor: 'var(--border-strong)',
            }}
            onClick={onOpenProfile}
            title="User Profile & Settings"
          >
            <User size={15} color="var(--accent-gold)" />
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{user.username}</span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                color: 'var(--accent-gold)',
                background: 'rgba(229, 183, 88, 0.12)',
                padding: '1px 6px',
                borderRadius: '4px',
              }}
            >
              {user.eloRating}
            </span>
          </button>
        ) : (
          <button
            className="action-btn"
            style={{
              padding: '0.4rem 0.9rem',
              backgroundColor: 'var(--accent-gold)',
              color: '#1a1a1a',
              fontWeight: 700,
            }}
            onClick={onOpenAuth}
          >
            <LogIn size={15} />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </nav>
  );
};
