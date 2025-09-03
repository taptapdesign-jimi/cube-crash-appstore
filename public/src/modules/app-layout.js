// src/modules/app-layout.js (HUD ref2 patch)
// Only HUD visuals changed: larger sizes, heavier weights, single top divider, rounded progress pill.
// No game logic or animations touched.

import { Container, Graphics, Text, Rectangle } from 'pixi.js';
import { gsap } from 'gsap';
import { STATE, COLS, ROWS, TILE, GAP, HUD_H } from './app-state.js';

function setHudRefs({ boardValueText, scoreValueText, movesValueText, progressG, progressWrap }){
  STATE.boardValueText = boardValueText;
  STATE.scoreNumText   = scoreValueText;
  STATE.movesNumText   = movesValueText;
  STATE._progressG     = progressG;
  STATE._progressWrap  = progressWrap;
}

export function boardSize(){ return { w: COLS*TILE + (COLS-1)*GAP, h: ROWS*TILE + (ROWS-1)*GAP }; }
export function cellXY(c, r){ return { x: c*(TILE+GAP), y: r*(TILE+GAP) }; }

// Draw the light board background (unchanged)
export function drawBoardBG({ board, x=0, y=0 }){
  const bg = board || new Graphics();
  bg.clear();
  bg.rect(0, 0, COLS*TILE + (COLS-1)*GAP, ROWS*TILE + (ROWS-1)*GAP).fill(0xF5F5F5);
  bg.x = x; bg.y = y;
  return bg;
}

// ---------------- HUD (visual-only, ref2) ----------------
export function drawHUD(top){
  const { app, hud } = STATE;
  hud.removeChildren();

  // Colors mapped to SwiftUI ref2
  const LABEL_COLOR = 0x725B4C;   // labels
  const VALUE_STD   = 0xAD8775;   // score/moves
  const VALUE_BOARD = 0xD69377;   // board accent
  const TRACK_COL   = 0xEAE2D8;   // progress track
  const FILL_COL    = 0xD69377;   // progress fill
  const DIVIDER_COL = 0xEFEFEF;

  // Responsive sizing: match ref2 proportions on phones
  const vw = app.renderer.width;
  // Base on viewport width so numbers look big like in ref2
  const VALUE_FS = Math.round(Math.min(44, Math.max(28, vw * 0.06)));   // ~36–44
  const LABEL_FS = Math.round(Math.min(22, Math.max(16, VALUE_FS * 0.45))); // ~16–20
  const GAP_Y    = 6;

  const makeStack = (labelStr, valueStr, valueColor = VALUE_STD) => {
    const g = new Container();
    const label = new Text({
      text: labelStr,
      style:{
        fontFamily: 'LT Crow, Inter, Arial, sans-serif',
        fill: LABEL_COLOR,
        fontSize: LABEL_FS,
        lineHeight: Math.round(LABEL_FS * 1.6),
        fontWeight: '700',      // heavier like ref2
        letterSpacing: 0.4,
        align: 'center'
      }
    });
    const value = new Text({
      text: valueStr,
      style:{
        fontFamily: 'LT Crow, Inter, Arial, sans-serif',
        fill: valueColor,
        fontSize: VALUE_FS,
        lineHeight: Math.round(VALUE_FS * 1.6),
        fontWeight: '800',      // bold numeric
        letterSpacing: 0.8,
        align: 'center'
      }
    });

    label.x = -Math.round(label.width/2);
    label.y = 0;
    value.x = -Math.round(value.width/2);
    value.y = label.y + label.height + GAP_Y;

    g.addChild(label, value);
    g._label = label;
    g._value = value;
    return g;
  };

  const boardGroup = makeStack('Board', `#${STATE.level|0}`, VALUE_BOARD);
  const scoreGroup = makeStack('Score', `${STATE.score|0}`, VALUE_STD);
  const movesGroup = makeStack('Moves', `${STATE.moves|0}`, VALUE_STD);

  const groups = [boardGroup, scoreGroup, movesGroup];
  const row = new Container();
  groups.forEach(g => row.addChild(g));
  hud.addChild(row);

  // HStack spacing and centering like ref2
  const COL_GAP = Math.round(Math.max(24, vw * 0.05)); // spacing grows a bit on wide screens
  const maxColW = Math.max(
    ...groups.map(g => Math.max(g._label.width, g._value.width))
  ) + 12;

  const totalRowW = maxColW*3 + COL_GAP*2;
  const rowStartX = Math.round((vw - totalRowW)/2);

  groups.forEach((g, i) => {
    g.x = rowStartX + i*(maxColW + COL_GAP) + Math.round(maxColW/2);
    g.y = top + 8; // a bit lower, more breathing space from top divider
  });

  // Keep refs so other modules can update values
  const boardValueText = boardGroup._value;
  const scoreValueText = scoreGroup._value;
  const movesValueText = movesGroup._value;

  // Progress pill
  const cssVars = getComputedStyle(document.documentElement);
  const SAL = parseFloat(cssVars.getPropertyValue('--sal')) || 0;
  const SAR = parseFloat(cssVars.getPropertyValue('--sar')) || 0;
  const cut   = 24;
  const leftX  = Math.round(cut + SAL);
  const rightX = Math.round(app.renderer.width - cut - SAR);
  const barW   = Math.max(160, rightX - leftX);
  const barH   = 6;  // slightly thicker like ref2
  const radius = Math.min(200, barH/2 + 50); // very rounded ends

  const progressWrap = new Container();
  progressWrap.x = leftX;
  progressWrap.y = top + Math.max(...groups.map(g => g._value.y + g._value.height)) + 14;
  const progressG = new Graphics();
  progressWrap.addChild(progressG);
  hud.addChild(progressWrap);

  setHudRefs({ boardValueText, scoreValueText, movesValueText, progressG, progressWrap });

  // Initial paint
  drawProgressGraphics(STATE.wildMeter || 0, barW, barH, TRACK_COL, FILL_COL, radius);
  hud._hudHeight = (progressWrap.y - top) + barH;
}

