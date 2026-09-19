import { isThermalWorkSuppressed } from '../utils/thermal-isolation.js';
import { Assets, Rectangle, Sprite, Texture } from 'pixi.js';
import { STATE } from './app-state.ts';
import { acquireAnimatedTimelinePhase, type AnimatedSvgPhaseLease } from './animated-svg-phase-scheduler.ts';
import { applyGameplayTextureFiltering } from './gameplay-texture-filtering.ts';
import { reloadPixiImageTexture } from '../utils/pixi-image-texture-health.ts';
import { MOBILE_RUNTIME_PROFILE } from './mobile-runtime-profile.ts';
import {
  mountAnimatedDiceAboveHud,
  releaseAnimatedDiceAboveHud,
  syncAnimatedDiceAboveHud,
} from './animated-dice-hud-foreground.ts';

export type SharedPixiSheetSpec = Readonly<{
  family: string;
  sheetUrl: string;
  atlasWidth: number;
  atlasHeight: number;
  cellWidth: number;
  cellHeight: number;
  columns: number;
  frameCount: number;
  cycleMs: number;
  activeDurationMs?: number;
  anchorX: number;
  anchorY: number;
  evictionDelayMs?: number;
  renderAboveHud?: boolean;
}>;

export type SharedPixiSheetController = {
  tile: any;
  base: any;
  host: any;
  sprite: Sprite | null;
  spec: SharedPixiSheetSpec;
  isEligible: (tile: any) => boolean;
  propertyKey: string;
  originalRenderable: boolean;
  animateDuringDrag: boolean;
  dragging: boolean;
  ready: boolean;
  running: boolean;
  disposed: boolean;
  elapsedMs: number;
  frameIndex: number;
  retryTimer: ReturnType<typeof setTimeout> | null;
  phaseLease: AnimatedSvgPhaseLease | null;
  onReady?: () => void;
  onFrame?: (controller: SharedPixiSheetController) => void;
  onDispose?: () => void;
};

type FamilyCache = {
  spec: SharedPixiSheetSpec;
  sheet: Texture | null;
  frames: Texture[] | null;
  loadPromise: Promise<Texture[]> | null;
  unloadPromise: Promise<void> | null;
  refs: number;
  evictionTimer: ReturnType<typeof setTimeout> | null;
  lastUsedAt: number;
  generation: number;
};

const DEFAULT_EVICTION_DELAY_MS = MOBILE_RUNTIME_PROFILE.isMobileDevice ? 8_000 : 30_000;
export const SHARED_PIXI_SHEET_IDLE_BUDGET_BYTES = (MOBILE_RUNTIME_PROFILE.isMobileDevice ? 24 : 48) * 1024 * 1024;
const caches = new Map<string, FamilyCache>();
const controllers = new Set<SharedPixiSheetController>();
let runtimeTicker: any = null;

function getTextureDimension(texture: any, axis: 'width' | 'height'): number {
  return Number(texture?.source?.[axis] || texture?.[axis] || texture?.orig?.[axis] || 0);
}

function getCache(spec: SharedPixiSheetSpec): FamilyCache {
  const existing = caches.get(spec.family);
  if (existing) {
    if (existing.spec.sheetUrl !== spec.sheetUrl) {
      throw new Error(`Pixi sheet family ${spec.family} cannot change assets at runtime.`);
    }
    return existing;
  }
  const cache: FamilyCache = {
    spec,
    sheet: null,
    frames: null,
    loadPromise: null,
    unloadPromise: null,
    refs: 0,
    evictionTimer: null,
    lastUsedAt: Date.now(),
    generation: 0,
  };
  caches.set(spec.family, cache);
  return cache;
}

function createFrames(cache: FamilyCache, sheet: Texture): Texture[] {
  const { spec } = cache;
  const width = getTextureDimension(sheet, 'width');
  const height = getTextureDimension(sheet, 'height');
  if (width !== spec.atlasWidth || height !== spec.atlasHeight) {
    throw new Error(
      `Unexpected ${spec.family} Pixi sheet size ${width}x${height}; expected ${spec.atlasWidth}x${spec.atlasHeight}`,
    );
  }
  // These atlases are evictable. Keep Pixi GC enabled and retain them only
  // while a live controller or the short post-use grace window owns them.
  if (sheet.source) sheet.source.autoGarbageCollect = true;
  applyGameplayTextureFiltering(sheet);
  return Array.from({ length: spec.frameCount }, (_, index) => new Texture({
    source: sheet.source,
    frame: new Rectangle(
      (index % spec.columns) * spec.cellWidth,
      Math.floor(index / spec.columns) * spec.cellHeight,
      spec.cellWidth,
      spec.cellHeight,
    ),
    label: `${spec.family}-frame-${index + 1}`,
  }));
}

