// @ts-nocheck
// Board Transition Screen
// Shows board number before starting next board (interim board flow)

import { gsap } from 'gsap';
import { logger } from '../core/logger.js';
import animationManager from './animation-manager.js';
import { createScreenLifecycle } from '../utils/screen-lifecycle.js';
import { applyPaperBackground } from './ui-manager.js';
import { applyAppPaperSurfaceToElement } from '../utils/app-paper-background.js';
import { domElementPool } from './dom-element-pool.js';
import { sampleMemorySpike } from '../utils/memory-spike-tracker.js';
import { beginBoardLifecycleTrace, markBoardLifecycle } from '../utils/board-lifecycle-performance.js';
import {
  startIOSJourneyPerformanceAudit,
  stopIOSJourneyPerformanceAudit,
} from '../utils/ios-journey-performance-audit.js';
import { formatJourneyWorldStageNumber } from './journey-world-stage.js';
import { buildBoardTransitionExitSchedule } from './board-transition-exit-schedule.js';
import {
  BEACH_PALM_GLOBAL_VERTICAL_OFFSET_PX,
  createBeachTransitionVariationSequence,
  type BeachTransitionVariation,
} from './board-transition-beach-variation.js';
import {
  createRoboAirCombatVariation,
  createRoboTransitionVariation,
  sampleRoboAirCombatSway,
  type RoboAirCombatSwaySample,
  type RoboAirCombatVariation,
  type RoboTravelDirection,
  type RoboTransitionVariation,
} from './board-transition-robo-variation.js';
import { getRunMode } from './run-mode.js';
import { getJourneyForestBeeAssetForVelocity } from './journey-forest-bee-orbits.js';
import {
  AREA55_BOARD_TRANSITION_PROFILE,
  BEACH_BOARD_TRANSITION_PROFILE,
  BEACH_BOARD_TRANSITION_CLOUD_COUNT,
  resolveBoardTransitionTheme,
  type BoardTransitionThemeId,
  type BoardTransitionThemeLayer,
} from './board-transition-themes.js';
import {
  createBoardTransitionSettlement,
  type BoardTransitionSettlement,
} from './board-transition-lifecycle.js';
import { boardTransitionPresentationHandoff } from './board-transition-presentation-handoff.js';
import { resolveRoboAirCombatHoldSeconds } from './board-transition-robo-combat-timing.js';
import { areContinuousRuntimeDiagnosticsEnabled } from '../utils/runtime-diagnostics-policy.js';

interface BoardTransitionOptions {
  boardNumber: number;
  onComplete: () => void | Promise<void>;
  hideForest?: boolean;
  displayText?: string;
  theme?: BoardTransitionThemeId;
}

let isTransitionActive = false;
let currentOverlay: HTMLElement | null = null;
let activeTweens: gsap.core.Tween[] = [];
let enterTimeline: gsap.core.Timeline | null = null;
let exitTimeline: gsap.core.Timeline | null = null;
let pauseTimeline: gsap.core.Timeline | null = null;
let activeCloudImages: HTMLImageElement[] = []; // 🔥 IMAGE POOLING: Track cloud image elements for cleanup
let activeCloudWrappers: HTMLElement[] = []; // Track cloud wrappers so x drift never conflicts with image bounce/scale
let cloudTimelines: gsap.core.Timeline[] = []; // 🔥 MEMORY LEAK FIX: Track all cloud timelines (bounce, enter, exit)
let cloudDelayedCalls: gsap.core.Tween[] = []; // 🔥 MEMORY LEAK FIX: Track all delayedCall instances for cleanup
let activeSceneImages: HTMLImageElement[] = []; // 🔥 IMAGE POOLING: Track scene image elements for cleanup
let activeSceneElements: HTMLElement[] = []; // Animated scene layer elements (hill wrappers + regular images)
type ForestTransitionBeeAsset = ReturnType<typeof getJourneyForestBeeAssetForVelocity>;
const forestTransitionBeeDirectionStates = new WeakMap<HTMLImageElement, {
  currentAsset: ForestTransitionBeeAsset;
  pendingAsset: ForestTransitionBeeAsset | null;
  pendingSeconds: number;
}>();
let forestTransitionSpecialBeeTimeline: gsap.core.Timeline | null = null;
let forestTransitionSpecialBeeImages: HTMLImageElement[] = [];
let forestTransitionSpecialBeeBehindMountainLayer: HTMLElement | null = null;
let forestTransitionSpecialBeeRearLayer: HTMLElement | null = null;
let forestTransitionSpecialBeeFrontLayer: HTMLElement | null = null;
let contentTimelines: gsap.core.Timeline[] = []; // 🔥 MEMORY LEAK FIX: Track scene and digit timelines
let beachAmbientTimelines = new Map<HTMLElement, gsap.core.Timeline>();
let roboGroundAmbientTimelines = new Map<HTMLElement, gsap.core.Timeline[]>();
let beachShoreAmbientTimeline: gsap.core.Timeline | null = null;
let roboAirCombatTimelines: gsap.core.Timeline[] = [];
let roboAirCombatMasterTimeline: gsap.core.Timeline | null = null;
let activeRoboAirCombatVariation: RoboAirCombatVariation | null = null;
let isCleaningUp = false;
let activeTransitionSettlement: BoardTransitionSettlement | null = null;
let transitionGeneration = 0;
const createNextBeachTransitionVariation = createBeachTransitionVariationSequence();

const TRANSITION_CLOUD_IMAGES = [
  './assets/board transition/oblak+srednji.png', // ~103KB - consider compressing if memory critical
  './assets/board transition/oblak mali desno.png',
  './assets/board transition/oblak mali ljevo.png',
  './assets/board transition/oblak veliki ljevo dole.png'
];

const FOREST_TRANSITION_BEE_ASSETS = [
  './assets/shop/honey/bee1@2x.png',
  './assets/shop/honey/bee2@2x.png',
  './assets/shop/honey/bee3@2x.png',
  './assets/shop/honey/bee4@2x.png',
  './assets/shop/honey/bee5@2x.png',
  './assets/shop/honey/bee6@2x.png',
  './assets/shop/honey/bee7@2x.png',
];
const BOARD_TRANSITION_NUMBER_ENTER_START_SECONDS = 0.3;
const FOREST_TRANSITION_SPECIAL_BEE_SCALE_MULTIPLIER = 1.7;

const ROBO_AIR_COMBAT_LAYER_KEYS = new Set([
  'robo-fighter-left',
  'robo-fighter-right',
  'robo-beam-right',
  'robo-beam-hit',
  'robo-beam-after',
  'robo-beam-final',
]);
const ROBO_FIGHTER_BEHIND_NUMBER_Z_INDEX = 9;
const ROBO_FIGHTER_FRONT_NUMBER_Z_INDEX = 11;
const CLOUD_CSS_STYLES = `
@keyframes cc-cloud-enter {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0) rotate(var(--cloud-rot, 0deg)); }
  70% { opacity: 1; transform: translate(-50%, -50%) scale(1.2) rotate(var(--cloud-rot, 0deg)); }
  100% { opacity: 1; transform: translate(-50%, -50%) scale(var(--cloud-scale, 0.4)) rotate(var(--cloud-rot, 0deg)); }
}
@keyframes cc-cloud-move {
  0% { transform: translate(-50%, -50%) scale(var(--cloud-scale, 0.4)) rotate(var(--cloud-rot, 0deg)); }
  100% { transform: translate(var(--move-end, -50%), -50%) scale(var(--cloud-scale, 0.4)) rotate(var(--cloud-rot, 0deg)); }
}
@keyframes cc-cloud-exit {
  0% { opacity: 1; }
  100% { opacity: 0; transform: translate(var(--move-end, -50%), -50%) scale(0) rotate(var(--cloud-rot, 0deg)); }
}
.cc-board-transition-cloud.cc-cloud-exit {
  animation: cc-cloud-exit 0.35s ease-in forwards !important;
}
`;
const TRANSITION_SCENE_LAYERS = [
  {
    key: 'mountain',
    src: './assets/journey assets/forest/mountain.png',
    alt: 'Mountain',
    style: [
      'left: 50%',
      'bottom: 142px',
      'width: auto',
      'z-index: 0',
      'transform-origin: center bottom',
      '--scene-base-scale: 1.45'
    ]
  },
  {
    key: 'hill2',
    src: './assets/journey assets/forest/hill2.png',
    alt: 'Hill 2',
    style: [
      'left: calc(50% - 10px)',
      'bottom: 3px',
      'width: auto',
      'z-index: 20',
      'transform-origin: center bottom',
      '--scene-base-scale: 1.53'
    ]
  },
  {
    key: 'hill1',
    src: './assets/journey assets/forest/hill1.png',
    alt: 'Hill 1',
    style: [
      'left: 50%',
      'bottom: 78px',
      'width: auto',
      'z-index: 10',
      'transform-origin: center bottom',
      '--scene-base-scale: 1.6'
    ]
  },
  {
    key: 'pine1',
    src: './assets/journey assets/pine1.png',
    alt: 'Pine 1',
    style: [
      'left: 10%',
      'bottom: 66px',
      'width: min(34vw, 138px)',
      'z-index: 34',
      'transform-origin: center bottom'
    ]
  },
  {
    key: 'pine2',
    src: './assets/journey assets/pine2.png',
    alt: 'Pine 2',
    style: [
      'left: 31%',
      'bottom: 46px',
      'width: min(58vw, 236px)',
      'z-index: 36',
      'transform-origin: center bottom'
    ]
  },
  {
    key: 'pine3',
    src: './assets/journey assets/pine3.png',
    alt: 'Pine 3',
    style: [
      'left: 61%',
      'bottom: 64px',
      'width: min(43vw, 176px)',
      'z-index: 34',
      'transform-origin: center bottom'
    ]
  },
  {
    key: 'pine4',
    src: './assets/journey assets/pine4.png',
    alt: 'Pine 4',
    style: [
      'left: 78%',
      'bottom: 40px',
      'width: min(43vw, 176px)',
      'z-index: 36',
      'transform-origin: center bottom'
    ]
  },
  {
    key: 'pine5',
    src: './assets/journey assets/pine5.png',
    alt: 'Pine 5',
    style: [
      'left: 86%',
      'bottom: 110px',
      'width: min(26vw, 108px)',
      'z-index: 34',
      'transform-origin: center bottom'
    ]
  },
  {
    key: 'fence-left',
    src: './assets/journey assets/fence.left.png',
    alt: 'Fence left',
    style: [
      'left: calc(17% + 20px)',
      'bottom: 44px',
      'width: min(46vw, 180px)',
      'z-index: 38',
      'transform-origin: center bottom'
    ]
  },
  {
    key: 'fence-right',
    src: './assets/journey assets/fence.right.png',
    alt: 'Fence right',
    style: [
      'left: calc(79% + 20px)',
      'bottom: 44px',
      'width: min(46vw, 180px)',
      'z-index: 38',
      'transform-origin: center bottom'
    ]
  }
];
const TRANSITION_SCENE_ENTER_ORDER = [
  'fence-left',
  'fence-right',
  'pine1',
  'pine4',
  'pine3',
  'pine5',
  'pine2',
  'hill2',
  'hill1',
  'mountain'
];
const preloadedTransitionAssetUrls = new Set<string>();
let assetsPreloadPromise: Promise<void> | null = null;
let memSampleInterval: number | null = null;
let memSamplePeak = 0;
let memSampleStart = 0;
let memSampleStartTs = 0;

const trackTimeline = (options: any = {}) => animationManager.trackExternalTimeline(gsap.timeline(options));

const trackDelayedCall = (...args: any[]) => animationManager.trackExternalTween(gsap.delayedCall(...args));

