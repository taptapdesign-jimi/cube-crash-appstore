// @ts-nocheck
// src/modules/object-pool.ts
// Object pooling for Graphics objects to reduce GC pressure

import { Graphics } from 'pixi.js';
import { gsap } from 'gsap';

/**
 * GraphicsPool - Object pool for Graphics objects
 * Reuses Graphics objects instead of creating/destroying them
 * Reduces GC pauses and improves performance
 */
class GraphicsPool {
  private pool: Graphics[] = [];
  private maxSize: number = 150;
  private created: number = 0;
  private reused: number = 0;

  /**
   * Acquire a Graphics object from the pool
   * If pool is empty, creates a new one
   * @returns {Graphics} Ready-to-use Graphics object
   */
  acquire(): Graphics {
    let g = this.pool.pop();
    
    if (!g) {
      // Pool is empty, create new Graphics object
      g = new Graphics();
      this.created++;
    } else {
      // Reusing from pool
      this.reused++;
    }
    
    // Reset properties to default state
    this.reset(g);
    
    return g;
  }

  /**
   * Release a Graphics object back to the pool
   * Cleans up GSAP animations and resets the object
   * @param {Graphics} g - Graphics object to release
   */
  release(g: Graphics): void {
    if (!g || g.destroyed) {
      return; // Already destroyed, skip
    }

    // 🔥 CRITICAL: Kill all GSAP animations before releasing
    // This prevents "zombie" animations and memory leaks
    try {
      gsap.killTweensOf(g);
      gsap.killTweensOf(g.x);
      gsap.killTweensOf(g.y);
      gsap.killTweensOf(g.alpha);
      gsap.killTweensOf(g.rotation);
      gsap.killTweensOf(g.scale);
      gsap.killTweensOf(g.scale.x);
      gsap.killTweensOf(g.scale.y);
    } catch (err) {
      // Ignore GSAP cleanup errors
    }

    // Remove from parent if still attached
    try {
      if (g.parent) {
        g.parent.removeChild(g);
      }
    } catch (err) {
      // Ignore parent removal errors
    }

    // Reset Graphics object
    this.reset(g);

    // Return to pool if we haven't reached max size
    if (this.pool.length < this.maxSize) {
      this.pool.push(g);
    } else {
      // Pool is full, destroy the object
      try {
        g.destroy();
      } catch (err) {
        // Ignore destroy errors
      }
    }
  }

  /**
   * Reset a Graphics object to default state
   * @param {Graphics} g - Graphics object to reset
   */
  private reset(g: Graphics): void {
    if (!g || g.destroyed) return;

    try {
      // Clear all drawing commands
      g.clear();
      
      // Reset transform properties
      g.x = 0;
      g.y = 0;
      g.alpha = 1;
      g.rotation = 0;
      g.scale.set(1);
      
      // Reset event mode (will be set by caller if needed)
      g.eventMode = 'auto';
      g.cursor = 'default';
      
      // Reset z-index
      g.zIndex = 0;
      
      // Reset interactive children
      try {
        g.interactiveChildren = true;
      } catch {}
    } catch (err) {
      // Ignore reset errors
    }
  }

  /**
   * Clear the pool and destroy all objects
   * Useful for cleanup on game reset
   */
  clear(): void {
    for (const g of this.pool) {
      try {
        gsap.killTweensOf(g);
        if (g.parent) {
          g.parent.removeChild(g);
        }
        g.destroy();
      } catch (err) {
        // Ignore cleanup errors
      }
    }
    this.pool = [];
    this.created = 0;
    this.reused = 0;
  }

  /**
   * Get pool statistics (for debugging)
   * @returns {Object} Pool stats
   */
  getStats(): { poolSize: number; created: number; reused: number; totalUsed: number } {
    return {
      poolSize: this.pool.length,
      created: this.created,
      reused: this.reused,
      totalUsed: this.created + this.reused
    };
  }
}

// Export singleton instance
export const graphicsPool = new GraphicsPool();

// Export class for testing
export { GraphicsPool };

