import { installThermalIsolationPanel } from '../thermal-isolation-panel';
import { isThermalWorkSuppressed } from '../thermal-isolation';
import { isThermalAudioSuppressed, resetThermalAudioIsolationForTests } from '../thermal-audio-isolation';
import { gsap } from 'gsap';
import { Container } from 'pixi.js';
import { getJourneyScreenOwnerDiagnostics } from '../journey-screen-owner-diagnostics';

jest.mock('../../modules/app-state', () => ({ STATE: { app: null, stage: null, tiles: [], level: 1, score: 0, moves: 0, busyEnding: false } }));
jest.mock('../../modules/shared-pixi-sheet-animation', () => ({ getSharedPixiSheetCacheStats: () => ({ activeRefs: 0 }) }));
jest.mock('../../modules/soundtrack-manager', () => ({ getSoundtrackRuntimeStats: () => ({ activeVoices: 0 }) }));
jest.mock('../../modules/main-theme-web-audio-transport', () => ({ getSoundtrackPreparationStats: () => ({ pendingLoads: 0, pendingDecodes: 0 }) }));
jest.mock('../../modules/gameplay-audio-buffer-player', () => ({ getDecodedGameplayAudioStats: () => ({ activeVoices: 0 }) }));

test('actual panel sends all ABBA records in the native console bridge envelope', () => {
  jest.useFakeTimers();
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  const decoded: Array<Record<string, unknown>> = [];
  // Mirror the real Swift consoleLog receiver: a string body loses its message.
  const postMessage = jest.fn((body: unknown) => {
    const envelope = body as { level?: string; message?: string };
    expect(envelope.level).toBe('info');
    expect(envelope.message).toMatch(/^\[CC_THERMAL_(ISOLATION|AUDIO)\] /);
    if (envelope.message!.startsWith('[CC_THERMAL_ISOLATION] ')) {
      decoded.push(JSON.parse(envelope.message!.split('[CC_THERMAL_ISOLATION] ')[1]));
    }
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

test('natural-play audio isolation survives touches and reads counters without adding a polling timer', () => {
  jest.useFakeTimers();
  (window as any).__ccThermalIsolation = true;
  const priorSettings = { musicEnabled: true, gameSoundsEnabled: true };
  (window as any)._settings = priorSettings;
  const info = jest.spyOn(console, 'info').mockImplementation(() => {});
  try {
    installThermalIsolationPanel();
    const toggle = document.querySelector<HTMLButtonElement>('[data-thermal-audio-toggle]')!;
    const read = document.querySelector<HTMLButtonElement>('[data-thermal-audio-read]')!;
    const baselineTimers = jest.getTimerCount();
    toggle.click();
    window.dispatchEvent(new Event('pointerdown'));
    window.dispatchEvent(new Event('touchend'));
    expect(isThermalAudioSuppressed()).toBe(true);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    read.click();
    expect(document.querySelector('[data-thermal-audio-status]')!.textContent).toContain('pending loads 0');
    expect(jest.getTimerCount()).toBe(baselineTimers);
    expect((window as any)._settings).toBe(priorSettings);
    toggle.click();
    expect(isThermalAudioSuppressed()).toBe(false);
  } finally {
    resetThermalAudioIsolationForTests();
    delete (window as any).__ccThermalIsolation; delete (window as any)._settings;
    document.getElementById('cc-thermal-isolation')?.remove(); info.mockRestore(); jest.useRealTimers();
  }
});

test('natural-play overlay can be fully removed from hit testing after setup', () => {
  const info = jest.spyOn(console, 'info').mockImplementation(() => {});
  try {
    installThermalIsolationPanel();
    const panel = document.getElementById('cc-thermal-isolation')!;
    document.querySelector<HTMLButtonElement>('[data-thermal-panel-hide]')!.click();
    expect(panel.hidden).toBe(true);
    expect(panel.getAttribute('aria-hidden')).toBe('true');
    expect(info).toHaveBeenCalledWith(expect.stringContaining('"event":"overlay-hidden"'));
  } finally {
    document.getElementById('cc-thermal-isolation')?.remove();
    info.mockRestore();
  }
});

describe('GSAP visual owner isolation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'info').mockImplementation(() => {});
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.body.innerHTML = '<div id="journey-screen"><div class="one"></div><div class="two"></div></div>';
    (window as any).gsap = gsap;
    gsap.globalTimeline.clear();
  });

  afterEach(() => {
    window.dispatchEvent(new Event('pointerdown'));
    gsap.globalTimeline.clear();
    gsap.ticker.sleep();
    document.body.innerHTML = '';
    delete (window as any).gsap;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  const suppress = () => {
    gsap.ticker.sleep();
    installThermalIsolationPanel();
    document.querySelector<HTMLSelectElement>('#cc-thermal-isolation select')!.value = 'gsap-idle';
    document.querySelector<HTMLButtonElement>('#cc-thermal-isolation button')!.click();
    jest.advanceTimersByTime(30_000);
    expect(isThermalWorkSuppressed('gsap-idle')).toBe(true);
  };

  test('pauses repeating timelines with finite children and leaves no running repeating Journey owner', () => {
    const timeline = gsap.timeline({ repeat: -1 }).to('.one', { x: 4, duration: 1 }).totalTime(0.25);
    const tween = gsap.to('.two', { x: 4, duration: 1, repeat: -1 }).totalTime(0.25);
    const previouslyPaused = gsap.timeline({ repeat: -1, paused: true }).to('.one', { y: 4, duration: 1 });
    const nonVisual = gsap.to({ amount: 0 }, { amount: 1, duration: 1, repeat: -1 }).totalTime(0.25);
    expect(getJourneyScreenOwnerDiagnostics().gsap).toMatchObject({ runningInfiniteTweens: 1, runningInfiniteTimelines: 1 });

    suppress();

    expect(timeline.paused()).toBe(true);
    expect(tween.paused()).toBe(true);
    expect(nonVisual.paused()).toBe(false);
    expect(getJourneyScreenOwnerDiagnostics().gsap).toMatchObject({ runningInfiniteTweens: 0, runningInfiniteTimelines: 0 });
    const heldTime = timeline.totalTime();
    window.dispatchEvent(new Event('pointerdown'));
    expect(timeline.paused()).toBe(false);
    expect(tween.paused()).toBe(false);
    expect(timeline.totalTime()).toBe(heldTime);
    expect(previouslyPaused.paused()).toBe(true);
  });

  test('does not revive owners whose ancestor was killed or whose targets were detached or replaced', () => {
    const outer = gsap.timeline();
    const nested = gsap.timeline({ repeat: -1 }).to('.one', { x: 2, duration: 1 });
    outer.add(nested).totalTime(0.25);
    const detached = gsap.to('.two', { x: 2, duration: 1, repeat: -1 }).totalTime(0.25);
    const replaced = gsap.timeline({ repeat: -1 }).to('.one', { y: 2, duration: 1 }).totalTime(0.25);
    suppress();
    expect(nested.paused()).toBe(true);
    expect(detached.paused()).toBe(true);
    expect(replaced.paused()).toBe(true);
    const resumes = [nested, detached, replaced].map(owner => jest.spyOn(owner, 'resume'));
    outer.kill();
    document.querySelector('.two')!.remove();
    replaced.clear().to('#journey-screen', { y: 3, duration: 1 });

    window.dispatchEvent(new Event('pointerdown'));

    resumes.forEach(resume => expect(resume).not.toHaveBeenCalled());
  });

  test('resumes only retained Pixi targets and skips a reparented target', () => {
    const parent = new Container();
    const successorParent = new Container();
    const retained = parent.addChild(new Container());
    const reparented = parent.addChild(new Container());
    const keep = gsap.timeline({ repeat: -1 }).to(retained, { x: 2, duration: 1 }).totalTime(0.25);
    const stale = gsap.timeline({ repeat: -1 }).to(reparented, { x: 2, duration: 1 }).totalTime(0.25);
    suppress();
    expect(keep.paused()).toBe(true);
    expect(stale.paused()).toBe(true);
    successorParent.addChild(reparented);

    window.dispatchEvent(new Event('pointerdown'));

    expect(keep.paused()).toBe(false);
    expect(stale.paused()).toBe(true);
    parent.destroy({ children: true });
    successorParent.destroy({ children: true });
  });
});