function startSimpleForestNNBees(
  overlay: HTMLElement,
  digitElements: HTMLElement[],
): void {
  if (forestTransitionSpecialBeeTimeline || digitElements.length === 0) return;
  const createSpecialLayer = (className: string, zIndex: number): HTMLElement => {
    const layer = document.createElement('div');
    layer.className = className;
    layer.style.cssText = [
      'position: absolute', 'inset: 0', 'pointer-events: none', 'overflow: visible', `z-index: ${zIndex}`,
    ].join(';');
    overlay.appendChild(layer);
    return layer;
  };
  forestTransitionSpecialBeeBehindMountainLayer = createSpecialLayer(
    'cc-forest-transition-special-bee-behind-mountain',
    3,
  );
  forestTransitionSpecialBeeRearLayer = createSpecialLayer('cc-forest-transition-special-bee-rear', 9);
  forestTransitionSpecialBeeFrontLayer = createSpecialLayer('cc-forest-transition-special-bee-front', 11);
  const rearLayer = forestTransitionSpecialBeeRearLayer;
  const frontLayer = forestTransitionSpecialBeeFrontLayer;

  type Point = Readonly<{ x: number; y: number }>;
  type RouteSample = Readonly<{ x: number; y: number; distance: number }>;
  const overlayRect = overlay.getBoundingClientRect();
  const digitRects = [
    digitElements[0].getBoundingClientRect(),
    (digitElements[1] ?? digitElements[0]).getBoundingClientRect(),
  ];
  const digitCenters = digitRects.map((rect) => ({
    x: rect.left - overlayRect.left + rect.width * 0.5,
    y: rect.top - overlayRect.top + rect.height * 0.5,
  }));
  const numberCenter = {
    x: (digitCenters[0].x + digitCenters[1].x) * 0.5,
    y: (digitCenters[0].y + digitCenters[1].y) * 0.5,
  };
  const beeWidthPx = 58 * FOREST_TRANSITION_SPECIAL_BEE_SCALE_MULTIPLIER;
  const introOversizePx = 160;
  const orbitRadiusX = Math.max(76, Math.abs(digitCenters[1].x - digitCenters[0].x) * 0.5 + 24);
  const orbitRadiusY = Math.max(34, Math.max(digitRects[0].height, digitRects[1].height) * 0.30);
  const routeLateralSweep = Math.min(overlayRect.width * 0.38, orbitRadiusX * 1.72);
  const routeVerticalSweep = Math.min(overlayRect.height * 0.27, Math.max(62, orbitRadiusY * 1.68) * 1.48);
  const randomBetween = (minimum: number, maximum: number): number => (
    minimum + Math.random() * (maximum - minimum)
  );
  const storySpreadX = 0.92 + Math.random() * 0.20;
  const storySpreadY = 0.90 + Math.random() * 0.24;
  const leftEntryY = overlayRect.height * randomBetween(0.045, 0.095);
  const rightEntryY = overlayRect.height * randomBetween(0.84, 0.94);
  const leftExitY = numberCenter.y + routeVerticalSweep * randomBetween(0.94, 1.12);
  const rightExitY = numberCenter.y + routeVerticalSweep * randomBetween(1.24, 1.42);
  const digitPoint = (index: 0 | 1, dx: number, dy: number): Point => ({
    x: digitCenters[index].x + dx * routeLateralSweep,
    y: digitCenters[index].y + dy * routeVerticalSweep,
  });
  const variedStoryPoint = (dx: number, dy: number, jitter = 0.055): Point => ({
    x: numberCenter.x + (dx + (Math.random() * 2 - 1) * jitter) * routeLateralSweep * storySpreadX,
    y: numberCenter.y + (dy + (Math.random() * 2 - 1) * jitter * 1.18) * routeVerticalSweep * storySpreadY,
  });
  const randomizeKnotTimes = (times: readonly number[], jitterSeconds = 0.045): number[] => (
    times.map((time, index) => {
      if (index === 0 || index === times.length - 1) return time;
      return Math.max(
        times[index - 1] + 0.12,
        Math.min(times[index + 1] - 0.12, time + randomBetween(-jitterSeconds, jitterSeconds)),
      );
    })
  );
  const randomizeSpeedWaves = (waves: readonly number[]): number[] => waves.map((wave) => (
    Math.max(0.06, Math.min(0.20, wave + randomBetween(-0.025, 0.025)))
  ));
  const catmullRom = (points: readonly Point[], progress: number): Point => {
    const segmentCount = points.length - 1;
    const scaled = Math.max(0, Math.min(0.999999, progress)) * segmentCount;
    const index = Math.min(segmentCount - 1, Math.floor(scaled));
    const t = scaled - index;
    const p1 = points[index];
    const p2 = points[index + 1];
    const p0 = index > 0
      ? points[index - 1]
      : { x: p1.x * 2 - p2.x, y: p1.y * 2 - p2.y };
    const p3 = index + 2 < points.length
      ? points[index + 2]
      : { x: p2.x * 2 - p1.x, y: p2.y * 2 - p1.y };
    const t2 = t * t;
    const t3 = t2 * t;
    return {
      x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t
        + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2
        + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
      y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t
        + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2
        + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    };
  };
  const buildArcLengthSamples = (points: readonly Point[]): RouteSample[] => {
    const samples: RouteSample[] = [];
    let previous = catmullRom(points, 0);
    let distance = 0;
    samples.push({ ...previous, distance });
    const sampleCount = Math.max(384, (points.length - 1) * 64);
    for (let index = 1; index <= sampleCount; index += 1) {
      const point = catmullRom(points, index / sampleCount);
      distance += Math.hypot(point.x - previous.x, point.y - previous.y);
      samples.push({ ...point, distance });
      previous = point;
    }
    return samples;
  };
  const sampleByDistance = (samples: readonly RouteSample[], distance: number): Point => {
    const boundedDistance = Math.max(0, Math.min(samples[samples.length - 1].distance, distance));
    let low = 0;
    let high = samples.length - 1;
    while (low + 1 < high) {
      const middle = Math.floor((low + high) * 0.5);
      if (samples[middle].distance < boundedDistance) low = middle;
      else high = middle;
    }
    const from = samples[low];
    const to = samples[high];
    const span = Math.max(0.0001, to.distance - from.distance);
    const mix = (boundedDistance - from.distance) / span;
    return {
      x: from.x + (to.x - from.x) * mix,
      y: from.y + (to.y - from.y) * mix,
    };
  };
  const applyRouteWobble = (
    point: Point,
    distance: number,
    totalDistance: number,
    verticalAmplitudePx: number,
    verticalCycles: number,
    horizontalAmplitudePx: number,
    horizontalCycles: number,
    phase: number,
  ): Point => {
    if ((verticalAmplitudePx <= 0 && horizontalAmplitudePx <= 0) || totalDistance <= 0) return point;
    const progress = Math.max(0, Math.min(1, distance / totalDistance));
    const endpointEnvelope = Math.sin(Math.PI * progress) ** 1.35;
    const verticalAngle = (progress * verticalCycles + phase) * Math.PI * 2;
    const horizontalAngle = (progress * horizontalCycles + phase * 0.73) * Math.PI * 2;
    return {
      x: point.x + Math.cos(horizontalAngle) * horizontalAmplitudePx * endpointEnvelope,
      y: point.y + Math.sin(verticalAngle) * verticalAmplitudePx * endpointEnvelope,
    };
  };

  const routes = [
    {
      role: 'left',
      initialDirection: -1,
      scaleMultiplier: randomBetween(0.90, 1),
      mountainExitMode: 'retarget',
      verticalWobblePx: randomBetween(6, 13),
      verticalWobbleCycles: randomBetween(1.25, 2.05),
      horizontalWobblePx: randomBetween(4, 9),
      horizontalWobbleCycles: randomBetween(0.85, 1.45),
      verticalWobblePhase: Math.random(),
      scaleChangeStart: 0.40,
      scaleChangeEnd: 0.50,
      lifetimeScale: 0.60,
      knotTimes: randomizeKnotTimes([0, 0.45, 0.78, 1.15, 1.50, 1.82, 2.15, 2.48, 2.98, 3.50]),
      speedWaves: randomizeSpeedWaves([0.16, 0.08, 0.12, 0.10, 0.14, 0.09, 0.15, 0.11, 0.18]),
      points: [
        { x: overlayRect.width + beeWidthPx + 34, y: leftEntryY },
        variedStoryPoint(-1.30, -0.52),
        digitPoint(0, -0.05, -0.02),
        variedStoryPoint(-0.08, -1.02),
        variedStoryPoint(1.02, -0.38),
        digitPoint(1, 0.04, 0.04),
        variedStoryPoint(0.86, 0.66),
        variedStoryPoint(0.02, 1.02),
        variedStoryPoint(-0.92, 0.58),
        { x: -beeWidthPx - 36, y: leftExitY },
      ],
    },
    {
      role: 'right',
      initialDirection: -1,
      scaleMultiplier: randomBetween(0.84, 0.96),
      mountainExitMode: 'none',
      verticalWobblePx: randomBetween(8, 16),
      verticalWobbleCycles: randomBetween(1.55, 2.35),
      horizontalWobblePx: randomBetween(5, 11),
      horizontalWobbleCycles: randomBetween(1.05, 1.65),
      verticalWobblePhase: Math.random(),
      scaleChangeStart: 0.80,
      scaleChangeEnd: 0.88,
      lifetimeScale: 0.70,
      knotTimes: randomizeKnotTimes([0, 0.48, 0.82, 1.20, 1.55, 1.88, 2.22, 2.56, 3.03, 3.55]),
      speedWaves: randomizeSpeedWaves([0.14, 0.10, 0.08, 0.15, 0.10, 0.13, 0.09, 0.16, 0.18]),
      points: [
        { x: overlayRect.width + 34, y: rightEntryY },
        variedStoryPoint(1.24, 0.42),
        digitPoint(1, 0.04, 0.02),
        variedStoryPoint(0.14, 1.00),
        variedStoryPoint(-1.18, 0.34),
        digitPoint(0, -0.04, -0.04),
        variedStoryPoint(-0.82, -0.68),
        variedStoryPoint(0.04, -1.04),
        variedStoryPoint(0.94, -0.48),
        { x: overlayRect.width + beeWidthPx + 36, y: rightExitY },
      ],
    },
    {
      role: 'high-scout',
      initialDirection: 1,
      scaleMultiplier: randomBetween(0.82, 0.96),
      mountainExitMode: 'none',
      verticalWobblePx: randomBetween(28, 38),
      verticalWobbleCycles: randomBetween(1.85, 2.45),
      horizontalWobblePx: randomBetween(11, 17),
      horizontalWobbleCycles: randomBetween(1.20, 1.70),
      verticalWobblePhase: Math.random(),
      scaleChangeStart: 0.54,
      scaleChangeEnd: 0.69,
      lifetimeScale: 0.74,
      knotTimes: randomizeKnotTimes([0, 0.44, 0.82, 1.18, 1.56, 1.94, 2.34, 2.72, 3.10, 3.50]),
      speedWaves: randomizeSpeedWaves([0.08, 0.14, 0.09, 0.13, 0.07, 0.15, 0.09, 0.12, 0.10]),
      points: [
        { x: -beeWidthPx - randomBetween(12, 24), y: overlayRect.height * randomBetween(0.10, 0.18) },
        digitPoint(0, -0.30, -0.62),
        digitPoint(0, 0.08, 0.10),
        variedStoryPoint(0.16, 1.18, 0.035),
        digitPoint(1, -0.10, 0.02),
        variedStoryPoint(0.72, -1.24, 0.035),
        digitPoint(0, 0.12, -0.12),
        variedStoryPoint(-0.82, 0.88, 0.035),
        variedStoryPoint(-1.08, -0.72, 0.035),
        { x: -beeWidthPx - randomBetween(48, 68), y: numberCenter.y - routeVerticalSweep * randomBetween(1.20, 1.42) },
      ],
    },
    {
      role: 'low-dancer',
      initialDirection: 1,
      scaleMultiplier: randomBetween(0.50, 0.60),
      mountainExitMode: 'occlude',
      verticalWobblePx: randomBetween(38, 48),
      verticalWobbleCycles: randomBetween(2.35, 3.05),
      horizontalWobblePx: randomBetween(15, 21),
      horizontalWobbleCycles: randomBetween(1.55, 2.05),
      verticalWobblePhase: Math.random(),
      scaleChangeStart: 0.64,
      scaleChangeEnd: 0.84,
      lifetimeScale: 0.66,
      knotTimes: randomizeKnotTimes([0, 0.36, 0.74, 1.10, 1.50, 1.88, 2.28, 2.66, 3.08, 3.52]),
      speedWaves: randomizeSpeedWaves([0.19, 0.07, 0.15, 0.10, 0.18, 0.08, 0.16, 0.09, 0.14]),
      points: [
        { x: -beeWidthPx - randomBetween(48, 64), y: overlayRect.height * randomBetween(0.86, 0.94) },
        variedStoryPoint(-1.44, 1.54, 0.035),
        variedStoryPoint(0.74, 1.36, 0.035),
        variedStoryPoint(1.36, -0.78, 0.035),
        digitPoint(1, -0.12, 0.08),
        variedStoryPoint(-0.26, -1.58, 0.035),
        digitPoint(0, 0.14, -0.10),
        variedStoryPoint(-1.40, 0.76, 0.035),
        variedStoryPoint(0.54, 1.62, 0.035),
        { x: overlayRect.width + beeWidthPx + randomBetween(52, 70), y: numberCenter.y + routeVerticalSweep * randomBetween(1.52, 1.70) },
      ],
    },
  ] as const;
  const fullSizeIntroIndex = Math.floor(Math.random() * routes.length);
  const routeRuntimes = routes.map((route, index) => {
    const beeImage = domElementPool.acquire('img') as HTMLImageElement;
    resetPooledImage(beeImage);
    beeImage.alt = '';
    beeImage.className = 'cc-forest-transition-special-bee';
    beeImage.dataset.forestSpecialBeeIndex = String(index);
    beeImage.dataset.forestSpecialBeeRole = route.role;
    beeImage.style.cssText = [
      'position: absolute', 'left: 0', 'top: 0', `width: ${beeWidthPx}px`, 'height: auto',
      'display: block', 'pointer-events: none', 'will-change: transform', 'transform-origin: 50% 50%',
    ].join(';');
    const homeLayer = route.role === 'left' ? frontLayer : rearLayer;
    homeLayer.appendChild(beeImage);
    forestTransitionSpecialBeeImages.push(beeImage);
    const samples = buildArcLengthSamples(route.points);
    const start = samples[0];
    const initialDirection = route.initialDirection;
    const baseScale = 0.78 * 0.85 * route.scaleMultiplier;
    const introScaleMultiplier = index === fullSizeIntroIndex ? 1 : 0.70;
    const introStartScale = (1 + introOversizePx / (beeWidthPx * baseScale))
      * introScaleMultiplier;
    const knotDistances = route.points.map((_point, knotIndex) => samples[Math.round(
      (knotIndex / (route.points.length - 1)) * (samples.length - 1),
    )].distance);
    pointForestTransitionBeeToward(beeImage, initialDirection, 0);
    gsap.set(beeImage, { x: start.x, y: start.y, opacity: 1, scale: baseScale * introStartScale, rotation: 0 });
    return {
      beeImage,
      role: route.role,
      homeLayer,
      mountainExitMode: route.mountainExitMode,
      samples,
      totalDistance: samples[samples.length - 1].distance,
      knotDistances,
      knotTimes: route.knotTimes,
      speedWaves: route.speedWaves,
      scaleChangeStart: route.scaleChangeStart,
      scaleChangeEnd: route.scaleChangeEnd,
      lifetimeScale: route.lifetimeScale,
      baseScale,
      introStartScale,
      verticalWobblePx: route.verticalWobblePx,
      verticalWobbleCycles: route.verticalWobbleCycles,
      horizontalWobblePx: route.horizontalWobblePx,
      horizontalWobbleCycles: route.horizontalWobbleCycles,
      verticalWobblePhase: route.verticalWobblePhase,
      exitPoint: route.points[route.points.length - 1],
      mountainExitSamples: null as RouteSample[] | null,
      mountainExitStartedSeconds: 0,
      mountainPeakBounds: null as { left: number; right: number; top: number; bottom: number } | null,
      bank: 0,
      previousClockSeconds: 0,
      horizontalDirection: initialDirection,
      isBehindMountain: false,
      xSetter: gsap.quickSetter(beeImage, 'x', 'px') as (value: number) => void,
      ySetter: gsap.quickSetter(beeImage, 'y', 'px') as (value: number) => void,
      rotationSetter: gsap.quickSetter(beeImage, 'rotation', 'deg') as (value: number) => void,
      scaleXSetter: gsap.quickSetter(beeImage, 'scaleX') as (value: number) => void,
      scaleYSetter: gsap.quickSetter(beeImage, 'scaleY') as (value: number) => void,
    };
  });
  const flowClock = { seconds: 0 };
  const longestDuration = Math.max(...routeRuntimes.map((runtime) => (
    runtime.knotTimes[runtime.knotTimes.length - 1]
  ))) + 1 / 60;
  forestTransitionSpecialBeeTimeline = trackTimeline({
    paused: true,
    onComplete: () => {
      gsap.set(forestTransitionSpecialBeeImages, { display: 'none', visibility: 'hidden' });
      forestTransitionSpecialBeeTimeline = null;
    },
  });
  contentTimelines.push(forestTransitionSpecialBeeTimeline);
  forestTransitionSpecialBeeTimeline.to(flowClock, {
    seconds: longestDuration,
    duration: longestDuration,
    ease: 'none',
    onUpdate: () => {
      routeRuntimes.forEach((runtime, index) => {
        let segmentIndex = runtime.knotTimes.length - 2;
        for (let candidate = 0; candidate < runtime.knotTimes.length - 1; candidate += 1) {
          if (flowClock.seconds < runtime.knotTimes[candidate + 1]) {
            segmentIndex = candidate;
            break;
          }
        }
        const segmentStartTime = runtime.knotTimes[segmentIndex];
        const segmentEndTime = runtime.knotTimes[segmentIndex + 1];
        const segmentProgress = Math.max(0, Math.min(1,
          (flowClock.seconds - segmentStartTime) / (segmentEndTime - segmentStartTime),
        ));
        const waveStrength = runtime.speedWaves[segmentIndex];
        const warpedProgress = segmentProgress
          + (waveStrength / (Math.PI * 2)) * Math.sin(Math.PI * 2 * segmentProgress);
        const segmentStartDistance = runtime.knotDistances[segmentIndex];
        const segmentEndDistance = runtime.knotDistances[segmentIndex + 1];
        const travelledDistance = segmentStartDistance
          + (segmentEndDistance - segmentStartDistance) * warpedProgress;
        let point = applyRouteWobble(
          sampleByDistance(runtime.samples, travelledDistance),
          travelledDistance,
          runtime.totalDistance,
          runtime.verticalWobblePx,
          runtime.verticalWobbleCycles,
          runtime.horizontalWobblePx,
          runtime.horizontalWobbleCycles,
          runtime.verticalWobblePhase,
        );
        let activeSamples = runtime.samples;
        let activeDistance = travelledDistance;
        if (runtime.mountainExitMode !== 'none' && segmentIndex >= runtime.knotTimes.length - 3) {
          if (!runtime.mountainPeakBounds) {
            const mountainLayer = overlay.querySelector('[data-scene-layer="mountain"]') as HTMLElement | null;
            const mountainImage = mountainLayer?.querySelector('img') as HTMLImageElement | null;
            const mountainRect = mountainImage?.getBoundingClientRect();
            if (mountainRect && mountainRect.width > 0 && mountainRect.height > 0) {
              const mountainLeft = mountainRect.left - overlayRect.left;
              const mountainTop = mountainRect.top - overlayRect.top;
              const visiblePeakTop = mountainTop + mountainRect.height * (48 / 328);
              const visiblePeakBottom = mountainTop + mountainRect.height * ((48 + 27.6) / 328);
              const summitPoint = {
                x: mountainLeft + mountainRect.width * 0.515 - beeWidthPx * 0.5,
                y: (visiblePeakTop + visiblePeakBottom) * 0.5 - beeWidthPx * 0.5,
              };
              if (runtime.mountainExitMode === 'retarget') {
                runtime.mountainExitSamples = buildArcLengthSamples([point, summitPoint, runtime.exitPoint]);
                runtime.mountainExitStartedSeconds = flowClock.seconds;
              }
              runtime.mountainPeakBounds = {
                left: mountainLeft + mountainRect.width * (168 / 390),
                right: mountainLeft + mountainRect.width * (232 / 390),
                top: visiblePeakTop,
                bottom: visiblePeakBottom,
              };
            }
          }
          if (runtime.mountainExitSamples) {
            const exitEndSeconds = runtime.knotTimes[runtime.knotTimes.length - 1];
            const exitRouteProgress = Math.max(0, Math.min(1,
              (flowClock.seconds - runtime.mountainExitStartedSeconds)
                / (exitEndSeconds - runtime.mountainExitStartedSeconds),
            ));
            const warpedExitProgress = exitRouteProgress
              + (0.08 / (Math.PI * 2)) * Math.sin(Math.PI * 2 * exitRouteProgress);
            activeSamples = runtime.mountainExitSamples;
            activeDistance = activeSamples[activeSamples.length - 1].distance * warpedExitProgress;
            point = sampleByDistance(activeSamples, activeDistance);
          }
        }
        const tangentLookahead = 8;
        const tangentStart = applyRouteWobble(
          sampleByDistance(activeSamples, activeDistance - tangentLookahead),
          activeDistance - tangentLookahead,
          activeSamples[activeSamples.length - 1].distance,
          runtime.verticalWobblePx,
          runtime.verticalWobbleCycles,
          runtime.horizontalWobblePx,
          runtime.horizontalWobbleCycles,
          runtime.verticalWobblePhase,
        );
        const tangentEnd = applyRouteWobble(
          sampleByDistance(activeSamples, activeDistance + tangentLookahead),
          activeDistance + tangentLookahead,
          activeSamples[activeSamples.length - 1].distance,
          runtime.verticalWobblePx,
          runtime.verticalWobbleCycles,
          runtime.horizontalWobblePx,
          runtime.horizontalWobbleCycles,
          runtime.verticalWobblePhase,
        );
        const velocityX = tangentEnd.x - tangentStart.x;
        const velocityY = tangentEnd.y - tangentStart.y;
        const deltaSeconds = Math.max(0, Math.min(1 / 30, flowClock.seconds - runtime.previousClockSeconds));
        const speedFactor = 1 + waveStrength * Math.cos(Math.PI * 2 * segmentProgress);
        runtime.xSetter(point.x);
        runtime.ySetter(point.y);
        if (runtime.mountainExitMode !== 'none' && runtime.mountainPeakBounds) {
          const beeLeft = point.x;
          const beeRight = point.x + beeWidthPx;
          const beeTop = point.y;
          const beeBottom = point.y + beeWidthPx;
          const shouldPassBehindMountain = Boolean(
            beeRight >= runtime.mountainPeakBounds.left
              && beeLeft <= runtime.mountainPeakBounds.right
              && beeBottom >= runtime.mountainPeakBounds.top
              && beeTop <= runtime.mountainPeakBounds.bottom,
          );
          if (shouldPassBehindMountain !== runtime.isBehindMountain) {
            runtime.isBehindMountain = shouldPassBehindMountain;
            const targetLayer = shouldPassBehindMountain
              ? forestTransitionSpecialBeeBehindMountainLayer
              : runtime.homeLayer;
            targetLayer?.appendChild(runtime.beeImage);
          }
        }
        const targetBank = Math.max(-11, Math.min(11,
          Math.atan2(velocityY, Math.max(0.01, Math.abs(velocityX))) * (180 / Math.PI) * 0.16,
        ));
        runtime.bank += (targetBank - runtime.bank) * (1 - Math.exp(-10 * deltaSeconds));
        runtime.rotationSetter(runtime.bank);
        const stretch = Math.max(-0.018, Math.min(0.045, (speedFactor - 1) * 0.055));
        const breath = Math.sin(travelledDistance / 93 + index * 2.17) * 0.010;
        const remainingDistance = activeSamples[activeSamples.length - 1].distance - activeDistance;
        const exitProgress = Math.max(0, Math.min(1, remainingDistance / 70));
        const exitScale = exitProgress * exitProgress * (3 - 2 * exitProgress);
        const lifetimeProgress = Math.max(0, Math.min(1,
          flowClock.seconds / runtime.knotTimes[runtime.knotTimes.length - 1],
        ));
        const proceduralExitProgress = Math.max(0, Math.min(1,
          (220 - remainingDistance) / (220 - 90),
        ));
        const smoothProceduralExit = proceduralExitProgress * proceduralExitProgress
          * (3 - 2 * proceduralExitProgress);
        const proceduralExitScale = 1 - 0.30 * smoothProceduralExit;
        const scaleChangeProgress = Math.max(0, Math.min(1,
          (lifetimeProgress - runtime.scaleChangeStart)
            / (runtime.scaleChangeEnd - runtime.scaleChangeStart),
        ));
        const smoothScaleProgress = scaleChangeProgress * scaleChangeProgress
          * (3 - 2 * scaleChangeProgress);
        const lifetimeScale = 1 + (runtime.lifetimeScale - 1) * smoothScaleProgress;
        const introScaleProgress = Math.max(0, Math.min(1, flowClock.seconds));
        const smoothIntroScale = introScaleProgress * introScaleProgress
          * (3 - 2 * introScaleProgress);
        const introScale = runtime.introStartScale
          + (1 - runtime.introStartScale) * smoothIntroScale;
        runtime.scaleXSetter(runtime.baseScale * introScale * lifetimeScale
          * (1 + stretch + breath) * proceduralExitScale * exitScale);
        runtime.scaleYSetter(runtime.baseScale * introScale * lifetimeScale
          * (1 - stretch * 0.65 - breath * 0.5) * proceduralExitScale * exitScale);
        const nextDirection = Math.abs(velocityX) > 0.12
          ? Math.sign(velocityX)
          : runtime.horizontalDirection;
        if (nextDirection !== runtime.horizontalDirection) {
          runtime.horizontalDirection = nextDirection;
          // A real NN horizontal reversal can last for fewer than the shared
          // 50ms directional-hysteresis window. Commit that facing change on
          // this frame; keep hysteresis for vertical/diagonal sprite changes.
          forestTransitionBeeDirectionStates.delete(runtime.beeImage);
        }
        pointForestTransitionBeeToward(runtime.beeImage, velocityX, velocityY, deltaSeconds);
        runtime.previousClockSeconds = flowClock.seconds;
        if (travelledDistance >= runtime.totalDistance) {
          gsap.set(runtime.beeImage, { display: 'none', visibility: 'hidden' });
        }
      });
    },
  }, 0);
  forestTransitionSpecialBeeTimeline.play(0);
}

function stopForestNNBees(): void {
  try { forestTransitionSpecialBeeTimeline?.kill(); } catch {}
  forestTransitionSpecialBeeTimeline = null;
  forestTransitionSpecialBeeImages.forEach((beeImage) => {
    try {
      forestTransitionBeeDirectionStates.delete(beeImage);
      resetPooledImage(beeImage);
      domElementPool.release(beeImage);
    } catch {}
  });
  forestTransitionSpecialBeeImages = [];
  try { forestTransitionSpecialBeeBehindMountainLayer?.remove(); } catch {}
  forestTransitionSpecialBeeBehindMountainLayer = null;
  try { forestTransitionSpecialBeeRearLayer?.remove(); } catch {}
  forestTransitionSpecialBeeRearLayer = null;
  try { forestTransitionSpecialBeeFrontLayer?.remove(); } catch {}
  forestTransitionSpecialBeeFrontLayer = null;
}

function pointForestTransitionBeeToward(
  beeImage: HTMLImageElement,
  velocityX: number,
  velocityY: number,
  deltaSeconds = 0,
): void {
  const state = forestTransitionBeeDirectionStates.get(beeImage);
  const fallback = state?.currentAsset ?? (velocityX < 0 ? 'bee3' : 'bee1');
  const candidate = getJourneyForestBeeAssetForVelocity(velocityX, velocityY, fallback);
  if (!state) {
    forestTransitionBeeDirectionStates.set(beeImage, {
      currentAsset: candidate,
      pendingAsset: null,
      pendingSeconds: 0,
    });
    beeImage.src = `./assets/shop/honey/${candidate}@2x.png`;
    return;
  }
  if (candidate === state.currentAsset) {
    state.pendingAsset = null;
    state.pendingSeconds = 0;
    return;
  }
  if (candidate !== state.pendingAsset) {
    state.pendingAsset = candidate;
    state.pendingSeconds = 0;
    return;
  }
  state.pendingSeconds += Math.max(0, Math.min(1 / 30, deltaSeconds));
  if (state.pendingSeconds < 0.05) return;
  state.currentAsset = candidate;
  state.pendingAsset = null;
  state.pendingSeconds = 0;
  beeImage.src = `./assets/shop/honey/${candidate}@2x.png`;
}

function isTransitionHillLayer(layerKey: string): boolean {
  return layerKey === 'mountain' || layerKey === 'hill1' || layerKey === 'hill2';
}

function getTransitionHillParallaxX(layerKey: string): number {
  if (layerKey === 'hill2') return 84;
  if (layerKey === 'hill1') return -67;
  if (layerKey === 'mountain') return 50;
  return 0;
}

function getTransitionHillBaseScale(layerKey: string): number {
  // Terrain PNGs contain transparent edge padding. These seam-safe scales keep
  // neighbouring layers overlapped through their complete horizontal drift.
  if (layerKey === 'mountain') return 1.45;
  if (layerKey === 'hill1') return 1.6;
  if (layerKey === 'hill2') return 1.53;
  return 1;
}

function getTransitionHillParallaxDuration(layerKey: string): number {
  if (layerKey === 'mountain') return 5.8;
  if (layerKey === 'hill1') return 5.5;
  if (layerKey === 'hill2') return 5.2;
  return 5.4;
}

function getTransitionHillNaturalSize(layerKey: string): { width: number; height: number } {
  if (layerKey === 'mountain') return { width: 390, height: 328 };
  if (layerKey === 'hill1') return { width: 390, height: 197 };
  if (layerKey === 'hill2') return { width: 390, height: 122 };
  return { width: 390, height: 240 };
}

function getTransitionHillExitConfig(layerKey: string): {
  dropY: number;
  scale: number;
  duration: number;
  ease: string;
} {
  if (layerKey === 'mountain') {
    return { dropY: 210, scale: 0.94, duration: 0.78, ease: 'back.in(1.18)' };
  }
  if (layerKey === 'hill1') {
    return { dropY: 210, scale: 0.96, duration: 0.71, ease: 'back.in(1.05)' };
  }
  return { dropY: 220, scale: 0.96, duration: 0.71, ease: 'back.in(1.05)' };
}

function getTransitionHillBaseX(layerKey: string): number {
  if (layerKey === 'hill2') return -20;
  if (layerKey === 'hill1') return -32;
  if (layerKey === 'mountain') return -72;
  return 0;
}

function startBeachAmbientMotion(sceneImg: HTMLElement, layerKey: string, motionRole: string): void {
  const ownAmbientTimeline = (timeline: gsap.core.Timeline): void => {
    contentTimelines.push(timeline);
    beachAmbientTimelines.set(sceneImg, timeline);
  };
  if (motionRole === 'float') {
    const isBottle = layerKey === 'beach-bottle';
    const horizontalDirection = sceneImg.dataset.floatDirection === 'left' ? -1 : 1;
    const rotationLimit = isBottle ? 24 : 84;
    const ambientTimeline = trackTimeline({ paused: true });
    ownAmbientTimeline(ambientTimeline);

    gsap.set(sceneImg, { transformOrigin: '50% 50%' });
    ambientTimeline.to(sceneImg, {
      // Keep xPercent exclusively owned by the base -50% centering pose. A small,
      // refreshed px drift avoids the former mechanical full-width wiper motion.
      x: () => horizontalDirection * (isBottle
        ? gsap.utils.random(69, 104)
        : gsap.utils.random(73, 117)),
      duration: () => gsap.utils.random(4.68, 6.24),
      ease: 'sine.out',
      repeat: -1,
      yoyo: true,
      repeatRefresh: true,
    }, 0);
    ambientTimeline.to(sceneImg, {
      y: () => isBottle ? gsap.utils.random(-18, -9) : gsap.utils.random(-22, -10),
      duration: () => gsap.utils.random(0.58, 0.96),
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true,
      repeatRefresh: true,
    }, 0);
    ambientTimeline.to(sceneImg, {
      rotation: () => gsap.utils.random(-rotationLimit, rotationLimit),
      duration: () => gsap.utils.random(0.58, 0.96),
      ease: 'sine.inOut',
      repeat: -1,
      repeatRefresh: true,
    }, 0);
    ambientTimeline.play(0);
    return;
  }

  if (motionRole === 'sea') {
    const ambientTimeline = trackTimeline({ paused: true });
    ownAmbientTimeline(ambientTimeline);
    const seaIndex = Math.max(1, Number(layerKey.match(/(\d+)$/)?.[1]) || 1);
    ambientTimeline.to(sceneImg, {
      x: seaIndex === 2 ? -38 * 1.25 : seaIndex === 1 ? 34 * 1.4 * 1.4 : 42,
      duration: (1.55 + seaIndex * 0.12) / 0.88,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true,
    }, 0);
    const boingDuration = 0.2 + Math.random() * 0.35;
    const boingTimeline = gsap.timeline({ repeat: -1, repeatDelay: 0.18 + Math.random() * 0.35 });
    boingTimeline.to(sceneImg, {
      y: seaIndex === 2 ? 5 : -5,
      duration: boingDuration,
      ease: 'sine.out',
    });
    boingTimeline.to(sceneImg, {
      y: 0,
      duration: Math.max(0.16, boingDuration * 0.78),
      ease: 'sine.in',
    });
    ambientTimeline.add(boingTimeline, 0);
    ambientTimeline.play(0);
    return;
  }
}

