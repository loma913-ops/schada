import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createGame,
  joinGame,
  makeGameMove,
  resignGameAction,
  abandonGame,
  getOpenRooms,
  getLocalSessionToken,
  deleteGame,
  cleanupAbandonedGames,
  subscribeToGame,
  findOpenWaitingGame,
  sortLobbyRooms,
  subscribeToOpenRooms,
  isGameTimedOut,
  startAbandonedGamesCleanupWatcher,
  ABANDONED_GAME_EXPIRY_MS,
  type GameRoom,
} from '../gameService';
import { MULTIPLAYER_SCALE_CONFIG } from '../multiplayerConfig';
import { getLegalMovesForSquare } from '@/core/schada/engine';

vi.mock('../config', () => ({
  isFirebaseConfigured: () => false,
  db: null,
  auth: null,
  app: null,
}));

class LocalStorageMock {
  private store: Record<string, string> = {};
  getItem(key: string) {
    return this.store[key] || null;
  }
  setItem(key: string, val: string) {
    this.store[key] = String(val);
  }
  removeItem(key: string) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

// Polyfill global localStorage for Node test runner
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = new LocalStorageMock();
}

describe('GameService Multiplayer Sync', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates a game room with proper initial state', async () => {
    const creator = { id: 'user_1', username: 'HostPlayer', elo: 1300 };
    const { gameId, color, sessionToken } = await createGame({
      timeControlMinutes: 5,
      incrementSeconds: 3,
      isRanked: true,
      colorPref: 'blue',
      isPrivate: false,
      creator,
    });

    expect(gameId).toBeDefined();
    expect(color).toBe('blue');
    expect(sessionToken).toBeDefined();
    expect(getLocalSessionToken(gameId)).toBe(sessionToken);

    const openRooms = await getOpenRooms();
    expect(openRooms.some((r) => r.id === gameId)).toBe(true);
  });

  it('allows second player to join and starts the match', async () => {
    const creator = { id: 'user_1', username: 'HostPlayer', elo: 1300 };
    const { gameId } = await createGame({
      timeControlMinutes: 5,
      colorPref: 'blue',
      isPrivate: true,
      creator,
    });

    // Clear local storage token to simulate a different client/browser joining
    localStorage.removeItem('schada_player_token_' + gameId);

    const joiner = { id: 'user_2', username: 'GuestChallenger', elo: 1250 };
    const joinRes = await joinGame(gameId, joiner);

    expect(joinRes.success).toBe(true);
    expect(joinRes.role).toBe('player');
    expect(joinRes.color).toBe('green');

    // 3rd user joining should be a spectator
    localStorage.removeItem('schada_player_token_' + gameId);
    const spectator = { id: 'user_3', username: 'Watcher', elo: 1200 };
    const specRes = await joinGame(gameId, spectator);

    expect(specRes.success).toBe(true);
    expect(specRes.role).toBe('spectator');
  });

  it('allows players to execute moves and switches turns', async () => {
    const creator = { id: 'p1', username: 'BluePlayer', elo: 1300 };
    const { gameId } = await createGame({
      timeControlMinutes: 5,
      colorPref: 'blue',
      isPrivate: true,
      creator,
    });

    // Join player 2
    localStorage.removeItem('schada_player_token_' + gameId);
    await joinGame(gameId, { id: 'p2', username: 'GreenPlayer', elo: 1200 });

    // In mockStore, retrieve game to get blue's legal move
    const openRooms = await getOpenRooms();
    // Let's get move for blue pawn at e2 or FO at a1
    const p1Move = getLegalMovesForSquare(openRooms[0]?.boardState?.board || ({} as any), 'a1')[0] || {
      from: 'a1',
      to: 'a3',
      piece: { id: 'blue_fo_a1', type: 'field_officer', color: 'blue', hasLeftBase: false, hasReachedGoal: false },
      intermediateSquares: ['a2'],
      notation: 'FO-a3',
    };

    // Attempting green move first should fail
    await expect(makeGameMove(gameId, p1Move, 'green')).rejects.toThrow('It is not your turn.');

    // Blue makes move
    await makeGameMove(gameId, p1Move, 'blue');

    // Next move by blue should fail now because turn switched to green
    await expect(makeGameMove(gameId, p1Move, 'blue')).rejects.toThrow('It is not your turn.');
  });

  it('handles resignation cleanly', async () => {
    const creator = { id: 'p1', username: 'ResigningHost', elo: 1300 };
    const { gameId } = await createGame({
      timeControlMinutes: 5,
      colorPref: 'blue',
      isPrivate: true,
      creator,
    });

    // Join player 2
    localStorage.removeItem('schada_player_token_' + gameId);
    await joinGame(gameId, { id: 'p2', username: 'WinnerPlayer', elo: 1200 });

    await resignGameAction(gameId, 'blue');

    // New visitor without previous player token should be spectator
    localStorage.removeItem('schada_player_token_' + gameId);
    const res = await joinGame(gameId, { id: 'p3', username: 'Viewer', elo: 1200 });
    expect(res.role).toBe('spectator');
  });

  it('marks game as abandoned and removes from open rooms', async () => {
    const creator = { id: 'p1', username: 'WaitingHost', elo: 1300 };
    const { gameId } = await createGame({
      timeControlMinutes: 5,
      colorPref: 'blue',
      isPrivate: false,
      creator,
    });

    let openRooms = await getOpenRooms();
    expect(openRooms.some((r) => r.id === gameId)).toBe(true);

    await abandonGame(gameId);

    openRooms = await getOpenRooms();
    expect(openRooms.some((r) => r.id === gameId)).toBe(false);
  });

  it('sets abandonedAt timestamp when game is abandoned', async () => {
    const creator = { id: 'p1', username: 'WaitingHost', elo: 1300 };
    const { gameId } = await createGame({
      timeControlMinutes: 5,
      colorPref: 'blue',
      isPrivate: false,
      creator,
    });

    const before = Date.now();
    await abandonGame(gameId);
    const after = Date.now();

    let fetchedGame: GameRoom | null = null;
    const unsub = subscribeToGame(gameId, (g) => {
      fetchedGame = g;
    });
    unsub();

    const nonNullGame = fetchedGame as unknown as GameRoom;
    expect(nonNullGame).not.toBeNull();
    expect(nonNullGame.status).toBe('abandoned');
    expect(nonNullGame.abandonedAt).toBeGreaterThanOrEqual(before);
    expect(nonNullGame.abandonedAt).toBeLessThanOrEqual(after);
  });

  it('retains abandoned game if under 10 minutes old', async () => {
    const creator = { id: 'p1', username: 'WaitingHost', elo: 1300 };
    const { gameId } = await createGame({
      timeControlMinutes: 5,
      colorPref: 'blue',
      isPrivate: false,
      creator,
    });

    await abandonGame(gameId);

    // Run cleanup with standard threshold
    const removed = await cleanupAbandonedGames(ABANDONED_GAME_EXPIRY_MS);
    expect(removed).not.toContain(gameId);

    let fetchedGame: GameRoom | null = null;
    const unsub = subscribeToGame(gameId, (g) => {
      fetchedGame = g;
    });
    unsub();

    const nonNullGame = fetchedGame as unknown as GameRoom;
    expect(nonNullGame).not.toBeNull();
    expect(nonNullGame.status).toBe('abandoned');
  });

  it('removes and cleans up games that have been abandoned for 10 minutes or more', async () => {
    const creator = { id: 'p1', username: 'WaitingHost', elo: 1300 };
    const { gameId, sessionToken } = await createGame({
      timeControlMinutes: 5,
      colorPref: 'blue',
      isPrivate: false,
      creator,
    });

    expect(getLocalSessionToken(gameId)).toBe(sessionToken);

    await abandonGame(gameId);

    // Simulate expiration having passed since abandonment by running cleanup with maxAgeMs = 0
    const removed = await cleanupAbandonedGames(0);
    expect(removed).toContain(gameId);

    // Game should now be completely deleted from store
    let fetchedGame: GameRoom | null = null;
    const unsub = subscribeToGame(gameId, (g) => {
      fetchedGame = g;
    });
    unsub();

    expect(fetchedGame).toBeNull();

    // Local player session token should also be cleaned up
    expect(getLocalSessionToken(gameId)).toBeNull();
  });

  it('does not remove active or completed games during cleanup', async () => {
    const creator = { id: 'p1', username: 'ActiveHost', elo: 1300 };
    const { gameId: activeGameId } = await createGame({
      timeControlMinutes: 5,
      colorPref: 'blue',
      isPrivate: false,
      creator,
    });

    const removed = await cleanupAbandonedGames(0);
    expect(removed).not.toContain(activeGameId);

    let activeGame: GameRoom | null = null;
    const unsub = subscribeToGame(activeGameId, (g) => {
      activeGame = g;
    });
    unsub();

    const nonNullActive = activeGame as unknown as GameRoom;
    expect(nonNullActive).not.toBeNull();
    expect(nonNullActive.status).toBe('waiting');
  });

  it('cleans up expired abandoned game on direct subscription', async () => {
    const creator = { id: 'p1', username: 'WaitingHost', elo: 1300 };
    const { gameId } = await createGame({
      timeControlMinutes: 5,
      colorPref: 'blue',
      isPrivate: false,
      creator,
    });

    await abandonGame(gameId);

    // Manually manipulate the stored mock game abandonedAt to exceed expiry
    const raw = localStorage.getItem('schada_mock_games');
    const parsed = JSON.parse(raw || '{}');
    parsed[gameId].abandonedAt = Date.now() - (MULTIPLAYER_SCALE_CONFIG.matchmaking.abandonedGameExpiryMs + 60_000);
    localStorage.setItem('schada_mock_games', JSON.stringify(parsed));

    let fetchedGame: GameRoom | null = null;
    const unsub = subscribeToGame(gameId, (g) => {
      fetchedGame = g;
    });
    unsub();

    expect(fetchedGame).toBeNull();
  });

  it('allows manual game deletion via deleteGame', async () => {
    const creator = { id: 'p1', username: 'WaitingHost', elo: 1300 };
    const { gameId } = await createGame({
      timeControlMinutes: 5,
      colorPref: 'blue',
      isPrivate: false,
      creator,
    });

    await deleteGame(gameId);

    let fetchedGame: GameRoom | null = null;
    const unsub = subscribeToGame(gameId, (g) => {
      fetchedGame = g;
    });
    unsub();

    expect(fetchedGame).toBeNull();
    expect(getLocalSessionToken(gameId)).toBeNull();
  });

  it('locates matching open waiting game via findOpenWaitingGame', async () => {
    const creator = { id: 'host_p1', username: 'FastSeeker', elo: 1400 };
    const { gameId } = await createGame({
      timeControlMinutes: 3,
      incrementSeconds: 2,
      colorPref: 'random',
      isPrivate: false,
      creator,
    });

    // Same host searching should exclude their own room
    const hostFound = await findOpenWaitingGame(3, 2, 'host_p1');
    expect(hostFound).toBeNull();

    // Challenger with different time control should not match
    const diffTimeControl = await findOpenWaitingGame(5, 0, 'challenger_p2');
    expect(diffTimeControl).toBeNull();

    // Challenger looking for 3+2 should find this exact room instantly
    const matchFound = await findOpenWaitingGame(3, 2, 'challenger_p2');
    expect(matchFound).not.toBeNull();
    expect(matchFound?.id).toBe(gameId);
  });

  it('respects limitCount parameter on getOpenRooms', async () => {
    const creator = { id: 'p1', username: 'LimitTester', elo: 1300 };
    await Promise.all([
      createGame({ timeControlMinutes: 5, colorPref: 'blue', isPrivate: false, creator }),
      createGame({ timeControlMinutes: 10, colorPref: 'blue', isPrivate: false, creator }),
      createGame({ timeControlMinutes: 3, colorPref: 'blue', isPrivate: false, creator }),
    ]);

    const limited = await getOpenRooms(2);
    expect(limited.length).toBeLessThanOrEqual(2);
  });

  it('includes both waiting and in_progress games and sorts waiting rooms at the top', async () => {
    const creator1 = { id: 'p1', username: 'Host1', elo: 1300 };
    const creator2 = { id: 'p2', username: 'Host2', elo: 1350 };

    // 1. Create Game 1 (older, becomes in_progress)
    const { gameId: gameId1 } = await createGame({
      timeControlMinutes: 5,
      colorPref: 'blue',
      isPrivate: false,
      creator: creator1,
    });
    // Have a second player join to make it in_progress
    localStorage.removeItem('schada_player_token_' + gameId1);
    await joinGame(gameId1, { id: 'p3', username: 'Opponent1', elo: 1200 });

    // 2. Create Game 2 (newer waiting room)
    const { gameId: gameId2 } = await createGame({
      timeControlMinutes: 10,
      colorPref: 'green',
      isPrivate: false,
      creator: creator2,
    });

    const openRooms = await getOpenRooms();
    const g1 = openRooms.find((r) => r.id === gameId1);
    const g2 = openRooms.find((r) => r.id === gameId2);

    expect(g1).toBeDefined();
    expect(g1?.status).toBe('in_progress');
    expect(g2).toBeDefined();
    expect(g2?.status).toBe('waiting');

    // Index of waiting room should be before in_progress room
    const idxG2 = openRooms.findIndex((r) => r.id === gameId2);
    const idxG1 = openRooms.findIndex((r) => r.id === gameId1);
    expect(idxG2).toBeLessThan(idxG1);

    // Verify sortLobbyRooms directly
    const testList = [
      { id: 'live1', status: 'in_progress', createdAt: 200 } as GameRoom,
      { id: 'wait1', status: 'waiting', createdAt: 100 } as GameRoom,
      { id: 'wait2', status: 'waiting', createdAt: 300 } as GameRoom,
      { id: 'live2', status: 'in_progress', createdAt: 400 } as GameRoom,
    ];
    const sorted = sortLobbyRooms(testList);
    expect(sorted.map((r) => r.id)).toEqual(['wait2', 'wait1', 'live2', 'live1']);

    // Verify subscribeToOpenRooms receives the sorted rooms
    let subscribedRooms: GameRoom[] = [];
    const unsub = subscribeToOpenRooms((rooms) => {
      subscribedRooms = rooms;
    });
    unsub();
    expect(subscribedRooms.some((r) => r.id === gameId1)).toBe(true);
    expect(subscribedRooms.some((r) => r.id === gameId2)).toBe(true);
  });

  it('validates parameters and throws meaningful errors in lobby room functions', async () => {
    expect(() => sortLobbyRooms(null as any)).toThrowError(TypeError);
    expect(() => sortLobbyRooms('invalid' as any)).toThrowError(TypeError);

    await expect(getOpenRooms(0)).rejects.toThrowError(RangeError);
    await expect(getOpenRooms(-5)).rejects.toThrowError(RangeError);

    expect(() => subscribeToOpenRooms(null as any)).toThrowError(TypeError);
    expect(() => subscribeToOpenRooms(() => {}, 0)).toThrowError(RangeError);
    expect(() => subscribeToOpenRooms(() => {}, -10)).toThrowError(RangeError);
  });

  it('correctly evaluates isGameTimedOut for in-progress and waiting games', () => {
    // Waiting game: should never be timed out
    const waitingGame = {
      status: 'waiting',
      timeControlMinutes: 5,
      currentTurn: 'blue',
      blueTimeMs: 300000,
      greenTimeMs: 300000,
      lastTurnStartTimeMs: Date.now() - 400000,
    } as GameRoom;
    expect(isGameTimedOut(waitingGame)).toEqual({ timedOut: false });

    // In-progress untimed game: should never be timed out
    const untimedGame = {
      status: 'in_progress',
      timeControlMinutes: 0,
      currentTurn: 'blue',
      blueTimeMs: 0,
      greenTimeMs: 0,
      lastTurnStartTimeMs: Date.now() - 400000,
    } as GameRoom;
    expect(isGameTimedOut(untimedGame)).toEqual({ timedOut: false });

    // In-progress active game within time: should not be timed out
    const liveGame = {
      status: 'in_progress',
      timeControlMinutes: 5,
      currentTurn: 'blue',
      blueTimeMs: 300000,
      greenTimeMs: 300000,
      lastTurnStartTimeMs: Date.now() - 10000, // 10s elapsed out of 300s
    } as GameRoom;
    expect(isGameTimedOut(liveGame)).toEqual({ timedOut: false });

    // In-progress game where active turn time has run out
    const expiredBlueGame = {
      status: 'in_progress',
      timeControlMinutes: 2,
      currentTurn: 'blue',
      blueTimeMs: 120000,
      greenTimeMs: 120000,
      lastTurnStartTimeMs: Date.now() - 130000, // 130s elapsed out of 120s
    } as GameRoom;
    expect(isGameTimedOut(expiredBlueGame)).toEqual({ timedOut: true, timedOutColor: 'blue' });

    const expiredGreenGame = {
      status: 'in_progress',
      timeControlMinutes: 1,
      currentTurn: 'green',
      blueTimeMs: 60000,
      greenTimeMs: 40000,
      lastTurnStartTimeMs: Date.now() - 50000, // 50s elapsed out of 40s
    } as GameRoom;
    expect(isGameTimedOut(expiredGreenGame)).toEqual({ timedOut: true, timedOutColor: 'green' });
  });

  it('filters out timed-out in-progress games in sortLobbyRooms and auto-resolves in cleanup', async () => {
    const creator = { id: 'p1', username: 'Host1', elo: 1300 };
    const { gameId } = await createGame({
      timeControlMinutes: 1,
      colorPref: 'blue',
      isPrivate: false,
      creator,
    });

    // Join second player
    localStorage.removeItem('schada_player_token_' + gameId);
    await joinGame(gameId, { id: 'p2', username: 'Player2', elo: 1200 });

    // Game is now in_progress. Simulate time elapsed exceeding 1 minute
    const raw = localStorage.getItem('schada_mock_games');
    const parsed = JSON.parse(raw || '{}');
    parsed[gameId].lastTurnStartTimeMs = Date.now() - 70000; // 70s elapsed on 60s clock
    localStorage.setItem('schada_mock_games', JSON.stringify(parsed));

    // sortLobbyRooms should filter out the expired game
    const currentRooms = [parsed[gameId]];
    const sorted = sortLobbyRooms(currentRooms);
    expect(sorted.length).toBe(0);

    // cleanupAbandonedGames should automatically complete the game via timeout
    await cleanupAbandonedGames();

    // Verify game was transitioned to completed with timeout reason
    let fetchedGame: GameRoom | null = null;
    const unsub = subscribeToGame(gameId, (g) => {
      fetchedGame = g;
    });
    unsub();

    const nonNullGame = fetchedGame as unknown as GameRoom;
    expect(nonNullGame).not.toBeNull();
    expect(nonNullGame.status).toBe('completed');
    expect(nonNullGame.winReason).toBe('timeout');
    expect(nonNullGame.winner).toBe('green'); // blue ran out of time, green won
  });

  it('validates cleanupAbandonedGames parameters strictly', async () => {
    await expect(cleanupAbandonedGames(-1)).rejects.toThrowError(RangeError);
    await expect(cleanupAbandonedGames(NaN)).rejects.toThrowError(RangeError);
    await expect(cleanupAbandonedGames('invalid' as any)).rejects.toThrowError(RangeError);
  });

  it('validates startAbandonedGamesCleanupWatcher parameters and manages timer lifecycle', () => {
    expect(() => startAbandonedGamesCleanupWatcher(0)).toThrowError(RangeError);
    expect(() => startAbandonedGamesCleanupWatcher(-500)).toThrowError(RangeError);
    expect(() => startAbandonedGamesCleanupWatcher(NaN)).toThrowError(RangeError);

    const stop = startAbandonedGamesCleanupWatcher(60_000);
    expect(typeof stop).toBe('function');
    expect(() => stop()).not.toThrow();
  });

  it('handles null, undefined, or malformed rooms gracefully in isGameTimedOut', () => {
    expect(isGameTimedOut(null)).toEqual({ timedOut: false });
    expect(isGameTimedOut(undefined)).toEqual({ timedOut: false });
    expect(isGameTimedOut({} as any)).toEqual({ timedOut: false });
    expect(isGameTimedOut({ status: 'in_progress', timeControlMinutes: 5, currentTurn: 'invalid' } as any)).toEqual({
      timedOut: false,
    });
  });

  it('strictly coerces isRanked to false when creator is a guest', async () => {
    // Guest with guest_ prefix
    const guestCreator = { id: 'guest_abc12', username: 'GuestHost', elo: 1200 };
    const { gameId: guestGameId } = await createGame({
      timeControlMinutes: 5,
      isRanked: true, // Attempted to create ranked game
      creator: guestCreator,
    });

    const openRooms = await getOpenRooms();
    const guestRoom = openRooms.find((r) => r.id === guestGameId);
    expect(guestRoom).toBeDefined();
    expect(guestRoom?.isRanked).toBe(false);

    // Guest with 'guest' id
    const anonCreator = { id: 'guest', username: 'Anonymous', elo: 1200 };
    const { gameId: anonGameId } = await createGame({
      timeControlMinutes: 5,
      isRanked: true,
      creator: anonCreator,
    });
    const anonRoom = (await getOpenRooms()).find((r) => r.id === anonGameId);
    expect(anonRoom?.isRanked).toBe(false);

    // Registered user CAN create ranked game
    const regCreator = { id: 'user_registered_99', username: 'RatedPlayer', elo: 1450 };
    const { gameId: regGameId } = await createGame({
      timeControlMinutes: 5,
      isRanked: true,
      creator: regCreator,
    });
    const regRoom = (await getOpenRooms()).find((r) => r.id === regGameId);
    expect(regRoom?.isRanked).toBe(true);
  });

  it('filters by isRanked in findOpenWaitingGame', async () => {
    const casualHost = { id: 'user_casual', username: 'CasualHost', elo: 1200 };
    const { gameId: casualGameId } = await createGame({
      timeControlMinutes: 10,
      incrementSeconds: 0,
      isRanked: false,
      isPrivate: false,
      creator: casualHost,
    });

    const rankedHost = { id: 'user_ranked', username: 'RankedHost', elo: 1300 };
    const { gameId: rankedGameId } = await createGame({
      timeControlMinutes: 10,
      incrementSeconds: 0,
      isRanked: true,
      isPrivate: false,
      creator: rankedHost,
    });

    // Seeker looking strictly for casual game
    const casualFound = await findOpenWaitingGame(10, 0, 'seeker_p1', 10, false);
    expect(casualFound).not.toBeNull();
    expect(casualFound?.id).toBe(casualGameId);
    expect(casualFound?.isRanked).toBe(false);

    // Seeker looking strictly for ranked game
    const rankedFound = await findOpenWaitingGame(10, 0, 'seeker_p2', 10, true);
    expect(rankedFound).not.toBeNull();
    expect(rankedFound?.id).toBe(rankedGameId);
    expect(rankedFound?.isRanked).toBe(true);
  });
});


