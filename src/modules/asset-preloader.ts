// @ts-nocheck
// src/modules/asset-preloader.ts
// Comprehensive asset preloader for all game assets

import { Assets } from 'pixi.js';
import { logger } from '../core/logger.js';
import { isAssetAliasRegistered, markAssetAliasRegistered } from '../utils/asset-registry.js';

function isAliasAlreadyInPixiResolver(alias: string): boolean {
  try {
    const resolver: any = (Assets as any)?.resolver;
    if (!resolver) return false;
    if (typeof resolver.hasKey === 'function') return !!resolver.hasKey(alias);
    if (typeof resolver.hasAlias === 'function') return !!resolver.hasAlias(alias);
    if (typeof resolver.has === 'function') return !!resolver.has(alias);
  } catch {}
  return false;
}

// Type definitions
interface ProgressCallback {
  (percentage: number, loadedCount: number, totalCount: number): void;
}

interface CompleteCallback {
  (): void;
}

interface ErrorCallback {
  (error: Error): void;
}

const JOURNEY_BOTTOM_DECOR_IMAGES = Array.from({ length: 12 }, (_, index) => {
  const bottomIndex = index + 1;
  return [
    `./assets/journey assets/bottom${bottomIndex}.png`,
    `./assets/journey assets/bottom${bottomIndex}@2x.png`,
  ];
}).flat();

// Window interface is now defined in src/types/window.d.ts

// Add audio parser for PixiJS (only if addParser exists)
if (Assets.addParser) {
  Assets.addParser('audio', {
    test: (url: string) => /\.(mp3|wav|ogg|m4a)$/i.test(url),
    load: async (url: string): Promise<HTMLAudioElement> => {
      return new Promise((resolve, reject) => {
        const audio = new Audio();
        audio.oncanplaythrough = () => resolve(audio);
        audio.onerror = (error) => {
          logger.warn('🔊 Audio loading failed:', url, error);
          // Return a dummy audio object to prevent crashes
          resolve(audio);
        };
        audio.src = url;
        // Timeout after 5 seconds
        setTimeout(() => {
          if (audio.readyState === 0) {
            logger.warn('🔊 Audio loading timeout:', url);
            resolve(audio);
          }
        }, 5000);
      });
    }
  });
} else {
  logger.debug?.('🔊 Assets.addParser not available, skipping audio parser');
}

