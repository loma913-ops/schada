import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Navbar } from '../Navbar';

// Mock contexts
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: null, isLoading: false }),
}));

vi.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: vi.fn() }),
}));

describe('Navbar Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
