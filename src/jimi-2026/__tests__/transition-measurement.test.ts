import { measureTransition } from '../transition-measurement';
import { emitNativeConsoleDiagnostic } from '../../utils/ios-native-diagnostic';

jest.mock('../../utils/ios-native-diagnostic', () => ({ emitNativeConsoleDiagnostic: jest.fn() }));

describe('Jimi transition measurement ownership', () => {
  let now: number;
  let nextFrame: number;
  let frames: Map<number, FrameRequestCallback>;
  let requestFrame: jest.SpyInstance;
  let cancelFrame: jest.SpyInstance;
  let readClock: jest.SpyInstance;
  const emit = emitNativeConsoleDiagnostic as jest.MockedFunction<typeof emitNativeConsoleDiagnostic>;

  const frameAt = (monotonicNow: number, rafTimestamp: number) => {
    expect(frames.size).toBe(1);
    const [id, callback] = [...frames.entries()][0];
    frames.delete(id);
    now = monotonicNow;
    callback(rafTimestamp);
  };

  beforeEach(() => {
    now = 100;
    nextFrame = 0;
    frames = new Map();
    readClock = jest.spyOn(performance, 'now').mockImplementation(() => now);
    requestFrame = jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      const id = ++nextFrame;
      frames.set(id, callback);
      return id;
    });
    cancelFrame = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id); });
    emit.mockClear();
  });

  afterEach(() => {
    requestFrame.mockRestore();
    cancelFrame.mockRestore();
    readClock.mockRestore();
  });

  it('does not allocate a RAF or read clocks or emit diagnostics when disabled', () => {
    const finish = measureTransition('home', false);
    finish('shown');
    finish('cancelled');
    expect(requestFrame).not.toHaveBeenCalled();
    expect(cancelFrame).not.toHaveBeenCalled();
    expect(readClock).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('uses performance.now consistently, not the RAF timestamp, and emits through the shared native diagnostic', () => {
    const finish = measureTransition('beach', true);
    frameAt(117, 500_000);
    frameAt(141, -7);
    frameAt(181.26, 0);
    now = 195;
    finish('shown');
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('[JIMI_TRANSITION]', 'beach', {
      result: 'shown',
      elapsedMs: 95,
      commitTailMs: 13.7,
      worstIntervalMs: 40.3,
      over34Ms: 1,
      samples: 3,
      metric: 'RAF interval, not GPU presented FPS',
    });
    expect(frames.size).toBe(0);
    expect(cancelFrame).toHaveBeenCalledTimes(1);
  });

  it.each(['shown', 'cancelled', 'failed', 'disposed', 'superseded'])(
    'keeps one scheduled frame, then cancels it on %s and ignores any late callback',
    result => {
      const finish = measureTransition('hub', true);
      expect(frames.size).toBe(1);
      frameAt(116, 116);
      expect(frames.size).toBe(1);
      const [lastId, lateCallback] = [...frames.entries()][0];
      const requestCount = requestFrame.mock.calls.length;
      now = 120;
      finish(result);
      expect(cancelFrame).toHaveBeenCalledWith(lastId);
      expect(frames.size).toBe(0);
      now = 500;
      lateCallback(500);
      expect(requestFrame).toHaveBeenCalledTimes(requestCount);
      expect(emit).toHaveBeenCalledTimes(1);
      expect(emit.mock.calls[0][2]).toMatchObject({ result, samples: 1, elapsedMs: 20 });
    },
  );

  it('reports a long unsampled commit tail separately without inventing a RAF stall or extra callback', () => {
    const finish = measureTransition('beach', true);
    frameAt(116, 116);
    const requested = requestFrame.mock.calls.length;
    now = 166;
    finish('shown');
    expect(emit).toHaveBeenCalledWith('[JIMI_TRANSITION]', 'beach', {
      result: 'shown', elapsedMs: 66, commitTailMs: 50,
      worstIntervalMs: 16, over34Ms: 0, samples: 1,
      metric: 'RAF interval, not GPU presented FPS',
    });
    expect(requestFrame).toHaveBeenCalledTimes(requested);
    expect(frames.size).toBe(0);
  });

  it('finishes safely before its first frame and makes duplicate finish calls completely silent', () => {
    const finish = measureTransition('home', true);
    now = 102;
    finish('cancelled');
    expect(emit).toHaveBeenCalledWith('[JIMI_TRANSITION]', 'home', expect.objectContaining({
      result: 'cancelled', elapsedMs: 2, commitTailMs: 2, samples: 0, worstIntervalMs: 0, over34Ms: 0,
    }));
    const clockReads = readClock.mock.calls.length;
    const cancels = cancelFrame.mock.calls.length;
    finish('shown');
    finish('disposed');
    expect(emit).toHaveBeenCalledTimes(1);
    expect(readClock).toHaveBeenCalledTimes(clockReads);
    expect(cancelFrame).toHaveBeenCalledTimes(cancels);
    expect(frames.size).toBe(0);
  });

  it('does not accumulate scheduled frames across repeated cancelled and completed measurements', () => {
    for (let index = 0; index < 50; index++) {
      const finish = measureTransition(index % 2 ? 'home' : 'hub', true);
      expect(frames.size).toBe(1);
      frameAt(now + 16, 0);
      finish(index % 2 ? 'shown' : 'cancelled');
      expect(frames.size).toBe(0);
    }
    expect(emit).toHaveBeenCalledTimes(50);
    expect(cancelFrame).toHaveBeenCalledTimes(50);
  });

  it('passes the same bounded receipt through the real shared native console bridge', () => {
    const originalWebkit = Object.getOwnPropertyDescriptor(window, 'webkit');
    const postMessage = jest.fn();
    Object.defineProperty(window, 'webkit', {
      configurable: true,
      value: { messageHandlers: { consoleLog: { postMessage } } },
    });
    emit.mockImplementationOnce(jest.requireActual('../../utils/ios-native-diagnostic').emitNativeConsoleDiagnostic);
    try {
      const finish = measureTransition('home', true);
      frameAt(116, 987_000);
      now = 120;
      finish('cancelled');
      expect(postMessage).toHaveBeenCalledTimes(1);
      const receipt = postMessage.mock.calls[0][0];
      expect(receipt.level).toBe('info');
      expect(receipt.message).toMatch(/^\[JIMI_TRANSITION\] home /);
      expect(JSON.parse(receipt.message.slice(receipt.message.indexOf('{')))).toEqual({
        at: 120, result: 'cancelled', elapsedMs: 20, commitTailMs: 4, worstIntervalMs: 16,
        over34Ms: 0, samples: 1, metric: 'RAF interval, not GPU presented FPS',
      });
      expect(frames.size).toBe(0);
    } finally {
      if (originalWebkit) Object.defineProperty(window, 'webkit', originalWebkit);
      else delete (window as any).webkit;
    }
  });
});
