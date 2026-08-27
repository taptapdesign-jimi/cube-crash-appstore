import { gsap } from 'gsap';
import animationManager from './animation-manager.js';
import { logger } from '../core/logger.js';

const PACK = './assets/shop/spaceship';
export const SPACESHIP_SCENE_SECONDS = 3.8;
const SCENE_SECONDS = SPACESHIP_SCENE_SECONDS;
const useHighResolutionAssets = typeof window !== 'undefined' && window.devicePixelRatio > 1.5;
const source = (name: string) => `${PACK}/${name}${useHighResolutionAssets ? '@2x' : ''}.png`;
const SAUCER_SOURCES = Array.from({ length: 4 }, (_, index) => source(`saucer${index + 1}`));
export const SPACESHIP_SAUCER_FRAME_START_AT_SECONDS = 0.20;
export const SPACESHIP_SAUCER_FRAME_STEP_SECONDS = 0.11;
export const SPACESHIP_SAUCER_FRAME_COUNT = Math.floor(
  (SPACESHIP_SCENE_SECONDS - SPACESHIP_SAUCER_FRAME_START_AT_SECONDS)
    / SPACESHIP_SAUCER_FRAME_STEP_SECONDS,
) + 1;
const ROCK_SOURCES = Array.from({ length: 7 }, (_, index) => source(`rock${index + 1}`));
const CAN_SOURCES = Array.from({ length: 5 }, (_, index) => source(`kanta${index + 1}`));
const BOARD_TILE_SOURCE = `./assets/tile${useHighResolutionAssets ? '@2x' : ''}.png`;
export const SPACESHIP_BEAM_SHIMMER_LEVELS = [1, 0.9, 0.5, 0.6, 0.3] as const;
export const SPACESHIP_RIGHT_BEAM_LEAD_LEVELS = [0.5, 0.6, 0.4, 1] as const;
export const SPACESHIP_BEAM_EXIT_FLASH_LEVELS = [1, 0, 1, 0, 0.7, 0, 0.4, 0] as const;
export const SPACESHIP_BEAM_EXIT_ALTERNATING_STATES = [
  [1, 0],
  [0, 1],
  [0.85, 0],
  [0, 0.75],
  [0.65, 0],
  [0, 0.55],
  [0.4, 0],
  [0, 0],
] as const;
export const SPACESHIP_BEAM_EXIT_FLASH_DURATION = 0.009;
export const SPACESHIP_BEAM_EXIT_FADE_DURATION = 0.009;
export const SPACESHIP_SAUCER_EXIT_LANES = [-1, 1] as const;
export const SPACESHIP_SAUCER_EXIT_ROTATION_DEGREES = 20;
export const SPACESHIP_SAUCER_EXIT_MAX_ROTATION_DEGREES = 20;
export const SPACESHIP_SAUCER_EXIT_HORIZONTAL_VIEWPORT_RATIO = 1.12;
export const SPACESHIP_SAUCER_ENTER_LANES = [
  { id: 'upper-left', side: -1, startX: -0.44, startY: -0.34, control1X: -0.34, control1Y: -0.12, control2X: 0.10, control2Y: -0.035, startRotation: -12 },
  { id: 'upper-right', side: 1, startX: 0.44, startY: -0.34, control1X: 0.34, control1Y: -0.12, control2X: -0.10, control2Y: -0.035, startRotation: 12 },
  { id: 'left-upper', side: -1, startX: -0.62, startY: -0.16, control1X: -0.43, control1Y: -0.23, control2X: 0.075, control2Y: -0.015, startRotation: -12 },
  { id: 'right-upper', side: 1, startX: 0.62, startY: -0.16, control1X: 0.43, control1Y: -0.23, control2X: -0.075, control2Y: -0.015, startRotation: 12 },
] as const;
export const SPACESHIP_LAYER_Z = {
  backgroundDice: 0,
  belowBeam: 1,
  beam: 2,
  aboveBeam: 3,
  foregroundDice: 4,
  saucer: 5,
} as const;
export const SPACESHIP_DEBRIS_INITIAL_SCALE = 1.4;
export const SPACESHIP_DEBRIS_FINAL_VISIBLE_SCALE = 0.6;
export const SPACESHIP_FAKE_DIE_SIZE_PX = 52;
export const SPACESHIP_PULL_BASE_SECONDS = 1.95;
export const SPACESHIP_PULL_ARRIVAL_GAP_SECONDS = 0.04;
export const SPACESHIP_PULL_LINEAR_WEIGHT = 0.14;
export const SPACESHIP_DEBRIS_HIDE_DELAY_SECONDS = 0.01;
export const SPACESHIP_SCATTER_ENTROPY = 0.5;

export function getSpaceshipSaucerExitPlan(random: () => number = Math.random) {
  const sampleIndex = () => Math.min(
    SPACESHIP_SAUCER_EXIT_LANES.length - 1,
    Math.max(0, Math.floor(random() * SPACESHIP_SAUCER_EXIT_LANES.length)),
  );
  const lane = SPACESHIP_SAUCER_EXIT_LANES[sampleIndex()];
  return {
    lane,
    finalXRatio: lane * SPACESHIP_SAUCER_EXIT_HORIZONTAL_VIEWPORT_RATIO,
    finalRotation: lane * SPACESHIP_SAUCER_EXIT_ROTATION_DEGREES,
  };
}

export function getSpaceshipSaucerEnterPlan(random: () => number = Math.random) {
  const sample = Math.max(0, Math.min(0.999999, random()));
  return SPACESHIP_SAUCER_ENTER_LANES[Math.floor(sample * SPACESHIP_SAUCER_ENTER_LANES.length)];
}

export function getSpaceshipMagneticPullProgress(linearProgress: number): number {
  const progress = Math.max(0, Math.min(1, linearProgress));
  return SPACESHIP_PULL_LINEAR_WEIGHT * progress
    + (1 - SPACESHIP_PULL_LINEAR_WEIGHT) * progress * progress;
}

