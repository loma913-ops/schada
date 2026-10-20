import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AnalysisRoomView } from '../AnalysisRoomView';
import type { GameRoom } from '@/services/firebase/gameTypes';

const mockNavigate = vi.fn();
let mockParams: Record<string, string | undefined> = {};
let mockLocationState: any = {};

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
  useLocation: () => ({ pathname: '/analysis/game_123', state: mockLocationState }),
}));

vi.mock('../Arena', () => ({
  Arena: (props: any) => (
    <div
      data-testid="arena-mock"
      data-spectator={String(props.isSpectator)}
      data-review={String(props.initialReviewMode)}
    >
      {props.whitePlayer?.username} vs {props.blackPlayer?.username}
    </div>
  ),
}));

const mockGetGameById = vi.fn();
vi.mock('@/services/firebase/gameService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/firebase/gameService')>();
  return {
    ...actual,
    getGameById: (...args: any[]) => mockGetGameById(...args),
  };
});

describe('AnalysisRoomView Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams = { gameId: 'game_123' };
    mockLocationState = {};
  });

  const mockGame: GameRoom = {
    id: 'game_123',
    hostId: 'usr_white',
    whitePlayer: { id: 'usr_white', username: 'WhitePlayer', elo: 1550 },
    blackPlayer: { id: 'usr_black', username: 'BlackPlayer', elo: 1530 },
    status: 'completed',
    boardState: {
      board: [],
      currentTurn: 'white',
      moveHistory: [],
      pliesWithoutPawnOrCapture: 0,
      stateHistory: [],
    } as any,
    mode: 'rapid',
    timeControlMinutes: 10,
    incrementSeconds: 0,
    playerIds: ['usr_white', 'usr_black'],
    isRanked: true,
    isComputer: false,
    winner: 'white',
    winReason: 'goal_reached',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  it('renders Arena immediately with initialReviewMode and isSpectator when game is in location state', () => {
    mockLocationState = { game: mockGame };

    const html = renderToStaticMarkup(<AnalysisRoomView />);

    expect(html).toContain('data-testid="arena-mock"');
    expect(html).toContain('data-spectator="true"');
    expect(html).toContain('data-review="true"');
    expect(html).toContain('WhitePlayer vs BlackPlayer');
    // Ensure 0 database reads occurred
    expect(mockGetGameById).not.toHaveBeenCalled();
  });

  it('renders error state when gameId is missing', () => {
    mockParams = { gameId: undefined };

    const html = renderToStaticMarkup(<AnalysisRoomView />);

    expect(html).toContain('Analysis Unavailable');
    expect(html).toContain('Game ID is required');
  });

  it('renders loading state when game is not preloaded in location state', () => {
    mockLocationState = {};
    mockGetGameById.mockReturnValue(new Promise(() => {})); // pending

    const html = renderToStaticMarkup(<AnalysisRoomView />);

    expect(html).toContain('Loading game record for analysis...');
  });
});
