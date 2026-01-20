// Slider Manager Module
// Handles slider functionality and navigation

import { gsap } from 'gsap';
import gameState from './game-state.js';
import animationManager from './animation-manager.js';
import { logger } from '../core/logger.js';

// Type definitions
interface SliderElements {
  container: HTMLElement | null;
  wrapper: HTMLElement | null;
  slides: NodeListOf<Element>;
  dots: NodeListOf<Element>;
  divider: Element | null;
}

interface TouchEvent extends Event {
  touches: TouchList;
}

interface MouseEvent extends Event {
  clientX: number;
}

class SliderManager {
  private currentSlide: number = 0;
  private totalSlides: number = 4;
  private isDragging: boolean = false;
  private startX: number = 0;
  private currentX: number = 0;
  private threshold: number = 100; // 🔥 FIX: Increased threshold to ensure full slide movement (was 50px, now 100px)
  private isInitialized: boolean = false;
  private slideAnimation: gsap.core.Tween | null = null;
  private quickSetX: ((value: number) => void) | null = null;
  private elements: SliderElements = {
    container: null,
    wrapper: null,
    slides: {} as NodeListOf<Element>,
    dots: {} as NodeListOf<Element>,
    divider: null
  };

  // 🔥 MEMORY LEAK FIX: Store bound event handlers and unsubscribe functions for cleanup
  private boundHandlers: {
    touchStart?: (e: TouchEvent) => void;
    touchMove?: (e: TouchEvent) => void;
    touchEnd?: (e: TouchEvent) => void;
    mouseDown?: (e: MouseEvent) => void;
    mouseMove?: (e: MouseEvent) => void;
    mouseUp?: (e: MouseEvent) => void;
    dotClick?: Map<Element, (e: Event) => void>;
    navButtonClick?: Map<Element, (e: Event) => void>;
  } = {};
  private unsubscribeFunctions: (() => void)[] = [];

  constructor() {
    this.currentSlide = 0;
    this.totalSlides = 4;
    this.isDragging = false;
    this.startX = 0;
    this.currentX = 0;
    this.threshold = 50;
    this.isInitialized = false;
    
    this.elements = {
      container: null,
      wrapper: null,
      slides: {} as NodeListOf<Element>,
      dots: {} as NodeListOf<Element>,
      divider: null
    };
  }
  
  // Initialize slider
  init(): void {
    // 🔥 MEMORY LEAK FIX: Clean up before reinitializing (prevents duplicate event listeners)
    if (this.isInitialized) {
      logger.warn('⚠️ Slider Manager already initialized - cleaning up before reinitializing');
      this.destroy();
    }
    
    try {
      // Cache elements
      this.elements = {
        container: document.getElementById('slider-container'),
        wrapper: document.getElementById('slider-wrapper'),
        slides: document.querySelectorAll('.slider-slide'),
        dots: document.querySelectorAll('.slider-dot'),
        divider: document.querySelector('.slider-nav-divider')
      };
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Setup state subscriptions
      this.setupStateSubscriptions();
      
      // Initialize GSAP quickSetter for smooth drag updates
      if (this.elements.wrapper) {
        this.quickSetX = gsap.quickSetter(this.elements.wrapper, 'x', 'px') as (value: number) => void;
      }
      
      // Initialize slider
      this.updateSlider();
      
      this.isInitialized = true;
      logger.info('✅ Slider Manager initialized');
      
    } catch (error) {
      logger.error('❌ Failed to initialize Slider Manager:', String(error));
      throw error;
    }
  }
  
