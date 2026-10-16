import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LobbyTable } from '../LobbyTable';
import type { GameRoom } from '@/services/firebase/gameService';
import { MULTIPLAYER_SCALE_CONFIG } from '@/services/firebase/multiplayerConfig';
import { LOBBY_CONFIG } from '../lobbyConfig';

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

  describe('Partitioned My Games & Available Games sections', () => {
    const myWaitingRoom: GameRoom = {
      id: 'game_my_wait',
      isRanked: false,
      isPrivate: false,
      status: 'waiting',
      timeControlMinutes: 5,
      incrementSeconds: 0,
      creatorColorPref: 'random',
      currentTurn: 'blue',
      createdAt: Date.now() + 10,
      blueTimeMs: 300000,
      greenTimeMs: 300000,
      lastTurnStartTimeMs: null,
      bluePlayer: { id: 'usr_me', username: 'MyUser', elo: 1300, sessionToken: 'my_token' },
      greenPlayer: null,
      boardState: {} as any,
    };

    const otherWaitingRoom: GameRoom = {
      id: 'game_other_wait',
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
      bluePlayer: { id: 'usr_other', username: 'OtherUser', elo: 1200, sessionToken: 'other_token' },
      greenPlayer: null,
      boardState: {} as any,
    };

    it('hides My Games when signed-in player has no games, displaying Available Games header', () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'usr_me', username: 'MyUser', elo: 1300 },
        isLoading: false,
      });

      const html = renderToStaticMarkup(
        <LobbyTable
          initialWaitingRooms={[otherWaitingRoom]}
          initialInProgressRooms={[]}
        />
      );

      // My Games section header must not be rendered
      expect(html).not.toContain(LOBBY_CONFIG.sectionTitles.myGames);
      expect(html).not.toContain('lobby-section-my-games');

      // Available Games header must be rendered with count 1
      expect(html).toContain(LOBBY_CONFIG.sectionTitles.availableGames);
      expect(html).toContain('available-games-badge');
      expect(html).toContain('OtherUser');
    });

    it('pins My Games at the top when signed-in player has games, placing others in Available Games', () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'usr_me', username: 'MyUser', elo: 1300 },
        isLoading: false,
      });

      const html = renderToStaticMarkup(
        <LobbyTable
          initialWaitingRooms={[myWaitingRoom, otherWaitingRoom]}
          initialInProgressRooms={[]}
        />
      );

      // Both section headers must be present
      expect(html).toContain(LOBBY_CONFIG.sectionTitles.myGames);
      expect(html).toContain(LOBBY_CONFIG.sectionTitles.availableGames);

      // My Games must appear before Available Games in the DOM
      const myGamesIndex = html.indexOf(LOBBY_CONFIG.sectionTitles.myGames);
      const availableGamesIndex = html.indexOf(LOBBY_CONFIG.sectionTitles.availableGames);
      expect(myGamesIndex).toBeLessThan(availableGamesIndex);

      expect(html).toContain('my-games-badge');
      expect(html).toContain('available-games-badge');
    });

    it('displays My Games for guest players matching stored guestId in active session', () => {
      mockUseAuth.mockReturnValue({
        user: null, // guest
        isLoading: false,
      });

      const guestIdKey = MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.guestId;
      const originalLocalStorage = globalThis.localStorage;
      const mockStorage = new Map<string, string>();
      mockStorage.set(guestIdKey, 'guest_active_session');
      globalThis.localStorage = {
        getItem: (k: string) => mockStorage.get(k) ?? null,
        setItem: (k: string, v: string) => mockStorage.set(k, v),
        removeItem: (k: string) => mockStorage.delete(k),
        clear: () => mockStorage.clear(),
        key: () => null,
        length: 0,
      } as any;

      const guestRoom: GameRoom = {
        ...myWaitingRoom,
        id: 'game_guest_room',
        bluePlayer: { id: 'guest_active_session', username: 'Guest Host', elo: 1200, sessionToken: 'guest_tok' },
      };

      try {
        const html = renderToStaticMarkup(
          <LobbyTable
            initialWaitingRooms={[guestRoom, otherWaitingRoom]}
            initialInProgressRooms={[]}
          />
        );

        expect(html).toContain(LOBBY_CONFIG.sectionTitles.myGames);
        expect(html).toContain(LOBBY_CONFIG.sectionTitles.availableGames);
        expect(html).toContain('Guest Host');
      } finally {
        globalThis.localStorage = originalLocalStorage;
      }
    });

    it('displays inline note when My Games is present but Available Games has 0 rooms', () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'usr_me', username: 'MyUser', elo: 1300 },
        isLoading: false,
      });

      const html = renderToStaticMarkup(
        <LobbyTable
          initialWaitingRooms={[myWaitingRoom]}
          initialInProgressRooms={[]}
        />
      );

      expect(html).toContain(LOBBY_CONFIG.sectionTitles.myGames);
      expect(html).toContain(LOBBY_CONFIG.sectionTitles.availableGames);
      expect(html).toContain(LOBBY_CONFIG.emptyAvailableGamesMessage);
    });

    it('keeps My Games visible even when lobby filters exclude its category/mode', () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'usr_me', username: 'MyUser', elo: 1300 },
        isLoading: false,
      });

      const originalLocalStorage = globalThis.localStorage;
      const mockStorage = new Map<string, string>();
      const restrictiveFilters = {
        timeControls: { bullet: false, blitz: false, rapid: false, classical: false, correspondence: false },
        increment: { yes: false, no: false },
        modes: { casual: false, ranked: false },
        statuses: { open: false, inProgress: false },
      };
      mockStorage.set(LOBBY_CONFIG.storageKey, JSON.stringify(restrictiveFilters));

      globalThis.localStorage = {
        getItem: (k: string) => mockStorage.get(k) ?? null,
        setItem: (k: string, v: string) => mockStorage.set(k, v),
        removeItem: (k: string) => mockStorage.delete(k),
        clear: () => mockStorage.clear(),
        key: () => null,
        length: 0,
      } as any;

      try {
        const html = renderToStaticMarkup(
          <LobbyTable
            initialWaitingRooms={[myWaitingRoom, otherWaitingRoom]}
            initialInProgressRooms={[]}
          />
        );

        // My Games is immune to filters: still rendered!
        expect(html).toContain(LOBBY_CONFIG.sectionTitles.myGames);
        expect(html).toContain('MyUser');
        // Available Games is filtered out: 0 matching
        expect(html).toContain('available-games-badge');
        expect(html).toContain(LOBBY_CONFIG.emptyAvailableFilteredMessage);
        expect(html).not.toContain('OtherUser');
      } finally {
        globalThis.localStorage = originalLocalStorage;
      }
    });

    it('displays full empty state when no games exist in lobby', () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'usr_me', username: 'MyUser', elo: 1300 },
        isLoading: false,
      });

      const html = renderToStaticMarkup(
        <LobbyTable
          initialWaitingRooms={[]}
          initialInProgressRooms={[]}
        />
      );

      expect(html).toContain(LOBBY_CONFIG.emptyLobbyTitle);
      expect(html).not.toContain(LOBBY_CONFIG.sectionTitles.myGames);
      expect(html).not.toContain(LOBBY_CONFIG.sectionTitles.availableGames);
    });

    it('displays targeted challenge in My Games for both challenger and challengee with names rendered', () => {
      const targetedRoom: GameRoom = {
        id: 'targeted_123',
        isRanked: true,
        isPrivate: false,
        status: 'waiting',
        timeControlMinutes: 5,
        incrementSeconds: 3,
        creatorColorPref: 'random',
        currentTurn: 'blue',
        createdAt: Date.now(),
        blueTimeMs: 300000,
        greenTimeMs: 300000,
        lastTurnStartTimeMs: null,
        bluePlayer: { id: 'usr_challenger', username: 'Challenger', elo: 1400, sessionToken: 'tok_chal' },
        greenPlayer: null,
        targetOpponent: { id: 'usr_challengee', username: 'Challengee', elo: 1350 },
        boardState: {} as any,
      };

      // 1. For Challengee: room appears in "My Games" and renders "Challenger vs Challengee"
      mockUseAuth.mockReturnValue({
        user: { id: 'usr_challengee', username: 'Challengee', elo: 1350 },
        isLoading: false,
      });

      const htmlChallengee = renderToStaticMarkup(
        <LobbyTable
          initialWaitingRooms={[targetedRoom]}
          initialInProgressRooms={[]}
        />
      );

      expect(htmlChallengee).toContain(LOBBY_CONFIG.sectionTitles.myGames);
      expect(htmlChallengee).toContain('Challenger');
      expect(htmlChallengee).toContain('Challengee');
      expect(htmlChallengee).toContain('opponent-name');
      expect(htmlChallengee).not.toContain('waiting-placeholder');

      // 2. For an unrelated third player: targeted challenge is excluded from Available Games
      mockUseAuth.mockReturnValue({
        user: { id: 'usr_unrelated', username: 'ThirdPlayer', elo: 1200 },
        isLoading: false,
      });

      const htmlThirdParty = renderToStaticMarkup(
        <LobbyTable
          initialWaitingRooms={[targetedRoom]}
          initialInProgressRooms={[]}
        />
      );

      // Unrelated player should see empty filter state (no matching available games) and no My Games
      expect(htmlThirdParty).not.toContain(LOBBY_CONFIG.sectionTitles.myGames);
      expect(htmlThirdParty).toContain(LOBBY_CONFIG.emptyFilterTitle);
      expect(htmlThirdParty).not.toContain('Challenger');
    });
  });
});
