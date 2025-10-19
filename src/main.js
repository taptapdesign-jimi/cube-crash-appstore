// SIMPLE MAIN.JS - NO COMPLEXITY
import { boot, layout as appLayout } from './modules/app.js';
import { gsap } from 'gsap';
import { assetPreloader } from './modules/asset-preloader.js';
import './ios-image-helper.js';
import './3d-effects.js';
import './collectibles-manager.js';
import './collectibles-test.js';

console.log('🚀 Starting simple CubeCrash...');

// Loading screen elements
let loadingScreen = null;
let loadingFill = null;
let loadingPercentage = null;

// Global DOM elements
let home = null;
let appHost = null;

const SPRING_EASE = 'cubic-bezier(0.68, -0.8, 0.265, 1.8)';
const SPRING_DURATION_MS = 650;
const SPRING_EXIT_DURATION_MS = 450;
const MINIMUM_PRELOADER_TIME_MS = 3000;

let preloadStartTime = 0;
let loaderStartTime = 0;
let loaderDisplayProgress = 0;
let loaderActualProgress = 0;
let loaderAssetsComplete = false;
let loaderTickerActive = false;
let loaderTickerId = null;
let loaderVisualReadyResolve = null;
let loaderLastTimeProgress = 0;
let loaderMinimumTimeReached = false;
let loaderPendingRealProgress = 0;
const loaderVisualReadyPromise = new Promise((resolve) => {
  loaderVisualReadyResolve = resolve;
});
let loaderFakeTimeline = null;

function fadeOutGradientBackground() {
  try {
    document.body.classList.add('gradient-fade-out');
  } catch {}
}

function restoreGradientBackground() {
  try {
    document.body.classList.remove('gradient-fade-out');
  } catch {}
}

function setLoaderPercentageValue(value) {
  if (!loadingPercentage) return;
  const formatted = Math.max(0, Math.min(100, Math.round(value)));
  loadingPercentage.textContent = `${formatted}`;
}

function updateLoaderTextFromProgress(progress) {
  const clamped = Math.max(0, Math.min(progress, 0.999));
  const displayValue = Math.min(99, Math.floor(clamped * 100));
  setLoaderPercentageValue(displayValue);
}

function loaderTick() {
  if (!loaderTickerActive) return;
  const now = performance.now();
  const elapsed = now - loaderStartTime;
  loaderMinimumTimeReached = elapsed >= Math.max(500, MINIMUM_PRELOADER_TIME_MS - 320);
  let timeProgress = 0;

  if (loaderFakeTimeline && loaderFakeTimeline.length > 1) {
    const finalEntry = loaderFakeTimeline[loaderFakeTimeline.length - 1];
    const totalTime = finalEntry.time;
    const clampedTime = Math.min(elapsed, totalTime);

    let targetValue = finalEntry.value;
    for (let i = 1; i < loaderFakeTimeline.length; i++) {
      const prev = loaderFakeTimeline[i - 1];
      const current = loaderFakeTimeline[i];
      if (clampedTime <= current.time) {
        const span = Math.max(16, current.time - prev.time);
        const localT = Math.max(0, Math.min(1, (clampedTime - prev.time) / span));
        targetValue = prev.value + (current.value - prev.value) * localT;
        break;
      }
    }
    timeProgress = Math.min(0.99, targetValue / 100);
  } else if (MINIMUM_PRELOADER_TIME_MS > 0) {
    timeProgress = Math.min(0.99, elapsed / MINIMUM_PRELOADER_TIME_MS);
  } else {
    timeProgress = 0.99;
  }

  loaderLastTimeProgress = timeProgress;

  if (loaderMinimumTimeReached && loaderPendingRealProgress > loaderActualProgress) {
    const easedReal = Math.min(0.95, loaderPendingRealProgress * 0.9);
    loaderActualProgress = Math.max(loaderActualProgress, easedReal);
  }

  const target = Math.min(0.99, Math.max(loaderActualProgress, timeProgress));

  if (target > loaderDisplayProgress) {
    const delta = target - loaderDisplayProgress;
    const step = Math.min(0.028, Math.max(delta * 0.085, 0.0015));
    loaderDisplayProgress = Math.min(target, loaderDisplayProgress + step);
    updateLoaderTextFromProgress(loaderDisplayProgress);
  }

  loaderTickerId = requestAnimationFrame(loaderTick);
}

function startLoaderTicker() {
  if (loaderTickerActive) return;
  loaderTickerActive = true;
  loaderTickerId = requestAnimationFrame(loaderTick);
}

function stopLoaderTicker() {
  loaderTickerActive = false;
  if (loaderTickerId !== null) {
    cancelAnimationFrame(loaderTickerId);
    loaderTickerId = null;
  }
}

function initializeLoaderProgressTracking() {
  loaderStartTime = performance.now();
  preloadStartTime = loaderStartTime;
  loaderDisplayProgress = 0;
  loaderActualProgress = 0;
  loaderAssetsComplete = false;
  loaderFakeTimeline = buildFakeTimeline();
  loaderLastTimeProgress = 0;
  loaderMinimumTimeReached = false;
  loaderPendingRealProgress = 0;
  stopLoaderTicker();
  setLoaderPercentageValue(0);
  startLoaderTicker();
  restoreGradientBackground();
  if (loaderVisualReadyResolve) {
    loaderVisualReadyResolve();
    loaderVisualReadyResolve = null;
  }
}

function completeLoaderProgressInstant() {
  loaderAssetsComplete = true;
  loaderActualProgress = 1;
  loaderDisplayProgress = 1;
  stopLoaderTicker();
  setLoaderPercentageValue(100);
}

function buildFakeTimeline() {
  const total = Math.max(1000, MINIMUM_PRELOADER_TIME_MS);
  const anchorConfigs = [
    { ratio: 0.0, min: 0, max: 0 },
    { ratio: 0.25, min: 10, max: 22 },
    { ratio: 0.50, min: 38, max: 55 },
    { ratio: 0.75, min: 68, max: 84 },
    { ratio: 1.0, min: 98, max: 99 }
  ];

  const anchors = anchorConfigs.map((cfg, index) => {
    const jitterRatio = index === 0 || index === anchorConfigs.length - 1
      ? 0
      : (Math.random() * 0.18 - 0.09);
    const time = Math.round(
      Math.max(0, Math.min(total, total * (cfg.ratio + jitterRatio)))
    );
    const range = cfg.max - cfg.min;
    const value = index === 0
      ? 0
      : cfg.min + Math.floor(Math.random() * (range + 1));
    return { time, value };
  });

  anchors.sort((a, b) => a.time - b.time);
  anchors[0].time = 0;
  anchors[0].value = 0;
  anchors[anchors.length - 1].time = total;
  anchors[anchors.length - 1].value = 99;

  for (let i = 1; i < anchors.length; i++) {
    const prev = anchors[i - 1];
    const current = anchors[i];
    if (current.time - prev.time < 200) {
      current.time = prev.time + 200;
    }
    if (current.time > total) {
      current.time = total;
    }
    if (current.value <= prev.value) {
      current.value = Math.min(99, prev.value + 4 + Math.floor(Math.random() * 5));
    }
  }

  const timeline = [];
  for (let i = 0; i < anchors.length - 1; i++) {
    const start = anchors[i];
    const end = anchors[i + 1];
    timeline.push(start);

    const span = end.time - start.time;
    if (span > 350) {
      const midTime = Math.round(start.time + span / 2 + (Math.random() * 120 - 60));
      const midValue = Math.min(
        99,
        start.value + Math.max(3, Math.floor((end.value - start.value) * (0.45 + Math.random() * 0.25)))
      );
      if (midTime > start.time + 160 && midTime < end.time - 160 && midValue > start.value && midValue < end.value) {
        timeline.push({ time: midTime, value: midValue });
      }
    }
  }
  timeline.push(anchors[anchors.length - 1]);
  timeline.sort((a, b) => a.time - b.time);
  return timeline;
}

let loaderEnterPlayed = false;
let loaderExitPlayed = false;
let initialSlideEnterPlayed = false;

function applySpringInitial(el, { scale = 0, translateY = '-20px', opacity = '0', transform: transformOverride } = {}) {
  if (!el) return;
  try {
    el.style.transition = 'none';
    el.style.opacity = opacity;
    el.style.transformOrigin = '50% 50%';
    const transformValue = typeof transformOverride === 'string'
      ? transformOverride
      : `scale(${scale}) translateY(${translateY})`;
    el.style.transform = transformValue;
  } catch {}
}

function animateSpring(el, {
  transform = 'scale(1) translateY(0)',
  opacity = '1',
  duration = SPRING_DURATION_MS,
  delay = 0,
  ease = SPRING_EASE,
  preserveTransform = true,
  preserveOpacity = true
} = {}) {
  if (!el) return;
  setTimeout(() => {
    try {
      el.style.transition = `opacity ${duration}ms ${ease}, transform ${duration}ms ${ease}`;
      el.style.opacity = opacity;
      el.style.transform = transform;
      setTimeout(() => {
        try {
          el.style.transition = 'none';
          if (!preserveTransform) {
            el.style.removeProperty('transform');
          }
          if (!preserveOpacity) {
            el.style.removeProperty('opacity');
          }
        } catch {}
      }, duration + 80);
    } catch {}
  }, delay);
}

function runSpringEnter(entries = []) {
  const valid = entries.filter((entry) => entry?.el);
  if (!valid.length) return Promise.resolve();

  valid.forEach((entry) => {
    applySpringInitial(entry.el, entry.initial);
  });

  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      let longest = 0;
      valid.forEach((entry) => {
        const duration = entry.duration ?? SPRING_DURATION_MS;
        const delay = entry.delay ?? 0;
        longest = Math.max(longest, delay + duration);
        animateSpring(entry.el, {
          transform: entry.finalTransform ?? 'scale(1) translateY(0)',
          opacity: entry.finalOpacity ?? '1',
          duration,
          delay,
          ease: entry.ease ?? SPRING_EASE,
          preserveTransform: entry.preserveTransform ?? true,
          preserveOpacity: entry.preserveOpacity ?? true
        });
      });
      setTimeout(resolve, longest + 100);
    });
  });
}

