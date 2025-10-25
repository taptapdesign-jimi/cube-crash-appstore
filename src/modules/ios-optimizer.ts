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

  constructor() {
    this.isIOS = false;
    this.isInitialized = false;
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
    // Prevent default touch behaviors that can cause scrolling issues
    if (event.target && ((event.target as Element).closest('.slider') || (event.target as Element).closest('.button'))) {
      event.preventDefault();
    }
  }
  
  // Enable hardware acceleration
  private enableHardwareAcceleration(): void {
    if (this.optimizations.hardwareAcceleration) return;
    
    // Add hardware acceleration classes
    const elements = document.querySelectorAll('.slider, .button, .nav-button');
    elements.forEach(el => {
      (el as HTMLElement).style.transform = 'translateZ(0)';
      (el as HTMLElement).style.willChange = 'transform';
      (el as HTMLElement).style.backfaceVisibility = 'hidden';
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
    gameState.subscribe('currentSlide', (slide: number) => {
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
    
    // Optimize animations for iOS
    const style = document.createElement('style');
    style.textContent = `
      .ios-device * {
        -webkit-transform: translateZ(0);
        transform: translateZ(0);
        -webkit-backface-visibility: hidden;
        backface-visibility: hidden;
        -webkit-perspective: 1000;
        perspective: 1000;
      }
      
      .ios-device .slider__wrapper {
        -webkit-transform: translateZ(0);
        transform: translateZ(0);
        -webkit-backface-visibility: hidden;
        backface-visibility: hidden;
      }
      
      .ios-device .button {
        -webkit-transform: translateZ(0);
        transform: translateZ(0);
        -webkit-backface-visibility: hidden;
        backface-visibility: hidden;
      }
    `;
    document.head.appendChild(style);
    
    this.optimizations.animationOptimization = true;
    logger.info('📱 Animation optimization enabled');
  }
  
  // Setup state subscriptions
  private setupStateSubscriptions(): void {
    // Game state changes
    gameState.subscribe('isGameActive', (isActive: boolean) => {
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

