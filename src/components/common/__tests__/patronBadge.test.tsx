import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

class StorageMock {
  private store: Record<string, string> = {};

  getItem(key: string) {
    return this.store[key] ?? null;
  }

  setItem(key: string, val: string) {
    this.store[key] = String(val);
  }

  removeItem(key: string) {
    delete this.store[key];
  }

  clear() {
    this.store = {};
  }
}

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new StorageMock(),
    writable: true,
  });
}

import { PatronBadge, isPatronUser } from '../PatronBadge';

describe('PatronBadge Component', () => {
  it('renders star badge with default accessibility labels and class', () => {
    const html = renderToStaticMarkup(<PatronBadge />);
    expect(html).toContain('class="patron-star-badge"');
    expect(html).toContain('title="Schada Patron"');
    expect(html).toContain('aria-label="Schada Patron"');
    expect(html).toContain('width="13"');
    expect(html).toContain('height="13"');
  });

  it('supports custom size, class, and custom title', () => {
    const html = renderToStaticMarkup(
      <PatronBadge size={20} className="custom-test-badge" title="Benefactor Star" />
    );
    expect(html).toContain('class="patron-star-badge custom-test-badge"');
    expect(html).toContain('title="Benefactor Star"');
    expect(html).toContain('width="20"');
    expect(html).toContain('height="20"');
  });
});

describe('isPatronUser Helper', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('returns true when candidate has isPatron flag set to true', () => {
    expect(isPatronUser({ isPatron: true })).toBe(true);
  });

  it('returns true when candidate has hasDonated flag set to true', () => {
    expect(isPatronUser({ hasDonated: true })).toBe(true);
  });

  it('returns true when candidate has fromUserIsPatron flag set to true', () => {
    expect(isPatronUser({ fromUserIsPatron: true })).toBe(true);
  });

  it('returns false when candidate has both flags false or undefined', () => {
    expect(isPatronUser({ isPatron: false, hasDonated: false })).toBe(false);
    expect(isPatronUser({})).toBe(false);
    expect(isPatronUser(null)).toBe(false);
    expect(isPatronUser(undefined)).toBe(false);
  });

  it('never displays badge for guests even if marked with patron properties', () => {
    expect(isPatronUser({ id: 'guest', isPatron: true })).toBe(false);
    expect(isPatronUser({ id: 'guest_12345', isPatron: true, hasDonated: true })).toBe(false);
    expect(isPatronUser(null)).toBe(false);
  });

  it('displays badge for valid registered users with active unexpired status', () => {
    expect(isPatronUser({ id: 'usr_valid', patronTier: 'lifetime' })).toBe(true);
    expect(isPatronUser({ id: 'usr_valid', isPatron: true })).toBe(true);
  });
});