  // Setup event listeners
  private setupEventListeners(): void {
    // 🔥 MEMORY LEAK FIX: Store bound handlers for cleanup
    if (this.elements.container) {
      // Touch events
      this.boundHandlers.touchStart = this.handleTouchStart.bind(this);
      this.boundHandlers.touchMove = this.handleTouchMove.bind(this);
      this.boundHandlers.touchEnd = this.handleTouchEnd.bind(this);
      
      this.elements.container.addEventListener('touchstart', this.boundHandlers.touchStart, { passive: true });
      this.elements.container.addEventListener('touchmove', this.boundHandlers.touchMove, { passive: true });
      this.elements.container.addEventListener('touchend', this.boundHandlers.touchEnd, { passive: true });
    
    // Mouse events
      this.boundHandlers.mouseDown = this.handleMouseDown.bind(this);
      this.boundHandlers.mouseMove = this.handleMouseMove.bind(this);
      this.boundHandlers.mouseUp = this.handleMouseUp.bind(this);
      
      this.elements.container.addEventListener('mousedown', this.boundHandlers.mouseDown);
      this.elements.container.addEventListener('mousemove', this.boundHandlers.mouseMove);
      this.elements.container.addEventListener('mouseup', this.boundHandlers.mouseUp);
      this.elements.container.addEventListener('mouseleave', this.boundHandlers.mouseUp);
    }
    
    // Navigation dots
    this.boundHandlers.dotClick = new Map();
    this.elements.dots.forEach((dot, index) => {
      const handler = () => {
        // Light haptic for nav dots
        if (typeof (window as any).triggerHapticImpact === 'function') {
          (window as any).triggerHapticImpact('light');
        }
        this.goToSlide(index);
      };
      this.boundHandlers.dotClick!.set(dot, handler);
      dot.addEventListener('click', handler);
    });
    
    // Independent navigation buttons
    this.boundHandlers.navButtonClick = new Map();
    const navButtons = document.querySelectorAll('.independent-nav-button');
    navButtons.forEach((button, index) => {
      const handler = () => {
        // Light haptic for nav buttons
        if (typeof (window as any).triggerHapticImpact === 'function') {
          (window as any).triggerHapticImpact('light');
        }
        this.goToSlide(index);
      };
      this.boundHandlers.navButtonClick!.set(button, handler);
      button.addEventListener('click', handler);
    });
  }
  
  // Setup state subscriptions
  private setupStateSubscriptions(): void {
    // 🔥 MEMORY LEAK FIX: Store unsubscribe functions for cleanup
    // Slider locked state
    const unsubscribeSliderLocked = gameState.subscribe('sliderLocked', (isLocked: boolean) => {
      this.updateSliderLockState(isLocked);
    });
    this.unsubscribeFunctions.push(unsubscribeSliderLocked);
    
    // Current slide state
    const unsubscribeCurrentSlide = gameState.subscribe('currentSlide', (slide: number) => {
      this.currentSlide = slide;
      this.updateSlider();
    });
    this.unsubscribeFunctions.push(unsubscribeCurrentSlide);
  }
  
  // Handle touch start
  private handleTouchStart(event: TouchEvent): void {
    if (gameState.get('sliderLocked')) return;
    
    this.isDragging = true;
    const touch = event.touches[0];
    if (!touch) return;
    this.startX = touch.clientX;
    this.currentX = this.startX;
    
    // Add dragging class
    if (this.elements.container) {
      this.elements.container.classList.add('dragging');
    }
  }
  
  // Handle touch move
  private handleTouchMove(event: TouchEvent): void {
    if (!this.isDragging || gameState.get('sliderLocked')) return;
    
    const touch = event.touches[0];
    if (!touch) return;
    this.currentX = touch.clientX;
    const deltaX = this.currentX - this.startX;
    
    // Update slider position
    this.updateSliderPosition(deltaX);
  }
  
  // Handle touch end
  private handleTouchEnd(event: TouchEvent): void {
    if (!this.isDragging) return;
    
    this.isDragging = false;
    const deltaX = this.currentX - this.startX;
    
    // Remove dragging class
    if (this.elements.container) {
      this.elements.container.classList.remove('dragging');
    }
    
    // Determine if slide should change
    if (Math.abs(deltaX) > this.threshold) {
      if (deltaX > 0) {
        this.previousSlide();
      } else {
        this.nextSlide();
      }
    } else {
      // Snap back to current slide
      this.updateSlider();
    }
  }
  
  // Handle mouse down
  private handleMouseDown(event: MouseEvent): void {
    if (gameState.get('sliderLocked')) return;
    
    this.isDragging = true;
    this.startX = event.clientX;
    this.currentX = this.startX;
    
    // Add dragging class
    if (this.elements.container) {
      this.elements.container.classList.add('dragging');
    }
  }
  
  // Handle mouse move
  private handleMouseMove(event: MouseEvent): void {
    if (!this.isDragging || gameState.get('sliderLocked')) return;
    
    this.currentX = event.clientX;
    const deltaX = this.currentX - this.startX;
    
    // Update slider position
    this.updateSliderPosition(deltaX);
  }
  
