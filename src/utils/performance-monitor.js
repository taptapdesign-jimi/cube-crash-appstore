// iOS-optimized performance monitoring
// Monitors performance for App Store submission

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      fps: 0,
      memoryUsage: 0,
      frameTime: 0,
      drawCalls: 0,
      textureMemory: 0
    };
    
    this.isMonitoring = false;
    this.frameCount = 0;
    this.lastTime = 0;
    this.fpsHistory = [];
    this.memoryHistory = [];
    
    // iOS-specific thresholds
    this.thresholds = {
      minFPS: 30,        // Minimum FPS for smooth gameplay
      maxMemory: 100,    // Maximum memory usage in MB
      maxFrameTime: 33,  // Maximum frame time in ms (30 FPS)
      maxDrawCalls: 100  // Maximum draw calls per frame
    };
    
    this.warnings = [];
  }

  // Start monitoring
  start() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.lastTime = performance.now();
    
    // Start FPS monitoring
    this.startFPSMonitoring();
    
    // Start memory monitoring
    this.startMemoryMonitoring();
    
    // Start PIXI monitoring
    this.startPIXIMonitoring();
    
    console.log('📊 Performance monitoring started');
  }

  // Stop monitoring
  stop() {
    this.isMonitoring = false;
    console.log('📊 Performance monitoring stopped');
  }

  // FPS monitoring
  startFPSMonitoring() {
    const measureFPS = (currentTime) => {
      if (!this.isMonitoring) return;
      
      this.frameCount++;
      const deltaTime = currentTime - this.lastTime;
      
      if (deltaTime >= 1000) { // Update every second
        this.metrics.fps = Math.round((this.frameCount * 1000) / deltaTime);
        this.fpsHistory.push(this.metrics.fps);
        
        // Keep only last 10 seconds
        if (this.fpsHistory.length > 10) {
          this.fpsHistory.shift();
        }
        
        // Check FPS threshold
        if (this.metrics.fps < this.thresholds.minFPS) {
          this.addWarning('Low FPS', `FPS: ${this.metrics.fps} (min: ${this.thresholds.minFPS})`);
        }
        
        this.frameCount = 0;
        this.lastTime = currentTime;
      }
      
      requestAnimationFrame(measureFPS);
    };
    
    requestAnimationFrame(measureFPS);
  }

  // Memory monitoring
  startMemoryMonitoring() {
    const measureMemory = () => {
      if (!this.isMonitoring) return;
      
      // Get memory info if available
      if (performance.memory) {
        this.metrics.memoryUsage = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
        this.memoryHistory.push(this.metrics.memoryUsage);
        
        // Keep only last 10 measurements
        if (this.memoryHistory.length > 10) {
          this.memoryHistory.shift();
        }
        
        // Check memory threshold
        if (this.metrics.memoryUsage > this.thresholds.maxMemory) {
          this.addWarning('High Memory Usage', `Memory: ${this.metrics.memoryUsage}MB (max: ${this.thresholds.maxMemory}MB)`);
        }
      }
      
      setTimeout(measureMemory, 1000);
    };
    
    measureMemory();
  }

  // PIXI monitoring
  startPIXIMonitoring() {
    // Monitor PIXI app if available
    const monitorPIXI = () => {
      if (!this.isMonitoring) return;
      
      try {
        // Check if PIXI app exists and has stage
        if (window.app && window.app.stage && window.app.stage.children) {
          // Get PIXI stats
          const stats = window.app.stage.children.length;
          this.metrics.drawCalls = stats;
          
          // Check draw calls threshold
          if (stats > this.thresholds.maxDrawCalls) {
            this.addWarning('High Draw Calls', `Draw calls: ${stats} (max: ${this.thresholds.maxDrawCalls})`);
          }
          
          // Get texture memory if available
          if (window.PIXI && window.PIXI.utils && window.PIXI.utils.destroyTextureCache) {
            // This is a rough estimate
            this.metrics.textureMemory = Math.round(stats * 0.1); // Estimate 0.1MB per draw call
          }
        } else {
          // PIXI app not ready yet, reset metrics
          this.metrics.drawCalls = 0;
          this.metrics.textureMemory = 0;
        }
        
      } catch (error) {
        // Silently handle PIXI monitoring errors to avoid spam
        this.metrics.drawCalls = 0;
        this.metrics.textureMemory = 0;
      }
      
      setTimeout(monitorPIXI, 1000);
    };
    
    monitorPIXI();
  }

  // Add performance warning
  addWarning(type, message) {
    const warning = {
      type,
      message,
      timestamp: new Date().toISOString()
    };
    
    this.warnings.push(warning);
    
    // Keep only last 50 warnings
    if (this.warnings.length > 50) {
      this.warnings.shift();
    }
    
    console.warn(`⚠️ Performance Warning: ${type} - ${message}`);
  }

  // Get current metrics
  getMetrics() {
    return {
      ...this.metrics,
      averageFPS: this.getAverageFPS(),
      averageMemory: this.getAverageMemory(),
      warningCount: this.warnings.length,
      isHealthy: this.isHealthy()
    };
  }

  // Get average FPS
  getAverageFPS() {
    if (this.fpsHistory.length === 0) return 0;
    return Math.round(this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length);
  }

  // Get average memory usage
  getAverageMemory() {
    if (this.memoryHistory.length === 0) return 0;
    return Math.round(this.memoryHistory.reduce((a, b) => a + b, 0) / this.memoryHistory.length);
  }

  // Check if performance is healthy
  isHealthy() {
    return (
      this.metrics.fps >= this.thresholds.minFPS &&
      this.metrics.memoryUsage <= this.thresholds.maxMemory &&
      this.metrics.drawCalls <= this.thresholds.maxDrawCalls &&
      this.warnings.length < 10
    );
  }

  // Get performance report
  getReport() {
    return {
      metrics: this.getMetrics(),
      warnings: this.warnings,
      thresholds: this.thresholds,
      isHealthy: this.isHealthy(),
      recommendations: this.getRecommendations()
    };
  }

  // Get performance recommendations
  getRecommendations() {
    const recommendations = [];
    
    if (this.metrics.fps < this.thresholds.minFPS) {
      recommendations.push('Consider reducing visual effects or lowering quality settings');
    }
    
    if (this.metrics.memoryUsage > this.thresholds.maxMemory) {
      recommendations.push('Consider clearing unused textures or reducing asset quality');
    }
    
    if (this.metrics.drawCalls > this.thresholds.maxDrawCalls) {
      recommendations.push('Consider batching draw calls or reducing object count');
    }
    
    if (this.warnings.length > 10) {
      recommendations.push('Multiple performance issues detected, consider optimization');
    }
    
    return recommendations;
  }

  // Clear warnings
  clearWarnings() {
    this.warnings = [];
  }

  // Reset all metrics
  reset() {
    this.metrics = {
      fps: 0,
      memoryUsage: 0,
      frameTime: 0,
      drawCalls: 0,
      textureMemory: 0
    };
    
    this.fpsHistory = [];
    this.memoryHistory = [];
    this.warnings = [];
    this.frameCount = 0;
    this.lastTime = 0;
  }
}

// Create global performance monitor instance
const performanceMonitor = new PerformanceMonitor();

// Export for use in modules
export default performanceMonitor;
export { PerformanceMonitor };
