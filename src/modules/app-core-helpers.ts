/**
 * app-core-helpers.ts
 * 
 * Helper functions extracted from app-core.ts
 * These functions may depend on global state but are organized as helpers
 */

import { gsap } from 'gsap';
import animationManager from './animation-manager.js';
import { Assets } from 'pixi.js';
import { logger } from '../core/logger.js';
import { TILE } from './constants.js';

const trackTween = (target: any, vars: any) => animationManager.trackExternalTween(gsap.to(target, vars));
const isVerboseGameplayLogsEnabled = () => (typeof window !== 'undefined') && (window as any).__ccVerboseGameplayLogs === true;

// ============================================================================
// TILE HELPER FUNCTIONS
// ============================================================================

/**
 * Tint locked tile (reduce alpha)
 */
export function tintLocked(t: any): void {
  try {
    trackTween(t, { alpha: 0.35, duration: 0.10, ease: 'power1.out' });
  } catch {}
}

/**
 * Fix hover anchor point for tile
 */
export function fixHoverAnchor(t: any): void {
  try {
    if (t && t.hover) {
      t.hover.x = TILE / 2;
      t.hover.y = TILE / 2;
    }
  } catch {}
}

// ============================================================================
// ASSET LOADING HELPER FUNCTIONS
// ============================================================================

/**
 * Ensure Baloo2 font is loaded for Canvas/PIXI Text.
 * MUST be awaited before creating any HUD Text - otherwise numbers render as black boxes (tofu).
 * Called in boot() (early) and awaited in layoutBoard() before initHUD().
 */
export async function ensureFonts(): Promise<void> {
  if ((ensureFonts as any)._done) return;
  const weights = [400, 500, 600, 700, 800];
  try {
    await Promise.all(weights.map(w => document.fonts.load(`${w} 16px "Baloo2"`)));
  } catch {}
  (ensureFonts as any)._done = true;
}

/**
 * Try to load the first working texture from a list of candidates, with cache-busting attempts
 */
export async function loadFirstTexture(paths: string[]): Promise<string> {
  const attempts: string[] = [];
  const bust = Date.now();
  for (const p of paths) {
    if (!p) continue;
    attempts.push(p);
    if (!/\?/.test(p)) attempts.push(`${p}?bust=${bust}`);
  }
  for (const url of attempts) {
    try {
      const tex = await Assets.load(url);
      if (tex) return url;
    } catch {}
  }
  throw new Error('None of the asset candidates could be loaded: ' + attempts.join(', '));
}

// ============================================================================
// COMBO HELPER FUNCTIONS
// ============================================================================

/**
 * Kill combo timer
 */
export function killComboTimer(comboIdleTimer: any): any {
  try {
    if (comboIdleTimer) {
      // Check if it's a GSAP delayedCall (has kill method)
      if (typeof comboIdleTimer.kill === 'function') {
        comboIdleTimer.kill();
        if (isVerboseGameplayLogsEnabled()) {
          console.log('🔥 Combo timer killed (GSAP delayedCall)');
        }
      } 
      // Check if it's a setTimeout (number type)
      else if (typeof comboIdleTimer === 'number') {
        clearTimeout(comboIdleTimer);
        if (isVerboseGameplayLogsEnabled()) {
          console.log('🔥 Combo timer killed (setTimeout)');
        }
      }
      comboIdleTimer = null;
    }
  } catch (e) {
    console.warn('⚠️ Failed to kill combo timer:', e);
  }
  return comboIdleTimer;
}

/**
 * Schedule combo decay
 */
