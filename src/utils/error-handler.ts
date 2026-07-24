// iOS-optimized error handling
// Handles errors gracefully for App Store submission

import { container } from '../core/dependency-injection.js';
import { logger } from '../core/logger.js';

// Type definitions
interface ErrorInfo {
  message: string;
  stack: string;
  context: string;
  timestamp: string;
  userAgent: string;
  url: string;
}

interface ErrorStats {
  count: number;
  log: ErrorInfo[];
  isHealthy: boolean;
}

class ErrorHandler {
  private errorCount: number;
  private maxErrors: number;
  private errorLog: ErrorInfo[];
  private isProduction: boolean;

  constructor() {
    this.errorCount = 0;
    this.maxErrors = 10;
    this.errorLog = [];
    this.isProduction = window.location.hostname !== 'localhost';
  }

  // Main error handler
  handleError(error: Error | Event, context = 'Unknown'): void {
    // CRITICAL: Skip asset loading errors during preloader phase
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack || '' : '';
    const isGsapTeardownNullTarget =
      errorMessage.includes('Cannot set properties of null') &&
      (errorMessage.includes("setting 'y'") || errorMessage.includes("setting 'x'")) &&
      (errorStack.includes('gsap') || errorStack.includes('PropTween'));
    if (isGsapTeardownNullTarget) {
      logger.warn(`⚠️ Ignoring benign GSAP teardown race in ${context}: ${errorMessage}`);
      return;
    }

    this.capturePixiTextureCrashFingerprint(errorMessage, context);
    const isAssetError = errorMessage.includes('asset') || errorMessage.includes('loading') || errorMessage.includes('fetch');
    
    // 🔥 CRITICAL FIX: Check if app is already initialized - don't show loading screen if it is
    const isAppInitialized = (window as any).__cube_crash_ui_bootstrapped__ === true;
    
    // During preloader phase, silently ignore asset errors
    const isLoadingScreen = !!document.querySelector('#launch-screen');
    if (isLoadingScreen && isAssetError) {
      logger.info(`🔇 Silently ignoring asset error during preload: ${errorMessage}`);
      return; // Don't show error or increment counter
    }
    
    // 🔥 CRITICAL FIX: If app is initialized, don't trigger loading screen or reload
    // This prevents crash when opening stats/collectibles/settings screens after long gameplay
    const isScreenError = errorMessage.includes('stats') || 
                          errorMessage.includes('collectibles') || 
                          errorMessage.includes('settings') || 
                          errorMessage.includes('screen') ||
                          context.includes('stats') ||
                          context.includes('collectibles') ||
                          context.includes('settings');
    
    if (isAppInitialized && isScreenError) {
      logger.warn(`⚠️ Error in ${context} screen after app initialization - logging but not reloading: ${errorMessage}`);
      // Still log the error but don't increment counter or show error screen
      console.error(`${context} screen error:`, error);
      return;
    }
    
    this.errorCount++;
    
    // Log error details
    const errorInfo: ErrorInfo = {
      message: errorMessage,
      stack: error instanceof Error ? error.stack || 'No stack trace' : 'No stack trace',
      context: context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    this.errorLog.push(errorInfo);
    
    // Console logging (development only)
    if (!this.isProduction) {
      logger.error(`🚨 Error in ${context}:`, 'error-handler', error);
      logger.error('Error details:', 'error-handler', errorInfo);
    }
    
    // Prevent error spam
    if (this.errorCount > this.maxErrors) {
      logger.warn('⚠️ Too many errors, stopping error logging');
      return;
    }
    
    // Handle specific error types
    this.handleSpecificError(error, context);
  }

  private capturePixiTextureCrashFingerprint(message: string, context: string): void {
    try {
      const msg = String(message || '').toLowerCase();
      const isTextureBindCrash =
        msg.includes('addressmodeu') ||
        (msg.includes('cannot read properties of null') && msg.includes('texture')) ||
        (msg.includes('cannot read properties of null') && msg.includes('style'));
      if (!isTextureBindCrash) return;

      const w = window as any;
      const app = w?.CC?.app || null;
      const stage = w?.CC?.stage || w?.STATE?.stage || null;
      const renderer = app?.renderer || null;

      const boundTextures = (() => {
        try {
          const texSystem = renderer?.texture;
          const values = texSystem?.boundTextures ? Array.from(texSystem.boundTextures.values()) : [];
          return values.slice(0, 8).map((t: any, idx: number) => {
            const src = t?.source || t?.baseTexture || null;
            return {
              idx,
              texDestroyed: !!t?.destroyed,
              texLabel: t?.label || null,
              srcDestroyed: !!src?.destroyed,
              srcLabel: src?.label || null,
              hasStyle: src?.style != null,
              width: t?.width || src?.width || 0,
              height: t?.height || src?.height || 0
            };
          });
        } catch {
          return [];
        }
      })();

      const runtimeTextures = (() => {
        try {
          const rt = w.__ccRuntimeTextures;
          if (!rt) return [];
          const list = Array.isArray(rt) ? rt : (typeof rt.values === 'function' ? Array.from(rt.values()) : []);
          return list.slice(0, 12).map((t: any, idx: number) => {
            const src = t?.source || t?.baseTexture || null;
            return {
              idx,
              texDestroyed: !!t?.destroyed,
              texLabel: t?.label || null,
              srcDestroyed: !!src?.destroyed,
              srcLabel: src?.label || null,
              hasStyle: src?.style != null,
              width: t?.width || src?.width || 0,
              height: t?.height || src?.height || 0
            };
          });
        } catch {
          return [];
        }
      })();

      const stageInfo = {
        exists: !!stage,
        destroyed: !!stage?.destroyed,
        visible: !!stage?.visible,
        renderable: !!stage?.renderable,
        children: Array.isArray(stage?.children) ? stage.children.length : 0
      };

      logger.error('🧪 PIXI texture crash fingerprint', 'error-handler', {
        context,
        message,
        boardTransitionActive: w.__ccBoardTransitionActive === true,
        tntActive: w.__ccTntAnimationActive === true,
        stage: stageInfo,
        boundTextures,
        runtimeTextureCount: (() => {
          try {
            const rt = w.__ccRuntimeTextures;
            return Array.isArray(rt) ? rt.length : (rt?.size ?? 0);
          } catch {
            return 0;
          }
        })(),
        runtimeTextures
      });
    } catch {}
  }

  // Handle specific error types
  private handleSpecificError(error: Error | Event, context: string): void {
    const message = (error instanceof Error ? error.message : 'Unknown error').toLowerCase();
    
    // PIXI.js errors
    if (message.includes('pixi') || message.includes('webgl')) {
      this.handlePIXIError(error, context);
      return;
    }
    
    // Memory errors
    if (message.includes('memory') || message.includes('out of memory')) {
      this.handleMemoryError(error, context);
      return;
    }
    
    // Touch/gesture errors
    if (message.includes('touch') || message.includes('gesture')) {
      this.handleTouchError(error, context);
      return;
    }
    
    // Generic error handling
    this.handleGenericError(error, context);
  }

  // PIXI.js specific error handling
  private handlePIXIError(error: Error | Event, context: string): void {
    logger.warn('🎮 PIXI.js error detected, attempting recovery...');
    
    // Don't do anything during preloader phase
    const isLoadingScreen = !!document.querySelector('#launch-screen');
    if (isLoadingScreen) {
      logger.info('🔇 Skipping PIXI error handling during preloader phase');
      return;
    }
    
    // Try to recover PIXI context
    const app = container.get('app') as { destroy?: (removeView?: boolean) => void } | undefined;
    if (app && app.destroy) {
      try {
        app.destroy(true);
        logger.info('✅ PIXI app destroyed successfully');
      } catch (e) {
        logger.warn('⚠️ Failed to destroy PIXI app:', e);
      }
    }
    
    // Notify user if in production (only after preloader)
    if (this.isProduction && !isLoadingScreen) {
      this.showUserFriendlyError('Graphics error detected. Please refresh the page.');
    }
  }

  // Memory error handling
  private handleMemoryError(error: Error | Event, context: string): void {
    logger.warn('💾 Memory error detected, attempting cleanup...');
    
    // Don't do anything during preloader phase
    const isLoadingScreen = !!document.querySelector('#launch-screen');
    if (isLoadingScreen) {
      logger.info('🔇 Skipping memory error handling during preloader phase');
      return;
    }
    
    // Force garbage collection if available
    const gc = (window as any).gc as undefined | (() => void);
    if (gc) {
      try {
        gc();
        logger.info('✅ Garbage collection triggered');
      } catch (e) {
        logger.warn('⚠️ Failed to trigger garbage collection:', e);
      }
    }
    
    // Clear caches
    this.clearCaches();
    
    // Notify user (only after preloader)
    if (this.isProduction && !isLoadingScreen) {
      this.showUserFriendlyError('Memory issue detected. Please refresh the page.');
    }
  }

  // Touch error handling
  private handleTouchError(error: Error | Event, context: string): void {
    logger.warn('👆 Touch error detected, attempting recovery...');
    
    // Re-initialize touch handlers
    if (window.initDrag) {
      try {
        window.initDrag();
        logger.info('✅ Touch handlers re-initialized');
      } catch (e) {
        logger.warn('⚠️ Failed to re-initialize touch handlers:', e);
      }
    }
  }

  // Generic error handling
  private handleGenericError(error: Error | Event, context: string): void {
    logger.warn(`⚠️ Generic error in ${context}:`, error instanceof Error ? error.message : 'Unknown error');
    
    // DON'T show user-friendly message during preloader phase
    const isLoadingScreen = !!document.querySelector('#launch-screen');
    if (isLoadingScreen) {
      logger.info('🔇 Skipping error display during preloader phase');
      return;
    }
    
    // Show user-friendly message in production (only after preloader)
    if (this.isProduction && !isLoadingScreen) {
      // 🔥 CRITICAL FIX: Increase error threshold from 3 to 50 to prevent premature error screen
      // Only show error after many errors to avoid annoying user during normal gameplay
      if (this.errorCount >= 50) {
        this.showUserFriendlyError('An unexpected error occurred. Please try again.');
      }
    }
  }

  // Clear various caches
  private clearCaches(): void {
    try {
      const app = container.get('app') as { renderer?: { textureGC?: { run?: () => void } } } | undefined;
      try { app?.renderer?.textureGC?.run?.(); } catch {}

      const gsapGlobal = (window as any).gsap as undefined | { globalTimeline?: { clear: () => void } };
      if (gsapGlobal?.globalTimeline) {
        gsapGlobal.globalTimeline.clear();
      }
      
      logger.info('✅ Caches cleared successfully');
    } catch (e) {
      logger.warn('⚠️ Failed to clear caches:', e);
    }
  }

  // Show user-friendly error message
  private showUserFriendlyError(message: string): void {
    // Create error overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      color: white;
      font-family: Arial, sans-serif;
      text-align: center;
      padding: 20px;
      box-sizing: border-box;
    `;
    
    overlay.innerHTML = `
      <div>
        <h2>⚠️ Error</h2>
        <p>${message}</p>
        <button onclick="window.location.reload()" style="
          background: #007AFF;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 5px;
          cursor: pointer;
          margin-top: 10px;
        ">Refresh Page</button>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }, 10000);
  }

  // Get error statistics
  getErrorStats(): ErrorStats {
    return {
      count: this.errorCount,
      log: this.errorLog,
      isHealthy: this.errorCount < this.maxErrors
    };
  }

  // Reset error counter
  reset(): void {
    this.errorCount = 0;
    this.errorLog = [];
  }
}

// Create global error handler instance
const errorHandler = new ErrorHandler();

// Global error handlers
window.addEventListener('error', (event) => {
  const err = (event as ErrorEvent).error ?? event;
  errorHandler.handleError(err as Error, 'Global Error');
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = (event as PromiseRejectionEvent).reason;
  errorHandler.handleError(new Error(String(reason)), 'Unhandled Promise Rejection');
});

// Export for use in modules
export default errorHandler;
export { ErrorHandler };
