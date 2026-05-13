// @ts-nocheck
// Sparkle sprite field behind SPARKLE text overlay (wild-star merge-6)

import { gsap } from 'gsap';
import animationManager from './animation-manager.js';
import { domElementPool } from './dom-element-pool.js';

const trackTimeline = (options: any = {}) => animationManager.trackExternalTimeline(gsap.timeline(options));

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
}

function sparkleSrc(index: number): string {
  return SPARKLE_IMAGES[index % SPARKLE_IMAGES.length];
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
  const starTimelines: gsap.core.Timeline[] = [];

  for (let i = 0; i < count; i++) {
    const img = domElementPool.acquire('img') as HTMLImageElement;
    img.src = sparkleSrc(i);
    img.alt = '';
    img.className = 'cc-sparkle-burst-sprite';

    const side = i % 2 === 0 ? -1 : 1;
    const laneOffset = 26 + Math.random() * Math.min(110, viewportW * 0.24);
    const birthX = originX + side * laneOffset + (Math.random() - 0.5) * 44;
    const birthY = originY + (Math.random() - 0.5) * Math.min(170, viewportH * 0.2);
    const angle = side < 0
      ? Math.PI + (Math.random() - 0.5) * 0.72
      : (Math.random() - 0.5) * 0.72;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const spreadDistance = Math.min(Math.max(viewportW, viewportH) * (0.38 + Math.random() * 0.28), 500 + Math.random() * 190);
    const midDistanceA = spreadDistance * (0.22 + Math.random() * 0.08);
    const midDistanceB = spreadDistance * (0.54 + Math.random() * 0.1);
    const birthProgress = count <= 1 ? 0 : i / (count - 1);
    const lateSizeScale = 1 - birthProgress * 0.24;
    const size = (26 + Math.random() * 42) * lateSizeScale;
    const baseScale = 0.85 + Math.random() * 0.5;
    const baseOpacity = 0.42 + Math.random() * 0.58;
    const blinkOpacity = Math.min(1, baseOpacity + 0.22 + Math.random() * 0.28);
    const rotateStart = (Math.random() * 360) - 180;
    const rotateOut = rotateStart + (Math.random() - 0.5) * 38;
    const delay = Math.min(1.35, i * (1.3 / Math.max(1, count - 1)) + Math.random() * 0.05);
    const isFastStar = Math.random() < 0.55;
    const launchDuration = isFastStar ? 0.04 + Math.random() * 0.02 : 0.06 + Math.random() * 0.025;
    const travelDuration = isFastStar ? 0.58 + Math.random() * 0.18 : 0.78 + Math.random() * 0.24;

    img.style.cssText = [
      'position: absolute',
      'pointer-events: none',
      'will-change: transform, opacity',
      `left: ${Math.round(birthX)}px`,
      `top: ${Math.round(birthY)}px`,
      `width: ${Math.round(size)}px`,
      `height: ${Math.round(size)}px`,
      'object-fit: contain',
      'transform-origin: center center',
      'mix-blend-mode: screen'
    ].join(';');

    field.appendChild(img);
    activeStars.push(img);

    const driftAngle = angle + Math.PI / 2;
    const wobbleA = (Math.random() > 0.5 ? 1 : -1) * (18 + Math.random() * 34);
    const wobbleB = -wobbleA * (0.45 + Math.random() * 0.35);
    const x1 = dirX * midDistanceA + Math.cos(driftAngle) * wobbleA;
    const y1 = dirY * midDistanceA + Math.sin(driftAngle) * wobbleA;
    const x2 = dirX * midDistanceB + Math.cos(driftAngle) * wobbleB;
    const y2 = dirY * midDistanceB + Math.sin(driftAngle) * wobbleB;
    const exitDistance = Math.hypot(viewportW * 0.5, viewportH * 0.5) + size + 110 + Math.random() * 110;
    const x4 = dirX * exitDistance + Math.cos(driftAngle) * ((Math.random() - 0.5) * 70);
    const y4 = dirY * exitDistance + Math.sin(driftAngle) * ((Math.random() - 0.5) * 70);

    gsap.set(img, {
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

    const tl = trackTimeline({ delay });
    const twinkleLow = baseOpacity * (0.38 + Math.random() * 0.22);
    const twinkleHigh = blinkOpacity;

    tl.to(img, {
      opacity: twinkleHigh,
      scale: baseScale * (1.04 + Math.random() * 0.06),
      x: dirX * 18,
      y: dirY * 18,
      rotation: rotateOut,
      duration: launchDuration,
      ease: 'power1.in'
    });
    tl.to(img, {
      keyframes: [
        { x: x1, y: y1, opacity: twinkleHigh, rotation: rotateOut + (Math.random() - 0.5) * 18, scale: baseScale * 0.92 },
        { x: x2, y: y2, opacity: twinkleHigh, rotation: rotateOut + (Math.random() - 0.5) * 28, scale: baseScale * 1.02 },
        { x: x4 * 0.9, y: y4 * 0.9, opacity: twinkleLow, rotation: rotateOut + (Math.random() - 0.5) * 34, scale: baseScale * 0.84 },
        { x: x4, y: y4, opacity: 0, rotation: rotateOut + (Math.random() - 0.5) * 36, scale: baseScale * 0.72 }
      ],
      duration: travelDuration,
      ease: 'none',
      onComplete: () => {
        try { gsap.set(img, { visibility: 'hidden', opacity: 0 }); } catch {}
      }
    });
    starTimelines.push(tl);
  }

  return () => {
    starTimelines.forEach((tl) => {
      try { tl.kill(); } catch {}
    });
    activeStars.forEach((img) => {
      try {
        gsap.killTweensOf(img);
        domElementPool.release(img);
      } catch {}
    });
    try { field.remove(); } catch {}
  };
}
