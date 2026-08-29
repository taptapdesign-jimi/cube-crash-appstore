import { gsap } from 'gsap';
import { resolveMobileRuntimeProfile } from './mobile-runtime-profile.js';
import {
  startJourneyAmbientCanvasRuntime,
  type JourneyAmbientCanvasFrame,
  type JourneyAmbientTicker,
} from './journey-ambient-canvas-runtime.js';

const TAU = Math.PI * 2;
const FOREST_DESIGN_WIDTH = 390;
const FOREST_FLIGHT_MAX_Y = 1428;
const FOREST_UNIT_BEE_COUNT = 14;
const FOREST_MAIN_BEE_COUNT = 4;
const FOREST_BEE_COUNT = FOREST_UNIT_BEE_COUNT + FOREST_MAIN_BEE_COUNT;
const FOREST_BEE_POINT_COUNT = 8;
const FOREST_BEE_ROAM_SECONDS = 11;
const FOREST_BEE_EDGE_SECONDS = 7.8;
const FOREST_BEE_BOUNCE_GAIN = 1.125;
const FOREST_BEE_MIN_ONSCREEN_SECONDS = 30;
const FOREST_BEE_DIRECTION_FADE_SECONDS = 0.08;
const FOREST_BEE_DIRECTION_STABILITY_SECONDS = 0.05;
const FOREST_BEE_ROAM_RANGE_MULTIPLIER = 0.82;
const FOREST_BEE_VISIBILITY_MARGIN_PX = 180;
const FOREST_BEE_DEPTH_SCALES = Object.freeze([0.65, 0.7, 0.8, 0.9, 1] as const);
const FOREST_UNIT_DUPLICATE_LANES = Object.freeze([2, 4, 5, 7] as const);
const FOREST_BEE_ASSET_BASE = './assets/shop/honey';

type ForestBeeAsset = 'bee1' | 'bee2' | 'bee3' | 'bee4' | 'bee5' | 'bee6' | 'bee7';
type ForestBeeFlightPhase = 'roam' | 'exit' | 'entry';
type ForestBeeEdgeRoute = 'side' | 'forest-gate';
type ForestBeeDepth = 'front' | 'behind-forest-main';

interface ForestBeeGateGeometry {
  source: 'dom' | 'fallback';
  passageLeftX: number;
  passageRightX: number;
  centerX: number;
  topY: number;
  bottomY: number;
  leftPineX: number;
  rightPineX: number;
}

const FOREST_BEE_FALLBACK_GATE_GEOMETRY: ForestBeeGateGeometry = Object.freeze({
  source: 'fallback',
  passageLeftX: 160.92,
  passageRightX: 205.08,
  centerX: 183,
  topY: 60,
  bottomY: 85,
  leftPineX: 103,
  rightPineX: 287,
});

const FOREST_BEE_ASSETS = Object.freeze(
  Array.from({ length: 7 }, (_, index) => {
    const asset = `bee${index + 1}` as ForestBeeAsset;
    return {
      asset,
      src: `${FOREST_BEE_ASSET_BASE}/${asset}.png`,
      srcset: `${FOREST_BEE_ASSET_BASE}/${asset}@2x.png 2x`,
    };
  }),
);
const FOREST_BEE_ASSET_BY_ID = new Map(FOREST_BEE_ASSETS.map((entry) => [entry.asset, entry]));

export interface JourneyForestBeeFlightPlan {
  points: Float32Array;
  durationSeconds: number;
  elapsedSeconds: number;
  onScreenSeconds: number;
  bouncePhase: number;
  width: number;
  scale: number;
  gateRouteOrdinal: number;
  gateSide: -1 | 1;
  gatePassageFraction: number;
  edgeRoute: ForestBeeEdgeRoute;
  phase: ForestBeeFlightPhase;
  unitIndex: number;
}

interface ForestBeeFlightContinuity {
  tangentX: number;
  tangentY: number;
  bouncePhase: number;
}

interface StartJourneyForestBeeOrbitsOptions {
  root: HTMLElement;
  contentTopPx: number;
  leftGutterPx: number;
  scrollRoot?: HTMLElement | null;
  random?: () => number;
  ticker?: JourneyAmbientTicker;
  observeVisibility?: boolean;
  runtimeProfile?: JourneyForestBeeRuntimeProfile;
}

export interface JourneyForestBeeRuntimeProfile {
  visibilityMarginPx: number;
  pixelRatioCap: number;
  maxFramesPerSecond: number;
  maxBeeCount: number;
}

export function resolveJourneyForestBeeRuntimeProfile(
  userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '',
  platform = typeof navigator !== 'undefined' ? navigator.platform : '',
  maxTouchPoints = typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0,
): JourneyForestBeeRuntimeProfile {
  const mobileProfile = resolveMobileRuntimeProfile({ userAgent, platform, maxTouchPoints });
  if (mobileProfile.isMobileDevice) {
    return {
      visibilityMarginPx: mobileProfile.ambientVisibilityMarginPx,
      pixelRatioCap: Math.min(mobileProfile.ambientPixelRatioCap, 1.35),
      maxFramesPerSecond: mobileProfile.settledIdleMaxFramesPerSecond,
      maxBeeCount: mobileProfile.ambientSpriteBudget,
    };
  }
  return {
    visibilityMarginPx: FOREST_BEE_VISIBILITY_MARGIN_PX,
    pixelRatioCap: 2,
    maxFramesPerSecond: 0,
    maxBeeCount: 0,
  };
}

