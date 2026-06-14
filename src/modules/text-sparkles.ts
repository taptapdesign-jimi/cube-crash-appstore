// @ts-nocheck
// Sparkle sprite field behind SPARKLE text overlay (wild-star merge-6)

import { gsap } from 'gsap';
import animationManager from './animation-manager.js';
import { domElementPool } from './dom-element-pool.js';

const trackTimeline = (options: any = {}) => animationManager.trackExternalTimeline(gsap.timeline(options));
const trackDelayedCall = (...args: any[]) => animationManager.trackExternalTween(gsap.delayedCall(...args));

const SPARKLE_IMAGES = [
  './assets/small-star.png'
];

interface SparkleFieldOptions {
  count?: number;
  zIndex?: number;
  origin?: { x: number; y: number } | null;
}

interface SmallStarBurstOptions {
  count?: number;
  zIndex?: number;
  origin?: { x: number; y: number } | null;
  sources?: string[];
  motion?: {
    count?: number;
    speedScale?: number;
    flagWave?: boolean;
    sizeBoostChance?: number;
    sizeBoostMax?: number;
    waveStrength?: number;
    waveDurationScale?: number;
    mixBlendMode?: string;
  };
}

function sparkleSrc(index: number, sources?: string[]): string {
  const list = Array.isArray(sources) && sources.length ? sources : SPARKLE_IMAGES;
  return list[index % list.length];
}

function pickWeightedSparkleSrc(index: number): string {
  // Target distribution:
  // - 80%: sparkle1/2/3 (dominant)
  // - 20%: sparkle4/5/6
  const r = Math.random();
  if (r < 0.8) {
    const low = [
      './assets/animations/sparkle1.png',
      './assets/animations/sparkle2.png',
      './assets/animations/sparkle3.png'
    ];
    return low[index % low.length];
  }
  const hi = [
    './assets/animations/sparkle4.png',
    './assets/animations/sparkle5.png',
    './assets/animations/sparkle6.png'
  ];
  return hi[index % hi.length];
}

