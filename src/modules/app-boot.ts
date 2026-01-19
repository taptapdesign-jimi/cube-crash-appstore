// src/modules/app-boot.ts
import { Application, Container, Graphics, Rectangle, Assets } from 'pixi.js';
import { gsap } from 'gsap';
import { STATE, ASSET_TILE, ASSET_NUMBERS, ASSET_NUMBERS2, ASSET_NUMBERS3, ASSET_NUMBERS4, ASSET_WILD, ASSET_WILD_BEER, TILE } from './app-state.js';
// layout function is now in app.js
import { installDrag } from './install-drag.ts';
import { rebuildBoard } from './app-board.ts';
// 🔥 MRTVI IMPORT - merge from app-merge.ts is never used, app-core.ts has its own merge function
// import { merge } from './app-merge.ts';
import { logger } from '../core/logger.js';
import memoryManager from './memory-manager.ts';

// Types - Window interface is now defined in src/types/window.d.ts

interface GameState {
  timestamp: number;
  [key: string]: unknown;
}

// --- LTCrow font loader ---
async function ensureFonts(): Promise<void> {
  if ((ensureFonts as any)._done) return;
  try{ await Promise.all([400,500,600,700,800].map(w=>document.fonts.load(`${w} 16px "LTCrow"`))); }catch{}
  (ensureFonts as any)._done = true;
}

// GSAP safety (ignore tweens to destroyed targets)
const __orig_to = gsap.to.bind(gsap);
const __orig_ft = gsap.fromTo.bind(gsap);
const __orig_set = gsap.set.bind(gsap);
function __alive(target: any): boolean { 
  if(!target) return false; 
  if(Array.isArray(target)) return target.some((t: any) => t && !t.destroyed); 
  return !target.destroyed; 
}
gsap.to = (target: any, vars: any) => { 
  if(!__alive(target)) return { kill(){} }; 
  if(Array.isArray(target)) target = target.filter((t: any) => t && !t.destroyed); 
  try{ return __orig_to(target, vars); }catch{ return { kill(){} }; } 
};
gsap.fromTo = (target: any, a: any, b: any) => { 
  if(!__alive(target)) return { kill(){} }; 
  if(Array.isArray(target)) target = target.filter((t: any) => t && !t.destroyed); 
  try{ return __orig_ft(target,a,b); }catch{ return { kill(){} }; } 
};
gsap.set = (target: any, vars: any) => { 
  if(!__alive(target)) return; 
  if(Array.isArray(target)) target = target.filter((t: any) => t && !t.destroyed); 
  try{ return __orig_set(target, vars); }catch{} 
};

export async function boot(): Promise<void> {
  // 🔥 CRITICAL: Initialize memory manager (MEMORY LEAK FIX)
  console.log('🧹 Initializing memory manager...');
  memoryManager.init();
  console.log('✅ Memory manager initialized');
  
  STATE.app = new Application();
  await STATE.app.init({ resizeTo: window, backgroundAlpha: 0, antialias: true });
  const canvas = STATE.app.view as HTMLCanvasElement;
  document.getElementById('app')!.appendChild(canvas);
  canvas.style.touchAction = 'none';
  canvas.style.background = 'transparent';

  STATE.stage   = STATE.app.stage; STATE.stage!.sortableChildren = true;
  STATE.board   = new Container(); STATE.board!.sortableChildren = true;
  STATE.boardBG = new Graphics();
  STATE.divider = new Graphics();
  STATE.hud     = new Container(); STATE.hud!.eventMode = 'none';

  STATE.board!.zIndex = 100; STATE.divider!.zIndex = 9000; STATE.hud!.zIndex = 10000;
  STATE.stage!.addChild(STATE.board!, STATE.divider!, STATE.hud!);
  STATE.board!.addChildAt(STATE.boardBG!, 0); STATE.boardBG!.zIndex = -1000; STATE.board!.sortChildren();

  STATE.stage!.eventMode = 'static';
  
STATE.stage!.hitArea   = new Rectangle(0, 0, STATE.app!.renderer.width, STATE.app!.renderer.height);

  // 🔥 CRITICAL: ASSET_WILD_BEER MUST be loaded for wild-beer tiles to display correctly
  await Assets.load([ASSET_TILE, ASSET_NUMBERS, ASSET_NUMBERS2, ASSET_NUMBERS3, ASSET_NUMBERS4, ASSET_WILD, ASSET_WILD_BEER]);
  await ensureFonts();

  const ret = installDrag({
    app: STATE.app!, board: STATE.board!, TILE,
    getTiles: () => STATE.tiles,
    cellXY, // Add cellXY function
    merge,
    canDrop: (s: unknown, d: unknown) => {
      const dst = d as { locked?: boolean; value?: number };
      // CRITICAL: Check if destination is valid FIRST
      if (!dst || dst.locked || ((dst.value || 0) | 0) <= 0) {
        console.log('🔥 canDrop (app-boot): Invalid destination (null, locked, or value = 0)');
        return false;
      }
      // Basic check: destination is not locked
      return !dst.locked;
    },
    hoverColor: 0x8a6e57,
    hoverWidth: 6,
    hoverAlpha: 0.18,
    threshold: 0.05,
  });
  STATE.drag = (ret && (ret as any).drag) ? (ret as any).drag : ret;

  // CRITICAL: Don't auto-start level 1 here - let the calling code decide which level to start
  // This allows continueGameWithSavedState to start the correct level when resuming from completed board
  window.addEventListener('resize', layout);
}

