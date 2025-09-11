// MAIN SIMPLE SEPARATED - HOMEPAGE I IGRA POTPUNO ODAVOJENI
console.log('🚀 Starting SIMPLE SEPARATED CubeCrash...');

// ===== GLOBAL STATE =====
let currentSlide = 0;
let isGameRunning = false;
let gameInstance = null;

// ===== DOM ELEMENTS =====
const homeElement = document.getElementById('home');
const gameElement = document.getElementById('app');
const sliderWrapper = document.getElementById('slider-wrapper');
const slides = document.querySelectorAll('.slider-slide');
const dots = document.querySelectorAll('.slider-dot');

// ===== HOMEPAGE FUNCTIONS =====
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
  if (slideIndex >= 0 && slideIndex < slides.length) {
    currentSlide = slideIndex;
    updateSlider();
  }
}

// Touch/Mouse events for slider
let isDragging = false;
let startX = 0;
let currentX = 0;

function getPositionX(event) {
  return event.type.includes('mouse') ? event.pageX : event.touches[0].clientX;
}

function handleStart(event) {
  if (event.type.includes('mouse')) {
    event.preventDefault();
  }
  isDragging = true;
  startX = getPositionX(event);
  currentX = startX;
  if (sliderWrapper) {
    sliderWrapper.style.transition = 'none';
  }
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
  
  if (sliderWrapper) {
    sliderWrapper.style.transition = 'transform 0.3s ease-out';
  }
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
    homeElement.style.display = 'none';
    homeElement.setAttribute('hidden', '');
    
    // Show game
    gameElement.style.display = 'block';
    gameElement.removeAttribute('hidden');
    
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
    // Try to cleanup existing game
    if (window.app && window.app.destroy) {
      window.app.destroy(true);
      window.app = null;
    }
    
    // Clear game container
    if (gameElement) {
      gameElement.innerHTML = '';
      gameElement.style.display = 'none';
      gameElement.setAttribute('hidden', '');
    }
    
    isGameRunning = false;
    console.log('✅ Game stopped');
    
  } catch (error) {
    console.error('❌ Game stop error:', error);
    // Fallback to reload
    window.location.reload();
  }
}

function showHomepage() {
  console.log('🏠 Showing homepage...');
  
  // Stop game if running
  if (isGameRunning) {
    stopGame();
  }
  
  // Show homepage
  homeElement.style.display = 'block';
  homeElement.removeAttribute('hidden');
  
  // Reset slider
  currentSlide = 0;
  updateSlider();
}

// ===== GLOBAL FUNCTIONS =====
window.startGame = startGame;
window.exitToMenu = showHomepage;
window.showStats = () => goToSlide(1);
window.showCollectibles = () => goToSlide(2);

// ===== INITIALIZATION =====
function initialize() {
  console.log('🎯 Initializing SIMPLE SEPARATED CubeCrash...');
  
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
    console.log('✅ SIMPLE SEPARATED CubeCrash initialized');
    
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

console.log('✅ SIMPLE SEPARATED CubeCrash loaded');
