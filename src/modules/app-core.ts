// public/src/modules/app.js
// ✅ mobile-first, cache-busted celebration & prize flow
// TODO: Remove @ts-nocheck after incremental typing cleanup

import { Application, Container, Assets, Graphics, Text, Rectangle, Texture, Sprite, SCALE_MODES } from 'pixi.js';
import { gsap } from 'gsap';

import {
  COLS, ROWS, TILE, GAP, HUD_H,
  ASSET_TILE, ASSET_NUMBERS, ASSET_NUMBERS2, ASSET_NUMBERS3, ASSET_NUMBERS4, ASSET_WILD, ASSET_WILD_MAGNET, ASSET_WILD_JUICE, ASSET_WILD_TNT
} from './constants.js';
import { sweetPopIn, sweetPopOut } from './app-board.ts';
import * as CONSTS from './constants.js';
import { STATE } from './app-state.ts';

import * as makeBoard from './board.ts';
import { installDrag } from './install-drag.ts';
import { glassCrackAtTile, woodShardsAtTile, spawnMerge6Shards, regularMerge6Shards, regularMerge6ShardsTemplated, wildMerge6ShardsTemplated, wildStarMerge6ShardsTemplated, wildJuiceMerge6ShardsTemplated, wildTntMerge6ShardsTemplated, wildMagnetMerge6ShardsTemplated, innerFlashAtTile, showMultiplierTile, smokeBubblesAtTile, screenShake, wildImpactEffect, startWildIdle, stopWildIdle, startWildShimmer, stopWildShimmer, startWildStars, stopWildStars, startWildJuiceBubbles, stopWildJuiceBubbles, startMagnetIdleParticles, stopMagnetIdleParticles, startTntIdleParticles, stopTntIdleParticles, startTntIdleShake, stopTntIdleShake, centerInBoard, killAllDelayedCalls, destroyAllGraphicsObjects, cleanupAllFxContainers, cleanupFxContainersByTag, waitForBubblesAnimationToComplete, waitForOngoingAnimations, cleanupExistingStarAnimations, forceCleanupAllStarAnimations, animateStarsToHudIcon } from './fx.ts';
import { showWildJuiceBubblesExplosion, stopWildJuiceBubblesExplosion, forceStopWildJuiceBubblesExplosion, isWildJuiceBubblesExplosionActive, isWildJuiceBubblesExplosionRecentlyStarted, destroyWildJuiceBubblesExplosionCache } from './wild-juice-bubbles-explosion.ts';
import { showMagneticText, isMagneticTextActive, waitForMagneticTextComplete, showSparkleText, stopSparkleText, isSparkleTextActive, showNoMovesText, exitNoMovesText, clearNoMovesText } from './splash-text-overlay.ts';
import { showTntAnimation, stopTntAnimation, onTntBoomExitComplete, onTntAnimationComplete, preloadTntFrames, isTntAnimationActive } from './tnt-animation.ts';
import { stopWildJuiceBubblesScreen, destroyWildJuiceBubblesScreenCache } from './wild-juice-bubbles-screen.ts';
import * as StarsCollector from './stars-collector.ts';
// 🔥 REMOVED: showStarsModal import - DEPRECATED, no longer used
// import { showStarsModal } from './stars-modal.js';
import { runEndgameFlow } from './endgame-flow.js';
import { heartsSystem } from './hearts-system.ts';
import { cleanupAllHeartsResources } from './hearts-bottom-sheet.ts';
import FX from './fx-helpers.ts';
import * as SPAWN from './spawn-helpers.ts';
import * as HUD   from './hud-helpers.ts';
import { wild } from './hud-helpers.ts';
import animationManager from './animation-manager.ts';
import * as FLOW  from './level-flow.js';
import { clearWildState, handleWildMagnetMergedPulledTiles } from './app-merge.ts';
import { resetTileToNormalState, boardHasPersistentLockedTiles } from './tile-state-utils.ts';
import { statsService } from '../services/stats-service.js';
import { arcadeStatsService } from '../services/arcade-stats-service.js';
import { TILE_IDLE_BOUNCE } from './tile-idle-bounce.ts';
import { isArcadeHomeRunMode } from './run-mode.js';
import { checkEndGame, clearEndGameCache, tileIsActive, getActiveTiles, type EndGameContext } from './endgame-checker.ts';
import { updateEndgameHint, resetEndgameHint } from './endgame-hint.ts';
import memoryManager from './memory-manager.ts';
import { boardSpecificRules, isWildSpawnEnabled, isWildMeterEnabled, filterWildType, getWildMeterFillRate } from './board-specific-rules.ts';
import { logger } from '../core/logger.js';
import { devLog, devWarn, devError } from './app-core-logger.ts';
import { createHudHelpers } from './app-core-hud-helpers.ts';
import type { Tile, Board, Grid, HUD as HUDType, Stage as StageType, Drag, MakeBoard } from '../types/game-types.js';
import { getBoardSaveKey, migrateGlobalSaveToBoard } from '../utils/board-save-utils.js';
import { 
  setPendingCleanBoard, 
  clearPendingCleanBoard, 
  getPendingCleanBoard,
  checkAndRecoverBoard 
} from './board-recovery.js';
import { 
  boardSize, 
  cellXY, 
  randVal, 
  sleep, 
  pickWildValue,
  trackAppTimeout,
  waitTracked,
  clearAllAppTimeouts,
  trackAppAnimationFrame,
  clearAllAppAnimationFrames,
  trackAppInterval,
  clearAllAppIntervals,
  trackAppListener,
  clearAllAppListeners,
  getAppCleanupStats
} from './app-core-utils.js';
import { createReplayRecorder } from './app-core-replay.ts';
import { getReactiveActiveTiles, isElementVisible, getScreenVisibility } from './app-core-state-helpers.ts';
import { createEmptyGrid as createEmptyGridHelper } from './app-core-grid-helpers.ts';
import { syncSharedState as syncSharedStateHelper } from './app-core-state-sync.ts';
import { resetBoardContainerHelper } from './app-core-board-reset.ts';
import { cleanupTilesForRebuild } from './app-core-tile-cleanup.ts';
import { createLockedHolders } from './app-core-board-build.ts';
import { openRandomTiles } from './app-core-open-tiles.ts';
import { ensureBackgroundLayerVisible } from './app-core-background-layer.ts';
import { schedulePopInSafetyNet } from './app-core-popin-safety.ts';
import { createSweetPopPromise } from './app-core-popin-start.ts';
import { handleHudDropOnHalf } from './app-core-hud-drop.ts';
import { handleSweetPopInComplete } from './app-core-popin-final.ts';
import { ensureAnimationRunning } from './app-core-animation-ensure.ts';
import { createPopInRunner } from './app-core-popin-delay.ts';
import { createSweetPopInRunner } from './app-core-popin-runner.ts';
import { stopTileIdleBounce } from './app-core-tile-bounce.ts';
import { initializeBoardGrid } from './app-core-board-setup.ts';
import { finalizeBoardVisibility } from './app-core-board-visibility.ts';
import { resetTilesForRebuild } from './app-core-tiles-reset.ts';
import { createAndOpenBoard } from './app-core-board-open.ts';
import { prepareBoardForRebuild } from './app-core-board-prepare.ts';
import { ensureExitVisibility } from './app-core-exit-visibility.ts';
import { cleanupBeforeBoardExit } from './app-core-exit-cleanup.ts';
import { selectTilesForExit } from './app-core-exit-tiles.ts';
import { runExitAnimation } from './app-core-exit-anim.ts';
import { ensureStartLevelVisibility } from './app-core-startlevel-visibility.ts';
import { stopMagnetParticlesOnExit } from './app-core-exit-magnet.ts';
import { startHudExitAnimation } from './app-core-exit-hud.ts';
import { runStartLevelFxPrep } from './app-core-startlevel-fx.ts';
import { applyStartLevelState } from './app-core-startlevel-state.ts';
import { updateJourneyRunState } from './app-core-startlevel-journey.ts';
import { updateStartLevelStats } from './app-core-startlevel-stats.ts';
import { incrementBoardTimesPlayed } from './app-core-startlevel-boardstats.ts';
import { syncJourneyBoards } from './app-core-startlevel-journey-boards.ts';
import { clearComboIdleTimer } from './app-core-startlevel-combo.ts';
import { resetWildAndEndgameState } from './app-core-startlevel-wild.ts';
import { ensureStartLevelLayout } from './app-core-startlevel-layout.ts';
import { applyWildSkinLocalCore } from './app-core-wild-skin.ts';
import { syncHudRootVisibility } from './app-core-startlevel-hudroot.ts';
import { handleStartLevelHudDrop } from './app-core-startlevel-huddrop.ts';
import { bindTileWithFallbackCore } from './app-core-bind.ts';
import { saveAfterBoardStart } from './app-core-startlevel-save.ts';
import { runStartLevelPost } from './app-core-startlevel-post.ts';
import { maybeRebuildBoard } from './app-core-startlevel-rebuild.ts';
import { addElectricGlowCore } from './app-core-glow.ts';
import { openAtCellCore } from './app-core-open-cell.ts';
import { getRandomEmptyCell } from './app-core-random-empty.ts';
import { hasLastMergeTile } from './app-core-wild-preload.ts';
import { consumeWildCharge } from './app-core-wild-meter.ts';
import { decideWildType } from './app-core-wild-type.ts';
import { triggerMergeHaptics } from './app-core-merge-haptics.ts';
import { handleMergeCombo } from './app-core-merge-combo.ts';
import { handleLastMergeEarly } from './app-core-merge-lastmerge.ts';
import { applyMergeScore } from './app-core-merge-score.ts';
import { canSaveGameState } from './app-core-save-guards.ts';
import { buildGridSnapshot } from './app-core-save-tiles.ts';
import { getStarsCountForSave } from './app-core-save-stars.ts';
import { buildSaveState } from './app-core-save-state.ts';
import { restoreBasicState } from './app-core-load-basics.ts';
import { applyRulesAfterLoad } from './app-core-load-rules.ts';
import { ensureDragReadyAndRebind } from './app-core-load-drag.ts';
import { layoutAndRestoreStars } from './app-core-load-layout.ts';
import { ensureHudAfterLoad } from './app-core-load-hud.ts';
import { schedulePostLoadRecoveryCheck } from './app-core-load-recovery.ts';
import { markUserMoveAfterLoad, resumeRuntimeAfterLoad } from './app-core-load-finalize.ts';
import { handleEmptyLoadState } from './app-core-load-empty.ts';
import { triggerHudDropIfPending, ensureHudFinalPosition } from './app-core-load-animation.ts';
import { loadSavedBoardState } from './app-core-load-save.ts';
import { ensureAppReadyForLoad } from './app-core-load-boot.ts';
import { restoreTilesFromSave } from './app-core-load-tiles.ts';
import { playLoadPopInAnimation } from './app-core-load-popin.ts';
import {
  tintLocked,
  fixHoverAnchor,
  ensureFonts,
  loadFirstTexture,
  killComboTimer as killComboTimerHelper,
  scheduleComboDecay as scheduleComboDecayHelper,
  hudSetCombo as hudSetComboHelper,
  hudResetCombo as hudResetComboHelper
} from './app-core-helpers.js';

const trackTween = (target: gsap.TweenTarget, vars: gsap.TweenVars) =>
  animationManager.trackExternalTween(gsap.to(target, vars));

const trackDelayedCall = (...args: Parameters<typeof gsap.delayedCall>) =>
  animationManager.trackExternalTween(gsap.delayedCall(...args));

type ComboTimer = ReturnType<typeof setTimeout> | { kill?: () => void } | null;
type DelayedCall = ReturnType<typeof trackDelayedCall> | null;

// TNT bonus cleanup tracking (delayed calls + wobble tweens)
let tntBoomDelayedCalls: Array<gsap.core.Tween> = [];
let tntBlastWobbleTweens: Array<gsap.core.Tween> = [];
let magnetBlastDelayedCalls: Array<gsap.core.Tween> = [];
let magnetBlastReturnTweens: Array<gsap.core.Tween> = [];
let lastTntBonusChangeAt = 0;
let tntBonusGuardUntil = 0; // Prevent premature fail while TNT bonus changes board

function cleanupTntBoomArtifacts(reason: string = 'unknown'): void {
  try {
    tntBoomDelayedCalls.forEach((dc) => {
      try { dc?.kill?.(); } catch {}
    });
    tntBoomDelayedCalls = [];
  } catch {}
  try {
    tntBlastWobbleTweens.forEach((tw) => {
      try { tw?.kill?.(); } catch {}
    });
    tntBlastWobbleTweens = [];
  } catch {}
  try {
    magnetBlastDelayedCalls.forEach((dc) => {
      try { dc?.kill?.(); } catch {}
    });
    magnetBlastDelayedCalls = [];
  } catch {}
  try {
    magnetBlastReturnTweens.forEach((tw) => {
      try { tw?.kill?.(); } catch {}
    });
    magnetBlastReturnTweens = [];
  } catch {}
  try { devLog('🧹 cleanupTntBoomArtifacts:', reason); } catch {}
}


// HUD functions from hud-helpers.js


// --- Endless mode config ---
const MOVES_MAX = 50;
const COMBO_CAP = 99;   // praktični safety cap

// Combo idle decay: reset na x0 poslije 2s
const COMBO_IDLE_RESET_MS = 2000;
let comboIdleTimer: ComboTimer = null;
let checkLevelEndTimer: DelayedCall = null;
let checkLevelEndRetryCount = 0; // 🔥 v38: Track reschedule attempts
const MAX_CHECK_LEVEL_END_RETRIES = 10; // 🔥 v38: Prevent infinite reschedule loops
const ENDGAME_FAIL_MUTATION_COOLDOWN_MS = 700; // Production-safe: require board to settle before fail path
const ENDGAME_GUARD_MAX_TTL_MS = 5000; // Hard cap to avoid stuck guard in case of missed cleanup
let lastEndgameBoardSignature = '';
let lastEndgameBoardMutationAt = 0;
let pendingMandatoryMergeCellSpawn: { c: number; r: number; expiresAt: number } | null = null;
let endgameGuardCount = 0;
let endgameGuardUntil = 0;
const endgameGuardSources = new Map<string, number>();
let __ccRuntimeTextureHooksInstalled = false;
let __ccNavigationCleanupInstalled = false;
let __ccGsapTickerTrackingInstalled = false;
let __ccTrackedGsapTickers: Set<Function> | null = null;
let __ccNavCleanupTimer: number | null = null;

function installGsapTickerTracking(): void {
  if (__ccGsapTickerTrackingInstalled) return;
  __ccGsapTickerTrackingInstalled = true;
  try {
    const ticker = (gsap as any)?.ticker;
    if (!ticker || typeof ticker.add !== 'function' || typeof ticker.remove !== 'function') {
      return;
    }
    if ((ticker as any).__ccWrapped) {
      __ccTrackedGsapTickers = (ticker as any).__ccTracked || __ccTrackedGsapTickers;
      return;
    }
    const origAdd = ticker.add.bind(ticker);
    const origRemove = ticker.remove.bind(ticker);
    __ccTrackedGsapTickers = new Set();
    (ticker as any).__ccTracked = __ccTrackedGsapTickers;
    (ticker as any).__ccWrapped = true;
    (ticker as any).__ccOrigAdd = origAdd;
    (ticker as any).__ccOrigRemove = origRemove;

    ticker.add = (fn: any, prioritize?: boolean, once?: boolean) => {
      try { if (fn) __ccTrackedGsapTickers?.add(fn); } catch {}
      return origAdd(fn, prioritize, once);
    };
    ticker.remove = (fn: any) => {
      try { if (fn) __ccTrackedGsapTickers?.delete(fn); } catch {}
      return origRemove(fn);
    };
  } catch {}
}

function killTrackedGsapTickers(reason: string = 'unknown'): void {
  try {
    if (!__ccTrackedGsapTickers || __ccTrackedGsapTickers.size === 0) return;
    __ccTrackedGsapTickers.forEach((fn) => {
      try { gsap.ticker.remove(fn as any); } catch {}
    });
    __ccTrackedGsapTickers.clear();
    devLog('🧹 killTrackedGsapTickers:', reason);
  } catch {}
}

// 🔒 SAFETY: Remove only TRULY orphaned magnet merge-6 tiles (stale from crash/abort)
// ⚠️ CRITICAL: Do NOT remove ACTIVE magnet pull merge 6 - these flags mean "in use":
//   _wildMagnetPulledTilesMerge, _wildMagnetMergeCallback = pull already happened
//   _willPullTiles, _hasTilesToPull = pull WILL happen (tiles flying) - MUST KEEP!
//   _wildMagnetPulledTilesScoring = during pull merge
// Removing active merge 6 → first magnet spawns nothing, second magnet stuck 6
const forceRemoveMagnetMergeResidues = (reason: string) => {
  try {
    const candidates = tiles.filter((t: Tile) => {
      if (!t || t.destroyed) return false;
      if ((t.value | 0) !== 6) return false;
      // 🔒 EXCLUDE: ALL active magnet pull merge 6 - must stay on board
      if ((t as any)._wildMagnetPulledTilesMerge === true) return false;
      if ((t as any)._wildMagnetMergeCallback) return false;
      if ((t as any)._willPullTiles === true) return false;
      if ((t as any)._hasTilesToPull === true) return false;
      if ((t as any)._wildMagnetPulledTilesScoring === true) return false;
      // Only remove truly orphaned: _noTilesPulled or _wasWildMagnetMerge6 (stale from old session)
      return (t as any)._noTilesPulled === true || (t as any)._wasWildMagnetMerge6 === true;
    });
    if (!candidates.length) return;

    // ✅ OPTIMIZED: O(1) grid clearing using direct coordinates
    // Only fallback to O(n²) search if coordinates are invalid
    const clearTileFromGridSafe = (tile: Tile): boolean => {
      if (!tile || !grid) return false;
      
      const gx = tile.gridX;
      const gy = tile.gridY;
      
      // ✅ Fast path: Use direct coordinates (O(1))
      if (typeof gy === 'number' && typeof gx === 'number' && 
          gy >= 0 && gx >= 0 && 
          grid[gy] && grid[gy][gx] === tile) {
        grid[gy][gx] = null;
        return true;
      }
      
      // ⚠️ Fallback: Linear search only if coordinates are invalid (should be rare)
      // This is O(n) where n = total tiles, but only runs if coordinates are wrong
      for (let r = 0; r < grid.length; r++) {
        const row = grid[r];
        if (!row) continue;
        for (let c = 0; c < row.length; c++) {
          if (row[c] === tile) {
            row[c] = null;
            return true;
          }
        }
      }
      
      return false;
    };

    candidates.forEach((t: Tile) => {
      clearTileFromGridSafe(t);
      t.visible = false;
      t.alpha = 0;
      t.eventMode = 'none';
      removeTile(t);
      delete (t as any)._wildMagnetPulledTilesMerge;
      delete (t as any)._wildMagnetMergeCallback;
      delete (t as any)._willPullTiles;
      delete (t as any)._hasTilesToPull;
      delete (t as any)._wildMagnetPulledTilesScoring;
      delete (t as any)._noTilesPulled;
      delete (t as any)._wasWildMagnetMerge6;
    });

    if (candidates.length) {
      logger.warn(`🧲 SAFETY: Removed ${candidates.length} lingering magnet merge-6 residues (${reason})`, 'app-core');
    }
  } catch (error) {
    logger.warn('⚠️ SAFETY: Failed to remove magnet merge residues', 'app-core', error);
  }
};

// 🔥 v112: Memory management functions moved to app-core-utils.ts
// Imported: trackAppTimeout, clearAllAppTimeouts, trackAppAnimationFrame, clearAllAppAnimationFrames, trackAppInterval, clearAllAppIntervals
// 🔥 CRITICAL: Increased from 500ms to 1200ms to allow all animations to complete
// - Wild spawn bounce: ~580ms
// - Magnet pull + respawn: ~1000ms
// - Regular merge animations: ~600-800ms
// This prevents premature endgame checks while animations are still running
const CHECK_LEVEL_END_DELAY_MS = 500; // 🔥 REDUCED: From 1200ms to 500ms for faster fail screen detection
// 🔥 v112: Combo functions refactored to use helpers
function killComboTimer(){
  comboIdleTimer = killComboTimerHelper(comboIdleTimer);
}

function scheduleComboDecay(){
  devLog(`🔥 scheduleComboDecay called: combo=${combo}, currentTimer=${comboIdleTimer}`);
  comboIdleTimer = scheduleComboDecayHelper(
    comboIdleTimer,
    COMBO_IDLE_RESET_MS,
    combo,
    hudResetCombo,
    updateHUD
  );
  devLog(`🔥 scheduleComboDecay completed: newTimer=${comboIdleTimer}, type=${typeof comboIdleTimer}`);
}

// --- Wild tuning ---
const WILD_INC_SMALL = 0.10;
const WILD_INC_BIG   = 0.22;

type HudMetrics = { top: number; bottom: number };
type MergeHelpers = { snapBack?: (tile: Tile | null) => void };

// -------------------- global state --------------------
let app: Application | null = null;
let stage: StageType | null = null;
let board: Board | null = null;
let boardBG: Graphics | null = null;
let hud: HUDType | null = null;
let _hudInitDone = false;
let _hudDropPending = true; // Play-from-slider only; no drop on restarts
let _lastSAT = -1;
let grid: Grid = Array.isArray(STATE.grid) ? (STATE.grid as Grid) : [];
const tiles: Tile[] = STATE.tiles as Tile[];
let score = 0; let level = 1; let boardNumber = 1; let moves = MOVES_MAX;
const SCORE_CAP = 999999;
const MAX_CHECK_LEVEL_END_SKIP_MS = 3000; // Hard stop for skip gates to avoid perma-deferral

let drag: (Drag & { t?: any }) | null = null;

// -------------------- replay/snapshot harness (dev safety) --------------------
const replayRecorder = createReplayRecorder({
  tiles,
  getGrid: () => grid,
  getScore: () => (Number.isFinite(score) ? score : 0),
  getLevel: () => (Number.isFinite(level) ? level : 1),
  getBoardNumber: () => (Number.isFinite(boardNumber) ? boardNumber : Number.isFinite(level) ? level : 1),
  getMoves: () => (Number.isFinite(moves) ? moves : MOVES_MAX),
  getWildMeter: () => (Number.isFinite(wildMeter) ? wildMeter : 0),
  getStarsCount: () => {
    try {
      if (typeof StarsCollector.getStarsCount === 'function') {
        return StarsCollector.getStarsCount();
      }
    } catch {}
    return 0;
  },
});

// Combo (UI driven)
let combo = 0; // default x0
function hudSetCombo(v){ 
  combo = hudSetComboHelper(v, COMBO_CAP, HUD.setCombo);
}
function hudResetCombo(){ 
  combo = 0; // 🔥 CRITICAL: Reset combo variable first
  hudResetComboHelper(HUD.resetCombo);
}

// HUD legacy refs (fallback)
let scoreNumText = null, boardNumText = null, comboNumText = null;

// Export combo text for animations
window.comboText = null;

// Wild meter stores raw charge (can exceed 1); HUD clamps to 0..1
let wildMeter = 0;
let wildSpawnInProgress = false; // Prevent overlapping wild spawns
let merge6SpawnInProgress = false; // 🔥 BUG FIX: Prevent duplicate spawns when wild star/juice are used rapidly
let merge6SpawnInProgressIsWild = false; // 🔥 Only block fast merges while wild merge-6 is spawning
let merge6SpawnResetTimer: gsap.core.Tween | null = null;
let wildSpawnRetryTimer = null;  // Retry timer when no cells are free
let wildMagnetPullInProgress = false; // Prevent overlapping wild-magnet pull animations
let busyEnding = false;
let checkLevelEndSkipStartedAt: number | null = null; // Track skip window to force fall-through

function beginEndgameGuard(source: string, ttlMs: number = 1500): number {
  const normalizedSource = String(source || 'unknown');
  const now = Date.now();
  const safeTtl = Math.max(50, Math.min(ENDGAME_GUARD_MAX_TTL_MS, ttlMs | 0 || 1500));
  const nextCount = (endgameGuardSources.get(normalizedSource) || 0) + 1;
  endgameGuardSources.set(normalizedSource, nextCount);
  endgameGuardCount++;
  endgameGuardUntil = Math.max(endgameGuardUntil, now + safeTtl);
  devLog('🛡️ beginEndgameGuard:', { source: normalizedSource, ttlMs: safeTtl, count: endgameGuardCount, untilInMs: endgameGuardUntil - now });
  return endgameGuardCount;
}

function endEndgameGuard(source: string): void {
  const normalizedSource = String(source || 'unknown');
  const existing = endgameGuardSources.get(normalizedSource) || 0;
  if (existing > 1) {
    endgameGuardSources.set(normalizedSource, existing - 1);
  } else {
    endgameGuardSources.delete(normalizedSource);
  }
  if (endgameGuardCount > 0) endgameGuardCount--;
  if (endgameGuardCount === 0) {
    endgameGuardUntil = 0;
  }
  devLog('🛡️ endEndgameGuard:', { source: normalizedSource, count: endgameGuardCount });
}

function getEndgameGuardState(): { active: boolean; count: number; until: number; sources: string[] } {
  const now = Date.now();
  const active = endgameGuardCount > 0 || endgameGuardUntil > now;
  return {
    active,
    count: endgameGuardCount,
    until: endgameGuardUntil,
    sources: Array.from(endgameGuardSources.keys())
  };
}

// 🔥 REFACTORED: Koristimo tileIsActive iz endgame-checker.ts za konzistentnost
// Uklonjeno tileIsVisuallyActive() - sada koristimo tileIsActive() iz endgame-checker.ts

// 🔥 REMOVED: isBoardCleanReactive() - use checkEndGame() from endgame-checker.ts instead
// This function was a duplicate of isBoardCleanCheck() and could cause conflicts

async function triggerCleanBoardFlow(reason: string): Promise<void> {
  logger.info('🚨🚨🚨 triggerCleanBoardFlow invoked', 'app-core', { reason });

  // 🔥 USER BUG FIX: Don't trigger clean board flow if game is hidden (user is on homepage/other screens)
  // This prevents clean board modal from appearing when user navigates away from game
  const { appVisible, homeVisible, journeyVisible } = getScreenVisibility();
  if (homeVisible || journeyVisible) {
    try { setFinalMergeVisualSuppression(false); } catch {}
    logger.debug('⏳ triggerCleanBoardFlow skipped - home/journey visible (user on other screens)', 'app-core', {
      appVisible,
      homeVisible,
      journeyVisible
    });
    return;
  }
  if (!appVisible) {
    // If no other screen is visible but app is hidden, force-show to avoid deadlock.
    try {
      const uiManagerModule = await import('./ui-manager.js');
      uiManagerModule.default?.showApp?.();
      logger.warn('⚠️ triggerCleanBoardFlow: App was hidden with no UI visible - force showApp()', 'app-core');
    } catch {}
  }

  if (busyEnding) {
    logger.debug('⏳ triggerCleanBoardFlow skipped - busyEnding already true', 'app-core');
    return;
  }
  busyEnding = true;

  const waitForWildEndgameAnimationsToSettle = async (): Promise<void> => {
    const maxWaitMs = 3600;
    const pollMs = 80;
    const startedAt = Date.now();
    const getState = () => ({
      tnt: !!isTntAnimationActive?.(),
      juiceExplosion: !!isWildJuiceBubblesExplosionActive?.(),
      magneticText: !!isMagneticTextActive?.(),
      sparkleText: !!isSparkleTextActive?.(),
    });
    let state = getState();
    if (!state.tnt && !state.juiceExplosion && !state.magneticText && !state.sparkleText) return;

    logger.info('⏳ triggerCleanBoardFlow: waiting for wild endgame animations to finish', 'app-core', {
      reason,
      ...state
    });

    while (Date.now() - startedAt < maxWaitMs) {
      state = getState();
      if (!state.tnt && !state.juiceExplosion && !state.magneticText && !state.sparkleText) {
        logger.info('✅ triggerCleanBoardFlow: wild endgame animations finished', 'app-core', {
          waitedMs: Date.now() - startedAt,
          reason
        });
        return;
      }
      await waitTracked(pollMs);
    }

    state = getState();
    logger.warn('⚠️ triggerCleanBoardFlow: wait timeout, continuing to modal to avoid deadlock', 'app-core', {
      waitedMs: Date.now() - startedAt,
      reason,
      ...state
    });
  };

  await waitForWildEndgameAnimationsToSettle();

  // 🔥 BUG FIX: Clear STACK IT! hint IMMEDIATELY when entering clean board flow
  // Prevents hint from appearing during/after boom animation when board is empty
  try { resetEndgameHint(); } catch {}
  
  // If we explicitly requested a clean-board skip (e.g., resuming straight into next board after hard-exit),
  // consume the flag and bail before any modal/animation starts.
  if ((window as any).__skipCleanBoardOnce) {
    logger.debug('⏭️ Skipping clean-board flow once due to resume jump flag', 'app-core');
    delete (window as any).__skipCleanBoardOnce;
    try { setFinalMergeVisualSuppression(false); } catch {}
    busyEnding = false;
    return;
  }

  // 🔥 UX: Stop idle bounce smoke immediately before clean board flow
  try { TILE_IDLE_BOUNCE.stop(); } catch {}
  try { cleanupFxContainersByTag('tile-idle-smoke'); } catch {}

  // 🧪 DEV LOG: Snapshot when "clean board" is triggered (cleanup stats, stage/board children, tiles, renderer, assets, gsap, memoryManager, performance.memory)
  try {
    const cleanupStats = getAppCleanupStats();
    const activeTiles = getReactiveActiveTiles(tiles);
    const rendererAny = app?.renderer as any;
    const textureCount = (typeof rendererAny?.texture?.managedTextures !== 'undefined')
      ? (rendererAny.texture.managedTextures?.length ?? (rendererAny.texture.managedTextures?.size ?? 0))
      : (typeof rendererAny?.textureGC !== 'undefined' ? (rendererAny.textureGC?.getManagedTextures?.()?.length ?? 0) : 0);
    const cache = (Assets as any)?.cache;
    const cacheSize = cache && typeof (cache as { size?: number }).size === 'number' ? (cache as { size: number }).size : (cache && typeof cache === 'object' ? (cache instanceof Map ? cache.size : Object.keys(cache).length) : 0);
    const gsapTweens = typeof (gsap as any).getAllTweens === 'function' ? (gsap as any).getAllTweens().length : 0;
    const mmStats = typeof (memoryManager as any).getMemoryInfo === 'function' ? (memoryManager as any).getMemoryInfo() : null;
    const perfMem = (performance as any).memory ? {
      usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
      totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
      jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
    } : null;
    logRuntimeStats('clean board');
  } catch (e) {
    devWarn('⚠️ DEV LOG (clean board) snapshot failed:', e);
  }

  // 🔥 NOTE: Defer texture/memory cleanup until AFTER endgame animations complete.
  // Cleaning here can destroy runtime textures used by stars/bubbles and freeze animations.

  // Reset wild meter immediately (legacy behavior)
  wildMeter = 0;
  STATE.wildMeter = 0;
  resetWildProgress(0, false);
  wildJuiceSpawned = false; // Reset wild-juice spawn tracking
  wildMagnetSpawned = false; // Reset wild-magnet spawn tracking
  firstWildSpawned = false; // 🔥 USER REQUEST: Reset first wild spawn tracking
  wildSpawnCount = 0;

  try {
    if (typeof HUD.resetWildMeter === 'function') {
      HUD.resetWildMeter(true);
    } else {
      HUD.updateProgressBar?.(0, false);
    }
  } catch (error) {
    logger.warn('⚠️ triggerCleanBoardFlow: Failed to reset wild meter', 'app-core', error);
  }

  try {
    // 🔥 UX: No fixed delay – runEndgameFlow waits only for ongoing animations (bubbles/stars), then shows modal
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

    // Extra pass after endgame flow completes: aggressively clear unknown small textures
    try {
      logger.debug('🧹 Performing memory cleanup after endgame flow...', 'app-core');
      memoryManager.performCleanup();
    } catch (error) {
      logger.warn('⚠️ Memory cleanup failed (post endgame)', 'app-core', error);
    }
    try {
      // Stability-first: never run destructive texture cache cleanup here.
      // Keep this pass non-destructive to avoid addressModeU crashes during next-board boot.
      cleanupTexturesForBoardTransition('after-clean-board', false, true);
    } catch {}
    
    // 🔥 BOARD RECOVERY: Clean board flow completed successfully - clear recovery flag
    // This prevents recovery from triggering on next load since flow completed normally
    try {
      clearPendingCleanBoard();
    } catch (e) {
      logger.warn('⚠️ Failed to clear pending clean board flag:', 'app-core', e);
    }
  } finally {
    try { setFinalMergeVisualSuppression(false); } catch {}
    busyEnding = false;
  }
}


function createEmptyGrid() {
  return createEmptyGridHelper({
    ROWS,
    COLS,
    setGrid: (g) => { grid = g; },
    setStateGrid: (g) => { STATE.grid = g; },
  });
}

function syncSharedState() {
  syncSharedStateHelper({
    STATE,
    app,
    stage,
    board,
    boardBG,
    hud,
    grid,
    tiles,
    score,
    level,
    moves,
    boardNumber,
  });
  STATE.wildMeter = wildMeter;
  // 🔥 CRITICAL: Ensure STATE.boardNumber is always synced with local boardNumber
  // This ensures trackCubesCracked and other functions can access the correct board number
  if (STATE.boardNumber !== boardNumber) {
    STATE.boardNumber = boardNumber;
    devLog(`🔄 Synced STATE.boardNumber to ${boardNumber}`);
  }
  return STATE;
}

syncSharedState();
try { (window as any).__ccLogRuntimeStats = logRuntimeStats; } catch {}

function resetGlobalFxLayer(reason: string = 'unknown') {
  try {
    const fxLayer = (window as any).__ccGlobalFxLayer;
    if (fxLayer) {
      try { if (fxLayer.parent) fxLayer.parent.removeChild(fxLayer); } catch {}
      try { fxLayer.destroy?.({ children: true }); } catch {}
      delete (window as any).__ccGlobalFxLayer;
      devLog('🧹 resetGlobalFxLayer:', reason);
    }
  } catch (e) {
    devWarn('⚠️ resetGlobalFxLayer failed:', e);
  }
}

function logRuntimeStats(reason: string = 'unknown'): void {
  try {
    const cleanupStats = getAppCleanupStats();
    const activeTiles = getReactiveActiveTiles(tiles);
    const rendererAny = app?.renderer as any;
    const textureCount = (typeof rendererAny?.texture?.managedTextures !== 'undefined')
      ? (rendererAny.texture.managedTextures?.length ?? (rendererAny.texture.managedTextures?.size ?? 0))
      : (typeof rendererAny?.textureGC !== 'undefined' ? (rendererAny.textureGC?.getManagedTextures?.()?.length ?? 0) : 0);
    const cache = (Assets as any)?.cache;
    const cacheSize = cache && typeof (cache as { size?: number }).size === 'number' ? (cache as { size: number }).size : (cache && typeof cache === 'object' ? (cache instanceof Map ? cache.size : Object.keys(cache).length) : 0);
    const gsapTweens = typeof (gsap as any).getAllTweens === 'function' ? (gsap as any).getAllTweens().length : 0;
    const mmStats = typeof (memoryManager as any).getMemoryInfo === 'function' ? (memoryManager as any).getMemoryInfo() : null;
    const perfMem = (performance as any).memory ? {
      usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
      totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
      jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
    } : null;
    const snapshot: Record<string, unknown> = {
      reason,
      cleanupStats,
      stage: { hasStage: !!stage, stageVisible: !!stage?.visible, stageChildren: stage?.children?.length ?? 0 },
      board: { hasBoard: !!board, boardVisible: !!board?.visible, boardChildren: board?.children?.length ?? 0 },
      tiles: { count: tiles?.length ?? 0, active: activeTiles.length },
      renderer: { hasRenderer: !!app?.renderer, textureCount },
      assetsCache: cacheSize,
      gsapTweens,
      memoryManager: mmStats,
      performanceMemory: perfMem
    };
    devLog(`🧪 DEV LOG (${reason}):`, snapshot);
    const short = { reason, stageChildren: (snapshot.stage as any)?.stageChildren, tilesActive: (snapshot.tiles as any)?.active, textureCount: (snapshot.renderer as any)?.textureCount, gsapTweens: snapshot.gsapTweens, heapMB: perfMem ? Math.round(perfMem.usedJSHeapSize / 1024 / 1024) : null };
    console.log(`🧪 CC runtime [${reason}]:`, short);
  } catch (e) {
    devWarn(`⚠️ DEV LOG (${reason}) snapshot failed:`, e);
  }
}

function cleanupFxForBoardReset(reason: string = 'unknown') {
  devLog('🧹 cleanupFxForBoardReset:', reason);
  const isNavCleanup =
    typeof reason === 'string' &&
    (reason.includes('nav:') || reason.includes('cc-navigation') || reason.includes('journey') || reason.includes('settings') || reason.includes('collectibles'));
  try { cleanupTntBoomArtifacts(`fx:${reason}`); } catch {}
  try { killAllDelayedCalls?.(); } catch {}
  try { destroyAllGraphicsObjects?.(); } catch {}
  try { cleanupAllFxContainers?.(); } catch {}
  try { cleanupExistingStarAnimations?.(); } catch {}
  try { stopTntAnimation?.(); } catch {}
  try { stopSparkleText?.(); } catch {}
  try { stopWildJuiceBubblesScreen?.(); } catch {}
  // 🔥 Safety: kill active magnet pull animations on cleanup
  try {
    const magnetCleanup = (window as any).__ccActiveMagnetPullCleanup;
    if (typeof magnetCleanup === 'function') {
      magnetCleanup();
      (window as any).__ccActiveMagnetPullCleanup = null;
    }
  } catch {}
  if (isNavCleanup || reason.includes('cleanupGame') || reason.includes('restartGame')) {
    try { killTrackedGsapTickers(`fx:${reason}`); } catch {}
    try { clearAllAppTimeouts(); } catch {}
    try { clearAllAppAnimationFrames(); } catch {}
    try { clearAllAppIntervals(); } catch {}
    try { clearAllAppListeners(); } catch {}
    try {
      import('./dom-element-pool.js').then((m) => {
        try { m.domElementPool?.clear?.(); } catch {}
      }).catch(() => {});
    } catch {}
    try {
      import('./object-pool.js').then((m) => {
        try { m.graphicsPool?.clear?.(); } catch {}
      }).catch(() => {});
    } catch {}
  }
  // 🔥 Stability: stop per-tile idle FX to avoid lingering tickers/intervals
  try {
    const tileList = (STATE && STATE.tiles && STATE.tiles.length) ? STATE.tiles : tiles;
    if (tileList && tileList.length) {
      tileList.forEach((t: any) => {
        try { stopWildIdle?.(t); } catch {}
        try { stopWildShimmer?.(t); } catch {}
        try { stopWildStars?.(t); } catch {}
        try { stopWildJuiceBubbles?.(t); } catch {}
        try { stopMagnetIdleParticles?.(t); } catch {}
        try { stopTntIdleParticles?.(t); } catch {}
        try { stopTntIdleShake?.(t); } catch {}
        if ((t as any)?._glowAnimation) {
          try { (t as any)._glowAnimation.kill?.(); } catch {}
          try { (t as any)._glowAnimation = null; } catch {}
        }
      });
    }
  } catch {}
  try {
    const isBoardTransitionActive = (window as any).__ccBoardTransitionActive === true;
    const isFromInterimBoard = (window as any).__ccFromInterimBoard === true || (window as any).__ccIsInterimBoard === true;
    const isRecentlyStarted = typeof isWildJuiceBubblesExplosionRecentlyStarted === 'function' && isWildJuiceBubblesExplosionRecentlyStarted();
    if (isNavCleanup) {
      try { forceStopWildJuiceBubblesExplosion?.(); } catch {}
      try { stopWildJuiceBubblesExplosion?.(); } catch {}
      try { stopWildJuiceBubblesScreen?.(); } catch {}
    } else if (!isBoardTransitionActive && !isFromInterimBoard && !isRecentlyStarted) {
      stopWildJuiceBubblesExplosion?.();
    } else {
      devLog('⏸️ cleanupFxForBoardReset: Skipping bubble explosion cleanup', {
        reason,
        isBoardTransitionActive,
        isFromInterimBoard,
        isRecentlyStarted
      });
      // Defensive: ensure explosion is stopped after transition settles
      trackDelayedCall(0.5, () => {
        try {
          const stillTransitioning = (window as any).__ccBoardTransitionActive === true;
          if (stillTransitioning || (typeof isWildJuiceBubblesExplosionActive === 'function' && isWildJuiceBubblesExplosionActive())) {
            forceStopWildJuiceBubblesExplosion?.();
          }
        } catch {}
      });
    }
  } catch {}
  try { resetGlobalFxLayer(`fx:${reason}`); } catch {}
  try {
    import('./confetti-system.js').then(confettiModule => {
      if (confettiModule && typeof confettiModule.stopConfettiSpawns === 'function') {
        confettiModule.stopConfettiSpawns();
      }
    }).catch(() => {});
  } catch {}
  try { (window as any).__ccLastFxCleanupAt = Date.now(); } catch {}
}

/**
 * 🔥 MEMORY SPIKE FIX: Destroy old board tiles before starting new board.
 * Call AFTER hideApp (ticker stopped) and softResetBoardView.
 * Reduces peak memory during board transition (avoids old + new tiles in memory at once).
 */
function destroyOldBoardForTransition(reason: string = 'unknown'): void {
  try {
    devLog('🧹 destroyOldBoardForTransition:', reason);
    const tileList = (STATE?.tiles && STATE.tiles.length) ? STATE.tiles : tiles;
    if (!tileList || tileList.length === 0) {
      devLog('🧹 destroyOldBoardForTransition: No tiles to destroy');
      return;
    }
    const count = tileList.length;
    tileList.forEach((t: any) => {
      try { stopWildIdle?.(t); } catch {}
      try { stopWildShimmer?.(t); } catch {}
      try { stopWildStars?.(t); } catch {}
      try { stopWildJuiceBubbles?.(t); } catch {}
      try { stopMagnetIdleParticles?.(t); } catch {}
      try { stopTntIdleParticles?.(t); } catch {}
      try { stopTntIdleShake?.(t); } catch {}
      try {
        gsap.killTweensOf(t);
        gsap.killTweensOf(t?.scale);
        if ((t as any)?._idleBounceTl) {
          try { (t as any)._idleBounceTl.kill(); } catch {}
          (t as any)._idleBounceTl = null;
        }
        if ((t as any)?._glowAnimation) {
          try { (t as any)._glowAnimation.kill?.(); } catch {}
          (t as any)._glowAnimation = null;
        }
      } catch {}
      try {
        if (typeof (window as any).killTileAnimations === 'function') {
          (window as any).killTileAnimations(t);
        }
      } catch {}
      try {
        if (t && !t.destroyed) {
          t.destroy({ children: true, texture: false, textureSource: false } as any);
        }
      } catch {}
    });
    tiles.length = 0;
    if (STATE.tiles) STATE.tiles.length = 0;
    devLog('🧹 destroyOldBoardForTransition: Destroyed', count, 'tiles');
  } catch (e) {
    devWarn('⚠️ destroyOldBoardForTransition failed:', e);
  }
}

function cleanupTexturesForBoardTransition(reason: string = 'unknown', aggressiveUnknown: boolean = false, skipCacheClear: boolean = false) {
  try {
    const renderer = app?.renderer || (STATE as any)?.app?.renderer;
    const managed = renderer?.texture?.managedTextures;
    const preCount = managed ? (managed.size || Object.keys(managed).length) : 0;

    // managedTextures dev logs removed (no longer needed)

    // Stop/clear bubble resources that generate runtime textures
    try { stopWildJuiceBubblesScreen?.(); } catch {}
    try { destroyWildJuiceBubblesExplosionCache?.(); } catch {}
    try { destroyWildJuiceBubblesScreenCache?.(); } catch {}

    // Destroy registered runtime textures (generated from canvas/graphics)
    // 🔥 CRITICAL: Skip when skipCacheClear - stage/HUD may still reference these textures.
    // Destroying them causes "Cannot read properties of null (reading 'addressModeU')" when
    // renderer tries to bind texture during next frame. Runtime textures will be pruned by
    // textureGC or cleared on next hard reset.
    if (!skipCacheClear) {
      try {
        const runtimeTextures = (window as any).__ccRuntimeTextures;
        if (runtimeTextures) {
          if (typeof runtimeTextures.forEach === 'function') {
            runtimeTextures.forEach((tex: any) => {
              try { tex?.destroy?.(true); } catch {}
            });
            try { runtimeTextures.clear?.(); } catch {}
          } else if (Array.isArray(runtimeTextures)) {
            runtimeTextures.forEach((tex: any) => {
              try { tex?.destroy?.(true); } catch {}
            });
            (window as any).__ccRuntimeTextures = [];
          }
        }
      } catch {}
    }

    // Prune destroyed/runtime textures from PIXI Assets cache (prevents stale refs)
    try {
      const cache = (Assets as any)?.cache;
      if (cache) {
        const isRuntimeLabel = (label: unknown) =>
          typeof label === 'string' && label.startsWith('runtime:');
        const shouldPruneTexture = (tex: any) => {
          if (!tex) return false;
          if (tex.destroyed) return true;
          if (isRuntimeLabel(tex.label)) return true;
          const src = tex.source || tex.baseTexture || {};
          if (isRuntimeLabel(src.label)) return true;
          if (src.valid === false) return true;
          return false;
        };
        let pruned = 0;
        if (cache instanceof Map) {
          for (const [key, value] of cache.entries()) {
            if (value instanceof Texture && shouldPruneTexture(value)) {
              cache.delete(key);
              pruned++;
            }
          }
        } else if (typeof cache === 'object') {
          Object.keys(cache).forEach(key => {
            const value = (cache as any)[key];
            if (value instanceof Texture && shouldPruneTexture(value)) {
              try { delete (cache as any)[key]; } catch {}
              pruned++;
            }
          });
        }
        if (pruned > 0) {
          devLog('🧹 Assets cache pruned runtime/destroyed textures', { reason, pruned });
        }
      }
    } catch {}

    // Destroy unknown runtime textures ONLY when explicitly enabled (safety: avoid destroying in-use textures)
    try {
      const allowUnknown = (window as any).__ccUnknownTextureCleanup === true;
      if (allowUnknown && managed) {
        let destroyed = 0;
        const destroyIfUnknown = (tex: any) => {
          try {
            if (!tex || tex.destroyed) return;
            const src = tex.source || tex.baseTexture || {};
            const label = tex.label || src.label || '';
            const url = src.resource?.url || src.resource?.src || src.resource?.source?.currentSrc || '';
            const width = tex.width || src.width || 0;
            const height = tex.height || src.height || 0;
            if (label || url) return;
            if (width <= 1 && height <= 1) return; // Keep EMPTY/WHITE
            if (width > 256 || height > 256) return; // Avoid large assets
            if (!aggressiveUnknown && (width > 64 || height > 64)) return;
            tex.destroy?.(true);
            destroyed++;
          } catch {}
        };
        if (managed instanceof Map) {
          managed.forEach((value: any, key: any) => {
            const tex = value?.texture || value || key;
            destroyIfUnknown(tex);
          });
        } else if (typeof managed === 'object') {
          Object.keys(managed).forEach(k => {
            destroyIfUnknown((managed as any)[k]);
          });
        }
        if (destroyed > 0) {
          devLog('🧹 Destroyed unknown runtime textures', { reason, destroyed });
        }
      }
    } catch {}
    
    // Ask PIXI to GC textures where possible
    try { renderer?.textureGC?.run?.(); } catch {}
    
    // Clear texture cache + unused base textures (skip when skipCacheClear - avoids addressModeU crash
    // when stage may still reference textures during board transition)
    if (!skipCacheClear) {
      try {
        const pixiUtils = (window.PIXI && (window.PIXI.utils as any)) || null;
        if (pixiUtils) {
          // 🔥 CRITICAL FIX: Stop renderer before clearing texture cache to prevent addressModeU errors
          // This ensures textures aren't being accessed during cleanup
          const shouldStopRenderer = renderer && renderer.runners && typeof renderer.runners.postrender === 'object';
          if (shouldStopRenderer && renderer.ticker) {
            try {
              renderer.ticker.stop();
            } catch {}
          }
          
          if (typeof pixiUtils.clearTextureCache === 'function') {
            pixiUtils.clearTextureCache();
          } else if (typeof pixiUtils.destroyTextureCache === 'function') {
            pixiUtils.destroyTextureCache();
          }
          const baseTextureCache = pixiUtils.BaseTextureCache;
          if (baseTextureCache) {
            const toRemove: string[] = [];
            for (const [key, baseTexture] of Object.entries(baseTextureCache)) {
              try {
                const bt = baseTexture as any;
                // 🔥 CRITICAL FIX: Check if texture is still referenced before destroying
                // Only destroy if textureCacheIds is empty AND texture is not currently bound
                if (bt && (!bt.textureCacheIds || bt.textureCacheIds.length === 0)) {
                  // Additional safety check: verify texture is not in use
                  const isInUse = renderer && renderer.texture && renderer.texture.boundTextures
                    ? Array.from(renderer.texture.boundTextures.values()).some((boundTex: any) => 
                        boundTex === bt || boundTex?.baseTexture === bt
                      )
                    : false;
                  
                  if (!isInUse && typeof bt.destroy === 'function') {
                    bt.destroy();
                    toRemove.push(key as string);
                  }
                }
              } catch {}
            }
            toRemove.forEach(key => {
              try { delete baseTextureCache[key]; } catch {}
            });
          }
          
          // Restart renderer if we stopped it
          if (shouldStopRenderer && renderer.ticker) {
            try {
              renderer.ticker.start();
            } catch {}
          }
        }
      } catch {}
    }
    
    const postCount = managed ? (managed.size || Object.keys(managed).length) : 0;
    if (preCount || postCount) {
      devLog('🧹 Texture cleanup (board transition):', { reason, preCount, postCount });
    }
  } catch (e) {
    devWarn('⚠️ cleanupTexturesForBoardTransition failed:', e);
  }
}

function installRuntimeTextureHooks() {
  if (__ccRuntimeTextureHooksInstalled) return;
  __ccRuntimeTextureHooksInstalled = true;
  try {
    const origFrom = (Texture as any).from;
    if (origFrom && !(origFrom as any).__ccWrapped) {
      const wrapped = function(source: any, options?: any) {
        const tex = origFrom.call(this, source, options);
        try {
          const isCanvas = (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) ||
                           (typeof OffscreenCanvas !== 'undefined' && source instanceof OffscreenCanvas);
          if (isCanvas && tex && !tex.label) {
            const w = source?.width || 0;
            const h = source?.height || 0;
            tex.label = `runtime:Texture.from:${w}x${h}`;
            const texSrc = (tex as { source?: { label?: string }; baseTexture?: { label?: string } }).source ?? tex.baseTexture;
            if (texSrc) texSrc.label = tex.label;
            const rt = (window as any).__ccRuntimeTextures || ((window as any).__ccRuntimeTextures = new Set());
            rt.add?.(tex);
          }
        } catch {}
        return tex;
      };
      (wrapped as any).__ccWrapped = true;
      (Texture as any).from = wrapped;
    }
  } catch {}
}

function killAllGsapTweensCommon(tilesList: any[] | null, label: string, opts: { clearTimeline?: boolean } = {}) {
  try {
    devLog(`🧹 GSAP cleanup (${label})...`);
    try { animationManager.killAll(); } catch {}
    
    // Kill UI element tweens
    gsap.killTweensOf('[data-wild-loader]');
    gsap.killTweensOf('.wild-loader');
    gsap.killTweensOf('p');
    gsap.killTweensOf('progress');
    gsap.killTweensOf('ratio');
    
    const list = tilesList || [];
    if (list.length > 0) {
      list.forEach(tile => {
        try {
          if (tile && !tile.destroyed) {
            if (tile.scale && !tile.scale.destroyed) {
              gsap.killTweensOf(tile.scale);
            }
            gsap.killTweensOf(tile);
            if (tile.hover && !tile.hover.destroyed) {
              gsap.killTweensOf(tile.hover);
            }
          }
        } catch {}
      });
    }
    
    // Kill HUD/board/stage tweens
    if (HUD && !HUD.isHUDDestroyed?.()) {
      try { gsap.killTweensOf(HUD); } catch {}
    }
    if (board && !board.destroyed) {
      try { gsap.killTweensOf(board); } catch {}
    }
    if (app && app.stage && !app.stage.destroyed) {
      try { gsap.killTweensOf(app.stage); } catch {}
    }
    if (backgroundLayer && !backgroundLayer.destroyed) {
      try { gsap.killTweensOf(backgroundLayer); } catch {}
    }
    
    // Kill timelines referencing destroyed targets
    // 🔥 CRITICAL FIX: Add defensive null checks to prevent "Cannot set properties of null" errors
    try {
      const allTweens = gsap.globalTimeline.getChildren();
      allTweens.forEach((tween: any) => {
        try {
          if (!tween || typeof tween.kill !== 'function') return;
          
          const targets = tween.targets || [];
          if (targets.length > 0) {
            const target = targets[0];
            // 🔥 FIX: Check if target is null/undefined/destroyed before accessing properties
            if (!target || target.destroyed || target === null || target === undefined) {
              tween.kill();
            } else {
              // 🔥 FIX: Validate target properties exist before GSAP tries to animate them
              // This prevents "Cannot set properties of null (setting 'y')" errors
              try {
                // Test if target has animatable properties (x, y, alpha, etc.)
                const hasProps = 'x' in target || 'y' in target || 'alpha' in target || 'scale' in target;
                if (!hasProps && typeof target !== 'string' && !Array.isArray(target)) {
                  // Target doesn't have animatable properties - kill tween to prevent errors
                  tween.kill();
                }
              } catch (propCheckError) {
                // If we can't check properties, kill the tween to be safe
                tween.kill();
              }
            }
          }
        } catch {}
      });
    } catch {}
    
    if (opts.clearTimeline) {
      try {
        const timelines = gsap.globalTimeline.getChildren(true, false, false);
        timelines.forEach(tl => {
          try { tl.kill(); } catch {}
        });
        gsap.globalTimeline.clear();
      } catch {}
    }
    
    try { gsap.globalTimeline.resume(); } catch {}
    devLog(`✅ GSAP cleanup complete (${label})`);
  } catch (e) {
    devLog('⚠️ GSAP cleanup error:', e);
  }
}

function logBoardExitStats(label: string) {
  try {
    const mmStats = typeof (memoryManager as any).getMemoryInfo === 'function'
      ? (memoryManager as any).getMemoryInfo()
      : null;
    const animStats = typeof (animationManager as any).getStats === 'function'
      ? (animationManager as any).getStats()
      : null;
    const pixiUtils = (window as any).PIXI?.utils || null;
    const texCache = pixiUtils?.TextureCache ? Object.keys(pixiUtils.TextureCache).length : null;
    const baseCache = pixiUtils?.BaseTextureCache ? Object.keys(pixiUtils.BaseTextureCache).length : null;
    const runtimeTextures = (window as any).__ccRuntimeTextures?.size ?? null;

    devLog(`🧪 Board exit stats (${label})`, {
      memoryManager: mmStats,
      animationManager: animStats,
      pixiCache: { texture: texCache, baseTexture: baseCache },
      runtimeTextures
    });
  } catch (e) {
    devWarn('⚠️ Board exit stats failed:', e);
  }
}

function softResetBoardView(reason: string = 'unknown') {
  devLog('♻️ softResetBoardView:', reason);
  _hudInitDone = false; // 🔥 CRITICAL: Force layoutBoard to re-init HUD after board transition
  // Kill tweens on board/hud containers
  try { if (board) gsap.killTweensOf(board); } catch {}
  try { if (hud) gsap.killTweensOf(hud); } catch {}
  // Clear board/hud containers
  try { if (board) board.removeChildren(); } catch {}
  try { if (hud) hud.removeChildren(); } catch {}
  // Recreate core containers if missing
  if (!stage) stage = app?.stage;
  if (stage && stage.sortableChildren !== undefined) stage.sortableChildren = true;
  if (!board) { board = new Container(); board.sortableChildren = true; }
  if (!hud) { hud = new Container(); hud.eventMode = 'none'; }
  if (!boardBG) boardBG = new Graphics();
  // Ensure visibility
  board.visible = true; board.alpha = 1; board.renderable = true;
  hud.visible = true; hud.alpha = 1; hud.renderable = true;
  board.zIndex = 100; hud.zIndex = 10000;
  // Ensure in stage
  if (stage && board.parent !== stage) stage.addChild(board);
  if (stage && hud.parent !== stage) stage.addChild(hud);
  // Ensure boardBG
  try { board.addChildAt(boardBG, 0); } catch {}
  try { boardBG.zIndex = -1000; board.sortChildren?.(); } catch {}
  // Reset background references so startLevel can recreate safely
  backgroundLayer = null;
  window._ghostPlaceholders = null;
}

// ----- progress wrapper (delegira HUD-u) -----
let hudUpdateProgress = (ratio, animate) => {};
// HUD metrics (for DOM helpers to position UI under HUD)
let __hudMetrics: HudMetrics = { top: 0, bottom: 80 };
let allowWildDecrease = false;
function queueWildSpawnIfNeeded(){
  if (wildSpawnInProgress) return;
  if (wildMeter < 1) return;
  
  // 🎯 BOARD-SPECIFIC RULES: Check if wild spawn is enabled for current board
  if (!isWildSpawnEnabled(boardNumber)) {
    devLog(`🎯 Board ${boardNumber}: Wild spawn disabled - skipping queueWildSpawnIfNeeded`);
    return;
  }
  
  // 🔥 SOURCE OF TRUTH: Preload Bar Logic
  // Case B — 2 tiles stack → result = 6 (NO PRELOAD SPAWN)
  // Preload bar must NOT spawn wild if last merge is in progress (exactly 1 tile = merge-6).
  // hasLastMergeTile also clears stale _isLastMerge when 2+ tiles on board (fix: wild bar blocked mid-game).
  if (hasLastMergeTile({ tiles: STATE.tiles, devLog })) {
    devLog('🚨🚨🚨 SOURCE OF TRUTH: Preload bar blocked (in queueWildSpawnIfNeeded) - last merge detected');
    return;
  }
  if ((window as any).__ccFailScreenPending === true) {
    devLog('⏸️ queueWildSpawnIfNeeded skipped - fail screen pending');
    return;
  }

  devLog('🎯 Wild meter ready – queueing wild spawn');
  wildSpawnInProgress = true;

  try { HUD.shimmerProgress?.(); } catch {}

  spawnWildFromMeter()
    .then((spawned) => {
      if (!spawned && !wildSpawnRetryTimer) {
        wildSpawnRetryTimer = trackAppTimeout(() => {
      wildSpawnRetryTimer = null;
      queueWildSpawnIfNeeded();
    }, 600);
  }
})
    .catch((error) => {
      logger.error('❌ Wild spawn error', 'app-core', error);
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


function setWildProgress(ratio, animate=false){
  devLog('🔥 DRAMATIC: setWildProgress called with:', { ratio, animate });

  const target = Math.max(0, Number.isFinite(ratio) ? ratio : 0);
  wildMeter = target;
  STATE.wildMeter = target; // raw value (may exceed 1)

  const displayRatio = Math.min(1, wildMeter);
  devLog('🔥 DRAMATIC: Wild meter raw:', wildMeter, 'display:', displayRatio);

  try {
    HUD.updateProgressBar?.(displayRatio, !!animate);
    devLog('✅ DRAMATIC: HUD.updateProgressBar called successfully');
  } catch (error) {
    logger.error('❌ DRAMATIC: Error calling HUD.updateProgressBar', 'app-core', error);
  }

  if (wildMeter >= 1) {
    queueWildSpawnIfNeeded();
  }
}
let updateProgressBar = (ratio, animate=false) => setWildProgress(ratio, animate);
function addWildProgress(amount){
  logger.debug('🔥🔥🔥 addWildProgress CALLED', 'app-core', { amount, wildMeter, boardNumber });
  
  // 🎯 BOARD-SPECIFIC RULES: Check if wild meter is enabled for current board
  if (!isWildMeterEnabled(boardNumber)) {
    devLog(`🎯 Board ${boardNumber}: Wild meter disabled - skipping addWildProgress`);
    return;
  }
  
  // 🔥 SOURCE OF TRUTH: Preload Bar Logic
  // Case B — 2 tiles stack → result = 6 (NO PRELOAD SPAWN)
  // Wild meter must NOT fill if last merge is in progress (exactly 1 tile = merge-6).
  // hasLastMergeTile also clears stale _isLastMerge when 2+ tiles on board (fix: wild bar blocked mid-game).
  if (hasLastMergeTile({ tiles: STATE.tiles, devLog })) {
    devLog('🚨🚨🚨 SOURCE OF TRUTH: Preload bar blocked (in addWildProgress) - last merge detected');
    // Reset wild meter to ensure it's empty
    wildMeter = 0;
    STATE.wildMeter = 0;
    try {
      if (typeof HUD.resetWildMeter === 'function') {
        HUD.resetWildMeter(true);
        devLog('✅ LAST MERGE (addWildProgress): Wild meter reset in HUD');
      }
    } catch (error) {
      logger.warn('⚠️ LAST MERGE (addWildProgress): Failed to reset wild meter in HUD', 'app-core', error);
    }
    return;
  }
  // 🔥 BUG FIX: Block wild meter fill when fail screen is pending
  if ((window as any).__ccFailScreenPending === true) {
    devLog('⏸️ addWildProgress skipped - fail screen pending');
    return;
  }
  
  // Kill any existing animations and smoke interval first
  try {
    if (wild?.view?._smokeInterval) {
      clearInterval(wild.view._smokeInterval);
      wild.view._smokeInterval = null;
    }
    gsap.killTweensOf(wild?.view?._fill);
    if (wild?.view?._currentAnimation) {
      wild.view._currentAnimation.kill();
      wild.view._currentAnimation = null;
    }
    devLog('🔥 addWildProgress: Previous animations killed');
  } catch (e) {
    logger.warn('⚠️ addWildProgress: Error killing animations', 'app-core', e);
  }
  
  const inc = Number.isFinite(amount) ? amount : 0;
  if (inc <= 0) {
    devLog('⚠️ addWildProgress: Ignoring non-positive increment:', inc);
    return;
  }

  // 🎯 BOARD-SPECIFIC RULES: Apply wild meter fill rate multiplier
  const fillRate = getWildMeterFillRate(boardNumber);
  // 🔥 USER REQUEST: Reduce wild meter fill rate by 40% for all boards
  const globalSlowdown = 0.6; // 40% slower = 60% of original speed
  
  // 🔥 iPad BALANCE FIX: Zadrži isti relativni omjer kao prije (0.714/0.8 ≈ 0.8925)
  const isIPad = typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth <= 1024;
  const iPadSlowdown = isIPad ? (globalSlowdown * 0.8925) : 1.0; // ~0.536 s globalSlowdown=0.6
  
  // After first 2 spawned wilds, make next wild take 15% longer to charge.
  // +15% time => increment multiplier 1 / 1.15.
  const postSecondWildMultiplier = wildSpawnCount >= 2 ? (1 / 1.15) : 1.0;
  const adjustedInc = inc * fillRate * globalSlowdown * iPadSlowdown * postSecondWildMultiplier;
  devLog(`🎯 Board ${boardNumber}: Wild meter fill rate: ${fillRate}x, global slowdown: ${globalSlowdown}x, iPad slowdown: ${iPadSlowdown}x, post-second-wild multiplier: ${postSecondWildMultiplier}x, wildSpawnCount: ${wildSpawnCount}, adjusted increment: ${adjustedInc} (from ${inc})`);

  const target = wildMeter + adjustedInc;
  devLog('🔥 NEW LOGIC: Direct wild meter update to raw value:', target);
  setWildProgress(target, true);

  // DEBUG: Force test wild meter with clamped ratio
  const displayRatio = Math.min(1, wildMeter);
  devLog('🧪 DEBUG: Testing wild meter directly...');
  devLog('🧪 DEBUG: wild available:', !!wild);
  devLog('🧪 DEBUG: wild.setProgress available:', !!(wild && wild.setProgress));
  if (wild && wild.setProgress) {
    wild.setProgress(displayRatio, true);
    devLog('✅ DEBUG: Direct wild.setProgress called with display ratio:', displayRatio);
  } else {
    devWarn('⚠️ DEBUG: wild or wild.setProgress not available');
  }
}
function resetWildProgress(value=0, animate=false){
  allowWildDecrease = true;
  setWildProgress(value, animate);
  allowWildDecrease = false;
}

// 🔥 v112: ensureFonts moved to app-core-helpers.ts
// Imported: ensureFonts

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

// 🔥 v112: loadFirstTexture moved to app-core-helpers.ts
// Imported: loadFirstTexture

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
  devLog('🎮 Initializing PIXI app');
  // 🔥 CRITICAL: Start loading LTCrow font early - HUD text shows black boxes if font isn't ready
  ensureFonts().catch(() => {});
  // Fade out menu soundtrack when entering board game without board transition (e.g. direct continue)
  try {
    const { fadeOutAndPause } = await import('./soundtrack-manager.js');
    fadeOutAndPause(2000);
  } catch (_) { /* ignore */ }
  const reuseApp = !!(app && !app.destroyed && app.renderer && app.canvas);
  if (reuseApp) {
    devLog('♻️ Reusing existing PIXI app (soft reset)');
  }
  
  // Reset user made move flag for new game
  window._userMadeMove = false;
  devLog('🔄 Reset user made move flag for new game');

  // 🔥 Stability: track GSAP tickers globally (install once)
  try { installGsapTickerTracking(); } catch {}

  // 🔥 Stability: global navigation cleanup hook (install once)
  if (!__ccNavigationCleanupInstalled) {
    __ccNavigationCleanupInstalled = true;
    try {
      window.addEventListener('cc-navigation', () => {
        // Small delay to allow exit animations to settle
        try {
          if (__ccNavCleanupTimer) {
            clearTimeout(__ccNavCleanupTimer);
            __ccNavCleanupTimer = null;
          }
          __ccNavCleanupTimer = window.setTimeout(() => {
            __ccNavCleanupTimer = null;
            try { cleanupFxForBoardReset('cc-navigation'); } catch {}
            try { softResetBoardView('cc-navigation'); } catch {}
          }, 220);
        } catch {
          try { cleanupFxForBoardReset('cc-navigation'); } catch {}
          try { softResetBoardView('cc-navigation'); } catch {}
        }
      });
    } catch {}
  }
  
  // CRITICAL: Check for unsaved high score on boot
  trackAppTimeout(() => {
    if (typeof window.checkForUnsavedHighScore === 'function') {
      window.checkForUnsavedHighScore();
    }
  }, 2000);
  
  // 🔥🔥🔥 NUCLEAR CLEANUP: Kill EVERYTHING before destroying old app (hard reset only) 🔥🔥🔥
  // This is the ROOT CAUSE of _x null errors - old GSAP callbacks try to access destroyed objects
  if (!reuseApp) {
    devLog('🔥 NUCLEAR CLEANUP: Killing all animations and clearing all references...');
    
    // Step 1: Kill ALL GSAP tweens globally - this is the KEY fix
    try {
      gsap.killTweensOf('*'); // Kill all tweens on all targets
      gsap.globalTimeline.clear(); // Clear the global timeline
      devLog('✅ Killed ALL GSAP tweens globally');
    } catch (gsapError) {
      devWarn('⚠️ Error killing GSAP tweens:', gsapError);
    }
    
    // Step 2: Kill tweens on specific known targets (belt and suspenders approach)
    try {
      if (tiles && tiles.length > 0) {
        tiles.forEach(tile => {
          try { gsap.killTweensOf(tile); } catch {}
          try { if (tile?.scale) gsap.killTweensOf(tile.scale); } catch {}
        });
      }
      if (board) gsap.killTweensOf(board);
      if (stage) gsap.killTweensOf(stage);
      if (hud) gsap.killTweensOf(hud);
      devLog('✅ Killed tweens on known PIXI objects');
    } catch (e) {
      devWarn('⚠️ Error killing specific tweens:', e);
    }
    
    // Step 3: Clear module-level tile array to prevent stale references
    try {
      if (tiles) {
        tiles.length = 0; // Clear array without reassigning
      }
      if (STATE.tiles) {
        STATE.tiles.length = 0;
      }
      devLog('✅ Cleared tiles arrays');
    } catch (e) {
      devWarn('⚠️ Error clearing tiles:', e);
    }
  }
  
  // Step 4: Stop PIXI ticker BEFORE any destroy operations (only on hard reset)
  if (!reuseApp && app && app.ticker) {
    try {
      app.ticker.stop();
      devLog('✅ PIXI ticker stopped');
    } catch (tickerError) {
      devWarn('⚠️ Error stopping ticker:', tickerError);
    }
  }
  
  // Step 5: Clear stage children BEFORE destroy (cleaner removal from render tree)
  // 🔥 CRITICAL FIX: Preserve bubbles explosion container if active before removing stage children
  if (!reuseApp && app && app.stage) {
    try {
      // Check if wild juice bubbles explosion is active and preserve its container
      try {
        const { isWildJuiceBubblesExplosionActive, getExplosionContainer } = await import('./wild-juice-bubbles-explosion.js');
        if (isWildJuiceBubblesExplosionActive && isWildJuiceBubblesExplosionActive()) {
          const bubblesContainer = getExplosionContainer && getExplosionContainer();
          if (bubblesContainer && !bubblesContainer.destroyed && bubblesContainer.parent) {
            // Remove container from its parent BEFORE removeChildren() destroys it
            try {
              bubblesContainer.parent.removeChild(bubblesContainer);
              (window as any).__ccPreservedBubblesContainer = bubblesContainer;
              devLog('💧 boot: Preserved bubbles explosion container before stage cleanup', {
                containerVisible: bubblesContainer.visible,
                containerAlpha: bubblesContainer.alpha,
                containerChildren: bubblesContainer.children?.length || 0
              });
            } catch (preserveError) {
              devWarn('⚠️ boot: Failed to preserve bubbles container:', preserveError);
            }
          }
        }
      } catch (importError) {
        // Silently fail - module might not be available
      }
      
      app.stage.removeChildren();
      devLog('✅ Stage children removed');
    } catch (e) {
      devWarn('⚠️ Error removing stage children:', e);
    }
  }
  
  // Step 6: Clear references BEFORE destroy (hard reset only)
  if (!reuseApp) {
    stage = null as any;
    board = null as any;
    hud = null as any;
  }
  
  // 🔥 CRITICAL FIX: DESTROY existing app if it exists (hard reset only)
  if (!reuseApp && app && app.canvas) {
    devLog('🧹 Destroying existing PIXI app');
    
    // 🔥 CRITICAL: Hide canvas IMMEDIATELY before destroy to prevent flash
    app.canvas.style.opacity = '0';
    app.canvas.style.visibility = 'hidden';
    try {
      // 🔥 FIX: Don't destroy textures - they're managed by Assets and should be unloaded, not destroyed
      // Destroying Assets-managed textures causes PixiJS warnings
      app.destroy(true, { children: true, texture: false, textureSource: false } as any);
    } catch (e) {
      devLog('⚠️ Error destroying app:', e);
    }
    app = null as any;
  }
  
  // 🔥 CRITICAL FIX: Clear global HUD_ROOT reference before creating new app (hard reset only)
  // This prevents stale HUD from flashing during reinit
  if (!reuseApp) {
    try {
      if ((window as any).HUD_ROOT) {
        const oldHud = (window as any).HUD_ROOT;
        try { gsap.killTweensOf(oldHud); } catch {}
        try { oldHud.alpha = 0; } catch {}
        try { oldHud.visible = false; } catch {}
        (window as any).HUD_ROOT = null;
        devLog('✅ Cleared stale HUD_ROOT reference');
      }
    } catch (e) {
      devLog('⚠️ Error clearing HUD_ROOT:', e);
    }
  }
  
  devLog('✅ NUCLEAR CLEANUP complete - safe to create new app');
  
  // 🔥 CRITICAL FIX: Clear ALL existing canvas elements from DOM (hard reset only)
  // This prevents leftover canvas elements from showing when starting new game
  const host = document.getElementById('app') || document.body;
  if (!reuseApp) {
    try {
      // Remove all canvas elements from app container
      const existingCanvases = host.querySelectorAll('canvas');
      existingCanvases.forEach(canvas => {
        try {
          canvas.remove();
          devLog('✅ Removed existing canvas from DOM');
        } catch (e) {
          devWarn('⚠️ Failed to remove canvas:', e);
        }
      });
      
      // Also check body for any stray canvas elements
      const bodyCanvases = document.body.querySelectorAll('canvas');
      bodyCanvases.forEach(canvas => {
        // Only remove if it's part of app container
        if (canvas.parentElement === host || canvas.parentElement === document.body) {
          try {
            canvas.remove();
            devLog('✅ Removed stray canvas from body');
          } catch (e) {
            devWarn('⚠️ Failed to remove stray canvas:', e);
          }
        }
      });
    } catch (e) {
      devWarn('⚠️ Error removing existing canvas elements:', e);
    }
  }
  
  if (!reuseApp) {
    devLog('🎮 Creating fresh PIXI app');
    const initOptions = {
      resizeTo: window,
      backgroundAlpha: 0,
      antialias: false,
      resolution: window.devicePixelRatio || 1,
      powerPreference: "high-performance" as const
    };
    const isTransientRendererInitError = (error: unknown): boolean => {
      const msg = String((error as any)?.message || error || '');
      return /Failed to fetch dynamically imported module/i.test(msg) ||
        /WebGLRenderer/i.test(msg) ||
        /ERR_CONNECTION_REFUSED/i.test(msg);
    };
    const maxInitAttempts = 3;
    let initError: unknown = null;
    for (let attempt = 1; attempt <= maxInitAttempts; attempt++) {
      app = new Application();
      try {
        await app.init(initOptions);
        initError = null;
        if (attempt > 1) {
          devWarn(`✅ PIXI init recovered on retry ${attempt}/${maxInitAttempts}`);
        }
        break;
      } catch (error) {
        initError = error;
        try { app.destroy(true, true); } catch {}
        app = null as any;
        if (attempt < maxInitAttempts && isTransientRendererInitError(error)) {
          const retryDelayMs = 250 * attempt;
          devWarn(`⚠️ PIXI init failed (attempt ${attempt}/${maxInitAttempts}) - retrying in ${retryDelayMs}ms`, error);
          await waitTracked(retryDelayMs);
          continue;
        }
        throw error;
      }
    }
    if (initError) {
      throw initError;
    }
  } else {
    // Ensure renderer is active on reuse
    try { app.ticker.start(); } catch {}
  }

  // Install runtime texture hooks (canvas + generateTexture)
  installRuntimeTextureHooks();
  try {
    const rendererAny = app.renderer as any;
    if (rendererAny && !rendererAny.__ccGenerateTextureWrapped) {
      const origGenerate = rendererAny.generateTexture?.bind(app.renderer);
      if (origGenerate) {
        rendererAny.generateTexture = (...args: any[]) => {
          const tex = origGenerate(...args);
          try {
            if (tex && !tex.label) {
              const w = tex.width || tex.baseTexture?.width || 0;
              const h = tex.height || tex.baseTexture?.height || 0;
              tex.label = `runtime:generateTexture:${w}x${h}`;
              const texSrc = (tex as { source?: { label?: string }; baseTexture?: { label?: string } }).source ?? tex.baseTexture;
              if (texSrc) texSrc.label = tex.label;
              const rt = (window as any).__ccRuntimeTextures || ((window as any).__ccRuntimeTextures = new Set());
              rt.add?.(tex);
            }
          } catch {}
          return tex;
        };
        rendererAny.__ccGenerateTextureWrapped = true;
      }
    }
  } catch {}
  
  // 🔥 CRITICAL FIX: Ensure app is rendering
  devLog('✅ PIXI app initialized');
  devLog('✅ App renderer width:', app.renderer.width, 'height:', app.renderer.height);
  devLog('✅ App canvas width:', app.canvas.width, 'height:', app.canvas.height);
  devLog('✅ App canvas in DOM:', !!app.canvas.parentElement);
  
  // Add fade in animation for background transition
  // 🔥 CRITICAL FIX: Only auto-show canvas if NOT coming from Journey (saved game)
  // When coming from Journey, canvas stays hidden until HUD drop starts
  app.canvas.style.opacity = '0';
  app.canvas.style.transition = 'opacity 0.6s ease';
  const cameFromJourney = window.__ccCameFromJourney;
  if (!cameFromJourney) {
    trackAppTimeout(() => {
      app.canvas.style.opacity = '1';
    }, 50);
  } else {
    devLog('🎯 Canvas kept hidden - will show when HUD drop starts');
  }
  
  // 🔥 CRITICAL: Set background to #F9F9F9 during launch (matches launch screen)
  // Gradient will be set by launch-screen.ts in Phase 2, or by ui-manager.ts after launch
  const rendererAny = app.renderer as any;
  rendererAny.backgroundColor = 0x000000;
  rendererAny.backgroundAlpha = 0; // Transparent so paper BG shows behind board + HUD
  
  // 🔥 CRITICAL: Set paper background to 35% opacity IMMEDIATELY when booting game
  // This MUST happen BEFORE any other code that might override it
  const appElement = document.getElementById('app');
  const canvasElement = app.canvas;
  // Set paper strength for board game only (global background stays the same)
  // 35% opacity for board game paper texture
  const paperAlpha = 0.35;
  document.documentElement?.style.setProperty('--paper-alpha', paperAlpha.toString());
  
  // Apply paper background with 35% opacity to body/html/global-bg
  const overlayAlpha = 1 - paperAlpha; // 0.65 overlay = 35% paper visible
  const backgroundLayers = overlayAlpha > 0.01
    ? `linear-gradient(rgba(243,238,232,${overlayAlpha}), rgba(243,238,232,${overlayAlpha})), url('./assets/paper-bg.png')`
    : `url('./assets/paper-bg.png')`;
  
  const body = document.body;
  const html = document.documentElement;
  const globalBg = document.getElementById('global-bg');
  
  // 🔥 CRITICAL: Set paper bg with !important IMMEDIATELY to prevent override
  if (body) {
    body.style.setProperty('background-color', '#f3eee8', 'important');
    body.style.setProperty('background-image', backgroundLayers, 'important');
    body.style.setProperty('background-size', '100% 100%', 'important');
    body.style.setProperty('background-repeat', 'no-repeat', 'important');
    body.style.setProperty('background-position', 'center', 'important');
  }
  if (html) {
    html.style.setProperty('background-color', '#f3eee8', 'important');
    html.style.setProperty('background-image', backgroundLayers, 'important');
    html.style.setProperty('background-size', '100% 100%', 'important');
    html.style.setProperty('background-repeat', 'no-repeat', 'important');
    html.style.setProperty('background-position', 'center', 'important');
  }
  if (globalBg) {
    (globalBg as HTMLElement).style.setProperty('background-color', '#f3eee8', 'important');
    (globalBg as HTMLElement).style.setProperty('background-image', backgroundLayers, 'important');
    (globalBg as HTMLElement).style.setProperty('background-size', '100% 100%', 'important');
    (globalBg as HTMLElement).style.setProperty('background-repeat', 'no-repeat', 'important');
    (globalBg as HTMLElement).style.setProperty('background-position', 'center', 'important');
  }
  
  // Keep app and canvas transparent to show paper background behind
  if (appElement) {
    appElement.style.setProperty('background', 'transparent', 'important');
    appElement.style.setProperty('background-image', 'none', 'important');
  }
  if (canvasElement) {
    canvasElement.style.setProperty('background', 'transparent', 'important');
    canvasElement.style.setProperty('background-image', 'none', 'important');
  }
  
  devLog(`📄 Board game paper background set IMMEDIATELY: alpha=${paperAlpha}, overlayAlpha=${overlayAlpha}, visible=${paperAlpha * 100}%`);
  // 🔥 CRITICAL FIX: Ensure host element exists and is visible before adding canvas
  if (!host) {
    devError('❌ Host element not found! Cannot add canvas to DOM');
    return;
  }
  
  // Ensure host element is visible
  if (host instanceof HTMLElement) {
    host.style.display = 'block';
    host.style.visibility = 'visible';
    host.style.opacity = '1';
    devLog('✅ Host element made visible before adding canvas');
  }
  
  if (!reuseApp) {
    host.appendChild(app.canvas);
  }
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
  
  // 🔥 CRITICAL: Wait for Pixi to render first frame
  // Note: Boot class is already removed in launch-screen.ts after launch sequence completes
  // This is just a safety check in case boot() is called before launch screen completes
  let firstFrameRendered = false;
  const onFirstFrame = () => {
    if (firstFrameRendered) return;
    firstFrameRendered = true;
    
    // 🔥 CRITICAL: Remove boot class if it still exists (safety check)
    // This should already be removed by launch-screen.ts, but we do it here as fallback
    try {
      if (document.documentElement && document.documentElement.classList.contains('boot')) {
        document.documentElement.classList.remove('boot');
        document.documentElement.style.background = '';
        document.documentElement.style.backgroundColor = '';
        devLog('✅ Boot class removed after first frame (fallback)');
      }
      if (document.body && document.body.classList.contains('boot')) {
        document.body.classList.remove('boot');
        document.body.style.background = '';
        document.body.style.backgroundColor = '';
      }
    } catch(e) {
      devWarn('⚠️ Failed to remove boot class:', e);
    }
    
    // 🔥 CRITICAL: Native splash is already hidden in main.ts when loading screen is shown
    // No need to hide it again here - it's already hidden
    devLog('✅ First Pixi frame rendered - native splash already hidden');
    
    // Remove ticker listener after first frame
    app.ticker.remove(onFirstFrame);
  };
  
  // Listen for first frame render
  app.ticker.add(onFirstFrame);
  app.canvas.style.left = '0';
  app.canvas.style.pointerEvents = 'auto';
  devLog('✅ Canvas added to DOM and styled');
  devLog('✅ Canvas in DOM:', !!app.canvas.parentElement);
  devLog('✅ Canvas visible:', app.canvas.style.visibility, 'display:', app.canvas.style.display, 'opacity:', app.canvas.style.opacity);
  
  // Optimize canvas for pixel-perfect rendering
  app.canvas.style.imageRendering = 'pixelated';
  app.canvas.style.imageRendering = '-webkit-optimize-contrast';
  
  // Basic setup
  stage   = app.stage; stage.sortableChildren = true;
  // 🔥 CRITICAL: Ensure stage is visible after clean-board modal hides it
  stage.visible = true;
  stage.alpha = 1;
  stage.renderable = true;

  if (reuseApp && board && hud && !board.destroyed && !hud.destroyed) {
    // 🔥 CRITICAL FIX: Reuse existing board/hud when app is reused (e.g. interim → clean board → next board)
    // Creating new Container() and stage.addChild() would leave OLD board/hud on stage → duplicate children + memory leak → app reset
    devLog('♻️ boot (reuse): Keeping existing board and hud containers');
    board.visible = true;
    board.alpha = 1;
    board.renderable = true;
    hud.visible = true;
    hud.alpha = 1;
    hud.renderable = true;
  } else {
    board   = new Container(); board.sortableChildren = true;
    boardBG = new Graphics();
    hud     = new Container(); hud.eventMode = 'none';
    board.visible = true;
    board.alpha = 1;
    board.renderable = true;
    hud.visible = true;
    hud.alpha = 1;
    hud.renderable = true;
    board.zIndex = 100; hud.zIndex = 10000;
    stage.addChild(board, hud);
    board.addChildAt(boardBG, 0); boardBG.zIndex = -1000; board.sortChildren();
  }

  // 🔥 CRITICAL FIX: Clear backgroundLayer reference after boot() destroys old app (or on reuse so startLevel recreates it)
  // This ensures that backgroundLayer will be recreated in startLevel()
  backgroundLayer = null;
  window._ghostPlaceholders = null;
  devLog('✅ boot: Cleared backgroundLayer and window._ghostPlaceholders references (will be recreated in startLevel)');
  
  // 🔥 CRITICAL FIX: Restore preserved bubbles explosion container to new stage
  const preservedBubblesContainer = (window as any).__ccPreservedBubblesContainer;
  if (preservedBubblesContainer && !preservedBubblesContainer.destroyed) {
    try {
      // Use dynamic import to restore bubbles container
      import('./wild-juice-bubbles-explosion.js').then(({ setExplosionContainer }) => {
        if (setExplosionContainer && preservedBubblesContainer && !preservedBubblesContainer.destroyed) {
          // Restore the module's internal reference to the container
          setExplosionContainer(preservedBubblesContainer);
          
          // Ensure FX layer exists (create if needed, similar to getFxHost in bubbles module)
          let fxLayer = (window as any).__ccGlobalFxLayer;
          const needsNew = !fxLayer || fxLayer.destroyed || fxLayer.parent !== stage;
          if (needsNew) {
            try {
              fxLayer = new Container();
              fxLayer.label = '__ccGlobalFxLayer';
              fxLayer.zIndex = 999900; // Below bubbles container but above everything else
              fxLayer.eventMode = 'none';
              fxLayer.visible = true;
              fxLayer.alpha = 1.0;
              fxLayer.renderable = true;
              fxLayer.position.set(0, 0);
              fxLayer.scale.set(1, 1);
              try { fxLayer.interactiveChildren = false; } catch {}
              if (stage.sortableChildren !== undefined) {
                stage.sortableChildren = true;
              }
              stage.addChild(fxLayer);
              stage.sortChildren?.();
              (window as any).__ccGlobalFxLayer = fxLayer;
              devLog('💧 boot: Created new FX layer for bubbles container restoration');
            } catch (e) {
              devWarn('⚠️ boot: Failed to create FX layer:', e);
              fxLayer = stage; // Fallback to stage
            }
          }
          
          // Wait a frame to ensure stage is fully initialized
          trackAppAnimationFrame(() => {
            if (fxLayer && !fxLayer.destroyed && preservedBubblesContainer && !preservedBubblesContainer.destroyed) {
              // Ensure container properties are correct
              preservedBubblesContainer.visible = true;
              preservedBubblesContainer.alpha = 1.0;
              preservedBubblesContainer.renderable = true;
              preservedBubblesContainer.zIndex = 999999;
              
              // Add container to FX layer
              if (fxLayer.sortableChildren !== undefined) {
                fxLayer.sortableChildren = true;
              }
              fxLayer.addChild(preservedBubblesContainer);
              fxLayer.sortChildren?.();
              
              // Ensure container is at the top of display list
              const currentIndex = fxLayer.getChildIndex(preservedBubblesContainer);
              const lastIndex = fxLayer.children.length - 1;
              if (currentIndex !== lastIndex) {
                fxLayer.removeChild(preservedBubblesContainer);
                fxLayer.addChild(preservedBubblesContainer);
                preservedBubblesContainer.zIndex = 999999;
                fxLayer.sortChildren?.();
              }
              
              // Force render to ensure visibility
              try {
                app.renderer.render(stage);
              } catch {}
              
              devLog('💧 boot: Restored bubbles explosion container to new stage', {
                containerVisible: preservedBubblesContainer.visible,
                containerAlpha: preservedBubblesContainer.alpha,
                containerChildren: preservedBubblesContainer.children?.length || 0,
                containerInStage: !!(preservedBubblesContainer.parent),
                fxLayerChildren: fxLayer.children.length
              });
              
              // Clear global reference after successful restoration
              delete (window as any).__ccPreservedBubblesContainer;
            } else {
              devWarn('⚠️ boot: Cannot restore bubbles container - FX layer or container invalid', {
                hasFxLayer: !!fxLayer,
                fxLayerDestroyed: fxLayer?.destroyed,
                containerDestroyed: preservedBubblesContainer?.destroyed
              });
              delete (window as any).__ccPreservedBubblesContainer;
            }
          });
        }
      }).catch((restoreError) => {
        devWarn('⚠️ boot: Failed to restore bubbles container:', restoreError);
        delete (window as any).__ccPreservedBubblesContainer;
      });
    } catch (restoreError) {
      devWarn('⚠️ boot: Failed to import bubbles module for restoration:', restoreError);
      delete (window as any).__ccPreservedBubblesContainer;
    }
  }
  
  devLog('✅ Board and HUD containers created and added to stage');
  devLog('✅ Board visible:', board.visible, 'alpha:', board.alpha, 'renderable:', board.renderable, 'in stage:', !!board.parent);
  devLog('✅ HUD visible:', hud.visible, 'alpha:', hud.alpha, 'renderable:', hud.renderable, 'in stage:', !!hud.parent);
  devLog('✅ Stage children count:', stage.children.length);
  devLog('✅ Stage visible:', stage.visible, 'renderable:', stage.renderable);
  
  // 🔥 CRITICAL FIX: Force render to ensure everything is visible
  try {
    app.renderer.render(stage);
    devLog('✅ Initial render completed');
  } catch (e) {
    devWarn('⚠️ Failed to perform initial render:', e);
  }
  
  // Initialize fixed background layer AFTER layout is set
  // (will be called from startGame after layout())
  
  syncSharedState();

  stage.eventMode = 'static';
  stage.hitArea   = new Rectangle(0, 0, app.renderer.width, app.renderer.height);

  // Resolve prize assets - DEFER non-critical prize loading to avoid delay
  // These are only needed during endgame, not for initial board
  trackAppTimeout(() => {
    loadFirstTexture(MYSTERY_CANDIDATES).then(path => { MYSTERY_PATH = path; }).catch(() => {});
    loadFirstTexture(COIN_CANDIDATES).then(path => { COIN_PATH = path; }).catch(() => {});
  }, 0);

  // 🔥 CRITICAL: Load HUD icons into PIXI Assets cache BEFORE any other assets
  // This MUST be done before layoutBoard() initializes HUD
  // HUD icons MUST be available when HUD.initHUD() is called
  // 🔥 OPTIMIZATION: Load HUD icons with timeout to prevent long waits after hard exit
  // Icons will load lazily if they're not ready, so we don't block board initialization
  try {
    const { loadHudIconsIntoPixiCache } = await import('../utils/comprehensive-image-preloader.js');
    devLog('🎮 Loading HUD icons into PIXI Assets cache (with timeout protection)...');
    // 🔥 CRITICAL: Don't wait forever - timeout is handled inside loadHudIconsIntoPixiCache
    // This prevents long delays after hard exit when cache is empty
    await loadHudIconsIntoPixiCache();
    devLog('✅ HUD icons loaded into PIXI Assets cache');
  } catch (error) {
    devError('❌ CRITICAL: Failed to load HUD icons into PIXI Assets cache:', error);
    // Continue anyway - HUD will try to load icons asynchronously
  }
  
  // Load ONLY critical game assets for instant start
  // tile_numbers2/3/4 are deferrable - can load in background
  // 🔥 CRITICAL: ASSET_WILD_JUICE and ASSET_WILD_TNT MUST be loaded for wild-juice/wild-tnt tiles to display correctly
  // 🔥 FIX: Only load assets that aren't already in cache to avoid "already has key" warnings
  const criticalAssets = [ASSET_TILE, ASSET_NUMBERS, ASSET_WILD, ASSET_WILD_MAGNET, ASSET_WILD_JUICE, ASSET_WILD_TNT];
  const assetsToLoad = criticalAssets.filter(asset => !Assets.cache.has(asset));
  if (assetsToLoad.length > 0) {
    await Assets.load(assetsToLoad);
  }
  
  // Load additional tile number sheets in background (non-blocking)
  const additionalAssets = [ASSET_NUMBERS2, ASSET_NUMBERS3, ASSET_NUMBERS4];
  const additionalToLoad = additionalAssets.filter(asset => !Assets.cache.has(asset));
  if (additionalToLoad.length > 0) {
    Assets.load(additionalToLoad).catch(() => {});
  }
  
  // Optimize all loaded textures for pixel-perfect rendering
  // 🔥 CRITICAL: Include ASSET_WILD_JUICE and ASSET_WILD_TNT in loaded textures list
  const loadedTextures = [ASSET_TILE, ASSET_NUMBERS, ASSET_NUMBERS2, ASSET_NUMBERS3, ASSET_NUMBERS4, ASSET_WILD, ASSET_WILD_MAGNET, ASSET_WILD_JUICE, ASSET_WILD_TNT];
  for (const assetPath of loadedTextures) {
    try {
      const texture = Assets.get(assetPath);
      const src = texture && ((texture as { source?: { scaleMode?: string } }).source ?? (texture as { baseTexture?: { scaleMode?: string } }).baseTexture);
      if (src) src.scaleMode = 'nearest';
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
        devLog('🔥 canDrop (app-core): Invalid destination (null, locked, or value = 0)');
        return false;
      }
      
      const sv = (s && (s.value|0)) || 0;
      const dv = (d && (d.value|0)) || 0;
      
      // WILD-MAGNET LOGIC: Can go on anything except wild and wild-magnet, and anything can go on it
      const srcIsWildMagnet = s?.special === 'wild-magnet';
      const dstIsWildMagnet = d?.special === 'wild-magnet';
      const srcIsWild = s?.special === 'wild' || s?.special === 'wild-juice' || s?.special === 'wild-tnt';
      const dstIsWild = d?.special === 'wild' || d?.special === 'wild-juice' || d?.special === 'wild-tnt';
      
      if (srcIsWildMagnet) {
        // Wild-magnet cannot merge into wild or wild-magnet
        if (dstIsWild || dstIsWildMagnet) {
          devLog('🔥 canDrop (app-core): Wild-magnet cannot merge into wild or wild-magnet');
          return false;
        }
        // Wild-magnet can merge into any normal tile
        devLog('🔥 canDrop (app-core): Wild-magnet can merge into normal tile');
        return true;
      }
      
      if (dstIsWildMagnet) {
        // Any tile can merge into wild-magnet (except wild and wild-magnet)
        if (srcIsWild || srcIsWildMagnet) {
          devLog('🔥 canDrop (app-core): Wild or wild-magnet cannot merge into wild-magnet');
          return false;
        }
        // Normal tiles can merge into wild-magnet
        devLog('🔥 canDrop (app-core): Normal tile can merge into wild-magnet');
        return true;
      }
      
      const wild = (srcIsWild || dstIsWild);
      
      // WILD LOGIC: Wild cube cannot merge into same value
      if (wild) {
        if (srcIsWild && !dstIsWild) {
          // Wild merging into normal tile - check if target value is different
          const canMerge = sv !== dv;
          // 🔥 PERFORMANCE: Removed console.log to prevent lag during drag (called hundreds of times)
          // devLog('🔥 canDrop (app-core): Wild merge check (wild->normal):', { wildValue: sv, targetValue: dv, canMerge });
          return canMerge;
        } else if (dstIsWild && !srcIsWild) {
          // Normal tile merging into wild - check if source value is different
          const canMerge = sv !== dv;
          // 🔥 PERFORMANCE: Removed console.log to prevent lag
          // devLog('🔥 canDrop (app-core): Wild merge check (normal->wild):', { sourceValue: sv, wildValue: dv, canMerge });
          return canMerge;
        } else if (srcIsWild && dstIsWild) {
          // Wild merging into wild - not allowed
          // 🔥 PERFORMANCE: Removed console.log to prevent lag
          // devLog('🔥 canDrop (app-core): Wild merge check (wild->wild): not allowed');
          return false;
        }
      }
      
      // 🔥 CRITICAL: If one tile is wild-magnet affected, it can merge with the other
      const srcIsWildMagnetAffected = (s as any)?._wildMagnetAffected === true;
      const dstIsWildMagnetAffected = (d as any)?._wildMagnetAffected === true;
      
      // 🔥 CRITICAL: Only allow merge if BOTH tiles are wild-magnet affected (pulled tiles merging together)
      // If only one is affected, block the merge (protected tile cannot merge with other tiles)
      if (srcIsWildMagnetAffected && dstIsWildMagnetAffected) {
        devLog('🧲 canDrop (app-core): Both tiles are wild-magnet affected (pulled tiles) - can merge');
        return true;
      }
      
      // 🔥 CRITICAL: Block merge if only one tile is wild-magnet affected (protected tile)
      if (srcIsWildMagnetAffected || dstIsWildMagnetAffected) {
        devLog('🛡️ canDrop (app-core): One tile is wild-magnet affected (protected) - blocking merge with other tiles');
        return false;
      }
      
      // NORMAL LOGIC: Regular merge rules
      if (!Number.isFinite(sv) || !Number.isFinite(dv)) return false;
      if (sv === dv) return (sv + dv) <= 6;  // allow same value only when sum<=6 (3+3 OK, 4+4 and 5+5 must snap back)
      
      // 🔥 NEW: Allow wild star to merge with merge 6 tile (value 6)
      // Wild star (special='wild') can merge with merge 6 tile to create new merge 6
      const sIsWild = s?.special === 'wild' || s?.special === 'wild-juice' || s?.special === 'wild-tnt';
      const dIsWild = d?.special === 'wild' || d?.special === 'wild-juice' || d?.special === 'wild-tnt';
      if ((sIsWild && dv === 6 && !d?.special) || (dIsWild && sv === 6 && !s?.special)) {
        devLog('⭐ canDrop (app-core): Wild star can merge with merge 6 tile');
        return true; // Allow wild star to merge with merge 6
      }
      
      // 🔥 CRITICAL FIX: Allow merge 6 tile (value 6) to merge with any tile (value 1-5)
      // This allows user to merge spawned tiles with merge 6 tile that remained after magnet pull
      // Merge 6 tile should be removable by merging with any spawned tile
      if (dv === 6 && sv > 0 && sv < 6) {
        devLog('🔥 canDrop (app-core): Merge 6 tile can merge with tile value', sv);
        return true; // Allow merge 6 to merge with any tile (1-5)
      }
      if (sv === 6 && dv > 0 && dv < 6) {
        devLog('🔥 canDrop (app-core): Tile value', sv, 'can merge with merge 6 tile');
        return true; // Allow any tile (1-5) to merge with merge 6
      }
      
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
  const forcedStartLevel = Number(window.__ccStartAtLevel);
  if (Number.isFinite(forcedStartLevel) && forcedStartLevel >= 1) {
    delete window.__ccStartAtLevel;
    boardNumber = forcedStartLevel | 0;
    moves = MOVES_MAX;
    devLog('🎯 boot(): Starting at requested board', boardNumber);
    startLevel(boardNumber);
  } else {
    boardNumber = 1;
    moves = MOVES_MAX;
    // 🔥 CRITICAL FIX: Ensure board and hud are visible before starting level
    if (board) {
      board.visible = true;
      board.alpha = 1;
      board.renderable = true;
      devLog('✅ Board made visible in boot() before startLevel');
    }
    if (hud) {
      hud.visible = true;
      hud.alpha = 1;
      hud.renderable = true;
      devLog('✅ HUD made visible in boot() before startLevel');
    }
    startLevel(1);
  }
  
  // 🔥 CRITICAL FIX: Final check - ensure board and hud are visible after startLevel
  trackAppTimeout(() => {
    if (board) {
      board.visible = true;
      board.alpha = 1;
      board.renderable = true;
      devLog('✅ Board visibility confirmed after startLevel (delayed check)');
    }
    if (hud) {
      hud.visible = true;
      hud.alpha = 1;
      hud.renderable = true;
      devLog('✅ HUD visibility confirmed after startLevel (delayed check)');
    }
  }, 100);
  
  // Force HUD reinit after board numbering changes
  _hudInitDone = false;
  trackAppListener(window, 'resize', layoutBoard);
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
    devLog('🧪 Testing: Triggering clean board screen from menu Done button');
    
    // 🔥 FIX: Use triggerCleanBoardFlow for consistency with all other clean board paths
    await triggerCleanBoardFlow('clean_board_from_test_overlay');
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
    triggerCleanBoardFlow: (reason: string) => triggerCleanBoardFlow(reason), // 🔥 CRITICAL: Export for consistent clean board flow from all paths
    checkLevelEnd: () => checkLevelEnd(), // Export checkLevelEnd for use in app-merge.ts
    beginEndgameGuard: (source: string, ttlMs?: number) => beginEndgameGuard(source, ttlMs),
    endEndgameGuard: (source: string) => endEndgameGuard(source),
    getEndgameGuardState: () => getEndgameGuardState(),
    applyWildSkinLocal: (tile) => applyWildSkinLocal(tile), // 🔥 CRITICAL: Export for wild-magnet electric glow
    getCombo: () => combo, // 🔥 CRITICAL: Export getCombo for magnet pull combo logic
    setCombo: (v) => hudSetCombo(v|0), // 🔥 CRITICAL: Export setCombo for magnet pull combo logic
    scheduleComboDecay: () => scheduleComboDecay(), // 🔥 CRITICAL: Export scheduleComboDecay for magnet pull combo logic
    killComboTimer: () => killComboTimer(), // 🔥 CRITICAL: Export killComboTimer to kill existing timer before updating combo
    addStars: (count) => StarsCollector.addStars(count|0), // 🔥 CRITICAL: Export addStars for synchronous star collection
    setStarsCount: (count) => StarsCollector.setStarsCount(count|0), // 🔥 CRITICAL: Export setStarsCount for resetting star count on restart
    cleanupFxForBoardReset: (reason = 'window') => cleanupFxForBoardReset(reason),
    softResetBoardView: (reason = 'window') => softResetBoardView(reason),
    destroyOldBoardForTransition: (reason?: string) => destroyOldBoardForTransition(reason ?? 'unknown'),
    cleanupTexturesForBoardTransition: (reason: string, aggressive?: boolean, skipCacheClear?: boolean) =>
      cleanupTexturesForBoardTransition(reason, aggressive ?? false, skipCacheClear ?? false),
    layoutBoard: () => layoutBoard(),
    snapshotState: () => replayRecorder.snapshot(),
    replayStartRecord: () => replayRecorder.startRecord(),
    replayStartVerify: (steps) => replayRecorder.startVerify(steps),
    replayStop: () => replayRecorder.stop(),
    replayExport: () => replayRecorder.export(),
    replayImport: (json: string) => replayRecorder.import(json),
    replayStatus: () => replayRecorder.status(),
  } as any;

  // Expose for continueGameWithSavedState fallback when loadGameState fails
  (window as any).rebuildBoard = rebuildBoard;
  (window as any).startLevel = startLevel;
  
  // 🔥 MEMORY LEAK FIX: Export cleanup functions for global cleanup
  (window as any).killAllDelayedCalls = killAllDelayedCalls;
  (window as any).destroyAllGraphicsObjects = destroyAllGraphicsObjects;
  window.testCleanAndPrize = () => (window.CC as any).testCleanAndPrize?.();

  // Run layout after viewport/meta/styles are in place to get correct safe-area values
  try {
    trackAppAnimationFrame(async () => {
      await layoutBoard();
    });
  } catch {
    layoutBoard().catch(err => {
      devError('❌ Error in layoutBoard():', err);
    });
  }

  syncSharedState();
  
  // 🔥 CRITICAL: Re-apply paper background to 35% opacity at the end of boot() as fallback
  // This ensures it's set even if something overrides it during boot process
  // Use setTimeout to ensure it runs after all other code
  trackAppTimeout(() => {
    const paperAlpha = 0.35;
    document.documentElement?.style.setProperty('--paper-alpha', paperAlpha.toString());
    
    const overlayAlpha = 1 - paperAlpha; // 0.65 overlay = 35% paper visible
    const backgroundLayers = overlayAlpha > 0.01
      ? `linear-gradient(rgba(243,238,232,${overlayAlpha}), rgba(243,238,232,${overlayAlpha})), url('./assets/paper-bg.png')`
      : `url('./assets/paper-bg.png')`;
    
    const body = document.body;
    const html = document.documentElement;
    const globalBg = document.getElementById('global-bg');
    const appElement = document.getElementById('app');
    
    // 🔥 CRITICAL: Re-apply paper bg with !important as fallback to prevent override
    if (body) {
      body.style.setProperty('background-color', '#f3eee8', 'important');
      body.style.setProperty('background-image', backgroundLayers, 'important');
      body.style.setProperty('background-size', '100% 100%', 'important');
      body.style.setProperty('background-repeat', 'no-repeat', 'important');
      body.style.setProperty('background-position', 'center', 'important');
    }
    if (html) {
      html.style.setProperty('background-color', '#f3eee8', 'important');
      html.style.setProperty('background-image', backgroundLayers, 'important');
      html.style.setProperty('background-size', '100% 100%', 'important');
      html.style.setProperty('background-repeat', 'no-repeat', 'important');
      html.style.setProperty('background-position', 'center', 'important');
    }
    if (globalBg) {
      (globalBg as HTMLElement).style.setProperty('background-color', '#f3eee8', 'important');
      (globalBg as HTMLElement).style.setProperty('background-image', backgroundLayers, 'important');
      (globalBg as HTMLElement).style.setProperty('background-size', '100% 100%', 'important');
      (globalBg as HTMLElement).style.setProperty('background-repeat', 'no-repeat', 'important');
      (globalBg as HTMLElement).style.setProperty('background-position', 'center', 'important');
    }
    if (appElement) {
      appElement.style.setProperty('background', 'transparent', 'important');
      appElement.style.setProperty('background-image', 'none', 'important');
    }
    
    devLog(`📄 Board game paper background RE-APPLIED as fallback: alpha=${paperAlpha}, overlayAlpha=${overlayAlpha}, visible=${paperAlpha * 100}%`);
  }, 100); // 100ms delay to ensure it runs after all other code
}

// -------------------- layout + HUD --------------------
// 🔥 REFACTORED: Preimenovano za jasnoću - ovo je board layout, ne HUD layout
export async function layoutBoard(){
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
  
  devLog('🎯 Safe area top (SAT):', SAT, 'px, adjusted for iPhone 13:', adjustedSAT, 'px');
  devLog('🎯 Device info:', {
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
    
    devLog('📱 Mobile: HUD positioned EXACTLY 48px below notch, safeTop:', safeTop, 'px');
  } else {
    // Desktop: Use calculated safe area positioning
    safeTop = TOP_PAD + adjustedSAT;
    hudBottom = safeTop + HUD_H + GAP_HUD;
    devLog('🖥️ Desktop: HUD at y:', safeTop, 'px, board starts at y:', hudBottom);
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
    devLog('📱 iPhone: Raised HUD by', additionalOffset, 'px (4.7% of vh)');
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
  
  devLog('🎯 Board scaling:', { 
    availableWidth, 
    widthScale: availableWidth / w, 
    heightScale: availableHeight / h, 
    finalScale: s,
    padding: isIPad ? `${IPAD_BOARD_PADDING}px` : `${HUD_PADDING}px`
  });
  
  board.scale.set(s, s);
  board.x = boardX;
  board.y = boardY;
  
  devLog('🎯 Board positioned at y:', board.y, 'px (available height:', availableHeight, 'px, board height:', sh, 'px)');
  
  devLog('🎯 Board positioning (HUD below notch on mobile):', {
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
        devLog('🎯 Initializing HUD...');
        
        // 🔥 CRITICAL: Ensure LTCrow font is loaded BEFORE creating PIXI Text
        // Without this, HUD numbers render as black boxes (tofu) when font isn't ready for Canvas
        try {
          await ensureFonts();
          devLog('✅ Fonts ready for HUD text');
        } catch (err) {
          devWarn('⚠️ Font preload failed, HUD text may show fallback:', err);
        }
        
        // 🔥 CRITICAL: Ensure HUD icons are loaded into PIXI Assets cache before initializing HUD
        // This prevents missing icons after hard exit/restart
        // Icons should already be loaded in boot(), but double-check here as safety
        try {
          const { Assets } = await import('pixi.js');
          const hudIcons = [
            './assets/hud/star-hud.png',
            './assets/hud/score-hud.png',
            './assets/hud/combo-hud.png',
            './assets/hud/extra-combo-hud.png',
            './assets/hud/mega-combo-hud.png',
            './assets/close-icon.png',
          ];
          
          // Check which icons are missing and load them
          const missingIcons: string[] = [];
          for (const iconPath of hudIcons) {
            if (!Assets.get(iconPath)) {
              missingIcons.push(iconPath);
            }
          }
          
          // If any icons are missing, load them BLOCKING
          if (missingIcons.length > 0) {
            devWarn(`⚠️ ${missingIcons.length} HUD icons missing, loading now (BLOCKING)...`);
            for (const iconPath of missingIcons) {
              try {
                await Assets.load(iconPath);
                devLog(`✅ Loaded ${iconPath} into PIXI Assets cache before HUD init`);
              } catch (err) {
                devError(`❌ CRITICAL: Failed to load ${iconPath} before HUD init:`, err);
              }
            }
          } else {
            devLog('✅ All HUD icons already loaded in PIXI Assets cache');
          }
        } catch (err) {
          devError('❌ CRITICAL: Failed to ensure HUD icons are loaded before HUD init:', err);
          // Try to load via comprehensive preloader as fallback
          try {
            const { loadHudIconsIntoPixiCache } = await import('../utils/comprehensive-image-preloader.js');
            await loadHudIconsIntoPixiCache();
            devLog('✅ HUD icons loaded via comprehensive preloader fallback');
          } catch (fallbackErr) {
            devError('❌ CRITICAL: Fallback HUD icon loading also failed:', fallbackErr);
          }
        }
        
        HUD.initHUD({ stage, app, top: safeTop, initialHide: _hudDropPending });
        _hudInitDone = true;
        devLog('✅ HUD initialized successfully');
        
        // 🔥 CRITICAL FIX: If HUD was initialized with initialHide=false, ensure it's visible
        // This handles the case where _hudDropPending is false but HUD still needs to be visible
        // HUD_ROOT is not directly accessible, we need to get it from HUD module or window
        try {
          const hudRoot = (window as any).HUD_ROOT || HUD.HUD_ROOT || null;
          if (!_hudDropPending && hudRoot && !(hudRoot as any).destroyed) {
            const top = hudRoot._dropTop ?? safeTop;
            hudRoot.y = top;
            hudRoot.alpha = 1;
            hudRoot.visible = true;
            hudRoot._dropped = true;
            devLog('✅ HUD made visible immediately (no drop pending)');
          }
        } catch (e) {
          devWarn('⚠️ Failed to access HUD_ROOT:', e);
        }
        
        // 🔥 CRITICAL: Fallback to trigger HUD drop shortly after init (for slow devices)
        if (_hudDropPending) {
          trackAppTimeout(() => {
            if (!_hudDropPending) return; // already handled by sweetPopIn
            try {
              const hudRoot = (window as any).HUD_ROOT || HUD.HUD_ROOT || null;
              if (!hudRoot || (hudRoot as any).destroyed || !hudRoot.parent) {
                // Silent - this is expected if HUD hasn't initialized yet
                return;
              }
              if (!hudRoot._dropped && typeof HUD.playHudDrop === 'function') {
                // Start on next paint so user definitely sees the drop (especially iPhone)
                trackAppAnimationFrame(() => trackAppAnimationFrame(() => {
                  // 🔥 CRITICAL: Show canvas now that HUD is ready to drop
                  if (app && app.canvas) {
                    app.canvas.style.opacity = '1';
                    app.canvas.style.transition = 'opacity 0.3s ease';
                  }
                  HUD.playHudDrop({ forceRestart: true });
                }));
                devLog('✅ HUD drop fallback triggered after initHUD');
              }
              _hudDropPending = false;
            } catch (err) {
              devWarn('⚠️ HUD drop fallback failed:', err);
            }
          }, 120);
        }
        
        // hook za wild meter prema HUD-u
        hudUpdateProgress = (ratio, animate)=>{
          devLog('🎯 hudUpdateProgress called with:', { ratio, animate });
          try{ 
            HUD.updateProgressBar?.(ratio, animate); 
            devLog('✅ HUD.updateProgressBar called successfully');
          } catch(error) {
            devError('❌ Error calling HUD.updateProgressBar:', error);
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
          devLog('✅ Stars collector initialized');
        } catch (error) {
          devWarn('⚠️ Failed to initialize stars collector:', error);
        }
      }
      
      // Update HUD with current values
      // 🔥 CRITICAL FIX: Use STATE.boardNumber if available (most up-to-date)
      const currentBoardNumber = (STATE?.boardNumber && Number.isFinite(STATE.boardNumber)) 
        ? STATE.boardNumber 
        : boardNumber;
      if (typeof HUD.updateHUD === 'function') {
        HUD.updateHUD({ score, board: currentBoardNumber, moves, combo });
        devLog('✅ HUD updated with:', { score, board: currentBoardNumber, moves, combo, 'STATE.boardNumber': STATE?.boardNumber, 'local boardNumber': boardNumber });
      }
      
      // CRITICAL: Call HUD.layout to update HUD positioning
      if (typeof HUD.layout === 'function') {
        HUD.layout({ app, top: safeTop });
        devLog('✅ HUD layout updated');
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
    devLog('🎯 Recentered board using PIXI wild meter (centered 50%):', { dynamicHudBottom, center2, wildY, wildH, s2, hudYForLayout, avail2 });
  } catch (e) {
    devWarn('⚠️ Could not recenter using PIXI wild meter, using estimate.', e);
  }
    } else {
      devWarn('⚠️ HUD.initHUD is not a function');
    }
  } catch (error) {
    devError('❌ Error during HUD initialization/update in app.js layout:', error);
    // Reset HUD flag on error to retry next time
    _hudInitDone = false;
  }
  
  // Start idle bounce animations for tiles with pips
  if (TILE_IDLE_BOUNCE.ENABLE) {
    try {
      TILE_IDLE_BOUNCE.start(tiles, board);
      devLog('✅ Tile idle bounce started');
    } catch (error) {
      devWarn('⚠️ Failed to start tile idle bounce:', error);
    }
  }
}

// 🔥 v112: Utility functions moved to app-core-utils.ts
// Imported: boardSize, cellXY

// PROFESSIONAL SOLUTION: Fixed background layer with all ghost placeholders
// Created once, never destroyed, always visible
let backgroundLayer = null;

function initializeBackgroundLayer(){
  // CRITICAL: Always create new background layer for each game
  const PAD=5, RADIUS=Math.round(TILE*0.26), WIDTH=8, COLOR=0xF3E6DC, ALPHA=0.64;
  
  // 🔥 CRITICAL FIX: Remove existing background layer if it exists
  if (backgroundLayer) {
    try {
      if (board && board.children.includes(backgroundLayer)) {
        board.removeChild(backgroundLayer);
        devLog('✅ Removed existing background layer from board');
      }
      backgroundLayer.destroy({ children: true });
      devLog('✅ Destroyed existing background layer');
    } catch (e) {
      devWarn('⚠️ Error removing existing background layer:', e);
    }
    backgroundLayer = null; // Clear reference
  }
  
  // 🔥 CRITICAL FIX: Ensure board exists before creating background layer
  if (!board) {
    devError('❌ initializeBackgroundLayer: board is null, cannot create background layer');
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
    devLog('✅ Background layer added to board at index 0');
  } catch (e) {
    devError('❌ Failed to add background layer to board:', e);
    backgroundLayer = null;
    return;
  }
  
  devLog('🎯 Creating FIXED background layer with all ghost placeholders');
  
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
  
  devLog('✅ FIXED background layer created with', ROWS * COLS, 'ghost placeholders');
  devLog('✅ This layer will NEVER be modified or destroyed');
  devLog('🔍 Background layer zIndex:', backgroundLayer.zIndex);
  devLog('🔍 Background layer visible:', backgroundLayer.visible);
  devLog('🔍 Background layer in board:', board.children.includes(backgroundLayer));
  
  // 🔥 v70 STYLE: Update ghost visibility immediately after creation
  // Show ghosts for empty cells (where grid[r][c] === null)
  try {
    // 🔥 CRITICAL FIX: Ensure backgroundLayer is visible before updating ghost visibility
    backgroundLayer.visible = true;
    // Fallback: Show all ghosts initially (will be hidden by updateGhostVisibility later)
    updateGhostVisibility();
    devLog('✅ Ghost visibility updated after background layer creation');
    // 🔥 CRITICAL FIX: Double-check that ghost placeholders are visible
    if (window._ghostPlaceholders && Array.isArray(window._ghostPlaceholders)) {
      let visibleCount = 0;
      window._ghostPlaceholders.forEach((row: any[]) => {
        row.forEach((ghost: any) => {
          if (ghost && ghost.visible) visibleCount++;
        });
      });
      devLog(`✅ Ghost placeholders check: ${visibleCount} visible out of ${ROWS * COLS} total`);
    }
  } catch (e) {
    devError('❌ Failed to update ghost visibility:', e);
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

// When true, updateGhostVisibility only hides ghosts (never shows) — prevents one-frame blink during enter animation
(window as any).__ccEnterAnimationActive = false;
// When true, force-hide ghosts/background placeholders regardless of grid state (used during final-merge cinematic).
(window as any).__ccForceHideGhosts = false;

function setFinalMergeVisualSuppression(active: boolean) {
  try { (window as any).__ccForceHideGhosts = !!active; } catch {}
  try { hideGhostPlaceholders(); } catch {}
  try {
    if (backgroundLayer) backgroundLayer.visible = !active;
  } catch {}
}

function hideTerminalLockedArtifacts(reason: string = 'unknown') {
  try {
    setFinalMergeVisualSuppression(true);
  } catch {}
  try {
    let hidden = 0;
    for (const t of tiles) {
      if (!t || t.destroyed) continue;
      if (!t.locked) continue;
      // End-of-run visual polish: hide all locked placeholders/ice in terminal states.
      try { t.visible = false; } catch {}
      try { t.alpha = 0; } catch {}
      try { t.eventMode = 'none'; } catch {}
      hidden++;
    }
    if (hidden > 0) {
      devLog(`🧹 hideTerminalLockedArtifacts: hidden ${hidden} locked tiles (${reason})`);
    }
  } catch (e) {
    devWarn('⚠️ hideTerminalLockedArtifacts failed:', e);
  }
}

// Update ghost visibility based on current grid state
// SIMPLE RULE: Show ghost ONLY where grid cell is null (no tile at all)
function updateGhostVisibility() {
  // 🔥 During enter animation: never show ghosts — only hide (any call to updateGhostVisibility = no visible ghosts)
  if ((window as any).__ccEnterAnimationActive || (window as any).__ccForceHideGhosts) {
    try { hideGhostPlaceholders(); } catch {}
    return;
  }
  // 🔥 CRITICAL FIX: If window._ghostPlaceholders is null, try to reinitialize from backgroundLayer
  if (!window._ghostPlaceholders) {
    if (backgroundLayer && backgroundLayer.children.length > 0) {
      devLog('🔄 updateGhostVisibility: window._ghostPlaceholders is null, reinitializing from backgroundLayer...');
      window._ghostPlaceholders = [];
      for (let r = 0; r < ROWS; r++) {
        window._ghostPlaceholders[r] = [];
        for (let c = 0; c < COLS; c++) {
          const ghostLabel = `Ghost_${c}_${r}`;
          const ghost = backgroundLayer.children.find((child: any) => child.label === ghostLabel);
          if (ghost) {
            window._ghostPlaceholders[r][c] = ghost;
          }
        }
      }
      devLog('✅ updateGhostVisibility: window._ghostPlaceholders reinitialized from backgroundLayer');
    } else {
      // If backgroundLayer doesn't exist, we can't update ghost visibility
      devWarn('⚠️ updateGhostVisibility: window._ghostPlaceholders is null and backgroundLayer is missing - cannot update');
      return;
    }
  }
  
  let visibleCount = 0;
  
  for (let r=0; r<ROWS; r++) {
    for (let c=0; c<COLS; c++) {
      const cell = grid[r]?.[c];
      // Show placeholder only if truly empty, or if locked empty tile is NOT visible
      const shouldShow = (cell === null) || (!!cell && cell.locked && (cell.value|0) <= 0 && cell.visible === false);
      
      if (window._ghostPlaceholders[r] && window._ghostPlaceholders[r][c]) {
        window._ghostPlaceholders[r][c].visible = shouldShow;
        if (shouldShow) visibleCount++;
      }
    }
  }
  
  // 🔥 CRITICAL FIX: Log ghost visibility status for debugging
  if (visibleCount > 0) {
    devLog(`✅ updateGhostVisibility: ${visibleCount} ghost placeholders visible`);
  }
}

// Hide all ghost placeholders (e.g. during board enter / pop-in animation)
function hideGhostPlaceholders() {
  try {
    if (window._ghostPlaceholders && Array.isArray(window._ghostPlaceholders)) {
      window._ghostPlaceholders.forEach((row: any[]) => {
        row.forEach((ghost: any) => {
          if (ghost) ghost.visible = false;
        });
      });
    }
  } catch {}
}

// Smoothly fade visible ghost placeholders, then hide them.
function fadeOutGhostPlaceholders(duration = 0.2) {
  try {
    const list: any[] = [];
    if (window._ghostPlaceholders && Array.isArray(window._ghostPlaceholders)) {
      window._ghostPlaceholders.forEach((row: any[]) => {
        row.forEach((ghost: any) => {
          if (ghost && ghost.visible) list.push(ghost);
        });
      });
    }
    if (!list.length) return;
    list.forEach((ghost) => {
      try { gsap.killTweensOf(ghost); } catch {}
      try {
        const startAlpha = Number.isFinite(ghost.alpha) ? ghost.alpha : 1;
        ghost.alpha = startAlpha;
        gsap.to(ghost, {
          alpha: 0,
          duration,
          ease: 'power2.out',
          overwrite: 'auto',
          onComplete: () => {
            try {
              ghost.visible = false;
              ghost.alpha = 1;
            } catch {}
          }
        });
      } catch {}
    });
  } catch {}
}

// Export to window for use in board.js
window.setGhostVisibility = setGhostVisibility;
window.updateGhostVisibility = updateGhostVisibility;
window.hideGhostPlaceholders = hideGhostPlaceholders;

// 🔥 v70 STYLE: Draw ghost placeholders for empty cells
function drawBoardBG(mode = 'active+empty'){
  if (!backgroundLayer) {
    initializeBackgroundLayer();
  }
  
  // 🔥 v70 STYLE: Update ghost visibility based on grid state
  // Show ghosts for empty cells (where grid[r][c] === null)
  updateGhostVisibility();
}

function pulseBoardZoom(
  factor = 0.92,
  opts: {
    translateFactor?: number;
    onComplete?: () => void;
    outDur?: number;
    inDur?: number;
    hold?: number;
    outEase?: string;
    inEase?: string;
  } = {}
) {
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

  const tl = animationManager.trackExternalTimeline(
    gsap.timeline({ onComplete: () => { board._wildZoomTl = null; try { userOnComplete?.(); } catch {} } })
  );

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



const { updateHUD, animateScore, animateBoardHUD } = createHudHelpers({
  getScore: () => score,
  setScore: (v) => { score = v; },
  getBoardNumber: () => boardNumber,
  setBoardNumber: (v) => { boardNumber = v; },
  getMoves: () => moves,
  getCombo: () =>
    typeof (window as any).CC?.getCombo === 'function'
      ? (window as any).CC.getCombo()
      : combo,
  setCombo: (v) => { combo = v; },
  syncSharedState,
  SCORE_CAP,
  HUD,
  getFallbackUpdateHUD: () => (typeof _updateHUD === 'function' ? _updateHUD : undefined),
  getAnimateScore: () => (typeof _animateScore === 'function' ? _animateScore : undefined),
  getAnimateBoard: () => (typeof _animateBoard === 'function' ? _animateBoard : undefined),
  getSetBoard: () => (typeof _setBoard === 'function' ? _setBoard : undefined),
});
// 🔥 v112: fixHoverAnchor moved to app-core-helpers.ts
// Imported: fixHoverAnchor

// -------------------- board build --------------------
function resetBoardContainer(){
  resetBoardContainerHelper({
    board,
    boardBG,
    backgroundLayer,
    setBackgroundLayer: (v) => { backgroundLayer = v; },
    ROWS,
    COLS,
    initializeBackgroundLayer,
    updateGhostVisibility,
    hideGhostPlaceholders,
    devLog,
    devWarn,
    devError,
  });
}
function rebuildBoard(){
  stopTileIdleBounce({ TILE_IDLE_BOUNCE, devLog, devWarn });
  
  prepareBoardForRebuild({
    resetBoardContainer,
    resetTilesForRebuild: () => {
      // NOTE: FX/timer cleanup is handled centrally in cleanupFxForBoardReset()
      resetTilesForRebuild({
        tiles,
        gsap,
        stopWildIdle,
        stopWildShimmer,
        stopWildStars,
        stopWildJuiceBubbles,
        stopMagnetIdleParticles,
        stopTntIdleParticles,
        stopTntIdleShake,
        cleanupTilesForRebuild,
        devWarn,
      });
    },
    // 🔥 NOTE: FX cleanup handled centrally via cleanupFxForBoardReset()
    initializeBoardGrid: () => initializeBoardGrid({ createEmptyGrid, drawBoardBG }),
  });

  createAndOpenBoard({
    ROWS,
    COLS,
    board,
    grid,
    tiles,
    makeBoard,
    fixHoverAnchor,
    drag,
    randVal,
    createLockedHolders,
    openRandomTiles,
  });

  finalizeBoardVisibility({ tiles, drawBoardBG });
  try { hideGhostPlaceholders(); } catch {}
  
  // 🔥 CRITICAL FIX: Ensure background layer exists and is visible
  // If backgroundLayer was destroyed in cleanupGame(), it will be null
  // initializeBackgroundLayer() is called in startLevel() after rebuildBoard()
  // But we need to ensure it's visible here if it exists
  ensureBackgroundLayerVisible({
    board,
    backgroundLayer,
    devLog,
    devWarn,
  });
  
  // Start animation (optionally wait a frame if HUD is not ready so drop can be visible)
  const hudReady = (window as any).HUD_ROOT || HUD.HUD_ROOT || null;
  const sweetPopInRunner = createSweetPopInRunner({
    tiles,
    sweetPopIn,
    onHalf: () => {
      handleHudDropOnHalf({
        app,
        HUD,
        hudRootFromWindow: (window as any).HUD_ROOT || null,
        trackAppAnimationFrame,
        devLog,
        devWarn,
        devError,
        hudDropPending: _hudDropPending,
        setHudDropPending: (v) => { _hudDropPending = v; },
      });
      // 🔥 UX: Stronger haptic on mid pop-in (double heavy tap)
      try {
        if (typeof (window as any).triggerHapticImpact === 'function') {
          (window as any).triggerHapticImpact('heavy');
          trackAppTimeout(() => {
            try { (window as any).triggerHapticImpact?.('heavy'); } catch {}
          }, 300);
        }
      } catch {}
    },
    devLog,
  });
  
  const shouldDelayForHUD = _hudDropPending && !hudReady;
  
  ensureAnimationRunning({ gsap, app });
  const runPopIn = createPopInRunner({
    shouldDelayForHUD,
    trackAppTimeout,
    sweetPopInRunner,
  });
  
  // 🔥 CRITICAL: If app is hidden during transition, delay pop-in until visible
  const sweetPopPromise = createSweetPopPromise({
    appEl: document.getElementById('app'),
    runPopIn,
    trackAppTimeout,
  });
  
  // 🔥 SAFETY NET: If pop-in is stalled or timeline is throttled, force tiles visible
  schedulePopInSafetyNet({
    tiles,
    gsap,
    app,
    updateGhostVisibility,
    devWarn,
    trackAppTimeout,
  });
  
  sweetPopPromise.then(() => {
    (window as any).__ccEnterAnimationActive = false;
    try { updateGhostVisibility(); } catch {}
    handleSweetPopInComplete({
      app,
      board,
      tiles,
      HUD,
      hudRootFromWindow: (window as any).HUD_ROOT || null,
      trackAppAnimationFrame,
      devLog,
      devWarn,
      devError,
      hudDropPending: _hudDropPending,
      setHudDropPending: (v) => { _hudDropPending = v; },
    });
  });
  devLog('✅ sweetPopIn started immediately - no waiting');

  syncSharedState();

}

// Board exit animation - reverse of sweetPopIn
async function animateBoardExit(){
  devLog('🎬🎬🎬 animateBoardExit() CALLED');
  
  // 🔥 NUCLEAR BAILOUT: If app or stage are destroyed/null, skip animation entirely
  // This prevents crashes when exitToMenu is called after cleanup
  if (!app || !stage || (app as any).destroyed || (stage as any).destroyed) {
    devWarn('⚠️ animateBoardExit: PIXI app/stage destroyed - skipping animation');
    return Promise.resolve();
  }
  
  // 🔥 CRITICAL FIX: Ensure canvas/app is visible BEFORE playing exit animation
  // This fixes the bug where board "just disappears" without animation
  ensureExitVisibility({ app, stage, board, hud, devLog, devWarn });
  
  // CRITICAL: Hide board indicator (board tag) before exit animation
  try {
    const { animateBoardIndicatorExit } = await import('./hud-helpers.js');
    if (typeof animateBoardIndicatorExit === 'function') {
      animateBoardIndicatorExit(0.3);
      devLog('✅ Board exit: Board indicator exit animation started');
    }
  } catch (e) {
    devWarn('⚠️ Board exit: Error hiding board indicator:', e);
  }
  
  // CRITICAL: Stop tile idle bounce before exit animation (prevents new smoke bubbles)
  try {
    TILE_IDLE_BOUNCE.stop();
    devLog('✅ Board exit: Tile idle bounce stopped');
  } catch (e) {
    devWarn('⚠️ Board exit: Error stopping tile idle bounce:', e);
  }
  
  // 🔥 BUG FIX: Stop magnet idle particles IMMEDIATELY before exit animation
  // This prevents particles from being visible during exit animation and journey screen enter
  stopMagnetParticlesOnExit({
    tiles: STATE?.tiles || [],
    stopMagnetIdleParticles,
    devLog,
    devWarn,
  });

  // 🔥 DIAGNOSTICS: Log stats before exit animation
  logBoardExitStats('before-exit');

  cleanupBeforeBoardExit({ HUD, backgroundLayer, devLog, devWarn });
  
  const { effectiveTiles, skip } = await selectTilesForExit({
    STATE,
    tiles,
    windowTiles: (window as any).STATE?.tiles || [],
    devLog,
    devWarn,
    HUD,
    waitTracked,
  });
  if (skip) return Promise.resolve();
  
  startHudExitAnimation({ HUD, devLog, devWarn });
  
  await runExitAnimation({
    tiles: effectiveTiles,
    sweetPopOut,
    waitTracked,
    devLog,
    devWarn,
  });

  // 🔥 AGGRESSIVE CLEANUP: Kill lingering tweens + run memory cleanup after exit animation
  try { animationManager.killAll(); } catch {}
  try {
    memoryManager.performCleanup();
    devLog('✅ Board exit: Memory cleanup completed');
  } catch (error) {
    devWarn('⚠️ Board exit: Memory cleanup failed:', error);
  }

  // 🔥 DIAGNOSTICS: Log stats after cleanup
  logBoardExitStats('after-cleanup');
  return Promise.resolve();
}

// 🔥 v112: tintLocked moved to app-core-helpers.ts
// Imported: tintLocked
// 🔥 v112: randVal moved to app-core-utils.ts
// Imported: randVal
function startLevel(n){
  devLog('🎯 startLevel called with:', n, 'current level:', level, 'current boardNumber:', boardNumber, 'current score:', score);
  // 🔥 Enter animation active: updateGhostVisibility will only hide ghosts until pop-in completes
  (window as any).__ccEnterAnimationActive = true;
  try { hideGhostPlaceholders(); } catch {}
  
  runStartLevelFxPrep({
    resetGlobalFxLayer,
    cleanupFxForBoardReset,
    softResetBoardView,
    devLog,
  });
  
  // 🔥 CRITICAL FIX: Ensure board and hud are visible BEFORE anything else
  // This fixes the issue where board is hidden after cleanup and not restored
  ensureStartLevelVisibility({ stage, board, hud, devLog, devWarn, devError });
  
  // 🔥 NOTE: FX cleanup handled centrally via cleanupFxForBoardReset()
  
  {
    const next = applyStartLevelState({
      n,
      STATE,
      boardSpecificRules,
      devLog,
    });
    level = next.level;
    boardNumber = next.boardNumber;
    score = next.score;
  }
  
  // 🔥 JOURNEY PROGRESSION: Update currentRunState when starting a level
  updateJourneyRunState({ n, score, devLog, devWarn });
  
  // STATS TRACKING: Update highest board reached
  updateStartLevelStats({ n, statsService, devLog, devError });
  
  incrementBoardTimesPlayed({ n, devLog });
  syncJourneyBoards({ n, devLog, devWarn });
  
  moves = MOVES_MAX;
  // Track best stack depth achieved in this run (for clean board efficiency)
  try { STATE.maxStackDepth = 1; } catch {}
  // 🔥 CRITICAL: Don't reset busyEnding here - let runEndgameFlow handle it in finally block
  // busyEnding = false; // REMOVED - runEndgameFlow resets it in finally block
  hudResetCombo();
  devLog('🎯 startLevel updated - level:', level, 'boardNumber:', boardNumber, 'score preserved:', score);
  clearComboIdleTimer({ comboIdleTimer });
  
  resetWildAndEndgameState({
    setWildMeter: (v) => { wildMeter = v; },
    resetWildProgress,
    setWildJuiceSpawned: (v) => { wildJuiceSpawned = v; },
    setWildMagnetSpawned: (v) => { wildMagnetSpawned = v; },
    setFirstWildSpawned: (v) => { firstWildSpawned = v; },
    setWildSpawnCount: (v) => { wildSpawnCount = v; },
    setWildMergeLockedSpawnCount: (v) => { wildMergeLockedSpawnCount = v; },
    clearEndGameCache,
  });
  
  // 🔥 CRITICAL FIX: Skip rebuildBoard if loading saved state
  // This prevents creating an empty board before loadGameState restores tiles
  handleStartLevelHudDrop({
    HUD,
    gsap,
    logger,
    getHudRootFromWindow: () => (window as any).HUD_ROOT,
    isTriggerHudDrop: () => !!(window as any).__ccTriggerHudDrop,
    clearTriggerHudDrop: () => { delete (window as any).__ccTriggerHudDrop; },
    setHudDropPending: (v) => { _hudDropPending = v; },
    setHudInitDone: (v) => { _hudInitDone = v; },
  });
  
  maybeRebuildBoard({
    rebuildBoard,
    logger,
    getSkipRebuildFlag: () => !!(window as any).__ccSkipRebuildBoard,
  });
  
  saveAfterBoardStart({
    boardNumber,
    trackAppTimeout,
    saveGameState,
    devLog,
  });

  runStartLevelPost({ syncSharedState, updateHUD });
  
  ensureStartLevelLayout({
    layoutBoard,
    initializeBackgroundLayer,
    board,
    backgroundLayer,
    setBackgroundLayer: (v) => { backgroundLayer = v; },
    updateGhostVisibility,
    hideGhostPlaceholders,
    devError,
  });
  
  syncHudRootVisibility({
    HUD,
    getHudRootFromWindow: () => (window as any).HUD_ROOT,
    isHudDropPending: () => _hudDropPending,
  });
  
  // layoutBoard() already called above; avoid duplicate on board 1
  
  // Don't check level end immediately - let the game play first
  // trackDelayedCall(0.1, checkLevelEnd); // REMOVED - causes immediate fail screen
  // 🔥 ENDGAME HINT: refresh after board is fully visible (covers hard-exit resume)
  trackAppTimeout(() => {
    updateEndgameHintState();
  }, 600);
}

// --- local Wild skin fallback
function applyWildSkinLocal(tile){
  applyWildSkinLocalCore(tile, {
    Assets,
    Texture,
    Rectangle,
    SCALE_MODES,
    ASSET_WILD,
    ASSET_WILD_MAGNET,
    ASSET_WILD_JUICE,
    ASSET_WILD_TNT,
    TILE,
    startWildShimmer,
    startWildJuiceBubbles,
    startWildStars,
    startMagnetIdleParticles,
    startTntIdleParticles,
    startTntIdleShake,
    trackAppAnimationFrame,
    devWarn,
  });
}

// Electric glow effect for wild-magnet tiles
function addElectricGlow(tile){
  addElectricGlowCore({
    tile,
    Container,
    Graphics,
    gsap,
    animationManager,
    devWarn,
  });
}

function bindTileWithFallback(tile, skipBind){
  bindTileWithFallbackCore({
    tile,
    skipBind,
    drag,
    trackAppAnimationFrame,
    trackAppTimeout,
  });
}

// --- spawn exactly at grid cell ---
function openAtCell(c, r, { value=null, isWild=false, isWildMagnet=false, isWildJuice=false, isWildTnt=false, skipBind=false, timeScale=1.0, forceFreshPlaceholder=false } = {}){
  return openAtCellCore({
    c,
    r,
    options: { value, isWild, isWildMagnet, isWildJuice, isWildTnt, skipBind, timeScale, forceFreshPlaceholder },
    removeTile,
    grid,
    board,
    tiles,
    makeBoard,
    devWarn,
    bindTileWithFallback,
    applyWildSkinLocal,
    startWildShimmer,
    startWildJuiceBubbles,
    startWildStars,
    startTntIdleParticles,
    startTntIdleShake,
    SPAWN,
    gsap,
  });
}

function randomEmptyCell(excludeCells?: { r: number; c: number }[]){
  return getRandomEmptyCell({ ROWS, COLS, grid, excludeCells });
}

function spawnLockedTilesWithPop(count: number, excludeCells?: Array<{ c: number; r: number }>): void {
  if (!count || count <= 0) return;
  if (!grid || !board || !makeBoard?.createTile) return;

  const refLocked = tiles.find(t => t && !t.destroyed && t.locked && ((t.value | 0) <= 0) && Number.isFinite((t as any).alpha));
  const lockedAlpha = Number.isFinite((refLocked as any)?.alpha) ? (refLocked as any).alpha : 0.20;

  const excludeSet = excludeCells?.length ? new Set(excludeCells.map(({ c, r }) => `${c},${r}`)) : null;
  const emptyCells: Array<{ c: number; r: number }> = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (excludeSet?.has(`${c},${r}`)) continue; // 🔥 ENDGAME: Exclude dst cell to avoid clash with openAtCell spawn
      if (!grid?.[r]?.[c]) emptyCells.push({ c, r });
    }
  }
  const toCreate: Array<{ c: number; r: number }> = [];
  if (emptyCells.length) {
    for (let i = emptyCells.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [emptyCells[i], emptyCells[j]] = [emptyCells[j], emptyCells[i]];
    }
    toCreate.push(...emptyCells.slice(0, Math.min(count, emptyCells.length)));
  }

  // If there aren't enough empty cells, spawn as many locked tiles as we can.

  toCreate.forEach(({ c, r }, index) => {
    try {
      if (grid?.[r]?.[c]) return; // Cell filled meanwhile
      const t = makeBoard.createTile({ board, grid, tiles, c, r, val: 0, locked: true });
      if (!t) return;
      try { resetTileToNormalState?.(t); } catch {}
      try { delete (t as any)._spawned; } catch {}
      t.locked = true;
      t.eventMode = 'none';
      t.cursor = 'default';
      t.alpha = lockedAlpha;
      devLog('[SPAWN-OPACITY] spawnLockedTilesWithPop (LOCKED)', { cell: `(${c},${r})`, lockedAlpha, tileAlpha: t.alpha });

      // Custom pop-in without setting _spawned (locked tiles must remain spawnable later)
      // Keep alpha low the whole time (no fade to 100%)
      const trg = t.rotG || t;
      const dir = Math.random() < 0.5 ? 1 : -1;
      t.scale?.set?.(0.30, 0.30);
      const delay = index * 150;
      const tl = gsap.timeline({
        delay: delay / 1000,
        onComplete: () => {
          if (!t || t.destroyed) return;
          // 🔥 CRITICAL FIX: Only apply lockedAlpha if tile is STILL locked!
          // If openLockedBounceParallel already unlocked this tile (spawned as active), do NOT overwrite alpha
          if (!t.locked) return;
          t._spawned = false;
          t.alpha = lockedAlpha;
          // Ensure locked look persists after any deferred tweens
          trackAppTimeout(() => {
            if (!t || t.destroyed) return;
            if (!t.locked) return; // 🔥 Same check - tile may have been unlocked meanwhile
            t.alpha = lockedAlpha;
            t._spawned = false;
          }, 80);
        }
      });
      tl.to(t.scale, { x: 1.08, y: 1.08,  duration: 0.16, ease: 'back.out(2.1)' }, 0)
        .to(t.scale, { x: 0.96, y: 0.96,  duration: 0.10, ease: 'power2.inOut' })
        .to(t.scale, { x: 1.02, y: 1.02,  duration: 0.10, ease: 'power2.out' })
        .to(t.scale, { x: 1.00, y: 1.00,  duration: 0.12, ease: 'back.out(2)' });
      gsap.timeline({ delay: delay / 1000 })
        .to(trg, { rotation:  0.035*dir,      duration: 0.10, ease: 'power2.out' })
        .to(trg, { rotation: -0.035*0.6*dir,  duration: 0.12, ease: 'power2.out' })
        .to(trg, { rotation:  0,              duration: 0.14, ease: 'power2.out' });
    } catch (err) {
      devWarn('⚠️ Failed to spawn locked tile with pop:', err);
    }
  });
  try { drawBoardBG?.(); } catch {}
}

// Track if wild-juice has been spawned (first wild spawn should be wild-juice)
let wildJuiceSpawned = false;
// Track if wild-magnet has been spawned (second wild spawn should be wild-magnet)
let wildMagnetSpawned = false;
// 🔥 USER REQUEST: Track if first wild has been spawned (must be wild zvjezdica)
let firstWildSpawned = false;
// Track total wild spawns to enforce first/second sequence.
let wildSpawnCount = 0;
// Track wild-merge locked tile spawns (1st=7, 2nd=4)
let wildMergeLockedSpawnCount = 0;
const WILD_MAGNET_SPAWN_CHANCE = 0.3; // 30% chance new wild is a magnet (after first wild-juice and wild-magnet)
const WILD_JUICE_RESPAWN_CHANCE = 0.4; // 40% chance wild-juice spawns again after first spawn

async function spawnWildFromMeter(){
  if (wildMeter < 1) {
    devLog('⚠️ spawnWildFromMeter called without enough charge. Raw meter:', wildMeter);
    return false;
  }
  
  // 🔥 SOURCE OF TRUTH: Preload Bar Logic
  // Case B — 2 tiles stack → result = 6 (NO PRELOAD SPAWN)
  // If stacking the last two tiles results in Merge-6: Trigger CLEAN BOARD immediately
  // Preload bar must NOT spawn wild, even if the action completes the bar
  // 🔥 CRITICAL FIX: Skip wild spawn if last merge is in progress
  // Problem: Last merge (2 tiles) → merge6 → wild meter se puni → wild spawn → nova kockica na board prije clean board!
  // Solution: Provjeri da li postoji merge6 tile s _isLastMerge flag-om
  if (hasLastMergeTile({ tiles: STATE.tiles, devLog })) return false;
  if (busyEnding || (window as any).__ccBoardTransitionActive === true) {
    devLog('⏸️ spawnWildFromMeter skipped - endgame/transition active');
    return false;
  }
  // 🔥 BUG FIX: Block wild spawn when fail screen is pending (during 1.5s wait)
  // Prevents setValue on destroyed tile when fail screen clears board mid-spawn
  if ((window as any).__ccFailScreenPending === true) {
    devLog('⏸️ spawnWildFromMeter skipped - fail screen pending');
    return false;
  }

  const consumeCharge = () => consumeWildCharge({
    wildMeter,
    setWildMeter: (v) => { wildMeter = v; },
    setStateWildMeter: (v) => { STATE.wildMeter = v; },
    resetWildProgress,
  });

  const attempted = new Set();
  const maxAttempts = 12;
  let tries = 0;
  let spawned = false;
  let lastCell = null;
  // 🔥 CRITICAL: Exclude drag-origin when drag is active — grid is temporarily null there, must not spawn wild on it
  const excludeCells: { r: number; c: number }[] = [];
  if (drag && (drag as any).t && typeof (drag as any).startGX === 'number' && typeof (drag as any).startGY === 'number') {
    excludeCells.push({ r: (drag as any).startGY, c: (drag as any).startGX });
  }

  while (tries < maxAttempts && !spawned) {
    const cell = randomEmptyCell(excludeCells.length ? excludeCells : undefined);
    if (!cell) {
      tries++;
      await waitTracked(40);
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
      const decided = decideWildType({
        boardNumber,
        firstWildSpawned,
        wildSpawnCount,
        filterWildType,
        devLog,
        devWarn,
      });
      if (!decided) {
        tries++;
        continue;
      }
      const { spawnJuice, spawnMagnet, spawnTnt } = decided;
      
      const ok = await openAtCell(cell.c, cell.r, { 
        isWild: true, 
        isWildMagnet: spawnMagnet,
        isWildJuice: spawnJuice,
        isWildTnt: spawnTnt
      });
      
      if (ok) {
        consumeCharge();
        spawned = true;
        
        // 🔥 USER REQUEST: Mark first wild as spawned
        const wasFirstWild = !firstWildSpawned;
        if (!firstWildSpawned) {
          firstWildSpawned = true;
        }
        wildSpawnCount += 1;
        
        if (spawnJuice) {
          wildJuiceSpawned = true; // Mark as spawned (but can spawn again)
          devLog('🍺 Wild-juice spawned (35% random chance)');
          // No board shake on spawn - only on merge 6
        } else if (spawnMagnet) {
          wildMagnetSpawned = true; // Mark as spawned
          if (wasFirstWild && boardNumber === 1) {
            devLog('🧲 Board 1: First wild-magnet spawned from preloader');
          } else {
            devLog('🧲 Wild-magnet spawned (20% random chance)');
          }
        } else if (spawnTnt) {
          if (wasFirstWild) {
            devLog('💥 First wild spawned: TNT (Explosion Pack)');
          } else {
            devLog('💥 Wild-TNT spawned (Explosion Pack, 10% random chance)');
          }
        } else {
          if (wasFirstWild) {
            devLog('⭐ First wild spawned: wild zvjezdica (stars)');
          } else {
            devLog('⭐ Regular wild spawned (40% random chance - stars)');
          }
        }
      } else {
        devWarn('⚠️ Wild spawn skipped (cell no longer empty):', cell);
        tries++;
      }
    } catch (error) {
      devWarn('⚠️ Wild spawn attempt failed at', cell, error);
      tries++;
    }
  }

  if (!spawned) {
    devWarn('🚨 CRITICAL: Unable to spawn wild cube after', tries, 'attempts. Meter remains at', wildMeter);
    return false;
  }

  if (wildSpawnRetryTimer) {
    clearTimeout(wildSpawnRetryTimer);
    wildSpawnRetryTimer = null;
  }

  devLog('✅ Wild cube spawned successfully at', lastCell?.c, lastCell?.r, 'Leftover meter:', wildMeter);
  return true;
}

// -------------------- merge --------------------

// 🔥 v112: pickWildValue moved to app-core-utils.ts
// Imported: pickWildValue
function merge(src: Tile, dst: Tile, helpers: MergeHelpers){
  const __replayToken = replayRecorder.beginStep('merge', {
    src: src ? { gridX: src.gridX, gridY: src.gridY, value: src.value, special: src.special } : null,
    dst: dst ? { gridX: dst.gridX, gridY: dst.gridY, value: dst.value, special: dst.special } : null,
  });
  try {
  logger.debug('🔥🔥🔥 MERGE FUNCTION CALLED', 'app-core', { srcValue: src?.value, dstValue: dst?.value });
  logger.debug('🔥🔥🔥 MERGE DESTINATION CHECK', 'app-core', {
    hasDst: !!dst,
    dstValue: dst?.value,
    dstLocked: dst?.locked,
    dstDestroyed: dst?.destroyed,
    dstGridX: dst?.gridX,
    dstGridY: dst?.gridY,
    isInTiles: typeof getTiles === 'function' && getTiles ? getTiles().includes(dst) : 'unknown'
  });
  
  if (busyEnding) { helpers.snapBack?.(src); return; }
  // 🔥 BUG FIX: Prevent duplicate spawns when wild star/juice are used rapidly
  // If spawn is in progress from previous merge, block new merge to prevent duplicate spawns
  if (merge6SpawnInProgress && merge6SpawnInProgressIsWild) {
    devWarn('🚨🚨🚨 MERGE BLOCKED: Wild merge-6 spawn in progress - preventing rapid duplicate');
    helpers.snapBack?.(src);
    return;
  }
  if (src === dst) { helpers.snapBack(src); return; }
  
  // CRITICAL: Validate that both tiles are valid and merge is allowed
  if (!src || !dst || src.destroyed || dst.destroyed) {
    devWarn('⚠️ MERGE: Invalid tiles - src:', src, 'dst:', dst);
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
    devWarn('🛡️ MERGE BLOCKED: Only one tile is wild-magnet affected (protected tile cannot merge with others)');
    devWarn('⚠️ Source protected:', srcIsWildMagnetAffected, 'Destination protected:', dstIsWildMagnetAffected);
    devWarn('⚠️ Protected tiles can only merge with other protected tiles (pulled tiles merge)');
    helpers.snapBack?.(src);
    return;
  }
  
  // CRITICAL: If destination is locked or has value 0, this is not a valid merge (ghost placeholder)
  // BUT: For pulled tiles merge (both wild-magnet affected), allow merge even if dst is locked/value 0
  if (dst.locked || (dst.value | 0) <= 0) {
    if (!isPulledTilesMerge) {
      devWarn('🚨🚨🚨 MERGE BLOCKED: Destination is locked or has value 0');
      devWarn('⚠️ Destination:', { locked: dst.locked, value: dst.value, gridX: dst.gridX, gridY: dst.gridY });
      helpers.snapBack?.(src);
      return;
    } else {
      devLog('🧲 MERGE: Allowing pulled tiles merge even if dst is locked/value 0 (both are wild-magnet affected)');
    }
  }
  
  // Block wild/wild, wild/magnet, magnet/magnet, wild-juice/wild-juice, wild-juice/wild, wild-juice/magnet merges
  // BUT: Allow wild star to merge with merge 6 tile (value 6 without special)
  // BUT: If BOTH tiles are wild-magnet affected (pulled tiles), allow merge regardless of wild status
  const srcIsWild = src?.special === 'wild' || src?.special === 'wild-juice' || src?.special === 'wild-tnt';
  const dstIsWild = dst?.special === 'wild' || dst?.special === 'wild-juice' || dst?.special === 'wild-tnt';
  const srcIsMerge6 = (src.value|0) === 6 && !src.special;
  const dstIsMerge6 = (dst.value|0) === 6 && !dst.special;
  
  // 🔥 NEW: Allow wild star to merge with merge 6 tile
  if ((srcIsWild && dstIsMerge6) || (dstIsWild && srcIsMerge6)) {
    devLog('⭐ MERGE ALLOWED: Wild star merging with merge 6 tile');
    // Allow this merge - it will create a new merge 6
  } else if ((srcIsWild && dstIsWild) || 
      (src?.special === 'wild-magnet' && dst?.special === 'wild-magnet') ||
      (srcIsWild && dst?.special === 'wild-magnet') ||
      (src?.special === 'wild-magnet' && dstIsWild)){ 
    // CRITICAL: If both tiles are wild-magnet affected (pulled tiles), allow merge even if wild/wild
    if (!isPulledTilesMerge) {
      devWarn('🚨🚨🚨 MERGE BLOCKED: Wild/wild, wild/magnet, or magnet/magnet merge not allowed');
      helpers.snapBack?.(src); 
      return;
    } else {
      devLog('🧲 MERGE: Allowing wild/wild merge because both tiles are wild-magnet affected (pulled tiles)');
    }
  }

  const sum      = (src.value|0) + (dst.value|0);
  const srcDepth = src.stackDepth || 1;
  const dstDepth = dst.stackDepth || 1;

  // Wild-magnet works exactly like wild: always merges to 6
  // Also, if BOTH tiles are _wildMagnetAffected (pulled tiles), they act like wild
  // NOTE: srcIsWildMagnetAffected and dstIsWildMagnetAffected are already declared above
  const wildActive = (src.special === 'wild' || dst.special === 'wild' || src.special === 'wild-magnet' || dst.special === 'wild-magnet' || src.special === 'wild-juice' || dst.special === 'wild-juice' || src.special === 'wild-tnt' || dst.special === 'wild-tnt') ||
                     (srcIsWildMagnetAffected && dstIsWildMagnetAffected);
  const wildTargetValue = wildActive ? ((src.special === 'wild' || src.special === 'wild-magnet' || src.special === 'wild-juice' || src.special === 'wild-tnt' || srcIsWildMagnetAffected) ? (dst.value|0) : (src.value|0)) : null;
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
  let starsToHudTriggered = false;
  const getMerge6ScreenPos = (tileForCenter: any) => {
    const local = centerInBoard(board, tileForCenter, TILE);
    try {
      if (board && typeof (board as any).toGlobal === 'function') {
        const global = (board as any).toGlobal({ x: local.x, y: local.y });
        if (global && Number.isFinite(global.x) && Number.isFinite(global.y)) {
          return { x: global.x, y: global.y };
        }
      }
    } catch {}
    return local;
  };
  
  // Calculate effSum early for wild star check (wild always merges to 6)
  const tempEffSum = wildActive ? 6 : sum;
  
  devLog('⭐ EARLY wild star check - tempEffSum:', tempEffSum, 'srcSpecial:', srcSpecialForStarCheck, 'dstSpecial:', dstSpecialForStarCheck);
  
  if (tempEffSum === 6) {
    devLog('⭐ tempEffSum === 6, checking for wild star...');
    const srcIsWildStar = srcSpecialForStarCheck === 'wild';
    const dstIsWildStar = dstSpecialForStarCheck === 'wild';
    
    devLog('⭐ Wild star check:', { srcIsWildStar, dstIsWildStar });
    
    if (srcIsWildStar || dstIsWildStar) {
      wildStarTileForAnimation = srcIsWildStar ? src : (dstIsWildStar ? dst : null);
      const hasWildStarSystem = !!(wildStarTileForAnimation as any)?._wildStarSystem;
      
      devLog('⭐ EARLY wild star check:', {
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
                devWarn('⚠️ Star sprite has no texture, skipping');
                return null;
              }
              
              return {
                texture: texture, // Save texture reference (not sprite!)
                globalX: globalPos.x,
                globalY: globalPos.y,
                scale: { x: scaleX, y: scaleY }
              };
            } catch (err) {
              devWarn('⚠️ Failed to save star data early:', err);
              return null;
            }
          }).filter(Boolean);
          
          // Save wild tile screen position
          try {
            const wildTileGlobalPos = wildStarTileForAnimation.getGlobalPosition();
            savedWildTileScreenPosEarly = { x: wildTileGlobalPos.x, y: wildTileGlobalPos.y };
          } catch {
            devWarn('⚠️ Failed to get wild tile global position for early saving');
          }
          
          devLog('✅ Saved', savedStarPositionsEarly.length, 'star positions EARLY (before any transformations)');
        } else {
          devWarn('⚠️ Wild star system not found or empty in early check, cannot save star data');
        }
        
        devLog('✅ Will animate stars to HUD after merge animation');
      } else {
        devLog('⚠️ Wild star tile found but conditions not met:', {
          hasWildStarTile: !!wildStarTileForAnimation,
          hasWildStarSystem
        });
      }
    } else {
      devLog('⭐ Not a wild star merge:', { srcSpecialForStarCheck, dstSpecialForStarCheck });
    }
    
    // ✨ Non-star wilds (juice only): send 1-3 stars to HUD
    if (!shouldAnimateStarsToHUD) {
      const srcIsNonStarWild = srcSpecialForStarCheck === 'wild-juice';
      const dstIsNonStarWild = dstSpecialForStarCheck === 'wild-juice';
      if (srcIsNonStarWild || dstIsNonStarWild) {
        const wildTile = srcIsNonStarWild ? src : (dstIsNonStarWild ? dst : null);
        const starCount = 1 + Math.floor(Math.random() * 3); // 1..3
        if (starCount > 0) {
          const starTexture = Texture.from('./assets/small-star.png');
          let basePos = null;
          try {
            if (wildTile && typeof wildTile.getGlobalPosition === 'function') {
              const gp = wildTile.getGlobalPosition();
              if (gp && Number.isFinite(gp.x) && Number.isFinite(gp.y)) {
                basePos = { x: gp.x, y: gp.y };
              }
            }
          } catch {}
          if (!basePos) {
            const fallback = getMerge6ScreenPos(wildTile || dst);
            basePos = { x: fallback.x, y: fallback.y };
          }
          
          savedWildTileScreenPosEarly = basePos;
          savedStarPositionsEarly = [];
          for (let i = 0; i < starCount; i++) {
            const offsetX = (Math.random() - 0.5) * TILE * 0.6;
            const offsetY = (Math.random() - 0.5) * TILE * 0.6;
            const scale = 0.45 + Math.random() * 0.25;
            savedStarPositionsEarly.push({
              texture: starTexture,
              globalX: basePos.x + offsetX,
              globalY: basePos.y + offsetY,
              scale: { x: scale, y: scale }
            });
          }
          
          shouldAnimateStarsToHUD = savedStarPositionsEarly.length > 0;
          devLog('✨ Non-star wild: prepared stars to HUD', { starCount, basePos, shouldAnimateStarsToHUD });
        }
      }
    }
  } else {
    devLog('⭐ Not merge 6, tempEffSum:', tempEffSum);
  }
  
  // 🔥 NOTE: Bubbles animation is now triggered when merge 6 animation starts (in effSum === 6 block)
  // This ensures bubbles start exactly when merge 6 shards animation begins

  // Wild cube logic: always merge to 6, but remember target for later spawn
  if (wildActive) {
    effSum = 6; // Wild always merges to 6
    const avoidValue = Number.isFinite(wildTargetValue) ? wildTargetValue : null;
    dst._wildMergeTarget = avoidValue;
    devLog('🎯 Wild merge: target was', wildTargetValue, 'will merge to 6, spawn will avoid', avoidValue);
  }

  grid[src.gridY][src.gridX] = null;
  dst.eventMode = 'none';

  // 🔥 CRITICAL FIX: Save srcSpecial and dstSpecial BEFORE any branches
  // This ensures they're available in both effSum < 6 and effSum === 6 blocks
  const srcSpecial = src?.special;
  const dstSpecial = dst?.special;

  // ---- 2..5 (računaj combo i ovdje)
  if (effSum < 6){
    // 🔥 CRITICAL FIX: Ensure dst.value is set immediately (before requestAnimationFrame)
    // This prevents race conditions where visuals might use stale value
    devLog('🔧 MERGE: Setting dst.value to', effSum, 'from src.value', src.value, '+ dst.value', dst.value, 'srcDepth:', srcDepth, 'dstDepth:', dstDepth);
    dst.value = effSum;
    makeBoard.setValue(dst, effSum, srcDepth);
    if (wildActive) clearWildState(dst);

    // 🔥 USER REQUEST: Show smoke effect below stacked tiles (2 tiles that don't result in merge 6)
    // Smoke with 70% opacity, behind tiles, using object pooling
    smokeBubblesAtTile(board, dst, TILE, 0.72, {
      behind: true,
      baseAlpha: 0.42,
      sizeScale: 0.48,
      distanceScale: 0.345,
      countScale: 0.36,
      ttl: 0.192,
      durationScale: 0.48,
      fxTag: 'stack-smoke',
      blendMode: 'add',
      spawnShape: 'box'
    });

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
          trackTween(layer, {
            rotation: rotationAmount, // Set to final value, don't add
            duration: 0.2,
            ease: 'power2.out'
          });

          // Update previous direction for next layer
          previousDirection = rotationDirection;

          // Fade out overlay after animation
          trackTween(overlay, {
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

    score = applyMergeScore({
      effSum,
      score,
      wildActive,
      SCORE_CAP,
      statsService,
      devLog,
      devError,
    });
    
    updateHUD();
    
    triggerMergeHaptics({ wildActive, trackAppTimeout });
    
    // 🔥 CRITICAL: Check if this is wild-magnet merge that will pull tiles
    // If so, skip combo increment AND timer here - magnet pull will handle both with proper count
    // NOTE: hasTilesToPull will be calculated later in merge-6 block, but we need a preliminary check here
    const isWildMagnetMerge = src.special === 'wild-magnet' || dst.special === 'wild-magnet';
    // 🔥 CRITICAL: Store isWildMagnetMerge for later use in last merge check
    (dst as any)._isWildMagnetMerge = isWildMagnetMerge;
    
    // Combo++ (bez realnog capa), bump anim
    handleMergeCombo({
      combo,
      effSum,
      isWildMagnetMerge,
      boardNumber,
      statsService,
      hudSetCombo,
      scheduleComboDecay,
      HUD,
      devLog,
      devError,
    });

    // 🔥 CRITICAL FIX: Check if this is last merge BEFORE adding wild progress
    // This prevents wild meter from filling and triggering wild spawn on last merge
    // We need to check early (before merge 6 block) to prevent race condition
    const lastMergeResult = handleLastMergeEarly({
      tiles,
      src,
      dst,
      effSum,
      boardNumber,
      wildMeter,
      setWildMeter: (v) => { wildMeter = v; },
      setStateWildMeter: (v) => { STATE.wildMeter = v; },
      HUD,
      setPendingCleanBoard,
      devLog,
      devWarn,
      isWildMagnetMerge,
    });
    const {
      visibleTilesCountBeforeWildProgress,
      activeTilesCountBeforeWildProgress,
      activeTilesBeforeWildProgress,
      wasLastThreeOrMoreStackForCheck,
    } = lastMergeResult;
    
    if (!lastMergeResult.isActuallyLastMerge) {
      // Normal merge - add wild progress
      addWildProgress(WILD_INC_SMALL);
    }
    
    // SMART SAVE: Debounced save after merge+spawn flow completes
    // 1200ms delay ensures all spawn animations complete before save
    // This prevents saving mid-animation which causes inconsistent state
    debouncedSaveGameState(1200);
    
    // Ghost placeholders are now fixed and always visible

    // 🔥 NOTE: srcSpecial and dstSpecial are already defined at line 3648-3649 (before if blocks)
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
        devWarn('⚠️ Failed to clear drag binding from src during merge', err);
      }
    }

    // 🔥 NOTE: wildStarTileForAnimation and shouldAnimateStarsToHUD are already set at the beginning of merge function
    // Use the pre-captured values here in the animation callback

    trackTween(src, {
      x: dst.x, y: dst.y, duration: 0.08, ease: 'power2.out',
      onComplete: async () => {
        // 🔥 CRITICAL: Use EARLY saved star data (saved before any transformations)
        // This ensures data is available even if dst tile became merge 6 and lost _wildStarSystem
        const savedStarPositionsSmall = savedStarPositionsEarly.length > 0 ? savedStarPositionsEarly : [];
        const savedWildTileScreenPosSmall = savedWildTileScreenPosEarly;
        
        // Get merge 6 position for reference (convert to screen coordinates)
        const merge6PosSmall = getMerge6ScreenPos(dst);
        
        // Get HUD star icon position
        let hudStarPosSmall = null;
        if (shouldAnimateStarsToHUD) {
          try {
            if (typeof HUD.getStarHudPosition === 'function') {
              hudStarPosSmall = HUD.getStarHudPosition();
              devLog('⭐ HUD star position retrieved:', hudStarPosSmall);
            } else {
              devWarn('⚠️ HUD.getStarHudPosition is not a function');
            }
          } catch (err) {
            devError('❌ Error getting HUD star position:', err);
          }
        }
        
        removeTile(src);
        
        // 🔥 STARS ANIMATION: Trigger animation with EARLY saved star data (after tile is removed)
        // 🔥 CRITICAL: Always trigger animation if shouldAnimateStarsToHUD is true, even if bubbles animation is running
            const isWildJuiceMerge = srcSpecial === 'wild-juice' || dstSpecial === 'wild-juice';
            if (shouldAnimateStarsToHUD && !starsToHudTriggered) {
              if (savedStarPositionsSmall.length > 0 && hudStarPosSmall) {
            devLog('⭐ Starting stars animation to HUD with saved data:', { 
              starCount: savedStarPositionsSmall.length,
              merge6Pos: merge6PosSmall,
              hudStarPos: hudStarPosSmall,
              hasBubblesRunning: isWildJuiceBubblesExplosionActive?.() || false
            });
            
            starsToHudTriggered = true;
            (async () => {
              try {
                if (!isWildJuiceMerge) showSparkleText();
                devLog('⭐ Calling animateStarsToHudIcon with saved star data (INSTANT):', { 
                  board: !!board, 
                  stage: !!stage,
                  savedStarCount: savedStarPositionsSmall.length,
                  merge6Pos: merge6PosSmall,
                  hudStarPos: hudStarPosSmall
                });
                await animateStarsToHudIcon(board, stage, savedStarPositionsSmall, savedWildTileScreenPosSmall, merge6PosSmall, hudStarPosSmall, app);
                devLog('✅ Stars animation to HUD completed (INSTANT)');
              } catch (error) {
                starsToHudTriggered = false;
                devError('❌ Failed to animate stars to HUD:', error);
              }
            })();
          } else {
            devWarn('⭐ Stars animation skipped - missing data:', { 
              shouldAnimate: shouldAnimateStarsToHUD,
              savedStarCount: savedStarPositionsSmall?.length || 0,
              hasHudPos: !!hudStarPosSmall,
              hasEarlySavedData: savedStarPositionsEarly.length > 0,
              hasBubblesRunning: isWildJuiceBubblesExplosionActive?.() || false
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
            devWarn('⚠️ Failed to rebind drag to merged tile', error);
          }
        }
        
        // 🔥 CRITICAL FIX: SKIP stuck check for merge-6 (effSum === 6)
        // Merge-6 will spawn new tiles, so we should check AFTER spawn completes, not before
        // This prevents false "stuck" detection when board has 2 tiles (e.g., 4 and 2) that can merge
        // 🔥 CRITICAL FIX: SKIP this check if wild-magnet merge (magnet will pull tiles AFTER this merge)
        const isWildMagnetMerge = srcSpecial === 'wild-magnet' || dstSpecial === 'wild-magnet';
        const isRegularMergeOnly = !srcSpecial && !dstSpecial;
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
        if (!busyEnding && !isMerge6 && (!isWildMagnetMerge || isRegularMergeOnly)) {
          // Add delay to ensure removeTile has completed and tiles array is updated
          // 🔥 INCREASED DELAY: 100ms instead of 50ms to ensure tiles array is fully updated
          await waitTracked(100);
          
          // 🔥 CRITICAL: Verify dst tile state before checking
          const activeTilesBeforeCheck = tiles.filter(tileIsActive);
          const dstInTiles = tiles.includes(dst);
          const dstIsActive = dst && !dst.locked && (dst.value|0) > 0;
          
          // 🔥 CRITICAL FIX: Check if there are 2+ active tiles that can still merge BEFORE checking stuck
          // This prevents false "stuck" detection when 2 tiles (e.g., 3 and 2) can still stack
          // 🔥 v112: Using centralized checkEndGame() instead of direct anyMergePossible() call
          // 🔥 BUG FIX: DO NOT return early - always continue to full stuck check below
          // Previous bug: If visibleTilesBeforeCheck >= 2 and quickCheckResult.type === 'continue',
          // we would return early and never check stuck state. But after merge completes (e.g., 1+1=2),
          // there might be only 1 tile left that can't merge, and we need to detect that!
          const visibleTilesBeforeCheck = activeTilesBeforeCheck.length;
          if (visibleTilesBeforeCheck >= 2) {
            // Use centralized end game checker to determine if game can continue
            const quickCheckContext: EndGameContext = {
              tiles: activeTilesBeforeCheck,
              moves,
              makeBoard
            };
            const quickCheckResult = checkEndGame(quickCheckContext, true);
            if (quickCheckResult.type === 'continue') {
              logger.debug('✅ Post-merge check: 2+ tiles remain and can still merge/stack - will check full stuck state below', 'app-core', {
                activeTiles: activeTilesBeforeCheck.map(t => ({ value: t.value, special: t.special }))
              });
              // Don't return early - continue to full stuck check below to catch edge cases
              // (e.g., after merge completes, there might be only 1 tile left)
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
              devLog('🚨🚨🚨 LAST MOVE DETECTED - Regular + regular → stack (not merge 6), only 1 tile remains, CANNOT reach merge 6, triggering fail screen');
              try { resetEndgameHint(); } catch {}
              devLog('🚨 Details:', {
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
                devLog('⏳ Waiting 1.5s so player can see board state (no moves), then fail screen...');
                try { showNoMovesText(); } catch {}
                await waitTracked(1500);
                try { await exitNoMovesText(); } catch {}
                showFinalScreen();
              }
              return;
            } else {
              // 🔥 USER REQUEST FIX: Stack CAN reach merge 6, but check what remains AFTER self-merge
              // Example: value 3 (depth 2) can self-merge to 6, but then it's merge 6 (depth 1) = DEAD END!
              const afterSelfMergeDepth = finalStackDepth - 1; // Depth decreases by 1 after self-merge
              const afterSelfMergeValue = finalValue + finalValue; // New value after self-merge
              
              devLog('🔍 Stack can reach merge 6 - checking what remains after self-merge:', {
                beforeSelfMerge: { value: finalValue, depth: finalStackDepth },
                afterSelfMerge: { value: afterSelfMergeValue, depth: afterSelfMergeDepth },
                isDeadEnd: afterSelfMergeValue === 6 && afterSelfMergeDepth === 1
              });
              
              // If self-merge results in merge 6 (depth 1) → that's a DEAD END (last move)
              if (afterSelfMergeValue === 6 && afterSelfMergeDepth === 1) {
                  devLog('🚨🚨🚨 LAST MOVE DETECTED - Stack can self-merge to merge 6 BUT will result in merge 6 (depth 1) = DEAD END, triggering fail screen');
                  try { resetEndgameHint(); } catch {}
                devLog('🚨 Details:', {
                  srcValue: src.value,
                  dstValue: dst.value,
                  effSum,
                  finalTileValue: finalValue,
                  finalTileStackDepth: finalStackDepth,
                  afterSelfMergeValue,
                  afterSelfMergeDepth,
                  explanation: `${finalValue}+${finalValue}=${afterSelfMergeValue} (depth ${finalStackDepth} → ${afterSelfMergeDepth}) = merge 6 with depth 1 = DEAD END`
                });
                
                if (!busyEnding) {
                  devLog('⏳ Waiting 1.5s so player can see board state (no moves), then fail screen...');
                  try { showNoMovesText(); } catch {}
                  await waitTracked(1500);
                  try { await exitNoMovesText(); } catch {}
                  showFinalScreen();
                }
                return;
              }
              
              // If after self-merge there's still room to continue (e.g., value 2, depth 3 → 4, depth 2 → can continue)
              devLog('✅ Stack CAN reach merge 6 and can continue after (', finalValue, '+', finalValue, '=', afterSelfMergeValue, ', depth:', finalStackDepth, '→', afterSelfMergeDepth, ') - NOT triggering fail screen');
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
              devLog('🚨🚨🚨 LAST MOVE DETECTED - Regular + regular → stack (3+ tiles, all tiles involved), only 1 tile remains, CANNOT reach merge 6, triggering fail screen');
              try { resetEndgameHint(); } catch {}
              devLog('🚨 Details:', {
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
                devLog('⏳ Waiting 1.5s so player can see board state (no moves), then fail screen...');
                try { showNoMovesText(); } catch {}
                await waitTracked(1500);
                try { await exitNoMovesText(); } catch {}
                showFinalScreen();
              }
              return;
            } else {
              // 🔥 USER REQUEST FIX: Stack CAN reach merge 6, but check what remains AFTER self-merge
              // Same logic as wasLastTwoRegularStack case above
              const afterSelfMergeDepth = finalStackDepth - 1;
              const afterSelfMergeValue = finalValue + finalValue;
              
              devLog('🔍 Stack (3+) can reach merge 6 - checking what remains after self-merge:', {
                beforeSelfMerge: { value: finalValue, depth: finalStackDepth },
                afterSelfMerge: { value: afterSelfMergeValue, depth: afterSelfMergeDepth },
                isDeadEnd: afterSelfMergeValue === 6 && afterSelfMergeDepth === 1
              });
              
              // If self-merge results in merge 6 (depth 1) → that's a DEAD END (last move)
              if (afterSelfMergeValue === 6 && afterSelfMergeDepth === 1) {
                  devLog('🚨🚨🚨 LAST MOVE DETECTED - Stack (3+) can self-merge to merge 6 BUT will result in merge 6 (depth 1) = DEAD END, triggering fail screen');
                  try { resetEndgameHint(); } catch {}
                
                if (!busyEnding) {
                  devLog('⏳ Waiting 1.5s so player can see board state (no moves), then fail screen...');
                  try { showNoMovesText(); } catch {}
                  await waitTracked(1500);
                  try { await exitNoMovesText(); } catch {}
                  showFinalScreen();
                }
                return;
              }
              
              devLog('✅ Stack (3+) CAN reach merge 6 and can continue after (', finalValue, '+', finalValue, '=', afterSelfMergeValue, ', depth:', finalStackDepth, '→', afterSelfMergeDepth, ') - NOT triggering fail screen');
            }
          }

          // 🔥 SAFETY NET: If exactly 1 active regular tile remains and it cannot self-merge to 6, trigger fail
          const activeTileCount = activeTilesBeforeCheck.length;
          if (activeTileCount === 1) {
            const onlyTile = activeTilesBeforeCheck[0];
            const onlyValue = onlyTile?.value | 0;
            const onlyDepth = onlyTile?.stackDepth || 1;
            const isWild = onlyTile?.special === 'wild' || onlyTile?.special === 'wild-juice' || onlyTile?.special === 'wild-tnt' || onlyTile?.special === 'wild-magnet';
            const canSelfMergeToSix = !isWild && onlyDepth >= 2 && (onlyValue + onlyValue) <= 6;
            if (!isWild && !canSelfMergeToSix && !busyEnding) {
              devLog('🚨 SAFETY NET: Single regular tile left that cannot reach merge 6 - waiting 0.5s then fail screen');
              try { resetEndgameHint(); } catch {}
              await waitTracked(500);
              showFinalScreen();
              return;
            }
          }
          
          devLog('🔍 Post-merge stuck check - DETAILED STATE:', {
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
          
          devLog('🔍 Post-merge stuck check - RESULT:', {
            resultType: stuckCheckResult.type,
            resultReason: stuckCheckResult.reason,
            activeTilesCount: activeTilesBeforeCheck.length
          });
          
          if (stuckCheckResult.type === 'stuck') {
          devLog('🚨🚨🚨 GAME STUCK after regular merge - triggering fail screen');
          try { resetEndgameHint(); } catch {}
            devLog('🚨 Final state:', {
              activeTilesCount: activeTilesBeforeCheck.length,
              tiles: activeTilesBeforeCheck.map(t => ({ 
                value: t.value, 
                stackDepth: t.stackDepth || 1,
                special: t.special 
              })),
              reason: stuckCheckResult.reason
            });
            
            if (!busyEnding) {
              devLog('⏳ Waiting 1.5s so player can see board state (no moves), then fail screen...');
              try { showNoMovesText(); } catch {}
              await waitTracked(1500);
              try { await exitNoMovesText(); } catch {}
              showFinalScreen();
            } else {
              devWarn('⚠️ busyEnding is true, NOT showing fail screen');
            }
            return;
          } else {
            devLog('✅ Post-merge stuck check: Game continues -', stuckCheckResult.reason);
          }
        } else if (isWildMagnetMerge) {
          devLog('🧲 SKIPPING post-merge stuck check - wild-magnet will pull tiles after merge completes');
        } else if (isMerge6) {
          devLog('🎯 SKIPPING post-merge stuck check - merge-6 will spawn new tiles, check will happen AFTER spawn completes');
        }
        
        const isWildTntMergeNow = src?.special === 'wild-tnt' || dst?.special === 'wild-tnt';
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
          if (!isWildTntMergeNow) {
            woodShardsAtTile(board, dst, { enhanced: true, wild: true, count: 26, intensity: 1.6, spread: 1.6, size: 1.4, speed: 0.9, vanishDelay: 0.0, vanishJitter: 0.015 });
          }
          wildImpactEffect(dst, { squash: 0.24, stretch: 0.20, tilt: 0.14, bounce: 1.18 });
          if (!isWildTntMergeNow) {
            smokeBubblesAtTile(board, dst, TILE * 1.2, 2.6, { spawnShape: 'box' });
          }
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
            ttl: 0.9,
            spawnShape: 'box'
          } as any);
        }

        // countdown moves
        moves = Math.max(0, moves - 1);
        animateBoardHUD(boardNumber, 0.40);
        
        // 🔥 CRITICAL FIX: If moves === 0, delay check to ensure tiles array is updated after merge
        // Problem: checkMovesDepleted() was called immediately but tiles array might not be updated yet
        // Solution: Wait for merge animation to complete (400ms) before checking
        if (moves === 0) {
          // Wait for merge animation to complete before checking stuck state
          trackAppTimeout(() => {
            checkMovesDepleted();
          }, 400);
          return;
        }

        // 🔥 REFACTORED: Uklonjen STUCK PROTECTION timer - koristimo samo checkLevelEnd() s delay-om
        // checkLevelEnd() već provjerava sve potrebne scenarije kroz checkEndGame()
        // Nema potrebe za dodatnim timerom koji stvara race conditions
        
        // 🔥 CRITICAL BUG FIX: Always call checkLevelEnd() after merge completes (even if post-merge check passed)
        // This ensures stuck state is detected even when player merges tiles spawned by magnet
        // Example: Magnet spawns 2 tiles (1+1), player merges them (1+1=2), now stuck with 1 tile that can't merge
        // Previous bug: Post-merge check might return early if visibleTilesBeforeCheck >= 2, but after merge completes
        // there might be only 1 tile left that can't merge, and checkLevelEnd() wouldn't be called
        if (effSum !== 6) {
          // 🔥 CRITICAL FIX: Increase delay to ensure merge animation completes before endgame check
          // This prevents stuck detection from being blocked by merge animations
          // Delay increased from 100ms to 400ms to match merge animation duration
          trackAppTimeout(() => {
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
    // 🔥 CRITICAL FIX: Use saved srcSpecial/dstSpecial from line 3653-3654 (don't overwrite!)
    // These values were saved BEFORE any modifications to src/dst and BEFORE any branches
    // The saved values from outer scope (line 3653-3654) are already available in this closure
    // We DON'T need to reassign them - just use the saved values directly
    // 🔥 DEBUG: Log values to verify they're correct
    // Note: srcSpecial and dstSpecial are from outer scope (line 3653-3654), available via closure
    const savedSrcSpecial = srcSpecial; // From outer scope (line 3653)
    const savedDstSpecial = dstSpecial; // From outer scope (line 3654)
    
    devLog('🔍 MERGE 6: Using saved srcSpecial/dstSpecial from closure:', {
      savedSrcSpecial,
      savedDstSpecial,
      srcSpecialCurrent: src?.special,
      dstSpecialCurrent: dst?.special,
      srcDestroyed: src?.destroyed,
      dstDestroyed: dst?.destroyed,
      srcValue: src?.value,
      dstValue: dst?.value
    });
    
    // If saved values are undefined (shouldn't happen), use current values as fallback
    const srcSpecialForMerge6 = (savedSrcSpecial !== undefined && savedSrcSpecial !== null) ? savedSrcSpecial : (src?.special);
    const dstSpecialForMerge6 = (savedDstSpecial !== undefined && savedDstSpecial !== null) ? savedDstSpecial : (dst?.special);
    
    // 🔥 CRITICAL: Use these values throughout merge 6 block (create new const in this scope)
    // We can't shadow outer const, so we use new variable names
    const srcSpecialMerge6 = srcSpecialForMerge6;
    const dstSpecialMerge6 = dstSpecialForMerge6;
    
    // 🔥 NOTE: Bubbles animation is now triggered in drag-core.ts BEFORE merge function is called
    // This ensures bubbles start IMMEDIATELY when wild-juice is dropped, before any merge logic
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
    // 🔥 CRITICAL FIX: Include wild-juice in wild tile check (same as wild star)
    const activeTilesBeforeMerge = tiles.filter(t => {
      if (!t) return false;
      const isWild = t.special === 'wild' || t.special === 'wild-magnet' || t.special === 'wild-juice' || t.special === 'wild-tnt';
      if (isWild) return true; // Wild counts even if locked (last-merge detection)
      if (t.locked) return false;
      const hasValue = (t.value|0) > 0;
      return hasValue; // Include if value > 0
    });
    
    // 🔥 CRITICAL FIX v36: Count TOTAL tiles including stacked tiles (stackDepth)
    // This is essential for correct "last merge" detection with stacked tiles
    // Example: wild + stack(5, depth=3) + stack(5, depth=2) = 6 total tiles, not 3!
    // Previous bug: activeTilesCount = activeTilesBeforeMerge.length (ignored stackDepth)
    const activeTilesCount = activeTilesBeforeMerge.reduce((sum, t) => {
      const depth = t.stackDepth || 1;
      return sum + depth;
    }, 0);
    
    logger.debug('🔍 ACTIVE TILES COUNT (including stackDepth)', 'app-core', {
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
    // 🔥 CRITICAL FIX: Use srcSpecialMerge6/dstSpecialMerge6 (saved values) instead of srcSpecial/dstSpecial
    const isWildMagnetMerge = (srcSpecialMerge6 === 'wild-magnet' || dstSpecialMerge6 === 'wild-magnet');
    let hasTilesToPull = false;
    if (isWildMagnetMerge) {
      // 🎯 CRITICAL FIX: Count magnets INCLUDING their stackDepth!
      // Example: magnet with depth 1 + regular tile with depth 2 = 3 total tiles (not 2!)
      let magnetsOnBoard = 0;
      let regularTilesOnBoard = 0;
      for (const t of activeTilesBeforeMerge) {
        if (t.special === 'wild-magnet') {
          magnetsOnBoard += 1;
          continue;
        }
        if (t.special !== 'wild' && (t.value | 0) > 0) {
          regularTilesOnBoard += 1;
        }
      }
      
      // 🎯 USE activeTilesCount (includes stackDepth) instead of activeTilesBeforeMerge.length
      const totalActiveTiles = activeTilesCount; // Already calculated above with stackDepth!
      
      devLog('🧲 Magnet pull logic check:', {
        magnetsOnBoard,
        regularTilesOnBoard,
        totalActiveTiles,
        physicalTiles: activeTilesBeforeMerge.length,
        srcSpecial,
        dstSpecial
      });
      
      // 🔥 CRITICAL: ONLY special case where magnet behaves like wild (NO pull):
      // 1 magnet + 1 regular tile (last 2 tiles TOTAL including depth) → NO pull, behaves like wild
      // ALL other cases (including 2 magnets + 1 tile) → magnet pulls normally
      const isOneMagnetOneTile = magnetsOnBoard === 1 && regularTilesOnBoard === 1 && totalActiveTiles === 2;
      
      devLog('🧲 MAGNET PULL CHECK:', {
        magnetsOnBoard,
        regularTilesOnBoard,
        totalActiveTiles,
        physicalTiles: activeTilesBeforeMerge.length,
        isOneMagnetOneTile,
        srcSpecial,
        dstSpecial
      });
      
      if (isOneMagnetOneTile) {
        hasTilesToPull = false;
        devLog('🧲 Magnet behaves like wild (NO pull): 1 magnet + 1 tile (last 2)');
      } else {
        // Normal magnet behavior: Check if there are other tiles that can be pulled
      const targetTile = srcSpecialMerge6 === 'wild-magnet' ? src : dst;
      const candidates = tiles.filter((t: any) => {
        if (!t || t.destroyed) return false;
        if (t.locked) return false;
        if (t === targetTile) return false;
        if (t === src || t === dst) return false; // Don't count the merging tiles
          
          // 🔥 CRITICAL FIX: Exclude tiles that are currently being pulled by another magnet
          // If a tile is already marked as _wildMagnetAffected, it's being pulled by another magnet
          // and should NOT be counted as available for this pull
          if (t._wildMagnetAffected) {
            devLog('🔍 FILTER OUT: tile already being pulled by another magnet', { value: t.value, special: t.special });
            return false;
          }
          
          // 🔥 CRITICAL FIX v37: Check if tile is wild or magnet BEFORE checking value
          // Wild-magnet and wild tiles have value = 0, but they can STILL be pulled!
          // 🔥 CRITICAL FIX: Include wild-juice in wild tile check (same as wild star)
          const isWildOrMagnet = t.special === 'wild' || t.special === 'wild-magnet' || t.special === 'wild-juice' || t.special === 'wild-tnt';
          if (!isWildOrMagnet && (t.value | 0) <= 0) return false;
          
          // 🔥 CRITICAL: Wild-magnet CAN pull other wild-magnets! (MAGNET-ON-MAGNET FIX)
          // Magnet attracts everything - magnets, wild stars, ordinary tiles
        return true;
      });
      hasTilesToPull = candidates.length > 0;
      devLog('🧲 Wild-magnet merge detected - tiles that can be pulled:', candidates.length, hasTilesToPull ? '(will pull tiles, NOT last merge)' : '(no tiles to pull, might be last merge)');
      }
      // 🔥 CRITICAL: Store hasTilesToPull on dst tile for later use in last merge check
      if (dst && !dst.destroyed) {
        (dst as any)._hasTilesToPull = hasTilesToPull;
      }
      
      // 🔥 CRITICAL FIX: Store isWildMagnetLastTwo flag for last merge check
      // This is only valid for wild magnet merge, so we calculate it here
      if (
        magnetsOnBoard === 1 &&
        regularTilesOnBoard === 1 &&
        totalActiveTiles === 2 &&
        !hasTilesToPull &&
        !boardHasPersistentLockedTiles(tiles)
      ) {
        (dst as any)._isWildMagnetLastTwo = true;
        devLog('🧲 Wild magnet + regular (last 2 tiles, no pull) - marked as last merge candidate');
      }
    }
    
    // Calculate how many tiles are involved in this merge (including stacked tiles)
    const srcDepth = src.stackDepth || 1;
    const dstDepth = dst.stackDepth || 1;
    const combinedCount = srcDepth + dstDepth; // Total tiles involved in merge (including stacked)
    
    // 🔥 CRITICAL: If ALL active tiles on board are involved in this merge, it's the last merge
    // This works for ANY number of tiles: 2, 3, 4, 5, 6... as long as they're all involved
    
    // 🔥 ENHANCED LOGGING: Log all details for debugging
    logger.debug('🔍 LAST MERGE CHECK (BEFORE merge 6)', 'app-core', {
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
    // 🔥 CRITICAL FIX: Include wild-juice in wild tile check (same as wild star)
    // 🔥 CRITICAL FIX: Use srcSpecialMerge6/dstSpecialMerge6 (saved values) instead of srcSpecial/dstSpecial
    const oneIsRegularWild = (srcSpecialMerge6 === 'wild' || dstSpecialMerge6 === 'wild' || srcSpecialMerge6 === 'wild-juice' || dstSpecialMerge6 === 'wild-juice');
    const neitherIsWildMagnet = !(srcSpecialMerge6 === 'wild-magnet' || dstSpecialMerge6 === 'wild-magnet');
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
      devLog('🔍 REGULAR WILD LAST TWO CHECK:', {
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
    // 🔥 CRITICAL FIX: Include wild-juice in wild tile check (same as wild star)
    // 🔥 CRITICAL FIX: Use visibleTilesCount (visible tiles) NOT activeTilesCount (includes stackDepth)
    // 🔥 CRITICAL FIX: Use srcSpecialMerge6/dstSpecialMerge6 (saved values) instead of srcSpecial/dstSpecial
    const visibleTilesCountForWildMagnet = activeTilesBeforeMerge.length; // Number of VISIBLE tiles
    const isWildRegularLastTwo = (srcSpecialMerge6 === 'wild' || srcSpecialMerge6 === 'wild-magnet' || srcSpecialMerge6 === 'wild-juice' || dstSpecialMerge6 === 'wild' || dstSpecialMerge6 === 'wild-magnet' || dstSpecialMerge6 === 'wild-juice') &&
                                 visibleTilesCountForWildMagnet === 2 && // 🔥 FIX: ONLY if exactly 2 VISIBLE tiles total
                                 activeTilesBeforeMerge.includes(src) &&
                                 activeTilesBeforeMerge.includes(dst) &&
                                 !(isWildMagnetMerge && hasTilesToPull); // 🔥 CRITICAL: Exclude if wild-magnet will pull tiles
    
    // 🔥 CRITICAL FIX: Wild merge should ONLY be "last merge" if exactly 2 tiles total
    // If more than 2 tiles, it's NOT last merge because spawn will happen
    // Example: wild + 2 tiles = 3 tiles total → NOT last merge, will spawn
    // 🔥 CRITICAL FIX: Include wild-juice in wild tile check (same as wild star)
    // 🔥 CRITICAL FIX: Use visibleTilesCount (visible tiles) NOT activeTilesCount (includes stackDepth)
    // 🔥 CRITICAL FIX: Use srcSpecialMerge6/dstSpecialMerge6 (saved values) instead of srcSpecial/dstSpecial
    const visibleTilesCountForWildLast = activeTilesBeforeMerge.length; // Number of VISIBLE tiles
    const isWildLastTileMerge = (srcSpecialMerge6 === 'wild' || srcSpecialMerge6 === 'wild-magnet' || srcSpecialMerge6 === 'wild-juice' || dstSpecialMerge6 === 'wild' || dstSpecialMerge6 === 'wild-magnet' || dstSpecialMerge6 === 'wild-juice') &&
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
    // 🔥 CRITICAL FIX: Use srcSpecialMerge6/dstSpecialMerge6 (saved values) instead of srcSpecial/dstSpecial
    const srcIsWild = srcSpecialMerge6 && srcSpecialMerge6.startsWith('wild');
    const dstIsWild = dstSpecialMerge6 && dstSpecialMerge6.startsWith('wild');
    const bothAreRegularForMerge6 = !srcIsWild && !dstIsWild && 
                                    (src.value|0) > 0 && (dst.value|0) > 0;
    // 🔥 CRITICAL FIX: Use visibleTilesCount (visible tiles) NOT activeTilesCount (includes stackDepth)
    const visibleTilesCountForRegular = activeTilesBeforeMerge.length; // Number of VISIBLE tiles
    const isRegularRegularLastTwoMerge6 = bothAreRegularForMerge6 && 
                                          visibleTilesCountForRegular === 2 && // 🔥 FIX: Use visible tiles count
                                          activeTilesBeforeMerge.includes(src) && 
                                          activeTilesBeforeMerge.includes(dst) &&
                                          (src.value|0) + (dst.value|0) === 6; // Must be merge 6
    
    logger.debug('🔍 LAST MERGE CHECK DETAILS (with regular + regular support)', 'app-core', {
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
    // This covers ALL wild types: wild, wild-magnet, wild-juice, and any future wild types with "wild" prefix
    // 🔥 USER REQUEST: Simple rule - if exactly 2 VISIBLE tiles total and one is wild (any wild type), it's last merge
    // 🔥 CRITICAL FIX: Use activeTilesBeforeMerge.length (visible tiles) NOT activeTilesCount (includes stackDepth)
    const visibleTilesCount = activeTilesBeforeMerge.length; // Number of VISIBLE tiles (not including stackDepth)
    const isAnyWildLastTwo = (srcIsWild || dstIsWild) && 
                             (srcIsWild !== dstIsWild) && // One is wild, one is NOT wild
                             visibleTilesCount === 2 && // 🔥 FIX: Use visible tiles count, not activeTilesCount
                             activeTilesBeforeMerge.includes(src) && 
                             activeTilesBeforeMerge.includes(dst) &&
                             !(isWildMagnetMerge && hasTilesToPull); // 🔥 CRITICAL: Exclude if wild-magnet will pull tiles
    
    devLog('🔍 isAnyWildLastTwo CHECK:', {
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
    // This covers ALL wild types: wild, wild-magnet, wild-juice, and any future wild types
    // 🔥 SIMPLIFIED: Use isAnyWildLastTwo as PRIMARY check for wild + regular (covers all wild types)
    // 🔥 CRITICAL FIX: Also check if wild magnet was marked as last two (stored on dst tile)
    const isWildMagnetLastTwo = (dst as any)?._isWildMagnetLastTwo === true;
    let isLastMerge = isRegularRegularLastTwoMerge6 || isAnyWildLastTwo || isWildRegularLastTwo || isLastMergeableTiles || isWildLastTileMerge || isWildMagnetLastTwo;
    // 🔥 SAFETY: If more than 2 visible tiles existed before merge, this can NEVER be the last merge
    if (isLastMerge && visibleTilesCount > 2) {
      devWarn('⚠️ LAST MERGE OVERRIDE: visibleTilesCount > 2, forcing NOT last merge', {
        visibleTilesCount,
        isRegularRegularLastTwoMerge6,
        isAnyWildLastTwo,
        isWildRegularLastTwo,
        isLastMergeableTiles,
        isWildLastTileMerge,
        isWildMagnetLastTwo
      });
      isLastMerge = false;
    }
    // 🔥 BUG FIX: 2 unlocked tiles + locked ice still on board ≠ true last merge (spawn must run or soft-lock)
    if (isLastMerge && boardHasPersistentLockedTiles(tiles)) {
      devWarn('⚠️ LAST MERGE OVERRIDE: persistent locked tiles on board — forcing NOT last merge', {
        visibleTilesCount,
        isRegularRegularLastTwoMerge6,
        isAnyWildLastTwo,
      });
      isLastMerge = false;
      (dst as any)._isWildMagnetLastTwo = false;
    }
    
    if (isLastMerge) {
      const mergeType = isRegularRegularLastTwoMerge6 ? 'Regular + regular' : 
                       (isAnyWildLastTwo ? 'Any wild + regular' : 
                       (isWildMagnetLastTwo ? 'Wild magnet + regular' : 'Wild + regular'));
      devLog(`🚨🚨🚨 LAST MERGE DETECTED (BEFORE merge 6 animation) - ${mergeType} → merge 6, only 2 tiles`);
      devLog('🚨🚨🚨 Detected by:', {
        isRegularRegularLastTwoMerge6,
        isAnyWildLastTwo,
        isWildRegularLastTwo,
        isLastMergeableTiles,
        isWildLastTileMerge,
        isWildMagnetLastTwo,
        srcIsWild,
        dstIsWild,
        srcSpecial,
        dstSpecial
      });
      devLog('🚨🚨🚨 Last merge details:', {
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
      devLog('✅✅✅ _isLastMerge flag SET to TRUE on dst tile (merge-6 block):', {
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
      
      // 🔥 BOARD RECOVERY: Persist intent so we can recover if app is force-quit during animation
      // This flag will trigger clean board on next load if flow doesn't complete
      try {
        setPendingCleanBoard(boardNumber);
      } catch (e) {
        devWarn('⚠️ Failed to set pending clean board flag:', e);
      }
      
      // 🔥 CRITICAL FIX: Reset wild meter IMMEDIATELY when last merge is detected in merge-6 block
      // This prevents wild spawn from happening after last merge (double protection)
      // Wild meter may have been filled by addWildProgress before last merge was detected
      devLog('🚨🚨🚨 LAST MERGE (merge-6 block): Resetting wild meter to prevent wild spawn');
      wildMeter = 0;
      STATE.wildMeter = 0;
      try {
        if (typeof HUD.resetWildMeter === 'function') {
          HUD.resetWildMeter(true);
          devLog('✅ LAST MERGE: Wild meter reset in HUD');
        }
      } catch (error) {
        devWarn('⚠️ LAST MERGE: Failed to reset wild meter in HUD:', error);
      }
      
      // 🔥 CRITICAL FIX v40.5: Mark if this was a wild merge OR magnet merge (for spawn skip logic)
      // This includes: wild + regular, regular + wild, magnet + regular, regular + magnet, wild-juice + regular, regular + wild-juice
      const wasWildMerge = srcSpecial === 'wild' || dstSpecial === 'wild';
      const wasWildJuiceMerge = srcSpecial === 'wild-juice' || dstSpecial === 'wild-juice';
      const wasMagnetMerge = srcSpecial === 'wild-magnet' || dstSpecial === 'wild-magnet';
      if (wasWildMerge || wasMagnetMerge || wasWildJuiceMerge) {
        (dst as any)._wasWildMerge = true;
        devLog('✅ _wasWildMerge flag set to TRUE (wild/magnet/wild-juice merge detected)', {
          wasWildMerge,
          wasWildJuiceMerge,
          wasMagnetMerge,
          srcSpecial,
          dstSpecial
        });
      }
      
      devLog('✅ _isLastMerge flag set to TRUE on dst tile');
    } else {
      devLog('❌ NOT last merge:', {
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
        trackAppTimeout(() => {
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
      trackAppAnimationFrame(() => {
        trackAppAnimationFrame(() => {
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
    // 🔥 BUG FIX: Wild star/juice should ALWAYS be mult=2, regardless of stackDepth
    // Wild-magnet uses mult=2 initially (updated later based on pulled tiles, max 4)
    // Regular merge 6 uses combinedCount (stackDepth sum) for multiplier
    const isWildStarOrJuice = srcSpecial === 'wild' || dstSpecial === 'wild' || 
                             srcSpecial === 'wild-juice' || dstSpecial === 'wild-juice';
    // Calculate multiplier: wild-magnet or wild star/juice = 2, regular merge 6 = combinedCount (no cap: 2→2x, 3→3x, 4→4x, 5→5x, …)
    let mult = (isWildMagnet || isWildStarOrJuice) ? 2 : combinedCount;
    
    // Store isWildMagnet for use in onComplete callback
    const wasWildMagnet = isWildMagnet;
    if (dst && !dst.destroyed) {
      // Mark that this merge-6 originated from a wild magnet so lingering tiles can be scrubbed safely later
      (dst as any)._wasWildMagnetMerge6 = wasWildMagnet;
    }
    // SAFETY: prepare cleanup reference for magnet pulls (assigned inside block)
    let cleanupAllPullAnimations: () => void = () => {};

    // 🔥 END GAME FIX: Check if this is the LAST MOVE (only 2 tiles: magnet + 1 tile)
    // If so, this is merge-6 WITHOUT spawn, WITHOUT pull - automatic clean board!
    // 🎯 CRITICAL: Must count TOTAL tiles including stackDepth (not just physical tiles!)
    const activeTilesBeforeMergeMagnet = STATE.tiles.filter((t: any) => 
      t && !t.destroyed && !t.locked && ((t.value | 0) > 0 || t.special === 'wild' || t.special === 'wild-magnet' || t.special === 'wild-juice' || t.special === 'wild-tnt')
    );
    
    // 🎯 CRITICAL FIX: Count TOTAL tiles including stackDepth!
    // Example: magnet (depth 1) + stack(value 3, depth 2) = 2 physical tiles BUT 3 total tiles!
    // We need EXACTLY 2 TOTAL tiles (not physical) for last move scenario
    const totalTilesIncludingDepth = activeTilesBeforeMergeMagnet.reduce((sum, t) => {
      const depth = t.stackDepth || 1;
      return sum + depth;
    }, 0);
    
    const isLastMoveScenario =
      totalTilesIncludingDepth === 2 && isWildMagnet && !boardHasPersistentLockedTiles(tiles);
    
    // 🔥 DEBUG: Log detailed info for troubleshooting
    if (isWildMagnet) {
      devLog('🧲🧲🧲 MAGNET MERGE DEBUG:', {
        physicalTiles: activeTilesBeforeMergeMagnet.length,
        totalTilesIncludingDepth,
        isLastMoveScenario,
        srcValue: src.value,
        srcSpecial: srcSpecial,
        srcDepth: src.stackDepth || 1,
        dstValue: dst.value,
        dstSpecial: dstSpecial,
        dstDepth: dst.stackDepth || 1,
        tilesDetails: activeTilesBeforeMergeMagnet.map((t: any) => ({
          value: t.value,
          special: t.special,
          depth: t.stackDepth || 1,
          locked: t.locked
        }))
      });
    }
    
    if (isLastMoveScenario) {
      devLog('🎯🎯🎯 END GAME: Last 2 tiles (magnet + tile) = MERGE-6 without spawn!');
      devLog('🎯 Marking as last merge - no pull, no spawn, direct to clean board');
      
      // Mark this as last merge (skip all spawns, go to clean board)
      if (dst && !dst.destroyed) {
        (dst as any)._isLastMerge = true;
        (dst as any)._skipMagnetPull = true; // Skip magnet pull animation
        (dst as any)._noTilesPulled = true; // Mark explicitly that no tiles were pulled
        (dst as any)._hasTilesToPull = false; // CRITICAL: Override hasTilesToPull for safety
        devLog('✅ Last merge flag set on dst tile - pull animation will be skipped');
        
        // 🔥 BOARD RECOVERY: Persist intent so we can recover if app is force-quit during animation
        try {
          setPendingCleanBoard(boardNumber);
          devLog('✅ RECOVERY: pendingCleanBoard flag set (magnet last move scenario)');
        } catch (e) {
          devWarn('⚠️ Failed to set pending clean board flag (magnet):', e);
        }
      }
      
      // 🎯 CRITICAL: Set multiplier to 0 (NO spawns for last merge - clean board!)
      mult = 0;
      devLog('🎯 Set mult = 0 to prevent ANY spawns (clean board scenario)');
    }
    
    // 🧲 WILD-MAGNET: Find and pull up to 4 nearest tiles IMMEDIATELY when merge 6 starts
    // This happens BEFORE the merge animation completes
    // Works for BOTH: magnet on tile AND tile on magnet
    // 🔥 CRITICAL: Only pull if hasTilesToPull is true (magnet behaves like wild if false)
    // 🔥 CRITICAL FIX: If hasTilesToPull is false, magnet behaves like wild - merge 6 tile should be removed normally
    if (isWildMagnet && !hasTilesToPull && dst && !dst.destroyed) {
      // Magnet behaves like wild - merge 6 tile should be removed normally (like regular merge 6)
      // This will be handled in onComplete callback - no special flag needed
      devLog('🧲 Magnet behaves like wild (hasTilesToPull=false) - merge 6 tile will be removed normally in onComplete callback');
    }
    
    // 🔥 END GAME FIX: Skip pull animation if this is last move scenario
    if (isWildMagnet && hasTilesToPull && dst && !dst.destroyed && !dst.locked && (dst.value | 0) > 0 && !isLastMoveScenario) {
      // 🔥 CRITICAL: Declare mergeStarted at outer scope so trackAppTimeout callback always has access
      let mergeStarted = false;
      // 🔥 CRITICAL FIX: Reset flag if previous pull completed but flag wasn't reset
      // This fixes the bug where newly spawned magnet can't pull because flag is still true
      // Check if there are any active pull animations - if not, reset flag
      const hasActivePullAnimations = STATE.tiles.some((t: any) => t && !t.destroyed && t._wildMagnetAffected === true);
      if (wildMagnetPullInProgress && !hasActivePullAnimations) {
        devLog('🧲 Resetting wildMagnetPullInProgress flag - no active pull animations found');
        wildMagnetPullInProgress = false;
      }
      
      // 🔥 CRITICAL: Prevent overlapping wild-magnet pull animations
      if (wildMagnetPullInProgress) {
        devWarn('⚠️ Wild-magnet pull already in progress, skipping new pull animation');
        // Set mult to 1 for regular merge 6 scoring
        mult = 1;
      } else {
        wildMagnetPullInProgress = true;
      devLog('🧲 WILD-MAGNET: Merge 6 starting, finding up to 4 nearest tiles to pull IMMEDIATELY');
      
      // Find up to 4 nearest tiles to the merge location (use dst position BEFORE merge animation)
      const mergeX = dst.x;
      const mergeY = dst.y;
      
      // 🔥 CRITICAL FIX v37: Detailed logging to debug why tiles might not be found
      // Use saved srcSpecial and dstSpecial for accurate logging (dst.special was cleared on line 3561)
      devLog('🔍 MAGNET PULL DEBUG: Checking all tiles on board:', {
        totalTilesInState: STATE.tiles.length,
        srcTile: { value: src.value, special: srcSpecial, locked: src.locked },
        dstTile: { value: dst.value, special: dstSpecial, locked: dst.locked }
      });
      
      const allTiles = STATE.tiles.filter((tile: any) => {
        if (!tile || tile.destroyed) {
          if (tile) devLog('🔍 FILTER OUT: destroyed tile');
          return false;
        }
        if (tile === dst) {
          devLog('🔍 FILTER OUT: dst tile (merge 6 itself)');
          return false;
        }
        if (tile === src) {
          devLog('🔍 FILTER OUT: src tile (magnet itself)');
          return false;
        }
        if (tile.locked) {
          devLog('🔍 FILTER OUT: locked tile', { value: tile.value, special: tile.special });
          return false;
        }
        
        // 🔥 CRITICAL FIX: Exclude tiles that are currently being pulled by another magnet
        // If a tile is already marked as _wildMagnetAffected, it's being pulled by another magnet
        // and should NOT be pulled again
        if (tile._wildMagnetAffected) {
          devLog('🔍 FILTER OUT: tile already being pulled by another magnet', { value: tile.value, special: tile.special });
          return false;
        }
        
        // 🔥 CRITICAL FIX v37: Check if tile is wild or magnet BEFORE checking value
        // Wild-magnet and wild tiles have value = 0, but they should STILL be pulled!
        const isWildOrMagnet = tile.special === 'wild' || tile.special === 'wild-magnet' || tile.special === 'wild-juice' || tile.special === 'wild-tnt';
        
        if (!isWildOrMagnet && (tile.value | 0) <= 0) {
          devLog('🔍 FILTER OUT: regular tile with value <= 0', { value: tile.value, special: tile.special });
          return false;
        }
        
        // 🔥 CRITICAL: Wild-magnets CAN pull other wild-magnets, wild stars, and ordinary tiles!
        // This is intentional behavior - magnet attracts EVERYTHING
        devLog('✅ INCLUDE: tile for pull', { value: tile.value, special: tile.special, locked: tile.locked, isWildOrMagnet });
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
      
      devLog('🧲 Found', nearestTiles.length, 'nearest tiles to pull immediately (max 4)');
      
      // 🔥 CRITICAL FIX: Check if this is last merge (magnet + 1 tile = 2 tiles total, no tiles to pull)
      // If allTiles.length === 2 (only src and dst) and nearestTiles.length === 0, this is last merge
      const isLastMergeEarly =
        allTiles.length === 2 &&
        nearestTiles.length === 0 &&
        !boardHasPersistentLockedTiles(tiles);
      if (isLastMergeEarly && dst && !dst.destroyed) {
        (dst as any)._isLastMerge = true;
        devLog('🚨🚨🚨 LAST MERGE DETECTED EARLY (magnet + 1 tile, no tiles to pull) - Setting _isLastMerge flag NOW');
        devLog('🎯 This is the final merge - should trigger clean board, NOT pull tiles or spawn anything');
        
        // 🔥 BOARD RECOVERY: Persist intent so we can recover if app is force-quit during animation
        try {
          setPendingCleanBoard(boardNumber);
          devLog('✅ RECOVERY: pendingCleanBoard flag set (magnet early detection)');
        } catch (e) {
          devWarn('⚠️ Failed to set pending clean board flag (magnet early):', e);
        }
      }
      
        // 🔥 CRITICAL FIX: Store whether tiles will be pulled on dst tile BEFORE onComplete callback
        // This allows onComplete to correctly determine if merge 6 tile should remain or be removed
        if (dst && !dst.destroyed) {
          (dst as any)._willPullTiles = nearestTiles.length > 0;
          (dst as any)._noTilesPulled = nearestTiles.length === 0; // default assumption if none are valid later
          devLog('🧲 Stored _willPullTiles flag on dst:', nearestTiles.length > 0, '(nearestTiles.length:', nearestTiles.length, ')');
        }
      
      // 🔥 CRITICAL FIX v37: Log if no tiles can be pulled AND reset wildMagnetPullInProgress
      // Without this reset, subsequent pulls would be blocked!
      if (nearestTiles.length === 0) {
        devWarn('⚠️ WILD-MAGNET: No tiles can be pulled (all nearby tiles are locked or invalid)');
        
        // 🔥 CRITICAL: Reset wildMagnetPullInProgress if no tiles to pull
        // Otherwise, subsequent magnet merges will be blocked!
        wildMagnetPullInProgress = false;
        devLog('✅ wildMagnetPullInProgress reset to false (no tiles to pull)');
        
        // 🔥 POJEDNOSTAVLJENO: Flag više nije potreban - logika u onComplete callback-u provjerava isMagnetPullMergeFinal
        // Ako isMagnetPullMergeFinal === false, merge 6 tile će biti obrisan
      }
      
      // Update multiplier based on number of pulled tiles (max 4x)
      // 🎯 CRITICAL: Do NOT override mult if this is last move scenario (mult = 0 for clean board)
      if (nearestTiles.length > 0 && !isLastMoveScenario) {
        mult = Math.min(4, nearestTiles.length + 1); // +1 for the main merge, max 4x
        devLog('🧲 Updated multiplier to', mult, 'x (based on', nearestTiles.length, 'pulled tiles)');
      } else if (isLastMoveScenario) {
        devLog('🎯 KEEPING mult = 0 (last move scenario - clean board, NO spawn override!)');
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
          
          devLog('🛡️ Protected pulled tile:', tile.value, 'special:', tile.special, 'eventMode:', tile.eventMode, 'locked:', tile.locked);
          
          // Clear from grid immediately (they're being pulled)
          if (tile.gridX !== undefined && tile.gridY !== undefined && grid && grid[tile.gridY]) {
            grid[tile.gridY][tile.gridX] = null;
          }
          
          // 🔥 CRITICAL: Ensure tiles remain in tiles array (don't remove them yet!)
          // They will be removed when merge completes
          if (!tiles.includes(tile)) {
            devWarn('⚠️ Pulled tile not in tiles array, adding it back');
            tiles.push(tile);
            // Clear end game cache when tile is added
            clearEndGameCache();
          }
          if (!STATE.tiles.includes(tile)) {
            devWarn('⚠️ Pulled tile not in STATE.tiles array, adding it back');
            STATE.tiles.push(tile);
          }
          
          devLog('🧲 Marked tile as magnet-affected:', tile.value, 'special:', tile.special, 'in tiles:', tiles.includes(tile), 'in STATE.tiles:', STATE.tiles.includes(tile));
        });
        
        // Track how many tiles have arrived
        let arrivedCount = 0;
        const totalTiles = nearestTiles.length;
        let allTilesArrived = false;
        let multiplierShown = false;
        mergeStarted = false; // 🔥 CRITICAL: Reset for this pull (declared at outer scope)
        
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
          
          devLog('🧹 Cleaning up pulled tile - resetting to original state');
          
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
              devLog('✅ Drag handler re-bound to cleaned tile');
            } catch (error) {
              devWarn('⚠️ Failed to rebind drag handler:', error);
            }
          }
          
          // Re-add to grid if it has grid coordinates
          if (tile.gridX !== undefined && tile.gridY !== undefined && grid && grid[tile.gridY]) {
            grid[tile.gridY][tile.gridX] = tile;
            devLog('✅ Tile re-added to grid at (', tile.gridX, ',', tile.gridY, ')');
          }
          
          // 🔥 CRITICAL: Force scale to exactly 1.0 (ensure no floating-point drift)
          if (tile.scale) {
            tile.scale.set(origScaleX, origScaleY);
            devLog('✅ Tile scale reset to (', origScaleX, ',', origScaleY, ')');
          }
          
          devLog('✅ Tile cleanup complete - tile restored to original state');
        };
        
        // 🔥 CRITICAL: Cleanup ALL timelines and pulled tiles (MEMORY LEAK FIX)
        // Use const binding to avoid block-function scoping quirks (keeps reference for timeouts)
        cleanupAllPullAnimations = () => {
          devLog('🧹 Cleaning up all wild-magnet pull animations - killing', activeTimelines.length, 'timelines');
          
          // Kill all active timelines
          activeTimelines.forEach((tl, idx) => {
            try {
              if (tl && !tl.killed) {
                tl.kill();
                devLog(`✅ Killed timeline ${idx + 1}/${activeTimelines.length}`);
              }
            } catch (error) {
              devWarn(`⚠️ Failed to kill timeline ${idx + 1}:`, error);
            }
          });
          
          // Clear array
          activeTimelines.length = 0;
          devLog('✅ All wild-magnet pull timelines cleaned up');
          
          // 🔥 CRITICAL: Reset wildMagnetPullInProgress when cleanup is called (FAST DRAG BUG FIX)
          // This ensures that a new pull can start even if the previous one was interrupted
          if (wildMagnetPullInProgress) {
            wildMagnetPullInProgress = false;
            devLog('✅ wildMagnetPullInProgress reset to false after cleanup');
          }
          try { (window as any).__ccActiveMagnetPullCleanup = null; } catch {}
        };
        try { (window as any).__ccActiveMagnetPullCleanup = cleanupAllPullAnimations; } catch {}
        
        // Function to merge pulled tiles when both conditions are met
        const tryMergePulledTiles = async () => {
          if (allTilesArrived && multiplierShown) {
            devLog('🧲 Both conditions met: all tiles arrived AND multiplier shown, starting merge');
            
            // 🔥 CRITICAL: Mark merge as started (prevent cleanup after this point)
            mergeStarted = true;
            devLog('✅ mergeStarted flag set to true - cleanup will be skipped if animation is interrupted');
            
            try {
              // Import handleWildMagnetMergedPulledTiles asynchronously
              const { handleWildMagnetMergedPulledTiles } = await import('./app-merge');
              
              // Check if dst is still valid before merging
              // NOTE: For pulled tiles merge, dst might be removed already (merge 6 tile), so we check differently
              const validTiles = nearestTiles.filter((t: any) => t && !t.destroyed);
              
              devLog('🧲 Wild-magnet pulled tiles validation:', {
                totalPulled: nearestTiles.length,
                validTiles: validTiles.length,
                pulledTileTypes: nearestTiles.map((t: any) => ({
                  value: t?.value,
                  special: t?.special,
                  destroyed: t?.destroyed,
                  locked: t?.locked
                }))
              });
              
              // 🔥 CRITICAL FIX: Check _isLastMerge flag FIRST - if set, this is final merge-6, NO spawns!
              const isLastMergeFlagSet = (dst as any)?._isLastMerge === true;
              if (isLastMergeFlagSet) {
                devLog('🚨🚨🚨 SOURCE OF TRUTH: Final merge-6 detected (_isLastMerge flag set) - magnet + 1 tile = 2 tiles total');
                devLog('🎯 This is the final merge - should trigger clean board, NOT pull tiles or spawn anything');
                devLog('🧲 Skipping handleWildMagnetMergedPulledTiles - clean board will be triggered in mergePulledTilesIntoMerge6');
                
                // Still call handleWildMagnetMergedPulledTiles with empty array - it will check _isLastMerge and trigger clean board
                // This ensures clean board flow is triggered properly
                const { handleWildMagnetMergedPulledTiles } = await import('./app-merge');
                const helpersWithMerge = {
                  ...helpers,
                  merge: merge,
                  startLevel: startLevel,
                  makeBoard,
                };
                await handleWildMagnetMergedPulledTiles(dst, [], helpersWithMerge);
                devLog('✅ Clean board triggered for final magnet merge-6');
                return; // Exit early - no further processing needed
              }
              
              // 🔥 CRITICAL FIX: If validTiles.length === 0, mark that NO tiles were actually pulled
              // This overrides _willPullTiles flag and ensures merge 6 tile is removed
              if (validTiles.length === 0 && dst && !dst.destroyed) {
                (dst as any)._willPullTiles = false; // Override: no tiles were actually pulled
                (dst as any)._noTilesPulled = true; // Mark explicitly that no tiles were pulled
                devLog('🧲🧲🧲 CRITICAL: nearestTiles.length > 0 but validTiles.length === 0 - marking as NO pull');
              } else if (validTiles.length > 0 && dst && !dst.destroyed) {
                // At least one tile will merge: clear no-pull flag and mark intent
                (dst as any)._noTilesPulled = false;
                (dst as any)._willPullTiles = true;
              }
              
              if (validTiles.length >= 1) { // Changed: need at least 1 tile (can be less than 4)
                // 🔥 CRITICAL: Mark that pulled tiles merge is happening - skip normal spawn AND scoring
                // Set flag on dst BEFORE calling handleWildMagnetMergedPulledTiles
                // This ensures the flag is checked in onComplete callback
                if (dst && !dst.destroyed) {
                  (dst as any)._wildMagnetPulledTilesMerge = true;
                  (dst as any)._wildMagnetPulledTilesScoring = true; // Flag to skip scoring in main merge 6 flow
                }
                
                // 🔥 CRITICAL: Add merge function and makeBoard to helpers so handleWildMagnetMergedPulledTiles can use them
                // 🔥 USER REQUEST: Add spawnLockedTilesWithPop + openLockedBounceParallel so wild magnet gets 6 locked like wild juice/star/TNT
                const helpersWithMerge = {
                  ...helpers,
                  merge: merge, // Add merge function from app-core.ts to helpers
                  startLevel: startLevel, // Add startLevel function to helpers for clean board flow
                  makeBoard, // For fillNullCellsWithLockedPlaceholders (avoids TDZ in app-merge)
                  spawnLockedTilesWithPop: (count: number, exclude?: Array<{ c: number; r: number }>) => spawnLockedTilesWithPop(count, exclude),
                  openLockedBounceParallel: FLOW.openLockedBounceParallel,
                  gsap,
                  drawBoardBG,
                  TILE,
                  fixHoverAnchor,
                  SPAWN,
                };
                
                // Use dst if still valid, otherwise use merge location from first tile (with gridX/gridY for mergePulledTilesIntoMerge6)
                const mergeLocation = dst && !dst.destroyed ? dst : {
                  x: validTiles[0].x, y: validTiles[0].y,
                  gridX: validTiles[0].gridX, gridY: validTiles[0].gridY
                };
                
                // 🔥 USER REQUEST: Add wild progress IMMEDIATELY when magnet pull starts (before merge animation)
                // This makes wild meter progress bar animate during pull animation, not after
                // 🔥 CRITICAL FIX: Check if this is last merge (only 2 tiles on board) BEFORE adding wild progress
                // This prevents wild meter from filling when magnet pull results in clean board
                const activeTilesBeforePull = tiles.filter(t => {
                  if (!t || t.locked) return false;
                  const isWild = t.special === 'wild' || t.special === 'wild-magnet' || t.special === 'wild-juice' || t.special === 'wild-tnt';
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
                  devLog(`🧲 Magnet pulling ${validTiles.length} tiles - adding wild progress IMMEDIATELY (treating as merge 6, NOT last merge)`);
                  addWildProgress(WILD_INC_BIG); // Same as regular merge 6 - animates during pull
                } else if (isLastMergeBeforePull) {
                  devLog(`🚨🚨🚨 LAST MERGE DETECTED (magnet pull) - ${visibleTilesCountBeforePull} tiles before pull, skipping wild progress`);
                  // Reset wild meter to prevent wild spawn before clean board
                  wildMeter = 0;
                  STATE.wildMeter = 0;
                  try {
                    if (typeof HUD.resetWildMeter === 'function') {
                      HUD.resetWildMeter(true);
                      devLog('✅ LAST MERGE (magnet pull): Wild meter reset in HUD');
                    }
                  } catch (error) {
                    devWarn('⚠️ LAST MERGE (magnet pull): Failed to reset wild meter in HUD:', error);
                  }
                }
                
                devLog('🧲 Calling handleWildMagnetMergedPulledTiles with', validTiles.length, 'valid tiles');
                await handleWildMagnetMergedPulledTiles(mergeLocation, validTiles, helpersWithMerge);
                devLog('✅ Pulled tiles merge completed - merge 6 created with 4x multiplier');
                
                // 🔥 CRITICAL: Cleanup all timelines after successful merge (MEMORY LEAK FIX)
                cleanupAllPullAnimations();
                
                // 🔥 CRITICAL: Reset wildMagnetPullInProgress after successful merge
                wildMagnetPullInProgress = false;
                devLog('✅ Wild-magnet pull animation guard reset (merge completed)');
                
                // 🔥 CRITICAL: DON'T clean up flags immediately - they need to stay until onComplete callback checks them
                // The flags will be cleaned up in the onComplete callback after spawn completes
                // (mergeLocation as any)._wildMagnetPulledTilesMerge = undefined;
                // (mergeLocation as any)._wildMagnetPulledTilesScoring = undefined;
              } else {
                devWarn('⚠️ Not enough valid pulled tiles to merge (need at least 1, got', validTiles.length, ')');
                // Cleanup all timelines (MEMORY LEAK FIX)
                cleanupAllPullAnimations();
                
                // 🔥 POJEDNOSTAVLJENO: Flag više nije potreban - logika u onComplete callback-u provjerava isMagnetPullMergeFinal
                // Ako isMagnetPullMergeFinal === false, merge 6 tile će biti obrisan
                
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
              devError('❌ Error merging pulled tiles:', err);
              devError('❌ Error stack:', err instanceof Error ? err.stack : 'No stack trace');
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
          const tl = animationManager.trackExternalTimeline(gsap.timeline({
            delay: Math.max(0, initialDelay + sequentialDelay), // Ensure delay is never negative
            onInterrupt: () => {
              // 🔥 CRITICAL: Don't cleanup if merge has already started
              if (mergeStarted) {
                devLog('⏳ Wild-magnet pull animation interrupted but merge already started - skipping cleanup for tile:', index);
                return;
              }
              // 🔥 CRITICAL: Cleanup on animation interrupt (e.g., user drags tile)
              devWarn('⚠️ Wild-magnet pull animation interrupted for tile:', index);
              cleanupPulledTile(tile, startX, startY, startRotation, originalScaleX, originalScaleY);
            },
            onComplete: () => {
              // 🔥 CRITICAL: Mark timeline as killed when complete (MEMORY LEAK FIX)
              (tl as any).killed = true;
              devLog(`✅ Timeline ${index + 1}/${totalTiles} completed and marked as killed`);
            },
            onUpdate: async () => {
              // 🔥 CRITICAL: Don't cleanup if merge has already started
              if (mergeStarted) {
                // Merge has started, let it complete - don't interrupt
                return;
              }
              
              // 🔥 CRITICAL: Safety check - tile must exist and not be destroyed
              if (!tile || tile.destroyed) {
                devWarn('⚠️ Tile destroyed during animation, cleaning up and killing timeline');
                cleanupPulledTile(tile, startX, startY, startRotation, originalScaleX, originalScaleY);
                try { tl.kill(); } catch {}
                return;
              }
              
              // 🔥 CRITICAL: Safety check - tile must have valid position properties
              if (tile.x == null || tile.y == null || typeof tile.x !== 'number' || typeof tile.y !== 'number' || !Number.isFinite(tile.x) || !Number.isFinite(tile.y)) {
                devWarn('⚠️ Tile position invalid during animation, cleaning up and killing timeline');
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
                  devWarn('⚠️ Tile destroyed just before merge trigger, skipping');
                  try { tl.kill(); } catch {}
                  return;
                }
                
                tile._mergeTriggered75 = true;
                arrivedCount++;
                devLog(`🧲 Tile ${index + 1}/${totalTiles} reached 75% - triggering merge immediately`);
                
                // When all tiles reach 75%, trigger merge IMMEDIATELY
                if (arrivedCount === totalTiles) {
                  devLog('🧲 All tiles reached 75%, triggering merge 6 IMMEDIATELY (no final alignment)');
                  allTilesArrived = true;
                  multiplierShown = true; // Mark multiplier as shown to trigger merge immediately
                  
                  // Try to merge immediately (will merge right away)
                  // Shards animation will be triggered in mergePulledTilesIntoMerge6
                  // 🔥 CRITICAL FIX: Wrap in try-catch to prevent unhandled promise rejection
                  try {
                    await tryMergePulledTiles();
                  } catch (error) {
                    devError('❌ Error in tryMergePulledTiles:', error);
                  }
                }
              }
            }
          }));
          
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
          devLog(`✅ Timeline ${index + 1}/${totalTiles} created and stored for cleanup`);
        });
        
        // Store callback to trigger merge when multiplier appears
        // This will be called from the onComplete callback after showMultiplierTile
        (dst as any)._wildMagnetMergeCallback = async () => {
          devLog('🧲 Multiplier appeared, checking if can merge pulled tiles');
          multiplierShown = true;
          // Try to merge (will only merge if all tiles have arrived)
          // 🔥 CRITICAL FIX: Wrap in try-catch to prevent unhandled promise rejection
          try {
            await tryMergePulledTiles();
          } catch (error) {
            devError('❌ Error in tryMergePulledTiles (from multiplier callback):', error);
            // Cleanup all timelines (MEMORY LEAK FIX)
            cleanupAllPullAnimations();
            // Reset guard on error
            wildMagnetPullInProgress = false;
          }
        };
      }
        
        // 🔥 CRITICAL: Reset wildMagnetPullInProgress after animation completes or fails
        // Use a timeout to ensure it's reset even if merge fails or animation is interrupted
        trackAppTimeout(() => {
          if (wildMagnetPullInProgress) {
            devWarn('⚠️ Wild-magnet pull animation timeout - cleaning up after 2s');
            
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
                devLog('✅ Timeout fallback: Cleaned tile with scale reset to 1.0');
              }
            });
            
            wildMagnetPullInProgress = false;
            devLog('✅ Wild-magnet pull animation guard reset (timeout fallback with cleanup)');
          }
        }, 2000); // 2 second timeout (animation should complete in ~1s)
      }
    }

    // 🔥 CRITICAL: Check if this is a last merge BEFORE starting animation
    // If _isLastMerge is set, we need to skip spawn logic but ALLOW animations and clean board flow
    const isLastMergeScenario = (dst as any)?._isLastMerge === true;
    
    if (isLastMergeScenario) {
      devLog('🚨🚨🚨 LAST MERGE DETECTED (before animation) - Will play animations, skip spawn, and trigger clean board flow');
      devLog('🚨🚨🚨 Last merge details:', {
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

    trackTween(src, {
      x: dst.x, y: dst.y, duration: 0.08, ease: 'power2.out',
      onComplete: async () => {
        // 🔥 CRITICAL: If dst was destroyed (e.g. by parallel mergePulledTilesIntoMerge6/checkLevelEnd),
        // bail early to prevent "Cannot read properties of null (reading 'x')" - destroyed Pixi objects throw on property access
        if (!dst || dst.destroyed) {
          try { removeTile(src); } catch {}
          return;
        }
        // 🔥 CRITICAL: srcSpecial i dstSpecial su već snimljeni PRIJE setValue i clearWildState!
        // Koristimo ih iz closure-a, ne snimamo ih ponovo (jer bi mogli biti već promijenjeni)
        
        // 🔥 CRITICAL FIX: Store magnet pull merge flag EARLY, before any code clears it
        // This ensures we can correctly identify magnet pull merges even if flags are cleared later
        // Check _willPullTiles first (set BEFORE onComplete) OR _wildMagnetPulledTilesMerge (set AFTER callback executes)
        // Do NOT check _wildMagnetMergeCallback - it exists even when no tiles are pulled!
        // 🔥 CRITICAL: If _noTilesPulled is set, override _willPullTiles (tiles became invalid before merging)
        const willPullTilesFlag = (dst as any)?._noTilesPulled === true ? false : (dst as any)?._willPullTiles === true;
        const isMagnetPullMergeStored = willPullTilesFlag || (dst as any)?._wildMagnetPulledTilesMerge === true;
        
        // 🔥 CRITICAL: Use EARLY saved star data (saved before any transformations)
        // This ensures data is available even if dst tile became merge 6 and lost _wildStarSystem
        const savedStarPositions = savedStarPositionsEarly.length > 0 ? savedStarPositionsEarly : [];
        const savedWildTileScreenPos = savedWildTileScreenPosEarly;
        
        // Get merge 6 position for reference (convert to screen coordinates)
        const merge6Pos = getMerge6ScreenPos(dst);
        
        // Get HUD star icon position
        let hudStarPos = null;
        if (shouldAnimateStarsToHUD) {
          try {
            if (typeof HUD.getStarHudPosition === 'function') {
              hudStarPos = HUD.getStarHudPosition();
              devLog('⭐ HUD star position retrieved:', hudStarPos);
            } else {
              devWarn('⚠️ HUD.getStarHudPosition is not a function');
            }
          } catch (err) {
            devError('❌ Error getting HUD star position:', err);
          }
        }

        removeTile(src);
        
        // 🔥 STARS ANIMATION: Trigger animation with EARLY saved star data (after tile is removed)
        // 🔥 CRITICAL: Always trigger animation if shouldAnimateStarsToHUD is true, even if bubbles animation is running
          const isWildJuiceMerge = srcSpecial === 'wild-juice' || dstSpecial === 'wild-juice';
          if (shouldAnimateStarsToHUD && !starsToHudTriggered) {
            if (savedStarPositions.length > 0 && hudStarPos) {
            devLog('⭐ Starting stars animation to HUD with saved data:', { 
              starCount: savedStarPositions.length,
              merge6Pos,
              hudStarPos,
              hasBubblesRunning: isWildJuiceBubblesExplosionActive?.() || false
            });
            
            starsToHudTriggered = true;
            (async () => {
              try {
                if (!isWildJuiceMerge) showSparkleText();
                devLog('⭐ Calling animateStarsToHudIcon with saved star data (INSTANT):', { 
                  board: !!board, 
                  stage: !!stage,
                  savedStarCount: savedStarPositions.length,
                  merge6Pos,
                  hudStarPos
                });
                await animateStarsToHudIcon(board, stage, savedStarPositions, savedWildTileScreenPos, merge6Pos, hudStarPos, app);
                devLog('✅ Stars animation to HUD completed (INSTANT)');
              } catch (error) {
                starsToHudTriggered = false;
                devError('❌ Failed to animate stars to HUD:', error);
              }
            })();
          } else {
            devWarn('⭐ Stars animation skipped - missing data:', { 
              shouldAnimate: shouldAnimateStarsToHUD,
              savedStarCount: savedStarPositions?.length || 0,
              hasHudPos: !!hudStarPos,
              hasEarlySavedData: savedStarPositionsEarly.length > 0,
              hasBubblesRunning: isWildJuiceBubblesExplosionActive?.() || false
            });
          }
        }
        
        // 🔥 CRITICAL: Check if this was marked as last merge BEFORE animation started
        // 🔥 ENHANCED: Double-check _isLastMerge flag and verify dst still exists
        const isLastMergeInOnComplete = (dst as any)?._isLastMerge === true;
        const dstStillExists = dst && !dst.destroyed && STATE.tiles.includes(dst);
        
        // 🔥 USER REQUEST: Check if this was last 2 tiles AFTER removing src
        // This is the CORRECT time to check - after src is removed, if only merge-6 remains, it was last 2 tiles
        const activeTilesAfterSrcRemoval = getReactiveActiveTiles(tiles);
        const onlyMerge6Remains = activeTilesAfterSrcRemoval.length === 1 && 
                                  activeTilesAfterSrcRemoval[0] === dst && 
                                  dst.value === 6;
        // 🔥 CRITICAL: Use srcSpecial and dstSpecial from closure (snimljeni PRIJE merge-6 bloka)
        // Note: These are from outer scope (line 3943-3944), not from merge 6 block
        const srcWasWild = srcSpecial && srcSpecial.startsWith('wild');
        const dstWasRegular = !dstSpecial && (dst.value|0) > 0;
        const wasWildRegularLastTwo = srcWasWild && dstWasRegular && onlyMerge6Remains;
        const wasRegularRegularLastTwo = !srcWasWild && !dstSpecial && 
                                         (src.value|0) > 0 && (dst.value|0) > 0 &&
                                         onlyMerge6Remains;
        
        // 🔥 CRITICAL FIX: Also check if src was magnet and dst was regular (magnet + 1 tile = last merge)
        // Note: Use srcSpecial/dstSpecial from outer scope (line 3943-3944), not srcSpecialMerge6/dstSpecialMerge6
        const wasMagnetRegularLastTwo = (srcSpecial === 'wild-magnet' || dstSpecial === 'wild-magnet') && 
                                        onlyMerge6Remains;
        
        // 🔥 CRITICAL: If this was last 2 tiles (wild + regular OR regular + regular OR magnet + regular), set flag NOW
        if ((wasWildRegularLastTwo || wasRegularRegularLastTwo || wasMagnetRegularLastTwo) && !isLastMergeInOnComplete) {
          (dst as any)._isLastMerge = true;
          devLog('🚨🚨🚨 LAST MERGE DETECTED (AFTER src removal) - Only merge-6 remains:', {
            wasWildRegularLastTwo,
            wasRegularRegularLastTwo,
            wasMagnetRegularLastTwo,
            srcSpecial: srcSpecial,
            dstSpecial: dstSpecial,
            srcValue: src.value,
            dstValue: dst.value,
            activeTilesAfterSrcRemoval: activeTilesAfterSrcRemoval.length
          });
          
          // 🔥 BOARD RECOVERY: Persist intent so we can recover if app is force-quit during animation
          try {
            setPendingCleanBoard(boardNumber);
            devLog('✅ RECOVERY: pendingCleanBoard flag set (after src removal detection)');
          } catch (e) {
            devWarn('⚠️ Failed to set pending clean board flag (after src removal):', e);
          }
        }
        
        logger.debug('🔍 LAST MERGE CHECK in onComplete', 'app-core', {
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
          // 🔥 BUG FIX: Exclude tiles that are being pulled by magnet (have _wildMagnetAffected flag)
          // These tiles are in the process of being removed but haven't been destroyed yet
          // Without this exclusion, they would incorrectly trigger "false positive" detection
          const otherActive = getReactiveActiveTiles(tiles).filter((t) => t !== dst && !(t as any)?._wildMagnetAffected);
          if (otherActive.length === 0 && dstStillExists) {
            devLog('🚨🚨🚨 LAST MERGE DETECTED (_isLastMerge flag) - Only 2 tiles merged to merge 6');
            devLog('💥 LAST MERGE: Letting normal merge 6 flow continue (animations, dst removal, spawn check)');
            devLog('💥 LAST MERGE: Spawn will be skipped by safeguard check (line 3070), then clean board flow will trigger');
            
            // 🔥 CRITICAL: DON'T set busyEnding here - let normal merge 6 flow continue
            // The safeguard check (line 3070) will skip spawn and trigger clean board flow
            // busyEnding = true; // REMOVED - was preventing normal merge 6 flow
            
            // 🔥 CRITICAL: DON'T reset wild meter here - let safeguard check handle it
            // 🔥 CRITICAL: DON'T trigger clean board flow here - let safeguard check handle it
            // Just let the normal merge 6 flow continue (dst removal, spawn check, clean board flow)
            devLog('✅ LAST MERGE: Continuing with normal merge 6 flow (dst removal, spawn check, clean board flow)');
            // No return - continue with normal merge 6 flow
          } else if (otherActive.length > 0) {
            devWarn('⚠️ LAST MERGE: False positive detected - other active tiles remain. Continuing normal flow.', {
              otherActive: otherActive.map(t => ({ value: t.value, special: t.special, locked: t.locked }))
            });
            (dst as any)._isLastMerge = false;
            busyEnding = false;
          } else if (!dstStillExists) {
            devWarn('⚠️ LAST MERGE: _isLastMerge flag set but dst tile no longer exists. Verifying clean board...');
            const boardIsClean = otherActive.length === 0;
            if (boardIsClean) {
              // 🔥 FIX: Use triggerCleanBoardFlow (same entry as other clean board paths) so modal shows consistently
              await triggerCleanBoardFlow('clean_board_from_last_merge_edge_case');
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
        // Note: Use srcSpecial/dstSpecial from outer scope (line 3943-3944), not srcSpecialMerge6/dstSpecialMerge6
        const isWildMagnetMergeWithPull = (srcSpecial === 'wild-magnet' || dstSpecial === 'wild-magnet') && 
                                          (dst as any)?._wildMagnetMergeCallback;
        const isRegularWildMerge = (srcSpecial === 'wild' || dstSpecial === 'wild') && 
                                   !(srcSpecial === 'wild-magnet' || dstSpecial === 'wild-magnet');
        const isNotLastMerge = !(dst as any)?._isLastMerge;
        
        if (isWildMagnetMergeWithPull) {
          devLog('🧲 Wild-magnet merge with pull detected - skipping endgame check until pulled tiles merge completes');
        } else if (isRegularWildMerge && isNotLastMerge) {
          devLog('⭐ Regular wild merge mid-game detected (NOT last merge) - skipping endgame check to prevent false fail screen');
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
            devLog('🚨🚨🚨 LAST MERGE DETECTED (centralized checker) - Only merge 6 remains after removing src');
            devLog('💥 LAST MERGE: This check should not trigger if _isLastMerge flag was set properly');
            devLog('💥 LAST MERGE: Continuing with normal merge 6 flow (dst removal, spawn check, clean board flow)');
            
            // 🔥 CRITICAL: Set _isLastMerge flag if not already set
            if (!(dst as any)?._isLastMerge) {
              (dst as any)._isLastMerge = true;
              devLog('✅ _isLastMerge flag set to TRUE (was missing)');
              
              // 🔥 BOARD RECOVERY: Persist intent so we can recover if app is force-quit during animation
              try {
                setPendingCleanBoard(boardNumber);
                devLog('✅ RECOVERY: pendingCleanBoard flag set (centralized checker)');
              } catch (e) {
                devWarn('⚠️ Failed to set pending clean board flag (centralized):', e);
              }
            }
            
            // Don't set busyEnding or trigger clean board flow here - let normal flow handle it
            // No return - continue with normal merge 6 flow
          }
        }
        
        // 🔥 CRITICAL FIX: DON'T skip animations for last merge!
        // User needs to see merge 6 animations (smoke, shards, explosion) before clean board
        // We'll only skip SPAWN logic, not animations
        if (isLastMergeScenario) {
          devLog('🚨🚨🚨 LAST MERGE: Will play animations but skip spawn - clean board flow will trigger after animations');
        }
        
        // If busyEnding was set by another process, exit early
        if (busyEnding) {
          devLog('⏳ Last merge check skipped - busyEnding is true');
          return;
        }

        // Combo++ + bump (merge 6 hits maximum balloon)
        hudSetCombo(combo + 1);
        try { HUD.bumpCombo?.({ kind: 'merge6', combo }); } catch {}
        
        scheduleComboDecay();

        // 🔥 CRITICAL: Snimiti dst poziciju PRIJE nego što se pozovu shardovi!
        // Nakon removeTile(dst), dst može biti destroyed ili undefined
        // 🔥 CRITICAL FIX: Add null/destroyed check - accessing dst.x on destroyed Pixi object throws
        if (!dst || dst.destroyed) {
          devWarn('⚠️ dst is null or destroyed in merge-6 animation setup - cannot proceed with shards animation');
          return;
        }
        let dstX = 0, dstY = 0, dstGridX = 0, dstGridY = 0, dstZIndex = 0;
        try {
          dstX = (typeof dst.x === 'number' && Number.isFinite(dst.x)) ? dst.x : 0;
          dstY = (typeof dst.y === 'number' && Number.isFinite(dst.y)) ? dst.y : 0;
          dstGridX = dst.gridX ?? 0;
          dstGridY = dst.gridY ?? 0;
          dstZIndex = dst.zIndex ?? 0;
        } catch (_) {
          devWarn('⚠️ dst properties inaccessible (destroyed) - skipping merge-6 animation setup');
          return;
        }
        
        // FX
        const wasWild = wildActive;
        // 🔥 CRITICAL: Determine if this is wild-magnet or wild-only merge
        // 🔥 CRITICAL FIX: Use srcSpecialMerge6/dstSpecialMerge6 (saved values) instead of srcSpecial/dstSpecial
        const isMainWildMagnetMerge = srcSpecialMerge6 === 'wild-magnet' || dstSpecialMerge6 === 'wild-magnet';
        const isMainWildTntMerge = srcSpecialMerge6 === 'wild-tnt' || dstSpecialMerge6 === 'wild-tnt';
        const isMainWildOnlyMerge = (srcSpecialMerge6 === 'wild' || dstSpecialMerge6 === 'wild' || srcSpecialMerge6 === 'wild-juice' || dstSpecialMerge6 === 'wild-juice' || srcSpecialMerge6 === 'wild-tnt' || dstSpecialMerge6 === 'wild-tnt') && !isMainWildMagnetMerge;
        
        if (wasWild) {
          // Standard screen shake for all wild merges; TNT merge = 5× jači shake (Explosion Pack)
          let baseShake = Math.min(28, 12 + Math.max(1, mult) * 4);
          if (isMainWildTntMerge) {
            baseShake = Math.min(100, Math.round(baseShake * 5));
            baseShake = Math.round(baseShake * 0.4); // -60% strength
          }
          // TNT: pokreni animaciju prije shake-a, anchor na kockici merge 6, overlay prati board shake
          const alsoShakeTargets: HTMLElement[] = [];
          if (isMainWildTntMerge) {
            try {
              try { preloadTntFrames(); } catch {}
              const blastReturnHandles: Array<{ tile: Tile; wobble: gsap.core.Tween; origX: number; origY: number; returnDuration: number; returnElastic: number }> = [];
              const startTntBoardBlast = () => {
                // Pokreni blast+shake tek nakon što TNT sprite sekvenca završi.
                try {
                  const primaryTiles = Array.isArray(STATE?.tiles) ? STATE.tiles : [];
                  const fallbackTiles = Array.isArray(tiles) ? tiles : [];
                  const allBlastTiles = Array.from(new Set<Tile>([...primaryTiles, ...fallbackTiles]));
                  const blastStrength = TILE * 0.4;
                  const blastCenter = centerInBoard(board, dst, TILE);

                  allBlastTiles.forEach((tile: Tile) => {
                    if (!tile || tile.destroyed) return;
                    // User requested: move only active cubes (no locked/ghost placeholders).
                    if (tile.locked) return;
                    const tileValue = (tile.value | 0);
                    const isWildLike = typeof tile.special === 'string' && tile.special.startsWith('wild');
                    if (!isWildLike && tileValue <= 0) return;
                    const origX = tile.x ?? 0;
                    const origY = tile.y ?? 0;
                    const tileCenter = centerInBoard(board, tile, TILE);
                    const dx = tileCenter.x - blastCenter.x;
                    const dy = tileCenter.y - blastCenter.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    // Ensure every tile moves: if tile is exactly on blast center,
                    // assign a random outward direction instead of skipping.
                    let dirX = 0;
                    let dirY = 0;
                    if (distance < 1) {
                      const angle = Math.random() * Math.PI * 2;
                      dirX = Math.cos(angle);
                      dirY = Math.sin(angle);
                    } else {
                      dirX = dx / distance;
                      dirY = dy / distance;
                    }
                    const blastDist = blastStrength * (1 + Math.random() * 0.3);
                    const blastX = origX + dirX * blastDist;
                    const blastY = origY + dirY * blastDist;

                    try { gsap.killTweensOf(tile); } catch {}
                    gsap.set(tile, { x: origX, y: origY });

                    const returnDuration = 1.7 + Math.random() * 0.3;
                    const returnElastic = 0.06 + Math.random() * 0.06;
                    const blastDuration = returnDuration;
                    const wobbleAmp = TILE * (0.03 + Math.random() * 0.05);
                    const wobbleDur = 0.7 + Math.random() * 0.5;
                    const wobbleElastic = 0.35 + Math.random() * 0.2;

                    gsap.to(tile, {
                      x: blastX,
                      y: blastY,
                      duration: blastDuration,
                      ease: `elastic.out(1, ${returnElastic})`,
                      overwrite: 'auto'
                    });

                    const wobble = gsap.to(tile, {
                      x: blastX + (Math.random() - 0.5) * wobbleAmp,
                      y: blastY + (Math.random() - 0.5) * wobbleAmp,
                      duration: wobbleDur,
                      delay: blastDuration,
                      repeat: -1,
                      yoyo: true,
                      ease: `elastic.inOut(1, ${wobbleElastic})`
                    });
                    try { tntBlastWobbleTweens.push(wobble); } catch {}

                    blastReturnHandles.push({
                      tile,
                      wobble,
                      origX,
                      origY,
                      returnDuration,
                      returnElastic
                    });
                  });
                } catch (e) {
                  devWarn('⚠️ Tile blast animation failed:', e);
                }

              };
              const returnTntBlastTiles = (onDone?: () => void) => {
                try {
                  let pending = 0;
                  const springReachThreshold = Math.max(3, Math.floor(TILE * 0.06));
                  let firstSpringTriggered = false;
                  blastReturnHandles.forEach((h) => {
                    if (!h.tile || h.tile.destroyed || !STATE?.tiles?.includes?.(h.tile)) return;
                    pending += 1;
                    try { h.wobble.kill(); } catch {}
                    gsap.to(h.tile, {
                      x: h.origX,
                      y: h.origY,
                      duration: h.returnDuration,
                      ease: `elastic.out(0.6, ${h.returnElastic})`,
                      overwrite: 'auto',
                      onUpdate: () => {
                        if (firstSpringTriggered) return;
                        try {
                          const dx = Math.abs((h.tile.x ?? h.origX) - h.origX);
                          const dy = Math.abs((h.tile.y ?? h.origY) - h.origY);
                          if (dx <= springReachThreshold && dy <= springReachThreshold) {
                            firstSpringTriggered = true;
                            finish();
                          }
                        } catch {}
                      },
                      onComplete: () => {
                        pending -= 1;
                        if (pending <= 0) finish();
                      }
                    });
                  });
                  try { tntBlastWobbleTweens = []; } catch {}
                  let done = false;
                  const finish = () => {
                    if (done) return;
                    done = true;
                    try { onDone?.(); } catch {}
                  };
                  if (pending <= 0) {
                    finish();
                    return;
                  }
                } catch (e) {
                  devWarn('⚠️ TNT blast return failed:', e);
                  try { onDone?.(); } catch {}
                }
              };
              // Start tile separation immediately on TNT merge-6.
              startTntBoardBlast();
              const tntOverlay = showTntAnimation({
                onSpriteSequenceComplete: () => {
                  // Guard endgame check until TNT bonus break/spawn phase has enough time to complete.
                  // Without this, fail screen can trigger on transient board state.
                  tntBonusGuardUntil = Math.max(tntBonusGuardUntil, Date.now() + 3200);
                  // User requested sequence:
                  // 1) spread immediately
                  // 2) when TNT sprite sequence ends
                  // 3) return to original positions
                  // 4) only then break 4 tiles (shards/smoke stay aligned)
                  returnTntBlastTiles(() => {
                    const bonusCall = trackDelayedCall(0, () => {
                      runTntBoomBonusBreak2Tiles({
                        board,
                        dst,
                        addWildProgress,
                        WILD_INC_BIG,
                        removeTile,
                        openAtCell,
                        regularMerge6ShardsTemplated,
                        smokeBubblesAtTile,
                        TILE,
                        devLog,
                        devWarn,
                        skipFx: false
                      });
                    });
                    if (bonusCall) tntBoomDelayedCalls.push(bonusCall);
                  });
                }
              });
              if (tntOverlay) alsoShakeTargets.push(tntOverlay);
            } catch (e) {
              devWarn('⚠️ TNT animation position failed:', e);
            }
          }
          // Wild-magnet merge 6: odmakni ostale kockice od centra (kao TNT blast), bez pulled tiles
          if (isMainWildMagnetMerge) {
            try {
              const magnetBlastCenter = centerInBoard(board, dst, TILE);
              const magnetBlastStrength = TILE * 0.32;
              const magnetBlastDuration = 0.38;
              const magnetReturnDelay = 0.45;
              const magnetReturnDuration = 1.15;
              const magnetReturnElastic = 0.08;
              const allTiles = STATE.tiles || [];
              const magnetBlastHandles: Array<{ tile: Tile; origX: number; origY: number }> = [];
              allTiles.forEach((tile: Tile) => {
                if (!tile || tile.destroyed || tile === dst) return;
                if ((tile as any)._wildMagnetAffected === true) return;
                const origX = tile.x ?? 0;
                const origY = tile.y ?? 0;
                const tileCenter = centerInBoard(board, tile, TILE);
                const dx = tileCenter.x - magnetBlastCenter.x;
                const dy = tileCenter.y - magnetBlastCenter.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < 1) return;
                const dirX = dx / distance;
                const dirY = dy / distance;
                const blastDist = magnetBlastStrength * (0.9 + Math.random() * 0.3);
                const blastX = origX + dirX * blastDist;
                const blastY = origY + dirY * blastDist;
                try { gsap.killTweensOf(tile); } catch {}
                gsap.set(tile, { x: origX, y: origY });
                gsap.to(tile, {
                  x: blastX,
                  y: blastY,
                  duration: magnetBlastDuration,
                  ease: `elastic.out(1, ${0.04 + Math.random() * 0.04})`,
                  overwrite: 'auto'
                });
                magnetBlastHandles.push({ tile, origX, origY });
              });
              const magnetReturnCall = trackDelayedCall(magnetReturnDelay + magnetBlastDuration, () => {
                magnetBlastHandles.forEach((h) => {
                  if (!h.tile.destroyed) {
                    const retTween = gsap.to(h.tile, {
                      x: h.origX,
                      y: h.origY,
                      duration: magnetReturnDuration,
                      ease: `elastic.out(0.6, ${magnetReturnElastic + Math.random() * 0.04})`,
                      overwrite: 'auto'
                    });
                    try { magnetBlastReturnTweens.push(retTween); } catch {}
                  }
                });
              });
              if (magnetReturnCall) magnetBlastDelayedCalls.push(magnetReturnCall);
              devLog('🧲 Wild-magnet merge 6 - blast (odmak kockica) started for', magnetBlastHandles.length, 'tiles');
            } catch (e) {
              devWarn('⚠️ Magnet blast animation failed:', e);
            }
          }
          try {
            screenShake(app, {
              strength: baseShake,
              duration: 0.26,
              steps: 16,
              ease: 'sine.inOut',
              alsoShake: alsoShakeTargets
            });
          } catch {}
          
          // 🔥 NEW SYSTEM: Direct call to woodShardsAtTile with explicit flags
          // This bypasses getMerge6ShardConfig and ensures correct shard colors
          if (isMainWildMagnetMerge) {
            // Wild-magnet merge: red shards using template-based pooling
            // NO STARS for wild-magnet merge
            devLog('🔥 Wild-magnet merge 6 - using template-based pooling with red shards (NO STARS)');
            const mergePos = centerInBoard(board, dst, TILE);
            wildMagnetMerge6ShardsTemplated(board, { x: mergePos.x, y: mergePos.y, gridX: dstGridX, gridY: dstGridY, zIndex: dstZIndex } as any, { 
              zIndex: dstZIndex
            });
            showMagneticText();
          } else if (isMainWildOnlyMerge) {
            // Wild-only merge (wild on ordinary or ordinary on wild): yellow shards for wild star, orange for wild juice
            // 🔥 USER REQUEST: Skip star particles - orbiting stars will be animated to HUD instead
            devLog('🔥 Wild-only merge 6 - using template-based pooling (srcSpecial:', srcSpecial, 'dstSpecial:', dstSpecial, ')');
            // 🔥 WILD-JUICE / WILD-TNT: Check merge type (use srcSpecialMerge6/dstSpecialMerge6)
            const isWildJuiceMerge = srcSpecialMerge6 === 'wild-juice' || dstSpecialMerge6 === 'wild-juice';
            const isWildTntMerge = srcSpecialMerge6 === 'wild-tnt' || dstSpecialMerge6 === 'wild-tnt';
            // 🔥 USER REQUEST: Check if this is pure wild star (not wild-juice, not wild-tnt, not wild-magnet)
            const isPureWildStarMerge = (srcSpecial === 'wild' || dstSpecial === 'wild') && !isWildJuiceMerge && !isWildTntMerge;
            
            // 🔥 CRITICAL DEBUG: Log all relevant values to diagnose why bubbles explosion might not trigger
            devLog('💧 Merge 6 check - isWildJuiceMerge:', isWildJuiceMerge, 'isPureWildStarMerge:', isPureWildStarMerge);
            // Unlock for non-TNT wild merges after short delay
            devLog('💧 Merge 6 special values:', {
              srcSpecialMerge6,
              dstSpecialMerge6,
              srcSpecial,
              dstSpecial,
              srcSpecialCurrent: src?.special,
              dstSpecialCurrent: dst?.special,
              srcValue: src?.value,
              dstValue: dst?.value,
              srcDestroyed: src?.destroyed,
              dstDestroyed: dst?.destroyed
            });
            
            // 🎨 TEMPLATE-BASED: Use new template system with ORIGINAL COLORS
            if (isWildJuiceMerge) {
              // 🍺 Wild-juice merge: orange shards using template-based pooling (ORIGINAL COLOR)
              devLog('🍺 Wild-juice merge 6 - using template-based pooling with orange shards (ORIGINAL COLOR)');
              wildJuiceMerge6ShardsTemplated(board, dst, { 
                zIndex: 9993
              });
            } else if (isWildTntMerge) {
              // 💥 Wild-TNT merge: skip shards when TNT animation starts
              devLog('💥 Wild-TNT merge 6 - TNT anim active, skipping shards');
            } else if (isPureWildStarMerge) {
              // ⭐ Wild star merge: yellow shards using template-based pooling (ORIGINAL COLOR)
              devLog('⭐ Wild star merge 6 - using template-based pooling with yellow shards (ORIGINAL COLOR)');
              wildStarMerge6ShardsTemplated(board, dst, { 
                skipStars: true,  // 🔥 USER REQUEST: Skip star particles for pure wild star merge 6
                zIndex: 9993
              });
              // Trigger stars-to-HUD exactly between shards and smoke phase.
              if (shouldAnimateStarsToHUD && !starsToHudTriggered && savedStarPositionsEarly.length > 0) {
                const merge6PosForStars = getMerge6ScreenPos(dst);
                let hudStarPosForStars = null;
                if (typeof HUD.getStarHudPosition === 'function') {
                  try {
                    hudStarPosForStars = HUD.getStarHudPosition();
                  } catch (e) {
                    devWarn('⚠️ Failed to get HUD star position for between-shards trigger:', e);
                  }
                }
                if (hudStarPosForStars) {
                  starsToHudTriggered = true;
                  (async () => {
                    try {
                      showSparkleText();
                      devLog('⭐ Triggering stars-to-HUD between shards and smoke (INSTANT)');
                      await animateStarsToHudIcon(
                        board,
                        stage,
                        savedStarPositionsEarly,
                        savedWildTileScreenPosEarly,
                        merge6PosForStars,
                        hudStarPosForStars,
                        app
                      );
                    } catch (error) {
                      starsToHudTriggered = false;
                      devError('❌ Failed between-shards stars-to-HUD trigger:', error);
                    }
                  })();
                }
              }
            } else {
              // Fallback to generic wild merge
              wildMerge6ShardsTemplated(board, dst, { 
                skipStars: isPureWildStarMerge,
                zIndex: 9993
              });
            }
            
            // 🔥 FPS DROP FIX: Stagger animacije umjesto istovremenog pokretanja
            // Wild-TNT animacija je već pokrenuta gore (prije screenShake, anchor na kockici)
            if (isWildTntMerge) {
              devLog('💥 Wild-TNT merge 6 – TNT animacija već pokrenuta (anchor na kockici, prati shake)');
            } else if (isWildJuiceMerge) {
              devLog('💧 Wild-juice merge 6 – pokrećem bubbles explosion');
              try {
                const wasActive = isWildJuiceBubblesExplosionActive();
                if (wasActive) {
                  stopWildJuiceBubblesExplosion();
                }
                if (isWildJuiceBubblesExplosionActive()) {
                  stopWildJuiceBubblesExplosion();
                }
                showWildJuiceBubblesExplosion();
              } catch (error) {
                devError('❌ Failed to trigger bubbles explosion:', error);
              }
            }
            if (!isWildJuiceMerge && !isWildTntMerge) {
              devLog('⚠️ Wild-juice/TNT merge NOT detected!', {
                isWildJuiceMerge,
                isWildTntMerge,
                srcSpecialMerge6,
                dstSpecialMerge6,
                srcSpecial,
                dstSpecial,
                srcSpecialCurrent: src?.special,
                dstSpecialCurrent: dst?.special,
                wasWild,
                isMainWildOnlyMerge,
                isMainWildMagnetMerge
              });
            }
          } else {
            // Fallback: use spawnMerge6Shards (shouldn't happen, but safety)
            devWarn('⚠️ Wild merge but neither wild-magnet nor wild-only detected, using spawnMerge6Shards');
            const srcSnapshot = { special: srcSpecial };
            const dstSnapshot = { special: dstSpecial };
            spawnMerge6Shards(board, srcSnapshot, dst, dstSnapshot, { count: 30, intensity: 1.9, spread: 0.3, size: 1.5, speed: 0.85, vanishDelay: 0.0, vanishJitter: 0.02 });
          }
          
          wildImpactEffect(dst, { squash: 0.30, stretch: 0.26, tilt: 0.18, bounce: 1.24 });
        } else {
          // 🔥 REGULAR MERGE 6: Use same system as wild/magnet merge but with 50% reduced intensity
          // Same effects as wild merge, but all parameters scaled down by 50%
          (dst as any)._lastMergeWasRegularOnly = true; // No stars/bubbles → skip stars wait, clean board ASAP
          
          // 🔥 CRITICAL: Regular merge 6 shards - START 0.150s EARLIER (before glass crack)
          // This ensures shards animation starts before tile "dies off"
          // 🔥 SPEED UP: Instant procedural fade-out + animation duration exactly 1s
          const mergePos = centerInBoard(board, dst, TILE);
          // 🔥 CRITICAL: Check if this is wild merge to pass isWildOnly flag for yellow shards
          const isWildMerge = srcSpecial === 'wild' || dstSpecial === 'wild';
          const isWildJuiceMerge = srcSpecial === 'wild-juice' || dstSpecial === 'wild-juice';
          const isWildMagnetMerge = srcSpecial === 'wild-magnet' || dstSpecial === 'wild-magnet';
          const isWildOnlyMerge = isWildMerge && !isWildJuiceMerge && !isWildMagnetMerge;
          
          // 🎨 TEMPLATE-BASED: Use new template system for reliable pooling
          regularMerge6ShardsTemplated(board, { x: mergePos.x, y: mergePos.y, gridX: dstGridX, gridY: dstGridY, zIndex: dstZIndex } as any, { 
            zIndex: dstZIndex
          });
          
          // Impact effect (50% of wild: squash 0.24->0.12, stretch 0.20->0.10, tilt 0.14->0.07, bounce 1.18->1.09)
          wildImpactEffect(dst, { squash: 0.12, stretch: 0.10, tilt: 0.07, bounce: 1.09 });
          
          // Smoke bubbles (50% of wild: 2.6 * 0.5 = 1.3)
          smokeBubblesAtTile(board, dst, TILE * 1.0, 1.3, {
            spawnShape: 'box',
            sizeBoostChance: 0.2,
            sizeBoostScale: 1.3,
            instantFadeOut: true,
            distanceScale: 0.6
          });
        }

        
        // Show multiplier for merge 6
        if (dst && !dst.destroyed) {
        if (wasWild) {
          showMultiplierTile(board, dst, mult, TILE * 1.3, 1.2);
          if (!isMainWildTntMerge) {
            // 🔥 Wild-magnet merge: Reduce smoke intensity by 80% (3.0 * 0.2 = 0.6)
            const smokeStrength = isMainWildMagnetMerge ? 0.6 : 3.0;  // 80% reduction for wild-magnet
            smokeBubblesAtTile(board, dst, TILE * 1.3, smokeStrength, {
              sizeScale: 0.8 + Math.random() * 0.25,  // Compact size: 0.8-1.05x
              countScale: 0.75 + Math.random() * 0.3, // Rich but contained: 0.75-1.05x
              distanceScale: 0.55,
              trailAlpha: 0.92,
              spawnShape: 'box'
            });
          }
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
            trackAppTimeout(async () => {
              devLog(`🧲 Multiplier x${mult} animation started (sped up 60%), triggering pulled tiles merge`);
              if ((dst as any)._wildMagnetMergeCallback) {
                await (dst as any)._wildMagnetMergeCallback();
                // Clean up callback
                (dst as any)._wildMagnetMergeCallback = undefined;
                (dst as any)._wildMagnetSpeedUp = undefined;
              }
            }, 80); // Speed up by 60%: 0.2s * 0.4 = 0.08s = 80ms (was 0ms, now 80ms for 60% speedup)
          }
        } else {
          devWarn('⚠️ Cannot show multiplier - destination tile is destroyed');
        }

        if (!wasWild) {
          try {
            // 🔥 USER REQUEST: Reduce regular merge 6 shake by 55% for more contained movement
            const base = Math.min(24, 10 + Math.max(1, mult) * 3);
            const reducedStrength = Math.round(base * 0.45); // 55% reduction = 45% of original
            screenShake(app, { strength: reducedStrength, duration: 0.32, steps: 18, ease: 'power2.out' });
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
            const isWild = special === 'wild' || special === 'wild-magnet' || special === 'wild-juice' || special === 'wild-tnt';
            return value > 0 || isWild;
          });
          
          const hasMagnetBeforeCheck = activeTilesBeforeCheck.some((t: any) => t.special === 'wild-magnet');
          const hasWildBeforeCheck = activeTilesBeforeCheck.some((t: any) => t.special === 'wild' || t.special === 'wild-juice' || t.special === 'wild-tnt');
          const hasMerge6BeforeCheck = activeTilesBeforeCheck.some((t: any) => t.value === 6);
          
          // 🔥 CRITICAL: If magnet + merge6 or wild + merge6 exists, skip last merge check
          // They can merge together, so it's NOT a last merge
          if ((hasMagnetBeforeCheck && hasMerge6BeforeCheck) || (hasWildBeforeCheck && hasMerge6BeforeCheck)) {
            devLog('🧲⭐ MAGNET/WILD SAFETY (before dst removal): Magnet/wild + merge6 detected - NOT a last merge, game continues');
            devLog('🧲⭐ Details:', { hasMagnet: hasMagnetBeforeCheck, hasWild: hasWildBeforeCheck, hasMerge6: hasMerge6BeforeCheck });
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
            devLog('🚨🚨🚨 LAST MERGE DETECTED (before dst removal, centralized checker) - Only merge 6 remains, triggering clean board flow');
            setFinalMergeVisualSuppression(true);
            
            // Set busyEnding flag IMMEDIATELY to prevent any other code from running
            busyEnding = true;
            // 🔥 BUG FIX: Clear STACK IT! hint immediately - board will be clean
            try { resetEndgameHint(); } catch {}
            
            // Remove dst tile (merge 6) to make board clean
            if (dst && !dst.destroyed && STATE.tiles.includes(dst)) {
              grid[gy][gx] = null;
              dst.visible = false;
              removeTile(dst);
            }
            
            // CRITICAL: Reset wild meter immediately to prevent visual residue
            devLog('🔥 LAST MERGE: Resetting wild meter immediately...');
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
              devLog('✅ LAST MERGE: Wild meter reset completed');
            } catch (error) {
              devWarn('⚠️ LAST MERGE: Failed to reset wild meter:', error);
            }
            
            // 🔥 FIX: Use triggerCleanBoardFlow (same entry as other clean board paths) so modal shows consistently
            // Note: triggerCleanBoardFlow will set busyEnding internally, so we don't need to set it here
            await triggerCleanBoardFlow('clean_board_from_last_merge_checkEndGame');
            return; // Exit early - don't continue with normal merge 6 flow
          }
          } // End of else block for checkEndGame call
        } else {
          if (busyEnding) {
            devLog('⏳ Last merge check (before dst removal) skipped - busyEnding is true');
          } else if (isWildMagnetMergeWithPullBeforeDst) {
            devLog('🧲 Last merge check (before dst removal) skipped - wild-magnet merge will pull tiles');
          } else if (isRegularWildMergeBeforeDst && isNotLastMergeBeforeDst) {
            devLog('⭐ Last merge check (before dst removal) skipped - regular wild merge mid-game (NOT last merge)');
          }
          // Don't return here - continue with normal merge 6 flow for wild-magnet and regular wild merges
        }
        
        // 🔥 CRITICAL: DON'T remove dst tile yet - we need it for endgame checks and spawn logic
        // dst will be removed AFTER spawn logic, not before
        // This prevents false "clean board" detection when dst is still the only remaining tile
        
        // 🔥 CRITICAL: Check if this is magnet pull merge BEFORE hiding dst tile
        // For magnet pull merge, dst (merge 6) should remain visible on the board
        // 🔥 CRITICAL FIX: Use _willPullTiles (set BEFORE onComplete) OR _wildMagnetPulledTilesMerge (set AFTER callback)
        // Do NOT check _wildMagnetMergeCallback - it exists even when no tiles are pulled!
        const isMagnetPullMergeFlag = (dst as any)?._wildMagnetPulledTilesMerge === true;
        const willPullEarly = (dst as any)?._noTilesPulled === true ? false : (dst as any)?._willPullTiles === true;
        const isMagnetPullMerge = isMagnetPullMergeFlag || willPullEarly;
        
        // Placeholder handling for non-regular merge flows.
        // Regular merge-6 must keep dst as visible active result tile.
        let placeholderHolder: any = null; // 🔥 v40.1: Store reference to placeholder for cleanup
        if (dst && !dst.destroyed && STATE.tiles.includes(dst)) {
          const keepRegularMerge6Visible = !isMagnetPullMerge && !wasWild;
          // 🔥 CRITICAL FIX: Only clear grid if dst will actually be hidden/replaced.
          // Regular merge-6 that stays visible must keep a valid grid pointer.
          if (!isMagnetPullMerge && !keepRegularMerge6Visible) {
            grid[gy][gx] = null;
          }

          // Regular merge-6 must remain on board as active tile.
          // Placeholder replacement here can leak as locked ghost and break merge result visuals.
          if (keepRegularMerge6Visible) {
            dst.locked = false;
            dst.visible = true;
            dst.alpha = 1;
            dst.eventMode = 'static';
            dst.cursor = 'pointer';
            devLog('🎯 Regular merge-6: keeping merge result tile visible and active (no placeholder swap)');
          } else if (!isMagnetPullMerge) {
            // Wild non-magnet flow keeps legacy behavior (placeholder helper for spawn choreography).
            dst.visible = false;
            dst.alpha = 0;
            dst.eventMode = 'none';

            placeholderHolder = makeBoard.createTile({ board, grid, tiles, c: gx, r: gy, val: 0, locked: true });
            placeholderHolder.alpha = 0.35;
            placeholderHolder.eventMode = 'none';

            // 🔥 v40.1: Store reference on dst for cleanup
            (dst as any)._placeholderHolder = placeholderHolder;

            devLog('🔍 Dst tile hidden but NOT removed from tiles array yet - will be removed AFTER spawn');
            devLog('🔍 Placeholder created at (', gx, ',', gy, ') for spawn logic');
          } else {
            // 🔥 CRITICAL: For magnet pull merge, keep dst tile visible and don't create placeholder
            // The merge 6 tile should remain on the board along with newly spawned tiles
            devLog('🧲 Magnet pull merge detected - keeping merge 6 tile visible on board');
            devLog('🧲 Dst tile (merge 6) will remain visible:', { 
              value: dst.value, 
              gridX: dst.gridX, 
              gridY: dst.gridY,
              wasWildMagnet: wasWildMagnet,
              hasCallback: !!(dst as any)?._wildMagnetMergeCallback,
              hasFlag: isMagnetPullMergeFlag
            });
          }
        } else {
          devWarn('⚠️ Destination tile is invalid or already destroyed');
        }

        // countdown moves (this happens for both normal and pulled tiles merge)
        moves = Math.max(0, moves - 1);

        // scoring with bubble multiplier and combo multiplier
        // 🔥 CRITICAL: Skip scoring if pulled tiles merge is happening (scoring handled in mergePulledTilesIntoMerge6)
        if ((dst as any)?._wildMagnetPulledTilesScoring) {
          devLog('🧲 Skipping scoring in main merge 6 flow - pulled tiles merge will handle scoring');
        } else {
        const bubbleMult = mult || 1;
        const comboMult  = combo > 0 ? combo : 1;
        const scoreDelta = 6 * bubbleMult * comboMult;
        logger.debug('🎯 Score calculation', 'app-core', { mult, bubbleMult, comboMult, scoreDelta });
        
        score = Math.min(SCORE_CAP, score + scoreDelta);
        // CRITICAL: Sync STATE.score with local score after adding
        STATE.score = score;
        devLog('🎯 Final score after merge:', score, 'STATE.score:', STATE.score);

        animateBoardHUD(boardNumber, 0.40);
        animateScore(score, 0.40);
        }

        // Stats: count merge-6 as "cubes cracked"
        statsService.incrementCubesCracked(1);
        if (isArcadeHomeRunMode()) {
          arcadeStatsService.addCubesCracked(1);
        }
        
        // 🔥 USER REQUEST: Track cubes cracked per-board for merge-6
        try {
          if (typeof window.trackCubesCracked === 'function') {
            window.trackCubesCracked(1);
            devLog(`🧊 Merge-6: Tracked cubes cracked for board ${boardNumber}`);
          }
        } catch (error) {
          devWarn('⚠️ Failed to track board-specific cubes cracked for merge-6:', error);
        }
        
        if (wasWild) {
          statsService.incrementHelpersUsed(1);
        }
        
        // Stats: Track longest combo - use actual combo value after merge-6
        // For merge-6, combo is already incremented in the merge function above
        const currentComboForMerge6 = typeof (window as any).CC?.getCombo === 'function'
          ? (window as any).CC.getCombo()
          : combo;
        if (currentComboForMerge6 > 0) {
          statsService.updateLongestCombo(currentComboForMerge6);
          if (isArcadeHomeRunMode()) {
            arcadeStatsService.updateLongestCombo(currentComboForMerge6);
          }
          
          // 🔥 JOURNEY BOARDS: Track longest combo per board for merge-6
          try {
            import('../services/board-stats-service.js').then(({ boardStatsService }) => {
              boardStatsService.updateBoardLongestCombo(boardNumber, currentComboForMerge6);
              devLog(`🎯 Merge-6: Tracked longest combo for board ${boardNumber}: ${currentComboForMerge6}`);
            }).catch(() => {
              // Ignore import errors
            });
          } catch {}
        }
        
        // Stats: Update high score for every merge
        statsService.updateHighScore(score);
        if (isArcadeHomeRunMode()) {
          arcadeStatsService.updateHighScore(score);
        }
        
        // COLLECTIBLES: Dispatch event for first merge 6
        if (!wasWild && typeof (window as any).collectiblesManager !== 'undefined' && (window as any).collectiblesManager) {
          const manager = (window as any).collectiblesManager;
          if (typeof manager.unlockCard === 'function') {
            manager.unlockCard('first_merge_6');
          }
        }
        
        // Ghost placeholders are now fixed and always visible

        // ► CLEAN BOARD flow (centralized orchestrator)
        // 🔥 DEBUG: Log when merge-6 onComplete is called
        devLog('🔥🔥🔥 MERGE-6 onComplete CALLED:', {
          dstValue: dst?.value,
          srcSpecial,
          dstSpecial,
          wildActive,
          isWildStar: srcSpecial === 'wild' || dstSpecial === 'wild',
          isWildJuice: srcSpecial === 'wild-juice' || dstSpecial === 'wild-juice',
          isWildMagnet: srcSpecial === 'wild-magnet' || dstSpecial === 'wild-magnet',
          _wildMagnetPulledTilesMerge: (dst as any)?._wildMagnetPulledTilesMerge,
          _isLastMerge: (dst as any)?._isLastMerge,
          activeTilesCount: tiles.filter(t => t && !t.destroyed && !t.locked && ((t.value|0) > 0 || t.special)).length
        });
        
        // 🔥 CRITICAL: Skip end game check AND normal spawn if pulled tiles merge is happening (or WILL happen)
        // RACE FIX: Main onComplete runs at ~80ms, but pull merge happens at ~260ms when tiles reach 75%.
        // So _wildMagnetPulledTilesMerge is false when we run - we must also check willPullTilesFlag!
        // Otherwise we'd run normal spawn here, then mergePulledTilesIntoMerge6 would also spawn → conflict/no tiles.
        const willPullMerge = (dst as any)?._wildMagnetPulledTilesMerge === true || willPullTilesFlag;
        if (willPullMerge) {
          devLog('🧲 Skipping normal spawn - magnet pull merge will handle spawn (willPullTilesFlag or merge done)');
          // Don't run normal spawn - mergePulledTilesIntoMerge6 will spawn after pull completes
          // Don't remove dst - merge 6 stays on board for user to merge with spawned tiles
          return;
        }
        
        // 🔥 REMOVED: Premature endgame check that was blocking spawn logic
        // The endgame check was running BEFORE spawn, causing board to look empty (dst removed)
        // This made it trigger clean board flow instead of spawning new tiles
        // Endgame check will be done AFTER spawn in checkLevelEnd()
        devLog('🎯 Merge 6 completed, proceeding to spawn logic...');
        devLog('🔍 DEBUG: mult value in onComplete:', mult, 'typeof mult:', typeof mult);
        
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
          devLog('🧲 Pulled tiles will merge - this is NOT last merge (new tiles will spawn)', {
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
            const isWild = special === 'wild' || special === 'wild-magnet' || special === 'wild-juice' || special === 'wild-tnt';
            return value > 0 || isWild;
          });
          
          // If only merge 6 remains (or merge 6 + locked tiles), this is last merge
          const onlyMerge6RemainsInOnComplete = activeTilesAfterMerge.length === 1 && 
                                                activeTilesAfterMerge[0] === dst && 
                                                dst.value === 6;
          
          // 🔥 HARD RULE: If ONLY 2 active tiles existed before merge, this is ALWAYS last merge (locked tiles ignored)
          const onlyTwoActiveBeforeMerge =
            activeTilesBeforeMerge.length === 2 &&
            activeTilesBeforeMerge.includes(src) &&
            activeTilesBeforeMerge.includes(dst) &&
            !hasTilesToPull;
          
          if (onlyTwoActiveBeforeMerge) {
            devWarn('🛑 FORCING LAST MERGE: only 2 active tiles before merge (locked tiles ignored)');
            (dst as any)._isLastMerge = true;
          }
          
          isActuallyLastMerge = onlyTwoActiveBeforeMerge || hasLastMergeFlag || onlyMerge6RemainsInOnComplete;
        
          devLog('🔍 LAST MERGE CHECK in merge-6 onComplete:', {
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
          devLog(`🚨🚨🚨 LAST MERGE DETECTED (in merge-6 onComplete) - ${mergeType} → merge 6, skipping wild progress and spawn, triggering clean board`);
          devLog('🚨🚨🚨 LAST MERGE: hasLastMergeFlag =', hasLastMergeFlag, 'onlyMerge6RemainsInOnComplete =', isActuallyLastMerge, 'dst._isLastMerge =', (dst as any)?._isLastMerge);
          
          // Ensure flag is set for consistency
          if (!hasLastMergeFlag) {
            (dst as any)._isLastMerge = true;
            devLog('✅ Setting _isLastMerge flag in onComplete (was missing)');
          }
          // Hide ghost placeholders/background for ALL final wild cinematics (magnet/tnt/juice/star).
          setFinalMergeVisualSuppression(true);
          
          // Skip wild progress and spawn - go directly to clean board flow
          // The clean board flow will be triggered by the _isLastMerge flag check below
          // 🔥 CRITICAL: DON'T call addWildProgress - it would fill wild meter and trigger wild spawn!

          // 🔥 If final merge is TNT, wait for full TNT animation exit before clean board
          const isFinalTntMerge = srcSpecialMerge6 === 'wild-tnt' || dstSpecialMerge6 === 'wild-tnt';
          if (isFinalTntMerge && typeof onTntAnimationComplete === 'function') {
            devLog('💥 Final TNT merge: deferring clean board until TNT animation completes');
            // 🔥 BUG FIX: Clear STACK IT! hint NOW - don't wait for animation (timer could fire during boom)
            try { resetEndgameHint(); } catch {}
            const cleanupFinalTntBoardArtifacts = () => {
              try {
                const clearTileFromGridForTntFinal = (tile: any) => {
                  if (!tile || !grid) return;
                  try {
                    const gxCandidate = tile.gridX;
                    const gyCandidate = tile.gridY;
                    if (gyCandidate !== undefined && gxCandidate !== undefined && grid[gyCandidate] && grid[gyCandidate][gxCandidate] === tile) {
                      grid[gyCandidate][gxCandidate] = null;
                      return;
                    }
                  } catch {}
                  try {
                    for (let r = 0; r < grid.length; r++) {
                      for (let c = 0; c < grid[r].length; c++) {
                        if (grid[r][c] === tile) {
                          grid[r][c] = null;
                          return;
                        }
                      }
                    }
                  } catch {}
                };

                const placeholderRef = (dst as any)?._placeholderHolder || placeholderHolder;
                if (placeholderRef && !placeholderRef.destroyed && STATE.tiles.includes(placeholderRef)) {
                  clearTileFromGridForTntFinal(placeholderRef);
                  removeTile(placeholderRef);
                }
                if (dst && !dst.destroyed && STATE.tiles.includes(dst)) {
                  clearTileFromGridForTntFinal(dst);
                  dst.visible = false;
                  dst.alpha = 0;
                  dst.eventMode = 'none';
                  removeTile(dst);
                }
                if (dst) {
                  (dst as any)._placeholderHolder = undefined;
                }
                try { fadeOutGhostPlaceholders(0.22); } catch {}
              } catch (cleanupError) {
                devWarn('⚠️ Final TNT merge cleanup before clean board failed:', cleanupError);
              }
            };

            // Run immediately as well (idempotent) so placeholder/locked tile cannot linger during TNT tail.
            cleanupFinalTntBoardArtifacts();

            onTntAnimationComplete(() => {
              cleanupFinalTntBoardArtifacts();
              try { triggerCleanBoardFlow('final_tnt_merge_after_tnt'); } catch {}
            });
            // Safety timeout: if TNT completion callback fails to fire, force the same cleanup path.
            trackAppTimeout(async () => {
              cleanupFinalTntBoardArtifacts();
              if (busyEnding) return;
              try {
                await triggerCleanBoardFlow('final_tnt_merge_fallback_timeout');
              } catch {}
            }, 2600);
            return;
          }
        } else {
          // Normal merge-6 - add wild progress
          devLog('✅ Normal merge-6 (NOT last merge) - adding wild progress');
          addWildProgress(WILD_INC_BIG);
        }
        
        // Game continues - check moves and proceed with spawn
        // 🔥 BUG FIX: For WILD merges (juice, star, TNT, magnet), ALWAYS spawn first (3 active + 6 locked)
        // Don't return early on moves depleted - spawn will add new tiles; checkLevelEnd will re-check after spawn
        const isWildMergeForMovesCheck =
          (srcSpecialMerge6 && srcSpecialMerge6.startsWith('wild')) ||
          (dstSpecialMerge6 && dstSpecialMerge6.startsWith('wild'));
        const isWildMagnetMergeForMovesCheck =
          srcSpecialMerge6 === 'wild-magnet' || dstSpecialMerge6 === 'wild-magnet';
        if (moves === 0 && !isWildMergeForMovesCheck) {
          // Use centralized checker for moves depleted scenario (NON-wild merges only)
          const movesDepletedContext: EndGameContext = {
            tiles,
            moves: 0,
            makeBoard
          };
          
          // 🔥 CRITICAL: Use forceRefresh for moves depleted check
          const movesDepletedResult = checkEndGame(movesDepletedContext, true);
          
          if (movesDepletedResult.type === 'stuck') {
            devLog('🚨🚨🚨 MOVES DEPLETED + GAME STUCK');
            try { resetEndgameHint(); } catch {}
            if (!busyEnding) {
              devLog('⏳ Waiting 1.5s so player can see board state (no moves), then fail screen...');
              try { showNoMovesText(); } catch {}
              await waitTracked(1500);
              try { await exitNoMovesText(); } catch {}
              showFinalScreen();
            }
            return;
          }
        } else if (moves === 0 && isWildMergeForMovesCheck) {
          if (isWildMagnetMergeForMovesCheck) {
            devLog('🧲 Wild-magnet merge with moves depleted - no extra 3 active spawn');
          } else {
            devLog('🍺⭐ Wild merge with moves depleted - spawning 3 active + 6 locked first, then checkLevelEnd will re-check');
          }
        }
        // Pass wild merge target info for smart spawning
        const wildMergeTarget = Number.isFinite(wildTargetValue) ? wildTargetValue : null;
        
        // 🔥 CRITICAL: Skip normal spawn if pulled tiles merge is happening
        // Pulled tiles merge already spawns new tiles in mergePulledTilesIntoMerge6
        // 🔥 FIX: Do NOT remove merge 6 - mergePulledTilesIntoMerge6 re-enables it as normal draggable tile
        if ((dst as any)?._wildMagnetPulledTilesMerge) {
          devLog('🧲 Skipping normal spawn - pulled tiles merge already spawned tiles');
          // Merge 6 stays on board - already re-enabled (eventMode, bindToTile) in mergePulledTilesIntoMerge6
          (dst as any)._wildMagnetPulledTilesMerge = undefined;
          (dst as any)._wildMagnetPulledTilesScoring = undefined;
          devLog('🧲 Skipping checkLevelEnd call here - mergePulledTilesIntoMerge6 will handle it after spawn completes');
          return;
        }
        
        // 🔥 SOURCE OF TRUTH: Final Two Tiles Resolution
        // Case A — Two tiles merge into 6: This is FINAL MERGE-6, Trigger CLEAN BOARD, No further spawning
        // 🔥 SIMPLIFIED: Only check _isLastMerge flag - this is set ONLY when it's truly the last merge (2 tiles total)
        // All other checks were too aggressive and blocked spawn when it shouldn't be blocked
        // 🔥 CRITICAL FIX: If pulled tiles will merge, this is NOT last merge (new tiles will spawn)
        // Note: willPulledTilesMerge is already declared above (line 4997), so we reuse it here
        const isLastMergeFlagSet = (dst as any)?._isLastMerge === true;
        
        // 🔥 SOURCE OF TRUTH: If final merge-6 (_isLastMerge flag), trigger CLEAN BOARD, do NOT spawn
        // This applies to ALL merge types: normal, wild juice, wild star, wild magnet
        if (isLastMergeFlagSet && !willPulledTilesMerge) {
          // Force-hide ghost placeholders/background while final merge cinematic (e.g. SWOOP) is on screen.
          setFinalMergeVisualSuppression(true);

          devLog('🚨🚨🚨 SOURCE OF TRUTH: Final merge-6 detected (_isLastMerge flag) - triggering CLEAN BOARD, NO spawn');
          devLog('🎯 Source of Truth: Case A — Two tiles merge into 6: This is FINAL MERGE-6, Trigger CLEAN BOARD, No further spawning');
          const isFinalMagnetMerge6 =
            srcSpecial === 'wild-magnet' ||
            dstSpecial === 'wild-magnet' ||
            (dst as any)?._wasWildMagnetMerge6 === true ||
            (dst as any)?._isWildMagnetLastTwo === true;
          const cleanupFinalMagnetBoardArtifacts = () => {
            try {
              const clearTileFromGridForFinal = (tile: any) => {
                if (!tile || !grid) return;
                try {
                  const gxCandidate = tile.gridX;
                  const gyCandidate = tile.gridY;
                  if (gyCandidate !== undefined && gxCandidate !== undefined && grid[gyCandidate] && grid[gyCandidate][gxCandidate] === tile) {
                    grid[gyCandidate][gxCandidate] = null;
                    return;
                  }
                } catch {}
                try {
                  for (let r = 0; r < grid.length; r++) {
                    for (let c = 0; c < grid[r].length; c++) {
                      if (grid[r][c] === tile) {
                        grid[r][c] = null;
                        return;
                      }
                    }
                  }
                } catch {}
              };

              const placeholderRef = (dst as any)?._placeholderHolder || placeholderHolder;
              if (placeholderRef && !placeholderRef.destroyed && STATE.tiles.includes(placeholderRef)) {
                clearTileFromGridForFinal(placeholderRef);
                removeTile(placeholderRef);
              }
              if (dst && !dst.destroyed && STATE.tiles.includes(dst)) {
                clearTileFromGridForFinal(dst);
                dst.visible = false;
                dst.alpha = 0;
                dst.eventMode = 'none';
                removeTile(dst);
              }
              if (dst) {
                (dst as any)._placeholderHolder = undefined;
              }
              // Match TNT behavior: hide ghost placeholders while text animation plays.
              try { fadeOutGhostPlaceholders(0.22); } catch {}
            } catch (cleanupError) {
              devWarn('⚠️ Final magnet merge cleanup before clean board failed:', cleanupError);
            }
          };

          const cleanupFinalGhostsAndLocked = () => {
            try {
              // Remove all locked tiles (including placeholders)
              const lockedToRemove = tiles.filter((t: any) => t && !t.destroyed && t.locked);
              lockedToRemove.forEach((t: any) => {
                try {
                  if (typeof t.gridX === 'number' && typeof t.gridY === 'number' && grid?.[t.gridY]?.[t.gridX] === t) {
                    grid[t.gridY][t.gridX] = null;
                  }
                } catch {}
                try {
                  t.visible = false;
                  t.alpha = 0;
                  t.eventMode = 'none';
                } catch {}
                try { removeTile(t); } catch {}
              });
              // Hide all ghost placeholders during final wild animation
              try { fadeOutGhostPlaceholders(0.22); } catch {}
            } catch (err) {
              devWarn('⚠️ Final merge cleanup for ghosts/locked failed:', err);
            }
          };

          if (isFinalMagnetMerge6) {
            // Run cleanup immediately so locked tile/ghost placeholders are gone during SWOOP.
            cleanupFinalMagnetBoardArtifacts();
            cleanupFinalGhostsAndLocked();
            // Fallback: if merge-6 FX path didn't start SWOOP for any reason, start it here.
            if (!isMagneticTextActive()) {
              devWarn('⚠️ Final wild-magnet merge-6: SWOOP was not active, starting fallback text animation');
              showMagneticText();
            }
            devLog('🧲 Final wild-magnet merge-6: waiting for SWOOP text animation before clean board');
            await waitForMagneticTextComplete();
            // Idempotent second pass for safety in case anything recreated during wait.
            cleanupFinalMagnetBoardArtifacts();
            cleanupFinalGhostsAndLocked();
          }
          
          // 🔥 FINAL WILD ANIMATION WAIT: let wild visuals finish before clean board
          const isFinalTntMerge = srcSpecialMerge6 === 'wild-tnt' || dstSpecialMerge6 === 'wild-tnt';
          const isFinalJuiceMerge = srcSpecialMerge6 === 'wild-juice' || dstSpecialMerge6 === 'wild-juice';
          const isFinalWildStarMerge = (srcSpecialMerge6 === 'wild' || dstSpecialMerge6 === 'wild') && !isFinalJuiceMerge && !isFinalTntMerge;
          const waitForWildFinaleAnimations = async () => {
            const deadline = Date.now() + 5200;
            const waitWhile = async (check: () => boolean, label: string) => {
              if (!check()) return;
              devLog(`⏳ Waiting for ${label} to finish before clean board`);
              while (check() && Date.now() < deadline) {
                await waitTracked(120);
              }
            };
            if (isFinalTntMerge && isTntAnimationActive?.()) {
              await new Promise<void>((resolve) => {
                let done = false;
                const finish = () => { if (done) return; done = true; resolve(); };
                try { onTntAnimationComplete?.(finish); } catch {}
                trackAppTimeout(finish, 5200);
              });
            }
            if (isFinalJuiceMerge) {
              await waitWhile(() => !!isWildJuiceBubblesExplosionActive?.(), 'wild-juice bubbles');
            }
            if (isFinalWildStarMerge) {
              await waitWhile(() => !!isSparkleTextActive?.(), 'sparkle text');
            }
          };
          await waitForWildFinaleAnimations();
          
          // 🔥 CRITICAL: Use triggerCleanBoardFlow (same entry as moves depleted / checkLevelEnd) so modal shows consistently
          devLog('🚨🚨🚨 SOURCE OF TRUTH: Final merge-6 - triggering clean board flow via triggerCleanBoardFlow (NO spawn)');
          
          // Reset wild meter locally (triggerCleanBoardFlow also resets it; this keeps state in sync before call)
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
            devWarn('⚠️ Failed to reset wild meter:', error);
          }

          await triggerCleanBoardFlow('clean_board_from_last_merge');
          
          return; // Exit early - don't spawn new tiles (SOURCE OF TRUTH: Final merge-6 = NO spawn)
        }
        
        // 🔥 CRITICAL FIX: Don't trigger clean board if pulled tiles will merge (new tiles will spawn)
        if (willPulledTilesMerge) {
          devLog('🧲 Pulled tiles will merge - this is NOT last merge (new tiles will spawn), clearing _isLastMerge flag');
          // Clear the flag since new tiles will spawn
          (dst as any)._isLastMerge = false;
          // Don't trigger clean board - pulled tiles merge will handle spawn and endgame check
        }
        
        // Use multiplier for spawning new tiles
        let spawnMult = mult;
        
        // 🔥 SOURCE OF TRUTH: Wild Juice & Wild Star spawn logic
        // Case A — Board continues: Apply wild effect normally, after Merge-6, respect Single Spawn Rule (1 tile on merge cell)
        // Case B — Board ends: If Merge-6 is the finishing state, trigger CLEAN BOARD, do NOT spawn a new tile
        // 🔥 CRITICAL: If final merge-6 (_isLastMerge flag), do NOT spawn (handled above by early return)
        // 🔥 CRITICAL: If endgame mode (no locked tiles), spawn ONLY 1 tile (handled by shouldSpawnAtDst logic)
        // This code only handles reducing spawnMult for wild merges in endgame mode (if not final merge-6)
        const isWildMergeForMultFix = srcSpecial === 'wild' || dstSpecial === 'wild' || 
                                      srcSpecial === 'wild-juice' || dstSpecial === 'wild-juice';
        const lockedTilesForMultCheck = tiles.filter(t => t && !t.destroyed && t.locked && (t.value | 0) <= 0).length;
        const isEndgameForMultCheck = lockedTilesForMultCheck === 0;
        
        // 🔥 SOURCE OF TRUTH: In endgame mode, wild merges spawn only 1 tile (Single Spawn Rule)
        // BUT: If final merge-6, spawnMult is already 0 (handled by _isLastMerge check above)
        if (isWildMergeForMultFix && isEndgameForMultCheck && spawnMult > 1 && !isLastMergeFlagSet) {
          devLog('🔥 SOURCE OF TRUTH: Wild merge in endgame mode → reducing spawnMult from', spawnMult, 'to 1 (Single Spawn Rule)');
          spawnMult = 1; // Spawn only 1 tile in endgame mode (Single Spawn Rule)
        }
        
        // 🔥 CRITICAL: Check if spawnMult is valid before proceeding
        if (!spawnMult || spawnMult <= 0) {
          devWarn('⚠️ SPAWN BLOCKED: spawnMult is invalid:', spawnMult, 'mult:', mult);
          merge6SpawnInProgress = false;
          merge6SpawnInProgressIsWild = false;
          if (merge6SpawnResetTimer) {
            try { merge6SpawnResetTimer.kill(); } catch {}
            merge6SpawnResetTimer = null;
          }
          return;
        }
        
        // 🔥 BUG FIX: Block rapid duplicate spawns ONLY for wild merge-6.
        // Regular merge-6 should remain responsive even if a wild merge animation is still running.
        const isWildMerge6 =
          srcSpecial === 'wild' || dstSpecial === 'wild' ||
          srcSpecial === 'wild-magnet' || dstSpecial === 'wild-magnet' ||
          srcSpecial === 'wild-juice' || dstSpecial === 'wild-juice' ||
          srcSpecial === 'wild-tnt' || dstSpecial === 'wild-tnt';
        if (merge6SpawnInProgress) {
          if (isWildMerge6) {
            devWarn('🚨🚨🚨 SPAWN BLOCKED: Wild merge-6 spawn already in progress - preventing duplicate spawn');
            devWarn('⚠️ This prevents bug where rapid wild star/juice clicks cause duplicate spawns');
            return;
          }
          devWarn('⚠️ Spawn already in progress, but allowing regular merge-6 for responsiveness');
        } else {
          merge6SpawnInProgress = true;
          merge6SpawnInProgressIsWild = isWildMerge6;
          devLog('✅ Set merge6SpawnInProgress = true to prevent duplicate spawns');
          if (merge6SpawnResetTimer) {
            try { merge6SpawnResetTimer.kill(); } catch {}
          }
          merge6SpawnResetTimer = trackDelayedCall(2.5, () => {
            if (merge6SpawnInProgress) {
              devWarn('⚠️ merge6SpawnInProgress timed out - forcing reset');
              merge6SpawnInProgress = false;
              merge6SpawnInProgressIsWild = false;
              if (merge6SpawnResetTimer) {
                try { merge6SpawnResetTimer.kill(); } catch {}
                merge6SpawnResetTimer = null;
              }
            }
            merge6SpawnResetTimer = null;
          });
        }
        
        // 🔥 CRITICAL: Get pulled cells from dst tile to exclude from normal spawn
        // Only valid for wild-magnet merges; stale flags can block spawns in regular merges.
        let pulledCells = (dst as any)?._wildMagnetPulledCells || [];
        if (!isWildMagnet && !(dst as any)?._wasWildMagnetMerge6) {
          // Stale magnet data should never affect regular merge spawns
          pulledCells = [];
          if ((dst as any)?._wildMagnetPulledCells) {
            delete (dst as any)._wildMagnetPulledCells;
          }
        }
        const pulledCellsSet = new Set<string>(pulledCells.map((cell: { c: number; r: number }) => `${cell.c},${cell.r}`));
        
        // 🔥 DEBUG: Detailed spawn check for all merge-6 types
        const mergeType = !wildActive ? 'regular-regular' : 
                         (srcSpecial === 'wild' || dstSpecial === 'wild') ? 'wild-regular' :
                         (srcSpecial === 'wild-juice' || dstSpecial === 'wild-juice') ? 'wild-juice-regular' :
                         (srcSpecial === 'wild-magnet' || dstSpecial === 'wild-magnet') ? 'wild-magnet-regular' : 'unknown';
        
        const activeTilesCount = tiles.filter(tileIsActive).length;
        
        devLog('🎯🎯🎯 SPAWN CHECK FOR MERGE-6:', {
          mergeType,
          srcSpecial,
          dstSpecial,
          spawnMult,
          mult,
          wasWild: wildActive,
          isWildJuice: srcSpecial === 'wild-juice' || dstSpecial === 'wild-juice',
          isWildMagnet: srcSpecial === 'wild-magnet' || dstSpecial === 'wild-magnet',
          isWild: srcSpecial === 'wild' || dstSpecial === 'wild',
          willSpawn: spawnMult > 0,
          activeTilesCount,
          isLastMergeFlagSet,
          _wasWildMerge: (dst as any)?._wasWildMerge
        });
        
        devLog('🎯 Spawning new tiles with multiplier:', spawnMult);
        devLog('🎯 Excluding pulled cells from spawn:', pulledCells);
        devLog('🎯 Wild merge target (for smart spawn):', wildMergeTarget);
        devLog('🎯 Merge type check:', {
          srcSpecial,
          dstSpecial,
          wasWild: wildActive,
          isWildJuice: srcSpecial === 'wild-juice' || dstSpecial === 'wild-juice',
          isWildMagnet: srcSpecial === 'wild-magnet' || dstSpecial === 'wild-magnet',
          isWild: srcSpecial === 'wild' || dstSpecial === 'wild'
        });
        
        // 🔥 SOURCE OF TRUTH: Endgame Mode Detection
        // Endgame mode begins when: There are no available locked / armored slots left for spawning new normal dice
        // 🔥 CRITICAL: Check if there are locked tiles available for spawn (excluding placeholder at dst position)
        // 🔥 BUG FIX: Count ALL locked tiles (not just value<=0) - must match level-flow.ts openLockedBounceParallel.
        // Locked tiles with value>0 (e.g. from wild merge) are openable; excluding them caused false isEndgameMode
        // and only 1 spawn when randomEmptyCell returned null (it doesn't consider locked value>0 as "empty").
        // Use raw locked tiles for endgame detection (scale can be missing on some locked tiles)
        const lockedTilesRaw = tiles.filter(t => t && !t.destroyed && t.locked);
        const lockedTiles = lockedTilesRaw.filter((t: any) => t && (t as any).scale);
        const placeholderHolderRef = (dst as any)?._placeholderHolder;
        
        // Filter out placeholder at dst position and pulled cells
        const availableLockedTiles = lockedTilesRaw.filter((t: any) => {
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
        
        // 🔥 SOURCE OF TRUTH: Endgame Mode = no available locked tiles
        const isEndgameMode = availableLockedTiles.length === 0;
        
        // 🔥 DEBUG: Log endgame mode detection
        devLog('🎮 ENDGAME CHECK:', {
          lockedTilesCount: lockedTilesRaw.length,
          spawnableLockedTilesCount: lockedTiles.length,
          availableLockedTilesCount: availableLockedTiles.length,
          isEndgameMode,
          totalActiveTiles: tiles.filter(t => t && !t.destroyed && !t.locked).length,
          spawnMult
        });

        // 🔥 Wild-merge bonus:
        // - wild star / TNT / magnet: spawn 9 locked, open 3 → result: 3 active + 6 locked
        // - wild juice: spawn 3 locked, open 2 → result: 2 active + 3 locked
        // isWildMerge6 already declared above (spawn-block check)
        let wildMergeLockedBonusCount = 0;
        if (isWildMerge6 && !isLastMergeFlagSet) {
          const isWildJuiceMerge6 = srcSpecialMerge6 === 'wild-juice' || dstSpecialMerge6 === 'wild-juice';
          wildMergeLockedBonusCount = isWildJuiceMerge6 ? 3 : 9;
        }
        
        const isRegularMerge6 = !isWildMerge6;
        // 🔥 BUG FIX (Journey / magnet / locked boards): Do NOT spawn-at-dst just because activeTilesCount ≤ 3.
        // While ANY spawnable locked tiles exist (isEndgameMode === false), merge-6 must STAY on the board and
        // new cubes must come from openLockedBounceParallel / randomEmptyCell. Old logic replaced merge 6 with
        // a fresh spawn at the same cell → removed the 6, broke visuals (ghost/no pips), false fail screen.
        // Spawn-at-merge-cell is ONLY for true endgame: no available locked placeholders left to open.
        const shouldSpawnAtDst =
          !isLastMergeFlagSet &&
          spawnMult > 0 &&
          isEndgameMode;

        const isWildMagnetMerge6Spawn =
          srcSpecialMerge6 === 'wild-magnet' || dstSpecialMerge6 === 'wild-magnet';
        const isWildTntMerge6Spawn =
          srcSpecialMerge6 === 'wild-tnt' || dstSpecialMerge6 === 'wild-tnt';
        const isWildJuiceMerge6Spawn =
          srcSpecialMerge6 === 'wild-juice' || dstSpecialMerge6 === 'wild-juice';

        /** Wild star merge opens k extra locked tiles — must run AFTER primary wild openLockedBounceParallel finishes (no parallel race on same locks). */
        const runWildStarExtraLockedOpens = async (): Promise<void> => {
          if (!isWildMerge6 || isLastMergeFlagSet || isWildMagnetMerge6Spawn || isWildTntMerge6Spawn) return;
          const wildExtraActiveCount = isWildJuiceMerge6Spawn ? 0 : 3;
          if (wildExtraActiveCount <= 0) return;
          const wildSpawnExcludeCells = shouldSpawnAtDst
            ? new Set([...pulledCellsSet, `${gx},${gy}`])
            : pulledCellsSet;
          try {
            await FLOW.openLockedBounceParallel({
              tiles: Array.isArray(STATE.tiles) ? STATE.tiles : tiles,
              k: wildExtraActiveCount,
              drag,
              makeBoard,
              gsap,
              drawBoardBG,
              TILE,
              fixHoverAnchor,
              spawnBounce: (t, done, o) => SPAWN.spawnBounce(t, gsap, o, done),
              wildMergeTarget,
              excludeCells: wildSpawnExcludeCells,
              // Same as regular merge-6: if merge cell still has a locked placeholder, open it first (exclude wins if dst excluded)
              preferCells: new Set<string>([`${gx},${gy}`]),
            } as any);
          } catch (err) {
            devWarn('⚠️ Wild merge extra spawn failed:', err);
          }
        };

        const scheduleSpawnOpacitySafetySweep = () => {
          trackAppTimeout(() => {
            try {
              let fixed = 0;
              for (const t of tiles) {
                if (!t || t.destroyed) continue;
                // Nearly invisible locked ice (race with FX) — restore faint locked alpha
                if (
                  t.locked &&
                  ((t.value | 0) <= 0) &&
                  t.visible !== false &&
                  ((t.alpha ?? 1) < 0.08)
                ) {
                  t.alpha = 0.2;
                  fixed++;
                }
                if (t.locked || (t.value | 0) <= 0) continue;
                const spec = (t as any).special;
                if (spec === 'wild' || spec === 'wild-magnet' || spec === 'wild-juice' || spec === 'wild-tnt') continue;
                if ((t.alpha ?? 1) < 0.99) {
                  t.alpha = 1;
                  if ((t as any).rotG) (t as any).rotG.alpha = 1;
                  if ((t as any).base) (t as any).base.alpha = 1;
                  if ((t as any).overlay) {
                    (t as any).overlay.alpha = 1;
                    (t as any).overlay.visible = false;
                  }
                  if ((t as any).num) (t as any).num.alpha = 1;
                  if ((t as any).pips) (t as any).pips.alpha = 1;
                  fixed++;
                }
                const p = (t as any).pips;
                if (p && !p.destroyed && (t.value | 0) > 0 && p.visible === false) {
                  p.visible = true;
                  fixed++;
                }
              }
              if (fixed > 0) devLog('[SPAWN-OPACITY] Safety sweep: fixed', fixed, 'tiles');
            } catch {}
          }, 600);
        };

        if (shouldSpawnAtDst) {
          const endgameSpawnCount = 1; // Endgame: always 1 at merge cell (regular + wild)
          pendingMandatoryMergeCellSpawn = {
            c: gx | 0,
            r: gy | 0,
            expiresAt: Date.now() + 2500
          };
          devLog('🎯🎯🎯 END-GAME/LOW-TILE SPAWN: spawning', endgameSpawnCount, 'tile(s) at merge-6 cell (', gx, ',', gy, ')');
          devLog('🎯 Spawn-at-dst reason:', {
            isEndgameMode,
            activeTilesCount,
            note: 'merge-cell spawn only when no locked tiles left to open',
          });
          
          // Remove placeholder if it exists (we'll spawn active tile instead)
          if (placeholderHolderRef && !placeholderHolderRef.destroyed) {
            devLog('🧹 Removing placeholder before spawning active tile at dst position');
            if (placeholderHolderRef.gridX !== undefined && placeholderHolderRef.gridY !== undefined && grid && grid[placeholderHolderRef.gridY]) {
              grid[placeholderHolderRef.gridY][placeholderHolderRef.gridX] = null;
            }
            removeTile(placeholderHolderRef);
            (dst as any)._placeholderHolder = undefined;
          }
          
          const spawnC = gx;
          const spawnR = gy;
          
          // Force-clear grid position before spawn
          if (grid && grid[spawnR] && grid[spawnR][spawnC]) {
            const tileAtPos = grid[spawnR][spawnC];
            if (tileAtPos) {
              devLog('🧹 END-GAME SPAWN: Force-clearing cell before spawn');
              grid[spawnR][spawnC] = null;
              if (!tileAtPos.destroyed && tiles.includes(tileAtPos)) removeTile(tileAtPos);
            }
          }
          
          trackAppTimeout(() => {
            const forceClearSpawnCell = () => {
              if (grid && grid[spawnR] && grid[spawnR][spawnC]) {
                const existing = grid[spawnR][spawnC];
                if (existing) {
                  grid[spawnR][spawnC] = null;
                  if (!existing.destroyed && tiles.includes(existing)) removeTile(existing);
                }
              }
              // Also scrub any lingering tile that still claims the spawn coords (even if grid was cleared)
              for (const t of tiles) {
                if (!t || t.destroyed) continue;
                if ((t.gridX | 0) === (spawnC | 0) && (t.gridY | 0) === (spawnR | 0)) {
                  try { removeTile(t); } catch {}
                  break;
                }
              }
            };
            const hardSpawnAtCell = () => {
              try {
                if (grid && grid[spawnR] && grid[spawnR][spawnC]) {
                  grid[spawnR][spawnC] = null;
                }
                const t = makeBoard?.createTile?.({ board, grid, tiles, c: spawnC, r: spawnR, val: 0, locked: true });
                if (!t) return false;
                t.locked = false;
                t.eventMode = 'static';
                t.cursor = 'pointer';
                bindTileWithFallback(t, false);
                resetTileToNormalState(t);
                const spawnValue = (wildMergeTarget ? (() => {
                  const candidates = [1,2,3,4,5].filter(v => v !== wildMergeTarget);
                  return candidates[(Math.random() * candidates.length) | 0];
                })() : [1,2,3,4,5][(Math.random() * 5) | 0]);
                makeBoard?.setValue?.(t, spawnValue, 0);
                t.visible = true;
                SPAWN?.spawnBounce?.(t, gsap, { max: 1.08, compress: 0.96, rebound: 1.02, startScale: 0.30, wiggle: 0.035, fadeIn: 0.10, timeScale: 2.0, keepFullOpacity: true });
                return true;
              } catch (err) {
                devWarn('⚠️ END-GAME SPAWN: hardSpawnAtCell failed', err);
                return false;
              }
            };
            const runSpawn = (retry = false) => {
              forceClearSpawnCell();
              return openAtCell(spawnC, spawnR, {
                value: (wildMergeTarget ? (() => {
                  const candidates = [1,2,3,4,5].filter(v => v !== wildMergeTarget);
                  return candidates[(Math.random() * candidates.length) | 0];
                })() : null),
                skipBind: false,
                timeScale: 2.0,
                forceFreshPlaceholder: true,
              });
            };
          const doEndgameSpawns = async () => {
            let firstResult = await runSpawn();
            if (!firstResult) {
              forceClearSpawnCell();
              firstResult = await runSpawn(true);
            }
            if (!firstResult) {
              devWarn('⚠️ END-GAME SPAWN: Retry failed at (', spawnC, ',', spawnR, ')', '- forcing hard spawn');
              const hardOk = hardSpawnAtCell();
              if (!hardOk) devWarn('⚠️ END-GAME SPAWN: hard spawn also failed at (', spawnC, ',', spawnR, ')');
            }
            const hasActiveTileAtMergeCell = () => {
              return tiles.some((t: any) => {
                if (!t || t.destroyed) return false;
                if ((t.gridX | 0) !== (spawnC | 0) || (t.gridY | 0) !== (spawnR | 0)) return false;
                const value = (t.value | 0);
                return value > 0 || t.special === 'wild' || t.special === 'wild-magnet' || t.special === 'wild-juice' || t.special === 'wild-tnt';
              });
            };
            if (!hasActiveTileAtMergeCell()) {
              devWarn('🚨 END-GAME/LOW-TILE SPAWN VERIFY: merge cell still empty, forcing hard spawn at dst');
              const forcedOk = hardSpawnAtCell();
              if (!forcedOk) {
                devWarn('🚨 END-GAME/LOW-TILE SPAWN VERIFY: hard spawn failed, attempting final retry via openAtCell');
                await runSpawn(true);
              }
            }
            if (hasActiveTileAtMergeCell()) {
              pendingMandatoryMergeCellSpawn = null;
            }
            // 🔥 WILD-JUICE ENDGAME: ensure total 3 active tiles (1 at dst + 2 extra)
            const isWildJuiceMerge6 = srcSpecialMerge6 === 'wild-juice' || dstSpecialMerge6 === 'wild-juice';
            const isWildMerge6Local =
              srcSpecialMerge6 === 'wild' || dstSpecialMerge6 === 'wild' ||
              srcSpecialMerge6 === 'wild-magnet' || dstSpecialMerge6 === 'wild-magnet' ||
              srcSpecialMerge6 === 'wild-juice' || dstSpecialMerge6 === 'wild-juice' ||
              srcSpecialMerge6 === 'wild-tnt' || dstSpecialMerge6 === 'wild-tnt';
            if (isWildMerge6Local && isWildJuiceMerge6) {
              const extraExclude: { r: number; c: number }[] = [{ r: spawnR, c: spawnC }];
              for (let i = 0; i < 2; i++) {
                const extraCell = randomEmptyCell(extraExclude);
                if (extraCell) {
                  extraExclude.push({ r: extraCell.r, c: extraCell.c });
                  await openAtCell(extraCell.c, extraCell.r, {
                    value: wildMergeTarget ? (() => {
                      const candidates = [1,2,3,4,5].filter(v => v !== wildMergeTarget);
                      return candidates[(Math.random() * candidates.length) | 0];
                    })() : null,
                    skipBind: false,
                    timeScale: 2.0,
                    forceFreshPlaceholder: true,
                  });
                } else {
                  devLog('🎯 END-GAME WILD-JUICE: No empty cell for extra active spawn');
                }
              }
            }
            await runWildStarExtraLockedOpens();
            scheduleSpawnOpacitySafetySweep();
          };
            doEndgameSpawns().catch((err) => devWarn('⚠️ END-GAME SPAWN: Error:', err)).finally(() => {
              merge6SpawnInProgress = false;
              merge6SpawnInProgressIsWild = false;
              if (merge6SpawnResetTimer) { try { merge6SpawnResetTimer.kill(); } catch {} merge6SpawnResetTimer = null; }
            });
          }, 50);
        } else {
          // NORMAL MODE: NEW SIMPLE LOGIC for regular merge-6
          // Always spawn tiles on RANDOM locked tiles (not at merge cell).
          // Regular merge-6: base 2, but if stack is bigger, spawn up to 3.
          if (isRegularMerge6) {
            const regularSpawnCount = Math.min(3, Math.max(2, (spawnMult || 0) - 1));
            const tilesForSpawn = Array.isArray(STATE.tiles) ? STATE.tiles : tiles;
            const spawnFromLocked = async () => {
              const preferMergeCellSet = new Set<string>([`${gx},${gy}`]);
              devWarn('🧪 DEBUG REGULAR_MERGE6_RANDOM_LOCKED_SPAWN: entered', {
                regularSpawnCount,
                spawnMult,
                pulledCellsExcluded: pulledCellsSet.size,
                lockedCandidates: tilesForSpawn.filter((t: any) => t && !t.destroyed && t.locked).length,
                mergeCell: { c: gx, r: gy },
              });

              const pickSpawnValue = () => (wildMergeTarget
                ? (() => {
                    const candidates = [1,2,3,4,5].filter(v => v !== wildMergeTarget);
                    return candidates[(Math.random() * candidates.length) | 0];
                  })()
                : [1,2,3,4,5][(Math.random()*5)|0]);

              const normalizeSpawnedTileVisual = (tile: any) => {
                if (!tile) return;
                tile.alpha = 1;
                if (tile.rotG) tile.rotG.alpha = 1;
                if (tile.base) tile.base.alpha = 1;
                if (tile.overlay) {
                  tile.overlay.alpha = 1;
                  tile.overlay.visible = false;
                }
                if (tile.num) tile.num.alpha = 1;
                if (tile.pips) {
                  tile.pips.alpha = 1;
                  tile.pips.visible = true;
                }
              };

              const remainingSpawnCount = Math.max(0, regularSpawnCount);

              const ensureMinimumActiveTilesAfterSpawn = async () => {
                const activeNow = tilesForSpawn.filter(tileIsActive).length;
                if (activeNow >= 2) return;
                devWarn('⚠️ NORMAL SPAWN SAFETY: Too few active tiles after merge-6 spawn, forcing one extra open', {
                  activeNow,
                  regularSpawnCount
                });
                const emergencyOpened = await FLOW.openLockedBounceParallel({
                  tiles: tilesForSpawn,
                  k: 1,
                  drag,
                  makeBoard,
                  gsap,
                  drawBoardBG,
                  TILE,
                  fixHoverAnchor,
                  spawnBounce: (t, done, o) => SPAWN.spawnBounce(t, gsap, o, done),
                  wildMergeTarget,
                  excludeCells: pulledCellsSet,
                  preferCells: preferMergeCellSet,
                } as any);
                if ((emergencyOpened || 0) > 0) return;

                const mergeKeyEmergency = `${gx},${gy}`;
                const lockedForEmergency = tilesForSpawn.filter((t: any) => {
                  if (!t || t.destroyed || !t.locked) return false;
                  if (typeof t.gridX === 'number' && typeof t.gridY === 'number') {
                    const key = `${t.gridX},${t.gridY}`;
                    if (pulledCellsSet.has(key)) return false;
                  }
                  return true;
                });
                lockedForEmergency.sort((a: any, b: any) => {
                  const aAt =
                    typeof a.gridX === 'number' &&
                    typeof a.gridY === 'number' &&
                    `${a.gridX},${a.gridY}` === mergeKeyEmergency
                      ? 0
                      : 1;
                  const bAt =
                    typeof b.gridX === 'number' &&
                    typeof b.gridY === 'number' &&
                    `${b.gridX},${b.gridY}` === mergeKeyEmergency
                      ? 0
                      : 1;
                  return aAt - bAt;
                });
                const fallbackLocked = lockedForEmergency[0];
                if (!fallbackLocked) return;
                try {
                  fallbackLocked.locked = false;
                  fallbackLocked.eventMode = 'static';
                  fallbackLocked.cursor = 'pointer';
                  resetTileToNormalState?.(fallbackLocked);
                  if (drag && typeof drag.bindToTile === 'function') drag.bindToTile(fallbackLocked);
                  const emergencyValue = pickSpawnValue();
                  makeBoard?.setValue?.(fallbackLocked, emergencyValue, 0, { immediate: true });
                  normalizeSpawnedTileVisual(fallbackLocked);
                  try { fixHoverAnchor?.(fallbackLocked); } catch {}
                  devWarn('🛡️ NORMAL SPAWN SAFETY: Forced unlock fallback succeeded');
                } catch (err) {
                  devWarn('⚠️ NORMAL SPAWN SAFETY: Forced unlock fallback failed', err);
                }
              };
              try {
                const excludeSetDebug = new Set([...pulledCellsSet]);
                const lockedRawDebug = tilesForSpawn.filter((t: any) => t && !t.destroyed && t.locked);
                const lockedWithScaleDebug = lockedRawDebug.filter((t: any) => t && (t as any).scale);
                const lockedExcludedDebug = lockedRawDebug.filter((t: any) => {
                  if (typeof t.gridX === 'number' && typeof t.gridY === 'number') {
                    return excludeSetDebug.has(`${t.gridX},${t.gridY}`);
                  }
                  return false;
                });
                devLog('🧪 SPAWN DEBUG (regular merge-6):', {
                  regularSpawnCount,
                  lockedRaw: lockedRawDebug.length,
                  lockedWithScale: lockedWithScaleDebug.length,
                  lockedExcluded: lockedExcludedDebug.length,
                  excludeCells: Array.from(excludeSetDebug).slice(0, 6),
                });
              } catch {}
              const forceUnlockLockedTiles = async (k: number) => {
                if (!k || k <= 0) return 0;
                const excludeSet = new Set([...pulledCellsSet]);
                const mergeKey = `${gx},${gy}`;
                const lockedCandidates = tilesForSpawn.filter((t: any) => {
                  if (!t || t.destroyed || !t.locked) return false;
                  if (typeof t.gridX === 'number' && typeof t.gridY === 'number') {
                    const key = `${t.gridX},${t.gridY}`;
                    if (excludeSet.has(key)) return false;
                  }
                  return true;
                });
                if (!lockedCandidates.length) return 0;
                lockedCandidates.sort((a: any, b: any) => {
                  const aAtMerge =
                    typeof a.gridX === 'number' &&
                    typeof a.gridY === 'number' &&
                    `${a.gridX},${a.gridY}` === mergeKey
                      ? 0
                      : 1;
                  const bAtMerge =
                    typeof b.gridX === 'number' &&
                    typeof b.gridY === 'number' &&
                    `${b.gridX},${b.gridY}` === mergeKey
                      ? 0
                      : 1;
                  return aAtMerge - bAtMerge;
                });
                let opened = 0;
                for (let i = 0; i < lockedCandidates.length && opened < k; i++) {
                  const t = lockedCandidates[i];
                  try {
                    t.locked = false;
                    t.eventMode = 'static';
                    t.cursor = 'pointer';
                    resetTileToNormalState?.(t);
                    if (drag && typeof drag.bindToTile === 'function') drag.bindToTile(t);
                    const spawnValue = pickSpawnValue();
                    makeBoard?.setValue?.(t, spawnValue, 0, { immediate: true });
                    normalizeSpawnedTileVisual(t);
                    try { fixHoverAnchor?.(t); } catch {}
                    opened++;
                  } catch (err) {
                    devWarn('⚠️ FORCE UNLOCK failed:', err);
                  }
                }
                return opened;
              };
              let opened = await FLOW.openLockedBounceParallel({
                tiles: tilesForSpawn,
                k: remainingSpawnCount,
                drag,
                makeBoard,
                gsap,
                drawBoardBG,
                TILE,
                fixHoverAnchor,
                spawnBounce: (t, done, o) => SPAWN.spawnBounce(t, gsap, o, done),
                wildMergeTarget,
                excludeCells: pulledCellsSet,
                preferCells: preferMergeCellSet,
              } as any);
              if ((opened || 0) === 0 && remainingSpawnCount > 0) {
                devWarn('⚠️ NORMAL SPAWN: openLockedBounceParallel opened 0, forcing unlock of locked tiles');
                const forcedOpened = await forceUnlockLockedTiles(remainingSpawnCount);
                opened += (forcedOpened || 0);
              }
              const remainder = Math.max(0, remainingSpawnCount - (opened || 0));
              devLog(`🧪 SPAWN QA (regular): requested=${regularSpawnCount} opened=${opened || 0} remainder=${remainder}`);
              if (remainder > 0) {
                const excludeCells: { r: number; c: number }[] = [{ r: gy, c: gx }];
                for (let i = 0; i < remainder; i++) {
                  const cell = randomEmptyCell(excludeCells);
                  if (cell) {
                    excludeCells.push({ r: cell.r, c: cell.c });
                    await openAtCell(cell.c, cell.r, {
                      value: wildMergeTarget ? (() => {
                        const candidates = [1,2,3,4,5].filter(v => v !== wildMergeTarget);
                        return candidates[(Math.random() * candidates.length) | 0];
                      })() : null,
                      skipBind: false,
                      timeScale: 2.0,
                      forceFreshPlaceholder: true,
                    });
                  } else {
                    devLog('🎯 NORMAL SPAWN: No empty cell found, opening 1 locked tile as fallback');
                    await FLOW.openLockedBounceParallel({
                      tiles: tilesForSpawn,
                      k: 1,
                      drag,
                      makeBoard,
                      gsap,
                      drawBoardBG,
                      TILE,
                      fixHoverAnchor,
                      spawnBounce: (t, done, o) => SPAWN.spawnBounce(t, gsap, o, done),
                      wildMergeTarget,
                      excludeCells: pulledCellsSet,
                      preferCells: preferMergeCellSet,
                    } as any);
                  }
                }
              }
              await ensureMinimumActiveTilesAfterSpawn();
              scheduleSpawnOpacitySafetySweep();
            };

            trackAppTimeout(() => {
              Promise.resolve()
                .then(spawnFromLocked)
                .catch((err) => devWarn('⚠️ NORMAL SPAWN: Error:', err))
                .finally(() => {
                  merge6SpawnInProgress = false;
                  merge6SpawnInProgressIsWild = false;
                  if (merge6SpawnResetTimer) { try { merge6SpawnResetTimer.kill(); } catch {} merge6SpawnResetTimer = null; }
                });
            }, 50);
          } else {
            // Non-regular (wild) normal mode: fresh tile at merge cell first, then locked opens (no preferCells unlock).
            const tilesForSpawn = Array.isArray(STATE.tiles) ? STATE.tiles : tiles;
            const pickSpawnValueWild = () => (wildMergeTarget
              ? (() => {
                  const candidates = [1, 2, 3, 4, 5].filter(v => v !== wildMergeTarget);
                  return candidates[(Math.random() * candidates.length) | 0];
                })()
              : [1, 2, 3, 4, 5][(Math.random() * 5) | 0]);

            const refillWildMergeCellFresh = async (): Promise<number> => {
              try {
                const at = tilesForSpawn.find((t: any) =>
                  t && !t.destroyed && (t.gridX | 0) === (gx | 0) && (t.gridY | 0) === (gy | 0)
                );
                if (at) {
                  const spec = (at as any).special;
                  const isActive = !at.locked && (
                    (at.value | 0) > 0 ||
                    spec === 'wild' || spec === 'wild-magnet' || spec === 'wild-juice' || spec === 'wild-tnt'
                  );
                  if (isActive) return 1;
                  try {
                    if (grid?.[gy]?.[gx] === at) grid[gy][gx] = null;
                    if (!at.destroyed && tilesForSpawn.includes(at)) removeTile(at);
                  } catch (err) {
                    devWarn('⚠️ WILD SPAWN: Failed to remove merge-6 placeholder', err);
                  }
                }
              } catch (err) {
                devWarn('⚠️ WILD SPAWN: merge cell prep failed', err);
              }
              try {
                const ok = await openAtCell(gx, gy, {
                  value: pickSpawnValueWild(),
                  skipBind: false,
                  timeScale: 2.0,
                  forceFreshPlaceholder: true,
                });
                return ok ? 1 : 0;
              } catch {
                return 0;
              }
            };

            const excludeWildMerge = new Set([...pulledCellsSet, `${gx},${gy}`]);
            void (async () => {
              let mergeCellWild = 0;
              try {
                mergeCellWild = await refillWildMergeCellFresh();
                const kLocked = Math.max(0, (spawnMult | 0) - mergeCellWild);
                devLog('🚀 NORMAL SPAWN (wild): mergeCellFresh=', mergeCellWild, 'kLocked=', kLocked, 'spawnMult=', spawnMult, 'locked pool:', tilesForSpawn.filter((t: any) => t && !t.destroyed && t.locked).length);
                const openedCount = await FLOW.openLockedBounceParallel({
                  tiles: tilesForSpawn,
                  k: kLocked,
                  drag,
                  makeBoard,
                  gsap,
                  drawBoardBG,
                  TILE,
                  fixHoverAnchor,
                  spawnBounce: (t, done, o) => SPAWN.spawnBounce(t, gsap, o, done),
                  wildMergeTarget,
                  excludeCells: excludeWildMerge,
                } as any);
                const openedFromLocked = openedCount || 0;
                const opened = mergeCellWild + openedFromLocked;
                const remainder = spawnMult > 0 ? Math.max(0, spawnMult - opened) : 0;
                devLog(`🧪 SPAWN QA (wild/normal): requested=${spawnMult || 0} mergeCell=${mergeCellWild} lockedOpened=${openedFromLocked} total=${opened} remainder=${remainder}`);
                let remainderSpawned = 0;
                const ensureMinimumActiveTilesAfterSpawn = async () => {
                  const activeNow = (Array.isArray(STATE.tiles) ? STATE.tiles : tiles).filter(tileIsActive).length;
                  if (activeNow >= 2) return;
                  devWarn('⚠️ WILD/NORMAL SPAWN SAFETY: Too few active tiles after merge-6 spawn, forcing one extra open', {
                    activeNow,
                    spawnMult,
                    opened,
                    remainderSpawned
                  });
                  const emergencyOpened = await FLOW.openLockedBounceParallel({
                    tiles: Array.isArray(STATE.tiles) ? STATE.tiles : tiles,
                    k: 1,
                    drag,
                    makeBoard,
                    gsap,
                    drawBoardBG,
                    TILE,
                    fixHoverAnchor,
                    spawnBounce: (t, done, o) => SPAWN.spawnBounce(t, gsap, o, done),
                    wildMergeTarget,
                    excludeCells: excludeWildMerge,
                  } as any);
                  if ((emergencyOpened || 0) > 0) return;
                  const fallbackLocked = (Array.isArray(STATE.tiles) ? STATE.tiles : tiles).find((t: any) => t && !t.destroyed && t.locked);
                  if (!fallbackLocked) return;
                  try {
                    fallbackLocked.locked = false;
                    fallbackLocked.eventMode = 'static';
                    fallbackLocked.cursor = 'pointer';
                    resetTileToNormalState?.(fallbackLocked);
                    if (drag && typeof drag.bindToTile === 'function') drag.bindToTile(fallbackLocked);
                    const emergencyValue = wildMergeTarget
                      ? (() => {
                          const candidates = [1,2,3,4,5].filter(v => v !== wildMergeTarget);
                          return candidates[(Math.random() * candidates.length) | 0];
                        })()
                      : [1,2,3,4,5][(Math.random()*5)|0];
                    makeBoard?.setValue?.(fallbackLocked, emergencyValue, 0, { immediate: true });
                    if (fallbackLocked) {
                      fallbackLocked.alpha = 1;
                      if (fallbackLocked.rotG) fallbackLocked.rotG.alpha = 1;
                      if (fallbackLocked.base) fallbackLocked.base.alpha = 1;
                      if (fallbackLocked.overlay) {
                        fallbackLocked.overlay.alpha = 1;
                        fallbackLocked.overlay.visible = false;
                      }
                      if (fallbackLocked.num) fallbackLocked.num.alpha = 1;
                      if (fallbackLocked.pips) {
                        fallbackLocked.pips.alpha = 1;
                        fallbackLocked.pips.visible = true;
                      }
                    }
                    try { fixHoverAnchor?.(fallbackLocked); } catch {}
                    devWarn('🛡️ WILD/NORMAL SPAWN SAFETY: Forced unlock fallback succeeded');
                  } catch (err) {
                    devWarn('⚠️ WILD/NORMAL SPAWN SAFETY: Forced unlock fallback failed', err);
                  }
                };
                if (remainder > 0) {
                  logger.warn('🚀 NORMAL SPAWN: Spawning ' + remainder + ' remainder (opened ' + openedFromLocked + ' from locked)', 'app-core', { remainder, openedFromLocked });
                  const remainderPromises: Promise<boolean>[] = [];
                  const excludeCells: { r: number; c: number }[] = [{ r: gy, c: gx }];
                  for (let i = 0; i < remainder; i++) {
                    await new Promise<void>(r => trackAppTimeout(r, 80 + i * 150));
                    let cell = randomEmptyCell(excludeCells);
                    if (cell) {
                      excludeCells.push({ r: cell.r, c: cell.c });
                      remainderPromises.push(openAtCell(cell.c, cell.r, {
                        value: wildMergeTarget ? (() => {
                          const candidates = [1,2,3,4,5].filter(v => v !== wildMergeTarget);
                          return candidates[(Math.random() * candidates.length) | 0];
                        })() : null,
                        skipBind: false,
                        timeScale: 2.0
                      }).then((ok: any) => !!ok).catch((err: any) => { devWarn('⚠️ Remainder spawn error:', err); return false; }));
                    } else {
                      logger.warn('🚀 NORMAL SPAWN: No empty cell, opening 1 locked tile as fallback', 'app-core');
                      const extraOpened = await FLOW.openLockedBounceParallel({
                        tiles: Array.isArray(STATE.tiles) ? STATE.tiles : tiles,
                        k: 1,
                        drag,
                        makeBoard,
                        gsap,
                        drawBoardBG,
                        TILE,
                        fixHoverAnchor,
                        spawnBounce: (t, done, o) => SPAWN.spawnBounce(t, gsap, o, done),
                        wildMergeTarget,
                        excludeCells: excludeWildMerge,
                      } as any);
                      remainderSpawned += (extraOpened || 0);
                      if ((extraOpened || 0) === 0) {
                        devWarn('⚠️ NORMAL SPAWN: Fallback openLockedBounceParallel opened 0 – only 1 tile spawned');
                      }
                    }
                  }
                  const remainderResults = await Promise.all(remainderPromises);
                  remainderSpawned += remainderResults.filter(Boolean).length;
                }
                // 🔥 WILD-JUICE SAFETY: Ensure 2 active spawns always happen (even if locked/empty cells were unavailable).
                const isWildJuiceMerge6 = srcSpecialMerge6 === 'wild-juice' || dstSpecialMerge6 === 'wild-juice';
                if (isWildJuiceMerge6 && spawnMult >= 2) {
                  let missing = Math.max(0, 2 - (opened + remainderSpawned));
                  if (missing > 0) {
                    devWarn('⚠️ WILD-JUICE: Active spawn shortfall detected - forcing extra spawns', {
                      opened,
                      remainderSpawned,
                      missing
                    });
                    const forceUnlockLockedTiles = async (k: number) => {
                      if (!k || k <= 0) return 0;
                      const excludeSet = new Set([...pulledCellsSet, `${gx},${gy}`]);
                      const lockedCandidates = tilesForSpawn.filter((t: any) => {
                        if (!t || t.destroyed || !t.locked) return false;
                        if (typeof t.gridX === 'number' && typeof t.gridY === 'number') {
                          const key = `${t.gridX},${t.gridY}`;
                          if (excludeSet.has(key)) return false;
                        }
                        return true;
                      });
                      if (!lockedCandidates.length) return 0;
                      let openedForced = 0;
                      for (let i = 0; i < lockedCandidates.length && openedForced < k; i++) {
                        const t = lockedCandidates[i];
                        try {
                          t.locked = false;
                          t.eventMode = 'static';
                          t.cursor = 'pointer';
                          resetTileToNormalState?.(t);
                          if (drag && typeof drag.bindToTile === 'function') drag.bindToTile(t);
                          const spawnValue = wildMergeTarget
                            ? (() => {
                                const candidates = [1,2,3,4,5].filter(v => v !== wildMergeTarget);
                                return candidates[(Math.random() * candidates.length) | 0];
                              })()
                            : [1,2,3,4,5][(Math.random()*5)|0];
                          makeBoard?.setValue?.(t, spawnValue, 0, { immediate: true });
                          if (t) {
                            t.alpha = 1;
                            if (t.rotG) t.rotG.alpha = 1;
                            if (t.base) t.base.alpha = 1;
                            if (t.overlay) {
                              t.overlay.alpha = 1;
                              t.overlay.visible = false;
                            }
                            if (t.num) t.num.alpha = 1;
                            if (t.pips) {
                              t.pips.alpha = 1;
                              t.pips.visible = true;
                            }
                          }
                          try { fixHoverAnchor?.(t); } catch {}
                          openedForced++;
                        } catch (err) {
                          devWarn('⚠️ WILD-JUICE FORCE UNLOCK failed:', err);
                        }
                      }
                      return openedForced;
                    };
                    const forcedOpened = await forceUnlockLockedTiles(missing);
                    missing = Math.max(0, missing - forcedOpened);
                    while (missing > 0) {
                      const cell = randomEmptyCell([{ r: gy, c: gx }]);
                      if (!cell) break;
                      const ok = await openAtCell(cell.c, cell.r, {
                        value: wildMergeTarget ? (() => {
                          const candidates = [1,2,3,4,5].filter(v => v !== wildMergeTarget);
                          return candidates[(Math.random() * candidates.length) | 0];
                        })() : null,
                        skipBind: false,
                        timeScale: 2.0
                      }).catch(() => false);
                      if (!ok) break;
                      missing--;
                    }
                    if (missing > 0) {
                      devWarn('⚠️ WILD-JUICE: Unable to fill active spawn shortfall', { missing });
                    }
                  }
                }
                await ensureMinimumActiveTilesAfterSpawn();
                await runWildStarExtraLockedOpens();
                await ensureMinimumActiveTilesAfterSpawn();
                scheduleSpawnOpacitySafetySweep();
              } catch (err) {
                devWarn('⚠️ WILD SPAWN error:', err);
              } finally {
                merge6SpawnInProgress = false;
                merge6SpawnInProgressIsWild = false;
                if (merge6SpawnResetTimer) { try { merge6SpawnResetTimer.kill(); } catch {} merge6SpawnResetTimer = null; }
              }
            })();
          }
        }

        if (wildMergeLockedBonusCount > 0) {
          devLog('🔒 Wild merge bonus: spawning locked tiles', wildMergeLockedBonusCount);
          // 🔥 ENDGAME: Exclude dst cell to prevent clash – we spawn 1 active tile there via openAtCell
          spawnLockedTilesWithPop(wildMergeLockedBonusCount, shouldSpawnAtDst ? [{ c: gx, r: gy }] : undefined);
          wildMergeLockedSpawnCount += 1;
        }

        // 🔥 CRITICAL FIX v40.1: Clean up unused placeholder if it wasn't used in spawn
        // Placeholder might not be used if spawnMult = 0 or if placeholder was excluded
        const placeholderHolderAfterSpawn = (dst as any)?._placeholderHolder;
        if (placeholderHolderAfterSpawn && !placeholderHolderAfterSpawn.destroyed) {
          // Check if placeholder is still locked (wasn't used in spawn)
          if (placeholderHolderAfterSpawn.locked && (placeholderHolderAfterSpawn.value | 0) === 0) {
            devLog('🧹 Cleaning up unused placeholder at (', placeholderHolderAfterSpawn.gridX, ',', placeholderHolderAfterSpawn.gridY, ')');
            
            // Remove from grid
            if (placeholderHolderAfterSpawn.gridX !== undefined && placeholderHolderAfterSpawn.gridY !== undefined && grid && grid[placeholderHolderAfterSpawn.gridY]) {
              grid[placeholderHolderAfterSpawn.gridY][placeholderHolderAfterSpawn.gridX] = null;
            }
            
            // Remove from tiles array
            removeTile(placeholderHolderAfterSpawn);
            
            devLog('✅ Unused placeholder removed successfully');
          } else {
            devLog('✅ Placeholder was used in spawn - no cleanup needed');
          }
          
          // Clear reference
          if (dst) {
            (dst as any)._placeholderHolder = undefined;
          }
        }
        
        // Post-spawn destination cleanup:
        // - merge-6 (except magnet-pull) removes dst after spawn choreography
        // - magnet-pull flow removes dst once pulled merge is completed
        
        // 🔥 CRITICAL: Use the EARLY stored flag value (saved before any code cleared it)
        // This ensures we correctly identify magnet pull merges even if flags were cleared
        // The flag was stored at the beginning of onComplete callback (line ~4975)
        const isMagnetPullMergeFinal = isMagnetPullMergeStored;

        // Utility: aggressively clear a tile reference from the grid even if gridX/gridY are missing or stale
        const clearTileFromGridSafe = (tile: any) => {
          if (!tile || !grid) return false;
          let cleared = false;
          const gxCandidate = tile.gridX;
          const gyCandidate = tile.gridY;
          if (gyCandidate !== undefined && gxCandidate !== undefined && grid[gyCandidate] && grid[gyCandidate][gxCandidate] === tile) {
            grid[gyCandidate][gxCandidate] = null;
            cleared = true;
          }
          if (!cleared) {
            for (let r = 0; r < grid.length; r++) {
              for (let c = 0; c < grid[r].length; c++) {
                if (grid[r][c] === tile) {
                  grid[r][c] = null;
                  cleared = true;
                  break;
                }
              }
              if (cleared) break;
            }
          }
          return cleared;
        };
        
        // 🔥 POJEDNOSTAVLJENO: Ako je magnet merge i NEMA pulled tiles merge, obriši merge 6 tile
        // Ovo pokriva SVE scenarije: hasTilesToPull=false, nearestTiles.length=0, validTiles.length=0
        const isMagnetMergeWithoutPull = wasWildMagnet && !isMagnetPullMergeFinal;
        
        if (isMagnetMergeWithoutPull && dst && !dst.destroyed && STATE.tiles.includes(dst)) {
          devLog('🧲🧲🧲 MAGNET MERGE WITHOUT PULL - Removing merge 6 tile (simplified logic)');
          
          // 🔥 CRITICAL FIX: Ensure grid position is null before removing tile
          if (clearTileFromGridSafe(dst)) {
            devLog('🧹 Explicitly cleared grid position before removeTile');
          }
          
          // 🔥 CRITICAL FIX: Hide tile before removing to prevent visual glitches
          dst.visible = false;
          dst.alpha = 0;
          dst.eventMode = 'none';
          
          removeTile(dst); // Remove from tiles array
          devLog('✅ Merge 6 tile removed successfully (magnet merge without pull)');
          
          // Clean up flags
          if (dst && !dst.destroyed) {
            delete (dst as any)?._willPullTiles;
            delete (dst as any)?._noTilesPulled;
            delete (dst as any)?._wasWildMagnetMerge6;
          }
        } else if (!isMagnetPullMergeFinal && dst && !dst.destroyed && STATE.tiles.includes(dst)) {
          // For regular/non-regular merge-6 (except magnet-pull), remove dst after spawn choreography.
          // In endgame spawn-at-dst mode, remove with small delay so fresh spawn can bind same cell first.
          if (shouldSpawnAtDst) {
            // In end game mode, remove dst tile after a short delay to allow spawn to happen first
            trackAppTimeout(() => {
              if (dst && !dst.destroyed && STATE.tiles.includes(dst)) {
                devLog('🗑️ END-GAME: Removing dst tile after spawn is scheduled');
                if (clearTileFromGridSafe(dst)) {
                  devLog('🧹 Cleared grid position before removing dst tile');
                }
                dst.visible = false;
                dst.alpha = 0;
                dst.eventMode = 'none';
                removeTile(dst);
                devLog('✅ Dst tile removed after end game spawn');
              }
            }, 100); // Delay to allow spawn to happen first
          } else {
            // Normal mode: remove merge-6 destination tile immediately
            devLog('🗑️ Removing dst tile IMMEDIATELY (merge 6, not magnet pull)');
            
            // 🔥 BUG FIX: Grid may have placeholder (not dst) at (gx, gy) – always clear whatever is there.
            // Keeping a locked placeholder here can leak into gameplay and appear as "locked tile instead of merge result".
            if (grid && grid[gy] && grid[gy][gx]) {
              const atCell = grid[gy][gx];
              grid[gy][gx] = null;
              if (atCell && atCell !== dst && !atCell.destroyed && tiles.includes(atCell)) {
                removeTile(atCell);
                devLog('🧹 Removed placeholder/leftover from merge 6 cell (normal path)');
              }
            }
            if (clearTileFromGridSafe(dst)) {
              devLog('🧹 Explicitly cleared grid position before removeTile');
            }
            
            dst.visible = false;
            dst.alpha = 0;
            dst.eventMode = 'none';
            removeTile(dst);
            devLog('✅ Dst tile removed successfully');
          }
          
          // Clean up flags
          if (dst && !dst.destroyed) {
            delete (dst as any)?._willPullTiles;
            delete (dst as any)?._noTilesPulled;
            delete (dst as any)?._wasWildMagnetMerge6;
          }
        } else if (isMagnetPullMergeFinal) {
          devLog('🧲 Magnet pull merge detected - removing merge 6 tile to prevent stuck value 6');
          
          // Remove merge-6 tile even for magnet pulls (after pulled merge is done)
          if (dst && !dst.destroyed) {
            if (clearTileFromGridSafe(dst)) {
              devLog('🧹 Cleared grid position for magnet pull merge dst');
            }
            dst.visible = false;
            dst.alpha = 0;
            dst.eventMode = 'none';
            removeTile(dst);
            devLog('✅ Magnet pull merge dst removed successfully');
          }
          
          // Clean up flags
          if (dst) {
            delete (dst as any)?._wildMagnetPulledTilesMerge;
            delete (dst as any)?._wildMagnetMergeCallback;
            delete (dst as any)?._willPullTiles;
            delete (dst as any)?._noTilesPulled;
            delete (dst as any)?._wasWildMagnetMerge6;
          }
        }

        // 🛡️ FAILSAFE: If a wild-magnet merge6 tile is still lingering, force-remove it
        if (wasWildMagnet && dst && !dst.destroyed && STATE.tiles.includes(dst)) {
          clearTileFromGridSafe(dst);
          dst.visible = false;
          dst.alpha = 0;
          dst.eventMode = 'none';
          removeTile(dst);
          devWarn('🧲 FAILSAFE: Forced removal of lingering magnet merge-6 tile to prevent stuck value 6');
        }
        
        // Clean up pulled cells flag after spawn
        if ((dst as any)?._wildMagnetPulledCells) {
          (dst as any)._wildMagnetPulledCells = undefined;
        }

        // 🔒 SAFETY: If only a plain merge-6 remains, remove it to prevent a stuck board
        try {
          const activeTiles = tiles.filter((t: any) => t && !t.destroyed && (t.value | 0) > 0);
          if (activeTiles.length === 1) {
            const onlyTile = activeTiles[0];
            const isPlainMerge6 = (onlyTile.value | 0) === 6 && !onlyTile.special;
            if (isPlainMerge6) {
              const gxOnly = onlyTile.gridX | 0;
              const gyOnly = onlyTile.gridY | 0;
              if (grid && grid[gyOnly] && grid[gyOnly][gxOnly] === onlyTile) {
                grid[gyOnly][gxOnly] = null;
              }
              removeTile(onlyTile);
              devWarn('🧲 SAFETY: Removed lone plain merge-6 tile to prevent stuck board after magnet pull');
            }
          }
        } catch (err) {
          devWarn('⚠️ SAFETY check for lone merge-6 failed:', err);
        }
        
        // Update idle bounce tile list with newly spawned tiles
        if (TILE_IDLE_BOUNCE.ENABLE) {
          try {
            TILE_IDLE_BOUNCE.updateTileList(tiles);
            devLog('🔄 Updated idle bounce tile list after spawn');
          } catch (error) {
            devWarn('⚠️ Failed to update idle bounce tile list:', error);
          }
        }
        
        // 🔥 CRITICAL FIX: Skip checkLevelEnd if _isLastMerge flag is set (clean board flow already triggered)
        // This prevents fail screen from triggering when clean board flow is in progress
        const hasLastMergeFlagAfterSpawn = (dst as any)?._isLastMerge === true;
        if (hasLastMergeFlagAfterSpawn || busyEnding) {
          devLog('🚨🚨🚨 SKIPPING checkLevelEnd - _isLastMerge flag is TRUE or busyEnding is true (clean board flow in progress)');
          return;
        }
        
        // 🔥 CRITICAL BUG FIX: Don't wait for bubbles animation - it's just visual and shouldn't block end game check
        // Bubbles animation can run for 4+ seconds, which would delay fail screen detection
        // Instead, check end game immediately after spawn completes (with small delay for spawn animations)
        // This ensures stuck positions are detected even if user makes quick second merge during bubbles animation
        const isTntMergeForDelay = srcSpecialMerge6 === 'wild-tnt' || dstSpecialMerge6 === 'wild-tnt';
        // 🔥 BUG FIX: openLockedBounceParallel spawns at 80ms + 0/100/200ms delays; spawnBounce ~240ms each → last tile ~520ms
        // Must wait long enough for all 3 wild bonus tiles to finish spawning before checkLevelEnd
        const postSpawnEndgameDelayMs = isTntMergeForDelay ? 1700 : 850;
        devLog(`⏳ Waiting ${postSpawnEndgameDelayMs}ms after spawn animations before endgame check...`, {
          isTntMergeForDelay
        });
        await waitTracked(postSpawnEndgameDelayMs);

        // 🔥 SAFETY: Never allow a locked ghost placeholder to survive on merge cell after spawn cycle.
        try {
          const mergeCellTile = grid?.[gy]?.[gx];
          if (
            mergeCellTile &&
            !mergeCellTile.destroyed &&
            mergeCellTile.locked === true &&
            ((mergeCellTile.value | 0) <= 0)
          ) {
            grid[gy][gx] = null;
            if (tiles.includes(mergeCellTile)) {
              removeTile(mergeCellTile);
            }
            devWarn('🧹 Removed lingering locked placeholder from merge cell before endgame check');
          }
        } catch (err) {
          devWarn('⚠️ Failed to clean merge-cell placeholder before endgame check:', err);
        }

        // 🛡️ SAFETY: Never allow board to end up with < 2 active tiles unless clean board flow is active.
        try {
          const isActiveTile = (t: any) => {
            if (!t || t.destroyed || t.locked) return false;
            const value = (t.value | 0);
            const special = t.special;
            const isWild = special === 'wild' || special === 'wild-magnet' || special === 'wild-juice' || special === 'wild-tnt';
            return value > 0 || isWild;
          };

          const activeTilesNow = tiles.filter(isActiveTile);
          if (activeTilesNow.length < 2) {
            const needed = 2 - activeTilesNow.length;
            devWarn('🛟 SAFETY: Active tiles below minimum after spawn, forcing extra spawn', {
              activeTiles: activeTilesNow.length,
              needed
            });
            const tilesForSpawn = Array.isArray(STATE.tiles) ? STATE.tiles : tiles;
            const opened = await FLOW.openLockedBounceParallel({
              tiles: tilesForSpawn,
              k: needed,
              drag,
              makeBoard,
              gsap,
              drawBoardBG,
              TILE,
              fixHoverAnchor,
              spawnBounce: (t, done, o) => SPAWN.spawnBounce(t, gsap, o, done),
              wildMergeTarget,
              excludeCells: pulledCellsSet,
              preferCells: new Set<string>([`${gx},${gy}`]),
            } as any);
            let remaining = Math.max(0, needed - (opened || 0));
            if (remaining > 0) {
              const excludeCells: { r: number; c: number }[] = activeTilesNow
                .filter((t: any) => typeof t.gridX === 'number' && typeof t.gridY === 'number')
                .map((t: any) => ({ r: t.gridY, c: t.gridX }));
              for (let i = 0; i < remaining; i++) {
                const cell = randomEmptyCell(excludeCells);
                if (!cell) break;
                excludeCells.push({ r: cell.r, c: cell.c });
                await openAtCell(cell.c, cell.r, {
                  value: wildMergeTarget ? (() => {
                    const candidates = [1,2,3,4,5].filter(v => v !== wildMergeTarget);
                    return candidates[(Math.random() * candidates.length) | 0];
                  })() : null,
                  skipBind: false,
                  timeScale: 2.0
                });
              }
            }
          }
        } catch (err) {
          devWarn('⚠️ SAFETY: Failed to enforce minimum active tiles:', err);
        }
        
        // 🔥 CRITICAL: Check end game after spawn completes (with delay to allow animations)
        // Use checkLevelEnd which already has proper delay and handles all edge cases
        // This replaces the inline setTimeout check to avoid duplicate checks
        // NOTE: Bubbles animation continues in background - it doesn't block end game detection
        checkLevelEnd();
      }
    });
    return;
  }

  } catch (_e) {
  // >6 shouldn't happen
  helpers.snapBack(src);
  dst.eventMode = 'static';
  } finally {
  replayRecorder.endStep(__replayToken);
  }
}

async function checkMovesDepleted(){
  // Use centralized end game checker
  if (busyEnding) return;
  
  // 🔥 CRITICAL FIX: Ensure tiles array is fully updated before checking
  // After merge completes, tiles array might still be updating
  // Wait a bit to ensure all tile state updates are complete
  await waitTracked(100);
  
  const movesDepletedCheckContext: EndGameContext = {
    tiles,
    moves: 0,
    makeBoard
  };
  
  // 🔥 CRITICAL: Use forceRefresh for moves depleted check
  const movesDepletedCheckResult = checkEndGame(movesDepletedCheckContext, true);
  
  devLog('🔍 checkMovesDepleted: End game check result:', {
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
    devLog('🚨🚨🚨 MOVES DEPLETED + GAME STUCK');
    if (!busyEnding) {
      devLog('⏳ Waiting 1.5s so player can see board state (no moves), then fail screen...');
      try { resetEndgameHint(); } catch {}
      try { hideTerminalLockedArtifacts('moves_depleted_stuck'); } catch {}
      try { showNoMovesText(); } catch {}
      await waitTracked(1500);
      try { await exitNoMovesText(); } catch {}
      showFinalScreen();
    }
  } else if (movesDepletedCheckResult.type === 'clean') {
    devLog('🚨🚨🚨 MOVES DEPLETED + BOARD CLEAN');
    if (!busyEnding) {
      // Respect hidden state (same rule as checkLevelEnd)
      const { appVisible, homeVisible, journeyVisible } = getScreenVisibility();
      if (homeVisible || journeyVisible) {
        devLog('⏳ checkMovesDepleted: Home/Journey visible - skipping clean board flow', { appVisible, homeVisible, journeyVisible });
        return;
      }
      await triggerCleanBoardFlow('clean_board_from_moves_depleted');
    }
  } else {
    devLog('✅ Moves depleted but merges still possible, game continues');
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

    checkLevelEndTimer = trackDelayedCall(CHECK_LEVEL_END_DELAY_MS / 1000, async () => {
      checkLevelEndTimer = null;
      // Safety sweep before any decision
      forceRemoveMagnetMergeResidues('checkLevelEnd');
      if (busyEnding) {
        devLog('⏳ checkLevelEnd skipped - busyEnding is true');
        checkLevelEndRetryCount = 0; // Reset on exit
      return;
    }
    const guardState = getEndgameGuardState();
    if (guardState.active) {
      const guardNow = Date.now();
      if (checkLevelEndSkipStartedAt === null) checkLevelEndSkipStartedAt = guardNow;
      const guardSkipWindowExceeded = (guardNow - checkLevelEndSkipStartedAt) > MAX_CHECK_LEVEL_END_SKIP_MS;
      if (!guardSkipWindowExceeded) {
        checkLevelEndRetryCount++;
        devLog('⏳ checkLevelEnd deferred - external endgame guard active', {
          retry: `${checkLevelEndRetryCount}/${MAX_CHECK_LEVEL_END_RETRIES}`,
          guardCount: guardState.count,
          guardSources: guardState.sources,
          guardMsLeft: Math.max(0, guardState.until - guardNow)
        });
        checkLevelEndTimer = trackDelayedCall(0.25, () => {
          checkLevelEndTimer = null;
          checkLevelEnd();
        });
        return;
      }
      devWarn('⏱️ checkLevelEnd: Guard skip window exceeded - forcing check', {
        guardCount: guardState.count,
        guardSources: guardState.sources,
        guardMsLeft: Math.max(0, guardState.until - guardNow)
      });
      checkLevelEndRetryCount = 0;
      checkLevelEndSkipStartedAt = null;
    }

    // 🛡️ SAFETY helpers
    const clearTileFromGridSafe = (tile: any) => {
      if (!tile || !grid) return false;
      let cleared = false;
      const gxCandidate = tile.gridX;
      const gyCandidate = tile.gridY;
      if (gyCandidate !== undefined && gxCandidate !== undefined && grid[gyCandidate] && grid[gyCandidate][gxCandidate] === tile) {
        grid[gyCandidate][gxCandidate] = null;
        cleared = true;
      }
      if (!cleared) {
        for (let r = 0; r < grid.length; r++) {
          for (let c = 0; c < grid[r].length; c++) {
            if (grid[r][c] === tile) {
              grid[r][c] = null;
              cleared = true;
              break;
            }
          }
          if (cleared) break;
        }
      }
      return cleared;
    };

    // 🛡️ SAFETY: Remove only TRULY orphaned merge-6 tiles (stale from crash/abort)
    // ⚠️ Do NOT remove ACTIVE magnet pull merge 6: _willPullTiles, _hasTilesToPull, _wildMagnetPulledTilesMerge, etc.
    try {
      const lingeringMagnet6 = tiles.filter((t: any) => {
        if (!t || t.destroyed) return false;
        if ((t.value | 0) !== 6) return false;
        if ((t as any)._wildMagnetPulledTilesMerge === true) return false;
        if ((t as any)._wildMagnetMergeCallback) return false;
        if ((t as any)._willPullTiles === true) return false;
        if ((t as any)._hasTilesToPull === true) return false;
        if ((t as any)._wildMagnetPulledTilesScoring === true) return false;
        return (t as any)._noTilesPulled === true || (t as any)._wasWildMagnetMerge6 === true;
      });
      lingeringMagnet6.forEach((t: any) => {
        clearTileFromGridSafe(t);
        t.visible = false;
        t.alpha = 0;
        t.eventMode = 'none';
        removeTile(t);
        delete (t as any)._wildMagnetPulledTilesMerge;
        delete (t as any)._wildMagnetMergeCallback;
        delete (t as any)._willPullTiles;
        delete (t as any)._hasTilesToPull;
        delete (t as any)._wildMagnetPulledTilesScoring;
        delete (t as any)._noTilesPulled;
        delete (t as any)._wasWildMagnetMerge6;
        devWarn('🧲 SAFETY: Removed lingering magnet merge-6 tile during checkLevelEnd');
      });
    } catch (err) {
      devWarn('⚠️ SAFETY: Failed to sweep lingering magnet merge-6 tiles:', err);
    }
    
    // 🔥 CRITICAL FIX: Skip check if _isLastMerge flag is set on any merge-6 tile (clean board flow in progress)
    // This prevents fail screen from triggering when clean board flow is in progress
    const hasLastMergeTile = tiles.some((t: any) => t && !t.destroyed && t.value === 6 && (t as any)?._isLastMerge === true);
    if (hasLastMergeTile) {
      devLog('⏳ checkLevelEnd: _isLastMerge flag detected on merge-6 tile (clean board flow in progress)');
    }
    
    logger.debug('🎯 checkLevelEnd called - using centralized end game checker', 'app-core');
    const now = Date.now();
    const skipWindowExceeded = checkLevelEndSkipStartedAt !== null && (now - checkLevelEndSkipStartedAt) > MAX_CHECK_LEVEL_END_SKIP_MS;
    // 🔥 BUG FIX: Skip if merge-6 spawn still in progress (prevents fail screen before 3 wild bonus tiles spawn)
    if (merge6SpawnInProgress && !skipWindowExceeded) {
      if (checkLevelEndSkipStartedAt === null) checkLevelEndSkipStartedAt = now;
      checkLevelEndRetryCount++;
      devLog('⏳ checkLevelEnd skipped - merge6 spawn in progress (retry', checkLevelEndRetryCount, '/', MAX_CHECK_LEVEL_END_RETRIES, ')');
      if (checkLevelEndRetryCount > MAX_CHECK_LEVEL_END_RETRIES) {
        checkLevelEndRetryCount = 0;
        checkLevelEndSkipStartedAt = null;
      } else {
        checkLevelEndTimer = trackDelayedCall(0.5, () => {
          checkLevelEndTimer = null;
          checkLevelEnd();
        });
        return;
      }
    }
    const tntAnimationRunning = !!isTntAnimationActive?.();
    const tntBonusGuardActive = tntBonusGuardUntil > now;

    // 🔥 CRITICAL FIX: Never evaluate fail/clean while TNT transition/bonus is still mutating board.
    // This prevents false fail on transient states (e.g. temporary 4+5 before TNT replacement produces 4+2).
    if ((tntAnimationRunning || tntBonusGuardActive) && !skipWindowExceeded) {
      if (checkLevelEndSkipStartedAt === null) checkLevelEndSkipStartedAt = now;
      checkLevelEndRetryCount++;
      devLog('⏳ checkLevelEnd deferred - TNT animation/bonus in progress', {
        retry: `${checkLevelEndRetryCount}/${MAX_CHECK_LEVEL_END_RETRIES}`,
        tntAnimationRunning,
        tntBonusGuardMsLeft: Math.max(0, tntBonusGuardUntil - now)
      });
      checkLevelEndTimer = trackDelayedCall(0.4, () => {
        checkLevelEndTimer = null;
        checkLevelEnd();
      });
      return;
    }
    if ((tntAnimationRunning || tntBonusGuardActive) && skipWindowExceeded) {
      devWarn('⏱️ checkLevelEnd: TNT guard skip window exceeded - forcing check', {
        tntAnimationRunning,
        tntBonusGuardMsLeft: Math.max(0, tntBonusGuardUntil - now)
      });
      checkLevelEndRetryCount = 0;
      checkLevelEndSkipStartedAt = null;
      tntBonusGuardUntil = now;
    }
    
    // 🔥 CRITICAL BUG FIX: Don't skip check if bubbles animation is running - it's just visual
    // Bubbles animation can run for 4+ seconds and shouldn't block end game detection
    // This fixes the bug where user makes quick second merge during bubbles animation and gets stuck position
    const bubblesRunning = isWildJuiceBubblesExplosionActive();
    if (bubblesRunning) {
      devLog('💧 Bubbles animation is running, but continuing with end game check (bubbles are visual only, don\'t block detection)');
    }
    
    // 🔥 CRITICAL: Skip check if wild spawn is in progress (animation not finished yet)
    if (wildSpawnInProgress && !skipWindowExceeded) {
      if (checkLevelEndSkipStartedAt === null) checkLevelEndSkipStartedAt = now;
      checkLevelEndRetryCount++;
      devLog('⏳ checkLevelEnd skipped - wild spawn animation in progress (retry', checkLevelEndRetryCount, '/', MAX_CHECK_LEVEL_END_RETRIES, ')');
      
      // 🔥 v38: Check max retries to prevent infinite loop
      if (checkLevelEndRetryCount > MAX_CHECK_LEVEL_END_RETRIES) {
        devError('🚨 checkLevelEnd: Max retries exceeded for wild spawn - forcing check anyway');
        checkLevelEndRetryCount = 0;
        checkLevelEndSkipStartedAt = null;
        // Continue to check (don't return)
      } else {
        // Reschedule after spawn completes
        checkLevelEndTimer = trackDelayedCall(0.3, () => {
          checkLevelEndTimer = null;
          checkLevelEnd();
        });
        return;
      }
    }
    if (wildSpawnInProgress && skipWindowExceeded) {
      devWarn('⏱️ checkLevelEnd: Skip window exceeded for wild spawn - forcing check despite flag');
      checkLevelEndRetryCount = 0;
      checkLevelEndSkipStartedAt = null;
    }
    
    // 🔥 USER BUG FIX: Update STACK IT! hint BEFORE tilesNotReady check - so it shows when we have 2 active
    // stackable tiles even if there are locked tiles (ghost placeholders or animating). Hint logic uses
    // getActiveTiles which excludes locked tiles, so we correctly show STACK IT! for 2+2, 3+2, etc.
    updateEndgameHintState();
    
    // 🔥 CRITICAL FIX: Skip check if there are LOCKED tiles with value > 0 (spawn animations in progress)
    // This prevents premature fail screen when tiles are still being spawned/animated
    // 🔥 FIX: Only count locked tiles with value > 0 (animating) - NOT ghost placeholders (value 0)
    // Ghost placeholders never unlock → would cause infinite reschedule when stuck (4,5,4,5,3)
    const lockedActiveTiles = tiles.filter((t: any) => {
      if (!t || t.destroyed) return false;
      if (!t.locked) return false;
      if (t.special === 'wild-juice') return false; // Bubbles animation is visual only
      return (t.value | 0) > 0; // Only animating tiles (value > 0), not ghost placeholders
    });
    
    // 🔥 USER BUG FIX: Also check for tiles that are still being spawned (not yet interactive)
    // This prevents fail screen when user tries to merge tiles that just spawned after magnet
    // Tiles that are still spawning may not have eventMode='static' yet or may have _isBeingSpawned flag
    const tilesStillSpawning = tiles.filter((t: any) => {
      if (!t || t.destroyed) return false;
      if (t.locked && (t.value | 0) > 0) return true; // Locked animating tiles only, not ghost placeholders
      // Check if tile is still being spawned (animation in progress)
      if (t._isBeingSpawned === true) return true;
      // Check if tile doesn't have eventMode='static' yet (not interactive)
      if (t.eventMode !== 'static' && (t.value|0) > 0) {
        // Wild tiles might not have eventMode set immediately, so check if tile is actually active
        const isWildTile = t.special === 'wild' || t.special === 'wild-magnet' || t.special === 'wild-juice' || t.special === 'wild-tnt';
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
      logger.debug('⏳ checkLevelEnd skipped - tiles still spawning/animating', 'app-core', {
        retry: `${checkLevelEndRetryCount}/${MAX_CHECK_LEVEL_END_RETRIES}`,
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
        devError('🚨 checkLevelEnd: Max retries exceeded for locked tiles - forcing check anyway');
        devError('🚨 WARNING: Tiles still locked:', lockedActiveTiles.map(t => ({ value: t.value, locked: t.locked })));
        checkLevelEndRetryCount = 0;
        checkLevelEndSkipStartedAt = null;
        // Continue to check (don't return)
      } else {
        // Reschedule after animations complete
        checkLevelEndTimer = trackDelayedCall(0.5, () => {
          checkLevelEndTimer = null;
          checkLevelEnd();
        });
        return;
      }
    }
    if (tilesNotReady && skipWindowExceeded) {
      devWarn('⏱️ checkLevelEnd: Skip window exceeded for locked/spawning tiles - forcing check despite locks/spawns');
      devWarn('⏱️ WARNING: Some tiles may still be spawning:', {
        lockedCount: lockedActiveTiles.length,
        stillSpawningCount: tilesStillSpawning.length
      });
      checkLevelEndRetryCount = 0;
      checkLevelEndSkipStartedAt = null;
    }

    // Hard guard: if a mandatory merge-cell spawn is pending, defer endgame checks until the tile is confirmed.
    if (pendingMandatoryMergeCellSpawn) {
      const nowMs = Date.now();
      const { c, r, expiresAt } = pendingMandatoryMergeCellSpawn;
      const hasSpawnedAtMandatoryCell = tiles.some((t: any) => {
        if (!t || t.destroyed) return false;
        if ((t.gridX | 0) !== (c | 0) || (t.gridY | 0) !== (r | 0)) return false;
        const value = (t.value | 0);
        return value > 0 || t.special === 'wild' || t.special === 'wild-magnet' || t.special === 'wild-juice' || t.special === 'wild-tnt';
      });
      if (hasSpawnedAtMandatoryCell) {
        pendingMandatoryMergeCellSpawn = null;
      } else if (nowMs < expiresAt) {
        devLog('⏳ checkLevelEnd deferred - waiting for mandatory merge-cell spawn confirmation', {
          c,
          r,
          msLeft: expiresAt - nowMs
        });
        checkLevelEndTimer = trackDelayedCall(0.25, () => {
          checkLevelEndTimer = null;
          checkLevelEnd();
        });
        return;
      } else {
        devWarn('⚠️ Mandatory merge-cell spawn confirmation timed out; forcing merge-cell repair before endgame check', { c, r });

        const ghostAtMandatoryCell = tiles.find((t: any) => {
          if (!t || t.destroyed) return false;
          if ((t.gridX | 0) !== (c | 0) || (t.gridY | 0) !== (r | 0)) return false;
          const isWildTile = t.special === 'wild' || t.special === 'wild-magnet' || t.special === 'wild-juice' || t.special === 'wild-tnt';
          return !!t.locked && !isWildTile && ((t.value | 0) <= 0);
        });

        if (ghostAtMandatoryCell) {
          try {
            if (grid?.[r]?.[c] === ghostAtMandatoryCell) grid[r][c] = null;
            if (!ghostAtMandatoryCell.destroyed && tiles.includes(ghostAtMandatoryCell)) removeTile(ghostAtMandatoryCell);
            devWarn('🧹 Removed stuck ghost placeholder from mandatory merge cell before forced spawn', { c, r });
          } catch (err) {
            devWarn('⚠️ Failed removing ghost placeholder at mandatory merge cell', { c, r, err });
          }
        }

        pendingMandatoryMergeCellSpawn = {
          c,
          r,
          expiresAt: Date.now() + 1200,
        };

        void (async () => {
          let spawned = false;
          try {
            spawned = !!(await openAtCell(c, r, {
              skipBind: false,
              timeScale: 2.0,
              forceFreshPlaceholder: true,
            }));
          } catch (err) {
            devWarn('⚠️ Forced openAtCell failed for mandatory merge cell repair', { c, r, err });
          }

          if (!spawned) {
            try {
              if (grid?.[r]?.[c]) {
                const existing = grid[r][c];
                if (existing && !existing.destroyed && tiles.includes(existing)) removeTile(existing);
                grid[r][c] = null;
              }
              const t = makeBoard?.createTile?.({ board, grid, tiles, c, r, val: 0, locked: true });
              if (t) {
                t.locked = false;
                t.eventMode = 'static';
                t.cursor = 'pointer';
                resetTileToNormalState?.(t);
                if (drag && typeof drag.bindToTile === 'function') drag.bindToTile(t);
                const forcedValue = [1, 2, 3, 4, 5][(Math.random() * 5) | 0];
                makeBoard?.setValue?.(t, forcedValue, 0, { immediate: true });
                t.visible = true;
                t.alpha = 1;
                if (t.rotG) t.rotG.alpha = 1;
                if (t.base) t.base.alpha = 1;
                if (t.overlay) { t.overlay.alpha = 1; t.overlay.visible = false; }
                if (t.num) t.num.alpha = 1;
                if (t.pips) { t.pips.alpha = 1; t.pips.visible = true; }
                try { fixHoverAnchor?.(t); } catch {}
                try { drawBoardBG?.(); } catch {}
                SPAWN?.spawnBounce?.(t, gsap, { max: 1.08, compress: 0.96, rebound: 1.02, startScale: 0.30, wiggle: 0.035, fadeIn: 0.10, timeScale: 2.0, keepFullOpacity: true });
                spawned = true;
              }
            } catch (err) {
              devWarn('⚠️ Hard fallback spawn failed for mandatory merge cell repair', { c, r, err });
            }
          }

          if (!spawned) {
            pendingMandatoryMergeCellSpawn = null;
          }

          checkLevelEnd();
        })();
        return;
      }
    }
    
    // Do not evaluate endgame while user is actively dragging a tile.
    // Drag temporarily mutates board/grid state and can produce transient false "stuck".
    const activeDragTile = ((STATE as any)?.drag?.t) || ((drag as any)?.t);
    if (activeDragTile && !activeDragTile.destroyed) {
      logger.debug('⏳ checkLevelEnd skipped - active drag in progress', 'app-core', {
        value: activeDragTile.value,
        special: activeDragTile.special,
        gridX: activeDragTile.gridX,
        gridY: activeDragTile.gridY
      });
      checkLevelEndTimer = trackDelayedCall(0.25, () => {
        checkLevelEndTimer = null;
        checkLevelEnd();
      });
      return;
    }

    // 🔥 v38: Reset retry counter after successful reschedule bypass (tiles no longer locked/spawn done)
    checkLevelEndRetryCount = 0;
    checkLevelEndSkipStartedAt = null;

    const buildEndgameBoardSignature = () => {
      const active = tiles
        .filter((t: any) => t && !t.destroyed && ((t.value | 0) > 0 || t.special === 'wild' || t.special === 'wild-magnet' || t.special === 'wild-juice' || t.special === 'wild-tnt'))
        .map((t: any) => ({
          v: t.value | 0,
          s: t.special || null,
          l: !!t.locked,
          d: (t as any).stackDepth || 1,
          x: t.gridX ?? null,
          y: t.gridY ?? null,
          e: t.eventMode || null
        }))
        .sort((a, b) => {
          if (a.y !== b.y) return (a.y ?? -1) - (b.y ?? -1);
          if (a.x !== b.x) return (a.x ?? -1) - (b.x ?? -1);
          if (a.v !== b.v) return a.v - b.v;
          return String(a.s).localeCompare(String(b.s));
        });
      return JSON.stringify(active);
    };
    const currentEndgameSignature = buildEndgameBoardSignature();
    if (currentEndgameSignature !== lastEndgameBoardSignature) {
      lastEndgameBoardSignature = currentEndgameSignature;
      lastEndgameBoardMutationAt = Date.now();
    }
    
    // 🔥 NOTE: Removed per request (no magnet-only end state allowed)
    // updateEndgameHintState() already called above (before tilesNotReady) so STACK IT! shows even with locked tiles

    // Use centralized end game checker
    const checkLevelEndContext: EndGameContext = {
      tiles,
      moves,
      makeBoard
    };
    
    // 🔥 CRITICAL: Use forceRefresh because delay might have caused cache staleness
    const checkLevelEndResult = checkEndGame(checkLevelEndContext, true);
    if (checkLevelEndResult.type !== 'continue') {
      resetEndgameHint();
    }
    
    // 🔥 USER BUG FIX: Don't trigger clean board flow if game is hidden (user is on homepage/other screens)
    // This prevents clean board modal from appearing when user navigates away from game
    const { appVisible, homeVisible, journeyVisible } = getScreenVisibility();
    
    if ((homeVisible || journeyVisible) && !appVisible) {
      devLog('⏳ checkLevelEnd skipped - home/journey visible (user navigated away from game)', {
        appVisible,
        homeVisible,
        journeyVisible
      });
      return;
    }
    
    if (checkLevelEndResult.type === 'clean') {
      const wildReady = wildMeter >= 1 || wildSpawnInProgress || wildSpawnRetryTimer !== null;
      if (wildReady) {
        devLog('⚠️ checkLevelEnd: Clean board detected but wild meter is ready/spawning – deferring clean board flow until wild cube drops');
        queueWildSpawnIfNeeded();
      return;
    }
      
      // 🔥 CRITICAL FIX: Check if there are unlocked mergeable tiles on board
      // If there are unlocked tiles (other than merge 6), it's NOT a clean board - user can still merge them
      const unlockedActiveTiles = tiles.filter((t: any) => {
        if (!t || t.destroyed) return false;
        if (t.locked) return false; // Only check unlocked tiles
        return (t.value|0) > 0 || t.special === 'wild' || t.special === 'wild-magnet' || t.special === 'wild-juice' || t.special === 'wild-tnt';
      });
      
      // Check if there are more than 1 unlocked tile (merge 6 + other tiles = can merge)
      const hasUnlockedMergeableTiles = unlockedActiveTiles.length > 1;
      
      // 🔥 USER REQUEST v85: Check if unlocked tiles have potential for merge/stack
      // If anyMergePossible returns true → game continues (don't trigger clean board)
      // If anyMergePossible returns false → trigger clean board or fail screen
      // This ensures clean board is only triggered when no merges/stack are possible
      // 🔥 v112 NOTE: This is a specific check for UNLOCKED tiles only (different from standard checkEndGame)
      // Keeping direct anyMergePossible() call here because we need to check only unlocked tiles, not all tiles
      let hasMergeOrStackPotential = false;
      if (unlockedActiveTiles.length > 0 && makeBoard?.anyMergePossible) {
        // Check only with unlocked tiles (available for player to use)
        hasMergeOrStackPotential = makeBoard.anyMergePossible(unlockedActiveTiles);
        devLog('🧲 checkLevelEnd: anyMergePossible check with unlocked tiles:', {
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
        return (t.value|0) > 0 || t.special === 'wild' || t.special === 'wild-magnet' || t.special === 'wild-juice' || t.special === 'wild-tnt';
      });
      const hasMagnet = activeTiles.some((t: any) => t.special === 'wild-magnet');
      
      // 🔥 USER REQUEST: If unlocked tiles have merge/stack potential → game continues
      if (hasMergeOrStackPotential) {
        devLog('✅ checkLevelEnd: Unlocked tiles have merge/stack potential - game continues, NOT triggering clean board');
        return; // Don't trigger clean board - game continues
      }
      
      if (hasUnlockedMergeableTiles && !hasMergeOrStackPotential) {
        devLog('🧲 checkLevelEnd: Unlocked mergeable tiles detected but no merge/stack potential - will check stuck in checkEndGame');
        // Continue to checkEndGame which will check stuck and show fail screen if needed
      }
      
      if (hasMagnet) {
        devLog('🧲 checkLevelEnd: Magnet detected on board - NOT a clean board, game continues');
        return; // Don't trigger clean board - game continues
      }
      
      devLog('🚨🚨🚨 checkLevelEnd: Board is clean, triggering clean board flow');
    
      // 🔥 FIX: Use centralized triggerCleanBoardFlow instead of duplicating logic
      // This ensures consistent handling: memory cleanup, skip flags, wild resets, etc.
      await triggerCleanBoardFlow('clean_board_from_checkLevelEnd');
      return;
    }
    
    if (checkLevelEndResult.type === 'stuck') {
      devWarn('🧪 FAILFLOW DEBUG: entered stuck branch', {
        reason: checkLevelEndResult.reason,
        busyEnding,
        failPending: (window as any).__ccFailScreenPending === true,
        wildReady: wildMeter >= 1 || wildSpawnInProgress || wildSpawnRetryTimer !== null,
      });
      try { resetEndgameHint(); } catch {}
      const wildReady = wildMeter >= 1 || wildSpawnInProgress || wildSpawnRetryTimer !== null;
      if (wildReady) {
        devWarn('🧪 FAILFLOW DEBUG: defer because wildReady', {
          wildMeter,
          wildSpawnInProgress,
          hasRetryTimer: wildSpawnRetryTimer !== null,
        });
        devLog('⚠️ checkLevelEnd: Stuck detected but wild meter is ready/spawning – deferring fail screen until wild cube drops');
        queueWildSpawnIfNeeded();
        return;
      }

      // Hard recovery: if a plain merge-6 is lingering while board is considered stuck,
      // consume it and force-spawn one fresh tile at the same cell before fail evaluation.
      // This prevents false fail when merge-6 cleanup/spawn order races in endgame scenarios.
      const lingeringRegularMerge6 = tiles.find((t: any) => {
        if (!t || t.destroyed) return false;
        if ((t.value | 0) !== 6) return false;
        if (t.special) return false;
        if (t.locked) return false;
        if ((t as any)?._isLastMerge === true) return false;
        if ((t as any)?._wildMagnetPulledTilesMerge === true) return false;
        if ((t as any)?._willPullTiles === true) return false;
        if ((t as any)?._hasTilesToPull === true) return false;
        return true;
      });
      if (lingeringRegularMerge6) {
        const activeExcludingMerge6 = tiles.filter((t: any) => {
          if (!t || t === lingeringRegularMerge6 || t.destroyed) return false;
          if (t.locked) return false;
          const value = (t.value | 0);
          const special = t.special;
          const isWild = special === 'wild' || special === 'wild-magnet' || special === 'wild-juice' || special === 'wild-tnt';
          return value > 0 || isWild;
        });

        // Only do this in "board continues" shape (other active tiles exist).
        // Final-merge clean-board paths are handled elsewhere via _isLastMerge and clean flow.
        if (activeExcludingMerge6.length > 0) {
          const rescueGX = lingeringRegularMerge6.gridX | 0;
          const rescueGY = lingeringRegularMerge6.gridY | 0;
          devWarn('🛟 ENDGAME RESCUE: lingering plain merge-6 detected in stuck path; forcing consume + respawn', {
            gridX: rescueGX,
            gridY: rescueGY,
            otherActiveTiles: activeExcludingMerge6.length,
            reason: checkLevelEndResult.reason
          });

          if (clearTileFromGridSafe(lingeringRegularMerge6)) {
            devLog('🧹 ENDGAME RESCUE: cleared lingering merge-6 from grid');
          }
          lingeringRegularMerge6.visible = false;
          lingeringRegularMerge6.alpha = 0;
          lingeringRegularMerge6.eventMode = 'none';
          removeTile(lingeringRegularMerge6);

          pendingMandatoryMergeCellSpawn = {
            c: rescueGX,
            r: rescueGY,
            expiresAt: Date.now() + 2500
          };

          let spawned = false;
          try {
            spawned = !!(await openAtCell(rescueGX, rescueGY, {
              skipBind: false,
              timeScale: 2.0,
              forceFreshPlaceholder: true,
            }));
          } catch (spawnErr) {
            devWarn('⚠️ ENDGAME RESCUE: openAtCell failed for lingering merge-6 replacement', spawnErr);
          }

          if (!spawned) {
            try {
              const t = makeBoard?.createTile?.({ board, grid, tiles, c: rescueGX, r: rescueGY, val: 0, locked: true });
              if (t) {
                t.locked = false;
                t.eventMode = 'static';
                t.cursor = 'pointer';
                resetTileToNormalState?.(t);
                if (drag && typeof drag.bindToTile === 'function') drag.bindToTile(t);
                const forcedValue = [1, 2, 3, 4, 5][(Math.random() * 5) | 0];
                makeBoard?.setValue?.(t, forcedValue, 0, { immediate: true });
                t.visible = true;
                t.alpha = 1;
                if (t.rotG) t.rotG.alpha = 1;
                if (t.base) t.base.alpha = 1;
                if (t.overlay) { t.overlay.alpha = 1; t.overlay.visible = false; }
                if (t.num) t.num.alpha = 1;
                if (t.pips) { t.pips.alpha = 1; t.pips.visible = true; }
                try { fixHoverAnchor?.(t); } catch {}
                try { drawBoardBG?.(); } catch {}
                SPAWN?.spawnBounce?.(t, gsap, { max: 1.08, compress: 0.96, rebound: 1.02, startScale: 0.30, wiggle: 0.035, fadeIn: 0.10, timeScale: 2.0, keepFullOpacity: true });
                spawned = true;
              }
            } catch (fallbackErr) {
              devWarn('⚠️ ENDGAME RESCUE: fallback spawn failed after lingering merge-6 removal', fallbackErr);
            }
          }

          if (spawned) {
            pendingMandatoryMergeCellSpawn = null;
            await waitTracked(140);
            checkLevelEnd();
            return;
          }

          devWarn('⚠️ ENDGAME RESCUE: failed to respawn replacement tile after lingering merge-6 removal, continuing stuck evaluation');
        }
      }

      const sinceMutation = lastEndgameBoardMutationAt ? (Date.now() - lastEndgameBoardMutationAt) : Infinity;
      if (sinceMutation < ENDGAME_FAIL_MUTATION_COOLDOWN_MS) {
        devWarn('🧪 FAILFLOW DEBUG: defer because mutation cooldown', {
          sinceMutation,
          cooldown: ENDGAME_FAIL_MUTATION_COOLDOWN_MS,
        });
        devLog('🛡️ checkLevelEnd: Deferring fail due to recent board mutation cooldown', {
          sinceMutation,
          cooldown: ENDGAME_FAIL_MUTATION_COOLDOWN_MS
        });
        checkLevelEndTimer = trackDelayedCall(0.25, () => {
          checkLevelEndTimer = null;
          checkLevelEnd();
        });
        return;
      }

      const buildBoardStabilitySignature = () => {
        const active = tiles
          .filter((t: any) => t && !t.destroyed && ((t.value | 0) > 0 || t.special === 'wild' || t.special === 'wild-magnet' || t.special === 'wild-juice' || t.special === 'wild-tnt'))
          .map((t: any) => ({
            v: t.value | 0,
            s: t.special || null,
            l: !!t.locked,
            d: (t as any).stackDepth || 1,
            x: t.gridX ?? null,
            y: t.gridY ?? null,
            e: t.eventMode || null
          }))
          .sort((a, b) => {
            if (a.y !== b.y) return (a.y ?? -1) - (b.y ?? -1);
            if (a.x !== b.x) return (a.x ?? -1) - (b.x ?? -1);
            if (a.v !== b.v) return a.v - b.v;
            return String(a.s).localeCompare(String(b.s));
          });
        return JSON.stringify(active);
      };

      const hasNotReadyTilesNow = () => {
        return tiles.some((t: any) => {
          if (!t || t.destroyed) return false;
          if (t.special === 'wild-juice') return false;
          if (t.locked && (t.value | 0) > 0) return true;
          if ((t as any)._isBeingSpawned === true) return true;
          if (t.eventMode !== 'static' && (t.value | 0) > 0) {
            const isWildTile = t.special === 'wild' || t.special === 'wild-magnet' || t.special === 'wild-juice' || t.special === 'wild-tnt';
            if (!isWildTile) return true;
          }
          return false;
        });
      };

      const initialStuckSignature = buildBoardStabilitySignature();
      const stuckConfirmationDelaysMs = [250, 250];
      let stableStuckConfirmed = true;
      let lastReason = checkLevelEndResult.reason;

      // Production-safe guard: require multiple consistent stuck checks on unchanged board state.
      for (const delayMs of stuckConfirmationDelaysMs) {
        await waitTracked(delayMs);
        const dragTileNow = ((STATE as any)?.drag?.t) || ((drag as any)?.t);
        if (dragTileNow && !dragTileNow.destroyed) {
          devWarn('🧪 FAILFLOW DEBUG: abort during confirmation because drag active', {
            value: dragTileNow.value,
            special: dragTileNow.special,
            gridX: dragTileNow.gridX,
            gridY: dragTileNow.gridY,
          });
          devLog('🛡️ checkLevelEnd: Abort fail - drag became active during stuck confirmation');
          stableStuckConfirmed = false;
          break;
        }
        if (hasNotReadyTilesNow()) {
          devWarn('🧪 FAILFLOW DEBUG: abort during confirmation because tiles not ready');
          devLog('🛡️ checkLevelEnd: Abort fail - tiles are still spawning/animating during stuck confirmation');
          stableStuckConfirmed = false;
          break;
        }
        const recheckContext: EndGameContext = { tiles, moves, makeBoard };
        const recheckResult = checkEndGame(recheckContext, true);
        lastReason = recheckResult.reason;
        if (recheckResult.type !== 'stuck') {
          devWarn('🧪 FAILFLOW DEBUG: abort because recheck is no longer stuck', {
            first: checkLevelEndResult.reason,
            secondType: recheckResult.type,
            secondReason: recheckResult.reason,
          });
          devLog('🛡️ checkLevelEnd: Transient stuck resolved on recheck, continuing game', {
            first: checkLevelEndResult.reason,
            second: recheckResult.reason
          });
          stableStuckConfirmed = false;
          break;
        }
        const currentSignature = buildBoardStabilitySignature();
        if (currentSignature !== initialStuckSignature) {
          devWarn('🧪 FAILFLOW DEBUG: abort because board signature changed during confirmation');
          devLog('🛡️ checkLevelEnd: Board changed during stuck confirmation, skipping fail this tick');
          stableStuckConfirmed = false;
          break;
        }
      }

      if (!stableStuckConfirmed) {
        devWarn('🧪 FAILFLOW DEBUG: stableStuckConfirmed=false, exiting stuck branch without fail modal');
        return;
      }

      devLog('🚨🚨🚨 checkLevelEnd: Game is stuck, checking anyMergePossible before showing fail screen');
      devLog('🔍 checkLevelEnd: Stuck reason:', lastReason);
      devLog('🔍 checkLevelEnd: Current tiles:', tiles.filter(tileIsActive).map(t => ({ 
        value: t.value, 
        special: t.special, 
        locked: t.locked 
      })));
      
      // 🔥 REFACTORED: Uklonjena redundancija - checkEndGame() već poziva anyMergePossible() kroz isGameStuck()
      // Ako checkEndGame() vraća 'stuck', znači da anyMergePossible() već vratio false
      // Nema potrebe za dodatnom provjerom
      
      const dumpEndgameSnapshot = (label: string) => {
        try {
          const tileSummary = (tiles || []).filter((t: any) => t && !t.destroyed).map((t: any) => ({
            v: t.value,
            s: t.special || null,
            l: !!t.locked,
            e: t.eventMode || null,
            x: t.gridX,
            y: t.gridY,
            d: (t as any).stackDepth || 1,
            wild: !!(t.special === 'wild' || t.special === 'wild-magnet' || t.special === 'wild-juice' || t.special === 'wild-tnt' || t.isWild === true || t.isWildFace === true)
          }));
          const gridSummary: any[] = [];
          if (Array.isArray(grid)) {
            for (let r = 0; r < grid.length; r++) {
              const row = grid[r] || [];
              for (let c = 0; c < row.length; c++) {
                const t = row[c];
                if (!t) continue;
                gridSummary.push({
                  r, c,
                  v: t.value,
                  s: t.special || null,
                  l: !!t.locked,
                  e: t.eventMode || null,
                  id: (t as any).uid || null
                });
              }
            }
          }
          devWarn('📸 ENDGAME SNAPSHOT', {
            label,
            moves,
            tilesCount: tiles?.length || 0,
            activeCount: tiles.filter(tileIsActive).length,
            lockedCount: tiles.filter((t: any) => t && !t.destroyed && t.locked).length,
            wildsCount: tiles.filter((t: any) => t && !t.destroyed && (t.special === 'wild' || t.special === 'wild-magnet' || t.special === 'wild-juice' || t.special === 'wild-tnt')).length,
            tileSummary,
            gridSummary
          });
        } catch (e) {
          devWarn('⚠️ ENDGAME SNAPSHOT failed:', e);
        }
      };
      if (!busyEnding) {
        devWarn('🧪 FAILFLOW DEBUG: final fail path starting (will show NO MOVES then fail modal)');
        dumpEndgameSnapshot('checkLevelEnd_stuck_before_fail');
        // 🔥 BUG FIX: Set fail-screen-pending IMMEDIATELY to block wild spawn during 1.5s wait
        // Prevents: game stuck → wild meter fills → spawnWildFromMeter → openAtCell on destroyed tile → setValue skipped
        (window as any).__ccFailScreenPending = true;
        try { hideTerminalLockedArtifacts('checkLevelEnd_stuck_before_fail'); } catch {}
        // 🔥 UX: Stop idle bounce smoke immediately when fail screen is pending
        try { TILE_IDLE_BOUNCE.stop(); } catch {}
        try { cleanupFxContainersByTag('tile-idle-smoke'); } catch {}
        // 🔥 ANTI-EXPLOIT: Persist stuck state so hard exit cannot revert to pre-fail state
        try { saveGameState(); } catch (_) {}
        const minAfterTntChangeMs = 1000;
        const sinceTntChange = lastTntBonusChangeAt ? (Date.now() - lastTntBonusChangeAt) : Infinity;
        const extraWait = sinceTntChange < minAfterTntChangeMs ? (minAfterTntChangeMs - sinceTntChange) : 0;
        devLog('⏳ Waiting 1.5s so player can see board state (no moves), then fail screen...', { extraWait });
        try { showNoMovesText(); } catch {}
        await waitTracked(1500 + extraWait);
        try { await exitNoMovesText(); } catch {}
        devWarn('🧪 FAILFLOW DEBUG: invoking showFinalScreen now');
        showFinalScreen();
      } else {
        devWarn('🧪 FAILFLOW DEBUG: blocked because busyEnding=true');
        devWarn('⚠️ checkLevelEnd: busyEnding is true, skipping showFinalScreen');
      }
    } else {
      devLog('✅ checkLevelEnd: Game continues -', checkLevelEndResult.reason);
      (window as any).__ccFailScreenPending = false; // Clear in case it was set from a prior check
      // 🔥 ANTI-EXPLOIT: Save state after merge (and spawn) have fully completed.
      // Without this, save only ran on drop (before merge), so hard exit could restore
      // pre-merge state (e.g. magnet back, revert move). Now resume always gets post-merge state.
      try {
        saveGameState();
        devLog('💾 Game state saved after merge complete (prevents hard-exit revert exploit)');
      } catch (e) {
        devWarn('⚠️ Failed to save after merge complete:', e);
      }
    }
  });
}

function updateEndgameHintState(): void {
  try {
    if ((window as any).__ccFailScreenPending === true) {
      updateEndgameHint(false);
      return;
    }
    // 🔥 CRITICAL: Never show STACK IT! during final merge / clean board flow
    if (busyEnding) {
      updateEndgameHint(false);
      return;
    }
    const hasFinalMergeFlag = tiles.some((t: any) => t && !t.destroyed && (t as any)?._isLastMerge === true);
    if (hasFinalMergeFlag) {
      updateEndgameHint(false);
      return;
    }
    // 🔥 BUG FIX: If game is stuck (no moves), NEVER show STACK IT! - fail screen will show NO MOVES
    const checkContext: EndGameContext = { tiles, moves, makeBoard };
    const checkResult = checkEndGame(checkContext, true);
    if (checkResult.type === 'clean') {
      updateEndgameHint(false);
      return;
    }
    if (checkResult.type === 'stuck') {
      updateEndgameHint(false);
      return;
    }
    const hintTiles = getActiveTiles(tiles);
    // 🔥 USER BUG FIX: Use anyMergePossible to detect ALL stackable combos - not just "all regular"
    // Magnet + regular, wild + regular, 2 regulars - all should show STACK IT! when mergeable
    const hasTwoOrThree = hintTiles.length >= 2 && hintTiles.length <= 3;
    const canStack = hasTwoOrThree && makeBoard?.anyMergePossible?.(hintTiles) === true;
    // 🔥 UX: Don't show STACK IT! when wild (star/juice/TNT) is on board - merge is obvious
    const hasWild = hintTiles.some((t: any) => t?.special === 'wild' || t?.special === 'wild-juice' || t?.special === 'wild-tnt');
    const shouldShowHint = canStack && !hasWild;
    updateEndgameHint(shouldShowHint);
  } catch {}
}

// 🔥 REMOVED: showCleanBoardEdgeCase() - DEPRECATED function no longer needed
// Endgame checker handles all edge cases now

// 🔥 REMOVED: openLockedBounceParallel(k) - DEAD CODE, never called
// Was a wrapper for FLOW.openLockedBounceParallel but is not used anywhere

// -------------------- helpers --------------------
// 🔥 v112: sleep moved to app-core-utils.ts
// Imported: sleep

/** Kad krenu kockice u return (BOOM exit): razbi 4 random obične kockice (delay 0.5s nakon return start), merge 6 efekat + smoke, wild meter, spawn 4 nove. Samo obične, nikad wild. */
function runTntBoomBonusBreak2Tiles(deps: {
  board: any;
  dst: Tile;
  addWildProgress: (n: number) => void;
  WILD_INC_BIG: number;
  removeTile: (t: Tile) => void;
  openAtCell: (c: number, r: number, opts?: any) => Promise<unknown>;
  regularMerge6ShardsTemplated: (board: any, tile: any, opts?: any) => void;
  smokeBubblesAtTile: (board: any, tile: any, tileSize?: number, strength?: number, opts?: any) => void;
  TILE: number;
  devLog: (...args: any[]) => void;
  devWarn: (...args: any[]) => void;
  skipFx?: boolean;
  onComplete?: () => void;
}) {
  const { board, dst, addWildProgress, WILD_INC_BIG, removeTile, openAtCell, regularMerge6ShardsTemplated, smokeBubblesAtTile, TILE, devLog, devWarn, skipFx, onComplete } = deps;
  try {
    const getScreenPos = (tileForCenter: any) => {
      const local = centerInBoard(board, tileForCenter, TILE);
      try {
        if (board && typeof (board as any).toGlobal === 'function') {
          const global = (board as any).toGlobal({ x: local.x, y: local.y });
          if (global && Number.isFinite(global.x) && Number.isFinite(global.y)) {
            return { x: global.x, y: global.y };
          }
        }
      } catch {}
      return local;
    };
    const tntStarTexture = Texture.from('./assets/small-star.png');
    let hudStarPos: { x: number; y: number } | null = null;
    try {
      if (typeof HUD.getStarHudPosition === 'function') {
        hudStarPos = HUD.getStarHudPosition();
      }
    } catch {}
    if (!hudStarPos) hudStarPos = { x: 0, y: 0 };

    // Keep guard active while TNT bonus break/spawn sequence is running.
    tntBonusGuardUntil = Math.max(tntBonusGuardUntil, Date.now() + 2500);
    if ((dst as any)?._isLastMerge) {
      devLog('🔥 TNT boom bonus: skip (last merge - clean board)');
      try { onComplete?.(); } catch {}
      return;
    }
    const allTiles = STATE?.tiles || [];
    const candidates = allTiles.filter((t: Tile) => {
      if (!t || t.destroyed || t === dst) return false;
      const isWild = t.special === 'wild' || t.special === 'wild-magnet' || t.special === 'wild-juice' || t.special === 'wild-tnt';
      if (isWild) return false;
      const v = (t.value | 0);
      return v > 0 && v <= 6;
    });
    const count = Math.min(4, candidates.length);
    if (count < 1) {
      devLog('🔥 TNT boom bonus: no regular tiles to break');
      try { onComplete?.(); } catch {}
      return;
    }
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    const toBreak = shuffled.slice(0, count);
    const pool = [1, 2, 3, 4, 5];
    const used: number[] = [];
    toBreak.forEach((tile: Tile, i: number) => {
      const delay = i * 0.2; // 200ms stagger: break one-by-one
      const doBreak = () => {
        if (!tile || tile.destroyed || !board || !STATE?.tiles) return;
        const c = tile.gridX ?? 0;
        const r = tile.gridY ?? 0;
        // Wild preload: cap immediate gain to 2, delay remaining to reduce spike
        if (i < 2) {
          addWildProgress(WILD_INC_BIG);
        } else {
          const delayedGain = trackDelayedCall(0.4 + (i - 2) * 0.1, () => {
            addWildProgress(WILD_INC_BIG);
          });
          if (delayedGain) tntBoomDelayedCalls.push(delayedGain);
        }
        if (typeof (window as any).triggerHapticImpact === 'function') {
          (window as any).triggerHapticImpact('heavy');
        }
        // No shards for TNT bonus break; smoke handled on spawn
        // Shards + smoke should appear during the popout/transition, before new tile spawns
        if (!skipFx) {
          try { regularMerge6ShardsTemplated(board, tile, { zIndex: 9993 }); } catch (e) { devWarn('TNT boom bonus shards:', e); }
          try { smokeBubblesAtTile(board, tile, TILE * 1.0, 1.0, { sizeScale: 1.5, spawnShape: 'box' }); } catch (e) { devWarn('TNT transition smoke:', e); }
        }
        const oldValue = (tile.value | 0);
        const basePos = getScreenPos(tile);
        removeTile(tile);
        // ⭐ Wild TNT: 1 star per broken tile → HUD (ignore merge-6 1-3)
        try {
          const starPositions = [{
            texture: tntStarTexture,
            globalX: basePos.x,
            globalY: basePos.y,
            scale: { x: 0.55, y: 0.55 }
          }];
          // Fire-and-forget; use board/stage/app like other HUD star animations
          const appForAnimation = STATE.app || (STATE.stage as any)?.app;
          devLog('⭐ TNT bonus star: spawning from broken tile', {
            gridX: c,
            gridY: r,
            screenX: basePos.x,
            screenY: basePos.y
          });
          void animateStarsToHudIcon(board, STATE.stage, starPositions, basePos, basePos, hudStarPos, appForAnimation);
        } catch (e) {
          devWarn('⚠️ TNT bonus star animation failed:', e);
        }
        // 🔥 CRITICAL: TNT bonus replacement must NEVER keep the same value.
        // Prefer unique values across this TNT burst, but if that conflicts, keep "different from old" as source of truth.
        let available = pool.filter((v) => !used.includes(v) && v !== oldValue);
        if (available.length === 0) {
          available = pool.filter((v) => v !== oldValue);
        }
        const val = available[(Math.random() * available.length) | 0];
        used.push(val);
        openAtCell(c, r, { value: val, skipBind: false })
          .then(() => {
            lastTntBonusChangeAt = Date.now();
            tntBonusGuardUntil = Math.max(tntBonusGuardUntil, Date.now() + 1200);
          })
          .catch(() => {});
      };
      if (delay <= 0) {
        doBreak();
      } else {
        const dc = trackDelayedCall(delay, doBreak);
        if (dc) tntBoomDelayedCalls.push(dc);
      }
    });
    // Wait for TNT break FX (shards/smoke) to visually settle before returning
    // expanded tiles, so FX stays synced to break positions.
    const completionDelay = Math.max(0, (count - 1) * 0.2) + 0.75;
    const doneCall = trackDelayedCall(completionDelay, () => {
      try { onComplete?.(); } catch {}
    });
    if (doneCall) tntBoomDelayedCalls.push(doneCall);
    devLog('🔥 TNT boom bonus: broke', count, 'regular tiles, spawned new (stagger 100ms, smoke+shards)');
  } catch (e) {
    devWarn('TNT boom bonus break2 failed:', e);
    try { onComplete?.(); } catch {}
  }
}

function removeTile(t){
  if(!t || t.destroyed) return;

  // 🔥 CRITICAL: Clear cache BEFORE removing tile to prevent race conditions
  // This ensures checkEndGame gets fresh data even if called during removal
  const idx = tiles.indexOf(t);
  if (idx !== -1) {
    clearEndGameCache(); // Clear cache BEFORE splice
  }
  
  // 🔥 CRITICAL FIX: Clear grid position BEFORE removing tile
  // This ensures grid is clean and prevents merge 6 tile from becoming "stuck"
  if (t.gridX !== undefined && t.gridY !== undefined && grid && grid[t.gridY]) {
    if (grid[t.gridY][t.gridX] === t) {
      grid[t.gridY][t.gridX] = null;
      devLog(`🧹 removeTile (app-core): Cleared grid[${t.gridY}][${t.gridX}]`);
    }
  }
  
  try { if (t.hover && typeof t.hover.clear === 'function') t.hover.clear(); } catch {}
  t.eventMode='none'; if (t.removeAllListeners) t.removeAllListeners();
  if (t.hover && typeof t.hover.clear === 'function') t.hover.clear();
  try{ gsap.killTweensOf(t); gsap.killTweensOf(t.scale); gsap.killTweensOf(t.rotG);}catch{}
  // 🔥 MEMORY LEAK FIX: Cleanup all tile animations and intervals
  try { stopWildIdle?.(t); } catch {}
  try { stopWildShimmer?.(t); } catch {}
  try { stopWildStars?.(t); } catch {}
  try { stopWildJuiceBubbles?.(t); } catch {}
  try { stopMagnetIdleParticles?.(t); } catch {}
  try { stopTntIdleParticles?.(t); } catch {}
  try {
    delete (t as any)._wildMagnetAffected;
    delete (t as any)._wildMagnetOriginalX;
    delete (t as any)._wildMagnetOriginalY;
    delete (t as any)._wildMagnetPulledTilesMerge;
    delete (t as any)._wildMagnetPulledTilesScoring;
    delete (t as any)._wildMagnetMergeCallback;
    delete (t as any)._wildMagnetPulledCells;
    delete (t as any)._hasTilesToPull;
    delete (t as any)._skipMagnetPull;
    delete (t as any)._noTilesPulled;
  } catch {}
  board.removeChild(t);
  if (idx !== -1) {
    tiles.splice(idx, 1);
  }
  try { delete (t as any)._skipIdleScaleReset; } catch {}
  t.destroy?.({ children: true, texture: false, textureSource: false } as any);
}

// 🔥 COMBINED MERGE ANIMATION: Impact bump + single strong bounce
function playMergeImpactAndAbsorbAnimation(targetTile: any): void {
  if (!targetTile) return;

  // Ensure anchor/pivot is centered for proper scaling from center
  if (targetTile.anchor) {
    targetTile.anchor.set(0.5, 0.5);
  }

  // Create combined timeline: impact bump + strong bounce, all returning to exactly (1,1)
  const tl = animationManager.trackExternalTimeline(gsap.timeline({
    onComplete: () => {
      // Hard-reset to exactly (1, 1) to avoid floating-point drift
      if (targetTile.scale) {
        targetTile.scale.set(1, 1);
      }
    }
  }));

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

  devLog('🍬 Playing combined merge impact + absorb animation on tile');
}

async function showFinalScreen(){
  // 🔥 CRITICAL: Guard against multiple simultaneous calls
  if (busyEnding) {
    devWarn('⚠️ showFinalScreen: busyEnding is true, skipping duplicate call');
    return;
  }
  
  busyEnding = true;
  // Clear fail-screen-pending flag (busyEnding now covers this)
  (window as any).__ccFailScreenPending = false;

  // 🔥 FIX: Wrap in try/finally to ensure busyEnding is always reset
  try {
  // Clear NO MOVES splash if visible (shown during 1.5s wait before fail)
  try { clearNoMovesText(); } catch {}
  try { hideTerminalLockedArtifacts('showFinalScreen'); } catch {}
  // Extra safety: scrub any lingering magnet merge-6 residues before showing fail/clean flows
  forceRemoveMagnetMergeResidues('showFinalScreen');

  // 🔥 ENDGAME ANIMATION-WAIT: Let stars-to-HUD and wild-juice bubbles finish before fail modal
  try {
    await waitForOngoingAnimations(6000);
  } catch (e) {
    devWarn('⚠️ waitForOngoingAnimations failed (non-fatal):', e);
  }
  
  // 🔥 CRITICAL: Perform memory cleanup on game over (MEMORY LEAK FIX)
  devLog('🧹 Performing memory cleanup on game over...');
  try {
    memoryManager.performCleanup();
    devLog('✅ Memory cleanup completed');
  } catch (error) {
    devWarn('⚠️ Memory cleanup failed:', error);
  }
  
  // Haptic feedback for game over
  if (typeof (window as any).triggerHapticNotification === 'function') {
    (window as any).triggerHapticNotification('error');
  }
  
  // 🔥 USER BUG FIX: Show navigation BEFORE showing board fail modal
  // This ensures X button is visible when fail modal appears
  try {
    const { updateNavigationVisibility } = await import('./navigation-control.js');
    updateNavigationVisibility();
    devLog('✅ Navigation visibility updated before showing board fail modal');
  } catch (error) {
    devWarn('⚠️ Failed to update navigation visibility:', error);
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
    devError('❌ CRITICAL: Board fail modal failed - cannot show fail screen:', error);
    devError('❌ This should never happen. Check board-fail-modal.js for errors.');
    // Don't show old stars modal - it's deprecated and shows wrong UI
  }

  // 🔥 USER REQUEST: DO NOT update high score on fail!
  // High score is ONLY updated after successful clean board (in endgame-flow.ts)
  // Fail = ne updateamo high score
  devLog(`📊 Board ${boardNumber} failed - high score NOT updated (only on clean board success)`);
  updateHUD();

  if (result?.action === 'menu') {
    // 🔥 BUG FIX: exitToMenu is already called in board-fail-modal.ts when Exit button is clicked
    // Don't call it again here - it causes duplicate calls and blank screen
    // The modal already handles exitToMenu and waits for it to complete before resolving
    devLog('🚪 Exit action received - exitToMenu already called from board-fail-modal, skipping duplicate call');
  } else if (result?.action === 'no-hearts') {
    // 🔥 USER REQUEST: No hearts - hearts bottom sheet is shown, don't return to game
    devLog('💔 No hearts action - hearts bottom sheet shown, staying out of game');
    // App element is already hidden in board-fail-modal
  } else {
    // 'retry' action - functions are called directly from board-fail-modal now
    devLog('🎮 Play Again action received - functions called directly from modal');
  }
  } finally {
    try { setFinalMergeVisualSuppression(false); } catch {}
    // 🔥 FIX: Ensure busyEnding is always reset, even on error
    busyEnding = false;
  }
}

function restartGame(){
  devLog('🔄 Starting clean restart - preserving HUD position');
  
  // CRITICAL FIX: Reset game ended flag when restarting
  window._gameHasEnded = false;

  const killAllGsapTweensForRestart = () => {
    try {
      devLog('🔄 RESTART GAME: Killing GSAP animations...');
      
      // 🔥 CRITICAL: Stop tile idle bounce animations
      try {
        if (TILE_IDLE_BOUNCE && typeof TILE_IDLE_BOUNCE.stop === 'function') {
          TILE_IDLE_BOUNCE.stop();
          devLog('✅ RESTART GAME: Tile idle bounce stopped');
        }
      } catch {}
      
      // 🔥 CRITICAL: Cleanup combo animations
      try {
        if (typeof HUD.cleanupComboAnimations === 'function') {
          HUD.cleanupComboAnimations();
          devLog('✅ RESTART GAME: Combo animations cleaned up');
        }
      } catch {}
      
      // 🔥 CRITICAL: Kill combo idle timer
      try { 
        if (comboIdleTimer) {
          if (typeof (comboIdleTimer as any).kill === 'function') {
            (comboIdleTimer as any).kill();
          } else if (typeof comboIdleTimer === 'number') {
            clearTimeout(comboIdleTimer);
          }
        }
        comboIdleTimer = null;
        devLog('✅ RESTART GAME: Combo idle timer killed');
      } catch {}
      
      // 🔥 CRITICAL: Stop wild loader animations and clear smoke interval (prevents memory leak)
      if (wild?.view?._smokeInterval) {
        clearInterval(wild.view._smokeInterval);
        wild.view._smokeInterval = null;
        devLog('✅ RESTART GAME: Wild meter smoke interval cleared');
      }
      gsap.killTweensOf(wild?.view?._fill);
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
        devLog('✅ RESTART GAME: HUD progress bar animations killed');
      } catch {}
      
      // CRITICAL: Stop per-tile animations before GSAP cleanup
      if (STATE && STATE.tiles && STATE.tiles.length > 0) {
        devLog('🔄 RESTART GAME: Killing GSAP animations for', STATE.tiles.length, 'tiles...');
        STATE.tiles.forEach(tile => {
          try {
            try { stopWildIdle?.(tile); } catch {}
            try { stopWildShimmer?.(tile); } catch {}
            try { stopWildStars?.(tile); } catch {}
            try { stopWildJuiceBubbles?.(tile); } catch {}
            try { stopMagnetIdleParticles?.(tile); } catch {}
            try { stopTntIdleParticles?.(tile); } catch {}
            if ((tile as any)?._glowAnimation) {
              try { (tile as any)._glowAnimation.kill(); } catch {}
              (tile as any)._glowAnimation = null;
            }
          } catch {}
        });
        devLog('✅ RESTART GAME: Tile GSAP animations killed');
      }
      
      // Kill HUD animations
      if (STATE && STATE.hud) {
        try {
          devLog('🔄 RESTART GAME: Killing HUD GSAP animations...');
          gsap.killTweensOf(STATE.hud);
          gsap.killTweensOf(STATE.board);
          gsap.killTweensOf(STATE.stage);
          devLog('✅ RESTART GAME: HUD GSAP animations killed');
        } catch {}
      }
      
      killAllGsapTweensCommon(STATE?.tiles || tiles, 'restart', { clearTimeline: true });
    } catch (e) {
      devWarn('⚠️ RESTART GAME: Error killing GSAP animations:', e);
    }
  };
  
  // CRITICAL: Update high score before restart using statsService
  try {
    if (typeof score !== 'undefined' && score > 0) {
      devLog('🏆 Updating high score before restart:', score);
      statsService.updateHighScore(score);
      if (isArcadeHomeRunMode()) {
        arcadeStatsService.updateHighScore(score);
      }
    }
  } catch (error) {
    devWarn('⚠️ Failed to update high score during restart:', error);
  }

  // Centralized FX cleanup (non-destructive to the app)
  cleanupFxForBoardReset('restartGame');
  
  // Kill all GSAP animations first - CRITICAL to prevent null reference errors
  killAllGsapTweensForRestart();
  
  // CRITICAL: Cleanup smoke bubbles before restart
  try {
    if (typeof HUD.cleanupSmokeBubbles === 'function') {
      HUD.cleanupSmokeBubbles();
      devLog('✅ RESTART GAME: Smoke bubbles cleaned up');
    }
  } catch {}
  
  // 🔥 NOTE: FX cleanup already handled by cleanupFxForBoardReset() at start of restartGame()
  
  // 🔥 CRITICAL: Cleanup confetti animations before restart (MEMORY LEAK FIX)
  try {
    import('./confetti-system.js').then(confettiModule => {
      if (confettiModule && typeof confettiModule.cleanupConfetti === 'function') {
        confettiModule.cleanupConfetti();
      }
    }).catch(() => {
      // Ignore import errors
    });
  } catch {}
  
  // 🔥 USER REQUEST: Keep current boardNumber (don't reset to 1)
  // This ensures Play Again restarts the same board, not board 1
  const currentBoard = boardNumber || 1;
  devLog(`🔄 RESTART: Keeping current board ${currentBoard} (not resetting to 1)`);
  
  // Reset game state WITHOUT touching HUD positioning or boardNumber
  score = 0;
  // boardNumber stays the same - don't reset to 1!
  moves = MOVES_MAX;
  hudResetCombo();
  try { 
    if (comboIdleTimer) {
      if (typeof (comboIdleTimer as any).kill === 'function') {
        (comboIdleTimer as any).kill();
      } else if (typeof comboIdleTimer === 'number') {
        clearTimeout(comboIdleTimer);
      }
    }
  } catch {}
  wildMeter = 0;
  resetWildProgress(0, false);
  
  // HARD RESET: Use new resetWildMeter API for complete reset
  devLog('🔥 HARD RESET: Resetting wild meter to 0');
  try {
    if (typeof HUD.resetWildMeter === 'function') {
      HUD.resetWildMeter(true); // instant = true for immediate reset
    } else {
      devLog('🔄 FALLBACK: Using HUD.updateProgressBar with 0...');
      HUD.updateProgressBar?.(0, false);
    }
    devLog('✅ HARD RESET: Wild meter reset to 0 successfully');
  } catch (error) {
    devError('❌ HARD RESET: Error resetting wild meter:', error);
  }
  
  // Reset both wild meter variables
  wildMeter = 0;
  STATE.wildMeter = 0;

  // 🔥 CRITICAL FIX: Reset star count when restarting from end game bottom sheet
  try {
    devLog('🔄 RESTART GAME: Resetting star count...');
    // Reset stars collector via window.CC.setStarsCount (exported above)
    if (typeof (window as any).CC?.setStarsCount === 'function') {
      (window as any).CC.setStarsCount(0);
      devLog('✅ RESTART GAME: Star count reset to 0');
    } else {
      // Fallback: try to import and reset directly
      import('./stars-collector.js').then((StarsCollector) => {
        if (typeof StarsCollector.setStarsCount === 'function') {
          StarsCollector.setStarsCount(0);
          devLog('✅ RESTART GAME: Star count reset to 0 (via import)');
        }
      }).catch((err) => {
        devWarn('⚠️ RESTART GAME: Failed to reset star count:', err);
      });
    }
  } catch (error) {
    devWarn('⚠️ RESTART GAME: Error resetting star count:', error);
  }

  // EDGE CASE PROTECTION: Force wild meter reset with multiple methods
  try {
    devLog('🛡️ EDGE CASE: Force resetting wild meter with multiple methods...');
    
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
      devLog('🔄 EDGE CASE: Calling HUD.updateProgressBar(0, false)...');
      HUD.updateProgressBar(0, false);
    }
    
    // Method 5: Force reset wild loader
    if (typeof HUD.resetWildLoader === 'function') {
      devLog('🔄 EDGE CASE: Calling HUD.resetWildLoader...');
      HUD.resetWildLoader();
    }
    
    // Method 6: Force update HUD
    updateHUD();
    
    // Method 7: Direct PIXI manipulation - force reset wild loader mask
    try {
      // Also try direct access to wild loader if available
      if (typeof wild !== 'undefined' && wild && wild.setProgress) {
        devLog('🔄 EDGE CASE: Direct wild.setProgress(0, false)...');
        wild.setProgress(0, false);
      }
    } catch (e) {
      devWarn('EDGE CASE: Direct PIXI reset failed:', e);
    }
    
    devLog('✅ EDGE CASE: Wild meter force reset completed');
  } catch (error) {
    devError('❌ EDGE CASE: Error in force reset:', error);
  }
  
  // 🔥 CRITICAL FIX: Clear saved game state from localStorage before restarting
  // This ensures we get a FRESH board, not the stuck/failed state
  try {
    localStorage.removeItem('cc_saved_game');
    devLog('✅ RESTART: Cleared stuck game state from localStorage');
  } catch (e) {
    devWarn('⚠️ RESTART: Failed to clear localStorage:', e);
  }
  
  // 🔥 CRITICAL FIX: Clear __ccSkipRebuildBoard flag to force fresh board
  delete window.__ccSkipRebuildBoard;
  logger.debug('✅ RESTART: Cleared __ccSkipRebuildBoard flag - will rebuild fresh board', 'app-core');
  
  // 🔥 NOTE: cleanupGame() is NOT called here because it destroys the PIXI app
  // cleanupGame() is only for complete game exit (exit to menu), not for restart
  // restartGame() already has comprehensive cleanup (GSAP animations, confetti, effects, etc.)
  // without destroying the app, which allows startLevel() to work properly
  
  // 🔥 OPTIMIZATION: Clear tracked app timeouts BEFORE starting the new level
  clearAllAppTimeouts();

  // 🔥 USER REQUEST: Call startLevel() with current boardNumber instead of just rebuildBoard()
  // This ensures board-specific rules are applied and the correct board is restarted
  devLog(`🔄 RESTART: Calling startLevel(${currentBoard}) to restart board ${currentBoard}...`);
  startLevel(currentBoard);
  devLog(`✅ RESTART: startLevel(${currentBoard}) completed`);
  
  // Reinitialize background layer if it was lost
  if (!backgroundLayer) {
    devLog('🔄 RESTART: Reinitializing background layer...');
    initializeBackgroundLayer();
    devLog('✅ RESTART: Background layer reinitialized');
  }
  
  updateHUD();
  
  // 🔥 CRITICAL: Cleanup confetti animations (cleanup all timeouts/intervals/DOM elements)
  // This must be called BEFORE killAllDelayedCalls to ensure all confetti timeouts are cleared
  try {
    import('./confetti-system.js').then(confettiModule => {
      if (confettiModule && typeof confettiModule.cleanupConfetti === 'function') {
        confettiModule.cleanupConfetti();
      }
    }).catch(() => {
      // Ignore import errors
    });
  } catch (e) {
    // Ignore errors
  }
  
  // Ensure game is resumed after restart
  try {
    gsap.globalTimeline.resume();
    app.ticker.start();
    devLog('✅ Game resumed after restart');
  } catch (error) {
    devWarn('Failed to resume game after restart:', error);
  }
  
  devLog('✅ Clean restart completed - HUD position preserved');
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
  devLog('🔄 RESTART: Starting restart function');
  
  // 🔥 JOURNEY PROGRESSION: Update state when restarting (retry after failure)
  // Keep lastOpenedBoardId and set currentRunState for the same board
  try {
    import('./journey-progression-state.js').then(({ journeyProgressionState }) => {
      const currentBoardId = boardNumber || 1;
      journeyProgressionState.setLastOpenedBoardId(currentBoardId);
      journeyProgressionState.setCurrentRunState(currentBoardId, 0);
      devLog(`🗺️ Journey: Restarting board ${currentBoardId} - lastOpenedBoardId and currentRunState updated`);
    }).catch((error) => {
      devWarn('⚠️ Failed to update Journey progression state on restart:', error);
    });
  } catch (error) {
    devWarn('⚠️ Failed to update Journey progression state on restart:', error);
  }
  
  devLog('🔄 RESTART: About to call restartGame()...');
  restartGame();
  devLog('✅ RESTART: restartGame() completed');
}

// Clean up game when exiting
export function cleanupGame() {
  devLog('🧹 Cleaning up game state');
  
  // 🔥 CRITICAL FIX: Stop PIXI ticker FIRST to prevent render errors during cleanup
  // This prevents "Cannot read properties of null (reading '_x')" errors
  try {
    if (app && app.ticker) {
      app.ticker.stop();
      devLog('✅ PIXI ticker stopped for cleanup');
    }
  } catch (e) {
    devWarn('⚠️ Failed to stop ticker:', e);
  }
  
  // 🔥 CRITICAL FIX: Stop and reset tile idle bounce animations
  try {
    TILE_IDLE_BOUNCE.stop();
    if (TILE_IDLE_BOUNCE.reset) {
      TILE_IDLE_BOUNCE.reset();
    }
    devLog('✅ Tile idle bounce stopped and reset');
  } catch (error) {
    devWarn('⚠️ Failed to stop/reset tile idle bounce:', error);
  }
  
  // CRITICAL: Update high score before cleanup using statsService
  try {
    if (typeof score !== 'undefined' && score > 0) {
      devLog('🏆 Updating high score before cleanup:', score);
      statsService.updateHighScore(score);
      if (isArcadeHomeRunMode()) {
        arcadeStatsService.updateHighScore(score);
      }
    }
  } catch (error) {
    devWarn('⚠️ Failed to update high score during cleanup:', error);
  }
  
  // 🔥 CRITICAL FIX: Kill all GSAP tweens BEFORE destroying objects
  // This prevents "Cannot read properties of null (reading 'y')" errors
  killAllGsapTweensCommon(tiles, 'cleanup');
  try { gsap.killTweensOf([hud, board, stage]); } catch {}

  // 🔥 Explicit wild-TNT animation cleanup (same as wild-juice / stars)
  try {
    stopTntAnimation?.();
    devLog('✅ TNT animation cleaned up in cleanupGame()');
  } catch (e) {
    devWarn('⚠️ Failed to cleanup TNT animation:', e);
  }
  try {
    stopSparkleText?.();
  } catch (e) {
    devWarn('⚠️ Failed to cleanup SPARKLE text:', e);
  }
  
  // 🔥 NOTE: Global delayed calls/graphics cleanup handled by cleanupFxForBoardReset('cleanupGame')
  
  // CRITICAL: Reset HUD initialization flag
  _hudInitDone = false;
  // Prepare HUD drop for next entry from menu
  _hudDropPending = true;
  devLog('✅ HUD initialization flag reset');
  
  // Reset all game state
  score = 0;
  boardNumber = 1;
  moves = MOVES_MAX;
  level = 1;
  combo = 0;
  wildMeter = 0;
  busyEnding = false;
  
  // Clear timers
  try { 
    if (comboIdleTimer) {
      if (typeof (comboIdleTimer as any).kill === 'function') {
        (comboIdleTimer as any).kill();
      } else if (typeof comboIdleTimer === 'number') {
        clearTimeout(comboIdleTimer);
      }
    }
  } catch {}
  comboIdleTimer = null;
  
  // 🔥 CRITICAL FIX: Clear all tracked timeouts
  clearAllAppTimeouts();
  
  // 🔥 CRITICAL FIX: Clear all tracked requestAnimationFrame callbacks
  clearAllAppAnimationFrames();
  
  // 🔥 CRITICAL FIX: Clear all tracked intervals
  clearAllAppIntervals();
  
  // 🔥 CRITICAL FIX: Clear all tracked app-core event listeners
  clearAllAppListeners();
  
  // 🔥 CRITICAL FIX: Remove event listeners properly
  // Remove resize listeners for layoutBoard and layout
  try { 
    window.removeEventListener('resize', layoutBoard); 
  } catch (e) {
    devWarn('⚠️ Failed to remove resize listener:', e);
  }
  // Note: 'layout' function was removed - this listener cleanup is no longer needed
  
  // 🔥 CRITICAL FIX: Remove HUD resize listener (stored in HUD_ROOT._onResize)
  // This is the MAIN MEMORY LEAK - HUD_ROOT._onResize listener is never removed!
  try {
    const hudRoot = (window as any).HUD_ROOT;
    if (hudRoot && hudRoot._onResize) {
      window.removeEventListener('resize', hudRoot._onResize);
      devLog('✅ HUD resize listener removed (HUD_ROOT._onResize)');
      hudRoot._onResize = null; // Clear reference
    }
  } catch (e) {
    devWarn('⚠️ Failed to remove HUD resize listener:', e);
  }
  
  // 🔥 CRITICAL FIX: Cleanup HUD lifecycle listeners (screen lifecycle helper)
  try { HUD.cleanupHudLifecycle?.(); } catch {}
  
  // Reset wild progress (with safety check for HUD)
  try {
    if (HUD && typeof HUD.resetWildLoader === 'function') {
      resetWildProgress(0, false);
      HUD.resetWildLoader();
    }
  } catch (error) {
    devLog('⚠️ Wild progress reset skipped (HUD already destroyed):', error);
  }
  
  // Clear tiles and grid
  if (tiles) {
    tiles.forEach(t => {
      // 🔥 MEMORY LEAK FIX: Cleanup all tile animations and intervals before destroy
      try { stopWildIdle?.(t); } catch {}
      try { stopWildShimmer?.(t); } catch {}
      try { stopWildStars?.(t); } catch {}
      try { stopWildJuiceBubbles?.(t); } catch {}
      try { stopMagnetIdleParticles?.(t); } catch {}
      try { stopTntIdleParticles?.(t); } catch {}
      try { t.destroy?.({ children: true, texture: false, textureSource: false } as any); } catch {}
    });
    tiles.length = 0;
  }
  
  // 🔥 CRITICAL FIX: Cleanup wild juice explosion (GSAP ticker + PIXI containers)
  // 🔥 BUBBLES ANIMATION FIX: Always cleanup to prevent stale state (even if flag says inactive)
  // 🔥 STARS ANIMATION FIX: Cleanup stars-to-HUD animations to prevent memory leaks
  try {
    if (typeof isWildJuiceBubblesExplosionActive === 'function' && typeof stopWildJuiceBubblesExplosion === 'function') {
      const wasActive = isWildJuiceBubblesExplosionActive();
      // Always cleanup (even if flag says inactive) to handle stale containers/flags
      stopWildJuiceBubblesExplosion();
      if (wasActive) {
        devLog('✅ Wild juice explosion cleaned up in cleanupGame()');
      } else {
        devLog('✅ Wild juice explosion force cleaned up in cleanupGame() (stale state prevention)');
      }
    }
    
    // 🔥 CRITICAL FIX: Release cached bubble texture to free GPU memory on hard cleanup
    try {
      destroyWildJuiceBubblesExplosionCache?.();
      devLog('✅ Wild juice bubble texture cache destroyed');
    } catch {}
    
    // 🔥 STARS ANIMATION FIX: Force cleanup ALL stars-to-HUD animations (including protected)
    // Use force cleanup in cleanupGame() because we're closing the game completely
    if (typeof forceCleanupAllStarAnimations === 'function') {
      forceCleanupAllStarAnimations();
      devLog('✅ Stars-to-HUD animations force cleaned up in cleanupGame()');
    } else if (typeof cleanupExistingStarAnimations === 'function') {
      // Fallback to regular cleanup if force cleanup not available
      cleanupExistingStarAnimations();
      devLog('✅ Stars-to-HUD animations cleaned up in cleanupGame()');
    }
  } catch (e) {
    devWarn('⚠️ Failed to cleanup animations:', e);
    // 🔥 CRITICAL: Force cleanup on error (prevents stuck state)
    try {
      if (typeof stopWildJuiceBubblesExplosion === 'function') {
        stopWildJuiceBubblesExplosion();
      }
      // 🔥 STARS ANIMATION FIX: Force cleanup stars animations on error
      if (typeof cleanupExistingStarAnimations === 'function') {
        cleanupExistingStarAnimations();
      }
    } catch {}
  }
  
  // 🔥 FIX: Cleanup hearts system (timer and resources)
  try {
    heartsSystem.cleanup();
    cleanupAllHeartsResources();
    devLog('✅ Hearts system cleaned up in cleanupGame()');
  } catch (e) {
    devWarn('⚠️ Failed to cleanup hearts system:', e);
  }
  
  // 🔥 FIX: Cleanup level flow timeouts
  try {
    FLOW.cleanupLevelFlowTimeouts();
    devLog('✅ Level flow timeouts cleaned up in cleanupGame()');
  } catch (e) {
    devWarn('⚠️ Failed to cleanup level flow timeouts:', e);
  }

  // 🔥 MEMORY: Perform aggressive texture cleanup on full exit
  try {
    cleanupTexturesForBoardTransition('cleanupGame', true);
    memoryManager.performCleanup?.();
  } catch (e) {
    devWarn('⚠️ cleanupGame memory cleanup failed:', e);
  }
  
  if (grid) {
    createEmptyGrid();
  }
  
  // 🔥 CRITICAL FIX: Cleanup background layer BEFORE clearing board
  if (backgroundLayer) {
    try {
      if (board && board.children.includes(backgroundLayer)) {
        board.removeChild(backgroundLayer);
        devLog('✅ Background layer removed from board');
      }
      backgroundLayer.destroy({ children: true });
      devLog('✅ Background layer destroyed');
    } catch (e) {
      devWarn('⚠️ Error destroying background layer:', e);
    }
    backgroundLayer = null; // 🔥 CRITICAL: Nullify reference to prevent memory leak
    devLog('✅ Background layer reference nullified');
  }
  
  // 🔥 CRITICAL FIX: Clear window global variables to prevent memory leaks
  try {
    window._ghostPlaceholders = null;
    window._userMadeMove = false;
    window._gameHasEnded = false;
    devLog('✅ Window global variables cleared');
  } catch (e) {
    devWarn('⚠️ Failed to clear window globals:', e);
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
    devLog('✅ Memory manager stopped');
  } catch (e) {
    devWarn('⚠️ Failed to stop memory manager:', e);
  }

  // Clear global FX layer + FX state (prevents stale transforms after hard exit)
  cleanupFxForBoardReset('cleanupGame');
  
  // CRITICAL: Destroy and nullify app so boot() can create a new one
  if (app) {
    devLog('🧹 Destroying PIXI app in cleanupGame()');
    try {
      // 🔥 FIX: Don't destroy textures - they're managed by Assets and should be unloaded, not destroyed
      // Using texture: false prevents "A Texture managed by Assets was destroyed" warning
      app.destroy(true, { children: true, texture: false, textureSource: false } as any);
      devLog('✅ PIXI app destroyed in cleanupGame()');
    } catch (e) {
      devLog('⚠️ Error destroying app in cleanupGame():', e);
    }
    app = null as any;
    devLog('✅ app set to null');
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
      devLog('✅ HUD_ROOT reference cleared');
    }
  } catch (e) {
    devWarn('⚠️ Failed to clear HUD_ROOT:', e);
  }
  
  // 🔥 CRITICAL: Clear window.HUD exports to avoid retaining old HUD closures
  try {
    if ((window as any).HUD) {
      (window as any).HUD = null;
      devLog('✅ window.HUD reference cleared');
    }
  } catch (e) {
    devWarn('⚠️ Failed to clear window.HUD:', e);
  }
  
  // 🔥 CRITICAL: Cleanup screen lifecycles (modal/transition)
  try {
    import('./clean-board-modal.js').then(m => m.cleanupCleanBoardModalLifecycle?.()).catch(() => {});
    import('./board-transition-screen.js').then(m => m.cleanupBoardTransitionScreen?.()).catch(() => {});
  } catch {}
  
  // 🍎 iOS CRITICAL FIX: Remove iOS lifecycle event listeners (pagehide, visibilitychange)
  // These listeners accumulate on every game restart and cause MASSIVE memory leaks on iOS!
  // iOS WKWebView has strict memory limits (~200MB) - every listener leak brings us closer to crash!
  try {
    const saveGameStateRef = (window as any)._saveGameStateRef;
    const iosVisibilityHandler = (window as any)._iosVisibilityHandler;
    
    if (saveGameStateRef) {
      window.removeEventListener('pagehide', saveGameStateRef);
      devLog('✅ iOS pagehide listener removed (app-core.ts)');
      (window as any)._saveGameStateRef = null;
    }
    
    if (iosVisibilityHandler) {
      window.removeEventListener('visibilitychange', iosVisibilityHandler);
      devLog('✅ iOS visibilitychange listener removed (app-core.ts)');
      (window as any)._iosVisibilityHandler = null;
    }
  } catch (e) {
    devWarn('⚠️ Failed to remove iOS lifecycle listeners:', e);
  }
  
  // 🔥 CRITICAL: Remove remaining lifecycle listeners (beforeunload/pause/resume)
  try {
    const saveGameStateRef = (window as any)._saveGameStateResumeRef;
    const resumeHandler = (window as any)._resumeHandlerRef;
    
    if (saveGameStateRef) {
      window.removeEventListener('beforeunload', saveGameStateRef);
      document.removeEventListener('pause', saveGameStateRef, false);
      (window as any)._saveGameStateResumeRef = null;
      devLog('✅ beforeunload/pause listeners removed');
    }
    
    if (resumeHandler) {
      document.removeEventListener('resume', resumeHandler, false);
      (window as any)._resumeHandlerRef = null;
      devLog('✅ resume listener removed');
    }
  } catch (e) {
    devWarn('⚠️ Failed to remove lifecycle listeners:', e);
  }
  
  devLog('✅ Game cleanup completed');
  syncSharedState();
}

// Start fresh game (for re-entering) - now just calls boot
export function startFreshGame() {
  devLog('🎮 Starting fresh game - calling boot');
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
  saveGameTimer = trackAppTimeout(() => {
    saveGameTimer = null;
    saveGameState();
  }, delayMs);
  
  devLog(`💾 Debounced save scheduled in ${delayMs}ms`);
}

function saveGameState() {
  try {
    syncSharedState();
    
    // DEBUG: Log current state
    devLog('💾 saveGameState called:', {
      boardNumber,
      _userMadeMove: window._userMadeMove,
      _gameHasEnded: window._gameHasEnded,
      score,
      tilesCount: tiles.length,
      activeTilesCount: tiles.filter(t => t && !t.locked && (t.value|0) > 0).length
    });
    
    if (!canSaveGameState({
      boardNumber,
      userMadeMove: !!(window as any)._userMadeMove,
      gameHasEnded: !!(window as any)._gameHasEnded,
      gridReady: Array.isArray(grid) && grid.length > 0,
      runMode: (window as any).__ccRunMode ?? null,
      cameFromJourney: (window as any).__ccCameFromJourney === true
        || localStorage.getItem('__ccCameFromJourney') === 'true',
      cameFromInterimBoard: (window as any).__ccFromInterimBoard === true
        || localStorage.getItem('__ccFromInterimBoard') === 'true'
        || (window as any).__ccIsInterimBoard === true,
      devLog,
    })) {
      return;
    }
    
    // 🔥 CRITICAL FIX: Save all tiles from tiles array, not just from grid
    // This ensures no tiles are lost during save (e.g., tiles with inconsistent grid positions)
    const { gridSnapshot } = buildGridSnapshot({
      ROWS,
      COLS,
      tiles,
      grid,
      devLog,
      devWarn,
    });

    // 🔥 CRITICAL FIX: Get stars count from stars collector before saving
    const savedStarsCount = getStarsCountForSave({ StarsCollector, devLog, devWarn });
    const currentState = buildSaveState({
      gridSnapshot,
      score,
      level,
      boardNumber,
      moves,
      wildMeter,
      bestScore: STATE.bestScore,
      starsCount: savedStarsCount,
      MOVES_MAX,
      devLog,
    });

    const serialized = JSON.stringify(currentState);
    if (serialized !== lastSavedState) {
      // 🔥 USER REQUEST: Board-specific save state - each board has its own save
      // This prevents conflicts when switching between boards (e.g., Board 07 → Board 03)
      const saveKey = getBoardSaveKey(boardNumber);
      localStorage.setItem(saveKey, serialized);
      lastSavedState = serialized;
      devLog(`💾 Game state saved successfully for board ${boardNumber} (${saveKey}) - state changed.`);
    } else {
      devLog(`💾 Game state unchanged for board ${boardNumber}, skipping save.`);
    }
  } catch (error) {
    devWarn('⚠️ Failed to save game state:', error);
  }
}

async function loadGameState(overrideBoardNumber?: number) {
  const boardToLoad = Number.isFinite(overrideBoardNumber) ? overrideBoardNumber! : boardNumber;
  devLog('🔄 loadGameState called...', overrideBoardNumber != null ? `(override: board ${boardToLoad})` : '');
  
  try {
    const saved = loadSavedBoardState({ boardNumber: boardToLoad, getBoardSaveKey, devLog, devWarn });
    if (!saved) {
      logger.warn(`⚠️ loadGameState: no saved state for board ${boardToLoad} (${getBoardSaveKey(boardToLoad)}) - will rebuild`);
      devLog('🔄 loadGameState: no saved state for board', boardToLoad, '- returning false');
      (window as any).__ccEnterAnimationActive = false;
      return false;
    }
    const { gameState } = saved;

    await ensureAppReadyForLoad({
      app,
      board,
      backgroundLayer,
      setBackgroundLayer: (v) => { backgroundLayer = v; },
      layoutBoard,
      initializeBackgroundLayer,
      boot,
      devLog,
    });

    restoreTilesFromSave({
      gameState,
      tiles,
      grid,
      ROWS,
      COLS,
      board,
      makeBoard,
      createEmptyGrid,
      stopWildIdle,
      applyWildSkinLocal,
      startWildShimmer,
      stopWildShimmer,
      startMagnetIdleParticles,
      stopMagnetIdleParticles,
      startTntIdleParticles,
      stopTntIdleParticles,
      startTntIdleShake,
      stopTntIdleShake,
      startWildJuiceBubbles,
      trackAppTimeout,
      STATE,
      devLog,
      devWarn,
      devError,
      setWildJuiceSpawned: (v) => { wildJuiceSpawned = v; },
    });

    board?.sortChildren?.();

    const restored = restoreBasicState({
      gameState,
      MOVES_MAX,
      STATE,
      setScore: (v) => { score = v; },
      setLevel: (v) => { level = v; },
      setBoardNumber: (v) => { boardNumber = v; },
      setMoves: (v) => { moves = v; },
      setWildMeter: (v) => { wildMeter = v; },
      devLog,
    });

    applyRulesAfterLoad({
      boardNumber: restored.boardNumber,
      syncSharedState,
      boardSpecificRules,
      drawBoardBG,
      devLog,
    });

    // Hide ghosts before any await so no frame paints with placeholders during load pop-in path
    try { hideGhostPlaceholders(); } catch {}
    
    await ensureDragReadyAndRebind({
      STATE,
      tiles,
      waitTracked,
      devLog,
      devWarn,
      devError,
    });
    
    await layoutAndRestoreStars({
      layoutBoard,
      StarsCollector,
      HUD,
      savedStarsCount: restored.savedStarsCount,
      devLog,
      devWarn,
    });
    
    ensureHudAfterLoad({
      app,
      hud,
      HUD,
      getHudRootFromWindow: () => (window as any).HUD_ROOT || null,
      trackAppAnimationFrame,
      devLog,
      devWarn,
      devError,
      isHudDropPending: () => _hudDropPending,
      setHudDropPending: (v) => { _hudDropPending = v; },
    });
    
    // 🔥 CRITICAL FIX: Update HUD AFTER boardNumber is restored and state is synced
    // This ensures HUD displays the correct board number
    updateHUD();
    devLog('✅ HUD updated with boardNumber:', boardNumber);
    resetWildProgress(wildMeter, true);
    
    // CRITICAL: Set _userMadeMove flag to true after loading saved game
    // This ensures that any future moves after Continue will trigger save
    markUserMoveAfterLoad({ devLog });
    
    // CRITICAL: Resume GSAP and PIXI after loading
    resumeRuntimeAfterLoad({ app, gsap, devLog, devWarn });
    
    // 🔥 CRITICAL: Check if tiles were actually loaded BEFORE starting pop-in animation
    // Fail fast so we don't animate then rebuild; also ensures we don't treat valid restore as empty
    lastSavedState = localStorage.getItem(getBoardSaveKey(boardNumber));
    const activeCount = tiles.filter(t => t && !t.locked && (t.value | 0) > 0).length;
    const emptyLoadResult = handleEmptyLoadState({
      tiles,
      boardNumber,
      getPendingCleanBoard,
      clearPendingCleanBoard,
      getBoardSaveKey,
      triggerCleanBoardFlow,
      trackAppTimeout,
      devLog,
      devWarn,
    });

    if (emptyLoadResult.handled) {
      logger.warn(`⚠️ loadGameState: empty/invalid load for board ${boardNumber} (tiles: ${tiles.length}, active: ${activeCount}) - will rebuild`);
      devLog('🔄 loadGameState: empty/invalid load handled (no active tiles) - returning false');
      (window as any).__ccEnterAnimationActive = false;
      if (Number.isFinite(emptyLoadResult.nextBoardNumber)) {
        boardNumber = emptyLoadResult.nextBoardNumber!;
        level = emptyLoadResult.nextBoardNumber!;
      }
      return false;
    }

    devLog('✅ Game state loaded successfully with', tiles.length, 'tiles (', activeCount, 'active)');
    
    // ANIMATION: Show ghost placeholders FIRST, then animate tiles (only after we know load is valid)
    playLoadPopInAnimation({
      tiles,
      backgroundLayer,
      sweetPopIn,
      onHalf: () => {
        // 🔥 CRITICAL FIX: Ensure HUD drop is triggered even if it wasn't triggered above
        // This is a fallback in case HUD drop wasn't triggered earlier
        triggerHudDropIfPending({
          HUD,
          app,
          trackAppAnimationFrame,
          devLog,
          devWarn,
          isHudDropPending: () => _hudDropPending,
          setHudDropPending: (v) => { _hudDropPending = v; },
        });
        // 🔥 UX: Stronger haptic on mid pop-in (double heavy tap) for load/continue path
        try {
          if (typeof (window as any).triggerHapticImpact === 'function') {
            (window as any).triggerHapticImpact('heavy');
            trackAppTimeout(() => {
              try { (window as any).triggerHapticImpact?.('heavy'); } catch {}
            }, 300);
          }
        } catch {}
      },
      onComplete: () => {
        // 🔥 CRITICAL FIX: Final check - ensure HUD is visible and positioned after animation
        ensureHudFinalPosition({
          getHudRoot: () => (window as any).HUD_ROOT || HUD.HUD_ROOT || null,
          devLog,
          devWarn,
        });
      },
      devLog,
    });
    
    // 🔥 BOARD RECOVERY: Schedule recovery check after UI settles
    schedulePostLoadRecoveryCheck({
      tiles,
      boardNumber,
      checkAndRecoverBoard,
      triggerCleanBoardFlow,
      trackAppTimeout,
      devLog,
      devWarn,
    }); // Wait 1s for UI to fully settle before recovery check
    
    return true;
  } catch (error) {
    logger.error('❌ loadGameState failed (exception):', error instanceof Error ? error.message : String(error));
    devError('❌ Failed to load game state:', error);
  }
  devLog('🔄 loadGameState returning false (exception or early exit)');
  return false;
}

// Resume Game Modal
async function showResumeGameModal(): Promise<void> {
  return new Promise<void>(resolve => {
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
      'background: url(\'../../assets/modals/paper.png\')',
      'background-size: cover',
      'background-position: center',
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

// 🔥 CRITICAL: Function to stop PIXI ticker immediately - prevents _x null errors during cleanup
function stopPixiTicker(): boolean {
  try {
    const pixiApp = app || STATE?.app;
    if (pixiApp && pixiApp.ticker) {
      pixiApp.ticker.stop();
      devLog('✅ stopPixiTicker: PIXI ticker stopped');
      return true;
    }
    devWarn('⚠️ stopPixiTicker: No PIXI app/ticker found');
    return false;
  } catch (e) {
    devWarn('⚠️ stopPixiTicker failed:', e);
    return false;
  }
}

// Expose functions globally
window.saveGameState = saveGameState;
window.loadGameState = loadGameState;
window.showResumeGameModal = showResumeGameModal;
window.drawBoardBG = drawBoardBG;
window.animateBoardExit = animateBoardExit; // Export for exitToMenu
(window as any).stopPixiTicker = stopPixiTicker; // Export for exit cleanup

// Export drawBoardBG and animateBoardExit for other modules
export { drawBoardBG, animateBoardExit };


// Mobile-specific save events
// 🍎 iOS CRITICAL FIX: Store ALL event listener references for proper cleanup
// iOS accumulates these listeners on every game restart - MUST be removed in cleanupGame()!
const iosVisibilityHandler = () => {
  if (document.hidden) {
    saveGameState();
  }
};

(window as any)._saveGameStateRef = saveGameState;
(window as any)._iosVisibilityHandler = iosVisibilityHandler; // 🍎 Store for cleanup!

trackAppListener(window, 'pagehide', saveGameState);
trackAppListener(window, 'visibilitychange', iosVisibilityHandler);

// iOS/Android specific events
trackAppListener(window, 'beforeunload', saveGameState);
trackAppListener(document, 'pause', saveGameState, false); // Android
// 🔥 MEMORY LEAK FIX: Store reference for cleanup (same function)
(window as any)._saveGameStateResumeRef = saveGameState;
const resumeHandler = () => {
  // Reload game state when app resumes
  if (typeof window.loadGameState === 'function') {
    trackAppTimeout(() => {
      window.loadGameState();
    }, 100);
  }
};
(window as any)._resumeHandlerRef = resumeHandler;
trackAppListener(document, 'resume', resumeHandler, false); // Android

// CRITICAL: Expose function to sync score from app-boot.ts
// This ensures STATE.score and local score variable stay in sync
(window as any).syncScoreToCore = (newScore: number) => {
  score = newScore;
  STATE.score = newScore;
  devLog('🔄 Synced score to core:', newScore);
};

export { app, stage, board, hud, tiles, grid, score, level }; 
