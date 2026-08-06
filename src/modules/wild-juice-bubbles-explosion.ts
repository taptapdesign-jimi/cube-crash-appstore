// @ts-nocheck
// Wild Juice Bubbles Explosion
// Full-screen bubbles explosion effect for wild-juice merge 6 events
// Uses custom bubble sprites (bubble 1-8) instead of runtime Graphics - lighter on memory

import { Assets, Container, Sprite, Texture } from 'pixi.js';
import { getBubbleSpritePool, clearBubbleSpritePool, graphicsPool } from './object-pool.ts';
import { gsap } from 'gsap';
import animationManager from './animation-manager.js';
import { createScreenLifecycle } from '../utils/screen-lifecycle.js';
import { logger } from '../core/logger.js';
import { attachBubblySprites } from './text-bubbly-sprites.js';
import { setWildFxDragLock, startWildFxDragLockForAnimation } from './wild-fx-drag-lock.ts';

const trackTween = (target: any, vars: any) => animationManager.trackExternalTween(gsap.to(target, vars));

const trackDelayedCall = (...args: any[]) => animationManager.trackExternalTween(gsap.delayedCall(...args));

const trackTimeline = (opts?: any) => animationManager.trackExternalTimeline(gsap.timeline(opts));
function createRandomTextLetterSizes(count: number): number[] {
  const large = [92, 98, 104];
  const medium = [66, 72, 80];
  const small = [30, 36, 44, 50];
  const buckets = [large, medium, small, medium, large, small, medium, small, large];
  const offset = Math.floor(Math.random() * buckets.length);
  return Array.from({ length: count }, (_, index) => {
    const bucket = buckets[(index + offset) % buckets.length];
    const base = bucket[Math.floor(Math.random() * bucket.length)];
    const size = Math.max(28, base + (Math.random() * 10 - 5));
    return index === 0 ? Math.max(75, size) : size;
  });
}

// Module-level state (like board-transition-screen)
let isExplosionActive = false;
let explosionContainer: Container | null = null;
let spawnTick: (() => void) | null = null;
let safetyTimeoutId: ReturnType<typeof setTimeout> | null = null;
const BUBBLE_SPRITE_PATHS = [
  './assets/shop/bubbles pack/bubble1.png',
  './assets/shop/bubbles pack/bubble 2.png',
  './assets/shop/bubbles pack/bubble 3.png',
  './assets/shop/bubbles pack/bubble 4.png',
  './assets/shop/bubbles pack/bubble 5.png',
  './assets/shop/bubbles pack/bubble 6.png',
  './assets/shop/bubbles pack/bubble 7.png',
  './assets/shop/bubbles pack/bubble 8.png',
];
let explosionStartTime: number = 0; // Track when explosion started (for protection against premature cleanup)
let stageRetryCount = 0; // Retry count for stage acquisition during transitions
let cleanupInProgress = false;
let bubblyOverlay: HTMLElement | null = null;
let bubblyTimelinesRef: gsap.core.Timeline[] = [];
let bubblyBounceTimelinesRef: gsap.core.Timeline[] = [];
let bubblyFxCleanup: (() => void) | null = null;
const lifecycle = createScreenLifecycle('wild-juice-bubbles-explosion');
const WILD_JUICE_HAPTIC_INITIAL_COUNT = 3;
const WILD_JUICE_HAPTIC_INITIAL_INTERVAL_MS = 70;
const WILD_JUICE_HAPTIC_GLOBAL_START_DELAY_MS = 200;
const WILD_JUICE_HAPTIC_FLOW_START_MS = 320;
const WILD_JUICE_HAPTIC_FLOW_INTERVAL_MS = 260;
const WILD_JUICE_HAPTIC_LATE_BURST_COUNT = 4;
const WILD_JUICE_HAPTIC_LATE_BURST_INTERVAL_MS = 100;
const WILD_JUICE_HAPTIC_TAIL_COUNT = 2;
const WILD_JUICE_HAPTIC_TAIL_INTERVAL_MS = 180;
const WILD_JUICE_HAPTIC_FINAL_TAIL_COUNT = 2;
const WILD_JUICE_HAPTIC_FINAL_TAIL_INTERVAL_MS = 140;
const MUSHROOM_GROWTH_COUNT = 21;
const MUSHROOM_GROWTH_MIN_SIZE_PX = 160;
const MUSHROOM_GROWTH_MAX_SIZE_PX = 200;
const MUSHROOM_GROWTH_MIN_ROTATION_DEG = 8;
const MUSHROOM_GROWTH_MAX_ROTATION_DEG = 15;
// The reduced 21-sprite pile samples the complete 30-slot silhouette. Its
// complete birth motion runs at 60% of the previous duration (40% shorter).
const MUSHROOM_GROWTH_SPEED_SCALE = 0.6;
const MUSHROOM_GROWTH_STAGGER_MS = 25;
const MUSHROOM_EXIT_REVERSE_STAGGER_MS = 50;
const MUSHROOM_POLLEN_COUNT = 72;
const MUSHROOM_POLLEN_MIN_RADIUS = 3.2;
const MUSHROOM_POLLEN_MAX_RADIUS = MUSHROOM_POLLEN_MIN_RADIUS * 1.4;
const MUSHROOM_POLLEN_COLORS = [0xFFBB9F, 0xFFD0A5, 0xFFEDC6, 0xFFF7E7, 0xFFEBE8] as const;
const MUSHROOM_POLLEN_FLOCK_DURATION_SECONDS = 7;
const MUSHROOM_POLLEN_DEPTHS = [140, 88, 68, 49, 30] as const;
const MUSHROOM_FOREGROUND_CLASS = 'cc-mushroom-finale-foreground';

function setMushroomForegroundOwnership(active: boolean): void {
  if (typeof document === 'undefined') return;
  document.body?.classList.toggle(MUSHROOM_FOREGROUND_CLASS, active);
  document.getElementById('app')?.classList.toggle(MUSHROOM_FOREGROUND_CLASS, active);
}

