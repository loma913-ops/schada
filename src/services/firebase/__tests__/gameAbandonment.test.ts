import { describe, it, expect, beforeEach, vi } from 'vitest';

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

if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = new LocalStorageMock();
}

import {
  evaluateGameAbandonment,
  computeAbandonmentTransition,
  setPlayerDisconnectedAction,
  abandonGameDueToDisconnectAction,
  createGame,
  localGameStore,
  cleanupAbandonedGames,
  type GameRoom,
} from '../gameService';
import { createInitialGameState } from '@/core/schada/engine';

describe('Game Disconnection & Abandonment Logic', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const baseGame: GameRoom = {
    id: 'test_abandon_1',
    isPrivate: false,
    status: 'in_progress',
    createdAt: Date.now() - 100000,
    timeControlMinutes: 5,
    incrementSeconds: 0,
    isRanked: false,
    creatorColorPref: 'blue',
    bluePlayer: { id: 'blue_1', username: 'BluePlayer', elo: 1200, sessionToken: 'tok_blue' },
    greenPlayer: { id: 'green_1', username: 'GreenPlayer', elo: 1200, sessionToken: 'tok_green' },
    boardState: createInitialGameState(),
    currentTurn: 'blue',
    blueTimeMs: 300000,
    greenTimeMs: 300000,
    lastTurnStartTimeMs: Date.now() - 10000,
  };

  describe('evaluateGameAbandonment', () => {
    it('returns not disconnected if game is not in progress or null', () => {
      expect(evaluateGameAbandonment(null)).toEqual({ isDisconnected: false, shouldAbandon: false });
      expect(evaluateGameAbandonment({ ...baseGame, status: 'completed' })).toEqual({
        isDisconnected: false,
        shouldAbandon: false,
      });
      expect(evaluateGameAbandonment({ ...baseGame, status: 'waiting' })).toEqual({
        isDisconnected: false,
        shouldAbandon: false,
      });
    });

    it('returns not disconnected for correspondence games', () => {
      const correspondenceGame: GameRoom = {
        ...baseGame,
        timeControlMinutes: 1440, // 1 day
        blueDisconnectedAt: Date.now() - 120000,
      };
      expect(evaluateGameAbandonment(correspondenceGame)).toEqual({
        isDisconnected: false,
        shouldAbandon: false,
      });
    });

    it('returns not disconnected for unlimited time games', () => {
      const unlimitedGame: GameRoom = {
        ...baseGame,
        timeControlMinutes: 0,
        blueDisconnectedAt: Date.now() - 120000,
      };
      expect(evaluateGameAbandonment(unlimitedGame)).toEqual({
        isDisconnected: false,
        shouldAbandon: false,
      });
    });

    it('returns not disconnected if neither player is disconnected', () => {
      expect(evaluateGameAbandonment(baseGame)).toEqual({
        isDisconnected: false,
        shouldAbandon: false,
      });
    });

    it('marks opponent disconnected without abandonment if it is not their turn', () => {
      const now = 1000000;
      const game: GameRoom = {
        ...baseGame,
        currentTurn: 'blue',
        greenDisconnectedAt: now - 90000, // Green disconnected 90s ago
      };
      const res = evaluateGameAbandonment(game, now);
      expect(res).toEqual({
        isDisconnected: true,
        disconnectedColor: 'green',
        shouldAbandon: false,
      });
    });

    it('does not abandon if disconnected turn player remaining clock <= 60s (must lose on time)', () => {
      const now = 1000000;
      const game: GameRoom = {
        ...baseGame,
        currentTurn: 'blue',
        blueTimeMs: 45000, // 45s remaining (< 60s)
        lastTurnStartTimeMs: now,
        blueDisconnectedAt: now - 80000, // Disconnected 80s ago
      };
      const res = evaluateGameAbandonment(game, now, 60000);
      expect(res.isDisconnected).toBe(true);
      expect(res.disconnectedColor).toBe('blue');
      expect(res.shouldAbandon).toBe(false);
      expect(res.remainingGraceSeconds).toBeUndefined();
    });

    it('counts down remaining grace seconds when turn player has > 60s and absence < 60s', () => {
      const now = 1000000;
      const turnStart = now - 25000;
      const dcTime = now - 25000;
      const game: GameRoom = {
        ...baseGame,
        currentTurn: 'blue',
        blueTimeMs: 180000, // 3 minutes (> 60s)
        lastTurnStartTimeMs: turnStart,
        blueDisconnectedAt: dcTime,
      };
      const res = evaluateGameAbandonment(game, now, 60000);
      expect(res.isDisconnected).toBe(true);
      expect(res.disconnectedColor).toBe('blue');
      expect(res.shouldAbandon).toBe(false);
      expect(res.remainingGraceSeconds).toBe(35); // 60 - 25 = 35s
    });

    it('declares abandonment when turn player has > 60s and absence >= 60s', () => {
      const now = 1000000;
      const turnStart = now - 65000;
      const dcTime = now - 65000;
      const game: GameRoom = {
        ...baseGame,
        currentTurn: 'blue',
        blueTimeMs: 180000,
        lastTurnStartTimeMs: turnStart,
        blueDisconnectedAt: dcTime,
      };
      const res = evaluateGameAbandonment(game, now, 60000);
      expect(res.isDisconnected).toBe(true);
      expect(res.disconnectedColor).toBe('blue');
      expect(res.shouldAbandon).toBe(true);
      expect(res.remainingGraceSeconds).toBe(0);
    });

    it('measures absence on turn starting from turn start if player disconnected during opponent turn', () => {
      const now = 1000000;
      const dcTime = now - 120000; // Disconnected 2 mins ago while opponent thought
      const turnStart = now - 20000; // Opponent moved 20s ago
      const game: GameRoom = {
        ...baseGame,
        currentTurn: 'blue',
        blueTimeMs: 180000,
        lastTurnStartTimeMs: turnStart,
        blueDisconnectedAt: dcTime,
      };
      const res = evaluateGameAbandonment(game, now, 60000);
      expect(res.shouldAbandon).toBe(false);
      expect(res.remainingGraceSeconds).toBe(40); // 60s - 20s = 40s
    });
  });

  describe('computeAbandonmentTransition', () => {
    it('computes clean abandonment transition for casual game', () => {
      const game: GameRoom = {
        ...baseGame,
        isRanked: false,
      };
      const result = computeAbandonmentTransition(game, 'blue');
      expect(result.updatePayload.status).toBe('completed');
      expect(result.updatePayload.winner).toBe('green');
      expect(result.updatePayload.winReason).toBe('abandonment');
      expect(result.updatePayload.lastTurnStartTimeMs).toBeNull();
      expect(result.updatePayload.blueDisconnectedAt).toBeNull();
      expect(result.updatePayload.greenDisconnectedAt).toBeNull();
      expect(result.winnerPlayerId).toBe('green_1');
      expect(result.abandonedPlayerId).toBe('blue_1');
      expect(result.isRanked).toBe(false);
    });

    it('calculates Elo adjustments for ranked game', () => {
      const rankedGame: GameRoom = {
        ...baseGame,
        isRanked: true,
        bluePlayer: { id: 'blue_1', username: 'Blue', elo: 1200, gamesPlayed: 30, sessionToken: 'tok_b' },
        greenPlayer: { id: 'green_1', username: 'Green', elo: 1200, gamesPlayed: 30, sessionToken: 'tok_g' },
      };
      const result = computeAbandonmentTransition(rankedGame, 'blue');
      expect(result.isRanked).toBe(true);
      expect(result.winnerDelta).toBeGreaterThan(0);
      expect(result.abandonedDelta).toBeLessThan(0);
      expect(result.updatePayload.eloResult).toBeDefined();
      expect(result.updatePayload.greenPlayer?.elo).toBeGreaterThan(1200);
      expect(result.updatePayload.bluePlayer?.elo).toBeLessThan(1200);
    });
  });

  describe('Game Service Disconnection & Abandonment actions', () => {
    it('sets and clears player disconnected status via setPlayerDisconnectedAction', async () => {
      const created = await createGame({
        timeControlMinutes: 5,
        creator: { id: 'blue_user', username: 'BlueUser', elo: 1200 },
      });
      // Set in_progress
      const before = await localGameStore.get(created.gameId);
      expect(before).not.toBeNull();
      const now = Date.now();
      const inProgressGame: GameRoom = {
        ...before!,
        status: 'in_progress',
        greenPlayer: { id: 'green_user', username: 'GreenUser', elo: 1200, sessionToken: 'tok_g' },
        lastTurnStartTimeMs: now,
      };
      if (typeof localStorage !== 'undefined') {
        const key = 'schada_local_games';
        const games = JSON.parse(localStorage.getItem(key) || '{}');
        games[created.gameId] = inProgressGame;
        localStorage.setItem(key, JSON.stringify(games));
      }

      await setPlayerDisconnectedAction(created.gameId, 'blue', true);
      let updated = await localGameStore.get(created.gameId);
      expect(updated?.blueDisconnectedAt).toBeGreaterThanOrEqual(now);

      await setPlayerDisconnectedAction(created.gameId, 'blue', false);
      updated = await localGameStore.get(created.gameId);
      expect(updated?.blueDisconnectedAt).toBeNull();
    });

    it('completes game with abandonment victory via abandonGameDueToDisconnectAction', async () => {
      const created = await createGame({
        timeControlMinutes: 5,
        creator: { id: 'blue_user', username: 'BlueUser', elo: 1200 },
      });
      const before = await localGameStore.get(created.gameId);
      const inProgressGame: GameRoom = {
        ...before!,
        status: 'in_progress',
        greenPlayer: { id: 'green_user', username: 'GreenUser', elo: 1200, sessionToken: 'tok_g' },
        lastTurnStartTimeMs: Date.now() - 70000,
        blueDisconnectedAt: Date.now() - 70000,
      };
      if (typeof localStorage !== 'undefined') {
        const key = 'schada_local_games';
        const games = JSON.parse(localStorage.getItem(key) || '{}');
        games[created.gameId] = inProgressGame;
        localStorage.setItem(key, JSON.stringify(games));
      }

      await abandonGameDueToDisconnectAction(created.gameId, 'blue');
      const finished = await localGameStore.get(created.gameId);
      expect(finished?.status).toBe('completed');
      expect(finished?.winner).toBe('green');
      expect(finished?.winReason).toBe('abandonment');
    });

    it('auto-resolves abandoned game in cleanupAbandonedGames', async () => {
      const created = await createGame({
        timeControlMinutes: 5,
        creator: { id: 'blue_user', username: 'BlueUser', elo: 1200 },
      });
      const before = await localGameStore.get(created.gameId);
      const inProgressGame: GameRoom = {
        ...before!,
        status: 'in_progress',
        greenPlayer: { id: 'green_user', username: 'GreenUser', elo: 1200, sessionToken: 'tok_g' },
        currentTurn: 'blue',
        blueTimeMs: 180000,
        lastTurnStartTimeMs: Date.now() - 75000,
        blueDisconnectedAt: Date.now() - 75000,
      };
      if (typeof localStorage !== 'undefined') {
        const key = 'schada_local_games';
        const games = JSON.parse(localStorage.getItem(key) || '{}');
        games[created.gameId] = inProgressGame;
        localStorage.setItem(key, JSON.stringify(games));
      }

      await cleanupAbandonedGames();
      const finished = await localGameStore.get(created.gameId);
      expect(finished?.status).toBe('completed');
      expect(finished?.winner).toBe('green');
      expect(finished?.winReason).toBe('abandonment');
    });

    it('throws meaningful errors on invalid inputs', async () => {
      // evaluateGameAbandonment validation
      expect(() => evaluateGameAbandonment(baseGame, NaN)).toThrowError(RangeError);
      expect(() => evaluateGameAbandonment(baseGame, Date.now(), -5)).toThrowError(RangeError);
      expect(() => evaluateGameAbandonment(baseGame, Date.now(), 0)).toThrowError(RangeError);

      // computeAbandonmentTransition validation
      expect(() => computeAbandonmentTransition(null as any, 'blue')).toThrowError(TypeError);
      expect(() => computeAbandonmentTransition(baseGame, 'invalid' as any)).toThrowError(RangeError);

      // setPlayerDisconnectedAction validation
      await expect(setPlayerDisconnectedAction('', 'blue', true)).rejects.toThrowError(TypeError);
      await expect(setPlayerDisconnectedAction('   ', 'blue', true)).rejects.toThrowError(TypeError);
      await expect(setPlayerDisconnectedAction('game_123', 'yellow' as any, true)).rejects.toThrowError(RangeError);

      // abandonGameDueToDisconnectAction validation
      await expect(abandonGameDueToDisconnectAction('', 'blue')).rejects.toThrowError(TypeError);
      await expect(abandonGameDueToDisconnectAction('   ', 'blue')).rejects.toThrowError(TypeError);
      await expect(abandonGameDueToDisconnectAction('game_123', 'red' as any)).rejects.toThrowError(RangeError);
    });

    it('strictly exempts correspondence games from abandonment transitions and actions', async () => {
      const correspondenceGame: GameRoom = {
        ...baseGame,
        timeControlMinutes: 1440, // 1 day correspondence
        blueDisconnectedAt: Date.now() - 3600000, // 1 hour disconnected
        lastTurnStartTimeMs: Date.now() - 3600000,
        blueTimeMs: 86400000, // 24 hours remaining
      };

      // 1. evaluateGameAbandonment never triggers abandonment or disconnect for correspondence games
      expect(evaluateGameAbandonment(correspondenceGame)).toEqual({
        isDisconnected: false,
        shouldAbandon: false,
      });

      // 2. computeAbandonmentTransition rejects correspondence games
      expect(() => computeAbandonmentTransition(correspondenceGame, 'blue')).toThrowError(
        /Correspondence games .* are exempt from abandonment rules/
      );

      // 3. abandonGameDueToDisconnectAction returns null and leaves correspondence game in_progress
      const created = await createGame({
        timeControlMinutes: 1440,
        creator: { id: 'blue_corr', username: 'BlueCorr', elo: 1200 },
      });
      const stored = await localGameStore.get(created.gameId);
      const activeCorr: GameRoom = {
        ...stored!,
        status: 'in_progress',
        greenPlayer: { id: 'green_corr', username: 'GreenCorr', elo: 1200, sessionToken: 'tok_gc' },
        currentTurn: 'blue',
        blueTimeMs: 86400000,
        blueDisconnectedAt: null,
      };
      const key = 'schada_local_games';
      const games = JSON.parse(localStorage.getItem(key) || '{}');
      games[created.gameId] = activeCorr;
      localStorage.setItem(key, JSON.stringify(games));

      const result = await abandonGameDueToDisconnectAction(created.gameId, 'blue');
      expect(result).toBeNull();
      const stillActive = await localGameStore.get(created.gameId);
      expect(stillActive?.status).toBe('in_progress');

      // 4. setPlayerDisconnectedAction is a no-op for correspondence games
      await setPlayerDisconnectedAction(created.gameId, 'blue', true);
      const checkDc = await localGameStore.get(created.gameId);
      expect(checkDc?.blueDisconnectedAt).toBeFalsy();

      // 5. cleanupAbandonedGames does NOT mark waiting correspondence games as abandoned
      const waitingCorr = await createGame({
        timeControlMinutes: 2880, // 2 days
        creator: { id: 'blue_wait', username: 'BlueWait', elo: 1200 },
      });
      const waitingStored = await localGameStore.get(waitingCorr.gameId);
      const staleWaitingCorr: GameRoom = {
        ...waitingStored!,
        createdAt: Date.now() - 1000000, // older than 10 minutes
      };
      const gamesMap = JSON.parse(localStorage.getItem(key) || '{}');
      gamesMap[waitingCorr.gameId] = staleWaitingCorr;
      localStorage.setItem(key, JSON.stringify(gamesMap));

      await cleanupAbandonedGames();
      const afterCleanup = await localGameStore.get(waitingCorr.gameId);
      expect(afterCleanup?.status).toBe('waiting');

      // 6. Correspondence players ONLY lose when the time on their clock runs out
      // Simulate clock expired on turn
      const expiredCorr: GameRoom = {
        ...activeCorr,
        blueTimeMs: 1000,
        lastTurnStartTimeMs: Date.now() - 20000, // elapsed 20s > 1s clock
      };
      gamesMap[created.gameId] = expiredCorr;
      localStorage.setItem(key, JSON.stringify(gamesMap));

      await cleanupAbandonedGames();
      const timedOut = await localGameStore.get(created.gameId);
      expect(timedOut?.status).toBe('completed');
      expect(timedOut?.winner).toBe('green');
      expect(timedOut?.winReason).toBe('timeout');
    });
  });
});
