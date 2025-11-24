// public/src/modules/app.js
// ✅ mobile-first, cache-busted celebration & prize flow

import { Application, Container, Assets, Graphics, Text, Rectangle, Texture, Sprite, SCALE_MODES } from 'pixi.js';
import { gsap } from 'gsap';

import {
  COLS, ROWS, TILE, GAP, HUD_H,
  ASSET_TILE, ASSET_NUMBERS, ASSET_NUMBERS2, ASSET_NUMBERS3, ASSET_NUMBERS4, ASSET_WILD, ASSET_WILD_MAGNET, ASSET_WILD_BEER
} from './constants.js';
import { sweetPopIn, sweetPopOut } from './app-board.js';
import * as CONSTS from './constants.js';
import { STATE } from './app-state.ts';

import * as makeBoard from './board.ts';
import { installDrag } from './install-drag.js';
import { glassCrackAtTile, woodShardsAtTile, spawnMerge6Shards, regularMerge6Shards, innerFlashAtTile, showMultiplierTile, smokeBubblesAtTile, screenShake, wildImpactEffect, startWildIdle, stopWildIdle, startWildShimmer, stopWildShimmer, startWildStars, stopWildStars, startWildBeerBubbles, stopWildBeerBubbles, startMagnetIdleParticles, stopMagnetIdleParticles, centerInBoard, killAllDelayedCalls, destroyAllGraphicsObjects, createWildBeerBubblesExplosion, isWildBeerExplosionRunning } from './fx.js';
import { showStarsModal } from './stars-modal.js';
import { runEndgameFlow } from './endgame-flow.js';
import FX from './fx-helpers.js';
import * as SPAWN from './spawn-helpers.js';
import * as HUD   from './hud-helpers.js';
import { wild } from './hud-helpers.js';
import * as FLOW  from './level-flow.js';
import { openEmpties } from './app-spawn.ts';
import { clearWildState, handleWildMagnetMergedPulledTiles } from './app-merge.ts';
import { statsService } from '../services/stats-service.js';
import { TILE_IDLE_BOUNCE } from './tile-idle-bounce.ts';
import { checkEndGame, needsEmergencyRescue, clearEndGameCache, type EndGameContext } from './endgame-checker.ts';
import memoryManager from './memory-manager.ts';

// HUD functions from hud-helpers.js


// --- Endless mode config ---
const MOVES_MAX = 50;
const COMBO_CAP = 99;   // praktični safety cap

// Combo idle decay: reset na x0 poslije 2s
const COMBO_IDLE_RESET_MS = 2000;
let comboIdleTimer = null;
let checkLevelEndTimer = null;
let checkLevelEndRetryCount = 0; // 🔥 v38: Track reschedule attempts
const MAX_CHECK_LEVEL_END_RETRIES = 10; // 🔥 v38: Prevent infinite reschedule loops
// 🔥 CRITICAL: Increased from 500ms to 1200ms to allow all animations to complete
// - Wild spawn bounce: ~580ms
// - Magnet pull + respawn: ~1000ms
// - Regular merge animations: ~600-800ms
// This prevents premature endgame checks while animations are still running
const CHECK_LEVEL_END_DELAY_MS = 1200;
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
let wildMagnetPullInProgress = false; // Prevent overlapping wild-magnet pull animations
let drag;
let busyEnding = false;

function tileIsVisuallyActive(tile: any): boolean {
  if (!tile || tile.destroyed || tile.locked) return false;
  const value = (tile.value | 0);
  const special = tile.special;
  const isWild = special === 'wild' || special === 'wild-magnet' || special === 'wild-beer';
  return value > 0 || isWild;
}

function getReactiveActiveTiles(): any[] {
  return tiles.filter(tileIsVisuallyActive);
}

// 🔥 REMOVED: isBoardCleanReactive() - use checkEndGame() from endgame-checker.ts instead
// This function was a duplicate of isBoardCleanCheck() and could cause conflicts

async function triggerCleanBoardFlow(reason: string): Promise<void> {
  console.log('🚨🚨🚨 triggerCleanBoardFlow invoked:', reason);

  if (busyEnding) {
    console.log('⏳ triggerCleanBoardFlow skipped - busyEnding already true');
    return;
  }
  busyEnding = true;
  
  // If we explicitly requested a clean-board skip (e.g., resuming straight into next board after hard-exit),
  // consume the flag and bail before any modal/animation starts.
  if ((window as any).__skipCleanBoardOnce) {
    console.log('⏭️ Skipping clean-board flow once due to resume jump flag');
    delete (window as any).__skipCleanBoardOnce;
    busyEnding = false;
    return;
  }
  
  // 🔥 CRITICAL: Perform memory cleanup before board transition (MEMORY LEAK FIX)
  console.log('🧹 Performing memory cleanup before board transition...');
  try {
    memoryManager.performCleanup();
    console.log('✅ Memory cleanup completed');
  } catch (error) {
    console.warn('⚠️ Memory cleanup failed:', error);
  }

  // Reset wild meter immediately (legacy behavior)
  wildMeter = 0;
  STATE.wildMeter = 0;
  resetWildProgress(0, false);
  wildBeerSpawned = false; // Reset wild-beer spawn tracking
  wildMagnetSpawned = false; // Reset wild-magnet spawn tracking

  try {
    if (typeof HUD.resetWildMeter === 'function') {
      HUD.resetWildMeter(true);
    } else {
      HUD.updateProgressBar?.(0, false);
    }
  } catch (error) {
    console.warn('⚠️ triggerCleanBoardFlow: Failed to reset wild meter:', error);
  }

  try {
    try { await new Promise((res) => setTimeout(res, 1000)); } catch {}
    await runEndgameFlow({
      app,
      stage,
      board,
      boardBG,
      level,
      startLevel,
      score,
      getScore: () => score,
      setScore: (v) => { score = v | 0; updateHUD(); },
      animateScore,
      updateHUD,
      boardNumber,
      hideGrid: () => {
        try {
          board.visible = false;
          hud.visible = false;
          drawBoardBG('none');
        } catch {}
      },
      showGrid: () => {
        try {
          board.visible = true;
          hud.visible = true;
          drawBoardBG();
        } catch {}
      }
    });
  } finally {
    busyEnding = false;
  }
}

function ensureNonWildTile(reason: string = 'unknown'): boolean {
  const activeTiles = tiles.filter((t) => t && !t.destroyed && (t.value | 0) > 0);
  if (activeTiles.length === 0) return false;
  
  const hasNonWild = activeTiles.some((t) => t.special !== 'wild' && t.special !== 'wild-magnet');
  if (hasNonWild) {
    return false;
  }
  
  // All remaining tiles are wild/magnet. Convert one into a regular tile to keep game alive.
  const candidate = activeTiles[Math.floor(Math.random() * activeTiles.length)];
  if (!candidate) return false;
  
  console.log('🛟 Emergency downgrade: Converting wild tile to normal value', { reason, gridX: candidate.gridX, gridY: candidate.gridY });
  
  try {
    clearWildState(candidate);
  } catch (error) {
    console.warn('⚠️ ensureNonWildTile: clearWildState failed', error);
  }
  
  candidate.special = null;
  (candidate as any).isWild = false;
  (candidate as any).isWildFace = false;
  
  const baseValues = [1, 2, 3, 4, 5];
  const newValue = baseValues[Math.floor(Math.random() * baseValues.length)];
  makeBoard.setValue(candidate, newValue, candidate.stackDepth || 0);
  
  try {
    candidate.eventMode = 'static';
    candidate.cursor = 'pointer';
  } catch {}
  
  return true;
}

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
  
  // 🔥 EXPOSE STATE to window for magnet idle particles access
  (window as any).STATE = STATE;
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
  
  // 🔥 CRITICAL FIX v40.7: Skip wild spawn if last merge is in progress
  // Problem: Last merge (2 tiles) → merge6 → wild meter se puni → wild spawn → nova kockica na board prije clean board!
  // Solution: Provjeri da li postoji merge6 tile s _isLastMerge flag-om
  const hasLastMergeTile = STATE.tiles.some((t: any) => t && !t.destroyed && t.value === 6 && (t as any)?._isLastMerge === true);
  if (hasLastMergeTile) {
    console.log('🚨🚨🚨 LAST MERGE: Skipping wild spawn - prevent wild spawn before clean board');
    console.log('🚨🚨🚨 Wild spawn will NOT be queued, preventing wild spawn on last merge');
    return;
  }

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
      
      // Save game state after wild spawn completes
      debouncedSaveGameState(400);
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
      const downgraded = ensureNonWildTile('wild_rescue');
      if (downgraded) {
        console.log('🛟 Wild rescue fallback: downgraded wild tile to keep merges possible');
      }
      wildRescueScheduled = false;
      gsap.delayedCall(0.05, () => {
        try { checkLevelEnd(); } catch (err) { console.warn('🛟 Post-rescue checkLevelEnd failed:', err); }
      });
      
      // Save game state after rescue spawn completes
      debouncedSaveGameState(400);
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
  
  // 🔥 CRITICAL: Keep background as gradient initially (not solid color)
  // Background will change to solid color only when entering game or individual screens
  app.renderer.backgroundColor = 0xf3eee8; // PIXI renderer background (for game canvas)
  
  // Keep CSS background as gradient for homepage
  const appElement = document.getElementById('app');
  const canvasElement = app.canvas;
  if (appElement) {
    // Start with gradient - will change to solid color only when entering game
    appElement.style.background = 'var(--app-gradient, linear-gradient(180deg, #f3eee8 0%, #FBE3C5 100%))';
  }
  if (canvasElement) {
    // Start with gradient - will change to solid color only when entering game
    canvasElement.style.background = 'var(--app-gradient, linear-gradient(180deg, #f3eee8 0%, #FBE3C5 100%))';
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
  // 🔥 CRITICAL: ASSET_WILD_BEER MUST be loaded for wild-beer tiles to display correctly
  await Assets.load([ASSET_TILE, ASSET_NUMBERS, ASSET_WILD, ASSET_WILD_MAGNET, ASSET_WILD_BEER]);
  
  // Load additional tile number sheets in background (non-blocking)
  Assets.load([ASSET_NUMBERS2, ASSET_NUMBERS3, ASSET_NUMBERS4]).catch(() => {});
  
  // Optimize all loaded textures for pixel-perfect rendering
  // 🔥 CRITICAL: Include ASSET_WILD_BEER in loaded textures list
  const loadedTextures = [ASSET_TILE, ASSET_NUMBERS, ASSET_NUMBERS2, ASSET_NUMBERS3, ASSET_NUMBERS4, ASSET_WILD, ASSET_WILD_MAGNET, ASSET_WILD_BEER];
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
    canDrop: (s, d) => {
      // CRITICAL: Check if destination is valid FIRST
      if (!d || d.locked || (d.value | 0) <= 0) {
        console.log('🔥 canDrop (app-core): Invalid destination (null, locked, or value = 0)');
        return false;
      }
      
      const sv = (s && (s.value|0)) || 0;
      const dv = (d && (d.value|0)) || 0;
      
      // WILD-MAGNET LOGIC: Can go on anything except wild and wild-magnet, and anything can go on it
      const srcIsWildMagnet = s?.special === 'wild-magnet';
      const dstIsWildMagnet = d?.special === 'wild-magnet';
      const srcIsWild = s?.special === 'wild' || s?.special === 'wild-beer';
      const dstIsWild = d?.special === 'wild' || d?.special === 'wild-beer';
      
      if (srcIsWildMagnet) {
        // Wild-magnet cannot merge into wild or wild-magnet
        if (dstIsWild || dstIsWildMagnet) {
          console.log('🔥 canDrop (app-core): Wild-magnet cannot merge into wild or wild-magnet');
          return false;
        }
        // Wild-magnet can merge into any normal tile
        console.log('🔥 canDrop (app-core): Wild-magnet can merge into normal tile');
        return true;
      }
      
      if (dstIsWildMagnet) {
        // Any tile can merge into wild-magnet (except wild and wild-magnet)
        if (srcIsWild || srcIsWildMagnet) {
          console.log('🔥 canDrop (app-core): Wild or wild-magnet cannot merge into wild-magnet');
          return false;
        }
        // Normal tiles can merge into wild-magnet
        console.log('🔥 canDrop (app-core): Normal tile can merge into wild-magnet');
        return true;
      }
      
      const wild = (srcIsWild || dstIsWild);
      
      // WILD LOGIC: Wild cube cannot merge into same value
      if (wild) {
        if (srcIsWild && !dstIsWild) {
          // Wild merging into normal tile - check if target value is different
          const canMerge = sv !== dv;
          console.log('🔥 canDrop (app-core): Wild merge check (wild->normal):', { wildValue: sv, targetValue: dv, canMerge });
          return canMerge;
        } else if (dstIsWild && !srcIsWild) {
          // Normal tile merging into wild - check if source value is different
          const canMerge = sv !== dv;
          // 🔥 PERFORMANCE: Removed console.log to prevent lag
          // console.log('🔥 canDrop (app-core): Wild merge check (normal->wild):', { sourceValue: sv, wildValue: dv, canMerge });
          return canMerge;
        } else if (srcIsWild && dstIsWild) {
          // Wild merging into wild - not allowed
          // 🔥 PERFORMANCE: Removed console.log to prevent lag
          // console.log('🔥 canDrop (app-core): Wild merge check (wild->wild): not allowed');
          return false;
        }
      }
      
      // 🔥 CRITICAL: If one tile is wild-magnet affected, it can merge with the other
      const srcIsWildMagnetAffected = (s as any)?._wildMagnetAffected === true;
      const dstIsWildMagnetAffected = (d as any)?._wildMagnetAffected === true;
      
      if (srcIsWildMagnetAffected || dstIsWildMagnetAffected) {
        console.log('🔥 canDrop (app-core): One tile is wild-magnet affected - can merge regardless of pips');
        return true;
      }
      
      // NORMAL LOGIC: Regular merge rules
      if (!Number.isFinite(sv) || !Number.isFinite(dv)) return false;
      if (sv === dv) return true;         // allow stacking equal values (e.g., 3+3)
      const canMerge = (sv + dv) <= 6;    // allow different values that sum to 6 (e.g., 4+2, 2+4, 3+2=5)
      return canMerge;
    },
    hoverColor: 0x8a6e57,
    hoverWidth: 10,
    hoverAlpha: 0.28,
    threshold: 0.05, // Increased from 0.03 to prevent accidental merges
    hitPad: 0.26,
    snapRadius: 0.68,
  });
  drag = (ret && ret.drag) ? ret.drag : ret;
  STATE.drag = drag; // 🔥 CRITICAL: Set STATE.drag so tiles can be bound after spawning

  // Start game
  // Allow callers (e.g., resume flow after clean-board exit) to request a specific starting board
  const forcedStartLevel = Number((window as any).__ccStartAtLevel);
  if (Number.isFinite(forcedStartLevel) && forcedStartLevel >= 1) {
    delete (window as any).__ccStartAtLevel;
    boardNumber = forcedStartLevel | 0;
    moves = MOVES_MAX;
    console.log('🎯 boot(): Starting at requested board', boardNumber);
    startLevel(boardNumber);
  } else {
    boardNumber = 1;
    moves = MOVES_MAX;
    startLevel(1);
  }
  
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
      html,body{ margin:0; padding:0; background:var(--app-gradient, linear-gradient(180deg, #f3eee8 0%, #FBE3C5 100%)); height:auto; }
      body{ min-height:100dvh; overflow:hidden; }
      #app{ position:fixed; inset:0; width:100vw; height:100dvh; background:var(--app-gradient, linear-gradient(180deg, #f3eee8 0%, #FBE3C5 100%)); z-index:10; /* Transition removed - GSAP handles background animations */ }
      canvas{ position:absolute; inset:0; width:100vw; height:100dvh; display:block; background:var(--app-gradient, linear-gradient(180deg, #f3eee8 0%, #FBE3C5 100%)); z-index:10; /* Transition removed - GSAP handles background animations */ }
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
    checkLevelEnd: () => checkLevelEnd(), // Export checkLevelEnd for use in app-merge.ts
    scheduleWildRescue: (reason, count) => scheduleWildRescue(reason, count), // 🔥 CRITICAL: Export for emergency rescue
    applyWildSkinLocal: (tile) => applyWildSkinLocal(tile), // 🔥 CRITICAL: Export for wild-magnet electric glow
  };
  
  // 🔥 MEMORY LEAK FIX: Export cleanup functions for global cleanup
  (window as any).killAllDelayedCalls = killAllDelayedCalls;
  (window as any).destroyAllGraphicsObjects = destroyAllGraphicsObjects;
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
  const BOARD_LIFT = 16;
  
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

  // Final lift: move HUD 8px closer to the top edge (extra 4px lift)
  const HUD_LIFT = 8;
  safeTop -= HUD_LIFT;
  hudBottom = safeTop + HUD_H + GAP_HUD;
  __hudMetrics.top = Math.round(safeTop);
  __hudMetrics.bottom = Math.round(hudBottom);
  
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
    boardY = Math.round(hudBottom + boardTopGap - BOARD_LIFT + 6 - 2); // Board starts after HUD gap, lifted up, +6px down, -2px up
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
    boardY = Math.round(centerY - sh / 2 + 8 - BOARD_LIFT + 6 - 2); // Previous +8 offset, now lifted up, +6px down, -2px up
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
    // Center at exactly 50% of available space
    const center2 = dynamicHudBottom + (avail2 - sh2) / 2;
    board.y = Math.round(center2 - BOARD_LIFT + 6 - 2); // +6px down, -2px up
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
    }
  } catch {}
}

// Update ghost visibility based on current grid state
// SIMPLE RULE: Show ghost ONLY where grid cell is null (no tile at all)
function updateGhostVisibility() {
  if (!window._ghostPlaceholders) return;
  
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
  });
  console.log('✅ sweetPopIn started immediately - no waiting');

  syncSharedState();

}

// Board exit animation - reverse of sweetPopIn
async function animateBoardExit(){
  console.log('🎬 Starting board exit animation...');
  
  // CRITICAL: Hide board indicator (board tag) before exit animation
  try {
    const { animateBoardIndicatorExit } = await import('./hud-helpers.js');
    if (typeof animateBoardIndicatorExit === 'function') {
      animateBoardIndicatorExit(0.3);
      console.log('✅ Board exit: Board indicator exit animation started');
    }
  } catch (e) {
    console.warn('⚠️ Board exit: Error hiding board indicator:', e);
  }
  
  // CRITICAL: Stop tile idle bounce before exit animation (prevents new smoke bubbles)
  try {
    TILE_IDLE_BOUNCE.stop();
    console.log('✅ Board exit: Tile idle bounce stopped');
  } catch (e) {
    console.warn('⚠️ Board exit: Error stopping tile idle bounce:', e);
  }
  
  // CRITICAL: Cleanup smoke bubbles immediately before exit animation
  try {
    if (typeof HUD.cleanupSmokeBubbles === 'function') {
      HUD.cleanupSmokeBubbles();
      console.log('✅ Board exit: Smoke bubbles cleaned up');
    }
  } catch (e) {
    console.warn('⚠️ Board exit: Error cleaning up smoke bubbles:', e);
  }
  
  // CRITICAL: Hide ghost placeholders before exit animation
  try {
    if (backgroundLayer) {
      backgroundLayer.visible = false;
    }
    // Also hide if stored in window._ghostPlaceholders
    if (window._ghostPlaceholders && Array.isArray(window._ghostPlaceholders)) {
      window._ghostPlaceholders.forEach((row: any[]) => {
        row.forEach((ghost: any) => {
          if (ghost && typeof ghost.visible !== 'undefined') {
            ghost.visible = false;
          }
        });
      });
    }
  } catch (e) {
    // Silently ignore errors
  }
  
  // Use STATE.tiles directly (not the module-level const reference)
  const tilesToAnimate = STATE.tiles || [];
  console.log('🎯 Animate tiles:', tilesToAnimate.length, 'tiles');
  
  if (tilesToAnimate.length === 0) {
    console.warn('⚠️ No tiles to animate - skipping exit animation');
    // Still trigger HUD exit even if no tiles
    try { 
      HUD.playHudRise?.({}); 
    } catch (e) {
      console.warn('⚠️ Failed to call HUD.playHudRise:', e);
    }
    return Promise.resolve();
  }
  
  // 🔥 CRITICAL: Start HUD exit animation IMMEDIATELY (same time as board exit)
  // This ensures both animations start simultaneously
  console.log('🎯 Starting HUD exit animation simultaneously with board exit');
  try { 
    HUD.playHudRise?.({}); 
    console.log('✅ HUD exit animation started');
  } catch (e) {
    console.warn('⚠️ Failed to call HUD.playHudRise:', e);
  }
  
  // Play sweetPopOut (board tiles exit animation)
  // HUD exit already started above, so they run in parallel
  return sweetPopOut(tilesToAnimate, {
    // No onHalf callback needed - HUD already started above
  }).then(() => {
    // CRITICAL: Wait for the longest animation to complete
    // HUD rise duration: 0.3s (300ms)
    // sweetPopOut max duration: ~0.38-0.55s
    // Wait for the longer of the two (sweetPopOut is usually longer)
    // Add small buffer to ensure both complete
    const maxAnimationTime = Math.max(550, 300); // sweetPopOut max ~550ms, HUD 300ms
    console.log(`⏳ Waiting for exit animations to complete (${maxAnimationTime}ms)...`);
    return new Promise(resolve => {
      setTimeout(resolve, maxAnimationTime);
    });
  });
}

