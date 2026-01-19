// @ts-nocheck
// src/modules/asset-preloader.ts
// Comprehensive asset preloader for all game assets

import { Assets } from 'pixi.js';
import { logger } from '../core/logger.js';

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
  logger.warn('🔊 Assets.addParser not available, skipping audio parser');
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
  './assets/logo.png',
  
  // Logo addons
  './assets/logo addons/gore ljevo shards.png',
  './assets/logo addons/shards gore desno.png',
  './assets/home-shadow.png',
  './assets/home-shadow@2x.png',
  './assets/home-shadow@3x.png',
  
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
  './assets/mystery-box.png',
  './assets/gold-coin.png',
  './assets/potion.png',
  './assets/melted-dice.png',
  './assets/star-slider.png',
  './assets/ripple.png',
  './assets/leaf light.png',
  
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
  './assets/modals/heart-life.png',
  './assets/modals/heart-life@2x.png',
  './assets/modals/heart-life@3x.png',
  './assets/modals/heart-life-empty.png',
  './assets/modals/heart-life-empty@2x.png',
  './assets/modals/heart-life-empty@3x.png',
  './assets/modals/paper.png',
  './assets/modals/paper@2x.png',
  './assets/modals/paper@3x.png',
  './assets/hud/score-hud.png',
  './assets/restart-icon.png',
  './assets/resume-game.png',
  './assets/settings-icon.png',
  './assets/settings-slider.png',
  './assets/journey-map-homepage.png',
  './assets/stop.png',
  './assets/time-icon.png',
  './assets/unpause-icon.png',
  './assets/wild-stats.png',
  './assets/wild.png',
  
  // Fonts
  './assets/fonts/LTCrow-Bold.ttf',
  './assets/fonts/LTCrow-ExtraBold.ttf',
  './assets/fonts/LTCrow-Medium.ttf',
  './assets/fonts/LTCrow-Regular.ttf',
  './assets/fonts/LTCrow-SemiBold.ttf',
  
  // Audio - skip for now to avoid PIXI.js parsing issues
  // './assets/explode.mp3',
  
  // Video
  './assets/swipe.MP4',
  
  // FX assets
  './assets/fx/boom/boom_0001.png',
  './assets/fx/boom/boom_0002.png',
  './assets/fx/boom/boom_0003.png',
  './assets/fx/boom/boom_0004.png',
  './assets/fx/boom/boom_0005.png',
  './assets/fx/boom/boom_0006.png',
  './assets/fx/boom/boom_0007.png',
  './assets/fx/boom/boom_0008.png',
  './assets/fx/boom/boom_0009.png',
  './assets/fx/boom/boom_0010.png',
  './assets/fx/boom/boom_0011.png',
  './assets/fx/boom/boom_0012.png',
  './assets/fx/boom/boom_0013.png',
  './assets/fx/boom/boom_0014.png',
  './assets/fx/boom/boom_0015.png',
  './assets/fx/boom/boom_0016.png',
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
  './assets/wild.png',
  
  // Wild star assets (needed immediately when wild cubes spawn)
  './assets/small-star.png',
  './assets/small-star@2x.png',
  './assets/small-star@3x.png',
  
  // Essential UI (first frame only)
  './assets/close-button.png',
  './assets/close-icon.png',
  './assets/stop.png',
  
  // Bottom sheet icons (preload to prevent blurry loading when modals open)
  './assets/highscore-icon.png',
  './assets/highscore-icon@2x.png',
  './assets/highscore-icon@3x.png',
  './assets/cubes-cracked.png',
  './assets/cubes-cracked@2x.png',
  './assets/cubes-cracked@3x.png',
  './assets/modals/heart-life.png',
  './assets/modals/heart-life@2x.png',
  './assets/modals/heart-life@3x.png',
  './assets/modals/heart-life-empty.png',
  './assets/modals/heart-life-empty@2x.png',
  './assets/modals/heart-life-empty@3x.png',
  './assets/modals/paper.png',
  './assets/modals/paper@2x.png',
  './assets/modals/paper@3x.png',
  
  // One font only
  './assets/fonts/LTCrow-Regular.ttf',
  
  // Collectibles placeholder images (needed for collectibles screen)
  './assets/colelctibles/common back.png',
  './assets/colelctibles/legendary back.png',
  // NOTE: Collectibles card images are loaded in background via preloadCollectiblesImages()
  // They are NOT in CRITICAL_ASSETS to keep preload fast
];

