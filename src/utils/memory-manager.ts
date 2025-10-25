import { logger } from '../core/logger.js';
// iOS-optimized memory management
// Manages memory for App Store submission

// Type definitions
interface TextureData {
  texture: any;
  timestamp: number;
  size: number;
}

interface ObjectData {
  object: any;
  timestamp: number;
  type: string;
}

interface EventListenerData {
  element: EventTarget;
  event: string;
  handler: EventListener;
  timestamp: number;
}

interface MemoryLimits {
  maxTextures: number;
  maxObjects: number;
  maxEventListeners: number;
  memoryThreshold: number;
}

interface MemoryStats {
  textureCount: number;
  objectCount: number;
  eventListenerCount: number;
  cleanupCallbackCount: number;
  memoryUsage: number;
  isHealthy: boolean;
}

// Global window extensions
declare global {
  interface Window {
    gc?: () => void;
  }
}

class MemoryManager {
  private textureCache: Map<string, TextureData>;
  private objectCache: Map<string, ObjectData>;
  private eventListeners: Map<string, EventListenerData>;
  private cleanupCallbacks: (() => void)[];
  private limits: MemoryLimits;
  private isMonitoring: boolean;

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

  // Initialize memory manager
  init(): void {
    logger.info('💾 Memory manager initialized');
    this.start();
  }

  // Start memory monitoring
  start(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.monitorMemory();
    
    logger.info('💾 Memory management started');
  }

  // Stop memory monitoring
  stop(): void {
    this.isMonitoring = false;
    logger.info('💾 Memory management stopped');
  }

  // Monitor memory usage
  private monitorMemory(): void {
    if (!this.isMonitoring) return;
    
    // Check memory usage every 5 seconds
    setTimeout(() => {
      this.checkMemoryUsage();
      this.monitorMemory();
    }, 5000);
  }

  // Check memory usage
  private checkMemoryUsage(): void {
    if (!(performance as any).memory) return;
    
    const memoryUsage = (performance as any).memory.usedJSHeapSize / 1024 / 1024; // MB
    
    if (memoryUsage > this.limits.memoryThreshold) {
      logger.warn(`⚠️ High memory usage: ${memoryUsage.toFixed(2)}MB`);
      this.cleanup();
    }
  }

  // Register texture for cleanup
  registerTexture(name: string, texture: any): void {
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
  registerObject(name: string, object: any): void {
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
  registerEventListener(element: EventTarget, event: string, handler: EventListener): void {
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
  registerCleanupCallback(callback: () => void): void {
    this.cleanupCallbacks.push(callback);
  }

  // Estimate texture size
  private estimateTextureSize(texture: any): number {
    if (!texture || !texture.width || !texture.height) return 0;
    
    // Rough estimate: width * height * 4 bytes (RGBA)
    return texture.width * texture.height * 4;
  }

  // Cleanup old textures
  private cleanupOldTextures(): void {
    const textures = Array.from(this.textureCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = textures.slice(0, Math.floor(textures.length / 2));
    
    toRemove.forEach(([name, data]) => {
      try {
        if (data.texture && data.texture.destroy) {
          data.texture.destroy();
        }
        this.textureCache.delete(name);
        logger.info(`🗑️ Cleaned up texture: ${name}`);
      } catch (error) {
        logger.warn(`⚠️ Failed to cleanup texture ${name}:`, error);
      }
    });
  }

  // Cleanup old objects
  private cleanupOldObjects(): void {
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
        logger.info(`🗑️ Cleaned up object: ${name}`);
      } catch (error) {
        logger.warn(`⚠️ Failed to cleanup object ${name}:`, error);
      }
    });
  }

  // Cleanup old event listeners
  private cleanupOldEventListeners(): void {
    const listeners = Array.from(this.eventListeners.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = listeners.slice(0, Math.floor(listeners.length / 2));
    
    toRemove.forEach(([key, data]) => {
      try {
        data.element.removeEventListener(data.event, data.handler);
        this.eventListeners.delete(key);
        logger.info(`🗑️ Cleaned up event listener: ${key}`);
      } catch (error) {
        logger.warn(`⚠️ Failed to cleanup event listener ${key}:`, error);
      }
    });
  }

  // Main cleanup function
  cleanup(): void {
    logger.info('🧹 Starting memory cleanup...');
    
    // Run cleanup callbacks
    this.cleanupCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        logger.warn('⚠️ Cleanup callback failed:', error);
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
        logger.info('✅ Garbage collection triggered');
      } catch (error) {
        logger.warn('⚠️ Failed to trigger garbage collection:', error);
      }
    }
    
    logger.info('✅ Memory cleanup completed');
  }

  // Force cleanup everything
  forceCleanup(): void {
    logger.info('🧹 Force cleaning up all resources...');
    
    // Cleanup all textures
    this.textureCache.forEach((data, name) => {
      try {
        if (data.texture && data.texture.destroy) {
          data.texture.destroy();
        }
      } catch (error) {
        logger.warn(`⚠️ Failed to cleanup texture ${name}:`, error);
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
        logger.warn(`⚠️ Failed to cleanup object ${name}:`, error);
      }
    });
    this.objectCache.clear();
    
    // Cleanup all event listeners
    this.eventListeners.forEach((data, key) => {
      try {
        data.element.removeEventListener(data.event, data.handler);
      } catch (error) {
        logger.warn(`⚠️ Failed to cleanup event listener ${key}:`, error);
      }
    });
    this.eventListeners.clear();
    
    // Run cleanup callbacks
    this.cleanupCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        logger.warn('⚠️ Cleanup callback failed:', error);
      }
    });
    
    logger.info('✅ Force cleanup completed');
  }

  // Get memory statistics
  getStats(): MemoryStats {
    return {
      textureCount: this.textureCache.size,
      objectCount: this.objectCache.size,
      eventListenerCount: this.eventListeners.size,
      cleanupCallbackCount: this.cleanupCallbacks.length,
      memoryUsage: (performance as any).memory ? Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024) : 0,
      isHealthy: this.isHealthy()
    };
  }

  // Check if memory usage is healthy
  isHealthy(): boolean {
    const memoryUsage = (performance as any).memory ? (performance as any).memory.usedJSHeapSize / 1024 / 1024 : 0;
    
    return (
      this.textureCache.size <= this.limits.maxTextures &&
      this.objectCache.size <= this.limits.maxObjects &&
      this.eventListeners.size <= this.limits.maxEventListeners &&
      memoryUsage <= this.limits.memoryThreshold
    );
  }

  // Reset all caches
  reset(): void {
    this.forceCleanup();
    this.cleanupCallbacks = [];
  }
}

// Create global memory manager instance
const memoryManager = new MemoryManager();

// Export for use in modules
export default memoryManager;
export { MemoryManager };