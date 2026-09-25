import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, CheckCircle2 } from 'lucide-react';

export const TermsOfService: React.FC = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Terms of Service • Schada.org';
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
            <FileText size={28} />
          </div>
          <h1 className="legal-title">Terms of Service</h1>
          <p className="legal-subtitle">
            Welcome to Schada.org. Please read these terms carefully before using our platform.
          </p>
          <div className="legal-meta">
            <span>Last Modified: September 2026</span>
            <span className="legal-meta-dot">•</span>
            <span>Schada.org</span>
          </div>
        </header>

        {/* Quick Highlights Summary */}
        <section className="legal-summary-box">
          <h2 className="legal-summary-title">Summary of Core Principles</h2>
          <ul className="legal-summary-list">
            <li>
              <CheckCircle2 size={16} className="summary-icon" />
              <span><strong>Do not cheat</strong> or receive external assistance in games (from computer engines, databases, or third parties).</span>
            </li>
            <li>
              <CheckCircle2 size={16} className="summary-icon" />
              <span><strong>Be nice and courteous</strong> to all other players, spectators, and community members at all times.</span>
            </li>
            <li>
              <CheckCircle2 size={16} className="summary-icon" />
              <span><strong>Respect the platform and laws:</strong> Do not attack, exploit, disrupt, or misuse our services.</span>
            </li>
            <li>
              <CheckCircle2 size={16} className="summary-icon" />
              <span><strong>Enjoy the game:</strong> Schada is a free and open-source mind sport platform dedicated to fair play.</span>
            </li>
          </ul>
        </section>

        <div className="legal-body-text">
          <section className="legal-section">
            <h2>Introduction</h2>
            <p>
              Hello and welcome to <strong>Schada.org</strong> ("Schada", "we", "us", or "our"). Schada is a free and open-source
              online platform dedicated to promoting, preserving, and playing the tactical mind sport of Schada—first invented in
              1936 by Jan Boogerd and Theodoor Jansen.
            </p>
            <p>
              These Terms of Service ("Terms") constitute a legally binding agreement made between Schada.org and you personally
              (or any entity you represent, collectively "you"). These Terms govern your access to and use of the Schada.org website,
              our matchmaking services, game servers, computer AI engines, APIs, and associated tools (collectively, the "Services").
            </p>
            <p>
              By accessing or using any part of Schada.org or our Services, you confirm that you have read, understood, and agreed to be
              bound by these Terms. If you do not agree to these Terms, you must not access or use our website and Services.
            </p>
            <p>
              These Terms should be read in conjunction with our <Link to="/privacy">Privacy Policy</Link>, which is incorporated
              herein by reference.
            </p>
          </section>

          <section className="legal-section">
            <h2>1. Using Our Website and Services</h2>
            <p>
              We invite everyone to access Schada.org. However, access is provided at our discretion and we reserve the right to modify,
              suspend, or withdraw access to any part of the site at any time. From time to time, access may be affected by maintenance,
              updates, or technological disruptions. Schada.org is not liable for any losses or inconvenience caused by website downtime
              or incompatibility with your hardware or software.
            </p>
            <p>
              You may use Schada.org either anonymously as a guest or by creating an account. Certain features (such as official Elo
              tracking, leaderboard ranking, custom profile preferences, and friend lists) may require a registered account.
            </p>
            <p>
              When accessing our website and using our Services, you agree not to:
            </p>
            <ul>
              <li>Attempt to gain unauthorized access to our servers, user accounts, databases, or network infrastructure.</li>
              <li>Launch volumetric attacks (such as DoS or DDoS), exploit vulnerabilities, or intentionally degrade platform performance.</li>
              <li>Introduce viruses, worms, trojans, or any malicious code designed to harm computer software or hardware.</li>
              <li>Circumvent or attempt to bypass security measures, rate limits, or access controls.</li>
            </ul>
            <p>
              Our website and Services are provided on an "as is" and "as available" basis without warranties of any kind.
            </p>
          </section>

          <section className="legal-section">
            <h2>2. Creating an Account and Account Security</h2>
            <p>
              Creating an account is optional. To register an account, you must be at least 15 years old (or the legal age of digital consent
              in your jurisdiction), or have the authorization and supervision of a parent or legal guardian.
            </p>
            <p>
              When creating an account, you must choose a username and password. Usernames must adhere to our Community Guidelines.
              We reserve the right to rename or terminate accounts with inappropriate, offensive, misleading, or impersonating usernames.
            </p>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under
              your account. If you discover or suspect unauthorized access to your account, you should change your password immediately.
              Schada.org is not responsible for any loss or harm resulting from unauthorized account access.
            </p>
          </section>

          <section className="legal-section">
            <h2>3. Fair Play and Anti-Cheating Guidelines</h2>
            <p>
              Fair play is fundamental to Schada.org. All players, whether registered or playing as guests, agree to uphold the highest
              standards of integrity and sportsmanship.
            </p>
            <h3>Fair Play Violations:</h3>
            <ul>
              <li>
                <strong>Engine and External Assistance:</strong> You must not use computer engines, AI bots, move calculation software,
                opening databases, books, or assistance from third parties during an ongoing ranked or unranked live match against human players.
              </li>
              <li>
                <strong>Rating Manipulation (Boosting and Sandbagging):</strong> You must not artificially manipulate Elo ratings by intentionally
                losing games (sandbagging), colluding with opponents, or playing against dummy accounts to inflate ratings (boosting).
              </li>
              <li>
                <strong>Ragesitting and Ragequitting:</strong> Leaving a game or letting the clock run out to waste an opponent's time rather
                than resigning or playing on is strictly prohibited.
              </li>
              <li>
                <strong>Multiple Abusive Accounts:</strong> Creating multiple accounts to evade bans, deceive opponents, manipulate leaderboards,
                or distort matchmaking is not permitted.
              </li>
              <li>
                <strong>Distraction and Sledging:</strong> Intentionally abusing chat, draw offers, or takeback requests to distract or harass
                an opponent during a game is a violation of sportsmanship.
              </li>
            </ul>
            <p>
              Penalties for Fair Play violations may include game forfeitures, Elo rating resets, temporary bans, public marking of the account
              as having violated Fair Play rules, removal from leaderboards, and permanent account termination.
            </p>
          </section>

          <section className="legal-section">
            <h2>4. Community Guidelines and Conduct</h2>
            <p>
              Schada.org is a welcoming community for players of all ages and backgrounds. When using our communication features (public chat,
              in-game messages, profile bios):
            </p>
            <ul>
              <li><strong>No Harassment or Hate Speech:</strong> Discrimination, hate speech, racism, sexism, insults, threats, and bullying are strictly forbidden.</li>
              <li><strong>No Spam or Commercial Solicitation:</strong> Do not post advertisements, unsolicited promotional links, or repetitive messages.</li>
              <li><strong>No Impersonation:</strong> Do not impersonate administrators, moderators, titled players, or other community members.</li>
              <li><strong>Respect Intellectual Property:</strong> Do not post or distribute copyrighted content, proprietary analysis, or materials without proper rights.</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>5. User Content and License</h2>
            <p>
              You retain ownership of any content you create or submit on Schada.org (such as profile details, annotations, or chat messages).
              However, by submitting content, you grant Schada.org a worldwide, non-exclusive, royalty-free, perpetual license to host,
              display, transmit, and reproduce such content in connection with providing and improving the platform.
            </p>
            <p>
              Game moves, PGN/notation records, time stamps, and game results played on public tables or ranked matches are considered public
              game records and may be published, analyzed, and made available for the open-source community, game archives, and analytical study.
            </p>
          </section>

          <section className="legal-section">
            <h2>6. Open Source Licensing</h2>
            <p>
              Schada.org is built with dedication to open-source software and open knowledge. The game rules of Schada, historical
              documentation, and platform code are provided under free and open-source licenses. You are encouraged to inspect, contribute
              to, and learn from the project.
            </p>
          </section>

          <section className="legal-section">
            <h2>7. Voluntary Donations and Support</h2>
            <p>
              Schada.org is a non-profit, ad-free project. Any donations or patron contributions made by users are entirely voluntary gifts
              to help cover server hosting, domain fees, and infrastructure maintenance.
            </p>
            <p>
              Donations do not grant special gameplay advantages, unfair privileges, or exemptions from these Terms and Fair Play rules.
              All players compete on equal terms.
            </p>
          </section>

          <section className="legal-section">
            <h2>8. Termination and Account Closure</h2>
            <p>
              You may discontinue your use of Schada.org and close your account at any time. We reserve the right to suspend or terminate
              accounts, revoke access to Services, or remove content without prior notice if we reasonably believe you have violated these
              Terms, our Fair Play guidelines, or applicable laws.
            </p>
          </section>

          <section className="legal-section">
            <h2>9. Disclaimer and Limitation of Liability</h2>
            <p>
              THE SERVICES ARE PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS. TO THE MAXIMUM EXTENT PERMITTED BY LAW, SCHADA.ORG AND ITS
              CONTRIBUTORS EXPRESSLY DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF
              MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
            <p>
              IN NO EVENT SHALL SCHADA.ORG, ITS MAINTAINERS, CONTRIBUTORS, OR AFFILIATES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
              CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF OR INABILITY TO USE THE SERVICES.
            </p>
          </section>

          <section className="legal-section">
            <h2>10. Modifications to Terms</h2>
            <p>
              We may update these Terms from time to time to reflect changes in our Services, legal requirements, or community standards.
              When updates occur, the "Last Modified" date at the top will be updated. Your continued use of Schada.org following the
              posting of revised Terms signifies your acceptance of the changes.
            </p>
          </section>

          <section className="legal-section">
            <h2>11. Contact Information</h2>
            <p>
              If you have any questions, feedback, or concerns regarding these Terms of Service or need to report a violation, please
              reach out to us via our community channels or at <a href="mailto:contact@schada.org">contact@schada.org</a>.
            </p>
          </section>
        </div>

        <footer className="legal-card-footer">
          <div className="legal-footer-links">
            <Link to="/privacy">Read our Privacy Policy</Link>
            <span>•</span>
            <Link to="/">Return to Game Arena</Link>
          </div>
        </footer>
      </article>
    </div>
  );
};
