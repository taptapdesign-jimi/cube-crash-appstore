// @ts-nocheck
// src/modules/fx.js
// Minimal FX surface used by app.js (stable named exports).

import { Container, Graphics, Text, Texture, Sprite } from 'pixi.js';
import { gsap } from 'gsap';

import { attachWildStarHalo, detachWildStarHalo, preloadWildStarTexture } from './wild-stars.js';
import { TILE } from './constants.js';
import { graphicsPool } from './object-pool.js';

try {
  preloadWildStarTexture();
} catch {}

export function startWildStars(tile){
  attachWildStarHalo(tile);
}

export function stopWildStars(tile){
  detachWildStarHalo(tile);
}

// 🔥 WILD-BEER: Continuous bubble animation system
const wildBeerBubbleSystems = new Map();

/**
 * Start continuous sparkling water bubbles for wild-beer tiles
 * Bubbles spawn from bottom, rise to top + 30%, max 40px, white/transparent
 */
export function startWildBeerBubbles(tile) {
  if (!tile || tile.special !== 'wild-beer') return;
  
  // Stop existing bubble system if any
  stopWildBeerBubbles(tile);
  
  const host = (tile.rotG || tile);
  if (!host) return;
  
  const container = new Container();
  container.name = 'wild-beer-bubbles';
  container.sortableChildren = false;
  container.zIndex = 2600; // Same z-index as wild stars
  container.visible = true;
  container.renderable = true;
  container.eventMode = 'none'; // Do not block pointer events
  // Disable child interactivity without TS cast (plain JS)
  try { container.interactiveChildren = false; } catch {}
  
  try {
    host.sortableChildren = true;
    host.addChild(container);
    host.sortChildren?.();
  } catch {
    container.destroy?.();
    return;
  }
  
  const system = {
    tile,
    host,
    container,
    spawnInterval: null,
    disposed: false,
    bubbles: []
  };
  
  try {
    wildBeerBubbleSystems.set(tile, system);
    tile._wildBeerBubbleSystem = system;
  } catch (error) {
    console.warn('⚠️ Error setting wild-beer bubble system:', error);
    return;
  }
  
  // Tile size reference (assuming standard tile size ~128px)
  const TILE_SIZE = 128;
  const tileHeight = TILE_SIZE;
  const maxRiseAbove = tileHeight * 0.30; // 30% above tile
  
  // Function to create and animate a single bubble
  const createBubble = () => {
    if (system.disposed || !container.parent) return;
    
    // 🔥 OBJECT POOLING: Use pool instead of creating new Graphics
    const bubble = graphicsPool.acquire();
    bubble.eventMode = 'none';
    bubble.cursor = 'default';
    
    // Random size, max 40px (15-40px for variation)
    const bubbleSize = 15 + Math.random() * 25; // 15-40px
    const radius = bubbleSize / 2;
    
    // Draw bubble as circle with highlight (sparkling water bubble effect)
    bubble.circle(0, 0, radius);
    bubble.fill({ color: 0xFFFFFF, alpha: 0.6 }); // White/transparent (sparkling water)
    
    // Add highlight (smaller circle at top-left) for 3D sparkling effect
    const highlightRadius = radius * 0.3;
    bubble.circle(-radius * 0.2, -radius * 0.2, highlightRadius);
    bubble.fill({ color: 0xFFFFFF, alpha: 0.8 });
    
    // Add subtle border for definition
    bubble.circle(0, 0, radius);
    bubble.stroke({ color: 0xFFFFFF, alpha: 0.4, width: 1 });
    
    // Start position: bottom of tile (relative to container, which is centered on tile)
    // Random horizontal position within tile width (±50% of tile width)
    const tileWidth = TILE_SIZE;
    const startX = (Math.random() - 0.5) * tileWidth * 0.8; // Random X within tile
    const startY = tileHeight / 2; // Bottom of tile (relative to container center)
    
    bubble.x = startX;
    bubble.y = startY;
    
    // Random starting scale (small, then grow as it rises)
    bubble.scale.set(0.2 + Math.random() * 0.2); // Start at 20-40% scale
    bubble.alpha = 0.7 + Math.random() * 0.3; // Start with 70-100% opacity
    
    // Add to container
    container.addChild(bubble);
    system.bubbles.push(bubble);
    
    // Animation: rise from bottom to top, then 30% above tile
    const totalRise = tileHeight + maxRiseAbove; // Full tile height + 30% above
    const endY = startY - totalRise; // Move up (negative Y, relative to container)
    
    // Slight horizontal drift (like real bubbles)
    const horizontalDrift = (Math.random() - 0.5) * 20; // ±10px horizontal drift
    const endX = startX + horizontalDrift;
    
    // Random duration for each bubble (0.8-1.5s)
    const duration = 0.8 + Math.random() * 0.7;
    
    // Grow slightly as it rises (like bubbles expanding)
    gsap.to(bubble.scale, {
      x: 0.6 + Math.random() * 0.4, // Grow to 60-100% of size
      y: 0.6 + Math.random() * 0.4,
      duration: duration * 0.3, // Grow in first 30% of animation
      ease: 'power2.out'
    });
    
    // Rise up smoothly (like sparkling water bubbles)
    gsap.to(bubble, {
      x: endX,
      y: endY,
      duration: duration,
      ease: 'power1.out', // Smooth upward motion
      onComplete: () => {
        // Pop/disappear at the end
        try {
          const idx = system.bubbles.indexOf(bubble);
          if (idx >= 0) system.bubbles.splice(idx, 1);
          if (container && container.children.includes(bubble)) {
            container.removeChild(bubble);
          }
          // 🔥 OBJECT POOLING: Release back to pool instead of destroying
          graphicsPool.release(bubble);
        } catch {}
      }
    });
    
    // Fade out as it reaches the top (last 40% of animation)
    gsap.to(bubble, {
      alpha: 0,
      duration: duration * 0.4,
      delay: duration * 0.6,
      ease: 'power2.in'
    });
  };
  
  // Spawn bubbles continuously (every 0.3-0.6 seconds)
  const spawnBubble = () => {
    if (system.disposed || !container.parent) return;
    createBubble();
    const nextDelay = 0.3 + Math.random() * 0.3; // 0.3-0.6s between bubbles
    system.spawnInterval = gsap.delayedCall(nextDelay, spawnBubble);
  };
  
  // Start spawning bubbles immediately and then continuously
  spawnBubble();
}

/**
 * Stop continuous bubble animation for wild-beer tiles
 */
export function stopWildBeerBubbles(tile) {
  if (!tile) return;
  
  let system = null;
  try {
    system = wildBeerBubbleSystems.get(tile);
    if (!system && tile._wildBeerBubbleSystem) {
      system = tile._wildBeerBubbleSystem;
    }
  } catch (error) {
    console.warn('⚠️ Error accessing wild-beer bubble system:', error);
    return;
  }
  
  if (!system) return;
  
  system.disposed = true;
  
  // Kill spawn interval
  if (system.spawnInterval) {
    try {
      system.spawnInterval.kill();
      system.spawnInterval = null;
    } catch {}
  }
  
  // Clean up all bubbles - kill all GSAP animations first
  if (system.bubbles) {
    system.bubbles.forEach(bubble => {
      try {
        // Kill all GSAP animations on bubble (position, scale, alpha)
        gsap.killTweensOf(bubble);
        gsap.killTweensOf(bubble.scale);
        gsap.killTweensOf(bubble.x);
        gsap.killTweensOf(bubble.y);
        gsap.killTweensOf(bubble.alpha);
        // Remove from parent before destroying
        if (bubble.parent) {
          bubble.parent.removeChild(bubble);
        }
        // 🔥 OBJECT POOLING: Release back to pool instead of destroying
        graphicsPool.release(bubble);
      } catch {}
    });
    system.bubbles = [];
  }
  
  // Remove container
  if (system.container && system.container.parent) {
    try {
      system.container.parent.removeChild(system.container);
    } catch {}
  }
  
  if (system.container) {
    try {
      system.container.destroy({ children: true });
    } catch {}
  }
  
  try {
    wildBeerBubbleSystems.delete(tile);
    if (tile._wildBeerBubbleSystem) {
      delete tile._wildBeerBubbleSystem;
    }
  } catch (error) {
    console.warn('⚠️ Error cleaning up wild-beer bubble system:', error);
  }
}

/* ---------- tiny helpers ---------- */
// 🔥 MEMORY LEAK FIX: Track all delayed calls globally so they can be killed on cleanup
const __globalDelayedCalls = new Set();

// 🔥 MEMORY LEAK FIX: Track all Graphics objects created for effects
const __globalGraphicsObjects = new Set();

// 🔥 PERFORMANCE OPTIMIZATION: Track active star particles for seamless cleanup (invisible to user)
const __activeStarParticles = new Set();
const MAX_ACTIVE_STARS = 30; // Only cleanup if we exceed this (very high threshold - user won't notice)

function autoAdd(parent, child, ttlSec = 0.8, options = {}){
  const before = options?.before ?? null;
  try {
    if (before && before.parent === parent){
      const idx = parent.getChildIndex(before);
      parent.addChildAt(child, Math.max(0, idx));
    } else {
      parent.addChild(child);
    }
  } catch {
    try { parent.addChild(child); } catch {}
  }
  if (ttlSec > 0){
    // 🔥 MEMORY LEAK FIX: Store delayed call reference and auto-cleanup
    const delayedCall = gsap.delayedCall(ttlSec, () => {
      try {
        // 🔥 MEMORY LEAK FIX: Kill all animations before destroying
        if (child._starAnimations && Array.isArray(child._starAnimations)) {
          child._starAnimations.forEach(anim => {
            try {
              if (anim && anim.kill) anim.kill();
            } catch {}
          });
          child._starAnimations = [];
        }
        
        // Kill all GSAP animations on child and its children
        gsap.killTweensOf(child);
        if (child.children) {
          child.children.forEach((c) => {
            try {
              gsap.killTweensOf(c);
              gsap.killTweensOf(c.x);
              gsap.killTweensOf(c.y);
              gsap.killTweensOf(c.alpha);
              gsap.killTweensOf(c.rotation);
              gsap.killTweensOf(c.scale);
              // Remove from tracker if it's a tracked object
              if (__globalGraphicsObjects.has(c)) {
                __globalGraphicsObjects.delete(c);
              }
            } catch {}
          });
        }
        
        parent.removeChild(child); 
        child.destroy?.({ children:true }); 
        __globalDelayedCalls.delete(delayedCall); // Remove from tracker
      } catch {}
    });
    __globalDelayedCalls.add(delayedCall);
    
    // 🔥 CRITICAL: If child is destroyed before timeout, kill the delayed call
    if (child && typeof child.on === 'function') {
      const cleanup = () => {
        if (delayedCall) {
          delayedCall.kill();
          __globalDelayedCalls.delete(delayedCall);
        }
      };
      try {
        child.once?.('destroyed', cleanup);
      } catch {}
    }
  }
}

// 🔥 MEMORY LEAK FIX: Global cleanup function to kill all pending delayed calls
export function killAllDelayedCalls() {
  console.log(`🧹 Killing ${__globalDelayedCalls.size} pending delayed calls`);
  __globalDelayedCalls.forEach(call => {
    try { call.kill(); } catch {}
  });
  __globalDelayedCalls.clear();
}

// 🔥 MEMORY LEAK FIX: Global cleanup function to destroy all Graphics objects
export function destroyAllGraphicsObjects() {
  console.log(`🧹 Destroying ${__globalGraphicsObjects.size} Graphics objects`);
  __globalGraphicsObjects.forEach(graphics => {
    try {
      if (graphics && graphics.parent) {
        graphics.parent.removeChild(graphics);
      }
      if (graphics && graphics.destroy) {
        graphics.destroy();
      }
    } catch {}
  });
  __globalGraphicsObjects.clear();
}

// Lightweight helper to trigger beer fizz immediately (standalone, no confetti reuse)
export function triggerBeerMergeFizz(board, tile) {
  try {
    if (!board || !tile) return;
    const { x, y } = centerInBoard(board, tile, 96);
    const layer = new Container();
    layer.x = x;
    layer.y = y;
    layer.zIndex = (tile?.zIndex ?? 0) + 0.002;
    layer.sortableChildren = true;
    autoAdd(board, layer, 1.6);
    createMerge6Bubbles(board, layer, x, y);
  } catch (error) {
    console.warn('⚠️ triggerBeerMergeFizz failed:', error);
  }
}

// Board-local center of a tile (robust against rotG wrappers)
export function centerInBoard(board, tile, tileSize = 96){
  if (!board || !tile) return { x:0, y:0 };
  // CRITICAL: Check if tile is destroyed before accessing properties
  if (tile.destroyed) {
    console.warn('⚠️ centerInBoard: Tile is destroyed, returning default position');
    return { x: 0, y: 0 };
  }
  
  // 🔥 CRITICAL: If tile has direct x/y coordinates and they're valid, use them directly
  // This avoids toGlobal/toLocal transformations which can cause offset issues
  if (typeof tile.x === 'number' && typeof tile.y === 'number' && Number.isFinite(tile.x) && Number.isFinite(tile.y)) {
    // Use tile.x/y directly (they're already in board coordinates and calculated correctly)
    // The tile object passed to woodShardsAtTile already has correct x/y from grid calculation
    return { x: tile.x, y: tile.y };
  }
  
  const node = tile.rotG || tile;
  try {
    const g = node.toGlobal({ x:0, y:0 });
    const result = board.toLocal(g);
    // 🔥 CRITICAL: Validate result is not NaN
    if (Number.isFinite(result.x) && Number.isFinite(result.y)) {
      return result;
    }
  } catch {}
  try {
    const b = tile.getBounds?.();
    if (b && Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.width) && Number.isFinite(b.height)) {
      const result = board.toLocal({ x:b.x + b.width/2, y:b.y + b.height/2 });
      if (Number.isFinite(result.x) && Number.isFinite(result.y)) {
        return result;
      }
    }
  } catch {}
  // 🔥 CRITICAL: Fallback to tile.x/y if they're valid numbers
  const fallbackX = typeof tile.x === 'number' && Number.isFinite(tile.x) ? tile.x : 0;
  const fallbackY = typeof tile.y === 'number' && Number.isFinite(tile.y) ? tile.y : 0;
  const result = {
    x: fallbackX + ((tile.width  ?? tileSize) / 2),
    y: fallbackY + ((tile.height ?? tileSize) / 2),
  };
  // 🔥 CRITICAL: Log warning if position is still invalid
  if (!Number.isFinite(result.x) || !Number.isFinite(result.y)) {
    console.warn('⚠️ centerInBoard: Invalid position calculated, using board center', { tileX: tile.x, tileY: tile.y, result });
    return { x: board.width / 2 || 0, y: board.height / 2 || 0 };
  }
  return result;
}

