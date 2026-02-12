// @ts-nocheck
// Wild Beer Bubbles Screen
// Full-screen continuous bubbles animation for wild-beer tiles
// Works independently of board/tile hierarchy (like board-transition-screen)

import { Container, Graphics, Sprite } from 'pixi.js';
import { gsap } from 'gsap';
import animationManager from './animation-manager.js';
import { graphicsPool } from './object-pool.ts';
import { getBubbleColors } from './templates/template-manager.ts';
import { createScreenLifecycle } from '../utils/screen-lifecycle.js';

const trackTween = (target: any, vars: any) => animationManager.trackExternalTween(gsap.to(target, vars));

const trackDelayedCall = (...args: any[]) => animationManager.trackExternalTween(gsap.delayedCall(...args));

let isBubblesActive = false;
let bubblesContainer: Container | null = null;
let spawnInterval: gsap.core.Tween | null = null;
let activeBubbles: (Graphics | Sprite)[] = [];
let healthCheckInterval: NodeJS.Timeout | null = null;
let _cachedBubbleTexture: any = null; // Cached bubble texture for performance
const lifecycle = createScreenLifecycle('wild-beer-bubbles-screen');

function isUsableRuntimeTexture(tex: any): boolean {
  if (!tex || tex.destroyed) return false;
  try {
    const source = tex.source ?? tex.baseTexture ?? null;
    if (!source || source.destroyed) return false;
    if (source.style == null && source.resource == null) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Start full-screen bubbles animation
 * Bubbles spawn from bottom, rise to top, go over everything
 * Works independently of board/tile hierarchy
 */
export function startWildBeerBubblesScreen(): void {
  if (isBubblesActive) {
    console.log('💧 Wild-beer bubbles screen already active, skipping');
    return;
  }

  const windowState = typeof window !== 'undefined' ? (window as any).STATE : null;
  const app = (windowState && windowState.app) || null;
  const stage = (windowState && windowState.stage) || (app && app.stage) || null;

  if (!stage || stage.destroyed) {
    console.warn('⚠️ Cannot start wild-beer bubbles screen - no stage');
    return;
  }

  // Cleanup any existing
  cleanup();

  // Create container on stage (full-screen)
  bubblesContainer = new Container();
  bubblesContainer.label = 'wild-beer-bubbles-screen';
  bubblesContainer.zIndex = 20000; // Above everything
  bubblesContainer.eventMode = 'none';
  bubblesContainer.visible = true;
  bubblesContainer.alpha = 1.0;
  bubblesContainer.renderable = true;
  try { bubblesContainer.interactiveChildren = false; } catch {}

  // Position at stage origin
  bubblesContainer.x = 0;
  bubblesContainer.y = 0;

  try {
    stage.addChild(bubblesContainer);
    stage.sortChildren?.();
  } catch (e) {
    console.error('❌ Failed to add bubbles container to stage:', e);
    cleanup();
    return;
  }

  isBubblesActive = true;

  // Initialize bubble texture if needed
  initializeBubbleTexture(app);

  // Start continuous spawning
  spawnBubblesLoop();

  // Health check - ensure wild-beer tile exists
  startHealthCheck();

  console.log('✅ Wild-beer bubbles screen started');
}

/**
 * Stop full-screen bubbles animation
 */
export function stopWildBeerBubblesScreen(): void {
  cleanup();
  console.log('🛑 Wild-beer bubbles screen stopped');
}

/**
 * Destroy cached bubble texture to release GPU memory.
 * Safe to call when the screen is inactive (preferred).
 */
export function destroyWildBeerBubblesScreenCache(): void {
  // Fail-safe: never destroy shared texture while bubbles can still reference it.
  const textureStillInUse = activeBubbles.some((bubble) => bubble instanceof Sprite && (bubble as Sprite).texture === _cachedBubbleTexture);
  if (isBubblesActive || textureStillInUse) {
    console.warn('⚠️ Skipping bubble screen cache destroy - texture still in use');
    return;
  }
  if (isUsableRuntimeTexture(_cachedBubbleTexture)) {
    try {
      _cachedBubbleTexture.destroy(true);
    } catch {}
  }
  _cachedBubbleTexture = null;
}

/**
 * Check if bubbles are active
 */
export function isWildBeerBubblesActive(): boolean {
  return isBubblesActive;
}

/**
 * Initialize bubble texture for performance (texture pooling)
 */
function initializeBubbleTexture(app: any): void {
  if (isUsableRuntimeTexture(_cachedBubbleTexture)) {
    return; // Already initialized
  }

  if (!app || !app.renderer) {
    console.warn('⚠️ Cannot initialize bubble texture - no app/renderer');
    return;
  }

  // Get bubble colors from template
  let bubbleColors;
  try {
    bubbleColors = getBubbleColors('wild-beer');
    if (!bubbleColors || !Array.isArray(bubbleColors) || bubbleColors.length === 0) {
      bubbleColors = [0xFFFFFF, 0xFFF5E6, 0xFFE8D1, 0xFFDCC2]; // Default light orange/white
    }
  } catch (err) {
    console.error('❌ Failed to get bubble colors from template:', err);
    bubbleColors = [0xFFFFFF, 0xFFF5E6, 0xFFE8D1, 0xFFDCC2]; // Default
  }

  const bubbleColorForTexture = bubbleColors[0] || 0xFFFFFF;
  const maxSize = 48; // Max bubble size
  const maxRadius = maxSize / 2;
  const tempGraphics = new Graphics();

  try {
    // Bubble with highlight effect
    tempGraphics.circle(0, 0, maxRadius);
    tempGraphics.fill({ color: bubbleColorForTexture, alpha: 1.0 });
    // Highlight circle (top-left)
    tempGraphics.circle(-maxRadius * 0.25, -maxRadius * 0.25, maxRadius * 0.32);
    tempGraphics.fill({ color: bubbleColorForTexture, alpha: 1.0 });
    // Stroke
    tempGraphics.circle(0, 0, maxRadius);
    tempGraphics.stroke({ color: bubbleColorForTexture, alpha: 0.65, width: 1 });

    // Generate texture
    try {
      _cachedBubbleTexture = app.renderer.generateTexture(tempGraphics, {
        resolution: 2,
        region: { x: -maxRadius - 2, y: -maxRadius - 2, width: maxSize + 4, height: maxSize + 4 }
      });
      if (!_cachedBubbleTexture || _cachedBubbleTexture.destroyed) {
        throw new Error('Texture generation returned invalid texture');
      }
      try {
        _cachedBubbleTexture.label = 'runtime:wild-beer-bubbles-screen';
        const src = (_cachedBubbleTexture as { source?: { label?: string }; baseTexture?: { label?: string } }).source ?? _cachedBubbleTexture.baseTexture;
        if (src) src.label = _cachedBubbleTexture.label;
        const rt = (window as any).__ccRuntimeTextures || ((window as any).__ccRuntimeTextures = new Set());
        rt.add?.(_cachedBubbleTexture);
      } catch {}
      console.log('✅ Bubble texture generated successfully');
    } catch (e1) {
      // Fallback: Try lower resolution
      try {
        _cachedBubbleTexture = app.renderer.generateTexture(tempGraphics, {
          resolution: 1,
          region: { x: -maxRadius - 2, y: -maxRadius - 2, width: maxSize + 4, height: maxSize + 4 }
        });
        if (!_cachedBubbleTexture || _cachedBubbleTexture.destroyed) {
          throw new Error('Low-res texture generation returned invalid texture');
        }
        try {
          _cachedBubbleTexture.label = 'runtime:wild-beer-bubbles-screen';
          const src = (_cachedBubbleTexture as { source?: { label?: string }; baseTexture?: { label?: string } }).source ?? _cachedBubbleTexture.baseTexture;
        if (src) src.label = _cachedBubbleTexture.label;
          const rt = (window as any).__ccRuntimeTextures || ((window as any).__ccRuntimeTextures = new Set());
          rt.add?.(_cachedBubbleTexture);
        } catch {}
      } catch (e2) {
        // Fallback: Try without region
        try {
          _cachedBubbleTexture = app.renderer.generateTexture(tempGraphics, {
            resolution: 1
          });
          if (!_cachedBubbleTexture || _cachedBubbleTexture.destroyed) {
            throw new Error('Auto-region texture generation returned invalid texture');
          }
          try {
            _cachedBubbleTexture.label = 'runtime:wild-beer-bubbles-screen';
            const src = (_cachedBubbleTexture as { source?: { label?: string }; baseTexture?: { label?: string } }).source ?? _cachedBubbleTexture.baseTexture;
        if (src) src.label = _cachedBubbleTexture.label;
            const rt = (window as any).__ccRuntimeTextures || ((window as any).__ccRuntimeTextures = new Set());
            rt.add?.(_cachedBubbleTexture);
          } catch {}
        } catch (e3) {
          console.warn('⚠️ All texture generation methods failed, using Graphics fallback');
          _cachedBubbleTexture = null; // Will use Graphics fallback
        }
      }
    }
  } catch (e) {
    console.error('❌ Critical error in texture generation setup:', e);
    _cachedBubbleTexture = null;
  } finally {
    try {
      tempGraphics.destroy();
    } catch (e) {
      console.warn('⚠️ Failed to destroy temp Graphics:', e);
    }
  }
}

/**
 * Continuous bubble spawning loop
 */
function spawnBubblesLoop(): void {
  if (!isBubblesActive || !bubblesContainer) return;

  // Spawn bubble from random bottom position
  spawnBubble();

  // Next spawn in 0.3-0.6s (continuous)
  const delay = 0.3 + Math.random() * 0.3;
  spawnInterval = trackDelayedCall(delay, spawnBubblesLoop);
}

/**
 * Spawn a single bubble
 */
function spawnBubble(): void {
  if (!bubblesContainer || bubblesContainer.destroyed) return;

  const windowState = typeof window !== 'undefined' ? (window as any).STATE : null;
  const app = (windowState && windowState.app) || null;

  // Screen dimensions
  const screenW = (typeof window !== 'undefined' ? window.innerWidth : 800);
  const screenH = (typeof window !== 'undefined' ? window.innerHeight : 600);
  const isMobile = screenW < 768 || screenH > screenW;
  const maxActiveBubbles = isMobile ? 24 : 40;
  if (activeBubbles.length >= maxActiveBubbles) {
    return;
  }

  // Get bubble colors from template
  let bubbleColors;
  try {
    bubbleColors = getBubbleColors('wild-beer');
    if (!bubbleColors || !Array.isArray(bubbleColors) || bubbleColors.length === 0) {
      bubbleColors = [0xFFFFFF, 0xFFF5E6, 0xFFE8D1, 0xFFDCC2]; // Default
    }
  } catch (err) {
    bubbleColors = [0xFFFFFF, 0xFFF5E6, 0xFFE8D1, 0xFFDCC2]; // Default
  }

  let bubble: Graphics | Sprite;
  const size = 14 + Math.random() * 34; // 14-48px (same as explosion)
  const sizeRatio = size / 48;
  const radius = size / 2;
  const alpha = 0.55 + Math.random() * 0.35; // 0.55-0.9 alpha

  // Use Sprite with texture (performance) OR Graphics fallback
  const useTexture = isUsableRuntimeTexture(_cachedBubbleTexture);
  let isSprite = false;

  if (useTexture && _cachedBubbleTexture) {
    try {
      bubble = new Sprite(_cachedBubbleTexture);
      bubble.eventMode = 'none';
      bubble.cursor = 'default';
      (bubble as Sprite).anchor.set(0.5); // Center anchor
      isSprite = true;
    } catch (e) {
      // Fallback to Graphics
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
    // Use Graphics (fallback)
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

  // Random distribution (match explosion start positions)
  const startX = (Math.random() - 0.5) * screenW * 1.4 + screenW * 0.5;
  const startYPercent = isMobile
    ? 0.95 + Math.random() * 0.20   // 95–115% (legacy mobile)
    : 1.08 + Math.random() * 0.20;  // 108–128% (below viewport)
  const startY = screenH * startYPercent;

  bubble.x = startX;
  bubble.y = startY;
  bubble.alpha = alpha;
  if (isSprite) {
    bubble.scale.set((0.25 + Math.random() * 0.25) * sizeRatio); // 0.25-0.5 initial scale × size ratio
  } else {
    bubble.scale.set(0.25 + Math.random() * 0.25); // 0.25-0.5 initial scale
  }
  bubble.renderable = true;
  bubble.visible = true;

  bubblesContainer.addChild(bubble);
  activeBubbles.push(bubble);

  // Animation: rise from bottom to top + 30%
  const endY = -screenH * (0.1 + Math.random() * 0.15); // End 10-25% above top
  const duration = Math.min(2.1, Math.max(1.1, 1.6 + (Math.random() - 0.5) * 0.6)); // 1.1-2.1s

  // Horizontal drift (50% reduced from explosion for tighter bubbles)
  const driftX = (Math.random() - 0.5) * 50; // ±25px horizontal drift

  const bubbleTweens: gsap.core.Tween[] = [];

  // 1. VERTICAL RISE + DRIFT (combined)
  bubbleTweens.push(trackTween(bubble, {
    x: startX + driftX,
    y: endY,
    duration,
    ease: 'power2.inOut',
    immediateRender: true
  }));

  // 2. SCALE ANIMATION
  const finalScale = 0.65 + Math.random() * 0.35; // 0.65-1.0 final scale
  bubbleTweens.push(trackTween(bubble.scale, {
    x: isSprite ? finalScale * sizeRatio : finalScale,
    y: isSprite ? finalScale * sizeRatio : finalScale,
    duration: duration * 0.45,
    ease: 'power1.out',
    immediateRender: true
  }));

  // 3. ALPHA FADE
  bubbleTweens.push(trackTween(bubble, {
    alpha: 0,
    duration: duration * 0.4,
    delay: duration * 0.6,
    ease: 'power2.in',
    immediateRender: true,
    onComplete: () => {
      try {
        bubbleTweens.forEach(t => { try { t.kill?.(); } catch {} });
        const idx = activeBubbles.indexOf(bubble);
        if (idx >= 0) activeBubbles.splice(idx, 1);
        if (bubblesContainer && bubblesContainer.children.includes(bubble)) {
          bubblesContainer.removeChild(bubble);
        }
        // Sprite uses destroy() (texture reused), Graphics uses pool
        if (bubble instanceof Sprite) {
          bubble.destroy();
        } else {
          graphicsPool.release(bubble as Graphics);
        }
      } catch {}
    }
  }));

  // Store tweens for cleanup
  (bubble as any)._bubbleTweens = bubbleTweens;
}

/**
 * Start health check to ensure wild-beer tile exists
 */
function startHealthCheck(): void {
  // Check every 2 seconds if wild-beer tile still exists
  healthCheckInterval = lifecycle.trackInterval(() => {
    if (!isBubblesActive) {
      if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
        healthCheckInterval = null;
      }
      return;
    }

    const hasWildBeer = checkWildBeerTileExists();
    if (!hasWildBeer) {
      console.log('💧 No wild-beer tile found, stopping bubbles screen');
      stopWildBeerBubblesScreen();
    }
  }, 2000);
}

/**
 * Check if wild-beer tile exists on board
 */
function checkWildBeerTileExists(): boolean {
  const windowState = typeof window !== 'undefined' ? (window as any).STATE : null;
  const tiles = (windowState && windowState.tiles) || [];
  return tiles.some((t: any) => 
    t && !t.destroyed && t.special === 'wild-beer' && t.visible
  );
}

/**
 * Cleanup all bubbles and resources
 */
function cleanup(): void {
  lifecycle.cleanup();
  isBubblesActive = false;

  // Kill spawn interval
  if (spawnInterval) {
    spawnInterval.kill();
    spawnInterval = null;
  }

  // Kill health check
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }

  // Cleanup bubbles
  if (activeBubbles.length > 0) {
    activeBubbles.forEach(bubble => {
      try {
        // Kill all tweens
        if ((bubble as any)._bubbleTweens) {
          ((bubble as any)._bubbleTweens as gsap.core.Tween[]).forEach(t => {
            try { t.kill?.(); } catch {}
          });
        }
        gsap.killTweensOf(bubble);
        gsap.killTweensOf(bubble.scale);
        gsap.killTweensOf(bubble.alpha);
        if (bubble.parent) {
          bubble.parent.removeChild(bubble);
        }
        // Sprite uses destroy(), Graphics uses pool
        if (bubble instanceof Sprite) {
          bubble.destroy();
        } else {
          graphicsPool.release(bubble as Graphics);
        }
      } catch {}
    });
    activeBubbles = [];
  }

  // Remove container
  if (bubblesContainer) {
    try {
      if (bubblesContainer.parent) {
        bubblesContainer.parent.removeChild(bubblesContainer);
      }
      bubblesContainer.destroy({ children: true });
    } catch {}
    bubblesContainer = null;
  }
}
