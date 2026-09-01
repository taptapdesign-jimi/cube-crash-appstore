import { gsap } from 'gsap';
import animationManager from './animation-manager.js';
import { LASERGUN_TIMING_SCALE } from './laser-gun-impact-scheduler';
import {
  getLaserGunPlannerMuzzleX,
  LASERGUN_LEFT_MUZZLE_X_RATIO,
  LASERGUN_MUZZLE_EDGE_INSET_MAX_PX as PLANNER_MUZZLE_EDGE_INSET_MAX_PX,
  LASERGUN_MUZZLE_EDGE_INSET_MIN_PX as PLANNER_MUZZLE_EDGE_INSET_MIN_PX,
  type LaserGunShooter,
} from './tnt-bonus-target-selection.js';

const BASE = './assets/shop/gun/';
const useHighResolutionAssets = typeof navigator !== 'undefined'
  && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const source = (name: string): string => `${BASE}${name}${useHighResolutionAssets ? '@2x' : ''}.png`;

export const LASERGUN_FRAME_SOURCES = Array.from(
  { length: 6 },
  (_, index) => source(`lasergun${index + 1}`),
);
// Sprite animation advances through the firing frame, then returns to its
// resting frame. Only the bitmap source changes; barrel/beam rotation owners
// stay locked throughout this tail.
export const LASERGUN_FRAME_SEQUENCE = [
  ...LASERGUN_FRAME_SOURCES,
  ...LASERGUN_FRAME_SOURCES.slice(0, -1).reverse(),
] as const;
export const LASERGUN_MAX_TARGETS = 4;
export const LASERGUN_UPPER_GUN_TRANSFORM = 'rotate(45deg) scaleX(-1)';
export const LASERGUN_BEAM_COUNT = LASERGUN_MAX_TARGETS;
export const LASERGUN_GUN_SIZE_MULTIPLIER = 1.25;
export const LASERGUN_GUN_SCALES = [
  0.80 * LASERGUN_GUN_SIZE_MULTIPLIER,
  0.70 * LASERGUN_GUN_SIZE_MULTIPLIER,
  0.60 * LASERGUN_GUN_SIZE_MULTIPLIER,
] as const;
// The visible white-blue impact core lands on the exact cube centre. The faint
// alpha tail is decorative and may extend beyond the cube.
export const LASERGUN_TARGET_REACH_SCALE = 1.00;
export const LASERGUN_TARGET_LOCK_TOLERANCE_PX = 0.5;
export const LASERGUN_BEAM_THICKNESS_SCALE = 1.50 * 1.30 * 1.20;
export const LASERGUN_BEAM_BRIGHTNESS_SCALE = 1.18 * 1.20;
export const LASERGUN_BEAM_SATURATION_SCALE = 1.12 * 1.20;
export const LASERGUN_BEAM_GLOW_BLUR_PX = 7 * 1.20;
export const LASERGUN_BEAM_GLOW_ALPHA = Math.min(1, 0.82 * 1.20);
export const LASERGUN_MAX_BEAM_ANGLE_DEGREES = 55;
export const LASERGUN_MIN_BEAM_TRAVEL_PX = 150;
export const LASERGUN_LAYOUT_TRAVEL_MARGIN_PX = 0.5;
export const LASERGUN_MUZZLE_EDGE_INSET_RATIO = LASERGUN_LEFT_MUZZLE_X_RATIO;
export const LASERGUN_MUZZLE_EDGE_INSET_MIN_PX = PLANNER_MUZZLE_EDGE_INSET_MIN_PX;
export const LASERGUN_MUZZLE_EDGE_INSET_MAX_PX = PLANNER_MUZZLE_EDGE_INSET_MAX_PX;
export const LASERGUN_LEFT_MUZZLE_OFFSET_RATIO = 0.30;
export const LASERGUN_RIGHT_MUZZLE_OFFSET_RATIO = -0.28;
export const LASERGUN_RIG_MAX_WIDTH_PX = 273;
export const LASERGUN_EDGE_CLEARANCE_PX = 6;
// Run all pistol-owned motion at 70% of its previous speed. Dividing the
// duration scale by 0.70 makes every authored gun duration 42.857% longer,
// which is the exact time-domain equivalent of reducing speed by 30%.
export const LASERGUN_GUN_ANIMATION_SPEED = 0.70;
export const LASERGUN_GUN_TIME_SCALE = LASERGUN_TIMING_SCALE / LASERGUN_GUN_ANIMATION_SPEED;
export const LASERGUN_FRAME_STEP_SECONDS = 0.05 * LASERGUN_GUN_TIME_SCALE;
export const LASERGUN_ENTRY_DURATION_SECONDS = 0.50 * LASERGUN_GUN_TIME_SCALE;
// Preserve the accepted fast PNG cadence, but place the build-up at the end
// of each gun's own entry so frame 5 cannot sit frozen while awaiting a shot.
export const LASERGUN_BUILDUP_START_SECONDS = Math.max(
  0,
  LASERGUN_ENTRY_DURATION_SECONDS - LASERGUN_FRAME_STEP_SECONDS * 4,
);
export const LASERGUN_PREFIRE_SETTLE_SECONDS = 0.16 * LASERGUN_GUN_TIME_SCALE;
export const LASERGUN_BEAM_LAUNCH_SCALE = 0.06;
export const LASERGUN_BEAM_TRAVEL_SECONDS = 0.095;
export const LASERGUN_CUBE_REACTION_PRECEDES_BEAM_SECONDS = 0.3;
// The complete 1 -> 6 firing run fills the accepted 300ms cube lead. This
// gives every PNG one continuous paint interval and lands on frame 6 exactly
// when the beam launches, instead of joining two timelines around a stale
// frame 5/6 hold.
export const LASERGUN_FIRE_FRAME_STEP_SECONDS = (
  LASERGUN_CUBE_REACTION_PRECEDES_BEAM_SECONDS / (LASERGUN_FRAME_SOURCES.length - 1)
);
// Commit frame 6 one 60Hz paint before beam opacity changes. WebKit can
// otherwise composite the beam before an IMG src swap scheduled at the exact
// same GSAP timestamp, producing a one-frame flash of the prior bitmap.
export const LASERGUN_FRAME6_PAINT_LEAD_SECONDS = 1 / 60;
// Keep the completed beam painted across the cube reaction before fading.
export const LASERGUN_BEAM_FADE_DELAY_SECONDS = 0.24;
export const LASERGUN_BEAM_FADE_SECONDS = 0.07;
// The gun may return through PNG frames 6 -> 1 immediately, but it cannot begin
// spatial exit until the beam has completed its full travel and fade.
export const LASERGUN_EXIT_DELAY_SECONDS = (
  LASERGUN_BEAM_TRAVEL_SECONDS
  + LASERGUN_BEAM_FADE_DELAY_SECONDS
  + LASERGUN_BEAM_FADE_SECONDS
);
export const LASERGUN_EXIT_TRAVEL_SECONDS = 0.42 * LASERGUN_GUN_TIME_SCALE;

