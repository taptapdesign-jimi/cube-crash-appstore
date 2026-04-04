// @ts-nocheck
// src/modules/stars-collector.ts
// Manages star currency collection and animations when wild stars merge into merge 6

import { Container, Sprite, Graphics, Assets, Texture } from 'pixi.js';
import { gsap } from 'gsap';
import animationManager from './animation-manager.js';
import { detachWildStarHalo } from './wild-stars.js';
import { isArcadeHomeRunMode } from './run-mode.js';

const trackTimeline = (options: any = {}) => animationManager.trackExternalTimeline(gsap.timeline(options));

const trackTween = (target: any, vars: any) => animationManager.trackExternalTween(gsap.to(target, vars));

interface StarCollectionConfig {
  app: any;
  stage: Container; // 🔥 CRITICAL: Need stage for screen coordinates
  board: Container;
  hud: Container;
  getStarHudPosition: () => { x: number; y: number };
  onStarsUpdated?: (count: number) => void;
}

let starsCount = 0;
let config: StarCollectionConfig | null = null;
let starTexture: Texture | null = null;

// Star texture sources
const STAR_TEXTURE_SOURCES = [
  './assets/small-star@3x.png',
  './assets/small-star@2x.png',
  './assets/small-star.png',
];

/**
 * Initialize stars collector module
 */
export function initStarsCollector(cfg: StarCollectionConfig): void {
  config = cfg;
  starsCount = 0;
  
  // Preload star texture
  loadStarTexture();
  
  console.log('⭐ Stars collector initialized');
}

/**
 * Load star texture for animation
 */
function loadStarTexture(): void {
  if (starTexture) return;
  
  for (const source of STAR_TEXTURE_SOURCES) {
    try {
      const texture = Assets.get(source);
      if (texture && texture instanceof Texture) {
        starTexture = texture;
        console.log('✅ Star texture loaded:', source);
        return;
      }
    } catch {}
  }
  
  // Fallback: try loading asynchronously
  Assets.load(STAR_TEXTURE_SOURCES[0])
    .then((tex) => {
      if (tex) {
        starTexture = tex;
        console.log('✅ Star texture loaded asynchronously');
      }
    })
    .catch((err) => {
      console.warn('⚠️ Failed to load star texture:', err);
    });
}

/**
 * Get current stars count
 */
export function getStarsCount(): number {
  return starsCount;
}

/**
 * Add stars (called when wild star merges into merge 6)
 */
// Queue system for bounce animations with faster timing for 2nd and 3rd bounce
// Bounce animation duration: 0.08s (scale up) + 0.15s (scale down) = 0.23s total
let bounceQueue: number = 0;
let bounceCounter = 0; // Track which bounce number we're on

// 🔥 FIX: Track active timeouts for cleanup
const activeTimeouts: Set<ReturnType<typeof setTimeout>> = new Set();

// 🔥 FIX: Helper to track timeouts
function trackTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout> {
  const timeout = setTimeout(() => {
    activeTimeouts.delete(timeout);
    callback();
  }, delay);
  activeTimeouts.add(timeout);
  return timeout;
}

function triggerBounceWithCallback(onComplete?: () => void) {
  if (typeof window !== 'undefined' && window.HUD && typeof window.HUD.bounceStarIcon === 'function') {
    // Call bounce function with callback
    window.HUD.bounceStarIcon(onComplete);
  } else if (onComplete) {
    // If bounce function doesn't exist, call onComplete immediately
    trackTimeout(() => onComplete(), 250);
  }
}

