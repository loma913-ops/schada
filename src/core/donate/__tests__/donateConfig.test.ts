import { describe, it, expect } from 'vitest';
import {
  DONATE_CONFIG,
  DonateConfigError,
  validateDonateConfig,
  calculateProcessingFee,
  calculateDonationTotal,
  buildStripePaymentUrl,
  resolveStripePaymentLink,
  type DonateConfig,
} from '../donateConfig';

describe('DonateConfig and Calculation Logic', () => {
  it('validates the default configuration successfully', () => {
    expect(() => validateDonateConfig(DONATE_CONFIG)).not.toThrow();
    expect(DONATE_CONFIG.currency).toBe('EUR');
    expect(DONATE_CONFIG.currencySymbol).toBe('€');
    expect(DONATE_CONFIG.defaultLocale).toBe('en-US');
    expect(DONATE_CONFIG.previewUsername).toBe('SchadaPatron');
    expect(DONATE_CONFIG.previewAvatarInitial).toBe('P');
    expect(DONATE_CONFIG.lifetimeAmount).toBe(250);
    expect(DONATE_CONFIG.defaultSelectedAmount).toBe(10);
    expect(DONATE_CONFIG.defaultCustomAmount).toBe(25);
    expect(DONATE_CONFIG.defaultOffsetFee).toBe(false);
    expect(DONATE_CONFIG.presetAmounts).toEqual([5, 10, 20, 50]);
    expect(DONATE_CONFIG.disabledFrequencies).toContain('monthly');
    expect(DONATE_CONFIG.faqItems.length).toBeGreaterThan(0);
  });

  it('throws DonateConfigError on invalid configuration parameters', () => {
    expect(() => validateDonateConfig(null as unknown as DonateConfig)).toThrow(DonateConfigError);

    expect(() =>
      validateDonateConfig({
        ...DONATE_CONFIG,
        currency: '',
      })
    ).toThrow('Currency must be a non-empty string.');

    expect(() =>
      validateDonateConfig({
        ...DONATE_CONFIG,
        currencySymbol: '',
      })
    ).toThrow('Currency symbol must be a non-empty string.');

    expect(() =>
      validateDonateConfig({
        ...DONATE_CONFIG,
        defaultLocale: '',
      })
    ).toThrow('defaultLocale must be a non-empty string.');

    expect(() =>
      validateDonateConfig({
        ...DONATE_CONFIG,
        previewUsername: '',
      })
    ).toThrow('previewUsername must be a non-empty string.');

    expect(() =>
      validateDonateConfig({
        ...DONATE_CONFIG,
        previewAvatarInitial: '',
      })
    ).toThrow('previewAvatarInitial must be a non-empty string.');

    expect(() =>
      validateDonateConfig({
        ...DONATE_CONFIG,
        presetAmounts: [],
      })
    ).toThrow('Preset amounts must be a non-empty array of numbers.');

    expect(() =>
      validateDonateConfig({
        ...DONATE_CONFIG,
        presetAmounts: [5, -10],
      })
    ).toThrow('Invalid preset amount: -10');

    expect(() =>
      validateDonateConfig({
        ...DONATE_CONFIG,
        lifetimeAmount: -10,
      })
    ).toThrow('Invalid lifetime amount: -10');

    expect(() =>
      validateDonateConfig({
        ...DONATE_CONFIG,
        minCustomAmount: 0,
      })
    ).toThrow('Invalid minCustomAmount: 0');

    expect(() =>
      validateDonateConfig({
        ...DONATE_CONFIG,
        maxCustomAmount: 0,
      })
    ).toThrow('Invalid maxCustomAmount');

    expect(() =>
      validateDonateConfig({
        ...DONATE_CONFIG,
        defaultCustomAmount: 100000,
      })
    ).toThrow('Invalid defaultCustomAmount');

    expect(() =>
      validateDonateConfig({
        ...DONATE_CONFIG,
        defaultSelectedAmount: 999,
      })
    ).toThrow('Invalid defaultSelectedAmount: 999');

    expect(() =>
      validateDonateConfig({
        ...DONATE_CONFIG,
        defaultOffsetFee: 'false' as unknown as boolean,
      })
    ).toThrow('Invalid defaultOffsetFee: must be a boolean.');

    expect(() =>
      validateDonateConfig({
        ...DONATE_CONFIG,
        transactionFee: { percentage: 1.5, fixed: 0.25 },
      })
    ).toThrow('Invalid transaction fee percentage: 1.5');

    expect(() =>
      validateDonateConfig({
        ...DONATE_CONFIG,
        transactionFee: { percentage: 0.015, fixed: -1 },
      })
    ).toThrow('Invalid fixed transaction fee: -1');

    expect(() =>
      validateDonateConfig({
        ...DONATE_CONFIG,
        durations: null as any,
      })
    ).toThrow('Patron duration configuration is missing.');

    expect(() =>
      validateDonateConfig({
        ...DONATE_CONFIG,
        durations: { oneTimeCalendarMonths: 0, cancellationGraceCalendarMonths: 1 },
      })
    ).toThrow('Invalid oneTimeCalendarMonths: 0');

    expect(() =>
      validateDonateConfig({
        ...DONATE_CONFIG,
        durations: { oneTimeCalendarMonths: 1, cancellationGraceCalendarMonths: -1 },
      })
    ).toThrow('Invalid cancellationGraceCalendarMonths: -1');

    expect(() =>
      validateDonateConfig({
        ...DONATE_CONFIG,
        frequencyOptions: [],
      })
    ).toThrow('Frequency options must be a non-empty array.');

    expect(() =>
      validateDonateConfig({
        ...DONATE_CONFIG,
        faqItems: [],
      })
    ).toThrow('FAQ items must be a non-empty array.');

    expect(() =>
      validateDonateConfig({
        ...DONATE_CONFIG,
        stripe: {
          ...DONATE_CONFIG.stripe,
          live: { standard: 'http://insecure.url', lifetime: 'https://valid.url' },
        },
      })
    ).toThrow('Stripe live standard payment link must be a valid HTTPS URL.');

    expect(() =>
      validateDonateConfig({
        ...DONATE_CONFIG,
        stripe: {
          ...DONATE_CONFIG.stripe,
          live: { standard: 'https://valid.url', lifetime: 'not-a-url' },
        },
      })
    ).toThrow('Stripe live lifetime payment link must be a valid HTTPS URL.');
  });

  describe('calculateProcessingFee', () => {
    it('calculates 1.5% + €0.25 correctly rounded to 2 decimals', () => {
      // 5 * 0.015 + 0.25 = 0.075 + 0.25 = 0.325 -> 0.33
      expect(calculateProcessingFee(5)).toBe(0.33);

      // 10 * 0.015 + 0.25 = 0.15 + 0.25 = 0.40
      expect(calculateProcessingFee(10)).toBe(0.40);

      // 20 * 0.015 + 0.25 = 0.30 + 0.25 = 0.55
      expect(calculateProcessingFee(20)).toBe(0.55);

      // 50 * 0.015 + 0.25 = 0.75 + 0.25 = 1.00
      expect(calculateProcessingFee(50)).toBe(1.00);

      // 250 * 0.015 + 0.25 = 3.75 + 0.25 = 4.00
      expect(calculateProcessingFee(250)).toBe(4.00);
    });

    it('returns 0 for negative or invalid amounts', () => {
      expect(calculateProcessingFee(0)).toBe(0);
      expect(calculateProcessingFee(-10)).toBe(0);
      expect(calculateProcessingFee(NaN)).toBe(0);
    });

    it('throws when passed an invalid configuration', () => {
      expect(() => calculateProcessingFee(10, { ...DONATE_CONFIG, currency: '' })).toThrow(
        DonateConfigError
      );
    });
  });

  describe('calculateDonationTotal', () => {
    it('computes total with offsetFee false', () => {
      const res = calculateDonationTotal(10, false);
      expect(res.baseAmount).toBe(10);
      expect(res.fee).toBe(0);
      expect(res.total).toBe(10);
      expect(res.offsetFeeAmount).toBe(0.40);
    });

    it('computes total with offsetFee true', () => {
      const res = calculateDonationTotal(10, true);
      expect(res.baseAmount).toBe(10);
      expect(res.fee).toBe(0.40);
      expect(res.total).toBe(10.40);
      expect(res.offsetFeeAmount).toBe(0.40);
    });

    it('computes total for lifetime donation (€250) with offsetFee false and true', () => {
      const unchecked = calculateDonationTotal(250, false);
      expect(unchecked.baseAmount).toBe(250);
      expect(unchecked.fee).toBe(0);
      expect(unchecked.total).toBe(250.00);
      expect(unchecked.offsetFeeAmount).toBe(4.00);

      const res = calculateDonationTotal(250, true);
      expect(res.baseAmount).toBe(250);
      expect(res.fee).toBe(4.00);
      expect(res.total).toBe(254.00);
      expect(res.offsetFeeAmount).toBe(4.00);
    });

    it('throws when passed an invalid configuration', () => {
      expect(() => calculateDonationTotal(10, true, { ...DONATE_CONFIG, lifetimeAmount: -1 })).toThrow(
        DonateConfigError
      );
    });
  });

  describe('buildStripePaymentUrl', () => {
    it('returns null if base url is not provided or empty', () => {
      expect(buildStripePaymentUrl('', { baseAmount: 10, offsetFee: false, frequency: 'one-time' })).toBeNull();
      expect(buildStripePaymentUrl(undefined, { baseAmount: 10, offsetFee: false, frequency: 'one-time' })).toBeNull();
    });

    it('constructs correct Stripe Payment Link with prefilled_amount in cents', () => {
      const url = buildStripePaymentUrl(
        'https://buy.stripe.com/test_12345',
        {
          baseAmount: 10,
          offsetFee: false,
          frequency: 'one-time',
          clientReferenceId: 'usr_abc',
          prefilledEmail: 'test@example.com',
        }
      );

      expect(url).not.toBeNull();
      const parsed = new URL(url!);
      expect(parsed.origin).toBe('https://buy.stripe.com');
      expect(parsed.pathname).toBe('/test_12345');
      // €10.00 = 1000 cents
      expect(parsed.searchParams.get('prefilled_amount')).toBe('1000');
      expect(parsed.searchParams.get('client_reference_id')).toBe('usr_abc');
      expect(parsed.searchParams.get('prefilled_email')).toBe('test@example.com');
    });

    it('includes processing fee in prefilled_amount when offsetFee is true', () => {
      const url = buildStripePaymentUrl(
        'https://buy.stripe.com/test_12345',
        {
          baseAmount: 10,
          offsetFee: true,
          frequency: 'one-time',
        }
      );

      expect(url).not.toBeNull();
      const parsed = new URL(url!);
      // €10.40 = 1040 cents
      expect(parsed.searchParams.get('prefilled_amount')).toBe('1040');
    });

    it('handles donate.stripe.com domain with prefilled amounts seamlessly', () => {
      const url = buildStripePaymentUrl(
        'https://donate.stripe.com/test_28E14p3Oj9bR70o8rn63K01',
        {
          baseAmount: 20,
          offsetFee: true,
          frequency: 'one-time',
          clientReferenceId: 'guest_test',
        }
      );

      expect(url).not.toBeNull();
      const parsed = new URL(url!);
      expect(parsed.origin).toBe('https://donate.stripe.com');
      expect(parsed.pathname).toBe('/test_28E14p3Oj9bR70o8rn63K01');
      // €20.00 + €0.55 fee = €20.55 = 2055 cents
      expect(parsed.searchParams.get('prefilled_amount')).toBe('2055');
      expect(parsed.searchParams.get('client_reference_id')).toBe('guest_test');
    });

    it('throws when passed an invalid configuration', () => {
      expect(() =>
        buildStripePaymentUrl(
          'https://buy.stripe.com/test_123',
          { baseAmount: 10, offsetFee: false, frequency: 'one-time' },
          { ...DONATE_CONFIG, presetAmounts: [] }
        )
      ).toThrow(DonateConfigError);
    });
  });

  describe('resolveStripePaymentLink', () => {
    it('guarantees sandbox payment link on localhost', () => {
      const res = resolveStripePaymentLink({
        frequency: 'one-time',
        hostname: 'localhost',
        isDev: false,
      });
      expect(res.isSandbox).toBe(true);
      expect(res.url).toBe('https://donate.stripe.com/test_28E14p3Oj9bR70o8rn63K01');
    });

    it('guarantees sandbox lifetime link on localhost when offsetFee is false', () => {
      const res = resolveStripePaymentLink({
        frequency: 'lifetime',
        offsetFee: false,
        hostname: 'localhost',
        isDev: false,
      });
      expect(res.isSandbox).toBe(true);
      expect(res.url).toBe('https://donate.stripe.com/test_8x26oJ5Wr9bR2K80YV63K00');
    });

    it('falls back to pay-what-you-want link for lifetime on localhost when offsetFee is true so prefilled_amount works', () => {
      const res = resolveStripePaymentLink({
        frequency: 'lifetime',
        offsetFee: true,
        hostname: 'localhost',
        isDev: false,
      });
      expect(res.isSandbox).toBe(true);
      // Standard pay-what-you-want link so Stripe dynamically accepts prefilled_amount (€254)
      expect(res.url).toBe('https://donate.stripe.com/test_28E14p3Oj9bR70o8rn63K01');

      const checkoutUrl = buildStripePaymentUrl(res.url, {
        baseAmount: 250,
        offsetFee: true,
        frequency: 'lifetime',
      });
      expect(checkoutUrl).not.toBeNull();
      const parsed = new URL(checkoutUrl!);
      expect(parsed.searchParams.get('prefilled_amount')).toBe('25400');
    });

    it('guarantees sandbox link on 127.0.0.1', () => {
      const res = resolveStripePaymentLink({
        frequency: 'one-time',
        hostname: '127.0.0.1',
        isDev: false,
      });
      expect(res.isSandbox).toBe(true);
      expect(res.url).toBe('https://donate.stripe.com/test_28E14p3Oj9bR70o8rn63K01');
    });

    it('guarantees sandbox link when isDev is true regardless of hostname', () => {
      const res = resolveStripePaymentLink({
        frequency: 'one-time',
        hostname: 'schada.org',
        isDev: true,
      });
      expect(res.isSandbox).toBe(true);
      expect(res.url).toBe('https://donate.stripe.com/test_28E14p3Oj9bR70o8rn63K01');
    });

    it('returns production live link on non-localhost domain in production mode', () => {
      const res = resolveStripePaymentLink({
        frequency: 'one-time',
        hostname: 'schada.org',
        isDev: false,
        envPaymentLink: 'https://donate.stripe.com/live_custom_url',
      });
      expect(res.isSandbox).toBe(false);
      expect(res.url).toBe('https://donate.stripe.com/live_custom_url');
    });

    it('uses configured live link in production mode when envPaymentLink is omitted', () => {
      const res = resolveStripePaymentLink({
        frequency: 'one-time',
        hostname: 'schada.org',
        isDev: false,
      });
      expect(res.isSandbox).toBe(false);
      expect(res.url).toBe(DONATE_CONFIG.stripe.live!.standard);
    });

    it('throws DonateConfigError in production mode if live link is missing or empty', () => {
      const configWithoutLive: DonateConfig = {
        ...DONATE_CONFIG,
        stripe: {
          sandbox: DONATE_CONFIG.stripe.sandbox,
        },
      };

      expect(() =>
        resolveStripePaymentLink({
          frequency: 'one-time',
          hostname: 'schada.org',
          isDev: false,
          config: configWithoutLive,
        })
      ).toThrow('Live Stripe payment link is missing or unconfigured for frequency');
    });
  });
});

