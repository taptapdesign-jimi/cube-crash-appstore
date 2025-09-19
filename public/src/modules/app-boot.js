// src/modules/app-boot.js
import { Application, Container, Graphics, Rectangle, Assets } from 'pixi.js';
import { gsap } from 'gsap';
import { STATE, ASSET_TILE, ASSET_NUMBERS, ASSET_NUMBERS2, ASSET_NUMBERS3, ASSET_WILD, TILE } from './app-state.js';
// layout function is now in app.js
import { installDrag } from './install-drag.js';
import { rebuildBoard } from './app-board.js';
import { merge, checkGameOver } from './app-merge.js';

// --- LTCrow font loader ---
async function ensureFonts(){
  if (ensureFonts._done) return;
  try{ await Promise.all([400,500,600,700,800].map(w=>document.fonts.load(`${w} 16px "LTCrow"`))); }catch{}
  ensureFonts._done = true;
}

// GSAP safety (ignore tweens to destroyed targets)
const __orig_to = gsap.to.bind(gsap);
const __orig_ft = gsap.fromTo.bind(gsap);
const __orig_set = gsap.set.bind(gsap);
function __alive(target){ if(!target) return false; if(Array.isArray(target)) return target.some(t=>t && !t.destroyed); return !target.destroyed; }
gsap.to = (target, vars)=>{ if(!__alive(target)) return { kill(){} }; if(Array.isArray(target)) target = target.filter(t => t && !t.destroyed); try{ return __orig_to(target, vars); }catch{ return { kill(){} }; } };
gsap.fromTo = (target,a,b)=>{ if(!__alive(target)) return { kill(){} }; if(Array.isArray(target)) target = target.filter(t => t && !t.destroyed); try{ return __orig_ft(target,a,b); }catch{ return { kill(){} }; } };
gsap.set = (target, vars)=>{ if(!__alive(target)) return; if(Array.isArray(target)) target = target.filter(t => t && !t.destroyed); try{ return __orig_set(target, vars); }catch{} };

export async function boot(){
  STATE.app = new Application();
  await STATE.app.init({ resizeTo: window, background: 0xF5F5F5, antialias: true });
  document.getElementById('app').appendChild(STATE.app.canvas);
  STATE.app.canvas.style.touchAction = 'none';

  STATE.stage   = STATE.app.stage; STATE.stage.sortableChildren = true;
  STATE.board   = new Container(); STATE.board.sortableChildren = true;
  STATE.boardBG = new Graphics();
  STATE.divider = new Graphics();
  STATE.hud     = new Container(); STATE.hud.eventMode = 'none';

  STATE.board.zIndex = 100; STATE.divider.zIndex = 9000; STATE.hud.zIndex = 10000;
  STATE.stage.addChild(STATE.board, STATE.divider, STATE.hud);
  STATE.board.addChildAt(STATE.boardBG, 0); STATE.boardBG.zIndex = -1000; STATE.board.sortChildren();

  STATE.stage.eventMode = 'static';
  STATE.stage.hitArea   = new Rectangle(0, 0, STATE.app.renderer.width, STATE.app.renderer.height);

  await Assets.load([ASSET_TILE, ASSET_NUMBERS, ASSET_NUMBERS2, ASSET_NUMBERS3, ASSET_WILD]);
  await ensureFonts();

  const ret = installDrag({
    app: STATE.app, board: STATE.board, TILE,
    getTiles: () => STATE.tiles,
    merge,
    canDrop: (s, d) => !d.locked,
    hoverColor: 0x8a6e57,
    hoverWidth: 6,
    hoverAlpha: 0.18,
    threshold: 0.05,
  });
  STATE.drag = (ret && ret.drag) ? ret.drag : ret;

  startLevel(1);
  window.addEventListener('resize', layout);
}

export function startLevel(n){
  STATE.level=n; STATE.score=0; STATE.moves=0; STATE.busyEnding=false;
  STATE.wildGuaranteedOnce = false;
  STATE.wildMeter = 0;
  
  // NOTE: Wild meter reset is handled by restart functions, not here
  
  rebuildBoard();       // builds + ring deal-in
  layout();
  setTimeout(()=> checkGameOver(), 1000);
}
