// iOS-optimized error handling
// Handles errors gracefully for App Store submission

class ErrorHandler {
  constructor() {
    this.errorCount = 0;
    this.maxErrors = 10;
    this.errorLog = [];
    this.isProduction = window.location.hostname !== 'localhost';
  }

  // Main error handler
  handleError(error, context = 'Unknown') {
    this.errorCount++;
    
    // Log error details
    const errorInfo = {
      message: error.message || 'Unknown error',
      stack: error.stack || 'No stack trace',
      context: context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    this.errorLog.push(errorInfo);
    
    // Console logging (development only)
    if (!this.isProduction) {
      console.error(`🚨 Error in ${context}:`, error);
      console.error('Error details:', errorInfo);
    }
    
    // Prevent error spam
    if (this.errorCount > this.maxErrors) {
      console.warn('⚠️ Too many errors, stopping error logging');
      return;
    }
    
    // Handle specific error types
    this.handleSpecificError(error, context);
  }

  // Handle specific error types
  handleSpecificError(error, context) {
    const message = error.message.toLowerCase();
    
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
  handlePIXIError(error, context) {
    console.warn('🎮 PIXI.js error detected, attempting recovery...');
    
    // Try to recover PIXI context
    if (window.app && window.app.destroy) {
      try {
        window.app.destroy(true);
        console.log('✅ PIXI app destroyed successfully');
      } catch (e) {
        console.warn('⚠️ Failed to destroy PIXI app:', e);
      }
    }
    
    // Notify user if in production
    if (this.isProduction) {
      this.showUserFriendlyError('Graphics error detected. Please refresh the page.');
    }
  }

  // Memory error handling
  handleMemoryError(error, context) {
    console.warn('💾 Memory error detected, attempting cleanup...');
    
    // Force garbage collection if available
    if (window.gc) {
      try {
        window.gc();
        console.log('✅ Garbage collection triggered');
      } catch (e) {
        console.warn('⚠️ Failed to trigger garbage collection:', e);
      }
    }
    
    // Clear caches
    this.clearCaches();
    
    // Notify user
    if (this.isProduction) {
      this.showUserFriendlyError('Memory issue detected. Please refresh the page.');
    }
  }

  // Touch error handling
  handleTouchError(error, context) {
    console.warn('👆 Touch error detected, attempting recovery...');
    
    // Re-initialize touch handlers
    if (window.initDrag) {
      try {
        window.initDrag();
        console.log('✅ Touch handlers re-initialized');
      } catch (e) {
        console.warn('⚠️ Failed to re-initialize touch handlers:', e);
      }
    }
  }

  // Generic error handling
  handleGenericError(error, context) {
    console.warn(`⚠️ Generic error in ${context}:`, error.message);
    
    // Show user-friendly message in production
    if (this.isProduction) {
      this.showUserFriendlyError('An unexpected error occurred. Please try again.');
    }
  }

  // Clear various caches
  clearCaches() {
    try {
      // Clear PIXI texture cache
      if (window.PIXI && window.PIXI.utils && window.PIXI.utils.destroyTextureCache) {
        window.PIXI.utils.destroyTextureCache();
      }
      
      // Clear GSAP cache
      if (window.gsap && window.gsap.globalTimeline) {
        window.gsap.globalTimeline.clear();
      }
      
      console.log('✅ Caches cleared successfully');
    } catch (e) {
      console.warn('⚠️ Failed to clear caches:', e);
    }
  }

  // Show user-friendly error message
  showUserFriendlyError(message) {
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
  getErrorStats() {
    return {
      count: this.errorCount,
      log: this.errorLog,
      isHealthy: this.errorCount < this.maxErrors
    };
  }

  // Reset error counter
  reset() {
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
