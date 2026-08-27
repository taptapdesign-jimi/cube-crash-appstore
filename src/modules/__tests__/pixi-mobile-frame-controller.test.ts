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
  afterEach(() => stopPixiMobileFrameController());

  test('uses 60fps during activity and settles to 30fps without a second RAF', () => {
    let clock = 100;
    jest.spyOn(performance, 'now').mockImplementation(() => clock);
    const callbacks = new Set<() => void>();
    const ticker = {
      maxFPS: 0,
      add: jest.fn((callback: () => void) => callbacks.add(callback)),
      remove: jest.fn((callback: () => void) => callbacks.delete(callback)),
    };

    startPixiMobileFrameController(ticker);
    expect(ticker.maxFPS).toBe(60);
    expect(callbacks.size).toBe(1);

    clock += 5001;
    callbacks.forEach((callback) => callback());
    expect(ticker.maxFPS).toBe(30);

    markPixiMobileActivity();
    expect(ticker.maxFPS).toBe(60);
    expect(getPixiMobileFrameControllerSnapshot().active).toBe(true);

    stopPixiMobileFrameController();
    expect(ticker.maxFPS).toBe(0);
    expect(callbacks.size).toBe(0);
    expect(ticker.remove).toHaveBeenCalledTimes(1);
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
    clock += 5001;
    callbacks.forEach((callback) => callback());
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
});