export function attachSparkleSprites(overlay: HTMLElement, opts: SparkleFieldOptions = {}): () => void {
  if (!overlay) return () => {};

  const count = Math.max(8, Math.min(72, opts.count ?? 25));
  const zIndex = opts.zIndex ?? 1;

  const field = document.createElement('div');
  field.className = 'cc-text-sparkles';
  field.style.cssText = [
    'position: absolute',
    'left: 0',
    'top: 0',
    'width: 100%',
    'height: 100%',
    'pointer-events: none',
    `z-index: ${zIndex}`,
    'overflow: hidden'
  ].join(';');
  overlay.appendChild(field);

  const viewportW = Math.max(320, window.innerWidth || 390);
  const viewportH = Math.max(520, window.innerHeight || 844);
  const originX = Number.isFinite(opts.origin?.x) ? opts.origin!.x : viewportW * 0.5;
  const originY = Number.isFinite(opts.origin?.y) ? opts.origin!.y : viewportH * 0.5;
  const centerX = originX;
  const centerY = originY;

  const activeSprites: HTMLImageElement[] = [];
  const sparkleTimelines: gsap.core.Timeline[] = [];

  for (let i = 0; i < count; i++) {
    const img = domElementPool.acquire('img') as HTMLImageElement;
    img.src = pickWeightedSparkleSrc(i);
    img.alt = '';
    img.className = 'cc-sparkle-sprite';

    // Mix large/medium/small sparkle sprites.
    const isLarge = i % 7 === 0;
    const isMedium = !isLarge && i % 3 === 0;
    const size = (isLarge
      ? 86 + Math.random() * 42
      : isMedium
        ? 42 + Math.random() * 30
        : 18 + Math.random() * 18) * 0.65; // 35% smaller

    // Full-screen scatter so sparkles occupy the whole viewport.
    const marginX = viewportW * 0.04;
    const marginY = viewportH * 0.05;
    const x = marginX + Math.random() * Math.max(1, viewportW - marginX * 2);
    const y = marginY + Math.random() * Math.max(1, viewportH - marginY * 2);

    img.style.cssText = [
      'position: absolute',
      'pointer-events: none',
      'will-change: transform, opacity',
      `left: ${Math.round(x)}px`,
      `top: ${Math.round(y)}px`,
      `width: ${Math.round(size)}px`,
      `height: ${Math.round(size)}px`,
      'object-fit: contain',
      'transform-origin: center center'
      // To restore extra bling on wild-star burst, add back: 'mix-blend-mode: screen'
    ].join(';');

    activeSprites.push(img);
    field.appendChild(img);

    const baseScale = 0.7 + Math.random() * 0.55;
    const flashOpacityA = 0.45 + Math.random() * 0.35;
    const flashOpacityB = 0.25 + Math.random() * 0.4;
    const rotateStart = (Math.random() - 0.5) * 26;
    // Push sparkles outward from center (cloud-like drift toward edges).
    const outwardDx = x - centerX;
    const outwardDy = y - centerY;
    const outwardLen = Math.max(1, Math.hypot(outwardDx, outwardDy));
    const outwardX = outwardDx / outwardLen;
    const outwardY = outwardDy / outwardLen;
    const outwardDist = 26 + Math.random() * 38;
    const driftX = outwardX * outwardDist + (Math.random() - 0.5) * 8;
    const driftY = outwardY * (outwardDist * 0.72) + (Math.random() - 0.5) * 7;

    gsap.set(img, {
      xPercent: -50,
      yPercent: -50,
      x: 0,
      y: 0,
      scale: 0.18,
      opacity: 0,
      rotation: rotateStart
    });

    // Sequential twinkle timeline (fade in/out "blinks"), looped while overlay is alive.
    const tl = trackTimeline({
      delay: i * 0.035 + Math.random() * 0.22,
      repeat: -1,
      repeatDelay: 0.12 + Math.random() * 0.28
    });
    tl.to(img, {
      opacity: flashOpacityA,
      scale: baseScale * (1.1 + Math.random() * 0.18),
      x: driftX,
      y: driftY,
      rotation: rotateStart + (Math.random() - 0.5) * 12,
      duration: 0.11 + Math.random() * 0.06,
      ease: 'power2.out'
    });
    tl.to(img, {
      opacity: 0.08 + Math.random() * 0.1,
      scale: baseScale * (0.84 + Math.random() * 0.08),
      duration: 0.12 + Math.random() * 0.08,
      ease: 'sine.inOut'
    });
    tl.to(img, {
      opacity: flashOpacityB,
      scale: baseScale * (0.96 + Math.random() * 0.12),
      x: driftX * 0.35,
      y: driftY * 0.35,
      duration: 0.08 + Math.random() * 0.05,
      ease: 'power1.inOut'
    });
    tl.to(img, {
      opacity: 0,
      scale: baseScale * 0.55,
      x: 0,
      y: 0,
      duration: 0.15 + Math.random() * 0.08,
      ease: 'power2.in'
    });
    sparkleTimelines.push(tl);
  }

  return () => {
    sparkleTimelines.forEach((tl) => {
      try { tl.kill(); } catch {}
    });
    activeSprites.forEach((img) => {
      try {
        gsap.killTweensOf(img);
        domElementPool.release(img);
      } catch {}
    });
    try { field.remove(); } catch {}
  };
}

