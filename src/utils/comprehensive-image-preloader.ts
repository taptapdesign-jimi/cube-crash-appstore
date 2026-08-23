/**
 * Comprehensive Image Preloader
 * Preloads ALL images at startup during launch screen, caches them permanently
 * Then preloads journey images on-demand when boards are opened
 * Also loads critical images (HUD icons) into PIXI Assets cache for immediate use
 */

import { logger } from '../core/logger.js';
import { isAssetAliasRegistered, markAssetAliasRegistered } from './asset-registry.js';
import { MOBILE_RUNTIME_PROFILE } from '../modules/mobile-runtime-profile.js';

const CACHE_NAME = 'cube-crash-images-v2';
const CACHE_VERSION_KEY = 'image_cache_version';
const CURRENT_CACHE_VERSION = '4';

/** Normalize to absolute URL so Cache API keys match fetch/store. */
function toAbsoluteUrl(url: string): string {
  if (typeof location === 'undefined') return url;
  try {
    return new URL(url, location.href).href;
  } catch {
    return url;
  }
}

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
  './assets/close-icon.png'
];

const MOBILE_HUD_ICONS: string[] = [
  './assets/hud/star-hud.png',
  './assets/hud/score-hud.png',
  './assets/hud/combo-hud.png',
  './assets/hud/extra-combo-hud.png',
  './assets/hud/mega-combo-hud.png',
  './assets/close-icon.png',
];

const mobileImageLoads = new Map<string, Promise<void>>();

function withCurrentDpr(path: string): string {
  if (typeof window === 'undefined' || window.devicePixelRatio < 1.5) return path;
  return path.replace(/\.png$/i, '@2x.png');
}

function loadMobileImageOnce(url: string): Promise<void> {
  const existing = mobileImageLoads.get(url);
  if (existing) return existing;
  const load = new Promise<void>((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = url;
    if (image.complete && image.naturalWidth > 0) resolve();
  }).then(() => undefined);
  mobileImageLoads.set(url, load);
  return load;
}

async function loadMobileLaunchRouteAssets(): Promise<void> {
  const routeAssets = [
    withCurrentDpr('./assets/crash-cubes-homepage.png'),
    withCurrentDpr('./assets/journey-map-homepage.png'),
    withCurrentDpr('./assets/collectibles-box.png'),
    withCurrentDpr('./assets/settings-slider.png'),
    withCurrentDpr('./assets/logo-cube-crash.png'),
    './assets/logo addons/gore ljevo shards.png',
    './assets/logo addons/shards gore desno.png',
    './assets/logo addons/dole ljevi shards.png',
    './assets/logo addons/dole desni.png',
    './assets/nav/cube-nav.png',
    './assets/nav/stats-nav.png',
    './assets/nav/collectibles-nav.png',
    './assets/nav/settings-nav.png',
    './assets/paper-bg.png',
  ];
  const pending = [...new Set(routeAssets)];
  const workers = Array.from({ length: Math.min(2, pending.length) }, async () => {
    while (pending.length > 0) {
      const asset = pending.shift();
      if (asset) await loadMobileImageOnce(asset);
    }
  });
  await Promise.all(workers);
}

