import React from 'react';
import { Crown, Users, Trophy, BookOpen, Sun, Moon, LogIn, User, History, Heart } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { SchadaStar } from '@/components/common/SchadaStar';
import type { NavigationTab } from '@/components/layout/navigationTypes';
import { isNativePlatform } from '@/services/native/mobileService';

interface NavbarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  onOpenAuth: () => void;
  onOpenProfile: () => void;
  onOpenFriends: () => void;
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

  return (
    <nav className="navbar">
      {/* Brand */}
      <div className="nav-brand" onClick={() => onSelectTab('play')}>
        <SchadaStar size={24} />
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
        {!isNativePlatform() && (
          <button
            className={`nav-tab nav-donate-tab ${currentTab === 'donate' ? 'active' : ''}`}
            onClick={() => onSelectTab('donate')}
            title="Support Schada • Donate"
          >
            <Heart size={16} />
            <span>Donate</span>
          </button>
        )}
      </div>

      {/* Right Cluster */}
      <div className="nav-actions">
        {/* Mobile Donate Link */}
        {!isNativePlatform() && (
          <button
            className={`action-btn mobile-donate-btn ${currentTab === 'donate' ? 'active' : ''}`}
            onClick={() => onSelectTab('donate')}
            title="Support Schada • Donate"
            aria-label="Support Schada • Donate"
          >
            <Heart size={16} />
          </button>
        )}

        {/* Friends Drawer Button (Desktop only, mobile has it in BottomNav) */}
        <button
          className="action-btn desktop-friends-btn"
          style={{ position: 'relative' }}
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
          className="action-btn theme-toggle-btn"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* User Account / Profile */}
        {user ? (
          <button
            className="action-btn nav-profile-btn"
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
          </button>
        ) : isLoading ? (
          <div
            className="action-btn nav-auth-loading"
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
            className="action-btn active nav-signin-btn"
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

