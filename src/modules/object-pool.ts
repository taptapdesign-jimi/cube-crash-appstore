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
  // 🔥 FIX: Track objects in pool to prevent double-release
  private inPool: WeakSet<Graphics> = new WeakSet();

  /**
   * Acquire a Graphics object from the pool
   * If pool is empty, creates a new one
   * 🔥 FIX: Filters out destroyed/invalid objects from pool
   * @returns {Graphics} Ready-to-use Graphics object
   */
  acquire(): Graphics {
    let g: Graphics | undefined;
    let attempts = 0;
    const maxAttempts = 10; // Prevent infinite loop if pool is corrupted
    
    // 🔥 FIX: Keep trying to get a valid object from pool
    while (this.pool.length > 0 && attempts < maxAttempts) {
      g = this.pool.pop();
      attempts++;
      
      // Check if object is valid (not destroyed, has required methods)
      if (g && !g.destroyed && typeof g.clear === 'function') {
        // Valid object found, reuse it
        this.reused++;
        // 🔥 FIX: Remove from inPool tracking
        this.inPool.delete(g);
        break;
      } else {
        // Invalid object - discard it and try again
        if (g) this.inPool.delete(g);
        g = undefined;
      }
    }
    
    if (!g) {
      // Pool is empty or all objects were invalid, create new Graphics object
      g = new Graphics();
      this.created++;
    }
    
    // Reset properties to default state
    this.reset(g);
    
    return g;
  }

  /**
   * Release a Graphics object back to the pool
   * 🔥 AGGRESSIVE CLEANUP: Based on pooling best practices
   * Cleans up GSAP animations, stops all animations, and resets the object
   * @param {Graphics} g - Graphics object to release
   */
  release(g: Graphics): void {
    // 🔥 FIX: Validate object before processing
    if (!g || g.destroyed || typeof g.clear !== 'function') {
      return; // Already destroyed or invalid, skip
    }
    
    // 🔥 FIX: Double-release protection - check if already in pool
    if (this.inPool.has(g)) {
      console.warn('⚠️ GraphicsPool: Double-release prevented');
      return;
    }

    // 🔥 CRITICAL: Kill ALL GSAP animations FIRST (before any property changes)
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
      gsap.killTweensOf(g.pivot);
      gsap.killTweensOf(g.skew);
    } catch (err) {
      // Ignore GSAP cleanup errors
    }

    // 🔥 CRITICAL: Hide object BEFORE removing from parent (prevents visual glitches)
    try {
      g.visible = false;
      g.alpha = 0;
    } catch {}

    // Remove from parent if still attached
    try {
      if (g.parent) {
        g.parent.removeChild(g);
      }
    } catch (err) {
      // Ignore parent removal errors
    }

    // 🔥 FIX: Double-check object is still valid after cleanup
    if (g.destroyed || typeof g.clear !== 'function') {
      return; // Object was destroyed during cleanup, skip
    }

    // Reset Graphics object (will set visible = true, alpha = 1 for next use)
    this.reset(g);

    // 🔥 FIX: Final validation before adding to pool
    if (g.destroyed || typeof g.clear !== 'function') {
      return; // Object was destroyed during reset, skip
    }

    // Return to pool if we haven't reached max size
    if (this.pool.length < this.maxSize) {
      this.pool.push(g);
      // 🔥 FIX: Track in inPool for double-release protection
      this.inPool.add(g);
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
   * 🔥 AGGRESSIVE RESET: Based on pooling best practices to prevent "invisible particle" bugs
   * @param {Graphics} g - Graphics object to reset
   */
  private reset(g: Graphics): void {
    if (!g || g.destroyed) return;

    try {
      // 🔥 CRITICAL: Kill ALL GSAP tweens FIRST (before any property changes)
      // This prevents "zombie" animations that can interfere with new animations
      gsap.killTweensOf(g);
      gsap.killTweensOf(g.x);
      gsap.killTweensOf(g.y);
      gsap.killTweensOf(g.alpha);
      gsap.killTweensOf(g.rotation);
      gsap.killTweensOf(g.scale);
      gsap.killTweensOf(g.scale.x);
      gsap.killTweensOf(g.scale.y);
      gsap.killTweensOf(g.pivot);
      gsap.killTweensOf(g.skew);
      
      // Clear all drawing commands (geometry)
      g.clear();
      
      // 🔥 CRITICAL: Clear geometry and bounds cache (prevents rendering issues)
      try {
        if (g.geometry && typeof g.geometry.clear === 'function') {
          g.geometry.clear();
        }
        if (g.bounds && typeof g.bounds.clear === 'function') {
          g.bounds.clear();
        }
      } catch {}
      
      // 🔥 CRITICAL: Reset visibility FIRST (must be visible to be seen!)
      g.visible = true;
      g.alpha = 1.0;
      
      // Reset transform properties
      g.x = 0;
      g.y = 0;
      g.rotation = 0;
      g.scale.set(1, 1);
      
      // 🔥 CRITICAL: Reset pivot and skew (can cause rendering issues if not reset)
      try {
        if (g.pivot) {
          g.pivot.set(0, 0);
        }
        if (g.skew) {
          g.skew.set(0, 0);
        }
      } catch {}
      
      // Reset cache (can cause rendering issues if cached)
      // 🔥 FIX: cacheAsBitmap is deprecated, use cacheAsTexture instead
      try {
        if ('cacheAsTexture' in g) {
          g.cacheAsTexture = false;
        } else if ('cacheAsBitmap' in g) {
          (g as any).cacheAsBitmap = false;
        }
      } catch {}
      
      // Reset event mode (will be set by caller if needed)
      g.eventMode = 'auto';
      g.cursor = 'default';
      
      // Reset z-index
      g.zIndex = 0;
      
      // Reset interactive children
      try {
        g.interactiveChildren = true;
      } catch {}
      
      // 🔥 CRITICAL: Force update bounds (ensures proper rendering)
      try {
        if (typeof g.updateBounds === 'function') {
          g.updateBounds();
        }
      } catch {}
    } catch (err) {
      // Ignore reset errors
      console.warn('⚠️ GraphicsPool.reset() error:', err);
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

