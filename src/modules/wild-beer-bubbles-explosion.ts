// @ts-nocheck
// Wild Beer Bubbles Explosion
// Full-screen bubbles explosion effect for wild-beer merge 6 events
// Works independently of board/tile hierarchy (like board-transition-screen)

import { Container, Graphics, Sprite } from 'pixi.js';
import { gsap } from 'gsap';
import animationManager from './animation-manager.js';
import { graphicsPool } from './object-pool.ts';
import { getBubbleColors } from './templates/template-manager.ts';
import { createScreenLifecycle } from '../utils/screen-lifecycle.js';
import { logger } from '../core/logger.js';

const trackTween = (target: any, vars: any) => animationManager.trackExternalTween(gsap.to(target, vars));

const trackDelayedCall = (...args: any[]) => animationManager.trackExternalTween(gsap.delayedCall(...args));

const trackTimeline = (opts?: any) => animationManager.trackExternalTimeline(gsap.timeline(opts));

// Module-level state (like board-transition-screen)
let isExplosionActive = false;
let explosionContainer: Container | null = null;
let spawnTick: (() => void) | null = null;
let safetyTimeoutId: ReturnType<typeof setTimeout> | null = null;
let _cachedBubbleTexture: any = null; // Cached bubble texture for performance
let explosionStartTime: number = 0; // Track when explosion started (for protection against premature cleanup)
let stageRetryCount = 0; // Retry count for stage acquisition during transitions
let cleanupInProgress = false;
let bubblyOverlay: HTMLElement | null = null;
let bubblyTimelinesRef: gsap.core.Timeline[] = [];
let bubblyBounceTimelinesRef: gsap.core.Timeline[] = [];
const lifecycle = createScreenLifecycle('wild-beer-bubbles-explosion');

function getFxHost(stage: any): any {
  if (!stage || stage.destroyed) return null;
  const w = typeof window !== 'undefined' ? (window as any) : null;
  let layer = w ? w.__ccGlobalFxLayer : null;
  const needsNew = !layer || layer.destroyed || layer.parent !== stage;
  if (needsNew) {
    try {
      layer = new Container();
      layer.label = '__ccGlobalFxLayer';
      layer.zIndex = 999900; // Below bubbles container but above everything else
      layer.eventMode = 'none';
      layer.visible = true;
      layer.alpha = 1.0;
      layer.renderable = true;
      layer.position.set(0, 0);
      layer.scale.set(1, 1);
      try { layer.interactiveChildren = false; } catch {}
      if (stage.sortableChildren !== undefined) {
        stage.sortableChildren = true;
      }
      stage.addChild(layer);
      stage.sortChildren?.();
      if (w) w.__ccGlobalFxLayer = layer;
    } catch {
      return stage;
    }
  } else {
    try {
      layer.visible = true;
      layer.alpha = 1.0;
      layer.renderable = true;
      layer.position.set(0, 0);
      layer.scale.set(1, 1);
    } catch {}
  }
  return layer || stage;
}

function forceRenderFrames(frames = 3): void {
  try {
    const windowState = typeof window !== 'undefined' ? (window as any).STATE : null;
    const app = (windowState && windowState.app) || null;
    const stage = (windowState && windowState.stage) || (app && app.stage) || null;
    if (!app || !app.renderer || app.renderer.destroyed || !stage || stage.destroyed) return;

    let remaining = Math.max(1, frames | 0);
    const tick = () => {
      if (!app || !app.renderer || app.renderer.destroyed || !stage || stage.destroyed) return;
      try {
        app.renderer.render(stage);
      } catch {}
      remaining -= 1;
      if (remaining > 0) {
        lifecycle.trackRaf(tick);
      }
    };
    lifecycle.trackRaf(tick);
  } catch {}
}

/**
 * Get the current explosion container (for preservation during boot)
 */
export function getExplosionContainer(): Container | null {
  return explosionContainer && !explosionContainer.destroyed ? explosionContainer : null;
}

/**
 * Set the explosion container (for restoration after boot)
 */
export function setExplosionContainer(container: Container | null): void {
  if (container && !container.destroyed) {
    explosionContainer = container;
    isExplosionActive = true;
    console.log('💧 setExplosionContainer: Container restored', {
      containerVisible: container.visible,
      containerAlpha: container.alpha,
      containerChildren: container.children?.length || 0
    });
  } else {
    explosionContainer = null;
    isExplosionActive = false;
  }
}

// FPS monitoring (from fx.ts)
let fpsMonitorActive: boolean = false;
let fpsFrameCount: number = 0;
let fpsStartTime: number = 0;
let currentFps: number = 60;
let lastFpsCheck: number = 0;

/**
 * Start FPS monitoring
 */
function startFpsMonitoring(): void {
  if (fpsMonitorActive) return;
  fpsMonitorActive = true;
  fpsFrameCount = 0;
  fpsStartTime = performance.now();
  lastFpsCheck = fpsStartTime;
  currentFps = 60;
}

/**
 * Stop FPS monitoring
 */
function stopFpsMonitoring(): void {
  fpsMonitorActive = false;
}

/**
 * Update FPS counter
 */
function updateFpsCounter(): void {
  if (!fpsMonitorActive) return;
  fpsFrameCount++;
  const now = performance.now();
  const elapsed = now - lastFpsCheck;
  if (elapsed >= 1000) {
    currentFps = (fpsFrameCount / elapsed) * 1000;
    fpsFrameCount = 0;
    lastFpsCheck = now;
  }
}

/**
 * Show wild-beer bubbles explosion (full-screen burst)
 * Works independently of board/tile hierarchy
 */
export function showWildBeerBubblesExplosion(): void {
  // 🔥 CRITICAL DEBUG: Log state before checking
  console.log('💧 showWildBeerBubblesExplosion() called', {
    isExplosionActive,
    explosionStartTime,
    hasContainer: !!explosionContainer,
    containerDestroyed: explosionContainer?.destroyed,
    containerParent: explosionContainer?.parent?.label || 'none'
  });

  // 🔥 CRITICAL FIX: Always cleanup stale state first (even if isExplosionActive is false)
  // This ensures we start fresh on every board, even if previous cleanup didn't complete
  if (isExplosionActive || explosionContainer) {
    console.log('🧹 Cleaning up stale bubbles explosion state before starting new one');
    cleanup();
    // 🔥 CRITICAL: Wait a frame to ensure cleanup completes before starting new explosion
    // This prevents race conditions where cleanup and new explosion conflict
    lifecycle.trackRaf(() => {
      showWildBeerBubblesExplosionInternal();
    });
    return;
  }

  showWildBeerBubblesExplosionInternal();
}

/**
 * Internal function to start bubbles explosion (called after cleanup if needed)
 */
