import {
  attachKantaFinaleScene,
  clampKantaPickupLaneX,
  createKantaFinaleExtraPickupRobotIndices,
  createKantaFinalePickupStartTimes,
  createKantaFinalePickupLaneRatios,
  createKantaFinaleRobotPickupPlans,
  KANTA_FINALE_CAN_SCALE,
  KANTA_FINALE_CAN_PILE_SLOTS,
  KANTA_FINALE_CAN_SOURCE_ASPECT_RATIO,
  KANTA_FINALE_COMPOSITE_SPECS,
  KANTA_FINALE_COMPOSITE_SCALE,
  KANTA_FINALE_COMPOSITE_ENTRY_BACK_STRENGTH,
  KANTA_FINALE_COMPOSITE_ENTRY_DELAY_SECONDS,
  KANTA_FINALE_COMPOSITE_ENTRY_SECONDS,
  KANTA_FINALE_COMPOSITE_ENTRY_TRAVEL_PX,
  KANTA_FINALE_ENTRY_SECONDS,
  KANTA_FINALE_EXTRA_PICKUP_CAN_RAISE_RATIO,
  KANTA_FINALE_EXTRA_PICKUP_CAN_COUNT,
  KANTA_FINALE_FEATURED_CAN_INDEX,
  KANTA_FINALE_FEATURED_CAN_LOWER_RATIO,
  KANTA_FINALE_FEATURED_CAN_RIGHT_PX,
  KANTA_FINALE_FEATURED_CAN_SCALE,
  KANTA_FINALE_FEATURED_CAN_Z_INDEX_OFFSET,
  KANTA_FINALE_GROUND_BELOW_VIEWPORT_RATIO,
  KANTA_FINALE_INDIVIDUAL_CAN_LOWER_RATIO,
  KANTA_FINALE_LAST_PICKUP_EXTRA_ADVANCE_SECONDS,
  KANTA_FINALE_PICKUP_SECONDS,
  KANTA_FINALE_PICKUP_APEX_PROGRESS,
  KANTA_FINALE_PICKUP_END_SCALE,
  KANTA_FINALE_PICKUP_EXIT_LANES,
  KANTA_FINALE_PICKUP_MAX_SIDE_OVERFLOW_RATIO,
  KANTA_FINALE_PICKUP_MIN_START_GAP_SECONDS,
  KANTA_FINALE_PICKUP_START_ADVANCE_SECONDS,
  KANTA_FINALE_PICKUP_JUMP_HEIGHT_RATIO,
  KANTA_FINALE_PICKUP_ROTATION_MAX_DEGREES,
  KANTA_FINALE_PICKUP_ROTATION_MIN_DEGREES,
  KANTA_FINALE_PICKUP_START_JITTER_SECONDS,
  KANTA_FINALE_PICKUP_CAN_Z_INDEX,
  KANTA_FINALE_ROBOT_ENTRY_DELAY_SECONDS,
  KANTA_FINALE_ROBOT_ENTRY_STAGGER_SECONDS,
  KANTA_FINALE_ROBOT_LOWER_RATIO,
  KANTA_FINALE_ROBOT_RAISE_RATIO,
  KANTA_FINALE_ROBOT_STEP_BOUNCE_PX,
  KANTA_FINALE_ROBOT_TRAVEL_SECONDS,
  KANTA_FINALE_ROBOT_WALK_ROTATION_MAX_DEGREES,
  KANTA_FINALE_ROBOT_WALK_ROTATION_MIN_DEGREES,
  KANTA_FINALE_ROBOT_Z_INDEX,
  KANTA_FINALE_SCENE_SECONDS,
  KANTA_FINALE_SIDE_COMPOSITE_LIFT_RATIO,
  KANTA_FINALE_UPPER_CAN_COUNT,
  KANTA_FINALE_UPPER_CAN_EXTRA_LOWER_RATIO,
  KANTA_FINALE_UPPER_CAN_ROTATION_VARIANCE_DEGREES,
  sampleKantaCompositeEntry,
  sampleKantaRobotPickupExit,
} from '../kanta-finale-scene';