function processBounceQueue() {
  // 🔥 USER REQUEST: Faster bounce animations
  // Bounce animation duration: 0.23s total (0.08s scale up + 0.15s scale down)
  // Current behavior: Each bounce waits for previous to finish (0.23s between each)
  // Requested behavior:
  // - 2nd bounce should start 50% earlier = after 0.115s instead of 0.23s (50% faster)
  // - 3rd bounce should start 100% earlier = after 0s instead of 0.46s (immediately, like 1st)
  
  if (bounceQueue <= 0) {
    console.log('✅ Bounce queue empty');
    bounceCounter = 0; // Reset counter when queue is empty
    return;
  }
  
  const bounceDuration = 0.23; // Total bounce animation duration
  
  // If this is the first time, schedule all 3 bounces with their respective delays
  if (bounceCounter === 0 && bounceQueue >= 3) {
    // Schedule all 3 bounces at once with their delays
    console.log('⭐ Scheduling 3 bounces with faster timing');
    
    // Bounce 1: starts immediately (0ms)
    setTimeout(() => {
      bounceCounter++;
      console.log('⭐ Triggering HUD bounce 1 (immediate)');
      triggerBounceWithCallback(() => {
        console.log('✅ Bounce 1 completed');
        bounceCounter--;
        if (bounceCounter === 0 && bounceQueue === 0) {
          console.log('✅ All bounces completed');
        }
      });
    }, 0);
    
    // Bounce 2: starts 50% earlier = after 0.115s (instead of 0.23s)
    setTimeout(() => {
      bounceCounter++;
      console.log('⭐ Triggering HUD bounce 2 (50% earlier: 115ms delay)');
      triggerBounceWithCallback(() => {
        console.log('✅ Bounce 2 completed');
        bounceCounter--;
        if (bounceCounter === 0 && bounceQueue === 0) {
          console.log('✅ All bounces completed');
        }
      });
    }, bounceDuration * 0.5 * 1000); // 0.115s = 115ms
    
    // Bounce 3: starts 100% earlier = immediately after bounce 2 starts (115ms, same as bounce 2)
    // Instead of waiting for bounce 2 to finish (345ms total), start immediately after bounce 2 starts
    setTimeout(() => {
      bounceCounter++;
      console.log('⭐ Triggering HUD bounce 3 (100% earlier: same time as bounce 2, 115ms)');
      triggerBounceWithCallback(() => {
        console.log('✅ Bounce 3 completed');
        bounceCounter--;
        if (bounceCounter === 0 && bounceQueue === 0) {
          console.log('✅ All bounces completed');
        }
      });
    }, bounceDuration * 0.5 * 1000); // Same delay as bounce 2 (115ms), not 0ms
    
    // Remove 3 bounces from queue
    bounceQueue -= 3;
    bounceCounter += 3; // Track that we scheduled 3 bounces
    
    console.log('✅ Scheduled 3 bounces: bounce 1 at 0ms, bounce 2 & 3 at 115ms');
    return;
  }
  
  // Fallback: if less than 3 bounces or not first time, use normal sequential processing
  bounceCounter++;
  const currentBounceNum = bounceCounter;
  bounceQueue--;
  
  console.log('⭐ Processing bounce', currentBounceNum, '(queue remaining:', bounceQueue, ')');
  
  let delay = 0;
  if (currentBounceNum === 2) {
    delay = bounceDuration * 0.5; // 50% earlier (0.115s)
  } else if (currentBounceNum === 3) {
    delay = 0; // 100% earlier (immediate)
  }
  
  setTimeout(() => {
    console.log('⭐ Triggering HUD bounce', currentBounceNum, 'with delay', (delay * 1000).toFixed(0), 'ms');
    triggerBounceWithCallback(() => {
      console.log('✅ Bounce', currentBounceNum, 'completed');
      if (bounceQueue > 0) {
        processBounceQueue();
      } else {
        bounceCounter = 0;
      }
    });
  }, delay * 1000);
  
  if (bounceQueue > 0 && currentBounceNum < 3) {
    processBounceQueue();
  }
}

export function addStars(count: number): void {
  if (isArcadeHomeRunMode()) {
    return;
  }
  const oldCount = starsCount;
  starsCount += count;
  console.log('⭐ Stars added:', count, 'Total:', starsCount, 'Old count:', oldCount);
  
  if (config?.onStarsUpdated) {
    config.onStarsUpdated(starsCount);
  }
  
  // 🔥 CRITICAL: Trigger HUD bounce animation via queue system (sequential, no overlap)
  // Queue ensures each bounce completes before next one starts
  // This ensures smooth, sequential bounces without delay
  if (starsCount > oldCount) {
    const starsAdded = starsCount - oldCount;
    console.log('⭐ Adding', starsAdded, 'bounces to queue (current queue:', bounceQueue, ')');
    
    // Add each bounce to queue (one bounce per star added)
    bounceQueue += starsAdded;
    
    // Start processing queue immediately (no delay)
    processBounceQueue();
  }
}

/**
 * Set stars count directly
 */
