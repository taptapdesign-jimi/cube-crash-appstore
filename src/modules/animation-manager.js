// Animation Manager Module
// Handles all animations and transitions

import { gsap } from 'gsap';
import gameState from './game-state.js';

class AnimationManager {
  constructor() {
    this.animations = new Map();
    this.timelines = new Map();
    this.isInitialized = false;
  }
  
  // Initialize animation manager
  init() {
    if (this.isInitialized) return;
    
    // Setup GSAP defaults
    gsap.defaults({
      ease: "power2.out",
      duration: 0.6
    });
    
    this.isInitialized = true;
    console.log('✅ Animation Manager initialized');
  }
  
  // Fade in element
  fadeIn(element, options = {}) {
    if (!element) return;
    
    const {
      duration = 0.6,
      delay = 0,
      ease = "power2.out",
      onComplete
    } = options;
    
    return gsap.fromTo(element, 
      { opacity: 0 },
      {
        opacity: 1,
        duration,
        delay,
        ease,
        onComplete
      }
    );
  }
  
  // Fade out element
  fadeOut(element, options = {}) {
    if (!element) return;
    
    const {
      duration = 0.6,
      delay = 0,
      ease = "power2.out",
      onComplete
    } = options;
    
    return gsap.to(element, {
      opacity: 0,
      duration,
      delay,
      ease,
      onComplete
    });
  }
  
  // Scale in element
  scaleIn(element, options = {}) {
    if (!element) return;
    
    const {
      duration = 0.6,
      delay = 0,
      ease = "back.out(1.7)",
      scale = 1,
      onComplete
    } = options;
    
    return gsap.fromTo(element,
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
  }
  
  // Scale out element
  scaleOut(element, options = {}) {
    if (!element) return;
    
    const {
      duration = 0.6,
      delay = 0,
      ease = "back.in(1.7)",
      scale = 0,
      onComplete
    } = options;
    
    return gsap.to(element, {
      scale,
      opacity: 0,
      duration,
      delay,
      ease,
      onComplete
    });
  }
  
  // Slide in from direction
  slideIn(element, direction = 'up', options = {}) {
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
    
    return gsap.fromTo(element,
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
  }
  
  // Slide out to direction
  slideOut(element, direction = 'up', options = {}) {
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
    
    return gsap.to(element, {
      x,
      y,
      opacity: 0,
      duration,
      delay,
      ease,
      onComplete
    });
  }
  
  // Bounce animation
  bounce(element, options = {}) {
    if (!element) return;
    
    const {
      duration = 0.6,
      delay = 0,
      scale = 1.1,
      onComplete
    } = options;
    
    return gsap.to(element, {
      scale,
      duration: duration * 0.5,
      delay,
      yoyo: true,
      repeat: 1,
      ease: "power2.out",
      onComplete
    });
  }
  
  // Shake animation
  shake(element, options = {}) {
    if (!element) return;
    
    const {
      duration = 0.6,
      delay = 0,
      intensity = 10,
      onComplete
    } = options;
    
    return gsap.to(element, {
      x: `+=${intensity}`,
      duration: duration * 0.1,
      delay,
      yoyo: true,
      repeat: 5,
      ease: "power2.inOut",
      onComplete
    });
  }
  
  // Pulse animation
  pulse(element, options = {}) {
    if (!element) return;
    
    const {
      duration = 1,
      delay = 0,
      scale = 1.05,
      onComplete
    } = options;
    
    return gsap.to(element, {
      scale,
      duration: duration * 0.5,
      delay,
      yoyo: true,
      repeat: -1,
      ease: "power2.inOut",
      onComplete
    });
  }
  
  // Create timeline
  createTimeline(name, options = {}) {
    const timeline = gsap.timeline(options);
    this.timelines.set(name, timeline);
    return timeline;
  }
  
  // Get timeline
  getTimeline(name) {
    return this.timelines.get(name);
  }
  
  // Kill timeline
  killTimeline(name) {
    const timeline = this.timelines.get(name);
    if (timeline) {
      timeline.kill();
      this.timelines.delete(name);
    }
  }
  
  // Kill all animations
  killAll() {
    this.animations.forEach(animation => animation.kill());
    this.timelines.forEach(timeline => timeline.kill());
    this.animations.clear();
    this.timelines.clear();
  }
  
  // Pause all animations
  pauseAll() {
    this.animations.forEach(animation => animation.pause());
    this.timelines.forEach(timeline => timeline.pause());
  }
  
  // Resume all animations
  resumeAll() {
    this.animations.forEach(animation => animation.resume());
    this.timelines.forEach(timeline => timeline.resume());
  }
  
  // Cleanup
  destroy() {
    this.killAll();
    this.isInitialized = false;
  }
}

// Create singleton instance
const animationManager = new AnimationManager();

// Export for use in other modules
export default animationManager;

// Export class for testing
export { AnimationManager };