function startBeachSharedShoreAmbientMotion(sceneImages: HTMLElement[]): void {
  try { beachShoreAmbientTimeline?.kill(); } catch {}
  beachShoreAmbientTimeline = null;
  if (sceneImages.length === 0) return;

  const timeline = trackTimeline({ repeat: -1, yoyo: true });
  beachShoreAmbientTimeline = timeline;
  contentTimelines.push(timeline);
  timeline.to(sceneImages, {
    x: (_index: number, target: HTMLElement) => {
      const layerKey = target.dataset.sceneLayer || '';
      if (layerKey === 'beach-shore-1') return -7;
      if (layerKey === 'beach-shore-2') return 7;
      return 4;
    },
    y: (_index: number, target: HTMLElement) => target.dataset.sceneLayer === 'beach-castle' ? -2 : 2,
    rotation: (_index: number, target: HTMLElement) => target.dataset.sceneLayer === 'beach-shore-1' ? -0.3 : 0.3,
    scale: (_index: number, target: HTMLElement) => target.dataset.sceneLayer === 'beach-castle' ? 1.24 : 1.15,
    duration: 6.4,
    stagger: 0.08,
    ease: 'sine.inOut',
  });
}

function stopBeachAmbientMotion(sceneImg: HTMLElement): void {
  if (sceneImg.dataset.motionRole === 'shore' && beachShoreAmbientTimeline) {
    try { beachShoreAmbientTimeline.kill(); } catch {}
    beachShoreAmbientTimeline = null;
  }
  const owned = beachAmbientTimelines.get(sceneImg) ?? null;
  try { owned?.kill(); } catch {}
  beachAmbientTimelines.delete(sceneImg);
}

function startRoboGroundAmbientMotion(sceneImg: HTMLElement, layerKey: string, restX: number): void {
  const firstDirection = layerKey === 'robo-ground-rear' ? 1 : -1;
  const timeline = trackTimeline({ repeat: -1 });
  contentTimelines.push(timeline);
  const owned = roboGroundAmbientTimelines.get(sceneImg) ?? [];
  owned.push(timeline);
  roboGroundAmbientTimelines.set(sceneImg, owned);
  sceneImg.style.willChange = 'transform';
  timeline
    .to(sceneImg, { x: restX + firstDirection * 40, duration: 4.2, ease: 'sine.inOut' })
    .to(sceneImg, { x: restX - firstDirection * 40, duration: 8.4, ease: 'sine.inOut' })
    .to(sceneImg, { x: restX, duration: 4.2, ease: 'sine.inOut' });
}

function stopRoboGroundAmbientMotion(sceneImg: HTMLElement): void {
  const owned = roboGroundAmbientTimelines.get(sceneImg) ?? [];
  owned.forEach((timeline) => {
    try { timeline.kill(); } catch {}
  });
  roboGroundAmbientTimelines.delete(sceneImg);
}

function stopRoboAirCombatMotion(): void {
  roboAirCombatTimelines.forEach((timeline) => {
    try { timeline.kill(); } catch {}
  });
  roboAirCombatTimelines = [];
  roboAirCombatMasterTimeline = null;
}

function getRoboAirCombatHoldSeconds(): number {
  const timeline = roboAirCombatMasterTimeline;
  if (!timeline) return ROBO_AIR_COMBAT_HOLD_DURATION_SECONDS;
  return resolveRoboAirCombatHoldSeconds({
    minimumHoldSeconds: ROBO_AIR_COMBAT_HOLD_DURATION_SECONDS,
    combatDurationSeconds: timeline.duration(),
    combatElapsedSeconds: timeline.time(),
  });
}

function startRoboAirCombatMotion(
  sceneImagesByKey: Map<string, HTMLImageElement>,
  numberContainer: HTMLElement,
  forestContainer: HTMLElement,
): void {
  stopRoboAirCombatMotion();
  const leftShip = sceneImagesByKey.get('robo-fighter-left');
  const rightShip = sceneImagesByKey.get('robo-fighter-right');
  const beamRight = sceneImagesByKey.get('robo-beam-right');
  const beamHit = sceneImagesByKey.get('robo-beam-hit');
  const beamAfter = sceneImagesByKey.get('robo-beam-after');
  const beamFinal = sceneImagesByKey.get('robo-beam-final');
  const frontGround = sceneImagesByKey.get('robo-ground-front');
  const rearGround = sceneImagesByKey.get('robo-ground-rear');
  if (!leftShip || !rightShip || !beamRight || !beamHit || !beamAfter || !beamFinal || !frontGround || !rearGround) return;
  const sceneParent = forestContainer.parentElement;
  if (!sceneParent) return;

  // Keep the right fighter's path on a stable outer wrapper while its inner
  // image owns only the lightweight engine wobble and the normal scene exit.
  const rightShipMotion = document.createElement('div');
  const rightShipRenderedWidth = Math.max(1, rightShip.offsetWidth || Number.parseFloat(rightShip.style.width) || 108);
  const rightShipRenderedHeight = Math.max(1, rightShip.offsetHeight || rightShipRenderedWidth * (188 / 194));
  rightShipMotion.className = 'cc-robo-fighter-motion';
  rightShipMotion.dataset.sceneLayer = 'robo-fighter-right';
  rightShipMotion.style.cssText = rightShip.style.cssText;
  rightShipMotion.style.height = `${rightShipRenderedHeight}px`;
  rightShip.parentNode?.insertBefore(rightShipMotion, rightShip);
  rightShipMotion.appendChild(rightShip);
  rightShip.removeAttribute('data-scene-layer');
  rightShip.style.cssText = [
    'position: absolute',
    'inset: 0',
    'width: 100%',
    'height: 100%',
    'object-fit: contain',
    'opacity: 1',
    'transform-origin: 50% 50%',
  ].join('; ');
  activeSceneElements.push(rightShipMotion);

  // The scene container is one z-index context behind the complete NN unit, so
  // fighter-local z-index values can never cross the number. Two geometry-
  // matched hosts beside that context give the existing fighter nodes one rear
  // and one front lane without cloning sprites or adding another motion owner.
  const createFighterDepthLayer = (
    fighterSide: 'left' | 'right',
    zIndex: number,
  ): HTMLElement => {
    const layer = document.createElement('div');
    layer.className = `cc-robo-fighter-depth cc-robo-fighter-depth--${fighterSide}`;
    layer.dataset.roboFighterSide = fighterSide;
    layer.style.cssText = [
      'position: absolute',
      'left: 0',
      'right: 0',
      `bottom: ${forestContainer.style.bottom || '0px'}`,
      'width: 100%',
      `height: ${forestContainer.style.height || `${forestContainer.clientHeight}px`}`,
      'pointer-events: none',
      `z-index: ${zIndex}`,
      'overflow: visible',
      'transform-origin: center bottom',
    ].join('; ');
    sceneParent.appendChild(layer);
    activeSceneElements.push(layer);
    return layer;
  };
  const leftFighterDepthLayer = createFighterDepthLayer(
    'left',
    ROBO_FIGHTER_BEHIND_NUMBER_Z_INDEX,
  );
  const rightFighterDepthLayer = createFighterDepthLayer(
    'right',
    ROBO_FIGHTER_FRONT_NUMBER_Z_INDEX,
  );
  leftFighterDepthLayer.appendChild(leftShip);
  rightFighterDepthLayer.appendChild(rightShipMotion);
  const setRoboFighterNumberDepth = (leftShipInFront: boolean): void => {
    leftFighterDepthLayer.style.zIndex = String(leftShipInFront
      ? ROBO_FIGHTER_FRONT_NUMBER_Z_INDEX
      : ROBO_FIGHTER_BEHIND_NUMBER_Z_INDEX);
    rightFighterDepthLayer.style.zIndex = String(leftShipInFront
      ? ROBO_FIGHTER_BEHIND_NUMBER_Z_INDEX
      : ROBO_FIGHTER_FRONT_NUMBER_Z_INDEX);
    leftShip.dataset.roboNnDepth = leftShipInFront ? 'front' : 'behind';
    rightShipMotion.dataset.roboNnDepth = leftShipInFront ? 'behind' : 'front';
  };
  // The larger/lower right fighter starts in front. Their authored scale-depth
  // crossover later swaps both roles atomically, so one fighter always stays
  // behind NN while the other remains in front.
  setRoboFighterNumberDepth(false);

  const timeline = trackTimeline({ paused: true });
  roboAirCombatMasterTimeline = timeline;
  roboAirCombatTimelines.push(timeline);
  contentTimelines.push(timeline);
  // This master is the Area55 exit barrier. It includes the delayed fighter's
  // complete extended path so both ships keep roaming until the shared exit
  // takes over, without adding a second transition timer.
  const ships = [leftShip, rightShipMotion];
  const combatVariation = createRoboAirCombatVariation();
  activeRoboAirCombatVariation = combatVariation;
  if (areContinuousRuntimeDiagnosticsEnabled()) {
    console.info('[CC_ROBO_VARIATION]', combatVariation);
  }
  window.__ccRoboVariationTrace = [
    ...(window.__ccRoboVariationTrace ?? []).slice(-9),
    combatVariation,
  ];
  const fighterOnScreenX = Math.min(combatVariation.fighterEntryX, (window.innerWidth || 390) * 0.34);
  const flightJitter = Array.from({ length: 12 }, () => ({
    x: gsap.utils.random(-combatVariation.fighterJitterX, combatVariation.fighterJitterX),
    y: gsap.utils.random(-combatVariation.fighterJitterY, combatVariation.fighterJitterY),
  }));
  const rightHitPoint = {
    x: -45 + flightJitter[11].x * 0.25,
    y: -135 + flightJitter[11].y,
  };
  const leftShipRenderedWidth = Math.max(1, leftShip.offsetWidth || Number.parseFloat(leftShip.style.width) || 90);
  const leftShipRenderedHeight = Math.max(1, leftShip.offsetHeight || leftShipRenderedWidth * (188 / 194));
  const leftShipBottom = Number.parseFloat(leftShip.style.bottom) || 470;
  const leftShipRestTop = forestContainer.clientHeight - leftShipBottom - leftShipRenderedHeight;
  const leftShipUpperY = Math.min(20 - leftShipRestTop, rightHitPoint.y - 80);
  const leftShipEnterX = -((window.innerWidth || 390) * 0.5 + leftShipRenderedWidth + 60);
  const leftShipEnterY = -134;
  const rightShipEnterY = -32;

  gsap.set(ships, {
    opacity: 0,
    xPercent: -50,
    x: 0,
    y: 0,
    scale: 1.15,
    rotation: 0,
    transformOrigin: '50% 50%',
  });
  const leftShipBaseScale = 1.15;
  const rightShipBaseScale = leftShipBaseScale * 1.40;
  const rightShipEnterScale = rightShipBaseScale * 0.80;
  gsap.set(leftShip, { x: leftShipEnterX, y: leftShipEnterY, scale: leftShipBaseScale });
  gsap.set(rightShipMotion, { x: fighterOnScreenX, y: rightShipEnterY, scale: rightShipEnterScale });
  timeline.set(leftShip, { opacity: 1 }, 0);
  const numberRect = numberContainer.getBoundingClientRect();
  const forestRect = forestContainer.getBoundingClientRect();
  const numberCenterX = numberRect.left + numberRect.width * 0.5 - forestRect.left;
  const numberCenterY = numberRect.top + numberRect.height * 0.5 - forestRect.top;
  [{ beam: beamRight, x: numberCenterX + 100 }].forEach(({ beam, x }) => {
    beam.style.left = `${x}px`;
    beam.style.top = `${numberCenterY + 150}px`;
    beam.style.bottom = 'auto';
  });
  gsap.set([beamRight, beamHit, beamAfter, beamFinal], {
    opacity: 0,
    xPercent: -88,
    yPercent: -75,
    x: 0,
    y: 400,
    rotation: -90,
    scaleX: 1,
    scaleY: 1,
    filter: 'drop-shadow(0 0 9px rgba(104, 239, 255, 1))',
    transformOrigin: '50% 50%',
  });
  // The main timeline exclusively owns flight X/Y/rotation/scale. These small
  // relative percentages add an irregular engine-hover vibration without ever
  // pausing or overwriting that uninterrupted path.
  const combatWobbles: Array<{
    ship: HTMLImageElement;
    startDelay: number;
    phaseOffset: number;
    baseXPercent: number;
    amplitudeMultiplier: number;
    hoverXPercent: number;
    hoverYPercent: number;
  }> = [];
  const addContinuousFlightWobble = (
    ship: HTMLImageElement,
    startDelay: number,
    phaseOffset: number,
    baseXPercent = -50,
    amplitudeMultiplier = 1,
  ): void => {
    const shipWidth = Math.max(1, ship.offsetWidth || Number.parseFloat(ship.style.width) || 90);
    const shipAspectRatio = ship.naturalWidth > 0
      ? ship.naturalHeight / ship.naturalWidth
      : 188 / 194;
    const shipHeight = Math.max(1, ship.offsetHeight || shipWidth * shipAspectRatio);
    const hoverXPercent = 500 / shipWidth;
    const hoverYPercent = 500 / shipHeight;
    combatWobbles.push({
      ship,
      startDelay,
      phaseOffset,
      baseXPercent,
      amplitudeMultiplier,
      hoverXPercent,
      hoverYPercent,
    });
  };
  const LEFT_SHIP_START_DELAY_SECONDS = 0;
  const RIGHT_SHIP_START_DELAY_SECONDS = 0.20;
  const fighterFlightDurationSeconds = 4.20;
  const fighterCombatDurationSeconds = fighterFlightDurationSeconds + RIGHT_SHIP_START_DELAY_SECONDS;
  const beamFourStartSeconds = 2.12;
  addContinuousFlightWobble(
    leftShip,
    LEFT_SHIP_START_DELAY_SECONDS,
    gsap.utils.random(-Math.PI, Math.PI),
    -50,
    gsap.utils.random(1.55, 2.15),
  );
  addContinuousFlightWobble(
    rightShip,
    RIGHT_SHIP_START_DELAY_SECONDS,
    gsap.utils.random(-Math.PI, Math.PI),
    0,
    gsap.utils.random(1.35, 1.95),
  );
  timeline.set(rightShipMotion, { opacity: 1 }, RIGHT_SHIP_START_DELAY_SECONDS);

  type FlightPoint = { time: number; x: number; y: number; scale: number };
  const combatFlights: Array<{
    ship: HTMLElement;
    points: FlightPoint[];
    delay: number;
    bankPhase: number;
    actionDirection: RoboTravelDirection;
    actionSway: RoboAirCombatSwaySample;
    duration: number;
    onComplete?: () => void;
    finished: boolean;
  }> = [];
  const sampleSmoothFlightValue = (
    points: FlightPoint[],
    elapsed: number,
    key: 'x' | 'y',
  ): number => {
    let segmentIndex = 0;
    while (segmentIndex < points.length - 2 && elapsed >= points[segmentIndex + 1].time) {
      segmentIndex += 1;
    }
    const current = points[segmentIndex];
    const next = points[Math.min(points.length - 1, segmentIndex + 1)];
    const previous = points[Math.max(0, segmentIndex - 1)];
    const after = points[Math.min(points.length - 1, segmentIndex + 2)];
    const segmentDuration = Math.max(0.001, next.time - current.time);
    const progress = Math.max(0, Math.min(1, (elapsed - current.time) / segmentDuration));
    const progress2 = progress * progress;
    const progress3 = progress2 * progress;
    const currentSpan = Math.max(0.001, next.time - previous.time);
    const nextSpan = Math.max(0.001, after.time - current.time);
    const currentTangent = ((next[key] - previous[key]) / currentSpan) * segmentDuration;
    const nextTangent = ((after[key] - current[key]) / nextSpan) * segmentDuration;
    return (2 * progress3 - 3 * progress2 + 1) * current[key]
      + (progress3 - 2 * progress2 + progress) * currentTangent
      + (-2 * progress3 + 3 * progress2) * next[key]
      + (progress3 - progress2) * nextTangent;
  };
  const startContinuousFlight = (
    ship: HTMLElement,
    points: FlightPoint[],
    delay: number,
    bankPhase: number,
    actionDirection: RoboTravelDirection,
    onComplete?: () => void,
  ): void => {
    const duration = points[points.length - 1].time;
    combatFlights.push({
      ship,
      points,
      delay,
      bankPhase,
      actionDirection,
      actionSway: { x: 0, y: 0, bank: 0 },
      duration,
      onComplete,
      finished: false,
    });
  };
  const updateContinuousFlight = (
    runtime: (typeof combatFlights)[number],
    elapsed: number,
  ): void => {
        const { ship, points, bankPhase, actionDirection, duration } = runtime;
        let segmentIndex = 0;
        while (segmentIndex < points.length - 2 && elapsed >= points[segmentIndex + 1].time) {
          segmentIndex += 1;
        }
        const current = points[segmentIndex];
        const next = points[Math.min(points.length - 1, segmentIndex + 1)];
        const segmentDuration = Math.max(0.001, next.time - current.time);
        const progress = Math.max(0, Math.min(1, (elapsed - current.time) / segmentDuration));
        const smoothProgress = progress * progress * (3 - 2 * progress);
        const actionSway = sampleRoboAirCombatSway(
          elapsed / Math.max(0.001, duration),
          bankPhase,
          actionDirection,
          combatVariation.actionSwayX,
          combatVariation.actionSwayY,
          combatVariation.actionSwayCycles,
          runtime.actionSway,
        );
        const lateWanderProgress = Math.max(0, Math.min(1,
          (elapsed - beamFourStartSeconds) / Math.max(0.001, duration - beamFourStartSeconds),
        ));
        const lateWanderStrength = 1 + lateWanderProgress * 0.32;
        const bank = Math.max(-15, Math.min(15,
          Math.sin(elapsed * 5.2 + bankPhase) * 8
          + Math.sin(elapsed * 8.7 + bankPhase * 0.7) * 2
          + actionSway.bank * lateWanderStrength,
        ));
        gsap.set(ship, {
          x: sampleSmoothFlightValue(points, elapsed, 'x') + actionSway.x * lateWanderStrength,
          y: sampleSmoothFlightValue(points, elapsed, 'y') + actionSway.y * lateWanderStrength,
          scale: current.scale + (next.scale - current.scale) * smoothProgress,
          rotation: bank,
        });
  };
  const nnAppearSeconds = 1.30;
  const leftShipBeforeNn = {
    x: 20 + flightJitter[0].x,
    y: leftShipUpperY + 20 + flightJitter[1].y,
  };
  const leftShipAtNn = {
    x: leftShipBeforeNn.x + 50,
    y: leftShipBeforeNn.y - 68,
  };
  const rightShipBeforeNn = {
    x: -40 + flightJitter[1].x,
    y: -100 + flightJitter[2].y,
  };
  const rightShipAtNn = {
    x: rightShipBeforeNn.x,
    y: rightShipBeforeNn.y + 49,
  };
  const crossingVariation = {
    firstTime: gsap.utils.random(1.52, 1.66),
    secondTimeGap: gsap.utils.random(0.28, 0.40),
    swapMidpointGap: gsap.utils.random(0.30, 0.46),
    firstX: gsap.utils.random(86, 134),
    secondX: gsap.utils.random(92, 142),
    finalX: gsap.utils.random(72, 128),
    upperY: Math.min(leftShipUpperY - gsap.utils.random(18, 42), gsap.utils.random(-168, -136)),
    verticalSeparation: gsap.utils.random(192, 242),
    midpointX: gsap.utils.random(-34, 34),
    midpointYOffset: gsap.utils.random(-18, 18),
    leftBankPhase: gsap.utils.random(-Math.PI, Math.PI),
    rightBankPhase: gsap.utils.random(-Math.PI, Math.PI),
  };
  const crossingPolarity = combatVariation.crossingPolarity;
  const routeHorizontalScale = combatVariation.routeHorizontalScale;
  crossingVariation.firstX *= routeHorizontalScale;
  crossingVariation.secondX *= routeHorizontalScale;
  crossingVariation.finalX *= routeHorizontalScale;
  crossingVariation.upperY += combatVariation.routeVerticalBias;
  crossingVariation.verticalSeparation *= combatVariation.routeVerticalScale;
  const secondCrossTime = crossingVariation.firstTime + crossingVariation.secondTimeGap;
  const swapMidpointTime = Math.max(
    beamFourStartSeconds + 0.18,
    secondCrossTime + crossingVariation.swapMidpointGap,
  );
  timeline.call(() => setRoboFighterNumberDepth(true), undefined, swapMidpointTime);
  const finalLowerY = crossingVariation.upperY + crossingVariation.verticalSeparation;
  const verticalDepthScaleRatio = 0.60;
  const leftShipAtBeamFour = {
    x: crossingPolarity * crossingVariation.secondX + flightJitter[6].x - 67,
    y: crossingVariation.upperY - 50,
  };
  const rightShipAtBeamFour = {
    x: -crossingPolarity * crossingVariation.secondX + flightJitter[7].x + 45,
    y: finalLowerY,
  };
  const lowerShipPostBeamFourMidpoint = {
    x: leftShipAtBeamFour.x + combatVariation.postBeamDirection * 50,
    y: leftShipAtBeamFour.y - 10,
  };
  const lowerShipPostBeamFourEnd = {
    x: leftShipAtBeamFour.x + combatVariation.postBeamDirection * 100 + flightJitter[8].x * 0.25,
    y: leftShipAtBeamFour.y + 16,
  };
  const rightShipPostBeamFourMidpoint = {
    x: rightShipAtBeamFour.x - combatVariation.postBeamDirection * 22,
    y: rightShipAtBeamFour.y + 4,
  };
  const rightShipPostBeamFourEnd = {
    x: rightShipAtBeamFour.x - combatVariation.postBeamDirection * 44,
    y: rightShipAtBeamFour.y + 10,
  };
  const lateFlightVariation = {
    firstTime: 3.34,
    secondTime: 3.78,
    leftFirstX: gsap.utils.random(-92, 92),
    leftFirstY: gsap.utils.random(-52, 52),
    leftSecondX: gsap.utils.random(-78, 78),
    leftSecondY: gsap.utils.random(-44, 44),
    rightFirstX: gsap.utils.random(-84, 84),
    rightFirstY: gsap.utils.random(-48, 48),
    rightSecondX: gsap.utils.random(-72, 72),
    rightSecondY: gsap.utils.random(-40, 40),
  };
  startContinuousFlight(leftShip, [
    { time: 0, x: leftShipEnterX, y: leftShipEnterY, scale: leftShipBaseScale },
    { time: 0.72, x: leftShipBeforeNn.x, y: leftShipBeforeNn.y, scale: leftShipBaseScale * 1.50 },
    { time: nnAppearSeconds, x: leftShipAtNn.x, y: leftShipAtNn.y, scale: leftShipBaseScale * 1.50 * 0.90 },
    { time: crossingVariation.firstTime, x: -crossingPolarity * crossingVariation.firstX + flightJitter[4].x, y: leftShipUpperY - 18 + combatVariation.routeVerticalBias + flightJitter[5].y, scale: leftShipBaseScale * 1.42 },
    { time: secondCrossTime, x: crossingPolarity * crossingVariation.secondX + flightJitter[6].x, y: crossingVariation.upperY, scale: leftShipBaseScale * 1.48 },
    { time: beamFourStartSeconds, x: leftShipAtBeamFour.x, y: leftShipAtBeamFour.y, scale: leftShipBaseScale * 1.48 },
    { time: swapMidpointTime, x: lowerShipPostBeamFourMidpoint.x, y: lowerShipPostBeamFourMidpoint.y, scale: leftShipBaseScale * 1.72 },
    { time: 3.00, x: lowerShipPostBeamFourEnd.x, y: lowerShipPostBeamFourEnd.y, scale: leftShipBaseScale * 1.48 / verticalDepthScaleRatio },
    { time: lateFlightVariation.firstTime, x: lowerShipPostBeamFourEnd.x + lateFlightVariation.leftFirstX, y: lowerShipPostBeamFourEnd.y + lateFlightVariation.leftFirstY, scale: leftShipBaseScale * 2.34 },
    { time: lateFlightVariation.secondTime, x: lowerShipPostBeamFourEnd.x + lateFlightVariation.leftSecondX, y: lowerShipPostBeamFourEnd.y + lateFlightVariation.leftSecondY, scale: leftShipBaseScale * 2.42 },
    { time: fighterFlightDurationSeconds, x: lowerShipPostBeamFourEnd.x + flightJitter[9].x, y: lowerShipPostBeamFourEnd.y + flightJitter[10].y, scale: leftShipBaseScale * 2.38 },
  ], LEFT_SHIP_START_DELAY_SECONDS, crossingVariation.leftBankPhase, crossingPolarity);
  startContinuousFlight(rightShipMotion, [
    { time: 0, x: fighterOnScreenX, y: rightShipEnterY, scale: rightShipEnterScale },
    { time: 0.72, x: rightShipBeforeNn.x, y: rightShipBeforeNn.y, scale: rightShipBaseScale * 1.60 },
    { time: nnAppearSeconds, x: rightShipAtNn.x, y: rightShipAtNn.y, scale: rightShipBaseScale * 1.60 },
    { time: crossingVariation.firstTime, x: crossingPolarity * crossingVariation.firstX + flightJitter[5].x, y: -96 + combatVariation.routeVerticalBias + flightJitter[6].y, scale: rightShipBaseScale * 1.52 },
    { time: secondCrossTime, x: -crossingPolarity * crossingVariation.secondX + flightJitter[7].x, y: finalLowerY, scale: rightShipBaseScale * 1.46 },
    { time: beamFourStartSeconds, x: rightShipAtBeamFour.x, y: rightShipAtBeamFour.y, scale: rightShipBaseScale * 1.46 },
    { time: swapMidpointTime, x: rightShipPostBeamFourMidpoint.x, y: rightShipPostBeamFourMidpoint.y, scale: rightShipBaseScale * 1.12 },
    { time: 3.00, x: rightShipPostBeamFourEnd.x, y: rightShipPostBeamFourEnd.y, scale: rightShipBaseScale * 1.46 * verticalDepthScaleRatio },
    { time: lateFlightVariation.firstTime, x: rightShipPostBeamFourEnd.x + lateFlightVariation.rightFirstX, y: rightShipPostBeamFourEnd.y + lateFlightVariation.rightFirstY, scale: rightShipBaseScale * 0.90 },
    { time: lateFlightVariation.secondTime, x: rightShipPostBeamFourEnd.x + lateFlightVariation.rightSecondX, y: rightShipPostBeamFourEnd.y + lateFlightVariation.rightSecondY, scale: rightShipBaseScale * 0.86 },
    { time: fighterFlightDurationSeconds, x: rightShipPostBeamFourEnd.x + flightJitter[10].x, y: rightShipPostBeamFourEnd.y + flightJitter[11].y, scale: rightShipBaseScale * 0.88 },
  ], RIGHT_SHIP_START_DELAY_SECONDS, crossingVariation.rightBankPhase, (crossingPolarity * -1) as RoboTravelDirection);

  // One runtime clock replaces the former two wobble and two flight
  // onUpdate timelines. Flight paths clamp once at their authored end while
  // engine wobble remains continuous until the Area55 exit owner stops it.
  const combatRuntimeClock = { elapsed: 0 };
  const combatRuntimeTimeline = trackTimeline({ paused: true });
  roboAirCombatTimelines.push(combatRuntimeTimeline);
  contentTimelines.push(combatRuntimeTimeline);
  combatRuntimeTimeline.to(combatRuntimeClock, {
    elapsed: 60 * 60,
    duration: 60 * 60,
    ease: 'none',
    onUpdate: () => {
      const sceneElapsed = combatRuntimeClock.elapsed;
      combatWobbles.forEach((runtime) => {
        if (sceneElapsed < runtime.startDelay) return;
        const phase = runtime.phaseOffset + (sceneElapsed - runtime.startDelay) * Math.PI * 2;
        const xWave = Math.sin(phase * 1.37) * 0.72 + Math.sin(phase * 2.11 + 0.8) * 0.28;
        const yWave = Math.sin(phase * 1.73 + 1.2) * 0.70 + Math.sin(phase * 2.47) * 0.30;
        gsap.set(runtime.ship, {
          xPercent: runtime.baseXPercent + runtime.hoverXPercent * runtime.amplitudeMultiplier * xWave,
          yPercent: runtime.hoverYPercent * runtime.amplitudeMultiplier * yWave,
          skewX: Math.sin(phase * 1.19 + 0.4) * 1.5,
        });
      });
      combatFlights.forEach((runtime) => {
        if (runtime.finished || sceneElapsed < runtime.delay) return;
        const elapsed = Math.min(runtime.duration, sceneElapsed - runtime.delay);
        updateContinuousFlight(runtime, elapsed);
        if (elapsed >= runtime.duration) {
          runtime.finished = true;
          try { runtime.onComplete?.(); } catch {}
        }
      });
    },
  });

  const addBeamShot = (
    beam: HTMLImageElement,
    start: number,
    rotation: number,
    horizontalTravel: number,
    launchZIndex = 59,
    scaleMultiplier = 1,
    travelMultiplier = 1,
    destinationYOffset = 0,
    destinationXOffset = 0,
    mirroredY = false,
    launchYOffset = 0,
    launchXRatio?: number,
  ): void => {
    const beamFadeOutDurationSeconds = 0.1 * 0.70;
    const launchJitterX = gsap.utils.random(-22, 22);
    const flightScale = gsap.utils.random(2.10, 2.35) * scaleMultiplier;
    const entersFromLeft = horizontalTravel >= 0;
    const beamIntrinsicAxisDegrees = mirroredY ? -22.6 : 22.6;
    const verticalTravelPx = 480 * travelMultiplier + destinationYOffset - launchYOffset;
    const authoredAxisRadians = (rotation + 180 + beamIntrinsicAxisDegrees) * Math.PI / 180;
    const authoredAxisSin = Math.sin(authoredAxisRadians);
    const projectedHorizontalTravelPx = Math.abs(authoredAxisSin) > 0.08
      ? verticalTravelPx * Math.cos(authoredAxisRadians) / authoredAxisSin
      : horizontalTravel;
    const horizontalDirection = Math.sign(horizontalTravel) || 1;
    const minimumHorizontalTravelPx = Math.min(
      forestContainer.clientWidth * 0.48,
      Math.max(170, Math.abs(horizontalTravel) * travelMultiplier * 1.12),
    );
    const maximumHorizontalTravelPx = Math.max(
      minimumHorizontalTravelPx,
      forestContainer.clientWidth * 0.68,
    );
    const alignedHorizontalTravelPx = horizontalDirection * Math.max(
      minimumHorizontalTravelPx,
      Math.min(maximumHorizontalTravelPx, Math.abs(projectedHorizontalTravelPx)),
    ) + destinationXOffset + launchJitterX;
    const travelAxisDegrees = Math.atan2(verticalTravelPx, alignedHorizontalTravelPx) * 180 / Math.PI;
    const renderedBeamRotationDegrees = travelAxisDegrees - beamIntrinsicAxisDegrees;
    const launchAnchor = {
      x: forestContainer.clientWidth * (launchXRatio ?? (entersFromLeft ? 0.12 : 0.88)),
      y: -forestRect.top - 70 + launchYOffset,
    };
    timeline.set(beam, {
      opacity: 1,
      zIndex: launchZIndex,
      xPercent: -88,
      yPercent: -75,
      x: () => launchAnchor.x - beam.offsetLeft,
      y: () => launchAnchor.y - beam.offsetTop,
      scaleX: flightScale,
      scaleY: mirroredY ? -flightScale : flightScale,
      rotation: renderedBeamRotationDegrees,
      transformOrigin: '88% 75%',
    }, start);
    timeline.call(() => {
      if (!areContinuousRuntimeDiagnosticsEnabled()) return;
      const payload = {
        beam: beam.dataset.sceneLayer || 'unknown',
        sourceCorner: entersFromLeft ? 'top-left' : 'top-right',
        sourceX: Math.round(launchAnchor.x),
        sourceY: Math.round(launchAnchor.y),
        direction: alignedHorizontalTravelPx < 0 ? 'down-left' : 'down-right',
        travelX: Math.round(alignedHorizontalTravelPx),
        travelY: Math.round(verticalTravelPx),
        travelAxisDegrees: Number(travelAxisDegrees.toFixed(2)),
        renderedBeamRotationDegrees: Number(renderedBeamRotationDegrees.toFixed(2)),
        beamZIndex: window.getComputedStyle(beam).zIndex,
        frontGroundZIndex: window.getComputedStyle(frontGround).zIndex,
        rearGroundZIndex: window.getComputedStyle(rearGround).zIndex,
      };
      console.info('[CC_ROBO_BEAM_DEPTH]', payload);
      window.__ccRoboBeamDepthTrace = [
        ...(window.__ccRoboBeamDepthTrace ?? []).slice(-9),
        payload,
      ];
    }, undefined, start);
    timeline.to(beam, {
      opacity: 1,
      x: () => launchAnchor.x - beam.offsetLeft
        + alignedHorizontalTravelPx,
      y: () => launchAnchor.y - beam.offsetTop
        + verticalTravelPx,
      scaleX: 1,
      scaleY: mirroredY ? -1 : 1,
      filter: 'drop-shadow(0 0 12px rgba(104, 239, 255, 1))',
      duration: 0.6,
      ease: 'none',
    }, start);
    timeline.to(beam, {
      opacity: 1,
      duration: 0.1,
      ease: 'none',
    }, start + 0.6);
    timeline.to(beam, {
      opacity: 0,
      scaleX: 1.55,
      scaleY: mirroredY ? -1.55 : 1.55,
      duration: beamFadeOutDurationSeconds,
      ease: 'none',
    }, start + 0.7);
  };
  // Beams enter independently from just above the top-left or top-right edge,
  // choosing the opposite corner from their horizontal fall direction. They
  // are not attached to fighter geometry and travel downward into the scene.
  // Only Beam 1 and the late mirrored Beam 4 fire; both remain behind the
  // upper/rear zemlja2 while ships continue to NN exit.
  const firstBeamStartSeconds = RIGHT_SHIP_START_DELAY_SECONDS;
  addBeamShot(
    beamHit,
    firstBeamStartSeconds,
    -96 + combatVariation.beamOne.rotationOffset,
    -154,
    29,
    combatVariation.beamOne.scaleMultiplier,
    combatVariation.beamOne.travelMultiplier,
    0,
    combatVariation.beamOne.destinationXOffset,
    false,
    0,
    combatVariation.beamOne.launchXRatio,
  );
  addBeamShot(
    beamFinal,
    beamFourStartSeconds,
    -96 + combatVariation.beamFour.rotationOffset,
    154,
    29,
    combatVariation.beamFour.scaleMultiplier,
    combatVariation.beamFour.travelMultiplier,
    -70,
    combatVariation.beamFour.destinationXOffset,
    true,
    -40,
    combatVariation.beamFour.launchXRatio,
  );

  // Keep the swapped-height fighters visible and wobbling until NN exit owns
  // their one-way off-screen departure.
  timeline.to({}, { duration: 0.001, ease: 'none' }, fighterCombatDurationSeconds);
  roboAirCombatTimelines
    .filter((ownedTimeline) => ownedTimeline !== timeline)
    .forEach((ownedTimeline) => ownedTimeline.play(0));
  timeline.play(0);
}

