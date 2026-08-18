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

interface SmallStarBurstOptions {
  count?: number;
  zIndex?: number;
  origin?: { x: number; y: number } | null;
  sources?: string[];
  motion?: {
    speedScale?: number;
    gravityFall?: boolean;
    flagWave?: boolean;
    sizeBoostChance?: number;
    sizeBoostMax?: number;
    baseSizeScale?: number;
    staggerSpanScale?: number;
    waveStrength?: number;
    waveDurationScale?: number;
    mixBlendMode?: string;
  };
}

function sparkleSrc(index: number, sources?: string[]): string {
  const list = Array.isArray(sources) && sources.length ? sources : SPARKLE_IMAGES;
  return list[index % list.length];
}

export function attachSmallStarCenterBurst(overlay: HTMLElement, opts: SmallStarBurstOptions = {}): () => void {
  if (!overlay) return () => {};

  const count = Math.max(4, Math.min(40, opts.count ?? 20));
  const zIndex = opts.zIndex ?? 2;
  const motion = opts.motion || {};
  const speedScale = Number.isFinite(motion.speedScale)
    ? Math.max(0.35, Math.min(3.5, Number(motion.speedScale)))
    : 1;
  const gravityFall = motion.gravityFall === true;
  const flagWave = !gravityFall && motion.flagWave === true;
  const waveDurationScale = Number.isFinite(motion.waveDurationScale)
    ? Math.max(0.5, Math.min(2.4, Number(motion.waveDurationScale)))
    : 1;
  const sizeBoostChance = Number.isFinite(motion.sizeBoostChance)
    ? Math.max(0, Math.min(1, Number(motion.sizeBoostChance)))
    : 0;
  const sizeBoostMax = Number.isFinite(motion.sizeBoostMax)
    ? Math.max(1, Math.min(1.6, Number(motion.sizeBoostMax)))
    : 1;
  const baseSizeScale = Number.isFinite(motion.baseSizeScale)
    ? Math.max(0.5, Math.min(2, Number(motion.baseSizeScale)))
    : 1;
  const staggerSpanScale = Number.isFinite(motion.staggerSpanScale)
    ? Math.max(0.05, Math.min(2, Number(motion.staggerSpanScale)))
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
    const birthX = gravityFall
      ? viewportW * (0.07 + Math.random() * 0.86)
      : originX + dirX * laneOffset + (Math.random() - 0.5) * 36;
    const birthY = gravityFall
      ? originY + (Math.random() - 0.5) * Math.min(150, viewportH * 0.18)
      : originY + dirY * laneOffset + (Math.random() - 0.5) * 36;
    const spreadDistance = Math.min(Math.max(viewportW, viewportH) * (0.38 + Math.random() * 0.28), 500 + Math.random() * 190);
    const midDistanceA = spreadDistance * (0.22 + Math.random() * 0.08);
    const midDistanceB = spreadDistance * (0.54 + Math.random() * 0.1);
    const birthProgress = count <= 1 ? 0 : i / (count - 1);
    const lateSizeScale = 1 - birthProgress * 0.24;
    const boostRoll = Math.random();
    const sizeBoost = boostRoll < sizeBoostChance
      ? 1 + Math.random() * (sizeBoostMax - 1)
      : 1;
    const size = (26 + Math.random() * 42)
      * lateSizeScale
      * sizeBoost
      * baseSizeScale;
    const baseScale = gravityFall ? 1 : 0.85 + Math.random() * 0.5;
    const baseOpacity = 0.42 + Math.random() * 0.58;
    const blinkOpacity = Math.min(1, baseOpacity + 0.22 + Math.random() * 0.28);
    const rotateStart = (Math.random() * 360) - 180;
    const rotateOut = rotateStart + (Math.random() - 0.5) * 28;
    const delay = gravityFall
      ? 0
      : Math.min(
        1.35 * staggerSpanScale,
        (i * (1.3 / Math.max(1, count - 1)) + Math.random() * 0.05) * staggerSpanScale,
      );
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
      scale: gravityFall ? 1 : 0,
      opacity: gravityFall ? 1 : 0,
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

    if (gravityFall) {
      const fallSide = Math.random() < 0.5 ? -1 : 1;
      const horizontalScatter = fallSide * (viewportW * (0.28 + Math.random() * 0.34));
      const fallExitY = viewportH - birthY + size * 1.7 + 120;
      const gravityDuration = (0.92 + Math.random() * 0.18) * speedScale;
      maxAnimationTime = Math.max(maxAnimationTime, gravityDuration);
      tl.to(wrap, {
        keyframes: [
          { x: horizontalScatter * 0.18, y: 24, opacity: 1, rotation: rotateOut + fallSide * 12, scale: 1.08 },
          { x: horizontalScatter * 0.46, y: fallExitY * 0.18, opacity: 1, rotation: rotateOut + fallSide * 36, scale: 1.22 },
          { x: horizontalScatter * 0.76, y: fallExitY * 0.52, opacity: 1, rotation: rotateOut + fallSide * 74, scale: 1.46 },
          { x: horizontalScatter, y: fallExitY, opacity: 1, rotation: rotateOut + fallSide * 118, scale: 1.7 },
        ],
        duration: gravityDuration,
        ease: 'power2.in',
        onComplete: () => {
          try { gsap.set(wrap, { visibility: 'hidden' }); } catch {}
        },
      });
    } else {
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
    }
    starTimelines.push(tl);

    if (flagWave) {
      const phaseDelay = delay + Math.random() * 0.16;
      const visualLifetime = (launchDuration + travelDuration) * speedScale;
      const waveRepeats = Math.max(1, Math.min(7, Math.round(visualLifetime / (0.36 * waveDurationScale))));
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
    starTimelines.forEach((tl) => animationManager.killExternalTimeline(tl));
    waveTimelines.forEach((tl) => animationManager.killExternalTimeline(tl));
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

  const cleanupOwner = () => {
    animationManager.killExternalTween(autoCleanupCall);
    cleanup();
  };
  // Publish the real child lifetime so the parent never truncates staggered particles.
  (cleanupOwner as any).completionDelaySeconds = autoCleanupDelay;
  return cleanupOwner;
}
