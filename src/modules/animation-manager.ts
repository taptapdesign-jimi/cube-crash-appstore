// Animation Manager Module
// Handles all animations and transitions

import { gsap } from 'gsap';
import gameState from './game-state.js';
import { logger } from '../core/logger.js';

// Type definitions
interface AnimationOptions {
  duration?: number;
  delay?: number;
  ease?: string;
  onComplete?: () => void;
}

interface ScaleOptions extends AnimationOptions {
  scale?: number;
}

interface SlideOptions extends AnimationOptions {
  distance?: number;
}

interface BounceOptions extends AnimationOptions {
  scale?: number;
}

interface ShakeOptions extends AnimationOptions {
  intensity?: number;
}

interface PulseOptions extends AnimationOptions {
  scale?: number;
}

type SlideDirection = 'up' | 'down' | 'left' | 'right';

class AnimationManager {
  private animations: Map<string, gsap.core.Tween>;
  private timelines: Map<string, gsap.core.Timeline>;
  private activeTweens: Set<gsap.core.Tween>; // 🔥 FIX: Track all active tweens for cleanup
  private activeTimelines: Set<gsap.core.Timeline>; // Track external timelines for cleanup
  private isInitialized: boolean;
  private tweenCounter: number; // For generating unique IDs

  constructor() {
    this.animations = new Map();
    this.timelines = new Map();
    this.activeTweens = new Set(); // 🔥 FIX: Track all active tweens
    this.activeTimelines = new Set();
    this.isInitialized = false;
    this.tweenCounter = 0;
  }
  
  // 🔥 FIX: Track a tween and auto-remove when complete
  private trackTween(tween: gsap.core.Tween): gsap.core.Tween {
    this.activeTweens.add(tween);
    const originalOnComplete = tween.eventCallback('onComplete');
    const originalOnInterrupt = tween.eventCallback('onInterrupt');
    tween.eventCallback('onComplete', () => {
      this.activeTweens.delete(tween);
      if (typeof originalOnComplete === 'function') {
        originalOnComplete.call(tween);
      }
    });
    tween.eventCallback('onInterrupt', () => {
      this.activeTweens.delete(tween);
      if (typeof originalOnInterrupt === 'function') {
        originalOnInterrupt.call(tween);
      }
    });
    return tween;
  }

  // Track external tween created outside the manager
  // 🔥 MEMORY LEAK FIX: Auto-remove when tween completes (same as trackTween)
  // Without this, idle tile bounce smoke particles accumulate ~42k tweens/hour
  trackExternalTween(tween: gsap.core.Tween): gsap.core.Tween {
    this.activeTweens.add(tween);
    const originalOnComplete = tween.eventCallback('onComplete');
    const originalOnInterrupt = tween.eventCallback('onInterrupt');
    tween.eventCallback('onComplete', () => {
      try {
        this.activeTweens.delete(tween);
        if (typeof originalOnComplete === 'function') {
          originalOnComplete.call(tween);
        }
      } catch {}
    });
    tween.eventCallback('onInterrupt', () => {
      try {
        this.activeTweens.delete(tween);
        if (typeof originalOnInterrupt === 'function') {
          originalOnInterrupt.call(tween);
        }
      } catch {}
    });
    return tween;
  }

  killExternalTween(tween: gsap.core.Tween | null | undefined): void {
    this.killExternalAnimation(tween);
  }

  // Track external timeline created outside the manager
  // 🔥 MEMORY LEAK FIX: Auto-remove when timeline completes
  // Without this, idle tile bounce smoke creates ~42k timelines/hour that never get GC'd
  trackExternalTimeline(timeline: gsap.core.Timeline): gsap.core.Timeline {
    this.activeTimelines.add(timeline);
    const originalOnComplete = timeline.eventCallback('onComplete');
    const originalOnInterrupt = timeline.eventCallback('onInterrupt');
    timeline.eventCallback('onComplete', () => {
      try {
        this.activeTimelines.delete(timeline);
        if (typeof originalOnComplete === 'function') {
          originalOnComplete.call(timeline);
        }
      } catch {}
    });
    timeline.eventCallback('onInterrupt', () => {
      try {
        this.activeTimelines.delete(timeline);
        if (typeof originalOnInterrupt === 'function') {
          originalOnInterrupt.call(timeline);
        }
      } catch {}
    });
    return timeline;
  }

