// public/src/modules/app.js
// ✅ mobile-first, cache-busted celebration & prize flow

import { Application, Container, Assets, Graphics, Text, Rectangle, Texture, Sprite, SCALE_MODES } from 'pixi.js';
import { gsap } from 'gsap';

import {
  COLS, ROWS, TILE, GAP, HUD_H,
  ASSET_TILE, ASSET_NUMBERS, ASSET_NUMBERS2, ASSET_NUMBERS3, ASSET_NUMBERS4, ASSET_WILD
} from './constants.js';
import { sweetPopIn, sweetPopOut } from './app-board.js';
import * as CONSTS from './constants.js';
import { STATE } from './app-state.ts';

import * as makeBoard from './board.ts';
import { installDrag } from './install-drag.js';
import { glassCrackAtTile, woodShardsAtTile, innerFlashAtTile, showMultiplierTile, smokeBubblesAtTile, screenShake, wildImpactEffect, startWildIdle, stopWildIdle, startWildShimmer, stopWildShimmer } from './fx.js';
import { showStarsModal } from './stars-modal.js';
import { runEndgameFlow } from './endgame-flow.js';
import FX from './fx-helpers.js';
import * as SPAWN from './spawn-helpers.js';
import * as HUD   from './hud-helpers.js';
import { wild } from './hud-helpers.js';
import * as FLOW  from './level-flow.js';
import { openEmpties } from './app-spawn.ts';
import { clearWildState } from './app-merge.ts';
import { statsService } from '../services/stats-service.js';
import { TILE_IDLE_BOUNCE } from './tile-idle-bounce.ts';

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
let grid = Array.isArray(STATE.grid) ? STATE.grid : [];
const tiles = STATE.tiles;
let score = 0; let level = 1; let boardNumber = 1; let moves = MOVES_MAX;
const SCORE_CAP = 999999;

// Combo (UI driven)
let combo = 0; // default x0
function hudSetCombo(v){ combo = Math.max(0, Math.min(COMBO_CAP, v)); try{ _setCombo?.(combo); }catch{} }
function hudResetCombo(){ combo = 0; try{ _resetCombo?.(); }catch{} }

// HUD legacy refs (fallback)
let scoreNumText = null, boardNumText = null, comboNumText = null;

// Export combo text for animations
window.comboText = null;

// Wild meter stores raw charge (can exceed 1); HUD clamps to 0..1
let wildMeter = 0;
let wildSpawnInProgress = false; // Prevent overlapping wild spawns
let wildSpawnRetryTimer = null;  // Retry timer when no cells are free
let wildRescueScheduled = false; // Prevent duplicate emergency spawns
let drag;
let busyEnding = false;

function createEmptyGrid() {
  const fresh = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  grid = fresh;
  STATE.grid = fresh;
  return fresh;
}

function syncSharedState() {
  STATE.app = app;
  STATE.stage = stage;
  STATE.board = board;
  STATE.boardBG = boardBG;
  STATE.hud = hud;
  STATE.grid = grid;
  STATE.tiles = tiles;
  STATE.score = score;
  STATE.level = level;
  STATE.moves = moves;
  STATE.boardNumber = boardNumber;
  STATE.wildMeter = wildMeter;
  return STATE;
}

syncSharedState();

// ----- progress wrapper (delegira HUD-u) -----
let hudUpdateProgress = (ratio, animate) => {};
// HUD metrics (for DOM helpers to position UI under HUD)
let __hudMetrics = { top: 0, bottom: 80 };
let allowWildDecrease = false;
function queueWildSpawnIfNeeded(){
  if (wildSpawnInProgress) return;
  if (wildMeter < 1) return;

  console.log('🎯 Wild meter ready – queueing wild spawn');
  wildSpawnInProgress = true;

  try { HUD.shimmerProgress?.({}); } catch {}

  spawnWildFromMeter()
    .then((spawned) => {
      if (!spawned && !wildSpawnRetryTimer) {
        wildSpawnRetryTimer = setTimeout(() => {
      wildSpawnRetryTimer = null;
      queueWildSpawnIfNeeded();
    }, 600);
  }
})
    .catch((error) => {
      console.error('❌ Wild spawn error:', error);
    })
    .finally(() => {
      wildSpawnInProgress = false;
      if (wildMeter >= 1 && !wildSpawnRetryTimer) {
        Promise.resolve().then(() => queueWildSpawnIfNeeded());
      }
    });
}

function scheduleWildRescue(reason = 'unknown', requested = 2) {
  if (wildRescueScheduled) {
    console.log('🛟 Wild rescue already scheduled, skipping duplicate request:', reason);
    return;
  }
  if (typeof openEmpties !== 'function') {
    console.warn('🛟 Wild rescue requested but openEmpties is unavailable:', reason);
    return;
  }

  wildRescueScheduled = true;
  const count = Math.max(1, Math.min(3, requested | 0));
  console.log('🛟 Scheduling wild rescue spawn:', { reason, count });

  openEmpties(count)
    .catch(error => {
      console.warn('🛟 Wild rescue spawn failed:', error);
    })
    .finally(() => {
      wildRescueScheduled = false;
      gsap.delayedCall(0.05, () => {
        try { checkLevelEnd(); } catch (err) { console.warn('🛟 Post-rescue checkLevelEnd failed:', err); }
      });
    });
}

