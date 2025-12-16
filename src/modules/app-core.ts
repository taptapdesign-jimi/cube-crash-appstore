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
import { glassCrackAtTile, woodShardsAtTile, spawnMerge6Shards, regularMerge6Shards, innerFlashAtTile, showMultiplierTile, smokeBubblesAtTile, screenShake, wildImpactEffect, startWildIdle, stopWildIdle, startWildShimmer, stopWildShimmer, startWildStars, stopWildStars, startWildBeerBubbles, stopWildBeerBubbles, startMagnetIdleParticles, stopMagnetIdleParticles, centerInBoard, killAllDelayedCalls, destroyAllGraphicsObjects, createWildBeerBubblesExplosion, isWildBeerExplosionRunning, cleanupWildBeerExplosion, waitForBubblesAnimationToComplete } from './fx.js';
import * as StarsCollector from './stars-collector.ts';
// 🔥 REMOVED: showStarsModal import - DEPRECATED, no longer used
// import { showStarsModal } from './stars-modal.js';
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
import { checkEndGame, needsEmergencyRescue, clearEndGameCache, tileIsActive, getActiveTiles, type EndGameContext } from './endgame-checker.ts';
import memoryManager from './memory-manager.ts';
import { boardSpecificRules, isWildSpawnEnabled, isWildMeterEnabled, filterWildType, getWildMeterFillRate } from './board-specific-rules.ts';

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

// 🔥 MEMORY LEAK FIX: Track all timeouts for cleanup (optimization)
const _appTimeouts: Set<NodeJS.Timeout> = new Set();

function trackAppTimeout(callback: () => void, delay: number): NodeJS.Timeout {
  const timeout = setTimeout(() => {
    callback();
    _appTimeouts.delete(timeout);
  }, delay);
  _appTimeouts.add(timeout);
  return timeout;
}

function clearAllAppTimeouts() {
  console.log(`🧹 Clearing ${_appTimeouts.size} pending timeouts from app-core`);
  _appTimeouts.forEach(timeout => clearTimeout(timeout));
  _appTimeouts.clear();
}
// 🔥 CRITICAL: Increased from 500ms to 1200ms to allow all animations to complete
// - Wild spawn bounce: ~580ms
// - Magnet pull + respawn: ~1000ms
// - Regular merge animations: ~600-800ms
// This prevents premature endgame checks while animations are still running
const CHECK_LEVEL_END_DELAY_MS = 500; // 🔥 REDUCED: From 1200ms to 500ms for faster fail screen detection
function killComboTimer(){
  try { 
    comboIdleTimer?.kill?.(); 
    comboIdleTimer = null;
    console.log('🔥 Combo timer killed');
  } catch (e) {
    console.warn('⚠️ Failed to kill combo timer:', e);
  }
}

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
const MAX_CHECK_LEVEL_END_SKIP_MS = 3000; // Hard stop for skip gates to avoid perma-deferral

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
let checkLevelEndSkipStartedAt: number | null = null; // Track skip window to force fall-through

// 🔥 REFACTORED: Koristimo tileIsActive iz endgame-checker.ts za konzistentnost
// Uklonjeno tileIsVisuallyActive() - sada koristimo tileIsActive() iz endgame-checker.ts

function getReactiveActiveTiles(): any[] {
  return tiles.filter(tileIsActive);
}

// 🔥 REMOVED: isBoardCleanReactive() - use checkEndGame() from endgame-checker.ts instead
// This function was a duplicate of isBoardCleanCheck() and could cause conflicts

async function triggerCleanBoardFlow(reason: string): Promise<void> {
  console.log('🚨🚨🚨 triggerCleanBoardFlow invoked:', reason);

  // 🔥 USER BUG FIX: Don't trigger clean board flow if game is hidden (user is on homepage/other screens)
  // This prevents clean board modal from appearing when user navigates away from game
  const appElement = document.getElementById('app');
  if (appElement && appElement.hasAttribute('hidden')) {
    console.log('⏳ triggerCleanBoardFlow skipped - app is hidden (user on homepage/other screens)');
    return;
  }
  
  // Also check if homepage is visible (game should not be active)
  const homeElement = document.getElementById('home');
  if (homeElement && !homeElement.hidden) {
    console.log('⏳ triggerCleanBoardFlow skipped - homepage is visible (game not active)');
    return;
  }

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
  firstWildSpawned = false; // 🔥 USER REQUEST: Reset first wild spawn tracking

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
    // 🔥 USER REQUEST: 1.5 seconds delay before showing clean board overlay
    // This gives player time to see the board and all calculations to complete
    console.log('⏳ Waiting 1.5 seconds before showing clean board overlay...');
    try { await new Promise((res) => setTimeout(res, 1500)); } catch {}
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
  
  // 🎯 BOARD-SPECIFIC RULES: Check if wild spawn is enabled for current board
  if (!isWildSpawnEnabled(boardNumber)) {
    console.log(`🎯 Board ${boardNumber}: Wild spawn disabled - skipping queueWildSpawnIfNeeded`);
    return;
  }
  
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
  console.log('🔥🔥🔥 addWildProgress CALLED! Amount:', amount, 'Current wildMeter:', wildMeter, 'Board:', boardNumber);
  
  // 🎯 BOARD-SPECIFIC RULES: Check if wild meter is enabled for current board
  if (!isWildMeterEnabled(boardNumber)) {
    console.log(`🎯 Board ${boardNumber}: Wild meter disabled - skipping addWildProgress`);
    return;
  }
  
  // 🔥 CRITICAL FIX: Check if this is last merge (only 2 tiles on board) BEFORE adding wild progress
  // This is a safety check to prevent wild meter from filling when last merge happens
  // The flag should be set in merge logic, but this provides double protection
  const hasLastMergeTile = STATE.tiles.some((t: any) => t && !t.destroyed && t.value === 6 && (t as any)?._isLastMerge === true);
  if (hasLastMergeTile) {
    console.log('🚨🚨🚨 LAST MERGE DETECTED (in addWildProgress) - skipping wild progress to prevent wild spawn before clean board');
    console.log('🚨🚨🚨 Wild meter will NOT be filled, preventing wild spawn on last merge');
    // Reset wild meter to ensure it's empty
    wildMeter = 0;
    STATE.wildMeter = 0;
    try {
      if (typeof HUD.resetWildMeter === 'function') {
        HUD.resetWildMeter(true);
        console.log('✅ LAST MERGE (addWildProgress): Wild meter reset in HUD');
      }
    } catch (error) {
      console.warn('⚠️ LAST MERGE (addWildProgress): Failed to reset wild meter in HUD:', error);
    }
    return;
  }
  
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

  // 🎯 BOARD-SPECIFIC RULES: Apply wild meter fill rate multiplier
  const fillRate = getWildMeterFillRate(boardNumber);
  // 🔥 USER REQUEST: Reduce wild meter fill rate by 20% for all boards (80% of original = 20% slower)
  const globalSlowdown = 0.8; // 20% slower = 80% of original speed (was 0.6 = 40% slower)
  const adjustedInc = inc * fillRate * globalSlowdown;
  console.log(`🎯 Board ${boardNumber}: Wild meter fill rate: ${fillRate}x, global slowdown: ${globalSlowdown}x, adjusted increment: ${adjustedInc} (from ${inc})`);

  const target = wildMeter + adjustedInc;
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
  
  // 🔥 CRITICAL FIX: DESTROY existing app if it exists
  if (app && app.canvas) {
    console.log('🧹 Destroying existing PIXI app');
    // 🔥 CRITICAL: Hide canvas IMMEDIATELY before destroy to prevent flash
    app.canvas.style.opacity = '0';
    app.canvas.style.visibility = 'hidden';
    try {
      app.destroy(true, { children: true, texture: true, baseTexture: true });
    } catch (e) {
      console.log('⚠️ Error destroying app:', e);
    }
    app = null;
  }
  
  // 🔥 CRITICAL FIX: Clear global HUD_ROOT reference before creating new app
  // This prevents stale HUD from flashing during reinit
  try {
    if ((window as any).HUD_ROOT) {
      const oldHud = (window as any).HUD_ROOT;
      oldHud.alpha = 0;
      oldHud.visible = false;
      (window as any).HUD_ROOT = null;
      console.log('✅ Cleared stale HUD_ROOT reference');
    }
  } catch (e) {
    console.log('⚠️ Error clearing HUD_ROOT:', e);
  }
  
  // 🔥 CRITICAL FIX: Clear ALL existing canvas elements from DOM
  // This prevents leftover canvas elements from showing when starting new game
  const host = document.getElementById('app') || document.body;
  try {
    // Remove all canvas elements from app container
    const existingCanvases = host.querySelectorAll('canvas');
    existingCanvases.forEach(canvas => {
      try {
        canvas.remove();
        console.log('✅ Removed existing canvas from DOM');
      } catch (e) {
        console.warn('⚠️ Failed to remove canvas:', e);
      }
    });
    
    // Also check body for any stray canvas elements
    const bodyCanvases = document.body.querySelectorAll('canvas');
    bodyCanvases.forEach(canvas => {
      // Only remove if it's part of app container
      if (canvas.parentElement === host || canvas.parentElement === document.body) {
        try {
          canvas.remove();
          console.log('✅ Removed stray canvas from body');
        } catch (e) {
          console.warn('⚠️ Failed to remove stray canvas:', e);
        }
      }
    });
  } catch (e) {
    console.warn('⚠️ Error removing existing canvas elements:', e);
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
  
  // 🔥 CRITICAL FIX: Ensure app is rendering
  console.log('✅ PIXI app initialized');
  console.log('✅ App renderer width:', app.renderer.width, 'height:', app.renderer.height);
  console.log('✅ App canvas width:', app.canvas.width, 'height:', app.canvas.height);
  console.log('✅ App canvas in DOM:', !!app.canvas.parentElement);
  
  // Add fade in animation for background transition
  // 🔥 CRITICAL FIX: Only auto-show canvas if NOT coming from Journey (saved game)
  // When coming from Journey, canvas stays hidden until HUD drop starts
  app.canvas.style.opacity = '0';
  app.canvas.style.transition = 'opacity 0.6s ease';
  const cameFromJourney = (window as any).__ccCameFromJourney;
  if (!cameFromJourney) {
    setTimeout(() => {
      app.canvas.style.opacity = '1';
    }, 50);
  } else {
    console.log('🎯 Canvas kept hidden - will show when HUD drop starts');
  }
  
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
  // 🔥 CRITICAL FIX: Ensure host element exists and is visible before adding canvas
  if (!host) {
    console.error('❌ Host element not found! Cannot add canvas to DOM');
    return;
  }
  
  // Ensure host element is visible
  if (host instanceof HTMLElement) {
    host.style.display = 'block';
    host.style.visibility = 'visible';
    host.style.opacity = '1';
    console.log('✅ Host element made visible before adding canvas');
  }
  
  host.appendChild(app.canvas);
  app.canvas.style.touchAction = 'none';
  app.canvas.style.zIndex = '10'; /* Above background, below sliders */
  
  // 🔥 CRITICAL FIX: Ensure canvas is visible and properly styled
  app.canvas.style.display = 'block';
  app.canvas.style.visibility = 'visible';
  app.canvas.style.opacity = '1';
  app.canvas.style.width = '100%';
  app.canvas.style.height = '100%';
  app.canvas.style.position = 'absolute';
  app.canvas.style.top = '0';
  app.canvas.style.left = '0';
  app.canvas.style.pointerEvents = 'auto';
  console.log('✅ Canvas added to DOM and styled');
  console.log('✅ Canvas in DOM:', !!app.canvas.parentElement);
  console.log('✅ Canvas visible:', app.canvas.style.visibility, 'display:', app.canvas.style.display, 'opacity:', app.canvas.style.opacity);
  
  // Optimize canvas for pixel-perfect rendering
  app.canvas.style.imageRendering = 'pixelated';
  app.canvas.style.imageRendering = '-webkit-optimize-contrast';
  
  // Basic setup
  stage   = app.stage; stage.sortableChildren = true;
  board   = new Container(); board.sortableChildren = true;
  boardBG = new Graphics();
  hud     = new Container(); hud.eventMode = 'none';

  // 🔥 CRITICAL: Ensure board and hud are visible
  board.visible = true;
  board.alpha = 1;
  board.renderable = true;
  hud.visible = true;
  hud.alpha = 1;
  hud.renderable = true;

  board.zIndex = 100; hud.zIndex = 10000;
  stage.addChild(board, hud);
  board.addChildAt(boardBG, 0); boardBG.zIndex = -1000; board.sortChildren();
  
  console.log('✅ Board and HUD containers created and added to stage');
  console.log('✅ Board visible:', board.visible, 'alpha:', board.alpha, 'renderable:', board.renderable, 'in stage:', !!board.parent);
  console.log('✅ HUD visible:', hud.visible, 'alpha:', hud.alpha, 'renderable:', hud.renderable, 'in stage:', !!hud.parent);
  console.log('✅ Stage children count:', stage.children.length);
  console.log('✅ Stage visible:', stage.visible, 'renderable:', stage.renderable);
  
  // 🔥 CRITICAL FIX: Force render to ensure everything is visible
  try {
    app.renderer.render(stage);
    console.log('✅ Initial render completed');
  } catch (e) {
    console.warn('⚠️ Failed to perform initial render:', e);
  }
  
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
          // 🔥 PERFORMANCE: Removed console.log to prevent lag during drag (called hundreds of times)
          // console.log('🔥 canDrop (app-core): Wild merge check (wild->normal):', { wildValue: sv, targetValue: dv, canMerge });
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
      
      // 🔥 CRITICAL: Only allow merge if BOTH tiles are wild-magnet affected (pulled tiles merging together)
      // If only one is affected, block the merge (protected tile cannot merge with other tiles)
      if (srcIsWildMagnetAffected && dstIsWildMagnetAffected) {
        console.log('🧲 canDrop (app-core): Both tiles are wild-magnet affected (pulled tiles) - can merge');
        return true;
      }
      
      // 🔥 CRITICAL: Block merge if only one tile is wild-magnet affected (protected tile)
      if (srcIsWildMagnetAffected || dstIsWildMagnetAffected) {
        console.log('🛡️ canDrop (app-core): One tile is wild-magnet affected (protected) - blocking merge with other tiles');
        return false;
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
    // 🔥 CRITICAL FIX: Ensure board and hud are visible before starting level
    if (board) {
      board.visible = true;
      board.alpha = 1;
      board.renderable = true;
      console.log('✅ Board made visible in boot() before startLevel');
    }
    if (hud) {
      hud.visible = true;
      hud.alpha = 1;
      hud.renderable = true;
      console.log('✅ HUD made visible in boot() before startLevel');
    }
    startLevel(1);
  }
  
  // 🔥 CRITICAL FIX: Final check - ensure board and hud are visible after startLevel
  setTimeout(() => {
    if (board) {
      board.visible = true;
      board.alpha = 1;
      board.renderable = true;
      console.log('✅ Board visibility confirmed after startLevel (delayed check)');
    }
    if (hud) {
      hud.visible = true;
      hud.alpha = 1;
      hud.renderable = true;
      console.log('✅ HUD visibility confirmed after startLevel (delayed check)');
    }
  }, 100);
  
  // Force HUD reinit after board numbering changes
  _hudInitDone = false;
  window.addEventListener('resize', layoutBoard);
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
    getCombo: () => combo, // 🔥 CRITICAL: Export getCombo for magnet pull combo logic
    setCombo: (v) => hudSetCombo(v|0), // 🔥 CRITICAL: Export setCombo for magnet pull combo logic
    scheduleComboDecay: () => scheduleComboDecay(), // 🔥 CRITICAL: Export scheduleComboDecay for magnet pull combo logic
    killComboTimer: () => killComboTimer(), // 🔥 CRITICAL: Export killComboTimer to kill existing timer before updating combo
    addStars: (count) => StarsCollector.addStars(count|0), // 🔥 CRITICAL: Export addStars for synchronous star collection
    setStarsCount: (count) => StarsCollector.setStarsCount(count|0), // 🔥 CRITICAL: Export setStarsCount for resetting star count on restart
  };
  
  // 🔥 MEMORY LEAK FIX: Export cleanup functions for global cleanup
  (window as any).killAllDelayedCalls = killAllDelayedCalls;
  (window as any).destroyAllGraphicsObjects = destroyAllGraphicsObjects;
  window.testCleanAndPrize = () => window.CC.testCleanAndPrize();

  // Run layout after viewport/meta/styles are in place to get correct safe-area values
  try {
    requestAnimationFrame(() => layoutBoard());
  } catch {
    layoutBoard();
  }

  syncSharedState();
}

// -------------------- layout + HUD --------------------
// 🔥 REFACTORED: Preimenovano za jasnoću - ovo je board layout, ne HUD layout
export function layoutBoard(){
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
  
  let availableWidth, s, sw, sh, boardX, boardY, widthScale;
  
  if (isIPad) {
    // iPad: full width with 40px edge-to-edge board
    availableWidth = vw - (IPAD_BOARD_PADDING * 2);
    widthScale = availableWidth / w;
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
    widthScale = availableWidth / w;
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
        
        // 🔥 CRITICAL FIX: If HUD was initialized with initialHide=false, ensure it's visible
        // This handles the case where _hudDropPending is false but HUD still needs to be visible
        // HUD_ROOT is not directly accessible, we need to get it from HUD module or window
        try {
          const hudRoot = (window as any).HUD_ROOT || (HUD as any).HUD_ROOT || null;
          if (!_hudDropPending && hudRoot) {
            const top = hudRoot._dropTop ?? safeTop;
            hudRoot.y = top;
            hudRoot.alpha = 1;
            hudRoot.visible = true;
            hudRoot._dropped = true;
            console.log('✅ HUD made visible immediately (no drop pending)');
          }
        } catch (e) {
          console.warn('⚠️ Failed to access HUD_ROOT:', e);
        }
        
        // 🔥 CRITICAL: Fallback to trigger HUD drop shortly after init (for slow devices)
        if (_hudDropPending) {
          setTimeout(() => {
            if (!_hudDropPending) return; // already handled by sweetPopIn
            try {
              const hudRoot = (window as any).HUD_ROOT || (HUD as any).HUD_ROOT || null;
              if (!hudRoot || !hudRoot.parent) {
                console.warn('⚠️ HUD drop fallback: HUD_ROOT not ready');
                return;
              }
              if (!hudRoot._dropped && typeof HUD.playHudDrop === 'function') {
                // Start on next paint so user definitely sees the drop (especially iPhone)
                requestAnimationFrame(() => requestAnimationFrame(() => {
                  // 🔥 CRITICAL: Show canvas now that HUD is ready to drop
                  if (app && app.canvas) {
                    app.canvas.style.opacity = '1';
                    app.canvas.style.transition = 'opacity 0.3s ease';
                  }
                  HUD.playHudDrop({ forceRestart: true });
                }));
                console.log('✅ HUD drop fallback triggered after initHUD');
              }
              _hudDropPending = false;
            } catch (err) {
              console.warn('⚠️ HUD drop fallback failed:', err);
            }
          }, 120);
        }
        
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
        
        // 🔥 Initialize stars collector
        try {
          StarsCollector.initStarsCollector({
            app,
            stage, // 🔥 CRITICAL: Add stage for screen coordinate animations
            board,
            hud,
            getStarHudPosition: () => {
              if (typeof HUD.getStarHudPosition === 'function') {
                return HUD.getStarHudPosition();
              }
              return null;
            },
            onStarsUpdated: (count) => {
              // Update HUD star count display
              if (typeof HUD.setStarsCount === 'function') {
                HUD.setStarsCount(count);
              }
            }
          });
          console.log('✅ Stars collector initialized');
        } catch (error) {
          console.warn('⚠️ Failed to initialize stars collector:', error);
        }
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
    const paddingPercent = isIPad ? (IPAD_BOARD_PADDING / vw) : (HUD_PADDING / vw);
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
  
  // 🔥 CRITICAL FIX: Remove existing background layer if it exists
  if (backgroundLayer) {
    try {
      if (board && board.children.includes(backgroundLayer)) {
        board.removeChild(backgroundLayer);
        console.log('✅ Removed existing background layer from board');
      }
      backgroundLayer.destroy({ children: true });
      console.log('✅ Destroyed existing background layer');
    } catch (e) {
      console.warn('⚠️ Error removing existing background layer:', e);
    }
    backgroundLayer = null; // Clear reference
  }
  
  // 🔥 CRITICAL FIX: Ensure board exists before creating background layer
  if (!board) {
    console.error('❌ initializeBackgroundLayer: board is null, cannot create background layer');
    return;
  }
  
  // Create a new dedicated container for background elements
  backgroundLayer = new Container();
  backgroundLayer.zIndex = -10000; // Always at the very bottom
  backgroundLayer.eventMode = 'none'; // Non-interactive
  backgroundLayer.label = 'BackgroundLayer'; // For debugging
  backgroundLayer.visible = true; // 🔥 CRITICAL: Ensure it's visible
  
  // Add to board at index 0 (bottom)
  try {
    board.addChildAt(backgroundLayer, 0);
    console.log('✅ Background layer added to board at index 0');
  } catch (e) {
    console.error('❌ Failed to add background layer to board:', e);
    backgroundLayer = null;
    return;
  }
  
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
      ghost.visible = true; // 🔥 v70 STYLE: Always visible - shown for empty cells
      backgroundLayer.addChild(ghost);
      window._ghostPlaceholders[r][c] = ghost; // Store reference
    }
  }
  
  board.sortChildren();
  
  console.log('✅ FIXED background layer created with', ROWS * COLS, 'ghost placeholders');
  console.log('✅ This layer will NEVER be modified or destroyed');
  console.log('🔍 Background layer zIndex:', backgroundLayer.zIndex);
  console.log('🔍 Background layer visible:', backgroundLayer.visible);
  console.log('🔍 Background layer in board:', board.children.includes(backgroundLayer));
  
  // 🔥 v70 STYLE: Update ghost visibility immediately after creation
  // Show ghosts for empty cells (where grid[r][c] === null)
  try {
    if (typeof window.updateGhostVisibility === 'function') {
      window.updateGhostVisibility();
    } else {
      // Fallback: Show all ghosts initially (will be hidden by updateGhostVisibility later)
      updateGhostVisibility();
    }
    console.log('✅ Ghost visibility updated after background layer creation');
  } catch (e) {
    console.error('❌ Failed to update ghost visibility:', e);
  }
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