/* ---------- Dramatic explosion effects for wild merges ---------- */
export function glassCrackAtTile(board, tile, tileSize = 96, strength = 1){
  if (!board || !tile) return;
  const { x, y } = centerInBoard(board, tile, tileSize);
  const layer = new Container();
  layer.x = x; layer.y = y;
  layer.zIndex = 9995;
  autoAdd(board, layer, 1.2);

  // Create multiple crack lines radiating out - reduced by 50%
  const crackCount = Math.round((8 + strength * 4) * 0.5); // 50% reduction
  const maxLength = tileSize * (0.8 + strength * 0.4) * 0.5; // 50% reduction

  for (let i = 0; i < crackCount; i++) {
    const angle = (i / crackCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const length = maxLength * (0.6 + Math.random() * 0.4);

    const crack = new Graphics();
    crack.moveTo(0, 0)
         .lineTo(Math.cos(angle) * length, Math.sin(angle) * length)
         .stroke({ color: 0xFFFFFF, width: (2 + strength) * 0.5, alpha: 0.9 }); // 50% thinner

    crack.alpha = 0;
    layer.addChild(crack);

    // Animate crack appearance
    gsap.to(crack, { alpha: 0.9, duration: 0.1, delay: i * 0.01 });
    gsap.to(crack, { alpha: 0, duration: 0.3, delay: 0.2 + i * 0.01 });
  }
}

export function magicSparklesAtTile(board, tile, opts = {}){
  if (!board || !tile) return;

  // Use custom position if provided (for hero image on slide), otherwise use tile center
  let x, y;
  if (opts.customPosition) {
    x = opts.customPosition.x;
    y = opts.customPosition.y;
  } else {
    const center = centerInBoard(board, tile, 96);
    x = center.x;
    y = center.y;
  }
  
  const intensity = opts.intensity ?? 1.0; // Default intensity 1.0 (100%)
  const shardCount = Math.max(1, Math.round(20 * intensity)); // Scale shard count by intensity (20% = 4 shards)
  const baseTile = Math.max(60, Math.min(200, opts.tileSize ?? 96));
  
  // 🔥 CRITICAL: For wild-magnet, add red color #F26034 to sparkles
  const isWildMagnet = tile?.special === 'wild-magnet';
  const baseColors = [0xF4EEE7, 0xFBE3C5, 0xECD7C2, 0xE5C7AD, 0xFADEC0];
  const colors = isWildMagnet ? [...baseColors, 0xF26034] : baseColors; // Add red color for wild-magnet
  
  for (let i = 0; i < shardCount; i++) {
    // 🔥 OBJECT POOLING: Use pool instead of creating new Graphics
    const shard = graphicsPool.acquire();
    
    // 🔥 MEMORY LEAK FIX: Track Graphics object
    __globalGraphicsObjects.add(shard);
    
    // Wild cube shard colors (with red for wild-magnet)
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    // Size multiplier support (200x for magnet particles)
    const sizeMultiplier = opts.sizeMultiplier ?? 1;
    
    // Much larger rectangular shards - highly visible, scaled by multiplier
    const baseWidth = 12 + Math.random() * 12; // 12-24px base
    const baseHeight = 16 + Math.random() * 16; // 16-32px base
    const width = baseWidth * sizeMultiplier; // Scale by multiplier (200x for magnet)
    const height = baseHeight * sizeMultiplier; // Scale by multiplier (200x for magnet)
    
    // Use intensity directly as opacity (65% = 0.65)
    const alpha = intensity; // Direct opacity value (0.65 for 65%)
    
    shard.rect(-width/2, -height/2, width, height)
         .fill({ color: color, alpha: alpha }); // Scale opacity by intensity
    
    // 🔥 CRITICAL: Set eventMode to 'none' to prevent particles from blocking touch events
    // This is especially important for wild-magnet idle particles that spawn continuously
    shard.eventMode = 'none';
    shard.cursor = 'default';
    try { shard.interactiveChildren = false; } catch {}
    
    // Random position around tile - wider emission
    const angle = Math.random() * Math.PI * 2;
    const distance = baseTile * (0.1 + Math.random() * 0.6); // Wider spawn range (0.1-0.7x tile size)
    
    shard.x = x + Math.cos(angle) * distance;
    shard.y = y + Math.sin(angle) * distance;
    shard.rotation = Math.random() * Math.PI * 2;
    
    // 🔥 Z-INDEX: Set z-index if provided in opts (for logo smoke to appear above logo, or behind tile)
    // For idle particles, use lower z-index to ensure they don't block tile interaction
    if (opts.zIndex != null) {
      shard.zIndex = opts.zIndex;
    } else {
      // Default z-index for particles (above tiles normally, but below interactive elements)
      // Use tile's zIndex + small offset to ensure particles are visible but don't block interaction
      const tileZ = tile?.zIndex ?? 0;
      shard.zIndex = tileZ + 0.001; // Just above tile, but low enough to not block interaction
    }
    
    board.addChild(shard);
    
    // Sort children to ensure correct zIndex order
    try {
      board.sortChildren?.();
    } catch {}
    
    // Stronger movement - more visible trail
    const endAngle = angle + (Math.random() - 0.5) * 1.0; // Wider spread
    const endDistance = distance * (1.5 + Math.random() * 0.5); // Further movement
    const endX = x + Math.cos(endAngle) * endDistance;
    const endY = y + Math.sin(endAngle) * endDistance;
    
    gsap.to(shard, {
      x: endX,
      y: endY,
      rotation: shard.rotation + (Math.random() - 0.5) * Math.PI * 2,
      alpha: 0,
      duration: 0.5 + Math.random() * 0.4, // Slower fade for more visibility
      ease: 'power1.out', // Constant speed for trailing
      onComplete: () => {
        try {
          if (shard && shard.parent) {
            shard.parent.removeChild(shard);
          }
          // 🔥 MEMORY LEAK FIX: Remove from tracker
          __globalGraphicsObjects.delete(shard);
          // 🔥 OBJECT POOLING: Release back to pool instead of destroying
          graphicsPool.release(shard);
        } catch (err) {
          // Ignore cleanup errors
        }
      }
    });
  }
}

/**
 * 🔥 CENTRAL: Determines merge 6 shard configuration based on src and dst tiles
 * This function is the single source of truth for shard colors
 * @param {Object} src - Source tile (can be null/undefined for pulled tiles merge)
 * @param {Object} dst - Destination tile (can be null/undefined)
 * @returns {Object} Config with { isWild, isWildMagnet, shardColor }
 */
function getMerge6ShardConfig(src, dst) {
  // 🔥 CRITICAL: Check both src and dst for special properties
  // Handle both snapshot objects ({ special: 'wild' }) and live tile objects
  const srcSpecial = src?.special;
  const dstSpecial = dst?.special;
  
  // 🔥 CRITICAL: Explicitly check for wild-magnet FIRST (before wild)
  const srcIsWildMagnet = srcSpecial === 'wild-magnet';
  const dstIsWildMagnet = dstSpecial === 'wild-magnet';
  const isWildMagnet = srcIsWildMagnet || dstIsWildMagnet;

  // 🔥 CRITICAL: Check both src and dst for wild (not wild-magnet)
  // If either src or dst is wild (and not wild-magnet), then it's a wild merge
  const srcIsWild = srcSpecial === 'wild' && !srcIsWildMagnet;
  const dstIsWild = dstSpecial === 'wild' && !dstIsWildMagnet;
  const isWild = srcIsWild || dstIsWild;

  // Determine shard color
  const yellowColor = 0xFFCB47; // Yellow (#FFCB47) for wild-only
  const redColor = 0xF26034;    // Red (#F26034) for wild-magnet
  const brownColor = 0xD4A584;   // Brown (#D4A584) for regular merge 6

  let shardColor = brownColor;
  if (isWildMagnet) {
    shardColor = redColor; // Wild-magnet → red
  } else if (isWild) {
    shardColor = yellowColor; // Wild-only → yellow
  }
  // Otherwise: regular merge 6 → brown (default)

  // 🔥 DEBUG: Log configuration for troubleshooting
  console.log('🔥 getMerge6ShardConfig:', {
    srcSpecial,
    dstSpecial,
    srcIsWild,
    dstIsWild,
    isWild,
    srcIsWildMagnet,
    dstIsWildMagnet,
    isWildMagnet,
    shardColor: shardColor.toString(16)
  });

  return {
    isWild,
    isWildMagnet,
    shardColor,
    isRegular: !isWild && !isWildMagnet
  };
}

/**
 * 🔥 WRAPPER: Spawns shards for merge 6 with correct colors based on src/dst
 * This is the bulletproof function that should be called for all merge 6 shards
 * @param {Object} board - Board container
 * @param {Object} src - Source tile snapshot for special detection (can be null for pulled tiles merge)
 * @param {Object} dstLive - Live destination tile for position calculation
 * @param {Object} dstSnapshot - Destination tile snapshot for special detection (optional, falls back to dstLive)
 * @param {Object} opts - Additional options (count, intensity, etc.)
 */
export function spawnMerge6Shards(board, src, dstLive, dstSnapshot = null, opts = {}) {
  if (!board || !dstLive) {
    console.warn('⚠️ spawnMerge6Shards: Missing board or dstLive', { board: !!board, dstLive: !!dstLive });
    return;
  }

  // 🔥 CRITICAL: Use dstSnapshot for special detection if provided, otherwise use dstLive
  // This ensures we get the correct special property even if dstLive is destroyed
  const dstForSpecial = dstSnapshot || dstLive;

  // Get shard config from src/dst snapshots
  const config = getMerge6ShardConfig(src, dstForSpecial);
  console.log('🔥 spawnMerge6Shards config:', {
    srcSpecial: src?.special,
    dstSpecial: dstForSpecial?.special,
    isWild: config.isWild,
    isWildMagnet: config.isWildMagnet,
    shardColor: config.shardColor
  });

  // Prepare opts for woodShardsAtTile
  const shardOpts = {
    enhanced: true,
    wild: config.isWild || config.isWildMagnet, // true if wild or wild-magnet
    wildMagnet: config.isWildMagnet, // true only if wild-magnet
    ...opts // Override with any passed options
  };

  // 🔥 CRITICAL: Use live dstLive for position calculation (has x, y, gridX, gridY)
  // but config from snapshots for correct special detection
  woodShardsAtTile(board, dstLive, shardOpts);
}

/* ---------- Regular merge 6 shards (NEW, SEPARATE FUNCTION) ---------- */
export function regularMerge6Shards(board, tile, opts = {}){
  if (!board || !tile) {
    console.warn('⚠️ regularMerge6Shards: Missing board or tile', { board: !!board, tile: !!tile });
    return;
  }

  // 🔥 CRITICAL: Use direct position if tile is a snapshot object, otherwise use centerInBoard
  let x, y;
  if (tile.x !== undefined && tile.y !== undefined) {
    // Tile is a snapshot object with direct x/y coordinates
    x = tile.x;
    y = tile.y;
  } else {
    // Tile is a live tile object - use centerInBoard
    const pos = centerInBoard(board, tile, 96);
    x = pos.x;
    y = pos.y;
  }
  
  // Create layer
  const layer = new Container();
  layer.x = x;
  layer.y = y;
  layer.visible = true;
  layer.alpha = 1.0;
  layer.zIndex = opts.zIndex ?? 9993; // High zIndex to ensure visibility (below multiplier 10000)
  
  // Add to board IMMEDIATELY (don't wait for autoAdd delay)
  board.addChild(layer);
  
  // Sort children to ensure correct zIndex order
  try {
    board.sortChildren?.();
  } catch {}
  
  // Auto-remove after TTL
  const ttl = opts.ttl ?? 1.6;
  gsap.delayedCall(ttl, () => {
    try {
      if (layer && layer.parent === board) {
        board.removeChild(layer);
      }
      layer.destroy?.({ children: true });
    } catch {}
  });
  
  // Shard parameters - 200% larger (2x zoom, reduced from 4x) OR custom from opts
  const shardCount = opts.count ?? 13;
  const brownColor = 0xD4A584; // Brown color
  const yellowColor = 0xFFCB47; // Yellow (#FFCB47) for wild-only
  const isWildOnly = opts.isWildOnly === true; // Flag to use yellow/brown colors
  const baseTile = 96;
  const sizeMultiplier = opts.sizeMultiplier ?? 2.4; // Default 240% larger (20% increase from 2.0), can be overridden
  const distanceMultiplier = opts.distanceMultiplier ?? 5.6; // Default 560% larger distance (40% increase from 4.0), can be overridden
  const minDistance = (baseTile * 0.08) * distanceMultiplier;
  const maxDistance = (baseTile * 0.24) * distanceMultiplier;
  
  // Create shards
  for (let i = 0; i < shardCount; i++) {
    // 🔥 OBJECT POOLING: Use pool instead of creating new Graphics
    const shard = graphicsPool.acquire();
    
    // Shard size - 200% larger (2x, reduced from 4x)
    const baseSize = (8 + Math.random() * 10) * sizeMultiplier; // 16-36px (was 32-72px, reduced by 50%)
    const width = baseSize;
    const height = width * (0.8 + Math.random() * 1.4);
    
    // Create irregular polygon shape
    const points = [];
    const numPoints = 4 + Math.floor(Math.random() * 4); // 4-7 points
    
    for (let j = 0; j < numPoints; j++) {
      const angle = (j / numPoints) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
      const radius = (0.3 + Math.random() * 0.7) * Math.min(width, height) / 2;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      points.push(px, py);
    }
    
    // Determine shard color - yellow/brown for wild-only, brown for regular
    let shardColor = brownColor;
    if (isWildOnly) {
      // Wild-only: 50% yellow, 50% brown
      shardColor = Math.random() < 0.5 ? yellowColor : brownColor;
    }
    
    // Draw shard
    try {
      shard.poly(points).fill({ color: shardColor, alpha: 1.0 });
    } catch (e) {
      // Fallback to rect
      shard.clear();
      const size = Math.max(4, Math.max(...points.map((p, i) => Math.abs(p))) * 2);
      shard.rect(-size/2, -size/2, size, size).fill({ color: shardColor, alpha: 1.0 });
    }
    
    // Position and rotation
    shard.rotation = Math.random() * Math.PI;
    shard.x = 0;
    shard.y = 0;
    shard.alpha = 1.0;
    
    // Add to layer
    layer.addChild(shard);
    
    // Animation parameters
    const angle = Math.random() * Math.PI * 2;
    const distance = minDistance + Math.random() * (maxDistance - minDistance);
    // 🔥 50% wider horizontal spread (1.5x in width)
    const endX = Math.cos(angle) * distance * 1.5;
    const endY = Math.sin(angle) * distance;
    
    // 🔥 SPEED UP: 50% faster travel duration if fastFadeOut is enabled
    const travelDurMultiplier = opts.travelDurMultiplier ?? 1.0;
    const baseTravelDur = 0.42 + Math.random() * 0.18; // 0.42-0.60s
    const travelDur = baseTravelDur * travelDurMultiplier; // 50% faster = 0.21-0.30s
    
    const spin = (Math.random() - 0.5) * Math.PI * 2;
    
    // 🔥 INSTANT FADE-OUT: Start fading immediately with staggered timing
    const fastFadeOut = opts.fastFadeOut === true;
    const fadeDelayMultiplier = opts.fadeDelayMultiplier ?? 1.0;
    const staggerDelay = fastFadeOut ? (i * 0.01) : 0; // 10ms stagger between shards for procedural fade
    
    // Start fade-out animation immediately (procedural, one by one)
    if (fastFadeOut) {
      gsap.delayedCall(staggerDelay, () => {
        // Start fading out immediately after a short delay
        const fadeStartDelay = travelDur * 0.3; // Start fading 30% into travel
        const fadeDuration = travelDur * 0.4; // Fade over 40% of travel duration
        
        gsap.delayedCall(fadeStartDelay, () => {
          gsap.to(shard, {
            alpha: 0,
            duration: fadeDuration,
            ease: 'power2.in'
          });
        });
      });
    }
    
    // Animate shard
    gsap.to(shard, {
      x: endX,
      y: endY,
      rotation: shard.rotation + spin,
      duration: travelDur,
      ease: 'power3.out',
      onComplete: () => {
        // 🔥 SPEED UP: 90% faster fade delay (instant or very fast)
        const baseFadeDelay = 0.03 + Math.random() * 0.06; // 0.03-0.09s
        const fadeDelay = baseFadeDelay * fadeDelayMultiplier; // 0.003-0.009s (instant)
        
        gsap.delayedCall(fadeDelay, () => {
          try {
            if (layer && layer.children.includes(shard)) {
              layer.removeChild(shard);
            }
            // 🔥 OBJECT POOLING: Release back to pool instead of destroying
            graphicsPool.release(shard);
          } catch {}
        });
      }
    });
  }
  
  // NO STARS for regular merge 6 (ordinary + ordinary)
}

export function woodShardsAtTile(board, tile, opts = {}){
  if (!board || !tile) {
    console.warn('⚠️ woodShardsAtTile: Missing board or tile', { board: !!board, tile: !!tile });
    return;
  }

  if (typeof opts === 'boolean') {
    opts = opts ? { enhanced: true } : {};
  }

  const { x, y } = centerInBoard(board, tile, 96);
  
  // 🔥 CRITICAL: Validate position is not NaN
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    console.error('❌ woodShardsAtTile: Invalid position from centerInBoard', { x, y, tileX: tile.x, tileY: tile.y, gridX: tile.gridX, gridY: tile.gridY });
    return;
  }
  
  console.log('🔥 woodShardsAtTile: Creating shards at position', x, y, 'tile position:', tile.x, tile.y, 'grid:', tile.gridX, tile.gridY);
  
  const wildMode = opts.wild === true;
  const enhanced = opts.enhanced ?? (wildMode || false);
  const isWildBeerMerge = tile?.special === 'wild-beer' || opts.isWildBeer === true;

  const layer = new Container();
  layer.x = x; layer.y = y;
  layer.visible = true; // 🔥 CRITICAL: Ensure layer is visible
  layer.alpha = 1.0; // 🔥 CRITICAL: Ensure layer has full alpha
  const tileZ = tile?.zIndex ?? 0;
  const behind = opts.behind ?? false;
  // 🔥 CRITICAL: Check if this is wild-magnet (red-brown shards) - should use high zIndex
  const isWildMagnetShards = opts.wildMagnet === true;
  // 🔥 CRITICAL: If zIndex is explicitly provided in opts, use it (for settings screen overlay)
  if (opts.zIndex != null) {
    layer.zIndex = opts.zIndex;
  } else if (wildMode && !isWildMagnetShards) {
    layer.zIndex = tileZ - 0.002; // sit behind smoke/flash for wild mode (but not wild-magnet)
  } else {
    layer.zIndex = behind ? tileZ - 0.001 : 9993; // High zIndex for regular merge 6 and wild-magnet
  }


  // Extend layer lifetime for wild-beer so bubble animation can finish (spawnDuration ~2.7s)
  const ttlBase = opts.ttl ?? (wildMode ? 0.9 : 1.6);
  const ttl = isWildBeerMerge ? Math.max(ttlBase, 3.6) : ttlBase;
  autoAdd(board, layer, ttl, behind ? { before: tile } : undefined);
  
  // 🔥 CRITICAL: Verify layer was added to board
  if (!layer.parent) {
    console.error('❌ woodShardsAtTile: Layer was not added to board!', { board, layer, tile });
    try {
      board.addChild(layer);
      console.log('✅ woodShardsAtTile: Manually added layer to board');
    } catch (err) {
      console.error('❌ woodShardsAtTile: Failed to manually add layer to board', err);
      return;
    }
  }
  
  // 🔥 CRITICAL: Verify layer is visible and has correct position
  console.log('🔥 woodShardsAtTile: Layer added to board', {
    layerX: layer.x,
    layerY: layer.y,
    layerVisible: layer.visible,
    layerAlpha: layer.alpha,
    layerZIndex: layer.zIndex,
    layerParent: !!layer.parent,
    boardChildren: board.children.length
  });
  
  const intensity = opts.intensity ?? (enhanced ? 1.35 : 1.0);
  const countBase = opts.count ?? (enhanced ? 18 : 12);
  const shardCountRaw = Math.max(6, Math.round(countBase * intensity));
  const shardCount = wildMode
    ? Math.max(14, Math.round(shardCountRaw * 0.8))
    : Math.round(shardCountRaw);
  const spread = opts.spread ?? (enhanced ? 1.4 : 1.0);
  const baseTile = Math.max(60, Math.min(200, opts.tileSize ?? 96));
  // 🔥 CRITICAL: Check if this is pulled tiles merge 6 (explicit flag)
  const isPulledTilesMerge = opts.pulledTilesMerge === true;
  // 🔥 CRITICAL FIX: For regular merge, use larger radiusBoost to ensure shards are visible
  // Regular merge shards were too small (0.5) - increase to 1.0 to match wild-magnet visibility
  const radiusBoost = wildMode ? 1.25 : 1.0; // 🔥 FIXED: Regular merge now uses 1.0 instead of 0.5
  // 🔥 CRITICAL FIX: For very large sizeMul (pulled tiles merge 6), use much larger distances
  const sizeMul = (opts.size ?? opts.sizeBoost ?? (enhanced ? 1.3 : 1.2)); // 🔥 FIXED: Regular merge now uses 1.2 instead of 1.0
  // 🔥 CRITICAL: For pulled tiles merge 6, force sizeMul to be used directly (don't let it be overridden)
  // For pulled tiles merge 6, use opts.size directly (450) but scale it down for reasonable rendering
  // 450 / 30 = 15, which is still 10x larger than 1.5 (wild-magnet merge 6)
  const finalSizeMul = isPulledTilesMerge && opts.size ? (opts.size / 30) : sizeMul;
  // If sizeMul is very large (e.g., 450 for pulled tiles merge 6), scale distances accordingly
  const distanceMultiplier = finalSizeMul > 1 ? (finalSizeMul * 3) : 1.0; // Scale distances for very large shards
  const minDistance = (opts.minDistance ?? (wildMode ? baseTile * 0.2 : baseTile * 0.08)) * spread * radiusBoost * distanceMultiplier;
  const maxDistanceBase = opts.maxDistance ?? (wildMode ? baseTile * 1.1 : (enhanced ? baseTile * 0.24 : baseTile * 0.2));
  const maxDistance = maxDistanceBase * spread * radiusBoost * distanceMultiplier;
  const speed = Math.max(0.2, opts.speed ?? 1.0);
  const vanishDelay = opts.vanishDelay ?? (wildMode ? 0 : 0);
  const vanishJitter = opts.vanishJitter ?? (wildMode ? 0.02 : 0.06);

  // 🔥 CRITICAL: Determine shard color based on opts.wildMagnet and opts.wild
  // Priority: opts flags FIRST (explicit), then tile.special (fallback)
  // This ensures explicit flags ALWAYS override tile.special
  let isWildMagnet = false;
  let isWildOnly = false;
  
  // Step 1: Check opts.wildMagnet FIRST (explicit override)
  if (opts.wildMagnet === true) {
    isWildMagnet = true;
  } else if (opts.wildMagnet === false) {
    // Explicitly NOT wild-magnet, even if tile.special is 'wild-magnet'
    isWildMagnet = false;
  } else {
    // opts.wildMagnet not set, fallback to tile.special
    isWildMagnet = tile?.special === 'wild-magnet';
  }
  
  // Step 2: Check opts.wild SECOND (explicit override)
  if (opts.wild === true && !isWildMagnet) {
    // Explicitly wild, but not wild-magnet
    isWildOnly = true;
  } else if (opts.wild === false) {
    // Explicitly NOT wild
    isWildOnly = false;
  } else if (!isWildMagnet && (tile?.special === 'wild' || tile?.special === 'wild-beer')) {
    // opts.wild not set, fallback to tile.special (but only if not wild-magnet)
    isWildOnly = true;
  }
  
  const yellowColor = 0xFFCB47; // Yellow (#FFCB47) for wild-only (wild star and wild-beer)
  const redColor = 0xF26034;    // Red (#F26034) for wild-magnet
  const brownColor = 0xD4A584;  // Brown (#D4A584) for regular merge 6

  // Determine base shard color
  let baseShardColor = brownColor; // Default: brown
  if (isWildMagnet) {
    baseShardColor = redColor; // Wild-magnet → red
  } else if (isWildOnly) {
    baseShardColor = yellowColor; // Wild-only (star and wild-beer) → yellow
  }

  const emitShard = (distance, angle, scaleFactor = 1, alpha = 1.0, speedMul = 1, shardIndex = 0) => {
    // 🔥 OBJECT POOLING: Use pool instead of creating new Graphics
    const shard = graphicsPool.acquire();
    
    // CRITICAL: Clear graphics before drawing (ensures clean state)
    // Note: graphicsPool.acquire() already calls clear(), but we keep this for safety
    shard.clear();
    
    // 🔥 CRITICAL FIX: For regular merge, use larger base size to ensure visibility
    // Regular merge shards were too small - increase base size
    // 🔥 CRITICAL: If sizeMul is very large (e.g., 450 for pulled tiles merge 6), use much larger base
    // Use finalSizeMul (which respects pulledTilesMerge flag) instead of sizeMul
    let base;
    if (finalSizeMul > 10 || isPulledTilesMerge) {
      // For very large sizeMul (pulled tiles merge 6), use much larger base to ensure visibility
      // For pulled tiles merge 6, use larger base (40-80) to ensure visibility
      base = wildMode ? (40 + Math.random() * 40) : (50 + Math.random() * 50); // 40-80 for wildMode, 50-100 for regular
    } else {
      base = wildMode ? (6 + Math.random() * 8) : (8 + Math.random() * 10); // 🔥 FIXED: Regular merge uses larger base (8-18 vs 6-14)
    }
    const width = base * finalSizeMul * scaleFactor;
    const height = width * (0.8 + Math.random() * 1.4); // More variation in height

    // Create irregular vector-like shape instead of rectangle
    const points = [];
    const numPoints = 4 + Math.floor(Math.random() * 4); // 4-7 points for irregular shape

    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
      const radius = (0.3 + Math.random() * 0.7) * Math.min(width, height) / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      points.push(x, y);
    }

    // 🔥 CRITICAL: For wild-magnet, randomly mix red and brown (50/50)
    // For wild-only (wild star and wild-beer), randomly mix yellow and brown (50/50)
    // For regular, use only brown
    let shardColor = baseShardColor;
    if (isWildMagnet) {
      // Wild-magnet: 50% red, 50% brown
      shardColor = Math.random() < 0.5 ? redColor : brownColor;
    } else if (isWildOnly) {
      // Wild-only (star and wild-beer): 50% yellow, 50% brown (same for both)
      shardColor = Math.random() < 0.5 ? yellowColor : brownColor;
    }
    // Otherwise: use baseShardColor (brown for regular)

    // CRITICAL FIX: PixiJS v8+ uses .poly() instead of .drawPolygon()
    try {
      shard.poly(points).fill({ color: shardColor, alpha });
    } catch (e) {
      // Fallback to rect if polygon fails
      try {
        shard.clear();
        const maxRadius = Math.max(8, Math.max(...points.map((p, i) => Math.abs(p))));
        const shardSize = Math.max(4, maxRadius * 2);
        shard.rect(-shardSize/2, -shardSize/2, shardSize, shardSize)
             .fill({ color: shardColor, alpha });
      } catch (e2) {
        // Last resort: simple rect
        shard.clear();
        shard.rect(-4, -4, 8, 8).fill({ color: shardColor, alpha });
      }
    }

    shard.rotation = Math.random() * Math.PI;
    shard.x = 0;
    shard.y = 0;
    shard.alpha = alpha;
    layer.addChild(shard);

    const dist = Math.max(minDistance, Math.min(maxDistance, distance)) * (1 + (Math.random() - 0.5) * 0.15);
    const endX = Math.cos(angle) * dist;
    const endY = Math.sin(angle) * dist;

    const travelBase = wildMode ? 0.28 : 0.42;
    const travelVar  = wildMode ? 0.18 : 0.18;
    const baseTravelDur = (travelBase + Math.random() * travelVar) * (1 / (speed * speedMul));
    
    // 🔥 SPEED UP: Apply travelDurMultiplier if fastFadeOut is enabled
    const travelDurMultiplier = opts.travelDurMultiplier ?? 1.0;
    const travelDur = baseTravelDur * travelDurMultiplier;
    
    const spin = (Math.random() - 0.5) * Math.PI * 2 * intensity;
    
    // 🔥 INSTANT FADE-OUT: Start fading immediately with staggered timing
    const fastFadeOut = opts.fastFadeOut === true;
    const fadeDelayMultiplier = opts.fadeDelayMultiplier ?? 1.0;
    const staggerDelay = fastFadeOut ? (shardIndex * 0.01) : 0; // 10ms stagger between shards for procedural fade
    
    // Start fade-out animation immediately (procedural, one by one)
    if (fastFadeOut) {
      gsap.delayedCall(staggerDelay, () => {
        // Start fading out immediately after a short delay
        const fadeStartDelay = travelDur * 0.3; // Start fading 30% into travel
        const fadeDuration = travelDur * 0.4; // Fade over 40% of travel duration
        
        gsap.delayedCall(fadeStartDelay, () => {
          gsap.to(shard, {
            alpha: 0,
            duration: fadeDuration,
            ease: 'power2.in'
          });
        });
      });
    }

    gsap.to(shard, {
      x: endX,
      y: endY,
      rotation: shard.rotation + spin,
      duration: travelDur,
      ease: 'power3.out',
      onComplete: () => {
        // 🔥 SPEED UP: Apply fadeDelayMultiplier for faster fade delay
        const baseFadeDelay = vanishDelay + Math.random() * Math.max(0, vanishJitter);
        const fadeDelay = baseFadeDelay * fadeDelayMultiplier;
        
        gsap.delayedCall(fadeDelay, () => {
          try {
            if (layer && layer.children.includes(shard)) {
              layer.removeChild(shard);
            }
            // 🔥 OBJECT POOLING: Release back to pool instead of destroying
            graphicsPool.release(shard);
          } catch {}
        });
      }
    });
  };


  for (let i = 0; i < shardCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    let distance;
    let scale = 1;
    let alpha = 0.92;
    let speedMul = 1;

    if (wildMode) {
      // Uniform distribution like confetti - no clustering, reduced spread
      distance = minDistance + Math.random() * (maxDistance - minDistance);
      scale = 1.2 + Math.random() * 2.4; // Much larger scale variation (2-4x bigger)
      alpha = 0.85 + Math.random() * 0.12;
      speedMul = 0.8 + Math.random() * 0.7;

      // Add extra shards for more confetti effect (reduced probability)
      if (Math.random() < 0.25) { // Reduced from 0.45 to 0.25
        const extraDistance = minDistance + Math.random() * (maxDistance - minDistance);
        const extraAngle = angle + (Math.random() - 0.5) * 0.8; // More angle variation
        emitShard(extraDistance, extraAngle, scale * 0.6, alpha * 0.9, speedMul * 1.25, i);
      }
    } else {
      // 🔥 CRITICAL FIX: For regular merge, use full alpha (1.0) and larger scale to ensure visibility
      distance = minDistance + Math.random() * (maxDistance - minDistance);
      alpha = 1.0; // 🔥 FIXED: Regular merge uses full alpha (1.0) instead of 0.92
      // 🔥 CRITICAL: If sizeMul is very large (e.g., 450 for pulled tiles merge 6), use larger scale
      // This ensures shards are properly scaled when sizeMul is 300x larger
      // Use finalSizeMul (which respects pulledTilesMerge flag) instead of sizeMul
      if (finalSizeMul > 10 || isPulledTilesMerge) {
        // For very large sizeMul (pulled tiles merge 6), use much larger scale to ensure visibility
        // For pulled tiles merge 6, use larger scale (3.0-6.0) to ensure visibility
        scale = 3.0 + Math.random() * 3.0; // 3.0-6.0 for very large shards
      } else {
        scale = 1.0 + Math.random() * 0.5; // 🔥 FIXED: Regular merge uses larger scale (1.0-1.5) instead of 1.0
      }
    }

    emitShard(distance, angle, scale, alpha, speedMul, i);
  }
  
  // Generate 3 stars ONLY for wild-only merge (wild + ordinary or ordinary + wild)
  // NOT for wild-magnet merge, regular merge, or any other case
  // isWildOnly is determined above based on opts.wild and opts.wildMagnet
  // 🔥 WILD-BEER SPECIAL: Use bubbles instead of stars for wild-beer merge
  // Check both tile.special and opts.isWildBeer (passed from merge function)
  const isWildBeer = isWildBeerMerge;
  console.log('💧 Stars/Bubbles check:', { 
    isWildOnly, 
    isWildMagnet, 
    isWildBeer, 
    tileSpecial: tile?.special, 
    optsIsWildBeer: opts.isWildBeer,
    optsWild: opts.wild,
    optsWildMagnet: opts.wildMagnet
  });
  if (isWildOnly && !isWildMagnet) {
    if (isWildBeer) {
      // Wild-beer: skip local fizz here to avoid double wave; handled by triggerBeerMergeFizz/explosion
      console.log('💧 Skipping local merge6 bubbles for wild-beer (handled elsewhere)');
    } else {
      // Regular wild: 3 stars
      console.log('⭐ Creating regular wild stars at position:', x, y);
      createMerge6Stars(board, layer, x, y);
    }
  } else {
    console.log('💧 Skipping stars/bubbles:', { isWildOnly, isWildMagnet, isWildBeer });
  }
}

