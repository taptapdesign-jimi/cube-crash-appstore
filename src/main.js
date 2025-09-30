// SIMPLE MAIN.JS - NO COMPLEXITY
import { boot, layout as appLayout } from './modules/app.js';
import { gsap } from 'gsap';

console.log('🚀 Starting simple CubeCrash...');

// Resume Game Modal
async function showResumeGameModal() {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = [
      'position: fixed',
      'top: 0',
      'left: 0',
      'width: 100%',
      'height: 100%',
      'background: rgba(0, 0, 0, 0.8)',
      'display: flex',
      'align-items: center',
      'justify-content: center',
      'z-index: 1000000',
      'font-family: Arial, sans-serif'
    ].join(';');

    const modal = document.createElement('div');
    modal.style.cssText = [
      'background: white',
      'border-radius: 20px',
      'padding: 40px',
      'text-align: center',
      'max-width: 400px',
      'width: 90%',
      'box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3)'
    ].join(';');

    // Time icon (240px converted to percentage)
    const icon = document.createElement('img');
    icon.src = 'assets/time-icon.png';
    icon.style.cssText = [
      'width: 15%', // 240px at 1600px width = 15%
      'height: auto',
      'margin-bottom: 20px'
    ].join(';');

    // Title
    const title = document.createElement('h2');
    title.textContent = 'Resume game?';
    title.style.cssText = [
      'margin: 0 0 10px 0',
      'font-size: 28px',
      'font-weight: bold',
      'color: #8B4513'
    ].join(';');

    // Subtitle
    const subtitle = document.createElement('p');
    subtitle.textContent = 'Resume your last board.';
    subtitle.style.cssText = [
      'margin: 0 0 30px 0',
      'font-size: 16px',
      'color: #666'
    ].join(';');

    // Buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = [
      'display: flex',
      'flex-direction: column',
      'gap: 15px'
    ].join(';');

    // Continue button
    const continueBtn = document.createElement('button');
    continueBtn.textContent = 'Continue';
    continueBtn.style.cssText = [
      'background: #FF8C00',
      'color: white',
      'border: none',
      'padding: 15px 30px',
      'border-radius: 10px',
      'font-size: 18px',
      'font-weight: bold',
      'cursor: pointer',
      'box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2)'
    ].join(';');

    // Exit to menu button
    const exitBtn = document.createElement('button');
    exitBtn.textContent = 'Exit to menu';
    exitBtn.style.cssText = [
      'background: white',
      'color: #333',
      'border: 2px solid #ddd',
      'padding: 15px 30px',
      'border-radius: 10px',
      'font-size: 18px',
      'font-weight: bold',
      'cursor: pointer',
      'box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1)'
    ].join(';');

    // Event handlers
    continueBtn.onclick = async () => {
      document.body.removeChild(overlay);
      
      // Wait for app.js to load and expose loadGameState
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max wait
      
      while (attempts < maxAttempts) {
        if (typeof window.loadGameState === 'function') {
          console.log('✅ loadGameState function found, attempting to load...');
          try {
            const loaded = await window.loadGameState();
            if (loaded) {
              console.log('✅ Game loaded successfully!');
              resolve();
              return;
            } else {
              console.log('⚠️ loadGameState returned false');
              break;
            }
          } catch (error) {
            console.error('❌ Error loading game state:', error);
            break;
          }
        }
        
        // Wait 100ms before trying again
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      // If we get here, loading failed
      console.log('⚠️ Failed to load game after', attempts, 'attempts, starting new game');
      alert('Failed to load game, starting new game.');
      boot();
      resolve();
    };

    exitBtn.onclick = () => {
      document.body.removeChild(overlay);
      localStorage.removeItem('cc_saved_game');
      checkForSavedGame();
      resolve();
    };

    // Assemble modal
    buttonsContainer.appendChild(continueBtn);
    buttonsContainer.appendChild(exitBtn);
    modal.appendChild(icon);
    modal.appendChild(title);
    modal.appendChild(subtitle);
    modal.appendChild(buttonsContainer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  });
}

// Check for saved game on startup
async function checkForSavedGame() {
  const hasSavedGame = localStorage.getItem('cc_saved_game');
  if (hasSavedGame) {
    try {
      const gameState = JSON.parse(hasSavedGame);
      const saveAge = Date.now() - gameState.timestamp;
      if (saveAge < 24 * 60 * 60 * 1000) { // Less than 24 hours old
        console.log('🎮 Found saved game, showing resume modal...');
        await showResumeGameModal();
        return;
      } else {
        console.log('⚠️ Saved game is too old, removing...');
        localStorage.removeItem('cc_saved_game');
      }
    } catch (error) {
      console.warn('⚠️ Corrupted save file, removing...', error);
      localStorage.removeItem('cc_saved_game');
    }
  }
  
  // No saved game, start normally
  boot();
}

const UI_STATE_KEY = 'cubeCrash_ui_state_v1';
let uiState = {
  currentSlide: 0,
  gameActive: false,
  menuVisible: false,
  pausedFromBackground: false,
  lastActiveAt: 0
};

function loadUIState(){
  return false;
}

function saveUIState(){
  // Persistence disabled per request
}

function markGameActive(active){
  uiState.gameActive = !!active;
  uiState.lastActiveAt = Date.now();
}

function setMenuVisible(visible, { fromBackground = false } = {}){
  uiState.menuVisible = !!visible;
  if (visible && fromBackground) {
    uiState.pausedFromBackground = true;
  }
  if (!visible) {
    uiState.pausedFromBackground = false;
  }
}

function recordCurrentSlide(index){
  uiState.currentSlide = index;
}

let slider;
let sliderLocked = false; // Guard to prevent slider moves during Play
let currentSlideTransition = null; // per-swipe transition (duration/ease)
const DRAG_RESISTANCE = 0.8; // how much slider follows finger (0..1)
const OUT_OF_BOUNDS_RESISTANCE = 0.15; // follow when dragging beyond edges
const MAX_OOB_OFFSET_RATIO = 0.15; // clamp max visual offset at edges to 15% width
let pendingStatsPopNodes = [];
const SLIDER_SNAP_TRANSITION = 'transform 0.36s cubic-bezier(0.45, 0.05, 0.2, 0.95)';
const PARALLAX_FACTOR = 0.7;
const PARALLAX_DRAG_FACTOR = 0.6;
const PARALLAX_SCALE = 0.85; // reduce background zoom a touch so it feels farther away
const PARALLAX_SNAP_DURATION = 0.3;
const PARALLAX_EASE = 'power2.out';
const PARALLAX_OVERFLOW = 800; // Allow parallax to extend beyond screen edges for smooth movement
const PARALLAX_IDLE_AMPLITUDE = 28; // how far the idle sway can travel left/right
const PARALLAX_IDLE_SPEED = 0.00035; // speed multiplier for idle sway (ms based)
const PARALLAX_ENABLED = false; // disable interactive parallax (use simple drifting background)

const BG_DRIFT_DISTANCE = -120; // px
const BG_DRIFT_DURATION = 5;    // seconds
const BG_DRIFT_EASE_OUT = 'sine.in';
const BG_RETURN_EASE = 'sine.out';

let bgTween = null;
let currentParallaxX = 0; // track current parallax position
let parallaxDragStartX = 0; // starting parallax position at touchstart
const PARALLAX_SMOOTH = 0.15; // smoothing factor for parallax follow (0..1)
let parallaxTargetX = 0;
let parallaxCurrentX = 0;
let parallaxRafId = 0;