export const LASERGUN_LEFT_BEAM_GEOMETRY = {
  width: 439,
  height: 495,
  sourceX: 60,
  sourceY: 157,
  // Perceptual impact anchor measured from the white-blue core in the @2x PNG.
  impactX: 340.5,
  impactY: 345.5,
} as const;
export const LASERGUN_RIGHT_BEAM_GEOMETRY = {
  width: 430,
  height: 496,
  sourceX: 360,
  sourceY: 313,
  // Perceptual impact anchor measured from the white-blue core in the @2x PNG.
  impactX: 65.5,
  impactY: 143,
} as const;

export type LaserPoint = {
  x: number;
  y: number;
};

export type LaserGunFinaleTarget = LaserPoint & {
  shooter: LaserGunShooter;
};

export type LaserBeamPlacement = {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  transformOrigin: string;
};

export function getLaserGunAimRotation(
  axis: LaserPoint,
  barrel: LaserPoint,
  target: LaserPoint,
  currentRotation: number,
  parentRotationDirection: 1 | -1 = 1,
): number {
  const normalizeAngle = (angle: number): number => ((angle + 180) % 360 + 360) % 360 - 180;
  const currentAngle = Math.atan2(barrel.y - axis.y, barrel.x - axis.x) * 180 / Math.PI;
  const targetAngle = Math.atan2(target.y - barrel.y, target.x - barrel.x) * 180 / Math.PI;
  return currentRotation + parentRotationDirection * normalizeAngle(targetAngle - currentAngle);
}

export function getLaserGunAxisMissDistance(
  axis: LaserPoint,
  barrel: LaserPoint,
  target: LaserPoint,
): number {
  const axisX = barrel.x - axis.x;
  const axisY = barrel.y - axis.y;
  const axisLength = Math.hypot(axisX, axisY);
  if (axisLength <= 0.01) return 0;
  const targetX = target.x - barrel.x;
  const targetY = target.y - barrel.y;
  return Math.abs(axisX * targetY - axisY * targetX) / axisLength;
}

export function getLaserGunRandomScales(
  count: number,
  random: () => number = Math.random,
): number[] {
  const boundedCount = Math.max(0, Math.min(LASERGUN_MAX_TARGETS, Math.floor(count)));
  const shuffled = [...LASERGUN_GUN_SCALES];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.min(index, Math.max(0, Math.floor(random() * (index + 1))));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return Array.from({ length: boundedCount }, (_, index) => shuffled[index % shuffled.length]);
}

export function getLaserGunSideYPositions(
  count: number,
  viewportHeight: number,
  side: LaserGunShooter,
  preferredSeparation = 200,
): number[] {
  const boundedCount = Math.max(0, Math.min(LASERGUN_MAX_TARGETS, Math.floor(count)));
  if (!boundedCount) return [];
  const height = Math.max(320, viewportHeight);
  const edgeMargin = Math.min(height * 0.24, 132);
  const minCenter = edgeMargin;
  const maxCenter = height - edgeMargin;
  if (boundedCount === 1) {
    const anchor = side === 'left' ? height * 0.37 : height * 0.63;
    return [Math.max(minCenter, Math.min(maxCenter, anchor))];
  }
  const available = Math.max(0, maxCenter - minCenter);
  const separation = Math.min(preferredSeparation, available / (boundedCount - 1));
  const anchor = side === 'left' ? height * 0.37 : height * 0.63;
  const totalSpan = separation * (boundedCount - 1);
  const start = Math.max(minCenter, Math.min(maxCenter - totalSpan, anchor - totalSpan * 0.5));
  return Array.from({ length: boundedCount }, (_, index) => start + index * separation);
}

export function getLaserGunMuzzleX(
  side: LaserGunShooter,
  viewportWidth: number,
): number {
  return getLaserGunPlannerMuzzleX(side, viewportWidth);
}

export function getLaserGunStageCenterX(
  side: LaserGunShooter,
  scale: number,
  viewportWidth: number,
): number {
  const width = Math.max(320, viewportWidth);
  const rigWidth = Math.min(width * 0.70, LASERGUN_RIG_MAX_WIDTH_PX) * Math.max(0.1, scale);
  const offsetRatio = side === 'left'
    ? LASERGUN_LEFT_MUZZLE_OFFSET_RATIO
    : LASERGUN_RIGHT_MUZZLE_OFFSET_RATIO;
  return getLaserGunMuzzleX(side, width) - rigWidth * offsetRatio;
}

export function getLaserGunOffscreenTravel(
  side: LaserGunShooter,
  scale: number,
  viewportWidth: number,
  onstageX = getLaserGunStageCenterX(side, scale, viewportWidth),
): number {
  const width = Math.max(320, viewportWidth);
  const rigWidth = Math.min(width * 0.70, LASERGUN_RIG_MAX_WIDTH_PX) * Math.max(0.1, scale);
  const travel = side === 'left'
    ? -(onstageX + rigWidth * 0.5 + LASERGUN_EDGE_CLEARANCE_PX)
    : width - onstageX + rigWidth * 0.5 + LASERGUN_EDGE_CLEARANCE_PX;
  return travel;
}

export function getLaserGunConstrainedTop(
  nominalTop: number,
  target: LaserPoint,
  gunX: number,
  maxAngleDegrees = LASERGUN_MAX_BEAM_ANGLE_DEGREES,
  minimumTravelPx = LASERGUN_MIN_BEAM_TRAVEL_PX,
): number {
  const horizontalDistance = Math.abs(target.x - gunX);
  const boundedAngle = Math.max(1, Math.min(89, Math.abs(maxAngleDegrees)));
  const maximumVerticalDistance = Math.tan(boundedAngle * Math.PI / 180) * horizontalDistance;
  const angleConstrainedTop = Math.max(
    target.y - maximumVerticalDistance,
    Math.min(target.y + maximumVerticalDistance, nominalTop),
  );
  const minimumDistance = Math.max(0, minimumTravelPx);
  const requiredVerticalDistance = Math.sqrt(Math.max(
    0,
    minimumDistance * minimumDistance - horizontalDistance * horizontalDistance,
  ));
  if (Math.abs(target.y - angleConstrainedTop) >= requiredVerticalDistance) {
    return angleConstrainedTop;
  }
  // Pick the nearest readable position before entry. If 150px cannot coexist
  // with the 55-degree cap, use the cap boundary: it is the longest legal run.
  const readableVerticalDistance = Math.min(requiredVerticalDistance, maximumVerticalDistance);
  const above = target.y - readableVerticalDistance;
  const below = target.y + readableVerticalDistance;
  return Math.abs(nominalTop - above) <= Math.abs(nominalTop - below) ? above : below;
}

type BeamGeometry = typeof LASERGUN_LEFT_BEAM_GEOMETRY | typeof LASERGUN_RIGHT_BEAM_GEOMETRY;

