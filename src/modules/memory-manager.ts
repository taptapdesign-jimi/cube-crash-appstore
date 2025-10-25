// Memory Manager Module
// Handles PIXI.js memory management and cleanup

import gameState from './game-state.js';
import { container } from '../core/dependency-injection.js';
import { Application, Container } from 'pixi.js';
import { logger } from '../core/logger.js';

// Type definitions
interface TrackedObject {
  destroy?: () => void;
}

interface Texture {
  baseTexture?: {
    textureCacheIds?: string[];
    destroy?: () => void;
  };
}

interface MemoryInfo {
  trackedObjects: number;
  textureCache: number;
  isMonitoring: boolean;
  usedJSHeapSize?: number;
  totalJSHeapSize?: number;
  jsHeapSizeLimit?: number;
}

// Window interface is now defined in src/types/window.d.ts

class MemoryManager {
  private trackedObjects: Map<string, any>;
  private textureCache: Set<Texture>;
  private isMonitoring: boolean;
  private cleanupInterval: NodeJS.Timeout | null;

  constructor() {
    this.trackedObjects = new Map();
    this.textureCache = new Set();
    this.isMonitoring = false;
    this.cleanupInterval = null;
  }
  
  // Initialize memory manager
  init(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    
    // Start periodic cleanup with longer interval to prevent performance issues
    this.cleanupInterval = setInterval(() => {
      if (this.isMonitoring) {
        this.performCleanup();
      }
    }, 120000); // Every 2 minutes (optimized for App Store)
    
    // Setup state subscriptions
    this.setupStateSubscriptions();
    
    logger.info('Memory Manager initialized', 'memory-manager');
  }
  
  // Setup state subscriptions
  private setupStateSubscriptions(): void {
    // Game state changes
    gameState.subscribe('isGameActive', (isActive: boolean) => {
      if (!isActive) {
        // Game ended, perform cleanup
        setTimeout(() => this.performCleanup(), 1000);
      }
    });
  }
  
  // Register object for tracking
  registerObject(name: string, obj: TrackedObject): void {
    if (!this.isMonitoring) return;
    
    this.trackedObjects.set(name, obj);
    logger.debug(`Registered object for memory tracking: ${name}`, 'memory-manager');
  }
  
  // Unregister object
  unregisterObject(name: string): void {
    if (!this.isMonitoring) return;
    
    this.trackedObjects.delete(name);
    logger.debug(`Unregistered object from memory tracking: ${name}`, 'memory-manager');
  }
  
  // Register texture for tracking
  registerTexture(texture: Texture): void {
    if (!texture || !texture.baseTexture) return;
    
    this.textureCache.add(texture);
    logger.debug('Registered texture for memory tracking', 'memory-manager');
  }
  
  // Perform memory cleanup
  performCleanup(): void {
    if (!this.isMonitoring) return;
    
    try {
      // Clean up tracked objects
      this.cleanupTrackedObjects();
      
      // Clean up PIXI textures
      this.cleanupPIXITextures();
      
      // Clean up unused images
      this.cleanupUnusedImages();
      
      // Force garbage collection if available
      this.forceGarbageCollection();
      
      logger.info('Memory cleanup completed', 'memory-manager');
      
    } catch (error) {
      logger.error('Memory cleanup failed', 'memory-manager', error);
    }
  }
  
  // Clean up tracked objects
  private cleanupTrackedObjects(): void {
    const toRemove: string[] = [];
    
    for (const [name, obj] of this.trackedObjects) {
      if (!obj) {
        // Object was garbage collected
        toRemove.push(name);
      } else if (obj.destroy && typeof obj.destroy === 'function') {
        // Object has destroy method, call it
        try {
          obj.destroy();
          toRemove.push(name);
        } catch (error) {
          logger.warn(`Failed to destroy object ${name}`, 'memory-manager', error);
        }
      }
    }
    
    // Remove cleaned up objects
    toRemove.forEach(name => {
      this.trackedObjects.delete(name);
    });
    
    if (toRemove.length > 0) {
      logger.info(`Cleaned up ${toRemove.length} tracked objects`, 'memory-manager');
    }
  }
  
