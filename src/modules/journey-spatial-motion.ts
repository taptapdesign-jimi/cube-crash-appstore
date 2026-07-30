type JourneySpatialSurface = 'homepage' | 'journey-hub' | 'journey-world' | 'gameplay';

type SpatialTarget = {
  element: HTMLElement;
  xDepth: number;
  yDepth: number;
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
  homepageHero: Object.freeze({ x: 14, y: 10 }),
  homepageCta: Object.freeze({ x: 6, y: 4.5 }),
  gameplayTile: Object.freeze({ x: 10, y: 10 }),
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
});

export const JOURNEY_SPATIAL_SENSOR_RANGE = Object.freeze({
  horizontalDegrees: 14,
  verticalDegrees: 9,
});

// One shared output gain keeps Hub, World, Unit, and cloud motion in the same family.
// Retune this value instead of weakening individual layers or surfaces independently.
export const JOURNEY_SPATIAL_STRENGTH = 0.6;

const ORGANIC_DEPTH_SCALES = Object.freeze([0.82, 1.08, 0.93, 1.19, 0.87, 1.13, 0.98]);
const WORLD_DIRECTION_PATTERNS = Object.freeze([
  Object.freeze({ x: 1, y: 0.78 }),
  Object.freeze({ x: -0.92, y: 1 }),
  Object.freeze({ x: 0.82, y: -1 }),
]);

