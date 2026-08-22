// src/modules/install-drag.ts
// Postavlja globalni pointer capture + inicira drag manager uz stilizirani hover okvir.

import { Rectangle, Application, Container } from 'pixi.js';
import { initDrag } from './drag-core.ts';
import { GAP } from './constants.js';
import type { Tile } from '../types/game-types.js';
import { isWildLikeTile } from './final-merge-rules.ts';
import { isSpecialDiceMagnetLikeTile } from './special-dice-registry.ts';

const isVerboseGameplayLogsEnabled = () =>
  typeof window !== 'undefined' && (window as any).__ccVerboseGameplayLogs === true;

const dragDebugLog = (...args: any[]) => {
  if (isVerboseGameplayLogsEnabled()) console.log(...args);
};

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

  // Keep dragged dice in board-local scale while rendering above the Pixi HUD.
  // Reparenting directly to stage makes every legacy scale-to-1 animation huge,
  // because the gameplay board itself is scaled down for the viewport.
  const dragLayerParent = board.parent || app.stage;
  const dragLayer = new Container();
  dragLayer.label = 'GAMEPLAY_DRAG_OVERLAY';
  dragLayer.eventMode = 'none';
  dragLayer.interactive = false;
  dragLayer.interactiveChildren = false;
  dragLayer.sortableChildren = true;
  dragLayer.zIndex = 12_000;

  const syncDragLayerTransform = () => {
    dragLayer.position.copyFrom(board.position);
    dragLayer.scale.copyFrom(board.scale);
    dragLayer.pivot.copyFrom(board.pivot);
    dragLayer.skew.copyFrom(board.skew);
    dragLayer.rotation = board.rotation;
  };

  syncDragLayerTransform();
  if (dragLayerParent) {
    dragLayerParent.sortableChildren = true;
    dragLayerParent.addChild(dragLayer);
  }

  // 2) pokreni drag manager
  const drag = initDrag({
    app,
    board,
    dragLayer,
    syncDragLayer: syncDragLayerTransform,
    getTiles,
    getGrid, // Pass getGrid to drag manager
    tileSize: TILE,
    tileGap: GAP,
    cellXY, // Pass cellXY to drag manager
    onMerge: merge,
    canDrop: (src: Tile, dst: Tile) => {
      const tutorialCanDrop = (window as any).__ccFirstPlayTutorialCanDrop;
      if (typeof tutorialCanDrop === 'function' && tutorialCanDrop(src, dst) === false) {
        return false;
      }
      const baseCanDrop = canDrop ?? ((src: Tile, dst: Tile) => {
      if ((src as any)?._ccWildSpawnDropping === true || (dst as any)?._ccWildSpawnDropping === true) {
        dragDebugLog('🔥 canDrop: Incoming wild drop is not mergeable yet');
        return false;
      }
      dragDebugLog('🔥 canDrop check:', {
        src: (src as any)?.value,
        dst: (dst as any)?.value,
        locked: (dst as any)?.locked,
        srcSpecial: (src as any)?.special,
        dstSpecial: (dst as any)?.special
      });
      // CRITICAL: Check if destination is valid FIRST
      if (!dst || (dst as any).locked || ((dst as any).value | 0) <= 0) {
        dragDebugLog('🔥 canDrop: Invalid destination (null, locked, or value = 0)');
        return false;
      }
      const sv = (src && ((src as any).value | 0)) || 0;
      const dv = (dst && ((dst as any).value | 0)) || 0;

      // WILD-MAGNET LOGIC: Can go on anything except wild and wild-magnet, and anything can go on it
      const srcIsWildMagnet = isSpecialDiceMagnetLikeTile(src);
      const dstIsWildMagnet = isSpecialDiceMagnetLikeTile(dst);
      const srcIsWild = isWildLikeTile(src) && !srcIsWildMagnet;
      const dstIsWild = isWildLikeTile(dst) && !dstIsWildMagnet;

      if (srcIsWildMagnet) {
        // Wild-magnet cannot merge into wild or wild-magnet
        if (dstIsWild || dstIsWildMagnet) {
          dragDebugLog('🔥 Wild-magnet cannot merge into wild or wild-magnet');
          return false;
        }
        // CRITICAL: Check if destination is valid (not locked, has value > 0)
        if (!dst || (dst as any).locked || ((dst as any).value | 0) <= 0) {
          dragDebugLog('🔥 Wild-magnet cannot merge into invalid destination (locked or value = 0)');
          return false;
        }
        // Wild-magnet can merge into any normal tile
        dragDebugLog('🔥 Wild-magnet can merge into normal tile');
        return true;
      }

      if (dstIsWildMagnet) {
        // Any tile can merge into wild-magnet (except wild and wild-magnet)
        if (srcIsWild || srcIsWildMagnet) {
          dragDebugLog('🔥 Wild or wild-magnet cannot merge into wild-magnet');
          return false;
        }
        // Normal tiles can merge into wild-magnet
        dragDebugLog('🔥 Normal tile can merge into wild-magnet');
        return true;
      }

      const wild = (srcIsWild || dstIsWild);

      // WILD LOGIC: Direct wilds merge with any regular active tile.
      // They internally carry value 6, so comparing values makes regular 6 snap back.
      if (wild) {
        if (srcIsWild && dstIsWild) {
          dragDebugLog('🔥 Wild merge check (wild->wild): not allowed');
          return false;
        }
        if (srcIsWild && !dstIsWild) {
          return dv > 0 && !(dst as any)?.special;
        } else if (dstIsWild && !srcIsWild) {
          return sv > 0 && !(src as any)?.special;
        }
      }

      // NORMAL LOGIC: Regular merge rules
      if (!Number.isFinite(sv) || !Number.isFinite(dv)) return false;
      if (sv === dv) return (sv + dv) <= 6;  // allow same value only when sum<=6 (3+3 OK, 4+4 and 5+5 must snap back)
      const canMerge = (sv + dv) <= 6;    // allow different values that sum to 6 (e.g., 4+2, 2+4)
      dragDebugLog('🔥 canDrop result:', canMerge);
      return canMerge;
      });
      return baseCanDrop(src, dst);
    },

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
  const coreDragCleanup = typeof drag?.cleanup === 'function'
    ? drag.cleanup.bind(drag)
    : null;
  let cleaned = false;
  const cleanup = (options?: { resumeIdle?: boolean }) => {
    if (cleaned) return;
    cleaned = true;
    try { coreDragCleanup?.(options); } catch {}
    window.removeEventListener('resize', setHitArea);
    try { dragLayer.removeFromParent(); } catch {}
    try { dragLayer.destroy({ children: false }); } catch {}
  };

  // app-core retains the drag owner rather than this wrapper result, so its
  // established teardown call must also own the overlay and resize listener.
  drag.cleanup = cleanup;

  return { drag, cleanup };
}
