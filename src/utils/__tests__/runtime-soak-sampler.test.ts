import { getSoundtrackRuntimeStats } from '../../modules/soundtrack-manager';
import { getSharedPixiSheetCacheStats } from '../../modules/shared-pixi-sheet-animation';
import { getDecodedGameplayAudioStats } from '../../modules/gameplay-audio-buffer-player';
import { getPixiMobileFrameControllerSnapshot } from '../../modules/pixi-mobile-frame-controller';
jest.mock('../../modules/soundtrack-manager', () => ({ getSoundtrackRuntimeStats: jest.fn(() => ({})) }));
jest.mock('../../modules/shared-pixi-sheet-animation', () => ({ getSharedPixiSheetCacheStats: jest.fn(() => ({})) }));
jest.mock('../../modules/gameplay-audio-buffer-player', () => ({ getDecodedGameplayAudioStats: jest.fn(() => ({ activeVoices: 0 })) }));
jest.mock('../../modules/pixi-mobile-frame-controller', () => ({
  getPixiMobileFrameControllerSnapshot: jest.fn(() => ({ active: false, maxFPS: 30, activeUntil: 0, activityLeaseCount: 0 })),
}));
import { emitRuntimeMemoryPressureSnapshot, emitRuntimeResourceSnapshot, startRuntimeSoakSampler } from '../runtime-soak-sampler';

