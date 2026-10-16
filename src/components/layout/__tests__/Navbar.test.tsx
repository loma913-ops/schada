import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Navbar } from '../Navbar';

const mockUseAuth = vi.fn();
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: vi.fn() }),
}));

describe('Navbar Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: null, isLoading: false });
  });

  it('renders navbar brand, tabs, and sign in button', () => {
    const html = renderToStaticMarkup(
      <Navbar
        currentTab="play"
        onSelectTab={vi.fn()}
        onOpenAuth={vi.fn()}
        onOpenProfile={vi.fn()}
        onOpenFriends={vi.fn()}
      />
    );

    expect(html).toContain('Schada.org');
    expect(html).toContain('Play');
    expect(html).toContain('Leaderboard');
    expect(html).toContain('Rules');
    expect(html).toContain('History');
    expect(html).toContain('Sign In');
  });

  it('does NOT render PWA install button in the header', () => {
    const html = renderToStaticMarkup(
      <Navbar
        currentTab="play"
        onSelectTab={vi.fn()}
        onOpenAuth={vi.fn()}
        onOpenProfile={vi.fn()}
        onOpenFriends={vi.fn()}
      />
    );

    expect(html).not.toContain('install-btn');
    expect(html).not.toContain('Install App');
  });

  it('renders profile button without static elo badge when user is authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'user_1',
        username: 'TestUser',
        perModeStats: {
          bullet: { elo: 1200, gamesPlayed: 0, gamesWon: 0, gamesLost: 0, gamesDrawn: 0 },
          blitz: { elo: 1450, gamesPlayed: 10, gamesWon: 5, gamesLost: 5, gamesDrawn: 0 },
          rapid: { elo: 1200, gamesPlayed: 0, gamesWon: 0, gamesLost: 0, gamesDrawn: 0 },
          classical: { elo: 1200, gamesPlayed: 0, gamesWon: 0, gamesLost: 0, gamesDrawn: 0 },
          correspondence: { elo: 1200, gamesPlayed: 0, gamesWon: 0, gamesLost: 0, gamesDrawn: 0 },
        },
        status: 'online',
        usernameChangeCount: 0,
      },
      isLoading: false,
    });

    const html = renderToStaticMarkup(
      <Navbar
        currentTab="play"
        onSelectTab={vi.fn()}
        onOpenAuth={vi.fn()}
        onOpenProfile={vi.fn()}
        onOpenFriends={vi.fn()}
      />
    );

    expect(html).toContain('nav-profile-btn');
    expect(html).not.toContain('nav-user-elo');
    expect(html).not.toContain('1450');
  });
});
