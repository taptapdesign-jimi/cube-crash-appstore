// @ts-nocheck
// src/modules/stars-collector.ts
// Manages star currency collection and animations when wild stars merge into merge 6

import { Container, Assets, Texture } from 'pixi.js';
import { detachWildStarHalo } from './wild-stars.js';
import { isArcadeHomeRunMode } from './run-mode.js';

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
let collectorEpoch = 0;

// 🔥 FIX: Helper to track timeouts
function trackTimeout(callback: () => void, delay: number, epoch = collectorEpoch): ReturnType<typeof setTimeout> {
  const timeout = setTimeout(() => {
    activeTimeouts.delete(timeout);
    if (epoch !== collectorEpoch) return;
    callback();
  }, delay);
  activeTimeouts.add(timeout);
  return timeout;
}

function triggerBounceWithCallback(onComplete?: () => void, epoch = collectorEpoch) {
  const guardedComplete = onComplete
    ? () => {
        if (epoch === collectorEpoch) onComplete();
      }
    : undefined;
  if (typeof window !== 'undefined' && window.HUD && typeof window.HUD.bounceScoreIcon === 'function') {
    window.HUD.bounceScoreIcon(guardedComplete);
  } else if (typeof window !== 'undefined' && window.HUD && typeof window.HUD.bounceStarIcon === 'function') {
    // Call bounce function with callback
    window.HUD.bounceStarIcon(guardedComplete);
  } else if (guardedComplete) {
    // If bounce function doesn't exist, call onComplete immediately
    trackTimeout(guardedComplete, 250, epoch);
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
    trackTimeout(() => {
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
    trackTimeout(() => {
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
    trackTimeout(() => {
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
  
  trackTimeout(() => {
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
 * This animates the orbiting stars from the wild tile to the HUD icon
 */
export async function collectStarsFromWildTile(
  wildTile: any,
  merge6Position: { x: number; y: number }
): Promise<void> {
  if (!config || !wildTile) {
    console.warn('⚠️ Cannot collect stars: config or wildTile missing');
    return;
  }

  const orbitingStars = wildTile?._wildStarSystem?.stars;
  if (!Array.isArray(orbitingStars) || orbitingStars.length === 0) {
    console.warn('⚠️ No wild star system found on tile');
    return;
  }

  const hudStarPos = config.getStarHudPosition();
  if (!hudStarPos || !config.stage || config.stage.destroyed) {
    console.warn('⚠️ Cannot collect stars: HUD or stage unavailable');
    return;
  }

  let wildTileScreenPos = { x: Number(wildTile.x) || 0, y: Number(wildTile.y) || 0 };
  try {
    const globalPosition = wildTile.getGlobalPosition();
    wildTileScreenPos = { x: globalPosition.x, y: globalPosition.y };
  } catch {
    wildTileScreenPos = {
      x: (Number(config.board?.x) || 0) + wildTileScreenPos.x,
      y: (Number(config.board?.y) || 0) + wildTileScreenPos.y,
    };
  }

  const savedStarPositions = orbitingStars.slice(0, 3).map((star: any) => ({
    sprite: star?.sprite ?? null,
    texture: star?.sprite?.texture ?? starTexture,
    globalX: wildTileScreenPos.x,
    globalY: wildTileScreenPos.y,
    scale: Number(star?.sprite?.scale?.x) || 1,
  }));

  const { animateStarsToHudIcon } = await import('./fx.ts');
  await animateStarsToHudIcon(
    config.board,
    config.stage,
    savedStarPositions,
    wildTileScreenPos,
    merge6Position,
    hudStarPos,
    config.app,
  );

  // The shared flight runtime clones the visual payload before this cleanup.
  try { detachWildStarHalo(wildTile); } catch {}
}
/**
 * Cleanup stars collector
 * 🔥 FIX: Comprehensive cleanup of all resources
 */
export function cleanupStarsCollector(): void {
  collectorEpoch += 1;
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