async function unloadCache(cache: FamilyCache): Promise<void> {
  if (cache.refs > 0 || cache.unloadPromise) return cache.unloadPromise ?? Promise.resolve();
  if (!cache.frames && !cache.loadPromise && !cache.sheet) return;
  // Invalidate any slower load that was already awaiting this family. Without
  // this token, a late Assets.load resolution could repopulate an evicted cache.
  cache.generation += 1;
  const frames = cache.frames;
  cache.frames = null;
  cache.loadPromise = null;
  cache.sheet = null;
  frames?.forEach((frame) => {
    try { frame.source?.off?.('resize', frame.update, frame); } catch {}
    try { frame.destroy(false); } catch {}
  });
  cache.unloadPromise = Assets.unload(cache.spec.sheetUrl)
    .catch(() => undefined)
    .then(() => undefined)
    .finally(() => { cache.unloadPromise = null; });
  return cache.unloadPromise;
}

function decodedBytes(cache: FamilyCache): number {
  return cache.frames ? cache.spec.atlasWidth * cache.spec.atlasHeight * 4 : 0;
}

function enforceIdleBudget(protectedFamily?: string): void {
  let residentBytes = Array.from(caches.values()).reduce((total, cache) => total + decodedBytes(cache), 0);
  if (residentBytes <= SHARED_PIXI_SHEET_IDLE_BUDGET_BYTES) return;
  const candidates = Array.from(caches.values())
    .filter((cache) => cache.spec.family !== protectedFamily && cache.refs === 0 && cache.frames)
    .sort((first, second) => first.lastUsedAt - second.lastUsedAt);
  candidates.forEach((cache) => {
    if (residentBytes <= SHARED_PIXI_SHEET_IDLE_BUDGET_BYTES) return;
    residentBytes -= decodedBytes(cache);
    if (cache.evictionTimer !== null) clearTimeout(cache.evictionTimer);
    cache.evictionTimer = null;
    void unloadCache(cache);
  });
}

function scheduleEviction(cache: FamilyCache): void {
  if (cache.evictionTimer !== null) clearTimeout(cache.evictionTimer);
  cache.evictionTimer = setTimeout(() => {
    cache.evictionTimer = null;
    if (cache.refs === 0) void unloadCache(cache);
  }, cache.spec.evictionDelayMs ?? DEFAULT_EVICTION_DELAY_MS);
}

async function loadFrames(spec: SharedPixiSheetSpec): Promise<Texture[]> {
  const cache = getCache(spec);
  if (cache.evictionTimer !== null) {
    clearTimeout(cache.evictionTimer);
    cache.evictionTimer = null;
  }
  if (cache.frames) {
    cache.lastUsedAt = Date.now();
    if (cache.refs === 0) scheduleEviction(cache);
    return cache.frames;
  }
  if (cache.loadPromise) return cache.loadPromise;
  const pending = (async () => {
    if (cache.unloadPromise) await cache.unloadPromise;
    const generation = cache.generation;
    let sheet = (Assets.get(spec.sheetUrl) || null) as Texture | null;
    if (!sheet || sheet.destroyed || getTextureDimension(sheet, 'width') <= 1) {
      try {
        sheet = await Assets.load<Texture>(spec.sheetUrl);
      } catch {
        sheet = await reloadPixiImageTexture(spec.sheetUrl);
      }
    }
    if (cache.generation !== generation) {
      throw new Error(`${spec.family} Pixi sheet load was superseded`);
    }
    if (!sheet || sheet.destroyed) throw new Error(`${spec.family} Pixi sheet did not produce a live texture`);
    const frames = createFrames(cache, sheet);
    cache.sheet = sheet;
    cache.frames = frames;
    cache.lastUsedAt = Date.now();
    enforceIdleBudget(spec.family);
    if (cache.refs === 0) scheduleEviction(cache);
    return frames;
  })();
  let guarded: Promise<Texture[]>;
  guarded = pending.catch((error) => {
    if (cache.loadPromise === guarded) cache.loadPromise = null;
    throw error;
  });
  cache.loadPromise = guarded;
  return guarded;
}

