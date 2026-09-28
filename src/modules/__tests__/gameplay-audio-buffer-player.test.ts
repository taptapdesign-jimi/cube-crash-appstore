import {
  releaseIdleDecodedGameplayAudio,
  resolveDecodedGameplayAudioBudgetBytes,
  fadeOutDecodedGameplayVoice,
  getDecodedGameplayAudioStats,
  getDecodedGameplaySoundsState,
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  resetDecodedGameplayAudioForTests,
  setDecodedGameplayVoiceVolume,
  stopAllDecodedGameplayVoices,
  stopDecodedGameplayVoice,
} from '../gameplay-audio-buffer-player';

class MockAudioParam {
  value = 1;
  setValueAtTime = jest.fn((value: number) => { this.value = value; });
  cancelScheduledValues = jest.fn();
  linearRampToValueAtTime = jest.fn((value: number) => { this.value = value; });
}

class MockBufferSource {
  buffer: AudioBuffer | null = null;
  playbackRate = new MockAudioParam();
  loop = false;
  onended: (() => void) | null = null;
  connect = jest.fn();
  disconnect = jest.fn();
  start = jest.fn();
  stop = jest.fn();
}

class MockGainNode {
  gain = new MockAudioParam();
  connect = jest.fn();
  disconnect = jest.fn();
}

class MockAudioContext {
  static instances: MockAudioContext[] = [];
  state: AudioContextState = 'running';
  currentTime = 10;
  destination = {} as AudioDestinationNode;
  sources: MockBufferSource[] = [];
  gains: MockGainNode[] = [];
  resume = jest.fn(() => Promise.resolve());
  suspend = jest.fn(async () => { this.state = 'suspended' as AudioContextState; });
  close = jest.fn(() => Promise.resolve());
  decodeAudioData = jest.fn(async () => ({ duration: 2, length: 96000, numberOfChannels: 2 } as AudioBuffer));

  constructor() {
    MockAudioContext.instances.push(this);
  }

  createBufferSource(): AudioBufferSourceNode {
    const source = new MockBufferSource();
    this.sources.push(source);
    return source as unknown as AudioBufferSourceNode;
  }

  createGain(): GainNode {
    const gain = new MockGainNode();
    this.gains.push(gain);
    return gain as unknown as GainNode;
  }
}

