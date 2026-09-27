import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { PwaProvider } from './context/PwaContext';
import { Navbar } from './components/layout/Navbar';
import { BottomNav } from './components/layout/BottomNav';
import { Footer } from './components/layout/Footer';
import { OfflineBanner } from './components/layout/OfflineBanner';
import { OrientationLockOverlay } from './components/layout/OrientationLockOverlay';
import { InstallModal } from './components/pwa/InstallModal';
import { QuickPairingGrid } from './components/lobby/QuickPairingGrid';
import { LobbyTable } from './components/lobby/LobbyTable';
import type { ArenaPlayer } from './components/game/Arena';

// Lazy-loaded routes and modal components for minimal initial bundle size
const GameRoomView = lazy(() => import('./components/game/GameRoomView').then((m) => ({ default: m.GameRoomView })));
const Arena = lazy(() => import('./components/game/Arena').then((m) => ({ default: m.Arena })));
const LeaderboardTable = lazy(() => import('./components/leaderboard/LeaderboardTable').then((m) => ({ default: m.LeaderboardTable })));
const RulesGuide = lazy(() => import('./components/learn/RulesGuide').then((m) => ({ default: m.RulesGuide })));
const HistoryGuide = lazy(() => import('./components/history/HistoryGuide').then((m) => ({ default: m.HistoryGuide })));
const TermsOfService = lazy(() => import('./components/legal/TermsOfService').then((m) => ({ default: m.TermsOfService })));
const PrivacyPolicy = lazy(() => import('./components/legal/PrivacyPolicy').then((m) => ({ default: m.PrivacyPolicy })));
const PlayAgainstComputerModal = lazy(() => import('./components/lobby/PlayAgainstComputerModal').then((m) => ({ default: m.PlayAgainstComputerModal })));
const CreateRoomModal = lazy(() => import('./components/lobby/CreateRoomModal').then((m) => ({ default: m.CreateRoomModal })));
const AuthModal = lazy(() => import('./components/auth/AuthModal').then((m) => ({ default: m.AuthModal })));
const ProfileModal = lazy(() => import('./components/auth/ProfileModal').then((m) => ({ default: m.ProfileModal })));
const FriendsDrawer = lazy(() => import('./components/friends/FriendsDrawer').then((m) => ({ default: m.FriendsDrawer })));
const CustomGameModal = lazy(() => import('./components/lobby/CustomGameModal').then((m) => ({ default: m.CustomGameModal })));

import { createInitialGameState } from './core/schada/engine';
import { calculateEloUpdate } from './core/elo/eloService';
import { mockBackend, type UserProfile } from './services/firebase/mockProvider';
import {
  createGame,
  joinGame,
  findOpenWaitingGame,
  startAbandonedGamesCleanupWatcher,
} from './services/firebase/gameService';
import { MULTIPLAYER_SCALE_CONFIG } from './services/firebase/multiplayerConfig';
import type { BoardState, PieceColor } from './core/schada/types';

