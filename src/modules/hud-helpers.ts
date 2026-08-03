// @ts-nocheck
// public/src/modules/hud-helpers.ts
import { Container, Graphics, Text, Rectangle, Sprite, Assets, Application, Stage } from 'pixi.js';
import { gsap } from 'gsap';
import animationManager from './animation-manager.js';
import { isTerminalEndgameInteractionLocked, pauseGame, resumeGame, restart } from './app-core.ts';
import { HUD_H, COLS, ROWS, TILE, GAP } from './constants.js';
import uiManager from './ui-manager.ts';
import { smokeBubblesAtTile } from './fx.ts';
import { createScreenLifecycle } from '../utils/screen-lifecycle.js';
import { isArcadeHomeRunMode } from './run-mode.js';
import { killInvalidPixiGsapTweens, killPixiGsapSubtree } from './pixi-gsap-cleanup.ts';
import { formatGameplayProgressLabel } from './gameplay-terminology.ts';

// 🔥 FIX: Track HUD timeouts for cleanup
const activeHudTimeouts: Set<ReturnType<typeof setTimeout>> = new Set();

const trackTimeline = (options: any = {}) => animationManager.trackExternalTimeline(gsap.timeline(options));

const trackTween = (target: any, vars: any) => animationManager.trackExternalTween(gsap.to(target, vars));
const hudLifecycle = createScreenLifecycle('hud');
const isVerboseGameplayLogsEnabled = () => (typeof window !== 'undefined') && (window as any).__ccVerboseGameplayLogs === true;
const isIPadHudViewport = (vw: number): boolean => {
  if (typeof navigator === 'undefined') return vw >= 769 && vw <= 1366;
  const ua = navigator.userAgent || '';
  return /iPad/.test(ua) || (/Macintosh/.test(ua) && (navigator as any).maxTouchPoints > 1) || (vw >= 769 && vw <= 1366);
};
const getHudStatsComboLeftShift = (vw: number): number => Math.round(vw * 0.05);
const getHudScoreComboSpacing = (vw: number): number => isIPadHudViewport(vw) ? Math.round(92 * 1.2) : 92;

function isWildMeterSmokeFrozen(): boolean {
  return typeof window !== 'undefined' && (window as any).__ccFirstPlayTutorialFreezeWildMeterSmoke === true;
}
const HUD_TAP_BOUNCE_OPEN_DELAY_MS = 0;
const HUD_TAP_BOUNCE_CLOSE_DELAY_MS = 120;
const HUD_BOTTOM_SHEET_TAP_LOCK_MS = 560;
let hudBottomSheetTapLocked = false;

function shouldBlockHudCloseForTerminalResolution(source: string): boolean {
  if (!isTerminalEndgameInteractionLocked()) return false;
  console.log(`🔒 HUD close ignored while terminal endgame owns the board (${source})`);
  return true;
}

function getTextureSource(tex: any): any {
  return tex?.source ?? tex?.baseTexture ?? null;
}

function isUsableHudTexture(tex: any): boolean {
  if (!tex || tex.destroyed) return false;
  const src = getTextureSource(tex);
  if (src?.destroyed || src?.valid === false) return false;
  const width = tex.width || src?.width || tex.orig?.width || 0;
  const height = tex.height || src?.height || tex.orig?.height || 0;
  return width > 1 && height > 1;
}

function removeStaleHudTexture(assetPath: string): void {
  try {
    const cache = (Assets as any)?.cache;
    try { cache?.delete?.(assetPath); } catch {}
    try { cache?.remove?.(assetPath); } catch {}
  } catch {}
}

async function loadUsableHudTexture(assetPath: string): Promise<any | null> {
  let tex: any = null;
  try { tex = Assets.get(assetPath); } catch {}
  if (isUsableHudTexture(tex)) return tex;
  removeStaleHudTexture(assetPath);
  try { tex = await Assets.load(assetPath); } catch (error) {
    console.warn(`⚠️ Failed to load HUD texture ${assetPath}:`, error);
    return null;
  }
  return isUsableHudTexture(tex) ? tex : null;
}

function getUsableHudTexture(assetPath: string): any | null {
  let tex: any = null;
  try { tex = Assets.get(assetPath); } catch {}
  return isUsableHudTexture(tex) ? tex : null;
}

function playPixiSoftCartoonBounce(target: any): void {
  const visualTarget = target?._bounceVisual || target;
  if (!visualTarget || visualTarget.destroyed) return;

  try {
    const baseScaleX = Number.isFinite(visualTarget._softBounceBaseScaleX)
      ? visualTarget._softBounceBaseScaleX
      : (visualTarget.scale?.x ?? 1);
    const baseScaleY = Number.isFinite(visualTarget._softBounceBaseScaleY)
      ? visualTarget._softBounceBaseScaleY
      : (visualTarget.scale?.y ?? 1);
    visualTarget._softBounceBaseScaleX = baseScaleX;
    visualTarget._softBounceBaseScaleY = baseScaleY;

    gsap.killTweensOf(visualTarget.scale);
    visualTarget.scale.set(baseScaleX, baseScaleY);

    const tl = trackTimeline({
      onComplete: () => {
        visualTarget._softBounceActive = false;
        if (!visualTarget.destroyed) visualTarget.scale.set(baseScaleX, baseScaleY);
      }
    });
    visualTarget._softBounceActive = true;

    tl.to(visualTarget.scale, {
      x: baseScaleX * 1.18,
      y: baseScaleY * 1.18,
      duration: 0.12,
      ease: 'back.out(2.2)'
    });
    tl.to(visualTarget.scale, {
      x: baseScaleX * 0.93,
      y: baseScaleY * 0.93,
      duration: 0.09,
      ease: 'power2.out'
    });
    tl.to(visualTarget.scale, {
      x: baseScaleX,
      y: baseScaleY,
      duration: 0.17,
      ease: 'back.out(1.9)'
    });
  } catch (err) {
    console.warn('⚠️ Error animating PIXI soft cartoon bounce:', err);
  }
}

function playHudCloseSoftCartoonBounce(target: any): void {
  const visibleClose = (HUD_ROOT as any)?._visibleCloseButton || closeIconSprite || target;
  playPixiSoftCartoonBounce(visibleClose);
}

function playHudScoreSoftCartoonBounce(coinHud: any): void {
  const visibleScoreArea = coinHud?.container && !coinHud.container.destroyed
    ? coinHud.container
    : (coinHud?.iconSprite && !coinHud.iconSprite.destroyed ? coinHud.iconSprite : null);
  playPixiSoftCartoonBounce(visibleScoreArea);
}

function trackHudTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout> {
  const timeout = setTimeout(() => {
    activeHudTimeouts.delete(timeout);
    callback();
  }, delay);
  activeHudTimeouts.add(timeout);
  return timeout;
}

function acquireHudBottomSheetTapLock(source: string, duration = HUD_BOTTOM_SHEET_TAP_LOCK_MS): boolean {
  if (hudBottomSheetTapLocked) {
    console.log(`🧷 HUD bottom sheet tap ignored while transition is locked (${source})`);
    return false;
  }

  hudBottomSheetTapLocked = true;
  trackHudTimeout(() => {
    hudBottomSheetTapLocked = false;
  }, duration);
  return true;
}

function openScoreStatsBottomSheetFromHud(bounceTarget: any, sourceLabel = 'HUD'): void {
  if (!acquireHudBottomSheetTapLock(`${sourceLabel}:score`)) return;

  let isScoreSheetOpen = false;
  try {
    if (typeof window.isScoreBottomSheetVisible === 'function') {
      isScoreSheetOpen = window.isScoreBottomSheetVisible();
    }
  } catch (err) {
    console.warn(`⚠️ Error checking score modal visibility from ${sourceLabel}:`, err);
  }

  if (isScoreSheetOpen) {
    console.log(`📊 ${sourceLabel} tapped - score bottom sheet already open, closing it`);
    if (typeof window.triggerHapticImpact === 'function') {
      window.triggerHapticImpact('light');
    }
    playPixiSoftCartoonBounce(bounceTarget);
    trackHudTimeout(() => {
      if (typeof window.hideScoreBottomSheet === 'function') {
        window.hideScoreBottomSheet();
      }
    }, HUD_TAP_BOUNCE_CLOSE_DELAY_MS);
    return;
  }

  let isEndRunModalOpen = false;
  try {
    if (typeof window.isEndRunModalVisible === 'function') {
      isEndRunModalOpen = window.isEndRunModalVisible();
    }
  } catch (err) {
    console.warn(`⚠️ Error checking end-run modal visibility from ${sourceLabel}:`, err);
  }

  if (isEndRunModalOpen) {
    console.log(`📊 ${sourceLabel} tapped - closing end-run modal before score bottom sheet`);
    if (typeof window.hideEndRunModal === 'function') {
      window.hideEndRunModal();
    }
    trackHudTimeout(() => {
      if (typeof window.showScoreBottomSheet === 'function') {
        window.showScoreBottomSheet();
      }
    }, 450);
    return;
  }

  if (typeof window.triggerHapticImpact === 'function') {
    window.triggerHapticImpact('light');
  }

  playPixiSoftCartoonBounce(bounceTarget);

  if (typeof window.showScoreBottomSheet === 'function') {
    window.showScoreBottomSheet();
  } else {
    console.error('❌ showScoreBottomSheet function not available!');
  }
}

/**
 * Cleanup all HUD timeouts
 */
export function cleanupHudTimeouts(): void {
  activeHudTimeouts.forEach(timeout => {
    try { clearTimeout(timeout); } catch {}
  });
  activeHudTimeouts.clear();
  console.log('✅ HUD timeouts cleaned up');
}

export function cleanupHudLifecycle(): void {
  hudLifecycle.cleanup();
}

interface GraphicsPool {
  acquire: () => Graphics;
  release: (g: Graphics) => void;
}

let graphicsPool: GraphicsPool | null = null;
let __globalGraphicsObjects: Set<Graphics> | null = null;

// Lazy load graphics pool to avoid circular dependency
function getGraphicsPool() {
  if (!graphicsPool) {
    // Fallback: create simple pool (object-pool.js might not be available)
    graphicsPool = {
      acquire: () => new Graphics(),
      release: () => {}
    };
    __globalGraphicsObjects = new Set();
    
    // Try to load object pool dynamically (if available)
    try {
      import('./object-pool.ts').then((poolModule: any) => {
        if (poolModule && poolModule.graphicsPool) {
          graphicsPool = poolModule.graphicsPool;
          __globalGraphicsObjects = poolModule.__globalGraphicsObjects || new Set();
          console.log('✅ Graphics pool loaded from object-pool.js');
        }
      }).catch(() => {
        // Silently fail - use fallback pool
      });
    } catch (e) {
      // Silently fail - use fallback pool
    }
  }
  return graphicsPool;
}

// Local boardSize function (same as in app.js)
function boardSize(): { w: number; h: number } {
  return { w: COLS * TILE + (COLS - 1) * GAP, h: ROWS * TILE + (ROWS - 1) * GAP };
}

// Old makeWildLoader function removed - using new PIXI implementation below

/* ---------------- Minimal HUD the app.js expects ---------------- */
export let HUD_ROOT: Container | null = null;
let wildMeterSpatialWrapper: Container | null = null;
let boardText: Text | null = null;
let scoreText: Text | null = null;
let comboText: Text | null = null;
let starText: Text | null = null;
let comboXText: Text | null = null; // "x" text reference for combo (14px)
let closeIconSprite: Sprite | null = null; // Close icon sprite (replaces boardText)
let comboWrap: Container | null = null; // wrapper for jitter
let wild: any = null;
let hudCloseButton: HTMLElement | null = null;
let boardIndicator: HTMLElement | null = null;
let boardIndicatorLabel: HTMLElement | null = null;
let comboWobbleTween: gsap.core.Tween | null = null; // GSAP tween for combo icon wobble animation

function formatHudBoardIndicatorLabel(boardNumber: number): string {
  return formatGameplayProgressLabel(
    isArcadeHomeRunMode() ? 'arcade' : 'journey',
    Math.max(0, boardNumber | 0),
    { padTo: 2 },
  );
}

// 🔥 CLEANUP: Function to kill all combo animations and prevent memory leaks
export function cleanupComboAnimations() {
  try {
    // 1. Kill wobble animation
    if (comboWobbleTween) {
      try {
        comboWobbleTween.kill();
        comboWobbleTween = null;
      } catch (e) {
        console.warn('⚠️ Error killing comboWobbleTween:', e);
      }
    }
    
    // 2. Kill morph timeline on combo icon sprite
    if (HUD_ROOT && HUD_ROOT._hudElements && HUD_ROOT._hudElements.combo) {
      const combo = HUD_ROOT._hudElements.combo;
      const iconSprite = combo.iconSprite;
      
      if (iconSprite && !iconSprite.destroyed) {
        // Kill morph timeline
        if (iconSprite._morphTimeline) {
          try {
            iconSprite._morphTimeline.kill();
            iconSprite._morphTimeline.clear?.();
            iconSprite._morphTimeline = null;
          } catch (e) {
            console.warn('⚠️ Error killing morphTimeline:', e);
          }
        }
        
        // Kill all GSAP tweens on icon sprite
        try {
          gsap.killTweensOf(iconSprite);
          gsap.killTweensOf(iconSprite.scale);
          gsap.killTweensOf(iconSprite.rotation);
          gsap.killTweensOf(iconSprite.alpha);
        } catch (e) {
          console.warn('⚠️ Error killing tweens on iconSprite:', e);
        }
        
        // Reset rotation
        iconSprite.rotation = 0;
      }
    }
    
    // 3. Kill jitter timeline
    if (__comboJitterTl) {
      try {
        __comboJitterTl.kill();
        __comboJitterTl.clear?.();
        __comboJitterTl = null;
      } catch (e) {
        console.warn('⚠️ Error killing __comboJitterTl:', e);
      }
    }
    
    // 4. Kill bump timeline
    if (__comboBumpTl) {
      try {
        __comboBumpTl.kill();
        __comboBumpTl.clear?.();
        __comboBumpTl = null;
      } catch (e) {
        console.warn('⚠️ Error killing __comboBumpTl:', e);
      }
    }
    
    // 5. Kill shake timeline
    if (__shakeTl) {
      try {
        __shakeTl.kill();
        __shakeTl.clear?.();
        __shakeTl = null;
      } catch (e) {
        console.warn('⚠️ Error killing __shakeTl:', e);
      }
    }
    
    // 6. Kill all tweens on combo text and wrap
    if (comboText) {
      try {
        gsap.killTweensOf(comboText);
        gsap.killTweensOf(comboText.scale);
        gsap.killTweensOf(comboText.rotation);
      } catch (e) {
        console.warn('⚠️ Error killing tweens on comboText:', e);
      }
    }
    
    if (comboWrap) {
      try {
        gsap.killTweensOf(comboWrap);
        gsap.killTweensOf(comboWrap.scale);
        gsap.killTweensOf(comboWrap.rotation);
      } catch (e) {
        console.warn('⚠️ Error killing tweens on comboWrap:', e);
      }
    }
    
    // 7. Reset shake multiplier
    __shakeMul = 1.0;
  } catch (err) {
    console.error('❌ Error during combo animations cleanup:', err);
  }
}
const BOARD_INDICATOR_ANIM_OFFSET = 72;
const BOARD_INDICATOR_BOTTOM = 24;
const BOARD_INDICATOR_Z_INDEX = '9';

