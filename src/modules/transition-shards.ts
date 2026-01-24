// @ts-nocheck
// Transition Shards Animation
// Shards assemble into digits on enter, explode outward on exit

import { Container, Graphics } from 'pixi.js';
import { gsap } from 'gsap';
import { logger } from '../core/logger.js';
import { graphicsPool } from './object-pool.ts';
import { getColor, getParams } from './templates/template-manager.ts';

// Export container tracking set for cleanup
export const activeShardsContainers = new Set<Container>();

interface ShardParticle {
  graphics: Graphics;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  currentX: number;
  currentY: number;
  rotation: number;
  scale: number;
  alpha: number;
}

function getMeasuredDigitRect(digitElement: HTMLElement): DOMRect {
  const rect = digitElement.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) {
    return rect;
  }

  const prevTransform = digitElement.style.transform;
  const prevOpacity = digitElement.style.opacity;
  digitElement.style.transform = 'scale(1)';
  digitElement.style.opacity = '0';
  const measured = digitElement.getBoundingClientRect();
  digitElement.style.transform = prevTransform;
  digitElement.style.opacity = prevOpacity;

  return measured.width > 0 && measured.height > 0 ? measured : rect;
}

function getCanvasSpaceMetrics(
  app: any,
  rect: DOMRect
): { x: number; y: number; width: number; height: number } {
  let canvasRect: DOMRect | null = null;
  try {
    if (app?.canvas?.getBoundingClientRect) {
      canvasRect = app.canvas.getBoundingClientRect();
    }
  } catch {}

  if (!canvasRect) {
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      width: rect.width,
      height: rect.height
    };
  }

  const scaleX = canvasRect.width > 0 && app?.renderer?.width
    ? app.renderer.width / canvasRect.width
    : 1;
  const scaleY = canvasRect.height > 0 && app?.renderer?.height
    ? app.renderer.height / canvasRect.height
    : 1;

  return {
    x: (rect.left - canvasRect.left + rect.width / 2) * scaleX,
    y: (rect.top - canvasRect.top + rect.height / 2) * scaleY,
    width: rect.width * scaleX,
    height: rect.height * scaleY
  };
}

/**
 * Create shards that assemble into digit shape (enter animation)
 */