// All game assets that need to be preloaded
const ALL_ASSETS: string[] = [
  // Homepage images (priority - load first for immediate display)
  './assets/crash-cubes-homepage.png',
  './assets/crash-cubes-homepage@2x.png',
  './assets/crash-cubes-homepage@3x.png',
  // Note: homepage1 and homepage2 removed - not used in slider
  './assets/logo-cube-crash.png',
  './assets/logo-cube-crash@2x.png',
  './assets/logo-cube-crash@3x.png',
  // './assets/logo.png' - removed: file not in repo (use logo-cube-crash)
  
  // Logo addons
  './assets/logo addons/gore ljevo shards.png',
  './assets/logo addons/shards gore desno.png',
  './assets/logo addons/dole ljevi shards.png',
  './assets/logo addons/dole desni.png',
  './assets/home-shadow.png',
  './assets/home-shadow@2x.png',
  './assets/home-shadow@3x.png',
  
  // Core game assets
  './assets/tile.png',
  './assets/tile_numbers.png',
  './assets/tile_numbers2.png', 
  './assets/tile_numbers3.png',
  './assets/tile_numbers4.png',
  './assets/ghost-placeholder.png',
  './assets/ghost-placeholder@2x.png',
  './assets/ghost-placeholder@3x.png',
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
  './assets/shop/explosion pack/animation/tnt1@2x.png',
  './assets/shop/explosion pack/animation/tnt2.png',
  './assets/shop/explosion pack/animation/tnt2@2x.png',
  './assets/shop/explosion pack/animation/tnt3.png',
  './assets/shop/explosion pack/animation/tnt3@2x.png',
  './assets/shop/explosion pack/animation/tnt4.png',
  './assets/shop/explosion pack/animation/tnt4@2x.png',
  './assets/shop/explosion pack/animation/tnt5.png',
  './assets/shop/explosion pack/animation/tnt5@2x.png',
  './assets/shop/explosion pack/animation/tnt6.png',
  './assets/shop/explosion pack/animation/tnt6@2x.png',
  './assets/shop/explosion pack/animation/tnt7.png',
  './assets/shop/explosion pack/animation/tnt7@2x.png',
  './assets/shop/explosion pack/animation/tnt8.png',
  './assets/shop/explosion pack/animation/tnt8@2x.png',
  './assets/shop/explosion pack/animation/tnt9.png',
  './assets/shop/explosion pack/animation/tnt9@2x.png',
  './assets/shop/explosion pack/animation/tnt10.png',
  './assets/shop/explosion pack/animation/tnt10@2x.png',
  './assets/shop/explosion pack/animation/tnt11.png',
  './assets/shop/explosion pack/animation/tnt11@2x.png',
  './assets/shop/explosion pack/animation/tnt12.png',
  './assets/shop/explosion pack/animation/tnt12@2x.png',
  './assets/shop/cubero/cubero.png',
  './assets/shop/cubero/cubero@2x.png',
  './assets/shop/cubero/krpa1.png',
  './assets/shop/cubero/krpa2.png',
  './assets/shop/cubero/krpa3.png',
  './assets/shop/cubero/krpa4.png',
  './assets/shop/cubero/krpa5.png',
  './assets/shop/cubero/krpa6.png',
  './assets/shop/cubero/krpa7.png',
  './assets/shop/ball/ball.png',
  './assets/shop/ball/ball@2x.png',
  './assets/shop/ball/ball1.png',
  './assets/shop/ball/ball2.png',
  './assets/shop/ball/ball3.png',
  './assets/shop/ball/ball4.png',
  './assets/shop/ball/ball5.png',
  './assets/shop/ball/ball6.png',
  
  // Wild star assets
  './assets/small-star.png',
  './assets/small-star@2x.png',
  './assets/small-star@3x.png',
  
  // Other UI assets
  './assets/journey-map-homepage.png',
  './assets/journey-map-homepage@2x.png',
  './assets/journey-map-homepage@3x.png',
  './assets/collectibles-box.png',
  './assets/collectibles-box@2x.png',
  './assets/collectibles-box@3x.png',
  './assets/settings-slider.png',
  './assets/settings-slider@2x.png',
  './assets/settings-slider@3x.png',
  './assets/clean-board.png',
  // './assets/mystery-box.png' - removed: file not in repo
  // './assets/gold-coin.png' - removed: file not in repo
  // './assets/potion.png' - removed: decode fails in preload
  './assets/melted-dice.png',
  // './assets/ripple.png' - removed: file not in repo
  // './assets/leaf light.png' - removed: decode fails (space in path or invalid file)
  
  // Icons
  './assets/chevron-back.png',
  './assets/close-button.png',
  './assets/close-icon.png',
  './assets/collectible-stats.png',
  './assets/combo-icon.png',
  './assets/hud/star-hud.png',
  './assets/hud/star-hud@2x.png',
  './assets/hud/star-hud@3x.png',
  './assets/hud/score-hud.png',
  './assets/hud/score-hud@2x.png',
  './assets/hud/score-hud@3x.png',
  './assets/hud/help.png',
  './assets/hud/help@2x.png',
  './assets/hud/help@3x.png',
  './assets/hud/combo-hud.png',
  './assets/hud/combo-hud@2x.png',
  './assets/hud/combo-hud@3x.png',
  './assets/hud/extra-combo-hud.png',
  './assets/hud/extra-combo-hud@2x.png',
  './assets/hud/extra-combo-hud@3x.png',
  './assets/hud/mega-combo-hud.png',
  './assets/hud/mega-combo-hud@2x.png',
  './assets/hud/mega-combo-hud@3x.png',
  './assets/combo-stats.png',
  './assets/cubes-cracked.png',
  './assets/cubes-cracked@2x.png',
  './assets/cubes-cracked@3x.png',
  
  // Bottom sheet icons (preload to prevent blurry loading)
  './assets/highscore-icon.png',
  './assets/highscore-icon@2x.png',
  './assets/highscore-icon@3x.png',
  './assets/modals/paper.png',
  './assets/modals/paper@2x.png',
  './assets/modals/paper@3x.png',
  // restart-icon, resume-game, settings-icon, time-icon, unpause-icon, wild-stats, stop - removed: decode fails (InvalidStateError) in preload; add back when assets fixed
  './assets/settings-slider.png',
  './assets/journey-map-homepage.png',
  './assets/wild.png',
  
  // Fonts
  './assets/fonts/Baloo2-Regular.ttf',
  './assets/fonts/Baloo2-Medium.ttf',
  './assets/fonts/Baloo2-SemiBold.ttf',
  './assets/fonts/Baloo2-Bold.ttf',
  './assets/fonts/Baloo2-ExtraBold.ttf',
  
  // Audio - skip for now to avoid PIXI.js parsing issues
  // './assets/explode.mp3',
  
  // Video
  './assets/swipe.MP4',
  
  // FX assets - fx/boom folder not in repo; removed to avoid load errors
  './assets/colelctibles/common back.png',
  './assets/colelctibles/legendary back.png',
];