type MushroomPileSlot = { x: number; y: number; sizeBias: number; rotation: -1 | 1; depth: number };
const MUSHROOM_PILE_SLOTS: MushroomPileSlot[] = [
  // Four heavily interlocked rows occupy only the lower ~30% of the screen.
  // Birth order remains front-to-back: every later row sorts behind the first.
  { x: -0.08, y: 1.085, sizeBias: 1.00, rotation: -1, depth: 94 },
  { x: 0.08, y: 1.075, sizeBias: 0.98, rotation: 1, depth: 97 },
  { x: 0.24, y: 1.085, sizeBias: 1.00, rotation: -1, depth: 99 },
  { x: 0.40, y: 1.075, sizeBias: 0.97, rotation: 1, depth: 101 },
  { x: 0.57, y: 1.085, sizeBias: 1.00, rotation: -1, depth: 102 },
  { x: 0.74, y: 1.075, sizeBias: 0.98, rotation: 1, depth: 100 },
  { x: 0.90, y: 1.085, sizeBias: 1.00, rotation: -1, depth: 98 },
  { x: 1.06, y: 1.075, sizeBias: 0.98, rotation: 1, depth: 95 },

  { x: -0.02, y: 1.025, sizeBias: 0.98, rotation: 1, depth: 74 },
  { x: 0.13, y: 1.015, sizeBias: 1.00, rotation: -1, depth: 77 },
  { x: 0.28, y: 1.025, sizeBias: 0.97, rotation: 1, depth: 79 },
  { x: 0.43, y: 1.015, sizeBias: 1.00, rotation: -1, depth: 81 },
  { x: 0.58, y: 1.025, sizeBias: 0.98, rotation: 1, depth: 82 },
  { x: 0.73, y: 1.015, sizeBias: 1.00, rotation: -1, depth: 80 },
  { x: 0.88, y: 1.025, sizeBias: 0.97, rotation: 1, depth: 78 },
  { x: 1.03, y: 1.015, sizeBias: 0.99, rotation: -1, depth: 75 },

  { x: 0.02, y: 0.965, sizeBias: 0.95, rotation: -1, depth: 55 },
  { x: 0.18, y: 0.955, sizeBias: 0.98, rotation: 1, depth: 58 },
  { x: 0.34, y: 0.945, sizeBias: 1.00, rotation: -1, depth: 60 },
  { x: 0.50, y: 0.940, sizeBias: 0.98, rotation: 1, depth: 62 },
  { x: 0.66, y: 0.945, sizeBias: 1.00, rotation: -1, depth: 61 },
  { x: 0.82, y: 0.955, sizeBias: 0.97, rotation: 1, depth: 59 },
  { x: 0.98, y: 0.965, sizeBias: 0.96, rotation: -1, depth: 56 },

  // A shallow inverted-V cap closes the top without climbing toward mid-screen.
  // Lift the cap row by only 2% of viewport height so a small amount of stem
  // reads between layers while the dense overlap still hides the board paper.
  { x: 0.04, y: 0.925, sizeBias: 0.93, rotation: 1, depth: 36 },
  { x: 0.19, y: 0.905, sizeBias: 0.96, rotation: -1, depth: 39 },
  { x: 0.34, y: 0.885, sizeBias: 0.99, rotation: 1, depth: 41 },
  { x: 0.50, y: 0.875, sizeBias: 1.00, rotation: -1, depth: 43 },
  { x: 0.66, y: 0.885, sizeBias: 0.99, rotation: 1, depth: 42 },
  { x: 0.81, y: 0.905, sizeBias: 0.96, rotation: -1, depth: 40 },
  { x: 0.96, y: 0.925, sizeBias: 0.93, rotation: 1, depth: 37 },
];

function scheduleHapticPulseTrain(startMs: number, count: number, intervalMs: number): void {
  for (let i = 0; i < count; i++) {
    lifecycle.trackTimeout(() => {
      try {
        (window as any).triggerHapticImpact?.('light');
      } catch {}
    }, Math.max(0, startMs + i * intervalMs));
  }
}

