import { DONATE_CONFIG, validateDonateConfig, type DonateConfig } from './donateConfig';

export type PatronTier = 'one-time' | 'recurring' | 'lifetime';
export type PatronSubscriptionStatus = 'active' | 'cancelled';

export interface PatronCandidate {
  readonly id?: string;
  readonly fromUserId?: string;
  readonly isPatron?: boolean;
  readonly hasDonated?: boolean;
  readonly fromUserIsPatron?: boolean;
  readonly patronTier?: PatronTier;
  readonly fromUserPatronTier?: PatronTier;
  readonly patronExpiresAt?: string | null;
  readonly fromUserPatronExpiresAt?: string | null;
  readonly patronSubscriptionStatus?: PatronSubscriptionStatus;
  readonly fromUserPatronSubscriptionStatus?: PatronSubscriptionStatus;
  readonly username?: string;
  readonly fromUsername?: string;
}

/**
 * Adds a specified number of calendar months to a given date with leap-year
 * awareness and end-of-month day clamping (e.g., Jan 31 + 1 month = Feb 28 or 29).
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time calendar arithmetic.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) strictly bounded.
 *
 * @param fromDate Starting date, timestamp string, or epoch ms.
 * @param monthsCount Number of calendar months to advance (must be >= 0).
 * @returns Resulting Date object.
 */
export function addCalendarMonths(fromDate: Date | string | number, monthsCount: number): Date {
  const sourceDate = new Date(fromDate);
  if (isNaN(sourceDate.getTime())) {
    throw new Error(`Invalid fromDate provided to addCalendarMonths: ${String(fromDate)}`);
  }
  if (!Number.isFinite(monthsCount) || monthsCount < 0) {
    throw new Error(`Invalid monthsCount provided to addCalendarMonths: ${monthsCount}`);
  }

  const originalYear = sourceDate.getUTCFullYear();
  const originalMonth = sourceDate.getUTCMonth();
  const originalDay = sourceDate.getUTCDate();

  // Target Year and Month
  const targetYear = originalYear + Math.floor((originalMonth + monthsCount) / 12);
  const targetMonth = (originalMonth + monthsCount) % 12;

  // Compute total days in target month
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();

  // Clamp original day to the maximum days available in target month
  const clampedDay = Math.min(originalDay, daysInTargetMonth);

  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      clampedDay,
      sourceDate.getUTCHours(),
      sourceDate.getUTCMinutes(),
      sourceDate.getUTCSeconds(),
      sourceDate.getUTCMilliseconds()
    )
  );
}

/**
 * Computes the patron expiration ISO timestamp based on donation tier and configuration.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1).
 * - Auxiliary Space Complexity: O(1).
 *
 * Growth Rate:
 * - O(1) strictly bounded.
 */
export function computePatronExpiration(
  tier: PatronTier,
  fromDate: Date | string | number = new Date(),
  config: DonateConfig = DONATE_CONFIG
): string | null {
  validateDonateConfig(config);

  if (tier === 'lifetime') {
    return null;
  }

  if (tier === 'recurring') {
    return null;
  }

  // One-time donation: 1 calendar month
  const targetDate = addCalendarMonths(fromDate, config.durations.oneTimeCalendarMonths);
  return targetDate.toISOString();
}

/**
 * Computes the expiration ISO timestamp when a recurring subscription is cancelled.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1).
 * - Auxiliary Space Complexity: O(1).
 *
 * Growth Rate:
 * - O(1) strictly bounded.
 */
export function computeCancellationExpiration(
  cancellationDate: Date | string | number = new Date(),
  config: DonateConfig = DONATE_CONFIG
): string {
  validateDonateConfig(config);
  const targetDate = addCalendarMonths(
    cancellationDate,
    config.durations.cancellationGraceCalendarMonths
  );
  return targetDate.toISOString();
}

/**
 * Evaluates whether a candidate user has an active, unexpired Patron status.
 *
 * STRICT GUEST RULE:
 * Guests must NEVER have the badge next to their name, even if they donate,
 * because their session will potentially be replaced when they return to the site.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time property lookups and timestamp comparison.
 * - Auxiliary Space Complexity: O(1) constant space.
 *
 * Growth Rate:
 * - O(1) strictly bounded.
 */
