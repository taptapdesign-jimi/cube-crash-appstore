// drag-animations.ts
// Animations for drag and drop system

import { gsap } from 'gsap';
import { 
  __dg_safe_to, 
  __dg_safe_fromTo, 
  __dg_safe_set,
  calculateTileTilt,
  applySmoothRotation,
  calculateParallaxOffset,
  applyMagnetScale,
  resetMagnetScale,
  calculateMagnetPosition
} from './drag-utils.js';
import { 
  TILT_DUR, 
  MAGNET_IN_DUR, 
  MAGNET_MOVE_DUR, 
  MAGNET_RETURN_DUR,
  EASING 
} from './drag-constants.js';

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

/**
 * Animate tile tilt during drag
 */
export function animateTileTilt(tile: Tile, velocityX: number, velocityY: number): void {
  if (!tile.rotG) return;
  
  const tilt = calculateTileTilt(velocityX, velocityY);
  const angle = Math.atan2(velocityY, velocityX);
  
  applySmoothRotation(tile, tilt * Math.cos(angle));
}

/**
 * Animate tile return to original position
 */
export function animateTileReturn(tile: Tile, originalX: number, originalY: number): Promise<void> {
  return new Promise((resolve) => {
    const returnTween = __dg_safe_to(tile, {
      x: originalX,
      y: originalY,
      duration: TILT_DUR,
      ease: EASING.EASE_OUT,
      onComplete: () => {
        // Reset rotation
        if (tile.rotG) {
          __dg_safe_to(tile.rotG, {
            rotation: 0,
            duration: TILT_DUR * 0.5,
            ease: EASING.EASE_OUT
          });
        }
        resolve();
      }
    });
    
    // Store tween for potential cleanup
    (tile as any)._returnTween = returnTween;
  });
}

/**
 * Animate snap back to original position
 */
export function animateSnapBack(tile: Tile, originalX: number, originalY: number): Promise<void> {
  return new Promise((resolve) => {
    const snapTween = __dg_safe_fromTo(tile,
      { x: tile.x, y: tile.y },
      { 
        x: originalX, 
        y: originalY,
        duration: TILT_DUR,
        ease: EASING.EASE_BACK,
        onComplete: () => {
          // Reset rotation
          if (tile.rotG) {
            __dg_safe_to(tile.rotG, {
              rotation: 0,
              duration: TILT_DUR * 0.5,
              ease: EASING.EASE_OUT
            });
          }
          resolve();
        }
      }
    );
    
    // Store tween for potential cleanup
    (tile as any)._snapTween = snapTween;
  });
}

/**
 * Animate magnet effect on target tile
 */
export function animateMagnetEffect(targetTile: Tile): Promise<void> {
  return new Promise((resolve) => {
    if (!targetTile.rotG) {
      resolve();
      return;
    }
    
    // Store original scale
    const originalScaleX = targetTile.rotG.scaleX;
    const originalScaleY = targetTile.rotG.scaleY;
    
    // Animate scale in
    const scaleTween = __dg_safe_fromTo(targetTile.rotG,
      { scaleX: originalScaleX, scaleY: originalScaleY },
      {
        scaleX: 1.03,
        scaleY: 1.03,
        duration: MAGNET_IN_DUR,
        ease: EASING.EASE_OUT,
        onComplete: () => {
          // Animate scale out
          __dg_safe_to(targetTile.rotG, {
            scaleX: originalScaleX,
            scaleY: originalScaleY,
            duration: MAGNET_RETURN_DUR,
            ease: EASING.EASE_OUT,
            onComplete: resolve
          });
        }
      }
    );
    
    // Store tween for potential cleanup
    (targetTile as any)._magnetTween = scaleTween;
  });
}

/**
 * Animate tile to magnet position
 */
export function animateToMagnetPosition(tile: Tile, targetTile: Tile): Promise<void> {
  return new Promise((resolve) => {
    const magnetPos = calculateMagnetPosition(tile, targetTile);
    
    const moveTween = __dg_safe_to(tile, {
      x: magnetPos.x,
      y: magnetPos.y,
      duration: MAGNET_MOVE_DUR,
      ease: EASING.EASE_OUT,
      onComplete: resolve
    });
    
    // Store tween for potential cleanup
    (tile as any)._magnetMoveTween = moveTween;
  });
}

/**
 * Animate tile spawn
 */
export function animateTileSpawn(tile: Tile): Promise<void> {
  return new Promise((resolve) => {
    // Start from scaled down
    __dg_safe_set(tile, { 
      scaleX: 0, 
      scaleY: 0, 
      alpha: 0 
    });
    
    // Animate in
    const spawnTween = __dg_safe_fromTo(tile,
      { scaleX: 0, scaleY: 0, alpha: 0 },
      {
        scaleX: 1,
        scaleY: 1,
        alpha: 1,
        duration: 0.3,
        ease: EASING.EASE_BACK,
        onComplete: resolve
      }
    );
    
    // Store tween for potential cleanup
    (tile as any)._spawnTween = spawnTween;
  });
}

