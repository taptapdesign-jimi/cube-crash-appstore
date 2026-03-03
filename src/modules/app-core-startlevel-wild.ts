type StartLevelWildDeps = {
  setWildMeter: (v: number) => void;
  resetWildProgress: (value: number, animate?: boolean) => void;
  setWildJuiceSpawned: (v: boolean) => void;
  setWildMagnetSpawned: (v: boolean) => void;
  setFirstWildSpawned: (v: boolean) => void;
  setWildSpawnCount?: (v: number) => void;
  setWildMergeLockedSpawnCount?: (v: number) => void;
  clearEndGameCache: () => void;
};

export function resetWildAndEndgameState({
  setWildMeter,
  resetWildProgress,
  setWildJuiceSpawned,
  setWildMagnetSpawned,
  setFirstWildSpawned,
  setWildSpawnCount,
  setWildMergeLockedSpawnCount,
  clearEndGameCache,
}: StartLevelWildDeps){
  // Reset wild-related state
  setWildMeter(0);
  resetWildProgress(0, false);
  setWildJuiceSpawned(false);
  setWildMagnetSpawned(false);
  setFirstWildSpawned(false);
  setWildSpawnCount?.(0);
  setWildMergeLockedSpawnCount?.(0);
  
  // Clear end game cache when starting new level
  clearEndGameCache();
}
