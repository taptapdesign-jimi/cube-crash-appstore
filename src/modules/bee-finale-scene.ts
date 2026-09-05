import { gsap } from 'gsap';
import animationManager from './animation-manager.js';

const PACK = './assets/shop/bee';
const use2x = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const source = (name: string) => `${PACK}/${name}${use2x ? '@2x' : ''}.png`;
const journeyBeeSource = (name: string) => `./assets/shop/honey/${name}${use2x ? '@2x' : ''}.png`;
const trackTimeline = (options: gsap.TimelineVars = {}) => (
  animationManager.trackExternalTimeline(gsap.timeline(options))
);

const SOURCES = [
  ...Array.from({ length: 4 }, (_, index) => source(`bee${index + 1}`)),
  ...Array.from({ length: 6 }, (_, index) => source(`leaf${index + 1}`)),
  journeyBeeSource('bee1'),
  journeyBeeSource('bee3'),
];
let preloadPromise: Promise<void> | null = null;

export function preloadBeeFinaleAssets(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  if (typeof Image === 'undefined') return Promise.resolve();
  preloadPromise = Promise.all(SOURCES.map((src) => new Promise<void>((resolve) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = src;
  }))).then(() => undefined);
  return preloadPromise;
}

export const BEE_FINALE_SCENE_SECONDS = 4;
export const BEE_FINALE_FLIGHT_SECONDS = 3;
export const BEE_FINALE_ORBIT_END_SECONDS = 0.9;
export const BEE_FINALE_RIGHT_FEINT_END_SECONDS = 1.8;
export const BEE_FINALE_LEFT_CHARGE_END_SECONDS = 2.65;
export const BEE_FINALE_FLYBY_START_SECONDS = BEE_FINALE_LEFT_CHARGE_END_SECONDS;
export const BEE_FINALE_IDLE_FRAME_SECONDS = 1 / 960;
export const BEE_FINALE_IDLE_CROSSFADE_RATIO = 0.38;
export const BEE_FINALE_CURVE_VIEWPORT_RATIO = 0.38;
export const BEE_FINALE_WEAVE_VIEWPORT_RATIO = 0.30;
export const BEE_FINALE_EXIT_RELEASE_PROGRESS = 0.90;
export const BEE_FINALE_VISIBLE_ART_RADIUS_RATIO = 0.128;
export const BEE_FINALE_LEAF_COUNT = 42;
export const BEE_FINALE_LEAF_START_SECONDS = 0;
export const BEE_FINALE_LEAF_END_SECONDS = 2.90;
export const BEE_FINALE_LAST_LEAF_END_SECONDS = 3.86;
const BEE_FINALE_LEAVES_PER_BURST = 3;
const BEE_FINALE_MERGE_BURST_LEAVES = 12;
export const BEE_FINALE_LEAF_STAGGER_SECONDS = (
  BEE_FINALE_LEAF_END_SECONDS - BEE_FINALE_LEAF_START_SECONDS
) / (BEE_FINALE_LEAF_COUNT / BEE_FINALE_LEAVES_PER_BURST - 1);