// All images that need to be preloaded at startup
const ALL_STARTUP_IMAGES: string[] = [
  // Homepage slider images (ALL slides - critical)
  './assets/crash-cubes-homepage.png',
  './assets/crash-cubes-homepage@2x.png',
  './assets/crash-cubes-homepage@3x.png',
  './assets/paper-bg.png',
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
  './assets/logo addons/gore ljevo shards.png',
  './assets/logo addons/shards gore desno.png',
  './assets/logo addons/dole ljevi shards.png',
  './assets/logo addons/dole desni.png',
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
  './assets/modals/star.png',
  './assets/modals/star@2x.png',
  './assets/modals/star-empty.png',
  './assets/modals/star-empty@2x.png',
  './assets/modals/star-empty@3x.png',
  
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
  './assets/hand-pointer.png',
  './assets/hand-pointer@2x.png',
  './assets/hand-pointer@3x.png',
  
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
  './assets/wild-juice.png',
  './assets/wild-juice@2x.png',
  './assets/wild-juice@3x.png',
  './assets/shop/explosion pack/tnt.png',
  './assets/shop/explosion pack/tnt@2x.png',
  './assets/shop/explosion pack/tnt@3x.png',
  './assets/shop/explosion pack/animation/tnt1.png',
  './assets/shop/explosion pack/animation/tnt2.png',
  './assets/shop/explosion pack/animation/tnt3.png',
  './assets/shop/explosion pack/animation/tnt4.png',
  './assets/shop/explosion pack/animation/tnt5.png',
  './assets/shop/explosion pack/animation/tnt6.png',
  './assets/shop/explosion pack/animation/tnt7.png',
  './assets/shop/explosion pack/animation/tnt8.png',
  './assets/shop/explosion pack/animation/tnt9.png',
  './assets/shop/explosion pack/animation/tnt10.png',
  './assets/shop/explosion pack/animation/tnt11.png',
  './assets/shop/explosion pack/animation/tnt12.png',
  './assets/shop/explosion pack/animation/tnt1@2x.png',
  './assets/shop/explosion pack/animation/tnt2@2x.png',
  './assets/shop/explosion pack/animation/tnt3@2x.png',
  './assets/shop/explosion pack/animation/tnt4@2x.png',
  './assets/shop/explosion pack/animation/tnt5@2x.png',
  './assets/shop/explosion pack/animation/tnt6@2x.png',
  './assets/shop/explosion pack/animation/tnt7@2x.png',
  './assets/shop/explosion pack/animation/tnt8@2x.png',
  './assets/shop/explosion pack/animation/tnt9@2x.png',
  './assets/shop/explosion pack/animation/tnt10@2x.png',
  './assets/shop/explosion pack/animation/tnt11@2x.png',
  './assets/shop/explosion pack/animation/tnt12@2x.png',
  './assets/shop/bush/flower.png',
  './assets/shop/bush/flower@2x.png',
  ...Array.from({ length: 10 }, (_, index) => `./assets/shop/bush/bush${index + 1}.png`),
  ...Array.from({ length: 10 }, (_, index) => `./assets/shop/bush/bush${index + 1}@2x.png`),
  ...Array.from({ length: 6 }, (_, index) => `./assets/shop/bush/flowr${index + 1}.png`),
  ...Array.from({ length: 6 }, (_, index) => `./assets/shop/bush/flowr${index + 1}@2x.png`),
  './assets/shop/honey/honey.png',
  './assets/shop/honey/honey@2x.png',
  ...Array.from({ length: 7 }, (_, index) => `./assets/shop/honey/bee${index + 1}.png`),
  ...Array.from({ length: 7 }, (_, index) => `./assets/shop/honey/bee${index + 1}@2x.png`),
  './assets/shop/mushroom/mushroom.png',
  './assets/shop/mushroom/mushroom@2x.png',
  ...Array.from({ length: 5 }, (_, index) => `./assets/shop/mushroom/mushroom${index + 1}.png`),
  ...Array.from({ length: 6 }, (_, index) => `./assets/shop/mushroom/part${index + 1}@2x.png`),
  './assets/journey assets/natpis.png',
  './assets/journey assets/natpis@2x.png',
  './assets/shop/cubero/cubero.png',
  './assets/shop/cubero/cubero@2x.png',
  './assets/shop/cubero/krpa1.png',
  './assets/shop/cubero/krpa2.png',
  './assets/shop/cubero/krpa3.png',
  './assets/shop/cubero/krpa4.png',
  './assets/shop/cubero/krpa5.png',
  './assets/shop/cubero/krpa6.png',
  './assets/shop/cubero/krpa7.png',
  './assets/shop/bottle/glass bottle.png',
  './assets/shop/bottle/glass bottle@2x.png',
  ...['botle1', 'botle2', 'botle3'].flatMap((name) => [
    `./assets/shop/bottle/bottle animation pack/${name}.png`,
    `./assets/shop/bottle/bottle animation pack/${name}@2x.png`,
  ]),
  ...Array.from({ length: 6 }, (_, index) => `./assets/shop/bottle/bottle animation pack/bubble${index + 1}.png`),
  ...Array.from({ length: 6 }, (_, index) => `./assets/shop/bottle/bottle animation pack/bubble${index + 1}@2x.png`),
  './assets/small-star.png',
  './assets/small-star@2x.png',
  './assets/small-star@3x.png',
  './assets/melted-dice.png',
  './assets/clean-board.png',
  
  // Journey base assets (background, UI elements)
  './assets/journey assets/1-17bg.png',
  './assets/journey assets/orange-ribbon.png',
  './assets/journey assets/orange-ribbon@2x.png',
  './assets/journey assets/orange-ribbon@3x.png',
  './assets/colelctibles/journey-card-empty.png',
  './assets/colelctibles/common back.png',
  './assets/colelctibles/legendary back.png',
  
  // Collectible card fronts are intentionally excluded from startup preload.
  // They are large PNGs and are loaded on demand by visible grid cards/modals.
  
  // fx/boom folder does not exist; removed to avoid failed fetches and warnings
  
  // 🔥 IMAGE POOLING: Board transition cloud images (preload for instant display)
  './assets/board transition/oblak+srednji.png',
  './assets/board transition/oblak mali desno.png',
  './assets/board transition/oblak mali ljevo.png',
  './assets/board transition/oblak veliki ljevo dole.png',
  // Board transition bottom scene layers
  './assets/journey assets/forest/mountain.png',
  './assets/journey assets/forest/mountain@2x.png',
  './assets/journey assets/forest/hill2.png',
  './assets/journey assets/forest/hill2@2x.png',
  './assets/journey assets/forest/hill1.png',
  './assets/journey assets/forest/hill1@2x.png',
  './assets/journey assets/pine1.png',
  './assets/journey assets/pine2.png',
  './assets/journey assets/pine3.png',
  './assets/journey assets/pine4.png',
  './assets/journey assets/pine5.png',
  './assets/journey assets/fence.left.png',
  './assets/journey assets/fence.right.png',
];

