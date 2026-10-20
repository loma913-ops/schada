import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProfileModal } from '../ProfileModal';
import { PWA_CONFIG } from '@/services/pwa/pwaConfig';
import { CANONICAL_MATCH_HISTORY_CONFIG } from '@/components/history/matchHistoryConfig';

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

const mockUsePwa = vi.fn();
vi.mock('@/context/PwaContext', () => ({
  usePwa: () => mockUsePwa(),
}));

const mockUser = {
  id: 'usr_test_1',
  username: 'TestGrandmaster',
  email: 'grandmaster@schada.org',
  perModeStats: {
    bullet: { elo: 1200, gamesPlayed: 0, gamesWon: 0, gamesLost: 0, gamesDrawn: 0 },
    blitz: { elo: 1200, gamesPlayed: 0, gamesWon: 0, gamesLost: 0, gamesDrawn: 0 },
    rapid: { elo: 1200, gamesPlayed: 0, gamesWon: 0, gamesLost: 0, gamesDrawn: 0 },
    classical: { elo: 1200, gamesPlayed: 0, gamesWon: 0, gamesLost: 0, gamesDrawn: 0 },
    correspondence: { elo: 1200, gamesPlayed: 0, gamesWon: 0, gamesLost: 0, gamesDrawn: 0 },
  },
  status: 'online' as const,
  usernameChangeCount: 0,
  isPatron: false,
};

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    updateUsername: vi.fn(),
    logout: vi.fn(),
    deleteAccount: vi.fn(),
  }),
}));

vi.mock('@/context/GamePreferencesContext', () => ({
  useGamePreferences: () => ({
    showThreatIndicators: true,
    setShowThreatIndicators: vi.fn(),
  }),
}));

describe('ProfileModal - PWA Install App Section', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when isOpen is false', () => {
    mockUsePwa.mockReturnValue({
      isStandalone: false,
      isMobile: false,
      installModalOpen: false,
      setInstallModalOpen: vi.fn(),
      promptInstall: vi.fn(),
      config: PWA_CONFIG,
    });

    const html = renderToStaticMarkup(
      <ProfileModal isOpen={false} onClose={vi.fn()} />
    );

    expect(html).toBe('');
  });

  it('renders the Install Application section when isStandalone is false', () => {
    mockUsePwa.mockReturnValue({
      isStandalone: false,
      isMobile: false,
      installModalOpen: false,
      setInstallModalOpen: vi.fn(),
      promptInstall: vi.fn(),
      config: PWA_CONFIG,
    });

    const html = renderToStaticMarkup(
      <ProfileModal isOpen={true} onClose={vi.fn()} />
    );

    expect(html).toContain(PWA_CONFIG.copy.installSectionTitle);
    expect(html).toContain(PWA_CONFIG.copy.installSectionDescription);
    expect(html).toContain(PWA_CONFIG.copy.installAppButtonText);
    expect(html).toContain('Delete Account');
    expect(html).toContain(CANONICAL_MATCH_HISTORY_CONFIG.copy.viewPastGamesButtonText);
  });

  it('does NOT render the Install Application section when already installed (isStandalone is true)', () => {
    mockUsePwa.mockReturnValue({
      isStandalone: true,
      isMobile: false,
      installModalOpen: false,
      setInstallModalOpen: vi.fn(),
      promptInstall: vi.fn(),
      config: PWA_CONFIG,
    });

    const html = renderToStaticMarkup(
      <ProfileModal isOpen={true} onClose={vi.fn()} />
    );

    expect(html).not.toContain(PWA_CONFIG.copy.installSectionTitle);
    expect(html).not.toContain(PWA_CONFIG.copy.installSectionDescription);
    expect(html).toContain('Delete Account');
    expect(html).toContain(CANONICAL_MATCH_HISTORY_CONFIG.copy.viewPastGamesButtonText);
  });

  it('renders 5-mode breakdown and omits static header rating', () => {
    mockUsePwa.mockReturnValue({
      isStandalone: true,
      isMobile: false,
      installModalOpen: false,
      setInstallModalOpen: vi.fn(),
      promptInstall: vi.fn(),
      config: PWA_CONFIG,
    });

    const html = renderToStaticMarkup(
      <ProfileModal isOpen={true} onClose={vi.fn()} />
    );

    // Static rating in header is removed
    expect(html).not.toContain('Rating:');
    expect(html).not.toContain('1850');

    // 5-mode ratings & statistics are present
    expect(html).toContain('Ratings &amp; Performance');
    expect(html).toContain('Bullet');
    expect(html).toContain('Blitz');
    expect(html).toContain('Rapid');
    expect(html).toContain('Classical');
    expect(html).toContain('Correspondence');

    // Two internal rows elements: Played, record breakdown (W/L/D), and Win/Loss percentages
    expect(html).toContain('Played:');
    expect(html).toContain('Win:');
    expect(html).toContain('Loss:');
    expect(html).toContain('0W');
    expect(html).toContain('0L');
    expect(html).toContain('0D');
  });

  it('renders inspected user profile and hides personal account settings', () => {
    mockUsePwa.mockReturnValue({
      isStandalone: true,
      isMobile: false,
      installModalOpen: false,
      setInstallModalOpen: vi.fn(),
      promptInstall: vi.fn(),
      config: PWA_CONFIG,
    });

    const inspectedUser = {
      id: 'usr_other_99',
      username: 'OtherMaster',
      email: 'other@schada.org',
      perModeStats: {
        bullet: { elo: 1600, gamesPlayed: 10, gamesWon: 7, gamesLost: 2, gamesDrawn: 1 },
      },
      status: 'in-game' as const,
      usernameChangeCount: 1,
      isPatron: false,
    };

    const html = renderToStaticMarkup(
      <ProfileModal isOpen={true} onClose={vi.fn()} inspectedUser={inspectedUser as any} />
    );

    expect(html).toContain('OtherMaster&#x27;s Profile');
    expect(html).toContain('OtherMaster');
    expect(html).toContain(CANONICAL_MATCH_HISTORY_CONFIG.copy.viewPastGamesButtonText);
    expect(html).toContain('1600');
    // Account settings should not be shown for other users
    expect(html).not.toContain('Delete Account');
    expect(html).not.toContain('Sign Out');
    expect(html).not.toContain('Game Controls');
  });
});
