// Dedicated Bottle merge-6 ocean scene. Keeps the S.O.S. text owner separate
// from the bounded foreground composition and uses transform/opacity-only PNGs.

import { gsap } from 'gsap';
import animationManager from './animation-manager.js';
import { domElementPool } from './dom-element-pool.js';

const trackTimeline = (options: any = {}) => animationManager.trackExternalTimeline(gsap.timeline(options));

type OwnedTimeline = gsap.core.Timeline;

type BottleFinaleCleanup = (() => void) & {
  startExit?: () => void;
  completionDelaySeconds?: number;
};

const PACK = './assets/shop/bottle/bottle animation pack';
const use2x = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const source = (name: string, allow2x = true): string => `${PACK}/${name}${use2x && allow2x ? '@2x' : ''}.png`;

const BOTTLE_LAYERS = [
  { key: 'botle1', src: source('botle1'), z: 8, width: '30%', left: '18%', direction: -1, restY: 100, speedMultiplier: 1 },
  { key: 'botle2', src: source('botle2'), z: 9, width: '36%', left: '50%', direction: 1, restY: 0, speedMultiplier: 1.488 },
  { key: 'botle3', src: source('botle3'), z: 10, width: '27%', left: '78%', direction: -1, restY: -60, speedMultiplier: 1.332 },
] as const;

const ORIGINAL_BUBBLE_COUNT = 25;
const SMALL_BUBBLE_COUNT = 15;
const BUBBLE_COUNT = ORIGINAL_BUBBLE_COUNT + SMALL_BUBBLE_COUNT;
const BUBBLE_WAVE_SIZES = [6, 10, 7, 7, 5, 5] as const;
const BUBBLE_WAVE_STARTS = [0, 0.4, 0.9, 1.4, 1.9, 2.35] as const;
const TRAIL_BUBBLES_PER_BOTTLE = 20;
const TRAIL_MAX_LIFETIME_SECONDS = 0.72;
const BOTTLE_SINK_DURATION_SECONDS = 3.2;
const BUBBLE_FIELD_END_SECONDS = 5.1;

