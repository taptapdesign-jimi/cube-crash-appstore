// drag-core.ts
// Core drag and drop functionality for CubeCrash

import { Graphics, Container, Sprite, Texture, Application } from 'pixi.js';
import { gsap } from 'gsap';
import { magicSparklesAtTile } from './fx-animations.js';
import { setupDragListeners, getDragState, isDragging, getActiveTile } from './drag-events.js';
import { 
  calculateTileTilt, 
  applySmoothRotation, 
  calculateParallaxOffset,
  createTileShadow,
  updateShadowPosition,
  calculateMagnetPosition,
  applyMagnetScale,
  resetMagnetScale
} from './drag-utils.js';
import { 
  animateTileTilt, 
  animateTileReturn, 
  animateSnapBack,
  animateMagnetEffect,
  animateToMagnetPosition,
  killTileAnimations
} from './drag-animations.js';
import { logger } from '../core/logger.js';

// Type definitions
interface Tile extends Container {
  gridX: number;
  gridY: number;
  value: number;
  locked: boolean;
  special?: string;
  rotG?: Container;
  shadow?: Graphics;
  refreshShadow?: () => void;
  targetX?: number;
  targetY?: number;
  _zBeforeDrag?: number;
  _magnetHomeX?: number;
  _magnetHomeY?: number;
  _lastVelX?: number;
  _lastVelY?: number;
}

interface Board extends Container {
  toLocal: (global: { x: number; y: number }) => { x: number; y: number };
  addChild: (child: Container) => Container;
  sortChildren?: () => void;
}

interface DragConfig {
  app: Application;
  board: Board;
  getTiles: () => Tile[];
  onMerge?: (srcTile: Tile, dstTile: Tile, helpers: any) => void;
  canDrop?: (src: Tile, dst: Tile) => boolean;
  tileSize?: number;
  hoverColor?: number;
  hoverWidth?: number;
  hoverAlpha?: number;
  threshold?: number;
  getGrid?: () => (Tile | null)[][];
}

// Global state
let dragConfig: DragConfig | null = null;
let isInitialized = false;

/**
 * Initialize drag system
 */
export function initDrag(cfg: DragConfig): void {
  logger.info('🎯 Initializing drag system');
  
  dragConfig = cfg;
  
  // Setup event listeners
  setupDragListeners(cfg);
  
  isInitialized = true;
  logger.info('✅ Drag system initialized');
}

/**
 * Update drag system (called during game loop)
 */
export function updateDrag(): void {
  if (!isInitialized || !isDragging()) return;
  
  const dragState = getDragState();
  const activeTile = getActiveTile();
  
  if (!activeTile) return;
  
  // Apply tilt animation
  animateTileTilt(activeTile, dragState.velocityX, dragState.velocityY);
  
  // Apply parallax effect
  const parallax = calculateParallaxOffset(dragState.velocityX, dragState.velocityY);
  if (activeTile.rotG) {
    activeTile.rotG.x = parallax.x;
    activeTile.rotG.y = parallax.y;
  }
  
  // Update shadow
  if (activeTile.shadow) {
    updateShadowPosition(activeTile, activeTile.shadow);
  }
}

/**
 * Handle drag start
 */
export function onDragStart(tile: Tile): void {
  logger.info('🎯 Drag started:', tile.value);
  
  // Create shadow
  if (!tile.shadow) {
    tile.shadow = createTileShadow(tile);
  }
  
  // Store original position
  tile._magnetHomeX = tile.x;
  tile._magnetHomeY = tile.y;
  
  // Bring to front
  tile.zIndex = 1000;
}

/**
 * Handle drag move
 */
export function onDragMove(tile: Tile, newX: number, newY: number): void {
  // Update position
  tile.x = newX;
  tile.y = newY;
  
  // Update shadow
  if (tile.shadow) {
    updateShadowPosition(tile, tile.shadow);
  }
}

/**
 * Handle drag end
 */
export function onDragEnd(tile: Tile): void {
  logger.info('🎯 Drag ended:', tile.value);
  
  // Get drag state
  const dragState = getDragState();
  
  if (dragState.hoveredTile) {
    // Handle successful drop
    handleSuccessfulDrop(tile, dragState.hoveredTile);
  } else {
    // Handle snap back
    handleSnapBack(tile);
  }
  
  // Clean up
  cleanupDrag(tile);
}

/**
 * Handle successful drop
 */
async function handleSuccessfulDrop(sourceTile: Tile, targetTile: Tile): Promise<void> {
  logger.info('✅ Drop successful:', sourceTile.value, '->', targetTile.value);
  
  // Animate to magnet position
  await animateToMagnetPosition(sourceTile, targetTile);
  
  // Animate magnet effect on target
  await animateMagnetEffect(targetTile);
  
  // Call merge callback
  if (dragConfig?.onMerge) {
    dragConfig.onMerge(sourceTile, targetTile, {});
  }
  
  // Show magic sparkles
  magicSparklesAtTile(targetTile);
}

/**
 * Handle snap back
 */
async function handleSnapBack(tile: Tile): Promise<void> {
  logger.info('🔄 Snapping back tile');
  
  if (tile._magnetHomeX !== undefined && tile._magnetHomeY !== undefined) {
    await animateSnapBack(tile, tile._magnetHomeX, tile._magnetHomeY);
  }
}

/**
 * Clean up drag state
 */
function cleanupDrag(tile: Tile): void {
  // Kill all animations
  killTileAnimations(tile);
  
  // Remove shadow
  if (tile.shadow && tile.shadow.parent) {
    tile.shadow.parent.removeChild(tile.shadow);
    tile.shadow = undefined;
  }
  
  // Reset z-index
  if (tile._zBeforeDrag !== undefined) {
    tile.zIndex = tile._zBeforeDrag;
  }
  
  // Reset rotation
  if (tile.rotG) {
    tile.rotG.rotation = 0;
    tile.rotG.x = 0;
    tile.rotG.y = 0;
  }
  
  // Clear stored values
  tile._magnetHomeX = undefined;
  tile._magnetHomeY = undefined;
  tile._lastVelX = undefined;
  tile._lastVelY = undefined;
}

/**
 * Check if drag system is initialized
 */
export function isDragInitialized(): boolean {
  return isInitialized;
}

/**
 * Get drag configuration
 */
export function getDragConfig(): DragConfig | null {
  return dragConfig;
}

/**
 * Destroy drag system
 */
export function destroyDrag(): void {
  if (!isInitialized) return;
  
  logger.info('🗑️ Destroying drag system');
  
  // Kill all animations
  const tiles = dragConfig?.getTiles() || [];
  tiles.forEach(tile => {
    killTileAnimations(tile);
  });
  
  // Reset state
  dragConfig = null;
  isInitialized = false;
  
  logger.info('✅ Drag system destroyed');
}

// All functions are already exported individually above