function ensureBoardIndicator() {
  if (boardIndicator && document.body.contains(boardIndicator)) {
    return boardIndicator;
  }
  
  const container = document.createElement('div');
  container.id = 'hud-board-indicator';
  container.style.cssText = `
    position: fixed;
    bottom: ${BOARD_INDICATOR_BOTTOM}px;
    left: 23px;
    right: 23px;
    width: auto;
    height: 50px;
    display: flex;
    align-items: center;
    gap: 24px;
    z-index: ${BOARD_INDICATOR_Z_INDEX};
    pointer-events: none;
    font-family: 'Baloo2', 'Arial', sans-serif;
    transform: translateY(0);
    opacity: 1;
  `;
  
  const createLine = () => {
    const line = document.createElement('div');
    line.style.cssText = `
      flex: 1;
      height: 2px;
      background: #EDE0D5;
      border-radius: 999px;
    `;
    return line;
  };
  
  const label = document.createElement('div');
  label.id = 'hud-board-indicator-label';
  label.textContent = formatHudBoardIndicatorLabel(1);
  label.style.cssText = `
    width: fit-content;
    min-width: 0;
    min-height: 0;
    padding: 4px 60px;
    border-radius: 32px;
    background: rgba(243, 230, 220, 0.52);
    border: 1px solid #E8D3C8;
    color: #AD8775;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: 0;
    text-align: center;
    text-transform: none;
    pointer-events: none;
    transform: translateY(2px);
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  const leftLine = createLine();
  const rightLine = createLine();
  leftLine.style.zIndex = '1';
  rightLine.style.zIndex = '1';
  label.style.zIndex = '2';
  label.style.position = 'relative';
  
  container.appendChild(leftLine);
  container.appendChild(label);
  container.appendChild(rightLine);
  
  document.body.appendChild(container);
  gsap.set(container, { y: BOARD_INDICATOR_ANIM_OFFSET, opacity: 0 });
  container.setAttribute('data-state', 'hidden');
  boardIndicator = container;
  boardIndicatorLabel = label;
  return container;
}

function handleHUDClose() {
  try {
    uiManager.showHomepageWithAnimation();
  } catch (error) {
    console.warn('⚠️ HUD close animation failed, falling back to standard homepage', error);
    try {
      uiManager.showHomepage();
    } catch (fallbackError) {
      console.warn('⚠️ HUD close fallback failed:', fallbackError);
    }
  }
}

function applyCloseButtonStyles(button, useFixedPosition) {
  button.style.cssText = `
    position: ${useFixedPosition ? 'fixed' : 'absolute'};
    top: 28px;
    left: 24px;
    width: 44px;
    height: 44px;
    border: none;
    background: none;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    pointer-events: auto;
    z-index: ${useFixedPosition ? 4000 : 10};
  `;
}

function ensureHUDCloseButton(parent = null) {
  const targetParent = parent || document.querySelector('[data-unified-hud]') || document.body;
  const useFixedPosition = !parent;
  
  if (!hudCloseButton) {
    const button = document.createElement('button');
    button.id = 'hud-close-button';
    button.type = 'button';
    button.setAttribute('aria-label', 'Close');
    applyCloseButtonStyles(button, useFixedPosition);
    
    button.addEventListener('click', () => handleHUDClose());
    button.addEventListener('pointerdown', () => {
      button.style.transform = 'scale(0.92)';
    });
    const resetScale = () => {
      button.style.transform = 'scale(1)';
    };
    button.addEventListener('pointerup', resetScale);
    button.addEventListener('pointerleave', resetScale);
    
    const icon = document.createElement('img');
    icon.src = './assets/close-icon.png';
    icon.srcset = './assets/close-icon.png 1x, ./assets/close-icon@3x.png 2x, ./assets/close-icon@3x.png 3x';
    icon.alt = 'Close';
    icon.style.cssText = `
      width: 32px;
      height: 32px;
      object-fit: contain;
      pointer-events: none;
    `;
    button.appendChild(icon);
    
    hudCloseButton = button;
  } else {
    applyCloseButtonStyles(hudCloseButton, useFixedPosition);
  }
  
  if (targetParent && hudCloseButton.parentElement !== targetParent) {
    targetParent.appendChild(hudCloseButton);
  }
  
  return hudCloseButton;
}

function updateBoardIndicatorValue(boardNumber) {
  if (!boardIndicatorLabel) {
    ensureBoardIndicator();
  }
  if (boardIndicatorLabel) {
    boardIndicatorLabel.textContent = formatHudBoardIndicatorLabel(boardNumber);
  }
}

export function updateBoardIndicatorValueWithBounce(boardNumber) {
  const indicator = ensureBoardIndicator();
  updateBoardIndicatorValue(boardNumber);
  if (!isArcadeHomeRunMode() || !boardIndicatorLabel) return;

  try {
    indicator.style.display = 'flex';
    indicator.style.visibility = 'visible';
    indicator.style.opacity = '1';
    indicator.style.zIndex = BOARD_INDICATOR_Z_INDEX;
    indicator.setAttribute('data-state', 'visible');
    gsap.killTweensOf(boardIndicatorLabel);
    gsap.killTweensOf(indicator);
    gsap.set(indicator, { y: 0, opacity: 1 });
    gsap.set(boardIndicatorLabel, { scale: 0.88, y: 8, transformOrigin: 'center center' });
    const timeline = trackTimeline();
    timeline
      .to(boardIndicatorLabel, {
        scale: 1.13,
        y: -2,
        duration: 0.2,
        ease: 'back.out(2.2)',
      })
      .to(boardIndicatorLabel, {
        scale: 1,
        y: 2,
        duration: 0.16,
        ease: 'power2.out',
      });
  } catch {}
}

function syncBoardIndicatorForHudInit(initialHide = false) {
  const indicator = ensureBoardIndicator();
  const stateBoard = Number((window as any)?.STATE?.boardNumber);
  const boardNumber = Number.isFinite(stateBoard) && stateBoard > 0 ? stateBoard : 1;
  updateBoardIndicatorValue(boardNumber);
  
  if (initialHide || !isArcadeHomeRunMode()) {
    indicator.style.display = 'none';
    indicator.setAttribute('data-state', 'hidden');
    gsap.set(indicator, { y: BOARD_INDICATOR_ANIM_OFFSET, opacity: 0 });
    return;
  }
  
  const shouldAnimateEnter =
    indicator.getAttribute('data-state') !== 'visible' ||
    indicator.style.display === 'none' ||
    indicator.style.opacity === '0';
  
  if (shouldAnimateEnter) {
    animateBoardIndicatorEnter(0.35);
    return;
  }
  
  indicator.style.display = 'flex';
  indicator.style.visibility = 'visible';
  indicator.style.opacity = '1';
  indicator.style.zIndex = BOARD_INDICATOR_Z_INDEX;
  indicator.style.pointerEvents = 'none';
  indicator.setAttribute('data-state', 'visible');
}

function animateBoardIndicatorEnter(duration = 0.8) {
  const indicator = ensureBoardIndicator();
  try { gsap.killTweensOf(indicator); } catch {}
  if (!isArcadeHomeRunMode()) {
    indicator.style.display = 'none';
    indicator.setAttribute('data-state', 'hidden');
    gsap.set(indicator, { y: BOARD_INDICATOR_ANIM_OFFSET, opacity: 0 });
    return;
  }
  // CRITICAL: Make sure element is visible before animating
  if (indicator) {
    indicator.style.display = 'flex'; // Restore display (was set to 'none' on exit)
    indicator.style.visibility = 'visible';
    indicator.style.opacity = '1';
    indicator.style.zIndex = BOARD_INDICATOR_Z_INDEX;
    indicator.style.pointerEvents = 'none';
    indicator.setAttribute('data-state', 'entering');
  }
  gsap.set(indicator, { y: BOARD_INDICATOR_ANIM_OFFSET, opacity: 0 });
  trackTween(indicator, {
    y: 0,
    opacity: 1,
    duration,
    ease: 'elastic.out(1, 0.6)',
    onComplete: () => {
      if (indicator) {
        indicator.setAttribute('data-state', 'visible');
      }
    }
  });
}

export function animateBoardIndicatorExit(duration = 0.3) {
  if (!boardIndicator || !document.body.contains(boardIndicator)) return;
  try { gsap.killTweensOf(boardIndicator); } catch {}
  // Use fixed 0.3s duration to match HUD exit speed, or use provided duration if it's faster
  const exitDuration = Math.min(0.3, duration || 0.3);
  trackTween(boardIndicator, {
    y: BOARD_INDICATOR_ANIM_OFFSET,
    opacity: 0,
    duration: exitDuration,
    ease: 'power2.in',
    onComplete: () => {
      if (boardIndicator) {
        boardIndicator.setAttribute('data-state', 'hidden');
        // Hide element completely after animation
        boardIndicator.style.display = 'none';
      }
    }
  });
}

// Unified container for PIXI HUD + DOM wild preloader
let unifiedHudContainer: Container | null = null;

export function createUnifiedHudContainer() {
  console.log('🎯 Creating unified HUD container...');
  
  // Create the unified container
  unifiedHudContainer = document.createElement('div');
  unifiedHudContainer.setAttribute('data-unified-hud', '');
  unifiedHudContainer.style.cssText = `
    position: fixed;
    top: 0px;
    left: 0px;
    right: 0px;
    height: 140px;
    z-index: 2000;
    pointer-events: none;
    transform: translateY(-100%);
    transition: transform 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  `;
  
  // Add to app container
  const appContainer = document.getElementById('app');
  if (appContainer) {
    appContainer.appendChild(unifiedHudContainer);
    console.log('✅ Unified HUD container created and added to app');
  } else {
    document.body.appendChild(unifiedHudContainer);
    console.log('✅ Unified HUD container created and added to body (fallback)');
  }
  
  ensureHUDCloseButton(unifiedHudContainer);
  ensureBoardIndicator();
  
  return unifiedHudContainer;
}

export function animateUnifiedHudDrop() {
  if (!unifiedHudContainer) return;
  
  console.log('🎯 Animating unified HUD drop...');
  unifiedHudContainer.style.transform = 'translateY(0%)';
  
  // Mark as dropped after animation
  // 🔥 FIX: Track timeout for cleanup
  trackHudTimeout(() => {
    unifiedHudContainer.setAttribute('data-dropped', 'true');
    console.log('✅ Unified HUD dropped and marked as dropped');
  }, 800);
}

export function getUnifiedHudInfo() {
  if (!unifiedHudContainer) {
    return { y: 0, height: 0, parent: null, dropped: false };
  }
  
  const rect = unifiedHudContainer.getBoundingClientRect();
  const dropped = unifiedHudContainer.getAttribute('data-dropped') === 'true';
  
  return {
    y: rect.top,
    height: rect.height,
    parent: unifiedHudContainer.parentNode,
    dropped: dropped
  };
}

// Create PIXI wild meter
function makeWildLoader() {
  console.log('🎯 Creating PIXI wild meter...');
  
  const container = new Container();
  container.label = 'wildLoader';
  
  // Background bar (Pixi v8: roundRect + fill; fallback: beginFill/drawRoundedRect/endFill)
  const bg = new Graphics();
  const g = bg as Graphics & { roundRect?: (x: number, y: number, w: number, h: number, r: number) => void; fill?: (opts: { color: number }) => void };
  if (typeof g.roundRect === 'function' && typeof g.fill === 'function') {
    g.roundRect(0, 0, 200, 10, 5);
    g.fill({ color: 0xEADFD6 });
  } else {
    bg.beginFill(0xEADFD6);
    bg.drawRoundedRect(0, 0, 200, 10, 5);
    bg.endFill();
  }
  bg.zIndex = 0;
  
  // Decorative dashed line 2px above wild bar
  const dashLine = new Graphics();
  const drawDashLine = (width = 200) => {
    dashLine.clear();
    const dashLength = 6;
    const gapLength = 4;
    let currentX = 0;
    const lineY = -4;
    while (currentX < width) {
      dashLine.moveTo(currentX, lineY);
      const nextX = Math.min(currentX + dashLength, width);
      dashLine.lineTo(nextX, lineY);
      currentX = nextX + gapLength;
    }
    dashLine.stroke({
      color: 0xEAD7CD,
      width: 1,
      alignment: 0.5,
      cap: 'round'
    });
  };
  drawDashLine();
  dashLine.visible = false; // temporarily hide dashed line; retain for future styling tweaks
  dashLine.zIndex = 10_000;
  container.sortableChildren = true;
  
  // Progress fill - start with 0 width (Pixi v8 or legacy)
  const fill = new Graphics();
  const f = fill as Graphics & { roundRect?: (x: number, y: number, w: number, h: number, r: number) => void; fill?: (opts: { color: number }) => void };
  if (typeof f.roundRect === 'function' && typeof f.fill === 'function') {
    f.roundRect(0, 0, 0, 10, 5);
    f.fill({ color: 0xE7744A });
  } else {
    fill.beginFill(0xE7744A);
    fill.drawRoundedRect(0, 0, 0, 10, 5);
    fill.endFill();
  }
  fill.zIndex = 5000;
  
  container.addChild(bg, fill, dashLine);
  
  // Position relative to HUD
  container.x = 24;
  container.y = 52; // Below HUD values (moved up 8px from 60)
  container.zIndex = 1000; // Below PIXI HUD
  
  // Store references
  container._bg = bg;
  container._fill = fill;
  container._dashLine = dashLine;
  container._drawDashLine = drawDashLine;
  container._maxWidth = 200;
  const fillRestY = 0;

  const drawFill = (targetFill: Graphics, w: number) => {
    targetFill.clear();
    const maxVisibleWidth = (container._maxWidth || 0) * 1.05;
    const clampedWidth = Math.max(0, Math.min(maxVisibleWidth, w));
    const fr = targetFill as Graphics & { roundRect?: (a: number, b: number, c: number, d: number, e: number) => void; fill?: (o: { color: number }) => void };
    if (typeof fr.roundRect === 'function' && typeof fr.fill === 'function') {
      fr.roundRect(0, 0, clampedWidth, 10, 5);
      fr.fill({ color: 0xE7744A });
    } else {
      targetFill.beginFill(0xE7744A);
      targetFill.drawRoundedRect(0, 0, clampedWidth, 10, 5);
      targetFill.endFill();
    }
  };

  const playFillVerticalBounce = (targetFill: any) => {
    if (!targetFill || targetFill.destroyed) return;
    try {
      if (container._springTimeline) {
        container._springTimeline.kill();
        container._springTimeline = null;
      }
      gsap.killTweensOf(targetFill, 'y');
      targetFill.y = fillRestY;
      container._springTimeline = trackTimeline({
        onComplete: () => {
          container._springTimeline = null;
          if (!targetFill.destroyed) targetFill.y = fillRestY;
        },
      })
        .to(targetFill, {
          y: fillRestY - 2.5,
          duration: 0.16,
          ease: 'sine.out',
        })
        .to(targetFill, {
          y: fillRestY + 1.3,
          duration: 0.18,
          ease: 'sine.inOut',
        })
        .to(targetFill, {
          y: fillRestY,
          duration: 0.24,
          ease: 'elastic.out(1, 0.82)',
        });
    } catch {}
  };

  // Methods
  container.setProgress = (ratio, animate = false) => {
    const fill = container._fill;
    if (!fill || (fill as { destroyed?: boolean }).destroyed) return;
    const progress = Math.max(0, Math.min(1, ratio));
    const width = progress * container._maxWidth;
    if (container._currentAnimation) {
      container._currentAnimation.kill();
      container._currentAnimation = null;
    }
    if (container._springTimeline) {
      container._springTimeline.kill();
      container._springTimeline = null;
    }
    gsap.killTweensOf(fill);
    fill.y = fillRestY;
    if (container._smokeInterval) {
      clearInterval(container._smokeInterval);
      container._smokeInterval = null;
    }
    if (animate) {
      // Use GSAP to animate the width by redrawing the fill
      const startWidth = container._fill.width || 0;
      const isIPad = (() => {
        if (typeof window === 'undefined') return false;
        const w = window.innerWidth;
        const h = window.innerHeight;
        return /iPad/.test(navigator.userAgent) ||
          ((w >= 768 && w <= 1400) && (h >= 768 && h <= 1400)) ||
          (navigator.maxTouchPoints > 1 && w >= 768 && w <= 1400);
      })();
      const duration = isIPad ? 0.32 : 0.4; // 20% faster on iPad
      const isGrowing = width > startWidth + 0.5;
      const reachedFull = progress >= 0.999;

      // Start smoke effect during animation unless tutorial explicitly freezes HUD FX.
      if (!isWildMeterSmokeFrozen()) container._smokeInterval = setInterval(() => {
        if (isWildMeterSmokeFrozen()) {
          clearInterval(container._smokeInterval);
          container._smokeInterval = null;
          return;
        }
        if (!container?.parent || !container._fill) return;
        const hudStage = container.parent;
        if (!hudStage) return;
        const fillWidth = container._fill?.width || 0;
        const globalX = container.x + (Math.random() * Math.max(1, fillWidth));
        const globalY = container.y + 5 + ((Math.random() - 0.5) * 5); // Spread across bar thickness
        
        // Create anonymous Graphics for smoke
        const smokeBubble = new Graphics();
        smokeBubble.label = 'wild-meter-smoke';
        smokeBubble._isWildMeterSmokeBubble = true;
        
        // Only orange smoke bubbles
        const color = 0xF86B3C;
        const alpha = 0.5; // Orange at 0.5 opacity
        
        // Increased by 100%: 3-6px radius (base 2-4px * 2)
        const radius = (2 + Math.random() * 2) * 2;
        
        smokeBubble.circle(0, 0, radius).fill({ color: color, alpha: alpha });
        
        // Position across the full active orange fill instead of a single edge point.
        smokeBubble.x = globalX;
        smokeBubble.y = globalY;
        smokeBubble.zIndex = 2000; // Above the progress bar (which is z-index 1000)
        
        hudStage.addChild(smokeBubble);
        
        // Animate smoke: float up and fade out
        trackTween(smokeBubble, {
          y: globalY - 15 - Math.random() * 10,
          x: globalX + (Math.random() - 0.5) * 10,
          alpha: 0,
          duration: 1.0 + Math.random() * 0.3, // 0.5s longer (was 0.5-0.8s, now 1.0-1.3s)
          ease: 'power1.out',
          onComplete: () => {
            if (smokeBubble && smokeBubble.parent) {
              smokeBubble.parent.removeChild(smokeBubble);
              smokeBubble.destroy();
            }
          }
        });
      }, 100); // Every 100ms during animation
      
      const animatedFill = { width: startWidth };
      const redrawAnimatedFill = () => {
        const f = container._fill;
        if (!f || (f as { destroyed?: boolean }).destroyed) return;
        try {
          drawFill(f, animatedFill.width);
        } catch {}
      };
      const finishAnimation = () => {
        drawFill(fill, width);
        if (container._smokeInterval) {
          clearInterval(container._smokeInterval);
          container._smokeInterval = null;
        }
        container._currentAnimation = null;
      };

      if (isGrowing) {
        playFillVerticalBounce(fill);
        const overshootDistance = Math.max(3.5, width * 0.05);
        const overWidth = width + overshootDistance;
        const underWidth = Math.max(0, width - Math.max(1.5, overshootDistance * 0.36));
        const secondOverWidth = width + Math.max(2, overshootDistance * 0.58);
        container._currentAnimation = trackTimeline({ onComplete: finishAnimation })
          .to(animatedFill, {
            width: overWidth,
            duration: duration * 0.68,
            ease: 'power4.out',
            onUpdate: redrawAnimatedFill,
          })
          .to(animatedFill, {
            width: underWidth,
            duration: reachedFull ? 0.13 : 0.11,
            ease: 'sine.inOut',
            onUpdate: redrawAnimatedFill,
          })
          .to(animatedFill, {
            width: secondOverWidth,
            duration: reachedFull ? 0.15 : 0.13,
            ease: 'sine.out',
            onUpdate: redrawAnimatedFill,
          })
          .to(animatedFill, {
            width,
            duration: reachedFull ? 0.26 : 0.22,
            ease: reachedFull ? 'elastic.out(1, 0.74)' : 'back.out(1.15)',
            onUpdate: redrawAnimatedFill,
          });
      } else {
        container._currentAnimation = trackTween(animatedFill, {
          width: width,
          duration,
          ease: 'power2.out',
          onUpdate: redrawAnimatedFill,
          onComplete: finishAnimation,
        });
      }
    } else {
      try {
        drawFill(fill, width);
      } catch {}
    }
  };
  
  container.setWidth = (width) => {
    // CRITICAL: Check if _bg and _fill exist before using them
    if (!container._bg || !container._fill) {
      console.error('❌ HUD: container._bg or _fill is null! Cannot set width.');
      return;
    }
    
    container._maxWidth = width;
    const drawRect = (g: Graphics, w: number, color: number) => {
      g.clear();
      const gr = g as Graphics & { roundRect?: (a: number, b: number, c: number, d: number, e: number) => void; fill?: (o: { color: number }) => void };
      if (typeof gr.roundRect === 'function' && typeof gr.fill === 'function') {
        gr.roundRect(0, 0, w, 10, 5);
        gr.fill({ color });
      } else {
        g.beginFill(color);
        g.drawRoundedRect(0, 0, w, 10, 5);
        g.endFill();
      }
    };
    drawRect(container._bg, width, 0xEADFD6);
    drawFill(container._fill, 0);
    if (container._drawDashLine) {
      container._drawDashLine(width);
    }
  };
  
  return {
    view: container,
    setProgress: container.setProgress,
    setWidth: container.setWidth
  };
}

// wild is declared at line 17, no need to redeclare

export { wild };

/** No-op; used by app-core before wild spawn. Optional wild meter refresh. */
export function shimmerProgress(): void {}

export function getWildMeterDropOrigin(): { x: number; y: number } | null {
  try {
    const view = wild?.view;
    if (!view || view.destroyed) return null;
    const width = Number(view._maxWidth) || 200;
    const local = { x: width, y: 5 };
    if (typeof view.toGlobal === 'function') {
      const global = view.toGlobal(local);
      if (global && Number.isFinite(global.x) && Number.isFinite(global.y)) {
        return { x: global.x, y: global.y };
      }
    }
    if (Number.isFinite(view.x) && Number.isFinite(view.y)) {
      return { x: view.x + local.x, y: view.y + local.y };
    }
  } catch {}
  return null;
}

/** True if HUD container has been destroyed (for cleanup checks). */
export function isHUDDestroyed(): boolean {
  return !!(HUD_ROOT && (HUD_ROOT as { destroyed?: boolean }).destroyed);
}

export function getWildMeterSpatialWrapper(): Container | null {
  if (!wildMeterSpatialWrapper || wildMeterSpatialWrapper.destroyed) return null;
  return wildMeterSpatialWrapper;
}

let __comboJitterTl: gsap.core.Timeline | null = null;
let __comboBumpTl: gsap.core.Timeline | null = null;
let __shakeTl: gsap.core.Timeline | null = null;        // drives shake amplitude during bump/deflate
let __lastComboVal: number = 0;
let __shakeMul: number = 1.0;        // global multiplier sampled by jitter
let __scoreTweening: boolean = false;
let __boardTweening = false;
let __prevScore = 0;
let __prevBoard = 0;
let __scoreStarBurstCount = 0;
let __scoreStarDeflateTimeout: ReturnType<typeof setTimeout> | null = null;
let __scoreStarBumpTl: gsap.core.Timeline | null = null;

function bounceText(obj, { peak=1.28, back=1.06, up=0.10, down=0.24 } = {}){
  if (!obj) return;
  try { gsap.killTweensOf(obj.scale); } catch {}
  trackTimeline()
    .to(obj.scale, { x: peak, y: peak, duration: up, ease: 'back.out(3)' }, 0)
    .to(obj.scale, { x: back, y: back, duration: down, ease: 'elastic.out(1,0.78)' }, '>-0.02');
}

function startComboFX(){
  if (!comboText) return;
  // keep a slightly enlarged base while active
  try { gsap.killTweensOf(comboText); } catch {}
  if (!__comboJitterTl){
    __comboJitterTl = trackTimeline({ repeat: -1, repeatRefresh: true });
    const rot = () => (Math.random() * 0.144*__shakeMul - 0.072*__shakeMul); // scaled by shakeMul
    const d   = () => (0.14 + Math.random() * 0.12);
    const dx  = () => (0.036*__shakeMul + Math.random() * 0.084*__shakeMul);
    __comboJitterTl
      .to(comboWrap || comboText, { rotation: rot, duration: d, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0)
      .to((comboWrap && comboWrap.scale) ? comboWrap.scale : comboText.scale, { x: () => `+=${dx()}`, y: () => `+=${dx()}`, duration: d, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0);
  }
}
function stopComboFX(){
  // 🔥 CLEANUP: Kill all combo animations before stopping
  cleanupComboAnimations();
  
  if (!comboText) return;
  // elastic bounce back to rest
  try {
    trackTween(comboWrap || comboText, { rotation: 0, duration: 0.25, ease: 'power2.out' });
    // sporiji, nježniji decay natrag na 1.0
    trackTween(comboWrap ? comboWrap.scale : comboText.scale, { x: 1, y: 1, duration: 0.40, ease: 'power2.out' });
    trackTween(comboText.scale, { x: 1, y: 1, duration: 1.40, ease: 'elastic.out(1,0.9)' });
    // reset shake multiplier smoothly (but don't recreate if we just cleaned up)
    if (!__shakeTl) {
    const sh = { k: __shakeMul };
    __shakeTl = trackTween(sh, { k: 1.0, duration: 0.60, ease: 'power2.out', onUpdate: () => { __shakeMul = sh.k; } });
    }
  } catch {}
}

export function bumpScoreNumberFromHudStar(): void {
  if (!scoreText) return;

  __scoreStarBurstCount = Math.min(__scoreStarBurstCount + 1, 6);
  const peak = Math.min(1.79, 1.46 + (__scoreStarBurstCount - 1) * 0.084);
  const cur = Math.max(scoreText.scale?.x || 1, scoreText.scale?.y || 1);
  const upDur = Math.max(0.08, 0.16 - (cur - 1) * 0.06);

  try {
    __scoreStarBumpTl?.kill?.();
  } catch {}
  try { gsap.killTweensOf(scoreText.scale); } catch {}

  if (__scoreStarDeflateTimeout) {
    try {
      clearTimeout(__scoreStarDeflateTimeout);
      activeHudTimeouts.delete(__scoreStarDeflateTimeout);
    } catch {}
    __scoreStarDeflateTimeout = null;
  }

  __scoreStarBumpTl = trackTimeline({
    onComplete: () => {
      __scoreStarBumpTl = null;
      __scoreStarBurstCount = 0;
    }
  });
  __scoreStarBumpTl
    .to(scoreText.scale, {
      x: peak,
      y: peak,
      duration: upDur,
      ease: 'back.out(3)'
    }, 0)
    .to(scoreText.scale, {
      x: 1.0,
      y: 1.0,
      duration: 1.05,
      ease: 'power2.out'
    }, '>-0.01');

  __scoreStarDeflateTimeout = trackHudTimeout(() => {
    __scoreStarDeflateTimeout = null;
    __scoreStarBurstCount = 0;
  }, 2600);
}

export function layout({ app, top }: { app: Application; top?: number }): void { 
  if (!HUD_ROOT) return;
  const vw = app.renderer.width;
  const vh = app.renderer.height;
  
  // Respect the provided top from app.js (safeTop already accounts for safe areas)
  const isMobile = vw < 768 || vh > vw;
  const SIDE = 24;            // bočni odmak
  // NOTE: yLabel/yValue are LOCAL to HUD_ROOT. HUD_ROOT.y is set to 'top'.
  const yLabel = 0;           // red s labelima (local)
  const yValue = 20;          // red s vrijednostima (local)
  
  // Use stable fontSize for spacing (avoids tiny drift from Text.height timing)
  const valueRowH = Math.max(
    boardText?.style?.fontSize || 24,
    scoreText?.style?.fontSize || 24,
    comboText?.style?.fontSize || 24
  );
  const barGap    = Math.round(vh * 0.02); // 2% gap below the numbers
  const barY      = yValue + valueRowH + barGap; 

  // labeli
  // (renderamo ih jednom; pozicioniranje brojeva ispod)
  if (!HUD_ROOT._labels) {
    const lblStyle = { fontFamily: 'Baloo2, system-ui, -apple-system, sans-serif', fontSize: 16, fill: 0x735C4C, fontWeight: '700', fontStyle: 'normal' };
    const m = new Text({ text: 'Stage', style: lblStyle });
    const s = new Text({ text: 'Score', style: lblStyle });
    const c = new Text({ text: 'Combo', style: lblStyle });
    m.anchor.set(0.5, 0);
    s.anchor.set(0.5, 0);
    c.anchor.set(0.5, 0);
    HUD_ROOT.addChild(m, s, c);
    HUD_ROOT._labels = { m, s, c };
  }
  const { m, s, c } = HUD_ROOT._labels;
  // 🔥 NEW HUD: Hide all old labels (we now use icons)
  if (m) {
    m.visible = false;
    m.renderable = false;
  }
  if (s) {
    s.visible = false;
    s.renderable = false;
  }
  if (c) {
    c.visible = false;
    c.renderable = false;
  }

  // pozicioniranje labela
  const leftCenter  = SIDE + m.width / 2;   // center of the left column
  const midCenter   = Math.round(vw / 2);   // center column
  const rightCenter = Math.round(vw - SIDE - c.width / 2); // center of the right column

  m.x = leftCenter;
  s.x = midCenter;
  c.x = rightCenter;
  m.y = s.y = c.y = yLabel;

  // 🔥 NEW HUD DESIGN: Fixed positions from right to left
  // Layout: Combo (24px from right edge) → Coin (64px left) → Star (64px left)
  // - Close icon: left (existing position)
  // - Combo: 24px from right edge (desni rub elementa)
  // - Coin: 64px lijevo od lijevog ruba Combo
  // - Star: 64px lijevo od lijevog ruba Coin
  
  const hudHeight = 36;
  const hudY = yValue + (valueRowH - hudHeight) / 2; // Center vertically in value row
  const isIPadHud = isIPadHudViewport(vw);
  const comboToCoinSpacing = getHudScoreComboSpacing(vw); // iPad uses +20% spacing for help/score/combo rhythm.
  const coinToStarSpacing = 64; // 64px spacing from coin icon to star element
  const hudStatsComboLeftShift = getHudStatsComboLeftShift(vw); // Move score + combo group 5% toward the X icon
  // 🔥 USER REQUEST: 24px padding from right edge (calculated as percentage of screen width)
  // For iPhone 13 (390px width): 24px = 6.15% of screen width
  // We'll use fixed 24px but calculate it relative to screen width for consistency
  const comboRightPadding = 24; // 24px from the safe right edge.
  
  // Position close icon (left, existing position) - aligned with other HUD elements
  boardText.x = leftCenter;
  boardText.y = yValue;
  if (closeIconSprite) {
    closeIconSprite.x = leftCenter;
    closeIconSprite.y = yValue; // Aligned with other HUD elements (moved up 2px from previous position)
    closeIconSprite.visible = true;
  }
  
  // Position new HUD elements from right to left with fixed positions
  if (HUD_ROOT._hudElements) {
    const { star, coin, combo } = HUD_ROOT._hudElements;
    
    // Keep 24px from the safe right edge.
    // We'll use the same approach: rightEdge = vw - 24px padding
    const rightEdge = vw - comboRightPadding; // 24px padding from right edge
    
    // 🔥 FIXED POSITIONS: All elements (Combo, Coin, Star) have fixed positions with same spacing
    // Positions are calculated from right edge, not based on text width (non-responsive)
    
    // Combo - 12px left of wild preloader right edge (perfect alignment with offset)
    if (comboWrap && combo && combo.container) {
      // 🔥 USER REQUEST: Position combo 12px left of wild preloader right edge
      // Wild preloader: x = 24px, width = vw - 48px, so right edge = 24 + (vw - 48) = vw - 24px
      // Combo should be 12px left of wild preloader right edge = vw - 24px - 12px = vw - 36px
      // Combo container anchor is at center, so we need to calculate actual total width
      const iconWidth = combo.iconSprite ? combo.iconSprite.width * combo.iconSprite.scale.x : 28;
      const xTextWidth = combo.xText ? combo.xText.width : 0;
      const numberTextWidth = combo.text ? combo.text.width : 0;
      const spacing = 4;
      const totalWidth = iconWidth + spacing + xTextWidth + numberTextWidth;
      
      // Wild preloader right edge: vw - 24px (SIDE = 24px, barW = vw - 48px, so right = 24 + (vw - 48) = vw - 24)
      const wildPreloaderRightEdge = vw - 24;
      // Combo right edge should be 12px left of wild preloader right edge
      const comboRightEdge = wildPreloaderRightEdge - 12; // vw - 36px
      
      // Position combo so its right edge is 12px left of wild preloader right edge.
      // Keep right alignment in arcade as well.
      const comboDefaultX = comboRightEdge - totalWidth / 2;
      comboWrap.x = comboDefaultX - hudStatsComboLeftShift;
      comboWrap.y = yValue;

      if (HUD_ROOT._comboTouchArea) {
        const comboTouchArea = HUD_ROOT._comboTouchArea;
        comboTouchArea.x = comboWrap.x - 53;
        comboTouchArea.y = comboWrap.y - 30;
      }
      
    }
    
    // Coin - 80px left of Combo ICON (not center) - fixed position (same spacing as before)
    if (coin && coin.container) {
      // Calculate combo center position
      const estimatedComboWidth = 62;
      const comboCenterX = rightEdge - estimatedComboWidth / 2;
      
      // Combo icon is at: comboCenterX - (estimatedComboWidth / 2) + (iconWidth / 2)
      // Icon width is 28px, so icon left edge is at comboCenterX - estimatedComboWidth/2
      // Icon center is at comboCenterX - estimatedComboWidth/2 + 14 (half of 28px)
      const comboIconLeftEdge = comboCenterX - estimatedComboWidth / 2;
      
      // Coin center: same spacing as Journey (no extra arcade-only shift).
      const coinDefaultX = comboIconLeftEdge - comboToCoinSpacing - hudStatsComboLeftShift;
      coin.container.x = coinDefaultX;
      coin.container.y = yValue;
      
      // 🔥 USER REQUEST: Position score touch area (red rectangle) over coinHud
      if (HUD_ROOT._scoreTouchArea) {
        const scoreTouchArea = HUD_ROOT._scoreTouchArea;
        // Position red rectangle centered on coinHud container, then shift 8px right
        // coinHud.container.x is the center, so we need to offset by half the touch area width
        // User requested: 70px width, shifted 8px right
        scoreTouchArea.x = coin.container.x - 53 + 20; // 53px = half of 106px width, +20px right
        scoreTouchArea.y = coin.container.y - 30; // 30px = half of 60px height (centered vertically)
      }
    }
    
    // Star - 64px left of Coin ICON (not center) - fixed position (same spacing as before)
    if (star && star.container) {
      star.container.visible = false;
      star.container.renderable = false;
      star.container.eventMode = 'none';
      // Calculate combo and coin positions
      const estimatedComboWidth = 62;
      const comboCenterX = rightEdge - estimatedComboWidth / 2;
      const comboIconLeftEdge = comboCenterX - estimatedComboWidth / 2;
      const coinCenterX = comboIconLeftEdge - comboToCoinSpacing;
      
      // Coin icon left edge (coin icon is 28px, so left edge is coinCenterX - 14)
      const coinIconLeftEdge = coinCenterX - 14; // Half of 28px icon
      
      // Star center is 64px left of coin icon left edge, then 16px more to the left
      star.container.x = coinIconLeftEdge - coinToStarSpacing - 16;
      star.container.y = yValue;
    }
  } else {
    // Fallback to old positioning if new elements not created yet
  scoreText.x = midCenter;
  scoreText.y = yValue;
    if (comboWrap) {
      comboWrap.x = rightCenter;
      comboWrap.y = yValue;
    }
    comboText.x = 0;
    comboText.y = 0;
  }

  const barW = Math.max(120, vw - SIDE * 2);
  // Old wild loader disabled - using DOM wild meter instead
  // if (wild && wild.view) { ... }
  
  // Update PIXI wild meter position
  if (wild && wild.view) {
    const vw = app.renderer.width;
    const vh = app.renderer.height;
    const SIDE = 24;
    const barW = Math.max(120, vw - SIDE * 2);
    const yValue = 20;
    const valueRowH = Math.max(24, 24, 24);
    const barGap = Math.round(vh * 0.02);
    
    wild.view.x = SIDE;
    wild.view.y = yValue + valueRowH + barGap - 8; // Moved up 8px
    wild.setWidth(barW);
  }
  
  // Position X button with the same HUD-relative left edge as the wild/preload bar.
  if (HUD_ROOT._xButton) {
    const xButton = HUD_ROOT._xButton;
    const hudLeftPadding = SIDE; // Match wild.view.x / preload bar left edge.
    const xTopPadding = 2 - 16 - 8 - 4 - 2 - 16 + 6 + 2; // Move up 38px from yValue (2px lower - user requested)

    // The visible dashed border starts at local x=0, so this aligns that border
    // with the preload bar. The larger invisible hit area still extends left.
    xButton.x = hudLeftPadding;
    xButton.y = yValue + xTopPadding;
  }

  if (HUD_ROOT._helpButton) {
    const helpButton = HUD_ROOT._helpButton;
    const hudLeftPadding = SIDE;
    const helpButtonSize = 44;
    const xTouchAreaWidth = 56;
    const helpGapFromClose = 16;
    const coinContainer = HUD_ROOT._hudElements?.coin?.container;
    const iPadHelpToScoreSpacing = comboToCoinSpacing;

    helpButton.x = isIPadHud && coinContainer
      ? coinContainer.x - iPadHelpToScoreSpacing - helpButtonSize / 2
      : hudLeftPadding + xTouchAreaWidth + helpGapFromClose;
    helpButton.y = yValue - helpButtonSize / 2;
  }
  
  // Ensure HUD is properly positioned
  if (HUD_ROOT) {
    HUD_ROOT.zIndex = 10_000;
    HUD_ROOT.sortableChildren = true;
    // If drop not yet played, don't force y to top — only update the stored drop target.
    if (HUD_ROOT._dropped) {
      HUD_ROOT.y = top;      // pin to final top when already dropped
      HUD_ROOT.alpha = 1;
    } else {
      HUD_ROOT._dropTop = top; // remember final top for later drop animation
      // keep current y (likely top-80/-120)
    }
  } else {
    console.warn('⚠️ HUD_ROOT not found in layout function!');
  }
}

export function initHUD({ stage, app, top = 8, initialHide = false }) { 
  // Store stage visibility for later restoration
  const stageWasVisible = stage?.visible ?? true;
  const forceRecreateForTextures = (window as any).__ccForceHudRecreateForTextures === true;
  
  // 🔥 MEMORY SPIKE FIX: Reuse existing HUD_ROOT if it's valid and on the same stage.
  // This prevents unnecessary destroy/recreate cycles that cause memory spikes.
  // Previously we forced fresh HUD on board transition due to addressModeU concerns;
  // with ticker stop + skipCacheClear during transition, reuse is now safe.
  if (!forceRecreateForTextures && HUD_ROOT && !HUD_ROOT.destroyed && HUD_ROOT.parent === stage) {
    console.log('♻️ Reusing existing HUD_ROOT (same stage) - skipping destroy/recreate');
    // Kill any lingering animations before reusing
    try { gsap.killTweensOf(HUD_ROOT); } catch {}
    // Just update properties instead of destroying
    HUD_ROOT._dropTop = top;
    if (initialHide) {
      HUD_ROOT.alpha = 0;
      HUD_ROOT.y = top - 140;
      HUD_ROOT._dropped = false;
    } else {
      HUD_ROOT.alpha = 1;
      HUD_ROOT.y = top;
      HUD_ROOT._dropped = true;
    }
    // Update stage reference
    HUD_ROOT._stage = stage;
    HUD_ROOT._stageWasVisible = stageWasVisible;
    // Re-layout in case screen size changed (e.g. rotation)
    try { layout({ app, top }); } catch {}
    try { syncBoardIndicatorForHudInit(initialHide); } catch {}
    return; // Early return - HUD already exists and is valid
  }
  try { delete (window as any).__ccForceHudRecreateForTextures; } catch {}
  
  // očisti stari root ako postoji i skini stari resize listener
  try { if (HUD_ROOT && HUD_ROOT._onResize) window.removeEventListener('resize', HUD_ROOT._onResize); } catch {}
  // 🔥 CRITICAL: DESTROY old HUD_ROOT completely (MEMORY LEAK FIX)
  // Only destroy if HUD_ROOT exists and is invalid (different stage or destroyed)
  try { 
    if (HUD_ROOT && !HUD_ROOT.destroyed) {
      console.log('🧹 Destroying old HUD_ROOT with', HUD_ROOT.children?.length ?? 0, 'children');
      // 🔥 CRITICAL: Hide old HUD immediately to prevent 1-frame flash
      try { HUD_ROOT.alpha = 0; } catch {}
      try { HUD_ROOT.visible = false; } catch {}
      // Remove from parent first
      if (HUD_ROOT.parent) {
        try { HUD_ROOT.parent.removeChild(HUD_ROOT); } catch {}
      }
      // 🔥 CRITICAL FIX: Kill GSAP animations BEFORE destroying to prevent null property errors
      try { 
        killPixiGsapSubtree(gsap, HUD_ROOT);
        gsap.killTweensOf(HUD_ROOT);
        // Also kill animations on all children
        if (HUD_ROOT.children) {
          HUD_ROOT.children.forEach((child: any) => {
            try {
              if (child && !child.destroyed) {
                gsap.killTweensOf(child);
                gsap.killTweensOf(child.x);
                gsap.killTweensOf(child.y);
                gsap.killTweensOf(child.alpha);
                gsap.killTweensOf(child.scale);
              }
            } catch {}
          });
        }
        killInvalidPixiGsapTweens(gsap);
      } catch {}
      // Destroy HUD_ROOT and all its children (Graphics, Sprites, etc.)
      try { HUD_ROOT.destroy({ children: true, texture: false, textureSource: false }); } catch {}
      console.log('✅ Old HUD_ROOT destroyed');
    }
    // 🔥 CRITICAL: Always clear HUD_ROOT reference
    HUD_ROOT = null;
  } catch (error) {
    console.warn('⚠️ Failed to destroy old HUD_ROOT:', error);
    HUD_ROOT = null; // Clear reference anyway
  }
  // 🔥 CRITICAL: Clear smoke interval if it exists (MEMORY LEAK FIX)
  if (wild?.view?._smokeInterval) {
    console.log('🧹 Clearing wild meter smoke interval');
    clearInterval(wild.view._smokeInterval);
    wild.view._smokeInterval = null;
  }
  
  // 🔥 CRITICAL: Kill any active animations (MEMORY LEAK FIX)
  if (wild?.view?._currentAnimation) {
    console.log('🧹 Killing wild meter animation');
    wild.view._currentAnimation.kill();
    wild.view._currentAnimation = null;
  }
  
  // Clear references
  closeIconSprite = null;
  boardText = null;
  scoreText = null;
  comboText = null;
  comboWrap = null;
  wild = null;
  wildMeterSpatialWrapper = null;
  
  HUD_ROOT = new Container();
  HUD_ROOT.label = 'HUD_ROOT';
  HUD_ROOT.zIndex = 10_000;
  HUD_ROOT.sortableChildren = true;
  HUD_ROOT.visible = true; // 🔥 CRITICAL: Ensure HUD is visible
  
  // 🔥 CRITICAL: Apply initialHide IMMEDIATELY to prevent 1-frame "HUD residue" flash on entry
  // (iPhone often paints once before the later initialHide block runs)
  HUD_ROOT._dropTop = top;
  if (initialHide) {
    HUD_ROOT.alpha = 0;
    HUD_ROOT.y = top - 140;
    HUD_ROOT._dropped = false;
  } else {
    HUD_ROOT.alpha = 1;
    HUD_ROOT.y = top;
    HUD_ROOT._dropped = true;
  }
  
  // 🔥 CRITICAL FIX: Do NOT add HUD_ROOT to stage if initialHide is true!
  // This prevents ANY possibility of flash - HUD will be added in playHudDrop()
  if (initialHide) {
    // Store stage reference for later - will add to stage in playHudDrop()
    HUD_ROOT._stage = stage;
    HUD_ROOT._stageWasVisible = stageWasVisible;
    // Restore stage visibility NOW since HUD is not on stage yet
    stage.visible = stageWasVisible;
    console.log('🎯 HUD_ROOT created but NOT added to stage - will add in playHudDrop()');
  } else {
    // Normal path: add to stage immediately
  stage.addChild(HUD_ROOT);
  console.log('✅ HUD_ROOT created and added to stage');
  }
  
  try { syncBoardIndicatorForHudInit(initialHide); } catch {}

  // vrijednosti - Use system font stack for better App Store compatibility
  const valMain  = { fontFamily: 'Baloo2, system-ui, -apple-system, sans-serif', fontSize: 24, fill: 0xAD8775, fontWeight: '700', fontStyle: 'normal' };
  const valCombo = { fontFamily: 'Baloo2, system-ui, -apple-system, sans-serif', fontSize: 24, fill: 0xE77449, fontWeight: '700', fontStyle: 'normal' }; // Same color as preloader

  // Create close icon sprite instead of board text
  try {
    let closeIconTexture = null;
    try {
      closeIconTexture = getUsableHudTexture('./assets/close-icon.png');
    } catch (e) {
      // Asset might not be loaded yet, will load asynchronously
    }
    
    if (closeIconTexture) {
      // Create container for icon + circle
      const closeButtonContainer = new Container();
      closeButtonContainer.eventMode = 'static';
      closeButtonContainer.cursor = 'pointer';
      
      // Create dashed circle (44px diameter with 2px stroke, 6px dash + 6px gap, 10px from icon)
      const circle = new Graphics();
      const radius = 22;
      const dashLength = 6;
      const gapLength = 6;
      const circumference = 2 * Math.PI * radius;
      const totalSegment = dashLength + gapLength;
      const dashCount = Math.floor(circumference / totalSegment);
      
      for (let i = 0; i < dashCount; i++) {
        // Calculate angles for this dash
        const startAngle = (i * totalSegment / circumference) * 2 * Math.PI;
        const endAngle = startAngle + (dashLength / circumference) * 2 * Math.PI;
        
        // Calculate start and end points
        const startX = Math.cos(startAngle) * radius;
        const startY = Math.sin(startAngle) * radius;
        const endX = Math.cos(endAngle) * radius;
        const endY = Math.sin(endAngle) * radius;
        
        // Draw arc segment
        circle.moveTo(startX, startY);
        circle.arc(0, 0, radius, startAngle, endAngle);
      }
      circle.stroke({ width: 2, color: 0xE8D4C7 }); // 2px stroke, light beige color
      // 🔥 CRITICAL: Prevent Graphics from blocking pointer events
      circle.eventMode = 'none';
      closeButtonContainer.addChild(circle);
      
      // Create icon sprite (24px) centered in the circle
      const iconSprite = new Sprite(closeIconTexture);
      iconSprite.anchor.set(0.5, 0.5);
      const iconSize = 24;
      if (iconSprite.width > 0 && iconSprite.height > 0) {
        const scale = iconSize / Math.max(iconSprite.width, iconSprite.height);
        iconSprite.scale.set(scale);
      }
      iconSprite.alpha = 0.8;
      // 🔥 CRITICAL: Prevent Sprite from blocking pointer events
      iconSprite.eventMode = 'none';
      closeButtonContainer.addChild(iconSprite);
      
      // 🔥 CRITICAL: Set hitArea on container so clicks work even on Graphics/Sprite
      closeButtonContainer.hitArea = new Rectangle(-radius, -radius, radius * 2, radius * 2);
      
      // Store reference to container (not just sprite)
      closeIconSprite = closeButtonContainer;
      HUD_ROOT._visibleCloseButton = closeButtonContainer;
      
      // 🔥 FIX: Change to open End Run modal instead of going to homepage
      const handleCloseClick = (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (shouldBlockHudCloseForTerminalResolution('circle-close')) return;
        
        console.log('🎯 CLOSE BUTTON (circle) CLICKED - Opening End Run bottom sheet');
        
        // 🔥 USER REQUEST: Check if end-run modal is already open (toggle behavior)
        let isEndRunModalOpen = false;
        try {
          if (typeof window.isEndRunModalVisible === 'function') {
            isEndRunModalOpen = window.isEndRunModalVisible();
          }
          // Also check DOM as fallback
          if (!isEndRunModalOpen) {
            const modalExists = document.querySelector('.simple-bottom-sheet');
            if (modalExists && modalExists.parentNode && !modalExists.classList.contains('score-bottom-sheet')) {
              isEndRunModalOpen = true;
            }
          }
        } catch (err) {
          console.warn('⚠️ Error checking modal visibility:', err);
        }
        
        // 🔥 USER REQUEST: If end-run modal already open, close it (toggle behavior)
        if (isEndRunModalOpen) {
          console.log('🎯 End Run modal already open - closing it');
          
          // Haptic feedback for closing
          if (typeof window.triggerHapticImpact === 'function') {
            window.triggerHapticImpact('light');
          }
          
          playHudCloseSoftCartoonBounce(closeButtonContainer);
          
          if (typeof window.hideEndRunModal === 'function') {
            window.hideEndRunModal();
          }
          return;
        }
        
        // 🔥 USER REQUEST: If score bottom sheet is open, close it first, then open end-run modal
        let isScoreSheetOpen = false;
        try {
          if (typeof window.isScoreBottomSheetVisible === 'function') {
            isScoreSheetOpen = window.isScoreBottomSheetVisible();
          }
        } catch (err) {
          console.warn('⚠️ Error checking score bottom sheet visibility:', err);
        }
        
        if (isScoreSheetOpen) {
          console.log('🎯 Score bottom sheet is open - closing it and opening end-run modal');
          if (typeof window.hideScoreBottomSheet === 'function') {
            window.hideScoreBottomSheet();
          }
          // Wait a bit for score bottom sheet to close, then open end-run modal
          // 🔥 FIX: Track timeout for cleanup
          trackHudTimeout(() => {
            if (typeof window.showEndRunModalFromGame === 'function') {
              window.showEndRunModalFromGame();
            }
          }, 450); // Wait for score bottom sheet animation (400ms) + small buffer
          return;
        }
        
        // Haptic feedback
        if (typeof window.triggerHapticImpact === 'function') {
          window.triggerHapticImpact('light');
        }
        
        // Open bottom sheet
        if (typeof window.showEndRunModalFromGame === 'function') {
          window.showEndRunModalFromGame();
        } else {
          console.error('❌ showEndRunModalFromGame function not available!');
        }
      };
      
      // Add interactive behavior
      closeButtonContainer.on('pointerdown', (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (!acquireHudBottomSheetTapLock('close-circle')) return;
        playHudCloseSoftCartoonBounce(closeButtonContainer);
        trackHudTimeout(() => {
          if (!closeButtonContainer.destroyed) {
            handleCloseClick(e);
          }
        }, HUD_TAP_BOUNCE_OPEN_DELAY_MS);
      });
      
      HUD_ROOT.addChild(closeButtonContainer);
      console.log('✅ Close icon with circle created and added');
    } else {
      console.warn('⚠️ Close icon texture not found, trying to load...');
      // Try loading it asynchronously
      loadUsableHudTexture('./assets/close-icon.png').then((tex) => {
        if (isUsableHudTexture(tex) && HUD_ROOT) {
          // Create container for icon + circle
          const closeButtonContainer = new Container();
          closeButtonContainer.eventMode = 'static';
          closeButtonContainer.cursor = 'pointer';
          
          // Create dashed circle (44px diameter with 2px stroke, 6px dash + 6px gap, 10px from icon)
          const circle = new Graphics();
          const radius = 22;
          const dashLength = 6;
          const gapLength = 6;
          const circumference = 2 * Math.PI * radius;
          const totalSegment = dashLength + gapLength;
          const dashCount = Math.floor(circumference / totalSegment);
          
          for (let i = 0; i < dashCount; i++) {
            // Calculate angles for this dash
            const startAngle = (i * totalSegment / circumference) * 2 * Math.PI;
            const endAngle = startAngle + (dashLength / circumference) * 2 * Math.PI;
            
            // Calculate start and end points
            const startX = Math.cos(startAngle) * radius;
            const startY = Math.sin(startAngle) * radius;
            const endX = Math.cos(endAngle) * radius;
            const endY = Math.sin(endAngle) * radius;
            
            // Draw arc segment
            circle.moveTo(startX, startY);
            circle.arc(0, 0, radius, startAngle, endAngle);
          }
          circle.stroke({ width: 2, color: 0xE8D4C7 }); // 2px stroke, light beige color
          // 🔥 CRITICAL: Prevent Graphics from blocking pointer events
          circle.eventMode = 'none';
          closeButtonContainer.addChild(circle);
          
          // Create icon sprite (24px) centered in the circle
          const iconSprite = new Sprite(tex);
          iconSprite.anchor.set(0.5, 0.5);
          const iconSize = 24;
          if (iconSprite.width > 0 && iconSprite.height > 0) {
            const scale = iconSize / Math.max(iconSprite.width, iconSprite.height);
            iconSprite.scale.set(scale);
          }
          iconSprite.alpha = 0.8;
          // 🔥 CRITICAL: Prevent Sprite from blocking pointer events
          iconSprite.eventMode = 'none';
          closeButtonContainer.addChild(iconSprite);
  
          // 🔥 CRITICAL: Set hitArea on container so clicks work even on Graphics/Sprite
          closeButtonContainer.hitArea = new Rectangle(-radius, -radius, radius * 2, radius * 2);
  
          // Store reference
          closeIconSprite = closeButtonContainer;
          HUD_ROOT._visibleCloseButton = closeButtonContainer;
          
          // 🔥 FIX: Change to open End Run modal instead of going to homepage
          const handleCloseClick = (e) => {
            e.stopPropagation();
            e.stopImmediatePropagation();
            if (shouldBlockHudCloseForTerminalResolution('circle-close-rebuilt')) return;
            
            console.log('🎯 CLOSE BUTTON (circle) CLICKED - Opening End Run bottom sheet');
            
            // 🔥 USER REQUEST: Check if end-run modal is already open (toggle behavior)
            let isEndRunModalOpen = false;
            try {
              if (typeof window.isEndRunModalVisible === 'function') {
                isEndRunModalOpen = window.isEndRunModalVisible();
              }
              // Also check DOM as fallback
              if (!isEndRunModalOpen) {
                const modalExists = document.querySelector('.simple-bottom-sheet');
                if (modalExists && modalExists.parentNode && !modalExists.classList.contains('score-bottom-sheet')) {
                  isEndRunModalOpen = true;
                }
              }
            } catch (err) {
              console.warn('⚠️ Error checking modal visibility:', err);
            }
            
            // 🔥 USER REQUEST: If end-run modal already open, close it (toggle behavior)
            if (isEndRunModalOpen) {
              console.log('🎯 End Run modal already open - closing it');
              
              // Haptic feedback for closing
              if (typeof window.triggerHapticImpact === 'function') {
                window.triggerHapticImpact('light');
              }
              
              playHudCloseSoftCartoonBounce(closeButtonContainer);
              
              if (typeof window.hideEndRunModal === 'function') {
                window.hideEndRunModal();
              }
              return;
            }
            
            // 🔥 USER REQUEST: If score bottom sheet is open, close it first, then open end-run modal
            let isScoreSheetOpen = false;
            try {
              if (typeof window.isScoreBottomSheetVisible === 'function') {
                isScoreSheetOpen = window.isScoreBottomSheetVisible();
              }
            } catch (err) {
              console.warn('⚠️ Error checking score bottom sheet visibility:', err);
            }
            
            if (isScoreSheetOpen) {
              console.log('🎯 Score bottom sheet is open - closing it and opening end-run modal');
              if (typeof window.hideScoreBottomSheet === 'function') {
                window.hideScoreBottomSheet();
              }
              // Wait a bit for score bottom sheet to close, then open end-run modal
              // 🔥 FIX: Track timeout for cleanup
              trackHudTimeout(() => {
                if (typeof window.showEndRunModalFromGame === 'function') {
                  window.showEndRunModalFromGame();
                }
              }, 450); // Wait for score bottom sheet animation (400ms) + small buffer
              return;
            }
            
            // Haptic feedback
            if (typeof window.triggerHapticImpact === 'function') {
              window.triggerHapticImpact('light');
            }
            
            // Open bottom sheet
            if (typeof window.showEndRunModalFromGame === 'function') {
              window.showEndRunModalFromGame();
            } else {
              console.error('❌ showEndRunModalFromGame function not available!');
            }
          };
          
          // Add interactive behavior
          closeButtonContainer.on('pointerdown', (e) => {
            e.stopPropagation();
            e.stopImmediatePropagation();
            if (!acquireHudBottomSheetTapLock('close-circle:async')) return;
            playHudCloseSoftCartoonBounce(closeButtonContainer);
            trackHudTimeout(() => {
              if (!closeButtonContainer.destroyed) {
                handleCloseClick(e);
              }
            }, HUD_TAP_BOUNCE_OPEN_DELAY_MS);
          });
          
          HUD_ROOT.addChild(closeButtonContainer);
          layout({ app, top });
          console.log('✅ Close icon with circle loaded and added');
        }
      }).catch((err) => {
        console.error('❌ Failed to load close icon:', err);
      });
    }
  } catch (error) {
    console.error('❌ Error creating close icon sprite:', error);
  }

  // Create dummy boardText for compatibility (hidden)
  boardText = new Text({ text: '#1', style: { fontSize: 24, fill: 0xAD8775 } });
  boardText.visible = false;
  boardText.renderable = false;

  // 🔥 NEW HUD DESIGN: Create HUD elements with icons (star-hud, score-hud, combo-hud)
  // Layout based on SwiftUI design:
  // - Left (offset -112): score-hud.png + score number (from assets/hud/)
  // - Right (offset 108): star-hud.png + currency number (or energy "X0") (from assets/hud/)
  // - Left (offset -4.50): combo-hud.png + combo number (from assets/hud/)
  
  // Create containers for each HUD element
  const createHudElement = (iconPath, textValue, textStyle) => {
    const container = new Container();
    container.eventMode = 'none';
    const applyHudIconScale = (sprite) => {
      if (!sprite) return;
      if (iconPath.includes('star-hud.png') || iconPath.includes('hud/star-hud.png')) {
        const targetHeight = 28;
        if (sprite.width > 0 && sprite.height > 0) {
          const scale = targetHeight / sprite.height;
          sprite.scale.set(scale);
          console.log('⭐ star-hud.png scaled to height 28px, width:', sprite.width * scale, 'px (aspect ratio preserved)');
        }
      } else {
        const targetSize = 28;
        if (sprite.width > 0 && sprite.height > 0) {
          const scale = targetSize / Math.max(sprite.width, sprite.height);
          sprite.scale.set(scale);
        }
      }
    };
    
    // Load icon sprite (transparent background - no bg rectangle)
    let iconSprite = null;
    try {
      const iconTexture = getUsableHudTexture(iconPath);
      if (iconTexture) {
        iconSprite = new Sprite(iconTexture);
        iconSprite.anchor.set(0.5, 0.5);
        applyHudIconScale(iconSprite);
        container.addChild(iconSprite);
      }
    } catch (e) {
      console.warn(`⚠️ Failed to load icon ${iconPath}, will try async:`, e);
    }

    if (!iconSprite) {
      loadUsableHudTexture(iconPath).then((tex) => {
        if (isUsableHudTexture(tex) && container && !container.destroyed) {
          iconSprite = new Sprite(tex);
          iconSprite.anchor.set(0.5, 0.5);
          applyHudIconScale(iconSprite);
          container.addChildAt(iconSprite, 0);
        }
      }).catch((err) => {
        console.error(`❌ Failed to load icon ${iconPath}:`, err);
      });
    }
    
    // 🔥 NO BACKGROUND: PNG icons have transparent background, no bg rectangle needed
    
    // Create text
    const text = new Text({ text: textValue, style: textStyle });
    text.anchor.set(0, 0.5); // Left-align text (anchor at left center for proper positioning)
    // Position text to the right of icon (spacing: 6px for better visibility, same as other HUD icons)
    // 🔥 FIX: Ensure score-hud has same spacing as other HUD icons (star-hud, combo-hud)
    const spacing = 6; // Standard spacing for all HUD icons (increased from 4px for better visibility)
    if (iconSprite) {
      text.x = (iconSprite.width * iconSprite.scale.x) / 2 + spacing;
    } else {
      text.x = 14 + spacing; // Half of 28px + spacing
    }
    text.y = 0;
    container.addChild(text);
    
    return { container, text, iconSprite };
  };
  
  // Create HUD elements
  // 🔥 HUD font stack: Baloo2 first (loaded via ensureFonts before initHUD), Arial fallback to prevent black boxes
  const HUD_FONT = 'Baloo2, Arial, system-ui, -apple-system, sans-serif';
  
  // 🔥 NEW ORDER: Close → Star → Coin → Combo
  // 1. Star (currency) - second (after close)
  const starHud = createHudElement('./assets/hud/star-hud.png', '0', {
    fontFamily: HUD_FONT,
    fontSize: 18,
    fill: 0xB58573, // Color(red: 0.71, green: 0.52, blue: 0.45)
    fontWeight: 'bold',
    fontStyle: 'normal'
  });
  // Shop/star currency HUD is currently hidden. Keep the element wired so it can be restored later.
  starHud.container.visible = false;
  starHud.container.renderable = false;
  starHud.container.eventMode = 'none';
  
  // 2. Coin (score) - third - using score-hud.png instead of coin-hud.png
  const coinHud = createHudElement('./assets/hud/score-hud.png', '0', {
    fontFamily: HUD_FONT,
    fontSize: 18, // Changed from 20 to 18
    fill: 0xB58573, // Color(red: 0.71, green: 0.52, blue: 0.45)
    fontWeight: 'bold',
    fontStyle: 'normal'
  });
  
  // 3. Combo - fourth (last)
  // Create combo with separate "x" (14px) and number (18px) text objects
  const comboContainer = new Container();
  comboContainer.eventMode = 'none';
  
  // Load combo icon sprite
  let comboIconSprite = null;
  try {
    const comboIconTexture = getUsableHudTexture('./assets/hud/combo-hud.png');
    if (comboIconTexture) {
      comboIconSprite = new Sprite(comboIconTexture);
      comboIconSprite.anchor.set(0.5, 0.5);
      const targetSize = 28;
      if (comboIconSprite.width > 0 && comboIconSprite.height > 0) {
        const scale = targetSize / Math.max(comboIconSprite.width, comboIconSprite.height);
        comboIconSprite.scale.set(scale);
      }
      comboContainer.addChild(comboIconSprite);
    }
  } catch (e) {
    console.warn('⚠️ Failed to load combo icon, will try async:', e);
  }
  if (!comboIconSprite) {
    loadUsableHudTexture('./assets/hud/combo-hud.png').then((tex) => {
      if (isUsableHudTexture(tex) && comboContainer && !comboContainer.destroyed) {
        comboIconSprite = new Sprite(tex);
        comboIconSprite.anchor.set(0.5, 0.5);
        const targetSize = 28;
        if (comboIconSprite.width > 0 && comboIconSprite.height > 0) {
          const scale = targetSize / Math.max(comboIconSprite.width, comboIconSprite.height);
          comboIconSprite.scale.set(scale);
        }
        comboContainer.addChildAt(comboIconSprite, 0);
      }
    }).catch((err) => {
      console.error('❌ Failed to load combo icon:', err);
    });
  }
  
  // Create "x" text (14px) - use local variable name to avoid conflict
  const comboXTextLocal = new Text({ 
    text: 'x', 
    style: {
      fontFamily: HUD_FONT,
      fontSize: 14,
      fill: 0xE77449, // Color #E77449
      fontWeight: 'bold',
      fontStyle: 'normal'
    }
  });
  comboXTextLocal.anchor.set(0, 0.5);
  if (comboIconSprite) {
    comboXTextLocal.x = (comboIconSprite.width * comboIconSprite.scale.x) / 2 + 4;
  } else {
    comboXTextLocal.x = 14 + 4;
  }
  comboXTextLocal.y = 0;
  comboContainer.addChild(comboXTextLocal);
  
  // Create number text (18px)
  const comboNumberText = new Text({ 
    text: '0', 
    style: {
      fontFamily: HUD_FONT,
      fontSize: 18, // All numbers are 18px
      fill: 0xE77449, // Color #E77449
      fontWeight: 'bold',
      fontStyle: 'normal'
    }
  });
  comboNumberText.anchor.set(0, 0.5);
  // Position number text right after "x" text
  comboNumberText.x = comboXTextLocal.x + comboXTextLocal.width;
  comboNumberText.y = 0;
  comboContainer.addChild(comboNumberText);
  
  const comboHud = {
    container: comboContainer,
    text: comboNumberText, // Store number text as main text reference (18px)
    xText: comboXTextLocal, // Store "x" text separately (14px)
    iconSprite: comboIconSprite,
    originalIconPath: './assets/hud/combo-hud.png', // Store original icon path (0-4)
    extraIconPath: './assets/hud/extra-combo-hud.png', // Store extra icon path (5-9)
    megaIconPath: './assets/hud/mega-combo-hud.png', // Store mega icon path (10+)
    currentIconType: 'normal' // Track current icon: 'normal', 'extra', or 'mega'
  };
  
  // Store references
  scoreText = coinHud.text; // Use coin text for score
  comboText = comboHud.text; // Use combo number text (18px)
  comboXText = comboHud.xText; // Store "x" text reference (14px) - use global variable
  starText = starHud.text; // Currency/energy text
  
  // Export combo text for animations
  window.comboText = comboText;

  // Create wrapper for combo (for jitter animation)
  comboWrap = new Container();
  comboWrap.addChild(comboHud.container);
  
  // Add all HUD elements to root in order: Close → Star → Coin → Combo
  HUD_ROOT.addChild(
    boardText,
    starHud.container,   // Star (currency) - second
    coinHud.container,   // Coin (score) - third
    comboWrap            // Combo - fourth
  );
  
  // Store references for layout
  HUD_ROOT._hudElements = {
    star: starHud,
    coin: coinHud,
    combo: comboHud
  };
  
  // Add close icon sprite if it was created synchronously
  if (closeIconSprite && closeIconSprite.parent !== HUD_ROOT) {
    HUD_ROOT.addChild(closeIconSprite);
    console.log('✅ Close icon sprite added to HUD_ROOT');
  }
  
  // ensure combo is drawn above wild bar if overlapping
  try {
    boardText.zIndex = 10;
    if (closeIconSprite) closeIconSprite.zIndex = 10;
    if (HUD_ROOT._hudElements) {
      const { star, coin, combo } = HUD_ROOT._hudElements;
      if (coin && coin.container) coin.container.zIndex = 10;
      if (star && star.container) star.container.zIndex = 10;
      if (combo && combo.container) combo.container.zIndex = 2000;
    }
    if (scoreText) scoreText.zIndex = 10;
    if (comboWrap) comboWrap.zIndex = 2000;
    if (comboText) comboText.zIndex = 2000;
    HUD_ROOT.sortChildren?.();
  } catch {}
  
  // 🔥 NEW HUD: Export function to update currency/energy (for future use)
  if (starText) {
    window.setCurrency = (value) => {
      if (starText) {
        starText.text = String(value|0);
      }
    };
  }
  
  // 🔥 Export HUD functions to window for stars-collector module
  if (typeof window !== 'undefined') {
    window.HUD = window.HUD || {};
    window.HUD.bounceStarIcon = bounceStarIcon;
    window.HUD.bounceScoreIcon = bounceScoreIcon;
    window.HUD.bounceScoreArea = () => playHudScoreSoftCartoonBounce(coinHud);
    window.HUD.bounceComboArea = () => playHudScoreSoftCartoonBounce(comboHud);
    window.HUD.bumpScoreNumberFromHudStar = bumpScoreNumberFromHudStar;
    window.HUD.getStarHudPosition = getStarHudPosition;
    window.HUD.getScoreHudPosition = getScoreHudPosition;
    window.HUD.setStarsCount = setStarsCount;
    window.HUD.cleanupComboAnimations = cleanupComboAnimations; // 🔥 Export cleanup function
    window.HUD.updateBoardIndicatorValueWithBounce = updateBoardIndicatorValueWithBounce;
    // 🔥 CRITICAL FIX: Export HUD_ROOT to window for access from app-core.ts
    // This allows app-core.ts to access HUD_ROOT even though it's a local variable in this module
    window.HUD_ROOT = HUD_ROOT;
    console.log('✅ HUD functions exported to window.HUD');
    console.log('✅ HUD_ROOT exported to window.HUD_ROOT');
  }
  
  // Create PIXI wild meter
  console.log('🎯 Creating PIXI wild meter...');
  wild = makeWildLoader();
  if (wild && wild.view) {
    wildMeterSpatialWrapper = new Container();
    wildMeterSpatialWrapper.label = 'wildMeterSpatialWrapper';
    wildMeterSpatialWrapper.zIndex = wild.view.zIndex;
    wild.view.zIndex = 0;
    wildMeterSpatialWrapper.addChild(wild.view);
    HUD_ROOT.addChild(wildMeterSpatialWrapper);
    wild.setProgress(0, false); // Start at 0%
    console.log('✅ PIXI wild meter created and added to HUD');
  } else {
    console.warn('⚠️ Failed to create PIXI wild meter');
  }

  // inicijalni layout + resize listener
  layout({ app, top });
  const onResize = () => layout({ app, top });
  HUD_ROOT._onResize = onResize;
  hudLifecycle.trackListener(window, 'resize', onResize);

  // Defer drop animation control to caller
  // (initialHide state already applied above to avoid first-frame flash)
  
  // 🔥 CRITICAL FIX: Always export HUD_ROOT to window after initialization
  // This ensures app-core.ts can access it even if initHUD is called multiple times
  if (typeof window !== 'undefined') {
    window.HUD_ROOT = HUD_ROOT;
    console.log('✅ HUD_ROOT exported to window.HUD_ROOT after initialization');
  }

  // 🔥 USER REQUEST: Remove HUD-wide click event - only X button and score area should be clickable
  // HUD_ROOT no longer has global click handler
  HUD_ROOT.interactive = false;
  HUD_ROOT.cursor = 'default';
  
  // 🔥 USER REQUEST: Add X button (top left) for end run modal with rounded dotted area
  // 🔥 SIMPLE APPROACH: No pivot, direct positioning - elements at (22, 22) within container
  const xButton = new Container();
  xButton.interactive = true;
  xButton.cursor = 'pointer';
  xButton.eventMode = 'static';
  // 🔥 CRITICAL: Set zIndex to ensure it's above other HUD elements
  xButton.zIndex = 1000;
  
  // Create touch area - USER REQUEST: 56px width
  // Original: 44x44px, New: 56x60px (56px width, 44+16 height)
  const touchAreaWidth = 56; // 56px width (user requested)
  const touchAreaHeight = 44 + 16; // 60px height (8px top + 8px bottom)
  const centerX = touchAreaWidth / 2; // 28px - center X within container (56/2)
  const centerY = touchAreaHeight / 2; // 30px - center Y within container

  const xVisual = new Container();
  xVisual.eventMode = 'none';
  xVisual.pivot.set(centerX, centerY);
  xVisual.position.set(centerX, centerY);
  xButton._bounceVisual = xVisual;
  xButton.addChild(xVisual);
  
  // 🔥 USER REQUEST: Red rectangle from left edge, 24px over X button on right
  // X button is 56px wide, positioned at 24px from left edge
  // So red rectangle should be: 0px (left edge) to 24+56+16=96px (16px over X button on right)
  const debugRectWidth = 24 + touchAreaWidth + 16 + 4 + 4; // 104px total (24px left + 56px button + 16px right + 4px + 4px more right)
  const debugRectHeight = touchAreaHeight + 8; // 68px height (60px + 8px user requested)
  const debugRectX = -24; // Start 24px to the left (so it starts at screen edge when button is at 24px)
  
  // Create X icon FIRST (so it's BELOW red rectangle)
  // 🔥 CRITICAL: X icon must be BELOW red rectangle so it's visible
  const xGraphics = new Graphics();
  xGraphics.clear();
  xGraphics.setStrokeStyle({ width: 3, color: 0xB58573, alpha: 1 });
  const xSize = 20;
  xGraphics.moveTo(centerX - xSize/2, centerY - xSize/2);
  xGraphics.lineTo(centerX + xSize/2, centerY + xSize/2);
  xGraphics.moveTo(centerX + xSize/2, centerY - xSize/2);
  xGraphics.lineTo(centerX - xSize/2, centerY + xSize/2);
  // 🔥 CRITICAL: Prevent X icon Graphics from blocking pointer events
  xGraphics.eventMode = 'none';
  xGraphics.cursor = 'default';
  try { xGraphics.interactiveChildren = false; } catch {}
  xVisual.addChild(xGraphics); // Added FIRST = BELOW
  
  // Draw dotted border around X button area
  const borderBg = new Graphics();
  borderBg.clear();
  borderBg.setStrokeStyle({ width: 2, color: 0xB58573, alpha: 0.5 });
  // Draw dashed border around X button area (not the full long rectangle)
  const dashLength = 6;
  const gapLength = 6;
  let isDash = true;
  
  // Top edge (only around X button area, not full rectangle)
  for (let x = 0; x < touchAreaWidth; x += (dashLength + gapLength)) {
    if (isDash) {
      borderBg.moveTo(x, 0);
      borderBg.lineTo(Math.min(x + dashLength, touchAreaWidth), 0);
    }
    isDash = !isDash;
  }
  // Right edge
  for (let y = 0; y < touchAreaHeight; y += (dashLength + gapLength)) {
    if (isDash) {
      borderBg.moveTo(touchAreaWidth, y);
      borderBg.lineTo(touchAreaWidth, Math.min(y + dashLength, touchAreaHeight));
    }
    isDash = !isDash;
  }
  // Bottom edge
  for (let x = touchAreaWidth; x > 0; x -= (dashLength + gapLength)) {
    if (isDash) {
      borderBg.moveTo(x, touchAreaHeight);
      borderBg.lineTo(Math.max(x - dashLength, 0), touchAreaHeight);
    }
    isDash = !isDash;
  }
  // Left edge
  for (let y = touchAreaHeight; y > 0; y -= (dashLength + gapLength)) {
    if (isDash) {
      borderBg.moveTo(0, y);
      borderBg.lineTo(0, Math.max(y - dashLength, 0));
    }
    isDash = !isDash;
  }
  // 🔥 CRITICAL: Prevent Graphics from blocking pointer events
  borderBg.eventMode = 'none';
  borderBg.cursor = 'default';
  xVisual.addChild(borderBg); // Added SECOND = MIDDLE
  
  // 🔥 SIMPLE: Red RECTANGLE = HIT AREA = Opens bottom sheet when clicked
  // LONG RECTANGLE: From left edge (0px) to 24px over X button on right (124px total)
  const debugBg = new Graphics();
  debugBg.clear();
  debugBg.roundRect(debugRectX, 0, debugRectWidth, debugRectHeight, 8); // Long rectangle, 8px radius
  debugBg.fill({ color: 0xFF0000, alpha: 0 }); // Transparent - touch area still works
  // 🔥 CRITICAL: Red rectangle is INTERACTIVE - it receives all clicks
  debugBg.eventMode = 'static';
  debugBg.cursor = 'pointer';
  debugBg.interactive = true;
  // 🔥 CRITICAL: Set zIndex to ensure it's above other elements
  debugBg.zIndex = 1000;
  xButton.addChild(debugBg); // Added LAST = ABOVE
  
  // 🔥 CRITICAL: hitArea matches the red rectangle - from (-24, 0) to (124, 60)
  // This covers from left edge (0px screen) to 24px over X button on right
  xButton.hitArea = new Rectangle(debugRectX, 0, debugRectWidth, debugRectHeight);
  
  // 🔥 VERIFY: Red rectangle from left edge, 24px over X button on right
  console.log('🎯 X Button elements created (long rectangle):', {
    center: { x: centerX, y: centerY },
    debugBg: { type: 'long rectangle', position: `(${debugRectX}, 0)`, size: `${debugRectWidth}x${debugRectHeight}`, note: 'From left edge to 24px over X button' },
    borderBg: { type: 'dashed border', size: `${touchAreaWidth}x${touchAreaHeight}` },
    xGraphics: { type: 'X lines', position: `(${centerX}, ${centerY})`, size: xSize },
    hitArea: { x: debugRectX, y: 0, width: debugRectWidth, height: debugRectHeight }
  });
  
  // 🔥 CRITICAL: Red rectangle is LONG - from left edge to 24px over X button
  // debugBg: roundedRect(-24, 0, 124, 60) - long rectangle from left edge ✓
  // borderBg: dashed border around X button area (0, 0) to (76, 60) ✓
  // xGraphics: lines at (38, 30) - centered in X button area ✓
  // hitArea: Rectangle(-24, 0, 124, 60) - matches red rectangle ✓
  
  console.log('🎯 X Button created (long rectangle):', {
    touchArea: { width: touchAreaWidth, height: touchAreaHeight },
    debugRect: { x: debugRectX, width: debugRectWidth, height: debugRectHeight },
    center: { x: centerX, y: centerY },
    hitArea: { x: debugRectX, y: 0, width: debugRectWidth, height: debugRectHeight },
    interactive: xButton.interactive,
    eventMode: xButton.eventMode,
    note: 'Long rectangle from left edge (0px screen) to 24px over X button on right'
  });
  
  // Position X button (top left, will be positioned in layout())
  xButton.x = 0; // Will be set in layout()
  xButton.y = 0; // Will be set in layout()
  xButton._isXButton = true; // Mark for layout positioning
  HUD_ROOT.addChild(xButton);
  
  // 🔥 SIMPLE: Red rectangle (debugBg) = HIT AREA = Opens bottom sheet when clicked
  // No animations, no complications - just click red rectangle → open modal
  debugBg.on('pointerdown', (e) => {
    e.stopPropagation();
    e.stopImmediatePropagation();
    if (shouldBlockHudCloseForTerminalResolution('x-hit-area')) return;
    if (!acquireHudBottomSheetTapLock('x-hit-area')) return;

    console.log('🎯 RED RECTANGLE CLICKED - Opening End Run bottom sheet');
    playHudCloseSoftCartoonBounce(HUD_ROOT?._visibleCloseButton || xButton);
    trackHudTimeout(() => {
      if (!xButton.destroyed) {
        openEndRunFromHudClose();
      }
    }, HUD_TAP_BOUNCE_OPEN_DELAY_MS);
  });

  const openEndRunFromHudClose = () => {
    if (shouldBlockHudCloseForTerminalResolution('x-delayed-open')) return;

    // 🔥 USER REQUEST: Check if end-run modal is already open (toggle behavior)
          let isEndRunModalOpen = false;
          try {
            if (typeof window.isEndRunModalVisible === 'function') {
              isEndRunModalOpen = window.isEndRunModalVisible();
            }
          } catch (err) {
            console.warn('⚠️ Error checking modal visibility:', err);
          }
          
    // 🔥 USER REQUEST: If end-run modal already open, close it (toggle behavior)
          if (isEndRunModalOpen) {
      console.log('🎯 End Run modal already open - closing it');
      
      // Haptic feedback for closing
      if (typeof window.triggerHapticImpact === 'function') {
        window.triggerHapticImpact('light');
      }
      
      if (typeof window.hideEndRunModal === 'function') {
        window.hideEndRunModal();
      }
      return;
    }
    
    // 🔥 USER REQUEST: If score bottom sheet is open, close it first, then open end-run modal
    let isScoreSheetOpen = false;
    try {
      if (typeof window.isScoreBottomSheetVisible === 'function') {
        isScoreSheetOpen = window.isScoreBottomSheetVisible();
      }
    } catch (err) {
      console.warn('⚠️ Error checking score bottom sheet visibility:', err);
    }
    
    if (isScoreSheetOpen) {
      console.log('🎯 Score bottom sheet is open - closing it and opening end-run modal');
      if (typeof window.hideScoreBottomSheet === 'function') {
        window.hideScoreBottomSheet();
      }
      // Wait a bit for score bottom sheet to close, then open end-run modal
      // 🔥 FIX: Track timeout for cleanup
      trackHudTimeout(() => {
        if (typeof window.showEndRunModalFromGame === 'function') {
          window.showEndRunModalFromGame();
        }
      }, 450); // Wait for score bottom sheet animation (400ms) + small buffer
      return;
    }
    
      // Haptic feedback
      if (typeof window.triggerHapticImpact === 'function') {
        window.triggerHapticImpact('light');
          }
    // Open bottom sheet - function will handle duplicate checks
          if (typeof window.showEndRunModalFromGame === 'function') {
            window.showEndRunModalFromGame();
          } else {
      console.error('❌ showEndRunModalFromGame function not available!');
    }
  };

  const helpButton = new Container();
  helpButton.interactive = true;
  helpButton.cursor = 'pointer';
  helpButton.eventMode = 'static';
  helpButton.zIndex = 1000;

  const helpButtonSize = 44;
  const helpVisual = new Container();
  helpVisual.eventMode = 'none';
  helpVisual.pivot.set(helpButtonSize / 2, helpButtonSize / 2);
  helpVisual.position.set(helpButtonSize / 2, helpButtonSize / 2);
  helpButton._bounceVisual = helpVisual;
  helpButton.addChild(helpVisual);

  const helpHitBg = new Graphics();
  helpHitBg.clear();
  helpHitBg.roundRect(0, 0, helpButtonSize, helpButtonSize, 10);
  helpHitBg.fill({ color: 0xFF0000, alpha: 0 });
  helpHitBg.eventMode = 'static';
  helpHitBg.cursor = 'pointer';
  helpHitBg.interactive = true;
  helpHitBg.zIndex = 1000;
  helpButton.addChild(helpHitBg);
  helpButton.hitArea = new Rectangle(0, 0, helpButtonSize, helpButtonSize);

  const applyHelpTexture = (tex: any) => {
    if (!tex || helpButton.destroyed || helpVisual.destroyed) return;
    if ((helpButton as any)._helpIconApplied === true) return;
    (helpButton as any)._helpIconApplied = true;
    helpVisual.removeChildren();
    const iconSprite = new Sprite(tex);
    iconSprite.anchor.set(0.5, 0.5);
    iconSprite.position.set(helpButtonSize / 2, helpButtonSize / 2);
    const targetSize = 32;
    if (iconSprite.width > 0 && iconSprite.height > 0) {
      const scale = targetSize / Math.max(iconSprite.width, iconSprite.height);
      iconSprite.scale.set(scale);
    }
    iconSprite.eventMode = 'none';
    iconSprite.cursor = 'default';
    helpVisual.addChild(iconSprite);
  };

  try {
    const helpTexture = getUsableHudTexture('./assets/hud/help.png');
    if (helpTexture) {
      applyHelpTexture(helpTexture);
    } else {
      loadUsableHudTexture('./assets/hud/help.png')
        .then((tex) => applyHelpTexture(tex))
        .catch((err) => console.warn('⚠️ Failed to load HUD help icon:', err));
    }
  } catch (err) {
    loadUsableHudTexture('./assets/hud/help.png')
      .then((tex) => applyHelpTexture(tex))
      .catch((loadErr) => console.warn('⚠️ Failed to load HUD help icon:', loadErr || err));
  }

  const isHudStageClearDevTriggerEnabled = (): boolean => {
    const host = String(window.location?.hostname || '');
    return isArcadeHomeRunMode() && !!(
      (import.meta as any)?.env?.DEV ||
      (window as any)?.DEV ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.startsWith('192.168.') ||
      host.endsWith('.local')
    );
  };

  const handleHelpPointerDown = async (e) => {
    e.stopPropagation();
    e.stopImmediatePropagation();
    if (isHudStageClearDevTriggerEnabled()) {
      if ((helpButton as any)._stageClearDevTriggerActive) return;
      (helpButton as any)._stageClearDevTriggerActive = true;
      try {
        playHudCloseSoftCartoonBounce(helpButton);
        const stateStage = Number((window as any)?.STATE?.boardNumber);
        const clearedStage = Number.isFinite(stateStage) && stateStage > 0 ? stateStage : 1;
        const { showArcadeStageClearModal } = await import('./arcade-stage-clear-modal.js');
        await showArcadeStageClearModal(clearedStage, clearedStage + 1);
      } catch (error) {
        console.warn('⚠️ DEV stage clear sequence trigger failed:', error);
      } finally {
        (helpButton as any)._stageClearDevTriggerActive = false;
      }
      return;
    }
    console.log('📊 HELP HUD ICON CLICKED - Opening score stats bottom sheet');
    openScoreStatsBottomSheetFromHud(helpButton, 'Help HUD icon');
  };

  helpHitBg.on('pointerdown', handleHelpPointerDown);
  helpButton.on('pointerdown', handleHelpPointerDown);

  helpButton._isHelpButton = true;
  HUD_ROOT.addChild(helpButton);
  HUD_ROOT._helpButton = helpButton;
  
  // 🔥 USER REQUEST: Add red touch area on score area (coinHud) for score bottom sheet
  // Same approach as X button - red rectangle = hit area = opens score stats bottom sheet
  if (coinHud && coinHud.container) {
    // Get coinHud container dimensions (icon + text)
    // Icon is 28px, text is ~40-50px, so total width is ~70-80px
    // Height is same as other HUD elements (~44px)
    const scoreTouchAreaWidth = 106; // User requested: 102px + 4px = 106px width
    const scoreTouchAreaHeight = 60; // Same height as X button touch area
    
    // Create container for red touch area
    const scoreTouchArea = new Container();
    scoreTouchArea.interactive = true;
    scoreTouchArea.cursor = 'pointer';
    scoreTouchArea.eventMode = 'static';
    // 🔥 CRITICAL: Set zIndex to ensure it's above other HUD elements
    scoreTouchArea.zIndex = 1000;
    
    // Create red rectangle (same style as X button)
    const scoreDebugBg = new Graphics();
    scoreDebugBg.clear();
    scoreDebugBg.roundRect(0, 0, scoreTouchAreaWidth, scoreTouchAreaHeight, 8); // Rounded rectangle
    scoreDebugBg.fill({ color: 0xFF0000, alpha: 0 }); // Transparent - touch area still works
    // 🔥 CRITICAL: Graphics must be interactive to receive events
    scoreDebugBg.eventMode = 'static';
    scoreDebugBg.cursor = 'pointer';
    scoreDebugBg.interactive = true;
    // 🔥 CRITICAL: Set zIndex to ensure it's above other elements
    scoreDebugBg.zIndex = 1000;
    scoreTouchArea.addChild(scoreDebugBg);
    
    // Set hitArea to match red rectangle
    scoreTouchArea.hitArea = new Rectangle(0, 0, scoreTouchAreaWidth, scoreTouchAreaHeight);
    
    // Position will be set in layout() function
    scoreTouchArea._isScoreTouchArea = true;
    HUD_ROOT.addChild(scoreTouchArea);
    
    // Store reference for layout
    HUD_ROOT._scoreTouchArea = scoreTouchArea;
    
    // Event handler - opens score stats bottom sheet
    // 🔥 SAME LOGIC AS X BUTTON: Use window function to check visibility
    scoreDebugBg.on('pointerdown', (e) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (!acquireHudBottomSheetTapLock('score-hit-area')) return;
      
      console.log('📊 SCORE RED AREA CLICKED - Opening score stats bottom sheet');
      
      // 🔥 USER REQUEST: Check if score bottom sheet is already open (toggle behavior)
      let isScoreSheetOpen = false;
      try {
        if (typeof window.isScoreBottomSheetVisible === 'function') {
          isScoreSheetOpen = window.isScoreBottomSheetVisible();
        }
      } catch (err) {
        console.warn('⚠️ Error checking score modal visibility:', err);
      }
      
      // 🔥 USER REQUEST: If score bottom sheet already open, close it (toggle behavior)
      if (isScoreSheetOpen) {
        console.log('📊 Score bottom sheet already open - closing it');
        
        // Haptic feedback for closing
        if (typeof window.triggerHapticImpact === 'function') {
          window.triggerHapticImpact('light');
        }
        
	        playHudScoreSoftCartoonBounce(coinHud);
	        trackHudTimeout(() => {
	          if (typeof window.hideScoreBottomSheet === 'function') {
	            window.hideScoreBottomSheet();
	          }
	        }, HUD_TAP_BOUNCE_CLOSE_DELAY_MS);
	        return;
      }
      
      // 🔥 USER REQUEST: If end-run modal is open, close it first, then open score bottom sheet
      let isEndRunModalOpen = false;
      try {
        if (typeof window.isEndRunModalVisible === 'function') {
          isEndRunModalOpen = window.isEndRunModalVisible();
        }
      } catch (err) {
        console.warn('⚠️ Error checking end-run modal visibility:', err);
      }
      
      if (isEndRunModalOpen) {
        console.log('📊 End-run modal is open - closing it and opening score bottom sheet');
        if (typeof window.hideEndRunModal === 'function') {
          window.hideEndRunModal();
        }
        // Wait a bit for end-run modal to close, then open score bottom sheet
        // 🔥 FIX: Track timeout for cleanup
        trackHudTimeout(() => {
          if (typeof window.showScoreBottomSheet === 'function') {
            window.showScoreBottomSheet();
          }
        }, 450); // Wait for end-run modal animation (400ms) + small buffer
        return;
      }
      
      // Haptic feedback
      if (typeof window.triggerHapticImpact === 'function') {
        window.triggerHapticImpact('light');
      }
      
	      playHudScoreSoftCartoonBounce(coinHud);
	      
	      // Open score bottom sheet - function will handle duplicate checks
	      if (typeof window.showScoreBottomSheet === 'function') {
	        window.showScoreBottomSheet();
	      } else {
	        console.error('❌ showScoreBottomSheet function not available!');
	      }
    });
    
	    // Remove old event handler from coinHud.container (replaced by red touch area)
	    coinHud.container.interactive = false;
	    coinHud.container.eventMode = 'none';
	  }

	  if (comboHud && comboWrap) {
	    const comboTouchAreaWidth = 106;
	    const comboTouchAreaHeight = 60;
	    const comboTouchArea = new Container();
	    comboTouchArea.interactive = true;
	    comboTouchArea.cursor = 'pointer';
	    comboTouchArea.eventMode = 'static';
	    comboTouchArea.zIndex = 1000;

	    const comboDebugBg = new Graphics();
	    comboDebugBg.clear();
	    comboDebugBg.roundRect(0, 0, comboTouchAreaWidth, comboTouchAreaHeight, 8);
	    comboDebugBg.fill({ color: 0xFF0000, alpha: 0 });
	    comboDebugBg.eventMode = 'static';
	    comboDebugBg.cursor = 'pointer';
	    comboDebugBg.interactive = true;
	    comboDebugBg.zIndex = 1000;
	    comboTouchArea.addChild(comboDebugBg);

	    comboTouchArea.hitArea = new Rectangle(0, 0, comboTouchAreaWidth, comboTouchAreaHeight);
	    comboTouchArea._isComboTouchArea = true;
	    HUD_ROOT.addChild(comboTouchArea);
	    HUD_ROOT._comboTouchArea = comboTouchArea;

	    comboDebugBg.on('pointerdown', (e) => {
	      e.stopPropagation();
	      e.stopImmediatePropagation();
	      if (!acquireHudBottomSheetTapLock('combo-hit-area')) return;

	      console.log('🔥 COMBO AREA CLICKED - Opening combo bottom sheet');

	      let isScoreSheetOpen = false;
	      let scoreSheetMode = 'score';
	      try {
	        if (typeof window.isScoreBottomSheetVisible === 'function') {
	          isScoreSheetOpen = window.isScoreBottomSheetVisible();
	        }
	        if (typeof window.getScoreBottomSheetMode === 'function') {
	          scoreSheetMode = window.getScoreBottomSheetMode();
	        }
	      } catch (err) {
	        console.warn('⚠️ Error checking score modal visibility:', err);
	      }

	      if (isScoreSheetOpen) {
	        if (typeof window.triggerHapticImpact === 'function') {
	          window.triggerHapticImpact('light');
	        }
	        playHudScoreSoftCartoonBounce(comboHud);

		        if (scoreSheetMode === 'combo') {
		          console.log('🔥 Combo bottom sheet already open - closing it');
		          trackHudTimeout(() => {
		            if (typeof window.hideScoreBottomSheet === 'function') {
		              window.hideScoreBottomSheet();
		            }
		          }, HUD_TAP_BOUNCE_CLOSE_DELAY_MS);
		          return;
		        }

	        console.log('🔥 Score bottom sheet is open - switching to combo bottom sheet');
	        if (typeof window.hideScoreBottomSheet === 'function') {
	          window.hideScoreBottomSheet();
	        }
	        trackHudTimeout(() => {
	          if (typeof window.showComboBottomSheet === 'function') {
	            window.showComboBottomSheet();
	          } else if (typeof window.showScoreBottomSheet === 'function') {
	            window.showScoreBottomSheet('combo');
	          }
	        }, 450);
	        return;
	      }

	      let isEndRunModalOpen = false;
	      try {
	        if (typeof window.isEndRunModalVisible === 'function') {
	          isEndRunModalOpen = window.isEndRunModalVisible();
	        }
	      } catch (err) {
	        console.warn('⚠️ Error checking end-run modal visibility:', err);
	      }

	      if (isEndRunModalOpen) {
	        console.log('🔥 End-run modal is open - closing it and opening combo bottom sheet');
	        if (typeof window.hideEndRunModal === 'function') {
	          window.hideEndRunModal();
	        }
	        trackHudTimeout(() => {
	          if (typeof window.showComboBottomSheet === 'function') {
	            window.showComboBottomSheet();
	          } else if (typeof window.showScoreBottomSheet === 'function') {
	            window.showScoreBottomSheet('combo');
	          }
	        }, 450);
	        return;
	      }

	      if (typeof window.triggerHapticImpact === 'function') {
	        window.triggerHapticImpact('light');
	      }

		      playHudScoreSoftCartoonBounce(comboHud);
		      if (typeof window.showComboBottomSheet === 'function') {
		        window.showComboBottomSheet();
		      } else if (typeof window.showScoreBottomSheet === 'function') {
		        window.showScoreBottomSheet('combo');
		      } else {
		        console.error('❌ showComboBottomSheet function not available!');
		      }
		    });

	    comboHud.container.interactive = false;
	    comboHud.container.eventMode = 'none';
	  }
	  
	  // Store X button reference for layout
	  HUD_ROOT._xButton = xButton;
	}

// Play the deferred drop once (used on first Play when board is ~50% populated)
export function playHudDrop({ duration = 0.8, forceRestart = false } = {}){
  const hudRoot = HUD_ROOT || (window as any).HUD_ROOT || null;
  if (!hudRoot) return;
  if (!HUD_ROOT) HUD_ROOT = hudRoot;

  // 🔥 CRITICAL FIX: Add HUD_ROOT to stage NOW if it wasn't added yet (initialHide path)
  if (!HUD_ROOT.parent && HUD_ROOT._stage) {
    HUD_ROOT._stage.addChild(HUD_ROOT);
    console.log('✅ HUD_ROOT added to stage (was deferred from initHUD)');
  }
  
  // 🔥 CRITICAL FIX: Restore stage visibility NOW that HUD is ready to drop
  // Stage was hidden in initHUD() to prevent flash
  if (HUD_ROOT.parent && !HUD_ROOT.parent.visible) {
    HUD_ROOT.parent.visible = true;
    console.log('🎯 Stage visibility restored for HUD drop');
  }
  
  const top = HUD_ROOT._dropTop ?? 44;
  
  // 🔥 NEW: Force restart drop animation (used for interim entry so it always replays)
  if (forceRestart) {
    try { gsap.killTweensOf(HUD_ROOT); } catch {}
    HUD_ROOT._dropped = false;
    HUD_ROOT.visible = true;
    HUD_ROOT.alpha = 0;
    HUD_ROOT.y = top - 140;
  }
  
  // 🔥 CRITICAL FIX: If HUD is already dropped, ensure it's visible and positioned correctly
  if (!forceRestart && HUD_ROOT._dropped) {
    const top = HUD_ROOT._dropTop ?? HUD_ROOT.y ?? 44;
    HUD_ROOT.y = top;
    HUD_ROOT.alpha = 1;
    HUD_ROOT.visible = true;
    console.log('✅ HUD already dropped - ensuring visibility');
    return;
  }
  
  try { gsap.killTweensOf(HUD_ROOT); } catch {}
  
  // 🔥 CRITICAL FIX: Ensure HUD is visible before animation
  HUD_ROOT.visible = true;
  
  // Animate PIXI HUD drop
  trackTween(HUD_ROOT, {
    alpha: 1,
    y: top,
    duration: duration,
    ease: 'elastic.out(1, 0.6)',
    onComplete: () => { 
      if (HUD_ROOT) {
        HUD_ROOT._dropped = true; 
        HUD_ROOT.y = top;
        HUD_ROOT.alpha = 1;
        HUD_ROOT.visible = true;
        console.log('✅ HUD drop animation completed');
      }
    },
    onUpdate: function() {
      // Safety check during animation
      if (!HUD_ROOT || !HUD_ROOT.parent) {
        console.warn('⚠️ playHudDrop: HUD_ROOT destroyed during animation, killing tween');
        this.kill();
      }
    }
  });
  
  console.log('✅ PIXI HUD drop animation started');
  
  // 🔥 CRITICAL FIX: Ensure board indicator animation is triggered
  try {
    animateBoardIndicatorEnter(duration);
  } catch (e) {
    console.warn('⚠️ Failed to trigger board indicator animation:', e);
  }
}

// Helper function to cleanup all smoke bubbles before exit
export function cleanupSmokeBubbles() {
  try {
    // Find wild container and kill its smoke interval
    if (wild && wild.view) {
      const wildContainer = wild.view;
      if (wildContainer._smokeInterval) {
        clearInterval(wildContainer._smokeInterval);
        wildContainer._smokeInterval = null;
        console.log('✅ Killed wild meter smoke interval');
      }
    }
    
    const removeSmokeFromContainer = (container) => {
      if (!container || !container.children) return 0;
      let removedCount = 0;
      [...container.children].forEach(child => {
        if (!child) return;
        const isSmokeBubble =
          child._isWildMeterSmokeBubble === true ||
          child.label === 'wild-meter-smoke' ||
          // Backward-compatible cleanup for bubbles created before they were labelled.
          (child instanceof Graphics && child.zIndex === 2000 && child.parent === HUD_ROOT);

        if (isSmokeBubble) {
          try {
            gsap.killTweensOf(child);
            if (child.parent) child.parent.removeChild(child);
            child.destroy();
            removedCount++;
          } catch {}
          return;
        }

        removedCount += removeSmokeFromContainer(child);
      });
      return removedCount;
    };

    const removedFromHudRoot = removeSmokeFromContainer(HUD_ROOT);
    const removedFromHudStage = HUD_ROOT?.parent ? removeSmokeFromContainer(HUD_ROOT.parent) : 0;
    const removedCount = removedFromHudRoot + removedFromHudStage;
    if (removedCount > 0) {
      console.log(`✅ Removed ${removedCount} wild meter smoke bubbles`);
    }
    console.log('✅ All smoke bubbles cleaned up');
  } catch (e) {
    console.warn('⚠️ Error cleaning up smoke bubbles:', e);
  }
}

// Play HUD rise animation - exact reverse of playHudDrop
export function playHudRise({ duration = 0.3 } = {}){
  const hudRoot = HUD_ROOT || (window as any).HUD_ROOT || null;
  if (!hudRoot) {
    // Wait 0.1s after HUD would have started, then animate board indicator
    // 🔥 FIX: Track timeout for cleanup
    trackHudTimeout(() => {
      animateBoardIndicatorExit(0.3);
    }, 100);
    return;
  }
  if (!HUD_ROOT) HUD_ROOT = hudRoot;
  
  // Safety: double-check HUD_ROOT is still valid
  try {
    const top = HUD_ROOT._dropTop ?? HUD_ROOT.y ?? 0;
    
    // CRITICAL: Kill all smoke bubbles and intervals before exit
    cleanupSmokeBubbles();
    
    // 🔥 CLEANUP: Kill all combo animations before exit
    cleanupComboAnimations();
    
    // Kill any existing tweens
    try { gsap.killTweensOf(HUD_ROOT); } catch {}
    
    // Use fixed 0.3s duration for faster exit animation
    const exitDuration = 0.3;
    
    // Animate PIXI HUD rise (reverse of drop) - faster exit
    trackTween(HUD_ROOT, {
      alpha: 0,  // fade out
      y: -top * 2,  // rise above screen
      duration: exitDuration,
      ease: 'power2.in',  // faster, simpler ease for exit
      onComplete: () => { 
        // Safety check in callback - HUD_ROOT might be destroyed during animation
        if (HUD_ROOT) {
          HUD_ROOT._dropped = false; 
          HUD_ROOT.y = -top * 2; 
        }
      },
      onUpdate: function() {
        // Safety check during animation - if HUD_ROOT is destroyed, kill this tween
        if (!HUD_ROOT || !HUD_ROOT.parent) {
          console.warn('⚠️ playHudRise: HUD_ROOT destroyed during animation, killing tween');
          this.kill();
        }
      }
    });
    
    console.log('✅ PIXI HUD rise animation started');
    
    // Wait 0.1s after HUD animation starts, then animate board indicator with 0.3s duration
    // 🔥 FIX: Track timeout for cleanup
    trackHudTimeout(() => {
      animateBoardIndicatorExit(0.3);
    }, 100);
  } catch (error) {
    console.error('❌ playHudRise failed:', error);
    // Even on error, try to animate board indicator after delay
    // 🔥 FIX: Track timeout for cleanup
    trackHudTimeout(() => {
      animateBoardIndicatorExit(0.3);
    }, 100);
  }
}

export function updateHUD({ score, board, moves, combo }) {
  if (!HUD_ROOT) {
    return;
  }
  
  if (!boardText || !scoreText || !comboText) {
    return;
  }
  
  if (typeof board === 'number') {
    const bd = board|0;
    const formatted = `#${bd}`;
    if (formatted !== boardText.text) {
      boardText.text = formatted;
      if (!__boardTweening) bounceText(boardText, { peak: 1.32, back: 1.10, up: 0.10, down: 0.24 });
      __prevBoard = bd;
    }
    updateBoardIndicatorValue(bd);
  }
  if (typeof score === 'number') {
    const sc = score|0;
    if (String(sc) !== scoreText.text) {
      scoreText.text = String(sc);
      if (!__scoreTweening) bounceText(scoreText, { peak: 1.20, back: 1.06, up: 0.08, down: 0.20 });
      __prevScore = sc;
    }
  }
  if (typeof combo === 'number') {
    const v = combo|0;
    // 🔥 NEW HUD: Update combo number text (18px) - "x" stays constant (14px)
    if (comboText) {
      comboText.text = String(v);
      // Update number text position relative to "x" text if it exists
      if (comboXText && comboText.parent) {
        comboText.x = comboXText.x + comboXText.width;
      }
    }
    
    // 🔥 COMBO ICON SWAP: Swap icon to extra-combo-hud.png when combo >= 10
    updateComboIcon(v);
    
    // 🔥 COMBO WOBBLE: Start wobble animation when combo >= 10
    updateComboWobble(v);
    
    // 🔥 CONTAIN COMBO: Adjust combo position and scale to keep it within viewport
    if (HUD_ROOT && HUD_ROOT._hudElements && HUD_ROOT._hudElements.combo && comboWrap) {
      const comboEl = HUD_ROOT._hudElements.combo;
      const comboContainer = comboEl.container;
      
      if (comboContainer && comboContainer.parent && comboWrap.parent) {
        // Get screen width from app renderer or window
        const app = comboContainer.parent.parent?.app || (typeof window !== 'undefined' && window.STATE?.app);
        const screenWidth = app?.renderer?.width || (typeof window !== 'undefined' ? window.innerWidth : 800);
        // Keep 24px from the safe right edge.
        // We'll use the same approach: rightEdge = screenWidth - 24px padding
        const comboRightPadding = 24; // 24px from right edge
        const rightEdge = screenWidth - comboRightPadding; // 24px padding from right edge
        const hudStatsComboLeftShift = getHudStatsComboLeftShift(screenWidth);
        
        // Calculate total combo width (icon + spacing + "x" + number)
        const iconWidth = comboEl.iconSprite ? comboEl.iconSprite.width * comboEl.iconSprite.scale.x : 28;
        const xTextWidth = comboEl.xText ? comboEl.xText.width : 0;
        const numberTextWidth = comboEl.text ? comboEl.text.width : 0;
        const spacing = 4;
        const totalWidth = iconWidth + spacing + xTextWidth + numberTextWidth;
        
        // 🔥 USER REQUEST: Position combo 12px left of wild preloader right edge
        // Wild preloader: x = 24px (SIDE), width = screenWidth - 48px, so right edge = 24 + (screenWidth - 48) = screenWidth - 24px
        const SIDE = 24;
        const wildPreloaderRightEdge = screenWidth - SIDE; // vw - 24px
        // Combo right edge should be 12px left of wild preloader right edge
        const comboRightEdge = wildPreloaderRightEdge - 12; // vw - 36px
        
        // Position combo so its right edge is 8px left of wild preloader right edge
        // comboWrap.x is center, so: comboWrap.x + totalWidth/2 = comboRightEdge
        comboWrap.x = comboRightEdge - totalWidth / 2 - hudStatsComboLeftShift;
        
        // Also scale down if still too wide after moving
        const maxAllowedWidth = screenWidth - 40; // No padding, just 40px margin for safety
        if (totalWidth > maxAllowedWidth && maxAllowedWidth > 0) {
          const scale = maxAllowedWidth / totalWidth;
          comboContainer.scale.set(Math.min(1, scale));
        } else {
          comboContainer.scale.set(1);
        }
      }
    }
    
    if (v > 0) { startComboFX(); } else { stopComboFX(); }
    __lastComboVal = v;
  }
}

