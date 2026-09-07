// Dedicated Kanta merge-6 collection scene.
// One RAF owns four bottom robots, eleven stacked Kante,
// three foreground Kanta composites and their atomic enter/exit cleanup.

import {
  type RoboTravelDirection,
} from './board-transition-robo-variation.js';

const use2x = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

export const KANTA_FINALE_ROBOT_COUNT = 4;
export const KANTA_FINALE_ROBOT_SCALE = (((1.8 * 3) / 2) * 0.70) * 2;
export const KANTA_FINALE_ROBOT_SOURCES = [
  `./assets/journey assets/robo/robo1${use2x ? '@2x' : ''}.png`,
  `./assets/journey assets/robo/robo frontalni${use2x ? '@2x' : ''}.png`,
] as const;
export const KANTA_FINALE_CAN_COUNT = 11;
export const KANTA_FINALE_EXTRA_PICKUP_CAN_COUNT = 7;
export const KANTA_FINALE_CAN_SOURCES = [
  './assets/shop/kanta/01.png',
  './assets/shop/kanta/03.png',
  './assets/shop/kanta/04.png',
] as const;
export const KANTA_FINALE_ENTRY_SECONDS = 0.36;
export const KANTA_FINALE_COMPOSITE_ENTRY_SECONDS = KANTA_FINALE_ENTRY_SECONDS + 0.40;
export const KANTA_FINALE_COMPOSITE_ENTRY_BACK_STRENGTH = 2.65;
export const KANTA_FINALE_COMPOSITE_ENTRY_DELAY_SECONDS = 0;
export const KANTA_FINALE_COMPOSITE_ENTRY_TRAVEL_PX = 125;
export const KANTA_FINALE_ROBOT_RAISE_RATIO = 0.14 + 0.08;
export const KANTA_FINALE_ROBOT_LOWER_RATIO = 0.35;
export const KANTA_FINALE_ROBOT_ENTRY_DELAY_SECONDS = 0.80;
export const KANTA_FINALE_ROBOT_ENTRY_STAGGER_SECONDS = 0.30;
export const KANTA_FINALE_ROBOT_TRAVEL_SECONDS = 1.48;
export const KANTA_FINALE_PICKUP_BASE_SECONDS = 0.32;
export const KANTA_FINALE_PICKUP_SECONDS = KANTA_FINALE_PICKUP_BASE_SECONDS / 0.60;
export const KANTA_FINALE_POST_PICKUP_EXIT_HOLD_SECONDS = 0.30;
export const KANTA_FINALE_EXIT_ADVANCE_SECONDS = 0.50;
export const KANTA_FINALE_EXIT_DURATION_SECONDS = 0.58;
export const KANTA_FINALE_CLEANUP_MARGIN_SECONDS = 0.02;
export const KANTA_FINALE_EXIT_START_SECONDS = KANTA_FINALE_ROBOT_ENTRY_DELAY_SECONDS
  + (KANTA_FINALE_ROBOT_COUNT - 1) * KANTA_FINALE_ROBOT_ENTRY_STAGGER_SECONDS
  + KANTA_FINALE_ROBOT_TRAVEL_SECONDS * 0.5
  + KANTA_FINALE_PICKUP_BASE_SECONDS
  + KANTA_FINALE_POST_PICKUP_EXIT_HOLD_SECONDS
  - KANTA_FINALE_EXIT_ADVANCE_SECONDS;
export const KANTA_FINALE_LAST_ROBOT_END_SECONDS = KANTA_FINALE_ROBOT_ENTRY_DELAY_SECONDS
  + (KANTA_FINALE_ROBOT_COUNT - 1) * KANTA_FINALE_ROBOT_ENTRY_STAGGER_SECONDS
  + KANTA_FINALE_ROBOT_TRAVEL_SECONDS;
