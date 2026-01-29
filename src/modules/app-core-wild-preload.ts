type WildPreloadDeps = {
  tiles: any[];
  devLog: (...args: any[]) => void;
};

export function hasLastMergeTile({ tiles, devLog }: WildPreloadDeps){
  const found = tiles.some((t: any) => t && !t.destroyed && t.value === 6 && (t as any)?._isLastMerge === true);
  if (found) {
    devLog('🚨🚨🚨 SOURCE OF TRUTH: Preload bar blocked - last merge detected (_isLastMerge flag)');
    devLog('🎯 Source of Truth: Case B — 2 tiles stack → result = 6 (NO PRELOAD SPAWN)');
    devLog('🚨🚨🚨 Wild spawn will NOT be executed, preventing wild spawn on last merge');
  }
  return found;
}