export type BeeFinaleOrigin = { x: number; y: number };
export type BeeFinaleViewport = { width: number; height: number };
export type BeeFinalePhase = 'orbit' | 'right-feint' | 'left-charge' | 'flyby';
export type BeeFinalePose = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  scale: number;
  facing: -1 | 1;
  phase: BeeFinalePhase;
};
export type BeeFinaleRoutePlan = {
  progress: number[];
  lateral: number[];
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const sineInOut = (progress: number) => 0.5 - Math.cos(Math.PI * clamp(progress, 0, 1)) * 0.5;

export function getBeeFinaleForwardProgress(rawProgress: number): number {
  const progress = clamp(rawProgress, 0, 1);
  const previousFlight = progress ** 1.5;
  const finishRamp = clamp((progress - 0.55) / 0.45, 0, 1);
  const finishBlend = finishRamp * finishRamp * (3 - 2 * finishRamp);
  // Keep the established launch, then blend into p^3. Its endpoint velocity is
  // exactly twice the previous p^1.5 flight without adding a timing seam.
  return previousFlight + (progress ** 3 - previousFlight) * finishBlend;
}
export function resolveBeeFinaleOrigin(
  origin: BeeFinaleOrigin | null | undefined,
  viewport: BeeFinaleViewport,
): BeeFinaleOrigin {
  const fallback = { x: viewport.width * 0.5, y: viewport.height * 0.54 };
  if (!origin || !Number.isFinite(origin.x) || !Number.isFinite(origin.y)) return fallback;
  return {
    x: clamp(origin.x, 56, viewport.width - 56),
    y: clamp(origin.y, 120, viewport.height - 120),
  };
}

export function resolveBeeFinaleExit(
  origin: BeeFinaleOrigin,
  viewport: BeeFinaleViewport,
  routeSeed = 0,
): BeeFinaleOrigin {
  const horizontalOffset = origin.x - viewport.width * 0.5;
  const verticalOffset = origin.y - viewport.height * 0.5;
  const horizontalDirection = Math.abs(horizontalOffset) > viewport.width * 0.12
    ? (horizontalOffset > 0 ? -1 : 1)
    : (Math.cos(routeSeed) >= 0 ? 1 : -1);
  const verticalDirection = Math.abs(verticalOffset) > viewport.height * 0.12
    ? (verticalOffset > 0 ? -1 : 1)
    : (Math.sin(routeSeed) >= 0 ? -1 : 1);
  return {
    x: horizontalDirection > 0 ? viewport.width * 1.20 : -viewport.width * 0.20,
    y: verticalDirection > 0 ? viewport.height * 1.20 : -viewport.height * 0.20,
  };
}

export function createBeeFinaleRoutePlan(
  origin: BeeFinaleOrigin,
  viewport: BeeFinaleViewport,
  routeSeed: number,
): BeeFinaleRoutePlan {
  const seed = Number.isFinite(routeSeed) ? routeSeed : 0;
  const exit = resolveBeeFinaleExit(origin, viewport, seed);
  const distance = Math.max(1, Math.hypot(exit.x - origin.x, exit.y - origin.y));
  const normalX = -(exit.y - origin.y) / distance;
  const outwardX = origin.x < viewport.width * 0.5
    ? -1
    : origin.x > viewport.width * 0.5 ? 1 : (Math.cos(seed) >= 0 ? -1 : 1);
  const introDirection = Math.sign(normalX || 1) === outwardX ? 1 : -1;
  const templates = [
    [0, 0.34, -0.46, -0.12, -0.52, 0.25, 0.14, 0],
    [0, 0.29, 0.51, -0.20, -0.43, 0.18, -0.30, 0],
    [0, 0.42, -0.16, -0.49, 0.12, 0.38, -0.15, 0],
    [0, 0.31, -0.40, 0.11, 0.48, 0.26, -0.34, 0],
  ];
  const routeNoise = Math.abs(Math.sin(seed * 1.913 + origin.x * 0.017 + origin.y * 0.011));
  const template = templates[Math.min(templates.length - 1, Math.floor(routeNoise * templates.length))];
  const baseProgress = [0, 0.075, 0.23, 0.405, 0.565, 0.755, 0.905, 1];
  const progress = baseProgress.map((value, index) => {
    if (index === 0 || index === baseProgress.length - 1) return value;
    return value + Math.sin(seed * 2.17 + origin.x * 0.009 + index * 2.31) * 0.022;
  });
  const lateral = template.map((value, index) => {
    if (index === 0 || index === template.length - 1) return 0;
    const variation = 0.88 + 0.18 * Math.abs(Math.sin(seed * 1.37 + origin.y * 0.006 + index * 1.79));
    return value * introDirection * variation;
  });
  return { progress, lateral };
}

function basePosition(
  elapsedSeconds: number,
  origin: BeeFinaleOrigin,
  viewport: BeeFinaleViewport,
  routeSeed: number,
): { x: number; y: number; phase: BeeFinalePhase } {
  const time = clamp(elapsedSeconds, 0, BEE_FINALE_SCENE_SECONDS);
  const rawProgress = clamp(time / BEE_FINALE_FLIGHT_SECONDS, 0, 1);
  const acceleratedProgress = getBeeFinaleForwardProgress(rawProgress);
  const exit = resolveBeeFinaleExit(origin, viewport, routeSeed);
  const deltaX = exit.x - origin.x;
  const deltaY = exit.y - origin.y;
  const distance = Math.max(1, Math.hypot(deltaX, deltaY));
  const curve = Math.min(viewport.width, viewport.height) * BEE_FINALE_CURVE_VIEWPORT_RATIO;
  const controlX = (origin.x + exit.x) * 0.5 - (deltaY / distance) * curve;
  const controlY = (origin.y + exit.y) * 0.5 + (deltaX / distance) * curve;
  const oneMinusProgress = 1 - acceleratedProgress;
  const x = oneMinusProgress * oneMinusProgress * origin.x
    + 2 * oneMinusProgress * acceleratedProgress * controlX
    + acceleratedProgress * acceleratedProgress * exit.x;
  const y = oneMinusProgress * oneMinusProgress * origin.y
    + 2 * oneMinusProgress * acceleratedProgress * controlY
    + acceleratedProgress * acceleratedProgress * exit.y;
  const hoverBuzz = Math.sin(rawProgress * Math.PI * 18) * Math.sin(rawProgress * Math.PI) * 5;
  const phase: BeeFinalePhase = time <= BEE_FINALE_ORBIT_END_SECONDS
    ? 'orbit'
    : time <= BEE_FINALE_RIGHT_FEINT_END_SECONDS
      ? 'right-feint'
      : time <= BEE_FINALE_LEFT_CHARGE_END_SECONDS
        ? 'left-charge'
        : 'flyby';
  return {
    x,
    y: y + hoverBuzz,
    phase,
  };

}

function visiblePosition(
  elapsedSeconds: number,
  origin: BeeFinaleOrigin,
  viewport: BeeFinaleViewport,
  wobblePhase: number,
  suppliedRoutePlan?: BeeFinaleRoutePlan,
): { x: number; y: number; phase: BeeFinalePhase } {
  const time = clamp(elapsedSeconds, 0, BEE_FINALE_SCENE_SECONDS);
  const base = basePosition(time, origin, viewport, wobblePhase);
  const rawProgress = clamp(time / BEE_FINALE_FLIGHT_SECONDS, 0, 1);
  const exit = resolveBeeFinaleExit(origin, viewport, wobblePhase);
  const deltaX = exit.x - origin.x;
  const deltaY = exit.y - origin.y;
  const distance = Math.max(1, Math.hypot(deltaX, deltaY));
  const normalX = -deltaY / distance;
  const normalY = deltaX / distance;
  // A seeded asymmetric play route replaces the old equal-time alternating
  // zig-zag. Uneven knots and same-side runs create feints, wide sweeps and
  // short calming beats while the base curve continues toward the exit.
  const routePlan = suppliedRoutePlan ?? createBeeFinaleRoutePlan(origin, viewport, wobblePhase);
  let waypointIndex = routePlan.progress.length - 2;
  for (let index = 0; index < routePlan.progress.length - 1; index += 1) {
    if (rawProgress <= routePlan.progress[index + 1]) {
      waypointIndex = index;
      break;
    }
  }
  const segmentStart = routePlan.progress[waypointIndex];
  const segmentEnd = routePlan.progress[waypointIndex + 1];
  const localProgress = clamp((rawProgress - segmentStart) / Math.max(0.001, segmentEnd - segmentStart), 0, 1);
  const smoothLocal = localProgress * localProgress * (3 - 2 * localProgress);
  const weaveMagnitude = routePlan.lateral[waypointIndex]
    + (routePlan.lateral[waypointIndex + 1] - routePlan.lateral[waypointIndex]) * smoothLocal;
  const weave = Math.min(viewport.width, viewport.height)
    * BEE_FINALE_WEAVE_VIEWPORT_RATIO
    * weaveMagnitude;
  const rawX = base.x + normalX * weave;
  const rawY = base.y + normalY * weave;
  if (rawProgress >= 1) return { x: rawX, y: rawY, phase: base.phase };
  // Keep the complete hero inside the viewport while it plays. Only the final
  // 10% of the flight smoothly releases the clamp toward the real offscreen
  // exit, avoiding both early clipping and a last-frame positional snap.
  // The 128px source has transparent horizontal padding; constrain the visible
  // Bee artwork rather than the empty square canvas around it.
  const heroRadius = Math.min(viewport.width * BEE_FINALE_VISIBLE_ART_RADIUS_RATIO, 56) + 3;
  const safeX = clamp(rawX, heroRadius, viewport.width - heroRadius);
  const safeY = clamp(rawY, heroRadius, viewport.height - heroRadius);
  const releaseProgress = clamp(
    (rawProgress - BEE_FINALE_EXIT_RELEASE_PROGRESS) / (1 - BEE_FINALE_EXIT_RELEASE_PROGRESS),
    0,
    1,
  );
  const releaseBlend = releaseProgress * releaseProgress * (3 - 2 * releaseProgress);
  return {
    x: safeX + (rawX - safeX) * releaseBlend,
    y: safeY + (rawY - safeY) * releaseBlend,
    phase: base.phase,
  };
}

export function sampleBeeFinalePose(
  elapsedSeconds: number,
  origin: BeeFinaleOrigin,
  viewport: BeeFinaleViewport,
  wobblePhase = 0,
  routePlan?: BeeFinaleRoutePlan,
): BeeFinalePose {
  const time = clamp(elapsedSeconds, 0, BEE_FINALE_SCENE_SECONDS);
  const delta = 0.004;
  const current = visiblePosition(time, origin, viewport, wobblePhase, routePlan);
  const before = visiblePosition(Math.max(0, time - delta), origin, viewport, wobblePhase, routePlan);
  const after = visiblePosition(Math.min(BEE_FINALE_SCENE_SECONDS, time + delta), origin, viewport, wobblePhase, routePlan);
  const vx = after.x - before.x;
  const vy = after.y - before.y;
  // The head follows each real lateral turn. Paint owns a 50ms stability gate,
  // so direction changes read as intentional turns rather than sprite chatter.
  const facing: -1 | 1 = vx < -0.01 ? -1 : 1;
  const heading = Math.atan2(vy, vx) * (180 / Math.PI);
  const relativeHeading = facing === 1
    ? heading
    : heading >= 0 ? heading - 180 : heading + 180;
  const bounce = Math.sin(time * Math.PI * 7 + wobblePhase);
  return {
    x: current.x,
    y: current.y,
    vx,
    vy,
    facing,
    rotation: clamp(
      relativeHeading * 0.55 + Math.sin(time * Math.PI * 3.5 + wobblePhase) * 4 + bounce,
      -20,
      20,
    ),
    scale: 0.86 + Math.sin(time * Math.PI * 6 + wobblePhase) * 0.055,
    phase: current.phase,
  };
}

export function getBeeFinaleIdleBlend(elapsedSeconds: number): [number, number, number, number] {
  const frameProgress = Math.max(0, elapsedSeconds) / BEE_FINALE_IDLE_FRAME_SECONDS;
  const currentIndex = Math.floor(frameProgress) % 4;
  const nextIndex = (currentIndex + 1) % 4;
  const local = frameProgress - Math.floor(frameProgress);
  const crossfadeStart = 1 - BEE_FINALE_IDLE_CROSSFADE_RATIO;
  const mix = local <= crossfadeStart ? 0 : sineInOut((local - crossfadeStart) / BEE_FINALE_IDLE_CROSSFADE_RATIO);
  const blend: [number, number, number, number] = [0, 0, 0, 0];
  blend[currentIndex] = 1 - mix;
  blend[nextIndex] += mix;
  return blend;
}

export type BeeFinaleCleanup = (() => void) & {
  startExit?: () => void;
  completionDelaySeconds?: number;
};

type BeeLeafParticle = {
  wrap: HTMLElement;
  image: HTMLImageElement;
  birth: number;
  lifetime: number;
  birthX: number;
  birthY: number;
  velocityX: number;
  velocityY: number;
  gravity: number;
  flutter: number;
  spin: number;
  scale: number;
  peakOpacity: number;
};

type BeeAmbientPlan = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  wave: number;
  frequency: number;
  phase: number;
  scale: number;
};

