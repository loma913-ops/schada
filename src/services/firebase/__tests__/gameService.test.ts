import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createGame,
  joinGame,
  makeGameMove,
  resignGameAction,
  timeoutGameAction,
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
  markGameEloProcessed,
  computeRankedGameEloResult,
  reconcilePendingElo,
  generateGameId,
  localGameStore,
  ABANDONED_GAME_EXPIRY_MS,
  type GameRoom,
} from '../gameService';
import { MULTIPLAYER_SCALE_CONFIG } from '../multiplayerConfig';
import { SECURITY_CONFIG } from '@/core/security/securityConfig';
import { getLegalMovesForSquare } from '@/core/schada/engine';
import { registerUser } from '../authService';
import { localBackend } from '../localProvider';
import { LOBBY_CONFIG } from '@/components/lobby/lobbyConfig';
import { CANONICAL_DIGITAL_CLOCK_CONFIG } from '@/components/game/digitalClockConfig';

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
      colorPref: 'white',
      isPrivate: false,
      creator,
    });

    expect(gameId).toBeDefined();
    expect(color).toBe('white');
    expect(sessionToken).toBeDefined();
    expect(getLocalSessionToken(gameId)).toBe(sessionToken);

    const openRooms = await getOpenRooms();
    expect(openRooms.some((r) => r.id === gameId)).toBe(true);
  });

  it('allows second player to join and starts the match', async () => {
    const creator = { id: 'user_1', username: 'HostPlayer', elo: 1300 };
    const { gameId } = await createGame({
      timeControlMinutes: 5,
      colorPref: 'white',
      isPrivate: true,
      creator,
    });

    // Clear local storage token to simulate a different client/browser joining
    localStorage.removeItem('schada_player_token_' + gameId);

    const joiner = { id: 'user_2', username: 'GuestChallenger', elo: 1250 };
    const joinRes = await joinGame(gameId, joiner);

    expect(joinRes.success).toBe(true);
    expect(joinRes.role).toBe('player');
    expect(joinRes.color).toBe('black');

    // 3rd user joining should be a spectator
    localStorage.removeItem('schada_player_token_' + gameId);
    const spectator = { id: 'user_3', username: 'Watcher', elo: 1200 };
    const specRes = await joinGame(gameId, spectator);

    expect(specRes.success).toBe(true);
    expect(specRes.role).toBe('spectator');
  });

  it('restricts joining to targetOpponent when targetOpponent is specified', async () => {
    const creator = { id: 'host_id', username: 'HostUser', elo: 1300 };
    const targetOpponent = { id: 'target_id', username: 'TargetUser', elo: 1350 };
    const { gameId } = await createGame({
      timeControlMinutes: 10,
      colorPref: 'white',
      isPrivate: false,
      creator,
      targetOpponent,
    });

    const room = localGameStore.get(gameId);
    expect(room?.targetOpponent?.id).toBe('target_id');
    expect(room?.targetOpponent?.username).toBe('TargetUser');

    // Clear local session token
    localStorage.removeItem('schada_player_token_' + gameId);

    // Unrelated player attempts to join
    const randomUser = { id: 'random_id', username: 'RandomUser', elo: 1200 };
    const randomRes = await joinGame(gameId, randomUser);
    expect(randomRes.success).toBe(false);
    expect(randomRes.role).toBe('spectator');
    expect(randomRes.error).toBe(MULTIPLAYER_SCALE_CONFIG.matchmaking.challengeReservedErrorMessage);

    // Targeted opponent joins
    const targetRes = await joinGame(gameId, targetOpponent);
    expect(targetRes.success).toBe(true);
    expect(targetRes.role).toBe('player');
    expect(targetRes.color).toBe('black');

    const updatedRoom = localGameStore.get(gameId);
    expect(updatedRoom?.status).toBe('in_progress');
    expect(updatedRoom?.blackPlayer?.id).toBe('target_id');
  });

  it('allows players to execute moves and switches turns', async () => {
    const creator = { id: 'p1', username: 'whitePlayer', elo: 1300 };
    const { gameId } = await createGame({
      timeControlMinutes: 5,
      colorPref: 'white',
      isPrivate: true,
      creator,
    });

    // Join player 2
    localStorage.removeItem('schada_player_token_' + gameId);
    await joinGame(gameId, { id: 'p2', username: 'blackPlayer', elo: 1200 });

    // In localGameStore, retrieve game to get white's legal move
    const openRooms = await getOpenRooms();
    // Let's get move for white pawn at e2 or FO at a1
    const p1Move = getLegalMovesForSquare(openRooms[0]?.boardState?.board || ({} as any), 'a1')[0] || {
      from: 'a1',
      to: 'a3',
      piece: { id: 'white_fo_a1', type: 'field_officer', color: 'white', hasLeftBase: false, hasReachedGoal: false },
      intermediateSquares: ['a2'],
      notation: 'FO-a3',
    };

    // Attempting black move first should fail
    await expect(makeGameMove(gameId, p1Move, 'black')).rejects.toThrow('It is not your turn.');

    // White makes move
    await makeGameMove(gameId, p1Move, 'white');

    // Next move by white should fail now because turn switched to black
    await expect(makeGameMove(gameId, p1Move, 'white')).rejects.toThrow('It is not your turn.');
  });

  it('optimizes move execution when currentGame is passed directly', async () => {
    const creator = { id: 'p1', username: 'whitePlayer', elo: 1300 };
    const { gameId } = await createGame({
      timeControlMinutes: 5,
      colorPref: 'white',
      isPrivate: true,
      creator,
    });

    localStorage.removeItem('schada_player_token_' + gameId);
    await joinGame(gameId, { id: 'p2', username: 'blackPlayer', elo: 1200 });

    const currentRoom = localGameStore.get(gameId)!;
    const p1Move = getLegalMovesForSquare(currentRoom.boardState.board, 'a1')[0] || {
      from: 'a1',
      to: 'a3',
      piece: { id: 'white_fo_a1', type: 'field_officer', color: 'white', hasLeftBase: false, hasReachedGoal: false },
      intermediateSquares: ['a2'],
      notation: 'FO-a3',
    };

    // Make move providing currentGame directly
    await makeGameMove(gameId, p1Move, 'white', currentRoom);

    const updatedGame = localGameStore.get(gameId);
    expect(updatedGame?.boardState.moveHistory.length).toBe(1);
    expect(updatedGame?.boardState.currentTurn).toBe('black');
  });

  it('resets player clock on move completion in correspondence matches', async () => {
    const creator = { id: 'p_corr_1', username: 'CorrWhite', elo: 1300 };
    const daysPerMove = 2;
    const msPerMinute =
      LOBBY_CONFIG.secondsPerMinute * CANONICAL_DIGITAL_CLOCK_CONFIG.timeUnits.msPerSecond;
    const twoDaysMinutes = daysPerMove * LOBBY_CONFIG.correspondenceCutoffMinutes;
    const twoDaysMs = twoDaysMinutes * msPerMinute;
    const { gameId } = await createGame({
      timeControlMinutes: twoDaysMinutes,
      colorPref: 'white',
      isPrivate: true,
      creator,
    });

    localStorage.removeItem('schada_player_token_' + gameId);
    await joinGame(gameId, { id: 'p_corr_2', username: 'CorrBlack', elo: 1200 });

    const currentRoom = localGameStore.get(gameId)!;
    expect(currentRoom.whiteTimeMs).toBe(twoDaysMs);
    expect(currentRoom.blackTimeMs).toBe(twoDaysMs);

    // Simulate 12 hours elapsed on white's turn
    const elapsedHours = 12;
    const elapsedMs =
      elapsedHours *
      CANONICAL_DIGITAL_CLOCK_CONFIG.timeUnits.minutesPerHour *
      msPerMinute;
    currentRoom.lastTurnStartTimeMs = Date.now() - elapsedMs;
    localGameStore.set(currentRoom);

    const p1Move = getLegalMovesForSquare(currentRoom.boardState.board, 'a1')[0];
    await makeGameMove(gameId, p1Move, 'white');

    const updatedGame = localGameStore.get(gameId);
    expect(updatedGame?.boardState.currentTurn).toBe('black');
    // White's clock should be reset to 2 days (Days per move)
    expect(updatedGame?.whiteTimeMs).toBe(twoDaysMs);
    // Black's clock should also be allocated full 2 days for their upcoming move
    expect(updatedGame?.blackTimeMs).toBe(twoDaysMs);
  });

  it('handles resignation cleanly', async () => {
    const creator = { id: 'p1', username: 'ResigningHost', elo: 1300 };
    const { gameId } = await createGame({
      timeControlMinutes: 5,
      colorPref: 'white',
      isPrivate: true,
      creator,
    });

    // Join player 2
    localStorage.removeItem('schada_player_token_' + gameId);
    await joinGame(gameId, { id: 'p2', username: 'WinnerPlayer', elo: 1200 });

    await resignGameAction(gameId, 'white');

    // New visitor without previous player token should be spectator
    localStorage.removeItem('schada_player_token_' + gameId);
    const res = await joinGame(gameId, { id: 'p3', username: 'Viewer', elo: 1200 });
    expect(res.role).toBe('spectator');
  });

  it('calculates Elo deltas and updates resigning player when resigning in ranked game', async () => {
    const creator = { id: 'p1', username: 'Host1', elo: 1300, gamesPlayed: 10 };
    const { gameId } = await createGame({
      timeControlMinutes: 5,
      colorPref: 'white',
      isPrivate: true,
      isRanked: true,
      creator,
    });

    localStorage.removeItem('schada_player_token_' + gameId);
    await joinGame(gameId, { id: 'p2', username: 'Challenger', elo: 1200 });

    let latestGame: GameRoom | null = null;
    const unsub = subscribeToGame(gameId, (g) => {
      latestGame = g;
    });

    // Host (white) resigns
    await resignGameAction(gameId, 'white');

    expect(latestGame).not.toBeNull();
    expect((latestGame as any).status).toBe('completed');
    expect((latestGame as any).winner).toBe('black');
    expect((latestGame as any).winReason).toBe('resignation');
    expect((latestGame as any).eloResult).toBeDefined();
    expect((latestGame as any).eloResult.whiteDelta).toBeLessThan(0);
    expect((latestGame as any).eloResult.blackDelta).toBeGreaterThan(0);
    expect((latestGame as any).whitePlayer.elo).toBe((latestGame as any).eloResult.newWhiteElo);
    expect((latestGame as any).blackPlayer.elo).toBe((latestGame as any).eloResult.newBlackElo);
    expect((latestGame as any).processedEloUserIds).toContain('p1');

    // Winner marks themselves processed
    await markGameEloProcessed(gameId, 'p2');
    expect((latestGame as any).processedEloUserIds).toContain('p2');

    unsub();
  });

  it('marks game as abandoned and removes from open rooms', async () => {
    const creator = { id: 'p1', username: 'WaitingHost', elo: 1300 };
    const { gameId } = await createGame({
      timeControlMinutes: 5,
      colorPref: 'white',
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
      colorPref: 'white',
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
      colorPref: 'white',
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
      colorPref: 'white',
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
      colorPref: 'white',
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
      colorPref: 'white',
      isPrivate: false,
      creator,
    });

    await abandonGame(gameId);

    // Manually manipulate the stored local game abandonedAt to exceed expiry
    const raw = localStorage.getItem(MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.localGames);
    const parsed = JSON.parse(raw || '{}');
    parsed[gameId].abandonedAt = Date.now() - (MULTIPLAYER_SCALE_CONFIG.matchmaking.abandonedGameExpiryMs + 60_000);
    localStorage.setItem(MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.localGames, JSON.stringify(parsed));

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
      colorPref: 'white',
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
      createGame({ timeControlMinutes: 5, colorPref: 'white', isPrivate: false, creator }),
      createGame({ timeControlMinutes: 10, colorPref: 'white', isPrivate: false, creator }),
      createGame({ timeControlMinutes: 3, colorPref: 'white', isPrivate: false, creator }),
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
      colorPref: 'white',
      isPrivate: false,
      creator: creator1,
    });
    // Have a second player join to make it in_progress
    localStorage.removeItem('schada_player_token_' + gameId1);
    await joinGame(gameId1, { id: 'p3', username: 'Opponent1', elo: 1200 });

    // 2. Create Game 2 (newer waiting room)
    const { gameId: gameId2 } = await createGame({
      timeControlMinutes: 10,
      colorPref: 'black',
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
      currentTurn: 'white',
      whiteTimeMs: 300000,
      blackTimeMs: 300000,
      blueTimeMs: 300000,
      greenTimeMs: 300000,
      lastTurnStartTimeMs: Date.now() - 400000,
    } as GameRoom;
    expect(isGameTimedOut(waitingGame)).toEqual({ timedOut: false });

    // In-progress untimed game: should never be timed out
    const untimedGame = {
      status: 'in_progress',
      timeControlMinutes: 0,
      currentTurn: 'white',
      whiteTimeMs: 0,
      blackTimeMs: 0,
      blueTimeMs: 0,
      greenTimeMs: 0,
      lastTurnStartTimeMs: Date.now() - 400000,
    } as GameRoom;
    expect(isGameTimedOut(untimedGame)).toEqual({ timedOut: false });

    // In-progress active game within time: should not be timed out
    const liveGame = {
      status: 'in_progress',
      timeControlMinutes: 5,
      currentTurn: 'white',
      whiteTimeMs: 300000,
      blackTimeMs: 300000,
      blueTimeMs: 300000,
      greenTimeMs: 300000,
      lastTurnStartTimeMs: Date.now() - 10000, // 10s elapsed out of 300s
    } as GameRoom;
    expect(isGameTimedOut(liveGame)).toEqual({ timedOut: false });

    // In-progress game where active turn time has run out
    const expiredWhiteGame = {
      status: 'in_progress',
      timeControlMinutes: 2,
      currentTurn: 'white',
      whiteTimeMs: 120000,
      blackTimeMs: 120000,
      blueTimeMs: 120000,
      greenTimeMs: 120000,
      lastTurnStartTimeMs: Date.now() - 130000, // 130s elapsed out of 120s
    } as GameRoom;
    expect(isGameTimedOut(expiredWhiteGame)).toEqual({ timedOut: true, timedOutColor: 'white' });

    const expiredBlackGame = {
      status: 'in_progress',
      timeControlMinutes: 1,
      currentTurn: 'black',
      whiteTimeMs: 60000,
      blackTimeMs: 40000,
      blueTimeMs: 60000,
      greenTimeMs: 40000,
      lastTurnStartTimeMs: Date.now() - 50000, // 50s elapsed out of 40s
    } as GameRoom;
    expect(isGameTimedOut(expiredBlackGame)).toEqual({ timedOut: true, timedOutColor: 'black' });
  });

  it('filters out timed-out in-progress games in sortLobbyRooms and auto-resolves in cleanup', async () => {
    const creator = { id: 'p1', username: 'Host1', elo: 1300 };
    const { gameId } = await createGame({
      timeControlMinutes: 1,
      colorPref: 'white',
      isPrivate: false,
      creator,
    });

    // Join second player
    localStorage.removeItem('schada_player_token_' + gameId);
    await joinGame(gameId, { id: 'p2', username: 'Player2', elo: 1200 });

    // Game is now in_progress. Simulate time elapsed exceeding 1 minute
    const raw = localStorage.getItem(MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.localGames);
    const parsed = JSON.parse(raw || '{}');
    parsed[gameId].lastTurnStartTimeMs = Date.now() - 70000; // 70s elapsed on 60s clock
    localStorage.setItem(MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.localGames, JSON.stringify(parsed));

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
    expect(nonNullGame.winner).toBe('black'); // white ran out of time, black won
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

    // Guest seeker looking for games without specifying isRanked must NEVER get ranked game
    const guestFoundDefault = await findOpenWaitingGame(10, 0, 'guest_seeker');
    expect(guestFoundDefault).not.toBeNull();
    expect(guestFoundDefault?.id).toBe(casualGameId);
    expect(guestFoundDefault?.isRanked).toBe(false);

    // Guest seeker requesting a ranked game must return null
    const guestFoundRanked = await findOpenWaitingGame(10, 0, 'guest_seeker', 10, true);
    expect(guestFoundRanked).toBeNull();
  });

  it('strictly forbids guests from joining a ranked game as a player via joinGame', async () => {
    const rankedHost = { id: 'usr_ranked_host', username: 'RankedHost', elo: 1350 };
    const { gameId } = await createGame({
      timeControlMinutes: 5,
      isRanked: true,
      colorPref: 'white',
      creator: rankedHost,
    });

    // Clear host token from localStorage so joiner behaves as separate client
    localStorage.removeItem(MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.playerTokenPrefix + gameId);

    // 1. Guest with guest_ prefix attempts to join
    const guestJoiner = { id: 'guest_attacker', username: 'GuestChallenger', elo: 1200 };
    const guestJoinRes = await joinGame(gameId, guestJoiner);
    expect(guestJoinRes.success).toBe(false);
    expect(guestJoinRes.role).toBe('spectator');
    expect(guestJoinRes.error).toContain('Guests cannot play in ranked games');

    // Verify room is still waiting and has no opponent
    const gameSnapshot = localGameStore.get(gameId);
    expect(gameSnapshot?.status).toBe('waiting');
    expect(gameSnapshot?.blackPlayer).toBeNull();

    // 2. Anonymous guest with 'guest' ID attempts to join
    const anonJoiner = { id: 'guest', username: 'GuestAnon', elo: 1200 };
    const anonJoinRes = await joinGame(gameId, anonJoiner);
    expect(anonJoinRes.success).toBe(false);
    expect(anonJoinRes.role).toBe('spectator');
    expect(anonJoinRes.error).toContain('Guests cannot play in ranked games');

    // 3. Registered user joins successfully
    const regJoiner = { id: 'usr_legit_challenger', username: 'LegitChallenger', elo: 1320 };
    const regJoinRes = await joinGame(gameId, regJoiner);
    expect(regJoinRes.success).toBe(true);
    expect(regJoinRes.role).toBe('player');
    expect(regJoinRes.color).toBe('black');

    const updatedGame = localGameStore.get(gameId);
    expect(updatedGame?.status).toBe('in_progress');
    expect(updatedGame?.blackPlayer?.id).toBe('usr_legit_challenger');
  });

  it('returns null in computeRankedGameEloResult if either player is a guest', async () => {
    const host = { id: 'usr_valid_player', username: 'ValidPlayer', elo: 1400 };
    const { gameId } = await createGame({
      timeControlMinutes: 5,
      isRanked: true,
      colorPref: 'white',
      creator: host,
    });

    const game = localGameStore.get(gameId)!;
    // Artificially inject guest as opponent to test defensive Elo barrier
    game.blackPlayer = {
      id: 'guest_infiltrator',
      username: 'GuestInfiltrator',
      elo: 1200,
      gamesPlayed: 0,
      sessionToken: 'token_guest',
    };

    const eloResult = computeRankedGameEloResult(game, 'white');
    expect(eloResult).toBeNull();
  });

  it('correctly completes game and computes ranked Elo when resigning', async () => {
    const creator = { id: 'p1_resign', username: 'Boogerd1936', elo: 1200, gamesPlayed: 10 };
    const joiner = { id: 'p2_winner', username: 'mutagenicpixels', elo: 1200, gamesPlayed: 10 };

    const { gameId, color: creatorColor } = await createGame({
      timeControlMinutes: 5,
      isRanked: true,
      colorPref: 'white',
      creator,
    });
    expect(creatorColor).toBe('white');

    localStorage.removeItem('schada_player_token_' + gameId);
    const joinRes = await joinGame(gameId, joiner);
    expect(joinRes.success).toBe(true);
    expect(joinRes.color).toBe('black');

    // Boogerd1936 (white) resigns
    await resignGameAction(gameId, 'white');

    let gameAfterResign: any = null;
    const unsub = subscribeToGame(gameId, (g) => {
      gameAfterResign = g;
    });
    unsub();

    expect(gameAfterResign).not.toBeNull();
    expect(gameAfterResign.status).toBe('completed');
    expect(gameAfterResign.winner).toBe('black');
    expect(gameAfterResign.winReason).toBe('resignation');
    expect(gameAfterResign.eloResult).toBeDefined();
    expect(gameAfterResign.eloResult.whiteDelta).toBeLessThan(0);
    expect(gameAfterResign.eloResult.blackDelta).toBeGreaterThan(0);
    expect(gameAfterResign.processedEloUserIds).toContain('p1_resign');
  });

  it('correctly completes game and computes ranked Elo upon timeout', async () => {
    const creator = { id: 'p1_time', username: 'PlayerOne', elo: 1200, gamesPlayed: 5 };
    const joiner = { id: 'p2_winner_time', username: 'PlayerTwo', elo: 1200, gamesPlayed: 5 };

    const { gameId } = await createGame({
      timeControlMinutes: 5,
      isRanked: true,
      colorPref: 'white',
      creator,
    });

    localStorage.removeItem('schada_player_token_' + gameId);
    await joinGame(gameId, joiner);

    // White times out
    await timeoutGameAction(gameId, 'white');

    let gameAfterTimeout: any = null;
    const unsub = subscribeToGame(gameId, (g) => {
      gameAfterTimeout = g;
    });
    unsub();

    expect(gameAfterTimeout).not.toBeNull();
    expect(gameAfterTimeout.status).toBe('completed');
    expect(gameAfterTimeout.winner).toBe('black');
    expect(gameAfterTimeout.winReason).toBe('timeout');
    expect(gameAfterTimeout.eloResult).toBeDefined();
    expect(gameAfterTimeout.eloResult.whiteDelta).toBeLessThan(0);
    expect(gameAfterTimeout.eloResult.blackDelta).toBeGreaterThan(0);
    expect(gameAfterTimeout.processedEloUserIds).toContain('p1_time');
  });

  it('updates stats and returns UserProfile when resigning in ranked and unranked games', async () => {
    const user1 = await registerUser('ranked_resigner@example.com', 'password123', 'RankedResigner');
    const creator = { id: user1.id, username: user1.username, elo: user1.perModeStats.blitz.elo, gamesPlayed: user1.perModeStats.blitz.gamesPlayed };
    const { gameId } = await createGame({
      timeControlMinutes: 5,
      colorPref: 'white',
      isRanked: true,
      creator,
    });

    localStorage.removeItem('schada_player_token_' + gameId);
    await joinGame(gameId, { id: 'p_winner', username: 'Winner', elo: 1200 });

    const updatedProfile = await resignGameAction(gameId, 'white');
    expect(updatedProfile).not.toBeNull();
    expect(updatedProfile?.perModeStats?.blitz.gamesPlayed).toBe(1);
    expect(updatedProfile?.perModeStats?.blitz.gamesLost).toBe(1);
    expect(updatedProfile?.perModeStats?.blitz.elo).toBeLessThan(user1.perModeStats.blitz.elo);

    // Now test unranked game
    const user2 = await registerUser('casual_resigner@example.com', 'password123', 'CasualResigner');
    const unrankedCreator = { id: user2.id, username: user2.username, elo: user2.perModeStats.blitz.elo, gamesPlayed: user2.perModeStats.blitz.gamesPlayed };
    const { gameId: unrankedId } = await createGame({
      timeControlMinutes: 5,
      colorPref: 'white',
      isRanked: false,
      creator: unrankedCreator,
    });

    localStorage.removeItem('schada_player_token_' + unrankedId);
    await joinGame(unrankedId, { id: 'p_casual_winner', username: 'CasualWinner', elo: 1200 });

    const unrankedUpdated = await resignGameAction(unrankedId, 'white');
    expect(unrankedUpdated).not.toBeNull();
    expect(unrankedUpdated?.perModeStats?.blitz.gamesPlayed).toBe(1);
    expect(unrankedUpdated?.perModeStats?.blitz.gamesLost).toBe(1);
    expect(unrankedUpdated?.perModeStats?.blitz.elo).toBe(1200); // Unchanged in casual game
  });

  it('updates stats and returns UserProfile when timing out in ranked and unranked games', async () => {
    const user1 = await registerUser('ranked_timeout@example.com', 'password123', 'RankedTimeout');
    const creator = { id: user1.id, username: user1.username, elo: user1.perModeStats.blitz.elo, gamesPlayed: user1.perModeStats.blitz.gamesPlayed };
    const { gameId } = await createGame({
      timeControlMinutes: 5,
      colorPref: 'black',
      isRanked: true,
      creator,
    });

    localStorage.removeItem('schada_player_token_' + gameId);
    await joinGame(gameId, { id: 'p_time_winner', username: 'TimeWinner', elo: 1200 });

    const updatedProfile = await timeoutGameAction(gameId, 'black');
    expect(updatedProfile).not.toBeNull();
    expect(updatedProfile?.perModeStats?.blitz.gamesPlayed).toBe(1);
    expect(updatedProfile?.perModeStats?.blitz.gamesLost).toBe(1);
    expect(updatedProfile?.perModeStats?.blitz.elo).toBeLessThan(user1.perModeStats.blitz.elo);

    // Now test unranked timeout
    const user2 = await registerUser('casual_timeout@example.com', 'password123', 'CasualTimeout');
    const unrankedCreator = { id: user2.id, username: user2.username, elo: user2.perModeStats.blitz.elo, gamesPlayed: user2.perModeStats.blitz.gamesPlayed };
    const { gameId: unrankedId } = await createGame({
      timeControlMinutes: 5,
      colorPref: 'black',
      isRanked: false,
      creator: unrankedCreator,
    });

    localStorage.removeItem('schada_player_token_' + unrankedId);
    await joinGame(unrankedId, { id: 'p_casual_time_win', username: 'TimeCasualWinner', elo: 1200 });

    const unrankedUpdated = await timeoutGameAction(unrankedId, 'black');
    expect(unrankedUpdated).not.toBeNull();
    expect(unrankedUpdated?.perModeStats?.blitz.gamesPlayed).toBe(1);
    expect(unrankedUpdated?.perModeStats?.blitz.gamesLost).toBe(1);
    expect(unrankedUpdated?.perModeStats?.blitz.elo).toBe(1200);
  });

  it('preserves immutable initial ratings in computeRankedGameEloResult', async () => {
    const creator = { id: 'p_auth_1', username: 'PlayerOne', elo: 1400, gamesPlayed: 20 };
    const { gameId } = await createGame({
      timeControlMinutes: 5,
      colorPref: 'white',
      isRanked: true,
      creator,
    });

    localStorage.removeItem('schada_player_token_' + gameId);
    await joinGame(gameId, { id: 'p_auth_2', username: 'PlayerTwo', elo: 1250, gamesPlayed: 5 });

    let currentGame: GameRoom | null = null;
    const unsub = subscribeToGame(gameId, (g) => {
      currentGame = g;
    });

    expect(currentGame).not.toBeNull();
    const eloResult = computeRankedGameEloResult(currentGame!, 'white');
    expect(eloResult).not.toBeNull();
    expect(eloResult?.initialWhiteElo).toBe(1400);
    expect(eloResult?.initialBlackElo).toBe(1250);
    expect(eloResult?.whiteDelta).toBeGreaterThan(0);
    expect(eloResult?.blackDelta).toBeLessThan(0);
    expect(eloResult?.newWhiteElo).toBe(1400 + eloResult!.whiteDelta);
    unsub();
  });

  it('symmetrically updates both winner and loser in ranked game resolution', async () => {
    const userA = await registerUser('player_a@example.com', 'password123', 'PlayerA');
    const userB = await registerUser('player_b@example.com', 'password123', 'PlayerB');

    const { gameId } = await createGame({
      timeControlMinutes: 5,
      colorPref: 'white',
      isRanked: true,
      creator: { id: userA.id, username: userA.username, elo: userA.perModeStats.blitz.elo, gamesPlayed: userA.perModeStats.blitz.gamesPlayed },
    });

    localStorage.removeItem('schada_player_token_' + gameId);
    await joinGame(gameId, { id: userB.id, username: userB.username, elo: userB.perModeStats.blitz.elo, gamesPlayed: userB.perModeStats.blitz.gamesPlayed });

    // White player resigns -> Black player (userB) wins
    await resignGameAction(gameId, 'white');

    const updatedUserA = localBackend.getUserById(userA.id);
    const updatedUserB = localBackend.getUserById(userB.id);

    expect(updatedUserA).not.toBeNull();
    expect(updatedUserB).not.toBeNull();
    expect(updatedUserA!.perModeStats.blitz.gamesPlayed).toBe(1);
    expect(updatedUserA!.perModeStats.blitz.gamesLost).toBe(1);
    expect(updatedUserA!.perModeStats.blitz.elo).toBeLessThan(userA.perModeStats.blitz.elo);

    expect(updatedUserB!.perModeStats.blitz.gamesPlayed).toBe(1);
    expect(updatedUserB!.perModeStats.blitz.gamesWon).toBe(1);
    expect(updatedUserB!.perModeStats.blitz.elo).toBeGreaterThan(userB.perModeStats.blitz.elo);
  });

  it('reconciles pending Elo for a user whose game ended without processed rating', async () => {
    const userA = await registerUser('player_c@example.com', 'password123', 'PlayerC');
    const userB = await registerUser('player_d@example.com', 'password123', 'PlayerD');

    const { gameId } = await createGame({
      timeControlMinutes: 5,
      colorPref: 'white',
      isRanked: true,
      creator: { id: userA.id, username: userA.username, elo: userA.perModeStats.blitz.elo, gamesPlayed: userA.perModeStats.blitz.gamesPlayed },
    });

    localStorage.removeItem('schada_player_token_' + gameId);
    await joinGame(gameId, { id: userB.id, username: userB.username, elo: userB.perModeStats.blitz.elo, gamesPlayed: userB.perModeStats.blitz.gamesPlayed });

    // Mark game completed in localGameStore where userB won but only userA was marked processed
    const game = localGameStore.get(gameId);
    expect(game).not.toBeNull();
    if (game) {
      game.status = 'completed';
      game.winner = 'black';
      game.processedEloUserIds = [userA.id];
      localGameStore.set(game);
    }

    // Run reconciliation
    const reconciled = await reconcilePendingElo(userB.id);

    expect(reconciled).not.toBeNull();
    expect(reconciled!.perModeStats.blitz.gamesPlayed).toBe(1);
    expect(reconciled!.perModeStats.blitz.gamesWon).toBe(1);
    expect(reconciled!.perModeStats.blitz.elo).toBeGreaterThan(userB.perModeStats.blitz.elo);
  });

  describe('9-digit Alphanumeric Game ID Generation and Collision Prevention', () => {
    it('generates a 9-digit alphanumeric case-sensitive ID matching SECURITY_CONFIG pattern', () => {
      const id = generateGameId();
      expect(id).toHaveLength(SECURITY_CONFIG.gameIdLength);
      expect(id).toMatch(new RegExp(SECURITY_CONFIG.gameIdRegexPattern));
      for (const char of id) {
        expect(SECURITY_CONFIG.gameIdCharset).toContain(char);
      }
    });

    it('generates case-sensitive alphanumeric IDs with diverse uppercase, lowercase, and digit characters', () => {
      const ids = Array.from({ length: 50 }, () => generateGameId());
      expect(new Set(ids).size).toBe(50);

      const allChars = ids.join('');
      expect(/[0-9]/.test(allChars)).toBe(true);
      expect(/[a-z]/.test(allChars)).toBe(true);
      expect(/[A-Z]/.test(allChars)).toBe(true);
    });

    it('creates game with a canonical 9-character ID', async () => {
      const creator = { id: 'user_gen_test', username: 'TestHost', elo: 1300 };
      const { gameId } = await createGame({
        timeControlMinutes: 5,
        colorPref: 'white',
        creator,
      });

      expect(gameId).toHaveLength(9);
      expect(gameId).toMatch(/^[0-9a-zA-Z]{9}$/);
    });

    it('prevents duplicates by retrying when an ID collision is encountered in store', async () => {
      const creator = { id: 'user_dup_test', username: 'DupTester', elo: 1300 };

      // Pre-seed a game with a specific ID
      const initialGame = await createGame({
        timeControlMinutes: 5,
        colorPref: 'white',
        creator,
      });
      expect(initialGame.gameId).toHaveLength(9);

      // Verify that createGame creates another unique game without colliding
      const secondGame = await createGame({
        timeControlMinutes: 5,
        colorPref: 'white',
        creator,
      });
      expect(secondGame.gameId).toHaveLength(9);
      expect(secondGame.gameId).not.toBe(initialGame.gameId);
    });

    it('throws a meaningful error when max retry attempts are exhausted due to continuous collisions', async () => {
      const creator = { id: 'user_exhaust_test', username: 'ExhaustTester', elo: 1300 };

      // Mock localGameStore.get to simulate every candidate ID already existing
      const originalGet = localGameStore.get.bind(localGameStore);
      const dummyRoom = {
        id: 'dummy1234',
        status: 'waiting',
      } as unknown as GameRoom;
      vi.spyOn(localGameStore, 'get').mockReturnValue(dummyRoom);

      await expect(
        createGame({
          timeControlMinutes: 5,
          colorPref: 'white',
          creator,
        })
      ).rejects.toThrow(
        `Failed to generate a unique game ID after ${SECURITY_CONFIG.maxGameIdCreationRetries} retry attempts.`
      );

      vi.spyOn(localGameStore, 'get').mockImplementation(originalGet);
    });
  });
});


