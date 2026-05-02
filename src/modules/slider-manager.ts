// Slider Manager Module
// Handles slider functionality and navigation

import { gsap } from 'gsap';
import gameState from './game-state.js';
import animationManager from './animation-manager.js';
import { logger } from '../core/logger.js';
import { SLIDER_ANIMATION, SLIDER_CONFIG, getNavButtonActiveSize, getNavButtonInactiveSize } from '../constants/animations.js';
import { sliderState } from './slider-state.js';
import { resetAnimationFlags } from '../utils/animations.js';
import { getOriginalGsapTo } from './drag-core.js';
import { isSlideVisible } from './shop-module.js';

// 🔥 CRITICAL FIX: Use original GSAP functions to prevent infinite recursion
const trackTween = (target: any, vars: any) => {
  const origTo = getOriginalGsapTo();
  return animationManager.trackExternalTween(origTo(target, vars));
};

// Type definitions
interface SliderElements {
  container: HTMLElement | null;
  wrapper: HTMLElement | null;
  slides: NodeListOf<Element> | null;  // 🔥 FIX: Allow null to prevent empty object hack
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
  private velocityThreshold: number = SLIDER_CONFIG.SWIPE_VELOCITY_THRESHOLD_PX_PER_MS;
  private isInitialized: boolean = false;
  private slideAnimation: gsap.core.Tween | null = null;
  private quickSetX: ((value: number) => void) | null = null;
  private lastReinitAt: number = 0;
  private elements: SliderElements = {
    container: null,
    wrapper: null,
    slides: null,  // 🔥 FIX: Use null instead of empty object hack
    divider: null
  };
  
  // 🔥 FIX: Track active intervals for proper cleanup
  private activeIntervals: Set<ReturnType<typeof setInterval>> = new Set();
  
  // 🔥 FIX: Track active requestAnimationFrame IDs for proper cleanup
  private activeRAFs: Set<number> = new Set();
  
  // 🔥 FIX: Track nav button GSAP animations for proper cleanup
  private navButtonAnimations: gsap.core.Tween[] = [];
  private gestureLastX: number = 0;
  private gestureLastTs: number = 0;
  private gestureVelocityX: number = 0;

  private getSlideStep(direction: 1 | -1): number | null {
    let target = this.currentSlide + direction;
    while (target >= 0 && target < this.totalSlides) {
      if (isSlideVisible(target)) return target;
      target += direction;
    }
    return null;
  }

  private resolveHiddenSlideTarget(slideIndex: number): number {
    if (isSlideVisible(slideIndex)) return slideIndex;
    const direction: 1 | -1 = slideIndex > this.currentSlide ? 1 : -1;
    return this.getSlideStep(direction) ?? this.currentSlide;
  }

  // 🔥 MEMORY LEAK FIX: Store bound event handlers and unsubscribe functions for cleanup
  private boundHandlers: {
    touchStart?: (e: SliderTouchEvent) => void;
    touchMove?: (e: SliderTouchEvent) => void;
    touchEnd?: (e: SliderTouchEvent) => void;
    mouseDown?: (e: SliderMouseEvent) => void;
    mouseMove?: (e: SliderMouseEvent) => void;
    mouseUp?: (e: SliderMouseEvent) => void;
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
    this.velocityThreshold = SLIDER_CONFIG.SWIPE_VELOCITY_THRESHOLD_PX_PER_MS;
    this.isInitialized = false;
    
    this.elements = {
      container: null,
      wrapper: null,
      slides: null,  // 🔥 FIX: Use null instead of empty object hack
      divider: null
    };
  }

  private resetGestureVelocity(x: number): void {
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    this.gestureLastX = x;
    this.gestureLastTs = now;
    this.gestureVelocityX = 0;
  }

  private updateGestureVelocity(x: number): void {
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const dt = now - this.gestureLastTs;
    if (dt > 0) {
      this.gestureVelocityX = (x - this.gestureLastX) / dt; // px/ms
    }
    this.gestureLastX = x;
    this.gestureLastTs = now;
  }

  private commitGesture(deltaX: number, velocityX: number): void {
    const passesDistance = Math.abs(deltaX) > this.threshold;
    const passesVelocity = Math.abs(velocityX) >= this.velocityThreshold;
    const shouldChangeSlide = passesDistance || passesVelocity;

    if (shouldChangeSlide) {
      const directionSignal = Math.abs(deltaX) > 0 ? deltaX : velocityX;
      if (directionSignal > 0) {
        this.previousSlide();
      } else {
        this.nextSlide();
      }
    } else {
      // Snap back to current slide
      this.updateSlider();
    }
  }
  
