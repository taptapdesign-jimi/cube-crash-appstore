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
};

export function handleLastMergeEarly({
  tiles,
  src,
  dst,
  effSum,
  boardNumber,
  wildMeter,
  setWildMeter,
  setStateWildMeter,
  HUD,
  setPendingCleanBoard,
  devLog,
  devWarn,
  isWildMagnetMerge,
}: LastMergeDeps){
  const activeTilesBeforeWildProgress = tiles.filter(t => {
    if (!t || t.locked) return false;
    const isWild = t.special === 'wild' || t.special === 'wild-magnet' || t.special === 'wild-beer';
    const hasValue = (t.value|0) > 0;
    return isWild || hasValue;
  });
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
  const oneIsWildForCheck = (srcSpecialForCheck === 'wild' || dstSpecialForCheck === 'wild' || 
                            srcSpecialForCheck === 'wild-beer' || dstSpecialForCheck === 'wild-beer' ||
                            srcSpecialForCheck === 'wild-magnet' || dstSpecialForCheck === 'wild-magnet');
  const bothAreRegular = !srcSpecialForCheck && !dstSpecialForCheck && 
                        (src.value|0) > 0 && (dst.value|0) > 0;
  
  const wasLastThreeOrMoreStackForCheck = bothAreRegular && 
                                          effSum < 6 &&
                                          activeTilesCountBeforeWildProgress >= 3 &&
                                          allTilesInvolvedForCheck;
  
  const isWildLastTwoForCheck = oneIsWildForCheck && 
                               visibleTilesCountBeforeWildProgress === 2 && 
                               activeTilesBeforeWildProgress.includes(src) && 
                               activeTilesBeforeWildProgress.includes(dst);
  
  const isRegularLastTwoMerge6 = bothAreRegular && 
                                 visibleTilesCountBeforeWildProgress === 2 && 
                                 activeTilesBeforeWildProgress.includes(src) && 
                                 activeTilesBeforeWildProgress.includes(dst) &&
                                 effSum === 6;
  
  const cannotPullDueToEndGame = isWildMagnetMerge && visibleTilesCountBeforeWildProgress === 2;
  const hasTilesToPullValue = (dst as any)?._hasTilesToPull;
  const willPullTiles = !cannotPullDueToEndGame && isWildMagnetMerge && effSum === 6 && (hasTilesToPullValue !== false);
  const isActuallyLastMerge = (isWildLastTwoForCheck || isRegularLastTwoMerge6) && !willPullTiles;
  
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
  
  return {
    isActuallyLastMerge,
    wasLastThreeOrMoreStackForCheck,
    willPullTiles,
    visibleTilesCountBeforeWildProgress,
    activeTilesCountBeforeWildProgress,
    activeTilesBeforeWildProgress,
  };
}
