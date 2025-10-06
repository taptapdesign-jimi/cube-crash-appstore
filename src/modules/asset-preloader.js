// src/modules/asset-preloader.js
// Comprehensive asset preloader for all game assets

import { Assets } from 'pixi.js';

// All game assets that need to be preloaded
const ALL_ASSETS = [
  // Core game assets
  './assets/tile.png',
  './assets/tile_numbers.png',
  './assets/tile_numbers2.png', 
  './assets/tile_numbers3.png',
  './assets/tile_numbers4.png',
  './assets/wild.png',
  
  // UI assets
  './assets/logo-cube-crash.png',
  './assets/logo.png',
  './assets/crash-cubes-homepage.png',
  './assets/crash-cubes-homepage1.png',
  './assets/crash-cubes-homepage2.png',
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
  './assets/slider-parallax-bg.png',
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
  
  // Audio
  './assets/explode.mp3',
  
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
];

export class AssetPreloader {
  constructor() {
    this.loadedCount = 0;
    this.totalCount = ALL_ASSETS.length;
    this.onProgress = null;
    this.onComplete = null;
    this.onError = null;
  }

  setProgressCallback(callback) {
    this.onProgress = callback;
  }

  setCompleteCallback(callback) {
    this.onComplete = callback;
  }

  setErrorCallback(callback) {
    this.onError = callback;
  }

  updateProgress() {
    const percentage = Math.round((this.loadedCount / this.totalCount) * 100);
    if (this.onProgress) {
      this.onProgress(percentage, this.loadedCount, this.totalCount);
    }
  }

  async preloadAll() {
    console.log('🔄 Starting asset preloading...');
    
    try {
      // Load all assets using PIXI Assets
      await Assets.load(ALL_ASSETS, (progress) => {
        this.loadedCount = Math.round(progress * this.totalCount);
        this.updateProgress();
      });
      
      console.log('✅ All assets preloaded successfully');
      
      if (this.onComplete) {
        this.onComplete();
      }
      
    } catch (error) {
      console.error('❌ Asset preloading failed:', error);
      
      if (this.onError) {
        this.onError(error);
      }
    }
  }

  // Alternative method for loading assets individually with better error handling
  async preloadWithIndividualLoading() {
    console.log('🔄 Starting individual asset preloading...');
    
    const loadPromises = ALL_ASSETS.map(async (assetPath, index) => {
      try {
        await Assets.load(assetPath);
        this.loadedCount++;
        this.updateProgress();
        console.log(`✅ Loaded ${assetPath} (${this.loadedCount}/${this.totalCount})`);
      } catch (error) {
        console.warn(`⚠️ Failed to load ${assetPath}:`, error);
        // Continue loading other assets even if one fails
        this.loadedCount++;
        this.updateProgress();
      }
    });

    try {
      await Promise.allSettled(loadPromises);
      console.log('✅ Asset preloading completed');
      
      if (this.onComplete) {
        this.onComplete();
      }
    } catch (error) {
      console.error('❌ Asset preloading failed:', error);
      
      if (this.onError) {
        this.onError(error);
      }
    }
  }
}

// Export singleton instance
export const assetPreloader = new AssetPreloader();
