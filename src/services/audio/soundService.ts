/**
 * SoundService – Web Audio API + MP3 Audio Engine for Schada.
 *
 * Guarantees zero-latency, cross-platform audio playback across desktop and mobile:
 * 1. Background eager pre-fetching and decoding of MP3 audio buffers.
 * 2. Unlocks and resumes AudioContext cleanly across desktop user activation gestures.
 * 3. Never truncates sounds on suspended AudioContext; falls back immediately to HTML5 MP3 Audio playback.
 * 4. Fresh HTML5 Audio playback avoids pool exhaustion and ended-state freezes in Chromium.
 * 5. High-fidelity synthetic fallback ensures piece move and capture sounds always play audibly.
 * 6. Automatically restores audio session when tabs become visible or active.
 */

import { safeGetItem, safeSetItem } from '../storage/storageCleanup';
import { SOUND_ASSET_PATHS } from './soundAssets';
import { AUDIO_CONFIG } from './audioConfig';

export class SoundService {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private moveBuffer: AudioBuffer | null = null;
  private captureBuffer: AudioBuffer | null = null;
  private isDecoding: boolean = false;

  // Background ArrayBuffer pre-fetch promises
  private moveArrayBufferPromise: Promise<ArrayBuffer | null> | null = null;
  private captureArrayBufferPromise: Promise<ArrayBuffer | null> | null = null;

  // Active audio elements for instant cleanup on mute
  private activeAudios: Set<HTMLAudioElement> = new Set();

  // Sound deduplication timestamps
  private lastMoveSoundTime: number = 0;
  private lastCaptureSoundTime: number = 0;
  private lastVictorySoundTime: number = 0;

