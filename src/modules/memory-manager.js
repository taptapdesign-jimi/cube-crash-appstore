// Memory Manager Module
// Handles PIXI.js memory management and cleanup

import gameState from './game-state.js';

class MemoryManager {
  constructor() {
    this.trackedObjects = new Map();
    this.textureCache = new Set();
    this.isMonitoring = false;
    this.cleanupInterval = null;
  }
  
  // Initialize memory manager
  init() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    
    // Start periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 30000); // Every 30 seconds
    
    // Setup state subscriptions
    this.setupStateSubscriptions();
    
    console.log('✅ Memory Manager initialized');
  }
  
  // Setup state subscriptions
  setupStateSubscriptions() {
    // Game state changes
    gameState.subscribe('isGameActive', (isActive) => {
      if (!isActive) {
        // Game ended, perform cleanup
        setTimeout(() => this.performCleanup(), 1000);
      }
    });
  }
  
  // Register object for tracking
  registerObject(name, obj) {
    if (!this.isMonitoring) return;
    
    this.trackedObjects.set(name, new WeakRef(obj));
    console.log(`🧠 Registered object for memory tracking: ${name}`);
  }
  
  // Unregister object
  unregisterObject(name) {
    if (!this.isMonitoring) return;
    
    this.trackedObjects.delete(name);
    console.log(`🧠 Unregistered object from memory tracking: ${name}`);
  }
  
  // Register texture for tracking
  registerTexture(texture) {
    if (!texture || !texture.baseTexture) return;
    
    this.textureCache.add(texture);
    console.log(`🧠 Registered texture for memory tracking`);
  }
  
  // Perform memory cleanup
  performCleanup() {
    if (!this.isMonitoring) return;
    
    try {
      // Clean up tracked objects
      this.cleanupTrackedObjects();
      
      // Clean up PIXI textures
      this.cleanupPIXITextures();
      
      // Force garbage collection if available
      this.forceGarbageCollection();
      
      console.log('🧠 Memory cleanup completed');
      
    } catch (error) {
      console.error('❌ Memory cleanup failed:', error);
    }
  }
  
  // Clean up tracked objects
  cleanupTrackedObjects() {
    const toRemove = [];
    
    for (const [name, weakRef] of this.trackedObjects) {
      const obj = weakRef.deref();
      if (!obj) {
        // Object was garbage collected
        toRemove.push(name);
      } else if (obj.destroy && typeof obj.destroy === 'function') {
        // Object has destroy method, call it
        try {
          obj.destroy();
          toRemove.push(name);
        } catch (error) {
          console.warn(`⚠️ Failed to destroy object ${name}:`, error);
        }
      }
    }
    
    // Remove cleaned up objects
    toRemove.forEach(name => {
      this.trackedObjects.delete(name);
    });
    
    if (toRemove.length > 0) {
      console.log(`🧠 Cleaned up ${toRemove.length} tracked objects`);
    }
  }
  
  // Clean up PIXI textures
  cleanupPIXITextures() {
    if (!window.PIXI || !window.PIXI.utils) return;
    
    try {
      // Clear texture cache
      window.PIXI.utils.clearTextureCache();
      
      // Clean up base textures
      const baseTextureCache = window.PIXI.utils.BaseTextureCache;
      const toRemove = [];
      
      for (const [key, baseTexture] of Object.entries(baseTextureCache)) {
        if (baseTexture && baseTexture.textureCacheIds.length === 0) {
          baseTexture.destroy();
          toRemove.push(key);
        }
      }
      
      // Remove destroyed base textures
      toRemove.forEach(key => {
        delete baseTextureCache[key];
      });
      
      if (toRemove.length > 0) {
        console.log(`🧠 Cleaned up ${toRemove.length} base textures`);
      }
      
    } catch (error) {
      console.warn('⚠️ PIXI texture cleanup failed:', error);
    }
  }
  
  // Force garbage collection
  forceGarbageCollection() {
    if (window.gc && typeof window.gc === 'function') {
      try {
        window.gc();
        console.log('🧠 Forced garbage collection');
      } catch (error) {
        console.warn('⚠️ Garbage collection failed:', error);
      }
    }
  }
  
  // Clean up specific PIXI container
  cleanupPIXIContainer(container) {
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
      
      console.log('🧠 Cleaned up PIXI container');
      
    } catch (error) {
      console.error('❌ PIXI container cleanup failed:', error);
    }
  }
  
  // Clean up main PIXI app
  cleanupMainApp() {
    if (!window.app) return;
    
    try {
      console.log('🧠 Cleaning up main PIXI app...');
      
      // Clean up stage
      if (window.app.stage) {
        this.cleanupPIXIContainer(window.app.stage);
      }
      
      // Destroy the app
      window.app.destroy(true, {
        children: true,
        texture: true,
        baseTexture: true
      });
      
      // Clear reference
      window.app = null;
      
      console.log('✅ Main PIXI app cleaned up');
      
    } catch (error) {
      console.error('❌ Main PIXI app cleanup failed:', error);
    }
  }
  
  // Get memory usage info
  getMemoryInfo() {
    const info = {
      trackedObjects: this.trackedObjects.size,
      textureCache: this.textureCache.size,
      isMonitoring: this.isMonitoring
    };
    
    // Add browser memory info if available
    if (performance.memory) {
      info.usedJSHeapSize = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
      info.totalJSHeapSize = Math.round(performance.memory.totalJSHeapSize / 1024 / 1024);
      info.jsHeapSizeLimit = Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024);
    }
    
    return info;
  }
  
  // Stop monitoring
  stop() {
    this.isMonitoring = false;
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Perform final cleanup
    this.performCleanup();
    
    console.log('🧠 Memory Manager stopped');
  }
  
  // Destroy memory manager
  destroy() {
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
