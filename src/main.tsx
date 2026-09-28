import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App'
import { initDeploymentRecovery } from './services/deployment/deploymentRecoveryService'

// Initialize post-deployment dynamic chunk error recovery and reload debouncing
initDeploymentRecovery();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
