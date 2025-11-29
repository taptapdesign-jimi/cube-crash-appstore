// src/modules/stars-collector.ts
// Manages star currency collection and animations when wild stars merge into merge 6

import { Container, Sprite, Graphics, Assets, Texture } from 'pixi.js';
import { gsap } from 'gsap';
import { detachWildStarHalo } from './wild-stars.js';

interface StarCollectionConfig {
  app: any;
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
export function addStars(count: number): void {
  starsCount += count;
  console.log('⭐ Stars added:', count, 'Total:', starsCount);
  
  if (config?.onStarsUpdated) {
    config.onStarsUpdated(starsCount);
  }
}

/**
 * Set stars count directly
 */
export function setStarsCount(count: number): void {
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
  
  // Create container for animated stars (on board layer, above everything)
  const animationContainer = new Container();
  animationContainer.name = 'stars-collection-animation';
  animationContainer.zIndex = 10000; // Above everything
  animationContainer.eventMode = 'none';
  board.addChild(animationContainer);
  
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
    
    // Calculate start position (wild tile position + star orbit offset)
    const startX = wildTileScreenX + starOffsetX;
    const startY = wildTileScreenY + starOffsetY;
    
    // Create animated star sprite (clone of orbiting star)
    const animatedStar = createAnimatedStarSprite(star.sprite);
    if (!animatedStar) continue;
    
    animatedStar.x = startX;
    animatedStar.y = startY;
    animationContainer.addChild(animatedStar);
    
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
    const tl = gsap.timeline({
      delay,
      onComplete: () => {
        // Fade out and remove star
        gsap.to(star, {
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
 */
export function cleanupStarsCollector(): void {
  config = null;
  console.log('⭐ Stars collector cleaned up');
}

