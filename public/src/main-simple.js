// SIMPLE MAIN.JS - BACK TO BASICS

import { boot } from './modules/app.js';
import { gsap } from 'gsap';

let currentSlide = 0;
let isAnimating = false;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Simple CubeCrash initializing...');
  
  initSlider();
  setupButtons();
  
  console.log('✅ Simple CubeCrash initialized');
});

function initSlider() {
  const slider = document.getElementById('slider-wrapper');
  const slides = document.querySelectorAll('.slider-slide');
  const dots = document.querySelectorAll('.slider-dot');
  
  if (!slider || !slides.length) {
    console.error('❌ Slider elements not found');
    return;
  }
  
  // Touch events
  let startX = 0;
  let currentX = 0;
  let isDragging = false;
  
  slider.addEventListener('touchstart', (e) => {
    if (isAnimating) return;
    startX = e.touches[0].clientX;
    isDragging = true;
    slider.style.transition = 'none';
  });
  
  slider.addEventListener('touchmove', (e) => {
    if (!isDragging || isAnimating) return;
    currentX = e.touches[0].clientX;
    const diff = currentX - startX;
    const translateX = -currentSlide * 100 + (diff / window.innerWidth) * 100;
    slider.style.transform = `translateX(${translateX}%)`;
  });
  
  slider.addEventListener('touchend', () => {
    if (!isDragging || isAnimating) return;
    isDragging = false;
    
    const diff = currentX - startX;
    const threshold = window.innerWidth * 0.1; // 10% threshold
    
    if (Math.abs(diff) > threshold) {
      if (diff > 0 && currentSlide > 0) {
        goToSlide(currentSlide - 1);
      } else if (diff < 0 && currentSlide < slides.length - 1) {
        goToSlide(currentSlide + 1);
      } else {
        goToSlide(currentSlide);
      }
    } else {
      goToSlide(currentSlide);
    }
  });
  
  // Mouse events for desktop
  slider.addEventListener('mousedown', (e) => {
    if (isAnimating) return;
    startX = e.clientX;
    isDragging = true;
    slider.style.transition = 'none';
  });
  
  slider.addEventListener('mousemove', (e) => {
    if (!isDragging || isAnimating) return;
    currentX = e.clientX;
    const diff = currentX - startX;
    const translateX = -currentSlide * 100 + (diff / window.innerWidth) * 100;
    slider.style.transform = `translateX(${translateX}%)`;
  });
  
  slider.addEventListener('mouseup', () => {
    if (!isDragging || isAnimating) return;
    isDragging = false;
    
    const diff = currentX - startX;
    const threshold = window.innerWidth * 0.1;
    
    if (Math.abs(diff) > threshold) {
      if (diff > 0 && currentSlide > 0) {
        goToSlide(currentSlide - 1);
      } else if (diff < 0 && currentSlide < slides.length - 1) {
        goToSlide(currentSlide + 1);
      } else {
        goToSlide(currentSlide);
      }
    } else {
      goToSlide(currentSlide);
    }
  });
  
  slider.addEventListener('mouseleave', () => {
    if (isDragging) {
      isDragging = false;
      goToSlide(currentSlide);
    }
  });
  
  // Dot navigation
  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      if (!isAnimating) {
        goToSlide(index);
      }
    });
  });
}

function goToSlide(slideIndex) {
  if (isAnimating || slideIndex === currentSlide) return;
  
  isAnimating = true;
  currentSlide = slideIndex;
  
  const slider = document.getElementById('slider-wrapper');
  const slides = document.querySelectorAll('.slider-slide');
  const dots = document.querySelectorAll('.slider-dot');
  
  // Update slider position
  slider.style.transition = 'transform 0.3s ease';
  slider.style.transform = `translateX(-${currentSlide * 100}%)`;
  
  // Update active states
  slides.forEach((slide, index) => {
    slide.classList.toggle('active', index === currentSlide);
  });
  
  dots.forEach((dot, index) => {
    dot.classList.toggle('active', index === currentSlide);
  });
  
  // Reset animation flag
  setTimeout(() => {
    isAnimating = false;
  }, 300);
}

function setupButtons() {
  // Play button
  const playBtn = document.getElementById('btn-home');
  if (playBtn) {
    playBtn.addEventListener('click', startGame);
  }
  
  // Stats button
  const statsBtn = document.getElementById('btn-stats');
  if (statsBtn) {
    statsBtn.addEventListener('click', showStats);
  }
  
  // Collectibles button
  const collectiblesBtn = document.getElementById('btn-collectibles');
  if (collectiblesBtn) {
    collectiblesBtn.addEventListener('click', showCollectibles);
  }
}

// Game functions
async function startGame() {
  console.log('🎮 Starting game...');
  
  // Hide home screen
  const home = document.getElementById('home');
  const app = document.getElementById('app');
  
  if (home) home.style.display = 'none';
  if (app) app.removeAttribute('hidden');
  
  // Start the game
  try {
    await boot();
    console.log('✅ Game started successfully');
  } catch (error) {
    console.error('❌ Game start failed:', error);
  }
}

function showStats() {
  console.log('📊 Showing stats...');
  // TODO: Implement stats modal
}

function showCollectibles() {
  console.log('🎁 Showing collectibles...');
  // TODO: Implement collectibles modal
}

// Make functions global
window.startGame = startGame;
window.showStats = showStats;
window.showCollectibles = showCollectibles;