export function attachBottleFinaleScene(
  overlay: HTMLElement,
  zIndex = 1,
  startDelaySeconds = 0,
): BottleFinaleCleanup {
  if (!overlay) return (() => {}) as BottleFinaleCleanup;

  const field = document.createElement('div');
  field.className = 'cc-bottle-finale-scene';
  field.style.cssText = [
    'position:absolute', 'inset:0', 'overflow:hidden', 'pointer-events:none',
    `z-index:${zIndex}`, 'contain:layout style paint',
  ].join(';');

  const images: HTMLImageElement[] = [];
  const activeTimelines: OwnedTimeline[] = [];
  let cleaned = false;
  let exitRequested = false;
  let exitStarted = false;
  const sceneStartedAt = performance.now();

  const own = (timeline: OwnedTimeline): OwnedTimeline => {
    activeTimelines.push(timeline);
    return timeline;
  };

  const acquireImage = (src: string, className: string): HTMLImageElement => {
    const image = domElementPool.acquire('img') as HTMLImageElement;
    image.src = src;
    image.alt = '';
    image.className = className;
    image.draggable = false;
    image.style.pointerEvents = 'none';
    image.style.userSelect = 'none';
    image.style.willChange = 'transform, opacity';
    image.style.backfaceVisibility = 'hidden';
    images.push(image);
    field.appendChild(image);
    return image;
  };

  const viewportH = Math.max(520, window.innerHeight || 844);
  const viewportW = Math.max(320, window.innerWidth || 390);
  const bottleStartDelaySeconds = 0;
  const mainBubbleStartDelaySeconds = startDelaySeconds;

  BOTTLE_LAYERS.forEach((layer, index) => {
    const layerSinkDuration = BOTTLE_SINK_DURATION_SECONDS / layer.speedMultiplier;
    const driftDirection = Math.random() < 0.5 ? -1 : 1;
    const driftDistance = viewportW * (0.06 + Math.random() * 0.08);
    const wobbleDirection = Math.random() < 0.5 ? -1 : 1;
    const initialRotation = wobbleDirection * (6 + Math.random() * 4);
    const wobbleAngles = [
      -wobbleDirection * (14 + Math.random() * 4),
      wobbleDirection * (12 + Math.random() * 5),
      -wobbleDirection * (17 + Math.random() * 3),
      wobbleDirection * (14 + Math.random() * 6),
    ];
    const wobblePhaseRatios = [0.22, 0.28, 0.23, 0.27] as const;
    const mover = document.createElement('div');
    mover.className = `cc-bottle-finale-mover cc-bottle-finale-mover-${layer.key}`;
    mover.dataset.bottleMover = layer.key;
    mover.style.position = 'absolute';
    mover.style.width = layer.width;
    mover.style.height = 'auto';
    mover.style.left = layer.left;
    mover.style.top = '-9%';
    mover.style.zIndex = String(layer.z * 10);
    mover.style.pointerEvents = 'none';
    mover.style.willChange = 'transform, opacity';
    field.appendChild(mover);
    const image = acquireImage(layer.src, `cc-bottle-finale-layer cc-bottle-finale-${layer.key}`);
    mover.appendChild(image);
    image.dataset.bottleLayer = layer.key;
    image.style.position = 'relative';
    image.style.display = 'block';
    image.style.width = '100%';
    image.style.height = 'auto';
    image.style.transformOrigin = '50% 82%';
    gsap.set(mover, {
      xPercent: -50,
      y: -viewportH * (0.07 + index * 0.006),
      scale: 0.82,
      opacity: 0,
      force3D: true,
    });
    gsap.set(image, { rotation: initialRotation, force3D: true });
    const bottleTimeline = own(trackTimeline({ delay: bottleStartDelaySeconds }));
    bottleTimeline.set(mover, { opacity: 1, scale: 0.9 }, 0);
    bottleTimeline.to(mover, {
      x: driftDirection * driftDistance,
      y: viewportH * 1.24 + layer.restY,
      scale: 1,
      duration: layerSinkDuration,
      ease: 'none',
    }, 0);
    bottleTimeline.set(mover, { opacity: 0 }, layerSinkDuration);
    const wobbleTimeline = own(trackTimeline({ delay: bottleStartDelaySeconds }));
    wobbleAngles.forEach((rotation, phaseIndex) => {
      wobbleTimeline.to(image, {
        rotation,
        duration: layerSinkDuration * wobblePhaseRatios[phaseIndex],
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
      const trailTimeline = own(trackTimeline({ delay: bottleStartDelaySeconds + trailDelay }));
      trailTimeline.call(() => {
        if (cleaned || !mover.isConnected || !field.isConnected) return;
        const bottleRect = mover.getBoundingClientRect();
        const fieldRect = field.getBoundingClientRect();
        const emitterX = bottleRect.left - fieldRect.left
          + bottleRect.width * emitterPort
          + (Math.random() - 0.5) * 6;
        const emitterY = bottleRect.top - fieldRect.top
          + bottleRect.height * (0.72 + Math.random() * 0.18);
        trailRise = bottleRect.height * (0.16 + Math.random() * 0.08);
        trailBubble.style.left = `${Math.round(emitterX)}px`;
        trailBubble.style.top = `${Math.round(emitterY)}px`;
        gsap.set(trailBubble, { x: 0, y: 0 });
      });
      trailTimeline.to(trailBubble, {
        scale: trailStartScale,
        opacity: 0.52 + Math.random() * 0.33,
        duration: 0.06,
        ease: 'back.out(2)',
      });
      trailTimeline.to(trailBubble, {
        keyframes: [
          { x: trailDirection * 5, y: trailPushDown, scale: trailStartScale * 1.08 },
          { x: -trailDirection * 9, y: () => -trailRise * 0.28, scale: trailStartScale * 1.35 },
          { x: trailDirection * 12, y: () => -trailRise * 0.68, scale: trailEndScale * 0.88 },
          { x: trailDirection * 6, y: () => -trailRise, scale: trailEndScale },
        ],
        duration: trailTravelDuration,
        ease: 'sine.inOut',
      });
      trailTimeline.to(trailBubble, { scale: 0, opacity: 0, duration: 0.08, ease: 'back.in(3)' }, '-=0.08');
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
    bubble.style.position = 'absolute';
    bubble.style.left = `${startX}%`;
    bubble.style.top = `${Math.round(startY)}px`;
    bubble.style.width = `${Math.round(size)}px`;
    bubble.style.height = `${Math.round(size)}px`;
    bubble.style.zIndex = String(5 + (index % 3));
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
      opacity: 0.42 + Math.random() * 0.38,
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
    timeline.to(bubble, { scale: 1.2, opacity: 0.72, duration: 0.06, ease: 'power2.out' }, popAt);
    timeline.to(bubble, { scale: 0, opacity: 0, duration: 0.08, ease: 'back.in(3)' }, popAt + 0.06);
  }

  overlay.appendChild(field);
  try { (window as any).triggerHapticImpact?.('medium'); } catch {}

  const beginExit = (): void => {
    if (cleaned || exitStarted) return;
    exitStarted = true;
    // The authored sequence has already popped bubbles and dropped bottles.
    // Retire its owners before the final hidden-state handoff.
    activeTimelines.splice(0).forEach((timeline) => { try { timeline.kill(); } catch {} });
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
    activeTimelines.forEach((timeline) => { try { timeline.kill(); } catch {} });
    images.forEach((image) => {
      try {
        gsap.killTweensOf(image);
        if (image.parentNode) image.parentNode.removeChild(image);
        domElementPool.release(image);
      } catch {}
    });
    try { field.remove(); } catch {}
  }) as BottleFinaleCleanup;
  cleanup.startExit = startExit;
  cleanup.completionDelaySeconds = startDelaySeconds + 5.35;
  return cleanup;
}

export const BOTTLE_FINALE_SCENE_LAYER_KEYS = BOTTLE_LAYERS.map((layer) => layer.key);
export const BOTTLE_FINALE_BUBBLE_COUNT = BUBBLE_COUNT;
