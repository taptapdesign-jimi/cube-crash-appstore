// iOS Optimizer Module
// Handles iOS-specific optimizations and performance improvements

import gameState from './game-state.js';
import memoryManager from './memory-manager.js';
import { logger } from '../core/logger.js';

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
  isInitialized: boolean;
  optimizations: Optimizations;
}

interface WindowWithMSStream extends Window {
  MSStream?: any;
}

declare let window: WindowWithMSStream;

class IOSOptimizer {
  private isIOS: boolean;
  private isInitialized: boolean;
  private optimizations: Optimizations;
  private unsubscribeCurrentSlide: (() => void) | null;
  private unsubscribeGameActive: (() => void) | null;
  private disableSelectionStyleEl: HTMLStyleElement | null;
  private animationOptimizationStyleEl: HTMLStyleElement | null;
  private hardwareAcceleratedElements: HTMLElement[];
  private hardwareAccelerationOriginalStyles: Map<HTMLElement, { backfaceVisibility: string; webkitBackfaceVisibility: string }>;

  constructor() {
    this.isIOS = false;
    this.isInitialized = false;
    this.unsubscribeCurrentSlide = null;
    this.unsubscribeGameActive = null;
    this.disableSelectionStyleEl = null;
    this.animationOptimizationStyleEl = null;
    this.hardwareAcceleratedElements = [];
    this.hardwareAccelerationOriginalStyles = new Map();
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
    
    this.detectIOS();
    
    if (this.isIOS) {
      this.applyIOSOptimizations();
      this.setupStateSubscriptions();
      this.isInitialized = true;
      logger.info('📱 iOS Optimizer initialized');
    } else {
      logger.info('📱 Non-iOS device detected, skipping iOS optimizations');
    }
  }
  
  // Detect iOS device
  private detectIOS(): void {
    const userAgent = navigator.userAgent;
    this.isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
    
    if (this.isIOS) {
      document.body.classList.add('ios-device');
      logger.info('📱 iOS device detected');
    }
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
    
    // Add passive touch event listeners
    document.addEventListener('touchstart', this.handlePassiveTouch, { passive: true });
    document.addEventListener('touchmove', this.handlePassiveTouch, { passive: true });
    document.addEventListener('touchend', this.handlePassiveTouch, { passive: true });
    
    this.optimizations.passiveTouchEvents = true;
    logger.info('📱 Passive touch events enabled');
  }
  
  // Handle passive touch events
  private handlePassiveTouch = (event: TouchEvent): void => {
    // Intentionally passive. Gesture-specific handlers own any preventDefault calls.
    void event;
  }
  
  // Enable hardware acceleration
  private enableHardwareAcceleration(): void {
    if (this.optimizations.hardwareAcceleration) return;
    
    // Avoid setting transform/will-change globally; animation owners compose transforms.
    const elements = document.querySelectorAll('.slider, .button, .nav-button');
    elements.forEach(el => {
      const element = el as HTMLElement;
      this.hardwareAccelerationOriginalStyles.set(element, {
        backfaceVisibility: element.style.backfaceVisibility,
        webkitBackfaceVisibility: (element.style as any).webkitBackfaceVisibility || '',
      });
      element.style.backfaceVisibility = 'hidden';
      (element.style as any).webkitBackfaceVisibility = 'hidden';
      this.hardwareAcceleratedElements.push(element);
    });
    
    this.optimizations.hardwareAcceleration = true;
    logger.info('📱 Hardware acceleration enabled');
  }
  
  // Enable memory optimization
  private enableMemoryOptimization(): void {
    if (this.optimizations.memoryOptimization) return;
    
    // Setup memory monitoring
    memoryManager.init();
    
    // Reduce memory usage by hiding inactive elements
    this.setupMemoryOptimization();
    
    this.optimizations.memoryOptimization = true;
    logger.info('📱 Memory optimization enabled');
  }
  
  // Setup memory optimization
  private setupMemoryOptimization(): void {
    // Hide inactive slider slides
    this.unsubscribeCurrentSlide = gameState.subscribe('currentSlide', (slide: number) => {
      const slides = document.querySelectorAll('.slider__slide');
      slides.forEach((slideEl, index) => {
        if (index !== slide) {
          (slideEl as HTMLElement).style.visibility = 'hidden';
          (slideEl as HTMLElement).style.pointerEvents = 'none';
        } else {
          (slideEl as HTMLElement).style.visibility = 'visible';
          (slideEl as HTMLElement).style.pointerEvents = 'auto';
        }
      });
    });
  }
  
