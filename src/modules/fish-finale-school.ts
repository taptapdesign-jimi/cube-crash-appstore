import { gsap } from 'gsap';
import animationManager from './animation-manager.js';

export const FISH_FINALE_SCHOOL_COUNT = 5;
export const FISH_FINALE_BEE_MOTION_DIFFERENCE = 0.70;
export const FISH_FINALE_DURATION_EXTENSION_SECONDS = 0.5;
export const FISH_FINALE_SCHOOL_DURATION_SECONDS = 2.4 + FISH_FINALE_DURATION_EXTENSION_SECONDS;
export const FISH_FINALE_ORIGINAL_START_COUNT = 1;
export const FISH_FINALE_BUBBLY_START_RATIO = 0.80;
export const FISH_FINALE_ARC_WIDTH_MULTIPLIER = 1.35;
export const FISH_FINALE_SPEED_WAVE_MULTIPLIER = 1.45;
export const FISH_FINALE_SIZE_VARIATION_RATIO = 0.40;
export const FISH_FINALE_SCHOOL_SOURCE = './assets/shop/fish/fish.png';
export const FISH_FINALE_MAX_PITCH_DEGREES = 24;
export const FISH_FINALE_DIRECTION_THRESHOLD = 1.4;
export const FISH_FINALE_TURN_POP_SECONDS = 0.10;
export const FISH_FINALE_TURN_OPACITY = 0.74;
export const FISH_FINALE_SWIM_BOB_PX = 4.8;
export const FISH_FINALE_SWIM_WOBBLE_PX = 2.8;
export const FISH_FINALE_SWIM_SCALE_PULSE = 0.055;
export const FISH_FINALE_TURN_SQUASH_RATIO = 0.26;
export const FISH_FINALE_TURN_STRETCH_RATIO = 0.17;

type Point = Readonly<{ x: number; y: number }>;
type RouteSample = Point & { distance: number };

export type FishFinaleSchoolRoute = {
  start: Point;
  points: Point[];
  startRegion: 'merge-origin' | 'bubbly-origin';
  delay: number;
  duration: number;
  size: number;
  speedWave: number;
  swimPhase: number;
};

const ROUTE_TEMPLATES = [
  {
    start: [-0.08, 0.12],
    points: [[-0.22, 0.03], [0.06, -0.10], [-0.28, -0.25], [0.12, -0.44], [-0.67, -1.02]],
    delay: 0,
    duration: 1.96,
    size: 0.20,
    speedWave: 0.27,
  },
  {
    start: [0.09, 0.14],
    points: [[0.24, 0.04], [-0.05, -0.13], [0.29, -0.29], [-0.10, -0.48], [0.68, -1.02]],
    delay: 0.08,
    duration: 1.88,
    size: 0.18,
    speedWave: 0.23,
  },
  {
    start: [-0.03, 0.19],
    points: [[0.14, 0.10], [-0.18, -0.02], [0.17, -0.22], [-0.23, -0.42], [-0.43, -1.05]],
    delay: 0.17,
    duration: 1.82,
    size: 0.16,
    speedWave: 0.31,
  },
  {
    start: [0.06, 0.22],
    points: [[-0.15, 0.12], [0.20, -0.04], [-0.18, -0.25], [0.24, -0.46], [0.48, -1.07]],
    delay: 0.26,
    duration: 1.72,
    size: 0.14,
    speedWave: 0.25,
  },
  {
    start: [0.00, 0.27],
    points: [[-0.13, 0.14], [0.12, 0.01], [-0.09, -0.22], [0.10, -0.48], [0.01, -1.10]],
    delay: 0.34,
    duration: 1.62,
    size: 0.12,
    speedWave: 0.29,
  },
] as const;

const clamp = (value: number, minimum: number, maximum: number): number => (
  Math.min(maximum, Math.max(minimum, value))
);

