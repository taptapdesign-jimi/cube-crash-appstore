// HOME MODULE - Slider + CTA
console.log('🏠 HomeModule loading...');

export class HomeModule {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.currentSlide = 0;
    this.isDragging = false;
    this.startX = 0;
    this.currentX = 0;
    
    // Elements (will be set in mount)
    this.sliderWrapper = null;
    this.slides = null;
    this.dots = null;
    
    console.log('✅ HomeModule created');
  }

  async mount(container) {
    console.log('🏠 Mounting HomeModule...');
    
    // Get elements
    this.sliderWrapper = container.querySelector('#slider-wrapper');
    this.slides = container.querySelectorAll('.slider-slide');
    this.dots = container.querySelectorAll('.slider-dot');
    
    // Setup event listeners
    this.setupSliderEvents();
    this.setupButtonEvents();
    this.setupDotEvents();
    
    // Initial state
    this.updateSlider();
    
    console.log('✅ HomeModule mounted');
  }

  show() {
    console.log('🏠 HomeModule showing...');
    // HomeModule is always visible when mounted
  }

  hide() {
    console.log('🏠 HomeModule hiding...');
    // HomeModule handles its own visibility
  }

  destroy() {
    console.log('🏠 HomeModule destroying...');
    // Cleanup event listeners
    if (this.sliderWrapper) {
      this.sliderWrapper.removeEventListener('touchstart', this.handleStart);
      this.sliderWrapper.removeEventListener('touchmove', this.handleMove);
      this.sliderWrapper.removeEventListener('touchend', this.handleEnd);
      this.sliderWrapper.removeEventListener('mousedown', this.handleStart);
      this.sliderWrapper.removeEventListener('mousemove', this.handleMove);
      this.sliderWrapper.removeEventListener('mouseup', this.handleEnd);
      this.sliderWrapper.removeEventListener('mouseleave', this.handleEnd);
    }
    
    console.log('✅ HomeModule destroyed');
  }

  setupSliderEvents() {
    if (!this.sliderWrapper) return;
    
    this.sliderWrapper.addEventListener('touchstart', this.handleStart.bind(this), { passive: false });
    this.sliderWrapper.addEventListener('touchmove', this.handleMove.bind(this), { passive: false });
    this.sliderWrapper.addEventListener('touchend', this.handleEnd.bind(this));
    this.sliderWrapper.addEventListener('mousedown', this.handleStart.bind(this));
    this.sliderWrapper.addEventListener('mousemove', this.handleMove.bind(this));
    this.sliderWrapper.addEventListener('mouseup', this.handleEnd.bind(this));
    this.sliderWrapper.addEventListener('mouseleave', this.handleEnd.bind(this));
  }

  setupButtonEvents() {
    const playButton = document.getElementById('btn-home');
    const statsButton = document.getElementById('btn-stats');
    const collectiblesButton = document.getElementById('btn-collectibles');
    
    if (playButton) {
      playButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.eventBus.emit('home:play');
      });
    }
    
    if (statsButton) {
      statsButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.eventBus.emit('home:stats');
      });
    }
    
    if (collectiblesButton) {
      collectiblesButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.eventBus.emit('home:collectibles');
      });
    }
  }

  setupDotEvents() {
    if (!this.dots) return;
    
    this.dots.forEach((dot, index) => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        this.goToSlide(index);
      });
    });
  }

  updateSlider() {
    if (!this.sliderWrapper) return;
    
    const translateX = -this.currentSlide * window.innerWidth;
    this.sliderWrapper.style.transform = `translateX(${translateX}px)`;
    
    // Update dots
    if (this.dots) {
      this.dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === this.currentSlide);
      });
    }
    
    console.log(`🎠 Slider moved to slide ${this.currentSlide}`);
  }

  goToSlide(slideIndex) {
    if (slideIndex >= 0 && slideIndex < this.slides.length) {
      this.currentSlide = slideIndex;
      this.updateSlider();
    }
  }

  getPositionX(event) {
    return event.type.includes('mouse') ? event.pageX : event.touches[0].clientX;
  }

  handleStart(event) {
    if (event.type.includes('mouse')) {
      event.preventDefault();
    }
    this.isDragging = true;
    this.startX = this.getPositionX(event);
    this.currentX = this.startX;
    if (this.sliderWrapper) {
      this.sliderWrapper.style.transition = 'none';
    }
  }

  handleMove(event) {
    if (!this.isDragging) return;
    this.currentX = this.getPositionX(event);
    const diff = this.currentX - this.startX;
    if (this.sliderWrapper) {
      const translateX = -this.currentSlide * window.innerWidth + diff;
      this.sliderWrapper.style.transform = `translateX(${translateX}px)`;
    }
  }

  handleEnd() {
    if (!this.isDragging) return;
    this.isDragging = false;
    
    const diff = this.currentX - this.startX;
    const threshold = window.innerWidth * 0.2;
    
    if (Math.abs(diff) > threshold) {
      if (diff > 0 && this.currentSlide > 0) {
        this.goToSlide(this.currentSlide - 1);
      } else if (diff < 0 && this.currentSlide < this.slides.length - 1) {
        this.goToSlide(this.currentSlide + 1);
      } else {
        this.updateSlider();
      }
    } else {
      this.updateSlider();
    }
    
    if (this.sliderWrapper) {
      this.sliderWrapper.style.transition = 'transform 0.3s ease-out';
    }
  }

  // Public API
  getCurrentSlide() {
    return this.currentSlide;
  }

  setSlide(slideIndex) {
    this.goToSlide(slideIndex);
  }
}

console.log('✅ HomeModule loaded');