function resetPooledImage(img: HTMLImageElement): void {
  try { gsap.killTweensOf(img); } catch {}
  try { gsap.set(img, { clearProps: 'all' }); } catch {}
  img.removeAttribute('style');
  img.removeAttribute('class');
  img.removeAttribute('data-scene-layer');
  img.removeAttribute('data-spatial-role');
  img.removeAttribute('data-motion-role');
  img.removeAttribute('data-float-direction');
  img.removeAttribute('data-forest-bee-group');
  img.removeAttribute('data-forest-bee-depth');
  img.removeAttribute('data-forest-bee-rest-scale');
  img.removeAttribute('data-forest-bee-low-fence');
  img.removeAttribute('data-forest-special-bee-index');
  img.removeAttribute('data-forest-special-bee-role');
  img.removeAttribute('data-robo-nn-depth');
  img.removeAttribute('fetchpriority');
  img.style.animation = 'none';
  img.draggable = false;
}

const lifecycle = createScreenLifecycle('board-transition-screen');
const TRANSITION_HAPTIC_FIRST_DELAY = 0.1;
const TRANSITION_HAPTIC_OTHER_DELAY = 0.25;
const TRANSITION_EXIT_HAPTIC_FIRST_DELAY = 0.3;
const TRANSITION_EXIT_HAPTIC_SECOND_GAP = 0.3;
export const BOARD_TRANSITION_HOLD_DURATION_SECONDS = 0.4;
export const ROBO_AIR_COMBAT_HOLD_DURATION_SECONDS = 0;
export const BOARD_TRANSITION_EXIT_PARALLAX_LEAD_SECONDS = 0.35;
export const BOARD_TRANSITION_HILL_EXIT_LAG_SECONDS = 0.2;
const BOARD_TRANSITION_REGULAR_SCENE_EXIT_SECONDS = 0.28;
export const BOARD_TRANSITION_CLOUD_EXIT_ANTICIPATION_SECONDS = 0.07;
export const BOARD_TRANSITION_CLOUD_EXIT_REBOUND_SECONDS = 0.065;
export const BOARD_TRANSITION_CLOUD_EXIT_COLLAPSE_SECONDS = 0.46;
export const BEACH_CURTAIN_PALM_DWELL_SECONDS = 0.4;
const BEACH_CURTAIN_PALM_STILL_SECONDS = 0.1;
const BEACH_CURTAIN_PALM_EXIT_SECONDS = 0.62;
const BEACH_CURTAIN_PALM_EXIT_STAGGER_SECONDS = 0.1;
const BEACH_CURTAIN_PALM_FLOAT_LEG_SECONDS = (
  BEACH_CURTAIN_PALM_DWELL_SECONDS - BEACH_CURTAIN_PALM_STILL_SECONDS
) / 2;

const BEACH_CURTAIN_PALM_MOTION = Object.freeze({
  1: Object.freeze({ restScale: 1, restRotation: 12, enterStartYRatio: 0.54 }),
  2: Object.freeze({ restScale: 0.8, restRotation: -12, enterStartYRatio: 0.43 }),
  3: Object.freeze({ restScale: 1, restRotation: 12, enterStartYRatio: 0.5 }),
  4: Object.freeze({ restScale: 0.8, restRotation: -12, enterStartYRatio: 0.39 }),
  5: Object.freeze({ restScale: 0.8, restRotation: 12, enterStartYRatio: 0.47 }),
});
const BEACH_CLOUD_SPAWN_SLOTS = Object.freeze([
  Object.freeze({ left: 4, top: 2 }),
  Object.freeze({ left: 52, top: 7 }),
  Object.freeze({ left: 96, top: 2 }), // Slot 2 remains intentionally omitted below.
  Object.freeze({ left: 96, top: 1 }),
  Object.freeze({ left: 12, top: 22 }),
  Object.freeze({ left: 55, top: 32 }),
  Object.freeze({ left: 90, top: 39 }),
  Object.freeze({ left: 3, top: 28 }),
  Object.freeze({ left: 50, top: 25 }),
  Object.freeze({ left: 97, top: 30 }),
  Object.freeze({ left: 23, top: 39 }),
  Object.freeze({ left: 77, top: 37 }),
]);

function ensureCloudStyles(): void {
  if (document.getElementById('cc-board-transition-cloud-styles')) return;
  const style = document.createElement('style');
  style.id = 'cc-board-transition-cloud-styles';
  style.textContent = CLOUD_CSS_STYLES;
  document.head.appendChild(style);
}

async function preloadTransitionAssets(
  sceneLayers: readonly BoardTransitionThemeLayer[],
  includeForestBees = false,
): Promise<void> {
  const urls = [
    ...TRANSITION_CLOUD_IMAGES,
    ...sceneLayers.map((layer) => layer.src),
    ...(includeForestBees ? FOREST_TRANSITION_BEE_ASSETS : []),
  ];
  const missingUrls = urls.filter((src) => !preloadedTransitionAssetUrls.has(src));
  if (missingUrls.length === 0) return;
  if (assetsPreloadPromise) {
    await assetsPreloadPromise;
    return preloadTransitionAssets(sceneLayers, includeForestBees);
  }
  assetsPreloadPromise = (async () => {
    try {
      logger.info('🧩 board-transition-screen: Preloading transition assets...');
      await Promise.all(missingUrls.map((src) => new Promise<void>((resolve) => {
        const img = new Image();
        img.src = src;
        if (typeof img.decode === 'function') {
          img.decode().then(() => resolve()).catch(() => resolve());
        } else {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        }
      })));
      missingUrls.forEach((src) => preloadedTransitionAssetUrls.add(src));
      logger.info('✅ board-transition-screen: Transition assets preloaded');
    } finally {
      assetsPreloadPromise = null;
    }
  })();
  return assetsPreloadPromise;
}

function startMemSampling(): void {
  const mem = (performance as any)?.memory;
  if (!mem || typeof mem.usedJSHeapSize !== 'number') {
    console.log('📊 board-transition-screen: Memory sampling not available (performance.memory only in Chrome)');
    return;
  }
  if (memSampleInterval) {
    clearInterval(memSampleInterval);
    memSampleInterval = null;
  }
  memSampleStart = mem.usedJSHeapSize;
  memSamplePeak = memSampleStart;
  memSampleStartTs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  memSampleInterval = window.setInterval(() => {
    const m = (performance as any)?.memory;
    if (m && typeof m.usedJSHeapSize === 'number') {
      if (m.usedJSHeapSize > memSamplePeak) memSamplePeak = m.usedJSHeapSize;
    }
  }, 120);
  console.log('📊 board-transition-screen: Memory sampling started', { startUsedJSHeapSize: memSampleStart });
}

function stopMemSampling(label: string): void {
  if (!memSampleInterval) return;
  clearInterval(memSampleInterval);
  memSampleInterval = null;
  const mem = (performance as any)?.memory;
  const end = mem && typeof mem.usedJSHeapSize === 'number' ? mem.usedJSHeapSize : null;
  const duration = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - memSampleStartTs;
  const payload = {
    startUsedJSHeapSize: memSampleStart,
    peakUsedJSHeapSize: memSamplePeak,
    endUsedJSHeapSize: end,
    peakDelta: memSamplePeak - memSampleStart,
    durationMs: Math.round(duration)
  };
  console.log(`📊 board-transition-screen: Memory sampling ${label}`, payload);
}

/**
 * Show board transition screen with animated board number
 * @param options - Board number and completion callback
 */
