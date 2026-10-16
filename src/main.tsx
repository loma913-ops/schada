import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App'
import { initDeploymentRecovery } from './services/deployment/deploymentRecoveryService'
import { cleanupBrowserStorage } from './services/storage/storageCleanup'
import { isNativePlatform } from './services/native/mobileService'

// Purge any leaked firestore_ coordination keys and enforce browser storage hygiene
cleanupBrowserStorage();

// Initialize dynamic chunk recovery on web; native apps update authoritatively via app stores
if (!isNativePlatform()) {
  initDeploymentRecovery();
} else if (typeof window !== 'undefined') {
  // If running in Android native container with NativeSplash bridge, apply status bar insets synchronously before render
  const nativeSplash = (window as unknown as {
    NativeSplash?: {
      getStatusBarHeight?: () => number;
      getNavigationBarHeight?: () => number;
      notifyAppReady?: () => void;
    };
  }).NativeSplash;
  if (nativeSplash?.getStatusBarHeight) {
    const top = nativeSplash.getStatusBarHeight();
    if (top > 0) {
      document.documentElement.style.setProperty('--safe-area-inset-top', `${top}px`);
      document.documentElement.style.setProperty('--safe-top', `${top}px`);
    }
    const bottom = nativeSplash.getNavigationBarHeight?.() ?? 0;
    if (bottom > 0) {
      document.documentElement.style.setProperty('--safe-area-inset-bottom', `${bottom}px`);
      document.documentElement.style.setProperty('--safe-bottom', `${bottom}px`);
    }
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
