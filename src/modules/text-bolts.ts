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
  sources?: string[];
  motion?: {
    beeFlight?: boolean;
    mixBlendMode?: string;
  };
}

interface BeeCollisionState {
  img: HTMLImageElement;
  size: number;
  offsetX: number;
  offsetY: number;
}

function boltSrc(index: number, sources?: string[]): string {
  const list = Array.isArray(sources) && sources.length ? sources : BOLT_IMAGES;
  return sources?.length
    ? list[Math.floor(Math.random() * list.length)]
    : list[index % list.length];
}

function buildBalancedBeeSourceOrder(count: number, sources?: string[]): string[] {
  if (!Array.isArray(sources) || sources.length === 0) return [];
  const order = Array.from({ length: count }, (_, index) => sources[index % sources.length]);
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
  }
  return order;
}

const BEE_DIRECTION_ANGLES: Record<number, number> = {
  1: Math.PI * 0.25,
  2: -Math.PI * 0.25,
  3: Math.PI,
  4: -Math.PI * 0.75,
  5: -Math.PI * 0.56,
  6: Math.PI * 0.08,
  7: Math.PI * 0.75,
};

// Eight Honey pairs leave in a deliberately uneven rhythm. The cumulative
// weights cover the full exit window without making the motion feel metronomic.
const BEE_PAIR_GAP_WEIGHTS = [0.2, 0.2, 0.1, 0.05, 0.1, 0.2, 0.15] as const;
const BEE_PAIR_STAGGER_SECONDS = 0.72;
const BEE_WITHIN_PAIR_OFFSET_SECONDS = 0.018;

function getBeePairDelay(index: number): number {
  const pairIndex = Math.floor(index / 2);
  const pairProgress = BEE_PAIR_GAP_WEIGHTS
    .slice(0, pairIndex)
    .reduce((total, weight) => total + weight, 0);
  const withinPairOffset = (index % 2) * BEE_WITHIN_PAIR_OFFSET_SECONDS;
  return pairProgress * BEE_PAIR_STAGGER_SECONDS + withinPairOffset + Math.random() * 0.008;
}

