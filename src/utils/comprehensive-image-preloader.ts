/**
 * Comprehensive Image Preloader
 * Preloads ALL images at startup during launch screen, caches them permanently
 * Then preloads journey images on-demand when boards are opened
 * Also loads critical images (HUD icons) into PIXI Assets cache for immediate use
 */

import { logger } from '../core/logger.js';

const CACHE_NAME = 'cube-crash-images-v2';
const CACHE_VERSION_KEY = 'image_cache_version';
const CURRENT_CACHE_VERSION = '2';

// Critical HUD icons that MUST be loaded into PIXI Assets cache
// These are used by hud-helpers.ts via Assets.get() and Assets.load()
const CRITICAL_HUD_ICONS: string[] = [
  './assets/hud/star-hud.png',
  './assets/hud/star-hud@2x.png',
  './assets/hud/star-hud@3x.png',
  './assets/hud/score-hud.png',
  './assets/hud/score-hud@2x.png',
  './assets/hud/score-hud@3x.png',
  './assets/hud/combo-hud.png',
  './assets/hud/combo-hud@2x.png',
  './assets/hud/combo-hud@3x.png',
  './assets/hud/extra-combo-hud.png',
  './assets/hud/extra-combo-hud@2x.png',
  './assets/hud/extra-combo-hud@3x.png',
  './assets/hud/mega-combo-hud.png',
  './assets/hud/mega-combo-hud@2x.png',
  './assets/hud/mega-combo-hud@3x.png',
  './assets/close-icon.png',
  './assets/close-icon@2x.png',
  './assets/close-icon@3x.png',
];

// All images that need to be preloaded at startup
const ALL_STARTUP_IMAGES: string[] = [
  // Homepage slider images (ALL slides - critical)
  './assets/crash-cubes-homepage.png',
  './assets/crash-cubes-homepage@2x.png',
  './assets/crash-cubes-homepage@3x.png',
  './assets/journey-map-homepage.png',
  './assets/journey-map-homepage@2x.png',
  './assets/journey-map-homepage@3x.png',
  './assets/collectibles-box.png',
  './assets/collectibles-box@2x.png',
  './assets/collectibles-box@3x.png',
  './assets/settings-slider.png',
  './assets/settings-slider@2x.png',
  './assets/settings-slider@3x.png',
  
  // Homepage logo and addons
  './assets/logo-cube-crash.png',
  './assets/logo-cube-crash@2x.png',
  './assets/logo-cube-crash@3x.png',
  './assets/logo.png',
  './assets/logo addons/gore ljevo shards.png',
  './assets/logo addons/shards gore desno.png',
  './assets/logo addons/smokeandshards.png',
  './assets/logo addons/smokeandshards@2x.png',
  './assets/logo addons/smokeandshards@3x.png',
  './assets/home-shadow.png',
  './assets/home-shadow@2x.png',
  './assets/home-shadow@3x.png',
  
  // HUD icons (ALL variants - critical for gameplay)
  './assets/hud/star-hud.png',
  './assets/hud/star-hud@2x.png',
  './assets/hud/star-hud@3x.png',
  './assets/hud/score-hud.png',
  './assets/hud/score-hud@2x.png',
  './assets/hud/score-hud@3x.png',
  './assets/hud/combo-hud.png',
  './assets/hud/combo-hud@2x.png',
  './assets/hud/combo-hud@3x.png',
  './assets/hud/extra-combo-hud.png',
  './assets/hud/extra-combo-hud@2x.png',
  './assets/hud/extra-combo-hud@3x.png',
  './assets/hud/mega-combo-hud.png',
  './assets/hud/mega-combo-hud@2x.png',
  './assets/hud/mega-combo-hud@3x.png',
  
  // Stats and bottom sheet icons
  './assets/highscore-icon.png',
  './assets/highscore-icon@2x.png',
  './assets/highscore-icon@3x.png',
  './assets/cubes-cracked.png',
  './assets/cubes-cracked@2x.png',
  './assets/cubes-cracked@3x.png',
  './assets/combo-icon.png',
  './assets/combo-stats.png',
  
  // Bottom sheet and modal assets
  './assets/modals/paper.png',
  './assets/modals/paper@2x.png',
  './assets/modals/paper@3x.png',
  './assets/modals/heart-life.png',
  './assets/modals/heart-life@2x.png',
  './assets/modals/heart-life@3x.png',
  './assets/modals/heart-life-empty.png',
  './assets/modals/heart-life-empty@2x.png',
  './assets/modals/heart-life-empty@3x.png',
  
  // Navigation icons
  './assets/nav/cube-nav.png',
  './assets/nav/stats-nav.png',
  './assets/nav/collectibles-nav.png',
  './assets/nav/settings-nav.png',
  
  // UI icons
  './assets/chevron-back.png',
  './assets/close-button.png',
  './assets/close-icon.png',
  './assets/collectible-stats.png',
  './assets/restart-icon.png',
  './assets/resume-game.png',
  './assets/settings-icon.png',
  './assets/stop.png',
  './assets/time-icon.png',
  './assets/unpause-icon.png',
  
  // Core game assets
  './assets/tile.png',
  './assets/tile_numbers.png',
  './assets/tile_numbers2.png',
  './assets/tile_numbers3.png',
  './assets/tile_numbers4.png',
  './assets/wild.png',
  './assets/wild@2x.png',
  './assets/wild@3x.png',
  './assets/wild-magnet.png',
  './assets/wild-beer.png',
  './assets/wild-beer@2x.png',
  './assets/wild-beer@3x.png',
  './assets/small-star.png',
  './assets/small-star@2x.png',
  './assets/small-star@3x.png',
  './assets/mystery-box.png',
  './assets/gold-coin.png',
  './assets/potion.png',
  './assets/melted-dice.png',
  './assets/star-slider.png',
  './assets/ripple.png',
  './assets/leaf light.png',
  './assets/clean-board.png',
  './assets/wild-stats.png',
  
  // Journey base assets (background, UI elements)
  './assets/journey assets/1-17bg.png',
  './assets/journey assets/orange-ribbon.png',
  './assets/journey assets/orange-ribbon@2x.png',
  './assets/journey assets/orange-ribbon@3x.png',
  './assets/journey assets/heart-nav.png',
  './assets/journey assets/heart-nav@2x.png',
  './assets/journey assets/heart-nav@3x.png',
  './assets/colelctibles/journey-card-empty.png',
  './assets/colelctibles/common back.png',
  './assets/colelctibles/legendary back.png',
  
  // All collectibles card images (common 01-20, legendary 21-26)
  ...Array.from({ length: 20 }, (_, i) => `./assets/colelctibles/common/${String(i + 1).padStart(2, '0')}.png`),
  ...Array.from({ length: 6 }, (_, i) => `./assets/colelctibles/legendary/${String(i + 21).padStart(2, '0')}.png`),
  
  // FX assets (boom animation frames)
  ...Array.from({ length: 16 }, (_, i) => `./assets/fx/boom/boom_${String(i + 1).padStart(4, '0')}.png`),
];