// 🔥 ANIMATION: Animate score counting from current to target value
let __scoreProxy = null;
let __scoreTween = null;

export function setScore(v, animate = true){ 
  if (!scoreText) return;
  
  const targetScore = v|0;
  const currentText = scoreText.text || '0';
  const currentScore = parseInt(currentText.replace(/[^0-9]/g, '') || '0', 10) || 0;
  
  // If already at target, just set it directly
  if (currentScore === targetScore) {
    scoreText.text = String(targetScore);
    return;
  }
  
  // If animation is already in progress (from animateScore), just update directly
  // This prevents double animation when animateScore calls setScore in onUpdate
  if (__scoreTweening || !animate) {
    scoreText.text = String(targetScore);
    return;
  }
  
  // Kill any existing animation
  if (__scoreTween) {
    gsap.killTweensOf(__scoreProxy);
    __scoreTween = null;
  }
  
  // Create proxy object for animation
  if (!__scoreProxy) {
    __scoreProxy = { value: currentScore };
  } else {
    __scoreProxy.value = currentScore;
  }
  
  // Calculate duration based on difference
  const diff = Math.abs(targetScore - currentScore);
  const duration = Math.min(1.2, Math.max(0.6, diff / 1000));
  
  // Animate score counting
  __scoreTween = trackTween(__scoreProxy, {
    value: targetScore,
    duration: duration,
    ease: 'power2.out',
    onUpdate: () => {
      const rounded = Math.round(__scoreProxy.value);
      scoreText.text = String(rounded);
    },
    onComplete: () => {
      scoreText.text = String(targetScore);
      __scoreTween = null;
    }
  });
}
export function setBoard(v){
  const val = v|0;
  if (boardText) boardText.text = `#${val}`;
  updateBoardIndicatorValue(val);
}
// 🔥 COMBO ICON SWAP: Function to swap combo icon based on combo value
// Three levels:
// - 0-4: combo-hud.png (normal)
// - 5-9: extra-combo-hud.png (extra)
// - 10+: mega-combo-hud.png (mega)
function updateComboIcon(comboValue) {
  if (!HUD_ROOT || !HUD_ROOT._hudElements || !HUD_ROOT._hudElements.combo) return;
  const combo = HUD_ROOT._hudElements.combo;
  const iconSprite = combo.iconSprite;
  if (!iconSprite || iconSprite.destroyed) return;
  
  // Determine which icon to use based on combo value
  let targetIconType = 'normal';
  let targetIconPath = './assets/hud/combo-hud.png';
  
  if (comboValue >= 10) {
    targetIconType = 'mega';
    targetIconPath = './assets/hud/mega-combo-hud.png';
  } else if (comboValue >= 5) {
    targetIconType = 'extra';
    targetIconPath = './assets/hud/extra-combo-hud.png';
  } else {
    targetIconType = 'normal';
    targetIconPath = './assets/hud/combo-hud.png';
  }
  
  const currentIconType = combo.currentIconType || 'normal';
  if (targetIconType !== currentIconType) {
    const loadIcon = async () => {
      try {
        // 🔥 CRITICAL: Store current sprite properties before swapping
        const currentVisible = iconSprite.visible;
        const currentAlpha = iconSprite.alpha;
        const currentScaleX = iconSprite.scale.x;
        const currentScaleY = iconSprite.scale.y;
        const currentAnchorX = iconSprite.anchor?.x ?? 0.5;
        const currentAnchorY = iconSprite.anchor?.y ?? 0.5;
        
        // Try to get texture (might already be loaded)
        let texture = null;
        try {
          texture = getUsableHudTexture(targetIconPath);
          if (!isUsableHudTexture(texture)) {
            console.log(`💧 ${targetIconPath} not in cache (Assets.get returned null), loading...`);
            texture = await loadUsableHudTexture(targetIconPath);
          } else {
            console.log(`💧 ${targetIconPath} found in cache`);
          }
        } catch (e) {
          // Texture not in cache, load it
          console.log(`💧 ${targetIconPath} not in cache (error), loading...`, e);
          try {
            texture = await loadUsableHudTexture(targetIconPath);
          } catch (loadError) {
            console.error(`❌ Failed to load ${targetIconPath}:`, loadError);
            // 🔥 CRITICAL: Fallback to previous icon if loading fails
            console.warn(`⚠️ Falling back to previous icon type: ${currentIconType}`);
            return; // Exit early if texture loading fails
          }
        }
        
        // 🔥 CRITICAL: Double-check texture is valid
        if (!isUsableHudTexture(texture)) {
          console.error(`❌ Texture ${targetIconPath} is null or undefined after loading attempt!`);
          return; // Exit early if texture is invalid
        }
        
        if (texture && iconSprite && !iconSprite.destroyed) {
          // 🔥 CRITICAL: Store target size (same as initial combo icon size)
          const targetSize = 28; // Same as initial combo icon size
          
          // 🔥 USER REQUEST: Smooth morph animation with ease in/out
          // Kill any existing animations on this sprite
          try {
            gsap.killTweensOf(iconSprite);
            gsap.killTweensOf(iconSprite.scale);
            if (iconSprite._morphTimeline) {
              try {
                iconSprite._morphTimeline.kill();
              } catch {}
            }
          } catch {}
          
          // Calculate new scale for target texture
          let newScale = currentScaleX || 1;
          if (texture && texture.width > 0 && texture.height > 0) {
            newScale = targetSize / Math.max(texture.width, texture.height);
          }
          
          // Store current scale before animation
          const oldScaleX = iconSprite.scale.x;
          const oldScaleY = iconSprite.scale.y;
          
          // 🔥 USER REQUEST: Fast morph transition (cross-fade, no fade out)
          // Direct texture swap with quick scale animation for smooth morph effect
          const morphDuration = 0.15; // 🔥 Faster: 150ms (reduced from 300ms)
          const morphTimeline = trackTimeline({
            onComplete: () => {
              // Update icon type after animation completes
              combo.currentIconType = targetIconType;
              
              // Clean up timeline reference
              try {
                if (iconSprite) {
                  iconSprite._morphTimeline = null;
                }
              } catch {}
              
            }
          });
          
          // Store timeline for cleanup
          iconSprite._morphTimeline = morphTimeline;
          
          // 🔥 USER REQUEST: Direct morph (no fade out) - swap texture immediately and animate scale
          // Step 1: Swap texture immediately (no fade out)
          if (iconSprite && !iconSprite.destroyed) {
            iconSprite.texture = texture;
            
            // Preserve anchor
            if (iconSprite.anchor) {
              iconSprite.anchor.set(currentAnchorX, currentAnchorY);
            }
            
            // Set initial scale (slightly smaller for pop-in effect)
            iconSprite.scale.set(newScale * 0.9, newScale * 0.9);
            iconSprite.alpha = 1; // Ensure visible immediately
          }
          
          // Step 2: Quick scale up animation (morph effect) - fast and smooth
          // Use scale.x/scale.y for PIXI objects (not scaleX/scaleY which needs PixiPlugin)
          morphTimeline.to(iconSprite.scale, {
            x: newScale,
            y: newScale,
            duration: morphDuration, // 150ms - fast morph
            ease: 'power2.out' // Smooth ease out for natural feel
          });
          
          // Ensure sprite remains visible
          iconSprite.visible = true;
          
          // Preserve anchor
          if (iconSprite.anchor) {
            iconSprite.anchor.set(currentAnchorX, currentAnchorY);
          }
          
          // 🔥 CRITICAL: Ensure sprite is in container and visible
          if (!iconSprite.parent) {
            console.warn('⚠️ Icon sprite lost parent container, attempting to re-add...');
            if (combo.container && !combo.container.destroyed) {
              combo.container.addChildAt(iconSprite, 0);
              console.log('✅ Icon sprite re-added to container');
            }
          }
          
          // 🔥 CRITICAL: Ensure container is also visible
          if (combo.container) {
            combo.container.visible = true;
            combo.container.alpha = 1;
          }
          
          // 🔥 CRITICAL: Don't update currentIconType yet - wait for animation to complete
          // This is now set in morphTimeline.onComplete callback
        } else {
          console.warn(`⚠️ Failed to get ${targetIconPath} texture or sprite destroyed`);
          if (!iconSprite || iconSprite.destroyed) {
            console.error(`❌ Icon sprite was destroyed during texture swap!`);
          } else if (!texture) {
            console.error(`❌ Texture ${targetIconPath} is null or undefined!`);
          }
        }
      } catch (err) {
        console.error(`❌ Failed to load ${targetIconPath}:`, err);
        // 🔥 CRITICAL: Ensure sprite remains visible even if loading fails
        if (iconSprite && !iconSprite.destroyed) {
          iconSprite.visible = true;
          iconSprite.alpha = 1;
        }
      }
    };
    
    loadIcon();
  }
}


