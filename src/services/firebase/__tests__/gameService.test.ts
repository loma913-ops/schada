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
  ABANDONED_GAME_EXPIRY_MS,
} from '../gameService';
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

    let fetchedGame: any = null;
    const unsub = subscribeToGame(gameId, (g) => {
      fetchedGame = g;
    });
    unsub();

    expect(fetchedGame).not.toBeNull();
    expect(fetchedGame.status).toBe('abandoned');
    expect(fetchedGame.abandonedAt).toBeGreaterThanOrEqual(before);
    expect(fetchedGame.abandonedAt).toBeLessThanOrEqual(after);
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

    // Run cleanup with standard 10 minutes (600,000 ms) threshold
    const removed = await cleanupAbandonedGames(ABANDONED_GAME_EXPIRY_MS);
    expect(removed).not.toContain(gameId);

    let fetchedGame: any = null;
    const unsub = subscribeToGame(gameId, (g) => {
      fetchedGame = g;
    });
    unsub();

    expect(fetchedGame).not.toBeNull();
    expect(fetchedGame.status).toBe('abandoned');
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

    // Simulate 10 minutes (600,000 ms) having passed since abandonment by running cleanup with maxAgeMs = 0
    const removed = await cleanupAbandonedGames(0);
    expect(removed).toContain(gameId);

    // Game should now be completely deleted from store
    let fetchedGame: any = 'initial';
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

    let activeGame: any = null;
    const unsub = subscribeToGame(activeGameId, (g) => {
      activeGame = g;
    });
    unsub();

    expect(activeGame).not.toBeNull();
    expect(activeGame.status).toBe('waiting');
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

    // Manually manipulate the stored mock game abandonedAt to be 11 minutes ago
    const raw = localStorage.getItem('schada_mock_games');
    const parsed = JSON.parse(raw || '{}');
    parsed[gameId].abandonedAt = Date.now() - 11 * 60 * 1000;
    localStorage.setItem('schada_mock_games', JSON.stringify(parsed));

    let fetchedGame: any = 'placeholder';
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

    let fetchedGame: any = 'placeholder';
    const unsub = subscribeToGame(gameId, (g) => {
      fetchedGame = g;
    });
    unsub();

    expect(fetchedGame).toBeNull();
    expect(getLocalSessionToken(gameId)).toBeNull();
  });
});
