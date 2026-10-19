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
import { UpdateNotificationBanner } from './components/layout/UpdateNotificationBanner';
import { OrientationLockOverlay } from './components/layout/OrientationLockOverlay';
import { InstallModal } from './components/pwa/InstallModal';
import { QuickPairingGrid } from './components/lobby/QuickPairingGrid';
import { LobbyTable } from './components/lobby/LobbyTable';
import { determineTimeCategory } from './components/lobby/lobbyConfig';
import type { ArenaPlayer } from './components/game/Arena';
import type { NavigationTab } from './components/layout/navigationTypes';
import { isPatronUser } from './components/common/PatronBadge';
import { isNativePlatform, initNativeMobileServices } from './services/native/mobileService';

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
import { localBackend, type UserProfile, getUserModeElo, getUserModeGamesPlayed } from './services/firebase/localProvider';
import { logPageView } from './services/firebase/analyticsService';

import { updateUserStats, getOrCreateGuestId } from './services/firebase/authService';
import {
  createGame,
  joinGame,
  findOpenWaitingGame,
  reconcilePendingElo,
} from './services/firebase/gameService';
import { MULTIPLAYER_SCALE_CONFIG } from './services/firebase/multiplayerConfig';
import { SECURITY_CONFIG } from './core/security/securityConfig';
import { getBotTier } from './core/bot/botTiers';
import type { BoardState, PieceColor } from './core/schada/types';

interface ComputerModalNavState {
  openComputerModal?: boolean;
  timeControlMinutes?: number;
  incrementSeconds?: number;
  userColor?: 'random' | 'white' | 'black';
}

interface ActiveMatch {
  whitePlayer: ArenaPlayer;
  blackPlayer: ArenaPlayer;
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

  // Dispatch SPA page view telemetry on route changes (fail-soft, non-blocking)
  useEffect(() => {
    void logPageView(location.pathname);
  }, [location.pathname]);

