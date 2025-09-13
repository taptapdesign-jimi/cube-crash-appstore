// public/src/modules/app.js
// ✅ mobile-first, cache-busted celebration & prize flow

import { Application, Container, Assets, Graphics, Text, Rectangle, Texture, Sprite } from 'pixi.js';
import { gsap } from 'gsap';

import {
  COLS, ROWS, TILE, GAP, HUD_H,
  ASSET_TILE, ASSET_NUMBERS, ASSET_NUMBERS2, ASSET_NUMBERS3, ASSET_WILD
} from './constants.js';
import { sweetPopIn } from './app-board.js';
import * as CONSTS from './constants.js';

import * as makeBoard from './board.js';
import { installDrag } from './install-drag.js';
import { glassCrackAtTile, woodShardsAtTile, innerFlashAtTile, showMultiplierTile, smokeBubblesAtTile, screenShake, startWildIdle, stopWildIdle } from './fx.js';
import { showStarsModal } from './stars-modal.js';
import FX from './fx-helpers.js';
import * as SPAWN from './spawn-helpers.js';
import * as HUD   from './hud-helpers.js';
import { wild } from './hud-helpers.js';
import * as FLOW  from './level-flow.js';

// HUD functions from hud-helpers.js


// --- Endless mode config ---
const MOVES_MAX = 50;
const COMBO_CAP = 99;   // praktični safety cap

// Combo idle decay: reset na x0 poslije 2s
const COMBO_IDLE_RESET_MS = 2000;
let comboIdleTimer = null;
function scheduleComboDecay(){
  try { comboIdleTimer?.kill?.(); } catch {}
  comboIdleTimer = gsap.delayedCall(COMBO_IDLE_RESET_MS/1000, () => {
    // COMBO DEFLATE ANIMATION: Deflate like balloon when combo is lost
    if (combo > 0) {
      console.log('💨 COMBO DEFLATE: Starting deflate animation for combo loss');
      try {
        // Animate combo text deflate
        if (window.comboText) {
          gsap.to(window.comboText.scale, {
            x: 0.1, // Deflate to 10%
            y: 0.1,
            duration: 0.3,
            ease: 'power2.in',
            onComplete: () => {
              // Reset scale after deflate
              gsap.set(window.comboText.scale, { x: 1.0, y: 1.0 });
            }
          });
        }
      } catch (e) {
        console.warn('💨 COMBO DEFLATE: Animation failed:', e);
      }
    }
    
    combo = 0;
    hudResetCombo();
    updateHUD();
  });
}

// --- Wild tuning ---
const WILD_INC_SMALL = 0.10;
const WILD_INC_BIG   = 0.22;

// -------------------- global state --------------------
let app, stage, board, boardBG, hud;
let _hudInitDone = false;
let _hudDropPending = true; // Play-from-slider only; no drop on restarts
let _lastSAT = -1;
let grid = []; let tiles = [];
let score = 0; let level = 1; let moves = MOVES_MAX;
const SCORE_CAP = 999999;

// Combo (UI driven)
let combo = 0; // default x0
function hudSetCombo(v){ combo = Math.max(0, Math.min(COMBO_CAP, v)); try{ _setCombo?.(combo); }catch{} }
function hudResetCombo(){ combo = 0; try{ _resetCombo?.(); }catch{} }

// HUD legacy refs (fallback)
let scoreNumText = null, movesNumText = null, boardNumText = null;

// Export combo text for animations
window.comboText = null;

// Wild meter (0..1) – crta ga HUD modul
let wildMeter = 0;
let drag;
let busyEnding = false;

// ----- progress wrapper (delegira HUD-u) -----
let hudUpdateProgress = (ratio, animate) => {};
let allowWildDecrease = false;
function setWildProgress(ratio, animate=false){
  console.log('🔥 DRAMATIC: setWildProgress called with:', { ratio, animate });
  
  // DRAMATIC: Simple, direct update
  let target = Number.isFinite(ratio) ? ratio : 0;
  target = Math.max(0, Math.min(1, target));
  wildMeter = target;
  
  console.log('🔥 DRAMATIC: Wild meter set to:', wildMeter);
  
  // DIRECT HUD UPDATE - no complex logic
  try {
    HUD.updateProgressBar?.(wildMeter, !!animate);
    console.log('✅ DRAMATIC: HUD.updateProgressBar called successfully');
  } catch (error) {
    console.error('❌ DRAMATIC: Error calling HUD.updateProgressBar:', error);
  }
}
let updateProgressBar = (ratio, animate=false) => setWildProgress(ratio, animate);
function addWildProgress(amount){
  console.log('🔥 NEW LOGIC: addWildProgress called with amount:', amount, 'current wildMeter:', wildMeter);
  
  // NEW LOGIC: Direct calculation and update
  const inc = Number.isFinite(amount) ? amount : 0;
  const newValue = Math.min(1, wildMeter + inc);
  wildMeter = newValue;
  
  console.log('🔥 NEW LOGIC: Direct wild meter update to:', newValue);
  
  // NEW LOGIC: Direct HUD update with new logic
  try {
    console.log('🔄 NEW LOGIC: Calling HUD.updateProgressBar with newValue:', newValue, 'animate: true');
    HUD.updateProgressBar?.(newValue, true); // Use true for elastic animation
    console.log('✅ NEW LOGIC: HUD.updateProgressBar called successfully');
  } catch (error) {
    console.error('❌ NEW LOGIC: Error calling HUD.updateProgressBar:', error);
  }
  
  // Wild spawn check
  if (wildMeter >= 1){ 
    console.log('🎯 NEW LOGIC: Wild meter full! Spawning wild cube...');
    spawnWildFromMeter(); 
    try { HUD.shimmerProgress?.({}); } catch {} 
  }
}
function resetWildProgress(value=0, animate=false){
  allowWildDecrease = true;
  setWildProgress(value, animate);
  allowWildDecrease = false;
}

