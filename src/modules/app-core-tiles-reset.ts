type ResetTilesDeps = {
  tiles: any[];
  gsap: any;
  stopWildIdle: (...args: any[]) => void;
  stopWildShimmer: (...args: any[]) => void;
  stopWildStars: (...args: any[]) => void;
  stopWildBeerBubbles: (...args: any[]) => void;
  stopMagnetIdleParticles: (...args: any[]) => void;
  cleanupTilesForRebuild: (deps: {
    tiles: any[];
    gsap: any;
    stopWildIdle: (...args: any[]) => void;
    stopWildShimmer: (...args: any[]) => void;
    stopWildStars: (...args: any[]) => void;
    stopWildBeerBubbles: (...args: any[]) => void;
    stopMagnetIdleParticles: (...args: any[]) => void;
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
  stopWildBeerBubbles,
  stopMagnetIdleParticles,
  cleanupTilesForRebuild,
  devWarn,
}: ResetTilesDeps){
  cleanupTilesForRebuild({
    tiles,
    gsap,
    stopWildIdle,
    stopWildShimmer,
    stopWildStars,
    stopWildBeerBubbles,
    stopMagnetIdleParticles,
    devWarn,
  });
  tiles.length = 0;
}
