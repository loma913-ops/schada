import React, { useEffect, useState, useRef } from 'react';
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
  deleteGame,
  ABANDONED_GAME_EXPIRY_MS,
  type GameRoom,
} from '@/services/firebase/gameService';
import { Arena, type ArenaPlayer } from './Arena';
import type { Move, PieceColor } from '@/core/schada/types';
import { Copy, Check, Share2, ArrowLeft, Loader2, UserCheck, Eye, Cpu } from 'lucide-react';
import { calculateEloUpdate } from '@/core/elo/eloService';
import { mockBackend } from '@/services/firebase/mockProvider';
import { setActivityContext } from '@/services/firebase/presenceService';
import { MULTIPLAYER_SCALE_CONFIG } from '@/services/firebase/multiplayerConfig';

export const GameRoomView: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [game, setGame] = useState<GameRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Guest prompt state
  const [guestName, setGuestName] = useState(
    () => localStorage.getItem('schada_guest_name') || MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultGuestName
  );
  const [guestPromptOpen, setGuestPromptOpen] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [joinedColor, setJoinedColor] = useState<PieceColor | null>(null);

  // Track if elo was updated for this game
  const eloUpdatedRef = useRef(false);

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

  // 2. Determine player identity and join
  useEffect(() => {
    if (!gameId || !game || hasJoined) return;

    const existingToken = getLocalSessionToken(gameId);
    const isAlreadySeated =
      existingToken &&
      ((game.bluePlayer && game.bluePlayer.sessionToken === existingToken) ||
        (game.greenPlayer && game.greenPlayer.sessionToken === existingToken));

    if (isAlreadySeated) {
      setHasJoined(true);
      return;
    }

    // If game has empty seat and user is not logged in and hasn't confirmed guest name yet
    if (game.status === 'waiting' && !user && !localStorage.getItem('schada_guest_confirmed')) {
      setGuestPromptOpen(true);
      return;
    }

    // Auto join with either authenticated account or confirmed guest name
    const joinUser = user
      ? { id: user.id, username: user.username, elo: user.eloRating }
      : {
          id: 'guest_' + (localStorage.getItem('schada_guest_id') || Math.random().toString(36).substring(2, 8)),
          username: guestName.trim() || MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultGuestName,
          elo: MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultGuestRating,
        };

    joinGame(gameId, joinUser).then((res) => {
      if (res.success) {
        if (res.color) {
          setJoinedColor(res.color);
        }
        setHasJoined(true);
      }
    });
  }, [gameId, game, user, hasJoined, guestName]);

  const handleConfirmGuestName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameId) return;

    const trimmed = guestName.trim() || MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultGuestName;
    localStorage.setItem('schada_guest_name', trimmed);
    localStorage.setItem('schada_guest_confirmed', 'true');
    setGuestPromptOpen(false);

    let guestId = localStorage.getItem('schada_guest_id');
    if (!guestId) {
      guestId = 'guest_' + Math.random().toString(36).substring(2, 8);
      localStorage.setItem('schada_guest_id', guestId);
    }

    joinGame(gameId, {
      id: guestId,
      username: trimmed,
      elo: MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultGuestRating,
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

  // Determine user's role and color
  const sessionToken = gameId ? getLocalSessionToken(gameId) : null;
  const isBlue = Boolean(sessionToken && game?.bluePlayer && game.bluePlayer.sessionToken === sessionToken);
  const isGreen = Boolean(sessionToken && game?.greenPlayer && game.greenPlayer.sessionToken === sessionToken);

  const userColor: PieceColor | undefined = isBlue ? 'blue' : isGreen ? 'green' : (joinedColor || undefined);
  const isSpectator = !userColor;

  // Set in-game presence context while player in an active match
  useEffect(() => {
    if (user && !isSpectator && game?.status === 'in_progress') {
      setActivityContext('in-game');
    } else {
      setActivityContext('online');
    }
    return () => {
      setActivityContext('online');
    };
  }, [user, isSpectator, game?.status]);

  // Handle game completion & ranked rating updates
  useEffect(() => {
    if (!game || !game.boardState.isGameOver || !game.isRanked || eloUpdatedRef.current) return;
    if (!user || !game.bluePlayer || !game.greenPlayer) return;

    const outcome = game.winner;
    if (!outcome) return;

    eloUpdatedRef.current = true;

    const eloResult = calculateEloUpdate(
      { rating: game.bluePlayer.elo, gamesPlayed: user.gamesPlayed || 0 },
      { rating: game.greenPlayer.elo, gamesPlayed: 20 },
      outcome
    );

    if (game.bluePlayer.id === user.id) {
      const won = outcome === 'blue';
      const isDraw = outcome === 'draw';
      mockBackend.updateStats(user.id, won, isDraw, eloResult.blueDelta);
      refreshUser();
    } else if (game.greenPlayer.id === user.id) {
      const won = outcome === 'green';
      const isDraw = outcome === 'draw';
      mockBackend.updateStats(user.id, won, isDraw, eloResult.greenDelta);
      refreshUser();
    }
  }, [game, user, refreshUser]);

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
      <div style={{ maxWidth: '480px', margin: '4rem auto', padding: '2rem', textAlign: 'center', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
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
        <p style={{ color: 'var(--text-muted, #71717a)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
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

  const bluePlayer: ArenaPlayer = game.bluePlayer
    ? { id: game.bluePlayer.id, username: game.bluePlayer.username, elo: game.bluePlayer.elo }
    : { id: 'blue', username: 'Waiting for player...', elo: MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultGuestRating };

  const greenPlayer: ArenaPlayer = game.greenPlayer
    ? { id: game.greenPlayer.id, username: game.greenPlayer.username, elo: game.greenPlayer.elo }
    : { id: 'green', username: 'Waiting for player...', elo: MULTIPLAYER_SCALE_CONFIG.matchmaking.defaultGuestRating };

  return (
    <div className="game-room-container">
      {/* Spectator or Player banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.75rem',
          padding: '0.5rem 0.75rem',
          background: isSpectator ? 'rgba(234, 179, 8, 0.1)' : 'rgba(56, 189, 248, 0.08)',
          border: `1px solid ${isSpectator ? 'rgba(234, 179, 8, 0.3)' : 'rgba(56, 189, 248, 0.2)'}`,
          borderRadius: '8px',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          {isSpectator ? (
            <>
              <Eye size={16} color="var(--accent-gold)" />
              <span>You are <strong>spectating</strong> this live game.</span>
            </>
          ) : (
            <>
              <UserCheck size={16} color="var(--accent-blue)" />
              <span>
                Playing as{' '}
                <strong style={{ color: userColor === 'blue' ? 'var(--piece-blue)' : 'var(--piece-green)' }}>
                  {userColor?.toUpperCase()}
                </strong>
              </span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={handleCopyLink}
          className="btn btn-secondary"
          style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
        >
          {copied ? <Check size={13} color="var(--accent-green)" /> : <Share2 size={13} />}
          {copied ? 'Link Copied' : 'Share Room'}
        </button>
      </div>

      {/* Main Arena */}
      <Arena
        initialState={game.boardState}
        syncedGameState={game.boardState}
        bluePlayer={bluePlayer}
        greenPlayer={greenPlayer}
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
          await makeGameMove(gameId!, move, userColor);
        }}
        onResign={async () => {
          if (!userColor || game.status === 'waiting') return;
          await resignGameAction(gameId!, userColor);
        }}
        onTimeout={async (timedOutColor) => {
          if (game.status === 'waiting') return;
          await timeoutGameAction(gameId!, timedOutColor);
        }}
        onExit={async () => {
          if (game.status === 'waiting' && gameId) {
            await abandonGame(gameId);
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
