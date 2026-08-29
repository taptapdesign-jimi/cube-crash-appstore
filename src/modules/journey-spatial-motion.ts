import {
  MOBILE_RUNTIME_PROFILE,
  type MobileRuntimeProfile,
} from './mobile-runtime-profile.js';
import { areContinuousRuntimeDiagnosticsEnabled } from '../utils/runtime-diagnostics-policy.js';

type JourneySpatialSurface = 'homepage' | 'journey-hub' | 'journey-world' | 'journey-detail-modal' | 'arcade-stage-clear' | 'board-transition' | 'gameplay';

type SpatialTarget = {
  element: HTMLElement;
  xDepth: number;
  yDepth: number;
  hubWorldId?: JourneySpatialWorldId;
};

export type ModalSpatialTarget = {
  element: HTMLElement;
  xDepth: number;
  yDepth: number;
  rotateXDegrees?: number;
  rotateYDegrees?: number;
  zDepth?: number;
};

type ModalSpatialRegistration = {
  container: HTMLElement;
  targets: ModalSpatialTarget[];
};

type GameplaySpatialWrapper = {
  destroyed?: boolean;
  x?: number;
  y?: number;
  position?: {
    x?: number;
    y?: number;
    set?: (x: number, y: number) => void;
  };
};

type GameplaySpatialDepthPlan = {
  xDepth: number;
  yDepth: number;
};

type GameplaySpatialTargetSnapshot = {
  providerTileCount: number;
  tileTargetCount: number;
  hudTargetCount: number;
  decorTargetCount: number;
  targetCount: number;
};

export type GameplaySpatialTile = {
  destroyed?: boolean;
  visible?: boolean;
  alpha?: number;
  value?: number;
  special?: string;
  gridX?: number;
  gridY?: number;
  _ccSpatialG?: GameplaySpatialWrapper | null;
};

type MotionPermissionState = 'unknown' | 'granted' | 'denied';

type DeviceOrientationPermissionConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

export type JourneySpatialTilt = {
  x: number;
  y: number;
};

export type JourneySpatialWorldId = 1 | 2 | 3;

export type JourneySpatialDirectionMap = Record<JourneySpatialWorldId, JourneySpatialTilt>;

export const JOURNEY_SPATIAL_DEPTH = Object.freeze({
  homepageHero: Object.freeze({ x: 26, y: 20 }),
  homepageCta: Object.freeze({ x: 12, y: 9 }),
  // Cubes retain the stronger gameplay profile. Only the orange preload fill
  // owns this slightly deeper HUD parallax; its beige track remains stable.
  gameplayTile: Object.freeze({ x: 14.625, y: 21.96 }),
  gameplayHudPreload: Object.freeze({ x: 7.2, y: 6.3 }),
  hubWorld: Object.freeze({ x: 16.8, y: 16.8 }),
  hubCloud: Object.freeze({ x: -14.4, y: -14.4 }),
  worldMain: Object.freeze({ x: 17.6, y: 17.6 }),
  worldMainCloud: Object.freeze({ x: -16, y: -16 }),
  worldUnit: Object.freeze({
    island: Object.freeze({ x: 4.4, y: 4.4 }),
    card: Object.freeze({ x: 5.4, y: 5.4 }),
    prop: Object.freeze({ x: 6.2, y: 6.2 }),
    accent: Object.freeze({ x: 7.2, y: 7.2 }),
    cloud: Object.freeze({ x: -11.5, y: -11.5 }),
  }),
  boardTransition: Object.freeze({
    number: Object.freeze({ x: 18, y: 14 }),
    mountain: Object.freeze({ x: 18, y: 14 }),
    scene: Object.freeze({ x: 16, y: 12 }),
    cloud: Object.freeze({ x: -18, y: -14 }),
  }),
  arcadeStageClear: Object.freeze({
    title: Object.freeze({ x: 9, y: 7 }),
    subtitle: Object.freeze({ x: 6, y: 5 }),
    thumb: Object.freeze({ x: 12, y: 9 }),
    nextLabel: Object.freeze({ x: 7, y: 5 }),
    nextDigit: Object.freeze({ x: 14, y: 11 }),
  }),
});

// Single product-facing lever for every Journey menu scene. Keep layer ratios
// below relative: changing this value retunes Hub + Forest/Beach/Area 55 as one
// system without touching Homepage, gameplay cubes, preload HUD, or modals.
export const JOURNEY_SCENE_MOVEMENT_MASTER = 2.2;

const scaleJourneySceneGain = (baseGain: number): number => (
  Number((baseGain * JOURNEY_SCENE_MOVEMENT_MASTER).toFixed(3))
);

export const JOURNEY_SPATIAL_SURFACE_GAIN = Object.freeze({
  // Hub keeps its established 70% X ratio. Y is intentionally deeper so a
  // natural phone pitch reads clearly; both axes follow the one master lever.
  journeyHub: Object.freeze({
    x: scaleJourneySceneGain(0.7),
    y: scaleJourneySceneGain(0.875),
  }),
  journeyWorld: Object.freeze({
    x: scaleJourneySceneGain(0.82),
    y: scaleJourneySceneGain(0.82),
  }),
  journeyUnit: 1.35,
  hubCloudSeparation: 1.3,
  worldCloudSeparation: 1.3,
  gameplayJourneyBottomDecor: Object.freeze({ x: 0.6, y: 0.2 }),
  journeyDetailCard: 0.23,
  journeyDetailStat: 0.2,
  boardTransitionHill: 0.3,
});

export const JOURNEY_SPATIAL_SENSOR_RANGE = Object.freeze({
  horizontalDegrees: 14,
  verticalDegrees: 9,
});

// Low-level device response shared by the whole app. Journey product tuning
// belongs to JOURNEY_SCENE_MOVEMENT_MASTER so unrelated surfaces stay stable.
export const JOURNEY_SPATIAL_STRENGTH = 0.6;

const ORGANIC_DEPTH_SCALES = Object.freeze([0.82, 1.08, 0.93, 1.19, 0.87, 1.13, 0.98]);
const CLOUD_DEPTH_SCALES = Object.freeze([0.68, 1.24, 0.86, 1.38, 0.76, 1.16, 0.96]);
const HUB_CLOUD_DIRECTION_PATTERNS = Object.freeze([
  Object.freeze({ x: -1, y: 0.72 }),
  Object.freeze({ x: 0.84, y: -1 }),
  Object.freeze({ x: -0.68, y: -0.82 }),
  Object.freeze({ x: 1, y: 0.64 }),
  Object.freeze({ x: 0.72, y: 1 }),
  Object.freeze({ x: -0.9, y: 0.58 }),
  Object.freeze({ x: 0.62, y: -0.76 }),
]);
const WORLD_DIRECTION_PATTERNS = Object.freeze([
  Object.freeze({ x: 1, y: 0.78 }),
  Object.freeze({ x: -0.92, y: 1 }),
  Object.freeze({ x: 0.82, y: -1 }),
]);
const FOREST_UNIT_DIRECTION_PATTERNS = Object.freeze([
  Object.freeze({ x: 1, y: 0.84 }),
  Object.freeze({ x: -0.78, y: 1 }),
  Object.freeze({ x: 0.88, y: -0.82 }),
  Object.freeze({ x: -1, y: -0.74 }),
  Object.freeze({ x: 0.72, y: 1 }),
]);
const GAMEPLAY_TILE_DIRECTION_PATTERNS = Object.freeze([
  Object.freeze({ x: 1, y: 0.88 }),
  Object.freeze({ x: -0.9, y: 1 }),
  Object.freeze({ x: 0.84, y: -0.92 }),
  Object.freeze({ x: -1, y: -0.82 }),
  Object.freeze({ x: 0.76, y: 1 }),
  Object.freeze({ x: -0.8, y: 0.86 }),
]);

export function getJourneySpatialDepthScale(index: number): number {
  const normalizedIndex = Math.abs(Math.trunc(index)) % ORGANIC_DEPTH_SCALES.length;
  return ORGANIC_DEPTH_SCALES[normalizedIndex];
}

export function getJourneyCloudDepthScale(index: number): number {
  const normalizedIndex = Math.abs(Math.trunc(index)) % CLOUD_DEPTH_SCALES.length;
  return CLOUD_DEPTH_SCALES[normalizedIndex];
}

export function getJourneyHubCloudDirection(index: number, sessionOffset = 0): JourneySpatialTilt {
  const normalizedIndex = Math.abs(Math.trunc(index) + Math.trunc(sessionOffset))
    % HUB_CLOUD_DIRECTION_PATTERNS.length;
  const direction = HUB_CLOUD_DIRECTION_PATTERNS[normalizedIndex];
  return { x: direction.x, y: direction.y };
}

export function createJourneySpatialDirectionMap(randomValue = Math.random()): JourneySpatialDirectionMap {
  const normalizedRandom = Number.isFinite(randomValue)
    ? Math.max(0, Math.min(0.999999, randomValue))
    : 0;
  const rotation = Math.floor(normalizedRandom * WORLD_DIRECTION_PATTERNS.length);
  const directionFor = (worldIndex: number): JourneySpatialTilt => {
    const pattern = WORLD_DIRECTION_PATTERNS[(worldIndex + rotation) % WORLD_DIRECTION_PATTERNS.length];
    return { x: pattern.x, y: pattern.y };
  };
  return {
    1: directionFor(0),
    2: directionFor(1),
    3: directionFor(2),
  };
}

