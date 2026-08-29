import { gsap } from 'gsap';
import animationManager from './animation-manager.js';
import type { LaserGunShooter } from './tnt-bonus-target-selection.js';

const BASE = './assets/shop/gun/';
const useHighResolutionAssets = typeof navigator !== 'undefined'
  && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const source = (name: string): string => `${BASE}${name}${useHighResolutionAssets ? '@2x' : ''}.png`;

export const LASERGUN_FRAME_SOURCES = Array.from(
  { length: 6 },
  (_, index) => source(`lasergun${index + 1}`),
);
export const LASERGUN_FRAME_SEQUENCE = [
  ...LASERGUN_FRAME_SOURCES.slice(0, 5),
  ...LASERGUN_FRAME_SOURCES.slice(0, 4).reverse(),
] as const;
export const LASERGUN_IMPACT_DELAYS_MS = [1100, 1340, 1580, 1820] as const;
export const LASERGUN_MAX_TARGETS = 4;
export const LASERGUN_UPPER_GUN_TRANSFORM = 'rotate(45deg) scaleX(-1)';
export const LASERGUN_SHOT_PATTERN = ['right', 'left', 'right', 'left'] as const;
export const LASERGUN_BEAM_COUNT = LASERGUN_SHOT_PATTERN.length;
export const LASERGUN_GUN_SCALES = [0.80, 0.70, 0.60] as const;
export const LASERGUN_TARGET_REACH_SCALE = 1.05;

export const LASERGUN_LEFT_BEAM_GEOMETRY = {
  width: 439,
  height: 495,
  sourceX: 60,
  sourceY: 157,
  // Authored burst centre keeps the beam at its original strong visual scale.
  impactX: 330,
  impactY: 342,
} as const;
export const LASERGUN_RIGHT_BEAM_GEOMETRY = {
  width: 430,
  height: 496,
  sourceX: 360,
  sourceY: 313,
  // Authored burst centre keeps the beam at its original strong visual scale.
  impactX: 80,
  impactY: 148,
} as const;

type LaserPoint = {
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
  scale: number;
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
  const boundedCount = Math.max(0, Math.min(2, Math.floor(count)));
  if (!boundedCount) return [];
  const height = Math.max(320, viewportHeight);
  const edgeMargin = Math.min(height * 0.24, 132);
  const minCenter = edgeMargin;
  const maxCenter = height - edgeMargin;
  if (boundedCount === 1) {
    const anchor = side === 'left' ? height * 0.30 : height * 0.70;
    return [Math.max(minCenter, Math.min(maxCenter, anchor))];
  }
  const available = Math.max(0, maxCenter - minCenter);
  const separation = Math.min(preferredSeparation, available);
  const anchor = side === 'left' ? height * 0.30 : height * 0.70;
  const start = Math.max(minCenter, Math.min(maxCenter - separation, anchor - separation * 0.5));
  return [start, start + separation];
}

type BeamGeometry = typeof LASERGUN_LEFT_BEAM_GEOMETRY | typeof LASERGUN_RIGHT_BEAM_GEOMETRY;

export function getLaserBeamPlacement(
  barrel: LaserPoint,
  target: LaserPoint,
  geometry: BeamGeometry,
): LaserBeamPlacement {
  const baselineX = geometry.impactX - geometry.sourceX;
  const baselineY = geometry.impactY - geometry.sourceY;
  const targetX = target.x - barrel.x;
  const targetY = target.y - barrel.y;
  const baselineLength = Math.max(1, Math.hypot(baselineX, baselineY));
  const targetLength = Math.max(1, Math.hypot(targetX, targetY)) * LASERGUN_TARGET_REACH_SCALE;
  return {
    x: barrel.x - geometry.sourceX,
    y: barrel.y - geometry.sourceY,
    rotation: (Math.atan2(targetY, targetX) - Math.atan2(baselineY, baselineX)) * 180 / Math.PI,
    scale: targetLength / baselineLength,
    transformOrigin: `${geometry.sourceX}px ${geometry.sourceY}px`,
  };
}

type LaserGunFinaleController = {
  setTargets: (targets: LaserGunFinaleTarget[]) => void;
  triggerImpact: (index: number) => void;
  cleanup: () => void;
};

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

export function setActiveLaserGunFinaleTargets(targets: LaserGunFinaleTarget[]): void {
  activeController?.setTargets(targets);
}