function showWildBeerBubblesExplosionInternal(): void {
  const windowState = typeof window !== 'undefined' ? (window as any).STATE : null;
  const app = (windowState && windowState.app) || null;
  const stateStage = (windowState && windowState.stage) || null;
  const appStage = (app && app.stage) || null;
  let stage = stateStage || appStage || null;
  // Prefer app.stage if STATE.stage is stale or destroyed
  if (stage && stage.destroyed && appStage && !appStage.destroyed) {
    stage = appStage;
  } else if (stateStage && appStage && stateStage !== appStage && !appStage.destroyed) {
    stage = appStage;
  }
  const hostContainer = getFxHost(stage);

  // 🔥 CRITICAL FIX: Check if board transition is active - if so, retry after short delay
  // This handles cases where stage is temporarily unavailable during board transition
  const isBoardTransitionActive = (window as any).__ccBoardTransitionActive === true;

  console.log('💧 showWildBeerBubblesExplosionInternal() - checking stage', {
    hasWindowState: !!windowState,
    hasApp: !!app,
    hasStage: !!stage,
    stageDestroyed: stage?.destroyed,
    hasHost: !!hostContainer,
    isBoardTransitionActive
  });

  if (!stage || stage.destroyed || !hostContainer) {
    const maxRetries = 6;
    if (stageRetryCount < maxRetries) {
      stageRetryCount += 1;
      const delay = isBoardTransitionActive ? 100 : 80;
      console.log(`⏸️ Stage unavailable (retry ${stageRetryCount}/${maxRetries})${isBoardTransitionActive ? ' during board transition' : ''}, retrying in ${delay}ms...`);
      lifecycle.trackTimeout(() => {
        showWildBeerBubblesExplosionInternal();
      }, delay);
      return;
    }
    console.warn('⚠️ Cannot start wild-beer bubbles explosion - no stage/host (retries exhausted)');
    stageRetryCount = 0;
    return;
  }
  stageRetryCount = 0;

  // 🔥 CRITICAL: Double-check that cleanup completed (defensive check)
  if (isExplosionActive || explosionContainer) {
    console.warn('⚠️ Bubbles explosion state still active after cleanup, forcing cleanup again');
    cleanup();
    // Wait another frame
    lifecycle.trackRaf(() => {
      showWildBeerBubblesExplosionInternal();
    });
    return;
  }

  // Get screen dimensions
  const screenW = (app && app.renderer && app.renderer.screen) ? app.renderer.screen.width : (typeof window !== 'undefined' ? window.innerWidth : 800);
  const screenH = (app && app.renderer && app.renderer.screen) ? app.renderer.screen.height : (typeof window !== 'undefined' ? window.innerHeight : 600);

  // Create container on stage (full-screen)
  explosionContainer = new Container();
  explosionContainer.label = 'wild-beer-explosion-bubbles';
  // 🔥 CRITICAL FIX: Use maximum zIndex to ensure bubbles are above everything
  explosionContainer.zIndex = 999999; // Above everything (maximum)
  explosionContainer.eventMode = 'none';
  explosionContainer.visible = true;
  explosionContainer.alpha = 1.0;
  explosionContainer.renderable = true;
  try { explosionContainer.interactiveChildren = false; } catch {}

  // Position at stage origin
  explosionContainer.x = 0;
  explosionContainer.y = 0;
  
  // 🔥 DEBUG: Log container setup
  console.log('💧 Container created and positioned', {
    zIndex: explosionContainer.zIndex,
    visible: explosionContainer.visible,
    alpha: explosionContainer.alpha,
    renderable: explosionContainer.renderable,
    x: explosionContainer.x,
    y: explosionContainer.y,
    screenW,
    screenH,
    stageVisible: stage.visible,
    stageAlpha: stage.alpha,
    stageRenderable: stage.renderable
  });

  try {
    // Ensure stage is visible
    if (!stage.visible || stage.alpha === 0 || !stage.renderable) {
      stage.visible = true;
      stage.alpha = 1.0;
      stage.renderable = true;
    }

    // 🔥 CRITICAL FIX: Ensure container is fully set up BEFORE adding to stage
    explosionContainer.visible = true;
    explosionContainer.alpha = 1.0;
    explosionContainer.renderable = true;
    explosionContainer.zIndex = 999999;
    
    // Use global FX layer to avoid HUD transforms/masks
    try {
      if (hostContainer.sortableChildren !== undefined) {
        hostContainer.sortableChildren = true;
      }
    } catch {}
    hostContainer.addChild(explosionContainer);
    
    // 🔥 CRITICAL FIX: Ensure zIndex sorting is enabled
    try {
      if (hostContainer.sortableChildren !== undefined) {
        hostContainer.sortableChildren = true;
      }
    } catch {}

    // 🔥 CRITICAL FIX: Force sort children to ensure zIndex is respected
    // Also ensure container is at the top of the display list
    hostContainer.sortChildren?.();
    
    // 🔥 CRITICAL FIX: Move container to end of children array to ensure it's rendered last (on top)
    try {
      const currentIndex = hostContainer.getChildIndex(explosionContainer);
      const lastIndex = hostContainer.children.length - 1;
      if (currentIndex !== lastIndex) {
        hostContainer.removeChild(explosionContainer);
        hostContainer.addChild(explosionContainer);
        // 🔥 CRITICAL: Re-apply properties after re-adding
        explosionContainer.visible = true;
        explosionContainer.alpha = 1.0;
        explosionContainer.renderable = true;
        explosionContainer.zIndex = 999999;
        hostContainer.sortChildren?.();
        console.log('💧 Container moved to top of display list', {
          previousIndex: currentIndex,
          newIndex: hostContainer.getChildIndex(explosionContainer),
          totalChildren: hostContainer.children.length,
          containerVisible: explosionContainer.visible,
          containerAlpha: explosionContainer.alpha,
          containerRenderable: explosionContainer.renderable
        });
      }
    } catch (e) {
      console.warn('⚠️ Failed to move container to top:', e);
    }
    
    // 🔥 CRITICAL FIX: Force stage to render (ensures container is visible)
    try {
      if (stage.parent && typeof (stage.parent as any).render === 'function') {
        (stage.parent as any).render();
      }
    } catch (e) {
      // Silently fail - not critical
    }

    // Extra safety: force a few render frames to avoid one-frame invisibility
    forceRenderFrames(3);

    // 🔥 DEBUG: Verify container was added to stage
    const containerIndex = hostContainer.getChildIndex(explosionContainer);
    const containerZIndex = explosionContainer.zIndex;
    console.log('💧 Container added to host', {
      containerIndex,
      containerZIndex,
      stageChildren: hostContainer.children.length,
      containerInStage: !!(explosionContainer.parent && explosionContainer.parent === hostContainer),
      containerVisible: explosionContainer.visible,
      containerAlpha: explosionContainer.alpha,
      containerRenderable: explosionContainer.renderable
    });
    
    // 🔥 CRITICAL FIX: Force render to ensure container is visible immediately
    // This is the same pattern used in fx.ts for wild stars animation
    try {
      const windowState = typeof window !== 'undefined' ? (window as any).STATE : null;
      const app = (windowState && windowState.app) || null;
      if (app && app.renderer && !app.renderer.destroyed) {
        app.renderer.render(stage);
        console.log('✅ Forced render frame for bubbles explosion container');
      }
    } catch (e) {
      console.warn('⚠️ Failed to force render frame for bubbles explosion:', e);
    }

    if (!explosionContainer.parent || explosionContainer.parent !== hostContainer) {
      console.error('❌ Failed to add explosion container to stage!', {
        hasParent: !!explosionContainer.parent,
        parentIsStage: explosionContainer.parent === hostContainer,
        stageChildren: hostContainer.children.length
      });
      cleanup();
      return;
    }
  } catch (e) {
    console.error('❌ Failed to add explosion container to stage:', e);
    cleanup();
    return;
  }

  isExplosionActive = true;
  explosionStartTime = performance.now(); // Track when explosion started
  // 🔥 CRITICAL: Store start time globally so startLevel() can check elapsed time
  (window as any).__ccBubblesExplosionStartTime = explosionStartTime;

  // Safety timeout (4.4s)
  if (safetyTimeoutId) {
    try { clearTimeout(safetyTimeoutId); } catch {}
  }
  safetyTimeoutId = lifecycle.trackTimeout(() => {
    safetyTimeoutId = null;
    if (isExplosionActive) {
      console.warn('⚠️ Bubbles explosion safety timeout (4.4s) - forcing cleanup');
      cleanup();
    }
  }, 4400);

  // Start FPS monitoring
  if (!fpsMonitorActive) {
    startFpsMonitoring();
    trackDelayedCall(2.0, () => {
      stopFpsMonitoring();
    });
  }

  // Initialize bubble texture
  initializeBubbleTexture(app);

  // Get bubble colors from template
  let bubbleColors;
  try {
    bubbleColors = getBubbleColors('wild-beer');
    if (!bubbleColors || !Array.isArray(bubbleColors) || bubbleColors.length === 0) {
      bubbleColors = [0xFFFFFF, 0xFFF5E6, 0xFFE8D1, 0xFFDCC2]; // Default
    }
  } catch (err) {
    console.error('❌ Failed to get bubble colors from template:', err);
    bubbleColors = [0xFFFFFF, 0xFFF5E6, 0xFFE8D1, 0xFFDCC2]; // Default
  }

  // Animation parameters
  const isMobile = typeof window !== 'undefined' && (window.innerWidth < 768 || window.innerHeight > window.innerWidth);
  const totalBubbles = isMobile ? 40 : 70; // FPS optimized
  const spawnDuration = 1500; // 1.5s
  const maxActive = isMobile ? 32 : 60;
  let active = 0;
  let spawned = 0;
  const perMs = totalBubbles / spawnDuration;
  let startTime = performance.now();
  let lastTick = startTime;
  let acc = 0;

  const bubbleTexture = _cachedBubbleTexture;
  const useTexturePooling = bubbleTexture !== null && !bubbleTexture.destroyed;

  // Create bubble function
  const makeBubble = () => {
    if (!explosionContainer || explosionContainer.destroyed) {
      console.warn('⚠️ makeBubble: No container or container destroyed');
      return;
    }
    
    try {
      if (!explosionContainer.parent || explosionContainer.parent.destroyed) {
        console.warn('⚠️ makeBubble: Container not in stage or stage destroyed', {
          hasParent: !!explosionContainer.parent,
          parentDestroyed: explosionContainer.parent?.destroyed
        });
        return;
      }
      
      if (!explosionContainer.visible || explosionContainer.alpha === 0 || !explosionContainer.renderable) {
        explosionContainer.visible = true;
        explosionContainer.alpha = 1.0;
        explosionContainer.renderable = true;
        console.log('💧 makeBubble: Fixed container visibility', {
          visible: explosionContainer.visible,
          alpha: explosionContainer.alpha,
          renderable: explosionContainer.renderable
        });
      }
      
      const stage = explosionContainer.parent;
      if (stage && (!stage.visible || stage.alpha === 0 || !stage.renderable)) {
        stage.visible = true;
        stage.alpha = 1.0;
        stage.renderable = true;
        console.log('💧 makeBubble: Fixed stage visibility', {
          visible: stage.visible,
          alpha: stage.alpha,
          renderable: stage.renderable
        });
      }
    } catch (e) {
      console.error('❌ makeBubble: Error checking container/stage:', e);
      return;
    }
    
    if (spawned >= totalBubbles || active >= maxActive) {
      if (spawned >= totalBubbles) {
        logger.debug('makeBubble: Max bubbles reached', undefined, { spawned, totalBubbles });
      }
      if (active >= maxActive) {
        logger.debug('makeBubble: Max active bubbles reached', undefined, { active, maxActive });
      }
      return;
    }

    spawned += 1;
    active += 1;
    
    // 🔥 DEBUG: Log first few bubbles to verify they're being created
    if (spawned <= 3) {
      console.log(`💧 makeBubble: Created bubble ${spawned}/${totalBubbles}`, {
        active,
        container: !!explosionContainer,
        containerVisible: explosionContainer?.visible,
        containerInStage: !!(explosionContainer?.parent)
      });
    }

    let bubble: Graphics | Sprite;
    // Bubble size
    const size = 30 + Math.random() * 50; // 30-80px
    const sizeRatio = size / 80; // Adjusted for max size
    const radius = size / 2;
    const alpha = 0.8 + Math.random() * 0.2; // 0.8-1.0

    let isSprite = false;
    if (useTexturePooling && bubbleTexture) {
      try {
        bubble = new Sprite(bubbleTexture);
        bubble.eventMode = 'none';
        bubble.cursor = 'default';
        (bubble as Sprite).anchor.set(0.5);
        isSprite = true;
      } catch (e) {
        bubble = graphicsPool.acquire();
        bubble.eventMode = 'none';
        bubble.cursor = 'default';
        (bubble as Graphics).clear();
        const bubbleColorForGraphics = bubbleColors[Math.floor(Math.random() * bubbleColors.length)];
        (bubble as Graphics).circle(0, 0, radius);
        (bubble as Graphics).fill({ color: bubbleColorForGraphics, alpha });
        (bubble as Graphics).circle(-radius * 0.25, -radius * 0.25, radius * 0.32);
        (bubble as Graphics).fill({ color: bubbleColorForGraphics, alpha: Math.min(1, alpha + 0.2) });
        (bubble as Graphics).circle(0, 0, radius);
        (bubble as Graphics).stroke({ color: bubbleColorForGraphics, alpha: alpha * 0.65, width: 1 });
        isSprite = false;
      }
    } else {
      bubble = graphicsPool.acquire();
      bubble.eventMode = 'none';
      bubble.cursor = 'default';
      (bubble as Graphics).clear();
      const bubbleColorForGraphics = bubbleColors[Math.floor(Math.random() * bubbleColors.length)];
      (bubble as Graphics).circle(0, 0, radius);
      (bubble as Graphics).fill({ color: bubbleColorForGraphics, alpha });
      (bubble as Graphics).circle(-radius * 0.25, -radius * 0.25, radius * 0.32);
      (bubble as Graphics).fill({ color: bubbleColorForGraphics, alpha: Math.min(1, alpha + 0.2) });
      (bubble as Graphics).circle(0, 0, radius);
      (bubble as Graphics).stroke({ color: bubbleColorForGraphics, alpha: alpha * 0.65, width: 1 });
      isSprite = false;
    }
    
    // Random distribution
    // 🔥 START POSITION: Spawn BELOW the viewport for premium feel
    // - Mobile: keep legacy behavior (95–115% of screen height)
    // - Desktop/tablet: start further below (108–128% of screen height)
    const startX = (Math.random() - 0.5) * screenW * 1.4 + screenW * 0.5;
    const isMobile = screenW < 768 || screenH > screenW;
    const startYPercent = isMobile
      ? 0.95 + Math.random() * 0.20   // 95–115% (legacy mobile)
      : 1.08 + Math.random() * 0.20;  // 108–128% (below viewport)
    const startY = screenH * startYPercent;

    bubble.x = startX;
    bubble.y = startY;
    bubble.alpha = alpha;
    // Bubble scale
    const bubbleScale = isSprite ? (0.5 + Math.random() * 0.4) * sizeRatio : (0.5 + Math.random() * 0.4);
    if (isSprite) {
      bubble.scale.set(bubbleScale);
    } else {
      bubble.scale.set(bubbleScale);
    }
    bubble.renderable = true;
    bubble.visible = true;

    // 🔥 DEBUG: Log bubble properties for first few bubbles
    if (spawned <= 5) {
      console.log(`💧 makeBubble: Bubble ${spawned} properties`, {
        x: bubble.x,
        y: bubble.y,
        alpha: bubble.alpha,
        scale: bubbleScale,
        visible: bubble.visible,
        renderable: bubble.renderable,
        isSprite,
        size,
        radius,
        startX,
        startY,
        screenW,
        screenH,
        containerChildren: explosionContainer.children.length,
        containerZIndex: explosionContainer.zIndex
      });
    }

    // 🔥 CRITICAL FIX: Ensure bubble is visible and renderable BEFORE adding to container
    bubble.visible = true;
    bubble.renderable = true;
    bubble.alpha = alpha;
    
    explosionContainer.addChild(bubble);
    
    // 🔥 CRITICAL FIX: Force update bubble properties after adding to container
    // This ensures bubble is properly rendered even if container was just created
    bubble.visible = true;
    bubble.renderable = true;
    bubble.alpha = alpha;
    
    // 🔥 DEBUG: Verify bubble was added and is visible
    if (spawned <= 5) {
      const added = explosionContainer.children.includes(bubble);
      const bubbleInContainer = explosionContainer.children.indexOf(bubble) >= 0;
      const containerVisible = explosionContainer.visible && explosionContainer.alpha > 0 && explosionContainer.renderable;
      const bubbleVisible = bubble.visible && bubble.alpha > 0 && bubble.renderable;
      console.log(`💧 makeBubble: Bubble ${spawned} added to container: ${added}, bubbleInContainer: ${bubbleInContainer}, container children: ${explosionContainer.children.length}`, {
        bubbleVisible,
        bubbleAlpha: bubble.alpha,
        bubbleRenderable: bubble.renderable,
        containerVisible,
        containerAlpha: explosionContainer.alpha,
        containerRenderable: explosionContainer.renderable,
        containerInStage: !!(explosionContainer.parent),
        stageVisible: explosionContainer.parent?.visible,
        stageAlpha: explosionContainer.parent?.alpha
      });
    }

    const endY = -screenH * (0.1 + Math.random() * 0.15); // End 10-25% above top
    const duration = Math.min(2.1, Math.max(1.1, 1.6 + (Math.random() - 0.5) * 0.6)); // 1.1-2.1s
    const driftX = (Math.random() - 0.5) * 100; // ±50px horizontal drift

    const bubbleTweens: gsap.core.Tween[] = [];

    // Vertical rise + drift
    bubbleTweens.push(trackTween(bubble, {
      x: startX + driftX,
      y: endY,
      duration,
      ease: 'power2.inOut',
      immediateRender: true,
      onStart: () => {
        // 🔥 DEBUG: Log animation start for first few bubbles
        if (spawned <= 5) {
          console.log(`💧 Bubble ${spawned} animation started`, {
            startX: bubble.x,
            startY: bubble.y,
            endX: startX + driftX,
            endY,
            duration,
            bubbleVisible: bubble.visible,
            bubbleAlpha: bubble.alpha,
            bubbleScale: bubble.scale.x,
            containerVisible: explosionContainer.visible,
            containerAlpha: explosionContainer.alpha
          });
        }
      }
    }));

    // Scale animation
    const finalScale = 0.65 + Math.random() * 0.35;
    bubbleTweens.push(trackTween(bubble.scale, {
      x: isSprite ? finalScale * sizeRatio : finalScale,
      y: isSprite ? finalScale * sizeRatio : finalScale,
      duration: duration * 0.45,
      ease: 'power1.out',
      immediateRender: true
    }));

    // Alpha fade
    bubbleTweens.push(trackTween(bubble, {
      alpha: 0,
      duration: duration * 0.4,
      delay: duration * 0.6,
      ease: 'power2.in',
      immediateRender: true,
      onComplete: () => {
        try {
          bubbleTweens.forEach(t => { try { t.kill?.(); } catch {} });
          if (bubble && bubble.parent) bubble.parent.removeChild(bubble);
          if (bubble instanceof Sprite) {
            bubble.destroy();
          } else {
            graphicsPool.release(bubble as Graphics);
          }
        } catch {}
        active = Math.max(0, active - 1);
      }
    }));

    (bubble as any)._bubbleTweens = bubbleTweens;
  };

  // Spawn ticker
  let frameCounter = 0;
  const spawnTicker = () => {
    if (cleanupInProgress || !isExplosionActive) {
      if (spawnTick === spawnTicker) {
        try { gsap.ticker.remove(spawnTicker); } catch {}
        spawnTick = null;
      }
      return;
    }
    // Debug: first few frames and every 10th (use logger.debug in dev only)
    if (typeof logger !== 'undefined' && (frameCounter < 5 || frameCounter % 30 === 0)) {
      logger.debug(`spawnTicker: Frame ${frameCounter}`, undefined, { spawned, active, isExplosionActive });
    }
    
    if (!explosionContainer || explosionContainer.destroyed) {
      console.warn('⚠️ spawnTicker: Container missing or destroyed, stopping');
      if (spawnTick === spawnTicker) {
        try {
          gsap.ticker.remove(spawnTicker);
        } catch (e) {
          console.warn('⚠️ spawnTicker: Failed to remove ticker:', e);
        }
        spawnTick = null;
      }
      isExplosionActive = false;
      cleanup();
      return;
    }
    
    try {
      const windowState = typeof window !== 'undefined' ? (window as any).STATE : null;
      const app = (windowState && windowState.app) || null;
      const stateStage = (windowState && windowState.stage) || null;
      const appStage = (app && app.stage) || null;
      const currentStage = (appStage && !appStage.destroyed) ? appStage : stateStage;
      const currentHost = getFxHost(currentStage);

      if (currentHost && explosionContainer.parent !== currentHost) {
        try {
          if (explosionContainer.parent) explosionContainer.parent.removeChild(explosionContainer);
          if (currentHost.sortableChildren !== undefined) {
            currentHost.sortableChildren = true;
          }
          currentHost.addChild(explosionContainer);
          currentHost.sortChildren?.();
          console.log('💧 spawnTicker: Reattached bubbles container to current host');
          forceRenderFrames(2);
        } catch (e) {
          console.warn('⚠️ spawnTicker: Failed to reattach container to current host:', e);
        }
      }

      if (!explosionContainer.parent || explosionContainer.parent.destroyed) {
        console.warn('⚠️ spawnTicker: Container not in stage or stage destroyed', {
          frameCounter,
          hasParent: !!explosionContainer.parent,
          parentDestroyed: explosionContainer.parent?.destroyed,
          containerDestroyed: explosionContainer.destroyed
        });
        if (spawnTick === spawnTicker) {
          try {
            gsap.ticker.remove(spawnTicker);
          } catch (e) {
            console.warn('⚠️ spawnTicker: Failed to remove ticker:', e);
          }
          spawnTick = null;
        }
        isExplosionActive = false;
        cleanup();
        return;
      }
      
      // 🔥 CRITICAL FIX: Always ensure container is visible and renderable
      // This fixes issue where container might be hidden between board transitions
      if (!explosionContainer.visible || explosionContainer.alpha === 0 || !explosionContainer.renderable) {
        console.log(`💧 spawnTicker: Fixing container visibility (frame ${frameCounter})`, {
          wasVisible: explosionContainer.visible,
          wasAlpha: explosionContainer.alpha,
          wasRenderable: explosionContainer.renderable
        });
        explosionContainer.visible = true;
        explosionContainer.alpha = 1.0;
        explosionContainer.renderable = true;
      }
      
      // 🔥 CRITICAL FIX: Ensure all bubbles in container are visible and renderable
      // This fixes issue where bubbles might be hidden even though container is visible
      try {
        for (let i = 0; i < explosionContainer.children.length; i++) {
          const child = explosionContainer.children[i];
          if (child && !child.destroyed) {
            if (!child.visible || child.alpha === 0 || !child.renderable) {
              child.visible = true;
              child.alpha = Math.max(0.5, child.alpha || 1.0);
              child.renderable = true;
            }
          }
        }
      } catch (e) {
        // Silently fail - not critical
      }
      
      const stage = explosionContainer.parent;
      if (stage && (!stage.visible || stage.alpha === 0 || !stage.renderable)) {
        console.log(`💧 spawnTicker: Fixing stage visibility (frame ${frameCounter})`, {
          wasVisible: stage.visible,
          wasAlpha: stage.alpha,
          wasRenderable: stage.renderable
        });
        stage.visible = true;
        stage.alpha = 1.0;
        stage.renderable = true;
      }
      
      // 🔥 CRITICAL FIX: Ensure container is at the top of display list (highest zIndex)
      // This fixes issue where container might be behind other elements between board transitions
      try {
        const currentZIndex = explosionContainer.zIndex || 0;
        if (currentZIndex < 999999) {
          explosionContainer.zIndex = 999999;
          stage.sortChildren?.();
          if (frameCounter < 5 || frameCounter % 20 === 0) {
            console.log(`💧 spawnTicker: Fixed container zIndex to 999999 (frame ${frameCounter})`);
          }
        }
      } catch (e) {
        // Silently fail - not critical
      }
    } catch (e) {
      console.error(`❌ spawnTicker: Error checking container/stage (frame ${frameCounter}):`, e);
      if (spawnTick === spawnTicker) {
        try {
          gsap.ticker.remove(spawnTicker);
        } catch {}
        spawnTick = null;
      }
      isExplosionActive = false;
      cleanup();
      return;
    }

    frameCounter++;
    
    // Throttle FPS monitoring
    if (frameCounter % 4 === 0) {
      try {
        updateFpsCounter();
      } catch (e) {
        console.warn('⚠️ FPS counter update failed:', e);
      }
    }
    
    // Throttle spawn logic
    if (frameCounter % 2 === 0) {
      const now = performance.now();
      const dt = Math.max(1, now - lastTick);
      lastTick = now;
      const elapsed = now - startTime;

      if (elapsed >= spawnDuration && spawned >= totalBubbles) {
        if (spawnTick === spawnTicker) {
          gsap.ticker.remove(spawnTicker);
          spawnTick = null;
        }
        lifecycle.trackTimeout(() => cleanup(), 2400);
        return;
      }
      
      if (elapsed >= spawnDuration + 2400 && spawned < totalBubbles) {
        if (spawnTick === spawnTicker) {
          gsap.ticker.remove(spawnTicker);
          spawnTick = null;
        }
        lifecycle.trackTimeout(() => cleanup(), 0);
        return;
      }

      const safeFps = (typeof currentFps !== 'undefined' && currentFps !== null) ? currentFps : 60;
      const fpsFactor = safeFps >= 50 ? 1.0 : Math.max(0.5, safeFps / 50);
      acc += perMs * dt * fpsFactor;
      const toSpawn = Math.min(2, Math.floor(acc));
      if (toSpawn > 0) {
        acc -= toSpawn;
        // 🔥 DEBUG: Log spawn attempts
        if (spawned < 5) {
          console.log(`💧 spawnTicker: Attempting to spawn ${toSpawn} bubbles (spawned: ${spawned}, active: ${active})`);
        }
        for (let i = 0; i < toSpawn; i++) {
          if (safeFps < 30 && spawned >= totalBubbles * 0.7) {
            break;
          }
          try {
            makeBubble();
          } catch (e) {
            console.error(`❌ spawnTicker: Failed to create bubble ${i}:`, e);
          }
        }
        if (spawned < 5) {
          console.log(`💧 spawnTicker: After spawn attempt (spawned: ${spawned}, active: ${active})`);
        }
      }
    }
    
    // Culling
    if (frameCounter % 5 === 0) {
      const elapsed = performance.now() - startTime;
      if (elapsed > 0.5) {
        try {
          const children = explosionContainer.children || [];
          const cullMargin = 50;
          for (let i = 0; i < children.length; i++) {
            const bubble = children[i];
            if (bubble && bubble.y !== undefined) {
              if (bubble.y < -cullMargin || bubble.y > screenH + cullMargin) {
                bubble.visible = false;
              } else {
                bubble.visible = true;
              }
            }
          }
        } catch (e) {
          // Silently fail
        }
      }
    }
  };

  // Initial burst
  const initialBurst = Math.floor(totalBubbles / 20);
  console.log(`💧 Starting bubbles explosion: initialBurst=${initialBurst}, totalBubbles=${totalBubbles}, container=${!!explosionContainer}, containerInStage=${!!(explosionContainer?.parent)}`);
  for (let i = 0; i < initialBurst; i++) {
    try {
      makeBubble();
    } catch (e) {
      console.error(`❌ Failed to create initial bubble ${i}:`, e);
    }
  }
  console.log(`💧 Initial burst completed: spawned=${spawned}, active=${active}, container=${!!explosionContainer}, containerVisible=${explosionContainer?.visible}`);
  
  // Start spawn ticker
  spawnTick = spawnTicker;
  explosionContainer._bubbleSpawnTicker = spawnTicker;
  try {
    gsap.ticker.add(spawnTicker);
    console.log('✅ GSAP ticker added for bubbles spawn');
  } catch (e) {
    console.error('❌ Failed to add GSAP ticker:', e);
  }
  
  try {
    spawnTicker();
    console.log('✅ Initial spawnTicker() call completed');
  } catch (e) {
    console.error('❌ Failed to call initial spawnTicker():', e);
  }

  console.log('✅ Wild-beer bubbles explosion started', {
    isExplosionActive,
    hasContainer: !!explosionContainer,
    containerInStage: !!(explosionContainer?.parent),
    containerVisible: explosionContainer?.visible,
    containerAlpha: explosionContainer?.alpha,
    containerRenderable: explosionContainer?.renderable,
    initialBurstSpawned: spawned,
    activeBubbles: active,
    tickerAdded: !!spawnTick
  });

  // BUBBLY text overlay – centar viewporta (kao BOOM za TNT)
  createAndShowBubblyText();
  
  // 🔥 CRITICAL FIX: Force render again after initial burst to ensure bubbles are visible
  // This ensures bubbles are rendered immediately after creation (same pattern as fx.ts for wild stars)
  lifecycle.trackTimeout(() => {
    try {
      const windowState = typeof window !== 'undefined' ? (window as any).STATE : null;
      const app = (windowState && windowState.app) || null;
      const stage = (windowState && windowState.stage) || (app && app.stage) || null;
      if (app && app.renderer && !app.renderer.destroyed && stage && explosionContainer && !explosionContainer.destroyed) {
        // Ensure container and all bubbles are visible
        explosionContainer.visible = true;
        explosionContainer.alpha = 1.0;
        explosionContainer.renderable = true;
        for (let i = 0; i < explosionContainer.children.length; i++) {
          const child = explosionContainer.children[i];
          if (child && !child.destroyed) {
            child.visible = true;
            child.alpha = Math.max(0.5, child.alpha || 1.0);
            child.renderable = true;
          }
        }
        app.renderer.render(stage);
        console.log('✅ Forced render frame after initial burst - bubbles should now be visible', {
          containerChildren: explosionContainer.children.length,
          containerVisible: explosionContainer.visible,
          containerAlpha: explosionContainer.alpha
        });
      }
    } catch (e) {
      console.warn('⚠️ Failed to force render after initial burst:', e);
    }
  }, 100);
}

