import { gsap } from 'gsap';
import { resolveMobileRuntimeProfile } from './mobile-runtime-profile.js';
import { startJourneyAmbientCanvasRuntime, type JourneyAmbientCanvasDepth, type JourneyAmbientCanvasFrame, type JourneyAmbientTicker } from './journey-ambient-canvas-runtime.js';

const DESIGN_WIDTH = 390;
const REFERENCE_HEIGHT = 844;
const SHIP_COUNT = 4;
const SHIP_ASSET = './assets/journey assets/robo/ship1@2x.png';
const MIN_SHIP_SIZE_PX = 50;
const MAX_SHIP_SIZE_PX = 75;
const MAX_SHIP_ROTATION_RADIANS = 20 * (Math.PI / 180);
const MIN_SCALE_HOLD_SECONDS = 3;
const SCALE_HOLD_VARIANCE_SECONDS = 1.5;
const SCALE_CHANGE_DURATION_SECONDS = 0.45;

export interface JourneyArea55ShipRuntimeProfile { visibilityMarginPx: number; pixelRatioCap: number; maxFramesPerSecond: number }
export interface StartJourneyArea55ShipFlybysOptions {
  root: HTMLElement; scrollRoot?: HTMLElement | null; leftGutterPx?: number; random?: () => number;
  ticker?: JourneyAmbientTicker; observeVisibility?: boolean; runtimeProfile?: JourneyArea55ShipRuntimeProfile;
}
export interface JourneyArea55ShipFlybyController {
  setSuspended(suspended: boolean): void;
  dispose(): void;
  getSnapshot(): {
    disposed: boolean; shipCount: number; behindShipCount: number; frontShipCount: number;
    minShipSizePx: number; maxShipSizePx: number; canvasCount: number; tickerCount: number;
    visibleShipCount: number; domImageCount: number; renderer: 'canvas'; asset: string;
    maxRotationDegrees: number; maxFramesPerSecond: number;
  };
}

interface LiveShip {
  depth: JourneyAmbientCanvasDepth; lane: 'upper' | 'lower'; direction: -1 | 1; elapsedSeconds: number; delaySeconds: number;
  durationSeconds: number; startX: number; startY: number; endX: number; endY: number;
  control1X: number; control1Y: number; control2X: number; control2Y: number; baseSize: number;
  scaleWave: number; scaleFromWave: number; scaleTargetWave: number; scaleHoldSeconds: number;
  scaleTransitionSeconds: number; wobblePhase: number; wobbleAmplitude: number; x: number; y: number;
  rendered: boolean; planned: boolean;
}

function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }
function clamp01(value: number): number { return clamp(Number.isFinite(value) ? value : 0.5, 0, 1); }
function sample(random: () => number): number { return clamp01(random()); }

export function getJourneyArea55ShipSize(baseSize: number, scaleWave: number): number {
  return clamp(baseSize * (0.82 + clamp01(scaleWave) * 0.36), MIN_SHIP_SIZE_PX, MAX_SHIP_SIZE_PX);
}

export function advanceJourneyArea55ShipScale(
  state: Pick<LiveShip, 'scaleWave' | 'scaleFromWave' | 'scaleTargetWave' | 'scaleHoldSeconds' | 'scaleTransitionSeconds'>,
  deltaSeconds: number,
  random: () => number,
): void {
  let remainingSeconds = Math.max(0, deltaSeconds);
  if (state.scaleHoldSeconds > 0) {
    const heldSeconds = Math.min(state.scaleHoldSeconds, remainingSeconds);
    state.scaleHoldSeconds -= heldSeconds;
    remainingSeconds -= heldSeconds;
    if (state.scaleHoldSeconds > 0) return;
    state.scaleFromWave = state.scaleWave;
    state.scaleTargetWave = sample(random);
    state.scaleTransitionSeconds = 0;
  }
  state.scaleTransitionSeconds = Math.min(SCALE_CHANGE_DURATION_SECONDS, state.scaleTransitionSeconds + remainingSeconds);
  const transitionProgress = state.scaleTransitionSeconds / SCALE_CHANGE_DURATION_SECONDS;
  const eased = transitionProgress * transitionProgress * (3 - 2 * transitionProgress);
  state.scaleWave = state.scaleFromWave + (state.scaleTargetWave - state.scaleFromWave) * eased;
  if (transitionProgress >= 1) {
    state.scaleWave = state.scaleTargetWave;
    state.scaleHoldSeconds = MIN_SCALE_HOLD_SECONDS + sample(random) * SCALE_HOLD_VARIANCE_SECONDS;
  }
}

