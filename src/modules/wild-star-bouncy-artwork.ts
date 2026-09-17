import { getSpecialDiceVariantForTile } from './special-dice-registry.ts';
import { releaseAnimatedSpecialArtworkFamily } from './animated-special-artwork-mode.ts';
import {
  destroySharedPixiSheetFamily,
  getSharedPixiSheetRuntimeStats,
  setSharedPixiSheetAnimationDragging,
  startSharedPixiSheetAnimation,
  stopSharedPixiSheetAnimation,
  type SharedPixiSheetController,
  type SharedPixiSheetSpec,
} from './shared-pixi-sheet-animation.ts';

// Keep the restored SVG byte-exact as the source-of-truth. Board runtime
// shares one evictable Pixi atlas across every generic Wild Star tile.
export const WILD_STAR_BOUNCY_SVG_URL = './assets/shop/star/star.svg';
export const WILD_STAR_BOUNCY_SHEET_URL = './assets/shop/star/star-pixi-sheet.webp';
export const WILD_STAR_BOUNCY_VIEWBOX = Object.freeze({ minX: 0, minY: 0, width: 520, height: 560 });
export const WILD_STAR_BOUNCY_REST_ART = Object.freeze({
  centerX: 260,
  centerY: 465 + (-407 + 432 / 2) * 0.85,
  size: 432 * 0.85,
});
export const WILD_STAR_BOUNCY_DISPLAY_SIZE = 128;
export const WILD_STAR_BOUNCY_DRAG_Z_INDEX = 12001;
export const WILD_STAR_BOUNCY_CYCLE_MS = 2000;
export const WILD_STAR_BOUNCY_FRAME_COUNT = 120;
export const WILD_STAR_BOUNCY_PHASE_GROUP = 'wild-star-composition';

const WILD_STAR_PROPERTY_KEY = '_ccWildStarBouncyArtwork';
const WILD_STAR_SHEET_SPEC: SharedPixiSheetSpec = Object.freeze({
  family: WILD_STAR_BOUNCY_PHASE_GROUP,
  sheetUrl: WILD_STAR_BOUNCY_SHEET_URL,
  atlasWidth: 4077,
  atlasHeight: 735,
  cellWidth: 151,
  cellHeight: 147,
  columns: 27,
  frameCount: WILD_STAR_BOUNCY_FRAME_COUNT,
  cycleMs: WILD_STAR_BOUNCY_CYCLE_MS,
  anchorX: 75.5,
  anchorY: 86.39,
  renderAboveHud: true,
});

export function isPlainWildStarBouncyTile(tile: any): boolean {
  return !!tile
    && tile.special === 'wild'
    && getSpecialDiceVariantForTile(tile) === null;
}

export function getWildStarBouncyDisplayGeometry() {
  return {
    width: WILD_STAR_SHEET_SPEC.cellWidth,
    height: WILD_STAR_SHEET_SPEC.cellHeight,
    anchorX: WILD_STAR_SHEET_SPEC.anchorX / WILD_STAR_SHEET_SPEC.cellWidth,
    anchorY: WILD_STAR_SHEET_SPEC.anchorY / WILD_STAR_SHEET_SPEC.cellHeight,
    restingArtworkWidth: WILD_STAR_BOUNCY_DISPLAY_SIZE,
    restingArtworkHeight: WILD_STAR_BOUNCY_DISPLAY_SIZE,
  };
}

function keepOrbitAboveArtwork(controller: SharedPixiSheetController | null): void {
  if (!controller?.sprite || controller.sprite.destroyed) return;
  controller.sprite.zIndex = (Number(controller.base?.zIndex) || 0) - 0.01;
}

export function startWildStarBouncyArtwork(tile: any): SharedPixiSheetController | null {
  let controller: SharedPixiSheetController | null = null;
  controller = startSharedPixiSheetAnimation({
    tile,
    spec: WILD_STAR_SHEET_SPEC,
    isEligible: isPlainWildStarBouncyTile,
    propertyKey: WILD_STAR_PROPERTY_KEY,
    animateDuringDrag: true,
    onReady: () => keepOrbitAboveArtwork(controller),
  });
  keepOrbitAboveArtwork(controller);
  return controller;
}

export function stopWildStarBouncyArtwork(tile: any): void {
  stopSharedPixiSheetAnimation(tile, WILD_STAR_PROPERTY_KEY);
}

export function setWildStarBouncyArtworkDragging(tile: any, dragging: boolean): boolean {
  return setSharedPixiSheetAnimationDragging(tile, WILD_STAR_PROPERTY_KEY, dragging);
}

export function destroyWildStarBouncyArtworkRuntime(): void {
  destroySharedPixiSheetFamily(WILD_STAR_SHEET_SPEC);
  releaseAnimatedSpecialArtworkFamily('wild-star');
}

export function getWildStarBouncyRuntimeStats() {
  const stats = getSharedPixiSheetRuntimeStats(WILD_STAR_SHEET_SPEC);
  return {
    controllers: stats.controllers,
    ready: stats.ready,
    sourceTextures: stats.sourceTextures,
    frames: stats.frames,
    refs: stats.refs,
    orbitBridged: 0,
    runtimeAttached: stats.tickerAttached,
    overlayAttached: false,
    evictionScheduled: stats.evictionScheduled,
  };
}
