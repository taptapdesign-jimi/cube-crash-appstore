/** @jest-environment jsdom */
import { beginTransitionPerformance } from '../transition-performance';

describe('opt-in transition performance capture', () => {
  let frames: Map<number, FrameRequestCallback>;
  let now: number;
  let postMessage: jest.Mock;
  beforeEach(() => {
    jest.useFakeTimers();
    frames = new Map();
    now = 100;
    let next = 0;
    jest.spyOn(performance, 'now').mockImplementation(() => now);
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => { frames.set(++next, callback); return next; });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => { frames.delete(id); });
    postMessage = jest.fn();
    (window as any).webkit = { messageHandlers: { consoleLog: { postMessage } } };
    (window as any).__ccPerformanceDiagnostics = true;
  });
  afterEach(() => {
    jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks();
    delete (window as any).__ccPerformanceDiagnostics;
    delete (window as any).webkit;
  });
  function frame(at: number) {
    now = at;
    const pending = [...frames.values()]; frames.clear();
    pending.forEach((callback) => callback(at));
  }
  test('ordinary play executes work without timers, frames or logs', () => {
    (window as any).__ccPerformanceDiagnostics = false;
    const capture = beginTransitionPerformance('disabled');
    expect(capture.phase('work', () => 42)).toBe(42);
    capture.finish();
    expect(frames.size).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
    expect(postMessage).not.toHaveBeenCalled();
  });
  test('captures bounded stall positions and synchronous work, then releases all work once', () => {
    const capture = beginTransitionPerformance('journey');
    capture.phase('render', () => { now += 45; });
    frame(160); frame(177);
    capture.finish(); capture.finish('duplicate');
    expect(frames.size).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
    expect(postMessage).toHaveBeenCalledTimes(1);
    const summary = JSON.parse(postMessage.mock.calls[0][0].message.split('journey ')[1]);
    expect(summary.phases).toEqual([{ name: 'render', atMs: 0, durationMs: 45 }]);
    expect(summary.stalls).toEqual([{ atMs: 60, durationMs: 60 }]);
    expect(summary.frames).toBe(2);
  });
  test('abandoned captures expire and thrown work preserves the original error', () => {
    const capture = beginTransitionPerformance('interrupted');
    expect(() => capture.phase('throws', () => { throw new Error('original'); })).toThrow('original');
    jest.advanceTimersByTime(5000);
    expect(frames.size).toBe(0);
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage.mock.calls[0][0].message).toContain('"reason":"timeout"');
  });
  test('a RAF frame timestamp older than capture start cannot inflate the next gap', () => {
    const capture = beginTransitionPerformance('same-frame');
    now = 105;
    const callback = [...frames.values()][0]; frames.clear();
    callback(70);
    frame(122);
    capture.finish();
    const summary = JSON.parse(postMessage.mock.calls[0][0].message.split('same-frame ')[1]);
    expect(summary.worstMs).toBe(17);
    expect(summary.over34Ms).toBe(0);
  });
  test('milestones share the callback clock and stop recording after completion', () => {
    const capture = beginTransitionPerformance('cascade');
    now = 200;
    capture.mark('images-ready');
    frame(240);
    now = 500;
    capture.mark('last-target-complete');
    capture.finish();
    capture.mark('obsolete');
    const summary = JSON.parse(postMessage.mock.calls[0][0].message.split('cascade ')[1]);
    expect(summary.phases).toEqual([
      { name: 'images-ready', atMs: 100, durationMs: 0 },
      { name: 'last-target-complete', atMs: 400, durationMs: 0 },
    ]);
    expect(summary.durationMs).toBe(400);
    expect(frames.size).toBe(0);
  });

});
