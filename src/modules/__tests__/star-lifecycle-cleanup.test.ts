/** @jest-environment jsdom */

jest.mock('../wild-stars', () => ({
  detachWildStarHalo: jest.fn(),
}));

import {
  addStars,
  cleanupStarsCollector,
  initStarsCollector,
} from '../stars-collector';

describe('Star lifecycle cleanup', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    (window as any).HUD = {
      bounceScoreIcon: jest.fn((onComplete?: () => void) => onComplete?.()),
    };
    initStarsCollector({
      app: {},
      stage: {},
      board: {},
      hud: {},
      getStarHudPosition: () => ({ x: 0, y: 0 }),
    } as any);
  });

  afterEach(() => {
    cleanupStarsCollector();
    delete (window as any).HUD;
    jest.useRealTimers();
  });

  test('cleanup cancels every queued HUD bounce from the previous run', () => {
    addStars(3);
    cleanupStarsCollector();

    jest.runOnlyPendingTimers();

    expect((window as any).HUD.bounceScoreIcon).not.toHaveBeenCalled();
  });
});