// 🔥 COMBO WOBBLE: Function to start/stop wobble animation on combo icon
function updateComboWobble(comboValue) {
  if (!HUD_ROOT || !HUD_ROOT._hudElements || !HUD_ROOT._hudElements.combo) return;
  
  const combo = HUD_ROOT._hudElements.combo;
  const iconSprite = combo.iconSprite;
  
  if (!iconSprite || iconSprite.destroyed) return;
  
  const shouldWobble = comboValue >= 10;
  
  // Kill existing wobble animation
  if (comboWobbleTween) {
    comboWobbleTween.kill();
    comboWobbleTween = null;
    // Reset rotation
    iconSprite.rotation = 0;
  }
  
  if (shouldWobble) {
    // Start continuous wobble animation
    comboWobbleTween = trackTween(iconSprite, {
      rotation: 0.15, // ~8.6 degrees
      duration: 0.3,
      ease: 'power2.inOut',
      yoyo: true,
      repeat: -1 // Infinite repeat
    });
    if (isVerboseGameplayLogsEnabled()) {
      console.log('💧 Combo icon wobble animation started (combo >= 10)');
    }
  }
}

export function setCombo(v){
  const val = v|0;
  if (!comboText) return;
  // 🔥 NEW HUD: Update combo number text (18px) - "x" stays constant (14px)
  comboText.text = String(val);
  // Update number text position relative to "x" text if it exists
  if (comboXText && comboText.parent) {
    comboText.x = comboXText.x + comboXText.width;
  }
  
  // 🔥 COMBO ICON SWAP: Swap icon to extra-combo-hud.png when combo >= 10
  updateComboIcon(val);
  
  // 🔥 COMBO WOBBLE: Start wobble animation when combo >= 10
  updateComboWobble(val);
  
  // 🔥 CONTAIN COMBO: Adjust combo position and scale to keep it within viewport
  if (HUD_ROOT && HUD_ROOT._hudElements && HUD_ROOT._hudElements.combo && comboWrap) {
    const combo = HUD_ROOT._hudElements.combo;
    const comboContainer = combo.container;
    
    if (comboContainer && comboContainer.parent && comboWrap.parent) {
      // Get screen width from app renderer or window
      const app = comboContainer.parent.parent?.app || (typeof window !== 'undefined' && window.STATE?.app);
      const screenWidth = app?.renderer?.width || (typeof window !== 'undefined' ? window.innerWidth : 800);
      // Keep 24px from the safe right edge.
      // We'll use the same approach: rightEdge = screenWidth - 24px padding
      const comboRightPadding = 24; // 24px from right edge
      const rightEdge = screenWidth - comboRightPadding; // 24px padding from right edge
        const hudStatsComboLeftShift = getHudStatsComboLeftShift(screenWidth);
      
      // Calculate total combo width (icon + spacing + "x" + number)
      const iconWidth = combo.iconSprite ? combo.iconSprite.width * combo.iconSprite.scale.x : 28;
      const xTextWidth = combo.xText ? combo.xText.width : 0;
      const numberTextWidth = combo.text ? combo.text.width : 0;
      const spacing = 4;
      const totalWidth = iconWidth + spacing + xTextWidth + numberTextWidth;
      
      // 🔥 USER REQUEST: Position combo 12px left of wild preloader right edge
      // Wild preloader: x = 24px (SIDE), width = screenWidth - 48px, so right edge = 24 + (screenWidth - 48) = screenWidth - 24px
      const SIDE = 24;
      const wildPreloaderRightEdge = screenWidth - SIDE; // vw - 24px
      // Combo right edge should be 12px left of wild preloader right edge
      const comboRightEdge = wildPreloaderRightEdge - 12; // vw - 36px
      
      // Position combo so its right edge is 12px left of wild preloader right edge
      // comboWrap.x is center, so: comboWrap.x + totalWidth/2 = comboRightEdge
      comboWrap.x = comboRightEdge - totalWidth / 2 - hudStatsComboLeftShift;
      
      if (isVerboseGameplayLogsEnabled()) {
        console.log('🎯 Combo positioned 12px left of wild preloader:', {
          wildRightEdge: wildPreloaderRightEdge,
          comboRightEdge: comboRightEdge,
          comboCenter: comboWrap.x,
          actualComboRightEdge: comboWrap.x + totalWidth / 2,
          totalWidth
        });
      }
      
      // Also scale down if still too wide after moving
      const maxAllowedWidth = screenWidth - 40; // No padding, just 40px margin for safety
      if (totalWidth > maxAllowedWidth && maxAllowedWidth > 0) {
        const scale = maxAllowedWidth / totalWidth;
        comboContainer.scale.set(Math.min(1, scale));
        if (isVerboseGameplayLogsEnabled()) {
          console.log(`💧 Combo scaled to ${(scale * 100).toFixed(1)}% to fit on screen`);
        }
      } else {
        comboContainer.scale.set(1);
      }
    }
  }
  
  if (val > 0) startComboFX(); else stopComboFX();
  __lastComboVal = val;
}
export function resetCombo(){
  if (!comboText) return;
  // 🔥 NEW HUD: Update combo number text (18px) - "x" stays constant (14px)
  comboText.text = '0';
  // Update number text position relative to "x" text if it exists
  if (comboXText && comboText.parent) {
    comboText.x = comboXText.x + comboXText.width;
  }
  
  // 🔥 CLEANUP: Kill all combo animations before resetting
  cleanupComboAnimations();
  
  // 🔥 COMBO ICON SWAP: Reset to normal icon when combo resets
  updateComboIcon(0);
  
  // 🔥 COMBO WOBBLE: Stop wobble animation when combo resets
  updateComboWobble(0);
  
  stopComboFX();
}
export function bumpCombo(opts = {}){
  if (!comboText) return;
  const kind = opts.kind || opts.type || 'stack'; // 'stack' | 'merge6'
  const cv = Number.isFinite(opts.combo) ? (opts.combo|0) : (__lastComboVal|0);

  // keep jitter running while combo is active
  startComboFX();

  // Stop current deflate/inflate but continue from current scale for smoothness
  try { __comboBumpTl?.kill?.(); } catch {}
  try { __shakeTl?.kill?.(); } catch {}

  const sx = comboText.scale?.x || 1;
  const sy = comboText.scale?.y || 1;
  const cur = Math.max(sx, sy);

  // Target peaks: stack (softer) vs merge6 (max balloon)
  // Increased by request: +25% for merge6, +10% for stack
  const PEAK_MAX   = 2.50; // was 2.00 → now 250% (24px -> 60px)
  const PEAK_STACK = 1.76; // was 1.60 → now ~176%
  const PEAK_CAP   = 3.20; // hard cap so it doesn't get absurd
  let peak = (kind === 'merge6') ? PEAK_MAX : PEAK_STACK;

  // Extra balloon if combo >= 10: +20% at 10, +2% per each step above 10, capped at +40%
  if (cv >= 10) {
    const over = Math.max(0, cv - 9);
    const bonusFactor = 1 + Math.min(0.40, 0.20 + (over - 1) * 0.02); // 10 -> +20%, 11 -> +22%, ... capped at +40%
    peak = Math.min(PEAK_CAP, peak * bonusFactor);
  }

  // Inflate a bit faster if already large so it snaps back to peak quickly
  const upDur = Math.max(0.08, 0.16 - (cur - 1) * 0.06);

  __comboBumpTl = trackTimeline();
  __comboBumpTl
    // inflate quickly to peak
    .to(comboText.scale, { x: peak, y: peak, duration: upDur, ease: 'back.out(3)' }, 0)
    // slow, single deflate back to 1.0; keep it floating during the 2s combo window
    .to(comboText.scale, { x: 1.0, y: 1.0, duration: 2.10, ease: 'power2.out' }, '>-0.01');

  // Boost shake while inflating, then gradually relax during deflate
  const sh = { k: __shakeMul };
  __shakeTl = trackTimeline({ onUpdate: () => { __shakeMul = sh.k; } });
  // If combo >= 10, double the shake strength for stronger impact
  const shakeExtra = (cv >= 10) ? 2.0 : 1.0;
  // For merge6: reduced shake strength (0.65 = 50% of 1.3) and faster animation (40% faster = 60% duration)
  const isMerge6 = (kind === 'merge6');
  const shakeStrength = isMerge6 ? 0.65 : 2.0;
  const shakeDuration = isMerge6 ? upDur * 0.54 : upDur * 0.9; // 40% faster for merge6
  const relaxDuration1 = isMerge6 ? 0.60 : 1.00; // 40% faster
  const relaxDuration2 = isMerge6 ? 0.54 : 0.90; // 40% faster
  __shakeTl
    .to(sh, { k: shakeStrength * shakeExtra, duration: shakeDuration, ease: 'power2.out' }, 0)
    .to(sh, { k: 1.4, duration: relaxDuration1, ease: 'sine.out' }, '>-0.02')
    .to(sh, { k: 1.1, duration: relaxDuration2, ease: 'sine.out' }, '>');
}

