// SIMPLE MAIN.JS - NO COMPLEXITY
import { boot } from './modules/app.js';

console.log('🚀 Starting simple CubeCrash...');

let slider;

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

    // Simple slider initialization
    console.log('🎠 Initializing simple slider...');
    
    // Get slider elements
    const sliderWrapper = document.getElementById('slider-wrapper');
    const slides = document.querySelectorAll('.slider-slide');
    const dots = document.querySelectorAll('.slider-dot');
    const playButton = document.getElementById('btn-home');
    const statsButton = document.getElementById('btn-stats');
    const collectiblesButton = document.getElementById('btn-collectibles');
    
    let currentSlide = 0;
    const totalSlides = slides.length;
    
    // Simple slider functions
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
    
    // Simple touch/drag handling
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    
    function handleStart(e) {
      startX = e.touches ? e.touches[0].clientX : e.clientX;
      isDragging = true;
      if (sliderWrapper) {
        sliderWrapper.style.transition = 'none';
      }
    }
    
    function handleMove(e) {
      if (!isDragging) return;
      e.preventDefault();
      currentX = e.touches ? e.touches[0].clientX : e.clientX;
      const diff = currentX - startX;
      const baseTranslateX = -currentSlide * window.innerWidth;
      if (sliderWrapper) {
        sliderWrapper.style.transform = `translateX(${baseTranslateX + diff}px)`;
      }
    }
    
    function handleEnd() {
      if (!isDragging) return;
      isDragging = false;
      
      const diff = currentX - startX;
      const threshold = window.innerWidth * 0.2;
      
      // Only change slide if there was significant movement
      if (Math.abs(diff) > threshold) {
        if (diff > 0 && currentSlide > 0) {
          goToSlide(currentSlide - 1);
        } else if (diff < 0 && currentSlide < totalSlides - 1) {
          goToSlide(currentSlide + 1);
        } else {
          updateSlider(); // Stay on current slide if at boundary
        }
      } else {
        updateSlider(); // Stay on current slide if not enough movement
      }
      
      if (sliderWrapper) {
        sliderWrapper.style.transition = 'transform 0.3s ease-out';
      }
    }
    
    // Add event listeners
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
        e.stopPropagation(); // Prevent slider from moving
        goToSlide(index);
      });
    });
    
    // Button handlers
    if (playButton) {
      playButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent slider from moving
        console.log('🎮 Play clicked - starting game');
        
        // Simple start - no animations
        home.style.display = 'none';
        appHost.style.display = 'block';
        appHost.removeAttribute('hidden');
        boot();
      });
    }
    
    if (statsButton) {
      statsButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent slider from moving
        console.log('📊 Stats clicked');
        goToSlide(1);
      });
    }
    
    if (collectiblesButton) {
      collectiblesButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent slider from moving
        console.log('🎁 Collectibles clicked');
        goToSlide(2);
      });
    }
    
    // Initialize
    updateSlider();
    
    // Global functions for game
    window.startGame = () => {
      console.log('🎮 Starting game...');
      
      // Reset slider to slide 0 before starting - BULLETPROOF
      currentSlide = 0;
      
      // FORCE SLIDER TO SLIDE 0 IMMEDIATELY
      if (sliderWrapper) {
        sliderWrapper.style.transition = 'none';
        sliderWrapper.style.transform = 'translateX(0px)';
        sliderWrapper.offsetHeight; // Force reflow
        sliderWrapper.style.transition = 'transform 0.3s ease-out';
      }
      
      // RESET DOTS
      dots.forEach((dot, index) => {
        dot.classList.remove('active');
        if (index === 0) {
          dot.classList.add('active');
        }
      });
      
      updateSlider();
      
      // Simple start - no animations
      home.style.display = 'none';
      appHost.style.display = 'block';
      appHost.removeAttribute('hidden');
      boot();
    };
    
    window.showStats = () => goToSlide(1);
    window.showCollectibles = () => goToSlide(2);
    
    // SIMPLE EXIT FUNCTION - KILL EVERYTHING AND RESET
    window.exitToMenu = async () => {
      console.log('🏠 Exiting to menu...');
      try {
        // USE CLEANUPGAME FROM APP.JS - BETTER APPROACH
        try {
          const { cleanupGame } = await import('./modules/app.js');
          cleanupGame();
          console.log('✅ Game cleaned up via cleanupGame()');
        } catch (e) {
          console.log('⚠️ cleanupGame import error, using fallback:', e);
          
          // FALLBACK: KILL PIXI APP
          if (window.app && window.app.destroy) {
            window.app.destroy(true);
            window.app = null;
          }
          
          // FALLBACK: RESET GSAP TIMELINE
          if (window.gsap && window.gsap.globalTimeline) {
            window.gsap.globalTimeline.resume();
            window.gsap.killTweensOf("*");
          }
        }
        
        // CLEAR APP CONTAINER
        appHost.innerHTML = '';
        appHost.style.display = 'none';
        appHost.setAttribute('hidden', 'true');
        
        // SHOW HOME
        home.style.display = 'block';
        home.removeAttribute('hidden');
        
        // RESET SLIDER TO SLIDE 0 - BULLETPROOF
        currentSlide = 0;
        
        // RESET DOTS FIRST - BULLETPROOF
        dots.forEach((dot, index) => {
          dot.classList.remove('active');
          if (index === 0) {
            dot.classList.add('active');
          }
        });
        
        // FORCE SLIDER TO SLIDE 0 IMMEDIATELY - NO UPDATE SLIDER CALL
        if (sliderWrapper) {
          sliderWrapper.style.transition = 'none'; // Disable transition
          sliderWrapper.style.transform = 'translateX(0px)';
          sliderWrapper.style.display = 'flex';
          sliderWrapper.style.visibility = 'visible';
          sliderWrapper.style.opacity = '1';
          sliderWrapper.style.position = 'relative';
          sliderWrapper.style.left = '0px';
          sliderWrapper.style.top = '0px';
          sliderWrapper.style.width = '300%'; // CRITICAL: Reset width
          sliderWrapper.style.height = 'auto';
          sliderWrapper.style.margin = '0px';
          sliderWrapper.style.padding = '0px';
          
          // Force reflow
          sliderWrapper.offsetHeight;
          
          // Re-enable transition
          sliderWrapper.style.transition = 'transform 0.3s ease-out';
        }
        
        // FORCE HOME VISIBILITY - BULLETPROOF
        if (home) {
          home.style.display = 'block';
          home.style.visibility = 'visible';
          home.style.opacity = '1';
          home.style.pointerEvents = 'auto';
          home.style.position = 'relative';
          home.style.left = '0px';
          home.style.top = '0px';
        }
        
        // FORCE PLAY BUTTON VISIBILITY
        if (playButton) {
          playButton.style.display = 'block';
          playButton.style.visibility = 'visible';
          playButton.style.opacity = '1';
          playButton.style.pointerEvents = 'auto';
          playButton.style.position = 'relative';
          playButton.style.left = '0px';
          playButton.style.top = '0px';
        }
        
        // FORCE SLIDER CONTAINER VISIBILITY
        const sliderContainer = document.getElementById('slider-container');
        if (sliderContainer) {
          sliderContainer.style.display = 'block';
          sliderContainer.style.visibility = 'visible';
          sliderContainer.style.opacity = '1';
          sliderContainer.style.position = 'relative';
          sliderContainer.style.left = '0px';
          sliderContainer.style.top = '0px';
          sliderContainer.style.marginTop = '-10vh'; // CRITICAL: Reset margin-top
          sliderContainer.style.marginLeft = '0px';
          sliderContainer.style.marginRight = '0px';
          sliderContainer.style.marginBottom = '0px';
        }
        
        // FORCE SLIDER DOTS VISIBILITY
        const sliderDots = document.getElementById('slider-dots');
        if (sliderDots) {
          sliderDots.style.display = 'flex';
          sliderDots.style.visibility = 'visible';
          sliderDots.style.opacity = '1';
          sliderDots.style.position = 'absolute';
          sliderDots.style.bottom = '0px';
          sliderDots.style.left = '50%';
          sliderDots.style.transform = 'translateX(-50%)';
          sliderDots.style.zIndex = '10';
        }
        
        // FORCE SLIDE RESET - CRITICAL FOR POSITIONING
        slides.forEach((slide, index) => {
          slide.style.width = '33.333%';
          slide.style.flexShrink = '0';
          slide.style.display = 'flex';
          slide.style.alignItems = 'flex-start';
          slide.style.justifyContent = 'center';
          slide.style.minHeight = '100vh';
          slide.style.position = 'relative';
          slide.style.paddingTop = '8vh';
          slide.style.margin = '0px';
          slide.style.left = '0px';
          slide.style.top = '0px';
        });
        
        // DO NOT CALL updateSlider() - it can override our positioning
        
        console.log('✅ Exit to menu completed - slider reset to slide 0');
      } catch (error) {
        console.error('❌ Exit to menu error:', error);
        // Fallback to reload
        window.location.reload();
      }
    };
    
    console.log('✅ Simple slider initialized successfully');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
})();