// -------------------- fonts --------------------
async function ensureFonts() {
  if (ensureFonts._done) return;
  const weights = [400, 500, 600, 700, 800];
  try { await Promise.all(weights.map(w => document.fonts.load(`${w} 16px "LTCrow"`))); } catch {}
  ensureFonts._done = true;
}

// --- asset fallbacks & runtime-resolved paths ---
const MYSTERY_CANDIDATES = [
  CONSTS.ASSET_MYSTERY,
  '/assets/mystery-box.png',
  '/assets/mistery-box.png',
  '/assets/mystery-box.jpeg',
  '/assets/mistery-box.jpeg'
].filter(Boolean);

const COIN_CANDIDATES = [
  CONSTS.ASSET_COIN,
  '/assets/gold-coin.png',
  '/assets/gold-coin.jpeg'
].filter(Boolean);

// Resolved at boot:
let MYSTERY_PATH = null;
let COIN_PATH = null;

// Try to load the first working texture from a list of candidates, with cache-busting attempts.
async function loadFirstTexture(paths){
  const attempts = [];
  const bust = Date.now();
  for (const p of paths){
    if (!p) continue;
    attempts.push(p);
    if (!/\?/.test(p)) attempts.push(`${p}?bust=${bust}`);
  }
  for (const url of attempts){
    try {
      const tex = await Assets.load(url);
      if (tex) return url;
    } catch {}
  }
  throw new Error('None of the asset candidates could be loaded: ' + attempts.join(', '));
}

// Cache-busted celebration import
async function showCleanBoardCelebrationFresh(args){
  const bust = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV)
    ? `?bust=${Date.now()}`
    : '';
  const m = await import(`./center-celebration.js${bust}`);
  return m.showCleanBoardCelebration(args);
}

// Graceful import (DEV uses cache-bust; PROD clean path)
async function showMysteryPrize(){
  try {
    const bust = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV)
      ? `?bust=${Date.now()}`
      : '';
    const m = await import(`./mystery-prize.js${bust}`);
    return m.showMysteryPrize({ app, stage, board, TILE });
  } catch {}
}

// -------------------- boot --------------------
export async function boot(){
  console.log('🎮 Initializing PIXI app');
  
  // DESTROY existing app if it exists
  if (app && app.canvas) {
    console.log('🧹 Destroying existing PIXI app');
    try {
      app.destroy(true, { children: true, texture: true, baseTexture: true });
    } catch (e) {
      console.log('⚠️ Error destroying app:', e);
    }
    app = null;
  }
  
  // Clear any existing canvas
  const host = document.getElementById('app') || document.body;
  const existingCanvas = host.querySelector('canvas');
  if (existingCanvas) {
    existingCanvas.remove();
  }
  
  console.log('🎮 Creating fresh PIXI app');
  app = new Application();
  await app.init({
    resizeTo: window,
    background: 0xf5f5f5,
    antialias: true,
    // cap DPR for iOS performance while keeping crisp visuals
    resolution: Math.min((window.devicePixelRatio || 1), 2)
  });
  host.appendChild(app.canvas);
  app.canvas.style.touchAction = 'none';
  
  // Basic setup
  stage   = app.stage; stage.sortableChildren = true;
  board   = new Container(); board.sortableChildren = true;
  boardBG = new Graphics();
  hud     = new Container(); hud.eventMode = 'none';

  board.zIndex = 100; hud.zIndex = 10000;
  stage.addChild(board, hud);
  board.addChildAt(boardBG, 0); boardBG.zIndex = -1000; board.sortChildren();

  stage.eventMode = 'static';
  stage.hitArea   = new Rectangle(0, 0, app.renderer.width, app.renderer.height);

  // Resolve prize assets
  MYSTERY_PATH = await loadFirstTexture(MYSTERY_CANDIDATES);
  COIN_PATH    = await loadFirstTexture(COIN_CANDIDATES);

  // Core assets
  await Assets.load([ASSET_TILE, ASSET_NUMBERS, ASSET_NUMBERS2, ASSET_NUMBERS3, ASSET_WILD]);
  await ensureFonts();

  // drag
  const ret = installDrag({
    app, board, TILE,
    getTiles: () => tiles,
    merge,
    canDrop: (s, d) => !d.locked,
    hoverColor: 0x8a6e57,
    hoverWidth: 10,
    hoverAlpha: 0.28,
    threshold: 0.03,
    hitPad: 0.26,
    snapRadius: 0.68,
  });
  drag = (ret && ret.drag) ? ret.drag : ret;

  // Start game
  moves = MOVES_MAX;
  startLevel(1);
  window.addEventListener('resize', layout);
  scheduleIdleCheck();

  // viewport + fonts
  {
    const vp = document.querySelector('meta[name="viewport"]') || (() => {
      const m = document.createElement('meta'); m.setAttribute('name','viewport'); document.head.appendChild(m); return m;
    })();
    vp.setAttribute('content','width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover');

    const style = document.createElement('style');
    style.textContent = `
      :root{ --sat:env(safe-area-inset-top,0px); --sal:env(safe-area-inset-left,0px); --sar:env(safe-area-inset-right,0px); --sab:env(safe-area-inset-bottom,0px); }
      html,body{ margin:0; padding:0; background:#f5f5f5; height:auto; }
      body{ min-height:100dvh; overflow:hidden; }
      #app{ position:fixed; inset:0; width:100vw; height:100dvh; background:#f5f5f5; }
      canvas{ position:absolute; inset:0; width:100vw; height:100dvh; display:block; background:#f5f5f5; }
      @font-face{ font-family:"LTCrow"; src:url("./assets/fonts/LTCrow-Regular.ttf") format("truetype"); font-weight:400; font-style:normal; font-display:swap; }
      @font-face{ font-family:"LTCrow"; src:url("./assets/fonts/LTCrow-Medium.ttf") format("truetype"); font-weight:500; font-style:normal; font-display:swap; }
      @font-face{ font-family:"LTCrow"; src:url("./assets/fonts/LTCrow-SemiBold.ttf") format("truetype"); font-weight:600; font-style:normal; font-display:swap; }
      @font-face{ font-family:"LTCrow"; src:url("./assets/fonts/LTCrow-Bold.ttf") format("truetype"); font-weight:700; font-style:normal; font-display:swap; }
      @font-face{ font-family:"LTCrow"; src:url("./assets/fonts/LTCrow-ExtraBold.ttf") format("truetype"); font-weight:800; font-style:normal; font-display:swap; }
    `;
    document.head.appendChild(style);
  }

  // Debug mini-API (ostavljeno)
  window.CC = {
    nextLevel: () => startLevel(level + 1),
    retry:     () => startLevel(level),
    state:     () => ({ level, score, moves, wildMeter, tiles: tiles.length }),
    app, stage, board,
    testCleanBoard: async () => { /* ... tvoja baza ... */ },
    testCleanAndPrize: async () => { /* ... tvoja baza ... */ },
  };
  window.testCleanAndPrize = () => window.CC.testCleanAndPrize();

  // Run layout after viewport/meta/styles are in place to get correct safe-area values
  try {
    requestAnimationFrame(() => layout());
  } catch {
    layout();
  }
}

