import { describe, it, expect } from 'vitest';
import {
  addCalendarMonths,
  computePatronExpiration,
  computeCancellationExpiration,
  isPatronActive,
  getPatronStatusDescription,
  getPatronStatusDetails,
  getEstimatedBadgeExpiration,
  type PatronCandidate,
} from '../patronService';

describe('patronService - Calendar Month Math & Expiration Engine', () => {
  describe('addCalendarMonths', () => {
    it('advances dates by exact calendar months', () => {
      const jan15 = new Date('2026-01-15T12:00:00.000Z');
      const feb15 = addCalendarMonths(jan15, 1);
      expect(feb15.toISOString()).toBe('2026-02-15T12:00:00.000Z');
    });

    it('correctly clamps end-of-month days to non-leap year February (Jan 31 -> Feb 28)', () => {
      const jan31 = new Date('2025-01-31T00:00:00.000Z');
      const feb28 = addCalendarMonths(jan31, 1);
      expect(feb28.toISOString()).toBe('2025-02-28T00:00:00.000Z');
    });

    it('correctly clamps end-of-month days to leap year February (Jan 31, 2024 -> Feb 29, 2024)', () => {
      const jan31Leap = new Date('2024-01-31T00:00:00.000Z');
      const feb29 = addCalendarMonths(jan31Leap, 1);
      expect(feb29.toISOString()).toBe('2024-02-29T00:00:00.000Z');
    });

    it('correctly clamps 31-day months to 30-day target months (Aug 31 -> Sep 30, Mar 31 -> Apr 30)', () => {
      const mar31 = new Date('2026-03-31T15:30:00.000Z');
      const apr30 = addCalendarMonths(mar31, 1);
      expect(apr30.toISOString()).toBe('2026-04-30T15:30:00.000Z');

      const aug31 = new Date('2026-08-31T08:00:00.000Z');
      const sep30 = addCalendarMonths(aug31, 1);
      expect(sep30.toISOString()).toBe('2026-09-30T08:00:00.000Z');
    });

    it('crosses year boundaries cleanly (Dec 15, 2026 -> Jan 15, 2027)', () => {
      const dec15 = new Date('2026-12-15T10:00:00.000Z');
      const jan15 = addCalendarMonths(dec15, 1);
      expect(jan15.toISOString()).toBe('2027-01-15T10:00:00.000Z');
    });

    it('throws meaningful error on invalid date or negative months count', () => {
      expect(() => addCalendarMonths('not-a-date', 1)).toThrow('Invalid fromDate');
      expect(() => addCalendarMonths(new Date(), -1)).toThrow('Invalid monthsCount');
    });
  });

  describe('computePatronExpiration & computeCancellationExpiration', () => {
    it('returns null for lifetime patrons (perpetual)', () => {
      expect(computePatronExpiration('lifetime')).toBeNull();
    });

    it('returns null for active recurring patrons', () => {
      expect(computePatronExpiration('recurring')).toBeNull();
    });

    it('returns 1 calendar month in the future for one-time donations', () => {
      const base = new Date('2026-06-10T12:00:00.000Z');
      const exp = computePatronExpiration('one-time', base);
      expect(exp).toBe('2026-07-10T12:00:00.000Z');
    });

    it('computes 1 calendar month grace period upon cancellation of recurring payments', () => {
      const cancelDate = new Date('2026-05-31T12:00:00.000Z');
      const graceExp = computeCancellationExpiration(cancelDate);
      expect(graceExp).toBe('2026-06-30T12:00:00.000Z');
    });
  });

  describe('isPatronActive & Guest Exclusion Rules', () => {
    const fixedNow = new Date('2026-05-15T12:00:00.000Z').getTime();

    it('returns false for null, undefined, or empty candidates', () => {
      expect(isPatronActive(null, fixedNow)).toBe(false);
      expect(isPatronActive(undefined, fixedNow)).toBe(false);
      expect(isPatronActive({}, fixedNow)).toBe(false);
    });

    it('STRICT GUEST RULE: never grants badge to guest accounts under any circumstances', () => {
      // Even if guest is marked isPatron or lifetime, guests must never display the badge
      expect(isPatronActive({ id: 'guest', isPatron: true, patronTier: 'lifetime' }, fixedNow)).toBe(false);
      expect(isPatronActive({ id: 'guest_abc123', patronTier: 'lifetime', hasDonated: true }, fixedNow)).toBe(false);
      expect(isPatronActive({ id: 'guest_xyz', patronTier: 'one-time', patronExpiresAt: '2099-01-01T00:00:00Z' }, fixedNow)).toBe(false);
    });

    it('returns true permanently for registered lifetime patrons', () => {
      const lifetimeUser: PatronCandidate = {
        id: 'usr_valid_123',
        patronTier: 'lifetime',
      };
      expect(isPatronActive(lifetimeUser, fixedNow)).toBe(true);
    });

    it('returns true for active recurring patrons', () => {
      const activeRecurringUser: PatronCandidate = {
        id: 'usr_valid_123',
        patronTier: 'recurring',
        patronSubscriptionStatus: 'active',
      };
      expect(isPatronActive(activeRecurringUser, fixedNow)).toBe(true);
    });

    it('returns true for cancelled recurring patrons while within 1 calendar month grace period', () => {
      const unexpiredCancelled: PatronCandidate = {
        id: 'usr_valid_123',
        patronTier: 'recurring',
        patronSubscriptionStatus: 'cancelled',
        // Expiring in June (after May 15)
        patronExpiresAt: '2026-06-15T12:00:00.000Z',
      };
      expect(isPatronActive(unexpiredCancelled, fixedNow)).toBe(true);
    });

    it('returns false for cancelled recurring patrons once 1 calendar month grace period has passed', () => {
      const expiredCancelled: PatronCandidate = {
        id: 'usr_valid_123',
        patronTier: 'recurring',
        patronSubscriptionStatus: 'cancelled',
        // Expired in April (before May 15)
        patronExpiresAt: '2026-04-15T12:00:00.000Z',
      };
      expect(isPatronActive(expiredCancelled, fixedNow)).toBe(false);
    });

    it('returns true for one-time donors while within 1 calendar month of donation', () => {
      const activeOneTime: PatronCandidate = {
        id: 'usr_valid_123',
        patronTier: 'one-time',
        patronExpiresAt: '2026-06-01T00:00:00.000Z',
      };
      expect(isPatronActive(activeOneTime, fixedNow)).toBe(true);
    });

    it('returns false for one-time donors after 1 calendar month has elapsed', () => {
      const expiredOneTime: PatronCandidate = {
        id: 'usr_valid_123',
        patronTier: 'one-time',
        patronExpiresAt: '2026-05-01T00:00:00.000Z',
      };
      expect(isPatronActive(expiredOneTime, fixedNow)).toBe(false);
    });

    it('supports backward-compatible legacy records without explicit tier', () => {
      expect(isPatronActive({ id: 'usr_legacy', isPatron: true }, fixedNow)).toBe(true);
      expect(isPatronActive({ id: 'usr_legacy', hasDonated: true }, fixedNow)).toBe(true);
      expect(isPatronActive({ id: 'usr_legacy', fromUserIsPatron: true }, fixedNow)).toBe(true);
    });
  });

  describe('getPatronStatusDescription', () => {
    it('returns formatted description for lifetime patrons', () => {
      const desc = getPatronStatusDescription({ id: 'usr_1', patronTier: 'lifetime' });
      expect(desc).toContain('Lifetime Patron');
    });

    it('returns formatted description for active recurring patrons', () => {
      const desc = getPatronStatusDescription({
        id: 'usr_1',
        patronTier: 'recurring',
        patronSubscriptionStatus: 'active',
      });
      expect(desc).toContain('Recurring Patron');
    });

    it('returns formatted description for active one-time patrons with date', () => {
      const desc = getPatronStatusDescription({
        id: 'usr_1',
        patronTier: 'one-time',
        patronExpiresAt: '2099-12-31T00:00:00.000Z',
      });
      expect(desc).toContain('Active through');
      expect(desc).toContain('2099');
    });

    it('returns "Not active" for non-patrons or guests', () => {
      expect(getPatronStatusDescription(null)).toBe('Not active');
      expect(getPatronStatusDescription({ id: 'guest', patronTier: 'lifetime' })).toBe('Not active');
    });
  });

  describe('getPatronStatusDetails', () => {
    const fixedNow = new Date('2026-05-15T12:00:00.000Z').getTime();

    it('returns structured details for non-patrons and guests', () => {
      const nullDetails = getPatronStatusDetails(null, fixedNow);
      expect(nullDetails.isActive).toBe(false);
      expect(nullDetails.isGuest).toBe(false);

      const guestDetails = getPatronStatusDetails({ id: 'guest_123', patronTier: 'lifetime' }, fixedNow);
      expect(guestDetails.isActive).toBe(false);
      expect(guestDetails.isGuest).toBe(true);
      expect(guestDetails.description).toContain('Guest');
    });

    it('returns structured details for lifetime patrons', () => {
      const details = getPatronStatusDetails({ id: 'usr_reg', patronTier: 'lifetime' }, fixedNow);
      expect(details.isActive).toBe(true);
      expect(details.isLifetime).toBe(true);
      expect(details.isExpired).toBe(false);
      expect(details.description).toContain('Lifetime Patron');
    });

    it('returns structured details for active one-time patrons with remaining days', () => {
      const details = getPatronStatusDetails(
        {
          id: 'usr_reg',
          patronTier: 'one-time',
          patronExpiresAt: '2026-05-25T12:00:00.000Z',
        },
        fixedNow
      );
      expect(details.isActive).toBe(true);
      expect(details.isExpired).toBe(false);
      expect(details.daysRemaining).toBe(10);
      expect(details.formattedExpirationDate).toContain('2026');
      expect(details.description).toContain('10 days left');
    });

    it('returns structured details for expired one-time patrons', () => {
      const details = getPatronStatusDetails(
        {
          id: 'usr_reg',
          patronTier: 'one-time',
          patronExpiresAt: '2026-05-01T12:00:00.000Z',
        },
        fixedNow
      );
      expect(details.isActive).toBe(false);
      expect(details.isExpired).toBe(true);
      expect(details.daysRemaining).toBeNull();
      expect(details.description).toContain('Expired on');
    });

    it('returns structured details for cancelled recurring patrons within grace period', () => {
      const details = getPatronStatusDetails(
        {
          id: 'usr_reg',
          patronTier: 'recurring',
          patronSubscriptionStatus: 'cancelled',
          patronExpiresAt: '2026-05-20T12:00:00.000Z',
        },
        fixedNow
      );
      expect(details.isActive).toBe(true);
      expect(details.isExpired).toBe(false);
      expect(details.daysRemaining).toBe(5);
      expect(details.description).toContain('Recurring (Cancelled)');
    });
  });

  describe('getEstimatedBadgeExpiration', () => {
    it('estimates 1 calendar month for one-time frequency', () => {
      const base = new Date('2026-01-31T00:00:00.000Z');
      const estimate = getEstimatedBadgeExpiration('one-time', base);
      expect(estimate.durationSummary).toBe('1 calendar month');
      expect(estimate.formattedDate).toContain('Feb 28');
    });

    it('indicates ongoing duration for monthly recurring frequency', () => {
      const estimate = getEstimatedBadgeExpiration('monthly');
      expect(estimate.durationSummary).toBe('Ongoing monthly');
      expect(estimate.formattedDate).toBe('Active while subscribed');
    });

    it('indicates permanent duration for lifetime frequency', () => {
      const estimate = getEstimatedBadgeExpiration('lifetime');
      expect(estimate.durationSummary).toBe('Permanent');
      expect(estimate.formattedDate).toBe('Never expires');
    });
  });
});

