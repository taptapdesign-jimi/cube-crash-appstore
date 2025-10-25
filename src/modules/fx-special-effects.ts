// fx-special-effects.ts
// Special effects for wild tiles, multipliers, and smoke

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

interface WildImpactOptions {
  intensity?: number;
  duration?: number;
  color?: number;
  particles?: number;
}

interface WildIdleOptions {
  speed?: number;
  intensity?: number;
  color?: number;
  alpha?: number;
}

interface SmokeBubblesOptions {
  count?: number;
  size?: number;
  speed?: number;
  color?: number;
  alpha?: number;
}

/**
 * Show multiplier tile effect
 */
export function showMultiplierTile(
  board: Board, 
  tile: Tile, 
  mult: number = 2, 
  tileSize: number = 96, 
  life: number = 0.45
): void {
  if (!tile || !board) return;
  
  const bounds = tile.getBounds?.() || { x: 0, y: 0, width: tileSize, height: tileSize };
  const globalPos = tile.toGlobal?.({ x: 0, y: 0 }) || { x: bounds.x, y: bounds.y };
  
  // Create multiplier container
  const multContainer = new Container();
  multContainer.x = globalPos.x + bounds.width / 2;
  multContainer.y = globalPos.y + bounds.height / 2;
  multContainer.zIndex = 1000;
  
  // Create multiplier text
  const multText = new Text({
    text: `x${mult}`,
    style: {
      fontFamily: 'Arial',
      fontSize: 24,
      fill: 0xffff00,
      fontWeight: 'bold',
      stroke: 0x000000,
      strokeThickness: 2
    }
  });
  multText.anchor.set(0.5);
  
  multContainer.addChild(multText);
  board.addChild(multContainer);
  
  // Animate multiplier
  gsap.fromTo(multContainer, 
    { alpha: 0, scaleX: 0.5, scaleY: 0.5 },
    { 
      alpha: 1, 
      scaleX: 1.2, 
      scaleY: 1.2, 
      duration: 0.2,
      ease: "back.out(1.7)"
    }
  );
  
  gsap.to(multContainer, {
    alpha: 0,
    scaleX: 1.5,
    scaleY: 1.5,
    y: multContainer.y - 50,
    duration: life,
    delay: 0.2,
    ease: "power2.out",
    onComplete: () => {
      if (board && multContainer.parent) {
        board.removeChild(multContainer);
      }
    }
  });
}

/**
 * Smoke bubbles effect at tile
 */
export function smokeBubblesAtTile(
  board: Board, 
  tile: Tile, 
  tileSize: number = 96, 
  strength: number = 1, 
  maybeOpts: SmokeBubblesOptions | null = null
): void {
  if (!tile || !board) return;
  
  const opts: SmokeBubblesOptions = maybeOpts || {
    count: 8,
    size: 6,
    speed: 100,
    color: 0xcccccc,
    alpha: 0.6
  };
  
  const bounds = tile.getBounds?.() || { x: 0, y: 0, width: tileSize, height: tileSize };
  const globalPos = tile.toGlobal?.({ x: 0, y: 0 }) || { x: bounds.x, y: bounds.y };
  
  // Create smoke container
  const smokeContainer = new Container();
  smokeContainer.x = globalPos.x + bounds.width / 2;
  smokeContainer.y = globalPos.y + bounds.height / 2;
  smokeContainer.zIndex = 1000;
  
  // Create smoke bubbles
  for (let i = 0; i < opts.count * strength; i++) {
    const bubble = new Graphics();
    bubble.fill({ color: opts.color, alpha: opts.alpha })
      .circle(0, 0, opts.size * (0.5 + Math.random() * 0.5));
    
    // Random position around tile center
    const angle = Math.random() * Math.PI * 2;
    const distance = 10 + Math.random() * 20;
    bubble.x = Math.cos(angle) * distance;
    bubble.y = Math.sin(angle) * distance;
    
    smokeContainer.addChild(bubble);
    
    // Animate bubble
    gsap.fromTo(bubble, 
      { alpha: 0, scaleX: 0, scaleY: 0 },
      { 
        alpha: opts.alpha, 
        scaleX: 1, 
        scaleY: 1, 
        duration: 0.3,
        ease: "power2.out"
      }
    );
    
    gsap.to(bubble, {
      y: bubble.y - opts.speed * (1 + Math.random()),
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 1.0 + Math.random() * 0.5,
      ease: "power2.out"
    });
  }
  
  board.addChild(smokeContainer);
  
  // Remove container after animation
  gsap.delayedCall(1.5, () => {
    if (board && smokeContainer.parent) {
      board.removeChild(smokeContainer);
    }
  });
}

