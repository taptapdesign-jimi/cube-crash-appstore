jest.mock('../mobile-runtime-profile', () => ({
  MOBILE_RUNTIME_PROFILE: {
    isMobileDevice: true,
    settledIdleMaxFramesPerSecond: 30,
    staticBoardMaxFramesPerSecond: 15,
  },
}));

import {
  acquirePixiMobileActivityLease,
  acquirePixiSettledMotionLease,
  getPixiMobileFrameControllerSnapshot,
  markPixiMobileActivity,
  startPixiMobileFrameController,
  stopPixiMobileFrameController,
} from '../pixi-mobile-frame-controller';

describe('Pixi mobile frame controller', () => {
  afterEach(() => {
    stopPixiMobileFrameController();
    delete (window as any).__ccThermalPixiActiveFpsCap;
  });

  test('starts static, uses 60fps during bounded activity and returns to 15fps without a second RAF', () => {
    let clock = 100;
    jest.spyOn(performance, 'now').mockImplementation(() => clock);
    const callbacks = new Set<() => void>();
    const ticker = {
      maxFPS: 0,
      add: jest.fn((callback: () => void) => callbacks.add(callback)),
      remove: jest.fn((callback: () => void) => callbacks.delete(callback)),
    };

    startPixiMobileFrameController(ticker);
    expect(ticker.maxFPS).toBe(15);
    expect(callbacks.size).toBe(1);

    markPixiMobileActivity();
    expect(ticker.maxFPS).toBe(60);
    expect(getPixiMobileFrameControllerSnapshot().active).toBe(true);
    expect(getPixiMobileFrameControllerSnapshot().activeUntil).toBe(clock + 300);

    clock += 301;
    callbacks.forEach((callback) => callback());
    expect(ticker.maxFPS).toBe(15);

    stopPixiMobileFrameController();
    expect(ticker.maxFPS).toBe(0);
    expect(callbacks.size).toBe(0);
    expect(ticker.remove).toHaveBeenCalledTimes(1);
  });

  test('keeps the shared ticker alive at settled cadence so unleased route animations still paint', () => {
    let clock = 100;
    jest.spyOn(performance, 'now').mockImplementation(() => clock);
    const callbacks = new Set<() => void>();
    const ticker = {
      maxFPS: 0,
      started: true,
      add: jest.fn((callback: () => void) => callbacks.add(callback)),
      remove: jest.fn((callback: () => void) => callbacks.delete(callback)),
      start: jest.fn(() => { ticker.started = true; }),
      stop: jest.fn(() => { ticker.started = false; }),
    };

    startPixiMobileFrameController(ticker);
    expect(ticker.stop).not.toHaveBeenCalled();
    expect(ticker.started).toBe(true);
    expect(getPixiMobileFrameControllerSnapshot()).toMatchObject({ sleeping: false, maxFPS: 15 });

    const releaseActive = acquirePixiMobileActivityLease('drop', 0);
    expect(ticker.started).toBe(true);
    expect(ticker.maxFPS).toBe(60);
    releaseActive();
    callbacks.forEach((callback) => callback());
    expect(ticker.started).toBe(true);
    expect(ticker.maxFPS).toBe(15);

    const releaseIdle = acquirePixiSettledMotionLease('special-idle');
    expect(ticker.started).toBe(true);
    expect(ticker.maxFPS).toBe(30);
    expect(getPixiMobileFrameControllerSnapshot().settledMotionLeaseCount).toBe(1);
    releaseIdle();
    expect(ticker.maxFPS).toBe(15);
    expect(ticker.started).toBe(true);
    expect(ticker.stop).not.toHaveBeenCalled();
  });

  test('preserves a board-entry lease acquired while the first Pixi ticker is still preparing', () => {
    const releaseEntry = acquirePixiMobileActivityLease('board-entry', 0);
    const ticker = {
      maxFPS: 0,
      started: true,
      add: jest.fn(),
      remove: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    };
    startPixiMobileFrameController(ticker);
    expect(ticker.maxFPS).toBe(60);
    expect(getPixiMobileFrameControllerSnapshot().activityLeaseCount).toBe(1);
    releaseEntry();
    expect(ticker.maxFPS).toBe(15);
    expect(ticker.stop).not.toHaveBeenCalled();
  });

  test('keeps direct manipulation at 60fps only while the pointer is held plus its release paint tail', () => {
    let clock = 100;
    jest.spyOn(performance, 'now').mockImplementation(() => clock);
    const callbacks = new Set<() => void>();
    const ticker = {
      maxFPS: 0,
      add: jest.fn((callback: () => void) => callbacks.add(callback)),
      remove: jest.fn((callback: () => void) => callbacks.delete(callback)),
    };

    startPixiMobileFrameController(ticker);
    window.dispatchEvent(new Event('pointerdown'));
    expect(ticker.maxFPS).toBe(60);
    expect(getPixiMobileFrameControllerSnapshot().activityLeaseCount).toBe(1);

    clock += 2_000;
    callbacks.forEach((callback) => callback());
    expect(ticker.maxFPS).toBe(60);

    window.dispatchEvent(new Event('pointerup'));
    expect(getPixiMobileFrameControllerSnapshot().activityLeaseCount).toBe(0);
    clock += 249;
    callbacks.forEach((callback) => callback());
    expect(ticker.maxFPS).toBe(60);
    clock += 2;
    callbacks.forEach((callback) => callback());
    expect(ticker.maxFPS).toBe(15);
  });

  test('releases direct manipulation when WebKit hides the page without a pointer-up', () => {
    let clock = 100;
    jest.spyOn(performance, 'now').mockImplementation(() => clock);
    const callbacks = new Set<() => void>();
    const ticker = {
      maxFPS: 0,
      add: jest.fn((callback: () => void) => callbacks.add(callback)),
      remove: jest.fn((callback: () => void) => callbacks.delete(callback)),
    };

    startPixiMobileFrameController(ticker);
    window.dispatchEvent(new Event('pointerdown'));
    expect(getPixiMobileFrameControllerSnapshot().activityLeaseCount).toBe(1);

    window.dispatchEvent(new Event('pagehide'));
    expect(getPixiMobileFrameControllerSnapshot().activityLeaseCount).toBe(0);
    clock += 251;
    callbacks.forEach((callback) => callback());
    expect(ticker.maxFPS).toBe(15);
  });

  test('keeps 60fps until every lifecycle lease releases, then applies a paint tail', () => {
    let clock = 100;
    jest.spyOn(performance, 'now').mockImplementation(() => clock);
    const callbacks = new Set<() => void>();
    const ticker = {
      maxFPS: 0,
      add: jest.fn((callback: () => void) => callbacks.add(callback)),
      remove: jest.fn((callback: () => void) => callbacks.delete(callback)),
    };

    startPixiMobileFrameController(ticker);
    expect(ticker.maxFPS).toBe(15);

    const releaseTnt = acquirePixiMobileActivityLease('tnt');
    const releaseStars = acquirePixiMobileActivityLease('hud-stars');
    expect(ticker.maxFPS).toBe(60);
    expect(getPixiMobileFrameControllerSnapshot().activityLeaseCount).toBe(2);

    releaseTnt();
    clock += 1000;
    callbacks.forEach((callback) => callback());
    expect(ticker.maxFPS).toBe(60);

    releaseStars();
    releaseStars();
    expect(getPixiMobileFrameControllerSnapshot().activityLeaseCount).toBe(0);
    clock += 181;
    callbacks.forEach((callback) => callback());
    expect(ticker.maxFPS).toBe(15);
  });

  test('explicit thermal diagnostic caps active gameplay at 30fps without changing lease ownership', () => {
    (window as any).__ccThermalPixiActiveFpsCap = 30;
    const callbacks = new Set<() => void>();
    const ticker = {
      maxFPS: 0,
      add: jest.fn((callback: () => void) => callbacks.add(callback)),
      remove: jest.fn((callback: () => void) => callbacks.delete(callback)),
    };

    startPixiMobileFrameController(ticker);
    const release = acquirePixiMobileActivityLease('diagnostic-active-board');
    window.dispatchEvent(new Event('pointerdown'));

    expect(ticker.maxFPS).toBe(30);
    expect(getPixiMobileFrameControllerSnapshot().activityLeaseCount).toBe(2);

    window.dispatchEvent(new Event('pointerup'));
    release();
    expect(getPixiMobileFrameControllerSnapshot().activityLeaseCount).toBe(0);
  });

  test('settled owners survive hidden/resume and release independently without starting or stopping the ticker', () => {
    const ticker = { maxFPS: 0, add: jest.fn(), remove: jest.fn(), start: jest.fn(), stop: jest.fn() };
    const releaseFirst = acquirePixiSettledMotionLease('first-pending-special');
    startPixiMobileFrameController(ticker);
    const releaseSecond = acquirePixiSettledMotionLease('second-special');
    expect(ticker.maxFPS).toBe(30);
    const releaseActive = acquirePixiMobileActivityLease('authored-finale', 0);
    expect(ticker.maxFPS).toBe(60);
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(getPixiMobileFrameControllerSnapshot()).toMatchObject({ activityLeaseCount: 1, settledMotionLeaseCount: 2 });
    releaseActive();
    expect(ticker.maxFPS).toBe(30);
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    releaseFirst(); releaseFirst();
    expect(ticker.maxFPS).toBe(30);
    releaseSecond();
    expect(ticker.maxFPS).toBe(15);
    expect(ticker.start).not.toHaveBeenCalled();
    expect(ticker.stop).not.toHaveBeenCalled();
  });

  test('late retired activity releases cannot extend a replacement board tail', () => {
    const previous = { maxFPS: 0, add: jest.fn(), remove: jest.fn() };
    const next = { maxFPS: 0, add: jest.fn(), remove: jest.fn() };
    startPixiMobileFrameController(previous);
    const releaseOld = acquirePixiMobileActivityLease('old-finale', 1000);
    startPixiMobileFrameController(next);
    releaseOld();
    expect(next.maxFPS).toBe(15);
    expect(getPixiMobileFrameControllerSnapshot().activeUntil).toBe(0);
  });

  test('steady static and settled ticker frames do not rewrite maxFPS', () => {
    let tick = () => {};
    let fps = 0;
    const write = jest.fn((value: number) => { fps = value; });
    const ticker = {
      get maxFPS() { return fps; }, set maxFPS(value: number) { write(value); },
      add: (callback: () => void) => { tick = callback; }, remove: jest.fn(),
    };
    startPixiMobileFrameController(ticker);
    for (let frame = 0; frame < 60; frame++) tick();
    expect(write.mock.calls).toEqual([[15]]);
    const release = acquirePixiSettledMotionLease();
    for (let frame = 0; frame < 60; frame++) tick();
    expect(write.mock.calls).toEqual([[15], [30]]);
    release();
    expect(write.mock.calls).toEqual([[15], [30], [15]]);
  });
});