// Journey board images (preloaded on-demand when boards are opened)
const JOURNEY_BOARD_IMAGES: string[] = [
  // Journey board full card images are loaded on-demand when a board is opened.
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
 * 🔥 CRITICAL: This MUST be called BEFORE HUD initialization in boot()
 */
export async function loadHudIconsIntoPixiCache(): Promise<void> {
  try {
    // Dynamically import PIXI Assets to avoid circular dependencies
    const { Assets } = await import('pixi.js');
    
    logger.info(`🎮 Loading ${CRITICAL_HUD_ICONS.length} HUD icons into PIXI Assets cache...`);
    
    // 🔥 OPTIMIZATION: Check cache first to see how many icons are already loaded
    let cachedCount = 0;
    const iconsToLoad: string[] = [];
    
    // Register all HUD icons with PIXI Assets FIRST and check cache
    // 🔥 Use Assets.cache.has() instead of Assets.get() - get() triggers PixiJS warning when not found
    const hudIcons = MOBILE_RUNTIME_PROFILE.isMobileDevice ? MOBILE_HUD_ICONS : CRITICAL_HUD_ICONS;
    for (const iconPath of hudIcons) {
      try {
        // Check if already loaded - use cache.has() to avoid "Asset was not found in Cache" warning
        if (typeof Assets.cache?.has === 'function' && Assets.cache.has(iconPath)) {
          cachedCount++;
          markAssetAliasRegistered(iconPath);
          continue;
        }
        // Must load - add to queue and register
        iconsToLoad.push(iconPath);
        try {
          Assets.add({ alias: iconPath, src: iconPath });
          markAssetAliasRegistered(iconPath);
        } catch (err) {
          // Already registered, ignore
        }
      } catch (err) {
        logger.warn(`⚠️ Failed to register ${iconPath} with PIXI Assets:`, err);
        iconsToLoad.push(iconPath); // Try to load it anyway
      }
    }
    
    logger.info(`📊 HUD icons cache status: ${cachedCount}/${hudIcons.length} already cached, ${iconsToLoad.length} need loading`);
    
    // If all icons are cached, return immediately
    if (iconsToLoad.length === 0) {
      logger.info(`✅ All ${hudIcons.length} HUD icons already in cache - instant load`);
      return;
    }
    
    // 🔥 CRITICAL: Load remaining HUD icons with timeout protection
    // Use Promise.allSettled so failures don't block - continue even if some icons fail
    // Add timeout to prevent infinite waiting after hard exit
    const loadIconWithRetry = async (iconPath: string, retries = 1): Promise<void> => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          // Use cache.has() to avoid PixiJS "Asset was not found in Cache" warning
          if (typeof Assets.cache?.has === 'function' && Assets.cache.has(iconPath)) return;
          await Assets.load(iconPath);
          logger.info(`✅ Loaded ${iconPath} into PIXI Assets cache`);
          return;
        } catch (err) {
          if (attempt === retries) {
            logger.warn(`⚠️ Failed to load ${iconPath} into PIXI cache (will retry later):`, err);
            // Don't throw - continue with other icons
            return;
          }
          await new Promise(resolve => setTimeout(resolve, 100 * attempt));
        }
      }
    };
    
    // 🔥 OPTIMIZATION: Add timeout to prevent long waits after hard exit
    // Load all icons with timeout - don't wait forever if cache is empty
    const TIMEOUT_MS = 3000; // 3 seconds max wait
    try {
      const loadPromise = Promise.allSettled(
        iconsToLoad.map(iconPath => loadIconWithRetry(iconPath))
      );
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('HUD icons loading timeout')), TIMEOUT_MS);
      });
      
      try {
        // Race between loading and timeout - if timeout wins, we continue anyway
        const result = await Promise.race([loadPromise, timeoutPromise]);
        // If we get here, loading completed (not timeout)
        const successCount = result.filter((r: any) => r.status === 'fulfilled').length;
        const totalLoaded = cachedCount + successCount;
        logger.info(`✅ ${totalLoaded}/${hudIcons.length} HUD icons loaded into PIXI Assets cache (${successCount} new, ${cachedCount} cached)`);
      } catch (timeoutError: any) {
        // Timeout occurred - continue anyway, icons will load lazily
        if (timeoutError?.message === 'HUD icons loading timeout') {
          logger.warn(`⚠️ HUD icons loading timed out after ${TIMEOUT_MS}ms - continuing anyway (${cachedCount} cached, ${iconsToLoad.length} will load lazily)`);
        } else {
          // Some other error - log it but continue
          logger.warn(`⚠️ HUD icons loading error (continuing anyway):`, timeoutError);
        }
        // Continue anyway - HUD will load icons asynchronously when needed
        // Icons will continue loading in background via loadPromise (not awaited)
      }
    } catch (error) {
      logger.error('❌ Error loading HUD icons into PIXI Assets cache:', error);
      // Don't throw - this is non-critical, HUD will load icons asynchronously if needed
    }
  } catch (error) {
    logger.error('❌ Error loading HUD icons into PIXI Assets cache:', error);
    // Don't throw - this is non-critical, HUD will load icons asynchronously if needed
  }
}