type JourneyBeeAsset = 'bee1' | 'bee2' | 'bee3' | 'bee4' | 'bee5' | 'bee6' | 'bee7';

export function getBeeFinaleHorizontalAssetForVelocity(
  velocityX: number,
  fallback: JourneyBeeAsset = 'bee1',
): JourneyBeeAsset {
  if (!Number.isFinite(velocityX) || Math.abs(velocityX) < 0.01) return fallback;
  return velocityX < 0 ? 'bee3' : 'bee1';
}

type BeeAmbientState = {
  host: HTMLElement;
  frames: HTMLImageElement[];
  plan: BeeAmbientPlan;
  currentAsset: JourneyBeeAsset;
  previousAsset: JourneyBeeAsset | null;
  pendingAsset: JourneyBeeAsset | null;
  pendingSeconds: number;
  blendSeconds: number;
};

const BEE_AMBIENT_PLANS: readonly BeeAmbientPlan[] = [
  { startX: -0.12, startY: 0.20, endX: 1.12, endY: 0.34, wave: 38, frequency: 2.1, phase: 0.2, scale: 0.78 },
  { startX: 1.10, startY: 0.28, endX: -0.12, endY: 0.46, wave: 31, frequency: 2.6, phase: 1.4, scale: 0.64 },
  { startX: -0.14, startY: 0.58, endX: 1.14, endY: 0.67, wave: 44, frequency: 2.3, phase: 2.5, scale: 0.90 },
  { startX: 1.12, startY: 0.72, endX: -0.10, endY: 0.61, wave: 35, frequency: 2.8, phase: 3.2, scale: 0.70 },
  { startX: 0.08, startY: 0.88, endX: 0.88, endY: 0.12, wave: 28, frequency: 2.4, phase: 4.1, scale: 0.82 },
  { startX: 0.92, startY: 0.10, endX: 0.18, endY: 0.86, wave: 33, frequency: 2.7, phase: 5.0, scale: 0.60 },
];