export function attachSmallStarCenterBurst(overlay: HTMLElement, opts: SmallStarBurstOptions = {}): () => void {
  if (!overlay) return () => {};

  const count = Math.max(4, Math.min(40, opts.count ?? 20));
  const zIndex = opts.zIndex ?? 2;
  const motion = opts.motion || {};
  const speedScale = Number.isFinite(motion.speedScale)
    ? Math.max(0.35, Math.min(3.5, Number(motion.speedScale)))
    : 1;
  const flagWave = motion.flagWave === true;
  const waveDurationScale = Number.isFinite(motion.waveDurationScale)
    ? Math.max(0.5, Math.min(2.4, Number(motion.waveDurationScale)))
    : 1;
  const sizeBoostChance = Number.isFinite(motion.sizeBoostChance)
    ? Math.max(0, Math.min(1, Number(motion.sizeBoostChance)))
    : 0;
  const sizeBoostMax = Number.isFinite(motion.sizeBoostMax)
    ? Math.max(1, Math.min(1.6, Number(motion.sizeBoostMax)))
    : 1;
  const waveStrength = Number.isFinite(motion.waveStrength)
    ? Math.max(0.5, Math.min(1.8, Number(motion.waveStrength)))
    : 1;
  const mixBlendMode = typeof motion.mixBlendMode === 'string' ? motion.mixBlendMode : 'screen';
  const viewportW = Math.max(320, window.innerWidth || 390);
  const viewportH = Math.max(520, window.innerHeight || 844);
  const originX = viewportW * 0.5;
  const originY = viewportH * 0.5;

  const field = document.createElement('div');
  field.className = 'cc-small-star-center-burst';
  field.style.cssText = [
    'position: absolute',
    'left: 0',
    'top: 0',
    'width: 100%',
    'height: 100%',
    'pointer-events: none',
    `z-index: ${zIndex}`,
    'overflow: visible'
  ].join(';');
  overlay.appendChild(field);

  const activeStars: HTMLImageElement[] = [];
  const activeWraps: HTMLElement[] = [];
  const starTimelines: gsap.core.Timeline[] = [];
  const waveTimelines: gsap.core.Timeline[] = [];
  let maxAnimationTime = 0;

  for (let i = 0; i < count; i++) {
    const wrap = document.createElement('div');
    const img = domElementPool.acquire('img') as HTMLImageElement;
    img.src = sparkleSrc(i, opts.sources);
    img.alt = '';
    img.className = 'cc-sparkle-burst-sprite';

    const radialProgress = (i / Math.max(1, count)) * Math.PI * 2;
    const angle = radialProgress + (Math.random() - 0.5) * 0.95;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const laneOffset = 28 + Math.random() * Math.min(105, viewportW * 0.22);
    const birthX = originX + dirX * laneOffset + (Math.random() - 0.5) * 36;
    const birthY = originY + dirY * laneOffset + (Math.random() - 0.5) * 36;
    const spreadDistance = Math.min(Math.max(viewportW, viewportH) * (0.38 + Math.random() * 0.28), 500 + Math.random() * 190);
    const midDistanceA = spreadDistance * (0.22 + Math.random() * 0.08);
    const midDistanceB = spreadDistance * (0.54 + Math.random() * 0.1);
    const birthProgress = count <= 1 ? 0 : i / (count - 1);
    const lateSizeScale = 1 - birthProgress * 0.24;
    const boostRoll = Math.random();
    const sizeBoost = boostRoll < sizeBoostChance
      ? 1 + Math.random() * (sizeBoostMax - 1)
      : 1;
    const size = (26 + Math.random() * 42) * lateSizeScale * sizeBoost;
    const baseScale = 0.85 + Math.random() * 0.5;
    const baseOpacity = 0.42 + Math.random() * 0.58;
    const blinkOpacity = Math.min(1, baseOpacity + 0.22 + Math.random() * 0.28);
    const rotateStart = (Math.random() * 360) - 180;
    const rotateOut = rotateStart + (Math.random() - 0.5) * 28;
    const delay = Math.min(1.35, i * (1.3 / Math.max(1, count - 1)) + Math.random() * 0.05);
    const isFastStar = Math.random() < 0.55;
    const launchDuration = isFastStar ? 0.04 + Math.random() * 0.02 : 0.06 + Math.random() * 0.025;
    const travelDuration = isFastStar ? 0.58 + Math.random() * 0.18 : 0.78 + Math.random() * 0.24;
    maxAnimationTime = Math.max(maxAnimationTime, delay + (launchDuration + travelDuration) * speedScale);

    wrap.className = 'cc-sparkle-burst-wrap';
    wrap.style.cssText = [
      'position: absolute',
      'pointer-events: none',
      'will-change: transform, opacity',
      `left: ${Math.round(birthX)}px`,
      `top: ${Math.round(birthY)}px`,
      `width: ${Math.round(size)}px`,
      `height: ${Math.round(size)}px`,
      'transform-origin: center center',
      `mix-blend-mode: ${mixBlendMode}`
    ].join(';');

    img.style.cssText = [
      'position: absolute',
      'left: 0',
      'top: 0',
      'width: 100%',
      'height: 100%',
      'pointer-events: none',
      'will-change: transform, opacity',
      'object-fit: contain',
      'transform-origin: 22% 50%',
      'backface-visibility: hidden'
    ].join(';');

    wrap.appendChild(img);
    field.appendChild(wrap);
    activeWraps.push(wrap);
    activeStars.push(img);

    const driftAngle = angle + Math.PI / 2;
    const wobbleA = (Math.random() > 0.5 ? 1 : -1) * (22 + Math.random() * 42);
    const wobbleB = -wobbleA * (0.45 + Math.random() * 0.35);
    const verticalLift = (Math.random() - 0.5) * 90;
    const x1 = dirX * midDistanceA + Math.cos(driftAngle) * wobbleA;
    const y1 = dirY * midDistanceA + Math.sin(driftAngle) * wobbleA + verticalLift * 0.35;
    const x2 = dirX * midDistanceB + Math.cos(driftAngle) * wobbleB;
    const y2 = dirY * midDistanceB + Math.sin(driftAngle) * wobbleB - verticalLift * 0.2;
    const exitDistance = Math.hypot(viewportW * 0.5, viewportH * 0.5) + size + 110 + Math.random() * 110;
    const x4 = dirX * exitDistance + Math.cos(driftAngle) * ((Math.random() - 0.5) * 86);
    const y4 = dirY * exitDistance + Math.sin(driftAngle) * ((Math.random() - 0.5) * 86);
    const x3 = x2 + (x4 - x2) * 0.62 + Math.cos(driftAngle) * -wobbleB * 0.35;
    const y3 = y2 + (y4 - y2) * 0.62 + Math.sin(driftAngle) * -wobbleB * 0.35;

    gsap.set(wrap, {
      xPercent: -50,
      yPercent: -50,
      x: 0,
      y: 0,
      scale: 0,
      opacity: 0,
      rotation: rotateStart,
      visibility: 'visible',
      force3D: true
    });
    gsap.set(img, {
      xPercent: 0,
      yPercent: 0,
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      skewX: 0,
      rotation: 0,
      force3D: true
    });

    const tl = trackTimeline({ delay });
    const twinkleLow = baseOpacity * (0.38 + Math.random() * 0.22);
    const twinkleHigh = blinkOpacity;

    tl.to(wrap, {
      opacity: twinkleHigh,
      scale: baseScale * (1.04 + Math.random() * 0.06),
      x: dirX * 14,
      y: dirY * 14,
      rotation: rotateOut,
      duration: launchDuration * speedScale,
      ease: 'none'
    });
    tl.to(wrap, {
      keyframes: [
        { x: x1, y: y1, opacity: twinkleHigh, rotation: rotateOut + (Math.random() - 0.5) * 18, scale: baseScale * 0.92 },
        { x: x2, y: y2, opacity: twinkleHigh, rotation: rotateOut + (Math.random() - 0.5) * 28, scale: baseScale * 1.02 },
        { x: x3, y: y3, opacity: twinkleLow, rotation: rotateOut + (Math.random() - 0.5) * 24, scale: baseScale * 0.92 },
        { x: x4, y: y4, opacity: 0, rotation: rotateOut + (Math.random() - 0.5) * 28, scale: baseScale * 0.72 }
      ],
      duration: travelDuration * speedScale,
      ease: 'sine.inOut',
      onComplete: () => {
        try { gsap.set(wrap, { visibility: 'hidden', opacity: 0 }); } catch {}
      }
    });
    starTimelines.push(tl);

    if (flagWave) {
      const phaseDelay = delay + Math.random() * 0.16;
      const waveRepeats = Math.max(1, Math.min(5, Math.round(((launchDuration + travelDuration) * speedScale) / (0.36 * waveDurationScale))));
      const waveTl = trackTimeline({ delay: phaseDelay, repeat: waveRepeats, yoyo: true });
      waveTl.to(img, {
        skewX: (Math.random() > 0.5 ? 1 : -1) * (5 + Math.random() * 5) * waveStrength,
        scaleX: 1 - (0.045 + Math.random() * 0.035) * waveStrength,
        scaleY: 1 + (0.035 + Math.random() * 0.045) * waveStrength,
        rotation: (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 3) * waveStrength,
        x: (Math.random() > 0.5 ? 1 : -1) * (1 + Math.random() * 2) * waveStrength,
        duration: (0.24 + Math.random() * 0.12) * waveDurationScale,
        ease: 'sine.inOut'
      });
      waveTl.to(img, {
        skewX: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        x: 0,
        duration: 0.14 * waveDurationScale,
        ease: 'sine.out'
      });
      waveTimelines.push(waveTl);
    }
  }

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    starTimelines.forEach((tl) => {
      try { tl.kill(); } catch {}
    });
    waveTimelines.forEach((tl) => {
      try { tl.kill(); } catch {}
    });
    activeStars.forEach((img) => {
      try {
        gsap.killTweensOf(img);
        if (img.parentNode) img.parentNode.removeChild(img);
        domElementPool.release(img);
      } catch {}
    });
    activeWraps.forEach((wrap) => {
      try {
        gsap.killTweensOf(wrap);
        wrap.remove();
      } catch {}
    });
    try { field.remove(); } catch {}
  };

  const autoCleanupDelay = Math.max(1.2, maxAnimationTime + 0.45);
  const autoCleanupCall = trackDelayedCall(autoCleanupDelay, cleanup);

  return () => {
    try { autoCleanupCall.kill(); } catch {}
    cleanup();
  };
}
