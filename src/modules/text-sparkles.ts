// @ts-nocheck
// Sparkle sprite field behind SPARKLE text overlay (wild-star merge-6)

import { gsap } from 'gsap';
import animationManager from './animation-manager.js';
import { domElementPool } from './dom-element-pool.js';

const trackTimeline = (options: any = {}) => animationManager.trackExternalTimeline(gsap.timeline(options));

const SPARKLE_IMAGES = [
  './assets/animations/sparkle1.png',
  './assets/animations/sparkle2.png',
  './assets/animations/sparkle3.png'
];

interface SparkleFieldOptions {
  count?: number;
  zIndex?: number;
}

function sparkleSrc(index: number): string {
  return SPARKLE_IMAGES[index % SPARKLE_IMAGES.length];
}

export function attachSparkleSprites(overlay: HTMLElement, opts: SparkleFieldOptions = {}): () => void {
  if (!overlay) return () => {};

  const count = Math.max(8, Math.min(48, opts.count ?? 25));
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
  const centerX = viewportW * 0.5;
  const centerY = viewportH * 0.5;

  const activeSprites: HTMLImageElement[] = [];
  const sparkleTimelines: gsap.core.Timeline[] = [];

  for (let i = 0; i < count; i++) {
    const img = domElementPool.acquire('img') as HTMLImageElement;
    img.src = sparkleSrc(i);
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
      'transform-origin: center center',
      'mix-blend-mode: screen'
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