// Journey board images (preloaded on-demand when boards are opened)
const JOURNEY_BOARD_IMAGES: string[] = [
  // Journey cards use collectibles common 01-16
  ...Array.from({ length: 16 }, (_, i) => `./assets/colelctibles/common/${String(i + 1).padStart(2, '0')}.png`),
];

let preloadPromise: Promise<void> | null = null;
let isPreloading = false;

/**
 * Check if cache version is current
 */
async function checkCacheVersion(): Promise<boolean> {
  try {
    const storedVersion = localStorage.getItem(CACHE_VERSION_KEY);
    if (storedVersion === CURRENT_CACHE_VERSION) {
      // Check if cache actually exists
      if (typeof caches !== 'undefined') {
        const cache = await caches.open(CACHE_NAME);
        const keys = await cache.keys();
        // If cache has at least 50 images, consider it valid
        return keys.length >= 50;
      }
    }
    return false;
  } catch (error) {
    logger.warn('⚠️ Error checking cache version:', error);
    return false;
  }
}

/**
 * Load critical HUD icons into PIXI Assets cache
 * This ensures Assets.get() can find them immediately when HUD is initialized
 */
async function loadHudIconsIntoPixiCache(): Promise<void> {
  try {
    // Dynamically import PIXI Assets to avoid circular dependencies
    const { Assets } = await import('pixi.js');
    
    logger.info(`🎮 Loading ${CRITICAL_HUD_ICONS.length} HUD icons into PIXI Assets cache...`);
    
    // Register all HUD icons with PIXI Assets
    for (const iconPath of CRITICAL_HUD_ICONS) {
      try {
        // Check if already loaded
        const existing = Assets.get(iconPath);
        if (existing) {
          continue; // Already in cache
        }
        
        // Register and load into PIXI Assets cache
        try {
          Assets.add({ alias: iconPath, src: iconPath });
        } catch (err) {
          // Already registered, ignore
        }
      } catch (err) {
        logger.warn(`⚠️ Failed to register ${iconPath} with PIXI Assets:`, err);
      }
    }
    
    // Load all HUD icons into PIXI Assets cache in parallel
    await Promise.allSettled(
      CRITICAL_HUD_ICONS.map(async (iconPath) => {
        try {
          // Check if already loaded
          const existing = Assets.get(iconPath);
          if (existing) {
            return; // Already loaded
          }
          
          // Load into PIXI Assets cache
          await Assets.load(iconPath);
          logger.debug(`✅ Loaded ${iconPath} into PIXI Assets cache`);
        } catch (err) {
          logger.warn(`⚠️ Failed to load ${iconPath} into PIXI Assets cache:`, err);
        }
      })
    );
    
    logger.info(`✅ All ${CRITICAL_HUD_ICONS.length} HUD icons loaded into PIXI Assets cache`);
  } catch (error) {
    logger.error('❌ Error loading HUD icons into PIXI Assets cache:', error);
    // Don't throw - this is non-critical, HUD will load icons asynchronously if needed
  }
}

