// @ts-nocheck
// Enhanced Memory Manager - Centralized cleanup for App Store readiness
// Handles timers, event listeners, GSAP tweens, and PIXI objects

import { logger } from './logger.js';
import { gsap } from 'gsap';

// Type definitions
interface TimerData {
  id: ReturnType<typeof setTimeout>;
  type: 'timeout' | 'interval';
  callback: Function;
  delay: number;
  createdAt: number;
  stack?: string;
}

interface ListenerData {
  element: EventTarget;
  event: string;
  handler: EventListener;
  options?: AddEventListenerOptions;
  createdAt: number;
}

interface TweenData {
  target: any;
  tween: any;
  type: 'to' | 'from' | 'fromTo' | 'timeline';
  createdAt: number;
}

interface MemoryStats {
  timers: {
    timeouts: number;
    intervals: number;
    total: number;
  };
  listeners: number;
  tweens: number;
  memoryUsageMB: number;
  isHealthy: boolean;
  leakScore: number; // 0-100, lower is better
}

class EnhancedMemoryManager {
  // Timer tracking
  private timeouts: Map<number, TimerData>;
  private intervals: Map<number, TimerData>;
  private timerIdCounter: number;

  // Event listener tracking
  private listeners: Map<string, ListenerData>;
  private listenerCounter: number;

  // GSAP tween tracking
  private tweens: Map<string, TweenData>;
  private tweenCounter: number;

  // Cleanup callbacks
  private cleanupCallbacks: Set<() => void>;

  // Monitoring
  private isMonitoring: boolean;
  private monitorInterval: ReturnType<typeof setInterval> | null;
  private startTime: number;

  // Config
  private config = {
    monitorIntervalMs: 10000, // Check every 10 seconds
    autoCleanupEnabled: true,
    maxTimers: 500,
    maxListeners: 300,
    maxTweens: 1000,
    memoryThresholdMB: 150,
    cleanupOldTimersAfterMs: 300000, // 5 minutes
  };