/**
 * Stop wild-beer bubbles explosion
 */
export function stopWildBeerBubblesExplosion(): void {
  // 🔥 CRITICAL DEBUG: Log cleanup call to track premature cleanup
  const wasActive = isExplosionActive;
  const wasRecentlyStarted = isWildBeerBubblesExplosionRecentlyStarted();
  const elapsed = explosionStartTime > 0 ? performance.now() - explosionStartTime : 0;
  
  console.log('🛑 stopWildBeerBubblesExplosion() called', {
    wasActive,
    wasRecentlyStarted,
    elapsed: elapsed > 0 ? `${elapsed.toFixed(0)}ms` : 'N/A',
    hasContainer: !!explosionContainer,
    containerInStage: !!(explosionContainer?.parent),
    containerVisible: explosionContainer?.visible,
    containerChildren: explosionContainer?.children?.length || 0
  });
  
  // 🔥 CRITICAL FIX: Don't cleanup if explosion was just started (< 100ms ago)
  // This prevents premature cleanup on new board where animation might be starting
  if (wasRecentlyStarted && elapsed < 100) {
    console.warn('⚠️ stopWildBeerBubblesExplosion: Explosion just started (< 100ms ago), skipping cleanup to prevent premature stop');
    return;
  }
  
  cleanup();
}

