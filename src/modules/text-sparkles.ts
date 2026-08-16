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
    gravityFall?: boolean;
    bottleScatter?: boolean;
    flagWave?: boolean;
    sizeBoostChance?: number;
    sizeBoostMax?: number;
    baseSizeScale?: number;
    staggerSpanScale?: number;
    waveTimes?: number[];
    depthLayered?: boolean;
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
  const gravityFall = motion.gravityFall === true;
  const bottleScatter = motion.bottleScatter === true;
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
  const activeBottleBubbles: HTMLElement[] = [];
  const starTimelines: gsap.core.Timeline[] = [];
  const waveTimelines: gsap.core.Timeline[] = [];
  let maxAnimationTime = 0;

  for (let i = 0; i < count; i++) {
    const wrap = document.createElement('div');
    const img = domElementPool.acquire('img') as HTMLImageElement;
    img.src = sparkleSrc(i, opts.sources);
    const isBottleGlass = bottleScatter && /\/glass\d+(?:@2x)?\.png$/i.test(img.src);
    const isBottlePaper = bottleScatter && /\/paper\d+(?:@2x)?\.png$/i.test(img.src);
    img.alt = '';
    img.className = 'cc-sparkle-burst-sprite';

    const radialProgress = (i / Math.max(1, count)) * Math.PI * 2;
    const angle = radialProgress + (Math.random() - 0.5) * 0.95;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const laneOffset = bottleScatter
      ? 18 + Math.random() * Math.min(52, viewportW * 0.14)
      : 28 + Math.random() * Math.min(105, viewportW * 0.22);
    const birthX = bottleScatter
      ? originX + dirX * laneOffset
      : gravityFall
      ? viewportW * (0.07 + Math.random() * 0.86)
      : originX + dirX * laneOffset + (Math.random() - 0.5) * 36;
    const birthY = bottleScatter
      ? originY + dirY * laneOffset
      : gravityFall
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
      * (bottleScatter ? 1 : lateSizeScale)
      * sizeBoost
      * baseSizeScale;
    const baseScale = (gravityFall || bottleScatter) ? 1 : 0.85 + Math.random() * 0.5;
    const baseOpacity = 0.42 + Math.random() * 0.58;
    const blinkOpacity = Math.min(1, baseOpacity + 0.22 + Math.random() * 0.28);
    const rotateStart = (Math.random() * 360) - 180;
    const rotateOut = rotateStart + (Math.random() - 0.5) * 28;
    const delay = bottleScatter
      ? 0
      : gravityFall
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
      scale: (gravityFall || bottleScatter) ? 1 : 0,
      opacity: (gravityFall || bottleScatter) ? 1 : 0,
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

    let bottlePaperVisualLifetime = 0;
    if (bottleScatter) {
      const rotationTravel = (Math.random() < 0.5 ? -1 : 1)
        * (isBottleGlass ? 150 + Math.random() * 310 : (50 + Math.random() * 120) * 1.6);
      if (isBottleGlass) {
        const glassLaunchDirections = [
          { x: -0.9, y: -1 },
          { x: 0, y: -1 },
          { x: 0.9, y: -1 },
        ];
        const glassLandingDirections = [-1, -0.55, 0, 0.55, 1];
        const launchDirection = glassLaunchDirections[Math.floor(Math.random() * glassLaunchDirections.length)];
        const landingDirection = glassLandingDirections[Math.floor(Math.random() * glassLandingDirections.length)];
        const horizontalExit = landingDirection * (viewportW * (0.22 + Math.random() * 0.2) + size * 2 + 100)
          + (Math.random() - 0.5) * viewportW * 0.14;
        const fallExit = viewportH - birthY + size * 2 + 250;
        const launchX = launchDirection.x * (55 + Math.random() * 65);
        const launchY = -(70 + Math.random() * 70);
        const glassLaunchDuration = (0.16 + Math.random() * 0.22) * speedScale;
        const glassFallDuration = (0.72 + Math.random() * 0.68) * speedScale;
        maxAnimationTime = Math.max(maxAnimationTime, delay + glassLaunchDuration + glassFallDuration);
        tl.to(wrap, {
          keyframes: [
            {
              x: launchX,
              y: launchY,
              opacity: 1,
              rotation: rotateStart + rotationTravel * 0.25,
              scale: 1.12,
              duration: glassLaunchDuration,
              ease: 'power2.out',
            },
            {
              x: horizontalExit + launchX * 0.35,
              y: fallExit,
              opacity: 1,
              rotation: rotateStart + rotationTravel,
              scale: 2,
              duration: glassFallDuration,
              ease: 'power2.in',
            },
          ],
          onComplete: () => {
            try { gsap.set(wrap, { visibility: 'hidden' }); } catch {}
          },
        });
      } else {
        const centrifugalDirection = Math.random() < 0.5 ? -1 : 1;
        const paperExitAngle = Math.random() * Math.PI * 2;
        const paperExitRadius = Math.min(viewportW, viewportH) * (0.34 + Math.random() * 0.2);
        const paperLaunchAngle = paperExitAngle - centrifugalDirection * (0.72 + Math.random() * 0.42);
        const paperLaunchRadius = 30 + Math.random() * 55;
        const paperLaunchX = Math.cos(paperLaunchAngle) * paperLaunchRadius;
        const paperLaunchY = Math.sin(paperLaunchAngle) * paperLaunchRadius;
        const targetX = Math.cos(paperExitAngle) * paperExitRadius;
        const targetY = Math.sin(paperExitAngle) * paperExitRadius;
        const paperWindA = centrifugalDirection * (45 + Math.random() * 55);
        const paperWindB = -centrifugalDirection * (55 + Math.random() * 65);
        const paperWindC = centrifugalDirection * (40 + Math.random() * 50);
        const tangentX = -Math.sin(paperExitAngle);
        const tangentY = Math.cos(paperExitAngle);
        const paperLaunchTime = (0.1 + Math.random() * 0.18) * speedScale;
        const paperTravelTime = (1.05 + Math.random() * 0.85) * speedScale;
        bottlePaperVisualLifetime = paperLaunchTime + paperTravelTime;
        maxAnimationTime = Math.max(maxAnimationTime, delay + paperLaunchTime + paperTravelTime);
        tl.to(wrap, {
          x: paperLaunchX,
          y: paperLaunchY,
          opacity: 1,
          rotation: rotateStart + rotationTravel * 0.16,
          scale: 1,
          duration: paperLaunchTime,
          ease: 'power2.out',
        });
        tl.to(wrap, {
          keyframes: [
            { x: paperLaunchX + (targetX - paperLaunchX) * 0.22 + tangentX * paperWindA, y: paperLaunchY + (targetY - paperLaunchY) * 0.18 + tangentY * paperWindA, opacity: 1, rotation: rotateStart + rotationTravel * 0.26, scale: 1 },
            { x: paperLaunchX + (targetX - paperLaunchX) * 0.48 + tangentX * paperWindB, y: paperLaunchY + (targetY - paperLaunchY) * 0.43 + tangentY * paperWindB, opacity: 1, rotation: rotateStart + rotationTravel * 0.50, scale: 1 },
            { x: paperLaunchX + (targetX - paperLaunchX) * 0.74 + tangentX * paperWindC, y: paperLaunchY + (targetY - paperLaunchY) * 0.72 + tangentY * paperWindC, opacity: 1, rotation: rotateStart + rotationTravel * 0.76, scale: 1 },
            { x: targetX, y: targetY, opacity: 1, rotation: rotateStart + rotationTravel, scale: 1 },
          ],
          duration: paperTravelTime,
          ease: 'sine.inOut',
          onComplete: () => {
            try { gsap.set(wrap, { visibility: 'hidden' }); } catch {}
          },
        });
      }
    } else if (gravityFall) {
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

    if (flagWave || isBottlePaper) {
      const phaseDelay = delay + Math.random() * 0.16;
      const bottlePaperWaveDurationScale = isBottlePaper ? 1.05 : waveDurationScale;
      const bottlePaperWaveStrength = isBottlePaper ? 1.35 : waveStrength;
      const bottlePaperRotationBoost = isBottlePaper ? 1.6 : 1;
      const visualLifetime = isBottlePaper
        ? bottlePaperVisualLifetime
        : (launchDuration + travelDuration) * speedScale;
      const waveRepeats = Math.max(1, Math.min(7, Math.round(visualLifetime / (0.36 * bottlePaperWaveDurationScale))));
      const waveTl = trackTimeline({ delay: phaseDelay, repeat: waveRepeats, yoyo: true });
      waveTl.to(img, {
        skewX: (Math.random() > 0.5 ? 1 : -1) * (5 + Math.random() * 5) * bottlePaperWaveStrength,
        scaleX: 1 - (0.045 + Math.random() * 0.035) * bottlePaperWaveStrength,
        scaleY: 1 + (0.035 + Math.random() * 0.045) * bottlePaperWaveStrength,
        rotation: (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 3) * bottlePaperWaveStrength * bottlePaperRotationBoost,
        x: (Math.random() > 0.5 ? 1 : -1) * (1 + Math.random() * 2) * bottlePaperWaveStrength,
        duration: (0.24 + Math.random() * 0.12) * bottlePaperWaveDurationScale,
        ease: 'sine.inOut'
      });
      waveTl.to(img, {
        skewX: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        x: 0,
        duration: 0.14 * bottlePaperWaveDurationScale,
        ease: 'sine.out'
      });
      waveTimelines.push(waveTl);
    }
  }

  if (bottleScatter) {
    // Keep the merge field dispersed: three independently staggered waves,
    // with extra small organic bubbles instead of one circular cluster.
    const bottleBubbleWaveSizes = [8, 11, 9];
    const bottleBubbleWaveStarts = [0.1, 0.48, 0.96];
    let bubbleOrdinal = 0;
    let bottleBubbleMaxEnd = 0;
    for (let waveIndex = 0; waveIndex < bottleBubbleWaveSizes.length; waveIndex += 1) {
      const waveSize = bottleBubbleWaveSizes[waveIndex];
      for (let indexInWave = 0; indexInWave < waveSize; indexInWave += 1) {
        const currentBubbleOrdinal = bubbleOrdinal;
        bubbleOrdinal += 1;
        const bubble = domElementPool.acquire('div') as HTMLElement;
        const idleEquivalentSize = 10 + Math.pow(Math.random(), 1.65) * 30;
        const bubbleSize = idleEquivalentSize * (2 + Math.random() * 0.5);
        const bubbleAspect = 0.68 + Math.random() * 0.64;
        const bubbleWidth = bubbleSize * Math.sqrt(bubbleAspect);
        const bubbleHeight = bubbleSize / Math.sqrt(bubbleAspect);
        const laneProgress = (indexInWave + 0.5) / waveSize;
        const laneJitter = (Math.random() - 0.5) * Math.min(0.14, 0.55 / waveSize);
        const waveOffset = (waveIndex % 2 === 0 ? -1 : 1) * 0.025;
        const startX = viewportW * Math.max(0.04, Math.min(0.96, laneProgress + laneJitter + waveOffset));
        const startY = viewportH + bubbleHeight * (1.2 + Math.random() * 1.8);
        const crossDirection = Math.random() < 0.5 ? -1 : 1;
        const crossDistance = 20 + Math.random() * 34;
        const totalRise = startY + bubbleHeight * 2.2;
        const bubbleDuration = (2.05 + Math.random() * 0.85) * speedScale;
        const bubbleDelay = bottleBubbleWaveStarts[waveIndex]
          + indexInWave * (0.04 + Math.random() * 0.03)
          + (indexInWave === 0 ? 0 : Math.random() * 0.035);
        const organicRadiusA = `${42 + Math.round(Math.random() * 18)}% ${42 + Math.round(Math.random() * 18)}% ${38 + Math.round(Math.random() * 24)}% ${40 + Math.round(Math.random() * 20)}% / ${38 + Math.round(Math.random() * 24)}% ${44 + Math.round(Math.random() * 16)}% ${42 + Math.round(Math.random() * 18)}% ${40 + Math.round(Math.random() * 20)}%`;
        const organicRadiusB = `${38 + Math.round(Math.random() * 24)}% ${40 + Math.round(Math.random() * 20)}% ${44 + Math.round(Math.random() * 16)}% ${42 + Math.round(Math.random() * 18)}% / ${45 + Math.round(Math.random() * 15)}% ${38 + Math.round(Math.random() * 24)}% ${40 + Math.round(Math.random() * 20)}% ${42 + Math.round(Math.random() * 18)}%`;
        bubble.className = 'cc-bottle-merge-bubble';
        bubble.style.cssText = [
          'position: absolute',
          'pointer-events: none',
          `left: ${Math.round(startX)}px`,
          `top: ${Math.round(startY)}px`,
          `width: ${Math.round(bubbleWidth)}px`,
          `height: ${Math.round(bubbleHeight)}px`,
          `border-radius: ${organicRadiusA}`,
          'border: 1px solid rgba(204,243,241,0.4)',
          'background: rgba(204,243,241,0.6)',
          'box-shadow: inset -4px -5px 9px rgba(255,255,255,0.3), inset 3px 3px 7px rgba(255,255,255,0.48)',
          'will-change: transform, opacity, background-color, border-radius',
        ].join(';');
        field.appendChild(bubble);
        activeBottleBubbles.push(bubble);
        const startScale = 0.2 + Math.random() * 0.2;
        const endScale = 0.6 + Math.random() * 0.4;
        gsap.set(bubble, { xPercent: -50, yPercent: -50, opacity: 0.7 + Math.random() * 0.3, scale: startScale });
        const bubbleTl = trackTimeline({ delay: bubbleDelay });
        bubbleTl.to(bubble, {
          keyframes: [
            { x: crossDirection * crossDistance, y: -totalRise * 0.25, scale: endScale, borderRadius: organicRadiusB, backgroundColor: 'rgba(217,247,245,0.58)' },
            { x: -crossDirection * crossDistance, y: -totalRise * 0.50, borderRadius: organicRadiusA, backgroundColor: 'rgba(234,251,250,0.52)' },
            { x: crossDirection * crossDistance * 0.75, y: -totalRise * 0.75, opacity: 0.68, borderRadius: organicRadiusB, backgroundColor: 'rgba(246,254,253,0.45)' },
            { x: (Math.random() - 0.5) * 20, y: -totalRise, opacity: 0.62, borderRadius: organicRadiusA, backgroundColor: 'rgba(255,255,255,0.36)' },
          ],
          duration: bubbleDuration,
          ease: 'sine.inOut',
        });
        bubbleTl.call(() => {
          if ((currentBubbleOrdinal + 1) % 3 !== 0) return;
          try { (window as any).triggerHapticImpact?.('light'); } catch {}
        });
        bubbleTl.to(bubble, {
          scale: endScale * 1.18,
          opacity: 0.48,
          duration: 0.065,
          ease: 'power2.out',
        });
        bubbleTl.to(bubble, {
          scale: 0,
          opacity: 0,
          duration: 0.095,
          ease: 'back.in(2.4)',
          onComplete: () => {
            try { gsap.set(bubble, { visibility: 'hidden' }); } catch {}
          },
        });
        starTimelines.push(bubbleTl);
        bottleBubbleMaxEnd = Math.max(bottleBubbleMaxEnd, bubbleDelay + bubbleDuration + 0.16);
      }
    }
    maxAnimationTime = Math.max(maxAnimationTime, bottleBubbleMaxEnd);
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
    activeBottleBubbles.forEach((bubble) => {
      try {
        gsap.killTweensOf(bubble);
        if (bubble.parentNode) bubble.parentNode.removeChild(bubble);
        domElementPool.release(bubble);
      } catch {}
    });
    try { field.remove(); } catch {}
  };

  const autoCleanupDelay = Math.max(1.2, maxAnimationTime + 0.45);
  const autoCleanupCall = trackDelayedCall(autoCleanupDelay, cleanup);

  const cleanupOwner = () => {
    try { autoCleanupCall.kill(); } catch {}
    cleanup();
  };
  // Parent text overlays may finish before long staggered Bottle bubbles.
  // Publish the real child lifetime so the parent never truncates their pops.
  (cleanupOwner as any).completionDelaySeconds = autoCleanupDelay;
  return cleanupOwner;
}