  killExternalTimeline(timeline: gsap.core.Timeline | null | undefined): void {
    this.killExternalAnimation(timeline);
  }

  killExternalAnimation(animation: gsap.core.Tween | gsap.core.Timeline | null | undefined): void {
    if (!animation) return;
    this.activeTweens.delete(animation as gsap.core.Tween);
    this.activeTimelines.delete(animation as gsap.core.Timeline);
    try { animation.kill(); } catch {}
  }
  
  // Initialize animation manager
  init(): void {
    if (this.isInitialized) return;
    
    // Setup GSAP defaults
    gsap.defaults({
      ease: "power2.out",
      duration: 0.6
    });
    
    this.isInitialized = true;
    logger.info('✅ Animation Manager initialized');
  }
  
  // Fade in element
  fadeIn(element: HTMLElement | null, options: AnimationOptions = {}): gsap.core.Tween | undefined {
    if (!element) return;
    
    const {
      duration = 0.6,
      delay = 0,
      ease = "power2.out",
      onComplete
    } = options;
    
    const tween = gsap.fromTo(element, 
      { opacity: 0 },
      {
        opacity: 1,
        duration,
        delay,
        ease,
        onComplete
      }
    );
    return this.trackTween(tween);
  }
  
  // Fade out element
  fadeOut(element: HTMLElement | null, options: AnimationOptions = {}): gsap.core.Tween | undefined {
    if (!element) return;
    
    const {
      duration = 0.6,
      delay = 0,
      ease = "power2.out",
      onComplete
    } = options;
    
    const tween = gsap.to(element, {
      opacity: 0,
      duration,
      delay,
      ease,
      onComplete
    });
    return this.trackTween(tween);
  }
  
  // Scale in element
  scaleIn(element: HTMLElement | null, options: ScaleOptions = {}): gsap.core.Tween | undefined {
    if (!element) return;
    
    const {
      duration = 0.6,
      delay = 0,
      ease = "back.out(1.7)",
      scale = 1,
      onComplete
    } = options;
    
    const tween = gsap.fromTo(element,
      { scale: 0, opacity: 0 },
      {
        scale,
        opacity: 1,
        duration,
        delay,
        ease,
        onComplete
      }
    );
    return this.trackTween(tween);
  }
  
  // Scale out element
  scaleOut(element: HTMLElement | null, options: ScaleOptions = {}): gsap.core.Tween | undefined {
    if (!element) return;
    
    const {
      duration = 0.6,
      delay = 0,
      ease = "back.in(1.7)",
      scale = 0,
      onComplete
    } = options;
    
    const tween = gsap.to(element, {
      scale,
      opacity: 0,
      duration,
      delay,
      ease,
      onComplete
    });
    return this.trackTween(tween);
  }
  
  // Slide in from direction
  slideIn(element: HTMLElement | null, direction: SlideDirection = 'up', options: SlideOptions = {}): gsap.core.Tween | undefined {
    if (!element) return;
    
    const {
      duration = 0.6,
      delay = 0,
      ease = "power2.out",
      distance = 50,
      onComplete
    } = options;
    
    const directions = {
      up: { y: distance, x: 0 },
      down: { y: -distance, x: 0 },
      left: { x: distance, y: 0 },
      right: { x: -distance, y: 0 }
    };
    
    const { x, y } = directions[direction] || directions.up;
    
    const tween = gsap.fromTo(element,
      { x, y, opacity: 0 },
      {
        x: 0,
        y: 0,
        opacity: 1,
        duration,
        delay,
        ease,
        onComplete
      }
    );
    return this.trackTween(tween);
  }
  
  // Slide out to direction
  slideOut(element: HTMLElement | null, direction: SlideDirection = 'up', options: SlideOptions = {}): gsap.core.Tween | undefined {
    if (!element) return;
    
    const {
      duration = 0.6,
      delay = 0,
      ease = "power2.in",
      distance = 50,
      onComplete
    } = options;
    
    const directions = {
      up: { y: -distance, x: 0 },
      down: { y: distance, x: 0 },
      left: { x: -distance, y: 0 },
      right: { x: distance, y: 0 }
    };
    
    const { x, y } = directions[direction] || directions.up;
    
    const tween = gsap.to(element, {
      x,
      y,
      opacity: 0,
      duration,
      delay,
      ease,
      onComplete
    });
    return this.trackTween(tween);
  }
  