/**
 * Force stop wild-beer bubbles explosion (bypass recent-start guard).
 */
export function forceStopWildBeerBubblesExplosion(): void {
  cleanup();
}

/**
 * Destroy cached bubble texture to release GPU memory (call on hard cleanup).
 */
export function destroyWildBeerBubblesExplosionCache(): void {
  if (_cachedBubbleTexture && !_cachedBubbleTexture.destroyed) {
    try {
      _cachedBubbleTexture.destroy(true);
    } catch {}
  }
  _cachedBubbleTexture = null;
}

/**
 * Check if explosion was recently started (within last 5 seconds)
 * Used to protect animation from premature cleanup during board transitions
 */
export function isWildBeerBubblesExplosionRecentlyStarted(): boolean {
  if (!isExplosionActive || explosionStartTime === 0) return false;
  const elapsed = performance.now() - explosionStartTime;
  return elapsed < 5000; // Within last 5 seconds
}

/**
 * Check if explosion is active
 */
export function isWildBeerBubblesExplosionActive(): boolean {
  return isExplosionActive;
}

// Track pending waiters so cleanup can resolve them (prevents hangs)
const _explosionWaiters = new Set<() => void>();

/**
 * Wait for explosion to complete
 */
export function waitForBubblesExplosionToComplete(maxWaitMs = 5000): Promise<void> {
  return new Promise((resolve) => {
    if (!isExplosionActive) {
      resolve();
      return;
    }

    let resolved = false;
    let checkInterval: NodeJS.Timeout | null = null;
    const safeResolve = () => {
      if (resolved) return;
      resolved = true;
      if (checkInterval) {
        try { clearInterval(checkInterval); } catch {}
        checkInterval = null;
      }
      _explosionWaiters.delete(safeResolve);
      resolve();
    };

    _explosionWaiters.add(safeResolve);

    const startTime = performance.now();
    checkInterval = setInterval(() => {
      if (!isExplosionActive) {
        safeResolve();
        return;
      }

      const elapsed = performance.now() - startTime;
      if (elapsed >= maxWaitMs) {
        console.warn('⚠️ Bubbles explosion wait timeout, forcing cleanup');
        cleanup();
        safeResolve();
      }
    }, 100);
  });
}

