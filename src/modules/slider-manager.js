// Slider Manager Module
// Handles slider functionality and navigation

import gameState from './game-state.js';
import animationManager from './animation-manager.js';

class SliderManager {
  constructor() {
    this.currentSlide = 0;
    this.totalSlides = 4;
    this.isDragging = false;
    this.startX = 0;
    this.currentX = 0;
    this.threshold = 50;
    this.isInitialized = false;
    
    this.elements = {};
  }
  
  // Initialize slider
  init() {
    if (this.isInitialized) return;
    
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
      console.log('✅ Slider Manager initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize Slider Manager:', error);
      throw error;
    }
  }
  
  // Setup event listeners
  setupEventListeners() {
    // Touch events
    if (this.elements.container) {
      this.elements.container.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
      this.elements.container.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: true });
      this.elements.container.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });
    }
    
    // Mouse events
    if (this.elements.container) {
      this.elements.container.addEventListener('mousedown', this.handleMouseDown.bind(this));
      this.elements.container.addEventListener('mousemove', this.handleMouseMove.bind(this));
      this.elements.container.addEventListener('mouseup', this.handleMouseUp.bind(this));
      this.elements.container.addEventListener('mouseleave', this.handleMouseUp.bind(this));
    }
    
    // Navigation dots
    this.elements.dots.forEach((dot, index) => {
      dot.addEventListener('click', () => this.goToSlide(index));
    });
    
    // Independent navigation buttons
    const navButtons = document.querySelectorAll('.independent-nav-button');
    console.log('🔘 Found navigation buttons:', navButtons.length);
    navButtons.forEach((button, index) => {
      button.addEventListener('click', () => {
        console.log('🔘 Navigation button clicked:', index);
        this.goToSlide(index);
      });
    });
  }
  
  // Setup state subscriptions
  setupStateSubscriptions() {
    // Slider locked state
    gameState.subscribe('sliderLocked', (isLocked) => {
      this.updateSliderLockState(isLocked);
    });
    
    // Current slide state
    gameState.subscribe('currentSlide', (slide) => {
      this.currentSlide = slide;
      this.updateSlider();
    });
  }
  
  // Handle touch start
  handleTouchStart(event) {
    if (gameState.get('sliderLocked')) return;
    
    this.isDragging = true;
    this.startX = event.touches[0].clientX;
    this.currentX = this.startX;
    
    // Add dragging class
    if (this.elements.container) {
      this.elements.container.classList.add('dragging');
    }
  }
  
  // Handle touch move
  handleTouchMove(event) {
    if (!this.isDragging || gameState.get('sliderLocked')) return;
    
    this.currentX = event.touches[0].clientX;
    const deltaX = this.currentX - this.startX;
    
    // Update slider position
    this.updateSliderPosition(deltaX);
  }
  
  // Handle touch end
  handleTouchEnd(event) {
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
  handleMouseDown(event) {
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
  handleMouseMove(event) {
    if (!this.isDragging || gameState.get('sliderLocked')) return;
    
    this.currentX = event.clientX;
    const deltaX = this.currentX - this.startX;
    
    // Update slider position
    this.updateSliderPosition(deltaX);
  }
  
  // Handle mouse up
  handleMouseUp(event) {
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
  updateSliderPosition(deltaX) {
    if (!this.elements.wrapper) return;
    
    const slideWidth = this.elements.container.offsetWidth;
    const baseOffset = -this.currentSlide * slideWidth;
    const currentOffset = baseOffset + deltaX;
    
    this.elements.wrapper.style.transform = `translateX(${currentOffset}px)`;
  }
  
  // Go to specific slide
  goToSlide(slideIndex) {
    if (gameState.get('sliderLocked')) return;
    
    if (slideIndex >= 0 && slideIndex < this.totalSlides) {
      this.currentSlide = slideIndex;
      gameState.set('currentSlide', slideIndex);
      this.updateSlider();
    }
  }
  
  // Go to next slide
  nextSlide() {
    if (this.currentSlide < this.totalSlides - 1) {
      this.goToSlide(this.currentSlide + 1);
    }
  }
  
  // Go to previous slide
  previousSlide() {
    if (this.currentSlide > 0) {
      this.goToSlide(this.currentSlide - 1);
    }
  }
  
  // Update slider display
  updateSlider() {
    if (!this.elements.wrapper) return;
    
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
    console.log('🔘 Updating nav buttons, current slide:', this.currentSlide);
    navButtons.forEach((button, index) => {
      const isActive = index === this.currentSlide;
      button.classList.toggle('active', isActive);
      console.log(`🔘 Button ${index}: ${isActive ? 'ACTIVE' : 'inactive'}`);
    });
    
    // Update slides
    this.elements.slides.forEach((slide, index) => {
      slide.classList.toggle('active', index === this.currentSlide);
    });
  }
  
  // Update slider lock state
  updateSliderLockState(isLocked) {
    if (this.elements.container) {
      this.elements.container.style.pointerEvents = isLocked ? 'none' : 'auto';
    }
  }
  
  // Get current slide
  getCurrentSlide() {
    return this.currentSlide;
  }
  
  // Set current slide
  setCurrentSlide(slide) {
    this.goToSlide(slide);
  }
  
  // Cleanup
  destroy() {
    this.elements = {};
    this.isInitialized = false;
  }
}

// Create singleton instance
const sliderManager = new SliderManager();

// Export for use in other modules
export default sliderManager;

// Export class for testing
export { SliderManager };