/**
 * Wild impact effect
 */
export function wildImpactEffect(tile: Tile, opts: WildImpactOptions = {}): void {
  if (!tile) return;
  
  const options: WildImpactOptions = {
    intensity: 1,
    duration: 0.8,
    color: 0xff6b6b,
    particles: 12,
    ...opts
  };
  
  // Create impact container
  const impactContainer = new Container();
  impactContainer.x = tile.x;
  impactContainer.y = tile.y;
  impactContainer.zIndex = 1000;
  
  if (tile.parent) {
    tile.parent.addChild(impactContainer);
  }
  
  // Create impact particles
  for (let i = 0; i < options.particles; i++) {
    const particle = new Graphics();
    particle.fill({ color: options.color, alpha: 0.8 })
      .circle(0, 0, 3);
    
    // Random position around tile center
    const angle = (Math.PI * 2 * i) / options.particles;
    const distance = 20 + Math.random() * 30;
    particle.x = Math.cos(angle) * distance;
    particle.y = Math.sin(angle) * distance;
    
    impactContainer.addChild(particle);
    
    // Animate particle
    gsap.fromTo(particle, 
      { alpha: 0, scaleX: 0, scaleY: 0 },
      { 
        alpha: 1, 
        scaleX: 1, 
        scaleY: 1, 
        duration: 0.2,
        ease: "power2.out"
      }
    );
    
    gsap.to(particle, {
      x: particle.x + (Math.random() - 0.5) * 100,
      y: particle.y + (Math.random() - 0.5) * 100,
      alpha: 0,
      scaleX: 0.5,
      scaleY: 0.5,
      duration: options.duration,
      ease: "power2.out"
    });
  }
  
  // Remove container after animation
  gsap.delayedCall(options.duration + 0.2, () => {
    if (impactContainer.parent) {
      impactContainer.parent.removeChild(impactContainer);
    }
  });
}

/**
 * Start wild idle animation
 */
export function startWildIdle(tile: Tile, opts: WildIdleOptions = {}): void {
  if (!tile) return;
  
  const options: WildIdleOptions = {
    speed: 2,
    intensity: 0.1,
    color: 0xffff00,
    alpha: 0.6,
    ...opts
  };
  
  // Stop existing idle animation
  if (tile._wildIdleTl) {
    tile._wildIdleTl.kill();
  }
  
  // Create shimmer effect
  if (!tile._wildShimmer) {
    tile._wildShimmer = new Container();
    tile._wildShimmer.zIndex = 1;
    tile.addChild(tile._wildShimmer);
  }
  
  // Create shimmer sprite
  if (!tile._wildShimmerSprite) {
    tile._wildShimmerSprite = new Sprite(Texture.WHITE);
    tile._wildShimmerSprite.width = tile.width || 96;
    tile._wildShimmerSprite.height = tile.height || 96;
    tile._wildShimmerSprite.tint = options.color;
    tile._wildShimmerSprite.alpha = options.alpha;
    tile._wildShimmer.addChild(tile._wildShimmerSprite);
  }
  
  // Create idle animation
  tile._wildIdleTl = gsap.timeline({ repeat: -1 });
  tile._wildIdleTl.to(tile._wildShimmerSprite, {
    alpha: options.alpha * 0.3,
    duration: options.speed,
    ease: "power2.inOut"
  });
  tile._wildIdleTl.to(tile._wildShimmerSprite, {
    alpha: options.alpha,
    duration: options.speed,
    ease: "power2.inOut"
  });
}

/**
 * Stop wild idle animation
 */
export function stopWildIdle(tile: Tile): void {
  if (!tile) return;
  
  // Stop idle animation
  if (tile._wildIdleTl) {
    tile._wildIdleTl.kill();
    tile._wildIdleTl = null;
  }
  
  // Hide shimmer effect
  if (tile._wildShimmer) {
    tile._wildShimmer.visible = false;
  }
}

// All functions are already exported individually above
