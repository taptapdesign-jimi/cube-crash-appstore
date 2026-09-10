import {
  getDecodedGameplayAudioStats,
  getDecodedGameplaySoundsState,
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  resetDecodedGameplayAudioForTests,
  stopDecodedGameplayVoice,
} from '../gameplay-audio-buffer-player';

class MockAudioParam {
  value = 1;
  setValueAtTime = jest.fn((value: number) => { this.value = value; });
  linearRampToValueAtTime = jest.fn((value: number) => { this.value = value; });
}

class MockBufferSource {
  buffer: AudioBuffer | null = null;
  playbackRate = new MockAudioParam();
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

  it('queues a cold-start event and plays it as soon as decoding completes', async () => {
    const source = './assets/sound/merge 6/merge six obicna.mp3';
    expect(playDecodedGameplaySound(source, {
      voiceId: 'regular-merge6-primary',
      volume: 0.3,
    })).toBe('pending');
    expect(MockAudioContext.instances[0].sources).toHaveLength(0);
    expect(getDecodedGameplaySoundsState([source])).toBe('pending');
    expect(getDecodedGameplayAudioStats().pendingVoiceStarts).toBe(1);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(MockAudioContext.instances[0].sources).toHaveLength(1);
    expect(MockAudioContext.instances[0].sources[0].start).toHaveBeenCalledWith(10, 0);
    expect(getDecodedGameplayAudioStats().pendingVoiceStarts).toBe(0);
  });

  it('waits for a suspended context to resume and can cancel the queued voice', async () => {
    const source = './assets/sound/merge 6/woosh.mp3';
    preloadDecodedGameplaySounds([source]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const context = MockAudioContext.instances[0];
    context.state = 'suspended';
    context.resume.mockImplementation(async () => { context.state = 'running'; });

    expect(playDecodedGameplaySound(source, {
      voiceId: 'gameplay-pickup',
      volume: 0.25,
    })).toBe('pending');
    expect(context.sources).toHaveLength(0);

    stopDecodedGameplayVoice('gameplay-pickup');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(context.sources).toHaveLength(0);
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
