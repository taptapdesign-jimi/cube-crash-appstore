// merge-animations.ts
// Animations for merge system

import { gsap } from 'gsap';
import { Container, Graphics, Text } from 'pixi.js';
import { logger } from '../core/logger.js';

import { 
  MERGE_ANIMATION_DURATION,
  SCORE_ANIMATION_DURATION,
  COMBO_ANIMATION_DURATION,
  BOARD_SHAKE_DURATION,
  TILE_BOUNCE_DURATION,
  WILD_MERGE_DURATION,
  EASING
} from './merge-constants.js';

// Type definitions
interface Tile extends Container {
  value: number;
  stackDepth?: number;
  gridX: number;
  gridY: number;
  special?: string;
  isWild?: boolean;
  isWildFace?: boolean;
  locked: boolean;
  eventMode: string;
  x: number;
  y: number;
  width: number;
  height: number;
  parent: Container | null;
  num?: Text;
  bg?: Graphics;
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
  _isBeingMerged?: boolean;
  _isBeingDestroyed?: boolean;
  _isBeingSpawned?: boolean;
}

interface MergeHelpers {
  score: number;
  combo: number;
  board: number;
  moves: number;
  setScore: (score: number) => void;
  setCombo: (combo: number) => void;
  setBoard: (board: number) => void;
  setMoves: (moves: number) => void;
  animateScore: (score: number, duration?: number) => void;
  animateCombo: (combo: number, duration?: number) => void;
  updateHUD: () => void;
}

/**
 * Animate merge effect
 */
export function animateMergeEffect(src: Tile, dst: Tile): Promise<void> {
  return new Promise((resolve) => {
    if (!src || !dst) {
      resolve();
      return;
    }
    
    logger.info(`✨ Animating merge effect: ${src.value} -> ${dst.value}`);
    
    // Mark as being merged
    src._isBeingMerged = true;
    dst._isBeingMerged = true;
    
    // Animate source tile to destination
    const mergeTween = gsap.to(src, {
      x: dst.x,
      y: dst.y,
      scaleX: 0.8,
      scaleY: 0.8,
      alpha: 0,
      duration: MERGE_ANIMATION_DURATION,
      ease: EASING.EASE_IN,
      onComplete: () => {
        // Animate destination tile pulse
        animateDestinationPulse(dst).then(() => {
          src._isBeingMerged = false;
          dst._isBeingMerged = false;
          resolve();
        });
      }
    });
    
    // Store tween for potential cleanup
    (src as any)._mergeTween = mergeTween;
  });
}

/**
 * Animate wild merge effect
 */
export function animateWildMergeEffect(src: Tile, dst: Tile): Promise<void> {
  return new Promise((resolve) => {
    if (!src || !dst) {
      resolve();
      return;
    }
    
    logger.info(`🌟 Animating wild merge effect: ${src.value} -> ${dst.value}`);
    
    // Mark as being merged
    src._isBeingMerged = true;
    dst._isBeingMerged = true;
    
    // Create wild effect timeline
    const tl = gsap.timeline();
    
    // Animate source tile with wild effects
    tl.to(src, {
      x: dst.x,
      y: dst.y,
      scaleX: 0.9,
      scaleY: 0.9,
      duration: WILD_MERGE_DURATION * 0.6,
      ease: EASING.EASE_IN
    })
    .to(src, {
      alpha: 0,
      duration: WILD_MERGE_DURATION * 0.4,
      ease: EASING.EASE_IN
    }, "-=0.2")
    .call(() => {
      // Animate destination tile with wild effects
      animateWildDestinationPulse(dst).then(() => {
        src._isBeingMerged = false;
        dst._isBeingMerged = false;
        resolve();
      });
    });
    
    // Store timeline for potential cleanup
    (src as any)._wildMergeTween = tl;
  });
}

/**
 * Animate destination tile pulse
 */