function catmullRom(points: readonly Point[], progress: number): Point {
  const segmentCount = points.length - 1;
  const scaled = clamp(progress, 0, 0.999999) * segmentCount;
  const index = Math.min(segmentCount - 1, Math.floor(scaled));
  const t = scaled - index;
  const p1 = points[index];
  const p2 = points[index + 1];
  const p0 = index > 0 ? points[index - 1] : {
    x: p1.x * 2 - p2.x,
    y: p1.y * 2 - p2.y,
  };
  const p3 = index + 2 < points.length ? points[index + 2] : {
    x: p2.x * 2 - p1.x,
    y: p2.y * 2 - p1.y,
  };
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t
      + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2
      + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t
      + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2
      + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

function buildArcLengthSamples(points: readonly Point[]): RouteSample[] {
  const samples: RouteSample[] = [];
  let previous = catmullRom(points, 0);
  let distance = 0;
  samples.push({ ...previous, distance });
  for (let index = 1; index <= 240; index += 1) {
    const point = catmullRom(points, index / 240);
    distance += Math.hypot(point.x - previous.x, point.y - previous.y);
    samples.push({ ...point, distance });
    previous = point;
  }
  return samples;
}

function sampleByDistance(samples: readonly RouteSample[], distance: number): Point {
  const bounded = clamp(distance, 0, samples[samples.length - 1].distance);
  let low = 0;
  let high = samples.length - 1;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) * 0.5);
    if (samples[middle].distance < bounded) low = middle;
    else high = middle;
  }
  const from = samples[low];
  const to = samples[high];
  const span = Math.max(0.0001, to.distance - from.distance);
  const mix = (bounded - from.distance) / span;
  return {
    x: from.x + (to.x - from.x) * mix,
    y: from.y + (to.y - from.y) * mix,
  };
}

export function warpFishFinaleProgress(progress: number, waveStrength: number): number {
  const bounded = clamp(progress, 0, 1);
  const strength = clamp(waveStrength, 0, 0.48);
  return clamp(
    bounded
      - strength * Math.sin(Math.PI * 2 * bounded) / (Math.PI * 2)
      + 0.12 * Math.sin(Math.PI * 4 * bounded) / (Math.PI * 4),
    0,
    1,
  );
}

export function resolveFishFinaleFacing(
  currentFacing: -1 | 1,
  velocityX: number,
): { facing: -1 | 1; changed: boolean } {
  if (!Number.isFinite(velocityX) || Math.abs(velocityX) <= FISH_FINALE_DIRECTION_THRESHOLD) {
    return { facing: currentFacing, changed: false };
  }
  const facing: -1 | 1 = velocityX < 0 ? -1 : 1;
  return { facing, changed: facing !== currentFacing };
}

export function createFishFinaleSchoolRoute(
  index: number,
  viewport: { width: number; height: number },
  origin?: { x: number; y: number } | null,
  bubblyOrigin?: { x: number; y: number } | null,
): FishFinaleSchoolRoute {
  const width = Math.max(320, Number(viewport?.width) || 390);
  const height = Math.max(520, Number(viewport?.height) || 844);
  const mergeCenter = {
    x: Number.isFinite(origin?.x) ? clamp(Number(origin?.x), 0, width) : width * 0.5,
    y: Number.isFinite(origin?.y) ? clamp(Number(origin?.y), 0, height) : height * 0.5,
  };
  const routeIndex = Math.abs(Math.trunc(Number(index) || 0)) % ROUTE_TEMPLATES.length;
  const template = ROUTE_TEMPLATES[routeIndex];
  const startRegion = routeIndex < FISH_FINALE_ORIGINAL_START_COUNT
    ? 'merge-origin'
    : 'bubbly-origin';
  const bubblyCenter = {
    x: Number.isFinite(bubblyOrigin?.x) ? clamp(Number(bubblyOrigin?.x), 0, width) : width * 0.5,
    y: Number.isFinite(bubblyOrigin?.y)
      ? clamp(Number(bubblyOrigin?.y), 0, height)
      : height * FISH_FINALE_BUBBLY_START_RATIO,
  };
  const center = startRegion === 'merge-origin' ? mergeCenter : bubblyCenter;
  const toPoint = ([x, y]: readonly [number, number], widenArc = false): Point => ({
    x: center.x + x * width * (widenArc ? FISH_FINALE_ARC_WIDTH_MULTIPLIER : 1),
    y: center.y + y * height,
  });
  return {
    start: toPoint(template.start),
    points: [toPoint(template.start), ...template.points.map((point) => toPoint(point, true))],
    startRegion,
    delay: template.delay,
    duration: template.duration + FISH_FINALE_DURATION_EXTENSION_SECONDS,
    size: Math.round(Math.min(width, height) * template.size),
    speedWave: template.speedWave * FISH_FINALE_SPEED_WAVE_MULTIPLIER,
    swimPhase: routeIndex * 1.37,
  };
}

