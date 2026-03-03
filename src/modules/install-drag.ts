// src/modules/install-drag.ts
// Postavlja globalni pointer capture + inicira drag manager uz stilizirani hover okvir.

import { Rectangle, Application, Container } from 'pixi.js';
import { initDrag } from './drag-core.ts';
import { GAP } from './constants.js';
import type { Tile } from '../types/game-types.js';

interface InstallDragConfig {
  app: Application;
  board: Container;
  getTiles: () => Tile[];
  getGrid?: () => any[][];
  TILE: number;
  merge: (src: Tile, dst: Tile, helpers: any) => void;
  canDrop?: (src: Tile, dst: Tile) => boolean;
  cellXY?: (c: number, r: number) => { x: number; y: number };
  hoverColor?: number;
  hoverWidth?: number;
  hoverAlpha?: number;
  threshold?: number;
  hitPad?: number;
  snapRadius?: number;
}

interface InstallDragResult {
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
  getGrid,
  TILE,
  merge,
  canDrop,
  cellXY,

  // stil i logika dropa (možeš mijenjati po želji)
  hoverColor = 0xFA6807,
  hoverWidth = 8,
  hoverAlpha = 1,
  threshold = 0.05,
  hitPad = 0.22,
  snapRadius = 0.68,
}: InstallDragConfig): InstallDragResult {
  // 1) globalni capture pointera i ispravna hitArea
  app.stage.eventMode = 'static';
  const setHitArea = () => {
    const renderer = app.renderer;
    if (!renderer) return;
    app.stage.hitArea = new Rectangle(0, 0, renderer.width, renderer.height);
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
    canDrop: canDrop ?? ((src: Tile, dst: Tile) => {
      console.log('🔥 canDrop check:', {
        src: (src as any)?.value,
        dst: (dst as any)?.value,
        locked: (dst as any)?.locked,
        srcSpecial: (src as any)?.special,
        dstSpecial: (dst as any)?.special
      });
      // CRITICAL: Check if destination is valid FIRST
      if (!dst || (dst as any).locked || ((dst as any).value | 0) <= 0) {
        console.log('🔥 canDrop: Invalid destination (null, locked, or value = 0)');
        return false;
      }
      const sv = (src && ((src as any).value | 0)) || 0;
      const dv = (dst && ((dst as any).value | 0)) || 0;

      // WILD-MAGNET LOGIC: Can go on anything except wild and wild-magnet, and anything can go on it
      const srcIsWildMagnet = (src as any)?.special === 'wild-magnet';
      const dstIsWildMagnet = (dst as any)?.special === 'wild-magnet';
      const srcIsWild = (src as any)?.special === 'wild' || (src as any)?.special === 'wild-juice' || (src as any)?.special === 'wild-tnt';
      const dstIsWild = (dst as any)?.special === 'wild' || (dst as any)?.special === 'wild-juice' || (dst as any)?.special === 'wild-tnt';

      if (srcIsWildMagnet) {
        // Wild-magnet cannot merge into wild or wild-magnet
        if (dstIsWild || dstIsWildMagnet) {
          console.log('🔥 Wild-magnet cannot merge into wild or wild-magnet');
          return false;
        }
        // CRITICAL: Check if destination is valid (not locked, has value > 0)
        if (!dst || (dst as any).locked || ((dst as any).value | 0) <= 0) {
          console.log('🔥 Wild-magnet cannot merge into invalid destination (locked or value = 0)');
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
      if (sv === dv) return (sv + dv) <= 6;  // allow same value only when sum<=6 (3+3 OK, 4+4 and 5+5 must snap back)
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