describe('Kanta finale collection lifecycle', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
  });

  test('owns eleven randomized pickup cans across four Robo passes without spaceships', () => {
    let nextFrameId = 1;
    let paintFrame: FrameRequestCallback | null = null;
    jest.spyOn(performance, 'now').mockReturnValue(0);
    const requestFrame = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      paintFrame = callback;
      return nextFrameId++;
    });
    const cancelFrame = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const overlay = document.createElement('div');
    document.body.appendChild(overlay);

    const cleanup = attachKantaFinaleScene(overlay, 2);
    const field = overlay.querySelector<HTMLElement>('.cc-kanta-finale-scene');
    const fighters = Array.from(field?.querySelectorAll<HTMLImageElement>('.cc-kanta-finale-fighter') ?? []);
    const robots = Array.from(field?.querySelectorAll<HTMLImageElement>('.cc-kanta-finale-robot') ?? []);
    const cans = Array.from(field?.querySelectorAll<HTMLImageElement>('.cc-kanta-finale-stacked-can') ?? []);
    const composites = Array.from(
      field?.querySelectorAll<HTMLImageElement>('.cc-kanta-finale-composite-pile') ?? [],
    );

    expect(field).not.toBeNull();
    expect(fighters).toHaveLength(0);
    expect(robots).toHaveLength(4);
    expect(cans).toHaveLength(11);
    expect(composites).toHaveLength(3);
    expect(robots.map(({ style }) => style.width).sort()).toEqual([
      '347.76px', '347.76px', '408.24px', '408.24px',
    ]);
    expect(KANTA_FINALE_ENTRY_SECONDS).toBe(0.36);
    expect(KANTA_FINALE_COMPOSITE_ENTRY_SECONDS).toBeCloseTo(
      KANTA_FINALE_ENTRY_SECONDS + 0.40,
      10,
    );
    expect(KANTA_FINALE_COMPOSITE_ENTRY_BACK_STRENGTH).toBe(2.65);
    expect(KANTA_FINALE_COMPOSITE_ENTRY_DELAY_SECONDS).toBe(0);
    expect(KANTA_FINALE_COMPOSITE_ENTRY_TRAVEL_PX).toBe(125);
    expect(sampleKantaCompositeEntry(0)).toBe(0);
    expect(sampleKantaCompositeEntry(0.55)).toBeGreaterThan(1.1);
    expect(sampleKantaCompositeEntry(1)).toBe(1);
    expect(KANTA_FINALE_ROBOT_RAISE_RATIO).toBeCloseTo(0.14 + 0.08, 10);
    expect(KANTA_FINALE_ROBOT_LOWER_RATIO).toBe(0.35);
    expect(KANTA_FINALE_ROBOT_ENTRY_DELAY_SECONDS).toBe(0.80);
    expect(KANTA_FINALE_ROBOT_ENTRY_STAGGER_SECONDS).toBe(0.30);
    expect(KANTA_FINALE_ROBOT_TRAVEL_SECONDS).toBe(1.48);
    expect(KANTA_FINALE_ROBOT_STEP_BOUNCE_PX).toBe(10);
    expect(KANTA_FINALE_ROBOT_Z_INDEX).toBe(11);
    expect(robots.every(({ dataset }) => (
      Number(dataset.kantaFinaleWalkRotationAmplitude)
        >= KANTA_FINALE_ROBOT_WALK_ROTATION_MIN_DEGREES
      && Number(dataset.kantaFinaleWalkRotationAmplitude)
        <= KANTA_FINALE_ROBOT_WALK_ROTATION_MAX_DEGREES
    ))).toBe(true);
    expect(robots.filter(({ src }) => src.includes('/robo1.'))).toHaveLength(2);
    expect(robots.filter(({ src }) => src.includes('/robo%20frontalni.') || src.includes('/robo frontalni.')))
      .toHaveLength(2);
    expect(cans.filter(({ src }) => src.endsWith('/01.png'))).toHaveLength(4);
    expect(cans.filter(({ src }) => src.endsWith('/03.png'))).toHaveLength(4);
    expect(cans.filter(({ src }) => src.endsWith('/04.png'))).toHaveLength(3);
    const pickupCans = cans.filter(({ dataset }) => dataset.kantaFinalePickupOwner !== undefined);
    expect(pickupCans).toHaveLength(11);
    expect(KANTA_FINALE_EXTRA_PICKUP_CAN_COUNT).toBe(7);
    expect(pickupCans.every(({ dataset }) => (
      Math.abs(Number(dataset.kantaFinalePickupRotation))
        >= KANTA_FINALE_PICKUP_ROTATION_MIN_DEGREES
      && Math.abs(Number(dataset.kantaFinalePickupRotation))
        <= KANTA_FINALE_PICKUP_ROTATION_MAX_DEGREES
    ))).toBe(true);
    expect(cans.filter(({ dataset }) => dataset.kantaFinalePickupOwner === undefined)
      .every(({ dataset }) => Number(dataset.kantaFinalePickupRotation) === 0)).toBe(true);
    expect(cans.slice(0, KANTA_FINALE_UPPER_CAN_COUNT).every(({ dataset }) => (
      Number(dataset.kantaFinaleRemainingRaisePx) === 0
    ))).toBe(true);
    expect(cans.slice(KANTA_FINALE_UPPER_CAN_COUNT).every(({ dataset }) => (
      Number(dataset.kantaFinaleRemainingRaisePx) > 0
    ))).toBe(true);
    expect(KANTA_FINALE_EXTRA_PICKUP_CAN_RAISE_RATIO).toBe(0.40);
    expect(new Set(pickupCans.map(({ dataset }) => dataset.kantaFinalePickupOwner)).size).toBe(4);
    expect(pickupCans.every(({ dataset }) => (
      KANTA_FINALE_PICKUP_EXIT_LANES.some((lane) => (
        lane === Number(dataset.kantaFinalePickupLane)
      ))
    ))).toBe(true);
    const pickupCountsByRobot = robots.map(({ dataset }) => pickupCans.filter((can) => (
      can.dataset.kantaFinalePickupOwner === dataset.kantaFinaleRobot
    )).length).sort();
    expect(pickupCountsByRobot).toEqual([2, 3, 3, 3]);
    const pickupStarts = pickupCans
      .map(({ dataset }) => Number(dataset.kantaFinalePickupStartSeconds))
      .sort((left, right) => left - right);
    expect(new Set(pickupStarts).size).toBe(11);
    pickupStarts.slice(1).forEach((start, index) => {
      expect(start - pickupStarts[index]).toBeGreaterThanOrEqual(
        KANTA_FINALE_PICKUP_MIN_START_GAP_SECONDS - 0.0001,
      );
    });
    expect(new Set(robots.map(({ dataset }) => dataset.kantaFinalePickupCan)).size).toBe(4);
    expect(Number(robots[0].style.zIndex)).toBeGreaterThan(
      Math.max(...cans.map(({ style }) => Number(style.zIndex))),
    );
    expect(composites.map(({ dataset }) => dataset.kantaFinaleComposite))
      .toEqual(['left', 'center', 'right']);
    expect(KANTA_FINALE_COMPOSITE_SCALE).toBe(1.5);
    expect(composites.map(({ style }) => style.width)).toEqual(['315px', '495px', '315px']);
    expect(composites.map(({ style }) => style.zIndex)).toEqual(['12', '13', '12']);
    expect(Number(composites[0].style.zIndex)).toBeGreaterThan(
      Math.max(...robots.map(({ style }) => Number(style.zIndex))),
    );
    expect(KANTA_FINALE_COMPOSITE_SPECS.map(({ source }) => source)).toEqual([
      './assets/shop/kanta/kante-ljevo.png',
      './assets/shop/kanta/kante-sredina.png',
      './assets/shop/kanta/kante-desno.png',
    ]);
    expect(Math.max(...KANTA_FINALE_CAN_PILE_SLOTS.slice(0, 4).map(({ x }) => x))
      - Math.min(...KANTA_FINALE_CAN_PILE_SLOTS.slice(0, 4).map(({ x }) => x))).toBe(210);
    expect(KANTA_FINALE_CAN_PILE_SLOTS.slice(0, 4).map(({ x }) => x))
      .toEqual([-105, -35, 35, 105]);
    expect(KANTA_FINALE_CAN_PILE_SLOTS.slice(0, 4).map(({ rise }) => rise))
      .toEqual([128, 132, 126.6, 127.6]);
    const upperCanSlots = KANTA_FINALE_CAN_PILE_SLOTS.slice(0, 4);
    const referenceSlot = upperCanSlots[1];
    const referenceHeight = referenceSlot.width
      * KANTA_FINALE_CAN_SCALE
      * KANTA_FINALE_CAN_SOURCE_ASPECT_RATIO;
    const referenceY = -referenceHeight * 0.5
      - referenceSlot.rise * 1.7
      + referenceHeight * (
        KANTA_FINALE_INDIVIDUAL_CAN_LOWER_RATIO
        + KANTA_FINALE_UPPER_CAN_EXTRA_LOWER_RATIO
      );
    upperCanSlots.forEach((slot, index) => {
      if (index === 1) return;
      const renderedHeight = slot.width
        * KANTA_FINALE_CAN_SCALE
        * KANTA_FINALE_CAN_SOURCE_ASPECT_RATIO;
      const restY = -renderedHeight * 0.5
        - slot.rise * 1.7
        + renderedHeight * (
          KANTA_FINALE_INDIVIDUAL_CAN_LOWER_RATIO
          + KANTA_FINALE_UPPER_CAN_EXTRA_LOWER_RATIO
        );
      const lowerRatio = (restY - referenceY) / renderedHeight;
      expect(lowerRatio).toBeGreaterThanOrEqual(0.05);
      expect(lowerRatio).toBeLessThanOrEqual(0.10);
    });
    expect(KANTA_FINALE_GROUND_BELOW_VIEWPORT_RATIO).toBe(0.10);
    expect(KANTA_FINALE_INDIVIDUAL_CAN_LOWER_RATIO).toBeCloseTo(0.28 - 0.30, 10);
    expect(KANTA_FINALE_UPPER_CAN_COUNT).toBe(4);
    expect(KANTA_FINALE_UPPER_CAN_EXTRA_LOWER_RATIO).toBe(0.10);
    expect(KANTA_FINALE_UPPER_CAN_ROTATION_VARIANCE_DEGREES).toBe(5);
    expect(cans.slice(0, KANTA_FINALE_UPPER_CAN_COUNT).every(({ dataset }) => (
      dataset.kantaFinaleUpperCan === 'true'
      && Number(dataset.kantaFinaleUpperLowerPx) > 0
      && Math.abs(Number(dataset.kantaFinaleUpperRotationOffset)) <= 5
    ))).toBe(true);
    expect(KANTA_FINALE_SIDE_COMPOSITE_LIFT_RATIO).toBe(0.05);
    expect(KANTA_FINALE_COMPOSITE_SPECS.map(({ liftFromCenterRatio }) => liftFromCenterRatio))
      .toEqual([0.05, 0, 0.05]);
    expect(KANTA_FINALE_FEATURED_CAN_INDEX).toBe(6);
    expect(KANTA_FINALE_FEATURED_CAN_SCALE).toBeCloseTo(0.765, 10);
    expect(KANTA_FINALE_FEATURED_CAN_LOWER_RATIO).toBe(0.35);
    expect(KANTA_FINALE_FEATURED_CAN_RIGHT_PX).toBe(20);
    expect(KANTA_FINALE_FEATURED_CAN_Z_INDEX_OFFSET).toBe(-1);
    expect(cans.map(({ style }) => Number.parseFloat(style.width))).toEqual(
      KANTA_FINALE_CAN_PILE_SLOTS.slice(0, 11).map(({ width }, index) => (
        width * KANTA_FINALE_CAN_SCALE
          * (index === KANTA_FINALE_FEATURED_CAN_INDEX ? KANTA_FINALE_FEATURED_CAN_SCALE : 1)
      )),
    );
    expect(cans.filter(({ dataset }) => dataset.kantaFinaleFeaturedCan === 'true'))
      .toHaveLength(1);
    expect(cans[KANTA_FINALE_FEATURED_CAN_INDEX].src).toMatch(/\/01\.png$/);
    expect(cans[KANTA_FINALE_FEATURED_CAN_INDEX].style.zIndex).toBe('7');
    const restingTopEdges = KANTA_FINALE_CAN_PILE_SLOTS.slice(0, 11).map((slot, index) => {
      const isFeatured = index === KANTA_FINALE_FEATURED_CAN_INDEX;
      const scale = isFeatured ? KANTA_FINALE_FEATURED_CAN_SCALE : 1;
      const height = slot.width * KANTA_FINALE_CAN_SCALE
        * scale * KANTA_FINALE_CAN_SOURCE_ASPECT_RATIO;
      return -height
        - slot.rise * 1.7
        + height * KANTA_FINALE_INDIVIDUAL_CAN_LOWER_RATIO
        + (index < KANTA_FINALE_UPPER_CAN_COUNT
          ? height * KANTA_FINALE_UPPER_CAN_EXTRA_LOWER_RATIO
          : -height * KANTA_FINALE_EXTRA_PICKUP_CAN_RAISE_RATIO)
        + (isFeatured ? height * KANTA_FINALE_FEATURED_CAN_LOWER_RATIO : 0);
    });
    expect(restingTopEdges[KANTA_FINALE_FEATURED_CAN_INDEX]).toBeGreaterThan(
      Math.min(...restingTopEdges.filter((_, index) => index !== KANTA_FINALE_FEATURED_CAN_INDEX)),
    );
    expect(cleanup.completionDelaySeconds).toBe(KANTA_FINALE_SCENE_SECONDS);
    expect(typeof cleanup.startExit).toBe('function');
    expect(requestFrame).toHaveBeenCalledTimes(1);

    const scheduledPaint = paintFrame as FrameRequestCallback | null;
    expect(scheduledPaint).not.toBeNull();
    scheduledPaint?.(KANTA_FINALE_COMPOSITE_ENTRY_DELAY_SECONDS * 1000);
    expect(composites.every(({ style }) => style.opacity === '1')).toBe(true);
    expect(cans.every(({ style }) => style.opacity === '0')).toBe(true);
    scheduledPaint?.((KANTA_FINALE_ROBOT_ENTRY_DELAY_SECONDS - 0.01) * 1000);
    expect(cans.every(({ style }) => style.opacity === '1')).toBe(true);
    expect(robots.every(({ style }) => style.opacity === '0')).toBe(true);

    const readX = (element: HTMLImageElement) => Number(
      element.style.transform.match(/translate3d\((-?[\d.]+)px/)?.[1],
    );
    const readY = (element: HTMLImageElement) => Number(
      element.style.transform.match(/translate3d\(-?[\d.]+px, (-?[\d.]+)px/)?.[1],
    );
    const readScale = (element: HTMLImageElement) => Number(
      element.style.transform.match(/scale\((-?[\d.]+)(?:,|\))/)?.[1],
    );
    const robotStartXs = robots.map((robot) => {
      scheduledPaint?.(Number(robot.dataset.kantaFinaleEntryAt) * 1000);
      const direction = Number(robot.dataset.kantaFinaleDirection);
      const x = readX(robot);
      expect(robot.style.opacity).toBe('1');
      expect(direction > 0 ? x < -window.innerWidth * 0.5 : x > window.innerWidth * 0.5).toBe(true);
      expect(direction < 0 ? robot.src.includes('/robo1.') : robot.src.includes('robo%20frontalni'))
        .toBe(true);
      return x;
    });

    scheduledPaint?.((
      KANTA_FINALE_ROBOT_ENTRY_DELAY_SECONDS
      + (robots.length - 1) * KANTA_FINALE_ROBOT_ENTRY_STAGGER_SECONDS
      + 0.08
    ) * 1000);
    const robotMovingXs = robots.map(readX);
    expect(robotMovingXs.every((x, index) => (
      x - robotStartXs[index]
    ) * Number(robots[index].dataset.kantaFinaleDirection) > 0)).toBe(true);

    const crossingTimes = robots
      .map((robot) => Number(robot.dataset.kantaFinalePickupAt))
      .sort((left, right) => left - right);
    crossingTimes.slice(1).forEach((crossingTime, index) => {
      expect(crossingTime - crossingTimes[index])
        .toBeCloseTo(KANTA_FINALE_ROBOT_ENTRY_STAGGER_SECONDS, 3);
    });
    [-1, 1].forEach((direction) => {
      const sameDirectionCrossings = robots
        .filter((robot) => Number(robot.dataset.kantaFinaleDirection) === direction)
        .map((robot) => Number(robot.dataset.kantaFinalePickupAt))
        .sort((left, right) => left - right);
      expect(sameDirectionCrossings[1] - sameDirectionCrossings[0])
        .toBeCloseTo(KANTA_FINALE_ROBOT_ENTRY_STAGGER_SECONDS * 2, 3);
    });
    expect(robots.slice(1).every((robot, index) => (
      Number(robot.dataset.kantaFinaleDirection)
      === Number(robots[index].dataset.kantaFinaleDirection) * -1
    ))).toBe(true);

    const firstPickup = pickupCans
      .map((can) => ({
        can,
        pickupAt: Number(can.dataset.kantaFinalePickupStartSeconds),
      }))
      .sort((left, right) => left.pickupAt - right.pickupAt)[0];
    scheduledPaint?.((firstPickup.pickupAt - 0.01) * 1000);
    const pickupStartY = Number(
      firstPickup.can.style.transform.match(/translate3d\(-?[\d.]+px, (-?[\d.]+)px/)?.[1],
    );
    expect(firstPickup.can.dataset.kantaFinalePickupState).toBe('waiting');
    scheduledPaint?.((
      firstPickup.pickupAt + KANTA_FINALE_PICKUP_SECONDS * KANTA_FINALE_PICKUP_APEX_PROGRESS
    ) * 1000);
    expect(firstPickup.can.style.opacity).toBe('1');
    expect(firstPickup.can.style.zIndex).toBe(String(KANTA_FINALE_PICKUP_CAN_Z_INDEX));
    const pickupApexY = Number(
      firstPickup.can.style.transform.match(/translate3d\(-?[\d.]+px, (-?[\d.]+)px/)?.[1],
    );
    expect(pickupApexY).toBeLessThan(pickupStartY);
    scheduledPaint?.((firstPickup.pickupAt + KANTA_FINALE_PICKUP_SECONDS + 0.001) * 1000);
    expect(firstPickup.can.style.opacity).toBe('0');
    expect(firstPickup.can.style.zIndex).toBe(String(KANTA_FINALE_PICKUP_CAN_Z_INDEX));
    expect(firstPickup.can.dataset.kantaFinalePickupState).toBe('removed');
    expect(readY(firstPickup.can)).toBeGreaterThan(window.innerHeight * 0.5);
    expect(Math.abs(readX(firstPickup.can))).toBeLessThanOrEqual(window.innerWidth * 0.34);
    expect(readScale(firstPickup.can)).toBeCloseTo(KANTA_FINALE_PICKUP_END_SCALE, 3);

    scheduledPaint?.(KANTA_FINALE_SCENE_SECONDS * 1000);
    const robotXs = robots.map(({ style }) => Number(
      style.transform.match(/translate3d\((-?[\d.]+)px/)?.[1],
    ));
    expect(robotXs.every((x, index) => (
      Number(robots[index].dataset.kantaFinaleDirection) > 0
        ? x > window.innerWidth * 0.5
        : x < -window.innerWidth * 0.5
    ))).toBe(true);
    expect(robots.every(({ style }) => style.opacity === '0')).toBe(true);
    expect(cans.every(({ style }) => style.opacity === '0')).toBe(true);
    expect(composites.every(({ style }) => style.opacity === '0')).toBe(true);

    cleanup.startExit?.();
    expect(field?.isConnected).toBe(true);
    cleanup();
    cleanup();

    expect(cancelFrame).toHaveBeenCalledTimes(1);
    expect(cancelFrame).toHaveBeenCalledWith(nextFrameId - 1);
    expect(overlay.querySelector('.cc-kanta-finale-scene')).toBeNull();
  });

  test('flies pickup cans 40-percent slower into bounded lower lanes with end scale growth', () => {
    const jumpHeight = 844 * KANTA_FINALE_PICKUP_JUMP_HEIGHT_RATIO;
    const start = { x: -80, y: 120 };
    const target = { x: 160, y: 180 };
    const midpoint = sampleKantaRobotPickupExit(0.5, start, target, jumpHeight);
    const apex = sampleKantaRobotPickupExit(
      KANTA_FINALE_PICKUP_APEX_PROGRESS,
      start,
      target,
      jumpHeight,
    );
    const end = sampleKantaRobotPickupExit(1, start, target, jumpHeight);

    expect(KANTA_FINALE_PICKUP_SECONDS).toBeCloseTo(0.32 / 0.60, 10);
    expect(KANTA_FINALE_PICKUP_END_SCALE).toBe(1.20);
    expect(midpoint.scale).toBeGreaterThan(1);
    expect(midpoint.scale).toBeLessThan(KANTA_FINALE_PICKUP_END_SCALE);
    expect(midpoint.x).toBeCloseTo((start.x + target.x) / 2, 8);
    expect(apex.y).toBeCloseTo(Math.min(start.y, target.y) - jumpHeight, 8);
    expect(end.x).toBe(target.x);
    expect(end.y).toBe(target.y);
    expect(end.scale).toBeCloseTo(KANTA_FINALE_PICKUP_END_SCALE, 10);
    expect(end.flightRotationEnvelope).toBeCloseTo(0, 10);
    expect(KANTA_FINALE_PICKUP_ROTATION_MIN_DEGREES).toBe(16);
    expect(KANTA_FINALE_PICKUP_ROTATION_MAX_DEGREES).toBe(44);
    expect(KANTA_FINALE_PICKUP_EXIT_LANES).toEqual([
      -0.34, -0.26, -0.18, -0.10,
      0, 0, 0,
      0.10, 0.18, 0.26, 0.34,
    ]);
    expect(KANTA_FINALE_PICKUP_MAX_SIDE_OVERFLOW_RATIO).toBe(0.10);
    expect(clampKantaPickupLaneX(390, 120, 999)).toBe(147);
    expect(clampKantaPickupLaneX(390, 120, -999)).toBe(-147);
  });

  test('randomizes a balanced two-way pickup plan with unique individual cans', () => {
    const samples = [0.91, 0.08, 0.74, 0.31, 0.62, 0.17];
    let index = 0;
    const plans = createKantaFinaleRobotPickupPlans(() => samples[index++ % samples.length]);

    expect(plans.map(({ direction }) => direction).sort()).toEqual([-1, -1, 1, 1]);
    expect(plans.slice(1).every(({ direction }, planIndex) => (
      direction === plans[planIndex].direction * -1
    ))).toBe(true);
    expect(new Set(plans.map(({ canIndex }) => canIndex)).size).toBe(4);
    expect(plans.every(({ canIndex }) => canIndex >= 0 && canIndex < 4)).toBe(true);
  });

  test('randomizes eleven balanced pickup lanes across left, centre, and right', () => {
    const first = createKantaFinalePickupLaneRatios(() => 0);
    const second = createKantaFinalePickupLaneRatios(() => 0.999999);

    for (const lanes of [first, second]) {
      expect(lanes).toHaveLength(11);
      expect(lanes.filter((lane) => lane < 0)).toHaveLength(4);
      expect(lanes.filter((lane) => lane === 0)).toHaveLength(3);
      expect(lanes.filter((lane) => lane > 0)).toHaveLength(4);
      expect(new Set(lanes)).toEqual(new Set(KANTA_FINALE_PICKUP_EXIT_LANES));
    }
    expect(first).not.toEqual(second);
  });

  test('balances seven extra cans across all four Robo passes', () => {
    const first = createKantaFinaleExtraPickupRobotIndices(() => 0);
    const second = createKantaFinaleExtraPickupRobotIndices(() => 0.999999);

    expect(first).toHaveLength(7);
    expect(second).toHaveLength(7);
    expect(new Set(first).size).toBe(4);
    expect(new Set(second).size).toBe(4);
    for (const assignments of [first, second]) {
      const counts = [0, 1, 2, 3].map((robotIndex) => (
        assignments.filter((assignedIndex) => assignedIndex === robotIndex).length
      )).sort();
      expect(counts).toEqual([1, 2, 2, 2]);
    }
    expect(first).not.toEqual(second);
    expect([...first, ...second].every((index) => index >= 0 && index < 4)).toBe(true);
  });

  test('schedules every pickup individually with randomized non-paired intervals', () => {
    const ownerCrossings = [
      1.54, 1.84, 2.14, 2.44,
      1.54, 1.84, 2.14, 2.44, 1.54, 1.84, 2.14,
    ];
    const first = createKantaFinalePickupStartTimes(ownerCrossings, () => 0);
    let roll = 0;
    const second = createKantaFinalePickupStartTimes(
      ownerCrossings,
      () => ((roll += 0.173) % 1),
    );

    expect(new Set(first).size).toBe(11);
    expect(new Set(second).size).toBe(11);
    expect(second).not.toEqual(first);
    expect(KANTA_FINALE_PICKUP_MIN_START_GAP_SECONDS).toBe(0.11);
    expect(KANTA_FINALE_PICKUP_START_JITTER_SECONDS).toBe(0.18);
    expect(KANTA_FINALE_PICKUP_START_ADVANCE_SECONDS).toBe(0.40);
    expect(KANTA_FINALE_LAST_PICKUP_EXTRA_ADVANCE_SECONDS).toBe(0.15);
    expect(Math.min(...first)).toBeLessThanOrEqual(
      Math.min(...ownerCrossings) - KANTA_FINALE_PICKUP_START_ADVANCE_SECONDS,
    );
    for (const schedule of [first, second].map((values) => (
      [...values].sort((left, right) => left - right)
    ))) {
      schedule.slice(1).forEach((start, index) => {
        expect(start - schedule[index]).toBeGreaterThanOrEqual(
          KANTA_FINALE_PICKUP_MIN_START_GAP_SECONDS - Number.EPSILON,
        );
      });
    }
  });
});
