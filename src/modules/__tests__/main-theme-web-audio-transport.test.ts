import {
  createSampleAccurateMainThemeVoice,
  isSampleAccurateMainThemeVoice,
} from '../main-theme-web-audio-transport';

class MockAudioParam {
  value = 0;
  cancelScheduledValues = jest.fn();
  linearRampToValueAtTime = jest.fn();
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
  gains: MockGainNode[] = [];
  mediaNodes: Array<{ connect: jest.Mock; disconnect: jest.Mock }> = [];
  resume = jest.fn(async () => {
    this.state = 'running';
  });
  close = jest.fn(async () => {});
  decodeAudioData = jest.fn(async () => ({ duration: 59.6910625 } as AudioBuffer));

  constructor() {
    MockAudioContext.instances.push(this);
  }

  createGain(): GainNode {
    const gain = this.gains.length === 0 ? this.gain : new MockGainNode();
    this.gains.push(gain);
    return gain as unknown as GainNode;
  }

  createMediaElementSource(): MediaElementAudioSourceNode {
    const node = { connect: jest.fn(), disconnect: jest.fn() };
    this.mediaNodes.push(node);
    return node as unknown as MediaElementAudioSourceNode;
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
  it('retries a failed cold fetch on the next play without duplicating pending loads', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('transient failure'));
    const voice = createSampleAccurateMainThemeVoice({
      source: './retry.wav', loopStartSeconds: 2, loopEndSeconds: 59, initialVolume: 0.68,
    })!;
    await expect(voice.play()).rejects.toThrow('transient failure');
    await expect(voice.play()).rejects.toThrow('transient failure');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const now = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 2001);
    await Promise.all([voice.play(), voice.play()]);
    now.mockRestore();
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(MockAudioContext.instances[0].sources).toHaveLength(1);
    voice.dispose();
  });

  it('ramps on the audio clock without RAF and retargets from the audible level', () => {
    const voice = createSampleAccurateMainThemeVoice({
      source: './fade.wav', loopStartSeconds: 2, loopEndSeconds: 59, initialVolume: 0.68,
    })!;
    const context = MockAudioContext.instances[0];
    voice.rampVolume!(0, 1000);
    expect(context.gain.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 1);
    context.currentTime = 0.5;
    expect(voice.volume).toBeCloseTo(0.34);
    voice.rampVolume!(0.68, 1000);
    expect(context.gain.gain.setValueAtTime).toHaveBeenLastCalledWith(0.34, 0.5);
    context.currentTime = 1;
    voice.cancelVolumeRamp!();
    context.currentTime = 2;
    expect(voice.volume).toBeCloseTo(0.51);
    voice.dispose();
  });

  it('streams Arcade through the existing context gain and disconnects on disposal', async () => {
    const originalAudio = global.Audio;
    const media = {
      volume: 1, paused: true, currentTime: 0, duration: 180, loop: true, preload: 'auto',
      play: jest.fn(async () => { media.paused = false; }),
      pause: jest.fn(() => { media.paused = true; }),
      removeAttribute: jest.fn(), load: jest.fn(),
    };
    global.Audio = jest.fn(() => media) as unknown as typeof Audio;
    const theme = createSampleAccurateMainThemeVoice({
      source: './theme.wav', loopStartSeconds: 2, loopEndSeconds: 59, initialVolume: 0.68,
    })!;
    try {
      const voice = theme.createMediaVoice!('./calm.wav')!;
      voice.volume = 0;
      await voice.play();
      voice.rampVolume!(0.528, 1250);
      const context = MockAudioContext.instances[0];
      expect(MockAudioContext.instances).toHaveLength(1);
      expect(media.volume).toBe(1);
      expect(context.gains[1].gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0.528, 1.25);
      voice.dispose!();
      expect(media.pause).toHaveBeenCalled();
      expect(context.mediaNodes[0].disconnect).toHaveBeenCalled();
      expect(context.gains[1].disconnect).toHaveBeenCalled();
      expect(context.close).not.toHaveBeenCalled();
    } finally {
      theme.dispose();
      global.Audio = originalAudio;
    }
  });

});
