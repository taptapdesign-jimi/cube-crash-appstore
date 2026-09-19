import {
  startSoundtrack, stopSoundtrack, resetSoundtrackForTests,
  beginGameplayTransitionFade, continueGameplayTransitionFade, completeGameplayTransitionFade,
  enterArcadeGameplaySoundtrack, promoteArcadeSoundtrackAfterMerge6,
  getSoundtrackRuntimeStats, SOUNDTRACK_GAMEPLAY_VOLUME,
} from '../soundtrack-manager';

class NativeParam {
  setValueAtTime = jest.fn();
  cancelScheduledValues = jest.fn();
  linearRampToValueAtTime = jest.fn();
}
class NativeContext {
  static instances: NativeContext[] = [];
  state = 'running';
  currentTime = 0;
  destination = {};
  gains: Array<{ gain: NativeParam; connect: jest.Mock; disconnect: jest.Mock }> = [];
  sources: Array<{ active: boolean; connect: jest.Mock; disconnect: jest.Mock; start: jest.Mock; stop: jest.Mock }> = [];
  constructor() { NativeContext.instances.push(this); }
  createGain() {
    const gain = { gain: new NativeParam(), connect: jest.fn(), disconnect: jest.fn() };
    this.gains.push(gain);
    return gain;
  }
  createBufferSource() {
    const source = {
      active: false, connect: jest.fn(), disconnect: jest.fn(),
      start: jest.fn(() => { source.active = true; }),
      stop: jest.fn(() => { source.active = false; }),
    };
    this.sources.push(source);
    return source;
  }
  createMediaElementSource() { return { connect: jest.fn(), disconnect: jest.fn() }; }
  decodeAudioData = jest.fn(async () => ({ duration: 59.6910625, length: 2865171, numberOfChannels: 2 }));
  resume = jest.fn(async () => { this.state = 'running'; });
  close = jest.fn(async () => { this.state = 'closed'; });
}
class NativeMedia {
  static instances: NativeMedia[] = [];
  paused = true;
  volume = 1;
  currentTime = 0;
  duration = 180;
  loop = true;
  preload = 'auto';
  constructor(readonly src: string) { NativeMedia.instances.push(this); }
  play = jest.fn(async () => { this.paused = false; });
  pause = jest.fn(() => { this.paused = true; });
  removeAttribute = jest.fn();
  load = jest.fn();
}