// -------------------- layout + HUD --------------------
export function layout(){
  const { w, h } = boardSize();
  const vw = app.renderer.width, vh = app.renderer.height;
  stage.hitArea = new Rectangle(0, 0, vw, vh);

  const isMobilePortrait = (vw < 768) || (vh > vw);

  const cssVars = getComputedStyle(document.documentElement);
  const SAL = parseFloat(cssVars.getPropertyValue('--sal')) || 0;
  const SAR = parseFloat(cssVars.getPropertyValue('--sar')) || 0;
  const SAB = parseFloat(cssVars.getPropertyValue('--sab')) || 0;
  const SAT = parseFloat(cssVars.getPropertyValue('--sat')) || 0;
  
  // iPhone 13 specific safe area handling
  const isIPhone13 = /iPhone/.test(navigator.userAgent) && window.screen.width === 390 && window.screen.height === 844;
  const adjustedSAT = isIPhone13 ? Math.max(SAT, 44) : SAT; // iPhone 13 minimum safe area top
  
  console.log('🎯 Safe area top (SAT):', SAT, 'px, adjusted for iPhone 13:', adjustedSAT, 'px');
  console.log('🎯 Device info:', {
    userAgent: navigator.userAgent,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    isIPhone13,
    viewportWidth: vw,
    viewportHeight: vh
  });

  const MIN_SIDE = isMobilePortrait ? 24 : 14;
  const LEFT_PAD  = Math.max(MIN_SIDE, SAL);
  const RIGHT_PAD = Math.max(MIN_SIDE, SAR);
  const TOP_PAD   = 20 + Math.round(vh * 0.01); // Move HUD 1% lower (was 8%, now 1%)
  const BOT_PAD   = (isMobilePortrait ? 24 : 24) + SAB;
  const GAP_HUD   = 16;

  // For mobile devices, HUD will be positioned below notch, so calculate board positioning accordingly
  const isMobile = vw < 768 || vh > vw;
  let safeTop, hudBottom;
  
  if (isMobile) {
    // Mobile: HUD positioning handled by hud-helpers.js
    const safeAreaTop = Math.max(44, adjustedSAT);
    safeTop = safeAreaTop; // Let hud-helpers.js handle the exact positioning
    hudBottom = safeTop + HUD_H + GAP_HUD;
    
    console.log('📱 Mobile: HUD positioning handled by hud-helpers.js, safeTop:', safeTop, 'px');
  } else {
    // Desktop: Use calculated safe area positioning
    safeTop = TOP_PAD + adjustedSAT;
    hudBottom = safeTop + HUD_H + GAP_HUD;
    console.log('🖥️ Desktop: HUD at y:', safeTop, 'px, board starts at y:', hudBottom);
  }
  
  // Gentle global nudge: move HUD and board 8px lower
  const HUD_NUDGE_PX = 8;
  const BOARD_NUDGE_PX = 8; // additional board-only nudge down (was 4)
  safeTop += HUD_NUDGE_PX;
  hudBottom += HUD_NUDGE_PX;
  
  // Scale board to fit screen width with 24px padding (equivalent to ~6% on mobile)
  const paddingPercent = 0.06; // 6% padding (equivalent to ~24px on iPhone 13)
  const availableWidth = vw * (1 - paddingPercent * 2); // 88% of screen width
  const widthScale = availableWidth / w;
  const heightScale = (vh - hudBottom - BOT_PAD) / h;
  const s = Math.min(widthScale, heightScale); // Use smaller of the two, no max limit
  
  console.log('🎯 Board scaling:', { 
    availableWidth, 
    widthScale, 
    heightScale, 
    finalScale: s,
    paddingPercent: (paddingPercent * 100) + '%'
  });
  board.scale.set(s, s); board.scale.y = board.scale.x;

  const sw = w * s, sh = h * s;
  // Center horizontally with 6% padding
  const paddingPixels = vw * paddingPercent;
  const idealLeft = Math.round((vw - sw) / 2);
  const minLeft = paddingPixels;
  const maxLeft = vw - paddingPixels - sw;
  board.x = Math.min(Math.max(idealLeft, minLeft), maxLeft);
  
  // Center board between HUD and bottom (initial estimate using constant HUD_H)
  const availableHeight = vh - hudBottom - BOT_PAD;
  const centerY = hudBottom + (availableHeight - sh) / 2;
  board.y = Math.round(centerY + BOARD_NUDGE_PX);
  
  console.log('🎯 Board centered at y:', board.y, 'px (available height:', availableHeight, 'px, board height:', sh, 'px)');
  
  console.log('🎯 Board positioning (HUD below notch on mobile):', {
    isMobile,
    safeTop,
    hudBottom,
    availableHeight,
    centerY: board.y,
    boardHeight: sh,
    viewportHeight: vh,
    topPad: TOP_PAD
  });

  drawBoardBG('none');
  if (Math.abs((_lastSAT||0) - SAT) > 0.5) { _hudInitDone = false; _lastSAT = SAT; }

  try {
    if (typeof HUD.initHUD === 'function') {
      if (!_hudInitDone) {
        console.log('🎯 Initializing HUD...');
        HUD.initHUD({ stage, app, top: safeTop, initialHide: _hudDropPending });
        _hudInitDone = true;
        console.log('✅ HUD initialized successfully');
        
        // hook za wild meter prema HUD-u
        hudUpdateProgress = (ratio, animate)=>{
          console.log('🎯 hudUpdateProgress called with:', { ratio, animate });
          try{ 
            HUD.updateProgressBar?.(ratio, animate); 
            console.log('✅ HUD.updateProgressBar called successfully');
          } catch(error) {
            console.error('❌ Error calling HUD.updateProgressBar:', error);
          }
        };
      }
      
      // Update HUD with current values
      if (typeof HUD.updateHUD === 'function') {
        HUD.updateHUD({ score, moves, combo });
        console.log('✅ HUD updated with:', { score, moves, combo });
      }
      
      // CRITICAL: Call HUD.layout to update HUD positioning
      if (typeof HUD.layout === 'function') {
        HUD.layout({ app, top: safeTop });
        console.log('✅ HUD layout updated');
      }

      // After HUD has laid out the wild preloader, recenter board between
      // the bottom edge of the (final) HUD position and the bottom of the screen.
      try {
        const wildY = (wild?.view?.y ?? 0);
        const wildH = (wild?.view?.height ?? 0);
        const hudRoot = wild?.view?.parent || null; // HUD_ROOT
        // If HUD is mid-drop (hidden above), use its target top for layout so board doesn't jump.
        const hudYForLayout = hudRoot
          ? (hudRoot._dropped ? (hudRoot.y ?? safeTop) : (hudRoot._dropTop ?? safeTop))
          : safeTop;
        // dynamic bottom = intended HUD top + wild local y + wild height + gap
        const dynamicHudBottom = hudYForLayout + wildY + wildH + GAP_HUD;
        // Recompute vertical scale to ensure board fits in space between wild bottom and screen bottom
        const heightScale2 = (vh - dynamicHudBottom - BOT_PAD) / h;
        const s2 = Math.min(widthScale, heightScale2);
        board.scale.set(s2, s2);
        const sw2 = w * s2, sh2 = h * s2;
        // recenter horizontally with the same padding
        const paddingPixels2 = vw * paddingPercent;
        const idealLeft2 = Math.round((vw - sw2) / 2);
        const minLeft2 = paddingPixels2;
        const maxLeft2 = vw - paddingPixels2 - sw2;
        board.x = Math.min(Math.max(idealLeft2, minLeft2), maxLeft2);
        // recenter vertically between wild bottom and bottom of screen
        const avail2 = vh - dynamicHudBottom - BOT_PAD;
        const center2 = dynamicHudBottom + (avail2 - sh2) / 2;
        board.y = Math.round(center2 + BOARD_NUDGE_PX);
        console.log('🎯 Recentered board using wild bottom:', { dynamicHudBottom, center2, wildY, wildH, s2, hudYForLayout });
      } catch (e) {
        console.warn('⚠️ Could not recenter using wild bottom, using estimate.', e);
      }
    } else {
      console.warn('⚠️ HUD.initHUD is not a function');
    }
  } catch (error) {
    console.error('❌ Error during HUD initialization/update in app.js layout:', error);
    // Reset HUD flag on error to retry next time
    _hudInitDone = false;
  }
}