export function createShardsEnterAnimation(
  digitElement: HTMLElement,
  container: HTMLElement,
  app: any,
  stage: Container,
  onComplete: () => void
): void {
  if (!digitElement || !app || !stage) {
    logger.warn('⚠️ createShardsEnterAnimation: Missing required elements');
    onComplete();
    return;
  }

  // 🔥 CRITICAL FIX: Ensure digit element is in DOM and visible for measurement
  if (!digitElement.parentElement || !digitElement.offsetParent) {
    logger.warn('⚠️ createShardsEnterAnimation: Digit element not in DOM or not visible');
    // Make element temporarily visible for measurement
    const wasHidden = digitElement.style.display === 'none' || digitElement.style.visibility === 'hidden';
    if (wasHidden) {
      digitElement.style.display = '';
      digitElement.style.visibility = '';
    }
    // Force reflow
    void digitElement.offsetWidth;
  }

  // Get digit position and size
  let digitRect = getMeasuredDigitRect(digitElement);
  
  // 🔥 CRITICAL FIX: Validate digit rect is valid
  if (!digitRect || digitRect.width === 0 || digitRect.height === 0) {
    logger.warn('⚠️ createShardsEnterAnimation: Invalid digit rect, using fallback');
    // Use fallback dimensions
    digitRect = {
      left: window.innerWidth / 2 - 50,
      top: window.innerHeight / 2 - 50,
      width: 100,
      height: 100,
      right: window.innerWidth / 2 + 50,
      bottom: window.innerHeight / 2 + 50,
      x: window.innerWidth / 2 - 50,
      y: window.innerHeight / 2 - 50,
      toJSON: () => ({})
    } as DOMRect;
  }
  
  const digitMetrics = getCanvasSpaceMetrics(app, digitRect);
  const digitX = digitMetrics.x;
  const digitY = digitMetrics.y;
  const digitWidth = digitMetrics.width;
  const digitHeight = digitMetrics.height;

  // Create PIXI container for shards
  const shardsContainer = new Container();
  shardsContainer.name = 'transition-shards-enter';
  shardsContainer.zIndex = 100001; // Above overlay, below UI
  shardsContainer.eventMode = 'none';
  shardsContainer.visible = true;
  shardsContainer.alpha = 1.0;
  
  // Position container at digit location
  shardsContainer.x = digitX;
  shardsContainer.y = digitY;
  stage.addChild(shardsContainer);
  if (stage.sortChildren) {
    stage.sortChildren();
  }

  // Track container for cleanup
  activeShardsContainers.add(shardsContainer);

  // Get shard color and params (use regular merge color - brown/orange)
  const color = getColor('regular') || 0xD4A584; // Brown fallback
  const params = getParams('regular') || {};

  // Generate shards around digit area
  const shardCount = 25 + Math.floor(Math.random() * 15); // 25-40 shards per digit
  const shards: ShardParticle[] = [];
  const spreadRadius = Math.max(digitWidth, digitHeight) * 0.8; // Spread around digit

  for (let i = 0; i < shardCount; i++) {
    // Start position: random around digit area
    const angle = Math.random() * Math.PI * 2;
    const distance = spreadRadius * (0.5 + Math.random() * 0.5);
    const startX = Math.cos(angle) * distance;
    const startY = Math.sin(angle) * distance;

    // Target position: random within digit bounds (approximate)
    const targetX = (Math.random() - 0.5) * digitWidth * 0.6;
    const targetY = (Math.random() - 0.5) * digitHeight * 0.6;

    // Create shard graphics
    const shard = graphicsPool.acquire();
    if (!shard || shard.destroyed) {
      continue;
    }

    shard.clear();
    shard.tint = 0xFFFFFF;
    shard.blendMode = 'normal';
    shard.alpha = 1.0;

    // Draw shard (small irregular polygon)
    const baseSize = 4 + Math.random() * 6; // 4-10px
    const width = baseSize;
    const height = width * (0.8 + Math.random() * 1.4);

    const points = [];
    const numPoints = 4 + Math.floor(Math.random() * 4); // 4-7 points
    
    for (let j = 0; j < numPoints; j++) {
      const pointAngle = (j / numPoints) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
      const radius = (0.3 + Math.random() * 0.7) * Math.min(width, height) / 2;
      const px = Math.cos(pointAngle) * radius;
      const py = Math.sin(pointAngle) * radius;
      points.push(px, py);
    }

    try {
      shard.poly(points).fill({ color: color, alpha: params.lineAlpha || 0.9 });
    } catch (e) {
      // Fallback to rect
      shard.clear();
      shard.rect(-baseSize/2, -baseSize/2, baseSize, baseSize).fill({ color: color, alpha: 0.9 });
    }

    // Set initial position
    shard.x = startX;
    shard.y = startY;
    shard.rotation = Math.random() * Math.PI * 2;
    shard.scale.set(0.5 + Math.random() * 0.5); // 0.5-1.0 scale
    shard.visible = true;
    shard.alpha = 0; // Start invisible

    shardsContainer.addChild(shard);

    shards.push({
      graphics: shard,
      startX,
      startY,
      targetX,
      targetY,
      currentX: startX,
      currentY: startY,
      rotation: Math.random() * Math.PI * 2,
      scale: 0.5 + Math.random() * 0.5,
      alpha: 0
    });
  }

  // Animate shards assembling into digit shape
  const assembleTimeline = gsap.timeline({
    onComplete: () => {
      // 🔥 CRITICAL FIX: Ensure digit element exists and is in DOM before animating
      if (!digitElement || !digitElement.parentElement) {
        logger.warn('⚠️ createShardsEnterAnimation: Digit element missing in onComplete, skipping fade-in');
        onComplete();
        return;
      }
      
      // Fade in actual digit text
      logger.info(`✅ createShardsEnterAnimation: Fading in digit text "${digitElement.textContent}"`);
      gsap.to(digitElement, {
        opacity: 1,
        scale: 1,
        duration: 0.2,
        ease: 'power2.out',
        onComplete: () => {
          logger.info(`✅ createShardsEnterAnimation: Digit text "${digitElement.textContent}" is now visible`);
          // Cleanup shards container
          activeShardsContainers.delete(shardsContainer);
          
          // Kill all GSAP animations on shards
          shards.forEach(shard => {
            try {
              if (shard.graphics && !shard.graphics.destroyed) {
                gsap.killTweensOf(shard.graphics);
                gsap.killTweensOf(shard.graphics.scale);
                gsap.killTweensOf(shard.graphics.alpha);
                gsap.killTweensOf(shard.graphics.rotation);
              }
            } catch (e) {
              logger.warn('⚠️ Error killing shard tweens:', e);
            }
          });

          if (shardsContainer.parent) {
            shardsContainer.parent.removeChild(shardsContainer);
          }
          shardsContainer.destroy({ children: true });
          
          // Release shards to pool
          shards.forEach(shard => {
            try {
              if (shard.graphics && !shard.graphics.destroyed) {
                graphicsPool.release(shard.graphics);
              }
            } catch (e) {
              logger.warn('⚠️ Error releasing shard to pool:', e);
            }
          });

          onComplete();
        }
      });
    }
  });

  // Animate each shard to target position
  shards.forEach((shard, index) => {
    // 🔥 CRITICAL FIX: Validate shard.graphics exists before animating
    if (!shard.graphics || shard.graphics.destroyed) {
      logger.warn(`⚠️ Shard ${index} graphics is null or destroyed, skipping animation`);
      return;
    }

    const delay = index * 0.01; // Stagger by 10ms per shard
    
    // Fade in and move to target
    assembleTimeline.to(shard.graphics, {
      x: shard.targetX,
      y: shard.targetY,
      alpha: 1,
      rotation: shard.rotation + (Math.random() - 0.5) * 0.5,
      duration: 0.6 + Math.random() * 0.3, // 0.6-0.9s
      ease: 'power2.out'
    }, delay);

    // Scale up slightly as they assemble
    // 🔥 CRITICAL FIX: Validate scale exists before animating
    if (shard.graphics.scale) {
      assembleTimeline.to(shard.graphics.scale, {
        x: shard.scale * 1.2,
        y: shard.scale * 1.2,
        duration: 0.4,
        ease: 'power2.out'
      }, delay);
    }
  });

  // After shards assemble, fade them out quickly
  assembleTimeline.to({}, {
    duration: 0.1
  }, '+=0.1');

  shards.forEach(shard => {
    assembleTimeline.to(shard.graphics, {
      alpha: 0,
      duration: 0.15,
      ease: 'power2.in'
    }, '<');
  });
}