/* COMPLETELY NEW LOGIC: Simple DOM-based wild meter positioned in HUD */
export function updateProgressBar(ratio, animate = false){
  if (!wild?.setProgress) return;
  const fill = wild?.view?._fill;
  if (!fill || (fill as { destroyed?: boolean }).destroyed) return;
  const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  try {
    wild.setProgress(clamped, animate);
  } catch {
    // Wild meter not ready yet (e.g. startLevel before initHUD)
  }
}

// PIXI wild meter positioning is handled by HUD layout

/* PIXI RESET: Reset PIXI-based wild meter */
export function resetWildMeter(instant = true) {
  console.log('🔄 PIXI RESET: resetWildMeter called, instant:', instant);
  
  // Kill all GSAP animations for wild meter and clear smoke interval
  try {
    if (wild?.view?._smokeInterval) {
      clearInterval(wild.view._smokeInterval);
      wild.view._smokeInterval = null;
    }
    gsap.killTweensOf(wild?.view?._fill);
    gsap.killTweensOf(wild?.view?._fill?.scale);
    if (wild?.view?._fill) {
      wild.view._fill.y = 0;
    }
    if (wild?.view?._springTimeline) {
      wild.view._springTimeline.kill();
      wild.view._springTimeline = null;
    }
    if (wild?.view?._currentAnimation) {
      wild.view._currentAnimation.kill();
      wild.view._currentAnimation = null;
    }
    console.log('✅ PIXI RESET: All GSAP animations killed');
  } catch (e) {
    console.warn('⚠️ PIXI RESET: Error killing GSAP animations:', e);
  }
  
  if (wild && wild.setProgress) {
    wild.setProgress(0, !instant);
    console.log('✅ PIXI RESET: Wild meter reset to 0%');
  } else {
    console.warn('⚠️ PIXI RESET: Wild meter not available for reset');
  }
  
  console.log('✅ PIXI RESET: Wild meter completely reset');
}

