// src/modules/fx.ts
// Minimal FX surface used by app.js (stable named exports).

import { Container, Graphics, Text, Texture, Sprite, Board } from 'pixi.js';
import { gsap } from 'gsap';
import type { Tile } from '../types/game-types.js';

import { attachWildStarHalo, detachWildStarHalo, preloadWildStarTexture } from './wild-stars.ts';
import { TILE } from './constants.js';
import { graphicsPool } from './object-pool.ts';
import { selectPattern, getColor, getParams, getActiveTemplate, getDragParticleColors, getBubbleColors } from './templates/template-manager.ts';

try {
  preloadWildStarTexture();
} catch {}

// Lightweight FX throttling to reduce particle load during rapid back-to-back merges.
const FX_HOT_WINDOW_MS = 320;
let lastFxBurstTs: number = 0;
const nowTs = (): number => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
function getFxHotFactor(): number {
  const now = nowTs();
  const delta = now - lastFxBurstTs;
  lastFxBurstTs = now;
  if (delta >= FX_HOT_WINDOW_MS) return 1;
  // Blend from 0.55 → 1 based on elapsed time inside the window.
  return 0.55 + (delta / FX_HOT_WINDOW_MS) * 0.45;
}

export function startWildStars(tile: Tile): void {
  attachWildStarHalo(tile);
}

export function stopWildStars(tile: Tile): void {
  detachWildStarHalo(tile);
}

// 🔥 WILD-BEER: Continuous bubble animation system
const wildBeerBubbleSystems = new Map<any, any>();

// FPS monitoring for dynamic quality reduction
let fpsMonitorActive: boolean = false;
let fpsFrameCount: number = 0;
let fpsStartTime: number = 0;
let currentFps: number = 60;
let lastFpsCheck: number = 0;

/**
 * Start FPS monitoring
 */
function startFpsMonitoring(): void {
  if (fpsMonitorActive) return;
  fpsMonitorActive = true;
  fpsFrameCount = 0;
  fpsStartTime = performance.now();
  lastFpsCheck = fpsStartTime;
  console.log('🎯 FPS monitoring started');
}

/**
 * Stop FPS monitoring and return current FPS
 */
function stopFpsMonitoring(): number {
  if (!fpsMonitorActive) return currentFps;
  fpsMonitorActive = false;
  const elapsed = performance.now() - fpsStartTime;
  if (elapsed > 0) {
    currentFps = (fpsFrameCount * 1000) / elapsed;
  }
  console.log(`🎯 FPS monitoring stopped - Average FPS: ${currentFps.toFixed(1)}`);
  return currentFps;
}

/**
 * Update FPS counter (call this each frame)
 * 🔥 PERFORMANCE FIX: Throttled to every 2nd frame to reduce overhead
 */
let fpsUpdateCounter: number = 0;
function updateFpsCounter(): void {
  // 🔥 PERFORMANCE FIX: Throttle to every 2nd frame (50% reduction in overhead)
  fpsUpdateCounter++;
  if (fpsUpdateCounter % 2 !== 0) return; // Skip every other frame
  if (!fpsMonitorActive) return;
  fpsFrameCount++;
  const now = performance.now();
  // Update current FPS every 500ms for responsiveness
  if (now - lastFpsCheck >= 500) {
    const elapsed = now - fpsStartTime;
    if (elapsed > 0) {
      currentFps = (fpsFrameCount * 1000) / elapsed;
    }
    lastFpsCheck = now;
  }
}

/**
 * Get dynamic bubble count based on current FPS (simplified version)
 */
function getDynamicBubbleCount(baseCount: number): number {
  if (currentFps >= 40) return baseCount; // Full quality
  if (currentFps >= 25) return Math.max(20, Math.floor(baseCount * 0.7)); // 70% quality
  if (currentFps >= 15) return Math.max(15, Math.floor(baseCount * 0.5)); // 50% quality
  return Math.max(10, Math.floor(baseCount * 0.3)); // 30% quality minimum
}

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
  // 🔥 CRITICAL: PROTECT star animation delayed calls from being killed