/**
 * Create sparkling water bubbles for wild-beer merge 6 effect
 * Bubbles rise from bottom of tile to top, max 30% above tile, white/transparent, max 40px size
 */
function createMerge6Bubbles(board, layer, centerX, centerY) {
  try {
  console.log('💧 createMerge6Bubbles (beer fizz) triggered');
  
  const screenH = typeof window !== 'undefined' ? window.innerHeight : 800;
  // Longer fizz: ~2.5s total emission
  const spawnDuration = 2400 + Math.random() * 300; // ~2.4-2.7s
  const totalBubbles = 32 + Math.floor(Math.random() * 12); // 32-43 bubbles
  const bubblesPerMs = totalBubbles / spawnDuration;
  
  // Ensure layer never blocks pointer interactions
  layer.eventMode = 'none';
  try { layer.interactiveChildren = false; } catch {}
    
    let spawned = 0;
    let startTime = performance.now();
    let lastTickTime = startTime;
    let accumulator = 0;
    
      const makeBubble = () => {
      if (spawned >= totalBubbles) return;
      spawned++;
      
      // 🔥 OBJECT POOLING: Use pool instead of creating new Graphics
      const bubble = graphicsPool.acquire();
      bubble.eventMode = 'none';
      bubble.cursor = 'default';
      
      // Size mix: 12-36px
      const bubbleSize = 12 + Math.random() * 24;
      const radius = bubbleSize / 2;
      
      bubble.circle(0, 0, radius);
      bubble.fill({ color: 0xFFFFFF, alpha: 0.6 });
      const highlightRadius = radius * 0.3;
      bubble.circle(-radius * 0.2, -radius * 0.2, highlightRadius);
      bubble.fill({ color: 0xFFFFFF, alpha: 0.8 });
      bubble.circle(0, 0, radius);
      bubble.stroke({ color: 0xFFFFFF, alpha: 0.4, width: 1 });
      
      // Origin: just below tile bottom (layer-local)
      // 🔥 FIX: Use TILE constant instead of undefined tileWidth/tileHeight
      const startX = (Math.random() - 0.5) * TILE * 0.7;
      const startY = TILE * 0.5 + (5 + Math.random() * 10); // 5-15px below tile bottom
      bubble.x = startX;
      bubble.y = startY;
      
      // Initial state
      bubble.scale.set(0.25 + Math.random() * 0.25);
      bubble.alpha = 0.75 + Math.random() * 0.25;
      layer.addChild(bubble);
      
      // Rise off-screen
      const riseDistance = startY + screenH * (0.9 + Math.random() * 0.15); // 90-105% of screen height added
      const endY = startY - riseDistance;
      
      // Wobble
      const wobbleAmp = 10 + (bubbleSize / 36) * 18; // ~10-28px
      const wobbleSpeed = 1.0 + Math.random() * 1.6; // 1.0-2.6 cycles
      const wobblePhase = Math.random() * Math.PI * 2;
      const wobblePhase2 = Math.random() * Math.PI * 2;
      const wobbleSpeed2 = 0.5 + Math.random() * 0.9; // secondary drift
      
      // Duration: size-dependent, varied speeds, clamped 0.7-1.4s
      const baseDur = 0.8 + (bubbleSize / 36) * 0.6;
      const speedJitter = (Math.random() - 0.5) * 0.4; // ±0.2s jitter
      const duration = Math.min(1.4, Math.max(0.7, baseDur + speedJitter));
      
      const wobbleObj = { t: wobblePhase, t2: wobblePhase2 };
      const tl = gsap.timeline({
        onComplete: () => {
          try {
            if (layer && layer.children.includes(bubble)) {
              layer.removeChild(bubble);
            }
            // 🔥 OBJECT POOLING: Release back to pool instead of destroying
            graphicsPool.release(bubble);
          } catch {}
        }
      });
      
      // Wobble motion
      tl.to(wobbleObj, {
        t: wobblePhase + Math.PI * 2 * wobbleSpeed,
        t2: wobblePhase2 + Math.PI * 2 * wobbleSpeed2,
        duration,
        ease: 'none',
        onUpdate: () => {
          const offset = Math.sin(wobbleObj.t) * wobbleAmp + Math.sin(wobbleObj.t2) * (wobbleAmp * 0.35);
          bubble.x = startX + offset;
        }
      }, 0);
      
      // Rise + fade
      tl.to(bubble, {
        y: endY,
        duration,
        ease: 'sine.out'
      }, 0);
      
      tl.to(bubble.scale, {
        x: 0.6 + Math.random() * 0.4,
        y: 0.6 + Math.random() * 0.4,
        duration: duration * 0.35,
        ease: 'power2.out'
      }, 0);
      
      tl.to(bubble, {
        alpha: 0,
        duration: duration * 0.4,
        ease: 'power1.in'
      }, duration * 0.6);
    };
    
    const spawnTick = () => {
      const now = performance.now();
      const delta = now - lastTickTime;
      lastTickTime = now;
      const elapsed = now - startTime;
      
      accumulator += bubblesPerMs * delta;
      const toSpawn = Math.min(3, Math.floor(accumulator));
      if (toSpawn > 0) {
        accumulator -= toSpawn;
        for (let i = 0; i < toSpawn && spawned < totalBubbles; i++) {
          makeBubble();
        }
      }
      
      // Stop only after all bubbles emitted (no end flush, no early exit)
      if (spawned >= totalBubbles) {
        gsap.ticker.remove(spawnTick);
      }
    };
    
    // Start immediately on the merge frame with three instant bubbles to avoid any perceived delay
    makeBubble();
    makeBubble();
    makeBubble();
    gsap.ticker.add(spawnTick);
    spawnTick();
  } catch (error) {
    console.warn('⚠️ Failed to create merge 6 bubbles:', error);
  }
}