function runSpringExit(entries = []) {
  const valid = entries.filter((entry) => entry?.el);
  if (!valid.length) return Promise.resolve();

  return new Promise((resolve) => {
    let longest = 0;
    valid.forEach((entry) => {
      const duration = entry.duration ?? SPRING_EXIT_DURATION_MS;
      const delay = entry.delay ?? 0;
      longest = Math.max(longest, delay + duration);
      setTimeout(() => {
        try {
          entry.el.style.transition = `opacity ${duration}ms ${entry.ease ?? SPRING_EASE}, transform ${duration}ms ${entry.ease ?? SPRING_EASE}`;
          entry.el.style.opacity = entry.exitOpacity ?? '0';
          entry.el.style.transform = entry.exitTransform ?? 'scale(0.75) translateY(-20px)';
          setTimeout(() => {
            try {
              entry.el.style.transition = 'none';
            } catch {}
          }, duration + 80);
        } catch {}
      }, delay);
    });

    setTimeout(resolve, longest + 120);
  });
}

async function runLoaderEnterAnimation() {
  if (loaderEnterPlayed) return;
  if (!loadingScreen) return;
  loaderEnterPlayed = true;
  const logo = loadingScreen.querySelector('.loading-logo img');
  const text = loadingScreen.querySelector('.loading-text');
  const percentage = loadingScreen.querySelector('.loading-percentage');
  const shadow = loadingScreen.querySelector('.loading-shadow');

  const entries = [
    {
      el: shadow,
      initial: { transform: 'translateX(-50%) translateY(12px) scale(0.4)', opacity: '0' },
      finalTransform: 'translateX(-50%) translateY(0) scale(1)',
      delay: 10,
      duration: 520
    },
    {
      el: logo,
      initial: { scale: 0, translateY: '-26px', opacity: '0' },
      delay: 40
    },
    {
      el: text,
      initial: { scale: 0, translateY: '-12px', opacity: '0' },
      delay: 120
    },
    {
      el: percentage,
      initial: { scale: 0, translateY: '-8px', opacity: '0' },
      delay: 180
    }
  ];

  await runSpringEnter(entries);
}

async function runLoaderExitAnimation() {
  if (loaderExitPlayed) return;
  if (!loadingScreen) return;
  loaderExitPlayed = true;
  const logo = loadingScreen.querySelector('.loading-logo img');
  const text = loadingScreen.querySelector('.loading-text');
  const percentage = loadingScreen.querySelector('.loading-percentage');
  const shadow = loadingScreen.querySelector('.loading-shadow');

  const entries = [
    {
      el: percentage,
      exitTransform: 'scale(0.75) translateY(-16px)',
      exitOpacity: '0',
      duration: 420
    },
    {
      el: text,
      delay: 50,
      exitTransform: 'scale(0.72) translateY(-18px)',
      exitOpacity: '0',
      duration: 430
    },
    {
      el: logo,
      delay: 100,
      exitTransform: 'scale(0.68) translateY(-24px)',
      exitOpacity: '0',
      duration: 430
    },
    {
      el: shadow,
      delay: 40,
      exitTransform: 'translateX(-50%) translateY(18px) scale(0.4)',
      exitOpacity: '0',
      duration: 380
    }
  ];

  await runSpringExit(entries);
}

async function animateInitialSlideEnter() {
  if (initialSlideEnterPlayed) return;
  const slide = document.querySelector('.slider-slide[data-slide="0"]');
  if (!slide) return;
  initialSlideEnterPlayed = true;
  restoreGradientBackground();

  const slideContent = slide.querySelector('.slide-content');
  const heroContainer = slide.querySelector('.hero-container');
  const heroImage = slide.querySelector('.hero-image');
  const heroShadow = slide.querySelector('.hero-shadow');
  const slideText = slide.querySelector('.slide-text');
  const slideButton = slide.querySelector('.slide-button');
  const homeLogo = document.getElementById('home-logo');

  const entries = [
    {
      el: homeLogo,
      initial: { scale: 0, translateY: '-32px', opacity: '0' },
      delay: 20
    },
    {
      el: slideContent,
      initial: { scale: 0, translateY: '-28px', opacity: '0' },
      delay: 60
    },
    {
      el: heroContainer,
      initial: { transform: 'scale(0) translateY(-30px) translateZ(0)', opacity: '0' },
      finalTransform: 'scale(1) translateY(0) translateZ(0)',
      delay: 90
    },
    {
      el: heroImage,
      initial: { transform: 'scale(0) translateY(-30px) translateZ(0)', opacity: '0' },
      finalTransform: 'scale(1) translateY(0) translateZ(0)',
      delay: 90
    },
    {
      el: heroShadow,
      initial: { transform: 'translateX(-50%) translateY(12px) scale(0.45)', opacity: '0' },
      finalTransform: 'translateX(-50%) translateY(0) scale(1)',
      delay: 110,
      preserveTransform: false,
      preserveOpacity: false
    },
    {
      el: slideText,
      initial: { scale: 0, translateY: '-20px', opacity: '0' },
      finalTransform: 'scale(1) translateY(-8px)',
      delay: 140
    },
    {
      el: slideButton,
      initial: { scale: 0, translateY: '12px', opacity: '0' },
      delay: 180
    }
  ];

  await runSpringEnter(entries);
}

async function fadeOutLoadingOverlay() {
  if (!loadingScreen) return;
  loadingScreen.classList.add('hidden');
  await new Promise((resolve) => setTimeout(resolve, 520));
  loadingScreen.style.display = 'none';
}

function waitForLoaderElements() {
  return new Promise((resolve) => {
    let attempts = 0;
    const maxAttempts = 180;
    const check = () => {
      if (loadingScreen && loadingPercentage) {
        resolve();
        return;
      }
      if (attempts++ > maxAttempts) {
        resolve();
        return;
      }
      requestAnimationFrame(check);
    };
    check();
  });
}

// No randomization - homepage always uses crash-cubes-homepage.png

// Time tracking variables
let gameStartTime = null;
let timeTrackingInterval = null;

// Game stats
let gameStats = {
  highScore: 0,
  cubesCracked: 0,
  helpersUsed: 0,
  longestCombo: 0,
  collectiblesUnlocked: 0,
  highestBoard: 0,
  timePlayed: 0
};

// Function to save stats to localStorage
function saveStatsToStorage() {
  try {
    localStorage.setItem('cubeCrash_stats', JSON.stringify(gameStats));
  } catch (error) {
    console.warn('Failed to save stats:', error);
  }
}

// Mobile-specific save function
function mobileSave() {
  console.log('📱 Mobile save triggered');
  if (typeof window.saveGameState === 'function') {
    try {
      window.saveGameState();
    } catch (err) {
      console.warn('Mobile save failed:', err);
    }
  }
}

// Mobile-specific load function
function mobileLoad() {
  console.log('📱 Mobile load triggered');
  if (typeof window.loadGameState === 'function') {
    try {
      window.loadGameState();
    } catch (err) {
      console.warn('Mobile load failed:', err);
    }
  }
}

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
  console.log('⏱️ Stopped time tracking, session:', sessionTime, 'seconds');
}

