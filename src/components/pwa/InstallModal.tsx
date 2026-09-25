import React, { useState } from 'react';
import { X, Download, Share2, PlusSquare, Smartphone, CheckCircle2, Zap, Info } from 'lucide-react';
import { usePwa } from '@/context/PwaContext';

export const InstallModal: React.FC = () => {
  const { installModalOpen, setInstallModalOpen, isIOS, isStandalone, promptInstall } = usePwa();
  const [installedSuccessfully, setInstalledSuccessfully] = useState(false);
  const [showManualHelp, setShowManualHelp] = useState(false);

  if (!installModalOpen) return null;

  const handleClose = () => {
    try {
      localStorage.setItem('schada_pwa_dismissed', 'true');
    } catch {
      // Ignore if localStorage unavailable
    }
    setInstallModalOpen(false);
    setShowManualHelp(false);
  };

  const handleInstallClick = async () => {
    const installed = await promptInstall();
    if (installed) {
      setInstalledSuccessfully(true);
      try {
        localStorage.setItem('schada_pwa_dismissed', 'true');
      } catch {
        // Ignore
      }
      setTimeout(() => {
        setInstallModalOpen(false);
        setInstalledSuccessfully(false);
      }, 1600);
    } else {
      setShowManualHelp(true);
    }
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content pwa-install-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header" style={{ marginBottom: '1.25rem', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div className="app-icon-preview">
              <img
                src="/pwa-192x192.png"
                alt="Schada App Logo"
                width={50}
                height={50}
                style={{
                  borderRadius: '12px',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              />
            </div>
            <div>
              <h2 className="modal-title" style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Install Schada
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '3px 0 0 0' }}>
                Play full-screen, offline, and right from your home screen.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={handleClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        {isStandalone ? (
          <div className="install-content-box success">
            <CheckCircle2 size={36} color="var(--accent-green)" />
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)', margin: 0 }}>
                Schada is Already Installed!
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                You are currently playing in standalone app mode.
              </p>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={handleClose}
              style={{ marginTop: '0.75rem', width: '100%' }}
            >
              Back to Game
            </button>
          </div>
        ) : installedSuccessfully ? (
          <div className="install-content-box success">
            <CheckCircle2 size={36} color="var(--accent-green)" />
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)', margin: 0 }}>
                Installation Started!
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Check your home screen or application launcher.
              </p>
            </div>
          </div>
        ) : isIOS ? (
          <div className="ios-instructions-container">
            <div className="pwa-perks" style={{ marginBottom: '1rem' }}>
              <div className="perk-item">
                <Smartphone size={18} color="var(--accent-gold)" />
                <span>Full-screen app view without browser address bars</span>
              </div>
              <div className="perk-item">
                <Zap size={18} color="var(--accent-gold)" />
                <span>Instant loading with full offline Bot & Pass-and-Play</span>
              </div>
            </div>

            <div className="ios-instructions">
              <p style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                To install on your iPhone or iPad:
              </p>
              <div className="ios-step">
                <span className="step-num">1</span>
                <div className="step-text">
                  Tap the <strong style={{ color: 'var(--accent-gold)' }}>Share</strong> button in Safari's bottom toolbar.
                  <Share2 size={16} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: '6px', color: 'var(--accent-blue)' }} />
                </div>
              </div>
              <div className="ios-step">
                <span className="step-num">2</span>
                <div className="step-text">
                  Scroll down and tap <strong style={{ color: 'var(--accent-gold)' }}>Add to Home Screen</strong>.
                  <PlusSquare size={16} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: '6px', color: 'var(--accent-gold)' }} />
                </div>
              </div>
              <div className="ios-step">
                <span className="step-num">3</span>
                <div className="step-text">
                  Tap <strong style={{ color: 'var(--accent-gold)' }}>Add</strong> in the top right corner.
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={handleClose}
              style={{
                marginTop: '1.25rem',
                padding: '0.8rem',
                fontWeight: 700,
                width: '100%',
              }}
            >
              Got It
            </button>
          </div>
        ) : (
          <div className="android-instructions">
            <div className="pwa-perks">
              <div className="perk-item">
                <Smartphone size={18} color="var(--accent-gold)" />
                <span>Full-screen app experience without browser bars</span>
              </div>
              <div className="perk-item">
                <CheckCircle2 size={18} color="var(--accent-green)" />
                <span>Instant loading with offline Bot & Pass-and-Play modes</span>
              </div>
              <div className="perk-item">
                <Zap size={18} color="var(--accent-gold)" />
                <span>Dedicated home screen icon and quick access</span>
              </div>
            </div>

            {showManualHelp && (
              <div
                style={{
                  marginTop: '0.85rem',
                  padding: '0.75rem 0.9rem',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.6rem',
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                }}
              >
                <Info size={18} color="var(--accent-gold)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>Browser Install Tip:</strong>
                  <div>
                    Click the install icon (<Download size={13} style={{ display: 'inline', verticalAlign: 'middle' }} />) in your browser's address bar (top right), or open your browser menu and choose <em>"Install Schada"</em>.
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '1.25rem' }}>
              <button
                type="button"
                className="btn-primary install-action-btn"
                onClick={handleInstallClick}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.6rem',
                  padding: '0.85rem',
                  fontSize: '1rem',
                  fontWeight: 700,
                }}
              >
                <Download size={20} />
                <span>Install App</span>
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={handleClose}
                style={{
                  padding: '0.65rem',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                }}
              >
                Maybe Later
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
