// Slider Manager Module
// Handles slider functionality and navigation

import { gsap } from 'gsap';
import gameState from './game-state.js';
import animationManager from './animation-manager.js';
import { logger } from '../core/logger.js';
import { SLIDER_ANIMATION, SLIDER_CONFIG } from '../constants/animations.js';
import { sliderState } from './slider-state.js';

// Type definitions
interface SliderElements {
  container: HTMLElement | null;
  wrapper: HTMLElement | null;
  slides: NodeListOf<Element> | null;  // 🔥 FIX: Allow null to prevent empty object hack
  dots: NodeListOf<Element> | null;    // 🔥 FIX: Allow null to prevent empty object hack
  divider: Element | null;
}

// 🔥 FIX: Use native browser types instead of shadowing them
type SliderTouchEvent = globalThis.TouchEvent;
type SliderMouseEvent = globalThis.MouseEvent;

class SliderManager {
  private currentSlide: number = 0;
  private totalSlides: number = SLIDER_CONFIG.TOTAL_SLIDES;
  private isDragging: boolean = false;
  private startX: number = 0;
  private currentX: number = 0;
  private threshold: number = SLIDER_CONFIG.DRAG_THRESHOLD_PX;
  private isInitialized: boolean = false;
  private slideAnimation: gsap.core.Tween | null = null;
  private quickSetX: ((value: number) => void) | null = null;
  private elements: SliderElements = {
    container: null,
    wrapper: null,
    slides: null,  // 🔥 FIX: Use null instead of empty object hack
    dots: null,    // 🔥 FIX: Use null instead of empty object hack
    divider: null
  };
  
  // 🔥 FIX: Track active intervals for proper cleanup
  private activeIntervals: Set<ReturnType<typeof setInterval>> = new Set();
  
  // 🔥 FIX: Track active requestAnimationFrame IDs for proper cleanup
  private activeRAFs: Set<number> = new Set();
  
  // 🔥 FIX: Track nav button GSAP animations for proper cleanup
  private navButtonAnimations: gsap.core.Tween[] = [];

  // 🔥 MEMORY LEAK FIX: Store bound event handlers and unsubscribe functions for cleanup
  private boundHandlers: {
    touchStart?: (e: SliderTouchEvent) => void;
    touchMove?: (e: SliderTouchEvent) => void;
    touchEnd?: (e: SliderTouchEvent) => void;
    mouseDown?: (e: SliderMouseEvent) => void;
    mouseMove?: (e: SliderMouseEvent) => void;
    mouseUp?: (e: SliderMouseEvent) => void;
    dotClick?: Map<Element, (e: Event) => void>;
    navButtonClick?: Map<Element, (e: Event) => void>;
  } = {};
  private unsubscribeFunctions: (() => void)[] = [];