export function clampJourneyArea55ShipRotation(rotationRadians: number): number {
  return clamp(rotationRadians, -MAX_SHIP_ROTATION_RADIANS, MAX_SHIP_ROTATION_RADIANS);
}

export function resolveJourneyArea55ShipRuntimeProfile(
  userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '',
  platform = typeof navigator !== 'undefined' ? navigator.platform : '',
  maxTouchPoints = typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0,
): JourneyArea55ShipRuntimeProfile {
  const mobile = resolveMobileRuntimeProfile({ userAgent, platform, maxTouchPoints });
  return { visibilityMarginPx: mobile.ambientVisibilityMarginPx, pixelRatioCap: mobile.ambientPixelRatioCap, maxFramesPerSecond: mobile.settledIdleMaxFramesPerSecond };
}

function resolveSceneHeight(root: HTMLElement): number {
  const authoredHeight = Number.parseFloat(root.style.height || '');
  if (Number.isFinite(authoredHeight) && authoredHeight > 0) return authoredHeight;
  return Math.max(1, root.getBoundingClientRect().height || root.clientHeight || REFERENCE_HEIGHT);
}

export function resolveJourneyArea55ShipCanvasGeometry(
  root: HTMLElement,
  scrollRoot: HTMLElement | null | undefined,
  fallbackWidth: number,
  fallbackLeftGutterPx = 0,
): { left: number; width: number } {
  const rootRect = root.getBoundingClientRect();
  const viewportRect = scrollRoot?.getBoundingClientRect();
  const measuredWidth = scrollRoot?.clientWidth || viewportRect?.width || fallbackWidth;
  const hasMeasuredOrigin = Number.isFinite(rootRect.left) && Number.isFinite(viewportRect?.left);
  return {
    left: hasMeasuredOrigin ? Number(viewportRect?.left) - rootRect.left : -fallbackLeftGutterPx,
    width: Math.max(1, Number.isFinite(measuredWidth) ? measuredWidth : fallbackWidth),
  };
}

function createShipAsset(): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  const image = new Image(); image.decoding = 'async'; image.src = SHIP_ASSET; return image;
}

function cubicBezier(a: number, b: number, c: number, d: number, progress: number): number {
  const inverse = 1 - progress;
  return inverse ** 3 * a + 3 * inverse ** 2 * progress * b + 3 * inverse * progress ** 2 * c + progress ** 3 * d;
}

function drawShip(context: CanvasRenderingContext2D | null, image: HTMLImageElement | null, ship: LiveShip, size: number, rotation: number, canvasTop: number): void {
  if (!context || !image?.complete || image.naturalWidth <= 0) return;
  context.save(); context.translate(ship.x, ship.y - canvasTop); context.rotate(rotation);
  context.drawImage(image, -size * 0.5, -size * (188 / 194) * 0.5, size, size * (188 / 194)); context.restore();
}

