/**
 * Schada Donation & Patron Configuration
 *
 * Centralized, strictly validated configuration for donation options,
 * currency formatting, payment frequencies, preset amounts, transaction
 * cost offset calculations, and Stripe integration.
 */

export type DonationFrequency = 'one-time' | 'monthly' | 'lifetime';

export interface TransactionFeeConfig {
  /** Fee multiplier (e.g., 0.015 for 1.5%) */
  readonly percentage: number;
  /** Flat fee in Euros (e.g., 0.25 for €0.25) */
  readonly fixed: number;
}

export interface DonateFaqItem {
  readonly question: string;
  readonly answer: string;
}

export interface PatronDurationConfig {
  /** Number of calendar months granted per one-time donation */
  readonly oneTimeCalendarMonths: number;
  /** Number of calendar months grace period after recurring cancellation */
  readonly cancellationGraceCalendarMonths: number;
}

export interface StripeEndpointConfig {
  readonly standard: string;
  readonly lifetime: string;
}

export interface StripeGatewayConfig {
  readonly sandbox: StripeEndpointConfig;
  readonly live?: StripeEndpointConfig;
}

export interface DonateConfig {
  readonly currency: string;
  readonly currencySymbol: string;
  readonly defaultLocale: string;
  readonly previewUsername: string;
  readonly previewAvatarInitial: string;
  readonly frequencyOptions: readonly DonationFrequency[];
  readonly disabledFrequencies: readonly DonationFrequency[];
  readonly presetAmounts: readonly number[];
  readonly lifetimeAmount: number;
  readonly defaultSelectedAmount: number;
  readonly defaultCustomAmount: number;
  readonly defaultOffsetFee: boolean;
  readonly minCustomAmount: number;
  readonly maxCustomAmount: number;
  readonly transactionFee: TransactionFeeConfig;
  readonly durations: PatronDurationConfig;
  readonly faqItems: readonly DonateFaqItem[];
  readonly stripe: StripeGatewayConfig;
}

export class DonateConfigError extends Error {
  constructor(message: string) {
    super(`DonateConfigError: ${message}`);
    this.name = 'DonateConfigError';
  }
}

/**
 * Validates the donation configuration object.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(P + F) where P is preset count and F is FAQ count.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(P + F) linear with respect to configured items, executing in microseconds.
 */
