/**
 * app-core-helpers.ts
 * 
 * Helper functions extracted from app-core.ts
 * These functions may depend on global state but are organized as helpers
 */

import { gsap } from 'gsap';
import { Assets } from 'pixi.js';
import { logger } from '../core/logger.js';
import { TILE } from './constants.js';

// ============================================================================
// TILE HELPER FUNCTIONS
// ============================================================================

/**
 * Tint locked tile (reduce alpha)
 */
export function tintLocked(t: any): void {
  try {
    gsap.to(t, { alpha: 0.35, duration: 0.10, ease: 'power1.out' });
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
 * Ensure fonts are loaded
 */
export async function ensureFonts(): Promise<void> {
  if ((ensureFonts as any)._done) return;
  const weights = [400, 500, 600, 700, 800];
  try {
    await Promise.all(weights.map(w => document.fonts.load(`${w} 16px "LTCrow"`)));
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
    comboIdleTimer?.kill?.();
    comboIdleTimer = null;
    console.log('🔥 Combo timer killed');
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
    comboIdleTimer?.kill?.();
  } catch {}
  
  comboIdleTimer = gsap.delayedCall(COMBO_IDLE_RESET_MS / 1000, () => {
    // COMBO DEFLATE ANIMATION: Deflate like balloon when combo is lost
    if (combo > 0) {
      console.log('💨 COMBO DEFLATE: Starting deflate animation for combo loss');
      try {
        // Animate combo text deflate
        if ((window as any).comboText) {
          gsap.to((window as any).comboText.scale, {
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
    
    hudResetCombo();
    updateHUD();
  });
  
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

