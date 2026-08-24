import { getFinalMergeTileSets } from './final-merge-rules.ts';
import { resolveMergeFinality } from './gameplay-resolution-engine.ts';

type LastMergeDeps = {
  tiles: any[];
  src: any;
  dst: any;
  effSum: number;
  boardNumber: number;
  wildMeter: number;
  setWildMeter: (v: number) => void;
  setStateWildMeter: (v: number) => void;
  HUD: { resetWildMeter?: (force?: boolean) => void };
  setPendingCleanBoard: (boardNumber: number) => void;
  devLog: (...args: any[]) => void;
  devWarn: (...args: any[]) => void;
  isWildMagnetMerge: boolean;
  mode?: 'arcade' | 'journey' | 'unknown';
};

type LastMergeEarlyInput = {
  tiles: any[];
  src: any;
  dst: any;
  effSum: number;
  isWildMagnetMerge: boolean;
  mode?: 'arcade' | 'journey' | 'unknown';
};

type LastMergeEarlyState = {
  isActuallyLastMerge: boolean;
  wasLastThreeOrMoreStackForCheck: boolean;
  willPullTiles: boolean;
  visibleTilesCountBeforeWildProgress: number;
  activeTilesCountBeforeWildProgress: number;
  activeTilesBeforeWildProgress: any[];
  isWildLastTwoForCheck: boolean;
  isRegularLastTwoMerge6: boolean;
  cannotPullDueToEndGame: boolean;
  srcSpecialForCheck: any;
  dstSpecialForCheck: any;
  finalMergeSnapshot: ReturnType<typeof resolveMergeFinality>['finalMerge'];
};

export function resolveLastMergeEarlyState({
  tiles,
  src,
  dst,
  effSum,
  isWildMagnetMerge,
  mode = 'unknown',
}: LastMergeEarlyInput): LastMergeEarlyState {
  const activeTilesBeforeWildProgress = getFinalMergeTileSets({ tiles, src, dst }).activeTilesBeforeMerge;
  // 🔥 CRITICAL: Use visible tiles count (not stackDepth sum) for "last 2 tiles" detection
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
  const srcSpecialForCheck = src?.special;
  const dstSpecialForCheck = dst?.special;
  const bothAreRegular = !srcSpecialForCheck && !dstSpecialForCheck && 
                        (src.value|0) > 0 && (dst.value|0) > 0;
  
  const wasLastThreeOrMoreStackForCheck = bothAreRegular && 
                                          effSum < 6 &&
                                          activeTilesCountBeforeWildProgress >= 3 &&
                                          allTilesInvolvedForCheck;
  
  const cannotPullDueToEndGame = isWildMagnetMerge && visibleTilesCountBeforeWildProgress === 2;
  const hasTilesToPullValue = (dst as any)?._hasTilesToPull;
  const willPullTiles = !cannotPullDueToEndGame && isWildMagnetMerge && effSum === 6 && hasTilesToPullValue === true;
  const finalMergeResult = resolveMergeFinality({
    mode,
    finalMergeInput: {
      activeTilesBeforeMerge: activeTilesBeforeWildProgress,
      src,
      dst,
      effSum,
      isWildMagnetMerge,
      hasTilesToPull: willPullTiles,
    },
    willPulledTilesMerge: false,
  });
  const finalMergeSnapshot = finalMergeResult.finalMerge;
  const isWildLastTwoForCheck = finalMergeSnapshot.isFinalWildLastTwo;
  const isRegularLastTwoMerge6 = finalMergeSnapshot.isFinalRegularMerge6;
  const isActuallyLastMerge = finalMergeResult.isFinalMerge;

  return {
    isActuallyLastMerge,
    wasLastThreeOrMoreStackForCheck,
    willPullTiles,
    visibleTilesCountBeforeWildProgress,
    activeTilesCountBeforeWildProgress,
    activeTilesBeforeWildProgress,
    isWildLastTwoForCheck,
    isRegularLastTwoMerge6,
    cannotPullDueToEndGame,
    srcSpecialForCheck,
    dstSpecialForCheck,
    finalMergeSnapshot,
  };
}

export function handleLastMergeEarly({
  tiles,
  src,
  dst,
  effSum,
  boardNumber,
  setWildMeter,
  setStateWildMeter,
  HUD,
  setPendingCleanBoard,
  devLog,
  devWarn,
  isWildMagnetMerge,
  mode = 'unknown',
}: LastMergeDeps){
  const state = resolveLastMergeEarlyState({
    tiles,
    src,
    dst,
    effSum,
    isWildMagnetMerge,
    mode,
  });
  const {
    activeTilesCountBeforeWildProgress,
    cannotPullDueToEndGame,
    dstSpecialForCheck,
    isActuallyLastMerge,
    isRegularLastTwoMerge6,
    isWildLastTwoForCheck,
    srcSpecialForCheck,
    willPullTiles,
  } = state;
  
  if (isActuallyLastMerge) {
    const mergeType = isWildLastTwoForCheck ? (isWildMagnetMerge ? 'Wild-magnet + regular' : 'Wild + regular') : 'Regular + regular';
    devLog(`🚨🚨🚨 LAST MERGE DETECTED (early check) - ${mergeType} → merge 6, resetting wild meter and skipping addWildProgress`);
    devLog('🚨 Details:', { 
      isWildLastTwoForCheck,
      isRegularLastTwoMerge6,
      effSum, 
      activeTilesCountBeforeWildProgress,
      srcSpecial: srcSpecialForCheck,
      dstSpecial: dstSpecialForCheck,
      srcValue: src.value,
      dstValue: dst.value,
      isWildMagnetMerge,
      cannotPullDueToEndGame,
      willPullTiles
    });
    // Reset wild meter to prevent wild spawn
    setWildMeter(0);
    setStateWildMeter(0);
    try {
      if (typeof HUD.resetWildMeter === 'function') {
        HUD.resetWildMeter(true);
      }
    } catch (error) {
      devWarn('⚠️ Failed to reset wild meter in HUD:', error);
    }
    // Mark dst as last merge early
    if (effSum === 6) {
      (dst as any)._isLastMerge = true;
      devLog('✅ _isLastMerge flag set EARLY on dst tile (before merge 6 block)');
      // 🔥 BOARD RECOVERY: Persist intent EARLY so we can recover if app is force-quit during animation
      try {
        setPendingCleanBoard(boardNumber);
        devLog('✅ RECOVERY: pendingCleanBoard flag set EARLY (before merge 6 block)');
      } catch (e) {
        devWarn('⚠️ Failed to set pending clean board flag (early):', e);
      }
    }
  } else if (isWildLastTwoForCheck || isRegularLastTwoMerge6) {
    // This would be last merge, but wild-magnet will pull tiles, so it's NOT last merge
    devLog('🧲 Would be last merge, but wild-magnet will pull tiles - NOT marking as last merge (new tiles will spawn)');
  }
  
  return state;
}
