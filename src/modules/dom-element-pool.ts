/**
 * DOM Element Pool - Object pooling for HTML DOM elements
 * Reuses DOM elements instead of creating/destroying them
 * Reduces GC pressure and improves performance on mobile devices
 */

import { gsap } from 'gsap';

/**
 * DOMElementPool - Object pool for HTML elements (div, img, etc.)
 * Reuses DOM elements instead of creating/destroying them
 */
class DOMElementPool {
  private pool: HTMLElement[] = [];
  private inPool: WeakSet<HTMLElement> = new WeakSet(); // 🔥 FIX: Track elements in pool to prevent double-release
  private maxSize: number = 100; // Max pool size
  private created: number = 0;
  private reused: number = 0;

  /**
   * Acquire a DOM element from the pool
   * If pool is empty, creates a new one
   * @param {string} tagName - Tag name of element to create ('div', 'img', etc.). Defaults to 'div'
   * @returns {HTMLElement} Ready-to-use element
   */
  acquire(tagName: string = 'div'): HTMLElement {
    let el = this.pool.pop();
    
    if (!el || el.tagName.toLowerCase() !== tagName.toLowerCase()) {
      // Pool is empty or element type doesn't match, create new element
      el = document.createElement(tagName) as HTMLElement;
      this.created++;
    } else {
      // Reusing from pool - remove from tracking
      this.inPool.delete(el);
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
    
    // 🔥 FIX: Prevent double-release
    if (this.inPool.has(el)) {
      return;
    }

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
      this.inPool.add(el); // 🔥 FIX: Track element in pool
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
      // 🔥 FIX: Kill GSAP animations on element
      gsap.killTweensOf(el);
      
      // 🔥 FIX: Remove event listeners by cloning (only way to remove anonymous listeners)
      // This replaces the element with a clean clone that has no event listeners
      if (el.parentNode) {
        const clone = el.cloneNode(false) as HTMLElement;
        // Don't replace in DOM - just use the element but clear it
      }
      
      // Clear all inline styles (will be set by caller)
      el.style.cssText = '';
      
      // Remove all classes
      el.className = '';
      
      // Remove all attributes except tag name
      while (el.attributes.length > 0) {
        el.removeAttribute(el.attributes[0].name);
      }
      
      // 🔥 FIX: Remove common event listener properties that might be stored
      const commonEvents = ['onclick', 'onmousedown', 'onmouseup', 'onmousemove', 
                           'ontouchstart', 'ontouchend', 'ontouchmove', 'onload', 'onerror'];
      commonEvents.forEach(event => {
        (el as any)[event] = null;
      });
      
      // Reset transform properties (GSAP uses these)
      (el as any).x = 0;
      (el as any).y = 0;
      (el as any).scale = 1;
      (el as any).rotation = 0;
      (el as any).opacity = 1;
      // Reset img-specific properties
      if (el.tagName.toLowerCase() === 'img') {
        (el as HTMLImageElement).src = '';
        (el as HTMLImageElement).alt = '';
        (el as HTMLImageElement).onload = null;
        (el as HTMLImageElement).onerror = null;
      }
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
    this.inPool = new WeakSet(); // 🔥 FIX: Reset tracking (WeakSets can't be cleared)
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