export function getLaserBeamPlacement(
  barrel: LaserPoint,
  target: LaserPoint,
  geometry: BeamGeometry,
  lockedRotation?: number,
): LaserBeamPlacement {
  const baselineX = geometry.impactX - geometry.sourceX;
  const baselineY = geometry.impactY - geometry.sourceY;
  const targetX = target.x - barrel.x;
  const targetY = target.y - barrel.y;
  const baselineLength = Math.max(1, Math.hypot(baselineX, baselineY));
  const targetLength = Math.max(1, Math.hypot(targetX, targetY)) * LASERGUN_TARGET_REACH_SCALE;
  const longitudinalScale = targetLength / baselineLength;
  return {
    x: barrel.x,
    y: barrel.y,
    rotation: lockedRotation ?? Math.atan2(targetY, targetX) * 180 / Math.PI,
    scaleX: longitudinalScale,
    scaleY: longitudinalScale * LASERGUN_BEAM_THICKNESS_SCALE,
    transformOrigin: '0 0',
  };
}

type LaserGunFinaleController = {
  setTargets: (targets: LaserGunFinaleTarget[]) => Promise<LaserGunEntryReadiness>;
  prepareImpact: (index: number, target: LaserPoint) => Promise<boolean>;
  triggerImpact: (index: number, onLaunch?: () => void) => boolean;
  waitForImpactArrival: (index: number) => Promise<boolean>;
  waitForBeamLaunch: (index: number) => Promise<boolean>;
  cancelImpact: (index: number) => void;
  completeImpacts: () => void;
  cleanup: () => void;
};

export type LaserGunEntryReadiness = 'painted' | 'cancelled';

let activeController: LaserGunFinaleController | null = null;
let preloadPromise: Promise<void> | null = null;

export function preloadLaserGunFinaleAssets(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  const sources = [
    ...LASERGUN_FRAME_SOURCES,
    source('left laser'),
    source('right laser'),
  ];
  preloadPromise = Promise.allSettled(sources.map((assetSource) => new Promise<void>((resolve) => {
    const image = new Image();
    const finish = () => {
      if (typeof image.decode !== 'function') {
        resolve();
        return;
      }
      void image.decode().catch(() => undefined).then(() => resolve());
    };
    image.onload = finish;
    image.onerror = () => resolve();
    image.src = assetSource;
    if (image.complete) finish();
  }))).then(() => undefined);
  return preloadPromise;
}

export function setActiveLaserGunFinaleTargets(
  targets: LaserGunFinaleTarget[],
): Promise<LaserGunEntryReadiness> {
  return activeController?.setTargets(targets) ?? Promise.resolve('cancelled');
}

export function prepareActiveLaserGunFinaleImpact(
  index: number,
  target: LaserPoint,
): Promise<boolean> {
  return activeController?.prepareImpact(index, target) ?? Promise.resolve(false);
}

export function triggerActiveLaserGunFinaleImpact(index: number, onLaunch?: () => void): boolean {
  return activeController?.triggerImpact(index, onLaunch) ?? false;
}

export function waitForActiveLaserGunFinaleImpactArrival(index: number): Promise<boolean> {
  return activeController?.waitForImpactArrival(index) ?? Promise.resolve(false);
}

export function waitForActiveLaserGunFinaleBeamLaunch(index: number): Promise<boolean> {
  return activeController?.waitForBeamLaunch(index) ?? Promise.resolve(false);
}

export function cancelActiveLaserGunFinaleImpact(index: number): void {
  activeController?.cancelImpact(index);
}

export function completeActiveLaserGunFinaleImpacts(): void {
  activeController?.completeImpacts();
}

function createImage(assetSource: string, className: string): HTMLImageElement {
  const image = document.createElement('img');
  image.src = assetSource;
  image.alt = '';
  image.draggable = false;
  image.className = className;
  image.style.cssText = [
    'position:absolute',
    'display:block',
    'pointer-events:none',
    'user-select:none',
    '-webkit-user-drag:none',
    'will-change:transform,opacity',
  ].join(';');
  return image;
}

function createGunRig(className: string, side: LaserGunShooter, slot: number): {
  rig: HTMLElement;
  aim: HTMLElement;
  image: HTMLImageElement;
  barrel: HTMLElement;
  axis: HTMLElement;
  side: LaserGunShooter;
  slot: number;
} {
  const rig = document.createElement('div');
  rig.className = `cc-lasergun-rig ${className}`;
  rig.style.cssText = [
    'position:absolute',
    'width:min(70vw,273px)',
    'aspect-ratio:200/183',
    'pointer-events:none',
    'transform-origin:50% 50%',
    'will-change:transform,opacity',
    'z-index:5',
  ].join(';');
  const orientation = document.createElement('div');
  orientation.className = 'cc-lasergun-orientation';
  orientation.style.cssText = [
    'position:absolute',
    'inset:0',
    'transform-origin:50% 50%',
    `transform:${side === 'left' ? LASERGUN_UPPER_GUN_TRANSFORM : 'none'}`,
  ].join(';');
  const image = createImage(LASERGUN_FRAME_SOURCES[0], 'cc-lasergun-frame');
  image.dataset.lasergunFrame = '1';
  image.style.cssText += ';inset:0;width:100%;height:100%;object-fit:contain';
  image.style.transformOrigin = '24% 32%';
  const aim = document.createElement('div');
  aim.className = 'cc-lasergun-aim';
  aim.style.cssText = 'position:absolute;inset:0;transform-origin:50% 50%;will-change:transform';
  const barrel = document.createElement('span');
  barrel.className = 'cc-lasergun-barrel-marker';
  barrel.style.cssText = 'position:absolute;left:24%;top:32%;width:1px;height:1px;opacity:0;pointer-events:none';
  const axis = document.createElement('span');
  axis.className = 'cc-lasergun-axis-marker';
  axis.style.cssText = 'position:absolute;left:72%;top:58%;width:1px;height:1px;opacity:0;pointer-events:none';
  aim.append(image, barrel, axis);
  orientation.append(aim);
  rig.appendChild(orientation);
  return { rig, aim, image, barrel, axis, side, slot };
}