export function attachBoltSprites(overlay: HTMLElement, opts: BoltFieldOptions = {}): () => void {
  if (!overlay) return () => {};

  const count = Math.max(8, Math.min(28, opts.count ?? 16));
  const zIndex = opts.zIndex ?? 1;
  const beeFlight = opts.motion?.beeFlight === true;
  const mixBlendMode = opts.motion?.mixBlendMode || (beeFlight ? 'normal' : 'screen');
  const balancedBeeSources = beeFlight ? buildBalancedBeeSourceOrder(count, opts.sources) : [];

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
  const jitterBoost = beeFlight ? 1.05 : 1.3;

  const activeSprites: HTMLImageElement[] = [];
  const boltTimelines: gsap.core.Timeline[] = [];
  const beeCollisionStates: BeeCollisionState[] = [];

  for (let i = 0; i < count; i++) {
    const img = domElementPool.acquire('img') as HTMLImageElement;
    const spriteSource = beeFlight && balancedBeeSources.length
      ? balancedBeeSources[i]
      : boltSrc(i, opts.sources);
    img.src = spriteSource;
    img.alt = '';
    img.className = 'cc-bolt-sprite';

    const ring = i % 3;
    const baseRadiusX = beeFlight
      ? (ring === 0 ? viewportW * 0.12 : ring === 1 ? viewportW * 0.21 : viewportW * 0.3)
      : (ring === 0 ? viewportW * 0.24 : ring === 1 ? viewportW * 0.36 : viewportW * 0.5);
    const baseRadiusY = baseRadiusX * 0.62;
    const beeType = beeFlight ? Number(spriteSource.match(/bee([1-7])(?:@2x)?\.png$/)?.[1] || 1) : 0;
    const authoredBeeAngle = BEE_DIRECTION_ANGLES[beeType] ?? 0;
    const theta = (beeFlight ? authoredBeeAngle : (i / count) * Math.PI * 2)
      + (Math.random() - 0.5) * (beeFlight ? 0.16 : 0.75);
    const radiusJitter = 0.82 + Math.random() * 0.42;
    const beeStartForward = 18 + Math.random() * 88;
    const beeStartLateral = (Math.random() - 0.5) * 190;
    const x = beeFlight
      ? centerX + Math.cos(theta) * beeStartForward - Math.sin(theta) * beeStartLateral
      : centerX + Math.cos(theta) * baseRadiusX * radiusJitter + (Math.random() - 0.5) * 60;
    const y = beeFlight
      ? centerY + Math.sin(theta) * beeStartForward + Math.cos(theta) * beeStartLateral
      : centerY + Math.sin(theta) * baseRadiusY * radiusJitter + (Math.random() - 0.5) * 46;

    const isLarge = i % 5 === 0;
    const size = beeFlight ? 58 + Math.random() * 17 : (isLarge ? 110 + Math.random() * 52 : 64 + Math.random() * 40);

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
      `mix-blend-mode: ${mixBlendMode}`,
      beeFlight ? 'filter: none' : 'filter: drop-shadow(0 0 12px rgba(255, 200, 140, 0.35))'
    ].join(';');

    activeSprites.push(img);
    field.appendChild(img);
    if (beeFlight) beeCollisionStates.push({ img, size, offsetX: 0, offsetY: 0 });

    const outwardDx = x - centerX;
    const outwardDy = y - centerY;
    const outwardLen = Math.max(1, Math.hypot(outwardDx, outwardDy));
    const outwardX = beeFlight ? Math.cos(theta) : outwardDx / outwardLen;
    const outwardY = beeFlight ? Math.sin(theta) : outwardDy / outwardLen;

    const horizontalSign = (i % 2 === 0 ? -1 : 1) * (Math.random() < 0.5 ? 1 : -1);
    const moveOut = 54 + Math.random() * 90;
    const lateralSplit = (22 + Math.random() * 34) * horizontalSign;
    const driftX = outwardX * moveOut + lateralSplit + (Math.random() - 0.5) * 14;
    const driftY = outwardY * (moveOut * 0.78) + (Math.random() - 0.5) * 11;

    const jitterX = (beeFlight ? 2.5 + Math.random() * 5 : 4 + Math.random() * 8) * jitterBoost;
    const jitterY = (beeFlight ? 2 + Math.random() * 4 : 3 + Math.random() * 7) * jitterBoost;
    const baseScale = beeFlight ? 1 : 0.72 + Math.random() * 0.55;
    const rotateStart = beeFlight ? (Math.random() - 0.5) * 20 : (Math.random() - 0.5) * 52;
    const rotateJitterA = (Math.random() - 0.5) * 20 * jitterBoost;
    const rotateJitterB = (Math.random() - 0.5) * 22 * jitterBoost;
    const rotateDrift = (Math.random() - 0.5) * 28;
    const flashOpacity = beeFlight ? 0.78 + Math.random() * 0.22 : 0.55 + Math.random() * 0.35;

    gsap.set(img, {
      xPercent: -50,
      yPercent: -50,
      x: 0,
      y: 0,
      opacity: 0,
      scale: 0.2,
      rotation: rotateStart
    });

    if (beeFlight) {
      const delay = getBeePairDelay(i);
      const flightSide = Math.random() < 0.5 ? -1 : 1;
      const perpendicularX = -outwardY;
      const perpendicularY = outwardX;
      // Independent offsets avoid the old alternating A/B arc that made every
      // bee describe the same obvious circle through the middle of the screen.
      const lateralWaypoints = [70, 105, 120, 105, 72].map((spread) =>
        (Math.random() - 0.5) * spread * 2,
      );
      const waypointRotations = Array.from({ length: 5 }, () => (Math.random() - 0.5) * 15);
      const exitMargin = size * 0.72;
      const horizontalEdgeDistance = outwardX > 0.001
        ? (viewportW + exitMargin - x) / outwardX
        : outwardX < -0.001
          ? (-exitMargin - x) / outwardX
          : Number.POSITIVE_INFINITY;
      const verticalEdgeDistance = outwardY > 0.001
        ? (viewportH + exitMargin - y) / outwardY
        : outwardY < -0.001
          ? (-exitMargin - y) / outwardY
          : Number.POSITIVE_INFINITY;
      const edgeDistance = Math.max(120, Math.min(horizontalEdgeDistance, verticalEdgeDistance));
      const edgeX = outwardX * edgeDistance;
      const edgeY = outwardY * edgeDistance;
      const outsideDistance = edgeDistance + size * (0.72 + Math.random() * 0.35);
      const outsideX = outwardX * outsideDistance;
      const outsideY = outwardY * outsideDistance;
      const beeScale = 1;
      const buzzRotationA = flightSide * (6 + Math.random() * 2.5);
      const buzzRotationB = -flightSide * (6 + Math.random() * 2.5);
      const flightTl = trackTimeline({ delay });
      flightTl.to(img, {
        opacity: 1,
        scale: beeScale * 1.24,
        rotation: buzzRotationA,
        duration: 0.13 + Math.random() * 0.035,
        ease: 'back.out(2.8)',
      });
      flightTl.to(img, {
        scale: beeScale,
        rotation: buzzRotationB,
        duration: 0.08,
        ease: 'back.out(1.8)',
      });
      flightTl.to(img, {
        keyframes: [
          {
            x: edgeX * 0.2 + perpendicularX * lateralWaypoints[0] + flightSide * jitterX,
            y: edgeY * 0.2 + perpendicularY * lateralWaypoints[0] - flightSide * jitterY,
            rotation: waypointRotations[0],
            scale: beeScale * 1.03,
          },
          {
            x: edgeX * 0.38 + perpendicularX * lateralWaypoints[1] - flightSide * jitterX,
            y: edgeY * 0.38 + perpendicularY * lateralWaypoints[1] + flightSide * jitterY,
            rotation: waypointRotations[1],
            scale: beeScale * 1.08,
          },
          {
            x: edgeX * 0.56 + perpendicularX * lateralWaypoints[2] + flightSide * jitterX,
            y: edgeY * 0.56 + perpendicularY * lateralWaypoints[2] - flightSide * jitterY,
            rotation: waypointRotations[2],
            scale: beeScale * 1.13,
          },
          {
            x: edgeX * 0.72 + perpendicularX * lateralWaypoints[3] - flightSide * jitterX,
            y: edgeY * 0.72 + perpendicularY * lateralWaypoints[3] + flightSide * jitterY,
            rotation: waypointRotations[3],
            scale: beeScale * 1.18,
          },
          {
            x: edgeX * 0.86 + perpendicularX * lateralWaypoints[4],
            y: edgeY * 0.86 + perpendicularY * lateralWaypoints[4],
            rotation: waypointRotations[4],
            scale: beeScale * 1.24,
          },
        ],
        opacity: 1,
        duration: 1.2 + Math.random() * 0.12,
        ease: 'sine.inOut',
      });
      flightTl.to(img, {
        x: edgeX * 0.96,
        y: edgeY * 0.96,
        rotation: buzzRotationB,
        scale: beeScale * 1.16,
        opacity: 1,
        duration: 0.09,
        ease: 'power2.out',
      });
      flightTl.to(img, {
        x: outsideX,
        y: outsideY,
        rotation: buzzRotationA,
        scale: 0,
        opacity: 0,
        duration: 0.2 + Math.random() * 0.04,
        ease: 'back.in(2.4)',
      });
      boltTimelines.push(flightTl);
      continue;
    }

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

  // Honey-only spacing owner. Authored GSAP paths remain independent while
  // this additive translate keeps 60% clear air between visible bee edges.
  const beeCollisionTick = () => {
    const visible = beeCollisionStates.filter(({ img }) => Number(gsap.getProperty(img, 'opacity')) > 0.02);

    for (const state of beeCollisionStates) {
      state.offsetX *= 0.9;
      state.offsetY *= 0.9;
    }

    // Repeated bounded relaxation prevents one pair correction from creating
    // a new collision with a neighbouring bee. Honey has at most 28 sprites.
    for (let pass = 0; pass < 8; pass += 1) {
      for (let i = 0; i < visible.length; i += 1) {
        const first = visible[i];
        const firstScale = Math.max(0, Number(gsap.getProperty(first.img, 'scale')) || 0);
        const firstX = Number.parseFloat(first.img.style.left) + Number(gsap.getProperty(first.img, 'x')) + first.offsetX;
        const firstY = Number.parseFloat(first.img.style.top) + Number(gsap.getProperty(first.img, 'y')) + first.offsetY;

        for (let j = i + 1; j < visible.length; j += 1) {
          const second = visible[j];
          const secondScale = Math.max(0, Number(gsap.getProperty(second.img, 'scale')) || 0);
          const secondX = Number.parseFloat(second.img.style.left) + Number(gsap.getProperty(second.img, 'x')) + second.offsetX;
          const secondY = Number.parseFloat(second.img.style.top) + Number(gsap.getProperty(second.img, 'y')) + second.offsetY;
          const minimumDistance = ((first.size * firstScale + second.size * secondScale) * 0.5) * 1.6;
          let deltaX = secondX - firstX;
          let deltaY = secondY - firstY;
          let distance = Math.hypot(deltaX, deltaY);

          if (distance >= minimumDistance) continue;
          if (distance < 0.001) {
            const splitAngle = (i * 2.399963229728653) + (j * 0.71);
            deltaX = Math.cos(splitAngle);
            deltaY = Math.sin(splitAngle);
            distance = 1;
          }

          const correction = (minimumDistance - distance) * 0.51;
          const correctionX = (deltaX / distance) * correction;
          const correctionY = (deltaY / distance) * correction;
          first.offsetX -= correctionX;
          first.offsetY -= correctionY;
          second.offsetX += correctionX;
          second.offsetY += correctionY;
        }
      }
    }

    for (const state of beeCollisionStates) {
      state.img.style.translate = `${state.offsetX.toFixed(2)}px ${state.offsetY.toFixed(2)}px`;
    }
  };

  if (beeFlight) gsap.ticker.add(beeCollisionTick);

  let beeExitStarted = false;
  const startExit = () => {
    if (!beeFlight || beeExitStarted) return;
    beeExitStarted = true;
    // Bee timelines own their exit at the edge of their individual path.
    // Do not interrupt them when the BUZZING! letters begin exiting.
  };

  const cleanup = (() => {
    if (beeFlight) gsap.ticker.remove(beeCollisionTick);
    boltTimelines.forEach((tl) => {
      try { tl.kill(); } catch {}
    });
    activeSprites.forEach((img) => {
      try {
        gsap.killTweensOf(img);
        img.style.translate = '';
        domElementPool.release(img);
      } catch {}
    });
    try { field.remove(); } catch {}
  }) as (() => void) & { startExit?: () => void };
  cleanup.startExit = startExit;
  return cleanup;
}
