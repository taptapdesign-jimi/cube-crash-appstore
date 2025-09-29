// src/modules/powerups.js
// Lightweight helpers for Wild + refill decisions, UI-agnostic.
// This file DOES NOT touch your UI/animations. You only call the helpers
// from your existing merge/refill code.

/**
 * Minimal state holder you can keep in your app.js:
 *   import * as powerups from './powerups.js';
 *   const powState = powerups.createState();
 */
export function createState() {
  return {
    wildGuaranteedOnce: false,  // first 6-merge unlocks a guaranteed Wild
    wildGuaranteePending: false // next refill should force exactly one Wild
  };
}

/** Mark that the next refill should include one guaranteed Wild. */
export function scheduleWildGuarantee(state) {
  if (!state) return;
  state.wildGuaranteePending = true;
  state.wildGuaranteedOnce = true;
}

/**
 * Decide HOW MANY tiles to open after events (you can ignore if you already decided this elsewhere).
 * Returns a number (how many to open). Use it for Endless-style refills.
 */
export function decideRefillCount({ event = "smallMerge", stackDepth = 1 } = {}) {
  if (event === "smallMerge") return 1; // open 1 tile after 2..5 merge
  if (event === "sixMerge") {
    // depth 1..4 -> 1,1,2,3 new tiles
    const table = [1, 1, 2, 3];
    const idx = Math.max(1, Math.min(4, stackDepth)) - 1;
    return table[idx];
  }
  return 0;
}

/**
 * Tag a batch of freshly opened tiles with Wild (special) according to rules.
 * - If state.wildGuaranteePending === true → force exactly ONE tile to be Wild, then clear the flag.
 * - Others become Wild randomly by chance (0..1). Pass your chance from constants (e.g. 0.05).
 * Note: This only tags the tile data (tile.special = 'wild'). For visuals, call applyWildSkin(tile, Assets, ASSET_WILD).
 */
export function tagRefillTilesAsWild(tiles, { state, chance = 0.0 } = {}) {
  if (!Array.isArray(tiles) || tiles.length === 0) return 0;
  let forced = (state && state.wildGuaranteePending) ? 1 : 0;
  let made = 0;

  // consume the guarantee (applies only to this batch)
  if (state) state.wildGuaranteePending = false;

  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    if (!t) continue;

    const makeWild = forced > 0 ? true : (Math.random() < chance);
    if (makeWild) {
      t.special = 'wild';
      made++;
      if (forced > 0) forced--;
    }
  }
  return made;
}

/** Simple predicate */
export function isWild(tile) {
  return !!(tile && tile.special === 'wild');
}

/**
 * Visuals: swap face to your Wild PNG and hide numbers/pips layers if present.
 * Call this right AFTER you assign tile.special = 'wild' and right AFTER setValue(...).
 *
 * Usage:
 *   import { applyWildSkin } from './powerups.js';
 *   applyWildSkin(tile, Assets, ASSET_WILD);
 */
export function applyWildSkin(tile, Assets, ASSET_WILD) {
  if (!tile) return;
  try {
    const tex = Assets.get(ASSET_WILD);
    const host = tile.rotG || tile;
    const base = tile.base || (host.children && host.children.find(c => c.texture)) || null;
    if (tex && base && base.texture) {
      base.texture = tex;
      base.tint = 0xFFFFFF;
      base.alpha = 1;
    }
    if (tile.num)  tile.num.visible  = false;
    if (tile.pips) tile.pips.visible = false;
    tile.isWildFace = true;
  } catch (e) {
    // silent
  }
}

/**
 * Ensure that any subsequent logic (like setValue drawing) didn't re-enable numbers/pips.
 * Safe to call after setValue(...) and before showing the tile.
 */
export function ensureWildIntegrity(tile, Assets, ASSET_WILD) {
  if (!isWild(tile)) return;
  applyWildSkin(tile, Assets, ASSET_WILD);
}

export default {
  createState,
  scheduleWildGuarantee,
  decideRefillCount,
  tagRefillTilesAsWild,
  isWild,
  applyWildSkin,
  ensureWildIntegrity,
};
