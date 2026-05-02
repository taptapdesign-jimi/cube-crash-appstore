// App Store compliance utilities
export class AppStoreCompliance {
  private static instance: AppStoreCompliance;
  private isCompliant: boolean = true;
  private isInitialized: boolean = false;

  static getInstance(): AppStoreCompliance {
    if (!AppStoreCompliance.instance) {
      AppStoreCompliance.instance = new AppStoreCompliance();
    }
    return AppStoreCompliance.instance;
  }

  init(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.checkCompliance();
    this.setupComplianceMonitoring();
  }

  private checkCompliance(): void {
    // Check for required PWA features
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker not supported - PWA compliance may be affected');
    }

    // Check for required APIs
    if (!('localStorage' in window)) {
      console.warn('LocalStorage not supported - App Store compliance may be affected');
    }

    // Check for required performance APIs
    if (!('PerformanceObserver' in window)) {
      console.warn('PerformanceObserver not supported - Performance monitoring may be affected');
    }
  }

  // 🔥 FIX: Store interval ID for cleanup
  private complianceIntervalId: ReturnType<typeof setInterval> | null = null;
  
  private setupComplianceMonitoring(): void {
    if (this.complianceIntervalId !== null) {
      clearInterval(this.complianceIntervalId);
      this.complianceIntervalId = null;
    }
    // Monitor for compliance issues
    this.complianceIntervalId = setInterval(() => {
      this.checkCompliance();
    }, 60000); // Check every minute
  }
  
  // 🔥 FIX: Add destroy method to clean up interval
  destroy(): void {
    this.isInitialized = false;
    if (this.complianceIntervalId !== null) {
      clearInterval(this.complianceIntervalId);
      this.complianceIntervalId = null;
    }
  }

  isAppStoreReady(): boolean {
    return this.isCompliant;
  }

  getComplianceReport(): Record<string, boolean> {
    return {
      serviceWorker: 'serviceWorker' in navigator,
      localStorage: 'localStorage' in window,
      performanceObserver: 'PerformanceObserver' in window,
      webGL: 'WebGLRenderingContext' in window,
      canvas: 'HTMLCanvasElement' in window,
      audio: 'AudioContext' in window || 'webkitAudioContext' in window
    };
  }
}
