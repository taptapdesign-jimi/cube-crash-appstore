// ULTRA SIMPLE MAIN.JS - RELOAD APPROACH
import { boot } from './modules/app.js';

console.log('🚀 Starting ULTRA SIMPLE CubeCrash...');

let currentSlide = 0;
let isDragging = false;
let startX = 0;
let currentX = 0;

// ===== ELEMENTS =====
const home = document.getElementById('home');
const appHost = document.getElementById('app');
const sliderWrapper = document.getElementById('slider-wrapper');
const slides = document.querySelectorAll('.slider-slide');
const dots = document.querySelectorAll('.slider-dot');

// ===== SLIDER FUNCTIONS =====
function updateSlider() {
  if (sliderWrapper) {
    const translateX = -currentSlide * window.innerWidth;
    sliderWrapper.style.transform = `translateX(${translateX}px)`;
  }
  
  // Update dots
  dots.forEach((dot, index) => {
    dot.classList.toggle('active', index === currentSlide);
  });
}

function goToSlide(slideIndex) {
  if (slideIndex >= 0 && slideIndex < slides.length) {
    currentSlide = slideIndex;
    updateSlider();
  }
}

// ===== TOUCH/MOUSE EVENTS =====
function getPositionX(event) {
  return event.type.includes('mouse') ? event.pageX : event.touches[0].clientX;
}

function handleStart(event) {
  if (event.type.includes('mouse')) {
    event.preventDefault();
  }
  isDragging = true;
  startX = getPositionX(event);
  currentX = startX;
  if (sliderWrapper) {
    sliderWrapper.style.transition = 'none';
  }
}

function handleMove(event) {
  if (!isDragging) return;
  currentX = getPositionX(event);
  const diff = currentX - startX;
  if (sliderWrapper) {
    const translateX = -currentSlide * window.innerWidth + diff;
    sliderWrapper.style.transform = `translateX(${translateX}px)`;
  }
}

function handleEnd() {
  if (!isDragging) return;
  isDragging = false;
  
  const diff = currentX - startX;
  const threshold = window.innerWidth * 0.2;
  
  if (Math.abs(diff) > threshold) {
    if (diff > 0 && currentSlide > 0) {
      goToSlide(currentSlide - 1);
    } else if (diff < 0 && currentSlide < slides.length - 1) {
      goToSlide(currentSlide + 1);
    } else {
      updateSlider();
    }
  } else {
    updateSlider();
  }
  
  if (sliderWrapper) {
    sliderWrapper.style.transition = 'transform 0.3s ease-out';
  }
}

// ===== GLOBAL FUNCTIONS =====
window.startGame = () => {
  console.log('🎮 Starting game...');
  home.style.display = 'none';
  appHost.style.display = 'block';
  appHost.removeAttribute('hidden');
  boot();
};

window.exitToMenu = () => {
  console.log('🏠 Exiting to menu - RELOADING PAGE');
  // RELOAD THE ENTIRE PAGE - SIMPLEST SOLUTION
  window.location.reload();
};

window.showStats = () => goToSlide(1);
window.showCollectibles = () => goToSlide(2);

// ===== INITIALIZATION =====
function initialize() {
  console.log('🎯 Initializing ULTRA SIMPLE CubeCrash...');
  
  // Add event listeners
  if (sliderWrapper) {
    sliderWrapper.addEventListener('touchstart', handleStart, { passive: false });
    sliderWrapper.addEventListener('touchmove', handleMove, { passive: false });
    sliderWrapper.addEventListener('touchend', handleEnd);
    sliderWrapper.addEventListener('mousedown', handleStart);
    sliderWrapper.addEventListener('mousemove', handleMove);
    sliderWrapper.addEventListener('mouseup', handleEnd);
    sliderWrapper.addEventListener('mouseleave', handleEnd);
  }
  
  // Button handlers
  const playButton = document.getElementById('btn-home');
  const statsButton = document.getElementById('btn-stats');
  const collectiblesButton = document.getElementById('btn-collectibles');
  
  if (playButton) {
    playButton.addEventListener('click', (e) => {
      e.stopPropagation();
      window.startGame();
    });
  }
  
  if (statsButton) {
    statsButton.addEventListener('click', (e) => {
      e.stopPropagation();
      window.showStats();
    });
  }
  
  if (collectiblesButton) {
    collectiblesButton.addEventListener('click', (e) => {
      e.stopPropagation();
      window.showCollectibles();
    });
  }
  
  // Dot navigation
  dots.forEach((dot, index) => {
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      goToSlide(index);
    });
  });
  
  // Initial setup
  updateSlider();
  console.log('✅ ULTRA SIMPLE CubeCrash initialized');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}