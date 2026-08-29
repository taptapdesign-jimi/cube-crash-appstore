import { emitRuntimeResourceSnapshot, startRuntimeSoakSampler } from '../runtime-soak-sampler';

describe('runtime soak sampler', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    delete (window as any).__ccPerformanceDiagnostics;
    delete (window as any).__ccRuntimeSoakSamplerStop;
    delete (window as any).webkit;
  });

  afterEach(() => {
    (window as any).__ccRuntimeSoakSamplerStop?.();
    jest.useRealTimers();
  });

  test('does no work in a normal build', () => {
    const postMessage = jest.fn();
    (window as any).webkit = { messageHandlers: { consoleLog: { postMessage } } };

    startRuntimeSoakSampler();
    jest.advanceTimersByTime(30_000);

    expect(postMessage).not.toHaveBeenCalled();
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