function cubicBezier(start: number, control1: number, control2: number, end: number, progress: number): number {
  const inverse = 1 - progress;
  return inverse * inverse * inverse * start
    + 3 * inverse * inverse * progress * control1
    + 3 * inverse * progress * progress * control2
    + progress * progress * progress * end;
}

export function getSpaceshipScatterLayout(
  plan: { id: string; x: number; y: number; curveX: readonly [number, number]; driftX: number; startRotation: number },
  random: () => number = Math.random,
) {
  const clamp = (minimum: number, maximum: number, value: number) => Math.max(minimum, Math.min(maximum, value));
  const signed = () => random() * 2 - 1;
  const widenedX = 50 + (plan.x - 50) * (1 + SPACESHIP_SCATTER_ENTROPY);
  const x = clamp(-6, 106, widenedX + signed() * 3);
  const curveX = plan.curveX.map((control) => clamp(
    -15,
    115,
    50 + (control - 50) * (1 + SPACESHIP_SCATTER_ENTROPY) + signed() * 5,
  )) as [number, number];
  const y = plan.y + random() * 8;
  const driftMultiplier = 1 + SPACESHIP_SCATTER_ENTROPY + signed() * 0.1;
  const driftX = Math.sign(plan.driftX) * clamp(18, 58, Math.abs(plan.driftX) * driftMultiplier);
  const isCopiedRock = plan.id.includes('Copy');
  const startRotation = isCopiedRock
    ? plan.startRotation
    : clamp(-35, 35, plan.startRotation + signed() * 12);
  return { x, y, curveX, driftX, startRotation };
}

export const SPACESHIP_DEBRIS_PLAN = [
  { id: 'rock1', source: ROCK_SOURCES[0], x: 22, y: 112, curveX: [14, 38], size: 108, pullOrder: 0, startRotation: -12, wobbleRotation: 8, driftX: 22, belowBeams: false },
  { id: 'can1', source: CAN_SOURCES[0], x: 44, y: 116, curveX: [51, 39], size: 132, pullOrder: 2, startRotation: 10, wobbleRotation: -10, driftX: -16, belowBeams: true },
  { id: 'rock2', source: ROCK_SOURCES[1], x: 70, y: 120, curveX: [80, 57], size: 112, pullOrder: 1, startRotation: 8, wobbleRotation: -7, driftX: -22, belowBeams: false },
  { id: 'rock3', source: ROCK_SOURCES[2], x: 39, y: 124, curveX: [31, 45], size: 116, pullOrder: 3, startRotation: -7, wobbleRotation: 8, driftX: 14, belowBeams: true },
  { id: 'can2', source: CAN_SOURCES[1], x: 72, y: 128, curveX: [82, 62], size: 128, pullOrder: 4, startRotation: -9, wobbleRotation: 9, driftX: 18, belowBeams: true },
  { id: 'rock4', source: ROCK_SOURCES[3], x: 14, y: 132, curveX: [5, 35], size: 104, pullOrder: 5, startRotation: 11, wobbleRotation: -10, driftX: -26, belowBeams: false },
  { id: 'rock5', source: ROCK_SOURCES[4], x: 50, y: 136, curveX: [59, 44], size: 114, pullOrder: 7, startRotation: -8, wobbleRotation: 7, driftX: 18, belowBeams: false },
  { id: 'can3', source: CAN_SOURCES[2], x: 18, y: 140, curveX: [7, 38], size: 126, pullOrder: 6, startRotation: 12, wobbleRotation: -9, driftX: -28, belowBeams: false },
  { id: 'rock6', source: ROCK_SOURCES[5], x: 78, y: 144, curveX: [90, 60], size: 109, pullOrder: 9, startRotation: 9, wobbleRotation: -8, driftX: -24, belowBeams: true },
  { id: 'can4', source: CAN_SOURCES[3], x: 86, y: 148, curveX: [97, 66], size: 134, pullOrder: 8, startRotation: -10, wobbleRotation: 8, driftX: 24, belowBeams: true },
  { id: 'rock7', source: ROCK_SOURCES[6], x: 48, y: 152, curveX: [37, 55], size: 111, pullOrder: 11, startRotation: -11, wobbleRotation: 10, driftX: 20, belowBeams: true },
  { id: 'can5', source: CAN_SOURCES[4], x: 52, y: 156, curveX: [63, 45], size: 130, pullOrder: 10, startRotation: 7, wobbleRotation: -9, driftX: -18, belowBeams: false },
] as const;

export const SPACESHIP_EXTRA_ROCK_PLAN = [
  { id: 'rock1Copy1', source: ROCK_SOURCES[0], x: 4, y: 129, curveX: [-2, 30], size: 88, pullOrder: 2.5, startRotation: 95, wobbleRotation: -24, driftX: 28, belowBeams: true },
  { id: 'rock1Copy2', source: ROCK_SOURCES[0], x: 96, y: 145, curveX: [103, 68], size: 121, pullOrder: 7.25, startRotation: -95, wobbleRotation: 31, driftX: -30, belowBeams: false },
  { id: 'rock3Copy1', source: ROCK_SOURCES[2], x: 10, y: 151, curveX: [-1, 34], size: 94, pullOrder: 5.5, startRotation: -95, wobbleRotation: 27, driftX: 32, belowBeams: false },
  { id: 'rock3Copy2', source: ROCK_SOURCES[2], x: 88, y: 136, curveX: [100, 63], size: 126, pullOrder: 8.5, startRotation: 95, wobbleRotation: -29, driftX: -34, belowBeams: true },
  { id: 'rock3Copy3', source: ROCK_SOURCES[2], x: 3, y: 166, curveX: [-6, 37], size: 76, pullOrder: 10.75, startRotation: 95, wobbleRotation: -34, driftX: 36, belowBeams: true },
] as const;