export function setStarsCount(count: number): void {
  if (isArcadeHomeRunMode()) {
    starsCount = 0;
    return;
  }
  starsCount = Math.max(0, count);
  console.log('⭐ Stars count set to:', starsCount);
  
  if (config?.onStarsUpdated) {
    config.onStarsUpdated(starsCount);
  }
}

/**
 * Collect stars from wild tile after merge 6
 * This animates the 3 orbiting stars from the wild tile to the HUD icon
 */
export async function collectStarsFromWildTile(
  wildTile: any,
  merge6Position: { x: number; y: number }
): Promise<void> {
  if (isArcadeHomeRunMode()) {
    try { detachWildStarHalo(wildTile); } catch {}
    return;
  }
  if (!config || !wildTile) {
    console.warn('⚠️ Cannot collect stars: config or wildTile missing');
    return;
  }
  
  // Get the wild star system (3 orbiting stars)
  const wildStarSystem = (wildTile as any)?._wildStarSystem;
  if (!wildStarSystem || !wildStarSystem.stars || wildStarSystem.stars.length === 0) {
    console.warn('⚠️ No wild star system found on tile');
    return;
  }
  
  const orbitingStars = wildStarSystem.stars;
  console.log('⭐ Collecting', orbitingStars.length, 'stars from wild tile');
  
  // Get HUD star icon position
  const hudStarPos = config.getStarHudPosition();
  if (!hudStarPos) {
    console.warn('⚠️ Cannot get HUD star position');
    return;
  }
  
  // Get board-to-screen transform
  const board = config.board;
  const hud = config.hud;
  
  // Get wild tile position in screen coordinates (wild tile is where stars orbit)
  // Wild tile position might already be in screen coords, but we need to ensure it's correct
  const wildTileX = wildTile.x;
  const wildTileY = wildTile.y;
  
  // If wild tile is a child of board, get its global position
  let wildTileScreenX = wildTileX;
  let wildTileScreenY = wildTileY;
  
  try {
    // Get global position of wild tile
    const wildTileGlobalPos = wildTile.getGlobalPosition();
    wildTileScreenX = wildTileGlobalPos.x;
    wildTileScreenY = wildTileGlobalPos.y;
  } catch {
    // Fallback: use local position + board position
    if (board) {
      wildTileScreenX = board.x + wildTileX;
      wildTileScreenY = board.y + wildTileY;
    }
  }
  
  // Convert HUD position to screen coordinates (HUD is already in screen space)
  const hudScreenX = hudStarPos.x;
  const hudScreenY = hudStarPos.y;
  
  console.log('⭐ Star collection positions:', {
    wildTile: { x: wildTileScreenX, y: wildTileScreenY },
    merge6: { x: merge6Position.x, y: merge6Position.y },
    hud: { x: hudScreenX, y: hudScreenY }
  });
  
  // 🔥 CRITICAL FIX: Create container on stage (screen coordinates), not board (local coordinates)
  // This ensures screen coordinate positions work correctly
  const animationContainer = new Container();
  animationContainer.label = 'stars-collection-animation';
  animationContainer.zIndex = 10000; // Above everything (above HUD which is 10000)
  animationContainer.eventMode = 'none';
  animationContainer.x = 0; // Stage uses screen coordinates (0,0 is top-left)
  animationContainer.y = 0;
  
  // Add to stage (screen coordinates) instead of board (local coordinates)
  const stage = config.stage;
  if (!stage) {
    console.error('❌ Cannot create animation: stage not available in config');
    return;
  }
  stage.addChild(animationContainer);
  
  // Animate each star sequentially (one after another)
  const STAR_COUNT = Math.min(3, orbitingStars.length);
  const animations: Promise<void>[] = [];
  
  for (let i = 0; i < STAR_COUNT; i++) {
    const star = orbitingStars[i];
    if (!star || !star.sprite) continue;
    
    // Get star's current position relative to wild tile (from orbit system)
    // Stars orbit around wild tile, so get their actual sprite position
    const starContainer = (wildTile as any)?._wildStarSystem?.container;
    let starOffsetX = 0;
    let starOffsetY = 0;
    
    if (starContainer && star.sprite) {
      // Get star's position relative to container (already calculated in orbit system)
      starOffsetX = star.sprite.x || 0;
      starOffsetY = star.sprite.y || 0;
      
      // If star is in a container, need to get its global position
      try {
        const starGlobalPos = star.sprite.getGlobalPosition();
        // Calculate offset from wild tile
        starOffsetX = starGlobalPos.x - wildTileScreenX;
        starOffsetY = starGlobalPos.y - wildTileScreenY;
      } catch {
        // Fallback: use local position (stars are relative to wild tile container)
        // starOffsetX and starOffsetY are already relative to container
      }
    }
    
    // Calculate start position (wild tile position + star orbit offset) - screen coordinates
    const startX = wildTileScreenX + starOffsetX;
    const startY = wildTileScreenY + starOffsetY;
    
    // Create animated star sprite (clone of orbiting star)
    const animatedStar = createAnimatedStarSprite(star.sprite);
    if (!animatedStar) continue;
    
    // Set position directly in screen coordinates (animationContainer is on stage)
    animatedStar.x = startX;
    animatedStar.y = startY;
    animationContainer.addChild(animatedStar);
    
    console.log(`⭐ Star ${i + 1} start position:`, { x: startX, y: startY, hudX: hudScreenX, hudY: hudScreenY });
    
    // Create wavy path to HUD
    const delay = i * 0.15; // Sequential delay (0ms, 150ms, 300ms)
    const animationPromise = animateStarToHUD(
      animatedStar,
      { x: startX, y: startY },
      { x: hudScreenX, y: hudScreenY },
      delay,
      i // Star index for sequential bounce
    );
    
    animations.push(animationPromise);
  }
  
  // Wait for all animations to complete
  await Promise.all(animations);
  
  // Clean up animation container
  try {
    if (animationContainer.parent) {
      animationContainer.parent.removeChild(animationContainer);
    }
    animationContainer.destroy({ children: true });
  } catch {}
  
  // Detach wild star halo from tile (cleanup orbiting stars)
  try {
    detachWildStarHalo(wildTile);
  } catch {}
  
  // Stars are already added individually as they arrive (in onComplete callback)
  // No need to add again here
  
  console.log('✅ Stars collection completed');
}