/**
 * Initialize bubble texture
 */
function initializeBubbleTexture(app: any): void {
  if (_cachedBubbleTexture && !_cachedBubbleTexture.destroyed) {
    return;
  }

  if (!app || !app.renderer) {
    return;
  }

  let bubbleColors;
  try {
    bubbleColors = getBubbleColors('wild-beer');
    if (!bubbleColors || !Array.isArray(bubbleColors) || bubbleColors.length === 0) {
      bubbleColors = [0xFFFFFF, 0xFFF5E6, 0xFFE8D1, 0xFFDCC2];
    }
  } catch (err) {
    bubbleColors = [0xFFFFFF, 0xFFF5E6, 0xFFE8D1, 0xFFDCC2];
  }

  const bubbleColorForTexture = bubbleColors[0] || 0xFFFFFF;
  const maxSize = 48;
  const maxRadius = maxSize / 2;
  const tempGraphics = new Graphics();

  try {
    tempGraphics.circle(0, 0, maxRadius);
    tempGraphics.fill({ color: bubbleColorForTexture, alpha: 1.0 });
    tempGraphics.circle(-maxRadius * 0.25, -maxRadius * 0.25, maxRadius * 0.32);
    tempGraphics.fill({ color: bubbleColorForTexture, alpha: 1.0 });
    tempGraphics.circle(0, 0, maxRadius);
    tempGraphics.stroke({ color: bubbleColorForTexture, alpha: 0.65, width: 1 });

    try {
      _cachedBubbleTexture = app.renderer.generateTexture(tempGraphics, {
        resolution: 2,
        region: { x: -maxRadius - 2, y: -maxRadius - 2, width: maxSize + 4, height: maxSize + 4 }
      });
      if (!_cachedBubbleTexture || _cachedBubbleTexture.destroyed) {
        throw new Error('Texture generation returned invalid texture');
      }
      try {
        _cachedBubbleTexture.label = 'runtime:wild-beer-bubbles-explosion';
        const src = (_cachedBubbleTexture as { source?: { label?: string }; baseTexture?: { label?: string } }).source ?? _cachedBubbleTexture.baseTexture;
        if (src) src.label = _cachedBubbleTexture.label;
        const rt = (window as any).__ccRuntimeTextures || ((window as any).__ccRuntimeTextures = new Set());
        rt.add?.(_cachedBubbleTexture);
      } catch {}
    } catch (e1) {
      try {
        _cachedBubbleTexture = app.renderer.generateTexture(tempGraphics, {
          resolution: 1,
          region: { x: -maxRadius - 2, y: -maxRadius - 2, width: maxSize + 4, height: maxSize + 4 }
        });
        if (!_cachedBubbleTexture || _cachedBubbleTexture.destroyed) {
          throw new Error('Low-res texture generation returned invalid texture');
        }
        try {
          _cachedBubbleTexture.label = 'runtime:wild-beer-bubbles-explosion';
          const src = (_cachedBubbleTexture as { source?: { label?: string }; baseTexture?: { label?: string } }).source ?? _cachedBubbleTexture.baseTexture;
        if (src) src.label = _cachedBubbleTexture.label;
          const rt = (window as any).__ccRuntimeTextures || ((window as any).__ccRuntimeTextures = new Set());
          rt.add?.(_cachedBubbleTexture);
        } catch {}
      } catch (e2) {
        try {
          _cachedBubbleTexture = app.renderer.generateTexture(tempGraphics, {
            resolution: 1
          });
          if (!_cachedBubbleTexture || _cachedBubbleTexture.destroyed) {
            throw new Error('Auto-region texture generation returned invalid texture');
          }
          try {
            _cachedBubbleTexture.label = 'runtime:wild-beer-bubbles-explosion';
            const src = (_cachedBubbleTexture as { source?: { label?: string }; baseTexture?: { label?: string } }).source ?? _cachedBubbleTexture.baseTexture;
        if (src) src.label = _cachedBubbleTexture.label;
            const rt = (window as any).__ccRuntimeTextures || ((window as any).__ccRuntimeTextures = new Set());
            rt.add?.(_cachedBubbleTexture);
          } catch {}
        } catch (e3) {
          _cachedBubbleTexture = null;
        }
      }
    }
  } catch (e) {
    _cachedBubbleTexture = null;
  } finally {
    try {
      tempGraphics.destroy();
    } catch (e) {
      console.warn('⚠️ Failed to destroy temp Graphics:', e);
    }
  }
}

