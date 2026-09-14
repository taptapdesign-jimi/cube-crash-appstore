import {
  fadeOutDecodedGameplayVoice,
  getDecodedGameplayAudioStats,
  getDecodedGameplaySoundsState,
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  resetDecodedGameplayAudioForTests,
  setDecodedGameplayVoiceVolume,
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
  close = jest.fn(() => Promise.resolve());
  decodeAudioData = jest.fn(async () => ({ duration: 2 } as AudioBuffer));

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
});