/**
 * Create animated star sprite from orbiting star
 */
function createAnimatedStarSprite(originalStar: Sprite | Graphics): Sprite | Graphics | null {
  if (originalStar instanceof Sprite) {
    // Clone sprite
    const sprite = new Sprite(originalStar.texture);
    sprite.anchor.set(0.5);
    sprite.scale.set(originalStar.scale.x, originalStar.scale.y);
    sprite.alpha = originalStar.alpha;
    sprite.tint = originalStar.tint;
    sprite.blendMode = originalStar.blendMode;
    return sprite;
  } else if (originalStar instanceof Graphics) {
    // Clone graphics (fallback star)
    const graphics = originalStar.clone();
    return graphics;
  }
  
  // Fallback: create star from texture
  if (starTexture) {
    const sprite = new Sprite(starTexture);
    sprite.anchor.set(0.5);
    sprite.scale.set(0.3);
    return sprite;
  }
  
  // Ultimate fallback: create simple graphics star
  const graphics = new Graphics();
  graphics.star(0, 0, 5, 20, 10).fill({ color: 0xFFE7B5, alpha: 1.0 });
  return graphics;
}

/**
 * Animate star from start position to HUD position with wavy path
 */
function animateStarToHUD(
  star: Sprite | Graphics,
  start: { x: number; y: number },
  end: { x: number; y: number },
  delay: number,
  starIndex: number
): Promise<void> {
  return new Promise((resolve) => {
    // Calculate distance
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.hypot(dx, dy);
    
    // Create wavy path with random curves
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    
    // Random perpendicular offset for wavy path
    const perpAngle = Math.atan2(dy, dx) + Math.PI / 2;
    const waveAmplitude = 60 + Math.random() * 80; // 60-140px wave
    const controlPoint1X = midX + Math.cos(perpAngle) * waveAmplitude * (Math.random() < 0.5 ? 1 : -1);
    const controlPoint1Y = midY + Math.sin(perpAngle) * waveAmplitude * (Math.random() < 0.5 ? 1 : -1);
    
    // Add second control point for more complex curve
    const controlPoint2X = midX + Math.cos(perpAngle + Math.PI / 4) * (waveAmplitude * 0.7) * (Math.random() < 0.5 ? 1 : -1);
    const controlPoint2Y = midY + Math.sin(perpAngle + Math.PI / 4) * (waveAmplitude * 0.7) * (Math.random() < 0.5 ? 1 : -1);
    
    // Animation duration based on distance (faster = shorter distance)
    const baseDuration = 0.8;
    const distanceFactor = Math.min(1.2, Math.max(0.6, distance / 800));
    const duration = baseDuration * distanceFactor;
    
    // Create timeline for wavy path animation
    const tl = trackTimeline({
      delay,
      onComplete: () => {
        // Fade out and remove star
        trackTween(star, {
          alpha: 0,
          scale: 0.5,
          duration: 0.2,
          ease: 'power2.in',
          onComplete: () => {
            try {
              if (star.parent) {
                star.parent.removeChild(star);
              }
              star.destroy?.();
            } catch {}
            resolve();
          }
        });
      }
    });
    
    // Animate along wavy bezier path
    const path = {
      x: start.x,
      y: start.y
    };
    
    tl.to(path, {
      x: controlPoint1X,
      y: controlPoint1Y,
      duration: duration * 0.4,
      ease: 'power2.out',
      onUpdate: () => {
        star.x = path.x;
        star.y = path.y;
      }
    });
    
    tl.to(path, {
      x: controlPoint2X,
      y: controlPoint2Y,
      duration: duration * 0.3,
      ease: 'power2.inOut',
      onUpdate: () => {
        star.x = path.x;
        star.y = path.y;
      }
    });
    
    tl.to(path, {
      x: end.x,
      y: end.y,
      duration: duration * 0.3,
      ease: 'power2.in',
      onUpdate: () => {
        star.x = path.x;
        star.y = path.y;
      },
      onComplete: () => {
        // 🔥 USER REQUEST: Bounce animation when star enters HUD icon (like stack merge)
        // Trigger bounce for each star as it arrives
        triggerStarHudBounce();
        
        // Also increment stars count for this star (sequential)
        addStars(1);
      }
    });
    
    // Rotate and scale during animation
    tl.to(star, {
      rotation: Math.PI * 2 * (Math.random() < 0.5 ? 1 : -1),
      duration: duration,
      ease: 'none'
    }, 0);
    
    // Scale animation (pulse effect)
    const originalScale = star.scale.x;
    tl.to(star.scale, {
      x: originalScale * 1.3,
      y: originalScale * 1.3,
      duration: duration * 0.5,
      ease: 'power2.out'
    }, 0);
    
    tl.to(star.scale, {
      x: originalScale * 0.8,
      y: originalScale * 0.8,
      duration: duration * 0.5,
      ease: 'power2.in'
    }, duration * 0.5);
  });
}