function animateDestinationPulse(tile: Tile): Promise<void> {
  return new Promise((resolve) => {
    if (!tile || !tile.rotG) {
      resolve();
      return;
    }
    
    const pulseTween = gsap.fromTo(tile.rotG,
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
    
    // Store tween for potential cleanup
    (tile as any)._pulseTween = pulseTween;
  });
}

/**
 * Animate wild destination tile pulse
 */
function animateWildDestinationPulse(tile: Tile): Promise<void> {
  return new Promise((resolve) => {
    if (!tile || !tile.rotG) {
      resolve();
      return;
    }
    
    const wildPulseTween = gsap.fromTo(tile.rotG,
      { scaleX: 1, scaleY: 1, rotation: 0 },
      {
        scaleX: 1.3,
        scaleY: 1.3,
        rotation: 0.1,
        duration: 0.15,
        ease: EASING.EASE_OUT,
        yoyo: true,
        repeat: 2,
        onComplete: () => {
          // Reset rotation
          gsap.to(tile.rotG, {
            rotation: 0,
            duration: 0.1,
            ease: EASING.EASE_OUT,
            onComplete: resolve
          });
        }
      }
    );
    
    // Store tween for potential cleanup
    (tile as any)._wildPulseTween = wildPulseTween;
  });
}

/**
 * Animate score increase
 */
export function animateScoreIncrease(scoreGain: number): Promise<void> {
  return new Promise((resolve) => {
    logger.info(`💰 Animating score increase: +${scoreGain}`);
    
    // Implement score animation
    const scoreElement = document.getElementById('score-value');
    if (scoreElement) {
      gsap.fromTo(scoreElement, {
        scale: 1,
        alpha: 1
      }, {
        scale: 1.2,
        alpha: 0.8,
        duration: SCORE_ANIMATION_DURATION / 2,
        yoyo: true,
        repeat: 1,
        ease: EASING.EASE_OUT
      });
    }
  });
}

/**
 * Animate combo increase
 */
export function animateComboIncrease(combo: number): Promise<void> {
  return new Promise((resolve) => {
    logger.info(`🔥 Animating combo increase: ${combo}`);
    
    // Implement combo animation
    const comboElement = document.getElementById('combo-value');
    if (comboElement) {
      gsap.fromTo(comboElement, {
        scale: 1,
        alpha: 1
      }, {
        scale: 1.3,
        alpha: 0.7,
        duration: COMBO_ANIMATION_DURATION / 2,
        yoyo: true,
        repeat: 1,
        ease: EASING.EASE_OUT
      });
    }
  });
}

/**
 * Animate board shake
 */
export function animateBoardShake(intensity: number = 1): Promise<void> {
  return new Promise((resolve) => {
    logger.info(`🌍 Animating board shake: intensity ${intensity}`);
    
    // Implement board shake animation
    const boardElement = document.getElementById('board');
    if (boardElement) {
      gsap.fromTo(boardElement, {
        x: 0,
        y: 0
      }, {
        x: 5,
        y: 5,
        duration: BOARD_SHAKE_DURATION / 4,
        yoyo: true,
        repeat: 3,
        ease: EASING.EASE_OUT
      });
    }
  });
}

/**
 * Animate tile spawn
 */
export function animateTileSpawn(tile: Tile): Promise<void> {
  return new Promise((resolve) => {
    if (!tile) {
      resolve();
      return;
    }
    
    logger.info(`Animating tile spawn: ${tile.value}`, 'merge-animations');
    
    // Mark as being spawned
    tile._isBeingSpawned = true;
    
    // Start from scaled down
    gsap.set(tile, { 
      scaleX: 0, 
      scaleY: 0, 
      alpha: 0 
    });
    
    // Animate in
    const spawnTween = gsap.to(tile, {
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 0.3,
      ease: EASING.EASE_BACK,
      onComplete: () => {
        tile._isBeingSpawned = false;
        resolve();
      }
    });
    
    // Store tween for potential cleanup
    (tile as any)._spawnTween = spawnTween;
  });
}

/**
 * Animate tile destroy
 */
export function animateTileDestroy(tile: Tile): Promise<void> {
  return new Promise((resolve) => {
    if (!tile) {
      resolve();
      return;
    }
    
    logger.info(`💥 Animating tile destroy: ${tile.value}`);
    
    // Mark as being destroyed
    tile._isBeingDestroyed = true;
    
    const destroyTween = gsap.to(tile, {
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
 * Animate tile bounce
 */
export function animateTileBounce(tile: Tile): Promise<void> {
  return new Promise((resolve) => {
    if (!tile) {
      resolve();
      return;
    }
    
    logger.info(`🏀 Animating tile bounce: ${tile.value}`);
    
    const bounceTween = gsap.fromTo(tile.scale,
      { x: 1, y: 1 },
      {
        x: 1.1,
        y: 1.1,
        duration: TILE_BOUNCE_DURATION,
        ease: EASING.EASE_OUT,
        yoyo: true,
        repeat: 1,
        onComplete: () => {
          tile.scale.set(1, 1);
          resolve();
        }
      }
    );
    
    // Store tween for potential cleanup
    (tile as any)._bounceTween = bounceTween;
  });
}

/**
 * Animate tile wobble
 */
export function animateTileWobble(tile: Tile): Promise<void> {
  return new Promise((resolve) => {
    if (!tile) {
      resolve();
      return;
    }
    
    logger.info(`🌀 Animating tile wobble: ${tile.value}`);
    
    const wobbleTween = gsap.fromTo(tile,
      { rotation: 0 },
      {
        rotation: 0.1,
        duration: 0.15,
        ease: EASING.EASE_OUT,
        yoyo: true,
        repeat: 1,
        onComplete: () => {
          tile.rotation = 0;
          resolve();
        }
      }
    );
    
    // Store tween for potential cleanup
    (tile as any)._wobbleTween = wobbleTween;
  });
}

/**
 * Kill all animations for tile
 */
export function killTileAnimations(tile: Tile): void {
  if (!tile) return;
  
  const tweens = [
    (tile as any)._mergeTween,
    (tile as any)._wildMergeTween,
    (tile as any)._pulseTween,
    (tile as any)._wildPulseTween,
    (tile as any)._spawnTween,
    (tile as any)._destroyTween,
    (tile as any)._bounceTween,
    (tile as any)._wobbleTween
  ];
  
  tweens.forEach(tween => {
    if (tween && tween.kill) {
      tween.kill();
    }
  });
  
  // Clear references
  delete (tile as any)._mergeTween;
  delete (tile as any)._wildMergeTween;
  delete (tile as any)._pulseTween;
  delete (tile as any)._wildPulseTween;
  delete (tile as any)._spawnTween;
  delete (tile as any)._destroyTween;
  delete (tile as any)._bounceTween;
  delete (tile as any)._wobbleTween;
}

// All functions are already exported individually above