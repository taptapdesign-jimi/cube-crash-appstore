// iOS Optimizer Module
// Handles iOS-specific optimizations and performance improvements

import gameState from './game-state.js';
import memoryManager from './memory-manager.js';
import { logger } from '../core/logger.js';
import {
  MOBILE_RUNTIME_PROFILE,
  type MobileRuntimePlatform,
} from './mobile-runtime-profile.js';

// Type definitions
interface Optimizations {
  passiveTouchEvents: boolean;
  hardwareAcceleration: boolean;
  memoryOptimization: boolean;
  imageOptimization: boolean;
  animationOptimization: boolean;
}

interface OptimizationStatus {
  isIOS: boolean;
  isMobileDevice: boolean;
  platform: MobileRuntimePlatform;
  isInitialized: boolean;
  optimizations: Optimizations;
}

interface WindowWithMSStream extends Window {
  MSStream?: any;
}

declare let window: WindowWithMSStream;

class IOSOptimizer {
  private isIOS: boolean;
  private isMobileDevice: boolean;
  private platform: MobileRuntimePlatform;
  private isInitialized: boolean;
  private optimizations: Optimizations;
  private unsubscribeGameActive: (() => void) | null;
  private disableSelectionStyleEl: HTMLStyleElement | null;

  constructor() {
    this.isIOS = false;
    this.isMobileDevice = false;
    this.platform = 'desktop';
    this.isInitialized = false;
    this.unsubscribeGameActive = null;
    this.disableSelectionStyleEl = null;
    this.optimizations = {
      passiveTouchEvents: false,
      hardwareAcceleration: false,
      memoryOptimization: false,
      imageOptimization: false,
      animationOptimization: false
    };
  }
  
  // Initialize iOS optimizer
  init(): void {
    if (this.isInitialized) return;
    
    this.detectRuntimePlatform();
    
    if (this.isMobileDevice) {
      this.applyIOSOptimizations();
      this.setupStateSubscriptions();
      this.isInitialized = true;
      logger.info(`📱 Mobile runtime optimizer initialized (${this.platform})`);
    } else {
      logger.info('🖥️ Desktop runtime detected, preserving authored browser behavior');
    }
  }
  
  // Publish one canonical runtime hook for mobile-only thermal CSS. This also
  // recognizes iPadOS desktop-class user agents through the shared profile.
  private detectRuntimePlatform(): void {
    this.platform = MOBILE_RUNTIME_PROFILE.platform;
    this.isMobileDevice = MOBILE_RUNTIME_PROFILE.isMobileDevice;
    this.isIOS = this.platform === 'ios' && !window.MSStream;

    if (!this.isMobileDevice) return;

    document.body.classList.add('cc-mobile-runtime', `cc-runtime-${this.platform}`);
    document.body.dataset.mobileRuntimePlatform = this.platform;
    if (this.isIOS) document.body.classList.add('ios-device');
  }
  
  // Apply iOS optimizations
  private applyIOSOptimizations(): void {
    try {
      // 1. Passive touch events
      this.enablePassiveTouchEvents();
      
      // 2. Hardware acceleration
      this.enableHardwareAcceleration();
      
      // 3. Memory optimization
      this.enableMemoryOptimization();
      
      // 4. Image optimization
      this.enableImageOptimization();
      
      // 5. Animation optimization
      this.enableAnimationOptimization();
      
      logger.info('✅ iOS optimizations applied');
      
    } catch (error) {
      logger.error('❌ Failed to apply iOS optimizations:', error);
    }
  }
  
  // Enable passive touch events
  private enablePassiveTouchEvents(): void {
    if (this.optimizations.passiveTouchEvents) return;

    // Touch owners already opt into passive listeners where appropriate. A
    // document-wide passive listener cannot call preventDefault and only adds
    // dispatch work to every gesture, so the optimizer deliberately installs
    // no blanket listener.
    this.optimizations.passiveTouchEvents = true;
    logger.info('📱 Touch handling left to scoped gesture owners');
  }
  
  // Enable hardware acceleration
  private enableHardwareAcceleration(): void {
    if (this.optimizations.hardwareAcceleration) return;

    // Do not promote every slider/button/navigation node permanently. GSAP and
    // transition-scoped classes own compositor hints only while motion runs.
    this.optimizations.hardwareAcceleration = true;
    logger.info('📱 Compositor promotion delegated to active transitions');
  }
  
  // Enable memory optimization
  private enableMemoryOptimization(): void {
    if (this.optimizations.memoryOptimization) return;
    
    // Setup memory monitoring
    memoryManager.init();
    
    // SliderManager remains the sole owner of the active slide. CSS consumes
    // that state without a second DOM mutation owner.
    this.setupMemoryOptimization();
    
    this.optimizations.memoryOptimization = true;
    logger.info('📱 Memory optimization enabled');
  }
  