// BUBBLY constants – isti kao TNT BOOM
const BUBBLY_ENTER_BOUNCE_SCALE = 1.2;
const BUBBLY_ENTER_DURATION = 0.24;
const BUBBLY_SETTLE_DURATION = 0.1;
const BUBBLY_FINAL_SETTLE_DURATION = 0.1;
const BUBBLY_ENTER_DELAY = 0.3;
const BUBBLY_ENTER_STAGGER = 0.05;
const BUBBLY_EXIT_STAGGER = 0.06;
const BUBBLY_ENTER_EXTRA = 0.1;
const BUBBLY_EXIT_EXTRA = 0.3;
const BUBBLY_EXIT_BOUNCE_DURATION = 0.13;
const BUBBLY_EXIT_FADE_DURATION = 0.17;

/**
 * BUBBLY text overlay – isti dizajn, font, boja, enter/exit animacije kao TNT BOOM
 */
function createAndShowBubblyText(): void {
  try {
    cleanupBubblyOverlay();
    const overlay = document.createElement('div');
    overlay.style.cssText = [
      'position: fixed',
      'top: 0',
      'left: 0',
      'width: 100%',
      'height: 100%',
      'pointer-events: none',
      'z-index: 9999999',
      'display: flex',
      'align-items: center',
      'justify-content: center',
    ].join(';');
    bubblyOverlay = overlay;

    const bubblyContainer = document.createElement('div');
    bubblyContainer.style.cssText = [
      'position: absolute',
      'left: 50%',
      'top: 50%',
      'transform: translate(-50%, -50%)',
      'display: flex',
      'flex-direction: row',
      'align-items: center',
      'justify-content: center',
      'gap: -4px',
      'margin: 0',
      'padding: 0',
      'width: fit-content',
      'min-width: 0',
      'max-width: 100%',
      'box-sizing: border-box',
      'z-index: 2',
      'pointer-events: none',
      'perspective: 1000px',
      'transform-style: preserve-3d',
    ].join(';');

    const bubblyLetters: HTMLElement[] = [];
    const bubblyScales: number[] = [];
    const bubblyRotations: number[] = [];
    const bubblyText = ['B', 'U', 'B', 'B', 'L', 'Y'];
    const dropShadow = 'drop-shadow(5px 12px 16.1px rgba(183, 152, 139, 0.5))';

    bubblyText.forEach((letter) => {
      const letterScale = 0.9 + Math.random() * 0.4;
      const rotation = (Math.random() - 0.5) * 24;
      const letterEl = document.createElement('span');
      letterEl.textContent = letter;
      letterEl.style.cssText = [
        'font-family: "LTCrow", system-ui, -apple-system, sans-serif',
        'font-weight: 800',
        'font-size: 83px',
        'line-height: 1',
        'color: #FFF',
        'text-align: center',
        'opacity: 0',
        'transform: scale(0) perspective(1000px) translateZ(0)',
        'display: inline-block',
        'visibility: visible',
        'pointer-events: none',
        'margin-right: 0',
        'padding: 0',
        'border: 0',
        'outline: 0',
        'vertical-align: top',
        `filter: ${dropShadow}`,
        'transform-style: preserve-3d',
        'backface-visibility: hidden',
        '-webkit-font-smoothing: antialiased',
        '-moz-osx-font-smoothing: grayscale',
        'text-rendering: optimizeLegibility',
        'transform-origin: center center',
        'position: relative',
        'z-index: 10'
      ].join(';');
      bubblyContainer.appendChild(letterEl);
      bubblyLetters.push(letterEl);
      bubblyScales.push(letterScale);
      bubblyRotations.push(rotation);

      const bounceTl = trackTimeline({ repeat: -1, yoyo: true });
      bounceTl.pause(0);
      bounceTl.to(letterEl, {
        scale: letterScale * (1.02 + Math.random() * 0.06),
        rotation: rotation * 1.1,
        duration: 0.35,
        ease: 'elastic.inOut(1, 0.2)'
      });
      bubblyBounceTimelinesRef.push(bounceTl);
      gsap.set(letterEl, { rotation });
    });

    overlay.appendChild(bubblyContainer);
    document.body.appendChild(overlay);

    let bubblyExitStarted = false;
    const startBubblyExit = () => {
      if (bubblyExitStarted) return;
      bubblyExitStarted = true;
      bubblyBounceTimelinesRef.forEach((tl) => {
        try { tl.kill(); } catch {}
      });
      bubblyLetters.forEach((letterEl, index) => {
        const delay = index * BUBBLY_EXIT_STAGGER;
        const exitTl = trackTimeline({ delay });
        bubblyTimelinesRef.push(exitTl);
        const baseScale = bubblyScales[index] ?? 1;
        const baseRot = bubblyRotations[index] ?? 0;
        const exitRotation = (baseRot >= 0 ? 1 : -1) * (12 + Math.random() * 8);
        exitTl.to(letterEl, {
          scale: baseScale * 1.1,
          z: 30,
          duration: BUBBLY_EXIT_BOUNCE_DURATION + BUBBLY_EXIT_EXTRA * 0.2,
          ease: 'power2.out'
        });
        exitTl.to(letterEl, {
          opacity: 0,
          scale: 0,
          rotation: exitRotation,
          rotationX: baseRot >= 0 ? 45 : -45,
          rotationY: baseRot >= 0 ? 30 : -30,
          z: -100,
          duration: BUBBLY_EXIT_FADE_DURATION + BUBBLY_EXIT_EXTRA * 0.8,
          ease: 'power2.in'
        });
      });
      trackDelayedCall(
        BUBBLY_EXIT_STAGGER * bubblyLetters.length +
        BUBBLY_EXIT_BOUNCE_DURATION + BUBBLY_EXIT_EXTRA * 0.2 +
        BUBBLY_EXIT_FADE_DURATION + BUBBLY_EXIT_EXTRA * 0.8 + 0.1,
        () => cleanupBubblyOverlay()
      );
    };

    let bubblyEnterComplete = 0;
    bubblyLetters.forEach((letterEl, index) => {
      const delay = BUBBLY_ENTER_DELAY + index * BUBBLY_ENTER_STAGGER;
      const baseRotation = gsap.getProperty(letterEl, 'rotation') as number;
      const randomRotation = typeof baseRotation === 'number' ? baseRotation : 0;
      const baseScale = bubblyScales[index] ?? 1;
      letterEl.style.willChange = 'transform, opacity';
      letterEl.style.transform = 'translateZ(0)';
      letterEl.style.backfaceVisibility = 'hidden';
      letterEl.style.webkitBackfaceVisibility = 'hidden';
      letterEl.style.contain = 'layout style paint';

      gsap.set(letterEl, {
        opacity: 0,
        scale: 0,
        x: 0,
        y: 0,
        rotation: randomRotation,
        rotationX: 0,
        rotationY: 0,
        z: 0,
        force3D: true
      });

      const letterTl = trackTimeline({ delay });
      bubblyTimelinesRef.push(letterTl);
      letterTl.to(letterEl, {
        opacity: 1,
        scale: baseScale * BUBBLY_ENTER_BOUNCE_SCALE,
        rotation: randomRotation,
        rotationX: -5,
        rotationY: 0,
        z: 20,
        x: 0,
        y: 0,
        transformOrigin: 'center center',
        duration: BUBBLY_ENTER_DURATION + BUBBLY_ENTER_EXTRA * 0.6,
        ease: 'back.out(2.0)'
      });
      letterTl.to(letterEl, {
        scale: baseScale * 0.95,
        rotation: randomRotation,
        rotationX: 0,
        rotationY: 0,
        z: 0,
        x: 0,
        y: 0,
        transformOrigin: 'center center',
        duration: BUBBLY_SETTLE_DURATION + BUBBLY_ENTER_EXTRA * 0.2,
        ease: 'power2.out'
      });
      letterTl.to(letterEl, {
        opacity: 1,
        scale: baseScale,
        rotation: randomRotation,
        rotationX: 0,
        rotationY: 0,
        z: 0,
        x: 0,
        y: 0,
        transformOrigin: 'center center',
        duration: BUBBLY_FINAL_SETTLE_DURATION + BUBBLY_ENTER_EXTRA * 0.2,
        ease: 'back.out(1.5)',
        onComplete: () => {
          try { bubblyBounceTimelinesRef[index]?.play(0); } catch {}
          bubblyEnterComplete += 1;
          if (bubblyEnterComplete === bubblyLetters.length) {
            startBubblyExit();
          }
        }
      });
    });
  } catch (e) {
    console.warn('⚠️ Failed to create BUBBLY text overlay:', e);
    cleanupBubblyOverlay();
  }
}