// 🔥 v70 STYLE: Draw ghost placeholders for empty cells
function drawBoardBG(mode = 'active+empty'){
  if (!backgroundLayer) {
    initializeBackgroundLayer();
  }
  
  // 🔥 v70 STYLE: Update ghost visibility based on grid state
  // Show ghosts for empty cells (where grid[r][c] === null)
  if (typeof window.updateGhostVisibility === 'function') {
    window.updateGhostVisibility();
  } else {
    updateGhostVisibility();
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
  // 🔥 CRITICAL FIX: Get actual combo value from window.CC.getCombo() instead of local combo variable
  // This ensures combo value is always in sync, especially after magnet pull updates combo via window.CC.setCombo()
  const actualCombo = typeof (window as any).CC?.getCombo === 'function'
    ? (window as any).CC.getCombo()
    : combo; // Fallback to local combo if window.CC.getCombo not available
  
  // Sync local combo variable with actual combo value
  combo = actualCombo;
  
  console.log('🎯 updateHUD called with:', { score, board: boardNumber, moves, combo: actualCombo });
  syncSharedState();
  
  try {
    // First try to use HUD from hud-helpers.js
    if (typeof HUD.updateHUD === 'function') { 
      console.log('🎯 Calling HUD.updateHUD from hud-helpers.js');
      HUD.updateHUD({ score, board: boardNumber, moves, combo: actualCombo }); 
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
      _updateHUD({ score, board: boardNumber, moves, combo: actualCombo }); 
      return; 
    }
  } catch (error) {
    console.error('❌ Error calling _updateHUD:', error);
  }
  
  // Legacy fallback
  console.log('🎯 Using legacy fallback for HUD update');
  if (boardNumText) boardNumText.text = `#${boardNumber}`;
  if (scoreNumText) scoreNumText.text = String(score);
  if (comboNumText) comboNumText.text = `x${actualCombo}`;
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
  
  // 🔥 CRITICAL FIX: Get backgroundLayer reference BEFORE removing children
  // Also check the global backgroundLayer variable
  const bgLayer = board.children.find(c => c.label === 'BackgroundLayer');
  const bgLayerRef = backgroundLayer; // Keep reference to global variable
  console.log('🔄 resetBoardContainer (app.js): Found backgroundLayer in board:', !!bgLayer);
  console.log('🔄 resetBoardContainer (app.js): Global backgroundLayer exists:', !!bgLayerRef);
  
  board.removeChildren();
  
  // Re-add persistent layers
  board.addChildAt(boardBG, 0);
  
  // 🔥 CRITICAL FIX: Re-add backgroundLayer if it exists (either from board or global reference)
  const layerToAdd = bgLayer || bgLayerRef;
  if (layerToAdd) {
    try {
      board.addChildAt(layerToAdd, 0); // Always at index 0 (bottom)
      layerToAdd.visible = true;
      layerToAdd.zIndex = -10000;
      console.log('✅ resetBoardContainer (app.js): Background layer preserved and re-added');
    } catch (e) {
      console.warn('⚠️ resetBoardContainer (app.js): Failed to re-add background layer:', e);
      // If re-adding fails, ensure global reference is cleared so it gets recreated
      if (bgLayerRef === backgroundLayer) {
        backgroundLayer = null;
      }
    }
  } else {
    console.warn('⚠️ resetBoardContainer (app.js): Background layer NOT found - will need reinit');
    // Ensure global reference is null so it gets recreated
    backgroundLayer = null;
  }
  
  boardBG.zIndex = -1000;
  boardBG.eventMode = 'none';
  board.sortableChildren = true;
  board.sortChildren();
  
  console.log('🔄 resetBoardContainer (app.js): Final children count:', board.children.length);
  console.log('🔄 resetBoardContainer (app.js): Background layer in board after reset:', !!board.children.find(c => c.label === 'BackgroundLayer'));
}
function rebuildBoard(){
  // 🔥 CRITICAL: Stop tile idle bounce before rebuild
  try {
    if (TILE_IDLE_BOUNCE && typeof TILE_IDLE_BOUNCE.stop === 'function') {
      TILE_IDLE_BOUNCE.stop();
      console.log('✅ rebuildBoard: Tile idle bounce stopped');
    }
  } catch (e) {
    console.warn('⚠️ rebuildBoard: Error stopping tile idle bounce:', e);
  }
  
  resetBoardContainer();
  
  // 🔥 OPTIMIZATION: Clear all tracked timeouts before rebuild
  clearAllAppTimeouts();
  
  // 🔥 OPTIMIZATION: Kill all GSAP delayed calls before rebuild
  try {
    if (typeof killAllDelayedCalls === 'function') {
      killAllDelayedCalls();
      console.log('🧹 Killed all GSAP delayed calls during board rebuild');
    } else {
      // Fallback: try to kill delayed calls directly
      try { gsap.killDelayedCalls(); } catch {}
    }
  } catch {}
  
  // 🔥 MEMORY LEAK FIX: Cleanup all wild animations and GSAP tweens before destroy
  // This prevents "ghost" animations from continuing after tiles are destroyed
  tiles.forEach(t => {
    // 🔥 CRITICAL: Stop all idle animations first
    try { stopWildIdle?.(t); } catch {}
    try { stopWildShimmer?.(t); } catch {}
    try { stopWildStars?.(t); } catch {}
    try { stopWildBeerBubbles?.(t); } catch {}
    try { stopMagnetIdleParticles?.(t); } catch {}
    
    // 🔥 CRITICAL: Kill any GSAP tweens from idle bounce (but don't reset interaction timer)
    // notifyInteraction() would reset the timer, which could interfere with end game checks
    try {
      // Just kill tweens, don't reset interaction timer
      gsap.killTweensOf(t);
      gsap.killTweensOf(t.scale);
      gsap.killTweensOf(t.rotation);
      
      // Kill idle bounce timeline if it exists on tile
      if ((t as any)._idleBounceTl) {
        try {
          (t as any)._idleBounceTl.kill();
          (t as any)._idleBounceTl = null;
        } catch {}
      }
    } catch {}
    
    // 🔥 OPTIMIZATION: Kill tile animations from animation modules (if available)
    try {
      // Try to import and use killTileAnimations from merge-animations or drag-animations
      // Note: We can't import directly here, so we check if it's available globally
      if (typeof (window as any).killTileAnimations === 'function') {
        (window as any).killTileAnimations(t);
      }
    } catch {}
    
    // 🔥 CRITICAL: Kill all GSAP tweens on tile and its properties
    try { 
      gsap.killTweensOf(t); 
      gsap.killTweensOf(t.scale); 
      gsap.killTweensOf(t.rotG);
      gsap.killTweensOf(t.rotation);
      // Kill any glow animations
      if ((t as any)._glowAnimation) {
        (t as any)._glowAnimation.kill();
        (t as any)._glowAnimation = null;
      }
    } catch {}
    
    t.destroy({children:true, texture:false, textureSource:false});
  });
  tiles.length=0;
  
  // 🔥 CRITICAL: Cleanup wild beer explosion animation when board is rebuilt
  try {
    if (isWildBeerExplosionRunning && cleanupWildBeerExplosion) {
      cleanupWildBeerExplosion();
      console.log('🧹 Cleaned up wild beer explosion animation during board rebuild');
    }
  } catch {}
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
  
  // 🔥 CRITICAL FIX: Ensure background layer exists and is visible
  // If backgroundLayer was destroyed in cleanupGame(), it will be null
  // initializeBackgroundLayer() is called in startLevel() after rebuildBoard()
  // But we need to ensure it's visible here if it exists
  if (backgroundLayer) {
    backgroundLayer.visible = true; // Keep visible - v70 style
    // Ensure it's at the bottom of board children
    try {
      if (board.children.includes(backgroundLayer)) {
        const currentIndex = board.getChildIndex(backgroundLayer);
        if (currentIndex !== 0) {
          board.removeChild(backgroundLayer);
          board.addChildAt(backgroundLayer, 0);
          board.sortChildren();
          console.log('✅ Background layer repositioned to bottom in rebuildBoard()');
        }
      } else {
        // Background layer not in board - add it
        board.addChildAt(backgroundLayer, 0);
        board.sortChildren();
        console.log('✅ Background layer added to board in rebuildBoard()');
      }
    } catch (e) {
      console.warn('⚠️ rebuildBoard: Failed to ensure background layer in board:', e);
    }
    console.log('✅ Ghost placeholders visible (v70 style)');
  } else {
    console.warn('⚠️ rebuildBoard: backgroundLayer is null - will be created in startLevel()');
  }
  
  // 🔥 v70 STYLE: Update ghost visibility before animation starts
  // Only if backgroundLayer exists, otherwise it will be updated after initializeBackgroundLayer()
  if (backgroundLayer) {
    try {
      updateGhostVisibility();
      console.log('✅ Ghost visibility updated in rebuildBoard()');
    } catch (e) {
      console.warn('⚠️ rebuildBoard: Failed to update ghost visibility:', e);
    }
  }
  
  // Start animation (optionally wait a frame if HUD is not ready so drop can be visible)
  const hudReady = (window as any).HUD_ROOT || (HUD as any).HUD_ROOT || null;
  const sweetPopInRunner = () => {
    console.log('🎯 Starting sweetPopIn from app.js with', tiles.length, 'tiles');
    return sweetPopIn(tiles, {
    onHalf: () => {
      // 🔥 CRITICAL FIX: Ensure HUD drop is triggered for new games
      if (_hudDropPending){
        console.log('🎯 HUD drop pending in sweetPopIn onHalf - triggering drop animation');
        try { 
          const hudRoot = (window as any).HUD_ROOT || (HUD as any).HUD_ROOT || null;
          if (!hudRoot) {
            console.warn('⚠️ HUD_ROOT not ready during sweetPopIn onHalf - keeping drop pending');
            return; // keep _hudDropPending so a later fallback can run
          }
          if (typeof HUD.playHudDrop === 'function') {
            // Start on next paint so user definitely sees the drop (especially iPhone)
            requestAnimationFrame(() => requestAnimationFrame(() => {
              // 🔥 CRITICAL: Show canvas now that HUD is ready to drop
              if (app && app.canvas) {
                app.canvas.style.opacity = '1';
                app.canvas.style.transition = 'opacity 0.3s ease';
              }
              HUD.playHudDrop({ forceRestart: true });
            }));
            console.log('✅ HUD drop animation triggered in sweetPopIn onHalf');
            _hudDropPending = false;
          } else {
            console.warn('⚠️ HUD.playHudDrop is not a function');
          }
        } catch (e) {
          console.error('❌ Failed to trigger HUD drop in sweetPopIn onHalf:', e);
        }
      } else {
        // 🔥 CRITICAL FIX: Even if not pending, ensure HUD is visible and positioned
        console.log('🎯 HUD drop not pending - ensuring HUD is visible');
        try {
          // 🔥 CRITICAL FIX: Get HUD_ROOT from HUD module or window
          try {
            const hudRoot = (window as any).HUD_ROOT || (HUD as any).HUD_ROOT || null;
            if (hudRoot) {
              const top = hudRoot._dropTop ?? 44;
              hudRoot.y = top;
              hudRoot.alpha = 1;
              hudRoot.visible = true;
              hudRoot._dropped = true;
              console.log('✅ HUD positioned and made visible in sweetPopIn onHalf');
            }
          } catch (e) {
            console.warn('⚠️ Failed to access HUD_ROOT in sweetPopIn onHalf:', e);
          }
        } catch (e) {
          console.error('❌ Failed to ensure HUD visibility:', e);
        }
      }
    }
    });
  };
  
  const shouldDelayForHUD = _hudDropPending && !hudReady;
  const sweetPopPromise = shouldDelayForHUD
    ? new Promise(resolve => setTimeout(() => resolve(sweetPopInRunner()), 120))
    : sweetPopInRunner();
  
  sweetPopPromise.then(() => {
    // 🔥 v70 STYLE: Update ghost visibility after animation completes
    // Show ghosts for empty cells (where grid[r][c] === null)
    if (backgroundLayer) {
      updateGhostVisibility();
      console.log('✅ Ghost placeholders updated after sweetPopIn (v70 style)');
    }
    
    // 🔥 CRITICAL FIX: Final check - ensure HUD is visible and positioned after animation
    if (_hudDropPending) {
      console.log('🎯 HUD drop still pending after sweetPopIn - triggering now');
      try {
        if (typeof HUD.playHudDrop === 'function') {
          requestAnimationFrame(() => requestAnimationFrame(() => {
            // 🔥 CRITICAL: Show canvas now that HUD is ready to drop
            if (app && app.canvas) {
              app.canvas.style.opacity = '1';
              app.canvas.style.transition = 'opacity 0.3s ease';
            }
            HUD.playHudDrop({ forceRestart: true });
          }));
          console.log('✅ HUD drop animation triggered after sweetPopIn');
        }
      } catch (e) {
        console.error('❌ Failed to trigger HUD drop after sweetPopIn:', e);
      }
      _hudDropPending = false;
    }
    
    // 🔥 CRITICAL FIX: Ensure HUD is visible even if animation didn't trigger
    try {
      const hudRoot = (window as any).HUD_ROOT || (HUD as any).HUD_ROOT || null;
      if (hudRoot) {
        const top = hudRoot._dropTop ?? 44;
        hudRoot.y = top;
        hudRoot.alpha = 1;
        hudRoot.visible = true;
        hudRoot._dropped = true;
        console.log('✅ HUD final position set after sweetPopIn');
      }
    } catch (e) {
      console.error('❌ Failed to ensure HUD visibility after sweetPopIn:', e);
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
  
  // 🔥 CRITICAL FIX: Ensure board and hud are visible BEFORE anything else
  // This fixes the issue where board is hidden after cleanup and not restored
  if (board) {
    board.visible = true;
    board.alpha = 1;
    board.renderable = true;
    // Ensure board is in stage
    if (!board.parent) {
      console.warn('⚠️ Board not in stage, adding it...');
      if (stage) {
        stage.addChild(board);
        console.log('✅ Board added to stage');
      }
    }
    console.log('✅ Board made visible in startLevel - visible:', board.visible, 'alpha:', board.alpha, 'renderable:', board.renderable, 'in stage:', !!board.parent);
  } else {
    console.error('❌ Board is null in startLevel!');
  }
  if (hud) {
    hud.visible = true;
    hud.alpha = 1;
    hud.renderable = true;
    // Ensure hud is in stage
    if (!hud.parent) {
      console.warn('⚠️ HUD not in stage, adding it...');
      if (stage) {
        stage.addChild(hud);
        console.log('✅ HUD added to stage');
      }
    }
    console.log('✅ HUD made visible in startLevel - visible:', hud.visible, 'alpha:', hud.alpha, 'renderable:', hud.renderable, 'in stage:', !!hud.parent);
  } else {
    console.error('❌ HUD is null in startLevel!');
  }
  
  // 🔥 CRITICAL FIX: Cleanup all animations before starting new level
  // This prevents memory leaks and conflicts that could cause crashes
  try {
    // Cleanup bubbles animation
    const fxModule = typeof window !== 'undefined' && (window as any).cleanupWildBeerExplosion;
    if (typeof fxModule === 'function') {
      fxModule();
      console.log('🧹 startLevel: Cleaned up bubbles animation');
    }
    
    // Cleanup confetti animations
    import('./confetti-system.js').then(confettiModule => {
      if (confettiModule && typeof confettiModule.cleanupConfetti === 'function') {
        confettiModule.cleanupConfetti();
        console.log('🧹 startLevel: Cleaned up confetti animations');
      }
    }).catch(() => {
      // Ignore import errors
    });
  } catch (e) {
    console.warn('⚠️ startLevel: Failed to cleanup animations (non-fatal):', e);
  }
  
  // 🎯 BOARD-SPECIFIC RULES: Set current board for board-specific rules
  boardNumber = n | 0;
  boardSpecificRules.setCurrentBoard(boardNumber);
  console.log(`🎯 Board-specific rules: Set to board ${boardNumber}`);
  
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
  
  // 🔥 JOURNEY PROGRESSION: Update currentRunState when starting a level
  try {
    import('./journey-progression-state.js').then(({ journeyProgressionState }) => {
      const currentScore = score || 0;
      journeyProgressionState.setCurrentRunState(n, currentScore);
      console.log(`🗺️ Journey: Current run state set for board ${n} with score ${currentScore}`);
    }).catch((error) => {
      console.warn('⚠️ Failed to update Journey progression state in startLevel:', error);
    });
  } catch (error) {
    console.warn('⚠️ Failed to update Journey progression state in startLevel:', error);
  }
  
  // STATS TRACKING: Update highest board reached
  console.log('🎯 Updating highest board to:', n);
  try {
    statsService.updateHighestBoard(n);
    console.log('✅ Highest board updated successfully');
  } catch (error) {
    console.error('❌ Failed to update highest board:', error);
  }
  
  // 🗺️ JOURNEY PROGRESSION: Unlock journey boards based on boardNumber
  // Unlock all boards up to and including the current boardNumber
  import('./journey-boards-manager.js').then(({ journeyBoardsManager }) => {
    try {
      journeyBoardsManager.syncWithGameProgress(n);
      
      // Update journey badge count (slideIndex 1 = Journey)
      // Show NEWLY unlocked boards count (excluding board 1 and already viewed boards) as badge
      // This ensures badge only shows boards that haven't been viewed yet
      const newlyUnlockedCount = journeyBoardsManager.getNewlyUnlockedCount();
      if (typeof (window as any).updateNavBadge === 'function') {
        (window as any).updateNavBadge(newlyUnlockedCount, 1); // Pass slideIndex 1 for Journey
        console.log(`🗺️ Journey badge updated: ${newlyUnlockedCount} newly unlocked boards (not yet viewed)`);
      }
    } catch (error) {
      console.warn('⚠️ Failed to sync journey boards with game progress:', error);
    }
  }).catch((error) => {
    console.warn('⚠️ Failed to import journey boards manager:', error);
  });
  
  moves = MOVES_MAX;
  // 🔥 CRITICAL: Don't reset busyEnding here - let runEndgameFlow handle it in finally block
  // busyEnding = false; // REMOVED - runEndgameFlow resets it in finally block
  hudResetCombo();
  console.log('🎯 startLevel updated - level:', level, 'boardNumber:', boardNumber, 'score preserved:', score);
  try { comboIdleTimer?.kill?.(); } catch {}
  
wildMeter = 0;
  resetWildProgress(0, false);
  wildBeerSpawned = false; // Reset wild-beer spawn tracking
  wildMagnetSpawned = false; // Reset wild-magnet spawn tracking
  firstWildSpawned = false; // 🔥 USER REQUEST: Reset first wild spawn tracking for new level
  
  // Clear end game cache when starting new level
  clearEndGameCache();
  
  // 🔥 CRITICAL FIX: Skip rebuildBoard if loading saved state
  // This prevents creating an empty board before loadGameState restores tiles
  // 🔥 JOURNEY PROGRESSION: Check if HUD drop should be triggered (from Journey Play Board)
  if ((window as any).__ccTriggerHudDrop) {
    _hudDropPending = true;
    console.log('✅ HUD drop pending set to true (from Journey Play Board)');
    delete (window as any).__ccTriggerHudDrop;
    
    // 🔥 CRITICAL: Force HUD to re-init / re-drop on next layout so animation is always visible
    _hudInitDone = false;
    try {
      const hudRoot = (window as any).HUD_ROOT || (HUD as any).HUD_ROOT || null;
      if (hudRoot) {
        const top = hudRoot._dropTop ?? 44;
        try { gsap.killTweensOf(hudRoot); } catch {}
        hudRoot._dropped = false;
        hudRoot.alpha = 0;
        hudRoot.y = top - 140;
        hudRoot.visible = true;
        console.log('✅ HUD reset to pre-drop state (will animate drop)');
      }
    } catch (e) {
      console.warn('⚠️ Failed to reset HUD for re-drop:', e);
    }
  }
  
  const skipRebuild = (window as any).__ccSkipRebuildBoard;
  if (skipRebuild) {
    console.log('🎯 Skipping rebuildBoard() - will load saved state instead');
    // 🔥 CRITICAL FIX: Don't delete __ccSkipRebuildBoard here - let main.ts handle it after loadGameState()
    // This ensures loadGameState() can be called after bootGame() completes
    // (window as any).__ccSkipRebuildBoard will be deleted in main.ts after loadGameState()
  } else {
    // 🔥 CRITICAL FIX: Ensure background layer exists BEFORE rebuildBoard()
    // rebuildBoard() calls resetBoardContainer() which removes all children
    // If backgroundLayer doesn't exist, it won't be preserved
    if (!backgroundLayer) {
      console.log('🎯 Background layer is null before rebuildBoard() - initializing...');
      initializeBackgroundLayer();
      console.log('✅ Background layer initialized before rebuildBoard()');
    }
    
    // 🔥 CRITICAL FIX: Ensure board is visible before rebuildBoard
    if (board) {
      board.visible = true;
      board.alpha = 1;
      board.renderable = true;
      console.log('✅ Board made visible before rebuildBoard()');
    }
    
    // Start animation immediately - no delay
    rebuildBoard();
    
    // 🔥 CRITICAL FIX: Final check - ensure board is visible after rebuildBoard
    setTimeout(() => {
      if (board) {
        board.visible = true;
        board.alpha = 1;
        board.renderable = true;
        console.log('✅ Board visibility confirmed after rebuildBoard (delayed check)');
      }
    }, 50);
  }
  
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
  layoutBoard();
  
  // 🔥 CRITICAL FIX: Always initialize background layer for new games
  // Even if it was destroyed in cleanupGame(), it needs to be recreated
  // This MUST happen BEFORE rebuildBoard() creates tiles, otherwise tiles won't be visible
  if (!backgroundLayer) {
    console.log('🎯 Background layer is null - initializing...');
    initializeBackgroundLayer();
    console.log('✅ Background layer initialized in startLevel');
  } else {
    // If backgroundLayer exists, ensure it's visible and in board
    const bgInBoard = board.children.find(c => c.label === 'BackgroundLayer');
    if (!bgInBoard) {
      console.log('⚠️ Background layer exists but not in board - reinitializing...');
      try {
        if (board.children.includes(backgroundLayer)) {
          board.removeChild(backgroundLayer);
        }
        backgroundLayer.destroy({ children: true });
      } catch (e) {
        console.warn('⚠️ Error removing existing background layer:', e);
      }
      backgroundLayer = null;
      initializeBackgroundLayer();
      console.log('✅ Background layer reinitialized');
    } else {
      // Ensure background layer is visible
      backgroundLayer.visible = true;
      try {
        updateGhostVisibility();
        console.log('✅ Background layer already exists and is visible');
      } catch (e) {
        console.warn('⚠️ Failed to update ghost visibility:', e);
      }
    }
  }
  
  // 🔥 CRITICAL FIX: Ensure background layer is visible and has correct zIndex
  if (backgroundLayer) {
    backgroundLayer.visible = true;
    backgroundLayer.zIndex = -10000;
    // Ensure it's at the bottom of board children
    try {
      if (board.children.includes(backgroundLayer)) {
        board.removeChild(backgroundLayer);
        board.addChildAt(backgroundLayer, 0);
        board.sortChildren();
        console.log('✅ Background layer repositioned to bottom of board');
      }
    } catch (e) {
      console.warn('⚠️ Failed to reposition background layer:', e);
    }
  }
  
  // 🔥 CRITICAL FIX: Ensure HUD is visible and positioned correctly after startLevel
  // This is especially important for new games after cleanup
  try {
      // 🔥 CRITICAL FIX: Get HUD_ROOT from HUD module or window
      try {
        const hudRoot = (window as any).HUD_ROOT || (HUD as any).HUD_ROOT || null;
        if (hudRoot) {
          // If HUD drop is pending, it will be triggered in sweetPopIn onHalf callback
          // But we should ensure HUD is at least visible
          if (!_hudDropPending) {
            const top = hudRoot._dropTop ?? 44;
            hudRoot.y = top;
            hudRoot.alpha = 1;
            hudRoot.visible = true;
            hudRoot._dropped = true;
            console.log('✅ HUD positioned and made visible in startLevel (no drop pending)');
          } else {
            // If drop is pending, keep HUD hidden offscreen so first frame doesn't flash
            const top = hudRoot._dropTop ?? 44;
            hudRoot.visible = true;
            hudRoot.alpha = 0;
            hudRoot.y = top - 140; // pre-drop position
            hudRoot._dropped = false;
            console.log('✅ HUD kept hidden offscreen (drop pending, will animate in sweetPopIn onHalf)');
          }
        } else {
          console.warn('⚠️ HUD_ROOT is null in startLevel - HUD may not be initialized yet');
        }
      } catch (e) {
        console.warn('⚠️ Failed to access HUD_ROOT in startLevel:', e);
      }
  } catch (e) {
    console.warn('⚠️ Failed to ensure HUD visibility in startLevel:', e);
  }
  
  // Call layout only for initial game start, not for restart
  if (n === 1) {
    layoutBoard();
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
    const hitSize = TILE * 1.10; // 🔥 INCREASED: 10% larger hit box for easier tap (was 1.05)
    const half = hitSize / 2;
    const hitArea = new Rectangle(-half, -half, hitSize, hitSize);
    tile.hitArea = hitArea;
    if (host) host.hitArea = hitArea;
    // 🔥 CRITICAL: Ensure eventMode is set to 'static' for touch events
    tile.eventMode = 'static';
    tile.cursor = 'pointer';
    if (host && (host as any).eventMode !== 'static') {
      (host as any).eventMode = 'static';
      (host as any).cursor = 'pointer';
    }
    // 🔥 CRITICAL: Ensure all children have eventMode = 'none' to prevent blocking touch events
    if (tile.children) {
      tile.children.forEach((child: any) => {
        if (child && child !== host) {
          try {
            child.eventMode = 'none';
            child.cursor = 'default';
            if (child.interactiveChildren !== undefined) {
              child.interactiveChildren = false;
            }
          } catch {}
        }
      });
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
      // 🔥 CRITICAL: Start particles AFTER ensuring eventMode is set correctly
      if (tile.special === 'wild-magnet') {
        // Use requestAnimationFrame to ensure tile is fully set up before starting particles
        requestAnimationFrame(() => {
          try {
        startMagnetIdleParticles(tile);
          } catch (err) {
            console.warn('⚠️ Failed to start magnet idle particles:', err);
          }
        });
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
// 🔥 USER REQUEST: Track if first wild has been spawned (must be wild zvjezdica)
let firstWildSpawned = false;
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
      // 🎯 BOARD-SPECIFIC RULES: Determine wild type based on board rules
      let spawnBeer = false;
      let spawnMagnet = false;
      
      // 🔥 USER REQUEST: On board 1, first wild spawn is always magnet
      if (!firstWildSpawned && boardNumber === 1) {
        spawnBeer = false;
        spawnMagnet = true;
        console.log('🧲 Board 1: First wild spawn: Forcing wild-magnet');
      } else if (!firstWildSpawned) {
        // 🔥 USER REQUEST: First wild spawn on other boards is always wild zvjezdica (not wild-beer, not wild-magnet)
        spawnBeer = false;
        spawnMagnet = false;
        console.log('⭐ First wild spawn: Forcing wild zvjezdica (stars)');
      } else if (boardNumber === 3) {
      // 🎯 BOARD 3: Force wild-beer only (check first, before default logic)
        spawnBeer = true;
        spawnMagnet = false;
        console.log('🎯 Board 3: Forcing wild-beer spawn only');
      } else {
        // 🔥 USER REQUEST: Always random wild spawn - 40% beer, 40% wild (stars), 20% magnet
        const randomRoll = Math.random();
        let preferredBeer = false;
        let preferredMagnet = false;
        let preferredWild = false;
        
        if (randomRoll < 0.4) {
          // 0-0.4 = 40% chance for beer
          preferredBeer = true;
        } else if (randomRoll < 0.8) {
          // 0.4-0.8 = 40% chance for wild (stars)
          preferredWild = true;
        } else {
          // 0.8-1.0 = 20% chance for magnet
          preferredMagnet = true;
        }
        
        // Apply board-specific rules
        if (preferredBeer) {
          const filtered = filterWildType('wild-beer', boardNumber);
          spawnBeer = filtered === 'wild-beer';
          spawnMagnet = false;
        } else if (preferredMagnet) {
          const filtered = filterWildType('wild-magnet', boardNumber);
          spawnMagnet = filtered === 'wild-magnet';
          spawnBeer = false;
        } else if (preferredWild) {
          // Regular wild (stars) - check if allowed
          const filtered = filterWildType('wild', boardNumber);
          if (filtered === 'wild-beer') {
            spawnBeer = true;
            spawnMagnet = false;
          } else if (filtered === 'wild-magnet') {
            spawnMagnet = true;
            spawnBeer = false;
          } else if (filtered === 'wild') {
            // Regular wild allowed (stars)
            spawnBeer = false;
            spawnMagnet = false;
          } else {
            // No wild type allowed for this board - should not happen if we got here
            console.warn(`⚠️ Board ${boardNumber}: No wild type allowed, but spawn was attempted`);
            tries++;
            continue;
          }
        } else {
          // Fallback: use filterWildType with 'wild'
          const filtered = filterWildType('wild', boardNumber);
          if (filtered === 'wild-beer') {
            spawnBeer = true;
          } else if (filtered === 'wild-magnet') {
            spawnMagnet = true;
          } else if (filtered === 'wild') {
            // Regular wild allowed
          } else {
            // No wild type allowed for this board - should not happen if we got here
            console.warn(`⚠️ Board ${boardNumber}: No wild type allowed, but spawn was attempted`);
            tries++;
            continue;
          }
        }
      }
      
      const ok = await openAtCell(cell.c, cell.r, { 
        isWild: true, 
        isWildMagnet: spawnMagnet,
        isWildBeer: spawnBeer 
      });
      
      if (ok) {
        consumeCharge();
        spawned = true;
        
        // 🔥 USER REQUEST: Mark first wild as spawned
        const wasFirstWild = !firstWildSpawned;
        if (!firstWildSpawned) {
          firstWildSpawned = true;
        }
        
        if (spawnBeer) {
          wildBeerSpawned = true; // Mark as spawned (but can spawn again)
          console.log('🍺 Wild-beer spawned (40% random chance)');
          // No board shake on spawn - only on merge 6
        } else if (spawnMagnet) {
          wildMagnetSpawned = true; // Mark as spawned
          if (wasFirstWild && boardNumber === 1) {
            console.log('🧲 Board 1: First wild-magnet spawned from preloader');
          } else {
            console.log('🧲 Wild-magnet spawned (20% random chance)');
          }
        } else {
          if (wasFirstWild) {
            console.log('⭐ First wild spawned: wild zvjezdica (stars)');
          } else {
            console.log('⭐ Regular wild spawned (40% random chance - stars)');
          }
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
  
  // 🛡️ CRITICAL: Block merge if only ONE tile is wild-magnet affected (protected tile cannot merge with others)
  // Protected tiles can only merge with other protected tiles (pulled tiles merge)
  if ((srcIsWildMagnetAffected && !dstIsWildMagnetAffected) || (!srcIsWildMagnetAffected && dstIsWildMagnetAffected)) {
    console.warn('🛡️ MERGE BLOCKED: Only one tile is wild-magnet affected (protected tile cannot merge with others)');
    console.warn('⚠️ Source protected:', srcIsWildMagnetAffected, 'Destination protected:', dstIsWildMagnetAffected);
    console.warn('⚠️ Protected tiles can only merge with other protected tiles (pulled tiles merge)');
    helpers.snapBack?.(src);
    return;
  }
  
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
  
  // 🔥 CRITICAL: Check for wild star merge 6 BEFORE any animations or branches (to capture wildStarSystem)
  // This must happen early to capture the wild tile's _wildStarSystem before it's modified or removed
  const srcSpecialForStarCheck = src?.special;
  const dstSpecialForStarCheck = dst?.special;
  let wildStarTileForAnimation = null;
  let shouldAnimateStarsToHUD = false;
  
  // 🔥 CRITICAL: Save wild star system data EARLY, before any transformations
  // This ensures data is saved even if dst tile becomes merge 6 and loses its _wildStarSystem
  let savedStarSystemEarly = null;
  let savedStarPositionsEarly = [];
  let savedWildTileScreenPosEarly = null;
  
  // Calculate effSum early for wild star check (wild always merges to 6)
  const tempEffSum = wildActive ? 6 : sum;
  
  console.log('⭐ EARLY wild star check - tempEffSum:', tempEffSum, 'srcSpecial:', srcSpecialForStarCheck, 'dstSpecial:', dstSpecialForStarCheck);
  
  if (tempEffSum === 6) {
    console.log('⭐ tempEffSum === 6, checking for wild star...');
    const srcIsWildStar = srcSpecialForStarCheck === 'wild';
    const dstIsWildStar = dstSpecialForStarCheck === 'wild';
    
    console.log('⭐ Wild star check:', { srcIsWildStar, dstIsWildStar });
    
    if (srcIsWildStar || dstIsWildStar) {
      wildStarTileForAnimation = srcIsWildStar ? src : (dstIsWildStar ? dst : null);
      const hasWildStarSystem = !!(wildStarTileForAnimation as any)?._wildStarSystem;
      
      console.log('⭐ EARLY wild star check:', {
        tempEffSum,
        srcSpecialForStarCheck,
        dstSpecialForStarCheck,
        srcIsWildStar,
        dstIsWildStar,
        wildStarTile: !!wildStarTileForAnimation,
        hasWildStarSystem,
        wildStarTileValue: wildStarTileForAnimation?.value,
        wildStarTileSpecial: wildStarTileForAnimation?.special
      });
      
      if (wildStarTileForAnimation && hasWildStarSystem) {
        shouldAnimateStarsToHUD = true;
        
        // 🔥 CRITICAL: Save wild star system data IMMEDIATELY, before any transformations
        // This ensures data is preserved even if dst tile becomes merge 6 and loses _wildStarSystem
        const wildStarSystem = (wildStarTileForAnimation as any)?._wildStarSystem;
        if (wildStarSystem && wildStarSystem.stars && wildStarSystem.stars.length > 0) {
          savedStarSystemEarly = wildStarSystem;
          
          // Save star textures and their global positions (NOT sprite references - sprites get destroyed!)
          savedStarPositionsEarly = wildStarSystem.stars.map((star: any) => {
            if (!star || !star.sprite) return null;
            try {
              const globalPos = star.sprite.getGlobalPosition();
              // 🔥 CRITICAL: Save texture reference and scale values, NOT sprite reference
              // Sprite gets destroyed when tile is removed/transformed, but texture persists
              const texture = star.sprite.texture;
              const scaleX = star.sprite.scale.x;
              const scaleY = star.sprite.scale.y;
              
              if (!texture) {
                console.warn('⚠️ Star sprite has no texture, skipping');
                return null;
              }
              
              return {
                texture: texture, // Save texture reference (not sprite!)
                globalX: globalPos.x,
                globalY: globalPos.y,
                scale: { x: scaleX, y: scaleY }
              };
            } catch (err) {
              console.warn('⚠️ Failed to save star data early:', err);
              return null;
            }
          }).filter(Boolean);
          
          // Save wild tile screen position
          try {
            const wildTileGlobalPos = wildStarTileForAnimation.getGlobalPosition();
            savedWildTileScreenPosEarly = { x: wildTileGlobalPos.x, y: wildTileGlobalPos.y };
          } catch {
            console.warn('⚠️ Failed to get wild tile global position for early saving');
          }
          
          console.log('✅ Saved', savedStarPositionsEarly.length, 'star positions EARLY (before any transformations)');
        } else {
          console.warn('⚠️ Wild star system not found or empty in early check, cannot save star data');
        }
        
        console.log('✅ Will animate stars to HUD after merge animation');
      } else {
        console.log('⚠️ Wild star tile found but conditions not met:', {
          hasWildStarTile: !!wildStarTileForAnimation,
          hasWildStarSystem
        });
      }
    } else {
      console.log('⭐ Not a wild star merge:', { srcSpecialForStarCheck, dstSpecialForStarCheck });
    }
  } else {
    console.log('⭐ Not merge 6, tempEffSum:', tempEffSum);
  }
  
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
    // 🔥 CRITICAL FIX: Ensure dst.value is set immediately (before requestAnimationFrame)
    // This prevents race conditions where visuals might use stale value
    console.log('🔧 MERGE: Setting dst.value to', effSum, 'from src.value', src.value, '+ dst.value', dst.value, 'srcDepth:', srcDepth, 'dstDepth:', dstDepth);
    dst.value = effSum;
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
    
    // 🔥 CRITICAL: Check if this is wild-magnet merge that will pull tiles
    // If so, skip combo increment AND timer here - magnet pull will handle both with proper count
    // NOTE: hasTilesToPull will be calculated later in merge-6 block, but we need a preliminary check here
    const isWildMagnetMerge = src.special === 'wild-magnet' || dst.special === 'wild-magnet';
    // 🔥 CRITICAL: Store isWildMagnetMerge for later use in last merge check
    (dst as any)._isWildMagnetMerge = isWildMagnetMerge;
    
    // Combo++ (bez realnog capa), bump anim
    // 🔥 MAGNET FIX: Skip combo increment AND timer if wild-magnet merge will pull tiles
    // Magnet pull will increase combo by correct amount (currentCombo + 1 + pulledTileCount) and set new timer
    // NOTE: willPullTiles will be calculated later in the last merge check section
    const willPullTilesForCombo = isWildMagnetMerge && effSum === 6; // Preliminary check for combo logic
    if (!willPullTilesForCombo) {
      hudSetCombo(combo + 1);
      try { HUD.bumpCombo?.({ kind: 'stack', combo }); } catch {}
      scheduleComboDecay();
    } else {
      // Wild-magnet merge that will pull tiles - don't increment combo or start timer here
      // Combo will be handled in mergePulledTilesIntoMerge6 with proper increment (currentCombo + 1 + pulledTileCount)
      console.log('🧲 MAGNET COMBO: Skipping combo increment and timer in main merge flow - magnet pull will handle it');
      // DO NOT schedule decay here - magnet pull will set up its own timer after updating combo
    }

    // Stats: track longest combo
    statsService.updateLongestCombo(combo);

    // 🔥 CRITICAL FIX: Check if this is last merge BEFORE adding wild progress
    // This prevents wild meter from filling and triggering wild spawn on last merge
    // We need to check early (before merge 6 block) to prevent race condition
    const activeTilesBeforeWildProgress = tiles.filter(t => {
      if (!t || t.locked) return false;
      const isWild = t.special === 'wild' || t.special === 'wild-magnet' || t.special === 'wild-beer';
      const hasValue = (t.value|0) > 0;
      return isWild || hasValue;
    });
    // 🔥 CRITICAL: Use visible tiles count (not stackDepth sum) for "last 2 tiles" detection
    // Example: 2 visible tiles (1 and 2) should trigger fail screen when stacked, not sum of stackDepth
    const visibleTilesCountBeforeWildProgress = activeTilesBeforeWildProgress.length;
    const activeTilesCountBeforeWildProgress = activeTilesBeforeWildProgress.reduce((sum, t) => {
      const depth = t.stackDepth || 1;
      return sum + depth;
    }, 0);
    
    // Check if this merge involves all remaining tiles (last merge scenario)
    const srcDepthForCheck = src.stackDepth || 1;
    const dstDepthForCheck = dst.stackDepth || 1;
    const combinedCountForCheck = srcDepthForCheck + dstDepthForCheck;
    const allTilesInvolvedForCheck = combinedCountForCheck >= activeTilesCountBeforeWildProgress && 
                                     activeTilesBeforeWildProgress.includes(src) && 
                                     activeTilesBeforeWildProgress.includes(dst);
    
    // 🔥 USER REQUEST: Check for last merge scenarios
    // 1. Wild + regular → merge 6 (only 2 tiles) = clean board
    // 2. Regular + regular → merge 6 (only 2 tiles, e.g. 4+2=6) = clean board
    // 3. Regular + regular → stack (only 2 tiles, e.g. 3+2=5) = fail screen (handled in post-merge check)
    const srcSpecialForCheck = src?.special;
    const dstSpecialForCheck = dst?.special;
    const oneIsWildForCheck = (srcSpecialForCheck === 'wild' || dstSpecialForCheck === 'wild' || 
                              srcSpecialForCheck === 'wild-beer' || dstSpecialForCheck === 'wild-beer');
    const bothAreRegular = !srcSpecialForCheck && !dstSpecialForCheck && 
                          (src.value|0) > 0 && (dst.value|0) > 0;
    
    // 🔥 USER REQUEST: Check if this is last move when stacking 3+ tiles (not merge 6)
    // Example: 1+1+1 → stack(1, depth=3) - this is the last move, should fail quickly
    const wasLastThreeOrMoreStackForCheck = bothAreRegular && 
                                            effSum < 6 && // Stack, not merge 6
                                            activeTilesCountBeforeWildProgress >= 3 && // 3 or more tiles
                                            allTilesInvolvedForCheck; // All tiles involved
    
    const isWildLastTwoForCheck = oneIsWildForCheck && 
                                 visibleTilesCountBeforeWildProgress === 2 && 
                                 activeTilesBeforeWildProgress.includes(src) && 
                                 activeTilesBeforeWildProgress.includes(dst);
    
    // 🔥 NEW: Regular + regular → merge 6 (only 2 tiles) = clean board
    const isRegularLastTwoMerge6 = bothAreRegular && 
                                   visibleTilesCountBeforeWildProgress === 2 && 
                                   activeTilesBeforeWildProgress.includes(src) && 
                                   activeTilesBeforeWildProgress.includes(dst) &&
                                   effSum === 6; // Must be merge 6
    
    // If this is last merge (wild + regular OR regular + regular → merge 6 with only 2 tiles), reset wild meter and skip addWildProgress
    // 🔥 CRITICAL FIX: Don't mark as last merge if wild-magnet will pull tiles (new tiles will spawn)
    // Check if hasTilesToPull was already calculated (from merge-6 block) or use preliminary check
    const hasTilesToPullValue = (dst as any)?._hasTilesToPull;
    // 🔥 CRITICAL: willPullTiles is calculated here - if hasTilesToPull was already calculated, use it; otherwise use preliminary check
    const willPullTiles = isWildMagnetMerge && effSum === 6 && (hasTilesToPullValue !== false); // Only merge 6 triggers pull, and only if hasTilesToPull is not false
    const isActuallyLastMerge = (isWildLastTwoForCheck || isRegularLastTwoMerge6) && !willPullTiles;
    
    if (isActuallyLastMerge) {
      const mergeType = isWildLastTwoForCheck ? 'Wild + regular' : 'Regular + regular';
      console.log(`🚨🚨🚨 LAST MERGE DETECTED (early check) - ${mergeType} → merge 6, resetting wild meter and skipping addWildProgress`);
      console.log('🚨 Details:', { 
        isWildLastTwoForCheck,
        isRegularLastTwoMerge6,
        effSum, 
        activeTilesCountBeforeWildProgress,
        srcSpecial: srcSpecialForCheck,
        dstSpecial: dstSpecialForCheck,
        srcValue: src.value,
        dstValue: dst.value,
        isWildMagnetMerge,
        willPullTiles
      });
      // Reset wild meter to prevent wild spawn
      wildMeter = 0;
      STATE.wildMeter = 0;
      try {
        if (typeof HUD.resetWildMeter === 'function') {
          HUD.resetWildMeter(true);
        }
      } catch (error) {
        console.warn('⚠️ Failed to reset wild meter in HUD:', error);
      }
      // Mark dst as last merge early (will be set again in merge 6 block, but this prevents race condition)
      if (effSum === 6) {
        (dst as any)._isLastMerge = true;
        console.log('✅ _isLastMerge flag set EARLY on dst tile (before merge 6 block)');
      }
    } else if (isWildLastTwoForCheck || isRegularLastTwoMerge6) {
      // This would be last merge, but wild-magnet will pull tiles, so it's NOT last merge
      console.log('🧲 Would be last merge, but wild-magnet will pull tiles - NOT marking as last merge (new tiles will spawn)');
    } else {
      // Normal merge - add wild progress
      addWildProgress(WILD_INC_SMALL);
    }
    
    // SMART SAVE: Debounced save after merge+spawn flow completes
    // 1200ms delay ensures all spawn animations complete before save
    // This prevents saving mid-animation which causes inconsistent state
    debouncedSaveGameState(1200);
    
    // Ghost placeholders are now fixed and always visible

    const srcSpecial = src?.special;
    const dstSpecial = dst?.special;
    // Prevent further interaction with the source tile during the merge animation
    src.eventMode = 'none';
    src.interactiveChildren = false;
    src.cursor = 'default';

    // Safety: If the current drag is bound to the source tile, clear it so a ghost copy can't be dragged
    if (STATE.drag?.t === src) {
      try {
        STATE.drag.t = null;
        STATE.drag.bindToTile?.(null as any);
      } catch (err) {
        console.warn('⚠️ Failed to clear drag binding from src during merge', err);
      }
    }

    // 🔥 NOTE: wildStarTileForAnimation and shouldAnimateStarsToHUD are already set at the beginning of merge function
    // Use the pre-captured values here in the animation callback

    gsap.to(src, {
      x: dst.x, y: dst.y, duration: 0.08, ease: 'power2.out',
      onComplete: async () => {
        // 🔥 CRITICAL: Use EARLY saved star data (saved before any transformations)
        // This ensures data is available even if dst tile became merge 6 and lost _wildStarSystem
        const savedStarPositionsSmall = savedStarPositionsEarly.length > 0 ? savedStarPositionsEarly : [];
        const savedWildTileScreenPosSmall = savedWildTileScreenPosEarly;
        
        // Get merge 6 position for reference (convert to screen coordinates)
        const merge6PosSmall = centerInBoard(board, dst, TILE);
        
        // Get HUD star icon position
        let hudStarPosSmall = null;
        if (shouldAnimateStarsToHUD) {
          try {
            if (typeof HUD.getStarHudPosition === 'function') {
              hudStarPosSmall = HUD.getStarHudPosition();
              console.log('⭐ HUD star position retrieved:', hudStarPosSmall);
            } else {
              console.warn('⚠️ HUD.getStarHudPosition is not a function');
            }
          } catch (err) {
            console.error('❌ Error getting HUD star position:', err);
          }
        }
        
        removeTile(src);
        
        // 🔥 STARS ANIMATION: Trigger animation with EARLY saved star data (after tile is removed)
        // 🔥 CRITICAL: Always trigger animation if shouldAnimateStarsToHUD is true, even if bubbles animation is running
        if (shouldAnimateStarsToHUD) {
          if (savedStarPositionsSmall.length > 0 && hudStarPosSmall) {
            console.log('⭐ Starting stars animation to HUD with saved data:', { 
              starCount: savedStarPositionsSmall.length,
              merge6Pos: merge6PosSmall,
              hudStarPos: hudStarPosSmall,
              hasBubblesRunning: isWildBeerExplosionRunning?.() || false
            });
            
            // 🔥 CRITICAL: Trigger star animation INDEPENDENTLY using requestAnimationFrame
            // This ensures animation starts immediately and is not affected by killAllDelayedCalls()
            // Use requestAnimationFrame for immediate start, with a tiny delay via setTimeout (not GSAP delayedCall)
            requestAnimationFrame(() => {
              // Use setTimeout instead of gsap.delayedCall to avoid being killed by killAllDelayedCalls()
              setTimeout(async () => {
                try {
                  console.log('⭐ About to import animateStarsToHudIcon from fx.js...');
                  // Import and call fx.js animation function with SAVED star data
                  const { animateStarsToHudIcon } = await import('./fx.js');
                  console.log('⭐ Imported animateStarsToHudIcon:', typeof animateStarsToHudIcon);
                  if (typeof animateStarsToHudIcon === 'function') {
                    console.log('⭐ Calling animateStarsToHudIcon with saved star data (INDEPENDENT):', { 
                      board: !!board, 
                      stage: !!stage,
                      savedStarCount: savedStarPositionsSmall.length,
                      merge6Pos: merge6PosSmall,
                      hudStarPos: hudStarPosSmall
                    });
                    // Pass saved star data instead of tile object
                    await animateStarsToHudIcon(board, stage, savedStarPositionsSmall, savedWildTileScreenPosSmall, merge6PosSmall, hudStarPosSmall);
                    console.log('✅ Stars animation to HUD completed (INDEPENDENT)');
                  } else {
                    console.warn('⚠️ animateStarsToHudIcon not available in fx.js');
                  }
                } catch (error) {
                  console.error('❌ Failed to animate stars to HUD:', error);
                }
              }, 200); // 200ms delay using setTimeout (not GSAP, so won't be killed)
            });
          } else {
            console.warn('⭐ Stars animation skipped - missing data:', { 
              shouldAnimate: shouldAnimateStarsToHUD,
              savedStarCount: savedStarPositionsSmall?.length || 0,
              hasHudPos: !!hudStarPosSmall,
              hasEarlySavedData: savedStarPositionsEarly.length > 0,
              hasBubblesRunning: isWildBeerExplosionRunning?.() || false
            });
          }
        }
        // Re-enable drag on the merged tile and ensure drag points to the new stack
        // 🔥 CRITICAL FIX: Ensure dst is NOT locked and is interactive after merge
        dst.locked = false; // Ensure tile is not locked after merge
        dst.eventMode = 'static';
        dst.interactiveChildren = true;
        dst.cursor = 'pointer';
        // Ensure tile is visible and active
        if (dst.alpha !== undefined) dst.alpha = 1;
        if (dst.visible !== undefined) dst.visible = true;
        if (STATE.drag && typeof (STATE.drag as any).bindToTile === 'function') {
          try {
            (STATE.drag as any).bindToTile(dst);
            (STATE.drag as any).t = dst;
          } catch (error) {
            console.warn('⚠️ Failed to rebind drag to merged tile', error);
          }
        }
        
        // 🔥 CRITICAL FIX: SKIP stuck check for merge-6 (effSum === 6)
        // Merge-6 will spawn new tiles, so we should check AFTER spawn completes, not before
        // This prevents false "stuck" detection when board has 2 tiles (e.g., 4 and 2) that can merge
        // 🔥 CRITICAL FIX: SKIP this check if wild-magnet merge (magnet will pull tiles AFTER this merge)
        const isWildMagnetMerge = srcSpecial === 'wild-magnet' || dstSpecial === 'wild-magnet';
        const isMerge6 = effSum === 6;
        
        // 🔥 USER REQUEST: Check for last move scenarios
        // 1. Regular + regular → stack (only 2 tiles, e.g. 3+2=5) = fail screen
        // 2. Regular + regular → merge 6 (only 2 tiles) = clean board (handled in merge-6 block)
        // 3. Wild + regular → merge 6 (only 2 tiles) = clean board (handled in merge-6 block)
        const bothAreRegularForCheck = !srcSpecial && !dstSpecial && 
                                      (src.value|0) > 0 && (dst.value|0) > 0;
        // 🔥 CRITICAL FIX: Use visibleTilesCountBeforeWildProgress (not activeTilesCountBeforeWildProgress) for "last 2 tiles" detection
        // activeTilesCountBeforeWildProgress sums stackDepth, which can be > 2 even with 2 visible tiles
        // visibleTilesCountBeforeWildProgress counts actual visible tiles, which is what we need
        const wasLastTwoRegularStack = bothAreRegularForCheck && 
                                      effSum < 6 && // Stack, not merge 6
                                      visibleTilesCountBeforeWildProgress === 2 &&
                                      activeTilesBeforeWildProgress.includes(src) && 
                                      activeTilesBeforeWildProgress.includes(dst);
        
        // 🔥 USER REQUEST: Check if this was last move when stacking 3+ tiles (not merge 6)
        // Example: 1+1+1 → stack(1, depth=3) - all tiles involved, should fail quickly
        const srcDepthForPostCheck = src.stackDepth || 1;
        const dstDepthForPostCheck = dst.stackDepth || 1;
        const combinedCountForPostCheck = srcDepthForPostCheck + dstDepthForPostCheck;
        const allTilesInvolvedForPostCheck = combinedCountForPostCheck >= activeTilesCountBeforeWildProgress && 
                                            activeTilesBeforeWildProgress.includes(src) && 
                                            activeTilesBeforeWildProgress.includes(dst);
        const wasLastThreeOrMoreStack = bothAreRegularForCheck && 
                                       effSum < 6 && // Stack, not merge 6
                                       activeTilesCountBeforeWildProgress >= 3 && // 3 or more tiles before merge
                                       allTilesInvolvedForPostCheck; // All tiles involved in this stack
        
        // 🔥 CRITICAL: Only check for stuck state if it's NOT a merge-6 (merge-6 will spawn new tiles)
        // For merge-6, we check AFTER spawn completes in checkLevelEnd()
        if (!busyEnding && !isWildMagnetMerge && !isMerge6) {
          // Add delay to ensure removeTile has completed and tiles array is updated
          // 🔥 INCREASED DELAY: 100ms instead of 50ms to ensure tiles array is fully updated
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // 🔥 CRITICAL: Verify dst tile state before checking
          const activeTilesBeforeCheck = tiles.filter(tileIsActive);
          const dstInTiles = tiles.includes(dst);
          const dstIsActive = dst && !dst.locked && (dst.value|0) > 0;
          
          // 🔥 CRITICAL FIX: Check if there are 2+ active tiles that can still merge BEFORE checking stuck
          // This prevents false "stuck" detection when 2 tiles (e.g., 3 and 2) can still stack
          const visibleTilesBeforeCheck = activeTilesBeforeCheck.length;
          if (visibleTilesBeforeCheck >= 2) {
            // Check if anyMergePossible returns true (tiles can still merge/stack)
            const canStillMerge = makeBoard?.anyMergePossible?.(activeTilesBeforeCheck);
            if (canStillMerge) {
              console.log('✅ Post-merge check: 2+ tiles remain and can still merge/stack - NOT checking stuck, game continues');
              console.log('✅ Active tiles:', activeTilesBeforeCheck.map(t => ({ value: t.value, special: t.special })));
              // Don't check stuck - tiles can still merge
              return; // Exit early, don't check stuck
            }
          }
          
          // 🔥 USER REQUEST: If this was last 2 regular tiles that stacked (not merge 6), trigger fail screen immediately
          // 🔥 CRITICAL: Only trigger if this is TRULY the last move (no other tiles on board, no locked tiles)
          // This prevents blocking normal gameplay when stacking in the middle of the game
          // 🔥 CRITICAL FIX: Use visible tiles count (not stackDepth sum) for accurate "last 2 tiles" detection
          const hasOtherActiveTilesForTwo = activeTilesBeforeCheck.some(t => t !== dst);
          const hasLockedTilesForTwo = tiles.some((t: any) => t && !t.destroyed && t.locked && (t.value|0) > 0);
          const isTrulyLastMoveForTwo = !hasOtherActiveTilesForTwo && !hasLockedTilesForTwo && visibleTilesBeforeCheck === 1 && activeTilesBeforeCheck[0] === dst;
          
          if (wasLastTwoRegularStack && isTrulyLastMoveForTwo) {
            // 🔥 CRITICAL: Check if stack can reach merge 6 by merging with itself
            // Stack can merge with itself ONLY if: value + value <= 6 AND stackDepth >= 2
            const finalValue = dst.value || effSum;
            const finalStackDepth = dst.stackDepth || 1;
            const canReachMerge6 = (finalValue + finalValue) <= 6 && finalStackDepth >= 2;
            
            if (!canReachMerge6) {
              console.log('🚨🚨🚨 LAST MOVE DETECTED - Regular + regular → stack (not merge 6), only 1 tile remains, CANNOT reach merge 6, triggering fail screen');
              console.log('🚨 Details:', {
                srcValue: src.value,
                dstValue: dst.value,
                effSum,
                finalTileValue: finalValue,
                finalTileStackDepth: finalStackDepth,
                canReachMerge6: canReachMerge6,
                wouldMergeTo: finalValue + finalValue,
                hasOtherActiveTiles: hasOtherActiveTilesForTwo,
                hasLockedTiles: hasLockedTilesForTwo,
                isTrulyLastMove: isTrulyLastMoveForTwo
              });
              
              if (!busyEnding) {
                // 🔥 USER REQUEST: 1.5 seconds delay before showing fail screen
                // This gives player time to see the board and all calculations to complete
                console.log('⏳ Waiting 1.5 seconds before showing fail screen (last move - stack, cannot reach merge 6)...');
                await new Promise(resolve => setTimeout(resolve, 1500));
                console.log('🚨 Showing fail screen NOW (last move - stack, cannot reach merge 6)');
                showFinalScreen();
              }
              return;
            } else {
              console.log('✅ Stack CAN reach merge 6 by merging with itself (', finalValue, '+', finalValue, '=', finalValue + finalValue, '<= 6, depth:', finalStackDepth, ') - NOT triggering fail screen');
            }
          }
          
          // 🔥 USER REQUEST: If this was last 3+ regular tiles that stacked (not merge 6), trigger fail screen immediately
          // Example: 1+1+1 → stack(1, depth=3) - all tiles involved, this is the last move, should fail quickly
          // 🔥 CRITICAL: Only trigger if this is TRULY the last move (no other tiles on board, no locked tiles)
          // This prevents blocking normal gameplay when stacking in the middle of the game
          const hasOtherActiveTiles = activeTilesBeforeCheck.some(t => t !== dst);
          const hasLockedTiles = tiles.some((t: any) => t && !t.destroyed && t.locked && (t.value|0) > 0);
          const isTrulyLastMove = !hasOtherActiveTiles && !hasLockedTiles && activeTilesBeforeCheck.length === 1 && activeTilesBeforeCheck[0] === dst;
          
          if (wasLastThreeOrMoreStack && isTrulyLastMove) {
            // 🔥 CRITICAL: Check if stack can reach merge 6 by merging with itself
            // Stack can merge with itself ONLY if: value + value <= 6 AND stackDepth >= 2
            const finalValue = dst.value || effSum;
            const finalStackDepth = dst.stackDepth || 1;
            const canReachMerge6 = (finalValue + finalValue) <= 6 && finalStackDepth >= 2;
            
            if (!canReachMerge6) {
              console.log('🚨🚨🚨 LAST MOVE DETECTED - Regular + regular → stack (3+ tiles, all tiles involved), only 1 tile remains, CANNOT reach merge 6, triggering fail screen');
              console.log('🚨 Details:', {
                srcValue: src.value,
                dstValue: dst.value,
                effSum,
                finalTileValue: finalValue,
                finalTileStackDepth: finalStackDepth,
                canReachMerge6: canReachMerge6,
                wouldMergeTo: finalValue + finalValue,
                activeTilesCountBeforeWildProgress,
                combinedCountForPostCheck,
                hasOtherActiveTiles,
                hasLockedTiles,
                isTrulyLastMove
              });
              
              if (!busyEnding) {
                // 🔥 USER REQUEST: 1.5 seconds delay before showing fail screen
                // This gives player time to see the board and all calculations to complete
                console.log('⏳ Waiting 1.5 seconds before showing fail screen (last move - 3+ stack, cannot reach merge 6)...');
                await new Promise(resolve => setTimeout(resolve, 1500));
                console.log('🚨 Showing fail screen NOW (last move - 3+ stack, cannot reach merge 6)');
                showFinalScreen();
              }
              return;
            } else {
              console.log('✅ Stack CAN reach merge 6 by merging with itself (', finalValue, '+', finalValue, '=', finalValue + finalValue, '<= 6, depth:', finalStackDepth, ') - NOT triggering fail screen');
            }
          }
          
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
            busyEnding: busyEnding,
            wasLastTwoRegularStack
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
              // 🔥 USER REQUEST: 1.5 seconds delay before showing fail screen
              // This gives player time to see the board and all calculations to complete
              console.log('⏳ Waiting 1.5 seconds before showing fail screen (post-merge stuck check)...');
              await new Promise(resolve => setTimeout(resolve, 1500));
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
        } else if (isMerge6) {
          console.log('🎯 SKIPPING post-merge stuck check - merge-6 will spawn new tiles, check will happen AFTER spawn completes');
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
        
        // 🔥 CRITICAL FIX: If moves === 0, delay check to ensure tiles array is updated after merge
        // Problem: checkMovesDepleted() was called immediately but tiles array might not be updated yet
        // Solution: Wait for merge animation to complete (400ms) before checking
        if (moves === 0) {
          // Wait for merge animation to complete before checking stuck state
          setTimeout(() => {
            checkMovesDepleted();
          }, 400);
          return;
        }

        // 🔥 REFACTORED: Uklonjen STUCK PROTECTION timer - koristimo samo checkLevelEnd() s delay-om
        // checkLevelEnd() već provjerava sve potrebne scenarije kroz checkEndGame()
        // Nema potrebe za dodatnim timerom koji stvara race conditions
        
        // Za non-merge-6, provjeri nakon delay za animaciju
        if (effSum !== 6) {
          // 🔥 CRITICAL FIX: Increase delay to ensure merge animation completes before endgame check
          // This prevents stuck detection from being blocked by merge animations
          // Delay increased from 100ms to 400ms to match merge animation duration
          setTimeout(() => {
            checkLevelEnd();
          }, 400);
        } else {
          // Za merge-6, checkLevelEnd() se poziva nakon spawn-a (već postoji delay u merge-6 block)
          // Ne treba dodatni poziv ovdje
        }
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
    // 🔥 CRITICAL FIX: Include wild-beer in wild tile check (same as wild star)
    const activeTilesBeforeMerge = tiles.filter(t => {
      if (!t || t.locked) return false;
      const isWild = t.special === 'wild' || t.special === 'wild-magnet' || t.special === 'wild-beer';
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
          // 🔥 CRITICAL FIX: Include wild-beer in wild tile check (same as wild star)
          const isWildOrMagnet = t.special === 'wild' || t.special === 'wild-magnet' || t.special === 'wild-beer';
          if (!isWildOrMagnet && (t.value | 0) <= 0) return false;
          
          // 🔥 CRITICAL: Wild-magnet CAN pull other wild-magnets! (MAGNET-ON-MAGNET FIX)
          // Magnet attracts everything - magnets, wild stars, ordinary tiles
        return true;
      });
      hasTilesToPull = candidates.length > 0;
      console.log('🧲 Wild-magnet merge detected - tiles that can be pulled:', candidates.length, hasTilesToPull ? '(will pull tiles, NOT last merge)' : '(no tiles to pull, might be last merge)');
      }
      // 🔥 CRITICAL: Store hasTilesToPull on dst tile for later use in last merge check
      if (dst && !dst.destroyed) {
        (dst as any)._hasTilesToPull = hasTilesToPull;
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
    // 🔥 CRITICAL FIX: Include wild-beer in wild tile check (same as wild star)
    const oneIsRegularWild = (srcSpecial === 'wild' || dstSpecial === 'wild' || srcSpecial === 'wild-beer' || dstSpecial === 'wild-beer');
    const neitherIsWildMagnet = !(srcSpecial === 'wild-magnet' || dstSpecial === 'wild-magnet');
    // 🔥 CRITICAL FIX: Use visibleTilesCount (visible tiles) NOT activeTilesCount (includes stackDepth)
    const visibleTilesCountForWild = activeTilesBeforeMerge.length; // Number of VISIBLE tiles
    const exactlyTwoActiveTiles = visibleTilesCountForWild === 2; // ONLY if 2 VISIBLE tiles total
    const bothTilesInActiveList = activeTilesBeforeMerge.includes(src) && activeTilesBeforeMerge.includes(dst);
    const isRegularWildLastTwo = oneIsRegularWild && 
                                 neitherIsWildMagnet &&
                                 exactlyTwoActiveTiles && // This is key - ONLY 2 VISIBLE tiles
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
    // 🔥 CRITICAL FIX: Include wild-beer in wild tile check (same as wild star)
    // 🔥 CRITICAL FIX: Use visibleTilesCount (visible tiles) NOT activeTilesCount (includes stackDepth)
    const visibleTilesCountForWildMagnet = activeTilesBeforeMerge.length; // Number of VISIBLE tiles
    const isWildRegularLastTwo = (srcSpecial === 'wild' || srcSpecial === 'wild-magnet' || srcSpecial === 'wild-beer' || dstSpecial === 'wild' || dstSpecial === 'wild-magnet' || dstSpecial === 'wild-beer') &&
                                 visibleTilesCountForWildMagnet === 2 && // 🔥 FIX: ONLY if exactly 2 VISIBLE tiles total
                                 activeTilesBeforeMerge.includes(src) &&
                                 activeTilesBeforeMerge.includes(dst) &&
                                 !(isWildMagnetMerge && hasTilesToPull); // 🔥 CRITICAL: Exclude if wild-magnet will pull tiles
    
    // 🔥 CRITICAL FIX: Wild merge should ONLY be "last merge" if exactly 2 tiles total
    // If more than 2 tiles, it's NOT last merge because spawn will happen
    // Example: wild + 2 tiles = 3 tiles total → NOT last merge, will spawn
    // 🔥 CRITICAL FIX: Include wild-beer in wild tile check (same as wild star)
    // 🔥 CRITICAL FIX: Use visibleTilesCount (visible tiles) NOT activeTilesCount (includes stackDepth)
    const visibleTilesCountForWildLast = activeTilesBeforeMerge.length; // Number of VISIBLE tiles
    const isWildLastTileMerge = (srcSpecial === 'wild' || srcSpecial === 'wild-magnet' || srcSpecial === 'wild-beer' || dstSpecial === 'wild' || dstSpecial === 'wild-magnet' || dstSpecial === 'wild-beer') &&
                                 visibleTilesCountForWildLast === 2 && // 🔥 FIX: ONLY if exactly 2 VISIBLE tiles total
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
    
    // 🔥 USER REQUEST: Last merge applies to:
    // 1. Wild + regular → merge 6 (only 2 tiles) = clean board
    // 2. Regular + regular → merge 6 (only 2 tiles, e.g. 4+2=6, 3+3=6) = clean board
    // Regular + regular → stack (only 2 tiles, e.g. 3+2=5) = fail screen (handled in post-merge check)
    // 🔥 CRITICAL: Check if either tile is wild (any wild type with "wild" prefix)
    const srcIsWild = srcSpecial && srcSpecial.startsWith('wild');
    const dstIsWild = dstSpecial && dstSpecial.startsWith('wild');
    const bothAreRegularForMerge6 = !srcIsWild && !dstIsWild && 
                                    (src.value|0) > 0 && (dst.value|0) > 0;
    // 🔥 CRITICAL FIX: Use visibleTilesCount (visible tiles) NOT activeTilesCount (includes stackDepth)
    const visibleTilesCountForRegular = activeTilesBeforeMerge.length; // Number of VISIBLE tiles
    const isRegularRegularLastTwoMerge6 = bothAreRegularForMerge6 && 
                                          visibleTilesCountForRegular === 2 && // 🔥 FIX: Use visible tiles count
                                          activeTilesBeforeMerge.includes(src) && 
                                          activeTilesBeforeMerge.includes(dst) &&
                                          (src.value|0) + (dst.value|0) === 6; // Must be merge 6
    
    console.log('🔍 LAST MERGE CHECK DETAILS (with regular + regular support):', {
      activeTilesCount,
      wildActive,
      isRegularWildLastTwo,
      isWildRegularLastTwo,
      isLastMergeableTiles,
      isWildLastTileMerge,
      isRegularRegularLastTwoMerge6, // 🔥 NEW: Regular + regular → merge 6
      willMarkAsLastMerge: isRegularWildLastTwo || isWildRegularLastTwo || isLastMergeableTiles || isWildLastTileMerge || isRegularRegularLastTwoMerge6
    });
    
    // 🔥 CRITICAL: Check if this is any wild + regular OR regular + regular → merge 6 with exactly 2 tiles
    // This covers ALL wild types: wild, wild-magnet, wild-beer, and any future wild types with "wild" prefix
    // 🔥 USER REQUEST: Simple rule - if exactly 2 VISIBLE tiles total and one is wild (any wild type), it's last merge
    // 🔥 CRITICAL FIX: Use activeTilesBeforeMerge.length (visible tiles) NOT activeTilesCount (includes stackDepth)
    const visibleTilesCount = activeTilesBeforeMerge.length; // Number of VISIBLE tiles (not including stackDepth)
    const isAnyWildLastTwo = (srcIsWild || dstIsWild) && 
                             (srcIsWild !== dstIsWild) && // One is wild, one is NOT wild
                             visibleTilesCount === 2 && // 🔥 FIX: Use visible tiles count, not activeTilesCount
                             activeTilesBeforeMerge.includes(src) && 
                             activeTilesBeforeMerge.includes(dst) &&
                             !(isWildMagnetMerge && hasTilesToPull); // 🔥 CRITICAL: Exclude if wild-magnet will pull tiles
    
    console.log('🔍 isAnyWildLastTwo CHECK:', {
      srcIsWild,
      dstIsWild,
      oneIsWild: srcIsWild || dstIsWild,
      oneWildOneNot: srcIsWild !== dstIsWild,
      visibleTilesCount, // 🔥 FIX: Use visible tiles count
      activeTilesCount, // Keep for reference
      srcInActive: activeTilesBeforeMerge.includes(src),
      dstInActive: activeTilesBeforeMerge.includes(dst),
      isWildMagnetMerge,
      hasTilesToPull,
      isAnyWildLastTwo
    });
    
    // 🔥 USER REQUEST: Mark as last merge if:
    // 1. Regular + regular → merge 6 (only 2 tiles, e.g. 3+3=6, 4+2=6) = clean board
    // 2. ANY wild + regular → merge 6 (only 2 tiles) = clean board
    // This covers ALL wild types: wild, wild-magnet, wild-beer, and any future wild types
    // 🔥 SIMPLIFIED: Use isAnyWildLastTwo as PRIMARY check for wild + regular (covers all wild types)
    const isLastMerge = isRegularRegularLastTwoMerge6 || isAnyWildLastTwo || isWildRegularLastTwo || isLastMergeableTiles || isWildLastTileMerge;
    
    if (isLastMerge) {
      const mergeType = isRegularRegularLastTwoMerge6 ? 'Regular + regular' : (isAnyWildLastTwo ? 'Any wild + regular' : 'Wild + regular');
      console.log(`🚨🚨🚨 LAST MERGE DETECTED (BEFORE merge 6 animation) - ${mergeType} → merge 6, only 2 tiles`);
      console.log('🚨🚨🚨 Detected by:', {
        isRegularRegularLastTwoMerge6,
        isAnyWildLastTwo,
        isWildRegularLastTwo,
        isLastMergeableTiles,
        isWildLastTileMerge,
        srcIsWild,
        dstIsWild,
        srcSpecial,
        dstSpecial
      });
      console.log('🚨🚨🚨 Last merge details:', {
        activeTilesCount,
        combinedCount,
        allTilesInvolved,
        canMergeTogether,
        isWildLastTileMerge,
        isWildRegularLastTwo,
        isRegularWildLastTwo,
        isRegularRegularLastTwoMerge6, // 🔥 NEW
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
      console.log('✅✅✅ _isLastMerge flag SET to TRUE on dst tile (merge-6 block):', {
        dstValue: dst.value,
        dstSpecial: dst.special,
        _isLastMerge: (dst as any)._isLastMerge,
        mergeType,
        isRegularRegularLastTwoMerge6,
        isAnyWildLastTwo,
        isWildRegularLastTwo,
        isLastMergeableTiles,
        isWildLastTileMerge
      });
      
      // 🔥 CRITICAL FIX: Reset wild meter IMMEDIATELY when last merge is detected in merge-6 block
      // This prevents wild spawn from happening after last merge (double protection)
      // Wild meter may have been filled by addWildProgress before last merge was detected
      console.log('🚨🚨🚨 LAST MERGE (merge-6 block): Resetting wild meter to prevent wild spawn');
      wildMeter = 0;
      STATE.wildMeter = 0;
      try {
        if (typeof HUD.resetWildMeter === 'function') {
          HUD.resetWildMeter(true);
          console.log('✅ LAST MERGE: Wild meter reset in HUD');
        }
      } catch (error) {
        console.warn('⚠️ LAST MERGE: Failed to reset wild meter in HUD:', error);
      }
      
      // 🔥 CRITICAL FIX v40.5: Mark if this was a wild merge OR magnet merge (for spawn skip logic)
      // This includes: wild + regular, regular + wild, magnet + regular, regular + magnet, wild-beer + regular, regular + wild-beer
      const wasWildMerge = srcSpecial === 'wild' || dstSpecial === 'wild';
      const wasWildBeerMerge = srcSpecial === 'wild-beer' || dstSpecial === 'wild-beer';
      const wasMagnetMerge = srcSpecial === 'wild-magnet' || dstSpecial === 'wild-magnet';
      if (wasWildMerge || wasMagnetMerge || wasWildBeerMerge) {
        (dst as any)._wasWildMerge = true;
        console.log('✅ _wasWildMerge flag set to TRUE (wild/magnet/wild-beer merge detected)', {
          wasWildMerge,
          wasWildBeerMerge,
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

    // 🔥 CRITICAL FIX: Clear wild state BEFORE setValue to ensure pips are drawn correctly
    // Problem: If setValue is called first, _setValueVisuals sees tile as wild and hides pips.
    // Then clearWildState makes pips visible, but they're not drawn because drawPips wasn't called.
    // Solution: Clear wild state first, then setValue will see tile as regular and draw pips.
    if (wildActive) {
      clearWildState(dst);
      // Ensure special is null so _setValueVisuals treats it as regular tile
      dst.special = null;
      dst.isWild = false;
      dst.isWildFace = false;
    }
    makeBoard.setValue(dst, 6, 0);
    // 🔥 CRITICAL: After setValue (which uses requestAnimationFrame), double-check pips are drawn
    // This ensures pips are visible even if there was a race condition
    if (wildActive) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (dst && !dst.destroyed && dst.value === 6 && !dst.special && !dst.isWild) {
            // Tile is now regular merge 6, ensure pips are visible
            if (dst.pips) {
              dst.pips.visible = true;
            }
          }
        });
      });
    }
    dst.stackDepth = visualDepth;
    makeBoard.drawStack(dst);
    dst.zIndex = 10000;

    // CRITICAL: For wild-magnet, use multiplier based on number of pulled tiles (max 4x)
    // 🔥 CRITICAL FIX: Use saved srcSpecial and dstSpecial (captured before dst.special was cleared)
    // dst.special was set to null on line 3561, so we must use the saved values
    const isWildMagnet = srcSpecial === 'wild-magnet' || dstSpecial === 'wild-magnet';
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
      // Use saved srcSpecial and dstSpecial for accurate logging (dst.special was cleared on line 3561)
      console.log('🔍 MAGNET PULL DEBUG: Checking all tiles on board:', {
        totalTilesInState: STATE.tiles.length,
        srcTile: { value: src.value, special: srcSpecial, locked: src.locked },
        dstTile: { value: dst.value, special: dstSpecial, locked: dst.locked }
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
          // This allows them to merge only with other pulled tiles
          tile._wildMagnetAffected = true;
          tile._skipIdleScaleReset = true;
          
          // 🔥 CRITICAL: Disable drag and lock pulled tiles (prevent user from dragging or merging them)
          // This ensures tiles are protected from any external interaction while being pulled
          tile.eventMode = 'none';
          tile.cursor = 'default';
          tile.locked = true; // Lock tile to prevent any interactions
          
          console.log('🛡️ Protected pulled tile:', tile.value, 'special:', tile.special, 'eventMode:', tile.eventMode, 'locked:', tile.locked);
          
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
          
          // 🔥 CRITICAL: Re-enable drag and unlock tile (restore original state)
          tile.locked = false;
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
                
                // 🔥 USER REQUEST: Add wild progress IMMEDIATELY when magnet pull starts (before merge animation)
                // This makes wild meter progress bar animate during pull animation, not after
                // 🔥 CRITICAL FIX: Check if this is last merge (only 2 tiles on board) BEFORE adding wild progress
                // This prevents wild meter from filling when magnet pull results in clean board
                const activeTilesBeforePull = tiles.filter(t => {
                  if (!t || t.locked) return false;
                  const isWild = t.special === 'wild' || t.special === 'wild-magnet' || t.special === 'wild-beer';
                  const hasValue = (t.value|0) > 0;
                  return isWild || hasValue;
                });
                const visibleTilesCountBeforePull = activeTilesBeforePull.length;
                // Last merge = only 2 tiles (magnet + 1 other) that will merge to merge 6
                const isLastMergeBeforePull = visibleTilesCountBeforePull === 2 && 
                                             activeTilesBeforePull.includes(dst) && 
                                             validTiles.length >= 1 && validTiles.length <= 4;
                
                // 🔥 USER REQUEST: Add wild progress when magnet pulls tiles (1-4 tiles, treat as merge 6)
                // BUT: Skip if this is last merge (would result in clean board)
                // 🔥 ANIMATION TIMING: Add progress IMMEDIATELY (before pull animation) so progress bar animates during pull
                if (validTiles.length >= 1 && validTiles.length <= 4 && !isLastMergeBeforePull) {
                  console.log(`🧲 Magnet pulling ${validTiles.length} tiles - adding wild progress IMMEDIATELY (treating as merge 6, NOT last merge)`);
                  addWildProgress(WILD_INC_BIG); // Same as regular merge 6 - animates during pull
                } else if (isLastMergeBeforePull) {
                  console.log(`🚨🚨🚨 LAST MERGE DETECTED (magnet pull) - ${visibleTilesCountBeforePull} tiles before pull, skipping wild progress`);
                  // Reset wild meter to prevent wild spawn before clean board
                  wildMeter = 0;
                  STATE.wildMeter = 0;
                  try {
                    if (typeof HUD.resetWildMeter === 'function') {
                      HUD.resetWildMeter(true);
                      console.log('✅ LAST MERGE (magnet pull): Wild meter reset in HUD');
                    }
                  } catch (error) {
                    console.warn('⚠️ LAST MERGE (magnet pull): Failed to reset wild meter in HUD:', error);
                  }
                }
                
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
        
        // 🔥 CRITICAL: Use EARLY saved star data (saved before any transformations)
        // This ensures data is available even if dst tile became merge 6 and lost _wildStarSystem
        const savedStarPositions = savedStarPositionsEarly.length > 0 ? savedStarPositionsEarly : [];
        const savedWildTileScreenPos = savedWildTileScreenPosEarly;
        
        // Get merge 6 position for reference (convert to screen coordinates)
        const merge6Pos = centerInBoard(board, dst, TILE);
        
        // Get HUD star icon position
        let hudStarPos = null;
        if (shouldAnimateStarsToHUD) {
          try {
            if (typeof HUD.getStarHudPosition === 'function') {
              hudStarPos = HUD.getStarHudPosition();
              console.log('⭐ HUD star position retrieved:', hudStarPos);
            } else {
              console.warn('⚠️ HUD.getStarHudPosition is not a function');
            }
          } catch (err) {
            console.error('❌ Error getting HUD star position:', err);
          }
        }

        removeTile(src);
        
        // 🔥 STARS ANIMATION: Trigger animation with EARLY saved star data (after tile is removed)
        // 🔥 CRITICAL: Always trigger animation if shouldAnimateStarsToHUD is true, even if bubbles animation is running
        if (shouldAnimateStarsToHUD) {
          if (savedStarPositions.length > 0 && hudStarPos) {
            console.log('⭐ Starting stars animation to HUD with saved data:', { 
              starCount: savedStarPositions.length,
              merge6Pos,
              hudStarPos,
              hasBubblesRunning: isWildBeerExplosionRunning?.() || false
            });
            
            // 🔥 CRITICAL: Trigger star animation INDEPENDENTLY using requestAnimationFrame
            // This ensures animation starts immediately and is not affected by killAllDelayedCalls()
            // Use requestAnimationFrame for immediate start, with a tiny delay via setTimeout (not GSAP delayedCall)
            requestAnimationFrame(() => {
              // Use setTimeout instead of gsap.delayedCall to avoid being killed by killAllDelayedCalls()
              setTimeout(async () => {
                try {
                  console.log('⭐ About to import animateStarsToHudIcon from fx.js...');
                  // Import and call fx.js animation function with SAVED star data
                  const { animateStarsToHudIcon } = await import('./fx.js');
                  console.log('⭐ Imported animateStarsToHudIcon:', typeof animateStarsToHudIcon);
                  if (typeof animateStarsToHudIcon === 'function') {
                    console.log('⭐ Calling animateStarsToHudIcon with saved star data (INDEPENDENT):', { 
                      board: !!board, 
                      stage: !!stage,
                      savedStarCount: savedStarPositions.length,
                      merge6Pos,
                      hudStarPos
                    });
                    // Pass saved star data instead of tile object
                    await animateStarsToHudIcon(board, stage, savedStarPositions, savedWildTileScreenPos, merge6Pos, hudStarPos);
                    console.log('✅ Stars animation to HUD completed (INDEPENDENT)');
                  } else {
                    console.warn('⚠️ animateStarsToHudIcon not available in fx.js');
                  }
                } catch (error) {
                  console.error('❌ Failed to animate stars to HUD:', error);
                }
              }, 200); // 200ms delay using setTimeout (not GSAP, so won't be killed)
            });
          } else {
            console.warn('⭐ Stars animation skipped - missing data:', { 
              shouldAnimate: shouldAnimateStarsToHUD,
              savedStarCount: savedStarPositions?.length || 0,
              hasHudPos: !!hudStarPos,
              hasEarlySavedData: savedStarPositionsEarly.length > 0,
              hasBubblesRunning: isWildBeerExplosionRunning?.() || false
            });
          }
        }
        
        // 🔥 CRITICAL: Check if this was marked as last merge BEFORE animation started
        // 🔥 ENHANCED: Double-check _isLastMerge flag and verify dst still exists
        const isLastMergeInOnComplete = (dst as any)?._isLastMerge === true;
        const dstStillExists = dst && !dst.destroyed && STATE.tiles.includes(dst);
        
        // 🔥 USER REQUEST: Check if this was last 2 tiles AFTER removing src
        // This is the CORRECT time to check - after src is removed, if only merge-6 remains, it was last 2 tiles
        const activeTilesAfterSrcRemoval = getReactiveActiveTiles();
        const onlyMerge6Remains = activeTilesAfterSrcRemoval.length === 1 && 
                                  activeTilesAfterSrcRemoval[0] === dst && 
                                  dst.value === 6;
        // 🔥 CRITICAL: Use srcSpecial and dstSpecial from closure (snimljeni PRIJE merge-6 bloka)
        const srcWasWild = srcSpecial && srcSpecial.startsWith('wild');
        const dstWasRegular = !dstSpecial && (dst.value|0) > 0;
        const wasWildRegularLastTwo = srcWasWild && dstWasRegular && onlyMerge6Remains;
        const wasRegularRegularLastTwo = !srcWasWild && !dstSpecial && 
                                         (src.value|0) > 0 && (dst.value|0) > 0 &&
                                         onlyMerge6Remains;
        
        // 🔥 CRITICAL: If this was last 2 tiles (wild + regular OR regular + regular), set flag NOW
        if ((wasWildRegularLastTwo || wasRegularRegularLastTwo) && !isLastMergeInOnComplete) {
          (dst as any)._isLastMerge = true;
          console.log('🚨🚨🚨 LAST MERGE DETECTED (AFTER src removal) - Only merge-6 remains:', {
            wasWildRegularLastTwo,
            wasRegularRegularLastTwo,
            srcSpecial: srcSpecial,
            dstSpecial: dstSpecial,
            srcValue: src.value,
            dstValue: dst.value,
            activeTilesAfterSrcRemoval: activeTilesAfterSrcRemoval.length
          });
        }
        
        console.log('🔍 LAST MERGE CHECK in onComplete:', {
          isLastMergeInOnComplete,
          wasWildRegularLastTwo,
          wasRegularRegularLastTwo,
          onlyMerge6Remains,
          activeTilesAfterSrcRemoval: activeTilesAfterSrcRemoval.length,
          dstStillExists,
          dstValue: dst?.value,
          dstSpecial: dst?.special,
          busyEnding,
          _isLastMerge: (dst as any)?._isLastMerge
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
            // 🔥 USER REQUEST: Skip star particles - orbiting stars will be animated to HUD instead
            console.log('🔥 Wild-only merge 6 - using yellow/brown shards (srcSpecial:', srcSpecial, 'dstSpecial:', dstSpecial, ')');
            // 🔥 WILD-BEER: Pass wild-beer info to woodShardsAtTile
            const isWildBeerMerge = srcSpecial === 'wild-beer' || dstSpecial === 'wild-beer';
            // 🔥 USER REQUEST: Check if this is pure wild star (not wild-beer, not wild-magnet)
            const isPureWildStarMerge = (srcSpecial === 'wild' || dstSpecial === 'wild') && !isWildBeerMerge;
            
            console.log('💧 Merge 6 check - isWildBeerMerge:', isWildBeerMerge, 'isPureWildStarMerge:', isPureWildStarMerge, 'srcSpecial:', srcSpecial, 'dstSpecial:', dstSpecial, 'srcValue:', src?.value, 'dstValue:', dst?.value);
            
            woodShardsAtTile(board, dst, { 
              enhanced: true, 
              wild: true,  // Explicitly set wild flag (not wild-magnet) - this will allow stars check
              wildMagnet: false,  // Explicitly NOT wild-magnet - this will allow stars
              isWildBeer: isWildBeerMerge,  // 🔥 Pass wild-beer flag
              skipStars: isPureWildStarMerge,  // 🔥 USER REQUEST: Skip star particles for pure wild star merge 6
              count: 30, 
              intensity: 1.9, 
              spread: 0.3,  // Dramatically reduced from 1.2 to keep shards very close to tile
              size: 1.5,     // Same size as magnet merge 6
              speed: 0.85, 
              vanishDelay: 0.0, 
              vanishJitter: 0.02 
            });
            
            // 🔥 FPS DROP FIX: Stagger animacije umjesto istovremenog pokretanja
            // Trigger only the main bubbles explosion (skip smaller fizz to avoid double-wave)
            if (isWildBeerMerge) {
              console.log('💧 Wild-beer merge detected! isWildBeerMerge:', isWildBeerMerge, 'srcSpecial:', srcSpecial, 'dstSpecial:', dstSpecial);
              console.log('💧 src tile special:', src?.special, 'dst tile special:', dst?.special);
              console.log('💧 src value:', src?.value, 'dst value:', dst?.value);
              
              // 🔥 CRITICAL: Ensure cleanup is called BEFORE triggering new explosion
              // This prevents race condition where previous explosion state blocks new one
              try {
                const wasActive = isWildBeerExplosionRunning();
                if (wasActive) {
                  console.log('🧹 Cleaning up previous wild beer explosion state before merge 6 bubbles');
                  cleanupWildBeerExplosion();
                }
              } catch (err) {
                console.warn('⚠️ Failed to cleanup wild beer explosion before merge 6:', err);
              }
              
              // 🔥 CRITICAL: Snimiti dst poziciju PRIJE nego što se ukloni (za bubbles explosion)
              // dst tile se uklanja u merge 6 bloku, ali bubbles explosion treba poziciju
              const dstPosForBubbles = {
                x: dst?.x ?? dstX ?? 0,
                y: dst?.y ?? dstY ?? 0,
                gridX: dst?.gridX ?? dstGridX ?? 0,
                gridY: dst?.gridY ?? dstGridY ?? 0
              };
              
              // 🔥 FPS DROP FIX: Stagger bubbles explosion NAKON 200ms (ne istovremeno s drugim animacijama)
              // Ovo smanjuje CPU/GPU spike i sprječava freeze
              gsap.delayedCall(0.2, () => {
                try {
                  // 🔥 CRITICAL: Use saved position instead of dst tile (dst may be destroyed by now)
                  // Bubbles explosion can work with position data instead of tile reference
                  if (board && !board.destroyed) {
                    const isStillActive = isWildBeerExplosionRunning();
                    if (isStillActive) {
                      console.warn('⚠️ Wild beer explosion still active, forcing cleanup before new explosion');
                      cleanupWildBeerExplosion();
                    }
                    
                    // Create a temporary position object for bubbles explosion
                    // If dst is still valid, use it; otherwise use saved position
                    const bubbleTarget = (dst && !dst.destroyed) ? dst : {
                      x: dstPosForBubbles.x,
                      y: dstPosForBubbles.y,
                      gridX: dstPosForBubbles.gridX,
                      gridY: dstPosForBubbles.gridY,
                      destroyed: false // Fake tile object for bubbles explosion
                    };
                    
                    console.log('💧 Triggering wild-beer bubbles explosion at merge 6 (staggered 200ms) - using saved position if dst destroyed');
                    createWildBeerBubblesExplosion(board, bubbleTarget);
                  } else {
                    console.warn('⚠️ Cannot trigger bubbles explosion - board invalid:', {
                      board: !!board,
                      boardDestroyed: board?.destroyed
                    });
                  }
                } catch (error) {
                  console.error('❌ Failed to trigger bubbles foam:', error);
                }
              });
            } else {
              console.log('⚠️ Wild-beer merge NOT detected! isWildBeerMerge:', isWildBeerMerge, 'srcSpecial:', srcSpecial, 'dstSpecial:', dstSpecial);
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
        
        // 🔥 CRITICAL: Check if this is magnet pull merge BEFORE hiding dst tile
        // For magnet pull merge, dst (merge 6) should remain visible on the board
        // Check both the flag (set later) AND wasWildMagnet + _wildMagnetMergeCallback (set earlier)
        const isMagnetPullMergeFlag = (dst as any)?._wildMagnetPulledTilesMerge === true;
        const isMagnetPullMergeEarly = wasWildMagnet && (dst as any)?._wildMagnetMergeCallback;
        const isMagnetPullMerge = isMagnetPullMergeFlag || isMagnetPullMergeEarly;
        
        // Create locked placeholder at dst position for spawn logic
        let placeholderHolder: any = null; // 🔥 v40.1: Store reference to placeholder for cleanup
        if (dst && !dst.destroyed && STATE.tiles.includes(dst)) {
          // Clear grid position FIRST (before hiding dst)
        grid[gy][gx] = null;
          
          // 🔥 CRITICAL FIX: For magnet pull merge, DON'T hide dst tile - it should remain visible!
          // Only hide dst tile for regular merge 6 (not magnet pull merge)
          if (!isMagnetPullMerge) {
            // Hide dst tile but DON'T remove it from tiles array yet (regular merge 6 only)
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
            // 🔥 CRITICAL: For magnet pull merge, keep dst tile visible and don't create placeholder
            // The merge 6 tile should remain on the board along with newly spawned tiles
            console.log('🧲 Magnet pull merge detected - keeping merge 6 tile visible on board');
            console.log('🧲 Dst tile (merge 6) will remain visible:', { 
              value: dst.value, 
              gridX: dst.gridX, 
              gridY: dst.gridY,
              wasWildMagnet: wasWildMagnet,
              hasCallback: !!(dst as any)?._wildMagnetMergeCallback,
              hasFlag: isMagnetPullMergeFlag
            });
          }
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
        console.log('🔍 DEBUG: mult value in onComplete:', mult, 'typeof mult:', typeof mult);
        
        // 🔥 USER REQUEST: Check for last merge BEFORE adding wild progress and spawning
        // Last merge applies to:
        // 1. Wild + regular → merge 6 (only 2 tiles) = clean board
        // 2. Regular + regular → merge 6 (only 2 tiles, e.g. 4+2=6) = clean board
        // 3. Wild-magnet + regular → merge 6 (only 2 tiles) = clean board
        // 🔥 CRITICAL FIX v85: If pulled tiles will merge, this is NOT last merge (new tiles will spawn)
        // Check BOTH flags: _wildMagnetPulledTilesMerge (set when merge starts) AND _hasTilesToPull (set earlier in merge function)
        // _hasTilesToPull is set when wild-magnet merge is detected and there are tiles to pull
        // This prevents premature clean board trigger when magnet pulls tiles and spawns new ones
        const willPulledTilesMerge = (dst as any)?._wildMagnetPulledTilesMerge === true;
        const hasTilesToPull = (dst as any)?._hasTilesToPull === true;
        // If hasTilesToPull is true, it means wild-magnet merge will pull tiles (only for merge 6)
        const willPullTiles = willPulledTilesMerge || hasTilesToPull;
        const hasLastMergeFlag = (dst as any)?._isLastMerge === true;
        
        // 🔥 CRITICAL FIX: If pulled tiles will merge, skip last merge check (new tiles will spawn)
        let isActuallyLastMerge = false;
        if (willPullTiles) {
          console.log('🧲 Pulled tiles will merge - this is NOT last merge (new tiles will spawn)', {
            willPulledTilesMerge,
            hasTilesToPull,
            willPullTiles,
            note: 'Skipping last merge check because tiles will be pulled and new tiles will spawn'
          });
          // Don't check for last merge - pulled tiles merge will spawn new tiles
          isActuallyLastMerge = false;
        } else {
          // 🔥 CRITICAL: Double-check last merge scenario using end game checker
          // This ensures we catch last merge even if flag wasn't set properly
          const activeTilesAfterMerge = tiles.filter((t: any) => {
            if (!t || t.destroyed || t.locked) return false;
            const value = (t.value | 0);
            const special = t.special;
            const isWild = special === 'wild' || special === 'wild-magnet' || special === 'wild-beer';
            return value > 0 || isWild;
          });
          
          // If only merge 6 remains (or merge 6 + locked tiles), this is last merge
          const onlyMerge6RemainsInOnComplete = activeTilesAfterMerge.length === 1 && 
                                                activeTilesAfterMerge[0] === dst && 
                                                dst.value === 6;
          
          isActuallyLastMerge = hasLastMergeFlag || onlyMerge6RemainsInOnComplete;
        
          console.log('🔍 LAST MERGE CHECK in merge-6 onComplete:', {
            hasLastMergeFlag,
            onlyMerge6RemainsInOnComplete,
            isActuallyLastMerge,
            activeTilesAfterMergeCount: activeTilesAfterMerge.length,
            srcSpecial: src?.special,
            dstSpecial: dst?.special,
            srcValue: src?.value,
            dstValue: dst.value
          });
        }
        
        // If _isLastMerge flag is set (from early check or merge-6 block), skip wild progress and spawn
        // This flag is set for wild + regular OR regular + regular → merge 6 scenarios (only 2 tiles)
        if (isActuallyLastMerge) {
          const mergeType = (!src?.special && !dst?.special) ? 'Regular + regular' : 
                           (src?.special === 'wild-magnet' || dst?.special === 'wild-magnet') ? 'Wild-magnet + regular' :
                           'Wild + regular';
          console.log(`🚨🚨🚨 LAST MERGE DETECTED (in merge-6 onComplete) - ${mergeType} → merge 6, skipping wild progress and spawn, triggering clean board`);
          console.log('🚨🚨🚨 LAST MERGE: hasLastMergeFlag =', hasLastMergeFlag, 'onlyMerge6RemainsInOnComplete =', isActuallyLastMerge, 'dst._isLastMerge =', (dst as any)?._isLastMerge);
          
          // Ensure flag is set for consistency
          if (!hasLastMergeFlag) {
            (dst as any)._isLastMerge = true;
            console.log('✅ Setting _isLastMerge flag in onComplete (was missing)');
          }
          
          // Skip wild progress and spawn - go directly to clean board flow
          // The clean board flow will be triggered by the _isLastMerge flag check below
          // 🔥 CRITICAL: DON'T call addWildProgress - it would fill wild meter and trigger wild spawn!
        } else {
          // Normal merge-6 - add wild progress
          console.log('✅ Normal merge-6 (NOT last merge) - adding wild progress');
          addWildProgress(WILD_INC_BIG);
        }
        
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
              // 🔥 USER REQUEST: 1.5 seconds delay before showing fail screen
              // This gives player time to see the board and all calculations to complete
              console.log('⏳ Waiting 1.5 seconds before showing fail screen (moves depleted + stuck in merge 6)...');
              await new Promise(res => setTimeout(res, 1500));
              showFinalScreen();
            }
            return;
          }
        }
        // Pass wild merge target info for smart spawning
        const wildMergeTarget = Number.isFinite(wildTargetValue) ? wildTargetValue : null;
        
        // 🔥 CRITICAL: Skip normal spawn if pulled tiles merge is happening
        // Pulled tiles merge already spawns new tiles in mergePulledTilesIntoMerge6
        if ((dst as any)?._wildMagnetPulledTilesMerge) {
          console.log('🧲 Skipping normal spawn - pulled tiles merge already spawned tiles');
          // 🔥 CRITICAL: Clean up flags AFTER checking (they were set before handleWildMagnetMergedPulledTiles)
          (dst as any)._wildMagnetPulledTilesMerge = undefined;
          (dst as any)._wildMagnetPulledTilesScoring = undefined;
          
          // 🔥 CRITICAL FIX: Don't call checkLevelEnd here - it's already called in mergePulledTilesIntoMerge6
          // Calling it twice causes race conditions and premature fail screens
          // mergePulledTilesIntoMerge6 waits for spawn animations and calls checkLevelEnd with proper timing
          console.log('🧲 Skipping checkLevelEnd call here - mergePulledTilesIntoMerge6 will handle it after spawn completes');
          return;
        }
        
        // 🔥 SIMPLIFIED: Only check _isLastMerge flag - this is set ONLY when it's truly the last merge (2 tiles total)
        // All other checks were too aggressive and blocked spawn when it shouldn't be blocked
        // 🔥 CRITICAL FIX: If pulled tiles will merge, this is NOT last merge (new tiles will spawn)
        // Note: willPulledTilesMerge is already declared above (line 4997), so we reuse it here
        const isLastMergeFlagSet = (dst as any)?._isLastMerge === true;
        
        // 🔥 CRITICAL FIX: Don't trigger clean board if pulled tiles will merge (new tiles will spawn)
        if (willPulledTilesMerge) {
          console.log('🧲 Pulled tiles will merge - this is NOT last merge (new tiles will spawn), clearing _isLastMerge flag');
          // Clear the flag since new tiles will spawn
          (dst as any)._isLastMerge = false;
          // Don't trigger clean board - pulled tiles merge will handle spawn and endgame check
        } else if (isLastMergeFlagSet || busyEnding) {
          console.log('🚨🚨🚨 LAST MERGE: Skipping spawn - _isLastMerge flag is TRUE or busyEnding is true');
          
          // 🔥 CRITICAL: If _isLastMerge flag is set, trigger clean board flow
          if (isLastMergeFlagSet && !busyEnding) {
            console.log('🚨🚨🚨 _isLastMerge flag is TRUE - triggering clean board flow');
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
          
          return; // Exit early - don't spawn new tiles
        }
        
        // Use multiplier for spawning new tiles
        const spawnMult = mult;
        
        // 🔥 CRITICAL: Check if spawnMult is valid before proceeding
        if (!spawnMult || spawnMult <= 0) {
          console.warn('⚠️ SPAWN BLOCKED: spawnMult is invalid:', spawnMult, 'mult:', mult);
          return;
        }
        
        // 🔥 CRITICAL: Get pulled cells from dst tile to exclude from normal spawn
        const pulledCells = (dst as any)?._wildMagnetPulledCells || [];
        const pulledCellsSet = new Set(pulledCells.map((cell: { c: number; r: number }) => `${cell.c},${cell.r}`));
        
        // 🔥 DEBUG: Detailed spawn check for all merge-6 types
        const mergeType = !wildActive ? 'regular-regular' : 
                         (srcSpecial === 'wild' || dstSpecial === 'wild') ? 'wild-regular' :
                         (srcSpecial === 'wild-beer' || dstSpecial === 'wild-beer') ? 'wild-beer-regular' :
                         (srcSpecial === 'wild-magnet' || dstSpecial === 'wild-magnet') ? 'wild-magnet-regular' : 'unknown';
        
        const activeTilesCount = tiles.filter(tileIsActive).length;
        
        console.log('🎯🎯🎯 SPAWN CHECK FOR MERGE-6:', {
          mergeType,
          srcSpecial,
          dstSpecial,
          spawnMult,
          mult,
          wasWild: wildActive,
          isWildBeer: srcSpecial === 'wild-beer' || dstSpecial === 'wild-beer',
          isWildMagnet: srcSpecial === 'wild-magnet' || dstSpecial === 'wild-magnet',
          isWild: srcSpecial === 'wild' || dstSpecial === 'wild',
          willSpawn: spawnMult > 0,
          activeTilesCount,
          isLastMergeFlagSet,
          _wasWildMerge: (dst as any)?._wasWildMerge
        });
        
        console.log('🎯 Spawning new tiles with multiplier:', spawnMult);
        console.log('🎯 Excluding pulled cells from spawn:', pulledCells);
        console.log('🎯 Wild merge target (for smart spawn):', wildMergeTarget);
        console.log('🎯 Merge type check:', {
          srcSpecial,
          dstSpecial,
          wasWild: wildActive,
          isWildBeer: srcSpecial === 'wild-beer' || dstSpecial === 'wild-beer',
          isWildMagnet: srcSpecial === 'wild-magnet' || dstSpecial === 'wild-magnet',
          isWild: srcSpecial === 'wild' || dstSpecial === 'wild'
        });
        
        // 🔥 CRITICAL: Check if there are locked tiles available for spawn (excluding placeholder at dst position)
        // If no locked tiles (or only placeholder exists), spawn directly at dst position (end-game scenario)
        const lockedTiles = tiles.filter(t => t && !t.destroyed && t.locked && t.scale);
        const placeholderHolderRef = (dst as any)?._placeholderHolder;
        
        // Filter out placeholder at dst position and pulled cells
        const availableLockedTiles = lockedTiles.filter((t: any) => {
          if (!t || t.destroyed) return false;
          // Exclude placeholder at dst position
          if (placeholderHolderRef && t === placeholderHolderRef) {
            return false;
          }
          // Exclude pulled cells
          if (typeof t.gridX === 'number' && typeof t.gridY === 'number') {
            const cellKey = `${t.gridX},${t.gridY}`;
            return !pulledCellsSet.has(cellKey);
          }
          return true;
        });
        
        // 🔥 CRITICAL: If no locked tiles available (or only placeholder exists), spawn directly at dst position
        // This happens when all tiles are opened and merge-6 is made
        // Spawn new ACTIVE tile with pips at the exact position of merge-6
        if (availableLockedTiles.length === 0 && spawnMult > 0) {
          console.log('🎯🎯🎯 END-GAME SPAWN: No locked tiles available - spawning directly at dst position (', gx, ',', gy, ')');
          
          // Remove placeholder if it exists (we'll spawn active tile instead)
          if (placeholderHolderRef && !placeholderHolderRef.destroyed) {
            console.log('🧹 Removing placeholder before spawning active tile at dst position');
            if (placeholderHolderRef.gridX !== undefined && placeholderHolderRef.gridY !== undefined && grid && grid[placeholderHolderRef.gridY]) {
              grid[placeholderHolderRef.gridY][placeholderHolderRef.gridX] = null;
            }
            removeTile(placeholderHolderRef);
              (dst as any)._placeholderHolder = undefined;
            }
            
          // Get dst position
          const spawnC = gx;
          const spawnR = gy;
          
          // 🔥 CRITICAL: Ensure grid position is clear before spawning
          if (grid && grid[spawnR] && grid[spawnR][spawnC]) {
            console.log('🧹 Clearing grid position before spawning active tile');
            grid[spawnR][spawnC] = null;
          }
          
          // Spawn new ACTIVE tile with pips at dst position
          // Use tracked setTimeout to ensure grid is cleared and placeholder is removed
          trackAppTimeout(() => {
            openAtCell(spawnC, spawnR, { 
              value: wildMergeTarget ? (() => {
                const candidates = [1,2,3,4,5].filter(v => v !== wildMergeTarget);
                return candidates[(Math.random() * candidates.length) | 0];
              })() : null,
              skipBind: false,
              timeScale: 2.0  // Fast spawn animation
            }).then((spawnResult) => {
              if (spawnResult) {
                console.log('✅✅✅ END-GAME SPAWN: Spawned new ACTIVE tile with pips at dst position (', spawnC, ',', spawnR, ')');
              } else {
                console.warn('⚠️ END-GAME SPAWN: Failed to spawn tile at dst position (', spawnC, ',', spawnR, ')');
              }
            }).catch((err) => {
              console.warn('⚠️ END-GAME SPAWN: Error spawning tile at dst position:', err);
            });
          }, 50); // Small delay to ensure cleanup is complete
        } else {
          // 🔥 CRITICAL: Don't await - spawn tiles in parallel, let animations run concurrently (same as magnet pull)
          // This allows spawn to happen immediately without waiting for animations to complete
          console.log('🚀 CALLING openLockedBounceParallel with spawnMult:', spawnMult, 'available locked tiles:', availableLockedTiles.length);
          FLOW.openLockedBounceParallel({ 
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
          }).then(() => {
            console.log('✅ openLockedBounceParallel completed - all spawn animations finished');
          }).catch((err) => {
            console.warn('⚠️ openLockedBounceParallel error:', err);
        });
        }
        
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
        
        // 🔥 CRITICAL: Wait for spawn to complete BEFORE removing dst tile
        // This ensures locked tiles are still valid when spawn happens
        // Wait a bit to ensure spawn animations have started
        setTimeout(() => {
        if (dst && !dst.destroyed && STATE.tiles.includes(dst)) {
          console.log('🗑️ Removing dst tile AFTER spawn (delayed from earlier)');
          // Note: grid[gy][gx] was already set to null when placeholder was created
          removeTile(dst); // Remove from tiles array
          console.log('✅ Dst tile removed successfully');
        }
        }, 100); // Small delay to ensure spawn has started
        
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
        
        // 🔥 CRITICAL FIX: Skip checkLevelEnd if _isLastMerge flag is set (clean board flow already triggered)
        // This prevents fail screen from triggering when clean board flow is in progress
        const hasLastMergeFlagAfterSpawn = (dst as any)?._isLastMerge === true;
        if (hasLastMergeFlagAfterSpawn || busyEnding) {
          console.log('🚨🚨🚨 SKIPPING checkLevelEnd - _isLastMerge flag is TRUE or busyEnding is true (clean board flow in progress)');
          return;
        }
        
        // 🔥 CRITICAL BUG FIX: Don't wait for bubbles animation - it's just visual and shouldn't block end game check
        // Bubbles animation can run for 4+ seconds, which would delay fail screen detection
        // Instead, check end game immediately after spawn completes (with small delay for spawn animations)
        // This ensures stuck positions are detected even if user makes quick second merge during bubbles animation
        console.log('⏳ Waiting 500ms after spawn animations to let user see board state (bubbles animation continues in background)...');
        await new Promise(res => setTimeout(res, 500));
        
        // 🔥 CRITICAL: Check end game after spawn completes (with delay to allow animations)
        // Use checkLevelEnd which already has proper delay and handles all edge cases
        // This replaces the inline setTimeout check to avoid duplicate checks
        // NOTE: Bubbles animation continues in background - it doesn't block end game detection
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
  
  // 🔥 CRITICAL FIX: Ensure tiles array is fully updated before checking
  // After merge completes, tiles array might still be updating
  // Wait a bit to ensure all tile state updates are complete
  await new Promise(res => setTimeout(res, 100));
  
  const movesDepletedCheckContext: EndGameContext = {
    tiles,
    moves: 0,
    makeBoard
  };
  
  // 🔥 CRITICAL: Use forceRefresh for moves depleted check
  const movesDepletedCheckResult = checkEndGame(movesDepletedCheckContext, true);
  
  console.log('🔍 checkMovesDepleted: End game check result:', {
    type: movesDepletedCheckResult.type,
    reason: movesDepletedCheckResult.reason,
    activeTilesCount: tiles.filter(tileIsActive).length,
    activeTiles: tiles.filter(tileIsActive).map(t => ({ 
      value: t.value, 
      special: t.special, 
      stackDepth: (t as any).stackDepth || 1,
      locked: t.locked
    }))
  });
  
  if (movesDepletedCheckResult.type === 'stuck') {
    console.log('🚨🚨🚨 MOVES DEPLETED + GAME STUCK');
    if (!busyEnding) {
      // 🔥 USER REQUEST: 1.5 seconds delay before showing fail screen
      // This gives player time to see the board and all calculations to complete
      console.log('⏳ Waiting 1.5 seconds before showing fail screen so user can see board state...');
      await new Promise(res => setTimeout(res, 1500));
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
    
    // 🔥 CRITICAL FIX: Skip check if _isLastMerge flag is set on any merge-6 tile (clean board flow in progress)
    // This prevents fail screen from triggering when clean board flow is in progress
    const hasLastMergeTile = tiles.some((t: any) => t && !t.destroyed && t.value === 6 && (t as any)?._isLastMerge === true);
    if (hasLastMergeTile) {
      console.log('⏳ checkLevelEnd skipped - _isLastMerge flag detected on merge-6 tile (clean board flow in progress)');
      checkLevelEndRetryCount = 0; // Reset on exit
      return;
    }
    
    console.log('🎯 checkLevelEnd called - using centralized end game checker...');
    const now = Date.now();
    const skipWindowExceeded = checkLevelEndSkipStartedAt !== null && (now - checkLevelEndSkipStartedAt) > MAX_CHECK_LEVEL_END_SKIP_MS;
    
    // 🔥 CRITICAL BUG FIX: Don't skip check if bubbles animation is running - it's just visual
    // Bubbles animation can run for 4+ seconds and shouldn't block end game detection
    // This fixes the bug where user makes quick second merge during bubbles animation and gets stuck position
    const bubblesRunning = isWildBeerExplosionRunning();
    if (bubblesRunning) {
      console.log('💧 Bubbles animation is running, but continuing with end game check (bubbles are visual only, don\'t block detection)');
    }
    
    // 🔥 CRITICAL: Skip check if wild spawn is in progress (animation not finished yet)
    if (wildSpawnInProgress && !skipWindowExceeded) {
      if (checkLevelEndSkipStartedAt === null) checkLevelEndSkipStartedAt = now;
      checkLevelEndRetryCount++;
      console.log('⏳ checkLevelEnd skipped - wild spawn animation in progress (retry', checkLevelEndRetryCount, '/', MAX_CHECK_LEVEL_END_RETRIES, ')');
      
      // 🔥 v38: Check max retries to prevent infinite loop
      if (checkLevelEndRetryCount > MAX_CHECK_LEVEL_END_RETRIES) {
        console.error('🚨 checkLevelEnd: Max retries exceeded for wild spawn - forcing check anyway');
        checkLevelEndRetryCount = 0;
        checkLevelEndSkipStartedAt = null;
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
    if (wildSpawnInProgress && skipWindowExceeded) {
      console.warn('⏱️ checkLevelEnd: Skip window exceeded for wild spawn - forcing check despite flag');
      checkLevelEndRetryCount = 0;
      checkLevelEndSkipStartedAt = null;
    }
    
    // 🔥 CRITICAL FIX: Skip check if there are LOCKED tiles with value > 0 (spawn animations in progress)
    // This prevents premature fail screen when tiles are still being spawned/animated
    // 🔥 CRITICAL FIX: Exclude wild-beer tiles from locked check - bubbles animation doesn't mean tile is locked
    // Wild-beer bubbles animation is visual only and shouldn't block endgame detection
    const lockedActiveTiles = tiles.filter((t: any) => {
      if (!t || t.destroyed) return false;
      if (!t.locked) return false; // Only check locked tiles
      // 🔥 CRITICAL FIX: Exclude wild-beer from locked check - bubbles animation is visual only
      if (t.special === 'wild-beer') return false; // Wild-beer bubbles don't block endgame check
      return (t.value|0) > 0 || t.special === 'wild' || t.special === 'wild-magnet';
    });
    
    // 🔥 USER BUG FIX: Also check for tiles that are still being spawned (not yet interactive)
    // This prevents fail screen when user tries to merge tiles that just spawned after magnet
    // Tiles that are still spawning may not have eventMode='static' yet or may have _isBeingSpawned flag
    const tilesStillSpawning = tiles.filter((t: any) => {
      if (!t || t.destroyed) return false;
      if (t.locked) return true; // Locked tiles are still spawning
      // Check if tile is still being spawned (animation in progress)
      if (t._isBeingSpawned === true) return true;
      // Check if tile doesn't have eventMode='static' yet (not interactive)
      if (t.eventMode !== 'static' && (t.value|0) > 0) {
        // Wild tiles might not have eventMode set immediately, so check if tile is actually active
        const isWildTile = t.special === 'wild' || t.special === 'wild-magnet' || t.special === 'wild-beer';
        // Only consider it as "still spawning" if it's a regular tile without eventMode
        if (!isWildTile) return true;
      }
      return false;
    });
    
    // Combine both checks - if any tiles are locked or still spawning, wait
    const tilesNotReady = lockedActiveTiles.length > 0 || tilesStillSpawning.length > 0;
    
    if (tilesNotReady && !skipWindowExceeded) {
      if (checkLevelEndSkipStartedAt === null) checkLevelEndSkipStartedAt = now;
      checkLevelEndRetryCount++;
      console.log('⏳ checkLevelEnd skipped - tiles still spawning/animating (retry', checkLevelEndRetryCount, '/', MAX_CHECK_LEVEL_END_RETRIES, '):', {
        lockedCount: lockedActiveTiles.length,
        stillSpawningCount: tilesStillSpawning.length,
        lockedTiles: lockedActiveTiles.map(t => ({ value: t.value, special: t.special, gridX: t.gridX, gridY: t.gridY })),
        spawningTiles: tilesStillSpawning.map(t => ({ 
          value: t.value, 
          special: t.special, 
          gridX: t.gridX, 
          gridY: t.gridY, 
          locked: t.locked,
          eventMode: t.eventMode,
          isBeingSpawned: t._isBeingSpawned
        }))
      });
      
      // 🔥 v38: Check max retries to prevent infinite loop
      if (checkLevelEndRetryCount > MAX_CHECK_LEVEL_END_RETRIES) {
        console.error('🚨 checkLevelEnd: Max retries exceeded for locked tiles - forcing check anyway');
        console.error('🚨 WARNING: Tiles still locked:', lockedActiveTiles.map(t => ({ value: t.value, locked: t.locked })));
        checkLevelEndRetryCount = 0;
        checkLevelEndSkipStartedAt = null;
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
    if (tilesNotReady && skipWindowExceeded) {
      console.warn('⏱️ checkLevelEnd: Skip window exceeded for locked/spawning tiles - forcing check despite locks/spawns');
      console.warn('⏱️ WARNING: Some tiles may still be spawning:', {
        lockedCount: lockedActiveTiles.length,
        stillSpawningCount: tilesStillSpawning.length
      });
      checkLevelEndRetryCount = 0;
      checkLevelEndSkipStartedAt = null;
    }
    
    // 🔥 v38: Reset retry counter after successful reschedule bypass (tiles no longer locked/spawn done)
    checkLevelEndRetryCount = 0;
    checkLevelEndSkipStartedAt = null;
    
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
    
    // 🔥 USER BUG FIX: Don't trigger clean board flow if game is hidden (user is on homepage/other screens)
    // This prevents clean board modal from appearing when user navigates away from game
    const appElement = document.getElementById('app');
    const homeElement = document.getElementById('home');
    const isGameHidden = appElement && appElement.hasAttribute('hidden');
    const isHomepageVisible = homeElement && !homeElement.hidden;
    
    if (isGameHidden || isHomepageVisible) {
      console.log('⏳ checkLevelEnd skipped - game is hidden or homepage is visible (user navigated away from game)');
      return;
    }
    
    if (checkLevelEndResult.type === 'clean') {
      const wildReady = wildMeter >= 1 || wildSpawnInProgress || wildSpawnRetryTimer !== null;
      if (wildReady) {
        console.log('⚠️ checkLevelEnd: Clean board detected but wild meter is ready/spawning – deferring clean board flow until wild cube drops');
        queueWildSpawnIfNeeded();
      return;
    }
      
      // 🔥 CRITICAL FIX: Check if there are unlocked mergeable tiles on board
      // If there are unlocked tiles (other than merge 6), it's NOT a clean board - user can still merge them
      const unlockedActiveTiles = tiles.filter((t: any) => {
        if (!t || t.destroyed) return false;
        if (t.locked) return false; // Only check unlocked tiles
        return (t.value|0) > 0 || t.special === 'wild' || t.special === 'wild-magnet';
      });
      
      // Check if there are more than 1 unlocked tile (merge 6 + other tiles = can merge)
      const hasUnlockedMergeableTiles = unlockedActiveTiles.length > 1;
      
      // 🔥 USER REQUEST v85: Check if unlocked tiles have potential for merge/stack
      // If anyMergePossible returns true → game continues (don't trigger clean board)
      // If anyMergePossible returns false → trigger clean board or fail screen
      // This ensures clean board is only triggered when no merges/stack are possible
      let hasMergeOrStackPotential = false;
      if (unlockedActiveTiles.length > 0 && makeBoard?.anyMergePossible) {
        // Check only with unlocked tiles (available for player to use)
        hasMergeOrStackPotential = makeBoard.anyMergePossible(unlockedActiveTiles);
        console.log('🧲 checkLevelEnd: anyMergePossible check with unlocked tiles:', {
          unlockedTilesCount: unlockedActiveTiles.length,
          hasMergeOrStackPotential,
          tiles: unlockedActiveTiles.map((t: any) => ({ value: t.value, special: t.special, locked: t.locked }))
        });
      }
      
      // 🔥 CRITICAL FIX: Check if there's a magnet on board that can be used for merge
      // If magnet exists, it's NOT a clean board - user can still merge magnet with merge 6
      const activeTiles = tiles.filter((t: any) => {
        if (!t || t.destroyed) return false;
        if (t.locked && (t.value|0) <= 0) return false; // Ghost placeholder
        return (t.value|0) > 0 || t.special === 'wild' || t.special === 'wild-magnet';
      });
      const hasMagnet = activeTiles.some((t: any) => t.special === 'wild-magnet');
      
      // 🔥 USER REQUEST: If unlocked tiles have merge/stack potential → game continues
      if (hasMergeOrStackPotential) {
        console.log('✅ checkLevelEnd: Unlocked tiles have merge/stack potential - game continues, NOT triggering clean board');
        return; // Don't trigger clean board - game continues
      }
      
      if (hasUnlockedMergeableTiles && !hasMergeOrStackPotential) {
        console.log('🧲 checkLevelEnd: Unlocked mergeable tiles detected but no merge/stack potential - will check stuck in checkEndGame');
        // Continue to checkEndGame which will check stuck and show fail screen if needed
      }
      
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
      console.log('🚨🚨🚨 checkLevelEnd: Game is stuck, checking anyMergePossible before showing fail screen');
      console.log('🔍 checkLevelEnd: Stuck reason:', checkLevelEndResult.reason);
      console.log('🔍 checkLevelEnd: Current tiles:', tiles.filter(tileIsActive).map(t => ({ 
        value: t.value, 
        special: t.special, 
        locked: t.locked 
      })));
      
      // 🔥 REFACTORED: Uklonjena redundancija - checkEndGame() već poziva anyMergePossible() kroz isGameStuck()
      // Ako checkEndGame() vraća 'stuck', znači da anyMergePossible() već vratio false
      // Nema potrebe za dodatnom provjerom
      
      if (!busyEnding) {
        // 🔥 USER REQUEST: 1.5 seconds delay before showing fail screen
        // This gives player time to see the board and all calculations to complete
        // This prevents instant fail screen when board becomes non-mergable (e.g. after wild spawn)
        console.log('⏳ Waiting 1.5 seconds before showing fail screen so user can see board state...');
        await new Promise(res => setTimeout(res, 1500));
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
  // 🔥 CRITICAL: Don't await - spawn tiles in parallel, let animations run concurrently
  // openLockedBounceParallel now uses setTimeout instead of await, so Promise resolves immediately
  // This allows tiles to spawn at the correct delays (0ms, 30ms, 60ms, 90ms) without waiting for previous animations
  FLOW.openLockedBounceParallel({ tiles, k, drag, makeBoard, gsap, drawBoardBG, TILE, fixHoverAnchor, spawnBounce: (t, done, o)=>SPAWN.spawnBounce(t, gsap, o, done) }).then(() => {
    console.log('✅ openLockedBounceParallel completed - all spawn animations scheduled');
  }).catch((err) => {
    console.warn('⚠️ openLockedBounceParallel failed:', err);
  });
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
    // 🔥 REMOVED: Fallback to showStarsModal - this old "Level Complete" overlay is deprecated
    // If board-fail-modal fails, log error but don't show the old overlay
    console.error('❌ CRITICAL: Board fail modal failed - cannot show fail screen:', error);
    console.error('❌ This should never happen. Check board-fail-modal.js for errors.');
    // Don't show old stars modal - it's deprecated and shows wrong UI
  }

  // CRITICAL: Update high score using statsService
  statsService.updateHighScore(score);
  updateHUD();

  if (result?.action === 'menu') {
    try {
      // Navigation will be shown by markHomepageVisible() after slide animation
      // exitToMenu will handle returning to correct slide (Journey or homepage)
      await window.exitToMenu?.();
      // Don't call goToSlide here - exitToMenu handles it
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
    
    // 🔥 CRITICAL: Stop tile idle bounce animations
    try {
      if (TILE_IDLE_BOUNCE && typeof TILE_IDLE_BOUNCE.stop === 'function') {
        TILE_IDLE_BOUNCE.stop();
        console.log('✅ RESTART GAME: Tile idle bounce stopped');
      }
    } catch (e) {
      console.warn('⚠️ RESTART GAME: Error stopping tile idle bounce:', e);
    }
    
    // 🔥 CRITICAL: Cleanup combo animations
    try {
      if (typeof HUD.cleanupComboAnimations === 'function') {
        HUD.cleanupComboAnimations();
        console.log('✅ RESTART GAME: Combo animations cleaned up');
      }
    } catch (e) {
      console.warn('⚠️ RESTART GAME: Error cleaning up combo animations:', e);
    }
    
    // 🔥 CRITICAL: Kill combo idle timer
    try { 
      comboIdleTimer?.kill?.(); 
      comboIdleTimer = null;
      console.log('✅ RESTART GAME: Combo idle timer killed');
    } catch (e) {
      console.warn('⚠️ RESTART GAME: Error killing combo idle timer:', e);
    }
    
    // 🔥 CRITICAL: Stop wild loader animations
    gsap.killTweensOf(wild?.view?._fill);
    gsap.killTweensOf({ width: 0 });
    if (wild?.view?._currentAnimation) {
      wild.view._currentAnimation.kill();
      wild.view._currentAnimation = null;
    }
    
    // 🔥 CRITICAL: Kill HUD progress bar animations
    try {
      gsap.killTweensOf('[data-wild-loader]');
      gsap.killTweensOf('.wild-loader');
      if (wild && wild.view) {
        gsap.killTweensOf(wild.view);
        if (wild.view._fill) {
          gsap.killTweensOf(wild.view._fill);
        }
        if (wild.view._mask) {
          gsap.killTweensOf(wild.view._mask);
        }
      }
      console.log('✅ RESTART GAME: HUD progress bar animations killed');
    } catch (e) {
      console.warn('⚠️ RESTART GAME: Error killing HUD progress bar animations:', e);
    }
    
    // CRITICAL: Kill tile animations before destroying them
    if (STATE && STATE.tiles && STATE.tiles.length > 0) {
      console.log('🔄 RESTART GAME: Killing GSAP animations for', STATE.tiles.length, 'tiles...');
      STATE.tiles.forEach(tile => {
        try {
          // 🔥 CRITICAL: Stop all wild animations
          try { stopWildIdle?.(tile); } catch {}
          try { stopWildShimmer?.(tile); } catch {}
          try { stopWildStars?.(tile); } catch {}
          try { stopWildBeerBubbles?.(tile); } catch {}
          try { stopMagnetIdleParticles?.(tile); } catch {}
          
          // 🔥 CRITICAL: Kill all GSAP tweens
          if (tile && tile.scale) {
            gsap.killTweensOf(tile.scale);
          }
          if (tile) {
            gsap.killTweensOf(tile);
            gsap.killTweensOf(tile.rotation);
            // Kill glow animations
            if ((tile as any)._glowAnimation) {
              (tile as any)._glowAnimation.kill();
              (tile as any)._glowAnimation = null;
            }
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
  
  // 🔥 USER REQUEST: Keep current boardNumber (don't reset to 1)
  // This ensures Play Again restarts the same board, not board 1
  const currentBoard = boardNumber || 1;
  console.log(`🔄 RESTART: Keeping current board ${currentBoard} (not resetting to 1)`);
  
  // Reset game state WITHOUT touching HUD positioning or boardNumber
  score = 0;
  // boardNumber stays the same - don't reset to 1!
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
  
  // 🔥 CRITICAL FIX: Clear saved game state from localStorage before restarting
  // This ensures we get a FRESH board, not the stuck/failed state
  try {
    localStorage.removeItem('cc_saved_game');
    console.log('✅ RESTART: Cleared stuck game state from localStorage');
  } catch (e) {
    console.warn('⚠️ RESTART: Failed to clear localStorage:', e);
  }
  
  // 🔥 CRITICAL FIX: Clear __ccSkipRebuildBoard flag to force fresh board
  delete (window as any).__ccSkipRebuildBoard;
  console.log('✅ RESTART: Cleared __ccSkipRebuildBoard flag - will rebuild fresh board');
  
  // 🔥 USER REQUEST: Call startLevel() with current boardNumber instead of just rebuildBoard()
  // This ensures board-specific rules are applied and the correct board is restarted
  console.log(`🔄 RESTART: Calling startLevel(${currentBoard}) to restart board ${currentBoard}...`);
  startLevel(currentBoard);
  console.log(`✅ RESTART: startLevel(${currentBoard}) completed`);
  
  // Reinitialize background layer if it was lost
  if (!backgroundLayer) {
    console.log('🔄 RESTART: Reinitializing background layer...');
    initializeBackgroundLayer();
    console.log('✅ RESTART: Background layer reinitialized');
  }
  
  updateHUD();
  
  // 🔥 OPTIMIZATION: Clear all tracked timeouts before restart
  clearAllAppTimeouts();
  
  // 🔥 OPTIMIZATION: Kill all GSAP delayed calls before restart
  try {
    if (typeof killAllDelayedCalls === 'function') {
      killAllDelayedCalls();
    } else {
      try { gsap.killDelayedCalls(); } catch {}
    }
  } catch {}
  
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
  
  // 🔥 JOURNEY PROGRESSION: Update state when restarting (retry after failure)
  // Keep lastOpenedBoardId and set currentRunState for the same board
  try {
    import('./journey-progression-state.js').then(({ journeyProgressionState }) => {
      const currentBoardId = boardNumber || 1;
      journeyProgressionState.setLastOpenedBoardId(currentBoardId);
      journeyProgressionState.setCurrentRunState(currentBoardId, 0);
      console.log(`🗺️ Journey: Restarting board ${currentBoardId} - lastOpenedBoardId and currentRunState updated`);
    }).catch((error) => {
      console.warn('⚠️ Failed to update Journey progression state on restart:', error);
    });
  } catch (error) {
    console.warn('⚠️ Failed to update Journey progression state on restart:', error);
  }
  
  // 🔥 OPTIMIZATION: Clear all tracked timeouts before restart
  clearAllAppTimeouts();
  
  // 🔥 OPTIMIZATION: Kill all GSAP delayed calls before restart
  try {
    if (typeof killAllDelayedCalls === 'function') {
      killAllDelayedCalls();
    } else {
      try { gsap.killDelayedCalls(); } catch {}
    }
  } catch {}
  
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
  
  // 🔥 CRITICAL FIX: Reset star count when restarting from end game bottom sheet
  try {
    console.log('🔄 RESTART: Resetting star count...');
    // Reset stars collector via window.CC.setStarsCount (exported above)
    if (typeof (window as any).CC?.setStarsCount === 'function') {
      (window as any).CC.setStarsCount(0);
      console.log('✅ RESTART: Star count reset to 0');
    } else {
      // Fallback: try to import and reset directly
      import('./stars-collector.js').then((StarsCollector) => {
        if (typeof StarsCollector.setStarsCount === 'function') {
          StarsCollector.setStarsCount(0);
          console.log('✅ RESTART: Star count reset to 0 (via import)');
        }
      }).catch((err) => {
        console.warn('⚠️ RESTART: Failed to reset star count:', err);
      });
    }
  } catch (error) {
    console.warn('⚠️ RESTART: Error resetting star count:', error);
  }
  
  console.log('🔄 RESTART: About to call restartGame()...');
  restartGame();
  console.log('✅ RESTART: restartGame() completed');
}

// Clean up game when exiting
export function cleanupGame() {
  console.log('🧹 Cleaning up game state');
  
  // 🔥 CRITICAL FIX: Stop and reset tile idle bounce animations
  try {
    TILE_IDLE_BOUNCE.stop();
    if (TILE_IDLE_BOUNCE.reset) {
      TILE_IDLE_BOUNCE.reset();
    }
    console.log('✅ Tile idle bounce stopped and reset');
  } catch (error) {
    console.warn('⚠️ Failed to stop/reset tile idle bounce:', error);
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
  
  // 🔥 CRITICAL FIX: Kill all GSAP tweens BEFORE destroying objects
  // This prevents "Cannot read properties of null (reading 'y')" errors
  try {
    // Kill UI element tweens
    gsap.killTweensOf("[data-wild-loader]");
    gsap.killTweensOf(".wild-loader");
    gsap.killTweensOf("p");
    gsap.killTweensOf("progress");
    gsap.killTweensOf("ratio");
    
    // CRITICAL: Kill PIXI object tweens (tiles and HUD) with null checks
    // Kill all tile tweens BEFORE destroying tiles
    if (tiles && tiles.length > 0) {
      tiles.forEach(tile => {
        try {
          // Check if tile exists and is not destroyed before killing tweens
          if (tile && !tile.destroyed) {
            if (tile.scale && !tile.scale.destroyed) {
              gsap.killTweensOf(tile.scale);
            }
            // Kill tweens on tile itself (x, y, alpha, etc.)
            gsap.killTweensOf(tile);
            // Also kill tweens on tile properties that might be animated
            if (tile.hover && !tile.hover.destroyed) {
              gsap.killTweensOf(tile.hover);
            }
          }
        } catch (e) {
          // Ignore errors for already destroyed tiles
        }
      });
    }
    
    // Kill HUD tweens with null checks
    if (HUD && !HUD.destroyed) {
      try {
        gsap.killTweensOf(HUD);
      } catch (e) {
        // Ignore errors
      }
    }
    if (board && !board.destroyed) {
      try {
        gsap.killTweensOf(board);
      } catch (e) {
        // Ignore errors
      }
    }
    if (app && app.stage && !app.stage.destroyed) {
      try {
        gsap.killTweensOf(app.stage);
      } catch (e) {
        // Ignore errors
      }
    }
    if (backgroundLayer && !backgroundLayer.destroyed) {
      try {
        gsap.killTweensOf(backgroundLayer);
      } catch (e) {
        // Ignore errors
      }
    }
    
    // CRITICAL: Kill all GSAP timelines that might reference destroyed objects
    try {
      // Get all active tweens and kill them if their target is destroyed
      const allTweens = gsap.globalTimeline.getChildren();
      allTweens.forEach((tween: any) => {
        try {
          const targets = tween.targets || [];
          if (targets.length > 0) {
            const target = targets[0];
            if (target && (target.destroyed || target === null || target === undefined)) {
              tween.kill();
            }
          }
        } catch (e) {
          // Ignore errors
        }
      });
    } catch (e) {
      // Ignore errors
    }
    
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
  
  // 🔥 CRITICAL FIX: Clear all tracked timeouts
  clearAllAppTimeouts();
  
  // 🔥 CRITICAL FIX: Remove event listeners properly
  try { 
    window.removeEventListener('resize', layoutBoard); 
  } catch (e) {
    console.warn('⚠️ Failed to remove resize listener:', e);
  }
  try { 
    window.removeEventListener('resize', layout); 
  } catch (e) {
    console.warn('⚠️ Failed to remove layout listener:', e);
  }
  
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
  
  // 🔥 CRITICAL FIX: Cleanup background layer BEFORE clearing board
  if (backgroundLayer) {
    try {
      if (board && board.children.includes(backgroundLayer)) {
        board.removeChild(backgroundLayer);
        console.log('✅ Background layer removed from board');
      }
      backgroundLayer.destroy({ children: true });
      console.log('✅ Background layer destroyed');
    } catch (e) {
      console.warn('⚠️ Error destroying background layer:', e);
    }
    backgroundLayer = null; // 🔥 CRITICAL: Nullify reference to prevent memory leak
    console.log('✅ Background layer reference nullified');
  }
  
  // 🔥 CRITICAL FIX: Clear window global variables to prevent memory leaks
  try {
    window._ghostPlaceholders = null;
    window._userMadeMove = false;
    window._gameHasEnded = false;
    console.log('✅ Window global variables cleared');
  } catch (e) {
    console.warn('⚠️ Failed to clear window globals:', e);
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
  
  // 🔥 CRITICAL FIX: Stop memory manager interval before destroying app
  try {
    memoryManager.stop();
    console.log('✅ Memory manager stopped');
  } catch (e) {
    console.warn('⚠️ Failed to stop memory manager:', e);
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
  
  // 🔥 CRITICAL FIX: Clear HUD_ROOT reference if it exists
  try {
    const hudRoot = (window as any).HUD_ROOT;
    if (hudRoot) {
      try {
        if (hudRoot.parent) {
          hudRoot.parent.removeChild(hudRoot);
        }
        if (typeof hudRoot.destroy === 'function') {
          hudRoot.destroy({ children: true });
        }
      } catch {}
      (window as any).HUD_ROOT = null;
      console.log('✅ HUD_ROOT reference cleared');
    }
  } catch (e) {
    console.warn('⚠️ Failed to clear HUD_ROOT:', e);
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
    
    // 🔥 CRITICAL FIX: Save all tiles from tiles array, not just from grid
    // This ensures no tiles are lost during save (e.g., tiles with inconsistent grid positions)
    const gridSnapshot = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    
    // First, save all tiles from tiles array (both active and locked tiles)
    const savedTiles = [];
    tiles.forEach((tile) => {
      if (!tile || tile.destroyed) {
        return; // Skip destroyed tiles only
      }
      
      // Only skip tiles with invalid value (null, undefined, NaN, negative)
      // Allow value 0 for locked/empty tiles
      const tileValue = tile.value;
      if (tileValue === null || tileValue === undefined || !Number.isFinite(tileValue) || tileValue < 0) {
        return; // Skip tiles with invalid value
      }
      
      const gridX = Number.isFinite(tile.gridX) ? (tile.gridX | 0) : -1;
      const gridY = Number.isFinite(tile.gridY) ? (tile.gridY | 0) : -1;
      
      // Validate grid position
      if (gridX < 0 || gridX >= COLS || gridY < 0 || gridY >= ROWS) {
        console.warn('⚠️ Tile has invalid grid position:', { gridX, gridY, value: tile.value, special: tile.special, locked: tile.locked });
        return;
      }
      
      const tileSnapshot = {
        value: Number.isFinite(tileValue) ? tileValue : 0,
        special: tile.special || null,
        locked: !!tile.locked,
        open: !tile.locked,
        isWild: !!tile.isWild,
        isWildFace: !!tile.isWildFace,
        gridX: gridX,
        gridY: gridY,
      };
      
      savedTiles.push({ snapshot: tileSnapshot, gridX, gridY });
      
      // Also place in grid snapshot at correct position
      // If position already occupied, log warning but still save (might be duplicate)
      if (gridSnapshot[gridY] && gridSnapshot[gridY][gridX] === null) {
        gridSnapshot[gridY][gridX] = tileSnapshot;
      } else if (gridSnapshot[gridY] && gridSnapshot[gridY][gridX] !== null) {
        console.warn('⚠️ Grid position already occupied - overwriting:', { gridX, gridY, existing: gridSnapshot[gridY][gridX], new: tileSnapshot });
        gridSnapshot[gridY][gridX] = tileSnapshot; // Overwrite to ensure latest tile is saved
      }
    });
    
    // 🔥 ADDITIONAL FIX: Also check grid array for any tiles that might not be in tiles array
    // This ensures we don't lose tiles even if there's a mismatch between grid and tiles array
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const gridTile = grid[r]?.[c];
        if (!gridTile || gridTile.destroyed) continue;
        
        // Check if this tile is already saved
        const alreadySaved = savedTiles.some(st => st.gridX === c && st.gridY === r);
        if (alreadySaved) continue;
        
        // Check if tile has valid value
        const tileValue = gridTile.value;
        if (tileValue === null || tileValue === undefined || !Number.isFinite(tileValue) || tileValue < 0) {
          continue;
        }
        
        // Save tile from grid
        const tileSnapshot = {
          value: Number.isFinite(tileValue) ? tileValue : 0,
          special: gridTile.special || null,
          locked: !!gridTile.locked,
          open: !gridTile.locked,
          isWild: !!gridTile.isWild,
          isWildFace: !!gridTile.isWildFace,
          gridX: c,
          gridY: r,
        };
        
        savedTiles.push({ snapshot: tileSnapshot, gridX: c, gridY: r });
        if (gridSnapshot[r] && gridSnapshot[r][c] === null) {
          gridSnapshot[r][c] = tileSnapshot;
        } else if (gridSnapshot[r] && gridSnapshot[r][c] !== null) {
          console.warn('⚠️ Grid tile already saved - overwriting:', { gridX: c, gridY: r, existing: gridSnapshot[r][c], new: tileSnapshot });
          gridSnapshot[r][c] = tileSnapshot;
        }
      }
    }
    
    console.log('💾 Saved', savedTiles.length, 'tiles total (from tiles array + grid check)');

    // 🔥 CRITICAL FIX: Get stars count from stars collector before saving
    let savedStarsCount = 0;
    try {
      if (typeof StarsCollector.getStarsCount === 'function') {
        savedStarsCount = StarsCollector.getStarsCount();
        console.log('💾 Saving stars count:', savedStarsCount);
      } else {
        console.warn('⚠️ StarsCollector.getStarsCount not available, defaulting to 0');
      }
    } catch (error) {
      console.warn('⚠️ Failed to get stars count for save:', error);
    }

    const currentState = {
      grid: gridSnapshot,
      score: Number.isFinite(score) ? score : 0,
      level: Number.isFinite(level) ? level : 1,
      boardNumber: Number.isFinite(boardNumber) ? boardNumber : Number.isFinite(level) ? level : 1,
      moves: Number.isFinite(moves) ? moves : MOVES_MAX,
      wildMeter: Number.isFinite(wildMeter) ? wildMeter : 0,
      bestScore: Number.isFinite(STATE.bestScore) ? STATE.bestScore : 0,
      starsCount: Number.isFinite(savedStarsCount) ? savedStarsCount : 0, // 🔥 CRITICAL FIX: Save stars count
      timestamp: Date.now(),
    };

    console.log('💾 Saving game state:', {
      gridRows: currentState.grid.length,
      gridCols: currentState.grid[0]?.length || 0,
      score: currentState.score,
      level: currentState.level,
      boardNumber: currentState.boardNumber, // 🔥 USER BUG FIX: Log boardNumber in save
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

    // 🔥 USER BUG FIX: Log boardNumber from saved state
    console.log('📊 Game state:', { 
      score: gameState.score, 
      level: gameState.level, 
      boardNumber: gameState.boardNumber,
      moves: gameState.moves 
    });

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
      layoutBoard();
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
        layoutBoard();
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

    // 🔥 CRITICAL FIX: Update ghost visibility AFTER loading all tiles
    // This ensures ghost placeholders are hidden where tiles exist
    try {
      if (typeof window.updateGhostVisibility === 'function') {
        window.updateGhostVisibility();
        console.log('✅ loadGameState: Ghost visibility updated after loading tiles');
      } else {
        updateGhostVisibility();
        console.log('✅ loadGameState: Ghost visibility updated (fallback)');
      }
    } catch (e) {
      console.warn('⚠️ loadGameState: Failed to update ghost visibility:', e);
    }

    board?.sortChildren?.();

    score = Number.isFinite(gameState.score) ? gameState.score : 0;
    level = Number.isFinite(gameState.level) ? gameState.level : 1;
    // 🔥 USER BUG FIX: Prioritize boardNumber from saved state, fallback to level
    // This ensures boardNumber is correctly restored from saved game state
    boardNumber = Number.isFinite(gameState.boardNumber) ? gameState.boardNumber : (Number.isFinite(gameState.level) ? gameState.level : 1);
    moves = Number.isFinite(gameState.moves) ? gameState.moves : MOVES_MAX;
    wildMeter = Number.isFinite(gameState.wildMeter) ? gameState.wildMeter : 0;
    
    // 🔥 USER BUG FIX: Log restored boardNumber for debugging
    console.log('📊 loadGameState: Restored state - boardNumber:', boardNumber, 'level:', level, 'score:', score, 'moves:', moves);

    if (Number.isFinite(gameState.bestScore)) {
      STATE.bestScore = gameState.bestScore;
    }

    // 🔥 CRITICAL FIX: Save stars count BEFORE layoutBoard (which may reset it)
    const savedStarsCount = Number.isFinite(gameState.starsCount) ? gameState.starsCount : 0;
    console.log('💾 Will restore stars count after HUD initialization:', savedStarsCount);

    // 🔥 CRITICAL FIX: Sync state BEFORE updating HUD to ensure boardNumber is set correctly
    syncSharedState();
    
    // 🔥 CRITICAL FIX: Update board-specific rules with the restored board number
    // This ensures board-specific logic uses the correct board number
    if (typeof boardSpecificRules !== 'undefined' && boardSpecificRules.setCurrentBoard) {
      boardSpecificRules.setCurrentBoard(boardNumber);
      console.log('🎯 loadGameState: Set board-specific rules to board', boardNumber);
    }
    
    // CRITICAL: Draw ghost placeholders BEFORE HUD update
    drawBoardBG('active+empty');
    
    // CRITICAL: Call layout to position HUD correctly (this initializes stars collector)
    layoutBoard();
    console.log('✅ Layout called for saved game - HUD should be positioned');
    
    // 🔥 CRITICAL FIX: Restore stars count AFTER layoutBoard (which initializes stars collector)
    // This ensures stars collector is initialized before we try to set the count
    try {
      if (typeof StarsCollector.setStarsCount === 'function') {
        StarsCollector.setStarsCount(savedStarsCount);
        console.log('💾 Restored stars count from saved game:', savedStarsCount);
        
        // 🔥 CRITICAL: Also update HUD display immediately after restoring stars count
        if (typeof HUD.setStarsCount === 'function') {
          HUD.setStarsCount(savedStarsCount);
          console.log('💾 Updated HUD star count display:', savedStarsCount);
        }
      } else {
        console.warn('⚠️ StarsCollector.setStarsCount not available, stars count not restored');
      }
    } catch (error) {
      console.warn('⚠️ Failed to restore stars count from saved game:', error);
    }
    
    // CRITICAL: Ensure HUD is visible
    if (hud) {
      hud.visible = true;
      hud.alpha = 1;
      console.log('🔍 HUD check: visible?', hud.visible, 'alpha:', hud.alpha, 'children:', hud.children.length, 'parent:', hud.parent?.constructor.name);
    }
    
      // 🔥 CRITICAL FIX: Always trigger HUD drop animation when loading saved state
      // Use next-paint + forceRestart so it is actually visible on iPhone (otherwise it can run before first frame)
    try {
      // Check if HUD drop is pending (should be true after cleanup)
      if (_hudDropPending) {
        console.log('🎯 HUD drop pending - triggering drop animation');
        if (typeof HUD.playHudDrop === 'function') {
            requestAnimationFrame(() => requestAnimationFrame(() => {
              // 🔥 CRITICAL: Show canvas now that HUD is ready to drop
              if (app && app.canvas) {
                app.canvas.style.opacity = '1';
                app.canvas.style.transition = 'opacity 0.3s ease';
                console.log('✅ Canvas shown - HUD drop starting');
              }
              HUD.playHudDrop({ forceRestart: true });
              _hudDropPending = false; // clear only once drop actually starts (prevents 1-frame "already dropped" flash)
              console.log('✅ HUD drop started (next paint, forceRestart)');
            }));
        }
      } else {
        // If not pending, still ensure HUD is visible and positioned correctly
        console.log('🎯 HUD drop not pending - ensuring HUD is visible');
        if (HUD_ROOT) {
          const top = HUD_ROOT._dropTop ?? 44;
          HUD_ROOT.y = top;
          HUD_ROOT.alpha = 1;
          HUD_ROOT.visible = true;
          HUD_ROOT._dropped = true;
          console.log('✅ HUD positioned and made visible');
        }
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
            requestAnimationFrame(() => requestAnimationFrame(() => {
              // 🔥 CRITICAL: Show canvas now that HUD is ready to drop
              if (app && app.canvas) {
                app.canvas.style.opacity = '1';
                app.canvas.style.transition = 'opacity 0.3s ease';
              }
              HUD.playHudDrop({ forceRestart: true });
            }));
            console.log('✅ HUD drop animation scheduled after recreation (next paint, forceRestart)');
          }
        } catch (error) {
          console.error('❌ Failed to recreate DOM HUD:', error);
        }
      }
      
      // 🔥 CRITICAL FIX: Ensure HUD_ROOT is visible and positioned correctly
      // This is a fallback in case HUD drop animation doesn't work
      // HUD_ROOT is a local variable in hud-helpers.js, not on window
      // We need to access it via HUD object or check if it exists in the module
      try {
        // Try to get HUD_ROOT from window (exported from hud-helpers.js)
        const hudRoot = (window as any).HUD_ROOT || (HUD as any).HUD_ROOT || null;
        if (hudRoot) {
          const top = hudRoot._dropTop ?? 44;
          hudRoot.y = top;
          hudRoot.alpha = 1;
          hudRoot.visible = true;
          hudRoot._dropped = true;
          console.log('✅ HUD_ROOT positioned and made visible (fallback)');
        } else {
          console.warn('⚠️ HUD_ROOT not found - HUD may not be initialized yet');
        }
      } catch (e) {
        console.warn('⚠️ Failed to access HUD_ROOT:', e);
      }
      
      // 🔥 CRITICAL FIX: Board indicator animation is automatically triggered by playHudDrop
      // But we also need to ensure board indicator is visible
      try {
        const boardIndicator = document.getElementById('hud-board');
        if (boardIndicator) {
          boardIndicator.style.display = 'flex';
          boardIndicator.style.opacity = '1';
          boardIndicator.setAttribute('data-state', 'visible');
          console.log('✅ Board indicator made visible');
        }
      } catch (e) {
        console.warn('⚠️ Failed to show board indicator:', e);
      }
    } catch (error) {
      console.error('❌ Failed to trigger HUD animations:', error);
    }
    
    // 🔥 CRITICAL FIX: Update HUD AFTER boardNumber is restored and state is synced
    // This ensures HUD displays the correct board number
    updateHUD();
    console.log('✅ HUD updated with boardNumber:', boardNumber);
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
        // 🔥 CRITICAL FIX: Ensure HUD drop is triggered even if it wasn't triggered above
        // This is a fallback in case HUD drop wasn't triggered earlier
        if (_hudDropPending) {
          console.log('🎯 HUD drop still pending in onHalf - triggering now');
          try { 
            if (typeof HUD.playHudDrop === 'function') {
              requestAnimationFrame(() => requestAnimationFrame(() => {
                // 🔥 CRITICAL: Show canvas now that HUD is ready to drop
                if (app && app.canvas) {
                  app.canvas.style.opacity = '1';
                  app.canvas.style.transition = 'opacity 0.3s ease';
                }
                HUD.playHudDrop({ forceRestart: true });
              }));
              console.log('✅ HUD drop animation scheduled in onHalf callback (next paint, forceRestart)');
            }
          } catch (e) {
            console.warn('⚠️ Failed to trigger HUD drop in onHalf:', e);
          }
          _hudDropPending = false;
        }
      }
    }).then(() => {
      console.log('✅ Continue animation completed');
      
      // 🔥 CRITICAL FIX: Final check - ensure HUD is visible and positioned after animation
      try {
        const hudRoot = (window as any).HUD_ROOT || (HUD as any).HUD_ROOT || null;
        if (hudRoot) {
          const top = hudRoot._dropTop ?? 44;
          hudRoot.y = top;
          hudRoot.alpha = 1;
          hudRoot.visible = true;
          hudRoot._dropped = true;
          console.log('✅ HUD final position set after animation');
        }
      } catch (e) {
        console.warn('⚠️ Failed to access HUD_ROOT in loadGameState:', e);
      }
    });
    
    lastSavedState = localStorage.getItem('cc_saved_game');
    
    // 🔥 CRITICAL FIX: Check if tiles were actually loaded
    // If no tiles were restored, this means saved state was invalid/empty
    const tilesLoaded = tiles.length > 0;
    const hasActiveTiles = tiles.some(t => t && !t.locked && t.value > 0);
    
    if (!tilesLoaded || !hasActiveTiles) {
      console.warn('⚠️ loadGameState: No tiles loaded or no active tiles - saved state was invalid/empty');
      console.warn('⚠️ loadGameState: tiles.length =', tiles.length, 'hasActiveTiles =', hasActiveTiles);
      // Clear invalid saved state
      localStorage.removeItem('cc_saved_game');
      return false; // Return false so rebuildBoard() is called
    }
    
    console.log('✅ Game state loaded successfully with', tiles.length, 'tiles (', tiles.filter(t => t && !t.locked && t.value > 0).length, 'active)');
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
