import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MatchHistoryView } from '../MatchHistoryView';
import { CANONICAL_MATCH_HISTORY_CONFIG } from '../matchHistoryConfig';
import type { GameRoom } from '@/services/firebase/gameTypes';

const mockNavigate = vi.fn();
let mockParams: Record<string, string | undefined> = {};
let mockLocationState: any = {};

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
  useLocation: () => ({ pathname: '/matches', state: mockLocationState }),
}));

const mockUser = {
  id: 'usr_me_1',
  username: 'GrandmasterMe',
  email: 'me@schada.org',
  perModeStats: {
    bullet: { elo: 1200, gamesPlayed: 0, gamesWon: 0, gamesLost: 0, gamesDrawn: 0 },
    blitz: { elo: 1500, gamesPlayed: 5, gamesWon: 4, gamesLost: 1, gamesDrawn: 0 },
  },
  status: 'online' as const,
  usernameChangeCount: 0,
  isPatron: false,
};

let currentAuthUser: any = mockUser;
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: currentAuthUser,
  }),
}));

const mockGetPlayerMatchHistory = vi.fn();
vi.mock('@/services/firebase/gameService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/firebase/gameService')>();
  return {
    ...actual,
    getPlayerMatchHistory: (...args: any[]) => mockGetPlayerMatchHistory(...args),
  };
});

describe('MatchHistoryView Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams = {};
    mockLocationState = {};
    currentAuthUser = mockUser;
  });

  const sampleMatch: GameRoom = {
    id: 'game_test_123',
    hostId: 'usr_me_1',
    whitePlayer: { id: 'usr_me_1', username: 'GrandmasterMe', elo: 1500 },
    blackPlayer: { id: 'usr_opp_2', username: 'RivalPlayer', elo: 1480 },
    status: 'completed',
    boardState: {
      board: [],
      currentTurn: 'black',
      moveHistory: [
        { from: { row: 1, col: 0 }, to: { row: 2, col: 0 }, piece: { id: 'w1', type: 'pawn', color: 'white' } },
        { from: { row: 6, col: 0 }, to: { row: 5, col: 0 }, piece: { id: 'b1', type: 'pawn', color: 'black' } },
      ],
      pliesWithoutPawnOrCapture: 0,
      stateHistory: [],
    } as any,
    mode: 'blitz',
    timeControlMinutes: 5,
    incrementSeconds: 0,
    playerIds: ['usr_me_1', 'usr_opp_2'],
    isRanked: true,
    isComputer: false,
    winner: 'white',
    winReason: 'goal_reached',
    whiteElo: { newElo: 1512, delta: 12 },
    blackElo: { newElo: 1468, delta: -12 },
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now(),
  };

  it('renders all mode filter tabs from canonical config', () => {
    const html = renderToStaticMarkup(<MatchHistoryView initialMatches={[]} />);

    for (const tab of CANONICAL_MATCH_HISTORY_CONFIG.tabs) {
      expect(html).toContain(tab.label);
    }
  });

  it('renders empty state when user has no match history', () => {
    const html = renderToStaticMarkup(<MatchHistoryView initialMatches={[]} />);

    expect(html).toContain(CANONICAL_MATCH_HISTORY_CONFIG.copy.emptyTitle);
    expect(html).toContain(CANONICAL_MATCH_HISTORY_CONFIG.copy.emptyDescription);
    expect(html).toContain(CANONICAL_MATCH_HISTORY_CONFIG.copy.returnToLobbyText);
  });

  it('renders interactive match card with victory badge, opponent info, rating delta and win reason', () => {
    const html = renderToStaticMarkup(<MatchHistoryView initialMatches={[sampleMatch]} />);

    expect(html).toContain(CANONICAL_MATCH_HISTORY_CONFIG.copy.defaultPageTitle);
    expect(html).toContain('RivalPlayer');
    expect(html).toContain('1480');
    expect(html).toContain(CANONICAL_MATCH_HISTORY_CONFIG.copy.victoryBadge);
    expect(html).toContain('+12');
    expect(html).toContain(CANONICAL_MATCH_HISTORY_CONFIG.copy.winReasons.goal_reached);
    expect(html).toContain('role="button"');
    expect(html).toContain('match-history-card');
    expect(html).toContain('Click to view move-by-move analysis');
    expect(html).toContain('Blitz');
    expect(html).toContain(CANONICAL_MATCH_HISTORY_CONFIG.copy.whiteColorBadge);
  });

  it('renders target user match history title when targetUserId is specified', () => {
    mockParams = { targetUserId: 'usr_opp_2' };
    mockLocationState = {
      targetProfile: {
        id: 'usr_opp_2',
        username: 'RivalPlayer',
        isPatron: false,
      },
    };

    const html = renderToStaticMarkup(<MatchHistoryView initialMatches={[sampleMatch]} />);

    expect(html).toContain('RivalPlayer&#x27;s Matches');
  });

  it('renders prompt to sign in when no user is authenticated and no targetUserId is provided', () => {
    currentAuthUser = null;

    const html = renderToStaticMarkup(<MatchHistoryView />);

    expect(html).toContain('Sign In to View Matches');
    expect(html).toContain(CANONICAL_MATCH_HISTORY_CONFIG.copy.returnToLobbyText);
  });
});
