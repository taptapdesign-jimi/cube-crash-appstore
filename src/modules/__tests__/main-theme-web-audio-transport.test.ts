import {
  createSampleAccurateMainThemeVoice,
  isSampleAccurateMainThemeVoice,
} from '../main-theme-web-audio-transport';

class MockAudioParam {
  value = 0;
  cancelScheduledValues = jest.fn();
  setValueAtTime = jest.fn((value: number) => {
    this.value = value;
  });
}

class MockGainNode {
  gain = new MockAudioParam();
  connect = jest.fn();
  disconnect = jest.fn();
}

class MockBufferSource {
  buffer: AudioBuffer | null = null;
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  onended: (() => void) | null = null;
  connect = jest.fn();
  disconnect = jest.fn();
  start = jest.fn();
  stop = jest.fn();
}

class MockAudioContext {
  static instances: MockAudioContext[] = [];
  state: AudioContextState = 'running';
  currentTime = 0;
  destination = {} as AudioDestinationNode;
  sources: MockBufferSource[] = [];
  gain = new MockGainNode();
  resume = jest.fn(async () => {
    this.state = 'running';
  });
  close = jest.fn(async () => {});
  decodeAudioData = jest.fn(async () => ({ duration: 59.6910625 } as AudioBuffer));

  constructor() {
    MockAudioContext.instances.push(this);
  }

  createGain(): GainNode {
    return this.gain as unknown as GainNode;
  }

  createBufferSource(): AudioBufferSourceNode {
    const source = new MockBufferSource();
    this.sources.push(source);
    return source as unknown as AudioBufferSourceNode;
  }
}

describe('sample-accurate main theme transport', () => {
  const originalAudioContext = window.AudioContext;
  const originalFetch = global.fetch;

  beforeEach(() => {
    MockAudioContext.instances = [];
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: MockAudioContext,
    });
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => new ArrayBuffer(8),
    })) as jest.Mock;
  });

  afterEach(() => {
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: originalAudioContext,
    });
    global.fetch = originalFetch;
  });

  it('uses one source with an embedded intro and exact loop region', async () => {
    const voice = createSampleAccurateMainThemeVoice({
      source: './theme.wav',
      loopStartSeconds: 2.0583125,
      loopEndSeconds: 59.6910625,
      initialVolume: 0.68,
    });
    expect(voice).not.toBeNull();
    expect(isSampleAccurateMainThemeVoice(voice!)).toBe(true);

    await voice!.play();
    const context = MockAudioContext.instances[0];
    expect(context.sources).toHaveLength(1);
    expect(context.sources[0].loop).toBe(true);
    expect(context.sources[0].loopStart).toBeCloseTo(2.0583125, 7);
    expect(context.sources[0].loopEnd).toBeCloseTo(59.6910625, 7);
    expect(context.sources[0].start).toHaveBeenCalledWith(0, 0);
    expect(context.gain.gain.value).toBe(0.68);

    context.currentTime = 2.5583125;
    expect(voice!.currentTime).toBeCloseTo(2.5583125, 7);
    context.currentTime = 60.1910625;
    expect(voice!.currentTime).toBeCloseTo(2.5583125, 7);
  });

  it('resumes an interrupted live transport without making another source', async () => {
    const voice = createSampleAccurateMainThemeVoice({
      source: './theme.wav',
      loopStartSeconds: 2.0583125,
      loopEndSeconds: 59.6910625,
      initialVolume: 0.68,
    })!;
    await voice.play();
    const context = MockAudioContext.instances[0];
    const source = context.sources[0];
    context.state = 'suspended';

    await voice.resumeIfInterrupted();

    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(context.sources).toHaveLength(1);
    expect(source.start).toHaveBeenCalledTimes(1);
    expect(source.stop).not.toHaveBeenCalled();
    voice.dispose();
  });

  it('resumes the context before creating its single source and cleans up', async () => {
    const voice = createSampleAccurateMainThemeVoice({
      source: './theme.wav',
      loopStartSeconds: 2.0583125,
      loopEndSeconds: 59.6910625,
      initialVolume: 0.68,
    })!;
    const context = MockAudioContext.instances[0];
    context.state = 'suspended';

    await voice.play();
    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(context.sources).toHaveLength(1);
    voice.pause();
    expect(context.sources[0].stop).toHaveBeenCalledTimes(1);
    voice.dispose();
    expect(context.close).toHaveBeenCalledTimes(1);
  });

  it('does not start after a pending decode is canceled by pause', async () => {
    let resolveEncodedAudio!: (value: ArrayBuffer) => void;
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: () => new Promise<ArrayBuffer>((resolve) => {
        resolveEncodedAudio = resolve;
      }),
    })) as jest.Mock;
    const voice = createSampleAccurateMainThemeVoice({
      source: './theme-cold.wav',
      loopStartSeconds: 2.0583125,
      loopEndSeconds: 59.6910625,
      initialVolume: 0.68,
    })!;
    const playPromise = voice.play();
    await Promise.resolve();

    voice.pause();
    resolveEncodedAudio(new ArrayBuffer(8));
    await playPromise;

    expect(MockAudioContext.instances[0].sources).toHaveLength(0);
    expect(voice.paused).toBe(true);
  });

  it('lets a newer play own the shared decode after an older play was canceled', async () => {
    let resolveEncodedAudio!: (value: ArrayBuffer) => void;
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: () => new Promise<ArrayBuffer>((resolve) => {
        resolveEncodedAudio = resolve;
      }),
    })) as jest.Mock;
    const voice = createSampleAccurateMainThemeVoice({
      source: './theme-reowned.wav',
      loopStartSeconds: 2.0583125,
      loopEndSeconds: 59.6910625,
      initialVolume: 0.68,
    })!;
    const oldPlay = voice.play();
    await Promise.resolve();
    voice.pause();
    const newPlay = voice.play();

    resolveEncodedAudio(new ArrayBuffer(8));
    await Promise.all([oldPlay, newPlay]);

    expect(MockAudioContext.instances[0].sources).toHaveLength(1);
    expect(voice.paused).toBe(false);
  });
});
