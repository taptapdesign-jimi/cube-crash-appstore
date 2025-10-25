// public/src/modules/center-celebration.ts
// CLEAN BOARD — grid-aligned, 2 reda, jedan znak po tile-u (tile.png bez pipsa)
// Vraća Promise tek nakon što intro+hold+outro završe i layer se očisti.

import { Container, Sprite, Assets, Text, Graphics, Application, Texture } from 'pixi.js';
import { gsap } from 'gsap';
import { ASSET_TILE } from './constants.js';

// Types
interface Stage extends Container {
  children?: Container[];
  sortChildren?: () => void;
  removeChild?: (child: Container) => void;
  addChild?: (child: Container) => void;
}

interface Board extends Container {
  x?: number;
  y?: number;
  scale?: { x: number; y: number };
}

interface App extends Application {
  renderer: {
    width: number;
    height: number;
  };
}

interface LetterTile extends Container {
  x: number;
  y: number;
  scale: { x: number; y: number; set: (x: number, y: number) => void };
}

interface ShowCleanBoardCelebrationParams {
  stage?: Stage;
  app?: App;
  board?: Board;
  TILE?: number;
  GAP?: number;
  ROWS?: number;
  COLS?: number;
  LAYER_NAME?: string;
  holdMs?: number;
}

export const __CC_CELEB_VERSION = 'clean-grid-v5-resp';

function ensureLayer(stage: Stage, name: string): Container {
  let layer = stage.children?.find?.(c => c && (c as any).label === name);
  if (!layer || layer.destroyed){
    layer = new Container();
    (layer as any).label = name;
    layer.zIndex = 14000;
    layer.eventMode = 'none';
    stage.addChild?.(layer);
    try { stage.sortChildren?.(); } catch {}
  }
  layer.visible = true;
  return layer;
}

function roundRectTile(TILE: number, radius: number = 0.22): Graphics {
  const g = new Graphics();
  g.roundRect(-TILE/2, -TILE/2, TILE, TILE, Math.round(TILE*radius)).fill(0xFFFFFF);
  return g;
}

// center-out order helper: e.g. 5 -> [2,1,3,0,4], 4 -> [1,2,0,3]
function centerOrder(n: number): number[] {
  const midL = Math.floor((n-1)/2);
  const midR = Math.ceil((n-1)/2);
  const order: number[] = [];
  let L = midL, R = midR;
  const used = new Set<number>();
  while (order.length < n){
    if (!used.has(L) && L >= 0){ order.push(L); used.add(L); }
    if (!used.has(R) && R < n){ order.push(R); used.add(R); }
    L--; R++;
  }
  return order;
}

