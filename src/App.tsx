import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/layout/Navbar';
import { QuickPairingGrid } from './components/lobby/QuickPairingGrid';
import { Arena, type ArenaPlayer } from './components/game/Arena';
import { LeaderboardTable } from './components/leaderboard/LeaderboardTable';
import { RulesGuide } from './components/learn/RulesGuide';
import { AuthModal } from './components/auth/AuthModal';
import { ProfileModal } from './components/auth/ProfileModal';
import { FriendsDrawer } from './components/friends/FriendsDrawer';
import { CustomGameModal } from './components/lobby/CustomGameModal';
import { createInitialGameState } from './core/schada/engine';
import { calculateEloUpdate } from './core/elo/eloService';
import { mockBackend, type UserProfile } from './services/firebase/mockProvider';
import type { BoardState, PieceColor } from './core/schada/types';

interface ActiveMatch {
  bluePlayer: ArenaPlayer;
  greenPlayer: ArenaPlayer;
  timeControlMinutes: number;
  isRanked: boolean;
  userColor?: PieceColor;
  initialState: BoardState;
}

const MainApp: React.FC = () => {
  const { user, refreshUser } = useAuth();

  const [currentTab, setCurrentTab] = useState<'play' | 'leaderboard' | 'learn'>('play');
  const [activeMatch, setActiveMatch] = useState<ActiveMatch | null>(null);

  // Modals
  const [authOpen, setAuthOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [customGameOpen, setCustomGameOpen] = useState(false);

  // Start a Quick Pair game
  const handleStartQuickPair = (minutes: number, isRanked: boolean) => {
    const defaultOpponent: ArenaPlayer = {
      id: 'bot_tactician',
      username: 'Boogerd1936',
      elo: 1420,
    };

    const currentUserPlayer: ArenaPlayer = user
      ? { id: user.id, username: user.username, elo: user.eloRating }
      : { id: 'guest', username: 'GuestPlayer', elo: 1200 };

    setActiveMatch({
      bluePlayer: currentUserPlayer,
      greenPlayer: defaultOpponent,
      timeControlMinutes: minutes,
      isRanked: isRanked && Boolean(user),
      userColor: 'blue',
      initialState: createInitialGameState(),
    });
  };

  // Start a Pass and Play / Solo Sandbox game
  const handleStartPassAndPlay = () => {
    setActiveMatch({
      bluePlayer: { id: 'p1', username: 'Player 1 (Blue)', elo: 1200 },
      greenPlayer: { id: 'p2', username: 'Player 2 (Green)', elo: 1200 },
      timeControlMinutes: 0,
      isRanked: false,
      userColor: undefined, // pass and play allows both colors
      initialState: createInitialGameState(),
    });
  };

  // Challenge a Friend
  const handleChallengeFriend = (friend: UserProfile) => {
    if (!user) return;
    setFriendsOpen(false);

    setActiveMatch({
      bluePlayer: { id: user.id, username: user.username, elo: user.eloRating },
      greenPlayer: { id: friend.id, username: friend.username, elo: friend.eloRating },
      timeControlMinutes: 5,
      isRanked: true,
      userColor: 'blue',
      initialState: createInitialGameState(),
    });
  };

  // Custom Match Creation
  const handleCreateCustom = (minutes: number, isRanked: boolean, colorPref?: PieceColor) => {
    const defaultOpponent: ArenaPlayer = {
      id: 'opponent',
      username: 'SchadaGrandmaster',
      elo: 1650,
    };

    const currentUserPlayer: ArenaPlayer = user
      ? { id: user.id, username: user.username, elo: user.eloRating }
      : { id: 'guest', username: 'GuestPlayer', elo: 1200 };

    const userColor = colorPref || 'blue';
    const bluePlayer = userColor === 'blue' ? currentUserPlayer : defaultOpponent;
    const greenPlayer = userColor === 'blue' ? defaultOpponent : currentUserPlayer;

    setActiveMatch({
      bluePlayer,
      greenPlayer,
      timeControlMinutes: minutes,
      isRanked: isRanked && Boolean(user),
      userColor,
      initialState: createInitialGameState(),
    });
  };

  // Game completion handler (updates Elo and records if ranked)
  const handleGameComplete = (finalState: BoardState) => {
    if (!activeMatch || !activeMatch.isRanked || !finalState.result) return;

    const { winner } = finalState.result;
    const outcome = winner === 'draw' ? 'draw' : winner;
    if (!outcome) return;

    // Calculate Elo update
    const eloResult = calculateEloUpdate(
      { rating: activeMatch.bluePlayer.elo, gamesPlayed: user?.gamesPlayed || 0 },
      { rating: activeMatch.greenPlayer.elo, gamesPlayed: 20 },
      outcome
    );

    // If active user was Blue
    if (user && activeMatch.bluePlayer.id === user.id) {
      const won = outcome === 'blue';
      const isDraw = outcome === 'draw';
      mockBackend.updateStats(user.id, won, isDraw, eloResult.blueDelta);
      refreshUser();
    }
  };

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          if (tab !== 'play') {
            setActiveMatch(null);
          }
        }}
        onOpenAuth={() => setAuthOpen(true)}
        onOpenProfile={() => setProfileOpen(true)}
        onOpenFriends={() => setFriendsOpen(true)}
        pendingRequestsCount={user ? mockBackend.getPendingIncomingRequests(user.id).length : 0}
      />

      {/* Main Views */}
      <main style={{ flex: 1, padding: '1rem' }}>
        {currentTab === 'play' ? (
          activeMatch ? (
            <Arena
              initialState={activeMatch.initialState}
              bluePlayer={activeMatch.bluePlayer}
              greenPlayer={activeMatch.greenPlayer}
              timeControlMinutes={activeMatch.timeControlMinutes}
              isRanked={activeMatch.isRanked}
              userColor={activeMatch.userColor}
              onGameComplete={handleGameComplete}
              onExit={() => setActiveMatch(null)}
            />
          ) : (
            <div style={{ maxWidth: '640px', margin: '2rem auto' }}>
              <QuickPairingGrid
                onSelectTimeControl={handleStartQuickPair}
                onStartPassAndPlay={handleStartPassAndPlay}
                onOpenCustomModal={() => setCustomGameOpen(true)}
              />
            </div>
          )
        ) : currentTab === 'leaderboard' ? (
          <LeaderboardTable />
        ) : (
          <RulesGuide />
        )}
      </main>

      {/* Modals & Drawers */}
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
      <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
      <FriendsDrawer
        isOpen={friendsOpen}
        onClose={() => setFriendsOpen(false)}
        onChallengeFriend={handleChallengeFriend}
      />
      <CustomGameModal
        isOpen={customGameOpen}
        onClose={() => setCustomGameOpen(false)}
        onCreateGame={handleCreateCustom}
      />
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ThemeProvider>
  );
}
