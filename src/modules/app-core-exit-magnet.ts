type StopMagnetParticlesDeps = {
  tiles: any[];
  stopMagnetIdleParticles: (tile: any) => void;
  devLog: (...args: any[]) => void;
  devWarn: (...args: any[]) => void;
};

export function stopMagnetParticlesOnExit({
  tiles,
  stopMagnetIdleParticles,
  devLog,
  devWarn,
}: StopMagnetParticlesDeps){
  try {
    if (tiles && tiles.length > 0) {
      tiles.forEach((tile: any) => {
        try {
          if (tile && !tile.destroyed && tile.special === 'wild-magnet') {
            if (typeof stopMagnetIdleParticles === 'function') {
              stopMagnetIdleParticles(tile);
              devLog('✅ Board exit: Magnet idle particles stopped for tile');
            }
          }
        } catch (err) {
          devWarn('⚠️ Board exit: Error stopping magnet idle particles:', err);
        }
      });
      devLog('✅ Board exit: All magnet idle particles stopped');
    }
  } catch (e) {
    devWarn('⚠️ Board exit: Error stopping magnet idle particles:', e);
  }
}
