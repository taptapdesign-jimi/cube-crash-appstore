type StartLevelWildDeps = {
  setWildMeter: (v: number) => void;
  resetWildProgress: (value: number, animate?: boolean) => void;
  setWildBeerSpawned: (v: boolean) => void;
  setWildMagnetSpawned: (v: boolean) => void;
  setFirstWildSpawned: (v: boolean) => void;
  clearEndGameCache: () => void;
};

export function resetWildAndEndgameState({
  setWildMeter,
  resetWildProgress,
  setWildBeerSpawned,
  setWildMagnetSpawned,
  setFirstWildSpawned,
  clearEndGameCache,
}: StartLevelWildDeps){
  // Reset wild-related state
  setWildMeter(0);
  resetWildProgress(0, false);
  setWildBeerSpawned(false);
  setWildMagnetSpawned(false);
  setFirstWildSpawned(false);
  
  // Clear end game cache when starting new level
  clearEndGameCache();
}