export interface JourneyForestBeeOrbitController {
  setSuspended(suspended: boolean): void;
  fadeOutAndDispose(durationMs: number): void;
  dispose(): void;
  getSnapshot(): {
    disposed: boolean;
    beeCount: number;
    imageLayerCount: number;
    tickerCount: number;
    visibleBeeCount: number;
    mainBeeCount: number;
    gateBeeCount: number;
    gateEntryCount: number;
    gateExitCount: number;
    gateGeometrySource: 'dom' | 'fallback';
    gateCenterX: number;
    gateCenterY: number;
    renderer: 'canvas';
    canvasCount: number;
    domImageCount: number;
    pixelRatio: number;
    bitmapPixels: number;
    maxFramesPerSecond: number;
    visibilityMarginPx: number;
  };
}

interface LiveBee {
  plan: JourneyForestBeeFlightPlan;
  sample: Float32Array;
  currentAsset: ForestBeeAsset | null;
  previousAsset: ForestBeeAsset | null;
  assetBlendSeconds: number;
  pendingAsset: ForestBeeAsset | null;
  pendingAssetSeconds: number;
  depth: ForestBeeDepth | null;
  rendered: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sample(random: () => number): number {
  const value = random();
  return Number.isFinite(value) ? clamp(value, 0, 1) : 0.5;
}

function centered(random: () => number): number {
  return (sample(random) * 2) - 1;
}

function resolveForestGateGeometry(options: StartJourneyForestBeeOrbitsOptions): ForestBeeGateGeometry {
  const main = options.root.querySelector<HTMLElement>(
    '.journey-forest-main-art:not(.journey-beach-main-art):not(.journey-robo-main-art)',
  );
  if (!main || typeof main.getBoundingClientRect !== 'function') {
    return FOREST_BEE_FALLBACK_GATE_GEOMETRY;
  }
  const rootRect = options.root.getBoundingClientRect();
  const mainRect = main.getBoundingClientRect();
  const viewportWidth = window.innerWidth || rootRect.width || FOREST_DESIGN_WIDTH;
  if (mainRect.width < 1 || mainRect.height < 1 || viewportWidth < 1) {
    return FOREST_BEE_FALLBACK_GATE_GEOMETRY;
  }

  const sceneUnitsPerPx = FOREST_DESIGN_WIDTH / viewportWidth;
  const sceneOriginX = rootRect.left - options.leftGutterPx;
  const sceneOriginY = rootRect.top + options.contentTopPx;
  const toSceneX = (assetX: number) => (
    mainRect.left + ((assetX / 390) * mainRect.width) - sceneOriginX
  ) * sceneUnitsPerPx;
  const toSceneY = (assetY: number) => (
    mainRect.top + ((assetY / 350) * mainRect.height) - sceneOriginY
  ) * sceneUnitsPerPx;
  // Alpha scan of the authored PNG proves the safe transparent door corridor
  // between the wooden posts is x=159..207 and y=60..85. Inset both sides
  // by 1.92 authored pixels to shorten its usable width by exactly 8%.

  return {
    source: 'dom',
    passageLeftX: toSceneX(160.92),
    passageRightX: toSceneX(205.08),
    centerX: toSceneX(183),
    topY: toSceneY(60),
    bottomY: toSceneY(85),
    leftPineX: toSceneX(103),
    rightPineX: toSceneX(287),
  };
}

function setPlanPoint(points: Float32Array, index: number, x: number, y: number): void {
  points[index * 2] = x;
  points[(index * 2) + 1] = y;
}

function readPlanPoint(
  points: Float32Array,
  index: number,
  axis: 0 | 1,
  cyclic = false,
): number {
  const uniquePointCount = FOREST_BEE_POINT_COUNT - 1;
  const boundedIndex = cyclic
    ? ((index % uniquePointCount) + uniquePointCount) % uniquePointCount
    : clamp(index, 0, FOREST_BEE_POINT_COUNT - 1);
  return points[(boundedIndex * 2) + axis];
}

const FOREST_UNIT_LANE_CENTERS = Object.freeze([
  384, 474, 584, 672, 802, 906, 1010, 1134, 1238, 1362,
] as const);

function getLaneCenterY(unitIndex: number): number {
  if (unitIndex < 0) return 190;
  return FOREST_UNIT_LANE_CENTERS[unitIndex % FOREST_UNIT_LANE_CENTERS.length];
}

function getUnitAnchorX(unitIndex: number, random: () => number): number {
  const unitCenterX = unitIndex % 2 === 0 ? 112 : 278;
  return clamp(unitCenterX + (centered(random) * 52), 34, FOREST_DESIGN_WIDTH - 34);
}

function resetRoamPlan(
  plan: JourneyForestBeeFlightPlan,
  index: number,
  random: () => number,
  startX?: number,
  startY?: number,
  initialProgress = 0,
  continuity?: ForestBeeFlightContinuity,
): void {
  const laneCenterY = getLaneCenterY(plan.unitIndex);
  const ownsVerticalSweep = index % 4 === 0;
  const anchorX = Number.isFinite(startX) ? Number(startX) : 56 + (sample(random) * 278);
  const anchorY = Number.isFinite(startY)
    ? Number(startY)
    : clamp(
      laneCenterY + (centered(random) * 46),
      48,
      FOREST_FLIGHT_MAX_Y,
    );

  const tangentLength = continuity ? Math.hypot(continuity.tangentX, continuity.tangentY) : 0;
  const tangentX = tangentLength > 0.001 ? continuity!.tangentX / tangentLength : 0;
  const tangentY = tangentLength > 0.001 ? continuity!.tangentY / tangentLength : 0;
  const tangentDistance = 36 * FOREST_BEE_ROAM_RANGE_MULTIPLIER;

  setPlanPoint(plan.points, 0, anchorX, anchorY);
  for (let pointIndex = 1; pointIndex < FOREST_BEE_POINT_COUNT - 1; pointIndex += 1) {
    if (continuity && pointIndex === 1) {
      setPlanPoint(plan.points, pointIndex, anchorX + (tangentX * tangentDistance), anchorY + (tangentY * tangentDistance));
      continue;
    }
    if (continuity && pointIndex === FOREST_BEE_POINT_COUNT - 2) {
      setPlanPoint(plan.points, pointIndex, anchorX - (tangentX * tangentDistance), anchorY - (tangentY * tangentDistance));
      continue;
    }
    const alternatingPull = (pointIndex % 2 === 1 ? 52 : -52) * FOREST_BEE_ROAM_RANGE_MULTIPLIER;
    const x = clamp(
      anchorX + alternatingPull + (centered(random) * 92 * FOREST_BEE_ROAM_RANGE_MULTIPLIER),
      20,
      FOREST_DESIGN_WIDTH - 20,
    );
    const verticalSweep = ownsVerticalSweep
      ? Math.sin((pointIndex / (FOREST_BEE_POINT_COUNT - 1)) * TAU) * 48
      : centered(random) * 48;
    const verticalTexture = ownsVerticalSweep ? centered(random) * 12 : 0;
    const y = clamp(
      anchorY + ((verticalSweep + verticalTexture) * FOREST_BEE_ROAM_RANGE_MULTIPLIER),
      Math.max(42, laneCenterY - 72),
      Math.min(FOREST_FLIGHT_MAX_Y, laneCenterY + 72),
    );
    setPlanPoint(plan.points, pointIndex, x, y);
  }
  // A closed roam never disappears or teleports at its cycle boundary.
  setPlanPoint(plan.points, FOREST_BEE_POINT_COUNT - 1, anchorX, anchorY);
  plan.phase = 'roam';
  plan.durationSeconds = FOREST_BEE_ROAM_SECONDS;
  plan.elapsedSeconds = clamp(initialProgress, 0, 0.94) * plan.durationSeconds;
  plan.bouncePhase = continuity ? continuity.bouncePhase : sample(random) * TAU;
  plan.width = 36 + (sample(random) * 8);
}

function resetExitPlan(
  plan: JourneyForestBeeFlightPlan,
  random: () => number,
  gate: ForestBeeGateGeometry,
): void {
  const startX = readPlanPoint(plan.points, FOREST_BEE_POINT_COUNT - 1, 0);
  const startY = readPlanPoint(plan.points, FOREST_BEE_POINT_COUNT - 1, 1);
  if (plan.edgeRoute === 'forest-gate') {
    const behindSide = plan.gateSide;
    const travelDirection = behindSide === -1 ? -1 : 1;
    const nearPassageX = behindSide === -1 ? gate.passageLeftX : gate.passageRightX;
    const farPassageX = behindSide === -1 ? gate.passageRightX : gate.passageLeftX;
    const originPineX = behindSide === -1 ? gate.leftPineX : gate.rightPineX;
    const oppositePineX = behindSide === -1 ? gate.rightPineX : gate.leftPineX;
    const exitX = behindSide === -1 ? 20 : FOREST_DESIGN_WIDTH - 20;
    const passageSpan = Math.max(1, gate.bottomY - gate.topY - 7);
    const passageY = gate.topY + 2 + (plan.gatePassageFraction * passageSpan);
    const exitY = clamp(50 + (sample(random) * 30), 50, 80);
    const beeHalfSize = (plan.width * plan.scale) / 2;
    const centeredGatePoint = (x: number, y: number): readonly [number, number] => [
      x - beeHalfSize,
      y - beeHalfSize,
    ];
    const gatePoints: ReadonlyArray<readonly [number, number]> = [
      [startX, startY],
      centeredGatePoint(oppositePineX, startY + ((passageY - startY) * 0.55)),
      centeredGatePoint(farPassageX - (travelDirection * 34), passageY + 1),
      centeredGatePoint(farPassageX, passageY),
      centeredGatePoint(nearPassageX, passageY),
      centeredGatePoint(nearPassageX + (travelDirection * 28), passageY - 1),
      centeredGatePoint(originPineX, passageY + ((exitY - passageY) * 0.45)),
      centeredGatePoint(exitX, exitY),
    ];
    gatePoints.forEach(([x, y], pointIndex) => setPlanPoint(plan.points, pointIndex, x, y));
    plan.phase = 'exit';
    plan.durationSeconds = FOREST_BEE_EDGE_SECONDS * (0.84 + (sample(random) * 0.32));
    plan.elapsedSeconds = 0;
    return;
  }
  const exitsRight = sample(random) >= 0.5;
  const endX = exitsRight ? FOREST_DESIGN_WIDTH + 72 : -72;
  const laneCenterY = getLaneCenterY(plan.unitIndex);

  for (let pointIndex = 0; pointIndex < FOREST_BEE_POINT_COUNT; pointIndex += 1) {
    const progress = pointIndex / (FOREST_BEE_POINT_COUNT - 1);
    const edgeSafe = pointIndex === 0 || pointIndex === FOREST_BEE_POINT_COUNT - 1;
    const x = startX + ((endX - startX) * progress) + (edgeSafe ? 0 : centered(random) * 24);
    const y = edgeSafe && pointIndex === 0
      ? startY
      : clamp(startY + ((laneCenterY - startY) * progress) + (centered(random) * 72), 36, FOREST_FLIGHT_MAX_Y);
    setPlanPoint(plan.points, pointIndex, x, y);
  }
  plan.phase = 'exit';
  plan.durationSeconds = FOREST_BEE_EDGE_SECONDS;
  plan.elapsedSeconds = 0;
  plan.bouncePhase = sample(random) * TAU;
}

function resetEntryPlan(
  plan: JourneyForestBeeFlightPlan,
  random: () => number,
  gate: ForestBeeGateGeometry,
  initialProgress = 0,
  startX?: number,
  startY?: number,
): void {
  if (plan.edgeRoute === 'forest-gate') {
    const entrySide = plan.gateSide;
    const travelDirection = entrySide === -1 ? 1 : -1;
    const passageSpan = Math.max(1, gate.bottomY - gate.topY - 7);
    const passageY = gate.topY + 2 + (plan.gatePassageFraction * passageSpan);
    const entryStartX = entrySide === -1 ? -36 : FOREST_DESIGN_WIDTH + 36;
    const approachOffsetY = -40 + (sample(random) * 90);
    const entryStartY = clamp(passageY + approachOffsetY, 20, 135);
    const nearPassageX = entrySide === -1 ? gate.passageLeftX : gate.passageRightX;
    const farPassageX = entrySide === -1 ? gate.passageRightX : gate.passageLeftX;
    const originPineX = entrySide === -1 ? gate.leftPineX : gate.rightPineX;
    const oppositePineX = entrySide === -1 ? gate.rightPineX : gate.leftPineX;
    const entryEndX = getUnitAnchorX(plan.unitIndex, random);
    const laneCenterY = getLaneCenterY(plan.unitIndex);
    const entryEndY = clamp(
      laneCenterY + (centered(random) * 44),
      92,
      FOREST_FLIGHT_MAX_Y,
    );
    const beeHalfSize = (plan.width * plan.scale) / 2;
    const centeredGatePoint = (x: number, y: number): readonly [number, number] => [
      x - beeHalfSize,
      y - beeHalfSize,
    ];
    const hasContinuousStart = Number.isFinite(startX) && Number.isFinite(startY);
    const gatePoints: ReadonlyArray<readonly [number, number]> = [
      hasContinuousStart ? [Number(startX), Number(startY)] : centeredGatePoint(entryStartX, entryStartY),
      centeredGatePoint(originPineX, entryStartY + ((passageY - entryStartY) * 0.35)),
      centeredGatePoint(nearPassageX - (travelDirection * 28), passageY - 1),
      centeredGatePoint(nearPassageX, passageY),
      centeredGatePoint(farPassageX, passageY),
      centeredGatePoint(farPassageX + (travelDirection * 34), passageY + 1),
      centeredGatePoint(oppositePineX, passageY + ((entryEndY - passageY) * 0.45)),
      centeredGatePoint(entryEndX, entryEndY),
    ];
    gatePoints.forEach(([x, y], pointIndex) => setPlanPoint(plan.points, pointIndex, x, y));
    plan.phase = 'entry';
    const verticalTravel = Math.abs(entryEndY - passageY);
    plan.durationSeconds = Math.max(
      FOREST_BEE_EDGE_SECONDS * (0.9 + (sample(random) * 0.2)),
      4.5 + (verticalTravel / 105),
    );
    plan.elapsedSeconds = clamp(initialProgress, 0, 0.9) * plan.durationSeconds;
    plan.onScreenSeconds = 0;
    return;
  }
  const entersFromRight = sample(random) >= 0.5;
  const sideStartX = entersFromRight ? FOREST_DESIGN_WIDTH + 72 : -72;
  const endX = 58 + (sample(random) * 274);
  const laneCenterY = getLaneCenterY(plan.unitIndex);
  const sideStartY = clamp(laneCenterY + (centered(random) * 94), 42, FOREST_FLIGHT_MAX_Y);
  const endY = clamp(laneCenterY + (centered(random) * 72), 42, FOREST_FLIGHT_MAX_Y);

  for (let pointIndex = 0; pointIndex < FOREST_BEE_POINT_COUNT; pointIndex += 1) {
    const progress = pointIndex / (FOREST_BEE_POINT_COUNT - 1);
    const edgeSafe = pointIndex === 0 || pointIndex === FOREST_BEE_POINT_COUNT - 1;
    const x = sideStartX + ((endX - sideStartX) * progress) + (edgeSafe ? 0 : centered(random) * 22);
    const y = sideStartY + ((endY - sideStartY) * progress) + (edgeSafe ? 0 : centered(random) * 62);
    setPlanPoint(plan.points, pointIndex, x, clamp(y, 36, FOREST_FLIGHT_MAX_Y));
  }
  plan.phase = 'entry';
  plan.durationSeconds = FOREST_BEE_EDGE_SECONDS;
  plan.elapsedSeconds = 0;
  plan.onScreenSeconds = 0;
  plan.bouncePhase = sample(random) * TAU;
}

/** Build one immediately roaming bee per Unit, four middle-lane duplicates and four Forest Main bees. */
export function createJourneyForestBeeFlightPlans(
  random: () => number = Math.random,
): JourneyForestBeeFlightPlan[] {
  const gatePlanIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  return Array.from({ length: FOREST_BEE_COUNT }, (_, index) => {
    const unitIndex = index >= FOREST_UNIT_BEE_COUNT
      ? -1
      : index < FOREST_UNIT_LANE_CENTERS.length
        ? index
        : FOREST_UNIT_DUPLICATE_LANES[index - FOREST_UNIT_LANE_CENTERS.length];
    const gateOrdinal = gatePlanIndices.indexOf(index);
    const isGateRoute = gateOrdinal >= 0;
    const plan: JourneyForestBeeFlightPlan = {
      points: new Float32Array(FOREST_BEE_POINT_COUNT * 2),
      durationSeconds: FOREST_BEE_ROAM_SECONDS,
      elapsedSeconds: 0,
      onScreenSeconds: 0,
      bouncePhase: 0,
      width: 40,
      scale: FOREST_BEE_DEPTH_SCALES[index % FOREST_BEE_DEPTH_SCALES.length],
      gateRouteOrdinal: gateOrdinal,
      gateSide: gateOrdinal % 2 === 0 ? -1 : 1,
      // A golden-ratio spread distributes crossings across the complete
      // transparent space between both posts without forming visible rows.
      gatePassageFraction: 0.12 + ((((gateOrdinal * 0.61803398875) % 1)) * 0.76),
      edgeRoute: isGateRoute ? 'forest-gate' : 'side',
      phase: 'roam',
      unitIndex,
    };
    const initialProgress = 0.04 + ((index / FOREST_BEE_COUNT) * 0.82);
    resetRoamPlan(plan, index, random, undefined, undefined, initialProgress);
    return plan;
  });
}

/** Rightward headings use bee1/2/6; leftward and pure vertical use bee3/4/5/7. */
export function getJourneyForestBeeAssetForVelocity(
  velocityX: number,
  velocityY: number,
  fallback: ForestBeeAsset = 'bee1',
): ForestBeeAsset {
  const magnitude = Math.hypot(velocityX, velocityY);
  if (!Number.isFinite(magnitude) || magnitude < 0.01) return fallback;
  if (Math.abs(velocityX) < magnitude * 0.12) return velocityY < 0 ? 'bee5' : 'bee7';

  const steepness = Math.abs(velocityX) * 0.42;
  if (velocityX > 0) {
    if (velocityY < -steepness) return 'bee2';
    if (velocityY > steepness) return 'bee6';
    return 'bee1';
  }
  if (velocityY < -steepness) {
    return Math.abs(velocityY) > Math.abs(velocityX) * 1.35 ? 'bee5' : 'bee4';
  }
  if (velocityY > steepness) return 'bee7';
  return 'bee3';
}

/** Writes x, y, velocityX and velocityY into a reusable four-number sample. */
function sampleJourneyForestBeeFlight(
  plan: JourneyForestBeeFlightPlan,
  progress: number,
  output: Float32Array,
): void {
  const boundedProgress = clamp(progress, 0, 0.999999);
  const segmentCount = FOREST_BEE_POINT_COUNT - 1;
  const segmentPosition = boundedProgress * segmentCount;
  const segment = Math.min(segmentCount - 1, Math.floor(segmentPosition));
  const localT = segmentPosition - segment;
  const localT2 = localT * localT;
  const localT3 = localT2 * localT;
  const cyclic = plan.phase === 'roam';

  for (let axis = 0; axis < 2; axis += 1) {
    const typedAxis = axis as 0 | 1;
    const p0 = readPlanPoint(plan.points, segment - 1, typedAxis, cyclic);
    const p1 = readPlanPoint(plan.points, segment, typedAxis, cyclic);
    const p2 = readPlanPoint(plan.points, segment + 1, typedAxis, cyclic);
    const p3 = readPlanPoint(plan.points, segment + 2, typedAxis, cyclic);
    output[axis] = 0.5 * (
      (2 * p1)
      + ((-p0 + p2) * localT)
      + (((2 * p0) - (5 * p1) + (4 * p2) - p3) * localT2)
      + ((-p0 + (3 * p1) - (3 * p2) + p3) * localT3)
    );
    output[axis + 2] = 0.5 * (
      (-p0 + p2)
      + (2 * ((2 * p0) - (5 * p1) + (4 * p2) - p3) * localT)
      + (3 * (-p0 + (3 * p1) - (3 * p2) + p3) * localT2)
    ) * segmentCount;
  }

  const bounceAngle = (boundedProgress * TAU * 6) + plan.bouncePhase;
  const gatePassageCenter = plan.phase === 'exit' ? 0.36 : plan.phase === 'entry' ? 0.5 : -1;
  const gatePassageDistance = Math.abs(boundedProgress - gatePassageCenter);
  const bounceStrength = plan.edgeRoute === 'forest-gate' && gatePassageDistance < 0.16
    ? clamp((gatePassageDistance - 0.06) / 0.1, 0, 1)
    : 1;
  output[0] += Math.cos(bounceAngle * 0.7) * 6 * bounceStrength;
  output[1] += Math.sin(bounceAngle) * 14 * bounceStrength;
}

function setBeeDepth(bee: LiveBee, depth: ForestBeeDepth): void {
  if (bee.depth === depth) return;
  bee.depth = depth;
}

function setBeeAsset(bee: LiveBee, asset: ForestBeeAsset): void {
  if (bee.currentAsset === asset || !FOREST_BEE_ASSET_BY_ID.has(asset)) return;
  bee.previousAsset = bee.currentAsset;
  bee.currentAsset = asset;
  bee.assetBlendSeconds = bee.previousAsset ? 0 : FOREST_BEE_DIRECTION_FADE_SECONDS;
}

function updateBeeAssetCandidate(
  bee: LiveBee,
  candidate: ForestBeeAsset,
  deltaSeconds: number,
): void {
  if (candidate === bee.currentAsset) {
    bee.pendingAsset = null;
    bee.pendingAssetSeconds = 0;
    return;
  }
  if (candidate !== bee.pendingAsset) {
    bee.pendingAsset = candidate;
    bee.pendingAssetSeconds = 0;
    return;
  }
  bee.pendingAssetSeconds += deltaSeconds;
  if (bee.pendingAssetSeconds < FOREST_BEE_DIRECTION_STABILITY_SECONDS) return;
  setBeeAsset(bee, candidate);
  bee.pendingAsset = null;
  bee.pendingAssetSeconds = 0;
}

function drawBeeAsset(
  context: CanvasRenderingContext2D | null,
  image: HTMLImageElement | undefined,
  x: number,
  y: number,
  size: number,
  rotation: number,
  scaleX: number,
  scaleY: number,
  opacity: number,
  canvasTop: number,
): void {
  if (!context || !image?.complete || image.naturalWidth <= 0 || opacity <= 0) return;
  context.save();
  context.globalAlpha = opacity;
  context.translate(x + size / 2, y - canvasTop + size / 2);
  context.rotate((rotation * Math.PI) / 180);
  context.scale(scaleX, scaleY);
  context.drawImage(image, -size / 2, -size / 2, size, size);
  context.restore();
}

/** Eighteen reusable logical bees painted by the shared two-canvas runtime. */
export function startJourneyForestBeeOrbits(
  options: StartJourneyForestBeeOrbitsOptions,
): JourneyForestBeeOrbitController {
  const ticker = options.ticker || gsap.ticker;
  const random = options.random || Math.random;
  const runtimeProfile = options.runtimeProfile ?? resolveJourneyForestBeeRuntimeProfile();
  const assetImages = new Map<ForestBeeAsset, HTMLImageElement>();
  if (typeof Image !== 'undefined') FOREST_BEE_ASSETS.forEach((asset) => {
    const image = new Image();
    image.decoding = 'async';
    image.srcset = asset.srcset;
    image.src = asset.src;
    assetImages.set(asset.asset, image);
  });
  let gateGeometry = resolveForestGateGeometry(options);
  const refreshGateGeometry = (): ForestBeeGateGeometry => {
    gateGeometry = resolveForestGateGeometry(options);
    options.root.dataset.forestBeeGateGeometry = gateGeometry.source;
    options.root.dataset.forestBeeGateCenter = `${gateGeometry.centerX.toFixed(2)},${((gateGeometry.topY + gateGeometry.bottomY) / 2).toFixed(2)}`;
    return gateGeometry;
  };
  const allPlans = createJourneyForestBeeFlightPlans(random);
  // The mobile MVP keeps one roaming bee for every Unit before spending any
  // budget on duplicates. This preserves world readability at lower cost.
  const plans = runtimeProfile.maxBeeCount > 0
    ? allPlans
      .filter((plan) => plan.unitIndex >= 0)
      .filter((plan, index, unitPlans) => (
        unitPlans.findIndex((candidate) => candidate.unitIndex === plan.unitIndex) === index
      ))
      .slice(0, runtimeProfile.maxBeeCount)
    : allPlans;
  options.root.dataset.forestBeeGateGeometry = gateGeometry.source;
  options.root.dataset.forestBeeGateCenter = `${gateGeometry.centerX.toFixed(2)},${((gateGeometry.topY + gateGeometry.bottomY) / 2).toFixed(2)}`;
  let disposed = false;
  const viewportWidth = window.innerWidth || options.root.getBoundingClientRect().width || FOREST_DESIGN_WIDTH;
  const pxPerDesignUnit = viewportWidth / FOREST_DESIGN_WIDTH;
  const authoredHeight = Number.parseFloat(options.root.style.height || '');
  const sceneHeight = Math.max(
    Number.isFinite(authoredHeight) ? authoredHeight : 0,
    options.root.getBoundingClientRect().height || 0,
    options.contentTopPx + ((FOREST_FLIGHT_MAX_Y + 80) * pxPerDesignUnit),
  );
  const bees: LiveBee[] = plans.map((plan, index) => {
    const bee: LiveBee = {
      plan,
      sample: new Float32Array(4),
      currentAsset: null,
      previousAsset: null,
      assetBlendSeconds: FOREST_BEE_DIRECTION_FADE_SECONDS,
      pendingAsset: null,
      pendingAssetSeconds: 0,
      depth: null,
      rendered: false,
    };
    setBeeAsset(bee, index % 2 === 0 ? 'bee1' : 'bee3');
    setBeeDepth(bee, plan.edgeRoute === 'forest-gate'
      ? (plan.phase === 'entry' ? 'behind-forest-main' : 'front')
      : 'front');
    return bee;
  });

  const advanceCompletedFlight = (bee: LiveBee, index: number): void => {
    const endX = readPlanPoint(bee.plan.points, FOREST_BEE_POINT_COUNT - 1, 0);
    const endY = readPlanPoint(bee.plan.points, FOREST_BEE_POINT_COUNT - 1, 1);
    if (bee.plan.phase === 'roam') {
      if (bee.plan.onScreenSeconds >= FOREST_BEE_MIN_ONSCREEN_SECONDS) {
        resetExitPlan(bee.plan, random, refreshGateGeometry());
      } else {
        // Keep the same cyclic spline until the minimum visible lifetime is met.
        // Regenerating controls here would introduce a visible tangent break.
        bee.plan.elapsedSeconds = Math.max(0, bee.plan.elapsedSeconds - bee.plan.durationSeconds);
      }
      return;
    }
    if (bee.plan.phase === 'exit') {
      // Side-route bees always return in front. Only the authored Forest Main
      // doorway is allowed to use the behind canvas.
      if (bee.plan.edgeRoute !== 'forest-gate') {
        setBeeDepth(bee, 'front');
      }
      resetEntryPlan(bee.plan, random, refreshGateGeometry(), 0, endX, endY);
      return;
    }
    bee.plan.onScreenSeconds = 0;
    // Preserve the exact gate endpoint, tangent, and periodic motion phase so
    // an entry through the transparent PNG opening becomes one unbroken flight
    // into roam rather than a second animation/emitter starting at the door.
    const beforeEndX = readPlanPoint(bee.plan.points, FOREST_BEE_POINT_COUNT - 2, 0);
    const beforeEndY = readPlanPoint(bee.plan.points, FOREST_BEE_POINT_COUNT - 2, 1);
    setBeeDepth(bee, 'front');
    resetRoamPlan(bee.plan, index, random, endX, endY, 0, {
      tangentX: endX - beforeEndX,
      tangentY: endY - beforeEndY,
      bouncePhase: bee.plan.bouncePhase,
    });
  };

  const render = (frame: JourneyAmbientCanvasFrame): number => {
    let visibleCount = 0;
    bees.forEach((bee, index) => {
      bee.plan.elapsedSeconds += frame.deltaSeconds;
      if (bee.plan.elapsedSeconds < 0) {
        bee.rendered = false;
        return;
      }
      if (bee.plan.phase === 'roam') bee.plan.onScreenSeconds += frame.deltaSeconds;
      if (bee.plan.elapsedSeconds >= bee.plan.durationSeconds) advanceCompletedFlight(bee, index);

      const progress = bee.plan.elapsedSeconds / bee.plan.durationSeconds;
      sampleJourneyForestBeeFlight(bee.plan, progress, bee.sample);
      const asset = getJourneyForestBeeAssetForVelocity(
        bee.sample[2],
        bee.sample[3],
        bee.currentAsset || 'bee1',
      );
      const bounceWave = Math.sin((progress * TAU * 6) + bee.plan.bouncePhase);
      const rotation = Math.sin((progress * TAU * 7) + bee.plan.bouncePhase) * 7;
      const entryScale = bee.plan.edgeRoute === 'forest-gate' && bee.plan.phase === 'entry'
        ? 0.5 + (0.5 * clamp(progress / 0.5, 0, 1))
        : 1;
      const scaleX = bee.plan.scale * entryScale * (1 + (bounceWave * 0.045 * FOREST_BEE_BOUNCE_GAIN));
      const scaleY = bee.plan.scale * entryScale * (1 - (bounceWave * 0.035 * FOREST_BEE_BOUNCE_GAIN));

      if (bee.plan.edgeRoute === 'forest-gate') {
        const beeCenterX = bee.sample[0] + ((bee.plan.width * bee.plan.scale) / 2);
        const enteredOpening = bee.plan.gateSide === -1
          ? beeCenterX >= gateGeometry.passageLeftX
          : beeCenterX <= gateGeometry.passageRightX;
        const exitingOpening = bee.plan.gateSide === -1
          ? beeCenterX <= gateGeometry.passageRightX
          : beeCenterX >= gateGeometry.passageLeftX;
        // Depth remains logically current even while this bee is culled below
        // or above the physical viewport, so it cannot reappear on a stale
        // side of the Forest/card stacking contract.
        if (bee.plan.phase === 'entry' && enteredOpening) setBeeDepth(bee, 'front');
        if (bee.plan.phase === 'exit' && progress >= 0.3 && exitingOpening) {
          setBeeDepth(bee, 'behind-forest-main');
        }
      }

      updateBeeAssetCandidate(bee, asset, frame.deltaSeconds);
      bee.assetBlendSeconds = Math.min(
        FOREST_BEE_DIRECTION_FADE_SECONDS,
        bee.assetBlendSeconds + frame.deltaSeconds,
      );
      const size = bee.plan.width * pxPerDesignUnit;
      const x = bee.sample[0] * pxPerDesignUnit;
      const y = options.contentTopPx + (bee.sample[1] * pxPerDesignUnit);
      const paintedHeight = size * scaleY;
      bee.rendered = y + paintedHeight >= frame.viewportTop && y <= frame.viewportBottom;
      if (!bee.rendered) return;
      visibleCount += 1;
      const context = bee.depth === 'front' ? frame.front : frame.behind;
      const blend = clamp(bee.assetBlendSeconds / FOREST_BEE_DIRECTION_FADE_SECONDS, 0, 1);
      if (bee.previousAsset && blend < 1) {
        drawBeeAsset(
          context, assetImages.get(bee.previousAsset), x, y, size, rotation,
          scaleX, scaleY, 1 - blend, frame.viewportTop,
        );
      } else {
        bee.previousAsset = null;
      }
      if (bee.currentAsset) {
        drawBeeAsset(
          context, assetImages.get(bee.currentAsset), x, y, size, rotation,
          scaleX, scaleY, blend, frame.viewportTop,
        );
      }
    });
    return visibleCount;
  };

  const backgroundLayer = options.root.querySelector<HTMLElement>('.journey-bg-container');
  const runtime = startJourneyAmbientCanvasRuntime({
    root: options.root,
    scrollRoot: options.scrollRoot,
    ticker,
    sceneWidthPx: viewportWidth,
    sceneHeightPx: sceneHeight,
    layerLeftPx: -options.leftGutterPx,
    layerTopPx: 0,
    visibilityMarginPx: runtimeProfile.visibilityMarginPx,
    pixelRatioCap: runtimeProfile.pixelRatioCap,
    maxFramesPerSecond: runtimeProfile.maxFramesPerSecond,
    // Keep every bee above clouds. The behind canvas sits immediately before
    // the World background at the same z-index, so Forest/Main/Unit art can
    // still occlude a bee without any cloud ever painting over it.
    behindBefore: backgroundLayer,
    behindZIndex: 1,
    frontZIndex: 4,
    className: 'journey-forest-bee-canvas',
    observeVisibility: options.observeVisibility,
    render,
  });
  runtime.fadeIn(360);
  options.root.dataset.journeyForestBeeRenderer = 'canvas';

  const controller: JourneyForestBeeOrbitController = {
    setSuspended: (nextSuspended) => runtime.setSuspended(nextSuspended),
    fadeOutAndDispose: (durationMs) => runtime.fadeOut(durationMs, () => controller.dispose()),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      runtime.dispose();
      assetImages.forEach((image) => {
        image.onload = null;
        image.onerror = null;
      });
      delete options.root.dataset.forestBeeGateGeometry;
      delete options.root.dataset.forestBeeGateCenter;
      delete options.root.dataset.journeyForestBeeRenderer;
    },
    getSnapshot: () => {
      const runtimeSnapshot = runtime.getSnapshot();
      return {
        disposed,
        beeCount: disposed ? 0 : bees.length,
        mainBeeCount: disposed ? 0 : bees.filter((bee) => bee.plan.unitIndex === -1).length,
        imageLayerCount: 0,
        tickerCount: runtimeSnapshot.tickerCount,
        visibleBeeCount: runtimeSnapshot.visibleSpriteCount,
        gateBeeCount: disposed ? 0 : bees.filter((bee) => bee.plan.edgeRoute === 'forest-gate').length,
        gateEntryCount: disposed ? 0 : bees.filter((bee) => bee.plan.edgeRoute === 'forest-gate' && bee.plan.phase === 'entry').length,
        gateExitCount: disposed ? 0 : bees.filter((bee) => bee.plan.edgeRoute === 'forest-gate' && bee.plan.phase === 'exit').length,
        gateGeometrySource: gateGeometry.source,
        gateCenterX: gateGeometry.centerX,
        gateCenterY: (gateGeometry.topY + gateGeometry.bottomY) / 2,
        renderer: 'canvas' as const,
        canvasCount: runtimeSnapshot.canvasCount,
        domImageCount: 0,
        pixelRatio: runtimeSnapshot.pixelRatio,
        bitmapPixels: runtimeSnapshot.bitmapPixels,
        maxFramesPerSecond: runtimeSnapshot.maxFramesPerSecond,
        visibilityMarginPx: runtimeSnapshot.visibilityMarginPx,
      };
    },
  };
  return controller;
}
