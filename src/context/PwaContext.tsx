import React, { createContext, useContext, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PwaContextValue {
  isInstallable: boolean;
  isStandalone: boolean;
  isIOS: boolean;
  installModalOpen: boolean;
  setInstallModalOpen: (open: boolean) => void;
  promptInstall: () => Promise<boolean>;
}

const PwaContext = createContext<PwaContextValue>({
  isInstallable: false,
  isStandalone: false,
  isIOS: false,
  installModalOpen: false,
  setInstallModalOpen: () => {},
  promptInstall: async () => false,
});

export const PwaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [installModalOpen, setInstallModalOpen] = useState(false);

  useEffect(() => {
    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isAppleDevice);

    // Detect standalone mode (already installed & opened from home screen)
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://');

    setIsStandalone(isStandaloneMode);

    const isMobileDevice =
      /iphone|ipad|ipod|android|mobile/i.test(userAgent) ||
      window.matchMedia('(max-width: 768px)').matches;

    // Listen for beforeinstallprompt event (Chromium browsers)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      try {
        const dismissed = localStorage.getItem('schada_pwa_dismissed');
        const inGame = window.location.pathname.startsWith('/game/');
        if (isMobileDevice && !dismissed && !inGame) {
          setTimeout(() => {
            setInstallModalOpen(true);
          }, 1500);
        }
      } catch {
        // Ignore localStorage error if restricted
      }
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      setInstallModalOpen(false);
      try {
        localStorage.setItem('schada_pwa_dismissed', 'true');
      } catch {
        // Ignore
      }
    };

    // Auto-prompt on iOS mobile devices if eligible and not dismissed
    if (isAppleDevice && isMobileDevice && !isStandaloneMode) {
      try {
        const dismissed = localStorage.getItem('schada_pwa_dismissed');
        const inGame = window.location.pathname.startsWith('/game/');
        if (!dismissed && !inGame) {
          setTimeout(() => {
            setInstallModalOpen(true);
          }, 2000);
        }
      } catch {
        // Ignore
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = async (): Promise<boolean> => {
    if (!deferredPrompt) {
      return false;
    }
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  // If already standalone, it's not installable. Otherwise, it is installable if prompt is ready or if it's iOS
  const isInstallable = !isStandalone && (Boolean(deferredPrompt) || isIOS);

  return (
    <PwaContext.Provider
      value={{
        isInstallable,
        isStandalone,
        isIOS,
        installModalOpen,
        setInstallModalOpen,
        promptInstall,
      }}
    >
      {children}
    </PwaContext.Provider>
  );
};

export const usePwa = () => useContext(PwaContext);
