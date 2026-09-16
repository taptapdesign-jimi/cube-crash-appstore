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

// The authored SVG remains the immutable source. Runtime uses one evictable
// Pixi atlas shared by every live Mushroom.
export const MUSHROOM_BOUNCY_SVG_URL = './assets/shop/mushroom/mushroom.svg';
export const MUSHROOM_BOUNCY_SHEET_URL = './assets/shop/mushroom/mushroom-pixi-sheet.webp';
export const MUSHROOM_BOUNCY_VIEWBOX = Object.freeze({ x: -26, y: -34, width: 180, height: 180 });
export const MUSHROOM_BOUNCY_REST_ART = Object.freeze({ centerX: 64, centerY: 64, size: 128 });
export const MUSHROOM_BOUNCY_DISPLAY_SIZE = 128;
export const MUSHROOM_BOUNCY_DRAG_Z_INDEX = 12001;
export const MUSHROOM_BOUNCY_CYCLE_MS = 2000;
export const MUSHROOM_BOUNCY_FRAME_COUNT = 120;

const PROPERTY_KEY = '_ccMushroomBouncyArtwork';
const CROP_X = 21;
const CROP_Y = 12;
const CELL_WIDTH = 133;
const CELL_HEIGHT = 152;
const DISPLAY_ANCHOR_X = 90 - CROP_X;
const DISPLAY_ANCHOR_Y = 98 - CROP_Y;

export const MUSHROOM_BOUNCY_SHEET_SPEC: SharedPixiSheetSpec = Object.freeze({
  family: 'mushroom-bouncy-pixi',
  sheetUrl: MUSHROOM_BOUNCY_SHEET_URL,
  atlasWidth: 3990,
  atlasHeight: 608,
  cellWidth: CELL_WIDTH,
  cellHeight: CELL_HEIGHT,
  columns: 30,
  frameCount: MUSHROOM_BOUNCY_FRAME_COUNT,
  cycleMs: MUSHROOM_BOUNCY_CYCLE_MS,
  anchorX: DISPLAY_ANCHOR_X,
  anchorY: DISPLAY_ANCHOR_Y,
});

export function isMushroomBouncyTile(tile: any): boolean {
  return !!tile && getSpecialDiceVariantForTile(tile)?.id === 'mushroom';
}

export function getMushroomBouncyDisplayGeometry() {
  return {
    width: CELL_WIDTH,
    height: CELL_HEIGHT,
    anchorX: DISPLAY_ANCHOR_X / CELL_WIDTH,
    anchorY: DISPLAY_ANCHOR_Y / CELL_HEIGHT,
    restingArtworkWidth: MUSHROOM_BOUNCY_DISPLAY_SIZE,
    restingArtworkHeight: MUSHROOM_BOUNCY_DISPLAY_SIZE,
  };
}

export function startMushroomBouncyArtwork(tile: any): SharedPixiSheetController | null {
  return startSharedPixiSheetAnimation({
    tile,
    spec: MUSHROOM_BOUNCY_SHEET_SPEC,
    isEligible: isMushroomBouncyTile,
    propertyKey: PROPERTY_KEY,
    animateDuringDrag: false,
  });
}

export function stopMushroomBouncyArtwork(tile: any): void {
  stopSharedPixiSheetAnimation(tile, PROPERTY_KEY);
}

export function setMushroomBouncyArtworkDragging(tile: any, dragging: boolean): boolean {
  return setSharedPixiSheetAnimationDragging(tile, PROPERTY_KEY, dragging);
}

export function destroyMushroomBouncyArtworkRuntime(): void {
  destroySharedPixiSheetFamily(MUSHROOM_BOUNCY_SHEET_SPEC);
  releaseAnimatedSpecialArtworkFamily('mushroom');
}

export function getMushroomBouncyRuntimeStats() {
  return getSharedPixiSheetRuntimeStats(MUSHROOM_BOUNCY_SHEET_SPEC);
}