function cleanupBubblyOverlay(): void {
  try {
    bubblyBounceTimelinesRef.forEach((tl) => {
      try { tl.kill(); } catch {}
    });
    bubblyBounceTimelinesRef = [];
    bubblyTimelinesRef.forEach((tl) => {
      try { tl.kill(); } catch {}
    });
    bubblyTimelinesRef = [];
    if (bubblyOverlay) {
      try {
        gsap.killTweensOf(bubblyOverlay);
        bubblyOverlay.querySelectorAll('*').forEach((el) => {
          try { gsap.killTweensOf(el); } catch {}
        });
      } catch {}
    }
    if (bubblyOverlay && bubblyOverlay.parentNode) {
      bubblyOverlay.parentNode.removeChild(bubblyOverlay);
    }
    bubblyOverlay = null;
  } catch {}
}

/**
 * Cleanup explosion
 */
function cleanup(): void {
  if (cleanupInProgress) return;
  cleanupInProgress = true;
  try {
    cleanupBubblyOverlay();
    lifecycle.cleanup();
    isExplosionActive = false;
    explosionStartTime = 0; // Reset start time on cleanup
    // 🔥 CRITICAL: Clear global start time on cleanup
    delete (window as any).__ccBubblesExplosionStartTime;

    // Resolve any pending waiters to prevent hangs
    if (_explosionWaiters.size) {
      _explosionWaiters.forEach((fn) => {
        try { fn(); } catch {}
      });
      _explosionWaiters.clear();
    }

    // Clear safety timeout
    if (safetyTimeoutId) {
      try {
        clearTimeout(safetyTimeoutId);
      } catch {}
      safetyTimeoutId = null;
    }

    // Stop FPS monitoring
    try {
      stopFpsMonitoring();
    } catch (e) {
      console.warn('⚠️ cleanup: Failed to stop FPS monitoring:', e);
    }

    // Remove GSAP ticker
    if (spawnTick) {
      try {
        gsap.ticker.remove(spawnTick);
      } catch (e) {
        console.warn('⚠️ cleanup: Failed to remove spawn ticker:', e);
      }
      spawnTick = null;
    }

    if (explosionContainer) {
      const container = explosionContainer;
      explosionContainer = null;

      // Remove ticker from container
      if (container._bubbleSpawnTicker) {
        try {
          gsap.ticker.remove(container._bubbleSpawnTicker);
          container._bubbleSpawnTicker = null;
        } catch (e) {
          console.warn('⚠️ cleanup: Failed to remove container ticker:', e);
        }
      }

      // Cleanup bubbles
      try {
        const children = [...(container.children || [])];
        children.forEach((bubble) => {
          try {
            if (!bubble || (bubble as any).destroyed) return;
            if (bubble._bubbleTweens && Array.isArray(bubble._bubbleTweens)) {
              bubble._bubbleTweens.forEach(tween => {
                try { if (tween && tween.kill) tween.kill(); } catch {}
              });
              bubble._bubbleTweens = null;
            }
            gsap.killTweensOf(bubble);
            gsap.killTweensOf(bubble.scale);
            if (bubble && bubble.parent) bubble.parent.removeChild(bubble);
            if (bubble instanceof Sprite) {
              bubble.destroy();
            } else {
              graphicsPool.release(bubble);
            }
          } catch (e) {
            // Silently fail
          }
        });
      } catch (e) {
        console.warn('⚠️ cleanup: Failed to cleanup bubbles:', e);
      }

      // Remove from parent
      try {
        if (container.parent) {
          container.parent.removeChild(container);
        }
      } catch (e) {
        console.warn('⚠️ cleanup: Failed to remove container from parent:', e);
      }
      
      // Destroy container
      try {
        if (!container.destroyed) {
          container.destroy?.({ children: true });
        }
      } catch (e) {
        console.warn('⚠️ cleanup: Failed to destroy container:', e);
      }
    }
    
    isExplosionActive = false;
  } finally {
    cleanupInProgress = false;
  }
}
