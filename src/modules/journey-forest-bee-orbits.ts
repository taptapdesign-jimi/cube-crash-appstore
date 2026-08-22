import { gsap } from 'gsap';

const TAU = Math.PI * 2;
const FOREST_DESIGN_WIDTH = 390;
const FOREST_FLIGHT_MAX_Y = 1220;
const FOREST_BEE_COUNT = 19;
const FOREST_GATE_BEE_COUNT = 10;
const FOREST_BEE_POINT_COUNT = 8;
const FOREST_BEE_ROAM_SECONDS = 7.5;
const FOREST_BEE_EDGE_SECONDS = 5.5;
const FOREST_BEE_MIN_ONSCREEN_SECONDS = 30;
const FOREST_BEE_DIRECTION_FADE_MS = 80;
const FOREST_BEE_DIRECTION_STABILITY_SECONDS = 0.05;
const FOREST_BEE_ROAM_RANGE_MULTIPLIER = 1.5;
const FOREST_BEE_VISIBILITY_MARGIN_PX = 180;
const FOREST_BEE_DEPTH_SCALES = Object.freeze([0.65, 0.7, 0.8, 0.9, 1] as const);
const FOREST_BEE_ASSET_BASE = './assets/shop/honey';

type ForestBeeAsset = 'bee1' | 'bee2' | 'bee3' | 'bee4' | 'bee5' | 'bee6' | 'bee7';
type ForestBeeFlightPhase = 'roam' | 'exit' | 'entry';
type ForestBeeEdgeRoute = 'side' | 'forest-gate';
type ForestBeeDepth = 'front' | 'behind-card' | 'behind-unit' | 'behind-forest-main';

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
}

interface ForestBeeTicker {
  time: number;
  add(callback: () => void): void;
  remove(callback: () => void): void;
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
  ticker?: ForestBeeTicker;
  observeVisibility?: boolean;
}

export interface JourneyForestBeeOrbitController {
  dispose(): void;
  getSnapshot(): {
    disposed: boolean;
    beeCount: number;
    imageLayerCount: number;
    tickerCount: number;
    visibleBeeCount: number;
    gateBeeCount: number;
    gateEntryCount: number;
    gateExitCount: number;
    gateGeometrySource: 'dom' | 'fallback';
    gateCenterX: number;
    gateCenterY: number;
  };
}

