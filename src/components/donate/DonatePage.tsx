import React, { useState, useEffect } from 'react';
import {
  Heart,
  ShieldCheck,
  CheckCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Info,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { SchadaStar } from '@/components/common/SchadaStar';
import { PatronBadge } from '@/components/common/PatronBadge';
import {
  DONATE_CONFIG,
  calculateDonationTotal,
  buildStripePaymentUrl,
  resolveStripePaymentLink,
  type DonationFrequency,
} from '@/core/donate/donateConfig';
import {
  getPatronStatusDetails,
  getEstimatedBadgeExpiration,
} from '@/core/donate/patronService';
import { MULTIPLAYER_SCALE_CONFIG } from '@/services/firebase/multiplayerConfig';

export const DonatePage: React.FC = () => {
  const { user } = useAuth();
  const patronStatus = getPatronStatusDetails(user);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Donate & Patron • Schada.org';
  }, []);

  const [frequency, setFrequency] = useState<DonationFrequency>('one-time');
  const [selectedPreset, setSelectedPreset] = useState<number | 'other'>(
    DONATE_CONFIG.defaultSelectedAmount
  );
  const [customAmount, setCustomAmount] = useState<string>(
    String(DONATE_CONFIG.defaultCustomAmount)
  );
  const [offsetFee, setOffsetFee] = useState<boolean>(DONATE_CONFIG.defaultOffsetFee);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const estimatedExpiration = getEstimatedBadgeExpiration(frequency);

  // Compute active base amount with strict numeric parsing
  const parsedCustom = parseFloat(customAmount);
  const validCustomAmount = Number.isFinite(parsedCustom) ? parsedCustom : DONATE_CONFIG.minCustomAmount;

  const baseAmount =
    frequency === 'lifetime'
      ? DONATE_CONFIG.lifetimeAmount
      : selectedPreset === 'other'
        ? Math.min(
          DONATE_CONFIG.maxCustomAmount,
          Math.max(DONATE_CONFIG.minCustomAmount, validCustomAmount)
        )
        : selectedPreset;

  const { fee, total, offsetFeeAmount } = calculateDonationTotal(baseAmount, offsetFee, DONATE_CONFIG);

  // Stripe Payment Link configuration with ironclad sandbox guarantee on localhost & dev
  const { url: configuredPaymentLink, isSandbox } = resolveStripePaymentLink({
    frequency,
    offsetFee,
    hostname: typeof window !== 'undefined' ? window.location.hostname : undefined,
    isDev: Boolean(import.meta.env.DEV),
    config: DONATE_CONFIG,
    envPaymentLink: import.meta.env.VITE_STRIPE_PAYMENT_LINK,
    envLifetimePaymentLink: import.meta.env.VITE_STRIPE_PAYMENT_LINK_LIFETIME,
  });

  const guestIdKey = MULTIPLAYER_SCALE_CONFIG.presence.storageKeys.guestId;
  const guestId =
    typeof localStorage !== 'undefined' ? localStorage.getItem(guestIdKey) || undefined : undefined;
  const clientReferenceId = user?.id || guestId;
  const prefilledEmail = user?.email || undefined;

  const stripeCheckoutUrl = buildStripePaymentUrl(
    configuredPaymentLink,
    {
      baseAmount,
      offsetFee,
      frequency,
      clientReferenceId,
      prefilledEmail,
    },
    DONATE_CONFIG
  );

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (stripeCheckoutUrl) {
      window.open(stripeCheckoutUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const feePercentageFormatted = (DONATE_CONFIG.transactionFee.percentage * 100).toFixed(1);
  const feeFixedFormatted = `${DONATE_CONFIG.currencySymbol}${DONATE_CONFIG.transactionFee.fixed.toFixed(2)}`;

  return (
    <main className="donate-container">
      {/* Hero Motto Banner */}
      <section className="donate-banner">
        <div className="donate-banner-badge">
          <Heart size={14} fill="currentColor" />
          <span>Community Supported</span>
        </div>
        <h1>Free schada for everyone, forever!</h1>
        <p>
          No ads, no subscriptions, no paywalls. Powered entirely by open source,
          passion, and the generous support of our community patrons.
        </p>
      </section>

      {/* User Patron Status Indicator Banner */}
      <section
        className={`donate-user-status-card ${patronStatus.isActive
          ? 'active'
          : patronStatus.isExpired
            ? 'expired'
            : user
              ? 'new-user'
              : 'guest'
          }`}
        aria-label="Your Patron status"
      >
        <div className="donate-user-status-main">
          <div
            className={`donate-user-status-icon ${patronStatus.isActive
              ? 'active'
              : patronStatus.isExpired
                ? 'expired'
                : user
                  ? 'new-user'
                  : 'guest'
              }`}
          >
            {patronStatus.isActive ? (
              <SchadaStar size={24} />
            ) : patronStatus.isExpired ? (
              <Clock size={22} />
            ) : user ? (
              <Sparkles size={22} />
            ) : (
              <Info size={22} />
            )}
          </div>
          <div className="donate-user-status-text">
            <div className="donate-user-status-header">
              <span
                className={`donate-status-pill ${patronStatus.isActive
                  ? 'active'
                  : patronStatus.isExpired
                    ? 'expired'
                    : user
                      ? 'idle'
                      : 'guest'
                  }`}
              >
                {patronStatus.isActive
                  ? 'Active Patron'
                  : patronStatus.isExpired
                    ? 'Badge Expired'
                    : user
                      ? 'Account Ready'
                      : 'Guest Session'}
              </span>
              {user?.username && (
                <span className="donate-user-status-username">@{user.username}</span>
              )}
            </div>
            <p className="donate-user-status-desc">
              {patronStatus.isActive ? (
                patronStatus.isLifetime ? (
                  <>
                    <strong>Lifetime Recognition:</strong> Your golden star badge is permanent and never expires.
                  </>
                ) : patronStatus.tier === 'recurring' && !patronStatus.expiresAt ? (
                  <>
                    <strong>Monthly Subscription:</strong> Active recurring subscription. Your badge renews automatically each month (and stays active for 1 calendar month if cancelled).
                  </>
                ) : (
                  <>
                    <strong>Active through:</strong> {patronStatus.formattedExpirationDate} ({patronStatus.daysRemaining}{' '}
                    {patronStatus.daysRemaining === 1 ? 'day' : 'days'} remaining).
                  </>
                )
              ) : patronStatus.isExpired ? (
                <>
                  Your Patron badge expired on <strong>{patronStatus.formattedExpirationDate || 'recently'}</strong>. Select a contribution tier below to reactivate your star!
                </>
              ) : user ? (
                <>
                  You don't have an active Patron badge yet. Choose a contribution option below to display the golden star next to your username!
                </>
              ) : (
                <>
                  <strong>Note for Guests:</strong> Patron star badges require a registered Schada account. Sign in or register to display the golden star next to your username for 1 calendar month (or forever with Lifetime).
                </>
              )}
            </p>
          </div>
        </div>
      </section>

      {/* Main Donation Checkout Card */}
      <section className="donate-card">
        {/* Step 1: Donation Frequency */}
        <div>
          <div className="donate-section-title">
            <Heart size={16} />
            <span>Choose Frequency</span>
          </div>
          <div className="donate-frequency-group" role="radiogroup" aria-label="Donation frequency">
            {DONATE_CONFIG.frequencyOptions.map((freq) => {
              const isDisabled = DONATE_CONFIG.disabledFrequencies.includes(freq);
              const isSelected = frequency === freq;
              const label =
                freq === 'one-time' ? 'One-time' : freq === 'monthly' ? 'Monthly' : 'Lifetime';

              return (
                <button
                  key={freq}
                  type="button"
                  className={`donate-freq-btn ${isSelected ? 'active' : ''}`}
                  disabled={isDisabled}
                  onClick={() => !isDisabled && setFrequency(freq)}
                  title={
                    isDisabled
                      ? `${label} donations coming soon with our full subscription portal`
                      : label
                  }
                  role="radio"
                  aria-checked={isSelected}
                  aria-disabled={isDisabled}
                >
                  {freq === 'lifetime' && <SchadaStar size={14} />}
                  <span>{label}</span>
                  {isDisabled && <span className="donate-disabled-badge">Disabled</span>}
                </button>
              );
            })}
          </div>

          {/* Expiration & Duration Indicator for Selected Frequency */}
          <div className="donate-frequency-duration-pill">
            {frequency === 'lifetime' ? (
              <SchadaStar size={16} />
            ) : (
              <Clock size={16} />
            )}
            <span className="donate-duration-text">
              <strong>Badge Duration:</strong> {estimatedExpiration.explanation}
            </span>
          </div>
        </div>

        {/* Step 2: Donation Amount */}
        <div>
          <div className="donate-section-title">
            <ShieldCheck size={16} />
            <span>
              {frequency === 'lifetime' ? 'Lifetime Patron Tier' : `Select Amount (${DONATE_CONFIG.currency})`}
            </span>
          </div>

          {frequency === 'lifetime' ? (
            <div className="donate-lifetime-highlight">
              <div className="donate-lifetime-info">
                <h3>
                  <SchadaStar size={20} />
                  <span>Lifetime Patron</span>
                </h3>
                <p>
                  Permanent recognition with the golden Schada star on your profile forever,
                  helping secure our infrastructure for years to come.
                </p>
              </div>
              <div className="donate-lifetime-price">
                {DONATE_CONFIG.currencySymbol}
                {DONATE_CONFIG.lifetimeAmount.toFixed(2)}
              </div>
            </div>
          ) : (
            <div>
              {/* Segmented Amount Buttons (styled as requested) */}
              <div className="donate-amounts-segmented" role="radiogroup" aria-label="Donation amount">
                {DONATE_CONFIG.presetAmounts.map((amt) => {
                  const isSelected = selectedPreset === amt;
                  return (
                    <button
                      key={amt}
                      type="button"
                      className={`donate-amount-seg-btn ${isSelected ? 'active' : ''}`}
                      onClick={() => setSelectedPreset(amt)}
                      role="radio"
                      aria-checked={isSelected}
                    >
                      {DONATE_CONFIG.currencySymbol}
                      {amt.toFixed(2)}
                    </button>
                  );
                })}
                <button
                  type="button"
                  className={`donate-amount-seg-btn ${selectedPreset === 'other' ? 'active' : ''}`}
                  onClick={() => setSelectedPreset('other')}
                  role="radio"
                  aria-checked={selectedPreset === 'other'}
                >
                  Other
                </button>
              </div>

              {/* Custom Amount Input when "Other" is active */}
              {selectedPreset === 'other' && (
                <div className="donate-custom-input-wrap">
                  <span className="donate-custom-currency">{DONATE_CONFIG.currencySymbol}</span>
                  <input
                    type="number"
                    min={DONATE_CONFIG.minCustomAmount}
                    max={DONATE_CONFIG.maxCustomAmount}
                    step="1"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder="Enter custom amount"
                    className="donate-custom-input"
                    aria-label="Custom donation amount"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 3: Transaction Fee Offset Checkbox */}
        <label className="donate-offset-fee-box">
          <input
            type="checkbox"
            checked={offsetFee}
            onChange={(e) => setOffsetFee(e.target.checked)}
            className="donate-checkbox-input"
          />
          <div className="donate-offset-content">
            <span className="donate-offset-title">
              I'd like to add {DONATE_CONFIG.currencySymbol}{offsetFeeAmount.toFixed(2)} to cover payment processing fees so 100% of my contribution goes to Schada.
            </span>
            <span className="donate-offset-subtitle">
              Standard gateway processing rate ({feePercentageFormatted}% + {feeFixedFormatted}).
            </span>
          </div>
        </label>

        {/* Step 4: Summary Breakdown */}
        <div className="donate-summary">
          <div className="donate-summary-row">
            <span>Base Contribution ({frequency === 'lifetime' ? 'Lifetime' : 'One-time'})</span>
            <span>
              {DONATE_CONFIG.currencySymbol}
              {baseAmount.toFixed(2)}
            </span>
          </div>
          {offsetFee && (
            <div className="donate-summary-row">
              <span>Payment Processing Fee Offset</span>
              <span>
                +{DONATE_CONFIG.currencySymbol}
                {fee.toFixed(2)}
              </span>
            </div>
          )}
          <div className="donate-summary-row">
            <span>Patron Badge Duration</span>
            <span className="donate-duration-pill-tag">
              {estimatedExpiration.durationSummary}
            </span>
          </div>
          <div className="donate-summary-row donate-summary-detail-row">
            <span>Badge Active Through</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {estimatedExpiration.formattedDate}
            </span>
          </div>
          <div className="donate-summary-row total-row">
            <span>Total Payable</span>
            <span className="donate-total-amount">
              {DONATE_CONFIG.currencySymbol}
              {total.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Step 5: Submit Action Button */}
        <form onSubmit={handleCheckoutSubmit}>
          {stripeCheckoutUrl ? (
            <button type="submit" className="donate-submit-btn">
              <ExternalLink size={18} />
              <span>
                Donate {DONATE_CONFIG.currencySymbol}{total.toFixed(2)} via Stripe
                {isSandbox && ' (Test Sandbox)'}
              </span>
            </button>
          ) : (
            <button
              type="button"
              className="donate-submit-btn coming-soon-btn"
              disabled
            >
              <Info size={18} />
              <span>Payment Gateway Coming Soon</span>
            </button>
          )}
        </form>
        {isSandbox && (
          <p className="donate-submit-helper" style={{ color: 'var(--accent-gold)', marginTop: '0.6rem' }}>
            <span>🧪 <strong>Sandbox Active:</strong> Running on localhost / dev. Stripe test gateway is enforced without real charges.</span>
          </p>
        )}
        {!stripeCheckoutUrl && (
          <p className="donate-submit-helper">
            We are currently setting up our verified European Stripe Payment Link. Configure
            <code>VITE_STRIPE_PAYMENT_LINK</code> in <code>.env</code> to activate live checkout.
          </p>
        )}
      </section>

      {/* Patron Star Spotlight Card */}
      <section className="donate-star-spotlight">
        <div className="donate-star-header">
          <SchadaStar size={24} />
          <h2>Become a Schada Patron</h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Patrons receive the exclusive golden Schada star on their profile and next to their name in
          multiplayer lobbies, chat, and game scoreboards to celebrate their support.
        </p>

        {/* 3-Tier Duration Grid */}
        <div className="donate-duration-tiers-grid">
          <div className={`donate-duration-tier-card ${frequency === 'one-time' ? 'selected' : ''}`}>
            <div className="donate-tier-card-header">
              <span className="donate-tier-badge">One-Time</span>
              <span className="donate-tier-duration">1 Calendar Month</span>
            </div>
            <p>
              Active for exactly 1 calendar month from payment date (e.g. today through {getEstimatedBadgeExpiration('one-time').formattedDate}).
            </p>
          </div>
          <div className={`donate-duration-tier-card ${frequency === 'monthly' ? 'selected' : ''}`}>
            <div className="donate-tier-card-header">
              <span className="donate-tier-badge">Monthly</span>
              <span className="donate-tier-duration">Subscription + 1 Mo.</span>
            </div>
            <p>
              Active continuously while subscribed, plus a 1-calendar-month grace period after cancellation.
            </p>
          </div>
          <div className={`donate-duration-tier-card ${frequency === 'lifetime' ? 'selected' : ''}`}>
            <div className="donate-tier-card-header">
              <span className="donate-tier-badge lifetime">Lifetime</span>
              <span className="donate-tier-duration">Permanent</span>
            </div>
            <p>
              Permanently active on your profile and beside your username across all matches, lobbies, and leaderboards forever.
            </p>
          </div>
        </div>

        <div className="donate-star-preview-box">
          <div className="donate-star-demo-user">
            <div className="donate-avatar-mock">
              {user?.username ? user.username.charAt(0).toUpperCase() : DONATE_CONFIG.previewAvatarInitial}
            </div>
            <div className="donate-username-demo">
              <span>{user?.username || DONATE_CONFIG.previewUsername}</span>
              <PatronBadge size={14} />
            </div>
          </div>
          <div
            className={`donate-star-preview-status ${
              patronStatus.isActive
                ? 'active'
                : patronStatus.isExpired
                  ? 'expired'
                  : user
                    ? 'preview'
                    : 'idle'
            }`}
          >
            {patronStatus.isActive ? (
              <>
                <CheckCircle size={16} />
                <span>Active • {patronStatus.description}</span>
              </>
            ) : patronStatus.isExpired ? (
              <>
                <Clock size={16} />
                <span>Expired on {patronStatus.formattedExpirationDate}</span>
              </>
            ) : user ? (
              <>
                <Sparkles size={16} />
                <span>Preview: Star appears upon donating</span>
              </>
            ) : (
              <>
                <Info size={16} />
                <span>Registered accounts only</span>
              </>
            )}
          </div>
        </div>

        {!user && (
          <div className="donate-guest-notice">
            <Info size={20} className="donate-guest-notice-icon" />
            <span>
              <strong>Note for Guests:</strong> Patron star badges are linked exclusively to registered Schada accounts to prevent loss when temporary browser sessions expire. Sign in or register before donating to display your golden star!
            </span>
          </div>
        )}
      </section>

      {/* FAQ Accordion Section */}
      <section className="donate-faq-section">
        <h2>
          <HelpCircle size={22} color="var(--accent-gold)" />
          <span>Frequently Asked Questions</span>
        </h2>
        <div className="donate-faq-list">
          {DONATE_CONFIG.faqItems.map((item, index) => {
            const isOpen = openFaqIndex === index;
            return (
              <div key={item.question} className="donate-faq-item">
                <button
                  type="button"
                  className="donate-faq-question"
                  onClick={() => toggleFaq(index)}
                  aria-expanded={isOpen}
                >
                  <span>{item.question}</span>
                  {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                {isOpen && <div className="donate-faq-answer">{item.answer}</div>}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
};
