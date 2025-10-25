// hud-animations.ts
// Animations for HUD system

import { gsap } from 'gsap';
import { Container, Text } from 'pixi.js';
import { 
  ANIMATION_DURATION, 
  EASING, 
  BOUNCE_OPTIONS 
} from './hud-constants.js';
import { logger } from '../core/logger.js';
import { container } from '../core/dependency-injection.js';

// Type definitions
interface PlayHudDropParams {
  duration?: number;
}

interface BumpComboOptions {
  peak?: number;
  back?: number;
  up?: number;
  down?: number;
}

interface BounceOptions {
  peak?: number;
  back?: number;
  up?: number;
  down?: number;
}

/**
 * Animate HUD drop
 */
export function animateHUDDrop(params: PlayHudDropParams = {}): void {
  const { duration = ANIMATION_DURATION.DROP } = params;
  
  logger.info(`🎬 Animating HUD drop: ${duration}s`);
  
  // Get HUD container from dependency injection
  const hudContainer = container.get('hud');
  if (!hudContainer) {
    logger.warn('HUD container not found for drop animation', 'hud-animations');
    return;
  }

  // Implement HUD drop animation with hardware acceleration
  gsap.fromTo(hudContainer, {
    y: -hudContainer.height,
    alpha: 0
  }, {
    y: 0,
    alpha: 1,
    duration: duration,
    ease: EASING.EASE_OUT,
    force3D: true, // Enable hardware acceleration
    onComplete: () => {
      logger.info('HUD drop animation complete', 'hud-animations');
    }
  });
}

/**
 * Animate text bounce
 */
export function animateTextBounce(text: Text, opts: BounceOptions = {}): void {
  if (!text) return;
  
  const { peak = 1.2, back = 1.05, up = 0.08, down = 0.2 } = opts;
  
  logger.info(`🎬 Animating text bounce: ${text.text}`);
  
  gsap.fromTo(text.scale,
    { x: 1, y: 1 },
    {
      x: peak,
      y: peak,
      duration: up,
      ease: EASING.EASE_OUT,
      onComplete: () => {
        gsap.to(text.scale, {
          x: back,
          y: back,
          duration: down,
          ease: EASING.EASE_OUT
        });
      }
    }
  );
}

/**
 * Animate combo bump
 */
export function animateComboBump(text: Text, opts: BumpComboOptions = {}): void {
  if (!text) return;
  
  const { peak = 1.3, back = 1.1, up = 0.1, down = 0.25 } = opts;
  
  logger.info(`🎬 Animating combo bump: ${text.text}`);
  
  gsap.fromTo(text.scale,
    { x: 1, y: 1 },
    {
      x: peak,
      y: peak,
      duration: up,
      ease: EASING.EASE_OUT,
      onComplete: () => {
        gsap.to(text.scale, {
          x: back,
          y: back,
          duration: down,
          ease: EASING.EASE_OUT
        });
      }
    }
  );
}

/**
 * Animate score increase
 */
export function animateScoreIncrease(text: Text, fromValue: number, toValue: number): Promise<void> {
  return new Promise((resolve) => {
    if (!text) {
      resolve();
      return;
    }
    
    logger.info(`🎬 Animating score increase: ${fromValue} -> ${toValue}`);
    
    const scoreTween = gsap.fromTo(text,
      { text: fromValue.toString() },
      {
        text: toValue.toString(),
        duration: ANIMATION_DURATION.SCALE,
        ease: EASING.EASE_OUT,
        onUpdate: function() {
          text.text = Math.round(this.targets()[0].text).toString();
        },
        onComplete: () => {
          text.text = toValue.toString();
          resolve();
        }
      }
    );
    
        // Store tween for potential cleanup
        (text as any)._scoreTween = scoreTween;
  });
}

/**
 * Animate board update
 */
