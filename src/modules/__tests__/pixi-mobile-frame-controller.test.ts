jest.mock('../mobile-runtime-profile', () => ({
  MOBILE_RUNTIME_PROFILE: {
    isMobileDevice: true,
    settledIdleMaxFramesPerSecond: 30,
  },
}));

import {
  acquirePixiMobileActivityLease,
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

  test('starts settled, uses 60fps during bounded activity and returns to 30fps without a second RAF', () => {
    let clock = 100;
    jest.spyOn(performance, 'now').mockImplementation(() => clock);
    const callbacks = new Set<() => void>();
    const ticker = {
      maxFPS: 0,
      add: jest.fn((callback: () => void) => callbacks.add(callback)),
      remove: jest.fn((callback: () => void) => callbacks.delete(callback)),
    };

    startPixiMobileFrameController(ticker);
    expect(ticker.maxFPS).toBe(30);
    expect(callbacks.size).toBe(1);

    markPixiMobileActivity();
    expect(ticker.maxFPS).toBe(60);
    expect(getPixiMobileFrameControllerSnapshot().active).toBe(true);
    expect(getPixiMobileFrameControllerSnapshot().activeUntil).toBe(clock + 300);

    clock += 301;
    callbacks.forEach((callback) => callback());
    expect(ticker.maxFPS).toBe(30);

    stopPixiMobileFrameController();
    expect(ticker.maxFPS).toBe(0);
    expect(callbacks.size).toBe(0);
    expect(ticker.remove).toHaveBeenCalledTimes(1);
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
    expect(ticker.maxFPS).toBe(30);
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
    expect(ticker.maxFPS).toBe(30);
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
    expect(ticker.maxFPS).toBe(30);

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
    expect(ticker.maxFPS).toBe(30);
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
});
