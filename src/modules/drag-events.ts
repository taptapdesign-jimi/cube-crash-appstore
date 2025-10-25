// drag-events.ts
// Event handling for drag and drop system

import { Application, Container } from 'pixi.js';
import { 
  findTileAtPosition, 
  canDropTile, 
  createHoverEffect, 
  removeHoverEffect,
  calculateVelocity,
  smoothVelocity,
  isPointInTile
} from './drag-utils.js';
import { DRAG_EVENTS } from './drag-constants.js';
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

interface DragState {
  isDragging: boolean;
  activeTile: Tile | null;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  lastX: number;
  lastY: number;
  lastTime: number;
  velocityX: number;
  velocityY: number;
  hoveredTile: Tile | null;
  hoverEffect: Graphics | null;
}

// Global drag state
let dragState: DragState = {
  isDragging: false,
  activeTile: null,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
  lastX: 0,
  lastY: 0,
  lastTime: 0,
  velocityX: 0,
  velocityY: 0,
  hoveredTile: null,
  hoverEffect: null
};

let dragConfig: DragConfig | null = null;

/**
 * Setup drag event listeners
 */
export function setupDragListeners(config: DragConfig): void {
  dragConfig = config;
  
  // Check if config and app exist
  if (!config || !config.app) {
    logger.error('❌ Invalid drag config: missing app');
    return;
  }
  
  // Check if stage exists
  if (!config.app.stage) {
    logger.error('❌ Invalid drag config: missing stage');
    return;
  }
  
  // Check if screen exists
  if (!config.app.screen) {
    logger.error('❌ Invalid drag config: missing screen');
    return;
  }
  
  // Mouse events
  config.app.stage.eventMode = 'static';
  config.app.stage.hitArea = config.app.screen;
  
  config.app.stage.on('pointerdown', handlePointerDown);
  config.app.stage.on('pointermove', handlePointerMove);
  config.app.stage.on('pointerup', handlePointerUp);
  config.app.stage.on('pointerupoutside', handlePointerUp);
  
  // Touch events
  config.app.stage.on('touchstart', handleTouchStart);
  config.app.stage.on('touchmove', handleTouchMove);
  config.app.stage.on('touchend', handleTouchEnd);
  config.app.stage.on('touchendoutside', handleTouchEnd);
}

/**
 * Handle pointer down event
 */
function handlePointerDown(event: any): void {
  if (dragState.isDragging) return;
  
  const globalPos = event.global;
  const tiles = dragConfig?.getTiles() || [];
  const targetTile = findTileAtPosition(globalPos.x, globalPos.y, tiles, dragConfig!.board);
  
  if (!targetTile || targetTile.locked) return;
  
  startDrag(targetTile, globalPos.x, globalPos.y);
}

/**
 * Handle pointer move event
 */
function handlePointerMove(event: any): void {
  if (!dragState.isDragging || !dragState.activeTile) return;
  
  const globalPos = event.global;
  updateDrag(globalPos.x, globalPos.y);
}

/**
 * Handle pointer up event
 */
function handlePointerUp(event: any): void {
  if (!dragState.isDragging || !dragState.activeTile) return;
  
  const globalPos = event.global;
  endDrag(globalPos.x, globalPos.y);
}

/**
 * Handle touch start event
 */
function handleTouchStart(event: any): void {
  if (dragState.isDragging) return;
  
  const touch = event.data.originalEvent.touches[0];
  if (!touch) return;
  
  const globalPos = { x: touch.clientX, y: touch.clientY };
  const tiles = dragConfig?.getTiles() || [];
  const targetTile = findTileAtPosition(globalPos.x, globalPos.y, tiles, dragConfig!.board);
  
  if (!targetTile || targetTile.locked) return;
  
  startDrag(targetTile, globalPos.x, globalPos.y);
}

/**
 * Handle touch move event
 */
function handleTouchMove(event: any): void {
  if (!dragState.isDragging || !dragState.activeTile) return;
  
  const touch = event.data.originalEvent.touches[0];
  if (!touch) return;
  
  const globalPos = { x: touch.clientX, y: touch.clientY };
  updateDrag(globalPos.x, globalPos.y);
}

/**
 * Handle touch end event
 */
function handleTouchEnd(event: any): void {
  if (!dragState.isDragging || !dragState.activeTile) return;
  
  const touch = event.data.originalEvent.changedTouches[0];
  if (!touch) return;
  
  const globalPos = { x: touch.clientX, y: touch.clientY };
  endDrag(globalPos.x, globalPos.y);
}

/**
 * Start drag operation
 */
function startDrag(tile: Tile, x: number, y: number): void {
  dragState.isDragging = true;
  dragState.activeTile = tile;
  dragState.startX = x;
  dragState.startY = y;
  dragState.currentX = x;
  dragState.currentY = y;
  dragState.lastX = x;
  dragState.lastY = y;
  dragState.lastTime = Date.now();
  dragState.velocityX = 0;
  dragState.velocityY = 0;
  
  // Store original z-index
  dragState.activeTile._zBeforeDrag = dragState.activeTile.zIndex;
  
  // Bring to front
  dragState.activeTile.zIndex = 1000;
  
  // Create shadow
  if (!dragState.activeTile.shadow) {
    dragState.activeTile.shadow = createTileShadow(dragState.activeTile);
  }
  
  // Emit start event
  dragState.activeTile.emit(DRAG_EVENTS.START, {
    tile: dragState.activeTile,
    x: dragState.startX,
    y: dragState.startY
  });
}

/**
 * Update drag operation
 */
