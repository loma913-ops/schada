import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GameRoomView } from '../GameRoomView';
import type { GameRoom } from '@/services/firebase/gameTypes';

const mockNavigate = vi.fn();
let mockParams: Record<string, string | undefined> = {};

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
}));

vi.mock('../Arena', () => ({
  Arena: () => <div data-testid="arena-mock" />,
}));

const mockUseAuth = vi.fn();
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockSubscribeToGame = vi.fn();
const mockAbandonGame = vi.fn();
vi.mock('@/services/firebase/gameService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/firebase/gameService')>();
  return {
    ...actual,
    subscribeToGame: (gameId: string, onUpdate: (game: any) => void) => mockSubscribeToGame(gameId, onUpdate),
    abandonGame: (gameId: string) => mockAbandonGame(gameId),
    getLocalSessionToken: () => 'token_123',
    setLocalSessionToken: vi.fn(),
  };
});

describe('GameRoomView Component - Waiting Room Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams = { gameId: 'T53sMu6vc' };
    mockUseAuth.mockReturnValue({
      user: {
        id: 'usr_host',
        username: 'Boogerd1936',
        perModeStats: {
          blitz: { elo: 1500, gamesPlayed: 10, gamesWon: 5, gamesLost: 5, gamesDrawn: 0 },
        },
      },
      isLoading: false,
      refreshUser: vi.fn(),
    });
  });

  const waitingGame: GameRoom = {
    id: 'T53sMu6vc',
    hostId: 'usr_host',
    whitePlayer: { id: 'usr_host', username: 'Boogerd1936', elo: 1500, sessionToken: 'token_123' },
    blackPlayer: null,
    status: 'waiting',
    boardState: {
      board: [],
      currentTurn: 'white',
      moveHistory: [],
      pliesWithoutPawnOrCapture: 0,
      stateHistory: [],
    } as any,
    mode: 'blitz',
    timeControlMinutes: 5,
    incrementSeconds: 3,
    playerIds: ['usr_host'],
    isRanked: false,
    isComputer: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  it('renders "Return to Lobby" on the left and "Cancel" on the right instead of "Cancel & Return to Lobby"', () => {
    mockSubscribeToGame.mockImplementation(() => () => {});

    const html = renderToStaticMarkup(<GameRoomView initialGame={waitingGame} />);

    // Old combined button should not exist
    expect(html).not.toContain('Cancel &amp; Return to Lobby');
    expect(html).not.toContain('Cancel & Return to Lobby');

    // Both new buttons must be rendered
    expect(html).toContain('Return to Lobby');
    expect(html).toContain('Cancel');

    // "Return to Lobby" must appear before "Cancel" in DOM ordering (left button first)
    const returnIndex = html.indexOf('Return to Lobby');
    const cancelIndex = html.indexOf('Cancel');
    expect(returnIndex).toBeGreaterThan(-1);
    expect(cancelIndex).toBeGreaterThan(-1);
    expect(returnIndex).toBeLessThan(cancelIndex);

    // Cancel button must have standardized red styling via btn-danger
    expect(html).toContain('btn-danger');
  });
});
