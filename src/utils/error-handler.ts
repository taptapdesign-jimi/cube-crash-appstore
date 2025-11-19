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

// Global window extensions
declare global {
  interface Window {
    app?: {
      destroy?: (removeView?: boolean) => void;
    };
    gc?: () => void;
    initDrag?: () => void;
    PIXI?: {
      utils?: {
        destroyTextureCache: () => void;
      };
    };
    gsap?: {
      globalTimeline?: {
        clear: () => void;
      };
    };
  }
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
    const isAssetError = errorMessage.includes('asset') || errorMessage.includes('loading') || errorMessage.includes('fetch');
    
    // 🔥 CRITICAL FIX: Check if app is already initialized - don't show loading screen if it is
    const isAppInitialized = (window as any).__cube_crash_ui_bootstrapped__ === true;
    
    // During preloader phase, silently ignore asset errors
    const isLoadingScreen = document.querySelector('.loading-screen') && !document.querySelector('.loading-screen.hidden');
    if (isLoadingScreen && isAssetError) {
      logger.info(`🔇 Silently ignoring asset error during preload: ${errorMessage}`);
      return; // Don't show error or increment counter
    }
    
    // 🔥 CRITICAL FIX: If app is initialized, don't trigger loading screen or reload
    // This prevents crash when opening stats screen after long gameplay
    if (isAppInitialized && (errorMessage.includes('stats') || errorMessage.includes('screen') || context.includes('stats'))) {
      logger.warn(`⚠️ Error in stats screen after app initialization - logging but not reloading: ${errorMessage}`);
      // Still log the error but don't increment counter or show error screen
      console.error('Stats screen error:', error);
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
      logger.error(`🚨 Error in ${context}:`, error);
      logger.error('Error details:', errorInfo);
    }
    
    // Prevent error spam
    if (this.errorCount > this.maxErrors) {
      logger.warn('⚠️ Too many errors, stopping error logging');
      return;
    }
    
    // Handle specific error types
    this.handleSpecificError(error, context);
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
    const isLoadingScreen = document.querySelector('.loading-screen') && !document.querySelector('.loading-screen.hidden');
    if (isLoadingScreen) {
      logger.info('🔇 Skipping PIXI error handling during preloader phase');
      return;
    }
    
    // Try to recover PIXI context
    const app = container.get('app');
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
    const isLoadingScreen = document.querySelector('.loading-screen') && !document.querySelector('.loading-screen.hidden');
    if (isLoadingScreen) {
      logger.info('🔇 Skipping memory error handling during preloader phase');
      return;
    }
    
    // Force garbage collection if available
    if (window.gc) {
      try {
        window.gc();
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
    const isLoadingScreen = document.querySelector('.loading-screen') && !document.querySelector('.loading-screen.hidden');
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
      // Clear PIXI texture cache
      if (window.PIXI && window.PIXI.utils && window.PIXI.utils.destroyTextureCache) {
        window.PIXI.utils.destroyTextureCache();
      }
      
      // Clear GSAP cache
      if (window.gsap && window.gsap.globalTimeline) {
        window.gsap.globalTimeline.clear();
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
  errorHandler.handleError(event.error, 'Global Error');
});

window.addEventListener('unhandledrejection', (event) => {
  errorHandler.handleError(new Error(event.reason), 'Unhandled Promise Rejection');
});

// Export for use in modules
export default errorHandler;
export { ErrorHandler };