  // Bounce animation
  bounce(element: HTMLElement | null, options: BounceOptions = {}): gsap.core.Tween | undefined {
    if (!element) return;
    
    const {
      duration = 0.6,
      delay = 0,
      scale = 1.1,
      onComplete
    } = options;
    
    const tween = gsap.to(element, {
      scale,
      duration: duration * 0.5,
      delay,
      yoyo: true,
      repeat: 1,
      ease: "power2.out",
      onComplete
    });
    return this.trackTween(tween);
  }
  
  // Shake animation
  shake(element: HTMLElement | null, options: ShakeOptions = {}): gsap.core.Tween | undefined {
    if (!element) return;
    
    const {
      duration = 0.6,
      delay = 0,
      intensity = 10,
      onComplete
    } = options;
    
    const tween = gsap.to(element, {
      x: `+=${intensity}`,
      duration: duration * 0.1,
      delay,
      yoyo: true,
      repeat: 5,
      ease: "power2.inOut",
      onComplete
    });
    return this.trackTween(tween);
  }
  
  // Pulse animation (infinite - MUST be stopped manually or via killAll)
  pulse(element: HTMLElement | null, options: PulseOptions = {}): gsap.core.Tween | undefined {
    if (!element) return;
    
    const {
      duration = 1,
      delay = 0,
      scale = 1.05,
      onComplete
    } = options;
    
    const tween = gsap.to(element, {
      scale,
      duration: duration * 0.5,
      delay,
      yoyo: true,
      repeat: -1,
      ease: "power2.inOut",
      onComplete
    });
    // 🔥 FIX: Track infinite tween - CRITICAL for cleanup
    this.activeTweens.add(tween);
    return tween;
  }
  
  // Create timeline
  createTimeline(name: string, options: any = {}): gsap.core.Timeline {
    const timeline = gsap.timeline(options);
    this.timelines.set(name, timeline);
    return timeline;
  }
  
  // Get timeline
  getTimeline(name: string): gsap.core.Timeline | undefined {
    return this.timelines.get(name);
  }
  
  // Kill timeline
  killTimeline(name: string): void {
    const timeline = this.timelines.get(name);
    if (timeline) {
      timeline.kill();
      this.timelines.delete(name);
    }
  }
  
  // Kill all animations
  killAll(): void {
    // Kill named animations
    this.animations.forEach(animation => {
      try { animation?.kill?.(); } catch {}
    });
    this.timelines.forEach(timeline => {
      try { timeline?.kill?.(); } catch {}
    });
    this.animations.clear();
    this.timelines.clear();
    
    // 🔥 FIX: Kill all tracked active tweens
    this.activeTweens.forEach(tween => {
      try { tween.kill(); } catch {}
    });
    this.activeTweens.clear();
    
    // Kill all tracked external timelines
    this.activeTimelines.forEach(tl => {
      try { tl.kill(); } catch {}
    });
    this.activeTimelines.clear();

    logger.info('✅ All animations killed');
  }
  
  // Pause all animations
  pauseAll(): void {
    this.animations.forEach(animation => animation.pause());
    this.timelines.forEach(timeline => timeline.pause());
  }
  
  // Resume all animations
  resumeAll(): void {
    this.animations.forEach(animation => animation.resume());
    this.timelines.forEach(timeline => timeline.resume());
  }
  
  // Cleanup
  destroy(): void {
    this.killAll();
    this.isInitialized = false;
  }

  // Stats for diagnostics
  getStats(): { animations: number; timelines: number; activeTweens: number; activeTimelines: number } {
    return {
      animations: this.animations.size,
      timelines: this.timelines.size,
      activeTweens: this.activeTweens.size,
      activeTimelines: this.activeTimelines.size
    };
  }
}

// Create singleton instance
const animationManager = new AnimationManager();

// Export for use in other modules
export default animationManager;

// Export class for testing
export { AnimationManager };
