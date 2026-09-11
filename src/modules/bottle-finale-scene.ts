// Dedicated Bottle merge-6 ocean scene. Keeps the S.O.S. text owner separate
// from the bounded foreground composition and uses transform/opacity-only PNGs.

import { gsap } from 'gsap';
import animationManager from './animation-manager.js';
import {
  playBottleFinaleSound,
  preloadBottleFinaleSounds,
  stopBottleFinaleSounds,
} from './bottle-finale-sound.js';
import { domElementPool } from './dom-element-pool.js';

const trackTimeline = (options: any = {}) => animationManager.trackExternalTimeline(gsap.timeline(options));

type OwnedTimeline = gsap.core.Timeline;

type BottleFinaleCleanup = (() => void) & {
  startExit?: () => void;
  completionDelaySeconds?: number;
};

const PACK = './assets/shop/bottle/bottle animation pack';
const use2x = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const source = (name: string): string => `${PACK}/${name}${use2x ? '@2x' : ''}.png`;

const BOTTLE_LAYERS = [
  {
    key: 'botle1', src: source('botle1'), z: 8, widthPercent: 30,
    centerPathPercents: [23, 34, 48, 55, 60], startYViewportRatio: -0.07,
  },
  {
    key: 'botle4', src: source('botle1'), z: 9, widthPercent: 22,
    centerPathPercents: [43, 34, 39, 50, 58], startYViewportRatio: -0.23,
  },
  {
    key: 'botle2', src: source('botle2'), z: 10, widthPercent: 36,
    centerPathPercents: [58, 57, 55, 50, 42], startYViewportRatio: 0.03,
  },
  {
    key: 'botle5', src: source('botle3'), z: 11, widthPercent: 22,
    centerPathPercents: [72, 74, 76, 82, 86], startYViewportRatio: -0.17,
  },
  {
    key: 'botle3', src: source('botle3'), z: 12, widthPercent: 27,
    centerPathPercents: [81.8, 80, 76, 70, 64], startYViewportRatio: 0.1,
  },
] as const;

const BOTTLE_WOBBLE_PHASE_RATIOS = [0.25, 0.25, 0.25, 0.25] as const;

export type BottleCrossingSinkPlan = {
  key: string;
  widthPercent: number;
  centerPathPercents: readonly number[];
  startYPx: number;
};

export function createBottleCrossingSinkPlans(
  viewportHeight: number,
): BottleCrossingSinkPlan[] {
  const safeViewportHeight = Math.max(0, viewportHeight);
  return BOTTLE_LAYERS.map((layer) => ({
    key: layer.key,
    widthPercent: layer.widthPercent,
    centerPathPercents: layer.centerPathPercents,
    startYPx: layer.startYViewportRatio * safeViewportHeight,
  }));
}

export function sampleBottleCrossingCenterPercent(
  centerPathPercents: readonly number[],
  progress: number,
): number {
  if (centerPathPercents.length === 0) return 50;
  if (centerPathPercents.length === 1) return centerPathPercents[0];
  const boundedProgress = Math.min(1, Math.max(0, progress));
  const segmentCount = centerPathPercents.length - 1;
  const scaledProgress = boundedProgress * segmentCount;
  const segmentIndex = Math.min(segmentCount - 1, Math.floor(scaledProgress));
  const localProgress = scaledProgress - segmentIndex;
  const p0 = centerPathPercents[Math.max(0, segmentIndex - 1)];
  const p1 = centerPathPercents[segmentIndex];
  const p2 = centerPathPercents[segmentIndex + 1];
  const p3 = centerPathPercents[Math.min(segmentCount, segmentIndex + 2)];
  const localSquared = localProgress * localProgress;
  const localCubed = localSquared * localProgress;
  return 0.5 * (
    2 * p1
    + (-p0 + p2) * localProgress
    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * localSquared
    + (-p0 + 3 * p1 - 3 * p2 + p3) * localCubed
  );
}