interface LiveBee {
  element: HTMLDivElement;
  imageLayers: [HTMLImageElement, HTMLImageElement];
  activeImageLayer: 0 | 1;
  plan: JourneyForestBeeFlightPlan;
  sample: Float32Array;
  currentAsset: ForestBeeAsset | null;
  loadingAsset: ForestBeeAsset | null;
  assetLoadSequence: number;
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

function getLaneCenterY(index: number): number {
  return 126 + ((index % 7) * 164) + (index >= 7 ? 42 : 0);
}

function getUnitAnchorX(index: number, random: () => number): number {
  const unitIndex = index % 7;
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
  const laneCenterY = getLaneCenterY(index);
  const ownsVerticalSweep = index % 3 === 0;
  const anchorX = Number.isFinite(startX) ? Number(startX) : 56 + (sample(random) * 278);
  const anchorY = Number.isFinite(startY)
    ? Number(startY)
    : clamp(
      laneCenterY + (centered(random) * 82 * FOREST_BEE_ROAM_RANGE_MULTIPLIER),
      48,
      FOREST_FLIGHT_MAX_Y,
    );

  const tangentLength = continuity ? Math.hypot(continuity.tangentX, continuity.tangentY) : 0;
  const tangentX = tangentLength > 0.001 ? continuity!.tangentX / tangentLength : 0;
  const tangentY = tangentLength > 0.001 ? continuity!.tangentY / tangentLength : 0;
  const tangentDistance = 44 * FOREST_BEE_ROAM_RANGE_MULTIPLIER;

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
      ? Math.sin((pointIndex / (FOREST_BEE_POINT_COUNT - 1)) * TAU) * 108
      : centered(random) * 108;
    const verticalTexture = ownsVerticalSweep ? centered(random) * 24 : 0;
    const y = clamp(
      anchorY + ((verticalSweep + verticalTexture) * FOREST_BEE_ROAM_RANGE_MULTIPLIER),
      42,
      FOREST_FLIGHT_MAX_Y,
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
  index: number,
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
  const laneCenterY = getLaneCenterY(index);

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
  index: number,
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
    const entryEndX = getUnitAnchorX(index, random);
    const entryEndY = clamp(
      getLaneCenterY(index) + (centered(random) * 108 * 1.5),
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
    plan.durationSeconds = FOREST_BEE_EDGE_SECONDS * (0.84 + (sample(random) * 0.32));
    plan.elapsedSeconds = clamp(initialProgress, 0, 0.9) * plan.durationSeconds;
    plan.onScreenSeconds = 0;
    return;
  }
  const entersFromRight = sample(random) >= 0.5;
  const sideStartX = entersFromRight ? FOREST_DESIGN_WIDTH + 72 : -72;
  const endX = 58 + (sample(random) * 274);
  const laneCenterY = getLaneCenterY(index);
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

/** Build nineteen fixed-allocation plans: two or three persistent bees per Unit. */
export function createJourneyForestBeeFlightPlans(
  random: () => number = Math.random,
  gate: ForestBeeGateGeometry = FOREST_BEE_FALLBACK_GATE_GEOMETRY,
): JourneyForestBeeFlightPlan[] {
  return Array.from({ length: FOREST_BEE_COUNT }, (_, index) => {
    const gateOrdinal = index;
    const isGateRoute = gateOrdinal < FOREST_GATE_BEE_COUNT;
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
    };
    const initialProgress = 0.04 + ((index / FOREST_BEE_COUNT) * 0.82);
    resetRoamPlan(plan, index, random, undefined, undefined, initialProgress);
    if (plan.edgeRoute === 'forest-gate') {
      // Gate bees are scheduled one-by-one. Negative elapsed time is only an
      // initial hold; each fixed wrapper then flies its complete route once.
      resetEntryPlan(plan, index, random, gate, 0);
      plan.elapsedSeconds = -(gateOrdinal * 1.05);
    }
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
  if (bee.depth === depth && bee.element.dataset.forestBeeDepth) return;
  bee.depth = depth;
  bee.element.dataset.forestBeeDepth = depth;
  // These are three distinct compositing contracts: z0 is behind the complete
  // Forest PNG. The same root z0 deliberately lets lower-map Units occlude a
  // behind-unit bee, z2 remains below cards, and z4 is in front of both.
  bee.element.style.zIndex = depth === 'front' ? '4' : depth === 'behind-card' ? '2' : '0';
}

function chooseRoamDepth(index: number, random: () => number): ForestBeeDepth {
  const depthIndex = (index + Math.floor(sample(random) * 3)) % 3;
  if (depthIndex === 0) return 'front';
  if (depthIndex === 1) return 'behind-card';
  return 'behind-unit';
}

function setBeeAsset(bee: LiveBee, asset: ForestBeeAsset): void {
  if (bee.currentAsset === asset || bee.loadingAsset === asset) return;
  const source = FOREST_BEE_ASSET_BY_ID.get(asset);
  if (!source) return;

  if (bee.currentAsset === null) {
    const initialLayer = bee.imageLayers[bee.activeImageLayer];
    initialLayer.srcset = source.srcset;
    initialLayer.src = source.src;
    initialLayer.style.opacity = '1';
    bee.currentAsset = asset;
    bee.element.dataset.forestBeeAsset = asset;
  } else {
    const nextLayerIndex = (bee.activeImageLayer === 0 ? 1 : 0) as 0 | 1;
    const currentLayer = bee.imageLayers[bee.activeImageLayer];
    const nextLayer = bee.imageLayers[nextLayerIndex];
    const loadSequence = bee.assetLoadSequence + 1;
    bee.assetLoadSequence = loadSequence;
    bee.loadingAsset = asset;
    const promoteLoadedAsset = () => {
      if (bee.assetLoadSequence !== loadSequence || bee.loadingAsset !== asset) return;
      nextLayer.onload = null;
      nextLayer.onerror = null;
      nextLayer.style.opacity = '1';
      currentLayer.style.opacity = '0';
      bee.activeImageLayer = nextLayerIndex;
      bee.currentAsset = asset;
      bee.loadingAsset = null;
      bee.element.dataset.forestBeeAsset = asset;
    };
    nextLayer.onload = promoteLoadedAsset;
    nextLayer.onerror = () => {
      if (bee.assetLoadSequence === loadSequence) bee.loadingAsset = null;
    };
    // Keep the current painted sprite visible until this direction is decoded.
    nextLayer.style.opacity = '0';
    nextLayer.srcset = source.srcset;
    nextLayer.src = source.src;
    if (nextLayer.complete && nextLayer.naturalWidth > 0) promoteLoadedAsset();
  }
}

function updateBeeAssetCandidate(
  bee: LiveBee,
  candidate: ForestBeeAsset,
  deltaSeconds: number,
): void {
  if (candidate === bee.currentAsset || candidate === bee.loadingAsset) {
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

function createBeeImageLayer(): HTMLImageElement {
  const image = document.createElement('img');
  image.alt = '';
  image.draggable = false;
  image.decoding = 'async';
  image.setAttribute('aria-hidden', 'true');
  image.style.position = 'absolute';
  image.style.inset = '0';
  image.style.width = '100%';
  image.style.height = '100%';
  image.style.objectFit = 'contain';
  image.style.opacity = '0';
  image.style.pointerEvents = 'none';
  image.style.transition = `opacity ${FOREST_BEE_DIRECTION_FADE_MS}ms cubic-bezier(0.2, 0.7, 0.2, 1)`;
  return image;
}

/** One ticker, one observer and nineteen reusable logical bees for Forest only. */
export function startJourneyForestBeeOrbits(
  options: StartJourneyForestBeeOrbitsOptions,
): JourneyForestBeeOrbitController {
  const ticker = options.ticker || gsap.ticker;
  const random = options.random || Math.random;
  const assetPreloads = typeof Image === 'undefined' ? [] : FOREST_BEE_ASSETS.map((asset) => {
    const image = new Image();
    image.decoding = 'async';
    image.srcset = asset.srcset;
    image.src = asset.src;
    return image;
  });
  let gateGeometry = resolveForestGateGeometry(options);
  const refreshGateGeometry = (): ForestBeeGateGeometry => {
    gateGeometry = resolveForestGateGeometry(options);
    options.root.dataset.forestBeeGateGeometry = gateGeometry.source;
    options.root.dataset.forestBeeGateCenter = `${gateGeometry.centerX.toFixed(2)},${((gateGeometry.topY + gateGeometry.bottomY) / 2).toFixed(2)}`;
    return gateGeometry;
  };
  const plans = createJourneyForestBeeFlightPlans(random, gateGeometry);
  options.root.dataset.forestBeeGateGeometry = gateGeometry.source;
  options.root.dataset.forestBeeGateCenter = `${gateGeometry.centerX.toFixed(2)},${((gateGeometry.topY + gateGeometry.bottomY) / 2).toFixed(2)}`;
  let disposed = false;
  let tickerAttached = false;
  let sceneVisible = true;
  let lastTickTime = ticker.time;
  let visibilityObserver: IntersectionObserver | null = null;
  const scrollRoot = options.scrollRoot ?? null;
  const viewportWidth = window.innerWidth || options.root.getBoundingClientRect().width || FOREST_DESIGN_WIDTH;
  const pxPerDesignUnit = viewportWidth / FOREST_DESIGN_WIDTH;
  let rootContentTop = 0;
  let visibleTopScene = Number.NEGATIVE_INFINITY;
  let visibleBottomScene = Number.POSITIVE_INFINITY;

  const refreshVisibleBandGeometry = (): void => {
    if (!scrollRoot) return;
    const rootRect = options.root.getBoundingClientRect();
    const scrollRect = scrollRoot.getBoundingClientRect();
    rootContentTop = rootRect.top - scrollRect.top + scrollRoot.scrollTop;
  };
  const refreshVisibleBand = (): void => {
    if (!scrollRoot) return;
    const viewportTopPx = scrollRoot.scrollTop - rootContentTop - options.contentTopPx;
    visibleTopScene = (viewportTopPx - FOREST_BEE_VISIBILITY_MARGIN_PX) / pxPerDesignUnit;
    visibleBottomScene = (
      viewportTopPx + scrollRoot.clientHeight + FOREST_BEE_VISIBILITY_MARGIN_PX
    ) / pxPerDesignUnit;
  };
  refreshVisibleBandGeometry();
  refreshVisibleBand();

  const bees: LiveBee[] = plans.map((plan, index) => {
    const wrapper = document.createElement('div');
    wrapper.className = `journey-forest-bee-orbit journey-forest-bee-orbit-${index + 1}`;
    wrapper.setAttribute('aria-hidden', 'true');
    wrapper.dataset.forestBeeIndex = String(index + 1);
    wrapper.dataset.forestBeeScale = String(plan.scale);
    wrapper.dataset.forestBeeEdgeRoute = plan.edgeRoute;
    wrapper.dataset.forestBeePhase = plan.phase;
    wrapper.style.position = 'absolute';
    wrapper.style.left = `${-options.leftGutterPx}px`;
    wrapper.style.top = `${options.contentTopPx}px`;
    wrapper.style.width = `${(plan.width / FOREST_DESIGN_WIDTH) * 100}vw`;
    wrapper.style.aspectRatio = '1';
    wrapper.style.pointerEvents = 'none';
    wrapper.style.transformOrigin = '50% 50%';
    wrapper.style.backfaceVisibility = 'hidden';
    wrapper.style.willChange = 'transform';
    wrapper.style.visibility = 'hidden';
    const imageLayers: [HTMLImageElement, HTMLImageElement] = [createBeeImageLayer(), createBeeImageLayer()];
    wrapper.append(...imageLayers);
    options.root.appendChild(wrapper);

    const bee: LiveBee = {
      element: wrapper,
      imageLayers,
      activeImageLayer: 0,
      plan,
      sample: new Float32Array(4),
      currentAsset: null,
      loadingAsset: null,
      assetLoadSequence: 0,
      pendingAsset: null,
      pendingAssetSeconds: 0,
      depth: null,
      rendered: false,
    };
    setBeeAsset(bee, index % 2 === 0 ? 'bee1' : 'bee3');
    setBeeDepth(bee, plan.edgeRoute === 'forest-gate'
      ? (plan.phase === 'entry' ? 'behind-forest-main' : 'front')
      : chooseRoamDepth(index, random));
    return bee;
  });

  const advanceCompletedFlight = (bee: LiveBee, index: number): void => {
    const endX = readPlanPoint(bee.plan.points, FOREST_BEE_POINT_COUNT - 1, 0);
    const endY = readPlanPoint(bee.plan.points, FOREST_BEE_POINT_COUNT - 1, 1);
    if (bee.plan.phase === 'roam') {
      if (bee.plan.onScreenSeconds >= FOREST_BEE_MIN_ONSCREEN_SECONDS) {
        resetExitPlan(bee.plan, index, random, refreshGateGeometry());
        bee.element.dataset.forestBeePhase = bee.plan.phase;
      } else {
        // Keep the same cyclic spline until the minimum visible lifetime is met.
        // Regenerating controls here would introduce a visible tangent break.
        bee.plan.elapsedSeconds = Math.max(0, bee.plan.elapsedSeconds - bee.plan.durationSeconds);
      }
      return;
    }
    if (bee.plan.phase === 'exit') {
      // Change card depth only after the bee has completed its off-screen exit.
      // A visible bee must never pop behind a card halfway through its route.
      if (bee.plan.edgeRoute !== 'forest-gate') {
        setBeeDepth(bee, chooseRoamDepth(index, random));
      }
      resetEntryPlan(bee.plan, index, random, refreshGateGeometry(), 0, endX, endY);
      bee.element.dataset.forestBeePhase = bee.plan.phase;
      return;
    }
    bee.plan.onScreenSeconds = 0;
    // Preserve the exact gate endpoint, tangent, and periodic motion phase so
    // an entry through the transparent PNG opening becomes one unbroken flight
    // into roam rather than a second animation/emitter starting at the door.
    const beforeEndX = readPlanPoint(bee.plan.points, FOREST_BEE_POINT_COUNT - 2, 0);
    const beforeEndY = readPlanPoint(bee.plan.points, FOREST_BEE_POINT_COUNT - 2, 1);
    setBeeDepth(bee, chooseRoamDepth(index, random));
    resetRoamPlan(bee.plan, index, random, endX, endY, 0, {
      tangentX: endX - beforeEndX,
      tangentY: endY - beforeEndY,
      bouncePhase: bee.plan.bouncePhase,
    });
    bee.element.dataset.forestBeePhase = bee.plan.phase;
  };

  const tick = () => {
    if (disposed) return;
    const now = ticker.time;
    const deltaSeconds = clamp(now - lastTickTime, 0, 0.12);
    lastTickTime = now;
    if (!options.root.isConnected) {
      controller.dispose();
      return;
    }
    if (!sceneVisible || (typeof document !== 'undefined' && document.hidden)) return;
    refreshVisibleBand();

    bees.forEach((bee, index) => {
      bee.plan.elapsedSeconds += deltaSeconds;
      if (bee.plan.elapsedSeconds < 0) {
        if (bee.rendered) {
          bee.element.style.visibility = 'hidden';
          bee.element.style.willChange = 'auto';
          bee.rendered = false;
        }
        return;
      }
      if (bee.plan.phase === 'roam') bee.plan.onScreenSeconds += deltaSeconds;
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
      const scaleX = bee.plan.scale * entryScale * (1 + (bounceWave * 0.045));
      const scaleY = bee.plan.scale * entryScale * (1 - (bounceWave * 0.035));

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

      const beeHeightInScene = bee.plan.width * bee.plan.scale;
      const isNearViewport = bee.sample[1] + beeHeightInScene >= visibleTopScene
        && bee.sample[1] <= visibleBottomScene;
      if (!isNearViewport) {
        if (bee.rendered) {
          bee.element.style.visibility = 'hidden';
          bee.element.style.willChange = 'auto';
          bee.rendered = false;
        }
        return;
      }
      if (!bee.rendered) {
        bee.element.style.visibility = 'visible';
        bee.element.style.willChange = 'transform';
        bee.rendered = true;
      }

      updateBeeAssetCandidate(bee, asset, deltaSeconds);
      bee.element.style.transform = `translate3d(${(bee.sample[0] / FOREST_DESIGN_WIDTH) * 100}vw, ${(bee.sample[1] / FOREST_DESIGN_WIDTH) * 100}vw, 0) rotate(${rotation}deg) scaleX(${scaleX}) scaleY(${scaleY})`;
    });
  };

  const controller: JourneyForestBeeOrbitController = {
    dispose: () => {
      if (disposed) return;
      disposed = true;
      if (tickerAttached) {
        try { ticker.remove(tick); } catch {}
        tickerAttached = false;
      }
      if (visibilityObserver) {
        try { visibilityObserver.disconnect(); } catch {}
        visibilityObserver = null;
      }
      bees.forEach((bee) => {
        bee.imageLayers.forEach((image) => {
          image.onload = null;
          image.onerror = null;
        });
        bee.imageLayers.forEach((image) => image.style.transition = 'none');
        bee.element.style.willChange = 'auto';
        bee.element.remove();
      });
      assetPreloads.forEach((image) => {
        image.onload = null;
        image.onerror = null;
      });
      delete options.root.dataset.forestBeeGateGeometry;
      delete options.root.dataset.forestBeeGateCenter;
    },
    getSnapshot: () => ({
      disposed,
      beeCount: disposed ? 0 : bees.length,
      imageLayerCount: disposed ? 0 : bees.length * 2,
      tickerCount: tickerAttached ? 1 : 0,
      visibleBeeCount: disposed || !sceneVisible
        ? 0
        : bees.filter((bee) => bee.plan.elapsedSeconds >= 0).length,
      gateBeeCount: disposed ? 0 : bees.filter((bee) => bee.plan.edgeRoute === 'forest-gate').length,
      gateEntryCount: disposed ? 0 : bees.filter((bee) => bee.plan.edgeRoute === 'forest-gate' && bee.plan.phase === 'entry').length,
      gateExitCount: disposed ? 0 : bees.filter((bee) => bee.plan.edgeRoute === 'forest-gate' && bee.plan.phase === 'exit').length,
      gateGeometrySource: gateGeometry.source,
      gateCenterX: gateGeometry.centerX,
      gateCenterY: (gateGeometry.topY + gateGeometry.bottomY) / 2,
    }),
  };

  if (options.observeVisibility !== false && typeof IntersectionObserver !== 'undefined') {
    visibilityObserver = new IntersectionObserver((records) => {
      const rootRecord = records.find((record) => record.target === options.root);
      if (!rootRecord) return;
      sceneVisible = rootRecord.isIntersecting;
      lastTickTime = ticker.time;
      bees.forEach((bee) => {
        bee.element.style.willChange = sceneVisible && bee.rendered ? 'transform' : 'auto';
      });
    }, {
      root: options.scrollRoot || null,
      rootMargin: '180px 0px',
      threshold: 0,
    });
    visibilityObserver.observe(options.root);
  }

  ticker.add(tick);
  tickerAttached = true;
  tick();
  return controller;
}
