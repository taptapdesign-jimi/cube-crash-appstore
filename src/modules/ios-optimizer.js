// iOS Optimizer Module
// Handles iOS-specific optimizations and performance improvements

import gameState from './game-state.js';
import memoryManager from './memory-manager.js';

class IOSOptimizer {
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
  init() {
    if (this.isInitialized) return;
    
    this.detectIOS();
    
    if (this.isIOS) {
      this.applyIOSOptimizations();
      this.setupStateSubscriptions();
      this.isInitialized = true;
      console.log('📱 iOS Optimizer initialized');
    } else {
      console.log('📱 Non-iOS device detected, skipping iOS optimizations');
    }
  }
  
  // Detect iOS device
  detectIOS() {
    const userAgent = navigator.userAgent;
    this.isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
    
    if (this.isIOS) {
      document.body.classList.add('ios-device');
      console.log('📱 iOS device detected');
    }
  }
  
  // Apply iOS optimizations
  applyIOSOptimizations() {
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
      
      console.log('✅ iOS optimizations applied');
      
    } catch (error) {
      console.error('❌ Failed to apply iOS optimizations:', error);
    }
  }
  
  // Enable passive touch events
  enablePassiveTouchEvents() {
    if (this.optimizations.passiveTouchEvents) return;
    
    // Add passive touch event listeners
    document.addEventListener('touchstart', this.handlePassiveTouch, { passive: true });
    document.addEventListener('touchmove', this.handlePassiveTouch, { passive: true });
    document.addEventListener('touchend', this.handlePassiveTouch, { passive: true });
    
    this.optimizations.passiveTouchEvents = true;
    console.log('📱 Passive touch events enabled');
  }
  
  // Handle passive touch events
  handlePassiveTouch(event) {
    // Prevent default touch behaviors that can cause scrolling issues
    if (event.target.closest('.slider') || event.target.closest('.button')) {
      event.preventDefault();
    }
  }
  
  // Enable hardware acceleration
  enableHardwareAcceleration() {
    if (this.optimizations.hardwareAcceleration) return;
    
    // Add hardware acceleration classes
    const elements = document.querySelectorAll('.slider, .button, .nav-button');
    elements.forEach(el => {
      el.style.transform = 'translateZ(0)';
      el.style.willChange = 'transform';
      el.style.backfaceVisibility = 'hidden';
    });
    
    this.optimizations.hardwareAcceleration = true;
    console.log('📱 Hardware acceleration enabled');
  }
  
  // Enable memory optimization
  enableMemoryOptimization() {
    if (this.optimizations.memoryOptimization) return;
    
    // Setup memory monitoring
    memoryManager.init();
    
    // Reduce memory usage by hiding inactive elements
    this.setupMemoryOptimization();
    
    this.optimizations.memoryOptimization = true;
    console.log('📱 Memory optimization enabled');
  }
  
  // Setup memory optimization
  setupMemoryOptimization() {
    // Hide inactive slider slides
    gameState.subscribe('currentSlide', (slide) => {
      const slides = document.querySelectorAll('.slider__slide');
      slides.forEach((slideEl, index) => {
        if (index !== slide) {
          slideEl.style.visibility = 'hidden';
          slideEl.style.pointerEvents = 'none';
        } else {
          slideEl.style.visibility = 'visible';
          slideEl.style.pointerEvents = 'auto';
        }
      });
    });
  }
  
  // Enable image optimization
  enableImageOptimization() {
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
    console.log('📱 Image optimization enabled');
  }
  
  // Enable animation optimization
  enableAnimationOptimization() {
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
    console.log('📱 Animation optimization enabled');
  }
  
  // Setup state subscriptions
  setupStateSubscriptions() {
    // Game state changes
    gameState.subscribe('isGameActive', (isActive) => {
      if (isActive) {
        this.onGameStart();
      } else {
        this.onGameEnd();
      }
    });
  }
  
  // Handle game start
  onGameStart() {
    // Pause non-essential animations
    this.pauseNonEssentialAnimations();
    
    // Optimize for game performance
    this.optimizeForGame();
  }
  
  // Handle game end
  onGameEnd() {
    // Resume animations
    this.resumeAnimations();
    
    // Clean up game resources
    this.cleanupGameResources();
  }
  
  // Pause non-essential animations
  pauseNonEssentialAnimations() {
    const animations = document.querySelectorAll('.slider__hero-image--animated');
    animations.forEach(el => {
      el.style.animationPlayState = 'paused';
    });
  }
  
  // Resume animations
  resumeAnimations() {
    const animations = document.querySelectorAll('.slider__hero-image--animated');
    animations.forEach(el => {
      el.style.animationPlayState = 'running';
    });
  }
  
  // Optimize for game
  optimizeForGame() {
    // Reduce visual effects
    document.body.classList.add('game-mode');
    
    // Disable hover effects
    const buttons = document.querySelectorAll('.button');
    buttons.forEach(btn => {
      btn.style.pointerEvents = 'none';
    });
  }
  
  // Clean up game resources
  cleanupGameResources() {
    // Remove game mode class
    document.body.classList.remove('game-mode');
    
    // Re-enable hover effects
    const buttons = document.querySelectorAll('.button');
    buttons.forEach(btn => {
      btn.style.pointerEvents = 'auto';
    });
  }
  
  // Get optimization status
  getOptimizationStatus() {
    return {
      isIOS: this.isIOS,
      isInitialized: this.isInitialized,
      optimizations: { ...this.optimizations }
    };
  }
  
  // Disable specific optimization
  disableOptimization(optimization) {
    if (this.optimizations[optimization]) {
      this.optimizations[optimization] = false;
      console.log(`📱 Disabled optimization: ${optimization}`);
    }
  }
  
  // Enable specific optimization
  enableOptimization(optimization) {
    if (!this.optimizations[optimization]) {
      this.optimizations[optimization] = true;
      console.log(`📱 Enabled optimization: ${optimization}`);
    }
  }
  
  // Cleanup
  destroy() {
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