export function validateDonateConfig(config: DonateConfig): void {
  if (!config) {
    throw new DonateConfigError('Configuration object is required.');
  }

  if (typeof config.currency !== 'string' || config.currency.trim().length === 0) {
    throw new DonateConfigError('Currency must be a non-empty string.');
  }

  if (typeof config.currencySymbol !== 'string' || config.currencySymbol.trim().length === 0) {
    throw new DonateConfigError('Currency symbol must be a non-empty string.');
  }

  if (typeof config.defaultLocale !== 'string' || config.defaultLocale.trim().length === 0) {
    throw new DonateConfigError('defaultLocale must be a non-empty string.');
  }

  if (typeof config.previewUsername !== 'string' || config.previewUsername.trim().length === 0) {
    throw new DonateConfigError('previewUsername must be a non-empty string.');
  }

  if (typeof config.previewAvatarInitial !== 'string' || config.previewAvatarInitial.trim().length === 0) {
    throw new DonateConfigError('previewAvatarInitial must be a non-empty string.');
  }

  if (!Array.isArray(config.frequencyOptions) || config.frequencyOptions.length === 0) {
    throw new DonateConfigError('Frequency options must be a non-empty array.');
  }

  if (!Array.isArray(config.disabledFrequencies)) {
    throw new DonateConfigError('Disabled frequencies must be an array.');
  }

  if (!Array.isArray(config.presetAmounts) || config.presetAmounts.length === 0) {
    throw new DonateConfigError('Preset amounts must be a non-empty array of numbers.');
  }

  for (const amt of config.presetAmounts) {
    if (typeof amt !== 'number' || !Number.isFinite(amt) || amt <= 0) {
      throw new DonateConfigError(`Invalid preset amount: ${amt}. Must be a positive finite number.`);
    }
  }

  if (typeof config.lifetimeAmount !== 'number' || !Number.isFinite(config.lifetimeAmount) || config.lifetimeAmount <= 0) {
    throw new DonateConfigError(`Invalid lifetime amount: ${config.lifetimeAmount}. Must be a positive number.`);
  }

  if (typeof config.minCustomAmount !== 'number' || !Number.isFinite(config.minCustomAmount) || config.minCustomAmount <= 0) {
    throw new DonateConfigError(`Invalid minCustomAmount: ${config.minCustomAmount}. Must be > 0.`);
  }

  if (typeof config.maxCustomAmount !== 'number' || !Number.isFinite(config.maxCustomAmount) || config.maxCustomAmount <= config.minCustomAmount) {
    throw new DonateConfigError(`Invalid maxCustomAmount: ${config.maxCustomAmount}. Must be greater than minCustomAmount.`);
  }

  if (
    typeof config.defaultCustomAmount !== 'number' ||
    !Number.isFinite(config.defaultCustomAmount) ||
    config.defaultCustomAmount < config.minCustomAmount ||
    config.defaultCustomAmount > config.maxCustomAmount
  ) {
    throw new DonateConfigError(
      `Invalid defaultCustomAmount: ${config.defaultCustomAmount}. Must be between minCustomAmount and maxCustomAmount.`
    );
  }

  if (
    typeof config.defaultSelectedAmount !== 'number' ||
    !Number.isFinite(config.defaultSelectedAmount) ||
    !config.presetAmounts.includes(config.defaultSelectedAmount)
  ) {
    throw new DonateConfigError(
      `Invalid defaultSelectedAmount: ${config.defaultSelectedAmount}. Must be present in presetAmounts.`
    );
  }

  if (typeof config.defaultOffsetFee !== 'boolean') {
    throw new DonateConfigError('Invalid defaultOffsetFee: must be a boolean.');
  }

  if (!config.transactionFee) {
    throw new DonateConfigError('Transaction fee configuration is missing.');
  }

  if (
    typeof config.transactionFee.percentage !== 'number' ||
    !Number.isFinite(config.transactionFee.percentage) ||
    config.transactionFee.percentage < 0 ||
    config.transactionFee.percentage > 1
  ) {
    throw new DonateConfigError(
      `Invalid transaction fee percentage: ${config.transactionFee.percentage}. Must be between 0 and 1.`
    );
  }

  if (
    typeof config.transactionFee.fixed !== 'number' ||
    !Number.isFinite(config.transactionFee.fixed) ||
    config.transactionFee.fixed < 0
  ) {
    throw new DonateConfigError(`Invalid fixed transaction fee: ${config.transactionFee.fixed}. Must be non-negative.`);
  }

  if (!config.durations) {
    throw new DonateConfigError('Patron duration configuration is missing.');
  }

  if (
    typeof config.durations.oneTimeCalendarMonths !== 'number' ||
    !Number.isFinite(config.durations.oneTimeCalendarMonths) ||
    config.durations.oneTimeCalendarMonths < 1
  ) {
    throw new DonateConfigError(
      `Invalid oneTimeCalendarMonths: ${config.durations.oneTimeCalendarMonths}. Must be an integer >= 1.`
    );
  }

  if (
    typeof config.durations.cancellationGraceCalendarMonths !== 'number' ||
    !Number.isFinite(config.durations.cancellationGraceCalendarMonths) ||
    config.durations.cancellationGraceCalendarMonths < 1
  ) {
    throw new DonateConfigError(
      `Invalid cancellationGraceCalendarMonths: ${config.durations.cancellationGraceCalendarMonths}. Must be an integer >= 1.`
    );
  }

  if (!Array.isArray(config.faqItems) || config.faqItems.length === 0) {
    throw new DonateConfigError('FAQ items must be a non-empty array.');
  }

  for (const item of config.faqItems) {
    if (!item || typeof item.question !== 'string' || item.question.trim().length === 0) {
      throw new DonateConfigError('Each FAQ item must contain a non-empty question string.');
    }
    if (typeof item.answer !== 'string' || item.answer.trim().length === 0) {
      throw new DonateConfigError('Each FAQ item must contain a non-empty answer string.');
    }
  }

  if (!config.stripe) {
    throw new DonateConfigError('Stripe configuration is missing.');
  }

  if (
    !config.stripe.sandbox ||
    typeof config.stripe.sandbox.standard !== 'string' ||
    !config.stripe.sandbox.standard.startsWith('https://')
  ) {
    throw new DonateConfigError('Stripe sandbox standard payment link must be a valid HTTPS URL.');
  }

  if (
    typeof config.stripe.sandbox.lifetime !== 'string' ||
    !config.stripe.sandbox.lifetime.startsWith('https://')
  ) {
    throw new DonateConfigError('Stripe sandbox lifetime payment link must be a valid HTTPS URL.');
  }

  if (config.stripe.live) {
    if (
      typeof config.stripe.live.standard !== 'string' ||
      !config.stripe.live.standard.startsWith('https://')
    ) {
      throw new DonateConfigError('Stripe live standard payment link must be a valid HTTPS URL.');
    }

    if (
      typeof config.stripe.live.lifetime !== 'string' ||
      !config.stripe.live.lifetime.startsWith('https://')
    ) {
      throw new DonateConfigError('Stripe live lifetime payment link must be a valid HTTPS URL.');
    }
  }
}