const ORIGINAL_BUBBLE_COUNT = 25;
const SMALL_BUBBLE_COUNT = 15;
const BUBBLE_COUNT = ORIGINAL_BUBBLE_COUNT + SMALL_BUBBLE_COUNT;
const BUBBLE_WAVE_SIZES = [6, 10, 7, 7, 5, 5] as const;
const BUBBLE_WAVE_STARTS = [0, 0.4, 0.9, 1.4, 1.9, 2.35] as const;
// Five bottles retain the former 60-particle trail budget (5 x 12), avoiding a
// 67% particle increase and keeping the iPhone compositor load bounded.
const TRAIL_BUBBLES_PER_BOTTLE = 12;
const TRAIL_MAX_LIFETIME_SECONDS = 0.72;
const BOTTLE_SINK_DURATION_SECONDS = 3.2;
const BOTTLE_START_DELAY_SECONDS = 0.3;
export const BOTTLE_FINALE_SECOND_CUE_PATH_RATIO = 0.2;
export const BOTTLE_FINALE_CLING_PATH_RATIO = 0.55;
export const BOTTLE_FINALE_CLING2_PATH_RATIO = 0.75;
export const BOTTLE_FINALE_BUBLESI_PATH_RATIO = 0.3;
const BOTTLE_SINK_START_SCALE = 0.9;
const BOTTLE_SINK_END_SCALE = BOTTLE_SINK_START_SCALE * 1.4;
const BOTTLE_WOBBLE_STRENGTH = 1.3;
const BUBBLE_FIELD_END_SECONDS = 5.1;
const BUBBLE_OPACITY_MIN = 0.2;
const BUBBLE_OPACITY_MAX = 0.7;

export function createMixedBottleBubbleOpacities(
  count: number,
  random: () => number = Math.random,
): number[] {
  const safeCount = Math.max(0, Math.floor(count));
  if (safeCount === 0) return [];
  const opacityRange = BUBBLE_OPACITY_MAX - BUBBLE_OPACITY_MIN;
  const values = Array.from({ length: safeCount }, (_, index) => {
    // One sample per opacity stratum guarantees a real pale-to-strong mix;
    // shuffling then prevents a wave or bottle emitter from forming a visual
    // opacity cluster.
    const normalized = (index + Math.min(1, Math.max(0, random()))) / safeCount;
    return BUBBLE_OPACITY_MIN + normalized * opacityRange;
  });
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.min(
      index,
      Math.floor(Math.min(1, Math.max(0, random())) * (index + 1)),
    );
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  return values;
}

