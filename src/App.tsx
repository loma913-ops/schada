import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/layout/Navbar';
import { QuickPairingGrid } from './components/lobby/QuickPairingGrid';
import { PlayAgainstComputerModal } from './components/lobby/PlayAgainstComputerModal';
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
  incrementSeconds?: number;
  isRanked: boolean;
  userColor?: PieceColor;
  isComputer?: boolean;
  botLevel?: number;
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
  const [computerModalOpen, setComputerModalOpen] = useState(false);

  // Start a Quick Pair game (Player vs Player)
  const handleStartQuickPair = (minutes: number, increment: number, isRanked: boolean) => {
    const currentUserPlayer: ArenaPlayer = user
      ? { id: user.id, username: user.username, elo: user.eloRating }
      : { id: 'player_1', username: 'Player 1', elo: 1200 };

    const opponentPlayer: ArenaPlayer = {
      id: 'player_2',
      username: 'Player 2',
      elo: user ? user.eloRating : 1200,
    };

    // Randomly select starting colors for each player (50/50 chance for Blue or Green)
    const isUserBlue = Math.random() < 0.5;
    const userColor: PieceColor = isUserBlue ? 'blue' : 'green';
    const bluePlayer = isUserBlue ? currentUserPlayer : opponentPlayer;
    const greenPlayer = isUserBlue ? opponentPlayer : currentUserPlayer;

    setActiveMatch({
      bluePlayer,
      greenPlayer,
      timeControlMinutes: minutes,
      incrementSeconds: increment,
      isRanked: isRanked && Boolean(user),
      userColor,
      isComputer: false,
      initialState: createInitialGameState(),
    });
  };

  // Start a Pass and Play / Solo Sandbox game
  const handleStartPassAndPlay = () => {
    setActiveMatch({
      bluePlayer: { id: 'p1', username: 'Player 1 (Blue)', elo: 1200 },
      greenPlayer: { id: 'p2', username: 'Player 2 (Green)', elo: 1200 },
      timeControlMinutes: 0,
      incrementSeconds: 0,
      isRanked: false,
      userColor: undefined, // pass and play allows both colors
      isComputer: false,
      initialState: createInitialGameState(),
    });
  };

  // Start Play Against Computer
  const handleStartComputerMatch = ({
    timeControlMinutes,
    incrementSeconds,
    difficultyLevel,
    userColor,
  }: {
    timeControlMinutes: number;
    incrementSeconds: number;
    difficultyLevel: number;
    userColor: PieceColor;
  }) => {
    const botElo = 1000 + difficultyLevel * 80;
    const botOpponent: ArenaPlayer = {
      id: `bot_level_${difficultyLevel}`,
      username: `SchadaBot (Level ${difficultyLevel})`,
      elo: botElo,
    };

    const currentUserPlayer: ArenaPlayer = user
      ? { id: user.id, username: user.username, elo: user.eloRating }
      : { id: 'guest', username: 'GuestPlayer', elo: 1200 };

    const bluePlayer = userColor === 'blue' ? currentUserPlayer : botOpponent;
    const greenPlayer = userColor === 'blue' ? botOpponent : currentUserPlayer;

    setActiveMatch({
      bluePlayer,
      greenPlayer,
      timeControlMinutes,
      incrementSeconds,
      isRanked: false,
      userColor,
      isComputer: true,
      botLevel: difficultyLevel,
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
      incrementSeconds: 0,
      isRanked: true,
      userColor: 'blue',
      isComputer: false,
      initialState: createInitialGameState(),
    });
  };

  // Custom Match Creation (Player vs Player)
  const handleCreateCustom = (minutes: number, isRanked: boolean, colorPref?: PieceColor) => {
    const opponentPlayer: ArenaPlayer = {
      id: 'player_2',
      username: 'Player 2',
      elo: user ? user.eloRating : 1200,
    };

    const currentUserPlayer: ArenaPlayer = user
      ? { id: user.id, username: user.username, elo: user.eloRating }
      : { id: 'player_1', username: 'Player 1', elo: 1200 };

    const userColor: PieceColor = colorPref || (Math.random() < 0.5 ? 'blue' : 'green');
    const bluePlayer = userColor === 'blue' ? currentUserPlayer : opponentPlayer;
    const greenPlayer = userColor === 'blue' ? opponentPlayer : currentUserPlayer;

    setActiveMatch({
      bluePlayer,
      greenPlayer,
      timeControlMinutes: minutes,
      incrementSeconds: 0,
      isRanked: isRanked && Boolean(user),
      userColor,
      isComputer: false,
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
    } else if (user && activeMatch.greenPlayer.id === user.id) {
      const won = outcome === 'green';
      const isDraw = outcome === 'draw';
      mockBackend.updateStats(user.id, won, isDraw, eloResult.greenDelta);
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
              incrementSeconds={activeMatch.incrementSeconds || 0}
              isRanked={activeMatch.isRanked}
              userColor={activeMatch.userColor}
              isComputer={activeMatch.isComputer}
              botLevel={activeMatch.botLevel}
              onGameComplete={handleGameComplete}
              onExit={() => setActiveMatch(null)}
            />
          ) : (
            <div style={{ maxWidth: '640px', margin: '2rem auto' }}>
              <QuickPairingGrid
                onSelectTimeControl={handleStartQuickPair}
                onStartPassAndPlay={handleStartPassAndPlay}
                onOpenCustomModal={() => setCustomGameOpen(true)}
                onOpenComputerModal={() => setComputerModalOpen(true)}
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
      <PlayAgainstComputerModal
        isOpen={computerModalOpen}
        onClose={() => setComputerModalOpen(false)}
        onStartGame={handleStartComputerMatch}
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