export const KANTA_FINALE_SCENE_SECONDS = Math.max(
  KANTA_FINALE_EXIT_START_SECONDS
    + KANTA_FINALE_EXIT_DURATION_SECONDS
    + KANTA_FINALE_CLEANUP_MARGIN_SECONDS,
  KANTA_FINALE_LAST_ROBOT_END_SECONDS,
);
export const KANTA_FINALE_ROBOT_Z_INDEX = 11;
export const KANTA_FINALE_ROBOT_STEP_BOUNCE_PX = 10;
export const KANTA_FINALE_ROBOT_WALK_ROTATION_MIN_DEGREES = 5;
export const KANTA_FINALE_ROBOT_WALK_ROTATION_MAX_DEGREES = 10;
export const KANTA_FINALE_PICKUP_CAN_Z_INDEX = 14;
export const KANTA_FINALE_PICKUP_APEX_PROGRESS = 0.42;
export const KANTA_FINALE_PICKUP_JUMP_HEIGHT_RATIO = 0.12;
export const KANTA_FINALE_PICKUP_END_SCALE = 1.20;
export const KANTA_FINALE_PICKUP_EXIT_LANES = [
  -0.34, -0.26, -0.18, -0.10,
  0, 0, 0,
  0.10, 0.18, 0.26, 0.34,
] as const;
export const KANTA_FINALE_PICKUP_MAX_SIDE_OVERFLOW_RATIO = 0.10;
export const KANTA_FINALE_PICKUP_ROTATION_MIN_DEGREES = 16;
export const KANTA_FINALE_PICKUP_ROTATION_MAX_DEGREES = 44;
export const KANTA_FINALE_PICKUP_MIN_START_GAP_SECONDS = 0.11;
export const KANTA_FINALE_PICKUP_START_JITTER_SECONDS = 0.18;
export const KANTA_FINALE_PICKUP_START_ADVANCE_SECONDS = 0.40;
export const KANTA_FINALE_LAST_PICKUP_EXTRA_ADVANCE_SECONDS = 0.15;
export const KANTA_FINALE_CAN_SCALE = (4 / 2.3) * 2 * 0.60 * 1.24;
export const KANTA_FINALE_CAN_SOURCE_ASPECT_RATIO = 171 / 128;
// Net offset after lifting every standalone can by 30% of its own rendered height.
export const KANTA_FINALE_INDIVIDUAL_CAN_LOWER_RATIO = -0.02;
export const KANTA_FINALE_UPPER_CAN_COUNT = 4;
export const KANTA_FINALE_UPPER_CAN_EXTRA_LOWER_RATIO = 0.10;
export const KANTA_FINALE_UPPER_CAN_ROTATION_VARIANCE_DEGREES = 5;
export const KANTA_FINALE_EXTRA_PICKUP_CAN_RAISE_RATIO = 0.40;
export const KANTA_FINALE_FEATURED_CAN_INDEX = 6;
export const KANTA_FINALE_FEATURED_CAN_SCALE = 0.85 * 0.90;
export const KANTA_FINALE_FEATURED_CAN_LOWER_RATIO = 0.35;
export const KANTA_FINALE_FEATURED_CAN_RIGHT_PX = 20;
export const KANTA_FINALE_FEATURED_CAN_Z_INDEX_OFFSET = -1;
export const KANTA_FINALE_GROUND_BELOW_VIEWPORT_RATIO = 0.10;
export const KANTA_FINALE_SIDE_COMPOSITE_LIFT_RATIO = 0.05;
export const KANTA_FINALE_COMPOSITE_SCALE = 1.5;
export const KANTA_FINALE_CAN_PILE_SLOTS = [
  // Smaller rear crown.
  { x: -105, rise: 128, rotation: -13, width: 45, zIndex: 7 },
  { x: -35, rise: 132, rotation: 8, width: 48, zIndex: 7 },
  { x: 35, rise: 126.6, rotation: -6, width: 47, zIndex: 7 },
  { x: 105, rise: 127.6, rotation: 14, width: 45, zIndex: 7 },
  // Interlocked middle row.
  { x: -120, rise: 51, rotation: -18, width: 54, zIndex: 8 },
  { x: -60, rise: 70, rotation: 10, width: 58, zIndex: 8 },
  { x: 0, rise: 77, rotation: -4, width: 62, zIndex: 8 },
  { x: 60, rise: 66, rotation: 11, width: 57, zIndex: 8 },
  { x: 120, rise: 47, rotation: 17, width: 52, zIndex: 8 },
  // Largest foreground barrels hide the seams and sell one dense heap.
  { x: -78, rise: 3, rotation: -11, width: 65, zIndex: 9 },
  { x: 0, rise: 0, rotation: 3, width: 72, zIndex: 10 },
  { x: 78, rise: 5, rotation: 13, width: 64, zIndex: 9 },
] as const;
export const KANTA_FINALE_COMPOSITE_SPECS = [
  {
    id: 'left',
    source: './assets/shop/kanta/kante-ljevo.png',
    width: 210 * KANTA_FINALE_COMPOSITE_SCALE,
    sourceAspectRatio: 180 / 240,
    x: -105,
    liftFromCenterRatio: KANTA_FINALE_SIDE_COMPOSITE_LIFT_RATIO,
    zIndex: 12,
  },
  {
    id: 'center',
    source: './assets/shop/kanta/kante-sredina.png',
    width: 330 * KANTA_FINALE_COMPOSITE_SCALE,
    sourceAspectRatio: 219 / 390,
    x: 0,
    liftFromCenterRatio: 0,
    zIndex: 13,
  },
  {
    id: 'right',
    source: './assets/shop/kanta/kante-desno.png',
    width: 210 * KANTA_FINALE_COMPOSITE_SCALE,
    sourceAspectRatio: 180 / 240,
    x: 105,
    liftFromCenterRatio: KANTA_FINALE_SIDE_COMPOSITE_LIFT_RATIO,
    zIndex: 12,
  },
] as const;