function boardSize(){ return { w: COLS*TILE + (COLS-1)*GAP, h: ROWS*TILE + (ROWS-1)*GAP }; }

function cellXY(c, r){ return { x: c*(TILE+GAP), y: r*(TILE+GAP) }; }

function drawBoardBG(mode = 'active+empty'){
  const PAD=5, RADIUS=Math.round(TILE*0.26), WIDTH=8, COLOR=0x8a6e57, ALPHA=0.05;
  boardBG.clear(); if (mode === 'none') return;
  for (let r=0;r<ROWS;r++){
    for (let c=0;c<COLS;c++){
      const t = grid?.[r]?.[c];
      const hasTile=!!t, isActive=!!(t && !t.locked), isEmpty=!hasTile;
      let draw=false;
      if (mode==='all') draw=true; else if (mode==='emptyOnly') draw=isEmpty; else draw = isActive || isEmpty;
      if (!draw) continue;
      const pos = cellXY(c, r);
      boardBG.roundRect(pos.x+PAD,pos.y+PAD,TILE-PAD*2,TILE-PAD*2,RADIUS).stroke({ color:COLOR, width:WIDTH, alpha:ALPHA });
    }
  }
}

const updateHUD = () => {
  console.log('🎯 updateHUD called with:', { score, moves, combo });
  
  try {
    // First try to use HUD from hud-helpers.js
    if (typeof HUD.updateHUD === 'function') { 
      console.log('🎯 Calling HUD.updateHUD from hud-helpers.js');
      HUD.updateHUD({ score, moves, combo }); 
      return; 
    } else {
      console.log('⚠️ HUD.updateHUD function not available');
    }
  } catch (error) {
    console.error('❌ Error calling HUD.updateHUD:', error);
  }
  
  try {
    // Fallback to old method
    if (typeof _updateHUD === 'function') { 
      console.log('🎯 Using fallback _updateHUD');
      _updateHUD({ score, moves, combo }); 
      return; 
    }
  } catch (error) {
    console.error('❌ Error calling _updateHUD:', error);
  }
  
  // Legacy fallback
  console.log('🎯 Using legacy fallback for HUD update');
  if (boardNumText) boardNumText.text = `#${level}`;
  if (scoreNumText) scoreNumText.text = String(score);
  if (movesNumText) movesNumText.text = String(moves);
};

