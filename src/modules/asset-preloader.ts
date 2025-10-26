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
  './assets/logo-cube-crash.png',
  './assets/logo.png',
  
  // Core game assets
  './assets/tile.png',
  './assets/tile_numbers.png',
  './assets/tile_numbers2.png', 
  './assets/tile_numbers3.png',
  './assets/tile_numbers4.png',
  './assets/wild.png',
  
  // Other UI assets
  './assets/stats-trophy.png',
  './assets/collectibles-box.png',
  './assets/settings-slider.png',
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
  './assets/collectible-stats.png',
  './assets/combo-icon.png',
  './assets/combo-stats.png',
  './assets/cubes-cracked.png',
  './assets/highscore-icon.png',
  './assets/restart-icon.png',
  './assets/resume-game.png',
  './assets/settings-icon.png',
  './assets/settings-slider.png',
  './assets/stats-trophy.png',
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

// Add collectibles assets
for (let i = 1; i <= 20; i++) {
  const id = String(i).padStart(2, '0');
  ALL_ASSETS.push(`./assets/colelctibles/common/${id}.png`);
}

for (let i = 21; i <= 25; i++) {
  const id = String(i).padStart(2, '0');
  ALL_ASSETS.push(`./assets/colelctibles/legendary/${id}.png`);
}

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
    const percentage = Math.round((this.loadedCount / this.totalCount) * 100);
    if (this.onProgress) {
      this.onProgress(percentage, this.loadedCount, this.totalCount);
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

  async preloadAll(): Promise<void> {
    if (this.preloadPromise) {
      return this.preloadPromise;
    }
    this.preloadPromise = (async () => {
      logger.info('🔄 Starting asset preloading...');
      
      try {
        // CRITICAL: Filter out problematic FX assets that cause hangs
        const criticalAssets = ALL_ASSETS.filter(asset => {
          // Skip FX assets - load them lazily during gameplay
          if (asset.includes('/fx/boom/')) {
            return false;
          }
          // Include everything else
          return true;
        });
        
        logger.info(`📦 Loading ${criticalAssets.length} critical assets (skipping ${ALL_ASSETS.length - criticalAssets.length} FX assets)`);
        
        // Update total count for progress tracking
        this.totalCount = criticalAssets.length;
        
        // Load critical assets using PIXI Assets with timeout
        const loadPromise = Assets.load(criticalAssets, (progress: number) => {
          this.loadedCount = Math.round(progress * criticalAssets.length);
          this.updateProgress();
        });
        
        // Add timeout to prevent infinite hangs (30 seconds max)
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Asset loading timeout after 30 seconds')), 30000);
        });
        
        await Promise.race([loadPromise, timeoutPromise]);
        
        logger.info('✅ Critical assets preloaded successfully');
        
        // Mark as complete even if some assets failed
        this.loadedCount = this.totalCount;
        this.updateProgress();
        
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
