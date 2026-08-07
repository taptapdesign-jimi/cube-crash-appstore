import {
  acquireJourneyCardOriginLease,
  computeJourneyCardArcOffset,
  computeJourneyCardMotionTransformOrigin,
  computeJourneyCardSpatialPose,
  getJourneyCardSpatialProgress,
} from '../journey-card-portal-transition';

describe('Journey exact-card portal transition', () => {
  test('adds a bounded tangent arc that returns exactly to both endpoints', () => {
    const from = { centerX: 200, centerY: 300, width: 300, height: 450, rotationDeg: -6 };
    const to = { centerX: 70, centerY: 600, width: 90, height: 135, rotationDeg: 8 };
    expect(computeJourneyCardArcOffset(from, to, 0)).toEqual({ x: 0, y: 0 });
    expect(computeJourneyCardArcOffset(from, to, 1)).toEqual({ x: 0, y: 0 });
    const midpoint = computeJourneyCardArcOffset(from, to, 0.5);
    expect(Math.hypot(midpoint.x, midpoint.y)).toBeCloseTo(24.5217, 3);
    expect(midpoint.x).not.toBe(0);
    expect(midpoint.y).not.toBe(0);
  });

  test('uses a cartoon overshoot while ending at an exact terminal pose', () => {
    expect(getJourneyCardSpatialProgress(0, 'enter')).toBe(0);
    expect(getJourneyCardSpatialProgress(0.08, 'enter')).toBeCloseTo(-0.028, 5);
    expect(getJourneyCardSpatialProgress(0.58, 'enter')).toBeCloseTo(1.105, 5);
    expect(getJourneyCardSpatialProgress(0.76, 'enter')).toBeCloseTo(0.965, 5);
    expect(getJourneyCardSpatialProgress(0.9, 'enter')).toBeCloseTo(1.022, 5);
    expect(getJourneyCardSpatialProgress(1, 'enter')).toBe(1);
    expect(getJourneyCardSpatialProgress(0.08, 'return')).toBeCloseTo(-0.035, 5);
    expect(getJourneyCardSpatialProgress(0.62, 'return')).toBeCloseTo(1.055, 5);
    expect(getJourneyCardSpatialProgress(0.78, 'return')).toBeCloseTo(0.978, 5);
    expect(getJourneyCardSpatialProgress(0.9, 'return')).toBeCloseTo(1.014, 5);
    expect(getJourneyCardSpatialProgress(1, 'return')).toBe(1);

    expect(computeJourneyCardSpatialPose(
      { centerX: 200, centerY: 300, width: 300, height: 450, rotationDeg: -6 },
      { centerX: 70, centerY: 600, width: 90, height: 135, rotationDeg: 8 },
      { centerX: 200, centerY: 300, width: 300, height: 450, rotationDeg: -6 },
      1,
    )).toEqual({ x: 0, y: 0, scaleX: 1, scaleY: 1, rotationDeg: 0 });

    expect(computeJourneyCardSpatialPose(
      { centerX: 200, centerY: 300, width: 310, height: 423, rotationDeg: -6 },
      { centerX: 70, centerY: 600, width: 90, height: 133, rotationDeg: 8 },
      { centerX: 200, centerY: 300, width: 310, height: 423, rotationDeg: -6 },
      0,
    )).toEqual({
      x: -130,
      y: 300,
      scaleX: 90 / 310,
      scaleY: 133 / 423,
      rotationDeg: 14,
    });
    expect(computeJourneyCardMotionTransformOrigin(
      { centerX: 226, centerY: 188, width: 310, height: 423, rotationDeg: -6 },
      { left: 40, top: 30 },
    )).toEqual({ x: 186, y: 158 });
  });

  test('moves and restores the same DOM card without creating a duplicate', () => {
    document.body.innerHTML = `
      <div class="journey-board-card-wrapper">
        <div class="journey-board-card unlocked idle-shimmer-trigger journey-board-card-return-placeholder" data-board-id="26"></div>
        <span class="after-card"></span>
      </div>
      <div class="portal-host"></div>
    `;
    const wrapper = document.querySelector<HTMLElement>('.journey-board-card-wrapper')!;
    const card = document.querySelector<HTMLElement>('.journey-board-card')!;
    const host = document.querySelector<HTMLElement>('.portal-host')!;
    Object.defineProperties(card, {
      offsetWidth: { configurable: true, value: 100 },
      offsetHeight: { configurable: true, value: 150 },
    });
    card.getBoundingClientRect = () => ({
      x: 20, y: 40, left: 20, top: 40, right: 120, bottom: 190,
      width: 100, height: 150, toJSON: () => ({}),
    });

    const lease = acquireJourneyCardOriginLease(26, card);
    expect(lease).not.toBeNull();
    lease!.mountInto(host);
    expect(host.firstElementChild).toBe(card);
    expect(document.querySelectorAll('[data-board-id="26"]')).toHaveLength(1);
    expect(card).toHaveClass('journey-card-overlay-portaled-card');
    expect(card).not.toHaveClass('journey-board-card-return-placeholder');

    expect(lease!.restoreNow()).toBe(true);
    expect(wrapper.firstElementChild).toBe(card);
    expect(card).not.toHaveClass('journey-card-overlay-portaled-card');
    expect(card).not.toHaveClass('journey-board-card-return-placeholder');
    expect(card).not.toHaveClass('idle-shimmer-trigger');
    expect(document.querySelectorAll('[data-board-id="26"]')).toHaveLength(1);
  });

  test('lands on the card visual offset instead of the wrapper center', () => {
    document.body.innerHTML = `
      <div class="journey-board-card-wrapper">
        <div class="journey-board-card unlocked" data-board-id="2"></div>
      </div>
      <div class="portal-host"></div>
    `;
    const wrapper = document.querySelector<HTMLElement>('.journey-board-card-wrapper')!;
    const card = document.querySelector<HTMLElement>('.journey-board-card')!;
    const host = document.querySelector<HTMLElement>('.portal-host')!;
    let wrapperRect = {
      x: 10, y: 20, left: 10, top: 20, right: 110, bottom: 170,
      width: 100, height: 150, toJSON: () => ({}),
    };
    wrapper.getBoundingClientRect = () => wrapperRect;
    card.getBoundingClientRect = () => ({
      x: 20, y: 40, left: 20, top: 40, right: 120, bottom: 190,
      width: 100, height: 150, toJSON: () => ({}),
    });
    Object.defineProperties(card, {
      offsetWidth: { configurable: true, value: 100 },
      offsetHeight: { configurable: true, value: 150 },
    });

    const lease = acquireJourneyCardOriginLease(2, card)!;
    lease.mountInto(host);
    wrapperRect = {
      x: 30, y: 50, left: 30, top: 50, right: 230, bottom: 350,
      width: 200, height: 300, toJSON: () => ({}),
    };

    expect(lease.readLiveGeometry()).toEqual({
      centerX: 150,
      centerY: 240,
      width: 200,
      height: 300,
      rotationDeg: 0,
    });
  });
});
