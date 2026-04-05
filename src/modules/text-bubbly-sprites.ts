// @ts-nocheck
// Bubble sprite field for BUBBLY overlay (wild-juice merge-6)

import { gsap } from 'gsap';
import animationManager from './animation-manager.js';
import { domElementPool } from './dom-element-pool.js';

const trackTimeline = (options: any = {}) => animationManager.trackExternalTimeline(gsap.timeline(options));

const BUBBLE_IMAGES = [
  './assets/animations/bubble1.png',
  './assets/animations/bubble2.png',
  './assets/animations/bubble3.png',
  './assets/animations/bubble4.png',
  './assets/animations/bubble5.png',
  './assets/animations/bubble6.png',
  './assets/animations/bubble7.png',
  './assets/animations/bubble8.png'
];

interface BubbleFieldOptions {
  count?: number;
  zIndex?: number;
}

function bubbleSrc(index: number): string {
  return BUBBLE_IMAGES[index % BUBBLE_IMAGES.length];
}

export function attachBubblySprites(overlay: HTMLElement, opts: BubbleFieldOptions = {}): () => void {
  if (!overlay) return () => {};

  const count = Math.max(10, Math.min(40, opts.count ?? 22));
  const zIndex = opts.zIndex ?? 1;

  const field = document.createElement('div');
  field.className = 'cc-text-bubbly-sprites';
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
  const centerY = viewportH * 0.56;

  const sprites: HTMLImageElement[] = [];
  const timelines: gsap.core.Timeline[] = [];

  for (let i = 0; i < count; i++) {
    const img = domElementPool.acquire('img') as HTMLImageElement;
    img.src = bubbleSrc(i);
    img.alt = '';
    img.className = 'cc-bubbly-sprite';

    const ring = i % 3;
    const baseRadiusX = ring === 0 ? viewportW * 0.14 : ring === 1 ? viewportW * 0.24 : viewportW * 0.33;
    const baseRadiusY = ring === 0 ? viewportH * 0.07 : ring === 1 ? viewportH * 0.11 : viewportH * 0.16;
    const theta = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
    const x = centerX + Math.cos(theta) * baseRadiusX + (Math.random() - 0.5) * 34;
    const y = centerY + Math.sin(theta) * baseRadiusY + (Math.random() - 0.5) * 28;

    const isBig = i % 6 === 0;
    const size = (isBig
      ? (42 + Math.random() * 20) * 1.25 // bigger bubbles +25%
      : 20 + Math.random() * 18) * 1.3; // +30% on all bubbles

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

    field.appendChild(img);
    sprites.push(img);

    const riseY = 44 + Math.random() * 86;
    const swayX = (Math.random() - 0.5) * 30;
    const startScale = 0.2 + Math.random() * 0.2;
    const bubbleScale = 0.72 + Math.random() * 0.58;
    // Start bubbles ~100ms before text enter.
    const startDelay = Math.max(0, i * 0.028 + Math.random() * 0.2 - 0.1);

    gsap.set(img, {
      xPercent: -50,
      yPercent: -50,
      x: 0,
      y: 0,
      opacity: 0,
      scale: startScale
    });

    // Single compact burst around text (no long looping).
    const tl = trackTimeline({
      delay: startDelay,
      repeat: 0
    });
    const riseDurationA = 0.2 + Math.random() * 0.1;
    const riseDurationB = 0.16 + Math.random() * 0.1;
    const popDurationA = 0.04 + Math.random() * 0.025;
    const popDurationB = 0.035 + Math.random() * 0.02;

    // Burst A
    tl.to(img, {
      opacity: 0.6 + Math.random() * 0.28,
      scale: bubbleScale,
      duration: 0.12 + Math.random() * 0.06,
      ease: 'power2.out'
    });
    tl.to(img, {
      y: -riseY,
      x: swayX,
      opacity: 0.5 + Math.random() * 0.3,
      duration: riseDurationA,
      ease: 'sine.out'
    });
    tl.to(img, {
      y: `-=${8 + Math.random() * 14}`,
      x: `+=${(Math.random() - 0.5) * 18}`,
      opacity: 0.35 + Math.random() * 0.2,
      duration: 0.12 + Math.random() * 0.08,
      ease: 'power1.out'
    });
    tl.to(img, {
      // "Pop": quick scale bump + immediate fade to 0
      scale: bubbleScale * (1.12 + Math.random() * 0.12),
      opacity: 0,
      duration: popDurationA,
      ease: 'power1.in'
    });

    // Short overlap inside same one-shot burst.
    tl.set(img, { y: 0, x: 0, scale: startScale, opacity: 0 });
    tl.to(img, {
      opacity: 0.58 + Math.random() * 0.26,
      scale: bubbleScale * (0.92 + Math.random() * 0.14),
      duration: 0.1 + Math.random() * 0.05,
      ease: 'power2.out'
    }, '-=0.06');
    tl.to(img, {
      y: -(riseY * (0.78 + Math.random() * 0.26)),
      x: swayX * (0.65 + Math.random() * 0.45),
      opacity: 0.45 + Math.random() * 0.28,
      duration: riseDurationB,
      ease: 'sine.out'
    });
    tl.to(img, {
      scale: bubbleScale * (1.06 + Math.random() * 0.1),
      opacity: 0,
      duration: popDurationB,
      ease: 'power1.in'
    });
    tl.set(img, { y: 0, x: 0, scale: startScale, opacity: 0 });
    timelines.push(tl);
  }

  return () => {
    timelines.forEach((tl) => {
      try { tl.kill(); } catch {}
    });
    sprites.forEach((img) => {
      try {
        gsap.killTweensOf(img);
        domElementPool.release(img);
      } catch {}
    });
    try { field.remove(); } catch {}
  };
}
