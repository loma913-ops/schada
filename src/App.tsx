import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { PwaProvider } from './context/PwaContext';
import { Navbar } from './components/layout/Navbar';
import { BottomNav } from './components/layout/BottomNav';
import { OfflineBanner } from './components/layout/OfflineBanner';
import { InstallModal } from './components/pwa/InstallModal';
import { QuickPairingGrid } from './components/lobby/QuickPairingGrid';
import { LobbyTable } from './components/lobby/LobbyTable';
import { PlayAgainstComputerModal } from './components/lobby/PlayAgainstComputerModal';
import { CreateRoomModal } from './components/lobby/CreateRoomModal';
import { GameRoomView } from './components/game/GameRoomView';
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
import { createGame, getOpenRooms, joinGame, getLocalSessionToken } from './services/firebase/gameService';
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
  const navigate = useNavigate();
  const location = useLocation();

  const [currentTab, setCurrentTab] = useState<'play' | 'leaderboard' | 'learn'>('play');
  const [activeMatch, setActiveMatch] = useState<ActiveMatch | null>(null);

  // Modals
  const [authOpen, setAuthOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [customGameOpen, setCustomGameOpen] = useState(false);
  const [computerModalOpen, setComputerModalOpen] = useState(false);
  const [computerModalSettings, setComputerModalSettings] = useState<{
    timeControlMinutes?: number;
    incrementSeconds?: number;
    userColor?: 'random' | 'blue' | 'green';
  }>({});
  const [createRoomOpen, setCreateRoomOpen] = useState(false);

  // Check if routed with request to open Computer Modal
  React.useEffect(() => {
    if (location.state && (location.state as any).openComputerModal) {
      const state = location.state as {
        openComputerModal?: boolean;
        timeControlMinutes?: number;
        incrementSeconds?: number;
        userColor?: 'random' | 'blue' | 'green';
      };
      setComputerModalSettings({
        timeControlMinutes: state.timeControlMinutes,
        incrementSeconds: state.incrementSeconds,
        userColor: state.userColor,
      });
      setComputerModalOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  // Start a Quick Pair game (Player vs Player) - checks lobby for open game or creates new open room
  const handleStartQuickPair = async (minutes: number, increment: number, isRanked: boolean) => {
    let guestId = localStorage.getItem('schada_guest_id');
    if (!guestId) {
      guestId = 'guest_' + Math.random().toString(36).substring(2, 8);
      localStorage.setItem('schada_guest_id', guestId);
    }

    const currentUser = user
      ? { id: user.id, username: user.username, elo: user.eloRating }
      : {
          id: guestId,
          username: localStorage.getItem('schada_guest_name') || 'Guest Player',
          elo: 1200,
        };

    try {
      // 1. Check if there is an existing waiting room in the lobby matching this time control
      const openRooms = await getOpenRooms();
      const existingMatch = openRooms.find((r) => {
        if (r.status !== 'waiting') return false;
        if (r.timeControlMinutes !== minutes || (r.incrementSeconds || 0) !== increment) return false;
        const token = getLocalSessionToken(r.id);
        const isHost =
          (r.bluePlayer && (r.bluePlayer.id === currentUser.id || r.bluePlayer.sessionToken === token)) ||
          (r.greenPlayer && (r.greenPlayer.id === currentUser.id || r.greenPlayer.sessionToken === token));
        return !isHost;
      });

      if (existingMatch) {
        const joinRes = await joinGame(existingMatch.id, currentUser);
        if (joinRes.success) {
          navigate(`/game/${existingMatch.id}`);
          return;
        }
      }

      // 2. Otherwise create a public room in the lobby and wait for opponent
      const result = await createGame({
        timeControlMinutes: minutes,
        incrementSeconds: increment,
        isRanked: isRanked && Boolean(user),
        colorPref: 'random',
        isPrivate: false,
        creator: currentUser,
      });

      navigate(`/game/${result.gameId}`);
    } catch (err) {
      console.error('Failed to quick pair / create room:', err);
      const message = err instanceof Error ? err.message : String(err);
      alert(`Failed to start match: ${message}`);
    }
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

  // Custom Match Creation (Player vs Player) - Routes to Multiplayer Room
  const handleCreateCustom = async (minutes: number, increment: number, isRanked: boolean, colorPref?: PieceColor) => {
    let guestId = localStorage.getItem('schada_guest_id');
    if (!guestId) {
      guestId = 'guest_' + Math.random().toString(36).substring(2, 8);
      localStorage.setItem('schada_guest_id', guestId);
    }

    const creator = user
      ? { id: user.id, username: user.username, elo: user.eloRating }
      : {
          id: guestId,
          username: localStorage.getItem('schada_guest_name') || 'Guest Host',
          elo: 1200,
        };

    const result = await createGame({
      timeControlMinutes: minutes,
      incrementSeconds: minutes === 0 ? 0 : increment,
      isRanked: isRanked && Boolean(user),
      colorPref: colorPref || 'random',
      isPrivate: false,
      creator,
    });

    navigate(`/game/${result.gameId}`);
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

  const isMatchActive = Boolean(activeMatch) || location.pathname.startsWith('/game/');

  return (
    <div className={`app-container ${isMatchActive ? 'in-match' : ''}`}>
      <OfflineBanner />

      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          if (location.pathname !== '/') {
            navigate('/');
          }
          if (tab !== 'play') {
            setActiveMatch(null);
          }
        }}
        onOpenAuth={() => setAuthOpen(true)}
        onOpenProfile={() => setProfileOpen(true)}
        onOpenFriends={() => setFriendsOpen(true)}
        pendingRequestsCount={user ? mockBackend.getPendingIncomingRequests(user.id).length : 0}
      />

      {/* Main Views with Routing */}
      <Routes>
        <Route path="/game/:gameId" element={<GameRoomView />} />
        <Route
          path="*"
          element={
            <main className="main-app-content">
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
                  <div className="home-dashboard">
                    <div className="home-grid-column">
                      <QuickPairingGrid
                        onSelectTimeControl={handleStartQuickPair}
                        onStartPassAndPlay={handleStartPassAndPlay}
                        onOpenCustomModal={() => setCustomGameOpen(true)}
                        onOpenComputerModal={() => setComputerModalOpen(true)}
                        onOpenCreateRoomModal={() => setCreateRoomOpen(true)}
                      />
                    </div>
                    <div className="home-lobby-column">
                      <LobbyTable onOpenCreateRoomModal={() => setCreateRoomOpen(true)} />
                    </div>
                  </div>
                )
              ) : currentTab === 'leaderboard' ? (
                <LeaderboardTable />
              ) : (
                <RulesGuide />
              )}
            </main>
          }
        />
      </Routes>

      {/* Mobile Bottom Navigation (Hidden during active matches) */}
      {!isMatchActive && (
        <BottomNav
          currentTab={currentTab}
          onSelectTab={(tab) => {
            setCurrentTab(tab);
            if (location.pathname !== '/') {
              navigate('/');
            }
          }}
          onOpenFriends={() => setFriendsOpen(true)}
          pendingRequestsCount={user ? mockBackend.getPendingIncomingRequests(user.id).length : 0}
        />
      )}

      {/* PWA Install Guide Modal */}
      <InstallModal />

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
        initialTimeControlMinutes={computerModalSettings.timeControlMinutes}
        initialIncrementSeconds={computerModalSettings.incrementSeconds}
        initialColorPref={computerModalSettings.userColor}
      />
      <CreateRoomModal
        isOpen={createRoomOpen}
        onClose={() => setCreateRoomOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PwaProvider>
          <BrowserRouter>
            <MainApp />
          </BrowserRouter>
        </PwaProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