export const SPACESHIP_FAKE_DICE_PLAN = [
  { id: 'die1', value: 3, x: 3, y: 116, curveX: [-4, 34], size: SPACESHIP_FAKE_DIE_SIZE_PX, pullOrder: 12, travelDelaySeconds: 0.08, startRotation: -22, wobbleRotation: 52, driftX: 30, belowBeams: true, foregroundDice: false },
  { id: 'die2', value: 2, x: 95, y: 121, curveX: [103, 64], size: SPACESHIP_FAKE_DIE_SIZE_PX, pullOrder: 1.5, startRotation: 18, wobbleRotation: -60, driftX: -32, belowBeams: false, foregroundDice: true },
  { id: 'die3', value: 4, x: 10, y: 128, curveX: [-1, 37], size: SPACESHIP_FAKE_DIE_SIZE_PX, pullOrder: 3.5, startRotation: 25, wobbleRotation: -48, driftX: -30, belowBeams: false, foregroundDice: true },
  { id: 'die4', value: 1, x: 97, y: 134, curveX: [105, 66], size: SPACESHIP_FAKE_DIE_SIZE_PX, pullOrder: 4.5, startRotation: -17, wobbleRotation: 56, driftX: 34, belowBeams: true, foregroundDice: false },
  { id: 'die5', value: 2, x: 1, y: 142, curveX: [-7, 32], size: SPACESHIP_FAKE_DIE_SIZE_PX, pullOrder: 6.5, startRotation: 14, wobbleRotation: -55, driftX: 36, belowBeams: true, foregroundDice: false },
  { id: 'die6', value: 5, x: 94, y: 149, curveX: [102, 67], size: SPACESHIP_FAKE_DIE_SIZE_PX, pullOrder: 7.5, startRotation: -24, wobbleRotation: 60, driftX: -38, belowBeams: false, foregroundDice: true },
  { id: 'die7', value: 4, x: 7, y: 158, curveX: [-3, 36], size: SPACESHIP_FAKE_DIE_SIZE_PX, pullOrder: 9.5, startRotation: -16, wobbleRotation: 46, driftX: 34, belowBeams: false, foregroundDice: true },
  { id: 'die8', value: 3, x: 91, y: 164, curveX: [101, 62], size: SPACESHIP_FAKE_DIE_SIZE_PX, pullOrder: 13, travelDelaySeconds: 0.14, startRotation: 21, wobbleRotation: -58, driftX: -36, belowBeams: true, foregroundDice: false },
] as const;

export const SPACESHIP_PULL_PLAN = [
  ...SPACESHIP_DEBRIS_PLAN,
  ...SPACESHIP_EXTRA_ROCK_PLAN,
  ...SPACESHIP_FAKE_DICE_PLAN,
] as const;

export function getSpaceshipDebrisMotion(plan: { pullOrder: number; travelDelaySeconds?: number }) {
  const travelStartAt = plan.travelDelaySeconds ?? 0;
  const travelSeconds = SPACESHIP_PULL_BASE_SECONDS
    + plan.pullOrder * SPACESHIP_PULL_ARRIVAL_GAP_SECONDS;
  return { travelStartAt, travelSeconds, arrivalAt: travelStartAt + travelSeconds };
}

export const SPACESHIP_SUCTION_COMPLETE_AT_SECONDS = Math.max(
  ...SPACESHIP_PULL_PLAN.map(getSpaceshipDebrisMotion).map(({ arrivalAt }) => arrivalAt),
) + SPACESHIP_DEBRIS_HIDE_DELAY_SECONDS;
export const SPACESHIP_SAUCER_EXIT_AT_SECONDS = SPACESHIP_SUCTION_COMPLETE_AT_SECONDS;
export const SPACESHIP_SAUCER_EXIT_SECONDS = SPACESHIP_SCENE_SECONDS - SPACESHIP_SAUCER_EXIT_AT_SECONDS;
export const SPACESHIP_BEAM_EXIT_FLASH_STARTS = [2.855, 2.866, 2.877, 2.888, 2.899, 2.910, 2.921, 2.930] as const;
export const SPACESHIP_BEAM_HIDDEN_AT_SECONDS = 2.94;
export const SPACESHIP_BEAM_DISCONNECT_AT_SECONDS = SPACESHIP_BEAM_HIDDEN_AT_SECONDS;
export const SPACESHIP_BEAM_DISCONNECT_EXIT_PROGRESS = (
  SPACESHIP_BEAM_DISCONNECT_AT_SECONDS - SPACESHIP_SAUCER_EXIT_AT_SECONDS
) / SPACESHIP_SAUCER_EXIT_SECONDS;

const SPACESHIP_EXIT_KNOT_SECONDS = [0, 0.1290625, 0.258125, 0.36875, 0.4978125, 0.6453125, 0.8296875, 0.995625, 1.18] as const;
const SPACESHIP_EXIT_X_RATIOS = [0, 0.008, 0.035, 0.09, 0.20, 0.42, 0.78, SPACESHIP_SAUCER_EXIT_HORIZONTAL_VIEWPORT_RATIO, SPACESHIP_SAUCER_EXIT_HORIZONTAL_VIEWPORT_RATIO] as const;
const SPACESHIP_EXIT_X_TANGENTS = [0, 0.12, 0.30, 0.58, 1.05, 1.75, 2.20, 0, 0] as const;
const SPACESHIP_EXIT_Y_RATIOS = [0.05, 0.045, 0.025, -0.015, -0.10, -0.28, -0.58, -0.84, -0.84] as const;
const SPACESHIP_EXIT_Y_TANGENTS = [0, -0.08, -0.22, -0.48, -0.90, -1.45, -1.85, 0, 0] as const;
const SPACESHIP_EXIT_ROTATIONS = [0, 1.5, 4, 7, 11, 15, 19, 20, 20] as const;
const SPACESHIP_EXIT_ROTATION_TANGENTS = [0, 14, 20, 24, 24, 20, 10, 0, 0] as const;
const SPACESHIP_EXIT_SCALE_X = [1, 0.998, 0.994, 0.989, 0.982, 0.974, 0.964, 0.96, 0.96] as const;
const SPACESHIP_EXIT_SCALE_Y = [1, 0.997, 0.991, 0.983, 0.973, 0.96, 0.945, 0.94, 0.94] as const;
const SPACESHIP_EXIT_SCALE_X_TANGENTS = [0, -0.02, -0.03, -0.04, -0.05, -0.06, -0.04, 0, 0] as const;
const SPACESHIP_EXIT_SCALE_Y_TANGENTS = [0, -0.03, -0.05, -0.06, -0.08, -0.09, -0.06, 0, 0] as const;

