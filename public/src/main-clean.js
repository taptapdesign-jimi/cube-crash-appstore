// CLEAN MAIN.JS - SIMPLE AND WORKING
import { boot, cleanupGame, startFreshGame } from './modules/app.js';

console.log('🚀 Starting CLEAN CubeCrash...');

let currentSlide = 0;
let isAnimating = false;

(async () => {
  try {
    // Wait for DOM
    if (document.readyState === 'loading') {
      await new Promise(res => document.addEventListener('DOMContentLoaded', res, { once: true }));
    }

    const home = document.getElementById('home');
    const appHost = document.getElementById('app');
    
    if (!home || !appHost) {
      throw new Error('Required elements not found');
    }

    // Get elements
    const sliderWrapper = document.getElementById('slider-wrapper');
    const slides = document.querySelectorAll('.slider-slide');
    const dots = document.querySelectorAll('.slider-dot');
    const playButton = document.getElementById('btn-home');
    const statsButton = document.getElementById('btn-stats');
    const collectiblesButton = document.getElementById('btn-collectibles');
    
    const totalSlides = slides.length;
    
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
      if (slideIndex >= 0 && slideIndex < totalSlides) {
        currentSlide = slideIndex;
        updateSlider();
      }
    }

    // ===== ANIMATIONS =====
    function animateSliderIn() {
      if (isAnimating) return;
      isAnimating = true;
      
      console.log('🎬 Animating slider IN');
      
      // Reset all elements
      const elements = [
        ...document.querySelectorAll('.slide-text'),
        ...document.querySelectorAll('.hero-image'),
        ...document.querySelectorAll('.hero-shadow'),
        ...document.querySelectorAll('.slider-dot')
      ];
      
      elements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'scale(0.8) translateY(20px)';
      });
      
      // Animate in sequence
      elements.forEach((el, index) => {
        setTimeout(() => {
          el.style.transition = 'all 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
          el.style.opacity = '1';
          el.style.transform = 'scale(1) translateY(0)';
        }, index * 100);
      });
      
      // Force update dots visibility
      setTimeout(() => {
        const dots = document.querySelectorAll('.slider-dot');
        dots.forEach((dot, index) => {
          dot.classList.toggle('active', index === currentSlide);
        });
      }, 500);
      
      setTimeout(() => {
        isAnimating = false;
        console.log('✅ Slider animation complete');
      }, 1000);
    }
    
    function animateSliderOut() {
      if (isAnimating) return;
      isAnimating = true;
      
      console.log('🎬 Animating slider OUT');
      
      const elements = [
        ...document.querySelectorAll('.slide-text'),
        ...document.querySelectorAll('.hero-image'),
        ...document.querySelectorAll('.hero-shadow'),
        ...document.querySelectorAll('.slider-dot')
      ];
      
      elements.forEach((el, index) => {
        setTimeout(() => {
          el.style.transition = 'all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
          el.style.opacity = '0';
          el.style.transform = 'scale(0.8) translateY(-20px)';
        }, index * 50);
      });
      
      setTimeout(() => {
        isAnimating = false;
        console.log('✅ Slider out animation complete');
      }, 800);
    }
    
    function animateGameIn() {
      console.log('🎬 Animating game IN');
      appHost.style.opacity = '0';
      appHost.style.transform = 'scale(0.9)';
      
      setTimeout(() => {
        appHost.style.transition = 'all 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
        appHost.style.opacity = '1';
        appHost.style.transform = 'scale(1)';
      }, 100);
    }
    
    function animateGameOut() {
      console.log('🎬 Animating game OUT');
      appHost.style.transition = 'all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
      appHost.style.opacity = '0';
      appHost.style.transform = 'scale(0.9)';
    }

    // ===== TOUCH/DRAG HANDLING =====
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    
    function handleStart(e) {
      if (isAnimating) return;
      startX = e.touches ? e.touches[0].clientX : e.clientX;
      isDragging = true;
      if (sliderWrapper) {
        sliderWrapper.style.transition = 'none';
      }
    }
    
    function handleMove(e) {
      if (!isDragging || isAnimating) return;
      e.preventDefault();
      currentX = e.touches ? e.touches[0].clientX : e.clientX;
      const diff = currentX - startX;
      const baseTranslateX = -currentSlide * window.innerWidth;
      if (sliderWrapper) {
        sliderWrapper.style.transform = `translateX(${baseTranslateX + diff}px)`;
      }
    }
    
    function handleEnd() {
      if (!isDragging || isAnimating) return;
      isDragging = false;
      
      const diff = currentX - startX;
      const threshold = window.innerWidth * 0.2;
      
      if (Math.abs(diff) > threshold) {
        if (diff > 0 && currentSlide > 0) {
          goToSlide(currentSlide - 1);
        } else if (diff < 0 && currentSlide < totalSlides - 1) {
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

    // ===== EVENT LISTENERS =====
    if (sliderWrapper) {
      sliderWrapper.addEventListener('touchstart', handleStart, { passive: false });
      sliderWrapper.addEventListener('touchmove', handleMove, { passive: false });
      sliderWrapper.addEventListener('touchend', handleEnd);
      sliderWrapper.addEventListener('mousedown', handleStart);
      sliderWrapper.addEventListener('mousemove', handleMove);
      sliderWrapper.addEventListener('mouseup', handleEnd);
    }
    
    // Dot navigation
    dots.forEach((dot, index) => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!isAnimating) goToSlide(index);
      });
    });
    
    // ===== BUTTON HANDLERS =====
    if (playButton) {
      playButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (isAnimating) return;
        
        console.log('🎮 Play clicked - starting game');
        
        // Animate slider out
        animateSliderOut();
        
        // Wait for animation, then show game
        setTimeout(() => {
          home.style.display = 'none';
          appHost.style.display = 'block';
          appHost.removeAttribute('hidden');
          
          // Animate game in
          animateGameIn();
          
          // Start game
          boot();
        }, 800);
      });
    }
    
    if (statsButton) {
      statsButton.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!isAnimating) goToSlide(1);
      });
    }
    
    if (collectiblesButton) {
      collectiblesButton.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!isAnimating) goToSlide(2);
      });
    }

    // ===== GLOBAL FUNCTIONS =====
    window.startGame = () => {
      console.log('🎮 Starting game...');
      home.style.display = 'none';
      appHost.style.display = 'block';
      appHost.removeAttribute('hidden');
      animateGameIn();
      startFreshGame(); // Use startFreshGame instead of boot
    };
    
    window.exitToMenu = () => {
      console.log('🏠 Exiting to menu...');
      
      // Clean up game state
      cleanupGame();
      
      // Animate game out
      animateGameOut();
      
      // Wait for animation, then show slider
      setTimeout(() => {
        appHost.style.display = 'none';
        appHost.setAttribute('hidden', 'true');
        home.style.display = 'block';
        home.removeAttribute('hidden');
        
        // Reset slider to first slide
        currentSlide = 0;
        updateSlider();
        
        // Force recreate navigation dots
        const dotsContainer = document.getElementById('slider-dots');
        if (dotsContainer) {
          dotsContainer.innerHTML = `
            <button class="slider-dot active" data-slide="0"></button>
            <button class="slider-dot" data-slide="1"></button>
            <button class="slider-dot" data-slide="2"></button>
          `;
          
          // Re-add event listeners
          const dots = dotsContainer.querySelectorAll('.slider-dot');
          dots.forEach((dot, index) => {
            dot.addEventListener('click', (e) => {
              e.stopPropagation();
              goToSlide(index);
            });
          });
        }
        
        // Animate slider in
        animateSliderIn();
        
        console.log('✅ Exited to menu, slider reset');
      }, 400);
    };
    
    // ===== INITIALIZE =====
    updateSlider();
    animateSliderIn();
    
    console.log('✅ CLEAN CubeCrash initialized successfully');

  } catch (error) {
    console.error('❌ Error:', error);
  }
})();