/**
 * Cache a single image using Cache API and decode it
 */
async function cacheAndDecodeImage(url: string): Promise<void> {
  try {
    // 🔥 CRITICAL: Step 1 - Load image into browser cache FIRST (for <img> tags)
    // Browser cache is what <img> tags actually use, not Cache API
    // This ensures images are available immediately even if Cache API fails after hard exit
    const loadIntoBrowserCache = new Promise<void>((resolve) => {
      const img = new Image();
      img.loading = 'eager';
      (img as any).decoding = 'async';
      (img as any).fetchPriority = 'high';
      
      img.onload = () => {
        // Image loaded into browser cache - now available for <img> tags
        logger.debug(`✅ ${url} loaded into browser cache`);
        resolve();
      };
      
      img.onerror = () => {
        logger.warn(`⚠️ Failed to load ${url} into browser cache`);
        resolve(); // Don't block on errors
      };
      
      // Load directly into browser cache - this is what <img> tags use
      // Browser will use HTTP cache if available, otherwise fetch fresh
      img.src = url;
    });
    
    // Step 2: Cache using Cache API (parallel with browser cache, non-blocking)
    const cacheInCacheAPI = (async () => {
      if (typeof caches !== 'undefined') {
        try {
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match(url);
          
          if (!cached) {
            // Not in cache, fetch and cache it
            try {
              const response = await fetch(url, { 
                cache: 'force-cache',
                mode: 'cors'
              });
              if (response.ok) {
                await cache.put(url, response.clone());
                logger.debug(`✅ ${url} cached in Cache API`);
              }
            } catch (fetchError) {
              logger.warn(`⚠️ Failed to cache ${url} in Cache API:`, fetchError);
            }
          } else {
            logger.debug(`✅ ${url} already in Cache API`);
          }
        } catch (cacheError) {
          logger.warn(`⚠️ Cache API error for ${url}:`, cacheError);
        }
      }
    })();
    
    // Wait for browser cache loading (critical for immediate display)
    await loadIntoBrowserCache;
    
    // Cache API loading happens in parallel, don't wait for it (non-blocking)
    cacheInCacheAPI.catch(() => {
      // Ignore Cache API errors - browser cache is enough for <img> tags
    });
  } catch (error) {
    logger.warn(`⚠️ Error caching/decoding ${url}:`, error);
  }
}

/**
 * Preload all startup images during launch screen
 * This runs in background while logos are showing
 */
