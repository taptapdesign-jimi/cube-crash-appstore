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
  
  // 🔥 USER REQUEST: On board 1, first wild spawn is always magnet
  if (!firstWildSpawned && boardNumber === 1) {
    spawnBeer = false;
    spawnMagnet = true;
    devLog('🧲 Board 1: First wild spawn: Forcing wild-magnet');
  } else if (!firstWildSpawned) {
    // 🔥 USER REQUEST: First wild spawn on other boards is always wild zvjezdica (not wild-beer, not wild-magnet)
    spawnBeer = false;
    spawnMagnet = false;
    devLog('⭐ First wild spawn: Forcing wild zvjezdica (stars)');
  } else if (boardNumber === 3) {
    // 🎯 BOARD 3: Force wild-beer only (check first, before default logic)
    spawnBeer = true;
    spawnMagnet = false;
    devLog('🎯 Board 3: Forcing wild-beer spawn only');
  } else {
    // 🔥 USER REQUEST: Always random wild spawn - 40% beer, 40% wild (stars), 20% magnet
    const randomRoll = Math.random();
    let preferredBeer = false;
    let preferredMagnet = false;
    let preferredWild = false;
    
    if (randomRoll < 0.4) {
      // 0-0.4 = 40% chance for beer
      preferredBeer = true;
    } else if (randomRoll < 0.8) {
      // 0.4-0.8 = 40% chance for wild (stars)
      preferredWild = true;
    } else {
      // 0.8-1.0 = 20% chance for magnet
      preferredMagnet = true;
    }
    
    // Apply board-specific rules
    if (preferredBeer) {
      const filtered = filterWildType('wild-beer', boardNumber);
      spawnBeer = filtered === 'wild-beer';
      spawnMagnet = false;
    } else if (preferredMagnet) {
      const filtered = filterWildType('wild-magnet', boardNumber);
      spawnMagnet = filtered === 'wild-magnet';
      spawnBeer = false;
    } else if (preferredWild) {
      // Regular wild (stars) - check if allowed
      const filtered = filterWildType('wild', boardNumber);
      if (filtered === 'wild-beer') {
        spawnBeer = true;
        spawnMagnet = false;
      } else if (filtered === 'wild-magnet') {
        spawnMagnet = true;
        spawnBeer = false;
      } else if (filtered === 'wild') {
        // Regular wild allowed (stars)
        spawnBeer = false;
        spawnMagnet = false;
      } else {
        // No wild type allowed for this board - should not happen if we got here
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
      } else if (filtered === 'wild') {
        // Regular wild allowed
      } else {
        // No wild type allowed for this board - should not happen if we got here
        devWarn(`⚠️ Board ${boardNumber}: No wild type allowed, but spawn was attempted`);
        return null;
      }
    }
  }
  
  return { spawnBeer, spawnMagnet };
}
