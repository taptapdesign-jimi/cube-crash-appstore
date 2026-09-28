import { gsap } from 'gsap';
import { holdThermalWebAnimations } from '../thermal-isolation-panel';
import { startJourneyUnpluggedThermalTest, unpluggedThermalInvalidReason } from '../journey-unplugged-thermal-test';
import { isThermalWorkSuppressed } from '../thermal-isolation';

describe('unplugged static / animated diagnostic', () => {
  let stop: (() => void) | null;
  let sample: any;
  const owner = {
    getStationaryThermalScene: () => ({ ready: true, key: 'forest:1' }),
    suspendInterimForThermalTest: jest.fn(() => jest.fn()),
  };
  const animations: any[] = [];
  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.body.innerHTML = '<div id="journey-boards-container"></div>';
    Object.defineProperty(document, 'getAnimations', { configurable: true, value: () => animations });
    sample = { batteryState: 1, brightnessPercent: 55, thermalState: 'nominal', persistenceAvailable: true };
    Object.defineProperty(window, '__ccNativeThermalSample', { configurable: true, get: () => ({ wall: Date.now(), ...sample }) });
    owner.suspendInterimForThermalTest.mockReset().mockImplementation(() => jest.fn());
    gsap.globalTimeline.resume();
  });
  afterEach(() => { stop?.(); stop = null; gsap.globalTimeline.resume(); gsap.ticker.sleep(); animations.length = 0; jest.useRealTimers(); });
  test('rejects cable, stale telemetry, warm start and failed persistence', () => {
    expect(unpluggedThermalInvalidReason(undefined)).toBe('native-sample-missing');
    expect(unpluggedThermalInvalidReason({ ...sample, wall: Date.now() - 13000 })).toBe('native-sample-missing');
    expect(unpluggedThermalInvalidReason({ ...sample, wall: Date.now(), batteryState: 2 })).toBe('unplug-cable');
    expect(unpluggedThermalInvalidReason({ ...sample, wall: Date.now(), thermalState: 'fair' }, undefined, true)).toBe('cool-to-nominal');
    expect(unpluggedThermalInvalidReason({ ...sample, wall: Date.now(), persistenceAvailable: false })).toBe('recording-unavailable');
  });
  test('holds known visual owners in outer windows and restores them for six-minute animated middle', () => {
    const emit = jest.fn(); const onStop = jest.fn();
    stop = startJourneyUnpluggedThermalTest({ enabled: true, owner, holdWebAnimations: () => holdThermalWebAnimations(false), emit, onStop });
    expect(stop).not.toBeNull();
    jest.advanceTimersByTime(5000);
    expect(gsap.globalTimeline.paused()).toBe(true);
    expect(isThermalWorkSuppressed('ambient')).toBe(true);
    expect(isThermalWorkSuppressed('journey-units')).toBe(true);
    jest.advanceTimersByTime(180000);
    expect(gsap.globalTimeline.paused()).toBe(false);
    expect(isThermalWorkSuppressed('ambient')).toBe(false);
    jest.advanceTimersByTime(360000);
    expect(gsap.globalTimeline.paused()).toBe(true);
    jest.advanceTimersByTime(180000);
    expect(gsap.globalTimeline.paused()).toBe(false);
    expect(onStop).toHaveBeenCalledWith('complete');
    const windows = emit.mock.calls.map(([event]) => event).filter(event => event.event === 'measure-end');
    expect(windows.map(event => event.suppressed)).toEqual([true, false, false, true]);
    expect(windows.filter(event => event.suppressed).every(event => event.staticSampledVerified)).toBe(true);
    expect(owner.suspendInterimForThermalTest).toHaveBeenCalledTimes(2);
    owner.suspendInterimForThermalTest.mock.results.forEach(result => expect(result.value).toHaveBeenCalledTimes(1));
  });
  test.each(['unplug-cable', 'thermal-stop', 'brightness-changed'])('cancels and restores on %s', reason => {
    const onStop = jest.fn();
    stop = startJourneyUnpluggedThermalTest({ enabled: true, owner, holdWebAnimations: () => holdThermalWebAnimations(false), emit: jest.fn(), onStop });
    jest.advanceTimersByTime(5000);
    if (reason === 'unplug-cable') sample.batteryState = 2;
    if (reason === 'thermal-stop') sample.thermalState = 'serious';
    if (reason === 'brightness-changed') sample.brightnessPercent = 45;
    jest.advanceTimersByTime(1000);
    expect(onStop).toHaveBeenCalledWith(reason);
    expect(gsap.globalTimeline.paused()).toBe(false);
    expect(isThermalWorkSuppressed('ambient')).toBe(false);
  });
  test('input restores a paused CSS owner before normal event handlers', () => {
    const animation: any = { playState: 'running', effect: { target: document.body }, pause() { this.playState = 'paused'; }, play() { this.playState = 'running'; } };
    animations.push(animation);
    const onStop = jest.fn();
    stop = startJourneyUnpluggedThermalTest({ enabled: true, owner, holdWebAnimations: () => holdThermalWebAnimations(false), emit: jest.fn(), onStop });
    jest.advanceTimersByTime(5000);
    expect(animation.playState).toBe('paused');
    window.dispatchEvent(new Event('pointerdown'));
    expect(animation.playState).toBe('running');
    expect(onStop).toHaveBeenCalledWith('input');
  });
  test('unexpected DOM writes invalidate the static measurement', () => {
    const emit = jest.fn();
    stop = startJourneyUnpluggedThermalTest({ enabled: true, owner, holdWebAnimations: () => holdThermalWebAnimations(false), emit, onStop: jest.fn() });
    jest.advanceTimersByTime(20000);
    document.getElementById('journey-boards-container')!.style.transform = 'translateX(2px)';
    jest.advanceTimersByTime(165000);
    expect(emit.mock.calls.map(([event]) => event).find(event => event.event === 'measure-end')).toEqual(expect.objectContaining({ staticSampledVerified: false }));
  });
});
