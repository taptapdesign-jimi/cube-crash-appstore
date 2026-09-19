import { preloadKantaMerge6Sounds } from './kanta-merge6-sound';
import { getSpecialDiceVariantForTile } from './special-dice-registry';
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
import { preloadLaserGunMerge6Sounds } from './laser-gun-merge6-sound.ts';
import { preloadSpaceshipMerge6Sounds } from './spaceship-merge6-sound.ts';
import { preloadBarrelMerge6Sounds } from './barrel-merge6-sound.ts';
import { preloadJuiceMerge6Sounds } from './juice-finale-sound.ts';

export interface SpecialSoundWarmupContext {
  boardNumber: number;
  isArcade: boolean;
  tiles?: readonly any[];
}

/** Warm only specials that already exist on the board. Warming every possible
 * World/Arcade reward overfills the mobile decoded-audio cache before any of
 * those dice exists, forcing continuous decode/evict churn. A new special is
 * passed here as soon as its spawn commits, before its drop animation ends. */
export function getSpecialSoundWarmupFamilies({ boardNumber, isArcade, tiles = [] }: SpecialSoundWarmupContext): Set<string> {
  void boardNumber;
  void isArcade;
  const families = new Set<string>();
  for (const tile of tiles) {
    if (!tile || tile.destroyed) continue;
    const variant = getSpecialDiceVariantForTile(tile);
    if (variant) {
      families.add(variant.id);
      if (variant.archetype === 'wild-tnt') families.add('tnt');
      else if (variant.archetype === 'wild-magnet') families.add('magnet');
      else if (variant.archetype === 'wild-juice') families.add('juice');
      else if (variant.archetype === 'wild-star') families.add('wild-star');
    }
    else if (tile.special === 'wild-tnt') families.add('tnt');
    else if (tile.special === 'wild-magnet') families.add('magnet');
    else if (tile.special === 'wild-juice') families.add('juice');
    else if (tile.special === 'wild') families.add('wild-star');
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
  if (families.has('barell')) preloadBarrelMerge6Sounds();
  if (families.has('juice')) preloadJuiceMerge6Sounds();
  if (families.has('flower')) preloadFlowerMerge6Sounds();
  if (families.has('bee')) preloadBeeMerge6Sounds();
  if (families.has('kanta')) preloadKantaMerge6Sounds();
  if (families.has('laser-gun')) preloadLaserGunMerge6Sounds();
  if (families.has('spaceship')) preloadSpaceshipMerge6Sounds();
  if (families.has('robo-cube')) preloadRoboCubeMerge6Sounds();
  if (families.has('bottle')) {
    preloadBottleFinaleSounds();
    preloadBottlePullMergeSounds();
  }
  if (['magnet', 'honey', 'bottle', 'spaceship'].some(family => families.has(family))) preloadMagnetPullForceSounds();
  if (families.has('honey')) preloadHoneyMerge6Sounds();
}
