import { preloadKantaMerge6Sounds } from './kanta-merge6-sound';
import { getForestWildPool, isForestJourneyBoard } from './journey-forest-wild-progression';
import { getArea55WildPool, isArea55JourneyBoard } from './journey-area55-wild-progression';
import { getSpecialDiceVariantForTile, SPECIAL_DICE_VARIANTS } from './special-dice-registry';
import { preloadFishMerge6Sounds } from './fish-merge6-sound';
import { preloadBeachBallMerge6Sounds } from './beach-ball-merge6-sound';
import { preloadCoreTntMerge6Sound } from './core-tnt-merge6-sound';
import { preloadFlowerMerge6Sounds } from './flower-merge6-sound';
import { preloadBeeMerge6Sounds } from './bee-merge6-sound';
import { preloadRoboCubeMerge6Sounds } from './robo-cube-merge6-sound';
import { preloadBottleFinaleSounds } from './bottle-finale-sound';
import { preloadBottlePullMergeSounds } from './bottle-pull-merge-sound';
import { preloadMagnetPullForceSounds } from './magnet-pull-force-sound';
import { preloadHoneyMerge6Sounds } from './honey-merge6-sound';

export interface SpecialSoundWarmupContext {
  boardNumber: number;
  isArcade: boolean;
  tiles?: readonly any[];
}

/** Actual reward pool plus live saved variants; no random reward selection. */
export function getSpecialSoundWarmupFamilies({ boardNumber, isArcade, tiles = [] }: SpecialSoundWarmupContext): Set<string> {
  let families: Set<string>;
  if (!isArcade && isForestJourneyBoard(boardNumber)) families = new Set(getForestWildPool(boardNumber));
  else if (!isArcade && isArea55JourneyBoard(boardNumber)) families = new Set(getArea55WildPool(boardNumber));
  else if (!isArcade && boardNumber >= 12 && boardNumber <= 20) families = new Set(['fish', 'beach-ball', 'bottle', 'juice']);
  else families = new Set(['wild-star', 'juice', 'magnet', 'tnt']);
  if (isArcade && boardNumber === 1) {
    Object.values(SPECIAL_DICE_VARIANTS).forEach(variant => {
      if (Number.isFinite(variant.arcadeTestOrder)) families.add(variant.id);
    });
  }
  for (const tile of tiles) {
    if (!tile || tile.destroyed) continue;
    const variant = getSpecialDiceVariantForTile(tile);
    if (variant) families.add(variant.id);
    else if (tile.special === 'wild-tnt') families.add('tnt');
    else if (tile.special === 'wild-magnet') families.add('magnet');
    else if (tile.special === 'wild-juice') families.add('juice');
  }
  return families;
}

/** Preload only; all playback, Settings gates, gains and fallbacks remain with
 * the existing sound owners. Core Star/poof and ordinary cues stay entry-ready. */
export function preloadEligibleSpecialSounds(context: SpecialSoundWarmupContext): void {
  const families = getSpecialSoundWarmupFamilies(context);
  if (families.has('fish')) preloadFishMerge6Sounds();
  if (families.has('beach-ball')) preloadBeachBallMerge6Sounds();
  if (families.has('tnt')) preloadCoreTntMerge6Sound();
  if (families.has('flower')) preloadFlowerMerge6Sounds();
  if (families.has('bee')) preloadBeeMerge6Sounds();
  if (families.has('kanta')) preloadKantaMerge6Sounds();
  if (families.has('robo-cube')) preloadRoboCubeMerge6Sounds();
  if (families.has('bottle')) {
    preloadBottleFinaleSounds();
    preloadBottlePullMergeSounds();
  }
  if (['magnet', 'honey', 'bottle', 'spaceship'].some(family => families.has(family))) preloadMagnetPullForceSounds();
  if (families.has('honey')) preloadHoneyMerge6Sounds();
}