export async function startLevel(n: number): Promise<void> {
  STATE.level = n; 
  
  // 🔥 JOURNEY BOARDS: Always reset score to 0 for each board (no accumulation)
  // Each board is independent with its own score tracking
  STATE.score = 0;
  
  // CRITICAL: Also sync to app-core.ts local score variable
  // This ensures both STATE.score and local score are in sync
  if (typeof (window as any).syncScoreToCore === 'function') {
    (window as any).syncScoreToCore(0);
  }
  
  console.log(`🎯 startLevel (app-boot): Reset score to 0 for board ${n} (no accumulation between boards)`);
  
  // Clear any preserved score flags
  delete (window as any).__ccResumeScore;
  delete (window as any).__ccPreserveScore;
  
  STATE.moves = 0; 
  STATE.busyEnding = false;
  STATE.wildGuaranteedOnce = false;
  (STATE as any).wildMeter = 0;
  
  // NOTE: Wild meter reset is handled by restart functions, not here
  
  // Check for saved game on first level start
  if (n === 1) {
    const hasSavedGame = localStorage.getItem('cc_saved_game');
    if (hasSavedGame) {
      try {
        const gameState: GameState = JSON.parse(hasSavedGame);
        const saveAge = Date.now() - gameState.timestamp;
        if (saveAge < 24 * 60 * 60 * 1000) { // Less than 24 hours old
          logger.info('🎮 Found saved game, showing resume modal...');
          if (typeof (window as any).showResumeGameModal === 'function') {
            await (window as any).showResumeGameModal();
            return; // Modal will handle loading or starting new game
          }
        } else {
          logger.info('⚠️ Saved game is too old, removing...');
          localStorage.removeItem('cc_saved_game');
        }
      } catch (error) {
        logger.warn('⚠️ Corrupted save file, removing...', error);
        localStorage.removeItem('cc_saved_game');
      }
    }
  }
  
  // 🔥 CRITICAL FIX: Skip rebuildBoard if loading saved state
  // This prevents creating an empty board before loadGameState restores tiles
  const skipRebuild = (window as any).__ccSkipRebuildBoard;
  if (skipRebuild) {
    console.log('🎯 Skipping rebuildBoard() in app-boot - will load saved state instead');
    delete (window as any).__ccSkipRebuildBoard;
  } else {
    rebuildBoard();       // builds + ring deal-in
  }
  layoutBoot();
  
  // 🔥 REMOVED: checkGameOver() call after startLevel - DEPRECATED
  // End game checks are now handled by checkLevelEnd() in app-core.ts which uses
  // the centralized endgame-checker.ts system. This old checkGameOver call
  // could potentially trigger the deprecated "Level Complete" overlay.
  // setTimeout(() => checkGameOver(), 1000);
}

// Add cellXY function (needed by installDrag)
function cellXY(x: number, y: number): { x: number; y: number } {
  return { x, y };
}

// Add layout function (needed by window.addEventListener)
// 🔥 REFACTORED: Preimenovano za jasnoću - ovo je placeholder, poziva layoutBoard iz app-core.ts
function layoutBoot(): void {
  // This function should be implemented in app.js
  // For now, we'll add a placeholder
  logger.info('Layout function called');
}
