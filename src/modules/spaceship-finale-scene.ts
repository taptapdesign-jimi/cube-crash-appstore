import { gsap } from 'gsap';
import animationManager from './animation-manager.js';
import { logger } from '../core/logger.js';

const PACK = './assets/shop/spaceship';
export const SPACESHIP_SCENE_SECONDS = 4;
const SCENE_SECONDS = SPACESHIP_SCENE_SECONDS;
const useHighResolutionAssets = typeof window !== 'undefined' && window.devicePixelRatio > 1.5;
const source = (name: string) => `${PACK}/${name}${useHighResolutionAssets ? '@2x' : ''}.png`;
const SAUCER_SOURCES = Array.from({ length: 4 }, (_, index) => source(`saucer${index + 1}`));
const ROCK_SOURCES = Array.from({ length: 7 }, (_, index) => source(`rock${index + 1}`));
const CAN_SOURCES = Array.from({ length: 5 }, (_, index) => source(`kanta${index + 1}`));
export const SPACESHIP_BEAM_SHIMMER_LEVELS = [1, 0.9, 0.5, 0.6, 0.3] as const;
export const SPACESHIP_RIGHT_BEAM_LEAD_LEVELS = [0.5, 0.6, 0.4, 1] as const;
export const SPACESHIP_LAYER_Z = {
  belowBeam: 1,
  beam: 2,
  aboveBeam: 3,
  saucer: 4,
} as const;
export const SPACESHIP_DEBRIS_INITIAL_SCALE = 1;
export const SPACESHIP_DEBRIS_FINAL_VISIBLE_SCALE = 0.16;
export const SPACESHIP_PULL_BASE_SECONDS = 2;
export const SPACESHIP_PULL_ARRIVAL_GAP_SECONDS = 0.045;
export const SPACESHIP_PULL_LINEAR_WEIGHT = 0.14;

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

export const SPACESHIP_DEBRIS_PLAN = [
  { id: 'rock1', source: ROCK_SOURCES[0], x: 31, y: 112, curveX: [25, 38], size: 108, pullOrder: 0, startRotation: -12, wobbleRotation: 8, driftX: 16, belowBeams: false },
  { id: 'can1', source: CAN_SOURCES[0], x: 44, y: 116, curveX: [51, 39], size: 132, pullOrder: 2, startRotation: 10, wobbleRotation: -10, driftX: -16, belowBeams: true },
  { id: 'rock2', source: ROCK_SOURCES[1], x: 62, y: 120, curveX: [70, 56], size: 112, pullOrder: 1, startRotation: 8, wobbleRotation: -7, driftX: -18, belowBeams: false },
  { id: 'rock3', source: ROCK_SOURCES[2], x: 39, y: 124, curveX: [31, 45], size: 116, pullOrder: 3, startRotation: -7, wobbleRotation: 8, driftX: 14, belowBeams: true },
  { id: 'can2', source: CAN_SOURCES[1], x: 72, y: 128, curveX: [82, 62], size: 128, pullOrder: 4, startRotation: -9, wobbleRotation: 9, driftX: 18, belowBeams: true },
  { id: 'rock4', source: ROCK_SOURCES[3], x: 24, y: 132, curveX: [16, 36], size: 104, pullOrder: 5, startRotation: 11, wobbleRotation: -10, driftX: -20, belowBeams: false },
  { id: 'rock5', source: ROCK_SOURCES[4], x: 50, y: 136, curveX: [59, 44], size: 114, pullOrder: 7, startRotation: -8, wobbleRotation: 7, driftX: 18, belowBeams: false },
  { id: 'can3', source: CAN_SOURCES[2], x: 29, y: 140, curveX: [19, 39], size: 126, pullOrder: 6, startRotation: 12, wobbleRotation: -9, driftX: -20, belowBeams: false },
  { id: 'rock6', source: ROCK_SOURCES[5], x: 64, y: 144, curveX: [75, 59], size: 109, pullOrder: 9, startRotation: 9, wobbleRotation: -8, driftX: -14, belowBeams: true },
  { id: 'can4', source: CAN_SOURCES[3], x: 77, y: 148, curveX: [88, 65], size: 134, pullOrder: 8, startRotation: -10, wobbleRotation: 8, driftX: 15, belowBeams: true },
  { id: 'rock7', source: ROCK_SOURCES[6], x: 48, y: 152, curveX: [37, 55], size: 111, pullOrder: 11, startRotation: -11, wobbleRotation: 10, driftX: 20, belowBeams: true },
  { id: 'can5', source: CAN_SOURCES[4], x: 52, y: 156, curveX: [63, 45], size: 130, pullOrder: 10, startRotation: 7, wobbleRotation: -9, driftX: -18, belowBeams: false },
] as const;