  // Handle mouse up
  private handleMouseUp(event: MouseEvent): void {
    if (!this.isDragging) return;
    
    this.isDragging = false;
    const deltaX = this.currentX - this.startX;
    
    // Remove dragging class
    if (this.elements.container) {
      this.elements.container.classList.remove('dragging');
    }
    
    // Determine if slide should change
    if (Math.abs(deltaX) > this.threshold) {
      if (deltaX > 0) {
        this.previousSlide();
      } else {
        this.nextSlide();
      }
    } else {
      // Snap back to current slide
      this.updateSlider();
    }
  }
  
  // Update slider position during drag
  private updateSliderPosition(deltaX: number): void {
    if (!this.elements.wrapper || !this.elements.container) return;
    
    const slideWidth = this.elements.container.offsetWidth;
    const baseOffset = -this.currentSlide * slideWidth;
    
    // iOS SAFETY: Elastic bounce at edges (slide 0 and slide 3)
    const maxDragDistance = slideWidth * 0.03; // 3% elastic limit
    
    let currentOffset = baseOffset + deltaX;
    
    // Slide 0 (first): Prevent dragging right (positive deltaX)
    if (this.currentSlide === 0 && deltaX > 0) {
      // Elastic resistance: reduce movement by 90%
      currentOffset = baseOffset + (deltaX * 0.1);
    }
    
    // Slide 3 (last): Prevent dragging left (negative deltaX)
    if (this.currentSlide === this.totalSlides - 1 && deltaX < 0) {
      // Elastic resistance: reduce movement by 90%
      currentOffset = baseOffset + (deltaX * 0.1);
    }
    
    // 🔥 SMOOTH: Use GSAP quickSetter for smooth drag updates (already optimized for 60fps)
    // quickSetter internally uses requestAnimationFrame for smooth updates
    if (this.quickSetX) {
      this.quickSetX(currentOffset);
    } else {
      // Fallback to direct transform with will-change for GPU acceleration
      this.elements.wrapper.style.willChange = 'transform';
      this.elements.wrapper.style.transform = `translateX(${currentOffset}px)`;
    }
  }
  
  // Go to specific slide
  goToSlide(slideIndex: number): void {
    if (gameState.get('sliderLocked')) return;
    
    // 🔥 CRITICAL MOBILE FIX: Prevent instant slide change if enter animation is still running
    // This prevents slider from jumping instantly when user clicks nav button too quickly after preload
    if ((window as any).__ccIsAnimatingSliderEnter === true) {
      logger.info(`⏳ Slider enter animation still running, queuing slide change to ${slideIndex}...`);
      // Queue the slide change to happen after animation completes
      // 🔥 USER REQUEST FIX: Force animation even when queued (don't use quickSetX fallback)
      setTimeout(() => {
        if (slideIndex >= 0 && slideIndex < this.totalSlides) {
          this.currentSlide = slideIndex;
          gameState.set('currentSlide', slideIndex);
          // 🔥 CRITICAL: Call updateSlider with forceAnimate=true for smooth GSAP transition
          // This ensures queued slides animate smoothly instead of instant jump
          this.updateSlider(true); // forceAnimate = true
          logger.info(`✅ Queued slide change to ${slideIndex} completed with smooth animation`);
        }
      }, 650); // Wait for enter animation to complete (650ms duration)
      return;
    }
    
    if (slideIndex >= 0 && slideIndex < this.totalSlides) {
      this.currentSlide = slideIndex;
      gameState.set('currentSlide', slideIndex);
      // 🔥 USER REQUEST FIX: Force animation when going to slide via dot/button click
      // This prevents instant jumps and ensures smooth GSAP animation ALWAYS plays
      this.updateSlider(true); // forceAnimate = true
    }
  }
  
  // Go to next slide
  nextSlide(): void {
    // iOS SAFETY: Prevent going beyond last slide
    if (this.currentSlide < this.totalSlides - 1) {
      this.goToSlide(this.currentSlide + 1);
    } else {
      // Last slide: snap back with bounce
      this.updateSlider();
    }
  }
  