// Function to update time display
function updateTimeDisplay() {
  if (!gameStartTime) return;
  const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
  // Update time display if needed
}

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
      'background: rgba(245, 245, 245, 0.8)',
      'backdrop-filter: blur(14px)',
      'display: flex',
      'align-items: center',
      'justify-content: center',
      'z-index: 1000000',
      'font-family: "LTCrow", Arial, sans-serif',
      'transition: opacity 0.5s ease-out, backdrop-filter 0.5s ease-out'
    ].join(';');

    const modal = document.createElement('div');
    modal.style.cssText = [
      'background: white',
      'border-radius: 40px',
      'max-width: 342px',
      'width: min(90%, 342px)',
      'padding: 40px',
      'display: flex',
      'flex-direction: column',
      'align-items: center',
      'gap: 24px',
      'text-align: center',
      'position: relative'
    ].join(';');

    const title = document.createElement('h2');
    title.textContent = 'Resume Game?';
    title.style.cssText = [
      'font-size: 40px',
      'font-weight: 900',
      'color: #AD8675',
      'line-height: 1.1',
      'font-family: "LTCrow"',
      'margin: 0'
    ].join(';');

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Would you like to continue\nyour last game?';
    subtitle.style.cssText = [
      'font-size: 20px',
      'font-weight: 400',
      'color: #AD8675',
      'line-height: 1.4',
      'white-space: pre-line',
      'font-family: "LTCrow"',
      'margin: -8px 0 0 0'
    ].join(';');

    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = [
      'display: flex',
      'flex-direction: column',
      'gap: 24px',
      'align-items: center',
      'width: 100%'
    ].join(';');

    const continueBtn = document.createElement('button');
    continueBtn.textContent = 'Continue';
    continueBtn.className = 'menu-btn-primary';
    continueBtn.style.cssText = [
      'width: 250px',
      'height: auto',
      'font-family: "LTCrow", system-ui, -apple-system, sans-serif',
      'letter-spacing: 0.3px',
      'font-size: 26px',
      'font-weight: 700',
      'color: white',
      'border: none',
      'cursor: pointer',
      'align-self: center'
    ].join(';');

    const newGameBtn = document.createElement('button');
    newGameBtn.textContent = 'New Game';
    newGameBtn.className = 'tap-scale';
    newGameBtn.style.cssText = [
      'width: 250px',
      'height: 64px',
      'font-family: "LTCrow", system-ui, -apple-system, sans-serif',
      'letter-spacing: 0.3px',
      'font-size: 24px',
      'font-weight: 700',
      'color: #AD8675',
      'text-transform: none',
      'border: 1px solid #E9DCD6',
      'border-radius: 40px',
      'background: white',
      'cursor: pointer',
      'align-self: center',
      'box-shadow: 0 8px 0 0 #E9DCD6',
      'transition: transform 0.15s ease'
    ].join(';');

    // Event listeners
    newGameBtn.onmouseenter = () => {
      newGameBtn.style.transform = 'translateY(3px)';
      newGameBtn.style.boxShadow = '0 4px 0 0 #E9DCD6';
    };
    newGameBtn.onmouseleave = () => {
      newGameBtn.style.transform = 'none';
      newGameBtn.style.boxShadow = '0 8px 0 0 #E9DCD6';
    };
    newGameBtn.onmousedown = () => {
      newGameBtn.style.transform = 'translateY(4px)';
      newGameBtn.style.boxShadow = '0 3px 0 0 #E9DCD6';
    };
    newGameBtn.onmouseup = () => {
      newGameBtn.style.transform = 'translateY(3px)';
      newGameBtn.style.boxShadow = '0 4px 0 0 #E9DCD6';
    };
    
    continueBtn.onclick = async () => {
      try {
        await animateModalExit();
        overlay.remove();
        await animateSlideExit();
        startTimeTracking(); // Start tracking play time
        appHost.style.display = 'block';
        appHost.removeAttribute('hidden');
        
        console.log('🎮 main.js: About to call boot() for continue...');
        await boot();
        console.log('🎮 main.js: boot() called for continue');
        
        // Wait a bit for boot to complete, then load saved game state
        setTimeout(async () => {
          console.log('🎮 main.js: About to load saved game state...');
          if (typeof window.loadGameState === 'function') {
            const loaded = await window.loadGameState();
            if (loaded) {
              console.log('✅ Game state loaded successfully');
            } else {
              console.log('⚠️ Failed to load game state, starting fresh');
            }
          } else {
            console.log('⚠️ loadGameState function not available');
          }
        }, 100);
        
        resolve();
      } catch (error) {
        console.error('❌ Error in continue flow:', error);
        // Fallback: try to start game anyway
        try {
          await boot();
        } catch (fallbackError) {
          console.error('❌ Fallback boot also failed:', fallbackError);
        }
        resolve();
      }
    };

    newGameBtn.onclick = async () => {
      try {
        await animateModalExit();
        overlay.remove();
        await animateSlideExit();
        
        // Clear any existing saved game
        localStorage.removeItem('cc_saved_game');
        
        startTimeTracking(); // Start tracking play time
        appHost.style.display = 'block';
        appHost.removeAttribute('hidden');
        
        console.log('🎮 main.js: About to call boot() for new game...');
        await boot();
        console.log('🎮 main.js: boot() called for new game');
        resolve();
      } catch (error) {
        console.error('❌ Error in new game flow:', error);
        // Fallback: try to start game anyway
        try {
          await boot();
        } catch (fallbackError) {
          console.error('❌ Fallback boot also failed:', fallbackError);
        }
        resolve();
      }
    };

    // Tap outside to close
    const handleOverlayClick = (e) => {
      // Only close if clicking directly on overlay, not on modal or its children
      if (e.target === overlay && e.target !== modal) {
        e.preventDefault();
        e.stopPropagation();
        console.log('🎮 Modal closed by clicking outside');
        animateModalExit().then(() => {
      overlay.remove();
      sliderLocked = false;
      requestAnimationFrame(() => {
        setTimeout(() => {
          window.ensureDotsVisible?.();
        }, 100);
      });
      home.style.display = 'block';
      home.removeAttribute('hidden');
      home.hidden = false;
      restoreGradientBackground();
      resolve();
    });
  }
    };

    // Add event listeners with delay to prevent immediate closing
    setTimeout(() => {
      overlay.addEventListener('click', handleOverlayClick);
      // Remove touchstart to prevent double firing on mobile
      // overlay.addEventListener('touchstart', handleOverlayClick);
    }, 800); // 800ms delay before enabling tap outside to close

    // Assemble modal
    buttonsContainer.appendChild(continueBtn);
    buttonsContainer.appendChild(newGameBtn);
    modal.appendChild(title);
    modal.appendChild(subtitle);
    modal.appendChild(buttonsContainer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Entry animation
    overlay.style.opacity = '0';
    overlay.style.backdropFilter = 'blur(0px)';
    overlay.style.background = 'rgba(245, 245, 245, 0)';
    modal.style.pointerEvents = 'none'; // Disable pointer events during animation
    
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
      overlay.style.backdropFilter = 'blur(14px)';
      overlay.style.background = 'rgba(245, 245, 245, 0.8)';
    });

    // Animate modal elements
    modal.style.transform = 'scale(0.8) translateY(20px)';
    modal.style.opacity = '0';
    
    setTimeout(() => {
      modal.style.transition = 'transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55), opacity 0.5s ease-out';
      modal.style.transform = 'scale(1) translateY(0)';
      modal.style.opacity = '1';
      
      // Re-enable pointer events after animation
      setTimeout(() => {
        modal.style.pointerEvents = 'auto';
      }, 500);
    }, 50);

    // Animate individual elements
    setTimeout(() => {
      title.style.transition = 'transform 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55), opacity 0.4s ease-out';
      title.style.transform = 'translateY(10px)';
      title.style.opacity = '0';
      setTimeout(() => {
        title.style.transform = 'translateY(0)';
        title.style.opacity = '1';
      }, 50);
    }, 200);

    setTimeout(() => {
      subtitle.style.transition = 'transform 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55), opacity 0.4s ease-out';
      subtitle.style.transform = 'translateY(10px)';
      subtitle.style.opacity = '0';
      setTimeout(() => {
        subtitle.style.transform = 'translateY(0)';
        subtitle.style.opacity = '1';
      }, 50);
    }, 280);

    setTimeout(() => {
      continueBtn.style.transition = 'transform 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55), opacity 0.4s ease-out';
      continueBtn.style.transform = 'translateY(10px)';
      continueBtn.style.opacity = '0';
      setTimeout(() => {
        continueBtn.style.transform = 'translateY(0)';
        continueBtn.style.opacity = '1';
      }, 50);
    }, 360);

    setTimeout(() => {
      newGameBtn.style.transition = 'transform 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55), opacity 0.4s ease-out';
      newGameBtn.style.transform = 'translateY(10px)';
      newGameBtn.style.opacity = '0';
      setTimeout(() => {
        newGameBtn.style.transform = 'translateY(0)';
        newGameBtn.style.opacity = '1';
      }, 50);
    }, 440);
  });
}

// Modal exit animation
async function animateModalExit() {
  return new Promise(resolve => {
    const modal = document.querySelector('div[style*="border-radius: 40px"]');
    if (!modal) {
      resolve();
      return;
    }

    const title = modal.querySelector('h2');
    const subtitle = modal.querySelector('p');
    const buttons = modal.querySelectorAll('button');

    // Animate elements out
    if (title) {
      title.style.transition = 'transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55), opacity 0.3s ease-out';
      title.style.transform = 'translateY(-10px) scale(0.9)';
      title.style.opacity = '0';
    }

    if (subtitle) {
      subtitle.style.transition = 'transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55), opacity 0.3s ease-out';
      subtitle.style.transform = 'translateY(-10px) scale(0.9)';
      subtitle.style.opacity = '0';
    }

    buttons.forEach((btn, index) => {
      setTimeout(() => {
        btn.style.transition = 'transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55), opacity 0.3s ease-out';
        btn.style.transform = 'translateY(-10px) scale(0.9)';
        btn.style.opacity = '0';
      }, index * 80);
    });

    // Animate modal container
    setTimeout(() => {
      modal.style.transition = 'transform 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55), opacity 0.4s ease-out';
      modal.style.transform = 'scale(0.8) translateY(20px)';
      modal.style.opacity = '0';
      resolve();
    }, 300);
  });
}

// Slide exit animation
async function animateSlideExit() {
  return new Promise(resolve => {
    console.log('🎬 Starting slide exit animation...');
    fadeOutGradientBackground();
    
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
      
      // Hide home after animation completes
      setTimeout(() => {
        home.style.display = 'none';
        console.log('✅ Slide exit animation completed');
        resolve();
      }, 650); // Wait for elastic spring bounce animation to complete
    } else {
      // Fallback if elements not found
      console.log('⚠️ Slide elements not found, hiding home immediately');
      home.style.display = 'none';
      resolve();
    }
  });
}

// Check for saved game on startup
async function checkForSavedGame() {
  const hasSavedGame = localStorage.getItem('cc_saved_game');
  console.log('🎮 Checking for saved game...', { hasSavedGame: !!hasSavedGame });
  if (hasSavedGame) {
    try {
      const gameState = JSON.parse(hasSavedGame);
      const saveAge = Date.now() - gameState.timestamp;
      if (saveAge < 24 * 60 * 60 * 1000) { // Less than 24 hours old
        // Check if player has actually played (moved tiles, made merges, etc.)
        const hasPlayed = gameState.hasPlayed || false;
        const hasMoves = gameState.moveCount > 0 || false;
        const hasScore = gameState.score > 0 || false;
        const hasTiles = gameState.grid && gameState.grid.some(row => row.some(cell => cell !== null)) || false;
        
        console.log('🎮 Game state analysis:', { hasPlayed, hasMoves, hasScore, hasTiles });
        console.log('🎮 Game state details:', { 
          moveCount: gameState.moveCount, 
          score: gameState.score,
          grid: gameState.grid ? 'exists' : 'missing'
        });
        
        if (hasPlayed || hasMoves || hasScore || hasTiles) {
          console.log('🎮 Found played game, showing resume bottom sheet...');
          
          // CRITICAL: Reset Play button immediately before showing modal
          const playButton = document.querySelector('.slide-button.tap-scale.menu-btn-primary');
          if (playButton) {
            playButton.style.transform = 'scale(1) !important';
            playButton.style.transition = 'none !important';
            playButton.classList.add('play-button-reset');
            console.log('🔧 Play button reset before showing resume modal');
          }
          
          // Import and call the bottom sheet function
          try {
            const { showResumeGameBottomSheet } = await import('./modules/resume-game-bottom-sheet.js');
            await showResumeGameBottomSheet();
            return;
          } catch (error) {
            console.error('❌ Failed to show resume bottom sheet:', error);
            // Fallback to old modal
            await showResumeGameModal();
            return;
          }
        } else {
          console.log('🎮 Found fresh game (no moves made), starting directly...');
          // Remove the fresh game save and start new
          localStorage.removeItem('cc_saved_game');
        }
      } else {
        console.log('⚠️ Saved game is too old, removing...');
        localStorage.removeItem('cc_saved_game');
      }
    } catch (error) {
      console.warn('⚠️ Corrupted save file, removing...', error);
      localStorage.removeItem('cc_saved_game');
    }
  }
  
  // No saved game or fresh game, start directly
  console.log('🎮 Starting new game directly...');
  await startGameDirectly();
}

// Start game directly without modal
async function startGameDirectly() {
  await animateSlideExit();
  startTimeTracking();
  appHost.style.display = 'block';
  appHost.removeAttribute('hidden');
  
  console.log('🎮 main.js: About to call boot() for direct start...');
  await boot();
  console.log('🎮 main.js: boot() called for direct start');
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
const PARALLAX_ENABLED = false; // disable parallax for idle animations

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
  console.log('🎭 Starting parallax loop for idle animation');
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
      
      // Debug log every 60 frames (1 second)
      if (Math.floor(now / 1000) !== Math.floor((now - 16) / 1000)) {
        console.log('🎭 Parallax debug:', { isDragging, idleOffset, parallaxTargetX, parallaxCurrentX });
      }
      
      parallaxRafId = requestAnimationFrame(step);
    };
  parallaxRafId = requestAnimationFrame(step);
}

