import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DigitalClock } from '../DigitalClock';

describe('DigitalClock Component', () => {
  describe('Unlimited games display', () => {
    it('renders infinity symbol when clock is active and isUnlimited is true', () => {
      const html = renderToStaticMarkup(
        React.createElement(DigitalClock, {
          remainingMs: 0,
          isActive: true,
          isUnlimited: true,
        })
      );
      expect(html).toContain('∞');
      expect(html).toContain('active');
    });

    it('renders infinity symbol when clock is inactive and isUnlimited is true', () => {
      const html = renderToStaticMarkup(
        React.createElement(DigitalClock, {
          remainingMs: 0,
          isActive: false,
          isUnlimited: true,
        })
      );
      expect(html).toContain('∞');
      expect(html).not.toContain('active');
    });

    it('both clocks display infinity in an unlimited match regardless of remainingMs values', () => {
      const activePlayerClock = renderToStaticMarkup(
        React.createElement(DigitalClock, {
          remainingMs: 120000,
          isActive: true,
          isUnlimited: true,
        })
      );
      const opponentClock = renderToStaticMarkup(
        React.createElement(DigitalClock, {
          remainingMs: 120000,
          isActive: false,
          isUnlimited: true,
        })
      );

      expect(activePlayerClock).toContain('∞');
      expect(opponentClock).toContain('∞');
    });

    it('falls back to infinity when remainingMs <= 0 and isUnlimited is not specified', () => {
      const html = renderToStaticMarkup(
        React.createElement(DigitalClock, {
          remainingMs: 0,
          isActive: false,
        })
      );
      expect(html).toContain('∞');
    });
  });

  describe('Timed games display', () => {
    it('renders formatted 00:00 and not infinity when time runs out in timed game', () => {
      const html = renderToStaticMarkup(
        React.createElement(DigitalClock, {
          remainingMs: 0,
          isActive: true,
          isUnlimited: false,
        })
      );
      expect(html).toContain('00:00');
      expect(html).not.toContain('∞');
    });

    it('formats standard time values correctly', () => {
      const html = renderToStaticMarkup(
        React.createElement(DigitalClock, {
          remainingMs: 300000, // 5 minutes
          isActive: false,
          isUnlimited: false,
        })
      );
      expect(html).toContain('05:00');
    });

    it('shows tenths of a second when active under 10 seconds', () => {
      const html = renderToStaticMarkup(
        React.createElement(DigitalClock, {
          remainingMs: 9500, // 9.5 seconds
          isActive: true,
          isUnlimited: false,
        })
      );
      expect(html).toContain('00:09.5');
    });

    it('formats correspondence time with days and hours when >= 24 hours', () => {
      // 2 days + 14 hours = 2 * 86,400,000 + 14 * 3,600,000 = 223,200,000 ms
      const html = renderToStaticMarkup(
        React.createElement(DigitalClock, {
          remainingMs: 223200000,
          isActive: false,
          isUnlimited: false,
        })
      );
      expect(html).toContain('2d 14h');
    });

    it('formats correspondence time with hours and minutes when under 24 hours but >= 1 hour', () => {
      // 14 hours + 25 minutes = 14 * 3,600,000 + 25 * 60,000 = 51,900,000 ms
      const html = renderToStaticMarkup(
        React.createElement(DigitalClock, {
          remainingMs: 51900000,
          isActive: false,
          isUnlimited: false,
        })
      );
      expect(html).toContain('14h 25m');
    });

    it('throws DigitalClockConfigError if an invalid custom config is provided', () => {
      expect(() => {
        renderToStaticMarkup(
          React.createElement(DigitalClock, {
            remainingMs: 60000,
            isActive: false,
            config: null as any,
          })
        );
      }).toThrowError('DigitalClockConfigError: Configuration object is missing or null.');
    });
  });
});