  constructor() {
    this.timeouts = new Map();
    this.intervals = new Map();
    this.timerIdCounter = 0;

    this.listeners = new Map();
    this.listenerCounter = 0;

    this.tweens = new Map();
    this.tweenCounter = 0;

    this.cleanupCallbacks = new Set();

    this.isMonitoring = false;
    this.monitorInterval = null;
    this.startTime = Date.now();

    // Monkey patch setTimeout/setInterval for automatic tracking
    this.patchTimers();

    // Monkey patch addEventListener for automatic tracking
    this.patchEventListeners();

    // Monkey patch GSAP for automatic tracking
    this.patchGSAP();
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  init(): void {
    if (this.isMonitoring) {
      logger.warn('Enhanced Memory Manager already initialized');
      return;
    }

    this.isMonitoring = true;
    this.startMonitoring();
    logger.info('🚀 Enhanced Memory Manager initialized');
    this.logStats();
  }

  private startMonitoring(): void {
    this.monitorInterval = setInterval(() => {
      if (!this.isMonitoring) return;

      const stats = this.getStats();
      
      // Auto cleanup if thresholds exceeded
      if (this.config.autoCleanupEnabled) {
        if (stats.timers.total > this.config.maxTimers) {
          logger.warn(`⚠️ Timer limit exceeded: ${stats.timers.total}/${this.config.maxTimers}`);
          this.cleanupOldTimers();
        }

        if (stats.listeners > this.config.maxListeners) {
          logger.warn(`⚠️ Listener limit exceeded: ${stats.listeners}/${this.config.maxListeners}`);
          this.cleanupOldListeners();
        }

        if (stats.tweens > this.config.maxTweens) {
          logger.warn(`⚠️ Tween limit exceeded: ${stats.tweens}/${this.config.maxTweens}`);
          this.cleanupOldTweens();
        }

        if (stats.memoryUsageMB > this.config.memoryThresholdMB) {
          logger.warn(`⚠️ Memory threshold exceeded: ${stats.memoryUsageMB}MB/${this.config.memoryThresholdMB}MB`);
          this.performFullCleanup();
        }
      }

      // Log stats every minute
      if ((Date.now() - this.startTime) % 60000 < this.config.monitorIntervalMs) {
        this.logStats();
      }
    }, this.config.monitorIntervalMs);
  }

  // ============================================================
  // TIMER MANAGEMENT (setTimeout/setInterval)
  // ============================================================

  private patchTimers(): void {
    const originalSetTimeout = window.setTimeout;
    const originalSetInterval = window.setInterval;
    const originalClearTimeout = window.clearTimeout;
    const originalClearInterval = window.clearInterval;

    const self = this;

    // Patch setTimeout
    (window as any).setTimeout = function(callback: Function, delay: number, ...args: any[]) {
      const id = originalSetTimeout.call(window, function() {
        self.timeouts.delete(id as any);
        callback.apply(this, args);
      }, delay, ...args);

      if (self.isMonitoring) {
        self.timeouts.set(id as any, {
          id: id as any,
          type: 'timeout',
          callback,
          delay,
          createdAt: Date.now(),
          stack: new Error().stack
        });
      }

      return id;
    };

    // Patch setInterval
    (window as any).setInterval = function(callback: Function, delay: number, ...args: any[]) {
      const id = originalSetInterval.call(window, callback, delay, ...args);

      if (self.isMonitoring) {
        self.intervals.set(id as any, {
          id: id as any,
          type: 'interval',
          callback,
          delay,
          createdAt: Date.now(),
          stack: new Error().stack
        });
      }

      return id;
    };

    // Patch clearTimeout
    (window as any).clearTimeout = function(id: any) {
      self.timeouts.delete(id);
      return originalClearTimeout.call(window, id);
    };

    // Patch clearInterval
    (window as any).clearInterval = function(id: any) {
      self.intervals.delete(id);
      return originalClearInterval.call(window, id);
    };
  }

  cleanupOldTimers(): void {
    const now = Date.now();
    let cleaned = 0;

    // Cleanup old timeouts (older than threshold)
    for (const [id, data] of this.timeouts.entries()) {
      if (now - data.createdAt > this.config.cleanupOldTimersAfterMs) {
        clearTimeout(data.id);
        this.timeouts.delete(id);
        cleaned++;
      }
    }

    logger.info(`🧹 Cleaned up ${cleaned} old timers`);
  }

  clearAllTimers(): void {
    // Clear all timeouts
    for (const [id, data] of this.timeouts.entries()) {
      clearTimeout(data.id);
    }
    this.timeouts.clear();

    // Clear all intervals
    for (const [id, data] of this.intervals.entries()) {
      clearInterval(data.id);
    }
    this.intervals.clear();

    logger.info('✅ Cleared all timers');
  }

  // ============================================================
  // EVENT LISTENER MANAGEMENT
  // ============================================================

  private patchEventListeners(): void {
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    const originalRemoveEventListener = EventTarget.prototype.removeEventListener;
    const self = this;

    EventTarget.prototype.addEventListener = function(
      event: string,
      handler: EventListener,
      options?: boolean | AddEventListenerOptions
    ) {
      originalAddEventListener.call(this, event, handler, options);

      if (self.isMonitoring) {
        const key = `listener_${self.listenerCounter++}`;
        self.listeners.set(key, {
          element: this,
          event,
          handler,
          options: typeof options === 'object' ? options : undefined,
          createdAt: Date.now()
        });
      }
    };

    EventTarget.prototype.removeEventListener = function(
      event: string,
      handler: EventListener,
      options?: boolean | AddEventListenerOptions
    ) {
      originalRemoveEventListener.call(this, event, handler, options);

      if (self.isMonitoring) {
        // Find and remove from tracking
        for (const [key, data] of self.listeners.entries()) {
          if (data.element === this && data.event === event && data.handler === handler) {
            self.listeners.delete(key);
            break;
          }
        }
      }
    };
  }

  cleanupOldListeners(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, data] of this.listeners.entries()) {
      // Cleanup listeners older than 5 minutes
      if (now - data.createdAt > this.config.cleanupOldTimersAfterMs) {
        try {
          data.element.removeEventListener(data.event, data.handler, data.options);
          this.listeners.delete(key);
          cleaned++;
        } catch (error) {
          // Element might be gone, just remove from tracking
          this.listeners.delete(key);
          cleaned++;
        }
      }
    }