export function isPatronActive(
  candidate?: PatronCandidate | null,
  nowMs: number = Date.now()
): boolean {
  if (!candidate) {
    return false;
  }

  const effectiveId = candidate.fromUserId || candidate.id;

  // Guests never receive badges
  if (
    effectiveId &&
    (effectiveId.startsWith('guest_') || effectiveId === 'guest')
  ) {
    return false;
  }

  const effectiveTier = candidate.patronTier || candidate.fromUserPatronTier;
  const effectiveSubscriptionStatus = candidate.patronSubscriptionStatus || candidate.fromUserPatronSubscriptionStatus;
  const effectiveExpiresAt = candidate.patronExpiresAt !== undefined
    ? candidate.patronExpiresAt
    : candidate.fromUserPatronExpiresAt;

  // 1. Explicit Lifetime Tier
  if (effectiveTier === 'lifetime') {
    return true;
  }

  // 2. Explicit Recurring Tier
  if (effectiveTier === 'recurring') {
    if (effectiveSubscriptionStatus === 'cancelled') {
      if (effectiveExpiresAt) {
        const expiresMs = new Date(effectiveExpiresAt).getTime();
        return !isNaN(expiresMs) && expiresMs > nowMs;
      }
      return false;
    }
    // Active recurring subscription (or pending cancellation without expiration date)
    return effectiveSubscriptionStatus === 'active' || !effectiveSubscriptionStatus;
  }

  // 3. Explicit One-Time Tier
  if (effectiveTier === 'one-time') {
    if (!effectiveExpiresAt) {
      return false;
    }
    const expiresMs = new Date(effectiveExpiresAt).getTime();
    return !isNaN(expiresMs) && expiresMs > nowMs;
  }

  // 4. Candidate with explicit patronExpiresAt (from friend request or simplified payload)
  if (effectiveExpiresAt !== undefined) {
    if (effectiveExpiresAt === null) {
      return true; // null signifies perpetual/lifetime
    }
    const expiresMs = new Date(effectiveExpiresAt).getTime();
    return !isNaN(expiresMs) && expiresMs > nowMs;
  }

  // 5. Backward compatibility for legacy test records with boolean flags
  if (candidate.isPatron === true || candidate.hasDonated === true || candidate.fromUserIsPatron === true) {
    return true;
  }

  return false;
}

/**
 * Returns a human-friendly description of the patron status for display in profiles.
 * Delegates to getPatronStatusDetails to maintain single-source-of-truth status formatting.
 */
export function getPatronStatusDescription(
  candidate?: PatronCandidate | null,
  locale: string = DONATE_CONFIG.defaultLocale
): string {
  if (!candidate || !isPatronActive(candidate)) {
    return 'Not active';
  }
  return getPatronStatusDetails(candidate, undefined, locale).description;
}

export interface PatronStatusDetails {
  readonly isActive: boolean;
  readonly isGuest: boolean;
  readonly isLifetime: boolean;
  readonly isExpired: boolean;
  readonly tier?: PatronTier;
  readonly expiresAt?: string | null;
  readonly formattedExpirationDate?: string | null;
  readonly daysRemaining?: number | null;
  readonly description: string;
}

export interface EstimatedBadgeExpiration {
  readonly frequency: 'one-time' | 'monthly' | 'lifetime';
  readonly targetDate: Date | null;
  readonly formattedDate: string;
  readonly durationSummary: string;
  readonly explanation: string;
}

/**
 * Computes structured details about a candidate user's patron badge status,
 * including whether it is active, expired, lifetime, days remaining, and human-readable formatting.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time property lookups and timestamp arithmetic.
 * - Auxiliary Space Complexity: O(1) constant space.
 *
 * Growth Rate:
 * - O(1) strictly bounded.
 */