export function startJourneyArea55ShipFlybys(options: StartJourneyArea55ShipFlybysOptions): JourneyArea55ShipFlybyController {
  const { root } = options;
  const random = options.random ?? Math.random;
  const ticker = options.ticker ?? gsap.ticker;
  const profile = options.runtimeProfile ?? resolveJourneyArea55ShipRuntimeProfile();
  const background = root.querySelector<HTMLElement>('.journey-bg-container');
  const cloudLayer = root.querySelector<HTMLElement>('.journey-cloud-container');
  const sceneHeight = resolveSceneHeight(root);
  const viewportWidth = window.innerWidth || root.getBoundingClientRect().width || DESIGN_WIDTH;
  const leftGutter = options.leftGutterPx ?? 0;
  // The Journey section already cancels the shared 24px content padding and
  // spans the physical viewport. Reusing the background's historical -24px
  // inline offset shifted this canvas left a second time, so its right edge
  // ended 24px before the device edge. Measure the actual root/scroll viewport
  // relationship instead of applying padding ownership twice.
  const canvasGeometry = resolveJourneyArea55ShipCanvasGeometry(root, options.scrollRoot, viewportWidth, leftGutter);
  const layerLeft = canvasGeometry.left;
  const layerWidth = canvasGeometry.width;
  const image = createShipAsset();
  let disposed = false;
  const ships: LiveShip[] = Array.from({ length: SHIP_COUNT }, (_, index) => ({
    depth: 'behind', lane: index % 2 === 0 ? 'upper' : 'lower', direction: index % 2 === 0 ? 1 : -1,
    elapsedSeconds: 0, delaySeconds: index * 0.42, durationSeconds: 5,
    startX: 0, startY: 0, endX: 0, endY: 0, control1X: 0, control1Y: 0, control2X: 0, control2Y: 0,
    baseSize: MIN_SHIP_SIZE_PX, scaleWave: sample(random), scaleFromWave: 0.5, scaleTargetWave: 0.5,
    scaleHoldSeconds: MIN_SCALE_HOLD_SECONDS + sample(random) * SCALE_HOLD_VARIANCE_SECONDS,
    scaleTransitionSeconds: SCALE_CHANGE_DURATION_SECONDS, wobblePhase: sample(random) * Math.PI * 2,
    wobbleAmplitude: 0, x: 0, y: 0, rendered: false, planned: false,
  }));

  const resetFlight = (ship: LiveShip, index: number, frame: JourneyAmbientCanvasFrame): void => {
    ship.direction = sample(random) < 0.5 ? -1 : 1;
    const overshoot = MAX_SHIP_SIZE_PX * 0.72;
    ship.startX = ship.direction === 1 ? -overshoot : layerWidth + overshoot;
    ship.endX = ship.direction === 1 ? layerWidth + overshoot : -overshoot;
    const visibleHeight = Math.max(1, frame.viewportBottom - frame.viewportTop);
    const laneTop = frame.viewportTop + visibleHeight * (ship.lane === 'upper' ? 0.12 : 0.62);
    const laneSpan = visibleHeight * 0.22;
    ship.startY = laneTop + sample(random) * laneSpan; ship.endY = laneTop + sample(random) * laneSpan;
    ship.control1X = layerWidth * (ship.direction === 1 ? 0.22 : 0.78);
    ship.control2X = layerWidth * (ship.direction === 1 ? 0.78 : 0.22);
    ship.control1Y = laneTop + sample(random) * laneSpan; ship.control2Y = laneTop + sample(random) * laneSpan;
    ship.durationSeconds = 4.2 + sample(random) * 2.8; ship.baseSize = 55 + sample(random) * 14.5;
    ship.wobbleAmplitude = 12 + sample(random) * 24; ship.scaleWave = sample(random);
    ship.scaleFromWave = ship.scaleWave; ship.scaleTargetWave = ship.scaleWave;
    ship.scaleHoldSeconds = MIN_SCALE_HOLD_SECONDS + sample(random) * SCALE_HOLD_VARIANCE_SECONDS;
    ship.scaleTransitionSeconds = SCALE_CHANGE_DURATION_SECONDS;
    ship.wobblePhase = sample(random) * Math.PI * 2; ship.elapsedSeconds = -((index * 0.38) + sample(random) * 0.35);
    ship.x = ship.startX; ship.y = ship.startY; ship.rendered = false; ship.planned = true;
  };

  const render = (frame: JourneyAmbientCanvasFrame): number => {
    let visibleCount = 0;
    ships.forEach((ship, index) => {
      if (!ship.planned || ship.y < frame.viewportTop - MAX_SHIP_SIZE_PX || ship.y > frame.viewportBottom + MAX_SHIP_SIZE_PX) resetFlight(ship, index, frame);
      ship.elapsedSeconds += frame.deltaSeconds;
      if (ship.elapsedSeconds < ship.delaySeconds) return;
      const rawProgress = (ship.elapsedSeconds - ship.delaySeconds) / ship.durationSeconds;
      if (rawProgress >= 1) { resetFlight(ship, index, frame); return; }
      const progress = clamp01(rawProgress);
      const eased = progress * progress * (3 - 2 * progress);
      const pathX = cubicBezier(ship.startX, ship.control1X, ship.control2X, ship.endX, eased);
      const pathY = cubicBezier(ship.startY, ship.control1Y, ship.control2Y, ship.endY, eased);
      const wave = Math.sin(progress * Math.PI * 4 + ship.wobblePhase);
      const nextX = pathX + Math.cos(progress * Math.PI * 3 + ship.wobblePhase) * ship.wobbleAmplitude * 0.35;
      const nextY = pathY + wave * ship.wobbleAmplitude;
      const velocityX = nextX - ship.x; const velocityY = nextY - ship.y; ship.x = nextX; ship.y = nextY;
      advanceJourneyArea55ShipScale(ship, frame.deltaSeconds, random);
      const size = getJourneyArea55ShipSize(ship.baseSize, ship.scaleWave);
      const rotation = clampJourneyArea55ShipRotation(
        Math.atan2(velocityY, velocityX) * 0.58
          + Math.sin(progress * Math.PI * 8 + ship.wobblePhase) * 0.12,
      );
      ship.rendered = ship.x + size >= 0 && ship.x - size <= frame.width && ship.y + size >= frame.viewportTop && ship.y - size <= frame.viewportBottom;
      if (!ship.rendered) return;
      visibleCount += 1;
      drawShip(ship.depth === 'front' ? frame.front : frame.behind, image, ship, size, rotation, frame.viewportTop);
    });
    return visibleCount;
  };

  const runtime = startJourneyAmbientCanvasRuntime({
    root, scrollRoot: options.scrollRoot, ticker, sceneWidthPx: layerWidth, sceneHeightPx: sceneHeight, layerLeftPx: layerLeft,
    visibilityMarginPx: profile.visibilityMarginPx, pixelRatioCap: profile.pixelRatioCap, maxFramesPerSecond: profile.maxFramesPerSecond,
    behindBefore: cloudLayer ?? background, behindZIndex: 2, frontZIndex: 7, className: 'journey-area55-ship-canvas',
    observeVisibility: options.observeVisibility, render,
  });
  root.dataset.journeyArea55ShipRenderer = 'canvas';
  return {
    setSuspended: (suspended) => runtime.setSuspended(suspended),
    dispose(): void { if (disposed) return; disposed = true; runtime.dispose(); if (image) { image.onload = null; image.onerror = null; } ships.length = 0; delete root.dataset.journeyArea55ShipRenderer; },
    getSnapshot: () => {
      const snapshot = runtime.getSnapshot();
      return {
        disposed, shipCount: ships.length, behindShipCount: ships.filter((ship) => ship.depth === 'behind').length,
        frontShipCount: ships.filter((ship) => ship.depth === 'front').length, minShipSizePx: MIN_SHIP_SIZE_PX,
        maxShipSizePx: MAX_SHIP_SIZE_PX, canvasCount: snapshot.canvasCount, tickerCount: snapshot.tickerCount,
        visibleShipCount: snapshot.visibleSpriteCount, domImageCount: 0, renderer: 'canvas' as const, asset: SHIP_ASSET,
        maxRotationDegrees: 20,
        maxFramesPerSecond: snapshot.maxFramesPerSecond,
      };
    },
  };
}
