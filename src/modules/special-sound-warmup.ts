import { preloadKantaMerge6Sounds } from './kanta-merge6-sound';
import { getSpecialDiceVariantForTile } from './special-dice-registry';
import { preloadFishMerge6Sounds } from './fish-merge6-sound';
import { preloadBeachBallMerge6Sounds } from './beach-ball-merge6-sound';
import { preloadCoreTntBonusImpactSounds, preloadCoreTntMerge6Sound } from './core-tnt-merge6-sound';
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
import { preloadWildStarMerge6Sound } from './wild-star-merge6-sound.ts';

export interface SpecialSoundWarmupContext {
  boardNumber: number;
  isArcade: boolean;
  tiles?: readonly any[];
}

export interface SpecialSoundWorkingSetPlan {
  readonly generation: number;
  /** Snapshot only. Reading the plan never fetches or decodes audio. */
  getFamilies: () => ReadonlySet<string>;
  /** Refreshes the live-board inventory without warming every possible finale. */
  refresh: (context: SpecialSoundWarmupContext) => boolean;
  /** Prepares exactly one committed die's authored transaction package. */
  prepareCommittedTransaction: (tile: any) => boolean;
  /** Invalidates every later callback owned by this board generation. */
  release: () => void;
}

let workingSetGeneration = 0;
let activeWorkingSetGeneration = 0;

/** Inventory only specials that already exist on the board. Projecting possible
 * World/Arcade rewards (or decoding every live family) overfills the mobile
 * decoded-audio cache and forces continuous decode/evict churn. */
export function getSpecialSoundWarmupFamilies({ boardNumber, isArcade, tiles = [] }: SpecialSoundWarmupContext): Set<string> {
  void boardNumber;
  void isArcade;
  const families = new Set<string>();
  for (const tile of tiles) {
    if (!tile || tile.destroyed) continue;
    const variant = getSpecialDiceVariantForTile(tile);
    if (variant) {
      families.add(variant.id);
      // Sharing gameplay does not mean sharing the core die's authored sound
      // package. Variant owners preload their own foundations; TNT variants
      // also need the shared bonus-impact subset used by their gameplay tail.
      if (variant.archetype === 'wild-tnt') families.add('tnt-bonus');
    }
    else if (tile.special === 'wild-tnt') families.add('tnt');
    else if (tile.special === 'wild-magnet') families.add('magnet');
    else if (tile.special === 'wild-juice') families.add('juice');
    else if (tile.special === 'wild') families.add('wild-star');
  }
  return families;
}

function preloadSpecialSoundFamilies(families: ReadonlySet<string>): void {
  if (families.has('wild-star')) preloadWildStarMerge6Sound();
  if (families.has('fish')) preloadFishMerge6Sounds();
  if (families.has('beach-ball')) preloadBeachBallMerge6Sounds();
  if (families.has('tnt')) preloadCoreTntMerge6Sound();
  if (families.has('tnt-bonus')) preloadCoreTntBonusImpactSounds();
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

/**
 * Board entry and Special spawn are inventory boundaries, not finale playback
 * boundaries. Historically this API decoded every complete finale belonging to
 * every live die. Cumulative Worlds can legitimately contain five families, so
 * that policy made the families evict and re-decode one another inside the fixed
 * mobile cache. Keep this compatibility entry point observational: callers may
 * discover the live families, but no decoded finale working set is allocated.
 *
 * Exact transaction preparation belongs to `SpecialSoundWorkingSetPlan` below.
 */
export function preloadEligibleSpecialSounds(context: SpecialSoundWarmupContext): void {
  getSpecialSoundWarmupFamilies(context);
}

/**
 * Owns one board generation's bounded Special-audio plan. Only the exact die
 * whose gameplay transaction has committed may request its authored package.
 * A replacement board invalidates the preceding plan synchronously, so a stale
 * merge callback cannot start another family's preparation.
 *
 * This owner deliberately does not stop audible voices. Feature sound modules
 * still own playback, tails and hard cleanup; the plan owns preparation only.
 */
export function acquireSpecialSoundWorkingSetPlan(
  initialContext: SpecialSoundWarmupContext,
): SpecialSoundWorkingSetPlan {
  const generation = ++workingSetGeneration;
  activeWorkingSetGeneration = generation;
  let released = false;
  let families = getSpecialSoundWarmupFamilies(initialContext);
  const preparedFamilies = new Set<string>();
  const isCurrent = (): boolean => !released && activeWorkingSetGeneration === generation;

  return {
    generation,
    getFamilies: () => new Set(families),
    refresh: (context) => {
      if (!isCurrent()) return false;
      families = getSpecialSoundWarmupFamilies(context);
      return true;
    },
    prepareCommittedTransaction: (tile) => {
      if (!isCurrent() || !tile || tile.destroyed) return false;
      const committedFamilies = getSpecialSoundWarmupFamilies({
        boardNumber: initialContext.boardNumber,
        isArcade: initialContext.isArcade,
        tiles: [tile],
      });
      if (committedFamilies.size === 0) return false;
      committedFamilies.forEach((family) => families.add(family));
      const unpreparedFamilies = new Set(
        [...committedFamilies].filter((family) => !preparedFamilies.has(family)),
      );
      if (unpreparedFamilies.size === 0) return true;
      unpreparedFamilies.forEach((family) => preparedFamilies.add(family));
      preloadSpecialSoundFamilies(unpreparedFamilies);
      return true;
    },
    release: () => {
      if (released) return;
      released = true;
      if (activeWorkingSetGeneration === generation) activeWorkingSetGeneration = 0;
      families.clear();
      preparedFamilies.clear();
    },
  };
}

export function resetSpecialSoundWorkingSetForTests(): void {
  workingSetGeneration = 0;
  activeWorkingSetGeneration = 0;
}
