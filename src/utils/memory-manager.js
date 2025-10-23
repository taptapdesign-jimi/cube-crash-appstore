// iOS-optimized memory management
// Manages memory for App Store submission

class MemoryManager {
  constructor() {
    this.textureCache = new Map();
    this.objectCache = new Map();
    this.eventListeners = new Map();
    this.cleanupCallbacks = [];
    
    // iOS memory limits
    this.limits = {
      maxTextures: 50,
      maxObjects: 100,
      maxEventListeners: 200,
      memoryThreshold: 80 // MB
    };
    
    this.isMonitoring = false;
  }

  // Start memory monitoring
  start() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.monitorMemory();
    
    console.log('💾 Memory management started');
  }

  // Stop memory monitoring
  stop() {
    this.isMonitoring = false;
    console.log('💾 Memory management stopped');
  }

  // Monitor memory usage
  monitorMemory() {
    if (!this.isMonitoring) return;
    
    // Check memory usage every 5 seconds
    setTimeout(() => {
      this.checkMemoryUsage();
      this.monitorMemory();
    }, 5000);
  }

  // Check memory usage
  checkMemoryUsage() {
    if (!performance.memory) return;
    
    const memoryUsage = performance.memory.usedJSHeapSize / 1024 / 1024; // MB
    
    if (memoryUsage > this.limits.memoryThreshold) {
      console.warn(`⚠️ High memory usage: ${memoryUsage.toFixed(2)}MB`);
      this.cleanup();
    }
  }

  // Register texture for cleanup
  registerTexture(name, texture) {
    this.textureCache.set(name, {
      texture,
      timestamp: Date.now(),
      size: this.estimateTextureSize(texture)
    });
    
    // Cleanup old textures if limit exceeded
    if (this.textureCache.size > this.limits.maxTextures) {
      this.cleanupOldTextures();
    }
  }

  // Register object for cleanup
  registerObject(name, object) {
    this.objectCache.set(name, {
      object,
      timestamp: Date.now(),
      type: object.constructor.name
    });
    
    // Cleanup old objects if limit exceeded
    if (this.objectCache.size > this.limits.maxObjects) {
      this.cleanupOldObjects();
    }
  }

  // Register event listener for cleanup
  registerEventListener(element, event, handler) {
    const key = `${element.constructor.name}_${event}_${Date.now()}`;
    this.eventListeners.set(key, {
      element,
      event,
      handler,
      timestamp: Date.now()
    });
    
    // Cleanup old listeners if limit exceeded
    if (this.eventListeners.size > this.limits.maxEventListeners) {
      this.cleanupOldEventListeners();
    }
  }

  // Register cleanup callback
  registerCleanupCallback(callback) {
    this.cleanupCallbacks.push(callback);
  }

  // Estimate texture size
  estimateTextureSize(texture) {
    if (!texture || !texture.width || !texture.height) return 0;
    
    // Rough estimate: width * height * 4 bytes (RGBA)
    return texture.width * texture.height * 4;
  }

  // Cleanup old textures
  cleanupOldTextures() {
    const textures = Array.from(this.textureCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = textures.slice(0, Math.floor(textures.length / 2));
    
    toRemove.forEach(([name, data]) => {
      try {
        if (data.texture && data.texture.destroy) {
          data.texture.destroy();
        }
        this.textureCache.delete(name);
        console.log(`🗑️ Cleaned up texture: ${name}`);
      } catch (error) {
        console.warn(`⚠️ Failed to cleanup texture ${name}:`, error);
      }
    });
  }

  // Cleanup old objects
  cleanupOldObjects() {
    const objects = Array.from(this.objectCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = objects.slice(0, Math.floor(objects.length / 2));
    
    toRemove.forEach(([name, data]) => {
      try {
        if (data.object && data.object.destroy) {
          data.object.destroy();
        } else if (data.object && data.object.remove) {
          data.object.remove();
        }
        this.objectCache.delete(name);
        console.log(`🗑️ Cleaned up object: ${name}`);
      } catch (error) {
        console.warn(`⚠️ Failed to cleanup object ${name}:`, error);
      }
    });
  }

  // Cleanup old event listeners
  cleanupOldEventListeners() {
    const listeners = Array.from(this.eventListeners.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = listeners.slice(0, Math.floor(listeners.length / 2));
    
    toRemove.forEach(([key, data]) => {
      try {
        data.element.removeEventListener(data.event, data.handler);
        this.eventListeners.delete(key);
        console.log(`🗑️ Cleaned up event listener: ${key}`);
      } catch (error) {
        console.warn(`⚠️ Failed to cleanup event listener ${key}:`, error);
      }
    });
  }

  // Main cleanup function
  cleanup() {
    console.log('🧹 Starting memory cleanup...');
    
    // Run cleanup callbacks
    this.cleanupCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.warn('⚠️ Cleanup callback failed:', error);
      }
    });
    
    // Cleanup textures
    this.cleanupOldTextures();
    
    // Cleanup objects
    this.cleanupOldObjects();
    
    // Cleanup event listeners
    this.cleanupOldEventListeners();
    
    // Force garbage collection if available
    if (window.gc) {
      try {
        window.gc();
        console.log('✅ Garbage collection triggered');
      } catch (error) {
        console.warn('⚠️ Failed to trigger garbage collection:', error);
      }
    }
    
    console.log('✅ Memory cleanup completed');
  }

  // Force cleanup everything
  forceCleanup() {
    console.log('🧹 Force cleaning up all resources...');
    
    // Cleanup all textures
    this.textureCache.forEach((data, name) => {
      try {
        if (data.texture && data.texture.destroy) {
          data.texture.destroy();
        }
      } catch (error) {
        console.warn(`⚠️ Failed to cleanup texture ${name}:`, error);
      }
    });
    this.textureCache.clear();
    
    // Cleanup all objects
    this.objectCache.forEach((data, name) => {
      try {
        if (data.object && data.object.destroy) {
          data.object.destroy();
        } else if (data.object && data.object.remove) {
          data.object.remove();
        }
      } catch (error) {
        console.warn(`⚠️ Failed to cleanup object ${name}:`, error);
      }
    });
    this.objectCache.clear();
    
    // Cleanup all event listeners
    this.eventListeners.forEach((data, key) => {
      try {
        data.element.removeEventListener(data.event, data.handler);
      } catch (error) {
        console.warn(`⚠️ Failed to cleanup event listener ${key}:`, error);
      }
    });
    this.eventListeners.clear();
    
    // Run cleanup callbacks
    this.cleanupCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.warn('⚠️ Cleanup callback failed:', error);
      }
    });
    
    console.log('✅ Force cleanup completed');
  }

  // Get memory statistics
  getStats() {
    return {
      textureCount: this.textureCache.size,
      objectCount: this.objectCache.size,
      eventListenerCount: this.eventListeners.size,
      cleanupCallbackCount: this.cleanupCallbacks.length,
      memoryUsage: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) : 0,
      isHealthy: this.isHealthy()
    };
  }

  // Check if memory usage is healthy
  isHealthy() {
    const memoryUsage = performance.memory ? performance.memory.usedJSHeapSize / 1024 / 1024 : 0;
    
    return (
      this.textureCache.size <= this.limits.maxTextures &&
      this.objectCache.size <= this.limits.maxObjects &&
      this.eventListeners.size <= this.limits.maxEventListeners &&
      memoryUsage <= this.limits.memoryThreshold
    );
  }

  // Reset all caches
  reset() {
    this.forceCleanup();
    this.cleanupCallbacks = [];
  }
}

// Create global memory manager instance
const memoryManager = new MemoryManager();

// Export for use in modules
export default memoryManager;
export { MemoryManager };