export async function showCleanBoardCelebration({
  stage, app, board,
  TILE = 128, GAP = 20, ROWS = 8, COLS = 5,
  LAYER_NAME = 'cc-center-celebration-layer',
  holdMs = 1200
}: ShowCleanBoardCelebrationParams = {}): Promise<void> {

  if (!stage || !app || !board) return;

  // Kill any previous celebration layer (defensive)
  try {
    const old = stage.children?.find?.(c => c && (c as any).label === LAYER_NAME);
    if (old){ 
      try { 
        stage.removeChild?.(old); 
        (old as any).destroy?.({children:true}); 
      } catch{} 
    }
  } catch {}

  // Overlay
  const layer = ensureLayer(stage, LAYER_NAME);
  layer.removeChildren();
  const group = new Container();
  layer.addChild(group);

  // responsive binding to board
  const boardW = COLS * TILE + (COLS - 1) * GAP;
  const boardH = ROWS * TILE + (ROWS - 1) * GAP;
  function syncToBoard(): void {
    const vw = app.renderer.width, vh = app.renderer.height;
    const sFromBoard = (board && board.scale && board.scale.x) ? board.scale.x : 1;
    const fallbackS  = Math.min(vw / boardW, vh / boardH);
    const s = Number.isFinite(sFromBoard) && sFromBoard > 0 ? sFromBoard : fallbackS;
    group.scale.set(s);
    group.x = board?.x ?? Math.round((vw - boardW * s) / 2);
    group.y = board?.y ?? Math.round((vh - boardH * s) / 2);
  }
  syncToBoard();
  const __onResize = () => syncToBoard();
  window.addEventListener('resize', __onResize);

  // two rows
  const msgTop = 'CLEAN'.split('');
  const msgBot = 'BOARD'.split('');

  const rowTop    = Math.max(0, Math.floor(ROWS/2) - 1);
  const rowBottom = Math.min(ROWS - 1, rowTop + 1);

  const cellW = TILE + GAP;
  const cellH = TILE + GAP;

  const startColTop = Math.max(0, Math.floor((COLS - msgTop.length) / 2));
  const startColBot = Math.max(0, Math.floor((COLS - msgBot.length) / 2));

  // tile texture (no pips)
  const tileTex = Assets.get(ASSET_TILE) || await Assets.load(ASSET_TILE);

  const makeLetterTile = (ch: string, gridC: number, gridR: number, tint: number, fontSizeMul: number = 0.56): LetterTile => {
    const tile = new Container() as LetterTile;
    tile.x = gridC * cellW + TILE/2;
    tile.y = gridR * cellH + TILE/2;
    tile.scale.set(0, 0);

    const bg = new Sprite(tileTex);
    bg.anchor.set(0.5); 
    bg.width = TILE; 
    bg.height = TILE;

    const shade = roundRectTile(TILE, 0.18);
    shade.alpha = 0.04;

    const txt = new Text({
      text: ch,
      style: {
        fontFamily: 'LTCrow',
        fontWeight: '800',
        fontSize: Math.round(TILE * fontSizeMul),
        fill: tint,
        align: 'center'
      }
    });
    txt.anchor.set(0.5);

    tile.addChild(bg, shade, txt);
    group.addChild(tile);
    return tile;
  };

  const topColor = 0x5C4A3D;
  const botColor = 0xB56B2B;

  const topTiles = msgTop.map((ch, i) =>
    makeLetterTile(ch, startColTop + i, rowTop, topColor));
  const botTiles = msgBot.map((ch, i) =>
    makeLetterTile(ch, startColBot + i, rowBottom, botColor));

  const allTiles = [...topTiles, ...botTiles];

  // quick shake
  try {
    const gx = group.x, gy = group.y;
    const tlShake = gsap.timeline();
    tlShake.to(group, { x: gx + 10, duration: 0.05 })
           .to(group, { x: gx - 10, duration: 0.07 })
           .to(group, { x: gx,      duration: 0.08 });
  } catch {}

  // MIRROR INTRO — center-out, brzi "back.out" (4× brže od outra)
  await new Promise<void>(res => {
    const tl = gsap.timeline({ onComplete: res });
    const orderTop = centerOrder(topTiles.length);
    const orderBot = centerOrder(botTiles.length);
    const stagger = 0.02;
    orderTop.forEach((idx, k) => {
      tl.fromTo(topTiles[idx].scale, { x:0, y:0 }, { x:1, y:1, duration:0.10, ease:'back.out(1.3)' }, k*stagger);
    });
    orderBot.forEach((idx, k) => {
      tl.fromTo(botTiles[idx].scale, { x:0, y:0 }, { x:1, y:1, duration:0.10, ease:'back.out(1.3)' }, k*stagger);
    });
  });

  // Fade-in layer
  layer.alpha = 0;
  await new Promise<void>(r => gsap.to(layer, { alpha:1, duration:0.20, onComplete:r }));

  // Hold
  await new Promise<void>(r => setTimeout(r, holdMs));

  // MIRROR OUTRO — center-out ista putanja, ali "back.in"
  await new Promise<void>(res => {
    const tl = gsap.timeline({ onComplete: res });
    const orderTop = centerOrder(topTiles.length);
    const orderBot = centerOrder(botTiles.length);
    const stagger = 0.03;
    orderTop.forEach((idx, k) => {
      tl.to(topTiles[idx].scale, { x:0, y:0, duration:0.35, ease:'back.in(1.3)' }, k*stagger);
    });
    orderBot.forEach((idx, k) => {
      tl.to(botTiles[idx].scale, { x:0, y:0, duration:0.35, ease:'back.in(1.3)' }, k*stagger);
    });
    tl.to(layer, { alpha:0, duration:0.25 }, Math.max(orderTop.length, orderBot.length)*stagger - 0.05);
  });

  try { window.removeEventListener('resize', __onResize); } catch {}
  try { group.removeChildren(); } catch {}
  try { layer.removeChildren(); } catch {}
  try { stage.removeChild?.(layer); } catch {}
}