function acquireFamily(spec: SharedPixiSheetSpec): void {
  const cache = getCache(spec);
  cache.refs += 1;
  cache.lastUsedAt = Date.now();
  if (cache.evictionTimer !== null) {
    clearTimeout(cache.evictionTimer);
    cache.evictionTimer = null;
  }
}

function releaseFamily(spec: SharedPixiSheetSpec): void {
  const cache = getCache(spec);
  cache.refs = Math.max(0, cache.refs - 1);
  cache.lastUsedAt = Date.now();
  if (cache.refs === 0 && (cache.frames || cache.loadPromise)) {
    scheduleEviction(cache);
    // Active families may legitimately exceed the idle budget. Enforce the
    // cap as soon as any family becomes evictable instead of retaining the
    // whole former board for the complete grace window.
    enforceIdleBudget();
  }
}

function isPixiBranchVisible(displayObject: any): boolean {
  for (let current = displayObject; current; current = current.parent) {
    if (current.destroyed || current.visible === false || current.renderable === false) return false;
    if (typeof current.alpha === 'number' && current.alpha <= 0.001) return false;
  }
  return true;
}

function getLiveTicker(): any {
  return STATE.app?.ticker
    || (globalThis as any)?.window?.CC?.getPixiApp?.()?.ticker
    || (globalThis as any)?.window?.__PIXI_APP__?.ticker
    || (globalThis as any)?.window?.app?.ticker
    || null;
}

function detachTicker(): void {
  if (!runtimeTicker) return;
  try { runtimeTicker.remove(updateAll); } catch {}
  runtimeTicker = null;
}

function ensureTicker(fallback?: any): void {
  const next = fallback?.add && fallback?.remove ? fallback : getLiveTicker();
  if (!next || runtimeTicker === next) return;
  detachTicker();
  runtimeTicker = next;
  runtimeTicker.add(updateAll);
}

function findTileTicker(tile: any): any {
  return tile?._ccPixiApp?.ticker || tile?.parent?._ccPixiApp?.ticker || getLiveTicker();
}

function dispose(controller: SharedPixiSheetController): void {
  if (controller.disposed) return;
  controller.disposed = true;
  controllers.delete(controller);
  if (controller.tile?.[controller.propertyKey] === controller) delete controller.tile[controller.propertyKey];
  controller.phaseLease?.release();
  controller.phaseLease = null;
  if (controller.retryTimer !== null) clearTimeout(controller.retryTimer);
  controller.retryTimer = null;
  if (controller.spec.renderAboveHud) releaseAnimatedDiceAboveHud(controller);
  if (controller.sprite) {
    try { controller.sprite.parent?.removeChild(controller.sprite); } catch {}
    try { controller.sprite.destroy({ texture: false, textureSource: false }); } catch {}
  }
  controller.sprite = null;
  if (controller.base && !controller.base.destroyed) controller.base.renderable = controller.originalRenderable;
  try { controller.onDispose?.(); } catch {}
  releaseFamily(controller.spec);
  if (controllers.size === 0) detachTicker();
}

function updateController(controller: SharedPixiSheetController, deltaMs: number): void {
  const { tile, base, host, sprite, spec } = controller;
  if (controller.disposed || tile?.destroyed || base?.destroyed || host?.destroyed || !controller.isEligible(tile)) {
    dispose(controller);
    return;
  }
  if (!sprite || sprite.destroyed || !controller.ready || !controller.running) {
    base.renderable = controller.originalRenderable;
    if (sprite) sprite.renderable = false;
    return;
  }
  controller.elapsedMs = (controller.elapsedMs + Math.max(0, deltaMs)) % spec.cycleMs;
  const visible = base.visible !== false
    && isPixiBranchVisible(host)
    && (controller.animateDuringDrag || !controller.dragging);
  sprite.visible = visible;
  sprite.renderable = visible;
  if (!visible) {
    base.renderable = controller.originalRenderable;
    return;
  }
  const activeDurationMs = spec.activeDurationMs ?? spec.cycleMs;
  const nextFrame = controller.elapsedMs >= activeDurationMs
    ? 0
    : Math.min(
    spec.frameCount - 1,
    Math.floor((controller.elapsedMs / activeDurationMs) * spec.frameCount),
    );
  if (nextFrame !== controller.frameIndex) {
    controller.frameIndex = nextFrame;
    sprite.texture = getCache(spec).frames?.[nextFrame] || sprite.texture;
  }
  sprite.alpha = typeof base.alpha === 'number' ? base.alpha : 1;
  sprite.tint = base.tint ?? 0xFFFFFF;
  base.renderable = false;
  if (spec.renderAboveHud) syncAnimatedDiceAboveHud(controller);
  try { controller.onFrame?.(controller); } catch {}
}

