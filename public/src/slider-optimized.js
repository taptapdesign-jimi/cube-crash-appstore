// OPTIMIZED SLIDER FOR IPHONE 13 & XCODE COMPATIBILITY

class OptimizedSlider {
  constructor() {
    this.currentSlide = 0;
    this.totalSlides = 3; // 0: Home, 1: Stats, 2: Collectibles
    this.isAnimating = false;
    this.touchStartX = 0;
    this.touchEndX = 0;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragCurrentX = 0;
    this.dragOffset = 0;
    
    this.init();
  }
  
  init() {
    this.sliderWrapper = document.getElementById('slider-wrapper');
    this.slides = document.querySelectorAll('.slider-slide');
    this.dots = document.querySelectorAll('.slider-dot');
    this.playButton = document.getElementById('btn-home');
    this.statsButton = document.getElementById('btn-stats');
    this.collectiblesButton = document.getElementById('btn-collectibles');
    
    this.setupEventListeners();
    this.updateSlider();
    console.log('🎠 OptimizedSlider initialized');
  }
  
  setupEventListeners() {
    // Touch events for fluid drag
    this.sliderWrapper.addEventListener('touchstart', (e) => {
      this.startDrag(e.touches[0].clientX);
    }, { passive: false });
    
    this.sliderWrapper.addEventListener('touchmove', (e) => {
      this.drag(e.touches[0].clientX);
      e.preventDefault();
    }, { passive: false });
    
    this.sliderWrapper.addEventListener('touchend', (e) => {
      this.endDrag();
    }, { passive: true });
    
    // Mouse events for desktop
    this.sliderWrapper.addEventListener('mousedown', (e) => {
      this.startDrag(e.clientX);
    });
    
    this.sliderWrapper.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        this.drag(e.clientX);
      }
    });
    
    this.sliderWrapper.addEventListener('mouseup', (e) => {
      this.endDrag();
    });
    
    this.sliderWrapper.addEventListener('mouseleave', (e) => {
      this.endDrag();
    });
    
    // Navigation dots
    this.dots.forEach((dot, index) => {
      dot.addEventListener('click', () => {
        this.goToSlide(index);
      });
    });
    
    // Button events
    if (this.playButton) {
      this.playButton.addEventListener('click', () => {
        this.handlePlayClick();
      });
    }
    
    if (this.statsButton) {
      this.statsButton.addEventListener('click', () => {
        this.handleStatsClick();
      });
    }
    
    if (this.collectiblesButton) {
      this.collectiblesButton.addEventListener('click', () => {
        this.handleCollectiblesClick();
      });
    }
    
  }
  
  startDrag(x) {
    this.isDragging = true;
    this.dragStartX = x;
    this.dragCurrentX = x;
    this.dragOffset = 0;
    this.sliderWrapper.style.transition = 'none';
    console.log('🎠 Drag started at', x);
  }
  
  drag(x) {
    if (!this.isDragging) return;
    
    this.dragCurrentX = x;
    this.dragOffset = x - this.dragStartX;
    
    // Calculate current position with drag offset - pixel based for smoother control
    const baseTranslateX = -this.currentSlide * window.innerWidth;
    const totalTranslateX = baseTranslateX + this.dragOffset;
    
    this.sliderWrapper.style.transform = `translateX(${totalTranslateX}px)`;
    console.log('🎠 Dragging:', this.dragOffset, 'px');
  }
  
  endDrag() {
    if (!this.isDragging) return;
    
    this.isDragging = false;
    
    // 5% threshold for slide change
    const threshold = window.innerWidth * 0.05; // 5% threshold
    let targetSlide = this.currentSlide;
    
    if (Math.abs(this.dragOffset) > threshold) {
      if (this.dragOffset > 0) {
        // Swipe right - previous slide
        targetSlide = Math.max(0, this.currentSlide - 1);
      } else {
        // Swipe left - next slide
        targetSlide = Math.min(this.totalSlides - 1, this.currentSlide + 1);
      }
    }
    
    if (targetSlide !== this.currentSlide) {
      this.currentSlide = targetSlide;
      this.updateDots();
      console.log('🎠 Slide changed to:', this.currentSlide);
    }
    
    // Smooth transition to final position
    this.sliderWrapper.style.transition = 'transform 0.3s ease-out';
    this.updateSlider();
    
    // Remove transition after animation
    setTimeout(() => {
      this.sliderWrapper.style.transition = 'none';
    }, 300);
    
    console.log('🎠 Drag ended, final slide:', this.currentSlide);
  }
  
  // Old swipe function removed - now using fluid drag
  
  // nextSlide and prevSlide removed - using goToSlide directly
  
  goToSlide(slideIndex) {
    if (this.isAnimating || slideIndex === this.currentSlide) {
      console.log(`🎠 Skipping slide change - animating: ${this.isAnimating}, same slide: ${slideIndex === this.currentSlide}`);
      return;
    }
    
    console.log(`🎠 Going to slide ${slideIndex} from ${this.currentSlide}`);
    this.isAnimating = true;
    this.currentSlide = slideIndex;
    
    // Update slider position
    this.updateSlider();
    
    // Update dots
    this.updateDots();
    
    // Reset animation flag after transition
    setTimeout(() => {
      this.isAnimating = false;
      console.log(`🎠 Animation complete, now on slide ${this.currentSlide}`);
    }, 400);
    
    console.log(`🎠 Switched to slide ${slideIndex}`);
  }
  
  updateSlider() {
    const translateX = -this.currentSlide * window.innerWidth; // Pixel values for smoother control
    this.sliderWrapper.style.transform = `translateX(${translateX}px)`;
    console.log(`🎠 UpdateSlider: slide ${this.currentSlide}, translateX: ${translateX}px`);
  }
  
  updateDots() {
    this.dots.forEach((dot, index) => {
      dot.classList.toggle('active', index === this.currentSlide);
    });
  }
  
  handlePlayClick() {
    console.log('🎮 Play button clicked - starting exit animation');
    this.startExitAnimation(() => {
      console.log('🎮 Exit animation complete - starting game');
      // This will be called by main.js
      if (window.startGame) {
        window.startGame();
      }
    });
  }
  
  handleStatsClick() {
    console.log('📊 Stats button clicked');
    // This will be called by main.js
    if (window.showStats) {
      window.showStats();
    }
  }
  
  handleCollectiblesClick() {
    console.log('🎁 Collectibles button clicked');
    // This will be called by main.js
    if (window.showCollectibles) {
      window.showCollectibles();
    }
  }
  
  startExitAnimation(onComplete) {
    const activeSlide = this.slides[this.currentSlide];
    if (!activeSlide) return;
    
    // Add exit animation class
    activeSlide.classList.add('slider-exit');
    
    // Also animate the slide content
    const slideContent = activeSlide.querySelector('.slide-content');
    if (slideContent) {
      slideContent.classList.add('slide-content-exit');
    }
    
    // Call completion callback after animation
    setTimeout(() => {
      if (onComplete) onComplete();
    }, 600);
    
    console.log('🎭 Exit animation started');
  }
  
  // Public method to get current slide
  getCurrentSlide() {
    return this.currentSlide;
  }
  
  // Public method to check if animating
  isCurrentlyAnimating() {
    return this.isAnimating;
  }
}

// Export for use in main.js
window.OptimizedSlider = OptimizedSlider;