/**
 * Cache a single image using Cache API and decode it
 * 🔥 PRODUCTION READY iOS APP STORE: Fast path - browser cache FIRST (instant), Cache API SECOND (persistent)
 * Strategy: Check browser cache FIRST (fast), then Cache API (persistent), then network
 */
async function cacheAndDecodeImage(url: string): Promise<void> {
  try {
    // 🔥 PRODUCTION READY: Step 0 - Check browser cache FIRST (FASTEST - instant check)
    // Browser cache is what <img> tags use, so if it's here, we're done
    const checkBrowserCache = new Promise<boolean>((resolve) => {
      const testImg = new Image();
      testImg.onload = () => resolve(true);
      testImg.onerror = () => resolve(false);
      testImg.src = url;
      // Fast timeout - if cached, should resolve instantly
      setTimeout(() => {
        resolve(testImg.complete && testImg.naturalWidth > 0);
      }, 10); // Reduced from 50ms to 10ms for faster check
    });
    
    const isInBrowserCache = await checkBrowserCache;
    
    if (isInBrowserCache) {
      // Image is in browser cache - instant display, no loading needed
      logger.debug(`✅ ${url} in browser cache - instant display`);
      // Ensure it's also in Cache API for next time (non-blocking)
      ensureInCacheAPI(url).catch(() => {});
      return; // Done - image is ready instantly
    }
    
    // 🔥 PRODUCTION READY iOS APP STORE: Step 1 - Check Cache API (persistent storage)
    // Use absolute URL so cache keys match; Cache API survives hard exit on iOS
    if (typeof caches !== 'undefined') {
      try {
        const cache = await caches.open(CACHE_NAME);
        const absUrl = toAbsoluteUrl(url);
        const cached = await cache.match(absUrl) ?? await cache.match(url);
        
        if (cached) {
          const blob = await cached.blob();
          const blobUrl = URL.createObjectURL(blob);
          let decodeOk = false;
          await new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => {
              decodeOk = true;
              URL.revokeObjectURL(blobUrl);
              resolve();
            };
            img.onerror = () => {
              URL.revokeObjectURL(blobUrl);
              resolve();
            };
            img.src = blobUrl;
          });
          if (decodeOk) return;
          // Decode failed (e.g. bad blob) – fall through to network fetch
        }
      } catch (cacheError) {
        logger.warn(`⚠️ Cache API error for ${url}:`, cacheError);
      }
    }
    
    // Step 2: Fetch from network, decode into browser cache, store in Cache API
    logger.debug(`📦 ${url} not cached - fetching from network...`);
    
    const loadIntoBrowserCache = new Promise<void>((resolve) => {
      const img = new Image();
      img.loading = 'eager';
      (img as any).decoding = 'async';
      (img as any).fetchPriority = 'high';
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = url;
    });
    
    await loadIntoBrowserCache;
    ensureInCacheAPI(url).catch(() => {});
  } catch (error) {
    logger.warn(`⚠️ Error caching/decoding ${url}:`, error);
  }
}