  // Initialize slider
  init(): void {
    // 🔥 MEMORY LEAK FIX: Clean up before reinitializing (prevents duplicate event listeners)
    if (this.isInitialized) {
      logger.debug('Slider Manager already initialized - cleaning up before reinitializing');
      this.destroy();
    }
    
    try {
      // Cache elements
      this.elements = {
        container: document.getElementById('slider-container'),
        wrapper: document.getElementById('slider-wrapper'),
        slides: document.querySelectorAll('.slider-slide'),
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
      
      // 🔥 DEBUG: Log complete state after initialization
      logger.debug('SLIDER INIT COMPLETE', undefined, {
        isInitialized: this.isInitialized,
        sliderLocked: gameState.get('sliderLocked'),
        isAnimatingEnter: sliderState.isAnimatingEnter,
        isAnimatingExit: sliderState.isAnimatingExit,
        containerExists: !!this.elements.container,
        containerPointerEvents: this.elements.container?.style.pointerEvents || 'not set',
        hasEventHandlers: !!this.boundHandlers.touchStart && !!this.boundHandlers.mouseDown
      });
      
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
    
    // 🔥 SWIPE FIX: Re-enable global swipe detection for Journey screen horizontal swipes
    // The CSS pointer-events approach alone doesn't work because .collectibles-scrollable
    // has pointer-events: auto for vertical scrolling, which blocks horizontal swipes.
    // Global swipe detection intercepts horizontal gestures and triggers slider transitions.
    this.setupGlobalSwipeDetection();
    
    // Independent navigation buttons
    this.boundHandlers.navButtonClick = new Map();
    const navButtons = document.querySelectorAll('.independent-nav-button');
    navButtons.forEach((button) => {
      const handler = () => {
        // Light haptic for nav buttons
        if (typeof (window as any).triggerHapticImpact === 'function') {
          (window as any).triggerHapticImpact('light');
        }
        const slideIndex = parseInt(button.getAttribute('data-slide') || '0', 10);
        this.goToSlide(slideIndex);
      };
      this.boundHandlers.navButtonClick!.set(button, handler);
      button.addEventListener('click', handler);
    });
  }
  
  // 🔥 FIX: Setup global swipe detection to allow horizontal swipes through overlays like journey-screen
  private globalSwipeState = {
    isTracking: false,
    startX: 0,
    startY: 0,
    isHorizontalSwipe: false,
    journeyScreenDisabled: false
  };
  
  private setupGlobalSwipeDetection(): void {
    // Listen at document level to intercept events before journey-screen
    // 🔥 FIX: Instead of dispatching synthetic events (which have wrong positions),
    // directly manipulate slider's internal state for reliable horizontal swipe handling
    
    // 🔥 BUTTON FIX: Check if touch started on an interactive element that should NOT trigger swipes
    const isInteractiveElement = (target: EventTarget | null): boolean => {
      if (!target || !(target instanceof Element)) return false;
      
      const element = target as Element;
      
      // Check the element and its ancestors for interactive elements
      let current: Element | null = element;
      while (current) {
        // Check tag names
        const tagName = current.tagName.toLowerCase();
        if (tagName === 'button' || tagName === 'a' || tagName === 'input' || tagName === 'select' || tagName === 'textarea') {
          return true;
        }
        
        // Check common interactive class names and IDs
        // Note: SVGAnimatedString requires special handling
        const className = typeof current.className === 'string' 
          ? current.className 
          : ((current.className as any)?.baseVal || current.getAttribute('class') || '');
        const id = current.id || '';
        
        // Navigation buttons and icons
        if (className.includes('independent-nav') || className.includes('nav-button') || className.includes('nav-icon')) {
          return true;
        }
        if (id.includes('independent-nav') || id.includes('nav-')) {
          return true;
        }
        
        // CTA buttons, play buttons, action buttons, slide buttons
        if (className.includes('cta') || className.includes('play-button') || className.includes('action-button') || 
            className.includes('slide-button') || className.includes('menu-btn') || className.includes('tap-scale')) {
          return true;
        }
        if (id.includes('cta') || id.includes('play-button') || id.includes('board-detail-play-button')) {
          return true;
        }
        
        // Journey cards and detail modal buttons
        if (className.includes('journey-board-card') || className.includes('journey-floating')) {
          return true;
        }
        
        // Collectibles header (back button, title)
        if (className.includes('collectibles-header') || className.includes('collectibles-back') || 
            className.includes('detail-back') || className.includes('back-btn')) {
          return true;
        }
        if (id === 'collectibles-back' || id === 'collectibles-title' || id === 'detail-back-btn') {
          return true;
        }
        
        // Homepage slide content (buttons, taglines)
        if (className.includes('slide-content') || className.includes('hero-container')) {
          // Only exclude if it's actually a button or CTA within
          if (current.querySelector('button, .slide-button, .cta')) {
            return true;
          }
        }
        
        // Generic interactive indicators
        if (current.getAttribute('role') === 'button' || current.hasAttribute('onclick') || current.hasAttribute('data-clickable')) {
          return true;
        }
        
        // Check cursor style - if pointer, likely interactive
        const style = window.getComputedStyle(current);
        if (style.cursor === 'pointer') {
          return true;
        }
        
        current = current.parentElement;
      }
      
      return false;
    };
    
    const handleGlobalTouchStart = (e: TouchEvent) => {
      if (gameState.get('sliderLocked')) return;
      
      const touch = e.touches[0];
      if (!touch) return;
      
      // 🔥 BUTTON FIX: Don't track swipes that start on interactive elements
      // These should be handled as clicks/taps, not swipes
      const targetEl = e.target as Element;
      const isInteractive = isInteractiveElement(e.target);
      
      const targetClassName =
        targetEl && typeof targetEl.className === 'string'
          ? targetEl.className
          : (targetEl && (targetEl.className as any)?.baseVal) || '';
      const parentElement = targetEl ? targetEl.parentElement : null;
      const parentClassName =
        parentElement && typeof parentElement.className === 'string' ? parentElement.className : '';

      // Debug log for all touches to see what's happening
      logger.debug('Touch start', undefined, {
        isInteractive,
        tagName: targetEl?.tagName,
        className: targetClassName.slice(0, 60),
        id: targetEl?.id,
        parentTag: parentElement?.tagName,
        parentClass: parentClassName.slice(0, 40)
      });
      
      if (isInteractive) {
        logger.debug('Touch on interactive element - not tracking swipe');
        this.globalSwipeState.isTracking = false;
        return;
      }
      
      this.globalSwipeState.isTracking = true;
      this.globalSwipeState.startX = touch.clientX;
      this.globalSwipeState.startY = touch.clientY;
      this.globalSwipeState.isHorizontalSwipe = false;
      this.globalSwipeState.journeyScreenDisabled = false;
    };
    
    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (!this.globalSwipeState.isTracking || gameState.get('sliderLocked')) return;
      
      const touch = e.touches[0];
      if (!touch) return;
      
      const deltaX = Math.abs(touch.clientX - this.globalSwipeState.startX);
      const deltaY = Math.abs(touch.clientY - this.globalSwipeState.startY);
      
      // If horizontal movement is greater than vertical and exceeds threshold
      // This is a horizontal swipe - directly control slider's internal drag state
      // 🔥 SWIPE FIX: Do NOT set pointer-events: none on journey-screen!
      // That breaks button clicks. Instead, just directly control the slider.
      if (deltaX > 10 && deltaX > deltaY * 1.5 && !this.globalSwipeState.isHorizontalSwipe) {
        this.globalSwipeState.isHorizontalSwipe = true;
        logger.debug('Horizontal swipe detected - starting slider drag');
        
        // 🔥 FIX: Directly set slider's internal drag state with ORIGINAL start position
        // This bypasses the synthetic event issue where positions were the same
        this.isDragging = true;
        this.startX = this.globalSwipeState.startX; // Use ORIGINAL touch start position!
        this.currentX = touch.clientX;
        this.resetGestureVelocity(this.currentX);
        
        // Add dragging class
        if (this.elements.container) {
          this.elements.container.classList.add('dragging');
        }
        
        // Immediately update slider position with correct deltaX
        const swipeDeltaX = this.currentX - this.startX;
        logger.debug('Initial swipe deltaX', undefined, { swipeDeltaX });
        this.updateSliderPosition(swipeDeltaX);
      }
      
      // 🔥 FIX: Continue updating slider position while in horizontal swipe mode
      if (this.globalSwipeState.isHorizontalSwipe && this.isDragging) {
        this.currentX = touch.clientX;
        this.updateGestureVelocity(this.currentX);
        const swipeDeltaX = this.currentX - this.startX;
        this.updateSliderPosition(swipeDeltaX);
      }
    };
    
    const handleGlobalTouchEnd = (e: TouchEvent) => {
      // 🔥 FIX: Complete the swipe gesture by calling slider's touch end logic
      if (this.globalSwipeState.isHorizontalSwipe && this.isDragging) {
        this.isDragging = false;
        const deltaX = this.currentX - this.startX;
        
        // Remove dragging class
        if (this.elements.container) {
          this.elements.container.classList.remove('dragging');
        }
        
        logger.debug('Swipe ended', undefined, { deltaX, threshold: this.threshold });

        this.commitGesture(deltaX, this.gestureVelocityX);
      }
      
      // 🔥 SWIPE FIX: No longer manipulating journey-screen pointer-events
      // This was causing button clicks to break. We now only control slider's internal state.
      
      this.globalSwipeState.isTracking = false;
      this.globalSwipeState.isHorizontalSwipe = false;
      this.globalSwipeState.journeyScreenDisabled = false;
    };
    
    // Store handlers for cleanup
    (this.boundHandlers as any).globalTouchStart = handleGlobalTouchStart;
    (this.boundHandlers as any).globalTouchMove = handleGlobalTouchMove;
    (this.boundHandlers as any).globalTouchEnd = handleGlobalTouchEnd;
    
    document.addEventListener('touchstart', handleGlobalTouchStart, { capture: true, passive: true });
    document.addEventListener('touchmove', handleGlobalTouchMove, { capture: true, passive: true });
    document.addEventListener('touchend', handleGlobalTouchEnd, { capture: true, passive: true });
    document.addEventListener('touchcancel', handleGlobalTouchEnd, { capture: true, passive: true });
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
    // 🔥 DEBUG: Log every touch start to verify events are being received
    const isLocked = gameState.get('sliderLocked');
    const isAnimating = sliderState.isAnimatingEnter || sliderState.isAnimatingExit;
    logger.debug('TOUCH START', undefined, { isLocked, isAnimating, isDragging: this.isDragging });
    
    if (isLocked) {
      logger.debug('TOUCH BLOCKED', undefined, { isLocked });
      return;
    }
    
    this.isDragging = true;
    const touch = event.touches[0];
    if (!touch) return;
    this.startX = touch.clientX;
    this.currentX = this.startX;
    this.resetGestureVelocity(this.currentX);
    
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
    this.updateGestureVelocity(this.currentX);
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
    
    this.commitGesture(deltaX, this.gestureVelocityX);
  }
  
  // Handle mouse down
  private handleMouseDown(event: SliderMouseEvent): void {
    // 🔥 DEBUG: Log every mouse down to verify events are being received
    const isLocked = gameState.get('sliderLocked');
    const isAnimating = sliderState.isAnimatingEnter || sliderState.isAnimatingExit;
    logger.debug('MOUSE DOWN', undefined, { isLocked, isAnimating, isDragging: this.isDragging });
    
    if (isLocked) {
      logger.debug('MOUSE BLOCKED', undefined, { isLocked });
      return;
    }
    
    this.isDragging = true;
    this.startX = event.clientX;
    this.currentX = this.startX;
    this.resetGestureVelocity(this.currentX);
    
    // Add dragging class
    if (this.elements.container) {
      this.elements.container.classList.add('dragging');
    }
  }
  
  // Handle mouse move
  private handleMouseMove(event: SliderMouseEvent): void {
    if (!this.isDragging || gameState.get('sliderLocked')) return;
    
    this.currentX = event.clientX;
    this.updateGestureVelocity(this.currentX);
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
    
    this.commitGesture(deltaX, this.gestureVelocityX);
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
    slideIndex = this.resolveHiddenSlideTarget(slideIndex);
    // 🔥 DEBUG: Log every goToSlide call
    const isLocked = gameState.get('sliderLocked');
    const isAnimating = sliderState.isAnimatingEnter;
    logger.debug('GO TO SLIDE', undefined, { slideIndex, isLocked, isAnimating, currentSlide: this.currentSlide });
    
    if (isLocked) {
      logger.debug('SLIDE BLOCKED', undefined, { slideIndex });
      return;
    }
    
    // 🔥 CRITICAL FIX: Ensure isDragging is false before slide change
    // This prevents drag state from blocking nav button animations
    if (this.isDragging) {
      logger.debug('isDragging was true during goToSlide - resetting to false');
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
      
      // Fallback timeout using constant - also reset stuck animation flag
      setTimeout(() => {
        if (this.activeIntervals.has(checkInterval)) {
          clearInterval(checkInterval);
          this.activeIntervals.delete(checkInterval);
        }
        if (sliderState.isAnimatingEnter) {
          logger.warn(`⚠️ Enter animation flag still true after ${SLIDER_ANIMATION.FALLBACK_TIMEOUT}ms - FORCE RESETTING FLAG`);
          sliderState.setAnimatingEnter(false); // 🔥 FIX: Reset stuck flag
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
    const next = this.getSlideStep(1);
    if (next !== null) {
      this.goToSlide(next);
    } else {
      // Last slide: snap back with bounce
      this.updateSlider();
    }
  }
  
  // Go to previous slide
  previousSlide(): void {
    // iOS SAFETY: Prevent going beyond first slide
    const previous = this.getSlideStep(-1);
    if (previous !== null) {
      this.goToSlide(previous);
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
    
    logger.debug(`updateSlider`, undefined, { currentSlide: this.currentSlide, slideWidth, offset, forceAnimate });
    
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
          this.slideAnimation = trackTween(this.elements.wrapper, {
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
      navButtons.forEach((button) => {
        const slideIndex = parseInt(button.getAttribute('data-slide') || '0', 10);
        const isActive = slideIndex === this.currentSlide;
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
          const buttonTween = trackTween(navButton, {
            width: getNavButtonActiveSize(),
            height: getNavButtonActiveSize(),
            duration: SLIDER_CONFIG.NAV_BUTTON_ANIM_DURATION_S,
            ease: SLIDER_CONFIG.NAV_BUTTON_EASING,
            force3D: true
          });
          this.navButtonAnimations.push(buttonTween);
          
          if (navImage) {
            const imageTween = trackTween(navImage, {
              y: SLIDER_CONFIG.NAV_IMAGE_ACTIVE_Y,
              duration: SLIDER_CONFIG.NAV_BUTTON_ANIM_DURATION_S,
              ease: SLIDER_CONFIG.NAV_BUTTON_EASING,
              force3D: true
            });
            this.navButtonAnimations.push(imageTween);
          }
        } else {
          // Animate to inactive state - smooth ease-in ease-out from current position
          const buttonTween = trackTween(navButton, {
            width: getNavButtonInactiveSize(),
            height: getNavButtonInactiveSize(),
            duration: SLIDER_CONFIG.NAV_BUTTON_ANIM_DURATION_S,
            ease: SLIDER_CONFIG.NAV_BUTTON_EASING,
            force3D: true
          });
          this.navButtonAnimations.push(buttonTween);
          
          if (navImage) {
            const imageTween = trackTween(navImage, {
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
      logger.debug('updateSlider: slides missing or empty');
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
  
  // 🔥 DEBUG: Getter for isDragging (for diagnostics)
  getIsDragging(): boolean {
    return this.isDragging;
  }
  
  // 🔥 DEBUG: Getter for isInitialized (for diagnostics)
  getIsInitialized(): boolean {
    return this.isInitialized;
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
    slideIndex = this.resolveHiddenSlideTarget(slideIndex);
    if (slideIndex < 0 || slideIndex >= this.totalSlides) {
      logger.warn(`⚠️ Invalid slide index: ${slideIndex}`);
      return;
    }
    
    // 🔥 CRITICAL FIX: Check for null (not empty object) - this is now properly null after destroy()
    const slidesInvalid = !this.elements.slides || this.elements.slides.length === 0;
    // Navigation uses .independent-nav-button elements
    
    if (!this.isInitialized || slidesInvalid) {
      logger.debug('setSlideInstant: slider not initialized - calling ensureReady');
      this.ensureReady();
      
      // Re-check after ensureReady
      if (!this.elements.slides || this.elements.slides.length === 0) {
        logger.debug('setSlideInstant: elements still not valid after ensureReady');
      }
    }
    
    logger.debug('setSlideInstant: Setting slide', undefined, { slideIndex });
    
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
      logger.debug('setSlideInstant: slides missing or empty - cannot update slide classes');
    }
    
    // 5. Update navigation buttons
    const navButtons = document.querySelectorAll('.independent-nav-button');
    navButtons.forEach((button) => {
      const buttonSlideIndex = parseInt(button.getAttribute('data-slide') || '0', 10);
      if (buttonSlideIndex === slideIndex) {
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
    
    // 🔥 V140 FIX: Reset animation flags to allow animateSliderEnter() to run
    // Without this, the isAnimatingEnter flag could be stuck true and block animations
    try {
      resetAnimationFlags();
      sliderState.reset();
      logger.info('✅ Animation flags reset in ensureReady()');
    } catch (e) {
      logger.warn('⚠️ Failed to reset animation flags in ensureReady:', e);
    }
    
    // 🔥 CRITICAL FIX: Simple null checks - elements are now null after destroy(), not empty objects
    const slidesInvalid = !this.elements.slides || this.elements.slides.length === 0;
    // Navigation uses .independent-nav-button elements
    const containerInvalid = !this.elements.container;
    const wrapperInvalid = !this.elements.wrapper;
    
    // 🔥 FIX: Check if nav button event handlers exist - if not, we need to reinitialize
    const navButtonsNeedHandlers = !this.boundHandlers.navButtonClick || this.boundHandlers.navButtonClick.size === 0;
    
    // 1. Reinitialize if not initialized OR if elements are invalid OR if nav handlers are missing
    if (!this.isInitialized || slidesInvalid || containerInvalid || wrapperInvalid || navButtonsNeedHandlers) {
      const now = Date.now();
      if (now - this.lastReinitAt < 2000) {
        logger.debug('ensureReady: reinit throttled', undefined, { isInitialized: this.isInitialized, slidesInvalid, containerInvalid, wrapperInvalid, navButtonsNeedHandlers });
        this.ensureInteractive();
        return;
      }
      this.lastReinitAt = now;
      logger.debug('ensureReady: reinitializing slider', undefined, { isInitialized: this.isInitialized, slidesInvalid, containerInvalid, wrapperInvalid, navButtonsNeedHandlers });
      
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
    
    // 3. Unlock slider
    gameState.set('sliderLocked', false);
    
    // 4. Ensure pointer events are enabled and container is fully visible
    this.ensureInteractive();
    
    // 5. Ensure quickSetter exists
    if (!this.quickSetX && this.elements.wrapper) {
      this.quickSetX = gsap.quickSetter(this.elements.wrapper, 'x', 'px') as (value: number) => void;
      logger.debug('✅ GSAP quickSetter recreated');
    }
    
    logger.debug('ensureReady: Slider ready for interaction');
  }
  
  /**
   * 🔥 NEW: Ensure all slider and navigation elements are interactive
   * Resets pointer-events and visibility on all critical elements
   */
  private ensureInteractive(): void {
    // 🔥 DEBUG: Always use fresh DOM references
    const container = document.getElementById('slider-container');
    const wrapper = document.getElementById('slider-wrapper');
    
    // Ensure slider container is interactive
    if (container) {
      container.style.pointerEvents = 'auto';
      container.style.display = 'block';
      container.style.visibility = 'visible';
      container.style.opacity = '1';
      container.style.zIndex = '';
      // 🔥 Also remove any transform that might hide it
      container.style.transform = '';
      logger.debug('ensureInteractive: container reset', undefined, {
        pointerEvents: container.style.pointerEvents,
        display: container.style.display,
        visibility: container.style.visibility,
        opacity: container.style.opacity
      });
    } else {
      console.error('❌ [ensureInteractive] Slider container NOT FOUND!');
    }
    
    // 🔥 Ensure wrapper is interactive for drag
    if (wrapper) {
      wrapper.style.pointerEvents = 'auto';
      logger.debug('ensureInteractive: wrapper pointerEvents set to auto');
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
  
  /**
   * 🔥 NUCLEAR RESET: Force slider to ready state from ANY frozen condition
   * This is the "panic button" that should recover the slider regardless of what went wrong.
   * Call this when returning from any module (game, collectibles, settings) to guarantee
   * the slider is interactive.
   */
  forceReady(): void {
    logger.debug('FORCE READY: Nuclear slider reset initiated');
    
    // 0. FIRST: Reset LOCAL animation flags in animations.ts SYNCHRONOUSLY
    // This is CRITICAL - animations.ts has its own local flags that aren't synced with sliderState
    // Using synchronous import that was added at top of file
    try {
      resetAnimationFlags();
      logger.info('✅ resetAnimationFlags() called - local animation flags reset');
    } catch (e) {
      logger.warn('⚠️ Failed to reset animation flags:', e);
    }
    
    // 1. ALSO clear sliderState + window globals (belt and suspenders)
    sliderState.reset();
    (window as any).__ccIsAnimatingSliderEnter = false;
    (window as any).__ccIsAnimatingSliderExit = () => false;
    (window as any).__ccUiJourneyTransitioning = false;
    (window as any).__ccIsHidingCollectibles = false;
    logger.info('✅ All animation flags cleared');
    
    // 2. Clear any pending intervals that might be blocking
    this.activeIntervals.forEach(interval => clearInterval(interval));
    this.activeIntervals.clear();
    
    // 3. Clear any pending RAFs
    this.activeRAFs.forEach(raf => cancelAnimationFrame(raf));
    this.activeRAFs.clear();
    
    // 4. Kill any GSAP tweens on slider elements (but not globally!)
    if (this.elements.wrapper) {
      gsap.killTweensOf(this.elements.wrapper);
    }
    if (this.elements.container) {
      gsap.killTweensOf(this.elements.container);
    }
    
    // 5. Reset GSAP position to current slide
    if (this.elements.wrapper && this.elements.container) {
      const slideWidth = this.elements.container.offsetWidth;
      const targetX = -this.currentSlide * slideWidth;
      gsap.set(this.elements.wrapper, { x: targetX });
      logger.info(`✅ GSAP wrapper position reset to slide ${this.currentSlide} (x: ${targetX})`);
    }
    
    // 6. Unlock slider state
    gameState.set('sliderLocked', false);
    gameState.set('isDragging', false);
    this.isDragging = false;
    
    // 7. Refresh element references
    this.elements.container = document.getElementById('slider-container');
    this.elements.wrapper = document.getElementById('slider-wrapper');
    this.elements.slides = document.querySelectorAll('.slider-slide');
    this.elements.divider = document.querySelector('.slider-nav-divider');
    
    // 8. Force pointer events on ALL slider elements
    this.ensureInteractive();
    
    // 🔥 V140 STYLE: Don't manipulate animation classes here!
    // animateSliderEnter() handles all animation - forceReady() only resets slider mechanics
    
    // 9. Recreate quickSetter if needed
    if (this.elements.wrapper) {
      this.quickSetX = gsap.quickSetter(this.elements.wrapper, 'x', 'px') as (value: number) => void;
    }
    
    // 10. If not initialized or handlers missing, reinitialize
    const navButtonsNeedHandlers = !this.boundHandlers.navButtonClick || this.boundHandlers.navButtonClick.size === 0;
    if (!this.isInitialized || navButtonsNeedHandlers) {
      logger.debug('Slider needs reinitialization - doing it now');
      this.destroy();
      this.init();
    }
    
    // 11. Update navigation button active states
    const navButtons = document.querySelectorAll('.independent-nav-button');
    navButtons.forEach((button) => {
      const slideIndex = parseInt(button.getAttribute('data-slide') || '0', 10);
      button.classList.toggle('active', slideIndex === this.currentSlide);
    });
    
    logger.info('✅ FORCE READY: Slider nuclear reset complete - should be fully interactive');
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
    
    // Remove nav button click listeners
    if (this.boundHandlers.navButtonClick) {
      this.boundHandlers.navButtonClick.forEach((handler, button) => {
        button.removeEventListener('click', handler);
      });
      this.boundHandlers.navButtonClick.clear();
    }
    
    // 🔥 FIX: Remove global swipe detection listeners
    if ((this.boundHandlers as any).globalTouchStart) {
      document.removeEventListener('touchstart', (this.boundHandlers as any).globalTouchStart, { capture: true } as any);
    }
    if ((this.boundHandlers as any).globalTouchMove) {
      document.removeEventListener('touchmove', (this.boundHandlers as any).globalTouchMove, { capture: true } as any);
    }
    if ((this.boundHandlers as any).globalTouchEnd) {
      document.removeEventListener('touchend', (this.boundHandlers as any).globalTouchEnd, { capture: true } as any);
      document.removeEventListener('touchcancel', (this.boundHandlers as any).globalTouchEnd, { capture: true } as any);
    }
    // Reset global swipe state
    this.globalSwipeState = {
      isTracking: false,
      startX: 0,
      startY: 0,
      isHorizontalSwipe: false,
      journeyScreenDisabled: false
    };
    
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

// 🔥 DEBUG: Expose diagnostic function to window for debugging frozen slider
(window as any).diagnoseSlider = () => {
  const container = document.getElementById('slider-container');
  const wrapper = document.getElementById('slider-wrapper');
  const nav = document.getElementById('independent-nav');
  const home = document.getElementById('home');
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 SLIDER DIAGNOSTIC REPORT');
  console.log('═══════════════════════════════════════════════════════════');
  
  // 1. State flags
  console.log('\n📊 STATE FLAGS:');
  console.log('  sliderLocked:', gameState.get('sliderLocked'));
  console.log('  isAnimatingEnter:', sliderState.isAnimatingEnter);
  console.log('  isAnimatingExit:', sliderState.isAnimatingExit);
  console.log('  isGameActive:', gameState.get('isGameActive'));
  console.log('  isDragging (internal):', sliderManager.getIsDragging?.() ?? 'N/A');
  console.log('  isInitialized:', sliderManager.getIsInitialized?.() ?? 'N/A');
  
  // 2. DOM elements
  console.log('\n🎯 DOM ELEMENTS:');
  console.log('  container exists:', !!container);
  console.log('  wrapper exists:', !!wrapper);
  console.log('  nav exists:', !!nav);
  console.log('  home exists:', !!home);
  
  // 3. CSS states
  console.log('\n🎨 CSS STATES:');
  if (container) {
    const cs = window.getComputedStyle(container);
    console.log('  container.pointerEvents:', cs.pointerEvents);
    console.log('  container.display:', cs.display);
    console.log('  container.visibility:', cs.visibility);
    console.log('  container.opacity:', cs.opacity);
  }
  if (wrapper) {
    const ws = window.getComputedStyle(wrapper);
    console.log('  wrapper.pointerEvents:', ws.pointerEvents);
  }
  if (home) {
    const hs = window.getComputedStyle(home);
    console.log('  home.display:', hs.display);
    console.log('  home.visibility:', hs.visibility);
    console.log('  home.pointerEvents:', hs.pointerEvents);
  }
  
  // 4. Overlay check
  console.log('\n🛡️ OVERLAY CHECK:');
  const overlays = document.querySelectorAll('[style*="pointer-events: none"], .overlay, .modal-overlay');
  console.log('  Elements with pointer-events:none or overlay class:', overlays.length);
  overlays.forEach((el, i) => {
    const style = window.getComputedStyle(el);
    if (style.display !== 'none' && style.visibility !== 'hidden') {
      console.log(`    [${i}] ${el.tagName}.${el.className}`, { zIndex: style.zIndex, pointerEvents: style.pointerEvents });
    }
  });
  
  // 5. Event listener check
  console.log('\n🎧 EVENT LISTENERS:');
  console.log('  boundHandlers exist:', !!(sliderManager as any).boundHandlers);
  console.log('  touchStart handler:', !!(sliderManager as any).boundHandlers?.touchStart);
  console.log('  mouseDown handler:', !!(sliderManager as any).boundHandlers?.mouseDown);
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('💡 If sliderLocked is true, run: gameState.set("sliderLocked", false)');
  console.log('💡 If isAnimatingEnter is true, run: sliderState.setAnimatingEnter(false)');
  console.log('💡 To force reset everything, run: fixSlider()');
  console.log('═══════════════════════════════════════════════════════════');
  
  return {
    sliderLocked: gameState.get('sliderLocked'),
    isAnimatingEnter: sliderState.isAnimatingEnter,
    isAnimatingExit: sliderState.isAnimatingExit,
    containerExists: !!container,
    containerPointerEvents: container ? window.getComputedStyle(container).pointerEvents : null
  };
};

// 🔥 DEBUG: Expose forceReady to window for manual testing
(window as any).fixSlider = () => {
  console.log('🔧 FIX SLIDER: Starting comprehensive slider fix...');
  
  // 1. Reset all animation flags
  console.log('1️⃣ Resetting animation flags...');
  sliderState.setAnimatingEnter(false);
  sliderState.setAnimatingExit(false);
  resetAnimationFlags();
  
  // 2. Unlock slider
  console.log('2️⃣ Unlocking slider...');
  gameState.set('sliderLocked', false);
  
  // 3. Call forceReady
  console.log('3️⃣ Calling sliderManager.forceReady()...');
  sliderManager.forceReady();
  
  // 4. Force reset all styles
  const container = document.getElementById('slider-container');
  const wrapper = document.getElementById('slider-wrapper');
  const nav = document.getElementById('independent-nav');
  const home = document.getElementById('home');
  
  if (container) {
    container.style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important; pointer-events: auto !important;';
    console.log('✅ Container styles force reset');
  }
  if (wrapper) {
    wrapper.style.pointerEvents = 'auto';
    console.log('✅ Wrapper pointer events reset');
  }
  if (nav) {
    nav.style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important; pointer-events: auto !important;';
    console.log('✅ Nav styles force reset');
  }
  if (home) {
    home.style.display = 'block';
    home.removeAttribute('hidden');
    home.style.visibility = 'visible';
    home.style.opacity = '1';
    console.log('✅ Home styles reset');
  }
  
  // 5. Reset all nav buttons
  const navButtons = document.querySelectorAll('.independent-nav-button');
  navButtons.forEach(btn => {
    (btn as HTMLElement).style.pointerEvents = 'auto';
  });
  console.log(`✅ ${navButtons.length} nav buttons pointer-events reset`);
  
  console.log('🔧 FIX SLIDER COMPLETE - Try interacting now');
  console.log('💡 Run diagnoseSlider() to verify the fix');
};

// Keep old name as alias
(window as any).debugSlider = (window as any).fixSlider;
