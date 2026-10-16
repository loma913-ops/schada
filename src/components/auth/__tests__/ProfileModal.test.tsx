import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProfileModal } from '../ProfileModal';
import { PWA_CONFIG } from '@/services/pwa/pwaConfig';

const mockUsePwa = vi.fn();
vi.mock('@/context/PwaContext', () => ({
  usePwa: () => mockUsePwa(),
}));

const mockUser = {
  id: 'usr_test_1',
  username: 'TestGrandmaster',
  email: 'grandmaster@schada.org',
  eloRating: 1850,
  gamesPlayed: 50,
  gamesWon: 35,
  gamesLost: 15,
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
  });
});

