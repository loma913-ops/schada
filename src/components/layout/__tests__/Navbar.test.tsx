import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Navbar } from '../Navbar';
import { PWA_CONFIG } from '@/services/pwa/pwaConfig';

// Mock contexts
const mockUsePwa = vi.fn();
vi.mock('@/context/PwaContext', () => ({
  usePwa: () => mockUsePwa(),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: null, isLoading: false }),
}));

vi.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: vi.fn() }),
}));

describe('Navbar Component - Install App Visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does NOT render the "Install App" button on desktop browsers (isMobile = false)', () => {
    mockUsePwa.mockReturnValue({
      isStandalone: false,
      isMobile: false,
      installModalOpen: false,
      setInstallModalOpen: vi.fn(),
      promptInstall: vi.fn(),
      config: PWA_CONFIG,
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

    expect(html).not.toContain('install-btn');
    expect(html).not.toContain(PWA_CONFIG.copy.installAppButtonText);
  });

  it('renders the "Install App" button on mobile devices (isMobile = true, isStandalone = false)', () => {
    mockUsePwa.mockReturnValue({
      isStandalone: false,
      isMobile: true,
      installModalOpen: false,
      setInstallModalOpen: vi.fn(),
      promptInstall: vi.fn(),
      config: PWA_CONFIG,
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

    expect(html).toContain('install-btn');
    expect(html).toContain(PWA_CONFIG.copy.installAppButtonText);
    expect(html).toContain(PWA_CONFIG.copy.installAppAriaLabel);
  });

  it('does NOT render the "Install App" button when already installed in standalone mode (isStandalone = true)', () => {
    mockUsePwa.mockReturnValue({
      isStandalone: true,
      isMobile: true,
      installModalOpen: false,
      setInstallModalOpen: vi.fn(),
      promptInstall: vi.fn(),
      config: PWA_CONFIG,
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

    expect(html).not.toContain('install-btn');
    expect(html).not.toContain('Install App');
  });
});
