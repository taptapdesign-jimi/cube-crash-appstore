import { logger } from './core/logger.js';
// iOS Image Optimization Helper
// Automatically loads @2x and @3x images based on device pixel ratio

// Type definitions
interface DeviceInfo {
  pixelRatio: number;
  isRetina: boolean;
  isHighRes: boolean;
  deviceType: '@1x' | '@2x' | '@3x';
}

// Global window extensions - Window interface is now defined in src/types/window.d.ts

class IOSImageOptimizer {
  private pixelRatio: number;
  private isRetina: boolean;
  private isHighRes: boolean;

  constructor() {
    this.pixelRatio = window.devicePixelRatio || 1;
    this.isRetina = this.pixelRatio >= 2;
    this.isHighRes = this.pixelRatio >= 3;
    
    this.init();
  }
  
  private init(): void {
    // Optimize all existing images
    this.optimizeExistingImages();
    
    // Watch for new images
    this.observeNewImages();
    
    // Preload critical images
    this.preloadCriticalImages();
  }
  
  private optimizeExistingImages(): void {
    const images = document.querySelectorAll('img[src*=".png"]:not([data-ios-optimized])');
    images.forEach(img => this.optimizeImage(img as HTMLImageElement));
  }
  
  private optimizeImage(img: HTMLImageElement): void {
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
        logger.info(`📱 iOS optimized: ${baseSrc} → ${optimizedSrc}`);
      } else {
        // Fallback to original
        img.src = baseSrc;
        img.dataset.iosOptimized = 'true';
        logger.info(`📱 iOS fallback: ${baseSrc}`);
      }
    });
  }
  
  private checkImageExists(src: string): Promise<boolean> {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = src;
    });
  }
  
  private observeNewImages(): void {
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) { // Element node
            const element = node as Element;
            if (element.tagName === 'IMG' && (element as HTMLImageElement).src && (element as HTMLImageElement).src.includes('.png')) {
              this.optimizeImage(element as HTMLImageElement);
            }
            // Check child images
            const childImages = element.querySelectorAll && element.querySelectorAll('img[src*=".png"]');
            if (childImages) {
              childImages.forEach(img => this.optimizeImage(img as HTMLImageElement));
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
  
  private preloadCriticalImages(): void {
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
  
  private getOptimizedSrc(baseSrc: string): string {
    if (this.isHighRes) {
      return baseSrc.replace('.png', '@3x.png');
    } else if (this.isRetina) {
      return baseSrc.replace('.png', '@2x.png');
    }
    return baseSrc;
  }
  
  private preloadImage(src: string): void {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = src;
    document.head.appendChild(link);
  }
  
  // Public method to optimize a specific image
  optimizeImageSrc(baseSrc: string): string {
    return this.getOptimizedSrc(baseSrc);
  }
  
  // Public method to get device info
  getDeviceInfo(): DeviceInfo {
    return {
      pixelRatio: this.pixelRatio,
      isRetina: this.isRetina,
      isHighRes: this.isHighRes,
      deviceType: this.isHighRes ? '@3x' : this.isRetina ? '@2x' : '@1x'
    };
  }
}

// Auto-initialize when DOM is ready
function initializeIOSImageOptimizer(): void {
  window.iosImageOptimizer = new IOSImageOptimizer();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeIOSImageOptimizer);
} else {
  initializeIOSImageOptimizer();
}

// Export for manual use
export default IOSImageOptimizer;

