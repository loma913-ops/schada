import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LeaderboardTable } from '../LeaderboardTable';
import { isHumanLeaderboardEligible, type UserProfile } from '@/services/firebase/localProvider';
import { MULTIPLAYER_SCALE_CONFIG } from '@/services/firebase/multiplayerConfig';

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

class StorageMock {
  private store: Record<string, string> = {};

  get length() {
    return Object.keys(this.store).length;
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }

  getItem(key: string) {
    return this.store[key] ?? null;
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
  (globalThis as any).localStorage = new StorageMock();
}

describe('LeaderboardTable & Human Player Filtering', () => {
  const CACHE_KEY = MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.cachedLeaderboard;
  const CACHE_TIME_KEY = MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.cachedLeaderboardTime;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('isHumanLeaderboardEligible()', () => {
    const validHumanUser: UserProfile = {
      id: 'usr_valid_human_1',
      username: 'HumanGrandmaster',
      usernameLower: 'humangrandmaster',
      email: 'human@schada.org',
      usernameChangeCount: 0,
      status: 'offline',
      createdAt: '2026-01-01T00:00:00.000Z',
      perModeStats: {
        bullet: { elo: 1200, gamesPlayed: 0, gamesWon: 0, gamesLost: 0, gamesDrawn: 0 },
        blitz: { elo: 1450, gamesPlayed: 8, gamesWon: 6, gamesLost: 1, gamesDrawn: 1 },
        rapid: { elo: 1300, gamesPlayed: 2, gamesWon: 1, gamesLost: 1, gamesDrawn: 0 },
        classical: { elo: 1200, gamesPlayed: 0, gamesWon: 0, gamesLost: 0, gamesDrawn: 0 },
        correspondence: { elo: 1200, gamesPlayed: 0, gamesWon: 0, gamesLost: 0, gamesDrawn: 0 },
      },
    };

    it('accepts human players who have played at least 1 game in the selected mode', () => {
      expect(isHumanLeaderboardEligible(validHumanUser, 'blitz')).toBe(true);
      expect(isHumanLeaderboardEligible(validHumanUser, 'rapid')).toBe(true);
    });

    it('rejects human players who have 0 games played in the selected mode', () => {
      expect(isHumanLeaderboardEligible(validHumanUser, 'bullet')).toBe(false);
      expect(isHumanLeaderboardEligible(validHumanUser, 'classical')).toBe(false);
      expect(isHumanLeaderboardEligible(validHumanUser, 'correspondence')).toBe(false);
    });

    it('rejects accounts with bot/guest/mock prefixes from MULTIPLAYER_SCALE_CONFIG', () => {
      const guestUser: UserProfile = { ...validHumanUser, id: 'guest_abc123' };
      const botUser: UserProfile = { ...validHumanUser, id: 'bot_tier_4' };
      const mockUser: UserProfile = { ...validHumanUser, id: 'mock-grandmaster' };

      expect(isHumanLeaderboardEligible(guestUser, 'blitz')).toBe(false);
      expect(isHumanLeaderboardEligible(botUser, 'blitz')).toBe(false);
      expect(isHumanLeaderboardEligible(mockUser, 'blitz')).toBe(false);
    });

    it('rejects null, undefined, or malformed user profiles', () => {
      expect(isHumanLeaderboardEligible(null, 'blitz')).toBe(false);
      expect(isHumanLeaderboardEligible(undefined, 'blitz')).toBe(false);
      expect(isHumanLeaderboardEligible({ ...validHumanUser, id: '' }, 'blitz')).toBe(false);
      expect(isHumanLeaderboardEligible({ ...validHumanUser, username: '' }, 'blitz')).toBe(false);
    });
  });

  describe('LeaderboardTable Component Rendering & Stale-While-Revalidate Caching', () => {
    it('renders the initial loading state on cache miss', () => {
      const html = renderToStaticMarkup(<LeaderboardTable />);

      expect(html).toContain('Global Leaderboard');
      expect(html).toContain('Loading leaderboard...');
      expect(html).toContain('Refresh');
    });

    it('renders the empty state message when cache contains 0 qualifying players', () => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`${CACHE_KEY}_blitz`, JSON.stringify([]));
        localStorage.setItem(`${CACHE_TIME_KEY}_blitz`, String(Date.now()));
      }

      const html = renderToStaticMarkup(<LeaderboardTable />);

      expect(html).toContain('No players ranked yet. Play a rated match to appear on the leaderboard!');
      expect(html).not.toContain('Loading leaderboard...');
    });

    it('renders cached human players instantly without loading spinner', () => {
      const cachedPlayer: UserProfile = {
        id: 'usr_champ_99',
        username: 'KasparovSchada',
        usernameLower: 'kasparovschada',
        email: 'champ@schada.org',
        usernameChangeCount: 0,
        status: 'online',
        createdAt: '2026-01-01T00:00:00.000Z',
        perModeStats: {
          bullet: { elo: 1200, gamesPlayed: 0, gamesWon: 0, gamesLost: 0, gamesDrawn: 0 },
          blitz: { elo: 1720, gamesPlayed: 25, gamesWon: 20, gamesLost: 3, gamesDrawn: 2 },
          rapid: { elo: 1200, gamesPlayed: 0, gamesWon: 0, gamesLost: 0, gamesDrawn: 0 },
          classical: { elo: 1200, gamesPlayed: 0, gamesWon: 0, gamesLost: 0, gamesDrawn: 0 },
          correspondence: { elo: 1200, gamesPlayed: 0, gamesWon: 0, gamesLost: 0, gamesDrawn: 0 },
        },
      };

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`${CACHE_KEY}_blitz`, JSON.stringify([cachedPlayer]));
        localStorage.setItem(`${CACHE_TIME_KEY}_blitz`, String(Date.now()));
      }

      const html = renderToStaticMarkup(<LeaderboardTable />);

      expect(html).not.toContain('Loading leaderboard...');
      expect(html).toContain('KasparovSchada');
      expect(html).toContain('1720');
      expect(html).toContain('Updated just now');
    });

    it('ensures localBackend.getLeaderboard strictly excludes mock/bot accounts', async () => {
      const { localBackend } = await import('@/services/firebase/localProvider');
      const leaderboard = localBackend.getLeaderboard('blitz');

      // None of the mock accounts (mock-grandmaster, mock-tactician, etc.) should be in the leaderboard
      for (const player of leaderboard) {
        expect(player.id).not.toMatch(/^(guest_|mock-|bot_)/);
      }
    });
  });
});