export const DONATE_CONFIG: DonateConfig = Object.freeze({
  currency: 'EUR',
  currencySymbol: '€',
  defaultLocale: 'en-US',
  previewUsername: 'SchadaPatron',
  previewAvatarInitial: 'P',
  frequencyOptions: Object.freeze(['one-time', 'monthly', 'lifetime'] as const),
  disabledFrequencies: Object.freeze(['monthly'] as const),
  presetAmounts: Object.freeze([5, 10, 20, 50]),
  lifetimeAmount: 250,
  defaultSelectedAmount: 10,
  defaultCustomAmount: 25,
  defaultOffsetFee: false,
  minCustomAmount: 1,
  maxCustomAmount: 5000,
  transactionFee: Object.freeze({
    percentage: 0.015, // 1.5%
    fixed: 0.25,       // €0.25
  }),
  durations: Object.freeze({
    oneTimeCalendarMonths: 1,
    cancellationGraceCalendarMonths: 1,
  }),
  faqItems: Object.freeze([
    {
      question: 'Where does the money go?',
      answer:
        '100% of contributions go directly toward running and maintaining Schada.org. This includes our cloud servers, low-latency multiplayer WebSockets, database hosting, SSL certificates, domain upkeep, and continuous open-source development.',
    },
    {
      question: 'Is Schada an official non-profit?',
      answer:
        'Schada is operated as a free, non-profit community project and open-source platform. We are dedicated to preserving Jan Boogerd’s 1936 tactical mind sport with zero advertisements, zero tracking, and zero subscription paywalls.',
    },
    {
      question: 'Are any gameplay features locked behind donations?',
      answer:
        'No, never! Schada is completely free for everyone, forever. All board features, AI bots (Levels 1–8), ranked matchmaking, move history analysis, and custom rooms are available to all players. Patrons receive the golden Schada star on their registered profile as a badge of appreciation. One-time donations grant the star for one calendar month, recurring contributions keep it active through one calendar month post-cancellation, and lifetime patrons enjoy permanent star recognition.',
    },
    {
      question: 'When does my Patron star badge expire?',
      answer:
        'Badge expiration depends strictly on your contribution tier: One-time donations grant the golden star for exactly one calendar month from the date of payment. Monthly recurring donations keep the star active throughout your subscription and retain it for one calendar month after cancellation. Lifetime patrons enjoy permanent star recognition that never expires. Note: Badges require a registered account so your duration tracking is preserved across browser sessions.',
    },
    {
      question: 'Can I cancel or change a recurring donation?',
      answer:
        'Monthly recurring donations will be integrated soon via the Stripe Customer Portal, where you can modify or cancel at any time with a single click.',
    },
    {
      question: 'Other methods of donation?',
      answer:
        'We will also support direct SEPA European bank transfers and GitHub Sponsors alongside our direct Stripe gateway integration.',
    },
  ]),
  stripe: Object.freeze({
    sandbox: Object.freeze({
      standard: 'https://donate.stripe.com/test_28E14p3Oj9bR70o8rn63K01',
      lifetime: 'https://donate.stripe.com/test_8x26oJ5Wr9bR2K80YV63K00',
    }),
    live: Object.freeze({
      standard: 'https://donate.stripe.com/14A28s1wB3L19sk5Gg1Jm00',
      lifetime: 'https://buy.stripe.com/28EdRaejn0yP4807Oo1Jm01',
    }),
  }),
});

// Strictly validate on startup
validateDonateConfig(DONATE_CONFIG);

export interface ResolveStripePaymentOptions {
  frequency: DonationFrequency;
  offsetFee?: boolean;
  hostname?: string;
  isDev?: boolean;
  config?: DonateConfig;
  envPaymentLink?: string;
  envLifetimePaymentLink?: string;
}

/**
 * Resolves the Stripe Payment Link URL with an ironclad safety guarantee:
 * Whenever running on localhost, 127.0.0.1, or in development mode, it is guaranteed
 * without a doubt to strictly use Stripe Sandbox (test_...) endpoints, preventing any live charges.
 *
 * For fixed-price Lifetime products, if offsetFee is active, routes through the dynamic
 * pay-what-you-want link so Stripe dynamically accepts and loads the total amount (e.g., €254.00)
 * rather than ignoring prefilled_amount on fixed-price links.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time checks.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) strictly bounded.
 */
