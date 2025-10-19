// iOS Image Optimization Helper
// Automatically loads @2x and @3x images based on device pixel ratio

class IOSImageOptimizer {
  constructor() {
    this.pixelRatio = window.devicePixelRatio || 1;
    this.isRetina = this.pixelRatio >= 2;
    this.isHighRes = this.pixelRatio >= 3;
    
    this.init();
  }
  
  init() {
    // Optimize all existing images
    this.optimizeExistingImages();
    
    // Watch for new images
    this.observeNewImages();
    
    // Preload critical images
    this.preloadCriticalImages();
  }
  
  optimizeExistingImages() {
    const images = document.querySelectorAll('img[src*=".png"]:not([data-ios-optimized])');
    images.forEach(img => this.optimizeImage(img));
  }
  
  optimizeImage(img) {
    if (img.dataset.iosOptimized) return;
    
    const originalSrc = img.src;
    const baseSrc = originalSrc.replace(/@[23]x\.png$/, '.png');
    
    let optimizedSrc = baseSrc;
    
    if (this.isHighRes) {
      // Use @3x for high-resolution displays
      optimizedSrc = baseSrc.replace('.png', '@3x.png');
    } else if (this.isRetina) {
      // Use @2x for Retina displays
      optimizedSrc = baseSrc.replace('.png', '@2x.png');
    }
    
    // Check if optimized version exists
    this.checkImageExists(optimizedSrc).then(exists => {
      if (exists) {
        img.src = optimizedSrc;
        img.dataset.iosOptimized = 'true';
        console.log(`📱 iOS optimized: ${baseSrc} → ${optimizedSrc}`);
      } else {
        // Fallback to original
        img.src = baseSrc;
        img.dataset.iosOptimized = 'true';
        console.log(`📱 iOS fallback: ${baseSrc}`);
      }
    });
  }
  
  checkImageExists(src) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = src;
    });
  }
  
  observeNewImages() {
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) { // Element node
            if (node.tagName === 'IMG' && node.src && node.src.includes('.png')) {
              this.optimizeImage(node);
            }
            // Check child images
            const childImages = node.querySelectorAll && node.querySelectorAll('img[src*=".png"]');
            if (childImages) {
              childImages.forEach(img => this.optimizeImage(img));
            }
          }
        });
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  preloadCriticalImages() {
    const criticalImages = [
      'assets/logo-cube-crash.png',
      'assets/main-screen.png',
      'assets/tile.png',
      'assets/wild.png',
      'assets/gold-coin.png'
    ];
    
    criticalImages.forEach(baseSrc => {
      const optimizedSrc = this.getOptimizedSrc(baseSrc);
      this.preloadImage(optimizedSrc);
    });
  }
  
  getOptimizedSrc(baseSrc) {
    if (this.isHighRes) {
      return baseSrc.replace('.png', '@3x.png');
    } else if (this.isRetina) {
      return baseSrc.replace('.png', '@2x.png');
    }
    return baseSrc;
  }
  
  preloadImage(src) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = src;
    document.head.appendChild(link);
  }
  
  // Public method to optimize a specific image
  optimizeImageSrc(baseSrc) {
    return this.getOptimizedSrc(baseSrc);
  }
  
  // Public method to get device info
  getDeviceInfo() {
    return {
      pixelRatio: this.pixelRatio,
      isRetina: this.isRetina,
      isHighRes: this.isHighRes,
      deviceType: this.isHighRes ? '@3x' : this.isRetina ? '@2x' : '@1x'
    };
  }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.iosImageOptimizer = new IOSImageOptimizer();
  });
} else {
  window.iosImageOptimizer = new IOSImageOptimizer();
}

// Export for manual use
export default IOSImageOptimizer;
