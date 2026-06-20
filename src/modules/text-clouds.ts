// @ts-nocheck
// Puffy clouds behind merge-6 text overlays (reuses transition cloud look)

import { gsap } from 'gsap';
import animationManager from './animation-manager.js';
import { domElementPool } from './dom-element-pool.js';

const CLOUD_IMAGES = [
  { base: './assets/board transition/oblak+srednji.png', retina: './assets/board transition/oblak+srednji.png' },
  { base: './assets/board transition/oblak mali desno.png', retina: './assets/board transition/oblak mali desno.png' },
  { base: './assets/board transition/oblak mali ljevo.png', retina: './assets/board transition/oblak mali ljevo.png' },
  { base: './assets/board transition/oblak veliki ljevo dole.png', retina: './assets/board transition/oblak veliki ljevo dole.png' }
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
  autoExit?: boolean;
  timingScale?: number;
  floatBounce?: boolean;
  onAutoExitComplete?: () => void;
}

export function attachPuffyClouds(overlay: HTMLElement, opts: PuffyCloudOptions = {}): () => void {
  if (!overlay) return () => {};
  const count = Math.max(1, Math.min(8, opts.count ?? 5));
  const zIndex = opts.zIndex ?? 1;
  const autoExit = opts.autoExit ?? true;
  const timingScale = Math.max(0.35, Math.min(1.5, opts.timingScale ?? 1));
  const floatBounce = opts.floatBounce ?? true;

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
  let exitStarted = false;
  let autoExitCompleteCount = 0;
  let autoExitCallbackFired = false;

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
  const driftDistanceMinPx = viewportW * 0.32;
  const driftDistanceMaxPx = viewportW * 0.62;
  const BOUNCE_REPEAT = 2;
  const notifyAutoExitComplete = () => {
    if (!autoExit || autoExitCallbackFired || autoExitCompleteCount < count) return;
    autoExitCallbackFired = true;
    try { opts.onAutoExitComplete?.(); } catch {}
  };

  for (let i = 0; i < count; i++) {
    const sizeBoost = 0.95 + Math.random() * 0.4;
    const cloudSizePx = Math.round((cloudBasePx + (i % 3) * cloudStepPx) * sizeBoost);
    const cloudHeightPx = Math.round(cloudSizePx / CLOUD_ASPECT);
    const baseSize = (0.9 + (i % 3) * 0.08) * Math.min(1.1, 0.98 + sizeBoost * 0.1);
    const rotation = (i % 5 - 2) * 5;
    const bounceAmount = 5 + (i % 3) * 2;
    const bounceSpeed = 0.4 + (i % 4) * 0.08;
    const enterDelay = i * CLOUD_STAGGER * timingScale;
    const windFactor = 1 + ((Math.random() * 2 - 1) * windStrength);
    const windYOffset = (Math.random() * 2 - 1) * 10;
    const windDuration = (moveDuration * 0.52 + 0.2) * windFactor * timingScale;
    const driftDistancePx = (driftDistanceMinPx + Math.random() * (driftDistanceMaxPx - driftDistanceMinPx));
    const driftStartDelay = 0.06 * timingScale;

    const fromLeft = i % 2 === 0;
    const spawnX = centerX + (Math.random() * 2 - 1) * Math.min(26, viewportW * 0.04);
    const spawnY = centerY + (Math.random() * 2 - 1) * Math.min(90, viewportH * 0.15);

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

    const bounceTimeline = floatBounce ? trackTimeline({ repeat: BOUNCE_REPEAT - 1, delay: enterDelay + 0.5 * timingScale }) : null;
    if (bounceTimeline) {
      bounceTimeline.to(cloudImg, { y: `+=${bounceAmount}px`, duration: bounceSpeed * timingScale / 2, ease: 'sine.out' });
      bounceTimeline.to(cloudImg, { y: `-=${bounceAmount}px`, duration: bounceSpeed * timingScale / 2, ease: 'sine.in' });
      cloudTimelines.push(bounceTimeline);
    }

    const enterTl = trackTimeline({ delay: enterDelay });
    enterTl.to(cloudImg, {
      opacity: 0.8,
      scale: baseSize * 1.22,
      duration: CLOUD_ENTER_DURATION * timingScale,
      ease: 'back.out(2.2)'
    });
    enterTl.to(cloudImg, {
      scale: baseSize,
      duration: CLOUD_SETTLE_DURATION * timingScale,
      ease: 'power2.out'
    }, '>0');
    const pushX = fromLeft ? -driftDistancePx : driftDistancePx;
    enterTl.to(
      cloudImg,
      { x: pushX, duration: windDuration, ease: 'sine.inOut' },
      driftStartDelay
    );
    enterTl.to(cloudImg, { y: `+=${windYOffset}px`, duration: windDuration * 0.55, ease: 'sine.inOut' }, driftStartDelay);
    cloudTimelines.push(enterTl);

    const startCloudExit = () => {
      if (!activeCloudImages.includes(cloudImg)) return;
      try { bounceTimeline?.kill(); } catch {}
      const exitTl = trackTimeline();
      exitTl.to(cloudImg, {
        opacity: Math.min(0.88, gsap.getProperty(cloudImg, 'opacity') as number || 0.8),
        scale: baseSize * 1.14,
        duration: 0.14 * timingScale,
        ease: 'back.out(2.0)'
      });
      exitTl.to(cloudImg, {
        opacity: 0,
        scale: 0,
        duration: 0.34 * timingScale,
        ease: 'back.in(1.55)',
        onComplete: () => {
          autoExitCompleteCount += 1;
          notifyAutoExitComplete();
        }
      });
      cloudTimelines.push(exitTl);
    };

    const exitStartTime = enterDelay + driftStartDelay + windDuration + 0.05 * timingScale;
    if (autoExit) {
      const delayedCall = trackDelayedCall(exitStartTime, startCloudExit);
      cloudDelayedCalls.push(delayedCall);
    }

    cloudContainer.appendChild(cloudImg);
  }

  const cleanup = () => {
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

  (cleanup as any).startExit = () => {
    if (exitStarted) return;
    exitStarted = true;
    cloudDelayedCalls.forEach((dc) => {
      try { dc.kill(); } catch {}
    });
    activeCloudImages.forEach((img, index) => {
      try {
        gsap.killTweensOf(img);
        const currentScale = Number(gsap.getProperty(img, 'scale')) || 1;
        const exitTl = trackTimeline({ delay: index * 0.045 });
        cloudTimelines.push(exitTl);
        exitTl.to(img, {
          opacity: Math.max(0.55, Number(gsap.getProperty(img, 'opacity')) || 0.8),
          scale: currentScale * 1.16,
          duration: 0.15 * timingScale,
          ease: 'back.out(2.1)'
        });
        exitTl.to(img, {
          opacity: 0,
          scale: 0,
          duration: 0.38 * timingScale,
          ease: 'back.in(1.55)'
        });
      } catch {}
    });
  };

  return cleanup;
}
