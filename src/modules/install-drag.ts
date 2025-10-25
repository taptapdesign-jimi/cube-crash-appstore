// src/modules/install-drag.ts
// Postavlja globalni pointer capture + inicira drag manager uz stilizirani hover okvir.

import { Rectangle, Application, Container } from 'pixi.js';
import { initDrag } from './drag-core.js';
import { GAP } from './constants.js';
import { logger } from '../core/logger.js';

// Type definitions
interface Tile {
  value: number;
  locked: boolean;
  special?: string;
}

interface DragConfig {
  app: Application;
  board: Container;
  getTiles: () => Tile[];
  getGrid: () => (Tile | null)[][];
  TILE: number;
  merge: (src: Tile, dst: Tile, helpers: any) => void;
  canDrop?: (src: Tile, dst: Tile) => boolean;
  cellXY: (x: number, y: number) => { x: number; y: number };
  hoverColor?: number;
  hoverWidth?: number;
  hoverAlpha?: number;
  threshold?: number;
  hitPad?: number;
  snapRadius?: number;
}

interface DragResult {
  drag: any;
  cleanup: () => void;
}

/**
 * Instalira drag na stage i vrati { drag, cleanup }.
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
}: DragConfig): DragResult {
  // Check if app and stage exist
  if (!app || !app.stage) {
    logger.error('❌ Invalid app or stage in installDrag');
    return { destroy: () => {} };
  }
  
  // 1) globalni capture pointera i ispravna hitArea
  // app.stage.eventMode = 'static';
  const setHitArea = (): void => {
    if (app && app.stage && app.renderer) {
      app.stage.hitArea = new Rectangle(0, 0, app.renderer.width, app.renderer.height);
    }
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
  canDrop: canDrop ?? ((src: Tile, dst: Tile): boolean => {
    logger.info('🔥 canDrop check:', { src: src?.value, dst: dst?.value, locked: dst?.locked, srcSpecial: src?.special, dstSpecial: dst?.special });
    if (!dst || dst.locked) return false;
    const sv = (src && (src.value|0)) || 0;
    const dv = (dst && (dst.value|0)) || 0;
    const wild = (src?.special === 'wild' || dst?.special === 'wild');
    
    // WILD LOGIC: Wild cube cannot merge into same value
    if (wild) {
      if (src?.special === 'wild' && dst?.special !== 'wild') {
        // Wild merging into normal tile - check if target value is different
        const canMerge = sv !== dv; // Wild cannot merge into same value as itself
        logger.info('🔥 Wild merge check (wild->normal):', { wildValue: sv, targetValue: dv, canMerge });
        return canMerge;
      } else if (dst?.special === 'wild' && src?.special !== 'wild') {
        // Normal tile merging into wild - check if source value is different
        const canMerge = sv !== dv; // Normal cannot merge into wild of same value
        logger.info('🔥 Wild merge check (normal->wild):', { sourceValue: sv, wildValue: dv, canMerge });
        return canMerge;
      } else if (src?.special === 'wild' && dst?.special === 'wild') {
        // Wild merging into wild - not allowed
        logger.info('🔥 Wild merge check (wild->wild): not allowed');
        return false;
      }
    }
    
    // NORMAL LOGIC: Regular merge rules
    if (!Number.isFinite(sv) || !Number.isFinite(dv)) return false;
    if (sv === dv) return true;         // allow stacking equal values (e.g., 3+3)
    const canMerge = (sv + dv) <= 6;    // allow different values that sum to 6 (e.g., 4+2, 2+4)
    logger.info('🔥 canDrop result:', canMerge);
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
  const cleanup = (): void => {
    window.removeEventListener('resize', setHitArea);
  };

  return { drag, cleanup };
}
