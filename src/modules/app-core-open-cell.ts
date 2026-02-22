import { preloadTntFrames } from './tnt-animation.ts';

type OpenCellDeps = {
  c: number;
  r: number;
  options?: {
    value?: number | null;
    isWild?: boolean;
    isWildMagnet?: boolean;
    isWildBeer?: boolean;
    isWildTnt?: boolean;
    skipBind?: boolean;
    timeScale?: number;
  };
  grid: any[][];
  board: any;
  tiles: any[];
  makeBoard: { createTile: (args: any) => any; setValue: (tile: any, value: number, delay?: number) => void };
  devWarn: (...args: any[]) => void;
  bindTileWithFallback: (tile: any, skipBind: boolean) => void;
  applyWildSkinLocal: (tile: any) => void;
  startWildShimmer: (tile: any) => void;
  startWildBeerBubbles: (tile: any) => void;
  startWildStars: (tile: any) => void;
  startTntIdleParticles: (tile: any) => void;
  startTntIdleShake: (tile: any) => void;
  SPAWN: { spawnBounce: (tile: any, gsap: any, opts: any, onComplete?: () => void) => void };
  gsap: any;
};

export function openAtCellCore({
  c,
  r,
  options,
  grid,
  board,
  tiles,
  makeBoard,
  devWarn,
  bindTileWithFallback,
  applyWildSkinLocal,
  startWildShimmer,
  startWildBeerBubbles,
  startWildStars,
  startTntIdleParticles,
  startTntIdleShake,
  SPAWN,
  gsap,
}: OpenCellDeps){
  const {
    value = null,
    isWild = false,
    isWildMagnet = false,
    isWildBeer = false,
    isWildTnt = false,
    skipBind = false,
    timeScale = 1.0,
  } = options || {};
  return new Promise((resolve) => {
    // Re-read from grid so we never spawn on a cell that was updated by another spawn (e.g. merge-6)
    let holder = grid?.[r]?.[c] || null;
    // 🔥 RACE FIX: If holder was destroyed (e.g. by magnet pull), treat as empty
    if (holder && (holder as any).destroyed) holder = null;

    // 🔥 CRITICAL: Never spawn wild/normal on an active tile or wild tile.
    // Check value and wild first — even locked tiles with value > 0 must be skipped.
    if (holder) {
      const isWildTile = holder.special === 'wild' || holder.special === 'wild-magnet' || holder.special === 'wild-beer' || holder.special === 'wild-tnt' || holder.isWild === true || holder.isWildFace === true;
      const hasValue = (holder.value | 0) > 0;

      if (hasValue || isWildTile) {
        devWarn('⚠️ openAtCell: Cell already occupied by active/wild tile – refusing to spawn:', {
          c, r,
          holderValue: holder.value,
          holderSpecial: holder.special,
          holderLocked: holder.locked,
          hasValue,
          isWildTile,
        });
        resolve(false);
        return;
      }

      if (!holder.locked) {
        devWarn('⚠️ openAtCell: Cell has unlocked holder (should be ghost only):', {
          c, r,
          holderValue: holder.value,
          holderSpecial: holder.special,
          holderLocked: holder.locked,
        });
        resolve(false);
        return;
      }
    }

    // Double-check: re-read grid in case of race with another spawn
    holder = grid?.[r]?.[c] || null;
    if (holder && (holder as any).destroyed) holder = null;
    if (holder) {
      const isWildTile = holder.special === 'wild' || holder.special === 'wild-magnet' || holder.special === 'wild-beer' || holder.special === 'wild-tnt' || holder.isWild === true || holder.isWildFace === true;
      const hasValue = (holder.value | 0) > 0;
      if (hasValue || isWildTile || !holder.locked) {
        resolve(false);
        return;
      }
    }

    // Wild spawn: prefer existing ghost placeholder; in end game cell can be null — create tile then apply wild
    if ((isWild || isWildMagnet || isWildBeer || isWildTnt) && !holder) {
      holder = makeBoard.createTile({ board, grid, tiles, c, r, val: 0, locked: true });
    }
    if (!holder) holder = makeBoard.createTile({ board, grid, tiles, c, r, val: 0, locked: true });

    holder.locked = false;
    holder.eventMode = 'static';
    holder.cursor = 'pointer';
    bindTileWithFallback(holder, skipBind);
    
    // 🔥 CRITICAL FIX: Clear magnet flags from holder before spawning
    // This prevents spawned tiles from inheriting flags from previous magnet pull
    delete holder._wildMagnetAffected;
    delete holder._wildMagnetOriginalX;
    delete holder._wildMagnetOriginalY;
    delete holder._mergeTriggered75;
    delete holder._skipIdleScaleReset;
    delete holder._wildMagnetMergeCallback;
    delete holder._wildMagnetPulledTilesMerge;
    delete holder._wildMagnetPulledTilesScoring;

    if (isWild || isWildMagnet || isWildBeer || isWildTnt){
      if (isWildTnt) {
        try { preloadTntFrames(); } catch {}
      }
      // 🔥 CRITICAL: Set special BEFORE setValue to ensure correct texture is applied
      holder.special = isWildTnt ? 'wild-tnt' : (isWildBeer ? 'wild-beer' : (isWildMagnet ? 'wild-magnet' : 'wild'));
      holder.isWild = true;
      holder.isWildFace = true;
      holder.value = 6;
      // 🔥 RACE FIX: Skip if holder was destroyed (e.g. by concurrent magnet pull)
      if ((holder as any).destroyed) {
        devWarn('⚠️ openAtCell: Holder destroyed before setValue (race with merge?)', { c, r });
        resolve(false);
        return;
      }
      makeBoard.setValue(holder, 6, 0);
      if ((holder as any).destroyed) {
        devWarn('⚠️ openAtCell: Holder destroyed after setValue (wild)', { c, r });
        resolve(false);
        return;
      }
      // Always use applyWildSkinLocal to ensure correct texture is applied (double-check)
      applyWildSkinLocal(holder);
      // Wild tiles are ALWAYS active/full opacity
      holder.locked = false;
      holder.eventMode = 'static';
      holder.cursor = 'pointer';
      try { gsap?.killTweensOf?.(holder, true); } catch {}
      try { if (holder.base) gsap?.killTweensOf?.(holder.base, true); } catch {}
      holder.alpha = 1;
      if (holder.rotG) holder.rotG.alpha = 1;
      if (holder.base) holder.base.alpha = 1;
      if (holder.overlay) { holder.overlay.alpha = 1; holder.overlay.visible = false; }
      if (holder.num) holder.num.alpha = 1;
      if (holder.pips) holder.pips.alpha = 1;
      try {
        startWildShimmer(holder); // Use shimmer instead of bounce
        // Orbitirajuće zvjezdice SAMO za wild zvjezdicu (special === 'wild'); nikad za drugi wild
        if (holder.special === 'wild-beer') {
          startWildBeerBubbles(holder);
        } else if (holder.special === 'wild-tnt') {
          startTntIdleParticles(holder);
          startTntIdleShake(holder);
        } else if (holder.special === 'wild') {
          startWildStars(holder);
        }
      } catch {}
    } else {
      if ((holder as any).destroyed) {
        devWarn('⚠️ openAtCell: Holder destroyed before setValue (race with merge?)', { c, r });
        resolve(false);
        return;
      }
      const v = (value == null) ? [1, 2, 3, 4, 5][(Math.random() * 5) | 0] : value;
      makeBoard.setValue(holder, v, 0);
      if ((holder as any).destroyed || (holder.value | 0) <= 0) {
        devWarn('⚠️ openAtCell: Holder destroyed or invalid after setValue', { c, r, value: holder?.value });
        resolve(false);
        return;
      }
    }

    holder.visible = true;
    const isWildSpawn = isWild || isWildMagnet || isWildBeer || isWildTnt;
    const isActiveTile = !isWildSpawn;
    if (isActiveTile || isWildSpawn) {
      try { gsap?.killTweensOf?.(holder, true); } catch {}
      try { if (holder.base) gsap?.killTweensOf?.(holder.base, true); } catch {}
      if (holder.rotG) holder.rotG.alpha = 1;
      if (holder.base) holder.base.alpha = 1;
      if (holder.overlay) { holder.overlay.alpha = 1; holder.overlay.visible = false; }
      if (holder.num) holder.num.alpha = 1;
      if (holder.pips) holder.pips.alpha = 1;
      holder.alpha = 1;
    } else {
      holder.alpha = 0;
    }
    SPAWN.spawnBounce(holder, gsap, { max: 1.08, compress: 0.96, rebound: 1.02, startScale: 0.30, wiggle: 0.035, fadeIn: 0.10, timeScale: timeScale, keepFullOpacity: isActiveTile || isWildSpawn }, () => {
      if ((holder as any).destroyed) {
        devWarn('⚠️ openAtCell: Holder destroyed during spawnBounce', { c, r });
        resolve(false);
        return;
      }
      if (isActiveTile || isWildSpawn) {
        try { gsap?.killTweensOf?.(holder, true); } catch {}
        try { if (holder.base) gsap?.killTweensOf?.(holder.base, true); } catch {}
        holder.alpha = 1;
        if (holder.rotG) holder.rotG.alpha = 1;
        if (holder.base) holder.base.alpha = 1;
        if (holder.overlay) { holder.overlay.alpha = 1; holder.overlay.visible = false; }
        if (holder.num) holder.num.alpha = 1;
        if (holder.pips) holder.pips.alpha = 1;
      } else {
        holder.alpha = 1;
      }
      resolve(true);
    });
  });
}
