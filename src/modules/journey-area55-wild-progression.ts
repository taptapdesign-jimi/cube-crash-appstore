export type Area55WildReward = 'wild-star' | 'robo-cube' | 'laser-gun' | 'spaceship' | 'kanta';
export type Area55WildCoreType = 'wild' | 'wild-juice' | 'wild-magnet' | 'wild-tnt';

const AREA55_FIRST_BOARD = 21;
const AREA55_LAST_BOARD = 30;
const AREA55_REWARD_ORDER = Object.freeze([
  'wild-star',
  'kanta',
  'robo-cube',
  'spaceship',
  'laser-gun',
] as const);
const AREA55_FIRST_REWARD_BY_BOARD: Readonly<Partial<Record<number, Area55WildReward>>> = Object.freeze({
  21: 'kanta',
  22: 'robo-cube',
  23: 'spaceship',
  24: 'laser-gun',
});
const AREA55_REWARD_CORE_TYPE: Readonly<Record<Area55WildReward, Area55WildCoreType>> = Object.freeze({
  'wild-star': 'wild',
  'robo-cube': 'wild-juice',
  'laser-gun': 'wild-tnt',
  spaceship: 'wild-magnet',
  kanta: 'wild',
});

export function isArea55JourneyBoard(boardNumber: number): boolean {
  const board = Math.trunc(boardNumber);
  return board >= AREA55_FIRST_BOARD && board <= AREA55_LAST_BOARD;
}

export function getArea55WildPool(boardNumber: number): readonly Area55WildReward[] {
  const board = Math.trunc(boardNumber);
  if (!isArea55JourneyBoard(board)) return [];
  if (board === 21) return AREA55_REWARD_ORDER.slice(0, 2);
  if (board === 22) return AREA55_REWARD_ORDER.slice(0, 3);
  if (board === 23) return AREA55_REWARD_ORDER.slice(0, 4);
  return AREA55_REWARD_ORDER;
}

export function pickArea55WildReward({
  boardNumber,
  wildSpawnCount,
  roll,
}: {
  boardNumber: number;
  wildSpawnCount: number;
  previousWildType?: Area55WildCoreType | null;
  roll: number;
}): Area55WildReward | null {
  const board = Math.trunc(boardNumber);
  const pool = getArea55WildPool(board);
  if (pool.length === 0) return null;

  const spawnCount = Math.max(0, Math.trunc(wildSpawnCount));
  const firstReward = AREA55_FIRST_REWARD_BY_BOARD[board];
  if (spawnCount === 0 && firstReward) return firstReward;

  const finiteRoll = Number.isFinite(roll) ? Number(roll) : 0;
  const boundedRoll = Math.max(0, Math.min(1 - Number.EPSILON, finiteRoll));
  return pool[Math.floor(boundedRoll * pool.length)] || pool[0];
}

export function getArea55WildRewardCoreType(reward: Area55WildReward): Area55WildCoreType {
  return AREA55_REWARD_CORE_TYPE[reward];
}

export function getArea55AllowedWildCoreTypes(boardNumber: number): Area55WildCoreType[] {
  return Array.from(new Set(getArea55WildPool(boardNumber).map(getArea55WildRewardCoreType)));
}

export function getArea55WildRewardVariantId(reward: Area55WildReward): string | null {
  return reward === 'wild-star' ? null : reward;
}