export function killAllDelayedCalls() {
  console.log(`🧹 Killing ${__globalDelayedCalls.size} pending delayed calls`);
  __globalDelayedCalls.forEach(call => {
    try {
      // 🔥 CRITICAL: Skip killing protected star animation delayed calls
      if (call && call._isProtectedStarAnimation) {
        console.log('🛡️ Skipping protected star animation delayed call');
        return;
      }
      call.kill();
    } catch {}
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

/**
 * 🎨 Template-Based Drag Particles for Wild-Magnet
 * 
 * Uses template-based pooling and colors for reliable, optimized drag particles.
 * This replaces magicSparklesAtTile for wild-magnet tiles.
 * 
 * @param {Container} board - Game board container
 * @param {object} tile - Tile object
 * @param {object} opts - Options (intensity, zIndex, etc.)
 */
export function wildMagnetDragParticlesTemplated(board, tile, opts = {}) {
  if (!board || !tile) {
    console.warn('⚠️ wildMagnetDragParticlesTemplated: Missing board or tile', { board: !!board, tile: !!tile });
    return;
  }
  
  // 🔥 CRITICAL: Ensure tile.special is set to 'wild-magnet' for correct color retrieval
  if (!tile.special || tile.special !== 'wild-magnet') {
    console.warn('⚠️ wildMagnetDragParticlesTemplated: tile.special is not "wild-magnet", setting it now');
    tile.special = 'wild-magnet';
  }

  // 🔥 TEMPLATE-BASED: Select pattern from template (uses round-robin selection)
  const patternInfo = selectPattern('wildMagnetDrag');
  
  console.log('🧲 wildMagnetDragParticlesTemplated: Called', { 
    hasPatternInfo: !!patternInfo, 
    intensity: opts.intensity ?? 1.0,
    tileSpecial: tile?.special 
  });
  
  if (!patternInfo) {
    console.error('❌ wildMagnetDragParticlesTemplated: No pattern selected - template manager may not be initialized');
    // Fallback: Use generic graphicsPool with red colors
    console.log('🔄 Falling back to generic graphicsPool');
    let colors = getDragParticleColors('wild-magnet');
    if (!colors || !Array.isArray(colors) || colors.length === 0) {
      colors = [0xF26034, 0xF57A5A, 0xF89480, 0xFBAEA6, 0xFDC8CC];
    }
    const intensity = opts.intensity ?? 1.0;
    const particleCount = Math.max(1, Math.round(20 * intensity));
    
    const center = centerInBoard(board, tile, 96);
    
    for (let i = 0; i < particleCount; i++) {
      const particle = graphicsPool.acquire();
      particle.clear();
      __globalGraphicsObjects.add(particle);
      
      const color = colors[Math.floor(Math.random() * colors.length)];
      // 🔥 USER REQUEST: For idle particles (intensity < 0.5), use original size; for drag, use 50% smaller
      const isIdle = intensity < 0.5;
      const sizeMultiplier = isIdle ? 1.0 : 0.5;
      const width = (12 + Math.random() * 12) * sizeMultiplier;
      const height = (16 + Math.random() * 16) * sizeMultiplier;
      
      particle.rect(-width/2, -height/2, width, height).fill({ color, alpha: intensity });
      particle.visible = true;
      particle.alpha = 1.0;
      
      const angle = Math.random() * Math.PI * 2;
      // 🔥 USER REQUEST: 60% more spread from center (multiply distance by 1.6)
      const distance = 96 * (0.1 + Math.random() * 0.6) * 1.6;
      particle.x = center.x + Math.cos(angle) * distance;
      particle.y = center.y + Math.sin(angle) * distance;
      particle.rotation = Math.random() * Math.PI * 2;
      particle.zIndex = (tile?.zIndex ?? 0) + 0.001;
      
      board.addChild(particle);
      
      // 🔥 USER REQUEST: For idle particles, use longer duration and slower fade
      const baseDuration = 0.3 + Math.random() * 0.3;
      const duration = isIdle ? 2.5 : baseDuration;  // 2.5 seconds for idle
      const targetAlpha = isIdle ? 0.1 : 0;  // Idle particles fade to 10% opacity
      
      const endAngle = angle + (Math.random() - 0.5) * 1.0;
      const endDistance = distance * (1.5 + Math.random() * 0.5);
      const endX = center.x + Math.cos(endAngle) * endDistance;
      const endY = center.y + Math.sin(endAngle) * endDistance;
      
      gsap.to(particle, {
        x: endX,
        y: endY,
        rotation: particle.rotation + (Math.random() - 0.5) * Math.PI * 2,
        duration: duration,
        ease: 'power1.out',
        onComplete: () => {
          try {
            if (particle?.parent) particle.parent.removeChild(particle);
            __globalGraphicsObjects.delete(particle);
            graphicsPool.release(particle);
          } catch {}
        }
      });
      
      // 🔥 USER REQUEST: Separate fade animation for idle particles (slower fade)
      if (isIdle) {
        gsap.to(particle, {
          alpha: targetAlpha,
          duration: duration * 0.4,  // Fade over last 40% of animation
          delay: duration * 0.6,
          ease: 'power1.out'
        });
      } else {
        // Drag particles fade immediately
        gsap.to(particle, {
          alpha: 0,
          duration: duration,
          ease: 'power1.out'
        });
      }
    }
    return;
  }
  
  const { patternName, patternData, pool, template } = patternInfo;
  const params = getParams('wildMagnetDrag');
  let colors = getDragParticleColors('wild-magnet'); // 🔥 RED palette for wild-magnet
  
  if (!colors || !Array.isArray(colors) || colors.length === 0) {
    console.error('❌ wildMagnetDragParticlesTemplated: Invalid colors array, using red fallback');
    colors = [0xF26034, 0xF57A5A, 0xF89480, 0xFBAEA6, 0xFDC8CC];
  }
  
  const intensity = opts.intensity ?? 1.0;
  const baseTile = params.baseTile || 96;
  
  // Use custom position if provided, otherwise use tile center
  let x, y;
  if (opts.customPosition) {
    x = opts.customPosition.x;
    y = opts.customPosition.y;
  } else {
    const center = centerInBoard(board, tile, baseTile);
    x = center.x;
    y = center.y;
  }
  
  // Track particles for cleanup
  const particlesInBatch = [];
  
  // 🔥 USER REQUEST: Spawn same number of particles as before (20 particles at intensity 1.0)
  // Use pattern data for properties but spawn consistent number of particles
  const baseParticleCount = 20; // Same as original (before template system)
  const particleCount = Math.max(1, Math.round(baseParticleCount * intensity));
  
  console.log('🧲 wildMagnetDragParticlesTemplated: Spawning particles', {
    baseParticleCount,
    intensity,
    particleCount,
    patternName: patternInfo.patternName,
    patternDataLength: patternData.length,
    colorsCount: colors.length
  });
  
  for (let i = 0; i < particleCount; i++) {
    // Select a random particle definition from the pattern (for variety)
    const particleDef = patternData[Math.floor(Math.random() * patternData.length)];
    
    // 🔥 POOLING: Acquire Graphics from pattern-specific pool
    const particle = pool.acquire();
    
    // Clear and reset
    particle.clear();
    __globalGraphicsObjects.add(particle);
    
    // Get color from palette
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    // 🔥 USER REQUEST: Detect if this is idle particles (intensity < 0.5)
    const isIdle = intensity < 0.5;
    
    // Use pattern-defined size (with some randomization for variety)
    // 🔥 USER REQUEST: For idle particles (intensity < 0.5), use original size; for drag, use 50% smaller
    const sizeMultiplier = isIdle ? (particleDef.size || 1.0) : (particleDef.size || 1.0) * 0.5;
    const baseWidth = (12 + Math.random() * 12) * sizeMultiplier;
    const baseHeight = (16 + Math.random() * 16) * sizeMultiplier;
    
    // Draw rectangular particle (wild-magnet style)
    particle.rect(-baseWidth/2, -baseHeight/2, baseWidth, baseHeight)
           .fill({ color, alpha: particleDef.alpha || intensity });
    
    // 🔥 CRITICAL: Ensure particle is visible
    particle.visible = true;
    particle.alpha = particleDef.alpha || intensity;
    particle.eventMode = 'none';
    particle.cursor = 'default';
    try { particle.interactiveChildren = false; } catch {}
    
    // Use pattern-defined angle and distance (with spread multiplier)
    const angle = (particleDef.angle * Math.PI) / 180;
    const distance = particleDef.distance * baseTile * (params.spread || 0.7);
    
    particle.x = x + Math.cos(angle) * distance;
    particle.y = y + Math.sin(angle) * distance;
    particle.rotation = Math.random() * Math.PI * 2;
    
    // Z-INDEX handling
    if (opts.zIndex != null) {
      particle.zIndex = opts.zIndex;
    } else {
      const tileZ = tile?.zIndex ?? 0;
      particle.zIndex = tileZ + 0.001;
    }
    
    board.addChild(particle);
    particlesInBatch.push(particle);
    
    // Sort children to ensure correct zIndex order
    try {
      board.sortChildren?.();
    } catch {}
    
    // Animate particle (use pattern-defined speed)
    // 🔥 USER REQUEST: For idle particles, use longer duration and slower fade
    const baseTravelDur = params.travelDuration || 0.3;
    const travelDur = isIdle 
      ? 2.5 * (particleDef.speed || 1.0)  // 2.5 seconds for idle particles
      : baseTravelDur * (particleDef.speed || 1.0);  // Original duration for drag
    
    const endAngle = angle + (Math.random() - 0.5) * 1.0;
    const endDistance = distance * (1.5 + Math.random() * 0.5);
    const endX = x + Math.cos(endAngle) * endDistance;
    const endY = y + Math.sin(endAngle) * endDistance;
    
    // 🔥 USER REQUEST: For idle particles, fade slower and don't fade to 0 completely
    const targetAlpha = isIdle ? 0.1 : 0;  // Idle particles fade to 10% opacity, not 0
    const fadeStartDelay = isIdle ? travelDur * 0.6 : 0;  // Start fading later for idle
    
    gsap.to(particle, {
      x: endX,
      y: endY,
      rotation: particle.rotation + (Math.random() - 0.5) * Math.PI * 2,
      duration: travelDur,
      ease: 'power1.out',
      onComplete: () => {
        try {
          if (particle?.parent) {
            particle.parent.removeChild(particle);
          }
          __globalGraphicsObjects.delete(particle);
          pool.release(particle); // 🔥 CRITICAL: Release to pattern-specific pool
        } catch (err) {
          console.warn('⚠️ Error cleaning up drag particle:', err);
        }
      }
    });
    
      // 🔥 USER REQUEST: Separate fade animation for idle particles (slower fade)
      if (isIdleFallback) {
      gsap.to(particle, {
        alpha: targetAlpha,
        duration: travelDur * 0.4,  // Fade over last 40% of animation
        delay: fadeStartDelay,
        ease: 'power1.out'
      });
    } else {
      // Drag particles fade immediately
      gsap.to(particle, {
        alpha: 0,
        duration: travelDur,
        ease: 'power1.out'
      });
    }
  }
  
  // Cleanup after TTL (longer for idle particles)
  const baseTtl = params.ttl || 0.6;
  const ttl = (intensity < 0.5) ? 3.5 : baseTtl;  // 🔥 USER REQUEST: 3.5 seconds for idle, original for drag
  gsap.delayedCall(ttl, () => {
    particlesInBatch.forEach((particle) => {
      try {
        gsap.killTweensOf(particle);
        gsap.killTweensOf(particle.x);
        gsap.killTweensOf(particle.y);
        gsap.killTweensOf(particle.alpha);
        gsap.killTweensOf(particle.rotation);
        
        if (particle?.parent) {
          particle.parent.removeChild(particle);
        }
        __globalGraphicsObjects.delete(particle);
        pool.release(particle); // 🔥 CRITICAL: Release to pattern-specific pool
      } catch (err) {
        console.warn('⚠️ Error cleaning up drag particle in delayed cleanup:', err);
      }
    });
  });
}

export function magicSparklesAtTile(board, tile, opts = {}){
  if (!board || !tile) {
    console.warn('⚠️ magicSparklesAtTile: Missing board or tile', { board: !!board, tile: !!tile });
    return;
  }

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
  // 🔥 USER REQUEST: Increased shard count to 20 for all wild tiles (wild beer, wild star, wild magnet)
  const baseShardCount = 20; // Increased from 12 to 20 (67% increase) for more visible smoke trail
  const shardCount = Math.max(1, Math.round(baseShardCount * intensity)); // Scale shard count by intensity (50% = 10 shards, 100% = 20 shards)
  const baseTile = Math.max(60, Math.min(200, opts.tileSize ?? 96));
  
  // 🔥 TEMPLATE-BASED: Get drag particle colors from active template (wooden style)
  // This ensures consistent colors across all effects and allows easy theming
  // Wild star (wild): Yellow colors (#FFCB47 and yellow shades) - ORIGINAL COLOR
  // Wild beer: Orange colors (FBD295 / F9BE9C / F6E6C8 / F99D77) - ORIGINAL COLOR
  // Wild magnet: Red colors (#F26034 and red shades) - ORIGINAL COLOR
  // Default: Beige/cream colors for regular tiles
  let colors;
  const tileSpecial = tile?.special || null;
  
  // 🔥 DEBUG: Log particle creation for wild tiles
  // if (tileSpecial === 'wild' || tileSpecial === 'wild-beer' || tileSpecial === 'wild-magnet') {
  //   console.log(`✨ magicSparklesAtTile: Creating ${shardCount} particles for ${tileSpecial} at (${x.toFixed(1)}, ${y.toFixed(1)}), intensity=${intensity}`);
  // }
  
  try {
    colors = getDragParticleColors(tileSpecial);
    if (!colors || !Array.isArray(colors) || colors.length === 0) {
      console.error(`❌ getDragParticleColors returned empty/invalid array for ${tileSpecial}`);
      // 🔥 CRITICAL FIX: Use correct fallback based on tile type, NOT white!
      if (tileSpecial === 'wild-beer') {
        colors = [0xFBD295, 0xF9BE9C, 0xF6E6C8, 0xF99D77]; // Orange palette for beer
        console.warn(`⚠️ Using hardcoded orange fallback for wild-beer`);
      } else if (tileSpecial === 'wild' || tileSpecial === 'wildStar') {
        colors = [0xFFCB47, 0xFFD966, 0xFFE699, 0xFFF0B3, 0xFFF5CC]; // Yellow palette for wild star
        console.warn(`⚠️ Using hardcoded yellow fallback for wild`);
      } else if (tileSpecial === 'wild-magnet') {
        colors = [0xF26034, 0xF57A5A, 0xF89480, 0xFBAEA6, 0xFDC8CC]; // Red palette for magnet
        console.warn(`⚠️ Using hardcoded red fallback for wild-magnet`);
      } else {
        colors = [0xF4EEE7, 0xFBE3C5, 0xECD7C2, 0xE5C7AD, 0xFADEC0]; // Beige/cream for regular
        console.warn(`⚠️ Using beige/cream fallback for ${tileSpecial || 'regular'}`);
      }
    }
  } catch (err) {
    console.error('❌ Failed to get drag particle colors from template:', err);
    // 🔥 CRITICAL FIX: Use correct fallback based on tile type, NOT white!
    if (tileSpecial === 'wild-beer') {
      colors = [0xFBD295, 0xF9BE9C, 0xF6E6C8, 0xF99D77]; // Orange palette for beer
    } else if (tileSpecial === 'wild' || tileSpecial === 'wildStar') {
      colors = [0xFFCB47, 0xFFD966, 0xFFE699, 0xFFF0B3, 0xFFF5CC]; // Yellow palette for wild star
    } else if (tileSpecial === 'wild-magnet') {
      colors = [0xF26034, 0xF57A5A, 0xF89480, 0xFBAEA6, 0xFDC8CC]; // Red palette for magnet
    } else {
      colors = [0xF4EEE7, 0xFBE3C5, 0xECD7C2, 0xE5C7AD, 0xFADEC0]; // Beige/cream for regular
    }
  }
  
  // 🔥 CRITICAL: Ensure colors array is valid and not empty - NEVER use white fallback!
  if (!colors || !Array.isArray(colors) || colors.length === 0) {
    console.error(`❌ CRITICAL: Invalid colors array for ${tileSpecial}, using appropriate fallback`);
    if (tileSpecial === 'wild-beer') {
      colors = [0xF99D77]; // At least use orange for beer
    } else if (tileSpecial === 'wild' || tileSpecial === 'wildStar') {
      colors = [0xFFCB47]; // At least use yellow for wild star
    } else if (tileSpecial === 'wild-magnet') {
      colors = [0xF26034]; // At least use red for magnet
    } else {
      colors = [0xF4EEE7]; // At least use beige for regular
    }
  }
  
  // 🔥 MEMORY LEAK FIX: Track particles for idle animations (for immediate cleanup when tile is destroyed)
  const isIdleParticles = opts.trackForIdle === true; // Only track if explicitly requested (for idle particles)
  const particlesToTrack = isIdleParticles ? [] : null; // Only create array if tracking is needed
  
  for (let i = 0; i < shardCount; i++) {
    // 🔥 OBJECT POOLING: Use pool instead of creating new Graphics
    const shard = graphicsPool.acquire();
    if (!shard || shard.destroyed || typeof shard.clear !== 'function') {
      console.warn('⚠️ magicSparklesAtTile: Skipping invalid shard from pool', shard);
      continue;
    }
    
    // 🔥 CRITICAL: Clear any previous drawing commands before reuse
    shard.clear();
    
    // 🔥 CRITICAL: Reset all properties to ensure clean state (no blend mode, no tint, etc.)
    shard.tint = 0xFFFFFF; // Reset tint to white (no color modification)
    shard.blendMode = 'normal'; // Ensure normal blend mode
    shard.alpha = 1.0; // Reset alpha before drawing
    
    // 🔥 MEMORY LEAK FIX: Track Graphics object
    __globalGraphicsObjects.add(shard);
    
    // 🔥 MEMORY LEAK FIX: Track particle for idle animations cleanup
    if (isIdleParticles && particlesToTrack) {
      particlesToTrack.push(shard);
    }
    
    // Wild cube shard colors
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    // 🔥 DEBUG: Log first few particles for wild-magnet to verify colors
    const isWildMagnet = tile?.special === 'wild-magnet';
    // if (isWildMagnet && i < 3) {
    //   console.log(`🧲 Particle ${i}: color=0x${color.toString(16).toUpperCase()}, intensity=${intensity}, tile.special=${tile?.special}`);
    // }
    
    // Size multiplier support
    const sizeMultiplier = opts.sizeMultiplier ?? 1;
    
    // 🔥 USER REQUEST: Wild beer uses circles instead of rectangles for smoke trail
    const isWildBeer = tile?.special === 'wild-beer';
    
    // 🔥 CRITICAL: Calculate alpha BEFORE drawing (intensity controls opacity)
    const fillAlpha = intensity; // Direct opacity value for fill
    
    if (isWildBeer) {
      // Wild beer: use circles (bubbles-like particles)
      const baseRadius = 8 + Math.random() * 8; // 8-16px base radius
      const radius = baseRadius * sizeMultiplier; // Scale by multiplier
      
      shard.circle(0, 0, radius)
           .fill({ color: color, alpha: fillAlpha });
    } else {
      // Other tiles: use rectangular shards (original behavior)
      const baseWidth = 12 + Math.random() * 12; // 12-24px base
      const baseHeight = 16 + Math.random() * 16; // 16-32px base
      const width = baseWidth * sizeMultiplier; // Scale by multiplier
      const height = baseHeight * sizeMultiplier; // Scale by multiplier
    
      shard.rect(-width/2, -height/2, width, height)
           .fill({ color: color, alpha: fillAlpha }); // Use fillAlpha, not intensity directly
    }
    
    // 🔥 CRITICAL: Ensure shard is visible and has correct properties
    shard.visible = true;
    // 🔥 CRITICAL: Don't override fill alpha - let GSAP animate it from fillAlpha to 0
    shard.alpha = fillAlpha; // Start at fillAlpha (not 1.0), so intensity is respected
    
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
      // 🔥 OPTIMIZATION: Reduced duration from 0.5-0.9s to 0.3-0.6s (faster cleanup, less CPU/GPU pressure)
      duration: 0.3 + Math.random() * 0.3, // Faster fade for better performance
      ease: 'power1.out', // Constant speed for trailing
      onComplete: () => {
        try {
          if (shard && shard.parent) {
            shard.parent.removeChild(shard);
          }
          // 🔥 MEMORY LEAK FIX: Remove from tracker
          __globalGraphicsObjects.delete(shard);
          // 🔥 MEMORY LEAK FIX: Remove from idle particles tracking if tracked
          if (isIdleParticles && particlesToTrack) {
            const idx = particlesToTrack.indexOf(shard);
            if (idx !== -1) {
              particlesToTrack.splice(idx, 1);
            }
          }
          // 🔥 OBJECT POOLING: Release back to pool instead of destroying
          graphicsPool.release(shard);
        } catch (err) {
          // Ignore cleanup errors
        }
      }
    });
  }
  
  // 🔥 MEMORY LEAK FIX: Store tracked particles on tile for immediate cleanup
  if (isIdleParticles && particlesToTrack && particlesToTrack.length > 0) {
    if (!tile._magnetIdleParticles) {
      tile._magnetIdleParticles = [];
    }
    tile._magnetIdleParticles.push(...particlesToTrack);
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

  // 🔥 CRITICAL: Check for wild-beer (before wild star)
  const srcIsWildBeer = srcSpecial === 'wild-beer';
  const dstIsWildBeer = dstSpecial === 'wild-beer';
  const isWildBeer = srcIsWildBeer || dstIsWildBeer;

  // 🔥 CRITICAL: Check both src and dst for wild (not wild-magnet, not wild-beer)
  // If either src or dst is wild (and not wild-magnet, not wild-beer), then it's a wild merge
  const srcIsWild = srcSpecial === 'wild' && !srcIsWildMagnet && !srcIsWildBeer;
  const dstIsWild = dstSpecial === 'wild' && !dstIsWildMagnet && !dstIsWildBeer;
  const isWild = srcIsWild || dstIsWild;

  // Determine shard color
  const yellowColor = 0xFFCB47; // Yellow (#FFCB47) for wild-only (wild star)
  const redColor = 0xF26034;    // Red (#F26034) for wild-magnet
  const beerColor = 0xF99D77;   // Orange (#F99D77) for wild-beer
  const brownColor = 0xD4A584;   // Brown (#D4A584) for regular merge 6

  let shardColor = brownColor;
  if (isWildMagnet) {
    shardColor = redColor; // Wild-magnet → red
  } else if (isWildBeer) {
    shardColor = beerColor; // Wild-beer → orange (#F99D77)
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
    srcIsWildBeer,
    dstIsWildBeer,
    isWildBeer,
    shardColor: shardColor.toString(16)
  });

  return {
    isWild,
    isWildMagnet,
    isWildBeer,
    shardColor,
    isRegular: !isWild && !isWildMagnet && !isWildBeer
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
    wild: config.isWild || config.isWildMagnet || config.isWildBeer, // true if wild, wild-magnet, or wild-beer
    wildMagnet: config.isWildMagnet, // true only if wild-magnet
    isWildBeer: config.isWildBeer, // 🔥 CRITICAL: Pass wild-beer flag for correct color (#F99D77)
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
  
  // 🔥 DEBUG: Log layer creation
  console.log('🔍 regularMerge6Shards layer created:', {
    x, y,
    layerVisible: layer.visible,
    layerAlpha: layer.alpha,
    layerZIndex: layer.zIndex,
    inBoard: board.children.includes(layer),
    boardVisible: board.visible,
    boardAlpha: board.alpha
  });
  
  // 🔥 CRITICAL FIX: Track all shards in layer for proper cleanup
  const shardsInLayer = [];
  
  // Auto-remove after TTL
  const ttl = opts.ttl ?? 1.6;
  gsap.delayedCall(ttl, () => {
    try {
      // 🔥 CRITICAL FIX: Destroy ALL shards BEFORE destroying layer
      // Using destroy() instead of pooling to avoid rendering issues
      if (layer && layer.children) {
        const children = [...layer.children]; // Copy array to avoid modification during iteration
        children.forEach((shard) => {
          try {
            // Kill all GSAP animations on shard
            gsap.killTweensOf(shard);
            gsap.killTweensOf(shard.x);
            gsap.killTweensOf(shard.y);
            gsap.killTweensOf(shard.alpha);
            gsap.killTweensOf(shard.rotation);
            gsap.killTweensOf(shard.scale);
            
            // Remove from layer
            if (layer.children.includes(shard)) {
              layer.removeChild(shard);
            }
            
            // Destroy shard (NOT pooling - pooling causes rendering issues)
            shard.destroy();
          } catch (err) {
            console.warn('⚠️ Error destroying shard in layer cleanup:', err);
          }
        });
      }
      
      // Now safe to remove layer from board and destroy it
      if (layer && layer.parent === board) {
        board.removeChild(layer);
      }
      
      // Destroy layer (should be empty now, all children destroyed)
      layer.destroy?.({ children: false }); // children: false because we already destroyed them
    } catch (err) {
      console.warn('⚠️ Error in layer cleanup:', err);
    }
  });
  
  // Shard parameters - 200% larger (2x zoom, reduced from 4x) OR custom from opts
  // 🔥 OPTIMIZED: Default reduced from 13 to 10 for better performance (can be overridden via opts.count)
  const shardCount = opts.count ?? 10;
  const brownColor = 0xD4A584; // Brown color
  const yellowColor = 0xFFCB47; // Yellow (#FFCB47) for wild-only (wild star)
  const beerColor = 0xF99D77;   // Orange (#F99D77) for wild-beer
  const isWildOnly = opts.isWildOnly === true; // Flag to use yellow/brown colors
  const isWildBeer = opts.isWildBeer === true; // Flag to use beer color
  const baseTile = 96;
  const sizeMultiplier = opts.sizeMultiplier ?? 2.4; // Default 240% larger (20% increase from 2.0), can be overridden
  const distanceMultiplier = opts.distanceMultiplier ?? 5.6; // Default 560% larger distance (40% increase from 4.0), can be overridden
  const minDistance = (baseTile * 0.08) * distanceMultiplier;
  const maxDistance = (baseTile * 0.24) * distanceMultiplier;
  
  // Create shards
  for (let i = 0; i < shardCount; i++) {
    // 🔥 CRITICAL FIX: Use new Graphics() instead of pooling for regularMerge6Shards
    // Pooling causes rendering issues - shards become invisible after first use
    // This is a known issue with Graphics pooling in PixiJS when geometry is complex
    const shard = new Graphics();
    
    // 🔥 CRITICAL: Set visibility and transform properties
    shard.visible = true;
    shard.alpha = 1.0;
    shard.scale.set(1, 1);
    shard.rotation = 0;
    shard.x = 0;
    shard.y = 0;
    
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
    
    // Determine shard color - beer color for wild-beer, yellow/brown for wild-only (wild star), brown for regular
    let shardColor = brownColor;
    if (isWildBeer) {
      // Wild-beer: use beer color (#F99D77)
      shardColor = beerColor;
    } else if (isWildOnly) {
      // Wild-only (wild star): 50% yellow, 50% brown
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
    
    // 🔥 CRITICAL FIX: Force update bounds after drawing (ensures proper rendering)
    try {
      if (typeof shard.updateBounds === 'function') {
        shard.updateBounds();
      }
    } catch {}
    
    // Position and rotation (AFTER drawing, so shard is visible)
    shard.rotation = Math.random() * Math.PI;
    shard.x = 0;
    shard.y = 0;
    shard.alpha = 1.0;
    shard.visible = true; // 🔥 CRITICAL: Ensure visible (defensive)
    
    // 🔥 CRITICAL: Force render update (ensures shard is drawn before animation starts)
    try {
      if (shard.parent) {
        shard.parent.sortableChildren = true;
      }
    } catch {}
    
    // 🔥 CRITICAL: Add to layer BEFORE animation (ensures shard is in display tree)
    layer.addChild(shard);
    
    // 🔥 CRITICAL FIX: Track shard in layer for proper cleanup
    shardsInLayer.push(shard);
    
    // 🔥 DEBUG: Log shard creation (first 3 shards only to avoid spam)
    if (i < 3) {
      console.log(`🔍 Shard ${i} created:`, {
        visible: shard.visible,
        alpha: shard.alpha,
        x: shard.x,
        y: shard.y,
        rotation: shard.rotation,
        scale: { x: shard.scale.x, y: shard.scale.y },
        inLayer: layer.children.includes(shard),
        layerVisible: layer.visible,
        layerAlpha: layer.alpha,
        layerParent: !!layer.parent
      });
    }
    
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
            // 🔥 CRITICAL FIX: Kill all GSAP animations before destroy
            gsap.killTweensOf(shard);
            gsap.killTweensOf(shard.x);
            gsap.killTweensOf(shard.y);
            gsap.killTweensOf(shard.alpha);
            gsap.killTweensOf(shard.rotation);
            gsap.killTweensOf(shard.scale);
            
            // Remove from layer
            if (layer && layer.children.includes(shard)) {
              layer.removeChild(shard);
            }
            
            // Remove from tracking array
            const idx = shardsInLayer.indexOf(shard);
            if (idx >= 0) {
              shardsInLayer.splice(idx, 1);
            }
            
            // 🔥 CRITICAL FIX: Destroy shard instead of pooling (pooling causes rendering issues)
            shard.destroy();
          } catch (err) {
            console.warn('⚠️ Error destroying shard in onComplete:', err);
          }
        });
      }
    });
  }
  
  // NO STARS for regular merge 6 (ordinary + ordinary)
}

/* ---------- 🎨 TEMPLATE-BASED SHARD SYSTEM (NEW) ---------- */

/**
 * 🎨 Template-Based Regular Merge 6 Shards
 * 
 * Uses predefined patterns from the active template for reliable pooling.
 * This replaces the random generation approach with pattern-based approach.
 * 
 * @param {Container} board - Game board container
 * @param {object} tile - Tile object or snapshot with x/y coordinates
 * @param {object} opts - Options (zIndex, etc.)
 */