export function triggerActiveLaserGunFinaleImpact(index: number): void {
  activeController?.triggerImpact(index);
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

function createGunRig(className: string, side: LaserGunShooter): {
  rig: HTMLElement;
  aim: HTMLElement;
  image: HTMLImageElement;
  barrel: HTMLElement;
  axis: HTMLElement;
  side: LaserGunShooter;
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
  image.style.cssText += ';inset:0;width:100%;height:100%;object-fit:contain';
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
  return { rig, aim, image, barrel, axis, side };
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
  let exitStarted = false;
  let activeGuns: Array<ReturnType<typeof createGunRig>> = [];
  const ownedTimelines: gsap.core.Timeline[] = [];
  const own = (timeline: gsap.core.Timeline): gsap.core.Timeline => {
    ownedTimelines.push(timeline);
    return animationManager.trackExternalTimeline(timeline);
  };

  const field = document.createElement('div');
  field.className = 'cc-lasergun-finale-scene';
  field.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:1';
  const rightGunField = document.createElement('div');
  rightGunField.className = 'cc-lasergun-right-gun-layer';
  rightGunField.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:3';

  const gunPools: Record<LaserGunShooter, Array<ReturnType<typeof createGunRig>>> = {
    left: [
      createGunRig('cc-lasergun-rig-left cc-lasergun-rig-left-0', 'left'),
      createGunRig('cc-lasergun-rig-left cc-lasergun-rig-left-1', 'left'),
    ],
    right: [
      createGunRig('cc-lasergun-rig-right cc-lasergun-rig-right-0', 'right'),
      createGunRig('cc-lasergun-rig-right cc-lasergun-rig-right-1', 'right'),
    ],
  };
  const allGuns = [...gunPools.left, ...gunPools.right];
  allGuns.forEach(({ rig, side }) => {
    rig.style.cssText += `;left:${side === 'left' ? '8%' : '92%'};top:50%;visibility:hidden`;
    (side === 'right' ? rightGunField : field).appendChild(rig);
  });

  const createBeamPlan = (side: LaserGunShooter, slot: number) => {
    const firesFromLeft = side === 'left';
    const geometry = firesFromLeft ? LASERGUN_LEFT_BEAM_GEOMETRY : LASERGUN_RIGHT_BEAM_GEOMETRY;
    const image = createImage(
      source(firesFromLeft ? 'left laser' : 'right laser'),
      `cc-lasergun-beam cc-lasergun-beam-${firesFromLeft ? 'left' : 'right'}`,
    );
    image.dataset.lasergunSlot = `${side}-${slot}`;
    image.style.cssText += `;left:0;top:0;width:${geometry.width}px;height:${geometry.height}px;opacity:0;z-index:3;filter:brightness(1.18) saturate(1.12) drop-shadow(0 0 7px rgba(117,232,255,.82))`;
    field.appendChild(image);
    return { image, geometry, firesFromLeft, side, slot };
  };
  const beamPools: Record<LaserGunShooter, Array<ReturnType<typeof createBeamPlan>>> = {
    left: [createBeamPlan('left', 0), createBeamPlan('left', 1)],
    right: [createBeamPlan('right', 0), createBeamPlan('right', 1)],
  };
  const beams = [...beamPools.left, ...beamPools.right];

  overlay.insertBefore(field, overlay.firstChild);
  overlay.insertBefore(rightGunField, field.nextSibling);
  gsap.set(allGuns.map(({ rig }) => rig), {
    xPercent: -50,
    yPercent: -50,
    opacity: 0,
    scale: 0.65,
    force3D: true,
  });
  gsap.set(beams.map(({ image }) => image), { opacity: 0, scale: 0.04, force3D: true });
  let sequenceCompleted = false;
  const gunExitPoses = new Map<HTMLElement, { x: string; rotation: number }>();
  const gunActiveScales = new Map<HTMLElement, number>();
  const finishSequence = () => {
    if (disposed || sequenceCompleted) return;
    sequenceCompleted = true;
    try { options.onSequenceComplete?.(); } catch {}
  };
  const startExit = () => {
    if (disposed || sequenceCompleted || exitStarted) return;
    exitStarted = true;
    gsap.set(beams.map(({ image }) => image), { opacity: 0 });
    if (!activeGuns.length) {
      finishSequence();
      return;
    }
    const exit = own(gsap.timeline({ paused: true, onComplete: finishSequence }));
    exit.to(activeGuns.map(({ aim }) => aim), {
      rotation: 0,
      duration: 0.10,
      ease: 'sine.out',
      overwrite: 'auto',
    }, 0);
    activeGuns.forEach(({ rig, side }) => {
      const exitPose = gunExitPoses.get(rig) ?? {
        x: side === 'left' ? '-58vw' : '58vw',
        rotation: side === 'left' ? -18 : 18,
      };
      exit.to(rig, {
        x: exitPose.x,
        y: 0,
        rotation: exitPose.rotation,
        opacity: 0,
        scale: 0.65,
        duration: 0.42,
        ease: 'back.in(1.4)',
      }, 0.08);
    });
    exit.play(0);
  };

  const targetRequest = own(gsap.timeline({ paused: true }));
  targetRequest.call(() => {
    if (disposed) return;
    try { options.onFireReady?.(); } catch {}
  }, undefined, 0.04);
  targetRequest.to({}, { duration: 0.02 }, 0.04);

  const fieldRect = field.getBoundingClientRect();
  const resolveMarker = (marker: HTMLElement): LaserPoint => {
    const rect = marker.getBoundingClientRect();
    return {
      x: rect.left + rect.width * 0.5 - fieldRect.left,
      y: rect.top + rect.height * 0.5 - fieldRect.top,
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

  type ShotState = {
    index: number;
    gun: ReturnType<typeof createGunRig>;
    localTarget: LaserPoint;
    beamPlan: (typeof beams)[number];
    posePreparing: boolean;
    poseReady: boolean;
    beamVisible: boolean;
    impactPending: boolean;
    fadeStarted: boolean;
    prepFrame: number | null;
    frameA: number | null;
    frameB: number | null;
  };
  const shotStates: ShotState[] = [];
  const triggeredImpacts = new Set<number>();

  const positionBeam = (shot: ShotState, opacity: 0 | 1): void => {
    const placement = getLaserBeamPlacement(
      resolveMarker(shot.gun.barrel),
      shot.localTarget,
      shot.beamPlan.geometry,
    );
    gsap.set(shot.beamPlan.image, {
      x: placement.x,
      y: placement.y,
      rotation: placement.rotation,
      scale: placement.scale,
      opacity,
      transformOrigin: placement.transformOrigin,
      force3D: true,
    });
  };

  const commitExactGunPose = (shot: ShotState): void => {
    // Mirrored guns need a second marker solve after the first transform commit.
    // Both passes stay hidden so no intermediate direction can be painted.
    for (let pass = 0; pass < 3; pass += 1) {
      gsap.set(shot.gun.aim, { rotation: aimRotationFor(shot.gun, shot.localTarget) });
    }
  };

  const startImpactFade = (shot: ShotState): void => {
    if (disposed || shot.fadeStarted || !shot.beamVisible) return;
    shot.fadeStarted = true;
    const impactTimeline = own(gsap.timeline({ paused: true }));
    impactTimeline.to(shot.beamPlan.image, { opacity: 0, duration: 0.18, ease: 'sine.in' }, 0.14);
    if (shot.index === shotStates.length - 1) {
      impactTimeline.call(startExit, undefined, 0.34);
    }
    impactTimeline.play(0);
  };

  const playGunRecoil = (shot: ShotState): void => {
    try { gsap.killTweensOf(shot.gun.image); } catch {}
    const recoil = own(gsap.timeline({ paused: true }));
    recoil.to(shot.gun.image, {
      x: 10,
      y: 5.5,
      duration: 0.055,
      ease: 'power2.out',
      force3D: true,
    });
    recoil.to(shot.gun.image, {
      x: 0,
      y: 0,
      duration: 0.30,
      ease: 'elastic.out(1, 0.34)',
      force3D: true,
    });
    recoil.play(0);
  };

  const revealRequestedBeam = (shot: ShotState): void => {
    if (disposed || !shot.poseReady || !shot.impactPending || shot.beamVisible) return;
    positionBeam(shot, 1);
    shot.beamVisible = true;
    playGunRecoil(shot);
    startImpactFade(shot);
  };

  const prepareShotPose = (shot: ShotState): void => {
    if (disposed || shot.posePreparing || shot.poseReady) return;
    shot.posePreparing = true;
    try { gsap.killTweensOf(shot.gun.aim); } catch {}
    gsap.set(shot.beamPlan.image, { opacity: 0 });
    commitExactGunPose(shot);
    positionBeam(shot, 0);

    // WebKit may commit the independent gun and beam compositor layers in
    // different frames. Two RAF boundaries guarantee one gun-only paint before
    // the already-positioned beam can become visible.
    shot.frameA = window.requestAnimationFrame(() => {
      shot.frameA = null;
      if (disposed) return;
      commitExactGunPose(shot);
      positionBeam(shot, 0);
      shot.frameB = window.requestAnimationFrame(() => {
        shot.frameB = null;
        if (disposed) return;
        positionBeam(shot, 0);
        shot.poseReady = true;
        revealRequestedBeam(shot);
      });
    });
  };

  const scheduleShotPreparation = (shot: ShotState): void => {
    if (disposed || shot.posePreparing || shot.poseReady || shot.prepFrame !== null) return;
    shot.prepFrame = window.requestAnimationFrame(() => {
      shot.prepFrame = null;
      prepareShotPose(shot);
    });
  };

  const controller: LaserGunFinaleController = {
    setTargets: (targets) => {
      if (disposed || targetsApplied) return;
      targetsApplied = true;
      const boundedTargets = targets
        .filter((target) => Number.isFinite(target?.x) && Number.isFinite(target?.y))
        .slice(0, LASERGUN_MAX_TARGETS);
      if (!boundedTargets.length) {
        startExit();
        return;
      }
      const viewportHeight = Math.max(320, fieldRect.height || window.innerHeight || 0);
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
      const assignedShots = boundedTargets.map(({ shooter }, targetIndex) => {
        const sideIndex = gunUsage[shooter]++;
        const gun = gunPools[shooter][sideIndex];
        const beamPlan = beamPools[shooter][sideIndex];
        const top = sideYPositions[shooter][sideIndex];
        const entryX = shooter === 'left' ? '-58vw' : '58vw';
        const entryRotation = shooter === 'left' ? -18 : 18;
        gun.rig.style.top = `${top}px`;
        gun.rig.style.visibility = 'visible';
        gun.rig.dataset.lasergunTarget = String(targetIndex);
        beamPlan.image.dataset.lasergunTarget = String(targetIndex);
        gunExitPoses.set(gun.rig, { x: entryX, rotation: entryRotation });
        gunActiveScales.set(gun.rig, randomGunScales[targetIndex]);
        gsap.set(gun.rig, {
          x: entryX,
          y: 0,
          rotation: entryRotation,
          opacity: 0,
          scale: 0.65,
        });
        return { gun, beamPlan };
      });
      activeGuns = assignedShots.map(({ gun }) => gun);
      const intro = own(gsap.timeline({ paused: true }));
      activeGuns.forEach(({ rig, side }, index) => {
        intro.to(rig, {
          x: 0,
          y: 0,
          rotation: side === 'left' ? 0 : -8,
          opacity: 1,
          scale: gunActiveScales.get(rig) ?? 1,
          duration: 0.50,
          ease: 'back.out(2.1)',
        }, index * 0.035);
      });
      LASERGUN_FRAME_SEQUENCE.slice(1).forEach((frameSource, frameIndex) => {
        intro.call(() => {
          if (disposed) return;
          activeGuns.forEach(({ image }) => { image.src = frameSource; });
        }, undefined, 0.06 + frameIndex * 0.06);
      });
      intro.to({}, { duration: 0.04 }, 0.54);
      const fireTimeline = own(gsap.timeline({ paused: true, onComplete: startExit }));
      boundedTargets.forEach((target, index) => {
        const localTarget = {
          x: target.x - fieldRect.left,
          y: target.y - fieldRect.top,
        };
        const { gun, beamPlan } = assignedShots[index];
        const impactAt = LASERGUN_IMPACT_DELAYS_MS[index] / 1000;
        const aimAt = Math.max(0, impactAt - 0.36);
        const shot: ShotState = {
          index,
          gun,
          localTarget,
          beamPlan,
          posePreparing: false,
          poseReady: false,
          beamVisible: false,
          impactPending: false,
          fadeStarted: false,
          prepFrame: null,
          frameA: null,
          frameB: null,
        };
        shotStates.push(shot);
        fireTimeline.to(gun.aim, {
          rotation: () => aimRotationFor(gun, localTarget),
          duration: 0.16,
          ease: 'sine.inOut',
          onComplete: () => prepareShotPose(shot),
        }, aimAt);
      });
      fireTimeline.call(startExit, undefined,
        (LASERGUN_IMPACT_DELAYS_MS[boundedTargets.length - 1] ?? 0) / 1000 + 0.75);
      intro.play(0);
      fireTimeline.play(0);
    },
    triggerImpact: (index) => {
      if (disposed || triggeredImpacts.has(index)) return;
      const shot = shotStates[index];
      if (!shot) return;
      triggeredImpacts.add(index);
      shot.impactPending = true;
      if (shot.poseReady) revealRequestedBeam(shot);
      else scheduleShotPreparation(shot);
    },
    cleanup: () => {},
  };

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    if (activeController === controller) activeController = null;
    ownedTimelines.splice(0).forEach((timeline) => {
      try { timeline.kill(); } catch {}
    });
    shotStates.forEach((shot) => {
      if (shot.prepFrame !== null) window.cancelAnimationFrame(shot.prepFrame);
      if (shot.frameA !== null) window.cancelAnimationFrame(shot.frameA);
      if (shot.frameB !== null) window.cancelAnimationFrame(shot.frameB);
      shot.prepFrame = null;
      shot.frameA = null;
      shot.frameB = null;
    });
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