// CRITICAL ASSETS: All assets needed for homepage slider and first game frame
const CRITICAL_ASSETS: string[] = [
  // Homepage hero (all DPRs) + logo/shards/shadow
  './assets/crash-cubes-homepage.png',
  './assets/crash-cubes-homepage@2x.png',
  './assets/crash-cubes-homepage@3x.png',
  './assets/logo-cube-crash.png',
  './assets/logo-cube-crash@2x.png',
  './assets/logo-cube-crash@3x.png',
  './assets/logo addons/gore ljevo shards.png',
  './assets/logo addons/shards gore desno.png',
  './assets/logo addons/dole ljevi shards.png',
  './assets/logo addons/dole desni.png',
  './assets/home-shadow.png',
  './assets/home-shadow@2x.png',
  './assets/home-shadow@3x.png',
  
  // Homepage slider images (ALL slides must be loaded before showing homepage)
  './assets/journey-map-homepage.png',
  './assets/journey-map-homepage@2x.png',
  './assets/journey-map-homepage@3x.png',
  './assets/collectibles-box.png',
  './assets/collectibles-box@2x.png',
  './assets/collectibles-box@3x.png',
  './assets/settings-slider.png',
  './assets/settings-slider@2x.png',
  './assets/settings-slider@3x.png',
  
  // Core game - minimum for initial play
  './assets/tile.png',
  './assets/tile_numbers.png',
  './assets/ghost-placeholder.png',
  './assets/ghost-placeholder@2x.png',
  './assets/ghost-placeholder@3x.png',
  './assets/wild.png',
  './assets/shop/cubero/cubero.png',
  './assets/shop/ball/ball.png',
  
  // Wild star assets (needed immediately when wild cubes spawn)
  './assets/small-star.png',
  './assets/shop/cubero/krpa1.png',
  './assets/shop/cubero/krpa2.png',
  './assets/shop/cubero/krpa3.png',
  './assets/shop/cubero/krpa4.png',
  './assets/shop/cubero/krpa5.png',
  './assets/shop/cubero/krpa6.png',
  './assets/shop/cubero/krpa7.png',
  './assets/shop/ball/ball@2x.png',
  './assets/small-star@2x.png',
  './assets/small-star@3x.png',
  
  // Essential UI (first frame only)
  './assets/close-button.png',
  './assets/close-icon.png',
  './assets/hud/help.png',
  './assets/hud/help@2x.png',
  './assets/hud/help@3x.png',
  // './assets/stop.png' - removed: decode fails in preload
  
  // Bottom sheet icons (preload to prevent blurry loading when modals open)
  './assets/highscore-icon.png',
  './assets/highscore-icon@2x.png',
  './assets/highscore-icon@3x.png',
  './assets/cubes-cracked.png',
  './assets/cubes-cracked@2x.png',
  './assets/cubes-cracked@3x.png',
  './assets/modals/paper.png',
  './assets/modals/paper@2x.png',
  './assets/modals/paper@3x.png',
  
  // Fonts
  './assets/fonts/Baloo2-Regular.ttf',
  './assets/fonts/Baloo2-Medium.ttf',
  './assets/fonts/Baloo2-SemiBold.ttf',
  './assets/fonts/Baloo2-Bold.ttf',
  './assets/fonts/Baloo2-ExtraBold.ttf',
  
  // Collectibles placeholder images (needed for collectibles screen)
  './assets/colelctibles/common back.png',
  './assets/colelctibles/legendary back.png',
  // NOTE: Collectibles card fronts are not globally preloaded; visible cards
  // and detail modals load them on demand to avoid iOS WebContent pressure.
];

