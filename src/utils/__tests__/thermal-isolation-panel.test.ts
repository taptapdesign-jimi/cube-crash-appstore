import { installThermalIsolationPanel } from '../thermal-isolation-panel';
import { isThermalWorkSuppressed } from '../thermal-isolation';

jest.mock('../../modules/app-state', () => ({ STATE: { app: null, stage: null, tiles: [], level: 1, score: 0, moves: 0, busyEnding: false } }));
jest.mock('../../modules/shared-pixi-sheet-animation', () => ({ getSharedPixiSheetCacheStats: () => ({ activeRefs: 0 }) }));

test('actual panel sends all ABBA records in the native console bridge envelope', () => {
  jest.useFakeTimers();
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  const decoded: Array<Record<string, unknown>> = [];
  // Mirror the real Swift consoleLog receiver: a string body loses its message.
  const postMessage = jest.fn((body: unknown) => {
    const envelope = body as { level?: string; message?: string };
    expect(envelope.level).toBe('info');
    expect(envelope.message).toMatch(/^\[CC_THERMAL_ISOLATION\] /);
    decoded.push(JSON.parse(envelope.message!.split('[CC_THERMAL_ISOLATION] ')[1]));
  });
  const prior = Object.getOwnPropertyDescriptor(window, 'webkit');
  Object.defineProperty(window, 'webkit', { configurable: true, value: { messageHandlers: { consoleLog: { postMessage } } } });
  try {
    installThermalIsolationPanel();
    document.querySelector<HTMLButtonElement>('#cc-thermal-isolation button')!.click();
    jest.advanceTimersByTime(30000);
    expect(isThermalWorkSuppressed('ambient')).toBe(true);
    jest.advanceTimersByTime(75000);
    expect(decoded.filter(row => row.event === 'measure-start')).toHaveLength(4);
    expect(decoded.filter(row => row.event === 'measure-end')).toHaveLength(4);
    expect(decoded[decoded.length - 1]).toMatchObject({ event: 'stop', complete: true });
    expect(isThermalWorkSuppressed('ambient')).toBe(false);
  } finally {
    window.dispatchEvent(new Event('pointerdown'));
    document.getElementById('cc-thermal-isolation')?.remove();
    if (prior) Object.defineProperty(window, 'webkit', prior);
    else Reflect.deleteProperty(window, 'webkit');
    jest.useRealTimers();
  }
});
