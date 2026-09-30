import { HAPTICS_CONFIG } from './hapticsConfig';

/**
 * Mobile Haptics Service.
 * Invokes navigator.vibrate when supported on mobile devices.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time, dispatched asynchronously to hardware vibration motor.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space with zero heap allocations.
 *
 * Growth Rate:
 * - O(1) constant, perfectly stable across arbitrary game duration.
 */
class HapticsService {
  private isSupported(): boolean {
    return typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator;
  }

  /** Subtle vibration for piece selection (O(1) time & space) */
  selectPiece(): void {
    if (this.isSupported()) {
      try {
        navigator.vibrate(HAPTICS_CONFIG.selectPieceMs);
      } catch {
        // Ignore devices that disallow vibration
      }
    }
  }

  /** Soft vibration for piece movement (O(1) time & space) */
  movePiece(): void {
    if (this.isSupported()) {
      try {
        navigator.vibrate(HAPTICS_CONFIG.movePieceMs);
      } catch {
        // Ignore
      }
    }
  }

  /** Distinct double-tap vibration for captures (O(1) time & space) */
  capturePiece(): void {
    if (this.isSupported()) {
      try {
        navigator.vibrate(HAPTICS_CONFIG.capturePiecePattern as unknown as number[]);
      } catch {
        // Ignore
      }
    }
  }

  /** Celebratory vibration pattern for win/game over (O(1) time & space) */
  gameOver(): void {
    if (this.isSupported()) {
      try {
        navigator.vibrate(HAPTICS_CONFIG.gameOverPattern as unknown as number[]);
      } catch {
        // Ignore
      }
    }
  }
}

export const haptics = new HapticsService();