/* Legacy function - now calls hard reset */
export function resetWildLoader(){
  console.log('🔄 resetWildLoader called, redirecting to resetWildMeter(true)');
  resetWildMeter(true);
}

/* Animate wild loader to 0 */
export function animateWildLoaderToZero(){
  console.log('🎬 Animating wild loader to 0');
  if (!wild) {
    console.log('⚠️ Wild loader not found for animation');
    return;
  }
  
  try {
    // DRASTIC APPROACH: Override the setProgress function to force 0
    const originalSetProgress = wild.setProgress;
    
    // Create a new setProgress that always sets to 0
    wild.setProgress = (t, animate = false) => {
      console.log('🔄 Override setProgress called with:', t, 'forcing to 0');
      
      // Force progress to 0 internally
      if (wild.view && wild.view.children) {
        const mask = wild.view.children.find(child => child.mask);
        if (mask && typeof mask.clear === 'function') {
          mask.clear();
          mask.roundRect(0, -0.5, 0, 8 + 1, 4).fill(0xffffff);
          console.log('🔄 Override: Mask cleared to 0');
        }
      }
      
      // Call original with 0
      originalSetProgress(0, false);
    };
    
    // Force call the overridden function
    wild.setProgress(0, false);
    
    // Restore original function after a delay
    // 🔥 FIX: Track timeout for cleanup
    trackHudTimeout(() => {
      wild.setProgress = originalSetProgress;
      // Ensure wild loader is ready for normal operation
      if (wild.start) {
        wild.start();
      }
      console.log('🔄 Restored original setProgress function and started wild loader');
    }, 100);
    
    console.log('✅ Wild loader override reset to 0');
  } catch (error) {
    console.error('❌ Error animating wild loader to 0:', error);
  }
}