/**
 * Ensure image is in Cache API for permanent storage
 * This runs non-blocking in background
 */
async function ensureInCacheAPI(url: string): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const cache = await caches.open(CACHE_NAME);
    const absUrl = toAbsoluteUrl(url);
    const cached = await cache.match(absUrl) ?? await cache.match(url);
    if (cached) return;
    const response = await fetch(url, { cache: 'force-cache', mode: 'cors' });
    if (response.ok) {
      await cache.put(absUrl, response);
    }
  } catch {
    // Non-blocking; avoid log spam
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
      if (MOBILE_RUNTIME_PROFILE.isMobileDevice) {
        logger.info('📱 Loading bounded mobile launch-route assets');
        await Promise.all([
          loadHudIconsIntoPixiCache(),
          loadMobileLaunchRouteAssets(),
        ]);
        isPreloading = false;
        return;
      }
      logger.info(`📦 Starting comprehensive image preloading (${ALL_STARTUP_IMAGES.length} images)...`);
      
      // Check if cache is valid
      const cacheValid = await checkCacheVersion();
      
      // 🔥 CRITICAL: Load HUD icons into PIXI Assets cache FIRST (HIGHEST PRIORITY)
      // HUD icons MUST be available before boot() initializes HUD
      // This runs BEFORE any other preloading
      logger.info('🎮 Loading HUD icons into PIXI Assets cache (HIGHEST PRIORITY - BLOCKING)...');
      await loadHudIconsIntoPixiCache();
      logger.info('✅ HUD icons loaded into PIXI Assets cache (completed)');
      
      // 🔥 PRODUCTION READY: Always load critical images BLOCKING, even if cache is valid
      // This ensures images are ALWAYS in browser cache, even after hard exit
      // Browser cache is what <img> tags actually use, not Cache API
      logger.info('🔥 PRODUCTION READY: Loading ALL critical images BLOCKING (ensures instant display)...');
      
      // 🔥 CRITICAL: All homepage slider images (must be instant, no loading delay)
      const homepageSliderImages = [
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
      ];
      
      // Journey shell images only. Full board cards are multi-megabyte PNGs and
      // are loaded on demand to avoid iOS WebContent memory pressure.
      const journeyScreenImages = [
        './assets/journey assets/1-17bg.png',
        './assets/journey assets/orange-ribbon.png',
        './assets/journey assets/orange-ribbon@2x.png',
        './assets/journey assets/orange-ribbon@3x.png',
        './assets/colelctibles/journey-card-empty.png',
        './assets/colelctibles/common back.png',
      ];
      
      // 🔥 CRITICAL: HUD and other essential images
      const essentialImages = [
          './assets/hud/star-hud.png',
          './assets/highscore-icon.png',
      ];
      
      // Combine all critical images
      const criticalImages = [
        ...homepageSliderImages,
        ...journeyScreenImages,
        ...essentialImages,
        ];
        
      logger.info(`🔥 Loading ${criticalImages.length} critical images BLOCKING (homepage slider + Journey screen + essentials)...`);
      
      // 🔥 PRODUCTION READY: Fast path - load critical images in parallel (non-blocking check)
      // Browser cache check is fast (10ms timeout), Cache API is checked inside cacheAndDecodeImage
      // This ensures images load quickly without blocking Journey screen render
      logger.info(`🔥 Loading ${criticalImages.length} critical images in parallel (fast path)...`);
        
      // Load all critical images in parallel (non-blocking for Journey screen)
      // cacheAndDecodeImage will check browser cache FIRST (fast), then Cache API, then network
      const loadImageWithRetry = async (url: string, retries = 2): Promise<void> => {
        for (let attempt = 1; attempt <= retries; attempt++) {
          try {
            await cacheAndDecodeImage(url);
            return;
          } catch (err) {
            if (attempt === retries) {
              logger.warn(`⚠️ Failed to load ${url} after ${retries} attempts:`, err);
              // Don't throw - continue with other images
            } else {
              await new Promise(resolve => setTimeout(resolve, 50 * attempt));
            }
          }
        }
      };
      
      // Load in parallel - don't wait for all (non-blocking)
      // This ensures Journey screen renders immediately, images load in background
      Promise.allSettled(
        criticalImages.map(url => loadImageWithRetry(url))
      ).then((results) => {
        const successful = results.filter(r => r.status === 'fulfilled').length;
        logger.info(`✅ ${successful}/${criticalImages.length} critical images loaded`);
      }).catch((error) => {
        logger.warn('⚠️ Some critical images failed to load:', error);
      });
        
      // Don't wait for images - render Journey screen immediately
      logger.info(`✅ Critical images loading started (non-blocking) - Journey screen can render immediately`);
      
      if (cacheValid) {
        // Cache is valid - load remaining images in background (non-blocking)
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
      
      // 🔥 NOTE: HUD icons are already loaded at the start of this function (HIGHEST PRIORITY)
      
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
 * 🔥 PRODUCTION READY: Also caches images permanently for future use
 */
export async function preloadJourneyBoardImages(boardIds: number[]): Promise<void> {
  try {
    const imagesToPreload: string[] = [];
    
    // Add collectibles card images for opened boards
    boardIds.forEach(boardId => {
      if (boardId < 1 || boardId > 30) return;
      const assetBoardId = boardId >= 21 ? boardId - 20 : boardId;
      const id = String(assetBoardId).padStart(2, '0');
      imagesToPreload.push(`./assets/colelctibles/common/${id}.png`);
      if (boardId === 1 || boardId === 21) {
        imagesToPreload.push('./assets/journey assets/forest/cards/forest-1.png');
      }
    });
    
    if (imagesToPreload.length === 0) {
      return;
    }
    
    logger.info(`🗺️ Preloading ${imagesToPreload.length} journey board images (on-demand)...`);
    
    // 🔥 PRODUCTION READY: Load with retry logic and cache permanently
    const loadImageWithRetry = async (url: string, retries = 3): Promise<void> => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          await cacheAndDecodeImage(url);
          logger.debug(`✅ Loaded ${url} into browser cache (attempt ${attempt})`);
          return; // Success
        } catch (err) {
          if (attempt === retries) {
            logger.warn(`⚠️ Failed to load ${url} after ${retries} attempts:`, err);
            // Don't throw - continue with other images
          } else {
            logger.warn(`⚠️ Failed to load ${url} (attempt ${attempt}/${retries}), retrying...`, err);
            await new Promise(resolve => setTimeout(resolve, 100 * attempt)); // Exponential backoff
          }
        }
      }
    };
    
    // Preload in parallel with retry logic
    await Promise.allSettled(
      imagesToPreload.map(url => loadImageWithRetry(url))
    );
    
    logger.info(`✅ Journey board images preloaded and cached permanently`);
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