// --- Merge-6 wild-beer bubble explosion (organic drift) ---
let wildBeerExplosionContainer = null;
let wildBeerExplosionActive = false;
let wildBeerExplosionSpawnTick = null; // 🔥 CRITICAL: Store spawnTick reference for cleanup

export function cleanupWildBeerExplosion() {
  try {
    // 🔥 CRITICAL: Remove spawnTick from ticker FIRST to prevent new bubbles from spawning
    if (wildBeerExplosionSpawnTick) {
      try {
        gsap.ticker.remove(wildBeerExplosionSpawnTick);
      } catch {}
      wildBeerExplosionSpawnTick = null;
    }
    
    wildBeerExplosionActive = false;
    if (wildBeerExplosionContainer) {
      const container = wildBeerExplosionContainer;
      wildBeerExplosionContainer = null;
      const children = [...(container.children || [])];
      children.forEach((bubble) => {
        try {
          gsap.killTweensOf(bubble);
          gsap.killTweensOf(bubble.scale);
          gsap.killTweensOf(bubble.rotation);
          if (bubble && bubble.parent) bubble.parent.removeChild(bubble);
          // 🔥 OBJECT POOLING: Release back to pool instead of destroying
          graphicsPool.release(bubble);
        } catch {}
      });
      if (container.parent) container.parent.removeChild(container);
      container.destroy?.({ children: true });
    }
  } catch {}
}

export function isWildBeerExplosionRunning() {
  return wildBeerExplosionActive;
}

export function createWildBeerBubblesExplosion(board, tile) {
  console.log('💧 createWildBeerBubblesExplosion called!', {
    board: !!board,
    tile: !!tile,
    wildBeerExplosionActive,
    boardDestroyed: board?.destroyed,
    tileDestroyed: tile?.destroyed
  });
  
  if (!board || !tile) {
    console.warn('⚠️ createWildBeerBubblesExplosion: Missing board or tile', { board: !!board, tile: !!tile });
    return;
  }
  
  if (wildBeerExplosionActive) {
    console.warn('⚠️ createWildBeerBubblesExplosion: Already active, skipping duplicate trigger');
    return; // Guard duplicate triggers during same animation
  }

  cleanupWildBeerExplosion();

  // 🔥 CRITICAL: Get stage directly from window.STATE (most reliable method)
  const windowState = typeof window !== 'undefined' ? window.STATE : null;
  const stage = (windowState && windowState.stage) || 
                (windowState && windowState.app && windowState.app.stage) || 
                board.parent?.parent?.stage || 
                board.parent;
  
  console.log('💧 createWildBeerBubblesExplosion: Stage check', {
    windowState: !!windowState,
    stageFromState: !!(windowState && windowState.stage),
    stageFromApp: !!(windowState && windowState.app && windowState.app.stage),
    stageFromBoard: !!board.parent,
    stage: !!stage,
    stageType: stage ? stage.constructor?.name : 'null'
  });
  
  if (!stage) {
    console.error('❌ createWildBeerBubblesExplosion: No stage found! Cannot create bubbles.');
    console.error('❌ Debug info:', {
      windowState: !!windowState,
      windowStateStage: !!(windowState && windowState.stage),
      windowStateApp: !!(windowState && windowState.app),
      boardParent: !!board.parent,
      boardParentParent: !!board.parent?.parent
    });
    return;
  }
  
  console.log('💧 createWildBeerBubblesExplosion: Creating bubbles container...');

  const container = new Container();
  container.name = 'wild-beer-explosion-bubbles';
  container.zIndex = 10000;
  container.sortableChildren = true;
  container.eventMode = 'none'; // Allow dragging through overlay
  try { container.interactiveChildren = false; } catch {}
  stage.addChild(container);
  stage.sortChildren?.();

  wildBeerExplosionContainer = container;
  wildBeerExplosionActive = true;
  
  console.log('💧 createWildBeerBubblesExplosion: Container created and added to stage!', {
    container: !!container,
    stage: !!stage,
    containerParent: !!container.parent,
    wildBeerExplosionActive
  });

  const screenW = typeof window !== 'undefined' ? window.innerWidth : 800;
  const screenH = typeof window !== 'undefined' ? window.innerHeight : 600;

  // 🔥 PERFORMANCE OPTIMIZATION: Small initial burst (4 bubbles) to prevent FPS drop, then full 250 bubbles
  // Initial burst is small (4 bubbles staggered), but total is 250 for rich effect
  const totalBubbles = 250; // Full bubble count for rich effect
  const spawnDuration = 1800; // Slightly longer spawn duration for smoother distribution
  const maxActive = 120; // Increased from 80 to allow more bubbles, but still capped to prevent overload
  let active = 0;
  let spawned = 0;
  const perMs = totalBubbles / spawnDuration;
  let startTime = performance.now();
  let lastTick = startTime;
  let acc = 0;

  const makeBubble = () => {
    if (!wildBeerExplosionContainer || wildBeerExplosionContainer.destroyed) return;
    if (spawned >= totalBubbles || active >= maxActive) return;

    spawned += 1;
    active += 1;

    // 🔥 OBJECT POOLING: Use pool instead of creating new Graphics
    const bubble = graphicsPool.acquire();
    bubble.eventMode = 'none';
    bubble.cursor = 'default';
    const size = 14 + Math.random() * 34; // 14-48px
    const radius = size / 2;
    const alpha = 0.55 + Math.random() * 0.35;

    bubble.circle(0, 0, radius);
    bubble.fill({ color: 0xFFFFFF, alpha });
    bubble.circle(-radius * 0.25, -radius * 0.25, radius * 0.32);
    bubble.fill({ color: 0xFFFFFF, alpha: Math.min(1, alpha + 0.2) });
    bubble.circle(0, 0, radius);
    bubble.stroke({ color: 0xFFFFFF, alpha: alpha * 0.65, width: 1 });

    const startX = (Math.random() - 0.5) * screenW * 1.4 + screenW * 0.5;
    const startY = screenH * (0.95 + Math.random() * 0.2);
    bubble.x = startX;
    bubble.y = startY;
    bubble.alpha = alpha;
    bubble.scale.set(0.25 + Math.random() * 0.25);
    bubble.renderable = true;

    wildBeerExplosionContainer.addChild(bubble);

    const endY = -screenH * (0.1 + Math.random() * 0.15);
    // Faster rise so the entire burst finishes under ~3s
    const duration = Math.min(2.1, Math.max(1.1, 1.6 + (Math.random() - 0.5) * 0.6));

    const drift1 = (Math.random() - 0.5) * 180;
    const drift2 = drift1 * -0.6 + (Math.random() - 0.5) * 220;
    const drift3 = (Math.random() - 0.5) * 240;

    // 🔥 PERFORMANCE OPTIMIZATION: Use single timeline instead of multiple tweens
    // This reduces GSAP overhead and improves performance
    const finalScale = 0.65 + Math.random() * 0.35;
    const finalRotation = (Math.random() - 0.5) * Math.PI * 1.2;
    
    // Single timeline for all animations (more efficient than multiple tweens)
    const bubbleTl = gsap.timeline({
      onComplete: () => {
        try {
          if (bubble && bubble.parent) bubble.parent.removeChild(bubble);
          // 🔥 OBJECT POOLING: Release back to pool instead of destroying
          graphicsPool.release(bubble);
        } catch {}
        active = Math.max(0, active - 1);
      }
    });
    
    // Combine all animations into one timeline (reduces GSAP overhead)
    bubbleTl.to(bubble, {
      x: startX + drift1,
      y: endY * 0.3, // Start moving up
      duration: duration * 0.3,
      ease: 'sine.inOut'
    }).to(bubble, {
      x: startX + drift2,
      y: endY * 0.65,
      duration: duration * 0.35,
      ease: 'sine.inOut'
    }).to(bubble, {
      x: startX + drift3,
      y: endY,
      rotation: finalRotation,
      duration: duration * 0.35,
      ease: 'sine.inOut'
    }, '<'); // Start at same time as previous
    
    // Scale animation (separate for different timing)
    gsap.to(bubble.scale, {
      x: finalScale,
      y: finalScale,
      duration: duration * 0.45,
      ease: 'power1.out'
    });
    
    // Fade out (separate for different timing)
    gsap.to(bubble, {
      alpha: 0,
      duration: duration * 0.4,
      delay: duration * 0.6,
      ease: 'power2.in'
    });
  };

  const spawnTick = () => {
    if (!wildBeerExplosionContainer || wildBeerExplosionContainer.destroyed) {
      // 🔥 CRITICAL: Remove spawnTick from ticker when container is destroyed
      if (wildBeerExplosionSpawnTick === spawnTick) {
        gsap.ticker.remove(spawnTick);
        wildBeerExplosionSpawnTick = null;
      }
      cleanupWildBeerExplosion();
      return;
    }
    const now = performance.now();
    const dt = Math.max(1, now - lastTick);
    lastTick = now;
    const elapsed = now - startTime;

    if (elapsed >= spawnDuration && spawned >= totalBubbles) {
      // 🔥 CRITICAL: Remove spawnTick from ticker and clear reference
      if (wildBeerExplosionSpawnTick === spawnTick) {
        gsap.ticker.remove(spawnTick);
        wildBeerExplosionSpawnTick = null;
      }
      setTimeout(() => cleanupWildBeerExplosion(), 2400);
      return;
    }

    // 🔥 PERFORMANCE OPTIMIZATION: Throttle spawn rate to prevent FPS drop
    // Spawn max 2 bubbles per frame instead of 3
    acc += perMs * dt;
    const toSpawn = Math.min(2, Math.floor(acc)); // Reduced from 3 to 2
    if (toSpawn > 0) {
      acc -= toSpawn;
      for (let i = 0; i < toSpawn; i++) {
        makeBubble();
      }
    }
  };

  // 🔥 PERFORMANCE OPTIMIZATION: Reduced initial burst from 12 to 4 to prevent FPS drop
  // Stagger initial burst over 2 frames for smoother start
  for (let i = 0; i < 2; i++) {
    makeBubble();
  }
  // Spawn remaining initial bubbles after 1 frame to prevent initial FPS drop
  requestAnimationFrame(() => {
    if (wildBeerExplosionContainer && !wildBeerExplosionContainer.destroyed) {
      for (let i = 0; i < 2; i++) {
        makeBubble();
      }
    }
  });
  
  // 🔥 CRITICAL: Store spawnTick reference for cleanup
  wildBeerExplosionSpawnTick = spawnTick;
  gsap.ticker.add(spawnTick);
  spawnTick();
}

/**
 * Create 3 stars for merge 6 effect
 * Stars are 56-80px in size (random, each different), random positions, directions, and rotations
 */
// 🔥 PERFORMANCE OPTIMIZATION: Cache star texture to avoid reloading (seamless, invisible to user)
let _cachedStarTexture = null;
function getStarTexture() {
  if (!_cachedStarTexture) {
    _cachedStarTexture = Texture.from('./assets/small-star.png');
  }
  return _cachedStarTexture;
}

function createMerge6Stars(board, layer, centerX, centerY) {
  try {
    // 🔥 PERFORMANCE OPTIMIZATION: Use cached texture (seamless, invisible to user)
    const starTexture = getStarTexture();
    
    // 🔥 PERFORMANCE OPTIMIZATION: Seamless cleanup of old stars only if we exceed threshold (user won't notice)
    if (__activeStarParticles.size > MAX_ACTIVE_STARS) {
      // Kill oldest 10% of stars (seamless, happens only in extreme cases)
      const starsToKill = Math.floor(__activeStarParticles.size * 0.1);
      let killed = 0;
      for (const star of __activeStarParticles) {
        if (killed >= starsToKill) break;
        try {
          gsap.killTweensOf(star);
          gsap.killTweensOf(star.x);
          gsap.killTweensOf(star.y);
          gsap.killTweensOf(star.alpha);
          if (star.parent) star.parent.removeChild(star);
          __globalGraphicsObjects.delete(star);
          __activeStarParticles.delete(star);
          star.destroy();
          killed++;
        } catch {}
      }
    }
    
    // Store animations for proper cleanup
    const starAnimations = [];
    
    // Create 3 stars - each with random size, COMPLETELY RANDOM directions, and random position around tile
    for (let i = 0; i < 3; i++) {
      const star = new Sprite(starTexture);
      
      // 🔥 MEMORY LEAK FIX: Track Sprite object
      __globalGraphicsObjects.add(star);
      
      // 🔥 PERFORMANCE OPTIMIZATION: Track active star for seamless cleanup (invisible to user)
      __activeStarParticles.add(star);
      
      // Size: max 80px (reduced from 80-112px)
      const starSize = 40 + Math.random() * 40; // 40-80px (max 80px)
      star.width = starSize;
      star.height = starSize;
      star.anchor.set(0.5);
      
      // COMPLETELY RANDOM direction - each star goes in completely random direction (0-360 degrees)
      const angle = Math.random() * Math.PI * 2; // Completely random angle 0-360 degrees
      
      // Random distance from center (better spread around tile) - wider range for better distribution
      const distance = 20 + Math.random() * 60; // 20-80px from center (wider spread)
      star.x = Math.cos(angle) * distance;
      star.y = Math.sin(angle) * distance;
      
      // NO ROTATION - removed rotation animation
      star.rotation = 0;
      
      // Start with 100% opacity (no fade in)
      star.alpha = 1.0;
      
      // Add to layer
      layer.addChild(star);
      
      // Animate star flying away from center
      const travelDistance = 200 + Math.random() * 150; // 200-350px travel distance
      const travelAngle = angle; // Same direction as initial position
      const endX = centerX + Math.cos(travelAngle) * travelDistance;
      const endY = centerY + Math.sin(travelAngle) * travelDistance;
      // DOUBLE SLOWER: 1.6-2.4s (was 0.8-1.2s, now doubled)
      const travelDuration = 1.6 + Math.random() * 0.8; // 1.6-2.4s (doubled from 0.8-1.2s)
      
      // Animate position
      const positionTween = gsap.to(star, {
        x: endX,
        y: endY,
        duration: travelDuration,
        ease: 'power2.out',
        onComplete: () => {
          // 🔥 MEMORY LEAK FIX: Proper cleanup - kill all animations first, then destroy
          try {
            // Kill all GSAP animations on star
            gsap.killTweensOf(star);
            gsap.killTweensOf(star.x);
            gsap.killTweensOf(star.y);
            gsap.killTweensOf(star.alpha);
            
            // Remove from parent before destroying
            if (layer && layer.children.includes(star)) {
              layer.removeChild(star);
            }
            
            // Remove from trackers
            __globalGraphicsObjects.delete(star);
            __activeStarParticles.delete(star);
            
            // Destroy sprite
            star.destroy();
          } catch (err) {
            console.warn('⚠️ Error cleaning up star:', err);
          }
        }
      });
      starAnimations.push(positionTween);
      
      // NO ROTATION ANIMATION - removed completely
      
      // Fade out near the end - REDUCED BY 50% (was 0.3 duration, now 0.15)
      const fadeDuration = travelDuration * 0.15; // 50% reduced from 0.3 to 0.15
      const fadeDelay = travelDuration * 0.85; // Adjusted delay (was 0.7, now 0.85)
      const fadeTween = gsap.to(star, {
        alpha: 0,
        duration: fadeDuration,
        delay: fadeDelay,
        ease: 'power2.in'
      });
      starAnimations.push(fadeTween);
    }
    
    // Store animations reference for potential cleanup
    if (!layer._starAnimations) {
      layer._starAnimations = [];
    }
    layer._starAnimations.push(...starAnimations);
    
  } catch (error) {
    console.warn('⚠️ Error creating merge 6 stars:', error);
  }
}

