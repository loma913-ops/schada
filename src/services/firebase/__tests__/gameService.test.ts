import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createGame,
  joinGame,
  makeGameMove,
  resignGameAction,
  abandonGame,
  getOpenRooms,
  getLocalSessionToken,
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
});
