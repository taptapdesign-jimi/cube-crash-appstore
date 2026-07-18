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
    // Density variants must be declared by the component through srcset. A global
    // DPR observer used to probe `@3x` for every PNG added to the DOM; Journey adds
    // dozens of images at once, and bundled iOS paid a filesystem/scheme-handler
    // round trip for every missing variant. Vite-hashed filenames made those probes
    // impossible to satisfy (for example `logo-<hash>@3x.png`).
    //
    // Keep this helper's public device-info/source API for compatibility, but do not
    // mutate or speculatively fetch arbitrary DOM images.
  }
  
  private getOptimizedSrc(baseSrc: string): string {
    if (this.isHighRes) {
      return baseSrc.replace('.png', '@3x.png');
    } else if (this.isRetina) {
      return baseSrc.replace('.png', '@2x.png');
    }
    return baseSrc;
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
