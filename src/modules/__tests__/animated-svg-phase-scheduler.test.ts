/** @jest-environment jsdom */

import {
  acquireAnimatedTimelinePhase,
  acquireAnimatedSvgPhase,
  getAnimatedSvgPhaseSchedulerStats,
} from '../animated-svg-phase-scheduler';

describe('animated SVG phase scheduler', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-08T12:00:00.000Z'));
  });

  afterEach(() => {
    expect(getAnimatedSvgPhaseSchedulerStats()).toEqual({
      groups: 0,
      leases: 0,
      pending: 0,
    });
    jest.useRealTimers();
  });

  test('starts the first SVG immediately and gives every concurrent duplicate a distinct clock', () => {
    const images = [new Image(), new Image(), new Image()];
    const leases = images.map((image) => acquireAnimatedSvgPhase(
      'robo-bouncy',
      2400,
      [{ image, url: './assets/shop/robo/robo-bouncy.svg' }],
    ));

    expect(images[0].getAttribute('src')).toBe('./assets/shop/robo/robo-bouncy.svg');
    expect(images[1].getAttribute('src')).toBeNull();
    expect(images[2].getAttribute('src')).toBeNull();
    expect(leases.map((lease) => lease.delayMs)).toEqual([0, 200, 400]);
    expect(leases.map((lease) => lease.phaseSlot)).toEqual([0, 1, 2]);
    expect(new Set(leases.map((lease) => lease.plannedStartAtMs)).size).toBe(3);

    jest.advanceTimersByTime(199);
    expect(images[1].getAttribute('src')).toBeNull();
    jest.advanceTimersByTime(1);
    expect(images[1].getAttribute('src')).toBe(
      './assets/shop/robo/robo-bouncy.svg?cc-svg-phase=1',
    );
    jest.advanceTimersByTime(200);
    expect(images[2].getAttribute('src')).toBe(
      './assets/shop/robo/robo-bouncy.svg?cc-svg-phase=2',
    );
    expect(getAnimatedSvgPhaseSchedulerStats()).toEqual({
      groups: 1,
      leases: 3,
      pending: 0,
    });

    leases.forEach((lease) => lease.release());
  });

  test('starts mutually exclusive SVG compositions together on one reserved phase', () => {
    const single = new Image();
    const orbit = new Image();
    const lease = acquireAnimatedSvgPhase('wild-star-composition', 2000, [
      { image: single, url: './assets/shop/star/star.svg' },
      { image: orbit, url: './assets/test-orbit.svg' },
    ]);

    expect(lease.delayMs).toBe(0);
    expect(lease.phaseSlot).toBe(0);
    expect(single.getAttribute('src')).toBe('./assets/shop/star/star.svg');
    expect(orbit.getAttribute('src')).toBe('./assets/test-orbit.svg');
    lease.release();
  });

  test('phases non-SVG media through the same lifecycle owner', () => {
    const firstVideo = document.createElement('video');
    const secondVideo = document.createElement('video');
    const starts: string[] = [];
    const first = acquireAnimatedTimelinePhase('fish-swim-composition', 1125, [{
      element: firstVideo,
      start: (phaseSlot) => starts.push(`first-${phaseSlot}`),
    }]);
    const second = acquireAnimatedTimelinePhase('fish-swim-composition', 1125, [{
      element: secondVideo,
      start: (phaseSlot) => starts.push(`second-${phaseSlot}`),
    }]);

    expect(starts).toEqual(['first-0']);
    expect(firstVideo.dataset.ccSvgPhaseSlot).toBe('0');
    expect(secondVideo.dataset.ccSvgPhaseSlot).toBe('1');
    expect(second.delayMs).toBeGreaterThanOrEqual(100);

    jest.advanceTimersByTime(second.delayMs);
    expect(starts).toEqual(['first-0', 'second-1']);

    second.release();
    first.release();
  });

  test('cancels a pending duplicate start during tile cleanup', () => {
    const firstImage = new Image();
    const pendingImage = new Image();
    const first = acquireAnimatedSvgPhase('juice-bounce', 2000, [
      { image: firstImage, url: './assets/shop/juice/juice-bounce.svg' },
    ]);
    const pending = acquireAnimatedSvgPhase('juice-bounce', 2000, [
      { image: pendingImage, url: './assets/shop/juice/juice-bounce.svg' },
    ]);

    expect(pending.delayMs).toBeGreaterThan(0);
    pending.release();
    jest.advanceTimersByTime(2000);
    expect(pendingImage.getAttribute('src')).toBeNull();

    first.release();
  });

  test('reuses only a released slot and preserves URL query/hash syntax', () => {
    const firstImage = new Image();
    const secondImage = new Image();
    const replacementImage = new Image();
    const first = acquireAnimatedSvgPhase('syntax', 1400, [
      { image: firstImage, url: './ball.svg?quality=full#art' },
    ]);
    const second = acquireAnimatedSvgPhase('syntax', 1400, [
      { image: secondImage, url: './ball.svg?quality=full#art' },
    ]);
    second.release();
    const replacement = acquireAnimatedSvgPhase('syntax', 1400, [
      { image: replacementImage, url: './ball.svg?quality=full#art' },
    ]);

    expect(first.phaseSlot).toBe(0);
    expect(second.phaseSlot).toBe(1);
    expect(replacement.phaseSlot).toBe(1);
    jest.advanceTimersByTime(1400);
    expect(replacementImage.getAttribute('src')).toBe(
      './ball.svg?quality=full&cc-svg-phase=1#art',
    );

    replacement.release();
    first.release();
  });

  test('replans coalesced background timers instead of starting duplicates together', () => {
    const firstImage = new Image();
    const secondImage = new Image();
    const thirdImage = new Image();
    const first = acquireAnimatedSvgPhase('resume-safe', 2000, [
      { image: firstImage, url: './juice.svg' },
    ]);
    const second = acquireAnimatedSvgPhase('resume-safe', 2000, [
      { image: secondImage, url: './juice.svg' },
    ]);
    const third = acquireAnimatedSvgPhase('resume-safe', 2000, [
      { image: thirdImage, url: './juice.svg' },
    ]);
    try {
      jest.setSystemTime(new Date('2026-09-08T12:00:01.000Z'));
      jest.runAllTimers();
      expect(secondImage.getAttribute('src')).toBe('./juice.svg?cc-svg-phase=1');
      expect(thirdImage.getAttribute('src')).toBe('./juice.svg?cc-svg-phase=2');
      expect(Math.abs(third.plannedStartAtMs - second.plannedStartAtMs)).toBeGreaterThanOrEqual(165);
    } finally {
      third.release();
      second.release();
      first.release();
    }
  });
});
