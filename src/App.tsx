import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { GamePreferencesProvider } from './context/GamePreferencesContext';
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
import type { NavigationTab } from './components/layout/navigationTypes';
import { isPatronUser } from './components/common/PatronBadge';

// Lazy-loaded routes and modal components for minimal initial bundle size
const GameRoomView = lazy(() => import('./components/game/GameRoomView').then((m) => ({ default: m.GameRoomView })));
const Arena = lazy(() => import('./components/game/Arena').then((m) => ({ default: m.Arena })));
const LeaderboardTable = lazy(() => import('./components/leaderboard/LeaderboardTable').then((m) => ({ default: m.LeaderboardTable })));
const RulesGuide = lazy(() => import('./components/learn/RulesGuide').then((m) => ({ default: m.RulesGuide })));
const HistoryGuide = lazy(() => import('./components/history/HistoryGuide').then((m) => ({ default: m.HistoryGuide })));
const TermsOfService = lazy(() => import('./components/legal/TermsOfService').then((m) => ({ default: m.TermsOfService })));
const PrivacyPolicy = lazy(() => import('./components/legal/PrivacyPolicy').then((m) => ({ default: m.PrivacyPolicy })));
const DonatePage = lazy(() => import('./components/donate/DonatePage').then((m) => ({ default: m.DonatePage })));
const PlayAgainstComputerModal = lazy(() => import('./components/lobby/PlayAgainstComputerModal').then((m) => ({ default: m.PlayAgainstComputerModal })));
const CreateRoomModal = lazy(() => import('./components/lobby/CreateRoomModal').then((m) => ({ default: m.CreateRoomModal })));
const AuthModal = lazy(() => import('./components/auth/AuthModal').then((m) => ({ default: m.AuthModal })));
const ProfileModal = lazy(() => import('./components/auth/ProfileModal').then((m) => ({ default: m.ProfileModal })));
const FriendsDrawer = lazy(() => import('./components/friends/FriendsDrawer').then((m) => ({ default: m.FriendsDrawer })));
const CustomGameModal = lazy(() => import('./components/lobby/CustomGameModal').then((m) => ({ default: m.CustomGameModal })));

import { createInitialGameState } from './core/schada/engine';
import { calculateEloUpdate } from './core/elo/eloService';
import { ELO_CONFIG } from './core/elo/eloConfig';
import { FORMAT_CONFIG } from './core/schada/formatConfig';
import { localBackend, type UserProfile } from './services/firebase/localProvider';

