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
        eloRating: 1450,
        status: 'online',
        gamesPlayed: 10,
        gamesWon: 5,
        gamesLost: 5,
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
