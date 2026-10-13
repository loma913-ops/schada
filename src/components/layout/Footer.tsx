import React from 'react';
import { Link } from 'react-router-dom';
import type { NavigationTab } from '@/components/layout/navigationTypes';
import { isNativePlatform } from '@/services/native/mobileService';

interface FooterProps {
  onSelectTab?: (tab: NavigationTab) => void;
}

export const Footer: React.FC<FooterProps> = ({ onSelectTab }) => {
  return (
    <footer className="site-footer" aria-label="Site Footer">
      <div className="footer-content">
        <nav className="footer-links" aria-label="Footer Navigation">
          <div className="footer-links-row">
            <Link to="/terms-of-service" className="footer-link">
              Terms of Service
            </Link>
            <span className="footer-separator">•</span>
            <Link to="/privacy" className="footer-link">
              Privacy
            </Link>
            <span className="footer-separator">•</span>
            <Link
              to="/"
              onClick={() => onSelectTab?.('learn')}
              className="footer-link"
            >
              Rules
            </Link>
          </div>
          <span className="footer-separator footer-row-separator">•</span>
          <div className="footer-links-row">
            <Link
              to="/"
              onClick={() => onSelectTab?.('history')}
              className="footer-link"
            >
              History
            </Link>
            {!isNativePlatform() && (
              <>
                <span className="footer-separator">•</span>
                <Link
                  to="/donate"
                  onClick={() => onSelectTab?.('donate')}
                  className="footer-link"
                >
                  Donate
                </Link>
              </>
            )}
          </div>
        </nav>
        <div className="footer-credits">
          <span>Schada.org • The Tactical Mind Sport • Free & Open Source</span>
        </div>
      </div>
    </footer>
  );
};