import { updateUserStats } from './services/firebase/authService';
import {
  createGame,
  joinGame,
  findOpenWaitingGame,
  reconcilePendingElo,
} from './services/firebase/gameService';
import { MULTIPLAYER_SCALE_CONFIG } from './services/firebase/multiplayerConfig';
import { safeSetItem } from './services/storage/storageCleanup';
import { getBotTier } from './core/bot/botTiers';
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

  const [currentTab, setCurrentTab] = useState<NavigationTab>('play');
  const [activeMatch, setActiveMatch] = useState<ActiveMatch | null>(null);

  // Synchronize currentTab with URL route changes
  useEffect(() => {
    if (location.pathname === '/donate') {
      setCurrentTab('donate');
      setActiveMatch(null);
    } else if (location.pathname === '/') {
      setCurrentTab((prev) => (prev === 'donate' ? 'play' : prev));
    }
  }, [location.pathname]);

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
  useEffect(() => {
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

  // Reconcile any unapplied completed ranked games for the authenticated user
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    reconcilePendingElo(userId)
      .then((updatedProfile) => {
        if (updatedProfile) {
          refreshUser(updatedProfile);
        }
      })
      .catch((err) => {
        console.warn('Background elo reconciliation failed:', err);
      });
  }, [userId, refreshUser]);

  // Note: Stale/abandoned room cleanup is handled passively on-demand or via backend TTL policies,
  // preventing tens of thousands of redundant client sweep queries across active browser tabs.

  // Start a Quick Pair game (Player vs Player) - checks lobby for open game or creates new open room
  const handleStartQuickPair = async (minutes: number, increment: number, isRanked: boolean) => {
    const guestIdKey = MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.guestId;
    let guestId = localStorage.getItem(guestIdKey);
    if (!guestId) {
      guestId = 'guest_' + Math.random().toString(36).substring(2, 8);
      safeSetItem(guestIdKey, guestId);
    }

    const defaultGuestName = MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultGuestName;
    const defaultGuestRating = MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultGuestRating;
    const isDonor = isPatronUser(user);

    const currentUser = user
      ? {
          id: user.id,
          username: user.username,
          elo: user.eloRating,
          gamesPlayed: user.gamesPlayed ?? ELO_CONFIG.defaultAssumedGamesPlayed,
          isPatron: isDonor,
          hasDonated: isDonor,
          patronTier: user.patronTier,
          patronExpiresAt: user.patronExpiresAt,
          patronSubscriptionStatus: user.patronSubscriptionStatus,
        }
      : {
          id: guestId,
          username: localStorage.getItem(MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.guestName) || defaultGuestName,
          elo: defaultGuestRating,
          gamesPlayed: ELO_CONFIG.defaultAssumedGamesPlayed,
          isPatron: false,
          hasDonated: false,
        };

    try {
      // 1. Direct targeted index lookup for an open waiting room with this time control (O(1) read)
      const targetIsRanked = Boolean(user && isRanked);
      const existingMatch = await findOpenWaitingGame(
        minutes,
        increment,
        currentUser.id,
        undefined,
        targetIsRanked
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
    const tier = getBotTier(difficultyLevel);
    const botOpponent: ArenaPlayer = {
      id: `bot_level_${difficultyLevel}`,
      username: `SchadaBot (${tier.name} - Lvl ${difficultyLevel})`,
      elo: tier.elo,
    };

    const isDonor = isPatronUser(user);

    const currentUserPlayer: ArenaPlayer = user
      ? {
          id: user.id,
          username: user.username,
          elo: user.eloRating,
          isPatron: isDonor,
          hasDonated: isDonor,
          patronTier: user.patronTier,
          patronExpiresAt: user.patronExpiresAt,
          patronSubscriptionStatus: user.patronSubscriptionStatus,
        }
      : {
          id: 'guest',
          username: MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultGuestName,
          elo: MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultGuestRating,
          isPatron: false,
          hasDonated: false,
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

    const isDonor = isPatronUser(user);
    const friendIsDonor = isPatronUser(friend);

    setActiveMatch({
      bluePlayer: {
        id: user.id,
        username: user.username,
        elo: user.eloRating,
        gamesPlayed: user.gamesPlayed ?? ELO_CONFIG.defaultAssumedGamesPlayed,
        isPatron: isDonor,
        hasDonated: isDonor,
        patronTier: user.patronTier,
        patronExpiresAt: user.patronExpiresAt,
        patronSubscriptionStatus: user.patronSubscriptionStatus,
      },
      greenPlayer: {
        id: friend.id,
        username: friend.username,
        elo: friend.eloRating,
        gamesPlayed: ELO_CONFIG.defaultAssumedGamesPlayed,
        isPatron: friendIsDonor,
        hasDonated: friendIsDonor,
        patronTier: friend.patronTier,
        patronExpiresAt: friend.patronExpiresAt,
        patronSubscriptionStatus: friend.patronSubscriptionStatus,
      },
      timeControlMinutes: FORMAT_CONFIG.defaultFriendChallenge.minutes,
      incrementSeconds: FORMAT_CONFIG.defaultFriendChallenge.increment,
      isRanked: true,
      userColor: 'blue',
      isComputer: false,
      initialState: createInitialGameState(),
    });
  };

  // Custom Match Creation (Player vs Player) - Routes to Multiplayer Room
  const handleCreateCustom = async (minutes: number, increment: number, isRanked: boolean, colorPref?: PieceColor) => {
    const { guestId: guestIdKey, guestName: guestNameKey } =
      MULTIPLAYER_SCALE_CONFIG.presence.storageKeys;
    let guestId = localStorage.getItem(guestIdKey);
    if (!guestId) {
      guestId = 'guest_' + Math.random().toString(36).substring(2, 8);
      safeSetItem(guestIdKey, guestId);
    }

    const isDonor = isPatronUser(user);

    const creator = user
      ? {
          id: user.id,
          username: user.username,
          elo: user.eloRating,
          gamesPlayed: user.gamesPlayed ?? ELO_CONFIG.defaultAssumedGamesPlayed,
          isPatron: isDonor,
          hasDonated: isDonor,
          patronTier: user.patronTier,
          patronExpiresAt: user.patronExpiresAt,
          patronSubscriptionStatus: user.patronSubscriptionStatus,
        }
      : {
          id: guestId,
          username: (() => {
            const stored = localStorage.getItem(guestNameKey);
            return stored && stored.trim().length > 0
              ? stored
              : MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultGuestHostName;
          })(),
          elo: MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultGuestRating,
          gamesPlayed: ELO_CONFIG.defaultAssumedGamesPlayed,
          isPatron: false,
          hasDonated: false,
        };

    const result = await createGame({
      timeControlMinutes: minutes,
      incrementSeconds: minutes === 0 ? 0 : increment,
      isRanked: isRanked && Boolean(user),
      colorPref: colorPref ?? 'random',
      isPrivate: false,
      creator,
    });


    navigate(`/game/${result.gameId}`);
  };

  // Game completion handler (updates Elo and records if ranked)
  const handleGameComplete = async (finalState: BoardState) => {
    if (!activeMatch || !activeMatch.isRanked || !finalState.result) return;

    const { winner } = finalState.result;
    const outcome = winner === 'draw' ? 'draw' : winner;
    if (!outcome) return;

    const blueGames = activeMatch.bluePlayer.gamesPlayed ?? (activeMatch.bluePlayer.id === user?.id ? user?.gamesPlayed : undefined) ?? ELO_CONFIG.defaultAssumedGamesPlayed;
    const greenGames = activeMatch.greenPlayer.gamesPlayed ?? (activeMatch.greenPlayer.id === user?.id ? user?.gamesPlayed : undefined) ?? ELO_CONFIG.defaultAssumedGamesPlayed;

    // Calculate Elo update
    const eloResult = calculateEloUpdate(
      { rating: activeMatch.bluePlayer.elo, gamesPlayed: blueGames },
      { rating: activeMatch.greenPlayer.elo, gamesPlayed: greenGames },
      outcome
    );

    const blueWon = outcome === 'blue';
    const greenWon = outcome === 'green';
    const isDraw = outcome === 'draw';

    // Update Blue Player (e.g. host user)
    const updatedBlue = await updateUserStats(activeMatch.bluePlayer.id, blueWon, isDraw, eloResult.blueDelta);

    // Update Green Player (e.g. challenged friend or opponent)
    const updatedGreen = await updateUserStats(activeMatch.greenPlayer.id, greenWon, isDraw, eloResult.greenDelta);

    if (user && activeMatch.bluePlayer.id === user.id) {
      refreshUser(updatedBlue);
    } else if (user && activeMatch.greenPlayer.id === user.id) {
      refreshUser(updatedGreen);
    } else {
      refreshUser();
    }
  };

  const handleSelectTab = (tab: NavigationTab) => {
    setCurrentTab(tab);
    if (tab === 'donate') {
      if (location.pathname !== '/donate') {
        navigate('/donate');
      }
    } else {
      if (location.pathname !== '/') {
        navigate('/');
      }
    }
    if (tab !== 'play') {
      setActiveMatch(null);
    }
  };

  const isMatchActive = Boolean(activeMatch) || location.pathname.startsWith('/game/');

  return (
    <div className={`app-container ${isMatchActive ? 'in-match' : ''}`}>
      <OfflineBanner />

      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        onOpenAuth={() => setAuthOpen(true)}
        onOpenProfile={() => setProfileOpen(true)}
        onOpenFriends={() => setFriendsOpen(true)}
        pendingRequestsCount={user ? localBackend.getPendingIncomingRequests(user.id).length : 0}
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
          <Route path="/donate" element={<DonatePage />} />
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
                ) : currentTab === 'history' ? (
                  <HistoryGuide />
                ) : (
                  <DonatePage />
                )}
              </main>
            }
          />
        </Routes>
      </Suspense>

      {/* Site Footer (Hidden during active matches) */}
      {!isMatchActive && (
        <Footer onSelectTab={handleSelectTab} />
      )}

      {/* Mobile Bottom Navigation (Hidden during active matches) */}
      {!isMatchActive && (
        <BottomNav
          currentTab={currentTab}
          onSelectTab={handleSelectTab}
          onOpenFriends={() => setFriendsOpen(true)}
          pendingRequestsCount={user ? localBackend.getPendingIncomingRequests(user.id).length : 0}
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
      <GamePreferencesProvider>
        <AuthProvider>
          <PwaProvider>
            <BrowserRouter>
              <MainApp />
            </BrowserRouter>
          </PwaProvider>
        </AuthProvider>
      </GamePreferencesProvider>
    </ThemeProvider>
  );
}

