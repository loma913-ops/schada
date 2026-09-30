import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

class StorageMock {
  private store: Record<string, string> = {};

  get length() {
    return Object.keys(this.store).length;
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] || null;
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

if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
}

if (typeof (globalThis as any).document === 'undefined') {
  (globalThis as any).document = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    visibilityState: 'visible',
  };
}

if (typeof (globalThis as any).localStorage === 'undefined') {
  (globalThis as any).localStorage = new StorageMock();
}

class MockAudio {
  static instances: MockAudio[] = [];
  play = vi.fn().mockResolvedValue(undefined);
  load = vi.fn();
  preload = 'auto';
  readyState = 4;
  volume = 1;
  currentTime = 0;
  src: string = '';

  constructor(src?: string) {
    if (src) this.src = src;
    MockAudio.instances.push(this);
  }
}

import { SoundService } from '../soundService';

describe('SoundService', () => {
  let originalAudio: typeof Audio | undefined;
  let originalAudioContext: typeof AudioContext | undefined;

  beforeEach(() => {
    localStorage.clear();
    MockAudio.instances = [];
    originalAudio = globalThis.Audio;
    originalAudioContext = globalThis.AudioContext;
    (globalThis as any).Audio = MockAudio;
    if (globalThis.window) {
      (globalThis.window as any).Audio = MockAudio;
    }
  });

  afterEach(() => {
    if (originalAudio) {
      globalThis.Audio = originalAudio;
      if (globalThis.window) (globalThis.window as any).Audio = originalAudio;
    }
    if (originalAudioContext) {
      globalThis.AudioContext = originalAudioContext;
      if (globalThis.window) (globalThis.window as any).AudioContext = originalAudioContext;
    }
    vi.restoreAllMocks();
  });

  it('initializes in unmuted state by default', () => {
    const service = new SoundService();
    expect(service.getMuted()).toBe(false);
  });

  it('restores muted state from localStorage if previously muted', () => {
    localStorage.setItem('schada_sound_muted', 'true');
    const service = new SoundService();
    expect(service.getMuted()).toBe(true);
  });

  it('toggles mute status and updates localStorage', () => {
    const service = new SoundService();
    expect(service.getMuted()).toBe(false);

    const toggled = service.toggleMute();
    expect(toggled).toBe(true);
    expect(service.getMuted()).toBe(true);
    expect(localStorage.getItem('schada_sound_muted')).toBe('true');

    const untoggled = service.toggleMute();
    expect(untoggled).toBe(false);
    expect(service.getMuted()).toBe(false);
    expect(localStorage.getItem('schada_sound_muted')).toBe('false');
  });

  it('does not play sounds when muted', () => {
    const service = new SoundService();
    service.toggleMute(); // mute

    service.playMove();
    service.playCapture();
    service.playGoal();
    service.playVictory();
    service.playClockTick();

    const anyPlayed = MockAudio.instances.some((inst) => inst.play.mock.calls.length > 0);
    expect(anyPlayed).toBe(false);
  });

  it('plays fallback audio from pool when Web Audio API is unavailable', () => {
    // Simulate environment without AudioContext
    delete (globalThis as any).AudioContext;
    if (globalThis.window) {
      delete (globalThis.window as any).AudioContext;
      delete (globalThis.window as any).webkitAudioContext;
    }

    const service = new SoundService();
    service.playMove();

    const playedInstance = MockAudio.instances.find((inst) => inst.play.mock.calls.length > 0);
    expect(playedInstance).toBeDefined();
  });

  it('handles AudioContext when running', () => {
    const mockStart = vi.fn();
    const mockConnect = vi.fn();
    const mockCreateGain = vi.fn().mockReturnValue({
      gain: {
        value: 1,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
      connect: mockConnect,
      disconnect: vi.fn(),
    });
    const mockCreateOscillator = vi.fn().mockReturnValue({
      type: 'sine',
      frequency: { setValueAtTime: vi.fn() },
      connect: mockConnect,
      start: mockStart,
      stop: vi.fn(),
      disconnect: vi.fn(),
      onended: null,
    });

    class MockContext {
      state = 'running';
      createGain = mockCreateGain;
      createOscillator = mockCreateOscillator;
      decodeAudioData = vi.fn().mockResolvedValue({} as AudioBuffer);
      destination = {};
      resume = vi.fn().mockResolvedValue(undefined);
      currentTime = 10;
    }

    (globalThis as any).AudioContext = MockContext;
    if (globalThis.window) {
      (globalThis.window as any).AudioContext = MockContext;
    }

    const service = new SoundService();
    service.playGoal();
    expect(mockCreateOscillator).toHaveBeenCalled();
    expect(mockStart).toHaveBeenCalled();
  });

  it('uses synthetic move and capture sounds when audio buffers are not yet loaded', () => {
    const mockStart = vi.fn();
    const mockConnect = vi.fn();
    const mockCreateGain = vi.fn().mockReturnValue({
      gain: {
        value: 1,
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
      connect: mockConnect,
      disconnect: vi.fn(),
    });
    const mockCreateOscillator = vi.fn().mockReturnValue({
      type: 'triangle',
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: mockConnect,
      start: mockStart,
      stop: vi.fn(),
      disconnect: vi.fn(),
      onended: null,
    });

    class MockContext {
      state = 'running';
      createGain = mockCreateGain;
      createOscillator = mockCreateOscillator;
      decodeAudioData = vi.fn().mockResolvedValue({} as AudioBuffer);
      destination = {};
      resume = vi.fn().mockResolvedValue(undefined);
      currentTime = 10;
    }

    (globalThis as any).AudioContext = MockContext;
    if (globalThis.window) {
      (globalThis.window as any).AudioContext = MockContext;
    }

    // Simulate environment without HTML5 Audio to force synthesis fallback
    const savedAudio = (globalThis as any).Audio;
    delete (globalThis as any).Audio;

    const service = new SoundService();
    service.playMove();
    expect(mockCreateOscillator).toHaveBeenCalled();
    expect(mockStart).toHaveBeenCalled();

    mockStart.mockClear();
    mockCreateOscillator.mockClear();

    service.playCapture();
    expect(mockCreateOscillator).toHaveBeenCalled();
    expect(mockStart).toHaveBeenCalled();
    
    (globalThis as any).Audio = savedAudio;
  });

  it('immediately plays from HTMLAudioElement pool when AudioContext is suspended on desktop', () => {
    const mockResume = vi.fn().mockResolvedValue(undefined);
    class SuspendedContext {
      state = 'suspended';
      createGain = vi.fn();
      createOscillator = vi.fn();
      decodeAudioData = vi.fn().mockResolvedValue({} as AudioBuffer);
      destination = {};
      resume = mockResume;
      currentTime = 0;
    }

    (globalThis as any).AudioContext = SuspendedContext;
    if (globalThis.window) {
      (globalThis.window as any).AudioContext = SuspendedContext;
    }

    const service = new SoundService();
    service.playMove();

    // Verify background resume was triggered
    expect(mockResume).toHaveBeenCalled();

    // Verify audio element from pool was played immediately
    const playedInstance = MockAudio.instances.find((inst) => inst.play.mock.calls.length > 0);
    expect(playedInstance).toBeDefined();
  });

  it('plays buffer directly without synthesis if moveBuffer is loaded in fallback', () => {
    class RunningContext {
      state = 'running';
      createBufferSource = vi.fn().mockReturnValue({
        connect: vi.fn(),
        start: vi.fn(),
        disconnect: vi.fn(),
        onended: null,
      });
      createOscillator = vi.fn();
      decodeAudioData = vi.fn();
      destination = {};
      resume = vi.fn();
      currentTime = 10;
    }

    (globalThis as any).AudioContext = RunningContext;
    if (globalThis.window) {
      (globalThis.window as any).AudioContext = RunningContext;
    }

    const service = new SoundService();
    (service as any).ensureContext();
    (service as any).moveBuffer = {} as AudioBuffer;

    (service as any).playFallbackAudio('move');
    expect((service as any).ctx.createBufferSource).toHaveBeenCalled();
    expect((service as any).ctx.createOscillator).not.toHaveBeenCalled();
  });

  it('isolates oscillator lifecycles in synthesizeMoveSound to avoid premature cutoff clicks', () => {
    const oscillators: any[] = [];
    const gains: any[] = [];

    class RunningContext {
      state = 'running';
      createGain = vi.fn().mockImplementation(() => {
        const g = {
          gain: { 
            setValueAtTime: vi.fn(), 
            exponentialRampToValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
          disconnect: vi.fn(),
        };
        gains.push(g);
        return g;
      });
      createOscillator = vi.fn().mockImplementation(() => {
        const osc = {
          type: 'triangle',
          frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
          disconnect: vi.fn(),
          onended: null as (() => void) | null,
        };
        oscillators.push(osc);
        return osc;
      });
      decodeAudioData = vi.fn();
      destination = {};
      resume = vi.fn();
      currentTime = 5;
    }

    (globalThis as any).AudioContext = RunningContext;
    if (globalThis.window) {
      (globalThis.window as any).AudioContext = RunningContext;
    }

    const service = new SoundService();
    (service as any).synthesizeMoveSound((service as any).ensureContext());

    expect(oscillators.length).toBe(2);
    expect(gains.length).toBe(2);

    // Triggering osc1.onended must NOT disconnect osc2 or gain2 prematurely
    oscillators[0].onended?.();
    expect(oscillators[0].disconnect).toHaveBeenCalled();
    expect(gains[0].disconnect).toHaveBeenCalled();
    expect(oscillators[1].disconnect).not.toHaveBeenCalled();
    expect(gains[1].disconnect).not.toHaveBeenCalled();

    // Triggering osc2.onended disconnects osc2 and gain2
    oscillators[1].onended?.();
    expect(oscillators[1].disconnect).toHaveBeenCalled();
    expect(gains[1].disconnect).toHaveBeenCalled();
  });
});

