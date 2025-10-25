// src/modules/app-boot.ts
import { Application, Container, Graphics, Rectangle, Assets } from 'pixi.js';
import { gsap } from 'gsap';
import { STATE, ASSET_TILE, ASSET_NUMBERS, ASSET_NUMBERS2, ASSET_NUMBERS3, ASSET_NUMBERS4, ASSET_WILD, TILE } from './app-state.js';
// layout function is now in app.js
import { installDrag } from './install-drag.js';
import { rebuildBoard } from './app-board.js';
import { merge, checkGameOver } from './merge-core.js';
import { logger } from '../core/logger.js';

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

  await Assets.load([ASSET_TILE, ASSET_NUMBERS, ASSET_NUMBERS2, ASSET_NUMBERS3, ASSET_NUMBERS4, ASSET_WILD]);
  await ensureFonts();

  const ret = installDrag({
    app: STATE.app!, board: STATE.board!, TILE,
    getTiles: () => STATE.tiles,
    cellXY, // Add cellXY function
    merge,
    canDrop: (s: unknown, d: unknown) => !(d as { locked?: boolean }).locked,
    hoverColor: 0x8a6e57,
    hoverWidth: 6,
    hoverAlpha: 0.18,
    threshold: 0.05,
  });
  STATE.drag = (ret && (ret as any).drag) ? (ret as any).drag : ret;

  startLevel(1);
  window.addEventListener('resize', layout);
}

export async function startLevel(n: number): Promise<void> {
  STATE.level = n; 
  STATE.score = 0; 
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
          if (typeof (window as WindowWithShowResumeGameModal).showResumeGameModal === 'function') {
            await (window as WindowWithShowResumeGameModal).showResumeGameModal!();
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
  
  rebuildBoard();       // builds + ring deal-in
  layout();
  setTimeout(() => checkGameOver(), 1000);
}

// Add cellXY function (needed by installDrag)
function cellXY(x: number, y: number): { x: number; y: number } {
  return { x, y };
}

// Add layout function (needed by window.addEventListener)
function layout(): void {
  // This function should be implemented in app.js
  // For now, we'll add a placeholder
  logger.info('Layout function called');
}