function sampleSpaceshipExitTrack(
  values: readonly number[],
  tangents: readonly number[],
  elapsedSeconds: number,
): number {
  let segmentIndex = 0;
  while (
    segmentIndex < SPACESHIP_EXIT_KNOT_SECONDS.length - 2
    && elapsedSeconds >= SPACESHIP_EXIT_KNOT_SECONDS[segmentIndex + 1]
  ) {
    segmentIndex += 1;
  }
  const startTime = SPACESHIP_EXIT_KNOT_SECONDS[segmentIndex];
  const endTime = SPACESHIP_EXIT_KNOT_SECONDS[segmentIndex + 1];
  const duration = Math.max(0.001, endTime - startTime);
  const progress = Math.max(0, Math.min(1, (elapsedSeconds - startTime) / duration));
  const progress2 = progress * progress;
  const progress3 = progress2 * progress;
  const h00 = 2 * progress3 - 3 * progress2 + 1;
  const h10 = progress3 - 2 * progress2 + progress;
  const h01 = -2 * progress3 + 3 * progress2;
  const h11 = progress3 - progress2;
  return h00 * values[segmentIndex]
    + h10 * duration * tangents[segmentIndex]
    + h01 * values[segmentIndex + 1]
    + h11 * duration * tangents[segmentIndex + 1];
}

export function getSpaceshipSaucerExitPose(
  plan: ReturnType<typeof getSpaceshipSaucerExitPlan>,
  linearProgress: number,
  viewportHeight: number,
  viewportWidth: number,
) {
  const progress = Math.max(0, Math.min(1, linearProgress));
  const elapsedSeconds = progress * SPACESHIP_SAUCER_EXIT_SECONDS;
  const rotation = plan.lane * sampleSpaceshipExitTrack(
    SPACESHIP_EXIT_ROTATIONS,
    SPACESHIP_EXIT_ROTATION_TANGENTS,
    elapsedSeconds,
  );
  return {
    x: plan.lane * viewportWidth * sampleSpaceshipExitTrack(
      SPACESHIP_EXIT_X_RATIOS,
      SPACESHIP_EXIT_X_TANGENTS,
      elapsedSeconds,
    ),
    y: viewportHeight * sampleSpaceshipExitTrack(
      SPACESHIP_EXIT_Y_RATIOS,
      SPACESHIP_EXIT_Y_TANGENTS,
      elapsedSeconds,
    ),
    rotation: Math.max(
      -SPACESHIP_SAUCER_EXIT_MAX_ROTATION_DEGREES,
      Math.min(SPACESHIP_SAUCER_EXIT_MAX_ROTATION_DEGREES, rotation),
    ),
    scaleX: sampleSpaceshipExitTrack(
      SPACESHIP_EXIT_SCALE_X,
      SPACESHIP_EXIT_SCALE_X_TANGENTS,
      elapsedSeconds,
    ),
    scaleY: sampleSpaceshipExitTrack(
      SPACESHIP_EXIT_SCALE_Y,
      SPACESHIP_EXIT_SCALE_Y_TANGENTS,
      elapsedSeconds,
    ),
  };
}
export const SPACESHIP_FINALE_SOURCES = [
  ...SAUCER_SOURCES,
  source('leftbeam'),
  source('rightbeam'),
  ...ROCK_SOURCES,
  ...CAN_SOURCES,
  BOARD_TILE_SOURCE,
];

let preloadPromise: Promise<void> | null = null;

export function preloadSpaceshipFinaleAssets(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  preloadPromise = Promise.allSettled(SPACESHIP_FINALE_SOURCES.map((source) => new Promise<void>((resolve) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = source;
    if (image.complete) resolve();
  }))).then(() => undefined);
  return preloadPromise;
}

function createImage(source: string, className: string): HTMLImageElement {
  const image = document.createElement('img');
  image.src = source;
  image.alt = '';
  image.draggable = false;
  image.className = className;
  image.style.cssText = [
    'position:absolute',
    'display:block',
    'pointer-events:none',
    'user-select:none',
    '-webkit-user-drag:none',
    'transform-origin:50% 50%',
    'will-change:transform,opacity',
  ].join(';');
  return image;
}

function createFakeBoardDie(value: number): HTMLElement {
  const die = document.createElement('div');
  die.className = 'cc-spaceship-finale-debris cc-spaceship-finale-fake-die';
  die.dataset.spaceshipDieValue = String(value);
  die.style.cssText = 'position:absolute;inset:0;pointer-events:none;transform-origin:50% 50%;will-change:transform';
  const base = createImage(BOARD_TILE_SOURCE, 'cc-spaceship-finale-fake-die-base');
  base.style.cssText += ';inset:0;width:100%;height:100%;object-fit:contain';
  die.appendChild(base);

  const pipPositions: Record<number, Array<[number, number]>> = {
    1: [[50, 50]],
    2: [[32, 32], [68, 68]],
    3: [[32, 32], [50, 50], [68, 68]],
    4: [[32, 32], [68, 32], [32, 68], [68, 68]],
    5: [[32, 32], [68, 32], [50, 50], [32, 68], [68, 68]],
  };
  for (const [left, top] of pipPositions[value] ?? []) {
    const pip = document.createElement('span');
    pip.className = 'cc-spaceship-finale-fake-die-pip';
    pip.style.cssText = `position:absolute;left:${left}%;top:${top}%;width:12%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:24%;background:#815A42;opacity:.9`;
    die.appendChild(pip);
  }
  return die;
}