/**
 * Create shards that explode from digit shape (exit animation)
 */
export function createShardsExitAnimation(
  digitElement: HTMLElement,
  container: HTMLElement,
  app: any,
  stage: Container,
  onComplete: () => void
): void {
  if (!digitElement || !app || !stage) {
    logger.warn('⚠️ createShardsExitAnimation: Missing required elements');
    onComplete();
    return;
  }

  // Get digit position and size
  const digitRect = getMeasuredDigitRect(digitElement);
  const digitMetrics = getCanvasSpaceMetrics(app, digitRect);
  const digitX = digitMetrics.x;
  const digitY = digitMetrics.y;
  const digitWidth = digitMetrics.width;
  const digitHeight = digitMetrics.height;

  // Create PIXI container for shards
  const shardsContainer = new Container();
  shardsContainer.name = 'transition-shards-exit';
  shardsContainer.zIndex = 100001; // Above overlay, below UI
  shardsContainer.eventMode = 'none';
  shardsContainer.visible = true;
  shardsContainer.alpha = 1.0;
  
  // Position container at digit location
  shardsContainer.x = digitX;
  shardsContainer.y = digitY;
  stage.addChild(shardsContainer);
  if (stage.sortChildren) {
    stage.sortChildren();
  }

  // Track container for cleanup
  activeShardsContainers.add(shardsContainer);

  // Get shard color and params
  const color = getColor('regular') || 0xD4A584; // Brown fallback
  const params = getParams('regular') || {};

  // Generate shards from digit area (explode outward)
  const shardCount = 30 + Math.floor(Math.random() * 20); // 30-50 shards per digit
  const shards: ShardParticle[] = [];
  const digitArea = Math.max(digitWidth, digitHeight) * 0.5;

  for (let i = 0; i < shardCount; i++) {
    // Start position: random within digit bounds
    const startX = (Math.random() - 0.5) * digitWidth * 0.6;
    const startY = (Math.random() - 0.5) * digitHeight * 0.6;

    // Target position: explode outward in random direction
    const angle = Math.random() * Math.PI * 2;
    const distance = digitArea * (1.5 + Math.random() * 2.0); // 1.5x-3.5x digit size
    const targetX = Math.cos(angle) * distance;
    const targetY = Math.sin(angle) * distance;

    // Create shard graphics
    const shard = graphicsPool.acquire();
    if (!shard || shard.destroyed) {
      continue;
    }

    shard.clear();
    shard.tint = 0xFFFFFF;
    shard.blendMode = 'normal';
    shard.alpha = 1.0;

    // Draw shard (small irregular polygon)
    const baseSize = 4 + Math.random() * 6; // 4-10px
    const width = baseSize;
    const height = width * (0.8 + Math.random() * 1.4);

    const points = [];
    const numPoints = 4 + Math.floor(Math.random() * 4); // 4-7 points
    
    for (let j = 0; j < numPoints; j++) {
      const pointAngle = (j / numPoints) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
      const radius = (0.3 + Math.random() * 0.7) * Math.min(width, height) / 2;
      const px = Math.cos(pointAngle) * radius;
      const py = Math.sin(pointAngle) * radius;
      points.push(px, py);
    }

    try {
      shard.poly(points).fill({ color: color, alpha: params.lineAlpha || 0.9 });
    } catch (e) {
      // Fallback to rect
      shard.clear();
      shard.rect(-baseSize/2, -baseSize/2, baseSize, baseSize).fill({ color: color, alpha: 0.9 });
    }

    // Set initial position (at digit location)
    shard.x = startX;
    shard.y = startY;
    shard.rotation = Math.random() * Math.PI * 2;
    shard.scale.set(0.6 + Math.random() * 0.4); // 0.6-1.0 scale
    shard.visible = true;
    shard.alpha = 1; // Start visible

    shardsContainer.addChild(shard);

    shards.push({
      graphics: shard,
      startX,
      startY,
      targetX,
      targetY,
      currentX: startX,
      currentY: startY,
      rotation: Math.random() * Math.PI * 2,
      scale: 0.6 + Math.random() * 0.4,
      alpha: 1
    });
  }

  // Animate shards exploding outward
  const explodeTimeline = gsap.timeline({
    onComplete: () => {
      // Cleanup shards container
      activeShardsContainers.delete(shardsContainer);
      
      // Kill all GSAP animations on shards
      shards.forEach(shard => {
        try {
          if (shard.graphics && !shard.graphics.destroyed) {
            gsap.killTweensOf(shard.graphics);
            gsap.killTweensOf(shard.graphics.scale);
            gsap.killTweensOf(shard.graphics.alpha);
            gsap.killTweensOf(shard.graphics.rotation);
          }
        } catch (e) {
          logger.warn('⚠️ Error killing shard tweens:', e);
        }
      });

      if (shardsContainer.parent) {
        shardsContainer.parent.removeChild(shardsContainer);
      }
      shardsContainer.destroy({ children: true });
      
      // Release shards to pool
      shards.forEach(shard => {
        try {
          if (shard.graphics && !shard.graphics.destroyed) {
            graphicsPool.release(shard.graphics);
          }
        } catch (e) {
          logger.warn('⚠️ Error releasing shard to pool:', e);
        }
      });

      onComplete();
    }
  });

  // Animate each shard exploding outward
  shards.forEach((shard, index) => {
    // 🔥 CRITICAL FIX: Validate shard.graphics exists before animating
    if (!shard.graphics || shard.graphics.destroyed) {
      logger.warn(`⚠️ Shard ${index} graphics is null or destroyed, skipping exit animation`);
      return;
    }

    const delay = index * 0.005; // Stagger by 5ms per shard
    
    // Explode outward with rotation
    explodeTimeline.to(shard.graphics, {
      x: shard.targetX,
      y: shard.targetY,
      rotation: shard.rotation + (Math.random() - 0.5) * Math.PI * 4, // Spin 2 full rotations
      alpha: 0,
      duration: 0.5 + Math.random() * 0.3, // 0.5-0.8s
      ease: 'power2.out'
    }, delay);

    // Scale down as they explode
    // 🔥 CRITICAL FIX: Validate scale exists before animating
    if (shard.graphics.scale) {
      explodeTimeline.to(shard.graphics.scale, {
        x: shard.scale * 0.3,
        y: shard.scale * 0.3,
        duration: 0.4,
        ease: 'power2.in'
      }, delay);
    }
  });
}