  constructor() {
    this.currentSlide = 0;
    this.totalSlides = SLIDER_CONFIG.TOTAL_SLIDES;
    this.isDragging = false;
    this.startX = 0;
    this.currentX = 0;
    this.threshold = SLIDER_CONFIG.DRAG_THRESHOLD_PX;
    this.isInitialized = false;
    
    this.elements = {
      container: null,
      wrapper: null,
      slides: null,  // 🔥 FIX: Use null instead of empty object hack
      dots: null,    // 🔥 FIX: Use null instead of empty object hack
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
        
        // 🔥 CRITICAL FIX: Explicitly set initial GSAP position to 0
        // This ensures gsap.getProperty() returns correct value for animation checks
        const slideWidth = this.elements.container?.offsetWidth || window.innerWidth;
        const initialOffset = -this.currentSlide * slideWidth;
        gsap.set(this.elements.wrapper, { x: initialOffset, immediateRender: true });
        logger.debug(`🎯 Slider init: Set initial GSAP position to ${initialOffset}px (slide ${this.currentSlide})`);
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
    
    // Navigation dots - 🔥 FIX: Simple null check
    this.boundHandlers.dotClick = new Map();
    if (this.elements.dots && this.elements.dots.length > 0) {
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
    }
    
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
  private handleTouchStart(event: SliderTouchEvent): void {
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
  private handleTouchMove(event: SliderTouchEvent): void {
    if (!this.isDragging || gameState.get('sliderLocked')) return;
    
    const touch = event.touches[0];
    if (!touch) return;
    this.currentX = touch.clientX;
    const deltaX = this.currentX - this.startX;
    
    // Update slider position
    this.updateSliderPosition(deltaX);
  }
  
  // Handle touch end
  private handleTouchEnd(event: SliderTouchEvent): void {
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
  private handleMouseDown(event: SliderMouseEvent): void {
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
  private handleMouseMove(event: SliderMouseEvent): void {
    if (!this.isDragging || gameState.get('sliderLocked')) return;
    
    this.currentX = event.clientX;
    const deltaX = this.currentX - this.startX;
    
    // Update slider position
    this.updateSliderPosition(deltaX);
  }
  
  // Handle mouse up
  private handleMouseUp(event: SliderMouseEvent): void {
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
    
    // iOS SAFETY: Elastic bounce at edges (first and last slide)
    const maxDragDistance = slideWidth * SLIDER_CONFIG.ELASTIC_LIMIT_MULTIPLIER;
    
    let currentOffset = baseOffset + deltaX;
    
    // First slide: Prevent dragging right (positive deltaX)
    if (this.currentSlide === 0 && deltaX > 0) {
      // Elastic resistance: reduce movement significantly at edge
      currentOffset = baseOffset + (deltaX * SLIDER_CONFIG.ELASTIC_RESISTANCE);
    }
    
    // Last slide: Prevent dragging left (negative deltaX)
    if (this.currentSlide === this.totalSlides - 1 && deltaX < 0) {
      // Elastic resistance: reduce movement significantly at edge
      currentOffset = baseOffset + (deltaX * SLIDER_CONFIG.ELASTIC_RESISTANCE);
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
    
    // 🔥 CRITICAL FIX: Ensure isDragging is false before slide change
    // This prevents drag state from blocking nav button animations
    if (this.isDragging) {
      logger.warn('⚠️ isDragging was true during goToSlide - resetting to false');
      this.isDragging = false;
    }
    
    // 🔥 CRITICAL MOBILE FIX: Prevent instant slide change if enter animation is still running
    // 🔥 REFACTOR: Use sliderState module instead of window global
    if (sliderState.isAnimatingEnter) {
      logger.info(`⏳ Slider enter animation still running, queuing slide change to ${slideIndex}...`);
      
      // 🔥 FIX: Track interval for proper cleanup - use constants
      const checkInterval = setInterval(() => {
        if (!sliderState.isAnimatingEnter) {
          clearInterval(checkInterval);
          this.activeIntervals.delete(checkInterval);
          
          setTimeout(() => {
            if (slideIndex >= 0 && slideIndex < this.totalSlides) {
              this.currentSlide = slideIndex;
              gameState.set('currentSlide', slideIndex);
              this.updateSlider(true);
              logger.info(`✅ Queued slide change to ${slideIndex} completed with smooth animation`);
            }
          }, SLIDER_ANIMATION.ANIMATION_CHECK_INTERVAL);
        }
      }, SLIDER_ANIMATION.ANIMATION_CHECK_INTERVAL);
      
      this.activeIntervals.add(checkInterval);
      
      // Fallback timeout using constant
      setTimeout(() => {
        if (this.activeIntervals.has(checkInterval)) {
          clearInterval(checkInterval);
          this.activeIntervals.delete(checkInterval);
        }
        if (sliderState.isAnimatingEnter) {
          logger.warn(`⚠️ Enter animation flag still true after ${SLIDER_ANIMATION.FALLBACK_TIMEOUT}ms - forcing slide change`);
        }
        if (slideIndex >= 0 && slideIndex < this.totalSlides) {
          this.currentSlide = slideIndex;
          gameState.set('currentSlide', slideIndex);
          this.updateSlider(true);
        }
      }, SLIDER_ANIMATION.FALLBACK_TIMEOUT);
      
      return;
    }
    
    if (slideIndex >= 0 && slideIndex < this.totalSlides) {
      this.currentSlide = slideIndex;
      gameState.set('currentSlide', slideIndex);
      this.updateSlider(true);
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
    
    logger.info(`🎯 updateSlider: currentSlide=${this.currentSlide}, slideWidth=${slideWidth}, offset=${offset}, forceAnimate=${forceAnimate}`);
    
    // Kill previous animation if exists
    if (this.slideAnimation) {
      logger.debug(`🛑 Killing previous animation before starting new one`);
      this.slideAnimation.kill();
      this.slideAnimation = null;
    }
    
    // Use GSAP for premium smooth animation with slight bounce
    // Only animate if not dragging (during drag, we want instant updates)
    if (!this.isDragging) {
      // Get current position from GSAP (quickSetter keeps it in sync)
      // 🔥 CRITICAL FIX: Handle null/undefined from gsap.getProperty() properly
      const gsapX = gsap.getProperty(this.elements.wrapper, 'x');
      const currentX = (typeof gsapX === 'number' && !isNaN(gsapX)) ? gsapX : 0;
      
      logger.debug(`🎯 updateSlider: currentX=${currentX}, target offset=${offset}, difference=${Math.abs(currentX - offset)}, forceAnimate=${forceAnimate}`);
      
      // 🔥 CRITICAL FIX: If forceAnimate is true, ALWAYS animate (ignore position check)
      // This ensures nav button clicks ALWAYS trigger smooth animation, even if positions appear identical
      // Nav buttons should ALWAYS animate for premium UX, never instant jump
      // 🔥 CRITICAL: forceAnimate takes precedence - if true, animate regardless of position difference
      const shouldAnimate = forceAnimate || Math.abs(currentX - offset) > SLIDER_CONFIG.POSITION_DIFF_THRESHOLD;
      
      if (shouldAnimate) {
        logger.info(`🎬 Animating slider: currentX=${currentX} → offset=${offset}, forceAnimate=${forceAnimate}, difference=${Math.abs(currentX - offset)}`);
        // 🔥 CRITICAL FIX: Ensure GSAP wrapper is ready before animating
        // Sometimes GSAP needs a frame to be ready after init
        // 🔥 FIX: Track RAF for proper cleanup
        const rafId = requestAnimationFrame(() => {
          this.activeRAFs.delete(rafId);
          
          // 🔥 SAFETY: Check if destroyed during RAF wait
          if (!this.isInitialized || !this.elements.wrapper) {
            logger.debug('⚠️ Slider destroyed during RAF wait - skipping animation');
            return;
          }
          
          // 🔥 SMOOTH: Use smooth easing instead of bounce for fluid, non-jerky animation
          // 🔥 CRITICAL FIX: Use 'auto' overwrite instead of true to prevent killing animations before they start
          // 'auto' only overwrites conflicting properties, not all animations
          this.slideAnimation = gsap.to(this.elements.wrapper, {
            x: offset,
            duration: SLIDER_CONFIG.SLIDE_DURATION_S,
            ease: SLIDER_CONFIG.SLIDE_EASING,
            force3D: true, // GPU acceleration
            overwrite: 'auto', // 🔥 FIX: 'auto' instead of true - prevents killing animation before it starts
            onStart: () => {
              logger.info(`🎬 GSAP animation STARTED: ${offset}px`);
            },
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
              logger.info(`✅ updateSlider: Animation completed, final x=${gsap.getProperty(this.elements.wrapper, 'x')}`);
            }
          });
          logger.info(`✅ GSAP animation started: ${offset}px`);
        });
        this.activeRAFs.add(rafId);
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
    
    // Update dots - 🔥 FIX: Simple null check
    if (this.elements.dots && this.elements.dots.length > 0) {
      this.elements.dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === this.currentSlide);
      });
    }
    
    // Update independent navigation buttons with smooth ease-in ease-out animations
    // Use requestAnimationFrame to ensure animations start after layout is stable
    // 🔥 FIX: Track RAF for proper cleanup
    const navRafId = requestAnimationFrame(() => {
      this.activeRAFs.delete(navRafId);
      
      // 🔥 SAFETY: Check if destroyed during RAF wait
      if (!this.isInitialized) {
        logger.debug('⚠️ Slider destroyed during nav RAF wait - skipping nav animation');
        return;
      }
      
      // 🔥 FIX: Kill previous nav button animations before starting new ones
      this.navButtonAnimations.forEach(tween => {
        try { tween.kill(); } catch {}
      });
      this.navButtonAnimations = [];
      
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
        // 🔥 FIX: Track animations for proper cleanup
        if (isActive) {
          // Animate to active state - smooth ease-in ease-out from current position
          const buttonTween = gsap.to(navButton, {
            width: SLIDER_CONFIG.NAV_BUTTON_ACTIVE_SIZE,
            height: SLIDER_CONFIG.NAV_BUTTON_ACTIVE_SIZE,
            duration: SLIDER_CONFIG.NAV_BUTTON_ANIM_DURATION_S,
            ease: SLIDER_CONFIG.NAV_BUTTON_EASING,
            force3D: true
          });
          this.navButtonAnimations.push(buttonTween);
          
          if (navImage) {
            const imageTween = gsap.to(navImage, {
              y: SLIDER_CONFIG.NAV_IMAGE_ACTIVE_Y,
              duration: SLIDER_CONFIG.NAV_BUTTON_ANIM_DURATION_S,
              ease: SLIDER_CONFIG.NAV_BUTTON_EASING,
              force3D: true
            });
            this.navButtonAnimations.push(imageTween);
          }
        } else {
          // Animate to inactive state - smooth ease-in ease-out from current position
          const buttonTween = gsap.to(navButton, {
            width: SLIDER_CONFIG.NAV_BUTTON_INACTIVE_SIZE,
            height: SLIDER_CONFIG.NAV_BUTTON_INACTIVE_SIZE,
            duration: SLIDER_CONFIG.NAV_BUTTON_ANIM_DURATION_S,
            ease: SLIDER_CONFIG.NAV_BUTTON_EASING,
            force3D: true
          });
          this.navButtonAnimations.push(buttonTween);
          
          if (navImage) {
            const imageTween = gsap.to(navImage, {
              y: SLIDER_CONFIG.NAV_IMAGE_INACTIVE_Y,
              duration: SLIDER_CONFIG.NAV_BUTTON_ANIM_DURATION_S,
              ease: SLIDER_CONFIG.NAV_BUTTON_EASING,
              force3D: true
            });
            this.navButtonAnimations.push(imageTween);
          }
        }
      });
    });
    this.activeRAFs.add(navRafId);
    
    // Update slides - 🔥 FIX: Simple null check
    if (this.elements.slides && this.elements.slides.length > 0) {
      this.elements.slides.forEach((slide, index) => {
        slide.classList.toggle('active', index === this.currentSlide);
      });
    } else {
      logger.warn('⚠️ this.elements.slides is null or empty in updateSlider');
    }
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
  
  // 🔥 NEW API: Check if slider is initialized (public getter for external checks)
  get isSliderInitialized(): boolean {
    return this.isInitialized;
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
    
    // 🔥 CRITICAL FIX: Check for null (not empty object) - this is now properly null after destroy()
    const slidesInvalid = !this.elements.slides || this.elements.slides.length === 0;
    const dotsInvalid = !this.elements.dots || this.elements.dots.length === 0;
    
    if (!this.isInitialized || slidesInvalid || dotsInvalid) {
      logger.warn('⚠️ Slider not properly initialized in setSlideInstant - calling ensureReady()');
      this.ensureReady();
      
      // Re-check after ensureReady
      if (!this.elements.slides || this.elements.slides.length === 0) {
        logger.warn('⚠️ Slider elements still not valid after ensureReady - continuing with graceful degradation');
      }
    }
    
    logger.info(`🎯 setSlideInstant: Setting slide to ${slideIndex} (atomic update)`);
    
    // 1. Update internal state
    this.currentSlide = slideIndex;
    
    // 2. Update gameState
    if (gameState && gameState.set) {
      gameState.set('currentSlide', slideIndex);
    }
    
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
    // 🔥 FIX: Simple null check - slides is now properly null when not initialized
    if (this.elements.slides && this.elements.slides.length > 0) {
      this.elements.slides.forEach((slide, index) => {
        if (index === slideIndex) {
          slide.classList.add('active');
        } else {
          slide.classList.remove('active');
        }
      });
    } else {
      logger.warn('⚠️ this.elements.slides is null or empty - cannot update slide classes');
    }
    
    // 5. Update dots
    // 🔥 FIX: Simple null check - dots is now properly null when not initialized
    if (this.elements.dots && this.elements.dots.length > 0) {
      this.elements.dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === slideIndex);
      });
    } else {
      logger.warn('⚠️ this.elements.dots is null or empty - cannot update dot classes');
    }
    
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
    
    // 🔥 CRITICAL FIX: Simple null checks - elements are now null after destroy(), not empty objects
    const slidesInvalid = !this.elements.slides || this.elements.slides.length === 0;
    const dotsInvalid = !this.elements.dots || this.elements.dots.length === 0;
    const containerInvalid = !this.elements.container;
    const wrapperInvalid = !this.elements.wrapper;
    
    // 🔥 FIX: Check if nav button event handlers exist - if not, we need to reinitialize
    const navButtonsNeedHandlers = !this.boundHandlers.navButtonClick || this.boundHandlers.navButtonClick.size === 0;
    
    // 1. Reinitialize if not initialized OR if elements are invalid OR if nav handlers are missing
    if (!this.isInitialized || slidesInvalid || dotsInvalid || containerInvalid || wrapperInvalid || navButtonsNeedHandlers) {
      logger.warn('⚠️ Slider not properly initialized or elements/handlers invalid - reinitializing now');
      logger.debug(`🔍 Debug: isInitialized=${this.isInitialized}, slidesInvalid=${slidesInvalid}, dotsInvalid=${dotsInvalid}, containerInvalid=${containerInvalid}, wrapperInvalid=${wrapperInvalid}, navButtonsNeedHandlers=${navButtonsNeedHandlers}`);
      
      // 🔥 CRITICAL: Force destroy first to clean up stale state, then reinitialize
      if (this.isInitialized) {
        this.destroy();
      }
      this.init();
      
      // 🔥 FIX: After init, also ensure navigation and slider container are interactive
      this.ensureInteractive();
      return; // init() will handle everything
    }
    
    // 2. Refresh element references (in case DOM changed)
    this.elements.container = document.getElementById('slider-container');
    this.elements.wrapper = document.getElementById('slider-wrapper');
    this.elements.slides = document.querySelectorAll('.slider-slide');
    this.elements.dots = document.querySelectorAll('.slider-dot');
    
    // 3. Unlock slider
    gameState.set('sliderLocked', false);
    
    // 4. Ensure pointer events are enabled and container is fully visible
    this.ensureInteractive();
    
    // 5. Ensure quickSetter exists
    if (!this.quickSetX && this.elements.wrapper) {
      this.quickSetX = gsap.quickSetter(this.elements.wrapper, 'x', 'px') as (value: number) => void;
      logger.debug('✅ GSAP quickSetter recreated');
    }
    
    logger.info('✅ ensureReady: Slider ready for interaction');
  }
  
  /**
   * 🔥 NEW: Ensure all slider and navigation elements are interactive
   * Resets pointer-events and visibility on all critical elements
   */
  private ensureInteractive(): void {
    // Ensure slider container is interactive
    if (this.elements.container) {
      this.elements.container.style.pointerEvents = 'auto';
      this.elements.container.style.display = 'block';
      this.elements.container.style.visibility = 'visible';
      this.elements.container.style.opacity = '1';
      this.elements.container.style.zIndex = '';
      logger.debug('✅ Slider container pointer events enabled and visibility ensured');
    }
    
    // 🔥 FIX: Ensure independent navigation is also interactive
    const independentNav = document.getElementById('independent-nav');
    if (independentNav) {
      independentNav.style.pointerEvents = 'auto';
      independentNav.style.display = 'block';
      independentNav.style.visibility = 'visible';
      independentNav.style.opacity = '1';
      logger.debug('✅ Independent navigation pointer events enabled and visibility ensured');
    }
    
    // 🔥 FIX: Ensure all navigation buttons are interactive
    const navButtons = document.querySelectorAll('.independent-nav-button');
    navButtons.forEach((button) => {
      const btn = button as HTMLElement;
      btn.style.pointerEvents = 'auto';
      btn.style.cursor = 'pointer';
    });
    if (navButtons.length > 0) {
      logger.debug(`✅ ${navButtons.length} navigation buttons pointer events enabled`);
    }
    
    // 🔥 FIX: Ensure slider wrapper is interactive for drag
    if (this.elements.wrapper) {
      this.elements.wrapper.style.pointerEvents = 'auto';
    }
  }
  
  // Cleanup
  destroy(): void {
    // 🔥 FIX: Clear all active intervals first
    this.activeIntervals.forEach(interval => {
      clearInterval(interval);
    });
    this.activeIntervals.clear();
    logger.info('🧹 Active intervals cleared');
    
    // 🔥 FIX: Cancel all pending requestAnimationFrame calls
    this.activeRAFs.forEach(rafId => {
      cancelAnimationFrame(rafId);
    });
    this.activeRAFs.clear();
    logger.info('🧹 Active RAFs cancelled');
    
    // 🔥 FIX: Kill all nav button animations
    this.navButtonAnimations.forEach(tween => {
      try { tween.kill(); } catch {}
    });
    this.navButtonAnimations = [];
    logger.info('🧹 Nav button animations killed');
    
    // Kill GSAP animation if exists
    if (this.slideAnimation) {
      this.slideAnimation.kill();
      this.slideAnimation = null;
    }
    
    // 🔥 MEMORY LEAK FIX: Cleanup GSAP quickSetter
    if (this.quickSetX && this.elements.wrapper) {
      try {
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
    
    // 🔥 FIX: Use null instead of empty objects to prevent forEach errors
    this.elements = {
      container: null,
      wrapper: null,
      slides: null,
      dots: null,
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