// Collectible card fronts are intentionally not part of global/deferred preload.
// They are multi-megabyte PNGs and must be loaded only when a visible card or
// detail modal needs them, otherwise iOS WebContent hits memory pressure.

// DEFERRED ASSETS: Load these in background after critical
const DEFERRED_ASSETS: string[] = ALL_ASSETS.filter(asset => !CRITICAL_ASSETS.includes(asset));

export class AssetPreloader {
  private loadedCount: number = 0;
  private totalCount: number = ALL_ASSETS.length;
  private onProgress: ProgressCallback | null = null;
  private onComplete: CompleteCallback | null = null;
  private onError: ErrorCallback | null = null;
  private preloadPromise: Promise<void> | null = null;
  private criticalPreloadPromise: Promise<void> | null = null;
  private postCriticalPreloadPromise: Promise<void> | null = null;

  constructor() {
    this.loadedCount = 0;
    this.totalCount = ALL_ASSETS.length;
    this.onProgress = null;
    this.onComplete = null;
    this.onError = null;
    this.preloadPromise = null;
    this.criticalPreloadPromise = null;
    this.postCriticalPreloadPromise = null;
  }

  setProgressCallback(callback: ProgressCallback): void {
    this.onProgress = callback;
  }

  setCompleteCallback(callback: CompleteCallback): void {
    this.onComplete = callback;
  }

  setErrorCallback(callback: ErrorCallback): void {
    this.onError = callback;
  }

  private updateProgress(): void {
    // Ensure percentage is between 0 and 100
    const percentage = Math.min(100, Math.max(0, Math.round((this.loadedCount / this.totalCount) * 100)));
    if (this.onProgress) {
      this.onProgress(percentage, this.loadedCount, this.totalCount);
    }
    // Also log for debugging
    if (this.loadedCount % 5 === 0 || this.loadedCount === this.totalCount) {
      logger.debug(`📊 Progress: ${percentage}% (${this.loadedCount}/${this.totalCount})`);
    }
  }