function triggerWildJuiceHapticBurst(spawnDurationMs: number): void {
  try {
    const trigger = (window as any)?.triggerHapticImpact;
    if (typeof trigger !== 'function') return;

    const baseStartMs = WILD_JUICE_HAPTIC_GLOBAL_START_DELAY_MS;
    const lateBurstStartMs = Math.max(0, Math.floor(spawnDurationMs * 0.75));

    // Phase 1: initial visual burst (first 20 bubbles spawned instantly).
    scheduleHapticPulseTrain(baseStartMs, WILD_JUICE_HAPTIC_INITIAL_COUNT, WILD_JUICE_HAPTIC_INITIAL_INTERVAL_MS);

    // Phase 2: continuous bubble flow.
    for (
      let t = WILD_JUICE_HAPTIC_FLOW_START_MS;
      t < lateBurstStartMs - 120;
      t += WILD_JUICE_HAPTIC_FLOW_INTERVAL_MS
    ) {
      lifecycle.trackTimeout(() => {
        try {
          (window as any).triggerHapticImpact?.('light');
        } catch {}
      }, baseStartMs + t);
    }

    // Phase 3: late visual burst (+40 bubbles at 75% of spawn duration).
    scheduleHapticPulseTrain(
      baseStartMs + lateBurstStartMs,
      WILD_JUICE_HAPTIC_LATE_BURST_COUNT,
      WILD_JUICE_HAPTIC_LATE_BURST_INTERVAL_MS
    );

    // Phase 4: tail while bubbles finish drifting out.
    const tailStartMs = baseStartMs + lateBurstStartMs + 900;
    scheduleHapticPulseTrain(tailStartMs, WILD_JUICE_HAPTIC_TAIL_COUNT, WILD_JUICE_HAPTIC_TAIL_INTERVAL_MS);

    // Phase 5: final ending pulses at the very end.
    const finalTailStartMs =
      tailStartMs + (WILD_JUICE_HAPTIC_TAIL_COUNT * WILD_JUICE_HAPTIC_TAIL_INTERVAL_MS);
    scheduleHapticPulseTrain(
      finalTailStartMs,
      WILD_JUICE_HAPTIC_FINAL_TAIL_COUNT,
      WILD_JUICE_HAPTIC_FINAL_TAIL_INTERVAL_MS
    );
  } catch {}
}

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
    startWildFxDragLockForAnimation('juice-bubbles', 6200, 0.30);
    logger.debug('Container restored', undefined, { visible: container.visible, children: container.children?.length });
  } else {
    explosionContainer = null;
    isExplosionActive = false;
    setWildFxDragLock('juice-bubbles', false);
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
 * Show wild-juice bubbles explosion (full-screen burst)
 * Works independently of board/tile hierarchy
 */
type WildJuiceBubblesExplosionOptions = {
  showText?: boolean;
  text?: string;
  textColor?: string;
  textColors?: string[];
  direction?: 'up' | 'down';
  dropProfile?: 'beach-ball' | 'mushroom';
  spritePaths?: string[] | null;
  inputReleaseAtRatio?: number;
};

export function showWildJuiceBubblesExplosion(options: WildJuiceBubblesExplosionOptions = {}): void {
  if (isExplosionActive || explosionContainer) {
    cleanup();
    // 🔥 CRITICAL: Wait a frame to ensure cleanup completes before starting new explosion
    // This prevents race conditions where cleanup and new explosion conflict
    lifecycle.trackRaf(() => {
      showWildJuiceBubblesExplosionInternal(options);
    });
    return;
  }

  showWildJuiceBubblesExplosionInternal(options);
}

/**
 * Internal function to start bubbles explosion (called after cleanup if needed)
 */
async function showWildJuiceBubblesExplosionInternal(options: WildJuiceBubblesExplosionOptions = {}): Promise<void> {
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

  if (!stage || stage.destroyed || !hostContainer) {
    const maxRetries = 6;
    if (stageRetryCount < maxRetries) {
      stageRetryCount += 1;
      const delay = isBoardTransitionActive ? 100 : 80;
      logger.debug('Stage unavailable, retrying', undefined, { retry: stageRetryCount, maxRetries });
      lifecycle.trackTimeout(() => {
        showWildJuiceBubblesExplosionInternal(options);
      }, delay);
      return;
    }
    logger.warn('Cannot start bubbles explosion - no stage/host', undefined, { retriesExhausted: true });
    stageRetryCount = 0;
    return;
  }
  stageRetryCount = 0;

  // Load bubble sprites (bubble 1-8) and keep direct references.
  // Avoid Assets.get(path) cache-id mismatch (caused Pixi warnings + invalid textures).
  const spritePaths = Array.isArray(options.spritePaths) && options.spritePaths.length
    ? options.spritePaths.filter(Boolean)
    : BUBBLE_SPRITE_PATHS;
  const usesDefaultBubbleSprites = spritePaths === BUBBLE_SPRITE_PATHS;
  const bubblePoolKey = usesDefaultBubbleSprites
    ? 'wild-juice-bubbles'
    : `wild-juice-special:${spritePaths.join('|')}`;
  const bubbleTextures: Texture[] = [];
  for (const path of spritePaths) {
    try {
      const loaded = await Assets.load(path);
      const texture = loaded as Texture;
      if (!texture) {
        throw new Error(`Loaded texture is empty for ${path}`);
      }
      bubbleTextures.push(texture);
    } catch (e) {
      // Fail-soft: keep effect alive with remaining textures.
      console.warn(`⚠️ Bubble sprite failed to load, skipping (${path})`, e);
    }
  }

  if (bubbleTextures.length === 0) {
    console.warn('⚠️ Bubble explosion aborted: no bubble sprites loaded');
    return;
  }

  const bubblePool = getBubbleSpritePool(() => bubbleTextures[0], bubblePoolKey);

  // 🔥 CRITICAL: Double-check that cleanup completed (defensive check)
  if (isExplosionActive || explosionContainer) {
    console.warn('⚠️ Bubbles explosion state still active after cleanup, forcing cleanup again');
    cleanup();
    // Wait another frame
    lifecycle.trackRaf(() => {
      showWildJuiceBubblesExplosionInternal(options);
    });
    return;
  }

  // Get screen dimensions
  const screenW = (app && app.renderer && app.renderer.screen) ? app.renderer.screen.width : (typeof window !== 'undefined' ? window.innerWidth : 800);
  const screenH = (app && app.renderer && app.renderer.screen) ? app.renderer.screen.height : (typeof window !== 'undefined' ? window.innerHeight : 600);

  // Create container on stage (full-screen)
  explosionContainer = new Container();
  explosionContainer.label = 'wild-juice-explosion-bubbles';
  (explosionContainer as any)._bubblePoolKey = bubblePoolKey;
  // 🔥 CRITICAL FIX: Use maximum zIndex to ensure bubbles are above everything
  explosionContainer.zIndex = 999999; // Above everything (maximum)
  explosionContainer.eventMode = 'none';
  explosionContainer.visible = true;
  explosionContainer.alpha = 1.0;
  explosionContainer.renderable = true;
  explosionContainer.sortableChildren = true;
  try { explosionContainer.interactiveChildren = false; } catch {}

  // Position at stage origin
  explosionContainer.x = 0;
  explosionContainer.y = 0;
  
  // 🔥 DEBUG: Log container setup
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

    // Force render to ensure container is visible immediately
    // This is the same pattern used in fx.ts for wild stars animation
    try {
      const windowState = typeof window !== 'undefined' ? (window as any).STATE : null;
      const app = (windowState && windowState.app) || null;
      if (app && app.renderer && !app.renderer.destroyed) {
        app.renderer.render(stage);
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
  startWildFxDragLockForAnimation('juice-bubbles', 6200, options.inputReleaseAtRatio ?? 0.30);
  explosionStartTime = performance.now(); // Track when explosion started
  // 🔥 CRITICAL: Store start time globally so startLevel() can check elapsed time
  (window as any).__ccBubblesExplosionStartTime = explosionStartTime;

  const direction = options.direction === 'down' ? 'down' : 'up';
  const isCustomDownDrop = direction === 'down' && !usesDefaultBubbleSprites;
  const isMushroomDrop = isCustomDownDrop && options.dropProfile === 'mushroom';
  if (isMushroomDrop) {
    // Mushroom grows from below the physical viewport, so its canvas must own
    // the foreground over the DOM Round indicator and Journey bottom decor.
    // The class changes stacking only for this bounded finale lifecycle.
    setMushroomForegroundOwnership(true);
  }

  // iOS stability: keep the premium feel, but avoid saturating the renderer during repeated wild merges.
  const totalBubbles = isMushroomDrop ? MUSHROOM_GROWTH_COUNT : isCustomDownDrop ? 29 : 48;
  const lateBurstCount = isCustomDownDrop ? 0 : 18;
  const spawnDuration = isMushroomDrop
    ? (MUSHROOM_GROWTH_COUNT - 1) * MUSHROOM_GROWTH_STAGGER_MS
    : isCustomDownDrop ? 1300 : 1500;
  const spawnBatchSize = isMushroomDrop ? 1 : isCustomDownDrop ? 2 : 3;
  const maxActive = isMushroomDrop ? MUSHROOM_GROWTH_COUNT + MUSHROOM_POLLEN_COUNT : isCustomDownDrop ? 21 : 34;
  const maxBubbleDurationMs = 2100; // 1.1–2.1s
  const safetyTimeoutMs = isMushroomDrop
    ? 7200
    : spawnDuration + maxBubbleDurationMs + 1800; // extra for 70% more bubbles
  triggerWildJuiceHapticBurst(spawnDuration);
  let active = 0;
  let spawned = 0;
  const perMs = totalBubbles / spawnDuration;
  let startTime = performance.now();
  let lastTick = startTime;
  let acc = 0;

  const totalWithLate = totalBubbles + lateBurstCount;
  let lateBurstDone = false;
  const maybeCompleteExplosion = () => {
    if (!isExplosionActive || cleanupInProgress) return;
    if (spawned >= totalWithLate && active === 0) {
      logger.debug('Bubbles explosion complete - auto cleanup', undefined, { spawned, totalWithLate });
      cleanup();
    }
  };

  // Safety timeout (dynamic based on spawn + max bubble duration)
  if (safetyTimeoutId) {
    try { clearTimeout(safetyTimeoutId); } catch {}
  }
  safetyTimeoutId = lifecycle.trackTimeout(() => {
    safetyTimeoutId = null;
    if (isExplosionActive) {
      logger.warn('Bubbles explosion safety timeout', undefined, { ms: Math.round(safetyTimeoutMs) });
      cleanup();
    }
  }, safetyTimeoutMs);

  // Create bubble function
  const makeBubble = (scheduledIndex?: number) => {
    if (!explosionContainer || explosionContainer.destroyed) return;
    
    try {
      if (!explosionContainer.parent || explosionContainer.parent.destroyed) return;
      
      if (!explosionContainer.visible || explosionContainer.alpha === 0 || !explosionContainer.renderable) {
        explosionContainer.visible = true;
        explosionContainer.alpha = 1.0;
        explosionContainer.renderable = true;
      }
      
      const stage = explosionContainer.parent;
      if (stage && (!stage.visible || stage.alpha === 0 || !stage.renderable)) {
        stage.visible = true;
        stage.alpha = 1.0;
        stage.renderable = true;
      }
    } catch (e) {
      console.error('❌ makeBubble: Error checking container/stage:', e);
      return;
    }
    
    if (spawned >= totalWithLate || active >= maxActive) {
      return;
    }

    spawned += 1;
    active += 1;
    
    let idx = 0;
    if (usesDefaultBubbleSprites) {
      // Prefer larger-looking variants (4-8), but keep 1-3 in rotation.
      const r = Math.random();
      if (r < 0.2) idx = 3;         // bubble 4
      else if (r < 0.4) idx = 4;    // bubble 5
      else if (r < 0.5) idx = 5;    // bubble 6
      else if (r < 0.6) idx = 6;    // bubble 7
      else if (r < 0.7) idx = 7;    // bubble 8
      else idx = Math.floor(Math.random() * 3); // bubble 1/2/3
    } else if (isMushroomDrop && Number.isFinite(scheduledIndex)) {
      // Cycle the original icon plus all five supplied variants through the
      // reduced pile without allocating any additional Sprite owner.
      idx = Math.max(0, scheduledIndex as number) % bubbleTextures.length;
    } else {
      idx = Math.floor(Math.random() * bubbleTextures.length);
    }
    const tex = bubbleTextures[idx] || bubbleTextures[0];
    const bubble = bubblePool.acquire(tex);
    (bubble as any)._bubblePoolKey = bubblePoolKey;

    // 50% veliki, 50% mali – bimodalna distribucija
    const isBig = Math.random() < 0.5;
    const baseSize = isBig ? 55 + Math.random() * 35 : 18 + Math.random() * 25; // veliki 55–90px, mali 18–43px
    // Size-only tweak: ~25% smaller bubbles with slight per-bubble randomness
    const sizeShrink = 0.75 + Math.random() * 0.08; // 25%-17% reduction
    const size = baseSize * sizeShrink;
    const sizeRatio = size / 80;
    
    // Random distribution
    // 🔥 START POSITION: Spawn BELOW the viewport for premium feel
    // - Mobile: keep legacy behavior (95–115% of screen height)
    // - Desktop/tablet: start further below (108–128% of screen height)
    const startX = (Math.random() - 0.5) * screenW * 1.4 + screenW * 0.5;
    const startYPercent = direction === 'down'
      ? -0.15 - Math.random() * 0.20
      : 0.95 + Math.random() * 0.20; // 95–115% screen height
    const startY = screenH * startYPercent;

    bubble.x = startX;
    bubble.y = startY;
    // Opacity distribution:
    // - 85% fully opaque (1.0)
    // - 15% in range 0.80-0.90
    const useFullOpacity = Math.random() < 0.85;
    bubble.alpha = useFullOpacity ? 1 : (0.8 + Math.random() * 0.1);
    const mushroomScale = 0.70 + Math.random() * 0.26;
    const bubbleScale = isMushroomDrop
      ? mushroomScale * 0.5
      : (0.5 + Math.random() * 0.4) * sizeRatio;
    bubble.scale.set(bubbleScale);
    bubble.renderable = true;
    bubble.visible = true;

    bubble.visible = true;
    bubble.renderable = true;
    explosionContainer.addChild(bubble);

    const endY = direction === 'down'
      ? screenH * (1.1 + Math.random() * 0.18)
      : -screenH * (0.1 + Math.random() * 0.15); // End 10-25% above top
    const duration = isCustomDownDrop
      ? 1.05 + Math.random() * 0.24
      : Math.min(2.1, Math.max(1.1, 1.6 + (Math.random() - 0.5) * 0.6)); // 1.1-2.1s
    const driftX = (Math.random() - 0.5) * 100; // ±50px horizontal drift

    const bubbleTweens: gsap.core.Tween[] = [];
    let releaseScheduled = false;

    const onBubbleComplete = () => {
      if (releaseScheduled) return;
      releaseScheduled = true;

      // Never reset/repool a Pixi target from inside GSAP's render stack.
      // Mushroom owns parallel Sprite + ObservablePoint tracks; releasing from
      // either track's onComplete can null Pixi transforms while GSAP is still
      // initializing/rendering the sibling track in the same ticker frame.
      lifecycle.trackTimeout(() => {
        if (!isExplosionActive || cleanupInProgress) return;
        try {
          (bubble as any)._bubbleTweens = null;
          bubbleTweens.forEach(t => { try { t.kill?.(); } catch {} });
          if (bubble && bubble.parent) bubble.parent.removeChild(bubble);
          bubblePool.release(bubble);
        } catch {}
        active = Math.max(0, active - 1);
        maybeCompleteExplosion();
      }, 0);
    };

    if (isMushroomDrop) {
      const growthIndex = Math.max(0, scheduledIndex ?? (spawned - 1));
      const pileSlotIndex = Math.round(
        growthIndex * (MUSHROOM_PILE_SLOTS.length - 1) / Math.max(1, MUSHROOM_GROWTH_COUNT - 1),
      );
      const slot = MUSHROOM_PILE_SLOTS[pileSlotIndex];
      const targetX = screenW * slot.x + (Math.random() - 0.5) * 12;
      const targetY = screenH * slot.y + (Math.random() - 0.5) * 8;
      const randomSize = MUSHROOM_GROWTH_MIN_SIZE_PX
        + Math.random() * (MUSHROOM_GROWTH_MAX_SIZE_PX - MUSHROOM_GROWTH_MIN_SIZE_PX);
      const targetPixelSize = MUSHROOM_GROWTH_MIN_SIZE_PX
        + (randomSize - MUSHROOM_GROWTH_MIN_SIZE_PX) * slot.sizeBias;
      const targetScale = targetPixelSize / Math.max(1, tex.width);
      const rotationDirection = Math.random() < 0.5 ? slot.rotation : -slot.rotation;
      const rotationMagnitude = MUSHROOM_GROWTH_MIN_ROTATION_DEG
        + Math.random() * (MUSHROOM_GROWTH_MAX_ROTATION_DEG - MUSHROOM_GROWTH_MIN_ROTATION_DEG);
      const targetRotation = rotationDirection * rotationMagnitude * (Math.PI / 180);
      bubble.anchor.set(0.5, 1);
      bubble.x = targetX;
      bubble.y = screenH + tex.height * targetScale * 0.45;
      bubble.rotation = targetRotation * 0.25;
      bubble.alpha = 0;
      bubble.scale.set(targetScale * 0.08);
      bubble.zIndex = slot.depth;

      const tl = trackTimeline();
      tl.to(bubble, {
        y: targetY,
        alpha: 1,
        rotation: targetRotation,
        duration: 0.34 * MUSHROOM_GROWTH_SPEED_SCALE,
        ease: 'back.out(2.5)',
      });
      tl.to(bubble.scale, {
        x: targetScale * 1.14,
        y: targetScale * 0.88,
        duration: 0.21 * MUSHROOM_GROWTH_SPEED_SCALE,
        ease: 'power2.out',
      }, 0);
      tl.to(bubble.scale, {
        x: targetScale * 0.94,
        y: targetScale * 1.08,
        duration: 0.13 * MUSHROOM_GROWTH_SPEED_SCALE,
        ease: 'power2.out',
      });
      tl.to(bubble.scale, {
        x: targetScale,
        y: targetScale,
        duration: 0.16 * MUSHROOM_GROWTH_SPEED_SCALE,
        ease: 'back.out(2.1)',
      });
      const revealDelaySeconds = growthIndex * MUSHROOM_GROWTH_STAGGER_MS / 1000;
      const fullWorldRevealSeconds = (MUSHROOM_GROWTH_COUNT - 1) * MUSHROOM_GROWTH_STAGGER_MS / 1000;
      const reverseExitDelaySeconds = (MUSHROOM_GROWTH_COUNT - 1 - growthIndex)
        * MUSHROOM_EXIT_REVERSE_STAGGER_MS / 1000;
      tl.to(bubble, {
        duration: 0.62 + Math.max(0, fullWorldRevealSeconds - revealDelaySeconds) + reverseExitDelaySeconds,
      });
      tl.to(bubble.scale, {
        x: targetScale * 1.08,
        y: targetScale * 0.92,
        duration: 0.12,
        ease: 'power1.out',
      });
      tl.to(bubble, {
        y: screenH + tex.height * targetScale,
        rotation: targetRotation * 0.35,
        duration: 0.32,
        ease: 'back.in(1.7)',
      });
      tl.to(bubble.scale, {
        x: targetScale * 0.06,
        y: targetScale * 0.06,
        duration: 0.32,
        ease: 'back.in(1.9)',
      }, '<');
      tl.call(onBubbleComplete);
      bubbleTweens.push(tl as any);
    } else if (isCustomDownDrop) {
      const floorY = screenH * (0.93 + Math.random() * 0.07);
      const bounceY = Math.max(screenH * 0.38, floorY - screenH * (0.18 + Math.random() * 0.20));
      const exitY = screenH * (1.18 + Math.random() * 0.18);
      const bounceDir = Math.random() < 0.5 ? -1 : 1;
      const sideBounce = screenW * (0.10 + Math.random() * 0.22);
      const x1 = startX + driftX * 0.28;
      const x2 = x1 + bounceDir * sideBounce + (Math.random() - 0.5) * 42;
      const x3 = x2 + bounceDir * screenW * (0.05 + Math.random() * 0.12) + (Math.random() - 0.5) * 56;
      const impactRotation = (Math.random() < 0.5 ? -1 : 1) * (0.12 + Math.random() * 0.16);
      const tl = trackTimeline();
      tl.to(bubble, {
        x: x1,
        y: floorY,
        duration: duration * 0.52,
        ease: 'power2.in',
        immediateRender: true,
      });
      tl.to(bubble.scale, {
        x: bubbleScale * 1.26,
        y: bubbleScale * 0.70,
        duration: 0.035,
        ease: 'power2.out',
      }, '<+=0.01');
      tl.to(bubble, {
        rotation: impactRotation,
        duration: 0.045,
        ease: 'power2.out',
      }, '<');
      tl.to(bubble.scale, {
        x: bubbleScale * 0.84,
        y: bubbleScale * 1.18,
        duration: 0.055,
        ease: 'back.out(2.1)',
      });
      tl.to(bubble, {
        x: x2,
        y: bounceY,
        duration: duration * 0.26,
        ease: 'power2.out',
        rotation: impactRotation * -0.55,
      }, '<+=0.015');
      tl.to(bubble.scale, {
        x: bubbleScale,
        y: bubbleScale,
        duration: 0.09,
        ease: 'back.out(1.7)',
      }, '<+=0.02');
      tl.to(bubble, {
        x: x3,
        y: exitY,
        duration: duration * 0.42,
        ease: 'power2.in',
        rotation: impactRotation * -1.25,
        onComplete: onBubbleComplete,
      });
      bubbleTweens.push(tl as any);
    } else {
      // Vertical rise + drift (onComplete = remove, alpha uvijek 100%)
      bubbleTweens.push(trackTween(bubble, {
        x: startX + driftX,
        y: endY,
        duration,
        ease: 'power2.inOut',
        immediateRender: true,
        onComplete: onBubbleComplete
      }));
    }

    // Scale animation
    if (!isCustomDownDrop) {
      const finalScale = (0.65 + Math.random() * 0.35) * sizeRatio;
      bubbleTweens.push(trackTween(bubble.scale, {
        x: finalScale,
        y: finalScale,
        duration: duration * 0.45,
        ease: 'power1.out',
        immediateRender: true
      }));
    }


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
      
      if (!explosionContainer.visible || explosionContainer.alpha === 0 || !explosionContainer.renderable) {
        explosionContainer.visible = true;
        explosionContainer.alpha = 1.0;
        explosionContainer.renderable = true;
      }
      
      // Fix child visibility samo prvih 10 framova ili nakon reattach (ne svaki frame)
      if (frameCounter < 10 || frameCounter % 30 === 0) {
        try {
          for (let i = 0; i < explosionContainer.children.length; i++) {
            const child = explosionContainer.children[i];
            if (child && !child.destroyed && (!child.visible || !child.renderable)) {
              child.visible = true;
              child.renderable = true;
            }
          }
        } catch {}
      }
      
      const stage = explosionContainer.parent;
      if (stage && (!stage.visible || stage.alpha === 0 || !stage.renderable)) {
        stage.visible = true;
        stage.alpha = 1.0;
        stage.renderable = true;
      }
      
      if (frameCounter <= 1 && (explosionContainer.zIndex || 0) < 999999) {
        try {
          explosionContainer.zIndex = 999999;
          stage.sortChildren?.();
        } catch {}
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
    
    // Spawn logic
    if (frameCounter % 2 === 0) {
      const now = performance.now();
      const dt = Math.max(1, now - lastTick);
      lastTick = now;
      const elapsed = now - startTime;

      if (elapsed >= spawnDuration && spawned >= totalWithLate) {
        if (spawnTick === spawnTicker) {
          gsap.ticker.remove(spawnTicker);
          spawnTick = null;
        }
        lifecycle.trackTimeout(() => maybeCompleteExplosion(), maxBubbleDurationMs + 300);
        return;
      }
      
      if (elapsed >= spawnDuration + 2400 && spawned < totalWithLate) {
        if (spawnTick === spawnTicker) {
          gsap.ticker.remove(spawnTicker);
          spawnTick = null;
        }
        lifecycle.trackTimeout(() => cleanup(), 0);
        return;
      }

      // Pred kraj (75% spawna) – dodaj 40 komada burst
      if (!lateBurstDone && elapsed >= spawnDuration * 0.75) {
        lateBurstDone = true;
        acc += lateBurstCount;
      }
      const safeFps = (typeof currentFps !== 'undefined' && currentFps !== null) ? currentFps : 60;
      const fpsFactor = safeFps >= 50 ? 1.0 : Math.max(0.5, safeFps / 50);
      acc += perMs * dt * fpsFactor;
      const toSpawn = Math.min(spawnBatchSize, Math.floor(acc)); // 5 odjednom
      if (toSpawn > 0) {
        acc -= toSpawn;
        for (let i = 0; i < toSpawn; i++) {
          if (safeFps < 30 && spawned >= totalWithLate * 0.7) break;
          try { makeBubble(); } catch {}
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

  // Text belongs to the shared finale lifecycle and must start before any
  // profile-specific spawn branch can return (Mushroom owns scheduled waves).
  if (options.showText !== false) {
    createAndShowBubblyText({ text: options.text, color: options.textColor, colors: options.textColors });
  }

  if (isMushroomDrop) {
    const pollenStates: Array<{
      particle: any;
      originX: number;
      originY: number;
      radius: number;
      phase: number;
      twinkleSpeed: number;
      baseAlpha: number;
      birthDelay: number;
      riseSpeed: number;
      targetY: number;
      driftDirection: -1 | 1;
      driftSpeed: number;
      swayAmplitude: number;
      swaySpeed: number;
      depthBand: number;
      arrivalStartTime: number | null;
      arrivalStartAlpha: number;
      arrivalStartScale: number;
      arrivalDuration: number;
      finished: boolean;
    }> = [];
    let pollenFlockTween: gsap.core.Tween | null = null;
    let pollenReleaseScheduled = false;
    const clampPollenX = (x: number) => Math.max(-8, Math.min(screenW + 8, x));

    const releasePollenFlock = () => {
      if (pollenReleaseScheduled) return;
      pollenReleaseScheduled = true;
      // Pool work stays outside GSAP's render stack. The whole flock has one
      // owner and is returned as one transaction, preventing orphan tweens.
      lifecycle.trackTimeout(() => {
        if (!isExplosionActive || cleanupInProgress) return;
        try { pollenFlockTween?.kill(); } catch {}
        let released = 0;
        pollenStates.forEach(({ particle }) => {
          try {
            if (particle.parent) particle.parent.removeChild(particle);
            (particle as any)._mushroomPollen = false;
            (particle as any)._bubbleTweens = null;
            graphicsPool.release(particle);
            released += 1;
          } catch {}
        });
        pollenStates.length = 0;
        active = Math.max(0, active - released);
        maybeCompleteExplosion();
      }, 0);
    };

    const startMushroomPollenFlock = () => {
      if (!explosionContainer || explosionContainer.destroyed || cleanupInProgress) return;

      for (let index = 0; index < MUSHROOM_POLLEN_COUNT; index += 1) {
        const particle = graphicsPool.acquire();
        if (!particle || particle.destroyed || typeof particle.clear !== 'function') continue;
        const radius = MUSHROOM_POLLEN_MIN_RADIUS
          + Math.random() * (MUSHROOM_POLLEN_MAX_RADIUS - MUSHROOM_POLLEN_MIN_RADIUS);
        const color = MUSHROOM_POLLEN_COLORS[index % MUSHROOM_POLLEN_COLORS.length];
        const depthBand = index % MUSHROOM_POLLEN_DEPTHS.length;
        particle.clear();
        // A soft same-palette halo keeps the pastel core readable against the
        // paper without introducing another Sprite, texture, or draw owner.
        particle.circle(0, 0, radius * 1.65).fill({ color, alpha: 0.24 });
        particle.circle(0, 0, radius).fill({ color, alpha: 1 });
        particle.circle(-radius * 0.30, -radius * 0.30, radius * 0.32)
          .fill({ color: 0xFFF7E7, alpha: 0.92 });
        particle.x = screenW * (0.03 + Math.random() * 0.94);
        // Every spore is born below the physical viewport and must visibly
        // travel upward before the final Mushroom birth releases the exit.
        particle.y = screenH * (1.03 + Math.random() * 0.10);
        particle.alpha = 0;
        particle.scale.set(0.88);
        particle.rotation = 0;
        particle.eventMode = 'none';
        // Five ~20% depth bands: foreground, behind row 1, behind row 2,
        // behind row 3, and behind the rear Mushroom row.
        particle.zIndex = MUSHROOM_POLLEN_DEPTHS[depthBand];
        (particle as any)._mushroomPollen = true;
        explosionContainer.addChild(particle);
        active += 1;
        pollenStates.push({
          particle,
          originX: particle.x,
          originY: particle.y,
          radius,
          phase: Math.random() * Math.PI * 2,
          twinkleSpeed: 7.2 + Math.random() * 4.8,
          baseAlpha: 0.82 + Math.random() * 0.18,
          // Rear depth bands enter progressively later than the foreground.
          birthDelay: Math.floor(index / 6) * 0.050 + (index % 6) * 0.010 + depthBand * 0.105,
          riseSpeed: screenH * (0.25 + Math.random() * 0.07),
          // Each spore owns a different arrival height across a 20% band.
          targetY: screenH * (0.50 + Math.random() * 0.20),
          driftDirection: Math.random() < 0.5 ? -1 : 1,
          driftSpeed: screenW * (0.020 + Math.random() * 0.025),
          swayAmplitude: screenW * (0.018 + Math.random() * 0.027),
          swaySpeed: 2.5 + Math.random() * 1.9,
          depthBand,
          arrivalStartTime: null,
          arrivalStartAlpha: 0,
          arrivalStartScale: 1,
          arrivalDuration: 0.30 + Math.random() * 0.22,
          finished: false,
        });
      }

      // One update owner still moves every spore, but each owns a randomized
      // magic-rise profile. Birth delays create small rolling groups without
      // creating per-particle GSAP timelines.
      const flockMotion = { time: 0 };
      pollenFlockTween = trackTween(flockMotion, {
        time: MUSHROOM_POLLEN_FLOCK_DURATION_SECONDS,
        duration: MUSHROOM_POLLEN_FLOCK_DURATION_SECONDS,
        ease: 'none',
        onUpdate: () => {
          const time = flockMotion.time;
          pollenStates.forEach((state) => {
            const { particle, phase, originX, originY } = state;
            if (!particle || particle.destroyed || !particle.parent) return;
            const age = time - state.birthDelay;
            if (age <= 0) {
              particle.alpha = 0;
              return;
            }
            const fadeIn = Math.min(1, age / 0.16);
            const primarySway = Math.sin(age * state.swaySpeed + phase) * state.swayAmplitude;
            const secondarySway = Math.sin(age * (state.swaySpeed * 1.83) + phase * 0.61)
              * state.swayAmplitude * 0.38;
            const directionalDrift = state.driftDirection * state.driftSpeed * age;
            const verticalMagic = Math.sin(age * 3.4 + phase) * screenH * 0.012;
            const sparkleWave = 0.5
              + 0.34 * Math.sin(age * state.twinkleSpeed + phase)
              + 0.16 * Math.sin(age * state.twinkleSpeed * 1.71 + phase * 1.37);
            const sparkle = Math.max(0, Math.min(1, sparkleWave));
            particle.x = clampPollenX(originX + directionalDrift + primarySway + secondarySway);
            const risingY = originY - state.riseSpeed * age + verticalMagic;
            particle.y = Math.max(state.targetY, risingY);

            if (risingY <= state.targetY) {
              if (state.arrivalStartTime === null) {
                state.arrivalStartTime = time;
                state.arrivalStartAlpha = particle.alpha;
                state.arrivalStartScale = particle.scale.x;
              }
              const arrivalProgress = Math.max(0, Math.min(1,
                (time - state.arrivalStartTime) / state.arrivalDuration,
              ));
              const arrivalEnvelope = 1 - arrivalProgress;
              const arrivalPulse = 0.22 + 0.78
                * (0.5 + 0.5 * Math.sin(arrivalProgress * Math.PI * 4 + phase));
              const arrivalFlash = Math.exp(-Math.pow((arrivalProgress - 0.24) / 0.105, 2));
              particle.alpha = Math.max(0, Math.min(1,
                (state.arrivalStartAlpha * (0.42 + arrivalPulse * 0.58) + arrivalFlash * 0.52)
                * arrivalEnvelope,
              ));
              particle.scale.set(state.arrivalStartScale * (0.96 + arrivalPulse * 0.08 + arrivalFlash * 0.34));
              if (arrivalProgress >= 1 && !state.finished) {
                state.finished = true;
                particle.alpha = 0;
                particle.visible = false;
                if (pollenStates.every((candidate) => candidate.finished)) {
                  releasePollenFlock();
                }
              }
              return;
            }

            // Deep continuous fade-in/fade-out is the magical pulse, not a
            // one-time entrance opacity ramp.
            particle.alpha = fadeIn * state.baseAlpha * (0.24 + sparkle * 0.76);
            const sparkleScale = 0.80 + sparkle * 0.50;
            particle.scale.set(sparkleScale);
          });
        },
        onComplete: releasePollenFlock,
      });
      pollenStates.forEach(({ particle }) => {
        (particle as any)._bubbleTweens = [pollenFlockTween];
      });
    };

    lifecycle.trackCleanup(() => {
      try { pollenFlockTween?.kill(); } catch {}
      pollenFlockTween = null;
      pollenStates.length = 0;
    });

    for (let i = 0; i < totalBubbles; i++) {
      lifecycle.trackTimeout(() => {
        if (!isExplosionActive || cleanupInProgress) return;
        try { makeBubble(i); } catch {}
        maybeCompleteExplosion();
      }, i * MUSHROOM_GROWTH_STAGGER_MS);
    }
    // Spawn together so the spores read as one flock, not independent dots.
    lifecycle.trackTimeout(startMushroomPollenFlock, 55);
    return;
  }

  // Initial burst stays visible, but avoids a 20-sprite spike on mobile GPUs.
  const initialBurst = spawnBatchSize * 3;
  for (let i = 0; i < initialBurst; i++) {
    try {
      makeBubble();
    } catch (e) {
      console.error(`❌ Failed to create initial bubble ${i}:`, e);
    }
  }
  // Start spawn ticker
  spawnTick = spawnTicker;
  explosionContainer._bubbleSpawnTicker = spawnTicker;
  try {
    gsap.ticker.add(spawnTicker);
  } catch (e) {
    console.error('❌ Failed to add GSAP ticker:', e);
  }
  
  try {
    spawnTicker();
  } catch (e) {
    console.error('❌ Failed to call initial spawnTicker():', e);
  }

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
      }
    } catch (e) {
      console.warn('⚠️ Failed to force render after initial burst:', e);
    }
  }, 100);
}

/**
 * Stop wild-juice bubbles explosion
 */
export function stopWildJuiceBubblesExplosion(): void {
  const wasRecentlyStarted = isWildJuiceBubblesExplosionRecentlyStarted();
  const elapsed = explosionStartTime > 0 ? performance.now() - explosionStartTime : 0;
  
  // 🔥 CRITICAL FIX: Don't cleanup if explosion was just started (< 100ms ago)
  // This prevents premature cleanup on new board where animation might be starting
  if (wasRecentlyStarted && elapsed < 100) {
    console.warn('⚠️ stopWildJuiceBubblesExplosion: Explosion just started (< 100ms ago), skipping cleanup to prevent premature stop');
    return;
  }
  
  cleanup();
}

/**
 * Force stop wild-juice bubbles explosion (bypass recent-start guard).
 */
export function forceStopWildJuiceBubblesExplosion(): void {
  cleanup();
}

/**
 * Destroy cached bubble texture to release GPU memory (call on hard cleanup).
 */
export function destroyWildJuiceBubblesExplosionCache(): void {
  clearBubbleSpritePool(); // Release pooled sprites to free memory
}

/**
 * Check if explosion was recently started (within last 5 seconds)
 * Used to protect animation from premature cleanup during board transitions
 */
export function isWildJuiceBubblesExplosionRecentlyStarted(): boolean {
  if (!isExplosionActive || explosionStartTime === 0) return false;
  const elapsed = performance.now() - explosionStartTime;
  return elapsed < 5000; // Within last 5 seconds
}

/**
 * Check if explosion is active
 */
export function isWildJuiceBubblesExplosionActive(): boolean {
  return isExplosionActive;
}

export function isWildJuiceFinaleAnimationActive(): boolean {
  return isExplosionActive || !!bubblyOverlay;
}

// Track pending waiters so cleanup can resolve them (prevents hangs)
const _explosionWaiters = new Set<() => void>();

/**
 * Wait for explosion to complete
 */
export function waitForBubblesExplosionToComplete(maxWaitMs = 6500): Promise<void> {
  return new Promise((resolve) => {
    if (!isWildJuiceFinaleAnimationActive()) {
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
      if (!isWildJuiceFinaleAnimationActive()) {
        safeResolve();
        return;
      }

      const elapsed = performance.now() - startTime;
      if (elapsed >= maxWaitMs) {
        const w = (typeof window !== 'undefined' ? (window as any) : null);
        logger.info('ℹ️ Bubbles explosion wait reached timeout, forcing cleanup', 'wild-juice-bubbles-explosion', {
          maxWaitMs,
          elapsedMs: Math.round(elapsed),
          boardTransitionActive: w?.__ccBoardTransitionActive === true,
          cleanupInProgress,
          isExplosionActive,
          hasBubblyOverlay: !!bubblyOverlay
        });
        cleanup();
        safeResolve();
      }
    }, 100);
  });
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
const MAX_TEXT_CONTAINER_TILT_DEG = 15;

function colorWithAlpha(color: string, alpha: number): string {
  const normalized = String(color || '').trim();
  const match = normalized.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!match) return normalized;
  const r = parseInt(match[1], 16);
  const g = parseInt(match[2], 16);
  const b = parseInt(match[3], 16);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha)).toFixed(2)})`;
}

/**
 * BUBBLY text overlay – isti dizajn, font, boja, enter/exit animacije kao TNT BOOM
 */
function createAndShowBubblyText(options: { text?: string; color?: string; colors?: string[] } = {}): void {
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
    // Replace clouds with pooled bubble sprites for default BUBBLY only.
    // Special dice such as Beach Ball provide their own full-screen sprite field.
    if (!options.text) {
      bubblyFxCleanup = attachBubblySprites(overlay, { count: 14, zIndex: 1 });
    }

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
      'gap: 0',
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
    const containerTilt = (Math.random() - 0.5) * (MAX_TEXT_CONTAINER_TILT_DEG * 2);
    bubblyContainer.style.transform = `translate(-50%, -50%) rotate(${containerTilt}deg)`;

    const bubblyLetters: HTMLElement[] = [];
    const bubblyScales: number[] = [];
    const bubblyRotations: number[] = [];
    const bubblyText = Array.from(String(options.text || 'BUBBLY'));
    const bubblyColor = String(options.color || '#FFA6AF');
    const bubblyColors = Array.isArray(options.colors) ? options.colors : null;
    const bubblyFontSizes = createRandomTextLetterSizes(bubblyText.length);

    bubblyText.forEach((letter, index) => {
      const letterScale = 1;
      const letterFontSize = bubblyFontSizes[index];
      const rotation = 0;
      const letterEl = document.createElement('span');
      letterEl.textContent = letter;
      const letterColor = bubblyColors?.[index] || bubblyColor;
      const letterAlpha = options.text ? 0.8 + Math.random() * 0.2 : 1;
      const visibleLetterColor = colorWithAlpha(letterColor, letterAlpha);
      letterEl.style.cssText = [
        'font-family: "Baloo2", system-ui, -apple-system, sans-serif',
        'font-weight: 800',
        `font-size: ${letterFontSize.toFixed(1)}px`,
        'line-height: 1',
        `color: ${visibleLetterColor}`,
        `-webkit-text-fill-color: ${visibleLetterColor}`,
        'text-align: center',
        'opacity: 0',
        'transform: scale(0) perspective(1000px) translateZ(0)',
        'display: inline-block',
        'visibility: visible',
        'pointer-events: none',
        'margin-right: 0',
        index === 0 ? 'margin-left: 0' : 'margin-left: -4.2px',
        'padding: 0',
        'border: 0',
        'outline: 0',
        'vertical-align: top',
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
    if (bubblyFxCleanup) {
      try { bubblyFxCleanup(); } catch {}
      bubblyFxCleanup = null;
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
    setMushroomForegroundOwnership(false);
    cleanupBubblyOverlay();
    lifecycle.cleanup();
    isExplosionActive = false;
    setWildFxDragLock('juice-bubbles', false);
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

      // Cleanup bubbles (release to pool)
      try {
        const poolKey = (container as any)._bubblePoolKey || 'wild-juice-bubbles';
        const pool = getBubbleSpritePool(() => Texture.WHITE, poolKey);
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
            if ((bubble as any)._mushroomPollen === true) {
              (bubble as any)._mushroomPollen = false;
              graphicsPool.release(bubble as any);
            } else {
              pool.release(bubble as Sprite);
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
      
      // Destroy only the owner container. Every Sprite/Graphics child above was
      // explicitly detached and returned to its pool; `children:true` can race
      // a GSAP render and destroy a pooled Pixi target, nulling its transforms.
      try {
        if (!container.destroyed) {
          container.destroy?.({ children: false });
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