function animateScore(toValue, duration=0.45){
  if (typeof _animateScore === 'function') {
    _animateScore({ scoreRef: () => score, setScore: v => { score=v; }, updateHUD, SCORE_CAP, gsap }, toValue, duration);
  } else {
    HUD.animateScore({ scoreRef: () => score, setScore: v => { score=v; }, updateHUD, SCORE_CAP, gsap }, toValue, duration);
  }
}
function animateMovesHUD(toValue, duration=0.45){
  if (typeof _animateMoves === 'function') {
    _animateMoves({ movesRef: () => moves, setMoves: v => { moves=v; }, updateHUD, gsap }, toValue, duration);
  } else {
    try { _setMoves?.(toValue); } catch {}
    moves = toValue|0; updateHUD();
  }
}
function fixHoverAnchor(t){ try { if (t && t.hover) { t.hover.x=TILE/2; t.hover.y=TILE/2; } } catch {} }

// -------------------- board build --------------------
function resetBoardContainer(){
  board.removeChildren(); board.addChildAt(boardBG,0); boardBG.zIndex=-1000; boardBG.eventMode='none';
  board.sortableChildren = true; board.sortChildren();
}
function rebuildBoard(){
  resetBoardContainer();
  tiles.forEach(t=>t.destroy({children:true, texture:false, textureSource:false}));
  tiles.length=0;
  grid = Array.from({length:ROWS},()=>Array(COLS).fill(null));
  drawBoardBG('none');

  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      makeBoard.createTile({ board, grid, tiles, c, r, val:0, locked:true });
      fixHoverAnchor(grid[r][c]);
    }
  }
  const total = COLS*ROWS, openN = Math.max(1, Math.round(total*0.30));
  const ids=[...Array(total).keys()];
  for(let i=ids.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [ids[i],ids[j]]=[ids[j],ids[i]]; }
  ids.slice(0,openN).forEach(idx=>{
    const r=(idx/COLS)|0, c=idx%COLS; const t=grid[r][c];
    fixHoverAnchor(t); t.locked=false; t.eventMode='static'; t.cursor='pointer';
    if (drag && typeof drag.bindToTile === 'function') drag.bindToTile(t);
    makeBoard.setValue(t, t.value || randVal(), 0);
  });

  try { tiles.forEach(t => t.visible = false); } catch {}
  
  // Start animation immediately - NO WAITING
  console.log('🎯 Starting sweetPopIn from app.js with', tiles.length, 'tiles');
  sweetPopIn(tiles, { onHalf: () => { if (_hudDropPending){ try { HUD.playHudDrop?.({}); } catch {} _hudDropPending = false; } } }); // Don't wait
  console.log('✅ sweetPopIn started immediately - no waiting');
  
}
function tintLocked(t){ try{ gsap.to(t, { alpha:0.35, duration:0.10, ease:'power1.out' }); }catch{} }
function randVal(){ return [1,1,1,2,2,3,3,4,5][(Math.random()*9)|0]; }
function startLevel(n){
  level = 1;
  moves = MOVES_MAX;
  busyEnding = false;
  hudResetCombo();
  try { comboIdleTimer?.kill?.(); } catch {}
  wildMeter = 0;
  resetWildProgress(0, false);
  
  // Start animation immediately - no delay
  rebuildBoard(); 
  updateHUD();
  
  // Call layout only for initial game start, not for restart
  if (n === 1) {
    layout();
    console.log('🎯 Layout called for initial game start');
  }
  
  // Check level end immediately - no delay
  gsap.delayedCall(0.1, checkLevelEnd);
}