function setWildProgress(ratio, animate=false){
  console.log('🔥 DRAMATIC: setWildProgress called with:', { ratio, animate });

  const target = Math.max(0, Number.isFinite(ratio) ? ratio : 0);
  wildMeter = target;
  STATE.wildMeter = target; // raw value (may exceed 1)

  const displayRatio = Math.min(1, wildMeter);
  console.log('🔥 DRAMATIC: Wild meter raw:', wildMeter, 'display:', displayRatio);

  try {
    HUD.updateProgressBar?.(displayRatio, !!animate);
    console.log('✅ DRAMATIC: HUD.updateProgressBar called successfully');
  } catch (error) {
    console.error('❌ DRAMATIC: Error calling HUD.updateProgressBar:', error);
  }

  if (wildMeter >= 1) {
    queueWildSpawnIfNeeded();
  }
}
let updateProgressBar = (ratio, animate=false) => setWildProgress(ratio, animate);
function addWildProgress(amount){
  console.log('🔥🔥🔥 addWildProgress CALLED! Amount:', amount, 'Current wildMeter:', wildMeter);
  
  // Kill any existing animations first
  try {
    gsap.killTweensOf(wild?.view?._fill);
    gsap.killTweensOf({ width: 0 });
    if (wild?.view?._currentAnimation) {
      wild.view._currentAnimation.kill();
      wild.view._currentAnimation = null;
    }
    console.log('🔥 addWildProgress: Previous animations killed');
  } catch (e) {
    console.warn('⚠️ addWildProgress: Error killing animations:', e);
  }
  
  const inc = Number.isFinite(amount) ? amount : 0;
  if (inc <= 0) {
    console.log('⚠️ addWildProgress: Ignoring non-positive increment:', inc);
    return;
  }

  const target = wildMeter + inc;
  console.log('🔥 NEW LOGIC: Direct wild meter update to raw value:', target);
  setWildProgress(target, true);

  // DEBUG: Force test wild meter with clamped ratio
  const displayRatio = Math.min(1, wildMeter);
  console.log('🧪 DEBUG: Testing wild meter directly...');
  console.log('🧪 DEBUG: wild available:', !!wild);
  console.log('🧪 DEBUG: wild.setProgress available:', !!(wild && wild.setProgress));
  if (wild && wild.setProgress) {
    wild.setProgress(displayRatio, true);
    console.log('✅ DEBUG: Direct wild.setProgress called with display ratio:', displayRatio);
  } else {
    console.warn('⚠️ DEBUG: wild or wild.setProgress not available');
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
  './assets/mystery-box.png',
  './assets/mistery-box.png',
  './assets/mystery-box.jpeg',
  './assets/mistery-box.jpeg'
].filter(Boolean);

const COIN_CANDIDATES = [
  CONSTS.ASSET_COIN,
  './assets/gold-coin.png',
  './assets/gold-coin.jpeg'
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
  
  // Reset user made move flag for new game
  window._userMadeMove = false;
  console.log('🔄 Reset user made move flag for new game');
  
  // CRITICAL: Check for unsaved high score on boot
  setTimeout(() => {
    if (typeof window.checkForUnsavedHighScore === 'function') {
      window.checkForUnsavedHighScore();
    }
  }, 2000);
  
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
    background: 0xf3eee8, // Game background color
    antialias: false, // Disable antialiasing for pixel-perfect rendering
    // Use full device pixel ratio for maximum crispness
    resolution: window.devicePixelRatio || 1,
    powerPreference: "high-performance" // Optimize for performance
  });
  
  // Add fade in animation for background transition
  app.canvas.style.opacity = '0';
  app.canvas.style.transition = 'opacity 0.6s ease';
  setTimeout(() => {
    app.canvas.style.opacity = '1';
  }, 50);
  
  // Add background transition animation
  app.renderer.backgroundColor = 0xf3eee8; // Start with gradient color
  setTimeout(() => {
    app.renderer.backgroundColor = 0xf3eee8; // Transition to game background
  }, 50);
  
  // Add CSS background transition animation
  const appElement = document.getElementById('app');
  const canvasElement = app.canvas;
  if (appElement) {
    appElement.style.background = 'var(--app-gradient, linear-gradient(180deg, #f5f5f5 0%, #FBE3C5 100%))';
    setTimeout(() => {
      appElement.style.background = '#f3eee8';
    }, 50);
  }
  if (canvasElement) {
    canvasElement.style.background = 'var(--app-gradient, linear-gradient(180deg, #f5f5f5 0%, #FBE3C5 100%))';
    setTimeout(() => {
      canvasElement.style.background = '#f3eee8';
    }, 50);
  }
  host.appendChild(app.canvas);
  app.canvas.style.touchAction = 'none';
  app.canvas.style.zIndex = '10'; /* Above background, below sliders */
  
  // Optimize canvas for pixel-perfect rendering
  app.canvas.style.imageRendering = 'pixelated';
  app.canvas.style.imageRendering = '-webkit-optimize-contrast';
  
  // Basic setup
  stage   = app.stage; stage.sortableChildren = true;
  board   = new Container(); board.sortableChildren = true;
  boardBG = new Graphics();
  hud     = new Container(); hud.eventMode = 'none';

  board.zIndex = 100; hud.zIndex = 10000;
  stage.addChild(board, hud);
  board.addChildAt(boardBG, 0); boardBG.zIndex = -1000; board.sortChildren();
  
  // Initialize fixed background layer AFTER layout is set
  // (will be called from startGame after layout())
  
  syncSharedState();

  stage.eventMode = 'static';
  stage.hitArea   = new Rectangle(0, 0, app.renderer.width, app.renderer.height);

  // Resolve prize assets - DEFER non-critical prize loading to avoid delay
  // These are only needed during endgame, not for initial board
  setTimeout(() => {
    loadFirstTexture(MYSTERY_CANDIDATES).then(path => { MYSTERY_PATH = path; }).catch(() => {});
    loadFirstTexture(COIN_CANDIDATES).then(path => { COIN_PATH = path; }).catch(() => {});
  }, 0);

  // Load ONLY critical game assets for instant start
  // tile_numbers2/3/4 are deferrable - can load in background
  await Assets.load([ASSET_TILE, ASSET_NUMBERS, ASSET_WILD]);
  
  // Load additional tile number sheets in background (non-blocking)
  Assets.load([ASSET_NUMBERS2, ASSET_NUMBERS3, ASSET_NUMBERS4]).catch(() => {});
  
  // Optimize all loaded textures for pixel-perfect rendering
  const loadedTextures = [ASSET_TILE, ASSET_NUMBERS, ASSET_NUMBERS2, ASSET_NUMBERS3, ASSET_NUMBERS4, ASSET_WILD];
  for (const assetPath of loadedTextures) {
    try {
      const texture = Assets.get(assetPath);
      if (texture && texture.baseTexture) {
        texture.baseTexture.scaleMode = SCALE_MODES.NEAREST;
      }
    } catch (error) {
      // Silently fail texture optimization
    }
  }
  
  // Fonts are already loaded via CSS @font-face in index.html
  // No need to load fonts dynamically - PIXI will use CSS fonts automatically
  
  // drag
  const ret = installDrag({
    app, board, TILE,
    getTiles: () => tiles,
    getGrid: () => grid, // Add getGrid function for drag system
    cellXY, // Add cellXY function
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
  boardNumber = 1;
  moves = MOVES_MAX;
  startLevel(1);
  
  // Force HUD reinit after board numbering changes
  _hudInitDone = false;
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
      html,body{ margin:0; padding:0; background:var(--app-gradient, linear-gradient(180deg, #f5f5f5 0%, #FBE3C5 100%)); height:auto; }
      body{ min-height:100dvh; overflow:hidden; }
      #app{ position:fixed; inset:0; width:100vw; height:100dvh; background:var(--app-gradient, linear-gradient(180deg, #f5f5f5 0%, #FBE3C5 100%)); z-index:10; transition: background 0.6s ease; }
      canvas{ position:absolute; inset:0; width:100vw; height:100dvh; display:block; background:var(--app-gradient, linear-gradient(180deg, #f5f5f5 0%, #FBE3C5 100%)); z-index:10; transition: background 0.6s ease; }
      @font-face{ font-family:"LTCrow"; src:url("./assets/fonts/LTCrow-Regular.ttf") format("truetype"); font-weight:400; font-style:normal; font-display:swap; }
      @font-face{ font-family:"LTCrow"; src:url("./assets/fonts/LTCrow-Medium.ttf") format("truetype"); font-weight:500; font-style:normal; font-display:swap; }
      @font-face{ font-family:"LTCrow"; src:url("./assets/fonts/LTCrow-SemiBold.ttf") format("truetype"); font-weight:600; font-style:normal; font-display:swap; }
      @font-face{ font-family:"LTCrow"; src:url("./assets/fonts/LTCrow-Bold.ttf") format("truetype"); font-weight:700; font-style:normal; font-display:swap; }
      @font-face{ font-family:"LTCrow"; src:url("./assets/fonts/LTCrow-ExtraBold.ttf") format("truetype"); font-weight:800; font-style:normal; font-display:swap; }
    `;
    document.head.appendChild(style);
  }

  // Function to trigger clean board screen for testing
  async function showCleanBoardOverlay() {
    console.log('🧪 Testing: Triggering clean board screen from menu Done button');
    
    // Set busyEnding to prevent other interactions
    busyEnding = true;
    
    try {
      await runEndgameFlow({
        app,
        stage,
        board,
        boardBG,
        level,
        startLevel,
        score,
        getScore: () => score,
        setScore: (v) => { score = v|0; updateHUD(); },
        animateScore,
        updateHUD,
        boardNumber,
        hideGrid: () => { try { board.visible = false; hud.visible = false; drawBoardBG('none'); } catch {} },
        showGrid: () => { try { board.visible = true;  hud.visible = true;  drawBoardBG(); } catch {} }
      });
    } finally {
      busyEnding = false;
    }
  }

  // Debug mini-API (ostavljeno)
  window.CC = {
    nextLevel: () => startLevel(level + 1),
    retry:     () => startLevel(level),
    state:     () => ({ level, score, board: boardNumber, moves, wildMeter, tiles: tiles.length }),
    app, stage, board,
    getScore: () => score,
    setScore: (v) => { score = (v|0); updateHUD(); },
    animateScoreTo: (v, d=0.45) => animateScore((v|0), d),
    updateHUD: () => updateHUD(),
    getHudMetrics: () => ({ ...__hudMetrics }),
    getUnifiedHudInfo: () => HUD.getUnifiedHudInfo ? HUD.getUnifiedHudInfo() : { y: 0, height: 0, parent: null, dropped: false },
    hideGameUI: () => { try { board.visible = false; hud.visible = false; drawBoardBG('none'); } catch {} },
    showGameUI: () => { try { board.visible = true;  hud.visible = true;  drawBoardBG(); } catch {} },
    testCleanBoard: async () => { /* ... tvoja baza ... */ },
    testCleanAndPrize: async () => { /* ... tvoja baza ... */ },
    pauseGame: () => pauseGame(),
    resumeGame: () => resumeGame(),
    resume: () => resumeGame(),
    restart: () => restart(),
    showCleanBoardOverlay: () => showCleanBoardOverlay(),
  };
  window.testCleanAndPrize = () => window.CC.testCleanAndPrize();

  // Run layout after viewport/meta/styles are in place to get correct safe-area values
  try {
    requestAnimationFrame(() => layout());
  } catch {
    layout();
  }

  syncSharedState();
}

// -------------------- layout + HUD --------------------
export function layout(){
  const { w, h} = boardSize();
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
  const TOP_PAD   = 20 + Math.round(vh * 0.004); // Move HUD lower (now 0.4% = ~4px on iPhone 13)
  const BOT_PAD   = (isMobilePortrait ? 24 : 24) + SAB;
  const GAP_HUD   = 24;

  // For mobile devices, HUD will be positioned below notch, so calculate board positioning accordingly
  const isMobile = vw < 768 || vh > vw;
  let safeTop, hudBottom;
  
  if (isMobile) {
    // Mobile: HUD and board positioned EXACTLY 48px below notch (24px + 24px more)
    const safeAreaTop = Math.max(44, adjustedSAT);
    safeTop = safeAreaTop + 48; // EXACTLY 48px below notch (24px + 24px more)
    hudBottom = safeTop + HUD_H + GAP_HUD;
    __hudMetrics.top = Math.round(safeTop);
    __hudMetrics.bottom = Math.round(hudBottom);
    
    console.log('📱 Mobile: HUD positioned EXACTLY 48px below notch, safeTop:', safeTop, 'px');
  } else {
    // Desktop: Use calculated safe area positioning
    safeTop = TOP_PAD + adjustedSAT;
    hudBottom = safeTop + HUD_H + GAP_HUD;
    console.log('🖥️ Desktop: HUD at y:', safeTop, 'px, board starts at y:', hudBottom);
  }
  
  const isIPad = vw >= 768 && vw <= 1400;
  
  // Raise HUD by 56px on iPad (total)
  if (isIPad) {
    safeTop -= 56;
    hudBottom -= 56;
  }
  
  // Raise HUD by additional 40px on iPhone (in percentages)
  if (isMobile && !isIPad) {
    const additionalOffset = Math.round(vh * 0.047); // ~40px on iPhone 13 (844px height)
    safeTop -= additionalOffset;
    hudBottom -= additionalOffset;
    console.log('📱 iPhone: Raised HUD by', additionalOffset, 'px (4.7% of vh)');
  }
  
  const BOARD_NUDGE_PX = 8; // original board nudge (was 4)
  
  // Scale board to fit screen width
  const HUD_PADDING = 24;
  const IPAD_BOARD_PADDING = 40; // iPad-specific board padding
  
  // Calculate available height and centerY first
  const availableHeight = vh - hudBottom - BOT_PAD;
  
  let availableWidth, s, sw, sh, boardX, boardY;
  
  if (isIPad) {
    // iPad: full width with 40px edge-to-edge board
    availableWidth = vw - (IPAD_BOARD_PADDING * 2);
    const widthScale = availableWidth / w;
    s = widthScale; // Force board to match availableWidth exactly
    
    sw = w * s;
    sh = h * s;
    boardX = IPAD_BOARD_PADDING; // Left edge flush with 40px padding
    // Gap between HUD and board: exactly 24px
    const boardTopGap = 24;
    boardY = Math.round(hudBottom + boardTopGap); // Board starts after HUD + 24px gap
  } else {
    // Mobile/Desktop: match HUD width
    availableWidth = vw - (HUD_PADDING * 2);
    const widthScale = availableWidth / w;
    const heightScale = availableHeight / h;
    s = Math.min(widthScale, heightScale);
    
    sw = w * s;
    sh = h * s;
    const idealLeft = Math.round((vw - sw) / 2);
    const minLeft = HUD_PADDING;
    const maxLeft = vw - HUD_PADDING - sw;
    boardX = Math.min(Math.max(idealLeft, minLeft), maxLeft);
    const centerY = hudBottom + availableHeight / 2;
    boardY = Math.round(centerY - sh / 2 + 8); // Move board down by 8px
  }
  
  console.log('🎯 Board scaling:', { 
    availableWidth, 
    widthScale: availableWidth / w, 
    heightScale: availableHeight / h, 
    finalScale: s,
    padding: isIPad ? `${IPAD_BOARD_PADDING}px` : `${HUD_PADDING}px`
  });
  
  board.scale.set(s, s);
  board.x = boardX;
  board.y = boardY;
  
  console.log('🎯 Board positioned at y:', board.y, 'px (available height:', availableHeight, 'px, board height:', sh, 'px)');
  
  console.log('🎯 Board positioning (HUD below notch on mobile):', {
    isMobile,
    safeTop,
    hudBottom,
    availableHeight,
    centerY: board.y,
    boardHeight: sh,
    viewportHeight: vh,
    topPad: TOP_PAD,
    isIPad
  });

  // Don't clear ghost placeholders - they should stay visible
  // drawBoardBG('none');
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
        HUD.updateHUD({ score, board: boardNumber, moves, combo });
        console.log('✅ HUD updated with:', { score, board: boardNumber, moves, combo });
      }
      
      // CRITICAL: Call HUD.layout to update HUD positioning
      if (typeof HUD.layout === 'function') {
        HUD.layout({ app, top: safeTop });
        console.log('✅ HUD layout updated');
      }

  // After HUD has laid out the wild preloader, recenter board between
  // the bottom edge of the PIXI wild meter and the bottom of the screen.
  try {
    const wildY = (wild?.view?.y ?? 0);
    const wildH = (wild?.view?.height ?? 8);
    const hudRoot = wild?.view?.parent || null; // HUD_ROOT
    // If HUD is mid-drop (hidden above), use its target top for layout so board doesn't jump.
    const hudYForLayout = hudRoot
      ? (hudRoot._dropped ? (hudRoot.y ?? safeTop) : (hudRoot._dropTop ?? safeTop))
      : safeTop;
    // dynamic bottom = intended HUD top + wild local y + wild height + gap
    const dynamicHudBottom = hudYForLayout + wildY + wildH + GAP_HUD;
    __hudMetrics.bottom = Math.round(dynamicHudBottom);
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
    // CENTER BOARD VERTICALLY in the space between wild bottom and bottom of screen
    // Use percentage-based positioning for responsive centering
    const avail2 = vh - dynamicHudBottom - BOT_PAD;
    // Center at exactly 50% of available space, with 16px extra offset down
    const center2 = dynamicHudBottom + (avail2 - sh2) / 2;
    board.y = Math.round(center2 + 16); // Move board down by 16px
    console.log('🎯 Recentered board using PIXI wild meter (centered 50%):', { dynamicHudBottom, center2, wildY, wildH, s2, hudYForLayout, avail2 });
  } catch (e) {
    console.warn('⚠️ Could not recenter using PIXI wild meter, using estimate.', e);
  }
    } else {
      console.warn('⚠️ HUD.initHUD is not a function');
    }
  } catch (error) {
    console.error('❌ Error during HUD initialization/update in app.js layout:', error);
    // Reset HUD flag on error to retry next time
    _hudInitDone = false;
  }
  
  // Start idle bounce animations for tiles with pips
  if (TILE_IDLE_BOUNCE.ENABLE) {
    try {
      TILE_IDLE_BOUNCE.start(tiles, board);
      console.log('✅ Tile idle bounce started');
    } catch (error) {
      console.warn('⚠️ Failed to start tile idle bounce:', error);
    }
  }
}

function boardSize(){ return { w: COLS*TILE + (COLS-1)*GAP, h: ROWS*TILE + (ROWS-1)*GAP }; }

function cellXY(c, r){ return { x: c*(TILE+GAP), y: r*(TILE+GAP) }; }

// PROFESSIONAL SOLUTION: Fixed background layer with all ghost placeholders
// Created once, never destroyed, always visible
let backgroundLayer = null;

function initializeBackgroundLayer(){
  // CRITICAL: Always create new background layer for each game
  const PAD=5, RADIUS=Math.round(TILE*0.26), WIDTH=8, COLOR=0xEBE6E2, ALPHA=0.64;
  
  // Remove existing background layer if it exists
  if (backgroundLayer) {
    try {
      board.removeChild(backgroundLayer);
      backgroundLayer.destroy({ children: true });
    } catch (e) {
      console.warn('⚠️ Error removing existing background layer:', e);
    }
  }
  
  // Create a new dedicated container for background elements
  backgroundLayer = new Container();
  backgroundLayer.zIndex = -10000; // Always at the very bottom
  backgroundLayer.eventMode = 'none'; // Non-interactive
  backgroundLayer.label = 'BackgroundLayer'; // For debugging
  
  // Add to board
  board.addChildAt(backgroundLayer, 0);
  
  console.log('🎯 Creating FIXED background layer with all ghost placeholders');
  
  // Create ghost placeholder for EVERY cell
  // Store reference in 2D array for easy access
  window._ghostPlaceholders = [];
  
  for (let r=0;r<ROWS;r++){
    window._ghostPlaceholders[r] = [];
    for (let c=0;c<COLS;c++){
      const pos = cellXY(c, r);
      const ghost = new Graphics();
      ghost.roundRect(pos.x+PAD, pos.y+PAD, TILE-PAD*2, TILE-PAD*2, RADIUS);
      ghost.stroke({ color:COLOR, width:WIDTH, alpha:ALPHA });
      ghost.eventMode = 'none';
      ghost.label = `Ghost_${c}_${r}`;
      ghost.zIndex = -10000;
      ghost.visible = false; // Start HIDDEN - will be shown when user starts moving tiles
      backgroundLayer.addChild(ghost);
      window._ghostPlaceholders[r][c] = ghost; // Store reference
    }
  }
  
  board.sortChildren();
  
  console.log('✅ FIXED background layer created with', ROWS * COLS, 'ghost placeholders');
  console.log('✅ This layer will NEVER be modified or destroyed');
  console.log('🔍 Background layer zIndex:', backgroundLayer.zIndex);
}

// Helper function to hide/show ghost at specific position
function setGhostVisibility(c, r, visible) {
  try {
    if (window._ghostPlaceholders && window._ghostPlaceholders[r] && window._ghostPlaceholders[r][c]) {
      window._ghostPlaceholders[r][c].visible = visible;
      console.log('🎯 setGhostVisibility:', c, r, visible ? 'visible' : 'hidden');
    }
  } catch {}
}

// Update ghost visibility based on current grid state
// SIMPLE RULE: Show ghost ONLY where grid cell is null (no tile at all)
function updateGhostVisibility() {
  if (!window._ghostPlaceholders) return;
  
  console.log('🎯 Updating ghost visibility - SIMPLE RULE: show only on empty cells');
  let visibleCount = 0;
  
  for (let r=0; r<ROWS; r++) {
    for (let c=0; c<COLS; c++) {
      const cell = grid[r]?.[c];
      const shouldShow = (cell === null); // Show ONLY if no tile exists
      
      if (window._ghostPlaceholders[r] && window._ghostPlaceholders[r][c]) {
        window._ghostPlaceholders[r][c].visible = shouldShow;
        if (shouldShow) visibleCount++;
      }
    }
  }
  
  console.log('✅ Ghost visibility updated:', visibleCount, 'visible (empty cells only)');
}

// Export to window for use in board.js
window.setGhostVisibility = setGhostVisibility;
window.updateGhostVisibility = updateGhostVisibility;

// Compatibility function - does nothing (background is always there)
function drawBoardBG(mode = 'active+empty'){
  // Background layer is fixed and always visible
  // This function is kept for compatibility but does nothing
  if (!backgroundLayer) {
    console.warn('⚠️ drawBoardBG called but background layer not initialized');
    initializeBackgroundLayer();
  }
}

function pulseBoardZoom(factor = 0.92, opts = {}) {
  if (!board) return;
  try { board._wildZoomTl?.kill?.(); } catch {}

  const { w: baseW, h: baseH } = boardSize();
  const sx0 = board.scale?.x ?? 1;
  const sy0 = board.scale?.y ?? 1;
  const x0 = board.x ?? 0;
  const y0 = board.y ?? 0;

  const displayW = baseW * sx0;
  const displayH = baseH * sy0;

  const scaleFactor = Math.max(0.75, Math.min(0.99, factor));
  const translateFactor = Math.max(0, Math.min(1, opts.translateFactor ?? 0.4));
  const userOnComplete = typeof opts.onComplete === 'function' ? opts.onComplete : null;
  const dx = ((displayW - displayW * scaleFactor) / 2) * translateFactor;
  const dy = ((displayH - displayH * scaleFactor) / 2) * translateFactor;

  const outDur = opts.outDur ?? 0.12;
  const inDur  = opts.inDur  ?? 0.22;
  const hold   = Math.max(0, opts.hold ?? 0.05);
  const outEase = opts.outEase ?? 'power3.out';
  const inEase  = opts.inEase  ?? 'elastic.out(1, 0.6)';

  const tl = gsap.timeline({ onComplete: () => { board._wildZoomTl = null; try { userOnComplete?.(); } catch {} } });

  tl.to(board.scale, {
    x: sx0 * scaleFactor,
    y: sy0 * scaleFactor,
    duration: outDur,
    ease: outEase
  }, 0);

  tl.to(board, {
    x: x0 + dx,
    y: y0 + dy,
    duration: outDur,
    ease: outEase
  }, 0);

  tl.to(board.scale, {
    x: sx0,
    y: sy0,
    duration: inDur,
    ease: inEase
  }, `>${hold}`);

  tl.to(board, {
    x: x0,
    y: y0,
    duration: inDur,
    ease: inEase
  }, `>${hold}`);

  board._wildZoomTl = tl;
  return tl;
}

const updateHUD = () => {
  console.log('🎯 updateHUD called with:', { score, board: boardNumber, moves, combo });
  syncSharedState();
  
  try {
    // First try to use HUD from hud-helpers.js
    if (typeof HUD.updateHUD === 'function') { 
      console.log('🎯 Calling HUD.updateHUD from hud-helpers.js');
      HUD.updateHUD({ score, board: boardNumber, moves, combo }); 
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
      _updateHUD({ score, board: boardNumber, moves, combo }); 
      return; 
    }
  } catch (error) {
    console.error('❌ Error calling _updateHUD:', error);
  }
  
  // Legacy fallback
  console.log('🎯 Using legacy fallback for HUD update');
  if (boardNumText) boardNumText.text = `#${boardNumber}`;
  if (scoreNumText) scoreNumText.text = String(score);
  if (comboNumText) comboNumText.text = `x${combo}`;
};

function animateScore(toValue, duration=0.45){
  if (typeof _animateScore === 'function') {
    _animateScore({ scoreRef: () => score, setScore: v => { score=v; }, updateHUD, SCORE_CAP, gsap }, toValue, duration);
  } else {
    HUD.animateScore({ scoreRef: () => score, setScore: v => { score=v; }, updateHUD, SCORE_CAP, gsap }, toValue, duration);
  }
}
function animateBoardHUD(toValue, duration=0.45){
  if (typeof _animateBoard === 'function') {
    _animateBoard({ boardRef: () => boardNumber, setBoard: v => { boardNumber=v; }, updateHUD, gsap }, toValue, duration);
  } else {
    try { _setBoard?.(toValue); } catch {}
    boardNumber = toValue|0; updateHUD();
  }
}
function fixHoverAnchor(t){ try { if (t && t.hover) { t.hover.x=TILE/2; t.hover.y=TILE/2; } } catch {} }

// -------------------- board build --------------------
function resetBoardContainer(){
  console.log('🔄 resetBoardContainer (app.js): Board children count:', board.children.length);
  console.log('🔄 resetBoardContainer (app.js): Board children labels:', board.children.map(c => c.label || c.constructor.name));
  
  // Get backgroundLayer before removing children
  const bgLayer = board.children.find(c => c.label === 'BackgroundLayer');
  console.log('🔄 resetBoardContainer (app.js): Found backgroundLayer:', !!bgLayer);
  
  board.removeChildren();
  
  // Re-add persistent layers
  board.addChildAt(boardBG, 0);
  if (bgLayer) {
    board.addChildAt(bgLayer, 0); // Always at index 0 (bottom)
    console.log('✅ resetBoardContainer (app.js): Background layer preserved');
  } else {
    console.warn('⚠️ resetBoardContainer (app.js): Background layer NOT found - will need reinit');
  }
  
  boardBG.zIndex = -1000;
  boardBG.eventMode = 'none';
  board.sortableChildren = true;
  board.sortChildren();
  
  console.log('🔄 resetBoardContainer (app.js): Final children count:', board.children.length);
}
function rebuildBoard(){
  resetBoardContainer();
  tiles.forEach(t=>t.destroy({children:true, texture:false, textureSource:false}));
  tiles.length=0;
  createEmptyGrid();
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
  drawBoardBG('active+empty');
  
  // Hide all ghost placeholders during board setup animation
  if (backgroundLayer) {
    backgroundLayer.visible = false;
    console.log('🎯 Hiding ghost placeholders during sweetPopIn animation');
  }
  
  // Start animation immediately - NO WAITING
  console.log('🎯 Starting sweetPopIn from app.js with', tiles.length, 'tiles');
  sweetPopIn(tiles, {
    onHalf: () => {
      if (_hudDropPending){
        try { HUD.playHudDrop?.({}); } catch {}
        _hudDropPending = false;
      }
    }
  }).then(() => {
    // Show ghost placeholders after animation completes
    if (backgroundLayer) {
      backgroundLayer.visible = true;
      console.log('✅ Showing ghost placeholders after sweetPopIn');
    }
    
    // Update ghost visibility after tiles are set up
    // Hide ghosts only under locked tiles that REMAIN locked
    if (typeof window.updateGhostVisibility === 'function') {
      window.updateGhostVisibility();
    }
    console.log('✅ sweetPopIn completed - ghost visibility updated');
  });
  console.log('✅ sweetPopIn started immediately - no waiting');

  syncSharedState();

}

// Board exit animation - reverse of sweetPopIn
async function animateBoardExit(){
  console.log('🎬 Starting board exit animation...');
  
  // CRITICAL: Cleanup smoke bubbles immediately before exit animation
  try {
    if (typeof HUD.cleanupSmokeBubbles === 'function') {
      HUD.cleanupSmokeBubbles();
      console.log('✅ Board exit: Smoke bubbles cleaned up');
    }
  } catch (e) {
    console.warn('⚠️ Board exit: Error cleaning up smoke bubbles:', e);
  }
  
  // Use STATE.tiles directly (not the module-level const reference)
  const tilesToAnimate = STATE.tiles || [];
  console.log('🎯 Animate tiles:', tilesToAnimate.length, 'tiles');
  
  if (tilesToAnimate.length === 0) {
    console.warn('⚠️ No tiles to animate - skipping exit animation');
    return Promise.resolve();
  }
  
  // Play sweetPopOut with onHalf callback for HUD rise
  return sweetPopOut(tilesToAnimate, {
    onHalf: () => {
      console.log('🎯 50% tiles exited - triggering HUD rise');
      try { 
        HUD.playHudRise?.({}); 
      } catch (e) {
        console.warn('⚠️ Failed to call HUD.playHudRise:', e);
      }
    }
  }).then(() => {
    // CRITICAL: Wait for HUD rise animation to complete (800ms)
    // sweetPopOut completes at maxEndTime (~0.38-0.55s), but HUD rise (800ms) starts at 50%
    // Worst case: tiles finish at 1000ms, HUD starts at 500ms, finishes at 1300ms
    // So we need to wait at least 800ms MORE after sweetPopOut completes
    console.log('⏳ Waiting for HUD rise animation to complete (800ms)...');
    return new Promise(resolve => {
      setTimeout(resolve, 800);
    });
  });
}

function tintLocked(t){ try{ gsap.to(t, { alpha:0.35, duration:0.10, ease:'power1.out' }); }catch{} }
function randVal(){ return [1,1,1,2,2,3,3,4,5][(Math.random()*9)|0]; }
function startLevel(n){
  console.log('🎯 startLevel called with:', n, 'current level:', level, 'current boardNumber:', boardNumber, 'current score:', score);
  level = n; // Set level to the board number
  boardNumber = n; // Set board number to the level number
  
  // STATS TRACKING: Update highest board reached
  console.log('🎯 Updating highest board to:', n);
  try {
    statsService.updateHighestBoard(n);
    console.log('✅ Highest board updated successfully');
  } catch (error) {
    console.error('❌ Failed to update highest board:', error);
  }
  
  moves = MOVES_MAX;
  busyEnding = false;
  hudResetCombo();
  console.log('🎯 startLevel updated - level:', level, 'boardNumber:', boardNumber, 'score preserved:', score);
  try { comboIdleTimer?.kill?.(); } catch {}
  wildMeter = 0;
  resetWildProgress(0, false);
  
  // Start animation immediately - no delay
  rebuildBoard();
  
  // CRITICAL: Save game state immediately after starting Board 2+ to enable resume
  // This ensures that if user exits without making moves, they can still continue
  if (boardNumber >= 2) {
    console.log('💾 Board 2+ started, forcing immediate save for resume capability');
    // Force save after a short delay to ensure board is fully initialized
    setTimeout(() => {
      saveGameState();
      console.log('✅ Game state saved after Board 2+ start');
    }, 500);
  } 

  syncSharedState();
  updateHUD();
  
  // Initialize background layer after first layout
  layout();
  initializeBackgroundLayer();
  
  // Call layout only for initial game start, not for restart
  if (n === 1) {
    layout();
    console.log('🎯 Layout called for initial game start');
  }
  
  // Don't check level end immediately - let the game play first
  // gsap.delayedCall(0.1, checkLevelEnd); // REMOVED - causes immediate fail screen
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
    try { startWildShimmer(tile); } catch {} // Use shimmer instead of bounce
  }catch{}
}

// --- spawn exactly at grid cell ---
function openAtCell(c, r, { value=null, isWild=false } = {}){
  return new Promise((resolve)=>{
    let holder = grid?.[r]?.[c] || null;

    if (holder && !holder.locked) {
      const isWildTile = holder.special === 'wild' || holder.isWild === true || holder.isWildFace === true;
      if (isWildTile || (holder.value|0) > 0) {
        resolve(false);
        return;
      }
    }

    if (!holder) holder = makeBoard.createTile({ board, grid, tiles, c, r, val:0, locked:true });

    holder.locked = false;
    holder.eventMode = 'static';
    holder.cursor = 'pointer';
    if (drag && typeof drag.bindToTile === 'function') drag.bindToTile(holder);

    if (isWild){
      makeBoard.setValue(holder, 6, 0);
      holder.value = 6;
      holder.special = 'wild';
      holder.isWild = true;
      holder.isWildFace = true;
      if (typeof makeBoard.applyWildSkin === 'function') { makeBoard.applyWildSkin(holder); }
      else { applyWildSkinLocal(holder); }
      try { startWildShimmer(holder); } catch {} // Use shimmer instead of bounce
    } else {
      const v = (value == null) ? [1,2,3,4,5][(Math.random()*5)|0] : value;
      makeBoard.setValue(holder, v, 0);
    }

    holder.visible = true;
    holder.alpha = 0;
    SPAWN.spawnBounce(holder, gsap, { max: 1.08, compress: 0.96, rebound: 1.02, startScale: 0.30, wiggle: 0.035, fadeIn:0.10 }, () => {
      holder.alpha = 1;
      resolve(true);
    });
  });
}

function randomEmptyCell(){
  const empties = [];
  for (let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      const t = grid[r][c];
      const isGhost = !!(t && t.locked === true);
      const isMissing = !t;
      const isZero = !!(t && (t.value|0) <= 0);
      const isWildTile = !!(t && !t.locked && (t.special === 'wild' || t.isWild === true || t.isWildFace === true));
      const isActive = !!(t && !t.locked && (t.value|0) > 0);
      if (!isActive && !isWildTile && (isGhost || isMissing || isZero)) empties.push({ c, r });
    }
  }
  if (!empties.length) return null;
  return empties[(Math.random()*empties.length)|0];
}

async function spawnWildFromMeter(){
  if (wildMeter < 1) {
    console.log('⚠️ spawnWildFromMeter called without enough charge. Raw meter:', wildMeter);
    return false;
  }

  const consumeCharge = () => {
    const leftover = Math.max(0, wildMeter - 1);
    wildMeter = leftover;
    STATE.wildMeter = leftover;
    resetWildProgress(leftover, true);
  };

  const attempted = new Set();
  const maxAttempts = 12;
  let tries = 0;
  let spawned = false;
  let lastCell = null;

  while (tries < maxAttempts && !spawned) {
    const cell = randomEmptyCell();
    if (!cell) {
      tries++;
      await new Promise(r => setTimeout(r, 40));
      continue;
    }
    const key = `${cell.c},${cell.r}`;
    if (attempted.has(key)) {
      tries++;
      continue;
    }
    attempted.add(key);
    lastCell = cell;

    try {
      const ok = await openAtCell(cell.c, cell.r, { isWild: true });
      if (ok) {
        consumeCharge();
        spawned = true;
      } else {
        console.warn('⚠️ Wild spawn skipped (cell no longer empty):', cell);
        tries++;
      }
    } catch (error) {
      console.warn('⚠️ Wild spawn attempt failed at', cell, error);
      tries++;
    }
  }

  if (!spawned) {
    console.warn('🚨 CRITICAL: Unable to spawn wild cube after', tries, 'attempts. Meter remains at', wildMeter);
    return false;
  }

  if (wildSpawnRetryTimer) {
    clearTimeout(wildSpawnRetryTimer);
    wildSpawnRetryTimer = null;
  }

  console.log('✅ Wild cube spawned successfully at', lastCell?.c, lastCell?.r, 'Leftover meter:', wildMeter);
  return true;
}

// -------------------- merge --------------------

function pickWildValue(dstValue) {
  // Always exclude the target value to avoid spawning same number
  let candidates = [1,2,3,4,5].filter(v => v !== dstValue);
  
  console.log('🎯 pickWildValue: target was', dstValue, 'candidates:', candidates);

  // Smart logic: if target is high (4-5), prefer lower numbers (1-3)
  // if target is low (1-2), prefer higher numbers (3-5)
  if (dstValue >= 4) {
    // Target is high, prefer lower numbers
    const lowCandidates = candidates.filter(v => v <= 3);
    if (lowCandidates.length > 0) {
      candidates = lowCandidates;
      console.log('🎯 Preferring lower numbers:', candidates);
    }
  } else if (dstValue <= 2) {
    // Target is low, prefer higher numbers
    const highCandidates = candidates.filter(v => v >= 3);
    if (highCandidates.length > 0) {
      candidates = highCandidates;
      console.log('🎯 Preferring higher numbers:', candidates);
    }
  }

  // Fallback: if no candidates, use all except target
  if (candidates.length === 0) {
    candidates = [1,2,3,4,5].filter(v => v !== dstValue);
    console.log('🎯 Fallback to all except target:', candidates);
  }

  const result = candidates[(Math.random() * candidates.length) | 0];
  console.log('🎯 Final wild spawn value:', result);
  return result;
}
function merge(src, dst, helpers){
  console.log('🔥🔥🔥 MERGE FUNCTION CALLED! src:', src?.value, 'dst:', dst?.value);
  if (busyEnding) { helpers.snapBack?.(src); return; }
  if (src === dst) { helpers.snapBack(src); return; }
  if (src?.special === 'wild' && dst?.special === 'wild'){ helpers.snapBack?.(src); return; }

  const sum      = (src.value|0) + (dst.value|0);
  const srcDepth = src.stackDepth || 1;
  const dstDepth = dst.stackDepth || 1;

  const wildActive = (src.special === 'wild' || dst.special === 'wild');
  const wildTargetValue = wildActive ? ((src.special === 'wild') ? (dst.value|0) : (src.value|0)) : null;
  let effSum = sum;

  // Wild cube logic: always merge to 6, but remember target for later spawn
  if (wildActive) {
    effSum = 6; // Wild always merges to 6
    const avoidValue = Number.isFinite(wildTargetValue) ? wildTargetValue : null;
    dst._wildMergeTarget = avoidValue;
    console.log('🎯 Wild merge: target was', wildTargetValue, 'will merge to 6, spawn will avoid', avoidValue);
  }

  grid[src.gridY][src.gridX] = null;
  dst.eventMode = 'none';

  // ---- 2..5 (računaj combo i ovdje)
  if (effSum < 6){
    makeBoard.setValue(dst, effSum, srcDepth);
    if (wildActive) clearWildState(dst);
    score = Math.min(SCORE_CAP, score + effSum); 
    
    console.log('🎮 MERGE: Score updated to:', score);
    console.log('🎮 MERGE: statsService exists?', typeof statsService !== 'undefined');
    console.log('🎮 MERGE: statsService.updateHighScore exists?', typeof statsService?.updateHighScore === 'function');
    
    // STATS TRACKING: Update high score immediately after score update
    try {
      statsService.updateHighScore(score);
      console.log('✅ MERGE: statsService.updateHighScore called successfully');
    } catch (error) {
      console.error('❌ MERGE: statsService.updateHighScore failed:', error);
    }
    
    if (wildActive) {
      console.log('🎯 MERGE: Wild merge detected');
      try {
        statsService.incrementHelpersUsed(1);
        console.log('✅ MERGE: Incremented helpers used');
      } catch (error) {
        console.error('❌ MERGE: Failed to increment helpers used:', error);
      }
    }
    
    updateHUD();
    
    // Combo++ (bez realnog capa), bump anim
    hudSetCombo(combo + 1);
    try { HUD.bumpCombo?.({ kind: 'stack', combo }); } catch {}
    scheduleComboDecay();

    // Stats: track longest combo
    statsService.updateLongestCombo(combo);

    addWildProgress(WILD_INC_SMALL);
    
    // SMART SAVE: Save after every merge
    saveGameState();
    
    // Ghost placeholders are now fixed and always visible

    gsap.to(src, {
      x: dst.x, y: dst.y, duration: 0.08, ease: 'power2.out',
      onComplete: async () => {
        removeTile(src);
        dst.eventMode = 'static';
        if (wildActive) {
          try {
            screenShake(app, {
              strength: 26,
              duration: 0.36,
              steps: 26,
              ease: 'sine.inOut'
            });
          } catch {}

          glassCrackAtTile(board, dst, TILE * 1.3, 1.6);
          woodShardsAtTile(board, dst, { enhanced: true, wild: true, count: 26, intensity: 1.6, spread: 1.6, size: 1.4, speed: 0.9, vanishDelay: 0.0, vanishJitter: 0.015 });
          wildImpactEffect(dst, { squash: 0.24, stretch: 0.20, tilt: 0.14, bounce: 1.18 });
          smokeBubblesAtTile(board, dst, TILE * 1.2, 2.6);
        } else {
          FX.landBounce?.(dst);
          const softSmokeStrength = 0.5 + Math.random() * 0.3;
          smokeBubblesAtTile(board, dst, {
            tileSize: TILE,
            strength: softSmokeStrength,
            behind: true,
            sizeScale: 1.12,
            distanceScale: 0.7,
            countScale: 0.75,
            haloScale: 1.1,
            ttl: 0.9
          });
        }

        // countdown moves
        moves = Math.max(0, moves - 1);
        animateBoardHUD(boardNumber, 0.40);
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
    if (wildActive) clearWildState(dst);
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
        const wasWild = wildActive;
        if (wasWild) {
          const baseShake = Math.min(28, 12 + Math.max(1, mult) * 4);
          try {
            screenShake(app, {
              strength: baseShake,
              duration: 0.36,
              steps: 28,
              ease: 'sine.inOut'
            });
          } catch {}
          glassCrackAtTile(board, dst, TILE * 1.5, 2.0);
          woodShardsAtTile(board, dst, { enhanced: true, wild: true, count: 30, intensity: 1.9, spread: 1.8, size: 1.5, speed: 0.85, vanishDelay: 0.0, vanishJitter: 0.02 });
          wildImpactEffect(dst, { squash: 0.30, stretch: 0.26, tilt: 0.18, bounce: 1.24 });
        } else {
          const gentleSmokeStrength = 0.6 + Math.random() * 0.28;
          smokeBubblesAtTile(board, dst, {
            tileSize: TILE,
            strength: gentleSmokeStrength,
            behind: true,
            sizeScale: 1.16,
            distanceScale: 0.75,
            countScale: 0.8,
            haloScale: 1.15,
            ttl: 1.0
          });
          // Wooden shards for merge 6 (40% reduced)
          woodShardsAtTile(board, dst, { enhanced: true, wild: true, count: 18, intensity: 1.9, spread: 1.08, size: 0.9, speed: 0.85, vanishDelay: 0.0, vanishJitter: 0.02 });
        }

        // ► badge + pojačani "smoke/bubbles" + screen shake
        if (wasWild) {
          showMultiplierTile(board, dst, mult, TILE * 1.3, 1.2);
          smokeBubblesAtTile(board, dst, TILE * 1.3, 3.0, {
            sizeScale: 0.7 + Math.random() * 0.6,  // Random size: 0.7-1.3x
            countScale: 0.6 + Math.random() * 0.8, // Random count: 0.6-1.4x
            trailAlpha: 0.95
          });
        } else {
          showMultiplierTile(board, dst, mult, TILE, 1.0);
        }

        if (!wasWild) {
          try {
            const base = Math.min(24, 10 + Math.max(1, mult) * 3);
            screenShake(app, { strength: base, duration: 0.32, steps: 18, ease: 'power2.out' });
          } catch {}
        }

        // clean up dst slot
        const gx = dst.gridX, gy = dst.gridY;
        grid[gy][gx] = null;
        dst.visible = false;
        removeTile(dst);

        const willBeClean = isBoardClean();
        if (!willBeClean){
          const holder = makeBoard.createTile({ board, grid, tiles, c: gx, r: gy, val: 0, locked: true });
          holder.alpha = 0.35; holder.eventMode = 'none';
        }

        // countdown moves
        moves = Math.max(0, moves - 1);

        // scoring with bubble multiplier and combo multiplier
        const bubbleMult = mult || 1;
        const comboMult  = combo > 0 ? combo : 1;
        const scoreDelta = 6 * bubbleMult * comboMult;
        score = Math.min(SCORE_CAP, score + scoreDelta);

        animateBoardHUD(boardNumber, 0.40);
        animateScore(score, 0.40);

        // Stats: count merge-6 as "cubes cracked"
        statsService.incrementCubesCracked(1);
        if (wasWild) {
          statsService.incrementHelpersUsed(1);
        }
        
        // Stats: Track longest combo
        if (combo > 0) {
          statsService.updateLongestCombo(combo);
        }
        
        // Stats: Update high score for every merge
        statsService.updateHighScore(score);
        
        // Ghost placeholders are now fixed and always visible

        // ► CLEAN BOARD flow (centralized orchestrator)
        console.log('🔥 Checking if board is clean after merge...');
        if (isBoardClean()){
          console.log('🚨🚨🚨 BOARD IS CLEAN - STARTING ENDGAME FLOW! 🚨🚨🚨');
          busyEnding = true;
          
          // CRITICAL: Reset wild meter immediately to prevent visual residue
          console.log('🔥 CLEAN BOARD: Resetting wild meter immediately...');
          wildMeter = 0;
          STATE.wildMeter = 0;
          resetWildProgress(0, false);
          
          // Force immediate HUD update to clear wild meter visually
          try {
            if (typeof HUD.resetWildMeter === 'function') {
              HUD.resetWildMeter(true); // instant = true for immediate reset
            } else {
              HUD.updateProgressBar?.(0, false);
            }
            console.log('✅ CLEAN BOARD: Wild meter reset completed');
          } catch (error) {
            console.warn('⚠️ CLEAN BOARD: Failed to reset wild meter:', error);
          }

          try {
            try { await new Promise(res => setTimeout(res, 1000)); } catch {}
            await runEndgameFlow({
              app,
              stage,
              board,
              boardBG,
              level,
              startLevel,
              score,
              getScore: () => score,
              setScore: (v) => { score = v|0; updateHUD(); },
              animateScore,
              updateHUD,
              boardNumber,
              hideGrid: () => { try { board.visible = false; hud.visible = false; drawBoardBG('none'); } catch {} },
              showGrid: () => { try { board.visible = true;  hud.visible = true;  drawBoardBG(); } catch {} }
            });
          } finally {
            busyEnding = false;
          }
          return;
        }

        if (moves === 0) {
          checkMovesDepleted();
        }

        addWildProgress(WILD_INC_BIG);
        // Pass wild merge target info for smart spawning
        const wildMergeTarget = Number.isFinite(wildTargetValue) ? wildTargetValue : null;
        await FLOW.openLockedBounceParallel({ 
          tiles, 
          k: mult, 
          drag, 
          makeBoard, 
          gsap, 
          drawBoardBG, 
          TILE, 
          fixHoverAnchor, 
          spawnBounce: (t, done, o)=>SPAWN.spawnBounce(t, gsap, o, done),
          wildMergeTarget 
        });
        
        // Update idle bounce tile list with newly spawned tiles
        if (TILE_IDLE_BOUNCE.ENABLE) {
          try {
            TILE_IDLE_BOUNCE.updateTileList(tiles);
            console.log('🔄 Updated idle bounce tile list after spawn');
          } catch (error) {
            console.warn('⚠️ Failed to update idle bounce tile list:', error);
          }
        }
        
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
  // Only end if truly stuck (no valid merges). Allows finishing chains with Wild even at 0 moves.
  try {
    // CRITICAL FIX: Check if any merge is possible before showing fail screen
    if (makeBoard.anyMergePossible(tiles)) {
      console.log('✅ checkMovesDepleted: anyMergePossible returned true, game continues');
      return;
    }
    if (!isStuck()) return;
  } catch {}
  if (busyEnding) return;
  busyEnding = true;
  showFinalScreen().finally(()=>{ busyEnding = false; });
}

// -------------------- stuck detection --------------------
function activeTilesList(){ try { return tiles.filter(t => t && !t.locked && (t.value|0) > 0); } catch { return []; } }
function isStuck(){
  console.log('🚨🚨🚨 CRITICAL: isStuck called - checking if game is stuck...');
  
  const act = activeTilesList();
  console.log('🚨 isStuck: Active tiles count:', act.length);
  
  // CRITICAL SAFETY: If we have wild cubes and any non-wild tiles, we're never stuck
  const wildCubes = act.filter(t => t.special === 'wild');
  const nonWildTiles = act.filter(t => t.special !== 'wild');
  
  console.log('🚨 isStuck: Wild cubes:', wildCubes.length, 'Non-wild tiles:', nonWildTiles.length);
  console.log('🚨 isStuck: Wild cubes details:', wildCubes.map(t => ({ value: t.value, special: t.special, locked: t.locked })));
  console.log('🚨 isStuck: Non-wild tiles details:', nonWildTiles.map(t => ({ value: t.value, special: t.special, locked: t.locked })));
  
  // CRITICAL FIX: If we have wild cubes, we're never stuck (wild can merge with any tile)
  if (wildCubes.length > 0) {
    console.log('✅ isStuck: SAFETY CHECK - Wild cubes exist, game NOT stuck (wild can merge with any tile)');
    return false;
  }
  
  // This is now handled by the check above
  
  // If we have less than 2 tiles total, we're stuck
  if (act.length < 2) {
    console.log('🚨 isStuck: Less than 2 active tiles, game is stuck');
    return true;
  }
  
  // Check for possible merges between non-wild tiles
  for (let i=0;i<act.length;i++){
    for (let j=i+1;j<act.length;j++){
      const a = act[i], b = act[j];
      
      // Skip wild cubes in this check (they can't merge with each other)
      if (a.special === 'wild' || b.special === 'wild') {
        continue;
      }
      
      // Normal merge check
      if (((a.value|0) + (b.value|0)) <= 6) {
        console.log('✅ isStuck: Normal merge possible', a.value, '+', b.value, 'game NOT stuck');
        return false;
      }
    }
  }
  
  console.log('🚨🚨🚨 isStuck: No possible merges found, game IS stuck');
  return true;
}

// -------------------- level-end scaffolding --------------------
function checkLevelEnd(){
  gsap.delayedCall(0.01, () => {
    if (busyEnding) return;
    
    // EMERGENCY SAFETY: If we have wild cubes but no non-wild tiles, spawn some!
    const act = activeTilesList();
    const wildCubes = act.filter(t => t.special === 'wild');
    const nonWildTiles = act.filter(t => t.special !== 'wild');
    
    if (wildCubes.length > 0 && nonWildTiles.length === 0) {
      console.log('🚨 EMERGENCY: Wild cubes exist but no non-wild tiles! Scheduling emergency rescue...');
      const emergencyCount = Math.min(3, Math.max(2, wildCubes.length));
      scheduleWildRescue('checkLevelEnd', emergencyCount);
      return;
    }
    
    // CRITICAL FIX: Check if any merge is possible before showing fail screen
    if (makeBoard.anyMergePossible(tiles)) {
      console.log('✅ checkLevelEnd: anyMergePossible returned true, game continues');
      return;
    }
    
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

function isBoardClean(){ 
  console.log('🚨🚨🚨 CRITICAL: isBoardClean called - checking for wild cubes...');
  
  // Get all tiles that are not locked
  const activeTiles = tiles.filter(t => t && !t.locked);
  const wildCubes = tiles.filter(t => t && t.special === 'wild' && !t.locked);
  const nonWildActiveTiles = activeTiles.filter(t => t.special !== 'wild');
  
  // Board is clean ONLY if there are NO active tiles at all (all locked or empty)
  const isClean = activeTiles.length === 0;
  
  console.log('🔥🔥🔥 CRITICAL isBoardClean CHECK:', {
    totalTiles: tiles.length,
    activeTiles: activeTiles.length,
    wildCubesCount: wildCubes.length,
    nonWildActiveTiles: nonWildActiveTiles.length,
    isClean,
    'ALL_TILES': tiles.map(t => ({ 
      value: t.value, 
      special: t.special, 
      locked: t.locked,
      gridX: t.gridX,
      gridY: t.gridY 
    })),
    'WILD_CUBES': wildCubes.map(t => ({ 
      value: t.value, 
      special: t.special, 
      locked: t.locked,
      gridX: t.gridX,
      gridY: t.gridY 
    })),
    'NON_WILD_ACTIVE': nonWildActiveTiles.map(t => ({ 
      value: t.value, 
      special: t.special, 
      locked: t.locked,
      gridX: t.gridX,
      gridY: t.gridY 
    }))
  });
  
  if (isClean) {
    console.log('🚨🚨🚨 BOARD IS CLEAN - NO ACTIVE TILES - TRIGGERING ENDGAME FLOW! 🚨🚨🚨');
  } else {
    console.log('✅ BOARD NOT CLEAN - ACTIVE TILES EXIST - Game continues');
  }
  
  return isClean;
}

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
  const idx = tiles.indexOf(t);
  if (idx !== -1) {
    tiles.splice(idx, 1);
  }
  t.destroy?.({children:true, texture:false, textureSource:false});
}

async function showFinalScreen(){
  let result = null;
  try {
    const { showBoardFailModal } = await import('./board-fail-modal.js');
    result = await showBoardFailModal({
      score: Math.max(0, score | 0),
      boardNumber: Math.max(1, boardNumber | 0)
    });
  } catch (error) {
    console.error('⚠️ Board fail modal failed, falling back to stars modal:', error);
    try {
      await showStarsModal({ app, stage, board, score, title: 'Game Over', subtitle: `Score ${score}` });
    } catch {}
  }

  // CRITICAL: Update high score using statsService
  statsService.updateHighScore(score);
  updateHUD();

  if (result?.action === 'menu') {
    try {
      // Navigation will be shown by markHomepageVisible() after slide animation
      
      await window.exitToMenu?.();
      window.goToSlide?.(0, { animate: true });
    } catch {}
  } else {
    // 'retry' action - functions are called directly from board-fail-modal now
    console.log('🎮 Play Again action received - functions called directly from modal');
  }
}

function restartGame(){
  console.log('🔄 Starting clean restart - preserving HUD position');
  
  // CRITICAL FIX: Reset game ended flag when restarting
  window._gameHasEnded = false;
  
  // CRITICAL: Update high score before restart using statsService
  try {
    if (typeof score !== 'undefined' && score > 0) {
      console.log('🏆 Updating high score before restart:', score);
      statsService.updateHighScore(score);
    }
  } catch (error) {
    console.warn('⚠️ Failed to update high score during restart:', error);
  }
  
  // Kill all GSAP animations first - CRITICAL to prevent null reference errors
  try {
    console.log('🔄 RESTART GAME: Killing all GSAP animations...');
    gsap.killTweensOf(wild?.view?._fill);
    gsap.killTweensOf({ width: 0 });
    if (wild?.view?._currentAnimation) {
      wild.view._currentAnimation.kill();
      wild.view._currentAnimation = null;
    }
    
    // CRITICAL: Kill tile animations before destroying them
    if (STATE && STATE.tiles && STATE.tiles.length > 0) {
      console.log('🔄 RESTART GAME: Killing GSAP animations for', STATE.tiles.length, 'tiles...');
      STATE.tiles.forEach(tile => {
        try {
          if (tile && tile.scale) {
            gsap.killTweensOf(tile.scale);
          }
          if (tile) {
            gsap.killTweensOf(tile);
          }
        } catch (e) {
          // Ignore errors for already destroyed tiles
        }
      });
      console.log('✅ RESTART GAME: Tile GSAP animations killed');
    }
    
    // Kill HUD animations
    if (STATE && STATE.hud) {
      try {
        console.log('🔄 RESTART GAME: Killing HUD GSAP animations...');
        gsap.killTweensOf(STATE.hud);
        gsap.killTweensOf(STATE.board);
        gsap.killTweensOf(STATE.stage);
        console.log('✅ RESTART GAME: HUD GSAP animations killed');
      } catch (e) {
        console.warn('⚠️ RESTART GAME: Error killing HUD animations:', e);
      }
    }
    
    // CRITICAL: Kill ALL GSAP tweens as nuclear option
    try {
      console.log('🔄 RESTART GAME: Nuclear option - killing ALL GSAP tweens...');
      // Kill all timelines and tweens
      const timelines = gsap.globalTimeline.getChildren(true, false, false);
      timelines.forEach(tl => {
        try { tl.kill(); } catch (e) {}
      });
      // Also clear global timeline
      try {
        gsap.globalTimeline.clear();
      } catch (e) {
        console.warn('⚠️ Failed to clear global timeline:', e);
      }
      console.log('✅ RESTART GAME: ALL GSAP tweens killed');
    } catch (e) {
      console.warn('⚠️ RESTART GAME: Error with nuclear GSAP kill:', e);
    }
    
    console.log('✅ RESTART GAME: All GSAP animations killed');
    
    // CRITICAL: Cleanup smoke bubbles before restart
    try {
      if (typeof HUD.cleanupSmokeBubbles === 'function') {
        HUD.cleanupSmokeBubbles();
        console.log('✅ RESTART GAME: Smoke bubbles cleaned up');
      }
    } catch (e) {
      console.warn('⚠️ RESTART GAME: Error cleaning up smoke bubbles:', e);
    }
  } catch (e) {
    console.warn('⚠️ RESTART GAME: Error killing GSAP animations:', e);
  }
  
  // Reset game state WITHOUT touching HUD positioning
  score = 0;
  boardNumber = 1;
  moves = MOVES_MAX;
  hudResetCombo();
  try { comboIdleTimer?.kill?.(); } catch {}
  wildMeter = 0;
  resetWildProgress(0, false);
  
  // HARD RESET: Use new resetWildMeter API for complete reset
  console.log('🔥 HARD RESET: Resetting wild meter to 0');
  try {
    if (typeof HUD.resetWildMeter === 'function') {
      HUD.resetWildMeter(true); // instant = true for immediate reset
    } else {
      console.log('🔄 FALLBACK: Using HUD.updateProgressBar with 0...');
      HUD.updateProgressBar?.(0, false);
    }
    console.log('✅ HARD RESET: Wild meter reset to 0 successfully');
  } catch (error) {
    console.error('❌ HARD RESET: Error resetting wild meter:', error);
  }
  
  // Reset both wild meter variables
  wildMeter = 0;
  STATE.wildMeter = 0;
  
  // EDGE CASE PROTECTION: Force wild meter reset with multiple methods
  try {
    console.log('🛡️ EDGE CASE: Force resetting wild meter with multiple methods...');
    
    // Method 1: Direct HUD update
    if (typeof HUD.updateProgressBar === 'function') {
      HUD.updateProgressBar(0, false);
    }
    
    // Method 2: Reset via setWildProgress
    setWildProgress(0, false);
    
    // Method 3: Direct wild meter variable reset
    wildMeter = 0;
    STATE.wildMeter = 0; // Reset both variables!
    
    // Method 4: Force update progress bar
    if (typeof HUD.updateProgressBar === 'function') {
      console.log('🔄 EDGE CASE: Calling HUD.updateProgressBar(0, false)...');
      HUD.updateProgressBar(0, false);
    }
    
    // Method 5: Force reset wild loader
    if (typeof HUD.resetWildLoader === 'function') {
      console.log('🔄 EDGE CASE: Calling HUD.resetWildLoader...');
      HUD.resetWildLoader();
    }
    
    // Method 6: Force update HUD
    updateHUD();
    
    // Method 7: Direct PIXI manipulation - force reset wild loader mask
    try {
      // Also try direct access to wild loader if available
      if (typeof wild !== 'undefined' && wild && wild.setProgress) {
        console.log('🔄 EDGE CASE: Direct wild.setProgress(0, false)...');
        wild.setProgress(0, false);
      }
    } catch (e) {
      console.warn('EDGE CASE: Direct PIXI reset failed:', e);
    }
    
    console.log('✅ EDGE CASE: Wild meter force reset completed');
  } catch (error) {
    console.error('❌ EDGE CASE: Error in force reset:', error);
  }
  
  // Rebuild board WITHOUT calling layout
  console.log('🔄 RESTART: About to call rebuildBoard()...');
  rebuildBoard();
  console.log('✅ RESTART: rebuildBoard() completed');
  
  // Reinitialize background layer if it was lost
  if (!backgroundLayer) {
    console.log('🔄 RESTART: Reinitializing background layer...');
    layout();
    initializeBackgroundLayer();
    console.log('✅ RESTART: Background layer reinitialized');
  }
  
  updateHUD();
  
  // Ensure game is resumed after restart
  try {
    gsap.globalTimeline.resume();
    app.ticker.start();
    console.log('✅ Game resumed after restart');
  } catch (error) {
    console.warn('Failed to resume game after restart:', error);
  }
  
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
  console.log('🔄 RESTART: Starting restart function');
  
  // Kill all GSAP animations first - CRITICAL to prevent null reference errors
  try {
    console.log('🔄 RESTART: Killing all GSAP animations...');
    gsap.killTweensOf(wild?.view?._fill);
    gsap.killTweensOf({ width: 0 });
    if (wild?.view?._currentAnimation) {
      wild.view._currentAnimation.kill();
      wild.view._currentAnimation = null;
    }
    
    // CRITICAL: Kill tile animations before destroying them
    if (STATE && STATE.tiles && STATE.tiles.length > 0) {
      console.log('🔄 RESTART: Killing GSAP animations for', STATE.tiles.length, 'tiles...');
      STATE.tiles.forEach(tile => {
        try {
          if (tile && tile.scale) {
            gsap.killTweensOf(tile.scale);
          }
          if (tile) {
            gsap.killTweensOf(tile);
          }
        } catch (e) {
          // Ignore errors for already destroyed tiles
        }
      });
      console.log('✅ RESTART: Tile GSAP animations killed');
    }
    
    // Kill HUD animations
    if (STATE && STATE.hud) {
      try {
        console.log('🔄 RESTART: Killing HUD GSAP animations...');
        gsap.killTweensOf(STATE.hud);
        gsap.killTweensOf(STATE.board);
        gsap.killTweensOf(STATE.stage);
        console.log('✅ RESTART: HUD GSAP animations killed');
      } catch (e) {
        console.warn('⚠️ RESTART: Error killing HUD animations:', e);
      }
    }
    
    // CRITICAL: Kill ALL GSAP tweens as nuclear option
    try {
      console.log('🔄 RESTART: Nuclear option - killing ALL GSAP tweens...');
      // Kill all timelines and tweens
      const timelines = gsap.globalTimeline.getChildren(true, false, false);
      timelines.forEach(tl => {
        try { tl.kill(); } catch (e) {}
      });
      // Also clear global timeline
      try {
        gsap.globalTimeline.clear();
      } catch (e) {
        console.warn('⚠️ Failed to clear global timeline:', e);
      }
      console.log('✅ RESTART: ALL GSAP tweens killed');
    } catch (e) {
      console.warn('⚠️ RESTART: Error with nuclear GSAP kill:', e);
    }
    
    console.log('✅ RESTART: All GSAP animations killed');
  } catch (e) {
    console.warn('⚠️ RESTART: Error killing GSAP animations:', e);
  }
  
  // HARD RESET: Use new resetWildMeter API for complete reset
  try {
    console.log('🛡️ HARD RESET: Calling resetWildMeter(true) for complete reset...');
    if (typeof HUD.resetWildMeter === 'function') {
      HUD.resetWildMeter(true); // instant = true for immediate reset
    } else {
      console.warn('HARD RESET: resetWildMeter function not available, falling back to legacy methods');
      // Fallback to legacy methods if new API not available
      if (typeof HUD.resetWildLoader === 'function') {
        HUD.resetWildLoader();
      }
    }
    
    // Reset both wild meter variables
    wildMeter = 0;
    STATE.wildMeter = 0;
    
    console.log('✅ HARD RESET: Wild meter completely reset');
  } catch (error) {
    console.warn('HARD RESET: Failed to reset wild meter:', error);
  }
  
  console.log('🔄 RESTART: About to call restartGame()...');
  restartGame();
  console.log('✅ RESTART: restartGame() completed');
}

// Clean up game when exiting
export function cleanupGame() {
  console.log('🧹 Cleaning up game state');
  
  // Stop tile idle bounce animations
  try {
    TILE_IDLE_BOUNCE.stop();
    console.log('✅ Tile idle bounce stopped');
  } catch (error) {
    console.warn('⚠️ Failed to stop tile idle bounce:', error);
  }
  
  // CRITICAL: Update high score before cleanup using statsService
  try {
    if (typeof score !== 'undefined' && score > 0) {
      console.log('🏆 Updating high score before cleanup:', score);
      statsService.updateHighScore(score);
    }
  } catch (error) {
    console.warn('⚠️ Failed to update high score during cleanup:', error);
  }
  
  // CRITICAL: Reset GSAP timeline first - but don't kill slider animations
  try {
    // Kill only game-related animations, not slider animations
    gsap.killTweensOf("[data-wild-loader]");
    gsap.killTweensOf(".wild-loader");
    gsap.killTweensOf("p");
    gsap.killTweensOf("progress");
    gsap.killTweensOf("ratio");
    gsap.globalTimeline.resume(); // CRITICAL: Resume timeline
    console.log('✅ GSAP timeline reset and cleared (slider animations preserved)');
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
  boardNumber = 1;
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
  
  // Reset wild progress (with safety check for HUD)
  try {
    if (HUD && typeof HUD.resetWildLoader === 'function') {
      resetWildProgress(0, false);
      HUD.resetWildLoader();
    }
  } catch (error) {
    console.log('⚠️ Wild progress reset skipped (HUD already destroyed):', error);
  }
  
  // Clear tiles and grid
  if (tiles) {
    tiles.forEach(t => {
      try { stopWildIdle?.(t); } catch {}
      try { t.destroy?.({children: true, texture: false, textureSource: false}); } catch {}
    });
    tiles.length = 0;
  }
  
  if (grid) {
    createEmptyGrid();
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
  
  // CRITICAL: Destroy and nullify app so boot() can create a new one
  if (app) {
    console.log('🧹 Destroying PIXI app in cleanupGame()');
    try {
      app.destroy(true, { children: true, texture: true, baseTexture: true });
      console.log('✅ PIXI app destroyed in cleanupGame()');
    } catch (e) {
      console.log('⚠️ Error destroying app in cleanupGame():', e);
    }
    app = null;
    console.log('✅ app set to null');
  }
  
  console.log('✅ Game cleanup completed');
  syncSharedState();
}

// Start fresh game (for re-entering) - now just calls boot
export function startFreshGame() {
  console.log('🎮 Starting fresh game - calling boot');
  boot();
}

// --- Game State Saving/Loading ---
let lastSavedState = null;

// --- GHOST PLACEHOLDER MANAGEMENT ---
function updateAllGhostPlaceholders() {
  // Ghost placeholders su sada fiksni i uvijek vidljivi
  // Ne mijenjaju se, samo se crtaju u drawBoardBG
}

function saveGameState() {
  try {
    syncSharedState();
    
    // CRITICAL FIX: Don't save game state if game has ended
    if (window._gameHasEnded) {
      console.log('💾 Game has ended, skipping save');
      return;
    }

    // CRITICAL FIX: Don't save if on Board 1 and user hasn't made any moves yet
    // BUT: Always save if on Board 2 or higher (user made progress)
    if (boardNumber === 1 && !window._userMadeMove) {
      console.log('💾 Board 1 and user has not made any moves yet, skipping save');
      return;
    }
    
    // Safety check: Always save if on Board 2+
    if (boardNumber >= 2) {
      console.log('💾 Board 2+ detected, forcing save regardless of move status');
    }

    if (!Array.isArray(grid) || grid.length === 0) {
      console.log('💾 Grid not ready, skipping save');
      return;
    }
    const gridSnapshot = grid.map((row, r) =>
      Array.isArray(row)
        ? row.map((tile, c) => {
            if (!tile) return null;
            return {
              value: Number.isFinite(tile.value) ? tile.value : 0,
              special: tile.special || null,
              locked: !!tile.locked,
              open: !tile.locked,
              isWild: !!tile.isWild,
              isWildFace: !!tile.isWildFace,
              gridX: Number.isFinite(tile.gridX) ? tile.gridX : c,
              gridY: Number.isFinite(tile.gridY) ? tile.gridY : r,
            };
          })
        : []
    );

    const currentState = {
      grid: gridSnapshot,
      score: Number.isFinite(score) ? score : 0,
      level: Number.isFinite(level) ? level : 1,
      boardNumber: Number.isFinite(boardNumber) ? boardNumber : Number.isFinite(level) ? level : 1,
      moves: Number.isFinite(moves) ? moves : MOVES_MAX,
      wildMeter: Number.isFinite(wildMeter) ? wildMeter : 0,
      bestScore: Number.isFinite(STATE.bestScore) ? STATE.bestScore : 0,
      timestamp: Date.now(),
    };

    console.log('💾 Saving game state:', {
      gridRows: currentState.grid.length,
      gridCols: currentState.grid[0]?.length || 0,
      score: currentState.score,
      level: currentState.level,
      moves: currentState.moves,
      wildMeter: currentState.wildMeter,
    });

    const serialized = JSON.stringify(currentState);
    if (serialized !== lastSavedState) {
      localStorage.setItem('cc_saved_game', serialized);
      lastSavedState = serialized;
      console.log('💾 Game state saved successfully (state changed).');
    } else {
      console.log('💾 Game state unchanged, skipping save.');
    }
  } catch (error) {
    console.warn('⚠️ Failed to save game state:', error);
  }
}

async function loadGameState() {
  console.log('🔄 loadGameState called...');
  try {
    const savedGame = localStorage.getItem('cc_saved_game');
    if (!savedGame) {
      console.log('⚠️ No saved game found in localStorage');
      return false;
    }

    let gameState;
    try {
      gameState = JSON.parse(savedGame);
    } catch (error) {
      console.warn('⚠️ Corrupted save file, removing...', error);
      localStorage.removeItem('cc_saved_game');
      return false;
    }

    console.log('📊 Game state:', { score: gameState.score, level: gameState.level, moves: gameState.moves });

    const timestamp = Number(gameState.timestamp) || 0;
    const saveAge = Date.now() - timestamp;
    console.log('⏰ Save age:', Math.round(saveAge / 1000), 'seconds');
    if (!Number.isFinite(timestamp) || saveAge > 24 * 60 * 60 * 1000) {
      console.log('⚠️ Saved game is too old, starting fresh');
      localStorage.removeItem('cc_saved_game');
      return false;
    }

    console.log('🔍 LOAD CHECK: app exists?', !!app, 'board exists?', !!board);
    console.log('🔍 LOAD CHECK: backgroundLayer exists?', !!backgroundLayer);
    
    if (!app || !board) {
      console.log('⚠️ Game not booted, booting before applying saved state');
      await boot();
      console.log('✅ Boot completed, app:', !!app, 'board:', !!board);
      
      // Initialize background layer after boot
      layout();
      console.log('✅ Layout completed');
      
      initializeBackgroundLayer();
      console.log('✅ Background layer initialized for saved game');
    } else {
      console.log('✅ App already booted, checking canvas in DOM...');
      
      // CRITICAL FIX: Ensure canvas is in DOM
      const host = document.getElementById('app');
      if (app.canvas && !app.canvas.parentElement) {
        console.log('⚠️ Canvas not in DOM, adding it back...');
        host.appendChild(app.canvas);
        console.log('✅ Canvas added back to DOM');
      }
      
      // CRITICAL FIX: Check if backgroundLayer is in board's children
      const bgInBoard = board.children.find(c => c.label === 'BackgroundLayer');
      console.log('🔍 backgroundLayer in board.children?', !!bgInBoard);
      
      if (!backgroundLayer || !bgInBoard) {
        console.log('⚠️ backgroundLayer missing or not in board, reinitializing...');
        backgroundLayer = null; // Force recreation
        layout();
        initializeBackgroundLayer();
        console.log('✅ Background layer reinitialized');
      }
    }

    tiles.forEach(t => {
      try { stopWildIdle?.(t); } catch {}
      try { t.destroy?.({ children: true, texture: false, textureSource: false }); } catch {}
    });
    tiles.length = 0;

    const savedGrid = Array.isArray(gameState.grid) ? gameState.grid : [];
    createEmptyGrid();

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const snapshot = savedGrid[r]?.[c];
        if (!snapshot) {
          grid[r][c] = null;
          continue;
        }
        const value = Number.isFinite(snapshot.value) ? (snapshot.value | 0) : 0;
        const openFlag = typeof snapshot.open === 'boolean' ? snapshot.open : !snapshot.locked;
        const shouldLock = !openFlag;
        const tile = makeBoard.createTile({ board, grid, tiles, c, r, val: value, locked: shouldLock });

        tile._spawned = true;
        tile.scale.set(1);

        // Postavi osnovne svojstva prije setValue
        tile.value = value;
        const isWildSnapshot = snapshot && (snapshot.special === 'wild' || snapshot.isWild || snapshot.isWildFace);
        tile.special = isWildSnapshot ? 'wild' : (snapshot?.special || null);
        tile.isWild = !!isWildSnapshot;
        tile.isWildFace = !!(snapshot?.isWildFace || isWildSnapshot);
        tile.visible = typeof snapshot.visible === 'boolean' ? snapshot.visible : true;

        // Postavi locked status prije setValue
        tile.locked = shouldLock;

        // Pozovi setValue
        makeBoard.setValue(tile, value, 0);

        // Sada postavi ghost frame vidljivost NAKON setValue
        if (shouldLock) {
          tile.eventMode = 'none';
          tile.cursor = 'default';
          tile.alpha = snapshot && Number.isFinite(snapshot.alpha) ? snapshot.alpha : (value > 0 ? 1 : 0.25);
          if (tile.occluder) tile.occluder.visible = snapshot && typeof snapshot.occluderVisible === 'boolean' ? snapshot.occluderVisible : true;
          if (tile.ghostFrame) {
            // BAKED IN: Ghost placeholders su uvijek vidljivi za unlocked tile-ove
            // Ne mijenjamo visible - ostaje kako je postavljeno u createTile
          }
        } else {
          tile.eventMode = 'static';
          tile.cursor = 'pointer';
          if (drag?.bindToTile) drag.bindToTile(tile);
          tile.alpha = snapshot && Number.isFinite(snapshot.alpha) ? snapshot.alpha : (value > 0 ? 1 : 0);
          if (tile.occluder) tile.occluder.visible = snapshot && typeof snapshot.occluderVisible === 'boolean' ? snapshot.occluderVisible : false;
          if (tile.ghostFrame) {
            // BAKED IN: Ghost placeholders su uvijek vidljivi za unlocked tile-ove
            // Ne mijenjamo visible - ostaje kako je postavljeno u createTile
            tile.ghostFrame._suspended = false;
          }
        }

        if (snapshot && Number.isFinite(snapshot.alpha)) {
          tile.alpha = snapshot.alpha;
        }

        if (tile.ghostFrame) {
          tile.ghostFrame.alpha = tile.ghostFrame._ghostAlpha ?? 0.28;
        }

        if (isWildSnapshot) {
          if (typeof makeBoard.applyWildSkin === 'function') {
            makeBoard.applyWildSkin(tile);
          } else {
            applyWildSkinLocal(tile);
          }
          try { startWildShimmer(tile); } catch {} // Use shimmer instead of idle bounce
        } else {
          try { stopWildShimmer(tile); } catch {}
        }
      }
    }

    try {
      tiles.forEach(t => {
        if (!t) return;
        if (t.occluder && typeof t.occluder._lockedAlpha === 'number' && t.locked) {
          t.occluder.alpha = t.occluder._lockedAlpha;
        }
        if (t.ghostFrame) {
          t.ghostFrame.alpha = t.ghostFrame._ghostAlpha ?? 0.28;
        }
      });
    } catch {}

    // Ghost placeholders are now fixed and always visible

    board?.sortChildren?.();

    score = Number.isFinite(gameState.score) ? gameState.score : 0;
    level = Number.isFinite(gameState.level) ? gameState.level : 1;
    boardNumber = Number.isFinite(gameState.boardNumber) ? gameState.boardNumber : level;
    moves = Number.isFinite(gameState.moves) ? gameState.moves : MOVES_MAX;
    wildMeter = Number.isFinite(gameState.wildMeter) ? gameState.wildMeter : 0;

    if (Number.isFinite(gameState.bestScore)) {
      STATE.bestScore = gameState.bestScore;
    }

    syncSharedState();
    // CRITICAL: Draw ghost placeholders BEFORE HUD update
    drawBoardBG('active+empty');
    
    // CRITICAL: Call layout to position HUD correctly
    layout();
    console.log('✅ Layout called for saved game - HUD should be positioned');
    
    // CRITICAL: Ensure HUD is visible
    if (hud) {
      hud.visible = true;
      hud.alpha = 1;
      console.log('🔍 HUD check: visible?', hud.visible, 'alpha:', hud.alpha, 'children:', hud.children.length, 'parent:', hud.parent?.constructor.name);
    }
    
    // CRITICAL: Recreate DOM-based HUD if it was destroyed
    const existingHUD = document.querySelector('[data-unified-hud]');
    console.log('🔍 DOM HUD exists?', !!existingHUD);
    if (!existingHUD && typeof HUD.createUnifiedHudContainer === 'function') {
      console.log('⚠️ DOM HUD missing, recreating...');
      try {
        HUD.createUnifiedHudContainer();
        console.log('✅ DOM HUD recreated');
        
        // Play HUD drop animation after recreation
        if (typeof HUD.playHudDrop === 'function') {
          HUD.playHudDrop({});
          console.log('✅ HUD drop animation triggered');
        }
      } catch (error) {
        console.error('❌ Failed to recreate DOM HUD:', error);
      }
    }
    
    updateHUD();
    resetWildProgress(wildMeter, true);
    
    // Update ghost visibility after loading game state
    if (typeof window.updateGhostVisibility === 'function') {
      window.updateGhostVisibility();
      console.log('✅ Ghost visibility updated after loading game state');
    }

    // CRITICAL: Resume GSAP and PIXI after loading
    try {
      gsap.globalTimeline.resume();
      app.ticker.start();
      console.log('✅ GSAP and PIXI ticker resumed after loading');
    } catch (error) {
      console.warn('⚠️ Failed to resume GSAP/PIXI:', error);
    }
    
    // ANIMATION: Show ghost placeholders FIRST, then animate tiles
    // Update ghost visibility BEFORE animation
    if (typeof window.updateGhostVisibility === 'function') {
      window.updateGhostVisibility();
      console.log('✅ Ghost visibility updated BEFORE Continue animation');
    }
    
    // Ensure background layer is visible from the start
    if (backgroundLayer) {
      backgroundLayer.visible = true;
      console.log('✅ Ghost placeholders visible from start of Continue');
    }
    
    // Hide all tiles before animation (ghosts stay visible)
    tiles.forEach(t => { if (t) t.visible = false; });
    
    // Play same sweetPopIn animation as new game
    sweetPopIn(tiles, {
      onHalf: () => {
        // No HUD drop needed here - already triggered above
      }
    }).then(() => {
      console.log('✅ Continue animation completed');
    });
    
    lastSavedState = localStorage.getItem('cc_saved_game');
    console.log('✅ Game state loaded successfully.');
    return true;
  } catch (error) {
    console.error('❌ Failed to load game state:', error);
    localStorage.removeItem('cc_saved_game');
  }
  console.log('❌ loadGameState returning false');
  return false;
}

// Resume Game Modal
async function showResumeGameModal() {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = [
      'position: fixed',
      'top: 0',
      'left: 0',
      'width: 100%',
      'height: 100%',
      'background: rgba(0, 0, 0, 0.8)',
      'display: flex',
      'align-items: center',
      'justify-content: center',
      'z-index: 1000000',
      'font-family: Arial, sans-serif'
    ].join(';');

    const modal = document.createElement('div');
    modal.style.cssText = [
      'background: #FFFFFF',
      'border-radius: 32px',
      'padding: 48px 42px 44px',
      'text-align: center',
      'max-width: 420px',
      'width: min(92%, 420px)',
      'box-shadow: 0 26px 68px rgba(0, 0, 0, 0.18)',
      'display: flex',
      'flex-direction: column',
      'align-items: center',
      'gap: 28px'
    ].join(';');

    // Time icon (240px converted to percentage)
    const icon = document.createElement('img');
    icon.src = 'assets/time-icon.png';
    icon.style.cssText = [
      'width: 240px',
      'max-width: 64%',
      'height: auto',
      'margin: 0 auto 12px'
    ].join(';');

    // Title
    const title = document.createElement('h2');
    title.textContent = 'Resume game?';
    title.style.cssText = [
      'margin: 0',
      'font-size: 30px',
      'font-weight: 700',
      'color: #B36A3C',
      'letter-spacing: 0.4px'
    ].join(';');

    // Subtitle
    const subtitle = document.createElement('p');
    subtitle.textContent = 'Resume your last board.';
    subtitle.style.cssText = [
      'margin: 0',
      'font-size: 18px',
      'color: #8E7A6A',
      'letter-spacing: 0.2px'
    ].join(';');

    // Buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = [
      'display: flex',
      'flex-direction: column',
      'gap: 18px',
      'width: 100%'
    ].join(';');

    // Continue button
    const continueBtn = document.createElement('button');
    continueBtn.textContent = 'Play Again';
    continueBtn.style.cssText = [
      'background: #E97A55',
      'color: white',
      'border: none',
      'padding: 18px 32px',
      'border-radius: 40px',
      'font-size: 20px',
      'font-weight: 700',
      'cursor: pointer',
      'box-shadow: 0 8px 0 0 #C24921',
      'transition: transform 0.15s ease'
    ].join(';');
    continueBtn.onmouseenter = () => {
      continueBtn.style.transform = 'translateY(3px)';
      continueBtn.style.boxShadow = '0 4px 0 0 #C24921';
    };
    continueBtn.onmouseleave = () => {
      continueBtn.style.transform = 'none';
      continueBtn.style.boxShadow = '0 8px 0 0 #C24921';
    };
    continueBtn.onmousedown = () => {
      continueBtn.style.transform = 'translateY(4px)';
      continueBtn.style.boxShadow = '0 3px 0 0 #C24921';
    };
    continueBtn.onmouseup = () => {
      continueBtn.style.transform = 'translateY(3px)';
      continueBtn.style.boxShadow = '0 4px 0 0 #C24921';
    };

    // Exit to menu button
    const exitBtn = document.createElement('button');
    exitBtn.textContent = 'Exit';
    exitBtn.style.cssText = [
      'background: white',
      'color: #AD8675',
      'border: 1px solid #E9DCD6',
      'padding: 18px 32px',
      'border-radius: 40px',
      'font-size: 20px',
      'font-weight: 700',
      'cursor: pointer',
      'box-shadow: 0 8px 0 0 #E9DCD6',
      'transition: transform 0.15s ease'
    ].join(';');
    exitBtn.onmouseenter = () => {
      exitBtn.style.transform = 'translateY(3px)';
      exitBtn.style.boxShadow = '0 4px 0 0 #E9DCD6';
    };
    exitBtn.onmouseleave = () => {
      exitBtn.style.transform = 'none';
      exitBtn.style.boxShadow = '0 8px 0 0 #E9DCD6';
    };
    exitBtn.onmousedown = () => {
      exitBtn.style.transform = 'translateY(4px)';
      exitBtn.style.boxShadow = '0 3px 0 0 #E9DCD6';
    };
    exitBtn.onmouseup = () => {
      exitBtn.style.transform = 'translateY(3px)';
      exitBtn.style.boxShadow = '0 4px 0 0 #E9DCD6';
    };

    // Event handlers
    continueBtn.onclick = async () => {
      document.body.removeChild(overlay);
      const loaded = await loadGameState();
      if (!loaded) {
        alert('Failed to load game, starting new game.');
        await restartGame();
      }
      resolve();
    };

    exitBtn.onclick = () => {
      document.body.removeChild(overlay);
      localStorage.removeItem('cc_saved_game');
      restartGame();
      // Homepage image is static - no randomization needed
      resolve();
    };

    // Assemble modal
    buttonsContainer.appendChild(continueBtn);
    buttonsContainer.appendChild(exitBtn);
    modal.appendChild(icon);
    modal.appendChild(title);
    modal.appendChild(subtitle);
    modal.appendChild(buttonsContainer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  });
}

// Expose functions globally
window.saveGameState = saveGameState;
window.loadGameState = loadGameState;
window.showResumeGameModal = showResumeGameModal;
window.drawBoardBG = drawBoardBG;
window.animateBoardExit = animateBoardExit; // Export for exitToMenu

// Export drawBoardBG and animateBoardExit for other modules
export { drawBoardBG, animateBoardExit };


// Mobile-specific save events
window.addEventListener('pagehide', saveGameState);
window.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    saveGameState();
  }
});

// iOS/Android specific events
window.addEventListener('beforeunload', saveGameState);
document.addEventListener('pause', saveGameState, false); // Android
document.addEventListener('resume', () => {
  // Reload game state when app resumes
  if (typeof window.loadGameState === 'function') {
    setTimeout(() => {
      window.loadGameState();
    }, 100);
  }
}, false); // Android

export { app, stage, board, hud, tiles, grid, score, level }; 