/* Force wild loader to 0 using GSAP animation */
export function forceWildLoaderToZero(){
  console.log('🎬 Force animating wild loader to 0');
  if (!wild) {
    console.log('⚠️ Wild loader not found for force animation');
    return;
  }
  
  try {
    // Use GSAP to animate the wild loader view itself
    if (wild.view && wild.view.children) {
      const mask = wild.view.children.find(child => child.mask);
      if (mask) {
        // Animate the mask width to 0
        trackTween(mask, {
          width: 0,
          duration: 0.5,
          ease: "power2.out",
          onUpdate: () => {
            // Force redraw with 0 width
            mask.clear();
            mask.roundRect(0, -0.5, 0, 8 + 1, 4).fill(0xffffff);
          },
          onComplete: () => {
            console.log('✅ Wild loader force animation to 0 completed');
            // IMPORTANT: Reset the wild loader state so it can work normally again
            if (wild.setProgress) {
              wild.setProgress(0, false);
            }
          }
        });
      }
    }
  } catch (error) {
    console.error('❌ Error force animating wild loader to 0:', error);
  }
}

/* Recreate wild loader completely */
export function recreateWildLoader(){
  console.log('🔄 Recreating wild loader completely');
  
  if (wild && wild.view) {
    try {
      wild.view.destroy({ children: true });
    } catch (e) {
      console.log('⚠️ Error destroying old wild loader:', e);
    }
  }
  
  // Wild loader is now created in initHUD
  console.log('✅ Wild loader reset completed');
}

