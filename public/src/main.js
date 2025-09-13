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
    
    // Simple slider functions with springy animation
    function updateSlider() {
      if (sliderWrapper) {
        const translateX = -currentSlide * window.innerWidth;
        // Same feel, just quicker
        sliderWrapper.style.transition = 'transform 0.45s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
        sliderWrapper.style.transform = `translateX(${translateX}px)`;
        console.log(`🎯 Slider update: slide ${currentSlide}, translateX: ${translateX}px`);
        
        // Add subtle bounce to dots when changing slides
        dots.forEach((dot, index) => {
          const isActive = index === currentSlide;
          dot.classList.toggle('active', isActive);
          
          if (isActive) {
            // Springy bounce for active dot
            dot.style.transition = 'all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
            dot.style.transform = 'scale(1.2)';
            setTimeout(() => {
              dot.style.transform = 'scale(1)';
            }, 50);
          } else {
            dot.style.transition = 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            dot.style.transform = 'scale(1)';
          }
        });
      }
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
      if (slideIndex < 0 || slideIndex >= totalSlides) return;
      // Clean any inline transforms/opacities to keep CTA level identical on all slides
      try {
        document.querySelectorAll('.slider-slide .slide-content, .slider-slide .slide-text, .slider-slide .slide-button').forEach(el => {
          el.style.transition = '';
          el.style.transform = '';
          el.style.opacity = '';
        });
      } catch {}
      currentSlide = slideIndex;
      updateSlider();
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
      if (Math.abs(diff) > 5) { // Reduced from 10px to 5px for more sensitive detection
        hasMoved = true;
      }
      
      if (sliderWrapper) {
        // Slightly tighter follow for snappier drag
        const resistance = 0.45;
        const dampedDiff = diff * resistance;
        sliderWrapper.style.transform = `translateX(${baseTranslateX + dampedDiff}px)`;
      }
    }
    
    function handleEnd() {
      if (sliderLocked || !isDragging) return;
      isDragging = false;
      
      const diff = currentX - startX;
      const threshold = window.innerWidth * 0.13; // a bit easier to advance
      const touchDuration = Date.now() - touchStartTime;
      
      // Calculate swipe speed for more sensitive detection
      const swipeSpeed = Math.abs(diff) / Math.max(touchDuration, 1); // px/ms
      const speedThreshold = 0.45; // slightly easier flick
      const dynamicThreshold = swipeSpeed > speedThreshold ? threshold * 0.45 : threshold;
      
      console.log(`🎯 Slider drag end: diff=${diff}, threshold=${threshold}, dynamicThreshold=${dynamicThreshold}, hasMoved=${hasMoved}, duration=${touchDuration}ms, speed=${swipeSpeed.toFixed(2)}px/ms`);
      
      // Only change slide if there was significant movement AND it was a drag, not a tap
      if (hasMoved && Math.abs(diff) > dynamicThreshold) {
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
        // Quicker settle, same feel
        sliderWrapper.style.transition = 'transform 0.38s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
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
    
    // Dot navigation with springy hover effects
    dots.forEach((dot, index) => {
      // Add hover effects
      dot.addEventListener('mouseenter', () => {
        if (!sliderLocked) {
          dot.style.transition = 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
          dot.style.transform = 'scale(1.1)';
        }
      });
      
      dot.addEventListener('mouseleave', () => {
        if (!sliderLocked && index !== currentSlide) {
          dot.style.transition = 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
          dot.style.transform = 'scale(1)';
        }
      });
      
      dot.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent slider from moving
        goToSlide(index);
      });
    });
    
    // Button handlers with springy hover effects
    if (playButton) {
      // Add hover effects for play button
      playButton.addEventListener('mouseenter', () => {
        if (!sliderLocked) {
          playButton.style.transition = 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
          playButton.style.transform = 'scale(1.05) translateY(-2px)';
        }
      });
      
      playButton.addEventListener('mouseleave', () => {
        if (!sliderLocked) {
          playButton.style.transition = 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
          playButton.style.transform = 'scale(1) translateY(0)';
        }
      });
      
      const startGameNow = (e) => {
        if (sliderLocked) return;
        if (e) { try { e.stopPropagation(); } catch {} }
        console.log('🎮 Play - start game with fade animation');
        
        // Lock slider immediately to prevent interference
        sliderLocked = true;
        isDragging = false;
        hideDots();
        
        // Get dots for animation
        const dots = document.querySelectorAll('.slider-dot');
        
        // Get slide 1 elements and logo for animation
        const slide1 = document.querySelector('.slider-slide[data-slide="0"]');
        const slide1Content = slide1?.querySelector('.slide-content');
        const slide1Text = slide1?.querySelector('.slide-text');
        const slide1Button = slide1?.querySelector('.slide-button');
        const slide1Hero = slide1?.querySelector('.hero-container');
        const homeLogo = document.getElementById('home-logo');
        
        if (slide1 && slide1Content && slide1Text && slide1Button && slide1Hero) {
          // Add elastic spring bounce pop out animation - 0.65 seconds
          slide1Content.style.transition = 'opacity 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
          slide1Text.style.transition = 'opacity 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
          slide1Button.style.transition = 'opacity 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
          slide1Hero.style.transition = 'opacity 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
          
          // Add logo animation if it exists
          if (homeLogo) {
            homeLogo.style.transition = 'opacity 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
          }
          
          // Add dots animation
          dots.forEach((dot, index) => {
            dot.style.transition = 'opacity 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
          });
          
          // Apply gentle elastic pop out with bounce sequence
          slide1Content.style.opacity = '0';
          slide1Content.style.transform = 'scale(0) translateY(-20px)';
          slide1Text.style.opacity = '0';
          slide1Text.style.transform = 'scale(0) translateY(-15px)';
          slide1Button.style.opacity = '0';
          slide1Button.style.transform = 'scale(0) translateY(-10px)';
          slide1Hero.style.opacity = '0';
          slide1Hero.style.transform = 'scale(0) translateY(-25px)';
          
          // Apply logo animation
          if (homeLogo) {
            homeLogo.style.opacity = '0';
            homeLogo.style.transform = 'scale(0) translateY(-30px)';
          }
          
          // Apply dots animation
          dots.forEach((dot, index) => {
            dot.style.opacity = '0';
            dot.style.transform = 'scale(0) translateY(-5px)';
          });
          
          // Start game after animation completes
          setTimeout(() => {
            home.style.display = 'none';
            appHost.style.display = 'block';
            appHost.removeAttribute('hidden');
            boot();
          }, 650); // Wait for elastic spring bounce animation to complete
        } else {
          // Fallback if elements not found - start game immediately
          console.log('⚠️ Slide elements not found, starting game without animation');
          home.style.display = 'none';
          appHost.style.display = 'block';
          appHost.removeAttribute('hidden');
          boot();
        }
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
      // Add hover effects for stats button
      statsButton.addEventListener('mouseenter', () => {
        if (!sliderLocked) {
          statsButton.style.transition = 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
          statsButton.style.transform = 'scale(1.05) translateY(-2px)';
        }
      });
      
      statsButton.addEventListener('mouseleave', () => {
        if (!sliderLocked) {
          statsButton.style.transition = 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
          statsButton.style.transform = 'scale(1) translateY(0)';
        }
      });
      
      statsButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent slider from moving
        console.log('📊 Stats clicked');
        goToSlide(1);
      });
    }
    
    if (collectiblesButton) {
      // Add hover effects for collectibles button
      collectiblesButton.addEventListener('mouseenter', () => {
        if (!sliderLocked) {
          collectiblesButton.style.transition = 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
          collectiblesButton.style.transform = 'scale(1.05) translateY(-2px)';
        }
      });
      
      collectiblesButton.addEventListener('mouseleave', () => {
        if (!sliderLocked) {
          collectiblesButton.style.transition = 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
          collectiblesButton.style.transform = 'scale(1) translateY(0)';
        }
      });
      
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
        
        // Prepare for pop in animation - hide all elements first
        const slide1 = document.querySelector('.slider-slide[data-slide="0"]');
        const homeLogo = document.getElementById('home-logo');
        const dots = document.querySelectorAll('.slider-dot');
        if (slide1) {
          const slide1Content = slide1.querySelector('.slide-content');
          const slide1Text = slide1.querySelector('.slide-text');
          const slide1Button = slide1.querySelector('.slide-button');
          const slide1Hero = slide1.querySelector('.hero-container');
          
          if (slide1Content && slide1Text && slide1Button && slide1Hero) {
            // Hide all elements initially for pop in effect
            slide1Content.style.opacity = '0';
            slide1Content.style.transform = 'scale(0) translateY(-20px)';
            slide1Content.style.transition = 'none';
            
            slide1Text.style.opacity = '0';
            slide1Text.style.transform = 'scale(0) translateY(-15px)';
            slide1Text.style.transition = 'none';
            
            slide1Button.style.opacity = '0';
            slide1Button.style.transform = 'scale(0) translateY(-10px)';
            slide1Button.style.transition = 'none';
            
            slide1Hero.style.opacity = '0';
            slide1Hero.style.transform = 'scale(0) translateY(-25px)';
            slide1Hero.style.transition = 'none';
            
            // Hide logo if it exists
            if (homeLogo) {
              homeLogo.style.opacity = '0';
              homeLogo.style.transform = 'scale(0) translateY(-30px)';
              homeLogo.style.transition = 'none';
            }
            
            // Hide dots initially
            dots.forEach((dot, index) => {
              dot.style.opacity = '0';
              dot.style.transform = 'scale(0) translateY(-5px)';
              dot.style.transition = 'none';
            });
            
            // Trigger elastic spring pop in animation after a brief delay
            setTimeout(() => {
              // Add elastic spring bounce pop in animation - 0.65 seconds
              slide1Content.style.transition = 'opacity 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
              slide1Text.style.transition = 'opacity 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
              slide1Button.style.transition = 'opacity 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
              slide1Hero.style.transition = 'opacity 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
              
              if (homeLogo) {
                homeLogo.style.transition = 'opacity 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
              }
              
              // Add dots animation
              dots.forEach((dot, index) => {
                dot.style.transition = 'opacity 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
              });
              
              // Apply gentle pop in styles with bounce sequence
              slide1Content.style.opacity = '1';
              slide1Content.style.transform = 'scale(1) translateY(0)';
              slide1Text.style.opacity = '1';
              slide1Text.style.transform = 'scale(1) translateY(-8px)'; // Keep the 8px offset
              slide1Button.style.opacity = '1';
              slide1Button.style.transform = 'scale(1) translateY(0)';
              slide1Hero.style.opacity = '1';
              slide1Hero.style.transform = 'scale(1) translateY(0)';
              
              if (homeLogo) {
                homeLogo.style.opacity = '1';
                homeLogo.style.transform = 'scale(1) translateY(0)';
              }
              
              // Apply dots animation
              dots.forEach((dot, index) => {
                dot.style.opacity = '1';
                dot.style.transform = 'scale(1) translateY(0)';
              });
              
              // Reset animation styles after animation completes
              setTimeout(() => {
                slide1Content.style.transition = 'none';
                slide1Text.style.transition = 'none';
                slide1Button.style.transition = 'none';
                slide1Hero.style.transition = 'none';
                
                if (homeLogo) {
                  homeLogo.style.transition = 'none';
                }
                
                dots.forEach((dot, index) => {
                  dot.style.transition = 'none';
                });
                
                // Reset to final positions
                slide1Content.style.opacity = '1';
                slide1Content.style.transform = 'scale(1) translateY(0)';
                slide1Text.style.opacity = '1';
                slide1Text.style.transform = 'scale(1) translateY(-8px)'; // Keep the 8px offset
                slide1Button.style.opacity = '1';
                slide1Button.style.transform = 'scale(1) translateY(0)';
                slide1Hero.style.opacity = '1';
                slide1Hero.style.transform = 'scale(1) translateY(0)';
                
                if (homeLogo) {
                  homeLogo.style.opacity = '1';
                  homeLogo.style.transform = 'scale(1) translateY(0)';
                }
                
                dots.forEach((dot, index) => {
                  dot.style.opacity = '1';
                  dot.style.transform = 'scale(1) translateY(0)';
                });
                
                // Unlock slider after animation completes
                sliderLocked = false;
              }, 650); // Wait for animation to complete
              
              console.log('✅ Slide 1 fast pop in animation triggered');
            }, 100); // Small delay to ensure smooth transition
          }
        }
        
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