function drawProgressGraphics(ratio, fullW, fullH, TRACK_COL=0xEAE2D8, FILL_COL=0xD69377, R=200){
  const g = STATE._progressG;
  if (!g) return;
  const r = Math.max(0, Math.min(1, ratio));
  const w = r * fullW;
  g.clear();
  g.roundRect(0, 0, fullW, fullH, Math.min(R, fullH/2 + 50)).fill(TRACK_COL); // track
  if (w > 0){
    g.roundRect(0, 0, Math.max(2, w), fullH, Math.min(R, fullH/2 + 50)).fill(FILL_COL); // fill
  }
}

// External HUD text refresh (unchanged)
function updateHUD(){
  if (STATE.boardValueText) STATE.boardValueText.text = `#${STATE.level|0}`;
  if (STATE.scoreNumText)   STATE.scoreNumText.text   = String(STATE.score|0);
  if (STATE.movesNumText)   STATE.movesNumText.text   = String(STATE.moves|0);
}
export { updateHUD };

// Convenience progress updater (unchanged API)
export function updateProgressBar(p01){
  const wrap = STATE._progressWrap;
  if (!wrap) return;
  drawProgressGraphics(Math.max(0, Math.min(1, p01||0)), wrap.width, wrap.children?.[0]?.height || 6);
}

// ---------------- Layout tying HUD+Board together (only divider visuals changed) ----
export function layout(){
  const { app, stage, board, hud, divider } = STATE;
  const vw = app.renderer.width;
  const vh = app.renderer.height;

  const isMobilePortrait = vh > vw;

  const cssVars = getComputedStyle(document.documentElement);
  const SAL = parseFloat(cssVars.getPropertyValue('--sal')) || 0;
  const SAR = parseFloat(cssVars.getPropertyValue('--sar')) || 0;
  const SAB = parseFloat(cssVars.getPropertyValue('--sab')) || 0;

  const MIN_SIDE = isMobilePortrait ? 24 : 14;
  const LEFT_PAD  = Math.max(MIN_SIDE, SAL);
  const RIGHT_PAD = Math.max(MIN_SIDE, SAR);
  const TOP_PAD   = 36;
  const BOT_PAD   = (isMobilePortrait ? 24 : 24) + SAB;
  const GAP_HUD   = 10; // slightly larger gap like ref2

  const s = Math.min(
    (vw - LEFT_PAD - RIGHT_PAD) / (COLS*TILE + (COLS-1)*GAP),
    (vh - TOP_PAD - HUD_H - GAP_HUD - BOT_PAD) / (ROWS*TILE + (ROWS-1)*GAP)
  );

  const w = Math.round((COLS*TILE + (COLS-1)*GAP) * s);
  const h = Math.round((ROWS*TILE + (ROWS-1)*GAP) * s);

  const cx = Math.round((vw - w) / 2);
  const topHudY = Math.round(TOP_PAD);
  const boardY  = Math.round(topHudY + HUD_H + GAP_HUD);

  board.x = cx;
  board.y = boardY;
  board.scale.set(s);

  hud.x = 0;
  hud.y = topHudY;
  drawHUD(topHudY);

  // Top divider only
  divider.clear();
  const hb = hud.getBounds();
  const topDivY = Math.round(hb.y - 14);
  const cut   = 24;
  const leftX  = Math.round(cut + SAL);
  const rightX = Math.round(vw - cut - SAR);
  divider.moveTo(leftX, topDivY).lineTo(rightX, topDivY).stroke({ color: 0xEFEFEF, width: 6, alpha: 1 });

  hud.zIndex = 10000; divider.zIndex = 9000; board.zIndex = 100;
  try { STATE.stage.sortChildren(); } catch {}
}

// keep existing export used elsewhere:
export function animateScore({ scoreRef, setScore, updateHUD, SCORE_CAP, gsap }, toValue, duration=0.45){
  const clamped = Math.min(SCORE_CAP, toValue|0);
  const from = (scoreRef?.()|0) || 0;
  const obj = { v: from };
  gsap.to(obj, { v: clamped, duration, ease:'power2.out', onUpdate:()=>{ setScore(Math.round(obj.v)); updateHUD?.(); }});
}
