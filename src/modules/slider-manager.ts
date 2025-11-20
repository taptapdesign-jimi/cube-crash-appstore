// Slider Manager Module
// Handles slider functionality and navigation

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
  private threshold: number = 50;
  private isInitialized: boolean = false;
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
    
    this.elements.wrapper.style.transform = `translateX(${currentOffset}px)`;
  }
  
  // Go to specific slide
  goToSlide(slideIndex: number): void {
    if (gameState.get('sliderLocked')) return;
    
    if (slideIndex >= 0 && slideIndex < this.totalSlides) {
      this.currentSlide = slideIndex;
      gameState.set('currentSlide', slideIndex);
      this.updateSlider();
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
  private updateSlider(): void {
    if (!this.elements.wrapper || !this.elements.container) return;
    
    const slideWidth = this.elements.container.offsetWidth;
    const offset = -this.currentSlide * slideWidth;
    
    // Update wrapper position
    this.elements.wrapper.style.transform = `translateX(${offset}px)`;
    
    // Update dots
    this.elements.dots.forEach((dot, index) => {
      dot.classList.toggle('active', index === this.currentSlide);
    });
    
    // Update independent navigation buttons
    const navButtons = document.querySelectorAll('.independent-nav-button');
    navButtons.forEach((button, index) => {
      const isActive = index === this.currentSlide;
      button.classList.toggle('active', isActive);
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
  
  // Cleanup
  destroy(): void {
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
