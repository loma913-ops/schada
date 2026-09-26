import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Lock, ArrowLeft, ShieldCheck, Database, UserCheck, EyeOff } from 'lucide-react';

export const PrivacyPolicy: React.FC = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Privacy Policy • Schada.org';
  }, []);

  return (
    <div className="legal-page-container">
      <div className="legal-back-nav">
        <Link to="/" className="legal-back-link">
          <ArrowLeft size={16} />
          <span>Back to Play</span>
        </Link>
      </div>

      <article className="legal-card">
        <header className="legal-header">
          <div className="legal-icon-wrap">
            <Lock size={28} />
          </div>
          <h1 className="legal-title">Privacy Policy</h1>
          <p className="legal-subtitle">
            How Schada.org collects, uses, and safeguards your personal information with full transparency.
          </p>
          <div className="legal-meta">
            <span>Last Updated: September 2026</span>
            <span className="legal-meta-dot">•</span>
            <span>GDPR & Privacy Compliant</span>
          </div>
        </header>

        {/* Quick Highlights Summary */}
        <section className="legal-summary-box">
          <h2 className="legal-summary-title">Our Privacy Commitments</h2>
          <ul className="legal-summary-list">
            <li>
              <ShieldCheck size={16} className="summary-icon" />
              <span><strong>100% Ad-Free & Tracker-Free:</strong> We never sell, rent, or monetize your personal data to advertisers or third parties.</span>
            </li>
            <li>
              <EyeOff size={16} className="summary-icon" />
              <span><strong>No Third-Party Analytics Tracking:</strong> We do not use third-party invasive trackers or marketing pixels.</span>
            </li>
            <li>
              <Database size={16} className="summary-icon" />
              <span><strong>Minimal Data Collection:</strong> We only process data necessary to provide game functionality, matchmaking, and security.</span>
            </li>
            <li>
              <UserCheck size={16} className="summary-icon" />
              <span><strong>Full User Control:</strong> You have full rights under GDPR to access, rectify, export, or delete your account data at any time.</span>
            </li>
          </ul>
        </section>

        <div className="legal-body-text">
          <section className="legal-section">
            <h2>Introduction and Data Controller</h2>
            <p>
              Schada.org ("Schada", "we", "us", or "our") is an online platform for playing, studying, and celebrating the tactical mind sport Schada.
              We are committed to protecting the privacy and personal data of our users in compliance with the General Data Protection Regulation (GDPR)
              and relevant data protection laws.
            </p>
            <p>
              The data controller responsible for the processing of your personal data is Schada.org. For any inquiries, requests, or concerns
              regarding your personal data, you can contact our team at <a href="mailto:privacy@schada.org">privacy@schada.org</a>.
            </p>
          </section>

          <section className="legal-section">
            <h2>1. Personal Data We Collect and Why</h2>
            <p>
              We process personal data only when necessary to operate our services, maintain platform integrity, and fulfill our contractual commitments to you.
            </p>

            <h3>A. Connection and Technical Access Logs</h3>
            <p>
              When you connect to Schada.org, certain technical data is automatically processed to establish network communication, mitigate security
              threats (such as DDoS attacks), and diagnose software bugs. This includes your IP address, browser type, operating system, and connection timestamps.
            </p>
            <p>
              <strong>Legal Basis:</strong> Legitimate interest in providing a safe, reliable, and functional website (GDPR Art. 6.1.f).<br />
              <strong>Retention:</strong> Technical logs are retained for security purposes and routinely pruned.
            </p>

            <h3>B. Account Registration and Management</h3>
            <p>
              If you choose to create an account, we collect the credentials provided during signup: your username, email address, and encrypted password hash.
              We also maintain your game statistics (Elo rating, win/loss/draw records, match history, and puzzle progress) and any optional profile information you provide.
            </p>
            <p>
              <strong>Legal Basis:</strong> Performance of a contract (Terms of Service) to provide account services and matchmaking (GDPR Art. 6.1.b).<br />
              <strong>Retention:</strong> Maintained for the lifetime of your active account or until you request account deletion.
            </p>

            <h3>C. Guest and Anonymous Gameplay</h3>
            <p>
              You can play Schada completely anonymously as a guest without creating an account. In this case, temporary session identifiers and guest tokens
              are stored locally in your browser to facilitate current matches and room coordination.
            </p>

            <h3>D. Game Moves, Match History, and Public Records</h3>
            <p>
              Schada is a competitive mind sport. Move sequences, time controls, timestamps, and game outcomes played in open lobby rooms or ranked matchmaking
              are recorded. These records allow you and the community to review past games, analyze positions, and view global leaderboards.
            </p>
            <p>
              <strong>Legal Basis:</strong> Legitimate interest and contractual fulfillment for maintaining historical sports records and ratings (GDPR Art. 6.1.b & 6.1.f).
            </p>

            <h3>E. In-Game Communications and Support Inquiries</h3>
            <p>
              When you send in-game chat messages, friend requests, or submit support inquiries, we process the contents of these communications to facilitate
              social gameplay, enforce community rules against harassment, and provide customer assistance.
            </p>
          </section>

          <section className="legal-section">
            <h2>2. Summary Data Processing Table</h2>
            <div className="legal-table-wrapper">
              <table className="legal-table">
                <thead>
                  <tr>
                    <th>Data Category</th>
                    <th>Purpose</th>
                    <th>Legal Basis</th>
                    <th>Retention Period</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>IP Address & Connection Logs</strong></td>
                    <td>Network routing, DDoS mitigation, bug diagnosis</td>
                    <td>Legitimate Interest (Art. 6.1.f)</td>
                    <td>Up to 1 year for security analysis</td>
                  </tr>
                  <tr>
                    <td><strong>Account Credentials (Username, Email)</strong></td>
                    <td>User authentication, profile management, password recovery</td>
                    <td>Contractual Necessity (Art. 6.1.b)</td>
                    <td>Duration of account lifetime</td>
                  </tr>
                  <tr>
                    <td><strong>Game History & Ratings</strong></td>
                    <td>Elo calculations, leaderboard rankings, game analysis</td>
                    <td>Contractual & Archival (Art. 6.1.b / Art. 89)</td>
                    <td>Public historical match record</td>
                  </tr>
                  <tr>
                    <td><strong>Local Session / Theme Preferences</strong></td>
                    <td>Dark/light mode, sound toggles, active room state</td>
                    <td>Legitimate Interest (Art. 6.1.f)</td>
                    <td>Stored in browser localStorage / session</td>
                  </tr>
                  <tr>
                    <td><strong>Support & Contact Messages</strong></td>
                    <td>Resolving player issues, bug reports, and fair play appeals</td>
                    <td>Legitimate Interest (Art. 6.1.f)</td>
                    <td>Until resolution + dispute limitation period</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="legal-section">
            <h2>3. Cookies and Local Storage</h2>
            <p>
              Schada.org utilizes strictly necessary local storage items and session cookies to ensure core platform functionality:
            </p>
            <ul>
              <li><strong>Authentication & Guest Session:</strong> Keeps you logged in or maintains your guest player identifier between page navigations.</li>
              <li><strong>Theme & Display Settings:</strong> Remembers your preference for Dark Mode or Light Mode.</li>
              <li><strong>Game Preferences:</strong> Saves board sound effects toggles, board orientation, and favorite time controls.</li>
            </ul>
            <p>
              We do <strong>not</strong> use third-party advertising cookies, marketing trackers, or cross-site profiling technologies.
            </p>
          </section>

          <section className="legal-section">
            <h2>4. Who Has Access to Your Data</h2>
            <p>
              Your data is accessed only by authorized maintainers and moderators of Schada.org solely to the extent necessary to perform their duties
              (such as investigating fair play violations, answering support requests, or fixing infrastructure issues).
            </p>
            <p>
              We rely on trusted cloud infrastructure providers (such as Firebase / Google Cloud Platform) operating in secure, high-compliance data centers
              to host our database, realtime game synchronization, and static assets. These providers act strictly as data processors under binding data
              protection terms. We never sell or license personal data to third parties.
            </p>
          </section>

          <section className="legal-section">
            <h2>5. Your Rights Under GDPR and Data Protection Regulations</h2>
            <p>
              Under the General Data Protection Regulation (GDPR) and international privacy laws, you possess comprehensive rights over your personal data:
            </p>
            <ul>
              <li><strong>Right of Access:</strong> You can request confirmation of whether your data is being processed and obtain a copy of the personal data held about you.</li>
              <li><strong>Right to Rectification:</strong> You can request corrections to any inaccurate or incomplete information.</li>
              <li><strong>Right to Erasure ("Right to be Forgotten"):</strong> You have the right to request the deletion of your account and associated personal data.</li>
              <li><strong>Right to Restriction of Processing:</strong> You can request that we temporarily freeze or restrict the processing of your data under specific legal grounds.</li>
              <li><strong>Right to Data Portability:</strong> You can receive your account data in a structured, commonly used, and machine-readable format.</li>
              <li><strong>Right to Object:</strong> You have the right to object to data processing grounded on our legitimate interests.</li>
              <li><strong>Right to Withdraw Consent:</strong> Where processing is based on your consent, you can withdraw consent at any time without penalty.</li>
            </ul>
            <p>
              To exercise any of these rights, simply email us at <a href="mailto:privacy@schada.org">privacy@schada.org</a> with your username and the specifics of your request.
            </p>
          </section>

          <section className="legal-section">
            <h2>6. Data Security</h2>
            <p>
              We employ industry-standard technical and organizational security measures to protect your personal data against accidental loss, unauthorized access,
              alteration, or disclosure. All communication between your browser and our servers is encrypted using modern TLS (HTTPS) encryption.
            </p>
          </section>

          <section className="legal-section">
            <h2>7. Changes to This Privacy Policy</h2>
            <p>
              We may occasionally update this Privacy Policy to reflect technical advancements, feature additions, or regulatory updates.
              Any revisions will be posted directly on this page with an updated "Last Updated" timestamp.
            </p>
          </section>

          <section className="legal-section">
            <h2>8. Contact Us</h2>
            <p>
              If you have any questions, suggestions, or complaints regarding our data privacy practices, please contact us at:
            </p>
            <p>
              <strong>Email:</strong> <a href="mailto:privacy@schada.org">privacy@schada.org</a><br />
              <strong>Website:</strong> <a href="https://schada.org">schada.org</a>
            </p>
          </section>
        </div>

        <footer className="legal-card-footer">
          <div className="legal-footer-links">
            <Link to="/terms-of-service">Read our Terms of Service</Link>
            <span>•</span>
            <Link to="/">Return to Game Arena</Link>
          </div>
        </footer>
      </article>
    </div>
  );
};
