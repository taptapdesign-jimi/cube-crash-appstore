// @ts-nocheck
// Puffy clouds behind merge-6 text overlays (reuses transition cloud look)

import { gsap } from 'gsap';
import animationManager from './animation-manager.js';
import { domElementPool } from './dom-element-pool.js';

const CLOUD_IMAGES = [
  { base: './assets/board transition/cloud1.png', retina: './assets/board transition/cloud1@2x.png' },
  { base: './assets/board transition/cloud2.png', retina: './assets/board transition/cloud2@2x.png' },
  { base: './assets/board transition/cloud3.png', retina: './assets/board transition/cloud3@2x.png' },
  { base: './assets/board transition/cloud4.png', retina: './assets/board transition/cloud4@2x.png' }
];

function pickCloudSrc(index: number): string {
  const entry = CLOUD_IMAGES[index % CLOUD_IMAGES.length];
  const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
  return dpr >= 2 ? entry.retina : entry.base;
}

const trackTimeline = (options: any = {}) => animationManager.trackExternalTimeline(gsap.timeline(options));
const trackDelayedCall = (...args: any[]) => animationManager.trackExternalTween(gsap.delayedCall(...args));

interface PuffyCloudOptions {
  count?: number;
  zIndex?: number;
}

export function attachPuffyClouds(overlay: HTMLElement, opts: PuffyCloudOptions = {}): () => void {
  if (!overlay) return () => {};
  const count = Math.max(1, Math.min(8, opts.count ?? 5));
  const zIndex = opts.zIndex ?? 1;

  const cloudContainer = document.createElement('div');
  cloudContainer.className = 'cc-text-clouds';
  cloudContainer.style.cssText = [
    'position: absolute',
    'left: 0',
    'top: 0',
    'width: 100%',
    'height: 100%',
    'pointer-events: none',
    `z-index: ${zIndex}`,
    'overflow: hidden'
  ].join(';');
  overlay.appendChild(cloudContainer);

  const activeCloudImages: HTMLImageElement[] = [];
  const cloudTimelines: gsap.core.Timeline[] = [];
  const cloudDelayedCalls: gsap.core.Tween[] = [];

  const viewportW = Math.max(320, window.innerWidth || 390);
  const viewportH = Math.max(520, window.innerHeight || 844);
  const centerX = viewportW * 0.5;
  const centerY = viewportH * 0.5;
  const cloudBasePx = Math.min(240, Math.max(104, viewportW * 0.22));
  const cloudStepPx = Math.max(18, cloudBasePx * 0.18);
  const CLOUD_ASPECT = 1.15;
  const CLOUD_STAGGER = 0.06;
  const CLOUD_ENTER_DURATION = 0.34;
  const CLOUD_SETTLE_DURATION = 0.14;
  const moveDuration = 1.6;
  const windStrength = 0.18;
  const driftDistanceMinPx = viewportW * 0.28;
  const driftDistanceMaxPx = viewportW * 0.5;
  const BOUNCE_REPEAT = 2;

  for (let i = 0; i < count; i++) {
    const sizeBoost = 0.95 + Math.random() * 0.4;
    const cloudSizePx = Math.round((cloudBasePx + (i % 3) * cloudStepPx) * sizeBoost);
    const cloudHeightPx = Math.round(cloudSizePx / CLOUD_ASPECT);
    const baseSize = (0.9 + (i % 3) * 0.08) * Math.min(1.1, 0.98 + sizeBoost * 0.1);
    const rotation = (i % 5 - 2) * 5;
    const bounceAmount = 5 + (i % 3) * 2;
    const bounceSpeed = 0.4 + (i % 4) * 0.08;
    const enterDelay = i * CLOUD_STAGGER;
    const windFactor = 1 + ((Math.random() * 2 - 1) * windStrength);
    const windYOffset = (Math.random() * 2 - 1) * 10;
    const windDuration = (moveDuration * 0.52 + 0.2) * windFactor;
    const driftDistancePx = (driftDistanceMinPx + Math.random() * (driftDistanceMaxPx - driftDistanceMinPx));
    const driftStartDelay = 0.06;

    const fromLeft = i % 2 === 0;
    const sideInset = Math.min(120, viewportW * 0.22);
    const spawnX = fromLeft ? (centerX - sideInset) : (centerX + sideInset);
    const spawnY = centerY + (Math.random() * 2 - 1) * Math.min(110, viewportH * 0.18);

    const cloudImg = domElementPool.acquire('img') as HTMLImageElement;
    cloudImg.src = pickCloudSrc(i);
    cloudImg.className = 'cc-text-cloud';
    cloudImg.alt = '';
    cloudImg.style.cssText = [
      'position: absolute',
      'pointer-events: none',
      'will-change: transform, opacity',
      `width: ${cloudSizePx}px`,
      `height: ${cloudHeightPx}px`,
      'object-fit: contain',
      `max-width: ${Math.round(viewportW * 0.7)}px`,
      `left: ${Math.round(spawnX)}px`,
      `top: ${Math.round(spawnY)}px`,
      'transform-origin: center center'
    ].join(';');

    activeCloudImages.push(cloudImg);
    gsap.set(cloudImg, { xPercent: -50, yPercent: -50, x: 0, y: 0, scale: 0.12, opacity: 0, rotation });

    const bounceTimeline = trackTimeline({ repeat: BOUNCE_REPEAT - 1, delay: enterDelay + 0.5 });
    bounceTimeline.to(cloudImg, { y: `+=${bounceAmount}px`, duration: bounceSpeed / 2, ease: 'sine.out' });
    bounceTimeline.to(cloudImg, { y: `-=${bounceAmount}px`, duration: bounceSpeed / 2, ease: 'sine.in' });
    cloudTimelines.push(bounceTimeline);

    const enterTl = trackTimeline({ delay: enterDelay });
    enterTl.to(cloudImg, {
      opacity: 0.8,
      scale: baseSize * 1.22,
      duration: CLOUD_ENTER_DURATION,
      ease: 'back.out(2.2)'
    });
    enterTl.to(cloudImg, {
      scale: baseSize,
      duration: CLOUD_SETTLE_DURATION,
      ease: 'power2.out'
    }, '>0');
    const toCenterX = centerX - spawnX;
    const approachX = toCenterX * 0.92;
    enterTl.to(
      cloudImg,
      { x: approachX + (fromLeft ? driftDistancePx * 0.15 : -driftDistancePx * 0.15), duration: windDuration, ease: 'sine.inOut' },
      driftStartDelay
    );
    enterTl.to(cloudImg, { y: `+=${windYOffset}px`, duration: windDuration * 0.55, ease: 'sine.inOut' }, driftStartDelay);
    cloudTimelines.push(enterTl);

    const exitStartTime = enterDelay + 0.5 + windDuration * 0.5;
    const delayedCall = trackDelayedCall(exitStartTime, () => {
      if (!activeCloudImages.includes(cloudImg)) return;
      bounceTimeline.kill();
    const exitTl = trackTimeline();
    exitTl.to(cloudImg, { opacity: 0, scale: 0, duration: 0.25, ease: 'power2.in' });
      cloudTimelines.push(exitTl);
    });
    cloudDelayedCalls.push(delayedCall);

    cloudContainer.appendChild(cloudImg);
  }

  return () => {
    cloudDelayedCalls.forEach((dc) => {
      try { dc.kill(); } catch {}
    });
    cloudTimelines.forEach((tl) => {
      try { tl.kill(); } catch {}
    });
    activeCloudImages.forEach((img) => {
      try {
        gsap.killTweensOf(img);
        domElementPool.release(img);
      } catch {}
    });
    try { cloudContainer.remove(); } catch {}
  };
}
