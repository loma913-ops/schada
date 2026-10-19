import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Arena, type ArenaPlayer } from '../Arena';
import { createInitialGameState } from '@/core/schada/engine';
import { GamePreferencesProvider } from '@/context/GamePreferencesContext';

vi.mock('@/services/audio/soundService', () => ({
  soundService: {
    playMove: vi.fn(),
    playCapture: vi.fn(),
    playVictory: vi.fn(),
    playDefeat: vi.fn(),
    getMuted: vi.fn(() => false),
    setMuted: vi.fn(),
    toggleMute: vi.fn(),
  },
}));

vi.mock('@/core/bot/schadaBot', () => ({
  getBotThinkingDelayMs: vi.fn(() => 500),
  getBotTier: vi.fn(() => ({ name: 'Casual', level: 1 })),
  botWorkerClient: {
    requestMove: vi.fn(),
    terminate: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
  BOT_ENGINE_CONFIG: {
    timeManagement: {
      defaultMatchMinutes: 5,
    },
  },
}));

describe('Arena Match Header Time Limit Display', () => {
  const mockwhitePlayer: ArenaPlayer = {
    id: 'user_blue',
    username: 'BlueHero',
    elo: 1500,
  };

  const mockblackPlayer: ArenaPlayer = {
    id: 'user_green',
    username: 'GreenRival',
    elo: 1480,
  };

  const initialBoard = createInitialGameState();

  it('renders 2d instead of 2880+0 for 2-day correspondence matches', () => {
    const html = renderToStaticMarkup(
      <GamePreferencesProvider>
        <Arena
          initialState={initialBoard}
          whitePlayer={mockwhitePlayer}
          blackPlayer={mockblackPlayer}
          timeControlMinutes={2880}
          incrementSeconds={0}
          isRanked={false}
          onExit={vi.fn()}
        />
      </GamePreferencesProvider>
    );

    expect(html).toContain('2d •');
    expect(html).not.toContain('2880+0');
  });

  it('renders 1d for 1-day correspondence matches', () => {
    const html = renderToStaticMarkup(
      <GamePreferencesProvider>
        <Arena
          initialState={initialBoard}
          whitePlayer={mockwhitePlayer}
          blackPlayer={mockblackPlayer}
          timeControlMinutes={1440}
          incrementSeconds={0}
          isRanked={false}
          onExit={vi.fn()}
        />
      </GamePreferencesProvider>
    );

    expect(html).toContain('1d •');
    expect(html).not.toContain('1440+0');
  });

  it('renders standard time controls like 10+0 and 3+2 properly', () => {
    const htmlRapid = renderToStaticMarkup(
      <GamePreferencesProvider>
        <Arena
          initialState={initialBoard}
          whitePlayer={mockwhitePlayer}
          blackPlayer={mockblackPlayer}
          timeControlMinutes={10}
          incrementSeconds={0}
          isRanked={false}
          onExit={vi.fn()}
        />
      </GamePreferencesProvider>
    );
    expect(htmlRapid).toContain('10+0 •');

    const htmlBlitz = renderToStaticMarkup(
      <GamePreferencesProvider>
        <Arena
          initialState={initialBoard}
          whitePlayer={mockwhitePlayer}
          blackPlayer={mockblackPlayer}
          timeControlMinutes={3}
          incrementSeconds={2}
          isRanked={false}
          onExit={vi.fn()}
        />
      </GamePreferencesProvider>
    );
    expect(htmlBlitz).toContain('3+2 •');
  });

  it('renders infinity symbol for unlimited matches', () => {
    const htmlUnlimited = renderToStaticMarkup(
      <GamePreferencesProvider>
        <Arena
          initialState={initialBoard}
          whitePlayer={mockwhitePlayer}
          blackPlayer={mockblackPlayer}
          timeControlMinutes={0}
          incrementSeconds={0}
          isRanked={false}
          onExit={vi.fn()}
        />
      </GamePreferencesProvider>
    );
    expect(htmlUnlimited).toContain('∞ •');
  });

  it('renders Analyze button when game is over and in review mode', () => {
    const finishedGameState = {
      ...initialBoard,
      isGameOver: true,
      result: {
        winner: 'white' as const,
        winReason: 'goal_reached' as const,
        whiteScore: { goalScore: 2, outsideGoalHighPiecesScore: 0, rankDistanceScore: 0, totalScore: 2 },
        blackScore: { goalScore: 0, outsideGoalHighPiecesScore: 0, rankDistanceScore: 0, totalScore: 0 },
      },
    };

    const onAnalyze = vi.fn();
    const htmlFinished = renderToStaticMarkup(
      <GamePreferencesProvider>
        <Arena
          initialState={finishedGameState}
          whitePlayer={mockwhitePlayer}
          blackPlayer={mockblackPlayer}
          timeControlMinutes={5}
          incrementSeconds={0}
          isRanked={false}
          initialReviewMode={true}
          onAnalyze={onAnalyze}
          onExit={vi.fn()}
        />
      </GamePreferencesProvider>
    );

    expect(htmlFinished).toContain('move-history-analyze-btn');
    expect(htmlFinished).toContain('Analyze');
  });

  it('renders turn indicator with arena-turn-indicator class on white turn', () => {
    const html = renderToStaticMarkup(
      <GamePreferencesProvider>
        <Arena
          initialState={initialBoard}
          whitePlayer={mockwhitePlayer}
          blackPlayer={mockblackPlayer}
          timeControlMinutes={5}
          incrementSeconds={0}
          isRanked={false}
          onExit={vi.fn()}
        />
      </GamePreferencesProvider>
    );

    expect(html).toContain('Turn: <strong class="arena-turn-indicator">WHITE</strong>');
  });

  it('renders turn indicator with arena-turn-indicator class on black turn', () => {
    const blackTurnState = {
      ...initialBoard,
      currentTurn: 'black' as const,
    };

    const html = renderToStaticMarkup(
      <GamePreferencesProvider>
        <Arena
          initialState={blackTurnState}
          whitePlayer={mockwhitePlayer}
          blackPlayer={mockblackPlayer}
          timeControlMinutes={5}
          incrementSeconds={0}
          isRanked={false}
          onExit={vi.fn()}
        />
      </GamePreferencesProvider>
    );

    expect(html).toContain('Turn: <strong class="arena-turn-indicator">BLACK</strong>');
  });
});