export function resolveStripePaymentLink(options: ResolveStripePaymentOptions): {
  url: string;
  isSandbox: boolean;
} {
  const config = options.config || DONATE_CONFIG;
  validateDonateConfig(config);

  const hostname =
    options.hostname ||
    (typeof window !== 'undefined' ? window.location.hostname : '');
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isDev =
    options.isDev ??
    (typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV));

  // If lifetime donation with fee offset is active, route through the dynamic
  // pay-what-you-want link so Stripe dynamically accepts prefilled_amount
  // (fixed-price Stripe payment links ignore prefilled_amount).
  const isLifetimeWithFee = options.frequency === 'lifetime' && Boolean(options.offsetFee);

  // Ironclad guarantee: on localhost or in dev, ALWAYS force sandbox
  if (isLocalhost || isDev) {
    const sandboxUrl =
      options.frequency === 'lifetime' && !isLifetimeWithFee
        ? config.stripe.sandbox.lifetime
        : config.stripe.sandbox.standard;
    return { url: sandboxUrl, isSandbox: true };
  }

  // Production environment: use configured environment or live config
  const liveUrl =
    options.frequency === 'lifetime' && !isLifetimeWithFee
      ? options.envLifetimePaymentLink || config.stripe.live?.lifetime
      : options.envPaymentLink || config.stripe.live?.standard;

  if (!liveUrl || typeof liveUrl !== 'string' || !liveUrl.trim()) {
    throw new DonateConfigError(
      `Live Stripe payment link is missing or unconfigured for frequency '${options.frequency}' in production.`
    );
  }

  return {
    url: liveUrl.trim(),
    isSandbox: liveUrl.includes('test_'),
  };
}

/**
 * Calculates the payment processing offset fee for a given base amount.
 * Formula: Math.round((amount * percentage + fixed) * 100) / 100
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time floating-point arithmetic.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) strictly bounded, scales sustainably to infinite calls.
 */
export function calculateProcessingFee(amount: number, config: DonateConfig = DONATE_CONFIG): number {
  validateDonateConfig(config);
  if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
    return 0;
  }
  const rawFee = amount * config.transactionFee.percentage + config.transactionFee.fixed;
  return Math.round(rawFee * 100) / 100;
}

/**
 * Calculates total payable amount including fee offset if active.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time arithmetic.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) strictly bounded.
 */
export function calculateDonationTotal(
  amount: number,
  offsetFee: boolean,
  config: DonateConfig = DONATE_CONFIG
): { baseAmount: number; fee: number; total: number; offsetFeeAmount: number } {
  validateDonateConfig(config);
  const base = Math.max(0, typeof amount === 'number' && !isNaN(amount) ? amount : 0);
  const offsetFeeAmount = calculateProcessingFee(base, config);
  const fee = offsetFee ? offsetFeeAmount : 0;
  const total = Math.round((base + fee) * 100) / 100;

  return {
    baseAmount: base,
    fee,
    total,
    offsetFeeAmount,
  };
}

export interface StripePaymentUrlOptions {
  baseAmount: number;
  offsetFee: boolean;
  frequency: DonationFrequency;
  clientReferenceId?: string;
  prefilledEmail?: string;
}

/**
 * Builds a Stripe Payment Link URL with prefilled_amount, client_reference_id,
 * and prefilled_email according to Stripe Payment Links URL parameter specifications.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(L) where L is the character length of the base URL string.
 * - Auxiliary Space Complexity: O(L) for the reconstructed URL search parameter string.
 *
 * Growth Rate:
 * - O(L) bounded by standard browser URL limits (<= 2048 chars).
 */
export function buildStripePaymentUrl(
  baseUrl: string | undefined,
  options: StripePaymentUrlOptions,
  config: DonateConfig = DONATE_CONFIG
): string | null {
  validateDonateConfig(config);
  if (!baseUrl || typeof baseUrl !== 'string' || !baseUrl.trim()) {
    return null;
  }

  const { total } = calculateDonationTotal(options.baseAmount, options.offsetFee, config);
  const cents = Math.round(total * 100);

  if (cents <= 0) {
    return null;
  }

  try {
    const url = new URL(baseUrl.trim());
    url.searchParams.set('prefilled_amount', String(cents));

    if (options.clientReferenceId && options.clientReferenceId.trim()) {
      url.searchParams.set('client_reference_id', options.clientReferenceId.trim());
    }

    if (options.prefilledEmail && options.prefilledEmail.trim()) {
      url.searchParams.set('prefilled_email', options.prefilledEmail.trim());
    }

    return url.toString();
  } catch {
    return null;
  }
}