export function animateBoardUpdate(text: Text, fromValue: number, toValue: number): Promise<void> {
  return new Promise((resolve) => {
    if (!text) {
      resolve();
      return;
    }
    
    logger.info(`🎬 Animating board update: ${fromValue} -> ${toValue}`);
    
    const boardTween = gsap.fromTo(text,
      { text: fromValue.toString() },
      {
        text: toValue.toString(),
        duration: ANIMATION_DURATION.SCALE,
        ease: EASING.EASE_OUT,
        onUpdate: function() {
          text.text = Math.round(this.targets()[0].text).toString();
        },
        onComplete: () => {
          text.text = toValue.toString();
          resolve();
        }
      }
    );
    
    // Store tween for potential cleanup
    (text as Text & { _boardTween?: gsap.core.Timeline })._boardTween = boardTween;
  });
}

/**
 * Animate combo update
 */
export function animateComboUpdate(text: Text, fromValue: number, toValue: number): Promise<void> {
  return new Promise((resolve) => {
    if (!text) {
      resolve();
      return;
    }
    
    logger.info(`🎬 Animating combo update: ${fromValue} -> ${toValue}`);
    
    const comboTween = gsap.fromTo(text,
      { text: fromValue.toString() },
      {
        text: toValue.toString(),
        duration: ANIMATION_DURATION.SCALE,
        ease: EASING.EASE_OUT,
        onUpdate: function() {
          text.text = Math.round(this.targets()[0].text).toString();
        },
        onComplete: () => {
          text.text = toValue.toString();
          resolve();
        }
      }
    );
    
    // Store tween for potential cleanup
    (text as Text & { _comboTween?: gsap.core.Timeline })._comboTween = comboTween;
  });
}

/**
 * Animate HUD fade in
 */
export function animateHUDFadeIn(container: Container): Promise<void> {
  return new Promise((resolve) => {
    if (!container) {
      resolve();
      return;
    }
    
    logger.info('🎬 Animating HUD fade in');
    
    container.alpha = 0;
    
    const fadeTween = gsap.to(container, {
      alpha: 1,
      duration: ANIMATION_DURATION.FADE,
      ease: EASING.EASE_OUT,
      onComplete: resolve
    });
    
    // Store tween for potential cleanup
    (container as Container & { _fadeInTween?: gsap.core.Timeline })._fadeInTween = fadeTween;
  });
}

/**
 * Animate HUD fade out
 */
export function animateHUDFadeOut(container: Container): Promise<void> {
  return new Promise((resolve) => {
    if (!container) {
      resolve();
      return;
    }
    
    logger.info('🎬 Animating HUD fade out');
    
    const fadeTween = gsap.to(container, {
      alpha: 0,
      duration: ANIMATION_DURATION.FADE,
      ease: EASING.EASE_IN,
      onComplete: () => {
        container.visible = false;
        resolve();
      }
    });
    
    // Store tween for potential cleanup
    (container as Container & { _fadeOutTween?: gsap.core.Timeline })._fadeOutTween = fadeTween;
  });
}

/**
 * Animate HUD slide in
 */
export function animateHUDSlideIn(container: Container, fromY: number = -100): Promise<void> {
  return new Promise((resolve) => {
    if (!container) {
      resolve();
      return;
    }
    
    logger.info('🎬 Animating HUD slide in');
    
    container.y = fromY;
    
    const slideTween = gsap.to(container, {
      y: 0,
      duration: ANIMATION_DURATION.SLIDE,
      ease: EASING.EASE_OUT,
      onComplete: resolve
    });
    
    // Store tween for potential cleanup
    (container as Container & { _slideInTween?: gsap.core.Timeline })._slideInTween = slideTween;
  });
}

/**
 * Animate HUD slide out
 */
export function animateHUDSlideOut(container: Container, toY: number = -100): Promise<void> {
  return new Promise((resolve) => {
    if (!container) {
      resolve();
      return;
    }
    
    logger.info('🎬 Animating HUD slide out');
    
    const slideTween = gsap.to(container, {
      y: toY,
      duration: ANIMATION_DURATION.SLIDE,
      ease: EASING.EASE_IN,
      onComplete: () => {
        container.visible = false;
        resolve();
      }
    });
    
    // Store tween for potential cleanup
    (container as Container & { _slideOutTween?: gsap.core.Timeline })._slideOutTween = slideTween;
  });
}