export function preloadFishFinaleSchool(): void {
  if (typeof Image === 'undefined') return;
  const image = new Image();
  image.src = FISH_FINALE_SCHOOL_SOURCE;
}

export function attachFishFinaleSchool(
  overlay: HTMLElement,
  origin?: { x: number; y: number } | null,
  bubblyOrigin?: { x: number; y: number } | null,
): (() => void) & { completionDelaySeconds?: number } {
  const viewport = {
    width: Math.max(320, window.innerWidth || 390),
    height: Math.max(520, window.innerHeight || 844),
  };
  const field = document.createElement('div');
  field.className = 'cc-fish-finale-school';
  field.dataset.fishFinaleSchool = 'active';
  field.style.cssText = [
    'position:absolute',
    'inset:0',
    'overflow:hidden',
    'pointer-events:none',
    'z-index:2',
    'contain:layout style paint',
  ].join(';');
  overlay.appendChild(field);

  const runtimes = Array.from({ length: FISH_FINALE_SCHOOL_COUNT }, (_, index) => {
    const route = createFishFinaleSchoolRoute(index, viewport, origin, bubblyOrigin);
    const image = document.createElement('img');
    image.src = FISH_FINALE_SCHOOL_SOURCE;
    image.alt = '';
    image.draggable = false;
    image.className = 'cc-fish-finale-swimmer';
    image.dataset.fishSchoolIndex = String(index);
    image.dataset.directionalFish = 'true';
    image.dataset.fishStartRegion = route.startRegion;
    image.setAttribute('aria-hidden', 'true');
    image.style.cssText = [
      'position:absolute',
      'left:0',
      'top:0',
      `width:${route.size}px`,
      `height:${route.size}px`,
      'display:block',
      'object-fit:contain',
      'pointer-events:none',
      'will-change:transform,opacity',
      'transform-origin:50% 50%',
      'backface-visibility:hidden',
    ].join(';');
    field.appendChild(image);
    const samples = buildArcLengthSamples(route.points);
    const initial = samples[Math.min(2, samples.length - 1)];
    const initialFacing: -1 | 1 = initial.x < route.start.x ? -1 : 1;
    image.dataset.fishFacing = initialFacing === 1 ? 'right' : 'left';
    image.dataset.fishPitch = '0.00';
    gsap.set(image, {
      xPercent: -50,
      yPercent: -50,
      x: route.start.x,
      y: route.start.y,
      opacity: 0,
      scaleX: initialFacing * 0.84,
      scaleY: 0.84,
      rotation: 0,
      force3D: true,
    });
    return {
      route,
      image,
      samples,
      totalDistance: samples[samples.length - 1].distance,
      facing: initialFacing,
      turnPopRemaining: 0,
      rotation: 0,
      previousClock: 0,
      xSetter: gsap.quickSetter(image, 'x', 'px') as (value: number) => void,
      ySetter: gsap.quickSetter(image, 'y', 'px') as (value: number) => void,
      opacitySetter: gsap.quickSetter(image, 'opacity') as (value: number) => void,
      scaleXSetter: gsap.quickSetter(image, 'scaleX') as (value: number) => void,
      scaleYSetter: gsap.quickSetter(image, 'scaleY') as (value: number) => void,
      rotationSetter: gsap.quickSetter(image, 'rotation', 'deg') as (value: number) => void,
    };
  });

  const clock = { seconds: 0 };
  const timeline = animationManager.trackExternalTimeline(gsap.timeline({ paused: true }));
  timeline.to(clock, {
    seconds: FISH_FINALE_SCHOOL_DURATION_SECONDS,
    duration: FISH_FINALE_SCHOOL_DURATION_SECONDS,
    ease: 'none',
    onUpdate: () => {
      runtimes.forEach((runtime) => {
        const elapsed = clock.seconds - runtime.route.delay;
        if (elapsed < 0 || elapsed > runtime.route.duration) {
          runtime.opacitySetter(0);
          return;
        }
        const deltaSeconds = clamp(clock.seconds - runtime.previousClock, 0, 1 / 20);
        runtime.previousClock = clock.seconds;
        const progress = clamp(elapsed / runtime.route.duration, 0, 1);
        const warped = warpFishFinaleProgress(progress, runtime.route.speedWave);
        const sampleGap = 0.006;
        const previousWarped = warpFishFinaleProgress(progress - sampleGap, runtime.route.speedWave);
        const nextWarped = warpFishFinaleProgress(progress + sampleGap, runtime.route.speedWave);
        const localSpeed = clamp((nextWarped - previousWarped) / (sampleGap * 2), 0.4, 1.7);
        const accelerationStretch = clamp((localSpeed - 1) * 0.12, -0.055, 0.095);
        const distance = runtime.totalDistance * warped;
        const point = sampleByDistance(runtime.samples, distance);
        const lookAhead = Math.max(5, runtime.totalDistance * 0.008);
        const tangentStart = sampleByDistance(runtime.samples, distance - lookAhead);
        const tangentEnd = sampleByDistance(runtime.samples, distance + lookAhead);
        const velocityX = tangentEnd.x - tangentStart.x;
        const velocityY = tangentEnd.y - tangentStart.y;
        const direction = resolveFishFinaleFacing(runtime.facing, velocityX);
        if (direction.changed) {
          runtime.facing = direction.facing;
          runtime.turnPopRemaining = FISH_FINALE_TURN_POP_SECONDS;
        }
        runtime.turnPopRemaining = Math.max(0, runtime.turnPopRemaining - deltaSeconds);

        const heading = Math.atan2(velocityY, velocityX) * (180 / Math.PI);
        const relativeHeading = runtime.facing === 1
          ? heading
          : heading >= 0 ? heading - 180 : heading + 180;
        const targetPitch = clamp(relativeHeading, -FISH_FINALE_MAX_PITCH_DEGREES, FISH_FINALE_MAX_PITCH_DEGREES);
        const pitchBlend = 1 - Math.exp(-10 * deltaSeconds);
        runtime.rotation += (targetPitch - runtime.rotation) * pitchBlend;

        const swim = Math.sin(warped * Math.PI * 14 + runtime.route.swimPhase);
        const wobble = Math.cos(warped * Math.PI * 10 + runtime.route.swimPhase * 0.8);
        const speedPulse = Math.cos(warped * Math.PI * 5 + runtime.route.swimPhase)
          * FISH_FINALE_SWIM_SCALE_PULSE;
        const depthBounce = Math.sin(progress * Math.PI) * 0.055;
        const turnPop = runtime.turnPopRemaining / FISH_FINALE_TURN_POP_SECONDS;
        const turnSquashX = 1 - turnPop * FISH_FINALE_TURN_SQUASH_RATIO;
        const turnStretchY = 1 + turnPop * FISH_FINALE_TURN_STRETCH_RATIO;
        const turnOpacity = 1 - turnPop * (1 - FISH_FINALE_TURN_OPACITY);
        const enterScale = 0.84 + Math.min(1, progress / 0.10) * 0.16;
        const opacity = Math.min(1, progress / 0.055, (1 - progress) / 0.025);
        runtime.xSetter(point.x + wobble * FISH_FINALE_SWIM_WOBBLE_PX);
        runtime.ySetter(point.y + swim * FISH_FINALE_SWIM_BOB_PX);
        runtime.opacitySetter(clamp(opacity * turnOpacity, 0, 1));
        runtime.rotationSetter(clamp(
          runtime.rotation + swim * 2.2,
          -FISH_FINALE_MAX_PITCH_DEGREES,
          FISH_FINALE_MAX_PITCH_DEGREES,
        ));
        runtime.scaleXSetter(
          runtime.facing
            * enterScale
            * (1 + depthBounce + speedPulse + accelerationStretch)
            * turnSquashX,
        );
        runtime.scaleYSetter(
          enterScale
            * (1 + depthBounce - speedPulse * 0.82 - accelerationStretch * 0.68)
            * turnStretchY,
        );
        runtime.image.dataset.fishFacing = runtime.facing === 1 ? 'right' : 'left';
        runtime.image.dataset.fishPitch = runtime.rotation.toFixed(2);
        runtime.image.dataset.fishTurning = turnPop > 0 ? 'true' : 'false';
      });
    },
    onComplete: () => {
      runtimes.forEach((runtime) => runtime.opacitySetter(0));
    },
  });
  timeline.play(0);

  let disposed = false;
  const cleanup = (() => {
    if (disposed) return;
    disposed = true;
    animationManager.killExternalTimeline(timeline);
    runtimes.forEach(({ image }) => {
      try { gsap.killTweensOf(image); } catch {}
      image.remove();
    });
    field.remove();
  }) as (() => void) & { completionDelaySeconds?: number };
  cleanup.completionDelaySeconds = FISH_FINALE_SCHOOL_DURATION_SECONDS;
  return cleanup;
}
