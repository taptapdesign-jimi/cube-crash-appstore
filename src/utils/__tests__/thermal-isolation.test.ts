import { isThermalWorkSuppressed, startThermalIsolation } from '../thermal-isolation';

describe('stationary thermal isolation', () => {
  let stop: (() => void) | null;
  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  });
  afterEach(() => { stop?.(); stop = null; jest.useRealTimers(); });
  const options = () => ({
    enabled: true, group: 'ambient' as const, fingerprint: () => 'same-board',
    suppress: jest.fn(() => jest.fn()), emit: jest.fn(), onStop: jest.fn(),
  });
  test('disabled has no timers or changed owner behavior', () => {
    const config = options(); config.enabled = false;
    stop = startThermalIsolation(config);
    expect(stop).toBeNull(); expect(jest.getTimerCount()).toBe(0);
    expect(isThermalWorkSuppressed('ambient')).toBe(false);
  });
  test('ABBA measures the same owner, restores once and completes without leftover timers', () => {
    const config = options(); stop = startThermalIsolation(config);
    jest.advanceTimersByTime(5000);
    expect(isThermalWorkSuppressed('ambient')).toBe(false);
    jest.advanceTimersByTime(25000);
    expect(isThermalWorkSuppressed('ambient')).toBe(true);
    expect(isThermalWorkSuppressed('sheets')).toBe(false);
    jest.advanceTimersByTime(25000);
    expect(isThermalWorkSuppressed('ambient')).toBe(true);
    expect(config.suppress).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(25000);
    expect(isThermalWorkSuppressed('ambient')).toBe(false);
    expect(config.suppress.mock.results[0].value).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(25000);
    expect(config.emit).toHaveBeenLastCalledWith(expect.objectContaining({ event: 'stop', complete: true }));
    expect(config.emit.mock.calls.filter(([row]) => row.event === 'measure-end')).toHaveLength(4);
    expect(jest.getTimerCount()).toBe(0);
  });
  test.each(['pointerdown', 'touchstart', 'wheel', 'keydown', 'pagehide', 'blur', 'resize'])('%s restores before gameplay handles input', name => {
    const config = options(); stop = startThermalIsolation(config);
    jest.advanceTimersByTime(30000);
    expect(isThermalWorkSuppressed('ambient')).toBe(true);
    window.dispatchEvent(new Event(name));
    expect(isThermalWorkSuppressed('ambient')).toBe(false);
    expect(config.suppress.mock.results[0].value).toHaveBeenCalledTimes(1);
    expect(config.emit).toHaveBeenLastCalledWith(expect.objectContaining({ reason: 'input', complete: false }));
    expect(jest.getTimerCount()).toBe(0);
  });
  test('scene mutation or background cancels instead of comparing different boards', () => {
    const config = options(); let scene = 'a'; config.fingerprint = () => scene;
    stop = startThermalIsolation(config); jest.advanceTimersByTime(30000);
    scene = 'b'; jest.advanceTimersByTime(1000);
    expect(isThermalWorkSuppressed('ambient')).toBe(false);
    expect(config.emit).toHaveBeenLastCalledWith(expect.objectContaining({ reason: 'scene-changed' }));
    stop = startThermalIsolation(options()); jest.advanceTimersByTime(30000);
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(isThermalWorkSuppressed('ambient')).toBe(false); expect(jest.getTimerCount()).toBe(0);
  });
  test('replacement retires previous owner and failed suppression fails open to normal game', () => {
    const first = options(); stop = startThermalIsolation(first); jest.advanceTimersByTime(30000);
    const second = options(); second.suppress.mockImplementation(() => { throw new Error('unsupported'); });
    stop = startThermalIsolation(second);
    expect(first.suppress.mock.results[0].value).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(30000);
    expect(isThermalWorkSuppressed('ambient')).toBe(false);
    expect(second.emit).toHaveBeenLastCalledWith(expect.objectContaining({ reason: 'suppression-error' }));
    expect(jest.getTimerCount()).toBe(0);
  });
});