  private async yieldToMainThread(): Promise<void> {
    await new Promise<void>((resolve) => {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => resolve());
      } else {
        setTimeout(() => resolve(), 0);
      }
    });
  }

  private async loadImagesInBatches(images: string[], batchSize: number): Promise<void> {
    for (let i = 0; i < images.length; i += batchSize) {
      const batch = images.slice(i, i + batchSize);
      const loadPromises = batch.map((src: string) => {
        return new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = src;
        });
      });
      await Promise.allSettled(loadPromises);
      await this.yieldToMainThread();
    }
  }

  async loadAudioFiles(): Promise<void> {
    const audioFiles: string[] = [
      './assets/explode.mp3'
    ];
    
    for (const audioFile of audioFiles) {
      try {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.src = audioFile;
        
        // Store audio in global cache for later use
        window.gameAudio = window.gameAudio || {};
        window.gameAudio[audioFile] = audio;
        
        logger.info('🔊 Audio loaded:', audioFile);
      } catch (error) {
        logger.warn('🔊 Audio loading failed:', audioFile, error);
      }
    }
  }

  // 🔥 CRITICAL: Preload HTML img tag images to ensure they're in browser cache
  // This prevents images from disappearing on mobile after preload screen hides
  async preloadHTMLImages(): Promise<void> {
    const htmlImages = [
      // Homepage slider images (all DPRs)
      './assets/crash-cubes-homepage.png',
      './assets/crash-cubes-homepage@2x.png',
      './assets/crash-cubes-homepage@3x.png',
      // Stats slide
      './assets/journey-map-homepage.png',
      './assets/journey-map-homepage@2x.png',
      './assets/journey-map-homepage@3x.png',
      // Collectibles slide
      './assets/collectibles-box.png',
      './assets/collectibles-box@2x.png',
      './assets/collectibles-box@3x.png',
      // Settings slide
      './assets/settings-slider.png',
      './assets/settings-slider@2x.png',
      './assets/settings-slider@3x.png',
      // 🔥 USER REQUEST: Paper texture for bottom sheets (used in CSS background)
      // Must be preloaded as HTML Image to ensure browser cache before bottom sheets open
      './assets/modals/paper.png',
      './assets/modals/paper@2x.png',
      './assets/modals/paper@3x.png',
      './assets/ghost-placeholder.png',
      './assets/ghost-placeholder@2x.png',
      './assets/ghost-placeholder@3x.png',
      // 🔥 CRITICAL: Journey screen assets (must be preloaded for instant Journey screen load)
      './assets/journey assets/1-17bg.png',
      ...JOURNEY_BOTTOM_DECOR_IMAGES,
      './assets/journey assets/orange-ribbon.png',
      './assets/journey assets/orange-ribbon@2x.png',
      './assets/journey assets/orange-ribbon@3x.png',
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
      './assets/colelctibles/journey-card-empty.png',
      './assets/colelctibles/common back.png',
      './assets/board transition/oblak+srednji.png',
      './assets/board transition/oblak mali desno.png',
      './assets/board transition/oblak mali ljevo.png',
      './assets/board transition/oblak veliki ljevo dole.png',
      './assets/animations/bolt1.png',
      './assets/animations/bolt2.png',
      './assets/animations/bolt3.png',
      './assets/animations/bolt4.png',
      './assets/animations/bolt5.png',
      './assets/animations/bolt6.png',
      './assets/animations/bolt7.png',
      './assets/animations/bolt8.png',
      './assets/animations/backpack/backpack-1.png',
      './assets/animations/backpack/backpack-2.png',
      './assets/animations/backpack/backpack-3.png',
      './assets/animations/backpack/backpack-4.png',
      './assets/animations/backpack/backpack-5.png',
      './assets/animations/backpack/backpack-6.png',
      './assets/animations/backpack/backpack-7.png',
      './assets/animations/backpack/backpack-8.png',
      './assets/animations/backpack/backpack-9.png',
      './assets/animations/backpack/backpack-10.png',
      './assets/animations/backpack/backpack-11.png',
      './assets/animations/backpack/backpack-12.png',
      './assets/animations/backpack/backpack-13.png',
      './assets/animations/backpack/backpack-14.png',
      './assets/animations/backpack/backpack-15.png',
      './assets/animations/backpack/backpack-16.png',
      './assets/animations/backpack/backpack-17.png',
      './assets/animations/backpack/backpack-18.png',
      './assets/animations/backpack/backpack-19.png',
      './assets/animations/backpack/backpack-20.png',
      './assets/animations/crate/box-1.png',
      './assets/animations/crate/box-2.png',
      './assets/animations/crate/box-3.png',
      './assets/animations/crate/box-4.png',
      './assets/animations/crate/box-5.png',
      './assets/animations/crate/box-6.png',
      './assets/animations/crate/box-7.png',
      './assets/animations/crate/box-8.png',
      './assets/animations/crate/box-9.png',
      './assets/animations/crate/box-10.png',
    ];
    
    logger.info(`🖼️ Preloading ${htmlImages.length} HTML images for homepage slider...`);
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const batchSize = isMobile ? 4 : 6;
    await this.loadImagesInBatches(htmlImages, batchSize);
    logger.debug('✅ All HTML images preloaded');
  }

  // Preload only shared collectibles placeholders. Full card fronts are loaded
  // lazily by the grid/detail modal to keep iOS WebContent memory stable.
  async preloadCollectiblesImages(): Promise<void> {
    const cacheKey = 'collectibles_images_preloaded';
    const wasPreloaded = localStorage.getItem(cacheKey) === 'true';
    
    if (wasPreloaded) {
      logger.info('🎁 Collectibles placeholders already preloaded (using browser cache)');
      const criticalImages = [
        './assets/colelctibles/common back.png',
        './assets/colelctibles/legendary back.png'
      ];
      await Promise.allSettled(criticalImages.map(src => this.verifyImageInCache(src)));
      return;
    }
    
    const collectiblesImages: string[] = [
      './assets/colelctibles/common back.png',
      './assets/colelctibles/legendary back.png'
    ];
    
    logger.info(`🎁 Preloading ${collectiblesImages.length} collectibles placeholder images...`);
    
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const batchSize = isMobile ? 4 : 6;
    await this.loadImagesInBatches(collectiblesImages, batchSize);
    localStorage.setItem(cacheKey, 'true');
    logger.info(`✅ Collectibles placeholders preloaded (browser cache ready)`);
  }
  
  // Helper: Verify image is in browser cache (fast check)
  // Browser cache automatically handles this - if image is cached, it loads instantly
  private async verifyImageInCache(src: string): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      // If image is already in browser cache, onload fires immediately (no network request)
      img.onload = () => resolve();
      img.onerror = () => resolve(); // Don't block on errors
      img.src = src;
      // Timeout after 100ms - if cached, should load instantly
      setTimeout(() => resolve(), 100);
    });
  }

  // 🔥 CRITICAL: Preload Journey screen assets for instant load
  // This ensures Journey screen loads instantly when opened (no delay, no blank screen)
  // Uses browser cache - if images are already cached, they load instantly
  async preloadJourneyAssets(): Promise<void> {
    // Check if already preloaded (browser cache will handle subsequent loads)
    const cacheKey = 'journey_assets_preloaded';
    const wasPreloaded = localStorage.getItem(cacheKey) === 'true';
    
    if (wasPreloaded) {
      logger.info('🗺️ Journey assets already preloaded (using browser cache)');
      // Still verify critical images are in cache (fast check)
      const criticalImages = [
        './assets/journey assets/1-17bg.png',
        ...JOURNEY_BOTTOM_DECOR_IMAGES,
        './assets/colelctibles/journey-card-empty.png'
      ];
      await Promise.allSettled(criticalImages.map(src => this.verifyImageInCache(src)));
      return;
    }
    
    const journeyImages: string[] = [];
    
    // Journey background and UI elements
    journeyImages.push('./assets/journey assets/1-17bg.png');
    journeyImages.push(...JOURNEY_BOTTOM_DECOR_IMAGES);
    journeyImages.push('./assets/journey assets/orange-ribbon.png');
    journeyImages.push('./assets/journey assets/orange-ribbon@2x.png');
    journeyImages.push('./assets/journey assets/orange-ribbon@3x.png');
    
    // Journey placeholder images (used for lazy loading)
    journeyImages.push('./assets/colelctibles/journey-card-empty.png');
    journeyImages.push('./assets/colelctibles/common back.png');
    
    logger.info(`🗺️ Preloading ${journeyImages.length} Journey screen images for instant load...`);
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const batchSize = isMobile ? 4 : 6;
    await this.loadImagesInBatches(journeyImages, batchSize);
    localStorage.setItem(cacheKey, 'true');
    logger.info(`✅ All ${journeyImages.length} Journey screen images preloaded (browser cache ready)`);
  }

  async preloadAll(): Promise<void> {
    if (this.preloadPromise) {
      return this.preloadPromise;
    }
    this.preloadPromise = (async () => {
      try {
        logger.info('🔄 Starting full asset preloading (critical + post-critical)...');
        await this.preloadCriticalAssetsOnly();
        await this.preloadPostCriticalAssets();

        if (this.onComplete) {
          this.onComplete();
        }
        
      } catch (error) {
        logger.error('❌ Asset preloading failed:', error);
        
        // Even on error, continue with the app
        this.loadedCount = this.totalCount;
        this.updateProgress();
        
        // Still call onComplete to allow app to continue
        if (this.onComplete) {
          this.onComplete();
        }
      }
    })();
    return this.preloadPromise;
  }

  async preloadCriticalAssetsOnly(): Promise<void> {
    if (this.criticalPreloadPromise) {
      return this.criticalPreloadPromise;
    }

    this.criticalPreloadPromise = (async () => {
      logger.info('🔄 Starting critical asset preloading only...');

      this.totalCount = CRITICAL_ASSETS.length;
      this.loadedCount = 0;

      logger.debug(`📦 Loading ${CRITICAL_ASSETS.length} critical assets`);

      const registeredKeys = new Set<string>();
      CRITICAL_ASSETS.forEach((assetPath: string) => {
        if (registeredKeys.has(assetPath)) return;
        if (isAssetAliasRegistered(assetPath)) return;
        if (isAliasAlreadyInPixiResolver(assetPath)) {
          markAssetAliasRegistered(assetPath);
          return;
        }
        if (typeof Assets.cache?.has === 'function' && Assets.cache.has(assetPath)) {
          markAssetAliasRegistered(assetPath);
          return;
        }
        registeredKeys.add(assetPath);
        try {
          Assets.add({ alias: assetPath, src: assetPath });
          markAssetAliasRegistered(assetPath);
        } catch (err) {
          // Ignore if already added
        }
      });

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      const batchSize = isIOS ? 8 : (isMobile ? 6 : 10);

      logger.debug(`📦 Loading ${CRITICAL_ASSETS.length} critical assets in batches of ${batchSize} (mobile: ${isMobile}, iOS: ${isIOS})`);
      this.updateProgress();

      let totalLoaded = 0;
      for (let i = 0; i < CRITICAL_ASSETS.length; i += batchSize) {
        const batch = CRITICAL_ASSETS.slice(i, i + batchSize);
        try {
          await Assets.load(batch);
          totalLoaded += batch.length;
          this.loadedCount = totalLoaded;
          this.updateProgress();
          logger.debug(`✅ Loaded critical batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(CRITICAL_ASSETS.length / batchSize)}: ${batch.length} assets (${totalLoaded}/${this.totalCount})`);
          await this.yieldToMainThread();
        } catch (error) {
          logger.warn(`⚠️ Critical batch ${Math.floor(i / batchSize) + 1} failed, trying individual loading...`, error);
          for (const assetPath of batch) {
            try {
              await Assets.load(assetPath);
            } catch (err) {
              logger.warn(`⚠️ Failed to load critical asset: ${assetPath}`, err);
            } finally {
              totalLoaded++;
              this.loadedCount = totalLoaded;
              this.updateProgress();
            }
          }
          await this.yieldToMainThread();
        }
      }

      this.loadedCount = this.totalCount;
      this.updateProgress();
      logger.info(`✅ Critical assets preloaded successfully (${this.loadedCount}/${this.totalCount} loaded)`);
    })();

    return this.criticalPreloadPromise;
  }

  async preloadPostCriticalAssets(): Promise<void> {
    if (this.postCriticalPreloadPromise) {
      return this.postCriticalPreloadPromise;
    }

    this.postCriticalPreloadPromise = (async () => {
      logger.info('🔄 Starting post-critical asset preloading...');

      await this.preloadCriticalAssetsOnly();

      await this.preloadHTMLImages();

      logger.info('🗺️ Preloading Journey screen assets...');
      await this.preloadJourneyAssets();
      logger.info('✅ Journey screen assets preloaded');

      logger.info('🎁 Preloading collectibles placeholders...');
      await this.preloadCollectiblesImages();
      logger.info('✅ Collectibles placeholders preloaded');

      logger.info('🗺️ Preparing Journey screen boards...');
      try {
        const { ensureCollectiblesManager } = await import('../collectibles-manager.js');
        const manager = await ensureCollectiblesManager();
        if (manager && typeof manager.prepareJourneyScreen === 'function') {
          await manager.prepareJourneyScreen();
          logger.info('✅ Journey screen boards prepared');
        } else {
          logger.warn('⚠️ prepareJourneyScreen function not found in collectibles-manager');
        }
      } catch (err) {
        logger.warn('⚠️ Journey screen preparation failed (non-critical):', err);
      }

      await this.preloadDeferredAssets();

      try {
        await this.loadAudioFiles();
      } catch (err) {
        logger.warn('⚠️ Audio loading failed, continuing...', err);
      }

      logger.info('✅ Post-critical asset preloading completed');
    })();

    return this.postCriticalPreloadPromise;
  }

  // Load deferred assets in background (non-blocking)
  async preloadDeferredAssets(): Promise<void> {
    logger.info(`🔄 Starting background loading of ${DEFERRED_ASSETS.length} deferred assets...`);
    
    try {
      // 🔥 CRITICAL: Register deferred assets with Assets.add() BEFORE loading (skip if already in cache to avoid Resolver "already has key" warnings)
      const deferredKeys = new Set<string>();
      DEFERRED_ASSETS.forEach((assetPath: string) => {
        if (deferredKeys.has(assetPath)) return;
        if (isAssetAliasRegistered(assetPath)) return;
        if (isAliasAlreadyInPixiResolver(assetPath)) {
          markAssetAliasRegistered(assetPath);
          return;
        }
        if (typeof Assets.cache?.has === 'function' && Assets.cache.has(assetPath)) {
          markAssetAliasRegistered(assetPath);
          return;
        }
        deferredKeys.add(assetPath);
        try {
          Assets.add({ alias: assetPath, src: assetPath });
          markAssetAliasRegistered(assetPath);
        } catch (err) {
          // Ignore if already added
        }
      });
      
      // 🔥 OPTIMIZED: Use smaller batches on mobile for better performance
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const batchSize = isMobile ? 5 : 10; // Smaller batches on mobile
      
      logger.debug(`📦 Loading ${DEFERRED_ASSETS.length} deferred assets in batches of ${batchSize} (mobile: ${isMobile})`);
      
      for (let i = 0; i < DEFERRED_ASSETS.length; i += batchSize) {
        const batch = DEFERRED_ASSETS.slice(i, i + batchSize);
        try {
          await Assets.load(batch);
          logger.debug(`✅ Loaded batch ${Math.floor(i / batchSize) + 1} (${Math.min(i + batchSize, DEFERRED_ASSETS.length)}/${DEFERRED_ASSETS.length})`);
          await this.yieldToMainThread();
        } catch (error) {
          // If batch fails, try loading individually as fallback
          logger.warn(`⚠️ Batch ${Math.floor(i / batchSize) + 1} failed, trying individual loading...`, error);
          for (const assetPath of batch) {
            try {
              await Assets.load(assetPath);
            } catch (err) {
              logger.warn(`⚠️ Failed to load: ${assetPath}`, err);
            }
          }
          await this.yieldToMainThread();
        }
      }
      
      logger.info('✅ All deferred assets loaded in background');
    } catch (error) {
      logger.warn('⚠️ Some deferred assets failed to load:', error);
    }
  }

  // Alternative method for loading assets individually with better error handling
  async preloadWithIndividualLoading(): Promise<void> {
    if (this.preloadPromise) {
      return this.preloadPromise;
    }
    this.preloadPromise = (async () => {
      logger.info('🔄 Starting individual asset preloading...');
      
      const loadPromises = ALL_ASSETS.map(async (assetPath: string, index: number) => {
        try {
          await Assets.load(assetPath);
          this.loadedCount++;
          this.updateProgress();
          logger.info(`✅ Loaded ${assetPath} (${this.loadedCount}/${this.totalCount})`);
        } catch (error) {
          logger.warn(`⚠️ Failed to load ${assetPath}:`, error);
          // Continue loading other assets even if one fails
          this.loadedCount++;
          this.updateProgress();
        }
      });

      try {
        await Promise.allSettled(loadPromises);
        logger.info('✅ Asset preloading completed');
        
        if (this.onComplete) {
          this.onComplete();
        }
      } catch (error) {
        logger.error('❌ Asset preloading failed:', error);
        
        if (this.onError) {
          this.onError(error as Error);
        }
      }
    })();
    return this.preloadPromise;
  }
}

// Export singleton instance
export const assetPreloader = new AssetPreloader();
