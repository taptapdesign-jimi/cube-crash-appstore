export type ForestWildReward = 'wild-star' | 'mushroom' | 'flower' | 'honey' | 'bee' | 'tnt';
export type ForestWildCoreType = 'wild' | 'wild-juice' | 'wild-magnet' | 'wild-tnt';

const FOREST_FIRST_BOARD = 1;
const FOREST_LAST_BOARD = 10;

const FOREST_WILD_POOLS = {
  1: ['wild-star'],
  2: ['wild-star', 'mushroom'],
  3: ['wild-star', 'mushroom', 'flower'],
  4: ['wild-star', 'mushroom', 'flower', 'honey'],
  5: ['wild-star', 'mushroom', 'flower', 'honey'],
  6: ['wild-star', 'mushroom', 'flower', 'honey', 'bee'],
  7: ['wild-star', 'mushroom', 'flower', 'honey', 'bee', 'tnt'],
  8: ['wild-star', 'mushroom', 'flower', 'honey', 'bee', 'tnt'],
  9: ['wild-star', 'mushroom', 'flower', 'honey', 'bee', 'tnt'],
  10: ['wild-star', 'mushroom', 'flower', 'honey', 'bee', 'tnt'],
} as const satisfies Readonly<Record<number, readonly ForestWildReward[]>>;

const FOREST_INTRO_REWARD_BY_BOARD: Readonly<Partial<Record<number, ForestWildReward>>> = Object.freeze({
  1: 'wild-star',
  2: 'mushroom',
  3: 'flower',
  4: 'honey',
  6: 'bee',
  7: 'tnt',
});

const FOREST_REWARD_CORE_TYPE: Readonly<Record<ForestWildReward, ForestWildCoreType>> = Object.freeze({
  'wild-star': 'wild',
  mushroom: 'wild-juice',
  flower: 'wild-tnt',
  honey: 'wild-magnet',
  bee: 'wild',
  tnt: 'wild-tnt',
});

export function isForestJourneyBoard(boardNumber: number): boolean {
  const board = Math.trunc(boardNumber);
  return board >= FOREST_FIRST_BOARD && board <= FOREST_LAST_BOARD;
}

export function getForestWildPool(boardNumber: number): readonly ForestWildReward[] {
  return FOREST_WILD_POOLS[Math.trunc(boardNumber)] || [];
}

export function pickForestWildReward({
  boardNumber,
  wildSpawnCount,
  roll,
}: {
  boardNumber: number;
  wildSpawnCount: number;
  roll: number;
}): ForestWildReward | null {
  const board = Math.trunc(boardNumber);
  const pool = getForestWildPool(board);
  if (pool.length === 0) return null;

  // The first meter reward on an introduction Stage demonstrates the newly
  // unlocked die. Later rewards use the complete pool earned so far.
  if (Math.max(0, Math.trunc(wildSpawnCount)) === 0) {
    return FOREST_INTRO_REWARD_BY_BOARD[board] || pool[0];
  }

  const finiteRoll = Number.isFinite(roll) ? Number(roll) : 0;
  const boundedRoll = Math.max(0, Math.min(1 - Number.EPSILON, finiteRoll));
  return pool[Math.floor(boundedRoll * pool.length)] || pool[0];
}

export function getForestWildRewardCoreType(reward: ForestWildReward): ForestWildCoreType {
  return FOREST_REWARD_CORE_TYPE[reward];
}

export function getForestAllowedWildCoreTypes(boardNumber: number): ForestWildCoreType[] {
  return Array.from(new Set(getForestWildPool(boardNumber).map(getForestWildRewardCoreType)));
}

export function getForestWildRewardVariantId(reward: ForestWildReward): string | null {
  if (reward === 'wild-star' || reward === 'tnt') return null;
  return reward;
}