/**
 * Animate tile destroy
 */
export function animateTileDestroy(tile: Tile): Promise<void> {
  return new Promise((resolve) => {
    const destroyTween = __dg_safe_to(tile, {
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      duration: 0.2,
      ease: EASING.EASE_IN,
      onComplete: () => {
        if (tile.parent) {
          tile.parent.removeChild(tile);
        }
        resolve();
      }
    });
    
    // Store tween for potential cleanup
    (tile as any)._destroyTween = destroyTween;
  });
}

/**
 * Animate tile merge
 */
export function animateTileMerge(sourceTile: Tile, targetTile: Tile): Promise<void> {
  return new Promise((resolve) => {
    // Animate source tile to target
    const mergeTween = __dg_safe_to(sourceTile, {
      x: targetTile.x,
      y: targetTile.y,
      scaleX: 0.8,
      scaleY: 0.8,
      alpha: 0,
      duration: 0.3,
      ease: EASING.EASE_IN,
      onComplete: () => {
        // Animate target tile pulse
        if (targetTile.rotG) {
          __dg_safe_fromTo(targetTile.rotG,
            { scaleX: 1, scaleY: 1 },
            {
              scaleX: 1.2,
              scaleY: 1.2,
              duration: 0.1,
              ease: EASING.EASE_OUT,
              yoyo: true,
              repeat: 1,
              onComplete: resolve
            }
          );
        } else {
          resolve();
        }
      }
    });
    
    // Store tween for potential cleanup
    (sourceTile as any)._mergeTween = mergeTween;
  });
}

/**
 * Animate hover effect
 */
export function animateHoverEffect(tile: Tile): void {
  if (!tile.rotG) return;
  
  // Subtle hover animation
  __dg_safe_to(tile.rotG, {
    scaleX: 1.05,
    scaleY: 1.05,
    duration: 0.2,
    ease: EASING.EASE_OUT
  });
}

/**
 * Animate unhover effect
 */
export function animateUnhoverEffect(tile: Tile): void {
  if (!tile.rotG) return;
  
  // Return to normal scale
  __dg_safe_to(tile.rotG, {
    scaleX: 1,
    scaleY: 1,
    duration: 0.2,
    ease: EASING.EASE_OUT
  });
}

/**
 * Animate shadow follow
 */
export function animateShadowFollow(tile: Tile, shadow: Graphics): void {
  if (!shadow) return;
  
  // Update shadow position with slight delay
  __dg_safe_to(shadow, {
    x: tile.x + 8,
    y: tile.y + 8,
    duration: 0.1,
    ease: EASING.EASE_OUT
  });
}

/**
 * Animate parallax effect
 */
export function animateParallaxEffect(tile: Tile, velocityX: number, velocityY: number): void {
  const parallax = calculateParallaxOffset(velocityX, velocityY);
  
  if (tile.rotG) {
    __dg_safe_to(tile.rotG, {
      x: parallax.x,
      y: parallax.y,
      duration: 0.1,
      ease: EASING.EASE_OUT
    });
  }
}

/**
 * Kill all animations for tile
 */
export function killTileAnimations(tile: Tile): void {
  const tweens = [
    (tile as any)._returnTween,
    (tile as any)._snapTween,
    (tile as any)._magnetTween,
    (tile as any)._magnetMoveTween,
    (tile as any)._spawnTween,
    (tile as any)._destroyTween,
    (tile as any)._mergeTween
  ];
  
  tweens.forEach(tween => {
    if (tween && tween.kill) {
      tween.kill();
    }
  });
  
  // Clear references
  delete (tile as any)._returnTween;
  delete (tile as any)._snapTween;
  delete (tile as any)._magnetTween;
  delete (tile as any)._magnetMoveTween;
  delete (tile as any)._spawnTween;
  delete (tile as any)._destroyTween;
  delete (tile as any)._mergeTween;
}

/**
 * Animate tile bounce
 */
export function animateTileBounce(tile: Tile): Promise<void> {
  return new Promise((resolve) => {
    const bounceTween = __dg_safe_fromTo(tile,
      { scaleX: 1, scaleY: 1 },
      {
        scaleX: 1.1,
        scaleY: 1.1,
        duration: 0.1,
        ease: EASING.EASE_OUT,
        yoyo: true,
        repeat: 1,
        onComplete: resolve
      }
    );
    
    // Store tween for potential cleanup
    (tile as any)._bounceTween = bounceTween;
  });
}

/**
 * Animate tile shake
 */
export function animateTileShake(tile: Tile): Promise<void> {
  return new Promise((resolve) => {
    const shakeTween = __dg_safe_fromTo(tile,
      { x: tile.x },
      {
        x: tile.x - 5,
        duration: 0.05,
        ease: EASING.EASE_OUT,
        yoyo: true,
        repeat: 9,
        onComplete: resolve
      }
    );
    
    // Store tween for potential cleanup
    (tile as any)._shakeTween = shakeTween;
  });
}

// All functions are already exported individually above