// --- local Wild skin fallback
function applyWildSkinLocal(tile){
  try{
    const tex = Assets.get(ASSET_WILD) || Texture.from(ASSET_WILD);
    if (!tex || !tile) return;
    const host = tile.rotG || tile;
    let base = tile.base;
    if (!base){
      base = host.children?.find(c => c.texture instanceof Texture) || null;
      if (base) tile.base = base;
    }
    if (base){ base.texture = tex; base.tint=0xFFFFFF; base.alpha=1; }
    if (tile.num)  tile.num.visible = false;
    if (tile.pips) tile.pips.visible = false;
    tile.isWildFace = true;
    try { startWildIdle(tile, { interval: 4 }); } catch {}
  }catch{}
}

// --- spawn exactly at grid cell ---
function openAtCell(c, r, { value=null, isWild=false } = {}){
  return new Promise((resolve)=>{
    let holder = grid?.[r]?.[c] || null;

    // Ako je ovdje već AKTIVNA pločica (otključana i >0), ne diramo ju.
    if (holder && !holder.locked && (holder.value|0) > 0) {
      resolve();
      return;
    }

    if (!holder) holder = makeBoard.createTile({ board, grid, tiles, c, r, val:0, locked:true });

    holder.locked=false; holder.eventMode='static'; holder.cursor='pointer';
    if (drag && typeof drag.bindToTile === 'function') drag.bindToTile(holder);

    const v = (value == null) ? [1,2,3,4,5][(Math.random()*5)|0] : value;
    makeBoard.setValue(holder, v, 0);

    if (isWild){
      holder.special = 'wild';
      if (typeof makeBoard.applyWildSkin === 'function') { makeBoard.applyWildSkin(holder); }
      else { applyWildSkinLocal(holder); }
    }

    holder.alpha = 0;
    SPAWN.spawnBounce(holder, gsap, { max: 1.08, compress: 0.96, rebound: 1.02, startScale: 0.30, wiggle: 0.035, fadeIn:0.10 }, () => {
      holder.alpha = 1;
      resolve();
    });
  });
}

function randomEmptyCell(){
  const empties = [];
  for (let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      const t = grid[r][c];
      const isGhost = !!(t && t.locked === true);     // zaključan holder (placeholder)
      const isMissing = !t;                            // uopće nema holdera
      const isZero = !!(t && (t.value|0) <= 0);        // postoji ali nema vrijednost
      // DOZVOlJENO: ghost, missing, ili zero
      if (isGhost || isMissing || isZero) empties.push({ c, r });
    }
  }
  if (!empties.length) return null;
  return empties[(Math.random()*empties.length)|0];
}

async function spawnWildFromMeter(){
  if (wildMeter < 1) return;
  const cell = randomEmptyCell();
  if (!cell) { wildMeter = 1; return; }
  resetWildProgress(wildMeter - 1, true);
  await openAtCell(cell.c, cell.r, { isWild: true });
}

// -------------------- merge --------------------

