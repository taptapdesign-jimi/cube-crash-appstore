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

// Keep the accepted SVG byte-exact as the source-of-truth. Board runtime uses
// one shared, pre-rendered Pixi sheet instead of one SMIL document per tile.
export const BALL_BOUNCY_SVG_URL = './assets/shop/ball/ball-bouncy.svg';
export const BALL_BOUNCY_SHEET_URL = './assets/shop/ball/ball-pixi-sheet.webp';
export const BALL_BOUNCY_VIEWBOX = Object.freeze({ width: 390, height: 440 });
export const BALL_BOUNCY_REST_ART = Object.freeze({ centerX: 195, centerY: 354, size: 148 });
export const BALL_BOUNCY_DISPLAY_SIZE = 128;
export const BALL_BOUNCY_IDLE_OFFSET_Y = 56;
export const BALL_BOUNCY_BUBBLE_ORIGIN_COMPENSATION_Y = -BALL_BOUNCY_IDLE_OFFSET_Y;
export const BALL_BOUNCY_DRAG_Z_INDEX = 12001;
export const BALL_BOUNCY_CYCLE_MS = 1400;
export const BALL_BOUNCY_FRAME_COUNT = 84;

const BALL_PROPERTY_KEY = '_ccBallBouncyArtwork';
const BALL_SHEET_SPEC: SharedPixiSheetSpec = Object.freeze({
  family: 'ball',
  sheetUrl: BALL_BOUNCY_SHEET_URL,
  atlasWidth: 4048,
  atlasHeight: 840,
  cellWidth: 176,
  cellHeight: 210,
  columns: 23,
  frameCount: BALL_BOUNCY_FRAME_COUNT,
  cycleMs: BALL_BOUNCY_CYCLE_MS,
  anchorX: 88.5,
  anchorY: 149.65,
});

export function isBeachBallBouncyTile(tile: any): boolean {
  return !!tile && getSpecialDiceVariantForTile(tile)?.id === 'beach-ball';
}

export function getBallBouncyDisplayGeometry() {
  return {
    width: BALL_SHEET_SPEC.cellWidth,
    height: BALL_SHEET_SPEC.cellHeight,
    anchorX: BALL_SHEET_SPEC.anchorX / BALL_SHEET_SPEC.cellWidth,
    anchorY: BALL_SHEET_SPEC.anchorY / BALL_SHEET_SPEC.cellHeight,
    restingArtworkWidth: BALL_BOUNCY_DISPLAY_SIZE,
    restingArtworkHeight: BALL_BOUNCY_DISPLAY_SIZE,
    idleOffsetY: BALL_BOUNCY_IDLE_OFFSET_Y,
  };
}

function keepPixiEffectsAboveArtwork(controller: SharedPixiSheetController | null): void {
  if (!controller?.sprite || controller.sprite.destroyed) return;
  controller.sprite.zIndex = (Number(controller.base?.zIndex) || 0) - 0.01;
}

export function startBallBouncyArtwork(tile: any): SharedPixiSheetController | null {
  let controller: SharedPixiSheetController | null = null;
  controller = startSharedPixiSheetAnimation({
    tile,
    spec: BALL_SHEET_SPEC,
    isEligible: isBeachBallBouncyTile,
    propertyKey: BALL_PROPERTY_KEY,
    animateDuringDrag: false,
    onReady: () => keepPixiEffectsAboveArtwork(controller),
  });
  keepPixiEffectsAboveArtwork(controller);
  return controller;
}

export function stopBallBouncyArtwork(tile: any): void {
  stopSharedPixiSheetAnimation(tile, BALL_PROPERTY_KEY);
}

export function setBallBouncyArtworkDragging(tile: any, dragging: boolean): boolean {
  // Drag synchronously restores ball.png. Release resumes the retained clock.
  return setSharedPixiSheetAnimationDragging(tile, BALL_PROPERTY_KEY, dragging);
}

export function releaseBallBouncyFrontBubbles(_tile: any): void {
  // The original Pixi bubble system is always the sole paint/motion owner.
}

export function destroyBallBouncyArtworkRuntime(): void {
  destroySharedPixiSheetFamily(BALL_SHEET_SPEC);
  releaseAnimatedSpecialArtworkFamily('ball');
}

export function getBallBouncyRuntimeStats() {
  const stats = getSharedPixiSheetRuntimeStats(BALL_SHEET_SPEC);
  return {
    controllers: stats.controllers,
    ready: stats.ready,
    sourceTextures: stats.sourceTextures,
    frames: stats.frames,
    refs: stats.refs,
    runtimeAttached: stats.tickerAttached,
    overlayAttached: false,
    evictionScheduled: stats.evictionScheduled,
  };
}
