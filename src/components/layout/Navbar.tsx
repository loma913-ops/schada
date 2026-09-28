import React from 'react';
import { Crown, Users, Trophy, BookOpen, Sun, Moon, LogIn, User, Smartphone, History } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { usePwa } from '@/context/PwaContext';

interface NavbarProps {
  currentTab: 'play' | 'leaderboard' | 'learn' | 'history';
  onSelectTab: (tab: 'play' | 'leaderboard' | 'learn' | 'history') => void;
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
  const { user, isLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isStandalone, setInstallModalOpen } = usePwa();

  return (
    <nav className="navbar">
      {/* Brand */}
      <div className="nav-brand" onClick={() => onSelectTab('play')}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="24" height="24" aria-hidden="true">
          <path fillRule="evenodd" d="M 50 18 L 62 42 L 85 45 L 68 62 L 72 85 L 50 74 L 28 85 L 32 62 L 15 45 L 38 42 Z M 58 50 A 8 8 0 0 1 50 58 A 8 8 0 0 1 42 50 A 8 8 0 0 1 50 42 A 8 8 0 0 1 58 50 Z" fill="var(--accent-gold)" stroke="var(--accent-gold-hover)" strokeWidth="2" />
        </svg>
        <span>Schada.org</span>
      </div>

      {/* Navigation Tabs (Desktop only) */}
      <div className="nav-links desktop-nav-links">
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
        <button
          className={`nav-tab ${currentTab === 'history' ? 'active' : ''}`}
          onClick={() => onSelectTab('history')}
        >
          <History size={16} />
          <span>History</span>
        </button>
      </div>

      {/* Right Cluster */}
      <div className="nav-actions">
        {/* PWA Install Trigger (hidden if already installed in standalone mode) */}
        {!isStandalone && (
          <button
            className="action-btn install-btn"
            onClick={() => setInstallModalOpen(true)}
            title="Install Schada App"
            aria-label="Install Schada App"
          >
            <Smartphone size={16} />
            <span className="install-btn-text">Install App</span>
          </button>
        )}

        {/* Friends Drawer Button (Desktop only, mobile has it in BottomNav) */}
        <button
          className="action-btn desktop-friends-btn"
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
            className="action-btn nav-profile-btn"
            style={{
              padding: '0.4rem 0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              borderColor: 'var(--border-strong)',
            }}
            onClick={onOpenProfile}
            title={`User Profile & Settings (Status: ${user.status})`}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor:
                  user.status === 'online'
                    ? 'var(--accent-green)'
                    : user.status === 'in-game'
                    ? 'var(--accent-gold)'
                    : 'var(--text-muted)',
                boxShadow:
                  user.status === 'online'
                    ? '0 0 6px rgba(98, 153, 36, 0.6)'
                    : 'none',
                display: 'inline-block',
                flexShrink: 0,
              }}
              title={`Status: ${user.status}`}
            />
            <User size={15} color="var(--accent-gold)" />
            <span
              className="nav-user-elo"
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
        ) : isLoading ? (
          <div
            className="action-btn nav-auth-loading"
            style={{
              padding: '0.4rem 0.9rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '85px',
              minHeight: '34px',
              opacity: 0.7,
              cursor: 'default',
            }}
            aria-busy="true"
            aria-label="Loading authentication"
          >
            <span
              style={{
                width: '14px',
                height: '14px',
                border: '2px solid var(--text-muted)',
                borderTopColor: 'var(--accent-gold)',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'spin 0.8s linear infinite',
              }}
            />
          </div>
        ) : (
          <button
            className="action-btn active"
            style={{
              padding: '0.4rem 0.9rem',
            }}
            onClick={onOpenAuth}
          >
            <LogIn size={15} />
            <span className="signin-text">Sign In</span>
          </button>
        )}
      </div>
    </nav>
  );
};