(async () => {
  async function waitForImageElement(img) {
    if (!img) return;

    if (!img.complete || img.naturalWidth === 0) {
      await new Promise((resolve, reject) => {
        const handleLoad = () => {
          img.removeEventListener('load', handleLoad);
          img.removeEventListener('error', handleError);
          resolve();
        };
        const handleError = (event) => {
          img.removeEventListener('load', handleLoad);
          img.removeEventListener('error', handleError);
          reject(event?.error || new Error(`Failed to load ${img.src}`));
        };

        img.addEventListener('load', handleLoad, { once: true });
        img.addEventListener('error', handleError, { once: true });
      });
    }

    if (typeof img.decode === 'function') {
      try {
        await img.decode();
      } catch (error) {
        // Safari may throw EncodingError even when the image is ready.
        if (error?.name !== 'EncodingError') {
          throw error;
        }
      }
    }
  }

  async function ensureCriticalImagesReady() {
    const heroImage = document.querySelector('.slider-slide[data-slide="0"] .hero-image');
    const targets = [heroImage].filter(
      (img) => img instanceof HTMLImageElement
    );

    if (!targets.length) {
      return;
    }

    await Promise.all(
      targets.map(async (img) => {
        try {
          await waitForImageElement(img);
        } catch (error) {
          console.warn('⚠️ Critical image failed to preload:', img.src, error);
        }
      })
    );
  }

  try {
    // CRITICAL FIX: Start preloader IMMEDIATELY, don't wait for DOM
    console.log('🔄 Starting asset preloading IMMEDIATELY...');
    
    // Wait for DOM in parallel with preloading
    const domReady = document.readyState === 'loading' 
      ? new Promise(res => document.addEventListener('DOMContentLoaded', res, { once: true }))
      : Promise.resolve();
    
    // Set up progress callbacks BEFORE starting preloader
    assetPreloader.setProgressCallback((percentage, loaded, total) => {
      if (loadingFill) {
        loadingFill.style.width = `${percentage}%`;
      }

      const normalized = total > 0 ? loaded / total : percentage / 100;
      const clamped = Math.max(0, Math.min(normalized, 1));
      loaderPendingRealProgress = Math.max(loaderPendingRealProgress, clamped);

      if (clamped >= 1 || percentage >= 100) {
        loaderAssetsComplete = true;
        loaderActualProgress = 0.99;
      } else {
        if (loaderMinimumTimeReached) {
          const maxAllowed = Math.min(0.95, loaderLastTimeProgress + 0.12);
          const eased = Math.min(clamped * 0.85, maxAllowed);
          loaderActualProgress = Math.max(loaderActualProgress, eased);
        } else {
          loaderActualProgress = Math.max(loaderActualProgress, Math.min(0.85, loaderLastTimeProgress));
        }
      }

      console.log(`📦 Loading progress: ${percentage}% (${loaded}/${total})`);
    });

    assetPreloader.setCompleteCallback(async () => {
      console.log('✅ All assets loaded successfully');

      loaderAssetsComplete = true;
      loaderActualProgress = 0.99;

      await loaderVisualReadyPromise;
      const now = performance.now();
      const referenceStart = preloadStartTime || loaderStartTime || now;
      const elapsed = now - referenceStart;
      const remaining = Math.max(0, MINIMUM_PRELOADER_TIME_MS - elapsed);
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }

      await ensureCriticalImagesReady();
      await waitForLoaderElements();

      completeLoaderProgressInstant();
      await runLoaderExitAnimation();
      await fadeOutLoadingOverlay();

      await initializeApp();

      if (home) {
        home.style.display = 'block';
        home.removeAttribute('hidden');
        restoreGradientBackground();
      }

      await animateInitialSlideEnter();
    });

    assetPreloader.setErrorCallback(async (error) => {
      console.error('❌ Asset loading failed:', error);

      try {
        await ensureCriticalImagesReady();
      } catch (preloadError) {
        console.warn('⚠️ Proceeding without fully preloaded images:', preloadError);
      }

      loaderAssetsComplete = true;
      loaderActualProgress = 0.99;

      await loaderVisualReadyPromise;
      const now = performance.now();
      const referenceStart = preloadStartTime || loaderStartTime || now;
      const elapsed = now - referenceStart;
      const remaining = Math.max(0, MINIMUM_PRELOADER_TIME_MS - elapsed);
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }

      await waitForLoaderElements();

      completeLoaderProgressInstant();
      await runLoaderExitAnimation();
      await fadeOutLoadingOverlay();

      await initializeApp();

      if (home) {
        home.style.display = 'block';
        home.removeAttribute('hidden');
        restoreGradientBackground();
      }

      await animateInitialSlideEnter();
    });

    // Start preloading immediately (don't wait for DOM)
    const preloadPromise = assetPreloader.preloadWithIndividualLoading();
    
    // Wait for DOM in parallel with preloading
    await domReady;
    
    // Initialize loading screen elements AFTER DOM is ready
    loadingScreen = document.getElementById('loading-screen');
    loadingFill = document.getElementById('loading-fill');
    loadingPercentage = document.getElementById('loading-percentage');
    home = document.getElementById('home');
    appHost = document.getElementById('app');
    
    // Show loading screen initially
    if (loadingScreen) {
      loadingScreen.classList.remove('hidden');
      loadingScreen.style.display = 'flex';
    }
    if (home) {
      home.style.display = 'none';
      home.setAttribute('hidden', 'true');
    }
    initializeLoaderProgressTracking();
    runLoaderEnterAnimation().catch((error) => {
      console.warn('⚠️ Loader enter animation failed:', error);
    });

    if (!home || !appHost) {
      throw new Error('Required elements not found');
    }
    
    // Wait for preloading to complete
    await preloadPromise;

  } catch (error) {
    console.error('❌ Error:', error);
  }
})();

// Preload homepage images immediately for smooth display
// Homepage image preloading removed - using static crash-cubes-homepage.png only