describe('decoded gameplay audio owner', () => {
  const originalAudioContext = window.AudioContext;
  const originalFetch = global.fetch;
  const originalHidden = Object.getOwnPropertyDescriptor(document, 'hidden');

  beforeEach(() => {
    resetDecodedGameplayAudioForTests();
    MockAudioContext.instances = [];
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: MockAudioContext,
    });
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => new ArrayBuffer(16),
    })) as jest.Mock;
  });

  afterEach(() => {
    resetDecodedGameplayAudioForTests();
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: originalAudioContext,
    });
    global.fetch = originalFetch;
    if (originalHidden) Object.defineProperty(document, 'hidden', originalHidden);
    else delete (document as { hidden?: boolean }).hidden;
  });

  it('keeps a lower idle decoded-audio ceiling on mobile runtimes', () => {
    expect(resolveDecodedGameplayAudioBudgetBytes(true)).toBe(32 * 1024 * 1024);
    expect(resolveDecodedGameplayAudioBudgetBytes(false)).toBe(64 * 1024 * 1024);
  });

  it('fetches and decodes each shared source once before gameplay', async () => {
    const source = './assets/sound/merge 6/stack.mp3';
    expect(preloadDecodedGameplaySounds([source, source])).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(MockAudioContext.instances).toHaveLength(1);
    expect(MockAudioContext.instances[0].decodeAudioData).toHaveBeenCalledTimes(1);
    expect(getDecodedGameplaySoundsState([source])).toBe('ready');
    expect(getDecodedGameplayAudioStats()).toMatchObject({
      decodedBuffers: 1,
      pendingBuffers: 0,
      failedBuffers: 0,
      activeVoices: 0,
    });
  });

  it('starts an already-decoded buffer with native playback-rate, gain, and fade scheduling', async () => {
    const source = './assets/sound/merge 6/merge6 crash.mp3';
    preloadDecodedGameplaySounds([source]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(playDecodedGameplaySound(source, {
      voiceId: 'regular-merge6-crash',
      volume: 0.1632,
      playbackRate: 1.3,
      startOffsetSeconds: 0.045,
      stopAfterSeconds: 0.892,
      fadeOutSeconds: 0.12,
    })).toBe('played');

    const context = MockAudioContext.instances[0];
    const sourceNode = context.sources[0];
    const gainNode = context.gains[0];
    expect(sourceNode.playbackRate.setValueAtTime).toHaveBeenCalledWith(1.3, 10);
    expect(sourceNode.start).toHaveBeenCalledWith(10, 0.045);
    expect(sourceNode.stop).toHaveBeenCalledWith(10.892);
    expect(gainNode.gain.setValueAtTime).toHaveBeenNthCalledWith(1, 0.1632, 10);
    expect(gainNode.gain.setValueAtTime).toHaveBeenNthCalledWith(2, 0.1632, 10.772);
    expect(gainNode.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 10.892);
    expect(getDecodedGameplayAudioStats().activeVoices).toBe(1);

    stopDecodedGameplayVoice('regular-merge6-crash');
    expect(sourceNode.stop).toHaveBeenCalledTimes(2);
    expect(getDecodedGameplayAudioStats().activeVoices).toBe(0);
  });

  it('reports retained voice provenance without stopping overdue sources', async () => {
    const source = './diagnostic.wav';
    preloadDecodedGameplaySounds([source]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    playDecodedGameplaySound(source, {
      voiceId: 'diagnostic', volume: 0.4, startDelaySeconds: 1,
      playbackRate: 2, startOffsetSeconds: 0.5,
    });
    const context = MockAudioContext.instances[0];
    expect(getDecodedGameplayAudioStats()).not.toHaveProperty('voiceDetails');
    context.currentTime = 15;
    expect(getDecodedGameplayAudioStats(true).voiceDetails).toEqual([
      expect.objectContaining({ voiceId: 'diagnostic', loop: false,
        startedAtAudioSeconds: 11, expectedEndAudioSeconds: 11.75, overdueSeconds: 3.25 }),
    ]);
    expect(context.sources[0].stop).not.toHaveBeenCalled();
    context.sources[0].onended?.();
    expect(getDecodedGameplayAudioStats(true).voiceDetails).toEqual([]);
    playDecodedGameplaySound(source, { voiceId: 'loop', volume: 0.2, loop: true });
    expect(getDecodedGameplayAudioStats(true).voiceDetails?.[0].expectedEndAudioSeconds).toBeNull();
    fadeOutDecodedGameplayVoice('loop', 2);
    expect(getDecodedGameplayAudioStats(true).voiceDetails?.[0].expectedEndAudioSeconds).toBe(17);
  });

  it('loops and fades a decoded ambient voice through its native gain owner', async () => {
    const source = './assets/sound/worlds/Forest/soft bees ambiance.wav';
    preloadDecodedGameplaySounds([source]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(playDecodedGameplaySound(source, {
      voiceId: 'journey-forest-soft-bees-ambient',
      volume: 0.348,
      loop: true,
    })).toBe('played');

    const context = MockAudioContext.instances[0];
    const sourceNode = context.sources[0];
    const gainNode = context.gains[0];
    expect(sourceNode.loop).toBe(true);
    expect(fadeOutDecodedGameplayVoice('journey-forest-soft-bees-ambient', 1.5)).toBe(true);
    expect(gainNode.gain.cancelScheduledValues).toHaveBeenCalledWith(10);
    expect(gainNode.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 11.5);
    expect(sourceNode.stop).toHaveBeenCalledWith(11.5);
  });

  it('resumes an existing audio context on foreground without replaying active voices', async () => {
    const source = './assets/sound/worlds/crumbleworlds.wav';
    preloadDecodedGameplaySounds([source]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(playDecodedGameplaySound(source, {
      voiceId: 'journey-worlds-hub-loop',
      volume: 0.348,
      loop: true,
    })).toBe('played');

    const context = MockAudioContext.instances[0];
    const activeSource = context.sources[0];
    context.state = 'suspended';
    context.resume.mockImplementation(async () => { context.state = 'running'; });
    window.dispatchEvent(new Event('pageshow'));
    await Promise.resolve();

    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(context.sources).toHaveLength(1);
    expect(activeSource.start).toHaveBeenCalledTimes(1);
    expect(activeSource.stop).not.toHaveBeenCalled();
    expect(getDecodedGameplayAudioStats().activeVoices).toBe(1);
  });

  it('retries an interrupted foreground context at the next eligible gesture', async () => {
    preloadDecodedGameplaySounds(['./assets/sound/worlds/crumbleworlds.wav']);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const context = MockAudioContext.instances[0];
    playDecodedGameplaySound('./assets/sound/worlds/crumbleworlds.wav', {
      voiceId: 'current-loop', volume: 0.4, loop: true,
    });
    context.state = 'suspended';
    context.resume.mockImplementationOnce(async () => {});
    context.resume.mockImplementationOnce(async () => { context.state = 'running'; });

    window.dispatchEvent(new Event('pageshow'));
    await Promise.resolve();
    expect(context.state).toBe('suspended');
    document.dispatchEvent(new Event('pointerup'));
    await Promise.resolve();

    expect(context.resume).toHaveBeenCalledTimes(2);
    expect(context.state).toBe('running');
    expect(context.sources).toHaveLength(1);
  });

  it('uses the native app-active signal when WKWebView omits pageshow', async () => {
    const originalHidden = Object.getOwnPropertyDescriptor(document, 'hidden');
    preloadDecodedGameplaySounds(['./assets/sound/worlds/crumbleworlds.wav']);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const context = MockAudioContext.instances[0];
    playDecodedGameplaySound('./assets/sound/worlds/crumbleworlds.wav', {
      voiceId: 'current-loop', volume: 0.4, loop: true,
    });
    context.state = 'suspended';
    context.resume.mockImplementation(async () => { context.state = 'running'; });

    try {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      window.dispatchEvent(new Event('cc:native-audio-active'));
      await Promise.resolve();
    } finally {
      if (originalHidden) Object.defineProperty(document, 'hidden', originalHidden);
      else delete (document as { hidden?: boolean }).hidden;
    }

    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(context.state).toBe('running');
  });

  it.each(['running', 'suspended'] as const)(
    'retires active and decoding voices when a %s context backgrounds without purging cached buffers',
    async (contextState) => {
      preloadDecodedGameplaySounds(['warm.wav']);
      await new Promise(resolve => setTimeout(resolve, 0));
      const context = MockAudioContext.instances[0];
      const activeStopped = jest.fn();
      const pendingStopped = jest.fn();
      const oldStarted = jest.fn();
      playDecodedGameplaySound('warm.wav', { voiceId: 'loop', volume: 1, loop: true, onStopped: activeStopped });
      let completeDecode!: (buffer: AudioBuffer) => void;
      context.decodeAudioData.mockImplementationOnce(() => new Promise(resolve => { completeDecode = resolve; }));
      playDecodedGameplaySound('cold.wav', { voiceId: 'cold', volume: 1, onStopped: pendingStopped, onStarted: oldStarted });
      await new Promise(resolve => setTimeout(resolve, 0));
      context.state = contextState;
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(activeStopped).toHaveBeenCalledTimes(1);
      expect(pendingStopped).toHaveBeenCalledTimes(1);
      expect(context.sources[0].stop).toHaveBeenCalledTimes(1);
      expect(getDecodedGameplayAudioStats()).toMatchObject({ activeVoices: 0, pendingVoiceStarts: 0, decodedBuffers: 1 });
      expect(context.suspend).toHaveBeenCalledTimes(contextState === 'running' ? 1 : 0);
      completeDecode({ duration: 2, length: 96000, numberOfChannels: 2 } as AudioBuffer);
      await new Promise(resolve => setTimeout(resolve, 0));
      window.dispatchEvent(new Event('cc:native-audio-active'));
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(oldStarted).not.toHaveBeenCalled();
      expect(context.sources).toHaveLength(1);
      expect(context.resume).not.toHaveBeenCalled();
      expect(getDecodedGameplayAudioStats()).toMatchObject({ decodedBuffers: 2, activeVoices: 0, pendingVoiceStarts: 0 });
    },
  );

  it('does not begin a late decode after fetch completes across pagehide', async () => {
    let finishFetch!: (response: unknown) => void;
    global.fetch = jest.fn(() => new Promise(resolve => { finishFetch = resolve; })) as jest.Mock;
    const onStopped = jest.fn();
    playDecodedGameplaySound('cold-fetch.wav', { voiceId: 'old', volume: 1, onStopped });
    const context = MockAudioContext.instances[0];
    window.dispatchEvent(new Event('pagehide'));
    expect(onStopped).toHaveBeenCalledTimes(1);
    finishFetch({ ok: true, arrayBuffer: async () => new ArrayBuffer(16) });
    await new Promise(resolve => setTimeout(resolve, 0));
    window.dispatchEvent(new Event('pageshow'));
    expect(context.decodeAudioData).not.toHaveBeenCalled();
    expect(context.resume).not.toHaveBeenCalled();
    expect(getDecodedGameplayAudioStats()).toMatchObject({ pendingBuffers: 0, pendingVoiceStarts: 0 });
  });

  it('handles new hidden requests silently without constructing audio or requesting fallback', () => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    const onStopped = jest.fn();
    const onDeferredUnavailable = jest.fn();
    expect(preloadDecodedGameplaySounds(['hidden.wav'])).toBe(true);
    expect(getDecodedGameplaySoundsState(['hidden.wav'])).toBe('ready');
    expect(playDecodedGameplaySound('hidden.wav', { voiceId: 'hidden', volume: 1, onStopped, onDeferredUnavailable })).toBe('played');
    expect(onStopped).toHaveBeenCalledTimes(1);
    expect(onDeferredUnavailable).not.toHaveBeenCalled();
    expect(MockAudioContext.instances).toHaveLength(0);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('allows only a fresh owner after native activation arrives before the visibility update', async () => {
    preloadDecodedGameplaySounds(['warm.wav']);
    await new Promise(resolve => setTimeout(resolve, 0));
    const context = MockAudioContext.instances[0];
    playDecodedGameplaySound('warm.wav', { voiceId: 'old', volume: 1 });
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    context.resume.mockImplementation(async () => { context.state = 'running'; });
    window.dispatchEvent(new Event('cc:native-audio-active'));
    expect(context.resume).not.toHaveBeenCalled();
    expect(context.sources).toHaveLength(1);
    expect(playDecodedGameplaySound('warm.wav', { voiceId: 'new', volume: 1 })).toBe('pending');
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(context.sources).toHaveLength(2);
    expect(context.sources[1].start).toHaveBeenCalledTimes(1);
  });

  it('does not resume an ownerless context on pageshow, visibility or native activation', async () => {
    preloadDecodedGameplaySounds(['warm.wav']);
    await new Promise(resolve => setTimeout(resolve, 0));
    const context = MockAudioContext.instances[0];
    context.state = 'suspended';
    window.dispatchEvent(new Event('pageshow'));
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('cc:native-audio-active'));
    document.dispatchEvent(new Event('pointerup'));
    await Promise.resolve();
    expect(context.resume).not.toHaveBeenCalled();
  });

  it('continues global retirement when an owner callback throws and cancels pending owners too', async () => {
    preloadDecodedGameplaySounds(['warm.wav']);
    await new Promise(resolve => setTimeout(resolve, 0));
    const context = MockAudioContext.instances[0];
    playDecodedGameplaySound('warm.wav', { voiceId: 'bad', volume: 1, onStopped: () => { throw new Error('stale feature callback'); } });
    const onStopped = jest.fn();
    playDecodedGameplaySound('cold.wav', { voiceId: 'pending', volume: 1, onStopped });
    expect(() => stopAllDecodedGameplayVoices()).not.toThrow();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(context.sources).toHaveLength(1);
    expect(context.sources[0].stop).toHaveBeenCalledTimes(1);
    expect(onStopped).toHaveBeenCalledTimes(1);
    expect(getDecodedGameplayAudioStats()).toMatchObject({ activeVoices: 0, pendingVoiceStarts: 0 });
  });

  it('settles a replaced pending voice once before its reentrant cleanup can reach the successor', async () => {
    preloadDecodedGameplaySounds(['warm.wav']);
    await new Promise(resolve => setTimeout(resolve, 0));
    const context = MockAudioContext.instances[0];
    let completeDecode!: (buffer: AudioBuffer) => void;
    context.decodeAudioData.mockImplementationOnce(() => new Promise(resolve => { completeDecode = resolve; }));
    const oldStopped = jest.fn(() => stopDecodedGameplayVoice('shared'));
    const newStopped = jest.fn();
    const oldStarted = jest.fn();
    const newStarted = jest.fn();
    playDecodedGameplaySound('cold.wav', { voiceId: 'shared', volume: 1, onStopped: oldStopped, onStarted: oldStarted });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(playDecodedGameplaySound('cold.wav', { voiceId: 'shared', volume: 1, onStopped: newStopped, onStarted: newStarted })).toBe('pending');
    expect(oldStopped).toHaveBeenCalledTimes(1);
    expect(newStopped).not.toHaveBeenCalled();
    expect(getDecodedGameplayAudioStats().pendingVoiceStarts).toBe(1);
    completeDecode({ duration: 2, length: 96000, numberOfChannels: 2 } as AudioBuffer);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(context.sources).toHaveLength(1);
    expect(oldStarted).not.toHaveBeenCalled();
    expect(newStarted).toHaveBeenCalledTimes(1);
    stopDecodedGameplayVoice('shared');
    stopDecodedGameplayVoice('shared');
    expect(oldStopped).toHaveBeenCalledTimes(1);
    expect(newStopped).toHaveBeenCalledTimes(1);
  });

  it('notifies distinct active and pending owners once when they share a replaced voice ID', async () => {
    preloadDecodedGameplaySounds(['warm.wav']);
    await new Promise(resolve => setTimeout(resolve, 0));
    const context = MockAudioContext.instances[0];
    const activeStopped = jest.fn();
    const pendingStopped = jest.fn();
    const nextStopped = jest.fn();
    playDecodedGameplaySound('warm.wav', { voiceId: 'shared', volume: 1, onStopped: activeStopped });
    let completeDecode!: (buffer: AudioBuffer) => void;
    context.decodeAudioData.mockImplementationOnce(() => new Promise(resolve => { completeDecode = resolve; }));
    playDecodedGameplaySound('cold.wav', { voiceId: 'shared', volume: 1, onStopped: pendingStopped });
    await new Promise(resolve => setTimeout(resolve, 0));
    playDecodedGameplaySound('cold.wav', { voiceId: 'shared', volume: 1, onStopped: nextStopped });
    expect(pendingStopped).toHaveBeenCalledTimes(1);
    expect(activeStopped).not.toHaveBeenCalled();
    expect(nextStopped).not.toHaveBeenCalled();
    completeDecode({ duration: 2, length: 96000, numberOfChannels: 2 } as AudioBuffer);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(context.sources).toHaveLength(2);
    expect(context.sources[0].stop).toHaveBeenCalledTimes(1);
    expect(activeStopped).toHaveBeenCalledTimes(1);
    expect(pendingStopped).toHaveBeenCalledTimes(1);
    expect(nextStopped).not.toHaveBeenCalled();
    stopAllDecodedGameplayVoices();
    expect(activeStopped).toHaveBeenCalledTimes(1);
    expect(pendingStopped).toHaveBeenCalledTimes(1);
    expect(nextStopped).toHaveBeenCalledTimes(1);
  });

  it('preserves a newer pending request created by the replaced owner cleanup', async () => {
    preloadDecodedGameplaySounds(['warm.wav']);
    await new Promise(resolve => setTimeout(resolve, 0));
    const context = MockAudioContext.instances[0];
    let completeDecode!: (buffer: AudioBuffer) => void;
    context.decodeAudioData.mockImplementationOnce(() => new Promise(resolve => { completeDecode = resolve; }));
    const reentrantStarted = jest.fn();
    const supersededStopped = jest.fn();
    playDecodedGameplaySound('cold.wav', { voiceId: 'shared', volume: 1, onStopped: () => {
      playDecodedGameplaySound('cold.wav', { voiceId: 'shared', volume: 0.5, onStarted: reentrantStarted });
    } });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(playDecodedGameplaySound('cold.wav', { voiceId: 'shared', volume: 1, onStopped: supersededStopped })).toBe('played');
    expect(supersededStopped).toHaveBeenCalledTimes(1);
    completeDecode({ duration: 2, length: 96000, numberOfChannels: 2 } as AudioBuffer);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(reentrantStarted).toHaveBeenCalledTimes(1);
    expect(context.sources).toHaveLength(1);
    expect(context.gains[0].gain.setValueAtTime).toHaveBeenCalledWith(0.5, 10);
  });

  it('bounds a stuck foreground resume and starts a queued SFX once after touch recovery', async () => {
    jest.useFakeTimers();
    try {
      const source = './assets/sound/merge 6/woosh.mp3';
      preloadDecodedGameplaySounds([source]);
      for (let index = 0; index < 8; index++) await Promise.resolve();
      expect(getDecodedGameplaySoundsState([source])).toBe('ready');
      const context = MockAudioContext.instances[0];
      context.state = 'suspended';
      context.resume.mockImplementationOnce(() => new Promise<void>(() => {}));
      context.resume.mockImplementationOnce(async () => { context.state = 'running'; });

      expect(playDecodedGameplaySound(source, {
        voiceId: 'post-foreground-sfx',
        volume: 0.4,
      })).toBe('pending');
      jest.advanceTimersByTime(1001);
      for (let index = 0; index < 8; index++) await Promise.resolve();
      expect(getDecodedGameplayAudioStats().pendingVoiceStarts).toBe(1);
      expect(context.sources).toHaveLength(0);

      const touch = new Event('pointerup');
      Object.defineProperty(touch, 'pointerType', { value: 'touch' });
      document.dispatchEvent(touch);
      for (let index = 0; index < 8; index++) await Promise.resolve();

      expect(context.resume).toHaveBeenCalledTimes(2);
      expect(context.sources).toHaveLength(1);
      expect(context.sources[0].start).toHaveBeenCalledTimes(1);
      expect(getDecodedGameplayAudioStats().pendingVoiceStarts).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('ramps a live looping voice without restarting or stopping its source', async () => {
    const source = './assets/sound/worlds/crumbleworlds.wav';
    preloadDecodedGameplaySounds([source]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(playDecodedGameplaySound(source, {
      voiceId: 'journey-worlds-hub-loop',
      volume: 0.348,
      loop: true,
    })).toBe('played');

    const context = MockAudioContext.instances[0];
    const sourceNode = context.sources[0];
    const gainNode = context.gains[0];
    expect(setDecodedGameplayVoiceVolume('journey-worlds-hub-loop', 0.1044, 1)).toBe(true);
    expect(gainNode.gain.cancelScheduledValues).toHaveBeenCalledWith(10);
    expect(gainNode.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.1044, 11);
    expect(sourceNode.start).toHaveBeenCalledTimes(1);
    expect(sourceNode.stop).not.toHaveBeenCalled();
  });

  it('queues a cold-start event and plays it as soon as decoding completes', async () => {
    const source = './assets/sound/merge 6/merge six obicna.mp3';
    const onStarted = jest.fn();
    const onEnded = jest.fn();
    expect(playDecodedGameplaySound(source, {
      voiceId: 'regular-merge6-primary',
      volume: 0.3,
      onStarted,
      onEnded,
    })).toBe('pending');
    expect(MockAudioContext.instances[0].sources).toHaveLength(0);
    expect(getDecodedGameplaySoundsState([source])).toBe('pending');
    expect(getDecodedGameplayAudioStats().pendingVoiceStarts).toBe(1);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(MockAudioContext.instances[0].sources).toHaveLength(1);
    const sourceNode = MockAudioContext.instances[0].sources[0];
    expect(sourceNode.start).toHaveBeenCalledWith(10, 0);
    expect(onStarted).toHaveBeenCalledTimes(1);
    expect(onEnded).not.toHaveBeenCalled();
    sourceNode.onended?.();
    expect(onEnded).toHaveBeenCalledTimes(1);
    expect(getDecodedGameplayAudioStats().pendingVoiceStarts).toBe(0);
  });

  it('updates a pending loop gain before cold-start playback becomes ready', async () => {
    const source = './assets/sound/worlds/crumbleworlds.wav';
    expect(playDecodedGameplaySound(source, {
      voiceId: 'journey-worlds-hub-loop',
      volume: 0.348,
      loop: true,
    })).toBe('pending');
    expect(setDecodedGameplayVoiceVolume('journey-worlds-hub-loop', 0.1044, 1)).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 0));

    const context = MockAudioContext.instances[0];
    expect(context.sources).toHaveLength(1);
    expect(context.sources[0].loop).toBe(true);
    expect(context.gains[0].gain.setValueAtTime).toHaveBeenCalledWith(0.1044, 10);
  });

  it('waits for a suspended context to resume and can cancel the queued voice', async () => {
    const source = './assets/sound/merge 6/woosh.mp3';
    preloadDecodedGameplaySounds([source]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const context = MockAudioContext.instances[0];
    context.state = 'suspended';
    context.resume.mockImplementation(async () => { context.state = 'running'; });

    const onStopped = jest.fn();
    expect(playDecodedGameplaySound(source, {
      voiceId: 'gameplay-pickup',
      volume: 0.25,
      onStopped,
    })).toBe('pending');
    expect(context.sources).toHaveLength(0);

    stopDecodedGameplayVoice('gameplay-pickup');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(context.sources).toHaveLength(0);
    expect(getDecodedGameplayAudioStats().pendingVoiceStarts).toBe(0);
    expect(onStopped).toHaveBeenCalledTimes(1);
  });

  it('settles an active decoded owner when lifecycle cleanup stops it', async () => {
    const source = './assets/sound/results/fail.wav';
    const onStopped = jest.fn();
    preloadDecodedGameplaySounds([source]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(playDecodedGameplaySound(source, {
      voiceId: 'result-fail',
      volume: 0.5,
      onStopped,
    })).toBe('played');

    stopDecodedGameplayVoice('result-fail');
    stopDecodedGameplayVoice('result-fail');
    expect(onStopped).toHaveBeenCalledTimes(1);
  });

  it('releases a queued owner when cold decoding later proves unavailable', async () => {
    const source = './assets/sound/results/missing.wav';
    const onDeferredUnavailable = jest.fn();
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 404,
      arrayBuffer: async () => new ArrayBuffer(0),
    })) as jest.Mock;

    expect(playDecodedGameplaySound(source, {
      voiceId: 'result-missing',
      volume: 0.5,
      onDeferredUnavailable,
    })).toBe('pending');

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onDeferredUnavailable).toHaveBeenCalledTimes(1);
    expect(getDecodedGameplayAudioStats().pendingVoiceStarts).toBe(0);
  });

  it('schedules a decoded layer from the requested event-relative delay', async () => {
    const source = './assets/sound/Wild and special kockice/star/magicle_sparkle_for__#1-1788980027254.wav';
    preloadDecodedGameplaySounds([source]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(playDecodedGameplaySound(source, {
      voiceId: 'wild-star-merge6-sparkle',
      volume: 0.36,
      startDelaySeconds: 0.2,
    })).toBe('played');

    const context = MockAudioContext.instances[0];
    expect(context.sources[0].start).toHaveBeenCalledWith(10.2, 0);
  });
  describe('bounded buffer residency and retry', () => {
    async function flush(): Promise<void> {
      for (let i = 0; i < 12; i++) await Promise.resolve();
    }
    const bufferMiB = (mib: number): AudioBuffer => ({
      duration: 2, numberOfChannels: 2, length: mib * 1024 * 1024 / 8,
    } as AudioBuffer);

    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('evicts the oldest idle buffer under pressure and accounts decoded float samples', async () => {
      preloadDecodedGameplaySounds([]);
      const context = MockAudioContext.instances[0];
      context.decodeAudioData.mockResolvedValue(bufferMiB(24));
      for (const source of ['a.wav', 'b.wav', 'c.wav']) {
        preloadDecodedGameplaySounds([source]);
        await flush();
        jest.advanceTimersByTime(1);
      }
      expect(getDecodedGameplayAudioStats()).toMatchObject({
        decodedBuffers: 2, decodedBytes: 48 * 1024 * 1024,
        idleBytes: 48 * 1024 * 1024, budgetBytes: 64 * 1024 * 1024, evictedBuffers: 1,
      });
      expect(getDecodedGameplaySoundsState(['b.wav', 'c.wav'])).toBe('ready');
      expect(getDecodedGameplaySoundsState(['a.wav'])).toBe('pending');
      await flush();
      expect(global.fetch).toHaveBeenCalledTimes(4);
    });

    it('releases sub-budget idle buffers on OS pressure without interrupting live audio', async () => {
      preloadDecodedGameplaySounds(['idle.wav', 'live.wav']);
      await flush();
      expect(playDecodedGameplaySound('live.wav', { voiceId: 'live', volume: 1, loop: true })).toBe('played');
      releaseIdleDecodedGameplayAudio();
      expect(getDecodedGameplayAudioStats()).toMatchObject({ decodedBuffers: 1, idleBytes: 0, activeVoices: 1 });
      expect(MockAudioContext.instances[0].sources[0].stop).not.toHaveBeenCalled();
      stopDecodedGameplayVoice('live');
      releaseIdleDecodedGameplayAudio();
      releaseIdleDecodedGameplayAudio();
      expect(getDecodedGameplayAudioStats().decodedBytes).toBe(0);
      preloadDecodedGameplaySounds(['idle.wav']);
      await flush();
      expect(playDecodedGameplaySound('idle.wav', { voiceId: 'again', volume: 1 })).toBe('played');
    });

    it('starts every requested layer when a cold readiness group exceeds the budget', async () => {
      preloadDecodedGameplaySounds([]);
      MockAudioContext.instances[0].decodeAudioData.mockResolvedValue(bufferMiB(24));
      const sources = ['layer-a.wav', 'layer-b.wav', 'layer-c.wav'];
      expect(getDecodedGameplaySoundsState(sources)).toBe('pending');
      sources.forEach((source, index) => {
        expect(playDecodedGameplaySound(source, { voiceId: `layer-${index}`, volume: 1 })).toBe('pending');
      });
      await flush();
      expect(getDecodedGameplayAudioStats()).toMatchObject({
        decodedBytes: 72 * 1024 * 1024, idleBytes: 0, activeVoices: 3, pendingVoiceStarts: 0,
      });
      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(getDecodedGameplaySoundsState(sources)).toBe('ready');
      stopDecodedGameplayVoice('layer-0');
      expect(getDecodedGameplayAudioStats()).toMatchObject({ decodedBytes: 48 * 1024 * 1024, activeVoices: 2 });
    });

    it('keeps an oversized active loop and releases it only after its final voice stops', async () => {
      preloadDecodedGameplaySounds([]);
      const context = MockAudioContext.instances[0];
      context.decodeAudioData.mockResolvedValue(bufferMiB(80));
      playDecodedGameplaySound('loop.wav', { voiceId: 'first', volume: 0.4, loop: true });
      await flush();
      expect(playDecodedGameplaySound('loop.wav', { voiceId: 'second', volume: 0.4 })).toBe('played');
      jest.advanceTimersByTime(60_000);
      stopDecodedGameplayVoice('first');
      expect(getDecodedGameplayAudioStats()).toMatchObject({ decodedBuffers: 1, idleBytes: 0, activeVoices: 1 });
      expect(context.sources[1].stop).not.toHaveBeenCalled();
      stopDecodedGameplayVoice('second');
      expect(getDecodedGameplayAudioStats()).toMatchObject({ decodedBuffers: 0, decodedBytes: 0 });
    });

    it('protects a decoded pending user waiting for resume, but releases it on cancellation', async () => {
      preloadDecodedGameplaySounds([]);
      const context = MockAudioContext.instances[0];
      context.decodeAudioData.mockResolvedValue(bufferMiB(80));
      context.state = 'suspended';
      let resume!: () => void;
      context.resume.mockImplementation(() => new Promise<void>((resolve) => { resume = resolve; }));
      const onStopped = jest.fn();
      playDecodedGameplaySound('pending.wav', { voiceId: 'pending', volume: 1, onStopped });
      await flush();
      jest.advanceTimersByTime(60_000);
      releaseIdleDecodedGameplayAudio();
      expect(getDecodedGameplayAudioStats()).toMatchObject({ decodedBuffers: 1, pendingVoiceStarts: 1, idleBytes: 0 });
      stopDecodedGameplayVoice('pending');
      expect(getDecodedGameplayAudioStats().decodedBytes).toBe(0);
      context.state = 'running';
      resume();
      await flush();
      expect(context.sources).toHaveLength(0);
      expect(onStopped).toHaveBeenCalledTimes(1);
    });

    it('reuses the complete Forest working set across seven World/gameplay round trips', async () => {
      preloadDecodedGameplaySounds([]);
      const context = MockAudioContext.instances[0];
      const sizes = [10.99, 10.39, 29.60];
      sizes.forEach((size) => context.decodeAudioData.mockResolvedValueOnce(bufferMiB(size)));
      const sources = ['forest-nature.wav', 'forest-bees.wav'];
      for (let visit = 0; visit < 7; visit++) {
        sources.forEach((source, index) => {
          expect(playDecodedGameplaySound(source, {
            voiceId: `forest-${index}`, volume: 0.612, loop: true,
          })).toBe(visit === 0 ? 'pending' : 'played');
        });
        await flush();
        expect(getDecodedGameplayAudioStats().activeVoices).toBe(2);
        stopDecodedGameplayVoice('forest-0');
        stopDecodedGameplayVoice('forest-1');
        expect(playDecodedGameplaySound('forest-gameplay.wav', {
          voiceId: 'gameplay', volume: 0.54, loop: true,
        })).toBe(visit === 0 ? 'pending' : 'played');
        await flush();
        jest.advanceTimersByTime(45_000);
        stopDecodedGameplayVoice('gameplay');
      }
      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(context.decodeAudioData).toHaveBeenCalledTimes(3);
      expect(getDecodedGameplayAudioStats()).toMatchObject({ decodedBuffers: 3, activeVoices: 0, evictedBuffers: 0 });
      expect(getDecodedGameplayAudioStats().decodedBytes / 1024 / 1024).toBeCloseTo(50.98);
      expect(jest.getTimerCount()).toBe(0);
    });

    it('retries a failed fetch only after cooldown and coalesces concurrent retry callers', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('temporary'));
      const onDeferredUnavailable = jest.fn();
      playDecodedGameplaySound('retry.wav', { voiceId: 'failed', volume: 1, onDeferredUnavailable });
      await flush();
      expect(onDeferredUnavailable).toHaveBeenCalledTimes(1);
      expect(playDecodedGameplaySound('retry.wav', { voiceId: 'early', volume: 1 })).toBe('unavailable');
      preloadDecodedGameplaySounds(['retry.wav']);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(2000);
      expect(playDecodedGameplaySound('retry.wav', { voiceId: 'one', volume: 1 })).toBe('pending');
      expect(playDecodedGameplaySound('retry.wav', { voiceId: 'two', volume: 1 })).toBe('pending');
      await flush();
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(getDecodedGameplayAudioStats()).toMatchObject({ failedBuffers: 0, activeVoices: 2, pendingVoiceStarts: 0 });
    });

    it('recovers a decode failure through the readiness API without autonomous retry work', async () => {
      preloadDecodedGameplaySounds([]);
      const context = MockAudioContext.instances[0];
      context.decodeAudioData.mockRejectedValueOnce(new Error('decoder interrupted'));
      preloadDecodedGameplaySounds(['decode.wav']);
      await flush();
      expect(getDecodedGameplaySoundsState(['decode.wav'])).toBe('unavailable');
      jest.advanceTimersByTime(60_000);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(getDecodedGameplaySoundsState(['decode.wav'])).toBe('pending');
      await flush();
      expect(getDecodedGameplaySoundsState(['decode.wav'])).toBe('ready');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('cancels a queued fade owner and prevents its late start', async () => {
      const onStopped = jest.fn();
      playDecodedGameplaySound('queued.wav', { voiceId: 'queued', volume: 1, onStopped });
      expect(fadeOutDecodedGameplayVoice('queued', 1)).toBe(false);
      await flush();
      expect(onStopped).toHaveBeenCalledTimes(1);
      expect(MockAudioContext.instances[0].sources).toHaveLength(0);
      jest.advanceTimersByTime(30_000);
      expect(getDecodedGameplayAudioStats()).toMatchObject({ activeVoices: 0, pendingVoiceStarts: 0 });
      expect(jest.getTimerCount()).toBe(0);
    });

    it('reports a queued startup failure without cancelling its fallback owner', async () => {
      preloadDecodedGameplaySounds([]);
      const context = MockAudioContext.instances[0];
      const createSource = context.createBufferSource.bind(context);
      jest.spyOn(context, 'createBufferSource').mockImplementationOnce(() => {
        const source = createSource();
        (source.start as jest.Mock).mockImplementation(() => { throw new Error('native start failed'); });
        return source;
      });
      const onDeferredUnavailable = jest.fn();
      const onStopped = jest.fn();
      const onStarted = jest.fn();
      expect(playDecodedGameplaySound('late-start.wav', {
        voiceId: 'late-start', volume: 1, onDeferredUnavailable, onStopped, onStarted,
      })).toBe('pending');
      await flush();
      expect(onDeferredUnavailable).toHaveBeenCalledTimes(1);
      expect(onStopped).not.toHaveBeenCalled();
      expect(onStarted).not.toHaveBeenCalled();
      expect(getDecodedGameplayAudioStats()).toMatchObject({ activeVoices: 0, pendingVoiceStarts: 0 });
      expect(context.sources[0].disconnect).toHaveBeenCalledTimes(1);
      expect(context.gains[0].disconnect).toHaveBeenCalledTimes(1);
      stopDecodedGameplayVoice('late-start');
      expect(onStopped).not.toHaveBeenCalled();
    });

    it('rolls back partial node construction without stopping a newer owner created during failure', async () => {
      preloadDecodedGameplaySounds(['old.wav', 'new.wav']);
      await flush();
      const context = MockAudioContext.instances[0];
      const createSource = context.createBufferSource.bind(context);
      const nextStopped = jest.fn();
      const failedStopped = jest.fn();
      jest.spyOn(context, 'createBufferSource').mockImplementationOnce(() => {
        const source = createSource();
        (source.start as jest.Mock).mockImplementation(() => {
          playDecodedGameplaySound('new.wav', { voiceId: 'shared', volume: 1, onStopped: nextStopped });
          throw new Error('native start failed after successor acquired ownership');
        });
        return source;
      });
      expect(playDecodedGameplaySound('old.wav', { voiceId: 'shared', volume: 1, onStopped: failedStopped })).toBe('unavailable');
      // The explicit reentrant replacement stops the old owner once; its
      // subsequent failed-start catch must not stop the successor as well.
      expect(failedStopped).toHaveBeenCalledTimes(1);
      expect(nextStopped).not.toHaveBeenCalled();
      expect(context.sources[1].stop).not.toHaveBeenCalled();
      expect(getDecodedGameplayAudioStats().activeVoices).toBe(1);
      stopDecodedGameplayVoice('shared');
      expect(nextStopped).toHaveBeenCalledTimes(1);
    });

    it('disconnects a partially constructed source when gain allocation fails without cancellation callbacks', async () => {
      preloadDecodedGameplaySounds(['warm.wav']);
      await flush();
      const context = MockAudioContext.instances[0];
      jest.spyOn(context, 'createGain').mockImplementationOnce(() => { throw new Error('gain allocation failed'); });
      const onStopped = jest.fn();
      expect(playDecodedGameplaySound('warm.wav', { voiceId: 'partial', volume: 1, onStopped })).toBe('unavailable');
      expect(context.sources[0].disconnect).toHaveBeenCalledTimes(1);
      expect(onStopped).not.toHaveBeenCalled();
      expect(getDecodedGameplayAudioStats()).toMatchObject({ activeVoices: 0, pendingVoiceStarts: 0 });
    });

    it('does not turn a feature start callback error into native failure or duplicate fallback', async () => {
      preloadDecodedGameplaySounds(['warm.wav']);
      await flush();
      const context = MockAudioContext.instances[0];
      const onStopped = jest.fn();
      const onDeferredUnavailable = jest.fn();
      expect(playDecodedGameplaySound('warm.wav', {
        voiceId: 'started', volume: 1, onStopped, onDeferredUnavailable,
        onStarted: () => { throw new Error('retired feature callback'); },
      })).toBe('played');
      expect(context.sources[0].start).toHaveBeenCalledTimes(1);
      expect(context.sources[0].stop).not.toHaveBeenCalled();
      expect(onStopped).not.toHaveBeenCalled();
      expect(onDeferredUnavailable).not.toHaveBeenCalled();
      stopDecodedGameplayVoice('started');
      expect(onStopped).toHaveBeenCalledTimes(1);
    });

    it('does not let an obsolete pending decode repopulate or delete a new owner', async () => {
      preloadDecodedGameplaySounds([]);
      let finishOld!: (value: AudioBuffer) => void;
      MockAudioContext.instances[0].decodeAudioData.mockImplementation(() => new Promise((resolve) => { finishOld = resolve; }));
      preloadDecodedGameplaySounds(['same.wav']);
      await flush();
      resetDecodedGameplayAudioForTests();
      preloadDecodedGameplaySounds(['same.wav']);
      await flush();
      finishOld(bufferMiB(80));
      await flush();
      expect(getDecodedGameplayAudioStats()).toMatchObject({ decodedBuffers: 1, decodedBytes: 768000, pendingBuffers: 0 });
    });
  });

});
