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
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
