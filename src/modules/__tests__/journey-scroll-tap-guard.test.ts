import { createJourneyScrollTapGuard } from '../journey-scroll-tap-guard.js';

describe('createJourneyScrollTapGuard', () => {
  let scrollTop = 0;

  beforeEach(() => {
    scrollTop = 0;
  });

  it('accepts a stationary touch once and suppresses its synthetic click', () => {
    const guard = createJourneyScrollTapGuard(() => scrollTop);
    guard.start(20, 30);
    expect(guard.shouldHandleTouchEnd(21, 31)).toBe(true);
    expect(guard.shouldHandleClick()).toBe(false);
  });

  it('rejects a scroll even when WebKit omits the final touchmove', () => {
    const guard = createJourneyScrollTapGuard(() => scrollTop);
    guard.start(20, 30);
    scrollTop = 18;
    expect(guard.shouldHandleTouchEnd(20, 30)).toBe(false);
    expect(guard.shouldHandleClick()).toBe(false);
  });

  it('rejects moved and cancelled touches', () => {
    const moved = createJourneyScrollTapGuard(() => scrollTop);
    moved.start(20, 30);
    moved.move(20, 45);
    expect(moved.shouldHandleTouchEnd(20, 45)).toBe(false);

    const cancelled = createJourneyScrollTapGuard(() => scrollTop);
    cancelled.start(20, 30);
    cancelled.cancel();
    expect(cancelled.shouldHandleClick()).toBe(false);
  });

  it('still permits pointer and desktop clicks', () => {
    const guard = createJourneyScrollTapGuard(() => scrollTop);
    expect(guard.shouldHandleClick()).toBe(true);
  });
});
