import { shouldUseJourneyWorldIntroTheme } from './journey-world-intro-wild';
import {
  getForestWildRewardCoreType,
  getForestWildRewardVariantId,
  isForestJourneyBoard,
  pickForestWildReward,
} from './journey-forest-wild-progression';
import {
  getArea55WildRewardCoreType,
  getArea55WildRewardVariantId,
  isArea55JourneyBoard,
  pickArea55WildReward,
} from './journey-area55-wild-progression';

type WildTypeDeps = {
  boardNumber: number;
  isArcade: boolean;
  firstWildSpawned: boolean;
  wildSpawnCount: number;
  lastWildDropType?: WildDropType | null;
  wildDropTypeStreak?: number;
  filterWildType: (type: string, boardNumber: number) => string;
  devLog: (...args: any[]) => void;
  devWarn: (...args: any[]) => void;
};

type WildDropType = 'wild' | 'wild-juice' | 'wild-magnet' | 'wild-tnt';
const WILD_DROP_TYPES: WildDropType[] = ['wild', 'wild-juice', 'wild-magnet', 'wild-tnt'];
const MAX_SAME_WILD_DROP_STREAK = 2;

export type WildTypeDecision = {
  spawnJuice: boolean;
  spawnMagnet: boolean;
  spawnTnt: boolean;
  wildType: WildDropType;
  specialDiceVariantId?: string | null;
};

export function decideWildType({
  boardNumber,
  isArcade,
  wildSpawnCount,
  lastWildDropType = null,
  wildDropTypeStreak = 0,
  filterWildType,
  devLog,
  devWarn,
}: WildTypeDeps): WildTypeDecision | null {
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

  if (!isArcade && isForestJourneyBoard(boardNumber)) {
    const forestReward = pickForestWildReward({
      boardNumber,
      wildSpawnCount,
      roll,
    });
    if (!forestReward) {
      devWarn(`⚠️ Forest Stage ${boardNumber}: No progression Wild reward available`);
      return null;
    }
    const wildType = getForestWildRewardCoreType(forestReward);
    return {
      spawnJuice: wildType === 'wild-juice',
      spawnMagnet: wildType === 'wild-magnet',
      spawnTnt: wildType === 'wild-tnt',
      wildType,
      specialDiceVariantId: getForestWildRewardVariantId(forestReward),
    };
  }

  if (!isArcade && isArea55JourneyBoard(boardNumber)) {
    const area55Reward = pickArea55WildReward({
      boardNumber,
      wildSpawnCount,
      previousWildType: lastWildDropType,
      roll,
    });
    if (!area55Reward) {
      devWarn(`⚠️ Area 55 Cjelina ${boardNumber - 20}: No progression Wild reward available`);
      return null;
    }
    const wildType = getArea55WildRewardCoreType(area55Reward);
    return {
      spawnJuice: wildType === 'wild-juice',
      spawnMagnet: wildType === 'wild-magnet',
      spawnTnt: wildType === 'wild-tnt',
      wildType,
      specialDiceVariantId: getArea55WildRewardVariantId(area55Reward),
    };
  }

  // Beach keeps its established first-Stage theme cadence after the authored
  // Forest and Area 55 progression owners have handled their worlds above.
  const isJourneyWorldIntro = !isArcade && boardNumber === 11;
  const isBeachStageOne = !isArcade && boardNumber === 11;
  let filtered = isJourneyWorldIntro
    ? (isBeachStageOne && shouldUseJourneyWorldIntroTheme({
        wildSpawnCount,
        previousWildType: lastWildDropType,
        roll,
      }) ? 'wild-juice' : 'wild')
    : filterWildType(preferred, boardNumber) as WildDropType | null;
  const wouldExceedStreak =
    !isJourneyWorldIntro &&
    filtered &&
    filtered === lastWildDropType &&
    wildDropTypeStreak >= MAX_SAME_WILD_DROP_STREAK;

  if (wouldExceedStreak) {
    const allowedAlternatives = WILD_DROP_TYPES
      .map((type) => filterWildType(type, boardNumber) as WildDropType | null)
      .filter((type, index, arr): type is WildDropType => !!type && type !== filtered && arr.indexOf(type) === index);

    if (allowedAlternatives.length > 0) {
      const alternative = allowedAlternatives[(Math.random() * allowedAlternatives.length) | 0];
      devLog('🎲 Wild drop streak guard rerolled type:', {
        blockedType: filtered,
        streak: wildDropTypeStreak,
        alternative,
        boardNumber
      });
      filtered = alternative;
    }
  }

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
    lastWildDropType,
    wildDropTypeStreak,
    spawnJuice,
    spawnMagnet,
    spawnTnt,
    boardNumber
  });

  return { spawnJuice, spawnMagnet, spawnTnt, wildType: filtered };
}
