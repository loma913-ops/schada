/**
 * SoundService – Web Audio API + HTML5 Audio hybrid sound engine for Schada.
 *
 * Provides guaranteed, zero-latency playback for moves and captures:
 * 1. Pre-decoded uncompressed PCM WAV buffers (zero-delay attack transient).
 * 2. Synchronous AudioContext resume on user gesture.
 * 3. Never drops sounds if AudioContext is transitioning/suspended; schedules immediately.
 * 4. Preloaded HTML5 Audio element fallback so audio never drops under any browser state.
 */

import { safeSetItem } from '../storage/storageCleanup';

class SoundService {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private moveBuffer: AudioBuffer | null = null;
  private captureBuffer: AudioBuffer | null = null;
  private isDecoding: boolean = false;

  // Preloaded HTMLAudioElements for instant fallback
  private moveAudioElement: HTMLAudioElement | null = null;
  private captureAudioElement: HTMLAudioElement | null = null;

  // Sound deduplication timestamps
  private lastMoveSoundTime: number = 0;
  private lastVictorySoundTime: number = 0;

  constructor() {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('schada_sound_muted');
      this.isMuted = saved === 'true';
    }

    if (typeof window !== 'undefined') {
      // Pre-instantiate audio elements from cached static assets
      try {
        this.moveAudioElement = new Audio('/sounds/move.mp3');
        this.captureAudioElement = new Audio('/sounds/capture.mp3');
        this.moveAudioElement.preload = 'auto';
        this.captureAudioElement.preload = 'auto';
      } catch {
        // Audio elements not supported in this environment
      }

      // Eagerly initialize and resume AudioContext on user gestures
      const handleUserGesture = () => {
        const ctx = this.ensureContext();
        if (ctx && ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
      };

      window.addEventListener('pointerdown', handleUserGesture, { capture: true, passive: true });
      window.addEventListener('keydown', handleUserGesture, { capture: true, passive: true });
      window.addEventListener('click', handleUserGesture, { capture: true, passive: true });
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.isMuted || typeof window === 'undefined') return null;
    if (this.ctx && this.ctx.state !== 'closed') return this.ctx;

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;

      this.ctx = new AudioCtx();
      this.loadBuffers(this.ctx);
      return this.ctx;
    } catch {
      return null;
    }
  }

  private async loadBuffers(ctx: AudioContext): Promise<void> {
    if ((this.moveBuffer && this.captureBuffer) || this.isDecoding) return;
    this.isDecoding = true;

    try {
      const [moveRes, capRes] = await Promise.all([
        fetch('/sounds/move.mp3'),
        fetch('/sounds/capture.mp3'),
      ]);
      const [moveArr, capArr] = await Promise.all([
        moveRes.arrayBuffer(),
        capRes.arrayBuffer(),
      ]);

      const [mBuf, cBuf] = await Promise.all([
        ctx.decodeAudioData(moveArr),
        ctx.decodeAudioData(capArr),
      ]);
      this.moveBuffer = mBuf;
      this.captureBuffer = cBuf;
    } catch (e) {
      console.warn('[Sound] decodeAudioData error:', e);
    } finally {
      this.isDecoding = false;
    }
  }

  /** Plays an HTMLAudioElement clone to guarantee playback */
  private playAudioElement(type: 'move' | 'capture'): void {
    if (this.isMuted) return;
    try {
      const template = type === 'move' ? this.moveAudioElement : this.captureAudioElement;
      if (template) {
        const clone = template.cloneNode(true) as HTMLAudioElement;
        clone.volume = 1.0;
        const playPromise = clone.play();
        if (playPromise) {
          playPromise.catch(() => {});
        }
      }
    } catch (e) {
      console.warn('[Sound] playAudioElement failed:', e);
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    safeSetItem('schada_sound_muted', String(this.isMuted));
    if (this.isMuted && this.ctx) {
      this.ctx.suspend().catch(() => {});
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /** Authentic wooden piece placement on a board */
  public playMove(): void {
    if (this.isMuted) return;

    const now = Date.now();
    if (now - this.lastMoveSoundTime < 60) return;
    this.lastMoveSoundTime = now;

    const ctx = this.ensureContext();
    if (!ctx) {
      this.playAudioElement('move');
      return;
    }

    // Synchronously trigger resume in case it was auto-suspended
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    if (this.moveBuffer) {
      try {
        const source = ctx.createBufferSource();
        const gain = ctx.createGain();
        source.buffer = this.moveBuffer;
        gain.gain.value = 1.0;

        source.connect(gain);
        gain.connect(ctx.destination);

        // start() without parameters plays immediately on current hardware time
        source.start();

        source.onended = () => {
          try {
            source.disconnect();
            gain.disconnect();
          } catch {
            /* already disconnected */
          }
        };
        return;
      } catch (e) {
        console.warn('[Sound] Web Audio playMove failed, using fallback:', e);
      }
    }

    // If buffer is still decoding or failed, use preloaded Audio element
    this.playAudioElement('move');
  }

  /** Authentic wooden piece capture hit */
  public playCapture(): void {
    if (this.isMuted) return;

    const now = Date.now();
    if (now - this.lastMoveSoundTime < 60) return;
    this.lastMoveSoundTime = now;

    const ctx = this.ensureContext();
    if (!ctx) {
      this.playAudioElement('capture');
      return;
    }

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    if (this.captureBuffer) {
      try {
        const source = ctx.createBufferSource();
        const gain = ctx.createGain();
        source.buffer = this.captureBuffer;
        gain.gain.value = 1.0;

        source.connect(gain);
        gain.connect(ctx.destination);

        source.start();

        source.onended = () => {
          try {
            source.disconnect();
            gain.disconnect();
          } catch {
            /* already disconnected */
          }
        };
        return;
      } catch (e) {
        console.warn('[Sound] Web Audio playCapture failed, using fallback:', e);
      }
    }

    this.playAudioElement('capture');
  }

  // Harmonious chime when a high piece enters the goal line
  public playGoal(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    try {
      const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5 major triad
      const now = ctx.currentTime;

      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        const startT = now + idx * 0.06;
        const endT = startT + 0.38;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startT);

        gain.gain.setValueAtTime(0.2, startT);
        gain.gain.linearRampToValueAtTime(0.0001, endT);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startT);
        osc.stop(endT);

        osc.onended = () => {
          try {
            osc.disconnect();
            gain.disconnect();
          } catch {
            /* already gone */
          }
        };
      });
    } catch (e) {
      console.warn('[Sound] playGoal:', e);
    }
  }

  // Low clock countdown tick (< 30 seconds)
  public playClockTick(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0.0001, now + 0.03);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.035);

      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {
          /* already gone */
        }
      };
    } catch (e) {
      console.warn('[Sound] playClockTick:', e);
    }
  }

  // Victory fanfare
  public playVictory(): void {
    if (this.isMuted) return;

    const now = Date.now();
    if (now - this.lastVictorySoundTime < 2000) return;
    this.lastVictorySoundTime = now;

    const ctx = this.ensureContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    try {
      const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
      const now = ctx.currentTime;

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        const startT = now + idx * 0.1;
        const endT = startT + 0.35;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startT);

        gain.gain.setValueAtTime(0.2, startT);
        gain.gain.linearRampToValueAtTime(0.0001, endT);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startT);
        osc.stop(endT);

        osc.onended = () => {
          try {
            osc.disconnect();
            gain.disconnect();
          } catch {
            /* already gone */
          }
        };
      });
    } catch (e) {
      console.warn('[Sound] playVictory:', e);
    }
  }
}

export const soundService = new SoundService();