export function innerFlashAtTile(board, tile, tileSize = 96, intensity = 1){
  if (!board || !tile) return;
  const { x, y } = centerInBoard(board, tile, tileSize);
  const flash = new Graphics();
  flash.x = x; flash.y = y;
  flash.zIndex = 10001;
  
  const radius = tileSize * (0.6 + intensity * 0.2);
  flash.circle(0, 0, radius)
       .fill({ color: 0xFFFFFF, alpha: 0.9 });
  
  flash.alpha = 0;
  flash.scale.set(0.2);
  autoAdd(board, flash, 0.8);
  
  // Dramatic flash animation
  gsap.to(flash, { alpha: 0.95, duration: 0.08, ease: 'power2.out' });
  gsap.to(flash.scale, { x: 1.0, y: 1.0, duration: 0.12, ease: 'back.out(2)' });
  gsap.to(flash, { alpha: 0, duration: 0.2, delay: 0.1, ease: 'power2.in' });
}

/* ---------- elastic settle when a tile lands/stack-places ---------- */
// Bigger, juicier "boing" for stack placements.
// Usage: FX.landBounce(tile) — app.js already calls this after merges < 6.
export function landBounce(tile, opts = {}){
  if (!tile) return;
  const g = tile.rotG || tile; // animate the visual group if present

  // Tunables (stronger than before, but still snappy)
  const amp     = opts.amp     ?? 0.14;                 // how much to squash/stretch (±14%)
  const tilt    = opts.tilt    ?? 0.055;                // playful tilt
  const durMain = opts.durMain ?? 0.34;                 // main elastic settle
  const easeOut = opts.easeOut ?? 'elastic.out(1, 0.6)';

  try { gsap.killTweensOf(g.scale); gsap.killTweensOf(g.rotation); } catch {}

  const sx = g.scale?.x ?? 1;
  const sy = g.scale?.y ?? 1;

  // 1) instant pre-impact micro-squash (feels like weight)
  gsap.set(g, { rotation: 0 });
  gsap.fromTo(
    g.scale,
    { x: sx * (1 + amp * 0.35), y: sy * (1 - amp * 0.6) },
    { x: sx * (1 - amp * 0.35), y: sy * (1 + amp), duration: 0.08, ease: 'power2.out' }
  );

  // 2) elastic settle back to 1:1 with a slight overshoot (big boing)
  gsap.to(g.scale, { x: sx, y: sy, duration: durMain, ease: easeOut, delay: 0.08 }); 

  // 3) gentle one-time tilt wiggle (no rapid shaking) 
  gsap.to(g, { rotation: (Math.random() < 0.5 ? -tilt : tilt), duration: 0.10, yoyo: true, repeat: 1, ease: 'sine.inOut', delay: 0.02 });

  // Optional tiny secondary bounce to feel "gummier"
  if (opts.secondary !== false){
    gsap.to(g.scale, {
      x: sx * (1 + amp * 0.10),
      y: sy * (1 - amp * 0.06),
      duration: 0.14,
      ease: 'sine.out',
      delay: 0.10
    });
    gsap.to(g.scale, { x: sx, y: sy, duration: 0.26, ease: 'elastic.out(1, 0.7)', delay: 0.18 });
  }
}

/* ---------- visible multiplier badge (x2, x3, …) ---------- */
export function showMultiplierTile(board, tile, mult = 2, tileSize = 96, life = 0.45){
  // exact center over the tile, in board-local space
  const { x, y } = centerInBoard(board, tile, tileSize);

  const c = new Container();
  c.x = x; c.y = y; c.zIndex = 10000; c.alpha = 0;
  autoAdd(board, c, Math.min(0.9, (life || 0.45) + 0.35)); 

  // When sitting over a Wild, switch to white badge for contrast.
  const overWild =
    !!(tile && (tile.special === 'wild' || tile.isWildFace === true || tile.isWild === true));

  const FILL   = overWild ? 0xFFFFFF : 0xAB806E; // white over wild, taupe otherwise
  const STROKE = overWild ? 0xE6DCD2 : 0xFAEDE0; // soft stroke
  const TXT    = overWild ? 0x6B5444 : 0xF5F5F5; // readable text
  const rr     = tileSize * 0.28;

  // disk + ring + soft outer halo
  const disk = new Graphics();
  disk.circle(0, 0, rr).fill({ color: FILL, alpha: 1.0 });
  c.addChild(disk);

  const ring = new Graphics();
  ring.circle(0, 0, rr).stroke({ color: STROKE, width: 1.4, alpha: 0.9 });

  const halo = new Graphics();
  halo.circle(0, 0, rr * 1.08).stroke({ color: STROKE, width: 3.0, alpha: 0.20 });
  c.addChild(halo, ring);

  const t = new Text({
    text: `×${mult}`,
    style: { fill: TXT, fontSize: Math.round(tileSize * 0.26), fontWeight: '800' }
  });
  t.anchor.set(0.5);
  c.addChild(t);

  // animation: elastic pop with subtle wiggle → brief hold → elastic shrink
  const tl = gsap.timeline();
  c.scale.set(0.12);
  const hold = Math.max(0.05, Math.min(0.14, (life || 0.45) - 0.30));
  
  // 🔥 CRITICAL: For wild-magnet pulled tiles merge, speed up multiplier appearance by 60%
  // Check if this is a wild-magnet merge by checking if tile has _wildMagnetSpeedUp flag
  const isWildMagnetMerge = tile?._wildMagnetSpeedUp === true;
  const multiplierDuration = isWildMagnetMerge ? 0.18 * 0.4 : 0.18; // 60% faster: 0.18s → 0.072s (≈0.08s)
  
  tl.to(c,       { alpha: 1,              duration: 0.06, ease: 'power2.out' }, 0)
    .to(c.scale, { x: 1.26, y: 1.26,     duration: multiplierDuration, ease: 'elastic.out(1, 0.55)' }, 0)
    .to(c.scale, { x: 1.00, y: 1.00,     duration: 0.10, ease: 'back.out(3)' }, '>-0.06')
    .to(c,       { rotation: 0.05,       duration: 0.08, ease:'sine.inOut', yoyo:true, repeat:1 }, '<')
    .to(c.scale, { x: 0.0,  y: 0.0,      duration: 0.22, ease: 'elastic.in(1, 0.6)' }, `+=${hold}`)
    .to(c,       { alpha: 0,             duration: 0.16, ease: 'power1.in' }, '<');
}

/* ---------- “book‑thud” cartoony dust burst for merge‑6 ---------- */
export function smokeBubblesAtTile(board, tile, tileSize = 96, strength = 1, maybeOpts = null){
  let options = {};
  let size = tileSize ?? 96;
  let power = strength ?? 1;

  if (tileSize && typeof tileSize === 'object') {
    options = { ...(tileSize ?? {}) };
    size = options.tileSize ?? 96;
    power = options.strength ?? options.power ?? 1;
  } else if (strength && typeof strength === 'object') {
    options = { ...(strength ?? {}) };
    power = options.strength ?? options.power ?? 1;
  } else if (maybeOpts && typeof maybeOpts === 'object') {
    options = { ...(maybeOpts ?? {}) };
  }

  if (options.tileSize != null) size = options.tileSize;
  if (options.strength != null) power = options.strength;

  const behind         = options.behind ?? false;
  const sizeScale      = options.sizeScale ?? 1;
  const distanceScale  = options.distanceScale ?? 1;
  const countScale     = options.countScale ?? 1;
  const insetScale     = options.insetScale ?? 1;
  const ttl            = options.ttl ?? 1.0;
  const blendMode      = options.blendMode ?? 'add';
  const bubbleAlpha    = options.baseAlpha ?? 1.0;
  const startScaleHint = options.startScale ?? null;

  const { x, y } = centerInBoard(board, tile, size);
  const layer = new Container();
  layer.x = x; layer.y = y;
  const tileZ = tile?.zIndex ?? 0;
  layer.zIndex = behind ? tileZ - 0.001 : (options.zIndex ?? 9990);
  autoAdd(board, layer, ttl, behind ? { before: tile } : undefined);

  const baseStrength = Math.max(0.4, power);
  const COUNT     = Math.max(6, Math.round((44 + Math.random()*14) * baseStrength * countScale));
  const BASE_R    = Math.max(6, Math.round(size * 0.051 * sizeScale)); // +50% larger base size
  const MAX_R     = Math.max(18, Math.round(size * 0.24 * sizeScale)); // +50% larger max size
  const INSET     = size * 0.02 * insetScale;
  const OUT_MIN   = size * 0.15 * distanceScale;
  const OUT_MAX   = size * 0.34 * distanceScale;
  const BURSTS    = options.bursts ?? 5;
  const BURST_GAP = options.burstGap ?? 0.035;

  const spawnOnSide = (side)=>{
    const half = size * 0.5;
    const along = (Math.random()*(size - INSET*2)) - (size/2 - INSET);
    if (side===0) return { sx: along,        sy: -half + INSET }; // top
    if (side===1) return { sx: +half - INSET, sy: along        }; // right
    if (side===2) return { sx: along,        sy: +half - INSET }; // bottom
    return              { sx: -half + INSET, sy: along        };   // left
  };

  for (let b=0; b<BURSTS; b++){
    const burstDelay = b * BURST_GAP;
    const perBurst   = Math.ceil(COUNT / BURSTS);

    for (let i=0; i<perBurst; i++){
      const puff = new Graphics();
      let r0 = BASE_R + Math.random() * (MAX_R - BASE_R);
      if (Math.random() < 0.22) r0 *= (1.35 + Math.random()*0.9);
      // Cap max radius to prevent oversized bubbles (especially for merge 6)
      const maxRadius = Math.min(MAX_R * 1.5, size * 0.18); // Cap at 18% of tile size
      r0 = Math.min(r0, maxRadius);
      
      // Random shape: circle or ellipse
      const isEllipse = Math.random() > 0.5;
      const aspectRatio = isEllipse ? (0.6 + Math.random() * 0.8) : 1; // 0.6-1.4 for ellipse
      const rx = r0;
      const ry = r0 * aspectRatio;
      
      // Random opacity variation
      const randomAlpha = bubbleAlpha * (0.7 + Math.random() * 0.6); // 70-130% of base alpha
      
      if (isEllipse) {
        // Ellipse shape for variety
        puff.ellipse(0, 0, rx, ry).fill({ color: 0xFFFFFF, alpha: randomAlpha });
      } else {
        // Circle shape
        puff.circle(0, 0, rx).fill({ color: 0xFFFFFF, alpha: randomAlpha });
      }
      
      puff.alpha = 0.0;
      puff.blendMode = blendMode;
      
      // Random rotation for ellipses
      if (isEllipse) {
        puff.rotation = Math.random() * Math.PI * 2;
      }
      
      layer.addChild(puff);

      const side = (i + b) % 4;
      const { sx, sy } = spawnOnSide(side);
      puff.x = sx; puff.y = sy;

      const normals = [
        { nx: 0,  ny: -1 },
        { nx: 1,  ny:  0 },
        { nx: 0,  ny:  1 },
        { nx: -1, ny:  0 },
      ];
      const { nx, ny } = normals[side];
      const baseAngle = Math.atan2(ny, nx);
      const spread = options.spread ?? 0.9;
      const theta = baseAngle + (Math.random() - 0.5) * spread;

      const distance = OUT_MIN + Math.random() * Math.max(0, OUT_MAX - OUT_MIN);
      const dx = sx + Math.cos(theta) * distance;
      const dy = sy + Math.sin(theta) * distance;

      const driftX = (Math.random()-0.5) * (size * 0.06 * distanceScale);
      const driftY = (Math.random()-0.5) * (size * 0.06 * distanceScale);

      const tIn   = 0.018 + Math.random()*0.022;
      const tRun  = 0.16  + Math.random()*0.12;
      const tHold = 0.02  + Math.random()*0.03;
      const tOut  = 0.08  + Math.random()*0.06;

      const startScale = startScaleHint != null ? startScaleHint : (0.65 + Math.random()*0.25) * Math.max(0.7, sizeScale);
      puff.scale.set(startScale);

      const stg = burstDelay + Math.random()*0.018;
      const tl = gsap.timeline({
        defaults: { overwrite: false },
        onComplete: ()=>{ try{ if(puff && puff.parent){ puff.parent.removeChild(puff); puff.destroy(); } }catch{} }
      });

      const targetAlpha = options.trailAlpha ?? 0.95;
      tl.to(puff, { alpha: targetAlpha, duration: tIn, ease: 'power2.out' }, stg)
        .to(puff, { x: dx + driftX, y: dy + driftY, duration: tRun, ease: 'sine.out' }, `>${0}`)
        .to(puff, { alpha: targetAlpha, duration: tHold, ease: 'none' }, `>${0}`)
        .to(puff, { alpha: 0, duration: tOut, ease: 'power1.in' }, `>${0}`);
    }
  }

  const halo = new Graphics();
  const haloScale = options.haloScale ?? 1;
  const rr = size * (0.22 + 0.05*baseStrength) * haloScale;
  halo.circle(0, 0, rr).fill({ color: 0xFFFFFF, alpha: 0.10 * (options.haloAlpha ?? 1) });
  halo.alpha = 0;
  layer.addChildAt(halo, 0);
  gsap.to(halo, { alpha: 0.22, duration: 0.08, ease: 'power2.out' });
  gsap.to(halo, { alpha: 0, duration: 0.28, delay: 0.18, ease: 'power2.in',
    onComplete: ()=>{ try{ layer.removeChild(halo); halo.destroy(); }catch{} }
  });
}

// Light smoke trail for drag effect (separate from smokeBubblesAtTile)
export function dragSmokeTrail(board, tile, tileSize = 96, strength = 1, opts = {}){
  if (!board || !tile) return;
  
  const count = Math.floor(19 + Math.random() * 11); // 19-30 particles (30% more: 14-23 -> 19-30)
  const { x, y } = centerInBoard(board, tile, tileSize);
  
  for (let i = 0; i < count; i++) {
    const puff = new Graphics();
    
    // Mix of small (3-6px), medium (4-10px), and large (5-13px) particles
    const rand = Math.random();
    let radius;
    if (rand < 0.33) {
      radius = 3 + Math.random() * 3; // Small: 3-6px
    } else if (rand < 0.66) {
      radius = 4 + Math.random() * 6; // Medium: 4-10px
    } else {
      radius = 5 + Math.random() * 8; // Large: 5-13px
    }
    // Mix of white and cream colors
    const colors = [0xFFFFFF, 0xECD7C2];
    const color = colors[Math.floor(Math.random() * colors.length)];
    puff.circle(0, 0, radius).fill({ color: color, alpha: 0.8 });
    puff.alpha = 0.8; // Set initial alpha to 0.8
    puff.x = x + (Math.random() - 0.5) * 80;  // Denser spawn radius: 80px
    puff.y = y + (Math.random() - 0.5) * 80;  // Denser spawn radius: 80px
    
    // 🔥 CRITICAL: Set z-index to be BELOW dragged tile (particles should be behind tile)
    // If tile is being dragged (zIndex > 9000), particles should be at tileZ - 1
    // Otherwise, particles should be slightly below tile
    if (opts.zIndex != null) {
      puff.zIndex = opts.zIndex;
    } else {
      const tileZ = tile?.zIndex ?? 0;
      puff.zIndex = tileZ > 9000 ? tileZ - 1 : tileZ - 0.001; // Behind dragged tile
    }
    
    // 🔥 CRITICAL: Set eventMode to 'none' to prevent particles from blocking touch events
    puff.eventMode = 'none';
    puff.cursor = 'default';
    try { puff.interactiveChildren = false; } catch {}
    
    board.addChild(puff);
    
    // Sort children to ensure correct zIndex order
    try {
      board.sortChildren?.();
    } catch {}
    
    // Longer duration for visibility
    const duration = 0.9 + Math.random() * 0.5; // 0.9-1.4s (longer trail)
    gsap.to(puff, {
      alpha: 0,  // Fade to 0
      y: puff.y - 20 - Math.random() * 15,
      duration: duration,
      ease: 'power1.out',
      onComplete: () => {
        try {
          if (puff && puff.parent) {
            puff.parent.removeChild(puff);
            puff.destroy();
          }
        } catch {}
      }
    });
  }
}