// Initialize app after assets are loaded
async function initializeApp() {
  try {
    // CRITICAL FIX: Parallax background is now loaded in main preloader
    // Just mark it as ready since it's already loaded
    const globalBg = document.getElementById('global-bg');
    if (globalBg) {
      globalBg.dataset.ready = '1';
    }
    
    // iOS FIX: Force immediate rendering of homepage image
    const heroImage = document.querySelector('.slider-slide[data-slide="0"] .hero-image');
    if (heroImage && heroImage.complete) {
      heroImage.style.opacity = '0.9999';
      setTimeout(() => {
        heroImage.style.opacity = '1';
      }, 0);
    }
    
    console.log('✅ Background gradient ready');

    // Homepage image is static - no preloading or randomization needed
    
    // Test shimmer code removed for maximum performance - using pure CSS timing

    // MAXIMUM PERFORMANCE: Fixed 5-second shimmer interval - no JavaScript timers needed!
    // All shimmer timing is now handled purely by CSS - much better performance
    
    console.log(`🚀 Using pure CSS shimmer timing (5s intervals) for maximum performance`);
    
    // Shimmer fixed - debug code removed for clean production

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
          // Disable the fallback parallax graphic so it doesn't ghost during exit animations
          sliderParallaxImage.style.display = 'none';
          sliderParallaxImage.style.removeProperty('left');
          sliderParallaxImage.style.removeProperty('top');
          sliderParallaxImage.style.removeProperty('transform');
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
      if (!PARALLAX_ENABLED || !sliderParallaxImage) return;
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
    
    // Add "cancel on drag off" logic for slider CTA buttons
    const addSliderButtonTouchHandling = (btn, action) => {
      if (!btn) return;
      
      let touchStarted = false;
      let touchStartedOnButton = false;
      
      const handleTouchStart = (e) => {
        touchStarted = true;
        touchStartedOnButton = btn.contains(e.target);
        if (touchStartedOnButton) {
          btn.style.transform = 'scale(0.80)';
          btn.style.transition = 'transform 0.35s ease';
        }
      };
      
      const handleTouchMove = (e) => {
        if (touchStarted && touchStartedOnButton) {
          // Check if touch moved outside button
          const touch = e.touches[0];
          const rect = btn.getBoundingClientRect();
          const isOutside = touch.clientX < rect.left || touch.clientX > rect.right || 
                           touch.clientY < rect.top || touch.clientY > rect.bottom;
          
          if (isOutside) {
            // Cancel the touch - reset button
            btn.style.transform = 'scale(1)';
            btn.style.transition = 'transform 0.35s ease';
            touchStartedOnButton = false;
          }
        }
      };
      
      const handleTouchEnd = (e) => {
        if (touchStarted && touchStartedOnButton) {
          // Only trigger if touch ended on button
          const touch = e.changedTouches[0];
          const rect = btn.getBoundingClientRect();
          const isOnButton = touch.clientX >= rect.left && touch.clientX <= rect.right && 
                            touch.clientY >= rect.top && touch.clientY <= rect.bottom;
          
          if (isOnButton && action) {
            action(e);
          }
        }
        
        // Reset button
        btn.style.transform = 'scale(1)';
        btn.style.transition = 'transform 0.35s ease';
        touchStarted = false;
        touchStartedOnButton = false;
      };
      
      const handleMouseDown = (e) => {
        if (btn.contains(e.target)) {
          btn.style.transform = 'scale(0.80)';
          btn.style.transition = 'transform 0.35s ease';
        }
      };
      
      const handleMouseUp = (e) => {
        if (btn.contains(e.target)) {
          btn.style.transform = 'scale(1)';
          btn.style.transition = 'transform 0.35s ease';
        }
      };
      
      const handleMouseLeave = () => {
        btn.style.transform = 'scale(1)';
        btn.style.transition = 'transform 0.35s ease';
      };
      
      // Add event listeners
      btn.addEventListener('touchstart', handleTouchStart, { passive: true });
      btn.addEventListener('touchmove', handleTouchMove, { passive: true });
      btn.addEventListener('touchend', handleTouchEnd, { passive: true });
      btn.addEventListener('mousedown', handleMouseDown);
      btn.addEventListener('mouseup', handleMouseUp);
      btn.addEventListener('mouseleave', handleMouseLeave);
    };
    
    // Add "cancel on drag off" touch handling for play button
    if (playButton) {
      addSliderButtonTouchHandling(playButton, async (e) => {
        e.stopPropagation();
        console.log('🎮 Play touched');
        // Handle play button action - same as click
        // Check if there's a saved game state to resume
        try {
          const savedState = localStorage.getItem('cubeCrash_gameState');
          if (savedState) {
            console.log('📦 Found saved game state - showing resume modal');
            
            // CRITICAL: Reset Play button immediately before showing modal
            const playButton = document.querySelector('.slide-button.tap-scale.menu-btn-primary');
            if (playButton) {
              playButton.style.transform = 'scale(1) !important';
              playButton.style.transition = 'none !important';
              playButton.classList.add('play-button-reset');
              console.log('🔧 Play button reset before showing resume modal');
            }
            
            // Import and call the bottom sheet function
            try {
              const { showResumeGameBottomSheet } = await import('./modules/resume-game-bottom-sheet.js');
              await showResumeGameBottomSheet();
              return;
            } catch (error) {
              console.error('❌ Failed to show resume bottom sheet:', error);
              // Fallback to starting new game
            }
          }
        } catch (error) {
          console.error('❌ Error checking saved game state:', error);
        }
        
        // No saved state or error - start new game
        console.log('🎮 Starting new game');
        // This would be handled by the existing click handler
      });
    }
    
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
      highestBoard: 0,
      timePlayed: 0
    };
    
    // Time tracking variables
    let gameStartTime = null;
    let timeTrackingInterval = null;
    
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
          setParallax(parallaxX, { animated: false });
        }
        console.log(`🎯 Slider update: slide ${currentSlide}, translateX: ${translateX}px`);
        
        // CRITICAL: Ensure Play button stays at scale(1) after slider updates
        const playButton = document.querySelector('.slide-button.tap-scale.menu-btn-primary');
        if (playButton) {
          playButton.style.transform = 'scale(1) !important';
          playButton.style.transition = 'none !important';
        }
        
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

    function showCollectiblesScreen() {
      if (sliderLocked) return;
      console.log('🎁 Showing collectibles screen');
      const collectiblesScreen = document.getElementById('collectibles-screen');
      console.log('🎁 Collectibles screen element:', collectiblesScreen);
      fadeOutGradientBackground();
      
      // Lock slider immediately
      sliderLocked = true;
      isDragging = false;
      hideDots();
      
      // Hide home element
      if (home) {
        home.hidden = true;
        home.setAttribute('hidden', 'true');
        home.style.display = 'none';
        console.log('🎁 Home element hidden:', {
          hidden: home.hidden,
          display: home.style.display,
          hasAttribute: home.hasAttribute('hidden')
        });
      }
      
      // Get slide 3 (collectibles) elements for exit animation
      const slideCollectibles = document.querySelector('.slider-slide[data-slide="2"]');
      const slideCollectiblesContent = slideCollectibles?.querySelector('.slide-content');
      const slideCollectiblesText = slideCollectibles?.querySelector('.slide-text');
      const slideCollectiblesButton = slideCollectibles?.querySelector('.slide-button');
      const slideCollectiblesHero = slideCollectibles?.querySelector('.hero-container');
      const homeLogo = document.getElementById('home-logo');
      
      console.log('🎁 Slide 3 elements:', { slideCollectibles, slideCollectiblesContent, slideCollectiblesText, slideCollectiblesButton, slideCollectiblesHero });
      
      if (slideCollectibles && slideCollectiblesContent && slideCollectiblesText && slideCollectiblesButton && slideCollectiblesHero) {
        // Add elastic spring bounce pop out animation - 0.65 seconds
        slideCollectiblesContent.style.transition = 'opacity 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
        slideCollectiblesText.style.transition = 'opacity 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
        slideCollectiblesButton.style.transition = 'opacity 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
        slideCollectiblesHero.style.transition = 'opacity 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
        
        // Apply exit animation
        slideCollectiblesContent.style.opacity = '0';
        slideCollectiblesContent.style.transform = 'scale(0) translateY(-20px)';
        slideCollectiblesText.style.opacity = '0';
        slideCollectiblesText.style.transform = 'scale(0) translateY(-15px)';
        slideCollectiblesButton.style.opacity = '0';
        slideCollectiblesButton.style.transform = 'scale(0) translateY(-10px)';
        slideCollectiblesHero.style.opacity = '0';
        slideCollectiblesHero.style.transform = 'scale(0) translateY(-25px)';
        if (homeLogo) {
          homeLogo.style.transition = 'opacity 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
          homeLogo.style.opacity = '0';
          homeLogo.style.transform = 'scale(0) translateY(-30px)';
        }
        
        // Show collectibles screen after animation
        setTimeout(() => {
          console.log('🎁 Showing collectibles screen after animation');
          if (home) {
            home.hidden = true;
            home.setAttribute('hidden', 'true');
            home.style.display = 'none';
          }
          if (collectiblesScreen) {
            collectiblesScreen.classList.remove('hidden');
            collectiblesScreen.classList.add('show');
            collectiblesScreen.removeAttribute('hidden');
            collectiblesScreen.style.display = 'flex';
            collectiblesScreen.style.opacity = '0';
            collectiblesScreen.style.transform = 'scale(0.8) translateY(20px)';
            collectiblesScreen.style.transition = 'opacity 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55), transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
            
            // Initialize collectibles if manager exists
            if (window.collectiblesManager) {
              window.collectiblesManager.renderCards();
              window.collectiblesManager.updateCounters();
            }
            
            requestAnimationFrame(() => {
              collectiblesScreen.style.opacity = '1';
              collectiblesScreen.style.transform = 'scale(1) translateY(0)';
            });
          }
        }, 650);
      } else {
        console.warn('🎁 Slide 3 elements not found, showing collectibles screen immediately');
        if (collectiblesScreen) {
          if (home) {
            home.hidden = true;
            home.setAttribute('hidden', 'true');
            home.style.display = 'none';
          }
          collectiblesScreen.classList.remove('hidden');
          collectiblesScreen.classList.add('show');
          collectiblesScreen.removeAttribute('hidden');
          collectiblesScreen.style.display = 'flex';
          collectiblesScreen.style.opacity = '0';
          collectiblesScreen.style.transform = 'scale(0.8) translateY(20px)';
          collectiblesScreen.style.transition = 'opacity 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55), transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
          
          // Initialize collectibles if manager exists
          if (window.collectiblesManager) {
            window.collectiblesManager.renderCards();
            window.collectiblesManager.updateCounters();
          }
          
          requestAnimationFrame(() => {
            collectiblesScreen.style.opacity = '1';
            collectiblesScreen.style.transform = 'scale(1) translateY(0)';
          });
        }
      }
    }

    function showStatsScreen() {
      if (sliderLocked) return;
      console.log('📊 Showing stats screen');
      console.log('📊 Stats screen element:', statsScreen);
      fadeOutGradientBackground();
      
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
    
    function hideCollectiblesScreen() {
      console.log('🎁 Hiding collectibles screen with exit animation');
      
      const collectiblesScreen = document.getElementById('collectibles-screen');
      if (!collectiblesScreen) return;
      
      // Add exit animation (reverse of enter animation)
      collectiblesScreen.style.transition = 'opacity 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55), transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
      collectiblesScreen.style.opacity = '0';
      collectiblesScreen.style.transform = 'scale(0.8) translateY(20px)';
      
      // Wait for exit animation to complete, then hide and show slide 2 with enter animation
      setTimeout(() => {
        collectiblesScreen.hidden = true;
        collectiblesScreen.setAttribute('hidden', 'true');
        collectiblesScreen.style.display = 'none';
        if (home) {
          home.hidden = false;
          home.removeAttribute('hidden');
          home.style.display = 'block';
          console.log('🎁 Home element restored:', {
            hidden: home.hidden,
            display: home.style.display,
            hasAttribute: home.hasAttribute('hidden')
          });
        }
        
        // Unlock slider and show dots
        sliderLocked = false;
        ensureDotsVisible();
        
        console.log('🎁 Slider unlocked, navigating to slide 2');

        // Navigate to Collectibles slide (index 2) first
        try { 
          goToSlide(2);
          console.log('🎁 goToSlide(2) called successfully');
        } catch (error) {
          console.error('🎁 Error calling goToSlide(2):', error);
        }
        
        // Get slide 3 elements for enter animation
        const slideCollectibles = document.querySelector('.slider-slide[data-slide="2"]');
        const slideCollectiblesContent = slideCollectibles?.querySelector('.slide-content');
        const slideCollectiblesText = slideCollectibles?.querySelector('.slide-text');
        const slideCollectiblesButton = slideCollectibles?.querySelector('.slide-button');
        const slideCollectiblesHero = slideCollectibles?.querySelector('.hero-container');
        const homeLogo = document.getElementById('home-logo');
        
        if (slideCollectibles && slideCollectiblesContent && slideCollectiblesText && slideCollectiblesButton && slideCollectiblesHero) {
          // Reset styles for enter animation
          slideCollectiblesContent.style.opacity = '0';
          slideCollectiblesContent.style.transform = 'scale(0) translateY(-20px)';
          slideCollectiblesContent.style.transition = 'none';
          slideCollectiblesText.style.opacity = '0';
          slideCollectiblesText.style.transform = 'scale(0) translateY(-15px)';
          slideCollectiblesText.style.transition = 'none';
          slideCollectiblesButton.style.opacity = '0';
          slideCollectiblesButton.style.transform = 'scale(0) translateY(-10px)';
          slideCollectiblesButton.style.transition = 'none';
          slideCollectiblesHero.style.opacity = '0';
          slideCollectiblesHero.style.transform = 'scale(0) translateY(-25px)';
          slideCollectiblesHero.style.transition = 'none';
          if (homeLogo) {
            homeLogo.style.opacity = '0';
            homeLogo.style.transform = 'scale(0) translateY(-30px)';
            homeLogo.style.transition = 'none';
          }
          
          // Trigger enter animation
          requestAnimationFrame(() => {
            restoreGradientBackground();
            
            const spring = 'cubic-bezier(0.68, -0.8, 0.265, 1.8)';
            setTimeout(() => {
              slideCollectiblesContent.style.transition = `opacity 0.65s ${spring}, transform 0.65s ${spring}`;
              slideCollectiblesText.style.transition = `opacity 0.65s ${spring}, transform 0.65s ${spring}`;
              slideCollectiblesButton.style.transition = `opacity 0.65s ${spring}, transform 0.65s ${spring}`;
              slideCollectiblesHero.style.transition = `opacity 0.65s ${spring}, transform 0.65s ${spring}`;
              if (homeLogo) {
                homeLogo.style.transition = `opacity 0.65s ${spring}, transform 0.65s ${spring}`;
              }
              
              slideCollectiblesContent.style.opacity = '1';
              slideCollectiblesContent.style.transform = 'scale(1) translateY(0)';
              slideCollectiblesText.style.opacity = '1';
              slideCollectiblesText.style.transform = 'scale(1) translateY(-8px)';
              slideCollectiblesButton.style.opacity = '1';
              slideCollectiblesButton.style.transform = 'scale(1) translateY(0)';
              slideCollectiblesHero.style.opacity = '1';
              slideCollectiblesHero.style.transform = 'scale(1) translateY(0)';
              if (homeLogo) {
                homeLogo.style.opacity = '1';
                homeLogo.style.transform = 'scale(1) translateY(0)';
              }
              
              setTimeout(() => {
                slideCollectiblesContent.style.transition = 'none';
                slideCollectiblesText.style.transition = 'none';
                slideCollectiblesButton.style.transition = 'none';
                slideCollectiblesHero.style.transition = 'none';
                if (homeLogo) {
                  homeLogo.style.transition = 'none';
                }
              }, 700);
            }, 20);
          });
        }
        
        // Restore gradient background
        if (!slideCollectibles || !slideCollectiblesContent || !slideCollectiblesText || !slideCollectiblesButton || !slideCollectiblesHero) {
          restoreGradientBackground();
        }

        requestAnimationFrame(() => {
          console.log('🎁 Final requestAnimationFrame - calling goToSlide(2) and updateSlider()');
          goToSlide(2);
          updateSlider();
          console.log('🎁 Final navigation complete');
        });
      }, 500);
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
          restoreGradientBackground();
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
    
    // Global event handlers for menu
    let menuEventHandlers = {
      handleOutsideClick: null,
      handleTouchStart: null,
      handleTouchMove: null,
      handleTouchEnd: null
    };
    
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
      
      // Add enter animation - bottom sheet style
      const menuContent = menuScreen.querySelector('.menu-content');
      if (menuContent) {
        menuContent.style.transform = 'translateY(100%)';
        menuContent.style.transition = 'transform 0.3s ease-out';
        
        setTimeout(() => {
          menuContent.style.transform = 'translateY(0)';
        }, 50);
      }
      
      // Add click outside to close and trigger unpause
      menuEventHandlers.handleOutsideClick = (e) => {
        if (e.target === menuScreen) {
          hideMenuScreen();
          // Trigger unpause when clicking outside
          if (window.CC && typeof window.CC.resumeGame === 'function') {
            window.CC.resumeGame();
          }
        }
      };
      
      // Add drag to close functionality
      let startY = 0;
      let currentY = 0;
      let isDragging = false;
      let dragThreshold = 50; // Minimum drag distance to close
      
      menuEventHandlers.handleTouchStart = (e) => {
        if (e.target === menuContent) {
          // Handle both touch and pointer events
          const clientY = e.touches ? e.touches[0].clientY : e.clientY;
          startY = clientY;
          isDragging = true;
          menuContent.style.transition = 'none'; // Disable transition during drag
        }
      };
      
      menuEventHandlers.handleTouchMove = (e) => {
        if (!isDragging) return;
        
        // Handle both touch and pointer events
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        currentY = clientY;
        const deltaY = currentY - startY;
        
        // Only allow downward drag
        if (deltaY > 0) {
          menuContent.style.transform = `translateY(${deltaY}px)`;
        }
      };
      
      menuEventHandlers.handleTouchEnd = (e) => {
        if (!isDragging) return;
        
        isDragging = false;
        const deltaY = currentY - startY;
        
        // If dragged far enough down, close the modal and trigger unpause
        if (deltaY > dragThreshold) {
          hideMenuScreen();
          // Trigger unpause when dragging down
          if (window.CC && typeof window.CC.resumeGame === 'function') {
            window.CC.resumeGame();
          }
        } else {
          // Snap back to original position
          menuContent.style.transition = 'transform 0.3s ease-out';
          menuContent.style.transform = 'translateY(0)';
        }
      };
      
      // Add both click and pointer events for better Android support
      menuScreen.addEventListener('click', menuEventHandlers.handleOutsideClick);
      menuScreen.addEventListener('pointerdown', menuEventHandlers.handleOutsideClick);
      
      if (menuContent) {
        menuContent.addEventListener('touchstart', menuEventHandlers.handleTouchStart, { passive: true });
        menuContent.addEventListener('touchmove', menuEventHandlers.handleTouchMove, { passive: true });
        menuContent.addEventListener('touchend', menuEventHandlers.handleTouchEnd, { passive: true });
        
        // Add pointer events for better Android support
        menuContent.addEventListener('pointerdown', menuEventHandlers.handleTouchStart, { passive: true });
        menuContent.addEventListener('pointermove', menuEventHandlers.handleTouchMove, { passive: true });
        menuContent.addEventListener('pointerup', menuEventHandlers.handleTouchEnd, { passive: true });
      }
    }
    
    function hideMenuScreen() {
      console.log('📋 Hiding menu screen');
      
      if (!menuScreen) return;
      
      setMenuVisible(false);
      
      // Add exit animation - bottom sheet style
      const menuContent = menuScreen.querySelector('.menu-content');
      if (menuContent) {
        menuContent.style.transition = 'transform 0.3s ease-out';
        menuContent.style.transform = 'translateY(100%)';
      }

      // Wait for exit animation to complete, then hide
      setTimeout(() => {
        menuScreen.hidden = true;
        menuScreen.setAttribute('hidden', 'true');
        
        // Clean up event listeners
        if (menuEventHandlers.handleOutsideClick) {
          menuScreen.removeEventListener('click', menuEventHandlers.handleOutsideClick);
          menuScreen.removeEventListener('pointerdown', menuEventHandlers.handleOutsideClick);
        }
        if (menuContent && menuEventHandlers.handleTouchStart) {
          menuContent.removeEventListener('touchstart', menuEventHandlers.handleTouchStart);
          menuContent.removeEventListener('touchmove', menuEventHandlers.handleTouchMove);
          menuContent.removeEventListener('touchend', menuEventHandlers.handleTouchEnd);
          menuContent.removeEventListener('pointerdown', menuEventHandlers.handleTouchStart);
          menuContent.removeEventListener('pointermove', menuEventHandlers.handleTouchMove);
          menuContent.removeEventListener('pointerup', menuEventHandlers.handleTouchEnd);
        }
        
        // Reset event handlers
        menuEventHandlers.handleOutsideClick = null;
        menuEventHandlers.handleTouchStart = null;
        menuEventHandlers.handleTouchMove = null;
        menuEventHandlers.handleTouchEnd = null;
      }, 300);
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
        highestBoard: toIntSafe(obj.highestBoard || obj.boardsCleared || 0),
        timePlayed: toIntSafe(obj.timePlayed),
      };
    }

    // Function to update stats data with animation
    function updateStatsData(data) {
      const { highScore, cubesCracked, helpersUsed, longestCombo, collectiblesUnlocked, highestBoard, timePlayed } = sanitizeStats(data);
      
      const highScoreEl = document.getElementById('high-score');
      const cubesCrackedEl = document.getElementById('cubes-cracked');
      const helpersUsedEl = document.getElementById('helpers-used');
      const longestComboEl = document.getElementById('longest-combo');
      const collectiblesUnlockedEl = document.getElementById('collectibles-unlocked');
      const highestBoardEl = document.getElementById('highest-board');
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
      if (highestBoardEl && highestBoard !== undefined) {
        gameStats.highestBoard = highestBoard;
        animateNumber(highestBoardEl, highestBoard);
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
          ['high-score','highest-board','cubes-cracked','helpers-used','longest-combo','time-played'].forEach(id => {
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
      // BUT preserve Play button scale(1) to prevent auto-scaling bug
      try {
        document.querySelectorAll('.slider-slide .slide-content, .slider-slide .slide-text, .slider-slide .slide-button').forEach(el => {
          // Don't reset Play button transform - it must stay at scale(1)
          if (el.classList.contains('menu-btn-primary')) {
            el.style.transition = '';
            el.style.opacity = '';
            // Keep transform: scale(1) !important to prevent auto-scaling
          } else {
            el.style.transition = '';
            el.style.transform = '';
            el.style.opacity = '';
          }
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
      
      const startGameNow = (e) => {
        if (sliderLocked) return;
        if (e) { try { e.stopPropagation(); } catch {} }
        console.log('🎮 Play - showing resume modal');
        
        // CRITICAL: Immediately reset Play button to prevent animation continuation
        if (playButton) {
          playButton.style.transform = 'scale(1) !important';
          playButton.style.transition = 'none !important';
          playButton.classList.add('play-button-reset');
          console.log('🔧 Play button immediately reset to scale(1) before modal');
        }
        
        // Lock slider immediately to prevent interference
        sliderLocked = true;
        isDragging = false;
        
        // Start background monitoring to ensure button stays reset
        const backgroundInterval = setInterval(() => {
          if (sliderLocked) {
            window.ensurePlayButtonReset();
          } else {
            clearInterval(backgroundInterval);
          }
        }, 50); // Check every 50ms
        
        // Global click handler to reset button if clicked elsewhere
        const globalClickHandler = (e) => {
          if (playButton && !playButton.contains(e.target)) {
            playButton.style.transform = 'scale(1)';
            playButton.style.transition = 'transform 0.15s ease';
            console.log('🔧 Global click - button reset to scale(1)');
          }
        };
        
        document.addEventListener('click', globalClickHandler);
        
        // Clean up global handler when slider unlocks
        const originalUnlockSlider = window.unlockSlider;
        window.unlockSlider = () => {
          document.removeEventListener('click', globalClickHandler);
          originalUnlockSlider();
        };
        
        // Check for saved game and show modal
        checkForSavedGame();
      };

      // Track button press and drag behavior
      let isButtonPressed = false;
      let hasMovedOutside = false;
      let buttonRect = null;
      
      // Function to setup play button events
      const setupPlayButtonEvents = (button) => {
        // Mouse events
        button.addEventListener('mousedown', handleButtonStart);
        button.addEventListener('mousemove', handleButtonMove);
        button.addEventListener('mouseup', handleButtonEnd);
        button.addEventListener('mouseleave', handleButtonEnd);
        
        // Touch events
        button.addEventListener('touchstart', handleButtonStart, { passive: true });
        button.addEventListener('touchmove', handleButtonMove, { passive: true });
        button.addEventListener('touchend', handleButtonEnd, { passive: true });
        
        // Fallback click event (for accessibility)
        button.addEventListener('click', (e) => {
          if (!hasMovedOutside) {
            startGameNow(e);
          }
        });
        
        // Standard UX behavior: track if button press started on button
        let buttonPressStartedOnButton = false;
        
        // Simple hover effects for Play button - only scale down on click, no hover scaling
        button.addEventListener('mousedown', (e) => {
          if (!sliderLocked && 
              !button.classList.contains('play-button-reset') && 
              button.style.pointerEvents !== 'none') {
            buttonPressStartedOnButton = true;
            button.style.transition = 'transform 0.15s ease';
            button.style.transform = 'scale(0.85)'; // Scale down dramatically
          }
        });
        
        button.addEventListener('mouseup', (e) => {
          if (!sliderLocked && 
              !button.classList.contains('play-button-reset') && 
              button.style.pointerEvents !== 'none') {
            
            // Only trigger action if press started on button AND ends on button
            if (buttonPressStartedOnButton && button.contains(e.target)) {
              startGameNow(e);
            }
            
            buttonPressStartedOnButton = false;
            button.style.transition = 'transform 0.15s ease';
            button.style.transform = 'scale(1)'; // Return to original size
          }
        });
        
        button.addEventListener('mouseleave', () => {
          if (!sliderLocked && 
              !button.classList.contains('play-button-reset') && 
              button.style.pointerEvents !== 'none') {
            button.style.transition = 'transform 0.15s ease';
            button.style.transform = 'scale(1)'; // Always return to original size
          }
        });
        
        // Touch events for mobile
        button.addEventListener('touchstart', (e) => {
          if (!sliderLocked && 
              !button.classList.contains('play-button-reset') && 
              button.style.pointerEvents !== 'none') {
            buttonPressStartedOnButton = true;
            button.style.transition = 'transform 0.15s ease';
            button.style.transform = 'scale(0.85)'; // Scale down dramatically
          }
        }, { passive: true });
        
        button.addEventListener('touchend', (e) => {
          if (!sliderLocked && 
              !button.classList.contains('play-button-reset') && 
              button.style.pointerEvents !== 'none') {
            
            // Only trigger action if press started on button AND ends on button
            if (buttonPressStartedOnButton && button.contains(e.target)) {
              startGameNow(e);
            }
            
            buttonPressStartedOnButton = false;
            button.style.transition = 'transform 0.15s ease';
            button.style.transform = 'scale(1)'; // Return to original size
          }
        }, { passive: true });
      };

      // Make button state variables globally accessible for reset
      window.resetPlayButtonState = () => {
        console.log('🔧 Resetting Play button state...');
        isButtonPressed = false;
        hasMovedOutside = false;
        buttonRect = null;

        if (playButton) {
          // Force button to stay at default scale(1) - no animations
          playButton.style.transform = 'scale(1) !important';
          playButton.style.transition = 'none !important';
          
          // Temporarily disable pointer events for very short time
          playButton.style.pointerEvents = 'none';
          playButton.classList.add('play-button-reset');

          try { playButton.blur(); } catch {}

          playButton.offsetHeight;

          setTimeout(() => {
            if (!playButton) return;
            playButton.classList.remove('play-button-reset');
            playButton.style.pointerEvents = '';
            
            // Ensure button stays at scale(1) - no automatic scaling
            playButton.style.transform = 'scale(1) !important';
            playButton.style.transition = 'none !important';
            
            console.log('🔧 Play button reset to scale(1) - no auto-scaling');
          }, 50);
        }
      };

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
        
        // Always reset button to scale(1) immediately
        if (playButton) {
          playButton.style.transform = 'scale(1)';
          playButton.style.transition = 'transform 0.15s ease';
          console.log('🔧 Button end - reset to scale(1)');
        }
        
        isButtonPressed = false;
        hasMovedOutside = false;
        buttonRect = null;
        e.stopPropagation();
      };

      // Setup all play button events
      setupPlayButtonEvents(playButton);
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
      
      // Add "cancel on drag off" touch handling for stats button
      addSliderButtonTouchHandling(statsButton, (e) => {
        e.stopPropagation();
        console.log('📊 Stats touched');
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
        showCollectiblesScreen();
      });
      
      // Add "cancel on drag off" touch handling for collectibles button
      addSliderButtonTouchHandling(collectiblesButton, (e) => {
        e.stopPropagation();
        console.log('🎁 Collectibles touched');
        showCollectiblesScreen();
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
      
      // Add "cancel on drag off" touch handling for settings button
      addSliderButtonTouchHandling(settingsButton, (e) => {
        e.stopPropagation();
        console.log('⚙️ Settings touched');
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
    
    // Test function to create saved game
    window.createTestSavedGame = () => {
      const testGameState = {
        timestamp: Date.now(),
        hasPlayed: true,
        moveCount: 5,
        score: 100,
        grid: [
          [1, null, null, 2, null],
          [null, 1, null, null, null],
          [1, null, 2, null, null],
          [null, null, 1, null, null],
          [1, null, null, null, null]
        ]
      };
      localStorage.setItem('cc_saved_game', JSON.stringify(testGameState));
      console.log('✅ Test saved game created');
    };
    
    // Unlock slider function
    window.unlockSlider = () => {
      console.log('🔓 Unlocking slider...');
      
      // Immediately unlock slider - no delay
      sliderLocked = false;
      console.log('🔓 Slider unlocked immediately');
      
      // CRITICAL: Force Play button to scale(1) immediately and stop all animations
      const playButton = document.querySelector('.slide-button.tap-scale.menu-btn-primary');
      if (playButton) {
        playButton.style.transform = 'scale(1) !important';
        playButton.style.transition = 'none !important';
        playButton.classList.add('play-button-reset');
        
        // Force reflow to stop any running animations
        playButton.offsetHeight;
        
        console.log('🔧 Play button forced to scale(1) immediately - all animations stopped');
      }
      
      // Reset Play button state but don't wait for it
      if (typeof window.resetPlayButtonState === 'function') {
        console.log('🔧 Resetting Play button state...');
        window.resetPlayButtonState();
      }
      
      // Ensure dots are visible immediately
      window.ensureDotsVisible?.();
    };
    
    // Background function to ensure Play button is always at scale(1)
    window.ensurePlayButtonReset = () => {
      const playButton = document.querySelector('.slide-button.tap-scale.menu-btn-primary');
      if (playButton) {
        playButton.style.transform = 'scale(1) !important';
        playButton.style.transition = 'none !important';
        playButton.classList.add('play-button-reset');
        console.log('🔧 Background: Play button ensured at scale(1)');
      }
    };
    

// Make end run modal function available globally
window.showEndRunModalFromGame = async () => {
  try {
    // CRITICAL: Reset Play button immediately before showing end run modal
    const playButton = document.querySelector('.slide-button.tap-scale.menu-btn-primary');
    if (playButton) {
      playButton.style.transform = 'scale(1) !important';
      playButton.style.transition = 'none !important';
      playButton.classList.add('play-button-reset');
      console.log('🔧 Play button reset before showing end run modal');
    }
    
    const { showEndRunModal } = await import('./modules/end-run-modal.js');
    showEndRunModal();
  } catch (error) {
    console.error('❌ Failed to show end run modal:', error);
  }
};


// Global functions for resume bottom sheet
window.continueGame = async () => {
  console.log('🎮 Continue game clicked');
  try {
    await animateSlideExit();
    
    // CRITICAL FIX: Reset game ended flag when continuing game
    window._gameHasEnded = false;
    
    startTimeTracking(); // Start tracking play time
    appHost.style.display = 'block';
    appHost.removeAttribute('hidden');
    
    console.log('🎮 main.js: About to call boot() for continue...');
    await boot();
    console.log('🎮 main.js: boot() called for continue');
    
    // Wait a bit for boot to complete, then load saved game state
    setTimeout(async () => {
      console.log('🎮 main.js: About to load saved game state...');
      if (typeof window.loadGameState === 'function') {
        const loaded = await window.loadGameState();
        if (loaded) {
          console.log('✅ Game state loaded successfully');
        } else {
          console.log('⚠️ Failed to load game state, starting fresh');
        }
      } else {
        console.log('⚠️ loadGameState function not available');
      }
    }, 100);
  } catch (error) {
    console.error('❌ Error in continue flow:', error);
    // Fallback: try to start game anyway
    try {
      await boot();
    } catch (fallbackError) {
      console.error('❌ Fallback boot also failed:', fallbackError);
    }
  }
};

window.startNewGame = async () => {
  console.log('🎮 New game clicked');
  try {
    await animateSlideExit();
    
    // CRITICAL FIX: Reset game ended flag when starting new game
    window._gameHasEnded = false;
    
    // Clear any existing saved game
    localStorage.removeItem('cc_saved_game');
    
    startTimeTracking(); // Start tracking play time
    appHost.style.display = 'block';
    appHost.removeAttribute('hidden');
    
    console.log('🎮 main.js: About to call boot() for new game...');
    await boot();
    console.log('🎮 main.js: boot() called for new game');
  } catch (error) {
    console.error('❌ Error in new game flow:', error);
    // Fallback: try to start game anyway
    try {
      await boot();
    } catch (fallbackError) {
      console.error('❌ Fallback boot also failed:', fallbackError);
    }
  }
};
    
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
        // Update gameStats directly
        gameStats.highScore = currentScore;
        
        // Update stats display
        updateStat('highScore', currentScore);
        console.log('🏆 New high score!', currentScore);
        
        // Save to multiple storage locations for iOS compatibility
        try {
          localStorage.setItem('cc_best_score_v1', currentScore);
          localStorage.setItem('cubeCrash_stats', JSON.stringify(gameStats));
          console.log('✅ High score saved to localStorage:', currentScore);
        } catch (error) {
          console.warn('⚠️ Failed to save to localStorage:', error);
        }
        
        // iOS specific: Try to save to sessionStorage as backup
        try {
          sessionStorage.setItem('cc_high_score_backup', currentScore);
          console.log('✅ High score saved to sessionStorage backup:', currentScore);
        } catch (error) {
          console.warn('⚠️ Failed to save to sessionStorage:', error);
        }
      } else {
        console.log('📊 Current score:', currentScore, 'High score:', gameStats.highScore);
      }
    };
    
    // Function to force update high score (for hard close scenarios)
    window.forceUpdateHighScore = (currentScore) => {
      console.log('🔄 Force updating high score:', currentScore);
      
      // Update gameStats directly
      gameStats.highScore = currentScore;
      
      // Update stats display
      updateStat('highScore', currentScore);
      
      // Save to multiple storage locations for iOS compatibility
      try {
        localStorage.setItem('cc_best_score_v1', currentScore);
        localStorage.setItem('cubeCrash_stats', JSON.stringify(gameStats));
        console.log('✅ High score force saved to localStorage:', currentScore);
      } catch (error) {
        console.warn('⚠️ Failed to force save high score:', error);
      }
      
      // iOS specific: Try to save to sessionStorage as backup
      try {
        sessionStorage.setItem('cc_high_score_backup', currentScore);
        console.log('✅ High score saved to sessionStorage backup:', currentScore);
      } catch (error) {
        console.warn('⚠️ Failed to save to sessionStorage:', error);
      }
    };
    
    // CRITICAL: Check for unsaved high score on page load (hard exit recovery)
    function checkForUnsavedHighScore() {
      try {
        // Check multiple sources for current score
        let currentScore = 0;
        
        // Try window.CC.state() first
        if (window.CC && typeof window.CC.state === 'function') {
          const state = window.CC.state();
          if (state && typeof state.score === 'number') {
            currentScore = state.score;
          }
        }
        
        // Try STATE object from app-state.js
        if (currentScore === 0 && window.STATE && typeof window.STATE.score === 'number') {
          currentScore = window.STATE.score;
        }
        
        // Try global score variable
        if (currentScore === 0 && typeof window.score === 'number') {
          currentScore = window.score;
        }
        
        // iOS specific: Check sessionStorage backup
        if (currentScore === 0) {
          try {
            const sessionScore = parseInt(sessionStorage.getItem('cc_high_score_backup') || '0', 10);
            if (sessionScore > 0) {
              currentScore = sessionScore;
              console.log('📱 Found score in sessionStorage backup:', currentScore);
            }
          } catch (error) {
            console.warn('⚠️ Failed to check sessionStorage:', error);
          }
        }
        
        const savedHighScore = parseInt(localStorage.getItem('cc_best_score_v1') || '0', 10);
        
        console.log('🔍 Checking for unsaved high score:', {
          currentScore,
          savedHighScore,
          gameStatsHighScore: gameStats.highScore,
          windowCC: !!(window.CC && typeof window.CC.state === 'function'),
          windowSTATE: !!(window.STATE && typeof window.STATE.score === 'number'),
          windowScore: typeof window.score === 'number'
        });
        
        // If current score is higher than saved, update it
        if (currentScore > savedHighScore && currentScore > gameStats.highScore) {
          console.log('🏆 Found unsaved high score! Updating...', currentScore);
          window.forceUpdateHighScore(currentScore);
        }
      } catch (error) {
        console.warn('⚠️ Failed to check for unsaved high score:', error);
      }
    }
    
    // Export function globally
    window.checkForUnsavedHighScore = checkForUnsavedHighScore;
    
    // CRITICAL: Check for unsaved high score on page load
    setTimeout(() => {
      checkForUnsavedHighScore();
    }, 3000);
    
    // iOS specific: Save high score before page unload
    window.addEventListener('beforeunload', () => {
      try {
        const currentScore = (window.CC && typeof window.CC.state === 'function') ? window.CC.state()?.score : 0;
        if (currentScore > 0) {
          console.log('📱 iOS beforeunload: Saving high score:', currentScore);
          sessionStorage.setItem('cc_high_score_backup', currentScore);
          localStorage.setItem('cc_best_score_v1', currentScore);
        }
      } catch (error) {
        console.warn('⚠️ Failed to save on beforeunload:', error);
      }
    });
    
    // iOS specific: Save high score on page hide (when app goes to background)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        try {
          const currentScore = (window.CC && typeof window.CC.state === 'function') ? window.CC.state()?.score : 0;
          if (currentScore > 0) {
            console.log('📱 iOS visibilitychange: Saving high score:', currentScore);
            sessionStorage.setItem('cc_high_score_backup', currentScore);
            localStorage.setItem('cc_best_score_v1', currentScore);
          }
        } catch (error) {
          console.warn('⚠️ Failed to save on visibilitychange:', error);
        }
      }
    });
    
    // Function to track cubes cracked (when tiles are merged)
    window.trackCubesCracked = (count = 1) => {
      incrementStat('cubesCracked', count);
    };
    
    // Function to track helpers used (powerups, etc.)
    window.trackHelpersUsed = (count = 1) => {
      incrementStat('helpersUsed', count);
    };
    
    // Function to track highest board reached
    window.trackHighestBoard = (currentBoard) => {
      if (currentBoard > gameStats.highestBoard) {
        updateStat('highestBoard', currentBoard);
        console.log('🎯 New highest board reached:', currentBoard);
      }
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
        highestBoard: 0,
        timePlayed: 0
      };
      saveStatsToStorage();
      console.log('🔄 All stats reset');
    };

    // Function to test the end run modal
    window.testEndRunModal = async () => {
      try {
        const { showEndRunModalFromGame } = await import('./modules/achievements.js');
        showEndRunModalFromGame();
        console.log('🎮 End run modal test triggered');
      } catch (error) {
        console.error('❌ Failed to show end run modal:', error);
      }
    };

    
    // SIMPLE EXIT FUNCTION - CLEAN RESET WITHOUT INLINE OVERRIDES
    window.exitToMenu = async () => {
      console.log('🏠 Exiting to menu...');
      
      // CRITICAL: Update high score before exit
      try {
        const currentScore = (window.CC && typeof window.CC.state === 'function') ? window.CC.state()?.score : 0;
        if (currentScore > 0) {
          console.log('🏆 Updating high score before exit:', currentScore);
          if (typeof window.updateHighScore === 'function') {
            window.updateHighScore(currentScore);
          }
          // Also try force update as backup
          if (typeof window.forceUpdateHighScore === 'function') {
            window.forceUpdateHighScore(currentScore);
          }
        }
      } catch (error) {
        console.warn('⚠️ Failed to update high score before exit:', error);
      }
      
      // CRITICAL: Reset Play button immediately before exit
      const playButton = document.querySelector('.slide-button.tap-scale.menu-btn-primary');
      if (playButton) {
        playButton.style.transform = 'scale(1) !important';
        playButton.style.transition = 'none !important';
        playButton.classList.add('play-button-reset');
        console.log('🔧 Play button reset before exit to menu');
      }
      
      markGameActive(false);
      recordCurrentSlide(0);
      autoBootedFromState = false;

      // Stop time tracking
      stopTimeTracking();
      
      // Clear saved game so next play starts fresh
      try {
        localStorage.removeItem('cc_saved_game');
        console.log('🗑️ Cleared saved game - next play will start fresh');
      } catch (error) {
        console.warn('Failed to clear saved game:', error);
      }
      
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
        
        // CRITICAL: Check for unsaved high score after game loads
        setTimeout(() => {
          checkForUnsavedHighScore();
        }, 1000);
        
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
        restoreGradientBackground();
        
        // Homepage image is static - no randomization needed
        
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
    
    // Mobile-specific event listeners
    window.addEventListener('pagehide', mobileSave);
    window.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        mobileSave();
      } else {
        // App became visible, try to load
        setTimeout(mobileLoad, 100);
      }
    });
    
    // iOS/Android specific events
    document.addEventListener('pause', mobileSave, false); // Android
    document.addEventListener('resume', () => {
      setTimeout(mobileLoad, 100);
    }, false); // Android
    
    // Touch events for mobile save
    document.addEventListener('touchstart', () => {
      // Save on touch start (user interaction)
      mobileSave();
    }, { passive: true });

    // Add proper touch handling for all buttons
    function addProperTouchHandling() {
      // Exclude slider buttons as they have their own touch handling
      const buttons = document.querySelectorAll('.tap-scale:not(.slide-button), .continue-btn, .new-game-btn, .restart-btn, .exit-btn, .pause-modal-btn');
      
      buttons.forEach(btn => {
        let touchStarted = false;
        let touchStartedOnButton = false;
        
        const handleTouchStart = (e) => {
          touchStarted = true;
          touchStartedOnButton = btn.contains(e.target);
          if (touchStartedOnButton) {
            btn.style.transform = 'scale(0.80)';
            btn.style.transition = 'transform 0.35s ease';
          }
        };
        
        const handleTouchMove = (e) => {
          if (touchStarted && touchStartedOnButton) {
            // Check if touch moved outside button
            const touch = e.touches[0];
            const rect = btn.getBoundingClientRect();
            const isOutside = touch.clientX < rect.left || touch.clientX > rect.right || 
                             touch.clientY < rect.top || touch.clientY > rect.bottom;
            
            if (isOutside) {
              // Cancel the touch - reset button
              btn.style.transform = 'scale(1)';
              btn.style.transition = 'transform 0.35s ease';
              touchStartedOnButton = false;
            }
          }
        };
        
        const handleTouchEnd = (e) => {
          if (touchStarted && touchStartedOnButton) {
            // Only trigger if touch ended on button
            const touch = e.changedTouches[0];
            const rect = btn.getBoundingClientRect();
            const isOnButton = touch.clientX >= rect.left && touch.clientX <= rect.right && 
                              touch.clientY >= rect.top && touch.clientY <= rect.bottom;
            
            if (isOnButton && btn.onclick) {
              btn.onclick();
            }
          }
          
          // Reset button
          btn.style.transform = 'scale(1)';
          btn.style.transition = 'transform 0.35s ease';
          touchStarted = false;
          touchStartedOnButton = false;
        };
        
        const handleMouseDown = (e) => {
          if (btn.contains(e.target)) {
            btn.style.transform = 'scale(0.80)';
            btn.style.transition = 'transform 0.35s ease';
          }
        };
        
        const handleMouseUp = (e) => {
          if (btn.contains(e.target)) {
            btn.style.transform = 'scale(1)';
            btn.style.transition = 'transform 0.35s ease';
          }
        };
        
        const handleMouseLeave = () => {
          btn.style.transform = 'scale(1)';
          btn.style.transition = 'transform 0.35s ease';
        };
        
        // Add event listeners
        btn.addEventListener('touchstart', handleTouchStart, { passive: true });
        btn.addEventListener('touchmove', handleTouchMove, { passive: true });
        btn.addEventListener('touchend', handleTouchEnd, { passive: true });
        btn.addEventListener('mousedown', handleMouseDown);
        btn.addEventListener('mouseup', handleMouseUp);
        btn.addEventListener('mouseleave', handleMouseLeave);
      });
    }

  // Initialize touch handling after a delay to ensure all elements are created
  setTimeout(() => {
    addProperTouchHandling();
  }, 1000);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Export functions for external use
window.showStatsScreen = showStatsScreen;
window.hideStatsScreen = hideStatsScreen;
window.showCollectiblesScreen = showCollectiblesScreen;
window.hideCollectiblesScreen = hideCollectiblesScreen;