export function scheduleComboDecay(
  comboIdleTimer: any,
  COMBO_IDLE_RESET_MS: number,
  combo: number,
  hudResetCombo: () => void,
  updateHUD: () => void
): any {
  try {
    // Kill existing timer (supports both GSAP delayedCall and setTimeout)
    if (comboIdleTimer) {
      if (typeof comboIdleTimer.kill === 'function') {
        comboIdleTimer.kill();
      } else if (typeof comboIdleTimer === 'number') {
        clearTimeout(comboIdleTimer);
      }
    }
  } catch {}
  
  // 🔥 CRITICAL: Use setTimeout instead of gsap.delayedCall
  // This ensures combo timer works independently of gsap.globalTimeline.pause()
  // Combo timer should continue running even when bottom sheet is open
  const currentComboValue = combo;
  
  if (isVerboseGameplayLogsEnabled()) {
    console.log(`🔥 scheduleComboDecay: Setting timer for ${COMBO_IDLE_RESET_MS}ms, combo=${combo}`);
  }
  
  const timerId = setTimeout(() => {
    if (isVerboseGameplayLogsEnabled()) {
      console.log(`🔥 COMBO TIMER EXECUTED: Timer fired after ${COMBO_IDLE_RESET_MS}ms`);
    }
    // 🔥 CRITICAL: Get current combo value at execution time (not from closure)
    // This ensures we use the actual combo value when timer executes, not the value when timer was created
    const comboAtExecution = typeof (window as any).CC?.getCombo === 'function' 
      ? (window as any).CC.getCombo() 
      : currentComboValue;
    
    // COMBO DEFLATE ANIMATION: Deflate like balloon when combo is lost
    if (comboAtExecution > 0) {
      if (isVerboseGameplayLogsEnabled()) {
        console.log(`💨 COMBO DEFLATE: Starting deflate animation for combo loss (combo: ${comboAtExecution})`);
      }
      try {
        // Animate combo text deflate
        if ((window as any).comboText) {
          trackTween((window as any).comboText.scale, {
            x: 0.1, // Deflate to 10%
            y: 0.1,
            duration: 0.3,
            ease: 'power2.in',
            onComplete: () => {
              // Reset scale after deflate
              gsap.set((window as any).comboText.scale, { x: 1.0, y: 1.0 });
            }
          });
        }
      } catch (e) {
        console.warn('💨 COMBO DEFLATE: Animation failed:', e);
      }
    }
    
    // 🔥 CRITICAL: Only reset combo if it's still the same value (not incremented during timer)
    // This prevents resetting combo if user made a merge while timer was running
    const finalCombo = typeof (window as any).CC?.getCombo === 'function' 
      ? (window as any).CC.getCombo() 
      : currentComboValue;
    
    if (finalCombo === comboAtExecution && finalCombo > 0) {
      if (isVerboseGameplayLogsEnabled()) {
        console.log(`💨 COMBO DEFLATE: Resetting combo from ${finalCombo} to 0`);
      }
      hudResetCombo();
      updateHUD();
    } else {
      if (isVerboseGameplayLogsEnabled()) {
        console.log(`💨 COMBO DEFLATE: Skipping reset - combo changed from ${comboAtExecution} to ${finalCombo} (user made merge during timer)`);
      }
    }
  }, COMBO_IDLE_RESET_MS);
  
  if (isVerboseGameplayLogsEnabled()) {
    console.log(`🔥 scheduleComboDecay: Timer created with ID=${timerId}, type=${typeof timerId}`);
  }
  comboIdleTimer = timerId;
  
  return comboIdleTimer;
}

// ============================================================================
// HUD HELPER FUNCTIONS
// ============================================================================

/**
 * Set combo value (with clamping)
 */
export function hudSetCombo(
  v: number,
  COMBO_CAP: number,
  _setCombo?: (v: number) => void
): number {
  const combo = Math.max(0, Math.min(COMBO_CAP, v));
  try {
    _setCombo?.(combo);
  } catch {}
  return combo;
}

/**
 * Reset combo to 0
 */
export function hudResetCombo(_resetCombo?: () => void): void {
  try {
    _resetCombo?.();
  } catch {}
}

// Note: animateScore and animateBoardHUD remain in app-core.ts
// because they use complex callback logic with _animateScore, _animateBoard, HUD.animateScore, etc.

