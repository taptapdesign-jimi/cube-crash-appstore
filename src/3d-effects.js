// 3D Effects Helper for CubeCrash
// Handles 3D animations for tiles, board, and explosions

class ThreeDEffects {
  constructor() {
    this.isEnabled = this.check3DSupport();
    this.init();
  }

  check3DSupport() {
    // Check if browser supports 3D transforms
    const testEl = document.createElement('div');
    const transforms = [
      'perspective',
      'transform-style',
      'transform3d',
      'translateZ',
      'rotateX',
      'rotateY'
    ];
    
    const style = testEl.style;
    return transforms.every(prop => 
      prop in style || 
      `-webkit-${prop}` in style || 
      `-moz-${prop}` in style
    );
  }

  init() {
    if (!this.isEnabled) {
      console.warn('⚠️ 3D effects not supported, falling back to 2D');
      return;
    }

    console.log('🎯 3D effects enabled');
    this.setupBoard3D();
    this.setupTile3D();
  }

  setupBoard3D() {
    // Add 3D container class to board
    const app = document.getElementById('app');
    if (app) {
      app.classList.add('board-container');
    }
  }

  setupTile3D() {
    // Add 3D classes to existing tiles
    const tiles = document.querySelectorAll('.tile');
    tiles.forEach(tile => this.add3DToTile(tile));
  }

  add3DToTile(tile) {
    if (!this.isEnabled) return;
    
    tile.classList.add('tile-3d');
    
    // Add data attributes for depth
    const value = tile.getAttribute('data-value') || '1';
    tile.setAttribute('data-value', value);
    
    // Add wild class if needed
    if (tile.classList.contains('wild')) {
      tile.classList.add('wild-3d');
    }
  }

  // 3D Merge Animation
  animateMerge(tile1, tile2, callback) {
    if (!this.isEnabled) {
      if (callback) callback();
      return;
    }

    const tiles = [tile1, tile2];
    
    // Add merging class
    tiles.forEach(tile => {
      tile.classList.add('merging');
    });

    // Remove classes after animation
    setTimeout(() => {
      tiles.forEach(tile => {
        tile.classList.remove('merging');
      });
      if (callback) callback();
    }, 800);
  }

  // 3D Explosion Animation
  animateExplosion(tile, callback) {
    if (!this.isEnabled) {
      if (callback) callback();
      return;
    }

    tile.classList.add('exploding');

    setTimeout(() => {
      tile.classList.remove('exploding');
      if (callback) callback();
    }, 1200);
  }

  // 3D Jump Animation
  animateJump(tile, callback) {
    if (!this.isEnabled) {
      if (callback) callback();
      return;
    }

    tile.classList.add('jumping');

    setTimeout(() => {
      tile.classList.remove('jumping');
      if (callback) callback();
    }, 600);
  }

  // 3D Wild Cube Pulse
  animateWildPulse(tile) {
    if (!this.isEnabled) return;

    tile.classList.add('wild-3d-pulse');
  }

  stopWildPulse(tile) {
    tile.classList.remove('wild-3d-pulse');
  }

  // 3D Board Tilt
  setBoardTilt(angleX = 20, angleY = 0) {
    if (!this.isEnabled) return;

    const board = document.querySelector('.board-container');
    if (board) {
      board.style.transform = `rotateX(${angleX}deg) rotateY(${angleY}deg)`;
    }
  }

  // 3D Tile Hover Effect
  addHoverEffect(tile) {
    if (!this.isEnabled) return;

    tile.addEventListener('mouseenter', () => {
      tile.classList.add('hover-3d');
    });

    tile.addEventListener('mouseleave', () => {
      tile.classList.remove('hover-3d');
    });
  }

  // 3D Depth Layers
  setTileDepth(tile, depth) {
    if (!this.isEnabled) return;

    tile.style.transform = `translateZ(${depth}px)`;
  }

  // 3D Shadow Effect
  addShadowEffect(tile, intensity = 0.2) {
    if (!this.isEnabled) return;

    const shadow = `0 10px 30px rgba(0, 0, 0, ${intensity})`;
    tile.style.boxShadow = shadow;
  }

  // Performance optimization
  optimizeForPerformance() {
    if (!this.isEnabled) return;

    // Reduce motion for low-end devices
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    if (prefersReducedMotion) {
      document.documentElement.style.setProperty('--board-tilt', '10deg');
      document.documentElement.style.setProperty('--tile-3d-depth', '10px');
    }

    // Disable 3D on very small screens
    if (window.innerWidth < 480) {
      this.isEnabled = false;
      console.log('📱 3D effects disabled for small screen');
    }
  }

  // Public API
  get is3DEnabled() {
    return this.isEnabled;
  }

  get deviceInfo() {
    return {
      supports3D: this.isEnabled,
      pixelRatio: window.devicePixelRatio || 1,
      screenSize: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    };
  }
}

// Auto-initialize
let threeDEffects;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    threeDEffects = new ThreeDEffects();
    window.threeDEffects = threeDEffects;
  });
} else {
  threeDEffects = new ThreeDEffects();
  window.threeDEffects = threeDEffects;
}

// Export for manual use
export default ThreeDEffects;