type KantaFinaleCleanup = (() => void) & {
  startExit?: () => void;
  completionDelaySeconds?: number;
};

type Point = { x: number; y: number };

let preloadPromise: Promise<void> | null = null;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smoothstep = (value: number) => {
  const progress = clamp01(value);
  return progress * progress * (3 - 2 * progress);
};
const easeOutCubic = (value: number) => 1 - (1 - clamp01(value)) ** 3;
const easeOutBack = (value: number, strength = 1.70158) => {
  const progress = clamp01(value);
  const shifted = progress - 1;
  return 1 + (strength + 1) * shifted ** 3 + strength * shifted ** 2;
};
export const sampleKantaCompositeEntry = (progress: number) => easeOutBack(
  progress,
  KANTA_FINALE_COMPOSITE_ENTRY_BACK_STRENGTH,
);
export function sampleKantaRobotPickupExit(
  progress: number,
  start: Point,
  movingTarget: Point,
  jumpHeightPx: number,
): Readonly<{ x: number; y: number; scale: number; flightRotationEnvelope: number }> {
  const clampedProgress = clamp01(progress);
  const travel = smoothstep(clampedProgress);
  const apexY = Math.min(start.y, movingTarget.y) - jumpHeightPx;
  const descent = (clampedProgress - KANTA_FINALE_PICKUP_APEX_PROGRESS)
    / (1 - KANTA_FINALE_PICKUP_APEX_PROGRESS);
  const landingTravel = descent <= 0.78
    ? (descent / 0.78) ** 2 * 0.86
    : 0.86 + easeOutBack((descent - 0.78) / 0.22, 1.8) * 0.14;
  const y = clampedProgress <= KANTA_FINALE_PICKUP_APEX_PROGRESS
    ? start.y + (apexY - start.y) * easeOutBack(
      clampedProgress / KANTA_FINALE_PICKUP_APEX_PROGRESS,
      1.9,
    )
    : apexY + (movingTarget.y - apexY) * landingTravel;
  return {
    x: start.x + (movingTarget.x - start.x) * travel,
    y,
    scale: 1 + (KANTA_FINALE_PICKUP_END_SCALE - 1) * easeOutCubic(clampedProgress),
    flightRotationEnvelope: Math.sin(clampedProgress * Math.PI),
  };
}
export function clampKantaPickupLaneX(
  viewportWidth: number,
  renderedCanWidth: number,
  x: number,
): number {
  const maximumCenterX = viewportWidth * 0.5
    - renderedCanWidth * (0.5 - KANTA_FINALE_PICKUP_MAX_SIDE_OVERFLOW_RATIO);
  return Math.max(-maximumCenterX, Math.min(maximumCenterX, x));
}
const easeInBack = (value: number) => {
  const progress = clamp01(value);
  const strength = 1.70158;
  return (strength + 1) * progress ** 3 - strength * progress ** 2;
};

export type KantaFinaleRobotPickupPlan = Readonly<{
  direction: RoboTravelDirection;
  canIndex: number;
}>;

const boundedRandom = (random: () => number) => {
  const value = Number(random());
  return Number.isFinite(value) ? Math.max(0, Math.min(0.999999, value)) : 0.5;
};