export async function showBoardTransitionScreen(options: BoardTransitionOptions): Promise<void> {
  const { boardNumber, onComplete, hideForest = false, displayText, theme } = options;
  const resolvedTheme = resolveBoardTransitionTheme({
    boardNumber,
    explicitTheme: theme,
    hideForest,
    runMode: getRunMode(),
  });
  const selectedProfile = resolvedTheme === 'beach'
    ? BEACH_BOARD_TRANSITION_PROFILE
    : resolvedTheme === 'area55'
      ? AREA55_BOARD_TRANSITION_PROFILE
      : null;
  const sceneLayers: readonly BoardTransitionThemeLayer[] = selectedProfile?.layers ?? TRANSITION_SCENE_LAYERS;
  const sceneEnterOrder: readonly string[] = selectedProfile?.enterOrder ?? TRANSITION_SCENE_ENTER_ORDER;
  const showScene = resolvedTheme !== 'none';
  const beachVariation: BeachTransitionVariation | null = resolvedTheme === 'beach'
    ? createNextBeachTransitionVariation()
    : null;
  const roboVariation: RoboTransitionVariation | null = resolvedTheme === 'area55'
    ? createRoboTransitionVariation()
    : null;
  if (roboVariation) {
    const directionTrace = {
      boardNumber,
      front: roboVariation.frontTravelDirection === 1 ? 'left-to-right' : 'right-to-left',
      walker: roboVariation.walkerTravelDirection === 1 ? 'left-to-right' : 'right-to-left',
    };
    logger.info('[CC_ROBO_DIRECTION]', directionTrace);
    window.__ccRoboDirectionTrace = [
      ...(window.__ccRoboDirectionTrace ?? []).slice(-19),
      directionTrace,
    ];
  }
  beginBoardLifecycleTrace('board-transition', boardNumber);
  markBoardLifecycle('transition-start');

  // 🔥 CRITICAL FIX: Validate boardNumber
  if (!Number.isFinite(boardNumber) || boardNumber < 1) {
    logger.error(`❌ board-transition-screen: Invalid boardNumber ${boardNumber}, using fallback 1`);
    // Don't return - use fallback instead
    const validBoardNumber = 1;
    return showBoardTransitionScreen({ ...options, boardNumber: validBoardNumber });
  }

  logger.info(`🎯 board-transition-screen: Showing transition for board ${boardNumber}`, {
    hideForest,
    theme: resolvedTheme,
    displayText
  });

  // Prevent duplicate calls
  if (isTransitionActive) {
    logger.warn('⚠️ board-transition-screen: Already active, skipping duplicate call');
    return;
  }

  isTransitionActive = true;
  const activeGeneration = ++transitionGeneration;
  logger.info('✅ board-transition-screen: isTransitionActive set to true, starting transition');

            // Defensive cleanup is handled centrally in endgame-flow before transition

  // Fade out menu soundtrack over 2s when board transition starts (board game has its own melody)
  void import('./soundtrack-manager.js')
    .then(({ fadeOutAndPause }) => fadeOutAndPause(2000))
    .catch(() => undefined);

  // Main Forest bees change directional PNGs on their first flight frame. Decode
  // those seven small textures before the overlay starts so a cold iOS cache
  // cannot turn scheduled bees into visually blank elements.
  if (resolvedTheme === 'forest') {
    await preloadTransitionAssets([], true);
    if (!isTransitionActive || activeGeneration !== transitionGeneration) return;
  }
  preloadTransitionAssets(showScene ? sceneLayers : [], false).catch((error) => {
    logger.warn('⚠️ board-transition-screen: Background preload failed:', error);
  });
  import('../utils/board-asset-warmup.js')
    .then(({ warmBoardGameAssets }) => {
      void warmBoardGameAssets({
        mode: 'journey',
        boardNumber,
        reason: 'board-transition-screen',
        timeoutMs: 2200,
      });
    })
    .catch((error) => {
      logger.warn('⚠️ board-transition-screen: Board asset warmup import failed:', error);
    });
  
  // Cleanup any existing overlay (preserve DOM for reuse)
  cleanup({ preserveDom: true });
  startIOSJourneyPerformanceAudit(boardNumber);
  
  // 🔥 USER REQUEST: Reset paper background when transition screen closes
  // This will be called in cleanup() after transition completes

  return new Promise((resolve, reject) => {
    let finishOnce: BoardTransitionSettlement;
    finishOnce = createBoardTransitionSettlement({
      resolve,
      reject,
      onSettled: () => {
        if (activeTransitionSettlement === finishOnce) activeTransitionSettlement = null;
        try { sampleMemorySpike('4_transition_complete'); } catch {}
        stopMemSampling('finished');
        markBoardLifecycle('transition-complete');
      },
      onComplete: async () => {
        logger.info('[CC_BOARD_HANDOFF] onComplete-start', { generation: activeGeneration, boardNumber });
        try {
          await onComplete();
          logger.info('[CC_BOARD_HANDOFF] onComplete-resolve', { generation: activeGeneration, boardNumber });
        } catch (onCompleteError) {
          logger.error('[CC_BOARD_HANDOFF] onComplete-reject', { generation: activeGeneration, boardNumber, error: onCompleteError });
          cleanup();
          isTransitionActive = false;
          throw onCompleteError;
        }
      },
    });
    activeTransitionSettlement = finishOnce;
    // 🔥 iOS APP STORE: Wrap in try-catch for error handling
    try {
      startMemSampling();
      // 🔥 USER REQUEST: Apply paper background with same opacity as board game (35%)
      // This replaces the gray overlay with paper texture
      applyPaperBackground();
    } catch (error) {
      logger.error('❌ board-transition-screen: Failed to apply paper background:', error);
      // Continue anyway - non-critical
    }
    
    try {
    
    const reuseOverlay = !!currentOverlay && currentOverlay.isConnected;
    let overlay: HTMLElement;
    let container: HTMLElement;
    let numberContainer: HTMLElement;
    let cloudContainer: HTMLElement | null = null;
    let cloudBehindHillContainer: HTMLElement | null = null;
    let cloudMidContainer: HTMLElement | null = null;
    let cloudFrontContainer: HTMLElement | null = null;
    let forestContainer: HTMLElement | null = null;
    if (reuseOverlay) {
      logger.info('♻️ board-transition-screen: Reusing existing transition overlay');
      overlay = currentOverlay as HTMLElement;
      overlay.style.display = 'flex';
      overlay.style.visibility = 'visible';
      overlay.style.opacity = '0';
      overlay.style.pointerEvents = 'none';
      applyAppPaperSurfaceToElement(overlay);
      container = overlay.querySelector('.cc-board-transition-container') as HTMLElement;
      numberContainer = overlay.querySelector('.cc-board-transition-number') as HTMLElement;
      cloudContainer = overlay.querySelector('.cc-board-transition-clouds') as HTMLElement | null;
      cloudBehindHillContainer = overlay.querySelector('.cc-board-transition-clouds-behind-hill') as HTMLElement | null;
      cloudMidContainer = overlay.querySelector('.cc-board-transition-clouds-mid') as HTMLElement | null;
      cloudFrontContainer = overlay.querySelector('.cc-board-transition-clouds-front') as HTMLElement | null;
      forestContainer = overlay.querySelector('.cc-board-transition-forest') as HTMLElement | null;
      try { sampleMemorySpike('3_transition_overlay_shown'); } catch {}
    } else {
      logger.info('🧱 board-transition-screen: Building transition overlay (first-time)');
      // Create overlay (transparent - paper bg shows through)
      overlay = document.createElement('div');
      overlay.id = 'cc-board-transition-overlay';
      overlay.style.cssText = [
        'position: fixed',
        'inset: 0',
        'background: transparent', // 🔥 USER REQUEST: Transparent so paper bg shows through
        'z-index: 99999',
        'display: flex',
        'flex-direction: column',
        'align-items: center',
        'justify-content: center',
        'padding: 0', // 🔥 CRITICAL FIX: Remove padding that could affect centering
        'opacity: 0',
        'pointer-events: none',
        'overflow: visible',
        'visibility: visible' // 🔥 CRITICAL FIX: Ensure overlay is visible even when opacity is 0
      ].join(';');
      applyAppPaperSurfaceToElement(overlay);

      // Create container with 3D perspective
      container = document.createElement('div');
      container.className = 'cc-board-transition-container';
      container.style.cssText = [
        'display: flex',
        'flex-direction: column',
        'align-items: center',
        'justify-content: center',
        'width: 100%',
        'gap: 0',
        // 🔥 USER REQUEST: 3D perspective for container
        'perspective: 1000px',
        'transform-style: preserve-3d',
        'position: relative',
        'z-index: 10' // Keep board number above scene and clouds.
      ].join(';');

      // Create board number container
      numberContainer = document.createElement('div');
      numberContainer.className = 'cc-board-transition-number';
      numberContainer.style.cssText = [
        'display: flex',
        'flex-direction: row',
        'align-items: center',
        'justify-content: center',
        'gap: 0px', // 🔥 USER REQUEST: No gap - digits should be very close together
        'margin-top: -8px', // 🔥 USER REQUEST: Reduced by 16px (from 8px to -8px) to bring closer to "board" text
        // 🔥 CRITICAL FIX: Remove all margins - will be positioned absolutely
        'margin-left: 0',
        'margin-right: 0',
        'margin-bottom: 0',
        'padding: 0',
        'width: fit-content', // Fit content exactly - no extra width
        'min-width: 0', // Prevent flex from adding extra width
        'max-width: 100%', // Prevent overflow
        'box-sizing: border-box', // Include padding/border in width calculation
        'position: relative'
      ].join(';');
    }

    // Shared by Forest, Beach, Area 55, and scene-less transitions. The
    // accepted 15vh lift plus another 6vh places the number near 29vh.
    numberContainer.style.transform = 'translate3d(0, -21vh, 0)';

    // Board IDs remain global (1-30) for save/progression ownership, while
    // every Journey World presents its connected Unit as local Stage 01-10.
    const transitionText = (typeof displayText === 'string' && displayText.trim().length > 0)
      ? displayText.trim().toUpperCase()
      : formatJourneyWorldStageNumber(boardNumber);
    const digits = Array.from(transitionText);
    
    logger.info(`🎯 board-transition-screen: Formatting transition text "${transitionText}" with ${digits.length} characters`);

    // 🔥 CRITICAL FIX: Validate digits array is not empty
    if (digits.length === 0) {
      logger.error(`❌ board-transition-screen: No digits to display for board number ${boardNumber}`);
      cleanup();
      isTransitionActive = false;
      finishOnce();
      return;
    }

    // Create or reuse digit elements with 3D extrusion effect
    const digitElements: HTMLElement[] = [];
    const existingDigits = Array.from(numberContainer.querySelectorAll('.cc-board-transition-digit')) as HTMLElement[];
    if (existingDigits.length === digits.length) {
      existingDigits.forEach((digitEl, index) => {
        digitEl.textContent = digits[index];
        digitEl.style.filter = 'none';
        digitElements.push(digitEl);
      });
    } else {
      numberContainer.innerHTML = '';
      digits.forEach((digit, index) => {
        // 🔥 CRITICAL FIX: Create wrapper for digit
        const digitWrapper = document.createElement('div');
        digitWrapper.className = 'journey-board-card-wrapper';
        digitWrapper.style.cssText = [
          'display: inline-flex !important', // Override CSS class
          'align-items: center',
          'justify-content: center',
          'width: auto', // 🔥 CRITICAL FIX: Let content determine width - no min-width in layout
          'height: auto', // 🔥 CRITICAL FIX: Let content determine height
          'position: relative !important', // 🔥 CRITICAL FIX: Override absolute from CSS class
          // 🔥 CRITICAL FIX: Remove all spacing that could affect centering
          'margin: 0 !important',
          'padding: 0 !important',
          'border: 0 !important',
          'outline: 0 !important',
          'vertical-align: top', // Align to top to prevent baseline spacing
          'z-index: 10'
        ].join(';');
        
        const digitEl = document.createElement('span');
        digitEl.textContent = digit;
        digitEl.className = 'cc-board-transition-digit'; // For cleanup identification
        
        const dropShadow = 'none';
        
        digitEl.style.cssText = [
          'font-family: "Baloo2", system-ui, -apple-system, sans-serif',
          'font-weight: 800',
          'font-size: 166px', // 🔥 USER REQUEST: Increased by 15% (144px * 1.15 = 165.6px ≈ 166px)
          'line-height: 1',
          'color: #e77449',
          'text-align: center',
          'opacity: 0',
          'transform: scale(0) perspective(1000px) translateZ(0)',
          'display: inline-block',
          'visibility: visible', // 🔥 CRITICAL FIX: Ensure element is visible
          'pointer-events: none',
          // 🔥 CRITICAL FIX: Remove all spacing that could affect centering
          'margin: 0',
          'padding: 0',
          'border: 0',
          'outline: 0',
          'vertical-align: top', // Align to top to prevent baseline spacing
          // 🔥 USER REQUEST: Remove drop shadow/filter effects
          `filter: ${dropShadow}`,
          'transform-style: preserve-3d',
          'backface-visibility: hidden',
          '-webkit-font-smoothing: antialiased',
          '-moz-osx-font-smoothing: grayscale',
          'text-rendering: optimizeLegibility',
          'font-variant-numeric: tabular-nums', // Stabilize digit widths for better centering
          'font-feature-settings: "tnum" 1',
          // 🔥 CRITICAL FIX: Set transform origin to center to prevent position shifts
          'transform-origin: center center',
          'position: relative',
          'z-index: 10'
        ].join(';');
        
        digitWrapper.appendChild(digitEl);
        numberContainer.appendChild(digitWrapper);
        digitElements.push(digitEl);
        logger.info(`✅ board-transition-screen: Created digit element ${index} with text "${digit}" and 3D extrusion`);
      });
    }
    
    // 🔥 CRITICAL FIX: Validate digit elements were created
    if (digitElements.length === 0) {
      logger.error(`❌ board-transition-screen: Failed to create digit elements for board number ${boardNumber}`);
      cleanup();
      isTransitionActive = false;
      resolve();
      onComplete();
      return;
    }

    // Clouds are prepared up front, then each cloud enters with a staggered pop-in.
    if (!cloudContainer) {
      cloudContainer = document.createElement('div');
      cloudContainer.className = 'cc-board-transition-clouds';
      cloudContainer.style.cssText = [
        'position: absolute',
        'inset: 0',
        'pointer-events: none',
        'z-index: 1',
        'overflow: visible'
      ].join(';');
    }
    if (!cloudBehindHillContainer) {
      cloudBehindHillContainer = document.createElement('div');
      cloudBehindHillContainer.className = 'cc-board-transition-clouds-behind-hill';
      cloudBehindHillContainer.style.cssText = [
        'position: absolute',
        'inset: 0',
        'pointer-events: none',
        'z-index: 2',
        'overflow: visible'
      ].join(';');
    }
    if (!cloudMidContainer) {
      cloudMidContainer = document.createElement('div');
      cloudMidContainer.className = 'cc-board-transition-clouds-mid';
      cloudMidContainer.style.cssText = [
        'position: absolute',
        'inset: 0',
        'pointer-events: none',
        'z-index: 15',
        'overflow: visible'
      ].join(';');
    }
    if (!cloudFrontContainer) {
      cloudFrontContainer = document.createElement('div');
      cloudFrontContainer.className = 'cc-board-transition-clouds-front';
      cloudFrontContainer.style.cssText = [
        'position: absolute',
        'inset: 0',
        'pointer-events: none',
        'z-index: 5',
        'overflow: visible'
      ].join(';');
    }
    ensureCloudStyles();
    cloudDelayedCalls.forEach((delayedCall) => {
      try { delayedCall?.kill?.(); } catch {}
    });
    cloudDelayedCalls = [];
    cloudTimelines.forEach((timeline) => {
      try { timeline?.kill?.(); } catch {}
    });
    cloudTimelines = [];
    activeCloudImages.forEach((cloudImg) => {
      try {
        resetPooledImage(cloudImg);
        domElementPool.release(cloudImg);
      } catch {}
    });
    cloudContainer.innerHTML = '';
    cloudBehindHillContainer.innerHTML = '';
    cloudMidContainer.innerHTML = '';
    cloudFrontContainer.innerHTML = '';
    activeCloudImages = [];
    activeCloudWrappers = [];

    const cloudImages = TRANSITION_CLOUD_IMAGES;
    const baseCloudSpawnTops = [15, 46, 24, 55, 21, 52, 43, 49];
    const beachCloudSpawnSlots = BEACH_CLOUD_SPAWN_SLOTS
      .filter((_slot, index) => index !== 2)
      .slice(0, BEACH_BOARD_TRANSITION_CLOUD_COUNT);
    const cloudSpawnTops = resolvedTheme === 'beach'
      ? beachCloudSpawnSlots.map((slot) => slot.top)
      : baseCloudSpawnTops;
    const totalClouds = cloudSpawnTops.length;
    const moveDuration = 9.0;
    const CLOUD_STAGGER = 0.06; // faster cadence so drift starts sooner
    const CLOUD_ENTER_DURATION = 0.34;
    const CLOUD_SETTLE_DURATION = 0.14;
    const viewportW = Math.max(320, window.innerWidth || 390);
    const cloudBasePx = Math.min(240, Math.max(104, viewportW * 0.24));
    const cloudStepPx = Math.max(18, cloudBasePx * 0.16);
    const windStrength = 0.18; // stronger variance but still stable
    const CLOUD_ASPECT = 1.15; // width:height - stable dimensions prevent layout jump on image load

    for (let i = 0; i < totalClouds; i++) {
      const randomizedSpawnTop = cloudSpawnTops[i] + ((Math.random() * 2 - 1) * (i >= totalClouds - 2 ? 7 : 11));
      const beachSpawnSlot = beachCloudSpawnSlots[i % beachCloudSpawnSlots.length] ?? BEACH_CLOUD_SPAWN_SLOTS[0];
      const beachSpawnTop = beachSpawnSlot.top + ((Math.random() * 2 - 1) * 1.25);
      const spawnTop = resolvedTheme === 'beach'
        ? Math.max(0, Math.min(40, beachSpawnTop))
        : Math.max(9, Math.min(62, randomizedSpawnTop));
      const isLowerCloud = i >= totalClouds - 2;
      const isBehindHillCloud = !isLowerCloud && spawnTop < 32;
      let sizeBoost = 0.9 + Math.random() * 0.35;
      if (isLowerCloud) {
        sizeBoost = 1.02 + Math.random() * 0.42;
      } else if (spawnTop < 32 && Math.random() < 0.55) {
        sizeBoost = 1.12 + Math.random() * 0.5;
      } else if (spawnTop >= 32 && spawnTop < 64 && Math.random() < 0.4) {
        sizeBoost = 0.98 + Math.random() * 0.44;
      }
      const cloudThemeScale = resolvedTheme === 'beach' ? 0.6 * 1.4 : 1;
      const cloudSizePx = Math.round((cloudBasePx + (i % 3) * cloudStepPx) * sizeBoost * cloudThemeScale);
      const cloudHeightPx = Math.round(cloudSizePx / CLOUD_ASPECT);
      const baseSize = isLowerCloud
        ? 0.98 + Math.random() * 0.26
        : (0.82 + Math.random() * 0.36) * Math.min(1.28, 0.94 + sizeBoost * 0.16);
      const horizontalBand = i / Math.max(1, totalClouds - 1);
      const bandCenter = 8 + horizontalBand * 84;
      const bandJitter = (Math.random() * 2 - 1) * (isLowerCloud ? 18 : 24);
      const beachSpawnLeft = beachSpawnSlot.left + ((Math.random() * 2 - 1) * 1.5);
      const spawnLeft = resolvedTheme === 'beach'
        ? Math.max(2, Math.min(98, beachSpawnLeft))
        : Math.max(4, Math.min(96, bandCenter + bandJitter));
      const goesLeft = Math.random() < 0.5; // random side push
      const enterDelay = i * CLOUD_STAGGER;
      const rotation = (i % 5 - 2) * 6;
      const bounceAmount = 6 + (i % 3) * 3;
      const bounceSpeed = 0.45 + (i % 4) * 0.08;
      const windFactor = 1 + ((Math.random() * 2 - 1) * windStrength); // 0.82..1.18
      const windDuration = moveDuration * windFactor;
      const spawnCenterPx = viewportW * (spawnLeft / 100);
      const distanceToSidePx = goesLeft ? spawnCenterPx : Math.max(0, viewportW - spawnCenterPx);
      const driftDistancePx = (distanceToSidePx + viewportW + cloudSizePx) * (goesLeft ? -1 : 1);
      const initialYOffset = (isLowerCloud ? -40 : 0) + ((Math.random() * 2 - 1) * (isLowerCloud ? 18 : 28));
      const driftStartDelay = 0.06;

      const cloudWrapper = document.createElement('div');
      cloudWrapper.className = 'cc-board-transition-cloud-wrap';
      cloudWrapper.dataset.driftTargetX = String(driftDistancePx);
      cloudWrapper.style.cssText = [
        'position: absolute',
        'pointer-events: none',
        'will-change: transform',
        `width: ${cloudSizePx}px`,
        `height: ${cloudHeightPx}px`,
        `max-width: ${Math.round(viewportW * 0.74)}px`,
        `top: ${spawnTop}%`,
        `left: ${spawnLeft}%`,
        'transform-origin: center center'
      ].join(';');

      const cloudImg = domElementPool.acquire('img') as HTMLImageElement;
      resetPooledImage(cloudImg);
      cloudImg.src = cloudImages[i % cloudImages.length];
      cloudImg.className = 'cc-board-transition-cloud';
      cloudImg.alt = '';
      cloudImg.style.cssText = [
        'position: absolute',
        'inset: 0',
        'pointer-events: none',
        'will-change: transform, opacity',
        'width: 100%',
        'height: 100%',
        'object-fit: contain',
        'transform-origin: center center'
      ].join(';');

      activeCloudWrappers.push(cloudWrapper);
      activeCloudImages.push(cloudImg);
      gsap.set(cloudWrapper, {
        xPercent: -50,
        yPercent: -50,
        x: 0,
        y: 0,
        transformOrigin: 'center center'
      });
      gsap.set(cloudImg, {
        x: 0,
        y: initialYOffset,
        scale: 0.12,
        opacity: 0,
        rotation,
        rotationX: 0,
        rotationY: 0,
        transformOrigin: 'center center'
      });

      const bounceTimeline = trackTimeline({ repeat: -1, delay: enterDelay + 0.5 });
      bounceTimeline.to(cloudImg, { y: `+=${bounceAmount}px`, duration: bounceSpeed / 2, ease: 'sine.out' });
      bounceTimeline.to(cloudImg, { y: `-=${bounceAmount}px`, duration: bounceSpeed / 2, ease: 'sine.in' });
      cloudTimelines.push(bounceTimeline);

      const enterTl = trackTimeline({ delay: enterDelay });
      // Phase 1: visible one-by-one pop-in at spawn point (no horizontal movement yet)
      enterTl.to(cloudImg, {
        opacity: 1,
        scale: baseSize * 1.22,
        duration: CLOUD_ENTER_DURATION,
        ease: 'back.out(2.2)'
      });
      // Phase 2: settle from pop-in overshoot
      enterTl.to(cloudImg, {
        scale: baseSize,
        duration: CLOUD_SETTLE_DURATION,
        ease: 'power2.out'
      }, '>0');
      cloudTimelines.push(enterTl);

      const driftTimeline = trackTimeline({ delay: enterDelay + driftStartDelay + 0.18 });
      driftTimeline.to(cloudWrapper, { x: driftDistancePx, duration: windDuration, ease: 'none' });
      cloudTimelines.push(driftTimeline);

      const isFrontCloud = i % 3 === 1;
      cloudWrapper.appendChild(cloudImg);
      const cloudLayerOwner = resolvedTheme === 'beach'
        ? cloudContainer
        : isBehindHillCloud
          ? cloudBehindHillContainer
          : isLowerCloud
            ? cloudMidContainer
            : isFrontCloud
              ? cloudFrontContainer
              : cloudContainer;
      cloudLayerOwner.appendChild(cloudWrapper);
    }

    logger.info(`☁️ board-transition-screen: Clouds created (${totalClouds} total, stagger ${CLOUD_STAGGER}s, pop-in enabled)`);
    overlay.appendChild(cloudContainer);
    overlay.appendChild(cloudBehindHillContainer);
    overlay.appendChild(cloudFrontContainer);

    // 🔥 USER REQUEST: Bottom scene at bottom, in front of clouds, behind digits
    const isIPad = (() => {
      const ua = navigator.userAgent || '';
      const isIPadUA = /iPad/.test(ua) || (/Macintosh/.test(ua) && (navigator as any).maxTouchPoints > 1);
      const vw = window.innerWidth || 0;
      return isIPadUA || (vw >= 769 && vw <= 1366);
    })();

    if (showScene) {
      if (!forestContainer) {
        forestContainer = document.createElement('div');
        forestContainer.className = 'cc-board-transition-forest cc-board-transition-scene';
      } else {
        forestContainer.className = 'cc-board-transition-forest cc-board-transition-scene';
      }
      if (selectedProfile) forestContainer.classList.add(selectedProfile.sceneClass);
      forestContainer.dataset.transitionTheme = resolvedTheme;
      forestContainer.style.cssText = [
        'position: absolute',
        'left: 0',
        'right: 0',
        'bottom: -52px',
        'width: 100%',
        'height: calc(min(44vh, 380px) + 120px)',
        'pointer-events: none',
        'z-index: 4',
        'overflow: visible',
        'transform-origin: center bottom',
        'contain: layout style'
      ].join(';');

      Array.from(forestContainer.querySelectorAll('img')).forEach((img) => {
        try {
          resetPooledImage(img as HTMLImageElement);
          domElementPool.release(img as HTMLImageElement);
        } catch {}
      });
      forestContainer.innerHTML = '';
      activeSceneImages = [];
      activeSceneElements = [];

      forestContainer.style.removeProperty('transform');
      forestContainer.style.bottom = isIPad ? '-76px' : '-52px';

      sceneLayers.forEach((layer) => {
        const isHillLayer = isTransitionHillLayer(layer.key);
        const sceneImg = domElementPool.acquire('img') as HTMLImageElement;
        resetPooledImage(sceneImg);
        const sceneLayerStyle = isIPad && isTransitionHillLayer(layer.key)
          ? layer.style.map((styleRule) => {
              if (styleRule.startsWith('width:')) return 'width: auto';
              if (styleRule.startsWith('left:')) return 'left: 50%';
              if (styleRule.startsWith('bottom:')) {
                if (layer.key === 'mountain') return 'bottom: 140px';
                if (layer.key === 'hill2') return 'bottom: 13px';
                return layer.key === 'hill1' ? 'bottom: 70px' : 'bottom: 80px';
              }
              return styleRule;
            })
          : layer.style;
        sceneImg.src = layer.src;
        sceneImg.alt = layer.alt;
        sceneImg.loading = 'eager';
        sceneImg.setAttribute('fetchpriority', 'high');
        sceneImg.decoding = 'async';
        sceneImg.draggable = false;
        sceneImg.dataset.spatialRole = layer.spatialRole ?? (isHillLayer ? 'terrain' : 'scene');
        if (layer.motionRole) sceneImg.dataset.motionRole = layer.motionRole;
        activeSceneImages.push(sceneImg);

        if (isHillLayer) {
          const naturalSize = getTransitionHillNaturalSize(layer.key);
          const sceneLayer = document.createElement('div');
          sceneLayer.className = 'cc-board-transition-scene-layer';
          sceneLayer.dataset.sceneLayer = layer.key;
          sceneLayer.dataset.spatialRole = layer.spatialRole ?? 'terrain';
          sceneLayer.style.cssText = [
            'position: absolute',
            `width: ${naturalSize.width}px`,
            `height: ${naturalSize.height}px`,
            'pointer-events: none',
            'will-change: transform, opacity',
            'backface-visibility: hidden',
            'transform-origin: center bottom',
            ...sceneLayerStyle.filter((rule) => !rule.trim().startsWith('width:'))
          ].join(';');
          sceneImg.style.cssText = [
            'width: 100%',
            'height: 100%',
            'object-fit: contain',
            'display: block',
            'pointer-events: none',
            'backface-visibility: hidden',
          ].join(';');
          sceneLayer.appendChild(sceneImg);
          activeSceneElements.push(sceneLayer);
          forestContainer.appendChild(sceneLayer);
        } else {
          sceneImg.dataset.sceneLayer = layer.key;
          sceneImg.style.cssText = [
            'position: absolute',
            'height: auto',
            'object-fit: contain',
            'display: block',
            'pointer-events: none',
            'will-change: transform, opacity',
            'backface-visibility: hidden',
            ...sceneLayerStyle
          ].join(';');
          const palmPlacement = beachVariation?.palms[layer.key as keyof BeachTransitionVariation['palms']];
          if (palmPlacement) {
            sceneImg.style.left = palmPlacement.horizontalOffsetPx === 0
              ? `${palmPlacement.leftPercent}%`
              : `calc(${palmPlacement.leftPercent}% + ${palmPlacement.horizontalOffsetPx}px)`;
            sceneImg.style.top = 'auto';
            sceneImg.style.bottom = `calc(${palmPlacement.bottomPx + palmPlacement.verticalOffsetPx + BEACH_PALM_GLOBAL_VERTICAL_OFFSET_PX}px + ${palmPlacement.upwardLiftVh}vh)`;
          }
          if (beachVariation && (layer.key === 'beach-bottle' || layer.key === 'beach-ball')) {
            const isBottle = layer.key === 'beach-bottle';
            const startsRight = beachVariation.floatsSwapped ? !isBottle : isBottle;
            sceneImg.style.left = startsRight ? 'calc(100% - 60px)' : 'calc(54% - 100px)';
            sceneImg.dataset.floatDirection = startsRight ? 'left' : 'right';
          }
          if (beachVariation && layer.key === 'beach-castle') {
            sceneImg.style.left = beachVariation.castleStartsLeft
              ? 'calc(32% - 30px)'
              : 'calc(68% + 30px)';
          }
          if (beachVariation?.castleStartsLeft && layer.key === 'beach-shore-1') {
            sceneImg.style.left = 'calc(34% - 40% + 180px)';
          }
          if (roboVariation && layer.key === 'robo-front') {
            sceneImg.style.left = roboVariation.frontTravelDirection === 1 ? '16%' : '84%';
            sceneImg.dataset.travelDirection = roboVariation.frontTravelDirection === 1
              ? 'left-to-right'
              : 'right-to-left';
          }
          if (roboVariation && layer.key === 'robo-walker') {
            sceneImg.style.left = roboVariation.walkerTravelDirection === 1 ? '20%' : '80%';
            sceneImg.dataset.travelDirection = roboVariation.walkerTravelDirection === 1
              ? 'left-to-right'
              : 'right-to-left';
          }
          activeSceneElements.push(sceneImg);
          forestContainer.appendChild(sceneImg);
        }
      });
      overlay.appendChild(forestContainer);
      forestContainer.appendChild(cloudMidContainer);
      if (resolvedTheme !== 'forest') {
        stopForestNNBees();
      }
    } else {
      stopForestNNBees();
      overlay.appendChild(cloudMidContainer);
      // Arcade variant: explicitly remove/disable scene layer if a reused overlay still has it.
      if (forestContainer && forestContainer.parentNode) {
        Array.from(forestContainer.querySelectorAll('img')).forEach((img) => {
          try {
            resetPooledImage(img as HTMLImageElement);
            domElementPool.release(img as HTMLImageElement);
          } catch {}
        });
        forestContainer.innerHTML = '';
        try { forestContainer.parentNode.removeChild(forestContainer); } catch {}
      }
      forestContainer = null;
      activeSceneImages = [];
    }

    // Assemble DOM
    container.appendChild(numberContainer);
    overlay.appendChild(container);
    document.body.appendChild(overlay);
    currentOverlay = overlay;
    overlay.dataset.transitionTheme = resolvedTheme;
    if (showScene) {
      // Let the overlay and its first authored pose commit before idle starts
      // writing transforms. This keeps sensor setup out of the mount frame.
      lifecycle.trackRaf(() => {
        if (!isTransitionActive || activeGeneration !== transitionGeneration) return;
        if (currentOverlay !== overlay || !overlay.isConnected) return;
      });
    }
    try { sampleMemorySpike('3_transition_overlay_shown'); } catch {}
    
    logger.info(`🎯 board-transition-screen: Overlay added to DOM`);
    
    logger.info(`🎯 board-transition-screen: Created ${digitElements.length} digit elements`);
    
    // Kill any existing tweens and timelines
    activeTweens.forEach(tween => {
      try { tween.kill(); } catch {}
    });
    activeTweens = [];

    if (enterTimeline) {
      try { enterTimeline.kill(); } catch {}
      enterTimeline = null;
    }
    
    if (exitTimeline) {
      try { exitTimeline.kill(); } catch {}
      exitTimeline = null;
    }
    
    if (pauseTimeline) {
      try { pauseTimeline.kill(); } catch {}
      pauseTimeline = null;
    }

    // ENTER ANIMATION - exit will start after last digit completes
    enterTimeline = trackTimeline({
      onStart: () => {
        logger.info('✅ board-transition-screen: Enter timeline started');
      },
      onComplete: () => {
        logger.info('✅ board-transition-screen: Enter timeline completed');
      }
    });

    // Step 1: Fade in overlay (0.2s - faster)
    enterTimeline.to(overlay, {
      opacity: 1,
      duration: 0.2,
      ease: 'power2.out'
    }, 0);

    // 🔥 USER REQUEST: Screen shake at start of enter animation (0.3s earlier than before)
    enterTimeline.call(() => {
      try {
        // Screen shake effect at start of enter animation
        // 🔥 CRITICAL FIX: Only kill x, y transforms, not opacity (preserve overlay fade-in)
        gsap.killTweensOf(overlay, 'x,y');
        const shakeStrength = 15;
        const shakeDuration = 0.5;
        const shakeSteps = 20;
        
        const shakeTimeline = trackTimeline({
          onStart: () => {
            // Only set x, y to 0, don't touch opacity
            gsap.set(overlay, { x: 0, y: 0 });
          }
        });
        
        contentTimelines.push(shakeTimeline);
        
        for (let i = 0; i < shakeSteps; i++) {
          const progress = i / shakeSteps;
          const intensity = shakeStrength * (1 - progress);
          const shakeX = (Math.random() - 0.5) * intensity * 2;
          const shakeY = (Math.random() - 0.5) * intensity * 2;
          
          shakeTimeline.to(overlay, {
            x: shakeX,
            y: shakeY,
            duration: shakeDuration / shakeSteps,
            ease: 'none'
          });
        }
        
        shakeTimeline.to(overlay, {
          x: 0,
          y: 0,
          duration: 0.1,
          ease: 'power2.out'
        });
        
        logger.info('💥 Board transition screen shake triggered at start of enter animation (0.3s earlier)');
      } catch (shakeError) {
        logger.warn('⚠️ Error triggering screen shake:', shakeError);
      }
    }, null, 0);

    // 🔥 USER REQUEST: Scene enter animation, each layer gets the old forest pop-in treatment.
    if (forestContainer) {
      gsap.set(forestContainer, {
        opacity: 1,
        transformOrigin: 'center bottom'
      });

      const sceneImagesByKey = new Map(
        activeSceneElements.map((sceneImg) => [sceneImg.dataset.sceneLayer || '', sceneImg])
      );
      const orderedSceneImages = sceneEnterOrder
        .map((key) => sceneImagesByKey.get(key))
        .filter(Boolean) as HTMLImageElement[];
      const beachShoreAmbientTargets = resolvedTheme === 'beach'
        ? orderedSceneImages.filter((sceneImg) => sceneImg.dataset.motionRole === 'shore')
        : [];

      const sceneEnterSpeedFactor = 0.945;
      // The accepted slow pass became the scene's longest owner. Remove two
      // seconds from that path itself so exit waits remain honest and never
      // truncate a still-running frontal/walker tween.
      const roboWalkerTravelDurationScale = 1 / 0.60;
      const roboFrontTravelDurationScale = 1 / 0.70;
      const roboGroundBounceCompleteSeconds = 0.62;
      const roboFrontLeadSeconds = 0.30;
      orderedSceneImages.forEach((sceneImg, index) => {
        const layerKey = sceneImg.dataset.sceneLayer || '';
        if (resolvedTheme === 'area55' && ROBO_AIR_COMBAT_LAYER_KEYS.has(layerKey)) return;
        const proceduralSceneEnterStart = resolvedTheme === 'forest'
          ? 0.01 + index * 0.03
          : 0.05 + index * (0.045 * sceneEnterSpeedFactor);
        const isRoboGroundLayer = layerKey === 'robo-ground-front' || layerKey === 'robo-ground-rear';
        const sceneEnterStart = resolvedTheme === 'area55'
          ? layerKey === 'robo-front'
            ? roboGroundBounceCompleteSeconds - roboFrontLeadSeconds
            : !isRoboGroundLayer
              ? roboGroundBounceCompleteSeconds + Math.max(0, index - 2) * (0.045 * sceneEnterSpeedFactor)
              : proceduralSceneEnterStart
          : proceduralSceneEnterStart;
        const direction = index % 2 === 0 ? -1 : 1;
        const motionRole = sceneImg.dataset.motionRole || '';
        const isBeachCurtain = resolvedTheme === 'beach' && motionRole === 'curtain';
        const isRoboScene = resolvedTheme === 'area55';
        const isRoboFront = isRoboScene && layerKey === 'robo-front';
        const isRoboGroundFront = isRoboScene && layerKey === 'robo-ground-front';
        const isRoboWalker = isRoboScene && layerKey === 'robo-walker';
        const isRoboStaticFence = isRoboScene && (
          layerKey === 'robo-fence-static-left' || layerKey === 'robo-fence-static-right'
        );
        const roboStaticFenceScaleXSign = layerKey === 'robo-fence-static-right' ? -1 : 1;
        const palmPlacement = isBeachCurtain
          ? beachVariation?.palms[layerKey as keyof BeachTransitionVariation['palms']]
          : undefined;
        const isBeachCenterPalm = layerKey === 'beach-palm-center';
        const beachPalmNumber = isBeachCurtain
          ? isBeachCenterPalm ? 5 : Math.max(1, Number(layerKey.match(/(\d+)$/)?.[1]) || 1)
          : 0;
        const beachPalmMotion = BEACH_CURTAIN_PALM_MOTION[beachPalmNumber] ?? BEACH_CURTAIN_PALM_MOTION[1];
        const beachPalmRestScale = beachPalmMotion.restScale;
        const beachPalmRestRotation = palmPlacement?.restRotationDeg ?? beachPalmMotion.restRotation;
        const beachPalmEnterStartY = Math.round(
          Math.min(window.innerHeight || 760, 760) * beachPalmMotion.enterStartYRatio,
        );
        const isHill = isTransitionHillLayer(layerKey);
        const isBeachFrontShore = resolvedTheme === 'beach' && layerKey === 'beach-shore-2';
        const hillParallaxX = getTransitionHillParallaxX(layerKey);
        const hillBaseScale = getTransitionHillBaseScale(layerKey);
        const hillBaseX = getTransitionHillBaseX(layerKey);
        const hillStartYOffset = Math.round(Math.min(window.innerHeight || 760, 760) * 0.4);
        const roboInitialScale = isRoboFront ? 1 : 0;
        const roboFrontTravelDirection = roboVariation?.frontTravelDirection ?? 1;
        const roboWalkerTravelDirection = roboVariation?.walkerTravelDirection ?? -roboFrontTravelDirection;
        const roboFrontStartX = -roboFrontTravelDirection * Math.max(360, window.innerWidth);
        const roboCharacterScaleXSign = isRoboFront
          ? roboFrontTravelDirection === -1 ? -1 : 1
          : isRoboWalker && roboWalkerTravelDirection === 1 ? -1 : 1;
        gsap.set(sceneImg, {
          opacity: isBeachCurtain || isBeachFrontShore || isRoboFront ? 1 : 0,
          xPercent: -50,
          yPercent: 0,
          x: isHill ? hillBaseX - hillParallaxX * 0.18 : isRoboFront ? roboFrontStartX : 0,
          y: isHill ? hillStartYOffset : isBeachCurtain ? beachPalmEnterStartY : isBeachFrontShore ? 0 : isRoboScene && isRoboFront ? 0 : isRoboGroundFront ? 4.2 : 14,
          scale: isHill ? hillBaseScale * 0.68 : isBeachCurtain ? beachPalmRestScale : isBeachFrontShore ? 0.7 : isRoboScene ? roboInitialScale : 0,
          scaleX: isHill ? hillBaseScale * 0.68 : isBeachCurtain ? beachPalmRestScale : isBeachFrontShore ? 0.7 : isRoboScene ? roboInitialScale * roboCharacterScaleXSign : 0,
          scaleY: isHill ? hillBaseScale * 0.68 : isBeachCurtain ? beachPalmRestScale : isBeachFrontShore ? 0.7 : isRoboScene ? roboInitialScale : 0,
          rotation: isHill ? 0 : isBeachCurtain ? beachPalmRestRotation : isRoboFront ? 0 : direction * 8,
          rotationX: 0,
          rotationY: 0,
          transformOrigin: 'center bottom',
          force3D: false
        });

        const sceneEnterTimeline = trackTimeline();
        contentTimelines.push(sceneEnterTimeline);
        if (isBeachCurtain) {
          const exitDirection = palmPlacement?.exitDirection ?? (beachPalmNumber <= 2 ? -1 : beachPalmNumber === 5 ? 0 : 1);
          const curtainExitDistance = Math.max(
            320,
            window.innerWidth * 0.9 + sceneImg.offsetWidth * 0.55,
          );
          const curtainExitDownDistance = Math.max(180, window.innerHeight * 0.3);
          sceneEnterTimeline.to(sceneImg, {
            y: 0,
            duration: 0.42,
            ease: 'power3.out',
          });
          // Land cleanly before any idle motion. One gentle up/down breath then
          // fills the doubled 0.40s dwell without adding a repeating owner.
          const beachPalmFloatY = beachPalmNumber % 2 === 0 ? -4 : -6;
          sceneEnterTimeline.to({}, { duration: BEACH_CURTAIN_PALM_STILL_SECONDS });
          sceneEnterTimeline.to(sceneImg, {
            y: beachPalmFloatY,
            duration: BEACH_CURTAIN_PALM_FLOAT_LEG_SECONDS,
            ease: 'sine.inOut',
          });
          sceneEnterTimeline.to(sceneImg, {
            y: 0,
            duration: BEACH_CURTAIN_PALM_FLOAT_LEG_SECONDS,
            ease: 'sine.inOut',
          });
          sceneEnterTimeline.to({}, {
            duration: (beachPalmNumber - 1) * BEACH_CURTAIN_PALM_EXIT_STAGGER_SECONDS,
          });
          sceneEnterTimeline.to(sceneImg, {
            x: exitDirection * curtainExitDistance,
            y: curtainExitDownDistance,
            rotation: beachPalmRestRotation,
            scale: 0,
            opacity: 1,
            duration: BEACH_CURTAIN_PALM_EXIT_SECONDS,
            ease: 'back.in(1.35)',
            onComplete: () => {
              sceneImg.style.visibility = 'hidden';
              sceneImg.style.willChange = 'auto';
            },
          });
        } else if (isRoboScene) {
          if (isRoboFront) {
            const roboFrontEndX = roboFrontTravelDirection * Math.max(640, window.innerWidth * 1.65);
            sceneEnterTimeline
              .to(sceneImg, { x: roboFrontStartX * 0.28, y: -7, rotation: 3, scaleX: 1.01 * roboCharacterScaleXSign, scaleY: 1.01, duration: 0.34 * roboFrontTravelDurationScale, ease: 'none' })
              .to(sceneImg, { x: roboFrontEndX * 0.10, y: 7, rotation: -3, scaleX: 0.99 * roboCharacterScaleXSign, scaleY: 0.99, duration: 0.42 * roboFrontTravelDurationScale, ease: 'none' })
              .to(sceneImg, { x: roboFrontEndX * 0.32, y: -9, rotation: 3, scaleX: 1.01 * roboCharacterScaleXSign, scaleY: 1.01, duration: 0.44 * roboFrontTravelDurationScale, ease: 'none' })
              .to(sceneImg, { x: roboFrontEndX * 0.56, y: 9, rotation: -3, scaleX: 0.99 * roboCharacterScaleXSign, scaleY: 0.99, duration: 0.46 * roboFrontTravelDurationScale, ease: 'none' })
              .to(sceneImg, { x: roboFrontEndX * 0.80, y: -6, rotation: 2, scaleX: 1.01 * roboCharacterScaleXSign, scaleY: 1.01, duration: 0.46 * roboFrontTravelDurationScale, ease: 'none' })
              .to(sceneImg, {
                x: roboFrontEndX,
                y: 6,
                rotation: -2,
                scaleX: roboCharacterScaleXSign,
                scaleY: 1,
                duration: 0.48 * roboFrontTravelDurationScale,
                ease: 'none',
                onComplete: () => {
                  sceneImg.style.opacity = '0';
                  sceneImg.style.visibility = 'hidden';
                  sceneImg.style.willChange = 'auto';
                },
              });
          } else if (isRoboWalker) {
            const roboWalkerEndX = roboWalkerTravelDirection * Math.max(
              (window.innerWidth || 390) + sceneImg.offsetWidth * 1.5,
              (window.innerWidth || 390) * 1.65,
            );
            sceneEnterTimeline
              .to(sceneImg, {
                opacity: 1,
                x: 0,
                y: 0,
                rotation: 0,
                scaleX: 1.04 * roboCharacterScaleXSign,
                scaleY: 1.04,
                duration: 0.3 * sceneEnterSpeedFactor,
                ease: 'back.out(2.0)',
              })
              .to(sceneImg, { scaleX: 0.95 * roboCharacterScaleXSign, scaleY: 0.95, duration: 0.1 * sceneEnterSpeedFactor, ease: 'power2.out' })
              .to(sceneImg, { scaleX: roboCharacterScaleXSign, scaleY: 1, duration: 0.12 * sceneEnterSpeedFactor, ease: 'back.out(1.5)' })
              .to(sceneImg, { x: roboWalkerEndX * 0.18, y: 7, rotation: -3, scaleX: 1.01 * roboCharacterScaleXSign, scaleY: 1.01, duration: 0.34 * roboWalkerTravelDurationScale, ease: 'none' })
              .to(sceneImg, { x: roboWalkerEndX * 0.36, y: -7, rotation: 3, scaleX: 0.99 * roboCharacterScaleXSign, scaleY: 0.99, duration: 0.42 * roboWalkerTravelDurationScale, ease: 'none' })
              .to(sceneImg, { x: roboWalkerEndX * 0.53, y: 9, rotation: -3, scaleX: 1.01 * roboCharacterScaleXSign, scaleY: 1.01, duration: 0.44 * roboWalkerTravelDurationScale, ease: 'none' })
              .to(sceneImg, { x: roboWalkerEndX * 0.70, y: -9, rotation: 3, scaleX: 0.99 * roboCharacterScaleXSign, scaleY: 0.99, duration: 0.46 * roboWalkerTravelDurationScale, ease: 'none' })
              .to(sceneImg, { x: roboWalkerEndX * 0.86, y: 6, rotation: -2, scaleX: 1.01 * roboCharacterScaleXSign, scaleY: 1.01, duration: 0.46 * roboWalkerTravelDurationScale, ease: 'none' })
              .to(sceneImg, { x: roboWalkerEndX, y: 0, rotation: 0, scaleX: roboCharacterScaleXSign, scaleY: 1, duration: 0.48 * roboWalkerTravelDurationScale, ease: 'none' });
          } else {
            const roboRestX = layerKey === 'robo-ground-rear' ? 100 : layerKey === 'robo-ground-front' ? -100 : 0;
            const roboRestRotation = layerKey === 'robo-fence' ? 6 : 0;
            const roboArrivalOvershootScale = isRoboGroundFront ? 1.012 : 1.04;
            const roboArrivalReboundScale = isRoboGroundFront ? 0.985 : 0.95;
            const roboArrivalEaseStrength = isRoboGroundFront ? 0.6 : 2.0;
            const roboSettleEaseStrength = isRoboGroundFront ? 0.45 : 1.5;
            sceneEnterTimeline.to(sceneImg, {
              opacity: 1,
              x: roboRestX,
              y: 0,
              scaleX: roboArrivalOvershootScale * (isRoboStaticFence ? roboStaticFenceScaleXSign : 1),
              scaleY: roboArrivalOvershootScale,
              rotation: roboRestRotation,
              duration: 0.3 * sceneEnterSpeedFactor,
              ease: `back.out(${roboArrivalEaseStrength})`,
            });
            sceneEnterTimeline.to(sceneImg, {
              scaleX: roboArrivalReboundScale * (isRoboStaticFence ? roboStaticFenceScaleXSign : 1),
              scaleY: roboArrivalReboundScale,
              duration: 0.1 * sceneEnterSpeedFactor,
              ease: 'power2.out',
            });
            sceneEnterTimeline.to(sceneImg, {
              opacity: 1,
              x: roboRestX,
              y: 0,
              scaleX: isRoboStaticFence ? roboStaticFenceScaleXSign : 1,
              scaleY: 1,
              rotation: roboRestRotation,
              duration: 0.12 * sceneEnterSpeedFactor,
              ease: `back.out(${roboSettleEaseStrength})`,
              onComplete: () => {
                if (layerKey === 'robo-ground-rear' || layerKey === 'robo-ground-front') {
                  startRoboGroundAmbientMotion(sceneImg, layerKey, roboRestX);
                } else {
                  try { sceneImg.style.willChange = 'auto'; } catch {}
                  if (motionRole === 'float') startBeachAmbientMotion(sceneImg, layerKey, motionRole);
                }
              },
            });
          }
          sceneEnterTimeline.call(() => {
            if (motionRole !== 'float') {
              try { sceneImg.style.willChange = 'auto'; } catch {}
            }
          });
        } else if (isHill) {
          // Horizontal terrain travel is one uninterrupted owner from the first
          // visible frame until exit takes over. Keeping it separate from scale/y
          // removes the former enter -> hold -> exit drift restart.
          const hillContinuousDriftTimeline = trackTimeline();
          contentTimelines.push(hillContinuousDriftTimeline);
          hillContinuousDriftTimeline.to(sceneImg, {
            x: hillBaseX + hillParallaxX,
            duration: getTransitionHillParallaxDuration(layerKey),
            ease: 'none',
            overwrite: 'auto',
            immediateRender: false,
          });
          enterTimeline.add(hillContinuousDriftTimeline, sceneEnterStart);

          // One smooth arrival replaces the old 112% -> 98% -> 100% scale
          // staircase. The terrain still rises from depth, but never visibly
          // changes gears before settling into its continuous drift.
          sceneEnterTimeline.to(sceneImg, {
            opacity: 1,
            y: 0,
            scale: hillBaseScale,
            scaleX: hillBaseScale,
            scaleY: hillBaseScale,
            duration: 0.72 * sceneEnterSpeedFactor,
            ease: 'sine.out',
            onComplete: () => {
              try { sceneImg.style.willChange = 'transform, opacity'; } catch {}
            }
          });
          if (layerKey === 'mountain') {
            sceneEnterTimeline.to(sceneImg, {
              y: -7,
              duration: 0.14,
              ease: 'sine.out',
            });
            sceneEnterTimeline.to(sceneImg, {
              y: 0,
              duration: 0.22,
              ease: 'back.out(1.35)',
            });
          }
        } else {
          sceneEnterTimeline.to(sceneImg, {
            opacity: 1,
            scale: 1.04,
            y: 0,
            rotation: 0,
            duration: 0.3 * sceneEnterSpeedFactor,
            ease: 'back.out(2.0)'
          });
          sceneEnterTimeline.to(sceneImg, {
            scale: 0.95,
            duration: 0.1 * sceneEnterSpeedFactor,
            ease: 'power2.out'
          });
          sceneEnterTimeline.to(sceneImg, {
            opacity: 1,
            scale: 1.0,
            y: 0,
            duration: 0.12 * sceneEnterSpeedFactor,
            ease: 'back.out(1.5)',
            onComplete: () => {
              try { sceneImg.style.willChange = 'auto'; } catch {}
              if (resolvedTheme === 'beach' && motionRole && motionRole !== 'shore') {
                startBeachAmbientMotion(sceneImg, layerKey, motionRole);
              }
            }
          });
        }
        enterTimeline.add(
          sceneEnterTimeline,
          isBeachCurtain ? 0.02 + (beachPalmNumber - 1) * 0.045 : sceneEnterStart,
        );
      });
      if (resolvedTheme === 'forest') {
        enterTimeline.call(
          () => startSimpleForestNNBees(overlay, digitElements),
          undefined,
          0,
        );
      }
      if (resolvedTheme === 'area55') {
        enterTimeline.call(() => {
          startRoboAirCombatMotion(
            sceneImagesByKey as Map<string, HTMLImageElement>,
            numberContainer,
            forestContainer,
          );
        }, undefined, 0);
      }
      if (beachShoreAmbientTargets.length > 0) {
        const latestShoreEnterIndex = Math.max(
          ...beachShoreAmbientTargets.map((sceneImg) => orderedSceneImages.indexOf(sceneImg)),
        );
        const sharedShoreAmbientStart = 0.05
          + latestShoreEnterIndex * (0.045 * sceneEnterSpeedFactor)
          + (0.52 * sceneEnterSpeedFactor)
          + 0.02;
        enterTimeline.call(() => {
          startBeachSharedShoreAmbientMotion(
            beachShoreAmbientTargets.filter((sceneImg) => sceneImg.isConnected && sceneImg.style.visibility !== 'hidden'),
          );
        }, undefined, sharedShoreAmbientStart);
      }
    }

    // Step 3: Animate digits with bounce animation (staggered)
    digitElements.forEach((digitEl, index) => {
      const digitEnterBaseDelay = resolvedTheme === 'area55'
        ? 1.3
        : BOARD_TRANSITION_NUMBER_ENTER_START_SECONDS;
      const delay = digitEnterBaseDelay + (index * 0.3); // Stagger by 0.3s per digit
      const digitHapticLocalDelay = index === 0 ? TRANSITION_HAPTIC_FIRST_DELAY : TRANSITION_HAPTIC_OTHER_DELAY;
      const digitHapticDelay = delay + digitHapticLocalDelay;

      if (typeof (window as any).triggerHapticImpact === 'function') {
        const hapticCall = trackDelayedCall(digitHapticDelay, () => {
          try { (window as any).triggerHapticImpact?.('light'); } catch {}
        });
        activeTweens.push(hapticCall as any);
      }
      
      // 🔥 USER REQUEST: Generate random rotation with opposite poles for adjacent digits
      // First digit: random between -8 and +8, second digit: opposite sign (always -+ or +-)
      const baseRotation = -8 + Math.random() * 16; // Random between -8 and +8
      // If index is even (0, 2, 4...), use baseRotation; if odd (1, 3, 5...), use opposite sign
      const randomRotation = index % 2 === 0 
        ? baseRotation 
        : -baseRotation; // Opposite sign for adjacent digits (always -+ or +-)
      
      // Set initial state (hidden)
      // 🔥 CRITICAL FIX: Ensure no transform properties that could affect horizontal position
      // 🔥 PERFORMANCE FIX: Add will-change and GPU acceleration BEFORE animation starts
      // This prevents layout reflow when properties change during animation
      digitEl.style.willChange = 'transform, opacity';
      digitEl.style.transform = 'translateZ(0)'; // Force GPU acceleration
      digitEl.style.backfaceVisibility = 'hidden'; // Better rendering performance
      digitEl.style.webkitBackfaceVisibility = 'hidden'; // iOS Safari
      // 🔥 PERFORMANCE FIX: Use contain to prevent layout interference
      digitEl.style.contain = 'layout style paint';
      
      gsap.set(digitEl, {
        opacity: 0,
        scale: 0,
        x: 0, // Explicitly set x to 0 to prevent horizontal offset
        y: 0, // Explicitly set y to 0
        rotation: randomRotation, // 🔥 USER REQUEST: Random rotation between -4 and +4 degrees
        rotationX: 0, // Ensure no rotation that could affect layout
        rotationY: 0,
        z: 0,
        force3D: true // Force 3D acceleration for better performance
      });

      // Beautiful bounce animation for each digit
      const digitTimeline = trackTimeline();
      contentTimelines.push(digitTimeline); // 🔥 FIX: Track for cleanup
      
      // First bounce: scale 0 → 1.2 with 3D rotation for depth
      digitTimeline.to(digitEl, {
          opacity: 1,
          scale: 1.2,
        rotation: randomRotation, // 🔥 USER REQUEST: Keep random rotation throughout animation
        rotationX: -5, // Slight 3D rotation for depth
        rotationY: 0,
        z: 20, // 3D depth
        x: 0, // 🔥 CRITICAL FIX: Explicitly ensure no horizontal movement
        y: 0, // 🔥 CRITICAL FIX: Explicitly ensure no vertical movement
        transformOrigin: 'center center', // 🔥 CRITICAL FIX: Ensure transform origin is center
          duration: 0.4,
          ease: 'back.out(2.0)'
        });
      
      // Settle: scale 1.2 → 0.95 with 3D return
      digitTimeline.to(digitEl, {
        scale: 0.95,
        rotation: randomRotation, // 🔥 USER REQUEST: Keep random rotation throughout animation
        rotationX: 0,
        rotationY: 0,
        z: 0,
        x: 0, // 🔥 CRITICAL FIX: Explicitly ensure no horizontal movement
        y: 0, // 🔥 CRITICAL FIX: Explicitly ensure no vertical movement
        transformOrigin: 'center center', // 🔥 CRITICAL FIX: Ensure transform origin is center
        duration: 0.15,
        ease: 'power2.out'
      });
      
      // Final settle: scale 0.95 → 1.0 with perfect 3D position
      digitTimeline.to(digitEl, {
        opacity: 1, // 🔥 CRITICAL FIX: Ensure full opacity in final state
        scale: 1.0,
        rotation: randomRotation, // 🔥 USER REQUEST: Keep random rotation throughout animation
        rotationX: 0,
        rotationY: 0,
        z: 0,
        x: 0, // 🔥 CRITICAL FIX: Explicitly ensure no horizontal offset
        y: 0, // 🔥 CRITICAL FIX: Explicitly ensure no vertical offset
        transformOrigin: 'center center', // 🔥 CRITICAL FIX: Ensure transform origin is center
        duration: 0.2,
        ease: 'back.out(1.5)',
        onComplete: () => {
          // 🔥 CRITICAL FIX: Add defensive null checks to prevent errors on destroyed elements
          try {
            // Check if digitEl still exists and is valid
            if (!digitEl || !digitEl.parentNode || digitEl.isConnected === false) {
              logger.warn('⚠️ board-transition-screen: Digit element destroyed before animation complete');
              cleanup();
              isTransitionActive = false;
              finishOnce(false);
              return;
            }
            
            // 🔥 APP STORE: Cleanup will-change after animation completes
            if (digitEl.style) {
              digitEl.style.willChange = 'auto';
            }
            
            // 🔥 CRITICAL FIX: Start exit animation when LAST digit completes
            if (index === digitElements.length - 1) {
              logger.info('✅ board-transition-screen: All enter animations complete, starting exit');

              // Add a small pause before starting exit using GSAP timeline
              // 🔥 CRITICAL FIX: Store pauseTimeline for cleanup
              if (pauseTimeline) {
                try { pauseTimeline.kill(); } catch {}
              }
              
              pauseTimeline = trackTimeline({
                onComplete: () => {
                  pauseTimeline = null;
                  try {
                    // 🔥 FIX: Validate elements still exist before starting exit
                    if (!overlay || !overlay.isConnected || !container || !digitElements || digitElements.length === 0) {
                      logger.warn('⚠️ board-transition-screen: Elements destroyed before exit animation');
                      cleanup();
                      isTransitionActive = false;
                      finishOnce();
                      return;
                    }
                    
                    startExitAnimation(overlay, container, digitElements, forestContainer, resolvedTheme, () => {
                      // Keep one opaque paper owner above Pixi while the async
                      // Journey boot prepares its first valid board frame.
                      cleanup({ preserveDom: true, keepVisibleCover: true });
                      boardTransitionPresentationHandoff.retain(() => {
                        cleanup({ preserveDom: true });
                        isTransitionActive = false;
                      });
                      finishOnce();
                    });
                  } catch (exitError) {
                    logger.error('❌ board-transition-screen: Failed to start exit animation:', exitError);
                    // Fallback: cleanup and resolve anyway
                    cleanup();
                    isTransitionActive = false;
                    finishOnce();
                  }
                }
              });
              pauseTimeline.to({}, {
                duration: resolvedTheme === 'area55'
                  ? Math.max(
                      ROBO_AIR_COMBAT_HOLD_DURATION_SECONDS,
                      getRoboAirCombatHoldSeconds(),
                    )
                  : BOARD_TRANSITION_HOLD_DURATION_SECONDS,
                ease: 'none'
              });
            }
          } catch (error) {
            logger.warn('⚠️ board-transition-screen: Error in digit animation onComplete:', error);
            cleanup();
            isTransitionActive = false;
            finishOnce(false);
          }
        }
      });
      enterTimeline.add(digitTimeline, delay);
    });
    
    // 🔥 CRITICAL FIX: Ensure timeline starts playing
    // GSAP timelines start automatically, but let's ensure it's playing
    if (enterTimeline && enterTimeline.paused()) {
      enterTimeline.play();
    }
    
    logger.info(`✅ board-transition-screen: Enter timeline created and started for board ${boardNumber}`);
    
    } catch (error) {
      logger.error('❌ board-transition-screen: Error in showBoardTransitionScreen:', error);
      // Cleanup and resolve on error
      cleanup();
      isTransitionActive = false;
      finishOnce();
    }
  });
}