export function getForestUnitSpatialDirection(boardId: number): JourneySpatialTilt {
  return getJourneyUnitSpatialDirection(boardId, 1);
}

export function getJourneyUnitSpatialDirection(
  boardId: number,
  worldId: JourneySpatialWorldId,
): JourneySpatialTilt {
  const worldOffset = (worldId - 1) * 2;
  const normalizedIndex = Math.abs(Math.trunc(boardId) - 1 + worldOffset)
    % FOREST_UNIT_DIRECTION_PATTERNS.length;
  const direction = FOREST_UNIT_DIRECTION_PATTERNS[normalizedIndex];
  return { x: direction.x, y: direction.y };
}

export function getGameplayTileSpatialDirection(cellIndex: number, sessionOffset = 0): JourneySpatialTilt {
  const normalizedIndex = Math.abs(Math.trunc(cellIndex) + Math.trunc(sessionOffset))
    % GAMEPLAY_TILE_DIRECTION_PATTERNS.length;
  const direction = GAMEPLAY_TILE_DIRECTION_PATTERNS[normalizedIndex];
  return { x: direction.x, y: direction.y };
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export function mixJourneyHubTilt(tilt: JourneySpatialTilt): JourneySpatialTilt {
  return {
    x: tilt.x,
    // A little roll feeds the vertical axis so Hub worlds visibly travel in
    // both dimensions even during the user's natural one-handed tilt.
    y: clamp((tilt.y * 0.86) + (tilt.x * 0.34), -1, 1),
  };
}

export function createJourneyHubWorldTilt(
  worldId: JourneySpatialWorldId,
  tilt: JourneySpatialTilt,
  pathRotation = 0,
): JourneySpatialTilt {
  const rawMagnitude = Math.min(1, Math.hypot(tilt.x, tilt.y));
  // Suppress the radial cusp/noise around neutral without introducing another
  // hard dead-zone. Directional wander still reacts to gentle wrist motion.
  const magnitude = rawMagnitude * (0.74 + (rawMagnitude * 0.26));
  const inwardX = worldId === 2 ? -1 : 1;
  const pathIndex = ((worldId - 1 + Math.abs(Math.trunc(pathRotation))) % 3) + 1;
  const wander = pathIndex === 1
    ? { x: (tilt.x * 0.32) + (tilt.y * 0.22), y: (tilt.y * 0.62) - (tilt.x * 0.18) }
    : pathIndex === 2
      ? { x: (tilt.x * -0.25) + (tilt.y * 0.28), y: (tilt.y * 0.45) + (tilt.x * 0.30) }
      : { x: (tilt.x * 0.20) - (tilt.y * 0.34), y: (tilt.y * 0.58) + (tilt.x * 0.16) };

  return {
    // Most horizontal travel converges toward the screen centre. A smaller
    // per-World axis mix keeps all three paths visibly independent.
    x: clamp((inwardX * magnitude * 0.62) + (wander.x * 0.38), -1, 1),
    y: clamp(wander.y, -1, 1),
  };
}

const shortestAngleDelta = (value: number, baseline: number): number => {
  const delta = ((value - baseline + 540) % 360) - 180;
  return Number.isFinite(delta) ? delta : 0;
};

const applyDeadZone = (value: number, deadZone = 0.035): number => {
  const magnitude = Math.abs(value);
  if (magnitude <= deadZone) return 0;
  return Math.sign(value) * ((magnitude - deadZone) / (1 - deadZone));
};

/**
 * Journey scenes should react to relaxed wrist movement without increasing
 * their maximum travel. This ease-out response expands the low/mid sensor
 * range and converges back to exactly 1 at the existing clamp boundary.
 */
export function applyJourneySceneTiltResponse(tilt: JourneySpatialTilt): JourneySpatialTilt {
  const shapeAxis = (value: number): number => {
    const magnitude = clamp(Math.abs(value), 0, 1);
    const shaped = 1 - Math.pow(1 - magnitude, 1.8);
    return Math.sign(value) * shaped;
  };
  return {
    x: shapeAxis(tilt.x),
    y: shapeAxis(tilt.y),
  };
}

export function normalizeJourneySpatialTilt(
  beta: number,
  gamma: number,
  baselineBeta: number,
  baselineGamma: number,
): JourneySpatialTilt {
  const betaDelta = shortestAngleDelta(beta, baselineBeta);
  const gammaDelta = shortestAngleDelta(gamma, baselineGamma);

  return {
    x: applyDeadZone(clamp(gammaDelta / JOURNEY_SPATIAL_SENSOR_RANGE.horizontalDegrees, -1, 1)),
    y: applyDeadZone(clamp(betaDelta / JOURNEY_SPATIAL_SENSOR_RANGE.verticalDegrees, -1, 1)),
  };
}

const JOURNEY_WORLD_SENSOR_STEP = 0.008;

export function quantizeJourneyWorldTilt(tilt: JourneySpatialTilt): JourneySpatialTilt {
  const quantize = (value: number): number => (
    Number(clamp(
      Math.round(value / JOURNEY_WORLD_SENSOR_STEP) * JOURNEY_WORLD_SENSOR_STEP,
      -1,
      1,
    ).toFixed(3))
  );
  return { x: quantize(tilt.x), y: quantize(tilt.y) };
}

export function createJourneySpatialOffset(
  tilt: JourneySpatialTilt,
  xDepth: number,
  yDepth: number,
): JourneySpatialTilt {
  return {
    x: tilt.x * xDepth * JOURNEY_SPATIAL_STRENGTH,
    y: tilt.y * yDepth * JOURNEY_SPATIAL_STRENGTH,
  };
}

export class AppSpatialMotionController {
  private readonly worldDirections = createJourneySpatialDirectionMap();
  private readonly sessionDepthOffset = Math.floor(Math.random() * ORGANIC_DEPTH_SCALES.length);
  private readonly gameplayDirectionOffset = Math.floor(Math.random() * GAMEPLAY_TILE_DIRECTION_PATTERNS.length);
  private hubEntryDepthOffset = 0;
  private hubEntryCloudDirectionOffset = 0;
  private hubEntryWorldPathRotation = 0;
  private permissionState: MotionPermissionState = 'unknown';
  private permissionGestureCleanup: (() => void) | null = null;
  private activeSurface: JourneySpatialSurface | null = null;
  private targets: SpatialTarget[] = [];
  private modalTargets = new Map<symbol, ModalSpatialRegistration>();
  private baselineBeta: number | null = null;
  private baselineGamma: number | null = null;
  private targetTilt: JourneySpatialTilt = { x: 0, y: 0 };
  private currentTilt: JourneySpatialTilt = { x: 0, y: 0 };
  private frameId: number | null = null;
  private lastRenderAt: number | null = null;
  private listening = false;
  private suspended = false;
  private visibilityObserver: IntersectionObserver | null = null;
  private visibleElements = new Set<HTMLElement>();
  private originalWillChange = new Map<HTMLElement, string>();
  private gameplayTileProvider: (() => GameplaySpatialTile[]) | null = null;
  private gameplayHudProvider: (() => GameplaySpatialWrapper | null) | null = null;
  private gameplayJourneyDecorProvider: (() => HTMLElement | null) | null = null;
  private gameplayWrappers = new Set<GameplaySpatialWrapper>();
  private gameplayNextWrappers = new Set<GameplaySpatialWrapper>();
  private readonly gameplayDepthPlans = new Map<number, GameplaySpatialDepthPlan>();
  private gameplayHudWrapper: GameplaySpatialWrapper | null = null;
  private gameplayJourneyDecorElement: HTMLElement | null = null;
  private activationHoldReason: string | null = null;
  private pendingActivation: (() => void) | null = null;
  private profileFrameId: number | null = null;
  private orientationEvents = 0;
  private spatialRenderFrames = 0;
  private gameplayProviderReads = 0;
  private gameplayTilesScanned = 0;
  private gameplayTargetsApplied = 0;
  private gameplayPositionWrites = 0;
  private readonly profiledGameplayGyroStates = new Set<'on' | 'off'>();

  public constructor(
    private readonly runtimeProfile: MobileRuntimeProfile = MOBILE_RUNTIME_PROFILE,
  ) {}

  private readonly handleOrientation = (event: DeviceOrientationEvent): void => {
    if (!this.hasMotionDemand() || document.hidden) return;
    if (this.activeSurface === 'homepage' && !this.isHomepageVisible()) {
      if (this.baselineBeta != null || this.baselineGamma != null || this.currentTilt.x !== 0 || this.currentTilt.y !== 0) {
        this.targetTilt = { x: 0, y: 0 };
        this.currentTilt = { x: 0, y: 0 };
        this.applyCurrentTilt();
        this.resetBaseline();
      }
      return;
    }
    if (!Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
    this.orientationEvents += 1;

    const beta = event.beta as number;
    const gamma = event.gamma as number;
    if (this.baselineBeta == null || this.baselineGamma == null) {
      this.baselineBeta = beta;
      this.baselineGamma = gamma;
      return;
    }

    const normalizedTilt = normalizeJourneySpatialTilt(beta, gamma, this.baselineBeta, this.baselineGamma);
    const nextTilt = this.activeSurface === 'journey-world' || this.activeSurface === 'journey-hub'
      ? quantizeJourneyWorldTilt(normalizedTilt)
      : normalizedTilt;
    if (nextTilt.x === this.targetTilt.x && nextTilt.y === this.targetTilt.y) return;
    this.targetTilt = nextTilt;
    this.ensureFrame();
  };

  private readonly handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.targetTilt = { x: 0, y: 0 };
      this.currentTilt = { x: 0, y: 0 };
      this.applyCurrentTilt();
      this.cancelFrame();
      return;
    }
    this.resetBaseline();
  };

  public async requestPermissionFromGesture(): Promise<boolean> {
    if (!this.isEnabled() || this.prefersReducedMotion()) return false;
    if (this.permissionState === 'granted') return true;
    if (this.permissionState === 'denied') return false;

    this.disarmPermissionGesture();

    const OrientationEvent = window.DeviceOrientationEvent as DeviceOrientationPermissionConstructor | undefined;
    if (!OrientationEvent) {
      this.permissionState = 'denied';
      return false;
    }

    try {
      const decision = typeof OrientationEvent.requestPermission === 'function'
        ? await OrientationEvent.requestPermission()
        : 'granted';
      this.permissionState = decision === 'granted' ? 'granted' : 'denied';
    } catch {
      this.permissionState = 'denied';
    }

    this.persistNativePermissionDecision(this.permissionState === 'granted');

    if (this.permissionState === 'granted' && this.hasMotionDemand()) {
      this.startListening();
    }
    return this.permissionState === 'granted';
  }

  /**
   * iOS scopes DeviceOrientation permission to the current WKWebView document.
   * The saved 3D Motion preference survives a hard app exit, but the new page
   * must still re-request access from a fresh user activation. Re-arm that
   * session permission without replaying the educational launch modal.
   */
  public armPermissionFromNextGesture(): void {
    this.disarmPermissionGesture();
    if (!this.requiresPermissionGesture()) return;

    const handleGesture = (event: Event): void => {
      if (!event.isTrusted) return;
      this.disarmPermissionGesture();
      this.emitDiagnostic('session-permission-gesture');
      void this.requestPermissionFromGesture().then((granted) => {
        this.emitDiagnostic('session-permission-result', { granted });
      });
    };
    const listenerOptions: AddEventListenerOptions = { capture: true, passive: true };
    window.addEventListener('click', handleGesture, listenerOptions);
    window.addEventListener('keydown', handleGesture, listenerOptions);
    this.permissionGestureCleanup = () => {
      window.removeEventListener('click', handleGesture, true);
      window.removeEventListener('keydown', handleGesture, true);
      this.permissionGestureCleanup = null;
    };
    this.emitDiagnostic('session-permission-armed');
  }

  public isEnabled(): boolean {
    try {
      return (window as Window & { _settings?: { spatialMotionEnabled?: boolean } })._settings
        ?.spatialMotionEnabled !== false;
    } catch {
      return true;
    }
  }

  public setEnabled(enabled: boolean): void {
    if (!enabled) {
      this.disarmPermissionGesture();
      this.pendingActivation = null;
      this.clearModalTargets();
      this.deactivate();
    }
  }

  /**
   * Prevent sensor ownership from restarting while an app transition is still
   * composing its own transforms. Activation requests made during the hold are
   * coalesced so only the latest visible surface starts after the handoff.
   */
  public holdActivations(reason: string): void {
    this.activationHoldReason = reason;
    this.pendingActivation = null;
    this.deactivate();
    this.emitDiagnostic('activation-held', { reason });
  }

  public releaseActivations(reason: string): void {
    const heldReason = this.activationHoldReason;
    const pendingActivation = this.pendingActivation;
    this.activationHoldReason = null;
    this.pendingActivation = null;
    this.emitDiagnostic('activation-released', {
      reason,
      heldReason,
      hadPendingActivation: pendingActivation !== null,
    });
    pendingActivation?.();
  }

  /** End a transition hold without briefly activating a surface that is no longer visible. */
  public discardHeldActivations(reason: string): void {
    const heldReason = this.activationHoldReason;
    const hadPendingActivation = this.pendingActivation !== null;
    this.activationHoldReason = null;
    this.pendingActivation = null;
    this.emitDiagnostic('activation-discarded', {
      reason,
      heldReason,
      hadPendingActivation,
    });
  }

  /** Read-only, bounded physical-iPhone audit. It owns one temporary RAF and
   * reports once; it never changes motion state or surface ownership. */
  public profileFrameWindow(label: string, durationMs = 6000): void {
    if (!areContinuousRuntimeDiagnosticsEnabled()) return;
    this.startFrameWindow(label, durationMs);
  }

  private startFrameWindow(
    label: string,
    durationMs: number,
    readFinalDetail: (() => Record<string, unknown>) | null = null,
  ): boolean {
    if (this.profileFrameId !== null || typeof window.requestAnimationFrame !== 'function') return false;
    const startedAt = performance.now();
    let previousFrameAt = startedAt;
    let frameCount = 0;
    let totalFrameMs = 0;
    let worstFrameMs = 0;
    let over20 = 0;
    let over34 = 0;
    let over50 = 0;
    const orientationStart = this.orientationEvents;
    const spatialRenderStart = this.spatialRenderFrames;
    const gameplayProviderReadStart = this.gameplayProviderReads;
    const gameplayTilesScannedStart = this.gameplayTilesScanned;
    const gameplayTargetsAppliedStart = this.gameplayTargetsApplied;
    const gameplayPositionWritesStart = this.gameplayPositionWrites;

    const sample = (now: number): void => {
      const frameMs = now - previousFrameAt;
      previousFrameAt = now;
      if (frameCount > 0) {
        totalFrameMs += frameMs;
        worstFrameMs = Math.max(worstFrameMs, frameMs);
        if (frameMs > 20) over20 += 1;
        if (frameMs > 34) over34 += 1;
        if (frameMs > 50) over50 += 1;
      }
      frameCount += 1;
      if ((now - startedAt) < durationMs) {
        this.profileFrameId = window.requestAnimationFrame(sample);
        return;
      }
      this.profileFrameId = null;
      const measuredFrames = Math.max(0, frameCount - 1);
      let finalDetail: Record<string, unknown> = {};
      try {
        finalDetail = readFinalDetail?.() ?? {};
      } catch {
        finalDetail = { profileDetailUnavailable: true };
      }
      this.emitDiagnostic('frame-window', {
        label,
        durationMs: Math.round(now - startedAt),
        frameCount: measuredFrames,
        averageFrameMs: measuredFrames > 0
          ? Number((totalFrameMs / measuredFrames).toFixed(2))
          : 0,
        worstFrameMs: Math.round(worstFrameMs),
        over20,
        over34,
        over50,
        orientationEvents: this.orientationEvents - orientationStart,
        spatialRenderFrames: this.spatialRenderFrames - spatialRenderStart,
        gameplayProviderReads: this.gameplayProviderReads - gameplayProviderReadStart,
        gameplayTilesScanned: this.gameplayTilesScanned - gameplayTilesScannedStart,
        gameplayTargetsApplied: this.gameplayTargetsApplied - gameplayTargetsAppliedStart,
        gameplayPositionWrites: this.gameplayPositionWrites - gameplayPositionWritesStart,
        ...finalDetail,
      });
    };
    this.profileFrameId = window.requestAnimationFrame(sample);
    return true;
  }

  public requiresPermissionGesture(): boolean {
    if (!this.isEnabled() || this.prefersReducedMotion() || this.permissionState !== 'unknown') return false;
    const OrientationEvent = window.DeviceOrientationEvent as DeviceOrientationPermissionConstructor | undefined;
    return typeof OrientationEvent?.requestPermission === 'function';
  }

  public activateHomepage(container: HTMLElement, slideIndex: number): void {
    if (this.deferActivation(() => this.activateHomepage(container, slideIndex), 'homepage')) return;
    const activeSlide = container.querySelector<HTMLElement>(`.slider-slide[data-slide="${slideIndex}"]`)
      ?? container.querySelector<HTMLElement>('.slider-slide.active');
    if (!activeSlide) {
      this.deactivate();
      return;
    }

    const directionWorldId = this.asWorldId((Math.abs(Math.trunc(slideIndex)) % 3) + 1) ?? 1;
    const direction = this.worldDirections[directionWorldId];
    const targets: SpatialTarget[] = [];
    const addTarget = (element: HTMLElement | null, depth: JourneySpatialTilt): void => {
      if (!element) return;
      targets.push({
        element,
        xDepth: depth.x * direction.x,
        yDepth: depth.y * direction.y,
      });
    };

    addTarget(activeSlide.querySelector<HTMLElement>('.hero-image'), JOURNEY_SPATIAL_DEPTH.homepageHero);
    addTarget(activeSlide.querySelector<HTMLElement>('.slide-button'), JOURNEY_SPATIAL_DEPTH.homepageCta);

    if (this.matchesActiveTargets('homepage', targets)) return;
    if (this.activeSurface === 'homepage' && !this.suspended) {
      this.replaceHomepageTargets(targets, container);
      return;
    }
    this.activate('homepage', targets, container);
  }

  public activateJourneyHub(container: HTMLElement): void {
    if (this.deferActivation(() => this.activateJourneyHub(container), 'journey-hub')) return;
    if (!this.runtimeProfile.journeySpatialMotionEnabled) {
      this.deactivate();
      this.emitDiagnostic('surface-disabled', { surface: 'journey-hub', reason: 'mobile-mvp-thermal-profile' });
      return;
    }
    const isNewHubEntry = this.activeSurface !== 'journey-hub';
    if (isNewHubEntry) {
      this.hubEntryDepthOffset = Math.floor(Math.random() * ORGANIC_DEPTH_SCALES.length);
      this.hubEntryCloudDirectionOffset = Math.floor(Math.random() * HUB_CLOUD_DIRECTION_PATTERNS.length);
      this.hubEntryWorldPathRotation = Math.floor(Math.random() * WORLD_DIRECTION_PATTERNS.length);
      this.emitDiagnostic('hub-entry-profile', {
        depthOffset: this.hubEntryDepthOffset,
        cloudDirectionOffset: this.hubEntryCloudDirectionOffset,
        worldPathRotation: this.hubEntryWorldPathRotation,
      });
    }
    const targets: SpatialTarget[] = [];
    container.querySelectorAll<HTMLElement>('.journey-v700-world-card').forEach((worldCard, index) => {
      const image = worldCard.querySelector<HTMLElement>('.journey-v700-world-visual');
      if (!image) return;
      const worldId = this.asWorldId(Number(worldCard.dataset.worldId)) ?? this.asWorldId(index + 1);
      if (!worldId) return;
      const depthScale = getJourneySpatialDepthScale(index + 2 + this.hubEntryDepthOffset);
      const verticalDirection = this.worldDirections[worldId].y;
      targets.push({
        element: image,
        xDepth: JOURNEY_SPATIAL_DEPTH.hubWorld.x * depthScale,
        yDepth: JOURNEY_SPATIAL_DEPTH.hubWorld.y * depthScale * Math.abs(verticalDirection),
        hubWorldId: worldId,
      });
    });
    container.querySelectorAll<HTMLElement>('.journey-v700-hub-cloud').forEach((element, index) => {
      const worldId = this.asWorldId(Number(element.dataset.worldId)) ?? 1;
      const depthScale = getJourneyCloudDepthScale(index + (worldId * 2) + this.hubEntryDepthOffset)
        * JOURNEY_SPATIAL_SURFACE_GAIN.hubCloudSeparation;
      const direction = getJourneyHubCloudDirection(
        index + (worldId * 3),
        this.hubEntryCloudDirectionOffset,
      );
      targets.push({
        element,
        xDepth: Math.abs(JOURNEY_SPATIAL_DEPTH.hubCloud.x) * depthScale * direction.x,
        yDepth: Math.abs(JOURNEY_SPATIAL_DEPTH.hubCloud.y) * depthScale * direction.y,
      });
    });
    if (this.matchesActiveTargets('journey-hub', targets)) {
      this.emitDiagnostic('surface-activation-reused', {
        surface: 'journey-hub',
        targetCount: targets.length,
      });
      return;
    }
    this.activate('journey-hub', targets, container);
  }

  public activateJourneyWorld(container: HTMLElement, worldId: number): void {
    if (this.deferActivation(() => this.activateJourneyWorld(container, worldId), 'journey-world')) return;
    if (!this.runtimeProfile.journeySpatialMotionEnabled) {
      this.deactivate();
      this.emitDiagnostic('surface-disabled', { surface: 'journey-world', reason: 'mobile-mvp-thermal-profile' });
      return;
    }
    const spatialWorldId = this.asWorldId(worldId);
    const worldRange = worldId === 1 ? { start: 1, end: 10 } : worldId === 2
      ? { start: 11, end: 20 }
      : worldId === 3 ? { start: 21, end: 30 } : null;
    if (!worldRange || !spatialWorldId) {
      this.deactivate();
      return;
    }
    const mainAreaId = worldId === 1 ? 'forest-main' : worldId === 2 ? 'beach-main' : 'robo-main';
    const mainCloudClass = worldId === 1
      ? '.journey-forest-main-cloud'
      : worldId === 2 ? '.journey-beach-main-cloud' : '.journey-robo-main-cloud';
    const mainSelector = worldId === 1
      ? `.journey-forest-main-art[data-journey-area-id="${mainAreaId}"]:not(.journey-beach-main-art):not(.journey-robo-main-art)`
      : worldId === 2 ? '.journey-beach-main-art' : '.journey-robo-main-art';
    const worldMain = container.querySelector<HTMLElement>(mainSelector);
    const worldClouds = Array.from(
      container.querySelectorAll<HTMLElement>(mainCloudClass)
    ).filter((element) => element.style.display !== 'none');
    const targets: SpatialTarget[] = [];
    const registeredElements = new Set<HTMLElement>();
    const addTarget = (
      element: HTMLElement | null,
      depth: { x: number; y: number },
      scale = 1,
      layerDirection: JourneySpatialTilt = { x: 1, y: 1 },
    ): void => {
      if (
        !element ||
        element.style.display === 'none' ||
        registeredElements.has(element)
      ) return;
      registeredElements.add(element);
      const orientedDepth = this.orientDepth(spatialWorldId, depth);
      targets.push({
        element,
        xDepth: orientedDepth.x * scale * layerDirection.x,
        yDepth: orientedDepth.y * scale * layerDirection.y,
      });
    };

    addTarget(worldMain, JOURNEY_SPATIAL_DEPTH.worldMain, this.getSessionDepthScale(worldId + 1));
    worldClouds.forEach((element, index) => {
      addTarget(
        element,
        JOURNEY_SPATIAL_DEPTH.worldMainCloud,
        getJourneyCloudDepthScale(index + worldId + this.sessionDepthOffset)
          * JOURNEY_SPATIAL_SURFACE_GAIN.worldCloudSeparation,
      );
    });

    for (let boardId = worldRange.start; boardId <= worldRange.end; boardId += 1) {
      const unitDirection = getJourneyUnitSpatialDirection(boardId, spatialWorldId);
      const unitGain = JOURNEY_SPATIAL_SURFACE_GAIN.journeyUnit;
      addTarget(
        container.querySelector<HTMLElement>(`.journey-forest-island-${boardId}`),
        JOURNEY_SPATIAL_DEPTH.worldUnit.island,
        this.getSessionDepthScale(boardId + 1) * unitGain,
        unitDirection,
      );
      addTarget(
        container.querySelector<HTMLElement>(`.journey-forest-stump-${boardId}`),
        JOURNEY_SPATIAL_DEPTH.worldUnit.prop,
        this.getSessionDepthScale(boardId + 3) * unitGain,
        unitDirection,
      );

      const card = container.querySelector<HTMLElement>(
        `.journey-board-card[data-board-id="${boardId}"]`,
      );
      addTarget(
        card?.closest<HTMLElement>('.journey-board-card-wrapper') ?? null,
        JOURNEY_SPATIAL_DEPTH.worldUnit.card,
        this.getSessionDepthScale(boardId + 5) * unitGain,
        unitDirection,
      );
      addTarget(
        card?.querySelector<HTMLElement>(':scope > .journey-card-ribbon') ?? null,
        { x: 0.7, y: 0.7 },
        this.getSessionDepthScale(boardId + 7),
        unitDirection,
      );

      container.querySelectorAll<HTMLElement>(`.journey-forest-star-board-${boardId}`).forEach((element, index) => {
        addTarget(
          element,
          JOURNEY_SPATIAL_DEPTH.worldUnit.accent,
          this.getSessionDepthScale((boardId * 3) + index) * unitGain,
          unitDirection,
        );
      });
      container.querySelectorAll<HTMLElement>(`.journey-forest-cloud-board-${boardId}`).forEach((element, index) => {
        addTarget(
          element,
          JOURNEY_SPATIAL_DEPTH.worldUnit.cloud,
          this.getSessionDepthScale((boardId * 4) + index) * unitGain,
          unitDirection,
        );
      });
    }

    if (this.matchesActiveTargets('journey-world', targets)) {
      this.emitDiagnostic('surface-activation-reused', {
        surface: 'journey-world',
        targetCount: targets.length,
      });
      return;
    }
    this.activate('journey-world', targets, container);
  }

  public activateJourneyDetailModal(modal: HTMLElement, boardId: number): void {
    if (this.deferActivation(
      () => this.activateJourneyDetailModal(modal, boardId),
      'journey-detail-modal',
    )) return;
    if (!this.runtimeProfile.journeySpatialMotionEnabled) {
      this.deactivateJourneyDetailModal();
      this.emitDiagnostic('surface-disabled', { surface: 'journey-detail-modal', reason: 'mobile-mvp-thermal-profile' });
      return;
    }
    if (
      !modal.isConnected ||
      modal.hidden ||
      modal.style.display === 'none' ||
      modal.getAttribute('data-journey-board-id') !== String(boardId)
    ) {
      this.deactivate();
      return;
    }

    const targets: SpatialTarget[] = [];
    const stableBaseIndex = Math.max(1, Math.trunc(boardId)) * 5;
    const addTarget = (element: HTMLElement | null, stableIndex: number, gain: number): void => {
      if (!element) return;
      const direction = getGameplayTileSpatialDirection(stableIndex, this.gameplayDirectionOffset);
      const depthScale = this.getSessionDepthScale(stableIndex + 4) * gain;
      targets.push({
        element,
        xDepth: JOURNEY_SPATIAL_DEPTH.gameplayTile.x * depthScale * direction.x,
        yDepth: JOURNEY_SPATIAL_DEPTH.gameplayTile.y * depthScale * direction.y,
      });
    };

    addTarget(
      modal.querySelector<HTMLElement>('#detail-card-image'),
      stableBaseIndex,
      JOURNEY_SPATIAL_SURFACE_GAIN.journeyDetailCard,
    );
    modal.querySelectorAll<HTMLElement>('.detail-stats-list > .detail-stat-item').forEach((element, index) => {
      addTarget(
        element,
        stableBaseIndex + index + 1,
        JOURNEY_SPATIAL_SURFACE_GAIN.journeyDetailStat,
      );
    });

    if (this.matchesActiveTargets('journey-detail-modal', targets)) return;
    this.activate('journey-detail-modal', targets, modal);
  }

  public deactivateJourneyDetailModal(): void {
    if (this.activeSurface === 'journey-detail-modal') this.deactivate();
  }

  public activateArcadeStageClear(overlay: HTMLElement, clearedStage: number): void {
    if (this.deferActivation(
      () => this.activateArcadeStageClear(overlay, clearedStage),
      'arcade-stage-clear',
    )) return;
    if (!overlay.isConnected || overlay.style.display === 'none') {
      this.deactivate();
      return;
    }

    const targets: SpatialTarget[] = [];
    const stableBase = Math.max(1, Math.trunc(clearedStage)) * 19;
    const addTarget = (
      element: HTMLElement | null,
      depth: JourneySpatialTilt,
      stableIndex: number,
    ): void => {
      if (!element) return;
      const direction = getGameplayTileSpatialDirection(stableIndex, this.gameplayDirectionOffset);
      const depthScale = this.getSessionDepthScale(stableIndex + 3);
      targets.push({
        element,
        xDepth: depth.x * depthScale * direction.x,
        yDepth: depth.y * depthScale * direction.y,
      });
    };

    addTarget(
      overlay.querySelector<HTMLElement>('.cc-arcade-stage-title'),
      JOURNEY_SPATIAL_DEPTH.arcadeStageClear.title,
      stableBase,
    );
    addTarget(
      overlay.querySelector<HTMLElement>('.cc-arcade-stage-subtitle'),
      JOURNEY_SPATIAL_DEPTH.arcadeStageClear.subtitle,
      stableBase + 1,
    );
    addTarget(
      overlay.querySelector<HTMLElement>('.cc-arcade-stage-thumb-wrap'),
      JOURNEY_SPATIAL_DEPTH.arcadeStageClear.thumb,
      stableBase + 2,
    );
    addTarget(
      overlay.querySelector<HTMLElement>('.cc-arcade-next-label'),
      JOURNEY_SPATIAL_DEPTH.arcadeStageClear.nextLabel,
      stableBase + 3,
    );
    overlay.querySelectorAll<HTMLElement>('.cc-arcade-next-digit-wrap').forEach((element, index) => {
      addTarget(
        element,
        JOURNEY_SPATIAL_DEPTH.arcadeStageClear.nextDigit,
        stableBase + 4 + index,
      );
    });

    if (this.matchesActiveTargets('arcade-stage-clear', targets)) return;
    this.activate('arcade-stage-clear', targets, overlay);
  }

  public deactivateArcadeStageClear(): void {
    if (this.activeSurface === 'arcade-stage-clear') this.deactivate();
  }

  public activateBoardTransition(overlay: HTMLElement, boardNumber: number): void {
    if (this.deferActivation(
      () => this.activateBoardTransition(overlay, boardNumber),
      'board-transition',
    )) return;
    if (!overlay.isConnected || overlay.style.display === 'none') {
      this.deactivate();
      return;
    }

    const targets: SpatialTarget[] = [];
    const stableBase = Math.max(1, Math.trunc(boardNumber)) * 17;
    const addTarget = (
      element: HTMLElement | null,
      depth: JourneySpatialTilt,
      stableIndex: number,
      gain = 1,
    ): void => {
      if (!element) return;
      const direction = getGameplayTileSpatialDirection(stableIndex, this.gameplayDirectionOffset);
      const depthScale = this.getSessionDepthScale(stableIndex + 2) * gain;
      targets.push({
        element,
        xDepth: depth.x * depthScale * direction.x,
        yDepth: depth.y * depthScale * direction.y,
      });
    };

    overlay.querySelectorAll<HTMLElement>('.cc-board-transition-digit').forEach((element, index) => {
      addTarget(element, JOURNEY_SPATIAL_DEPTH.boardTransition.number, stableBase + index);
    });
    overlay.querySelectorAll<HTMLElement>('[data-scene-layer]').forEach((element, index) => {
      const layerKey = element.dataset.sceneLayer ?? '';
      const spatialRole = element.dataset.spatialRole ?? '';
      const isMountain = spatialRole === 'primary' || layerKey === 'mountain';
      const isHill = spatialRole === 'terrain' || layerKey === 'hill1' || layerKey === 'hill2';
      addTarget(
        element,
        isMountain
          ? JOURNEY_SPATIAL_DEPTH.boardTransition.mountain
          : JOURNEY_SPATIAL_DEPTH.boardTransition.scene,
        stableBase + 10 + index,
        isHill ? JOURNEY_SPATIAL_SURFACE_GAIN.boardTransitionHill : 1,
      );
    });
    overlay.querySelectorAll<HTMLElement>('.cc-board-transition-cloud').forEach((element, index) => {
      addTarget(element, JOURNEY_SPATIAL_DEPTH.boardTransition.cloud, stableBase + 40 + index);
    });

    if (this.matchesActiveTargets('board-transition', targets)) return;
    this.activate('board-transition', targets, overlay);
  }

  public deactivateBoardTransition(): void {
    if (this.activeSurface === 'board-transition') this.deactivate();
  }

  public activateGameplay(
    getTiles: () => GameplaySpatialTile[],
    getHudPreloadBar: (() => GameplaySpatialWrapper | null) | null = null,
    getJourneyBottomDecor: (() => HTMLElement | null) | null = null,
  ): void {
    if (this.deferActivation(
      () => this.activateGameplay(getTiles, getHudPreloadBar, getJourneyBottomDecor),
      'gameplay',
    )) return;
    const motionEnabled = this.isEnabled() && !this.prefersReducedMotion();
    this.profileGameplayActivation(
      motionEnabled,
      getTiles,
      getHudPreloadBar,
      getJourneyBottomDecor,
    );
    if (this.activeSurface === 'gameplay' && !this.suspended) {
      this.gameplayTileProvider = getTiles;
      this.gameplayHudProvider = getHudPreloadBar;
      this.gameplayJourneyDecorProvider = getJourneyBottomDecor;
      this.ensureFrame();
      this.emitDiagnostic('surface-activation-reused', {
        surface: 'gameplay',
        ...this.readGameplayTargetSnapshot(getTiles, getHudPreloadBar, getJourneyBottomDecor),
        listening: this.listening,
      });
      return;
    }

    this.deactivate();
    if (!motionEnabled) {
      this.emitDiagnostic('surface-disabled', {
        surface: 'gameplay',
        gyroState: 'off',
        ...this.readGameplayTargetSnapshot(getTiles, getHudPreloadBar, getJourneyBottomDecor),
      });
      return;
    }

    this.activeSurface = 'gameplay';
    this.gameplayTileProvider = getTiles;
    this.gameplayHudProvider = getHudPreloadBar;
    this.gameplayJourneyDecorProvider = getJourneyBottomDecor;
    this.suspended = false;
    this.resetBaseline();

    const OrientationEvent = window.DeviceOrientationEvent as DeviceOrientationPermissionConstructor | undefined;
    if (OrientationEvent && typeof OrientationEvent.requestPermission !== 'function') {
      this.permissionState = 'granted';
    }
    if (this.permissionState === 'granted') this.startListening();
    this.emitDiagnostic('surface-activated', {
      surface: 'gameplay',
      gyroState: 'on',
      ...this.readGameplayTargetSnapshot(getTiles, getHudPreloadBar, getJourneyBottomDecor),
      listening: this.listening,
    });
  }

  private profileGameplayActivation(
    motionEnabled: boolean,
    getTiles: () => GameplaySpatialTile[],
    getHudPreloadBar: (() => GameplaySpatialWrapper | null) | null,
    getJourneyBottomDecor: (() => HTMLElement | null) | null,
  ): void {
    const gyroState = motionEnabled ? 'on' : 'off';
    if (this.profiledGameplayGyroStates.has(gyroState) || !this.hasNativeConsoleBridge()) return;
    const started = this.startFrameWindow(
      `gameplay-gyro-${gyroState}`,
      6000,
      () => ({
        gyroState,
        spatialMaxFramesPerSecond: motionEnabled ? this.runtimeProfile.spatialMaxFramesPerSecond : 0,
        ...this.readGameplayTargetSnapshot(getTiles, getHudPreloadBar, getJourneyBottomDecor),
      }),
    );
    if (started) this.profiledGameplayGyroStates.add(gyroState);
  }

  private readGameplayTargetSnapshot(
    getTiles: (() => GameplaySpatialTile[]) | null = this.gameplayTileProvider,
    getHudPreloadBar: (() => GameplaySpatialWrapper | null) | null = this.gameplayHudProvider,
    getJourneyBottomDecor: (() => HTMLElement | null) | null = this.gameplayJourneyDecorProvider,
  ): GameplaySpatialTargetSnapshot {
    let liveTiles: GameplaySpatialTile[] = [];
    try {
      liveTiles = getTiles?.() ?? [];
    } catch {}
    let tileTargetCount = 0;
    liveTiles.forEach((tile) => {
      if (!tile || tile.destroyed || tile.visible === false || (tile.alpha ?? 1) <= 0.01) return;
      if ((tile.value ?? 0) <= 0 && !tile.special) return;
      if (!tile._ccSpatialG || tile._ccSpatialG.destroyed) return;
      tileTargetCount += 1;
    });
    let hudWrapper: GameplaySpatialWrapper | null = null;
    let journeyDecor: HTMLElement | null = null;
    try {
      hudWrapper = getHudPreloadBar?.() ?? null;
    } catch {}
    try {
      journeyDecor = getJourneyBottomDecor?.() ?? null;
    } catch {}
    const hudTargetCount = hudWrapper && !hudWrapper.destroyed ? 1 : 0;
    const decorTargetCount = journeyDecor?.isConnected && !journeyDecor.hidden ? 1 : 0;
    return {
      providerTileCount: liveTiles.length,
      tileTargetCount,
      hudTargetCount,
      decorTargetCount,
      targetCount: tileTargetCount + hudTargetCount + decorTargetCount,
    };
  }

  /**
   * Adds transform-isolated modal/card layers to the existing sensor stream.
   * The base scene keeps its owner and no second deviceorientation listener is
   * created. Call the returned disposer before the surface starts its exit.
   */
  public registerModalTargets(
    container: HTMLElement,
    targets: ModalSpatialTarget[],
  ): () => void {
    const key = Symbol('modal-spatial-targets');
    const liveTargets = targets.filter(({ element }) => element.isConnected && container.contains(element));
    if (
      !container.isConnected ||
      liveTargets.length === 0 ||
      !this.isEnabled() ||
      this.prefersReducedMotion()
    ) return () => undefined;

    const isFirstModalRegistration = this.modalTargets.size === 0;
    this.modalTargets.set(key, { container, targets: liveTargets });
    if (isFirstModalRegistration) {
      this.resetBaseline();
    }
    liveTargets.forEach(({ element }) => {
      element.classList.add('cc-modal-spatial-target');
    });
    this.emitDiagnostic('modal-targets-registered', {
      modalTargetCount: liveTargets.length,
      modalRegistrationCount: this.modalTargets.size,
      containerId: container.id || null,
    });

    const OrientationEvent = window.DeviceOrientationEvent as DeviceOrientationPermissionConstructor | undefined;
    if (OrientationEvent && typeof OrientationEvent.requestPermission !== 'function') {
      this.permissionState = 'granted';
    }
    if (this.permissionState === 'granted') this.startListening();
    this.ensureFrame();

    let disposed = false;
    return () => {
      if (disposed) return;
      disposed = true;
      const registration = this.modalTargets.get(key);
      this.modalTargets.delete(key);
      registration?.targets.forEach(({ element }) => this.resetModalTargetStyle(element));
      this.emitDiagnostic('modal-targets-disposed', {
        modalTargetCount: registration?.targets.length ?? 0,
        modalRegistrationCount: this.modalTargets.size,
        containerId: container.id || null,
      });
      if (!this.hasMotionDemand()) {
        this.stopListening();
        this.cancelFrame();
        this.targetTilt = { x: 0, y: 0 };
        this.currentTilt = { x: 0, y: 0 };
        this.resetBaseline();
      } else if (this.modalTargets.size === 0) {
        this.resetBaseline();
      }
    };
  }

  public suspend(): void {
    this.suspended = true;
    if (this.modalTargets.size === 0) {
      this.stopListening();
      this.cancelFrame();
    }
    this.stopVisibilityTracking();
    this.removeCompositorHints();
  }

  /** Resume the already-owned Journey World without resetting its live pose. */
  public resumeJourneyWorld(container: HTMLElement): void {
    if (
      this.activeSurface !== 'journey-world' ||
      !this.suspended ||
      !container.isConnected ||
      this.targets.length === 0
    ) return;
    this.suspended = false;
    this.resetBaseline();
    this.startVisibilityTracking(container);
    if (this.permissionState === 'granted') this.startListening();
    this.ensureFrame();
    this.emitDiagnostic('surface-resumed', {
      surface: 'journey-world',
      targetCount: this.targets.length,
    });
  }

  /** Resume the already-owned Journey Hub after an aborted World open. */
  public resumeJourneyHub(container: HTMLElement): void {
    if (
      this.activeSurface !== 'journey-hub' ||
      !this.suspended ||
      !container.isConnected ||
      this.targets.length === 0
    ) return;
    this.suspended = false;
    this.resetBaseline();
    this.startVisibilityTracking(container);
    if (this.permissionState === 'granted') this.startListening();
    this.ensureFrame();
    this.emitDiagnostic('surface-resumed', {
      surface: 'journey-hub',
      targetCount: this.targets.length,
    });
  }

  public suspendHomepage(): void {
    if (this.activeSurface === 'homepage') this.suspend();
  }

  public deactivateHomepage(): void {
    if (this.activeSurface === 'homepage') this.deactivate();
  }

  public deactivateGameplay(): void {
    if (this.activeSurface === 'gameplay') this.deactivate();
  }

  public deactivate(options: { reset?: boolean } = {}): void {
    const reset = options.reset !== false;
    if (this.modalTargets.size === 0) {
      this.stopListening();
      this.cancelFrame();
    }
    if (reset) this.resetTargetStyles();
    if (reset) this.resetGameplayStyles();
    this.targets = [];
    this.gameplayTileProvider = null;
    this.gameplayHudProvider = null;
    this.gameplayJourneyDecorProvider = null;
    this.pendingActivation = null;
    this.activeSurface = null;
    this.suspended = false;
    if (this.modalTargets.size === 0) {
      this.targetTilt = { x: 0, y: 0 };
      this.currentTilt = { x: 0, y: 0 };
      this.resetBaseline();
    }
    this.stopVisibilityTracking();
  }

  private activate(surface: JourneySpatialSurface, targets: SpatialTarget[], container: HTMLElement): void {
    this.deactivate();
    if (!this.isEnabled() || this.prefersReducedMotion() || targets.length === 0) return;

    this.activeSurface = surface;
    this.targets = targets.filter(({ element }) => document.body.contains(element));
    this.targets.forEach(({ element }) => {
      element.dataset.journeySpatialTarget = surface;
    });
    this.suspended = false;
    this.resetBaseline();
    this.startVisibilityTracking(container);

    const OrientationEvent = window.DeviceOrientationEvent as DeviceOrientationPermissionConstructor | undefined;
    if (OrientationEvent && typeof OrientationEvent.requestPermission !== 'function') {
      this.permissionState = 'granted';
    }
    if (this.permissionState === 'granted') this.startListening();
    this.emitDiagnostic('surface-activated', {
      surface,
      targetCount: this.targets.length,
      listening: this.listening,
    });
  }

  private replaceHomepageTargets(targets: SpatialTarget[], container: HTMLElement): void {
    const nextTargets = targets.filter(({ element }) => document.body.contains(element));
    if (nextTargets.length === 0) {
      this.deactivateHomepage();
      return;
    }

    this.targets.forEach(({ element }) => {
      element.style.removeProperty('translate');
      delete element.dataset.journeySpatialTarget;
      this.removeCompositorHint(element);
    });
    this.targets = nextTargets;
    this.targets.forEach(({ element }) => {
      element.dataset.journeySpatialTarget = 'homepage';
      if (this.listening) this.addCompositorHint(element);
    });
    this.startVisibilityTracking(container);
    this.ensureFrame();
    this.emitDiagnostic('surface-targets-replaced', {
      surface: 'homepage',
      targetCount: this.targets.length,
      listening: this.listening,
    });
  }

  private deferActivation(activation: () => void, surface: JourneySpatialSurface): boolean {
    if (!this.activationHoldReason) return false;
    this.pendingActivation = activation;
    this.emitDiagnostic('activation-deferred', {
      surface,
      heldReason: this.activationHoldReason,
    });
    return true;
  }

  private emitDiagnostic(event: string, detail: Record<string, unknown> = {}): void {
    try {
      const handler = (window as any).webkit?.messageHandlers?.consoleLog;
      if (!handler?.postMessage) return;
      handler.postMessage({
        level: 'info',
        message: `[CC_SPATIAL_PERF] ${event} ${JSON.stringify({
          at: Math.round(performance.now()),
          activeSurface: this.activeSurface,
          listening: this.listening,
          framePending: this.frameId !== null,
          activationHoldReason: this.activationHoldReason,
          ...detail,
        })}`,
      });
    } catch {}
  }

  private hasNativeConsoleBridge(): boolean {
    try {
      return typeof (window as any).webkit?.messageHandlers?.consoleLog?.postMessage === 'function';
    } catch {
      return false;
    }
  }

  private persistNativePermissionDecision(granted: boolean): void {
    try {
      const handler = (window as any).webkit?.messageHandlers?.motionPermissionResult;
      handler?.postMessage?.({ granted });
    } catch {}
  }

  private prefersReducedMotion(): boolean {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  }

  private isHomepageVisible(): boolean {
    const home = document.getElementById('home');
    if (!home || home.hidden || home.style.display === 'none') return false;
    const style = window.getComputedStyle(home);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  private matchesActiveTargets(surface: JourneySpatialSurface, targets: SpatialTarget[]): boolean {
    if (this.activeSurface !== surface || this.suspended || this.targets.length !== targets.length) return false;
    return targets.every((target, index) => {
      const activeTarget = this.targets[index];
      return activeTarget?.element === target.element
        && activeTarget.xDepth === target.xDepth
        && activeTarget.yDepth === target.yDepth
        && activeTarget.hubWorldId === target.hubWorldId;
    });
  }

  private asWorldId(value: number): JourneySpatialWorldId | null {
    return value === 1 || value === 2 || value === 3 ? value : null;
  }

  private getSessionDepthScale(index: number): number {
    return getJourneySpatialDepthScale(index + this.sessionDepthOffset);
  }

  private orientDepth(worldId: JourneySpatialWorldId, depth: JourneySpatialTilt): JourneySpatialTilt {
    const direction = this.worldDirections[worldId];
    const layerPolarity = depth.x < 0 ? -1 : 1;
    return {
      x: Math.abs(depth.x) * direction.x * layerPolarity,
      y: Math.abs(depth.y) * direction.y * layerPolarity,
    };
  }

  private startListening(): void {
    if (
      this.listening ||
      !this.hasMotionDemand() ||
      (this.suspended && this.modalTargets.size === 0) ||
      this.prefersReducedMotion()
    ) return;
    this.targets.forEach(({ element }) => {
      if (!this.visibilityObserver || this.visibleElements.has(element)) this.addCompositorHint(element);
    });
    window.addEventListener('deviceorientation', this.handleOrientation, { passive: true });
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.listening = true;
    this.emitDiagnostic('listener-started');
  }

  private stopListening(): void {
    if (!this.listening) return;
    window.removeEventListener('deviceorientation', this.handleOrientation);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.listening = false;
    this.emitDiagnostic('listener-stopped');
  }

  private disarmPermissionGesture(): void {
    this.permissionGestureCleanup?.();
  }

  private ensureFrame(): void {
    if (
      this.frameId != null ||
      !this.hasMotionDemand() ||
      (this.suspended && this.modalTargets.size === 0)
    ) return;
    this.frameId = window.requestAnimationFrame((now) => this.renderFrame(now));
  }

  private renderFrame(now: number): void {
    this.frameId = null;
    if (!this.hasMotionDemand() || document.hidden) return;
    const spatialMaxFramesPerSecond = this.runtimeProfile.spatialMaxFramesPerSecond;
    if (
      spatialMaxFramesPerSecond > 0
      && this.lastRenderAt !== null
      && (now - this.lastRenderAt) < ((1000 / spatialMaxFramesPerSecond) - 1)
    ) {
      this.ensureFrame();
      return;
    }
    this.spatialRenderFrames += 1;

    const isJourneyScene = this.activeSurface === 'journey-hub'
      || this.activeSurface === 'journey-world';
    const frameMs = this.lastRenderAt == null
      ? (1000 / 60)
      : clamp(now - this.lastRenderAt, 8, 34);
    this.lastRenderAt = now;
    // Time-based exponential smoothing is stable across 60/120Hz and isolated
    // iOS frame variation. Journey catches intention cleanly, then returns with
    // a slightly longer natural tail instead of following sensor noise.
    const responseMs = isJourneyScene ? 270 : 150;
    const smoothing = 1 - Math.exp(-frameMs / responseMs);
    this.currentTilt.x += (this.targetTilt.x - this.currentTilt.x) * smoothing;
    this.currentTilt.y += (this.targetTilt.y - this.currentTilt.y) * smoothing;
    this.applyCurrentTilt();

    const remainingDelta = Math.abs(this.targetTilt.x - this.currentTilt.x)
      + Math.abs(this.targetTilt.y - this.currentTilt.y);
    if (remainingDelta > 0.002) this.ensureFrame();
  }

  private applyCurrentTilt(): void {
    if (!this.suspended && this.activeSurface === 'gameplay') {
      this.applyGameplayTilt();
      this.applyModalTilt();
      return;
    }
    if (!this.suspended) {
      this.targets = this.targets.filter(({ element }) => document.body.contains(element));
    }
    const journeyResponsiveTilt = (
      this.activeSurface === 'journey-hub' || this.activeSurface === 'journey-world'
    )
      ? applyJourneySceneTiltResponse(this.currentTilt)
      : this.currentTilt;
    const activeTilt = this.activeSurface === 'journey-hub'
      ? mixJourneyHubTilt(journeyResponsiveTilt)
      : journeyResponsiveTilt;
    const surfaceGain = this.activeSurface === 'journey-hub'
      ? JOURNEY_SPATIAL_SURFACE_GAIN.journeyHub
      : this.activeSurface === 'journey-world'
        ? JOURNEY_SPATIAL_SURFACE_GAIN.journeyWorld
        : { x: 1, y: 1 };
    if (!this.suspended) this.targets.forEach(({ element, xDepth, yDepth, hubWorldId }) => {
      if (this.visibilityObserver && !this.visibleElements.has(element)) return;
      const targetTilt = this.activeSurface === 'journey-hub' && hubWorldId
        ? createJourneyHubWorldTilt(
          hubWorldId,
          journeyResponsiveTilt,
          this.hubEntryWorldPathRotation,
        )
        : activeTilt;
      const offset = createJourneySpatialOffset(
        targetTilt,
        xDepth * surfaceGain.x,
        yDepth * surfaceGain.y,
      );
      this.setStylePropertyIfChanged(
        element,
        'translate',
        `${offset.x.toFixed(2)}px ${offset.y.toFixed(2)}px`,
      );
    });
    this.applyModalTilt();
  }

  private applyModalTilt(): void {
    // Modal layers need the same relaxed-wrist response as the Journey scene.
    // Raw beta changes are much smaller than gamma in a natural portrait grip,
    // which otherwise makes pitch appear absent even while the sensor is live.
    const modalTilt = applyJourneySceneTiltResponse(this.currentTilt);
    this.modalTargets.forEach((registration, key) => {
      if (!registration.container.isConnected) {
        registration.targets.forEach(({ element }) => this.resetModalTargetStyle(element));
        this.modalTargets.delete(key);
        return;
      }
      registration.targets = registration.targets.filter(({ element }) => element.isConnected);
      if (registration.targets.length === 0) {
        this.modalTargets.delete(key);
        return;
      }
      registration.targets.forEach((target) => {
        const offset = createJourneySpatialOffset(modalTilt, target.xDepth, target.yDepth);
        const rotateX = -modalTilt.y * (target.rotateXDegrees ?? 0);
        const rotateY = modalTilt.x * (target.rotateYDegrees ?? 0);
        const z = Math.min(1, Math.hypot(modalTilt.x, modalTilt.y)) * (target.zDepth ?? 0);
        this.setStylePropertyIfChanged(
          target.element,
          'translate',
          `${offset.x.toFixed(2)}px ${offset.y.toFixed(2)}px`,
        );
        this.setStylePropertyIfChanged(target.element, '--cc-modal-gyro-rx', `${rotateX.toFixed(2)}deg`);
        this.setStylePropertyIfChanged(target.element, '--cc-modal-gyro-ry', `${rotateY.toFixed(2)}deg`);
        this.setStylePropertyIfChanged(target.element, '--cc-modal-gyro-z', `${z.toFixed(2)}px`);
      });
    });
    if (!this.hasMotionDemand()) {
      this.stopListening();
      this.targetTilt = { x: 0, y: 0 };
      this.currentTilt = { x: 0, y: 0 };
      this.resetBaseline();
    }
  }

  private resetModalTargetStyle(element: HTMLElement): void {
    element.style.removeProperty('translate');
    element.style.removeProperty('--cc-modal-gyro-rx');
    element.style.removeProperty('--cc-modal-gyro-ry');
    element.style.removeProperty('--cc-modal-gyro-z');
    element.classList.remove('cc-modal-spatial-target');
  }

  private clearModalTargets(): void {
    this.modalTargets.forEach(({ targets }) => {
      targets.forEach(({ element }) => this.resetModalTargetStyle(element));
    });
    this.modalTargets.clear();
  }

  private hasMotionDemand(): boolean {
    return this.modalTargets.size > 0 || (this.activeSurface !== null && !this.suspended);
  }

  private applyGameplayTilt(): void {
    const liveTiles = this.gameplayTileProvider?.() ?? [];
    this.gameplayProviderReads += 1;
    this.gameplayTilesScanned += liveTiles.length;
    const previousWrappers = this.gameplayWrappers;
    const activeWrappers = this.gameplayNextWrappers;
    activeWrappers.clear();
    liveTiles.forEach((tile, index) => {
      if (!tile || tile.destroyed || tile.visible === false || (tile.alpha ?? 1) <= 0.01) return;
      if ((tile.value ?? 0) <= 0 && !tile.special) return;
      const wrapper = tile._ccSpatialG;
      if (!wrapper || wrapper.destroyed) return;

      const depthIndex = Number.isFinite(tile.gridX) && Number.isFinite(tile.gridY)
        ? ((tile.gridY as number) * 7) + (tile.gridX as number)
        : index;
      const depthPlan = this.getGameplayDepthPlan(depthIndex);
      if (this.setGameplayWrapperPosition(
        wrapper,
        this.snapGameplayOffset(this.currentTilt.x * depthPlan.xDepth * JOURNEY_SPATIAL_STRENGTH),
        this.snapGameplayOffset(this.currentTilt.y * depthPlan.yDepth * JOURNEY_SPATIAL_STRENGTH),
      )) this.gameplayPositionWrites += 1;
      activeWrappers.add(wrapper);
      this.gameplayTargetsApplied += 1;
    });
    previousWrappers.forEach((wrapper) => {
      if (!activeWrappers.has(wrapper) && !wrapper.destroyed) {
        if (this.setGameplayWrapperPosition(wrapper, 0, 0)) this.gameplayPositionWrites += 1;
      }
    });
    this.gameplayWrappers = activeWrappers;
    this.gameplayNextWrappers = previousWrappers;

    const hudWrapper = this.gameplayHudProvider?.() ?? null;
    if (this.gameplayHudWrapper && this.gameplayHudWrapper !== hudWrapper && !this.gameplayHudWrapper.destroyed) {
      if (this.setGameplayWrapperPosition(this.gameplayHudWrapper, 0, 0)) this.gameplayPositionWrites += 1;
    }
    if (hudWrapper && !hudWrapper.destroyed) {
      if (this.setGameplayWrapperPosition(
        hudWrapper,
        this.snapGameplayOffset(
          this.currentTilt.x * JOURNEY_SPATIAL_DEPTH.gameplayHudPreload.x * JOURNEY_SPATIAL_STRENGTH,
        ),
        this.snapGameplayOffset(
          this.currentTilt.y * JOURNEY_SPATIAL_DEPTH.gameplayHudPreload.y * JOURNEY_SPATIAL_STRENGTH,
        ),
      )) this.gameplayPositionWrites += 1;
      this.gameplayHudWrapper = hudWrapper;
      this.gameplayTargetsApplied += 1;
    } else {
      this.gameplayHudWrapper = null;
    }

    const journeyDecor = this.gameplayJourneyDecorProvider?.() ?? null;
    if (this.gameplayJourneyDecorElement && this.gameplayJourneyDecorElement !== journeyDecor) {
      this.gameplayJourneyDecorElement.style.removeProperty('translate');
    }
    if (journeyDecor?.isConnected && !journeyDecor.hidden) {
      const decorGain = JOURNEY_SPATIAL_SURFACE_GAIN.gameplayJourneyBottomDecor;
      const x = this.snapGameplayOffset(
        this.currentTilt.x
          * JOURNEY_SPATIAL_DEPTH.gameplayTile.x
          * decorGain.x
          * JOURNEY_SPATIAL_STRENGTH,
      );
      const y = this.snapGameplayOffset(
        this.currentTilt.y
          * JOURNEY_SPATIAL_DEPTH.gameplayTile.y
          * decorGain.y
          * JOURNEY_SPATIAL_STRENGTH,
      );
      if (this.setStylePropertyIfChanged(
        journeyDecor,
        'translate',
        `${x.toFixed(2)}px ${y.toFixed(2)}px`,
      )) this.gameplayPositionWrites += 1;
      this.gameplayJourneyDecorElement = journeyDecor;
      this.gameplayTargetsApplied += 1;
    } else {
      if (this.gameplayJourneyDecorElement) {
        this.gameplayJourneyDecorElement.style.removeProperty('translate');
      }
      this.gameplayJourneyDecorElement = null;
    }
  }

  private startVisibilityTracking(container: HTMLElement): void {
    this.stopVisibilityTracking();
    if (typeof window.IntersectionObserver !== 'function') return;

    const scrollRoot = container.closest<HTMLElement>('.collectibles-scrollable');
    this.visibilityObserver = new IntersectionObserver((entries) => {
      let gainedVisibleTarget = false;
      entries.forEach((entry) => {
        const element = entry.target as HTMLElement;
        if (entry.isIntersecting) {
          this.visibleElements.add(element);
          if (this.listening) this.addCompositorHint(element);
          gainedVisibleTarget = true;
        } else {
          this.visibleElements.delete(element);
          this.removeCompositorHint(element);
        }
      });
      if (gainedVisibleTarget) this.ensureFrame();
    }, {
      root: scrollRoot,
      rootMargin: '160px 0px',
    });
    this.targets.forEach(({ element }) => this.visibilityObserver?.observe(element));
  }

  private stopVisibilityTracking(): void {
    this.visibilityObserver?.disconnect();
    this.visibilityObserver = null;
    this.visibleElements.clear();
  }

  private resetTargetStyles(): void {
    this.targets.forEach(({ element }) => {
      element.style.removeProperty('translate');
      delete element.dataset.journeySpatialTarget;
    });
    this.removeCompositorHints();
  }

  private resetGameplayStyles(): void {
    this.gameplayWrappers.forEach((wrapper) => {
      if (!wrapper || wrapper.destroyed) return;
      this.setGameplayWrapperPosition(wrapper, 0, 0);
    });
    this.gameplayWrappers.clear();
    this.gameplayNextWrappers.clear();
    if (this.gameplayHudWrapper && !this.gameplayHudWrapper.destroyed) {
      this.setGameplayWrapperPosition(this.gameplayHudWrapper, 0, 0);
    }
    this.gameplayHudWrapper = null;
    if (this.gameplayJourneyDecorElement) {
      this.gameplayJourneyDecorElement.style.removeProperty('translate');
    }
    this.gameplayJourneyDecorElement = null;
  }

  private snapGameplayOffset(value: number): number {
    // The physical iPhone renderer runs at 2x. Half-point snapping keeps
    // transparent cube edges aligned to device pixels during gyro movement.
    return Math.round(value * 2) / 2;
  }

  private getGameplayDepthPlan(depthIndex: number): GameplaySpatialDepthPlan {
    const cached = this.gameplayDepthPlans.get(depthIndex);
    if (cached) return cached;
    const depthScale = this.getSessionDepthScale(depthIndex + 4);
    const direction = getGameplayTileSpatialDirection(depthIndex, this.gameplayDirectionOffset);
    const plan = {
      xDepth: JOURNEY_SPATIAL_DEPTH.gameplayTile.x * depthScale * direction.x,
      yDepth: JOURNEY_SPATIAL_DEPTH.gameplayTile.y * depthScale * direction.y,
    };
    this.gameplayDepthPlans.set(depthIndex, plan);
    return plan;
  }

  private setGameplayWrapperPosition(wrapper: GameplaySpatialWrapper, x: number, y: number): boolean {
    const currentX = wrapper.position?.x ?? wrapper.x;
    const currentY = wrapper.position?.y ?? wrapper.y;
    if (currentX === x && currentY === y) return false;
    if (typeof wrapper.position?.set === 'function') {
      wrapper.position.set(x, y);
      return true;
    }
    if (wrapper.position) {
      wrapper.position.x = x;
      wrapper.position.y = y;
      return true;
    }
    wrapper.x = x;
    wrapper.y = y;
    return true;
  }

  private setStylePropertyIfChanged(element: HTMLElement, property: string, value: string): boolean {
    if (element.style.getPropertyValue(property) === value) return false;
    element.style.setProperty(property, value);
    return true;
  }

  private removeCompositorHints(): void {
    this.targets.forEach(({ element }) => this.removeCompositorHint(element));
    this.originalWillChange.clear();
  }

  private addCompositorHint(element: HTMLElement): void {
    if (!this.originalWillChange.has(element)) {
      this.originalWillChange.set(element, element.style.getPropertyValue('will-change'));
    }
    const values = element.style.getPropertyValue('will-change')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (!values.includes('translate')) values.push('translate');
    element.style.setProperty('will-change', values.join(', '));
  }

  private removeCompositorHint(element: HTMLElement): void {
    const original = this.originalWillChange.get(element);
    if (original == null) return;
    if (original) element.style.setProperty('will-change', original);
    else element.style.removeProperty('will-change');
    this.originalWillChange.delete(element);
  }

  private resetBaseline(): void {
    this.baselineBeta = null;
    this.baselineGamma = null;
    this.lastRenderAt = null;
  }

  private cancelFrame(): void {
    if (this.frameId != null) window.cancelAnimationFrame(this.frameId);
    this.frameId = null;
    this.lastRenderAt = null;
  }
}

// App-level owner. Keep the historical export while call sites migrate; both
// names intentionally reference the same controller, listener, and RAF loop.
export const appSpatialMotion = new AppSpatialMotionController();
export const journeySpatialMotion = appSpatialMotion;