interface ComputerModalNavState {
  openComputerModal?: boolean;
  timeControlMinutes?: number;
  incrementSeconds?: number;
  userColor?: 'random' | 'blue' | 'green';
}

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

  const [currentTab, setCurrentTab] = useState<'play' | 'leaderboard' | 'learn' | 'history'>('play');
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
    const state = location.state as ComputerModalNavState | null;
    if (state && state.openComputerModal) {
      setComputerModalSettings({
        timeControlMinutes: state.timeControlMinutes,
        incrementSeconds: state.incrementSeconds,
        userColor: state.userColor,
      });
      setComputerModalOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  // Periodic background cleanup of abandoned / timed-out games
  useEffect(() => {
    const stopWatcher = startAbandonedGamesCleanupWatcher();
    return () => stopWatcher();
  }, []);

  // Start a Quick Pair game (Player vs Player) - checks lobby for open game or creates new open room
  const handleStartQuickPair = async (minutes: number, increment: number, isRanked: boolean) => {
    let guestId = localStorage.getItem('schada_guest_id');
    if (!guestId) {
      guestId = 'guest_' + Math.random().toString(36).substring(2, 8);
      localStorage.setItem('schada_guest_id', guestId);
    }

    const defaultGuestName = MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultGuestName;
    const defaultGuestRating = MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultGuestRating;

    const currentUser = user
      ? { id: user.id, username: user.username, elo: user.eloRating }
      : {
          id: guestId,
          username: localStorage.getItem('schada_guest_name') || defaultGuestName,
          elo: defaultGuestRating,
        };

    try {
      // 1. Direct targeted index lookup for an open waiting room with this time control (O(1) read)
      const existingMatch = await findOpenWaitingGame(
        minutes,
        increment,
        currentUser.id,
        undefined,
        user ? undefined : false
      );

      if (existingMatch) {
        const joinRes = await joinGame(existingMatch.id, currentUser);
        if (joinRes.success && joinRes.role === 'player') {
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
  // Start a Pass and Play / Solo Sandbox game
  const handleStartPassAndPlay = () => {
    setActiveMatch({
      bluePlayer: {
        id: 'p1',
        username: MULTIPLAYER_SCALE_CONFIG.matchmaking.passAndPlayBlueName,
        elo: MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultStartingRating,
      },
      greenPlayer: {
        id: 'p2',
        username: MULTIPLAYER_SCALE_CONFIG.matchmaking.passAndPlayGreenName,
        elo: MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultStartingRating,
      },
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
    const botElo =
      MULTIPLAYER_SCALE_CONFIG.matchmaking.botBaseElo +
      difficultyLevel * MULTIPLAYER_SCALE_CONFIG.matchmaking.botEloStepPerLevel;
    const botOpponent: ArenaPlayer = {
      id: `bot_level_${difficultyLevel}`,
      username: `SchadaBot (Level ${difficultyLevel})`,
      elo: botElo,
    };

    const currentUserPlayer: ArenaPlayer = user
      ? { id: user.id, username: user.username, elo: user.eloRating }
      : {
          id: 'guest',
          username: MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultGuestName,
          elo: MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultGuestRating,
        };

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
          username:
            localStorage.getItem('schada_guest_name') ||
            MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultGuestHostName,
          elo: MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultGuestRating,
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
      <Suspense
        fallback={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--text-muted)' }}>
            Loading...
          </div>
        }
      >
        <Routes>
          <Route path="/game/:gameId" element={<GameRoomView />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route
            path="*"
            element={
              <main className="main-app-content">
                {currentTab === 'play' ? (
                  activeMatch ? (
                    <Arena
                      key={activeMatch.userColor ? `match-${activeMatch.userColor}-${activeMatch.isComputer ? 'bot' : 'pvp'}` : 'match-pass-and-play'}
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
                ) : currentTab === 'learn' ? (
                  <RulesGuide />
                ) : (
                  <HistoryGuide />
                )}
              </main>
            }
          />
        </Routes>
      </Suspense>

      {/* Site Footer (Hidden during active matches) */}
      {!isMatchActive && (
        <Footer
          onSelectTab={(tab) => {
            setCurrentTab(tab);
            if (location.pathname !== '/') {
              navigate('/');
            }
            if (tab !== 'play') {
              setActiveMatch(null);
            }
          }}
        />
      )}

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

      {/* Mobile Orientation Lock (Locks portrait, blocks landscape) */}
      <OrientationLockOverlay />

      {/* Modals & Drawers - Loaded on-demand only when opened */}
      <Suspense fallback={null}>
        {authOpen && <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />}
        {profileOpen && <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />}
        {friendsOpen && (
          <FriendsDrawer
            isOpen={friendsOpen}
            onClose={() => setFriendsOpen(false)}
            onChallengeFriend={handleChallengeFriend}
          />
        )}
        {customGameOpen && (
          <CustomGameModal
            isOpen={customGameOpen}
            onClose={() => setCustomGameOpen(false)}
            onCreateGame={handleCreateCustom}
          />
        )}
        {computerModalOpen && (
          <PlayAgainstComputerModal
            isOpen={computerModalOpen}
            onClose={() => setComputerModalOpen(false)}
            onStartGame={handleStartComputerMatch}
            initialTimeControlMinutes={computerModalSettings.timeControlMinutes}
            initialIncrementSeconds={computerModalSettings.incrementSeconds}
            initialColorPref={computerModalSettings.userColor}
          />
        )}
        {createRoomOpen && (
          <CreateRoomModal
            isOpen={createRoomOpen}
            onClose={() => setCreateRoomOpen(false)}
          />
        )}
      </Suspense>
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

