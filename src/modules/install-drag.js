// src/modules/install-drag.js
// Postavlja globalni pointer capture + inicira drag manager uz stilizirani hover okvir.

import { Rectangle } from 'pixi.js';
import { initDrag } from './drag-core.js';
import { GAP } from './constants.js';

/**
 * Instalira drag na stage i vrati { drag, cleanup }.
 *
 * @param {object} cfg
 * @param {import('pixi.js').Application} cfg.app
 * @param {import('pixi.js').Container}   cfg.board
 * @param {Function} cfg.getTiles   - () => Tile[]  (sve kockice)
 * @param {number}   cfg.TILE       - veličina kocke u px
 * @param {Function} cfg.merge      - (src, dst, helpers) => void
 * @param {Function} [cfg.canDrop]  - (src, dst) => boolean  (default: !dst.locked)
 *
 * @param {number}   [cfg.hoverColor=0x8a6e57] - boja okvira (0xRRGGBB)
 * @param {number}   [cfg.hoverWidth=4]        - debljina okvira u px (veće = deblje)
 * @param {number}   [cfg.hoverAlpha=0.15]     - prozirnost 0..1 (veće = vidljivije)
 * @param {number}   [cfg.threshold=0.05]      - traženi overlap (udio 0..1) za drop;
 *                                               manje = lakše dropati, više = strože
 */
export function installDrag({
  app,
  board,
  getTiles,
  getGrid, // Add getGrid function
  TILE,
  merge,
  canDrop,
  cellXY, // Add cellXY function

  // stil i logika dropa (možeš mijenjati po želji)
  hoverColor  = 0xFA6807,
  hoverWidth  = 8,
  hoverAlpha  = 1,
  threshold   = 0.05,
  hitPad      = 0.22,
  snapRadius  = 0.68,
}) {
  // 1) globalni capture pointera i ispravna hitArea
  app.stage.eventMode = 'static';
  const setHitArea = () => {
    app.stage.hitArea = new Rectangle(0, 0, app.renderer.width, app.renderer.height);
  };
  setHitArea();
  window.addEventListener('resize', setHitArea);

  // 2) pokreni drag manager
  const drag = initDrag({
  app,
  board,
  getTiles,
  getGrid, // Pass getGrid to drag manager
  tileSize: TILE,
  tileGap: GAP,
  cellXY, // Pass cellXY to drag manager
  onMerge: merge,
  canDrop: canDrop ?? ((src, dst) => {
    console.log('🔥 canDrop check:', { src: src?.value, dst: dst?.value, locked: dst?.locked, srcSpecial: src?.special, dstSpecial: dst?.special });
    if (!dst || dst.locked) return false;
    const sv = (src && (src.value|0)) || 0;
    const dv = (dst && (dst.value|0)) || 0;
    
    // WILD-MAGNET LOGIC: Can go on anything except wild and wild-magnet, and anything can go on it
    const srcIsWildMagnet = src?.special === 'wild-magnet';
    const dstIsWildMagnet = dst?.special === 'wild-magnet';
    const srcIsWild = src?.special === 'wild';
    const dstIsWild = dst?.special === 'wild';
    
    if (srcIsWildMagnet) {
      // Wild-magnet cannot merge into wild or wild-magnet
      if (dstIsWild || dstIsWildMagnet) {
        console.log('🔥 Wild-magnet cannot merge into wild or wild-magnet');
        return false;
      }
      // Wild-magnet can merge into any normal tile
      console.log('🔥 Wild-magnet can merge into normal tile');
      return true;
    }
    
    if (dstIsWildMagnet) {
      // Any tile can merge into wild-magnet (except wild and wild-magnet)
      if (srcIsWild || srcIsWildMagnet) {
        console.log('🔥 Wild or wild-magnet cannot merge into wild-magnet');
        return false;
      }
      // Normal tiles can merge into wild-magnet
      console.log('🔥 Normal tile can merge into wild-magnet');
      return true;
    }
    
    const wild = (srcIsWild || dstIsWild);
    
    // WILD LOGIC: Wild cube cannot merge into same value
    if (wild) {
      if (srcIsWild && !dstIsWild) {
        // Wild merging into normal tile - check if target value is different
        const canMerge = sv !== dv; // Wild cannot merge into same value as itself
        console.log('🔥 Wild merge check (wild->normal):', { wildValue: sv, targetValue: dv, canMerge });
        return canMerge;
      } else if (dstIsWild && !srcIsWild) {
        // Normal tile merging into wild - check if source value is different
        const canMerge = sv !== dv; // Normal cannot merge into wild of same value
        console.log('🔥 Wild merge check (normal->wild):', { sourceValue: sv, wildValue: dv, canMerge });
        return canMerge;
      } else if (srcIsWild && dstIsWild) {
        // Wild merging into wild - not allowed
        console.log('🔥 Wild merge check (wild->wild): not allowed');
        return false;
      }
    }
    
    // NORMAL LOGIC: Regular merge rules
    if (!Number.isFinite(sv) || !Number.isFinite(dv)) return false;
    if (sv === dv) return true;         // allow stacking equal values (e.g., 3+3)
    const canMerge = (sv + dv) <= 6;    // allow different values that sum to 6 (e.g., 4+2, 2+4)
    console.log('🔥 canDrop result:', canMerge);
    return canMerge;
  }),

  // ⬇️ STIL HOVER OKVIRA (vrati parametre umjesto hard‑codeda)
  hoverColor,
  hoverWidth,
  hoverAlpha,
  hoverRadius: Math.round(TILE * 0.26),
  hoverPad: 5,
  // logika dropa 
  threshold,
  // dodatno olakšaj mobitel drop bez mijenjanja ponašanja na desktopu
  hitPad,
  snapRadius,
});

  // 3) funkcija za čišćenje listenera (ako ćeš rušiti/obnavljati igru)
  const cleanup = () => {
    window.removeEventListener('resize', setHitArea);
  };

  return { drag, cleanup };
}