  // Go to previous slide
  previousSlide(): void {
    // iOS SAFETY: Prevent going beyond first slide
    if (this.currentSlide > 0) {
      this.goToSlide(this.currentSlide - 1);
    } else {
      // First slide: snap back with bounce
      this.updateSlider();
    }
  }
  
  // Update slider display
  private updateSlider(forceAnimate: boolean = false): void {
    if (!this.elements.wrapper || !this.elements.container) return;
    
    // 🔥 FIX: Calculate slide width correctly - each slide is 25% of 400% = 100vw
    const slideWidth = this.elements.container.offsetWidth; // This should be viewport width
    const offset = -this.currentSlide * slideWidth;
    
    logger.debug(`🎯 updateSlider: currentSlide=${this.currentSlide}, slideWidth=${slideWidth}, offset=${offset}, forceAnimate=${forceAnimate}`);
    
    // Kill previous animation if exists
    if (this.slideAnimation) {
      this.slideAnimation.kill();
      this.slideAnimation = null;
    }
    
    // Use GSAP for premium smooth animation with slight bounce
    // Only animate if not dragging (during drag, we want instant updates)
    if (!this.isDragging) {
      // Get current position from GSAP (quickSetter keeps it in sync)
      const currentX = gsap.getProperty(this.elements.wrapper, 'x') as number || 0;
      
      logger.debug(`🎯 updateSlider: currentX=${currentX}, target offset=${offset}, difference=${Math.abs(currentX - offset)}`);
      
      // 🔥 USER REQUEST FIX: Reduced threshold to 0.5px and added forceAnimate flag
      // This ensures slider ALWAYS animates when user clicks dots/buttons (no instant jumps)
      if (forceAnimate || Math.abs(currentX - offset) > 0.5) {
        // 🔥 SMOOTH: Use smooth easing instead of bounce for fluid, non-jerky animation
        this.slideAnimation = gsap.to(this.elements.wrapper, {
          x: offset,
          duration: 0.4, // Slightly faster for responsiveness
          ease: 'power2.out', // Smooth, fluid easing (no bounce/jerk)
          force3D: true, // GPU acceleration
          overwrite: true,
          onUpdate: () => {
            // 🔥 SMOOTH: Force GPU layer update for smooth 60fps
            if (this.elements.wrapper) {
              this.elements.wrapper.style.willChange = 'transform';
            }
          },
          onComplete: () => {
            // 🔥 SMOOTH: Reset will-change after animation for performance
            if (this.elements.wrapper) {
              this.elements.wrapper.style.willChange = 'auto';
            }
            logger.debug(`✅ updateSlider: Animation completed, final x=${gsap.getProperty(this.elements.wrapper, 'x')}`);
          }
        });
      } else {
        // Already at target position, just set it directly
        if (this.quickSetX) {
          this.quickSetX(offset);
        } else {
          this.elements.wrapper.style.transform = `translateX(${offset}px)`;
        }
      }
    } else {
      // During drag, use quickSetter (already handled in updateSliderPosition)
      if (this.quickSetX) {
        this.quickSetX(offset);
      } else {
        this.elements.wrapper.style.transform = `translateX(${offset}px)`;
      }
    }
    
    // Update dots
    this.elements.dots.forEach((dot, index) => {
      dot.classList.toggle('active', index === this.currentSlide);
    });
    
    // Update independent navigation buttons with smooth ease-in ease-out animations
    // Use requestAnimationFrame to ensure animations start after layout is stable
    requestAnimationFrame(() => {
      const navButtons = document.querySelectorAll('.independent-nav-button');
      navButtons.forEach((button, index) => {
        const isActive = index === this.currentSlide;
        const navButton = button as HTMLElement;
        const navImage = navButton.querySelector('img') as HTMLElement;
        
        // Kill any existing animations first
        gsap.killTweensOf(navButton);
        if (navImage) {
          gsap.killTweensOf(navImage);
        }
        
        // Get current GSAP values (if animated) or computed style values
        // Use GSAP getProperty first to get animated values, fallback to computed style
        const currentWidth = (gsap.getProperty(navButton, 'width') as number) || parseFloat(getComputedStyle(navButton).width) || 48;
        const currentHeight = (gsap.getProperty(navButton, 'height') as number) || parseFloat(getComputedStyle(navButton).height) || 48;
        const currentImageY = navImage ? ((gsap.getProperty(navImage, 'y') as number) || 0) : 0;
        
        // Set class immediately - CSS will handle marginTop positioning (no inline styles)
        if (isActive) {
          button.classList.add('active');
        } else {
          button.classList.remove('active');
        }
        
        // Clear any existing inline marginTop to let CSS take control
        gsap.set(navButton, {
          clearProps: 'marginTop' // Clear inline marginTop, let CSS handle it
        });
        
        // Animate only width and height - CSS handles marginTop positioning
        if (isActive) {
          // Animate to active state - smooth ease-in ease-out from current position
          gsap.to(navButton, {
            width: 72, // 🔥 FIX: Active size reduced from 80px to 72px
            height: 72, // 🔥 FIX: Active size reduced from 80px to 72px
            // marginTop is handled by CSS (.independent-nav-button.active)
            duration: 0.1,
            ease: 'power2.inOut',
            force3D: true
          });
          if (navImage) {
            gsap.to(navImage, {
              y: -12,
              duration: 0.1,
              ease: 'power2.inOut',
              force3D: true
            });
          }
        } else {
          // Animate to inactive state - smooth ease-in ease-out from current position
          gsap.to(navButton, {
            width: 48,
            height: 48,
            // marginTop is handled by CSS (.independent-nav-button)
            duration: 0.1,
            ease: 'power2.inOut',
            force3D: true
          });
          if (navImage) {
            gsap.to(navImage, {
              y: 0,
              duration: 0.1,
              ease: 'power2.inOut',
              force3D: true
            });
          }
        }
      });
    });
    
    // Update slides
    this.elements.slides.forEach((slide, index) => {
      slide.classList.toggle('active', index === this.currentSlide);
    });
  }
  
