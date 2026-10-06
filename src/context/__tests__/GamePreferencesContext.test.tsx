import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  GamePreferencesProvider,
  useGamePreferences,
} from '../GamePreferencesContext';
import { GAME_PREFERENCES_CONFIG } from '@/services/preferences/gamePreferencesConfig';

class StorageMock {
  private store: Record<string, string> = {};

  get length() {
    return Object.keys(this.store).length;
  }

  key(index: number): string | null {
    return Object.keys(this.store)[index] || null;
  }

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
  (globalThis as any).localStorage = new StorageMock();
}

describe('GamePreferencesContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders children and provides default preferences', () => {
    let capturedState: boolean | undefined;

    function TestComponent() {
      const { showThreatIndicators } = useGamePreferences();
      capturedState = showThreatIndicators;
      return <div data-testid="threat">{String(showThreatIndicators)}</div>;
    }

    const html = renderToString(
      <GamePreferencesProvider>
        <TestComponent />
      </GamePreferencesProvider>
    );

    expect(html).toContain('true');
    expect(capturedState).toBe(GAME_PREFERENCES_CONFIG.defaults.showThreatIndicators);
  });

  it('throws meaningful error when used outside provider', () => {
    function TestComponentOutside() {
      useGamePreferences();
      return null;
    }

    expect(() => renderToString(<TestComponentOutside />)).toThrow(
      'useGamePreferences must be used within a GamePreferencesProvider'
    );
  });
});
