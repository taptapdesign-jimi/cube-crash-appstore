import { startJourneyThermalAudit } from '../journey-thermal-audit';
import { isThermalWorkSuppressed } from '../thermal-isolation';

describe('stationary World attribution sequence', () => {
  let stop: (() => void) | null = null;
  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  });
  afterEach(() => { stop?.(); stop = null; jest.useRealTimers(); });
  const fixture = () => ({
    enabled: true,
    owner: {
      getStationaryThermalScene: jest.fn(() => ({ ready: true, key: 'forest-same-position' })),
      suspendInterimForThermalTest: jest.fn(() => jest.fn()),
    },
    emit: jest.fn(), onStop: jest.fn(),
  });
  test('runs three ABBA groups, restores interim once and leaves no timers', () => {
    const config = fixture(); stop = startJourneyThermalAudit(config);
    jest.advanceTimersByTime(315000);
    const samples = config.emit.mock.calls.map(([row]) => row).filter(row => row.event === 'measure-end');
    expect(samples).toHaveLength(12);
    expect(samples.map(row => row.group)).toEqual([
      ...Array(4).fill('ambient'), ...Array(4).fill('journey-units'), ...Array(4).fill('journey-interim'),
    ]);
    expect(samples.map(row => row.suppressed)).toEqual(Array(3).fill([false, true, true, false]).flat());
    expect(config.owner.suspendInterimForThermalTest).toHaveBeenCalledTimes(1);
    expect(config.owner.suspendInterimForThermalTest.mock.results[0].value).toHaveBeenCalledTimes(1);
    expect(config.onStop).toHaveBeenCalledWith('complete');
    expect(jest.getTimerCount()).toBe(0);
  });
  test('touch cancels the whole sequence and restores interim before navigation', () => {
    const config = fixture(); stop = startJourneyThermalAudit(config);
    jest.advanceTimersByTime(240000);
    window.dispatchEvent(new Event('pointerdown'));
    expect(config.onStop).toHaveBeenCalledWith('input');
    expect(config.owner.suspendInterimForThermalTest.mock.results[0].value).toHaveBeenCalledTimes(1);
    expect(isThermalWorkSuppressed('journey-interim')).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });
  test('rejects an unsettled scene and stops if the World or scroll position changes', () => {
    const config = fixture(); config.owner.getStationaryThermalScene.mockReturnValue({ ready: false, key: 'bad' });
    expect(startJourneyThermalAudit(config)).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
    config.owner.getStationaryThermalScene.mockReturnValue({ ready: true, key: 'one' });
    stop = startJourneyThermalAudit(config);
    config.owner.getStationaryThermalScene.mockReturnValue({ ready: true, key: 'two' });
    jest.advanceTimersByTime(1000);
    expect(config.onStop).toHaveBeenCalledWith('scene-changed');
    expect(jest.getTimerCount()).toBe(0);
  });
});