// Only platform audio primitives are mocked. Manager, transport, gain envelope,
// generation cancellation, routing and retry listeners all execute production code.
describe('native soundtrack manager + transport ownership', () => {
  const originalContext = window.AudioContext;
  const originalAudio = global.Audio;
  const originalFetch = global.fetch;
  const originalHidden = Object.getOwnPropertyDescriptor(document, 'hidden');
  const flush = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };
  const advance = async (ms: number) => {
    NativeContext.instances.forEach((context) => { context.currentTime += ms / 1000; });
    jest.advanceTimersByTime(ms);
    await flush();
  };
  const visibility = (hidden: boolean) => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
    document.dispatchEvent(new Event('visibilitychange'));
  };
  beforeEach(() => {
    jest.useFakeTimers();
    NativeContext.instances = [];
    NativeMedia.instances = [];
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: NativeContext });
    global.Audio = NativeMedia as unknown as typeof Audio;
    global.fetch = jest.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })) as jest.Mock;
    (window as any)._settings = { musicEnabled: true };
    visibility(false);
  });
  afterEach(() => {
    resetSoundtrackForTests();
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: originalContext });
    if (originalHidden) Object.defineProperty(document, 'hidden', originalHidden);
    else delete (document as any).hidden;
    global.Audio = originalAudio;
    global.fetch = originalFetch;
    delete (window as any)._settings;
    delete (window as any).__ccRunMode;
    jest.useRealTimers();
  });

  it('cancels a pending menu decode at Journey transition and starts only the gameplay gain after completion', async () => {
    let finishFetch!: (value: unknown) => void;
    global.fetch = jest.fn(() => new Promise((resolve) => { finishFetch = resolve; })) as jest.Mock;
    startSoundtrack();
    const generation = beginGameplayTransitionFade();
    continueGameplayTransitionFade(generation, 0.2, 500);
    finishFetch({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
    await flush();
    const context = NativeContext.instances[0];
    expect(context.sources).toHaveLength(0);
    completeGameplayTransitionFade(generation);
    await flush();
    expect(context.sources).toHaveLength(1);
    expect(context.gains[0].gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(SOUNDTRACK_GAMEPLAY_VOLUME, 0.32);
    await advance(320);
    expect(getSoundtrackRuntimeStats().activeVoices).toBe(1);
    stopSoundtrack();
    expect(getSoundtrackRuntimeStats().activeVoices).toBe(0);
  });

  async function enterArcade() {
    startSoundtrack();
    await flush();
    (window as any).__ccRunMode = 'arcade_home';
    enterArcadeGameplaySoundtrack();
    await flush();
    await advance(1300);
    expect(getSoundtrackRuntimeStats().activeVoices).toBe(1);
    return NativeContext.instances[0];
  }

  it('uses the next gesture to resume an existing Arcade context after foreground rejection', async () => {
    const context = await enterArcade();
    visibility(true);
    context.state = 'suspended';
    context.resume.mockRejectedValueOnce(new Error('gesture required'));
    visibility(false);
    await flush();
    expect(context.state).toBe('suspended');
    document.dispatchEvent(new Event('pointerdown'));
    await flush();
    expect(context.resume).toHaveBeenCalledTimes(2);
    expect(context.state).toBe('running');
    await advance(1300);
    expect(getSoundtrackRuntimeStats()).toMatchObject({ activeVoices: 1, retainedArcadeVoices: 1 });
    expect(NativeMedia.instances).toHaveLength(1);
  });

  it('arms gesture recovery if pageshow resume resolves without actually running the Arcade context', async () => {
    const context = await enterArcade();
    context.state = 'suspended';
    context.resume.mockImplementationOnce(async () => {});
    window.dispatchEvent(new Event('pageshow'));
    await flush();
    expect(context.state).toBe('suspended');
    document.dispatchEvent(new Event('pointerdown'));
    await flush();
    expect(context.resume).toHaveBeenCalledTimes(2);
    expect(context.state).toBe('running');
  });

  it('releases the outgoing Arcade voice after promotion and every voice on mute', async () => {
    await enterArcade();
    promoteArcadeSoundtrackAfterMerge6();
    await advance(1);
    await advance(2200);
    expect(getSoundtrackRuntimeStats()).toMatchObject({ activeVoices: 1, retainedArcadeVoices: 1 });
    expect(NativeMedia.instances).toHaveLength(2);
    stopSoundtrack();
    await advance(5000);
    expect(getSoundtrackRuntimeStats()).toMatchObject({ activeVoices: 0, retainedArcadeVoices: 0 });
  });

  it('recovers on touch after WebKit leaves foreground resume pending, and ignores its late completion', async () => {
    startSoundtrack();
    await flush();
    const context = NativeContext.instances[0];
    visibility(true);
    context.state = 'suspended';
    let finishOldResume!: () => void;
    context.resume.mockImplementationOnce(() => new Promise<void>(resolve => { finishOldResume = resolve; }));
    visibility(false);
    await flush();
    expect(getSoundtrackRuntimeStats()).toMatchObject({ activeVoices: 0, resumePending: true });
    await advance(1001);
    expect(getSoundtrackRuntimeStats().resumePending).toBe(false);
    const touch = new Event('pointerup');
    Object.defineProperty(touch, 'pointerType', { value: 'touch' });
    document.dispatchEvent(touch);
    await flush();
    expect(context.resume).toHaveBeenCalledTimes(2);
    expect(getSoundtrackRuntimeStats().activeVoices).toBe(1);
    const sourceCount = context.sources.length;
    finishOldResume();
    await flush();
    expect(context.sources).toHaveLength(sourceCount);
    expect(context.sources.filter(source => source.active)).toHaveLength(1);
  });

  it('Music OFF cancels pending foreground recovery and a late native completion cannot restart it', async () => {
    startSoundtrack();
    await flush();
    const context = NativeContext.instances[0];
    visibility(true);
    context.state = 'suspended';
    let finishResume!: () => void;
    context.resume.mockImplementationOnce(() => new Promise<void>(resolve => { finishResume = resolve; }));
    visibility(false);
    await flush();
    stopSoundtrack();
    expect(getSoundtrackRuntimeStats().resumePending).toBe(false);
    context.state = 'running';
    finishResume();
    await advance(1500);
    document.dispatchEvent(new Event('pointerup'));
    await flush();
    expect(context.sources.filter(source => source.active)).toHaveLength(0);
  });
});