export function regularMerge6ShardsTemplated(board, tile, opts = {}) {
  if (!board || !tile) {
    console.warn('⚠️ regularMerge6ShardsTemplated: Missing board or tile', { board: !!board, tile: !!tile });
    return;
  }

  // Select pattern from template
  const patternInfo = selectPattern('regular');
  
  if (!patternInfo) {
    console.error('❌ regularMerge6ShardsTemplated: No pattern selected - template manager may not be initialized');
    // 🔥 FALLBACK: Use non-pooled version for reliability
    console.log('🔄 Falling back to non-pooled regularMerge6Shards');
    regularMerge6Shards(board, tile, opts);
    return;
  }
  
  const { patternName, patternData, pool, template } = patternInfo;
  const params = getParams('regular');
  const color = getColor('regular');
  
  console.log(`🎨 regularMerge6ShardsTemplated: Using pattern: ${patternName} (${patternData.length} shards)`, {
    color: `0x${color.toString(16)}`,
    poolSize: pool.getStats?.()?.poolSize || 'unknown',
    boardVisible: board.visible,
    boardAlpha: board.alpha
  });
  
  // Get position
  let x, y;
  if (tile.x !== undefined && tile.y !== undefined) {
    x = tile.x;
    y = tile.y;
  } else {
    const pos = centerInBoard(board, tile, params.tileSize || 96);
    x = pos.x;
    y = pos.y;
  }
  
  console.log(`🎨 regularMerge6ShardsTemplated: Position: (${x}, ${y})`);
  
  // Create layer
  const layer = new Container();
  layer.x = x;
  layer.y = y;
  layer.visible = true;
  layer.alpha = 1.0;
  layer.zIndex = opts.zIndex ?? 9993;
  
  // 🔥 CRITICAL: Add layer to board BEFORE creating shards
  board.addChild(layer);
  
  // 🔥 CRITICAL: Force sort to ensure zIndex is respected
  try {
    board.sortableChildren = true;
    board.sortChildren?.();
  } catch (e) {
    console.warn('⚠️ Failed to sort board children:', e);
  }
  
  console.log(`🎨 regularMerge6ShardsTemplated: Layer created and added to board`, {
    layerX: layer.x,
    layerY: layer.y,
    layerVisible: layer.visible,
    layerAlpha: layer.alpha,
    layerZIndex: layer.zIndex,
    layerInBoard: board.children.includes(layer),
    boardChildrenCount: board.children.length
  });
  
  // Track shards for cleanup
  const shardsInLayer = [];
  const baseTile = params.baseTile || 96;
  
  // Spawn each shard according to pattern
  patternData.forEach((shardDef, index) => {
    // 🔥 POOLING: Acquire Graphics from pattern-specific pool
    // pool.acquire() already calls reset() which handles all cleanup and reset
    const shard = pool.acquire();
    
    // Only set pattern-specific alpha (reset() already set it to 1.0)
    shard.alpha = shardDef.alpha || 1.0;
    
    // Draw shard (filled polygon shape - same as non-templated version)
    // 🔥 CRITICAL FIX: Use filled polygons instead of lines for visibility
    const baseSize = (8 + Math.random() * 10) * (shardDef.size || 1.0) * 2.4; // Match non-templated size
    const width = baseSize;
    const height = width * (0.8 + Math.random() * 1.4);
    
    // Create irregular polygon shape (same as non-templated regularMerge6Shards)
    const points = [];
    const numPoints = 4 + Math.floor(Math.random() * 4); // 4-7 points
    
    for (let j = 0; j < numPoints; j++) {
      const angle = (j / numPoints) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
      const radius = (0.3 + Math.random() * 0.7) * Math.min(width, height) / 2;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      points.push(px, py);
    }
    
    // Draw filled polygon using PixiJS v8 API
    try {
      shard.poly(points).fill({ color: color, alpha: params.lineAlpha || 0.85 });
    } catch (e) {
      // Fallback to rect if poly fails
      console.warn('⚠️ Failed to draw poly, using rect fallback:', e);
      shard.clear();
      const size = Math.max(4, Math.max(...points.map((p, i) => Math.abs(p))) * 2);
      shard.rect(-size/2, -size/2, size, size).fill({ color: shardColor, alpha: params.lineAlpha || 0.85 });
    }
    
    // 🔥 CRITICAL: Force bounds update AFTER drawing
    try {
      if (typeof shard.updateBounds === 'function') {
        shard.updateBounds();
      }
    } catch (e) {
      console.warn('⚠️ Failed to update shard bounds:', e);
    }
    
    // 🔥 CRITICAL: Set rotation BEFORE adding to layer (matches non-templated behavior)
    shard.rotation = Math.random() * Math.PI;
    
    // 🔥 CRITICAL: Add to layer BEFORE animation (ensures shard is in render tree)
    layer.addChild(shard);
    shardsInLayer.push(shard);
    
    // 🔥 DEBUG: Log first shard for verification
    if (index === 0) {
      console.log(`🎨 regularMerge6ShardsTemplated: First shard created`, {
        shardVisible: shard.visible,
        shardAlpha: shard.alpha,
        shardX: shard.x,
        shardY: shard.y,
        shardRotation: shard.rotation,
        shardInLayer: layer.children.includes(shard),
        layerChildrenCount: layer.children.length,
        color: `0x${color.toString(16)}`
      });
    }
    
    // Calculate travel distance (pattern distance is normalized 0-1)
    const angle = (shardDef.angle * Math.PI) / 180;
    const distance = shardDef.distance * baseTile * (params.spread || 1.0);
    const targetX = Math.cos(angle) * distance;
    const targetY = Math.sin(angle) * distance;
    
    // Animate shard
    const travelDur = (params.travelDuration || 0.35) * shardDef.speed;
    const fadeDelay = (params.fadeDelay || 0.15) + (params.fadeDelayMultiplier || 0.1) * Math.random();
    const fadeDur = params.fadeDuration || 0.25;
    
    gsap.to(shard, {
      x: targetX,
      y: targetY,
      duration: travelDur,
      ease: 'power2.out'
    });
    
    gsap.to(shard, {
      alpha: 0,
      delay: fadeDelay,
      duration: fadeDur,
      ease: 'power2.in'
    });
  });
  
  console.log(`🎨 regularMerge6ShardsTemplated: Created ${shardsInLayer.length} shards in layer`);
  
  // Cleanup layer after TTL
  const ttl = params.ttl || 1.0;
  gsap.delayedCall(ttl, () => {
    console.log(`🎨 regularMerge6ShardsTemplated: Cleaning up ${shardsInLayer.length} shards after TTL ${ttl}s`);
    
    // Return all shards to pool
    shardsInLayer.forEach((shard, idx) => {
      try {
        gsap.killTweensOf(shard);
        gsap.killTweensOf(shard.x);
        gsap.killTweensOf(shard.y);
        gsap.killTweensOf(shard.alpha);
        gsap.killTweensOf(shard.scale);
        gsap.killTweensOf(shard.rotation);
        
        if (shard.parent === layer) {
          layer.removeChild(shard);
        }
        pool.release(shard);
      } catch (e) {
        console.warn(`⚠️ Error cleaning up shard ${idx}:`, e);
      }
    });
    
    // Destroy layer
    try {
      layer.destroy({ children: false });
    } catch (e) {
      console.warn('⚠️ Error destroying layer:', e);
    }
  });
}

/**
 * 🎨 Template-Based Wild Magnet Merge 6 Shards
 * 
 * Uses predefined patterns from the active template for wild-magnet merges.
 * 
 * @param {Container} board - Game board container
 * @param {object} tile - Tile object or snapshot with x/y coordinates
 * @param {object} opts - Options (zIndex, isPullAnimation, etc.)
 */
export function wildMagnetMerge6ShardsTemplated(board, tile, opts = {}) {
  if (!board || !tile) {
    console.warn('⚠️ wildMagnetMerge6ShardsTemplated: Missing board or tile', { board: !!board, tile: !!tile });
    return;
  }

  // 🔥 FIX: Use pull-specific patterns for pull animations, regular patterns for main merge
  const mergeType = opts.isPullAnimation ? 'wildMagnetPull' : 'wildMagnet';
  const patternInfo = selectPattern(mergeType);
  
  if (!patternInfo) {
    console.error('❌ wildMagnetMerge6ShardsTemplated: No pattern selected - template manager may not be initialized');
    // 🔥 FALLBACK: Use woodShardsAtTile for reliability
    console.log('🔄 Falling back to woodShardsAtTile');
    woodShardsAtTile(board, tile, {
      enhanced: true,
      wild: true,
      wildMagnet: true,
      isWildBeer: false,
      count: 30,
      intensity: 1.9,
      spread: 0.3,
      size: 1.5,
      speed: 0.85,
      vanishDelay: 0.0,
      vanishJitter: 0.02
    });
    return;
  }
  
  const { patternName, patternData, pool, template } = patternInfo;
  const params = getParams('wildMagnet');
  const redColor = getColor('wildMagnet'); // Red for wild magnet
  const brownColor = getColor('regular');   // Brown for regular merge 6
  
  console.log(`🎨 wildMagnetMerge6ShardsTemplated: Using pattern: ${patternName} (${patternData.length} shards)`, {
    redColor: `0x${redColor.toString(16)}`,
    brownColor: `0x${brownColor.toString(16)}`,
    poolSize: pool.getStats?.()?.poolSize || 'unknown',
    boardVisible: board.visible,
    boardAlpha: board.alpha
  });
  
  // Get position
  let x, y;
  if (tile.x !== undefined && tile.y !== undefined) {
    x = tile.x;
    y = tile.y;
  } else {
    const pos = centerInBoard(board, tile, params.tileSize || 96);
    x = pos.x;
    y = pos.y;
  }
  
  console.log(`🎨 wildMagnetMerge6ShardsTemplated: Position: (${x}, ${y})`);
  
  // Create layer
  const layer = new Container();
  layer.x = x;
  layer.y = y;
  layer.visible = true;
  layer.alpha = 1.0;
  layer.zIndex = opts.zIndex ?? 9993;
  
  // 🔥 CRITICAL: Add layer to board BEFORE creating shards
  board.addChild(layer);
  
  // 🔥 CRITICAL: Force sort to ensure zIndex is respected
  try {
    board.sortableChildren = true;
    board.sortChildren?.();
  } catch (e) {
    console.warn('⚠️ Failed to sort board children:', e);
  }
  
  console.log(`🎨 wildMagnetMerge6ShardsTemplated: Layer created and added to board`, {
    layerX: layer.x,
    layerY: layer.y,
    layerVisible: layer.visible,
    layerAlpha: layer.alpha,
    layerZIndex: layer.zIndex,
    layerInBoard: board.children.includes(layer),
    boardChildrenCount: board.children.length
  });
  
  // Track shards for cleanup
  const shardsInLayer = [];
  const baseTile = params.baseTile || 96;
  
  // Spawn each shard according to pattern
  patternData.forEach((shardDef, index) => {
    // 🔥 POOLING: Acquire Graphics from pattern-specific pool
    // pool.acquire() already calls reset() which handles all cleanup and reset
    const shard = pool.acquire();
    
    // Only set pattern-specific alpha (reset() already set it to 1.0)
    shard.alpha = shardDef.alpha || 1.0;
    
    // 🔥 COLOR MIX: 38% brown (regular), 62% red (wild magnet)
    const useBrown = Math.random() < 0.38; // 38% chance for brown
    const shardColor = useBrown ? brownColor : redColor;
    
    // Draw shard (filled polygon shape - same as non-templated version)
    // 🔥 CRITICAL FIX: Use filled polygons instead of lines for visibility
    // Wild-magnet uses same size as regular merge
    const baseSize = (8 + Math.random() * 10) * (shardDef.size || 1.0) * 2.4; // Match regular merge size
    const width = baseSize;
    const height = width * (0.8 + Math.random() * 1.4);
    
    // Create irregular polygon shape (same as non-templated woodShardsAtTile)
    const points = [];
    const numPoints = 4 + Math.floor(Math.random() * 4); // 4-7 points
    
    for (let j = 0; j < numPoints; j++) {
      const angle = (j / numPoints) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
      const radius = (0.3 + Math.random() * 0.7) * Math.min(width, height) / 2;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      points.push(px, py);
    }
    
    // Draw filled polygon using PixiJS v8 API
    try {
      shard.poly(points).fill({ color: shardColor, alpha: params.lineAlpha || 0.85 });
    } catch (e) {
      // Fallback to rect if poly fails
      console.warn('⚠️ Failed to draw poly, using rect fallback:', e);
      shard.clear();
      const size = Math.max(4, Math.max(...points.map((p, i) => Math.abs(p))) * 2);
      shard.rect(-size/2, -size/2, size, size).fill({ color: shardColor, alpha: params.lineAlpha || 0.85 });
    }
    
    // 🔥 CRITICAL: Force bounds update AFTER drawing
    try {
      if (typeof shard.updateBounds === 'function') {
        shard.updateBounds();
      }
    } catch (e) {
      console.warn('⚠️ Failed to update shard bounds:', e);
    }
    
    // 🔥 CRITICAL: Set rotation BEFORE adding to layer (matches non-templated behavior)
    shard.rotation = Math.random() * Math.PI;
    
    // 🔥 CRITICAL: Add to layer BEFORE animation (ensures shard is in render tree)
    layer.addChild(shard);
    shardsInLayer.push(shard);
    
    // 🔥 DEBUG: Log first shard for verification
    if (index === 0) {
      console.log(`🎨 wildMagnetMerge6ShardsTemplated: First shard created`, {
        shardVisible: shard.visible,
        shardAlpha: shard.alpha,
        shardX: shard.x,
        shardY: shard.y,
        shardRotation: shard.rotation,
        shardInLayer: layer.children.includes(shard),
        layerChildrenCount: layer.children.length,
        shardColor: `0x${shardColor.toString(16)}`,
        isBrown: useBrown
      });
    }
    
    // Calculate travel distance (pattern distance is normalized 0-1)
    // 🔥 FIX: Add larger random offset for brown shards to prevent overlap with red shards
    // Brown shards get z-index offset to render behind red shards, plus position offset
    const angleOffset = useBrown ? (Math.random() - 0.5) * 25 : 0; // ±12.5 degrees for brown shards (larger offset)
    const distanceOffset = useBrown ? (Math.random() - 0.5) * 0.08 : 0; // ±4% distance offset for brown shards (larger offset)
    const angle = ((shardDef.angle + angleOffset) * Math.PI) / 180;
    const distance = (shardDef.distance + distanceOffset) * baseTile * (params.spread || 1.0);
    const targetX = Math.cos(angle) * distance;
    const targetY = Math.sin(angle) * distance;
    
    // 🔥 FIX: Set z-index offset for brown shards (render behind red shards)
    // Red shards: zIndex = 0 (default, on top)
    // Brown shards: zIndex = -1 (behind red shards)
    if (useBrown) {
      shard.zIndex = -1; // Brown shards render behind red shards
    } else {
      shard.zIndex = 0; // Red shards render on top
    }
    
    // Animate shard
    // 🔥 FIX: Add stagger delay for organic feel - shards don't all go at once
    // Each shard gets a small random delay (0-0.08s) to create organic, non-uniform explosion
    const staggerDelay = Math.random() * 0.08; // 0-80ms stagger for organic feel
    const travelDur = (params.travelDuration || 0.35) * shardDef.speed * (params.speed || 1.0);
    const fadeDelay = (params.fadeDelay ?? 0.15) + (params.fadeDelayMultiplier ?? 0.1) * Math.random();
    const fadeDur = params.fadeDuration ?? 0.25;
    
    gsap.to(shard, {
      delay: staggerDelay, // 🔥 Organic stagger - shards don't all start at once
      x: targetX,
      y: targetY,
      duration: travelDur,
      ease: 'power2.out'
    });
    
    gsap.to(shard, {
      alpha: 0,
      delay: fadeDelay,
      duration: fadeDur,
      ease: 'power2.in'
    });
  });
  
  console.log(`🎨 wildMagnetMerge6ShardsTemplated: Created ${shardsInLayer.length} shards in layer`);
  
  // Cleanup layer after TTL
  const ttl = params.ttl || 1.0;
  gsap.delayedCall(ttl, () => {
    console.log(`🎨 wildMagnetMerge6ShardsTemplated: Cleaning up ${shardsInLayer.length} shards after TTL ${ttl}s`);
    
    // Return all shards to pool
    shardsInLayer.forEach((shard, idx) => {
      try {
        gsap.killTweensOf(shard);
        gsap.killTweensOf(shard.x);
        gsap.killTweensOf(shard.y);
        gsap.killTweensOf(shard.alpha);
        gsap.killTweensOf(shard.scale);
        gsap.killTweensOf(shard.rotation);
        
        if (shard.parent === layer) {
          layer.removeChild(shard);
        }
        pool.release(shard);
      } catch (e) {
        console.warn(`⚠️ Error cleaning up shard ${idx}:`, e);
      }
    });
    
    // Destroy layer
    try {
      layer.destroy({ children: false });
    } catch (e) {
      console.warn('⚠️ Error destroying layer:', e);
    }
  });
}

/**
 * 🎨 Template-Based Wild Merge 6 Shards
 * 
 * Uses predefined patterns from the active template for wild merges.
 * 
 * @param {Container} board - Game board container
 * @param {object} tile - Tile object or snapshot with x/y coordinates
 * @param {object} opts - Options (zIndex, skipStars, etc.)
 */
export function wildMerge6ShardsTemplated(board, tile, opts = {}) {
  if (!board || !tile) {
    console.warn('⚠️ wildMerge6ShardsTemplated: Missing board or tile', { board: !!board, tile: !!tile });
    return;
  }

  // Select pattern from template
  const patternInfo = selectPattern('wild');
  
  if (!patternInfo) {
    console.error('❌ wildMerge6ShardsTemplated: No pattern selected - template manager may not be initialized');
    // 🔥 FALLBACK: Use woodShardsAtTile for reliability
    console.log('🔄 Falling back to woodShardsAtTile');
    woodShardsAtTile(board, tile, {
      enhanced: true,
      wild: true,
      wildMagnet: false,
      isWildBeer: false,
      skipStars: opts.skipStars,
      count: 18,
      intensity: 1.35,
      spread: 0.7,
      size: 1.3,
      speed: 1.0,
      vanishDelay: 0.0,
      vanishJitter: 0.02
    });
    return;
  }
  
  const { patternName, patternData, pool, template } = patternInfo;
  const params = getParams('wild');
  const color = getColor('wild');
  
  console.log(`🎨 wildMerge6ShardsTemplated: Using pattern: ${patternName} (${patternData.length} shards)`, {
    color: `0x${color.toString(16)}`,
    poolSize: pool.getStats?.()?.poolSize || 'unknown',
    boardVisible: board.visible,
    boardAlpha: board.alpha
  });
  
  // Get position
  let x, y;
  if (tile.x !== undefined && tile.y !== undefined) {
    x = tile.x;
    y = tile.y;
  } else {
    const pos = centerInBoard(board, tile, params.tileSize || 96);
    x = pos.x;
    y = pos.y;
  }
  
  console.log(`🎨 wildMerge6ShardsTemplated: Position: (${x}, ${y})`);
  
  // Create layer
  const layer = new Container();
  layer.x = x;
  layer.y = y;
  layer.visible = true;
  layer.alpha = 1.0;
  layer.zIndex = opts.zIndex ?? 9993;
  
  // 🔥 CRITICAL: Add layer to board BEFORE creating shards
  board.addChild(layer);
  
  // 🔥 CRITICAL: Force sort to ensure zIndex is respected
  try {
    board.sortableChildren = true;
    board.sortChildren?.();
  } catch (e) {
    console.warn('⚠️ Failed to sort board children:', e);
  }
  
  console.log(`🎨 wildMerge6ShardsTemplated: Layer created and added to board`, {
    layerX: layer.x,
    layerY: layer.y,
    layerVisible: layer.visible,
    layerAlpha: layer.alpha,
    layerZIndex: layer.zIndex,
    layerInBoard: board.children.includes(layer),
    boardChildrenCount: board.children.length
  });
  
  // Track shards for cleanup
  const shardsInLayer = [];
  const baseTile = params.baseTile || 96;
  
  // Spawn each shard according to pattern
  patternData.forEach((shardDef, index) => {
    // 🔥 POOLING: Acquire Graphics from pattern-specific pool
    // pool.acquire() already calls reset() which handles all cleanup and reset
    const shard = pool.acquire();
    
    // Only set pattern-specific alpha (reset() already set it to 1.0)
    shard.alpha = shardDef.alpha || 1.0;
    
    // Draw shard (filled polygon shape - same as non-templated version)
    // 🔥 CRITICAL FIX: Use filled polygons instead of lines for visibility
    // Wild merges use slightly larger base size
    const baseSize = (6 + Math.random() * 8) * (shardDef.size || 1.0) * 2.4; // Match non-templated wild size
    const width = baseSize;
    const height = width * (0.8 + Math.random() * 1.4);
    
    // Create irregular polygon shape (same as non-templated woodShardsAtTile)
    const points = [];
    const numPoints = 4 + Math.floor(Math.random() * 4); // 4-7 points
    
    for (let j = 0; j < numPoints; j++) {
      const angle = (j / numPoints) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
      const radius = (0.3 + Math.random() * 0.7) * Math.min(width, height) / 2;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      points.push(px, py);
    }
    
    // Draw filled polygon using PixiJS v8 API
    try {
      shard.poly(points).fill({ color: color, alpha: params.lineAlpha || 0.9 });
    } catch (e) {
      // Fallback to rect if poly fails
      console.warn('⚠️ Failed to draw poly, using rect fallback:', e);
      shard.clear();
      const size = Math.max(4, Math.max(...points.map((p, i) => Math.abs(p))) * 2);
      shard.rect(-size/2, -size/2, size, size).fill({ color: color, alpha: params.lineAlpha || 0.9 });
    }
    
    // 🔥 CRITICAL: Force bounds update AFTER drawing
    try {
      if (typeof shard.updateBounds === 'function') {
        shard.updateBounds();
      }
    } catch (e) {
      console.warn('⚠️ Failed to update shard bounds:', e);
    }
    
    // 🔥 CRITICAL: Set rotation BEFORE adding to layer (matches non-templated behavior)
    shard.rotation = Math.random() * Math.PI;
    
    // 🔥 CRITICAL: Add to layer BEFORE animation (ensures shard is in render tree)
    layer.addChild(shard);
    shardsInLayer.push(shard);
    
    // 🔥 DEBUG: Log first shard for verification
    if (index === 0) {
      console.log(`🎨 wildMerge6ShardsTemplated: First shard created`, {
        shardVisible: shard.visible,
        shardAlpha: shard.alpha,
        shardX: shard.x,
        shardY: shard.y,
        shardRotation: shard.rotation,
        shardInLayer: layer.children.includes(shard),
        layerChildrenCount: layer.children.length,
        color: `0x${color.toString(16)}`
      });
    }
    
    // Calculate travel distance (pattern distance is normalized 0-1)
    const angle = (shardDef.angle * Math.PI) / 180;
    const distance = shardDef.distance * baseTile * (params.spread || 1.0);
    const targetX = Math.cos(angle) * distance;
    const targetY = Math.sin(angle) * distance;
    
    // Animate shard
    const travelDur = (params.travelDuration || 0.4) * shardDef.speed;
    const fadeDelay = (params.vanishDelay || 0.0) + (params.vanishJitter || 0.02) * Math.random();
    const fadeDur = 0.3;
    
    gsap.to(shard, {
      x: targetX,
      y: targetY,
      duration: travelDur,
      ease: 'power2.out'
    });
    
    gsap.to(shard, {
      alpha: 0,
      delay: fadeDelay,
      duration: fadeDur,
      ease: 'power2.in'
    });
  });
  
  console.log(`🎨 wildMerge6ShardsTemplated: Created ${shardsInLayer.length} shards in layer`);
  
  // Cleanup layer after TTL
  const ttl = params.ttl || 1.2;
  gsap.delayedCall(ttl, () => {
    console.log(`🎨 wildMerge6ShardsTemplated: Cleaning up ${shardsInLayer.length} shards after TTL ${ttl}s`);
    
    // Return all shards to pool
    shardsInLayer.forEach((shard, idx) => {
      try {
        gsap.killTweensOf(shard);
        gsap.killTweensOf(shard.x);
        gsap.killTweensOf(shard.y);
        gsap.killTweensOf(shard.alpha);
        gsap.killTweensOf(shard.scale);
        gsap.killTweensOf(shard.rotation);
        
        if (shard.parent === layer) {
          layer.removeChild(shard);
        }
        pool.release(shard);
      } catch (e) {
        console.warn(`⚠️ Error cleaning up shard ${idx}:`, e);
      }
    });
    
    // Destroy layer
    try {
      layer.destroy({ children: false });
    } catch (e) {
      console.warn('⚠️ Error destroying layer:', e);
    }
  });
}

