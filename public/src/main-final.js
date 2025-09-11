// MAIN FINAL - JEDNOSTAVAN PRISTUP
console.log('🚀 Starting FINAL CubeCrash...');

// ===== GLOBAL STATE =====
let currentSlide = 0;
let isGameRunning = false;

// ===== DOM ELEMENTS =====
const home = document.getElementById('home');
const app = document.getElementById('app');
const sliderWrapper = document.getElementById('slider-wrapper');
const slides = document.querySelectorAll('.slider-slide');
const dots = document.querySelectorAll('.slider-dot');

// ===== SLIDER FUNCTIONS =====
function updateSlider() {
  if (sliderWrapper) {
    const translateX = -currentSlide * window.innerWidth;
    sliderWrapper.style.transform = `translateX(${translateX}px)`;
  }
  
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

// Touch/Mouse events
let isDragging = false;
let startX = 0;
let currentX = 0;

function getPositionX(event) {
  return event.type.includes('mouse') ? event.pageX : event.touches[0].clientX;
}

function handleStart(event) {
  if (event.type.includes('mouse')) event.preventDefault();
  isDragging = true;
  startX = getPositionX(event);
  currentX = startX;
  if (sliderWrapper) sliderWrapper.style.transition = 'none';
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
  
  if (sliderWrapper) sliderWrapper.style.transition = 'transform 0.3s ease-out';
}

// ===== GAME FUNCTIONS =====
async function startGame() {
  console.log('🎮 Starting game...');
  
  if (isGameRunning) {
    console.log('⚠️ Game already running');
    return;
  }
  
  try {
    // Hide homepage
    home.style.display = 'none';
    home.setAttribute('hidden', '');
    
    // Show game
    app.style.display = 'block';
    app.removeAttribute('hidden');
    
    // Start game
    const { boot } = await import('./modules/app.js');
    await boot();
    
    isGameRunning = true;
    console.log('✅ Game started successfully');
    
  } catch (error) {
    console.error('❌ Game start error:', error);
    showHomepage();
  }
}

function stopGame() {
  console.log('🛑 Stopping game...');
  
  if (!isGameRunning) return;
  
  try {
    // Kill everything
    if (window.app && window.app.destroy) {
      window.app.destroy(true);
      window.app = null;
    }
    
    // Clear game container
    if (app) {
      app.innerHTML = '';
      app.style.display = 'none';
      app.setAttribute('hidden', '');
    }
    
    isGameRunning = false;
    console.log('✅ Game stopped');
    
  } catch (error) {
    console.error('❌ Game stop error:', error);
    // Force reload if cleanup fails
    window.location.reload();
  }
}

function showHomepage() {
  console.log('🏠 Showing homepage...');
  
  // Kill game if running
  if (isGameRunning) {
    stopGame();
  }
  
  // Show homepage
  home.style.display = 'block';
  home.removeAttribute('hidden');
  
  // Reset slider
  currentSlide = 0;
  updateSlider();
  
  console.log('✅ Homepage shown');
}

// ===== GLOBAL FUNCTIONS =====
window.startGame = startGame;
window.exitToMenu = showHomepage;
window.showStats = () => goToSlide(1);
window.showCollectibles = () => goToSlide(2);

// ===== INITIALIZATION =====
function initialize() {
  console.log('🎯 Initializing FINAL CubeCrash...');
  
  try {
    // Setup slider events
    if (sliderWrapper) {
      sliderWrapper.addEventListener('touchstart', handleStart, { passive: false });
      sliderWrapper.addEventListener('touchmove', handleMove, { passive: false });
      sliderWrapper.addEventListener('touchend', handleEnd);
      sliderWrapper.addEventListener('mousedown', handleStart);
      sliderWrapper.addEventListener('mousemove', handleMove);
      sliderWrapper.addEventListener('mouseup', handleEnd);
      sliderWrapper.addEventListener('mouseleave', handleEnd);
    }
    
    // Setup button events
    const playButton = document.getElementById('btn-home');
    const statsButton = document.getElementById('btn-stats');
    const collectiblesButton = document.getElementById('btn-collectibles');
    
    if (playButton) {
      playButton.addEventListener('click', (e) => {
        e.stopPropagation();
        startGame();
      });
    }
    
    if (statsButton) {
      statsButton.addEventListener('click', (e) => {
        e.stopPropagation();
        goToSlide(1);
      });
    }
    
    if (collectiblesButton) {
      collectiblesButton.addEventListener('click', (e) => {
        e.stopPropagation();
        goToSlide(2);
      });
    }
    
    // Setup dot events
    dots.forEach((dot, index) => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        goToSlide(index);
      });
    });
    
    // Initial setup
    updateSlider();
    console.log('✅ FINAL CubeCrash initialized');
    
  } catch (error) {
    console.error('❌ Initialization error:', error);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

console.log('✅ FINAL CubeCrash loaded');
