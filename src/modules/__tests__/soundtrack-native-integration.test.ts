import {
  startSoundtrack, stopSoundtrack, resetSoundtrackForTests,
  beginGameplayTransitionFade, continueGameplayTransitionFade, completeGameplayTransitionFade,
  enterArcadeGameplaySoundtrack, promoteArcadeSoundtrackAfterMerge6,
  acquireGameplaySoundtrackAfterPlayAgain,
  fadeInAndResume, SOUNDTRACK_VOLUME, ARCADE_SOUNDTRACK_CALM_VOLUME,
  getSoundtrackRuntimeStats, SOUNDTRACK_GAMEPLAY_VOLUME,
  ARCADE_SOUNDTRACK_ACTIVE_URL, ARCADE_SOUNDTRACK_CALM_URL,
} from '../soundtrack-manager';

class NativeParam {
  value = 0;
  setValueAtTime = jest.fn((value: number) => { this.value = value; });
  cancelScheduledValues = jest.fn();
  linearRampToValueAtTime = jest.fn((value: number) => { this.value = value; });
}
type NativeGain = { gain: NativeParam; connect: jest.Mock; disconnect: jest.Mock };
type NativeSource = {
  active: boolean;
  stale: boolean;
  startEpoch: number | null;
  output: NativeGain | null;
  connect: jest.Mock;
  disconnect: jest.Mock;
  start: jest.Mock;
  stop: jest.Mock;
};
class NativeContext {
  static instances: NativeContext[] = [];
  state = 'running';
  currentTime = 0;
  destination = {};
  nativeSessionActive = true;
  nativeActivationEpoch = 0;
  gains: NativeGain[] = [];
  sources: NativeSource[] = [];
  constructor() { NativeContext.instances.push(this); }
  createGain() {
    const gain = { gain: new NativeParam(), connect: jest.fn(), disconnect: jest.fn() };
    this.gains.push(gain);
    return gain;
  }
  createBufferSource() {
    const source: NativeSource = {
      active: false,
      stale: false,
      startEpoch: null,
      output: null,
      connect: jest.fn((target: NativeGain) => { source.output = target; }),
      disconnect: jest.fn(),
      start: jest.fn(() => {
        source.active = true;
        source.startEpoch = this.nativeActivationEpoch;
        source.stale = !this.nativeSessionActive;
      }),
      stop: jest.fn(() => { source.active = false; }),
    };
    this.sources.push(source);
    return source;
  }
  createMediaElementSource() { return { connect: jest.fn(), disconnect: jest.fn() }; }
  decodeAudioData = jest.fn(async () => ({ duration: 59.6910625, length: 2865171, numberOfChannels: 2 }));
  resume = jest.fn(async () => { this.state = 'running'; });
  close = jest.fn(async () => { this.state = 'closed'; });
  private stateListeners = new Set<() => void>();
  addEventListener = jest.fn((type: string, listener: () => void) => {
    if (type === 'statechange') this.stateListeners.add(listener);
  });
  removeEventListener = jest.fn((type: string, listener: () => void) => {
    if (type === 'statechange') this.stateListeners.delete(listener);
  });
  emitStateChange() { this.stateListeners.forEach(listener => listener()); }
  deactivateNativeSession() {
    this.nativeSessionActive = false;
    this.sources.filter(source => source.active).forEach(source => { source.stale = true; });
  }
  activateNativeSession(epoch: number) {
    this.nativeSessionActive = true;
    this.nativeActivationEpoch = epoch;
  }
  get audibleSources(): NativeSource[] {
    return this.sources.filter(source => (
      source.active &&
      !source.stale &&
      this.nativeSessionActive &&
      this.state === 'running' &&
      (source.output?.gain.value ?? 0) > 0
    ));
  }
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
    NativeContext.instances.forEach((context) => {
      if (context.state === 'running') context.currentTime += ms / 1000;
    });
    jest.advanceTimersByTime(ms);
    await flush();
  };
  const visibility = (hidden: boolean) => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
    document.dispatchEvent(new Event('visibilitychange'));
  };
  const setHiddenWithoutVisibilityEvent = (hidden: boolean) => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
  };
  const deliverNativeReceipt = async (
    context: NativeContext,
    activationSequence: number,
    activationCompletedAtMs = Date.now() + 1,
  ) => {
    if (activationSequence > context.nativeActivationEpoch) {
      context.activateNativeSession(activationSequence);
    }
    window.dispatchEvent(new CustomEvent('cc:native-audio-active', {
      detail: { reason: 'app-active', activationSequence, activationCompletedAtMs },
    }));
    await flush();
  };
  const backgroundForPhotos = (context: NativeContext) => {
    visibility(true);
    context.deactivateNativeSession();
    context.state = 'interrupted';
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

  it.each(['visibility', 'native-active'] as const)('retires a hidden Arcade promotion and restores Active through %s', async (resumeOwner) => {
    const context = await enterArcade();
    promoteArcadeSoundtrackAfterMerge6();
    const fetchCount = (global.fetch as jest.Mock).mock.calls.length;
    visibility(true);
    await advance(5000);
    expect(global.fetch).toHaveBeenCalledTimes(fetchCount);
    expect(context.sources.filter(source => source.active)).toHaveLength(0);

    if (resumeOwner === 'native-active') {
      window.dispatchEvent(new Event('cc:native-audio-active'));
      expect(document.hidden).toBe(true);
    } else visibility(false);
    await flush();
    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining(ARCADE_SOUNDTRACK_ACTIVE_URL.replace(/^\.\//, '')),
      { cache: 'force-cache' },
    );
    await advance(500);
    expect(getSoundtrackRuntimeStats()).toMatchObject({ activeVoices: 1, retainedArcadeVoices: 1 });
    expect(context.sources.filter(source => source.active)).toHaveLength(1);
  });

  it('defers a cold Arcade entry until visible without creating audio or fetching while hidden', async () => {
    (window as any).__ccRunMode = 'arcade_home';
    visibility(true);
    enterArcadeGameplaySoundtrack();
    await advance(5000);
    expect(NativeContext.instances).toHaveLength(0);
    expect(NativeMedia.instances).toHaveLength(0);
    expect(global.fetch).not.toHaveBeenCalled();

    visibility(false);
    await flush();
    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining(ARCADE_SOUNDTRACK_CALM_URL.replace(/^\.\//, '')),
      { cache: 'force-cache' },
    );
    await advance(500);
    expect(getSoundtrackRuntimeStats()).toMatchObject({ activeVoices: 1, retainedArcadeVoices: 1 });
  });

  it('keeps a hidden new-round request silent and uses Calm on the next foreground', async () => {
    const context = await enterArcade();
    promoteArcadeSoundtrackAfterMerge6();
    await advance(2200);
    await advance(2200);
    visibility(true);
    const fetchCount = (global.fetch as jest.Mock).mock.calls.length;
    const sourceCount = context.sources.length;
    enterArcadeGameplaySoundtrack();
    window.dispatchEvent(new Event('pageshow'));
    await advance(5000);
    expect(global.fetch).toHaveBeenCalledTimes(fetchCount);
    expect(context.sources).toHaveLength(sourceCount);
    expect(context.sources.filter(source => source.active)).toHaveLength(0);

    visibility(false);
    await flush();
    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining(ARCADE_SOUNDTRACK_CALM_URL.replace(/^\.\//, '')),
      { cache: 'force-cache' },
    );
    await advance(500);
    expect(getSoundtrackRuntimeStats()).toMatchObject({ activeVoices: 1, retainedArcadeVoices: 1 });
    expect(context.sources.filter(source => source.active)).toHaveLength(1);
  });

  it.each(['visibility', 'native-active'] as const)('defers hidden async menu handoff and restores its theme through %s', async (resumeOwner) => {
    const context = await enterArcade();
    let completeRoute!: () => void;
    const routeCompletion = new Promise<void>(resolve => { completeRoute = resolve; });
    void routeCompletion.then(() => fadeInAndResume());
    visibility(true);
    const sourceCount = context.sources.length;
    completeRoute();
    await flush();
    await advance(1000);
    expect(context.sources).toHaveLength(sourceCount);
    expect(context.sources.filter(source => source.active)).toHaveLength(0);

    if (resumeOwner === 'native-active') {
      window.dispatchEvent(new Event('cc:native-audio-active'));
      expect(document.hidden).toBe(true);
    } else visibility(false);
    await flush();
    await advance(500);
    expect(context.sources).toHaveLength(sourceCount + 1);
    expect(context.sources.filter(source => source.active)).toHaveLength(1);
    expect(getSoundtrackRuntimeStats()).toMatchObject({ activeVoices: 1, retainedArcadeVoices: 0 });
  });

  it('retains a hidden cold menu-resume intent without allocating audio until foreground', async () => {
    visibility(true);
    fadeInAndResume();
    await flush();
    expect(NativeContext.instances).toHaveLength(0);
    expect(global.fetch).not.toHaveBeenCalled();
    visibility(false);
    await flush();
    expect(NativeContext.instances).toHaveLength(1);
    expect(getSoundtrackRuntimeStats().activeVoices).toBe(1);
  });

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
    expect(NativeMedia.instances).toHaveLength(0);
    expect(context.sources.filter(source => source.active)).toHaveLength(1);
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
    // The bar-edge callback begins the async decode. Its audio-clock crossfade
    // starts only after that decode has resolved.
    await advance(2200);
    expect(getSoundtrackRuntimeStats()).toMatchObject({ activeVoices: 1, retainedArcadeVoices: 1 });
    expect(NativeMedia.instances).toHaveLength(0);
    expect(NativeContext.instances[0].sources.filter(source => source.active)).toHaveLength(1);
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

  it('does not let stale-hidden pageshow retire a native-active foreground recovery', async () => {
    startSoundtrack();
    await flush();
    const context = NativeContext.instances[0];
    visibility(true);
    context.state = 'interrupted';

    window.dispatchEvent(new CustomEvent('cc:native-audio-active', {
      detail: { reason: 'app-active', activationEpoch: 1 },
    }));
    await flush();
    expect(context.sources.filter(source => source.active)).toHaveLength(1);

    // WKWebView may keep document.hidden stale for the pageshow that follows
    // the authoritative native app-active receipt. pageshow is not a hide.
    window.dispatchEvent(new Event('pageshow'));
    await flush();
    expect(document.hidden).toBe(true);
    expect(context.sources.filter(source => source.active)).toHaveLength(1);

    visibility(false);
    await advance(500);
    expect(getSoundtrackRuntimeStats().activeVoices).toBe(1);
  });

  it('retires on pagehide without visibilitychange and reacquires on pageshow', async () => {
    startSoundtrack();
    await flush();
    const context = NativeContext.instances[0];
    expect(context.sources.filter(source => source.active)).toHaveLength(1);

    setHiddenWithoutVisibilityEvent(true);
    window.dispatchEvent(new Event('pagehide'));
    await flush();
    expect(context.sources.filter(source => source.active)).toHaveLength(0);
    expect(getSoundtrackRuntimeStats().activeVoices).toBe(0);

    context.state = 'interrupted';
    setHiddenWithoutVisibilityEvent(false);
    window.dispatchEvent(new Event('pageshow'));
    await flush();
    await advance(500);
    expect(context.sources.filter(source => source.active)).toHaveLength(1);
    expect(getSoundtrackRuntimeStats().activeVoices).toBe(1);
  });

  it('rebinds a visible-first theme source exactly once after native audio activation', async () => {
    startSoundtrack();
    await flush();
    const context = NativeContext.instances[0];
    backgroundForPhotos(context);

    // Web visibility can return before AVAudioSession.setActive(true) finishes.
    // That first source is logically live but may be physically inaudible.
    visibility(false);
    await flush();
    const sourceCountBeforeNativeReceipt = context.sources.length;
    const staleSource = context.sources.find(source => source.active)!;
    const staleStartCall = staleSource.start.mock.calls[staleSource.start.mock.calls.length - 1];
    const staleStartOffset = staleStartCall[1] as number;
    const staleGain = staleSource.output?.gain.value;
    expect(context.sources.filter(source => source.active)).toHaveLength(1);
    expect(context.audibleSources).toHaveLength(0);

    const nativeReceipt = new CustomEvent('cc:native-audio-active', {
      detail: { reason: 'app-active', activationSequence: 7 },
    });
    context.activateNativeSession(7);
    window.dispatchEvent(nativeReceipt);
    await flush();
    expect(context.sources).toHaveLength(sourceCountBeforeNativeReceipt + 1);
    expect(context.sources.filter(source => source.active)).toHaveLength(1);
    expect(context.audibleSources).toHaveLength(1);
    expect(context.audibleSources[0].startEpoch).toBe(7);
    const reboundStartCalls = context.audibleSources[0].start.mock.calls;
    expect(reboundStartCalls[reboundStartCalls.length - 1][1]).toBeCloseTo(staleStartOffset, 6);
    expect(context.audibleSources[0].output?.gain.value).toBe(staleGain);
    expect(staleGain).toBe(SOUNDTRACK_VOLUME);
    expect(getSoundtrackRuntimeStats()).toMatchObject({
      activeVoices: 1,
      contextState: 'running',
      sourcePresent: true,
    });

    // A duplicate delivery for the same native activation epoch is idempotent.
    const sourceCountAfterNativeReceipt = context.sources.length;
    window.dispatchEvent(nativeReceipt);
    await flush();
    expect(context.sources).toHaveLength(sourceCountAfterNativeReceipt);
    expect(context.sources.filter(source => source.active)).toHaveLength(1);
  });

  it('rebinds a visible-first Arcade source after native audio activation', async () => {
    const context = await enterArcade();
    backgroundForPhotos(context);
    visibility(false);
    await flush();
    const sourceCountBeforeNativeReceipt = context.sources.length;
    const staleSource = context.sources.find(source => source.active)!;
    const staleStartCall = staleSource.start.mock.calls[staleSource.start.mock.calls.length - 1];
    const staleStartOffset = staleStartCall[1] as number;
    const staleGain = staleSource.output?.gain.value;
    expect(context.sources.filter(source => source.active)).toHaveLength(1);
    expect(context.audibleSources).toHaveLength(0);

    await deliverNativeReceipt(context, 11);
    expect(context.sources).toHaveLength(sourceCountBeforeNativeReceipt + 1);
    expect(context.sources.filter(source => source.active)).toHaveLength(1);
    expect(context.audibleSources).toHaveLength(1);
    expect(context.audibleSources[0].startEpoch).toBe(11);
    const reboundStartCalls = context.audibleSources[0].start.mock.calls;
    expect(reboundStartCalls[reboundStartCalls.length - 1][1]).toBeCloseTo(staleStartOffset, 6);
    expect(context.audibleSources[0].output?.gain.value).toBe(staleGain);
    expect(staleGain).toBe(ARCADE_SOUNDTRACK_CALM_VOLUME);
    expect(getSoundtrackRuntimeStats()).toMatchObject({
      activeVoices: 1,
      retainedArcadeVoices: 1,
      contextState: 'running',
    });
  });

  it('ignores a stale native receipt delivered after pagehide until a newer activation arrives', async () => {
    startSoundtrack();
    await flush();
    const context = NativeContext.instances[0];
    await deliverNativeReceipt(context, 20);
    expect(context.audibleSources).toHaveLength(1);

    setHiddenWithoutVisibilityEvent(true);
    window.dispatchEvent(new Event('pagehide'));
    context.deactivateNativeSession();
    context.state = 'interrupted';
    await flush();
    expect(context.sources.filter(source => source.active)).toHaveLength(0);

    // This receipt belonged to the foreground that pagehide already retired.
    await deliverNativeReceipt(context, 20, Date.now() - 1);
    expect(document.hidden).toBe(true);
    expect(context.sources.filter(source => source.active)).toHaveLength(0);
    expect(context.audibleSources).toHaveLength(0);

    await deliverNativeReceipt(context, 21);
    expect(context.sources.filter(source => source.active)).toHaveLength(1);
    expect(context.audibleSources).toHaveLength(1);
    expect(context.audibleSources[0].startEpoch).toBe(21);
  });

  it('retries a failed native reacquire when the same activation epoch is redelivered', async () => {
    startSoundtrack();
    await flush();
    const context = NativeContext.instances[0];
    context.state = 'interrupted';
    context.deactivateNativeSession();
    context.resume.mockRejectedValueOnce(new DOMException('activation race', 'NotAllowedError'));
    context.activateNativeSession(30);

    await deliverNativeReceipt(context, 30);
    expect(context.audibleSources).toHaveLength(0);
    const sourceCountAfterFailure = context.sources.length;

    await deliverNativeReceipt(context, 30);
    expect(context.resume).toHaveBeenCalledTimes(2);
    expect(context.sources).toHaveLength(sourceCountAfterFailure + 1);
    expect(context.audibleSources).toHaveLength(1);
    expect(context.audibleSources[0].startEpoch).toBe(30);
  });

  it('recovers a visible live source when its context changes to interrupted', async () => {
    startSoundtrack();
    await flush();
    const context = NativeContext.instances[0];
    expect(context.audibleSources).toHaveLength(1);
    const resumeCount = context.resume.mock.calls.length;

    context.state = 'interrupted';
    context.emitStateChange();
    await flush();

    expect(context.resume).toHaveBeenCalledTimes(resumeCount + 1);
    expect(context.state).toBe('running');
    expect(getSoundtrackRuntimeStats().activeVoices).toBe(1);
    expect(context.audibleSources).toHaveLength(1);
  });

  it('keeps one audible theme source through two visible-first Photos cycles', async () => {
    startSoundtrack();
    await flush();
    const context = NativeContext.instances[0];

    for (const activationSequence of [40, 41]) {
      backgroundForPhotos(context);
      visibility(false);
      await flush();
      expect(context.sources.filter(source => source.active)).toHaveLength(1);
      expect(context.audibleSources).toHaveLength(0);

      await deliverNativeReceipt(context, activationSequence);
      expect(context.sources.filter(source => source.active)).toHaveLength(1);
      expect(context.audibleSources).toHaveLength(1);
      expect(context.audibleSources[0].startEpoch).toBe(activationSequence);
    }
  });

  it('keeps one audible Arcade source through two visible-first Photos cycles', async () => {
    const context = await enterArcade();

    for (const activationSequence of [50, 51]) {
      backgroundForPhotos(context);
      visibility(false);
      await flush();
      expect(context.sources.filter(source => source.active)).toHaveLength(1);
      expect(context.audibleSources).toHaveLength(0);

      await deliverNativeReceipt(context, activationSequence);
      expect(context.sources.filter(source => source.active)).toHaveLength(1);
      expect(context.audibleSources).toHaveLength(1);
      expect(context.audibleSources[0].startEpoch).toBe(activationSequence);
    }
  });

  it('reacquires the current Arcade voice when a timed-out context becomes running late', async () => {
    const context = await enterArcade();
    visibility(true);
    context.state = 'interrupted';
    context.resume.mockImplementationOnce(() => new Promise<void>(() => {}));
    visibility(false);
    await flush();
    await advance(1001);
    expect(getSoundtrackRuntimeStats()).toMatchObject({
      activeVoices: 0,
      retainedArcadeVoices: 1,
      contextState: 'interrupted',
    });

    context.state = 'running';
    context.emitStateChange();
    await flush();
    expect(getSoundtrackRuntimeStats()).toMatchObject({
      activeVoices: 1,
      retainedArcadeVoices: 1,
      contextState: 'running',
    });
    expect(context.sources.filter(source => source.active)).toHaveLength(1);
  });

  it('Play Again reacquires one Arcade gameplay voice without waiting for a Round cue', async () => {
    const context = await enterArcade();
    const activeBefore = context.sources.filter(source => source.active);
    expect(activeBefore).toHaveLength(1);

    acquireGameplaySoundtrackAfterPlayAgain();
    await flush();

    expect(getSoundtrackRuntimeStats()).toMatchObject({
      activeVoices: 1,
      retainedArcadeVoices: 1,
    });
    expect(context.sources.filter(source => source.active)).toHaveLength(1);
  });

  it('Journey Play Again resumes an interrupted context even when its retained voice is not paused', async () => {
    startSoundtrack();
    await flush();
    const context = NativeContext.instances[0];
    expect(context.sources.filter(source => source.active)).toHaveLength(1);
    context.state = 'interrupted';

    acquireGameplaySoundtrackAfterPlayAgain();
    await flush();

    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(context.state).toBe('running');
    expect(context.sources.filter(source => source.active)).toHaveLength(1);
    expect(context.gains[0].gain.setValueAtTime).toHaveBeenCalledWith(
      SOUNDTRACK_GAMEPLAY_VOLUME,
      context.currentTime,
    );
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