export function attachSpaceshipFinaleScene(
  overlay: HTMLElement,
  options: { enterRandom?: () => number; exitRandom?: () => number } = {},
): (() => void) & {
  startExit?: () => void;
  completionDelaySeconds?: number;
} {
  let disposed = false;
  let started = false;
  const ownedTimelines: gsap.core.Timeline[] = [];
  const field = document.createElement('div');
  field.className = 'cc-spaceship-finale-scene';
  field.style.cssText = [
    'position:absolute',
    'inset:0',
    'overflow:hidden',
    'pointer-events:none',
    'z-index:1',
  ].join(';');

  const createRig = (className: string, zIndex: number) => {
    const rig = document.createElement('div');
    rig.className = className;
    rig.style.cssText = [
      'position:absolute',
      'left:50%',
      'top:0',
      'width:min(76vw,297px)',
      'aspect-ratio:297/202',
      'pointer-events:none',
      'transform-origin:50% 45%',
      'will-change:transform,opacity',
      `z-index:${zIndex}`,
    ].join(';');
    return rig;
  };
  const beamRig = createRig('cc-spaceship-finale-rig cc-spaceship-finale-beam-rig', SPACESHIP_LAYER_Z.beam);
  const saucerRig = createRig('cc-spaceship-finale-rig cc-spaceship-finale-saucer-rig', SPACESHIP_LAYER_Z.saucer);
  const rigTargets = [beamRig, saucerRig];
  const saucerEnter = getSpaceshipSaucerEnterPlan(options.enterRandom);

  const saucer = createImage(SAUCER_SOURCES[0], 'cc-spaceship-finale-saucer');
  saucer.style.cssText += ';inset:0;width:100%;height:100%;object-fit:contain;z-index:3';
  const leftBeam = createImage(source('leftbeam'), 'cc-spaceship-finale-beam cc-spaceship-finale-beam-left');
  leftBeam.style.cssText += ';left:-40%;top:calc(66% - 40px);width:132%;height:auto;z-index:1;transform-origin:50% 0%';
  const rightBeam = createImage(source('rightbeam'), 'cc-spaceship-finale-beam cc-spaceship-finale-beam-right');
  rightBeam.style.cssText += ';right:-43.25%;top:calc(66% - 40px);width:145.5%;height:auto;z-index:2;transform-origin:50% 0%';
  const intakeMarkers = [46, 50, 54].map((left, index) => {
    const marker = document.createElement('span');
    marker.className = `cc-spaceship-intake-marker cc-spaceship-intake-marker-${index + 1}`;
    marker.style.cssText = `position:absolute;left:${left}%;top:78%;width:1px;height:1px;opacity:0;pointer-events:none`;
    return marker;
  });
  beamRig.append(leftBeam, rightBeam);
  saucerRig.append(saucer, ...intakeMarkers);
  field.append(beamRig, saucerRig);

  const debris = SPACESHIP_PULL_PLAN.map((layout) => {
    const scatteredLayout = getSpaceshipScatterLayout(layout);
    const mover = document.createElement('div');
    mover.className = 'cc-spaceship-finale-debris-mover';
    mover.dataset.spaceshipDebris = layout.id;
    mover.style.cssText = [
      'position:absolute',
      `width:${layout.size}px`,
      `height:${layout.size}px`,
      'pointer-events:none',
      'transform-origin:50% 50%',
      'will-change:transform,left,top,opacity',
      `z-index:${'foregroundDice' in layout && layout.foregroundDice
        ? SPACESHIP_LAYER_Z.foregroundDice
        : 'value' in layout
          ? SPACESHIP_LAYER_Z.backgroundDice
          : layout.belowBeams
            ? SPACESHIP_LAYER_Z.belowBeam
            : SPACESHIP_LAYER_Z.aboveBeam}`,
    ].join(';');
    const visual = 'value' in layout
      ? createFakeBoardDie(layout.value)
      : createImage(layout.source, 'cc-spaceship-finale-debris');
    visual.dataset.spaceshipDebris = layout.id;
    if (!('value' in layout)) {
      visual.style.cssText += ';inset:0;width:100%;height:100%;object-fit:contain';
    }
    mover.appendChild(visual);
    field.appendChild(mover);
    return {
      mover,
      image: visual,
      ...layout,
      ...scatteredLayout,
      travelDelaySeconds: 'travelDelaySeconds' in layout ? layout.travelDelaySeconds : 0,
    };
  });
  overlay.insertBefore(field, overlay.firstChild);

  gsap.set(rigTargets, {
    xPercent: -50,
    x: `${saucerEnter.startX * 100}vw`,
    y: `${saucerEnter.startY * 100}vh`,
    rotation: saucerEnter.startRotation,
    opacity: 1,
    force3D: true,
  });
  gsap.set([leftBeam, rightBeam], { opacity: 0, scaleY: 0.96, force3D: true });
  debris.forEach(({ mover, image, x, y, startRotation, id }) => {
    const delaysAppearance = id === 'die1' || id === 'die8';
    gsap.set(mover, {
      left: `${x}%`,
      top: `${y}%`,
      xPercent: -50,
      yPercent: -50,
      scale: SPACESHIP_DEBRIS_INITIAL_SCALE,
      opacity: delaysAppearance ? 0 : 1,
      force3D: true,
    });
    gsap.set(image, { x: 0, rotation: startRotation, force3D: true });
  });

  const own = (timeline: gsap.core.Timeline) => {
    ownedTimelines.push(timeline);
    return animationManager.trackExternalTimeline(timeline);
  };

  const resolveIntakePoint = (marker: HTMLElement) => {
    const fieldRect = field.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();
    return {
      left: markerRect.left + markerRect.width / 2 - fieldRect.left,
      top: markerRect.top + markerRect.height / 2 - fieldRect.top,
    };
  };

  const traceSuction = (phase: string, detail: Record<string, unknown> = {}) => {
    const entry = { phase, sceneSeconds: SCENE_SECONDS, ...detail };
    if (typeof window !== 'undefined') {
      const trace = ((window as any).__ccSpaceshipSuctionTrace ||= []);
      trace.push(entry);
      if (trace.length > 80) trace.shift();
    }
    logger.debug('[CC_SPACESHIP_SUCTION]', 'spaceship-finale', entry);
  };

  const start = () => {
    if (disposed || started) return;
    started = true;
    traceSuction('scene-start', { debrisCount: debris.length });
    const saucerExit = getSpaceshipSaucerExitPlan(options.exitRandom);
    const master = own(gsap.timeline({ paused: true }));
    const enterFlightState = { progress: 0 };
    const enterPoseSetters = rigTargets.map((rig) => ({
      x: gsap.quickSetter(rig, 'x', 'px'),
      y: gsap.quickSetter(rig, 'y', 'px'),
      rotation: gsap.quickSetter(rig, 'rotation', 'deg'),
    }));
    let enterViewportWidth = 390;
    let enterViewportHeight = 844;
    master.to(enterFlightState, {
      progress: 1,
      duration: 0.45,
      ease: 'none',
      onStart: () => {
        const fieldRect = field.getBoundingClientRect();
        enterViewportWidth = fieldRect.width || window.innerWidth || 390;
        enterViewportHeight = fieldRect.height || window.innerHeight || 844;
      },
      onUpdate: () => {
        const progress = enterFlightState.progress;
        const flightProgress = 1 - Math.pow(1 - progress, 3);
        const wobbleEnvelope = Math.pow(1 - flightProgress, 1.35) * Math.sin(Math.PI * flightProgress);
        const x = cubicBezier(
          saucerEnter.startX,
          saucerEnter.control1X,
          saucerEnter.control2X,
          0,
          flightProgress,
        ) * enterViewportWidth
          + saucerEnter.side * enterViewportWidth * 0.018
            * Math.sin(5 * Math.PI * flightProgress) * wobbleEnvelope;
        const y = cubicBezier(
          saucerEnter.startY,
          saucerEnter.control1Y,
          saucerEnter.control2Y,
          0.04,
          flightProgress,
        ) * enterViewportHeight
          + enterViewportHeight * 0.01
            * Math.sin(4 * Math.PI * flightProgress) * wobbleEnvelope;
        const rotation = saucerEnter.startRotation * (1 - flightProgress)
          + saucerEnter.side * 4 * Math.sin(4 * Math.PI * flightProgress) * wobbleEnvelope;
        enterPoseSetters.forEach((setters) => {
          setters.x(x);
          setters.y(y);
          setters.rotation(rotation);
        });
      },
    }, 0);
    const enterSpringState = { progress: 0 };
    const setBeamEnterYPercent = gsap.quickSetter(beamRig, 'yPercent');
    const setSaucerEnterYPercent = gsap.quickSetter(saucerRig, 'yPercent');
    let enterSpringRigHeight = 202;
    master.to(enterSpringState, {
      progress: 1,
      duration: 0.60,
      ease: 'none',
      onStart: () => {
        enterSpringRigHeight = saucerRig.getBoundingClientRect().height || 202;
      },
      onUpdate: () => {
        const progress = enterSpringState.progress;
        const offsetPx = 18 * (1 - progress) * Math.sin(3 * Math.PI * progress);
        const offsetPercent = offsetPx / enterSpringRigHeight * 100;
        setBeamEnterYPercent(offsetPercent);
        setSaucerEnterYPercent(offsetPercent);
      },
    }, 0.30);
    master.set(rigTargets, { yPercent: 0 }, 0.90);
    master.to(rigTargets, { x: -24, y: '6vh', rotation: -10, duration: 0.50, ease: 'sine.inOut' }, 0.45);
    master.to(rigTargets, { x: 18, y: '2vh', rotation: 12, duration: 0.50, ease: 'sine.inOut' }, 0.95);
    master.to(rigTargets, { x: -12, y: '7vh', rotation: -8, duration: 0.50, ease: 'sine.inOut' }, 1.45);
    master.to(rigTargets, { x: 14, y: '3vh', rotation: 10, duration: 0.45, ease: 'sine.inOut' }, 1.95);
    master.to(rigTargets, { x: 0, y: '5vh', rotation: 0, duration: 0.22, ease: 'sine.inOut' }, 2.40);
    master.set([leftBeam, rightBeam], {
      opacity: 0,
      visibility: 'hidden',
    }, SPACESHIP_BEAM_DISCONNECT_AT_SECONDS);
    master.set(beamRig, {
      opacity: 0,
      visibility: 'hidden',
      display: 'none',
    }, SPACESHIP_BEAM_DISCONNECT_AT_SECONDS);
    master.call(() => {
      beamRig.remove();
      traceSuction('beam-disconnected', {
        sceneCount: document.querySelectorAll('.cc-spaceship-finale-scene').length,
        beamRigConnected: beamRig.isConnected,
      });
    }, undefined, SPACESHIP_BEAM_DISCONNECT_AT_SECONDS);
    const createRigPoseSetters = (rig: HTMLElement) => ({
      x: gsap.quickSetter(rig, 'x', 'px'),
      y: gsap.quickSetter(rig, 'y', 'px'),
      rotation: gsap.quickSetter(rig, 'rotation', 'deg'),
      scaleX: gsap.quickSetter(rig, 'scaleX'),
      scaleY: gsap.quickSetter(rig, 'scaleY'),
    });
    const beamPoseSetters = createRigPoseSetters(beamRig);
    const saucerPoseSetters = createRigPoseSetters(saucerRig);
    const applyRigPose = (
      setters: ReturnType<typeof createRigPoseSetters>,
      pose: ReturnType<typeof getSpaceshipSaucerExitPose>,
    ) => {
      setters.x(pose.x);
      setters.y(pose.y);
      setters.rotation(pose.rotation);
      setters.scaleX(pose.scaleX);
      setters.scaleY(pose.scaleY);
    };
    const exitState = { progress: 0 };
    let exitViewportHeight = 844;
    let exitViewportWidth = 390;
    master.to(exitState, {
      progress: 1,
      duration: SPACESHIP_SAUCER_EXIT_SECONDS,
      ease: 'none',
      onStart: () => {
        const fieldRect = field.getBoundingClientRect();
        exitViewportHeight = fieldRect.height || window.innerHeight || 844;
        exitViewportWidth = fieldRect.width || window.innerWidth || 390;
        traceSuction('saucer-exit-motion', {
          exitLane: saucerExit.lane,
          exitRotation: saucerExit.finalRotation,
        });
      },
      onUpdate: () => {
        const pose = getSpaceshipSaucerExitPose(
          saucerExit,
          exitState.progress,
          exitViewportHeight,
          exitViewportWidth,
        );
        applyRigPose(saucerPoseSetters, pose);
        if (beamRig.isConnected) applyRigPose(beamPoseSetters, pose);
      },
    }, SPACESHIP_SAUCER_EXIT_AT_SECONDS);
    master.call(() => {
      traceSuction('saucer-exit-start', {
        exitLane: saucerExit.lane,
        exitRotation: saucerExit.finalRotation,
        sceneCount: document.querySelectorAll('.cc-spaceship-finale-scene').length,
        beamRigDisplay: getComputedStyle(beamRig).display,
        beamRigVisibility: getComputedStyle(beamRig).visibility,
        beamRigOpacity: getComputedStyle(beamRig).opacity,
      });
    }, undefined, SPACESHIP_SAUCER_EXIT_AT_SECONDS);

    // Keep the existing four-frame saucer sprite alive through the complete
    // exit. These calls belong to the master timeline, so cleanup stays with
    // the scene owner and no extra ticker or duplicate image is introduced.
    for (let index = 0; index < SPACESHIP_SAUCER_FRAME_COUNT; index += 1) {
      master.call(() => {
        if (!disposed) saucer.src = SAUCER_SOURCES[index % SAUCER_SOURCES.length];
      }, undefined, SPACESHIP_SAUCER_FRAME_START_AT_SECONDS
        + index * SPACESHIP_SAUCER_FRAME_STEP_SECONDS);
    }

    const beams = own(gsap.timeline({ paused: true }));
    beams.to(leftBeam, { opacity: 1, duration: 0.20, ease: 'power2.in' }, 0.34);
    const scheduleBeamShimmer = (
      beam: HTMLImageElement,
      startAt: number,
      leadLevels: readonly number[] = [],
    ) => {
      const stepSeconds = 0.075;
      const lastStartSeconds = SPACESHIP_BEAM_EXIT_FLASH_STARTS[0] - stepSeconds;
      let cursor = startAt;
      for (const opacity of leadLevels) {
        if (cursor > lastStartSeconds) return;
        beams.to(beam, { opacity, duration: 0.068, ease: 'sine.inOut' }, cursor);
        cursor += stepSeconds;
      }
      while (cursor <= lastStartSeconds) {
        const cycle = gsap.utils.shuffle([...SPACESHIP_BEAM_SHIMMER_LEVELS]);
        for (const opacity of cycle) {
          if (cursor > lastStartSeconds) return;
          beams.to(beam, { opacity, duration: 0.068, ease: 'sine.inOut' }, cursor);
          cursor += stepSeconds;
        }
      }
    };
    scheduleBeamShimmer(rightBeam, 0.34, SPACESHIP_RIGHT_BEAM_LEAD_LEVELS);
    scheduleBeamShimmer(leftBeam, 0.54);
    SPACESHIP_BEAM_EXIT_ALTERNATING_STATES.forEach(([leftOpacity, rightOpacity], index) => {
      const isFinalFade = index === SPACESHIP_BEAM_EXIT_ALTERNATING_STATES.length - 1;
      beams.to(leftBeam, {
        opacity: leftOpacity,
        duration: isFinalFade ? SPACESHIP_BEAM_EXIT_FADE_DURATION : SPACESHIP_BEAM_EXIT_FLASH_DURATION,
        ease: isFinalFade ? 'power2.out' : 'power1.inOut',
      }, SPACESHIP_BEAM_EXIT_FLASH_STARTS[index]);
      beams.to(rightBeam, {
        opacity: rightOpacity,
        duration: isFinalFade ? SPACESHIP_BEAM_EXIT_FADE_DURATION : SPACESHIP_BEAM_EXIT_FLASH_DURATION,
        ease: isFinalFade ? 'power2.out' : 'power1.inOut',
      }, SPACESHIP_BEAM_EXIT_FLASH_STARTS[index]);
    });
    beams.set([leftBeam, rightBeam], { opacity: 0, visibility: 'hidden' }, SPACESHIP_BEAM_HIDDEN_AT_SECONDS);
    beams.set(beamRig, { opacity: 0, visibility: 'hidden', display: 'none' }, SPACESHIP_BEAM_HIDDEN_AT_SECONDS);
    beams.call(() => {
      traceSuction('beam-off', {
        sceneCount: document.querySelectorAll('.cc-spaceship-finale-scene').length,
        beamRigDisplay: getComputedStyle(beamRig).display,
        beamRigVisibility: getComputedStyle(beamRig).visibility,
        beamRigOpacity: getComputedStyle(beamRig).opacity,
        leftOpacity: getComputedStyle(leftBeam).opacity,
        rightOpacity: getComputedStyle(rightBeam).opacity,
      });
    }, undefined, SPACESHIP_BEAM_HIDDEN_AT_SECONDS);

    debris.forEach(({
      mover,
      image,
      id,
      x,
      y,
      pullOrder,
      curveX,
      startRotation,
      wobbleRotation,
      driftX,
      travelDelaySeconds,
    }) => {
      const item = own(gsap.timeline({ paused: true }));
      const motion = getSpaceshipDebrisMotion({ pullOrder, travelDelaySeconds });
      const { travelStartAt, travelSeconds, arrivalAt } = motion;
      const intakeMarker = intakeMarkers[Math.floor(pullOrder) % intakeMarkers.length];
      const setLeft = gsap.quickSetter(mover, 'left', 'px');
      const setTop = gsap.quickSetter(mover, 'top', 'px');
      const setScaleX = gsap.quickSetter(mover, 'scaleX');
      const setScaleY = gsap.quickSetter(mover, 'scaleY');
      const setWobbleX = gsap.quickSetter(image, 'x', 'px');
      const setRotation = gsap.quickSetter(image, 'rotation', 'deg');
      const motionState = { progress: 0 };
      let fieldLeft = 0;
      let fieldTop = 0;
      let startLeft = 0;
      let startTop = 0;
      let control1 = 0;
      let control2 = 0;
      const wobbleCycles = 2.2 + (pullOrder % 4) * 0.32;
      if (travelStartAt > 0) {
        item.to(mover, { opacity: 1, duration: 0.12, ease: 'power1.out' }, travelStartAt);
      }
      item.to(motionState, {
        progress: 1,
        duration: travelSeconds,
        ease: 'none',
        onStart: () => {
          const fieldRect = field.getBoundingClientRect();
          fieldLeft = fieldRect.left;
          fieldTop = fieldRect.top;
          startLeft = fieldRect.width * x / 100;
          startTop = fieldRect.height * y / 100;
          control1 = fieldRect.width * curveX[0] / 100;
          control2 = fieldRect.width * curveX[1] / 100;
          traceSuction('item-start', { id, pullOrder, travelStartAt });
        },
        onUpdate: () => {
          const linearProgress = motionState.progress;
          const magneticProgress = getSpaceshipMagneticPullProgress(linearProgress);
          const markerRect = intakeMarker.getBoundingClientRect();
          const targetLeft = markerRect.left + markerRect.width / 2 - fieldLeft;
          const targetTop = markerRect.top + markerRect.height / 2 - fieldTop;
          const wobbleEnvelope = Math.sin(Math.PI * magneticProgress);
          const wobble = Math.sin(linearProgress * Math.PI * 2 * wobbleCycles) * wobbleEnvelope;
          setLeft(cubicBezier(startLeft, control1, control2, targetLeft, magneticProgress));
          setTop(startTop + (targetTop - startTop) * magneticProgress);
          const scale = SPACESHIP_DEBRIS_INITIAL_SCALE
            - (SPACESHIP_DEBRIS_INITIAL_SCALE - SPACESHIP_DEBRIS_FINAL_VISIBLE_SCALE)
              * Math.pow(magneticProgress, 1.18);
          setScaleX(scale);
          setScaleY(scale);
          setWobbleX(driftX * wobble);
          const rotation = startRotation * (1 - magneticProgress) + wobbleRotation * wobble;
          setRotation(id.startsWith('die') ? gsap.utils.clamp(-60, 60, rotation) : rotation);
        },
      }, travelStartAt);
      item.set(mover, {
        left: () => `${resolveIntakePoint(intakeMarker).left}px`,
        top: () => `${resolveIntakePoint(intakeMarker).top}px`,
        scale: SPACESHIP_DEBRIS_FINAL_VISIBLE_SCALE,
      }, arrivalAt);
      item.set(image, { x: 0, rotation: 0 }, arrivalAt);
      item.call(() => {
        const target = resolveIntakePoint(intakeMarker);
        const moverRect = mover.getBoundingClientRect();
        const fieldRect = field.getBoundingClientRect();
        const left = moverRect.left + moverRect.width / 2 - fieldRect.left;
        const top = moverRect.top + moverRect.height / 2 - fieldRect.top;
        traceSuction('item-arrival', {
          id,
          pullOrder,
          arrivalAt,
          intakeDistancePx: Math.hypot(left - target.left, top - target.top),
        });
      }, undefined, arrivalAt);
      item.set(mover, { opacity: 0, scale: 0.06 }, arrivalAt + SPACESHIP_DEBRIS_HIDE_DELAY_SECONDS);
      item.play(0);
    });
    master.call(() => {}, undefined, SCENE_SECONDS);
    master.play(0);
    beams.play(0);
  };

  // Warm the browser cache without making visual duration depend on network or
  // decode latency. The authored master starts now and owns exactly 3.8 seconds.
  void preloadSpaceshipFinaleAssets();
  start();

  const cleanup = (() => {
    if (disposed) return;
    disposed = true;
    ownedTimelines.forEach((timeline) => {
      try { animationManager.killExternalTimeline(timeline); } catch {
        try { timeline.kill(); } catch {}
      }
    });
    ownedTimelines.length = 0;
    try {
      gsap.killTweensOf([
        ...rigTargets,
        saucer,
        leftBeam,
        rightBeam,
        ...debris.flatMap(({ mover, image }) => [mover, image]),
      ]);
    } catch {}
    field.remove();
  }) as (() => void) & { startExit?: () => void; completionDelaySeconds?: number };
  // The scene owns its authored 3.8-second lifecycle. The shared overlay may start
  // its text exit earlier, but it must keep this field alive until completion.
  cleanup.startExit = () => {};
  cleanup.completionDelaySeconds = SCENE_SECONDS;
  return cleanup;
}