describe('runtime soak sampler', () => {
  beforeEach(() => {
    (getSoundtrackRuntimeStats as jest.Mock).mockReturnValue({});
    (getSharedPixiSheetCacheStats as jest.Mock).mockReturnValue({});
    (getDecodedGameplayAudioStats as jest.Mock).mockReturnValue({ activeVoices: 0 });
    (getPixiMobileFrameControllerSnapshot as jest.Mock).mockReturnValue({ active: false, maxFPS: 30, activeUntil: 0, activityLeaseCount: 0 });
    jest.useFakeTimers();
    delete (window as any).__ccPerformanceDiagnostics;
    delete (window as any).__ccDetailedRuntimeDiagnostics;
    delete (window as any).__ccRuntimeSoakSamplerStop;
    delete (window as any).webkit;
  });

  afterEach(() => {
    (window as any).__ccRuntimeSoakSamplerStop?.();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test('does no work in a normal build', () => {
    const frameRequest = jest.spyOn(window, 'requestAnimationFrame');
    const clock = jest.spyOn(performance, 'now');
    const postMessage = jest.fn();
    (window as any).webkit = { messageHandlers: { consoleLog: { postMessage } } };

    startRuntimeSoakSampler();
    jest.advanceTimersByTime(30_000);

    expect(postMessage).not.toHaveBeenCalled();
    expect(frameRequest).not.toHaveBeenCalled();
    expect(clock).not.toHaveBeenCalled();
    expect((window as any).__ccRuntimeSoakSamplerStop).toBeUndefined();
  });

  test('emits one forced resource snapshot for a native memory warning in a normal build', () => {
    const postMessage = jest.fn();
    (window as any).webkit = { messageHandlers: { consoleLog: { postMessage } } };

    emitRuntimeResourceSnapshot('native-memory-warning:before-cleanup');

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage.mock.calls[0][0].message).toContain('[CC_SOAK]');
    expect(postMessage.mock.calls[0][0].message)
      .toContain('"reason":"native-memory-warning:before-cleanup"');
    const sample = JSON.parse(postMessage.mock.calls[0][0].message.slice('[CC_SOAK] '.length));
    expect(sample.sampleMode).toBe('resources');
    expect(sample).toHaveProperty('dom');
    expect(getSoundtrackRuntimeStats).toHaveBeenCalled();
  });

  test('emits one compact sample immediately and then every five seconds', () => {
    const postMessage = jest.fn();
    (window as any).__ccPerformanceDiagnostics = true;
    (window as any).webkit = { messageHandlers: { consoleLog: { postMessage } } };

    const stop = startRuntimeSoakSampler();
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage.mock.calls[0][0].message).toContain('[CC_SOAK]');
    expect(postMessage.mock.calls[0][0].message).toContain('"frameTiming":null');

    jest.advanceTimersByTime(4_999);
    expect(postMessage).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1);
    // The interval only snapshots frame timing. Resource traversal is moved
    // out of that frame-critical callback and emitted from a quiet task.
    expect(postMessage).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1);
    expect(postMessage).toHaveBeenCalledTimes(2);

    stop();
    jest.advanceTimersByTime(10_000);
    expect(postMessage).toHaveBeenCalledTimes(2);
  });

  test('adds one lightweight renderer and media snapshot every thirty seconds', () => {
    const postMessage = jest.fn();
    (window as any).__ccPerformanceDiagnostics = true;
    (window as any).webkit = { messageHandlers: { consoleLog: { postMessage } } };
    (window as any).STATE = { app: { renderer: {
      resolution: 1.5, width: 585, height: 1266, screen: { width: 390, height: 844 },
    } } };
    document.body.dataset.appZone = 'gameplay';
    document.body.innerHTML = '<canvas></canvas><video></video>';

    const stop = startRuntimeSoakSampler();
    jest.advanceTimersByTime(30_001);
    const samples = postMessage.mock.calls.map(([body]) => JSON.parse(body.message.slice('[CC_SOAK] '.length)));
    const light = samples.find((sample) => sample.sampleMode === 'resources-lite');

    expect(light).toMatchObject({
      route: 'gameplay',
      renderer: { resolution: 1.5, width: 585, height: 1266, screenWidth: 390, screenHeight: 844 },
      pixiCadence: { active: false, maxFPS: 30, activityLeaseCount: 0 },
      media: { images: 0, canvases: 1, videos: 1, playingVideos: 0 },
    });
    expect(getPixiMobileFrameControllerSnapshot).toHaveBeenCalledTimes(1);
    stop();
    delete (window as any).STATE;
    delete document.body.dataset.appZone;
  });

  test('pressure and async completion receipts retain cache evidence without DOM or animation walks', async () => {
    document.body.innerHTML = '<div id="journey-screen"></div>';
    const reads = [
      jest.spyOn(document, 'getElementById'),
      jest.spyOn(document, 'getElementsByTagName'),
      jest.spyOn(document, 'querySelectorAll'),
      jest.spyOn(window, 'getComputedStyle'),
      jest.spyOn(document, 'images', 'get'),
    ];
    const postMessage = jest.fn();
    (window as any).__ccPerformanceDiagnostics = true;
    (window as any).webkit = { messageHandlers: { consoleLog: { postMessage } } };
    const animationRead = jest.fn();
    const gsapRead = jest.fn();
    const cleanupRead = jest.fn();
    const previousAnimations = Object.getOwnPropertyDescriptor(document, 'getAnimations');
    const previousGsap = (window as any).gsap;
    const previousCC = (window as any).CC;
    Object.defineProperty(document, 'getAnimations', { configurable: true, value: animationRead });
    (window as any).gsap = { globalTimeline: { getChildren: gsapRead } };
    (window as any).CC = { getCleanupStats: cleanupRead };
    try {
      (getDecodedGameplayAudioStats as jest.Mock).mockReturnValue({ decodedBytes: 100, activeVoices: 1 });
      emitRuntimeMemoryPressureSnapshot('native-memory-warning:before-cleanup');
      (getDecodedGameplayAudioStats as jest.Mock).mockReturnValue({ decodedBytes: 40, activeVoices: 1 });
      emitRuntimeMemoryPressureSnapshot('native-memory-warning:after-cleanup');
      await Promise.resolve().then(() => emitRuntimeMemoryPressureSnapshot('native-memory-warning:idle-sheets-released'));
      const samples = postMessage.mock.calls.map(([body]) => JSON.parse(body.message.slice('[CC_SOAK] '.length)));
      expect(samples).toHaveLength(3);
      expect(samples.map((sample) => sample.gameplayAudio.decodedBytes)).toEqual([100, 40, 40]);
      samples.forEach((sample) => {
        expect(sample).toMatchObject({ sampleMode: 'cache-only', frameTiming: null, gameplayAudio: { activeVoices: 1 } });
        expect(sample).toHaveProperty('soundtrack');
        expect(sample).toHaveProperty('sharedPixiSheets');
        expect(sample).not.toHaveProperty('dom');
      });
      [...reads, animationRead, gsapRead, cleanupRead].forEach((read) => expect(read).not.toHaveBeenCalled());
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      if (previousAnimations) Object.defineProperty(document, 'getAnimations', previousAnimations);
      else delete (document as any).getAnimations;
      (window as any).gsap = previousGsap;
      (window as any).CC = previousCC;
    }
  });

  test('pressure diagnostics only use full resources on detailed opt-in and do nothing without a bridge', () => {
    const treeRead = jest.spyOn(document, 'getElementsByTagName');
    emitRuntimeMemoryPressureSnapshot('no-bridge');
    expect(treeRead).not.toHaveBeenCalled();
    expect(getDecodedGameplayAudioStats).not.toHaveBeenCalled();
    const postMessage = jest.fn();
    (window as any).__ccDetailedRuntimeDiagnostics = true;
    (window as any).webkit = { messageHandlers: { consoleLog: { postMessage } } };
    emitRuntimeMemoryPressureSnapshot('detailed-pressure');
    const sample = JSON.parse(postMessage.mock.calls[0][0].message.slice('[CC_SOAK] '.length));
    expect(sample.sampleMode).toBe('resources');
    expect(sample).toHaveProperty('dom');
    expect(treeRead).toHaveBeenCalled();
  });

  test('counts a long foreground stall but excludes background and resume gaps', () => {
    const postMessage = jest.fn();
    (window as any).__ccPerformanceDiagnostics = true;
    (window as any).webkit = { messageHandlers: { consoleLog: { postMessage } } };
    let visibility: DocumentVisibilityState = 'visible';
    jest.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
    let frame: FrameRequestCallback = () => {};
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frame = callback;
      return 1;
    });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    let now = 0;
    jest.spyOn(performance, 'now').mockImplementation(() => now);
    const tick = (at: number) => { now = at; frame(-1000); };
    const stop = startRuntimeSoakSampler();
    tick(0);
    tick(16);
    tick(416); // A real, visible 400ms hitch must not disappear from reports.
    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    tick(2000);
    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    tick(4000); // Resume is a new baseline, not a 2-second app frame.
    tick(4016);
    jest.advanceTimersByTime(5001);
    const sample = JSON.parse(postMessage.mock.calls[1][0].message.slice('[CC_SOAK] '.length));
    expect(sample.frameTiming).toEqual({
      samples: 3, averageMs: 144, worstMs: 400,
      over20Ms: 1, over34Ms: 1, over250Ms: 1,
      longFrames: [{ startAtMs: 16, endAtMs: 416, durationMs: 400 }],
      longFrameOverflow: 0,
    });
    expect(sample.sampleMode).toBe('timing-only');
    expect(sample).not.toHaveProperty('gameplayAudio');
    stop();
  });

  test('detailed sampling bounds timestamp records and excludes its own deferred resource walk', () => {
    (window as any).__ccDetailedRuntimeDiagnostics = true;
    const postMessage = jest.fn();
    (window as any).__ccPerformanceDiagnostics = true;
    (window as any).webkit = { messageHandlers: { consoleLog: { postMessage } } };
    let now = 100;
    jest.spyOn(performance, 'now').mockImplementation(() => now);
    let frame: FrameRequestCallback = () => {};
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => { frame = callback; return 1; });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const tick = (at: number) => { now = at; frame(-999); };
    const stop = startRuntimeSoakSampler();
    tick(100);
    for (let index = 1; index <= 30; index++) tick(100 + index * 40);
    expect(postMessage).toHaveBeenCalledTimes(1); // No per-frame logging.
    jest.advanceTimersByTime(5001);
    const read = (index: number) => JSON.parse(postMessage.mock.calls[index][0].message.slice('[CC_SOAK] '.length)).frameTiming;
    const detailed = JSON.parse(postMessage.mock.calls[1][0].message.slice('[CC_SOAK] '.length));
    expect(detailed.sampleMode).toBe('resources');
    expect(detailed).toHaveProperty('gameplayAudio');
    expect(detailed).toHaveProperty('dom');
    const first = read(1);
    expect(first.over34Ms).toBe(30);
    expect(first.longFrames).toHaveLength(24);
    expect(first.longFrameOverflow).toBe(6);
    expect(first.longFrames[0]).toEqual({ startAtMs: 100, endAtMs: 140, durationMs: 40 });
    expect(first.longFrames[23]).toEqual({ startAtMs: 1020, endAtMs: 1060, durationMs: 40 });
    tick(3000); // The profiler's diagnostic walk and next callback are excluded.
    tick(3034); // Exactly 34ms is not a long frame.
    tick(3074);
    window.dispatchEvent(new Event('pagehide'));
    window.dispatchEvent(new Event('pageshow'));
    tick(4000); // Lifecycle gap starts a new baseline.
    tick(4016);
    jest.advanceTimersByTime(5000);
    expect(read(2)).toMatchObject({
      samples: 3, over34Ms: 1, longFrameOverflow: 0,
      longFrames: [{ startAtMs: 3034, endAtMs: 3074, durationMs: 40 }],
    });
    stop();
  });

  test('timing-only capture avoids resource reads and retains stalls across periodic emission', () => {
    document.body.innerHTML = '<div id="journey-screen"></div>';
    const elementRead = jest.spyOn(document, 'getElementById');
    const treeRead = jest.spyOn(document, 'getElementsByTagName');
    const canvasRead = jest.spyOn(document, 'querySelectorAll');
    const styleRead = jest.spyOn(window, 'getComputedStyle');
    const imageRead = jest.spyOn(document, 'images', 'get');
    const animationRead = jest.fn();
    Object.defineProperty(document, 'getAnimations', { configurable: true, value: animationRead });
    const gsapRead = jest.fn();
    const cleanupRead = jest.fn();
    (window as any).gsap = { globalTimeline: { getChildren: gsapRead } };
    (window as any).CC = { getCleanupStats: cleanupRead };
    const postMessage = jest.fn();
    (window as any).__ccPerformanceDiagnostics = true;
    (window as any).webkit = { messageHandlers: { consoleLog: { postMessage } } };
    let now = 0;
    jest.spyOn(performance, 'now').mockImplementation(() => now);
    let frame: FrameRequestCallback = () => {};
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => { frame = callback; return 1; });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const tick = (at: number) => { now = at; frame(-1); };
    const stop = startRuntimeSoakSampler();
    tick(0); tick(16);
    jest.advanceTimersByTime(5001);
    tick(416); // Must count the 400ms interval straddling summary emission.
    tick(432);
    jest.advanceTimersByTime(5000);
    const sample = JSON.parse(postMessage.mock.calls[2][0].message.slice('[CC_SOAK] '.length));
    expect(sample).toMatchObject({ sampleMode: 'timing-only', frameTiming: {
      samples: 2, over250Ms: 1,
      longFrames: [{ startAtMs: 16, endAtMs: 416, durationMs: 400 }],
    } });
    expect(Object.keys(sample).sort()).toEqual(['at', 'frameTiming', 'reason', 'sampleMode', 'visibility']);
    [elementRead, treeRead, canvasRead, styleRead, imageRead, animationRead, gsapRead, cleanupRead,
      getSoundtrackRuntimeStats, getSharedPixiSheetCacheStats, getDecodedGameplayAudioStats,
    ].forEach((read) => expect(read).not.toHaveBeenCalled());
    stop();
    delete (document as any).getAnimations;
    delete (window as any).gsap;
    delete (window as any).CC;
  });

  test('replacing the sampler releases lifecycle listeners and pending work', () => {
    (window as any).__ccPerformanceDiagnostics = true;
    const removeDocument = jest.spyOn(document, 'removeEventListener');
    const removeWindow = jest.spyOn(window, 'removeEventListener');
    startRuntimeSoakSampler();
    const stop = startRuntimeSoakSampler();
    expect(removeDocument).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(removeWindow).toHaveBeenCalledWith('pagehide', expect.any(Function));
    expect(removeWindow).toHaveBeenCalledWith('pageshow', expect.any(Function));
    stop();
    expect(jest.getTimerCount()).toBe(0);
  });

  test('cancels a pending deferred resource sample on stop', () => {
    const postMessage = jest.fn();
    (window as any).__ccPerformanceDiagnostics = true;
    (window as any).webkit = { messageHandlers: { consoleLog: { postMessage } } };

    const stop = startRuntimeSoakSampler();
    jest.advanceTimersByTime(5_000);
    stop();
    jest.advanceTimersByTime(10);

    expect(postMessage).toHaveBeenCalledTimes(1);
  });
});