  // Setup memory optimization
  private setupMemoryOptimization(): void {
    // Intentionally empty: MemoryManager owns monitoring and mobile CSS pauses
    // inactive Homepage animations declaratively.
  }
  
  // Enable image optimization
  private enableImageOptimization(): void {
    if (this.optimizations.imageOptimization) return;

    // Keep authored image rendering. Rewriting every image through several
    // mutually exclusive modes ends at `auto` and only creates style churn.
    this.optimizations.imageOptimization = true;
    logger.info('📱 Authored image rendering preserved');
  }
  
  // Enable animation optimization
  private enableAnimationOptimization(): void {
    if (this.optimizations.animationOptimization) return;
    
    // CRITICAL: Disable text selection and long-press menu on iOS
    if (this.isIOS) {
      this.disableSelectionStyleEl = document.createElement('style');
      this.disableSelectionStyleEl.textContent = `
      /* iOS: Disable text selection and long-press menu everywhere */
      body * {
        -webkit-user-select: none !important;
        -webkit-touch-callout: none !important;
        -khtml-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        user-select: none !important;
      }
      
      /* Prevent iOS context menu on images and links */
      img, a, button {
        -webkit-touch-callout: none !important;
        -webkit-user-select: none !important;
        user-select: none !important;
      }
    `;
      document.head.appendChild(this.disableSelectionStyleEl);
    }
    
    this.optimizations.animationOptimization = true;
    logger.info('📱 Animation optimization enabled');
  }
  
  // Setup state subscriptions
  private setupStateSubscriptions(): void {
    // Game state changes
    this.unsubscribeGameActive = gameState.subscribe('isGameActive', (isActive: boolean) => {
      if (isActive) {
        this.onGameStart();
      } else {
        this.onGameEnd();
      }
    });
  }
  
  // Handle game start
  private onGameStart(): void {
    // Pause non-essential animations
    this.pauseNonEssentialAnimations();
    
    // Optimize for game performance
    this.optimizeForGame();
  }
  
  // Handle game end
  private onGameEnd(): void {
    // Resume animations
    this.resumeAnimations();
    
    // Clean up game resources
    this.cleanupGameResources();
  }
  
  // Pause non-essential animations
  private pauseNonEssentialAnimations(): void {
    const animations = document.querySelectorAll<HTMLElement>('#home .hero-image');
    animations.forEach(el => {
      el.style.animationPlayState = 'paused';
    });
  }
  
  // Resume animations
  private resumeAnimations(): void {
    const animations = document.querySelectorAll<HTMLElement>('#home .hero-image');
    animations.forEach(el => {
      // Clearing restores the mobile CSS rule: only the active slide runs.
      el.style.removeProperty('animation-play-state');
    });
  }
  
  // Optimize for game
  private optimizeForGame(): void {
    // Reduce visual effects
    document.body.classList.add('game-mode');
  }
  
  // Clean up game resources
  private cleanupGameResources(): void {
    // Remove game mode class
    document.body.classList.remove('game-mode');
  }
  
  // Get optimization status
  getOptimizationStatus(): OptimizationStatus {
    return {
      isIOS: this.isIOS,
      isMobileDevice: this.isMobileDevice,
      platform: this.platform,
      isInitialized: this.isInitialized,
      optimizations: { ...this.optimizations }
    };
  }
  
  // Disable specific optimization
  disableOptimization(optimization: keyof Optimizations): void {
    if (this.optimizations[optimization]) {
      this.optimizations[optimization] = false;
      logger.info(`📱 Disabled optimization: ${optimization}`);
    }
  }
  
  // Enable specific optimization
  enableOptimization(optimization: keyof Optimizations): void {
    if (!this.optimizations[optimization]) {
      this.optimizations[optimization] = true;
      logger.info(`📱 Enabled optimization: ${optimization}`);
    }
  }
  
  // Cleanup
  destroy(): void {
    if (!this.isInitialized) return;

    try {
      this.unsubscribeGameActive?.();
    } catch {}
    this.unsubscribeGameActive = null;

    try { this.disableSelectionStyleEl?.remove(); } catch {}
    this.disableSelectionStyleEl = null;

    document.body.classList.remove('game-mode');
    document.body.classList.remove('cc-mobile-runtime', 'cc-runtime-ios', 'cc-runtime-android', 'ios-device');
    delete document.body.dataset.mobileRuntimePlatform;
    document.querySelectorAll<HTMLElement>('#home .hero-image').forEach((element) => {
      element.style.removeProperty('animation-play-state');
    });

    this.isInitialized = false;
    this.isIOS = false;
    this.isMobileDevice = false;
    this.platform = 'desktop';
    this.optimizations = {
      passiveTouchEvents: false,
      hardwareAcceleration: false,
      memoryOptimization: false,
      imageOptimization: false,
      animationOptimization: false
    };
  }
}

// Create singleton instance
const iosOptimizer = new IOSOptimizer();

// Export for use in other modules
export default iosOptimizer;

// Export class for testing
export { IOSOptimizer };