// Add collectibles assets to ALL_ASSETS
for (let i = 1; i <= 20; i++) {
  const id = String(i).padStart(2, '0');
  ALL_ASSETS.push(`./assets/colelctibles/common/${id}.png`);
}

for (let i = 21; i <= 26; i++) {
  const id = String(i).padStart(2, '0');
  ALL_ASSETS.push(`./assets/colelctibles/legendary/${id}.png`);
}

// DEFERRED ASSETS: Load these in background after critical
const DEFERRED_ASSETS: string[] = ALL_ASSETS.filter(asset => !CRITICAL_ASSETS.includes(asset));

export class AssetPreloader {
  private loadedCount: number = 0;
  private totalCount: number = ALL_ASSETS.length;
  private onProgress: ProgressCallback | null = null;
  private onComplete: CompleteCallback | null = null;
  private onError: ErrorCallback | null = null;
  private preloadPromise: Promise<void> | null = null;

  constructor() {
    this.loadedCount = 0;
    this.totalCount = ALL_ASSETS.length;
    this.onProgress = null;
    this.onComplete = null;
    this.onError = null;
    this.preloadPromise = null;
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
      // 🔥 CRITICAL: Journey screen assets (must be preloaded for instant Journey screen load)
      './assets/journey assets/1-17bg.png',
      './assets/journey assets/orange-ribbon.png',
      './assets/journey assets/orange-ribbon@2x.png',
      './assets/journey assets/orange-ribbon@3x.png',
      './assets/journey assets/heart-nav.png',
      './assets/journey assets/heart-nav@2x.png',
      './assets/journey assets/heart-nav@3x.png',
      './assets/colelctibles/journey-card-empty.png',
      './assets/colelctibles/common back.png',
    ];
    
    logger.info(`🖼️ Preloading ${htmlImages.length} HTML images for homepage slider...`);
    