export function attachBottleFinaleScene(
  overlay: HTMLElement,
  zIndex = 1,
  startDelaySeconds = 0,
): BottleFinaleCleanup {
  if (!overlay) return (() => {}) as BottleFinaleCleanup;

  stopBottleFinaleSounds();
  preloadBottleFinaleSounds();

  const field = document.createElement('div');
  field.className = 'cc-bottle-finale-scene';
  field.style.cssText = [
    'position:absolute', 'inset:0', 'overflow:hidden', 'pointer-events:none',
    `z-index:${zIndex}`, 'contain:layout style paint',
  ].join(';');

  const images: HTMLImageElement[] = [];
  const pooledImages = new WeakSet<HTMLImageElement>();
  const activeTimelines: OwnedTimeline[] = [];
  let cleaned = false;
  let exitRequested = false;
  let exitStarted = false;
  const sceneStartedAt = performance.now();

  const own = (timeline: OwnedTimeline): OwnedTimeline => {
    activeTimelines.push(timeline);
    return timeline;
  };

  const acquireImage = (
    src: string,
    className: string,
    parent: HTMLElement = field,
    pooled = true,
  ): HTMLImageElement => {
    // Keep the five hero bottles off the shared bubble IMG pool. On WebKit a
    // bubble->bottle src swap can retain the preceding composited image state
    // for the first moving frames even after CSS/GSAP values are reset.
    const image = pooled
      ? domElementPool.acquire('img') as HTMLImageElement
      : document.createElement('img');
    if (pooled) pooledImages.add(image);
    image.src = src;
    image.alt = '';
    image.className = className;
    image.draggable = false;
    image.style.pointerEvents = 'none';
    image.style.userSelect = 'none';
    image.style.willChange = 'transform, opacity';
    image.style.backfaceVisibility = 'hidden';
    images.push(image);
    parent.appendChild(image);
    return image;
  };

  const viewportH = Math.max(520, window.innerHeight || 844);
  const viewportW = Math.max(320, window.innerWidth || 390);
  const sinkMotionPlans = createBottleCrossingSinkPlans(viewportH);
  // Main bubbles preserve the former Bottle start moment. Hero bottles and
  // their attached emitters intentionally begin 300ms later.
  const mainBubbleStartDelaySeconds = 0;
  const bottleStartDelaySeconds = BOTTLE_START_DELAY_SECONDS;
  const trailBubbleOpacities = createMixedBottleBubbleOpacities(
    TRAIL_BUBBLES_PER_BOTTLE * BOTTLE_LAYERS.length,
  );
  const mainBubbleOpacities = createMixedBottleBubbleOpacities(BUBBLE_COUNT);
  const trailTimeline = own(trackTimeline({
    delay: bottleStartDelaySeconds,
    paused: true,
  }));
  const soundTimeline = own(trackTimeline({
    delay: bottleStartDelaySeconds,
    paused: true,
  }));
  soundTimeline.call(() => playBottleFinaleSound('bottle1'), [], 0);
  soundTimeline.call(
    () => playBottleFinaleSound('bottle2'),
    [],
    BOTTLE_SINK_DURATION_SECONDS * BOTTLE_FINALE_SECOND_CUE_PATH_RATIO,
  );
  soundTimeline.call(
    () => playBottleFinaleSound('cling'),
    [],
    BOTTLE_SINK_DURATION_SECONDS * BOTTLE_FINALE_CLING_PATH_RATIO,
  );
  soundTimeline.call(
    () => playBottleFinaleSound('cling2'),
    [],
    BOTTLE_SINK_DURATION_SECONDS * BOTTLE_FINALE_CLING2_PATH_RATIO,
  );
  soundTimeline.call(
    () => playBottleFinaleSound('bublesi'),
    [],
    BOTTLE_SINK_DURATION_SECONDS * BOTTLE_FINALE_BUBLESI_PATH_RATIO,
  );
  let fieldOrigin: { left: number; top: number } | null = null;
  const getFieldOrigin = (): { left: number; top: number } => {
    if (fieldOrigin) return fieldOrigin;
    const rect = field.getBoundingClientRect();
    fieldOrigin = { left: rect.left, top: rect.top };
    return fieldOrigin;
  };

  BOTTLE_LAYERS.forEach((layer, index) => {
    const layerSinkDuration = BOTTLE_SINK_DURATION_SECONDS;
    const sinkMotionPlan = sinkMotionPlans[index];
    const wobbleDirection = Math.random() < 0.5 ? -1 : 1;
    const initialRotation = wobbleDirection * (6 + Math.random() * 4) * BOTTLE_WOBBLE_STRENGTH;
    const mover = document.createElement('div');
    mover.className = `cc-bottle-finale-mover cc-bottle-finale-mover-${layer.key}`;
    mover.dataset.bottleMover = layer.key;
    mover.style.position = 'absolute';
    mover.style.width = `${layer.widthPercent}%`;
    mover.style.height = 'auto';
    mover.style.left = `${layer.centerPathPercents[0]}%`;
    mover.style.top = '-9%';
    mover.style.zIndex = String(layer.z * 10);
    mover.style.pointerEvents = 'none';
    mover.style.willChange = 'transform, opacity';
    field.appendChild(mover);
    const weaveShell = document.createElement('div');
    weaveShell.className = `cc-bottle-finale-weave cc-bottle-finale-weave-${layer.key}`;
    weaveShell.style.position = 'relative';
    weaveShell.style.display = 'block';
    weaveShell.style.width = '100%';
    weaveShell.style.height = 'auto';
    weaveShell.style.willChange = 'transform';
    mover.appendChild(weaveShell);
    const image = acquireImage(
      layer.src,
      `cc-bottle-finale-layer cc-bottle-finale-${layer.key}`,
      weaveShell,
      false,
    );
    image.dataset.bottleLayer = layer.key;
    image.style.position = 'relative';
    image.style.display = 'block';
    image.style.width = '100%';
    image.style.height = 'auto';
    image.style.transformOrigin = '50% 82%';
    gsap.set(mover, {
      xPercent: -50,
      y: sinkMotionPlan.startYPx,
      scale: 0.82,
      opacity: 0,
      force3D: true,
    });
    // Prime the complete GSAP transform as well as visibility before the first
    // owned frame. Keeping hero nodes fresh removes the WebKit source-swap
    // hazard; the explicit identity pose also makes that ownership invariant
    // robust if image creation changes again later.
    gsap.set(image, {
      x: 0,
      y: 0,
      xPercent: 0,
      yPercent: 0,
      scale: 1,
      rotation: initialRotation,
      rotationX: 0,
      rotationY: 0,
      opacity: 1,
      visibility: 'visible',
      force3D: true,
    });
    const bottleTimeline = own(trackTimeline({ delay: bottleStartDelaySeconds }));
    bottleTimeline.set(mover, { opacity: 1, scale: BOTTLE_SINK_START_SCALE }, 0);
    const sinkEndY = viewportH * 1.24;
    bottleTimeline.to(mover, {
      y: sinkEndY,
      scale: BOTTLE_SINK_END_SCALE,
      duration: layerSinkDuration,
      ease: 'power1.in',
    }, 0);
    bottleTimeline.set(mover, { opacity: 0 }, layerSinkDuration);
    const weaveTimeline = own(trackTimeline({ delay: bottleStartDelaySeconds }));
    const weaveProgress = { value: 0 };
    const setWeaveX = gsap.quickSetter(weaveShell, 'x', 'px');
    weaveTimeline.set(weaveProgress, { value: 0 }, 0);
    weaveTimeline.to(weaveProgress, {
      value: 1,
      duration: layerSinkDuration,
      ease: 'none',
      onUpdate: () => {
        const centerPercent = sampleBottleCrossingCenterPercent(
          sinkMotionPlan.centerPathPercents,
          weaveProgress.value,
        );
        const startCenterPercent = sinkMotionPlan.centerPathPercents[0];
        setWeaveX(((centerPercent - startCenterPercent) / 100) * viewportW);
      },
    }, 0);
    const wobbleTimeline = own(trackTimeline({ delay: bottleStartDelaySeconds }));
    BOTTLE_WOBBLE_PHASE_RATIOS.forEach((durationRatio, phaseIndex) => {
      const authoredDirection = phaseIndex % 2 === 0 ? -wobbleDirection : wobbleDirection;
      wobbleTimeline.to(image, {
        rotation: authoredDirection * (10 + Math.random() * 4) * BOTTLE_WOBBLE_STRENGTH,
        duration: layerSinkDuration * durationRatio,
        ease: 'sine.inOut',
      });
    });

    const trailBubbleCount = TRAIL_BUBBLES_PER_BOTTLE;
    for (let trailIndex = 0; trailIndex < trailBubbleCount; trailIndex += 1) {
      const trailBubble = acquireImage(
        source(`bubble${((index * 8 + trailIndex) % 6) + 1}`),
        'cc-bottle-finale-bubble cc-bottle-finale-trail-bubble',
      );
      const trailSize = 8 + Math.pow(Math.random(), 0.72) * 48;
      const trailDirection = Math.random() < 0.5 ? -1 : 1;
      const trailPushDown = 8 + Math.random() * 14;
      const trailStartScale = 0.35 + Math.random() * 0.2;
      const trailEndScale = 0.9 + Math.random() * 0.25;
      const emissionOrdinal = trailIndex * BOTTLE_LAYERS.length + index;
      const trailOpacity = trailBubbleOpacities[emissionOrdinal] ?? BUBBLE_OPACITY_MIN;
      const finalEmissionOrdinal = TRAIL_BUBBLES_PER_BOTTLE * BOTTLE_LAYERS.length - 1;
      const trailEmissionWindow = layerSinkDuration - TRAIL_MAX_LIFETIME_SECONDS;
      const trailDelay = (emissionOrdinal / finalEmissionOrdinal) * trailEmissionWindow;
      const trailTravelDuration = 0.32 + Math.random() * 0.18;
      const emitterPort = [0.32, 0.5, 0.68][trailIndex % 3];
      let trailRise = 60;
      trailBubble.style.position = 'absolute';
      trailBubble.dataset.bottleEmitter = layer.key;
      trailBubble.style.width = `${Math.round(trailSize)}px`;
      trailBubble.style.height = `${Math.round(trailSize)}px`;
      trailBubble.style.zIndex = String(layer.z * 10 - 1);
      gsap.set(trailBubble, { xPercent: -50, yPercent: -50, scale: 0, opacity: 0, force3D: true });
      trailTimeline.call(() => {
        if (cleaned || !mover.isConnected || !field.isConnected) return;
        const bottleRect = image.getBoundingClientRect();
        const origin = getFieldOrigin();
        const emitterX = bottleRect.left - origin.left
          + bottleRect.width * emitterPort
          + (Math.random() - 0.5) * 6;
        const emitterY = bottleRect.top - origin.top
          + bottleRect.height * (0.72 + Math.random() * 0.18);
        trailRise = bottleRect.height * (0.16 + Math.random() * 0.08);
        trailBubble.style.left = `${Math.round(emitterX)}px`;
        trailBubble.style.top = `${Math.round(emitterY)}px`;
        gsap.set(trailBubble, { x: 0, y: 0 });
      }, [], trailDelay);
      trailTimeline.to(trailBubble, {
        scale: trailStartScale,
        opacity: trailOpacity,
        duration: 0.06,
        ease: 'back.out(2)',
      }, trailDelay);
      trailTimeline.to(trailBubble, {
        keyframes: [
          { x: trailDirection * 5, y: trailPushDown, scale: trailStartScale * 1.08 },
          { x: -trailDirection * 9, y: () => -trailRise * 0.28, scale: trailStartScale * 1.35 },
          { x: trailDirection * 12, y: () => -trailRise * 0.68, scale: trailEndScale * 0.88 },
          { x: trailDirection * 6, y: () => -trailRise, scale: trailEndScale },
        ],
        duration: trailTravelDuration,
        ease: 'sine.inOut',
      }, trailDelay + 0.06);
      trailTimeline.to(
        trailBubble,
        { scale: 0, opacity: 0, duration: 0.08, ease: 'back.in(3)' },
        trailDelay + 0.06 + trailTravelDuration - 0.08,
      );
    }
  });

  for (let index = 0; index < BUBBLE_COUNT; index += 1) {
    const bubble = acquireImage(source(`bubble${(index % 6) + 1}`), 'cc-bottle-finale-bubble');
    const isAddedSmallBubble = index >= ORIGINAL_BUBBLE_COUNT;
    const sizeMultiplier = isAddedSmallBubble ? 1.08 : 2.4;
    const size = (18 + Math.pow(Math.random(), 1.6) * 42) * sizeMultiplier;
    let waveIndex = 0;
    let waveStartIndex = 0;
    while (index >= waveStartIndex + BUBBLE_WAVE_SIZES[waveIndex] && waveIndex < BUBBLE_WAVE_SIZES.length - 1) {
      waveStartIndex += BUBBLE_WAVE_SIZES[waveIndex];
      waveIndex += 1;
    }
    const waveSlot = index - waveStartIndex;
    const slotsInWave = BUBBLE_WAVE_SIZES[waveIndex];
    const laneProgress = (waveSlot + 0.12 + Math.random() * 0.76) / slotsInWave;
    const startX = 2 + laneProgress * 96;
    const verticalGap = 50 + Math.random() * 50;
    const verticalLane = waveSlot % 4;
    const startY = viewportH * (1.03 + Math.random() * 0.08) + verticalLane * verticalGap;
    const rise = startY + size * (1.1 + Math.random() * 1.4);
    const weaveDirection = Math.random() < 0.5 ? -1 : 1;
    const weaveDistance = Math.max(20, window.innerWidth * (0.04 + Math.random() * 0.16));
    const pausesNearMiddle = Math.random() < 0.16;
    const riseDuration = 1.45 + Math.random() * 0.45;
    const popRiseRatio = pausesNearMiddle
      ? 0.46 + Math.random() * 0.18
      : 0.68 + Math.random() * 0.28;
    const withinWaveDelay = waveSlot * (0.045 + Math.random() * 0.035);
    const delay = index === 0 ? 0 : BUBBLE_WAVE_STARTS[waveIndex] + withinWaveDelay;
    const popAt = 0.12 + riseDuration * popRiseRatio;
    const bubbleOpacity = mainBubbleOpacities[index] ?? BUBBLE_OPACITY_MIN;
    const popOpacity = Math.min(BUBBLE_OPACITY_MAX, bubbleOpacity + 0.06);
    bubble.style.position = 'absolute';
    bubble.style.left = `${startX}%`;
    bubble.style.top = `${Math.round(startY)}px`;
    bubble.style.width = `${Math.round(size)}px`;
    bubble.style.height = `${Math.round(size)}px`;
    // Main bubbles are the foreground unit; Bottle heroes remain behind them.
    bubble.style.zIndex = String(120 + (index % 3));
    gsap.set(bubble, {
      xPercent: -50,
      yPercent: -50,
      scale: 0,
      opacity: 0,
      force3D: true,
    });
    const timeline = own(trackTimeline({ delay: mainBubbleStartDelaySeconds + delay }));
    timeline.to(bubble, {
      scale: 0.75 + Math.random() * 0.35,
      opacity: bubbleOpacity,
      duration: 0.12,
      ease: 'back.out(2)',
    });
    timeline.to(bubble, {
      keyframes: [
        { x: weaveDirection * weaveDistance * 0.55, y: -rise * 0.18 },
        { x: -weaveDirection * weaveDistance * 0.8, y: -rise * (pausesNearMiddle ? 0.43 : 0.38) },
        { x: weaveDirection * weaveDistance, y: -rise * (pausesNearMiddle ? 0.49 : 0.6) },
        { x: -weaveDirection * weaveDistance * 0.7, y: -rise * (pausesNearMiddle ? 0.7 : 0.8) },
        { x: weaveDirection * weaveDistance * 0.3, y: -rise },
      ],
      duration: riseDuration,
      ease: 'sine.inOut',
    });
    timeline.to(bubble, { scale: 1.2, opacity: popOpacity, duration: 0.06, ease: 'power2.out' }, popAt);
    timeline.to(bubble, { scale: 0, opacity: 0, duration: 0.08, ease: 'back.in(3)' }, popAt + 0.06);
  }

  overlay.appendChild(field);
  playBottleFinaleSound('water-waves');
  trailTimeline.play(0);
  soundTimeline.play(0);
  try { (window as any).triggerHapticImpact?.('medium'); } catch {}

  const beginExit = (): void => {
    if (cleaned || exitStarted) return;
    exitStarted = true;
    // The authored sequence has already popped bubbles and dropped bottles.
    // Retire its owners before the final hidden-state handoff.
    activeTimelines.splice(0).forEach((timeline) => {
      animationManager.killExternalTimeline(timeline);
    });
    stopBottleFinaleSounds();
    const finish = own(trackTimeline());
    finish.set(images, { opacity: 0 });
  };

  const startExit = (): void => {
    if (cleaned || exitRequested) return;
    exitRequested = true;
    const elapsedSeconds = Math.max(0, (performance.now() - sceneStartedAt) / 1000);
    const sceneEndSeconds = startDelaySeconds + BUBBLE_FIELD_END_SECONDS;
    const remainingBubbleTime = Math.max(0, sceneEndSeconds - elapsedSeconds);
    const delayedExit = own(trackTimeline({ delay: remainingBubbleTime }));
    delayedExit.call(beginExit);
  };

  const cleanup = (() => {
    if (cleaned) return;
    cleaned = true;
    activeTimelines.splice(0).forEach((timeline) => {
      animationManager.killExternalTimeline(timeline);
    });
    stopBottleFinaleSounds();
    images.forEach((image) => {
      try {
        gsap.killTweensOf(image);
        if (image.parentNode) image.parentNode.removeChild(image);
        if (pooledImages.has(image)) {
          domElementPool.release(image);
        } else {
          image.removeAttribute('src');
        }
      } catch {}
    });
    try { field.remove(); } catch {}
  }) as BottleFinaleCleanup;
  cleanup.startExit = startExit;
  cleanup.completionDelaySeconds = startDelaySeconds + 5.35;
  return cleanup;
}