/**
 * ⭐ Template-Based Wild Star Merge 6 Shards
 * 
 * Uses predefined patterns from the active template for wild star merges.
 * ORIGINAL COLOR: Yellow (#FFCB47)
 * 
 * @param {Container} board - Game board container
 * @param {object} tile - Tile object or snapshot with x/y coordinates
 * @param {object} opts - Options (zIndex, skipStars, etc.)
 */
export function wildStarMerge6ShardsTemplated(board, tile, opts = {}) {
  if (!board || !tile) {
    console.warn('⚠️ wildStarMerge6ShardsTemplated: Missing board or tile', { board: !!board, tile: !!tile });
    return;
  }

  console.log('⭐ wildStarMerge6ShardsTemplated: Called', { board: !!board, tile: !!tile, opts });

  // Select pattern from template
  const patternInfo = selectPattern('wildStar');
  
  if (!patternInfo) {
    console.error('❌ wildStarMerge6ShardsTemplated: No pattern selected - template manager may not be initialized');
    console.error('❌ Debug info:', {
      activeTemplate: getActiveTemplate()?.name,
      patternMap: getActiveTemplate()?.patternMap,
      wildStarPatterns: getActiveTemplate()?.patternMap?.wildStar
    });
    // 🔥 FALLBACK: Use woodShardsAtTile for reliability
    console.log('🔄 Falling back to woodShardsAtTile');
    woodShardsAtTile(board, tile, {
      enhanced: true,
      wild: true,
      wildMagnet: false,
      isWildBeer: false,
      skipStars: opts.skipStars,
      count: 18,
      intensity: 1.35,
      spread: 0.7,
      size: 1.3,
      speed: 1.0,
      vanishDelay: 0.0,
      vanishJitter: 0.02
    });
    return;
  }
  
  const { patternName, patternData, pool, template } = patternInfo;
  const params = getParams('wildStar');
  const yellowColor = getColor('wildStar'); // 🔥 ORIGINAL COLOR: Yellow (#FFCB47)
  
  console.log(`⭐ wildStarMerge6ShardsTemplated: Using pattern: ${patternName} (${patternData.length} shards)`, {
    yellowColor: `0x${yellowColor.toString(16)}`,
    poolSize: pool.getStats?.()?.poolSize || 'unknown',
    boardVisible: board.visible,
    boardAlpha: board.alpha,
    params: params,
    patternDataLength: patternData.length,
    spread: params.spread,
    baseTile: params.baseTile || 96,
    maxDistance: Math.max(...patternData.map(s => s.distance)) * (params.baseTile || 96) * (params.spread || 1.0)
  });
  
  // Get position
  let x, y;
  if (tile.x !== undefined && tile.y !== undefined) {
    x = tile.x;
    y = tile.y;
  } else {
    const pos = centerInBoard(board, tile, params.tileSize || 96);
    x = pos.x;
    y = pos.y;
  }
  
  // Create layer
  const layer = new Container();
  layer.x = x;
  layer.y = y;
  layer.visible = true;
  layer.alpha = 1.0;
  layer.zIndex = opts.zIndex ?? 9993;
  
  // 🔥 CRITICAL: Add layer to board BEFORE creating shards
  board.addChild(layer);
  
  // 🔥 CRITICAL: Force sort to ensure zIndex is respected
  try {
    board.sortableChildren = true;
    board.sortChildren?.();
  } catch (e) {
    console.warn('⚠️ Failed to sort board children:', e);
  }
  
  // Track shards for cleanup
  const shardsInLayer = [];
  const baseTile = params.baseTile || 96;
  
  // Spawn each shard according to pattern
  patternData.forEach((shardDef, index) => {
    // 🔥 POOLING: Acquire Graphics from pattern-specific pool
    const shard = pool.acquire();
    
    // Only set pattern-specific alpha (reset() already set it to 1.0)
    shard.alpha = shardDef.alpha || 1.0;
    
    // Draw shard (filled polygon shape)
    const baseSize = (6 + Math.random() * 8) * (shardDef.size || 1.0) * 2.4;
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
    
    // Draw filled polygon using PixiJS v8 API - 🔥 ORIGINAL COLOR: Yellow
    try {
      shard.poly(points).fill({ color: yellowColor, alpha: params.lineAlpha || 0.9 });
    } catch (e) {
      // Fallback to rect if poly fails
      console.warn('⚠️ Failed to draw poly, using rect fallback:', e);
      shard.clear();
      const size = Math.max(4, Math.max(...points.map((p, i) => Math.abs(p))) * 2);
      shard.rect(-size/2, -size/2, size, size).fill({ color: yellowColor, alpha: params.lineAlpha || 0.9 });
    }
    
    // 🔥 CRITICAL: Force bounds update AFTER drawing
    try {
      if (typeof shard.updateBounds === 'function') {
        shard.updateBounds();
      }
    } catch (e) {
      console.warn('⚠️ Failed to update shard bounds:', e);
    }
    
    // 🔥 CRITICAL: Ensure shard is visible and properly positioned
    shard.visible = true;
    shard.alpha = shardDef.alpha || 1.0;
    shard.x = 0;
    shard.y = 0;
    
    // 🔥 CRITICAL: Set rotation BEFORE adding to layer
    shard.rotation = Math.random() * Math.PI;
    
    // 🔥 CRITICAL: Add to layer BEFORE animation (ensures shard is in render tree)
    layer.addChild(shard);
    shardsInLayer.push(shard);
    
    // 🔥 CRITICAL: Force render update (ensures shard is drawn before animation starts)
    try {
      if (layer.parent) {
        layer.parent.sortableChildren = true;
      }
    } catch (e) {
      console.warn('⚠️ Failed to set sortableChildren:', e);
    }
    
    // Calculate travel distance (pattern distance is normalized 0-1)
    // 🔥 FIX: Add stagger delay for organic feel
    const staggerDelay = Math.random() * 0.08; // 0-80ms stagger for organic feel
    const angle = (shardDef.angle * Math.PI) / 180;
    const distance = shardDef.distance * baseTile * (params.spread || 1.0);
    const targetX = Math.cos(angle) * distance;
    const targetY = Math.sin(angle) * distance;
    
    // 🔥 DEBUG: Log first shard animation details
    if (index === 0) {
      console.log(`⭐ wildStarMerge6ShardsTemplated: First shard animation`, {
        shardDefDistance: shardDef.distance,
        baseTile: baseTile,
        spread: params.spread || 1.0,
        calculatedDistance: distance,
        targetX: targetX,
        targetY: targetY,
        angle: shardDef.angle,
        travelDur: (params.travelDuration || 0.4) * shardDef.speed * (params.speed || 1.0),
        shardVisible: shard.visible,
        shardAlpha: shard.alpha,
        shardInLayer: layer.children.includes(shard)
      });
    }
    
    // Animate shard
    const travelDur = (params.travelDuration || 0.4) * shardDef.speed * (params.speed || 1.0);
    const fadeDelay = (params.fadeDelay ?? 0.15) + (params.fadeDelayMultiplier ?? 0.1) * Math.random();
    const fadeDur = params.fadeDuration ?? 0.25;
    
    gsap.to(shard, {
      delay: staggerDelay, // 🔥 Organic stagger
      x: targetX,
      y: targetY,
      duration: travelDur,
      ease: 'power2.out'
    });
    
    gsap.to(shard, {
      alpha: 0,
      delay: fadeDelay,
      duration: fadeDur,
      ease: 'power2.in'
    });
  });
  
  console.log(`⭐ wildStarMerge6ShardsTemplated: Created ${shardsInLayer.length} shards in layer`, {
    layerX: layer.x,
    layerY: layer.y,
    layerVisible: layer.visible,
    layerAlpha: layer.alpha,
    layerZIndex: layer.zIndex,
    layerInBoard: board.children.includes(layer),
    layerChildrenCount: layer.children.length,
    firstShardVisible: shardsInLayer[0]?.visible,
    firstShardAlpha: shardsInLayer[0]?.alpha,
    firstShardInLayer: shardsInLayer[0] ? layer.children.includes(shardsInLayer[0]) : false
  });
  
  // Cleanup layer after TTL
  const ttl = params.ttl || 1.2;
  gsap.delayedCall(ttl, () => {
    // Return all shards to pool
    shardsInLayer.forEach((shard, idx) => {
      try {
        gsap.killTweensOf(shard);
        gsap.killTweensOf(shard.x);
        gsap.killTweensOf(shard.y);
        gsap.killTweensOf(shard.alpha);
        gsap.killTweensOf(shard.scale);
        gsap.killTweensOf(shard.rotation);
        
        if (shard.parent === layer) {
          layer.removeChild(shard);
        }
        pool.release(shard);
      } catch (e) {
        console.warn(`⚠️ Error cleaning up shard ${idx}:`, e);
      }
    });
    
    // Destroy layer
    try {
      layer.destroy({ children: false });
    } catch (e) {
      console.warn('⚠️ Error destroying layer:', e);
    }
  });
}

/**
 * 🍺 Template-Based Wild Beer Merge 6 Shards
 * 
 * Uses predefined patterns from the active template for wild beer merges.
 * ORIGINAL COLOR: Orange (#F99D77)
 * 
 * @param {Container} board - Game board container
 * @param {object} tile - Tile object or snapshot with x/y coordinates
 * @param {object} opts - Options (zIndex, etc.)
 */
