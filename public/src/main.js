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

    // Hard guard: make dots visible and detach from any transformed container
    function ensureDotsVisible(){
      try{
        const wrap = document.getElementById('slider-dots');
        if (!wrap) return;
        // Move to body to avoid transform/fixed quirks on iOS
        if (wrap.parentElement !== document.body) {
          wrap.dataset.originParent = wrap.parentElement?.id || 'slider-container';
          document.body.appendChild(wrap);
        }
        wrap.style.display = 'flex';
        wrap.style.opacity = '1';
        wrap.style.visibility = 'visible';
        wrap.style.position = 'fixed';
        wrap.style.left = '50%';
        wrap.style.transform = 'translateX(-50%)';
        wrap.style.bottom = 'max(16px, env(safe-area-inset-bottom, 0px))';
        wrap.style.zIndex = '1000000';
        wrap.style.pointerEvents = 'auto';
      }catch{}
    }

    function hideDots(){
      try{ const wrap = document.getElementById('slider-dots'); if (wrap) wrap.style.display = 'none'; }catch{}
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
        hideDots();
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
    // Ensure dots visible on initial load as well
    requestAnimationFrame(() => { ensureDotsVisible(); });
    console.log('✅ Slider initialized');
    
    // Global functions for game
    window.startGame = () => {
      console.log('🎮 Starting game...');
      
      // Lock slider and start game (programmatic)
      sliderLocked = true;
      isDragging = false;
      hideDots();

      // Simple start - no slider manipulation
      home.style.display = 'none';
      appHost.style.display = 'block';
      appHost.removeAttribute('hidden');
      boot();
    };
    
    window.showStats = () => goToSlide(1);
    window.showCollectibles = () => goToSlide(2);
    
    // SIMPLE EXIT FUNCTION - CLEAN RESET WITHOUT INLINE OVERRIDES
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
        
        // Clean any inline styles and let CSS define layout
        try {
          ['slider-wrapper','slider-container','slider-dots'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.removeAttribute('style');
          });
          document.querySelectorAll('.slider-slide').forEach(s => s.removeAttribute('style'));
        } catch {}

        // Reset via CSS logic
        currentSlide = 0;
        updateSlider();
        // Ensure dots visible (post-layout)
        requestAnimationFrame(() => {
          ensureDotsVisible();
          setTimeout(ensureDotsVisible, 50);
          setTimeout(ensureDotsVisible, 200);
        });

        console.log('✅ Exit to menu completed - slider reset cleanly');
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