  // Update slider lock state
  private updateSliderLockState(isLocked: boolean): void {
    if (this.elements.container) {
      this.elements.container.style.pointerEvents = isLocked ? 'none' : 'auto';
    }
  }
  
  // Get current slide
  getCurrentSlide(): number {
    return this.currentSlide;
  }
  
  // Set current slide
  setCurrentSlide(slide: number): void {
    this.goToSlide(slide);
  }
  
  /**
   * 🔥 NEW API: Set slide instantly without animation
   * Updates ALL 4 states atomically: GSAP wrapper, CSS classes, gameState, internal state
   * Use this when showing homepage at specific slide to avoid visual glitches
   */
  setSlideInstant(slideIndex: number): void {
    if (slideIndex < 0 || slideIndex >= this.totalSlides) {
      logger.warn(`⚠️ Invalid slide index: ${slideIndex}`);
      return;
    }
    
    logger.info(`🎯 setSlideInstant: Setting slide to ${slideIndex} (atomic update)`);
    
    // 1. Update internal state
    this.currentSlide = slideIndex;
    
    // 2. Update gameState
    gameState.set('currentSlide', slideIndex);
    
    // 3. Update GSAP wrapper position
    if (this.elements.wrapper && this.elements.container) {
      const slideWidth = this.elements.container.offsetWidth;
      const offset = -slideIndex * slideWidth;
      gsap.set(this.elements.wrapper, { 
        x: offset, 
        immediateRender: true,
        force3D: true 
      });
      logger.debug(`✅ GSAP wrapper positioned at slide ${slideIndex}, offset: ${offset}px`);
    }
    
    // 4. Update CSS .active classes on slides
    this.elements.slides.forEach((slide, index) => {
      if (index === slideIndex) {
        slide.classList.add('active');
      } else {
        slide.classList.remove('active');
      }
    });
    
    // 5. Update dots
    this.elements.dots.forEach((dot, index) => {
      dot.classList.toggle('active', index === slideIndex);
    });
    
    // 6. Update navigation buttons
    const navButtons = document.querySelectorAll('.independent-nav-button');
    navButtons.forEach((button, index) => {
      if (index === slideIndex) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
    
    logger.info(`✅ setSlideInstant: All states synced to slide ${slideIndex}`);
  }
  
  /**
   * 🔥 NEW API: Ensure slider is ready for interaction
   * Reinitializes if needed, unlocks slider, ensures pointer events work
   */
  ensureReady(): void {
    logger.info('🔧 ensureReady: Ensuring slider is ready for interaction');
    
    // 1. Reinitialize if not initialized
    if (!this.isInitialized) {
      logger.warn('⚠️ Slider not initialized - initializing now');
      this.init();
      return; // init() will handle everything
    }
    
    // 2. Refresh element references (in case DOM changed)
    this.elements.container = document.getElementById('slider-container');
    this.elements.wrapper = document.getElementById('slider-wrapper');
    this.elements.slides = document.querySelectorAll('.slider-slide');
    this.elements.dots = document.querySelectorAll('.slider-dot');
    
    // 3. Unlock slider
    gameState.set('sliderLocked', false);
    
    // 4. Ensure pointer events are enabled
    if (this.elements.container) {
      this.elements.container.style.pointerEvents = 'auto';
      logger.debug('✅ Slider container pointer events enabled');
    }
    
    // 5. Ensure quickSetter exists
    if (!this.quickSetX && this.elements.wrapper) {
      this.quickSetX = gsap.quickSetter(this.elements.wrapper, 'x', 'px') as (value: number) => void;
      logger.debug('✅ GSAP quickSetter recreated');
    }
    
    logger.info('✅ ensureReady: Slider ready for interaction');
  }
  
  // Cleanup
  destroy(): void {
    // Kill GSAP animation if exists
    if (this.slideAnimation) {
      this.slideAnimation.kill();
      this.slideAnimation = null;
    }
    
    // 🔥 MEMORY LEAK FIX: Cleanup GSAP quickSetter
    if (this.quickSetX && this.elements.wrapper) {
      try {
        // GSAP quickSetter doesn't have explicit cleanup, but killing animations on wrapper should be enough
        gsap.killTweensOf(this.elements.wrapper);
        this.quickSetX = null;
        logger.info('🧹 GSAP quickSetter cleaned up');
      } catch (e) {
        logger.warn('⚠️ Failed to cleanup quickSetter:', e);
      }
    }
    
    // 🔥 MEMORY LEAK FIX: Remove all event listeners
    if (this.elements.container) {
      // Remove touch events
      if (this.boundHandlers.touchStart) {
        this.elements.container.removeEventListener('touchstart', this.boundHandlers.touchStart);
      }
      if (this.boundHandlers.touchMove) {
        this.elements.container.removeEventListener('touchmove', this.boundHandlers.touchMove);
      }
      if (this.boundHandlers.touchEnd) {
        this.elements.container.removeEventListener('touchend', this.boundHandlers.touchEnd);
      }
      
      // Remove mouse events
      if (this.boundHandlers.mouseDown) {
        this.elements.container.removeEventListener('mousedown', this.boundHandlers.mouseDown);
      }
      if (this.boundHandlers.mouseMove) {
        this.elements.container.removeEventListener('mousemove', this.boundHandlers.mouseMove);
      }
      if (this.boundHandlers.mouseUp) {
        this.elements.container.removeEventListener('mouseup', this.boundHandlers.mouseUp);
        this.elements.container.removeEventListener('mouseleave', this.boundHandlers.mouseUp);
      }
    }
    
    // Remove dot click listeners
    if (this.boundHandlers.dotClick) {
      this.boundHandlers.dotClick.forEach((handler, dot) => {
        dot.removeEventListener('click', handler);
      });
      this.boundHandlers.dotClick.clear();
    }
    
    // Remove nav button click listeners
    if (this.boundHandlers.navButtonClick) {
      this.boundHandlers.navButtonClick.forEach((handler, button) => {
        button.removeEventListener('click', handler);
      });
      this.boundHandlers.navButtonClick.clear();
    }
    
    // Unsubscribe from gameState
    this.unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    this.unsubscribeFunctions = [];
    
    // Clear bound handlers
    this.boundHandlers = {};
    
    // Clear elements
    this.elements = {
      container: null,
      wrapper: null,
      slides: {} as NodeListOf<Element>,
      dots: {} as NodeListOf<Element>,
      divider: null
    };
    this.isInitialized = false;
    
    logger.info('🧹 Slider Manager cleaned up');
  }
}

// Create singleton instance
const sliderManager = new SliderManager();

// Export for use in other modules
export default sliderManager;

// Export class for testing
export { SliderManager };