// Beer-specific drag bubbles (same style as idle bubbles, with three color shades)
export function dragBeerBubbleTrail(board, tile, tileSize = 96, strength = 1, opts = {}) {
  if (!board || !tile) return;
  
  // Max 4-10 bubbles per call
  const count = Math.floor(4 + Math.random() * 7); // 4-10 bubbles
  const { x, y } = centerInBoard(board, tile, tileSize);
  const baseRise = tileSize * 0.25;
  
  // Three color shades (same as idle bubbles but with color variation)
  // 🔥 UPDATED: Using foam colors from wild-beer.png image
  const colors = [0xFFFFFF, 0xFEFCEF, 0xF2EFEA]; // White, light cream (foam), darker cream (foam)
  
  for (let i = 0; i < count; i++) {
    // 🔥 OBJECT POOLING: Use pool instead of creating new Graphics
    const bubble = graphicsPool.acquire();
    bubble.eventMode = 'none';
    bubble.cursor = 'default';
    try { bubble.interactiveChildren = false; } catch {}
    
    // Random size (same range as idle bubbles: 15-40px diameter = 7.5-20px radius)
    const bubbleSize = 15 + Math.random() * 25; // 15-40px
    const radius = bubbleSize / 2; // 7.5-20px radius
    
    // Random color from three shades
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    // Draw bubble as circle with highlight (EXACT same style as idle bubbles)
    // 🔥 CRITICAL: Must be perfectly rounded circle particles, not rectangles or other shapes
    bubble.circle(0, 0, radius);
    bubble.fill({ color: color, alpha: 0.6 }); // Same alpha as idle bubbles (0.6)
    
    // Add highlight (smaller circle at top-left) for 3D sparkling effect (EXACT same as idle)
    const highlightRadius = radius * 0.3;
    bubble.circle(-radius * 0.2, -radius * 0.2, highlightRadius);
    bubble.fill({ color: color, alpha: 0.8 }); // Brighter highlight (same as idle: 0.8)
    
    // Add subtle border for definition (EXACT same as idle bubbles)
    bubble.circle(0, 0, radius);
    bubble.stroke({ color: color, alpha: 0.4, width: 1 }); // Same border as idle (alpha 0.4, width 1)
    
    // Random position around tile center
    bubble.x = x + (Math.random() - 0.5) * 70;
    bubble.y = y + (Math.random() - 0.5) * 70;
    
    // Random starting scale (same as idle bubbles: 20-40% start)
    bubble.scale.set(0.2 + Math.random() * 0.2);
    bubble.alpha = 0.7 + Math.random() * 0.3; // Start with 70-100% opacity
    
    // 🔥 CRITICAL: Set z-index to be BELOW dragged tile (particles should be behind tile)
    // If tile is being dragged (zIndex > 9000), particles should be at tileZ - 1
    // Otherwise, particles should be slightly below tile
    if (opts.zIndex != null) {
      bubble.zIndex = opts.zIndex;
    } else {
      const tileZ = tile?.zIndex ?? 0;
      bubble.zIndex = tileZ > 9000 ? tileZ - 1 : tileZ - 0.001; // Behind dragged tile
    }
    
    board.addChild(bubble);
    
    // Sort children to ensure correct zIndex order
    try {
      board.sortChildren?.();
    } catch {}
    
    // Animation: rise up with slight drift (like idle bubbles)
    const rise = baseRise * (0.8 + Math.random() * 0.8) * strength;
    const driftX = (Math.random() - 0.5) * 20; // ±10px horizontal drift (same as idle)
    const dur = 0.8 + Math.random() * 0.7; // 0.8-1.5s (same as idle bubbles)
    
    // Grow slightly as it rises (same as idle bubbles)
    gsap.to(bubble.scale, {
      x: 0.6 + Math.random() * 0.4, // Grow to 60-100% of size
      y: 0.6 + Math.random() * 0.4,
      duration: dur * 0.3, // Grow in first 30% of animation
      ease: 'power2.out'
    });
    
    // Rise up smoothly
    gsap.to(bubble, {
      x: bubble.x + driftX,
      y: bubble.y - rise,
      duration: dur,
      ease: 'power1.out', // Smooth upward motion (same as idle)
      onComplete: () => {
        try {
          if (bubble && bubble.parent) {
            bubble.parent.removeChild(bubble);
          }
          // 🔥 OBJECT POOLING: Release back to pool instead of destroying
          graphicsPool.release(bubble);
        } catch {}
      }
    });
    
    // Fade out as it reaches the top (last 40% of animation, same as idle)
    gsap.to(bubble, {
      alpha: 0,
      duration: dur * 0.4,
      delay: dur * 0.6,
      ease: 'power2.in'
    });
  }
}

// Dramatic screen shake for impactful events (e.g., wild merge-6)
export function screenShake(app, opts = {}){
  try {
    const target = app?.canvas || app?.view || null;
    if (!target) return;
    console.log('💥 SCREEN SHAKE: Starting with strength:', opts.strength || 18);
    
    const {
      duration = 0.35,
      strength = 18,   // px amplitude (pojačano)
      steps    = 15,   // jitter steps (više koraka)
      ease     = 'sine.inOut',
      direction = 0,   // Random direction in radians (0 = erratic/random)
      yScale    = 1.0, // scale vertical movement (e.g., 0.5 = more left-right bias)
      scale     = 0.0, // max extra zoom (e.g., 0.03 = +3% at peak)
    } = opts || {};
    
    // Log enhanced parameters for wild merges
    if (strength > 30) {
      console.log('🎆 ENHANCED SHAKE: Wild merge detected with enhanced parameters:', {
        strength, duration, steps, yScale, scale
      });
    }

    // kill any ongoing shake
    try { gsap.killTweensOf(target); } catch {}

    const tl = gsap.timeline({
      onComplete: () => { try { gsap.set(target, { x: 0, y: 0 }); } catch {} }
    });
    const dt = Math.max(0.01, duration / Math.max(1, steps));
    for (let i = 0; i < steps; i++){
      const p = 1 - (i / steps);
      const amp = strength * p * p; // quadratic decay
      const zoom = scale ? (1 + scale * (amp / Math.max(1, strength))) : 1;
      
      // Use direction for wild explosions, random for normal
      let dx, dy;
      if (direction !== 0) {
        // Wild explosion: use direction with more randomness for bigger movements
        const angle = direction + (Math.random() - 0.5) * 1.0; // ±0.5 radians variation (bigger spread)
        dx = Math.cos(angle) * amp;
        dy = Math.sin(angle) * amp * yScale;
      } else {
        // Normal shake: random direction
        dx = (Math.random() * 2 - 1) * amp;
        dy = (Math.random() * 2 - 1) * amp * yScale;
      }
      
      tl.to(target, { x: dx, y: dy, scaleX: zoom, scaleY: zoom, duration: dt, ease }, 0 + i * dt);
    }
    // Use the same ease for the return animation, or power2.out for normal shake
    const returnEase = ease === 'elastic.out(1, 0.3)' ? 'elastic.out(1, 0.5)' : 'power2.out';
    tl.to(target, { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: Math.min(0.12, duration * 0.45), ease: returnEase }, '>');
  } catch {}
}

/* ---------- Wild idle FX: gentle wiggle + elastic bounce + shimmer ---------- */
function makeLinearGradientTexture(w, h, stops){
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(2, Math.ceil(w));
  canvas.height = Math.max(2, Math.ceil(h));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
  // stops: [{o:0..1, c:'rgba(...)'}]
  (stops||[]).forEach(s=> grad.addColorStop(Math.min(1, Math.max(0, s.o||0)), s.c||'rgba(255,255,255,0)'));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  try { return Texture.from(canvas); } catch { return null; }
}

// Create shimmer effect for wild cubes
export function createWildShimmer(tile) {
  if (!tile) return null;
  
  const g = tile.rotG || tile;
  const baseW = Math.max(64, (tile.base?.width || tile.width || 96));
  const baseH = Math.max(64, (tile.base?.height || tile.height || 96));
  
  // Create shimmer container with proper masking
  const shimmerContainer = new Container();
  shimmerContainer.alpha = 0;
  
  // Create mask for shimmer (exactly tile size)
  const mask = new Graphics();
  mask.rect(-baseW/2, -baseH/2, baseW, baseH);
  mask.fill(0xFFFFFF);
  shimmerContainer.mask = mask;
  shimmerContainer.addChild(mask);
  
  // Create shimmer sprite with diagonal gradient
  const shimmerTexture = makeLinearGradientTexture(baseW * 2, baseH * 2, [
    { o: 0.0, c: 'rgba(255,255,255,0)' },
    { o: 0.2, c: 'rgba(255,255,255,0)' },
    { o: 0.4, c: 'rgba(255,255,255,0.6)' },
    { o: 0.5, c: 'rgba(255,255,255,0.9)' },
    { o: 0.6, c: 'rgba(255,255,255,0.6)' },
    { o: 0.8, c: 'rgba(255,255,255,0)' },
    { o: 1.0, c: 'rgba(255,255,255,0)' }
  ]);
  
  if (shimmerTexture) {
    const shimmerSprite = new Sprite(shimmerTexture);
    shimmerSprite.anchor.set(0.5);
    shimmerSprite.width = baseW * 2;
    shimmerSprite.height = baseH * 2;
    
    // Rotate shimmer to go diagonal (top-left to bottom-right)
    shimmerSprite.rotation = Math.PI / 4; // 45 degrees
    
    // Position shimmer to start off-screen
    shimmerSprite.x = -baseW * 0.8;
    shimmerSprite.y = -baseH * 0.8;
    
    shimmerContainer.addChild(shimmerSprite);
    tile._wildShimmerSprite = shimmerSprite;
  }
  
  // Add to tile
  g.addChild(shimmerContainer);
  tile._wildShimmer = shimmerContainer;
  
  return shimmerContainer;
}

// Enhanced wild cube impact effect - more organic and cute
export function wildImpactEffect(tile, opts = {}) {
  if (!tile) return;
  console.log('💥 WILD IMPACT: Starting enhanced wild impact effect');
  
  const g = tile.rotG || tile;
  const sx = g.scale?.x || 1;
  const sy = g.scale?.y || 1;
  
  // Enhanced parameters for wild cubes
  const squash = opts.squash ?? 0.22;      // More dramatic squash
  const stretch = opts.stretch ?? 0.18;    // More dramatic stretch
  const tilt = opts.tilt ?? 0.12;          // More dramatic tilt
  const bounce = opts.bounce ?? 1.15;      // More dramatic bounce
  
  try { gsap.killTweensOf(g.scale); gsap.killTweensOf(g.rotation); } catch {}
  
  // 1) Dramatic pre-impact anticipation (bigger shrink + tilt)
  gsap.set(g, { rotation: 0 });
  gsap.fromTo(g.scale, 
    { x: sx * 0.88, y: sy * 0.88 },
    { x: sx * (1 + squash), y: sy * (1 - stretch), duration: 0.08, ease: 'power2.out' }
  );
  
  // 2) Dramatic bounce with bigger overshoot
  gsap.to(g.scale, 
    { x: sx * bounce, y: sy * bounce, duration: 0.20, ease: 'back.out(3.0)' }, 
    0.08
  );
  
  // 3) More dramatic settle with bigger secondary bounce
  gsap.to(g.scale, 
    { x: sx * 0.96, y: sy * 1.04, duration: 0.15, ease: 'power2.out' }, 
    0.28
  );
  gsap.to(g.scale, 
    { x: sx, y: sy, duration: 0.22, ease: 'elastic.out(1, 0.7)' }, 
    0.43
  );
  
  // 4) More dramatic tilt wiggle sequence
  gsap.to(g, { rotation: tilt, duration: 0.10, ease: 'sine.out' }, 0.10);
  gsap.to(g, { rotation: -tilt * 0.8, duration: 0.12, ease: 'sine.inOut' }, 0.20);
  gsap.to(g, { rotation: tilt * 0.5, duration: 0.14, ease: 'sine.inOut' }, 0.32);
  gsap.to(g, { rotation: 0, duration: 0.18, ease: 'back.out(2.2)' }, 0.46);
  
  console.log('✅ WILD IMPACT: Enhanced effect applied successfully');
}