    const loadPromises = htmlImages.map((src: string) => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          logger.debug(`✅ HTML image loaded: ${src}`);
          resolve();
        };
        img.onerror = () => {
          logger.warn(`⚠️ HTML image failed: ${src}`);
          resolve(); // Don't block on errors
        };
        img.src = src;
      });
    });
    
    await Promise.allSettled(loadPromises);
    logger.debug('✅ All HTML images preloaded');
  }

  // 🔥 CRITICAL: Preload collectibles card images through native Image objects for browser cache
  // This ensures collectibles screen loads instantly when opened (no delay)
  // Uses browser cache - if images are already cached, they load instantly
  async preloadCollectiblesImages(): Promise<void> {
    // Check if already preloaded (browser cache will handle subsequent loads)
    const cacheKey = 'collectibles_images_preloaded';
    const wasPreloaded = localStorage.getItem(cacheKey) === 'true';
    
    if (wasPreloaded) {
      logger.info('🎁 Collectibles images already preloaded (using browser cache)');
      // Still verify critical images are in cache (fast check)
      const criticalImages = [
        './assets/colelctibles/common/01.png',
        './assets/colelctibles/common back.png'
      ];
      await Promise.allSettled(criticalImages.map(src => this.verifyImageInCache(src)));
      return;
    }
    
    const collectiblesImages: string[] = [];
    
    // Add all common card images (1-20)
    for (let i = 1; i <= 20; i++) {
      const id = String(i).padStart(2, '0');
      collectiblesImages.push(`./assets/colelctibles/common/${id}.png`);
    }
    
    // Add all legendary card images (21-26)
    for (let i = 21; i <= 26; i++) {
      const id = String(i).padStart(2, '0');
      collectiblesImages.push(`./assets/colelctibles/legendary/${id}.png`);
    }
    
    // Add placeholder images
    collectiblesImages.push('./assets/colelctibles/common back.png');
    collectiblesImages.push('./assets/colelctibles/legendary back.png');
    
    logger.info(`🎁 Preloading ${collectiblesImages.length} collectibles images for instant screen load...`);
    
    // Load all images in parallel for fastest loading
    const loadPromises = collectiblesImages.map((src: string) => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          // Image loaded successfully, now in browser cache
          resolve();
        };
        img.onerror = () => {
          // Don't block on errors, but log them
          logger.warn(`⚠️ Collectibles image failed: ${src}`);
          resolve();
        };
        img.src = src;
      });
    });
    
    await Promise.allSettled(loadPromises);
    localStorage.setItem(cacheKey, 'true');
    logger.info(`✅ All ${collectiblesImages.length} collectibles images preloaded (browser cache ready)`);
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
        './assets/colelctibles/common/01.png',
        './assets/colelctibles/journey-card-empty.png'
      ];
      await Promise.allSettled(criticalImages.map(src => this.verifyImageInCache(src)));
      return;
    }
    
    const journeyImages: string[] = [];
    
    // Journey background and UI elements
    journeyImages.push('./assets/journey assets/1-17bg.png');
    journeyImages.push('./assets/journey assets/orange-ribbon.png');
    journeyImages.push('./assets/journey assets/orange-ribbon@2x.png');
    journeyImages.push('./assets/journey assets/orange-ribbon@3x.png');
    journeyImages.push('./assets/journey assets/heart-nav.png');
    journeyImages.push('./assets/journey assets/heart-nav@2x.png');
    journeyImages.push('./assets/journey assets/heart-nav@3x.png');
    
    // Journey card images (all 16 boards use common collectibles 01-16)
    for (let i = 1; i <= 16; i++) {
      const id = String(i).padStart(2, '0');
      journeyImages.push(`./assets/colelctibles/common/${id}.png`);
    }
    
    // Journey placeholder images
    journeyImages.push('./assets/colelctibles/journey-card-empty.png');
    journeyImages.push('./assets/colelctibles/common back.png');
    
    logger.info(`🗺️ Preloading ${journeyImages.length} Journey screen images for instant load...`);
    
    // Load all images in parallel for fastest loading
    const loadPromises = journeyImages.map((src: string) => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          // Image loaded successfully, now in browser cache
          resolve();
        };
        img.onerror = () => {
          // Don't block on errors, but log them
          logger.warn(`⚠️ Journey image failed: ${src}`);
          resolve();
        };
        img.src = src;
      });
    });
    
    await Promise.allSettled(loadPromises);
    localStorage.setItem(cacheKey, 'true');
    logger.info(`✅ All ${journeyImages.length} Journey screen images preloaded (browser cache ready)`);
  }

  async preloadAll(): Promise<void> {
    if (this.preloadPromise) {
      return this.preloadPromise;
    }
    this.preloadPromise = (async () => {
      logger.info('🔄 Starting asset preloading (critical assets first)...');
      
      try {
        // Set total count to critical assets only for progress tracking
        this.totalCount = CRITICAL_ASSETS.length;
        this.loadedCount = 0;
        
        logger.debug(`📦 Loading ${CRITICAL_ASSETS.length} critical assets (deferring ${DEFERRED_ASSETS.length} assets)`);
        
        // 🔥 CRITICAL: Register assets with Assets.add() BEFORE loading
        // This ensures Assets.get() can find them later by the same path
        CRITICAL_ASSETS.forEach((assetPath: string) => {
          try {
            Assets.add({ alias: assetPath, src: assetPath });
          } catch (err) {
            // Ignore if already added
          }
        });
        
        // 🔥 OPTIMIZED: Load assets with progress tracking for smooth progress bar
        // Use smaller batches with progress updates for better UX
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
        
        // Use smaller batches for better progress tracking and faster perceived loading
        const batchSize = isIOS ? 8 : (isMobile ? 6 : 10);
        
        logger.debug(`📦 Loading ${CRITICAL_ASSETS.length} critical assets in batches of ${batchSize} (mobile: ${isMobile}, iOS: ${isIOS})`);
        
        // Initial progress update
        this.updateProgress();
        
        let totalLoaded = 0;
        for (let i = 0; i < CRITICAL_ASSETS.length; i += batchSize) {
          const batch = CRITICAL_ASSETS.slice(i, i + batchSize);
          try {
            // Load batch in parallel
            await Assets.load(batch);
            totalLoaded += batch.length;
            this.loadedCount = totalLoaded;
            this.updateProgress(); // Update progress after each batch
            logger.debug(`✅ Loaded batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(CRITICAL_ASSETS.length / batchSize)}: ${batch.length} assets (${totalLoaded}/${this.totalCount})`);
          } catch (error) {
            // If batch fails, try loading individually
            logger.warn(`⚠️ Batch ${Math.floor(i / batchSize) + 1} failed, trying individual loading...`, error);
            for (const assetPath of batch) {
              try {
                await Assets.load(assetPath);
                totalLoaded++;
                this.loadedCount = totalLoaded;
                this.updateProgress(); // Update progress after each asset
              } catch (err) {
                logger.warn(`⚠️ Failed to load: ${assetPath}`, err);
                totalLoaded++; // Count as loaded to prevent blocking
                this.loadedCount = totalLoaded;
                this.updateProgress(); // Update progress even on error
              }
            }
          }
        }
        
        // Ensure progress is at 100% before completing
        this.loadedCount = this.totalCount;
        this.updateProgress();
        
        logger.info(`✅ All critical assets preloaded successfully (${this.loadedCount}/${this.totalCount} loaded)`);
        
        // 🔥 CRITICAL: Preload HTML img tag images (homepage slider) to ensure they're in browser cache
        // This prevents images from disappearing on mobile after preload screen hides
        await this.preloadHTMLImages();
        
        // 🔥 CRITICAL: Preload Journey screen assets (BLOCKING - must complete before preload screen closes)
        // This ensures Journey screen loads instantly when opened, no delay or blank screen
        logger.info('🗺️ Preloading Journey screen assets (blocking)...');
        await this.preloadJourneyAssets();
        logger.info('✅ Journey screen assets preloaded');
        
        // 🔥 CRITICAL: Preload collectibles images (BLOCKING - must complete before preload screen closes)
        // This ensures collectibles screen loads instantly when opened, but doesn't delay initial load
        logger.info('🎁 Preloading collectibles images (blocking)...');
        await this.preloadCollectiblesImages();
        logger.info('✅ Collectibles images preloaded');
        
        // 🔥 CRITICAL: Prepare Journey screen boards (BLOCKING - must complete before preload screen closes)
        // This ensures Journey boards are rendered and ready before user clicks Journey CTA
        logger.info('🗺️ Preparing Journey screen boards (blocking)...');
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
        
        // Load deferred assets in background (non-blocking)
        this.preloadDeferredAssets().catch(err => {
          logger.warn('⚠️ Deferred asset loading failed (non-critical):', err);
        });
        
        // Load audio files directly (not through PIXI.js)
        try {
          await this.loadAudioFiles();
        } catch (err) {
          logger.warn('⚠️ Audio loading failed, continuing...', err);
        }
        
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

  // Load deferred assets in background (non-blocking)
  async preloadDeferredAssets(): Promise<void> {
    logger.info(`🔄 Starting background loading of ${DEFERRED_ASSETS.length} deferred assets...`);
    
    try {
      // 🔥 CRITICAL: Register deferred assets with Assets.add() BEFORE loading
      DEFERRED_ASSETS.forEach((assetPath: string) => {
        try {
          Assets.add({ alias: assetPath, src: assetPath });
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