function shuffleWithRandom<T>(values: readonly T[], random: () => number): T[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(boundedRandom(random) * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function createKantaFinaleExtraPickupRobotIndices(
  random: () => number = Math.random,
): readonly number[] {
  const robotOrder = shuffleWithRandom(
    Array.from({ length: KANTA_FINALE_ROBOT_COUNT }, (_, index) => index),
    random,
  );
  return Object.freeze(shuffleWithRandom(
    Array.from(
      { length: KANTA_FINALE_EXTRA_PICKUP_CAN_COUNT },
      (_, index) => robotOrder[index % robotOrder.length],
    ),
    random,
  ));
}

export function createKantaFinalePickupLaneRatios(
  random: () => number = Math.random,
): readonly number[] {
  return Object.freeze(shuffleWithRandom(KANTA_FINALE_PICKUP_EXIT_LANES, random));
}

export function createKantaFinalePickupStartTimes(
  ownerCrossingSeconds: readonly number[],
  random: () => number = Math.random,
): readonly number[] {
  const candidates = ownerCrossingSeconds.map((ownerCrossing, canIndex) => ({
    canIndex,
    desiredStart: ownerCrossing - KANTA_FINALE_PICKUP_START_ADVANCE_SECONDS
      + boundedRandom(random) * KANTA_FINALE_PICKUP_START_JITTER_SECONDS,
  })).sort((left, right) => (
    left.desiredStart - right.desiredStart
    || left.canIndex - right.canIndex
  ));
  const scheduled = Array<number>(ownerCrossingSeconds.length);
  let previousStart = Number.NEGATIVE_INFINITY;
  candidates.forEach(({ canIndex, desiredStart }) => {
    const randomGap = KANTA_FINALE_PICKUP_MIN_START_GAP_SECONDS
      + boundedRandom(random) * (
        KANTA_FINALE_PICKUP_START_JITTER_SECONDS
        - KANTA_FINALE_PICKUP_MIN_START_GAP_SECONDS
      );
    const pickupStart = Math.max(desiredStart, previousStart + randomGap);
    scheduled[canIndex] = pickupStart;
    previousStart = pickupStart;
  });
  const latestFirst = [...scheduled.keys()].sort((left, right) => (
    scheduled[left] - scheduled[right]
  ));
  const lastCanIndex = latestFirst[latestFirst.length - 1];
  scheduled[lastCanIndex] -= KANTA_FINALE_LAST_PICKUP_EXTRA_ADVANCE_SECONDS;
  for (let index = latestFirst.length - 2; index >= 0; index -= 1) {
    const canIndex = latestFirst[index];
    const nextCanIndex = latestFirst[index + 1];
    scheduled[canIndex] = Math.min(
      scheduled[canIndex],
      scheduled[nextCanIndex] - KANTA_FINALE_PICKUP_MIN_START_GAP_SECONDS,
    );
  }
  return Object.freeze(scheduled);
}

export function createKantaFinaleRobotPickupPlans(
  random: () => number = Math.random,
): readonly KantaFinaleRobotPickupPlan[] {
  const firstDirection: RoboTravelDirection = boundedRandom(random) < 0.5 ? -1 : 1;
  const directions: RoboTravelDirection[] = [
    firstDirection,
    (firstDirection * -1) as RoboTravelDirection,
    firstDirection,
    (firstDirection * -1) as RoboTravelDirection,
  ];
  const canIndices = shuffleWithRandom([0, 1, 2, 3], random);
  return Object.freeze(directions.map((direction, index) => Object.freeze({
    direction,
    canIndex: canIndices[index],
  })));
}

export function preloadKantaFinaleAssets(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  if (typeof Image === 'undefined') return Promise.resolve();
  const sources = Array.from(new Set([
    ...KANTA_FINALE_ROBOT_SOURCES,
    ...KANTA_FINALE_CAN_SOURCES,
    ...KANTA_FINALE_COMPOSITE_SPECS.map(({ source }) => source),
  ]));
  preloadPromise = Promise.all(sources.map((src) => new Promise<void>((resolve) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = src;
  }))).then(() => undefined);
  return preloadPromise;
}

function createSceneImage(
  className: string,
  source: string,
  width: number,
  zIndex: number,
): HTMLImageElement {
  const image = document.createElement('img');
  image.className = className;
  image.alt = '';
  image.setAttribute('aria-hidden', 'true');
  image.draggable = false;
  image.src = source;
  image.style.cssText = [
    'position:absolute',
    'left:50%',
    'top:50%',
    `width:${width}px`,
    'height:auto',
    'opacity:0',
    `z-index:${zIndex}`,
    'pointer-events:none',
    'user-select:none',
    '-webkit-user-drag:none',
    'transform-origin:50% 100%',
    'will-change:transform,opacity',
  ].join(';');
  return image;
}

export function attachKantaFinaleScene(
  overlay: HTMLElement,
  zIndex = 2,
): KantaFinaleCleanup {
  if (!overlay) return (() => {}) as KantaFinaleCleanup;

  const field = document.createElement('div');
  field.className = 'cc-kanta-finale-scene';
  field.style.cssText = [
    'position:absolute',
    'inset:0',
    'overflow:hidden',
    'pointer-events:none',
    `z-index:${zIndex}`,
    'contain:layout style paint',
  ].join(';');

  const viewportWidth = Math.max(320, window.innerWidth || 390);
  const viewportHeight = Math.max(520, window.innerHeight || 844);
  const robotPlans = createKantaFinaleRobotPickupPlans();
  const extraPickupRobotIndices = createKantaFinaleExtraPickupRobotIndices();
  const pickupLaneRatios = createKantaFinalePickupLaneRatios();

  type RobotRuntime = {
    element: HTMLImageElement;
    width: number;
    restY: number;
    startX: number;
    endX: number;
    phaseOffset: number;
    direction: RoboTravelDirection;
    entryDelay: number;
    centerCrossingSeconds: number;
    pickupCanIndex: number;
    walkRotationAmplitude: number;
  };
  const robots: RobotRuntime[] = Array.from({ length: KANTA_FINALE_ROBOT_COUNT }, (_, index) => {
    const plan = robotPlans[index];
    const sourceIndex = plan.direction < 0 ? 0 : 1;
    const source = KANTA_FINALE_ROBOT_SOURCES[sourceIndex];
    const width = Number((
      (sourceIndex === 0 ? 92 : 108) * KANTA_FINALE_ROBOT_SCALE
    ).toFixed(2));
    const element = createSceneImage(
      'cc-kanta-finale-robot',
      source,
      width,
      KANTA_FINALE_ROBOT_Z_INDEX,
    );
    element.dataset.kantaFinaleRobot = String(index);
    element.dataset.kantaFinaleDirection = String(plan.direction);
    element.dataset.kantaFinalePickupCan = String(plan.canIndex);
    field.appendChild(element);
    const laneOffsetY = plan.direction * 34 + (index < 2 ? -8 : 8);
    const restY = viewportHeight * 0.5
      - width * 0.51
      - width * KANTA_FINALE_ROBOT_RAISE_RATIO
      + width * KANTA_FINALE_ROBOT_LOWER_RATIO
      - 2
      + laneOffsetY;
    const leftX = -viewportWidth * 0.5 - width * 0.65;
    const rightX = viewportWidth * 0.5
      + width * 0.65;
    const startX = plan.direction > 0 ? leftX : rightX;
    const endX = plan.direction > 0 ? rightX : leftX;
    const entryDelay = Number((
      KANTA_FINALE_ROBOT_ENTRY_DELAY_SECONDS
      + index * KANTA_FINALE_ROBOT_ENTRY_STAGGER_SECONDS
    ).toFixed(4));
    const travelDuration = KANTA_FINALE_ROBOT_TRAVEL_SECONDS;
    const centerProgress = (0 - startX) / (endX - startX);
    const centerCrossingSeconds = entryDelay + travelDuration * centerProgress;
    const walkRotationAmplitude = KANTA_FINALE_ROBOT_WALK_ROTATION_MIN_DEGREES
      + Math.random() * (
        KANTA_FINALE_ROBOT_WALK_ROTATION_MAX_DEGREES
        - KANTA_FINALE_ROBOT_WALK_ROTATION_MIN_DEGREES
      );
    element.dataset.kantaFinaleEntryAt = entryDelay.toFixed(4);
    element.dataset.kantaFinalePickupAt = centerCrossingSeconds.toFixed(4);
    element.dataset.kantaFinaleWalkRotationAmplitude = walkRotationAmplitude.toFixed(4);
    return {
      element,
      width,
      restY,
      startX,
      endX,
      phaseOffset: Math.random() * Math.PI * 2,
      direction: plan.direction,
      entryDelay,
      centerCrossingSeconds,
      pickupCanIndex: plan.canIndex,
      walkRotationAmplitude,
    };
  });

  type CanRuntime = {
    element: HTMLImageElement;
    phaseOffset: number;
    restX: number;
    restY: number;
    rotation: number;
    entryDelay: number;
    pickupRobot: RobotRuntime | null;
    pickupTarget: Point;
    baseZIndex: number;
    pickupRotation: number;
    pickupStartSeconds: number;
  };
  const pickupRobotIndices = Array.from({ length: KANTA_FINALE_CAN_COUNT }, (_, index) => {
    if (index >= KANTA_FINALE_UPPER_CAN_COUNT) {
      return extraPickupRobotIndices[index - KANTA_FINALE_UPPER_CAN_COUNT];
    }
    return robots.findIndex(({ pickupCanIndex }) => pickupCanIndex === index);
  });
  const pickupStartSeconds = createKantaFinalePickupStartTimes(
    pickupRobotIndices.map((robotIndex) => robots[robotIndex].centerCrossingSeconds),
  );
  const cans: CanRuntime[] = Array.from({ length: KANTA_FINALE_CAN_COUNT }, (_, index) => {
    const pileSlot = KANTA_FINALE_CAN_PILE_SLOTS[index];
    const isUpperCan = index < KANTA_FINALE_UPPER_CAN_COUNT;
    const isFeaturedCan = index === KANTA_FINALE_FEATURED_CAN_INDEX;
    const featuredScale = isFeaturedCan ? KANTA_FINALE_FEATURED_CAN_SCALE : 1;
    const baseZIndex = pileSlot.zIndex
      + (isFeaturedCan ? KANTA_FINALE_FEATURED_CAN_Z_INDEX_OFFSET : 0);
    const renderedCanWidth = pileSlot.width * KANTA_FINALE_CAN_SCALE * featuredScale;
    const renderedCanHeight = pileSlot.width
      * KANTA_FINALE_CAN_SCALE
      * featuredScale
      * KANTA_FINALE_CAN_SOURCE_ASPECT_RATIO;
    const upperCanExtraLowerPx = isUpperCan
      ? renderedCanHeight * KANTA_FINALE_UPPER_CAN_EXTRA_LOWER_RATIO
      : 0;
    const remainingCanRaisePx = isUpperCan
      ? 0
      : renderedCanHeight * KANTA_FINALE_EXTRA_PICKUP_CAN_RAISE_RATIO;
    const upperCanRotationOffset = isUpperCan
      ? (Math.random() * 2 - 1) * KANTA_FINALE_UPPER_CAN_ROTATION_VARIANCE_DEGREES
      : 0;
    const element = createSceneImage(
      'cc-kanta-finale-stacked-can',
      KANTA_FINALE_CAN_SOURCES[index % KANTA_FINALE_CAN_SOURCES.length],
      renderedCanWidth,
      baseZIndex,
    );
    element.dataset.kantaFinaleStackedCan = String(index);
    element.dataset.kantaFinaleUpperCan = String(isUpperCan);
    element.dataset.kantaFinaleUpperLowerPx = upperCanExtraLowerPx.toFixed(4);
    element.dataset.kantaFinaleRemainingRaisePx = remainingCanRaisePx.toFixed(4);
    element.dataset.kantaFinaleUpperRotationOffset = upperCanRotationOffset.toFixed(4);
    element.dataset.kantaFinaleFeaturedCan = String(isFeaturedCan);
    const pickupRobotIndex = pickupRobotIndices[index];
    const pickupRobot = robots[pickupRobotIndex];
    const pickupLaneRatio = pickupRobotIndex < 0 ? 0 : pickupLaneRatios[index];
    const pickupTarget = {
      x: clampKantaPickupLaneX(
        viewportWidth,
        renderedCanWidth * KANTA_FINALE_PICKUP_END_SCALE,
        viewportWidth * pickupLaneRatio,
      ),
      y: viewportHeight * 0.5 + renderedCanHeight * 0.40,
    };
    if (pickupRobot) {
      element.dataset.kantaFinalePickupOwner = pickupRobot.element.dataset.kantaFinaleRobot;
      element.dataset.kantaFinalePickupLane = String(pickupLaneRatio);
      element.dataset.kantaFinalePickupStartSeconds = pickupStartSeconds[index].toFixed(4);
    }
    const pickupRotationSign = Math.random() < 0.5 ? -1 : 1;
    const pickupRotationMagnitude = KANTA_FINALE_PICKUP_ROTATION_MIN_DEGREES
      + Math.random() * (
        KANTA_FINALE_PICKUP_ROTATION_MAX_DEGREES
        - KANTA_FINALE_PICKUP_ROTATION_MIN_DEGREES
      );
    const pickupRotation = pickupRobot
      ? pickupRotationSign * pickupRotationMagnitude
      : 0;
    element.dataset.kantaFinalePickupRotation = pickupRotation.toFixed(4);
    field.appendChild(element);
    return {
      element,
      phaseOffset: (index % 3 - 1) * 0.16,
      restX: pileSlot.x + (isFeaturedCan ? KANTA_FINALE_FEATURED_CAN_RIGHT_PX : 0),
      restY: viewportHeight * 0.5
        - renderedCanHeight * 0.5
        - pileSlot.rise * 1.7
        + renderedCanHeight * KANTA_FINALE_INDIVIDUAL_CAN_LOWER_RATIO
        + viewportHeight * KANTA_FINALE_GROUND_BELOW_VIEWPORT_RATIO
        + upperCanExtraLowerPx
        + (isFeaturedCan ? renderedCanHeight * KANTA_FINALE_FEATURED_CAN_LOWER_RATIO : 0)
        - remainingCanRaisePx,
      rotation: pileSlot.rotation + upperCanRotationOffset,
      entryDelay: 0.12 + index * 0.026,
      pickupRobot: pickupRobot ?? null,
      pickupTarget,
      baseZIndex,
      pickupRotation,
      pickupStartSeconds: pickupStartSeconds[index],
    };
  });

  type CompositeRuntime = {
    element: HTMLImageElement;
    restX: number;
    restY: number;
  };
  const composites: CompositeRuntime[] = KANTA_FINALE_COMPOSITE_SPECS.map((spec) => {
    const element = createSceneImage(
      'cc-kanta-finale-composite-pile',
      spec.source,
      spec.width,
      spec.zIndex,
    );
    element.dataset.kantaFinaleComposite = spec.id;
    field.appendChild(element);
    return {
      element,
      restX: spec.x,
      restY: viewportHeight * 0.5
        - spec.width * spec.sourceAspectRatio * 0.5
        + viewportHeight * KANTA_FINALE_GROUND_BELOW_VIEWPORT_RATIO
        - viewportHeight * spec.liftFromCenterRatio,
    };
  });

  overlay.appendChild(field);
  void preloadKantaFinaleAssets();

  const paintRobot = (runtime: RobotRuntime, elapsedSeconds: number) => {
    const activeElapsed = elapsedSeconds - runtime.entryDelay;
    if (activeElapsed < 0) {
      runtime.element.style.opacity = '0';
      return;
    }
    const travelDuration = KANTA_FINALE_ROBOT_TRAVEL_SECONDS;
    const travel = clamp01(activeElapsed / travelDuration);
    const stepY = Math.abs(Math.sin(activeElapsed * 6.2 + runtime.phaseOffset))
      * -KANTA_FINALE_ROBOT_STEP_BOUNCE_PX;
    const x = runtime.startX + (runtime.endX - runtime.startX) * travel;
    const y = runtime.restY + stepY;
    const scale = 0.82 + smoothstep(activeElapsed / 0.18) * 0.18;
    const rotation = Math.sin(activeElapsed * 6.2 + runtime.phaseOffset)
      * runtime.walkRotationAmplitude
      + runtime.direction * 3;
    const hasCompletedTravel = activeElapsed >= travelDuration - 0.0001;
    runtime.element.style.opacity = hasCompletedTravel ? '0' : '1';
    runtime.element.style.transform = [
      'translate(-50%, -50%)',
      `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`,
      `rotate(${rotation.toFixed(2)}deg)`,
      `scale(${scale.toFixed(4)})`,
    ].join(' ');
  };

  const paintCan = (runtime: CanRuntime, elapsedSeconds: number) => {
    const localEntry = elapsedSeconds - runtime.entryDelay;
    if (localEntry < 0) return;
    const entry = easeOutBack(localEntry / KANTA_FINALE_ENTRY_SECONDS);
    const localPickup = runtime.pickupRobot === null
      ? -1
      : elapsedSeconds - runtime.pickupStartSeconds;
    const pickupProgress = localPickup < 0
      ? 0
      : clamp01(localPickup / KANTA_FINALE_PICKUP_SECONDS);
    const isPickupOwned = runtime.pickupRobot !== null;
    const isPickingUp = isPickupOwned && localPickup >= 0 && pickupProgress < 1;
    const isPickupRemoved = isPickupOwned && pickupProgress >= 1;
    const holdElapsed = Math.max(0, elapsedSeconds - KANTA_FINALE_ENTRY_SECONDS);
    const pileSway = Math.sin(holdElapsed * 2.8 + runtime.phaseOffset) * 3
      * (1 - clamp01(localPickup / KANTA_FINALE_PICKUP_SECONDS));
    const startY = runtime.restY + 225;
    const restingX = runtime.restX * entry + pileSway;
    const pickupOriginSway = runtime.pickupRobot === null
      ? 0
      : Math.sin(
        Math.max(0, runtime.pickupStartSeconds - KANTA_FINALE_ENTRY_SECONDS) * 2.8
          + runtime.phaseOffset,
      ) * 3;
    const pickupOrigin = { x: runtime.restX + pickupOriginSway, y: runtime.restY };
    const pickupTarget = runtime.pickupRobot === null ? pickupOrigin : runtime.pickupTarget;
    const pickupSample = sampleKantaRobotPickupExit(
      pickupProgress,
      pickupOrigin,
      pickupTarget,
      viewportHeight * KANTA_FINALE_PICKUP_JUMP_HEIGHT_RATIO,
    );
    const settledY = startY + (runtime.restY - startY) * entry;
    const hasPickupStarted = isPickupOwned && localPickup >= 0;
    const x = hasPickupStarted ? pickupSample.x : restingX;
    const y = hasPickupStarted
      ? pickupSample.y
      : settledY;
    const removalElapsed = localPickup;
    const anticipation = removalElapsed > 0 && removalElapsed < 0.20
      ? Math.sin((removalElapsed / 0.20) * Math.PI) * 0.10
      : 0;
    const pickupScale = hasPickupStarted ? pickupSample.scale : 1;
    const scaleX = (0.72 + entry * 0.28 + anticipation) * pickupScale;
    const scaleY = (0.72 + entry * 0.28 - anticipation * 0.65) * pickupScale;
    runtime.element.dataset.kantaFinalePickupState = isPickingUp
      ? 'pickup'
      : isPickupRemoved
        ? 'removed'
        : 'waiting';
    runtime.element.style.zIndex = String(
      hasPickupStarted
        ? KANTA_FINALE_PICKUP_CAN_Z_INDEX
        : runtime.baseZIndex,
    );
    runtime.element.style.opacity = isPickupRemoved ? '0' : '1';
    runtime.element.style.transform = [
      'translate(-50%, -50%)',
      `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`,
      `rotate(${(
        runtime.rotation
        + pileSway * 0.22
        + runtime.pickupRotation * pickupSample.flightRotationEnvelope * (isPickingUp ? 1 : 0)
      ).toFixed(2)}deg)`,
      `scale(${scaleX.toFixed(4)}, ${scaleY.toFixed(4)})`,
    ].join(' ');
  };

  const paintComposite = (runtime: CompositeRuntime, elapsedSeconds: number) => {
    const localEntry = elapsedSeconds - KANTA_FINALE_COMPOSITE_ENTRY_DELAY_SECONDS;
    if (localEntry < 0) return;
    const entry = sampleKantaCompositeEntry(localEntry / KANTA_FINALE_COMPOSITE_ENTRY_SECONDS);
    const localExit = elapsedSeconds - KANTA_FINALE_EXIT_START_SECONDS;
    const exit = easeInBack(localExit / KANTA_FINALE_EXIT_DURATION_SECONDS);
    const holdElapsed = Math.max(0, localEntry - KANTA_FINALE_COMPOSITE_ENTRY_SECONDS);
    const pileSway = Math.sin(holdElapsed * 2.8) * 2
      * (1 - clamp01(localExit / KANTA_FINALE_EXIT_DURATION_SECONDS));
    const startY = runtime.restY + KANTA_FINALE_COMPOSITE_ENTRY_TRAVEL_PX;
    const exitY = viewportHeight * 0.72 + 180;
    const x = runtime.restX * entry + pileSway;
    const y = startY + (runtime.restY - startY) * entry + (exitY - runtime.restY) * exit;
    const anticipation = localExit > 0 && localExit < 0.20
      ? Math.sin((localExit / 0.20) * Math.PI) * 0.10
      : 0;
    const scaleX = 0.72 + entry * 0.28 + anticipation;
    const scaleY = 0.72 + entry * 0.28 - anticipation * 0.65;
    runtime.element.style.opacity = exit < 0.98 ? '1' : '0';
    runtime.element.style.transform = [
      'translate(-50%, -50%)',
      `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`,
      `scale(${scaleX.toFixed(4)}, ${scaleY.toFixed(4)})`,
    ].join(' ');
  };

  let disposed = false;
  let animationFrameId = 0;
  const startedAt = performance.now();
  const paint = (now: number) => {
    if (disposed) return;
    const elapsedSeconds = Math.max(0, (now - startedAt) / 1000);
    robots.forEach((robot) => paintRobot(robot, elapsedSeconds));
    cans.forEach((can) => paintCan(can, elapsedSeconds));
    composites.forEach((composite) => paintComposite(composite, elapsedSeconds));
    if (elapsedSeconds < KANTA_FINALE_SCENE_SECONDS) {
      animationFrameId = window.requestAnimationFrame(paint);
    }
  };
  animationFrameId = window.requestAnimationFrame(paint);

  const cleanup = (() => {
    if (disposed) return;
    disposed = true;
    if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
    field.remove();
  }) as KantaFinaleCleanup;
  cleanup.startExit = () => {};
  cleanup.completionDelaySeconds = KANTA_FINALE_SCENE_SECONDS;
  return cleanup;
}
