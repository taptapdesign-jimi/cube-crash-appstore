import type { Tile } from '../types/game-types.js';

type CleanupDeps = {
  tiles: Tile[];
  gsap: any;
  stopWildIdle?: (t: Tile) => void;
  stopWildShimmer?: (t: Tile) => void;
  stopWildStars?: (t: Tile) => void;
  stopWildJuiceBubbles?: (t: Tile) => void;
  stopMagnetIdleParticles?: (t: Tile) => void;
  stopTntIdleParticles?: (t: Tile) => void;
  stopTntIdleShake?: (t: Tile) => void;
  stopSpecialDiceIdleMotion?: (t: Tile) => void;
  devWarn: (...args: unknown[]) => void;
};

export function cleanupTilesForRebuild(deps: CleanupDeps) {
  const {
    tiles,
    gsap,
    stopWildIdle,
    stopWildShimmer,
    stopWildStars,
    stopWildJuiceBubbles,
    stopMagnetIdleParticles,
    stopTntIdleParticles,
    stopTntIdleShake,
    stopSpecialDiceIdleMotion,
    devWarn,
  } = deps;

  tiles.forEach(t => {
    try { stopSpecialDiceIdleMotion?.(t); } catch {}
    try { stopWildIdle?.(t); } catch {}
    try { stopWildShimmer?.(t); } catch {}
    try { stopWildStars?.(t); } catch {}
    try { stopWildJuiceBubbles?.(t); } catch {}
    try { stopMagnetIdleParticles?.(t); } catch {}
    try { stopTntIdleParticles?.(t); } catch {}
    try { stopTntIdleShake?.(t); } catch {}

    try {
      gsap.killTweensOf(t);
      gsap.killTweensOf(t.scale);
      if ((t as any)._idleBounceTl) {
        try { (t as any)._idleBounceTl.kill(); } catch {}
        (t as any)._idleBounceTl = null;
      }
    } catch {}

    try {
      if (typeof (window as any).killTileAnimations === 'function') {
        (window as any).killTileAnimations(t);
      }
    } catch {}

    try {
      gsap.killTweensOf(t);
      gsap.killTweensOf(t.scale);
      gsap.killTweensOf(t.rotG);
      if ((t as any)._glowAnimation) {
        (t as any)._glowAnimation.kill();
        (t as any)._glowAnimation = null;
      }
    } catch {}

    t.destroy({ children: true, texture: false, textureSource: false } as any);
  });
}
