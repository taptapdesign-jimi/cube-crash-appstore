type ResetTilesDeps = {
  tiles: any[];
  gsap: any;
  stopWildIdle: (...args: any[]) => void;
  stopWildShimmer: (...args: any[]) => void;
  stopWildStars: (...args: any[]) => void;
  stopWildJuiceBubbles: (...args: any[]) => void;
  stopMagnetIdleParticles: (...args: any[]) => void;
  stopTntIdleParticles: (...args: any[]) => void;
  stopTntIdleShake: (...args: any[]) => void;
  cleanupTilesForRebuild: (deps: {
    tiles: any[];
    gsap: any;
    stopWildIdle: (...args: any[]) => void;
    stopWildShimmer: (...args: any[]) => void;
    stopWildStars: (...args: any[]) => void;
    stopWildJuiceBubbles: (...args: any[]) => void;
    stopMagnetIdleParticles: (...args: any[]) => void;
    stopTntIdleParticles: (...args: any[]) => void;
    stopTntIdleShake: (...args: any[]) => void;
    devWarn: (...args: any[]) => void;
  }) => void;
  devWarn: (...args: any[]) => void;
};

export function resetTilesForRebuild({
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
}: ResetTilesDeps){
  cleanupTilesForRebuild({
    tiles,
    gsap,
    stopWildIdle,
    stopWildShimmer,
    stopWildStars,
    stopWildJuiceBubbles,
    stopMagnetIdleParticles,
    stopTntIdleParticles,
    stopTntIdleShake,
    devWarn,
  });
  tiles.length = 0;
}
