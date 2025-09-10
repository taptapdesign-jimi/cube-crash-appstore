// OPTIMIZED SLIDER FOR IPHONE 13 & XCODE COMPATIBILITY

console.log('📦 slider-optimized.js loaded');

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
    this.dragStartTime = 0;
    this.dragEndTime = 0;
    
    this.init();
  }
  
  init() {
    console.log('🎠 Initializing slider...');
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      console.log('⏳ DOM still loading, waiting...');
      setTimeout(() => this.init(), 100);
      return;
    }
    
    this.sliderWrapper = document.getElementById('slider-wrapper');
    this.slides = document.querySelectorAll('.slider-slide');
    this.dots = document.querySelectorAll('.slider-dot');
    this.playButton = document.getElementById('btn-home');
    this.statsButton = document.getElementById('btn-stats');
    this.collectiblesButton = document.getElementById('btn-collectibles');
    
    console.log('🔍 Slider elements found:', {
      sliderWrapper: !!this.sliderWrapper,
      slides: this.slides.length,
      dots: this.dots.length,
      playButton: !!this.playButton,
      statsButton: !!this.statsButton,
      collectiblesButton: !!this.collectiblesButton
    });
    
    // Additional check for DOM structure
    if (this.sliderWrapper) {
      console.log('🔍 Slider wrapper parent:', this.sliderWrapper.parentElement?.tagName);
      console.log('🔍 Slider wrapper children:', this.sliderWrapper.children.length);
    }
    
    if (this.slides.length > 0) {
      console.log('🔍 First slide content:', this.slides[0].innerHTML.substring(0, 100) + '...');
    }
    
    // Check if elements exist
    if (!this.sliderWrapper || !this.slides.length || !this.dots.length) {
      console.error('❌ Slider elements not found!', {
        sliderWrapper: !!this.sliderWrapper,
        slides: this.slides.length,
        dots: this.dots.length
      });
      
      // Try again in 200ms
      setTimeout(() => {
        console.log('🔄 Retrying slider initialization...');
        this.init();
      }, 200);
      return;
    }
    
    // Force visibility of all elements
    this.slides.forEach((slide, index) => {
      slide.style.display = 'flex';
      slide.style.visibility = 'visible';
      slide.style.opacity = '1';
      slide.style.transform = '';
    });
    
    this.dots.forEach((dot, index) => {
      dot.style.display = 'block';
      dot.style.visibility = 'visible';
      dot.style.opacity = '1';
      dot.style.transform = '';
    });
    
    this.setupEventListeners();
    this.updateSlider();
    console.log('🎠 OptimizedSlider initialized successfully');
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
    this.dragStartTime = Date.now();
    this.sliderWrapper.style.transition = 'none';
    console.log('🎠 Drag started at', x);
  }
  
  drag(x) {
    if (!this.isDragging) return;
    
    this.dragCurrentX = x;
    this.dragOffset = x - this.dragStartX;
    
    // Simple pixel-based dragging - show next slide peeking through
    const baseTranslateX = -this.currentSlide * window.innerWidth;
    const totalTranslateX = baseTranslateX + this.dragOffset;
    
    this.sliderWrapper.style.transform = `translateX(${totalTranslateX}px)`;
    console.log('🎠 Dragging:', this.dragOffset, 'px, translateX:', totalTranslateX + 'px');
  }
  
  endDrag() {
    if (!this.isDragging) return;
    
    this.isDragging = false;
    this.dragEndTime = Date.now();
    
    // Calculate drag duration and speed
    const dragDuration = this.dragEndTime - this.dragStartTime;
    const dragSpeed = Math.abs(this.dragOffset) / dragDuration; // pixels per ms
    
    // Simple threshold for slide change
    const threshold = window.innerWidth * 0.15; // 15% of screen width
    
    let targetSlide = this.currentSlide;
    
    console.log('🎠 Drag ended - offset:', this.dragOffset, 'duration:', dragDuration, 'speed:', dragSpeed, 'threshold:', threshold);
    
    // Check if drag is sufficient for slide change
    if (Math.abs(this.dragOffset) > threshold) {
      if (this.dragOffset > 0) {
        // Swipe right - previous slide
        targetSlide = Math.max(0, this.currentSlide - 1);
        console.log('🎠 Swipe right detected, going to slide:', targetSlide);
      } else {
        // Swipe left - next slide
        targetSlide = Math.min(this.totalSlides - 1, this.currentSlide + 1);
        console.log('🎠 Swipe left detected, going to slide:', targetSlide);
      }
    } else {
      console.log('🎠 Drag not sufficient for slide change, staying on slide:', this.currentSlide);
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
    if (!this.sliderWrapper) {
      console.error('❌ Slider wrapper not found in updateSlider!');
      return;
    }
    
    // Simple pixel-based positioning
    const translateX = -this.currentSlide * window.innerWidth;
    this.sliderWrapper.style.transform = `translateX(${translateX}px)`;
    console.log(`🎠 UpdateSlider: slide ${this.currentSlide}, translateX: ${translateX}px`);
    
    // Show all slides but only current one is fully visible
    if (this.slides.length > 0) {
      this.slides.forEach((slide, index) => {
        slide.style.display = 'flex';
        slide.style.visibility = 'visible';
        slide.style.opacity = '1';
      });
    }
    
    // Force visibility of dots
    if (this.dots.length > 0) {
      this.dots.forEach((dot, index) => {
        dot.style.display = 'block';
        dot.style.visibility = 'visible';
        dot.style.opacity = '1';
        dot.classList.toggle('active', index === this.currentSlide);
      });
    }
  }
  
  updateDots() {
    this.dots.forEach((dot, index) => {
      dot.classList.toggle('active', index === this.currentSlide);
    });
  }
  
  handlePlayClick() {
    console.log('🎮 Play button clicked - starting exit animation');
    console.log('🎮 window.startGame exists:', typeof window.startGame);
    
    // Force reset animation state if stuck
    if (this.isAnimating) {
      console.log('⚠️ Slider is animating, forcing reset...');
      this.isAnimating = false;
      this.sliderWrapper.style.pointerEvents = 'auto';
    }
    
    // Prevent multiple simultaneous calls
    if (this.isAnimating) {
      console.log('⚠️ Still animating, skipping...');
      return;
    }
    
    this.startExitAnimation(() => {
      console.log('🎮 Exit animation complete - starting game');
      // This will be called by main.js
      if (window.startGame) {
        console.log('🎮 Calling window.startGame()');
        window.startGame();
      } else {
        console.error('❌ window.startGame not found!');
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
  
  // SIMPLE exit animation - just hide everything immediately
  startExitAnimation(onComplete) {
    console.log('🎭 SIMPLE exit animation - hiding slider immediately');
    
    // Disable slider interactions
    this.isAnimating = true;
    this.sliderWrapper.style.pointerEvents = 'none';
    
    // Simple fade-out for the whole homepage
    const home = document.getElementById('home');
    if (home) {
      home.style.transition = 'opacity 0.3s ease-out';
      home.style.opacity = '0';
    }
    
    // Start game immediately
    setTimeout(() => {
      console.log('🎭 Simple exit complete - starting game');
      if (onComplete) onComplete();
      this.isAnimating = false;
    }, 300);
  }
  
  // SIMPLE pop-in animation - just show everything immediately
  startPopInAnimation() {
    console.log('🎭 SIMPLE pop-in animation - showing slider immediately');
    
    // Force complete re-initialization first
    this.completeReinitialization();
    
    // Simple fade-in for the whole homepage
    const home = document.getElementById('home');
    if (home) {
      home.style.transition = 'opacity 0.5s ease-out';
      home.style.opacity = '1';
    }
    
    console.log('🎭 Simple pop-in complete - slider should be functional');
  }

  // Complete re-initialization of slider
  completeReinitialization() {
    console.log('🔄 Complete slider re-initialization');
    
    // Reset all state
    this.isAnimating = false;
    this.currentSlide = 0;
    this.touchStartX = 0;
    this.touchEndX = 0;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragCurrentX = 0;
    this.dragOffset = 0;
    this.dragStartTime = 0;
    this.dragEndTime = 0;
    
    // Re-find all elements
    this.sliderWrapper = document.getElementById('slider-wrapper');
    this.slides = document.querySelectorAll('.slider-slide');
    this.dots = document.querySelectorAll('.slider-dot');
    this.playButton = document.getElementById('btn-home');
    this.statsButton = document.getElementById('btn-stats');
    this.collectiblesButton = document.getElementById('btn-collectibles');
    
    console.log('🔍 Re-found elements:', {
      sliderWrapper: !!this.sliderWrapper,
      slides: this.slides.length,
      dots: this.dots.length,
      playButton: !!this.playButton
    });
    
    // Reset all styles
    this.resetAnimations();
    
    // Re-setup event listeners
    this.setupEventListeners();
    
    // Update slider position
    this.updateSlider();
    this.updateDots();
    
    console.log('✅ Complete re-initialization finished');
  }

  // Reset all animations when returning to home
  resetAnimations() {
    console.log('🎭 Resetting all animations');
    
    // Reset logo
    const logo = document.getElementById('home-logo');
    if (logo) {
      logo.style.transition = '';
      logo.style.transform = '';
      logo.style.opacity = '';
    }
    
    // Reset navigation dots
    const navigationDots = document.getElementById('slider-dots');
    if (navigationDots) {
      navigationDots.style.transition = '';
      navigationDots.style.transform = '';
      navigationDots.style.opacity = '';
    }
    
    // Reset all slides
    this.slides.forEach(slide => {
      slide.style.transition = '';
      slide.style.transform = '';
      slide.style.opacity = '';
      
      const elements = [
        slide.querySelector('.slide-text'),
        slide.querySelector('.slide-button'),
        slide.querySelector('.hero-shadow'),
        slide.querySelector('.hero-image'),
        slide.querySelector('.hero-container')
      ];
      
      elements.forEach(el => {
        if (el) {
          el.style.transition = '';
          el.style.transform = '';
          el.style.opacity = '';
        }
      });
    });
    
    // Re-enable slider interactions
    this.isAnimating = false;
    this.sliderWrapper.style.pointerEvents = 'auto';
  }
  
  // Public method to get current slide
  getCurrentSlide() {
    return this.currentSlide;
  }
  
  // Public method to check if animating
  isCurrentlyAnimating() {
    return this.isAnimating;
  }
  
  // Public method to go to specific slide
  goToSlide(slideIndex) {
    console.log(`🎠 goToSlide called with index: ${slideIndex}`);
    
    // Check current state
    console.log('🔍 Current slider state:', {
      sliderWrapper: !!this.sliderWrapper,
      slides: this.slides.length,
      dots: this.dots.length,
      currentSlide: this.currentSlide
    });
    
    // Re-initialize slider if elements are missing
    if (!this.sliderWrapper || !this.slides.length || !this.dots.length) {
      console.log('🔄 Re-initializing slider elements...');
      this.init();
      
      // If still missing after re-init, wait and try again
      if (!this.sliderWrapper || !this.slides.length || !this.dots.length) {
        console.log('⏳ Elements still missing, retrying in 100ms...');
        setTimeout(() => {
          this.goToSlide(slideIndex);
        }, 100);
        return;
      }
    }
    
    if (slideIndex < 0 || slideIndex >= this.slides.length) {
      console.error(`❌ Invalid slide index: ${slideIndex}`);
      return;
    }
    
    if (this.isAnimating) {
      console.log('⚠️ Slider is currently animating, skipping goToSlide');
      return;
    }
    
    this.currentSlide = slideIndex;
    this.updateSlider();
    console.log(`✅ Slider moved to slide ${slideIndex}`);
  }
  
  // Public method to re-initialize slider completely
  reinitialize() {
    console.log('🔄 Re-initializing slider completely...');
    this.currentSlide = 0;
    this.isAnimating = false;
    this.touchStartX = 0;
    this.touchEndX = 0;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragCurrentX = 0;
    this.dragOffset = 0;
    
    // Remove old event listeners
    if (this.sliderWrapper) {
      this.sliderWrapper.replaceWith(this.sliderWrapper.cloneNode(true));
    }
    
    // Re-initialize
    this.init();
    console.log('✅ Slider re-initialized successfully');
  }
}

// Export for use in main.js
// Export for ES6 modules
export { OptimizedSlider };

// Also make available globally for compatibility
window.OptimizedSlider = OptimizedSlider;
