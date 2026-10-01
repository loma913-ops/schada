import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  subscribeToGame,
  joinGame,
  makeGameMove,
  resignGameAction,
  timeoutGameAction,
  abandonGame,
  getLocalSessionToken,
  setLocalSessionToken,
  deleteGame,
  isGameTimedOut,
  markGameEloProcessed,
  computeRankedGameEloResult,
  ABANDONED_GAME_EXPIRY_MS,
  type GameRoom,
} from '@/services/firebase/gameService';
import { Arena, type ArenaPlayer } from './Arena';
import type { PlayerEloUpdate } from './GameOverModal';
import type { BoardState, Move, PieceColor } from '@/core/schada/types';
import { Copy, Check, ArrowLeft, Loader2, Cpu } from 'lucide-react';
import { ELO_CONFIG } from '@/core/elo/eloConfig';
import { updateUserStats } from '@/services/firebase/authService';
import { setActivityContext } from '@/services/firebase/presenceService';
import { MULTIPLAYER_SCALE_CONFIG } from '@/services/firebase/multiplayerConfig';
import { safeSetItem } from '@/services/storage/storageCleanup';
import { PatronBadge, isPatronUser } from '@/components/common/PatronBadge';

export const GameRoomView: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const { user, isLoading: authLoading, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [game, setGame] = useState<GameRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Guest prompt state
  const [guestName, setGuestName] = useState(
    () =>
      (typeof localStorage !== 'undefined'
        ? localStorage.getItem(MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.guestName)
        : null) || MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultGuestName
  );
  const [guestPromptOpen, setGuestPromptOpen] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [joinedColor, setJoinedColor] = useState<PieceColor | null>(null);

  // Track if elo was updated for this game
  const eloUpdatedRef = useRef(false);
  const eloUpdatePromiseRef = useRef<Promise<void> | null>(null);

  // 1. Subscribe to real-time game updates
  useEffect(() => {
    if (!gameId) return;

    setLoading(true);
    const unsubscribe = subscribeToGame(
      gameId,
      (updatedGame) => {
        setLoading(false);
        if (!updatedGame) {
          setError('This game room does not exist or has expired.');
        } else {
          setError(null);
          setGame(updatedGame);
        }
      },
      (err) => {
        setLoading(false);
        setError(err.message || 'Failed to connect to game room.');
      }
    );

    return () => unsubscribe();
  }, [gameId]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Auto-cleanup timer if viewing an abandoned game when the 10 minutes elapse
  useEffect(() => {
    if (!game || game.status !== 'abandoned' || !gameId) return;

    const abandonedTime = game.abandonedAt || game.createdAt;
    const elapsed = Date.now() - abandonedTime;
    const remainingMs = Math.max(0, ABANDONED_GAME_EXPIRY_MS - elapsed);

    const timer = setTimeout(async () => {
      await deleteGame(gameId);
    }, remainingMs);

    return () => clearTimeout(timer);
  }, [game, gameId]);

  // Auto-resolve if viewing an in-progress game whose time limit has expired
  useEffect(() => {
    if (!gameId || !game) return;
    const timeoutCheck = isGameTimedOut(game);
    if (timeoutCheck.timedOut && timeoutCheck.timedOutColor) {
      timeoutGameAction(gameId, timeoutCheck.timedOutColor).catch((err) => {
        console.warn('Failed to auto-timeout expired game:', err);
      });
    }
  }, [game, gameId]);

  // 2. Determine player identity and join
  useEffect(() => {
    if (!gameId || !game || hasJoined || authLoading) return;

    const existingToken = getLocalSessionToken(gameId);
    const guestIdKey = MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.guestId;
    const guestId = typeof localStorage !== 'undefined' ? localStorage.getItem(guestIdKey) : null;

    const isAlreadySeated = Boolean(
      (existingToken &&
        ((game.bluePlayer && game.bluePlayer.sessionToken === existingToken) ||
          (game.greenPlayer && game.greenPlayer.sessionToken === existingToken))) ||
      (user &&
        ((game.bluePlayer && game.bluePlayer.id === user.id) ||
          (game.greenPlayer && game.greenPlayer.id === user.id))) ||
      (guestId &&
        ((game.bluePlayer && game.bluePlayer.id === guestId) ||
          (game.greenPlayer && game.greenPlayer.id === guestId)))
    );

    if (isAlreadySeated) {
      if (user && game.bluePlayer?.id === user.id && game.bluePlayer.sessionToken) {
        setLocalSessionToken(gameId, game.bluePlayer.sessionToken);
      } else if (user && game.greenPlayer?.id === user.id && game.greenPlayer.sessionToken) {
        setLocalSessionToken(gameId, game.greenPlayer.sessionToken);
      }
      setHasJoined(true);
      return;
    }

    // If game has empty seat and user is not logged in and hasn't confirmed guest name yet
    const guestConfirmedKey = MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.guestConfirmed;
    if (game.status === 'waiting' && !user && !localStorage.getItem(guestConfirmedKey)) {
      setGuestPromptOpen(true);
      return;
    }

    const isDonor = isPatronUser(user);

    // Auto join with either authenticated account or confirmed guest name
    const joinUser = user
      ? {
        id: user.id,
        username: user.username,
        elo: user.eloRating,
        gamesPlayed: user.gamesPlayed,
        isPatron: isDonor,
        hasDonated: isDonor,
        patronTier: user.patronTier,
        patronExpiresAt: user.patronExpiresAt,
        patronSubscriptionStatus: user.patronSubscriptionStatus,
      }
      : {
        id: 'guest_' + (guestId || Math.random().toString(36).substring(2, 8)),
        username: guestName.trim() || MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultGuestName,
        elo: MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultGuestRating,
        gamesPlayed: ELO_CONFIG.defaultAssumedGamesPlayed,
        isPatron: false,
        hasDonated: false,
      };

    joinGame(gameId, joinUser).then((res) => {
      if (res.success) {
        if (res.color) {
          setJoinedColor(res.color);
        }
        setHasJoined(true);
      }
    });
  }, [gameId, game, user, hasJoined, guestName, authLoading]);

  const handleConfirmGuestName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameId) return;

    const trimmed = guestName.trim() || MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultGuestName;
    const { guestName: guestNameKey, guestConfirmed: guestConfirmedKey, guestId: guestIdKey } =
      MULTIPLAYER_SCALE_CONFIG.presence.storageKeys;
    safeSetItem(guestNameKey, trimmed);
    safeSetItem(guestConfirmedKey, 'true');
    setGuestPromptOpen(false);

    let guestId = localStorage.getItem(guestIdKey);
    if (!guestId) {
      guestId = 'guest_' + Math.random().toString(36).substring(2, 8);
      safeSetItem(guestIdKey, guestId);
    }

    joinGame(gameId, {
      id: guestId,
      username: trimmed,
      elo: MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultGuestRating,
      gamesPlayed: ELO_CONFIG.defaultAssumedGamesPlayed,
      isPatron: false,
      hasDonated: false,
    }).then((res) => {
      if (res.success) {
        if (res.color) {
          setJoinedColor(res.color);
        }
        setHasJoined(true);
      }
    });
  };

  const shareableUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareableUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Determine user's role and color with multi-tier identification:
  // 1. Session token in localStorage
  // 2. Authenticated user ID match
  // 3. Persistent guest ID match
  const sessionToken = gameId ? getLocalSessionToken(gameId) : null;
  const guestId =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem(MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.guestId)
      : null;

  // Determine user's role and color:
  // For authenticated users, identity is strictly determined by user.id
  // For guests, fallback to session token or guest ID
  const isBlue = user
    ? Boolean(game?.bluePlayer && game.bluePlayer.id === user.id)
    : Boolean(
      (sessionToken && game?.bluePlayer && game.bluePlayer.sessionToken === sessionToken) ||
      (guestId && game?.bluePlayer && game.bluePlayer.id === guestId)
    );
  const isGreen = user
    ? Boolean(game?.greenPlayer && game.greenPlayer.id === user.id)
    : Boolean(
      (sessionToken && game?.greenPlayer && game.greenPlayer.sessionToken === sessionToken) ||
      (guestId && game?.greenPlayer && game.greenPlayer.id === guestId)
    );

  // Maintain local session token synchronization if seated player token exists in room document
  useEffect(() => {
    if (!gameId) return;
    if (isBlue && game?.bluePlayer?.sessionToken && sessionToken !== game.bluePlayer.sessionToken) {
      setLocalSessionToken(gameId, game.bluePlayer.sessionToken);
    } else if (isGreen && game?.greenPlayer?.sessionToken && sessionToken !== game.greenPlayer.sessionToken) {
      setLocalSessionToken(gameId, game.greenPlayer.sessionToken);
    }
  }, [gameId, isBlue, isGreen, game?.bluePlayer?.sessionToken, game?.greenPlayer?.sessionToken, sessionToken]);

  const userColor: PieceColor | undefined = isBlue ? 'blue' : isGreen ? 'green' : (joinedColor || undefined);
  const isSpectator = !userColor;

  // Set in-game presence context while player in an active match
  const userId = user?.id;
  useEffect(() => {
    if (userId && !isSpectator && game?.status === 'in_progress') {
      setActivityContext('in-game');
    } else {
      setActivityContext('online');
    }
  }, [userId, isSpectator, game?.status]);

  // Clean up activity context on component unmount
  useEffect(() => {
    return () => {
      setActivityContext('online');
    };
  }, []);

  // Handle game completion & ranked rating updates
  const applyUserEloUpdates = useCallback(
    async (completedGameState?: BoardState): Promise<void> => {
      if (!game || eloUpdatedRef.current || !user || !gameId) return;
      if (game.processedEloUserIds?.includes(user.id)) return;

      const isGameOver = completedGameState?.isGameOver || game.boardState.isGameOver;
      const outcome = completedGameState?.result?.winner || game.winner;
      if (!isGameOver || !outcome) return;

      // Player identity is strictly determined by user.id matching the seated player
      const isUserBlue = game.bluePlayer?.id === user.id;
      const isUserGreen = game.greenPlayer?.id === user.id;

      if (!isUserBlue && !isUserGreen) return;

      eloUpdatedRef.current = true;

      const myColor: PieceColor = isUserBlue ? 'blue' : 'green';
      const won = outcome === myColor;
      const isDraw = outcome === 'draw';

      let delta = 0;
      if (game.isRanked && game.bluePlayer && game.greenPlayer) {
        const eloRes = game.eloResult || computeRankedGameEloResult(game, outcome);
        if (eloRes) {
          delta = myColor === 'blue' ? eloRes.blueDelta : eloRes.greenDelta;
        }
      }

      const updatePromise = (async () => {
        try {
          const updatedProfile = await updateUserStats(user.id, won, isDraw, delta);
          if (updatedProfile) {
            refreshUser(updatedProfile);
          }
          await markGameEloProcessed(gameId, user.id);
        } catch (err) {
          console.error('Failed to update stats on game completion:', err);
          eloUpdatedRef.current = false;
        }
      })();

      eloUpdatePromiseRef.current = updatePromise;
      await updatePromise;
    },
    [game, user, gameId, refreshUser]
  );

  useEffect(() => {
    if (!game || !game.boardState.isGameOver || eloUpdatedRef.current) return;
    if (!user) return;
    if (game.processedEloUserIds?.includes(user.id)) return;

    applyUserEloUpdates();
  }, [game, user, applyUserEloUpdates]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}>
        <Loader2 size={36} className="spin" color="var(--accent-blue)" />
        <div style={{ color: 'var(--text-secondary)' }}>Connecting to game room...</div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div style={{ maxWidth: '480px', margin: '4rem auto', padding: '2rem', textAlign: 'center', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
        <h3 style={{ margin: '0 0 1rem', color: 'var(--piece-green)' }}>Game Not Found</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          {error || 'Unable to load game room.'}
        </p>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>
          Return to Lobby
        </button>
      </div>
    );
  }

  // Abandoned state
  if (game.status === 'abandoned') {
    return (
      <div style={{ maxWidth: '480px', margin: '4rem auto', padding: '2rem', textAlign: 'center', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
        <h3 style={{ margin: '0 0 1rem', color: 'var(--accent-red)' }}>Game Abandoned</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
          This match was abandoned by the host.
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          Abandoned games are automatically removed after {Math.round(ABANDONED_GAME_EXPIRY_MS / 60000)} minutes.
        </p>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>
          Return to Lobby
        </button>
      </div>
    );
  }

  const handlePlayAgainstComputer = async () => {
    if (gameId) {
      await abandonGame(gameId);
    }
    window.scrollTo(0, 0);
    navigate('/', {
      state: {
        openComputerModal: true,
        timeControlMinutes: game?.timeControlMinutes,
        incrementSeconds: game?.incrementSeconds,
        userColor: userColor || 'random',
      },
    });
  };

  const handleCancelAndReturn = async () => {
    if (gameId) {
      await abandonGame(gameId);
    }
    window.scrollTo(0, 0);
    navigate('/');
  };

  // Compute live synchronized clocks
  const now = Date.now();
  const elapsed = game.lastTurnStartTimeMs && game.status === 'in_progress' ? Math.max(0, now - game.lastTurnStartTimeMs) : 0;
  const currentBlueTime =
    game.currentTurn === 'blue' && game.status === 'in_progress'
      ? Math.max(0, game.blueTimeMs - elapsed)
      : game.blueTimeMs;
  const currentGreenTime =
    game.currentTurn === 'green' && game.status === 'in_progress'
      ? Math.max(0, game.greenTimeMs - elapsed)
      : game.greenTimeMs;

  const eloResult = game.eloResult || (game.isRanked && game.winner && game.bluePlayer && game.greenPlayer
    ? computeRankedGameEloResult(game, game.winner)
    : null);

  const blueElo: PlayerEloUpdate | undefined = eloResult
    ? { newElo: eloResult.newBlueElo, delta: eloResult.blueDelta }
    : undefined;
  const greenElo: PlayerEloUpdate | undefined = eloResult
    ? { newElo: eloResult.newGreenElo, delta: eloResult.greenDelta }
    : undefined;

  const blueGames = typeof game.bluePlayer?.gamesPlayed === 'number'
    ? game.bluePlayer.gamesPlayed
    : (game.bluePlayer?.id === user?.id && typeof user?.gamesPlayed === 'number' ? user.gamesPlayed : 0);

  const greenGames = typeof game.greenPlayer?.gamesPlayed === 'number'
    ? game.greenPlayer.gamesPlayed
    : (game.greenPlayer?.id === user?.id && typeof user?.gamesPlayed === 'number' ? user.gamesPlayed : 0);

  const bluePlayer: ArenaPlayer = game.bluePlayer
    ? {
      id: game.bluePlayer.id,
      username: game.bluePlayer.username,
      elo: eloResult?.initialBlueElo ?? (game.eloResult ? (game.bluePlayer.elo - game.eloResult.blueDelta) : game.bluePlayer.elo),
      gamesPlayed: blueGames,
      isPatron: isPatronUser(game.bluePlayer),
      hasDonated: Boolean(game.bluePlayer.hasDonated || game.bluePlayer.isPatron),
      patronTier: game.bluePlayer.patronTier,
      patronExpiresAt: game.bluePlayer.patronExpiresAt,
      patronSubscriptionStatus: game.bluePlayer.patronSubscriptionStatus,
    }
    : { id: 'blue', username: 'Waiting for player...', elo: MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultGuestRating };

  const greenPlayer: ArenaPlayer = game.greenPlayer
    ? {
      id: game.greenPlayer.id,
      username: game.greenPlayer.username,
      elo: eloResult?.initialGreenElo ?? (game.eloResult ? (game.greenPlayer.elo - game.eloResult.greenDelta) : game.greenPlayer.elo),
      gamesPlayed: greenGames,
      isPatron: isPatronUser(game.greenPlayer),
      hasDonated: Boolean(game.greenPlayer.hasDonated || game.greenPlayer.isPatron),
      patronTier: game.greenPlayer.patronTier,
      patronExpiresAt: game.greenPlayer.patronExpiresAt,
      patronSubscriptionStatus: game.greenPlayer.patronSubscriptionStatus,
    }
    : { id: 'green', username: 'Waiting for player...', elo: MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultGuestRating };

  const host = game.bluePlayer || game.greenPlayer;

  return (
    <div className="game-room-container">

      {/* Main Arena */}
      <Arena
        initialState={game.boardState}
        syncedGameState={game.boardState}
        bluePlayer={bluePlayer}
        greenPlayer={greenPlayer}
        blueElo={blueElo}
        greenElo={greenElo}
        timeControlMinutes={game.timeControlMinutes}
        incrementSeconds={game.incrementSeconds}
        isRanked={game.isRanked}
        userColor={userColor}
        isSpectator={isSpectator}
        isWaiting={game.status === 'waiting'}
        syncedBlueTimeMs={currentBlueTime}
        syncedGreenTimeMs={currentGreenTime}
        onMakeMove={async (move: Move) => {
          if (!userColor || game.status === 'waiting') return;
          try {
            await makeGameMove(gameId!, move, userColor, game);
          } catch (err) {
            console.error('Failed to make move:', err);
          }
        }}
        onResign={async () => {
          if (!userColor || game.status === 'waiting') return;
          try {
            eloUpdatedRef.current = true;
            const updated = await resignGameAction(gameId!, userColor);
            if (updated) {
              refreshUser(updated);
            }
          } catch (err) {
            console.error('Failed to resign game:', err);
            eloUpdatedRef.current = false;
          }
        }}
        onTimeout={async (timedOutColor) => {
          if (game.status === 'waiting') return;
          try {
            eloUpdatedRef.current = true;
            const updated = await timeoutGameAction(gameId!, timedOutColor);
            if (updated) {
              refreshUser(updated);
            }
          } catch (err) {
            console.error('Failed to timeout game:', err);
            eloUpdatedRef.current = false;
          }
        }}
        onGameComplete={(completedState) => {
          applyUserEloUpdates(completedState);
        }}
        onExit={async () => {
          const isGameOver = Boolean(game.boardState.isGameOver || game.status === 'completed');
          if (game.status === 'waiting' && gameId) {
            await abandonGame(gameId);
          } else if (isGameOver) {
            // Await any in-flight or pending Elo update before unmounting
            if (eloUpdatePromiseRef.current) {
              await eloUpdatePromiseRef.current;
            } else if (!eloUpdatedRef.current) {
              await applyUserEloUpdates();
            }
          } else if (game.status === 'in_progress' && userColor && !isSpectator && gameId) {
            const updated = await resignGameAction(gameId, userColor);
            if (updated) {
              refreshUser(updated);
            }
          }
          navigate('/');
        }}
      />

      {/* Waiting for Opponent Overlay */}
      {game.status === 'waiting' && (
        <div className="waiting-modal-overlay">
          <div className="waiting-modal-card">
            <div className="waiting-status-badge">
              <Loader2 size={16} className="spin" color="var(--accent-gold)" />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                Awaiting connection
              </span>
            </div>

            <h2
              style={{
                fontSize: '1.35rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: '0 0 0.5rem',
              }}
            >
              Waiting for other player to join.
            </h2>

            {host?.username && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                Host:{' '}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  {host.username}
                  {isPatronUser(host) && <PatronBadge size={13} />}
                </span>
              </p>
            )}

            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem', lineHeight: '1.4' }}>
              Share this invite link with another player, or play against the computer now.
            </p>

            {/* Room Link & Copy */}
            <div className="waiting-room-link-box">
              <span className="waiting-room-link-text">
                {shareableUrl}
              </span>
              <button
                type="button"
                className="action-btn"
                style={{ padding: '0.35rem 0.65rem', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                onClick={handleCopyLink}
              >
                {copied ? <Check size={14} color="var(--accent-green)" /> : <Copy size={14} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={handlePlayAgainstComputer}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  width: '100%',
                  padding: '0.8rem 1.25rem',
                  fontSize: '1rem',
                  fontWeight: 600,
                }}
              >
                <Cpu size={18} />
                <span>Play Against Computer</span>
              </button>

              <button
                type="button"
                className="action-btn"
                onClick={handleCancelAndReturn}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  width: '100%',
                  padding: '0.65rem 1rem',
                  fontSize: '0.9rem',
                }}
              >
                <ArrowLeft size={16} />
                <span>Cancel & Return to Lobby</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guest Name Confirmation Modal */}
      {guestPromptOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px', width: '90%' }}>
            <div className="modal-header">
              <h2 className="modal-title">Join Game</h2>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Choose a display name for this game:
            </p>
            <form onSubmit={handleConfirmGuestName}>
              <div className="form-group">
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  maxLength={20}
                  placeholder="Enter your name"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.8rem',
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontFamily: 'inherit',
                  }}
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="btn-primary"
                style={{ width: '100%', padding: '0.65rem', marginTop: '0.5rem' }}
              >
                Join as Player
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
