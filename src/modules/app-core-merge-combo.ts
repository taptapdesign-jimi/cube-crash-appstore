type MergeComboDeps = {
  combo: number;
  effSum: number;
  isWildMagnetMerge: boolean;
  boardNumber: number;
  statsService: { updateLongestCombo: (v: number) => void };
  hudSetCombo: (v: number) => void;
  scheduleComboDecay: () => void;
  HUD: { bumpCombo?: (opts?: any) => void };
  devLog: (...args: any[]) => void;
  devError: (...args: any[]) => void;
};

export function handleMergeCombo({
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
}: MergeComboDeps){
  // 🔥 CRITICAL: Check if this is wild-magnet merge that will pull tiles
  // If so, skip combo increment AND timer here - magnet pull will handle both with proper count
  const willPullTilesForCombo = isWildMagnetMerge && effSum === 6; // Preliminary check for combo logic
  const newComboValue = combo + 1; // Calculate new combo value BEFORE setting it
  
  if (!willPullTilesForCombo) {
    hudSetCombo(newComboValue);
    try { HUD.bumpCombo?.({ kind: 'stack', combo: newComboValue }); } catch {}
    scheduleComboDecay();
  } else {
    // Wild-magnet merge that will pull tiles - don't increment combo or start timer here
    // Combo will be handled in mergePulledTilesIntoMerge6 with proper increment
    devLog('🧲 MAGNET COMBO: Skipping combo increment and timer in main merge flow - magnet pull will handle it');
  }

  // 🔥 USER REQUEST: Track longest combo AFTER combo is incremented (use the NEW combo value we just set)
  // Only track if combo was actually incremented (not for magnet pull merges)
  if (!willPullTilesForCombo) {
    // Stats: track longest combo (global and per-board) - use NEW combo value
    statsService.updateLongestCombo(newComboValue);
    
    // 🔥 JOURNEY BOARDS: Track longest combo per board - use NEW combo value
    try {
      import('../services/board-stats-service.js').then(({ boardStatsService }) => {
        boardStatsService.updateBoardLongestCombo(boardNumber, newComboValue);
        devLog(`🎯 Tracked longest combo for board ${boardNumber}: ${newComboValue}`);
      }).catch(() => {
        // Ignore import errors
      });
    } catch {}
  }

  return { willPullTilesForCombo, newComboValue };
}