    logger.info(`🧹 Cleaned up ${cleaned} old event listeners`);
  }

  clearAllListeners(): void {
    for (const [key, data] of this.listeners.entries()) {
      try {
        data.element.removeEventListener(data.event, data.handler, data.options);
      } catch (error) {
        // Ignore errors
      }
    }
    this.listeners.clear();
    logger.info('✅ Cleared all event listeners');
  }

  // ============================================================
  // GSAP TWEEN MANAGEMENT
  // ============================================================

  private patchGSAP(): void {
    if (typeof gsap === 'undefined') {
      logger.warn('GSAP not available for patching');
      return;
    }

    const self = this;
    const originalTo = gsap.to;
    const originalFrom = gsap.from;
    const originalFromTo = gsap.fromTo;

    // Patch gsap.to
    gsap.to = function(target: any, vars: any) {
      const tween = originalTo.call(gsap, target, vars);

      if (self.isMonitoring) {
        const key = `tween_${self.tweenCounter++}`;
        self.tweens.set(key, {
          target,
          tween,
          type: 'to',
          createdAt: Date.now()
        });

        // Auto-cleanup on complete
        if (tween && tween.eventCallback) {
          const originalOnComplete = vars.onComplete;
          tween.eventCallback('onComplete', () => {
            self.tweens.delete(key);
            if (originalOnComplete) originalOnComplete();
          });
        }
      }

      return tween;
    };

    // Patch gsap.from
    gsap.from = function(target: any, vars: any) {
      const tween = originalFrom.call(gsap, target, vars);

      if (self.isMonitoring) {
        const key = `tween_${self.tweenCounter++}`;
        self.tweens.set(key, {
          target,
          tween,
          type: 'from',
          createdAt: Date.now()
        });
      }

      return tween;
    };

    // Patch gsap.fromTo
    gsap.fromTo = function(target: any, fromVars: any, toVars: any) {
      const tween = originalFromTo.call(gsap, target, fromVars, toVars);

      if (self.isMonitoring) {
        const key = `tween_${self.tweenCounter++}`;
        self.tweens.set(key, {
          target,
          tween,
          type: 'fromTo',
          createdAt: Date.now()
        });
      }

      return tween;
    };
  }

  cleanupOldTweens(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, data] of this.tweens.entries()) {
      // Cleanup tweens older than 5 minutes
      if (now - data.createdAt > this.config.cleanupOldTimersAfterMs) {
        try {
          if (data.tween && data.tween.kill) {
            data.tween.kill();
          } else {
            gsap.killTweensOf(data.target);
          }
          this.tweens.delete(key);
          cleaned++;
        } catch (error) {
          // Ignore errors
          this.tweens.delete(key);
        }
      }
    }

    logger.info(`🧹 Cleaned up ${cleaned} old GSAP tweens`);
  }

  clearAllTweens(): void {
    for (const [key, data] of this.tweens.entries()) {
      try {
        if (data.tween && data.tween.kill) {
          data.tween.kill();
        } else {
          gsap.killTweensOf(data.target);
        }
      } catch (error) {
        // Ignore errors
      }
    }
    this.tweens.clear();
    this.clearInvalidGlobalTweens();
    logger.info('✅ Cleared all GSAP tweens');
  }

  private clearInvalidGlobalTweens(): void {
    try {
      const children = gsap.globalTimeline?.getChildren?.(true, true, true) || [];
      children.forEach((tween: any) => {
        try {
          if (!tween || typeof tween.kill !== 'function') return;
          const targets =
            typeof tween.targets === 'function'
              ? tween.targets()
              : Array.isArray(tween.targets)
                ? tween.targets
                : [];
          if (targets.some((target: any) => target?.destroyed === true)) {
            tween.kill();
          }
        } catch {}
      });
    } catch {}
  }

  // ============================================================
  // FULL CLEANUP
  // ============================================================

  performFullCleanup(): void {
    logger.info('🧹 Performing full memory cleanup...');

    this.cleanupOldTimers();
    this.cleanupOldListeners();
    this.cleanupOldTweens();

    // Run custom cleanup callbacks
    for (const callback of this.cleanupCallbacks) {
      try {
        callback();
      } catch (error) {
        logger.warn('⚠️ Cleanup callback failed:', error);
      }
    }

    // Force garbage collection if available
    if (window.gc) {
      try {
        window.gc();
        logger.info('✅ Forced garbage collection');
      } catch (error) {
        logger.warn('⚠️ Failed to force GC:', error);
      }
    }

    logger.info('✅ Full cleanup completed');
    this.logStats();
  }

  clearEverything(): void {
    logger.info('🧹 Full memory cleanup - clearing tracked resources...');

    this.clearAllTimers();
    this.clearAllListeners();
    this.clearAllTweens();

    // Run custom cleanup callbacks
    for (const callback of this.cleanupCallbacks) {
      try {
        callback();
      } catch (error) {
        logger.warn('⚠️ Cleanup callback failed:', error);
      }
    }

    logger.info('✅ Nuclear cleanup completed');
    this.logStats();
  }

  // ============================================================
  // STATS & MONITORING
  // ============================================================

  getStats(): MemoryStats {
    const memoryUsage = (performance as any).memory 
      ? Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024)
      : 0;

    const stats: MemoryStats = {
      timers: {
        timeouts: this.timeouts.size,
        intervals: this.intervals.size,
        total: this.timeouts.size + this.intervals.size
      },
      listeners: this.listeners.size,
      tweens: this.tweens.size,
      memoryUsageMB: memoryUsage,
      isHealthy: this.isHealthy(),
      leakScore: this.calculateLeakScore()
    };

    return stats;
  }

  private isHealthy(): boolean {
    const timersTotal = this.timeouts.size + this.intervals.size;
    const listenersCount = this.listeners.size;
    const tweensCount = this.tweens.size;
    const memoryUsage = (performance as any).memory 
      ? Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024)
      : 0;
    
    return (
      timersTotal <= this.config.maxTimers &&
      listenersCount <= this.config.maxListeners &&
      tweensCount <= this.config.maxTweens &&
      memoryUsage <= this.config.memoryThresholdMB
    );
  }

  private calculateLeakScore(): number {
    // Calculate leak score (0-100, lower is better)
    const timersTotal = this.timeouts.size + this.intervals.size;
    const listenersCount = this.listeners.size;
    const tweensCount = this.tweens.size;
    const memoryUsage = (performance as any).memory 
      ? Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024)
      : 0;
    
    return this.calculateLeakScoreFromValues(timersTotal, listenersCount, tweensCount, memoryUsage);
  }

  private calculateLeakScoreFromValues(timersTotal: number, listenersCount: number, tweensCount: number, memoryUsage: number): number {
    const timerScore = Math.min(100, (timersTotal / this.config.maxTimers) * 100);
    const listenerScore = Math.min(100, (listenersCount / this.config.maxListeners) * 100);
    const tweenScore = Math.min(100, (tweensCount / this.config.maxTweens) * 100);
    const memoryScore = Math.min(100, (memoryUsage / this.config.memoryThresholdMB) * 100);

    return Math.round((timerScore + listenerScore + tweenScore + memoryScore) / 4);
  }

  logStats(): void {
    const stats = this.getStats();
    const uptime = Math.round((Date.now() - this.startTime) / 1000);

    logger.info('📊 Memory Stats:', {
      uptime: `${uptime}s`,
      timers: `${stats.timers.timeouts} timeouts + ${stats.timers.intervals} intervals = ${stats.timers.total} total`,
      listeners: stats.listeners,
      tweens: stats.tweens,
      memory: `${stats.memoryUsageMB}MB`,
      leakScore: `${stats.leakScore}/100`,
      health: stats.isHealthy ? '✅ HEALTHY' : '⚠️ UNHEALTHY'
    });
  }

  // ============================================================
  // CUSTOM CLEANUP CALLBACKS
  // ============================================================

  registerCleanupCallback(callback: () => void): void {
    this.cleanupCallbacks.add(callback);
  }

  unregisterCleanupCallback(callback: () => void): void {
    this.cleanupCallbacks.delete(callback);
  }

  // ============================================================
  // LIFECYCLE
  // ============================================================

  stop(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }

    logger.info('🛑 Enhanced Memory Manager stopped');
    this.logStats();
  }

  destroy(): void {
    this.stop();
    this.clearEverything();
    this.cleanupCallbacks.clear();
    logger.info('💀 Enhanced Memory Manager destroyed');
  }
}

// Create singleton instance
const enhancedMemoryManager = new EnhancedMemoryManager();

// Export for use in modules
export default enhancedMemoryManager;
export { EnhancedMemoryManager };

// Global access for debugging
if (typeof window !== 'undefined') {
  (window as any).enhancedMemoryManager = enhancedMemoryManager;
}