/**
 * Trigger bounce animation on HUD star icon (like stack merge bounce)
 */
function triggerStarHudBounce(): void {
  if (!config) return;
  
  // Try window.HUD first (faster, already loaded)
  if (typeof window !== 'undefined' && (window as any).HUD) {
    const HUD = (window as any).HUD;
    if (typeof HUD.bounceStarIcon === 'function') {
      HUD.bounceStarIcon();
      console.log('⭐ Star HUD bounce animation triggered');
      return;
    }
  }
  
  // Fallback: Import HUD module dynamically
  import('./hud-helpers.js').then((HUD) => {
    if (typeof HUD.bounceStarIcon === 'function') {
      HUD.bounceStarIcon();
      console.log('⭐ Star HUD bounce animation triggered (via import)');
    } else {
      console.warn('⚠️ HUD.bounceStarIcon not available');
    }
  }).catch((error) => {
    console.warn('⚠️ Failed to import HUD module for bounce:', error);
  });
}

/**
 * Cleanup stars collector
 * 🔥 FIX: Comprehensive cleanup of all resources
 */
export function cleanupStarsCollector(): void {
  // Clear all tracked timeouts
  activeTimeouts.forEach(timeout => {
    clearTimeout(timeout);
  });
  activeTimeouts.clear();
  
  // Reset queue state
  bounceQueue = 0;
  bounceCounter = 0;
  
  // Clear config
  config = null;
  
  console.log('⭐ Stars collector cleaned up (timeouts cleared, queue reset)');
}
