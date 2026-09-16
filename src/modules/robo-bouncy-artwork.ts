import { Assets, type Texture } from 'pixi.js';
import { getSpecialDiceVariantForTile } from './special-dice-registry.ts';
import { applyGameplayTextureFiltering } from './gameplay-texture-filtering.ts';
import { isUsablePixiImageTexture, pinPixiImageTexture } from '../utils/pixi-image-texture-health.ts';
import { releaseAnimatedSpecialArtworkFamily } from './animated-special-artwork-mode.ts';
import {
  destroySharedPixiSheetFamily,
  getSharedPixiSheetRuntimeStats,
  preloadSharedPixiSheet,
  setSharedPixiSheetAnimationDragging,
  startSharedPixiSheetAnimation,
  stopSharedPixiSheetAnimation,
  type SharedPixiSheetController,
  type SharedPixiSheetSpec,
} from './shared-pixi-sheet-animation.ts';

// The accepted SVG stays preserved as the authored source of truth. Runtime
// uses chronological Pixi frames so all Robo tiles share one decoded source.
export const ROBO_BOUNCY_SVG_URL = './assets/shop/robo/robo-bouncy.svg';
export const ROBO_BOUNCY_SHEET_URL = './assets/shop/robo/robo-pixi-sheet.webp';
export const ROBO_BOUNCY_VIEWBOX = Object.freeze({ width: 390, height: 440 });
export const ROBO_BOUNCY_REST_ART = Object.freeze({ centerX: 195, centerY: 239, size: 256 });
export const ROBO_BOUNCY_DISPLAY_SIZE = 128;
export const ROBO_BOUNCY_DRAG_Z_INDEX = 12001;
export const ROBO_BOUNCY_CYCLE_MS = 2400;
export const ROBO_BOUNCY_FRAME_COUNT = 144;

const ROBO_PROPERTY_KEY = '_ccRoboBouncyArtwork';
const PRELOAD_BATCH_SIZE = 3;
const ROBO_SHEET_SPEC: SharedPixiSheetSpec = Object.freeze({
  family: 'robo-bouncy',
  sheetUrl: ROBO_BOUNCY_SHEET_URL,
  atlasWidth: 4077,
  atlasHeight: 1032,
  cellWidth: 151,
  cellHeight: 172,
  columns: 27,
  frameCount: ROBO_BOUNCY_FRAME_COUNT,
  cycleMs: ROBO_BOUNCY_CYCLE_MS,
  anchorX: 79.5,
  anchorY: 104.5,
});

type RoboBouncyController = SharedPixiSheetController & {
  originalTexture: Texture | null;
  dragTexture: Texture | null;
  paintedWidth: number;
  paintedHeight: number;
};

export function isRoboBouncyTile(tile: any): boolean {
  return !!tile && getSpecialDiceVariantForTile(tile)?.id === 'robo-cube';
}

export function getRoboBouncyDisplayGeometry() {
  return {
    width: ROBO_SHEET_SPEC.cellWidth,
    height: ROBO_SHEET_SPEC.cellHeight,
    anchorX: ROBO_SHEET_SPEC.anchorX / ROBO_SHEET_SPEC.cellWidth,
    anchorY: ROBO_SHEET_SPEC.anchorY / ROBO_SHEET_SPEC.cellHeight,
    restingArtworkWidth: ROBO_BOUNCY_DISPLAY_SIZE,
    restingArtworkHeight: ROBO_BOUNCY_DISPLAY_SIZE,
  };
}

function restoreOriginalTexture(controller: RoboBouncyController): void {
  const { base, dragTexture, originalTexture, paintedWidth, paintedHeight } = controller;
  if (!base || base.destroyed || !originalTexture || base.texture !== dragTexture) return;
  base.texture = originalTexture;
  base.width = paintedWidth;
  base.height = paintedHeight;
  applyGameplayTextureFiltering(base.texture);
}

function paintDragFallback(controller: RoboBouncyController): void {
  const { base, dragTexture, paintedWidth, paintedHeight } = controller;
  if (!base || base.destroyed || !dragTexture || !isUsablePixiImageTexture(dragTexture)) return;
  base.texture = dragTexture;
  base.width = paintedWidth;
  base.height = paintedHeight;
  applyGameplayTextureFiltering(base.texture);
}

