import { Container } from 'pixi.js';
import { gsap } from 'gsap';
import { STATE } from '../app-state';
import {
  createSpecialIdleAnimationVisibility, getSpecialDiceIdleVisibilityStats,
  isSpecialDiceIdlePaintable, watchSpecialDiceIdleVisibility,
} from '../special-dice-idle-visibility';

describe('special idle visibility ownership', () => {
  let callbacks: Set<() => void>;
  let cleanup: Array<() => void>;
  const originalHidden = Object.getOwnPropertyDescriptor(document, 'hidden');
  beforeEach(() => {
    callbacks = new Set(); cleanup = [];
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    STATE.app = { ticker: { add: (fn: () => void) => callbacks.add(fn), remove: (fn: () => void) => callbacks.delete(fn) } } as any;
  });
  afterEach(() => {
    cleanup.reverse().forEach(fn => fn());
    STATE.app = null;
    if (originalHidden) Object.defineProperty(document, 'hidden', originalHidden);
    expect(getSpecialDiceIdleVisibilityStats()).toEqual({ tiles: 0, owners: 0, tickerAttached: false });
  });
  const tick = () => [...callbacks].forEach(fn => fn());
  const hideDocument = (hidden: boolean) => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
    document.dispatchEvent(new Event('visibilitychange'));
  };

  test('retires a throwing notification without skipping a healthy owner on the same tile', () => {
    const tile = { visible: true }; const retire = jest.fn();
    const failed = jest.fn((visible) => { if (!visible) throw new Error('stale idle owner'); });
    const healthy = jest.fn();
    const a = watchSpecialDiceIdleVisibility(tile, failed, retire);
    const b = watchSpecialDiceIdleVisibility(tile, healthy);
    cleanup.push(a.release, b.release);
    tile.visible = false;
    expect(tick).not.toThrow();
    expect(retire).toHaveBeenCalledTimes(1);
    expect(healthy.mock.calls).toEqual([[true], [false]]);
    expect(getSpecialDiceIdleVisibilityStats().owners).toBe(1);
    tile.visible = true; tick(); a.refresh();
    expect(failed).toHaveBeenCalledTimes(2);
    expect(healthy.mock.calls).toEqual([[true], [false], [true]]);
    b.release(); expect(callbacks.size).toBe(0);
  });

  test('a damaged branch retires only its tile and a throwing animation leaves sibling playheads owned', () => {
    const broken: any = { visible: true }; const healthy = { visible: true };
    const retire = jest.fn();
    const badLease = watchSpecialDiceIdleVisibility(broken, jest.fn(), retire);
    const goodLease = createSpecialIdleAnimationVisibility(healthy);
    const faulty = { paused: () => false, pause: () => { throw new Error('stale tween'); }, resume: jest.fn(), kill: jest.fn() };
    const sibling = { paused: () => false, pause: jest.fn(), resume: jest.fn(), kill: jest.fn() };
    goodLease.track(faulty); goodLease.track(sibling);
    cleanup.push(badLease.release, goodLease.release);
    Object.defineProperty(broken, 'visible', { get: () => { throw new Error('stale branch'); } });
    healthy.visible = false;
    expect(tick).not.toThrow();
    expect(retire).toHaveBeenCalledTimes(1);
    expect(faulty.kill).toHaveBeenCalledTimes(1);
    expect(sibling.pause).toHaveBeenCalledTimes(1);
    healthy.visible = true; tick();
    expect(faulty.resume).not.toHaveBeenCalled();
    expect(sibling.resume).toHaveBeenCalledTimes(1);
  });

  test('shares one ticker and transition notification per tile while preserving resolving/drag flags', () => {
    const parent = new Container(); const tile: any = new Container(); parent.addChild(tile);
    tile.base = { renderable: false }; tile.eventMode = 'none'; tile.locked = true; tile._pendingRemoval = true;
    expect(isSpecialDiceIdlePaintable(tile)).toBe(true);
    const first = jest.fn(); const second = jest.fn();
    const a = watchSpecialDiceIdleVisibility(tile, first); const b = watchSpecialDiceIdleVisibility(tile, second);
    cleanup.push(a.release, b.release, () => parent.destroy({ children: true }));
    expect(callbacks.size).toBe(1);
    parent.alpha = 0; tick(); tick();
    expect(first.mock.calls).toEqual([[true], [false]]);
    expect(second.mock.calls).toEqual([[true], [false]]);
    parent.alpha = 1; tick();
    expect(first.mock.calls).toEqual([[true], [false], [true]]);
    a.release(); expect(callbacks.size).toBe(1);
    b.release(); expect(callbacks.size).toBe(0);
  });

  test('samples shared settled visibility at 4Hz instead of walking every tile on every Pixi frame', () => {
    const tile = { visible: true };
    const owner = jest.fn();
    const lease = watchSpecialDiceIdleVisibility(tile, owner);
    cleanup.push(lease.release);
    tile.visible = false;
    const tickWithElapsed = (elapsedMS: number) => [...callbacks].forEach(fn => (fn as any)({ elapsedMS }));
    for (let frame = 0; frame < 14; frame += 1) tickWithElapsed(1000 / 60);
    expect(owner.mock.calls).toEqual([[true]]);
    tickWithElapsed(20);
    expect(owner.mock.calls).toEqual([[true], [false]]);
  });

  test('preserves playheads, excludes external pauses, and respects a drag owner during resume', () => {
    const tile = { visible: true }; let dragging = false;
    const visibility = createSpecialIdleAnimationVisibility(tile, () => !dragging);
    const pose = { x: 0 };
    const running = gsap.to(pose, { x: 10, duration: 10, paused: true });
    running.totalTime(2).resume();
    const externalPause = gsap.to({}, { duration: 10, paused: true });
    visibility.track(running); visibility.track(externalPause);
    cleanup.push(visibility.release, () => running.kill(), () => externalPause.kill());
    tile.visible = false; tick();
    expect(running.paused()).toBe(true);
    const playhead = running.totalTime();
    dragging = true; tile.visible = true; tick();
    expect(running.paused()).toBe(true);
    dragging = false; visibility.refresh();
    expect(running.paused()).toBe(false);
    expect(running.totalTime()).toBe(playhead);
    expect(externalPause.paused()).toBe(true);
  });

  test('background and late readiness suspend without Pixi ticks and release never revives animations', () => {
    const tile = { visible: true };
    const visibility = createSpecialIdleAnimationVisibility(tile);
    const animation = gsap.to({}, { duration: 10, paused: true });
    visibility.track(animation);
    cleanup.push(visibility.release, () => animation.kill());
    hideDocument(true);
    animation.play(); visibility.refresh();
    expect(animation.paused()).toBe(true);
    visibility.release(); hideDocument(false); tick();
    expect(animation.paused()).toBe(true);
  });

  test('completed finite effects leave the visibility set and do not restart on reveal', () => {
    const tile = { visible: true }; const completed = jest.fn();
    const visibility = createSpecialIdleAnimationVisibility(tile);
    const animation = gsap.to({}, { duration: 1, paused: true, onComplete: completed });
    visibility.track(animation); cleanup.push(visibility.release, () => animation.kill());
    animation.totalTime(1);
    expect(completed).toHaveBeenCalledTimes(1);
    const resume = jest.spyOn(animation, 'resume');
    tile.visible = false; tick(); tile.visible = true; tick();
    expect(resume).not.toHaveBeenCalled();
  });

  test('screen-owned canvas/host hiding suppresses a still-visible Pixi tile without reading layout', () => {
    const host = document.createElement('div'); const canvas = document.createElement('canvas');
    host.appendChild(canvas); (STATE.app as any).canvas = canvas;
    const tile = { visible: true }; const listener = jest.fn();
    const lease = watchSpecialDiceIdleVisibility(tile, listener); cleanup.push(lease.release);
    const computedStyle = jest.spyOn(window, 'getComputedStyle');
    host.style.display = 'none'; tick();
    expect(isSpecialDiceIdlePaintable(tile)).toBe(false);
    host.style.display = ''; canvas.style.opacity = '0'; tick();
    expect(listener.mock.calls).toEqual([[true], [false]]);
    canvas.style.opacity = '1'; tick();
    expect(listener.mock.calls).toEqual([[true], [false], [true]]);
    expect(computedStyle).not.toHaveBeenCalled();
  });
});
