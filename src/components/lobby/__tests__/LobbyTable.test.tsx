import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LobbyTable } from '../LobbyTable';
import type { GameRoom } from '@/services/firebase/gameService';
import { MULTIPLAYER_SCALE_CONFIG } from '@/services/firebase/multiplayerConfig';

const mockUseAuth = vi.fn();
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/services/firebase/gameService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/firebase/gameService')>();
  return {
    ...actual,
    subscribeToOpenRooms: vi.fn(() => () => {}),
    getInProgressRooms: vi.fn().mockResolvedValue([]),
    sortLobbyRooms: (rooms: GameRoom[]) => rooms,
  };
});

describe('LobbyTable Component - Guest Ranked Restriction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockWaitingRankedRoom: GameRoom = {
    id: 'game_ranked_wait',
    isRanked: true,
    isPrivate: false,
    status: 'waiting',
    timeControlMinutes: 5,
    incrementSeconds: 0,
    creatorColorPref: 'random',
    currentTurn: 'blue',
    createdAt: Date.now(),
    blueTimeMs: 300000,
    greenTimeMs: 300000,
    lastTurnStartTimeMs: null,
    bluePlayer: { id: 'usr_host', username: 'HostPlayer', elo: 1400, sessionToken: 'mock_token' },
    greenPlayer: null,
    boardState: {} as any,
  };

  const mockWaitingCasualRoom: GameRoom = {
    id: 'game_casual_wait',
    isRanked: false,
    isPrivate: false,
    status: 'waiting',
    timeControlMinutes: 10,
    incrementSeconds: 0,
    creatorColorPref: 'random',
    currentTurn: 'blue',
    createdAt: Date.now(),
    blueTimeMs: 600000,
    greenTimeMs: 600000,
    lastTurnStartTimeMs: null,
    bluePlayer: { id: 'usr_casual_host', username: 'CasualHost', elo: 1200, sessionToken: 'mock_token' },
    greenPlayer: null,
    boardState: {} as any,
  };

  const mockLiveRankedRoom: GameRoom = {
    id: 'game_ranked_live',
    isRanked: true,
    isPrivate: false,
    status: 'in_progress',
    timeControlMinutes: 5,
    incrementSeconds: 0,
    creatorColorPref: 'random',
    currentTurn: 'blue',
    createdAt: Date.now(),
    blueTimeMs: 280000,
    greenTimeMs: 290000,
    lastTurnStartTimeMs: Date.now(),
    bluePlayer: { id: 'usr_player1', username: 'Player1', elo: 1450, sessionToken: 'mock_token_1' },
    greenPlayer: { id: 'usr_player2', username: 'Player2', elo: 1420, sessionToken: 'mock_token_2' },
    boardState: {} as any,
  };

  it('greys out and disables waiting ranked games for guest users without rendering "(Account required)" text', () => {
    mockUseAuth.mockReturnValue({
      user: null, // guest
      isLoading: false,
    });

    const html = renderToStaticMarkup(
      <LobbyTable
        initialWaitingRooms={[mockWaitingRankedRoom, mockWaitingCasualRoom]}
        initialInProgressRooms={[mockLiveRankedRoom]}
      />
    );

    // 1. Waiting ranked room must have row-disabled, aria-disabled="true", and tabindex="-1"
    expect(html).toContain('row-disabled');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('tabindex="-1"');

    // 2. Must display tooltip explaining account required
    expect(html).toContain(`title="${MULTIPLAYER_SCALE_CONFIG.matchmaking.guestRankedTooltipText}"`);

    // 3. Must NOT render "(Account required)" badge text in the row
    expect(html).not.toContain('(Account required)');
    expect(html).not.toContain('auth-required-badge');

    // 4. Waiting casual room must remain interactive (tabindex="0" and not disabled)
    expect(html).toContain('tabindex="0"');
  });

  it('keeps waiting ranked games active and clickable for authenticated users', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'usr_active_member', username: 'MemberPlayer', elo: 1300 },
      isLoading: false,
    });

    const html = renderToStaticMarkup(
      <LobbyTable
        initialWaitingRooms={[mockWaitingRankedRoom]}
        initialInProgressRooms={[]}
      />
    );

    // Authenticated user should NOT have row-disabled
    expect(html).not.toContain('row-disabled');
    expect(html).not.toContain('aria-disabled="true"');
    expect(html).toContain('tabindex="0"');
    expect(html).not.toContain('(Account required)');
  });

  it('keeps in-progress ranked games clickable for guest users to allow spectating', () => {
    mockUseAuth.mockReturnValue({
      user: null, // guest
      isLoading: false,
    });

    const html = renderToStaticMarkup(
      <LobbyTable
        initialWaitingRooms={[]}
        initialInProgressRooms={[mockLiveRankedRoom]}
      />
    );

    // In-progress ranked game is NOT disabled for guests (spectating allowed)
    expect(html).not.toContain('row-disabled');
    expect(html).not.toContain('aria-disabled="true"');
    expect(html).toContain('tabindex="0"');
  });

  it('renders correspondence game rooms with proper time badge', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'usr_member', username: 'MemberPlayer', elo: 1300 },
      isLoading: false,
    });

    const mockCorrespondenceRoom: GameRoom = {
      id: 'game_corr_wait',
      isRanked: true,
      isPrivate: false,
      status: 'waiting',
      timeControlMinutes: 2880, // 2 days
      incrementSeconds: 0,
      creatorColorPref: 'random',
      currentTurn: 'blue',
      createdAt: Date.now(),
      blueTimeMs: 2880 * 60 * 1000,
      greenTimeMs: 2880 * 60 * 1000,
      lastTurnStartTimeMs: null,
      bluePlayer: { id: 'usr_host', username: 'CorrHost', elo: 1500, sessionToken: 'mock_token' },
      greenPlayer: null,
      boardState: {} as any,
    };

    const html = renderToStaticMarkup(
      <LobbyTable
        initialWaitingRooms={[mockCorrespondenceRoom]}
        initialInProgressRooms={[]}
      />
    );

    expect(html).toContain('2d');
    expect(html).toContain('lobby-speed-icon correspondence');
  });
});
