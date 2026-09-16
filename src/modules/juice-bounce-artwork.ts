import { getSpecialDiceVariantForTile } from './special-dice-registry.ts';
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
// uses chronological Pixi frames beside the existing Pixi bubble owner.
export const JUICE_BOUNCE_SVG_URL = './assets/shop/juice/juice-bounce.svg';
export const JUICE_BOUNCE_SHEET_URL = './assets/shop/juice/juice-pixi-sheet.webp';
export const JUICE_BOUNCE_VIEWBOX = Object.freeze({ width: 390, height: 800 });
export const JUICE_BOUNCE_CROP = Object.freeze({ x: 20, y: 110, width: 350, height: 460 });
export const JUICE_BOUNCE_REST_ART = Object.freeze({
  centerX: 53 + (384 * 0.78) / 2,
  centerY: 239 + (384 * 0.78) / 2,
  size: 384 * 0.78,
});
export const JUICE_BOUNCE_DISPLAY_SIZE = 128;
export const JUICE_BOUNCE_DRAG_Z_INDEX = 12001;
export const JUICE_BOUNCE_CYCLE_MS = 2000;
export const JUICE_BOUNCE_ACTIVE_DURATION_MS = 1400;
export const JUICE_BOUNCE_FRAME_COUNT = 84;

const JUICE_PROPERTY_KEY = '_ccJuiceBounceArtwork';
const JUICE_SHEET_SPEC: SharedPixiSheetSpec = Object.freeze({
  family: 'juice-bounce',
  sheetUrl: JUICE_BOUNCE_SHEET_URL,
  atlasWidth: 3999,
  atlasHeight: 561,
  cellWidth: 129,
  cellHeight: 187,
  columns: 31,
  frameCount: JUICE_BOUNCE_FRAME_COUNT,
  cycleMs: JUICE_BOUNCE_CYCLE_MS,
  activeDurationMs: JUICE_BOUNCE_ACTIVE_DURATION_MS,
  anchorX: 67.326,
  anchorY: 119.38,
});

export type JuiceBounceController = SharedPixiSheetController;

export function isPlainJuiceBounceTile(tile: any): boolean {
  return !!tile
    && tile.special === 'wild-juice'
    && getSpecialDiceVariantForTile(tile) === null;
}

export function getJuiceBounceDisplayGeometry() {
  return {
    width: JUICE_SHEET_SPEC.cellWidth,
    height: JUICE_SHEET_SPEC.cellHeight,
    anchorX: JUICE_SHEET_SPEC.anchorX / JUICE_SHEET_SPEC.cellWidth,
    anchorY: JUICE_SHEET_SPEC.anchorY / JUICE_SHEET_SPEC.cellHeight,
    restingArtworkWidth: JUICE_BOUNCE_DISPLAY_SIZE,
    restingArtworkHeight: JUICE_BOUNCE_DISPLAY_SIZE,
  };
}

export function preloadJuiceBounceArtwork(): Promise<void> {
  return preloadSharedPixiSheet(JUICE_SHEET_SPEC);
}

export function startJuiceBounceArtwork(tile: any): JuiceBounceController | null {
  return startSharedPixiSheetAnimation({
    tile,
    spec: JUICE_SHEET_SPEC,
    isEligible: isPlainJuiceBounceTile,
    propertyKey: JUICE_PROPERTY_KEY,
    animateDuringDrag: true,
    onReady: () => {
      // The original Pixi bubble system remains the sole paint and motion
      // owner. A legacy DOM bridge must never leave its container hidden.
      const container = tile?._wildJuiceBubbleSystem?.container;
      if (container && !container.destroyed) container.renderable = true;
    },
  });
}

export function stopJuiceBounceArtwork(tile: any): void {
  if (!tile) return;
  stopSharedPixiSheetAnimation(tile, JUICE_PROPERTY_KEY);
}

export function releaseJuiceBounceFrontBubbles(tile: any): void {
  const system = tile?._wildJuiceBubbleSystem;
  if (system?.container && !system.container.destroyed) system.container.renderable = true;
  if (system?._ccJuiceFrontBubbleOwner) delete system._ccJuiceFrontBubbleOwner;
  if (system?._ccJuiceFrontBubbleRenderableBefore !== undefined) {
    delete system._ccJuiceFrontBubbleRenderableBefore;
  }
}

export function setJuiceBounceArtworkDragging(tile: any, dragging: boolean): boolean {
  return setSharedPixiSheetAnimationDragging(tile, JUICE_PROPERTY_KEY, dragging);
}

export function destroyJuiceBounceArtworkRuntime(): void {
  destroySharedPixiSheetFamily(JUICE_SHEET_SPEC);
  releaseAnimatedSpecialArtworkFamily('juice');
}

export function getJuiceBounceRuntimeStats() {
  const stats = getSharedPixiSheetRuntimeStats(JUICE_SHEET_SPEC);
  return {
    controllers: stats.controllers,
    ready: stats.ready,
    tickerAttached: stats.tickerAttached,
    overlayAttached: false,
    sharedFrames: stats.frames,
    sharedSheetReady: stats.sourceTextures === 1,
    refs: stats.refs,
    evictionScheduled: stats.evictionScheduled,
  };
}
