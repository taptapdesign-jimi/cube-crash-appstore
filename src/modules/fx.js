// @ts-nocheck
// src/modules/fx.js
// Minimal FX surface used by app.js (stable named exports).

import { Container, Graphics, Text, Texture, Sprite } from 'pixi.js';
import { gsap } from 'gsap';

import { attachWildStarHalo, detachWildStarHalo, preloadWildStarTexture } from './wild-stars.js';

try {
  preloadWildStarTexture();
} catch {}

export function startWildStars(tile){
  attachWildStarHalo(tile);
}

export function stopWildStars(tile){
  detachWildStarHalo(tile);
}

/* ---------- tiny helpers ---------- */
// 🔥 MEMORY LEAK FIX: Track all delayed calls globally so they can be killed on cleanup
const __globalDelayedCalls = new Set();

// 🔥 MEMORY LEAK FIX: Track all Graphics objects created for effects
const __globalGraphicsObjects = new Set();

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

  // Use wood shards effect for wild cubes - much more visible
  const { x, y } = centerInBoard(board, tile, 96);
  const shardCount = 20; // Even more shards for visible trail
  const baseTile = Math.max(60, Math.min(200, opts.tileSize ?? 96));
  
  // 🔥 CRITICAL: For wild-magnet, add red color #F26034 to sparkles
  const isWildMagnet = tile?.special === 'wild-magnet';
  const baseColors = [0xF4EEE7, 0xFBE3C5, 0xECD7C2, 0xE5C7AD, 0xFADEC0];
  const colors = isWildMagnet ? [...baseColors, 0xF26034] : baseColors; // Add red color for wild-magnet
  
  for (let i = 0; i < shardCount; i++) {
    const shard = new Graphics();
    
    // 🔥 MEMORY LEAK FIX: Track Graphics object
    __globalGraphicsObjects.add(shard);
    
    // Wild cube shard colors (with red for wild-magnet)
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    // Much larger rectangular shards - highly visible
    const width = 12 + Math.random() * 12; // 12-24px (bigger!)
    const height = 16 + Math.random() * 16; // 16-32px (bigger!)
    
    shard.rect(-width/2, -height/2, width, height)
         .fill({ color: color, alpha: 1.0 }); // Full opacity - maximum visibility
    
    // Random position around tile - wider emission
    const angle = Math.random() * Math.PI * 2;
    const distance = baseTile * (0.1 + Math.random() * 0.6); // Wider spawn range (0.1-0.7x tile size)
    
    shard.x = x + Math.cos(angle) * distance;
    shard.y = y + Math.sin(angle) * distance;
    shard.rotation = Math.random() * Math.PI * 2;
    
    board.addChild(shard);
    
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
            shard.destroy();
          }
          // 🔥 MEMORY LEAK FIX: Remove from tracker
          __globalGraphicsObjects.delete(shard);
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
    const shard = new Graphics();
    
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
            shard.destroy();
          } catch {}
        });
      }
    });
  }
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

  const layer = new Container();
  layer.x = x; layer.y = y;
  layer.visible = true; // 🔥 CRITICAL: Ensure layer is visible
  layer.alpha = 1.0; // 🔥 CRITICAL: Ensure layer has full alpha
  const tileZ = tile?.zIndex ?? 0;
  const behind = opts.behind ?? false;
  // 🔥 CRITICAL: Check if this is wild-magnet (red-brown shards) - should use high zIndex
  const isWildMagnetShards = opts.wildMagnet === true;
  // CRITICAL: Only use low zIndex for wild mode (when wildMode is true)
  // For regular merge 6 and wild-magnet, use high zIndex (9993) to ensure shards are visible
  if (wildMode && !isWildMagnetShards) {
    layer.zIndex = tileZ - 0.002; // sit behind smoke/flash for wild mode (but not wild-magnet)
  } else {
    layer.zIndex = behind ? tileZ - 0.001 : 9993; // High zIndex for regular merge 6 and wild-magnet
  }


  const ttl = opts.ttl ?? (wildMode ? 0.9 : 1.6);
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
  const shardCount = wildMode ? Math.max(14, Math.round(shardCountRaw * 0.8)) : shardCountRaw;
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
  } else if (!isWildMagnet && tile?.special === 'wild') {
    // opts.wild not set, fallback to tile.special (but only if not wild-magnet)
    isWildOnly = true;
  }
  
  const yellowColor = 0xFFCB47; // Yellow (#FFCB47) for wild-only
  const redColor = 0xF26034;    // Red (#F26034) for wild-magnet
  const brownColor = 0xD4A584;  // Brown (#D4A584) for regular merge 6

  // Determine base shard color
  let baseShardColor = brownColor; // Default: brown
  if (isWildMagnet) {
    baseShardColor = redColor; // Wild-magnet → red
  } else if (isWildOnly) {
    baseShardColor = yellowColor; // Wild-only → yellow
  }

  const emitShard = (distance, angle, scaleFactor = 1, alpha = 1.0, speedMul = 1, shardIndex = 0) => {
    const shard = new Graphics();
    
    // CRITICAL: Clear graphics before drawing (ensures clean state)
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
    // For wild-only, randomly mix yellow and brown (50/50)
    // For regular, use only brown
    let shardColor = baseShardColor;
    if (isWildMagnet) {
      // Wild-magnet: 50% red, 50% brown
      shardColor = Math.random() < 0.5 ? redColor : brownColor;
    } else if (isWildOnly) {
      // Wild-only: 50% yellow, 50% brown
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
            shard.destroy();
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
    
    board.addChild(puff);
    
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