function pickWildValue(dstValue) {
  let candidates = [1,2,3,4,5].filter(v => v !== dstValue);

  // ako je dst 4 ili 5, daj prednost manjim brojevima
  if (dstValue >= 4) {
    candidates = candidates.filter(v => v <= 3);
    if (candidates.length === 0) candidates = [1,2,3];
  }

  if (candidates.length === 0) candidates = [1,2,3,4,5].filter(v => v !== dstValue);

  return candidates[(Math.random() * candidates.length) | 0];
}
function merge(src, dst, helpers){
  if (busyEnding) { helpers.snapBack?.(src); return; }
  if (src === dst) { helpers.snapBack(src); return; }
  if (src?.special === 'wild' && dst?.special === 'wild'){ helpers.snapBack?.(src); return; }

  const sum      = (src.value|0) + (dst.value|0);
  const srcDepth = src.stackDepth || 1;
  const dstDepth = dst.stackDepth || 1;

  const wildActive = (src.special === 'wild' || dst.special === 'wild');
  let effSum = sum;

  // Normal rule: wild instantly triggers merge to 6
  if (wildActive) {
    effSum = 6;

    // Edge-case: late game, if board is almost full and this would leave only wilds,
    // then downgrade effSum to a smaller non-equal value so we don't spawn dead wilds.
    const activeTiles = tiles.filter(t => t && !t.locked);
    const allOpen = activeTiles.length === COLS * ROWS;
    if (allOpen) {
      effSum = pickWildValue(dst.value || 1);
    }
  }

  grid[src.gridY][src.gridX] = null;
  dst.eventMode = 'none';

  // ---- 2..5 (računaj combo i ovdje)
  if (effSum < 6){
    makeBoard.setValue(dst, effSum, srcDepth);
    score = Math.min(SCORE_CAP, score + effSum); updateHUD();

    // Combo++ (bez realnog capa), bump anim
    hudSetCombo(combo + 1);
    try { HUD.bumpCombo?.({ kind: 'stack', combo }); } catch {}
    scheduleComboDecay();

    addWildProgress(WILD_INC_SMALL);

    gsap.to(src, {
      x: dst.x, y: dst.y, duration: 0.08, ease: 'power2.out',
      onComplete: async () => {
        removeTile(src);
        dst.eventMode = 'static';
        FX.landBounce?.(dst);

        // countdown moves
        moves = Math.max(0, moves - 1);
        animateMovesHUD(moves, 0.40);
        if (moves === 0) { checkMovesDepleted(); return; }

        checkLevelEnd();
      }
    });
    return;
  }

  // ---- 6 (računaj combo i ovdje – nastavlja x6, x7, x8…)
  if (effSum === 6){
    const combinedCount = (src.stackDepth || 1) + (dst.stackDepth || 1);
    const visualDepth   = Math.min(4, combinedCount);

    makeBoard.setValue(dst, 6, 0);
    dst.stackDepth = visualDepth;
    makeBoard.drawStack(dst);
    dst.zIndex = 10000;

    const mult = combinedCount;

    gsap.to(src, {
      x: dst.x, y: dst.y, duration: 0.08, ease: 'power2.out',
      onComplete: async () => {
        removeTile(src);

        // Combo++ + bump (merge 6 hits maximum balloon)
        hudSetCombo(combo + 1);
        try { HUD.bumpCombo?.({ kind: 'merge6', combo }); } catch {}
        
        scheduleComboDecay();

        // FX
        const wasWild = (src.special === 'wild' || dst.special === 'wild');
        glassCrackAtTile(board, dst, TILE * (wasWild ? 0.60 : 0.50));
        innerFlashAtTile(board, dst, TILE);
        woodShardsAtTile(board, dst, true);

        // ► badge + pojačani “smoke/bubbles” + screen shake
        showMultiplierTile(board, dst, mult, TILE, 1.0);
        smokeBubblesAtTile(board, dst, TILE, 2); // strength 2 – veći burst
        
        // Gentle, erratic left-right shake for Wild merges (~20% stronger than normal)
        try {
          const base = Math.min(25, 12 + Math.max(1, mult) * 3);
          if (wasWild) {
            // 20% stronger, bias left-right (reduced vertical via yScale), not faster
            screenShake(app, {
              strength: base * 1.2,
              duration: 0.45,
              steps: 18,
              ease: 'power2.out',
              direction: 0,   // erratic per-step
              yScale: 0.55,   // less vertical movement → more left-right feel
              scale: 0.03,    // subtle global zoom
            });
          } else {
            screenShake(app, { strength: base, duration: 0.4 });
          }
        } catch {}

        if (wasWild){ woodShardsAtTile(board, dst, true); woodShardsAtTile(board, dst, true); }

        // clean up dst slot
        const gx = dst.gridX, gy = dst.gridY;
        grid[gy][gx] = null;
        dst.visible = false;
        removeTile(dst);

        const willBeClean = isBoardClean();
        if (!willBeClean){
          const holder = makeBoard.createTile({ board, grid, tiles, c: gx, r: gy, val: 0, locked: true });
          holder.alpha = 0.35; holder.eventMode = 'none';
          drawBoardBG();
        } else {
          drawBoardBG('none');
        }

        // countdown moves
        moves = Math.max(0, moves - 1);

        // scoring with bubble multiplier and combo multiplier
        const bubbleMult = mult || 1;
        const comboMult  = combo > 0 ? combo : 1;
        const scoreDelta = 6 * bubbleMult * comboMult;
        score = Math.min(SCORE_CAP, score + scoreDelta);

        animateMovesHUD(moves, 0.40);
        animateScore(score, 0.40);
        if (moves === 0) { checkMovesDepleted(); return; }

        // ► CLEAN BOARD flow
        if (isBoardClean()){
          busyEnding = true;
          const prevInteractive  = stage.eventMode;
          const prevBoardBGState = boardBG.visible;
          stage.eventMode = 'none';
          drawBoardBG('none');

          try {
            await showCleanBoardCelebrationFresh({ stage, app, board, TILE, GAP, ROWS, COLS });
            stage.eventMode = 'static';
            await showMysteryPrize();
          } finally {
            stage.eventMode = prevInteractive;
            boardBG.visible = prevBoardBGState;
            drawBoardBG();
            busyEnding = false;
          }
          return;
        }

        addWildProgress(WILD_INC_BIG);
        await FLOW.openLockedBounceParallel({ tiles, k: mult, drag, makeBoard, gsap, drawBoardBG, TILE, fixHoverAnchor, spawnBounce: (t, done, o)=>SPAWN.spawnBounce(t, gsap, o, done) });
        checkLevelEnd();
      }
    });
    return;
  }

  // >6 shouldn't happen
  helpers.snapBack(src);
  dst.eventMode = 'static';
}

function checkMovesDepleted(){
  if (busyEnding) return;
  busyEnding = true;
  showFinalScreen().finally(()=>{ busyEnding = false; });
}

// -------------------- stuck detection --------------------
function activeTilesList(){ try { return tiles.filter(t => t && !t.locked && (t.value|0) > 0); } catch { return []; } }
function isStuck(){
  const act = activeTilesList();
  if (act.length < 2) return true;
  const hasWild = act.some(t => t.special === 'wild');
  if (hasWild) return false;
  for (let i=0;i<act.length;i++){
    for (let j=i+1;j<act.length;j++){
      const a = act[i], b = act[j];
      if (((a.value|0) + (b.value|0)) <= 6) return false;
    }
  }
  return true;
}