  // Enable image optimization
  private enableImageOptimization(): void {
    if (this.optimizations.imageOptimization) return;
    
    // Add image optimization classes
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      img.style.imageRendering = 'crisp-edges';
      img.style.imageRendering = '-webkit-optimize-contrast';
      img.style.imageRendering = 'pixelated';
      img.style.imageRendering = '-moz-crisp-edges';
      img.style.imageRendering = 'high-quality';
      img.style.imageRendering = 'auto';
    });
    
    this.optimizations.imageOptimization = true;
    logger.info('📱 Image optimization enabled');
  }
  
  // Enable animation optimization
  private enableAnimationOptimization(): void {
    if (this.optimizations.animationOptimization) return;
    
    // CRITICAL: Disable text selection and long-press menu on iOS
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
    
    // Optimize animations for iOS
    this.animationOptimizationStyleEl = document.createElement('style');
    this.animationOptimizationStyleEl.textContent = `
      .ios-device img,
      .ios-device canvas,
      .ios-device .slider__wrapper,
      .ios-device .nav-button,
      .ios-device .slide-button,
      .ios-device .simple-bottom-sheet,
      .ios-device .score-bottom-sheet {
        -webkit-backface-visibility: hidden;
        backface-visibility: hidden;
      }

      .ios-device .simple-bottom-sheet,
      .ios-device .score-bottom-sheet {
        transform-origin: 50% 100%;
      }
    `;
    document.head.appendChild(this.animationOptimizationStyleEl);
    
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
    const animations = document.querySelectorAll('.slider__hero-image--animated');
    animations.forEach(el => {
      (el as HTMLElement).style.animationPlayState = 'paused';
    });
  }
  
  // Resume animations
  private resumeAnimations(): void {
    const animations = document.querySelectorAll('.slider__hero-image--animated');
    animations.forEach(el => {
      (el as HTMLElement).style.animationPlayState = 'running';
    });
  }
  
  // Optimize for game
  private optimizeForGame(): void {
    // Reduce visual effects
    document.body.classList.add('game-mode');
    
    // Disable hover effects
    const buttons = document.querySelectorAll('.button');
    buttons.forEach(btn => {
      (btn as HTMLElement).style.pointerEvents = 'none';
    });
  }
  
  // Clean up game resources
  private cleanupGameResources(): void {
    // Remove game mode class
    document.body.classList.remove('game-mode');
    
    // Re-enable hover effects
    const buttons = document.querySelectorAll('.button');
    buttons.forEach(btn => {
      (btn as HTMLElement).style.pointerEvents = 'auto';
    });
  }
  
  // Get optimization status
  getOptimizationStatus(): OptimizationStatus {
    return {
      isIOS: this.isIOS,
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
      this.unsubscribeCurrentSlide?.();
    } catch {}
    this.unsubscribeCurrentSlide = null;

    try {
      this.unsubscribeGameActive?.();
    } catch {}
    this.unsubscribeGameActive = null;

    try {
      document.removeEventListener('touchstart', this.handlePassiveTouch);
      document.removeEventListener('touchmove', this.handlePassiveTouch);
      document.removeEventListener('touchend', this.handlePassiveTouch);
    } catch {}

    try { this.disableSelectionStyleEl?.remove(); } catch {}
    this.disableSelectionStyleEl = null;
    try { this.animationOptimizationStyleEl?.remove(); } catch {}
    this.animationOptimizationStyleEl = null;
    this.hardwareAcceleratedElements.forEach((element) => {
      try {
        const originalStyles = this.hardwareAccelerationOriginalStyles.get(element);
        if (originalStyles) {
          element.style.backfaceVisibility = originalStyles.backfaceVisibility;
          (element.style as any).webkitBackfaceVisibility = originalStyles.webkitBackfaceVisibility;
        } else {
          element.style.removeProperty('backface-visibility');
          (element.style as any).webkitBackfaceVisibility = '';
        }
      } catch {}
    });
    this.hardwareAcceleratedElements = [];
    this.hardwareAccelerationOriginalStyles.clear();

    document.body.classList.remove('game-mode');
    document.body.classList.remove('ios-device');

    this.isInitialized = false;
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
