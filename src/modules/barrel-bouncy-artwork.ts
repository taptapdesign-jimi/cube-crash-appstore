import { Sprite, type Texture } from 'pixi.js';
import { STATE } from './app-state.ts';
import { getSpecialDiceVariantForTile } from './special-dice-registry.ts';
import { acquireAnimatedTimelinePhase, type AnimatedSvgPhaseLease } from './animated-svg-phase-scheduler.ts';
import { releaseAnimatedSpecialArtworkFamily } from './animated-special-artwork-mode.ts';
import { acquireSharedPixiSheetResource, destroySharedPixiSheetFamily, getSharedPixiSheetRuntimeStats, preloadSharedPixiSheet } from './shared-pixi-sheet-animation.ts';
import {
  mountAnimatedDiceAboveHud,
  releaseAnimatedDiceAboveHud,
  syncAnimatedDiceAboveHud,
} from './animated-dice-hud-foreground.ts';

// The authored SVG remains preserved as the source-of-truth animation asset.
// Runtime uses the pre-rendered sheet below so every live Barrel shares one
// decoded GPU source instead of creating one animated SVG document per tile.
export const BARREL_BOUNCY_SVG_URL = './assets/shop/barell/barell.svg';
export const BARREL_BOUNCY_SHEET_URL = './assets/shop/barell/barell-pixi-sheet.webp';
export const BARREL_BOUNCY_VIEWBOX = Object.freeze({ width: 270, height: 351 });
export const BARREL_BOUNCY_REST_ART = Object.freeze({ centerX: 135, centerY: 221, size: 194 });
export const BARREL_BOUNCY_DISPLAY_SIZE = 115.2;
export const BARREL_BOUNCY_CYCLE_MS = 821.428571;
export const BARREL_BOUNCY_ACTIVE_LOOPS = 2;
export const BARREL_BOUNCY_REST_MS = 1000;
export const BARREL_BOUNCY_SEQUENCE_MS = BARREL_BOUNCY_CYCLE_MS * BARREL_BOUNCY_ACTIVE_LOOPS
  + BARREL_BOUNCY_REST_MS;
export const BARREL_BOUNCY_FRAME_COUNT = 54;

const SHEET_COLUMNS = 9;
const SHEET_ROWS = 6;
const DISPLAY_SCALE = BARREL_BOUNCY_DISPLAY_SIZE / BARREL_BOUNCY_REST_ART.size;
const DISPLAY_WIDTH = BARREL_BOUNCY_VIEWBOX.width * DISPLAY_SCALE;
const DISPLAY_HEIGHT = BARREL_BOUNCY_VIEWBOX.height * DISPLAY_SCALE;
const DISPLAY_ANCHOR_X = BARREL_BOUNCY_REST_ART.centerX / BARREL_BOUNCY_VIEWBOX.width;
const DISPLAY_ANCHOR_Y = BARREL_BOUNCY_REST_ART.centerY / BARREL_BOUNCY_VIEWBOX.height;

const BARREL_SHEET_SPEC = Object.freeze({
  family: 'barrel-bouncy', sheetUrl: BARREL_BOUNCY_SHEET_URL,
  atlasWidth: BARREL_BOUNCY_VIEWBOX.width * SHEET_COLUMNS,
  atlasHeight: BARREL_BOUNCY_VIEWBOX.height * SHEET_ROWS,
  cellWidth: BARREL_BOUNCY_VIEWBOX.width, cellHeight: BARREL_BOUNCY_VIEWBOX.height,
  columns: SHEET_COLUMNS, frameCount: BARREL_BOUNCY_FRAME_COUNT,
  cycleMs: BARREL_BOUNCY_SEQUENCE_MS,
  anchorX: BARREL_BOUNCY_REST_ART.centerX, anchorY: BARREL_BOUNCY_REST_ART.centerY,
});

type BarrelController = {
  tile: any;
  base: any;
  host: any;
  sprite: Sprite | null;
  frames: Texture[] | null;
  resource: ReturnType<typeof acquireSharedPixiSheetResource>;
  originalRenderable: boolean;
  dragging: boolean;
  ready: boolean;
  running: boolean;
  resting: boolean;
  disposed: boolean;
  elapsedMs: number;
  frameIndex: number;
  phaseLease: AnimatedSvgPhaseLease | null;
  retryTimer: ReturnType<typeof setTimeout> | null;
};

const controllers = new Map<any, BarrelController>();
let runtimeTicker: any = null;

export function isBarrelBouncyTile(tile: any): boolean {
  return !!tile && getSpecialDiceVariantForTile(tile)?.id === 'barell';
}

export function getBarrelBouncyDisplayGeometry() {
  return {
    width: DISPLAY_WIDTH,
    height: DISPLAY_HEIGHT,
    anchorX: DISPLAY_ANCHOR_X,
    anchorY: DISPLAY_ANCHOR_Y,
    restingArtworkWidth: BARREL_BOUNCY_DISPLAY_SIZE,
    restingArtworkHeight: BARREL_BOUNCY_DISPLAY_SIZE,
  };
}