function sampleAmbientBee(
  plan: BeeAmbientPlan,
  elapsedSeconds: number,
  origin: BeeFinaleOrigin,
  viewport: BeeFinaleViewport,
): { x: number; y: number; vx: number; vy: number } {
  const position = (time: number) => {
    const progress = sineInOut(clamp(time / BEE_FINALE_SCENE_SECONDS, 0, 1));
    const routeX = (plan.startX + (plan.endX - plan.startX) * progress) * viewport.width;
    const routeY = (plan.startY + (plan.endY - plan.startY) * progress) * viewport.height
      + Math.sin(progress * Math.PI * plan.frequency + plan.phase) * plan.wave * Math.sin(progress * Math.PI);
    const launchBlend = sineInOut(clamp(time / 0.55, 0, 1));
    return {
      x: origin.x + (routeX - origin.x) * launchBlend,
      y: origin.y + (routeY - origin.y) * launchBlend,
    };
  };
  const delta = 0.004;
  const current = position(elapsedSeconds);
  const before = position(Math.max(0, elapsedSeconds - delta));
  const after = position(Math.min(BEE_FINALE_SCENE_SECONDS, elapsedSeconds + delta));
  return { ...current, vx: after.x - before.x, vy: after.y - before.y };
}

function makeImage(src: string, className: string, parent: HTMLElement): HTMLImageElement {
  const image = document.createElement('img');
  image.src = src;
  image.dataset.src2x = src.includes('@2x') ? src : src.replace(/\.png$/, '@2x.png');
  image.alt = '';
  image.className = className;
  image.draggable = false;
  image.style.cssText = 'pointer-events:none;user-select:none;content-visibility:visible;display:block';
  parent.appendChild(image);
  return image;
}