function tintLocked(t){ try{ gsap.to(t, { alpha:0.35, duration:0.10, ease:'power1.out' }); }catch{} }
function randVal(){ return [1,1,1,2,2,3,3,4,5][(Math.random()*9)|0]; }
function startLevel(n){
  console.log('🎯 startLevel called with:', n, 'current level:', level, 'current boardNumber:', boardNumber, 'current score:', score);
  
  // Resume score priority:
  // 1) Explicit resumeScore (hard-exit recovery)
  // 2) Preserved score from normal clean-board continue
  // 3) Fresh start resets on level 1
  const resumeScore = Number((window as any).__ccResumeScore);
  const preservedScore = (window as any).__ccPreserveScore;
  if (Number.isFinite(resumeScore)) {
    score = Math.max(0, resumeScore | 0);
    STATE.score = score;
    delete (window as any).__ccResumeScore;
    console.log('🎯 startLevel: Using resume score', score);
  } else if (typeof preservedScore === 'number' && preservedScore > 0) {
    score = preservedScore;
    console.log('💾 Preserved score from previous board:', preservedScore);
    delete (window as any).__ccPreserveScore;
  } else if (n === 1) {
    score = 0;
  }
  // If n > 1 and no overrides, keep current score (continuing game)
  
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
  // 🔥 CRITICAL: Don't reset busyEnding here - let runEndgameFlow handle it in finally block
  // busyEnding = false; // REMOVED - runEndgameFlow resets it in finally block
  hudResetCombo();
  console.log('🎯 startLevel updated - level:', level, 'boardNumber:', boardNumber, 'score preserved:', score);
  try { comboIdleTimer?.kill?.(); } catch {}
  
wildMeter = 0;
  resetWildProgress(0, false);
  wildBeerSpawned = false; // Reset wild-beer spawn tracking
  wildMagnetSpawned = false; // Reset wild-magnet spawn tracking for new level
  
  // Clear end game cache when starting new level
  clearEndGameCache();
  
  // Start animation immediately - no delay
  rebuildBoard();
  
  // CRITICAL: Save game state immediately after starting Board 2+ to enable resume
  // This ensures that if user exits without making moves, they can still continue
  if (boardNumber >= 2) {
    console.log('💾 Board 2+ started, forcing immediate save for resume capability');
    // Force save with minimal delay to ensure user can exit immediately and resume later
    setTimeout(() => {
      saveGameState();
      console.log('✅ Game state saved after Board 2+ start');
    }, 100); // Reduced from 500ms to 100ms for faster save
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
  // 🔥 CRITICAL: Use appropriate texture based on special type
  // Wild-beer MUST always use wild-beer.png texture
  let assetPath = ASSET_WILD;
  if (tile.special === 'wild-magnet') {
    assetPath = ASSET_WILD_MAGNET;
  } else if (tile.special === 'wild-beer') {
      assetPath = ASSET_WILD_BEER;
    }
    
    const tex = Assets.get(assetPath) || Texture.from(assetPath);
    if (!tex || !tile) return;
    const host = tile.rotG || tile;
    let base = tile.base;
    if (!base){
      base = host.children?.find(c => c.texture instanceof Texture) || null;
      if (base) tile.base = base;
    }
    
    // 🔥 CRITICAL: Always set wild-beer texture and ensure it's visible
    // This MUST be called every time to ensure texture is never lost
    if (base && tex && tex !== Texture.EMPTY){ 
      // Force set texture even if it's already set (prevents texture loss)
      base.texture = tex; 
      base.tint = 0xFFFFFF; 
      base.alpha = 1;
      base.visible = true;
      // Optimize texture for pixel-perfect rendering
      if (base.texture && base.texture.baseTexture) {
        base.texture.baseTexture.scaleMode = SCALE_MODES.NEAREST;
      }
    }
    
    // 🔥 CRITICAL: Hide pips and num for wild tiles
    if (tile.num) tile.num.visible = false;
    if (tile.pips) {
      tile.pips.visible = false;
      tile.pips.clear?.(); // Clear pips to prevent them from showing
    }
    tile.isWildFace = true;
  
  // Wild-magnet grab reliability: ensure hit area and pointer mode are solid
  if (tile.special === 'wild-magnet') {
    const host = tile.rotG || tile;
    const hitSize = TILE * 1.05; // Slightly larger hit box for easier tap
    const half = hitSize / 2;
    const hitArea = new Rectangle(-half, -half, hitSize, hitSize);
    tile.hitArea = hitArea;
    if (host) host.hitArea = hitArea;
    tile.eventMode = 'static';
    tile.cursor = 'pointer';
    if (host && (host as any).eventMode !== 'static') {
      (host as any).eventMode = 'static';
      (host as any).cursor = 'pointer';
    }
  }
  
  try {
    startWildShimmer(tile); // Use shimmer instead of bounce
    // 🔥 WILD-BEER: Use bubbles animation instead of rotating stars
    if (tile.special === 'wild-beer') {
        startWildBeerBubbles(tile);
      } else {
        startWildStars(tile);
      }
      // 🔥 NEW: Start magnet idle particles animation (24% intensity)
      if (tile.special === 'wild-magnet') {
        startMagnetIdleParticles(tile);
      }
    } catch {}
  }catch{}
}

// Electric glow effect for wild-magnet tiles
function addElectricGlow(tile){
  try {
    // Remove existing glow if present
    if (tile._electricGlow) {
      try {
        tile._electricGlow.parent?.removeChild(tile._electricGlow);
        tile._electricGlow.destroy();
      } catch {}
    }
    if (tile._glowAnimation) {
      tile._glowAnimation.kill();
    }
    
    const glowContainer = new Container();
    glowContainer.zIndex = -1; // Behind tile
    tile._electricGlow = glowContainer;
    
    const host = tile.rotG || tile;
    if (host && host.addChild) {
      host.addChildAt(glowContainer, 0);
    }
    
    // Create 4 glow rings with different phases
    const rings = [];
    const colors = [0xF26034, 0xE97A55, 0xFF8C5A, 0xF26034]; // Red-orange spectrum
    
    for (let i = 0; i < 4; i++) {
      const ring = new Graphics();
      const radius = 50 + i * 4;
      const thickness = 2 + Math.random() * 2;
      
      // Draw circle with segments for jittery effect
      const segments = 32;
      for (let s = 0; s < segments; s++) {
        const angle1 = (s / segments) * Math.PI * 2;
        const angle2 = ((s + 1) / segments) * Math.PI * 2;
        
        const x1 = Math.cos(angle1) * radius;
        const y1 = Math.sin(angle1) * radius;
        const x2 = Math.cos(angle2) * radius;
        const y2 = Math.sin(angle2) * radius;
        
        ring.moveTo(x1, y1);
        ring.lineTo(x2, y2);
      }
      
      ring.stroke({ width: thickness, color: colors[i], alpha: 0.3 });
      ring.alpha = 0.5;
      glowContainer.addChild(ring);
      rings.push(ring);
    }
    
    // Animate rings with jittery pulsing effect
    const tl = gsap.timeline({ repeat: -1 });
    
    rings.forEach((ring, index) => {
      const delay = index * 0.1;
      const baseRadius = 50 + index * 4;
      
      // Jittery pulsing animation
      tl.to(ring.scale, {
        x: 1.12,
        y: 1.12,
        duration: 0.6 + Math.random() * 0.3,
        ease: 'power2.inOut',
        repeat: -1,
        yoyo: true,
        delay: delay,
        modifiers: {
          x: () => ring.scale.x + (Math.random() - 0.5) * 0.02, // Jitter
          y: () => ring.scale.y + (Math.random() - 0.5) * 0.02  // Jitter
        }
      }, 0);
      
      tl.to(ring, {
        alpha: 0.2 + Math.random() * 0.3,
        duration: 0.4 + Math.random() * 0.2,
        ease: 'power2.inOut',
        repeat: -1,
        yoyo: true,
        delay: delay
      }, 0);
      
      // Random rotation for electric effect
      tl.to(ring, {
        rotation: Math.PI * 2,
        duration: 3 + Math.random() * 2,
        ease: 'none',
        repeat: -1
      }, 0);
    });
    
    tile._glowAnimation = tl;
  } catch (error) {
    console.warn('⚠️ Failed to add electric glow:', error);
  }
}