/**
 * Start exit animation (reverse of enter)
 */
function startExitAnimation(
  overlay: HTMLElement,
  container: HTMLElement,
  digitElements: HTMLElement[],
  forestContainer: HTMLElement | null,
  transitionTheme: BoardTransitionThemeId | 'none',
  onComplete: () => void
): void {
  void container;
  const leftFighterExit = transitionTheme === 'area55'
    ? overlay.querySelector('[data-scene-layer="robo-fighter-left"]') as HTMLElement | null
    : null;
  const rightFighterExit = transitionTheme === 'area55'
    ? overlay.querySelector('[data-scene-layer="robo-fighter-right"]') as HTMLElement | null
    : null;
  if (!leftFighterExit || !rightFighterExit) stopRoboAirCombatMotion();
  if (transitionTheme === 'area55' && forestContainer) {
    ['robo-beam-right', 'robo-beam-hit', 'robo-beam-after', 'robo-beam-final'].forEach((layerKey) => {
      const effect = forestContainer.querySelector(`[data-scene-layer="${layerKey}"]`) as HTMLElement | null;
      if (effect) effect.style.opacity = '0';
    });
  }
  // 🔥 CRITICAL FIX: Kill any existing exit timeline before creating new one
  if (exitTimeline) {
    try { exitTimeline.kill(); } catch {}
  }
  
  exitTimeline = trackTimeline({
    onComplete: () => {
      logger.info('✅ board-transition-screen: Exit animation complete');
      exitTimeline = null;
      // 🔥 Enter-animation mode: updateGhostVisibility will only hide ghosts until pop-in completes
      (window as any).__ccEnterAnimationActive = true;
      try {
        if (typeof (window as any).hideGhostPlaceholders === 'function') {
          (window as any).hideGhostPlaceholders();
        }
      } catch {}
      onComplete();
    }
  });
  let latestCloudExitEnd = 0;
  const addCloudExitAt = (startAt: number): void => {
    const cloudExitTargets = Array.from(
      overlay.querySelectorAll('.cc-board-transition-cloud')
    ) as HTMLElement[];
    if (!cloudExitTargets.length) return;
    latestCloudExitEnd = Math.max(
      latestCloudExitEnd,
      startAt + BOARD_TRANSITION_CLOUD_EXIT_ANTICIPATION_SECONDS
        + BOARD_TRANSITION_CLOUD_EXIT_REBOUND_SECONDS
        + BOARD_TRANSITION_CLOUD_EXIT_COLLAPSE_SECONDS,
    );

    cloudExitTargets.forEach((cloudImg) => {
      try {
        cloudImg.style.willChange = 'transform';
        cloudImg.style.transformOrigin = '50% 50%';
      } catch {}
    });

    const cloudExitTimeline = trackTimeline();
    contentTimelines.push(cloudExitTimeline);
    cloudExitTimeline.to(cloudExitTargets, {
      scaleX: 0.94,
      scaleY: 1.07,
      duration: BOARD_TRANSITION_CLOUD_EXIT_ANTICIPATION_SECONDS,
      ease: 'power2.in',
      overwrite: 'auto',
    });
    cloudExitTimeline.to(cloudExitTargets, {
      scaleX: 1.08,
      scaleY: 0.93,
      duration: BOARD_TRANSITION_CLOUD_EXIT_REBOUND_SECONDS,
      ease: 'back.out(2.2)',
      overwrite: 'auto',
    });
    cloudExitTimeline.to(cloudExitTargets, {
      scaleX: 0,
      scaleY: 0,
      duration: BOARD_TRANSITION_CLOUD_EXIT_COLLAPSE_SECONDS,
      ease: 'back.in(1.85)',
      overwrite: 'auto',
      onComplete: () => {
        cloudTimelines.forEach((timeline) => {
          try { timeline?.kill?.(); } catch {}
        });
        cloudTimelines = [];
        activeCloudWrappers.forEach((cloudWrap) => {
          try {
            gsap.killTweensOf(cloudWrap);
            cloudWrap.style.willChange = 'auto';
          } catch {}
        });
        cloudExitTargets.forEach((cloudImg) => {
          try { cloudImg.style.willChange = 'auto'; } catch {}
        });
      },
    });
    exitTimeline?.add(cloudExitTimeline, startAt);
  };

  // Start parallax first, then let the digits exit after the scene has already begun separating.
  const sceneParallaxLead = BOARD_TRANSITION_EXIT_PARALLAX_LEAD_SECONDS;

  if (leftFighterExit && rightFighterExit) {
    const exitVariation = activeRoboAirCombatVariation ?? createRoboAirCombatVariation();
    exitTimeline.call(stopRoboAirCombatMotion, undefined, sceneParallaxLead);
    const fighterExitDistance = (window.innerWidth || 390) * 2
      + Math.max(leftFighterExit.offsetWidth, rightFighterExit.offsetWidth)
      + 60;
    const fighterExitVerticalDistance = (window.innerHeight || 760) * 0.85 + 100;
    const addFighterExit = (
      fighter: HTMLElement,
      side: 'left' | 'right',
      targetX: number,
      yDelta: number,
    ): void => {
      const exitClock = { progress: 0 };
      let startX = 0;
      let startY = 0;
      let startRotation = 0;
      let startScale = 1;
      const wobblePhase = gsap.utils.random(-Math.PI, Math.PI);
      const wobbleStrength = gsap.utils.random(1.8, 2.8);
      const circleRadius = gsap.utils.random(16, 26);
      const fighterExitDuration = exitVariation.exitDurationSeconds;
      const fighterExitTimeline = trackTimeline();
      contentTimelines.push(fighterExitTimeline);
      fighterExitTimeline.to(exitClock, {
        progress: 1,
        duration: fighterExitDuration,
        ease: 'none',
        onStart: () => {
          startX = Number(gsap.getProperty(fighter, 'x')) || 0;
          startY = Number(gsap.getProperty(fighter, 'y')) || 0;
          startRotation = Number(gsap.getProperty(fighter, 'rotation')) || 0;
          startScale = Number(gsap.getProperty(fighter, 'scale')) || 1;
        },
        onUpdate: () => {
          const progress = exitClock.progress;
          const acceleratedProgress = 0.12 * progress + 0.88 * progress * progress;
          const arcProgress = Math.sin(Math.PI * progress);
          const arcDirection = side === 'left' ? 1 : -1;
          const baseX = startX + (targetX - startX) * acceleratedProgress
            + arcDirection * circleRadius * 2.2 * arcProgress;
          const baseY = startY + yDelta * acceleratedProgress
            - circleRadius * 1.35 * arcProgress;
          const wobbleEnvelope = 0.65 + Math.sin(Math.PI * progress) * 0.35;
          const wobblePhaseNow = progress * Math.PI * 2 + wobblePhase;
          const microWobblePhase = progress * Math.PI * 10 + wobblePhase;
          const diagonalDirection = side === 'left' ? 1 : -1;
          gsap.set(fighter, {
            x: baseX
              + (Math.sin(wobblePhaseNow) - Math.sin(wobblePhase)) * circleRadius * wobbleEnvelope
              + (Math.sin(microWobblePhase) - Math.sin(wobblePhase)) * wobbleStrength,
            y: baseY
              + (Math.cos(wobblePhaseNow) - Math.cos(wobblePhase))
                * circleRadius * 0.72 * wobbleEnvelope
              + (Math.cos(microWobblePhase * 1.17) - Math.cos(wobblePhase * 1.17))
                * wobbleStrength * 0.72,
            rotation: startRotation + diagonalDirection * 30 * acceleratedProgress
              + (Math.sin(microWobblePhase * 1.31) - Math.sin(wobblePhase * 1.31))
                * 1.6 * wobbleEnvelope,
            scale: startScale * (1 + Math.sin(microWobblePhase * 0.83) * 0.01 * wobbleEnvelope),
            force3D: true,
          });
        },
        onComplete: () => {
          if (!areContinuousRuntimeDiagnosticsEnabled()) {
            fighter.style.opacity = '0';
            fighter.style.visibility = 'hidden';
            fighter.style.display = 'none';
            return;
          }
          const rect = fighter.getBoundingClientRect();
          const payload = {
            side,
            routeProfile: exitVariation.routeProfile,
            exitPattern: exitVariation.exitPattern,
            targetX: Math.round(targetX),
            yDelta: Math.round(yDelta),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            viewportWidth: window.innerWidth || 390,
            fullyOutside: rect.right <= 0 || rect.left >= (window.innerWidth || 390),
          };
          console.info('[CC_ROBO_SHIP_EXIT]', payload);
          window.__ccRoboShipExitTrace = [
            ...(window.__ccRoboShipExitTrace ?? []).slice(-9),
            payload,
          ];
          fighter.style.opacity = '0';
          fighter.style.visibility = 'hidden';
          fighter.style.display = 'none';
        },
      });
      exitTimeline?.add(fighterExitTimeline, sceneParallaxLead);
    };
    const exitDirections = exitVariation.exitPattern === 0
      ? { left: [-1, -1], right: [1, 1] }
      : exitVariation.exitPattern === 1
        ? { left: [-1, 1], right: [1, -1] }
        : { left: [1, -1], right: [-1, 1] };
    const exitVerticalDistance = fighterExitVerticalDistance * exitVariation.exitVerticalScale;
    addFighterExit(
      leftFighterExit,
      'left',
      exitDirections.left[0] * fighterExitDistance,
      exitDirections.left[1] * exitVerticalDistance,
    );
    addFighterExit(
      rightFighterExit,
      'right',
      exitDirections.right[0] * fighterExitDistance,
      exitDirections.right[1] * exitVerticalDistance,
    );
  }

  // Replay same two digit haptics on exit (numbers disappearing), aligned with delayed digit exit.
  if (typeof (window as any).triggerHapticImpact === 'function') {
    const exitHapticDigits = Math.min(2, digitElements.length);
    for (let i = 0; i < exitHapticDigits; i++) {
      const exitDelay =
        i === 0
          ? sceneParallaxLead + TRANSITION_EXIT_HAPTIC_FIRST_DELAY
          : sceneParallaxLead + TRANSITION_EXIT_HAPTIC_FIRST_DELAY + TRANSITION_EXIT_HAPTIC_SECOND_GAP;
      const hapticCall = trackDelayedCall(exitDelay, () => {
        try { (window as any).triggerHapticImpact?.('light'); } catch {}
      });
      activeTweens.push(hapticCall as any);
    }
  }

  const digitExitDuration = 0.45;
  const digitExitStagger = 0.4;
  const digitExitEnd = digitElements.length > 0
    ? sceneParallaxLead + ((digitElements.length - 1) * digitExitStagger) + digitExitDuration
    : 0;

  // Step 1: Animate digits out with bounce (left-to-right, sequential)
    digitElements.forEach((digitEl, index) => {
      const delay = sceneParallaxLead + (index * digitExitStagger);
      
      const digitExitTimeline = trackTimeline();
      contentTimelines.push(digitExitTimeline); // 🔥 FIX: Track for cleanup
    
      // First: scale 1.0 → 1.1 (slight overshoot) with 3D depth
      digitExitTimeline.to(digitEl, {
        scale: 1.1,
      z: 30, // Push forward in 3D
        duration: 0.15,
        ease: 'power2.out'
      });
    
    // Then: scale 1.1 → 0 with 3D rotation and depth fade
      digitExitTimeline.to(digitEl, {
        opacity: 0,
        scale: 0,
        rotation: index % 2 === 0 ? 15 : -15,
      rotationX: index % 2 === 0 ? 45 : -45, // 3D rotation
      rotationY: index % 2 === 0 ? 30 : -30, // 3D rotation
      z: -100, // Pull back in 3D space
        duration: 0.3,
        ease: 'power2.in'
      });
    
      exitTimeline.add(digitExitTimeline, delay);
    });

  // Step 2: Scene exit animation
  let sceneFadeStart = digitExitEnd + 0.25;
  if (forestContainer) {
    const sceneImages = Array.from(forestContainer.querySelectorAll('[data-scene-layer]')) as HTMLElement[];
    const sceneExitStart = Math.max(0, digitExitEnd - 0.5);
    sceneImages.forEach((sceneImg) => {
      const layerKey = sceneImg.dataset.sceneLayer || '';
      const isHill = isTransitionHillLayer(layerKey);
      const isAggressiveDownPine = layerKey === 'pine2' || layerKey === 'pine4';
      const isPine3 = layerKey === 'pine3';
      const isLeftPine = layerKey === 'pine1' || layerKey === 'pine2';
      const isRightPine = layerKey === 'pine3' || layerKey === 'pine4' || layerKey === 'pine5';
      const isLeftFence = layerKey === 'fence-left';
      const isRightFence = layerKey === 'fence-right';
      if (isHill) {
        // Hills keep enter parallax until ordered exit — no second x/scale tween here (caused scale jerk).
        return;
      }
      if (!isHill && !isLeftPine && !isRightPine && !isLeftFence && !isRightFence) return;
      const pineDurationByLayer: Record<string, number> = {
        pine1: 1.55,
        pine2: 1.05,
        pine3: 1.68,
        pine4: 1.05,
        pine5: 1.42
      };
      const parallaxDuration = isLeftFence || isRightFence
          ? 0.9
          : pineDurationByLayer[layerKey] || Math.max(0.2, sceneExitStart + 0.25);

      const ambientTimeline = trackTimeline();
      contentTimelines.push(ambientTimeline);
      sceneImg.style.willChange = 'transform, opacity';
      ambientTimeline.to(sceneImg, {
        scale: isLeftFence || isRightFence ? 0.93 : 0.945,
        x: isLeftPine ? -59 : isPine3 ? 78 : isRightPine ? 59 : isLeftFence ? -140 : isRightFence ? 140 : 0,
        y: isAggressiveDownPine ? 55 : isPine3 ? 34 : isLeftPine || isRightPine ? 18 : isLeftFence || isRightFence ? 58 : 0,
        duration: parallaxDuration,
        ease: 'sine.inOut'
      });
      exitTimeline.add(ambientTimeline, 0);
    });

    const rearPineExitImages = sceneImages
      .filter((sceneImg) => /^(pine1|pine3|pine5)$/.test(sceneImg.dataset.sceneLayer || ''))
      .sort(() => Math.random() - 0.5);
    const frontPineExitImages = ['pine4', 'pine2']
      .map((key) => sceneImages.find((sceneImg) => sceneImg.dataset.sceneLayer === key))
      .filter(Boolean) as HTMLElement[];
    const fenceExitImages = sceneImages
      .filter((sceneImg) => /^fence-(left|right)$/.test(sceneImg.dataset.sceneLayer || ''))
      .sort(() => Math.random() - 0.5);
    const hillExitImages = ['mountain', 'hill1', 'hill2']
      .map((key) => sceneImages.find((sceneImg) => sceneImg.dataset.sceneLayer === key))
      .filter(Boolean) as HTMLImageElement[];
    const otherExitImages = sceneImages.filter((sceneImg) => {
      const key = sceneImg.dataset.sceneLayer || '';
      return sceneImg.style.visibility !== 'hidden'
        && !(transitionTheme === 'area55' && ROBO_AIR_COMBAT_LAYER_KEYS.has(key))
        && !isTransitionHillLayer(key)
        && !/^pine[1-5]$/.test(key)
        && !/^fence-(left|right)$/.test(key);
    });
    const fenceExitStart = Math.max(0, sceneExitStart - 0.9);
    const rearPineExitStart = Math.max(0, sceneExitStart - 0.5);
    const hillExitBaseStart = sceneExitStart + BOARD_TRANSITION_HILL_EXIT_LAG_SECONDS;
    addCloudExitAt(hillExitBaseStart);
    const otherExitImageByKey = new Map(otherExitImages.map((sceneImg) => [sceneImg.dataset.sceneLayer || '', sceneImg]));
    const otherExitLayerKeys = transitionTheme === 'area55'
          ? [
                  'robo-front', 'robo-walker', 'robo-fence',
                  'robo-fence-static-left', 'robo-fence-static-right',
                  'robo-ground-rear', 'robo-ground-front',
            ]
          .filter((key) => otherExitImageByKey.has(key))
      : [...otherExitImageByKey.keys()];
    const beachExitDependencies = transitionTheme === 'beach'
      ? { 'beach-sea-3': 'beach-ball', 'beach-shore-2': 'beach-castle' }
      : {};
    const beachExitStartOffsets = transitionTheme === 'beach'
      ? { 'beach-bottle': -0.2, 'beach-ball': 0.1 }
      : {};
    const otherSchedule = buildBoardTransitionExitSchedule({
      layerKeys: otherExitLayerKeys,
      baseStart: sceneExitStart + (frontPineExitImages.length + rearPineExitImages.length) * 0.05,
      stagger: 0.05,
      duration: BOARD_TRANSITION_REGULAR_SCENE_EXIT_SECONDS,
      dependencies: beachExitDependencies,
      startOffsets: beachExitStartOffsets,
    });
    const otherExitEntries = otherSchedule.entries.map((entry) => ({
      sceneImg: otherExitImageByKey.get(entry.key) as HTMLElement,
      start: entry.start,
      orderIndex: fenceExitImages.length + frontPineExitImages.length + rearPineExitImages.length + entry.orderIndex,
    }));
    const orderedExitEntries = [
      ...fenceExitImages.map((sceneImg, index) => ({ sceneImg, start: fenceExitStart + index * 0.06, orderIndex: index })),
      ...rearPineExitImages.map((sceneImg, index) => ({ sceneImg, start: rearPineExitStart + index * 0.05, orderIndex: fenceExitImages.length + index })),
      ...frontPineExitImages.map((sceneImg, index) => ({ sceneImg, start: sceneExitStart + index * 0.05, orderIndex: fenceExitImages.length + rearPineExitImages.length + index })),
      ...otherExitEntries,
      ...hillExitImages.map((sceneImg, index) => ({ sceneImg, start: hillExitBaseStart + index * 0.2, orderIndex: fenceExitImages.length + frontPineExitImages.length + rearPineExitImages.length + otherExitImages.length + index }))
    ];
    const latestSceneExitEnd = orderedExitEntries.reduce((latestEnd, { sceneImg, start }) => {
      const layerKey = sceneImg.dataset.sceneLayer || '';
      const duration = isTransitionHillLayer(layerKey)
        ? getTransitionHillExitConfig(layerKey).duration
        : BOARD_TRANSITION_REGULAR_SCENE_EXIT_SECONDS;
      return Math.max(latestEnd, start + duration);
    }, 0);
    sceneFadeStart = Math.max(
      sceneFadeStart,
      hillExitBaseStart + (hillExitImages.length * 0.2) + 0.35,
      latestSceneExitEnd + 0.02,
      latestCloudExitEnd + 0.02,
    );
    if (transitionTheme === 'beach') {
      logger.info('[BOARD_EXIT_TIMELINE] Beach exit ownership', {
        bottleStart: otherSchedule.entries.find((entry) => entry.key === 'beach-bottle')?.start,
        ballStart: otherSchedule.entries.find((entry) => entry.key === 'beach-ball')?.start,
        sea3Start: otherSchedule.entries.find((entry) => entry.key === 'beach-sea-3')?.start,
        castleStart: otherSchedule.entries.find((entry) => entry.key === 'beach-castle')?.start,
        shore2Start: otherSchedule.entries.find((entry) => entry.key === 'beach-shore-2')?.start,
        latestSceneExitEnd,
        latestCloudExitEnd,
        overlayFadeStart: sceneFadeStart,
      });
    }
    orderedExitEntries.forEach(({ sceneImg, start, orderIndex }) => {
      const sceneExitTimeline = trackTimeline();
      contentTimelines.push(sceneExitTimeline);
      const layerKey = sceneImg.dataset.sceneLayer || '';
      const isHill = isTransitionHillLayer(layerKey);
      const isAggressiveDownPine = layerKey === 'pine2' || layerKey === 'pine4';
      sceneImg.style.willChange = 'transform, opacity';
      if (isHill) {
        const exitConfig = getTransitionHillExitConfig(layerKey);
        sceneExitTimeline.to(sceneImg, {
          opacity: 0,
          y: `+=${exitConfig.dropY}`,
          scale: `*=${exitConfig.scale}`,
          scaleX: `*=${exitConfig.scale}`,
          scaleY: `*=${exitConfig.scale}`,
          rotation: 0,
          duration: exitConfig.duration,
          ease: exitConfig.ease,
          overwrite: 'auto',
          immediateRender: false,
          onStart: () => {
            try {
              sceneImg.style.transformOrigin = 'center bottom';
              sceneImg.style.willChange = 'transform, opacity';
            } catch {}
          },
          onComplete: () => {
            try { sceneImg.style.willChange = 'auto'; } catch {}
          }
        });
      } else {
        const isBeachSceneExit = transitionTheme === 'beach';
        const isRoboSceneExit = transitionTheme === 'area55';
        const isBeachBallExit = isBeachSceneExit && layerKey === 'beach-ball';
        if (isRoboSceneExit) {
          const isRoboFrontExit = layerKey === 'robo-front';
          sceneExitTimeline.to(sceneImg, {
            opacity: 1,
            ...(isRoboFrontExit ? {} : { x: 0 }),
            y: isRoboFrontExit
              ? `+=${Math.max(220, forestContainer.clientHeight * 0.35)}`
              : 24,
            rotation: isRoboFrontExit ? 0 : orderIndex % 2 === 0 ? 12 : -12,
            scale: 0,
            duration: BOARD_TRANSITION_REGULAR_SCENE_EXIT_SECONDS,
            ease: 'back.in(1.35)',
            overwrite: 'auto',
            onStart: () => {
              if (sceneImg.dataset.motionRole === 'float') stopBeachAmbientMotion(sceneImg);
              if (layerKey === 'robo-ground-rear' || layerKey === 'robo-ground-front') {
                stopRoboGroundAmbientMotion(sceneImg);
              }
            },
            onComplete: () => {
              sceneImg.style.opacity = '0';
              try { sceneImg.style.willChange = 'auto'; } catch {}
            },
          });
        } else sceneExitTimeline.to(sceneImg, {
          opacity: isBeachSceneExit || isRoboSceneExit ? 1 : 0,
          scale: 0,
          x: 0,
          y: isAggressiveDownPine ? 112 : 24,
          rotation: isBeachBallExit
            ? orderIndex % 2 === 0 ? '+=18' : '-=18'
            : orderIndex % 2 === 0 ? 12 : -12,
          duration: BOARD_TRANSITION_REGULAR_SCENE_EXIT_SECONDS,
          ease: isBeachSceneExit || isRoboSceneExit ? 'back.in(1.35)' : 'power2.in',
          overwrite: 'auto',
          onStart: () => {
            if (isBeachSceneExit) stopBeachAmbientMotion(sceneImg);
          },
          onComplete: () => {
            if (isBeachSceneExit || isRoboSceneExit) sceneImg.style.opacity = '0';
            try { sceneImg.style.willChange = 'auto'; } catch {}
          }
        });
      }
      exitTimeline.add(sceneExitTimeline, start);
    });
  } else {
    addCloudExitAt(sceneParallaxLead);
  }
  sceneFadeStart = Math.max(sceneFadeStart, latestCloudExitEnd + 0.02);

  // Finish the authored scene exit without exposing the unprepared Pixi
  // surface. Gameplay releases this opaque cover after two prepared frames.
  exitTimeline.to(overlay, {
    opacity: 1,
    duration: 0.001,
    ease: 'none'
  }, sceneFadeStart);
}