export function startWildIdle(tile, opts = {}){
  if (!tile) return;
  try { stopWildIdle(tile); } catch {}
  try { startWildStars(tile); } catch {}

  const g = tile.rotG || tile;
  const baseW = Math.max(64, (tile.base?.width || tile.width || 96));
  const baseH = Math.max(64, (tile.base?.height || tile.height || 96));

  // Create shimmer effect
  const shimmer = createWildShimmer(tile);

  const interval = Math.max(1.5, +opts.interval || 2.5); // Reduced from 4.0 for faster cycling
  const shiftDur = Math.max(0.35, +opts.shift || 0.50); // Reduced from 0.70 for shorter cycle
  const wiggle   = Math.max(0.01, +opts.wiggle || 0.040);
  const peak     = Math.max(1.01, +opts.peak || 1.04); // Normal wild idle animation (reduced from 1.80)
  
  console.log('🎯 START WILD IDLE CALLED with peak:', peak, 'opts:', opts);

  const tl = gsap.timeline({ repeat: -1, repeatDelay: Math.max(0, interval - (shiftDur + 0.20)) }); // Shorter delay
  tile._wildIdleTl = tl;
  
  // Stop animation when app is in background to prevent Metal GPU errors
  const checkVisibility = () => {
    if (document.hidden) {
      tl.pause();
    } else {
      tl.resume();
    }
  };
  
  document.addEventListener('visibilitychange', checkVisibility);
  
  // 🔥 MEMORY LEAK FIX: Store event listener reference for cleanup
  tile._visibilityListener = checkVisibility;
  
  // Clean up event listener when animation is stopped
  const originalKill = tl.kill.bind(tl);
  tl.kill = function() {
    document.removeEventListener('visibilitychange', checkVisibility);
    tile._visibilityListener = null;
    return originalKill();
  };

  // 1) INSTANT BOUNCE - no hold at peak, immediate return
  const sx = g.scale?.x || 1, sy = g.scale?.y || 1;
  const baseY = g.y || 0;
  
  // Y-axis bounce (up and down like a ball)
  tl.to(g, { y: baseY - 20, duration: 0.15, ease: 'power1.out' }, 0) // Quick bounce up
    .to(g, { y: baseY, duration: 0.12, ease: 'bounce.out' }, '>-0.13') // Bounce down starts 0.02s before up ends
  
  // Scale squeeze effect (ball squishes when hitting ground)
  .to(g.scale, { x: peak * 1.12, y: peak * 0.88, duration: 0.15, ease: 'power1.out' }, 0) // Quick stretch up
    .to(g.scale, { x: sx * 0.92, y: sy * 1.15, duration: 0.08, ease: 'power1.in' }, '>-0.13') // Quick squeeze on impact
    .to(g.scale, { x: sx, y: sy, duration: 0.10, ease: 'elastic.out(2.5, 0.6)' }, '>-0.08') // Bouncy elastic return
    // wiggle runs in parallel
    .to(g, { rotation: wiggle * 1.5, duration: 0.40, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0);

  // Random shimmer effect every 4-8 seconds
  if (shimmer && tile._wildShimmerSprite) {
    const scheduleShimmer = () => {
      const delay = 4 + Math.random() * 4; // 4-8 seconds
      // 🔥 MEMORY LEAK FIX: Store delayed call reference for cleanup
      const delayedCall = gsap.delayedCall(delay, () => {
        if (tile._wildIdleTl && !tile._wildIdleTl.isActive()) return; // Don't shimmer if idle stopped
        
        // Check if shimmer sprite still exists before accessing properties
        if (!tile._wildShimmerSprite) return;
        
        // Reset shimmer position
        tile._wildShimmerSprite.x = -baseW * 0.8;
        tile._wildShimmerSprite.y = -baseH * 0.8;
        
        // Shimmer animation - diagonal sweep
        const shimmerTl = gsap.timeline();
        shimmerTl
          // Calmer shimmer: lower peak alpha and slower sweep
          .to(shimmer, { alpha: 0.30, duration: 0.28, ease: 'power2.out' })
          .to(tile._wildShimmerSprite, { 
            x: baseW * 0.8, 
            y: baseH * 0.8,
            duration: 2.0, 
            ease: 'power2.inOut',
            onUpdate: () => {
              // Additional safety check during animation
              if (!tile._wildShimmerSprite) {
                shimmerTl.kill();
                return;
              }
            }
          })
          .to(shimmer, { alpha: 0, duration: 0.28, ease: 'power2.in' });
        
        // Schedule next shimmer
        scheduleShimmer();
      });
      __globalDelayedCalls.add(delayedCall);
      
      // 🔥 MEMORY LEAK FIX: Store delayed call on tile for cleanup
      if (!tile._shimmerDelayedCalls) tile._shimmerDelayedCalls = [];
      tile._shimmerDelayedCalls.push(delayedCall);
    };
    
    scheduleShimmer();
  }
}

// Start wild shimmer only (no bounce/wiggle animation)
export function startWildShimmer(tile) {
  if (!tile) return;
  try { stopWildShimmer(tile); } catch {}

  const g = tile.rotG || tile;
  const baseW = Math.max(64, (tile.base?.width || tile.width || 96));
  const baseH = Math.max(64, (tile.base?.height || tile.height || 96));

  // Create shimmer effect
  const shimmer = createWildShimmer(tile);

  // Random shimmer effect every 4-8 seconds
  if (shimmer && tile._wildShimmerSprite) {
    const scheduleShimmer = () => {
      const delay = 4 + Math.random() * 4; // 4-8 seconds
      // 🔥 MEMORY LEAK FIX: Store delayed call reference for cleanup
      const delayedCall = gsap.delayedCall(delay, () => {
        // Check if shimmer sprite still exists before accessing properties
        if (!tile._wildShimmerSprite || tile.destroyed) return;

        // Reset shimmer position
        tile._wildShimmerSprite.x = -baseW * 0.8;
        tile._wildShimmerSprite.y = -baseH * 0.8;

        // Shimmer animation - diagonal sweep
        const shimmerTl = gsap.timeline();
        shimmerTl
          .to(shimmer, { alpha: 0.30, duration: 0.28, ease: 'power2.out' })
          .to(tile._wildShimmerSprite, { 
            x: baseW * 0.8, 
            y: baseH * 0.8,
            duration: 2.0, 
            ease: 'power2.inOut',
            onUpdate: () => {
              if (!tile._wildShimmerSprite) {
                shimmerTl.kill();
                return;
              }
            }
          })
          .to(shimmer, { alpha: 0, duration: 0.28, ease: 'power2.in' });

        // Schedule next shimmer
        scheduleShimmer();
      });
      __globalDelayedCalls.add(delayedCall);
      
      // 🔥 MEMORY LEAK FIX: Store delayed call on tile for cleanup
      if (!tile._shimmerDelayedCalls) tile._shimmerDelayedCalls = [];
      tile._shimmerDelayedCalls.push(delayedCall);
    };

    scheduleShimmer();
  }
}

// Stop wild shimmer only
export function stopWildShimmer(tile) {
  if (!tile) return;
  
  // 🔥 MEMORY LEAK FIX: Kill all shimmer delayed calls
  try {
    if (tile._shimmerDelayedCalls && Array.isArray(tile._shimmerDelayedCalls)) {
      tile._shimmerDelayedCalls.forEach(call => {
        try { 
          call.kill(); 
          __globalDelayedCalls.delete(call);
        } catch {}
      });
      tile._shimmerDelayedCalls = [];
    }
  } catch {}
  
  try {
    if (tile._wildShimmer){
      // Kill any ongoing shimmer animations
      if (tile._wildShimmerSprite) {
        gsap.killTweensOf(tile._wildShimmerSprite);
      }
      gsap.killTweensOf(tile._wildShimmer);
      
      // Clean up shimmer elements
      if (tile._wildShimmer.mask) tile._wildShimmer.mask = null;
      tile._wildShimmer.parent?.removeChild(tile._wildShimmer);
      tile._wildShimmer.destroy?.();
    }
  } catch {}
  
  // Clear all delayed calls for this tile to prevent shimmer scheduling
  try {
    gsap.killTweensOf(tile);
  } catch {}
  
  tile._wildShimmer = null;
  tile._wildShimmerSprite = null;
}

/**
 * Start magnet idle particles animation - continuous particles at 24% intensity
 * Uses same particles as drag animation but with 24% intensity (0.24)
 */
export function startMagnetIdleParticles(tile) {
  if (!tile) return;
  
  // Stop existing particles animation if any
  if (tile._magnetIdleParticlesInterval) {
    clearInterval(tile._magnetIdleParticlesInterval);
    tile._magnetIdleParticlesInterval = null;
  }
  
  // Get board from STATE - access via window to avoid circular dependency
  // STATE is exposed to window by app-core.ts
  const board = (typeof window !== 'undefined' && window.STATE) ? window.STATE.board : null;
  
  if (!board) {
    console.warn('⚠️ startMagnetIdleParticles: Board not found in STATE');
    return;
  }
  
  // Generate particles every 200ms (5 times per second) at 24% intensity (normal size, like drag smoke)
  const generateParticles = () => {
    if (!tile || tile.destroyed) return;
    try {
      // Use normal size particles (no sizeMultiplier) - same as drag smoke effect
      magicSparklesAtTile(board, tile, { 
        intensity: 0.24 // 24% intensity (normal size, like drag smoke)
      });
    } catch (err) {
      console.warn('Magnet idle particles error:', err);
    }
  };
  
  // Generate particles immediately
  generateParticles();
  
  // Schedule continuous particles every 200ms
  tile._magnetIdleParticlesInterval = setInterval(() => {
    if (!tile || tile.destroyed) {
      if (tile._magnetIdleParticlesInterval) {
        clearInterval(tile._magnetIdleParticlesInterval);
        tile._magnetIdleParticlesInterval = null;
      }
      return;
    }
    generateParticles();
  }, 200); // Every 200ms (5 times per second)
}

/**
 * Stop magnet idle particles animation
 */
export function stopMagnetIdleParticles(tile) {
  if (!tile) return;
  
  if (tile._magnetIdleParticlesInterval) {
    clearInterval(tile._magnetIdleParticlesInterval);
    tile._magnetIdleParticlesInterval = null;
  }
}

/**
 * Start hero image particles animation - behind crash-cubes-homepage.png on slide 1
 * Uses HTML overlay div, 300x larger particles, wider spread
 */
export function startHeroImageParticles(heroImageElement) {
  if (!heroImageElement) {
    console.warn('⚠️ startHeroImageParticles: No hero image element provided');
    return;
  }
  
  console.log('🔥 startHeroImageParticles: Starting hero image particles animation', heroImageElement);
  
  // Stop existing particles animation if any
  if (heroImageElement._heroImageParticlesInterval) {
    clearInterval(heroImageElement._heroImageParticlesInterval);
    heroImageElement._heroImageParticlesInterval = null;
  }
  
  // Create overlay container for HTML particles
  // Place it inside hero-container to be in the same stacking context
  let overlayContainer = document.getElementById('hero-image-particles-overlay');
  if (!overlayContainer) {
    const heroContainer = heroImageElement.closest('.hero-container');
    if (!heroContainer) {
      console.warn('⚠️ Hero container not found, cannot create particles overlay');
      return;
    }
    
    overlayContainer = document.createElement('div');
    overlayContainer.id = 'hero-image-particles-overlay';
    overlayContainer.className = 'hero-image-particles-overlay';
    overlayContainer.style.position = 'absolute';
    overlayContainer.style.top = '0';
    overlayContainer.style.left = '0';
    overlayContainer.style.width = '100%';
    overlayContainer.style.height = '100%';
    overlayContainer.style.pointerEvents = 'none';
    overlayContainer.style.zIndex = '1'; // Behind hero image (z-index: 2)
    overlayContainer.style.overflow = 'visible';
    // Insert at the beginning of hero-container to ensure it's behind hero image
    heroContainer.insertBefore(overlayContainer, heroContainer.firstChild);
    console.log('✅ Created hero image particles overlay container (behind hero image)', overlayContainer);
  } else {
    console.log('✅ Hero image particles overlay container already exists', overlayContainer);
  }
  
  // Generate stars on click/tap (1-4 stars per spawn)
  const generateParticles = () => {
    if (!heroImageElement || !heroImageElement.parentElement) {
      console.warn('⚠️ generateParticles: Hero image element not in DOM');
      return;
    }
    
    if (!overlayContainer) {
      console.warn('⚠️ generateParticles: Overlay container not found');
      return;
    }
    
    try {
      const rect = heroImageElement.getBoundingClientRect();
      const containerRect = overlayContainer.getBoundingClientRect();
      
      if (rect.width === 0 || rect.height === 0) {
        console.warn('⚠️ generateParticles: Hero image has zero dimensions');
        return;
      }
      
      // Calculate hero image center relative to overlay container (not viewport)
      // This ensures particles are centered exactly behind the hero image
      const heroCenterX = (rect.left - containerRect.left) + rect.width / 2;
      const heroCenterY = (rect.top - containerRect.top) + rect.height / 2;
      
      // Helper function to create and animate particle
      const createParticle = (src, size, isWildMagnet = false) => {
        const particle = document.createElement('img');
        particle.src = src;
        
        // Wild-magnet is 50% smaller
        const finalSize = isWildMagnet ? size * 0.5 : size;
        
        particle.style.position = 'absolute';
        particle.style.width = `${finalSize}px`;
        particle.style.height = `${finalSize}px`;
        particle.style.opacity = '1.0'; // 100% opacity
        particle.style.backgroundColor = 'transparent';
        particle.style.background = 'none';
        particle.style.transformOrigin = 'center center';
        
        // Random position around hero image center
        const angle = Math.random() * Math.PI * 2;
        const distance = 14 + Math.random() * 42; // Same as logo
        const startX = heroCenterX + Math.cos(angle) * distance;
        const startY = heroCenterY + Math.sin(angle) * distance;
        
        particle.style.left = `${startX - finalSize/2}px`;
        particle.style.top = `${startY - finalSize/2}px`;
        particle.style.transform = `rotate(${Math.random() * 360}deg)`;
        
        overlayContainer.appendChild(particle);
        
        // Animate particle - move outward with WIDER spread (larger endDistance)
        const endAngle = angle + (Math.random() - 0.5) * 1.5; // Wider angle spread
        const endDistance = distance * (3.0 + Math.random() * 2.0); // Much wider: 3.0-5.0x
        const endX = heroCenterX + Math.cos(endAngle) * endDistance;
        const endY = heroCenterY + Math.sin(endAngle) * endDistance;
        
        // Use GSAP for animation - particles stay at full opacity (no fade-out)
        gsap.fromTo(particle, 
          { 
            x: 0, 
            y: 0, 
            opacity: 1.0 // 100% opacity
          },
          {
            x: endX - startX,
            y: endY - startY,
            rotation: `+=${(Math.random() - 0.5) * 360}`,
            opacity: 1.0, // Keep at 100% opacity (no fade-out)
            duration: 0.8 + Math.random() * 0.4,
            ease: 'power1.out',
            onComplete: () => {
              try {
                if (particle && particle.parentNode) {
                  particle.parentNode.removeChild(particle);
                }
              } catch (err) {
                // Ignore cleanup errors
              }
            }
          }
        );
      };
      
      // Generate 1-4 stars
      const starCount = 1 + Math.floor(Math.random() * 4); // 1-4 stars
      const starSize = 13.5 + Math.random() * 13.5; // 13.5-27px (50% smaller max)
      
      for (let i = 0; i < starCount; i++) {
        createParticle('./assets/small-star.png', starSize);
      }
      
      // Generate 1 wild-magnet (50% smaller)
      const wildMagnetSize = 20 + Math.random() * 20; // 20-40px base size, will be 50% smaller (10-20px)
      createParticle('./assets/wild-magnet.png', wildMagnetSize, true);
      
      // Generate 1 cube-nav (normal size)
      const cubeNavSize = 20 + Math.random() * 20; // 20-40px
      createParticle('./assets/nav/cube-nav.png', cubeNavSize);
      
      console.log(`✅ generateParticles: Created ${starCount} stars + 1 wild-magnet + 1 cube-nav for hero image on click/tap, overlay children:`, overlayContainer.children.length);
    } catch (err) {
      console.error('❌ Hero image particles error:', err);
    }
  };
  
  // 🔥 CRITICAL: Remove existing listeners if any (prevent duplicates)
  if (heroImageElement._heroImageParticlesClickHandler) {
    heroImageElement.removeEventListener('click', heroImageElement._heroImageParticlesClickHandler);
    heroImageElement.removeEventListener('touchstart', heroImageElement._heroImageParticlesTouchStartHandler);
    heroImageElement.removeEventListener('touchmove', heroImageElement._heroImageParticlesTouchMoveHandler);
    heroImageElement.removeEventListener('touchend', heroImageElement._heroImageParticlesTouchEndHandler);
  }
  
  // Track touch state to distinguish swipe from tap
  let touchStartX = 0;
  let touchStartY = 0;
  let hasMoved = false;
  const SWIPE_THRESHOLD = 10; // Minimum distance in pixels to consider it a swipe
  
  // Touch start handler - record initial position
  const touchStartHandler = (e) => {
    hasMoved = false;
    if (e.touches && e.touches.length > 0) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  };
  
  // Touch move handler - detect if user is swiping
  const touchMoveHandler = (e) => {
    if (e.touches && e.touches.length > 0) {
      const touchX = e.touches[0].clientX;
      const touchY = e.touches[0].clientY;
      const deltaX = Math.abs(touchX - touchStartX);
      const deltaY = Math.abs(touchY - touchStartY);
      
      // If moved more than threshold, it's a swipe
      if (deltaX > SWIPE_THRESHOLD || deltaY > SWIPE_THRESHOLD) {
        hasMoved = true;
      }
    }
  };
  
  // Easter egg: Track tap count for collectible card 25 unlock
  const getTapCount = () => {
    try {
      return parseInt(localStorage.getItem('hero_image_tap_count') || '0', 10);
    } catch {
      return 0;
    }
  };
  
  const resetTapProgress = (reason) => {
    try {
      localStorage.setItem('hero_image_tap_count', '0');
      if (reason) {
        console.log(reason);
      } else {
        console.log('🔄 Hero image tap counter reset to 0');
      }
    } catch (err) {
      console.warn('⚠️ Failed to reset hero image tap counter:', err);
    }
  };
  
  const syncTapProgressWithCollectibles = () => {
    try {
      const collectiblesState = localStorage.getItem('collectibles_state');
      let legendary25Unlocked = false;
      if (collectiblesState) {
        const state = JSON.parse(collectiblesState);
        legendary25Unlocked = !!state.legendary?.find(c => c.id === 'legendary05' && c.unlocked);
      }
      
      const tapCount = getTapCount();
      const easterEggTriggered = localStorage.getItem('hero_image_easter_egg_triggered') === 'true';
      
      if (!legendary25Unlocked) {
        if (tapCount >= 10) {
          resetTapProgress('🔄 Tap counter reset because collectible 25 is locked but counter was >=10');
        }
        if (easterEggTriggered) {
          localStorage.removeItem('hero_image_easter_egg_triggered');
          console.log('🔄 Cleared hero image easter egg flag because collectible 25 is locked');
        }
      } else if (!easterEggTriggered) {
        localStorage.setItem('hero_image_easter_egg_triggered', 'true');
        console.log('🔐 Collectible 25 already unlocked - marking easter egg as triggered');
      }
    } catch (err) {
      console.warn('⚠️ Failed to sync hero image tap counter with collectible state:', err);
    }
  };
  
  const incrementTapCount = () => {
    try {
      // Check if easter egg was already triggered - if so, don't increment
      const alreadyTriggered = localStorage.getItem('hero_image_easter_egg_triggered') === 'true';
      if (alreadyTriggered) {
        console.log('✅ Easter egg already triggered, not incrementing tap count');
        return getTapCount();
      }
      
      const currentCount = getTapCount();
      const newCount = currentCount + 1;
      localStorage.setItem('hero_image_tap_count', newCount.toString());
      console.log(`🎯 Hero image tap count: ${newCount}/10 (stored in localStorage)`);
      
      // Verify it was stored correctly
      const verifyCount = parseInt(localStorage.getItem('hero_image_tap_count') || '0', 10);
      if (verifyCount !== newCount) {
        console.error('❌ ERROR: Tap count not stored correctly! Expected:', newCount, 'Got:', verifyCount);
      } else {
        console.log('✅ Tap count verified in localStorage:', verifyCount);
      }
      
      return newCount;
    } catch (err) {
      console.error('❌ Error incrementing tap count:', err);
      return 0;
    }
  };
  
  // 🔥 MEMORY LEAK FIX: Track timeout IDs for cleanup
  let easterEggRetryTimeout = null;
  let easterEggVerifyTimeout = null;
  
  const checkEasterEgg = () => {
    // Get tap count AFTER increment (incrementTapCount was called before this)
    const tapCount = getTapCount();
    console.log('🔍 checkEasterEgg: Current tap count:', tapCount);
    
    // Check if easter egg was already triggered
    const alreadyTriggered = localStorage.getItem('hero_image_easter_egg_triggered') === 'true';
    if (alreadyTriggered) {
      console.log('✅ Easter egg already triggered previously');
      return;
    }
    
    // Only unlock if 10 or more taps
    if (tapCount >= 10) {
      // Check if card 25 is already unlocked
      try {
        const collectiblesState = localStorage.getItem('collectibles_state');
        if (collectiblesState) {
          const state = JSON.parse(collectiblesState);
          const legendary05 = state.legendary?.find(c => c.id === 'legendary05');
          if (legendary05 && legendary05.unlocked) {
            console.log('✅ Card 25 already unlocked');
            localStorage.setItem('hero_image_easter_egg_triggered', 'true');
            return;
          }
        }
        
        // Unlock card 25 on the 10th tap (or more)
        console.log('🎉 Easter egg triggered! Unlocking collectible card 25...');
        console.log('🔍 window type:', typeof window);
        const win = typeof window !== 'undefined' ? window : null;
        console.log('🔍 unlockCollectibleByNumber type:', win && typeof win.unlockCollectibleByNumber);
        console.log('🔍 unlockCollectibleByNumber available?', win && typeof win.unlockCollectibleByNumber === 'function');
        
        // Wait a bit for the function to be available (in case module is still loading)
        let retryCount = 0;
        const maxRetries = 50; // 5 seconds max wait (50 * 100ms)
        const tryUnlock = () => {
          if (win && typeof win.unlockCollectibleByNumber === 'function') {
            // Mark that easter egg was triggered BEFORE unlock to prevent multiple calls
            localStorage.setItem('hero_image_easter_egg_triggered', 'true');
            
            // 🔥 MEMORY LEAK FIX: Clear retry timeout since we found the function
            if (easterEggRetryTimeout) {
              clearTimeout(easterEggRetryTimeout);
              easterEggRetryTimeout = null;
            }
            
            console.log('🚀 Calling unlockCollectibleByNumber(25)...');
            try {
              const unlockPromise = win.unlockCollectibleByNumber(25);
              if (unlockPromise && typeof unlockPromise.then === 'function') {
                unlockPromise.then(() => {
                  console.log('✅ Collectible card 25 unlocked via easter egg!');
                  resetTapProgress('🔄 Tap counter reset after unlocking collectible 25');
                  
                  // Verify unlock in localStorage
                  // 🔥 MEMORY LEAK FIX: Store timeout ID for cleanup
                  easterEggVerifyTimeout = setTimeout(() => {
                    easterEggVerifyTimeout = null;
                    const collectiblesState = localStorage.getItem('collectibles_state');
                    if (collectiblesState) {
                      const state = JSON.parse(collectiblesState);
                      const legendary05 = state.legendary?.find(c => c.id === 'legendary05');
                      if (legendary05 && legendary05.unlocked) {
                        console.log('✅ Card 25 verified as unlocked in localStorage');
                        
                        // Check pending flips for badge count
                        const pendingFlips = win.__pendingCollectibleFlips || [];
                        console.log('🔍 Pending flips:', pendingFlips.length);
                        
                        // Force badge update
                        if (win && typeof win.updateNavBadge === 'function') {
                          win.updateNavBadge(pendingFlips.length);
                          console.log('✅ Badge updated to', pendingFlips.length, 'pending collectibles');
                        } else {
                          console.warn('⚠️ updateNavBadge function not available');
                        }
                      } else {
                        console.error('❌ Card 25 NOT found in localStorage or NOT unlocked!');
                      }
                    } else {
                      console.error('❌ collectibles_state not found in localStorage!');
                    }
                  }, 500);
                }).catch(err => {
                  console.error('❌ Failed to unlock card 25:', err);
                  console.error('❌ Error details:', err.message, err.stack);
                  // Reset flag on error so user can try again
                  localStorage.removeItem('hero_image_easter_egg_triggered');
                });
              } else {
                console.error('❌ unlockCollectibleByNumber did not return a Promise!');
                localStorage.removeItem('hero_image_easter_egg_triggered');
              }
            } catch (err) {
              console.error('❌ Exception calling unlockCollectibleByNumber:', err);
              localStorage.removeItem('hero_image_easter_egg_triggered');
            }
          } else {
            retryCount++;
            if (retryCount < maxRetries) {
              console.warn(`⚠️ unlockCollectibleByNumber not available yet, retrying in 100ms... (${retryCount}/${maxRetries})`);
              // Retry after a short delay in case module is still loading
              // 🔥 MEMORY LEAK FIX: Store timeout ID for cleanup
              easterEggRetryTimeout = setTimeout(tryUnlock, 100);
            } else {
              console.error('❌ unlockCollectibleByNumber not available after', maxRetries, 'retries!');
              localStorage.removeItem('hero_image_easter_egg_triggered');
              easterEggRetryTimeout = null;
            }
          }
        };
        
        tryUnlock();
      } catch (err) {
        console.error('❌ Error checking/unlocking card 25:', err);
        // Reset flag on error so user can try again
        localStorage.removeItem('hero_image_easter_egg_triggered');
      }
    } else if (tapCount < 10) {
      console.log(`🎯 Tap count: ${tapCount}/10 - need ${10 - tapCount} more taps`);
    }
  };
  
  // 🔥 MEMORY LEAK FIX: Cleanup function for easter egg timeouts
  const cleanupEasterEggTimeouts = () => {
    if (easterEggRetryTimeout) {
      clearTimeout(easterEggRetryTimeout);
      easterEggRetryTimeout = null;
    }
    if (easterEggVerifyTimeout) {
      clearTimeout(easterEggVerifyTimeout);
      easterEggVerifyTimeout = null;
    }
  };
  
  // Align tap counter + trigger flag with stored collectible state whenever homepage loads
  syncTapProgressWithCollectibles();
  
  // Touch end handler - only trigger particles if it was a tap (not swipe)
  const touchEndHandler = (e) => {
    // If user swiped, don't trigger particles
    if (hasMoved) {
      console.log('🔥 Swipe detected, skipping particles');
      hasMoved = false;
      return;
    }
    
    // It's a tap - trigger particles
    console.log('🔥 Hero image tapped (not swiped)!');
    
    // Haptic feedback (same as settings "Made with ❤️" text)
    if (typeof window !== 'undefined' && typeof window.triggerHapticImpact === 'function') {
      try {
        window.triggerHapticImpact('light');
        console.log('✅ Haptic feedback triggered');
      } catch (err) {
        console.warn('⚠️ Failed to trigger haptic for hero image click:', err);
      }
    }
    
    // Increment tap count and check easter egg
    const newTapCount = incrementTapCount();
    console.log('🔍 After increment, tap count is:', newTapCount);
    checkEasterEgg();
    
    // Generate particles
    console.log('🔥 Generating particles...');
    generateParticles();
    
    hasMoved = false;
  };
  
  // Click handler (for desktop/mouse)
  const clickHandler = (e) => {
    console.log('🔥 Hero image clicked!');
    
    // Haptic feedback (same as settings "Made with ❤️" text)
    if (typeof window !== 'undefined' && typeof window.triggerHapticImpact === 'function') {
      try {
        window.triggerHapticImpact('light');
        console.log('✅ Haptic feedback triggered');
      } catch (err) {
        console.warn('⚠️ Failed to trigger haptic for hero image click:', err);
      }
    }
    
    // Increment tap count and check easter egg
    const newTapCount = incrementTapCount();
    console.log('🔍 After increment, tap count is:', newTapCount);
    checkEasterEgg();
    
    // Generate particles
    console.log('🔥 Generating particles...');
    generateParticles();
  };
  
  // Store handler references for cleanup
  heroImageElement._heroImageParticlesClickHandler = clickHandler;
  heroImageElement._heroImageParticlesTouchStartHandler = touchStartHandler;
  heroImageElement._heroImageParticlesTouchMoveHandler = touchMoveHandler;
  heroImageElement._heroImageParticlesTouchEndHandler = touchEndHandler;
  
  // Ensure hero image is clickable (remove any pointer-events: none)
  heroImageElement.style.pointerEvents = 'auto';
  
  // Add event listeners
  // Click for desktop/mouse (passive: false to allow preventDefault if needed, but we don't use it here)
  heroImageElement.addEventListener('click', clickHandler, { passive: true });
  
  // Touch events for mobile (all passive to not interfere with swipe)
  heroImageElement.addEventListener('touchstart', touchStartHandler, { passive: true });
  heroImageElement.addEventListener('touchmove', touchMoveHandler, { passive: true });
  heroImageElement.addEventListener('touchend', touchEndHandler, { passive: true });
  
  // Make hero image clickable (add cursor pointer style and user-select: none)
  heroImageElement.style.cursor = 'pointer';
  heroImageElement.style.userSelect = 'none';
  heroImageElement.style.webkitUserSelect = 'none';
  
  console.log('✅ startHeroImageParticles: Click/tap handler added with swipe detection - stars will spawn on tap (not swipe)', {
    element: heroImageElement,
    hasOverlay: !!overlayContainer,
    pointerEvents: heroImageElement.style.pointerEvents
  });
}

/**
 * Stop hero image particles animation
 */
export function stopHeroImageParticles(heroImageElement) {
  if (!heroImageElement) return;
  
  // Remove all event listeners
  if (heroImageElement._heroImageParticlesClickHandler) {
    heroImageElement.removeEventListener('click', heroImageElement._heroImageParticlesClickHandler);
    heroImageElement._heroImageParticlesClickHandler = null;
  }
  if (heroImageElement._heroImageParticlesTouchStartHandler) {
    heroImageElement.removeEventListener('touchstart', heroImageElement._heroImageParticlesTouchStartHandler);
    heroImageElement._heroImageParticlesTouchStartHandler = null;
  }
  if (heroImageElement._heroImageParticlesTouchMoveHandler) {
    heroImageElement.removeEventListener('touchmove', heroImageElement._heroImageParticlesTouchMoveHandler);
    heroImageElement._heroImageParticlesTouchMoveHandler = null;
  }
  if (heroImageElement._heroImageParticlesTouchEndHandler) {
    heroImageElement.removeEventListener('touchend', heroImageElement._heroImageParticlesTouchEndHandler);
    heroImageElement._heroImageParticlesTouchEndHandler = null;
  }
  
  // Remove cursor pointer style and user-select
  heroImageElement.style.cursor = '';
  heroImageElement.style.userSelect = '';
  heroImageElement.style.webkitUserSelect = '';
  
  // 🔥 MEMORY LEAK FIX: Cleanup easter egg timeouts
  cleanupEasterEggTimeouts();
  
  // Clean up overlay container
  const overlayContainer = document.getElementById('hero-image-particles-overlay');
  if (overlayContainer) {
    // Kill all GSAP animations on particles (both img and div elements)
    const particles = overlayContainer.querySelectorAll('img, div');
    particles.forEach(particle => {
      gsap.killTweensOf(particle);
    });
    
    // Remove animation classes
    overlayContainer.classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-reset');
    
    // Remove overlay container
    overlayContainer.remove();
    console.log('✅ Removed hero image particles overlay container and event listeners');
  }
}

/**
 * Start magnet shake animation - idle shake every 3 seconds
 * Each magnet has random shake parameters (angle, duration)
 * Shakes using rotation only (does NOT modify tile position - keeps tile on board!)
 * Slower animation (80% slower), 6 revolutions per shake, 3 second pause between shakes
 */
export function startMagnetShake(tile) {
  if (!tile) return;
  
  // Stop existing shake animation
  if (tile._magnetShakeTl) {
    tile._magnetShakeTl.kill();
    tile._magnetShakeTl = null;
  }
  
  const g = tile.rotG || tile;
  
  // 🔥 NEW: Random shake parameters for each magnet (makes each magnet unique)
  // Store random parameters on tile so they persist across shake cycles
  if (tile._magnetShakeAngle === undefined) {
    // Random shake angle: 8-12 degrees (base 10.5 with variation)
    tile._magnetShakeAngle = 10.5 + (Math.random() - 0.5) * 4; // 8.5 to 12.5 degrees
    // Random duration multiplier: 0.9-1.1x (slight variation in speed)
    tile._magnetShakeDurationMultiplier = 0.9 + Math.random() * 0.2; // 0.9 to 1.1
  }
  
  const shakeAngle = tile._magnetShakeAngle;
  const shakeDuration = 0.06 * 1.8 * tile._magnetShakeDurationMultiplier; // 80% slower: 60ms * 1.8 = 108ms base, with random variation
  const revolutions = 6; // 6 revolutions per shake (left-right-left-right-left-right)
  
  // Convert degrees to radians
  const shakeRad = (shakeAngle * Math.PI) / 180;
  
  // Create shake animation function
  const performShake = () => {
    if (!tile || tile.destroyed || !g) return;
    
    // 🔥 CRITICAL: Don't modify tile position (x, y) - that moves tile off board!
    // Instead, use only rotation for shake effect
    // Store original rotation to restore it after shake
    if (g._originalShakeRotation === undefined) {
      g._originalShakeRotation = g.rotation || 0;
    }
    
    const originalRotation = g._originalShakeRotation;
    
    // Random rotation offset for this shake cycle (adds variation)
    const randomRotationOffset = (Math.random() - 0.5) * 0.1; // Small random offset: ±0.05 radians (~±3 degrees)
    
    // Create shake with 6 revolutions
    // Shake left-right-left-right-left-right 6 times (slower, looks like shaking)
    const shakeTl = gsap.timeline();
    
    // Each revolution is left-right, so 6 revolutions = 12 steps (6 left, 6 right)
    const stepDuration = shakeDuration / (revolutions * 2);
    
    // Start from original rotation with small random offset
    shakeTl.set(g, { 
      rotation: originalRotation + randomRotationOffset
    });
    
    for (let i = 0; i < revolutions * 2; i++) {
      const direction = i % 2 === 0 ? 1 : -1; // Alternate left-right
      
      shakeTl.to(g, {
        rotation: originalRotation + (direction * shakeRad) + randomRotationOffset,
        duration: stepDuration,
        ease: 'power1.inOut'
      });
    }
    
    // Return to original rotation
    shakeTl.to(g, {
      rotation: originalRotation,
      duration: stepDuration,
      ease: 'power1.inOut'
    });
  };
  
  // Perform shake immediately
  performShake();
  
  // Schedule shake every 3 seconds (idle shake with pause)
  const scheduleShake = () => {
    if (!tile || tile.destroyed) return;
    
    const delayedCall = gsap.delayedCall(3.0, () => {
      if (!tile || tile.destroyed) return;
      performShake();
      scheduleShake(); // Schedule next shake after 3 seconds
    });
    
    // Store delayed call for cleanup
    __globalDelayedCalls.add(delayedCall);
    if (!tile._magnetShakeDelayedCalls) tile._magnetShakeDelayedCalls = [];
    tile._magnetShakeDelayedCalls.push(delayedCall);
    tile._magnetShakeTl = delayedCall;
  };
  
  scheduleShake();
}

/**
 * Stop magnet shake animation
 */
export function stopMagnetShake(tile) {
  if (!tile) return;
  
  // Kill timeline
  if (tile._magnetShakeTl) {
    try {
      tile._magnetShakeTl.kill();
    } catch {}
    tile._magnetShakeTl = null;
  }
  
  // Kill all delayed calls (if any)
  if (tile._magnetShakeDelayedCalls) {
    tile._magnetShakeDelayedCalls.forEach(call => {
      try {
        call.kill();
        __globalDelayedCalls.delete(call);
      } catch {}
    });
    tile._magnetShakeDelayedCalls = [];
  }
  
  // Reset rotation only (don't touch position - that would move tile off board!)
  const g = tile.rotG || tile;
  if (g) {
    try {
      gsap.killTweensOf(g);
      // Reset to original rotation if stored, otherwise 0
      const resetRotation = g._originalShakeRotation !== undefined ? g._originalShakeRotation : 0;
      gsap.set(g, { rotation: resetRotation });
      // Clear stored original rotation
      g._originalShakeRotation = undefined;
    } catch {}
  }
  
  // Clear random shake parameters
  tile._magnetShakeAngle = undefined;
  tile._magnetShakeDurationMultiplier = undefined;
}

export function stopWildIdle(tile){
  if (!tile) return;
  
  // 🔥 MEMORY LEAK FIX: Remove visibility event listener
  try {
    if (tile._visibilityListener) {
      document.removeEventListener('visibilitychange', tile._visibilityListener);
      tile._visibilityListener = null;
    }
  } catch {}
  
  try { tile._wildIdleTl?.kill?.(); } catch {}
  try { stopWildStars(tile); } catch {}
  tile._wildIdleTl = null;
  
  // 🔥 MEMORY LEAK FIX: Kill all shimmer delayed calls
  try {
    if (tile._shimmerDelayedCalls && Array.isArray(tile._shimmerDelayedCalls)) {
      tile._shimmerDelayedCalls.forEach(call => {
        try { 
          call.kill(); 
          __globalDelayedCalls.delete(call);
        } catch {}
      });
      tile._shimmerDelayedCalls = [];
    }
  } catch {}
  
  try {
    if (tile._wildShimmer){
      // Kill any ongoing shimmer animations
      if (tile._wildShimmerSprite) {
        gsap.killTweensOf(tile._wildShimmerSprite);
      }
      gsap.killTweensOf(tile._wildShimmer);
      
      // Clean up shimmer elements
      if (tile._wildShimmer.mask) tile._wildShimmer.mask = null;
      tile._wildShimmer.parent?.removeChild(tile._wildShimmer);
      tile._wildShimmer.destroy?.();
    }
    if (tile._wildMask){ tile._wildMask.parent?.removeChild(tile._wildMask); tile._wildMask.destroy?.(); }
  } catch {}
  
  // Clear all delayed calls for this tile to prevent shimmer scheduling
  try {
    gsap.killTweensOf(tile);
  } catch {}
  
  tile._wildShimmer = null;
  tile._wildShimmerSprite = null;
  tile._wildMask = null;
}