function updateAll(ticker?: any): void {
  if (isThermalWorkSuppressed('sheets')) return;
  const raw = Number(ticker?.elapsedMS);
  const deltaMs = Number.isFinite(raw) && raw >= 0 ? Math.min(100, raw) : 1000 / 60;
  Array.from(controllers).forEach((controller) => updateController(controller, deltaMs));
}

function mount(controller: SharedPixiSheetController, retry = 0): void {
  void loadFrames(controller.spec).then((frames) => {
    const { tile, base, host, spec } = controller;
    if (controller.disposed) return;
    if (tile.destroyed || base.destroyed || host.destroyed || !controller.isEligible(tile)) {
      dispose(controller);
      return;
    }
    const sprite = new Sprite(frames[0]);
    sprite.label = `${spec.family}-pixi`;
    sprite.eventMode = 'none';
    sprite.cursor = 'default';
    sprite.roundPixels = base.roundPixels === true;
    sprite.anchor.set(spec.anchorX / spec.cellWidth, spec.anchorY / spec.cellHeight);
    sprite.width = spec.cellWidth;
    sprite.height = spec.cellHeight;
    sprite.alpha = typeof base.alpha === 'number' ? base.alpha : 1;
    sprite.tint = base.tint ?? 0xFFFFFF;
    sprite.visible = false;
    sprite.renderable = false;
    sprite.zIndex = (Number(base.zIndex) || 0) + 0.01;
    host.sortableChildren = true;
    host.addChild(sprite);
    controller.sprite = sprite;
    if (spec.renderAboveHud) mountAnimatedDiceAboveHud(controller, sprite, host);
    controller.ready = true;
    ensureTicker(findTileTicker(tile));
    controller.phaseLease = acquireAnimatedTimelinePhase(spec.family, spec.cycleMs, [{
      start: () => {
        if (controller.disposed || !controller.ready) return;
        controller.running = true;
        controller.elapsedMs = 0;
        updateController(controller, 0);
        try { controller.onReady?.(); } catch {}
      },
    }]);
  }).catch(() => {
    if (controller.disposed) return;
    if (retry === 0) {
      controller.retryTimer = setTimeout(() => {
        controller.retryTimer = null;
        if (!controller.disposed) mount(controller, 1);
      }, 750);
      return;
    }
    dispose(controller);
  });
}

export function startSharedPixiSheetAnimation(options: {
  tile: any;
  spec: SharedPixiSheetSpec;
  isEligible: (tile: any) => boolean;
  propertyKey: string;
  animateDuringDrag: boolean;
  onReady?: () => void;
  onFrame?: (controller: SharedPixiSheetController) => void;
  onDispose?: () => void;
}): SharedPixiSheetController | null {
  const { tile, spec, isEligible, propertyKey } = options;
  if (!tile || tile.destroyed || !isEligible(tile)) {
    stopSharedPixiSheetAnimation(tile, propertyKey);
    return null;
  }
  const existing = tile[propertyKey] as SharedPixiSheetController | undefined;
  if (existing && !existing.disposed) {
    existing.dragging = false;
    ensureTicker(findTileTicker(tile));
    return existing;
  }
  const base = tile.base;
  const host = tile.rotG || tile;
  if (!base || base.destroyed || !host || host.destroyed) return null;
  const controller: SharedPixiSheetController = {
    tile,
    base,
    host,
    sprite: null,
    spec,
    isEligible,
    propertyKey,
    originalRenderable: base.renderable !== false,
    animateDuringDrag: options.animateDuringDrag,
    dragging: false,
    ready: false,
    running: false,
    disposed: false,
    elapsedMs: 0,
    frameIndex: 0,
    retryTimer: null,
    phaseLease: null,
    onReady: options.onReady,
    onFrame: options.onFrame,
    onDispose: options.onDispose,
  };
  acquireFamily(spec);
  controllers.add(controller);
  tile[propertyKey] = controller;
  mount(controller);
  return controller;
}

