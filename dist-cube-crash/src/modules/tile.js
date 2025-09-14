// public/src/modules/tile.js
// Upravljanje pločicama (stvaranje, vrijednosti, zaključavanje/otključavanje).

import { Container, Sprite, Graphics, Assets } from 'pixi.js';
import {
  COLS, ROWS, TILE, GAP,
  PIPS_INNER_FACTOR, PIP_COLOR, PIP_ALPHA, PIP_RADIUS, PIP_SQUARE,
  GHOST_ALPHA, ASSET_TILE
} from './constants.js';

// Globalne strukture
export const tiles = [];
export const grid  = [];

// briše sve pločice (pozvati prije nove ploče)
export function clearAllTiles(board) {
  tiles.slice().forEach(t => {
    try { t.destroy({ children:true, texture:false, textureSource:false }); } catch {}
  });
  tiles.length = 0;
  grid.length  = 0;
  board.removeChildren();
}

// slučajan odabir početne vrijednosti (1–5, s težištem na niže brojeve)
function randInitial() {
  const arr = [1,1,1,2,2,3,3,4,5];
  return arr[(Math.random() * arr.length) | 0];
}

// stvori pločicu na koloni c i retku r; val opcionalan; locked određuje ghost pločicu
export function createTile(board, c, r, val = null, locked = false) {
  const t = new Container();
  t.gridX = c;
  t.gridY = r;
  t.value = (val != null ? val : randInitial());
  t.stackDepth = 1;
  t.stackOffsets = [];
  t.locked = locked;

  // grupa za rotaciju (organski tilt)
  t.rotG = new Container();
  t.rotG.x = TILE / 2;
  t.rotG.y = TILE / 2;
  t.addChild(t.rotG);
  t.rotG.rotation = (Math.random() * 0.12) - 0.06;

  // glavni sprite pločice
  const sp = new Sprite(Assets.get(ASSET_TILE));
  sp.anchor.set(0.5);
  sp.width  = TILE;
  sp.height = TILE;
  sp.scale.x = 1;
  sp.scale.y = 1;
  t.rotG.addChild(sp);

  // slojevi i pipovi
  t.stackG = new Container();
  t.stackG.x = -TILE/2;
  t.stackG.y = -TILE/2;
  t.rotG.addChild(t.stackG);

  t.pips = new Graphics();
  t.pips.x = -TILE/2;
  t.pips.y = -TILE/2;
  t.rotG.addChild(t.pips);

  t.hover = new Graphics();
  t.addChild(t.hover);

  // pozicija pločice
  const x = c * (TILE + GAP);
  const y = r * (TILE + GAP);
  t.position.set(x, y);

  // inicijalni interaktivni parametri
  if (locked) {
    t.alpha = GHOST_ALPHA;
    t.eventMode = 'none';
    t.cursor = 'default';
  } else {
    t.alpha = 1;
    t.eventMode = 'static';
    t.cursor = 'pointer';
  }

  board.addChild(t);
  tiles.push(t);
  grid[r] ??= [];
  grid[r][c] = t;

  drawStack(t);
  drawPips(t);
  return t;
}

// osigurava dovoljno nasumičnih offseta za slojeve (max 3)
function ensureStackOffsets(t, count) {
  while ((t.stackOffsets?.length || 0) < count) {
    const ang = Math.random() * Math.PI * 2;
    const rad = 7 + Math.random() * 7;
    const dx  = Math.round(Math.cos(ang) * rad);
    const dy  = Math.round(Math.sin(ang) * rad);
    const rot = (Math.random() * 0.26) - 0.13;
    const a   = 0.80 - Math.random() * 0.10;
    t.stackOffsets.push({ dx, dy, rot, a });
  }
}

// nacrtaj slojeve (sjenke) prema stackDepth
function drawStack(t) {
  t.stackG.removeChildren();
  const layers = Math.min(4, Math.max(1, t.stackDepth || 1)) - 1;
  ensureStackOffsets(t, layers);
  for (let i = 0; i < layers; i++) {
    const o = t.stackOffsets[i];
    const s = new Sprite(Assets.get(ASSET_TILE));
    s.anchor.set(0.5);
    s.width  = TILE;
    s.height = TILE;
    s.alpha  = o.a;
    s.x      = TILE/2 + o.dx;
    s.y      = TILE/2 + o.dy;
    s.rotation = o.rot;
    s.scale.x = 1;
    s.scale.y = 1;
    t.stackG.addChild(s);
  }
}

// nacrtaj pipove (točkice) ovisno o vrijednosti
function drawPips(t) {
  const g = t.pips;
  while (g.children?.length) g.children.pop().destroy();
  g.clear();
  if (t.value <= 0) return;

  const side  = TILE * PIPS_INNER_FACTOR;
  const start = (TILE - side) / 2;
  const step  = side / 2;
  const xs=[start, start+step, start+2*step];
  const ys=[start, start+step, start+2*step];
  const idx=(cx,cy)=> cy*3+cx;
  const maps={
    1:[4],
    2:[idx(0,0),idx(2,2)],
    3:[idx(0,0),4,idx(2,2)],
    4:[idx(0,0),idx(2,0),idx(0,2),idx(2,2)],
    5:[idx(0,0),idx(2,0),4,idx(0,2),idx(2,2)],
    6:[idx(0,0),idx(2,0),idx(0,1),idx(2,1),idx(0,2),idx(2,2)]
  };
  const pts = maps[Math.max(1, Math.min(6, t.value))];

  g.beginFill(PIP_COLOR, PIP_ALPHA);
  pts.forEach(i => {
    const cx = xs[i % 3];
    const cy = ys[(i / 3) | 0];
    if (PIP_SQUARE) {
      g.drawRoundedRect(cx - 8, cy - 8, 16, 16, PIP_RADIUS);
    } else {
      g.drawCircle(cx, cy, 8);
    }
  });
  g.endFill();
}

// postavi novu vrijednost i eventualno poveća stack (broj slojeva)
export function setTileValue(t, val, addStack=0) {
  t.value = val;
  if (addStack) t.stackDepth = Math.min(4, (t.stackDepth || 1) + addStack);
  drawStack(t);
  drawPips(t);
}

// otključaj pločicu (vrati je u igru) i zovi callback kada je otvoreno
export function setTileOpen(t, onOpened) {
  t.locked = false;
  t.alpha  = 1;
  t.eventMode = 'static';
  t.cursor = 'pointer';
  drawPips(t);
  if (typeof onOpened === 'function') onOpened(t);
}

// ponovno zaključa pločicu (ghost holder) – nije interaktivna
export function setTileLocked(t) {
  t.locked = true;
  t.alpha  = GHOST_ALPHA;
  t.eventMode = 'none';
  t.cursor = 'default';
}
