import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  subscribeToGame,
  joinGame,
  makeGameMove,
  resignGameAction,
  timeoutGameAction,
  getLocalSessionToken,
  type GameRoom,
} from '@/services/firebase/gameService';
import { Arena, type ArenaPlayer } from './Arena';
import type { Move, PieceColor } from '@/core/schada/types';
import { Copy, Check, Share2, ArrowLeft, Loader2, UserCheck, Eye } from 'lucide-react';
import { calculateEloUpdate } from '@/core/elo/eloService';
import { mockBackend } from '@/services/firebase/mockProvider';

export const GameRoomView: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [game, setGame] = useState<GameRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Guest prompt state
  const [guestName, setGuestName] = useState(() => localStorage.getItem('schada_guest_name') || 'Guest');
  const [guestPromptOpen, setGuestPromptOpen] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);

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
          username: guestName.trim() || 'Guest',
          elo: 1200,
        };

    joinGame(gameId, joinUser).then((res) => {
      if (res.success) {
        setHasJoined(true);
      }
    });
  }, [gameId, game, user, hasJoined, guestName]);

  const handleConfirmGuestName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameId) return;

    const trimmed = guestName.trim() || 'Guest';
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
      elo: 1200,
    }).then((res) => {
      if (res.success) {
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

  const userColor: PieceColor | undefined = isBlue ? 'blue' : isGreen ? 'green' : undefined;
  const isSpectator = !userColor;

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

  // Waiting Room state
  if (game.status === 'waiting') {
    return (
      <div style={{ maxWidth: '540px', margin: '3rem auto', padding: '1.5rem' }}>
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '2rem',
            textAlign: 'center',
            boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(56, 189, 248, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
            }}
          >
            <Share2 size={28} color="var(--accent-blue)" />
          </div>

          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.4rem' }}>Waiting for Opponent</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Send this link to a friend to start the match immediately!
          </p>

          <div
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              marginBottom: '1.25rem',
            }}
          >
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '0.9rem',
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {shareableUrl}
            </span>
            <button
              type="button"
              onClick={handleCopyLink}
              className="btn btn-secondary"
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}
            >
              {copied ? <Check size={16} color="var(--accent-green)" /> : <Copy size={16} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <Loader2 size={16} className="spin" />
            <span>Waiting for player to connect...</span>
          </div>

          <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', width: '100%' }}
            >
              <ArrowLeft size={16} /> Cancel & Return to Lobby
            </button>
          </div>
        </div>
      </div>
    );
  }

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
    : { id: 'blue', username: 'Player Blue', elo: 1200 };

  const greenPlayer: ArenaPlayer = game.greenPlayer
    ? { id: game.greenPlayer.id, username: game.greenPlayer.username, elo: game.greenPlayer.elo }
    : { id: 'green', username: 'Player Green', elo: 1200 };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
      {/* Spectator or Player banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
          padding: '0.5rem 1rem',
          background: isSpectator ? 'rgba(234, 179, 8, 0.1)' : 'rgba(56, 189, 248, 0.08)',
          border: `1px solid ${isSpectator ? 'rgba(234, 179, 8, 0.3)' : 'rgba(56, 189, 248, 0.2)'}`,
          borderRadius: '8px',
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
        syncedBlueTimeMs={currentBlueTime}
        syncedGreenTimeMs={currentGreenTime}
        onMakeMove={async (move: Move) => {
          if (!userColor) return;
          await makeGameMove(gameId!, move, userColor);
        }}
        onResign={async () => {
          if (!userColor) return;
          await resignGameAction(gameId!, userColor);
        }}
        onTimeout={async (timedOutColor) => {
          await timeoutGameAction(gameId!, timedOutColor);
        }}
        onExit={() => navigate('/')}
      />

      {/* Guest Name Confirmation Modal */}
      {guestPromptOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '400px', width: '90%' }}>
            <h3 style={{ margin: '0 0 0.5rem' }}>Join Game</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Choose a display name for this game:
            </p>
            <form onSubmit={handleConfirmGuestName}>
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                maxLength={20}
                placeholder="Enter your name"
                className="input-field"
                style={{ width: '100%', marginBottom: '1rem', padding: '0.65rem' }}
                autoFocus
              />
              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.75rem' }}
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