/* --- Score animation helper (compat) --- */
export function animateScore({ scoreRef, setScore, updateHUD, SCORE_CAP, gsap }, toValue, duration = 0.5) {
  const from = Math.min(SCORE_CAP, (+scoreRef() || 0) | 0);
  const to   = Math.min(SCORE_CAP, (+toValue   || 0) | 0);
  if (to === from) { setScore(to); updateHUD?.({ score: to }); return; }
  const proxy = { v: from };
  __scoreTweening = true;
  // Skip the default score pop while the wild-star burst owns the score number scale.
  if (__scoreStarBurstCount <= 0 && !__scoreStarDeflateTimeout) {
    bounceText(scoreText, { peak: 1.18, back: 1.06, up: 0.10, down: 0.24 });
  }
  trackTween(proxy, {
    v: to, duration: duration || 0.5, ease: 'power2.out',
    onUpdate: () => { const val = Math.round(proxy.v); setScore(val); try { updateHUD?.({ score: val }); } catch {} },
    onComplete: () => { __scoreTweening = false; }
  });
}

/* --- Board animation helper (same feel as score) --- */
export function animateBoard({ boardRef, setBoard, updateHUD, gsap }, toValue, duration = 0.5) {
  const from = ((+boardRef() || 0) | 0);
  const to   = ((+toValue   || 0) | 0);
  if (to === from) { setBoard(to); updateHUD?.({ board: to }); return; }
  const proxy = { v: from };
  // small pop at start
  bounceText(boardText, { peak: 1.18, back: 1.06, up: 0.10, down: 0.24 });
  trackTween(proxy, {
    v: to, duration: duration || 0.5, ease: 'power2.out',
    onUpdate: () => { const val = Math.round(proxy.v); setBoard(val); try { updateHUD?.({ board: val }); } catch {} },
  });
}

// HUD drop animation - elastic bounce from top of screen
export function animateHUDDrop() {
  if (!unifiedHudContainer) {
    console.warn('⚠️ Unified HUD container not found for drop animation');
    return;
  }
  
  console.log('🎯 Starting unified HUD drop animation');
  
  // Animate the unified container drop
  animateUnifiedHudDrop();
  
  // Also animate PIXI HUD for compatibility
  if (HUD_ROOT) {
    const originalY = HUD_ROOT.y;
    HUD_ROOT.y = -200;
    HUD_ROOT.alpha = 0;
    
    trackTimeline()
      .to(HUD_ROOT, { 
        alpha: 1, 
        duration: 0.2, 
        ease: 'power2.out' 
      })
      .to(HUD_ROOT, { 
        y: originalY, 
        duration: 0.8, 
        ease: 'elastic.out(1, 0.6)' 
      }, 0.1);
  }
  
  console.log('✅ Unified HUD drop animation started');
}

/**
 * Get star HUD icon position in screen coordinates
 */
export function getStarHudPosition() {
  return getScoreHudPosition();
}

/**
 * Get score HUD icon position in screen coordinates.
 */
export function getScoreHudPosition() {
  if (!HUD_ROOT || !HUD_ROOT._hudElements || !HUD_ROOT._hudElements.coin) {
    return null;
  }
  
  const scoreElement = HUD_ROOT._hudElements.coin;
  if (!scoreElement.container) {
    return null;
  }
  
  // Get global position (screen coordinates)
  const globalPos = scoreElement.container.getGlobalPosition();
  return {
    x: globalPos.x,
    y: globalPos.y
  };
}

/**
 * Bounce animation on score HUD icon.
 */
export function bounceScoreIcon(onComplete?: () => void) {
  if (!HUD_ROOT || !HUD_ROOT._hudElements || !HUD_ROOT._hudElements.coin) {
    if (onComplete && typeof onComplete === 'function') {
      try { onComplete(); } catch {}
    }
    return;
  }

  const scoreElement = HUD_ROOT._hudElements.coin;
  if (!scoreElement.container) {
    if (onComplete && typeof onComplete === 'function') {
      try { onComplete(); } catch {}
    }
    return;
  }

  const bounceTarget = scoreElement.iconSprite || scoreElement.container;
  const bounceScale = bounceTarget.scale;
  if (scoreElement.iconSprite && typeof scoreElement.iconSprite._scoreBounceBaseScaleX !== 'number') {
    scoreElement.iconSprite._scoreBounceBaseScaleX = scoreElement.iconSprite.scale.x || 1;
    scoreElement.iconSprite._scoreBounceBaseScaleY = scoreElement.iconSprite.scale.y || 1;
  }
  const baseScaleX = scoreElement.iconSprite ? scoreElement.iconSprite._scoreBounceBaseScaleX : 1;
  const baseScaleY = scoreElement.iconSprite ? scoreElement.iconSprite._scoreBounceBaseScaleY : 1;

  try {
    gsap.killTweensOf(bounceScale);
    if (bounceTarget._bounceTimeline) {
      try {
        bounceTarget._bounceTimeline.kill();
      } catch {}
    }
  } catch {}

  const tl = trackTimeline({
    onComplete: () => {
      try {
        if (bounceTarget) {
          bounceTarget._bounceTimeline = null;
        }
      } catch {}
      if (onComplete && typeof onComplete === 'function') {
        try { onComplete(); } catch {}
      }
    }
  });

  bounceTarget._bounceTimeline = tl;
  tl.to(bounceScale, {
    x: baseScaleX * 1.30,
    y: baseScaleY * 1.30,
    duration: 0.08,
    ease: 'power2.out'
  });
  tl.to(bounceScale, {
    x: baseScaleX,
    y: baseScaleY,
    duration: 0.15,
    ease: 'back.out(1.7)'
  });
}

/**
 * Bounce animation on star HUD icon (like stack merge bounce)
 */
export function bounceStarIcon(onComplete) {
  if (isArcadeHomeRunMode()) {
    if (onComplete && typeof onComplete === 'function') {
      try { onComplete(); } catch {}
    }
    return;
  }
  console.log('⭐ bounceStarIcon called, has callback:', !!onComplete);
  
  if (!HUD_ROOT || !HUD_ROOT._hudElements || !HUD_ROOT._hudElements.star) {
    console.warn('⚠️ bounceStarIcon: HUD_ROOT or star element not found');
    if (onComplete && typeof onComplete === 'function') {
      onComplete();
    }
    return;
  }
  
  const starElement = HUD_ROOT._hudElements.star;
  if (!starElement.container) {
    console.warn('⚠️ bounceStarIcon: star container not found');
    if (onComplete && typeof onComplete === 'function') {
      onComplete();
    }
    return;
  }
  
  // Pop in/out animation: scale up 30% then return to original (like stacking tile animation)
  // Triggered every time star count increases (n → n+1)
  // CRITICAL: Kill previous animation to ensure clean start for each bounce
  try {
    gsap.killTweensOf(starElement.container.scale);
    if (starElement.container._bounceTimeline) {
      try {
        starElement.container._bounceTimeline.kill();
      } catch {}
    }
  } catch {}
  
  console.log('⭐ Starting bounce animation (scale 30%)');
  
  const tl = trackTimeline({
    onComplete: () => {
      console.log('✅ Bounce animation timeline completed, calling callback');
      // Clean up timeline reference
      try {
        if (starElement.container) {
          starElement.container._bounceTimeline = null;
        }
      } catch {}
      
      // Call onComplete callback when animation finishes
      if (onComplete && typeof onComplete === 'function') {
        try {
          onComplete();
          console.log('✅ Bounce callback executed');
        } catch (err) {
          console.error('❌ Error in bounce callback:', err);
        }
      } else {
        console.warn('⚠️ No callback provided or callback is not a function');
      }
    }
  });
  
  // Store timeline reference for cleanup
  starElement.container._bounceTimeline = tl;
  
  // Pop in: scale up 30% (1.3x)
  tl.to(starElement.container.scale, { 
    x: 1.30, 
    y: 1.30, 
    duration: 0.08, 
    ease: 'power2.out' 
  });
  // Pop out: return to original size immediately
  tl.to(starElement.container.scale, { 
    x: 1.00, 
    y: 1.00, 
    duration: 0.15, 
    ease: 'back.out(1.7)' 
  });
  
  console.log('⭐ Star icon bounce animation triggered');
}

/**
 * Set stars count and update HUD display
 */
export function setStarsCount(count) {
  if (isArcadeHomeRunMode()) return;
  if (!starText) {
    console.warn('⚠️ starText not available, cannot set stars count');
    return;
  }
  
  const starsCount = Math.max(0, Math.floor(count || 0));
  starText.text = String(starsCount);
  console.log('⭐ Stars count updated to:', starsCount);
}
