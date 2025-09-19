// SIMPLE MAIN.JS - NO COMPLEXITY
import { boot } from './modules/app.js';
import { gsap } from 'gsap';

console.log('🚀 Starting simple CubeCrash...');

let slider;
let sliderLocked = false; // Guard to prevent slider moves during Play
let currentSlideTransition = null; // per-swipe transition (duration/ease)
const DRAG_RESISTANCE = 0.8; // how much slider follows finger (0..1)
const OUT_OF_BOUNDS_RESISTANCE = 0.15; // follow when dragging beyond edges
const MAX_OOB_OFFSET_RATIO = 0.15; // clamp max visual offset at edges to 15% width

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
    const settingsButton = document.getElementById('btn-settings');
    const statsScreen = document.getElementById('stats-screen');
    const statsBackButton = document.getElementById('stats-back-btn');
    const statsResetButton = document.getElementById('stats-reset-btn');
    
    let currentSlide = 0;
    const totalSlides = slides.length;
    
    // Game statistics tracking
    let gameStats = {
      highScore: 0,
      cubesCracked: 0,
      helpersUsed: 0,
      longestCombo: 0,
      collectiblesUnlocked: 0,
      boardsCleared: 0
    };
    
    // Simple slider functions with adjustable settle animation
    function updateSlider() {
      if (sliderWrapper) {
        const translateX = -currentSlide * window.innerWidth;
        // Use per-swipe transition if provided, else default fast ease-out
        sliderWrapper.style.transition = currentSlideTransition || 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)';
        sliderWrapper.style.transform = `translateX(${translateX}px)`;
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
    
    function showStatsScreen() {
      if (sliderLocked) return;
      console.log('📊 Showing stats screen');
      
      // Lock slider immediately
      sliderLocked = true;
      isDragging = false;
      hideDots();
      
      // Show stats screen immediately for instant scroll access
      if (home) home.hidden = true;
      if (statsScreen) {
        // Load stats, then prime counters to 0 so they animate every entry
        loadStatsFromStorage();

        try {
          const ids = ['high-score','boards-cleared','cubes-cracked','helpers-used','longest-combo'];
          ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
              el.classList.remove('animating');
              el.textContent = '0';
            }
          });
        } catch {}

        // Animate numbers up to current values
        updateStatsData(gameStats);
        
        statsScreen.hidden = false;
        // Animate stats screen in
        statsScreen.style.opacity = '0';
        statsScreen.style.transform = 'scale(0.8) translateY(20px)';
        statsScreen.style.transition = 'opacity 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55), transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
        
        setTimeout(() => {
          statsScreen.style.opacity = '1';
          statsScreen.style.transform = 'scale(1) translateY(0)';
        }, 50);
      }
      
      // Get slide 2 elements for animation (stats slide) - run in background
      const slide2 = document.querySelector('.slider-slide[data-slide="1"]');
      const slide2Content = slide2?.querySelector('.slide-content');
      const slide2Text = slide2?.querySelector('.slide-text');
      const slide2Button = slide2?.querySelector('.slide-button');
      const slide2Hero = slide2?.querySelector('.hero-container');
      const homeLogo = document.getElementById('home-logo');
      
      if (slide2 && slide2Content && slide2Text && slide2Button && slide2Hero) {
        // Add elastic spring bounce pop out animation - 0.65 seconds
        slide2Content.style.transition = 'opacity 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
        slide2Text.style.transition = 'opacity 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
        slide2Button.style.transition = 'opacity 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
        slide2Hero.style.transition = 'opacity 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
        
        // Add logo animation if it exists
        if (homeLogo) {
          homeLogo.style.transition = 'opacity 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
        }
        
        // Apply gentle elastic pop out with bounce sequence
        slide2Content.style.opacity = '0';
        slide2Content.style.transform = 'scale(0) translateY(-20px)';
        slide2Text.style.opacity = '0';
        slide2Text.style.transform = 'scale(0) translateY(-15px)';
        slide2Button.style.opacity = '0';
        slide2Button.style.transform = 'scale(0) translateY(-10px)';
        slide2Hero.style.opacity = '0';
        slide2Hero.style.transform = 'scale(0) translateY(-25px)';
        
        // Apply logo animation
        if (homeLogo) {
          homeLogo.style.opacity = '0';
          homeLogo.style.transform = 'scale(0) translateY(-30px)';
        }
      }
      
      console.log('📊 Stats screen ready for immediate interaction');
    }
    
    function hideStatsScreen() {
      console.log('📊 Hiding stats screen (no out animation)');
      
      if (!statsScreen) return;
      // Instantly hide overlay
      statsScreen.style.transition = 'none';
      statsScreen.style.opacity = '0';
      statsScreen.style.transform = 'none';
      statsScreen.hidden = true;
      if (home) home.hidden = false;

      // Unlock slider and show dots
      sliderLocked = false;
      ensureDotsVisible();

      // Navigate to Stats slide (index 1) and pop it in like slide 1
      try { goToSlide(1); } catch {}

      // Bring back the home logo with the same pop-in spring
      const homeLogo = document.getElementById('home-logo');
      if (homeLogo) {
        homeLogo.style.transition = 'none';
        homeLogo.style.opacity = '0';
        homeLogo.style.transform = 'scale(0) translateY(-30px)';
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

      const slide2 = document.querySelector('.slider-slide[data-slide="1"]');
      const slide2Content = slide2?.querySelector('.slide-content');
      const slide2Text = slide2?.querySelector('.slide-text');
      const slide2Button = slide2?.querySelector('.slide-button');
      const slide2Hero = slide2?.querySelector('.hero-container');

      if (slide2 && slide2Content && slide2Text && slide2Button && slide2Hero) {
        // Start hidden
        slide2Content.style.transition = 'none';
        slide2Text.style.transition = 'none';
        slide2Button.style.transition = 'none';
        slide2Hero.style.transition = 'none';
        slide2Content.style.opacity = '0';
        slide2Text.style.opacity = '0';
        slide2Button.style.opacity = '0';
        slide2Hero.style.opacity = '0';
        slide2Content.style.transform = 'scale(0) translateY(-20px)';
        slide2Text.style.transform = 'scale(0) translateY(-15px)';
        slide2Button.style.transform = 'scale(0) translateY(-10px)';
        slide2Hero.style.transform = 'scale(0) translateY(-25px)';

        // Animate in with same elastic spring as slide 1
        setTimeout(() => {
          const spring = 'cubic-bezier(0.68, -0.8, 0.265, 1.8)';
          const trans = `opacity 0.65s ${spring}, transform 0.65s ${spring}`;
          slide2Content.style.transition = trans;
          slide2Text.style.transition = trans;
          slide2Button.style.transition = trans;
          slide2Hero.style.transition = trans;

          slide2Content.style.opacity = '1';
          slide2Content.style.transform = 'scale(1) translateY(0)';
          slide2Text.style.opacity = '1';
          slide2Text.style.transform = 'scale(1) translateY(-8px)';
          slide2Button.style.opacity = '1';
          slide2Button.style.transform = 'scale(1) translateY(0)';
          slide2Hero.style.opacity = '1';
          slide2Hero.style.transform = 'scale(1) translateY(0)';

          // Cleanup transitions after finish
          setTimeout(() => {
            slide2Content.style.transition = 'none';
            slide2Text.style.transition = 'none';
            slide2Button.style.transition = 'none';
            slide2Hero.style.transition = 'none';
          }, 700);
        }, 20);
      }
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
          // Add pulse animation
          element.classList.add('animating');
          setTimeout(() => element.classList.remove('animating'), 300);
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
      };
    }

    // Function to update stats data with animation
    function updateStatsData(data) {
      const { highScore, cubesCracked, helpersUsed, longestCombo, collectiblesUnlocked, boardsCleared } = sanitizeStats(data);
      
      const highScoreEl = document.getElementById('high-score');
      const cubesCrackedEl = document.getElementById('cubes-cracked');
      const helpersUsedEl = document.getElementById('helpers-used');
      const longestComboEl = document.getElementById('longest-combo');
      const collectiblesUnlockedEl = document.getElementById('collectibles-unlocked');
      const boardsClearedEl = document.getElementById('boards-cleared');
      
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
          ['high-score','boards-cleared','cubes-cracked','helpers-used','longest-combo'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '0';
          });
          const cu = document.getElementById('collectibles-unlocked');
          if (cu) cu.textContent = '0/20';
          updateStatsData(gameStats);
        } catch {}
      }
      console.log('🧹 Stats hard reset completed');
    };
    
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
      
      // Don't interfere with stats screen scrolling
      if (statsScreen && !statsScreen.hidden) return;
      
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
      }
    }
    
    function handleEnd() {
      if (sliderLocked || !isDragging) return;
      
      // Don't interfere with stats screen scrolling
      if (statsScreen && !statsScreen.hidden) return;
      
      isDragging = false;
      
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
      const baseMs = 220;          // minimum duration
      const addFromDist = 220 * distRatio; // more distance => longer
      const addFromSpeed = 140 * normSpeed; // faster swipe => slightly longer to feel weight
      const durationMs = Math.max(200, Math.min(640, Math.round(baseMs + addFromDist + addFromSpeed)));
      const ease = 'cubic-bezier(0.23, 1, 0.32, 1)'; // strong ease-out, no bounce
      currentSlideTransition = `transform ${durationMs}ms ${ease}`;

      // Apply navigation
      if (targetSlide !== currentSlide) {
        console.log(`🎯 Moving to slide ${targetSlide} with duration ${durationMs}ms`);
        goToSlide(targetSlide);
      } else {
        console.log(`🎯 Staying on slide ${currentSlide} with duration ${durationMs}ms`);
        updateSlider();
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

      // Dev button moved to Pause modal (tap HUD)
    };
    
    window.showStats = () => goToSlide(1);
    window.showCollectibles = () => goToSlide(2);
    
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
        boardsCleared: 0
      };
      saveStatsToStorage();
      console.log('🔄 All stats reset');
    };

    
    // SIMPLE EXIT FUNCTION - CLEAN RESET WITHOUT INLINE OVERRIDES
    window.exitToMenu = async () => {
      console.log('🏠 Exiting to menu...');
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
            window.gsap.killTweensOf("*");
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
    
    console.log('✅ Simple slider initialized successfully');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
})();
