import React from 'react';
import { Link } from 'react-router-dom';

interface FooterProps {
  onSelectTab?: (tab: 'play' | 'leaderboard' | 'learn' | 'history') => void;
}

export const Footer: React.FC<FooterProps> = ({ onSelectTab }) => {
  return (
    <footer className="site-footer" aria-label="Site Footer">
      <div className="footer-content">
        <nav className="footer-links" aria-label="Footer Navigation">
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
          <span className="footer-separator">•</span>
          <Link
            to="/"
            onClick={() => onSelectTab?.('history')}
            className="footer-link"
          >
            History
          </Link>
        </nav>
        <div className="footer-credits">
          <span>Schada.org • The Tactical Mind Sport (1936) • Free & Open Source</span>
        </div>
      </div>
    </footer>
  );
};