function __clampParallax(x){
  return Math.max(-PARALLAX_OVERFLOW, Math.min(PARALLAX_OVERFLOW, x));
}

function applyParallaxTransform(image, value){
  if (!PARALLAX_ENABLED || !image) return 0;
  const clamped = __clampParallax(value);
  const transform = `translate(-50%, -50%) translate3d(${clamped}px, 0, 0) scale(${PARALLAX_SCALE})`;
  if (image.style.transform !== transform) {
    image.style.transform = transform;
  }
  return clamped;
}

function ensureParallaxLoop(sliderParallaxImage){
  if (!PARALLAX_ENABLED || !sliderParallaxImage) return;
  if (parallaxRafId) return;
  const step = () => {
    const now = performance.now ? performance.now() : Date.now();
    const idleOffset = isDragging ? 0 : Math.sin(now * PARALLAX_IDLE_SPEED) * PARALLAX_IDLE_AMPLITUDE;
    const desired = __clampParallax(parallaxTargetX + idleOffset);
    const dx = desired - parallaxCurrentX;
    if (Math.abs(dx) > 0.05) {
      parallaxCurrentX += dx * PARALLAX_SMOOTH;
    } else {
      parallaxCurrentX = desired;
    }
    currentParallaxX = applyParallaxTransform(sliderParallaxImage, parallaxCurrentX);
    parallaxRafId = requestAnimationFrame(step);
  };
  parallaxRafId = requestAnimationFrame(step);
}

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
    const sliderParallaxImage = document.getElementById('slider-parallax-image');
    // Reduce parallax image zoom by 50% and keep transform origin centered
    try {
      if (sliderParallaxImage) {
        if (PARALLAX_ENABLED) {
          sliderParallaxImage.style.transformOrigin = '50% 50%';
          sliderParallaxImage.style.left = '50%';
          sliderParallaxImage.style.top = '50%';
          applyParallaxTransform(sliderParallaxImage, 0);
          currentParallaxX = 0;
          parallaxCurrentX = 0;
          parallaxTargetX = 0;
          ensureParallaxLoop(sliderParallaxImage);
        } else {
          sliderParallaxImage.style.transform = '';
          sliderParallaxImage.style.left = '0';
          sliderParallaxImage.style.top = '-60vh';
          sliderParallaxImage.style.transform = 'translateX(0px)';
        }
      }
    } catch {}

    const setParallax = (targetX, { animated = true } = {}) => {
      if (!PARALLAX_ENABLED || !sliderParallaxImage) return;
      const clampedX = __clampParallax(targetX);
      parallaxTargetX = clampedX;
      if (!isDragging) {
        parallaxCurrentX = clampedX;
      }
      applyParallaxTransform(sliderParallaxImage, clampedX);
      ensureParallaxLoop(sliderParallaxImage);
    };

    const driftBackground = (towardsLeft = true) => {
      if (!sliderParallaxImage) return;
      try { bgTween?.kill?.(); } catch {}
      const targetX = towardsLeft ? BG_DRIFT_DISTANCE : 0;
      bgTween = gsap.to(sliderParallaxImage, {
        x: targetX,
        duration: BG_DRIFT_DURATION,
        ease: towardsLeft ? BG_DRIFT_EASE_OUT : BG_RETURN_EASE,
        overwrite: true
      });
    };
    const slides = document.querySelectorAll('.slider-slide');
    const dots = document.querySelectorAll('.slider-dot');
    const playButton = document.getElementById('btn-home');
    const statsButton = document.getElementById('btn-stats');
    const collectiblesButton = document.getElementById('btn-collectibles');
    const settingsButton = document.getElementById('btn-settings');
    const statsScreen = document.getElementById('stats-screen');
    const statsBackButton = document.getElementById('stats-back-btn');
    const statsResetButton = document.getElementById('stats-reset-btn');
    const menuScreen = document.getElementById('menu-screen');
    const menuBackBtn = document.getElementById('menu-back-btn');
    const menuUnpauseAction = document.getElementById('menu-unpause-action');
    const menuRestartAction = document.getElementById('menu-restart-action');
    const menuExitBtn = document.getElementById('menu-exit-btn');
    const menuTestFailBtn = document.getElementById('menu-test-fail-btn');
    
    let currentSlide = 0;
    const totalSlides = slides.length;
    const stateLoaded = loadUIState();
    let autoBootedFromState = false;
    if (stateLoaded) {
      const savedSlide = Number.isFinite(uiState.currentSlide) ? Math.floor(uiState.currentSlide) : 0;
      currentSlide = Math.max(0, Math.min(totalSlides - 1, savedSlide));
    }
    
    // Game statistics tracking
    let gameStats = {
      highScore: 0,
      cubesCracked: 0,
      helpersUsed: 0,
      longestCombo: 0,
      collectiblesUnlocked: 0,
      boardsCleared: 0,
      timePlayed: 0
    };
    
    // Time tracking variables
    let gameStartTime = null;
    let timeTrackingInterval = null;
    
    // Function to start time tracking
    function startTimeTracking() {
      if (gameStartTime) return; // Already tracking
      gameStartTime = Date.now();
      console.log('⏱️ Started time tracking');
      
      // Update time display every second
      timeTrackingInterval = setInterval(updateTimeDisplay, 1000);
    }
    
    // Function to stop time tracking and save to stats
    function stopTimeTracking() {
      if (!gameStartTime) return; // Not tracking
      
      const sessionTime = Math.floor((Date.now() - gameStartTime) / 1000); // seconds
      gameStats.timePlayed += sessionTime;
      saveStatsToStorage();
      
      gameStartTime = null;
      if (timeTrackingInterval) {
        clearInterval(timeTrackingInterval);
        timeTrackingInterval = null;
      }
      
      console.log('⏱️ Stopped time tracking, session:', sessionTime, 'total:', gameStats.timePlayed);
    }
    
    // Function to format time in HH:MM:SS format
    function formatTime(seconds) {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    // Function to update time display in real-time
    function updateTimeDisplay() {
      const timePlayedEl = document.getElementById('time-played');
      if (!timePlayedEl) return;
      
      let totalTime = gameStats.timePlayed;
      if (gameStartTime) {
        totalTime += Math.floor((Date.now() - gameStartTime) / 1000);
      }
      
      timePlayedEl.textContent = formatTime(totalTime);
    }
    
    // Simple slider functions with adjustable settle animation
    function updateSlider({ touchParallax = false, animateParallax = true } = {}) {
      if (sliderWrapper) {
        const translateX = -currentSlide * window.innerWidth;
        const transition = currentSlideTransition || SLIDER_SNAP_TRANSITION;
        sliderWrapper.style.transition = transition;
        sliderWrapper.style.transform = `translateX(${translateX}px)`;
        if (PARALLAX_ENABLED && sliderParallaxImage) {
          const parallaxX = __clampParallax(translateX * PARALLAX_FACTOR);
          parallaxTargetX = parallaxX;
          if (!isDragging) {
            parallaxCurrentX = parallaxX;
          }
          ensureParallaxLoop(sliderParallaxImage);
        }
        console.log(`🎯 Slider update: slide ${currentSlide}, translateX: ${translateX}px`);
        // Clear custom transition after applying
        currentSlideTransition = null;
        
        // GSAP-powered elastic, organic transitions for dots
        dots.forEach((dot, index) => {
          const wantsActive = index === currentSlide;
          const isActive = dot.classList.contains('active');

          // Kill any running tweens on this dot
          gsap.killTweensOf(dot);

          // Activate
          if (wantsActive && !isActive) {
            dot.classList.add('active'); // trigger width/height/color transition
            gsap.set(dot, { transformOrigin: '50% 50%', scale: 0.92 });
            gsap.to(dot, {
              scale: 1,
              duration: 0.65,
              ease: 'elastic.out(1, 0.6)',
              overwrite: true
            });
          }

          // Deactivate
          if (!wantsActive && isActive) {
            dot.classList.remove('active'); // trigger width/height/color transition
            gsap.set(dot, { transformOrigin: '50% 50%', scale: 0.88 });
            gsap.to(dot, {
              scale: 1,
              duration: 0.55,
              ease: 'elastic.out(1, 0.65)',
              overwrite: true
            });
          }

        // If no state change, gently settle to 1 without a snap
        if ((wantsActive && isActive) || (!wantsActive && !isActive)) {
          gsap.to(dot, { scale: 1, duration: 0.2, ease: 'power2.out', overwrite: true });
        }
      });

      recordCurrentSlide(currentSlide);
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
    
    const prepareStatsPopIn = () => {
      if (!statsScreen) return [];
      const nodes = [];
      const register = (el, baseDelay = 0, scale = 0.9, translate = 10) => {
        if (!el) return;
        if (el.classList?.contains('stat-divider') || el.classList?.contains('stats-header') || el.classList?.contains('stats-header-top')) {
          return;
        }
        try {
          el.style.transition = 'none';
          el.style.opacity = '0';
          el.style.transform = `scale(${scale}) translateY(${translate}px)`;
          el.style.transformOrigin = '50% 50%';
        } catch {}
        nodes.push({ el, baseDelay, scale, translate });
      };

      const scrollable = statsScreen.querySelector('.stats-scrollable');
      if (scrollable) {
        const items = Array.from(scrollable.querySelectorAll('.stat-item'));
        const randomized = items.slice().sort(() => Math.random() - 0.5);
        randomized.forEach((child, idx) => {
          register(child, 120 + idx * 18, 0.86, 14);
        });
      }

      return nodes;
    };

    const runStatsPopIn = (nodes) => {
      if (!nodes || !nodes.length) return;
      requestAnimationFrame(() => {
        nodes.forEach((entry, idx) => {
          const { el, baseDelay = 0 } = entry;
          const delay = baseDelay + idx * 22 + Math.random() * 45;
          setTimeout(() => {
            try {
              el.style.transition = 'opacity 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
              el.style.opacity = '1';
              el.style.transform = 'scale(1) translateY(0)';
            } catch {}
            setTimeout(() => {
              try {
                el.style.removeProperty('transition');
                el.style.removeProperty('transform');
                el.style.removeProperty('opacity');
              } catch {}
            }, 620);
          }, delay);
        });
      });
    };

    function showStatsScreen() {
      if (sliderLocked) return;
      console.log('📊 Showing stats screen');
      console.log('📊 Stats screen element:', statsScreen);
      
      // Lock slider immediately
      sliderLocked = true;
      isDragging = false;
      hideDots();
      
      // Get slide 2 elements for exit animation
      const slide2 = document.querySelector('.slider-slide[data-slide="1"]');
      const slide2Content = slide2?.querySelector('.slide-content');
      const slide2Text = slide2?.querySelector('.slide-text');
      const slide2Button = slide2?.querySelector('.slide-button');
      const slide2Hero = slide2?.querySelector('.hero-container');
      
      console.log('📊 Slide 2 elements:', { slide2, slide2Content, slide2Text, slide2Button, slide2Hero });
      
      if (slide2 && slide2Content && slide2Text && slide2Button && slide2Hero) {
        // Add elastic spring bounce pop out animation - 0.65 seconds
        slide2Content.style.transition = 'opacity 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
        slide2Text.style.transition = 'opacity 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
        slide2Button.style.transition = 'opacity 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
        slide2Hero.style.transition = 'opacity 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
        
        // Add logo animation if it exists (identical to slide 1)
        const homeLogo = document.getElementById('home-logo');
        if (homeLogo) {
          homeLogo.style.transition = 'opacity 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
        }
        
        // Apply gentle elastic pop out with bounce sequence (identical to slide 1)
        slide2Content.style.opacity = '0';
        slide2Content.style.transform = 'scale(0) translateY(-20px)';
        slide2Text.style.opacity = '0';
        slide2Text.style.transform = 'scale(0) translateY(-15px)';
        slide2Button.style.opacity = '0';
        slide2Button.style.transform = 'scale(0) translateY(-10px)';
        slide2Hero.style.opacity = '0';
        slide2Hero.style.transform = 'scale(0) translateY(-25px)';
        
        // Apply logo animation (identical to slide 1)
        if (homeLogo) {
          homeLogo.style.opacity = '0';
          homeLogo.style.transform = 'scale(0) translateY(-30px)';
        }
        
        // Wait for exit animation to complete, then show stats
        setTimeout(() => {
          console.log('📊 Showing stats screen after animation');
          if (home) home.hidden = true;
          if (statsScreen) {
            // Load stats, then prime counters to 0 so they animate every entry
            loadStatsFromStorage();

            try {
              const ids = ['high-score','boards-cleared','cubes-cracked','helpers-used','longest-combo','time-played'];
              ids.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                  el.classList.remove('animating');
                  el.textContent = '0';
                }
              });
              const tp = document.getElementById('time-played');
              if (tp) {
                tp.classList.remove('animating');
                tp.textContent = '00:00:00';
              }
            } catch {}

            // Animate numbers up to current values
            updateStatsData(gameStats);
            
            statsScreen.hidden = false;
            statsScreen.removeAttribute('hidden');
            statsScreen.style.display = 'flex';
            pendingStatsPopNodes = prepareStatsPopIn();
            // Animate stats screen in
            statsScreen.style.opacity = '0';
            statsScreen.style.transform = 'scale(0.8) translateY(20px)';
            statsScreen.style.transition = 'opacity 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55), transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
            
            console.log('📊 Stats screen styles applied:', {
              hidden: statsScreen.hidden,
              display: statsScreen.style.display,
              opacity: statsScreen.style.opacity,
              transform: statsScreen.style.transform
            });
            
            setTimeout(() => {
              statsScreen.style.opacity = '1';
              statsScreen.style.transform = 'scale(1) translateY(0)';
              console.log('📊 Stats screen animation complete');
              runStatsPopIn(pendingStatsPopNodes);
            }, 50);
          }
        }, 650); // Wait for elastic spring bounce animation to complete
      } else {
        // Fallback if elements not found
        console.log('📊 Using fallback - elements not found');
        if (home) home.hidden = true;
        if (statsScreen) {
          // Load stats, then prime counters to 0 so they animate every entry
          loadStatsFromStorage();

          try {
            const ids = ['high-score','boards-cleared','cubes-cracked','helpers-used','longest-combo','time-played'];
            ids.forEach(id => {
              const el = document.getElementById(id);
              if (el) {
                el.classList.remove('animating');
                el.textContent = '0';
              }
            });
            const tp = document.getElementById('time-played');
            if (tp) {
              tp.classList.remove('animating');
              tp.textContent = '00:00:00';
            }
          } catch {}

          // Animate numbers up to current values
          updateStatsData(gameStats);
          
          statsScreen.hidden = false;
          statsScreen.removeAttribute('hidden');
          statsScreen.style.display = 'flex';
          pendingStatsPopNodes = prepareStatsPopIn();
          // Animate stats screen in
          statsScreen.style.opacity = '0';
          statsScreen.style.transform = 'scale(0.8) translateY(20px)';
          statsScreen.style.transition = 'opacity 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55), transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
          
          console.log('📊 Stats screen fallback styles applied:', {
            hidden: statsScreen.hidden,
            display: statsScreen.style.display,
            opacity: statsScreen.style.opacity,
            transform: statsScreen.style.transform
          });
          
          setTimeout(() => {
            statsScreen.style.opacity = '1';
            statsScreen.style.transform = 'scale(1) translateY(0)';
            console.log('📊 Stats screen fallback animation complete');
            runStatsPopIn(pendingStatsPopNodes);
          }, 50);
        }
      }
    }
    
    function hideStatsScreen() {
      console.log('📊 Hiding stats screen with exit animation');
      
      if (!statsScreen) return;
      pendingStatsPopNodes = [];
      
      // Add exit animation (reverse of enter animation)
      statsScreen.style.transition = 'opacity 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55), transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
      statsScreen.style.opacity = '0';
      statsScreen.style.transform = 'scale(0.8) translateY(20px)';
      
      // Wait for exit animation to complete, then hide and show slide 2 with enter animation
      setTimeout(() => {
        statsScreen.hidden = true;
        statsScreen.setAttribute('hidden', 'true');
        if (home) home.hidden = false;
        
        // Unlock slider and show dots
        sliderLocked = false;
        ensureDotsVisible();

        // Navigate to Stats slide (index 1) first
        try { goToSlide(1); } catch {}
        
        // Get slide 2 elements for enter animation
        const slide2 = document.querySelector('.slider-slide[data-slide="1"]');
        const slide2Content = slide2?.querySelector('.slide-content');
        const slide2Text = slide2?.querySelector('.slide-text');
        const slide2Button = slide2?.querySelector('.slide-button');
        const slide2Hero = slide2?.querySelector('.hero-container');
        const homeLogo = document.getElementById('home-logo');
        
        // Immediately hide all elements to prevent flash
        if (slide2Content) {
          slide2Content.style.opacity = '0';
          slide2Content.style.transform = 'scale(0) translateY(-20px)';
          slide2Content.style.transition = 'none';
        }
        if (slide2Text) {
          slide2Text.style.opacity = '0';
          slide2Text.style.transform = 'scale(0) translateY(-15px)';
          slide2Text.style.transition = 'none';
        }
        if (slide2Button) {
          slide2Button.style.opacity = '0';
          slide2Button.style.transform = 'scale(0) translateY(-10px)';
          slide2Button.style.transition = 'none';
        }
        if (slide2Hero) {
          slide2Hero.style.opacity = '0';
          slide2Hero.style.transform = 'scale(0) translateY(-25px)';
          slide2Hero.style.transition = 'none';
        }
        if (homeLogo) {
          homeLogo.style.opacity = '0';
          homeLogo.style.transform = 'scale(0) translateY(-30px)';
          homeLogo.style.transition = 'none';
        }
        
        // Small delay to let goToSlide complete, then start animation
        setTimeout(() => {
          // Start logo animation
          if (homeLogo) {
            setTimeout(() => {
              const spring = 'cubic-bezier(0.68, -0.8, 0.265, 1.8)';
              const trans = `opacity 0.65s ${spring}, transform 0.65s ${spring}`;
              homeLogo.style.transition = trans;
              homeLogo.style.opacity = '1';
              homeLogo.style.transform = 'scale(1) translateY(0)';
              setTimeout(() => {
                homeLogo.style.transition = 'none';
              }, 700);
            }, 20);
          }

          // Start slide 2 elements animation
          if (slide2 && slide2Content && slide2Text && slide2Button && slide2Hero) {
            // Trigger elastic spring pop in animation after a brief delay (identical to slide 1)
            setTimeout(() => {
              // Add elastic spring bounce pop in animation - 0.65 seconds
              slide2Content.style.transition = 'opacity 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
              slide2Text.style.transition = 'opacity 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
              slide2Button.style.transition = 'opacity 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
              slide2Hero.style.transition = 'opacity 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';

              // Apply gentle pop in styles with bounce sequence (identical to slide 1)
              slide2Content.style.opacity = '1';
              slide2Content.style.transform = 'scale(1) translateY(0)';
              slide2Text.style.opacity = '1';
              slide2Text.style.transform = 'scale(1) translateY(-8px)'; // Keep the 8px offset
              slide2Button.style.opacity = '1';
              slide2Button.style.transform = 'scale(1) translateY(0)';
              slide2Hero.style.opacity = '1';
              slide2Hero.style.transform = 'scale(1) translateY(0)';

              // Reset animation styles after animation completes
              setTimeout(() => {
                slide2Content.style.transition = 'none';
                slide2Text.style.transition = 'none';
                slide2Button.style.transition = 'none';
                slide2Hero.style.transition = 'none';
              }, 700);
            }, 20);
          }
        }, 50); // Small delay to let goToSlide complete
      }, 500);
    }
    
    // Menu screen functions
    function showMenuScreen() {
      console.log('📋 Showing menu screen');
      
      if (!menuScreen) return;
      
      // Pause the game when showing menu
      if (uiState.gameActive) {
        try {
          if (window.CC && typeof window.CC.pauseGame === 'function') {
            window.CC.pauseGame();
          }
        } catch (error) {
          console.warn('Failed to pause game:', error);
        }
      }
      
      // Update menu data from current game state
      updateMenuData();
      
      // Show menu screen
      menuScreen.hidden = false;
      menuScreen.removeAttribute('hidden');
      menuScreen.style.display = 'flex';
      setMenuVisible(true);
      
      // Add enter animation
      menuScreen.style.opacity = '0';
      menuScreen.style.transform = 'scale(0.8) translateY(20px)';
      menuScreen.style.transition = 'opacity 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55), transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
      
      setTimeout(() => {
        menuScreen.style.opacity = '1';
        menuScreen.style.transform = 'scale(1) translateY(0)';
      }, 50);
    }
    
    function hideMenuScreen() {
      console.log('📋 Hiding menu screen');
      
      if (!menuScreen) return;
      
      setMenuVisible(false);
      
      // Add exit animation
      menuScreen.style.transition = 'opacity 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55), transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
      menuScreen.style.opacity = '0';
      menuScreen.style.transform = 'scale(0.8) translateY(20px)';

      // Wait for exit animation to complete, then hide
      setTimeout(() => {
        menuScreen.hidden = true;
        menuScreen.setAttribute('hidden', 'true');
      }, 500);
    }
    
    function updateMenuData() {
      // Get current game state
      let currentScore = 0;
      let currentBoard = 1;
      let movesLeft = 0;
      
      try {
        const gameState = (window.CC && typeof window.CC.state === 'function') ? window.CC.state() : null;
        if (gameState) {
          currentScore = gameState.score || 0;
          currentBoard = gameState.board || 1;
          movesLeft = gameState.movesLeft || 0;
        }
      } catch (error) {
        console.warn('Failed to get game state:', error);
      }
      
      // Update menu elements
      const scoreEl = document.getElementById('menu-current-score');
      const boardEl = document.getElementById('menu-current-board');
      const movesEl = document.getElementById('menu-moves-left');
      
      if (scoreEl) scoreEl.textContent = currentScore.toLocaleString();
      if (boardEl) boardEl.textContent = currentBoard;
      if (movesEl) movesEl.textContent = movesLeft;
    }
    
    // Function to animate number counting
    function animateNumber(element, targetValue, duration = 1000) {
      if (!element) return;
      
      const startValue = parseInt(element.textContent) || 0;
      const difference = targetValue - startValue;
      const startTime = performance.now();
      
      function updateNumber(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth animation
        const easeOutCubic = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.floor(startValue + (difference * easeOutCubic));
        
        element.textContent = currentValue;
        
        if (progress < 1) {
          requestAnimationFrame(updateNumber);
        } else {
          element.textContent = targetValue;
        }
      }

      requestAnimationFrame(updateNumber);
    }

    // Sanitize helpers for stats
    function toIntSafe(v){
      const n = parseInt(v, 10);
      return Number.isFinite(n) && n > 0 ? n : 0;
    }

    function sanitizeStats(obj){
      if (!obj || typeof obj !== 'object') obj = {};
      return {
        highScore: toIntSafe(obj.highScore),
        cubesCracked: toIntSafe(obj.cubesCracked),
        helpersUsed: toIntSafe(obj.helpersUsed),
        longestCombo: toIntSafe(obj.longestCombo),
        collectiblesUnlocked: toIntSafe(obj.collectiblesUnlocked),
        boardsCleared: toIntSafe(obj.boardsCleared),
        timePlayed: toIntSafe(obj.timePlayed),
      };
    }

    // Function to update stats data with animation
    function updateStatsData(data) {
      const { highScore, cubesCracked, helpersUsed, longestCombo, collectiblesUnlocked, boardsCleared, timePlayed } = sanitizeStats(data);
      
      const highScoreEl = document.getElementById('high-score');
      const cubesCrackedEl = document.getElementById('cubes-cracked');
      const helpersUsedEl = document.getElementById('helpers-used');
      const longestComboEl = document.getElementById('longest-combo');
      const collectiblesUnlockedEl = document.getElementById('collectibles-unlocked');
      const boardsClearedEl = document.getElementById('boards-cleared');
      const timePlayedEl = document.getElementById('time-played');
      
      if (highScoreEl && highScore !== undefined) {
        gameStats.highScore = highScore;
        animateNumber(highScoreEl, highScore);
      }
      if (cubesCrackedEl && cubesCracked !== undefined) {
        gameStats.cubesCracked = cubesCracked;
        animateNumber(cubesCrackedEl, cubesCracked);
      }
      if (helpersUsedEl && helpersUsed !== undefined) {
        gameStats.helpersUsed = helpersUsed;
        animateNumber(helpersUsedEl, helpersUsed);
      }
      if (longestComboEl && longestCombo !== undefined) {
        gameStats.longestCombo = longestCombo;
        animateNumber(longestComboEl, longestCombo);
      }
      if (collectiblesUnlockedEl && collectiblesUnlocked !== undefined) {
        gameStats.collectiblesUnlocked = collectiblesUnlocked;
        // For collectibles, we need to handle the "3/20" format
        const currentValue = collectiblesUnlockedEl.textContent;
        const [current, total] = currentValue.split('/').map(Number);
        const newValue = `${collectiblesUnlocked}/${total || 20}`;
        collectiblesUnlockedEl.textContent = newValue;
        collectiblesUnlockedEl.classList.add('animating');
        setTimeout(() => collectiblesUnlockedEl.classList.remove('animating'), 300);
      }
      if (boardsClearedEl && boardsCleared !== undefined) {
        gameStats.boardsCleared = boardsCleared;
        animateNumber(boardsClearedEl, boardsCleared);
      }
      if (timePlayedEl && timePlayed !== undefined) {
        gameStats.timePlayed = timePlayed;
        timePlayedEl.textContent = formatTime(timePlayed);
        timePlayedEl.classList.add('animating');
        setTimeout(() => timePlayedEl.classList.remove('animating'), 300);
      }
    }
    
    // Function to load stats from localStorage
    function loadStatsFromStorage() {
      try {
        const savedStats = localStorage.getItem('cubeCrash_stats');
        if (savedStats) {
          const parsed = sanitizeStats(JSON.parse(savedStats));
          gameStats = { ...gameStats, ...parsed };
        }

        // Legacy/fallback best score sources
        try {
          const legacyBestRaw = localStorage.getItem('cc_best_score_v1');
          const legacyBest = legacyBestRaw ? parseInt(legacyBestRaw, 10) : 0;
          if (Number.isFinite(legacyBest) && legacyBest > (gameStats.highScore || 0)) {
            gameStats.highScore = legacyBest;
          }
        } catch {}

        // Also consider current runtime score if available via debug API
        try {
          const s = (window.CC && typeof window.CC.state === 'function') ? window.CC.state() : null;
          const liveScore = s && Number.isFinite(s.score) ? s.score : 0;
          if (liveScore > (gameStats.highScore || 0)) {
            gameStats.highScore = liveScore;
          }
        } catch {}

        // Persist any upgrades back to our unified storage
        saveStatsToStorage();
      } catch (error) {
        console.warn('Failed to load stats from storage:', error);
      }
    }
    
    // Function to save stats to localStorage
    function saveStatsToStorage() {
      try {
        localStorage.setItem('cubeCrash_stats', JSON.stringify(sanitizeStats(gameStats)));
      } catch (error) {
        console.warn('Failed to save stats to storage:', error);
      }
    }
    
    // Function to update a specific stat
    function updateStat(statName, value) {
      if (gameStats.hasOwnProperty(statName)) {
        // Coerce to non-negative integer
        const v = toIntSafe(value);
        gameStats[statName] = v;
        saveStatsToStorage();
        
        // Update UI if stats screen is visible
        if (statsScreen && !statsScreen.hidden) {
          updateStatsData(gameStats);
        }
      }
    }

    // Hard reset utility for testing
    window.hardResetStats = () => {
      try {
        localStorage.removeItem('cubeCrash_stats');
        localStorage.removeItem('cc_best_score_v1');
      } catch {}
      gameStats = sanitizeStats({});
      saveStatsToStorage();
      // If stats screen open, animate zeros
      if (statsScreen && !statsScreen.hidden) {
        try {
          ['high-score','boards-cleared','cubes-cracked','helpers-used','longest-combo','time-played'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '0';
          });
          const cu = document.getElementById('collectibles-unlocked');
          if (cu) cu.textContent = '0/20';
          const tp = document.getElementById('time-played');
          if (tp) tp.textContent = '00:00:00';
          updateStatsData(gameStats);
        } catch {}
      }
      console.log('🧹 Stats hard reset completed');
    };
    
    function goToSlide(slideIndex) {
      let clamped = Math.floor(slideIndex);
      if (!Number.isFinite(clamped)) clamped = currentSlide;
      clamped = Math.max(0, Math.min(totalSlides - 1, clamped));
      if (clamped === currentSlide) {
        updateSlider();
        return;
      }
      // Clean any inline transforms/opacities to keep CTA level identical on all slides
      try {
        document.querySelectorAll('.slider-slide .slide-content, .slider-slide .slide-text, .slider-slide .slide-button').forEach(el => {
          el.style.transition = '';
          el.style.transform = '';
          el.style.opacity = '';
        });
      } catch {}
      currentSlide = clamped;
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
      
      // Don't interfere with stats screen scrolling
      if (statsScreen && !statsScreen.hidden) return;
      
      startX = e.touches ? e.touches[0].clientX : e.clientX;
      isDragging = true;
      touchStartTime = Date.now();
      hasMoved = false;
      // capture current parallax offset as base for independent movement
      if (PARALLAX_ENABLED) {
        parallaxDragStartX = currentParallaxX || 0;
        parallaxCurrentX = currentParallaxX || 0;
        parallaxTargetX = parallaxDragStartX;
        ensureParallaxLoop(sliderParallaxImage);
      }
      
      if (sliderWrapper) {
        sliderWrapper.style.transition = 'none';
        if (sliderParallaxImage) sliderParallaxImage.style.transition = 'none';
      }
      driftBackground(true);
      
      console.log('🎯 Slider drag start');
    }
    
    function handleMove(e) {
      if (sliderLocked || !isDragging) return;
      
      // Don't interfere with stats screen scrolling
      if (statsScreen && !statsScreen.hidden) return;
      
      e.preventDefault();
      currentX = e.touches ? e.touches[0].clientX : e.clientX;
      const diff = currentX - startX;
      const baseTranslateX = -currentSlide * window.innerWidth;
      
      // Mark as moved if there's significant movement
      if (Math.abs(diff) > 5) { // Reduced from 10px to 5px for more sensitive detection
        hasMoved = true;
      }
      
      if (sliderWrapper) {
        // Follow finger; limit when dragging toward non-existent neighbor (edges)
        const isOOB = (currentSlide === 0 && diff > 0) || (currentSlide === totalSlides - 1 && diff < 0);
        const resistance = isOOB ? OUT_OF_BOUNDS_RESISTANCE : DRAG_RESISTANCE;
        let dampedDiff = diff * resistance;
        if (isOOB) {
          const maxOffset = window.innerWidth * MAX_OOB_OFFSET_RATIO;
          if (dampedDiff > 0) dampedDiff = Math.min(dampedDiff, maxOffset);
          else dampedDiff = Math.max(dampedDiff, -maxOffset);
        }
        sliderWrapper.style.transform = `translateX(${baseTranslateX + dampedDiff}px)`;
        if (PARALLAX_ENABLED && sliderParallaxImage) {
          const parallaxX = __clampParallax((baseTranslateX + dampedDiff) * PARALLAX_DRAG_FACTOR);
          parallaxTargetX = parallaxX;
          parallaxCurrentX = parallaxX;
          applyParallaxTransform(sliderParallaxImage, parallaxX);
        }
      }
    }
    
    function handleEnd() {
      if (sliderLocked || !isDragging) return;
      
      // Don't interfere with stats screen scrolling
      if (statsScreen && !statsScreen.hidden) return;
      
      isDragging = false;
      driftBackground(false);
      
      const diff = currentX - startX;
      const threshold = window.innerWidth * 0.13; // a bit easier to advance
      const touchDuration = Date.now() - touchStartTime;
      
      // Calculate swipe speed for more sensitive detection
      const swipeSpeed = Math.abs(diff) / Math.max(touchDuration, 1); // px/ms
      const speedThreshold = 0.45; // slightly easier flick
      const dynamicThreshold = swipeSpeed > speedThreshold ? threshold * 0.45 : threshold;
      
      console.log(`🎯 Slider drag end: diff=${diff}, threshold=${threshold}, dynamicThreshold=${dynamicThreshold}, hasMoved=${hasMoved}, duration=${touchDuration}ms, speed=${swipeSpeed.toFixed(2)}px/ms`);
      
      // Decide target slide first
      let targetSlide = currentSlide;
      if (hasMoved && Math.abs(diff) > dynamicThreshold) {
        if (diff > 0 && currentSlide > 0) targetSlide = currentSlide - 1;
        else if (diff < 0 && currentSlide < totalSlides - 1) targetSlide = currentSlide + 1;
      }

      // Compute distance left to travel from current dragged position to target
      const isOOB = (currentSlide === 0 && diff > 0) || (currentSlide === totalSlides - 1 && diff < 0);
      const resistance = isOOB ? OUT_OF_BOUNDS_RESISTANCE : DRAG_RESISTANCE; // keep in sync with handleMove
      const baseTranslateX = -currentSlide * window.innerWidth;
      let draggedTranslateX = baseTranslateX + (diff * resistance);
      if (isOOB) {
        const maxOffset = window.innerWidth * MAX_OOB_OFFSET_RATIO;
        const minX = baseTranslateX - maxOffset;
        const maxX = baseTranslateX + maxOffset;
        if (draggedTranslateX > maxX) draggedTranslateX = maxX;
        if (draggedTranslateX < minX) draggedTranslateX = minX;
      }
      const targetTranslateX = -targetSlide * window.innerWidth;
      const remainingDistPx = Math.abs(draggedTranslateX - targetTranslateX);
      const distRatio = Math.min(1, remainingDistPx / window.innerWidth);

      // Map speed and distance to a heavier, friction-like ease
      const normSpeed = Math.min(1, swipeSpeed / 1.2); // 0..~1
      const baseMs = 260;          // minimum duration
      const addFromDist = 320 * distRatio; // more distance => longer, emphasise glide
      const addFromSpeed = 120 * normSpeed; // faster swipe => a bit longer to feel weight
      const durationMs = Math.max(260, Math.min(720, Math.round(baseMs + addFromDist + addFromSpeed)));
      const ease = 'cubic-bezier(0.45, 0.05, 0.2, 0.95)'; // gentle ease-in-out
      currentSlideTransition = `transform ${durationMs}ms ${ease}`;

      // Apply navigation
      if (targetSlide !== currentSlide) {
        console.log(`🎯 Moving to slide ${targetSlide} with duration ${durationMs}ms`);
        // Do NOT adjust parallax; keep exactly where drag left it
        goToSlide(targetSlide);
      } else {
        console.log(`🎯 Staying on slide ${currentSlide} with duration ${durationMs}ms`);
        updateSlider({ touchParallax: false });
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
    
    // Dot navigation with springy hover effects (avoid fighting active tweens)
    dots.forEach((dot, index) => {
      // Add hover effects
      dot.addEventListener('mouseenter', () => {
        if (!sliderLocked) {
          if (!gsap.isTweening(dot)) {
            gsap.to(dot, { scale: 1.1, duration: 0.2, ease: 'power2.out' });
          }
        }
      });
      
      dot.addEventListener('mouseleave', () => {
        if (!sliderLocked && index !== currentSlide) {
          if (!gsap.isTweening(dot)) {
            gsap.to(dot, { scale: 1, duration: 0.2, ease: 'power2.out' });
          }
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
            startTimeTracking(); // Start tracking play time
            checkForSavedGame();
          }, 650); // Wait for elastic spring bounce animation to complete
        } else {
          // Fallback if elements not found - start game immediately
          console.log('⚠️ Slide elements not found, starting game without animation');
          home.style.display = 'none';
          appHost.style.display = 'block';
          appHost.removeAttribute('hidden');
          startTimeTracking(); // Start tracking play time
          checkForSavedGame();
        }
      };

      // Track button press and drag behavior
      let isButtonPressed = false;
      let hasMovedOutside = false;
      let buttonRect = null;

      const handleButtonStart = (e) => {
        isButtonPressed = true;
        hasMovedOutside = false;
        buttonRect = playButton.getBoundingClientRect();
        e.stopPropagation();
      };

      const handleButtonMove = (e) => {
        if (!isButtonPressed) return;
        
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        // Check if pointer moved outside button area
        if (buttonRect && (clientX < buttonRect.left || clientX > buttonRect.right || 
            clientY < buttonRect.top || clientY > buttonRect.bottom)) {
          hasMovedOutside = true;
          // Reset button to original state
          playButton.style.transition = 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
          playButton.style.transform = 'scale(1) translateY(0)';
        }
      };

      const handleButtonEnd = (e) => {
        if (isButtonPressed && !hasMovedOutside) {
          startGameNow(e);
        }
        isButtonPressed = false;
        hasMovedOutside = false;
        buttonRect = null;
        e.stopPropagation();
      };

      // Mouse events
      playButton.addEventListener('mousedown', handleButtonStart);
      playButton.addEventListener('mousemove', handleButtonMove);
      playButton.addEventListener('mouseup', handleButtonEnd);
      playButton.addEventListener('mouseleave', handleButtonEnd);
      
      // Touch events
      playButton.addEventListener('touchstart', handleButtonStart, { passive: true });
      playButton.addEventListener('touchmove', handleButtonMove, { passive: true });
      playButton.addEventListener('touchend', handleButtonEnd, { passive: true });
      
      // Fallback click event (for accessibility)
      playButton.addEventListener('click', (e) => {
        if (!hasMovedOutside) {
          startGameNow(e);
        }
      });
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
        showStatsScreen();
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
    
    if (settingsButton) {
      // Add hover effects for settings button
      settingsButton.addEventListener('mouseenter', () => {
        if (!sliderLocked) {
          settingsButton.style.transition = 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
          settingsButton.style.transform = 'scale(1.05) translateY(-2px)';
        }
      });
      
      settingsButton.addEventListener('mouseleave', () => {
        if (!sliderLocked) {
          settingsButton.style.transition = 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
          settingsButton.style.transform = 'scale(1) translateY(0)';
        }
      });
      
      settingsButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent slider from moving
        console.log('⚙️ Settings clicked');
        goToSlide(3);
      });
    }
    
    if (statsBackButton) {
      // Add hover effects for stats back button
      statsBackButton.addEventListener('mouseenter', () => {
        statsBackButton.style.transition = 'all 0.2s ease';
        statsBackButton.style.transform = 'scale(1.05)';
      });
      
      statsBackButton.addEventListener('mouseleave', () => {
        statsBackButton.style.transition = 'all 0.2s ease';
        statsBackButton.style.transform = 'scale(1)';
      });
      
      statsBackButton.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('🔙 Stats back clicked');
        hideStatsScreen();
      });
    }

    if (statsResetButton) {
      // Simple hover affordance
      statsResetButton.addEventListener('mouseenter', () => {
        statsResetButton.style.transition = 'all 0.2s ease';
        statsResetButton.style.transform = 'translateY(1px)';
      });
      statsResetButton.addEventListener('mouseleave', () => {
        statsResetButton.style.transition = 'all 0.2s ease';
        statsResetButton.style.transform = 'translateY(0)';
      });
      // Reset stats on click
      statsResetButton.addEventListener('click', (e) => {
        e.stopPropagation();
        try { window.hardResetStats?.(); } catch {}
      });
    }
    
    // Menu screen button handlers
    if (menuBackBtn) {
      menuBackBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('📋 Menu back clicked');
        hideMenuScreen();
        if (uiState.gameActive) {
          try {
            if (window.CC && typeof window.CC.resumeGame === 'function') {
              window.CC.resumeGame();
            }
          } catch (error) {
            console.warn('Failed to resume game:', error);
          }
        }
      });
    }
    
    if (menuUnpauseAction) {
      menuUnpauseAction.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('📋 Menu unpause action clicked');
        hideMenuScreen();
        // Resume game logic here
        try {
          if (window.CC && typeof window.CC.resumeGame === 'function') {
            window.CC.resumeGame();
          } else if (window.CC && typeof window.CC.resume === 'function') {
            window.CC.resume();
          }
        } catch (error) {
          console.warn('Failed to resume game:', error);
        }
        markGameActive(true);
      });
    }
    
    if (menuRestartAction) {
      menuRestartAction.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('📋 Menu restart action clicked');
        hideMenuScreen();
        // Restart game logic here
        try {
          // Persist live high score before restarting
          try {
            const s = (window.CC && typeof window.CC.state === 'function') ? window.CC.state() : null;
            const liveScore = s && Number.isFinite(s.score) ? s.score : 0;
            if (typeof window.updateHighScore === 'function') {
              window.updateHighScore(liveScore);
            }
          } catch {}

          if (window.CC && typeof window.CC.restart === 'function') {
            window.CC.restart();
          }
        } catch (error) {
          console.warn('Failed to restart game:', error);
        }
      });
    }
    
    
    if (menuExitBtn) {
      menuExitBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('📋 Menu exit clicked');
        hideMenuScreen();
        // Exit to menu logic here
        try {
          window.exitToMenu?.();
        } catch (error) {
          console.warn('Failed to exit to menu:', error);
        }
      });
    }

    if (menuTestFailBtn) {
      menuTestFailBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('🧪 Menu test clean board clicked');
        hideMenuScreen();
        try {
          if (window.CC && typeof window.CC.showCleanBoardOverlay === 'function') {
            window.CC.showCleanBoardOverlay();
          } else if (window.CC && typeof window.CC.testCleanBoard === 'function') {
            window.CC.testCleanBoard();
          } else {
            console.warn('Clean board test helper not available');
          }
        } catch (error) {
          console.warn('Failed to trigger clean board test:', error);
        }
      });
    }
    
    // Initialize
    console.log('🎯 Initializing slider...');
    console.log('🎯 Total slides:', totalSlides);
    console.log('🎯 Current slide:', currentSlide);
    
    // Load stats from storage
    loadStatsFromStorage();
    
    // If query param resetStats=1 is present, reset immediately for clean testing
    try {
      const qp = new URLSearchParams(window.location.search);
      const rs = qp.get('resetStats');
      if (rs && /^(1|true|yes)$/i.test(rs)) {
        window.hardResetStats();
      }
    } catch {}
    
    updateSlider();
    recordCurrentSlide(currentSlide);

    if (stateLoaded && uiState.gameActive) {
      console.log('🔄 Resuming game from saved state...');
      sliderLocked = true;
      hideDots();
      home.style.display = 'none';
      home.setAttribute('hidden', 'true');
      appHost.style.display = 'block';
      appHost.removeAttribute('hidden');
      markGameActive(true);
      if (!uiState.menuVisible) {
        setMenuVisible(false);
      }
      autoBootedFromState = true;
      checkForSavedGame();
      if (uiState.menuVisible) {
        setTimeout(() => {
          try { showMenuScreen(); } catch (error) {
            console.warn('⚠️ Failed to show menu after auto resume:', error);
          }
        }, 400);
      }
    } else {
      // Ensure dots visible on initial load as well
      requestAnimationFrame(() => { ensureDotsVisible(); });
    }
    console.log('✅ Slider initialized');
    
    // Global functions for game
    window.startGame = () => {
      if (uiState.gameActive && autoBootedFromState) {
        console.log('🎮 Game already active from saved state, ignoring manual start.');
        return;
      }
      console.log('🎮 Starting game...');
      
      // Lock slider and start game (programmatic)
      sliderLocked = true;
      isDragging = false;
      hideDots();

      // Simple start - no slider manipulation
      home.style.display = 'none';
      appHost.style.display = 'block';
      appHost.removeAttribute('hidden');
      markGameActive(true);
      setMenuVisible(false);
      checkForSavedGame();
      autoBootedFromState = false;

      // Dev button moved to Pause modal (tap HUD)
    };
    
    window.showStats = () => goToSlide(1);
    window.showCollectibles = () => goToSlide(2);
    window.showMenuScreen = showMenuScreen;
    window.hideMenuScreen = hideMenuScreen;
    
    // Global functions for stats
    window.updateGameStats = (statName, value) => {
      updateStat(statName, value);
    };
    
    window.getGameStats = () => {
      return { ...gameStats };
    };
    
    window.incrementStat = (statName, increment = 1) => {
      if (gameStats.hasOwnProperty(statName)) {
        const newValue = gameStats[statName] + increment;
        updateStat(statName, newValue);
      }
    };
    
    // Function to update high score if current score is higher
    window.updateHighScore = (currentScore) => {
      if (currentScore > gameStats.highScore) {
        updateStat('highScore', currentScore);
        console.log('🏆 New high score!', currentScore);
      }
    };
    
    // Function to track cubes cracked (when tiles are merged)
    window.trackCubesCracked = (count = 1) => {
      incrementStat('cubesCracked', count);
    };
    
    // Function to track helpers used (powerups, etc.)
    window.trackHelpersUsed = (count = 1) => {
      incrementStat('helpersUsed', count);
    };
    
    // Function to track boards cleared
    window.trackBoardsCleared = (count = 1) => {
      incrementStat('boardsCleared', count);
    };
    
    // Function to track longest combo
    window.trackLongestCombo = (comboLength) => {
      if (comboLength > gameStats.longestCombo) {
        updateStat('longestCombo', comboLength);
        console.log('🔥 New longest combo!', comboLength);
      }
    };
    
    // Function to track collectibles unlocked
    window.trackCollectiblesUnlocked = (unlockedCount) => {
      updateStat('collectiblesUnlocked', unlockedCount);
    };
    
    // Function to simulate collectibles based on score milestones
    window.checkCollectiblesMilestones = (score) => {
      const milestones = [100, 500, 1000, 2000, 5000, 10000, 20000, 50000];
      let unlocked = 0;
      
      for (const milestone of milestones) {
        if (score >= milestone) {
          unlocked++;
        }
      }
      
      if (unlocked > gameStats.collectiblesUnlocked) {
        updateStat('collectiblesUnlocked', unlocked);
        console.log('🎁 New collectible unlocked! Total:', unlocked);
      }
    };
    
    // Function to reset all stats
    window.resetAllStats = () => {
      gameStats = {
        highScore: 0,
        cubesCracked: 0,
        helpersUsed: 0,
        longestCombo: 0,
        collectiblesUnlocked: 0,
        boardsCleared: 0,
        timePlayed: 0
      };
      saveStatsToStorage();
      console.log('🔄 All stats reset');
    };

    
    // SIMPLE EXIT FUNCTION - CLEAN RESET WITHOUT INLINE OVERRIDES
    window.exitToMenu = async () => {
      console.log('🏠 Exiting to menu...');
      
      markGameActive(false);
      recordCurrentSlide(0);
      autoBootedFromState = false;

      // Stop time tracking
      stopTimeTracking();
      
      try {
        // Persist live high score before tearing down the game
        try {
          const s = (window.CC && typeof window.CC.state === 'function') ? window.CC.state() : null;
          const liveScore = s && Number.isFinite(s.score) ? s.score : 0;
          if (typeof window.updateHighScore === 'function') {
            window.updateHighScore(liveScore);
          }
        } catch {}

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
            // Kill only game-related animations, not slider animations
            window.gsap.killTweensOf("[data-wild-loader]");
            window.gsap.killTweensOf(".wild-loader");
            window.gsap.killTweensOf("p");
            window.gsap.killTweensOf("progress");
            window.gsap.killTweensOf("ratio");
          }
        }
        
        // CLEAR APP CONTAINER
        appHost.innerHTML = '';
        appHost.style.display = 'none';
        appHost.setAttribute('hidden', 'true');
        // Dev button moved to Pause modal — nothing to remove here
        
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
    
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        uiState.lastActiveAt = Date.now();
        if (uiState.gameActive) {
          setMenuVisible(true, { fromBackground: true });
          try { showMenuScreen(); } catch (error) { console.warn('⚠️ Failed to show menu during background pause:', error); }
        }
        saveUIState();
        return;
      }

      if (uiState.gameActive) {
        if (uiState.menuVisible) {
          requestAnimationFrame(() => {
            try { showMenuScreen(); } catch (error) { console.warn('⚠️ Failed to re-open menu after visibility change:', error); }
          });
        } else {
          markGameActive(true);
          requestAnimationFrame(() => {
            try { if (window.CC && typeof window.CC.resumeGame === 'function') window.CC.resumeGame(); } catch (error) {
              console.warn('⚠️ resumeGame failed after visibility change:', error);
            }
            try { appLayout(); } catch (error) {
              console.warn('⚠️ appLayout failed after visibility change:', error);
            }
          });
        }
      } else {
        requestAnimationFrame(() => {
          updateSlider();
          ensureDotsVisible();
        });
      }
    });

    window.addEventListener('orientationchange', () => {
      console.log('🔄 Orientation changed - fixing layout...');

      const applyHomeLayout = () => {
        requestAnimationFrame(() => {
          updateSlider();
          ensureDotsVisible();
          setTimeout(() => {
            updateSlider();
            ensureDotsVisible();
          }, 150);
        });
      };

      const applyGameLayout = () => {
        requestAnimationFrame(() => {
          if (uiState.menuVisible) {
            try { showMenuScreen(); } catch (error) {
              console.warn('⚠️ Failed to re-open menu after orientation change:', error);
            }
          } else {
            try { if (window.CC && typeof window.CC.resumeGame === 'function') window.CC.resumeGame(); } catch (error) {
              console.warn('⚠️ resumeGame failed after orientation change:', error);
            }
            try { appLayout(); } catch (error) {
              console.warn('⚠️ appLayout failed after orientation change:', error);
            }
            setTimeout(() => {
              try { appLayout(); } catch (error) {
                console.warn('⚠️ appLayout retry failed:', error);
              }
            }, 220);
          }
        });
      };

      const waitForPortrait = (attempt = 0) => {
        const isPortrait = window.matchMedia('(orientation: portrait)').matches;
        const tallEnough = window.innerHeight >= window.innerWidth;
        if ((!isPortrait || !tallEnough) && attempt < 15) {
          setTimeout(() => waitForPortrait(attempt + 1), 80);
          return;
        }

        window.dispatchEvent(new Event('resize'));

        if (home && !home.hidden) {
          applyHomeLayout();
        } else {
          applyGameLayout();
        }
        console.log('✅ Layout reset completed');
      };

      setTimeout(() => waitForPortrait(), 80);
    });

    console.log('✅ Simple slider initialized successfully');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
})();