export function stopSharedPixiSheetAnimation(tile: any, propertyKey: string): void {
  const controller = tile?.[propertyKey] as SharedPixiSheetController | undefined;
  if (controller) dispose(controller);
}

export function setSharedPixiSheetAnimationDragging(
  tile: any,
  propertyKey: string,
  dragging: boolean,
): boolean {
  const controller = tile?.[propertyKey] as SharedPixiSheetController | undefined;
  if (!controller || controller.disposed || !controller.isEligible(tile)) return false;
  controller.dragging = dragging;
  updateController(controller, 0);
  return true;
}

// Resource-only lease for authored renderers whose timing differs from the
// generic sheet player. All atlases share the same residency budget.
export function acquireSharedPixiSheetResource(spec: SharedPixiSheetSpec) {
  acquireFamily(spec);
  let released = false;
  return {
    load: () => released
      ? Promise.reject(new Error(`${spec.family} resource lease was released`))
      : loadFrames(spec),
    release: () => {
      if (released) return;
      released = true;
      releaseFamily(spec);
    },
  };
}

/** Memory pressure must never destroy an atlas leased by a live renderer. */
export function releaseIdleSharedPixiSheets(): Promise<void> {
  const releases: Promise<void>[] = [];
  caches.forEach((cache) => {
    if (cache.refs > 0) return;
    if (cache.evictionTimer !== null) clearTimeout(cache.evictionTimer);
    cache.evictionTimer = null;
    releases.push(unloadCache(cache));
  });
  return Promise.all(releases).then(() => undefined);
}

export function getSharedPixiSheetCacheStats() {
  const values = Array.from(caches.values());
  return {
    retainedBytes: values.reduce((sum, cache) => sum + decodedBytes(cache), 0),
    idleBytes: values.reduce((sum, cache) => sum + (cache.refs === 0 ? decodedBytes(cache) : 0), 0),
    residentFamilies: values.filter((cache) => cache.frames !== null).length,
    activeRefs: values.reduce((sum, cache) => sum + cache.refs, 0),
    pendingLoads: values.filter((cache) => cache.loadPromise && !cache.frames).length,
    idleBudgetBytes: SHARED_PIXI_SHEET_IDLE_BUDGET_BYTES,
  };
}

export function preloadSharedPixiSheet(spec: SharedPixiSheetSpec): Promise<void> {
  return loadFrames(spec).then(() => undefined).catch(() => undefined);
}

export function destroySharedPixiSheetFamily(spec: SharedPixiSheetSpec): void {
  Array.from(controllers)
    .filter((controller) => controller.spec.family === spec.family)
    .forEach(dispose);
  const cache = getCache(spec);
  if (cache.evictionTimer !== null) clearTimeout(cache.evictionTimer);
  cache.evictionTimer = null;
  if (cache.refs === 0) void unloadCache(cache);
}

export function getSharedPixiSheetRuntimeStats(spec: SharedPixiSheetSpec) {
  const cache = getCache(spec);
  const familyControllers = Array.from(controllers).filter((controller) => controller.spec.family === spec.family);
  return {
    controllers: familyControllers.length,
    ready: familyControllers.filter((controller) => controller.ready).length,
    sourceTextures: cache.sheet && !cache.sheet.destroyed ? 1 : 0,
    frames: cache.frames?.length ?? 0,
    decodedBytes: decodedBytes(cache),
    refs: cache.refs,
    tickerAttached: runtimeTicker !== null,
    evictionScheduled: cache.evictionTimer !== null,
  };
}

export function resetSharedPixiSheetAnimationForTests(): void {
  Array.from(controllers).forEach(dispose);
  detachTicker();
  caches.forEach((cache) => {
    cache.generation += 1;
    if (cache.evictionTimer !== null) clearTimeout(cache.evictionTimer);
    cache.evictionTimer = null;
    cache.frames?.forEach((frame) => {
      try { frame.source?.off?.('resize', frame.update, frame); } catch {}
      try { frame.destroy(false); } catch {}
    });
    cache.frames = null;
    cache.sheet = null;
    cache.loadPromise = null;
    cache.refs = 0;
  });
  caches.clear();
}
