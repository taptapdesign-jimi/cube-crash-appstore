type StartLevelWildDeps = {
  setWildMeter: (v: number) => void;
  resetWildProgress: (value: number, animate?: boolean) => void;
  setWildJuiceSpawned: (v: boolean) => void;
  setWildMagnetSpawned: (v: boolean) => void;
  setFirstWildSpawned: (v: boolean) => void;
  setWildSpawnCount?: (v: number) => void;
  setWildMergeLockedSpawnCount?: (v: number) => void;
  setLastWildDropType?: (v: string | null) => void;
  setWildDropTypeStreak?: (v: number) => void;
  preserveWildDropProgress?: boolean;
  carryoverWildMeter?: number;
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
  setLastWildDropType,
  setWildDropTypeStreak,
  preserveWildDropProgress = false,
  carryoverWildMeter = 0,
  clearEndGameCache,
}: StartLevelWildDeps){
  // Reset wild-related state
  const nextWildMeter = Math.max(0, Number.isFinite(carryoverWildMeter) ? carryoverWildMeter : 0);
  setWildMeter(nextWildMeter);
  resetWildProgress(nextWildMeter, false);
  setWildJuiceSpawned(false);
  setWildMagnetSpawned(false);
  setFirstWildSpawned(false);
  if (!preserveWildDropProgress) {
    setWildSpawnCount?.(0);
    setLastWildDropType?.(null);
    setWildDropTypeStreak?.(0);
  }
  setWildMergeLockedSpawnCount?.(0);
  
  // Clear end game cache when starting new level
  clearEndGameCache();
}
