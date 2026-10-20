import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getGameById, type GameRoom } from '@/services/firebase/gameService';
import { Arena } from './Arena';
import { Loader2, ArrowLeft, ShieldAlert } from 'lucide-react';
import { CANONICAL_MATCH_HISTORY_CONFIG } from '@/components/history/matchHistoryConfig';
import { ELO_CONFIG } from '@/core/elo/eloConfig';

interface AnalysisRoomViewProps {
  initialGame?: GameRoom | null;
}

export const AnalysisRoomView: React.FC<AnalysisRoomViewProps> = ({ initialGame }) => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [game, setGame] = useState<GameRoom | null>(() => {
    if (initialGame !== undefined) return initialGame;
    const passedGame = (location.state as { game?: GameRoom })?.game;
    if (passedGame && passedGame.id === gameId) {
      return passedGame;
    }
    return null;
  });

  const [error, setError] = useState<string | null>(() =>
    !gameId && !initialGame ? 'Game ID is required for analysis.' : null
  );

  const [loading, setLoading] = useState<boolean>(() =>
    Boolean(gameId && !game && !error)
  );

  useEffect(() => {
    // If game was passed via router navigation state or prop, 0 database reads required
    if (game && (game.id === gameId || initialGame)) return;

    if (!gameId) {
      setError('Game ID is required for analysis.');
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    getGameById(gameId)
      .then((loadedGame) => {
        if (!isMounted) return;
        if (loadedGame) {
          setGame(loadedGame);
        } else {
          setError('Match record not found. The game may have expired or been deleted.');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Failed to load game for analysis:', err);
        setError('Failed to load match record for analysis.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [gameId, game, initialGame]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '80vh',
          gap: '1rem',
          color: 'var(--text-muted)',
        }}
      >
        <Loader2 size={36} className="spin" color="var(--accent-gold)" />
        <span style={{ fontSize: '0.95rem' }}>Loading game record for analysis...</span>
      </div>
    );
  }

  if (error || !game || !game.boardState) {
    return (
      <div
        style={{
          maxWidth: '480px',
          margin: '4rem auto',
          padding: '2rem',
          backgroundColor: 'var(--bg-tertiary)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          textAlign: 'center',
        }}
      >
        <ShieldAlert size={40} color="var(--accent-red)" style={{ margin: '0 auto 1rem auto' }} />
        <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
          Analysis Unavailable
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.45 }}>
          {error || 'Unable to retrieve game state for move-by-move analysis.'}
        </p>
        <button
          type="button"
          className="btn-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            margin: '0 auto',
          }}
          onClick={() => navigate(CANONICAL_MATCH_HISTORY_CONFIG.routes.matches)}
        >
          <ArrowLeft size={16} />
          <span>{CANONICAL_MATCH_HISTORY_CONFIG.copy.returnToLobbyText}</span>
        </button>
      </div>
    );
  }

  const whiteEloUpdate =
    game.whiteElo ||
    (game.eloResult
      ? {
          newElo: game.eloResult.newWhiteElo,
          delta: game.eloResult.whiteDelta,
        }
      : undefined);

  const blackEloUpdate =
    game.blackElo ||
    (game.eloResult
      ? {
          newElo: game.eloResult.newBlackElo,
          delta: game.eloResult.blackDelta,
        }
      : undefined);

  return (
    <Arena
      initialState={game.boardState}
      syncedGameState={game.boardState}
      whitePlayer={{
        id: game.whitePlayer?.id || 'white',
        username: game.whitePlayer?.username || 'White',
        elo: game.whitePlayer?.elo ?? ELO_CONFIG.defaultStartingRating,
        isPatron: game.whitePlayer?.isPatron,
      }}
      blackPlayer={{
        id: game.blackPlayer?.id || 'black',
        username: game.blackPlayer?.username || 'Black',
        elo: game.blackPlayer?.elo ?? ELO_CONFIG.defaultStartingRating,
        isPatron: game.blackPlayer?.isPatron,
      }}
      whiteElo={whiteEloUpdate}
      blackElo={blackEloUpdate}
      timeControlMinutes={game.timeControlMinutes || 0}
      incrementSeconds={game.incrementSeconds || 0}
      isRanked={game.isRanked}
      isComputer={game.isComputer}
      botLevel={game.botLevel}
      isSpectator={true}
      initialReviewMode={true}
      onExit={() => navigate(-1)}
    />
  );
};
