// @ts-nocheck
// Memory Manager Module
// Handles PIXI.js memory management and cleanup

import gameState from './game-state.js';
import { Container } from 'pixi.js';
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
  private stateUnsubscribers: Array<() => void>;
  private stateCleanupTimeout: ReturnType<typeof setTimeout> | null;

  constructor() {
    this.trackedObjects = new Map();
    this.textureCache = new Set();
    this.isMonitoring = false;
    this.cleanupInterval = null;
    this.stateUnsubscribers = [];
    this.stateCleanupTimeout = null;
  }
  
  // Initialize memory manager
  init(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    
    // Cleanup is lifecycle-driven. A fixed 30-second wakeup used to scan empty
    // registries during play and was not tied to a safe renderer boundary.
    this.setupStateSubscriptions();
    
    logger.info('Memory Manager initialized', 'memory-manager');
  }
  
  // Setup state subscriptions
  private setupStateSubscriptions(): void {
    this.teardownStateSubscriptions();
    // Game state changes
    const unsubscribe = gameState.subscribe('isGameActive', (isActive: boolean) => {
      if (!isActive) {
        // Game ended, perform cleanup
        if (this.stateCleanupTimeout) clearTimeout(this.stateCleanupTimeout);
        this.stateCleanupTimeout = setTimeout(() => {
          this.stateCleanupTimeout = null;
          this.performCleanup();
        }, 1000);
      }
    });
    this.stateUnsubscribers.push(unsubscribe);
  }

  private teardownStateSubscriptions(): void {
    if (this.stateCleanupTimeout) {
      clearTimeout(this.stateCleanupTimeout);
      this.stateCleanupTimeout = null;
    }
    this.stateUnsubscribers.splice(0).forEach((unsubscribe) => {
      try { unsubscribe(); } catch {}
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
      
      // DOM images are owned by their feature lifecycle/pools. Never remove
      // generic <img> nodes here: an image can be incomplete while it is still
      // a valid in-flight loading asset required by the current screen.
      
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
      } else if (obj?.destroyed === true) {
        // Object already destroyed elsewhere
        toRemove.push(name);
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
    if (!this.isMonitoring && !this.cleanupInterval) {
      this.teardownStateSubscriptions();
      return;
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Perform final cleanup while monitoring is still enabled. Previously the
    // flag was cleared first, making performCleanup() an immediate no-op.
    this.performCleanup();
    this.isMonitoring = false;
    this.teardownStateSubscriptions();
    
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