export async function preloadAllStartupImages(): Promise<void> {
  if (preloadPromise) {
    return preloadPromise;
  }
  
  if (isPreloading) {
    logger.info('📦 Image preloading already in progress');
    return preloadPromise || Promise.resolve();
  }
  
  isPreloading = true;
  
  preloadPromise = (async () => {
    try {
      logger.info(`📦 Starting comprehensive image preloading (${ALL_STARTUP_IMAGES.length} images)...`);
      
      // Check if cache is valid
      const cacheValid = await checkCacheVersion();
      
      if (cacheValid) {
        logger.info('✅ Image cache is valid - loading critical images into browser cache...');
        // 🔥 CRITICAL: Even if Cache API is valid, we MUST load images into browser cache
        // Cache API doesn't guarantee images are in browser cache for <img> tags
        const criticalImages = [
          './assets/crash-cubes-homepage.png',
          './assets/crash-cubes-homepage@2x.png',
          './assets/crash-cubes-homepage@3x.png',
          './assets/journey-map-homepage.png',
          './assets/journey-map-homepage@2x.png',
          './assets/journey-map-homepage@3x.png',
          './assets/hud/star-hud.png',
          './assets/highscore-icon.png',
          './assets/journey assets/1-17bg.png',
        ];
        
        // Load critical images FIRST (priority)
        await Promise.allSettled(
          criticalImages.map(url => cacheAndDecodeImage(url))
        );
        
        logger.info('✅ Critical images loaded into browser cache');
        
        // 🔥 CRITICAL: Load HUD icons into PIXI Assets cache even if Cache API is valid
        // PIXI Assets cache is separate and must be populated for Assets.get() to work
        await loadHudIconsIntoPixiCache();
        
        // Continue loading remaining images in background (non-blocking)
        const remainingImages = ALL_STARTUP_IMAGES.filter(url => !criticalImages.includes(url));
        if (remainingImages.length > 0) {
          logger.info(`📦 Loading ${remainingImages.length} remaining images in background...`);
          Promise.allSettled(
            remainingImages.map(url => cacheAndDecodeImage(url))
          ).then(() => {
            logger.info(`✅ All ${remainingImages.length} remaining images loaded`);
          }).catch((error) => {
            logger.warn('⚠️ Error loading remaining images:', error);
          });
        }
        
        isPreloading = false;
        return;
      }
      
      // Cache is invalid or doesn't exist - preload everything
      logger.info('📦 Cache invalid or missing - preloading all images...');
      
      // Preload in batches to avoid overwhelming the browser
      const BATCH_SIZE = 10;
      let loadedCount = 0;
      
      for (let i = 0; i < ALL_STARTUP_IMAGES.length; i += BATCH_SIZE) {
        const batch = ALL_STARTUP_IMAGES.slice(i, i + BATCH_SIZE);
        
        await Promise.allSettled(
          batch.map(url => {
            return cacheAndDecodeImage(url).then(() => {
              loadedCount++;
              if (loadedCount % 20 === 0) {
                logger.info(`📦 Preloaded ${loadedCount}/${ALL_STARTUP_IMAGES.length} images...`);
              }
            });
          })
        );
        
        // Small delay between batches to prevent browser overload
        if (i + BATCH_SIZE < ALL_STARTUP_IMAGES.length) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
      
      // Mark cache as valid
      localStorage.setItem(CACHE_VERSION_KEY, CURRENT_CACHE_VERSION);
      
      logger.info(`✅ All ${ALL_STARTUP_IMAGES.length} startup images preloaded and cached`);
      
      // 🔥 CRITICAL: Load HUD icons into PIXI Assets cache after Cache API preloading
      // This ensures Assets.get() can find them immediately when HUD is initialized
      await loadHudIconsIntoPixiCache();
      
      isPreloading = false;
    } catch (error) {
      logger.error('❌ Error during image preloading:', error);
      isPreloading = false;
      throw error;
    }
  })();
  
  return preloadPromise;
}

/**
 * Preload journey board images on-demand when a board is opened
 * This ensures journey images are ready when needed
 */
export async function preloadJourneyBoardImages(boardIds: number[]): Promise<void> {
  try {
    const imagesToPreload: string[] = [];
    
    // Add collectibles card images for opened boards
    boardIds.forEach(boardId => {
      if (boardId >= 1 && boardId <= 16) {
        const id = String(boardId).padStart(2, '0');
        imagesToPreload.push(`./assets/colelctibles/common/${id}.png`);
      }
    });
    
    if (imagesToPreload.length === 0) {
      return;
    }
    
    logger.info(`🗺️ Preloading ${imagesToPreload.length} journey board images...`);
    
    // Preload in parallel
    await Promise.allSettled(
      imagesToPreload.map(url => cacheAndDecodeImage(url))
    );
    
    logger.info(`✅ Journey board images preloaded`);
  } catch (error) {
    logger.warn('⚠️ Error preloading journey board images:', error);
  }
}

/**
 * Clear image cache (useful for debugging or cache invalidation)
 */
export async function clearImageCache(): Promise<void> {
  try {
    if (typeof caches !== 'undefined') {
      const deleted = await caches.delete(CACHE_NAME);
      if (deleted) {
        logger.info('✅ Image cache cleared');
      }
    }
    localStorage.removeItem(CACHE_VERSION_KEY);
    logger.info('✅ Cache version cleared');
  } catch (error) {
    logger.warn('⚠️ Error clearing image cache:', error);
  }
}

