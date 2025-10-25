// fx-visual-effects.ts
// Visual effects for tiles (glass crack, wood shards, inner flash)

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

interface GlassCrackOptions {
  strength?: number;
  duration?: number;
  color?: number;
  alpha?: number;
}

interface WoodShardsOptions {
  count?: number;
  size?: number;
  speed?: number;
  rotation?: number;
  color?: number;
  alpha?: number;
}

interface InnerFlashOptions {
  intensity?: number;
  duration?: number;
  color?: number;
  alpha?: number;
}

/**
 * Glass crack effect at tile
 */
export function glassCrackAtTile(
  board: Board, 
  tile: Tile, 
  tileSize: number = 96, 
  strength: number = 1
): void {
  if (!tile || !board) return;
  
  const bounds = tile.getBounds?.() || { x: 0, y: 0, width: tileSize, height: tileSize };
  const globalPos = tile.toGlobal?.({ x: 0, y: 0 }) || { x: bounds.x, y: bounds.y };
  
  // Create glass crack container
  const crackContainer = new Container();
  crackContainer.x = globalPos.x;
  crackContainer.y = globalPos.y;
  crackContainer.zIndex = 1000;
  
  // Create crack graphics
  const crack = new Graphics();
  crack.stroke({ width: 2 * strength, color: 0xffffff, alpha: 0.8 });
  
  // Draw random crack lines
  const crackCount = Math.floor(3 + Math.random() * 4) * strength;
  for (let i = 0; i < crackCount; i++) {
    const startX = Math.random() * tileSize;
    const startY = Math.random() * tileSize;
    const endX = Math.random() * tileSize;
    const endY = Math.random() * tileSize;
    
    crack.moveTo(startX, startY);
    crack.lineTo(endX, endY);
  }
  
  crackContainer.addChild(crack);
  board.addChild(crackContainer);
  
  // Animate crack
  gsap.fromTo(crack, 
    { alpha: 0, scaleX: 0.5, scaleY: 0.5 },
    { 
      alpha: 1, 
      scaleX: 1, 
      scaleY: 1, 
      duration: 0.1,
      ease: "power2.out"
    }
  );
  
  // Fade out and remove
  gsap.to(crackContainer, {
    alpha: 0,
    duration: 0.8,
    delay: 0.2,
    ease: "power2.out",
    onComplete: () => {
      if (board && crackContainer.parent) {
        board.removeChild(crackContainer);
      }
    }
  });
}

/**
 * Wood shards effect at tile
 */
export function woodShardsAtTile(
  board: Board, 
  tile: Tile, 
  opts: WoodShardsOptions | boolean = {}
): void {
  if (!tile || !board) return;
  
  const options: WoodShardsOptions = typeof opts === 'boolean' 
    ? { count: 8, size: 4, speed: 200, rotation: 360, color: 0x8B4513, alpha: 0.8 }
    : { count: 8, size: 4, speed: 200, rotation: 360, color: 0x8B4513, alpha: 0.8, ...opts };
  
  const bounds = tile.getBounds?.() || { x: 0, y: 0, width: 96, height: 96 };
  const globalPos = tile.toGlobal?.({ x: 0, y: 0 }) || { x: bounds.x, y: bounds.y };
  
  // Create shards container
  const shardsContainer = new Container();
  shardsContainer.x = globalPos.x + bounds.width / 2;
  shardsContainer.y = globalPos.y + bounds.height / 2;
  shardsContainer.zIndex = 1000;
  
  // Create wood shards
  for (let i = 0; i < options.count; i++) {
    const shard = new Graphics();
    shard.fill({ color: options.color, alpha: options.alpha })
      .rect(0, 0, options.size, options.size);
    
    // Random position around tile center
    const angle = (Math.PI * 2 * i) / options.count + Math.random() * 0.5;
    const distance = 20 + Math.random() * 30;
    shard.x = Math.cos(angle) * distance;
    shard.y = Math.sin(angle) * distance;
    shard.rotation = Math.random() * Math.PI * 2;
    
    shardsContainer.addChild(shard);
    
    // Animate shard
    gsap.to(shard, {
      x: shard.x + (Math.random() - 0.5) * options.speed,
      y: shard.y + (Math.random() - 0.5) * options.speed,
      rotation: shard.rotation + options.rotation * (Math.PI / 180),
      alpha: 0,
      duration: 1.0 + Math.random() * 0.5,
      ease: "power2.out"
    });
  }
  
  board.addChild(shardsContainer);
  
  // Remove container after animation
  gsap.delayedCall(1.5, () => {
    if (board && shardsContainer.parent) {
      board.removeChild(shardsContainer);
    }
  });
}

/**
 * Inner flash effect at tile
 */
export function innerFlashAtTile(
  board: Board, 
  tile: Tile, 
  tileSize: number = 96, 
  intensity: number = 1
): void {
  if (!tile || !board) return;
  
  const bounds = tile.getBounds?.() || { x: 0, y: 0, width: tileSize, height: tileSize };
  const globalPos = tile.toGlobal?.({ x: 0, y: 0 }) || { x: bounds.x, y: bounds.y };
  
  // Create flash container
  const flashContainer = new Container();
  flashContainer.x = globalPos.x;
  flashContainer.y = globalPos.y;
  flashContainer.zIndex = 1000;
  
  // Create flash graphics
  const flash = new Graphics();
  flash.fill({ color: 0xffffff, alpha: 0.8 * intensity })
    .rect(0, 0, tileSize, tileSize);
  
  flashContainer.addChild(flash);
  board.addChild(flashContainer);
  
  // Animate flash
  gsap.fromTo(flash, 
    { alpha: 0, scaleX: 0.8, scaleY: 0.8 },
    { 
      alpha: 1, 
      scaleX: 1, 
      scaleY: 1, 
      duration: 0.1,
      ease: "power2.out"
    }
  );
  
  // Fade out and remove
  gsap.to(flashContainer, {
    alpha: 0,
    duration: 0.3,
    delay: 0.1,
    ease: "power2.out",
    onComplete: () => {
      if (board && flashContainer.parent) {
        board.removeChild(flashContainer);
      }
    }
  });
}

// All functions are already exported individually above