  // Notify native Android wrapper that the app is mounted and ready for presentation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const nativeSplash = (window as unknown as { NativeSplash?: { notifyAppReady: () => void } }).NativeSplash;
      if (nativeSplash?.notifyAppReady) {
        nativeSplash.notifyAppReady();
      }
    }
  }, []);

  // Modals
  const [authOpen, setAuthOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [challengedFriend, setChallengedFriend] = useState<UserProfile | null>(null);
  const [customGameOpen, setCustomGameOpen] = useState(false);
  const [customGameInitialTab, setCustomGameInitialTab] = useState<'realtime' | 'correspondence'>('realtime');
  const [computerModalOpen, setComputerModalOpen] = useState(false);
  const [computerModalSettings, setComputerModalSettings] = useState<{
    timeControlMinutes?: number;
    incrementSeconds?: number;
    userColor?: 'random' | 'white' | 'black';
  }>({});
  const [createRoomOpen, setCreateRoomOpen] = useState(false);
  const [toastNotification, setToastNotification] = useState<string | null>(null);

  // Check if routed with notification or request to open Computer Modal
  useEffect(() => {
    const state = location.state as (ComputerModalNavState & { notification?: string }) | null;
    if (state && state.openComputerModal) {
      setComputerModalSettings({
        timeControlMinutes: state.timeControlMinutes,
        incrementSeconds: state.incrementSeconds,
        userColor: state.userColor,
      });
      setComputerModalOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    } else if (state?.notification) {
      setToastNotification(state.notification);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  // Register native Android & iOS lifecycle and hardware back button listeners
  useEffect(() => {
    const cleanupNative = initNativeMobileServices({
      hasOpenModal: () => authOpen || profileOpen || friendsOpen || customGameOpen || computerModalOpen || createRoomOpen,
      closeActiveModal: () => {
        if (authOpen) setAuthOpen(false);
        else if (profileOpen) setProfileOpen(false);
        else if (friendsOpen) setFriendsOpen(false);
        else if (customGameOpen) {
          setCustomGameOpen(false);
          setChallengedFriend(null);
        }
        else if (computerModalOpen) setComputerModalOpen(false);
        else if (createRoomOpen) setCreateRoomOpen(false);
      },
      isInGameMatch: () => location.pathname.startsWith('/game/') || Boolean(activeMatch),
      navigateBack: () => navigate(-1),
      isAtRootPlayTab: () => location.pathname === '/' && currentTab === 'play',
    });
    return () => cleanupNative();
  }, [authOpen, profileOpen, friendsOpen, customGameOpen, computerModalOpen, createRoomOpen, location.pathname, activeMatch, currentTab, navigate]);

  useEffect(() => {
    if (!toastNotification) return;
    const timer = setTimeout(() => {
      setToastNotification(null);
    }, SECURITY_CONFIG.toastNotificationDurationMs);
    return () => clearTimeout(timer);
  }, [toastNotification]);

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
    const guestId = getOrCreateGuestId();
    const category = determineTimeCategory(minutes, increment);

    const defaultGuestName = MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultGuestName;
    const defaultGuestRating = MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultGuestRating;
    const isDonor = isPatronUser(user);

    const currentUser = user
      ? {
        id: user.id,
        username: user.username,
        elo: getUserModeElo(user, category),
        gamesPlayed: getUserModeGamesPlayed(user, category),
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
      whitePlayer: {
        id: 'p1',
        username: MULTIPLAYER_SCALE_CONFIG.matchmaking.passAndPlayWhiteName,
        elo: MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultStartingRating,
      },
      blackPlayer: {
        id: 'p2',
        username: MULTIPLAYER_SCALE_CONFIG.matchmaking.passAndPlayBlackName,
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
    const category = determineTimeCategory(timeControlMinutes, incrementSeconds);
    const botOpponent: ArenaPlayer = {
      id: `bot_level_${difficultyLevel}`,
      username: `SchadaBot - Lvl ${difficultyLevel}`,
      elo: tier.elo,
    };

    const isDonor = isPatronUser(user);

    const currentUserPlayer: ArenaPlayer = user
      ? {
        id: user.id,
        username: user.username,
        elo: getUserModeElo(user, category),
        gamesPlayed: getUserModeGamesPlayed(user, category),
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

    const isWhiteUser = userColor === 'white' || (userColor as string) === 'blue';
    const whitePlayer = isWhiteUser ? currentUserPlayer : botOpponent;
    const blackPlayer = isWhiteUser ? botOpponent : currentUserPlayer;

    setActiveMatch({
      whitePlayer,
      blackPlayer,
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
    setChallengedFriend(friend);
    setCustomGameInitialTab('realtime');
    setCustomGameOpen(true);
  };

  // Custom Match Creation (Player vs Player) - Routes to Multiplayer Room or Friend Match
  const handleCreateCustom = async (
    minutes: number,
    increment: number,
    isRanked: boolean,
    colorPref?: PieceColor
  ) => {
    const guestId = getOrCreateGuestId();
    const { guestName: guestNameKey } = MULTIPLAYER_SCALE_CONFIG.presence.storageKeys;
    const category = determineTimeCategory(minutes, increment);

    const isDonor = isPatronUser(user);

    const creator: ArenaPlayer = user
      ? {
        id: user.id,
        username: user.username,
        elo: getUserModeElo(user, category),
        gamesPlayed: getUserModeGamesPlayed(user, category),
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

    let targetOpponent: ArenaPlayer | null = null;
    if (challengedFriend) {
      const friendIsDonor = isPatronUser(challengedFriend);
      targetOpponent = {
        id: challengedFriend.id,
        username: challengedFriend.username,
        elo: getUserModeElo(challengedFriend, category),
        gamesPlayed: getUserModeGamesPlayed(challengedFriend, category),
        isPatron: friendIsDonor,
        hasDonated: friendIsDonor,
        patronTier: challengedFriend.patronTier,
        patronExpiresAt: challengedFriend.patronExpiresAt,
        patronSubscriptionStatus: challengedFriend.patronSubscriptionStatus,
      };
    }

    try {
      const result = await createGame({
        timeControlMinutes: minutes,
        incrementSeconds: minutes === 0 ? 0 : increment,
        isRanked: isRanked && Boolean(user),
        colorPref: colorPref ?? 'random',
        isPrivate: false,
        creator,
        targetOpponent,
      });

      setChallengedFriend(null);
      setCustomGameOpen(false);
      navigate(`/game/${result.gameId}`);
    } catch (err) {
      console.error('Failed to create custom game / challenge:', err);
      const message = err instanceof Error ? err.message : String(err);
      alert(`Failed to create game: ${message}`);
    }
  };

  // Game completion handler (updates Elo and records if ranked)
  const handleGameComplete = async (finalState: BoardState) => {
    if (!activeMatch || !activeMatch.isRanked || !finalState.result) return;

    const { winner } = finalState.result;
    const outcome = winner === 'draw' ? 'draw' : winner;
    if (!outcome) return;

    const category = determineTimeCategory(
      activeMatch.timeControlMinutes || 0,
      activeMatch.incrementSeconds || 0
    );

    const whiteGames =
      activeMatch.whitePlayer.gamesPlayed ??
      (activeMatch.whitePlayer.id === user?.id && user
        ? getUserModeGamesPlayed(user, category)
        : undefined) ??
      ELO_CONFIG.defaultAssumedGamesPlayed;
    const blackGames =
      activeMatch.blackPlayer.gamesPlayed ??
      (activeMatch.blackPlayer.id === user?.id && user
        ? getUserModeGamesPlayed(user, category)
        : undefined) ??
      ELO_CONFIG.defaultAssumedGamesPlayed;

    // Calculate Elo update
    const eloResult = calculateEloUpdate(
      { rating: activeMatch.whitePlayer.elo, gamesPlayed: whiteGames },
      { rating: activeMatch.blackPlayer.elo, gamesPlayed: blackGames },
      outcome
    );

    const whiteWon = outcome === 'white' || (outcome as string) === 'blue';
    const blackWon = outcome === 'black' || (outcome as string) === 'green';
    const isDraw = outcome === 'draw';

    // Update White Player (e.g. host user)
    const updatedWhite = await updateUserStats(
      activeMatch.whitePlayer.id,
      whiteWon,
      isDraw,
      eloResult.whiteDelta,
      category
    );

    // Update Black Player (e.g. challenged friend or opponent)
    const updatedBlack = await updateUserStats(
      activeMatch.blackPlayer.id,
      blackWon,
      isDraw,
      eloResult.blackDelta,
      category
    );

    if (user && activeMatch.whitePlayer.id === user.id) {
      refreshUser(updatedWhite);
    } else if (user && activeMatch.blackPlayer.id === user.id) {
      refreshUser(updatedBlack);
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
    setActiveMatch(null);
  };

  const isMatchActive = Boolean(activeMatch) || location.pathname.startsWith('/game/');

  return (
    <div className={`app-container ${isMatchActive ? 'in-match' : ''}`}>
      <UpdateNotificationBanner isMatchActive={isMatchActive} />
      <OfflineBanner />

      {toastNotification && (
        <div className="toast-notification" role="alert" aria-live="polite">
          <span>{toastNotification}</span>
          <button
            type="button"
            className="toast-close-btn"
            onClick={() => setToastNotification(null)}
            aria-label="Dismiss notification"
          >
            &times;
          </button>
        </div>
      )}

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
          {!isNativePlatform() && <Route path="/donate" element={<DonatePage />} />}
          <Route
            path="*"
            element={
              <main className="main-app-content">
                {currentTab === 'play' ? (
                  activeMatch ? (
                    <Arena
                      key={
                        activeMatch.userColor
                          ? `match-${activeMatch.whitePlayer.id}-${activeMatch.blackPlayer.id}-${activeMatch.timeControlMinutes}-${activeMatch.incrementSeconds ?? 0}-${activeMatch.userColor}-${activeMatch.isComputer ? 'bot' : 'pvp'}`
                          : 'match-pass-and-play'
                      }
                      initialState={activeMatch.initialState}
                      whitePlayer={activeMatch.whitePlayer}
                      blackPlayer={activeMatch.blackPlayer}
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
                          onOpenCustomModal={(tab) => {
                            setChallengedFriend(null);
                            setCustomGameInitialTab(tab || 'realtime');
                            setCustomGameOpen(true);
                          }}
                          onOpenComputerModal={() => setComputerModalOpen(true)}
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
                ) : !isNativePlatform() ? (
                  <DonatePage />
                ) : null}
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
            onClose={() => {
              setCustomGameOpen(false);
              setChallengedFriend(null);
            }}
            onCreateGame={handleCreateCustom}
            initialTab={customGameInitialTab}
            challengedFriendUsername={challengedFriend?.username}
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