function updateDrag(x: number, y: number): void {
  if (!dragState.activeTile) return;
  
  const currentTime = Date.now();
  const deltaTime = currentTime - dragState.lastTime;
  
  // Calculate velocity
  const currentVel = calculateVelocity(
    { x, y },
    { x: dragState.lastX, y: dragState.lastY },
    deltaTime
  );
  
  // Smooth velocity
  const smoothedVel = smoothVelocity(currentVel, {
    x: dragState.velocityX,
    y: dragState.velocityY
  });
  
  dragState.velocityX = smoothedVel.x;
  dragState.velocityY = smoothedVel.y;
  
  // Update position
  dragState.currentX = x;
  dragState.currentY = y;
  dragState.lastX = x;
  dragState.lastY = y;
  dragState.lastTime = currentTime;
  
  // Move tile
  const localPos = dragConfig!.board.toLocal({ x, y });
  dragState.activeTile.x = localPos.x;
  dragState.activeTile.y = localPos.y;
  
  // Update shadow
  if (dragState.activeTile.shadow) {
    updateShadowPosition(dragState.activeTile, dragState.activeTile.shadow);
  }
  
  // Check for hover
  checkHover(x, y);
  
  // Emit move event
  dragState.activeTile.emit(DRAG_EVENTS.MOVE, {
    tile: dragState.activeTile,
    x: dragState.currentX,
    y: dragState.currentY,
    velocityX: dragState.velocityX,
    velocityY: dragState.velocityY
  });
}

/**
 * End drag operation
 */
function endDrag(x: number, y: number): void {
  if (!dragState.activeTile) return;
  
  const tiles = dragConfig?.getTiles() || [];
  const targetTile = findTileAtPosition(x, y, tiles, dragConfig!.board);
  
  // Check if can drop
  if (targetTile && canDropTile(dragState.activeTile, targetTile, dragConfig?.canDrop)) {
    // Drop successful
    handleDrop(dragState.activeTile, targetTile);
  } else {
    // Snap back
    handleSnapBack(dragState.activeTile);
  }
  
  // Clean up hover
  clearHover();
  
  // Emit end event
  dragState.activeTile.emit(DRAG_EVENTS.END, {
    tile: dragState.activeTile,
    x: dragState.currentX,
    y: dragState.currentY,
    success: !!targetTile
  });
  
  // Reset state
  resetDragState();
}

/**
 * Check for hover over tiles
 */
function checkHover(x: number, y: number): void {
  const tiles = dragConfig?.getTiles() || [];
  const targetTile = findTileAtPosition(x, y, tiles, dragConfig!.board);
  
  if (targetTile && targetTile !== dragState.activeTile) {
    if (dragState.hoveredTile !== targetTile) {
      clearHover();
      setHover(targetTile);
    }
  } else {
    clearHover();
  }
}

/**
 * Set hover effect on tile
 */
function setHover(tile: Tile): void {
  dragState.hoveredTile = tile;
  dragState.hoverEffect = createHoverEffect(tile, dragConfig!);
  
  // Emit hover event
  tile.emit(DRAG_EVENTS.HOVER, { tile });
}

/**
 * Clear hover effect
 */
function clearHover(): void {
  if (dragState.hoveredTile) {
    removeHoverEffect(dragState.hoveredTile);
    
    // Emit unhover event
    dragState.hoveredTile.emit(DRAG_EVENTS.UNHOVER, { tile: dragState.hoveredTile });
    
    dragState.hoveredTile = null;
    dragState.hoverEffect = null;
  }
}

/**
 * Handle successful drop
 */
function handleDrop(sourceTile: Tile, targetTile: Tile): void {
  // Emit merge event
  sourceTile.emit(DRAG_EVENTS.MERGE, {
    sourceTile,
    targetTile,
    helpers: {}
  });
  
  // Call merge callback
  if (dragConfig?.onMerge) {
    dragConfig.onMerge(sourceTile, targetTile, {});
  }
}

/**
 * Handle snap back
 */
function handleSnapBack(tile: Tile): void {
  // Emit snap back event
  tile.emit(DRAG_EVENTS.SNAP_BACK, { tile });
  
  // Implement snap back animation
  const tileElement = document.getElementById(`tile-${tile.id}`);
  if (tileElement) {
    gsap.to(tileElement, {
      x: originalPosition.x,
      y: originalPosition.y,
      duration: 0.3,
      ease: EASING.EASE_OUT,
      onComplete: () => {
        logger.info('✅ Tile snapped back to original position');
      }
    });
  }
}

/**
 * Create tile shadow
 */
function createTileShadow(tile: Tile): Graphics {
  // This should be implemented in drag-utils.ts
  return new Graphics();
}

/**
 * Update shadow position
 */
function updateShadowPosition(tile: Tile, shadow: Graphics): void {
  // This should be implemented in drag-utils.ts
}

/**
 * Reset drag state
 */
function resetDragState(): void {
  if (dragState.activeTile) {
    // Restore z-index
    if (dragState.activeTile._zBeforeDrag !== undefined) {
      dragState.activeTile.zIndex = dragState.activeTile._zBeforeDrag;
    }
  }
  
  dragState.isDragging = false;
  dragState.activeTile = null;
  dragState.startX = 0;
  dragState.startY = 0;
  dragState.currentX = 0;
  dragState.currentY = 0;
  dragState.lastX = 0;
  dragState.lastY = 0;
  dragState.lastTime = 0;
  dragState.velocityX = 0;
  dragState.velocityY = 0;
  dragState.hoveredTile = null;
  dragState.hoverEffect = null;
}

/**
 * Get current drag state
 */
export function getDragState(): DragState {
  return { ...dragState };
}

/**
 * Check if currently dragging
 */
export function isDragging(): boolean {
  return dragState.isDragging;
}

/**
 * Get active tile
 */
export function getActiveTile(): Tile | null {
  return dragState.activeTile;
}

// All functions are already exported individually above