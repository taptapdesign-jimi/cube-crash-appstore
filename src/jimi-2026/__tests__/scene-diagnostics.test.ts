import { createSceneDiagnostics, SCENE_DIAGNOSTIC_LIMITS } from '../scene-diagnostics';
import { emitNativeConsoleDiagnostic } from '../../utils/ios-native-diagnostic';

jest.mock('../../utils/ios-native-diagnostic', () => ({ emitNativeConsoleDiagnostic: jest.fn() }));

describe('bounded opt-in Jimi scene diagnostics', () => {
  let now: number;
  let nextFrame: number;
  let frames: Map<number, FrameRequestCallback>;
  let clock: jest.SpyInstance;
  let request: jest.SpyInstance;
  let cancel: jest.SpyInstance;
  const emit = emitNativeConsoleDiagnostic as jest.MockedFunction<typeof emitNativeConsoleDiagnostic>;
  const receipt = () => emit.mock.calls[emit.mock.calls.length - 1][2] as Record<string, any>;
  const tick = (at: number, frameTimestamp = -100_000) => {
    expect(frames.size).toBe(1);
    const [id, callback] = [...frames.entries()][0];
    frames.delete(id);
    now = at;
    callback(frameTimestamp);
  };

  beforeEach(() => {
    jest.useFakeTimers();
    now = 100;
    nextFrame = 0;
    frames = new Map();
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    clock = jest.spyOn(performance, 'now').mockImplementation(() => now);
    request = jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    });
    cancel = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id); });
    emit.mockClear();
  });
  afterEach(() => {
    window.dispatchEvent(new Event('pagehide'));
    clock.mockRestore(); request.mockRestore(); cancel.mockRestore();
    jest.useRealTimers();
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  });

  it('disabled diagnostics perform zero clock/listener/RAF/timer/emit work and preserve work results/errors', () => {
    const onDocument = jest.spyOn(document, 'addEventListener');
    const onWindow = jest.spyOn(window, 'addEventListener');
    const controller = new AbortController();
    const onSignal = jest.spyOn(controller.signal, 'addEventListener');
    const diagnostics = createSceneDiagnostics('home', false, controller.signal);
    expect(diagnostics.phase('build', () => 42)).toBe(42);
    const error = new Error('caller failure');
    expect(() => diagnostics.phase('failure', () => { throw error; })).toThrow(error);
    diagnostics.mark('enter'); diagnostics.finish('shown');
    expect(clock).not.toHaveBeenCalled(); expect(request).not.toHaveBeenCalled();
    expect(onDocument).not.toHaveBeenCalled(); expect(onWindow).not.toHaveBeenCalled(); expect(onSignal).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0); expect(emit).not.toHaveBeenCalled();
  });

  it('records named synchronous phases and marks with preserved return and throw semantics', () => {
    const diagnostics = createSceneDiagnostics('beach', true);
    now = 102;
    const value = { identity: true };
    expect(diagnostics.phase('build', () => { now = 107; return value; })).toBe(value);
    diagnostics.mark('resource-wait-start');
    now = 137; diagnostics.mark('resource-wait-end');
    const error = new Error('failure');
    expect(() => diagnostics.phase('retire', () => { now = 140; throw error; })).toThrow(error);
    diagnostics.finish('failed');
    expect(emit).toHaveBeenCalledWith('[JIMI_SCENE_DIAGNOSTICS]', 'beach', expect.objectContaining({
      startAtMs: 100, elapsedMs: 40, commitTailMs: 40,
      phases: [{ name: 'build', atMs: 2, durationMs: 5, failed: false }, { name: 'retire', atMs: 37, durationMs: 3, failed: true }],
      marks: [{ name: 'resource-wait-start', atMs: 7 }, { name: 'resource-wait-end', atMs: 37 }],
    }));
    expect(frames.size).toBe(0); expect(jest.getTimerCount()).toBe(0);
  });

  it('does not mislabel an async wait as synchronous work', async () => {
    const diagnostics = createSceneDiagnostics('hub', true);
    let complete!: () => void;
    const pending = new Promise<void>(resolve => { complete = resolve; });
    expect(diagnostics.phase('resource-request', () => pending)).toBe(pending);
    diagnostics.mark('resource-wait-start');
    now = 200; complete(); await pending;
    diagnostics.mark('resource-wait-end'); diagnostics.finish('shown');
    expect(receipt().phases[0].durationMs).toBe(0);
    expect(receipt().marks).toEqual([{ name: 'resource-wait-start', atMs: 0 }, { name: 'resource-wait-end', atMs: 100 }]);
  });

  it('reports absolute monotonic RAF stall timestamps and an unsampled commit tail separately', () => {
    const diagnostics = createSceneDiagnostics('hub', true);
    tick(116, 99_000); tick(160.25, -9);
    now = 210.25; diagnostics.finish('shown');
    expect(receipt()).toMatchObject({
      startAtMs: 100, elapsedMs: 110.3, samples: 2, worstIntervalMs: 44.3,
      stallCount: 1, commitTailMs: 50,
      stalls: [{ startAtMs: 116, endAtMs: 160.3, durationMs: 44.3 }],
      metric: 'Synchronous phases and RAF callback gaps; not presented frames or GPU attribution',
    });
  });

  it('bounds arrays and labels while reporting dropped records and all stall counts', () => {
    const diagnostics = createSceneDiagnostics('r'.repeat(200), true);
    for (let index = 0; index < 100; index++) {
      diagnostics.mark('m'.repeat(200));
      diagnostics.phase('p'.repeat(200), () => {});
      tick(now + 40);
    }
    diagnostics.finish('f'.repeat(200));
    const data = receipt();
    expect(data.phases).toHaveLength(SCENE_DIAGNOSTIC_LIMITS.phases);
    expect(data.marks).toHaveLength(SCENE_DIAGNOSTIC_LIMITS.marks);
    expect(data.stalls).toHaveLength(SCENE_DIAGNOSTIC_LIMITS.stalls);
    expect(data.phasesDropped).toBe(36); expect(data.marksDropped).toBe(36); expect(data.stallsDropped).toBe(68);
    expect(data.stallCount).toBe(100); expect(data.samples).toBe(100);
    expect(emit.mock.calls[0][1]).toHaveLength(SCENE_DIAGNOSTIC_LIMITS.labelLength);
    expect(data.reason).toHaveLength(SCENE_DIAGNOSTIC_LIMITS.labelLength);
    expect(data.phases[0].name).toHaveLength(SCENE_DIAGNOSTIC_LIMITS.labelLength);
    expect(data.marks[0].name).toHaveLength(SCENE_DIAGNOSTIC_LIMITS.labelLength);
  });

  it.each(['cancelled', 'background', 'pagehide'])('stops on %s, removes ownership and never resumes or mutates its emitted receipt', reason => {
    const controller = new AbortController();
    const removeSignal = jest.spyOn(controller.signal, 'removeEventListener');
    const removeDocument = jest.spyOn(document, 'removeEventListener');
    const removeWindow = jest.spyOn(window, 'removeEventListener');
    const diagnostics = createSceneDiagnostics('home', true, controller.signal);
    const late = [...frames.values()][0];
    if (reason === 'cancelled') controller.abort();
    else if (reason === 'background') {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    } else window.dispatchEvent(new Event('pagehide'));
    expect(receipt().reason).toBe(reason);
    const before = JSON.stringify(receipt());
    const reads = clock.mock.calls.length;
    const requested = request.mock.calls.length;
    late(9000); diagnostics.mark('late'); diagnostics.finish('duplicate');
    expect(diagnostics.phase('late-work', () => 'still runs')).toBe('still runs');
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(clock).toHaveBeenCalledTimes(reads); expect(request).toHaveBeenCalledTimes(requested);
    expect(JSON.stringify(receipt())).toBe(before); expect(emit).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(0); expect(jest.getTimerCount()).toBe(0);
    expect(removeSignal).toHaveBeenCalledWith('abort', expect.any(Function), expect.anything());
    expect(removeDocument).toHaveBeenCalledWith('visibilitychange', expect.any(Function), undefined);
    expect(removeWindow).toHaveBeenCalledWith('pagehide', expect.any(Function), expect.anything());
  });

  it.each(['aborted', 'hidden'])('does not start sampling when already %s', state => {
    const controller = new AbortController();
    if (state === 'aborted') controller.abort();
    else Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    const diagnostics = createSceneDiagnostics('home', true, controller.signal);
    expect(request).not.toHaveBeenCalled(); expect(jest.getTimerCount()).toBe(0);
    expect(emit).toHaveBeenCalledTimes(1); diagnostics.finish('duplicate');
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('has a finite diagnostic timeout without changing any route work', () => {
    const diagnostics = createSceneDiagnostics('hub', true);
    now += SCENE_DIAGNOSTIC_LIMITS.maxDurationMs;
    jest.advanceTimersByTime(SCENE_DIAGNOSTIC_LIMITS.maxDurationMs);
    expect(receipt().reason).toBe('timeout');
    expect(frames.size).toBe(0); expect(jest.getTimerCount()).toBe(0);
    expect(diagnostics.phase('later-route-work', () => 7)).toBe(7);
    diagnostics.finish('shown'); expect(emit).toHaveBeenCalledTimes(1);
  });

  it('does not add a phase after synchronous work itself finishes the diagnostic', () => {
    const diagnostics = createSceneDiagnostics('home', true);
    const result = diagnostics.phase('retire', () => { diagnostics.finish('disposed'); return 9; });
    expect(result).toBe(9); expect(receipt().phases).toEqual([]);
    expect(frames.size).toBe(0); expect(emit).toHaveBeenCalledTimes(1);
  });
});