export function attachLaserGunFinaleScene(
  overlay: HTMLElement,
  options: {
    onFireReady?: () => void;
    onSequenceComplete?: () => void;
    random?: () => number;
  } = {},
): () => void {
  const random = options.random ?? Math.random;
  let disposed = false;
  let targetsApplied = false;
  let finalExitStarted = false;
  let activeGunsPainted = false;
  let entryPaintFrameA: number | null = null;
  let entryPaintFrameB: number | null = null;
  let entryReadinessSettled = false;
  let resolveEntryReadiness!: (readiness: LaserGunEntryReadiness) => void;
  const entryReadiness = new Promise<LaserGunEntryReadiness>((resolve) => {
    resolveEntryReadiness = resolve;
  });
  const settleEntryReadiness = (readiness: LaserGunEntryReadiness): void => {
    if (entryReadinessSettled) return;
    entryReadinessSettled = true;
    resolveEntryReadiness(readiness);
  };
  const ownedTimelines: gsap.core.Timeline[] = [];
  const own = (timeline: gsap.core.Timeline): gsap.core.Timeline => {
    ownedTimelines.push(timeline);
    return animationManager.trackExternalTimeline(timeline);
  };

  const field = document.createElement('div');
  field.className = 'cc-lasergun-finale-scene';
  field.style.cssText = 'position:absolute;inset:0;overflow:visible;pointer-events:none;z-index:1';
  const rightGunField = document.createElement('div');
  rightGunField.className = 'cc-lasergun-right-gun-layer';
  rightGunField.style.cssText = 'position:absolute;inset:0;overflow:visible;pointer-events:none;z-index:3';

  const gunPools: Record<LaserGunShooter, Array<ReturnType<typeof createGunRig>>> = {
    left: [],
    right: [],
  };

  const createBeamPlan = (side: LaserGunShooter, slot: number) => {
    const firesFromLeft = side === 'left';
    const geometry = firesFromLeft ? LASERGUN_LEFT_BEAM_GEOMETRY : LASERGUN_RIGHT_BEAM_GEOMETRY;
    const rig = document.createElement('div');
    rig.className = 'cc-lasergun-beam-rig';
    rig.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;z-index:3;will-change:transform';
    const scaleLayer = document.createElement('div');
    scaleLayer.className = 'cc-lasergun-beam-scale';
    scaleLayer.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;transform-origin:0 0;will-change:transform';
    const image = createImage(
      source(firesFromLeft ? 'left laser' : 'right laser'),
      `cc-lasergun-beam cc-lasergun-beam-${firesFromLeft ? 'left' : 'right'}`,
    );
    image.dataset.lasergunSlot = `${side}-${slot}`;
    const intrinsicAxisDegrees = Math.atan2(
      geometry.impactY - geometry.sourceY,
      geometry.impactX - geometry.sourceX,
    ) * 180 / Math.PI;
    image.style.cssText += `;left:${-geometry.sourceX}px;top:${-geometry.sourceY}px;width:${geometry.width}px;height:${geometry.height}px;opacity:0;z-index:3;transform-origin:${geometry.sourceX}px ${geometry.sourceY}px;transform:rotate(${-intrinsicAxisDegrees}deg);filter:brightness(${LASERGUN_BEAM_BRIGHTNESS_SCALE}) saturate(${LASERGUN_BEAM_SATURATION_SCALE}) drop-shadow(0 0 ${LASERGUN_BEAM_GLOW_BLUR_PX}px rgba(117,232,255,${LASERGUN_BEAM_GLOW_ALPHA}))`;
    scaleLayer.appendChild(image);
    rig.appendChild(scaleLayer);
    field.appendChild(rig);
    return { rig, scaleLayer, image, geometry, firesFromLeft, side, slot };
  };
  const beamPools: Record<LaserGunShooter, Array<ReturnType<typeof createBeamPlan>>> = {
    left: [],
    right: [],
  };

  overlay.insertBefore(field, overlay.firstChild);
  overlay.insertBefore(rightGunField, field.nextSibling);
  const ensureGunBeamPair = (side: LaserGunShooter, slot: number) => {
    let gun = gunPools[side][slot];
    if (!gun) {
      gun = createGunRig(
        `cc-lasergun-rig-${side} cc-lasergun-rig-${side}-${slot}`,
        side,
        slot,
      );
      gun.rig.style.left = '50%';
      gun.rig.style.top = '50%';
      gun.rig.style.visibility = 'hidden';
      (side === 'right' ? rightGunField : field).appendChild(gun.rig);
      gsap.set(gun.rig, {
        xPercent: -50,
        yPercent: -50,
        opacity: 0,
        scale: 0.65,
        force3D: true,
      });
      gunPools[side][slot] = gun;
    }
    let beamPlan = beamPools[side][slot];
    if (!beamPlan) {
      beamPlan = createBeamPlan(side, slot);
      gsap.set(beamPlan.image, { opacity: 0 });
      beamPools[side][slot] = beamPlan;
    }
    return { gun, beamPlan };
  };
  let sequenceCompleted = false;
  const gunExitPoses = new Map<HTMLElement, string>();
  const gunActiveScales = new Map<HTMLElement, number>();
  const finishSequence = () => {
    if (disposed || sequenceCompleted) return;
    sequenceCompleted = true;
    try { options.onSequenceComplete?.(); } catch {}
  };
  const startExit = () => {
    if (disposed || sequenceCompleted || finalExitStarted) return;
    finalExitStarted = true;
    shotStates.forEach((shot) => {
      resetShotPreparation(shot);
      settleShotEntry(shot, false);
      settleImpactArrival(shot, false);
      if (!shot.fadeStarted) gsap.set(shot.beamPlan.image, { opacity: 0 });
    });
    const enteredShots = shotStates.filter((shot) => shot.entryStarted);
    if (!enteredShots.length) {
      finishSequence();
      return;
    }
    enteredShots.forEach((shot) => startGunExit(shot));
    maybeFinishSequence();
  };

  const targetRequest = own(gsap.timeline({ paused: true }));
  targetRequest.call(() => {
    if (disposed) return;
    try { options.onFireReady?.(); } catch {}
  }, undefined, 0.04 * LASERGUN_TIMING_SCALE);
  targetRequest.to(
    {},
    { duration: 0.02 * LASERGUN_TIMING_SCALE },
    0.04 * LASERGUN_TIMING_SCALE,
  );

  const initialFieldRect = field.getBoundingClientRect();
  const resolveMarker = (marker: HTMLElement): LaserPoint => {
    const rect = marker.getBoundingClientRect();
    // Both gun layers and the beam field may be under the shared CSS shake.
    // Convert against the field's live rect so that transform cancels exactly
    // once instead of being included here and inherited again by the child.
    const liveFieldRect = field.getBoundingClientRect();
    return {
      x: rect.left + rect.width * 0.5 - liveFieldRect.left,
      y: rect.top + rect.height * 0.5 - liveFieldRect.top,
    };
  };
  const aimRotationFor = (
    gun: ReturnType<typeof createGunRig>,
    target: LaserPoint,
  ): number => {
    const barrel = resolveMarker(gun.barrel);
    const axis = resolveMarker(gun.axis);
    const currentRotation = Number(gsap.getProperty(gun.aim, 'rotation')) || 0;
    return getLaserGunAimRotation(
      axis,
      barrel,
      target,
      currentRotation,
      gun.side === 'left' ? -1 : 1,
    );
  };

  const solveGunLayoutBeforeEntry = (
    gun: ReturnType<typeof createGunRig>,
    target: LaserPoint,
    nominalLeft: number,
    nominalTop: number,
    activeScale: number,
  ): { left: number; top: number; aimRotation: number; beamRotation: number } => {
    let left = nominalLeft;
    let top = nominalTop;
    gun.rig.style.visibility = 'hidden';
    const applyLayout = () => {
      gun.rig.style.left = `${left}px`;
      gun.rig.style.top = `${top}px`;
      gsap.set(gun.rig, {
        x: 0,
        y: 0,
        rotation: gun.side === 'left' ? 0 : -8,
        opacity: 0,
        scale: activeScale,
      });
    };
    const settleAim = () => {
      // Rotating around the full rig centre moves the muzzle as well as its
      // direction, so converge against the freshly rendered markers until the
      // cube centre is within 0.05px of the real barrel axis.
      for (let pass = 0; pass < 12; pass += 1) {
        gsap.set(gun.aim, { rotation: aimRotationFor(gun, target) });
        const axis = resolveMarker(gun.axis);
        const barrel = resolveMarker(gun.barrel);
        if (Math.hypot(barrel.x - axis.x, barrel.y - axis.y) <= 0.01) break;
        if (getLaserGunAxisMissDistance(axis, barrel, target) <= 0.05) break;
      }
    };
    const readBeamRotation = (): number => {
      const axis = resolveMarker(gun.axis);
      const barrel = resolveMarker(gun.barrel);
      const axisLength = Math.hypot(barrel.x - axis.x, barrel.y - axis.y);
      // jsdom has no layout engine, so retain a deterministic target-vector
      // fallback for unit tests. Real browser geometry always uses the barrel.
      if (axisLength <= 0.01) {
        return Math.atan2(target.y - barrel.y, target.x - barrel.x) * 180 / Math.PI;
      }
      return Math.atan2(barrel.y - axis.y, barrel.x - axis.x) * 180 / Math.PI;
    };
    applyLayout();
    gsap.set(gun.aim, { rotation: 0 });
    settleAim();
    const measurableRig = gun.rig.getBoundingClientRect();
    if (measurableRig.width <= 1 || measurableRig.height <= 1) {
      return {
        left,
        top,
        aimRotation: Number(gsap.getProperty(gun.aim, 'rotation')) || 0,
        beamRotation: readBeamRotation(),
      };
    }
    const layoutTravelDistance = LASERGUN_MIN_BEAM_TRAVEL_PX
      + LASERGUN_LAYOUT_TRAVEL_MARGIN_PX;
    const minimumHorizontalDistance = layoutTravelDistance
      * Math.cos(LASERGUN_MAX_BEAM_ANGLE_DEGREES * Math.PI / 180);
    for (let pass = 0; pass < 6; pass += 1) {
      settleAim();
      const barrel = resolveMarker(gun.barrel);
      const horizontalDistance = Math.abs(target.x - barrel.x);
      if (horizontalDistance + 0.02 < minimumHorizontalDistance) {
        const outward = gun.side === 'left' ? -1 : 1;
        left += outward * (minimumHorizontalDistance - horizontalDistance);
        applyLayout();
        continue;
      }
      const desiredBarrelY = getLaserGunConstrainedTop(
        barrel.y,
        target,
        barrel.x,
        LASERGUN_MAX_BEAM_ANGLE_DEGREES,
        layoutTravelDistance,
      );
      const deltaY = desiredBarrelY - barrel.y;
      if (Math.abs(deltaY) <= 0.02) break;
      top += deltaY;
      applyLayout();
    }
    settleAim();
    return {
      left,
      top,
      aimRotation: Number(gsap.getProperty(gun.aim, 'rotation')) || 0,
      beamRotation: readBeamRotation(),
    };
  };

  type ShotState = {
    index: number;
    gun: ReturnType<typeof createGunRig>;
    localTarget: LaserPoint;
    beamPlan: ReturnType<typeof createBeamPlan>;
    lockedAimRotation: number;
    lockedRigRotation: number;
    lockedBeamRotation: number;
    posePreparing: boolean;
    poseReady: boolean;
    beamVisible: boolean;
    impactPending: boolean;
    fadeStarted: boolean;
    frameA: number | null;
    frameB: number | null;
    resolvePoseReadiness: ((ready: boolean) => void) | null;
    entryReady: boolean;
    entryStarted: boolean;
    exitStarted: boolean;
    exitCompleted: boolean;
    entryReadiness: Promise<boolean>;
    resolveEntryReadiness: ((ready: boolean) => void) | null;
    impactArrivalReadiness: Promise<boolean>;
    resolveImpactArrivalReadiness: ((arrived: boolean) => void) | null;
    onBeamLaunch: (() => void) | null;
    beamLaunchReadiness: Promise<boolean>;
    resolveBeamLaunchReadiness: ((launched: boolean) => void) | null;
    beamFinalScaleX: number;
    beamFinalScaleY: number;
    beamLaunchDelay: gsap.core.Animation | null;
    impactTimeline: gsap.core.Timeline | null;
  };
  const shotStates: ShotState[] = [];
  const triggeredImpacts = new Set<number>();

  const setGunFrame = (shot: ShotState, frameIndex: number): void => {
    const boundedIndex = Math.max(0, Math.min(LASERGUN_FRAME_SOURCES.length - 1, frameIndex));
    shot.gun.image.dataset.lasergunFrame = String(boundedIndex + 1);
    shot.gun.image.src = LASERGUN_FRAME_SOURCES[boundedIndex];
  };

  const settleGunRestFrame = (shot: ShotState): void => {
    setGunFrame(shot, 0);
  };

  const resetShotPreparation = (shot: ShotState): void => {
    if (shot.frameA !== null) window.cancelAnimationFrame(shot.frameA);
    if (shot.frameB !== null) window.cancelAnimationFrame(shot.frameB);
    shot.frameA = null;
    shot.frameB = null;
    shot.posePreparing = false;
    shot.poseReady = false;
    shot.resolvePoseReadiness?.(false);
    shot.resolvePoseReadiness = null;
  };

  const settleShotEntry = (shot: ShotState, ready: boolean): void => {
    if (ready) shot.entryReady = true;
    shot.resolveEntryReadiness?.(ready);
    shot.resolveEntryReadiness = null;
  };

  const settleImpactArrival = (shot: ShotState, arrived: boolean): void => {
    if (!arrived) shot.onBeamLaunch = null;
    shot.resolveImpactArrivalReadiness?.(arrived);
    shot.resolveImpactArrivalReadiness = null;
  };

  const settleBeamLaunch = (shot: ShotState, launched: boolean): void => {
    shot.resolveBeamLaunchReadiness?.(launched);
    shot.resolveBeamLaunchReadiness = null;
  };

  const maybeFinishSequence = (): void => {
    if (!finalExitStarted || sequenceCompleted) return;
    const allEnteredGunsExited = shotStates.every((shot) => (
      !shot.entryStarted || shot.exitCompleted
    ));
    if (allEnteredGunsExited) finishSequence();
  };

  const hasLockedGunAngles = (shot: ShotState): boolean => (
    Math.abs(
      (Number(gsap.getProperty(shot.gun.aim, 'rotation')) || 0) - shot.lockedAimRotation,
    ) <= 0.01
    && Math.abs(
      (Number(gsap.getProperty(shot.gun.rig, 'rotation')) || 0) - shot.lockedRigRotation,
    ) <= 0.01
  );

  const startGunExit = (shot: ShotState): void => {
    if (disposed || shot.exitStarted || !shot.entryStarted) return;
    shot.exitStarted = true;
    resetShotPreparation(shot);
    if (!shot.fadeStarted) gsap.set(shot.beamPlan.image, { opacity: 0 });
    const { rig, side } = shot.gun;
    const exitX = gunExitPoses.get(rig) ?? (side === 'left' ? '-58vw' : '58vw');
    const exit = own(gsap.timeline({
      paused: true,
      onComplete: () => {
        settleGunRestFrame(shot);
        shot.exitCompleted = true;
        rig.style.visibility = 'hidden';
        maybeFinishSequence();
      },
    }));
    // The PNG tail may return 6 -> 1, but spatial pose ownership is immutable.
    // Exit changes only straight translation and opacity; aim, rotation, scale,
    // y and bitmap transforms remain exactly those that produced the beam.
    exit.to(rig, {
      x: exitX,
      opacity: 0,
      duration: LASERGUN_EXIT_TRAVEL_SECONDS,
      ease: 'power2.in',
    }, LASERGUN_EXIT_DELAY_SECONDS);
    exit.play(0);
  };

  const startShotEntry = (shot: ShotState | undefined): void => {
    if (!shot || disposed || finalExitStarted || shot.entryStarted) return;
    shot.entryStarted = true;
    settleGunRestFrame(shot);
    shot.gun.rig.style.visibility = 'visible';
    gsap.set(shot.gun.image, { scale: 0.88, transformOrigin: '24% 32%' });
    const entry = own(gsap.timeline({ paused: true }));
    entry.to(shot.gun.rig, {
      x: 0,
      opacity: 1,
      scale: gunActiveScales.get(shot.gun.rig) ?? 1,
      duration: LASERGUN_ENTRY_DURATION_SECONDS,
      ease: 'back.out(2.35)',
      onComplete: () => {
        settleShotEntry(shot, true);
      },
    }, 0);
    entry.to(shot.gun.image, {
      scale: 1,
      duration: 0.34 * LASERGUN_GUN_TIME_SCALE,
      ease: 'elastic.out(1.05, 0.30)',
    }, 0.14 * LASERGUN_GUN_TIME_SCALE);
    entry.play(0);
  };

  const positionBeam = (shot: ShotState, opacity: 0 | 1): void => {
    const placement = getLaserBeamPlacement(
      resolveMarker(shot.gun.barrel),
      shot.localTarget,
      shot.beamPlan.geometry,
      shot.lockedBeamRotation,
    );
    gsap.set(shot.beamPlan.rig, {
      x: placement.x,
      y: placement.y,
      rotation: placement.rotation,
      transformOrigin: placement.transformOrigin,
      force3D: true,
    });
    gsap.set(shot.beamPlan.scaleLayer, {
      scaleX: placement.scaleX,
      scaleY: placement.scaleY,
      transformOrigin: placement.transformOrigin,
      force3D: true,
    });
    shot.beamFinalScaleX = placement.scaleX;
    shot.beamFinalScaleY = placement.scaleY;
    gsap.set(shot.beamPlan.image, { opacity });
  };

  const startBeamTravel = (shot: ShotState): void => {
    if (disposed || shot.fadeStarted || !shot.beamVisible) return;
    shot.fadeStarted = true;
    const impactTimeline = own(gsap.timeline({
      paused: true,
      onComplete: () => { shot.impactTimeline = null; },
    }));
    shot.impactTimeline = impactTimeline;
    impactTimeline.to(shot.beamPlan.scaleLayer, {
      scaleX: shot.beamFinalScaleX,
      duration: LASERGUN_BEAM_TRAVEL_SECONDS,
      // Decelerate into the cube so the terminal paint cannot cover a large
      // edge-to-centre distance in one frame.
      ease: 'power2.out',
    }, 0);
    impactTimeline.call(() => {
      if (disposed) {
        settleImpactArrival(shot, false);
        return;
      }
      settleImpactArrival(shot, true);
    }, undefined, LASERGUN_BEAM_TRAVEL_SECONDS);
    impactTimeline.to(shot.beamPlan.image, {
      opacity: 0,
      duration: LASERGUN_BEAM_FADE_SECONDS,
      ease: 'sine.in',
    }, LASERGUN_BEAM_TRAVEL_SECONDS + LASERGUN_BEAM_FADE_DELAY_SECONDS);
    impactTimeline.play(0);
  };

  const revealRequestedBeam = (shot: ShotState): void => {
    if (
      disposed ||
      finalExitStarted ||
      shot.exitStarted ||
      !activeGunsPainted ||
      !shot.poseReady ||
      !shot.impactPending ||
      shot.beamVisible
    ) return;
    positionBeam(shot, 0);
    gsap.set(shot.beamPlan.scaleLayer, {
      scaleX: shot.beamFinalScaleX * LASERGUN_BEAM_LAUNCH_SCALE,
      scaleY: shot.beamFinalScaleY,
    });
    gsap.set(shot.beamPlan.image, { opacity: 1 });
    shot.beamVisible = true;
    startBeamTravel(shot);
    startGunExit(shot);
  };

  const prepareShotPose = (shot: ShotState): void => {
    if (disposed || finalExitStarted || shot.exitStarted || shot.posePreparing || shot.poseReady) return;
    shot.posePreparing = true;
    gsap.set(shot.beamPlan.image, { opacity: 0 });
    positionBeam(shot, 0);

    // WebKit may commit the independent gun and beam compositor layers in
    // different frames. Two RAF boundaries guarantee one gun-only paint before
    // the already-positioned beam can become visible.
    shot.frameA = window.requestAnimationFrame(() => {
      shot.frameA = null;
      if (disposed) return;
      positionBeam(shot, 0);
      shot.frameB = window.requestAnimationFrame(() => {
        shot.frameB = null;
        if (disposed) return;
        positionBeam(shot, 0);
        shot.poseReady = true;
        shot.resolvePoseReadiness?.(true);
        shot.resolvePoseReadiness = null;
      });
    });
  };

  const scheduleShotPreparation = (shot: ShotState): void => {
    if (disposed || finalExitStarted || shot.exitStarted || shot.posePreparing || shot.poseReady) return;
    // Aim is already immutable. These two boundaries only commit the hidden
    // beam at the same barrel origin before its opacity may change.
    prepareShotPose(shot);
  };

  const scheduleSceneStartPaintBarrier = (): void => {
    if (disposed || activeGunsPainted || entryPaintFrameA !== null) return;
    // Start the firing clock after the mounted field and first incoming gun
    // cross two paint opportunities. Later guns are started only by their own
    // sequential preflight, so none can wait onscreen on a stale PNG frame.
    entryPaintFrameA = window.requestAnimationFrame(() => {
      entryPaintFrameA = null;
      if (disposed) return;
      entryPaintFrameB = window.requestAnimationFrame(() => {
        entryPaintFrameB = null;
        if (disposed) return;
        activeGunsPainted = true;
        settleEntryReadiness('painted');
      });
    });
  };

  const prepareImpact = (index: number, target: LaserPoint): Promise<boolean> => {
    if (
      disposed ||
      finalExitStarted ||
      !activeGunsPainted ||
      triggeredImpacts.has(index) ||
      !Number.isFinite(target?.x) ||
      !Number.isFinite(target?.y)
    ) return Promise.resolve(false);
    const shot = shotStates[index];
    if (!shot || !hasLockedGunAngles(shot)) return Promise.resolve(false);
    const liveFieldRect = field.getBoundingClientRect();
    const liveLocalTarget = {
      x: target.x - liveFieldRect.left,
      y: target.y - liveFieldRect.top,
    };
    // The gun is already entering with its immutable barrel direction. A real
    // relative target drift must disable the visual shot instead of drawing a
    // beam at an old centre or visibly re-aiming the gun onstage. Shared shake
    // cancels from both points and therefore remains inside this tolerance.
    const targetDrift = Math.hypot(
      liveLocalTarget.x - shot.localTarget.x,
      liveLocalTarget.y - shot.localTarget.y,
    );
    if (targetDrift > LASERGUN_TARGET_LOCK_TOLERANCE_PX) {
      // A later relay gun is still fully hidden until its own prepare step.
      // Re-solve that hidden gun against the live reserved cube instead of
      // retiring the complete 2 -> 3 -> 4 visual chain. A gun that has already
      // entered remains immutable and still fails closed rather than re-aiming
      // on stage while a beam is visible.
      if (shot.entryStarted) return Promise.resolve(false);
      const activeScale = gunActiveScales.get(shot.gun.rig) ?? 1;
      const viewportWidth = Math.max(
        320,
        liveFieldRect.width || initialFieldRect.width || window.innerWidth || 0,
      );
      const currentLeft = Number.parseFloat(shot.gun.rig.style.left) || 0;
      const currentTop = Number.parseFloat(shot.gun.rig.style.top) || 0;
      const solvedLayout = solveGunLayoutBeforeEntry(
        shot.gun,
        liveLocalTarget,
        currentLeft,
        currentTop,
        activeScale,
      );
      const entryX = `${getLaserGunOffscreenTravel(
        shot.gun.side,
        activeScale,
        viewportWidth,
        solvedLayout.left,
      )}px`;
      shot.localTarget = liveLocalTarget;
      shot.lockedAimRotation = solvedLayout.aimRotation;
      shot.lockedBeamRotation = solvedLayout.beamRotation;
      shot.gun.rig.style.left = `${solvedLayout.left}px`;
      shot.gun.rig.style.top = `${solvedLayout.top}px`;
      gunExitPoses.set(shot.gun.rig, entryX);
      gsap.set(shot.gun.rig, {
        x: entryX,
        y: 0,
        rotation: shot.lockedRigRotation,
        opacity: 0,
        scale: 0.65,
      });
      gsap.set(shot.gun.aim, { rotation: shot.lockedAimRotation });
    }

    resetShotPreparation(shot);
    // Target, barrel angle and beam angle were solved together while this gun
    // was still hidden. The live callback validates the shot but cannot repaint
    // a visible gun toward a new angle.
    shot.impactPending = false;
    gsap.set(shot.beamPlan.image, { opacity: 0 });
    settleGunRestFrame(shot);
    startShotEntry(shot);

    const readiness = new Promise<boolean>((resolve) => {
      shot.resolvePoseReadiness = resolve;
    });
    const preflight = own(gsap.timeline({ paused: true }));
    preflight.to({}, {
      duration: LASERGUN_PREFIRE_SETTLE_SECONDS,
    }, LASERGUN_BUILDUP_START_SECONDS);
    preflight.call(() => {
      void shot.entryReadiness.then((entryReady) => {
        if (!entryReady || disposed || finalExitStarted || shot.exitStarted) {
          shot.resolvePoseReadiness?.(false);
          shot.resolvePoseReadiness = null;
          return;
        }
        scheduleShotPreparation(shot);
      });
    }, undefined, LASERGUN_BUILDUP_START_SECONDS + LASERGUN_PREFIRE_SETTLE_SECONDS);
    preflight.play(0);
    return readiness;
  };

  const playGunFiringFlow = (shot: ShotState): gsap.core.Timeline => {
    settleGunRestFrame(shot);
    const firing = own(gsap.timeline({
      paused: true,
      // Converge after the uninterrupted visible return. Interruption must not
      // inject frame 1 between frame 6 and the remaining reverse frames; the
      // hidden exit completion owns that final safety convergence.
      onComplete: () => settleGunRestFrame(shot),
    }));
    LASERGUN_FRAME_SOURCES.slice(1).forEach((_frameSource, frameIndex) => {
      firing.call(() => {
        if (disposed || finalExitStarted || shot.exitStarted) return;
        setGunFrame(shot, frameIndex + 1);
      }, undefined, frameIndex === LASERGUN_FRAME_SOURCES.length - 2
        ? LASERGUN_CUBE_REACTION_PRECEDES_BEAM_SECONDS - LASERGUN_FRAME6_PAINT_LEAD_SECONDS
        : (frameIndex + 1) * LASERGUN_FIRE_FRAME_STEP_SECONDS);
    });
    firing.call(() => {
      if (disposed || finalExitStarted || shot.exitStarted) return;
      revealRequestedBeam(shot);
      settleBeamLaunch(shot, shot.beamVisible);
    }, undefined, LASERGUN_CUBE_REACTION_PRECEDES_BEAM_SECONDS);
    LASERGUN_FRAME_SOURCES.slice(0, 5).reverse().forEach((_frameSource, frameIndex) => {
      firing.call(() => {
        if (disposed) return;
        setGunFrame(shot, LASERGUN_FRAME_SOURCES.length - 2 - frameIndex);
      }, undefined, (
        LASERGUN_CUBE_REACTION_PRECEDES_BEAM_SECONDS
        + (frameIndex + 1) * LASERGUN_FIRE_FRAME_STEP_SECONDS
      ));
    });
    firing.play(0);
    return firing;
  };

  const controller: LaserGunFinaleController = {
    setTargets: (targets) => {
      if (disposed || targetsApplied) return entryReadiness;
      targetsApplied = true;
      const boundedTargets = targets
        .filter((target) => Number.isFinite(target?.x) && Number.isFinite(target?.y))
        .slice(0, LASERGUN_MAX_TARGETS);
      if (!boundedTargets.length) {
        settleEntryReadiness('cancelled');
        startExit();
        return entryReadiness;
      }
      // The initial TNT shake starts after this scene is attached but before
      // targets are handed over. Freeze every target against one live field
      // rect from this exact handoff so the shared shake cancels once instead
      // of becoming a permanent offset in the locked gun/beam direction.
      const targetFieldRect = field.getBoundingClientRect();
      const viewportHeight = Math.max(
        320,
        targetFieldRect.height || initialFieldRect.height || window.innerHeight || 0,
      );
      const viewportWidth = Math.max(
        320,
        targetFieldRect.width || initialFieldRect.width || window.innerWidth || 0,
      );
      const localTargets = boundedTargets.map((target) => ({
        x: target.x - targetFieldRect.left,
        y: target.y - targetFieldRect.top,
      }));
      const targetsPerSide: Record<LaserGunShooter, number> = {
        left: boundedTargets.filter(({ shooter }) => shooter === 'left').length,
        right: boundedTargets.filter(({ shooter }) => shooter === 'right').length,
      };
      const sideYPositions: Record<LaserGunShooter, number[]> = {
        left: getLaserGunSideYPositions(targetsPerSide.left, viewportHeight, 'left'),
        right: getLaserGunSideYPositions(targetsPerSide.right, viewportHeight, 'right'),
      };
      const gunUsage: Record<LaserGunShooter, number> = { left: 0, right: 0 };
      const randomGunScales = getLaserGunRandomScales(boundedTargets.length, random);
      const assignedShots = boundedTargets.map((target, targetIndex) => {
        const { shooter } = target;
        const sideIndex = gunUsage[shooter]++;
        const { gun, beamPlan } = ensureGunBeamPair(shooter, sideIndex);
        const activeScale = randomGunScales[targetIndex];
        const nominalOnstageX = getLaserGunStageCenterX(shooter, activeScale, viewportWidth);
        const muzzleX = getLaserGunMuzzleX(shooter, viewportWidth);
        const localTarget = localTargets[targetIndex];
        const nominalTop = getLaserGunConstrainedTop(
          sideYPositions[shooter][sideIndex],
          localTarget,
          muzzleX,
        );
        const solvedLayout = solveGunLayoutBeforeEntry(
          gun,
          localTarget,
          nominalOnstageX,
          nominalTop,
          activeScale,
        );
        const entryX = `${getLaserGunOffscreenTravel(
          shooter,
          activeScale,
          viewportWidth,
          solvedLayout.left,
        )}px`;
        const lockedRigRotation = shooter === 'left' ? 0 : -8;
        gun.rig.style.left = `${solvedLayout.left}px`;
        gun.rig.style.top = `${solvedLayout.top}px`;
        gun.rig.dataset.lasergunTarget = String(targetIndex);
        beamPlan.image.dataset.lasergunTarget = String(targetIndex);
        gunExitPoses.set(gun.rig, entryX);
        gunActiveScales.set(gun.rig, activeScale);
        gsap.set(gun.rig, {
          x: entryX,
          y: 0,
          rotation: lockedRigRotation,
          opacity: 0,
          scale: 0.65,
        });
        gsap.set(gun.aim, { rotation: solvedLayout.aimRotation });
        return {
          gun,
          beamPlan,
          lockedAimRotation: solvedLayout.aimRotation,
          lockedRigRotation,
          lockedBeamRotation: solvedLayout.beamRotation,
        };
      });
      boundedTargets.forEach((_target, index) => {
        const localTarget = localTargets[index];
        const {
          gun,
          beamPlan,
          lockedAimRotation,
          lockedRigRotation,
          lockedBeamRotation,
        } = assignedShots[index];
        let resolveShotEntry!: (ready: boolean) => void;
        const shotEntryReadiness = new Promise<boolean>((resolve) => {
          resolveShotEntry = resolve;
        });
        let resolveImpactArrival!: (arrived: boolean) => void;
        const impactArrivalReadiness = new Promise<boolean>((resolve) => {
          resolveImpactArrival = resolve;
        });
        let resolveBeamLaunch!: (launched: boolean) => void;
        const beamLaunchReadiness = new Promise<boolean>((resolve) => {
          resolveBeamLaunch = resolve;
        });
        const shot: ShotState = {
          index,
          gun,
          localTarget,
          beamPlan,
          lockedAimRotation,
          lockedRigRotation,
          lockedBeamRotation,
          posePreparing: false,
          poseReady: false,
          beamVisible: false,
          impactPending: false,
          fadeStarted: false,
          frameA: null,
          frameB: null,
          resolvePoseReadiness: null,
          entryReady: false,
          entryStarted: false,
          exitStarted: false,
          exitCompleted: false,
          entryReadiness: shotEntryReadiness,
          resolveEntryReadiness: resolveShotEntry,
          impactArrivalReadiness,
          resolveImpactArrivalReadiness: resolveImpactArrival,
          onBeamLaunch: null,
          beamLaunchReadiness,
          resolveBeamLaunchReadiness: resolveBeamLaunch,
          beamFinalScaleX: 1,
          beamFinalScaleY: 1,
          beamLaunchDelay: null,
          impactTimeline: null,
        };
        shotStates.push(shot);
      });
      scheduleSceneStartPaintBarrier();
      return entryReadiness;
    },
    prepareImpact,
    triggerImpact: (index, onLaunch) => {
      if (disposed || finalExitStarted || !activeGunsPainted || triggeredImpacts.has(index)) return false;
      const shot = shotStates[index];
      if (!shot || !shot.poseReady || !hasLockedGunAngles(shot)) return false;
      triggeredImpacts.add(index);
      shot.onBeamLaunch = onLaunch || null;
      // Start the cube scale lead now; beam reveal follows after the exact
      // requested lead without changing the beam's own travel timing.
      const startCubeReaction = shot.onBeamLaunch;
      shot.onBeamLaunch = null;
      try { startCubeReaction?.(); } catch {}
      shot.impactPending = true;
      if (LASERGUN_CUBE_REACTION_PRECEDES_BEAM_SECONDS > 0) {
        shot.beamLaunchDelay = playGunFiringFlow(shot);
      } else {
        setGunFrame(shot, 5);
        revealRequestedBeam(shot);
        settleBeamLaunch(shot, shot.beamVisible);
      }
      return true;
    },
        waitForImpactArrival: (index) => (
          shotStates[index]?.impactArrivalReadiness ?? Promise.resolve(false)
        ),
        waitForBeamLaunch: (index) => (
          shotStates[index]?.beamLaunchReadiness ?? Promise.resolve(false)
        ),
    cancelImpact: (index) => {
          const shot = shotStates[index];
          if (!shot) return;
          try { shot.beamLaunchDelay?.kill(); } catch {}
          shot.beamLaunchDelay = null;
          settleBeamLaunch(shot, false);
          try { shot.impactTimeline?.kill(); } catch {}
      shot.impactTimeline = null;
      try {
        gsap.killTweensOf(shot.beamPlan.scaleLayer);
        gsap.killTweensOf(shot.beamPlan.image);
      } catch {}
      gsap.set(shot.beamPlan.image, { opacity: 0 });
      shot.beamVisible = false;
      settleImpactArrival(shot, false);
    },
    completeImpacts: startExit,
    cleanup: () => {},
  };

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    settleEntryReadiness('cancelled');
    if (activeController === controller) activeController = null;
    ownedTimelines.splice(0).forEach((timeline) => {
      try { timeline.kill(); } catch {}
    });
        shotStates.forEach((shot) => {
      resetShotPreparation(shot);
      settleShotEntry(shot, false);
          settleImpactArrival(shot, false);
          settleBeamLaunch(shot, false);
    });
    if (entryPaintFrameA !== null) window.cancelAnimationFrame(entryPaintFrameA);
    if (entryPaintFrameB !== null) window.cancelAnimationFrame(entryPaintFrameB);
    entryPaintFrameA = null;
    entryPaintFrameB = null;
    try {
      gsap.killTweensOf(field);
      field.querySelectorAll('*').forEach((element) => gsap.killTweensOf(element));
      gsap.killTweensOf(rightGunField);
      rightGunField.querySelectorAll('*').forEach((element) => gsap.killTweensOf(element));
    } catch {}
    field.remove();
    rightGunField.remove();
  };
  controller.cleanup = cleanup;
  activeController?.cleanup();
  activeController = controller;
  targetRequest.play(0);
  void preloadLaserGunFinaleAssets();
  return cleanup;
}
