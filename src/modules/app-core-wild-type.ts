type WildTypeDeps = {
  boardNumber: number;
  firstWildSpawned: boolean;
  wildSpawnCount: number;
  filterWildType: (type: string, boardNumber: number) => string;
  devLog: (...args: any[]) => void;
  devWarn: (...args: any[]) => void;
};

export function decideWildType({
  boardNumber,
  firstWildSpawned,
  wildSpawnCount,
  filterWildType,
  devLog,
  devWarn,
}: WildTypeDeps){
  let spawnJuice = false;
  let spawnMagnet = false;
  let spawnTnt = false;

  // 🔥 USER REQUEST: Random wilds on ALL boards with consistent drop rates
  // Common: wild star + wild juice, Uncommon: wild magnet, Legendary: wild TNT
  const roll = Math.random();
  // 50% wild star, remaining 50% split equally (juice/magnet/tnt = 16.67% each)
  const preferred =
    roll < 0.50 ? 'wild' :          // 50% wild star (common)
    roll < 0.6667 ? 'wild-juice' :   // 16.67% wild juice
    roll < 0.8334 ? 'wild-magnet' : // 16.67% wild magnet
                    'wild-tnt';     // 16.66% wild TNT

  const filtered = filterWildType(preferred, boardNumber);
  if (filtered === 'wild-juice') {
    spawnJuice = true;
  } else if (filtered === 'wild-magnet') {
    spawnMagnet = true;
  } else if (filtered === 'wild-tnt') {
    spawnTnt = true;
  } else if (filtered === 'wild') {
    // Regular wild star (default)
  } else {
    devWarn(`⚠️ Board ${boardNumber}: No wild type allowed, but spawn was attempted`);
    return null;
  }

  devLog('🎲 Wild drop roll:', {
    roll: +roll.toFixed(4),
    preferred,
    filtered,
    spawnJuice,
    spawnMagnet,
    spawnTnt,
    boardNumber
  });

  return { spawnJuice, spawnMagnet, spawnTnt };
}