function bindTileWithFallback(tile, skipBind){
  const attemptBind = () => {
    if (drag && typeof drag.bindToTile === 'function') {
      drag.bindToTile(tile);
      return true;
    }
    return false;
  };

  if (!skipBind || !(drag && drag.t)) {
    attemptBind();
    return;
  }

  let attempts = 0;
  const maxAttempts = 60;
  const schedule = (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function')
    ? window.requestAnimationFrame.bind(window)
    : (cb) => setTimeout(cb, 16);

  const retry = () => {
    if (!drag?.t || attempts >= maxAttempts) {
      attemptBind();
      return;
    }
    attempts += 1;
    schedule(retry);
  };

  retry();
}

// --- spawn exactly at grid cell ---
function openAtCell(c, r, { value=null, isWild=false, isWildMagnet=false, isWildBeer=false, skipBind=false, timeScale=1.0 } = {}){
  return new Promise((resolve)=>{
    let holder = grid?.[r]?.[c] || null;

    // 🔥 CRITICAL FIX v40.6: Check BOTH locked AND unlocked tiles for active tiles
    // Problem: Spawning on locked tiles with value > 0 or wild tiles causes "2 tiles on same position" bug
    // Solution: ALWAYS check if tile has value > 0 or is wild, regardless of locked status
    if (holder) {
      const isWildTile = holder.special === 'wild' || holder.special === 'wild-magnet' || holder.special === 'wild-beer' || holder.isWild === true || holder.isWildFace === true;
      const hasValue = (holder.value|0) > 0;
      
      // 🔥 CRITICAL: NEVER spawn on a tile that has value > 0 or is wild, even if it's locked!
      // Locked tiles with value > 0 are active tiles (e.g., during animations)
      // Spawning on them would create "2 tiles on same position" bug
      if (hasValue || isWildTile) {
        console.warn('⚠️ openAtCell: Cell already occupied by active tile:', {
          c, r,
          holderValue: holder.value,
          holderSpecial: holder.special,
          holderLocked: holder.locked,
          hasValue,
          isWildTile,
          reason: hasValue ? 'hasValue' : 'isWildTile'
        });
        resolve(false);
        return;
      }
      
      // 🔥 CRITICAL: If holder is NOT locked, it means it's an active tile (should not happen, but safety check)
      if (!holder.locked) {
        console.warn('⚠️ openAtCell: Cell has unlocked holder without value - this should not happen:', {
          c, r,
          holderValue: holder.value,
          holderSpecial: holder.special,
          holderLocked: holder.locked
        });
        resolve(false);
        return;
      }
    }

    if (!holder) holder = makeBoard.createTile({ board, grid, tiles, c, r, val:0, locked:true });

    holder.locked = false;
    holder.eventMode = 'static';
    holder.cursor = 'pointer';
    bindTileWithFallback(holder, skipBind);

    if (isWild || isWildMagnet || isWildBeer){
      // 🔥 CRITICAL: Set special BEFORE setValue to ensure correct texture is applied
      holder.special = isWildBeer ? 'wild-beer' : (isWildMagnet ? 'wild-magnet' : 'wild');
      holder.isWild = true;
      holder.isWildFace = true;
      holder.value = 6;
      // Now setValue will check special FIRST and apply correct wild texture
      makeBoard.setValue(holder, 6, 0);
      // Always use applyWildSkinLocal to ensure correct texture is applied (double-check)
      applyWildSkinLocal(holder);
      try {
        startWildShimmer(holder); // Use shimmer instead of bounce
        // 🔥 WILD-BEER: Use bubbles animation instead of rotating stars
        if (holder.special === 'wild-beer') {
          startWildBeerBubbles(holder);
        } else {
          startWildStars(holder);
        }
      } catch {}
    } else {
      const v = (value == null) ? [1,2,3,4,5][(Math.random()*5)|0] : value;
      makeBoard.setValue(holder, v, 0);
    }

    holder.visible = true;
    holder.alpha = 0;
    SPAWN.spawnBounce(holder, gsap, { max: 1.08, compress: 0.96, rebound: 1.02, startScale: 0.30, wiggle: 0.035, fadeIn:0.10, timeScale: timeScale }, () => {
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
      const isWildTile = !!(t && !t.locked && (t.special === 'wild' || t.special === 'wild-magnet' || t.special === 'wild-beer' || t.isWild === true || t.isWildFace === true));
      const isActive = !!(t && !t.locked && (t.value|0) > 0);
      if (!isActive && !isWildTile && (isGhost || isMissing || isZero)) empties.push({ c, r });
    }
  }
  if (!empties.length) return null;
  return empties[(Math.random()*empties.length)|0];
}

// Track if wild-beer has been spawned (first wild spawn should be wild-beer)
let wildBeerSpawned = false;
// Track if wild-magnet has been spawned (second wild spawn should be wild-magnet)
let wildMagnetSpawned = false;
const WILD_MAGNET_SPAWN_CHANCE = 0.3; // 30% chance new wild is a magnet (after first wild-beer and wild-magnet)
const WILD_BEER_RESPAWN_CHANCE = 0.4; // 40% chance wild-beer spawns again after first spawn

async function spawnWildFromMeter(){
  if (wildMeter < 1) {
    console.log('⚠️ spawnWildFromMeter called without enough charge. Raw meter:', wildMeter);
    return false;
  }
  
  // 🔥 CRITICAL FIX v40.7: Skip wild spawn if last merge is in progress
  // Problem: Last merge (2 tiles) → merge6 → wild meter se puni → wild spawn → nova kockica na board prije clean board!
  // Solution: Provjeri da li postoji merge6 tile s _isLastMerge flag-om
  const hasLastMergeTile = STATE.tiles.some((t: any) => t && !t.destroyed && t.value === 6 && (t as any)?._isLastMerge === true);
  if (hasLastMergeTile) {
    console.log('🚨🚨🚨 LAST MERGE: Skipping wild spawn - prevent wild spawn before clean board');
    console.log('🚨🚨🚨 Wild spawn will NOT be executed, preventing wild spawn on last merge');
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
      // First wild spawn should be wild-beer
      const isFirstWild = !wildBeerSpawned;
      // Second wild spawn should be wild-magnet (after wild-beer)
      const isSecondWild = wildBeerSpawned && !wildMagnetSpawned;
      // 🔥 USER REQUEST: After first wild-beer spawn, second spawn is always wild-magnet
      // After both wild-beer and wild-magnet are spawned, 40% chance to spawn wild-beer again
      // Otherwise, 30% chance for wild-magnet, rest is regular wild
      const spawnBeer = isFirstWild || (wildBeerSpawned && wildMagnetSpawned && Math.random() < WILD_BEER_RESPAWN_CHANCE);
      const spawnMagnet = isSecondWild || (!spawnBeer && wildMagnetSpawned && Math.random() < WILD_MAGNET_SPAWN_CHANCE);
      
      const ok = await openAtCell(cell.c, cell.r, { 
        isWild: true, 
        isWildMagnet: spawnMagnet,
        isWildBeer: spawnBeer 
      });
      
      if (ok) {
        consumeCharge();
        spawned = true;
        if (spawnBeer) {
          wildBeerSpawned = true; // Mark as spawned (but can spawn again with 40% chance)
          console.log(isFirstWild ? '🍺 Wild-beer spawned (first wild spawn)' : '🍺 Wild-beer spawned again (40% chance)');
          // No board shake on spawn - only on merge 6
        } else if (spawnMagnet) {
          wildMagnetSpawned = true; // Mark as spawned
          console.log(isSecondWild ? '🧲 Wild-magnet spawned (second wild spawn)' : '🧲 Wild-magnet spawned (random roll)');
        } else {
          console.log('🌪️ Regular wild spawned (random roll)');
        }
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
  console.log('🔥🔥🔥 MERGE DESTINATION CHECK:', {
    hasDst: !!dst,
    dstValue: dst?.value,
    dstLocked: dst?.locked,
    dstDestroyed: dst?.destroyed,
    dstGridX: dst?.gridX,
    dstGridY: dst?.gridY,
    isInTiles: typeof getTiles === 'function' && getTiles ? getTiles().includes(dst) : 'unknown'
  });
  
  if (busyEnding) { helpers.snapBack?.(src); return; }
  if (src === dst) { helpers.snapBack(src); return; }
  
  // CRITICAL: Validate that both tiles are valid and merge is allowed
  if (!src || !dst || src.destroyed || dst.destroyed) {
    console.warn('⚠️ MERGE: Invalid tiles - src:', src, 'dst:', dst);
    if (src && !src.destroyed) helpers.snapBack?.(src);
    return;
  }
  
  // 🔥 CRITICAL: Check if both tiles are wild-magnet affected (pulled tiles merge)
  const srcIsWildMagnetAffected = (src as any)?._wildMagnetAffected === true;
  const dstIsWildMagnetAffected = (dst as any)?._wildMagnetAffected === true;
  const isPulledTilesMerge = srcIsWildMagnetAffected && dstIsWildMagnetAffected;
  
  // CRITICAL: If destination is locked or has value 0, this is not a valid merge (ghost placeholder)
  // BUT: For pulled tiles merge (both wild-magnet affected), allow merge even if dst is locked/value 0
  if (dst.locked || (dst.value | 0) <= 0) {
    if (!isPulledTilesMerge) {
      console.warn('🚨🚨🚨 MERGE BLOCKED: Destination is locked or has value 0');
      console.warn('⚠️ Destination:', { locked: dst.locked, value: dst.value, gridX: dst.gridX, gridY: dst.gridY });
      helpers.snapBack?.(src);
      return;
    } else {
      console.log('🧲 MERGE: Allowing pulled tiles merge even if dst is locked/value 0 (both are wild-magnet affected)');
    }
  }
  
  // Block wild/wild, wild/magnet, magnet/magnet, wild-beer/wild-beer, wild-beer/wild, wild-beer/magnet merges
  // BUT: If BOTH tiles are wild-magnet affected (pulled tiles), allow merge regardless of wild status
  const srcIsWild = src?.special === 'wild' || src?.special === 'wild-beer';
  const dstIsWild = dst?.special === 'wild' || dst?.special === 'wild-beer';
  if ((srcIsWild && dstIsWild) || 
      (src?.special === 'wild-magnet' && dst?.special === 'wild-magnet') ||
      (srcIsWild && dst?.special === 'wild-magnet') ||
      (src?.special === 'wild-magnet' && dstIsWild)){ 
    // CRITICAL: If both tiles are wild-magnet affected (pulled tiles), allow merge even if wild/wild
    if (!isPulledTilesMerge) {
      console.warn('🚨🚨🚨 MERGE BLOCKED: Wild/wild, wild/magnet, or magnet/magnet merge not allowed');
      helpers.snapBack?.(src); 
      return;
    } else {
      console.log('🧲 MERGE: Allowing wild/wild merge because both tiles are wild-magnet affected (pulled tiles)');
    }
  }

  const sum      = (src.value|0) + (dst.value|0);
  const srcDepth = src.stackDepth || 1;
  const dstDepth = dst.stackDepth || 1;

  // Wild-magnet works exactly like wild: always merges to 6
  // Also, if BOTH tiles are _wildMagnetAffected (pulled tiles), they act like wild
  // NOTE: srcIsWildMagnetAffected and dstIsWildMagnetAffected are already declared above
  const wildActive = (src.special === 'wild' || dst.special === 'wild' || src.special === 'wild-magnet' || dst.special === 'wild-magnet' || src.special === 'wild-beer' || dst.special === 'wild-beer') ||
                     (srcIsWildMagnetAffected && dstIsWildMagnetAffected);
  const wildTargetValue = wildActive ? ((src.special === 'wild' || src.special === 'wild-magnet' || src.special === 'wild-beer' || srcIsWildMagnetAffected) ? (dst.value|0) : (src.value|0)) : null;
  let effSum = sum;
  
  // 🔥 NOTE: Bubbles animation is now triggered when merge 6 animation starts (in effSum === 6 block)
  // This ensures bubbles start exactly when merge 6 shards animation begins

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

    // 🔥 COMBINED MERGE ANIMATION: Impact bump + single strong bounce
    playMergeImpactAndAbsorbAnimation(dst);

    // 2. Rotation and overlay for all stack layers (each rotates opposite to previous)
    if (srcDepth > 1 && dst.stackG && dst.stackG.children.length > 0) {
      let previousDirection = 0; // Start with no direction

      // Iterate through all stack layers (starting from bottom)
      dst.stackG.children.forEach((layer: any, index: number) => {
        if (layer && layer.alpha !== undefined) {
          // Add brown overlay to this layer
          const overlay = new Graphics();
          overlay.fill({ color: 0x8B4513, alpha: 0.4 }); // Brown color
          overlay.rect(-TILE/2, -TILE/2, TILE, TILE);

          // Position overlay at same position as the layer
          overlay.x = layer.x || 0;
          overlay.y = layer.y || 0;
          overlay.rotation = layer.rotation || 0;
          overlay.scale.set(layer.scale?.x || 1, layer.scale?.y || 1);

          dst.stackG.addChild(overlay);
          overlay.zIndex = -1;

          // Rotate this layer in opposite direction to previous layer
          const rotationDirection = previousDirection === 0 ?
            (Math.random() > 0.5 ? 1 : -1) : // First layer: random direction
            -previousDirection; // Subsequent layers: opposite to previous

          const rotationDegrees = rotationDirection * (5 + Math.random() * 5); // 5-10 degrees
          const rotationAmount = rotationDegrees * (Math.PI / 180); // Convert degrees to radians

          // Set rotation to the final value, not add to existing
          gsap.to(layer, {
            rotation: rotationAmount, // Set to final value, don't add
            duration: 0.2,
            ease: 'power2.out'
          });

          // Update previous direction for next layer
          previousDirection = rotationDirection;

          // Fade out overlay after animation
          gsap.to(overlay, {
            alpha: 0,
            duration: 0.4,
            delay: 0.2,
            onComplete: () => {
              try { overlay.destroy(); } catch {}
            }
          });
        }
      });
    }

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
    
    // COLLECTIBLES: Check for score-based unlocks
    if (score >= 100 && typeof (window as any).collectiblesManager !== 'undefined' && (window as any).collectiblesManager) {
      const manager = (window as any).collectiblesManager;
      if (typeof manager.unlockCard === 'function') {
        manager.unlockCard('score_100');
      }
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
    
    // Haptic feedback based on merge type
    if (typeof (window as any).triggerHapticImpact === 'function') {
      if (wildActive) {
        // Wild merge = Double HEAVY for longer feel
        (window as any).triggerHapticImpact('heavy');
        setTimeout(() => {
          (window as any).triggerHapticImpact('heavy');
        }, 150);
      } else {
        // All non-wild merges = LIGHT (soft like CTA buttons)
        (window as any).triggerHapticImpact('light');
      }
    }
    
    // Combo++ (bez realnog capa), bump anim
    hudSetCombo(combo + 1);
    try { HUD.bumpCombo?.({ kind: 'stack', combo }); } catch {}
    scheduleComboDecay();

    // Stats: track longest combo
    statsService.updateLongestCombo(combo);

    addWildProgress(WILD_INC_SMALL);
    
    // SMART SAVE: Debounced save after merge+spawn flow completes
    // 1200ms delay ensures all spawn animations complete before save
    // This prevents saving mid-animation which causes inconsistent state
    debouncedSaveGameState(1200);
    
    // Ghost placeholders are now fixed and always visible

    const srcSpecial = src?.special;
    const dstSpecial = dst?.special;
    gsap.to(src, {
      x: dst.x, y: dst.y, duration: 0.08, ease: 'power2.out',
      onComplete: async () => {
        removeTile(src);
        dst.eventMode = 'static';
        
        // 🔥 CRITICAL: Check if game is stuck IMMEDIATELY after regular merge
        // This catches cases where merge leaves unmergable tiles (e.g., 3+2=5, leaving only tile with value 5)
        // IMPORTANT: This check happens AFTER removeTile(src), so if only dst tile remains, activeTiles.length will be 1
        // 🔥 CRITICAL FIX: SKIP this check if wild-magnet merge (magnet will pull tiles AFTER this merge)
        const isWildMagnetMerge = srcSpecial === 'wild-magnet' || dstSpecial === 'wild-magnet';
        
        if (!busyEnding && !isWildMagnetMerge) {
          // Add delay to ensure removeTile has completed and tiles array is updated
          // 🔥 INCREASED DELAY: 100ms instead of 50ms to ensure tiles array is fully updated
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // 🔥 CRITICAL: Verify dst tile state before checking
          const activeTilesBeforeCheck = tiles.filter(tileIsVisuallyActive);
          const dstInTiles = tiles.includes(dst);
          const dstIsActive = dst && !dst.locked && (dst.value|0) > 0;
          
          console.log('🔍 Post-merge stuck check - DETAILED STATE:', {
            totalTiles: tiles.length,
            activeTilesCount: activeTilesBeforeCheck.length,
            activeTiles: activeTilesBeforeCheck.map(t => ({ 
              value: t.value, 
              special: t.special, 
              locked: t.locked,
              stackDepth: t.stackDepth || 1,
              isDst: t === dst 
            })),
            dstValue: dst.value,
            dstStackDepth: dst.stackDepth || 1,
            dstLocked: dst.locked,
            dstInTiles: dstInTiles,
            dstIsActive: dstIsActive,
            effSum: effSum,
            busyEnding: busyEnding
          });
          
          // 🔥 CRITICAL: Clear cache right before check to ensure fresh data
          clearEndGameCache();
          
          const stuckCheckContext: EndGameContext = {
            tiles,
            moves,
            makeBoard
          };
          // Force refresh because tile was just removed
          const stuckCheckResult = checkEndGame(stuckCheckContext, true);
          
          console.log('🔍 Post-merge stuck check - RESULT:', {
            resultType: stuckCheckResult.type,
            resultReason: stuckCheckResult.reason,
            activeTilesCount: activeTilesBeforeCheck.length
          });
          
          if (stuckCheckResult.type === 'stuck') {
            console.log('🚨🚨🚨 GAME STUCK after regular merge - triggering fail screen');
            console.log('🚨 Final state:', {
              activeTilesCount: activeTilesBeforeCheck.length,
              tiles: activeTilesBeforeCheck.map(t => ({ 
                value: t.value, 
                stackDepth: t.stackDepth || 1,
                special: t.special 
              })),
              reason: stuckCheckResult.reason
            });
            
            if (!busyEnding) {
              // 🔥 CRITICAL: Wait 1 second before showing fail screen
              // This gives user time to see the board state and understand why game ended
              // Without this delay, fail screen appears too fast and feels like cheating
              await new Promise(resolve => setTimeout(resolve, 1000));
              console.log('🚨 Showing fail screen NOW');
              showFinalScreen();
            } else {
              console.warn('⚠️ busyEnding is true, NOT showing fail screen');
            }
            return;
          } else {
            console.log('✅ Post-merge stuck check: Game continues -', stuckCheckResult.reason);
          }
        } else if (isWildMagnetMerge) {
          console.log('🧲 SKIPPING post-merge stuck check - wild-magnet will pull tiles after merge completes');
        }
        
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

        // 🔥 STUCK PROTECTION: Add fallback timer to check for stuck state after 1 second
        // This prevents cases where player merges 3 tiles into 1 non-6 tile and game gets stuck
        gsap.delayedCall(1.0, () => {
          if (!busyEnding) {
            console.log('🔍 STUCK PROTECTION: Checking for stuck state 1 second after merge...');
            const activeTiles = tiles.filter(tileIsVisuallyActive);
            
            // 🔥 CRITICAL FIX: NEVER trigger fail screen if there's a wild or magnet on board!
            // Wild/magnet can merge with anything, so game is NOT stuck
            const hasWildOrMagnet = activeTiles.some(t => t.special === 'wild' || t.special === 'wild-magnet' || t.special === 'wild-beer');
            if (hasWildOrMagnet) {
              console.log('✅ STUCK PROTECTION: Wild/magnet on board - game can continue, skipping fail screen');
              return;
            }
            
            // 🔥 CRITICAL FIX: NEVER trigger fail screen if there are locked tiles (animations in progress)
            const hasLockedTiles = tiles.some((t: any) => t && !t.destroyed && t.locked && ((t.value|0) > 0 || t.special === 'wild' || t.special === 'wild-magnet' || t.special === 'wild-beer'));
            if (hasLockedTiles) {
              console.log('✅ STUCK PROTECTION: Locked tiles animating - skipping fail screen');
              return;
            }
            
            // 🔥 CRITICAL FIX v39: Check stackDepth AND validate if stack CAN merge with itself
            // Stack can merge with itself ONLY if value + value <= 6
            // Example: stack(2, depth=3) → 2+2=4 <= 6 → CAN merge ✅
            // Example: stack(5, depth=3) → 5+5=10 > 6 → CANNOT merge ❌ → STUCK!
            if (activeTiles.length === 1 && activeTiles[0].value !== 6) {
              const singleTile = activeTiles[0];
              const stackDepth = singleTile.stackDepth || 1;
              const value = singleTile.value || 0;
              
              // Check if stack can merge with itself
              if (stackDepth > 1) {
                const canMergeSelf = (value + value) <= 6;
                
                if (canMergeSelf) {
                  console.log('✅ STUCK PROTECTION: Single visible tile is a stack (depth=' + stackDepth + ', value=' + value + ') that CAN merge (', value, '+', value, '=', value + value, '<= 6) - NOT stuck!');
                  return; // Stack can still merge with itself
                } else {
                  console.log('🚨 STUCK PROTECTION: Single visible tile is a stack (depth=' + stackDepth + ', value=' + value + ') that CANNOT merge (', value, '+', value, '=', value + value, '> 6) - IS STUCK!');
                  showFinalScreen();
                  return;
                }
              }
              
              console.log('🚨 STUCK PROTECTION: Single non-6 tile detected - forcing fail screen!');
              showFinalScreen();
            }
          }
        });
      }
    });
    return;
  }

  // ---- 6 (računaj combo i ovdje – nastavlja x6, x7, x8…)
  if (effSum === 6){
    // 🔥 CRITICAL: Snimiti src.special i dst.special PRIJE setValue i clearWildState!
    // setValue i clearWildState mogu promijeniti special property
    const srcSpecial = src?.special;
    const dstSpecial = dst?.special;
    
    // 🔥 NOTE: Bubbles animation is now triggered in drag-core.ts BEFORE merge function is called
    // This ensures bubbles start IMMEDIATELY when wild-beer is dropped, before any merge logic
    // No need to call it here again (it's already started in drag-core.ts)
    
    // 🔥 CRITICAL: Check if this is the last merge BEFORE starting merge 6 animation
    // This covers ALL scenarios where merge 6 is made from ALL remaining tiles:
    // - 2 tiles (stacked or not) that can merge = merge 6
    // - 3+ tiles (all stacked, e.g. 1+1+1+1+1+1) that can merge = merge 6
    // - Any combination where ALL active tiles are involved in this merge 6
    // - last tile + wild = merge 6
    // - wild + last tile(s) = merge 6
    
    // 🔥 CRITICAL: Include wild tiles even if they have value 0
    // Wild tiles should be counted as active tiles for last merge detection
    const activeTilesBeforeMerge = tiles.filter(t => {
      if (!t || t.locked) return false;
      const isWild = t.special === 'wild' || t.special === 'wild-magnet';
      const hasValue = (t.value|0) > 0;
      return isWild || hasValue; // Include if wild OR has value > 0
    });
    
    // 🔥 CRITICAL FIX v36: Count TOTAL tiles including stacked tiles (stackDepth)
    // This is essential for correct "last merge" detection with stacked tiles
    // Example: wild + stack(5, depth=3) + stack(5, depth=2) = 6 total tiles, not 3!
    // Previous bug: activeTilesCount = activeTilesBeforeMerge.length (ignored stackDepth)
    const activeTilesCount = activeTilesBeforeMerge.reduce((sum, t) => {
      const depth = t.stackDepth || 1;
      return sum + depth;
    }, 0);
    
    console.log('🔍 ACTIVE TILES COUNT (including stackDepth):', {
      visibleTiles: activeTilesBeforeMerge.length,
      totalTilesWithStackDepth: activeTilesCount,
      tilesDetails: activeTilesBeforeMerge.map(t => ({
        value: t.value,
        special: t.special,
        stackDepth: t.stackDepth || 1
      }))
    });
    
    // 🔥 CRITICAL: Check if this is a wild-magnet merge that will pull other tiles
    // If wild-magnet will pull tiles, it's NOT a last merge (unless there are no tiles to pull)
    const isWildMagnetMerge = (srcSpecial === 'wild-magnet' || dstSpecial === 'wild-magnet');
    let hasTilesToPull = false;
    if (isWildMagnetMerge) {
      // 🔥 NEW LOGIC: Count magnets and regular tiles on board
      const magnetsOnBoard = activeTilesBeforeMerge.filter((t: any) => t.special === 'wild-magnet').length;
      const regularTilesOnBoard = activeTilesBeforeMerge.filter((t: any) => 
        t.special !== 'wild-magnet' && t.special !== 'wild' && (t.value|0) > 0
      ).length;
      const totalActiveTiles = activeTilesBeforeMerge.length;
      
      console.log('🧲 Magnet pull logic check:', {
        magnetsOnBoard,
        regularTilesOnBoard,
        totalActiveTiles,
        srcSpecial,
        dstSpecial
      });
      
      // 🔥 CRITICAL: ONLY special case where magnet behaves like wild (NO pull):
      // 1 magnet + 1 regular tile (last 2 tiles) → NO pull, behaves like wild
      // ALL other cases (including 2 magnets + 1 tile) → magnet pulls normally
      const isOneMagnetOneTile = magnetsOnBoard === 1 && regularTilesOnBoard === 1 && totalActiveTiles === 2;
      
      if (isOneMagnetOneTile) {
        hasTilesToPull = false;
        console.log('🧲 Magnet behaves like wild (NO pull): 1 magnet + 1 tile (last 2)');
      } else {
        // Normal magnet behavior: Check if there are other tiles that can be pulled
      const targetTile = srcSpecial === 'wild-magnet' ? src : dst;
      const candidates = tiles.filter((t: any) => {
        if (!t || t.destroyed) return false;
        if (t.locked) return false;
        if (t === targetTile) return false;
        if (t === src || t === dst) return false; // Don't count the merging tiles
          
          // 🔥 CRITICAL FIX: Exclude tiles that are currently being pulled by another magnet
          // If a tile is already marked as _wildMagnetAffected, it's being pulled by another magnet
          // and should NOT be counted as available for this pull
          if (t._wildMagnetAffected) {
            console.log('🔍 FILTER OUT: tile already being pulled by another magnet', { value: t.value, special: t.special });
            return false;
          }
          
          // 🔥 CRITICAL FIX v37: Check if tile is wild or magnet BEFORE checking value
          // Wild-magnet and wild tiles have value = 0, but they can STILL be pulled!
          const isWildOrMagnet = t.special === 'wild' || t.special === 'wild-magnet';
          if (!isWildOrMagnet && (t.value | 0) <= 0) return false;
          
          // 🔥 CRITICAL: Wild-magnet CAN pull other wild-magnets! (MAGNET-ON-MAGNET FIX)
          // Magnet attracts everything - magnets, wild stars, ordinary tiles
        return true;
      });
      hasTilesToPull = candidates.length > 0;
      console.log('🧲 Wild-magnet merge detected - tiles that can be pulled:', candidates.length, hasTilesToPull ? '(will pull tiles, NOT last merge)' : '(no tiles to pull, might be last merge)');
      }
    }
    
    // Calculate how many tiles are involved in this merge (including stacked tiles)
    const srcDepth = src.stackDepth || 1;
    const dstDepth = dst.stackDepth || 1;
    const combinedCount = srcDepth + dstDepth; // Total tiles involved in merge (including stacked)
    
    // 🔥 CRITICAL: If ALL active tiles on board are involved in this merge, it's the last merge
    // This works for ANY number of tiles: 2, 3, 4, 5, 6... as long as they're all involved
    
    // 🔥 ENHANCED LOGGING: Log all details for debugging
    console.log('🔍 LAST MERGE CHECK (BEFORE merge 6):', {
      activeTilesCount,
      combinedCount,
      srcValue: src.value,
      dstValue: dst.value,
      srcSpecial: srcSpecial,
      dstSpecial: dstSpecial,
      srcInActiveTiles: activeTilesBeforeMerge.includes(src),
      dstInActiveTiles: activeTilesBeforeMerge.includes(dst),
      isWildMagnetMerge,
      hasTilesToPull,
      activeTilesDetails: activeTilesBeforeMerge.map(t => ({ 
        value: t.value, 
        special: t.special, 
        locked: t.locked,
        isSrc: t === src,
        isDst: t === dst
      }))
    });
    
    const allTilesInvolved = combinedCount >= activeTilesCount && 
                              activeTilesBeforeMerge.includes(src) && 
                              activeTilesBeforeMerge.includes(dst);
    
    // 🔥 CRITICAL FIX: Wild merge should NEVER be marked as "last merge" if there are other tiles on board!
    // Wild merge ALWAYS spawns new tiles (mult based on combinedCount), so it's NOT a last merge
    // Example: 2 tiles + wild = 3 tiles total
    //   - Merge tile + wild → merge 6 (wild is one of the merging tiles)
    //   - Spawns 2 new tiles (combinedCount = 2)
    //   - Board: merge 6 + 1 remaining tile + 2 new tiles = 4 tiles total
    //   - Game continues!
    // 
    // ONLY mark as last merge if:
    // 1. Exactly 2 tiles total (wild + 1 tile)
    // 2. No other tiles on board
    const oneIsRegularWild = (srcSpecial === 'wild' || dstSpecial === 'wild');
    const neitherIsWildMagnet = !(srcSpecial === 'wild-magnet' || dstSpecial === 'wild-magnet');
    const exactlyTwoActiveTiles = activeTilesCount === 2; // ONLY if 2 tiles total
    const bothTilesInActiveList = activeTilesBeforeMerge.includes(src) && activeTilesBeforeMerge.includes(dst);
    const isRegularWildLastTwo = oneIsRegularWild && 
                                 neitherIsWildMagnet &&
                                 exactlyTwoActiveTiles && // This is key - ONLY 2 tiles
                                 bothTilesInActiveList;
    
    // 🔥 ENHANCED LOGGING: Log detailed breakdown for debugging
    if (oneIsRegularWild && neitherIsWildMagnet) {
      console.log('🔍 REGULAR WILD LAST TWO CHECK:', {
        oneIsRegularWild,
        neitherIsWildMagnet,
        exactlyTwoActiveTiles,
        bothTilesInActiveList,
        activeTilesCount,
        srcSpecial,
        dstSpecial,
        srcInActive: activeTilesBeforeMerge.includes(src),
        dstInActive: activeTilesBeforeMerge.includes(dst),
        activeTilesDetails: activeTilesBeforeMerge.map(t => ({ 
          value: t.value, 
          special: t.special, 
          isSrc: t === src,
          isDst: t === dst
        })),
        isRegularWildLastTwo
      });
    }
    // 🔥 CRITICAL FIX: For wild-magnet, still check if it's last merge (2 tiles total)
    // Wild-magnet pulls tiles, so it's different from regular wild
    const isWildRegularLastTwo = (srcSpecial === 'wild' || srcSpecial === 'wild-magnet' || dstSpecial === 'wild' || dstSpecial === 'wild-magnet') &&
                                 activeTilesCount === 2 && // ONLY if exactly 2 tiles total
                                 activeTilesBeforeMerge.includes(src) &&
                                 activeTilesBeforeMerge.includes(dst) &&
                                 !(isWildMagnetMerge && hasTilesToPull); // 🔥 CRITICAL: Exclude if wild-magnet will pull tiles
    
    // 🔥 CRITICAL FIX: Wild merge should ONLY be "last merge" if exactly 2 tiles total
    // If more than 2 tiles, it's NOT last merge because spawn will happen
    // Example: wild + 2 tiles = 3 tiles total → NOT last merge, will spawn
    const isWildLastTileMerge = (srcSpecial === 'wild' || srcSpecial === 'wild-magnet' || dstSpecial === 'wild' || dstSpecial === 'wild-magnet') &&
                                 activeTilesCount === 2 && // 🔥 KEY FIX: ONLY if exactly 2 tiles total
                                 allTilesInvolved &&
                                 !(isWildMagnetMerge && hasTilesToPull); // 🔥 CRITICAL: Exclude if wild-magnet will pull tiles
    
    // Check if these tiles can merge together to form merge 6
    // Since we're in the effSum === 6 block, the merge WILL result in a merge 6
    // So if all tiles are involved, this is the last merge
    // - Wild merge always creates merge 6
    // - Regular merge: sum must equal 6 OR all tiles are involved (stacked tiles can combine to 6)
    // 🔥 CRITICAL FIX: For wild merge, ONLY mark as last merge if exactly 2 tiles total
    const canMergeTogether = wildActive || 
                             (src.value|0) + (dst.value|0) === 6 ||
                             (allTilesInvolved && (src.value|0) + (dst.value|0) <= 6); // If all tiles involved, they can merge to 6
    
    // 🔥 CRITICAL FIX: If wild merge and more than 2 tiles, NOT last merge (will spawn)
    const isLastMergeableTiles = allTilesInvolved && canMergeTogether && 
                                 (!wildActive || activeTilesCount === 2); // If wild, only last merge if 2 tiles total
    
    // 🔥 CRITICAL FIX v40.2: Explicit check for regular merge (non-wild) with exactly 2 tiles
    // This handles the case: 2 regular tiles → merge 6 → should be last merge (clean board)
    const isRegularMergeLastTwo = !wildActive && 
                                  activeTilesCount === 2 && 
                                  activeTilesBeforeMerge.includes(src) && 
                                  activeTilesBeforeMerge.includes(dst) &&
                                  (src.value|0) + (dst.value|0) === 6; // Sum equals 6
    
    // 🔥 CRITICAL FIX v40.5: Explicit check for magnet merge (magnet + regular) with exactly 2 tiles
    // This handles the case: magnet + regular tile → merge 6 → should be last merge (clean board)
    const isMagnetMergeLastTwo = (srcSpecial === 'wild-magnet' || dstSpecial === 'wild-magnet') &&
                                 activeTilesCount === 2 && 
                                 activeTilesBeforeMerge.includes(src) && 
                                 activeTilesBeforeMerge.includes(dst) &&
                                 !hasTilesToPull; // 🔥 CRITICAL: Only if magnet CANNOT pull other tiles (last 2 tiles)
    
    // 🔥 CRITICAL: Check if this is last merge (wild + regular = last 2 tiles)
    // 🔥 ENHANCED: Prioritize regular wild last two check (most common scenario)
    // 🔥 KEY FIX: For wild merge, ONLY mark as last merge if exactly 2 tiles total
    console.log('🔍 LAST MERGE CHECK DETAILS:', {
      activeTilesCount,
      wildActive,
      isRegularWildLastTwo,
      isWildRegularLastTwo,
      isLastMergeableTiles,
      isWildLastTileMerge,
      isRegularMergeLastTwo, // 🔥 v40.2: New check for regular merge
      isMagnetMergeLastTwo, // 🔥 v40.5: New check for magnet merge
      willMarkAsLastMerge: isRegularWildLastTwo || isWildRegularLastTwo || isLastMergeableTiles || isWildLastTileMerge || isRegularMergeLastTwo || isMagnetMergeLastTwo
    });
    
    if (isRegularWildLastTwo || isWildRegularLastTwo || isLastMergeableTiles || isWildLastTileMerge || isRegularMergeLastTwo || isMagnetMergeLastTwo) {
      console.log('🚨🚨🚨 LAST MERGE DETECTED (BEFORE merge 6 animation) - ALL', activeTilesCount, 'tiles are involved in merge 6');
      console.log('🚨🚨🚨 Last merge details:', {
        activeTilesCount,
        combinedCount,
        allTilesInvolved,
        canMergeTogether,
        isWildLastTileMerge,
        isWildRegularLastTwo,
        isRegularWildLastTwo, // 🔥 NEW: Regular wild last two check
        isMagnetMergeLastTwo, // 🔥 v40.5: Magnet merge last two check
        isWildMagnetMerge,
        hasTilesToPull,
        srcValue: src.value,
        dstValue: dst.value,
        srcSpecial: srcSpecial,
        dstSpecial: dstSpecial
      });
      
      // 🔥 CRITICAL: DON'T set busyEnding here - let normal merge 6 flow complete with animations
      // busyEnding will be set in onComplete callback AFTER animations finish
      // busyEnding = true; // REMOVED - was preventing normal merge 6 animations
      
      // Continue with merge 6 animation, but mark that this is the last merge
      // We'll handle clean board flow in the onComplete callback
      (dst as any)._isLastMerge = true;
      
      // 🔥 CRITICAL FIX v40.5: Mark if this was a wild merge OR magnet merge (for spawn skip logic)
      // This includes: wild + regular, regular + wild, magnet + regular, regular + magnet
      const wasWildMerge = srcSpecial === 'wild' || dstSpecial === 'wild';
      const wasMagnetMerge = srcSpecial === 'wild-magnet' || dstSpecial === 'wild-magnet';
      if (wasWildMerge || wasMagnetMerge) {
        (dst as any)._wasWildMerge = true;
        console.log('✅ _wasWildMerge flag set to TRUE (wild/magnet merge detected)', {
          wasWildMerge,
          wasMagnetMerge,
          srcSpecial,
          dstSpecial
        });
      }
      
      console.log('✅ _isLastMerge flag set to TRUE on dst tile');
    } else {
      console.log('❌ NOT last merge:', {
        activeTilesCount,
        combinedCount,
        allTilesInvolved,
        canMergeTogether,
        isWildLastTileMerge,
        isWildRegularLastTwo,
        isWildMagnetMerge,
        hasTilesToPull
      });
    }
    
    // Haptic feedback for merge 6
    if (typeof (window as any).triggerHapticImpact === 'function') {
      if (wildActive) {
        // Wild merge 6 = Double HEAVY for longer feel
        (window as any).triggerHapticImpact('heavy');
        setTimeout(() => {
          (window as any).triggerHapticImpact('heavy');
        }, 150);
      } else {
        // Normal merge 6 = MEDIUM (stronger than regular merge)
        (window as any).triggerHapticImpact('medium');
      }
    }
    
    // Use combinedCount calculated earlier (for last merge check)
    // combinedCount is already calculated above: srcDepth + dstDepth
    const visualDepth   = Math.min(4, combinedCount);

    makeBoard.setValue(dst, 6, 0);
    if (wildActive) clearWildState(dst);
    dst.stackDepth = visualDepth;
    makeBoard.drawStack(dst);
    dst.zIndex = 10000;

    // CRITICAL: For wild-magnet, use multiplier based on number of pulled tiles (max 4x)
    const isWildMagnet = src.special === 'wild-magnet' || dst.special === 'wild-magnet';
    // Calculate multiplier: if wild-magnet, will be set after pulling tiles (max 4)
    let mult = isWildMagnet ? 2 : (combinedCount >= 3 ? 3 : combinedCount); // Temporary, will be updated
    
    // Store isWildMagnet for use in onComplete callback
    const wasWildMagnet = isWildMagnet;

    // 🧲 WILD-MAGNET: Find and pull up to 4 nearest tiles IMMEDIATELY when merge 6 starts
    // This happens BEFORE the merge animation completes
    // Works for BOTH: magnet on tile AND tile on magnet
    // 🔥 CRITICAL: Only pull if hasTilesToPull is true (magnet behaves like wild if false)
    if (isWildMagnet && hasTilesToPull && dst && !dst.destroyed && !dst.locked && (dst.value | 0) > 0) {
      // 🔥 CRITICAL: Prevent overlapping wild-magnet pull animations
      if (wildMagnetPullInProgress) {
        console.warn('⚠️ Wild-magnet pull already in progress, skipping new pull animation');
        // Set mult to 1 for regular merge 6 scoring
        mult = 1;
      } else {
        wildMagnetPullInProgress = true;
      console.log('🧲 WILD-MAGNET: Merge 6 starting, finding up to 4 nearest tiles to pull IMMEDIATELY');
      
      // Find up to 4 nearest tiles to the merge location (use dst position BEFORE merge animation)
      const mergeX = dst.x;
      const mergeY = dst.y;
      
      // 🔥 CRITICAL FIX v37: Detailed logging to debug why tiles might not be found
      console.log('🔍 MAGNET PULL DEBUG: Checking all tiles on board:', {
        totalTilesInState: STATE.tiles.length,
        srcTile: { value: src.value, special: src.special, locked: src.locked },
        dstTile: { value: dst.value, special: dst.special, locked: dst.locked }
      });
      
      const allTiles = STATE.tiles.filter((tile: any) => {
        if (!tile || tile.destroyed) {
          if (tile) console.log('🔍 FILTER OUT: destroyed tile');
          return false;
        }
        if (tile === dst) {
          console.log('🔍 FILTER OUT: dst tile (merge 6 itself)');
          return false;
        }
        if (tile === src) {
          console.log('🔍 FILTER OUT: src tile (magnet itself)');
          return false;
        }
        if (tile.locked) {
          console.log('🔍 FILTER OUT: locked tile', { value: tile.value, special: tile.special });
          return false;
        }
        
        // 🔥 CRITICAL FIX: Exclude tiles that are currently being pulled by another magnet
        // If a tile is already marked as _wildMagnetAffected, it's being pulled by another magnet
        // and should NOT be pulled again
        if (tile._wildMagnetAffected) {
          console.log('🔍 FILTER OUT: tile already being pulled by another magnet', { value: tile.value, special: tile.special });
          return false;
        }
        
        // 🔥 CRITICAL FIX v37: Check if tile is wild or magnet BEFORE checking value
        // Wild-magnet and wild tiles have value = 0, but they should STILL be pulled!
        const isWildOrMagnet = tile.special === 'wild' || tile.special === 'wild-magnet';
        
        if (!isWildOrMagnet && (tile.value | 0) <= 0) {
          console.log('🔍 FILTER OUT: regular tile with value <= 0', { value: tile.value, special: tile.special });
          return false;
        }
        
        // 🔥 CRITICAL: Wild-magnets CAN pull other wild-magnets, wild stars, and ordinary tiles!
        // This is intentional behavior - magnet attracts EVERYTHING
        console.log('✅ INCLUDE: tile for pull', { value: tile.value, special: tile.special, locked: tile.locked, isWildOrMagnet });
        return true;
      });
      
      // Calculate distances and find up to 4 nearest
      const withDistance = allTiles.map((tile: any) => {
        const dx = tile.x - mergeX;
        const dy = tile.y - mergeY;
        const dist = Math.hypot(dx, dy);
        return { tile, distance: dist };
      });
      
      withDistance.sort((a, b) => a.distance - b.distance);
      const nearestTiles = withDistance.slice(0, 4).map(item => item.tile); // Max 4 tiles
      
      console.log('🧲 Found', nearestTiles.length, 'nearest tiles to pull immediately (max 4)');
      
      // 🔥 CRITICAL FIX v37: Log if no tiles can be pulled AND reset wildMagnetPullInProgress
      // Without this reset, subsequent pulls would be blocked!
      if (nearestTiles.length === 0) {
        console.warn('⚠️ WILD-MAGNET: No tiles can be pulled (all nearby tiles are locked or invalid)');
        console.log('🧲 Wild-magnet merge will proceed with mult=2 (default) and spawn 2 new tiles');
        console.log('🧲 Active tiles on board after merge:', allTiles.length + 2, '(', nearestTiles.length, 'pulled +', 2, 'merge tiles)');
        
        // 🔥 CRITICAL: Reset wildMagnetPullInProgress if no tiles to pull
        // Otherwise, subsequent magnet merges will be blocked!
        wildMagnetPullInProgress = false;
        console.log('✅ wildMagnetPullInProgress reset to false (no tiles to pull)');
      }
      
      // Update multiplier based on number of pulled tiles (max 4x)
      if (nearestTiles.length > 0) {
        mult = Math.min(4, nearestTiles.length + 1); // +1 for the main merge, max 4x
        console.log('🧲 Updated multiplier to', mult, 'x (based on', nearestTiles.length, 'pulled tiles)');
      }
      
      if (nearestTiles.length > 0) {
        // Store original positions and mark tiles as magnet-affected IMMEDIATELY
        nearestTiles.forEach((tile: any) => {
          if (!tile || tile.destroyed) return;
          
          // Store original position
          if (!tile._wildMagnetOriginalX) {
            tile._wildMagnetOriginalX = tile.x;
            tile._wildMagnetOriginalY = tile.y;
          }
          
          // 🔥 CRITICAL: Mark tiles as magnet-affected IMMEDIATELY (before animation)
          // This allows them to merge regardless of pips or wild status
          tile._wildMagnetAffected = true;
          tile._skipIdleScaleReset = true;
          
          // 🔥 CRITICAL: Disable drag for pulled tiles (prevent user from dragging them)
          tile.eventMode = 'none';
          tile.cursor = 'default';
          
          // Clear from grid immediately (they're being pulled)
          if (tile.gridX !== undefined && tile.gridY !== undefined && grid && grid[tile.gridY]) {
            grid[tile.gridY][tile.gridX] = null;
          }
          
          // 🔥 CRITICAL: Ensure tiles remain in tiles array (don't remove them yet!)
          // They will be removed when merge completes
          if (!tiles.includes(tile)) {
            console.warn('⚠️ Pulled tile not in tiles array, adding it back');
            tiles.push(tile);
            // Clear end game cache when tile is added
            clearEndGameCache();
          }
          if (!STATE.tiles.includes(tile)) {
            console.warn('⚠️ Pulled tile not in STATE.tiles array, adding it back');
            STATE.tiles.push(tile);
          }
          
          console.log('🧲 Marked tile as magnet-affected:', tile.value, 'special:', tile.special, 'in tiles:', tiles.includes(tile), 'in STATE.tiles:', STATE.tiles.includes(tile));
        });
        
        // Track how many tiles have arrived
        let arrivedCount = 0;
        const totalTiles = nearestTiles.length;
        let allTilesArrived = false;
        let multiplierShown = false;
        let mergeStarted = false; // 🔥 CRITICAL: Track if merge has started (prevent cleanup after merge begins)
        
        // 🔥 CRITICAL: Store all timeline references for cleanup (MEMORY LEAK FIX)
        const activeTimelines: any[] = [];
        
        // 🔥 CRITICAL: Calculate merge location early (for shards animation)
        const calculateMergeLocation = () => {
          const validTiles = nearestTiles.filter((t: any) => t && !t.destroyed);
          return dst && !dst.destroyed ? dst : (validTiles.length > 0 ? { x: validTiles[0].x, y: validTiles[0].y } : null);
        };
        
        // 🔥 CRITICAL: Cleanup function for pulled tiles
        // Resets tile to original state if animation is interrupted or merge fails
        const cleanupPulledTile = (tile: any, origX: number, origY: number, origRotation: number, origScaleX: number, origScaleY: number) => {
          if (!tile || tile.destroyed) return;
          
          console.log('🧹 Cleaning up pulled tile - resetting to original state');
          
          // Kill all tweens on this tile
          try {
            gsap.killTweensOf(tile);
            gsap.killTweensOf(tile.scale);
            if (tile.rotG) gsap.killTweensOf(tile.rotG);
          } catch {}
          
          // Reset position
          tile.x = origX;
          tile.y = origY;
          
          // Reset rotation
          if (tile.rotG) {
            tile.rotG.rotation = origRotation;
          } else if (tile.rotation !== undefined) {
            tile.rotation = origRotation;
          }
          
          // Reset scale
          if (tile.scale) {
            tile.scale.x = origScaleX;
            tile.scale.y = origScaleY;
          }
          
          // Clear magnet flags
          delete tile._wildMagnetAffected;
          delete tile._wildMagnetOriginalX;
          delete tile._wildMagnetOriginalY;
          delete tile._mergeTriggered75;
          delete tile._skipIdleScaleReset;
          
          // Re-enable drag
          tile.eventMode = 'static';
          tile.cursor = 'pointer';
          
          // 🔥 CRITICAL: Rebind drag handler (FAST DRAG BUG FIX)
          if (drag && typeof drag.bindToTile === 'function') {
            try {
              drag.bindToTile(tile);
              console.log('✅ Drag handler re-bound to cleaned tile');
            } catch (error) {
              console.warn('⚠️ Failed to rebind drag handler:', error);
            }
          }
          
          // Re-add to grid if it has grid coordinates
          if (tile.gridX !== undefined && tile.gridY !== undefined && grid && grid[tile.gridY]) {
            grid[tile.gridY][tile.gridX] = tile;
            console.log('✅ Tile re-added to grid at (', tile.gridX, ',', tile.gridY, ')');
          }
          
          // 🔥 CRITICAL: Force scale to exactly 1.0 (ensure no floating-point drift)
          if (tile.scale) {
            tile.scale.set(origScaleX, origScaleY);
            console.log('✅ Tile scale reset to (', origScaleX, ',', origScaleY, ')');
          }
          
          console.log('✅ Tile cleanup complete - tile restored to original state');
        };
        
        // 🔥 CRITICAL: Cleanup ALL timelines and pulled tiles (MEMORY LEAK FIX)
        const cleanupAllPullAnimations = () => {
          console.log('🧹 Cleaning up all wild-magnet pull animations - killing', activeTimelines.length, 'timelines');
          
          // Kill all active timelines
          activeTimelines.forEach((tl, idx) => {
            try {
              if (tl && !tl.killed) {
                tl.kill();
                console.log(`✅ Killed timeline ${idx + 1}/${activeTimelines.length}`);
              }
            } catch (error) {
              console.warn(`⚠️ Failed to kill timeline ${idx + 1}:`, error);
            }
          });
          
          // Clear array
          activeTimelines.length = 0;
          console.log('✅ All wild-magnet pull timelines cleaned up');
          
          // 🔥 CRITICAL: Reset wildMagnetPullInProgress when cleanup is called (FAST DRAG BUG FIX)
          // This ensures that a new pull can start even if the previous one was interrupted
          if (wildMagnetPullInProgress) {
            wildMagnetPullInProgress = false;
            console.log('✅ wildMagnetPullInProgress reset to false after cleanup');
          }
        };
        
        // Function to merge pulled tiles when both conditions are met
        const tryMergePulledTiles = async () => {
          if (allTilesArrived && multiplierShown) {
            console.log('🧲 Both conditions met: all tiles arrived AND multiplier shown, starting merge');
            
            // 🔥 CRITICAL: Mark merge as started (prevent cleanup after this point)
            mergeStarted = true;
            console.log('✅ mergeStarted flag set to true - cleanup will be skipped if animation is interrupted');
            
            try {
              // Import handleWildMagnetMergedPulledTiles asynchronously
              const { handleWildMagnetMergedPulledTiles } = await import('./app-merge');
              
              // Check if dst is still valid before merging
              // NOTE: For pulled tiles merge, dst might be removed already (merge 6 tile), so we check differently
              const validTiles = nearestTiles.filter((t: any) => t && !t.destroyed);
              
              console.log('🧲 Wild-magnet pulled tiles validation:', {
                totalPulled: nearestTiles.length,
                validTiles: validTiles.length,
                pulledTileTypes: nearestTiles.map((t: any) => ({
                  value: t?.value,
                  special: t?.special,
                  destroyed: t?.destroyed,
                  locked: t?.locked
                }))
              });
              
              if (validTiles.length >= 1) { // Changed: need at least 1 tile (can be less than 4)
                // 🔥 CRITICAL: Mark that pulled tiles merge is happening - skip normal spawn AND scoring
                // Set flag on dst BEFORE calling handleWildMagnetMergedPulledTiles
                // This ensures the flag is checked in onComplete callback
                if (dst && !dst.destroyed) {
                  (dst as any)._wildMagnetPulledTilesMerge = true;
                  (dst as any)._wildMagnetPulledTilesScoring = true; // Flag to skip scoring in main merge 6 flow
                }
                
                // 🔥 CRITICAL: Add merge function to helpers so handleWildMagnetMergedPulledTiles can use it
                const helpersWithMerge = {
                  ...helpers,
                  merge: merge, // Add merge function from app-core.ts to helpers
                  startLevel: startLevel // Add startLevel function to helpers for clean board flow
                };
                
                // Use dst if still valid, otherwise use merge location from first tile
                const mergeLocation = dst && !dst.destroyed ? dst : { x: validTiles[0].x, y: validTiles[0].y };
                
                console.log('🧲 Calling handleWildMagnetMergedPulledTiles with', validTiles.length, 'valid tiles');
                await handleWildMagnetMergedPulledTiles(mergeLocation, validTiles, helpersWithMerge);
                console.log('✅ Pulled tiles merge completed - merge 6 created with 4x multiplier');
                
                // 🔥 CRITICAL: Cleanup all timelines after successful merge (MEMORY LEAK FIX)
                cleanupAllPullAnimations();
                
                // 🔥 CRITICAL: Reset wildMagnetPullInProgress after successful merge
                wildMagnetPullInProgress = false;
                console.log('✅ Wild-magnet pull animation guard reset (merge completed)');
                
                // 🔥 CRITICAL: DON'T clean up flags immediately - they need to stay until onComplete callback checks them
                // The flags will be cleaned up in the onComplete callback after spawn completes
                // (mergeLocation as any)._wildMagnetPulledTilesMerge = undefined;
                // (mergeLocation as any)._wildMagnetPulledTilesScoring = undefined;
              } else {
                console.warn('⚠️ Not enough valid pulled tiles to merge (need at least 1, got', validTiles.length, ')');
                // Cleanup all timelines (MEMORY LEAK FIX)
                cleanupAllPullAnimations();
                // Cleanup all pulled tiles since merge failed
                nearestTiles.forEach((t: any, idx: number) => {
                  if (t && !t.destroyed) {
                    const origX = t._wildMagnetOriginalX ?? t.x;
                    const origY = t._wildMagnetOriginalY ?? t.y;
                    const origRot = 0; // Default rotation
                    const origScaleX = 1.0; // Default scale
                    const origScaleY = 1.0; // Default scale
                    cleanupPulledTile(t, origX, origY, origRot, origScaleX, origScaleY);
                  }
                });
                // Reset guard after cleanup (redundant but safe - cleanupAllPullAnimations also resets)
                wildMagnetPullInProgress = false;
              }
            } catch (err) {
              console.error('❌ Error merging pulled tiles:', err);
              console.error('❌ Error stack:', err instanceof Error ? err.stack : 'No stack trace');
              // Cleanup all timelines (MEMORY LEAK FIX)
              cleanupAllPullAnimations();
              // Cleanup all pulled tiles on error
              nearestTiles.forEach((t: any) => {
                if (t && !t.destroyed) {
                  const origX = t._wildMagnetOriginalX ?? t.x;
                  const origY = t._wildMagnetOriginalY ?? t.y;
                  const origRot = 0;
                  const origScaleX = 1.0;
                  const origScaleY = 1.0;
                  cleanupPulledTile(t, origX, origY, origRot, origScaleX, origScaleY);
                }
              });
              // Reset guard after error
              wildMagnetPullInProgress = false;
            }
          }
        };
        
        // Pull tiles towards merge location with enhanced magnetic animation
        nearestTiles.forEach((tile: any, index: number) => {
          if (!tile || tile.destroyed) return;
          
          // Store original position and rotation
          const startX = tile.x;
          const startY = tile.y;
          const startRotation = tile.rotG?.rotation || tile.rotation || 0;
          
          // Calculate direction away from center (opposite direction)
          const dx = startX - mergeX;
          const dy = startY - mergeY;
          const dist = Math.hypot(dx, dy);
          const awayDirX = dist > 0 ? dx / dist : 0;
          const awayDirY = dist > 0 ? dy / dist : 0;
          
          // Distance to move away (similar to exit animations)
          // 🔥 INCREASED: 50% more distance (42% → 63%) for exaggerated "zalet" animation
          const awayDistance = TILE * 0.63; // 63% of tile size (50% increase from 42%)
          const awayX = startX + awayDirX * awayDistance;
          const awayY = startY + awayDirY * awayDistance;
          
          // Random rotation: 10-30 degrees in either direction (clockwise or counterclockwise)
          const rotationDegrees = 10 + Math.random() * 20; // 10-30 degrees (exaggerated)
          const rotationDirection = Math.random() < 0.5 ? 1 : -1; // Random direction
          const rotationRadians = (rotationDegrees * rotationDirection) * (Math.PI / 180);
          
          // Store original scale for cleanup
          const originalScaleX = tile.scale?.x ?? 1.0;
          const originalScaleY = tile.scale?.y ?? 1.0;
          
          // Create timeline for complex animation
          // 🔥 SPEED UP: All durations reduced by 50% for faster sequential pulling (4 tiles)
          // Sequential delay: each tile starts after the previous one has moved away - FASTER for 4 tiles
          // 🔥 CRITICAL: Last tile (index === totalTiles - 1) starts 0.150s earlier to show full animation path
          const isLastTile = index === totalTiles - 1;
          const sequentialDelay = isLastTile ? (index * 0.04 - 0.150) : (index * 0.04); // Last tile starts 0.150s earlier
          const initialDelay = 0.300; // 🔥 CRITICAL: 300ms delay before pulling starts (faster than before)
          const tl = gsap.timeline({
            delay: Math.max(0, initialDelay + sequentialDelay), // Ensure delay is never negative
            onInterrupt: () => {
              // 🔥 CRITICAL: Don't cleanup if merge has already started
              if (mergeStarted) {
                console.log('⏳ Wild-magnet pull animation interrupted but merge already started - skipping cleanup for tile:', index);
                return;
              }
              // 🔥 CRITICAL: Cleanup on animation interrupt (e.g., user drags tile)
              console.warn('⚠️ Wild-magnet pull animation interrupted for tile:', index);
              cleanupPulledTile(tile, startX, startY, startRotation, originalScaleX, originalScaleY);
            },
            onComplete: () => {
              // 🔥 CRITICAL: Mark timeline as killed when complete (MEMORY LEAK FIX)
              (tl as any).killed = true;
              console.log(`✅ Timeline ${index + 1}/${totalTiles} completed and marked as killed`);
            },
            onUpdate: async () => {
              // 🔥 CRITICAL: Don't cleanup if merge has already started
              if (mergeStarted) {
                // Merge has started, let it complete - don't interrupt
                return;
              }
              
              // 🔥 CRITICAL: Safety check - tile must exist and not be destroyed
              if (!tile || tile.destroyed) {
                console.warn('⚠️ Tile destroyed during animation, cleaning up and killing timeline');
                cleanupPulledTile(tile, startX, startY, startRotation, originalScaleX, originalScaleY);
                try { tl.kill(); } catch {}
                return;
              }
              
              // 🔥 CRITICAL: Safety check - tile must have valid position properties
              if (tile.x == null || tile.y == null || typeof tile.x !== 'number' || typeof tile.y !== 'number' || !Number.isFinite(tile.x) || !Number.isFinite(tile.y)) {
                console.warn('⚠️ Tile position invalid during animation, cleaning up and killing timeline');
                cleanupPulledTile(tile, startX, startY, startRotation, originalScaleX, originalScaleY);
                try { tl.kill(); } catch {}
                return;
              }
              
              // 🔥 CRITICAL: Check if tile is 75% of the way to merge location
              // Calculate current distance to merge location
              const currentDx = tile.x - mergeX;
              const currentDy = tile.y - mergeY;
              const currentDist = Math.hypot(currentDx, currentDy);
              
              // Calculate initial distance
              const initialDx = startX - mergeX;
              const initialDy = startY - mergeY;
              const initialDist = Math.hypot(initialDx, initialDy);
              
              // Calculate progress (0 = start, 1 = end)
              const progress = initialDist > 0 ? 1 - (currentDist / initialDist) : 1;
              
              // 🔥 CRITICAL: Trigger merge when tiles are 75% of the way (0.75 progress)
              // Only trigger once per tile
              if (progress >= 0.75 && !tile._mergeTriggered75) {
                // 🔥 CRITICAL: Double-check tile is still valid before triggering merge
                if (!tile || tile.destroyed || tile.x == null || tile.y == null) {
                  console.warn('⚠️ Tile destroyed just before merge trigger, skipping');
                  try { tl.kill(); } catch {}
                  return;
                }
                
                tile._mergeTriggered75 = true;
                arrivedCount++;
                console.log(`🧲 Tile ${index + 1}/${totalTiles} reached 75% - triggering merge immediately`);
                
                // When all tiles reach 75%, trigger merge IMMEDIATELY
                if (arrivedCount === totalTiles) {
                  console.log('🧲 All tiles reached 75%, triggering merge 6 IMMEDIATELY (no final alignment)');
                  allTilesArrived = true;
                  multiplierShown = true; // Mark multiplier as shown to trigger merge immediately
                  
                  // Try to merge immediately (will merge right away)
                  // Shards animation will be triggered in mergePulledTilesIntoMerge6
                  // 🔥 CRITICAL FIX: Wrap in try-catch to prevent unhandled promise rejection
                  try {
                    await tryMergePulledTiles();
                  } catch (error) {
                    console.error('❌ Error in tryMergePulledTiles:', error);
                  }
                }
              }
            }
          });
          
          // Step 1: Move away from center + rotate (no scale yet) - FASTER for 4 tiles
          tl.to(tile, {
            x: awayX,
            y: awayY,
            duration: 0.05, // Faster: 0.05s (was 0.048s)
            ease: 'power2.out'
          }, 0);
          
          // Rotate (random 5-10 degrees)
          if (tile.rotG) {
            tl.to(tile.rotG, {
              rotation: startRotation + rotationRadians,
              duration: 0.05, // Faster: 0.05s
              ease: 'power2.out'
            }, 0);
          } else if (tile.rotation !== undefined) {
            tl.to(tile, {
              rotation: startRotation + rotationRadians,
              duration: 0.05, // Faster: 0.05s
              ease: 'power2.out'
            }, 0);
          }
          
          // Step 2: Move towards merge location - FASTER
          // 🔥 CRITICAL: Calculate 75% position - merge will trigger before reaching 100%
          const target75X = startX + (mergeX - startX) * 0.75;
          const target75Y = startY + (mergeY - startY) * 0.75;
          
          const moveDuration = 0.35; // Faster: 0.35s (was 0.55s, decreased by 0.200s)
          const scaleHoldDuration = moveDuration * 0.20; // Hold original scale for first 20% of the path
          const scaleShrinkDuration = moveDuration - scaleHoldDuration; // Shrink during remaining 80%
          const moveStartTime = 0.015; // Start time for movement animation
          
          // Move towards merge location (full path)
          // Add label at the START of movement for precise timing
          tl.addLabel('moveStart', `>${moveStartTime}`);
          
          const moveTween = tl.to(tile, {
            x: mergeX,
            y: mergeY,
            duration: moveDuration,
            ease: 'power2.inOut'
          }, 'moveStart'); // Start at moveStart label
          
          // 🔥 NEW: Scale-down to 40% AFTER reaching 40% of the path
          // Start scale-down animation at 40% progress point
          // Use scale.x/y (PIXI Point object) like in fx.js, not scaleX/scaleY
          const scaleTarget = tile;
          if (scaleTarget?.scale) {
            try { gsap.killTweensOf(scaleTarget.scale); } catch {}
            
            const currentScaleX = scaleTarget.scale.x ?? 1.0;
            const currentScaleY = scaleTarget.scale.y ?? 1.0;
            const finalScaleX = currentScaleX * 0.40;
            const finalScaleY = currentScaleY * 0.40;
            
            tl.set(scaleTarget.scale, {
              x: currentScaleX,
              y: currentScaleY
            }, 'moveStart');
            
            tl.to(scaleTarget.scale, {
              x: currentScaleX,
              y: currentScaleY,
              duration: scaleHoldDuration,
              ease: 'linear'
            }, 'moveStart');
            
            tl.to(scaleTarget.scale, {
              x: finalScaleX,
              y: finalScaleY,
              duration: scaleShrinkDuration,
              ease: 'power2.inOut'
            }, `moveStart+=${scaleHoldDuration}`);
          }
          
          // Rotate back to 0 while moving
          if (tile.rotG) {
            tl.to(tile.rotG, {
              rotation: startRotation,
              duration: moveDuration,
              ease: 'power2.inOut'
            }, '<');
          } else if (tile.rotation !== undefined) {
            tl.to(tile, {
              rotation: startRotation,
              duration: moveDuration,
              ease: 'power2.inOut'
            }, '<');
          }
          
          // 🔥 CRITICAL: Store timeline reference for cleanup (MEMORY LEAK FIX)
          activeTimelines.push(tl);
          console.log(`✅ Timeline ${index + 1}/${totalTiles} created and stored for cleanup`);
        });
        
        // Store callback to trigger merge when multiplier appears
        // This will be called from the onComplete callback after showMultiplierTile
        (dst as any)._wildMagnetMergeCallback = async () => {
          console.log('🧲 Multiplier appeared, checking if can merge pulled tiles');
          multiplierShown = true;
          // Try to merge (will only merge if all tiles have arrived)
          // 🔥 CRITICAL FIX: Wrap in try-catch to prevent unhandled promise rejection
          try {
            await tryMergePulledTiles();
          } catch (error) {
            console.error('❌ Error in tryMergePulledTiles (from multiplier callback):', error);
            // Cleanup all timelines (MEMORY LEAK FIX)
            cleanupAllPullAnimations();
            // Reset guard on error
            wildMagnetPullInProgress = false;
          }
        };
      }
        
        // 🔥 CRITICAL: Reset wildMagnetPullInProgress after animation completes or fails
        // Use a timeout to ensure it's reset even if merge fails or animation is interrupted
        setTimeout(() => {
          if (wildMagnetPullInProgress) {
            console.warn('⚠️ Wild-magnet pull animation timeout - cleaning up after 2s');
            
            // 🔥 CRITICAL: Cleanup all animations and tiles on timeout (FAST DRAG BUG FIX)
            cleanupAllPullAnimations();
            
            // Cleanup all pulled tiles
            nearestTiles.forEach((t: any) => {
              if (t && !t.destroyed && !mergeStarted) {
                // Only cleanup if merge hasn't started
                const origX = t._wildMagnetOriginalX ?? t.x;
                const origY = t._wildMagnetOriginalY ?? t.y;
                const origRot = 0;
                const origScaleX = 1.0;
                const origScaleY = 1.0;
                cleanupPulledTile(t, origX, origY, origRot, origScaleX, origScaleY);
                console.log('✅ Timeout fallback: Cleaned tile with scale reset to 1.0');
              }
            });
            
            wildMagnetPullInProgress = false;
            console.log('✅ Wild-magnet pull animation guard reset (timeout fallback with cleanup)');
          }
        }, 2000); // 2 second timeout (animation should complete in ~1s)
      }
    }

    // 🔥 CRITICAL: Check if this is a last merge BEFORE starting animation
    // If _isLastMerge is set, we need to skip spawn logic but ALLOW animations and clean board flow
    const isLastMergeScenario = (dst as any)?._isLastMerge === true;
    
    if (isLastMergeScenario) {
      console.log('🚨🚨🚨 LAST MERGE DETECTED (before animation) - Will play animations, skip spawn, and trigger clean board flow');
      console.log('🚨🚨🚨 Last merge details:', {
        srcValue: src.value,
        dstValue: dst.value,
        srcSpecial: srcSpecial,
        dstSpecial: dstSpecial,
        _isLastMerge: (dst as any)?._isLastMerge
      });
      // 🔥 CRITICAL FIX: DON'T set busyEnding here!
      // Setting busyEnding = true here prevents animations and clean board flow from running
      // We need to let animations play, then trigger clean board flow
      // busyEnding = true; // REMOVED - was preventing animations and clean board flow
    }

    gsap.to(src, {
      x: dst.x, y: dst.y, duration: 0.08, ease: 'power2.out',
      onComplete: async () => {
        // 🔥 CRITICAL: srcSpecial i dstSpecial su već snimljeni PRIJE setValue i clearWildState!
        // Koristimo ih iz closure-a, ne snimamo ih ponovo (jer bi mogli biti već promijenjeni)

        removeTile(src);
        
        // 🔥 CRITICAL: Check if this was marked as last merge BEFORE animation started
        // 🔥 ENHANCED: Double-check _isLastMerge flag and verify dst still exists
        const isLastMergeInOnComplete = (dst as any)?._isLastMerge === true;
        const dstStillExists = dst && !dst.destroyed && STATE.tiles.includes(dst);
        
        console.log('🔍 LAST MERGE CHECK in onComplete:', {
          isLastMergeInOnComplete,
          dstStillExists,
          dstValue: dst?.value,
          dstSpecial: dst?.special,
          busyEnding
        });
        
        if (isLastMergeInOnComplete) {
          const otherActive = getReactiveActiveTiles().filter((t) => t !== dst);
          if (otherActive.length === 0 && dstStillExists) {
            console.log('🚨🚨🚨 LAST MERGE DETECTED (_isLastMerge flag) - Only 2 tiles merged to merge 6');
            console.log('💥 LAST MERGE: Letting normal merge 6 flow continue (animations, dst removal, spawn check)');
            console.log('💥 LAST MERGE: Spawn will be skipped by safeguard check (line 3070), then clean board flow will trigger');
            
            // 🔥 CRITICAL: DON'T set busyEnding here - let normal merge 6 flow continue
            // The safeguard check (line 3070) will skip spawn and trigger clean board flow
            // busyEnding = true; // REMOVED - was preventing normal merge 6 flow
            
            // 🔥 CRITICAL: DON'T reset wild meter here - let safeguard check handle it
            // 🔥 CRITICAL: DON'T trigger clean board flow here - let safeguard check handle it
            // Just let the normal merge 6 flow continue (dst removal, spawn check, clean board flow)
            console.log('✅ LAST MERGE: Continuing with normal merge 6 flow (dst removal, spawn check, clean board flow)');
            // No return - continue with normal merge 6 flow
          } else if (otherActive.length > 0) {
            console.warn('⚠️ LAST MERGE: False positive detected - other active tiles remain. Continuing normal flow.', {
              otherActive: otherActive.map(t => ({ value: t.value, special: t.special, locked: t.locked }))
            });
            (dst as any)._isLastMerge = false;
            busyEnding = false;
          } else if (!dstStillExists) {
            console.warn('⚠️ LAST MERGE: _isLastMerge flag set but dst tile no longer exists. Verifying clean board...');
            const boardIsClean = otherActive.length === 0;
            if (boardIsClean) {
              busyEnding = true;
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
            (dst as any)._isLastMerge = false;
            busyEnding = false;
          }
        }
        
        // 🔥 CRITICAL: Skip endgame check if this is a wild-magnet merge that will pull tiles
        // OR if this is a regular wild merge that is NOT the last merge
        // Wild-magnet merges that pull tiles should NOT trigger endgame checks until AFTER the pulled tiles merge
        // Regular wild merges mid-game should NOT trigger endgame checks unless they're truly the last merge
        const isWildMagnetMergeWithPull = (srcSpecial === 'wild-magnet' || dstSpecial === 'wild-magnet') && 
                                          (dst as any)?._wildMagnetMergeCallback;
        const isRegularWildMerge = (srcSpecial === 'wild' || dstSpecial === 'wild') && 
                                   !(srcSpecial === 'wild-magnet' || dstSpecial === 'wild-magnet');
        const isNotLastMerge = !(dst as any)?._isLastMerge;
        
        if (isWildMagnetMergeWithPull) {
          console.log('🧲 Wild-magnet merge with pull detected - skipping endgame check until pulled tiles merge completes');
        } else if (isRegularWildMerge && isNotLastMerge) {
          console.log('⭐ Regular wild merge mid-game detected (NOT last merge) - skipping endgame check to prevent false fail screen');
        } else {
          // 🔥 CRITICAL: Use centralized end game checker
          // Check if this was the last merge AFTER removing src tile
          const lastMergeContext: EndGameContext = {
            tiles,
            moves,
            makeBoard,
            srcTile: src,
            dstTile: dst,
            justRemovedSrc: true
          };
          
          // Force refresh because src tile was just removed
          const lastMergeResult = checkEndGame(lastMergeContext, true);
        
          if (lastMergeResult.type === 'clean' && lastMergeResult.reason === 'last_merge') {
            console.log('🚨🚨🚨 LAST MERGE DETECTED (centralized checker) - Only merge 6 remains after removing src');
            console.log('💥 LAST MERGE: This check should not trigger if _isLastMerge flag was set properly');
            console.log('💥 LAST MERGE: Continuing with normal merge 6 flow (dst removal, spawn check, clean board flow)');
            
            // 🔥 CRITICAL: Set _isLastMerge flag if not already set
            if (!(dst as any)?._isLastMerge) {
              (dst as any)._isLastMerge = true;
              console.log('✅ _isLastMerge flag set to TRUE (was missing)');
            }
            
            // Don't set busyEnding or trigger clean board flow here - let normal flow handle it
            // No return - continue with normal merge 6 flow
          }
        }
        
        // 🔥 CRITICAL FIX: DON'T skip animations for last merge!
        // User needs to see merge 6 animations (smoke, shards, explosion) before clean board
        // We'll only skip SPAWN logic, not animations
        if (isLastMergeScenario) {
          console.log('🚨🚨🚨 LAST MERGE: Will play animations but skip spawn - clean board flow will trigger after animations');
        }
        
        // If busyEnding was set by another process, exit early
        if (busyEnding) {
          console.log('⏳ Last merge check skipped - busyEnding is true');
          return;
        }

        // Combo++ + bump (merge 6 hits maximum balloon)
        hudSetCombo(combo + 1);
        try { HUD.bumpCombo?.({ kind: 'merge6', combo }); } catch {}
        
        scheduleComboDecay();

        // 🔥 CRITICAL: Snimiti dst poziciju PRIJE nego što se pozovu shardovi!
        // Nakon removeTile(dst), dst može biti destroyed ili undefined
        const dstX = dst?.x ?? 0;
        const dstY = dst?.y ?? 0;
        const dstGridX = dst?.gridX ?? 0;
        const dstGridY = dst?.gridY ?? 0;
        const dstZIndex = dst?.zIndex ?? 0;
        
        // FX
        const wasWild = wildActive;
        // 🔥 CRITICAL: Determine if this is wild-magnet or wild-only merge
        const isMainWildMagnetMerge = srcSpecial === 'wild-magnet' || dstSpecial === 'wild-magnet';
        const isMainWildOnlyMerge = (srcSpecial === 'wild' || dstSpecial === 'wild' || srcSpecial === 'wild-beer' || dstSpecial === 'wild-beer') && !isMainWildMagnetMerge;
        
        if (wasWild) {
          // Standard screen shake for all wild merges (including wild-beer)
          const baseShake = Math.min(28, 12 + Math.max(1, mult) * 4);
          try {
            screenShake(app, {
              strength: baseShake,
              duration: 0.36,
              steps: 28,
              ease: 'sine.inOut'
            });
          } catch {}
          
          // 🔥 NEW SYSTEM: Direct call to woodShardsAtTile with explicit flags
          // This bypasses getMerge6ShardConfig and ensures correct shard colors
          if (isMainWildMagnetMerge) {
            // Wild-magnet merge: red/brown shards (50/50 random)
            // NO STARS for wild-magnet merge
            console.log('🔥 Wild-magnet merge 6 - using red/brown shards (NO STARS)');
            woodShardsAtTile(board, dst, { 
              enhanced: true, 
              wild: true, 
              wildMagnet: true,  // Explicitly set wildMagnet flag - this will prevent stars
              count: 30, 
              intensity: 1.9, 
              spread: 0.3,  // Dramatically reduced from 1.2 to keep shards very close to tile
              size: 1.5, 
              speed: 0.85, 
              vanishDelay: 0.0, 
              vanishJitter: 0.02 
            });
          } else if (isMainWildOnlyMerge) {
            // Wild-only merge (wild on ordinary or ordinary on wild): yellow/brown shards (50/50 random)
            // STARS WILL BE CREATED (wild: true, wildMagnet: false)
            console.log('🔥 Wild-only merge 6 - using yellow/brown shards WITH STARS (srcSpecial:', srcSpecial, 'dstSpecial:', dstSpecial, ')');
            // 🔥 WILD-BEER: Pass wild-beer info to woodShardsAtTile
            const isWildBeerMerge = srcSpecial === 'wild-beer' || dstSpecial === 'wild-beer';
            
            woodShardsAtTile(board, dst, { 
              enhanced: true, 
              wild: true,  // Explicitly set wild flag (not wild-magnet) - this will create stars
              wildMagnet: false,  // Explicitly NOT wild-magnet - this will allow stars
              isWildBeer: isWildBeerMerge,  // 🔥 Pass wild-beer flag
              count: 30, 
              intensity: 1.9, 
              spread: 0.3,  // Dramatically reduced from 1.2 to keep shards very close to tile
              size: 1.5,     // Same size as magnet merge 6
              speed: 0.85, 
              vanishDelay: 0.0, 
              vanishJitter: 0.02 
            });
            
            // Trigger only the main bubbles explosion (skip smaller fizz to avoid double-wave)
            if (isWildBeerMerge) {
              setTimeout(() => {
                try {
                  if (dst && !dst.destroyed && board) {
                    createWildBeerBubblesExplosion(board, dst);
                  }
                } catch (error) {
                  console.warn('⚠️ Failed to trigger bubbles foam:', error);
                }
              }, 200);
            }
          } else {
            // Fallback: use spawnMerge6Shards (shouldn't happen, but safety)
            console.warn('⚠️ Wild merge but neither wild-magnet nor wild-only detected, using spawnMerge6Shards');
            const srcSnapshot = { special: srcSpecial };
            const dstSnapshot = { special: dstSpecial };
            spawnMerge6Shards(board, srcSnapshot, dst, dstSnapshot, { count: 30, intensity: 1.9, spread: 0.3, size: 1.5, speed: 0.85, vanishDelay: 0.0, vanishJitter: 0.02 });
          }
          
          wildImpactEffect(dst, { squash: 0.30, stretch: 0.26, tilt: 0.18, bounce: 1.24 });
        } else {
          // 🔥 REGULAR MERGE 6: Use same system as wild/magnet merge but with 50% reduced intensity
          // Same effects as wild merge, but all parameters scaled down by 50%
          
          // 🔥 CRITICAL: Regular merge 6 shards - START 0.150s EARLIER (before glass crack)
          // This ensures shards animation starts before tile "dies off"
          // 🔥 SPEED UP: Instant procedural fade-out + animation duration exactly 1s
          const mergePos = centerInBoard(board, dst, TILE);
          regularMerge6Shards(board, { x: mergePos.x, y: mergePos.y, gridX: dstGridX, gridY: dstGridY, zIndex: dstZIndex } as any, { 
            count: 16 + Math.floor(Math.random() * 9), // Random between 16-24
            ttl: 1.0,        // Time to live (exactly 1 second)
            fastFadeOut: true,  // Enable instant procedural fade-out
            travelDurMultiplier: 0.5,  // 50% faster travel duration
            fadeDelayMultiplier: 0.1   // 90% faster fade delay (instant)
          });
          
          // Impact effect (50% of wild: squash 0.24->0.12, stretch 0.20->0.10, tilt 0.14->0.07, bounce 1.18->1.09)
          wildImpactEffect(dst, { squash: 0.12, stretch: 0.10, tilt: 0.07, bounce: 1.09 });
          
          // Smoke bubbles (50% of wild: 2.6 * 0.5 = 1.3)
          smokeBubblesAtTile(board, dst, TILE * 1.0, 1.3);
        }

        
        // Show multiplier for merge 6
        if (dst && !dst.destroyed) {
        if (wasWild) {
          showMultiplierTile(board, dst, mult, TILE * 1.3, 1.2);
          // 🔥 Wild-magnet merge: Reduce smoke intensity by 80% (3.0 * 0.2 = 0.6)
          const smokeStrength = isMainWildMagnetMerge ? 0.6 : 3.0;  // 80% reduction for wild-magnet
          smokeBubblesAtTile(board, dst, TILE * 1.3, smokeStrength, {
            sizeScale: 0.7 + Math.random() * 0.6,  // Random size: 0.7-1.3x
            countScale: 0.6 + Math.random() * 0.8, // Random count: 0.6-1.4x
            trailAlpha: 0.95
          });
        } else {
          showMultiplierTile(board, dst, mult, TILE, 1.0);
          }
          
          // 🔥 CRITICAL: For wild-magnet, trigger pulled tiles merge when multiplier animation STARTS
          // Multiplier animation starts immediately (scale from 0.12 to 1.26 over 0.18s)
          // We want to trigger when the animation starts, not when it completes
          // 🔥 SPEED UP: For wild-magnet, speed up multiplier appearance by 60% (0.18s → 0.072s)
          // Set flag on tile so showMultiplierTile can detect it and speed up animation
          if (wasWildMagnet && (dst as any)._wildMagnetMergeCallback) {
            // Mark tile so showMultiplierTile can speed up animation by 60%
            (dst as any)._wildMagnetSpeedUp = true;
            
            // Trigger immediately when multiplier animation starts (scale begins growing)
            // Note: Pulled tiles animation already started when merge 6 began (no delay)
            // Speed up by 60%: original delay was 0.2s, now 0.08s (60% faster)
            setTimeout(async () => {
              console.log(`🧲 Multiplier x${mult} animation started (sped up 60%), triggering pulled tiles merge`);
              if ((dst as any)._wildMagnetMergeCallback) {
                await (dst as any)._wildMagnetMergeCallback();
                // Clean up callback
                (dst as any)._wildMagnetMergeCallback = undefined;
                (dst as any)._wildMagnetSpeedUp = undefined;
              }
            }, 80); // Speed up by 60%: 0.2s * 0.4 = 0.08s = 80ms (was 0ms, now 80ms for 60% speedup)
          }
        } else {
          console.warn('⚠️ Cannot show multiplier - destination tile is destroyed');
        }

        if (!wasWild) {
          try {
            const base = Math.min(24, 10 + Math.max(1, mult) * 3);
            screenShake(app, { strength: base, duration: 0.32, steps: 18, ease: 'power2.out' });
          } catch {}
        }

        // CRITICAL: Store grid position BEFORE any checks
        const gx = dst.gridX, gy = dst.gridY;
        
        // 🔥 CRITICAL: Use centralized end game checker BEFORE removing dst
        // This is a safety check to catch cases where the earlier check might have missed it
        // BUT: Skip if this is a wild-magnet merge that will pull tiles OR a regular wild merge that is NOT the last merge
        const isWildMagnetMergeWithPullBeforeDst = (srcSpecial === 'wild-magnet' || dstSpecial === 'wild-magnet') && 
                                                    (dst as any)?._wildMagnetMergeCallback;
        const isRegularWildMergeBeforeDst = (srcSpecial === 'wild' || dstSpecial === 'wild') && 
                                            !(srcSpecial === 'wild-magnet' || dstSpecial === 'wild-magnet');
        const isNotLastMergeBeforeDst = !(dst as any)?._isLastMerge;
        
        if (!busyEnding && !isWildMagnetMergeWithPullBeforeDst && !(isRegularWildMergeBeforeDst && isNotLastMergeBeforeDst)) {
          // 🔥 CRITICAL FIX v40: Check for magnet/wild BEFORE calling checkEndGame
          // If magnet or wild exists on board, it's NOT a last merge - they can merge with merge6
          // This prevents premature clean board when: wild + tile + magnet → wild merge → magnet + merge6 (before spawn)
          const activeTilesBeforeCheck = tiles.filter((t: any) => {
            if (!t || t.destroyed || t.locked) return false;
            const value = (t.value | 0);
            const special = t.special;
            const isWild = special === 'wild' || special === 'wild-magnet';
            return value > 0 || isWild;
          });
          
          const hasMagnetBeforeCheck = activeTilesBeforeCheck.some((t: any) => t.special === 'wild-magnet');
          const hasWildBeforeCheck = activeTilesBeforeCheck.some((t: any) => t.special === 'wild');
          const hasMerge6BeforeCheck = activeTilesBeforeCheck.some((t: any) => t.value === 6);
          
          // 🔥 CRITICAL: If magnet + merge6 or wild + merge6 exists, skip last merge check
          // They can merge together, so it's NOT a last merge
          if ((hasMagnetBeforeCheck && hasMerge6BeforeCheck) || (hasWildBeforeCheck && hasMerge6BeforeCheck)) {
            console.log('🧲⭐ MAGNET/WILD SAFETY (before dst removal): Magnet/wild + merge6 detected - NOT a last merge, game continues');
            console.log('🧲⭐ Details:', { hasMagnet: hasMagnetBeforeCheck, hasWild: hasWildBeforeCheck, hasMerge6: hasMerge6BeforeCheck });
            // Don't call checkEndGame - continue with normal merge 6 flow (spawn, etc.)
          } else {
          const beforeDstRemovalContext: EndGameContext = {
            tiles,
            moves,
            makeBoard,
            dstTile: dst,
            justRemovedSrc: false
          };
          
          // Force refresh for critical check before dst removal
          const beforeDstRemovalResult = checkEndGame(beforeDstRemovalContext, true);
          
          // Use centralized checker result - it handles all last merge scenarios
          if (beforeDstRemovalResult.type === 'clean' && beforeDstRemovalResult.reason === 'last_merge') {
            console.log('🚨🚨🚨 LAST MERGE DETECTED (before dst removal, centralized checker) - Only merge 6 remains, triggering clean board flow');
            
            // Set busyEnding flag IMMEDIATELY to prevent any other code from running
            busyEnding = true;
            
            // Remove dst tile (merge 6) to make board clean
            if (dst && !dst.destroyed && STATE.tiles.includes(dst)) {
              grid[gy][gx] = null;
              dst.visible = false;
              removeTile(dst);
            }
            
            // CRITICAL: Reset wild meter immediately to prevent visual residue
            console.log('🔥 LAST MERGE: Resetting wild meter immediately...');
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
              console.log('✅ LAST MERGE: Wild meter reset completed');
            } catch (error) {
              console.warn('⚠️ LAST MERGE: Failed to reset wild meter:', error);
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
            return; // Exit early - don't continue with normal merge 6 flow
          }
          } // End of else block for checkEndGame call
        } else {
          if (busyEnding) {
            console.log('⏳ Last merge check (before dst removal) skipped - busyEnding is true');
          } else if (isWildMagnetMergeWithPullBeforeDst) {
            console.log('🧲 Last merge check (before dst removal) skipped - wild-magnet merge will pull tiles');
          } else if (isRegularWildMergeBeforeDst && isNotLastMergeBeforeDst) {
            console.log('⭐ Last merge check (before dst removal) skipped - regular wild merge mid-game (NOT last merge)');
          }
          // Don't return here - continue with normal merge 6 flow for wild-magnet and regular wild merges
        }
        
        // 🔥 CRITICAL: DON'T remove dst tile yet - we need it for endgame checks and spawn logic
        // dst will be removed AFTER spawn logic, not before
        // This prevents false "clean board" detection when dst is still the only remaining tile
        
        // Create locked placeholder at dst position for spawn logic
        let placeholderHolder: any = null; // 🔥 v40.1: Store reference to placeholder for cleanup
        if (dst && !dst.destroyed && STATE.tiles.includes(dst)) {
          // Clear grid position FIRST (before hiding dst)
        grid[gy][gx] = null;
          
          // Hide dst tile but DON'T remove it from tiles array yet
        dst.visible = false;
          dst.alpha = 0;
          dst.eventMode = 'none';
          
          // Create locked placeholder for spawn
          placeholderHolder = makeBoard.createTile({ board, grid, tiles, c: gx, r: gy, val: 0, locked: true });
          placeholderHolder.alpha = 0.35;
          placeholderHolder.eventMode = 'none';
          
          // 🔥 v40.1: Store reference on dst for cleanup
          (dst as any)._placeholderHolder = placeholderHolder;
          
          console.log('🔍 Dst tile hidden but NOT removed from tiles array yet - will be removed AFTER spawn');
          console.log('🔍 Placeholder created at (', gx, ',', gy, ') for spawn logic');
        } else {
          console.warn('⚠️ Destination tile is invalid or already destroyed');
        }

        // countdown moves (this happens for both normal and pulled tiles merge)
        moves = Math.max(0, moves - 1);

        // scoring with bubble multiplier and combo multiplier
        // 🔥 CRITICAL: Skip scoring if pulled tiles merge is happening (scoring handled in mergePulledTilesIntoMerge6)
        if ((dst as any)?._wildMagnetPulledTilesScoring) {
          console.log('🧲 Skipping scoring in main merge 6 flow - pulled tiles merge will handle scoring');
        } else {
        const bubbleMult = mult || 1;
        const comboMult  = combo > 0 ? combo : 1;
        const scoreDelta = 6 * bubbleMult * comboMult;
        console.log('🎯 Score calculation: mult=', mult, 'bubbleMult=', bubbleMult, 'comboMult=', comboMult, 'scoreDelta=', scoreDelta);
        
        score = Math.min(SCORE_CAP, score + scoreDelta);
        // CRITICAL: Sync STATE.score with local score after adding
        STATE.score = score;
        console.log('🎯 Final score after merge:', score, 'STATE.score:', STATE.score);

        animateBoardHUD(boardNumber, 0.40);
        animateScore(score, 0.40);
        }

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
        
        // COLLECTIBLES: Dispatch event for first merge 6
        if (!wasWild && typeof (window as any).collectiblesManager !== 'undefined' && (window as any).collectiblesManager) {
          const manager = (window as any).collectiblesManager;
          if (typeof manager.unlockCard === 'function') {
            manager.unlockCard('first_merge_6');
          }
        }
        
        // Ghost placeholders are now fixed and always visible

        // ► CLEAN BOARD flow (centralized orchestrator)
        // 🔥 CRITICAL: Skip end game check if pulled tiles merge is happening
        // The check will be done AFTER pulled tiles merge completes and spawns new tiles
        if ((dst as any)?._wildMagnetPulledTilesMerge) {
          console.log('🧲 Skipping end game check - pulled tiles merge in progress, will check after spawn completes');
          // Don't check end game here - it will be checked after pulled tiles merge completes
          // The pulled tiles merge handler will spawn new tiles and then check end game
          return;
        }
        
        // 🔥 REMOVED: Premature endgame check that was blocking spawn logic
        // The endgame check was running BEFORE spawn, causing board to look empty (dst removed)
        // This made it trigger clean board flow instead of spawning new tiles
        // Endgame check will be done AFTER spawn in checkLevelEnd()
        console.log('🎯 Merge 6 completed, proceeding to spawn logic...');
        
        // Game continues - check moves and proceed with spawn
        if (moves === 0) {
          // Use centralized checker for moves depleted scenario
          const movesDepletedContext: EndGameContext = {
            tiles,
            moves: 0,
            makeBoard
          };
          
          // 🔥 CRITICAL: Use forceRefresh for moves depleted check
          const movesDepletedResult = checkEndGame(movesDepletedContext, true);
          
          if (movesDepletedResult.type === 'stuck') {
            console.log('🚨🚨🚨 MOVES DEPLETED + GAME STUCK');
            if (!busyEnding) {
              showFinalScreen();
            }
            return;
          }
        }

        addWildProgress(WILD_INC_BIG);
        // Pass wild merge target info for smart spawning
        const wildMergeTarget = Number.isFinite(wildTargetValue) ? wildTargetValue : null;
        
        // 🔥 CRITICAL: Skip normal spawn if pulled tiles merge is happening
        // Pulled tiles merge already spawns new tiles in mergePulledTilesIntoMerge6
        if ((dst as any)?._wildMagnetPulledTilesMerge) {
          console.log('🧲 Skipping normal spawn - pulled tiles merge already spawned tiles');
          // 🔥 CRITICAL: Clean up flags AFTER checking (they were set before handleWildMagnetMergedPulledTiles)
          (dst as any)._wildMagnetPulledTilesMerge = undefined;
          (dst as any)._wildMagnetPulledTilesScoring = undefined;
          
          // 🔥 CRITICAL FIX: We MUST call checkLevelEnd after magnet pull spawn completes!
          // Otherwise the game will never check for endgame conditions
          // Wait a bit for spawn animations to complete, then check
          console.log('🧲 Waiting 1000ms for magnet pull spawn animations to complete...');
          await new Promise(res => setTimeout(res, 1000));
          
          // Log board state before check
          const activeTilesAfterPull = tiles.filter(tileIsVisuallyActive);
          console.log('🔍 Board state AFTER magnet pull:', {
            activeTilesCount: activeTilesAfterPull.length,
            activeTiles: activeTilesAfterPull.map(t => ({ 
              value: t.value, 
              special: t.special, 
              locked: t.locked
            }))
          });
          
          // Call checkLevelEnd to verify game can continue
          console.log('🧲 Calling checkLevelEnd after magnet pull spawn...');
          checkLevelEnd();
          return;
        }
        
        // 🔥 CRITICAL: Last merge checks are handled earlier (after src removal and before dst removal)
        // If we reach here, it means it's NOT a last merge scenario, so proceed with normal spawn
        
        // 🔥 SAFEGUARD: Double-check _isLastMerge flag before spawning
        // 🔥 ENHANCED: Also check active tiles count to catch edge cases
        const activeTilesBeforeSpawn = tiles.filter(tileIsVisuallyActive);
        const isLastMergeFlagSet = (dst as any)?._isLastMerge === true;
        const onlyMerge6Remains = activeTilesBeforeSpawn.length === 1 && activeTilesBeforeSpawn[0] === dst && dst.value === 6;
        
        console.log('🔍 PRE-SPAWN CHECK:', {
          isLastMergeFlagSet,
          onlyMerge6Remains,
          activeTilesCount: activeTilesBeforeSpawn.length,
          dstValue: dst.value,
          dstInTiles: tiles.includes(dst),
          activeTilesDetails: activeTilesBeforeSpawn.map(t => ({ 
            value: t.value, 
            special: t.special, 
            isDst: t === dst 
          }))
        });
        
        if (isLastMergeFlagSet || onlyMerge6Remains) {
          console.log('🚨🚨🚨 SAFEGUARD: _isLastMerge flag detected OR only merge 6 remains - preventing spawn');
          console.log('🚨🚨🚨 Reason:', isLastMergeFlagSet ? '_isLastMerge flag is TRUE' : 'Only merge 6 remains on board');
          
          // 🔥 CRITICAL: If _isLastMerge flag is set, we should have already handled clean board flow
          // But if we reach here, it means the flag was set but clean board flow wasn't triggered
          // This can happen if the onComplete callback didn't run or was skipped
          // So we need to trigger clean board flow here as a safeguard
          if (isLastMergeFlagSet) {
            console.log('🚨🚨🚨 _isLastMerge flag is TRUE but we reached pre-spawn check - triggering clean board flow as safeguard');
          busyEnding = true;
          
            // Remove dst tile and trigger clean board flow
            if (dst && !dst.destroyed && STATE.tiles.includes(dst)) {
              grid[dst.gridY][dst.gridX] = null;
              dst.visible = false;
              removeTile(dst);
            }
            
            // Reset wild meter
          wildMeter = 0;
          STATE.wildMeter = 0;
          resetWildProgress(0, false);
          
          try {
            if (typeof HUD.resetWildMeter === 'function') {
                HUD.resetWildMeter(true);
            } else {
              HUD.updateProgressBar?.(0, false);
            }
          } catch (error) {
              console.warn('⚠️ Failed to reset wild meter:', error);
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

          // If only merge 6 remains but flag not set, trigger clean board flow
          if (onlyMerge6Remains && !isLastMergeFlagSet) {
            console.log('🚨🚨🚨 Only merge 6 remains but _isLastMerge flag not set - setting it now and triggering clean board');
            (dst as any)._isLastMerge = true;
            busyEnding = true;
            
            // Remove dst tile and trigger clean board flow
            if (dst && !dst.destroyed && STATE.tiles.includes(dst)) {
              grid[dst.gridY][dst.gridX] = null;
              dst.visible = false;
              removeTile(dst);
            }
            
            // Reset wild meter
            wildMeter = 0;
            STATE.wildMeter = 0;
            resetWildProgress(0, false);
            
            try {
              if (typeof HUD.resetWildMeter === 'function') {
                HUD.resetWildMeter(true);
              } else {
                HUD.updateProgressBar?.(0, false);
              }
            } catch (error) {
              console.warn('⚠️ Failed to reset wild meter:', error);
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
          }
          
          return;
        }
        
        // 🔥 CRITICAL: Skip spawn if this was marked as last merge
        // This prevents spawning new tiles when wild + regular merge is the last 2 tiles
        // 🔥 ENHANCED: Check both the captured isLastMergeScenario AND the current dst._isLastMerge flag
        // 🔥 ENHANCED: Also check if only merge 6 remains (double-check active tiles count)
        const currentIsLastMerge = (dst as any)?._isLastMerge === true;
        const activeTilesAfterSrcRemoval = tiles.filter(t => {
          if (!t || t.locked) return false;
          const isWild = t.special === 'wild' || t.special === 'wild-magnet';
          const hasValue = (t.value|0) > 0;
          return isWild || hasValue;
        });
        
        // 🔥 CRITICAL FIX v40.1: Check for magnet/wild BEFORE determining if only merge6 remains
        // If magnet/wild exists, it's NOT a last merge - they can merge with merge6
        const hasMagnetAfterSrcRemoval = activeTilesAfterSrcRemoval.some(t => t.special === 'wild-magnet');
        const hasWildAfterSrcRemoval = activeTilesAfterSrcRemoval.some(t => t.special === 'wild');
        
        // Only consider it "last merge" if NO other active tiles (excluding magnet/wild that can merge with merge6)
        const onlyMerge6RemainsAfterSrcRemoval = activeTilesAfterSrcRemoval.length === 1 && 
                                  activeTilesAfterSrcRemoval[0] === dst &&
                                  dst.value === 6 &&
                                  !hasMagnetAfterSrcRemoval && // 🔥 v40.1: Magnet can merge with merge6
                                  !hasWildAfterSrcRemoval;     // 🔥 v40.1: Wild can merge with merge6
        
        // 🔥 CRITICAL FIX v40.2: Explicit check for regular merge (non-wild) with exactly 2 tiles
        // This handles the case: 2 regular tiles → merge 6 → should skip spawn (clean board)
        // Check if dst is merge 6 and there are no other active tiles (excluding locked placeholders)
        const isRegularMerge6LastTwo = dst && 
                                       dst.value === 6 && 
                                       activeTilesAfterSrcRemoval.length === 1 && 
                                       activeTilesAfterSrcRemoval[0] === dst &&
                                       !hasMagnetAfterSrcRemoval &&
                                       !hasWildAfterSrcRemoval &&
                                       !(dst.special === 'wild' || dst.special === 'wild-magnet'); // Not a wild merge
        
        // 🔥 CRITICAL FIX v40.5: Explicit check for wild/magnet merge (wild/magnet + regular) with exactly 2 tiles
        // This handles the cases:
        //   - wild + regular tile → merge 6 → should skip spawn (clean board)
        //   - magnet + regular tile → merge 6 → should skip spawn (clean board)
        //   - regular + wild/magnet → merge 6 → should skip spawn (clean board)
        // Check if dst is merge 6 from wild/magnet merge and there are no other active tiles
        // Use _wasWildMerge flag set during last merge detection (line 2381) - includes both wild and magnet
        const isWildMerge6LastTwo = dst && 
                                    dst.value === 6 && 
                                    activeTilesAfterSrcRemoval.length === 1 && 
                                    activeTilesAfterSrcRemoval[0] === dst &&
                                    !hasMagnetAfterSrcRemoval &&
                                    !hasWildAfterSrcRemoval &&
                                    (dst as any)._wasWildMerge === true; // Flag set during wild/magnet merge last merge detection
        
        // 🔥 CRITICAL: Multiple checks to prevent spawn
        if (isLastMergeScenario || currentIsLastMerge || busyEnding || onlyMerge6RemainsAfterSrcRemoval || isRegularMerge6LastTwo || isWildMerge6LastTwo) {
          console.log('🚨🚨🚨 LAST MERGE: Skipping spawn - preventing new tile spawn', {
            isLastMergeScenario,
            currentIsLastMerge,
            busyEnding,
            onlyMerge6RemainsAfterSrcRemoval,
            isRegularMerge6LastTwo, // 🔥 v40.2: New check for regular merge
            isWildMerge6LastTwo, // 🔥 v40.5: New check for wild merge
            wasWildMerge: (dst as any)?._wasWildMerge,
            activeTilesAfterSrcRemoval: activeTilesAfterSrcRemoval.length,
            dstExists: !!dst,
            dstValue: dst?.value,
            dstSpecial: dst?.special,
            activeTilesDetails: activeTilesAfterSrcRemoval.map(t => ({ 
              value: t.value, 
              special: t.special,
              isDst: t === dst
            }))
          });
          
          // 🔥 CRITICAL FIX v40.1: Clean up placeholder if spawn is skipped
          // Placeholder was created but won't be used, so remove it
          const placeholderHolder = (dst as any)?._placeholderHolder;
          if (placeholderHolder && !placeholderHolder.destroyed) {
            console.log('🧹 LAST MERGE: Cleaning up placeholder (spawn skipped)');
            
            // Remove from grid
            if (placeholderHolder.gridX !== undefined && placeholderHolder.gridY !== undefined && grid && grid[placeholderHolder.gridY]) {
              grid[placeholderHolder.gridY][placeholderHolder.gridX] = null;
            }
            
            // Remove from tiles array
            removeTile(placeholderHolder);
            
            // Clear reference
            if (dst) {
              (dst as any)._placeholderHolder = undefined;
            }
            
            console.log('✅ Placeholder removed (spawn skipped)');
          }
          
          // 🔥 CRITICAL: If we somehow reached here with _isLastMerge set OR only merge 6 remains, trigger clean board flow as safeguard
          // 🔥 CRITICAL FIX v40.2: Also check isRegularMerge6LastTwo for regular merge (non-wild) with 2 tiles
          // 🔥 CRITICAL FIX v40.5: Also check isWildMerge6LastTwo for wild merge (wild + regular) with 2 tiles
          if ((currentIsLastMerge || onlyMerge6RemainsAfterSrcRemoval || isRegularMerge6LastTwo || isWildMerge6LastTwo) && !busyEnding) {
            console.warn('⚠️ LAST MERGE: Reached spawn section with _isLastMerge flag set OR only merge 6 remains OR regular/wild merge 6 last two - triggering clean board flow as safeguard');
            busyEnding = true;
            
            // Remove dst tile if it still exists
            if (dst && !dst.destroyed && STATE.tiles.includes(dst)) {
              grid[dst.gridY][dst.gridX] = null;
              dst.visible = false;
              removeTile(dst);
            }
            
            // Reset wild meter
            wildMeter = 0;
            STATE.wildMeter = 0;
            resetWildProgress(0, false);
            
            try {
              if (typeof HUD.resetWildMeter === 'function') {
                HUD.resetWildMeter(true);
              } else {
                HUD.updateProgressBar?.(0, false);
              }
            } catch (error) {
              console.warn('⚠️ Failed to reset wild meter:', error);
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
          }
          
          return; // Exit early - don't spawn new tiles
        }
        
        // Use multiplier for spawning new tiles
        const spawnMult = mult;
        
        // 🔥 CRITICAL: Get pulled cells from dst tile to exclude from normal spawn
        const pulledCells = (dst as any)?._wildMagnetPulledCells || [];
        const pulledCellsSet = new Set(pulledCells.map((cell: { c: number; r: number }) => `${cell.c},${cell.r}`));
        
        console.log('🎯 Spawning new tiles with multiplier:', spawnMult);
        console.log('🎯 Excluding pulled cells from spawn:', pulledCells);
        
        await FLOW.openLockedBounceParallel({ 
          tiles, 
          k: spawnMult, 
          drag, 
          makeBoard, 
          gsap, 
          drawBoardBG, 
          TILE, 
          fixHoverAnchor, 
          spawnBounce: (t, done, o)=>SPAWN.spawnBounce(t, gsap, o, done),
          wildMergeTarget,
          excludeCells: pulledCellsSet  // 🔥 CRITICAL: Exclude pulled cells from spawn
        });
        
        console.log('✅ openLockedBounceParallel completed - all spawn animations finished');
        
        // 🔥 CRITICAL FIX v40.1: Clean up unused placeholder if it wasn't used in spawn
        // Placeholder might not be used if spawnMult = 0 or if placeholder was excluded
        const placeholderHolderAfterSpawn = (dst as any)?._placeholderHolder;
        if (placeholderHolderAfterSpawn && !placeholderHolderAfterSpawn.destroyed) {
          // Check if placeholder is still locked (wasn't used in spawn)
          if (placeholderHolderAfterSpawn.locked && (placeholderHolderAfterSpawn.value | 0) === 0) {
            console.log('🧹 Cleaning up unused placeholder at (', placeholderHolderAfterSpawn.gridX, ',', placeholderHolderAfterSpawn.gridY, ')');
            
            // Remove from grid
            if (placeholderHolderAfterSpawn.gridX !== undefined && placeholderHolderAfterSpawn.gridY !== undefined && grid && grid[placeholderHolderAfterSpawn.gridY]) {
              grid[placeholderHolderAfterSpawn.gridY][placeholderHolderAfterSpawn.gridX] = null;
            }
            
            // Remove from tiles array
            removeTile(placeholderHolderAfterSpawn);
            
            console.log('✅ Unused placeholder removed successfully');
          } else {
            console.log('✅ Placeholder was used in spawn - no cleanup needed');
          }
          
          // Clear reference
          if (dst) {
            (dst as any)._placeholderHolder = undefined;
          }
        }
        
        // 🔥 CRITICAL: NOW remove dst tile after spawn completes
        // This was previously done BEFORE spawn, which caused false "clean board" detection
        if (dst && !dst.destroyed && STATE.tiles.includes(dst)) {
          console.log('🗑️ Removing dst tile AFTER spawn (delayed from earlier)');
          // Note: grid[gy][gx] was already set to null when placeholder was created
          removeTile(dst); // Remove from tiles array
          console.log('✅ Dst tile removed successfully');
        }
        
        // Clean up pulled cells flag after spawn
        if ((dst as any)?._wildMagnetPulledCells) {
          (dst as any)._wildMagnetPulledCells = undefined;
        }
        
        // Update idle bounce tile list with newly spawned tiles
        if (TILE_IDLE_BOUNCE.ENABLE) {
          try {
            TILE_IDLE_BOUNCE.updateTileList(tiles);
            console.log('🔄 Updated idle bounce tile list after spawn');
          } catch (error) {
            console.warn('⚠️ Failed to update idle bounce tile list:', error);
          }
        }
        
        // 🔥 CRITICAL: Wait 500ms AFTER spawn animations complete to let user see the board
        // This ensures user can see the spawned tiles before endgame check runs
        // Total delay: spawn animations (~480ms) + this delay (500ms) + checkLevelEnd delay (1200ms) = ~2180ms
        console.log('⏳ Waiting 500ms after spawn animations to let user see board state...');
        await new Promise(res => setTimeout(res, 500));
        
        // 🔥 CRITICAL: Log detailed board state before calling checkLevelEnd
        const activeTilesBeforeCheck = tiles.filter(tileIsVisuallyActive);
        console.log('🔍 Board state BEFORE checkLevelEnd:', {
          activeTilesCount: activeTilesBeforeCheck.length,
          activeTiles: activeTilesBeforeCheck.map(t => ({ 
            value: t.value, 
            special: t.special, 
            locked: t.locked,
            gridX: t.gridX,
            gridY: t.gridY
          })),
          wildMergeTarget: wildMergeTarget,
          spawnMult: spawnMult
        });
        
        // 🔥 CRITICAL FIX: If there's a magnet on board after merge 6, DON'T call checkLevelEnd yet
        // Magnet can pull tiles and create merges, so we should wait for player to use it
        // This prevents premature fail screen when: magnet + wild + tile → wild merge → magnet + merge6 + new tiles
        const hasMagnetAfterSpawn = activeTilesBeforeCheck.some(t => t.special === 'wild-magnet');
        if (hasMagnetAfterSpawn) {
          console.log('🧲 MAGNET SAFETY: Magnet detected after merge 6 spawn - SKIPPING checkLevelEnd to allow player to use magnet');
          console.log('🧲 Player can merge magnet with spawned tiles or pull tiles together');
          // Don't call checkLevelEnd - let player make next move
          // checkLevelEnd will be called after player's next move
          return;
        }
        
        // 🔥 CRITICAL: Check end game after spawn completes (with delay to allow animations)
        // Use checkLevelEnd which already has proper delay and handles all edge cases
        // This replaces the inline setTimeout check to avoid duplicate checks
        checkLevelEnd();
      }
    });
    return;
  }

  // >6 shouldn't happen
  helpers.snapBack(src);
  dst.eventMode = 'static';
}

async function checkMovesDepleted(){
  // Use centralized end game checker
  if (busyEnding) return;
  
  const movesDepletedCheckContext: EndGameContext = {
    tiles,
    moves: 0,
    makeBoard
  };
  
  // 🔥 CRITICAL: Use forceRefresh for moves depleted check
  const movesDepletedCheckResult = checkEndGame(movesDepletedCheckContext, true);
  
  if (movesDepletedCheckResult.type === 'stuck') {
    console.log('🚨🚨🚨 MOVES DEPLETED + GAME STUCK');
    if (!busyEnding) {
      // 🔥 CRITICAL: Wait 1 second before showing fail screen so user can see the board state
      console.log('⏳ Waiting 1 second before showing fail screen so user can see board state...');
      await new Promise(res => setTimeout(res, 1000));
      showFinalScreen();
    }
  } else {
    console.log('✅ Moves depleted but merges still possible, game continues');
  }
}

// -------------------- level-end scaffolding --------------------
// NOTE: All end game checks now use centralized checkEndGame() from endgame-checker.ts
// All deprecated functions (activeTilesList, isStuck, isBoardClean, showCleanBoardEdgeCase) have been removed
function checkLevelEnd(){
  // 🔥 v38: Reset retry counter on new checkLevelEnd() call (not reschedule)
  checkLevelEndRetryCount = 0;
  
  // Always wait a bit so animations/spawns can finish before deciding
  try {
    checkLevelEndTimer?.kill?.();
  } catch {}

  checkLevelEndTimer = gsap.delayedCall(CHECK_LEVEL_END_DELAY_MS / 1000, async () => {
    checkLevelEndTimer = null;
    if (busyEnding) {
      console.log('⏳ checkLevelEnd skipped - busyEnding is true');
      checkLevelEndRetryCount = 0; // Reset on exit
      return;
    }
    
    console.log('🎯 checkLevelEnd called - using centralized end game checker...');
    
    // 🔥 CRITICAL: Skip check if wild spawn is in progress (animation not finished yet)
    if (wildSpawnInProgress) {
      checkLevelEndRetryCount++;
      console.log('⏳ checkLevelEnd skipped - wild spawn animation in progress (retry', checkLevelEndRetryCount, '/', MAX_CHECK_LEVEL_END_RETRIES, ')');
      
      // 🔥 v38: Check max retries to prevent infinite loop
      if (checkLevelEndRetryCount > MAX_CHECK_LEVEL_END_RETRIES) {
        console.error('🚨 checkLevelEnd: Max retries exceeded for wild spawn - forcing check anyway');
        checkLevelEndRetryCount = 0;
        // Continue to check (don't return)
      } else {
      // Reschedule after spawn completes
      checkLevelEndTimer = gsap.delayedCall(0.3, () => {
        checkLevelEndTimer = null;
        checkLevelEnd();
      });
      return;
    }
    }
    
    // 🔥 CRITICAL FIX: Skip check if there are LOCKED tiles with value > 0 (spawn animations in progress)
    // This prevents premature fail screen when tiles are still being spawned/animated
    const lockedActiveTiles = tiles.filter((t: any) => {
      if (!t || t.destroyed) return false;
      if (!t.locked) return false; // Only check locked tiles
      return (t.value|0) > 0 || t.special === 'wild' || t.special === 'wild-magnet';
    });
    
    if (lockedActiveTiles.length > 0) {
      checkLevelEndRetryCount++;
      console.log('⏳ checkLevelEnd skipped - locked active tiles still animating (retry', checkLevelEndRetryCount, '/', MAX_CHECK_LEVEL_END_RETRIES, '):', {
        lockedCount: lockedActiveTiles.length,
        lockedTiles: lockedActiveTiles.map(t => ({ value: t.value, special: t.special, gridX: t.gridX, gridY: t.gridY }))
      });
      
      // 🔥 v38: Check max retries to prevent infinite loop
      if (checkLevelEndRetryCount > MAX_CHECK_LEVEL_END_RETRIES) {
        console.error('🚨 checkLevelEnd: Max retries exceeded for locked tiles - forcing check anyway');
        console.error('🚨 WARNING: Tiles still locked:', lockedActiveTiles.map(t => ({ value: t.value, locked: t.locked })));
        checkLevelEndRetryCount = 0;
        // Continue to check (don't return)
      } else {
        // Reschedule after animations complete
        checkLevelEndTimer = gsap.delayedCall(0.5, () => {
          checkLevelEndTimer = null;
          checkLevelEnd();
        });
        return;
      }
    }
    
    // 🔥 v38: Reset retry counter after successful reschedule bypass (tiles no longer locked/spawn done)
    checkLevelEndRetryCount = 0;
    
    // Check for emergency rescue first
    if (needsEmergencyRescue(tiles)) {
      console.log('🚨 EMERGENCY: Wild cubes exist but no non-wild tiles! Scheduling emergency rescue...');
      const wildCubes = tiles.filter(t => t.special === 'wild' || t.special === 'wild-magnet');
      const emergencyCount = Math.min(3, Math.max(2, wildCubes.length));
      scheduleWildRescue('checkLevelEnd', emergencyCount);
      return;
    }
    
    // Use centralized end game checker
    const checkLevelEndContext: EndGameContext = {
      tiles,
      moves,
      makeBoard
    };
    
    // 🔥 CRITICAL: Use forceRefresh because delay might have caused cache staleness
    const checkLevelEndResult = checkEndGame(checkLevelEndContext, true);
    
    if (checkLevelEndResult.type === 'clean') {
      const wildReady = wildMeter >= 1 || wildSpawnInProgress || wildSpawnRetryTimer !== null;
      if (wildReady) {
        console.log('⚠️ checkLevelEnd: Clean board detected but wild meter is ready/spawning – deferring clean board flow until wild cube drops');
        queueWildSpawnIfNeeded();
      return;
    }
      
      // 🔥 CRITICAL FIX: Check if there's a magnet on board that can be used for merge
      // If magnet exists, it's NOT a clean board - user can still merge magnet with merge 6
      const activeTiles = tiles.filter((t: any) => {
        if (!t || t.destroyed) return false;
        if (t.locked && (t.value|0) <= 0) return false; // Ghost placeholder
        return (t.value|0) > 0 || t.special === 'wild' || t.special === 'wild-magnet';
      });
      const hasMagnet = activeTiles.some((t: any) => t.special === 'wild-magnet');
      
      if (hasMagnet) {
        console.log('🧲 checkLevelEnd: Magnet detected on board - NOT a clean board, game continues');
        return; // Don't trigger clean board - game continues
      }
      
      console.log('🚨🚨🚨 checkLevelEnd: Board is clean, triggering clean board flow');
    
      // 🔥 CRITICAL: Actually trigger runEndgameFlow, don't just log!
      if (!busyEnding) {
      busyEnding = true;
        
        // CRITICAL: Reset wild meter immediately
        wildMeter = 0;
        STATE.wildMeter = 0;
        resetWildProgress(0, false);
        
        try {
          if (typeof HUD.resetWildMeter === 'function') {
            HUD.resetWildMeter(true);
          } else {
            HUD.updateProgressBar?.(0, false);
          }
        } catch (error) {
          console.warn('⚠️ checkLevelEnd: Failed to reset wild meter:', error);
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
      }
      return;
    }
    
    if (checkLevelEndResult.type === 'stuck') {
      console.log('🚨🚨🚨 checkLevelEnd: Game is stuck, showing fail screen');
      console.log('🔍 checkLevelEnd: Stuck reason:', checkLevelEndResult.reason);
      console.log('🔍 checkLevelEnd: Current tiles:', tiles.filter(tileIsVisuallyActive).map(t => ({ 
        value: t.value, 
        special: t.special, 
        locked: t.locked 
      })));
      if (!busyEnding) {
        // 🔥 CRITICAL: Wait 1 second before showing fail screen so user can see the board state
        // This prevents instant fail screen when board becomes non-mergable (e.g. after wild spawn)
        console.log('⏳ Waiting 1 second before showing fail screen so user can see board state...');
        await new Promise(res => setTimeout(res, 1000));
        showFinalScreen();
      } else {
        console.warn('⚠️ checkLevelEnd: busyEnding is true, skipping showFinalScreen');
      }
    } else {
      console.log('✅ checkLevelEnd: Game continues -', checkLevelEndResult.reason);
    }
  });
}

// 🔥 REMOVED: showCleanBoardEdgeCase() - DEPRECATED function no longer needed
// Endgame checker handles all edge cases now

async function openLockedBounceParallel(k){
  await FLOW.openLockedBounceParallel({ tiles, k, drag, makeBoard, gsap, drawBoardBG, TILE, fixHoverAnchor, spawnBounce: (t, done, o)=>SPAWN.spawnBounce(t, gsap, o, done) });
}

// -------------------- helpers --------------------
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

function removeTile(t){
  if(!t) return;
  
  // 🔥 CRITICAL: Clear cache BEFORE removing tile to prevent race conditions
  // This ensures checkEndGame gets fresh data even if called during removal
  const idx = tiles.indexOf(t);
  if (idx !== -1) {
    clearEndGameCache(); // Clear cache BEFORE splice
  }
  
  try { if (t.hover && typeof t.hover.clear === 'function') t.hover.clear(); } catch {}
  t.eventMode='none'; if (t.removeAllListeners) t.removeAllListeners();
  if (t.hover && typeof t.hover.clear === 'function') t.hover.clear();
  try{ gsap.killTweensOf(t); gsap.killTweensOf(t.scale); gsap.killTweensOf(t.rotG);}catch{}
  // 🔥 MEMORY LEAK FIX: Cleanup all tile animations and intervals
  try { stopWildIdle?.(t); } catch {}
  try { stopWildShimmer?.(t); } catch {}
  try { stopWildStars?.(t); } catch {}
  try { stopWildBeerBubbles?.(t); } catch {}
  try { stopMagnetIdleParticles?.(t); } catch {}
  board.removeChild(t);
  if (idx !== -1) {
    tiles.splice(idx, 1);
  }
  try { delete (t as any)._skipIdleScaleReset; } catch {}
  t.destroy?.({children:true, texture:false, textureSource:false});
}

// 🔥 COMBINED MERGE ANIMATION: Impact bump + single strong bounce
function playMergeImpactAndAbsorbAnimation(targetTile: any): void {
  if (!targetTile) return;

  // Ensure anchor/pivot is centered for proper scaling from center
  if (targetTile.anchor) {
    targetTile.anchor.set(0.5, 0.5);
  }

  // Create combined timeline: impact bump + strong bounce, all returning to exactly (1,1)
  const tl = gsap.timeline({
    onComplete: () => {
      // Hard-reset to exactly (1, 1) to avoid floating-point drift
      if (targetTile.scale) {
        targetTile.scale.set(1, 1);
      }
    }
  });

  // Step 1: Immediate impact bump (1 → 1.02)
  tl.to(targetTile.scale, {
    x: 1.02,
    y: 1.02,
    duration: 0.08,
    ease: 'power2.out'
  });

  // Step 2: Strong bounce from current scale (1.02 → 1.16 → back to 1.0) - 30% longer
  tl.to(targetTile.scale, {
    x: 1.16,        // Strong overshoot from current 1.02
    y: 1.16,
    duration: 0.078, // Bounce up - 30% longer (was 0.06)
    ease: 'power2.out'
  }).to(targetTile.scale, {
    x: 1.0,         // Back to exactly 1.0
    y: 1.0,
    duration: 0.117, // Smooth return - 30% longer (was 0.09)
    ease: 'back.out(1.8)' // Juicy clean bounce, no extra wobble
  }, '+=0'); // No delay between bounce phases

  console.log('🍬 Playing combined merge impact + absorb animation on tile');
}

async function showFinalScreen(){
  // 🔥 CRITICAL: Guard against multiple simultaneous calls
  if (busyEnding) {
    console.warn('⚠️ showFinalScreen: busyEnding is true, skipping duplicate call');
    return;
  }
  
  busyEnding = true;
  
  // 🔥 CRITICAL: Perform memory cleanup on game over (MEMORY LEAK FIX)
  console.log('🧹 Performing memory cleanup on game over...');
  try {
    memoryManager.performCleanup();
    console.log('✅ Memory cleanup completed');
  } catch (error) {
    console.warn('⚠️ Memory cleanup failed:', error);
  }
  
  // Haptic feedback for game over
  if (typeof (window as any).triggerHapticNotification === 'function') {
    (window as any).triggerHapticNotification('error');
  }
  
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
  
  busyEnding = false;
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
  
  // Rebuild board
  console.log('🔄 RESTART: About to call rebuildBoard()...');
  rebuildBoard();
  console.log('✅ RESTART: rebuildBoard() completed');
  
  // CRITICAL: Call layout to restart idle bounce and position everything
  console.log('🔄 RESTART: Calling layout() to restart idle bounce...');
  layout();
  console.log('✅ RESTART: layout() completed');
  
  // Reinitialize background layer if it was lost
  if (!backgroundLayer) {
    console.log('🔄 RESTART: Reinitializing background layer...');
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
  
  // 🔥 MEMORY LEAK FIX: Kill all pending delayed calls and timeouts
  try {
    console.log('🔄 RESTART: Killing all pending delayed calls and timeouts...');
    // Kill all gsap.delayedCall from fx.js
    if (typeof (window as any).killAllDelayedCalls === 'function') {
      (window as any).killAllDelayedCalls();
    }
    // Destroy all Graphics objects from fx.js
    if (typeof (window as any).destroyAllGraphicsObjects === 'function') {
      (window as any).destroyAllGraphicsObjects();
    }
    // Kill all setTimeout/setInterval from modals
    if ((window as any)._activeTimeouts) {
      (window as any)._activeTimeouts.forEach((timeout: NodeJS.Timeout) => clearTimeout(timeout));
      (window as any)._activeTimeouts.clear();
    }
    if ((window as any)._activeIntervals) {
      (window as any)._activeIntervals.forEach((interval: NodeJS.Timeout) => clearInterval(interval));
      (window as any)._activeIntervals.clear();
    }
    console.log('✅ RESTART: All pending delayed calls and timeouts killed');
  } catch (e) {
    console.warn('⚠️ RESTART: Error killing delayed calls:', e);
  }
  
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
  
  // 🔥 MEMORY LEAK FIX: Cleanup all global delayed calls and graphics objects
  try {
    killAllDelayedCalls?.();
    destroyAllGraphicsObjects?.();
    console.log('✅ Global delayed calls and graphics objects cleaned up');
  } catch (e) {
    console.log('⚠️ Global cleanup error:', e);
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
      // 🔥 MEMORY LEAK FIX: Cleanup all tile animations and intervals before destroy
      try { stopWildIdle?.(t); } catch {}
      try { stopWildShimmer?.(t); } catch {}
      try { stopMagnetIdleParticles?.(t); } catch {}
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

// Debounced save timer to prevent saving mid-animation
let saveGameTimer = null;

function debouncedSaveGameState(delayMs = 800) {
  // Cancel any pending save
  if (saveGameTimer) {
    clearTimeout(saveGameTimer);
  }
  
  // Schedule new save
  saveGameTimer = setTimeout(() => {
    saveGameTimer = null;
    saveGameState();
  }, delayMs);
  
  console.log(`💾 Debounced save scheduled in ${delayMs}ms`);
}

function saveGameState() {
  try {
    syncSharedState();
    
    // DEBUG: Log current state
    console.log('💾 saveGameState called:', {
      boardNumber,
      _userMadeMove: window._userMadeMove,
      _gameHasEnded: window._gameHasEnded,
      score,
      tilesCount: tiles.length,
      activeTilesCount: tiles.filter(t => t && !t.locked && (t.value|0) > 0).length
    });
    
    // CRITICAL FIX: Don't save game state if game has ended
    if (window._gameHasEnded) {
      console.log('💾 Game has ended, skipping save');
      return;
    }

    // CRITICAL FIX: Save logic based on board number
    // Board 1: Only save if user made at least 1 move
    // Board 2+: ALWAYS save (user already progressed past Board 1, even if no moves on current board)
    if (boardNumber === 1 && !window._userMadeMove) {
      console.log('💾 Board 1 and user has not made any moves yet, skipping save');
      return;
    }
    
    // Board 2+: Always save (reaching Board 2+ means user completed Board 1)
    if (boardNumber >= 2) {
      console.log('💾 Board', boardNumber, '- forcing save (user completed at least Board 1)');
      // Continue with save regardless of _userMadeMove status
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

    const tilesToRestore: Array<{ snapshot: any; gridX: number; gridY: number }> = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const snapshot = savedGrid[r]?.[c];
        if (!snapshot) {
          grid[r][c] = null;
          continue;
        }
        const savedGridX = Number.isFinite(snapshot.gridX) ? (snapshot.gridX | 0) : c;
        const savedGridY = Number.isFinite(snapshot.gridY) ? (snapshot.gridY | 0) : r;
        tilesToRestore.push({ snapshot, gridX: savedGridX, gridY: savedGridY });
      }
    }

    for (const { snapshot, gridX: savedGridX, gridY: savedGridY } of tilesToRestore) {
      const value = Number.isFinite(snapshot.value) ? (snapshot.value | 0) : 0;
      const openFlag = typeof snapshot.open === 'boolean' ? snapshot.open : !snapshot.locked;
      const shouldLock = !openFlag;

      const tile = makeBoard.createTile({ board, grid, tiles, c: savedGridX, r: savedGridY, val: value, locked: shouldLock });
      tile.gridX = savedGridX;
      tile.gridY = savedGridY;

      if (grid[savedGridY]?.[savedGridX] && grid[savedGridY][savedGridX] !== tile) {
        const existingTile = grid[savedGridY][savedGridX];
        const existingIndex = tiles.indexOf(existingTile);
        if (existingIndex >= 0) tiles.splice(existingIndex, 1);
        if (existingTile?.parent) existingTile.parent.removeChild(existingTile);
        existingTile?.destroy?.({ children: true });
      }
      grid[savedGridY] = grid[savedGridY] || [];
      grid[savedGridY][savedGridX] = tile;

      if (!shouldLock && value > 0) {
        tile._spawned = true;
      }
      tile.scale.set(1);

      tile.value = value;
      const savedSpecial = snapshot?.special || null;
      const isWildSnapshot = savedSpecial === 'wild' || savedSpecial === 'wild-magnet' || savedSpecial === 'wild-beer' || snapshot?.isWild || snapshot?.isWildFace;
      // 🔥 CRITICAL: Set special BEFORE setValue to ensure correct texture is applied
      tile.special = savedSpecial;
      tile.isWild = !!isWildSnapshot;
      tile.isWildFace = !!(snapshot?.isWildFace || isWildSnapshot);
      tile.visible = typeof snapshot.visible === 'boolean' ? snapshot.visible : true;

      tile.locked = shouldLock;
      // Now setValue will check special FIRST and apply correct wild texture
      makeBoard.setValue(tile, value, 0);

      if (shouldLock) {
        tile.eventMode = 'none';
        tile.cursor = 'default';
        tile.alpha = snapshot && Number.isFinite(snapshot.alpha) ? snapshot.alpha : (value > 0 ? 1 : 0.25);
        if (tile.occluder) tile.occluder.visible = snapshot && typeof snapshot.occluderVisible === 'boolean' ? snapshot.occluderVisible : true;
      } else {
        tile.eventMode = 'static';
        tile.cursor = 'pointer';
        if (drag?.bindToTile) drag.bindToTile(tile);
        tile.alpha = snapshot && Number.isFinite(snapshot.alpha) ? snapshot.alpha : (value > 0 ? 1 : 0);
        if (tile.occluder) tile.occluder.visible = snapshot && typeof snapshot.occluderVisible === 'boolean' ? snapshot.occluderVisible : false;
        if (tile.ghostFrame) tile.ghostFrame._suspended = false;
      }

      if (snapshot && Number.isFinite(snapshot.alpha)) {
        tile.alpha = snapshot.alpha;
      }

      if (tile.ghostFrame) {
        tile.ghostFrame.alpha = tile.ghostFrame._ghostAlpha ?? 0.28;
      }

      if (isWildSnapshot) {
        applyWildSkinLocal(tile);
        try { startWildShimmer(tile); } catch {}
        if (tile.special === 'wild-magnet') {
          try { startMagnetIdleParticles(tile); } catch {}
        }
        if (tile.special === 'wild-beer') {
          wildBeerSpawned = true;
          try {
            if (typeof startWildBeerBubbles === 'function') {
              startWildBeerBubbles(tile);
            }
          } catch (error) {
            console.warn('⚠️ Failed to start wild-beer bubbles on load:', error);
          }
        }
      } else {
        try { stopWildShimmer(tile); } catch {}
        try { stopMagnetIdleParticles(tile); } catch {}
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
    
    // CRITICAL: Set _userMadeMove flag to true after loading saved game
    // This ensures that any future moves after Continue will trigger save
    window._userMadeMove = true;
    console.log('✅ Set _userMadeMove = true after loading saved game state');
    
    // Update ghost visibility after loading game state
    if (typeof window.updateGhostVisibility === 'function') {
      window.updateGhostVisibility();
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
    }
    
    // Ensure background layer is visible from the start
    if (backgroundLayer) {
      backgroundLayer.visible = true;
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

// CRITICAL: Expose function to sync score from app-boot.ts
// This ensures STATE.score and local score variable stay in sync
(window as any).syncScoreToCore = (newScore: number) => {
  score = newScore;
  STATE.score = newScore;
  console.log('🔄 Synced score to core:', newScore);
};

export { app, stage, board, hud, tiles, grid, score, level }; 
