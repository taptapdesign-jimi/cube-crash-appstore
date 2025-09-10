// Slide Controller Module
// Handles homepage slider functionality

let currentSlide = 0;
let sliderContainer = null;
let slides = [];
let isAnimating = false;

export function initSlider() {
  console.log('🎠 Initializing slider...');
  
  sliderContainer = document.querySelector('.slider-container');
  if (!sliderContainer) {
    console.error('🎠 Slider container not found!');
    return;
  }
  
  slides = Array.from(sliderContainer.querySelectorAll('.slide'));
  console.log('🎠 Found slides:', slides.length);
  
  if (slides.length === 0) {
    console.error('🎠 No slides found!');
    return;
  }
  
  // Set initial slide
  updateSlidePosition();
  console.log('🎠 Slider initialized successfully');
}

export function reloadSlider() {
  console.log('🎠 Reloading slider...');
  
  // Reset to first slide
  currentSlide = 0;
  isAnimating = false;
  
  // Re-initialize slider
  initSlider();
  
  // Trigger slide animation
  if (slides.length > 0) {
    slides.forEach((slide, index) => {
      slide.style.transform = `translateX(${(index - currentSlide) * 100}%)`;
      slide.style.opacity = index === currentSlide ? '1' : '0';
    });
  }
  
  console.log('🎠 Slider reloaded successfully');
}

export function nextSlide() {
  if (isAnimating) return;
  
  currentSlide = (currentSlide + 1) % slides.length;
  updateSlidePosition();
}

export function prevSlide() {
  if (isAnimating) return;
  
  currentSlide = currentSlide === 0 ? slides.length - 1 : currentSlide - 1;
  updateSlidePosition();
}

export function goToSlide(index) {
  if (isAnimating || index < 0 || index >= slides.length) return;
  
  currentSlide = index;
  updateSlidePosition();
}

function updateSlidePosition() {
  if (!sliderContainer || slides.length === 0) return;
  
  isAnimating = true;
  
  slides.forEach((slide, index) => {
    const offset = (index - currentSlide) * 100;
    slide.style.transform = `translateX(${offset}%)`;
    slide.style.opacity = index === currentSlide ? '1' : '0';
  });
  
  // Update navigation dots
  updateNavigationDots();
  
  // Reset animation flag
  setTimeout(() => {
    isAnimating = false;
  }, 300);
}

function updateNavigationDots() {
  const dots = document.querySelectorAll('.slider-dot');
  dots.forEach((dot, index) => {
    dot.classList.toggle('active', index === currentSlide);
  });
}

// Auto-initialize when module loads
document.addEventListener('DOMContentLoaded', () => {
  initSlider();
});

// Export for manual initialization
export default {
  initSlider,
  reloadSlider,
  nextSlide,
  prevSlide,
  goToSlide
};