export function getPatronStatusDetails(
  candidate?: PatronCandidate | null,
  nowMs: number = Date.now(),
  locale: string = DONATE_CONFIG.defaultLocale
): PatronStatusDetails {
  if (!candidate) {
    return {
      isActive: false,
      isGuest: false,
      isLifetime: false,
      isExpired: false,
      description: 'No active Patron badge',
    };
  }

  const effectiveId = candidate.fromUserId || candidate.id;

  // Strict guest check: Guests never receive badges
  if (
    effectiveId &&
    (effectiveId.startsWith('guest_') || effectiveId === 'guest')
  ) {
    return {
      isActive: false,
      isGuest: true,
      isLifetime: false,
      isExpired: false,
      description: 'Guest accounts are not eligible for badges',
    };
  }

  const effectiveTier = candidate.patronTier || candidate.fromUserPatronTier;
  const effectiveSubscriptionStatus = candidate.patronSubscriptionStatus || candidate.fromUserPatronSubscriptionStatus;
  const effectiveExpiresAt = candidate.patronExpiresAt !== undefined
    ? candidate.patronExpiresAt
    : candidate.fromUserPatronExpiresAt;

  // Lifetime
  if (effectiveTier === 'lifetime' || effectiveExpiresAt === null) {
    return {
      isActive: true,
      isGuest: false,
      isLifetime: true,
      isExpired: false,
      tier: 'lifetime',
      expiresAt: null,
      formattedExpirationDate: null,
      daysRemaining: null,
      description: 'Lifetime Patron • Permanent Badge',
    };
  }

  // Recurring
  if (effectiveTier === 'recurring') {
    if (effectiveSubscriptionStatus === 'cancelled') {
      if (effectiveExpiresAt) {
        const expiresMs = new Date(effectiveExpiresAt).getTime();
        const isExpired = isNaN(expiresMs) || expiresMs <= nowMs;
        const expDate = isNaN(expiresMs) ? null : new Date(expiresMs);
        const formattedExpirationDate = expDate
          ? expDate.toLocaleDateString(locale, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : null;
        const daysRemaining = isExpired
          ? 0
          : Math.max(0, Math.ceil((expiresMs - nowMs) / (1000 * 60 * 60 * 24)));

        return {
          isActive: !isExpired,
          isGuest: false,
          isLifetime: false,
          isExpired,
          tier: 'recurring',
          expiresAt: effectiveExpiresAt,
          formattedExpirationDate,
          daysRemaining: isExpired ? null : daysRemaining,
          description: isExpired
            ? `Recurring (Cancelled) • Expired on ${formattedExpirationDate || 'unknown date'}`
            : `Recurring (Cancelled) • Active through ${formattedExpirationDate || 'date'} (${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} left)`,
        };
      }
      return {
        isActive: false,
        isGuest: false,
        isLifetime: false,
        isExpired: true,
        tier: 'recurring',
        description: 'Recurring (Cancelled) • Subscription Ended',
      };
    }

    // Active recurring subscription
    return {
      isActive: true,
      isGuest: false,
      isLifetime: false,
      isExpired: false,
      tier: 'recurring',
      expiresAt: null,
      formattedExpirationDate: null,
      daysRemaining: null,
      description: 'Recurring Patron • Active Subscription',
    };
  }

  // One-time or explicit expiresAt timestamp
  if (effectiveTier === 'one-time' || effectiveExpiresAt) {
    if (effectiveExpiresAt) {
      const expiresMs = new Date(effectiveExpiresAt).getTime();
      const isExpired = isNaN(expiresMs) || expiresMs <= nowMs;
      const expDate = isNaN(expiresMs) ? null : new Date(expiresMs);
      const formattedExpirationDate = expDate
        ? expDate.toLocaleDateString(locale, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : null;
      const daysRemaining = isExpired
        ? 0
        : Math.max(0, Math.ceil((expiresMs - nowMs) / (1000 * 60 * 60 * 24)));

      return {
        isActive: !isExpired,
        isGuest: false,
        isLifetime: false,
        isExpired,
        tier: effectiveTier || 'one-time',
        expiresAt: effectiveExpiresAt,
        formattedExpirationDate,
        daysRemaining: isExpired ? null : daysRemaining,
        description: isExpired
          ? `Patron • Expired on ${formattedExpirationDate || 'unknown date'}`
          : `Patron • Active through ${formattedExpirationDate || 'date'} (${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} left)`,
      };
    }
  }

  // Legacy fallback boolean flags
  if (candidate.isPatron === true || candidate.hasDonated === true || candidate.fromUserIsPatron === true) {
    return {
      isActive: true,
      isGuest: false,
      isLifetime: false,
      isExpired: false,
      description: 'Patron • Active',
    };
  }

  return {
    isActive: false,
    isGuest: false,
    isLifetime: false,
    isExpired: false,
    description: 'No active Patron badge',
  };
}

/**
 * Returns estimated badge expiration info for a prospective donation frequency.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1).
 * - Auxiliary Space Complexity: O(1).
 *
 * Growth Rate:
 * - O(1) strictly bounded.
 */
export function getEstimatedBadgeExpiration(
  frequency: 'one-time' | 'monthly' | 'lifetime',
  fromDate: Date | string | number = new Date(),
  config: DonateConfig = DONATE_CONFIG,
  locale: string = config.defaultLocale
): EstimatedBadgeExpiration {
  validateDonateConfig(config);

  if (frequency === 'lifetime') {
    return {
      frequency,
      targetDate: null,
      formattedDate: 'Never expires',
      durationSummary: 'Permanent',
      explanation: 'Permanent golden star badge next to your username forever.',
    };
  }

  if (frequency === 'monthly') {
    return {
      frequency,
      targetDate: null,
      formattedDate: 'Active while subscribed',
      durationSummary: 'Ongoing monthly',
      explanation: 'Renews automatically each month; persists for 1 calendar month after cancellation.',
    };
  }

  const targetDate = addCalendarMonths(fromDate, config.durations.oneTimeCalendarMonths);
  const formattedDate = targetDate.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return {
    frequency,
    targetDate,
    formattedDate,
    durationSummary: '1 calendar month',
    explanation: `Active for 1 calendar month through ${formattedDate}.`,
  };
}

