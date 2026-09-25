/**
 * Mobile Haptics Service
 * Invokes navigator.vibrate when supported on mobile devices.
 */
class HapticsService {
  private isSupported(): boolean {
    return typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator;
  }

  /** Subtle vibration for piece selection */
  selectPiece(): void {
    if (this.isSupported()) {
      try {
        navigator.vibrate(12);
      } catch {
        // Ignore devices that disallow vibration
      }
    }
  }

  /** Soft vibration for piece movement */
  movePiece(): void {
    if (this.isSupported()) {
      try {
        navigator.vibrate(20);
      } catch {
        // Ignore
      }
    }
  }

  /** Distinct double-tap vibration for captures */
  capturePiece(): void {
    if (this.isSupported()) {
      try {
        navigator.vibrate([25, 40, 30]);
      } catch {
        // Ignore
      }
    }
  }

  /** Celebratory vibration pattern for win/game over */
  gameOver(): void {
    if (this.isSupported()) {
      try {
        navigator.vibrate([40, 50, 40, 50, 80]);
      } catch {
        // Ignore
      }
    }
  }
}

export const haptics = new HapticsService();