export function getJourneySpatialDepthScale(index: number): number {
  const normalizedIndex = Math.abs(Math.trunc(index)) % ORGANIC_DEPTH_SCALES.length;
  return ORGANIC_DEPTH_SCALES[normalizedIndex];
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

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const shortestAngleDelta = (value: number, baseline: number): number => {
  const delta = ((value - baseline + 540) % 360) - 180;
  return Number.isFinite(delta) ? delta : 0;
};

const applyDeadZone = (value: number, deadZone = 0.055): number => {
  const magnitude = Math.abs(value);
  if (magnitude <= deadZone) return 0;
  return Math.sign(value) * ((magnitude - deadZone) / (1 - deadZone));
};

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

class JourneySpatialMotionController {
  private readonly worldDirections = createJourneySpatialDirectionMap();
  private readonly sessionDepthOffset = Math.floor(Math.random() * ORGANIC_DEPTH_SCALES.length);
  private permissionState: MotionPermissionState = 'unknown';
  private activeSurface: JourneySpatialSurface | null = null;
  private targets: SpatialTarget[] = [];
  private baselineBeta: number | null = null;
  private baselineGamma: number | null = null;
  private targetTilt: JourneySpatialTilt = { x: 0, y: 0 };
  private currentTilt: JourneySpatialTilt = { x: 0, y: 0 };
  private frameId: number | null = null;
  private listening = false;
  private suspended = false;
  private visibilityObserver: IntersectionObserver | null = null;
  private visibleElements = new Set<HTMLElement>();
  private originalWillChange = new Map<HTMLElement, string>();
  private gameplayTileProvider: (() => GameplaySpatialTile[]) | null = null;
  private gameplayWrappers = new Set<GameplaySpatialWrapper>();

  private readonly handleOrientation = (event: DeviceOrientationEvent): void => {
    if (!this.activeSurface || document.hidden) return;
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

    const beta = event.beta as number;
    const gamma = event.gamma as number;
    if (this.baselineBeta == null || this.baselineGamma == null) {
      this.baselineBeta = beta;
      this.baselineGamma = gamma;
      return;
    }

    this.targetTilt = normalizeJourneySpatialTilt(beta, gamma, this.baselineBeta, this.baselineGamma);
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

    if (this.permissionState === 'granted' && this.activeSurface && !this.suspended) {
      this.startListening();
    }
    return this.permissionState === 'granted';
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
    if (!enabled) this.deactivate();
  }

  public requiresPermissionGesture(): boolean {
    if (!this.isEnabled() || this.prefersReducedMotion() || this.permissionState !== 'unknown') return false;
    const OrientationEvent = window.DeviceOrientationEvent as DeviceOrientationPermissionConstructor | undefined;
    return typeof OrientationEvent?.requestPermission === 'function';
  }

  public activateHomepage(container: HTMLElement, slideIndex: number): void {
    const activeSlide = container.querySelector<HTMLElement>('.slider-slide.active')
      ?? container.querySelector<HTMLElement>(`.slider-slide[data-slide="${slideIndex}"]`);
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
    this.activate('homepage', targets, container);
  }

  public activateJourneyHub(container: HTMLElement): void {
    const targets: SpatialTarget[] = [];
    container.querySelectorAll<HTMLElement>('.journey-v700-world-card').forEach((worldCard, index) => {
      const image = worldCard.querySelector<HTMLElement>('.journey-v700-world-image');
      if (!image) return;
      const worldId = this.asWorldId(Number(worldCard.dataset.worldId)) ?? this.asWorldId(index + 1);
      if (!worldId) return;
      const depthScale = this.getSessionDepthScale(index + 2);
      const depth = this.orientDepth(worldId, JOURNEY_SPATIAL_DEPTH.hubWorld);
      targets.push({
        element: image,
        xDepth: depth.x * depthScale,
        yDepth: depth.y * depthScale,
      });
    });
    container.querySelectorAll<HTMLElement>('.journey-v700-hub-cloud').forEach((element, index) => {
      const worldId = this.asWorldId(Number(element.dataset.worldId)) ?? 1;
      const depthScale = this.getSessionDepthScale(index + (worldId * 2));
      const depth = this.orientDepth(worldId, JOURNEY_SPATIAL_DEPTH.hubCloud);
      targets.push({
        element,
        xDepth: depth.x * depthScale,
        yDepth: depth.y * depthScale,
      });
    });
    this.activate('journey-hub', targets, container);
  }

  public activateJourneyWorld(container: HTMLElement, worldId: number): void {
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
    const addTarget = (element: HTMLElement | null, depth: { x: number; y: number }, scale = 1): void => {
      if (!element || element.style.display === 'none') return;
      const orientedDepth = this.orientDepth(spatialWorldId, depth);
      targets.push({ element, xDepth: orientedDepth.x * scale, yDepth: orientedDepth.y * scale });
    };

    addTarget(worldMain, JOURNEY_SPATIAL_DEPTH.worldMain, this.getSessionDepthScale(worldId + 1));
    worldClouds.forEach((element, index) => {
      addTarget(element, JOURNEY_SPATIAL_DEPTH.worldMainCloud, this.getSessionDepthScale(index + worldId));
    });

    for (let boardId = worldRange.start; boardId <= worldRange.end; boardId += 1) {
      addTarget(
        container.querySelector<HTMLElement>(`.journey-forest-island-${boardId}`),
        JOURNEY_SPATIAL_DEPTH.worldUnit.island,
        this.getSessionDepthScale(boardId + 1),
      );
      addTarget(
        container.querySelector<HTMLElement>(`.journey-forest-stump-${boardId}`),
        JOURNEY_SPATIAL_DEPTH.worldUnit.prop,
        this.getSessionDepthScale(boardId + 3),
      );

      const card = container.querySelector<HTMLElement>(
        `.journey-board-card[data-board-id="${boardId}"]`,
      );
      addTarget(
        card?.closest<HTMLElement>('.journey-board-card-wrapper') ?? null,
        JOURNEY_SPATIAL_DEPTH.worldUnit.card,
        this.getSessionDepthScale(boardId + 5),
      );

      container.querySelectorAll<HTMLElement>(`.journey-forest-star-board-${boardId}`).forEach((element, index) => {
        addTarget(
          element,
          JOURNEY_SPATIAL_DEPTH.worldUnit.accent,
          this.getSessionDepthScale((boardId * 3) + index),
        );
      });
      container.querySelectorAll<HTMLElement>(`.journey-forest-cloud-board-${boardId}`).forEach((element, index) => {
        addTarget(
          element,
          JOURNEY_SPATIAL_DEPTH.worldUnit.cloud,
          this.getSessionDepthScale((boardId * 4) + index),
        );
      });
    }

    this.activate('journey-world', targets, container);
  }

  public activateGameplay(getTiles: () => GameplaySpatialTile[]): void {
    if (this.activeSurface === 'gameplay' && !this.suspended) {
      this.gameplayTileProvider = getTiles;
      this.ensureFrame();
      return;
    }

    this.deactivate();
    if (!this.isEnabled() || this.prefersReducedMotion()) return;

    this.activeSurface = 'gameplay';
    this.gameplayTileProvider = getTiles;
    this.suspended = false;
    this.resetBaseline();

    const OrientationEvent = window.DeviceOrientationEvent as DeviceOrientationPermissionConstructor | undefined;
    if (OrientationEvent && typeof OrientationEvent.requestPermission !== 'function') {
      this.permissionState = 'granted';
    }
    if (this.permissionState === 'granted') this.startListening();
  }

  public suspend(): void {
    this.suspended = true;
    this.stopListening();
    this.cancelFrame();
    this.stopVisibilityTracking();
    this.removeCompositorHints();
  }

  public deactivateHomepage(): void {
    if (this.activeSurface === 'homepage') this.deactivate();
  }

  public deactivateGameplay(): void {
    if (this.activeSurface === 'gameplay') this.deactivate();
  }

  public deactivate(options: { reset?: boolean } = {}): void {
    const reset = options.reset !== false;
    this.stopListening();
    this.cancelFrame();
    if (reset) this.resetTargetStyles();
    if (reset) this.resetGameplayStyles();
    this.targets = [];
    this.gameplayTileProvider = null;
    this.activeSurface = null;
    this.suspended = false;
    this.targetTilt = { x: 0, y: 0 };
    this.currentTilt = { x: 0, y: 0 };
    this.resetBaseline();
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
        && activeTarget.yDepth === target.yDepth;
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
    if (this.listening || this.suspended || !this.activeSurface || this.prefersReducedMotion()) return;
    this.targets.forEach(({ element }) => {
      if (!this.visibilityObserver || this.visibleElements.has(element)) this.addCompositorHint(element);
    });
    window.addEventListener('deviceorientation', this.handleOrientation, { passive: true });
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.listening = true;
  }

  private stopListening(): void {
    if (!this.listening) return;
    window.removeEventListener('deviceorientation', this.handleOrientation);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.listening = false;
  }

  private ensureFrame(): void {
    if (this.frameId != null || this.suspended || !this.activeSurface) return;
    this.frameId = window.requestAnimationFrame(() => this.renderFrame());
  }

  private renderFrame(): void {
    this.frameId = null;
    if (this.suspended || !this.activeSurface || document.hidden) return;

    const smoothing = 0.105;
    this.currentTilt.x += (this.targetTilt.x - this.currentTilt.x) * smoothing;
    this.currentTilt.y += (this.targetTilt.y - this.currentTilt.y) * smoothing;
    this.applyCurrentTilt();

    const remainingDelta = Math.abs(this.targetTilt.x - this.currentTilt.x)
      + Math.abs(this.targetTilt.y - this.currentTilt.y);
    if (remainingDelta > 0.002) this.ensureFrame();
  }

  private applyCurrentTilt(): void {
    if (this.activeSurface === 'gameplay') {
      this.applyGameplayTilt();
      return;
    }
    this.targets = this.targets.filter(({ element }) => document.body.contains(element));
    this.targets.forEach(({ element, xDepth, yDepth }) => {
      if (this.visibilityObserver && !this.visibleElements.has(element)) return;
      const offset = createJourneySpatialOffset(this.currentTilt, xDepth, yDepth);
      element.style.setProperty('translate', `${offset.x.toFixed(2)}px ${offset.y.toFixed(2)}px`);
    });
  }

  private applyGameplayTilt(): void {
    const liveTiles = this.gameplayTileProvider?.() ?? [];
    const activeWrappers = new Set<GameplaySpatialWrapper>();
    liveTiles.forEach((tile, index) => {
      if (!tile || tile.destroyed || tile.visible === false || (tile.alpha ?? 1) <= 0.01) return;
      if ((tile.value ?? 0) <= 0 && !tile.special) return;
      const wrapper = tile._ccSpatialG;
      if (!wrapper || wrapper.destroyed) return;

      const depthIndex = Number.isFinite(tile.gridX) && Number.isFinite(tile.gridY)
        ? ((tile.gridY as number) * 7) + (tile.gridX as number)
        : index;
      const depthScale = this.getSessionDepthScale(depthIndex + 4);
      const offset = createJourneySpatialOffset(
        this.currentTilt,
        JOURNEY_SPATIAL_DEPTH.gameplayTile.x * depthScale,
        JOURNEY_SPATIAL_DEPTH.gameplayTile.y * depthScale,
      );
      this.setGameplayWrapperPosition(wrapper, offset.x, offset.y);
      activeWrappers.add(wrapper);
    });
    this.gameplayWrappers.forEach((wrapper) => {
      if (!activeWrappers.has(wrapper) && !wrapper.destroyed) {
        this.setGameplayWrapperPosition(wrapper, 0, 0);
      }
    });
    this.gameplayWrappers = activeWrappers;
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
  }

  private setGameplayWrapperPosition(wrapper: GameplaySpatialWrapper, x: number, y: number): void {
    if (typeof wrapper.position?.set === 'function') {
      wrapper.position.set(x, y);
      return;
    }
    if (wrapper.position) {
      wrapper.position.x = x;
      wrapper.position.y = y;
      return;
    }
    wrapper.x = x;
    wrapper.y = y;
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
  }

  private cancelFrame(): void {
    if (this.frameId == null) return;
    window.cancelAnimationFrame(this.frameId);
    this.frameId = null;
  }
}

export const journeySpatialMotion = new JourneySpatialMotionController();