export function getBarrelBouncyFrameIndex(elapsedMs: number): number {
  const safeElapsed = Math.max(0, Number(elapsedMs) || 0) % BARREL_BOUNCY_SEQUENCE_MS;
  const activeDuration = BARREL_BOUNCY_CYCLE_MS * BARREL_BOUNCY_ACTIVE_LOOPS;
  if (safeElapsed >= activeDuration) return 0;
  const cycleProgress = (safeElapsed % BARREL_BOUNCY_CYCLE_MS) / BARREL_BOUNCY_CYCLE_MS;
  return Math.min(BARREL_BOUNCY_FRAME_COUNT - 1, Math.floor(cycleProgress * BARREL_BOUNCY_FRAME_COUNT));
}

export function isBarrelBouncyResting(elapsedMs: number): boolean {
  const safeElapsed = Math.max(0, Number(elapsedMs) || 0) % BARREL_BOUNCY_SEQUENCE_MS;
  return safeElapsed >= BARREL_BOUNCY_CYCLE_MS * BARREL_BOUNCY_ACTIVE_LOOPS;
}

export function preloadBarrelBouncyArtwork(): Promise<void> {
  return preloadSharedPixiSheet(BARREL_SHEET_SPEC);
}

function isPixiBranchVisible(displayObject: any): boolean {
  for (let current = displayObject; current; current = current.parent) {
    if (current.destroyed || current.visible === false || current.renderable === false) return false;
    if (typeof current.alpha === 'number' && current.alpha <= 0.001) return false;
  }
  return true;
}

function detachRuntimeTicker(): void {
  if (!runtimeTicker) return;
  try { runtimeTicker.remove(updateAllControllers); } catch {}
  runtimeTicker = null;
}

function disposeController(controller: BarrelController): void {
  if (controller.disposed) return;
  controller.disposed = true;
  controllers.delete(controller.tile);
  if (controller.tile?._ccBarrelBouncyArtwork === controller) delete controller.tile._ccBarrelBouncyArtwork;
  controller.phaseLease?.release();
  controller.phaseLease = null;
  if (controller.retryTimer !== null) {
    clearTimeout(controller.retryTimer);
    controller.retryTimer = null;
  }
  releaseAnimatedDiceAboveHud(controller);
  if (controller.sprite) {
    try { controller.sprite.parent?.removeChild(controller.sprite); } catch {}
    try { controller.sprite.destroy({ texture: false, textureSource: false }); } catch {}
    controller.sprite = null;
  }
  controller.frames = null;
  controller.resource.release();
  if (controller.base && !controller.base.destroyed) controller.base.renderable = controller.originalRenderable;
  if (controllers.size === 0) detachRuntimeTicker();
}

function updateController(controller: BarrelController, deltaMs: number): void {
  const { tile, base, host, sprite } = controller;
  if (controller.disposed || tile?.destroyed || base?.destroyed || host?.destroyed || !isBarrelBouncyTile(tile)) {
    disposeController(controller);
    return;
  }
  if (!sprite || sprite.destroyed || !controller.ready || !controller.running) {
    base.renderable = controller.originalRenderable;
    if (sprite) sprite.renderable = false;
    return;
  }
  controller.elapsedMs = (controller.elapsedMs + Math.max(0, deltaMs)) % BARREL_BOUNCY_SEQUENCE_MS;
  const visible = base.visible !== false && isPixiBranchVisible(host);
  sprite.visible = visible;
  sprite.renderable = visible;
  if (!visible) {
    base.renderable = controller.originalRenderable;
    return;
  }
  const nextFrameIndex = getBarrelBouncyFrameIndex(controller.elapsedMs);
  if (nextFrameIndex !== controller.frameIndex) {
    controller.frameIndex = nextFrameIndex;
    sprite.texture = controller.frames?.[nextFrameIndex] || sprite.texture;
  }
  controller.resting = isBarrelBouncyResting(controller.elapsedMs);
  sprite.alpha = typeof base.alpha === 'number' ? base.alpha : 1;
  sprite.tint = base.tint ?? 0xFFFFFF;
  base.renderable = false;
  syncAnimatedDiceAboveHud(controller);
}

function updateAllControllers(ticker?: any): void {
  const rawDeltaMs = Number(ticker?.elapsedMS);
  const deltaMs = Number.isFinite(rawDeltaMs) && rawDeltaMs >= 0 ? Math.min(100, rawDeltaMs) : (1000 / 60);
  Array.from(controllers.values()).forEach((controller) => updateController(controller, deltaMs));
}

function getLiveTicker(): any {
  return STATE.app?.ticker
    || (globalThis as any)?.window?.CC?.getPixiApp?.()?.ticker
    || (globalThis as any)?.window?.__PIXI_APP__?.ticker
    || (globalThis as any)?.window?.app?.ticker
    || null;
}

function ensureRuntimeTicker(fallbackTicker?: any): void {
  const nextTicker = fallbackTicker?.add && fallbackTicker?.remove ? fallbackTicker : getLiveTicker();
  if (!nextTicker || runtimeTicker === nextTicker) return;
  detachRuntimeTicker();
  runtimeTicker = nextTicker;
  runtimeTicker.add(updateAllControllers);
}

