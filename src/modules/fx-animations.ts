// fx-animations.ts
// Animation effects for tiles and screen

import { Container, Graphics, Text, Texture, Sprite } from 'pixi.js';
import { gsap } from 'gsap';

// Type definitions
interface Tile extends Container {
  rotG?: Container;
  base?: Sprite;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  zIndex?: number;
  special?: string;
  isWildFace?: boolean;
  isWild?: boolean;
  _lastVelX?: number;
  _lastVelY?: number;
  _wildShimmer?: Container;
  _wildShimmerSprite?: Sprite;
  _wildIdleTl?: gsap.core.Timeline;
  _wildMask?: Graphics;
  getBounds?: () => { x: number; y: number; width: number; height: number };
  toGlobal?: (point: { x: number; y: number }) => { x: number; y: number };
}

interface Board extends Container {
  addChild: (child: Container) => Container;
  removeChild: (child: Container) => Container;
}

interface LandBounceOptions {
  strength?: number;
  duration?: number;
  ease?: string;
  delay?: number;
}

interface ScreenShakeOptions {
  intensity?: number;
  duration?: number;
  frequency?: number;
  direction?: 'horizontal' | 'vertical' | 'both';
}

/**
 * Land bounce animation for tile
 */
export function landBounce(tile: Tile, opts: LandBounceOptions = {}): void {
  if (!tile) return;
  
  const options: LandBounceOptions = {
    strength: 0.2,
    duration: 0.6,
    ease: "back.out(1.7)",
    delay: 0,
    ...opts
  };
  
  // Store original scale
  const originalScaleX = tile.scaleX || 1;
  const originalScaleY = tile.scaleY || 1;
  
  // Set initial scale
  tile.scaleX = originalScaleX * (1 - options.strength);
  tile.scaleY = originalScaleY * (1 - options.strength);
  
  // Animate bounce
  gsap.to(tile, {
    scaleX: originalScaleX,
    scaleY: originalScaleY,
    duration: options.duration,
    delay: options.delay,
    ease: options.ease
  });
}

/**
 * Screen shake effect
 */
export function screenShake(app: any, opts: ScreenShakeOptions = {}): void {
  if (!app || !app.stage) return;
  
  const options: ScreenShakeOptions = {
    intensity: 10,
    duration: 0.5,
    frequency: 20,
    direction: 'both',
    ...opts
  };
  
  const stage = app.stage;
  const originalX = stage.x;
  const originalY = stage.y;
  
  // Create shake animation
  const shakeTl = gsap.timeline();
  
  const shakeCount = Math.floor(options.duration * options.frequency);
  for (let i = 0; i < shakeCount; i++) {
    const progress = i / shakeCount;
    const intensity = options.intensity * (1 - progress); // Fade out
    
    let shakeX = 0;
    let shakeY = 0;
    
    if (options.direction === 'horizontal' || options.direction === 'both') {
      shakeX = (Math.random() - 0.5) * intensity * 2;
    }
    if (options.direction === 'vertical' || options.direction === 'both') {
      shakeY = (Math.random() - 0.5) * intensity * 2;
    }
    
    shakeTl.to(stage, {
      x: originalX + shakeX,
      y: originalY + shakeY,
      duration: 1 / options.frequency,
      ease: "none"
    });
  }
  
  // Return to original position
  shakeTl.to(stage, {
    x: originalX,
    y: originalY,
    duration: 0.1,
    ease: "power2.out"
  });
}

/**
 * Magic sparkles effect at tile
 */
export function magicSparklesAtTile(board: Board, tile: Tile, opts: any = {}): void {
  if (!tile || !board) return;
  
  const bounds = tile.getBounds?.() || { x: 0, y: 0, width: 96, height: 96 };
  const globalPos = tile.toGlobal?.({ x: 0, y: 0 }) || { x: bounds.x, y: bounds.y };
  
  // Create sparkles container
  const sparklesContainer = new Container();
  sparklesContainer.x = globalPos.x + bounds.width / 2;
  sparklesContainer.y = globalPos.y + bounds.height / 2;
  sparklesContainer.zIndex = 1000;
  
  // Create sparkles
  const sparkleCount = 12;
  for (let i = 0; i < sparkleCount; i++) {
    const sparkle = new Graphics();
    sparkle.fill({ color: 0xffffff, alpha: 0.9 })
      .star(0, 0, 4, 4, 8);
    
    // Random position around tile center
    const angle = (Math.PI * 2 * i) / sparkleCount;
    const distance = 30 + Math.random() * 20;
    sparkle.x = Math.cos(angle) * distance;
    sparkle.y = Math.sin(angle) * distance;
    sparkle.rotation = Math.random() * Math.PI * 2;
    sparkle.scaleX = sparkle.scaleY = 0.5 + Math.random() * 0.5;
    
    sparklesContainer.addChild(sparkle);
    
    // Animate sparkle
    gsap.fromTo(sparkle, 
      { alpha: 0, scaleX: 0, scaleY: 0 },
      { 
        alpha: 1, 
        scaleX: sparkle.scaleX, 
        scaleY: sparkle.scaleY, 
        duration: 0.3,
        ease: "power2.out"
      }
    );
    
    gsap.to(sparkle, {
      alpha: 0,
      scaleX: sparkle.scaleX * 1.5,
      scaleY: sparkle.scaleY * 1.5,
      duration: 0.8,
      delay: 0.2,
      ease: "power2.out"
    });
  }
  
  board.addChild(sparklesContainer);
  
  // Remove container after animation
  gsap.delayedCall(1.2, () => {
    if (board && sparklesContainer.parent) {
      board.removeChild(sparklesContainer);
    }
  });
}

// All functions are already exported individually above