async function warmFinaleInBoundedBatches(
  controller: RoboBouncyController,
  sources: string[],
): Promise<void> {
  for (let index = 0; index < sources.length && !controller.disposed; index += PRELOAD_BATCH_SIZE) {
    await Promise.allSettled(
      sources.slice(index, index + PRELOAD_BATCH_SIZE).map((source) => Assets.load(source)),
    );
  }
}

export function preloadRoboBouncyArtwork(): Promise<void> {
  return preloadSharedPixiSheet(ROBO_SHEET_SPEC);
}

export function startRoboBouncyArtwork(
  tile: any,
  idleFrameSources: string[] = [],
  finalePreloadSources: string[] = [],
): RoboBouncyController | null {
  if (!isRoboBouncyTile(tile) || tile?.destroyed) {
    stopRoboBouncyArtwork(tile);
    return null;
  }

  const existing = tile[ROBO_PROPERTY_KEY] as RoboBouncyController | undefined;
  if (existing && !existing.disposed) {
    const reused = startSharedPixiSheetAnimation({
      tile,
      spec: ROBO_SHEET_SPEC,
      isEligible: isRoboBouncyTile,
      propertyKey: ROBO_PROPERTY_KEY,
      animateDuringDrag: false,
    }) as RoboBouncyController | null;
    if (reused) {
      restoreOriginalTexture(reused);
      setSharedPixiSheetAnimationDragging(tile, ROBO_PROPERTY_KEY, false);
    }
    return reused;
  }

  const base = tile.base;
  if (!base || base.destroyed) return null;
  let controller: RoboBouncyController | null = null;
  const originalTexture = (base.texture || null) as Texture | null;
  const paintedWidth = base.width;
  const paintedHeight = base.height;
  controller = startSharedPixiSheetAnimation({
    tile,
    spec: ROBO_SHEET_SPEC,
    isEligible: isRoboBouncyTile,
    propertyKey: ROBO_PROPERTY_KEY,
    animateDuringDrag: false,
    onReady: () => {
      if (controller && !controller.disposed) {
        void warmFinaleInBoundedBatches(controller, finalePreloadSources);
      }
    },
    onDispose: () => {
      if (!controller) return;
      restoreOriginalTexture(controller);
    },
  }) as RoboBouncyController | null;
  if (!controller) return null;
  controller.originalTexture = originalTexture;
  controller.dragTexture = null;
  controller.paintedWidth = paintedWidth;
  controller.paintedHeight = paintedHeight;
  const dragTextureSource = idleFrameSources[1] ?? idleFrameSources[0] ?? null;
  if (dragTextureSource) {
    void Assets.load<Texture>(dragTextureSource).then((texture) => {
      if (!controller || controller.disposed || !isUsablePixiImageTexture(texture)) return;
      controller.dragTexture = texture;
      pinPixiImageTexture(texture);
      if (controller.dragging) paintDragFallback(controller);
    }).catch(() => {
      // The registry base texture remains a safe drag fallback.
    });
  }
  return controller;
}

export function stopRoboBouncyArtwork(tile: any): void {
  if (!tile) return;
  stopSharedPixiSheetAnimation(tile, ROBO_PROPERTY_KEY);
}

export function setRoboBouncyArtworkDragging(tile: any, dragging: boolean): boolean {
  const controller = tile?.[ROBO_PROPERTY_KEY] as RoboBouncyController | undefined;
  if (!controller || controller.disposed || !isRoboBouncyTile(tile)) return false;
  if (!dragging) restoreOriginalTexture(controller);
  const handled = setSharedPixiSheetAnimationDragging(tile, ROBO_PROPERTY_KEY, dragging);
  if (handled && dragging) paintDragFallback(controller);
  return handled;
}

export function destroyRoboBouncyArtworkRuntime(): void {
  destroySharedPixiSheetFamily(ROBO_SHEET_SPEC);
  releaseAnimatedSpecialArtworkFamily('robo');
}

export function getRoboBouncyRuntimeStats() {
  const stats = getSharedPixiSheetRuntimeStats(ROBO_SHEET_SPEC);
  return {
    controllers: stats.controllers,
    ready: stats.ready,
    runtimeAttached: stats.tickerAttached,
    overlayAttached: false,
    sharedFrames: stats.frames,
    sharedSheetReady: stats.sourceTextures === 1,
    refs: stats.refs,
    evictionScheduled: stats.evictionScheduled,
  };
}