/**
 * Cleanup function - iOS App Store ready
 * Ensures all animations, timelines, and DOM elements are properly cleaned up
 */
function cleanup(options: { preserveDom?: boolean; keepVisibleCover?: boolean } = {}): void {
  if (isCleaningUp) return;
  isCleaningUp = true;
  const preserveDom = options.preserveDom === true;
  const keepVisibleCover = options.keepVisibleCover === true;
  try {
    stopMemSampling(preserveDom ? 'cleanup-preserved' : 'cleanup');
    stopIOSJourneyPerformanceAudit(preserveDom ? 'transition-cleanup-preserved' : 'transition-cleanup');
    lifecycle.cleanup();
    // 🔥 CRITICAL: Kill all active tweens
    activeTweens.forEach(tween => {
      try { 
        if (tween && typeof tween.kill === 'function') {
          tween.kill(); 
        }
      } catch (error) {
        logger.warn('⚠️ Error killing tween in cleanup:', error);
      }
    });
    activeTweens = [];

  // 🔥 CRITICAL: Kill all timelines
  if (enterTimeline) {
    try { 
      if (enterTimeline && typeof enterTimeline.kill === 'function') {
        enterTimeline.kill(); 
      }
    } catch (error) {
      logger.warn('⚠️ Error killing enterTimeline in cleanup:', error);
    }
    enterTimeline = null;
  }
  
  if (exitTimeline) {
    try { 
      if (exitTimeline && typeof exitTimeline.kill === 'function') {
        exitTimeline.kill(); 
      }
    } catch (error) {
      logger.warn('⚠️ Error killing exitTimeline in cleanup:', error);
    }
    exitTimeline = null;
  }
  
  if (pauseTimeline) {
    try { 
      if (pauseTimeline && typeof pauseTimeline.kill === 'function') {
        pauseTimeline.kill(); 
      }
    } catch (error) {
      logger.warn('⚠️ Error killing pauseTimeline in cleanup:', error);
    }
    pauseTimeline = null;
  }
  
  // 🔥 MEMORY LEAK FIX: Kill all delayedCall instances first (prevents callbacks from executing)
  cloudDelayedCalls.forEach(delayedCall => {
    try {
      if (delayedCall && typeof delayedCall.kill === 'function') {
        delayedCall.kill();
      }
    } catch (error) {
      logger.warn('⚠️ Error killing cloud delayedCall in cleanup:', error);
    }
  });
  cloudDelayedCalls = [];
  
  // Stop any CSS-side cloud state before killing GSAP cloud timelines.
  activeCloudImages.forEach(cloudImg => {
    try {
      cloudImg.style.animation = 'none';
      cloudImg.classList.remove('cc-cloud-exit');
    } catch {}
  });
  
  // 🔥 MEMORY LEAK FIX: Kill all cloud timelines (if any remain) with defensive checks
  cloudTimelines.forEach(timeline => {
    try {
      if (timeline && typeof timeline.kill === 'function') {
        // 🔥 FIX: Check timeline targets before killing to prevent null property errors
        const targets = (timeline as any).targets || [];
        const hasValidTarget = targets.length === 0 || targets.some((target: any) => 
          target && target !== null && target !== undefined && !target.destroyed
        );
        
        if (hasValidTarget || targets.length === 0) {
          timeline.kill();
        }
      }
    } catch (error) {
      logger.warn('⚠️ Error killing cloud timeline in cleanup:', error);
    }
  });
  cloudTimelines = [];
  
  // 🔥 FIX: Kill all content timelines (forest, digits) with defensive checks
  contentTimelines.forEach(timeline => {
    try {
      if (timeline && typeof timeline.kill === 'function') {
        // 🔥 FIX: Check timeline targets before killing to prevent null property errors
        const targets = (timeline as any).targets || [];
        const hasValidTarget = targets.length === 0 || targets.some((target: any) => 
          target && target !== null && target !== undefined && !target.destroyed
        );
        
        if (hasValidTarget || targets.length === 0) {
          timeline.kill();
        }
      }
    } catch (error) {
      logger.warn('⚠️ Error killing content timeline in cleanup:', error);
    }
  });
  contentTimelines = [];
      stopForestNNBees();
      try { beachShoreAmbientTimeline?.kill(); } catch {}
      beachShoreAmbientTimeline = null;
      beachAmbientTimelines.clear();
      roboGroundAmbientTimelines.clear();
      stopRoboAirCombatMotion();
      activeRoboAirCombatVariation = null;
  
  // Keep the overlay DOM reusable, but always return transient image elements to the pool.
  activeCloudImages.forEach(cloudImg => {
    try {
      resetPooledImage(cloudImg);
      domElementPool.release(cloudImg);
    } catch (error) {
      logger.warn('⚠️ Error releasing cloud image to pool:', error);
    }
  });
  activeCloudImages = [];
  activeCloudWrappers.forEach((wrapper) => {
    try {
      gsap.killTweensOf(wrapper);
      wrapper.remove();
    } catch {}
  });
  activeCloudWrappers = [];

  activeSceneImages.forEach(sceneImg => {
    try {
      resetPooledImage(sceneImg);
      domElementPool.release(sceneImg);
    } catch (error) {
      logger.warn('⚠️ Error releasing scene image to pool:', error);
    }
  });
  activeSceneImages = [];

  activeSceneElements.forEach((sceneEl) => {
    try {
      if (!(sceneEl instanceof HTMLImageElement)) sceneEl.remove();
    } catch {}
  });
  activeSceneElements = [];

  // 🔥 APP STORE: Kill animations on scene container
  try {
    const sceneContainers = document.querySelectorAll('.cc-board-transition-forest, .cc-board-transition-scene');
    sceneContainers.forEach(container => {
      try {
        gsap.killTweensOf(container);
        container.querySelectorAll('img').forEach((img) => gsap.killTweensOf(img));
      } catch {}
    });
  } catch (error) {
    logger.warn('⚠️ Error cleaning up scene container:', error);
  }

  // 🔥 APP STORE: Clear any digit element references
  try {
    const digitElements = document.querySelectorAll('.cc-board-transition-digit');
    digitElements.forEach(digit => {
      try {
        // Kill any remaining animations
        gsap.killTweensOf(digit);
      } catch {}
    });
  } catch (error) {
    logger.warn('⚠️ Error cleaning up digit elements:', error);
  }

  // 🔥 CRITICAL: Remove overlay from DOM and cleanup all child elements
  if (currentOverlay) {
    try {
      // Kill all animations on overlay and children first
      gsap.killTweensOf(currentOverlay);
      const overlayChildren = currentOverlay.querySelectorAll('*');
      overlayChildren.forEach(child => {
        try {
          gsap.killTweensOf(child);
        } catch {}
      });
      
      if (preserveDom) {
        if (keepVisibleCover) {
          currentOverlay.style.opacity = '1';
          currentOverlay.style.visibility = 'visible';
          currentOverlay.style.display = 'flex';
          applyAppPaperSurfaceToElement(currentOverlay);
        } else {
          currentOverlay.style.opacity = '0';
          currentOverlay.style.visibility = 'hidden';
          currentOverlay.style.display = 'none';
        }
      } else {
        // Remove from DOM
        if (currentOverlay.parentNode) {
          currentOverlay.parentNode.removeChild(currentOverlay);
        } else {
          currentOverlay.remove();
        }
        currentOverlay = null;
      }
    } catch (error) {
      logger.warn('⚠️ Error removing overlay:', error);
    }
  }

  if (!preserveDom) {
    // 🔥 CRITICAL: Also try to remove by ID (safety fallback)
    try {
      const existing = document.getElementById('cc-board-transition-overlay');
      if (existing) {
        // Kill animations before removing
        gsap.killTweensOf(existing);
        const existingChildren = existing.querySelectorAll('*');
        existingChildren.forEach(child => {
          try {
            gsap.killTweensOf(child);
          } catch {}
        });
        
        if (existing.parentNode) {
          existing.parentNode.removeChild(existing);
        } else {
          existing.remove();
        }
      }
    } catch (error) {
      logger.warn('⚠️ Error removing overlay by ID:', error);
    }
  }
  
  if (!preserveDom) {
    // 🔥 APP STORE: Force garbage collection hints (iOS Safari)
    // Clear all references to help GC
    try {
      // Clear any remaining references
      if (typeof (window as any).gc === 'function') {
        // Only if explicit GC is available (dev mode)
        (window as any).gc();
      }
    } catch {}
  }
  
    logger.info('✅ board-transition-screen: Cleanup complete - all resources released');
  } finally {
    isCleaningUp = false;
  }
}

/**
 * Force cleanup (exported for emergency cleanup)
 * iOS App Store ready - ensures complete cleanup in case of errors
 */
export function cleanupBoardTransitionScreen(): void {
  transitionGeneration += 1;
  boardTransitionPresentationHandoff.cancel();
  const interruptedSettlement = activeTransitionSettlement;
  try {
    // 🔥 APP STORE: Force cleanup - ensure everything is released
    cleanup();
    isTransitionActive = false;
    
    logger.info('✅ board-transition-screen: Force cleanup completed - all resources released');
  } catch (error) {
    logger.error('❌ board-transition-screen: Force cleanup failed:', error);
    // Fallback: at least reset the flags
    isTransitionActive = false;
    currentOverlay = null;
  } finally {
    interruptedSettlement?.(false);
  }
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cleanupBoardTransitionScreen();
  });
}
