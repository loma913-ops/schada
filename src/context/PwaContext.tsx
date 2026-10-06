import React, { createContext, useContext, useEffect, useState } from 'react';
import { isMobileDevice } from '@/services/orientation/orientationService';
import {
  PWA_CONFIG,
  validatePwaConfig,
  type PwaConfig,
} from '@/services/pwa/pwaConfig';

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
  isMobile: boolean;
  isIOS: boolean;
  installModalOpen: boolean;
  setInstallModalOpen: (open: boolean) => void;
  promptInstall: () => Promise<boolean>;
  config: PwaConfig;
}

const PwaContext = createContext<PwaContextValue>({
  isInstallable: false,
  isStandalone: false,
  isMobile: false,
  isIOS: false,
  installModalOpen: false,
  setInstallModalOpen: () => {},
  promptInstall: async () => false,
  config: PWA_CONFIG,
});

export interface PwaProviderProps {
  children: React.ReactNode;
  config?: PwaConfig;
}

/**
 * PwaProvider Component.
 *
 * Algorithmic Complexity:
 * - Mount & Device Detection: O(1) time, O(1) space.
 * - Configuration Validation: O(1) time, O(1) auxiliary space.
 * - Event Dispatch: O(1) time, O(1) space.
 */
export const PwaProvider: React.FC<PwaProviderProps> = ({
  children,
  config = PWA_CONFIG,
}) => {
  validatePwaConfig(config);

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? isMobileDevice() : false
  );
  const [installModalOpen, setInstallModalOpen] = useState(false);

  useEffect(() => {
    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = config.userAgentPatterns.appleDeviceRegex.test(userAgent);
    setIsIOS(isAppleDevice);

    // Detect standalone mode (already installed & opened from home screen)
    const isStandaloneMode =
      window.matchMedia(config.mediaQueries.standalone).matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes(config.referrerProtocols.androidApp);

    setIsStandalone(isStandaloneMode);

    const checkDevice = () => {
      setIsMobile(isMobileDevice());
    };
    checkDevice();
    window.addEventListener('resize', checkDevice);

    // Listen for beforeinstallprompt event (Chromium browsers)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      try {
        const dismissed = localStorage.getItem(config.storageKey);
        const inGame = window.location.pathname.startsWith(config.activeGamePathPrefix);
        const currentIsMobile = isMobileDevice();
        if (currentIsMobile && dismissed !== config.dismissedValue && !inGame) {
          setTimeout(() => {
            setInstallModalOpen(true);
          }, config.delays.androidPromptDelayMs);
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
        localStorage.setItem(config.storageKey, config.dismissedValue);
      } catch {
        // Ignore
      }
    };

    // Auto-prompt on iOS mobile devices if eligible and not dismissed
    const currentIsMobile = isMobileDevice();
    if (isAppleDevice && currentIsMobile && !isStandaloneMode) {
      try {
        const dismissed = localStorage.getItem(config.storageKey);
        const inGame = window.location.pathname.startsWith(config.activeGamePathPrefix);
        if (dismissed !== config.dismissedValue && !inGame) {
          setTimeout(() => {
            setInstallModalOpen(true);
          }, config.delays.iosPromptDelayMs);
        }
      } catch {
        // Ignore
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('resize', checkDevice);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [config]);

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
        isMobile,
        isIOS,
        installModalOpen,
        setInstallModalOpen,
        promptInstall,
        config,
      }}
    >
      {children}
    </PwaContext.Provider>
  );
};

export const usePwa = () => useContext(PwaContext);