// -------------------- level-end scaffolding --------------------
function checkLevelEnd(){
  gsap.delayedCall(0.01, () => {
    if (busyEnding) return;
    if (isStuck()){
      busyEnding = true;
      showFinalScreen().finally(()=>{ busyEnding = false; });
    }
  });
}
function showCleanBoardEdgeCase(){
  if (busyEnding) return;
  const active = tiles.filter(t => !t.locked && t.value > 0);
  if (active.length === 2){
    const add = (active[0].value|0) + (active[1].value|0);
    score = Math.min(SCORE_CAP, score + Math.max(0, add)); updateHUD();
  }
}

async function openLockedBounceParallel(k){
  await FLOW.openLockedBounceParallel({ tiles, k, drag, makeBoard, gsap, drawBoardBG, TILE, fixHoverAnchor, spawnBounce: (t, done, o)=>SPAWN.spawnBounce(t, gsap, o, done) });
}

function isBoardClean(){ return tiles.every(t => t.locked || t.value <= 0); }

// -------------------- helpers --------------------
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

function removeTile(t){
  if(!t) return;
  try { if (t.hover && typeof t.hover.clear === 'function') t.hover.clear(); } catch {}
  t.eventMode='none'; if (t.removeAllListeners) t.removeAllListeners();
  if (t.hover && typeof t.hover.clear === 'function') t.hover.clear();
  try{ gsap.killTweensOf(t); gsap.killTweensOf(t.scale); gsap.killTweensOf(t.rotG);}catch{}
  try { stopWildIdle?.(t); } catch {}
  board.removeChild(t);
  tiles = tiles.filter(x=>x!==t);
  t.destroy?.({children:true, texture:false, textureSource:false});
}

async function showFinalScreen(){
  try{
    await showStarsModal({ app, stage, board, score, title: 'Game Over', subtitle: `Score ${score}` });
  }catch{}
  restartGame();
}

function restartGame(){
  console.log('🔄 Starting clean restart - preserving HUD position');
  
  // Reset game state WITHOUT touching HUD positioning
  score = 0;
  moves = MOVES_MAX;
  hudResetCombo();
  try { comboIdleTimer?.kill?.(); } catch {}
  wildMeter = 0;
  resetWildProgress(0, false);
  
  // DRAMATIC: Simple wild meter reset
  console.log('🔥 DRAMATIC: Resetting wild meter to 0');
  wildMeter = 0;
  
  // NEW LOGIC: Simple and reliable wild meter reset
  try {
    console.log('🔄 NEW LOGIC: Calling HUD.updateProgressBar with 0...');
    HUD.updateProgressBar?.(0, false);
    console.log('✅ NEW LOGIC: Wild meter reset to 0 successfully');
  } catch (error) {
    console.error('❌ NEW LOGIC: Error resetting wild meter:', error);
  }
  
  // Rebuild board WITHOUT calling layout
  rebuildBoard();
  updateHUD();
  
  console.log('✅ Clean restart completed - HUD position preserved');
}
// temporary idle checker (no-op so boot doesn't fail)
function scheduleIdleCheck(){ /* no-op for now */ }
// Pause/Resume functions
export function pauseGame() {
  try {
    gsap.globalTimeline.pause();
    app.ticker.stop();
  } catch {}
}

export function resumeGame() {
  try {
    gsap.globalTimeline.resume();
    app.ticker.start();
  } catch {}
}

export function restart() {
  restartGame();
}

// Clean up game when exiting
export function cleanupGame() {
  console.log('🧹 Cleaning up game state');
  
  // CRITICAL: Reset GSAP timeline first
  try {
    gsap.killTweensOf("*");
    gsap.globalTimeline.clear();
    gsap.globalTimeline.resume(); // CRITICAL: Resume timeline
    console.log('✅ GSAP timeline reset and cleared');
  } catch (e) {
    console.log('⚠️ GSAP cleanup error:', e);
  }
  
  // CRITICAL: Reset HUD initialization flag
  _hudInitDone = false;
  // Prepare HUD drop for next entry from menu
  _hudDropPending = true;
  console.log('✅ HUD initialization flag reset');
  
  // Reset all game state
  score = 0;
  moves = MOVES_MAX;
  level = 1;
  combo = 0;
  wildMeter = 0;
  busyEnding = false;
  
  // Clear timers
  try { comboIdleTimer?.kill?.(); } catch {}
  comboIdleTimer = null;
  
  // Remove global listeners to avoid duplicated layout calls on re-entry
  try { window.removeEventListener('resize', layout); } catch {}
  
  // Reset wild progress
  resetWildProgress(0, false);
  try { HUD.resetWildLoader?.(); } catch {}
  
  // Clear tiles and grid
  if (tiles) {
    tiles.forEach(t => {
      try { stopWildIdle?.(t); } catch {}
      try { t.destroy?.({children: true, texture: false, textureSource: false}); } catch {}
    });
    tiles.length = 0;
  }
  
  if (grid) {
    grid = Array.from({length: ROWS}, () => Array(COLS).fill(null));
  }
  
  // Clear board
  if (board) {
    board.removeChildren();
    if (boardBG) {
      board.addChildAt(boardBG, 0);
      boardBG.zIndex = -1000;
      boardBG.eventMode = 'none';
    }
  }
  
  console.log('✅ Game cleanup completed');
}

// Start fresh game (for re-entering) - now just calls boot
export function startFreshGame() {
  console.log('🎮 Starting fresh game - calling boot');
  boot();
}

export { app, stage, board, hud, tiles, grid, score, level }; 
