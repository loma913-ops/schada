import React, { useState } from 'react';
import { X, Download, Share2, PlusSquare, Smartphone, CheckCircle2 } from 'lucide-react';
import { usePwa } from '@/context/PwaContext';

export const InstallModal: React.FC = () => {
  const { installModalOpen, setInstallModalOpen, isIOS, isStandalone, promptInstall } = usePwa();
  const [installedSuccessfully, setInstalledSuccessfully] = useState(false);

  if (!installModalOpen) return null;

  const handleInstallClick = async () => {
    const installed = await promptInstall();
    if (installed) {
      setInstalledSuccessfully(true);
      setTimeout(() => {
        setInstallModalOpen(false);
        setInstalledSuccessfully(false);
      }, 1500);
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => setInstallModalOpen(false)}>
      <div className="modal-container pwa-install-modal" onClick={(e) => e.stopPropagation()}>
        <button
          className="modal-close-btn"
          onClick={() => setInstallModalOpen(false)}
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div className="install-header">
          <div className="app-icon-preview">
            <img src="/pwa-192x192.png" alt="Schada Logo" width={56} height={56} style={{ borderRadius: '12px' }} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Install Schada
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Play full-screen, offline, and right from your home screen.
            </p>
          </div>
        </div>

        {isStandalone ? (
          <div className="install-content-box success">
            <CheckCircle2 size={32} color="var(--piece-green)" />
            <p style={{ fontWeight: 600 }}>Schada is already installed and running as an app!</p>
          </div>
        ) : installedSuccessfully ? (
          <div className="install-content-box success">
            <CheckCircle2 size={32} color="var(--piece-green)" />
            <p style={{ fontWeight: 600 }}>Installation started! Check your home screen or app drawer.</p>
          </div>
        ) : isIOS ? (
          <div className="ios-instructions">
            <p style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              To install on your iPhone or iPad:
            </p>
            <div className="ios-step">
              <span className="step-num">1</span>
              <div className="step-text">
                Tap the <strong style={{ color: 'var(--accent-gold)' }}>Share</strong> button in Safari's bottom toolbar.
                <Share2 size={16} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: '6px' }} />
              </div>
            </div>
            <div className="ios-step">
              <span className="step-num">2</span>
              <div className="step-text">
                Scroll down and tap <strong style={{ color: 'var(--accent-gold)' }}>Add to Home Screen</strong>.
                <PlusSquare size={16} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: '6px' }} />
              </div>
            </div>
            <div className="ios-step">
              <span className="step-num">3</span>
              <div className="step-text">
                Tap <strong style={{ color: 'var(--accent-gold)' }}>Add</strong> in the top right corner.
              </div>
            </div>
          </div>
        ) : (
          <div className="android-instructions">
            <div className="pwa-perks">
              <div className="perk-item">
                <Smartphone size={18} color="var(--accent-gold)" />
                <span>Full-screen app experience without browser bars</span>
              </div>
              <div className="perk-item">
                <CheckCircle2 size={18} color="var(--piece-green)" />
                <span>Instant loading with offline Bot & Pass-and-Play modes</span>
              </div>
            </div>

            <button
              className="btn btn-primary full-width install-action-btn"
              onClick={handleInstallClick}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.6rem',
                marginTop: '1.25rem',
                padding: '0.85rem',
                fontSize: '1rem',
                fontWeight: 700,
              }}
            >
              <Download size={20} />
              <span>Install App</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
