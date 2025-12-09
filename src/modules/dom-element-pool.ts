/**
 * DOM Element Pool - Object pooling for HTML DOM elements
 * Reuses DOM elements instead of creating/destroying them
 * Reduces GC pressure and improves performance on mobile devices
 */

import { gsap } from 'gsap';

/**
 * DOMElementPool - Object pool for HTML div elements (smoke particles)
 * Reuses div elements instead of creating/destroying them
 */
class DOMElementPool {
  private pool: HTMLElement[] = [];
  private maxSize: number = 100; // Max pool size
  private created: number = 0;
  private reused: number = 0;

  /**
   * Acquire a DOM element from the pool
   * If pool is empty, creates a new one
   * @returns {HTMLElement} Ready-to-use div element
   */
  acquire(): HTMLElement {
    let el = this.pool.pop();
    
    if (!el) {
      // Pool is empty, create new div element
      el = document.createElement('div');
      this.created++;
    } else {
      // Reusing from pool
      this.reused++;
    }
    
    // Reset properties to default state
    this.reset(el);
    
    return el;
  }

  /**
   * Release a DOM element back to the pool
   * Cleans up GSAP animations and resets the element
   * @param {HTMLElement} el - DOM element to release
   */
  release(el: HTMLElement): void {
    if (!el) return;

    // 🔥 CRITICAL: Kill all GSAP animations before releasing
    try {
      gsap.killTweensOf(el);
      // Kill animations on common properties
      if ((el as any).x !== undefined) gsap.killTweensOf((el as any).x);
      if ((el as any).y !== undefined) gsap.killTweensOf((el as any).y);
      if ((el as any).scale !== undefined) gsap.killTweensOf((el as any).scale);
    } catch (err) {
      // Ignore GSAP cleanup errors
    }

    // Remove from parent if still attached
    try {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    } catch (err) {
      // Ignore parent removal errors
    }

    // Reset DOM element
    this.reset(el);

    // Return to pool if we haven't reached max size
    if (this.pool.length < this.maxSize) {
      this.pool.push(el);
    }
    // If pool is full, element will be garbage collected
  }

  /**
   * Reset a DOM element to default state
   * @param {HTMLElement} el - DOM element to reset
   */
  private reset(el: HTMLElement): void {
    if (!el) return;

    try {
      // Clear all inline styles (will be set by caller)
      el.style.cssText = '';
      
      // Remove all classes
      el.className = '';
      
      // Remove all attributes except tag name
      while (el.attributes.length > 0) {
        el.removeAttribute(el.attributes[0].name);
      }
      
      // Reset transform properties (GSAP uses these)
      (el as any).x = 0;
      (el as any).y = 0;
      (el as any).scale = 1;
      (el as any).rotation = 0;
      (el as any).opacity = 1;
    } catch (err) {
      // Ignore reset errors
    }
  }

  /**
   * Clear the pool and remove all elements
   * Useful for cleanup on game reset
   */
  clear(): void {
    for (const el of this.pool) {
      try {
        gsap.killTweensOf(el);
        if (el.parentNode) {
          el.parentNode.removeChild(el);
        }
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
export const domElementPool = new DOMElementPool();

// Export class for testing
export { DOMElementPool };
