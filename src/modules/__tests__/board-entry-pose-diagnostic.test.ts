import { startBoardEntryPoseDiagnostic } from '../../utils/board-entry-pose-diagnostic';

describe('bounded board pose capture', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { delete (window as any).__ccPerformanceDiagnostics; jest.useRealTimers(); });
  test('ordinary gameplay adds no diagnostic scheduling', () => {
    const stop = startBoardEntryPoseDiagnostic([]);
    stop();
    expect(jest.getTimerCount()).toBe(0);
  });
  test('stops all frame work at its deadline even without a completion callback', () => {
    (window as any).__ccPerformanceDiagnostics = true;
    startBoardEntryPoseDiagnostic([]);
    jest.advanceTimersByTime(4100);
    expect(jest.getTimerCount()).toBe(0);
  });
  test('idempotent completion preserves only the bounded observation tail', () => {
    (window as any).__ccPerformanceDiagnostics = true;
    const stop = startBoardEntryPoseDiagnostic([]);
    jest.advanceTimersByTime(100);
    stop(); stop();
    jest.advanceTimersByTime(1000);
    expect(jest.getTimerCount()).toBe(0);
  });
});