export function getSpaceshipDebrisMotion(plan: { pullOrder: number }) {
  const travelStartAt = 0;
  const travelSeconds = SPACESHIP_PULL_BASE_SECONDS
    + plan.pullOrder * SPACESHIP_PULL_ARRIVAL_GAP_SECONDS;
  return { travelStartAt, travelSeconds, arrivalAt: travelSeconds };
}
export const SPACESHIP_FINALE_SOURCES = [
  ...SAUCER_SOURCES,
  source('leftbeam'),
  source('rightbeam'),
  ...ROCK_SOURCES,
  ...CAN_SOURCES,
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

export function attachSpaceshipFinaleScene(overlay: HTMLElement): (() => void) & {
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

  const debris = SPACESHIP_DEBRIS_PLAN.map((layout) => {
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
      `z-index:${layout.belowBeams ? SPACESHIP_LAYER_Z.belowBeam : SPACESHIP_LAYER_Z.aboveBeam}`,
    ].join(';');
    const image = createImage(layout.source, 'cc-spaceship-finale-debris');
    image.dataset.spaceshipDebris = layout.id;
    image.style.cssText += ';inset:0;width:100%;height:100%;object-fit:contain';
    mover.appendChild(image);
    field.appendChild(mover);
    return { mover, image, ...layout };
  });
  overlay.insertBefore(field, overlay.firstChild);

  gsap.set(rigTargets, { xPercent: -50, y: '-42vh', rotation: -11, opacity: 1, force3D: true });
  gsap.set([leftBeam, rightBeam], { opacity: 0, scaleY: 0.96, force3D: true });
  debris.forEach(({ mover, image, x, y, startRotation }) => {
    gsap.set(mover, {
      left: `${x}%`,
      top: `${y}%`,
      xPercent: -50,
      yPercent: -50,
      scale: SPACESHIP_DEBRIS_INITIAL_SCALE,
      opacity: 1,
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
    const master = own(gsap.timeline({ paused: true }));
    master.to(rigTargets, {
      y: '4vh',
      rotation: 0,
      duration: 0.58,
      ease: 'power3.out',
    }, 0);
    master.to(rigTargets, { x: -24, y: '6vh', rotation: -10, duration: 0.58, ease: 'sine.inOut' }, 0.58);
    master.to(rigTargets, { x: 18, y: '2vh', rotation: 12, duration: 0.62, ease: 'sine.inOut' }, 1.16);
    master.to(rigTargets, { x: -12, y: '7vh', rotation: -8, duration: 0.62, ease: 'sine.inOut' }, 1.78);
    master.to(rigTargets, { x: 14, y: '3vh', rotation: 10, duration: 0.60, ease: 'sine.inOut' }, 2.40);
    master.to(rigTargets, { x: 0, y: '5vh', rotation: 0, duration: 0.52, ease: 'sine.inOut' }, 3.00);
    master.to(rigTargets, { y: '-48vh', rotation: 9, duration: 0.48, ease: 'power2.in' }, 3.52);

    for (let index = 0; index < 22; index += 1) {
      master.call(() => {
        if (!disposed) saucer.src = SAUCER_SOURCES[index % SAUCER_SOURCES.length];
      }, undefined, 0.50 + index * 0.135);
    }

    const beams = own(gsap.timeline({ paused: true }));
    beams.to(leftBeam, { opacity: 1, duration: 0.28, ease: 'power2.in' }, 0.52);
    const scheduleBeamShimmer = (
      beam: HTMLImageElement,
      startAt: number,
      leadLevels: readonly number[] = [],
    ) => {
      const stepSeconds = 0.11;
      const lastStartSeconds = 3.34;
      let cursor = startAt;
      for (const opacity of leadLevels) {
        if (cursor > lastStartSeconds) return;
        beams.to(beam, { opacity, duration: 0.10, ease: 'sine.inOut' }, cursor);
        cursor += stepSeconds;
      }
      while (cursor <= lastStartSeconds) {
        const cycle = gsap.utils.shuffle([...SPACESHIP_BEAM_SHIMMER_LEVELS]);
        for (const opacity of cycle) {
          if (cursor > lastStartSeconds) return;
          beams.to(beam, { opacity, duration: 0.10, ease: 'sine.inOut' }, cursor);
          cursor += stepSeconds;
        }
      }
    };
    scheduleBeamShimmer(rightBeam, 0.52, SPACESHIP_RIGHT_BEAM_LEAD_LEVELS);
    scheduleBeamShimmer(leftBeam, 0.80);
    beams.to([leftBeam, rightBeam], { opacity: 0, duration: 0.26, ease: 'power2.in' }, 3.46);

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
    }) => {
      const item = own(gsap.timeline({ paused: true }));
      const motion = getSpaceshipDebrisMotion({ pullOrder });
      const { travelStartAt, travelSeconds, arrivalAt } = motion;
      const intakeMarker = intakeMarkers[pullOrder % intakeMarkers.length];
      const setLeft = gsap.quickSetter(mover, 'left', 'px');
      const setTop = gsap.quickSetter(mover, 'top', 'px');
      const setScale = gsap.quickSetter(mover, 'scale');
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
          setScale(1 - (1 - SPACESHIP_DEBRIS_FINAL_VISIBLE_SCALE) * Math.pow(magneticProgress, 1.18));
          setWobbleX(driftX * wobble);
          setRotation(startRotation * (1 - magneticProgress) + wobbleRotation * wobble);
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
      item.set(mover, { opacity: 0, scale: 0.06 }, arrivalAt + 0.025);
      item.play(0);
    });
    master.call(() => {}, undefined, SCENE_SECONDS);
    master.play(0);
    beams.play(0);
  };

  // Warm the browser cache without making visual duration depend on network or
  // decode latency. The authored master starts now and owns exactly four seconds.
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
  // The scene owns its authored four-second exit. The shared overlay may start
  // its text exit earlier, but it must keep this field alive until completion.
  cleanup.startExit = () => {};
  cleanup.completionDelaySeconds = SCENE_SECONDS;
  return cleanup;
}
