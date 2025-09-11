// SIMPLE MAIN.JS - NO COMPLEXITY
import { boot } from './modules/app.js';

console.log('🚀 Starting simple CubeCrash...');

let slider;
let sliderLocked = false; // Guard to prevent slider moves during Play

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
        console.log(`🎯 Slider update: slide ${currentSlide}, translateX: ${translateX}px`);
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
    let touchStartTime = 0;
    let hasMoved = false;
    
    function handleStart(e) {
      if (sliderLocked) return;
      startX = e.touches ? e.touches[0].clientX : e.clientX;
      isDragging = true;
      touchStartTime = Date.now();
      hasMoved = false;
      
      if (sliderWrapper) {
        sliderWrapper.style.transition = 'none';
      }
      
      console.log('🎯 Slider drag start');
    }
    
    function handleMove(e) {
      if (sliderLocked || !isDragging) return;
      e.preventDefault();
      currentX = e.touches ? e.touches[0].clientX : e.clientX;
      const diff = currentX - startX;
      const baseTranslateX = -currentSlide * window.innerWidth;
      
      // Mark as moved if there's significant movement
      if (Math.abs(diff) > 10) {
        hasMoved = true;
      }
      
      if (sliderWrapper) {
        sliderWrapper.style.transform = `translateX(${baseTranslateX + diff}px)`;
      }
    }
    
    function handleEnd() {
      if (sliderLocked || !isDragging) return;
      isDragging = false;
      
      const diff = currentX - startX;
      const threshold = window.innerWidth * 0.3; // Increased threshold
      const touchDuration = Date.now() - touchStartTime;
      
      console.log(`🎯 Slider drag end: diff=${diff}, threshold=${threshold}, hasMoved=${hasMoved}, duration=${touchDuration}ms`);
      
      // Only change slide if there was significant movement AND it was a drag, not a tap
      if (hasMoved && Math.abs(diff) > threshold) {
        if (diff > 0 && currentSlide > 0) {
          console.log('🎯 Moving to previous slide');
          goToSlide(currentSlide - 1);
        } else if (diff < 0 && currentSlide < totalSlides - 1) {
          console.log('🎯 Moving to next slide');
          goToSlide(currentSlide + 1);
        } else {
          console.log('🎯 At boundary, staying on current slide');
          updateSlider(); // Stay on current slide if at boundary
        }
      } else {
        console.log('🎯 Not enough movement or was a tap, staying on current slide');
        updateSlider(); // Stay on current slide if not enough movement
      }
      
      if (sliderWrapper) {
        sliderWrapper.style.transition = 'transform 0.3s ease-out';
      }
    }
    
    // Add event listeners - ONLY for actual dragging, not tapping
    if (sliderWrapper) {
      sliderWrapper.addEventListener('touchstart', handleStart, { passive: false });
      sliderWrapper.addEventListener('touchmove', handleMove, { passive: false });
      sliderWrapper.addEventListener('touchend', handleEnd, { passive: false });
      sliderWrapper.addEventListener('mousedown', handleStart);
      sliderWrapper.addEventListener('mousemove', handleMove);
      sliderWrapper.addEventListener('mouseup', handleEnd);
      
      // Prevent accidental clicks on slider content
      sliderWrapper.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('🚫 Slider click prevented');
      });
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
      const startGameNow = (e) => {
        if (sliderLocked) return;
        if (e) { try { e.stopPropagation(); } catch {} }
        console.log('🎮 Play - start game');
        sliderLocked = true;
        isDragging = false;
        home.style.display = 'none';
        appHost.style.display = 'block';
        appHost.removeAttribute('hidden');
        boot();
      };

      // Swallow pointer starts so wrapper doesn't treat it as a drag
      playButton.addEventListener('mousedown', (e) => { e.stopPropagation(); });
      playButton.addEventListener('touchstart', (e) => { e.stopPropagation(); }, { passive: true });
      playButton.addEventListener('mouseup', (e) => { e.stopPropagation(); });
      // On some mobile browsers, click can be canceled; trigger on touchend as well
      playButton.addEventListener('touchend', startGameNow, { passive: true });
      playButton.addEventListener('click', startGameNow);
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
    console.log('🎯 Initializing slider...');
    console.log('🎯 Total slides:', totalSlides);
    console.log('🎯 Current slide:', currentSlide);
    updateSlider();
    console.log('✅ Slider initialized');
    
    // Global functions for game
    window.startGame = () => {
      console.log('🎮 Starting game...');
      
      // Lock slider and start game (programmatic)
      sliderLocked = true;
      isDragging = false;

      // Simple start - no slider manipulation
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
        // Unlock slider for homepage interactions
        sliderLocked = false;
        isDragging = false;
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
