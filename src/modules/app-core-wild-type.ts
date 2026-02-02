type WildTypeDeps = {
  boardNumber: number;
  firstWildSpawned: boolean;
  filterWildType: (type: string, boardNumber: number) => string;
  devLog: (...args: any[]) => void;
  devWarn: (...args: any[]) => void;
};

export function decideWildType({
  boardNumber,
  firstWildSpawned,
  filterWildType,
  devLog,
  devWarn,
}: WildTypeDeps){
  let spawnBeer = false;
  let spawnMagnet = false;
  let spawnTnt = false;
  
  // 🔥 USER REQUEST: On board 1, first wild spawn is always magnet
  if (!firstWildSpawned && boardNumber === 1) {
    spawnBeer = false;
    spawnMagnet = true;
    spawnTnt = false;
    devLog('🧲 Board 1: First wild spawn: Forcing wild-magnet');
  } else if (!firstWildSpawned) {
    // 🔥 USER REQUEST: First wild spawn on other boards is always TNT (Explosion Pack) – najjači efekat
    spawnBeer = false;
    spawnMagnet = false;
    spawnTnt = true;
    devLog('💥 First wild spawn: Forcing TNT (Explosion Pack)');
  } else if (boardNumber === 3) {
    // 🎯 BOARD 3: Force wild-beer only (check first, before default logic)
    spawnBeer = true;
    spawnMagnet = false;
    spawnTnt = false;
    devLog('🎯 Board 3: Forcing wild-beer spawn only');
  } else {
    // 🔥 Random wild spawn: 35% beer, 35% wild (stars), 20% magnet, 10% TNT (Explosion Pack)
    const randomRoll = Math.random();
    let preferredBeer = false;
    let preferredMagnet = false;
    let preferredWild = false;
    let preferredTnt = false;
    
    if (randomRoll < 0.35) {
      preferredBeer = true;
    } else if (randomRoll < 0.70) {
      preferredWild = true;
    } else if (randomRoll < 0.90) {
      preferredMagnet = true;
    } else {
      preferredTnt = true;
    }
    
    // Apply board-specific rules
    if (preferredBeer) {
      const filtered = filterWildType('wild-beer', boardNumber);
      spawnBeer = filtered === 'wild-beer';
      spawnMagnet = false;
      spawnTnt = false;
    } else if (preferredMagnet) {
      const filtered = filterWildType('wild-magnet', boardNumber);
      spawnMagnet = filtered === 'wild-magnet';
      spawnBeer = false;
      spawnTnt = false;
    } else if (preferredTnt) {
      const filtered = filterWildType('wild-tnt', boardNumber);
      spawnTnt = filtered === 'wild-tnt';
      spawnBeer = false;
      spawnMagnet = false;
    } else if (preferredWild) {
      // Regular wild (stars) - check if allowed
      const filtered = filterWildType('wild', boardNumber);
      if (filtered === 'wild-beer') {
        spawnBeer = true;
        spawnMagnet = false;
        spawnTnt = false;
      } else if (filtered === 'wild-magnet') {
        spawnMagnet = true;
        spawnBeer = false;
        spawnTnt = false;
      } else if (filtered === 'wild-tnt') {
        spawnTnt = true;
        spawnBeer = false;
        spawnMagnet = false;
      } else if (filtered === 'wild') {
        spawnBeer = false;
        spawnMagnet = false;
        spawnTnt = false;
      } else {
        devWarn(`⚠️ Board ${boardNumber}: No wild type allowed, but spawn was attempted`);
        return null;
      }
    } else {
      // Fallback: use filterWildType with 'wild'
      const filtered = filterWildType('wild', boardNumber);
      if (filtered === 'wild-beer') {
        spawnBeer = true;
      } else if (filtered === 'wild-magnet') {
        spawnMagnet = true;
      } else if (filtered === 'wild-tnt') {
        spawnTnt = true;
      } else if (filtered === 'wild') {
        // Regular wild allowed
      } else {
        devWarn(`⚠️ Board ${boardNumber}: No wild type allowed, but spawn was attempted`);
        return null;
      }
    }
  }
  
  return { spawnBeer, spawnMagnet, spawnTnt };
}