/**
 * Animate HUD scale
 */
export function animateHUDScale(container: Container, scale: number): Promise<void> {
  return new Promise((resolve) => {
    if (!container) {
      resolve();
      return;
    }
    
    logger.info(`🎬 Animating HUD scale: ${scale}`);
    
    const scaleTween = gsap.to(container.scale, {
      x: scale,
      y: scale,
      duration: ANIMATION_DURATION.SCALE,
      ease: EASING.EASE_OUT,
      onComplete: resolve
    });
    
    // Store tween for potential cleanup
    (container as Container & { _scaleTween?: gsap.core.Timeline })._scaleTween = scaleTween;
  });
}

/**
 * Animate text color change
 */
export function animateTextColorChange(text: Text, fromColor: number, toColor: number): Promise<void> {
  return new Promise((resolve) => {
    if (!text) {
      resolve();
      return;
    }
    
    logger.info(`🎬 Animating text color change: ${fromColor} -> ${toColor}`);
    
    const colorTween = gsap.fromTo(text,
      { tint: fromColor },
      {
        tint: toColor,
        duration: ANIMATION_DURATION.FADE,
        ease: EASING.EASE_OUT,
        onComplete: resolve
      }
    );
    
    // Store tween for potential cleanup
    (text as Text & { _colorTween?: gsap.core.Timeline })._colorTween = colorTween;
  });
}

/**
 * Kill all animations for container
 */
export function killContainerAnimations(container: Container): void {
  if (!container) return;
  
  const tweens = [
    (container as Container & { _fadeInTween?: gsap.core.Timeline })._fadeInTween,
    (container as Container & { _fadeOutTween?: gsap.core.Timeline })._fadeOutTween,
    (container as Container & { _slideInTween?: gsap.core.Timeline })._slideInTween,
    (container as Container & { _slideOutTween?: gsap.core.Timeline })._slideOutTween,
    (container as Container & { _scaleTween?: gsap.core.Timeline })._scaleTween
  ];
  
  tweens.forEach(tween => {
    if (tween && tween.kill) {
      tween.kill();
    }
  });
  
  // Clear references
  delete (container as Container & { _fadeInTween?: gsap.core.Timeline })._fadeInTween;
  delete (container as Container & { _fadeOutTween?: gsap.core.Timeline })._fadeOutTween;
  delete (container as Container & { _slideInTween?: gsap.core.Timeline })._slideInTween;
  delete (container as Container & { _slideOutTween?: gsap.core.Timeline })._slideOutTween;
  delete (container as Container & { _scaleTween?: gsap.core.Timeline })._scaleTween;
}

/**
 * Kill all animations for text
 */
export function killTextAnimations(text: Text): void {
  if (!text) return;
  
  const tweens = [
    (text as Text & { _scoreTween?: gsap.core.Timeline })._scoreTween,
    (text as Text & { _boardTween?: gsap.core.Timeline })._boardTween,
    (text as Text & { _comboTween?: gsap.core.Timeline })._comboTween,
    (text as Text & { _colorTween?: gsap.core.Timeline })._colorTween
  ];
  
  tweens.forEach(tween => {
    if (tween && tween.kill) {
      tween.kill();
    }
  });
  
  // Clear references
  delete (text as Text & { _scoreTween?: gsap.core.Timeline })._scoreTween;
  delete (text as Text & { _boardTween?: gsap.core.Timeline })._boardTween;
  delete (text as Text & { _comboTween?: gsap.core.Timeline })._comboTween;
  delete (text as Text & { _colorTween?: gsap.core.Timeline })._colorTween;
}

// Export animation functions
// All functions are already exported individually above