  // Clean up PIXI textures
  private cleanupPIXITextures(): void {
    if (!window.PIXI || !window.PIXI.utils) return;
    
    try {
      // Clear texture cache
      window.PIXI.utils.clearTextureCache();
      
      // Clean up base textures
      const baseTextureCache = window.PIXI.utils.BaseTextureCache;
      const toRemove: string[] = [];
      
      for (const [key, baseTexture] of Object.entries(baseTextureCache)) {
        if (baseTexture && (!baseTexture.textureCacheIds || baseTexture.textureCacheIds.length === 0)) {
          baseTexture.destroy();
          toRemove.push(key);
        }
      }
      
      // Remove destroyed base textures
      toRemove.forEach(key => {
        delete baseTextureCache[key];
      });
      
      if (toRemove.length > 0) {
        logger.info(`Cleaned up ${toRemove.length} base textures`, 'memory-manager');
      }
      
    } catch (error) {
      logger.warn('PIXI texture cleanup failed', 'memory-manager', error);
    }
  }
  
  // Clean up unused images
  private cleanupUnusedImages(): void {
    try {
      // Remove unused images from DOM
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        if (!img.complete || img.naturalWidth === 0) {
          img.remove();
        }
      });
      
      // Clear image cache safely
      try {
        if (window.Image && window.Image.prototype) {
          // Reset image loading safely
          const imgProto = Image.prototype;
          if (imgProto && typeof imgProto.src !== 'undefined') {
            imgProto.src = '';
          }
        }
      } catch (protoError) {
        // Ignore prototype errors
        logger.debug('Image prototype cleanup skipped', 'memory-manager');
      }
      
      logger.info('Cleaned up unused images', 'memory-manager');
      
    } catch (error) {
      logger.warn('Image cleanup failed', 'memory-manager', error);
    }
  }
  
  // Force garbage collection
  private forceGarbageCollection(): void {
    if (window.gc && typeof window.gc === 'function') {
      try {
        window.gc();
        logger.debug('Forced garbage collection', 'memory-manager');
      } catch (error) {
        logger.warn('Garbage collection failed', 'memory-manager', error);
      }
    }
  }
  
  // Clean up specific PIXI container
  cleanupPIXIContainer(container: Container): void {
    if (!container || !container.destroy) return;
    
    try {
      // Remove all children recursively
      while (container.children.length > 0) {
        const child = container.children[0];
        this.cleanupPIXIContainer(child);
        container.removeChild(child);
      }
      
      // Remove event listeners
      if (container.removeAllListeners) {
        container.removeAllListeners();
      }
      
      // Destroy the container
      container.destroy({
        children: true,
        texture: false,
        baseTexture: false
      });
      
      logger.info('Cleaned up PIXI container', 'memory-manager');
      
    } catch (error) {
      logger.error('PIXI container cleanup failed', 'memory-manager', error);
    }
  }
  
  // Clean up main PIXI app
  cleanupMainApp(): void {
    const app = container.get('app');
    if (!app) return;
    
    try {
      logger.info('Cleaning up main PIXI app', 'memory-manager');
      
      // Clean up stage
      if (app.stage) {
        this.cleanupPIXIContainer(app.stage);
      }
      
      // Destroy the app
      app.destroy(true, {
        children: true,
        texture: true,
        baseTexture: true
      });
      
      // Clear reference
      container.set('app', null);
      
      logger.info('Main PIXI app cleaned up', 'memory-manager');
      
    } catch (error) {
      logger.error('Main PIXI app cleanup failed', 'memory-manager', error);
    }
  }
  
  // Get memory usage info
  getMemoryInfo(): MemoryInfo {
    const info: MemoryInfo = {
      trackedObjects: this.trackedObjects.size,
      textureCache: this.textureCache.size,
      isMonitoring: this.isMonitoring
    };
    
    // Add browser memory info if available
    if (performance.memory) {
      info.usedJSHeapSize = Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024);
      info.totalJSHeapSize = Math.round((performance as any).memory.totalJSHeapSize / 1024 / 1024);
      info.jsHeapSizeLimit = Math.round((performance as any).memory.jsHeapSizeLimit / 1024 / 1024);
    }
    
    return info;
  }
  
  // Stop monitoring
  stop(): void {
    this.isMonitoring = false;
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Perform final cleanup
    this.performCleanup();
    
    logger.info('Memory Manager stopped', 'memory-manager');
  }
  
  // Destroy memory manager
  destroy(): void {
    this.stop();
    this.trackedObjects.clear();
    this.textureCache.clear();
  }
}

// Create singleton instance
const memoryManager = new MemoryManager();

// Export for use in other modules
export default memoryManager;

// Export class for testing
export { MemoryManager };