export function wildBeerMerge6ShardsTemplated(board, tile, opts = {}) {
  if (!board || !tile) {
    console.warn('⚠️ wildBeerMerge6ShardsTemplated: Missing board or tile', { board: !!board, tile: !!tile });
    return;
  }

  console.log('🍺 wildBeerMerge6ShardsTemplated: Called', { board: !!board, tile: !!tile, opts });

  // Select pattern from template
  const patternInfo = selectPattern('wildBeer');
  
  if (!patternInfo) {
    console.error('❌ wildBeerMerge6ShardsTemplated: No pattern selected - template manager may not be initialized');
    console.error('❌ Debug info:', {
      activeTemplate: getActiveTemplate()?.name,
      patternMap: getActiveTemplate()?.patternMap,
      wildBeerPatterns: getActiveTemplate()?.patternMap?.wildBeer
    });
    // 🔥 FALLBACK: Use woodShardsAtTile for reliability
    console.log('🔄 Falling back to woodShardsAtTile');
    woodShardsAtTile(board, tile, {
      enhanced: true,
      wild: true,
      wildMagnet: false,
      isWildBeer: true,
      count: 18,
      intensity: 1.35,
      spread: 0.7,
      size: 1.3,
      speed: 1.0,
      vanishDelay: 0.0,
      vanishJitter: 0.02
    });
    return;
  }
  
  const { patternName, patternData, pool, template } = patternInfo;
  const params = getParams('wildBeer');
  const orangeColor = getColor('wildBeer'); // 🔥 ORIGINAL COLOR: Orange (#F99D77)
  
  console.log(`🍺 wildBeerMerge6ShardsTemplated: Using pattern: ${patternName} (${patternData.length} shards)`, {
    orangeColor: `0x${orangeColor.toString(16)}`,
    poolSize: pool.getStats?.()?.poolSize || 'unknown',
    boardVisible: board.visible,
    boardAlpha: board.alpha,
    params: params,
    patternDataLength: patternData.length,
    spread: params.spread,
    baseTile: params.baseTile || 96,
    maxDistance: Math.max(...patternData.map(s => s.distance)) * (params.baseTile || 96) * (params.spread || 1.0)
  });
  
  // Get position
  let x, y;
  if (tile.x !== undefined && tile.y !== undefined) {
    x = tile.x;
    y = tile.y;
  } else {
    const pos = centerInBoard(board, tile, params.tileSize || 96);
    x = pos.x;
    y = pos.y;
  }
  
  // Create layer
  const layer = new Container();
  layer.x = x;
  layer.y = y;
  layer.visible = true;
  layer.alpha = 1.0;
  layer.zIndex = opts.zIndex ?? 9993;
  
  // 🔥 CRITICAL: Add layer to board BEFORE creating shards
  board.addChild(layer);
  
  // 🔥 CRITICAL: Force sort to ensure zIndex is respected
  try {
    board.sortableChildren = true;
    board.sortChildren?.();
  } catch (e) {
    console.warn('⚠️ Failed to sort board children:', e);
  }
  
  // Track shards for cleanup
  const shardsInLayer = [];
  const baseTile = params.baseTile || 96;
  
  // Spawn each shard according to pattern
  patternData.forEach((shardDef, index) => {
    // 🔥 POOLING: Acquire Graphics from pattern-specific pool
    const shard = pool.acquire();
    
    // Only set pattern-specific alpha (reset() already set it to 1.0)
    shard.alpha = shardDef.alpha || 1.0;
    
    // Draw shard (filled polygon shape)
    const baseSize = (6 + Math.random() * 8) * (shardDef.size || 1.0) * 2.4;
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
    
    // Draw filled polygon using PixiJS v8 API - 🔥 ORIGINAL COLOR: Orange
    try {
      shard.poly(points).fill({ color: orangeColor, alpha: params.lineAlpha || 0.9 });
      // 🔥 DEBUG: Log first shard drawing
      if (index === 0) {
        console.log(`🍺 wildBeerMerge6ShardsTemplated: First shard drawn`, {
          pointsCount: points.length / 2,
          orangeColor: `0x${orangeColor.toString(16)}`,
          alpha: params.lineAlpha || 0.9,
          shardVisible: shard.visible,
          shardAlpha: shard.alpha
        });
      }
    } catch (e) {
      // Fallback to rect if poly fails
      console.warn('⚠️ Failed to draw poly, using rect fallback:', e);
      shard.clear();
      const size = Math.max(4, Math.max(...points.map((p, i) => Math.abs(p))) * 2);
      shard.rect(-size/2, -size/2, size, size).fill({ color: orangeColor, alpha: params.lineAlpha || 0.9 });
    }
    
    // 🔥 CRITICAL: Force bounds update AFTER drawing
    try {
      if (typeof shard.updateBounds === 'function') {
        shard.updateBounds();
      }
    } catch (e) {
      console.warn('⚠️ Failed to update shard bounds:', e);
    }
    
    // 🔥 CRITICAL: Ensure shard is visible and properly positioned
    shard.visible = true;
    shard.alpha = shardDef.alpha || 1.0;
    shard.x = 0;
    shard.y = 0;
    
    // 🔥 CRITICAL: Set rotation BEFORE adding to layer
    shard.rotation = Math.random() * Math.PI;
    
    // 🔥 CRITICAL: Add to layer BEFORE animation (ensures shard is in render tree)
    layer.addChild(shard);
    shardsInLayer.push(shard);
    
    // 🔥 CRITICAL: Force render update (ensures shard is drawn before animation starts)
    try {
      if (layer.parent) {
        layer.parent.sortableChildren = true;
      }
    } catch (e) {
      console.warn('⚠️ Failed to set sortableChildren:', e);
    }
    
    // Calculate travel distance (pattern distance is normalized 0-1)
    // 🔥 FIX: Add stagger delay for organic feel
    const staggerDelay = Math.random() * 0.08; // 0-80ms stagger for organic feel
    const angle = (shardDef.angle * Math.PI) / 180;
    const distance = shardDef.distance * baseTile * (params.spread || 1.0);
    const targetX = Math.cos(angle) * distance;
    const targetY = Math.sin(angle) * distance;
    
    // Animate shard
    const travelDur = (params.travelDuration || 0.4) * shardDef.speed * (params.speed || 1.0);
    const fadeDelay = (params.fadeDelay ?? 0.15) + (params.fadeDelayMultiplier ?? 0.1) * Math.random();
    const fadeDur = params.fadeDuration ?? 0.25;
    
    gsap.to(shard, {
      delay: staggerDelay, // 🔥 Organic stagger
      x: targetX,
      y: targetY,
      duration: travelDur,
      ease: 'power2.out'
    });
    
    gsap.to(shard, {
      alpha: 0,
      delay: fadeDelay,
      duration: fadeDur,
      ease: 'power2.in'
    });
  });
  
  console.log(`🍺 wildBeerMerge6ShardsTemplated: Created ${shardsInLayer.length} shards in layer`);
  
  // Cleanup layer after TTL
  const ttl = params.ttl || 1.2;
  gsap.delayedCall(ttl, () => {
    // Return all shards to pool
    shardsInLayer.forEach((shard, idx) => {
      try {
        gsap.killTweensOf(shard);
        gsap.killTweensOf(shard.x);
        gsap.killTweensOf(shard.y);
        gsap.killTweensOf(shard.alpha);
        gsap.killTweensOf(shard.scale);
        gsap.killTweensOf(shard.rotation);
        
        if (shard.parent === layer) {
          layer.removeChild(shard);
        }
        pool.release(shard);
      } catch (e) {
        console.warn(`⚠️ Error cleaning up shard ${idx}:`, e);
      }
    });
    
    // Destroy layer
    try {
      layer.destroy({ children: false });
    } catch (e) {
      console.warn('⚠️ Error destroying layer:', e);
    }
  });
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
  
  // 🔥 DEBUG: Log wild mode detection
  console.log('🔍 woodShardsAtTile wild detection:', {
    optsWild: opts.wild,
    optsWildMagnet: opts.wildMagnet,
    optsIsWildBeer: opts.isWildBeer,
    tileSpecial: tile?.special,
    wildMode
  });
  
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
    // 🔥 FIX: Use high zIndex for wild merge shards to ensure visibility (was tileZ - 0.002 which was too low)
    layer.zIndex = 9993; // High zIndex to ensure shards are visible above tiles
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
  
  // 🔥 CRITICAL: Determine shard color based on opts.wildMagnet and opts.wild
  // Priority: opts flags FIRST (explicit), then tile.special (fallback)
  // This ensures explicit flags ALWAYS override tile.special
  // 🔥 CRITICAL: Must be declared BEFORE any usage (e.g., debug logs)
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
  } else if (!isWildMagnet && opts.isWildBeer === true) {
    // opts.isWildBeer is set, treat as wild-only (for wild-beer merge 6)
    isWildOnly = true;
  }
  
  const intensity = opts.intensity ?? (enhanced ? 1.35 : 1.0);
  const countBase = opts.count ?? (enhanced ? 18 : 12);
  const shardCountRaw = Math.max(6, Math.round(countBase * intensity));
  const shardCount = wildMode
    ? Math.max(14, Math.round(shardCountRaw * 0.8))
    : Math.round(shardCountRaw);
  
  // 🔥 DEBUG: Log shard count calculation for wild merge
  if (wildMode && !isWildMagnet) {
    console.log('🔍 Wild merge shard count calculation:', {
      countBase,
      intensity,
      shardCountRaw,
      shardCount,
      wildMode,
      enhanced
    });
  }
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
  // 🔥 FIX: Reduce distances by 50% for wild merge to keep shards closer to tile
  const minDistance = (opts.minDistance ?? (wildMode ? baseTile * 0.1 : baseTile * 0.08)) * spread * radiusBoost * distanceMultiplier; // 50% reduction: 0.2 → 0.1
  const maxDistanceBase = opts.maxDistance ?? (wildMode ? baseTile * 0.55 : (enhanced ? baseTile * 0.24 : baseTile * 0.2)); // 50% reduction: 1.1 → 0.55
  const maxDistance = maxDistanceBase * spread * radiusBoost * distanceMultiplier;
  const speed = Math.max(0.2, opts.speed ?? 1.0);
  const vanishDelay = opts.vanishDelay ?? (wildMode ? 0 : 0);
  const vanishJitter = opts.vanishJitter ?? (wildMode ? 0.02 : 0.06);

  // 🔥 CRITICAL: Check for wild-beer separately
  const isWildBeer = tile?.special === 'wild-beer' || opts.isWildBeer === true;
  
  const yellowColor = 0xFFCB47; // Yellow (#FFCB47) for wild-only (wild star)
  const redColor = 0xF26034;    // Red (#F26034) for wild-magnet
  const beerColor = 0xF99D77;   // Orange (#F99D77) for wild-beer
  const brownColor = 0xD4A584;  // Brown (#D4A584) for regular merge 6

  // Determine base shard color
  let baseShardColor = brownColor; // Default: brown
  if (isWildMagnet) {
    baseShardColor = redColor; // Wild-magnet → red
  } else if (isWildBeer) {
    baseShardColor = beerColor; // Wild-beer → orange (#F99D77)
  } else if (isWildOnly) {
    baseShardColor = yellowColor; // Wild-only (wild star) → yellow
  }

  const emitShard = (distance, angle, scaleFactor = 1, alpha = 1.0, speedMul = 1, shardIndex = 0) => {
    // 🔥 CRITICAL FIX: Use new Graphics() for wild merge shards instead of pooling
    // Pooling causes rendering issues - shards become invisible after first use
    // This is the same fix as regularMerge6Shards - use new Graphics() for reliability
    const shard = new Graphics();
    
    // 🔥 CRITICAL: Set visibility and transform properties
    shard.visible = true;
    shard.alpha = alpha;
    shard.scale.set(1, 1);
    shard.rotation = 0;
    shard.x = 0;
    shard.y = 0;
    
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
    // For wild-beer, use beer color (#F99D77)
    // For wild-only (wild star), randomly mix yellow and brown (50/50)
    // For regular, use only brown
    let shardColor = baseShardColor;
    if (isWildMagnet) {
      // Wild-magnet: 50% red, 50% brown
      shardColor = Math.random() < 0.5 ? redColor : brownColor;
    } else if (isWildBeer) {
      // Wild-beer: use beer color (#F99D77)
      shardColor = beerColor;
    } else if (isWildOnly) {
      // Wild-only (wild star): 50% yellow, 50% brown
      shardColor = Math.random() < 0.5 ? yellowColor : brownColor;
    }
    // Otherwise: use baseShardColor (brown for regular)

    // 🔥 CRITICAL FIX: Force update bounds after drawing (ensures proper rendering)
    // CRITICAL FIX: PixiJS v8+ uses .poly() instead of .drawPolygon()
    try {
      shard.poly(points).fill({ color: shardColor, alpha });
      // 🔥 CRITICAL: Force update bounds after drawing
      try {
        if (typeof shard.updateBounds === 'function') {
          shard.updateBounds();
        }
      } catch {}
    } catch (e) {
      // Fallback to rect if polygon fails
      try {
        shard.clear();
        const maxRadius = Math.max(8, Math.max(...points.map((p, i) => Math.abs(p))));
        const shardSize = Math.max(4, maxRadius * 2);
        shard.rect(-shardSize/2, -shardSize/2, shardSize, shardSize)
             .fill({ color: shardColor, alpha });
        // 🔥 CRITICAL: Force update bounds after drawing
        try {
          if (typeof shard.updateBounds === 'function') {
            shard.updateBounds();
          }
        } catch {}
      } catch (e2) {
        // Last resort: simple rect
        shard.clear();
        shard.rect(-4, -4, 8, 8).fill({ color: shardColor, alpha });
        // 🔥 CRITICAL: Force update bounds after drawing
        try {
          if (typeof shard.updateBounds === 'function') {
            shard.updateBounds();
          }
        } catch {}
      }
    }

    // 🔥 CRITICAL: Set transform properties AFTER drawing (ensures proper rendering)
    shard.rotation = Math.random() * Math.PI;
    shard.x = 0;
    shard.y = 0;
    shard.alpha = alpha;
    shard.visible = true; // 🔥 CRITICAL: Ensure shard is visible
    
    // 🔥 CRITICAL: Add to layer BEFORE animation (ensures shard is in render tree)
    layer.addChild(shard);
    
    // 🔥 DEBUG: Log shard creation for wild merge (first 3 shards only)
    if (isWildOnly && shardIndex < 3) {
      console.log(`🔍 Wild shard ${shardIndex} created:`, {
        visible: shard.visible,
        alpha: shard.alpha,
        x: shard.x,
        y: shard.y,
        inLayer: layer.children.includes(shard),
        layerVisible: layer.visible,
        layerAlpha: layer.alpha,
        layerInBoard: !!layer.parent
      });
    }

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
    
    // 🔥 DEBUG: Log animation parameters for first 3 wild shards
    if (isWildOnly && shardIndex < 3) {
      console.log(`🔍 Wild shard ${shardIndex} animation params:`, {
        distance,
        dist,
        angle: angle * 180 / Math.PI,
        endX,
        endY,
        travelDur,
        spin: spin * 180 / Math.PI,
        speed,
        speedMul,
        minDistance,
        maxDistance
      });
    }
    
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
            // 🔥 CRITICAL FIX: Destroy shard instead of pooling (same as regularMerge6Shards)
            // Pooling causes rendering issues for wild merge shards
            shard.destroy();
          } catch {}
        });
      }
    });
  };


  // 🔥 DEBUG: Log shard creation start for wild merge
  if (wildMode && !isWildMagnet) {
    console.log('🔍 Starting wild merge shard creation:', {
      shardCount,
      layerVisible: layer.visible,
      layerAlpha: layer.alpha,
      layerInBoard: !!layer.parent,
      layerX: layer.x,
      layerY: layer.y
    });
  }
  
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
  
  // 🔥 DEBUG: Log shard creation complete for wild merge
  if (wildMode && !isWildMagnet) {
    console.log('🔍 Wild merge shard creation complete:', {
      shardCount,
      layerChildren: layer.children.length,
      layerVisible: layer.visible,
      layerAlpha: layer.alpha,
      layerInBoard: !!layer.parent
    });
  }
  
  // Generate 3 stars ONLY for wild-only merge (wild + ordinary or ordinary + wild)
  // NOT for wild-magnet merge, regular merge, or any other case
  // isWildOnly is determined above based on opts.wild and opts.wildMagnet
  // 🔥 WILD-BEER SPECIAL: Use bubbles instead of stars for wild-beer merge
  // Note: isWildBeer is already declared above (line 1080) - use that variable
  console.log('💧 Stars/Bubbles check:', { 
    isWildOnly, 
    isWildMagnet, 
    isWildBeer, // Use isWildBeer declared above (line 1080) 
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
      // 🔥 USER REQUEST: Skip creating star particles for wild star merge 6
      // Instead, orbiting stars will be animated to HUD icon via stars-collector module
      // Check opts.skipStars flag (passed from app-core.ts) or tile.special === 'wild'
      const shouldSkipStars = opts.skipStars === true || (tile?.special === 'wild' && !isWildBeer && !isWildMagnet);
      
      if (shouldSkipStars) {
        console.log('⭐ Skipping star particles for wild star merge 6 - orbiting stars will be animated to HUD instead');
      } else {
        // Fallback: create stars for other wild types (shouldn't happen, but safety)
      console.log('⭐ Creating regular wild stars at position:', x, y);
      createMerge6Stars(board, layer, x, y);
      }
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
let _cachedBubbleTexture = null; // 🔥 v75 FAZA 1: Cache bubble texture globally

export function cleanupWildBeerExplosion() {
  try {
    // Stop FPS monitoring
    stopFpsMonitoring();

    wildBeerExplosionActive = false;


    if (wildBeerExplosionContainer) {
      const container = wildBeerExplosionContainer;
      wildBeerExplosionContainer = null;

      // 🔥 v70 CLEANUP: Remove GSAP ticker
      if (container._bubbleSpawnTicker) {
        try {
          gsap.ticker.remove(container._bubbleSpawnTicker);
          container._bubbleSpawnTicker = null;
        } catch {}
      }
      if (wildBeerExplosionSpawnTick) {
        try {
          gsap.ticker.remove(wildBeerExplosionSpawnTick);
          wildBeerExplosionSpawnTick = null;
        } catch {}
      }

      // Clear spawn interval (if exists from old version)
      if (container._spawnInterval) {
        clearInterval(container._spawnInterval);
        container._spawnInterval = null;
      }

      // 🔥 v75 CLEANUP: Clean up all bubbles (Sprite or Graphics) with all tweens
      const children = [...(container.children || [])];
      children.forEach((bubble) => {
        try {
          // Kill all tweens stored on bubble
          if (bubble._bubbleTweens && Array.isArray(bubble._bubbleTweens)) {
            bubble._bubbleTweens.forEach(tween => {
              try { if (tween && tween.kill) tween.kill(); } catch {}
            });
            bubble._bubbleTweens = null;
          }
          // Kill all tweens on bubble properties
          gsap.killTweensOf(bubble);
          gsap.killTweensOf(bubble.scale);
          if (bubble && bubble.parent) bubble.parent.removeChild(bubble);
          // v75: Sprite objects use destroy() (texture is reused), Graphics use pool
          if (bubble instanceof Sprite) {
            bubble.destroy();
          } else {
          graphicsPool.release(bubble);
          }
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

/**
 * 🔥 USER REQUEST: Wait for bubbles animation to complete
 * Returns a promise that resolves when bubbles animation finishes (or timeout)
 * Max wait time: 5 seconds (bubbles animation max duration ~4.4s)
 */
export function waitForBubblesAnimationToComplete(maxWaitMs = 5000) {
  return new Promise((resolve) => {
    if (!wildBeerExplosionActive) {
      // Animation not running, resolve immediately
      resolve();
      return;
    }

    console.log('⏳ Waiting for bubbles animation to complete (max', maxWaitMs, 'ms)...');
    const startTime = performance.now();
    const checkInterval = 100; // Check every 100ms
    
    const checkTimer = setInterval(() => {
      const elapsed = performance.now() - startTime;
      
      if (!wildBeerExplosionActive) {
        // Animation finished
        clearInterval(checkTimer);
        console.log('✅ Bubbles animation completed after', Math.round(elapsed), 'ms');
        resolve();
      } else if (elapsed >= maxWaitMs) {
        // Timeout - animation still running but we've waited long enough
        clearInterval(checkTimer);
        console.warn('⚠️ Bubbles animation timeout after', maxWaitMs, 'ms - proceeding anyway');
        resolve();
      }
    }, checkInterval);
  });
}

/**
 * 🔥 COMPREHENSIVE CLEANUP: Call this on game state changes (level end, board reset, etc.)
 * Ensures all animations and effects are properly cleaned up to prevent memory leaks
 */
export function cleanupAllEffects() {
  console.log('🧹 cleanupAllEffects: Cleaning up all active effects');

  // Cleanup wild beer explosion
  cleanupWildBeerExplosion();

  // Cleanup wild beer bubble systems
  wildBeerBubbleSystems.forEach((system, tile) => {
    try {
      stopWildBeerBubbles(tile);
    } catch {}
  });
  wildBeerBubbleSystems.clear();

  // 🔥 PERFORMANCE FIX: Cleanup active star animations (prevents lag)
  cleanupExistingStarAnimations();

  // Kill all global delayed calls
  killAllDelayedCalls();

  // Destroy all graphics objects
  destroyAllGraphicsObjects();

  // Stop FPS monitoring
  fpsMonitorActive = false;

  console.log('✅ cleanupAllEffects: All effects cleaned up');
}

// 🔥 DEBUG: Expose bubble stats to window for DevTools console access
if (typeof window !== 'undefined') {
  window.getBubbleStats = function() {
    if (!wildBeerExplosionContainer || wildBeerExplosionContainer.destroyed) {
      return { active: 0, spawned: 0, total: 0, fps: currentFps || 60 };
    }
    const children = wildBeerExplosionContainer.children || [];
    const visible = children.filter(b => b.visible !== false).length;
    return {
      active: active || 0,
      spawned: spawned || 0,
      total: totalBubbles || 0,
      visible: visible,
      fps: currentFps || 60,
      container: !!wildBeerExplosionContainer,
      texture: useTexturePooling ? 'YES' : 'NO (Graphics fallback)'
    };
  };
  
  window.monitorBubbles = function(interval = 500) {
    const monitor = setInterval(() => {
      const stats = window.getBubbleStats();
      console.log(`💧 Bubbles: ${stats.spawned}/${stats.total} spawned, ${stats.active} active, ${stats.visible} visible, FPS: ${stats.fps.toFixed(1)}`);
    }, interval);
    
    console.log(`💧 Monitoring bubbles every ${interval}ms. Call window.stopBubbleMonitor() to stop.`);
    window.stopBubbleMonitor = () => {
      clearInterval(monitor);
      console.log('💧 Bubble monitoring stopped');
    };
    
    return monitor;
  };
}

// 🔥 DEBUG: Expose bubble stats to window for DevTools console access
if (typeof window !== 'undefined') {
  window.getBubbleStats = function() {
    try {
      if (!wildBeerExplosionContainer || wildBeerExplosionContainer.destroyed) {
        return { 
          active: 0, 
          spawned: 0, 
          total: 125, 
          visible: 0,
          fps: (typeof currentFps !== 'undefined' ? currentFps : 60),
          container: false,
          texture: 'N/A',
          elapsed: 0
        };
      }
      const children = wildBeerExplosionContainer.children || [];
      const visible = children.filter(b => b && b.visible !== false).length;
      const stats = window._bubbleStats || {};
      const elapsed = stats.startTime ? (performance.now() - stats.startTime) / 1000 : 0;
      
      return {
        active: stats.active || 0,
        spawned: stats.spawned || 0,
        total: stats.totalBubbles || 125,
        visible: visible,
        fps: (typeof currentFps !== 'undefined' ? currentFps : 60),
        container: !!wildBeerExplosionContainer,
        texture: (typeof useTexturePooling !== 'undefined' && useTexturePooling) ? 'YES' : 'NO (Graphics fallback)',
        elapsed: elapsed.toFixed(1) + 's'
      };
    } catch (e) {
      return { error: e.message };
    }
  };
  
  window.monitorBubbles = function(interval = 500) {
    console.log(`💧 Starting bubble monitoring every ${interval}ms...`);
    let count = 0;
    const monitor = setInterval(() => {
      count++;
      const stats = window.getBubbleStats();
      if (stats.error) {
        console.warn('⚠️ Error getting bubble stats:', stats.error);
        return;
      }
      
      const status = stats.container ? '🟢 ACTIVE' : '🔴 INACTIVE';
      const fpsStatus = stats.fps >= 50 ? '✅' : stats.fps >= 30 ? '⚠️' : '❌';
      
      console.log(`${status} | ${stats.elapsed} | Bubbles: ${stats.spawned}/${stats.total} spawned, ${stats.active} active, ${stats.visible} visible | FPS: ${fpsStatus} ${stats.fps.toFixed(1)}`);
      
      // Warn if FPS drops below 30
      if (stats.fps < 30 && stats.container) {
        console.warn(`⚠️ FRAME DROP DETECTED: FPS=${stats.fps.toFixed(1)} (should be ≥30fps)`);
      }
    }, interval);
    
    console.log(`💧 Monitoring bubbles every ${interval}ms. Call window.stopBubbleMonitor() to stop.`);
    window.stopBubbleMonitor = () => {
      clearInterval(monitor);
      console.log(`💧 Bubble monitoring stopped after ${count} checks`);
    };
    
    return monitor;
  };
  
  // Helper to check frame drop after 1 second
  window.checkFrameDropAfter1s = function() {
    console.log('💧 Starting frame drop check after 1 second...');
    setTimeout(() => {
      const stats = window.getBubbleStats();
      if (stats.container) {
        const fpsStatus = stats.fps >= 50 ? '✅ GOOD' : stats.fps >= 30 ? '⚠️ WARNING' : '❌ BAD';
        console.log(`📊 After 1 second:`);
        console.log(`   FPS: ${fpsStatus} ${stats.fps.toFixed(1)}`);
        console.log(`   Bubbles: ${stats.spawned}/${stats.total} spawned, ${stats.active} active`);
        console.log(`   Visible: ${stats.visible}`);
        
        if (stats.fps < 30) {
          console.warn(`❌ FRAME DROP DETECTED: FPS=${stats.fps.toFixed(1)} is below 30fps threshold!`);
        } else if (stats.fps < 50) {
          console.warn(`⚠️ FPS WARNING: FPS=${stats.fps.toFixed(1)} is below 50fps (acceptable but not ideal)`);
        } else {
          console.log(`✅ FPS is good: ${stats.fps.toFixed(1)}fps`);
        }
      } else {
        console.warn('⚠️ No active bubble animation');
      }
    }, 1000);
  };
}

export function createWildBeerBubblesExplosion(board, tile) {
  console.log('💧 createWildBeerBubblesExplosion: Starting simplified version');

  // 🔥 CRITICAL FIX: Allow tile to be null or destroyed (use position object instead)
  // After merge 6, dst tile is destroyed but we still have position data
  if (!board) {
    console.warn('⚠️ createWildBeerBubblesExplosion: Missing board');
    return;
  }

  // Tile can be null or destroyed - bubbles don't need tile reference, just board
  if (!tile) {
    console.warn('⚠️ createWildBeerBubblesExplosion: Tile is null/undefined (may be destroyed), continuing with board only');
  } else if (tile.destroyed) {
    console.warn('⚠️ createWildBeerBubblesExplosion: Tile is destroyed, continuing with board only');
  }

  // 🔥 CRITICAL: Always cleanup first to ensure clean state
  // This prevents race conditions where flag is stuck
  cleanupWildBeerExplosion();

  // Double-check after cleanup
  if (wildBeerExplosionActive) {
    console.warn('⚠️ createWildBeerBubblesExplosion: Flag still active after cleanup, forcing reset');
    wildBeerExplosionActive = false;
  }

  // Get app and stage from window.STATE (most reliable)
  const windowState = typeof window !== 'undefined' ? window.STATE : null;
  const app = (windowState && windowState.app) || null;
  const stage = (windowState && windowState.stage) ||
                (app && app.stage) ||
                board.parent?.parent?.stage ||
                board.parent;

  if (!stage) {
    console.error('❌ createWildBeerBubblesExplosion: No stage found!');
    return;
  }

  console.log('💧 createWildBeerBubblesExplosion: Stage found, proceeding with bubble creation');

  // 🔥 CRITICAL: Get accurate screen dimensions - use window.innerWidth/Height for actual viewport
  // This ensures we get the real screen size regardless of PixiJS coordinate system
  const screenW = (typeof window !== 'undefined' ? window.innerWidth : 800);
  const screenH = (typeof window !== 'undefined' ? window.innerHeight : 600);
  
  // Also get renderer dimensions for reference
  const rendererW = (app && app.renderer && app.renderer.width) || screenW;
  const rendererH = (app && app.renderer && app.renderer.height) || screenH;
  
  console.log(`💧 Screen dimensions: ${screenW}x${screenH} (window), renderer: ${rendererW}x${rendererH}`);

  // Create container
  const container = new Container();
  container.name = 'wild-beer-explosion-bubbles';
  container.zIndex = 20000;
  container.eventMode = 'none';
  container.visible = true; // 🔥 CRITICAL: Ensure container is visible
  container.alpha = 1.0; // 🔥 CRITICAL: Ensure container is fully opaque
  try { container.interactiveChildren = false; } catch {}
  
  
  // Position container at stage origin (0,0 relative to stage)
  // In PixiJS, stage is usually at (0,0) and covers the entire screen
  container.x = 0;
  container.y = 0;
  stage.addChild(container);
  stage.sortChildren?.();

  wildBeerExplosionContainer = container;
  wildBeerExplosionActive = true;

  // Debug: Verify stage and container positions, and get actual canvas position
  const stagePos = { x: stage.x || 0, y: stage.y || 0 };
  const containerPos = { x: container.x || 0, y: container.y || 0 };
  
  // Get actual canvas viewport position
  let canvasRect = { x: 0, y: 0, width: screenW, height: screenH };
  try {
    if (app && app.canvas) {
      const rect = app.canvas.getBoundingClientRect();
      canvasRect = { x: rect.x || 0, y: rect.y || 0, width: rect.width || screenW, height: rect.height || screenH };
    }
  } catch (e) {
    console.warn('⚠️ Could not get canvas bounding rect:', e);
  }
  
  console.log(`💧 Container created and added to stage:`);
  console.log(`   - Stage position: (${stagePos.x}, ${stagePos.y})`);
  console.log(`   - Container position: (${containerPos.x}, ${containerPos.y})`);
  console.log(`   - Screen dimensions: ${screenW}x${screenH}`);
  console.log(`   - Canvas rect: x=${canvasRect.x}, y=${canvasRect.y}, w=${canvasRect.width}, h=${canvasRect.height}`);
  console.log(`   - Stage children: ${stage.children.length}, container zIndex: ${container.zIndex}`);

  // 🔥 FPS DROP FIX: Start FPS monitoring only if not already active (prevent overhead)
  // Auto-disable after 2 seconds to reduce overhead
  if (!fpsMonitorActive) {
    startFpsMonitoring();
    // Auto-disable FPS monitoring after 2 seconds (bubbles animation is mostly done)
    gsap.delayedCall(2.0, () => {
      stopFpsMonitoring();
    });
  }

  // 🔥 FPS DROP FIX: Faze 1+2+3 - Texture pooling, reduced bubbles, optimized animations
  // FAZA 1: Texture Pooling - Create bubble texture once, reuse for all bubbles (with better fallback)
  // FAZA 2: Reduced bubbles - 70 (was 100, FPS DROP FIX for merge 6), max 60 active (was 80), 1.5s spawn (was 2.0s)
  // FAZA 3: Optimized animations - Simple drift (no keyframes), no rotation, 3 anims (was 5)
  // 🔥 FPS DROP FIX: Smanjeno na 70 bubbles (-30% reduction) za bolji FPS na merge 6
  
  const totalBubbles = 70; // 🔥 FPS DROP FIX: -30% (was 100, now 70 for better FPS on merge 6)
  const spawnDuration = 1500; // 🔥 FPS DROP FIX: 1.5s (was 2.0s) - faster spawn, less peak load
  const maxActive = 60; // 🔥 FPS DROP FIX: -25% (was 80, proportional to 70 bubbles)
  let active = 0;
  let spawned = 0;
  const perMs = totalBubbles / spawnDuration;
  let startTime = performance.now();
  let lastTick = startTime;
  let acc = 0;

  // 🔥 TEMPLATE-BASED: Get bubble colors from active template (wooden style)
  // Wild beer bubbles use light orange/white palette from template
  let bubbleColors;
  try {
    bubbleColors = getBubbleColors('wild-beer');
    if (!bubbleColors || !Array.isArray(bubbleColors) || bubbleColors.length === 0) {
      console.warn('⚠️ getBubbleColors returned empty/invalid array for wild-beer, using default white');
      bubbleColors = [0xFFFFFF, 0xFFF5E6, 0xFFE8D1, 0xFFDCC2]; // Default light orange/white
    }
  } catch (err) {
    console.error('❌ Failed to get bubble colors from template:', err);
    bubbleColors = [0xFFFFFF, 0xFFF5E6, 0xFFE8D1, 0xFFDCC2]; // Default light orange/white
  }
  
  // Select base bubble color from palette for texture (use first color as base)
  const bubbleColorForTexture = bubbleColors[0] || 0xFFFFFF;

  // 🔥 FAZA 1: Create bubble texture once (max size 48px) - cached globally with better fallback
  // 🔥 TEMPLATE-BASED: Use bubble color from template instead of hardcoded white
  if (!_cachedBubbleTexture && app && app.renderer) {
    const maxSize = 48; // Max bubble size
    const maxRadius = maxSize / 2;
    const tempGraphics = new Graphics();
    
    try {
      // Bubble with highlight effect using template color
      tempGraphics.circle(0, 0, maxRadius);
      tempGraphics.fill({ color: bubbleColorForTexture, alpha: 1.0 }); // Template color fill
      // Highlight circle (top-left) - slightly brighter
      tempGraphics.circle(-maxRadius * 0.25, -maxRadius * 0.25, maxRadius * 0.32);
      tempGraphics.fill({ color: bubbleColorForTexture, alpha: 1.0 }); // Brighter highlight
      // Stroke
      tempGraphics.circle(0, 0, maxRadius);
      tempGraphics.stroke({ color: bubbleColorForTexture, alpha: 0.65, width: 1 });
      
      // 🔥 IMPROVED: Better texture generation with multiple fallback strategies
      // Try high resolution first
      try {
        _cachedBubbleTexture = app.renderer.generateTexture(tempGraphics, {
          resolution: 2, // Higher resolution for crisp rendering
          region: { x: -maxRadius - 2, y: -maxRadius - 2, width: maxSize + 4, height: maxSize + 4 }
        });
        if (!_cachedBubbleTexture || _cachedBubbleTexture.destroyed) {
          throw new Error('Texture generation returned invalid texture');
        }
      } catch (e1) {
        // Fallback 1: Try lower resolution
        try {
          console.warn('⚠️ High-res texture generation failed, trying lower resolution:', e1);
          _cachedBubbleTexture = app.renderer.generateTexture(tempGraphics, {
            resolution: 1, // Lower resolution fallback
            region: { x: -maxRadius - 2, y: -maxRadius - 2, width: maxSize + 4, height: maxSize + 4 }
          });
          if (!_cachedBubbleTexture || _cachedBubbleTexture.destroyed) {
            throw new Error('Low-res texture generation returned invalid texture');
          }
        } catch (e2) {
          // Fallback 2: Try without region (auto-calculate)
          try {
            console.warn('⚠️ Region-based texture generation failed, trying auto-region:', e2);
            _cachedBubbleTexture = app.renderer.generateTexture(tempGraphics, {
              resolution: 1
            });
            if (!_cachedBubbleTexture || _cachedBubbleTexture.destroyed) {
              throw new Error('Auto-region texture generation returned invalid texture');
            }
          } catch (e3) {
            // Final fallback: Use Graphics (no texture)
            console.warn('⚠️ All texture generation methods failed, using Graphics fallback:', e3);
            _cachedBubbleTexture = null; // Will use Graphics fallback
          }
        }
      }
    } catch (e) {
      console.error('❌ Critical error in texture generation setup:', e);
      _cachedBubbleTexture = null; // Fallback to Graphics
    } finally {
      // Always clean up temp Graphics
      try {
        tempGraphics.destroy();
      } catch (e) {
        console.warn('⚠️ Failed to destroy temp Graphics:', e);
      }
    }
  }
  
  const bubbleTexture = _cachedBubbleTexture;
  const useTexturePooling = bubbleTexture !== null && !bubbleTexture.destroyed;

  // Log texture status for debugging
  if (!useTexturePooling) {
    console.warn('⚠️ Bubble texture not available, using Graphics fallback (slower but safe)');
  } else {
    console.log('✅ Bubble texture generated successfully, using Sprite optimization');
  }

             console.log(`💧 FPS DROP FIX OPTIMIZED: ${totalBubbles} bubbles (was 100, now 70 for merge 6 FPS fix), texture pooling: ${useTexturePooling ? 'YES' : 'NO (Graphics fallback)'}, 3 anims (was 5), spawn: ${spawnDuration}ms, FPS monitoring: throttled (every 4th frame), spawn logic: throttled (every 2nd frame), culling: throttled (every 5th frame)`);

  const makeBubble = () => {
    if (!wildBeerExplosionContainer || wildBeerExplosionContainer.destroyed) return;
    if (spawned >= totalBubbles || active >= maxActive) return;

    spawned += 1;
    active += 1;

    // 🔥 DEBUG: Update stats for DevTools access
    if (typeof window !== 'undefined' && window._bubbleStats) {
      window._bubbleStats.active = active;
      window._bubbleStats.spawned = spawned;
    }

    let bubble;
    const size = 14 + Math.random() * 34; // 14-48px (same size range as v74)
    const sizeRatio = size / 48; // Ratio to max texture size
    const radius = size / 2;
    const alpha = 0.55 + Math.random() * 0.35; // 0.55-0.9 alpha

    // 🔥 FAZA 1: Use Sprite with texture (1 draw call) OR Graphics fallback (improved)
    let isSprite = false;
    if (useTexturePooling && bubbleTexture) {
      try {
        bubble = new Sprite(bubbleTexture);
    bubble.eventMode = 'none';
    bubble.cursor = 'default';
        bubble.anchor.set(0.5); // Center anchor for proper scaling/rotation
        isSprite = true;
      } catch (e) {
        // If Sprite creation fails, fallback to Graphics
        console.warn('⚠️ Sprite creation failed, using Graphics fallback:', e);
        bubble = graphicsPool.acquire();
        bubble.eventMode = 'none';
        bubble.cursor = 'default';
        bubble.clear();
        // 🔥 TEMPLATE-BASED: Use bubble color from template (random from palette)
        const bubbleColorForGraphics = bubbleColors[Math.floor(Math.random() * bubbleColors.length)];
        bubble.circle(0, 0, radius);
        bubble.fill({ color: bubbleColorForGraphics, alpha });
        bubble.circle(-radius * 0.25, -radius * 0.25, radius * 0.32);
        bubble.fill({ color: bubbleColorForGraphics, alpha: Math.min(1, alpha + 0.2) });
        bubble.circle(0, 0, radius);
        bubble.stroke({ color: bubbleColorForGraphics, alpha: alpha * 0.65, width: 1 });
        isSprite = false;
      }
    } else {
      // Fallback: Use Graphics (slower, but works if texture generation fails)
      bubble = graphicsPool.acquire();
      bubble.eventMode = 'none';
      bubble.cursor = 'default';
      bubble.clear();
      // 🔥 TEMPLATE-BASED: Use bubble color from template (random from palette)
      const bubbleColorForGraphics = bubbleColors[Math.floor(Math.random() * bubbleColors.length)];
      bubble.circle(0, 0, radius);
      bubble.fill({ color: bubbleColorForGraphics, alpha });
      bubble.circle(-radius * 0.25, -radius * 0.25, radius * 0.32);
      bubble.fill({ color: bubbleColorForGraphics, alpha: Math.min(1, alpha + 0.2) });
      bubble.circle(0, 0, radius);
      bubble.stroke({ color: bubbleColorForGraphics, alpha: alpha * 0.65, width: 1 });
      isSprite = false;
    }
    
    // 🔥 FAZA 2: Random distribution (same as v74)
    const startX = (Math.random() - 0.5) * screenW * 1.4 + screenW * 0.5;
    const startY = screenH * (0.95 + Math.random() * 0.2); // Bottom 5-25% of screen
    bubble.x = startX;
    bubble.y = startY;
    bubble.alpha = alpha;
    if (isSprite) {
      bubble.scale.set((0.25 + Math.random() * 0.25) * sizeRatio); // 0.25-0.5 initial scale × size ratio
    } else {
      bubble.scale.set(0.25 + Math.random() * 0.25); // 0.25-0.5 initial scale
    }
    bubble.renderable = true;

    wildBeerExplosionContainer.addChild(bubble);

    const endY = -screenH * (0.1 + Math.random() * 0.15); // End 10-25% above top
    const duration = Math.min(2.1, Math.max(1.1, 1.6 + (Math.random() - 0.5) * 0.6)); // 1.1-2.1s

    // 🔥 FAZA 3: Simple drift (no keyframes) - single horizontal drift instead of 3-phase
    // 🔥 USER REQUEST: Smanjeno za 50% da bubbles budu bliže jedni drugima
    const driftX = (Math.random() - 0.5) * 100; // ±50px horizontal drift (50% smanjeno, was ±100px)

    const bubbleTweens = [];

    // 🔥 FAZA 3: 1. VERTICAL RISE + DRIFT (combined, no keyframes)
    bubbleTweens.push(gsap.to(bubble, {
      x: startX + driftX, // Simple drift (no keyframes)
      y: endY,
      duration,
      ease: 'power2.inOut',
      immediateRender: true
    }));

    // 🔥 FAZA 3: 2. SCALE ANIMATION (kept - important visual effect)
    const finalScale = 0.65 + Math.random() * 0.35; // 0.65-1.0 final scale
    bubbleTweens.push(gsap.to(bubble.scale, {
      x: isSprite ? finalScale * sizeRatio : finalScale, // Apply size ratio only for Sprite
      y: isSprite ? finalScale * sizeRatio : finalScale,
      duration: duration * 0.45,
      ease: 'power1.out',
      immediateRender: true
    }));

    // 🔥 FAZA 3: 3. ALPHA FADE (kept - important visual effect)
    // FAZA 3: Rotation removed (not very visible, saves CPU)
    bubbleTweens.push(gsap.to(bubble, {
      alpha: 0,
      duration: duration * 0.4,
      delay: duration * 0.6,
      ease: 'power2.in',
      immediateRender: true,
      onComplete: () => {
        try {
          bubbleTweens.forEach(t => { try { t.kill?.(); } catch {} });
          if (bubble && bubble.parent) bubble.parent.removeChild(bubble);
          // v75: Sprite uses destroy() (texture reused), Graphics uses pool
          if (bubble instanceof Sprite) {
            bubble.destroy();
          } else {
          graphicsPool.release(bubble);
          }
        } catch {}
        active = Math.max(0, active - 1);
        
        // 🔥 DEBUG: Update stats for DevTools access
        if (typeof window !== 'undefined' && window._bubbleStats) {
          window._bubbleStats.active = active;
        }
      }
    }));

    // Store tweens for cleanup
    bubble._bubbleTweens = bubbleTweens;
  };

  // 🔥 FPS DROP FIX: Performance-based spawn ticker with throttled FPS monitoring and culling
  let frameCounter = 0; // Track frame count for throttling
  const spawnTick = () => {
    if (!wildBeerExplosionContainer || wildBeerExplosionContainer.destroyed) {
      if (wildBeerExplosionSpawnTick === spawnTick) {
        gsap.ticker.remove(spawnTick);
        wildBeerExplosionSpawnTick = null;
      }
      cleanupWildBeerExplosion();
      return;
    }

    frameCounter++;
    
    // 🔥 FPS DROP FIX: Throttle FPS monitoring to every 4th frame (75% reduction in overhead)
    if (frameCounter % 4 === 0) {
      try {
        updateFpsCounter();
      } catch (e) {
        console.warn('⚠️ FPS counter update failed:', e);
      }
    }
    
    // 🔥 FPS DROP FIX: Throttle spawn logic to every 2nd frame (50% reduction in overhead)
    if (frameCounter % 2 === 0) {
      const now = performance.now();
      const dt = Math.max(1, now - lastTick);
      lastTick = now;
      const elapsed = now - startTime;

      if (elapsed >= spawnDuration && spawned >= totalBubbles) {
        if (wildBeerExplosionSpawnTick === spawnTick) {
          gsap.ticker.remove(spawnTick);
          wildBeerExplosionSpawnTick = null;
        }
        setTimeout(() => cleanupWildBeerExplosion(), 2400);
        return;
      }

      // 🔥 FPS DROP FIX: Dynamic spawn rate based on FPS (prevent frame drops)
      // Use safe access to currentFps with fallback
      const safeFps = (typeof currentFps !== 'undefined' && currentFps !== null) ? currentFps : 60;
      const fpsFactor = safeFps >= 50 ? 1.0 : Math.max(0.5, safeFps / 50); // Reduce spawn if FPS drops
      acc += perMs * dt * fpsFactor;
      const toSpawn = Math.min(2, Math.floor(acc)); // 🔥 FPS DROP FIX: Reduced from 3 to 2 (33% reduction)
      if (toSpawn > 0) {
        acc -= toSpawn;
        for (let i = 0; i < toSpawn; i++) {
          // 🔥 FRAME DROP FIX: Check FPS before spawning (prevent overload)
          if (safeFps < 30 && spawned >= totalBubbles * 0.7) {
            // If FPS drops below 30, stop spawning after 70% of bubbles
            break;
          }
    makeBubble();
  }
      }
    }
    
    // 🔥 FPS DROP FIX: Culling - hide off-screen bubbles to reduce render load
    // 🔥 FPS DROP FIX: Throttled to every 5th frame (80% reduction in overhead, was every 3rd)
    if (frameCounter % 5 === 0) {
      const elapsed = performance.now() - startTime;
      if (elapsed > 0.5) { // Start culling after 0.5s (bubbles are moving)
        try {
          const children = wildBeerExplosionContainer.children || [];
          const cullMargin = 50; // Margin for culling
          for (let i = 0; i < children.length; i++) {
            const bubble = children[i];
            if (bubble && bubble.y !== undefined) {
              // Hide bubbles that are off-screen
              if (bubble.y < -cullMargin || bubble.y > screenH + cullMargin) {
                bubble.visible = false;
              } else {
                bubble.visible = true;
              }
            }
          }
        } catch (e) {
          // Silently fail culling if there's an error
        }
      }
    }
  };

  // 🔥 v75 INITIAL BURST: Spawn 5 bubbles immediately (proportional to 100 total, was 6 for 125)
  const initialBurst = Math.floor(totalBubbles / 20); // ~5 bubbles for 100 total
  for (let i = 0; i < initialBurst; i++) makeBubble();
  
  // Start spawn ticker
  wildBeerExplosionSpawnTick = spawnTick;
  wildBeerExplosionContainer._bubbleSpawnTicker = spawnTick;
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

// Track active star animations for cleanup (prevents lag when merging multiple wild stars quickly)
let activeStarAnimationContainers = new Set();

/**
 * Cleanup any existing star animations before starting new one (prevents lag)
 */
function cleanupExistingStarAnimations() {
  activeStarAnimationContainers.forEach(container => {
    try {
      if (container && !container.destroyed) {
        // Kill all GSAP animations
        gsap.killTweensOf(container);
        gsap.killTweensOf(container.scale);
        gsap.killTweensOf(container.alpha);
        
        // Kill animations on all children
        if (container.children) {
          container.children.forEach(child => {
            try {
              gsap.killTweensOf(child);
              gsap.killTweensOf(child.scale);
              gsap.killTweensOf(child.rotation);
              gsap.killTweensOf(child.alpha);
            } catch {}
          });
        }
        
        // Remove from parent
        if (container.parent) {
          container.parent.removeChild(container);
        }
        
        // Destroy container
        if (!container.destroyed) {
          container.destroy({ children: true });
        }
      }
    } catch {}
  });
  activeStarAnimationContainers.clear();
}

/**
 * 🔥 USER REQUEST: Animate 3 orbiting stars from wild tile to HUD star icon
 * Similar to createMerge6Stars but animates stars TO HUD icon instead of away
 * @param {*} board - Board container
 * @param {*} stage - Stage container (for screen coordinates)
 * @param {Array} savedStarPositions - Array of saved star data: [{ sprite, globalX, globalY, scale }]
 * @param {Object} savedWildTileScreenPos - Saved wild tile position: { x, y }
 * @param {Object} merge6CenterPos - Merge 6 center position: { x, y }
 * @param {Object} hudStarIconPos - HUD star icon position: { x, y }
 */
export async function animateStarsToHudIcon(board, stage, savedStarPositions, savedWildTileScreenPos, merge6CenterPos, hudStarIconPos) {
  if (!board || !stage || !savedStarPositions || !Array.isArray(savedStarPositions) || savedStarPositions.length === 0) {
    console.warn('⚠️ animateStarsToHudIcon: Missing saved star positions');
    return;
  }
  
  if (!hudStarIconPos) {
    console.warn('⚠️ animateStarsToHudIcon: Missing HUD star icon position');
    return;
  }
  
  // 🔥 PERFORMANCE FIX: Cleanup existing animations before starting new one (prevents lag)
  cleanupExistingStarAnimations();
  
  // Use saved wild tile position or fallback to merge6CenterPos
  const wildTileScreenX = savedWildTileScreenPos?.x ?? merge6CenterPos?.x ?? 0;
  const wildTileScreenY = savedWildTileScreenPos?.y ?? merge6CenterPos?.y ?? 0;
  
  // Get HUD star icon position (already in screen coordinates)
  const hudScreenX = hudStarIconPos.x;
  const hudScreenY = hudStarIconPos.y;
  
  // 🔥 CRITICAL: Create animation container on STAGE with PROTECTED identifier
  // This ensures it's independent of board animations and won't be killed by cleanup
  const animationContainer = new Container();
  animationContainer.name = 'stars-to-hud-animation';
  animationContainer.zIndex = 30000; // 🔥 VERY HIGH z-index to be above all board animations
  animationContainer.eventMode = 'none';
  animationContainer.x = 0;
  animationContainer.y = 0;
  
  // 🔥 CRITICAL: Mark container as PROTECTED to prevent it from being killed by cleanup functions
  animationContainer._isProtectedStarAnimation = true;
  
  // Ensure stage sortable children is enabled for z-index
  if (stage.sortableChildren !== undefined) {
    stage.sortableChildren = true;
  }
  
  stage.addChild(animationContainer);
  
  // Track this container for cleanup
  activeStarAnimationContainers.add(animationContainer);
  
  // Force sort to ensure z-index is respected
  try {
    stage.sortChildren();
  } catch {}
  
  // Store references for cleanup
  const starSprites = [];
  const timelines = [];
  
  const STAR_COUNT = Math.min(3, savedStarPositions.length);
  
  // 🔥 PERFORMANCE OPTIMIZATION: Use single shared texture for all stars (object pooling)
  // This reduces memory usage and improves frame rate
  let sharedStarTexture = null;
  try {
    // Try to get cached texture first (from getStarTexture function)
    if (typeof getStarTexture === 'function') {
      sharedStarTexture = getStarTexture();
    }
    
    // Fallback: try to get from saved positions
    if (!sharedStarTexture && savedStarPositions.length > 0 && savedStarPositions[0]?.texture) {
      sharedStarTexture = savedStarPositions[0].texture;
    }
    
    // Last resort: create new texture
    if (!sharedStarTexture) {
      sharedStarTexture = Texture.from('./assets/small-star.png');
    }
  } catch (e) {
    console.warn('⚠️ Failed to get shared star texture, using first saved texture as fallback:', e);
    if (savedStarPositions.length > 0 && savedStarPositions[0]?.texture) {
      sharedStarTexture = savedStarPositions[0].texture;
    }
  }
  
  if (!sharedStarTexture) {
    console.error('❌ No star texture available, aborting animation');
    return;
  }
  
  const textureSize = sharedStarTexture.width || 32; // Shared texture size
  
  // Animation parameters
  const baseDuration = 1.6; // 🔥 USER REQUEST: Increased by 0.6s (from 1.0s to 1.6s)
  // 🔥 USER REQUEST: Different delays for each star to create better spacing
  // Star 1: immediate (0ms)
  // Star 2: small delay (0.08s)
  // Star 3: larger delay (0.08s + 0.15s = 0.23s) - more separation from star 2
  const getStarDelay = (index) => {
    if (index === 0) return 0; // First star: immediate
    if (index === 1) return 0.08; // Second star: 80ms delay
    return 0.23; // Third star: 230ms delay (larger gap from star 2)
  };
  // 🔥 USER REQUEST: Different durations for each star (slower animation for 2nd and 3rd star)
  // Star 1: baseDuration (1.6s)
  // Star 2: baseDuration + 0.3s (1.9s) - 300ms slower
  // Star 3: baseDuration + 0.4s (2.0s) - 400ms slower
  const getStarDuration = (index, baseDur, distanceFactor) => {
    let duration = baseDur * distanceFactor;
    if (index === 1) {
      duration += 0.3; // 🔥 Second star: 300ms slower
    } else if (index === 2) {
      duration += 0.4; // 🔥 Third star: 400ms slower
    }
    return duration;
  };
  const targetScaleSize = 28; // Target size when scaling down at 90%
  
  // 🔥 CRITICAL: Track bounce delays to ensure sequential bounces (one after another)
  let bounceDelayTracker = 0;
  const bounceDelayBetweenStars = 0.23; // Duration of bounce animation (0.08 + 0.15 = 0.23s)
  
  // Animate stars sequentially (one after another)
  for (let i = 0; i < STAR_COUNT; i++) {
    const savedStarData = savedStarPositions[i];
    if (!savedStarData) {
      console.warn('⚠️ Saved star data missing, skipping star', i);
      continue;
    }
    
    // Use saved star position (already in screen coordinates)
    const starStartX = savedStarData.globalX ?? wildTileScreenX;
    const starStartY = savedStarData.globalY ?? wildTileScreenY;
    
    // 1. Random size between 24-56px
    const randomSize = 24 + Math.random() * 32; // 24-56px
    const initialScale = randomSize / textureSize;
    
    // 🔥 PERFORMANCE: Use shared texture instead of individual textures
    // Create animated star sprite with shared texture (no pooling needed - sprites are lightweight)
    const animatedStar = new Sprite(sharedStarTexture);
    animatedStar.anchor.set(0.5);
    animatedStar.scale.set(initialScale, initialScale);
    animatedStar.tint = 0xFFFFFF;
    animatedStar.alpha = 1.0;
    animatedStar.x = starStartX;
    animatedStar.y = starStartY;
    animationContainer.addChild(animatedStar);
    starSprites.push(animatedStar);
    
    // Calculate path to HUD (upward wavy motion)
    const dx = hudScreenX - starStartX;
    const dy = hudScreenY - starStartY;
    const distance = Math.hypot(dx, dy);
    const distanceFactor = Math.min(1.0, Math.max(0.6, distance / 800));
    // 🔥 USER REQUEST: Use different duration for each star (2nd and 3rd are slower)
    const duration = getStarDuration(i, baseDuration, distanceFactor);
    
    // 🔥 USER REQUEST: More randomized and fluid path for each star
    // Each star gets unique random path parameters for more variety
    const pathPoints = [];
    const numPoints = 16; // 🔥 More points for smoother, more fluid curve
    
    // 🔥 More randomization: Each star gets unique random parameters
    const waveDirection = (i % 2 === 0) ? -1 : 1; // Alternating base direction
    const randomDirectionVariation = (Math.random() - 0.5) * 0.3; // Add random variation
    const finalWaveDirection = waveDirection + randomDirectionVariation;
    
    // More varied amplitude and frequency for each star
    const waveAmplitude = 50 + Math.random() * 40; // 50-90px amplitude (more varied)
    const waveFrequency = 1.5 + Math.random() * 1.5; // 1.5-3.0 frequency (more varied)
    const wavePhaseOffset = Math.random() * Math.PI * 2; // Random phase offset for each star
    
    // Additional randomization: slight vertical/horizontal offset
    const verticalOffset = (Math.random() - 0.5) * 20; // -10 to +10px vertical variation
    const horizontalOffset = (Math.random() - 0.5) * 20; // -10 to +10px horizontal variation
    
    for (let p = 0; p <= numPoints; p++) {
      const t = p / numPoints;
      
      // Base position along straight line to HUD
      const baseX = starStartX + dx * t;
      const baseY = starStartY + dy * t;
      
      // 🔥 More fluid path: Use bezier-like curve with multiple wave components
      const perpAngle = Math.atan2(dy, dx) + Math.PI / 2;
      
      // Primary wave component
      const wavePhase = t * Math.PI * waveFrequency + wavePhaseOffset;
      const primaryWave = Math.sin(wavePhase) * waveAmplitude * (1 - t * 0.7); // Decreases more gradually
      
      // Secondary wave component for more fluid motion (smaller, faster)
      const secondaryWaveFreq = waveFrequency * 2.5;
      const secondaryWave = Math.sin(t * Math.PI * secondaryWaveFreq + wavePhaseOffset * 0.5) * (waveAmplitude * 0.3) * (1 - t);
      
      // Combined wave offset
      const totalWaveOffset = (primaryWave + secondaryWave) * finalWaveDirection;
      
      // Apply random offsets for more variety
      const offsetX = Math.cos(perpAngle) * totalWaveOffset + horizontalOffset * (1 - t);
      const offsetY = Math.sin(perpAngle) * totalWaveOffset + verticalOffset * (1 - t);
      
      // Final point MUST be exactly at HUD position (t = 1.0)
      if (p === numPoints) {
        pathPoints.push({
          x: hudScreenX, // Exact HUD position
          y: hudScreenY, // Exact HUD position
          t: 1.0
        });
      } else {
        pathPoints.push({
          x: baseX + offsetX,
          y: baseY + offsetY,
          t: t
        });
      }
    }
    
    // 2. Rotation: 10-15 degrees, matching wave direction (left wave = left rotation, right wave = right rotation)
    const rotationDegrees = (10 + Math.random() * 5) * waveDirection; // 10-15 degrees, matches wave direction
    const rotationRadians = rotationDegrees * (Math.PI / 180);
    
    // Create timeline with custom delay (different for each star)
    const delay = getStarDelay(i);
    const path = { x: starStartX, y: starStartY, progress: 0 };
    
    // Track if star has already disappeared (to prevent multiple triggers)
    let starDisappeared = false;
    
    const tl = gsap.timeline({
      delay,
      onComplete: () => {
        // Safety cleanup if star somehow didn't disappear at 50%
        if (!starDisappeared) {
          try {
            gsap.killTweensOf(animatedStar);
            animatedStar.alpha = 0;
            animatedStar.visible = false;
            if (animatedStar.parent) {
              animatedStar.parent.removeChild(animatedStar);
            }
            animatedStar.destroy();
          } catch {}
        }
      }
    });
    
    // 🔥 CRITICAL: Mark timeline as PROTECTED to prevent it from being killed by external cleanup
    // This ensures star animations continue even if killTweensOf(stage) is called
    tl._isProtectedStarAnimation = true;
    animatedStar._isProtectedStarAnimation = true; // Also mark sprite as protected
    
    // 🔥 OPTIMIZATION: Use more efficient easing and reduce calculations
    // Animate along wavy path with optimized interpolation
    tl.to(path, {
      progress: 1,
      duration: duration,
      ease: 'power1.inOut', // 🔥 Faster easing for better performance (less calculations than sine)
      onUpdate: () => {
        // 🔥 OPTIMIZATION: Cache calculations and reduce redundant operations
        const t = path.progress;
        
        // Early exit if star already disappeared
        if (starDisappeared) return;
        
        // Optimized interpolation: use linear interpolation between cached points
        const pointIndex = Math.floor(t * (pathPoints.length - 1));
        const nextIndex = Math.min(pointIndex + 1, pathPoints.length - 1);
        const localT = (t * (pathPoints.length - 1)) - pointIndex;
        
        const currentPoint = pathPoints[pointIndex];
        const nextPoint = pathPoints[nextIndex];
        
        // Calculate new position
        const newX = currentPoint.x + (nextPoint.x - currentPoint.x) * localT;
        const newY = currentPoint.y + (nextPoint.y - currentPoint.y) * localT;
        
        // Only update if position changed significantly (performance optimization)
        if (Math.abs(animatedStar.x - newX) > 0.5 || Math.abs(animatedStar.y - newY) > 0.5) {
          path.x = newX;
          path.y = newY;
          animatedStar.x = newX;
          animatedStar.y = newY;
        }
        
        // 1. MUST HAVE: Star disappears at 98% of its path (when it reaches 98% of distance to star-hud)
        // No waiting for other stars, no rotation animation at destination - instant disappear
        if (t >= 0.98 && !starDisappeared) {
          starDisappeared = true;
          
          // Kill all animations on this star immediately
          gsap.killTweensOf(animatedStar);
          gsap.killTweensOf(animatedStar.scale);
          gsap.killTweensOf(animatedStar.rotation);
          gsap.killTweensOf(animatedStar.alpha);
          
          // 3. Instant disappearance - no rotation, no waiting, alpha = 0 immediately
          animatedStar.alpha = 0;
          animatedStar.visible = false;
          
          // Immediately remove sprite
          try {
            if (animatedStar.parent) {
              animatedStar.parent.removeChild(animatedStar);
            }
            animatedStar.destroy();
            
            // Remove from starSprites array
            const index = starSprites.indexOf(animatedStar);
            if (index > -1) {
              starSprites.splice(index, 1);
            }
          } catch (err) {
            console.warn('⚠️ Error removing star:', err);
          }
          
          // 🔥 CRITICAL: Add star count - this triggers bounce via queue system (sequential, no overlap)
          // Only ONE call to addStars per star (removed duplicate)
          try {
            if (typeof window !== 'undefined' && window.CC && typeof window.CC.addStars === 'function') {
              window.CC.addStars(1);
              console.log('⭐ Star', i, 'added via window.CC.addStars (triggers bounce via queue)');
            } else {
              console.warn('⚠️ window.CC.addStars not available, falling back to dynamic import');
              // Fallback: dynamic import (slower, but should not happen)
              import('./stars-collector.js').then((StarsCollector) => {
                if (typeof StarsCollector.addStars === 'function') {
                  StarsCollector.addStars(1);
                  console.log('⭐ Star added via dynamic import (fallback)');
                }
              }).catch((err) => {
                console.warn('⚠️ Error importing stars-collector:', err);
              });
            }
          } catch (err) {
            console.warn('⚠️ Error adding star:', err);
          }
          
          // Stop timeline for this star (it has disappeared)
          return;
        }
        
        // Scale down to 28px after 90% of path (only if star hasn't disappeared yet)
        // 🔥 OPTIMIZATION: Only update scale if needed (reduce calculations)
        if (t >= 0.9 && !starDisappeared) {
          const scaleProgress = (t - 0.9) / 0.1; // 0 to 1 in last 10%
          const targetScale = (targetScaleSize / textureSize);
          const currentScale = initialScale + (targetScale - initialScale) * scaleProgress;
          // Only update if scale actually changed (performance optimization)
          if (Math.abs(animatedStar.scale.x - currentScale) > 0.01) {
            animatedStar.scale.set(currentScale, currentScale);
          }
        }
      }
    });
    
    // 2. Apply rotation throughout path (stops at 98% when star disappears)
    // 🔥 USER REQUEST: Use same duration as path animation (slower for 2nd and 3rd star)
    tl.to(animatedStar, {
      rotation: rotationRadians,
      duration: duration * 0.98, // Rotate until 98% (when star disappears) - uses adjusted duration
      ease: 'sine.inOut'
    }, 0);
    
    timelines.push(tl);
  }
  
  // 🔥 MEMORY LEAK FIX: Improved cleanup after all animations complete
  // Each star cleans itself up immediately when it reaches destination
  // But we still need to ensure container and all references are cleaned up
  // Calculate sequential delay based on star delays (max delay between stars)
  const maxDelay = getStarDelay(STAR_COUNT - 1); // Maximum delay (for last star: 0.23s)
  const sequentialDelay = maxDelay; // Use maximum delay for total duration calculation
  const totalDuration = baseDuration + maxDelay; // Base duration + maximum delay for cleanup timing
  
  // Track cleanup state to prevent double cleanup
  let cleanupDone = false;
  
  const performCleanup = () => {
    if (cleanupDone) return;
    cleanupDone = true;
    
    try {
      // Kill all timelines (active or not)
      timelines.forEach(tl => {
        try { 
          if (tl) {
            tl.kill();
            tl.clear?.();
          }
        } catch {}
      });
      timelines.length = 0; // Clear array
      
      // Remove all sprites (even if already destroyed, ensure cleanup)
      starSprites.forEach(sprite => {
        try {
          if (sprite) {
            // Kill all tweens on sprite
            gsap.killTweensOf(sprite);
            gsap.killTweensOf(sprite.scale);
            gsap.killTweensOf(sprite.rotation);
            gsap.killTweensOf(sprite.alpha);
            
            // Remove from parent if still attached
            if (sprite.parent) {
              sprite.parent.removeChild(sprite);
            }
            
            // Destroy sprite (even if already destroyed, safe to call)
            if (!sprite.destroyed) {
              sprite.destroy({ children: true });
            }
          }
        } catch {}
      });
      starSprites.length = 0; // Clear array
      
      // Remove container if still exists
      if (animationContainer) {
        try {
          // Remove from tracking set
          activeStarAnimationContainers.delete(animationContainer);
          
          // Kill any tweens on container
          gsap.killTweensOf(animationContainer);
          gsap.killTweensOf(animationContainer.scale);
          gsap.killTweensOf(animationContainer.alpha);
          
          // Remove from parent
          if (animationContainer.parent) {
            animationContainer.parent.removeChild(animationContainer);
          }
          
          // Destroy container and all children
          if (!animationContainer.destroyed) {
            animationContainer.destroy({ children: true });
          }
        } catch {}
      }
    } catch (err) {
      console.warn('⚠️ Error during animation cleanup:', err);
    }
  };
  
  // 🔥 CRITICAL: Use setTimeout instead of gsap.delayedCall for cleanup
  // This ensures cleanup is NOT killed by killAllDelayedCalls() and is completely independent
  // Safety cleanup: ensure container is removed even if something goes wrong
  // Use shorter delay for faster cleanup (0.5s buffer instead of 1.0s)
  const cleanupTimeout = setTimeout(() => {
    performCleanup();
  }, (totalDuration + 0.5) * 1000); // Convert to milliseconds
  
  // Store timeout reference on container for manual cleanup if needed
  if (animationContainer) {
    animationContainer._cleanupTimeout = cleanupTimeout;
    
    // Also cleanup on container destroy (if container is destroyed externally)
    const originalDestroy = animationContainer.destroy;
    animationContainer.destroy = function(opts) {
      try {
        if (cleanupTimeout) {
          clearTimeout(cleanupTimeout);
        }
      } catch {}
      performCleanup();
      if (originalDestroy) {
        return originalDestroy.call(this, opts);
      }
    };
  }
  
  // 🔥 CRITICAL: Store reference to animation container and timelines for protection
  // Mark timeline with protection flag to prevent external kill
  timelines.forEach(tl => {
    if (tl) {
      tl._isProtectedStarAnimation = true;
    }
  });
  
  console.log('🛡️ Star animation is PROTECTED and completely independent from board animations');
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
  // Bail out fast if board/tile are missing or already destroyed; avoids null Graphics errors during teardown.
  if (!board || board.destroyed || !tile) return;

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

  // Rapid-merge throttling: reduce particle load if previous FX fired recently.
  const hotFactor = getFxHotFactor();

  const baseStrength = Math.max(0.4, power);
  const COUNT     = Math.max(6, Math.round((44 + Math.random()*14) * baseStrength * countScale * hotFactor));
  const BASE_R    = Math.max(6, Math.round(size * 0.051 * sizeScale)); // +50% larger base size
  const MAX_R     = Math.max(18, Math.round(size * 0.24 * sizeScale)); // +50% larger max size
  const INSET     = size * 0.02 * insetScale;
  const OUT_MIN   = size * 0.15 * distanceScale;
  const OUT_MAX   = size * 0.34 * distanceScale;
  const BURSTS    = Math.max(3, Math.round((options.bursts ?? 5) * hotFactor));
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
      // 🔥 OBJECT POOLING: Use pool instead of creating new Graphics
      const puff = graphicsPool.acquire();
      if (!puff || puff.destroyed || typeof puff.clear !== 'function' || typeof puff.circle !== 'function' || typeof puff.ellipse !== 'function') {
        continue; // Skip invalid pooled graphic
      }

      // Defensive cleanup of recycled graphic; if clear throws, release and skip.
      try {
        puff.clear();
      } catch {
        try { graphicsPool.release(puff); } catch {}
        continue;
      }
      
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
        // 🔥 OBJECT POOLING: Release back to pool instead of destroying
        onComplete: ()=>{ 
          try{ 
            if(puff && puff.parent){ 
              puff.parent.removeChild(puff); 
              graphicsPool.release(puff); 
            } 
          }catch{} 
        }
      });

      const targetAlpha = options.trailAlpha ?? 0.95;
      tl.to(puff, { alpha: targetAlpha, duration: tIn, ease: 'power2.out' }, stg)
        .to(puff, { x: dx + driftX, y: dy + driftY, duration: tRun, ease: 'sine.out' }, `>${0}`)
        .to(puff, { alpha: targetAlpha, duration: tHold, ease: 'none' }, `>${0}`)
        .to(puff, { alpha: 0, duration: tOut, ease: 'power1.in' }, `>${0}`);
    }
  }

  // 🔥 OBJECT POOLING: Use pool for halo Graphics object
  const halo = graphicsPool.acquire();
  if (!halo || halo.destroyed || typeof halo.clear !== 'function' || typeof halo.circle !== 'function') {
    return;
  }
  halo.clear();
  const haloScale = options.haloScale ?? 1;
  const rr = size * (0.22 + 0.05*baseStrength) * haloScale;
  halo.circle(0, 0, rr).fill({ color: 0xFFFFFF, alpha: 0.10 * (options.haloAlpha ?? 1) });
  halo.alpha = 0;
  layer.addChildAt(halo, 0);
  gsap.to(halo, { alpha: 0.22, duration: 0.08, ease: 'power2.out' });
  gsap.to(halo, { alpha: 0, duration: 0.28, delay: 0.18, ease: 'power2.in',
    // 🔥 OBJECT POOLING: Release back to pool instead of destroying
    onComplete: ()=>{ 
      try{ 
        if(halo && halo.parent){ 
          halo.parent.removeChild(halo); 
          graphicsPool.release(halo); 
        } 
      }catch{} 
    }
  });
}

// Light smoke trail for drag effect (separate from smokeBubblesAtTile)
export function dragSmokeTrail(board, tile, tileSize = 96, strength = 1, opts = {}){
  if (!board || !tile) return;
  
  const count = Math.floor(19 + Math.random() * 11); // 19-30 particles (30% more: 14-23 -> 19-30)
  const { x, y } = centerInBoard(board, tile, tileSize);
  
  for (let i = 0; i < count; i++) {
    // 🔥 OBJECT POOLING: Use pool instead of creating new Graphics (same as wild tiles)
    const puff = graphicsPool.acquire();
    
    // 🔥 CRITICAL: Clear any previous drawing commands before reuse
    puff.clear();
    
    // 🔥 CRITICAL: Reset all properties to ensure clean state (no blend mode, no tint, etc.)
    puff.tint = 0xFFFFFF; // Reset tint to white (no color modification)
    puff.blendMode = 'normal'; // Ensure normal blend mode
    puff.alpha = 1.0; // Reset alpha before drawing
    
    // 🔥 MEMORY LEAK FIX: Track Graphics object
    __globalGraphicsObjects.add(puff);
    
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
    // 🔥 TEMPLATE-BASED: Get drag particle colors from active template (wooden style)
    // Regular tiles use beige/cream palette from template
    let colors;
    try {
      colors = getDragParticleColors(null); // null = regular tiles
      if (!colors || !Array.isArray(colors) || colors.length === 0) {
        console.warn('⚠️ getDragParticleColors returned empty/invalid array for regular, using fallback');
        colors = [0xF4EEE7, 0xFBE3C5, 0xECD7C2, 0xE5C7AD, 0xFADEC0]; // Beige/cream fallback
      }
    } catch (err) {
      console.error('❌ Failed to get drag particle colors from template:', err);
      colors = [0xF4EEE7, 0xFBE3C5, 0xECD7C2, 0xE5C7AD, 0xFADEC0]; // Beige/cream fallback
    }
    
    // 🔥 CRITICAL: Ensure colors array is valid
    if (!colors || !Array.isArray(colors) || colors.length === 0) {
      colors = [0xF4EEE7]; // At least use beige
    }
    
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
          }
          // 🔥 MEMORY LEAK FIX: Remove from tracker
          __globalGraphicsObjects.delete(puff);
          // 🔥 OBJECT POOLING: Release back to pool instead of destroying
          graphicsPool.release(puff);
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

    // 🔥 USER REQUEST: Also shake board indicator element (Board #2, etc.)
    const boardIndicator = document.getElementById('hud-board-indicator');
    if (boardIndicator) {
      try { gsap.killTweensOf(boardIndicator); } catch {}
      console.log('💥 SCREEN SHAKE: Also shaking board indicator element');
    }

    const tl = gsap.timeline({
      onComplete: () => { 
        try { gsap.set(target, { x: 0, y: 0 }); } catch {}
        // Reset board indicator position
        if (boardIndicator) {
          try { gsap.set(boardIndicator, { x: 0, y: 0 }); } catch {}
        }
      }
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
      
      // 🔥 USER REQUEST: Apply same shake to board indicator element
      if (boardIndicator) {
        // Use slightly reduced strength for board indicator (80% of main shake)
        const indicatorAmp = amp * 0.8;
        tl.to(boardIndicator, { x: dx * 0.8, y: dy * 0.8, duration: dt, ease }, 0 + i * dt);
      }
    }
    // Use the same ease for the return animation, or power2.out for normal shake
    const returnEase = ease === 'elastic.out(1, 0.3)' ? 'elastic.out(1, 0.5)' : 'power2.out';
    tl.to(target, { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: Math.min(0.12, duration * 0.45), ease: returnEase }, '>');
    
    // 🔥 USER REQUEST: Return board indicator to original position
    if (boardIndicator) {
      tl.to(boardIndicator, { x: 0, y: 0, duration: Math.min(0.12, duration * 0.45), ease: returnEase }, '>');
    }
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
      // 🔥 CRITICAL: Ensure tile.special is set to 'wild-magnet' for correct color retrieval
      if (!tile.special || tile.special !== 'wild-magnet') {
        console.warn('⚠️ startMagnetIdleParticles: tile.special is not "wild-magnet", setting it now');
        tile.special = 'wild-magnet';
      }
      
      // Use normal size particles (no sizeMultiplier) - same as drag smoke effect (v78 style)
      // 🔥 USER REQUEST: Increased alpha for idle particles to make them more visible
      // 🔥 MEMORY LEAK FIX: Track particles for immediate cleanup when tile is destroyed
      magicSparklesAtTile(board, tile, { 
        intensity: 0.45, // 45% intensity (increased from 24% for better visibility)
        trackForIdle: true // 🔥 CRITICAL: Track particles for cleanup
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
 * 🔥 MEMORY LEAK FIX: Also kills all active particles immediately
 */
export function stopMagnetIdleParticles(tile) {
  if (!tile) return;
  
  // 🔥 CRITICAL: Clear interval first to stop generating new particles
  if (tile._magnetIdleParticlesInterval) {
    clearInterval(tile._magnetIdleParticlesInterval);
    tile._magnetIdleParticlesInterval = null;
  }
  
  // 🔥 MEMORY LEAK FIX: Kill all active particles immediately (don't wait for GSAP animations to complete)
  if (tile._magnetIdleParticles && Array.isArray(tile._magnetIdleParticles)) {
    const particles = tile._magnetIdleParticles.slice(); // Copy array to avoid modification during iteration
    particles.forEach((particle) => {
      if (!particle || particle.destroyed) return;
      try {
        // Kill GSAP animations on particle
        gsap.killTweensOf(particle);
        gsap.killTweensOf(particle.x);
        gsap.killTweensOf(particle.y);
        gsap.killTweensOf(particle.alpha);
        gsap.killTweensOf(particle.rotation);
        
        // Remove from board
        if (particle?.parent) {
          particle.parent.removeChild(particle);
        }
        
        // Remove from global tracker
        __globalGraphicsObjects.delete(particle);
        
        // Release back to pool
        graphicsPool.release(particle);
      } catch (err) {
        console.warn('⚠️ Error cleaning up magnet idle particle:', err);
      }
    });
    
    // Clear the tracking array
    tile._magnetIdleParticles = null;
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
  const generateParticles = async () => {
    if (!heroImageElement || !heroImageElement.parentElement) {
      console.warn('⚠️ generateParticles: Hero image element not in DOM');
      return;
    }
    
    if (!overlayContainer) {
      console.warn('⚠️ generateParticles: Overlay container not found');
      return;
    }
    
    try {
      // 🔥 OBJECT POOLING: Import domElementPool for img elements
      const { domElementPool } = await import('./dom-element-pool.js');
      
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
        // 🔥 OBJECT POOLING: Use pool instead of creating new img element
        const particle = domElementPool.acquire('img');
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
                // 🔥 OBJECT POOLING: Release particle back to pool instead of removing
                if (particle && particle.parentNode) {
                  particle.parentNode.removeChild(particle);
                }
                // Release to pool after removing from DOM
                domElementPool.release(particle);
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
                        
                        // 🔥 USER REQUEST: Badge ONLY on Journey icon (stats-nav.png), not on Collectibles
                        // No badge update needed here - badge only shows on Journey icon
                        const pendingFlips = win.__pendingCollectibleFlips || [];
                        console.log('🔍 Pending flips:', pendingFlips.length, '(badge only on Journey icon)');
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
    
    // 🔥 USER REQUEST: Add gentle bounce animation on tap
    if (heroImageElement && heroImageElement.parentElement) {
      // Kill any existing GSAP animations on scale
      gsap.killTweensOf(heroImageElement, 'scale');
      
      // Gentle bounce: scale down slightly, then back up with slight overshoot
      // Use transform: scale() which will combine with existing CSS animations (like cubesFloat)
      gsap.to(heroImageElement, {
        scale: 0.95,
        duration: 0.1,
        ease: 'power2.out',
        transformOrigin: 'center center',
        onComplete: () => {
          gsap.to(heroImageElement, {
            scale: 1.0,
            duration: 0.2,
            ease: 'back.out(1.5)', // Slight overshoot for bounce effect
            transformOrigin: 'center center',
            onComplete: () => {
              // Clear GSAP scale after animation completes to let CSS animation (cubesFloat) continue
              gsap.set(heroImageElement, { clearProps: 'scale' });
            }
          });
        }
      });
    }
    
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
    
    // 🔥 USER REQUEST: Add gentle bounce animation on tap
    if (heroImageElement && heroImageElement.parentElement) {
      // Kill any existing GSAP animations on scale
      gsap.killTweensOf(heroImageElement, 'scale');
      
      // Gentle bounce: scale down slightly, then back up with slight overshoot
      // Use transform: scale() which will combine with existing CSS animations (like cubesFloat)
      gsap.to(heroImageElement, {
        scale: 0.95,
        duration: 0.1,
        ease: 'power2.out',
        transformOrigin: 'center center',
        onComplete: () => {
          gsap.to(heroImageElement, {
            scale: 1.0,
            duration: 0.2,
            ease: 'back.out(1.5)', // Slight overshoot for bounce effect
            transformOrigin: 'center center',
            onComplete: () => {
              // Clear GSAP scale after animation completes to let CSS animation (cubesFloat) continue
              gsap.set(heroImageElement, { clearProps: 'scale' });
            }
          });
        }
      });
    }
    
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