function findTileTicker(tile: any): any {
  return tile?._ccPixiApp?.ticker
    || tile?.parent?._ccPixiApp?.ticker
    || getLiveTicker();
}

export function startBarrelBouncyArtwork(tile: any): BarrelController | null {
  if (!isBarrelBouncyTile(tile) || tile.destroyed) {
    stopBarrelBouncyArtwork(tile);
    return null;
  }
  const existing = controllers.get(tile) || tile._ccBarrelBouncyArtwork;
  if (existing && !existing.disposed) {
    existing.dragging = false;
    ensureRuntimeTicker(findTileTicker(tile));
    return existing;
  }
  const base = tile.base;
  const host = tile.rotG || tile;
  if (!base || base.destroyed || !host || host.destroyed) return null;
  const controller: BarrelController = {
    tile,
    base,
    host,
    sprite: null,
    frames: null,
    resource: acquireSharedPixiSheetResource(BARREL_SHEET_SPEC),
    originalRenderable: base.renderable !== false,
    dragging: false,
    ready: false,
    running: false,
    resting: true,
    disposed: false,
    elapsedMs: 0,
    frameIndex: 0,
    phaseLease: null,
    retryTimer: null,
  };
  controllers.set(tile, controller);
  tile._ccBarrelBouncyArtwork = controller;
  mountBarrelControllerSprite(controller);
  return controller;
}

function mountBarrelControllerSprite(controller: BarrelController, retryAttempt = 0): void {
  const { tile, base, host } = controller;
  void controller.resource.load().then((frames) => {
    if (controller.disposed) return;
    if (tile.destroyed || base.destroyed || host.destroyed || !isBarrelBouncyTile(tile)) {
      disposeController(controller);
      return;
    }
    controller.frames = frames;
    const sprite = new Sprite(frames[0]);
    sprite.label = 'barrel-bouncy-pixi';
    sprite.eventMode = 'none';
    sprite.cursor = 'default';
    sprite.roundPixels = base.roundPixels === true;
    sprite.anchor.set(DISPLAY_ANCHOR_X, DISPLAY_ANCHOR_Y);
    sprite.width = DISPLAY_WIDTH;
    sprite.height = DISPLAY_HEIGHT;
    sprite.alpha = typeof base.alpha === 'number' ? base.alpha : 1;
    sprite.tint = base.tint ?? 0xFFFFFF;
    sprite.visible = false;
    sprite.renderable = false;
    sprite.zIndex = (Number(base.zIndex) || 0) + 0.01;
    host.sortableChildren = true;
    host.addChild(sprite);
    controller.sprite = sprite;
    mountAnimatedDiceAboveHud(controller, sprite, host);
    controller.ready = true;
    ensureRuntimeTicker(findTileTicker(tile));
    controller.phaseLease = acquireAnimatedTimelinePhase(
      'barrel-bouncy-pixi',
      BARREL_BOUNCY_CYCLE_MS,
      [{
        start: () => {
          if (controller.disposed || !controller.ready) return;
          controller.running = true;
          controller.elapsedMs = 0;
          updateController(controller, 0);
        },
      }],
    );
  }).catch(() => {
    if (controller.disposed) return;
    if (retryAttempt === 0) {
      // The shared loader already performs a normal load and cache-bypassing
      // reload. Keep the exact PNG visible, then make one bounded later attempt
      // for a transient WebKit decode failure without waiting for a new tile event.
      controller.retryTimer = setTimeout(() => {
        controller.retryTimer = null;
        if (!controller.disposed) mountBarrelControllerSprite(controller, 1);
      }, 750);
      return;
    }
    disposeController(controller);
  });
}

export function stopBarrelBouncyArtwork(tile: any): void {
  if (!tile) return;
  const controller = controllers.get(tile) || tile._ccBarrelBouncyArtwork;
  if (controller) disposeController(controller);
}

export function setBarrelBouncyArtworkDragging(tile: any, dragging: boolean): boolean {
  const controller = controllers.get(tile) || tile?._ccBarrelBouncyArtwork;
  if (!controller || controller.disposed || !isBarrelBouncyTile(tile)) return false;
  controller.dragging = dragging;
  return true;
}

export function destroyBarrelBouncyArtworkRuntime(): void {
  Array.from(controllers.values()).forEach(disposeController);
  releaseAnimatedSpecialArtworkFamily('barell');
  detachRuntimeTicker();
}

export function resetBarrelBouncyArtworkCacheForTests(): void {
  destroyBarrelBouncyArtworkRuntime();
  destroySharedPixiSheetFamily(BARREL_SHEET_SPEC);
}

export function getBarrelBouncyRuntimeStats() {
  const values = Array.from(controllers.values());
  const resource = getSharedPixiSheetRuntimeStats(BARREL_SHEET_SPEC);
  return {
    controllers: controllers.size,
    ready: values.filter((controller) => controller.ready).length,
    running: values.filter((controller) => controller.running).length,
    resting: values.filter((controller) => controller.resting).length,
    sharedFrames: resource.frames,
    sharedSheetReady: resource.sourceTextures > 0,
    runtimeAttached: runtimeTicker !== null,
  };
}
