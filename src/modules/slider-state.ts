// Slider State Module
// Centralized state management for slider animations and flags
// Replaces window.__cc* global variables for better testability and type safety

import { logger } from '../core/logger.js';

interface SliderState {
  isAnimatingEnter: boolean;
  isAnimatingExit: boolean;
}

class SliderStateManager {
  private state: SliderState = {
    isAnimatingEnter: false,
    isAnimatingExit: false
  };
  
  // Listeners for state changes
  private listeners: Map<keyof SliderState, Set<(value: boolean) => void>> = new Map();
  
  constructor() {
    // Initialize listener sets
    this.listeners.set('isAnimatingEnter', new Set());
    this.listeners.set('isAnimatingExit', new Set());
    
    // 🔥 BACKWARDS COMPATIBILITY: Sync with window globals during transition
    // This allows gradual migration without breaking existing code
    this.syncWithWindowGlobals();
  }
  
  /**
   * Get animation state
   */
  get isAnimatingEnter(): boolean {
    return this.state.isAnimatingEnter;
  }
  
  get isAnimatingExit(): boolean {
    return this.state.isAnimatingExit;
  }
  
  /**
   * Set animation state with optional logging
   */
  setAnimatingEnter(value: boolean): void {
    const prev = this.state.isAnimatingEnter;
    this.state.isAnimatingEnter = value;
    
    // Sync with window global for backwards compatibility
    (window as any).__ccIsAnimatingSliderEnter = value;
    
    if (prev !== value) {
      logger.debug(`🎬 Slider enter animation: ${prev} → ${value}`);
      this.notifyListeners('isAnimatingEnter', value);
    }
  }
  
  setAnimatingExit(value: boolean): void {
    const prev = this.state.isAnimatingExit;
    this.state.isAnimatingExit = value;
    
    // Sync with window global for backwards compatibility
    (window as any).__ccIsAnimatingSliderExit = () => value;
    
    if (prev !== value) {
      logger.debug(`🎬 Slider exit animation: ${prev} → ${value}`);
      this.notifyListeners('isAnimatingExit', value);
    }
  }
  
  /**
   * Subscribe to state changes
   */
  subscribe(key: keyof SliderState, callback: (value: boolean) => void): () => void {
    const listeners = this.listeners.get(key);
    if (listeners) {
      listeners.add(callback);
    }
    
    // Return unsubscribe function
    return () => {
      const ls = this.listeners.get(key);
      if (ls) {
        ls.delete(callback);
      }
    };
  }
  
  /**
   * Reset all animation states
   */
  reset(): void {
    this.setAnimatingEnter(false);
    this.setAnimatingExit(false);
    logger.info('✅ Slider state reset');
  }
  
  /**
   * Check if any animation is in progress
   */
  isAnyAnimationInProgress(): boolean {
    return this.state.isAnimatingEnter || this.state.isAnimatingExit;
  }
  
  /**
   * Sync with window globals for backwards compatibility
   * This reads current window global values and syncs them to our state
   */
  private syncWithWindowGlobals(): void {
    // Read current values from window globals (if they exist)
    const windowEnter = (window as any).__ccIsAnimatingSliderEnter;
    const windowExit = (window as any).__ccIsAnimatingSliderExit;
    
    if (typeof windowEnter === 'boolean') {
      this.state.isAnimatingEnter = windowEnter;
    }
    if (typeof windowExit === 'function') {
      this.state.isAnimatingExit = windowExit();
    } else if (typeof windowExit === 'boolean') {
      this.state.isAnimatingExit = windowExit;
    }
  }
  
  /**
   * Notify listeners of state change
   */
  private notifyListeners(key: keyof SliderState, value: boolean): void {
    const listeners = this.listeners.get(key);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(value);
        } catch (error) {
          logger.error(`❌ Slider state listener error for ${key}:`, error);
        }
      });
    }
  }
}

// Export singleton instance
export const sliderState = new SliderStateManager();

// Export class for testing
export { SliderStateManager };