export function attachBeeFinaleScene(
  overlay: HTMLElement,
  zIndex = 1,
  requestedOrigin?: BeeFinaleOrigin | null,
): BeeFinaleCleanup {
  if (!overlay) return (() => {}) as BeeFinaleCleanup;
  void preloadBeeFinaleAssets();

  const viewport = {
    width: Math.max(window.innerWidth || 390, 1),
    height: Math.max(window.innerHeight || 844, 1),
  };
  const origin = resolveBeeFinaleOrigin(requestedOrigin, viewport);
  const field = document.createElement('div');
  field.className = 'cc-bee-finale-scene';
  field.dataset.originX = origin.x.toFixed(2);
  field.dataset.originY = origin.y.toFixed(2);
  field.dataset.leafEngine = 'frame-synced-v1';
  field.dataset.visibleLeafCount = '0';
  field.style.cssText = `position:absolute;inset:0;overflow:visible;pointer-events:none;z-index:${zIndex};visibility:visible`;
  overlay.appendChild(field);

  const leafBack = document.createElement('div');
  leafBack.className = 'cc-bee-finale-leaves-back';
  leafBack.style.cssText = 'position:absolute;inset:0;z-index:1;pointer-events:none';
  field.appendChild(leafBack);
  const hero = document.createElement('div');
  hero.className = 'cc-bee-finale-hero';
  hero.style.cssText = 'position:absolute;left:0;top:0;width:min(32.2vw,141.4px);aspect-ratio:1;z-index:2;pointer-events:none;will-change:transform,opacity;transform-origin:60% 52%';
  field.appendChild(hero);
  const orbitFrames = Array.from({ length: 4 }, (_, index) => {
    const image = makeImage(source(`bee${index + 1}`), `cc-bee-finale-orbit-frame cc-bee-finale-bee-${index + 1}`, hero);
    image.style.cssText += `;position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:${index === 0 ? 1 : 0};will-change:opacity`;
    return image;
  });
  const leafFront = document.createElement('div');
  leafFront.className = 'cc-bee-finale-leaves-front';
  leafFront.style.cssText = 'position:absolute;inset:0;z-index:1;pointer-events:none';
  field.appendChild(leafFront);

  const ambientBeeLayer = document.createElement('div');
  ambientBeeLayer.className = 'cc-bee-finale-journey-bees';
  ambientBeeLayer.style.cssText = 'position:absolute;inset:0;z-index:4;pointer-events:none;overflow:visible';
  field.appendChild(ambientBeeLayer);
  const ambientBees: BeeAmbientState[] = BEE_AMBIENT_PLANS.map((plan, beeIndex) => {
    const host = document.createElement('div');
    host.className = `cc-bee-finale-journey-bee cc-bee-finale-journey-bee-${beeIndex + 1}`;
    host.style.cssText = `position:absolute;left:0;top:0;width:${42 * plan.scale}px;height:${42 * plan.scale}px;pointer-events:none;will-change:transform`;
    ambientBeeLayer.appendChild(host);
    const frames = (['bee1', 'bee3'] as const).map((asset, frameIndex) => {
      const image = makeImage(journeyBeeSource(asset), `cc-bee-finale-journey-frame cc-bee-finale-journey-frame-${asset}`, host);
      image.style.cssText += `;position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:${frameIndex === 0 ? 1 : 0};will-change:opacity`;
      return image;
    });
    return {
      host,
      frames,
      plan,
      currentAsset: 'bee1',
      previousAsset: null,
      pendingAsset: null,
      pendingSeconds: 0,
      blendSeconds: 0.08,
    };
  });

  const master = trackTimeline({ paused: true });
  const leafParticles: BeeLeafParticle[] = [];
  const clock = { time: 0 };
  const wobblePhase = Math.random() * Math.PI * 2;
  const routePlan = createBeeFinaleRoutePlan(origin, viewport, wobblePhase);
  let facing: -1 | 1 = 1;
  let candidateFacing: -1 | 1 = 1;
  let candidateSince = 0;
  let priorTime = 0;
  const paint = () => {
    const pose = sampleBeeFinalePose(clock.time, origin, viewport, wobblePhase, routePlan);
    const delta = Math.max(0, clock.time - priorTime);
    priorTime = clock.time;
    if (pose.facing !== facing) {
      if (pose.facing !== candidateFacing) {
        candidateFacing = pose.facing;
        candidateSince = 0;
      } else {
        candidateSince += delta;
        if (candidateSince >= 0.05) facing = candidateFacing;
      }
    } else {
      candidateFacing = facing;
      candidateSince = 0;
    }
    const idleBlend = getBeeFinaleIdleBlend(clock.time);
    orbitFrames.forEach((frame, index) => { frame.style.opacity = idleBlend[index].toFixed(4); });
    hero.dataset.phase = pose.phase;
    hero.dataset.facing = String(facing);
    hero.style.opacity = '1';
    hero.style.transform = `translate3d(${pose.x.toFixed(2)}px,${pose.y.toFixed(2)}px,0) translate3d(-50%,-50%,0) rotate(${pose.rotation.toFixed(2)}deg) scale(${(pose.scale * facing).toFixed(4)},${pose.scale.toFixed(4)})`;
    ambientBees.forEach((bee) => {
      const sample = sampleAmbientBee(bee.plan, clock.time, origin, viewport);
      const candidate = getBeeFinaleHorizontalAssetForVelocity(sample.vx, bee.currentAsset);
      if (candidate === bee.currentAsset) {
        bee.pendingAsset = null;
        bee.pendingSeconds = 0;
      } else if (candidate !== bee.pendingAsset) {
        bee.pendingAsset = candidate;
        bee.pendingSeconds = 0;
      } else {
        bee.pendingSeconds += delta;
        if (bee.pendingSeconds >= 0.05) {
          bee.previousAsset = bee.currentAsset;
          bee.currentAsset = candidate;
          bee.pendingAsset = null;
          bee.pendingSeconds = 0;
          bee.blendSeconds = 0;
        }
      }
      bee.blendSeconds = Math.min(0.08, bee.blendSeconds + delta);
      const blend = clamp(bee.blendSeconds / 0.08, 0, 1);
      bee.frames.forEach((frame, frameIndex) => {
        const asset: JourneyBeeAsset = frameIndex === 0 ? 'bee1' : 'bee3';
        const opacity = asset === bee.currentAsset
          ? blend
          : asset === bee.previousAsset
            ? 1 - blend
            : 0;
        frame.style.opacity = opacity.toFixed(4);
      });
      if (blend >= 1) bee.previousAsset = null;
      const bounce = Math.sin(clock.time * Math.PI * 5 + bee.plan.phase);
      const rotation = Math.sin(clock.time * Math.PI * 3.5 + bee.plan.phase) * 7;
      bee.host.dataset.asset = bee.currentAsset;
      bee.host.style.transform = `translate3d(${sample.x.toFixed(2)}px,${sample.y.toFixed(2)}px,0) translate3d(-50%,-50%,0) rotate(${rotation.toFixed(2)}deg) scale(${(1 + bounce * 0.045).toFixed(3)},${(1 - bounce * 0.035).toFixed(3)})`;
    });
    let visibleLeafCount = 0;
    leafParticles.forEach((particle) => {
      const age = clock.time - particle.birth;
      if (age < 0 || age > particle.lifetime) {
        particle.wrap.style.opacity = '0';
        particle.wrap.style.visibility = 'hidden';
        return;
      }
      const progress = clamp(age / particle.lifetime, 0, 1);
      const enter = clamp(age / 0.07, 0, 1);
      const exit = progress > 0.72 ? clamp((1 - progress) / 0.28, 0, 1) : 1;
      const wildX = Math.sin(age * 8.5 + particle.flutter) * (18 + 28 * progress);
      const wildY = Math.cos(age * 10.5 + particle.flutter) * (14 + 19 * progress);
      const x = particle.birthX + particle.velocityX * age + wildX;
      const y = particle.birthY + particle.velocityY * age + particle.gravity * age * age * 0.5 + wildY;
      const scale = particle.scale * (0.45 + enter * 0.7) * (1 - progress * 0.18);
      const rotation = particle.spin * age + Math.sin(age * 11 + particle.flutter) * 16;
      particle.wrap.style.visibility = 'visible';
      visibleLeafCount += 1;
      particle.wrap.style.opacity = (particle.peakOpacity * enter * exit).toFixed(3);
      particle.wrap.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) translate3d(-50%,-50%,0) rotate(${rotation.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      particle.image.style.transform = `skewX(${(Math.sin(age * 13 + particle.flutter) * 9).toFixed(2)}deg) scale(${(0.96 + Math.sin(age * 12 + particle.flutter) * 0.07).toFixed(3)},${(1.01 - Math.sin(age * 12 + particle.flutter) * 0.06).toFixed(3)})`;
    });
    field.dataset.visibleLeafCount = String(visibleLeafCount);
  };
  paint();
  master.to(clock, { time: 4, duration: 4, ease: 'none', onUpdate: paint }, 0);

  for (let index = 0; index < BEE_FINALE_LEAF_COUNT; index += 1) {
    const burstIndex = Math.floor(index / BEE_FINALE_LEAVES_PER_BURST);
    const burstLane = index % BEE_FINALE_LEAVES_PER_BURST;
    const isMergeBurst = index < BEE_FINALE_MERGE_BURST_LEAVES;
    const startAt = isMergeBurst
      ? burstLane * 0.018 + Math.floor(index / BEE_FINALE_LEAVES_PER_BURST) * 0.028
      : BEE_FINALE_LEAF_START_SECONDS
        + burstIndex * BEE_FINALE_LEAF_STAGGER_SECONDS
        + burstLane * 0.018;
    const pose = sampleBeeFinalePose(startAt, origin, viewport, wobblePhase, routePlan);
    const isFront = index % 3 !== 0;
    const wrap = document.createElement('div');
    wrap.className = `cc-bee-finale-leaf-wrap cc-bee-finale-leaf-wrap-${isFront ? 'front' : 'back'}`;
    (isFront ? leafFront : leafBack).appendChild(wrap);
    const leaf = makeImage(source(`leaf${index % 6 + 1}`), `cc-bee-finale-leaf cc-bee-finale-leaf-${isFront ? 'front' : 'back'}`, wrap);
    const randomUnit = (Math.sin((index + 1) * 91.731 + wobblePhase * 13.17) + 1) * 0.5;
    const angle = (index * 2.399963229728653 + randomUnit * 0.9) % (Math.PI * 2);
    const lane = 12 + index % 4 * 9;
    const birthX = (isMergeBurst ? origin.x : pose.x) + Math.cos(angle) * lane;
    const birthY = (isMergeBurst ? origin.y : pose.y) + Math.sin(angle) * lane;
    const lifetime = Math.min(1.18 + index % 5 * 0.09, BEE_FINALE_LAST_LEAF_END_SECONDS - startAt);
    const scatterDistance = viewport.width * (0.476 + randomUnit * 0.714);
    const velocityX = Math.cos(angle) * scatterDistance / lifetime;
    const velocityY = Math.sin(angle) * scatterDistance / lifetime - 90 - index % 3 * 18;
    const floorDistance = Math.max(120, viewport.height - birthY + 110);
    const gravity = Math.max(320, 2 * (floorDistance - velocityY * lifetime) / (lifetime * lifetime));
    leaf.dataset.startAt = startAt.toFixed(4);
    leaf.dataset.birthX = birthX.toFixed(3);
    leaf.dataset.birthY = birthY.toFixed(3);
    leaf.dataset.endAt = (startAt + lifetime).toFixed(4);
    wrap.dataset.velocityX = velocityX.toFixed(2);
    wrap.dataset.velocityY = velocityY.toFixed(2);
    wrap.dataset.gravity = gravity.toFixed(2);
    wrap.dataset.scatterDistance = scatterDistance.toFixed(2);
    wrap.dataset.scatterRatio = (scatterDistance / viewport.width).toFixed(4);
    const sizeBoost = isMergeBurst ? 2 : index % 5 === 0 ? 1.5 : randomUnit > 0.78 ? 2 : 1;
    leaf.dataset.mergeBurst = String(isMergeBurst);
    const width = (16 + Math.round(((randomUnit * 17 + index * 7.31) % 1) * 22)) * sizeBoost;
    const heightUnit = (Math.sin((index + 3) * 47.17 + wobblePhase * 5.3) + 1) * 0.5;
    const height = (14 + Math.round(heightUnit * 28)) * sizeBoost;
    wrap.dataset.sizeBoost = String(sizeBoost);
    wrap.dataset.leafWidth = String(width);
    wrap.dataset.leafHeight = String(height);
    wrap.style.cssText = `position:absolute;left:0;top:0;width:${width}px;height:${height}px;pointer-events:none;visibility:hidden;opacity:0;will-change:transform,opacity;transform-origin:center;transform:translate3d(-200px,-200px,0)`;
    leaf.style.cssText += ';position:absolute;inset:0;width:100%;height:100%;object-fit:contain;visibility:visible;backface-visibility:hidden;will-change:transform,opacity';
    leafParticles.push({
      wrap,
      image: leaf,
      birth: startAt,
      lifetime,
      birthX,
      birthY,
      velocityX,
      velocityY,
      gravity,
      flutter: index * 1.73,
      spin: (index % 2 ? 1 : -1) * (260 + index % 6 * 48),
      scale: isFront ? 1.08 : 0.88,
      peakOpacity: isFront ? 1 : 0.86,
    });
  }

  master.to(field, { opacity: 0, duration: 0.12, ease: 'sine.in' }, 3.88);
  let cleaned = false;
  let exiting = false;
  let startFrameId: number | null = null;
  let startUsesAnimationFrame = false;
  const startAll = () => {
    startFrameId = null;
    if (cleaned || !field.isConnected) return;
    master.play(0);
  };
  if (typeof window.requestAnimationFrame === 'function') {
    startUsesAnimationFrame = true;
    startFrameId = window.requestAnimationFrame(startAll);
  } else {
    startFrameId = window.setTimeout(startAll, 16);
  }
  const cleanup = (() => {
    if (cleaned) return;
    cleaned = true;
    if (startFrameId !== null) {
      if (startUsesAnimationFrame) window.cancelAnimationFrame(startFrameId);
      else window.clearTimeout(startFrameId);
      startFrameId = null;
    }
    master.kill();
    field.remove();
  }) as BeeFinaleCleanup;
  cleanup.startExit = () => {
    if (cleaned || exiting) return;
    exiting = true;
    if (startFrameId !== null) {
      if (startUsesAnimationFrame) window.cancelAnimationFrame(startFrameId);
      else window.clearTimeout(startFrameId);
      startFrameId = null;
    }
    master.pause().clear();
    master.to(field, { opacity: 0, duration: 0.16, ease: 'sine.in', onComplete: cleanup }, 0).restart();
  };
  cleanup.completionDelaySeconds = BEE_FINALE_SCENE_SECONDS;
  return cleanup;
}