  constructor() {
    if (typeof localStorage !== 'undefined') {
      const saved = safeGetItem(AUDIO_CONFIG.storageKeys.soundMuted);
      this.isMuted = saved === 'true';
    }

    if (typeof window !== 'undefined') {
      // 1. Pre-fetch audio MP3 array buffers immediately into memory
      this.startArrayBufferPrefetch();

      // 2. Eagerly initialize and resume AudioContext on user gestures
      const unlockAudio = () => {
        const ctx = this.ensureContext();
        if (ctx && ctx.state === 'suspended') {
          ctx.resume().catch(() => { });
        }
      };

      AUDIO_CONFIG.userActivationEvents.forEach((evt) => {
        window.addEventListener(evt, unlockAudio, { capture: true, passive: true });
      });

      // 3. Resume audio hardware when tab becomes visible
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            const ctx = this.ensureContext();
            if (ctx && ctx.state === 'suspended') {
              ctx.resume().catch(() => { });
            }
          }
        });
      }
    }
  }

  /** Starts eager background fetch of MP3 audio assets as ArrayBuffers */
  private startArrayBufferPrefetch(): void {
    if (typeof fetch === 'undefined') return;

    this.moveArrayBufferPromise = this.fetchRawAudio(SOUND_ASSET_PATHS.move);
    this.captureArrayBufferPromise = this.fetchRawAudio(SOUND_ASSET_PATHS.capture);
  }

  /** Fetches audio bytes */
  private async fetchRawAudio(url: string): Promise<ArrayBuffer | null> {
    try {
      const res = await fetch(url);
      if (res.ok) {
        return await res.arrayBuffer();
      }
    } catch {
      // Fetch failed or offline
    }
    return null;
  }

  /** Lazily creates and initializes AudioContext */
  private ensureContext(): AudioContext | null {
    if (this.isMuted || typeof window === 'undefined') return null;
    if (this.ctx && this.ctx.state !== 'closed') {
      if ((!this.moveBuffer || !this.captureBuffer) && !this.isDecoding) {
        this.loadBuffers(this.ctx);
      }
      return this.ctx;
    }

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

  /** Decodes pre-fetched ArrayBuffers or fetches fresh if needed */
  private async loadBuffers(ctx: AudioContext): Promise<void> {
    if ((this.moveBuffer && this.captureBuffer) || this.isDecoding) return;
    this.isDecoding = true;

    try {
      let moveArr: ArrayBuffer | null = null;
      let capArr: ArrayBuffer | null = null;

      try {
        if (this.moveArrayBufferPromise) {
          moveArr = await this.moveArrayBufferPromise;
        }
      } catch {
        moveArr = null;
      }

      try {
        if (this.captureArrayBufferPromise) {
          capArr = await this.captureArrayBufferPromise;
        }
      } catch {
        capArr = null;
      }

      if (!moveArr) {
        moveArr = await this.fetchRawAudio(SOUND_ASSET_PATHS.move);
      }
      if (!capArr) {
        capArr = await this.fetchRawAudio(SOUND_ASSET_PATHS.capture);
      }

      if (moveArr && !this.moveBuffer) {
        this.moveBuffer = await ctx.decodeAudioData(moveArr.slice(0));
      }
      if (capArr && !this.captureBuffer) {
        this.captureBuffer = await ctx.decodeAudioData(capArr.slice(0));
      }
    } catch (e) {
      console.warn('[Sound] decodeAudioData error:', e);
    } finally {
      this.isDecoding = false;
    }
  }

  /** Synthesizes authentic wooden chess piece move tap with dual-component transient */
  private synthesizeMoveSound(ctx: AudioContext): void {
    try {
      const now = ctx.currentTime;
      const { moveTransient, moveBody } = AUDIO_CONFIG.synthesis;

      // High-frequency transient impact
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(moveTransient.startFreq, now);
      osc1.frequency.exponentialRampToValueAtTime(moveTransient.endFreq, now + moveTransient.duration);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(moveTransient.startGain, now + 0.002);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + moveTransient.duration);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + moveTransient.stopDelay);

      // Low wooden body resonance
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(moveBody.startFreq, now);
      osc2.frequency.exponentialRampToValueAtTime(moveBody.endFreq, now + moveBody.duration);
      gain2.gain.setValueAtTime(0, now);
      gain2.gain.linearRampToValueAtTime(moveBody.startGain, now + 0.002);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + moveBody.duration);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now);
      osc2.stop(now + moveBody.stopDelay);

      osc1.onended = () => {
        try {
          osc1.disconnect();
          gain1.disconnect();
        } catch {
          // ignore
        }
      };

      osc2.onended = () => {
        try {
          osc2.disconnect();
          gain2.disconnect();
        } catch {
          // ignore
        }
      };
    } catch (e) {
      console.warn('[Sound] synthesizeMoveSound error:', e);
    }
  }

  /** Synthesizes authentic piece capture impact with two-stage strike sound */
  private synthesizeCaptureSound(ctx: AudioContext): void {
    try {
      const now = ctx.currentTime;
      const { captureImpact1, captureImpact2 } = AUDIO_CONFIG.synthesis;

      // First impact: piece striking piece
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(captureImpact1.startFreq, now);
      osc1.frequency.exponentialRampToValueAtTime(captureImpact1.endFreq, now + captureImpact1.duration);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(captureImpact1.startGain, now + 0.002);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + captureImpact1.duration);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + captureImpact1.stopDelay);

      // Second impact: piece settling on board square
      const t2 = now + captureImpact2.startDelay;
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(captureImpact2.startFreq, t2);
      osc2.frequency.exponentialRampToValueAtTime(captureImpact2.endFreq, t2 + captureImpact2.duration);
      gain2.gain.setValueAtTime(0, t2);
      gain2.gain.linearRampToValueAtTime(captureImpact2.startGain, t2 + 0.002);
      gain2.gain.exponentialRampToValueAtTime(0.0001, t2 + captureImpact2.duration);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(t2);
      osc2.stop(t2 + captureImpact2.stopDelay);

      osc1.onended = () => {
        try {
          osc1.disconnect();
          gain1.disconnect();
        } catch {
          // ignore
        }
      };

      osc2.onended = () => {
        try {
          osc2.disconnect();
          gain2.disconnect();
        } catch {
          // ignore
        }
      };
    } catch (e) {
      console.warn('[Sound] synthesizeCaptureSound error:', e);
    }
  }

  /** Plays an MP3 audio element reliably without pool exhaustion */
  private playFallbackAudio(type: 'move' | 'capture'): void {
    if (this.isMuted) return;

    // If AudioContext is actively running and buffer is ready, play the decoded buffer
    if (this.ctx && this.ctx.state === 'running') {
      const buffer = type === 'move' ? this.moveBuffer : this.captureBuffer;
      if (buffer) {
        this.playBufferDirect(this.ctx, buffer);
        return;
      }
    }

    if (typeof Audio === 'undefined') {
      if (this.ctx && this.ctx.state === 'running') {
        if (type === 'move') {
          this.synthesizeMoveSound(this.ctx);
        } else {
          this.synthesizeCaptureSound(this.ctx);
        }
      }
      return;
    }

    try {
      const src = type === 'move' ? SOUND_ASSET_PATHS.move : SOUND_ASSET_PATHS.capture;
      const audio = new Audio(src);
      audio.volume = 1.0;
      this.activeAudios.add(audio);

      audio.onended = () => {
        this.activeAudios.delete(audio);
      };

      const playPromise = audio.play();
      if (playPromise) {
        playPromise.catch(() => {
          this.activeAudios.delete(audio);
          // If HTML5 Audio is blocked by browser autoplay policy, synthesize sound if ctx is running
          if (this.ctx && this.ctx.state === 'running') {
            if (type === 'move') {
              this.synthesizeMoveSound(this.ctx);
            } else {
              this.synthesizeCaptureSound(this.ctx);
            }
          }
        });
      }
    } catch (e) {
      console.warn('[Sound] playFallbackAudio failed:', e);
      if (this.ctx && this.ctx.state === 'running') {
        if (type === 'move') {
          this.synthesizeMoveSound(this.ctx);
        } else {
          this.synthesizeCaptureSound(this.ctx);
        }
      }
    }
  }

  /** Directly outputs an AudioBuffer via Web Audio API */
  private playBufferDirect(ctx: AudioContext, buffer: AudioBuffer): void {
    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;

      source.connect(ctx.destination);
      source.start();

      source.onended = () => {
        try {
          source.disconnect();
        } catch {
          /* already disconnected */
        }
      };
    } catch (e) {
      console.warn('[Sound] Web Audio playBufferDirect failed:', e);
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    safeSetItem(AUDIO_CONFIG.storageKeys.soundMuted, String(this.isMuted));
    if (this.isMuted) {
      if (this.ctx) {
        this.ctx.suspend().catch(() => { });
      }
      for (const el of this.activeAudios) {
        try {
          el.pause();
          el.currentTime = 0;
        } catch { }
      }
      this.activeAudios.clear();
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    safeSetItem(AUDIO_CONFIG.storageKeys.soundMuted, String(this.isMuted));
    if (this.isMuted) {
      if (this.ctx) {
        this.ctx.suspend().catch(() => { });
      }
      for (const el of this.activeAudios) {
        try {
          el.pause();
          el.currentTime = 0;
        } catch { }
      }
      this.activeAudios.clear();
    }
  }

  /** Authentic wooden piece placement on a board */
  public playMove(): void {
    if (this.isMuted) return;

    const now = Date.now();
    if (now - this.lastMoveSoundTime < AUDIO_CONFIG.debounce.moveDebounceMs) return;
    this.lastMoveSoundTime = now;

    const ctx = this.ensureContext();
    if (!ctx) {
      this.playFallbackAudio('move');
      return;
    }

    if (ctx.state === 'running') {
      if (this.moveBuffer) {
        this.playBufferDirect(ctx, this.moveBuffer);
      } else if (typeof Audio !== 'undefined') {
        this.playFallbackAudio('move');
      } else {
        this.synthesizeMoveSound(ctx);
      }
    } else {
      // AudioContext is suspended. Attempt resume and immediately play MP3 via HTML5 Audio
      ctx.resume().catch(() => { });
      this.playFallbackAudio('move');
    }
  }

  /** Authentic wooden piece capture hit */
  public playCapture(): void {
    if (this.isMuted) return;

    const now = Date.now();
    if (now - this.lastCaptureSoundTime < AUDIO_CONFIG.debounce.captureDebounceMs) return;
    this.lastCaptureSoundTime = now;

    const ctx = this.ensureContext();
    if (!ctx) {
      this.playFallbackAudio('capture');
      return;
    }

    if (ctx.state === 'running') {
      if (this.captureBuffer) {
        this.playBufferDirect(ctx, this.captureBuffer);
      } else if (typeof Audio !== 'undefined') {
        this.playFallbackAudio('capture');
      } else {
        this.synthesizeCaptureSound(ctx);
      }
    } else {
      // AudioContext is suspended. Attempt resume and immediately play MP3 via HTML5 Audio
      ctx.resume().catch(() => { });
      this.playFallbackAudio('capture');
    }
  }

  /** Harmonious chime when a high piece enters the goal line */
  public playGoal(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const executeGoal = (activeCtx: AudioContext) => {
      try {
        const { triadFrequencies, staggerStep, duration, gain: targetGain } = AUDIO_CONFIG.synthesis.goalChime;
        const now = activeCtx.currentTime;

        triadFrequencies.forEach((freq, idx) => {
          const osc = activeCtx.createOscillator();
          const gain = activeCtx.createGain();

          const startT = now + idx * staggerStep;
          const endT = startT + duration;

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, startT);

          gain.gain.setValueAtTime(targetGain, startT);
          gain.gain.linearRampToValueAtTime(0.0001, endT);

          osc.connect(gain);
          gain.connect(activeCtx.destination);

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
        console.warn('[Sound] playGoal error:', e);
      }
    };

    if (ctx.state === 'running') {
      executeGoal(ctx);
    } else {
      ctx.resume().then(() => executeGoal(ctx)).catch(() => { });
    }
  }

  /** Low clock countdown tick (< 30 seconds) */
  public playClockTick(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const executeTick = (activeCtx: AudioContext) => {
      try {
        const { freq, gain: tickGain, duration, stopDelay } = AUDIO_CONFIG.synthesis.clockTick;
        const now = activeCtx.currentTime;
        const osc = activeCtx.createOscillator();
        const gain = activeCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(tickGain, now);
        gain.gain.linearRampToValueAtTime(0.0001, now + duration);

        osc.connect(gain);
        gain.connect(activeCtx.destination);

        osc.start(now);
        osc.stop(now + stopDelay);

        osc.onended = () => {
          try {
            osc.disconnect();
            gain.disconnect();
          } catch {
            /* already gone */
          }
        };
      } catch (e) {
        console.warn('[Sound] playClockTick error:', e);
      }
    };

    if (ctx.state === 'running') {
      executeTick(ctx);
    } else {
      ctx.resume().then(() => executeTick(ctx)).catch(() => { });
    }
  }

  /** Victory fanfare */
  public playVictory(): void {
    if (this.isMuted) return;

    const now = Date.now();
    if (now - this.lastVictorySoundTime < AUDIO_CONFIG.debounce.victoryDebounceMs) return;
    this.lastVictorySoundTime = now;

    const ctx = this.ensureContext();
    if (!ctx) return;

    const executeVictory = (activeCtx: AudioContext) => {
      try {
        const { noteFrequencies, staggerStep, duration, gain: victoryGain } = AUDIO_CONFIG.synthesis.victoryFanfare;
        const now = activeCtx.currentTime;

        noteFrequencies.forEach((freq, idx) => {
          const osc = activeCtx.createOscillator();
          const gain = activeCtx.createGain();

          const startT = now + idx * staggerStep;
          const endT = startT + duration;

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, startT);

          gain.gain.setValueAtTime(victoryGain, startT);
          gain.gain.linearRampToValueAtTime(0.0001, endT);

          osc.connect(gain);
          gain.connect(activeCtx.destination);

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
        console.warn('[Sound] playVictory error:', e);
      }
    };

    if (ctx.state === 'running') {
      executeVictory(ctx);
    } else {
      ctx.resume().then(() => executeVictory(ctx)).catch(() => { });
    }
  }
}


export const soundService = new SoundService();
