// @ts-nocheck
// Electric bolt sprite field for SWOOP (wild-magnet merge-6)

import { gsap } from 'gsap';
import animationManager from './animation-manager.js';
import { domElementPool } from './dom-element-pool.js';

const trackTimeline = (options: any = {}) => animationManager.trackExternalTimeline(gsap.timeline(options));

const BOLT_IMAGES = [
  './assets/animations/bolt1.png',
  './assets/animations/bolt2.png',
  './assets/animations/bolt3.png',
  './assets/animations/bolt4.png',
  './assets/animations/bolt5.png',
  './assets/animations/bolt6.png',
  './assets/animations/bolt7.png',
  './assets/animations/bolt8.png',
];

interface BoltFieldOptions {
  count?: number;
  zIndex?: number;
}

function boltSrc(index: number): string {
  return BOLT_IMAGES[index % BOLT_IMAGES.length];
}

export function attachBoltSprites(overlay: HTMLElement, opts: BoltFieldOptions = {}): () => void {
  if (!overlay) return () => {};

  const count = Math.max(8, Math.min(28, opts.count ?? 16));
  const zIndex = opts.zIndex ?? 1;

  const field = document.createElement('div');
  field.className = 'cc-text-bolts';
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
  const jitterBoost = 1.3; // +30% nervous shake

  const activeSprites: HTMLImageElement[] = [];
  const boltTimelines: gsap.core.Timeline[] = [];

  for (let i = 0; i < count; i++) {
    const img = domElementPool.acquire('img') as HTMLImageElement;
    img.src = boltSrc(i);
    img.alt = '';
    img.className = 'cc-bolt-sprite';

    const ring = i % 3;
    const baseRadiusX = ring === 0 ? viewportW * 0.24 : ring === 1 ? viewportW * 0.36 : viewportW * 0.5;
    const baseRadiusY = baseRadiusX * 0.62;
    const theta = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.75;
    const radiusJitter = 0.82 + Math.random() * 0.42;
    const x = centerX + Math.cos(theta) * baseRadiusX * radiusJitter + (Math.random() - 0.5) * 60;
    const y = centerY + Math.sin(theta) * baseRadiusY * radiusJitter + (Math.random() - 0.5) * 46;

    const isLarge = i % 5 === 0;
    const size = isLarge ? 110 + Math.random() * 52 : 64 + Math.random() * 40;

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
      'mix-blend-mode: screen',
      'filter: drop-shadow(0 0 12px rgba(255, 200, 140, 0.35))'
    ].join(';');

    activeSprites.push(img);
    field.appendChild(img);

    const outwardDx = x - centerX;
    const outwardDy = y - centerY;
    const outwardLen = Math.max(1, Math.hypot(outwardDx, outwardDy));
    const outwardX = outwardDx / outwardLen;
    const outwardY = outwardDy / outwardLen;

    const horizontalSign = (i % 2 === 0 ? -1 : 1) * (Math.random() < 0.5 ? 1 : -1);
    const moveOut = 54 + Math.random() * 90;
    const lateralSplit = (22 + Math.random() * 34) * horizontalSign;
    const driftX = outwardX * moveOut + lateralSplit + (Math.random() - 0.5) * 14;
    const driftY = outwardY * (moveOut * 0.78) + (Math.random() - 0.5) * 11;

    const jitterX = (4 + Math.random() * 8) * jitterBoost;
    const jitterY = (3 + Math.random() * 7) * jitterBoost;
    const baseScale = 0.72 + Math.random() * 0.55;
    const rotateStart = (Math.random() - 0.5) * 52;
    const rotateJitterA = (Math.random() - 0.5) * 20 * jitterBoost;
    const rotateJitterB = (Math.random() - 0.5) * 22 * jitterBoost;
    const rotateDrift = (Math.random() - 0.5) * 28;
    const flashOpacity = 0.55 + Math.random() * 0.35;

    gsap.set(img, {
      xPercent: -50,
      yPercent: -50,
      x: 0,
      y: 0,
      opacity: 0,
      scale: 0.2,
      rotation: rotateStart
    });

    // "Nervous" electric jitter + random strobe fade in/out + outward drift.
    const tl = trackTimeline({
      delay: i * 0.04 + Math.random() * 0.2,
      repeat: -1,
      repeatDelay: 0.08 + Math.random() * 0.25
    });
    tl.to(img, {
      opacity: flashOpacity,
      scale: baseScale * (1.0 + Math.random() * 0.15),
      x: driftX * 0.35,
      y: driftY * 0.35,
      duration: 0.09 + Math.random() * 0.05,
      ease: 'power2.out'
    });
    tl.to(img, {
      x: `+=${(Math.random() < 0.5 ? -1 : 1) * jitterX}`,
      y: `+=${(Math.random() < 0.5 ? -1 : 1) * jitterY}`,
      rotation: `+=${rotateJitterA}`,
      opacity: flashOpacity * (0.6 + Math.random() * 0.3),
      duration: 0.05 + Math.random() * 0.05,
      ease: 'none'
    });
    tl.to(img, {
      x: `+=${(Math.random() < 0.5 ? -1 : 1) * jitterX * 0.8}`,
      y: `+=${(Math.random() < 0.5 ? -1 : 1) * jitterY * 0.8}`,
      rotation: `-=${rotateJitterB}`,
      opacity: flashOpacity * (0.45 + Math.random() * 0.25),
      duration: 0.04 + Math.random() * 0.04,
      ease: 'none'
    });
    tl.to(img, {
      opacity: 0,
      scale: baseScale * 0.65,
      x: driftX,
      y: driftY,
      rotation: rotateStart + rotateDrift,
      duration: 0.12 + Math.random() * 0.08,
      ease: 'power2.in'
    });
    boltTimelines.push(tl);
  }

  return () => {
    boltTimelines.forEach((tl) => {
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
